/*
 * $Id: ImmoSearchTest.java,v 1.1 2007-06-26 07:17:25 edburns%acm.org Exp $
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

import java.util.BitSet;
import java.util.Map;
import junit.framework.TestFailure;
import org.mozilla.mcp.AjaxListener;
import org.mozilla.mcp.MCP;
import org.mozilla.mcp.TimeoutHandler;
import org.mozilla.mcp.junit.WebclientTestCase;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.Document;

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
        HAS_VALID_RESPONSE_TEXT,
        HAS_VALID_RESPONSE_XML,
        HAS_VALID_READYSTATE,
        STOP_WAITING
    }
    
    public void testTrue() throws Exception {
        assertTrue(true);
    }
    
    public void testPlzAutoComplete() throws Exception {
        mcp.setBounds(30, 30, 960, 960);
        mcp.getRealizedVisibleBrowserWindow();
        final BitSet bitSet = new BitSet();
        AjaxListener listener = new AjaxListener() {
            public void endAjax(Map eventMap) {
                bitSet.flip(TestFeature.RECEIVED_END_AJAX_EVENT.ordinal());
                if (null != eventMap) {
                    bitSet.flip(TestFeature.HAS_MAP.ordinal());
                }
            }
        };
        mcp.addAjaxListener(listener);
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
        mcp.waitUntilTextPresent("Bedienung");

        // Get the Postleitzahl text field
        Element plzInput = mcp.findElement("basefield");
        assertNotNull(plzInput);
        mcp.setCurrentElementText("80");
        
        boolean keepWaiting = true;
        while (keepWaiting) {
            Thread.currentThread().sleep(1000);
        }

        mcp.deleteBrowserControl();
    }
    
}
