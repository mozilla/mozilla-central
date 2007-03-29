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
 *
 * An object of this class represents the content of an LDIF record.
 * This class implements the <CODE>LDIFContent</CODE> interface, but
 * it is abstract and must be extended for the various record types.
 * <P>
 *
 * @version 1.0
 * @see org.ietf.ldap.util.LDIFRecord#getContent
 */
public abstract class LDIFBaseContent
                      implements LDIFContent, java.io.Serializable {

    static final long serialVersionUID = -8542611537447295949L;

    /**
     * Internal variables
     */
    private LDAPControl[] m_controls = null;

    /**
     * Blank constructor for deserialization
     */
    public LDIFBaseContent() {
    }

    /**
     * Retrieves the list of controls specified in the content
     * of the LDIF record, if any
     * @return an array of <CODE>LDAPControl</CODE> objects that
     * represent any controls specified in the the LDIF record,
     * or <CODE>null</CODE> if none were specified.
     */
    public LDAPControl[] getControls() {
        return m_controls;
    }

    /**
     * Sets the list of controls
     * @param controls an array of <CODE>LDAPControl</CODE> objects
     * or <CODE>null</CODE> if none are to be specified
     */
    public void setControls( LDAPControl[] controls ) {
        m_controls = controls;
    }

    /**
     * Get the OIDs of all controls, if any, as a string
     *
     * @return the OIDs of all controls, if any, as a string,
     * or an empty string if there are no controls.
     */
    protected String getControlString() {
        String s = "";
        if ( getControls() != null ) {
            s += ' ';
            LDAPControl[] controls = getControls();
            int len = controls.length;
            for( int i = 0; i < len; i++ ) {
                s += controls[i].toString();
                if ( i < (len-1) ) {
                    s += ' ';
                }
            }
        }
        return s;
    }
}
