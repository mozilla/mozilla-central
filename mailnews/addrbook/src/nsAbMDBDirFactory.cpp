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
 *   Paul Sandoz <paul.sandoz@sun.com>
 *   Csaba Borbola <csaba.borbola@sun.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Mark Banner <mark@standard8.demon.co.uk>
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

#include "nsAbMDBDirFactory.h"
#include "nsAbUtils.h"

#include "nsIRDFService.h"
#include "nsIRDFResource.h"
#include "nsRDFResource.h"
#include "nsServiceManagerUtils.h"
#include "nsILocalFile.h"
#include "nsIAbManager.h"
#include "nsIAbMDBDirectory.h"
#include "nsAbMDBDirFactory.h"
#include "nsIAddrDBListener.h"
#include "nsIAddrDatabase.h"
#include "nsEnumeratorUtils.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsAbBaseCID.h"

NS_IMPL_ISUPPORTS1(nsAbMDBDirFactory, nsIAbDirFactory)

nsAbMDBDirFactory::nsAbMDBDirFactory()
{
}

nsAbMDBDirFactory::~nsAbMDBDirFactory()
{
}

NS_IMETHODIMP nsAbMDBDirFactory::GetDirectories(const nsAString &aDirName,
                                                const nsACString &aURI,
                                                const nsACString &aPrefName,
                                                nsISimpleEnumerator **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  
  nsresult rv;

  nsCOMPtr<nsIRDFService> rdf = do_GetService (NS_RDF_CONTRACTID "/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFResource> resource;
  rv = rdf->GetResource(aURI, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(resource, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = directory->SetDirPrefId(aPrefName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILocalFile> dbPath;
  rv = abManager->GetUserProfileDirectory(getter_AddRefs(dbPath));

  nsCOMPtr<nsIAddrDatabase> listDatabase;
  if (NS_SUCCEEDED(rv))
  {
    nsCAutoString fileName;
      
    if (StringBeginsWith(aURI, NS_LITERAL_CSTRING(kMDBDirectoryRoot)))
      fileName = Substring(aURI, kMDBDirectoryRootLen, aURI.Length() - kMDBDirectoryRootLen);

    rv = dbPath->AppendNative(fileName);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAddrDatabase> addrDBFactory = do_GetService(NS_ADDRDATABASE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = addrDBFactory->Open(dbPath, PR_TRUE, PR_TRUE, getter_AddRefs(listDatabase));
  }
  NS_ENSURE_SUCCESS(rv, rv);

  rv = listDatabase->GetMailingListsFromDB(directory);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_NewSingletonEnumerator(_retval, directory);
}

/* void deleteDirectory (in nsIAbDirectory directory); */
NS_IMETHODIMP nsAbMDBDirFactory::DeleteDirectory(nsIAbDirectory *directory)
{
    if (!directory)
        return NS_ERROR_NULL_POINTER;
    
    nsresult rv = NS_OK;

    nsCOMPtr<nsIMutableArray> pAddressLists;
    rv = directory->GetAddressLists(getter_AddRefs(pAddressLists));
    NS_ENSURE_SUCCESS(rv, rv);

    PRUint32 total;
    rv = pAddressLists->GetLength(&total);
    NS_ENSURE_SUCCESS(rv, rv);

    for (PRUint32 i = 0; i < total; i++)
    {
        nsCOMPtr<nsIAbDirectory> listDir(do_QueryElementAt(pAddressLists, i, &rv));
        if (NS_FAILED(rv))
            break;

        nsCOMPtr<nsIAbMDBDirectory> dblistDir(do_QueryInterface(listDir, &rv));
        if (NS_FAILED(rv))
            break;

        rv = directory->DeleteDirectory(listDir);
        if (NS_FAILED(rv))
            break;

        rv = dblistDir->RemoveElementsFromAddressList();
        if (NS_FAILED(rv))
            break;
    }
    pAddressLists->Clear();

    nsCOMPtr<nsIAbMDBDirectory> dbdirectory(do_QueryInterface(directory, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    return dbdirectory->ClearDatabase();
}

