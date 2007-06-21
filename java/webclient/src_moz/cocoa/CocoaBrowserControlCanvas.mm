/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * The contents of this file are subject to the Netscape Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): edburns <edburns@acm.org>
 */


/*
 * CocoaBrowserControlCanvas.cpp
 */

#include <jawt_md.h>

#include <assert.h>

#import <Cocoa/Cocoa.h>

// #include <MacWindows.h>

#include "CocoaBrowserControlCanvas.h"

#include "nsIWidget.h"
#include "nsWidgetSupport.h"

#include "jni_util.h" //for throwing Exceptions to Java
#include "ns_globals.h"

// #include "nsRect.h"

@interface RunOnAppKitThread : NSObject 

-(void)runReturnRunnableOnAppKitThread:(NSMutableArray *) args;

-(void)doRunReturnRunnableOnAppKitThread:(NSMutableArray *) args;

-(void)runRunnableOnAppKitThread:(NSMutableArray *) args;

-(void)doRunRunnableOnAppKitThread:(NSMutableArray *) args;

@end

@implementation RunOnAppKitThread

-(void)runReturnRunnableOnAppKitThread:(NSMutableArray *)args {

    [self performSelectorOnMainThread: @selector(doRunReturnRunnableOnAppKitThread:)
	  withObject: args
	  waitUntilDone: YES];
}

-(void)doRunReturnRunnableOnAppKitThread:(NSMutableArray *) args {
    JNIEnv *env = (JNIEnv *) JNU_GetEnv(gVm, JNI_VERSION);
    jobject 
	javaThis = (jobject) [[args objectAtIndex:0] pointerValue],
	toInvoke = (jobject) [[args objectAtIndex:1] pointerValue],
	result = nsnull;
    NSValue *nsValue = nsnull;
    jclass clazz = env->GetObjectClass(javaThis);
    jmethodID mid = env->GetMethodID(clazz, "doRunReturnRunnableOnAppKitThread", 
                                     "(Lorg/mozilla/util/ReturnRunnable;)Ljava/lang/Object;");
    env->ExceptionClear();
    result = env->CallObjectMethod(javaThis, mid, toInvoke);
    if (env->ExceptionOccurred()) {
        ::util_ThrowExceptionToJava(env, "Cannot call back into Java from Objective-C doRunReturnRunnableOnAppKitThread");
    }
    nsValue = [NSValue value:&result withObjCType:@encode(jobject)];
    [args addObject: nsValue];

    return;
}

-(void)runRunnableOnAppKitThread:(NSMutableArray *)args {

    [self performSelectorOnMainThread: @selector(doRunRunnableOnAppKitThread:)
	  withObject: args
	  waitUntilDone: YES];
}

-(void)doRunRunnableOnAppKitThread:(NSMutableArray *) args {
    JNIEnv *env = (JNIEnv *) JNU_GetEnv(gVm, JNI_VERSION);
    jobject 
        javaThis = (jobject) [[args objectAtIndex:0] pointerValue],
        toInvoke = (jobject) [[args objectAtIndex:1] pointerValue],
        result = nsnull;
    NSValue *nsValue = nsnull;
    jclass clazz = env->GetObjectClass(javaThis);
    jmethodID mid = env->GetMethodID(clazz, "doRunRunnableOnAppKitThread", 
                                     "(Ljava/lang/Runnable;)Ljava/lang/Object;");
    env->ExceptionClear();
    result = env->CallObjectMethod(javaThis, mid, toInvoke);
    if (env->ExceptionOccurred()) {
        ::util_ThrowExceptionToJava(env, "Cannot call back into Java from Objective-C doRunRunnableOnAppKitThread");
    }
    nsValue = [NSValue value:&result withObjCType:@encode(jobject)];
    [args addObject: nsValue];

    return;
}

@end

