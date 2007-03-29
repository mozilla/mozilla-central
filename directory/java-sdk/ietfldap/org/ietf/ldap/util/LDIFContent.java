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
package org.ietf.ldap.util;

import org.ietf.ldap.LDAPControl;

/**
 * This interface represents the content of an LDIF record.
 * An LDIF record can specify an entry or modifications to be
 * made to an entry.
 * <P>
 *
 * The following classes implement this interface:
 * <P>
 *
 * <UL>
 * <LI><CODE>LDIFAttributeContent</CODE> (represents the content
 * of an LDIF record that specifies an entry)
 * <LI><CODE>LDIFAddContent</CODE> (represents the content
 * of an LDIF record that adds a new entry)
 * <LI><CODE>LDIFModifyContent</CODE> (represents the content
 * of an LDIF record that modifies an entry)
 * <LI><CODE>LDIFDeleteContent</CODE> (represents the content
 * of an LDIF record that deletes an entry)
 * <LI><CODE>LDIFModDNContent</CODE> (represents the content
 * of an LDIF record that changes the RDN or DN of an entry)
 * </UL>
 * <P>
 *
 * @version 1.0
 * @see org.ietf.ldap.util.LDIFRecord
 * @see org.ietf.ldap.util.LDIFAttributeContent
 * @see org.ietf.ldap.util.LDIFAddContent
 * @see org.ietf.ldap.util.LDIFModifyContent
 * @see org.ietf.ldap.util.LDIFDeleteContent
 * @see org.ietf.ldap.util.LDIFModDNContent
 */
public interface LDIFContent {

   /**
    * The LDIF record specifies an entry and its attributes.
    */
    public final static int ATTRIBUTE_CONTENT = 0;

   /**
    * The LDIF record specifies a new entry to be added.
    */
    public final static int ADD_CONTENT = 1;

   /**
    * The LDIF record specifies an entry to be deleted.
    */
    public final static int DELETE_CONTENT = 2;

   /**
    * The LDIF record specifies modifications to an entry.
    */
    public final static int MODIFICATION_CONTENT = 3;

   /**
    * The LDIF record specifies changes to the DN or RDN of an entry.
    */
    public final static int MODDN_CONTENT = 4;

    /**
     * Determines the content type.
     * @return the content type, identified by one of the following values:
     * <UL>
     * <LI>ATTRIBUTE_CONTENT (specifies an entry and its attributes)
     * <LI>ADD_CONTENT (specifies a new entry to be added)
     * <LI>DELETE_CONTENT (specifies an entry to be deleted)
     * <LI>MODIFICATION_CONTENT (specifies an entry to be modified)
     * <LI>MODDN_CONTENT (specifies a change to the RDN or DN of an entry)
     * </UL>
     */
    public int getType();

    /**
     * Retrieves the list of controls specified in the content
     * of the LDIF record, if any
     * @return an array of <CODE>LDAPControl</CODE> objects that
     * represent any controls specified in the the LDIF record,
     * or <CODE>null</CODE> if none were specified.
     */
    public LDAPControl[] getControls();

    /**
     * Sets the list of controls
     * @param controls an array of <CODE>LDAPControl</CODE> objects
     * or <CODE>null</CODE> if none are to be specified
     */
    public void setControls( LDAPControl[] controls );

    /**
     * Returns the string representation of the content of the LDIF record.
     * @return string representation of the content of the LDIF record.
     */
    public String toString();
}
