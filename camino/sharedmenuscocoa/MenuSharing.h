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

#ifndef __APPLEEVENTS__

	#include <AppleEvents.h>

#endif

#ifndef __COMPONENTS__

	#include <Components.h> /*3.0*/ 

#endif

#ifndef __MENUS__

	#include <Menus.h> /*3.0*/
	
#endif


#define __MENUSHARING__ /*so other modules can tell that we've been included*/

//	RMS 960614
#if !TARGET_API_MAC_CARBON
#if PRAGMA_ALIGN_SUPPORTED
#pragma options align=mac68k
#endif	//PRAGMA_ALIGN_SUPPORTED
#endif	//TARGET_API_MAC_CARBON

typedef struct tysharedmenurecord { /*must match scripting system record structure*/
	
	short idmenu; /*the resource id of the menu*/
	
	short flhierarchic: 1; /*if true it's a hiearchic menu*/
	
	short flinserted: 1; /*if true the menu has been inserted in the menu bar*/
	
	MenuHandle hmenu; /*a handle to the Mac Menu Manager's data structure*/
	} tysharedmenurecord;


typedef tysharedmenurecord tymenuarray [1];

typedef tymenuarray **hdlmenuarray;

typedef pascal void (*tyMSerrordialog) (Str255);

typedef pascal void (*tyMSeventfilter) (EventRecord *);

typedef pascal void (*tyMSmenusinstaller) (hdlmenuarray);



typedef struct tyMSglobals { /*Menu Sharing globals, all in one struct*/

	OSType serverid; /*identifier for shared menu server*/

	OSType clientid; /*id of this application*/
	
	hdlmenuarray hsharedmenus; /*data structure that holds shared menus*/
	
	Boolean fldirtysharedmenus; /*if true, menus are reloaded next time app comes to front*/
	
	Boolean flscriptcancelled; /*set true by calling CancelSharedScript*/
	
	Boolean flscriptrunning; /*true if a script is currently running*/
	
	Boolean flinitialized; /*true if InitSharedMenus was successful*/
	
	long idscript; /*the server's id for the currently running script, makes it easy to kill it*/
	
	ComponentInstance menuserver; /*3.0*/ 
	
	long serverversion; /*4.1*/
	
	tyMSerrordialog scripterrorcallback; /*3.0*/
	
	tyMSeventfilter eventfiltercallback; /*3.0*/
	
	tyMSmenusinstaller menusinsertercallback; /*4.1*/
	
	tyMSmenusinstaller menusremovercallback; /*4.1*/
	} tyMSglobals;


extern tyMSglobals MSglobals; /*menu sharing globals*/


/*basic Menu Sharing routines*/

	pascal Boolean InitSharedMenus (tyMSerrordialog, tyMSeventfilter);

	pascal Boolean SharedMenuHit (short, short);
	
	pascal Boolean SharedScriptRunning (void);
	
	pascal Boolean CancelSharedScript (void);
	
	pascal Boolean CheckSharedMenus (short);
	
	pascal Boolean SharedScriptCancelled (AppleEvent *, AppleEvent *);
	

/*special-purpose routines*/

	pascal Boolean DisposeSharedMenus (void);

	pascal Boolean IsSharedMenu (short);
	
	pascal Boolean EnableSharedMenus (Boolean);
	
	pascal Boolean RunSharedMenuItem (short, short);

	pascal Boolean SetMenusInserterCallback (tyMSmenusinstaller);
	
	pascal Boolean SetMenusRemoverCallback (tyMSmenusinstaller);
	
//	RMS 960614	
#if !TARGET_API_MAC_CARBON
#if PRAGMA_ALIGN_SUPPORTED
#pragma options align=reset
#endif	//PRAGMA_ALIGN_SUPPORTED
#endif	//TARGET_API_MAC_CARBON