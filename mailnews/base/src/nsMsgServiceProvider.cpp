/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgServiceProvider.h"
#include "nsIServiceManager.h"

#include "nsRDFCID.h"
#include "nsIRDFService.h"
#include "nsIRDFRemoteDataSource.h"

#include "nsIFileChannel.h"
#include "nsNetUtil.h"
#include "nsMsgBaseCID.h"

#include "nsMailDirServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsDirectoryServiceDefs.h"
#include "nsISimpleEnumerator.h"
#include "nsIDirectoryEnumerator.h"

static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);
static NS_DEFINE_CID(kRDFCompositeDataSourceCID, NS_RDFCOMPOSITEDATASOURCE_CID);
static NS_DEFINE_CID(kRDFXMLDataSourceCID, NS_RDFXMLDATASOURCE_CID);

nsMsgServiceProviderService::nsMsgServiceProviderService()
{}

nsMsgServiceProviderService::~nsMsgServiceProviderService()
{}

NS_IMPL_ISUPPORTS1(nsMsgServiceProviderService, nsIRDFDataSource)

nsresult
nsMsgServiceProviderService::Init()
{
  nsresult rv;
  nsCOMPtr<nsIRDFService> rdf = do_GetService(kRDFServiceCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  mInnerDataSource = do_CreateInstance(kRDFCompositeDataSourceCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  LoadISPFiles();
  return NS_OK;
}

/**
 * Looks for ISP configuration files in <.exe>\isp and any sub directories called isp
 * located in the user's extensions directory.
 */
void nsMsgServiceProviderService::LoadISPFiles()
{
  nsresult rv;
  nsCOMPtr<nsIProperties> dirSvc = do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return;

  // Walk through the list of isp directories
  nsCOMPtr<nsISimpleEnumerator> ispDirectories;
  rv = dirSvc->Get(ISP_DIRECTORY_LIST,
                   NS_GET_IID(nsISimpleEnumerator), getter_AddRefs(ispDirectories));
  if (NS_FAILED(rv))
    return;

  bool hasMore;
  nsCOMPtr<nsIFile> ispDirectory;
  while (NS_SUCCEEDED(ispDirectories->HasMoreElements(&hasMore)) && hasMore) 
  {
    nsCOMPtr<nsISupports> elem;
    ispDirectories->GetNext(getter_AddRefs(elem));

    ispDirectory = do_QueryInterface(elem);
    if (ispDirectory)
      LoadISPFilesFromDir(ispDirectory);
  }
}

void nsMsgServiceProviderService::LoadISPFilesFromDir(nsIFile* aDir)
{
  nsresult rv;

  bool check = false;
  rv = aDir->Exists(&check);
  if (NS_FAILED(rv) || !check)
    return;

  rv = aDir->IsDirectory(&check);
  if (NS_FAILED(rv) || !check)
    return;

  nsCOMPtr<nsISimpleEnumerator> e;
  rv = aDir->GetDirectoryEntries(getter_AddRefs(e));
  if (NS_FAILED(rv))
    return;

  nsCOMPtr<nsIDirectoryEnumerator> files(do_QueryInterface(e));
  if (!files)
    return;

  // we only care about the .rdf files in this directory
  nsCOMPtr<nsIFile> file;
  while (NS_SUCCEEDED(files->GetNextFile(getter_AddRefs(file))) && file) {
    nsAutoString leafName;
    file->GetLeafName(leafName);
    if (!StringEndsWith(leafName, NS_LITERAL_STRING(".rdf")))
      continue;

    nsAutoCString urlSpec;
    rv = NS_GetURLSpecFromFile(file, urlSpec);
    if (NS_SUCCEEDED(rv))
      LoadDataSource(urlSpec.get());
  }
}

nsresult
nsMsgServiceProviderService::LoadDataSource(const char *aURI)
{
  nsresult rv;

  nsCOMPtr<nsIRDFDataSource> ds =
      do_CreateInstance(kRDFXMLDataSourceCID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIRDFRemoteDataSource> remote =
      do_QueryInterface(ds, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = remote->Init(aURI);
  NS_ENSURE_SUCCESS(rv, rv);
  // for now load synchronously (async seems to be busted)
  rv = remote->Refresh(true);
  NS_ASSERTION(NS_SUCCEEDED(rv), "failed refresh?\n");

  rv = mInnerDataSource->AddDataSource(ds);

  return rv;
}
