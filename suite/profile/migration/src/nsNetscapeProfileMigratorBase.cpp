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
 * The Original Code is The Browser Profile Migrator.
 *
 * The Initial Developer of the Original Code is Ben Goodger.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Ben Goodger <ben@bengoodger.com>
 *  Ian Neal <iann_bugzilla@blueyonder.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
#include "NSReg.h"
#include "nsIServiceManager.h"
#include "nsISupportsPrimitives.h"
#include "nsIURL.h"
#include "nsNetscapeProfileMigratorBase.h"
#include "nsNetUtil.h"
#include "prtime.h"
#include "prprf.h"
#include "nsIPasswordManagerInternal.h"
#include "nsINIParser.h"
#include "nsArrayUtils.h"

#define MAIL_DIR_50_NAME             NS_LITERAL_STRING("Mail")
#define IMAP_MAIL_DIR_50_NAME        NS_LITERAL_STRING("ImapMail")
#define NEWS_DIR_50_NAME             NS_LITERAL_STRING("News")
#define DIR_NAME_CHROME              NS_LITERAL_STRING("chrome")

// helper functions for news migration
static PRUint32
StringHash(const char *ubuf)
{
  unsigned char * buf = (unsigned char*) ubuf;
  PRUint32 h=1;
  while (*buf) {
    h = 0x63c63cd9*h + 0x9c39c33d + (int32)*buf;
    ++buf;
  }
  return h;
}
/// @see nsString::FindCharInSet
PRInt32 nsString_FindCharInSet(const nsACString& aString,
                               const char *aPattern, PRInt32 aOffset = 0)
{
  const char *begin, *end;
  aString.BeginReading(&begin, &end);
  for (const char *current = begin + aOffset; current < end; ++current)
  {
    for (const char *pattern = aPattern; *pattern; ++pattern)
    {
      if (NS_UNLIKELY(*current == *pattern))
      {
        return current - begin;
      }
    }
  }
  return -1;
}

nsresult
NS_MsgHashIfNecessary(nsCString &name)
{
#if defined(XP_MAC)
  const PRUint32 MAX_LEN = 25;
#elif defined(XP_UNIX) || defined(XP_BEOS)
  const PRUint32 MAX_LEN = 55;
#elif defined(XP_WIN32)
  const PRUint32 MAX_LEN = 55;
#elif defined(XP_OS2)
  const PRUint32 MAX_LEN = 55;
#else
  #error need_to_define_your_max_filename_length
#endif
  nsCAutoString str(name);

  // Given a filename, make it safe for filesystem certain filenames require
  // hashing because they are too long or contain illegal characters.
  char hashedname[MAX_LEN + 1];
  if (nsString_FindCharInSet(str, FILE_PATH_SEPARATOR FILE_ILLEGAL_CHARACTERS) == -1) {
    // no illegal chars, it's just too long
    // keep the initial part of the string, but hash to make it fit
    if (str.Length() > MAX_LEN) {
      PL_strncpy(hashedname, str.get(), MAX_LEN + 1);
      PR_snprintf(hashedname + MAX_LEN - 8, 9, "%08lx",
                (unsigned long) StringHash(str.get()));
      name = hashedname;
    }
  }
  else {
      // found illegal chars, hash the whole thing
      // if we do substitution, then hash, two strings
      // could hash to the same value.
      // for example, on mac:  "foo__bar", "foo:_bar", "foo::bar"
      // would map to "foo_bar".  this way, all three will map to
      // different values
      PR_snprintf(hashedname, 9, "%08lx",
                (unsigned long) StringHash(str.get()));
      name = hashedname;
  }
  
  return NS_OK;
}

static nsresult
regerr2nsresult(REGERR errCode)
{
  switch (errCode) {
    case REGERR_PARAM:
    case REGERR_BADTYPE:
    case REGERR_BADNAME:
      return NS_ERROR_INVALID_ARG;

    case REGERR_MEMORY:
      return NS_ERROR_OUT_OF_MEMORY;
  }
  return NS_ERROR_FAILURE;
}

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
nsNetscapeProfileMigratorBase::GetSourceExists(PRBool* aResult)
{
  nsCOMPtr<nsIArray> profiles;
  GetSourceProfiles(getter_AddRefs(profiles));

  if (profiles) {
    PRUint32 count;
    profiles->GetLength(&count);
    *aResult = count > 0;
  }
  else
    *aResult = PR_FALSE;

  return NS_OK;
}

