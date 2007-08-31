/*
 * $Id: ImmoSearchTest.java,v 1.4 2007-08-31 15:05:18 edburns%acm.org Exp $
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
package immosearch;

import java.awt.event.KeyEvent;
import java.util.BitSet;
import java.util.Map;
import org.mozilla.mcp.AjaxListener;
import org.mozilla.mcp.Condition;
import org.mozilla.mcp.MCP;
import org.mozilla.mcp.TimeoutHandler;
import org.mozilla.mcp.junit.WebclientTestCase;
import org.w3c.dom.Element;

/**
 *
 * @author edburns
 */
public class ImmoSearchTest extends WebclientTestCase  {
    
    private MCP mcp = null;    
    
    public ImmoSearchTest(String testName) {
        super(testName);
    }

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
        HAS_VALID_FIRST_AUTOCOMPLETE_RESPONSE,
        HAS_VALID_SECOND_AUTOCOMPLETE_RESPONSE,
        HAS_VALID_RESPONSE_TEXT,
        HAS_VALID_RESPONSE_XML,
        HAS_VALID_READYSTATE,
        STOP_WAITING
    }
    
    public void testTrue() throws Exception {
        assertTrue(true);
    }
    
    public void testPlzAutoComplete() throws Exception {
        int len,i;
        mcp.setBounds(30, 30, 960, 960);
        mcp.getRealizedVisibleBrowserWindow();
        final BitSet bitSet = new BitSet();
        AjaxListener autocompleteListener = new AjaxListener() {
            public void endAjax(Map eventMap) {
                bitSet.set(TestFeature.RECEIVED_END_AJAX_EVENT.ordinal(),
                        true);
                if (null != eventMap) {
                    bitSet.set(TestFeature.HAS_MAP.ordinal(), true);
                }
                String readyState = (String) eventMap.get("readyState");
                bitSet.set(TestFeature.HAS_VALID_READYSTATE.ordinal(),
                            null != readyState && readyState.equals("4"));

                String responseText = (String) eventMap.get("responseText");
                
                // Test the first autocomplete response.
                
                // Score the response.  The response must have at least 5
                // of the following ten Postleitzahls.
                int plzScore = 0;
                plzScore += (-1 != responseText.indexOf("8400 Winterthur")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8200 Schaffhausen")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8500 Frauenfeld")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8610 Uster")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8280 Kreuzlingen")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8050 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8645 Jona")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8600 D\\u00fcbendorf")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8810 Horgen")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8700 K\\u00fcsnacht ZH")) ? 1 : 0;
                if (5 < plzScore) {
                    bitSet.flip(TestFeature.HAS_VALID_FIRST_AUTOCOMPLETE_RESPONSE.ordinal());
                }
                plzScore = 0;
                plzScore += (-1 != responseText.indexOf("8050 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8032 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8049 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8048 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8006 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8057 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8004 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8008 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8046 Z\\u00fcrich")) ? 1 : 0;
                plzScore += (-1 != responseText.indexOf("8051 Z\\u00fcrich")) ? 1 : 0;
                
                if (5 < plzScore) {
                    bitSet.flip(TestFeature.HAS_VALID_SECOND_AUTOCOMPLETE_RESPONSE.ordinal());
                }
                if (bitSet.get(TestFeature.HAS_VALID_FIRST_AUTOCOMPLETE_RESPONSE.ordinal()) ||
                        bitSet.get(TestFeature.HAS_VALID_SECOND_AUTOCOMPLETE_RESPONSE.ordinal())) {
                    bitSet.set(TestFeature.STOP_WAITING.ordinal(),true);
                }
                LOGGER.info("Received Ajax ResponseText: " + responseText);
            }
        };
        mcp.addAjaxListener(autocompleteListener);

        final Thread mainThread = Thread.currentThread();
        
        TimeoutHandler timeoutHandler = new TimeoutHandler() {
            public void timeout() {
                super.timeout();
                mainThread.interrupt();
                fail("Action timed out");
            }
        };        
        mcp.setTimeoutHandler(timeoutHandler);
        
        // Load the main page of the app
        mcp.blockingLoad("http://immo.search.ch/");
        
        // Wait for the instructions to appear
        boolean conditionMet = 
        mcp.waitUntilConditionMet(new Condition() { 
            public boolean isConditionMet() {
               if (!(conditionMet = (null != ImmoSearchTest.this.mcp.findElementById("statusfield")))) {
                   conditionMet = ImmoSearchTest.this.mcp.findInPage("Bedienung");
               }
               return conditionMet;
            }
        });
        assertTrue(conditionMet);

        // Get the Postleitzahl text field
        Element plzInput = mcp.findElement("basefield");
        assertNotNull(plzInput);
        mcp.focusElement(plzInput);

        // Append "8" into the text field
        bitSet.clear();
        mcp.appendKeyCodeToCurrentElementText(KeyEvent.VK_8);
        makeAutocompleteAjaxAssertions(bitSet);
        for (i = 0; i < 10; i++) {
            assertNotNull(mcp.findElement("basefield_ce" + i));
        }
        
        
        // Append "0" into the text field.
        bitSet.clear();
        mcp.appendKeyCodeToCurrentElementText(KeyEvent.VK_0);
        makeAutocompleteAjaxAssertions(bitSet);
        for (i = 0; i < 10; i++) {
            assertNotNull(mcp.findElement("basefield_ce" + i));
        }

        mcp.removeAjaxListener(autocompleteListener);
        
        // Select the first autocomplete suggestion
        AjaxListener trefferUpdateListener = new AjaxListener() {
            public void endAjax(Map eventMap) {
                bitSet.set(TestFeature.RECEIVED_END_AJAX_EVENT.ordinal(),
                        true);
                if (null != eventMap) {
                    bitSet.set(TestFeature.HAS_MAP.ordinal(), true);
                }
                String readyState = (String) eventMap.get("readyState");
                bitSet.set(TestFeature.HAS_VALID_READYSTATE.ordinal(),
                            null != readyState && readyState.equals("4"));

                String responseText = (String) eventMap.get("responseText");
                if (-1 != responseText.indexOf("8050 Z\\u00fcrich")) {
                    bitSet.set(TestFeature.STOP_WAITING.ordinal(), true);
                }
                
                LOGGER.info("Received Ajax ResponseText: " + responseText);
            }
        };
        
        bitSet.clear();
        mcp.addAjaxListener(trefferUpdateListener);
        mcp.appendKeyCodeToCurrentElementText(KeyEvent.VK_DOWN);
        mcp.appendKeyCodeToCurrentElementText(KeyEvent.VK_ENTER);
        makeTrefferUpdateAjaxAssertions(bitSet);
        
        
        mcp.deleteBrowserControl();
    }
    
    private void makeAutocompleteAjaxAssertions(BitSet bitSet) throws Exception {
        // Artifically wait for the ajax transaction to complete, or the timeout to be reached.
        int i = 0;
        while (true) {
            if (bitSet.get(TestFeature.STOP_WAITING.ordinal())) {
                break;
            }
            i++;
            Thread.currentThread().sleep(mcp.getTimeoutWaitInterval());
        }

        // assert that the ajax transaction succeeded
        assertTrue(bitSet.get(TestFeature.RECEIVED_END_AJAX_EVENT.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_MAP.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_VALID_FIRST_AUTOCOMPLETE_RESPONSE.ordinal()) ^
                bitSet.get(TestFeature.HAS_VALID_SECOND_AUTOCOMPLETE_RESPONSE.ordinal()));
        assertTrue(bitSet.get(TestFeature.HAS_VALID_READYSTATE.ordinal()));
    }
    
    private void makeTrefferUpdateAjaxAssertions(BitSet bitSet) throws Exception {
        // Artifically wait for the ajax transaction to complete, or the timeout to be reached.
        int i = 0;
        while (true) {
            if (bitSet.get(TestFeature.STOP_WAITING.ordinal())) {
                break;
            }
            i++;
            Thread.currentThread().sleep(mcp.getTimeoutWaitInterval());
        }

    }
    
    
}
