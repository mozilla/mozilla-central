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

import java.io.*;
import org.ietf.ldap.LDAPControl;
import org.ietf.ldap.LDAPSortKey;
import org.ietf.ldap.client.JDAPBERTagDecoder;
import org.ietf.ldap.ber.stream.*;

/**
 * Represents an LDAP v3 server control that specifies that you want
 * the server to use the specified DN's identity for this operation.
 * (The OID for this control is 2.16.840.1.113730.3.4.12.)
 * <P>
 *
 * You can include the control in any request by constructing
 * an <CODE>LDAPSearchConstraints</CODE> object and calling the
 * <CODE>setControls</CODE> method.  You can then pass this
 * <CODE>LDAPSearchConstraints</CODE> object to the <CODE>search</CODE>
 * or other request method of an <CODE>LDAPConnection</CODE> object.
 * <P>
 *
 * For example:
 * <PRE>
 * ...
 * LDAPConnection ld = new LDAPConnection();
 * try {
 *     // Connect to server.
 *     ld.connect( 3, hostname, portnumber, "", "" );
 *
 *     // Create a "critical" proxied auth server control using
 *     // the DN "uid=charlie,ou=people,o=acme.com".
 *     LDAPProxiedAuthControl ctrl =
 *         new LDAPProxiedAuthControl( "uid=charlie,ou=people,o=acme.com",
 *                                     true );
 *
 *     // Create search constraints to use that control.
 *     LDAPSearchConstraints cons = new LDAPSearchConstraints();
 *     cons.setControls( sortCtrl );
 *
 *     // Send the search request.
 *     LDAPSearchResults res = ld.search( "o=Airius.com",
 *        LDAPConnection.SCOPE_SUB, "(cn=Barbara*)", null, false, cons );
 *
 *     ...
 *
 * </PRE>
 *
 * <P>
 *
 * @version 1.0
 * @see org.ietf.ldap.LDAPControl
 * @see org.ietf.ldap.LDAPConstraints
 * @see org.ietf.ldap.LDAPSearchConstraints
 * @see org.ietf.ldap.LDAPConstraints#setControls(LDAPControl)
 */
public class LDAPProxiedAuthControl extends LDAPControl {
    public final static String PROXIEDAUTHREQUEST  =
                                            "2.16.840.1.113730.3.4.12";

    private String _dn;
    
    /**
     * Constructs an <CODE>LDAPProxiedAuthControl</CODE> object with a
     * DN to use as identity.
     * @param dn DN to use as identity for execution of a request
     * @param critical <CODE>true</CODE> if the LDAP operation should be
     * discarded when the server does not support this control (in other
     * words, this control is critical to the LDAP operation)
     * @see org.ietf.ldap.LDAPControl
     */
    public LDAPProxiedAuthControl( String dn,
                                   boolean critical) {
        super( PROXIEDAUTHREQUEST, critical, null );
        _value = createSpecification( _dn = dn );
    }

    /**
     * Create a "flattened" BER encoding of the requested contents,
     * and return it as a byte array.
     * @param dn the DN to use as an identity
     * @return the byte array of encoded data.
     */
    private byte[] createSpecification( String dn ) {
        /* A sequence */
        BERSequence ber = new BERSequence();
        /* Add the DN as a string value */
        ber.addElement( new BEROctetString( dn ) );
        /* Suck out the data and return it */
        return flattenBER( ber );
    }

    public String toString() {
         StringBuffer sb = new StringBuffer("{ProxiedAuthCtrl:");
        
        sb.append(" isCritical=");
        sb.append(isCritical());
        
        sb.append(" dn=");
        sb.append(_dn);
        
        sb.append("}");

        return sb.toString();
    }
}

