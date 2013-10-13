/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAppDirectoryServiceDefs.h"
#include "nsSuiteProfileMigratorUtils.h"
#include "nsCRT.h"
#include "nsICookieManager2.h"
#include "nsIFile.h"
#include "nsILineInputStream.h"
#include "nsIOutputStream.h"
#include "nsIPrefBranch.h"
#include "nsIPrefLocalizedString.h"
#include "nsIPrefService.h"
#include "nsIServiceManager.h"
#include "nsISupportsPrimitives.h"
#include "nsIURL.h"
#include "nsNetscapeProfileMigratorBase.h"
#include "nsNetUtil.h"
#include "prtime.h"
#include "nsINIParser.h"
#include "nsArrayUtils.h"

#define MAIL_DIR_50_NAME             NS_LITERAL_STRING("Mail")
#define IMAP_MAIL_DIR_50_NAME        NS_LITERAL_STRING("ImapMail")
#define NEWS_DIR_50_NAME             NS_LITERAL_STRING("News")
#define DIR_NAME_CHROME              NS_LITERAL_STRING("chrome")

NS_IMPL_ISUPPORTS2(nsNetscapeProfileMigratorBase, nsISuiteProfileMigrator,
                   nsITimerCallback)


///////////////////////////////////////////////////////////////////////////////
// nsITimerCallback

