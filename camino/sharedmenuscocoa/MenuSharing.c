/* 
Copyright (c) 1991-2000 UserLand Software, Inc. 

Permission is hereby granted, free of charge, to any person obtaining a 
copy of this software and associated documentation files (the 
"Software"), to deal in the Software without restriction, including 
without limitation the rights to use, copy, modify, merge, publish, 
distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to the 
following conditions: 

The above copyright notice and this permission notice shall be 
included in all copies or substantial portions of the Software. 

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE 
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION 
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
*/ 


/*
Version 4.2:
------------
9/22/02 ab: Adapted to work in a Cocoa framework named 'SharedMenusCocoa'

        1. Added Carbon Command Event Handler
        2. Start your Shared Menus with menu id = -32768, then id++ etc.
        3. Implemented  errordialog and eventfilter right here in this file

        ab = Alco Blom, Email: <mailto:alco@url-manager.com>
        
        <http://www.url-manager.com> and <http://www.web-confidential.com>
        
Version 4.1:
------------
8/28/00 rth: Carbonized the source and header files for use under Mac OS X

7/17/96 dmb: Give client more control over menu insertion & deletion

	1. Frontier 4.1 now allows client to do actual menu insertion and 
	deletion. Even for default operation, we use these callbacks so 
	we can recover in the case of a server crash
	
	2. Added SetMenusInserterCallback and SetMenusRemoverCallback to allow
	client to provide altername menu placement

	3. we override the server's default HandleMenuDirty event handler to 
	insure its validity in the case of a server crash
	
	4. if the (component) server disappears unexpectedly, set fldirtysharedmenus

Version 3.0.2:
--------------

3/22/94 dmb: Updated for Universal Headers and Power PC.
	
	If you're using Think C/Symantec C++, make sure you're 
	using the Universal Headers, not the headers that came on 
	your program disks. Universal Headers are on the Macintosh 
	on Risk SDK CD.

Version 3.0:
------------

11/1/93 DW: Minor changes to support Frontier 3.0

	1. Frontier 3.0 implements an even more efficient menu sharing protocol
	using the System 7.1 Component Manager. If possible, we use that protocol,
	otherwise we are prepared to use the Frontier 2.0-compatible protocol, or
	even the Frontier 1.0 protocol.
	
	2. Added a ComponentInstance field to the MSglobals struct. As with all 
	other fields of MSglobals, this is read-only and really only there to 
	support debugging..
	
	3. Added a procedure pointer field, scripterrorcallback, to the MSglobals 
	struct to allow error reporting. It replaces scriptcompletedcallback. 
	
	4. Added a procedure pointer field, eventfiltercallback, to the MSglobals 
	struct to allow error reporting. It allows the client app to handle 
	update, activate, OS and null events while a script is running. 
	
	4. InitSharedMenus takes a parameter, a pointer to a routine that 
	displays script error messages in a modal dialog
	
	5. Replaced calls to the IAC Tools library with direct calls to the 
	Apple Event Manager. Apps no longer have to include any iacxxx.c files
	in the project or #include <iac.h>.
	
11/3/93 DW: Minor code cleanup
	
	1. Removed the #pragma from HandleMenuDirty.
	
	2. Edited the headers on several routines to conform to the prototypes-
	required format. Allows this code to be compiled by the MetroWerks C++
	compiler.
	
	3. Updated copyright notices in this file and in menusharing.h.
	
11/4/93 DW: MPW-compatible & ifdefs

	6. built menusharing.c in MPW C. added #pragmas to head off warnings.
	
	7. implemented two ifdefs that allow you to turn off support for 
	Frontier 2.0 and 1.0, or turn off support for component menu sharing.
	
11/16/93 dmb: a tweak and a fix

	1. In the unlikely case that we're running on a system that supports 
	recording, which requires the Component Manager, but the Apple Event- 
	based protocol is being used, we set the DontRecord bit in the AESend 
	mode flags. [Note: in case the AppleEvents.h header file is out of date, 
	we #defined it, below (the value of this constant is 0x00001000).]
	
	2. In CheckSharedMenus, if the component instance has gone bad, clear out 
	the menuserver global so that we'll try to reconnect the next time.

Version 2.0:
------------

1/22/92 DW: provide for dialog on receipt of a 'done' message
	
	1. Frontier sets the 'errs' parameter if a shared script ended in an
	error. we set up the IAC globals so that the scriptcomplete handler
	can get the error string and display it in a dialog.
	
6/29/92 DW: fast menu sharing if Frontier 2.0 is present.

	1. this is possible because Frontier 2.0 installs system event handlers
	for the most time-consuming of the menu sharing operations.
	
8/13/92 DW: cleaner way of killing scripts.
	
	1. In CancelSharedScript, we now send a message to the menu sharing server
	asking that the script be killed. But only if we're talking to a server 
	that supports fast messages.
*/


#include <Carbon/Carbon.h>
#include "MenuSharing.h"

#define kAEDontRecord 0x00001000 /*this isn't defined in all versions of <AppleEvents.h>*/

#define componentMenuSharing /*undef this to disable component-based menu sharing.*/

#define frontierMenuSharing /*undef this to disable support for Frontier 1.0 and 2.0 menu sharing*/


tyMSglobals MSglobals = {0, 0, nil, false, false, false, false, 0, 0, nil}; 

enum {
	uppMSerrordialogProcInfo = kPascalStackBased
		 | STACK_ROUTINE_PARAMETER(1, SIZE_CODE(sizeof(char *)))
};

enum {
	uppMSeventfilterProcInfo = kPascalStackBased
		 | STACK_ROUTINE_PARAMETER(1, SIZE_CODE(sizeof(EventRecord *)))
};

enum {
	uppMSmenusinstallerProcInfo = kPascalStackBased
		 | STACK_ROUTINE_PARAMETER(1, SIZE_CODE(sizeof(hdlmenuarray)))
};


#if TARGET_API_MAC_CARBON
	typedef UniversalProcPtr MSerrordialogUPP;

	#define NewMSerrordialogProc(userRoutine)		\
			(MSerrordialogUPP) NewComponentFunctionUPP((ProcPtr)userRoutine, uppMSerrordialogProcInfo)
#else
	#if GENERATINGCFM
		typedef UniversalProcPtr MSerrordialogUPP;
		
		#define CallMSerrordialogProc(userRoutine, theString)		\
				CallUniversalProc((UniversalProcPtr)(userRoutine), uppMSerrordialogProcInfo, (theString))
		#define NewMSerrordialogProc(userRoutine)		\
				(MSerrordialogUPP) NewRoutineDescriptor((ProcPtr)(userRoutine), uppMSerrordialogProcInfo, GetCurrentISA())
	#else
		typedef tyMSerrordialog MSerrordialogUPP;
		
		#define CallMSerrordialogProc(userRoutine, theString)		\
				(*(userRoutine))((theString))
		#define NewMSerrordialogProc(userRoutine)		\
				(MSerrordialogUPP)(userRoutine)
	#endif
#endif

#if TARGET_API_MAC_CARBON
	typedef UniversalProcPtr MSeventfilterUPP;

 	#define NewMSeventfilterProc(userRoutine)		\
			(MSeventfilterUPP) NewComponentFunctionUPP((ProcPtr)(userRoutine), uppMSeventfilterProcInfo)
