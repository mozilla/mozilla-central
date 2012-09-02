/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbLDAPDirFactory.h"
#include "nsAbUtils.h"

#include "nsServiceManagerUtils.h"
#include "nsIAbManager.h"
#include "nsIAbDirectory.h"
#include "nsAbLDAPDirectory.h"

#include "nsEnumeratorUtils.h"
#include "nsAbBaseCID.h"

NS_IMPL_ISUPPORTS1(nsAbLDAPDirFactory, nsIAbDirFactory)

nsAbLDAPDirFactory::nsAbLDAPDirFactory()
{
}

nsAbLDAPDirFactory::~nsAbLDAPDirFactory()
{
}

NS_IMETHODIMP
nsAbLDAPDirFactory::GetDirectories(const nsAString &aDirName,
                                   const nsACString &aURI,
                                   const nsACString &aPrefName,
                                   nsISimpleEnumerator **aDirectories)
{
  NS_ENSURE_ARG_POINTER(aDirectories);

  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory;
  if (Substring(aURI, 0, 5).EqualsLiteral("ldap:") ||
      Substring(aURI, 0, 6).EqualsLiteral("ldaps:")) {
    /*
     * If the URI starts with ldap: or ldaps:
     * then this directory is an LDAP directory.
     *
     * We don't want to use the ldap:// or ldaps:// URI 
     * as the URI because the ldap:// or ldaps:// URI 
     * will contain the hostname, basedn, port, etc.
     * so if those attributes changed, we'll run into the
     * the same problem that we hit with changing username / hostname
     * for mail servers.  To solve this problem, we add an extra
     * level of indirection.  The URI that we generate
     * (the bridge URI) will be moz-abldapdirectory://<prefName>
     * and when we need the hostname, basedn, port, etc,
     * we'll use the <prefName> to get the necessary prefs.
     * note, <prefName> does not change.
     */
    nsAutoCString bridgeURI;
    bridgeURI = NS_LITERAL_CSTRING(kLDAPDirectoryRoot);
    bridgeURI += aPrefName;
    rv = abManager->GetDirectory(bridgeURI, getter_AddRefs(directory));
  }
  else {
    rv = abManager->GetDirectory(aURI, getter_AddRefs(directory));
  }
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_NewSingletonEnumerator(aDirectories, directory);
}

/* void deleteDirectory (in nsIAbDirectory directory); */
NS_IMETHODIMP
nsAbLDAPDirFactory::DeleteDirectory(nsIAbDirectory *directory)
{
  // No actual deletion - as the LDAP Address Book is not physically
  // created in the corresponding CreateDirectory() unlike the Personal
  // Address Books. But we still need to return NS_OK from here.
  return NS_OK;
}
