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
package netscape.ldap.beans;

import netscape.ldap.*;
import netscape.ldap.beans.LDAPBasePropertySupport;
import java.io.Serializable;
import java.awt.event.*;

/**
 * Invisible Bean that just authenticates a user with a Directory
 * Server and returns Y or N. It takes a host and port, and then either
 * a full distinguished name and password, an RDN and directory base, or
 * a cn value and directory base.
 * <BR><BR>
 * Optionally, a client can register as
 * a PropertyChangeListener and will be notified when an authentication
 * completes.
 * <BR><BR>
 * The Bean can be used from JavaScript, as in the following example
 * where the parameters are taken from HTML text fields in an HTML
 * form called "input":
 * <PRE>
 * <XMP>
 * <SCRIPT LANGUAGE="JavaScript">
 * function checkAuthentication() {
 *     auth = new Packages.netscape.ldap.beans.LDAPSimpleAuth();
 *     auth.setHost( document.input.host.value );
 *     auth.setPort( parseInt(document.input.port.value) );
 *     auth.setAuthDN( document.input.username.value );
 *     auth.setAuthPassword( document.input.password.value );
 *     result = auth.authenticate();
 *     alert( "The response is: " + result );
 * }
 * </SCRIPT>
 * </XMP>
 *</PRE>
 */

public class LDAPSimpleAuth extends LDAPBasePropertySupport implements
  Serializable {

    /**
     * Constructor with no parameters
     */
    public LDAPSimpleAuth() {}

    /**
    * Constructor with host and port initializers
    * @param theHost host string
    * @param thePort port number
    */
    public LDAPSimpleAuth( String theHost,
                           int thePort ) {
        setHost( theHost );
        setPort( thePort );
    }

    /**
    * Constructor with all required authentication parameters
    * @param theHost host string
    * @param thePort port number
    * @param dn fully qualified distinguished name to authenticate
    * @param password password for authenticating the dn
    */
    public LDAPSimpleAuth( String theHost,
                           int thePort,
                           String dn,
                           String password ) {
        setHost( theHost );
        setPort( thePort );
        setAuthDN( dn );
        setAuthPassword( password );
    }

    private void notifyResult( String newResult ) {
        firePropertyChange( "result", result, newResult );
        result = newResult;
    }

    /**
     * Connect to LDAP server using parameters specified in
     * constructor and/or by setting properties and attempt to
     * authenticate.
     * @return "Y" on successful authentication, "N" otherwise
     */
    public String authenticate() {
        LDAPConnection m_ldc = null;
        String result = "N";
        try {
            m_ldc = new LDAPConnection();
            System.out.println("Connecting to " + getHost() +
                               " " + getPort());
            connect( m_ldc, getHost(), getPort());
        } catch (Exception e) {
            System.out.println( "Failed to connect to " + getHost() +
                                ": " + e.toString() );
        }
        if ( m_ldc.isConnected() ) {
            System.out.println( "Authenticating " + getAuthDN() );
            try {
                m_ldc.authenticate( getAuthDN(), getAuthPassword() );
                result = "Y";
            } catch (Exception e) {
                System.out.println( "Failed to authenticate to " +
                                    getHost() + ": " + e.toString() );
            }
        }

        try {
            if ( (m_ldc != null) && m_ldc.isConnected() )
                m_ldc.disconnect();
        } catch ( Exception e ) {
        }

        notifyResult( result );
        return result;
    }

    /**
     * Connect to LDAP server using parameters specified in
     * constructor and/or by setting properties and attempt to
     * authenticate.
     * @param dn fully qualified distinguished name to authenticate
     * @param password password for authenticating the dn
     * @return "Y" on successful authentication, "N" otherwise
     */
    public String authenticate( String dn,
                                String password ) {
        setAuthDN( dn );
        setAuthPassword( password );
        return authenticate();
    }

    public void authenticate( ActionEvent x) {
        authenticate();
    }

    /**
     * The main body if we run it as stand-alone application.
     * @param args list of arguments
     */
    public static void main(String args[]) {
        if (args.length != 4) {
            System.out.println( "       LDAPSimpleAuth " +
                                "host port DN password" );
            System.exit(1);
        }
        LDAPSimpleAuth app = new LDAPSimpleAuth();
        app.setHost( args[0] );
        app.setPort( java.lang.Integer.parseInt( args[1] ) );
        app.setAuthDN( args[2] );
        app.setAuthPassword( args[3] );
        String response = app.authenticate();
        System.out.println( "Response: " + response );
        System.exit(0);
    }

    /*
     * Variables
     */
    transient private String result = new String("");
}