#else
	#if GENERATINGCFM
		typedef UniversalProcPtr MSeventfilterUPP;
		
		#define CallMSeventfilterProc(userRoutine, theEvent)		\
				CallUniversalProc((UniversalProcPtr)(userRoutine), uppMSeventfilterProcInfo, (theEvent))
		#define NewMSeventfilterProc(userRoutine)		\
				(MSeventfilterUPP) NewRoutineDescriptor((ProcPtr)(userRoutine), uppMSeventfilterProcInfo, GetCurrentISA())
	#else
		typedef tyMSeventfilter MSeventfilterUPP;
		
		#define CallMSeventfilterProc(userRoutine, theEvent)		\
				(*(userRoutine))((theEvent))
		#define NewMSeventfilterProc(userRoutine)		\
				(MSeventfilterUPP)(userRoutine)
	#endif
#endif
		
#if TARGET_API_MAC_CARBON
	typedef UniversalProcPtr MSmenusinstallerUPP;

	#define NewMSmenusinstallerProc(userRoutine)		\
			(MSmenusinstallerUPP) NewComponentFunctionUPP((ProcPtr)(userRoutine), uppMSmenusinstallerProcInfo)
#else
	#if GENERATINGCFM
		typedef UniversalProcPtr MSmenusinstallerUPP;
		
		#define CallMSmenusinstallerProc(userRoutine, theMenus)		\
				CallUniversalProc((UniversalProcPtr)(userRoutine), uppMSmenusinstallerProcInfo, (theMenus))
		#define NewMSmenusinstallerProc(userRoutine)		\
				(MSmenusinstallerUPP) NewRoutineDescriptor((ProcPtr)(userRoutine), uppMSmenusinstallerProcInfo, GetCurrentISA())
	#else
		typedef tyMSmenusinstaller MSmenusinstallerUPP;
		
		#define CallMSmenusinstallerProc(userRoutine, theMenus)		\
				(*(userRoutine))((theMenus))
		#define NewMSmenusinstallerProc(userRoutine)		\
				(MSmenusinstallerUPP)(userRoutine)
	#endif
#endif

// added by Alco Blom

EventHandlerRef gCarbonSharedMenusHandler = nil;

OSStatus InstallCarbonSharedMenusHandler();
void RemoveCarbonSharedMenusHandler();

pascal OSStatus CarbonSharedMenusHandler(EventHandlerCallRef, EventRef, void*);

// end added by Alco Blom