NS_IMETHODIMP
nsNetscapeProfileMigratorBase::Notify(nsITimer *timer)
{
  CopyNextFolder();
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsNetscapeProfileMigratorBase

nsNetscapeProfileMigratorBase::nsNetscapeProfileMigratorBase()
{
  mFileCopyTransactionIndex = 0;
  mObserverService = do_GetService("@mozilla.org/observer-service;1");
}

///////////////////////////////////////////////////////////////////////////////
// nsISuiteProfileMigrator methods

NS_IMETHODIMP
nsNetscapeProfileMigratorBase::GetSourceExists(bool* aResult)
{
  nsCOMPtr<nsIArray> profiles;
  GetSourceProfiles(getter_AddRefs(profiles));

  if (profiles) {
    uint32_t count;
    profiles->GetLength(&count);
    *aResult = count > 0;
  }
  else
    *aResult = false;

  return NS_OK;
}

NS_IMETHODIMP
nsNetscapeProfileMigratorBase::GetSourceHasMultipleProfiles(bool* aResult)
{
  nsCOMPtr<nsIArray> profiles;
  GetSourceProfiles(getter_AddRefs(profiles));

  if (profiles) {
    uint32_t count;
    profiles->GetLength(&count);
    *aResult = count > 1;
  }
  else
    *aResult = false;

  return NS_OK;
}

NS_IMETHODIMP
nsNetscapeProfileMigratorBase::GetSourceProfiles(nsIArray** aResult)
{
  if (!mProfileNames && !mProfileLocations) {
    nsresult rv;
    mProfileNames = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    if (NS_FAILED(rv))
      return rv;

    mProfileLocations = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    if (NS_FAILED(rv))
      return rv;

    // Fills mProfileNames and mProfileLocations
    FillProfileDataFromRegistry();
  }
  
  NS_IF_ADDREF(*aResult = mProfileNames);
  return NS_OK;
}

bool
nsNetscapeProfileMigratorBase::GetSourceHasHomePageURL()
{
  // Load the source pref file
  nsCOMPtr<nsIPrefService> psvc(do_GetService(NS_PREFSERVICE_CONTRACTID));
  psvc->ResetPrefs();

  nsCOMPtr<nsIFile> sourcePrefsFile;

  mSourceProfile->Clone(getter_AddRefs(sourcePrefsFile));
  sourcePrefsFile->AppendNative(NS_LITERAL_CSTRING(FILE_NAME_PREFS));

  psvc->ReadUserPrefs(sourcePrefsFile);

  nsCOMPtr<nsIPrefBranch> branch(do_QueryInterface(psvc));

  bool hasUserValue;
  nsresult rv = branch->PrefHasUserValue("browser.startup.homepage",
                                         &hasUserValue);

  return NS_SUCCEEDED(rv) && hasUserValue;
}

nsresult
nsNetscapeProfileMigratorBase::CopyHomePageData(bool aReplace)
{
  // Load the source pref file
  nsCOMPtr<nsIPrefService> psvc(do_GetService(NS_PREFSERVICE_CONTRACTID));
  psvc->ResetPrefs();

  nsCOMPtr<nsIFile> sourcePrefsFile;
  mSourceProfile->Clone(getter_AddRefs(sourcePrefsFile));
  sourcePrefsFile->AppendNative(nsDependentCString(FILE_NAME_PREFS));
  psvc->ReadUserPrefs(sourcePrefsFile);

  PBStructArray homepageBranch;
  ReadBranch("browser.startup.homepage", psvc, homepageBranch);

  // Now that we have all the pref data in memory, load the target pref file,
  // and write it back out
  psvc->ResetPrefs();

  nsCOMPtr<nsIFile> targetPrefsFile;
  mTargetProfile->Clone(getter_AddRefs(targetPrefsFile));
  targetPrefsFile->AppendNative(nsDependentCString(FILE_NAME_PREFS));

  // Don't use nullptr here as we're too early in the cycle for the prefs
  // service to get its default file (because the NS_GetDirectoryService items
  // aren't fully set up yet).
  psvc->ReadUserPrefs(targetPrefsFile);

  WriteBranch("browser.startup.homepage", psvc, homepageBranch);

  psvc->SavePrefFile(targetPrefsFile);

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// Pref Transform methods

#define GETPREF(xform, method, value) \
  xform->prefHasValue = NS_SUCCEEDED(aBranch->method(xform->sourcePrefName, value)); \
  return NS_OK;

#define SETPREF(xform, method, value) \
  if (xform->prefHasValue) { \
    return aBranch->method(xform->targetPrefName ? \
                           xform->targetPrefName : \
                           xform->sourcePrefName, value); \
  } \
  return NS_OK;

nsresult
nsNetscapeProfileMigratorBase::GetString(PrefTransform* aTransform,
                                         nsIPrefBranch* aBranch)
{
  GETPREF(aTransform, GetCharPref, &aTransform->stringValue)
}

nsresult
nsNetscapeProfileMigratorBase::SetString(PrefTransform* aTransform,
                                         nsIPrefBranch* aBranch)
{
  SETPREF(aTransform, SetCharPref, aTransform->stringValue)
}

nsresult
nsNetscapeProfileMigratorBase::GetBool(PrefTransform* aTransform,
                                       nsIPrefBranch* aBranch)
{
  GETPREF(aTransform, GetBoolPref, &aTransform->boolValue)
}

nsresult
nsNetscapeProfileMigratorBase::SetBool(PrefTransform* aTransform,
                                       nsIPrefBranch* aBranch)
{
  SETPREF(aTransform, SetBoolPref, aTransform->boolValue)
}

nsresult
nsNetscapeProfileMigratorBase::GetInt(PrefTransform* aTransform,
                                      nsIPrefBranch* aBranch)
{
  GETPREF(aTransform, GetIntPref, &aTransform->intValue)
}

nsresult
nsNetscapeProfileMigratorBase::SetInt(PrefTransform* aTransform,
                                      nsIPrefBranch* aBranch)
{
  SETPREF(aTransform, SetIntPref, aTransform->intValue)
}

nsresult
nsNetscapeProfileMigratorBase::SetFile(PrefTransform* aTransform,
                                       nsIPrefBranch* aBranch)
{
  // In this case targetPrefName is just an additional preference
  // that needs to be modified and not what the sourcePrefName is
  // going to be saved to once it is modified.
  nsresult rv = NS_OK;
  if (aTransform->prefHasValue) {
    nsCString fileURL(aTransform->stringValue);
    nsCOMPtr<nsIFile> aFile;
    // Start off by assuming fileURL is a URL spec and
    // try and get a File from it.
    rv = NS_GetFileFromURLSpec(fileURL, getter_AddRefs(aFile));
    if (NS_FAILED(rv)) {
      // Okay it wasn't a URL spec so assume it is a localfile,
      // if this fails then just don't set anything.
      nsCOMPtr<nsIFile> localFile;
      rv = NS_NewNativeLocalFile(fileURL, false, getter_AddRefs(localFile));
      if (NS_FAILED(rv))
        return NS_OK;  
      aFile = localFile;
    }
    // Now test to see if File exists and is an actual file.
    bool exists = false;
    rv = aFile->Exists(&exists);
    if (NS_SUCCEEDED(rv) && exists)
      rv = aFile->IsFile(&exists);

    if (NS_SUCCEEDED(rv) && exists) {
      // After all that let's just get the URL spec and set the pref to it.
      rv = NS_GetURLSpecFromFile(aFile, fileURL);
      if (NS_FAILED(rv))
        return NS_OK;
      rv = aBranch->SetCharPref(aTransform->sourcePrefName, fileURL.get());
      if (NS_SUCCEEDED(rv) && aTransform->targetPrefName)
        rv = aBranch->SetIntPref(aTransform->targetPrefName, 1);
    }
  }
  return rv;
}

nsresult
nsNetscapeProfileMigratorBase::SetImage(PrefTransform* aTransform,
                                        nsIPrefBranch* aBranch)
{
  if (aTransform->prefHasValue)
    // This transforms network.image.imageBehavior into
    // permissions.default.image
    return aBranch->SetIntPref("permissions.default.image",
                        aTransform->intValue == 1 ? 3 :
                        aTransform->intValue == 2 ? 2 : 1);
  return NS_OK;
}

nsresult
nsNetscapeProfileMigratorBase::SetCookie(PrefTransform* aTransform,
                                         nsIPrefBranch* aBranch)
{
  if (aTransform->prefHasValue)
    return aBranch->SetIntPref("network.cookie.cookieBehavior",
                               aTransform->intValue == 3 ? 0 :
                               aTransform->intValue);

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// General Utility Methods

nsresult
nsNetscapeProfileMigratorBase::GetSourceProfile(const PRUnichar* aProfile)
{
  uint32_t count;
  mProfileNames->GetLength(&count);
  for (uint32_t i = 0; i < count; ++i) {
    nsCOMPtr<nsISupportsString> str(do_QueryElementAt(mProfileNames, i));
    nsString profileName;
    str->GetData(profileName);
    if (profileName.Equals(aProfile))
    {
      mSourceProfile = do_QueryElementAt(mProfileLocations, i);
      break;
    }
  }

  return NS_OK;
}

nsresult
nsNetscapeProfileMigratorBase::GetProfileDataFromProfilesIni(nsIFile* aDataDir,
                                                             nsIMutableArray* aProfileNames,
                                                             nsIMutableArray* aProfileLocations)
{
  nsresult rv;
  nsCOMPtr<nsIFile> profileIni;
  rv = aDataDir->Clone(getter_AddRefs(profileIni));
  NS_ENSURE_SUCCESS(rv, rv);

  profileIni->Append(NS_LITERAL_STRING("profiles.ini"));

  // Does it exist?
  bool profileFileExists = false;
  rv = profileIni->Exists(&profileFileExists);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!profileFileExists)
    return NS_ERROR_FILE_NOT_FOUND;

  nsINIParser parser;
  rv = parser.Init(profileIni);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString buffer, filePath;
  bool isRelative;

  unsigned int c = 0;
  for (c = 0; true; ++c) {
    nsAutoCString profileID("Profile");
    profileID.AppendInt(c);

    rv = parser.GetString(profileID.get(), "IsRelative", buffer);
    if (NS_FAILED(rv))
      break;

    isRelative = buffer.EqualsLiteral("1");

    rv = parser.GetString(profileID.get(), "Path", filePath);
    if (NS_FAILED(rv)) {
      NS_ERROR("Malformed profiles.ini: Path= not found");
      continue;
    }

    rv = parser.GetString(profileID.get(), "Name", buffer);
    if (NS_FAILED(rv)) {
      NS_ERROR("Malformed profiles.ini: Name= not found");
      continue;
    }

    nsCOMPtr<nsIFile> rootDir;
    rv = NS_NewNativeLocalFile(EmptyCString(), true, getter_AddRefs(rootDir));
    NS_ENSURE_SUCCESS(rv, rv);

    if (isRelative)
      rv = rootDir->SetRelativeDescriptor(aDataDir, filePath);
    else
      rv = rootDir->SetPersistentDescriptor(filePath);

    if (NS_FAILED(rv)) continue;

    bool exists;
    rootDir->Exists(&exists);

    if (exists) {
      aProfileLocations->AppendElement(rootDir, false);

      nsCOMPtr<nsISupportsString> profileNameString(
        do_CreateInstance("@mozilla.org/supports-string;1"));

      profileNameString->SetData(NS_ConvertUTF8toUTF16(buffer));
      aProfileNames->AppendElement(profileNameString, false);
    }
  }
  return NS_OK;
}

nsresult
nsNetscapeProfileMigratorBase::CopyFile(const char* aSourceFileName,
                                        const char* aTargetFileName)
{
  nsCOMPtr<nsIFile> sourceFile;
  mSourceProfile->Clone(getter_AddRefs(sourceFile));

  sourceFile->AppendNative(nsDependentCString(aSourceFileName));
  bool exists = false;
  sourceFile->Exists(&exists);
  if (!exists)
    return NS_OK;

  nsCOMPtr<nsIFile> targetFile;
  mTargetProfile->Clone(getter_AddRefs(targetFile));
  
  targetFile->AppendNative(nsDependentCString(aTargetFileName));
  targetFile->Exists(&exists);
  if (exists)
    targetFile->Remove(false);

  return sourceFile->CopyToNative(mTargetProfile,
                                  nsDependentCString(aTargetFileName));
}

// helper function, copies the contents of srcDir into destDir.
// destDir will be created if it doesn't exist.
nsresult
nsNetscapeProfileMigratorBase::RecursiveCopy(nsIFile* srcDir,
                                             nsIFile* destDir)
{
  bool exists;
  nsresult rv = srcDir->Exists(&exists);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!exists)
    // We do not want to fail if the source folder does not exist because then
    // parts of the migration process following this would not get executed
    return NS_OK;

  bool isDir;

  rv = srcDir->IsDirectory(&isDir);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!isDir)
    return NS_ERROR_INVALID_ARG;

  rv = destDir->Exists(&exists);
  if (NS_SUCCEEDED(rv) && !exists)
    rv = destDir->Create(nsIFile::DIRECTORY_TYPE, 0775);

  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> dirIterator;
  rv = srcDir->GetDirectoryEntries(getter_AddRefs(dirIterator));
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasMore = false;
  rv = dirIterator->HasMoreElements(&hasMore);
  NS_ENSURE_SUCCESS(rv, rv); 

  nsCOMPtr<nsIFile> dirEntry;
  
  while (hasMore) {
    rv = dirIterator->GetNext((nsISupports**)getter_AddRefs(dirEntry));
    if (NS_SUCCEEDED(rv)) {
      rv = dirEntry->IsDirectory(&isDir);
      if (NS_SUCCEEDED(rv)) {
        if (isDir) {
          nsCOMPtr<nsIFile> newChild;
          rv = destDir->Clone(getter_AddRefs(newChild));
          if (NS_SUCCEEDED(rv)) {
            nsAutoString leafName;
            dirEntry->GetLeafName(leafName);

            newChild->AppendRelativePath(leafName);
            rv = newChild->Exists(&exists);
            if (NS_SUCCEEDED(rv) && !exists)
              rv = newChild->Create(nsIFile::DIRECTORY_TYPE, 0775);

            rv = RecursiveCopy(dirEntry, newChild);
          }
        }
        else {
          // we aren't going to do any actual file copying here. Instead,
          // add this to our file transaction list so we can copy files
          // asynchronously...
          fileTransactionEntry fileEntry;

          fileEntry.srcFile = dirEntry;
          fileEntry.destFile = destDir;

          mFileCopyTransactions.AppendElement(fileEntry);
        }
      }
    }
    rv = dirIterator->HasMoreElements(&hasMore);
    if (NS_FAILED(rv))
      return rv;
  }
  
  return rv;
}

