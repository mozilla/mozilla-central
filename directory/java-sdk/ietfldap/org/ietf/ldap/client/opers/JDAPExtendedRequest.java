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
package org.ietf.ldap.client.opers;

import java.util.*;
import org.ietf.ldap.client.*;
import org.ietf.ldap.ber.stream.*;
import java.io.*;

/**
 * This class implements the ExtendedRequest request. This object
 * is sent to the ldap server and is a v3 request.
 * <P>See RFC 1777.
 *
 * <pre>
 * ExtendedRequest ::= [APPLICATION 23] SEQUENCE {
 *   requestName  [0] LDAPOID,
 *   requestValue [1] OCTET STRING OPTIONAL
 * }
 * </pre>
 *
 * @version 1.0
 */
public class JDAPExtendedRequest implements JDAPProtocolOp {
    /**
     * Internal variables
     */
    protected String m_oid = null;
    protected byte m_value[] = null;

    /**
     * Constructs extended request.
     * @param oid object identifier
     * @param value request value
     */
    public JDAPExtendedRequest(String oid, byte value[]) {
        m_oid = oid;
        m_value = value;
    }

    /**
     * Retrieves protocol operation type.
     * @return protcol type
     */
    public int getType() {
        return JDAPProtocolOp.EXTENDED_REQUEST;
    }

    /**
     * Gets the ber representation of extended request.
     * @return ber representation of request
     */
    public BERElement getBERElement() {
        BERSequence seq = new BERSequence();
        seq.addElement(new BERTag(BERTag.CONTEXT|0,
          new BEROctetString (m_oid), true));
        if (m_value != null) {
            seq.addElement(new BERTag(BERTag.CONTEXT|1,
              new BEROctetString (m_value, 0, m_value.length), true));
        }
        BERTag element = new BERTag(BERTag.APPLICATION|BERTag.CONSTRUCTED|23,
          seq, true);
        return element;
    }

    /**
     * Retrieves the string representation of add request parameters.
     * @return string representation of add request parameters
     */
    public String getParamString() {
        String s = "";
        if (m_value != null) {
            try{
                s = new String(m_value, "UTF8");
            } catch(Throwable x) {}
        }
        return "{OID='" + m_oid + "', value='" + s + "'}";
    }

    /**
     * Retrieves the string representation of add request.
     * @return string representation of add request
     */
    public String toString() {
        return "ExtendedRequest " + getParamString();
    }
}