#ifdef componentMenuSharing

	#define msComponentType 'SHMN'
	#define msComponentSubType 0
	
	#define msInitSharedMenusCommand 0x2001 
	#define msSharedMenuHitCommand 0x2002
	#define msSharedScriptRunningCommand 0x2003
	#define msCancelSharedScriptCommand	0x2004
	#define msCheckSharedMenusCommand 0x2005
	#define msDisposeSharedMenusCommand 0x2007
	#define msIsSharedMenuCommand 0x2008
	#define msEnableSharedMenusCommand 0x2009
	#define msRunSharedMenuItemCommand 0x200A
	#define msSetScriptErrorCallbackCommand 0x200B
	#define msSetEventFilterCallbackCommand 0x200C
	#define msSetMenusInserterCallbackCommand 0x200D
	#define msSetMenusRemoverCallbackCommand 0x200E
	#define msDirtySharedMenusCommand 0x200F
	
	#define glue static pascal ComponentResult

	
	#if 1
	
		enum {
			uppCallComponentProcInfo = kPascalStackBased
					| RESULT_SIZE(kFourByteCode)
					| STACK_ROUTINE_PARAMETER(1, kFourByteCode)
		};
		
		#pragma options align=mac68k
		
		glue initsharedmenusGlue (ComponentInstance comp) {
		
			#define initsharedmenusParamSize	 (0L)
			
			struct initsharedmenusGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				ComponentInstance	comp;
			};
			
			struct initsharedmenusGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = initsharedmenusParamSize;
			pb.componentWhat = msInitSharedMenusCommand;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*initsharedmenusGlue*/
			
		
		glue sharedmenuhitGlue (ComponentInstance comp, short idmenu, short iditem, Boolean *flshareditem) {
		
			#define sharedmenuhitParamSize	 (sizeof (idmenu) + sizeof (iditem) + sizeof (flshareditem))
			
			struct sharedmenuhitGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				Boolean *flshareditem;
				short iditem;
				short idmenu;
				ComponentInstance	comp;
			};
			
			struct sharedmenuhitGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = sharedmenuhitParamSize;
			pb.componentWhat = msSharedMenuHitCommand;
			pb.flshareditem = flshareditem;
			pb.iditem = iditem;
			pb.idmenu = idmenu;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*sharedmenuhitGlue*/
			
		
		glue sharedscriptrunningGlue (ComponentInstance comp, Boolean *flrunning) {
		
			#define sharedscriptrunningParamSize	 (sizeof (flrunning))
			
			struct sharedscriptrunningGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				Boolean *flrunning;
				ComponentInstance	comp;
			};
			
			struct sharedscriptrunningGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = sharedscriptrunningParamSize;
			pb.componentWhat = msSharedScriptRunningCommand;
			pb.flrunning = flrunning;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*sharedscriptrunningGlue*/
			
		
		glue cancelsharedscriptGlue (ComponentInstance comp) {
		
			#define cancelsharedscriptParamSize	 (0L)
			
			struct cancelsharedscriptGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				ComponentInstance	comp;
			};
			
			struct cancelsharedscriptGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = cancelsharedscriptParamSize;
			pb.componentWhat = msCancelSharedScriptCommand;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*cancelsharedscriptGlue*/
			
		
		glue checksharedmenusGlue (ComponentInstance comp, short idinsertafter) {
		
			#define checksharedmenusParamSize	 (sizeof (idinsertafter))
			
			struct checksharedmenusGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				short idinsertafter;
				ComponentInstance	comp;
			};
			
			struct checksharedmenusGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = checksharedmenusParamSize;
			pb.componentWhat = msCheckSharedMenusCommand;
			pb.idinsertafter = idinsertafter;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*checksharedmenusGlue*/
			
		
		glue disposesharedmenusGlue (ComponentInstance comp) {
		
			#define disposesharedmenusParamSize	 (0L)
			
			struct disposesharedmenusGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				ComponentInstance	comp;
			};
			
			struct disposesharedmenusGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = disposesharedmenusParamSize;
			pb.componentWhat = msDisposeSharedMenusCommand;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*disposesharedmenusGlue*/
			
		
		glue issharedmenuGlue (ComponentInstance comp, short idmenu, Boolean *flsharedmenu) {
		
			#define issharedmenuParamSize	 (sizeof (idmenu) + sizeof (flsharedmenu))
			
			struct issharedmenuGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				Boolean *flsharedmenu;
				short idmenu;
				ComponentInstance	comp;
			};
			
			struct issharedmenuGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = issharedmenuParamSize;
			pb.componentWhat = msIsSharedMenuCommand;
			pb.flsharedmenu = flsharedmenu;
			pb.idmenu = idmenu;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*issharedmenuGlue*/
			
		
		glue enablesharedmenusGlue (ComponentInstance comp, Boolean flenable) {
		
			#define enablesharedmenusParamSize	 (sizeof (short))
			
			struct enablesharedmenusGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				Boolean flenable;
				ComponentInstance	comp;
			};
			
			struct enablesharedmenusGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = enablesharedmenusParamSize;
			pb.componentWhat = msEnableSharedMenusCommand;
			pb.flenable = flenable;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*enablesharedmenusGlue*/
			
		
		glue runsharedmenuitemGlue (ComponentInstance comp, short idmenu, short iditem) {
		
			#define runsharedmenuitemParamSize	 (sizeof (idmenu) + sizeof (iditem))
			
			struct runsharedmenuitemGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				short iditem;
				short idmenu;
				ComponentInstance	comp;
			};
			
			struct runsharedmenuitemGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = runsharedmenuitemParamSize;
			pb.componentWhat = msRunSharedMenuItemCommand;
			pb.iditem = iditem;
			pb.idmenu = idmenu;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*runsharedmenuitemGlue*/
			
		
		glue setscripterrorcallbackGlue (ComponentInstance comp, MSerrordialogUPP scripterrorproc) {
		
			#define setscripterrorcallbackParamSize	 (sizeof (scripterrorproc))
			
			struct setscripterrorcallbackGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				MSerrordialogUPP scripterrorproc;
				ComponentInstance	comp;
			};
			
			struct setscripterrorcallbackGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = setscripterrorcallbackParamSize;
			pb.componentWhat = msSetScriptErrorCallbackCommand;
			pb.scripterrorproc = scripterrorproc;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*setscripterrorcallbackGlue*/
		
		
		glue seteventfiltercallbackGlue (ComponentInstance comp, MSeventfilterUPP eventfilterproc) {
		
			#define seteventfiltercallbackParamSize	 (sizeof (eventfilterproc))
			
			struct seteventfiltercallbackGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				MSeventfilterUPP eventfilterproc;
				ComponentInstance	comp;
			};
			
			struct seteventfiltercallbackGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = seteventfiltercallbackParamSize;
			pb.componentWhat = msSetEventFilterCallbackCommand;
			pb.eventfilterproc = eventfilterproc;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*seteventfiltercallbackGlue*/
			
		glue setmenusinsertercallbackGlue (ComponentInstance comp, MSmenusinstallerUPP menusinserterproc) {
		
			#define setmenusinsertercallbackParamSize	 (sizeof (menusinserterproc))
			
			struct setmenusinsertercallbackGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				MSmenusinstallerUPP menusinserterproc;
				ComponentInstance	comp;
			};
			
			struct setmenusinsertercallbackGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = setmenusinsertercallbackParamSize;
			pb.componentWhat = msSetMenusInserterCallbackCommand;
			pb.menusinserterproc = menusinserterproc;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*setmenusinsertercallbackGlue*/
			
		glue setmenusremovercallbackGlue (ComponentInstance comp, MSmenusinstallerUPP menusremoverproc) {
		
			#define setmenusremovercallbackParamSize	 (sizeof (menusremoverproc))
			
			struct setmenusremovercallbackGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				MSmenusinstallerUPP menusremoverproc;
				ComponentInstance	comp;
			};
			
			struct setmenusremovercallbackGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = setmenusremovercallbackParamSize;
			pb.componentWhat = msSetMenusRemoverCallbackCommand;
			pb.menusremoverproc = menusremoverproc;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*setmenusremovercallbackGlue*/
			
		glue dirtysharedmenusGlue (ComponentInstance comp) {
		
			#define dirtysharedmenusParamSize	 (0L)
			
			struct dirtysharedmenusGluePB {
				unsigned char	componentFlags;
				unsigned char	componentParamSize;
				short componentWhat;
				ComponentInstance	comp;
			};
			
			struct dirtysharedmenusGluePB pb;
			
			pb.componentFlags = 0;
			pb.componentParamSize = dirtysharedmenusParamSize;
			pb.componentWhat = msDirtySharedMenusCommand;
			pb.comp = comp;
			
		#if TARGET_API_MAC_CARBON
			return CallComponentDispatch ((ComponentParameters*) &pb);
		#else
			return CallUniversalProc(CallComponentUPP, uppCallComponentProcInfo, &pb);
		#endif
			} 	/*dirtysharedmenusGlue*/
			
		
		#pragma options align=reset
	
	#else
		
		glue initsharedmenusGlue (ComponentInstance) /*3.0*/
			
			ComponentCallNow (msInitSharedMenusCommand, 0L); 
			/*initsharedmenusGlue*/
			
		
		glue sharedmenuhitGlue (ComponentInstance, short, short, Boolean *) /*3.0*/
			
			ComponentCallNow (msSharedMenuHitCommand, sizeof (short) + sizeof (short) + sizeof (Boolean *)); 
			/*sharedmenuhitGlue*/
			
		
		glue sharedscriptrunningGlue (ComponentInstance, Boolean *) /*3.0*/
			
			ComponentCallNow (msSharedScriptRunningCommand, sizeof (Boolean *));
			/*sharedscriptrunningGlue*/
			
		
		glue cancelsharedscriptGlue (ComponentInstance) /*3.0*/
			
			ComponentCallNow (msCancelSharedScriptCommand, 0L); 
			/*cancelsharedscriptGlue*/
			
		
		glue checksharedmenusGlue (ComponentInstance, short) /*3.0*/
			
			ComponentCallNow (msCheckSharedMenusCommand, sizeof (short)); 
			/*checksharedmenusGlue*/
			
		
		glue disposesharedmenusGlue (ComponentInstance) /*3.0*/
			
			ComponentCallNow (msDisposeSharedMenusCommand, 0L); 
			/*disposesharedmenusGlue*/
			
		
		glue issharedmenuGlue (ComponentInstance, short, Boolean *) /*3.0*/
			
			ComponentCallNow (msIsSharedMenuCommand, sizeof (short) + sizeof (Boolean *)); 
			/*issharedmenuGlue*/
			
		
		glue enablesharedmenusGlue (ComponentInstance, Boolean) /*3.0*/
			
			ComponentCallNow (msEnableSharedMenusCommand, sizeof (short)); 
			/*enablesharedmenusGlue*/
			
		
		glue runsharedmenuitemGlue (ComponentInstance, short, short) /*3.0*/
			
			ComponentCallNow (msRunSharedMenuItemCommand, sizeof (short) + sizeof (short)); 
			/*runsharedmenuitemGlue*/
			
		
		glue setscripterrorcallbackGlue (ComponentInstance, MSerrordialogUPP) /*3.0*/
			
			ComponentCallNow (msSetScriptErrorCallbackCommand, sizeof (MSerrordialogUPP)); 
			/*setscripterrorcallbackGlue*/
		
		
		glue seteventfiltercallbackGlue (ComponentInstance, MSeventfilterUPP) /*3.0*/
			
			ComponentCallNow (msSetEventFilterCallbackCommand, sizeof (MSeventfilterUPP)); 
			/*seteventfiltercallbackGlue*/
	
		glue setmenusinsertercallbackGlue (ComponentInstance, MSmenusinstallerUPP) /*3.0*/
			
			ComponentCallNow (msSetMenusInserterCallbackCommand, sizeof (MSmenusinstallerUPP)); 
			/*setmenusinsertercallbackGlue*/
	
		glue setmenusremovercallbackGlue (ComponentInstance, MSmenusinstallerUPP) /*3.0*/
			
			ComponentCallNow (msSetMenusRemoverCallbackCommand, sizeof (MSmenusinstallerUPP)); 
			/*setmenusremovercallbackGlue*/
	
		glue dirtysharedmenusGlue (ComponentInstance) /*3.0*/
			
			ComponentCallNow (msDirtySharedMenusCommand, 0L); 
			/*dirtysharedmenusGlue*/
			
		
	#endif
	
	
	static Boolean InstallEventHandlers (void); /*forward*/
	
	static Boolean RemoveEventHandlers (void); /*forward*/

	static Boolean HaveComponentManager (void) { /*3.0*/
		
		static Boolean initialized = false;
		static Boolean haveit;
		long result;
		
		if (!initialized) {
			
			initialized = true;
			
			if (Gestalt (gestaltComponentMgr, &result) != noErr)
				haveit = false;
			else
				haveit = result != 0;
			}
			
		return (haveit);
		} /*HaveComponentManager*/
	
	
	static pascal void InsertMenusCallback (hdlmenuarray hsharedmenus) {
		
		/*
		layer to be called by the menusharing server component only
		
		we leave our global set to a copy of the menu array so that we 
		can clean up if the server crashes
		*/
		
		hdlmenuarray hm = hsharedmenus;
		
		if (MSglobals.hsharedmenus != nil)
			DisposeHandle ((Handle) MSglobals.hsharedmenus);
		
		MSglobals.hsharedmenus = hm;
		
		(*MSglobals.menusinsertercallback) (hm);
		
		HandToHand ((Handle *) &MSglobals.hsharedmenus);
		} /*InsertMenusCallback*/


	static pascal void RemoveMenusCallback (hdlmenuarray hsharedmenus) {
		
		/*
		layer to be called by the menusharing server component only
		
		we leave our global set to nil when we're done
		*/
		
		hdlmenuarray hm = hsharedmenus;
		
		if (MSglobals.hsharedmenus != nil)
			DisposeHandle ((Handle) MSglobals.hsharedmenus);
		
		MSglobals.hsharedmenus = hm;
		
		(*MSglobals.menusremovercallback) (hm);
		
		MSglobals.hsharedmenus = nil;
		} /*RemoveMenusCallback*/