void
nsNetscapeProfileMigratorBase::ReadBranch(const char * branchName,
                                          nsIPrefService* aPrefService,
                                          PBStructArray &aPrefs)
{
  // Enumerate the branch
  nsCOMPtr<nsIPrefBranch> branch;
  aPrefService->GetBranch(branchName, getter_AddRefs(branch));

  uint32_t count;
  char** prefs = nullptr;

  nsresult rv = branch->GetChildList("", &count, &prefs);
  if (NS_FAILED(rv))
    return;

  for (uint32_t i = 0; i < count; ++i) {
    // Save each pref's value into an array
    char* currPref = prefs[i];
    int32_t type;
    branch->GetPrefType(currPref, &type);

    PrefBranchStruct* pref = new PrefBranchStruct;
    if (!pref) {
      NS_WARNING("Could not create new PrefBranchStruct");
      return;
    }
    pref->prefName = currPref;
    pref->type = type;

    switch (type) {
    case nsIPrefBranch::PREF_STRING:
      rv = branch->GetCharPref(currPref, &pref->stringValue);
      break;
    case nsIPrefBranch::PREF_BOOL:
      rv = branch->GetBoolPref(currPref, &pref->boolValue);
      break;
    case nsIPrefBranch::PREF_INT:
      rv = branch->GetIntPref(currPref, &pref->intValue);
      break;
    default:
      NS_WARNING("Invalid Pref Type in "
                 "nsNetscapeProfileMigratorBase::ReadBranch\n");
      break;
    }

    if (NS_SUCCEEDED(rv))
      aPrefs.AppendElement(pref);
  }
}

