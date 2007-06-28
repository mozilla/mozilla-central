/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
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
 * Contributor(s): Ed Burns <edburns@acm.org>
 */


package org.mozilla.webclient.impl.wrapper_native;

import java.awt.BorderLayout;
import java.awt.Frame;
import java.awt.Rectangle;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.mozilla.util.Assert;
import org.mozilla.util.Log;
import org.mozilla.webclient.BrowserControl;
import org.mozilla.webclient.BrowserControlCanvas;
import org.mozilla.webclient.NewWindowEvent;
import org.mozilla.webclient.WindowControl;
import org.mozilla.webclient.impl.BrowserControlImpl;
import org.mozilla.webclient.impl.WrapperFactory;

/**
 *
 * @author edburns
 */
abstract class NativeBrowserControlCanvas extends BrowserControlCanvas {
    
    public static final String LOG = "org.mozilla.webclient.impl.wrapper_native.NativeBrowserControlCanvas";

    public static final Logger LOGGER = Log.getLogger(LOG);
    
    protected int nativeWindow = 0;


    /** Creates a new instance of NativeBrowserControlCanvas */
    public NativeBrowserControlCanvas() {
    }

    public void addNotify() {
        super.addNotify();

        if (0 == nativeWindow) {
            synchronized (getTreeLock()) {
                //Create the Native window and it's container and
                //get a handle to this widget
                nativeWindow = getWindow();
            }
        }
        else {
            return;
        }
        
        try {
            synchronized (getTreeLock()) {
                createNativeBrowser();
                initializeOK = true;
            }
        } catch (IllegalStateException ise) {
            if (LOGGER.isLoggable(Level.SEVERE)) {
                LOGGER.log(Level.SEVERE,
                           "Exception while creating native browser",ise);
            }
            throw ise;
        }
        
    }
    
    /**
     * Create the Native window and get it's handle
     */

    abstract protected int getWindow();

    /**
     * Allow platform specific handling of new window creation.
     *
     */
    
    abstract void performPlatformAppropriateNewWindowRealization(NewWindowEvent event);

    private void createNativeBrowser() throws IllegalStateException {
        try {
            Rectangle r = new Rectangle(getBoundsRelativeToWindow());
            Assert.assert_it(null != webShell);

            WindowControl wc = (WindowControl)
            webShell.queryInterface(BrowserControl.WINDOW_CONTROL_NAME);
            //This createWindow call sets in motion the creation of the
            //nativeInitContext and the creation of the Mozilla embedded
            //webBrowser
            wc.createWindow(nativeWindow, r);
        } catch (IllegalStateException ise) {
            if (LOGGER.isLoggable(Level.SEVERE)) {
                LOGGER.log(Level.SEVERE,
                        "Exception while creating native browser",ise);
            }
            throw ise;
        } catch (Exception e) {
            if (LOGGER.isLoggable(Level.SEVERE)) {
                LOGGER.log(Level.SEVERE,
                        "Exception while creating native browser",e);
            }
            throw new IllegalStateException(null != e.getCause() ? e.getCause() : e);
        }
        return;
    }
    
}
