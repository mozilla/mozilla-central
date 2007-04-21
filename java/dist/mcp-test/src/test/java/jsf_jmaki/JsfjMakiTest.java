/*
 * $Id: JsfjMakiTest.java,v 1.1 2007-04-21 03:25:36 edburns%acm.org Exp $
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
package jsf_jmaki;

import java.util.BitSet;
import java.util.List;
import java.util.Map;
import junit.framework.TestFailure;
import org.mozilla.mcp.AjaxListener;
import org.mozilla.mcp.MCP;
import org.mozilla.webclient.WebclientTestCase;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.Document;

/**
 *
 * @author edburns
 */
public class JsfjMakiTest extends WebclientTestCase  {
    
    private MCP mcp = null;    
    
    public JsfjMakiTest(String testName) {
        super(testName);
    }
    
    private int ajaxTimeOut = 60000;
    
    private int ajaxWaitInterval = 5000;

    public void setUp() {
        super.setUp();

        mcp = new MCP();
	try {
	    mcp.setAppData(getBrowserBinDir());
	}
	catch (Exception e) {
	    fail();
	}
        
    }
    
    enum TestFeature {
        RECEIVED_END_AJAX_EVENT,
        HAS_MAP,
        HAS_VALID_RESPONSE_TEXT,
        HAS_VALID_RESPONSE_XML,
        HAS_VALID_READYSTATE,
        STOP_WAITING
    }
    
    public void testInplace() throws Exception {
        mcp.getRealizedVisibleBrowserWindow();
        final BitSet bitSet = new BitSet();
        AjaxListener listener = new AjaxListener() {
            public void endAjax(Map eventMap) {
                bitSet.flip(TestFeature.RECEIVED_END_AJAX_EVENT.ordinal());
                if (null != eventMap) {
                    bitSet.flip(TestFeature.HAS_MAP.ordinal());
                }
		// Make some assertions about the response text
                String responseText = (String) eventMap.get("responseText");
                if (null != responseText) {
                    if (-1 != responseText.indexOf("<partial-response>") &&
                        -1 != responseText.indexOf("</partial-response>")) {
                        bitSet.flip(TestFeature.HAS_VALID_RESPONSE_TEXT.ordinal());
                    }
                }
		Document responseXML = (Document) 
		    eventMap.get("responseXML");
                Element rootElement = null, element = null;
                Node node = null;
                String tagName = null;
                try {
                    rootElement = responseXML.getDocumentElement();
                    tagName = rootElement.getTagName();
                    if (tagName.equals("partial-response")) {
                        element = (Element) rootElement.getFirstChild();
                        tagName = element.getTagName();
                        if (tagName.equals("components")) {
                            element = (Element) rootElement.getLastChild();
                            tagName = element.getTagName();
                            if (tagName.equals("state")) {
                                bitSet.flip(TestFeature.
                                        HAS_VALID_RESPONSE_XML.ordinal());
                            }
                        }
                    }
                }
                catch (Throwable t) {
                    
                }
		
                String readyState = (String) eventMap.get("readyState");
                bitSet.set(TestFeature.HAS_VALID_READYSTATE.ordinal(), 
                        null != readyState && readyState.equals("4"));
                bitSet.flip(TestFeature.STOP_WAITING.ordinal());
                
            }
        };
        mcp.addAjaxListener(listener);
        
        // Load the main page of the app
        mcp.blockingLoad("http://localhost:8080/jsf-jmaki/index-demo.jsf");
        
        // Choose the inplace test
        mcp.blockingClickElement("inplace-test");
        
        scrollToBeginningOfResultSet(mcp, bitSet);
        
        Element firstCustomerName = mcp.findElement("form:table:0:j_id_id118");
        assertNotNull(firstCustomerName);
        
        // Click the first customer name cell
        mcp.clickElement(firstCustomerName);
        
        Thread.currentThread().sleep(1000);
        
        // Get the inplace editor element
        Element inplaceEditor = 
                mcp.findElement("form:table:0:j_id_id118-inplaceeditor");
        assertNotNull(inplaceEditor);
        
        // Get the text field and the button within that element
        List<Element> inplaceFields = 
                mcp.getChildElementsWithTagName(inplaceEditor, "input");
        assertNotNull(inplaceFields);
        assertTrue(2 == inplaceFields.size());
        // create a unique value, set it into the text field
        String nodeValue = "" + System.currentTimeMillis();
        inplaceFields.get(0).setNodeValue(nodeValue);
        // click "ok" to save the value via ajax
        String textContent = inplaceFields.get(1).getTextContent();
        // clear the bit set so we can make assertions about the ajax
        // transaction
        bitSet.clear();
        mcp.clickElement(inplaceFields.get(1));
        makeAjaxAssertions(bitSet);
        
        scrollToNextPageOfResultSet(mcp, bitSet);
        scrollToPreviousPageOfResultSet(mcp, bitSet);

        // Compare the value of the first customerName with
        // our local value
        firstCustomerName = mcp.findElement("form:table:0:j_id_id118");
        assertNotNull(firstCustomerName);
        assertEquals(firstCustomerName.getTextContent(),nodeValue);

        Thread.currentThread().sleep(10000);
        
        mcp.deleteBrowserControl();
    }
    