void
nsNetscapeProfileMigratorBase::WriteBranch(const char * branchName,
                                           nsIPrefService* aPrefService,
                                           PBStructArray &aPrefs)
{
  // Enumerate the branch
  nsCOMPtr<nsIPrefBranch> branch;
  aPrefService->GetBranch(branchName, getter_AddRefs(branch));

  uint32_t count = aPrefs.Length();
  for (uint32_t i = 0; i < count; ++i) {
    PrefBranchStruct* pref = aPrefs.ElementAt(i);

    switch (pref->type) {
    case nsIPrefBranch::PREF_STRING:
      branch->SetCharPref(pref->prefName, pref->stringValue);
      NS_Free(pref->stringValue);
      pref->stringValue = nullptr;
      break;
    case nsIPrefBranch::PREF_BOOL:
      branch->SetBoolPref(pref->prefName, pref->boolValue);
      break;
    case nsIPrefBranch::PREF_INT:
      branch->SetIntPref(pref->prefName, pref->intValue);
      break;
    default:
      NS_WARNING("Invalid Pref Type in "
                 "nsNetscapeProfileMigratorBase::WriteBranch\n");
      break;
    }
    NS_Free(pref->prefName);
    pref->prefName = nullptr;
    delete pref;
    pref = nullptr;
  }
  aPrefs.Clear();
}

