/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
package org.ietf.ldap;

import java.io.Serializable;
import java.util.Vector;

/**
 * A queue of response messsages from the server. Multiple requests
 * can be multiplexed on the same queue. For synchronous LDAPConnection
 * requests, there will be only one request per queue. For asynchronous
 * LDAPConnection requests, the user can add multiple request to the
 * same queue.
 *
 */
public interface LDAPMessageQueue {

    /**
     * Returns the count of queued messages
     * @return message count
     */
    public int getMessageCount();

    /**
     * Returns a list of message IDs for all outstanding requests
     * @return message ID array.
     */
    public int[] getMessageIDs();

    /**
     * Blocks until a response is available or until all operations
     * associated with the object have completed or been canceled
     *
     * @return LDAP message or null if there are no more outstanding requests.
     * @exception LDAPException Network error exception
     * @exception LDAPInterruptedException The invoking thread was interrupted
     */
    public LDAPMessage getResponse() throws LDAPException;

    /**
     * Blocks until a response is available for a particular message ID, or 
     * until all operations associated with the message ID have completed or 
     * been canceled, and returns the response. If there is no outstanding 
     * operation for the message ID (or if it is zero or a negative number), 
     * IllegalArgumentException is thrown.
     *
     * @param msgid A particular message to query for responses available
     * @return a response for an LDAP operation or null if there are no
     * more outstanding requests.
     * @exception LDAPException Network error exception
     * @exception LDAPInterruptedException The invoking thread was interrupted
     */

    public LDAPMessage getResponse( int msgid )
        throws LDAPException;

    /**
     * Checks if a response message has been received
     *
     * @return true or false.
     */
    public boolean isResponseReceived();

    /**
     * Reports true if a response has been received from the server for a 
     * particular message ID. If there is no outstanding operation for the 
     * message ID (or if it is zero or a negative number), 
     * IllegalArgumentException is thrown.
     *
     * @param msgid A particular message to query for responses available
     * @return a flag indicating whether the response message queue is empty
     */
    public boolean isResponseReceived( int msgid );

    /**
     * Merge two message queues.
     * Move/append the content from another message queue to this one.
     * 
     * To be used for synchronization of asynchronous LDAP operations where
     * requests are sent by one thread but processed by another one
     * 
     * A client may be implemented in such a way that one thread makes LDAP
     * requests and calls l.getMessageIDs(), while another thread is
     * responsible for
     * processing of responses (call l.getResponse()). Both threads are using
     * the same queue objects. In such a case, a race
     * condition may occur, where a LDAP response message is retrieved and
     * the request terminated (request ID removed) before the first thread
     * has a chance to execute l.getMessageIDs().
     * The proper way to handle this scenario is to create a separate queue
     * for each new request, and after l.getMessageIDs() has been invoked,
     * merge the
     * new request with the existing one.
     * @param mq2 message queue to merge with this one
     */
    public void merge( LDAPMessageQueue mq2 );
}