#if TARGET_API_MAC_CARBON
	#define InsertMenusCallbackDesc		\
			NewComponentFunctionUPP((ProcPtr)InsertMenusCallback, uppMSmenusinstallerProcInfo)

	#define RemoveMenusCallbackDesc	\
			NewComponentFunctionUPP((ProcPtr)RemoveMenusCallback, uppMSmenusinstallerProcInfo)

	#define InsertMenusCallbackUPP (InsertMenusCallbackDesc)
	#define RemoveMenusCallbackUPP (RemoveMenusCallbackDesc)
#else
	#if GENERATINGCFM
		static RoutineDescriptor InsertMenusCallbackDesc = BUILD_ROUTINE_DESCRIPTOR (uppMSmenusinstallerProcInfo, InsertMenusCallback);
		static RoutineDescriptor RemoveMenusCallbackDesc = BUILD_ROUTINE_DESCRIPTOR (uppMSmenusinstallerProcInfo, RemoveMenusCallback);

		#define InsertMenusCallbackUPP (&InsertMenusCallbackDesc)
		#define RemoveMenusCallbackUPP (&RemoveMenusCallbackDesc)
	#else
		#define InsertMenusCallbackUPP InsertMenusCallback
		#define RemoveMenusCallbackUPP RemoveMenusCallback
	#endif
#endif

	static void ConnectWithComponent (void) { /*3.0*/
		
		if (!HaveComponentManager ())
			return;
			
		if (MSglobals.menuserver != 0) /*already connected*/
			return;
			
		MSglobals.menuserver = OpenDefaultComponent (msComponentType, msComponentSubType);
		
		if (MSglobals.menuserver == 0) /*didn't connect*/
			return;
		
		MSglobals.serverversion = GetComponentVersion (MSglobals.menuserver);
		
		if (initsharedmenusGlue (MSglobals.menuserver) != noErr) 
			goto error;
		
		if (setscripterrorcallbackGlue (MSglobals.menuserver, NewMSerrordialogProc (MSglobals.scripterrorcallback)) != noErr)
			goto error;
		
		if (seteventfiltercallbackGlue (MSglobals.menuserver, NewMSeventfilterProc (MSglobals.eventfiltercallback)) != noErr)
			goto error;
		
		if (MSglobals.serverversion >= 0x04100000) {
		
			setmenusinsertercallbackGlue (MSglobals.menuserver, InsertMenusCallbackUPP);
			
			setmenusremovercallbackGlue (MSglobals.menuserver, RemoveMenusCallbackUPP);
			
			RemoveEventHandlers ();	/*remove server's defaults*/
			
			InstallEventHandlers (); /*use ours*/
			}
		
		return; /*everything worked*/
		
		error:
						
		CloseComponent (MSglobals.menuserver); /*error initializing menu sharing*/
				
		MSglobals.menuserver = 0;
		} /*ConnectWithComponent*/
	
#endif


static short CountMenuArray (void) {
	
	/*
	return the number of menus in the menu array.
	*/
	
	hdlmenuarray hm = MSglobals.hsharedmenus;
	
	if (hm == nil)
		return (0);
	
	return ((short) (GetHandleSize ((Handle) hm) / sizeof (tysharedmenurecord)));
	} /*CountMenuArray*/