nsresult
nsNetscapeProfileMigratorBase::GetFileValue(nsIPrefBranch* aPrefBranch, const char* aRelPrefName, const char* aPrefName, nsIFile** aReturnFile)
{
  nsCString prefValue;
  nsCOMPtr<nsIFile> theFile;
  nsresult rv = aPrefBranch->GetCharPref(aRelPrefName, getter_Copies(prefValue));
  if (NS_SUCCEEDED(rv)) {
    // The pref has the format: [ProfD]a/b/c
    if (!StringBeginsWith(prefValue, NS_LITERAL_CSTRING("[ProfD]")))
      return NS_ERROR_FILE_NOT_FOUND;

    rv = NS_NewNativeLocalFile(EmptyCString(), true, getter_AddRefs(theFile));
    if (NS_FAILED(rv))
      return rv;

    rv = theFile->SetRelativeDescriptor(mSourceProfile, Substring(prefValue, 7));
    if (NS_FAILED(rv))
      return rv;
  } else {
    rv = aPrefBranch->GetComplexValue(aPrefName,
                                      NS_GET_IID(nsIFile),
                                      getter_AddRefs(theFile));
  }

  theFile.forget(aReturnFile);
  return rv;
}

///////////////////////////////////////////////////////////////////////////////
// Generic Import Functions

nsresult
nsNetscapeProfileMigratorBase::CopyCookies(bool aReplace)
{
  if (aReplace) {
    // can't start the cookieservice, so just push files around:
    // 1) remove target cookies.sqlite file if it exists, to force import
    // 2) copy source cookies.txt file, which will be imported on startup
    nsCOMPtr<nsIFile> targetFile;
    mTargetProfile->Clone(getter_AddRefs(targetFile));
    targetFile->AppendNative(NS_LITERAL_CSTRING(FILE_NAME_COOKIES_SQLITE));
    targetFile->Remove(false);

    return CopyFile(FILE_NAME_COOKIES, FILE_NAME_COOKIES);
  }

  nsresult rv;
  nsCOMPtr<nsICookieManager2> cookieManager(do_GetService(NS_COOKIEMANAGER_CONTRACTID, &rv));
  if (NS_FAILED(rv)) 
    return rv;

  nsCOMPtr<nsIFile> seamonkeyCookiesFile;
  mSourceProfile->Clone(getter_AddRefs(seamonkeyCookiesFile));
  seamonkeyCookiesFile->AppendNative(NS_LITERAL_CSTRING(FILE_NAME_COOKIES));

  return cookieManager->ImportCookies(seamonkeyCookiesFile);
}

nsresult
nsNetscapeProfileMigratorBase::CopyUserSheet(const char* aFileName)
{
  nsCOMPtr<nsIFile> sourceUserContent;
  mSourceProfile->Clone(getter_AddRefs(sourceUserContent));
  sourceUserContent->Append(DIR_NAME_CHROME);
  sourceUserContent->AppendNative(nsDependentCString(aFileName));

  bool exists = false;
  sourceUserContent->Exists(&exists);
  if (!exists)
    return NS_OK;

  nsCOMPtr<nsIFile> targetUserContent;
  mTargetProfile->Clone(getter_AddRefs(targetUserContent));
  targetUserContent->Append(DIR_NAME_CHROME);
  nsCOMPtr<nsIFile> targetChromeDir;
  targetUserContent->Clone(getter_AddRefs(targetChromeDir));
  targetUserContent->AppendNative(nsDependentCString(aFileName));

  targetUserContent->Exists(&exists);
  if (exists)
    targetUserContent->Remove(false);

  return sourceUserContent->CopyToNative(targetChromeDir,
                                         nsDependentCString(aFileName));
}