NS_IMETHODIMP
nsNetscapeProfileMigratorBase::GetSourceHasMultipleProfiles(PRBool* aResult)
{
  nsCOMPtr<nsIArray> profiles;
  GetSourceProfiles(getter_AddRefs(profiles));

  if (profiles) {
    PRUint32 count;
    profiles->GetLength(&count);
    *aResult = count > 1;
  }
  else
    *aResult = PR_FALSE;

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

PRBool
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

  PRBool hasUserValue;
  nsresult rv = branch->PrefHasUserValue("browser.startup.homepage",
                                         &hasUserValue);

  return NS_SUCCEEDED(rv) && hasUserValue;
}

nsresult
nsNetscapeProfileMigratorBase::CopyHomePageData(PRBool aReplace)
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

  // Don't use nsnull here as we're too early in the cycle for the prefs
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
      nsCOMPtr<nsILocalFile> localFile;
      rv = NS_NewNativeLocalFile(fileURL, PR_FALSE, getter_AddRefs(localFile));
      if (NS_FAILED(rv))
        return NS_OK;  
      aFile = localFile;
    }
    // Now test to see if File exists and is an actual file.
    PRBool exists = PR_FALSE;
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

// XXX Bug 381157 When suite uses Toolkit's DM backend, we need to
// activate this code.
#ifdef SUITE_USING_TOOLKIT_DM
nsresult
nsNetscapeProfileMigratorBase::SetDownloadManager(PrefTransform* aTransform,
                                                  nsIPrefBranch* aBranch)
{
  if (aTransform->prefHasValue) {
    nsresult rv = NS_OK;

    // Seamonkey's download manager uses a single pref to control behavior:
    // 0 - show download manager window
    // 1 - show individual progress dialogs
    // 2 - show nothing
    //
    // Firefox has only a download manager window, but it can behave like
    // a progress dialog, thus:
    // 0 || 1  -> show downloads window when a download starts
    // 2       -> don't show anything when a download starts
    // 1       -> close the downloads window as if it were a progress
    // window when downloads complete.
    //
    rv |= aBranch->SetBoolPref("browser.download.manager.showWhenStarting",
                               aTransform->intValue != 2);
    rv |= aBranch->SetBoolPref("browser.download.manager.closeWhenDone",
                               aTransform->intValue == 1);
    return rv;
  }
  return NS_OK;
}
#endif

///////////////////////////////////////////////////////////////////////////////
// General Utility Methods

