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
package org.ietf.ldap.client;

import java.util.*;
import org.ietf.ldap.ber.stream.*;
import java.io.*;

/**
 * This class implements the filter substring.
 * <P>See RFC 1777.
 *
 * <pre>
 * [4] SEQUENCE {
 *   type AttributeType,
 *   SEQUENCE OF CHOICE {
 *     initial [0] LDAPString,
 *     any [1] LDAPString,
 *     final [2] LDAPString
 *   }
 *     }
 * </pre>
 *
 * @version 1.0
 */
public class JDAPFilterSubString extends JDAPFilter {
    /**
     * Internal variables
     */
    private String m_type = null;
    private Vector m_initial = new Vector();
    private Vector m_any = new Vector();
    private Vector m_final = new Vector();

    /**
     * Constructs the filter.
     * @param type attribute type
     */
    public JDAPFilterSubString(String type) {
        super();
        m_type = type;
    }

    /**
     * Adds initial substring.
     * @param s initial substring
     */
    public void addInitial(String s) {
        m_initial.addElement(s);
    }

    /**
     * Adds any substring.
     * @param s any substring
     */
    public void addAny(String s) {
        m_any.addElement(s);
    }

    /**
     * Adds final substring.
     * @param s final substring
     */
    public void addFinal(String s) {
        m_final.addElement(s);
    }

    /**
     * Gets ber representation of the filter.
     * @return ber representation
     */
    public BERElement getBERElement() {
        BERSequence seq = new BERSequence();
        seq.addElement(new BEROctetString(m_type));
        BERSequence str_seq = new BERSequence();
        for (int i = 0; i < m_initial.size(); i++) {
            String val = (String)m_initial.elementAt(i);
            if (val == null)
                continue;
            BERTag str = new BERTag(BERTag.CONTEXT|0,
                JDAPFilterOpers.getOctetString(val), true);
            str_seq.addElement(str);
        }
        for (int i = 0; i < m_any.size(); i++) {
            String val = (String)m_any.elementAt(i);
            if (val == null)
                continue;
            BERTag str = new BERTag(BERTag.CONTEXT|1,
              JDAPFilterOpers.getOctetString(val), true);
            str_seq.addElement(str);
        }
        for (int i = 0; i < m_final.size(); i++) {
            String val = (String)m_final.elementAt(i);
            if (val == null)
                continue;
            BERTag str = new BERTag(BERTag.CONTEXT|2,
              JDAPFilterOpers.getOctetString(val), true);
            str_seq.addElement(str);
        }
        seq.addElement(str_seq);
        BERTag element = new BERTag(BERTag.CONSTRUCTED|BERTag.CONTEXT|4,
          seq, true);
        return element;
    }

    /**
     * Gets string reprensetation of the filter.
     * @return string representation
     */
    public String toString() {
        String initial = "";
        for (int i = 0; i < m_initial.size(); i++) {
            if (i != 0)
                initial = initial + ",";
            initial = initial + (String)m_initial.elementAt(i);
        }

        String any = "";
        for (int i = 0; i < m_any.size(); i++) {
            if (i != 0)
                any = any + ",";
            any = any + (String)m_any.elementAt(i);
        }

        String s_final = "";
        for (int i = 0; i < m_final.size(); i++) {
            if (i != 0)
                s_final = s_final + ",";
            s_final = s_final + (String)m_final.elementAt(i);
        }

        return "JDAPFilterSubString {type=" + m_type + ", initial=" + initial +
          ", any=" + any + ", final=" + s_final + "}";
    }
}
