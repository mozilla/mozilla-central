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
import java.net.*;

/**
 * This class implements the search result reference.
 * <P>See RFC 1777.
 *
 * <pre>
 * SearchResultReference :: [APPLICATION 19] SEQUENCE OF LDAPURL
 * </pre>
 *
 * @version 1.0
 */
public class JDAPSearchResultReference implements JDAPProtocolOp {

    /**
     * Internal variables
     */
    protected String m_urls[] = null;
    protected BERElement m_element = null;

    /**
     * Constructs extended response.
     * @param element ber element of add response
     */
    public JDAPSearchResultReference(BERElement element) throws IOException {
        m_element = element;
        BERSequence seq = (BERSequence)((BERTag)element).getValue();
        if (seq.size() < 0)
            return;
        m_urls = new String[seq.size()];
        for (int i=0; i < seq.size(); i++) {
            BEROctetString o = (BEROctetString)seq.elementAt(i);
            m_urls[i] = new String(o.getValue(), "UTF8");
        }
    }

    /**
     * Retrieves the protocol operation type.
     * @return protocol type
     */
    public int getType() {
        return JDAPProtocolOp.SEARCH_RESULT_REFERENCE;
    }

    /**
     * Retrieves the BER representation of this object.
     */
    public BERElement getBERElement() {
        return m_element;
    }

    /**
     * Retrieves a list of urls.
     */
    public String[] getUrls() {
        return m_urls;
    }

    /**
     * Retrieve the string representation.
     * @return string representation
     */
    public String toString() {
        String urls = "";
        if (m_urls != null) {
            for (int i = 0; i < m_urls.length; i++) {
                if (i != 0)
                    urls += ",";
                urls += m_urls[i];
            }
        }
        return "SearchResultReference " + urls;
    }
}