///////////////////////////////////////////////////////////////////////////////
// Browser Import Functions

nsresult
nsNetscapeProfileMigratorBase::CopyBookmarks(bool aReplace)
{
  if (aReplace)
    return CopyFile(FILE_NAME_BOOKMARKS, FILE_NAME_BOOKMARKS);

  return ImportNetscapeBookmarks(FILE_NAME_BOOKMARKS, "sourceNameSeamonkey");
}

nsresult
nsNetscapeProfileMigratorBase::CopyOtherData(bool aReplace)
{
  if (!aReplace)
    return NS_OK;

  nsCOMPtr<nsIFile> sourceSearchDir;
  mSourceProfile->Clone(getter_AddRefs(sourceSearchDir));
  sourceSearchDir->AppendNative(nsDependentCString(DIR_NAME_SEARCH));

  nsCOMPtr<nsIFile> targetSearchDir;
  mTargetProfile->Clone(getter_AddRefs(targetSearchDir));
  targetSearchDir->AppendNative(nsDependentCString(DIR_NAME_SEARCH));

  nsresult rv = RecursiveCopy(sourceSearchDir, targetSearchDir);
  if (NS_FAILED(rv))
    return rv;

  return CopyFile(FILE_NAME_DOWNLOADS, FILE_NAME_DOWNLOADS);
}

nsresult
nsNetscapeProfileMigratorBase::ImportNetscapeBookmarks(const char* aBookmarksFileName,
                                                       const char* aImportSourceNameKey)
{
  nsCOMPtr<nsIFile> bookmarksFile;
  mSourceProfile->Clone(getter_AddRefs(bookmarksFile));
  bookmarksFile->AppendNative(nsDependentCString(aBookmarksFileName));

  return ImportBookmarksHTML(bookmarksFile,
                             NS_ConvertUTF8toUTF16(aImportSourceNameKey).get());
}

///////////////////////////////////////////////////////////////////////////////
// Mail Import Functions

nsresult
nsNetscapeProfileMigratorBase::CopyAddressBookDirectories(PBStructArray &aLdapServers,
                                                          nsIPrefService* aPrefService)
{
  // each server has a pref ending with .filename. The value of that pref
  // points to a profile which we need to migrate.
  nsAutoString index;
  index.AppendInt(nsISuiteProfileMigrator::ADDRESSBOOK_DATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());

  uint32_t count = aLdapServers.Length();
  for (uint32_t i = 0; i < count; ++i) {
    PrefBranchStruct* pref = aLdapServers.ElementAt(i);
    nsDependentCString prefName(pref->prefName);

    if (StringEndsWith(prefName, NS_LITERAL_CSTRING(".filename"))) {
      CopyFile(pref->stringValue, pref->stringValue);
    }

    // we don't need to do anything to the fileName pref itself
  }

  NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());

  return NS_OK;
}

nsresult
nsNetscapeProfileMigratorBase::CopySignatureFiles(PBStructArray &aIdentities,
                                                  nsIPrefService* aPrefService)
{
  nsresult rv = NS_OK;

  uint32_t count = aIdentities.Length();
  for (uint32_t i = 0; i < count; ++i)
  {
    PrefBranchStruct* pref = aIdentities.ElementAt(i);
    nsDependentCString prefName(pref->prefName);

    // a partial fix for bug #255043
    // if the user's signature file from seamonkey lives in the
    // old profile root, we'll copy it over to the new profile root and
    // then set the pref to the new value. Note, this doesn't work for
    // multiple signatures that live below the seamonkey profile root
    if (StringEndsWith(prefName, NS_LITERAL_CSTRING(".sig_file")))
    {
      // turn the pref into a nsIFile
      nsCOMPtr<nsIFile> srcSigFile =
        do_CreateInstance(NS_LOCAL_FILE_CONTRACTID);
      srcSigFile->SetPersistentDescriptor(nsDependentCString(pref->stringValue));

      nsCOMPtr<nsIFile> targetSigFile;
      rv = mTargetProfile->Clone(getter_AddRefs(targetSigFile));
      NS_ENSURE_SUCCESS(rv, rv);

      // now make the copy
      bool exists;
      srcSigFile->Exists(&exists);
      if (exists)
      {
        nsAutoString leafName;
        srcSigFile->GetLeafName(leafName);
        // will fail if we've already copied a sig file here
        srcSigFile->CopyTo(targetSigFile, leafName);
        targetSigFile->Append(leafName);

        // now write out the new descriptor
        nsAutoCString descriptorString;
        targetSigFile->GetPersistentDescriptor(descriptorString);
        NS_Free(pref->stringValue);
        pref->stringValue = ToNewCString(descriptorString);
      }
    }
  }
  return NS_OK;
}

