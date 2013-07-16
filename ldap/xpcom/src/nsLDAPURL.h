/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ldap.h"
#include "nsStringGlue.h"
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
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIURI
  NS_DECL_NSILDAPURL

  nsLDAPURL();
  virtual ~nsLDAPURL();

protected:

  void GetPathInternal(nsCString &aPath);
  nsresult SetPathInternal(const nsCString &aPath);
  nsresult SetAttributeArray(char** aAttributes);

  nsCString mDN;                // Base Distinguished Name (Base DN)
  int32_t mScope;               // Search scope (base, one or sub)
  nsCString mFilter;            // LDAP search filter
  uint32_t mOptions;            // Options
  nsCString mAttributes;
  nsCOMPtr<nsIURI> mBaseURL;
};
