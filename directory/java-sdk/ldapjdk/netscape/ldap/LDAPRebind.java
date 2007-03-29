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

/**
 * Specifies how to retrieve authentication information automatically
 * for referrals. If you have set up the search constraints (or the options
 * in the <CODE>LDAPConnection</CODE> object) to use automatic referral,
 * you must define a class that implements this interface.
 * <P>
 *
 * If no class implements this interface, clients that follow automatic
 * referrals are authenticated anonymously to subsequent LDAP servers.
 * The following example is a simple class that implements this interface.
 * Objects of the myLDAPRebind class check the host and port of the 
 * referred LDAP server.  If the host and port are "alway.mcom.com:389", 
 * the directory manager's name and password are used to authenticate.
 * For all other LDAP servers, anonymous authentication is used.
 *
 * <PRE>
 * public class myLDAPRebind implements netscape.ldap.LDAPRebind
 * {
 *  private String myDN;
 *  private String myPW;
 *  private LDAPRebindAuth myRebindInfo;

 *  public myLDAPRebind () {
 *    myDN = "c=Directory Manager,o=Universal Exports,c=UK";
 *    myPW = "alway4444";
 *  }
 *
 *  public LDAPRebindAuth getRebindAuthentication( String host, int port ) {
 *    if ( host.equalsIgnoreCase( "alway.mcom.com" ) && ( port == 389 ) ) {
 *      myRebindInfo = new LDAPRebindAuth( myDN, myPW );
 *    } else {
 *      myRebindInfo = new LDAPRebindAuth( "", "" );
 *    }
 *    return myRebindInfo;
 *  }
 * } </PRE>
 *
 *
 * @version 1.0
 */
public interface LDAPRebind {

    /**
     * Returns an <CODE>LDAPRebindAuth</CODE> object, which the calling function
     * can use to get the DN and password to use for authentication (if the client
     * is set up to follow referrals automatically).
     * @return LDAPRebindAuth object containing authentication information.
     * @see netscape.ldap.LDAPRebindAuth
     */
    public LDAPRebindAuth getRebindAuthentication(String host,
      int port);
}