#ifdef frontierMenuSharing


	static OSType GetProcessCreator (void) {
		
		/*
		get the 4-character creator identifier for the application we're running 
		inside of.
		*/
		
		ProcessSerialNumber psn;
		ProcessInfoRec info;
		
		GetCurrentProcess (&psn);
		
		info.processInfoLength = (long) sizeof (info);
		
		info.processName = nil;
		
		info.processAppSpec = nil;
		
		GetProcessInformation (&psn, &info);
		
		return (info.processSignature);
		} /*GetProcessCreator*/
		
	
	static Boolean HaveAppleEventManager (void) {
	
		/*
		return true if Apple Events are available.
		*/
		
		long gestaltAppleEventsPresent;
		
		if (Gestalt (gestaltAppleEventsAttr, &gestaltAppleEventsPresent) != noErr)
			return (false);
		
		return (gestaltAppleEventsPresent != 0);
		} /*HaveAppleEventManager*/


	static Boolean PushLongParam (long val, OSType keyword, AppleEvent *event) { /*3.0*/
	
		OSErr ec;
		
		ec = AEPutParamPtr (
			
			event, (AEKeyword) keyword, typeLongInteger, 
			
			(Ptr) &val, sizeof (long));
		
		return (ec == noErr);
		} /*PushLongParam*/
	
	
	static Boolean PushShortParam (short val, OSType keyword, AppleEvent *event) { /*3.0*/
		
		OSErr ec;
		
		ec = AEPutParamPtr (
			
			event, (AEKeyword) keyword, typeShortInteger, 
			
			(Ptr) &val, sizeof (short));
		
		return (ec == noErr);
		} /*PushShortParam*/
	
	
	static Boolean GetLongParam (AppleEvent *event, OSType keyword, long *val) { /*3.0*/
		
		OSErr ec;
		DescType actualtype;
		Size actualsize;
		
		ec = AEGetParamPtr (
			
			event, (AEKeyword) keyword, typeLongInteger, 
			
			&actualtype, (Ptr) val, sizeof (long), &actualsize);
		
		if (ec != noErr) {
			
			return (false);
			}
		
		return (true);
		} /*GetLongParam*/
		
	
	static Boolean GetBinaryParam (AppleEvent *event, OSType keyword, Handle *hbinary, OSType *binarytype) { /*3.0*/
		
		AEDesc result;
		OSErr ec;
		
		ec = AEGetParamDesc (event, (AEKeyword) keyword, typeWildCard, &result);
		
		if (ec != noErr) {
			
			return (false);
			}
		
		#if TARGET_API_MAC_CARBON
			Size theDataSize = AEGetDescDataSize(&result);
			Ptr srcDataPtr = NewPtrClear(theDataSize);
			
			if (srcDataPtr == nil)
				return false;
				
			ec = AEGetDescData(&result, srcDataPtr, theDataSize);
			
			if (ec != nil)
			{
				DisposePtr(srcDataPtr);
				return false;
			}
			
			BlockMove(srcDataPtr, **hbinary, theDataSize);
			DisposePtr(srcDataPtr);
		#else
			*hbinary = result.dataHandle;
		#endif
		
		*binarytype = result.descriptorType;
		
		return (true);
		} /*GetBinaryParam*/
	
	
	static Boolean SendAppleEvent (AppleEvent *event, AppleEvent *reply, Boolean noreply) { /*3.0*/
	
		OSErr ec;
		long mode;
		
		if (noreply) {
			
			mode = kAENoReply + kAENeverInteract;
		 
			ec = AESend (event, reply, mode, kAEHighPriority, kNoTimeOut, nil, nil);
			}
		else {
			mode = kAEWaitReply + kAECanInteract + kAECanSwitchLayer + kAEDontRecord;
			
			ec = AESend (
				
				event, reply, mode, kAENormalPriority, kNoTimeOut, 
				
				nil /*(ProcPtr) IACwaitroutine*/, nil);
			}
		
		AEDisposeDesc (event);	
		
		return (ec == noErr);
		} /*SendAppleEvent*/
	
	
	static Boolean ServerSupportsFastMessages (void) {
		
		/*
		return true if there's a system event handler registered to support the
		get-menu-array message. Frontier 2.0 installs such a handler, other servers
		(e.g. Frontier 1.0) don't.
		*/
		
		OSErr ec;
		AEEventHandlerUPP handler;
		long refcon;
		
		ec = AEGetEventHandler (MSglobals.serverid, 'gmry', &handler, &refcon, true);
		
		return (ec == noErr);
		} /*ServerSupportsFastMessages*/
	
	
	static Boolean NewAppleEvent (OSType verbtoken, Boolean fast, AppleEvent *event) {
		
		AEAddressDesc adr;
		OSErr errcode;
		
		if (fast && ServerSupportsFastMessages ()) {
			
			ProcessSerialNumber psn;
			
			psn.highLongOfPSN = 0;
			
			psn.lowLongOfPSN = kCurrentProcess;
			
			errcode = AECreateDesc (typeProcessSerialNumber, (Ptr) &psn, sizeof (psn), &adr);
			}
		else {
			errcode = AECreateDesc (typeApplSignature, (Ptr) &MSglobals.serverid, sizeof (MSglobals.serverid), &adr);
			}
		
		errcode = AECreateAppleEvent (
			
			MSglobals.serverid, verbtoken, &adr, kAutoGenerateReturnID, kAnyTransactionID, event);
		
		AEDisposeDesc (&adr);
		
		return (errcode == noErr);
		} /*NewAppleEvent*/


	static Boolean ProcessInForeground () {
		
		/*
		return true if we're running in the foreground, false if we're in the
		background.
		*/
		
		ProcessSerialNumber currentprocess, frontprocess;
		Boolean fl;
		
		GetCurrentProcess (&currentprocess);
		
		GetFrontProcess (&frontprocess);
		
		SameProcess (&currentprocess, &frontprocess, &fl);
		
		return (fl);
		} /*ProcessInForeground*/
		
		
	static Boolean ServerIsRunning (void) {
		
		/*
		return true if the server application is running. 
		*/
		
		ProcessInfoRec info;
		ProcessSerialNumber psn;
		Str255 bsname;
		FSSpec fss;
		
		info.processInfoLength = sizeof (info);
		
		info.processName = bsname; /*place to store process name*/
		
		info.processAppSpec = &fss; /*place to store process filespec*/
		
		psn.highLongOfPSN = kNoProcess;
		
		psn.lowLongOfPSN = kNoProcess;
		
		while (GetNextProcess (&psn) == noErr) {
			
		 	info.processInfoLength = sizeof (ProcessInfoRec);
		 	
			if (GetProcessInformation (&psn, &info) != noErr)
				continue; /*keep going -- ignore error*/
			
			if (info.processSignature == MSglobals.serverid)
				return (true);
			} /*while*/
		
		return (false); /*loop completed, no server*/
		} /*ServerIsRunning*/
	

	static Boolean InstallSharedMenus (void) {
		
		/*
		insert all of the menus in the menuarray into the menu bar.
		
		4.1 dmb: use menusinsertercallback to actually insert the menus
		*/
		
		(*MSglobals.menusinsertercallback) (MSglobals.hsharedmenus);
		
		return (true);
		} /*InstallSharedMenus*/
	
	
	static Boolean GetMenuHandles (void) {
		
		/*
		loop through the menuarray, send an IAC message to the menu server requesting
		that each MenuHandle be sent to us.
		*/
		
		hdlmenuarray hm = MSglobals.hsharedmenus;
		short i, ct;
		AppleEvent event, reply;
		short fl;
		MenuHandle hmenu;
		OSType binarytype;
		
		ct = CountMenuArray ();
		
		for (i = 0; i < ct; i++) {
		
			if (!NewAppleEvent ('gmhd', true, &event))
				return (false);
			
			if (!PushLongParam ((long)MSglobals.clientid, 'menp', &event))
				return (false);
			
			if (!PushShortParam (i, 'idix', &event))
				return (false);
			
			if (!SendAppleEvent (&event, &reply, false))
				return (false);
			
			fl = GetBinaryParam (&reply, keyDirectObject, (Handle *) &hmenu, &binarytype);
			
			AEDisposeDesc (&reply);
			
			if (!fl)
				return (false);
			
			(**hm) [i].hmenu = hmenu;
			} /*for*/
		
		return (true);
		} /*GetMenuHandles*/
	
	
	static Boolean GetSharedMenus (short firstresource) {
		
		/*
		call the menu server to get a menuarray, keyed off of our application id.
		
		firstresource is the starting id to be used for the menus; if there are 
		n menus, their ids will range from firstresource to firstresource + n - 1.
		*/
		
		AppleEvent event, reply;
		short fl;
		OSType binarytype;
		
		if (!NewAppleEvent ('gmry', true, &event))
			return (false);
				
		if (!PushLongParam ((long)MSglobals.clientid, 'menp', &event))
			return (false);
		
		if (!PushShortParam (firstresource, 'res1', &event))
			return (false);
			
		if (!SendAppleEvent (&event, &reply, false))
			return (false);
			
		fl = GetBinaryParam (&reply, keyDirectObject, (Handle *) &MSglobals.hsharedmenus, &binarytype);
		
		AEDisposeDesc (&reply);
		
		if (!fl)
			return (false);
		
		return (GetMenuHandles ());
		} /*GetSharedMenus*/
	

	static pascal OSErr HandleMenuDirty (const AppleEvent *event, AppleEvent *reply, SInt32 refcon) {
		
		/*
		this Apple event handler is called when the application's menu bar has been 
		edited by the script writer in the menu server's menu editor.
		
		we just record the dirty-ness of the menus in a boolean, we'll actually re-
		load the menus when we become the foreground process.
		*/
		
		#pragma unused (event, reply, refcon)
		
		MSglobals.fldirtysharedmenus = true;
		
		#ifdef componentMenuSharing
		
		dirtysharedmenusGlue (MSglobals.menuserver);
		
		#endif
		
		return (noErr);
		} /*HandleMenuDirty*/
	
	
	static pascal OSErr HandleScriptComplete (const AppleEvent *event, AppleEvent *reply, SInt32 refcon) {
		
		/*
		this Apple event handler is called when a menu script has completed running.
		
		we update a couple of menu-sharing globals and re-enable the shared menus.
		
		10/8/91 DW: added callback to support Applet Toolkit.
		
		11/2/93 DW: replaced call to scriptcompletedcallback with a call to 
		scripterrorcallback if there was an error in the script.
		*/
		
		#pragma unused (reply, refcon)
	
		MSglobals.flscriptcancelled = MSglobals.flscriptrunning = false;
		
		EnableSharedMenus (true);
		
		if (MSglobals.scripterrorcallback != nil) {
			
			Str255 errormessage;
			AEDesc result;
			OSErr ec;
			long lentext;
			
			ec = AEGetParamDesc (event, 'errs', typeChar, &result);
		
			if (ec != noErr) /*no error to report*/
				return (noErr);
			
			if (result.dataHandle == nil)
				goto exit;

			#if TARGET_API_MAC_CARBON
				lentext = AEGetDescDataSize(&result);
			#else
				lentext = GetHandleSize (result.dataHandle);
			#endif
		
			if (lentext > 255)
				lentext = 255;
				
			if (lentext == 0) /*no error to report*/
				goto exit;
			
			errormessage [0] = (unsigned char) lentext;

			#if TARGET_API_MAC_CARBON
				Ptr srcDataPtr = NewPtrClear(lentext);
				
				if (srcDataPtr == nil)
					return (ec = memFullErr);
				
				ec = AEGetDescData(&result, srcDataPtr, lentext);
				
				if (ec != noErr)
					return ec;
					
				BlockMove (srcDataPtr, &errormessage[1], lentext);
			#else
				BlockMove (*result.dataHandle, &errormessage [1], lentext);
			#endif
			
			#if !TARGET_API_MAC_CARBON
				Debugger();
				CallMSerrordialogProc (MSglobals.scripterrorcallback, errormessage);
			#endif
			
			exit:
			
			AEDisposeDesc (&result);
			}
		
		return (noErr);
		} /*HandleScriptComplete*/
	
	
