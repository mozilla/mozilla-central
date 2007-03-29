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
 * Portions created by the Initial Developer are Copyright (C) 2001
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

import org.ietf.ldap.*;
import org.ietf.ldap.util.*;
import org.ietf.ldap.controls.*;

/**
 * LDAPTool
 * Base class for LDAP command-line tools
 *
 * @version 1.0
 * @author Rob Weltman
 **/
class LDAPTool {

	/**
	 * This function is to extract specified parameters from the
	 * arguments list.
	 * @param args list of args
	 */
    protected static GetOpt extractParameters(String privateOpts, String args[]) { 

		GetOpt options = new GetOpt("vnRMD:h:O:p:w:d:V:y:" + privateOpts, args);

		if (options.hasOption('n'))
			m_justShow = true;

		if (options.hasOption('v'))
			m_verbose = true;

		if (options.hasOption('R'))
			m_referrals = false;

		/* -D bind DN */
		if (options.hasOption('D'))
			m_binddn = options.getOptionParam('D');

		/* -h ldap host */
		if (options.hasOption('h'))
			m_ldaphost = options.getOptionParam('h');
      
		/* -p ldap port */
		if (options.hasOption('p')) { /* if the option is -p */
			try {
				m_ldapport = Integer.parseInt(options.getOptionParam('p'));
			} catch (NumberFormatException e) {
				m_ldapport = 389;
			}
		} /* if the option is -p */

		/* -O hop limit */
		if (options.hasOption('O')) { /* if the option is -O */
			try {
				m_hopLimit = Integer.parseInt(options.getOptionParam('O'));
			} catch (NumberFormatException e) {
				m_hopLimit = 10;
			}
		} /* if the option is -O */

		/* -d debug level */
		if (options.hasOption('d')) { /* if the option is -d */
			try {
				m_debugLevel = Integer.parseInt(options.getOptionParam('d'));
			} catch (NumberFormatException e) {
				m_debugLevel = 0;
			}
		} /* if the option is -d */

		/* -V ldap protocol version */
		if (options.hasOption('V')) { /* if the option is -V */
			try {
				m_version = Integer.parseInt(options.getOptionParam('V'));
			} catch (NumberFormatException e) {
				m_version = 3;
			}
		} /* if the option is -V */

		/* -w bind password */
		if (options.hasOption('w'))
			m_passwd = options.getOptionParam('w');

        /* -y proxy DN */
        if (options.hasOption('y'))
            m_proxyControl = new LDAPProxiedAuthControl(
                options.getOptionParam('y'), true );

		/* -M treat ref attribute as ordinary entry */
		if (options.hasOption('M'))
			m_ordinary = true;
        return options;
	}

    protected static void setDefaultReferralCredentials(
		LDAPConstraints cons ) {
		LDAPAuthHandler rebind = new LDAPAuthHandler() {
			public LDAPAuthProvider getAuthProvider(
				String host,
				int port ) {
					return new LDAPAuthProvider( 
						m_client.getAuthenticationDN(),
						m_passwd.getBytes() );
				}
		};
		cons.setReferralFollowing( true );
		cons.setReferralHandler( rebind );
	}

  protected static int m_ldapport = 389;
  protected static String m_binddn = null;
  protected static String m_ldaphost = "localhost";
  protected static String m_passwd = null;
  protected static int m_version = 3;
  protected static int m_debugLevel = 0;
  protected static int m_hopLimit = 10;
  protected static boolean m_referrals = true;
  protected static LDAPConnection m_client = null;
  protected static boolean m_justShow = false;
  protected static boolean m_verbose = false;
  protected static boolean m_ordinary = false;
  protected static LDAPControl m_proxyControl = null;
}
