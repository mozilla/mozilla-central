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
 * Represents control data for returning paged results from a search.
 *
 *
 *<PRE>
 *      VirtualListViewResponse ::= SEQUENCE {
 *               firstPosition    INTEGER,
 *               contentCount     INTEGER,
 *               virtualListViewResult ENUMERATED {
 *                 success                  (0),
 *                 unwillingToPerform       (53),
 *                 insufficientAccessRights (50),
 *                 operationsError          (1),
 *                 busy                     (51),
 *                 timeLimitExceeded        (3),
 *                 adminLimitExceeded       (11),
 *                 sortControlMissing       (60),
 *                 indexRangeError          (?),
 *               }
 *     }
 *</PRE>
 */

public class LdapVirtualListResponseControl extends LDAPVirtualListResponse implements Control{

    /**
     * Constructs a new <CODE>LDAPVirtualListResponse</CODE> object.
     * @param value A BER encoded byte array.
     * This constructor is used by the NetscapeControlFactory
     */
    LdapVirtualListResponseControl(boolean critical, byte[] value)throws Exception  {
        super(VIRTUALLISTRESPONSE, critical, value);
    }

    /**
     * Gets the size of the virtual result set.
     * @return The size of the virtual result set, or -1 if not known.
     */
    public int getContentCount() {
        return super.getContentCount();
    }

    /**
     * Gets the index of the first entry returned.
     * @return The index of the first entry returned.
     */
    public int getFirstPosition() {
        return super.getFirstPosition();
    }

    /**
     * Gets the result code.
     * @return The result code.
     */
    public int getResultCode() {
        return super.getResultCode();
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