#endif
		

static pascal void InsertSharedMenus (hdlmenuarray hsharedmenus) {
	
	/*
	insert all of the menus in the menuarray into the menu bar.  main 
	menus are inserted to the right of all others.
	
	if the menus passed in are not the same as our current global, 
	assume that we're being called from a component-based server, and 
	it owns the handle and the menus hanging off of it. dispose our 
	global and set it to a copy of those passed in, so it will still be 
	around if the server crashes and we need to get rid of them.
	*/
	
	hdlmenuarray hm = hsharedmenus;
	short i;
	short ctmenus;
	tysharedmenurecord item;
	
	ctmenus = CountMenuArray ();
	
	for (i = 0; i < ctmenus; i++) {
		
		item = (**hm) [i];
		
		if (item.flhierarchic)
			InsertMenu (item.hmenu, -1);
		else
			InsertMenu (item.hmenu, 0);
		
		(**hm) [i].flinserted = true; /*so we'll know it needs to be removed*/
		} /*for*/
	} /*InsertSharedMenus*/
	
	
static pascal void RemoveSharedMenus (hdlmenuarray hsharedmenus) {
	
	/*
	remove the shared menus from the menubar, reversing the action of InsertSharedMenus.
	
	Unless, for some strange reason, we installed a menuinserter callback that 
	didn't set MSglobals.hsharedmenus, we can safely ignore the menus parameter.
	
	note that we carefully avoid disposing anything, a requirement for working 
	with component menusharing. But we must clear the hsharedmenus global to 
	maintain a consistent state.
	*/
	
	hdlmenuarray hm = hsharedmenus;
	short i;
	short ctmenus;
	tysharedmenurecord item;
	
	ctmenus = CountMenuArray ();
	
	for (i = 0; i < ctmenus; i++) {
		
		item = (**hm) [i];
		
		if (item.flinserted)
			DeleteMenu (item.idmenu);
		} /*for*/	
	} /*RemoveSharedMenus*/


pascal Boolean DisposeSharedMenus (void) {
	
	/*
	completely dispose of the menuarray and the menu handles it contains.
	
	10/10/91 DW: check for no shared menus before disposing, save code if 
	its ever called from more than one place. also set the global handle to
	nil after disposing and redraw the menu bar.
	
	4.1 dmb: use menusremovercallback to actually remove the menus
	*/
	
	hdlmenuarray hm = MSglobals.hsharedmenus;
	short i;
	short ctmenus;
	tysharedmenurecord item;
	
	#ifdef componentMenuSharing
	
		if (MSglobals.menuserver != 0) /*3.0*/
			return (disposesharedmenusGlue (MSglobals.menuserver) == noErr);
		
	#endif
	
	#ifdef frontierMenuSharing
	
		MSglobals.fldirtysharedmenus = true; /*4.1 dmb: for clients with dynamic menubars*/
		
		if (hm == nil) /*no shared menus to toss*/
			return (true);
		
		(*MSglobals.menusremovercallback) (hm);
		
		ctmenus = CountMenuArray ();
		
		for (i = 0; i < ctmenus; i++) {
			
			item = (**hm) [i];
			
			DisposeMenu (item.hmenu);
			} /*for*/
		
		DisposeHandle ((Handle) hm);
		
		MSglobals.hsharedmenus = nil;
		
		DrawMenuBar ();
		
		return (true);
	
	#endif

	return (false);   /* JWB 5/4/95 */
	} /*DisposeSharedMenus*/


pascal Boolean IsSharedMenu (short idmenu) {
	
	/*
	return true if the indicated menu is one of the shared menus.
	*/
	
	hdlmenuarray hm = MSglobals.hsharedmenus;
	short ct, i;
	tysharedmenurecord item;
	
	#ifdef componentMenuSharing
	
		/*3.0*/ {
		
			Boolean flshared;
			
			if (MSglobals.menuserver != 0) {
				
				if (issharedmenuGlue (MSglobals.menuserver, idmenu, &flshared) == noErr)
					return (flshared);
					
				return (false);
				}
			}
	#endif
	
	#ifdef frontierMenuSharing
	
		ct = CountMenuArray ();
		
		for (i = 0; i < ct; i++) {
			
			item = (**hm) [i];
			
			if (item.idmenu == idmenu)
				return (true);
			} /*for*/
			
		return (false);
		
	#endif
	
	return (false);  /* JWB 5/4/95 */
	} /*IsSharedMenu*/


pascal Boolean EnableSharedMenus (Boolean flenable) {
	
	/*
	Enables or disables the the menus in the specified menu array.
	
	Always returns true.
	*/
	
	hdlmenuarray hm = MSglobals.hsharedmenus;
	short i;
	short ctmenus;
	MenuHandle hmenu;
	
	#ifdef componentMenuSharing
	
		if (MSglobals.menuserver != 0) /*3.0*/
			return (enablesharedmenusGlue (MSglobals.menuserver, flenable) == noErr);
	
	#endif
	
	#ifdef frontierMenuSharing
		
		ctmenus = CountMenuArray ();
		
		for (i = 0; i < ctmenus; i++)
		{
			
			hmenu = (**hm) [i].hmenu;
			
			if (flenable)
			{
				#if TARGET_API_MAC_CARBON
					EnableMenuItem (hmenu, 0);
				#else
					EnableItem (hmenu, 0);
				#endif
			}
			else
			{
				#if TARGET_API_MAC_CARBON
					DisableMenuItem (hmenu, 0);
				#else
					DisableItem (hmenu, 0);
				#endif
			}
		}
		
		DrawMenuBar ();
		
		return (true);
		
	#endif
	
	return (false); /* JWB 5/4/95 */
	} /*EnableSharedMenus*/


