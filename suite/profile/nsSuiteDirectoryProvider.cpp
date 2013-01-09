/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsSuiteDirectoryProvider.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsCategoryManagerUtils.h"
#include "nsXULAppAPI.h"
#include "nsDirectoryServiceUtils.h"
#include "nsIPrefBranch.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIPrefLocalizedString.h"
#include "nsIPrefService.h"
#include "nsArrayEnumerator.h"
#include "nsEnumeratorUtils.h"

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

  nsCOMArray<nsIFile> baseFiles;

  /**
   * We want to preserve the following order, since the search service loads
   * engines in first-loaded-wins order.
   *   - extension search plugin locations (prepended below using
   *     NS_NewUnionEnumerator)
   *   - distro search plugin locations
   *   - user search plugin locations (profile)
   *   - app search plugin location (shipped engines)
   */
  AppendDistroSearchDirs(dirSvc, baseFiles);
  AppendFileKey(NS_APP_USER_SEARCH_DIR, dirSvc, baseFiles);
  AppendFileKey(NS_APP_SEARCH_DIR, dirSvc, baseFiles);

  nsCOMPtr<nsISimpleEnumerator> baseEnum;
  rv = NS_NewArrayEnumerator(getter_AddRefs(baseEnum), baseFiles);
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsISimpleEnumerator> list;
  rv = dirSvc->Get(XRE_EXTENSIONS_DIR_LIST,
                   NS_GET_IID(nsISimpleEnumerator),
                   getter_AddRefs(list));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsISimpleEnumerator> extEnum =
    new AppendingEnumerator(list, "searchplugins");
  if (!extEnum)  
    return NS_ERROR_OUT_OF_MEMORY;

  return NS_NewUnionEnumerator(aResult, extEnum, baseEnum);
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

void
nsSuiteDirectoryProvider::AppendFileKey(const char *key, nsIProperties* aDirSvc,
                                        nsCOMArray<nsIFile> &array)
{
  nsCOMPtr<nsIFile> file;
  nsresult rv = aDirSvc->Get(key, NS_GET_IID(nsIFile), getter_AddRefs(file));
  if (NS_FAILED(rv))
    return;

  bool exists;
  rv = file->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
    return;

  array.AppendObject(file);
}

// Appends the distribution-specific search engine directories to the
// array.  The directory structure is as follows:

// appdir/
// \- distribution/
//    \- searchplugins/
//       |- common/
//       \- locale/
//          |- <locale 1>/
//          ...
//          \- <locale N>/

// common engines are loaded for all locales.  If there is no locale
// directory for the current locale, there is a pref:
// "distribution.searchplugins.defaultLocale"
// which specifies a default locale to use.

void
nsSuiteDirectoryProvider::AppendDistroSearchDirs(nsIProperties* aDirSvc,
                                                 nsCOMArray<nsIFile> &array)
{
  nsCOMPtr<nsIFile> searchPlugins;
  nsresult rv = aDirSvc->Get(NS_XPCOM_CURRENT_PROCESS_DIR,
                             NS_GET_IID(nsIFile),
                             getter_AddRefs(searchPlugins));
  if (NS_FAILED(rv))
    return;
  searchPlugins->AppendNative(NS_LITERAL_CSTRING("distribution"));
  searchPlugins->AppendNative(NS_LITERAL_CSTRING("searchplugins"));

  bool exists;
  rv = searchPlugins->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
    return;

  nsCOMPtr<nsIFile> commonPlugins;
  rv = searchPlugins->Clone(getter_AddRefs(commonPlugins));
  if (NS_SUCCEEDED(rv)) {
    commonPlugins->AppendNative(NS_LITERAL_CSTRING("common"));
    rv = commonPlugins->Exists(&exists);
    if (NS_SUCCEEDED(rv) && exists)
        array.AppendObject(commonPlugins);
  }

  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (prefs) {
    nsCOMPtr<nsIFile> localePlugins;
    rv = searchPlugins->Clone(getter_AddRefs(localePlugins));
    if (NS_FAILED(rv))
      return;

    localePlugins->AppendNative(NS_LITERAL_CSTRING("locale"));

    nsCString locale;
    nsCOMPtr<nsIPrefLocalizedString> prefString;
    rv = prefs->GetComplexValue("general.useragent.locale",
                                NS_GET_IID(nsIPrefLocalizedString),
                                getter_AddRefs(prefString));
    if (NS_SUCCEEDED(rv)) {
      nsAutoString wLocale;
      prefString->GetData(getter_Copies(wLocale));
      CopyUTF16toUTF8(wLocale, locale);
    } else {
      rv = prefs->GetCharPref("general.useragent.locale", getter_Copies(locale));
    }

    if (NS_SUCCEEDED(rv)) {
      nsCOMPtr<nsIFile> curLocalePlugins;
      rv = localePlugins->Clone(getter_AddRefs(curLocalePlugins));
      if (NS_SUCCEEDED(rv)) {

        curLocalePlugins->AppendNative(locale);
        rv = curLocalePlugins->Exists(&exists);
        if (NS_SUCCEEDED(rv) && exists) {
          array.AppendObject(curLocalePlugins);
          return; // all done
        }
      }
    }

    // we didn't append the locale dir - try the default one
    nsCString defLocale;
    rv = prefs->GetCharPref("distribution.searchplugins.defaultLocale",
                            getter_Copies(defLocale));
    if (NS_SUCCEEDED(rv)) {
      nsCOMPtr<nsIFile> defLocalePlugins;
      rv = localePlugins->Clone(getter_AddRefs(defLocalePlugins));
      if (NS_SUCCEEDED(rv)) {

        defLocalePlugins->AppendNative(defLocale);
        rv = defLocalePlugins->Exists(&exists);
        if (NS_SUCCEEDED(rv) && exists)
          array.AppendObject(defLocalePlugins);
      }
    }
  }
}
