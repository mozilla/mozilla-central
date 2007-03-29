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
package com.netscape.sasl;

import java.util.Hashtable;
import javax.security.auth.callback.CallbackHandler;

/**
 * An interface for creating instances of <tt>SaslClient</tt>.
 * 
 * @see SaslClient
 * @see Sasl
 */
public class ClientFactory implements SaslClientFactory {
    public ClientFactory() {
        _mechanismTable = new Hashtable();
        for( int i = 0; i < _mechanismNames.length; i++ ) {
            _mechanismTable.put( _mechanismNames[i].toLowerCase(),
                                 PACKAGENAME + '.' +
                                 _mechanismClasses[i] );
        }
    }
    /**
     * Creates a SaslClient using the parameters supplied.
     *
     * @param mechanisms The non-null list of mechanism names to try.
     * Each is the IANA-registered name of a SASL mechanism. (e.g.
     * "GSSAPI", "CRAM-MD5").
     * @param authorizationId The possibly null authorization ID to
     * use. When the SASL authentication completes successfully, the
     * entity named by authorizationId is granted access. 
     * @param protocol The non-null string name of the protocol for
     * which the authentication is being performed (e.g., "ldap").
     * @param serverName The non-null string name of the server to
     * which we are creating an authenticated connection.
     * @param props The possibly null properties to be used by the SASL
     * mechanisms to configure the authentication exchange. For example,
     * "javax.security.sasl.encryption.maximum" might be used to
     * specify the maximum key length to use for encryption.
     * @param cbh The possibly null callback handler to used by the
     * SASL mechanisms to get further information from the
     * application/library to complete the authentication. For example,
     * a SASL mechanism might require the authentication ID and
     * password from the caller.
     * @return A possibly null <tt>SaslClient</tt> created using the
     * parameters supplied. If null, this factory cannot produce a
     * <tt>SaslClient</tt> using the parameters supplied.
     * @exception SaslException if it cannot create a
     * <tt>SaslClient</tt> because of an error.
     */
    public SaslClient createSaslClient(
        String[] mechanisms,
        String authorizationId,
        String protocol,
        String serverName,
        Hashtable props,
        CallbackHandler cbh ) throws SaslException {
        String mechName = null;
        if ( Sasl.debug ) {
            System.out.println(
                "ClientFactory.createSaslClient" );
        }
        for( int i = 0; (mechName == null) &&
                        (i < mechanisms.length); i++ ) {
            mechName = (String)_mechanismTable.get( mechanisms[i].toLowerCase() );
        }
        if ( mechName != null ) {
            try {
                Class c = Class.forName( mechName );
                SaslClient client = (SaslClient)c.newInstance();
                if ( Sasl.debug ) {
                    System.out.println(
                        "ClientFactory.createSaslClient: newInstance for " +
                        mechName + " returned " + client);
                }
                return client;
            } catch ( Exception e ) {
                System.err.println(
                    "ClientFactory.createSaslClient: " + e );
            }
        } else {
            if ( Sasl.debug ) {
                System.out.println(
                    "ClientFactory.createSaslClient: does not support " +
                    "any of the mechanisms" );
                for( int i = 0; i < mechanisms.length; i++ ) {
                    System.out.println( "  " +  mechanisms[i] );
                }
            }
        }
        return null;
    }

    /**
     * Returns an array of names of mechanisms supported by this
     * factory.
     * @return A non-null array containing IANA-registered SASL
     * mechanism names.
     */
     public String[] getMechanismNames() {
         return _mechanismNames;
     }

    private final String PACKAGENAME = "com.netscape.sasl.mechanisms";
    private final String[] _mechanismNames = { "EXTERNAL" };
    private final String[] _mechanismClasses = { "SaslExternal" };
    private Hashtable _mechanismTable;
}