pascal Boolean RunSharedMenuItem (short idmenu, short iditem) {
	 
	/*
	call the menu server to run the script linked to the indicated menu item.
	
	the script will execute asynchonously, after this call returns.
	
	SDK 2.0: if the server isn't running, remove the shared menus and return
	false. this will only happen if the server has crashed without letting us
	know that our menus are dirty.
	*/
	
	AppleEvent event, reply;
	Boolean fl;
	
	if (!MSglobals.flinitialized) /*3.0*/
		return (false);
	
	#ifdef componentMenuSharing
	
		if (MSglobals.menuserver != 0) /*3.0*/
			return (runsharedmenuitemGlue (MSglobals.menuserver, idmenu, iditem) == noErr);
			
	#endif
	
	#ifdef frontierMenuSharing
	
		if (!ServerIsRunning ()) {
			
			MSglobals.fldirtysharedmenus = true;
			
			return (false);
			}
		
		if (!NewAppleEvent ('runm', false, &event))
			return (false);
		
		if (!PushLongParam ((long)MSglobals.clientid, 'menp', &event))
			return (false);
		
		if (!PushShortParam (idmenu, 'mid ', &event))
			return (false);
		
		if (!PushShortParam (iditem, 'mitm', &event))
			return (false);
		
		if (!SendAppleEvent (&event, &reply, false))
			return (false);
		
		fl = GetLongParam (&reply, keyDirectObject, &MSglobals.idscript);
		
		AEDisposeDesc (&reply);
		
		return (fl && (MSglobals.idscript != 0));
		
	#endif
	
	return (false);  /* JWB 5/4/95 */
	} /*RunSharedMenuItem*/


pascal Boolean CheckSharedMenus (short idinsertafter) {
	
	/*
	call this from your main event loop after receiving and processing every
	event. if the menus need updating, we send a message to the server asking
	for our shared menus.
	
	if we load menus, they are assigned resource ids starting with idinsertafter.
	this number must be less than 255 to allow for hierarchic menus, and must be
	small enough so that no menu has an id of greater than 255. 
	
	9/28/91 DW: only update menus if we're the front process. this catches the
	delay on re-loading a changed menu structure on the Multifinder switch. No
	extra burden on the script writer editing the menu bar.
	
	11/1/93 DW: add support for component menu sharing. 
	
	11/16/93 dmb: clear MSglobals.menuserver if we get a badComponentInstance error. 
	the next call to CheckSharedMenus will attempt to reconnect.
	
	7/16/96 dmb: if the component menuserver goes bad, remove the event handler that
	it installed on our behalf. it may be orphanced code now if the server crashed.
	*/
	
	#ifdef componentMenuSharing
	
		/*3.0*/ {
		
			ConnectWithComponent (); /*does nothing if already connected*/
			
			if (MSglobals.menuserver != 0) {
				
				if (checksharedmenusGlue (MSglobals.menuserver, idinsertafter) == badComponentInstance) {
						
					if (MSglobals.hsharedmenus != nil) { /*dmb 4.1*/
					
						(*MSglobals.menusremovercallback) (MSglobals.hsharedmenus);
						
						DisposeHandle ((Handle) MSglobals.hsharedmenus);
					
						MSglobals.hsharedmenus = nil;
						
						DrawMenuBar ();
						}
					
					RemoveEventHandlers (); /*dmb 4.1*/
					
					MSglobals.menuserver = 0;
					
					return (false);
					}
				
				return (true);
				}
			}
		
	#endif
	
	#ifdef frontierMenuSharing
	
		if (!ProcessInForeground ()) /*only update menus if we're the front process*/
			return (true);
		
		if (!MSglobals.fldirtysharedmenus) /*no need for an update, return quickly*/
			return (true);
			
		DisposeSharedMenus ();
		
		if (ServerIsRunning ()) {
		
			if (GetSharedMenus (idinsertafter)) {
		
				InstallSharedMenus (); /*install to the right of all other menus*/
				
				DrawMenuBar ();
				}
			
			MSglobals.fldirtysharedmenus = false;
			}
			
		else { /*server not running, menus have been updated (ie there are no shared menus)*/
		
			MSglobals.fldirtysharedmenus = false;
			}
			
		return (true);
	
	#endif
	
	return (false); /* JWB 5/4/95 */
	} /*CheckSharedMenus*/
	
	
pascal Boolean SharedScriptRunning () {
	
	/*
	returns true if a shared script is currently running, false otherwise.
	
	it's provided so that an application can intelligently handle cmd-period
	script termination in its keystroke handling routine.
	*/
	
	return (MSglobals.flscriptrunning);
	} /*SharedScriptRunning*/
	

pascal Boolean CancelSharedScript () {
	
	/*
	call this when the user presses cmd-period or otherwise indicates to you that
	he or she wants the currently running script to be halted. 
		
	8/13/92 DW: if we're talking to post-2.0 Frontier or Runtime 1.0, we send a
	message to the server telling it to kill the script. otherwise we do it the
	old less elegant way, by setting a flag that gets monitored in calls to 
	SharedScriptCancelled.
	*/
	
	#ifdef frontierMenuSharing
	
		AppleEvent event, reply;
	 
		if (!MSglobals.flscriptrunning) /*nothing to do*/
			return (true);
			
		if (!ServerSupportsFastMessages ()) {
			
			MSglobals.flscriptcancelled = true;
			
			return (true);
			}
	  
		if (!NewAppleEvent ('kill', false, &event))
			return (false);
		
		if (!PushLongParam (MSglobals.idscript, '----', &event))
			return (false);
		
		if (!SendAppleEvent (&event, &reply, true))
			return (false);
	
		return (true);
	
	#endif
	} /*CancelSharedScript*/


pascal Boolean SharedMenuHit (short idmenu, short iditem) {

	/*
	returns true if the indicated menu and item indicate a shared menu item.
	
	if not, we return false -- the item is in one of your menus, you should
	process the command as you normally would.
	
	we send an IAC message to the menu server, requesting that the script
	linked into that item be run.
	
	we disable the shared menus, awaiting a 'done' message to re-enable them.
	*/
	
	if (!MSglobals.flinitialized) /*3.0*/
		return (false);
	
	#ifdef componentMenuSharing
	
		/*3.0*/ {
		
			Boolean flshareditem;
		
			if (MSglobals.menuserver != 0) {
				
				if (sharedmenuhitGlue (MSglobals.menuserver, idmenu, iditem, &flshareditem) != noErr)
					return (false);
				
				return (flshareditem); /*client handles if it wasn't a shared item*/
				}
			}
	#endif
	
	#ifdef frontierMenuSharing
	
		if (!IsSharedMenu (idmenu)) /*not a shared menu*/
			return (false);
			
		HiliteMenu (0);
			
		if (RunSharedMenuItem (idmenu, iditem)) {
		
			MSglobals.flscriptrunning = true;
		
			EnableSharedMenus (false);
			}
				
		return (true);
		
	#endif
	
	return (false);  /* covers the case when Frontier is not running, and only Component Menu Sharing
					    is enabled. JWB 5/4/95 */
	} /*SharedMenuHit*/
	

