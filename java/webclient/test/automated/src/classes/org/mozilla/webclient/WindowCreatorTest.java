/*
 * $Id: WindowCreatorTest.java,v 1.8 2007-07-02 16:25:47 edburns%acm.org Exp $
 */

/* 
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Sun
 * Microsystems, Inc. Portions created by Sun are
 * Copyright (C) 1999 Sun Microsystems, Inc. All
 * Rights Reserved.
 *
 * Contributor(s): Ed Burns &lt;edburns@acm.org&gt;
 */

package org.mozilla.webclient;

import junit.framework.TestSuite;
import junit.framework.Test;
import java.util.BitSet;

import java.awt.Frame;
import java.awt.Robot;
import java.awt.event.InputEvent;
import java.awt.BorderLayout;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.mozilla.mcp.junit.WebclientTestCase;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

// WindowCreatorTest.java

public class WindowCreatorTest extends WebclientTestCase {

    public WindowCreatorTest(String name) {
 	super(name);
	try {
	    BrowserControlFactory.setAppData(getBrowserBinDir());
	}
	catch (Exception e) {
	    fail();
	}
    }

    public static Test suite() {
	TestSuite result = createServerTestSuite();
	result.addTestSuite(WindowCreatorTest.class);
	return (result);
    }

    static EventRegistration2 eventRegistration;

    static boolean keepWaiting;
    
    static BrowserControl secondBrowserControl;
    static Frame secondFrame = null;


    //
    // Constants
    // 

    //
    // Testcases
    // 

    public void testNewWindow() throws Exception {
	BrowserControl firstBrowserControl = null;
        secondFrame = new Frame();
        secondFrame.setBounds(100, 100, 540, 380);

	final DocumentLoadListenerImpl listener = 
	    new DocumentLoadListenerImpl() {
		public void doEndCheck() {
		    WindowCreatorTest.keepWaiting = false;
		}
	    };
	Selection selection = null;
	firstBrowserControl = BrowserControlFactory.newBrowserControl();
	assertNotNull(firstBrowserControl);
	History history = (History) 
	    firstBrowserControl.queryInterface(BrowserControl.HISTORY_NAME);
	BrowserControlCanvas canvas = (BrowserControlCanvas)
	    firstBrowserControl.queryInterface(BrowserControl.BROWSER_CONTROL_CANVAS_NAME);
	eventRegistration = (EventRegistration2)
	    firstBrowserControl.queryInterface(BrowserControl.EVENT_REGISTRATION_NAME);
        CurrentPage2 currentPage = (CurrentPage2)
            firstBrowserControl.queryInterface(BrowserControl.CURRENT_PAGE_NAME);

	assertNotNull(canvas);
	Frame frame = new Frame();
	frame.setBounds(0, 0, 640, 480);
	frame.add(canvas, BorderLayout.CENTER);
	frame.setVisible(true);
	canvas.setVisible(true);
	
	Navigation2 nav = (Navigation2) 
	    firstBrowserControl.queryInterface(BrowserControl.NAVIGATION_NAME);
	assertNotNull(nav);

	eventRegistration.addDocumentLoadListener(listener);

	final BitSet bitSet = new BitSet();
        final List<Runnable> realizeNewWindowRunnableList = 
                new CopyOnWriteArrayList<Runnable>();

	eventRegistration.setNewWindowListener(new NewWindowListener() {
		public void eventDispatched(WebclientEvent wcEvent) {
		    bitSet.set(0);
		    NewWindowEvent event = (NewWindowEvent) wcEvent;
                    final BrowserControlCanvas secondCanvas;
		    
		    try {
			secondBrowserControl = 
			    BrowserControlFactory.newBrowserControl();
                        secondCanvas = (BrowserControlCanvas)
                            secondBrowserControl.
                                queryInterface(BrowserControl.BROWSER_CONTROL_CANVAS_NAME);
		    } catch (Throwable e) {
			System.out.println(e.getMessage());
			fail();
                        return;
		    }
		    event.setBrowserControl(secondBrowserControl);
                    event.setRealizeNewWindowRunnableList(realizeNewWindowRunnableList);
                    event.setRealizeNewWindowRunnable(new Runnable() {
                        public void run() {
                            secondFrame.add(secondCanvas, BorderLayout.CENTER);
                            secondFrame.setVisible(true);
                            secondCanvas.setVisible(true);
                        }
                        public String toString() {
                            return "WindowCreatorTest newWindowRunnable";
                        }
                    });
                    
		}
	    });
	
	//
	// load a file that pops up a new window on link click
	//
	WindowCreatorTest.keepWaiting = true;

	nav.loadURL("http://localhost:5243/WindowCreatorTest0.html");

	// keep waiting until the previous load completes
	while (WindowCreatorTest.keepWaiting) {
	    Thread.currentThread().sleep(1000);
	}
        
	Robot robot = new Robot();
        
        Document dom = currentPage.getDOM();
        Element toClick = dom.getElementById("WindowCreator0");
        String 
                screenX = toClick.getAttribute("screenX"),
                screenY = toClick.getAttribute("screenY");
        int 
                x = Integer.valueOf(screenX).intValue(),
                y = Integer.valueOf(screenY).intValue();
	
        // Make sure to give the window focus
	robot.mouseMove(x, y);
	robot.mousePress(InputEvent.BUTTON1_MASK);
	robot.mouseRelease(InputEvent.BUTTON1_MASK);

        toClick = dom.getElementById("newWindow");
        screenX = toClick.getAttribute("screenX");
        screenY = toClick.getAttribute("screenY");
        x = Integer.valueOf(screenX).intValue();
        y = Integer.valueOf(screenY).intValue();
	
        // Make sure to give the window focus
	robot.mouseMove(x, y);
	robot.mousePress(InputEvent.BUTTON1_MASK);
	robot.mouseRelease(InputEvent.BUTTON1_MASK);
        
        
        while (realizeNewWindowRunnableList.isEmpty()) {
            Thread.currentThread().sleep(1000);
        }

        assertTrue(!bitSet.isEmpty());
        
        for (Runnable cur : realizeNewWindowRunnableList) {
            cur.run();
            Thread.currentThread().sleep(5000);

            CurrentPage2 secondCurrentPage = (CurrentPage2)
                secondBrowserControl.queryInterface(BrowserControl.CURRENT_PAGE_NAME);
            assertNotNull(secondCurrentPage);
            
            secondCurrentPage.selectAll();
            selection = secondCurrentPage.getSelection();
            assertTrue(-1 !=selection.toString().indexOf("This is page 1 of the WindowCreatorTest."));

            secondFrame.setVisible(false);
            BrowserControlFactory.deleteBrowserControl(secondBrowserControl);
        }
        
	frame.setVisible(false);
	BrowserControlFactory.deleteBrowserControl(firstBrowserControl);
    }

    

}
