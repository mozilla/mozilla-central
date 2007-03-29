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
package org.ietf.ldap.controls;

import org.ietf.ldap.LDAPControl;

/**
 * Represents an LDAP v3 server control that contains a string as its
 * only value. This is to be used as a base class by real such controls.
 */
abstract class LDAPStringControl extends LDAPControl {
    protected String m_msg = null;

    LDAPStringControl() {
      super();
    }

    /**
     * Constructs an <CODE>LDAPStringControl</CODE> object, and stores the 
     * value as a string. To retrieve this string value, use 
     * <CODE>getMsg()</CODE>.
     * @param oid the oid of this control
     * @param critical <code>true</code> if this control is critical to the search
     * @param value the value associated with this control
     * @see org.ietf.ldap.LDAPcontrol
     */
    public LDAPStringControl( String oid, boolean critical, byte[] value ) {
        super( oid, critical, value );
	
	if ( value != null ) {
	    try {  
	        m_msg = new String( value, "UTF8" );
	    } catch ( java.io.IOException e ) {
	    }
	}
    }

    /**
     * Parses a response control sent by the server and
     * retrieves a string.
     * <P>
     *
     * You can get the controls returned by the server by using the
     * <CODE>getResponseControls</CODE> method of the
     * <CODE>LDAPConnection</CODE> class.
     * <P>
     *
     * @param controls an array of <CODE>LDAPControl</CODE> objects,
     * representing the controls returned by the server
     * after a search. To get these controls, use the
     * <CODE>getResponseControls</CODE> method of the
     * <CODE>LDAPConnection</CODE> class.
     * @param type the OID of the control to look for
     * @return a message string, or null if the server did
     * not return a string.
     * @see org.ietf.ldap.LDAPConnection#getResponseControls
     */
    public static String parseResponse( LDAPControl[] controls, String type ) {
        String msg = null;
        LDAPControl cont = null;
        /* See if there is a password control in the array */
        for( int i = 0; (controls != null) && (i < controls.length); i++ ) {
            if ( controls[i].getID().equals( type ) ) {
                cont = controls[i];
                break;
            }
        }
        if ( cont != null ) {
            /* Suck out the data and return it */
            try {
                msg = new String( cont.getValue(), "UTF8" );
            } catch ( Exception e ) {
            }
        }
        return msg;
    }
}