pascal Boolean SharedScriptCancelled (AppleEvent *event, AppleEvent *reply) {
	
	/*
	call this routine in each Apple event message handler that could conceivably 
	be used in a script being run by the menu server. if we return false continue
	processing the message as you normally would. if we return true, that means
	that the script that's running has been cancelled by the user; you should 
	return noErr from your Apple event handler when we return true.
	
	before we return true, we reply to the message on behalf of the message
	handler. we send a specific error code of 6, this should be interpreted by
	the scripting system as "stop running the script, but don't display an
	error dialog.
	
	we admit this mechanism is somewhat klunky, but it proved too difficult to have
	Frontier be ready to respond to a "Cancel Script" Apple event while running
	the script and also giving time slices to agents.
	
	12/16/92 dmb: this minimal version supports the old protocol, but it's not 
	needed for Frontier/Runtime 2.0 and greater.
	
	11/2/93 DW: this klunky method is no longer recommended, but it is still
	supported.
	*/
	
	#pragma unused (event)
	
	#ifdef frontierMenuSharing

		if (MSglobals.flscriptcancelled && MSglobals.flscriptrunning) {
			
			MSglobals.flscriptcancelled = MSglobals.flscriptrunning = false;
			
			PushLongParam (6, keyErrorNumber, reply); /*server watches for this special error code*/
			
			return (true);
			}
			
		return (false); /*script not cancelled, keep processing message*/
	
	#else
	
		#pragma unused (reply)
	
	#endif
	} /*SharedScriptCancelled*/
	

pascal Boolean SetMenusInserterCallback (tyMSmenusinstaller menusinserter) {
	
	MSglobals.menusinsertercallback = menusinserter;
	
	return (true);
	} /*SetMenusInserterCallback*/


pascal Boolean SetMenusRemoverCallback (tyMSmenusinstaller menusremover) {

	MSglobals.menusremovercallback = menusremover;
	
	return (true);
	} /*SetMenusRemoverCallback*/


static Boolean InstallEventHandlers (void) {
	
	if (AEInstallEventHandler (MSglobals.clientid, 'updm', NewAEEventHandlerUPP (HandleMenuDirty), 0, false) != noErr)
		return (false);
	
	#ifdef frontierMenuSharing
	
	if (AEInstallEventHandler (MSglobals.clientid, 'done', NewAEEventHandlerUPP (HandleScriptComplete), 0, false) != noErr)
		return (false);
	
	#endif

	return (true);
	} /*InstallEventHandlers*/


static Boolean RemoveEventHandlers (void) {
	
	if (AERemoveEventHandler (MSglobals.clientid, 'updm', nil, false) != noErr)
		return (false);
	
	#ifdef frontierMenuSharing
	
	if (AERemoveEventHandler (MSglobals.clientid, 'done', nil, false) != noErr)
		return (false);
	
	#endif
	
	return (true);
	} /*RemoveEventHandlers*/


pascal Boolean InitSharedMenus (tyMSerrordialog errordialogcallback, tyMSeventfilter eventfiltercallback) {

	/*
	sets the program up for menu sharing. we initialize the IAC Tools library and
	then initialize the fields of MSglobals. 
	
	we install two Apple event message handlers -- one to catch the "menu needs update" 
	message, and another to handle the "script has completed" message.
	
	11/2/93 DW: Complete rewrite for 3.0.
	*/
	
	MSglobals.flinitialized = false; 
	
	MSglobals.scripterrorcallback = errordialogcallback; 
		
	MSglobals.menusinsertercallback = InsertSharedMenus;
	
	MSglobals.menusremovercallback = RemoveSharedMenus;

	if (!HaveAppleEventManager ())
		return (false);
	
	#ifdef componentMenuSharing
		
		MSglobals.menuserver = 0; 
	
		MSglobals.eventfiltercallback = eventfiltercallback; 
	
		MSglobals.flinitialized = true; 
	
	#endif
	
	MSglobals.serverid = 'LAND'; /*Frontier's creator id, for pre-3.0 protocol only*/

	MSglobals.clientid = GetProcessCreator (); 

	MSglobals.hsharedmenus = nil; /*haven't loaded shared menus yet*/
	
	MSglobals.fldirtysharedmenus = true; /*force update 1st time thru event loop*/

	MSglobals.flscriptcancelled = false; /*script hasn't been cancelled*/

	MSglobals.flscriptrunning = false; /*no menu script running*/
	
	MSglobals.flinitialized = true; 

	if (InstallEventHandlers () == false)
		return (false);
        
        return (true);
	} /*InitSharedMenus*/
	
// added by Alco Blom - alco@url-manager.com 25/09/2002

// for Cocoa apps , we catch the menu items of the Shared Menus by this command handler.
// the Shared Menus Component of URL Manager Pro sets the command ID of ALL menu items to 'SHMN'

// the idea is to check for Shared Menu item commands and, if there isn't any, the event is
// passed on to the Cocoa event queue

static pascal void errordialog (Str255 theText) {/*changed by Alco Blom - this call does not need an ALRT resource*/
    short itemHit;	
    StandardAlert(kAlertStopAlert, theText, "\p", nil, &itemHit);
}/*errordialog*/
	
static pascal void eventfilter (EventRecord *ev) {/*could receive an update, activate, OS, or null event*/
    /*not necessary to implement since update, activate events etc. are handle by Mac OS X and Cocoa*/
    ;
} /*eventfilter*/

pascal Boolean InitSharedMenusSimple() {
    Boolean result;
    
    result = InitSharedMenus(errordialog, nil);
    if (result) {
        ConnectWithComponent();
        if (MSglobals.menuserver == 0) {
            result = false;
            RemoveEventHandlers();
        }
    }
    
    return result;
}

OSStatus InstallCarbonSharedMenusHandler() {
    OSStatus err;
    EventHandlerRef outRef;
    
    EventTypeSpec commandSpec = {kEventClassCommand, kEventCommandProcess};
    
    err = InstallApplicationEventHandler(NewEventHandlerUPP(CarbonSharedMenusHandler), 1, &commandSpec, 0, &outRef);
    if (err == noErr)
        gCarbonSharedMenusHandler = outRef;
        
    return err;
}

void RemoveCarbonSharedMenusHandler() {
    if (gCarbonSharedMenusHandler != nil) {
        RemoveEventHandler(gCarbonSharedMenusHandler);
        gCarbonSharedMenusHandler = nil;
    }
}

pascal OSStatus CarbonSharedMenusHandler(EventHandlerCallRef callRef, EventRef event, void* refCon) {
    OSErr err;
    MenuRef mh;
    HICommand command;
    MenuItemIndex menuItem;
    
    err = GetEventParameter(event, kEventParamDirectObject, typeHICommand, nil, sizeof(HICommand), nil, &command);
    if (err != noErr)
        return eventNotHandledErr;
                
    switch(command.commandID) {
        case 'SHMN':
            mh = command.menu.menuRef;
            menuItem = command.menu.menuItemIndex;
            SharedMenuHit(GetMenuID(mh), menuItem);
            return noErr;
            break;
                
        default:
            return eventNotHandledErr;
            break;
    }	

    return eventNotHandledErr;
}

	