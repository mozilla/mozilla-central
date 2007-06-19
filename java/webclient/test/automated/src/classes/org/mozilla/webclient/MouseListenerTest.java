/*
 * $Id: MouseListenerTest.java,v 1.6 2007-06-19 20:18:13 edburns%acm.org Exp $
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

import java.awt.Rectangle;
import junit.framework.TestSuite;
import junit.framework.Test;
import java.util.Map;
import java.util.BitSet;

import java.awt.Frame;
import java.awt.Robot;
import java.awt.event.MouseListener;
import java.awt.event.MouseEvent;
import java.awt.event.InputEvent;
import java.awt.BorderLayout;
import org.mozilla.mcp.junit.WebclientTestCase;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;

// MouseListenerTest.java

public class MouseListenerTest extends WebclientTestCase {

    public MouseListenerTest(String name) {
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
	result.addTestSuite(MouseListenerTest.class);
	return (result);
    }

    static EventRegistration2 eventRegistration;

    static CurrentPage2 currentPage = null;

    static boolean keepWaiting;
    static boolean doMouseEnteredAssertions = false;
    
    int x;
    
    int y;

    //
    // Constants
    // 

    //
    // Testcases
    // 

    public void testListenerAddedToEventRegistration() throws Exception {
	doTest(false);
    }

    public void testListenerAddedToCanvas() throws Exception {
	//doTest(true);
    }
    public void doTest(boolean addToCanvas) throws Exception {
	BrowserControl firstBrowserControl = null;
	DocumentLoadListenerImpl listener = null;
	Selection selection = null;
	firstBrowserControl = BrowserControlFactory.newBrowserControl();
	assertNotNull(firstBrowserControl);
	History history = (History) 
	    firstBrowserControl.queryInterface(BrowserControl.HISTORY_NAME);
	final BrowserControlCanvas canvas = (BrowserControlCanvas)
	    firstBrowserControl.queryInterface(BrowserControl.BROWSER_CONTROL_CANVAS_NAME);
	eventRegistration = (EventRegistration2)
	    firstBrowserControl.queryInterface(BrowserControl.EVENT_REGISTRATION_NAME);

	assertNotNull(canvas);
	final Frame frame = new Frame();
	frame.setBounds(0, 30, 640, 480);
	frame.add(canvas, BorderLayout.CENTER);
	frame.setVisible(true);
	canvas.setVisible(true);
	
	Navigation2 nav = (Navigation2) 
	    firstBrowserControl.queryInterface(BrowserControl.NAVIGATION_NAME);
	assertNotNull(nav);
	currentPage = (CurrentPage2) 
	  firstBrowserControl.queryInterface(BrowserControl.CURRENT_PAGE_NAME);
	
	assertNotNull(currentPage);

	eventRegistration.addDocumentLoadListener(listener = new DocumentLoadListenerImpl() {
		public void doEndCheck() {
		    MouseListenerTest.keepWaiting = false;
		}
	    });
	final BitSet bitSet = new BitSet();
	
	// PENDING(edburns): flesh this out with more content
	MouseListener mouseListener = new MouseListener() {
		public void mouseEntered(MouseEvent e) {
                    if (MouseListenerTest.doMouseEnteredAssertions) {
                        Rectangle
                                frameBounds = frame.getBounds(),
                                canvasBounds = canvas.getBounds();
                        System.out.println("domElement(" + MouseListenerTest.this.x +
                                ", " + MouseListenerTest.this.y + ") " +
                                "frameBounds(" + frameBounds.x + ", " +
                                frameBounds.y + ") " +
                                "canvasBounds(" + canvasBounds.x +
                                ", " + canvasBounds.y + ") " +
                                "event(" + e.getX() + ", " + e.getY() + ")");
                        assertEquals(MouseListenerTest.this.x, e.getX() +
                                frameBounds.x + canvasBounds.x);
                        assertEquals(MouseListenerTest.this.y, e.getY() +
                                frameBounds.y + canvasBounds.y);
                        assertTrue(e instanceof WCMouseEvent);
                        WCMouseEvent wcMouseEvent = (WCMouseEvent) e;
                        Map eventMap =
                                (Map) wcMouseEvent.getWebclientEvent().getEventData();
                        assertNotNull(eventMap);

                        String href = (String) eventMap.get("href");
                        System.out.println("href: " + href);
                        assertNotNull(href);
                        assertEquals(href, "HistoryTest1.html");
                        Node domNode = (Node) wcMouseEvent.getWebclientEvent().getSource();
                        assertNotNull(domNode);
                        assertTrue(domNode instanceof Element);
                        Element element = (Element) domNode;
                        String
                                id = element.getAttribute("id"),
                                name = domNode.getNodeName(),
                                value = domNode.getNodeValue();
                        domNode = domNode.getFirstChild();
                        name = domNode.getNodeName();
                        value = domNode.getNodeValue();
                    }
                    bitSet.set(0);
                }
		public void mouseExited(MouseEvent e) {
		    System.out.println("debug: edburns: exited: " + 
				       e.getX() + ", " + e.getY());
		    bitSet.set(1);
		}
		public void mouseClicked(MouseEvent e) {
		    System.out.println("debug: edburns: clicked: " + 
				       e.getX() + ", " + e.getY());
		    bitSet.set(2);
		}
		public void mousePressed(MouseEvent e) {
		    System.out.println("debug: edburns: pressed: " + 
				       e.getX() + ", " + e.getY());
		    bitSet.set(3);
		}
		public void mouseReleased(MouseEvent e) {
		    System.out.println("debug: edburns: released: " + 
				       e.getX() + ", " + e.getY());
		    bitSet.set(4);
		}
	    };
	

	//
	// load four files.
	//
	MouseListenerTest.keepWaiting = true;

	nav.loadURL("http://localhost:5243/HistoryTest0.html");
	
	// keep waiting until the previous load completes
	while (MouseListenerTest.keepWaiting) {
	    Thread.currentThread().sleep(1000);
	}

	Robot robot = new Robot();
        
        Document dom = currentPage.getDOM();
        assertNotNull(dom);
        Element toClick = dom.getElementById("HistoryTest0");
        assertNotNull(toClick);
        String 
                screenX = toClick.getAttribute("screenX"),
                screenY = toClick.getAttribute("screenY");
        assertNotNull(screenX);
        assertNotNull(screenY);
        
        x = Integer.valueOf(screenX).intValue();
        y = Integer.valueOf(screenY).intValue();

        // Click the H1 just to ensure the window has focus.
        MouseListenerTest.doMouseEnteredAssertions = false;
        System.out.println("move 1: " + x + ", " + y);
        robot.mouseMove(x,y);
	robot.mousePress(InputEvent.BUTTON1_MASK);
	robot.mouseRelease(InputEvent.BUTTON1_MASK);
        Thread.currentThread().sleep(2000);
        MouseListenerTest.doMouseEnteredAssertions = true;
	
        // Now, add our test listener
	if (addToCanvas) {
	    canvas.addMouseListener(mouseListener);
	}
	else {
	    eventRegistration.addMouseListener(mouseListener);
	}
        
	Thread.currentThread().sleep(3000);
        
        toClick = dom.getElementById("HistoryTest1.html");
        assertNotNull(toClick);
        screenX = toClick.getAttribute("screenX");
        screenY = toClick.getAttribute("screenY");
        assertNotNull(screenX);
        assertNotNull(screenY);

        x = Integer.valueOf(screenX).intValue();
        y = Integer.valueOf(screenY).intValue();

	MouseListenerTest.keepWaiting = true;

        System.out.println("move 2: " + x + ", " + y);
        robot.mouseMove(x, y);
	robot.mousePress(InputEvent.BUTTON1_MASK);
	robot.mouseRelease(InputEvent.BUTTON1_MASK);

	while (MouseListenerTest.keepWaiting) {
	    Thread.currentThread().sleep(1000);
	}

        MouseListenerTest.doMouseEnteredAssertions = false;
        System.out.println("move 3: " + (x + 50) + ", " + (y + 50));
	robot.mouseMove(x + 50, y + 50);
        MouseListenerTest.doMouseEnteredAssertions = true;

	Thread.currentThread().sleep(3000);

	bitSet.flip(0, bitSet.size());
	assertTrue(!bitSet.isEmpty());

	frame.setVisible(false);
        
	if (addToCanvas) {
	    canvas.removeMouseListener(mouseListener);
	}
	else {
	    eventRegistration.removeMouseListener(mouseListener);
	}
        
	BrowserControlFactory.deleteBrowserControl(firstBrowserControl);
    }

    

}
