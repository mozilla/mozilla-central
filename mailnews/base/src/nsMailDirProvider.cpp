/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMailDirProvider.h"
#include "nsMailDirServiceDefs.h"
#include "nsXULAppAPI.h"
#include "nsMsgBaseCID.h"
#include "nsArrayEnumerator.h"
#include "nsCOMArray.h"
#include "nsEnumeratorUtils.h"
#include "nsDirectoryServiceDefs.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsIChromeRegistry.h"
#include "nsICategoryManager.h"
#include "nsServiceManagerUtils.h"
#include "nsDirectoryServiceUtils.h"
#include "mozilla/Services.h"

#define MAIL_DIR_50_NAME             "Mail"
#define IMAP_MAIL_DIR_50_NAME        "ImapMail"
#define NEWS_DIR_50_NAME             "News"
#define MSG_FOLDER_CACHE_DIR_50_NAME "panacea.dat"

nsresult
nsMailDirProvider::EnsureDirectory(nsIFile *aDirectory)
{
  bool exists;
  nsresult rv = aDirectory->Exists(&exists);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!exists)
    rv = aDirectory->Create(nsIFile::DIRECTORY_TYPE, 0700);

  return rv;
}

NS_IMPL_ISUPPORTS2(nsMailDirProvider,
                   nsIDirectoryServiceProvider,
                   nsIDirectoryServiceProvider2)

NS_IMETHODIMP
nsMailDirProvider::GetFile(const char *aKey, bool *aPersist,
                           nsIFile **aResult)
{
  // NOTE: This function can be reentrant through the NS_GetSpecialDirectory
  // call, so be careful not to cause infinite recursion.
  // i.e. the check for supported files must come first.
  const char* leafName = nullptr;
  bool isDirectory = true;

  if (!strcmp(aKey, NS_APP_MAIL_50_DIR))
    leafName = MAIL_DIR_50_NAME;
  else if (!strcmp(aKey, NS_APP_IMAP_MAIL_50_DIR))
    leafName = IMAP_MAIL_DIR_50_NAME;
  else if (!strcmp(aKey, NS_APP_NEWS_50_DIR))
    leafName = NEWS_DIR_50_NAME;
  else if (!strcmp(aKey, NS_APP_MESSENGER_FOLDER_CACHE_50_FILE)) {
    isDirectory = false;
    leafName = MSG_FOLDER_CACHE_DIR_50_NAME;
  }
  else
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIFile> parentDir;
  nsresult rv = NS_GetSpecialDirectory(NS_APP_USER_PROFILE_50_DIR,
                                       getter_AddRefs(parentDir));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsIFile> file;
  rv = parentDir->Clone(getter_AddRefs(file));
  if (NS_FAILED(rv))
    return rv;

  nsDependentCString leafStr(leafName);
  rv = file->AppendNative(leafStr);
  if (NS_FAILED(rv))
    return rv;

  bool exists;
  if (isDirectory && NS_SUCCEEDED(file->Exists(&exists)) && !exists)
    rv = EnsureDirectory(file);

  *aPersist = true;
  file.swap(*aResult);

  return rv;
}

NS_IMETHODIMP
nsMailDirProvider::GetFiles(const char *aKey,
                            nsISimpleEnumerator **aResult)
{
  if (strcmp(aKey, ISP_DIRECTORY_LIST) != 0)
    return NS_ERROR_FAILURE;

  // The list of isp directories includes the isp directory
  // in the current process dir (i.e. <path to thunderbird.exe>\isp and 
  // <path to thunderbird.exe>\isp\locale 
  // and isp and isp\locale for each active extension

  nsCOMPtr<nsIProperties> dirSvc =
    do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID);
  if (!dirSvc)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIFile> currentProcessDir;
  nsresult rv = dirSvc->Get(NS_XPCOM_CURRENT_PROCESS_DIR,
                   NS_GET_IID(nsIFile), getter_AddRefs(currentProcessDir));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  rv = NS_NewSingletonEnumerator(getter_AddRefs(directoryEnumerator), currentProcessDir);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> combinedEnumerator;
  nsCOMPtr<nsISimpleEnumerator> extensionsEnum;

  // xpcshell-tests don't have XRE_EXTENSIONS_DIR_LIST, so accept a null return here.
  dirSvc->Get(XRE_EXTENSIONS_DIR_LIST,
              NS_GET_IID(nsISimpleEnumerator),
              getter_AddRefs(extensionsEnum));

  rv = NS_NewUnionEnumerator(getter_AddRefs(combinedEnumerator), directoryEnumerator, extensionsEnum);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*aResult = new AppendingEnumerator(combinedEnumerator));
  return NS_SUCCESS_AGGREGATE_RESULT;
}

NS_IMPL_ISUPPORTS1(nsMailDirProvider::AppendingEnumerator,
                   nsISimpleEnumerator)

NS_IMETHODIMP
nsMailDirProvider::AppendingEnumerator::HasMoreElements(bool *aResult)
{
  *aResult = mNext || mNextWithLocale ? true : false;
  return NS_OK;
}

NS_IMETHODIMP
nsMailDirProvider::AppendingEnumerator::GetNext(nsISupports* *aResult)
{
  // Set the return value to the next directory we want to enumerate over
  if (aResult)
    NS_ADDREF(*aResult = mNext);

  if (mNextWithLocale)
  {
    mNext = mNextWithLocale;
    mNextWithLocale = nullptr;
    return NS_OK;
  }

  mNext = nullptr;

  // Ignore all errors

  bool more;
  while (NS_SUCCEEDED(mBase->HasMoreElements(&more)) && more) {
    nsCOMPtr<nsISupports> nextbasesupp;
    mBase->GetNext(getter_AddRefs(nextbasesupp));

    nsCOMPtr<nsIFile> nextbase(do_QueryInterface(nextbasesupp));
    if (!nextbase)
      continue;

    nextbase->Clone(getter_AddRefs(mNext));
    if (!mNext)
      continue;

    mNext->AppendNative(NS_LITERAL_CSTRING("isp"));
    bool exists;
    nsresult rv = mNext->Exists(&exists);
    if (NS_SUCCEEDED(rv) && exists)
    {
      if (!mLocale.IsEmpty())
      {
        mNext->Clone(getter_AddRefs(mNextWithLocale));
        mNextWithLocale->AppendNative(mLocale);
        rv = mNextWithLocale->Exists(&exists);
        if (NS_FAILED(rv) || !exists)
          mNextWithLocale = nullptr; // clear out mNextWithLocale, so we don't try to iterate over it
      } 
      break;
    }

    mNext = nullptr;
  }

  return NS_OK;
}

nsMailDirProvider::AppendingEnumerator::AppendingEnumerator
    (nsISimpleEnumerator* aBase) :
  mBase(aBase)
{
  nsCOMPtr<nsIXULChromeRegistry> packageRegistry =
    mozilla::services::GetXULChromeRegistryService();
  if (packageRegistry)
    packageRegistry->GetSelectedLocale(NS_LITERAL_CSTRING("global"), mLocale);
  // Initialize mNext to begin
  GetNext(nullptr);
}