    private void makeAjaxAssertions(BitSet bitSet) throws Exception {
        // Artifically wait for the ajax transaction to complete, or the timeout to be reached.
        int i = 0;
        while (!bitSet.get(TestFeature.STOP_WAITING.ordinal()) ||
                ((i * getAjaxWaitInterval()) > getAjaxTimeOut())) {
            i++;
            Thread.currentThread().sleep(getAjaxWaitInterval());
        }
        // Ensure the timeout was not reached
        assertFalse(((i * getAjaxWaitInterval()) > getAjaxTimeOut()));

        // assert that the ajax transaction succeeded
        assertTrue(bitSet.get(TestFeature.RECEIVED_END_AJAX_EVENT.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_MAP.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_VALID_RESPONSE_TEXT.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_VALID_RESPONSE_XML.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_VALID_READYSTATE.ordinal()));
    }
    
    private void scrollToBeginningOfResultSet(MCP mcp, BitSet bitSet) throws Exception {
        // Put the scroller in a known state by clicking on the second 
        // link, then scrolling to the beginning.
        List<Element> anchors = null;
        Element firstElement, secondElement;
        String firstElementLinkText;

        anchors = mcp.getAnchors("form:subview2");
        assertTrue(!anchors.isEmpty());
        secondElement = anchors.get(1);
        assertNotNull(secondElement);
        bitSet.clear();
        mcp.clickElement(secondElement);
        makeAjaxAssertions(bitSet);

        // Scroll to the first page, if necessary
        do {
            anchors = mcp.getAnchors("form:subview2");
            assertTrue(!anchors.isEmpty());
            firstElement = anchors.get(0);
            firstElementLinkText = firstElement.getTextContent();
            secondElement = null;
            // Is the link text of the first link "Previous"?
            if (null != firstElementLinkText &&
                    firstElementLinkText.equals("Previous")) {
                // If so, click the "second" link, thus scrolling
                // one page closer to the beginning of the list.
                secondElement = anchors.get(1);
                bitSet.clear();
                mcp.clickElement(secondElement);
                makeAjaxAssertions(bitSet);
            }
        } while (null != secondElement);
    }
    
    private void scrollToNextPageOfResultSet(MCP mcp, BitSet bitSet) throws Exception {
        // Scroll to the next page
        List<Element> anchors = mcp.getAnchors("form:subview2");
        int numAnchors = anchors.size();
        assertTrue(!anchors.isEmpty());
        assertTrue(2 < numAnchors);

        bitSet.clear();
        mcp.clickElement(anchors.get(numAnchors - 1));
        makeAjaxAssertions(bitSet);
        
    }
    
    private void scrollToPreviousPageOfResultSet(MCP mcp, BitSet bitSet) throws Exception {
        // Scroll to the previous page
        List<Element> anchors = mcp.getAnchors("form:subview2");
        int numAnchors = anchors.size();
        assertTrue(!anchors.isEmpty());
        assertTrue(2 < numAnchors);

        bitSet.clear();
        mcp.clickElement(anchors.get(0));
        makeAjaxAssertions(bitSet);
        
    }

    public int getAjaxTimeOut() {
        return ajaxTimeOut;
    }

    public void setAjaxTimeOut(int ajaxTimeOut) {
        this.ajaxTimeOut = ajaxTimeOut;
    }

    public int getAjaxWaitInterval() {
        return ajaxWaitInterval;
    }

    public void setAjaxWaitInterval(int ajaxWaitInterval) {
        this.ajaxWaitInterval = ajaxWaitInterval;
    }
    
    
}