nsresult
nsNetscapeProfileMigratorBase::CopyJunkTraining(bool aReplace)
{
  return aReplace ? CopyFile(FILE_NAME_JUNKTRAINING,
                             FILE_NAME_JUNKTRAINING) : NS_OK;
}

nsresult
nsNetscapeProfileMigratorBase::CopyMailFolderPrefs(PBStructArray &aMailServers,
                                                   nsIPrefService* aPrefService)
{
  // Each server has a .directory pref which points to the location of the
  // mail data for that server. We need to do two things for that case...
  // (1) Fix up the directory path for the new profile
  // (2) copy the mail folder data from the source directory pref to the
  //     destination directory pref
  CopyFile(FILE_NAME_VIRTUALFOLDERS, FILE_NAME_VIRTUALFOLDERS);

  int32_t count = aMailServers.Length();
  for (int32_t i = 0; i < count; ++i) {
    PrefBranchStruct* pref = aMailServers.ElementAt(i);
    nsDependentCString prefName(pref->prefName);

    if (StringEndsWith(prefName, NS_LITERAL_CSTRING(".directory"))) {
      // let's try to get a branch for this particular server to simplify things
      prefName.Cut(prefName.Length() - strlen("directory"),
                   strlen("directory"));
      prefName.Insert("mail.server.", 0);

      nsCOMPtr<nsIPrefBranch> serverBranch;
      aPrefService->GetBranch(prefName.get(), getter_AddRefs(serverBranch));

      if (!serverBranch)
        break; // should we clear out this server pref from aMailServers?

      nsCString serverType;
      serverBranch->GetCharPref("type", getter_Copies(serverType));

      nsCOMPtr<nsIFile> sourceMailFolder;
      nsresult rv = GetFileValue(serverBranch, "directory-rel", "directory",
                                 getter_AddRefs(sourceMailFolder));
      NS_ENSURE_SUCCESS(rv, rv);

      // now based on type, we need to build a new destination path for the
      // mail folders for this server
      nsCOMPtr<nsIFile> targetMailFolder;
      if (serverType.Equals("imap")) {
        mTargetProfile->Clone(getter_AddRefs(targetMailFolder));
        targetMailFolder->Append(IMAP_MAIL_DIR_50_NAME);
      }
      else if (serverType.Equals("none") || serverType.Equals("pop3") ||
               serverType.Equals("movemail")) {
        // local folders and POP3 servers go under <profile>\Mail
        mTargetProfile->Clone(getter_AddRefs(targetMailFolder));
        targetMailFolder->Append(MAIL_DIR_50_NAME);
      }
      else if (serverType.Equals("nntp")) {
        mTargetProfile->Clone(getter_AddRefs(targetMailFolder));
        targetMailFolder->Append(NEWS_DIR_50_NAME);
      }

      if (targetMailFolder) {
        // for all of our server types, append the host name to the directory
        // as part of the new location
        nsCString hostName;
        serverBranch->GetCharPref("hostname", getter_Copies(hostName));
        targetMailFolder->Append(NS_ConvertASCIItoUTF16(hostName));

        // we should make sure the host name based directory we are going to
        // migrate the accounts into is unique. This protects against the
        // case where the user has multiple servers with the same host name.
        targetMailFolder->CreateUnique(nsIFile::DIRECTORY_TYPE, 0777);

        RecursiveCopy(sourceMailFolder, targetMailFolder);
        // now we want to make sure the actual directory pref that gets
        // transformed into the new profile's pref.js has the right file
        // location.
        nsAutoCString descriptorString;
        targetMailFolder->GetPersistentDescriptor(descriptorString);
        NS_Free(pref->stringValue);
        pref->stringValue = ToNewCString(descriptorString);
      }
    }
    else if (StringEndsWith(prefName, NS_LITERAL_CSTRING(".newsrc.file"))) {
      // copy the news RC file into \News. this won't work if the user has
      // different newsrc files for each account I don't know what to do in
      // that situation.
      nsCOMPtr<nsIFile> targetNewsRCFile;
      mTargetProfile->Clone(getter_AddRefs(targetNewsRCFile));
      targetNewsRCFile->Append(NEWS_DIR_50_NAME);

      // turn the pref into a nsIFile
      nsCOMPtr<nsIFile> srcNewsRCFile =
        do_CreateInstance(NS_LOCAL_FILE_CONTRACTID);
      srcNewsRCFile->SetPersistentDescriptor(
        nsDependentCString(pref->stringValue));

      // now make the copy
      bool exists;
      srcNewsRCFile->Exists(&exists);
      if (exists) {
        nsAutoString leafName;
        srcNewsRCFile->GetLeafName(leafName);
        // will fail if we've already copied a newsrc file here
        srcNewsRCFile->CopyTo(targetNewsRCFile,leafName);
        targetNewsRCFile->Append(leafName);

        // now write out the new descriptor
        nsAutoCString descriptorString;
        targetNewsRCFile->GetPersistentDescriptor(descriptorString);
        NS_Free(pref->stringValue);
        pref->stringValue = ToNewCString(descriptorString);
      }
    }
  }

  // Remove all .directory-rel prefs as those might have changed; MailNews
  // will create those prefs again on first use
  for (int32_t i = count; i-- > 0; ) {
    PrefBranchStruct* pref = aMailServers.ElementAt(i);
    nsDependentCString prefName(pref->prefName);

    if (StringEndsWith(prefName, NS_LITERAL_CSTRING(".directory-rel"))) {
      if (pref->type == nsIPrefBranch::PREF_STRING)
        NS_Free(pref->stringValue);

      aMailServers.RemoveElementAt(i);
    }
  }

  return NS_OK;
}

