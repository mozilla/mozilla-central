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

import java.util.Vector;
import org.ietf.ldap.LDAPModification;

/**
 * An object of this class represents the content of an LDIF record that
 * specifies modifications to an entry.  This class implements the
 * <CODE>LDIFContent</CODE> interface.
 * <P>
 *
 * To get this object from an <CODE>LDIFRecord</CODE> object,
 * use the <CODE>getContent</CODE> method and cast the return value as
 * <CODE>LDIFModifyContent</CODE>.
 * <P>
 *
 * @version 1.0
 * @see org.ietf.ldap.util.LDIFRecord#getContent
 */
public class LDIFModifyContent extends LDIFBaseContent {
    /**
     * Internal variables
     */
    private Vector m_mods = new Vector();
    static final long serialVersionUID = -710573832339780084L;

    /**
     * Constructs an empty <CODE>LDIFModifyContent</CODE> object.
     * To specify the modifications to be made to the entry, use
     * the <CODE>addElement</CODE> method.
     * @see org.ietf.ldap.util.LDIFModifyContent#addElement
     */
    public LDIFModifyContent() {
    }

    /**
     * Returns the content type. You can use this with the
     * <CODE>getContent</CODE> method of the <CODE>LDIFRecord</CODE>
     * object to determine the type of content specified in the record.
     * @return the content type (which is
     * <CODE>LDIFContent.MODIFICATION_CONTENT</CODE>).
     * @see org.ietf.ldap.util.LDIFRecord#getContent
     */
    public int getType() {
        return MODIFICATION_CONTENT;
    }

    /**
     * Specifies an additional modification that should be made to
     * the entry.
     * @param mod <CODE>LDAPModification</CODE> object representing
     * the change to make to the entry
     * @see org.ietf.ldap.LDAPModification
     */
    public void addElement(LDAPModification mod) {
        m_mods.addElement(mod);
    }

    /**
     * Retrieves the list of the modifications specified in the content
     * of the LDIF record.
     * @return an array of <CODE>LDAPModification</CODE> objects that
     * represent the modifications specified in the content of the LDIF record.
     * @see org.ietf.ldap.LDAPModification
     */
    public LDAPModification[] getModifications() {
        LDAPModification mods[] = new LDAPModification[m_mods.size()];
        for (int i = 0; i < m_mods.size(); i++) {
            mods[i] = (LDAPModification)m_mods.elementAt(i);
        }
        return mods;
    }

    /**
     * Returns the string representation of the content of the LDIF record.
     * @return the string representation of the content of the LDIF record.
     */
    public String toString() {
        String s = "";
        for (int i = 0; i < m_mods.size(); i++) {
            s = s + ((LDAPModification)m_mods.elementAt(i)).toString();
        }
        if ( getControls() != null ) {
            s += getControlString();
        }
        return "LDIFModifyContent {" + s + "}";
    }
}
