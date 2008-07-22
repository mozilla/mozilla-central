/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
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
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Csaba Borbola <csaba.borbola@sun.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "nsAbLDAPDirFactory.h"
#include "nsAbUtils.h"

#include "nsServiceManagerUtils.h"
#include "nsIRDFService.h"
#include "nsIRDFResource.h"

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
  nsCOMPtr<nsIRDFService> rdf = do_GetService (NS_RDF_CONTRACTID "/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFResource> resource;
  if (Substring(aURI, 0, 5).EqualsLiteral("ldap:") ||
      Substring(aURI, 0, 6).EqualsLiteral("ldaps:")) {
    /*
     * if the URI starts with ldap: or ldaps:
     * then this directory is an LDAP directory.
     *
     * we don't want to use the ldap:// or ldaps:// URI 
     * as the RDF resource URI because the ldap:// or ldaps:// URI 
     * will contain the hostname, basedn, port, etc.
     * so if those attributes changed, we'll run into the
     * the same problem that we hit with changing username / hostname
     * for mail servers.  to solve this problem, we add an extra
     * level of indirection.  the RDF resource URI that we generate
     * (the bridge URI) will be moz-abldapdirectory://<prefName>
     * and when we need the hostname, basedn, port, etc,
     * we'll use the <prefName> to get the necessary prefs.
     * note, <prefName> does not change.
     */
    nsCAutoString bridgeURI;
    bridgeURI = NS_LITERAL_CSTRING(kLDAPDirectoryRoot);
    bridgeURI += aPrefName;
    rv = rdf->GetResource(bridgeURI, getter_AddRefs(resource));
  }
  else {
    rv = rdf->GetResource(aURI, getter_AddRefs(resource));
  }
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(resource, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_NewSingletonEnumerator(aDirectories, directory);
}

/* void deleteDirectory (in nsIAbDirectory directory); */
NS_IMETHODIMP nsAbLDAPDirFactory::DeleteDirectory(nsIAbDirectory *directory)
{
    // No actual deletion - as the LDAP Address Book is not physically
    // created in the corresponding CreateDirectory() unlike the Personal
    // Address Books. But we still need to return NS_OK from here.
    return NS_OK;
}

