/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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
 * The Original Code is the mozilla.org LDAP XPCOM SDK.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mosedale <dmose@mozilla.org>
 *   Leif Hedstrom <leif@netscape.com>
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

#include "ldap.h"
#include "nsString.h"
#include "nsVoidArray.h"
#include "nsILDAPURL.h"
#include "nsCOMPtr.h"

// cb7c67f8-0053-4072-89e9-501cbd1b35ab
#define NS_LDAPURL_CID \
{ 0xcb7c67f8, 0x0053, 0x4072, \
  { 0x89, 0xe9, 0x50, 0x1c, 0xbd, 0x1b, 0x35, 0xab}}

/**
 * nsLDAPURL
 *
 * nsLDAPURL uses an nsStandardURL stored in mBaseURL as its main url formatter.
 * 
 * This is done to ensure that the pre-path sections of the URI are correctly
 * formatted and to re-use the functions for nsIURI as appropriate.
 *
 * Handling of the path sections of the URI are done within nsLDAPURL/parts of
 * the LDAP c-sdk. nsLDAPURL holds the individual sections of the path of the
 * URI locally (to allow convenient get/set), but always updates the mBaseURL
 * when one changes to ensure that mBaseURL.spec and the local data are kept
 * consistent.
 */

class nsLDAPURL : public nsILDAPURL
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIURI
  NS_DECL_NSILDAPURL

  nsLDAPURL();
  virtual ~nsLDAPURL();

protected:

  void GetPathInternal(nsCString &aPath);
  nsresult SetPathInternal(const nsCString &aPath);

  nsCString mDN;                // Base Distinguished Name (Base DN)
  PRInt32 mScope;               // Search scope (base, one or sub)
  nsCString mFilter;            // LDAP search filter
  PRUint32 mOptions;            // Options
  nsCStringArray mAttributes;  // List of attributes
  nsCOMPtr<nsIURI> mBaseURL;
};
