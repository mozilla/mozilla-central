/* 
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is RaptorCanvas.
 *
 * The Initial Developer of the Original Code is Kirk Baker and
 * Ian Wilkinson. Portions created by Kirk Baker and Ian Wilkinson are
 * Copyright (C) 1999 Kirk Baker and Ian Wilkinson. All
 * Rights Reserved.
 *
 * Contributor(s):  Ed Burns <edburns@acm.org>
 *                  Ashutosh Kulkarni <ashuk@eng.sun.com>
 *      Jason Mawdsley <jason@macadamian.com>
 *      Louis-Philippe Gagnon <louisphilippe@macadamian.com>
 */

package org.mozilla.webclient.impl.wrapper_native;

import java.lang.reflect.InvocationTargetException;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.mozilla.util.Log;
import org.mozilla.util.ReturnRunnable;
import org.mozilla.webclient.impl.WrapperFactory;

/**
 *
 * @author edburns
 */
public class CocoaAppKitThreadDelegatingNativeEventThread extends NativeEventThread {
    public static final String LOG = "org.mozilla.webclient.impl.wrapper_native.CocoaAppKitThreadDelegatingNativeEventThread";

    public static final Logger LOGGER = Log.getLogger(LOG);
    
    Thread appKitThread = null;
    
    /** Creates a new instance of CocoaAppKitThreadDelegatingNativeEventThread */
    public CocoaAppKitThreadDelegatingNativeEventThread(String threadName, 
			     WrapperFactory yourFactory) {
        super(threadName, yourFactory);
        instance = this;
    }
    
    public boolean isNativeEventThread() {
        return (Thread.currentThread() == appKitThread);
    }
    
    
    public Object pushBlockingReturnRunnable(ReturnRunnable toInvoke) throws RuntimeException {
	Object result = null;

	if (isNativeEventThread()){
	    toInvoke.setResult(toInvoke.run());
            result = toInvoke.getResult();
            if (result instanceof RuntimeException) {
                throw ((RuntimeException) result);
            }
	    return result;
	}
        final ReturnRunnable finalToInvoke = toInvoke;
        ReturnRunnable appKitToInvoke = new ReturnRunnable() {
          public Object run() {
              if (LOGGER.isLoggable(Level.FINEST)) {
                  LOGGER.finest("On NativeEventThread, blocking, about to call " +
                          finalToInvoke.toString() + " on AppKit Thread.");
              }
              
              Object result = CocoaAppKitThreadDelegatingNativeEventThread.this.
                      runReturnRunnableOnAppKitThread(finalToInvoke);

              if (LOGGER.isLoggable(Level.FINEST)) {
                  LOGGER.finest("On NativeEventThread, blocking, returned from calling  " +
                          finalToInvoke.toString() + " on AppKit Thread.");
              }
              if (finalToInvoke.getResult() instanceof RuntimeException) {
                  throw ((RuntimeException) result);
              }
              return result;
          }  
          public String toString() {
              return finalToInvoke.toString();
          }
        };
        result = super.pushBlockingReturnRunnable(appKitToInvoke);
        return result;
    }   
    
    public void pushRunnable(Runnable toInvoke) {
        final Runnable finalToInvoke = toInvoke;
        Runnable appKitToInvoke = new Runnable() {
            public void run() {
                if (LOGGER.isLoggable(Level.FINEST)) {
                    LOGGER.finest("On NativeEventThread, non-blocking, about to call " +
                            finalToInvoke.toString() + " on AppKit Thread.");
                }
                CocoaAppKitThreadDelegatingNativeEventThread.this.
                        runRunnableOnAppKitThread(finalToInvoke);
                if (LOGGER.isLoggable(Level.FINEST)) {
                    LOGGER.finest("On NativeEventThread, non-blocking, returned from calling " +
                            finalToInvoke.toString() + " on AppKit Thread.");
                }
            }
            public String toString() {
                return finalToInvoke.toString();
            }
        };
        super.pushRunnable(appKitToInvoke);
    }
    
    private Object doRunReturnRunnableOnAppKitThread(ReturnRunnable toInvoke) {
        assert(-1 != Thread.currentThread().getName().indexOf("AppKit"));
        if (null == appKitThread) {
            appKitThread = Thread.currentThread();
        }
        if (LOGGER.isLoggable(Level.FINEST)) {
            LOGGER.finest("On AppKitThread, blocking, about to call " +
                    toInvoke.toString() + ".");
        }
        
        Object result = null;
        try {
            result = toInvoke.run();
        } catch (RuntimeException e) {
            if (LOGGER.isLoggable(Level.SEVERE)) {
                LOGGER.log(Level.SEVERE, "Exception while invoking " + 
                        toInvoke.toString() + " on AppKit Thread", e);
            }
            toInvoke.setResult(null != e.getCause() ? e.getCause() : e);
        }

        if (LOGGER.isLoggable(Level.FINEST)) {
            LOGGER.finest("On AppKitThread, returned from calling " +
                    toInvoke.toString() + ".");
        }
        return result;
    }

    private void doRunRunnableOnAppKitThread(Runnable toInvoke) {
        assert(-1 != Thread.currentThread().getName().indexOf("AppKit"));
        if (null == appKitThread) {
            appKitThread = Thread.currentThread();
        }
        if (LOGGER.isLoggable(Level.FINEST)) {
            LOGGER.finest("On AppKitThread, non-blocking, about to call " +
                    toInvoke.toString() + ".");
        }
        
        try {
            toInvoke.run();
        }
        catch (RuntimeException e) {
            if (LOGGER.isLoggable(Level.SEVERE)) {
                LOGGER.log(Level.SEVERE, "Exception while invoking " + 
                        toInvoke.toString() + " on AppKit Thread", e);
            }
            throw e;
        }

        if (LOGGER.isLoggable(Level.FINEST)) {
            LOGGER.finest("On AppKitThread, non-blocking, returned from calling " +
                    toInvoke.toString() + ".");
        }
    }
    
    private native Object runReturnRunnableOnAppKitThread(ReturnRunnable toInvoke);
    private native void runRunnableOnAppKitThread(Runnable toInvoke);
    
}
