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
 * <PRE>
 *      VirtualListViewRequest ::= SEQUENCE {
 *                      beforeCount    INTEGER,
 *                      afterCount     INTEGER,
 *                      CHOICE {
 *                      byIndex [0] SEQUENCE {
 *                          index           INTEGER,
 *                          contentCount    INTEGER }
 *                      byFilter [1] jumpTo    Substring }
 * </PRE>
 *
 */

public class LdapVirtualListControl extends LDAPVirtualListControl implements Control {

    /**
     * Constructs a new <CODE>LDAPVirtualListControl</CODE> object. Use this
     * constructor on an initial search operation, specifying the first
     * entry to be matched, or the initial part of it.
     * @param jumpTo An LDAP search expression defining the result set.
     * @param beforeCount The number of results before the top/center to
     * return per page.
     * @param afterCount The number of results after the top/center to
     * return per page.
     */
    public LdapVirtualListControl( String jumpTo, int beforeCount,
                                   int afterCount  ) {
        super( jumpTo, beforeCount, afterCount);
    }

    /**
     * Constructs a new <CODE>LDAPVirtualListControl</CODE> object. Use this
     * constructor on a subsquent search operation, after we know the
     * size of the virtual list, to fetch a subset.
     * @param startIndex The index into the virtual list of an entry to
     * return.
     * @param beforeCount The number of results before the top/center to
     * return per page.
     * @param afterCount The number of results after the top/center to
     * return per page.
     */
    public LdapVirtualListControl( int startIndex, int beforeCount,
                                   int afterCount, int contentCount  ) {
        super( startIndex, beforeCount, afterCount, contentCount );
    }

    /**
     * Sets the starting index, and the number of entries before and after
     * to return. Apply this method to a control returned from a previous
     * search, to specify what result range to return on the next search.
     * @param startIndex The index into the virtual list of an entry to
     * return.
     * @param beforeCount The number of results before startIndex to
     * return per page.
     * @param afterCount The number of results after startIndex to
     * return per page.
     */
    public void setRange( int startIndex, int beforeCount, int afterCount  ) {
        super.setRange(startIndex, beforeCount, afterCount);
    }

    /**
     * Sets the search expression, and the number of entries before and after
     * to return.
     * @param jumpTo An LDAP search expression defining the result set.
     * return.
     * @param beforeCount The number of results before startIndex to
     * return per page.
     * @param afterCount The number of results after startIndex to
     * return per page.
     */
    public void setRange( String jumpTo, int beforeCount, int afterCount  ) {
        super.setRange(jumpTo, beforeCount, afterCount);
    }

    /**
     * Gets the size of the virtual result set.
     * @return The size of the virtual result set, or -1 if not known.
     */
    public int getIndex() {
        return super.getIndex();
    }

    /**
     * Gets the size of the virtual result set.
     * @return The size of the virtual result set, or -1 if not known.
     */
    public int getListSize() {
        return super.getListSize();
    }

    /**
     * Sets the size of the virtual result set.
     * @param listSize The virtual result set size.
     */
    public void setListSize( int listSize ) {
        super.setListSize(listSize);
    }

    /**
     * Gets the number of results before the top/center to return per page.
     * @return The number of results before the top/center to return per page.
     */
    public int getBeforeCount() {
        return super.getBeforeCount();
    }

    /**
     * Gets the number of results after the top/center to return per page.
     * @return The number of results after the top/center to return per page.
     */
    public int getAfterCount() {
        return super.getAfterCount();
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
