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
 * Represents information used to authenticate the client in cases where
 * the client follows referrals automatically.  If you are defining a class
 * that implements the <CODE>LDAPRebind</CODE> interface, your implementation
 * of the <CODE>LDAPRebind.getRebindAuthentication</CODE> method needs to
 * construct and return an object of this class.
 * <P>
 *
 * For example, the following method sets up authentication information based
 * on the LDAP server identified in the referral.  Ideally, this method would be
 * defined as part of a class implementing the <CODE>LDAPRebind</CODE> interface.
 *
 * <PRE>
 * private String myDN = "cn=Directory Manager,o=Ace Industry,c=US";
 * private String myPW = "alway4444";
 * private LDAPRebindAuth myRebindInfo;
 * ...
 * public LDAPRebindAuth getRebindAuthentication( String host, int port ) {
 *  if ( host.equalsIgnoreCase( "alway.mcom.com" ) && ( port == 389 ) ) {
 *      myRebindInfo = new LDAPRebindAuth( myDN, myPW );
 *  } else {
 *      myRebindInfo = new LDAPRebindAuth( "", "" );
 *  }
 *  return myRebindInfo;
 * } </PRE>
 *
 * @version 1.0
 * @see netscape.ldap.LDAPRebind
 */
public class LDAPRebindAuth implements java.io.Serializable {

    static final long serialVersionUID = 7161655313564756294L;
    private String m_dn;
    private String m_password;

    /**
     * Constructs information that is used by the client
     * for authentication when following referrals automatically.
     * @param dn distinguished name to use for authenticating to
     * the LDAP server during an automatic referral (if the client
     * is set up to follow referrals automatically)
     * @param password password to use for authenticating to
     * the LDAP server during an automatic referral (if the client
     * is set up to follow referrals automatically)
     */
    public LDAPRebindAuth(String dn, String password) {
        m_dn = dn;
        m_password = password;
    }

    /**
     * Returns the distinguished name to be used for reauthentication,
     * if the client is set up to follow referrals automatically.
     * @return distinguished name to use when authenticating to
     * other LDAP servers during referrals.
     */
    public String getDN() {
        return m_dn;
    }

    /**
     * Returns the password to be used for reauthentication,
     * if the client is set up to follow referrals automatically.
     * @return password to use when authenticating to other
     * LDAP servers during referrals.
     */
    public String getPassword() {
        return m_password;
    }
}
