/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbMDBDirFactory.h"
#include "nsAbUtils.h"
#include "nsStringGlue.h"
#include "nsServiceManagerUtils.h"
#include "nsIFile.h"
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

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory;
  rv = abManager->GetDirectory(aURI, getter_AddRefs(directory));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = directory->SetDirPrefId(aPrefName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> dbPath;
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

    rv = addrDBFactory->Open(dbPath, true, true, getter_AddRefs(listDatabase));
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

