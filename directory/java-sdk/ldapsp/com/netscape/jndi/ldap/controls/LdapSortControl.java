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
package com.netscape.jndi.ldap.controls;

import javax.naming.ldap.Control;
import netscape.ldap.controls.*;

/**
 * Represents an LDAP v3 server control that specifies that you want
 * the server to return sorted search results.  (The OID for this
 * control is 1.2.840.113556.1.4.473.)
 * <P>
 *
 * When constructing an <CODE>LDAPSortControl</CODE> object, you can
 * specify the order in which you want the results sorted.
 * You can also specify whether or not this control is critical
 * to the search operation.
 * <P>
 *
 * To specify the sort order, you construct an <CODE>LdapSortKey</CODE>
 * object and pass it to the <CODE>LdapSortControl</CODE> constructor.
 * The <CODE>LdapSortKey</CODE> object represents a list of the attribute
 * types used for sorting (a "sort key list").
 *
 * The LDAP server sends back a sort response control to indicate
 * the result of the sorting operation. (The OID for this control
 * is 1.2.840.113556.1.4.474.)
 *
 * @see com.netscape.jndi.ldap.controls.LdapSortKey
 * @see com.netscape.jndi.ldap.controls.LdapSortResponseControl
 */
public class LdapSortControl extends LDAPSortControl implements Control{
    /**
     * Constructs an <CODE>LDAPSortControl</CODE> object with a single
     * sorting key.
     * @param key A single attribute to sort by.
     * @param critical <CODE>true</CODE> if the LDAP operation should be
     * discarded when the server does not support this control (in other
     * words, this control is critical to the LDAP operation).
     * @see com.netscape.jndi.ldap.controls.LdapSortKey
     */
    public LdapSortControl(LdapSortKey key,
                           boolean critical) {
        super (key, critical);
    }

    /**
     * Constructs an <CODE>LDAPSortControl</CODE> object with an array of
     * sorting keys.
     * @param keys The attributes to sort by.
     * @param critical <CODE>true</CODE> if the LDAP operation should be
     * discarded when the server does not support this control (in other
     * words, this control is critical to the LDAP operation).
     * @see com.netscape.jndi.ldap.controls.LdapSortKey
     */
    public LdapSortControl(LdapSortKey[] keys,
                           boolean critical) {
        super(keys, critical);
    }


    static LdapSortKey[] toSortKey(String[] keysIn) {
        LdapSortKey[] keysOut = new LdapSortKey[keysIn.length];
        for (int i=0; i < keysIn.length; i++) {
            keysOut[i] = new LdapSortKey(keysIn[i]);
        }
        return keysOut;
    }

    /**
     * Constructs an <CODE>LDAPSortControl</CODE> object with an array of
     * sorting keys.
     * @param keys The attributes to sort by.
     * @param critical <CODE>true</CODE> if the LDAP operation should be
     * discarded when the server does not support this control (in other
     * words, this control is critical to the LDAP operation).
     * @see com.netscape.jndi.ldap.controls.LdapSortKey
     */
    public LdapSortControl(String[] keys,
                           boolean critical) {
        super(toSortKey(keys), critical);
    }


    /**
     * Retrieves the ASN.1 BER encoded value of the LDAP control.
     * Null is returned if the value is absent.
     * @return A possibly null byte array representing the ASN.1 BER
     * encoded value of the LDAP control.
     */
    public byte[] getEncodedValue() {
        return getValue();
    }    
}

