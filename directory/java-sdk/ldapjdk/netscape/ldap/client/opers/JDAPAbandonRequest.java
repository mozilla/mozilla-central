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
 * Portions created by the Initial Developer are Copyright (C) 1999
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
package netscape.ldap.client.opers;

import java.util.*;
import netscape.ldap.client.*;
import netscape.ldap.ber.stream.*;
import java.io.*;
import java.net.*;

/**
 * This class implements the abandon request. This object
 * is sent to the ldap server.
 * <pre>
 * AbandonRequest ::= [APPLICATION 16] MessageID
 * </pre>
 *
 * @version 1.0
 * @see RFC1777
 */
public class JDAPAbandonRequest implements JDAPProtocolOp {
    /**
     * Internal variables
     */
    protected int m_msgid;

    /**
     * Constructs abandon request.
     * @param msgid message identifier
     */
    public JDAPAbandonRequest(int msgid) {
        m_msgid = msgid;
    }

    /**
     * Retrieves the protocol operation type.
     * @return protocol type
     */
    public int getType() {
        return JDAPProtocolOp.ABANDON_REQUEST;
    }

    /**
     * Gets the ber representation of abandon request.
     * @return ber representation of request
     */
    public BERElement getBERElement() {
        /* Assumed m_msgid = 1. The BER encoding output
         * should be
         *
         * [*] umich-ldap-v3.3:
         *     0x50 (implicit tagged integer)
         *     0x01 (length)
         *     0x01 (message id)
         */
        BERInteger i = new BERInteger(m_msgid);
        BERTag element = new BERTag(BERTag.APPLICATION|16, i, true);
        return element;
    }

    /**
     * Retrieves the string representation of abandon request.
     * @return string representation
     */
    public String toString() {
        return "AbandonRequest {msgid=" + m_msgid + "}";
    }
}
