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
package netscape.ldap.controls;

import netscape.ldap.LDAPControl;
import netscape.ldap.LDAPException;

/**
 * Represents an LDAP v3 server control that may be returned if a
 * password has expired, and password policy is enabled on the server.
 * The OID for this control is 2.16.840.1.113730.3.4.4.
 * <P>
 *
 * @version 1.0
 * @see netscape.ldap.LDAPControl
 */
public class LDAPPasswordExpiredControl extends LDAPStringControl {
    public final static String EXPIRED = "2.16.840.1.113730.3.4.4";

    /**
     * Contructs an <CODE>LDAPPasswordExpiredControl</CODE> object. 
     * This constructor is used by <CODE>LDAPControl.register</CODE> to 
     * instantiate password expired controls.
     * <P>
     * To retrieve the message from the server, call <CODE>getMessage</CODE>.
     * @param oid this parameter must be equal to 
     * <CODE>LDAPPasswordExpiredControl.EXPIRED</CODE>
     * or an <CODE>LDAPException</CODE> is thrown
     * @param critical <code>true</code> if this control is critical
     * @param value the value associated with this control
     * @exception netscape.ldap.LDAPException If oid is not 
     * <CODE>LDAPPasswordExpiredControl.EXPIRED</CODE>.
     * @see netscape.ldap.LDAPControl#register
     */
    public LDAPPasswordExpiredControl( String oid, boolean critical, 
                                       byte[] value ) throws LDAPException {
        super( EXPIRED, critical, value );
	if ( !oid.equals( EXPIRED )) {
	    throw new LDAPException( "oid must be LDAPPasswordExpiredControl." +
				     "PWEXPIRED", LDAPException.PARAM_ERROR);
	}

    }

    /**
     * @param controls an array of <CODE>LDAPControl</CODE> objects,
     * representing the controls returned by the server
     * after a search. To get these controls, use the
     * <CODE>getResponseControls</CODE> method of the
     * <CODE>LDAPConnection</CODE> class.
     * @return an error message string, or null if none is in the control.
     * @see netscape.ldap.LDAPConnection#getResponseControls
     * @deprecated LDAPPasswordExpiredControl controls are now automatically
     * instantiated.
     */
    public static String parseResponse( LDAPControl[] controls ) {
        return LDAPStringControl.parseResponse( controls, EXPIRED );
    }
 
    /**
     * Gets the message returned by the server with this control.
     * @return the message returned by the server.
     */    
    public String getMessage() {
        return m_msg;
    }
    
    public String toString() {
         StringBuffer sb = new StringBuffer("{PasswordExpiredCtrl:");
        
        sb.append(" isCritical=");
        sb.append(isCritical());
        
        sb.append(" msg=");
        sb.append(m_msg);
        
        sb.append("}");

        return sb.toString();
    }

}