jint CocoaBrowserControlCanvas::cocoaGetHandleToPeer(JNIEnv *env, jobject canvas) 
{
    JAWT awt;
    JAWT_DrawingSurface* ds = NULL;
    JAWT_DrawingSurfaceInfo* dsi = NULL;
    JAWT_MacOSXDrawingSurfaceInfo* dsi_mac = NULL;
    jboolean result = JNI_FALSE;
    jint lock = 0;
    NSView *view = NULL;
    
    // get the AWT
    awt.version = JAWT_VERSION_1_4;

    result = JAWT_GetAWT(env, &awt);

    if (JNI_FALSE == result) {
        util_ThrowExceptionToJava(env, "CocoaBrowserControlCanvas: can't get JAWT");
    }


    // Get the drawing surface.  This can be safely cached.
    // Anything below the DS (DSI, contexts, etc) 
    // can possibly change/go away and should not be cached.
    ds = awt.GetDrawingSurface(env, canvas);

    if (NULL == ds) {
        util_ThrowExceptionToJava(env, "CocoaBrowserControlCanvas: can't get drawing surface");
    }
    
    // Lock the drawing surface
    // You must lock EACH TIME before drawing
    lock = ds->Lock(ds); 
    
    if ((lock & JAWT_LOCK_ERROR) != 0) {
        util_ThrowExceptionToJava(env, "CocoaBrowserControlCanvas: can't lock drawing surface");
    }
    
    // Get the drawing surface info
    dsi = ds->GetDrawingSurfaceInfo(ds);
    
    // Check DrawingSurfaceInfo.  This can be NULL on Mac OS X
    // if the windowing system is not ready
    if (dsi != NULL) {

        // Get the platform-specific drawing info
        // We will use this to get at Cocoa and CoreGraphics
        // See <JavaVM/jawt_md.h>

        dsi_mac = (JAWT_MacOSXDrawingSurfaceInfo*)dsi->platformInfo;
        if (NULL == dsi_mac) {
            util_ThrowExceptionToJava(env, "CocoaBrowserControlCanvas: can't get mac DrawingSurfaceInfo");
        }
        
        // Get the corresponding peer from the caller canvas
        view = dsi_mac->cocoaViewRef;

        // Free the DrawingSurfaceInfo
        ds->FreeDrawingSurfaceInfo(dsi);
    }
    else {
        PR_LOG(prLogModuleInfo, PR_LOG_DEBUG, 
               ("CocoaBrowserControlCanvas::cocoaGetHandleToPeer: can't get drawing surface info"));
        
    }
  
    // Unlock the drawing surface
    // You must unlock EACH TIME when done drawing
    ds->Unlock(ds); 
    
    // Free the drawing surface (if not caching it)
    awt.FreeDrawingSurface(ds);

    return (jint) view;
}

jobject CocoaBrowserControlCanvas::runReturnRunnableOnAppKitThread(JNIEnv *env, jobject javaThis, jobject toInvoke)
{
    PR_ASSERT(javaThis);
    PR_ASSERT(toInvoke);

    jobject result = 0;
    NSAutoreleasePool * pool = [[NSAutoreleasePool alloc] init];

    RunOnAppKitThread *appKitThreadRunner = [[RunOnAppKitThread alloc] init];
    NSMutableArray *args = [NSMutableArray arrayWithCapacity: 10];
    NSValue 
	*inArg0 = [NSValue value:&javaThis withObjCType:@encode(jobject)],
	*inArg1 = [NSValue value:&toInvoke withObjCType:@encode(jobject)],
	*outArg0;
    [args addObject: inArg0];
    [args addObject: inArg1];
    @try {
        [appKitThreadRunner runReturnRunnableOnAppKitThread: args];
        outArg0 = [args objectAtIndex:2];
        if (outArg0) {
            result = (jobject) [outArg0 pointerValue];
        }
    }
    @catch (NSException *e) {
        NSString *reason = [e reason];
        const char *cStringReason = [reason cStringUsingEncoding: 
                                     NSUTF8StringEncoding];
        JNIEnv *env = (JNIEnv *) JNU_GetEnv(gVm, JNI_VERSION);
        ::util_ThrowExceptionToJava(env, cStringReason);
    }

    [pool release];
    return result;
}

jobject CocoaBrowserControlCanvas::runRunnableOnAppKitThread(JNIEnv *env, jobject javaThis, jobject toInvoke)
{
    PR_ASSERT(javaThis);
    PR_ASSERT(toInvoke);

    jobject result = 0;
    NSAutoreleasePool * pool = [[NSAutoreleasePool alloc] init];

    RunOnAppKitThread *appKitThreadRunner = [[RunOnAppKitThread alloc] init];
    NSMutableArray *args = [NSMutableArray arrayWithCapacity: 10];
    NSValue 
        *inArg0 = [NSValue value:&javaThis withObjCType:@encode(jobject)],
        *inArg1 = [NSValue value:&toInvoke withObjCType:@encode(jobject)],
        *outArg0;
    [args addObject: inArg0];
    [args addObject: inArg1];
    @try {
        [appKitThreadRunner runRunnableOnAppKitThread: args];
        outArg0 = [args objectAtIndex:2];
        if (outArg0) {
            result = (jobject) [outArg0 pointerValue];
        }
    }
    @catch (NSException *e) {
        NSString *reason = [e reason];
        const char *cStringReason = [reason cStringUsingEncoding: 
                                     NSUTF8StringEncoding];
        PR_LOG(prLogModuleInfo, PR_LOG_DEBUG, 
               ("CocoaBrowserControlCanvas::runRunnableOnAppKitThread: Native Cocoa Exception occurred: %s", cStringReason));
        JNIEnv *env = (JNIEnv *) JNU_GetEnv(gVm, JNI_VERSION);
        ::util_ThrowExceptionToJava(env, cStringReason);
    }

    [pool release];
    return result;
}

