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

import org.ietf.ldap.LDAPAttribute;

/**
 *
 * An object of this class represents the content of an LDIF record that
 * specifies a new entry to be added.  This class implements the
 * <CODE>LDIFContent</CODE> interface.
 * <P>
 *
 * To get this object from an <CODE>LDIFRecord</CODE> object,
 * use the <CODE>getContent</CODE> method and cast the return value as
 * <CODE>LDIFAddContent</CODE>.
 * <P>
 *
 * @version 1.0
 * @see org.ietf.ldap.util.LDIFRecord#getContent
 */
public class LDIFAddContent extends LDIFBaseContent {

    /**
     * Internal variables
     */
    private LDAPAttribute m_attrs[] = null;
    static final long serialVersionUID = -665548826721177756L;

    /**
     * Constructs a new <CODE>LDIFAddContent</CODE> object with
     * the specified attributes.
     * @param attrs an array of <CODE>LDAPAttribute</CODE> objects
     * representing the attributes of the entry to be added
     */
    public LDIFAddContent(LDAPAttribute attrs[]) {
        m_attrs = attrs;
    }

    /**
     * Returns the content type. You can use this with the
     * <CODE>getContent</CODE> method of the <CODE>LDIFRecord</CODE>
     * object to determine the type of content specified in the record.
     * @return the content type (which is
     * <CODE>LDIFContent.ADD_CONTENT</CODE>).
     * @see org.ietf.ldap.util.LDIFRecord#getContent
     */
    public int getType() {
        return ADD_CONTENT;
    }

    /**
     * Retrieves the list of the attributes specified in the content
     * of the LDIF record.
     * @return an array of <CODE>LDAPAttribute</CODE> objects that
     * represent the attributes specified in the content of the LDIF record.
     */
    public LDAPAttribute[] getAttributes() {
        return m_attrs;
    }

    /**
     * Returns the string representation of the content of the LDIF record.
     * @return the string representation of the content of the LDIF record.
     */
    public String toString() {
        String s = "";
        for (int i = 0; i < m_attrs.length; i++) {
            s = s + m_attrs[i].toString();
        }
        if ( getControls() != null ) {
            s += getControlString();
        }
        return "LDIFAddContent {" + s + "}";
    }
}
