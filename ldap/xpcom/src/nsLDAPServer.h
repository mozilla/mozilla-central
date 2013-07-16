/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsILDAPServer.h"
#include "nsILDAPURL.h"

// 8bbbaa54-f316-4271-87c3-d52b5b1c1f5b
#define NS_LDAPSERVER_CID \
{ 0x8bbbaa54, 0xf316, 0x4271, \
  { 0x87, 0xc3, 0xd5, 0x2b, 0x5b, 0x1c, 0x1f, 0x5b}}

class nsLDAPServer : public nsILDAPServer
{
  public:
    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSILDAPSERVER

    // Constructor & destructor
    //
    nsLDAPServer();
    virtual ~nsLDAPServer();

  protected:
    nsString mKey;          // Unique identifier for this server object
    nsCString mUsername;    // Username / UID
    nsCString mPassword;    // Password to bind with
    nsCString mBindDN;      // DN associated with the UID above
    uint32_t mSizeLimit;    // Limit the LDAP search to this # of entries
    uint32_t mProtocolVersion;  // What version of LDAP to use?
    // This "links" to a LDAP URL object, which holds further information
    // related to the LDAP server. Like Host, port, base-DN and scope.
    nsCOMPtr<nsILDAPURL> mURL;
};