nsresult
nsNetscapeProfileMigratorBase::GetSourceProfile(const PRUnichar* aProfile)
{
  PRUint32 count;
  mProfileNames->GetLength(&count);
  for (PRUint32 i = 0; i < count; ++i) {
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
nsNetscapeProfileMigratorBase::GetProfileDataFromProfilesIni(nsILocalFile* aDataDir,
                                                             nsIMutableArray* aProfileNames,
                                                             nsIMutableArray* aProfileLocations)
{
  nsresult rv;
  nsCOMPtr<nsIFile> dataDir;
  rv = aDataDir->Clone(getter_AddRefs(dataDir));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILocalFile> profileIni(do_QueryInterface(dataDir, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  profileIni->Append(NS_LITERAL_STRING("profiles.ini"));

  // Does it exist?
  PRBool profileFileExists = PR_FALSE;
  rv = profileIni->Exists(&profileFileExists);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!profileFileExists)
    return NS_ERROR_FILE_NOT_FOUND;

  nsINIParser parser;
  rv = parser.Init(profileIni);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString buffer, filePath;
  PRBool isRelative;

  unsigned int c = 0;
  for (c = 0; PR_TRUE; ++c) {
    nsCAutoString profileID("Profile");
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

    nsCOMPtr<nsILocalFile> rootDir;
    rv = NS_NewNativeLocalFile(EmptyCString(), PR_TRUE, getter_AddRefs(rootDir));
    NS_ENSURE_SUCCESS(rv, rv);

    if (isRelative)
      rv = rootDir->SetRelativeDescriptor(aDataDir, filePath);
    else
      rv = rootDir->SetPersistentDescriptor(filePath);

    if (NS_FAILED(rv)) continue;

    PRBool exists;
    rootDir->Exists(&exists);

    if (exists) {
      aProfileLocations->AppendElement(rootDir, PR_FALSE);

      nsCOMPtr<nsISupportsString> profileNameString(
        do_CreateInstance("@mozilla.org/supports-string;1"));

      profileNameString->SetData(NS_ConvertUTF8toUTF16(buffer));
      aProfileNames->AppendElement(profileNameString, PR_FALSE);
    }
  }
  return NS_OK;
}

nsresult
nsNetscapeProfileMigratorBase::GetProfileDataFromRegistry(nsILocalFile* aRegistryFile,
                                                          nsIMutableArray* aProfileNames,
                                                          nsIMutableArray* aProfileLocations)
{
  REGERR errCode;

  // Ensure aRegistryFile exists before open it
  PRBool regFileExists = PR_FALSE;
  nsresult rv = aRegistryFile->Exists(&regFileExists);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!regFileExists)
    return NS_ERROR_FILE_NOT_FOUND;

  // Open It
  nsCAutoString regPath;
  rv = aRegistryFile->GetNativePath(regPath);
  NS_ENSURE_SUCCESS(rv, rv);

  if ((errCode = NR_StartupRegistry()))
    return regerr2nsresult(errCode);

  HREG reg;
  if ((errCode = NR_RegOpen(regPath.get(), &reg))) {
    NR_ShutdownRegistry();

    return regerr2nsresult(errCode);
  }

  RKEY profilesTree;
  if ((errCode = NR_RegGetKey(reg, ROOTKEY_COMMON, "Profiles", &profilesTree))) {
    NR_RegClose(reg);
    NR_ShutdownRegistry();

    return regerr2nsresult(errCode);
  }

  char profileStr[MAXREGPATHLEN];
  REGENUM enumState = nsnull;

  while (!NR_RegEnumSubkeys(reg, profilesTree, &enumState, profileStr,
                            sizeof(profileStr), REGENUM_CHILDREN)) {
    RKEY profileKey;
    if (NR_RegGetKey(reg, profilesTree, profileStr, &profileKey))
      continue;

    // "migrated" is "yes" for all valid Seamonkey profiles. It is only "no"
    // for 4.x profiles.
    char migratedStr[3] = {0};
    errCode = NR_RegGetEntryString(reg, profileKey, "migrated",
                                   migratedStr, sizeof(migratedStr));
    if ((errCode != REGERR_OK && errCode != REGERR_BUFTOOSMALL) ||
        strcmp(migratedStr, "no") == 0)
      continue;

    // Get the profile location and add it to the locations array
    REGINFO regInfo;
    regInfo.size = sizeof(REGINFO);

    if (NR_RegGetEntryInfo(reg, profileKey, "directory", &regInfo))
      continue;

    nsCAutoString dirStr;
    dirStr.SetLength(regInfo.entryLength);

    errCode = NR_RegGetEntryString(reg, profileKey, "directory",
                                   dirStr.BeginWriting(), regInfo.entryLength);
    // Remove trailing \0
    dirStr.SetLength(regInfo.entryLength-1);

    nsCOMPtr<nsILocalFile> dir;
#ifdef XP_MACOSX
    rv = NS_NewNativeLocalFile(EmptyCString(), PR_TRUE, getter_AddRefs(dir));
    if (NS_FAILED(rv))
      break;

    dir->SetPersistentDescriptor(dirStr);
#else
    rv = NS_NewLocalFile(NS_ConvertUTF8toUTF16(dirStr), PR_TRUE,
                         getter_AddRefs(dir));
    if (NS_FAILED(rv))
      break;
#endif

    PRBool exists;
    dir->Exists(&exists);

    if (exists) {
      aProfileLocations->AppendElement(dir, PR_FALSE);

      // Add the profile name to the names array
      nsCOMPtr<nsISupportsString> profileNameString(
        do_CreateInstance("@mozilla.org/supports-string;1"));

      profileNameString->SetData(NS_ConvertUTF8toUTF16(profileStr));
      aProfileNames->AppendElement(profileNameString, PR_FALSE);
    }
  }
  NR_RegClose(reg);
  NR_ShutdownRegistry();

  return rv;
}

nsresult
nsNetscapeProfileMigratorBase::CopyFile(const char* aSourceFileName,
                                        const char* aTargetFileName)
{
  nsCOMPtr<nsIFile> sourceFile;
  mSourceProfile->Clone(getter_AddRefs(sourceFile));

  sourceFile->AppendNative(nsDependentCString(aSourceFileName));
  PRBool exists = PR_FALSE;
  sourceFile->Exists(&exists);
  if (!exists)
    return NS_OK;

  nsCOMPtr<nsIFile> targetFile;
  mTargetProfile->Clone(getter_AddRefs(targetFile));
  
  targetFile->AppendNative(nsDependentCString(aTargetFileName));
  targetFile->Exists(&exists);
  if (exists)
    targetFile->Remove(PR_FALSE);

  return sourceFile->CopyToNative(mTargetProfile,
                                  nsDependentCString(aTargetFileName));
}

// helper function, copies the contents of srcDir into destDir.
// destDir will be created if it doesn't exist.
nsresult
nsNetscapeProfileMigratorBase::RecursiveCopy(nsIFile* srcDir,
                                             nsIFile* destDir)
{
  PRBool isDir;
  
  nsresult rv = srcDir->IsDirectory(&isDir);
  if (NS_FAILED(rv))
    return rv;

  if (!isDir)
    return NS_ERROR_INVALID_ARG;
  
  PRBool exists;
  rv = destDir->Exists(&exists);
  if (NS_SUCCEEDED(rv) && !exists)
    rv = destDir->Create(nsIFile::DIRECTORY_TYPE, 0775);

  if (NS_FAILED(rv))
    return rv;
  
  nsCOMPtr<nsISimpleEnumerator> dirIterator;
  rv = srcDir->GetDirectoryEntries(getter_AddRefs(dirIterator));
  if (NS_FAILED(rv))
    return rv;
  
  PRBool hasMore = PR_FALSE;
  rv = dirIterator->HasMoreElements(&hasMore);
  if (NS_FAILED(rv))
    return rv;
  
  nsCOMPtr<nsIFile> dirEntry;
  
  while (hasMore) {
    rv = dirIterator->GetNext((nsISupports**)getter_AddRefs(dirEntry));
    if (NS_SUCCEEDED(rv)) {
      rv = dirEntry->IsDirectory(&isDir);
      if (NS_SUCCEEDED(rv)) {
        if (isDir) {
          nsCOMPtr<nsIFile> destClone;
          rv = destDir->Clone(getter_AddRefs(destClone));
          if (NS_SUCCEEDED(rv)) {
            nsCOMPtr<nsILocalFile> newChild(do_QueryInterface(destClone));
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

  PRUint32 count;
  char** prefs = nsnull;

  nsresult rv = branch->GetChildList("", &count, &prefs);
  if (NS_FAILED(rv))
    return;

  for (PRUint32 i = 0; i < count; ++i) {
    // Save each pref's value into an array
    char* currPref = prefs[i];
    PRInt32 type;
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

  PRUint32 count = aPrefs.Length();
  for (PRUint32 i = 0; i < count; ++i) {
    PrefBranchStruct* pref = aPrefs.ElementAt(i);

    switch (pref->type) {
    case nsIPrefBranch::PREF_STRING:
      branch->SetCharPref(pref->prefName, pref->stringValue);
      NS_Free(pref->stringValue);
      pref->stringValue = nsnull;
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
    pref->prefName = nsnull;
    delete pref;
    pref = nsnull;
  }
  aPrefs.Clear();
}

///////////////////////////////////////////////////////////////////////////////
// Generic Import Functions

nsresult
nsNetscapeProfileMigratorBase::CopyCookies(PRBool aReplace)
{
  if (aReplace) {
    // can't start the cookieservice, so just push files around:
    // 1) remove target cookies.sqlite file if it exists, to force import
    // 2) copy source cookies.txt file, which will be imported on startup
    nsCOMPtr<nsIFile> targetFile;
    mTargetProfile->Clone(getter_AddRefs(targetFile));
    targetFile->AppendNative(NS_LITERAL_CSTRING(FILE_NAME_COOKIES_SQLITE));
    targetFile->Remove(PR_FALSE);

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
nsNetscapeProfileMigratorBase::CopyPasswords(PRBool aReplace)
{
  nsCString signonsFileName;
  GetSignonFileName(aReplace, getter_Copies(signonsFileName));

  if (signonsFileName.IsEmpty())
    return NS_ERROR_FILE_NOT_FOUND;

  if (aReplace)
    return CopyFile(signonsFileName.get(), signonsFileName.get());

  nsCOMPtr<nsIFile> seamonkeyPasswordsFile;
  mSourceProfile->Clone(getter_AddRefs(seamonkeyPasswordsFile));
  seamonkeyPasswordsFile->AppendNative(signonsFileName);

  nsCOMPtr<nsIPasswordManagerInternal> pmi(
    do_GetService("@mozilla.org/passwordmanager;1"));
  return pmi->ReadPasswords(seamonkeyPasswordsFile);
}

nsresult
nsNetscapeProfileMigratorBase::CopyUserSheet(const char* aFileName)
{
  nsCOMPtr<nsIFile> sourceUserContent;
  mSourceProfile->Clone(getter_AddRefs(sourceUserContent));
  sourceUserContent->Append(DIR_NAME_CHROME);
  sourceUserContent->AppendNative(nsDependentCString(aFileName));

  PRBool exists = PR_FALSE;
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
    targetUserContent->Remove(PR_FALSE);

  return sourceUserContent->CopyToNative(targetChromeDir,
                                         nsDependentCString(aFileName));
}

nsresult
nsNetscapeProfileMigratorBase::GetSignonFileName(PRBool aReplace,
                                                 char** aFileName)
{
  if (aReplace) {
    // Find out what the signons file was called, this is stored in a pref
    // in Seamonkey.
    nsCOMPtr<nsIPrefService> psvc(do_GetService(NS_PREFSERVICE_CONTRACTID));

    if (psvc) {
      nsCOMPtr<nsIPrefBranch> branch(do_QueryInterface(psvc));

      if (NS_SUCCEEDED(branch->GetCharPref("signon.SignonFileName",
                                           aFileName)))
        return NS_OK;
    }
  }

  nsCOMPtr<nsISimpleEnumerator> entries;
  nsresult rv = mSourceProfile->GetDirectoryEntries(getter_AddRefs(entries));
  if (NS_FAILED(rv))
    return rv;

  nsCAutoString fileName;
  while (1) {
    PRBool hasMore = PR_FALSE;
    rv = entries->HasMoreElements(&hasMore);
    if (NS_FAILED(rv) || !hasMore)
      break;

    nsCOMPtr<nsISupports> supp;
    rv = entries->GetNext(getter_AddRefs(supp));
    if (NS_FAILED(rv))
      break;

    nsCOMPtr<nsIFile> currFile(do_QueryInterface(supp));

    nsCOMPtr<nsIURI> uri;
    rv = NS_NewFileURI(getter_AddRefs(uri), currFile);
    if (NS_FAILED(rv))
      break;

    nsCOMPtr<nsIURL> url(do_QueryInterface(uri));

    nsCAutoString extn;
    url->GetFileExtension(extn);

    if (extn.Equals("s", CaseInsensitiveCompare)) {
      url->GetFileName(fileName);
      break;
    }
  };

  *aFileName = ToNewCString(fileName);

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// Browser Import Functions

nsresult
nsNetscapeProfileMigratorBase::CopyBookmarks(PRBool aReplace)
{
  if (aReplace)
    return CopyFile(FILE_NAME_BOOKMARKS, FILE_NAME_BOOKMARKS);

  return ImportNetscapeBookmarks(FILE_NAME_BOOKMARKS, "sourceNameSeamonkey");
}

nsresult
nsNetscapeProfileMigratorBase::CopyOtherData(PRBool aReplace)
{
  if (!aReplace)
    return NS_OK;

  nsresult rv = CopyFile(FILE_NAME_SEARCH, FILE_NAME_SEARCH);

  nsCOMPtr<nsIFile> sourceSearchDir;
  mSourceProfile->Clone(getter_AddRefs(sourceSearchDir));
  sourceSearchDir->AppendNative(nsDependentCString(DIR_NAME_SEARCH));

  nsCOMPtr<nsIFile> targetSearchDir;
  mTargetProfile->Clone(getter_AddRefs(targetSearchDir));
  targetSearchDir->AppendNative(nsDependentCString(DIR_NAME_SEARCH));

  rv = rv | RecursiveCopy(sourceSearchDir, targetSearchDir);

  return rv | CopyFile(FILE_NAME_DOWNLOADS, FILE_NAME_DOWNLOADS);
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

  PRUint32 count = aLdapServers.Length();
  for (PRUint32 i = 0; i < count; ++i) {
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

  PRUint32 count = aIdentities.Length();
  for (PRUint32 i = 0; i < count; ++i)
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
      // turn the pref into a nsILocalFile
      nsCOMPtr<nsILocalFile> srcSigFile =
        do_CreateInstance(NS_LOCAL_FILE_CONTRACTID);
      srcSigFile->SetPersistentDescriptor(nsDependentCString(pref->stringValue));

      nsCOMPtr<nsIFile> targetSigFile;
      rv = mTargetProfile->Clone(getter_AddRefs(targetSigFile));
      NS_ENSURE_SUCCESS(rv, rv);

      // now make the copy
      PRBool exists;
      srcSigFile->Exists(&exists);
      if (exists)
      {
        nsAutoString leafName;
        srcSigFile->GetLeafName(leafName);
        // will fail if we've already copied a sig file here
        srcSigFile->CopyTo(targetSigFile, leafName);
        targetSigFile->Append(leafName);

        // now write out the new descriptor
        nsCAutoString descriptorString;
        nsCOMPtr<nsILocalFile> localFile = do_QueryInterface(targetSigFile);
        localFile->GetPersistentDescriptor(descriptorString);
        NS_Free(pref->stringValue);
        pref->stringValue = ToNewCString(descriptorString);
      }
    }
  }
  return NS_OK;
}

nsresult
nsNetscapeProfileMigratorBase::CopyJunkTraining(PRBool aReplace)
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

  PRInt32 count = aMailServers.Length();
  for (PRInt32 i = 0; i < count; ++i) {
    PrefBranchStruct* pref = aMailServers.ElementAt(i);
    nsDependentCString prefName(pref->prefName);

    if (StringEndsWith(prefName, NS_LITERAL_CSTRING(".directory-rel"))) {
      // When the directories are modified below, we may change the .directory
      // pref. As we don't have a pref branch to modify at this stage and set
      // up the relative folders properly, we'll just remove all the
      // *.directory-rel prefs. Mailnews will cope with this, creating them
      // when it first needs them.
      if (pref->type == nsIPrefBranch::PREF_STRING)
        NS_Free(pref->stringValue);

      aMailServers.RemoveElementAt(i);
      // Now decrease i and count to match the removed element
      --i;
      --count;
    }
    else if (StringEndsWith(prefName, NS_LITERAL_CSTRING(".directory"))) {
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

      nsCOMPtr<nsILocalFile> sourceMailFolder;
      nsresult rv =
        serverBranch->GetComplexValue("directory", NS_GET_IID(nsILocalFile),
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
        nsCAutoString descriptorString;
        nsCOMPtr<nsILocalFile> localFile = do_QueryInterface(targetMailFolder);
        localFile->GetPersistentDescriptor(descriptorString);
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

      // turn the pref into a nsILocalFile
      nsCOMPtr<nsILocalFile> srcNewsRCFile =
        do_CreateInstance(NS_LOCAL_FILE_CONTRACTID);
      srcNewsRCFile->SetPersistentDescriptor(
        nsDependentCString(pref->stringValue));

      // now make the copy
      PRBool exists;
      srcNewsRCFile->Exists(&exists);
      if (exists) {
        nsAutoString leafName;
        srcNewsRCFile->GetLeafName(leafName);
        // will fail if we've already copied a newsrc file here
        srcNewsRCFile->CopyTo(targetNewsRCFile,leafName);
        targetNewsRCFile->Append(leafName);

        // now write out the new descriptor
        nsCAutoString descriptorString;
        nsCOMPtr<nsILocalFile> localFile = do_QueryInterface(targetNewsRCFile);
        localFile->GetPersistentDescriptor(descriptorString);
        NS_Free(pref->stringValue);
        pref->stringValue = ToNewCString(descriptorString);
      }
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
  PRUint32 count = mFileCopyTransactions.Length();
  mMaxProgress = 0;
  mCurrentProgress = 0;

  for (PRUint32 i = 0; i < count; ++i) {
    fileTransactionEntry fileTransaction = mFileCopyTransactions[i];
    PRInt64 fileSize;
    fileTransaction.srcFile->GetFileSize(&fileSize);
    LL_ADD(mMaxProgress, mMaxProgress, fileSize);
  }

  CopyNextFolder();
}

void
nsNetscapeProfileMigratorBase::CopyNextFolder()
{
  if (mFileCopyTransactionIndex < mFileCopyTransactions.Length()) {
    PRUint32 percentage = 0;
    fileTransactionEntry fileTransaction =
      mFileCopyTransactions.ElementAt(mFileCopyTransactionIndex++);

    // copy the file
    fileTransaction.srcFile->CopyTo(fileTransaction.destFile,
                                    EmptyString());

    // add to our current progress
    PRInt64 fileSize;
    fileTransaction.srcFile->GetFileSize(&fileSize);
    LL_ADD(mCurrentProgress, mCurrentProgress, fileSize);

    PRInt64 percentDone;
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

  NOTIFY_OBSERVERS(MIGRATION_ENDED, nsnull);
}