void
nsNetscapeProfileMigratorBase::CopyMailFolders()
{
  nsAutoString index;
  index.AppendInt(nsISuiteProfileMigrator::MAILDATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());

  // Generate the max progress value now that we know all of the files we
  // need to copy
  uint32_t count = mFileCopyTransactions.Length();
  mMaxProgress = 0;
  mCurrentProgress = 0;

  for (uint32_t i = 0; i < count; ++i) {
    fileTransactionEntry fileTransaction = mFileCopyTransactions[i];
    int64_t fileSize;
    fileTransaction.srcFile->GetFileSize(&fileSize);
    LL_ADD(mMaxProgress, mMaxProgress, fileSize);
  }

  CopyNextFolder();
}

void
nsNetscapeProfileMigratorBase::CopyNextFolder()
{
  if (mFileCopyTransactionIndex < mFileCopyTransactions.Length()) {
    uint32_t percentage = 0;
    fileTransactionEntry fileTransaction =
      mFileCopyTransactions.ElementAt(mFileCopyTransactionIndex++);

    // copy the file
    fileTransaction.srcFile->CopyTo(fileTransaction.destFile,
                                    EmptyString());

    // add to our current progress
    int64_t fileSize;
    fileTransaction.srcFile->GetFileSize(&fileSize);
    LL_ADD(mCurrentProgress, mCurrentProgress, fileSize);

    int64_t percentDone;
    LL_MUL(percentDone, mCurrentProgress, 100);

    LL_DIV(percentDone, percentDone, mMaxProgress);

    LL_L2UI(percentage, percentDone);

    nsAutoString index;
    index.AppendInt(percentage);

    NOTIFY_OBSERVERS(MIGRATION_PROGRESS, index.get());

    if (mFileCopyTransactionIndex == mFileCopyTransactions.Length())
    {
      EndCopyFolders();
      return;
    }

    // fire a timer to handle the next one.
    mFileIOTimer = do_CreateInstance("@mozilla.org/timer;1");

    if (mFileIOTimer)
      mFileIOTimer->InitWithCallback(static_cast<nsITimerCallback *>(this),
                                     1, nsITimer::TYPE_ONE_SHOT);
  }
  else
    EndCopyFolders();

  return;
}

void
nsNetscapeProfileMigratorBase::EndCopyFolders()
{
  mFileCopyTransactions.Clear();
  mFileCopyTransactionIndex = 0;

  // notify the UI that we are done with the migration process
  nsAutoString index;
  index.AppendInt(nsISuiteProfileMigrator::MAILDATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());

  NOTIFY_OBSERVERS(MIGRATION_ENDED, nullptr);
}
