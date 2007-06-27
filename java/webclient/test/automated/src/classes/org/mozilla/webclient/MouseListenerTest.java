/*
 * $Id: MouseListenerTest.java,v 1.7 2007-06-27 23:29:15 edburns%acm.org Exp $
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
import junit.framework.TestFailure;
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

    int x;
    
    int y;

    //
    // Constants
    // 

    enum TestFeature {
        MOUSE_ENTERED,
        MOUSE_EXITED,
        MOUSE_CLICKED,
        MOUSE_PRESSED,
        MOUSE_RELEASED,
        HAS_EXPECTED_X,
        HAS_EXPECTED_Y,
        IS_WCMOUSEEVENT,
        HAS_EVENT_MAP,
        HAS_HREF,
        HAS_EXPECTED_HREF,
        HAS_DOM_NODE,
        DOM_NODE_IS_ELEMENT,
        STOP_WAITING
    }
 

    //
    // Testcases
    // 

    public void testListenerAddedToEventRegistration() throws Exception {
	doTest(false);
    }

    public void testListenerAddedToCanvas() throws Exception {
	doTest(true);
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
	EventRegistration2 eventRegistration = (EventRegistration2)
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
	CurrentPage2 currentPage = (CurrentPage2) 
	  firstBrowserControl.queryInterface(BrowserControl.CURRENT_PAGE_NAME);
	
	assertNotNull(currentPage);

        final BitSet bitSet = new BitSet();

	eventRegistration.addDocumentLoadListener(listener = new DocumentLoadListenerImpl() {
		public void doEndCheck() {
		    bitSet.set(TestFeature.STOP_WAITING.ordinal(),true);
		}
	    });
	
	// PENDING(edburns): flesh this out with more content
	MouseListener mouseListener = new MouseListener() {
		public void mouseEntered(MouseEvent e) {
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
                    bitSet.set(TestFeature.HAS_EXPECTED_X.ordinal(),
                            MouseListenerTest.this.x ==
                            (e.getX() + frameBounds.x + canvasBounds.x));
                    bitSet.set(TestFeature.HAS_EXPECTED_Y.ordinal(),
                            MouseListenerTest.this.y == 
                            (e.getY() + frameBounds.y + canvasBounds.y));
                    bitSet.set(TestFeature.IS_WCMOUSEEVENT.ordinal(),
                            e instanceof WCMouseEvent);
                    WCMouseEvent wcMouseEvent = (WCMouseEvent) e;
                    Map eventMap =
                            (Map) wcMouseEvent.getWebclientEvent().getEventData();
                    bitSet.set(TestFeature.HAS_EVENT_MAP.ordinal(), 
                            null != eventMap);

                    String href = (String) eventMap.get("href");
                    System.out.println("href: " + href);
                    bitSet.set(TestFeature.HAS_HREF.ordinal(), null != href);
                    if (null != href) {
                        bitSet.set(TestFeature.HAS_EXPECTED_HREF.ordinal(),
                                href.equals("HistoryTest1.html"));
                    }
                    Node domNode = (Node) wcMouseEvent.getWebclientEvent().getSource();
                    bitSet.set(TestFeature.HAS_DOM_NODE.ordinal(), 
                            null != domNode);
                    bitSet.set(TestFeature.DOM_NODE_IS_ELEMENT.ordinal(),
                            domNode instanceof Element);
                    Element element = (Element) domNode;
                    String
                            id = element.getAttribute("id"),
                            name = domNode.getNodeName(),
                            value = domNode.getNodeValue();
                    domNode = domNode.getFirstChild();
                    name = domNode.getNodeName();
                    value = domNode.getNodeValue();
                    bitSet.set(TestFeature.MOUSE_ENTERED.ordinal(),true);
                }
		public void mouseExited(MouseEvent e) {
		    System.out.println("debug: edburns: exited: " + 
				       e.getX() + ", " + e.getY());
		    bitSet.set(TestFeature.MOUSE_EXITED.ordinal(), true);
		}
		public void mouseClicked(MouseEvent e) {
		    System.out.println("debug: edburns: clicked: " + 
				       e.getX() + ", " + e.getY());
                    bitSet.set(TestFeature.MOUSE_CLICKED.ordinal(), true);
		}
		public void mousePressed(MouseEvent e) {
		    System.out.println("debug: edburns: pressed: " + 
				       e.getX() + ", " + e.getY());
		    bitSet.set(TestFeature.MOUSE_PRESSED.ordinal(), true);
		}
		public void mouseReleased(MouseEvent e) {
		    System.out.println("debug: edburns: released: " + 
				       e.getX() + ", " + e.getY());
		    bitSet.set(TestFeature.MOUSE_RELEASED.ordinal(), true);
		}
	    };
	

	//
	// load four files.
	//

        bitSet.clear();    
	nav.loadURL("http://localhost:5243/HistoryTest0.html");
	
	// keep waiting until the previous load completes
	while (!bitSet.get(TestFeature.STOP_WAITING.ordinal())) {
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
        System.out.println("move 1: " + x + ", " + y);
        robot.mouseMove(x,y);
	robot.mousePress(InputEvent.BUTTON1_MASK);
	robot.mouseRelease(InputEvent.BUTTON1_MASK);
        Thread.currentThread().sleep(2000);
	
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

	bitSet.clear();
        System.out.println("move 2: " + x + ", " + y);
        robot.mouseMove(x, y);
	robot.mousePress(InputEvent.BUTTON1_MASK);
	robot.mouseRelease(InputEvent.BUTTON1_MASK);

	while (!bitSet.get(TestFeature.STOP_WAITING.ordinal()) &&
                !bitSet.get(TestFeature.MOUSE_ENTERED.ordinal())) {
	    Thread.currentThread().sleep(1000);
	}
        assertTrue(bitSet.get(TestFeature.DOM_NODE_IS_ELEMENT.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_DOM_NODE.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_EVENT_MAP.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_EXPECTED_HREF.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_EXPECTED_X.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_EXPECTED_Y.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_HREF.ordinal()));
        assertTrue(bitSet.get(TestFeature.IS_WCMOUSEEVENT.ordinal()));
        assertTrue(bitSet.get(TestFeature.MOUSE_ENTERED.ordinal()));
        assertTrue(bitSet.get(TestFeature.MOUSE_PRESSED.ordinal()));
        assertTrue(bitSet.get(TestFeature.MOUSE_RELEASED.ordinal()));
        assertTrue(bitSet.get(TestFeature.MOUSE_EXITED.ordinal()));

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
