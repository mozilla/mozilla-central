/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsSuiteDirectoryProvider.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsCategoryManagerUtils.h"
#include "nsXULAppAPI.h"
#include "nsDirectoryServiceUtils.h"

NS_IMPL_ISUPPORTS2(nsSuiteDirectoryProvider,
                   nsIDirectoryServiceProvider,
                   nsIDirectoryServiceProvider2)

NS_IMETHODIMP
nsSuiteDirectoryProvider::GetFile(const char *aKey,
                                  bool *aPersist,
                                  nsIFile* *aResult)
{
  // NOTE: This function can be reentrant through the NS_GetSpecialDirectory
  // call, so be careful not to cause infinite recursion.
  // i.e. the check for supported files must come first.
  const char* leafName = nullptr;

  if (!strcmp(aKey, NS_APP_BOOKMARKS_50_FILE))
    leafName = "bookmarks.html";
  else if (!strcmp(aKey, NS_APP_USER_PANELS_50_FILE))
    leafName = "panels.rdf";
  else if (!strcmp(aKey, NS_APP_SEARCH_50_FILE))
    leafName = "search.rdf";
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
  file->AppendNative(leafStr);

  bool exists;
  if (NS_SUCCEEDED(file->Exists(&exists)) && !exists)
    EnsureProfileFile(leafStr, parentDir, file);

  *aPersist = true;
  NS_IF_ADDREF(*aResult = file);

  return NS_OK;
}

NS_IMETHODIMP
nsSuiteDirectoryProvider::GetFiles(const char *aKey,
                                   nsISimpleEnumerator* *aResult)
{
  if (strcmp(aKey, NS_APP_SEARCH_DIR_LIST))
    return NS_ERROR_FAILURE;

  nsresult rv;
  nsCOMPtr<nsIProperties> dirSvc(do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsISimpleEnumerator> list;
  rv = dirSvc->Get(XRE_EXTENSIONS_DIR_LIST,
                   NS_GET_IID(nsISimpleEnumerator),
                   getter_AddRefs(list));
  if (NS_FAILED(rv))
    return rv;

  *aResult = new AppendingEnumerator(list, "searchplugins");
  if (!*aResult)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(*aResult);
  return NS_SUCCESS_AGGREGATE_RESULT;
}

void
nsSuiteDirectoryProvider::EnsureProfileFile(const nsACString& aLeafName,
                                            nsIFile* aParentDir,
                                            nsIFile* aTarget)
{
  nsCOMPtr<nsIFile> defaults;
  NS_GetSpecialDirectory(NS_APP_PROFILE_DEFAULTS_50_DIR,
                         getter_AddRefs(defaults));
  if (!defaults)
    return;

  defaults->AppendNative(aLeafName);

  defaults->CopyToNative(aParentDir, aLeafName);
}

NS_IMPL_ISUPPORTS1(nsSuiteDirectoryProvider::AppendingEnumerator,
                   nsISimpleEnumerator)

NS_IMETHODIMP
nsSuiteDirectoryProvider::AppendingEnumerator::HasMoreElements(bool *aResult)
{
  *aResult = mNext != nullptr;
  return NS_OK;
}

void
nsSuiteDirectoryProvider::AppendingEnumerator::GetNext()
{
  // Ignore all errors

  bool more;
  while (NS_SUCCEEDED(mBase->HasMoreElements(&more)) && more) {
    nsCOMPtr<nsISupports> nextSupports;
    mBase->GetNext(getter_AddRefs(nextSupports));

    mNext = do_QueryInterface(nextSupports);
    if (!mNext)
      continue;

    mNext->AppendNative(mLeafName);

    bool exists;
    if (NS_SUCCEEDED(mNext->Exists(&exists)) && exists)
      return;
  }

  mNext = nullptr;
}

NS_IMETHODIMP
nsSuiteDirectoryProvider::AppendingEnumerator::GetNext(nsISupports* *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  if (!mNext) {
    *aResult = nullptr;
    return NS_ERROR_FAILURE;
  }

  NS_ADDREF(*aResult = mNext);

  GetNext();

  return NS_OK;
}

nsSuiteDirectoryProvider::AppendingEnumerator::AppendingEnumerator
    (nsISimpleEnumerator* aBase, const char* const aLeafName) :
  mBase(aBase), mLeafName(aLeafName)
{
  // Initialize mNext to begin.
  GetNext();
}
