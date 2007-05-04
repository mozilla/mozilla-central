/*
 * $Id: TimeoutHandler.java,v 1.1 2007-05-04 17:10:17 edburns%acm.org Exp $
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

package org.mozilla.mcp;

/**
 * <p>This class provides a simple facility for placing a time bound on
 * browser interactions (clicks, Ajax transactions, etc).</p>
 *
 * <p>Usage</p>
 *
 * <p>A useful pattern is to use this as an inner class within a JUnit
 * testscase:</p>
<pre><code>
        final Thread testThread = Thread.currentThread();
        timeoutHandler = new TimeoutHandler() {
            public void timeout() {
                super.timeout();
                testThread.interrupt();
                fail("Action timed out");
            }
        };        
        mcp.setTimeoutHandler(timeoutHandler);
</code></pre>
 *
 * <p><code>TimeoutHandler</code> has a boolean JavaBeans property
 * called <code>didTimeout</code> that can be used after blocking
 * operations to test if a timeout happened.</p>

<pre><code>
        if (timeoutHandler.isDidTimeout()) {
            fail("timed out waiting for load");
        }
</code></pre>

 *
 * <p>Another useful pattern is to combine the previous inner class
 * approach with having the browser perform a non-blocking operation,
 * and then causing the main thread to enter a loop until either a
 * condition is met, or the timeout occurs:</p>
 *
<pre><code>
        bitSet.clear();
        mcp.clickElement(inplaceFields.get(1));
        makeAjaxAssertions(bitSet);
//...
    private void makeAjaxAssertions(BitSet bitSet) throws Exception {
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
    }

</code></pre>
 * 
 * <p>The above code will either exit normally, by virtuo of the
 * AjaxListener being called and it setting the STOP_WAITING bit in the
 * bitset, or it will terminate due to timeout, in which case the inner
 * class timeout method will be called.</p>
 *
 * @author edburns
 */
public class TimeoutHandler {

    /**
     * <p>The default implementation sets the value of the
     * <code>didTimeout</code> JavaBeans property to
     * <code>true</code>.</p>
     */ 
    public void timeout() {
        setDidTimeout(true);
    }
    
    private boolean didTimeout = false;

    /**
     * <p>Getter for boolean JavaBeans property
     * <code>didTimeout</code>.</p>
     */

    public boolean isDidTimeout() {
        return didTimeout;
    }

    /**
     * <p>Setter for boolean JavaBeans property
     * <code>didTimeout</code>.</p>
     */

    public void setDidTimeout(boolean didTimeout) {
        this.didTimeout = didTimeout;
    }
    
}
