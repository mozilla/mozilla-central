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
package netscape.ldap;

import java.util.*;
import java.io.*;
import java.net.*;

/**
 * Represents a socket connection that you can use to connect to an
 * LDAP server.  You can write a class that implements this interface
 * if you want to use a TLS socket to connect to a secure server.
 * (The <CODE>LDAPSSLSocketFactory class</CODE>, which is included
 * in the <CODE>netscape.ldap</CODE> package, implements this
 * interface for SSL connections.)
 * <P>
 *
 * When you construct a new <CODE>LDAPConnection</CODE>
 * object, you can specify that the connection use this socket. 
 * To do this, pass the constructor an object of the class that 
 * implements this interface.
 * <P>
 *
 * @version 1.0
 * @see LDAPConnection#LDAPConnection(netscape.ldap.LDAPSocketFactory)
 * @see LDAPSSLSocketFactory
 */
public interface LDAPSocketFactory {
    /**
     * Returns a socket to the specified host name and port number.
     * <P>
     *
     * @param host name of the host to which you want to connect
     * @param port port number to which you want to connect
     * @exception LDAPException Failed to create the socket.
     * @see LDAPSSLSocketFactory#makeSocket(java.lang.String,int)
     */
    public Socket makeSocket(String host, int port)
        throws LDAPException;
}
