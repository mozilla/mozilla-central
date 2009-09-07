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
 * The Original Code is The Mail Profile Migrator.
 *
 * The Initial Developer of the Original Code is Scott MacGregor
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Scott MacGregor <mscott@mozilla.org>
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

// this file is mostly a copy of nsPrefMigration.cpp.

#include "nsMailProfileMigratorUtils.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIPrefService.h"
#include "nsISupportsPrimitives.h"
#include "nsNetUtil.h"
#include "nsDogbertProfileMigrator.h"
#include "nsIRelativeFilePref.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsVoidArray.h"
#include "prprf.h"
#include "prmem.h"
#include "prenv.h"
#include "NSReg.h"
#include "msgCore.h"
#include "nsDirectoryServiceUtils.h"
#include <limits.h>

// lots of includes required for the nsPrefMigration.cpp code that we copied:
#include "nsICharsetConverterManager.h"
#include "nsIPlatformCharset.h"

#define MIGRATION_PROPERTIES_URL "chrome://messenger/locale/migration/migration.properties"

#ifndef MAXPATHLEN
#ifdef PATH_MAX
#define MAXPATHLEN PATH_MAX
#elif defined(_MAX_PATH)
#define MAXPATHLEN _MAX_PATH
#elif defined(CCHMAXPATH)
#define MAXPATHLEN CCHMAXPATH
#else
#define MAXPATHLEN 1024
#endif
#endif

#if defined(XP_UNIX) && !defined(XP_MACOSX)
#define PREF_FILE_NAME_IN_4x      "preferences.js"
#define IMAP_MAIL_FILTER_FILE_NAME_IN_4x "mailrule"
#define POP_MAIL_FILTER_FILE_NAME_IN_4x "mailrule"
#define MAIL_SUMMARY_SUFFIX_IN_4x ".summary"
#define NEWS_SUMMARY_SUFFIX_IN_4x ".snm"
#define NEWSRC_PREFIX_IN_4x ".newsrc-"
#define SNEWSRC_PREFIX_IN_4x ".snewsrc-"
#define POPSTATE_FILE_IN_4x "popstate"
#define PSM_CERT7_DB "cert7.db"
#define PSM_KEY3_DB "key3.db"
#define PSM_SECMODULE_DB "secmodule.db"
#define HOME_ENVIRONMENT_VARIABLE         "HOME"
#define PROFILE_HOME_ENVIRONMENT_VARIABLE "PROFILE_HOME"
#define DEFAULT_UNIX_PROFILE_NAME         "default"
#elif defined(XP_MACOSX)
#define OLDREG_NAME               "Netscape Registry"
#define OLDREG_DIR                NS_MAC_PREFS_DIR
#define PREF_FILE_NAME_IN_4x      "Netscape Preferences"
#define MAC_RULES_FILE_ENDING_STRING_IN_4X " Rules"
#define IMAP_MAIL_FILTER_FILE_NAME_IN_4x "<hostname> Rules"
#define POP_MAIL_FILTER_FILE_NAME_IN_4x "Filter Rules"
#define MAIL_SUMMARY_SUFFIX_IN_4x ".snm"
#define NEWS_SUMMARY_SUFFIX_IN_4x ".snm"
#define POPSTATE_FILE_IN_4x "Pop State"
#define SECURITY_PATH "Security"
#define PSM_CERT7_DB "Certificates7"
#define PSM_KEY3_DB "Key Database3"
#define PSM_SECMODULE_DB "Security Modules"
#else /* XP_WIN || XP_OS2 */
#define PREF_FILE_NAME_IN_4x      "prefs.js"
#define IMAP_MAIL_FILTER_FILE_NAME_IN_4x "rules.dat"
#define POP_MAIL_FILTER_FILE_NAME_IN_4x "rules.dat"
#define MAIL_SUMMARY_SUFFIX_IN_4x ".snm"
#define NEWS_SUMMARY_SUFFIX_IN_4x ".snm"
#define OLDREG_NAME               "nsreg.dat"
#ifdef XP_WIN
#define OLDREG_DIR                NS_WIN_WINDOWS_DIR
#else
#define OLDREG_DIR                NS_OS2_DIR
#endif
// purposely not defined, since it was in the right place
// and with the right name in 4.x
//#define POPSTATE_FILE_IN_4x "popstate.dat"
#define PSM_CERT7_DB "cert7.db"
#define PSM_KEY3_DB "key3.db"
#define PSM_SECMODULE_DB "secmod.db"
#endif /* XP_UNIX */

#define SUMMARY_SUFFIX_IN_5x ".msf"
#define IMAP_MAIL_FILTER_FILE_NAME_IN_5x "rules.dat"
#define POP_MAIL_FILTER_FILE_NAME_IN_5x "rules.dat"
#define POPSTATE_FILE_IN_5x	"popstate.dat"

// only UNIX had movemail in 4.x
#if defined(XP_UNIX) && !defined(XP_MACOSX)
#define HAVE_MOVEMAIL 1
#endif /* XP_UNIX */

#define PREMIGRATION_PREFIX "premigration."
#define PREF_FILE_HEADER_STRING "# Mozilla User Preferences    "
#define MAX_PREF_LEN 1024

// this is for the hidden preference setting in mozilla/modules/libpref/src/init/mailnews.js
// pref("mail.migration.copyMailFiles", true);
//
// see bugzilla bug 80035 (http://bugzilla.mozilla.org/show_bug.cgi?id=80035)
//
// the default value for this setting is true which means when migrating from
// Netscape 4.x, mozilla will copy all the contents of Local Folders and Imap
// Folder to the newly created subfolders of migrated mozilla profile
// when this value is set to false, mozilla will not copy these contents and
// still share them with Netscape 4.x
//
// Advantages of forbidding copy operation:
//     reduce the disk usage
//     quick migration
// Disadvantage of forbidding copy operation:
//     without perfect lock mechamism, there is possibility of data corruption
//     when Netscape 4.x and mozilla run at the same time and access the same
//     mail file at the same time
#define PREF_MIGRATION_MODE_FOR_MAIL "mail.migration.copyMailFiles"
#define PREF_MAIL_DIRECTORY "mail.directory"
#define PREF_NEWS_DIRECTORY "news.directory"
#define PREF_MAIL_IMAP_ROOT_DIR "mail.imap.root_dir"
#define PREF_NETWORK_HOSTS_POP_SERVER "network.hosts.pop_server"
#define PREF_4X_NETWORK_HOSTS_IMAP_SERVER "network.hosts.imap_servers"
#define PREF_MAIL_SERVER_TYPE	"mail.server_type"
#define PREF_BROWSER_CACHE_DIRECTORY "browser.cache.directory"
#define POP_4X_MAIL_TYPE 0
#define IMAP_4X_MAIL_TYPE 1
#ifdef HAVE_MOVEMAIL
#define MOVEMAIL_4X_MAIL_TYPE 2
#define NEW_MOVEMAIL_DIR_NAME "movemail"
#endif /* HAVE_MOVEMAIL */

#if defined(XP_UNIX) && !defined(XP_MACOSX)
/* a 4.x profile on UNIX is rooted at something like
 * "/u/sspitzer/.netscape"
 * profile + OLD_MAIL_DIR_NAME = "/u/sspitzer/.netscape/../nsmail" = "/u/sspitzer/nsmail"
 * profile + OLD_NEWS_DIR_NAME = "/u/sspitzer/.netscape/xover-cache"
 * profile + OLD_IMAPMAIL_DIR_NAME = "/u/sspitzer/.netscape/../ns_imap" = "/u/sspitzer/ns_imap"
 * which is as good as we're going to get for defaults on UNIX.
 */
#define OLD_MAIL_DIR_NAME "/../nsmail"
#define OLD_NEWS_DIR_NAME "/xover-cache"
#define OLD_IMAPMAIL_DIR_NAME "/../ns_imap"
#else
#define OLD_MAIL_DIR_NAME "Mail"
#define OLD_NEWS_DIR_NAME "News"
#define OLD_IMAPMAIL_DIR_NAME "ImapMail"
#endif /* XP_UNIX */

#define NEW_MAIL_DIR_NAME "Mail"
#define NEW_NEWS_DIR_NAME "News"
#define NEW_IMAPMAIL_DIR_NAME "ImapMail"
#define NEW_LOCAL_MAIL_DIR_NAME "Local Folders"

#define NEW_DIR_SUFFIX "5"
#define PREF_FILE_NAME_IN_5x "prefs.js"

static PRBool nsCStringEndsWith(nsCString& name, const char *ending);

#ifdef NEED_TO_COPY_AND_RENAME_NEWSRC_FILES
static PRBool nsCStringStartsWith(nsCString& name, const char *starting);
#endif

///////////////////////////////////////////////////////////////////////////////
// nsDogbertProfileMigrator
struct PrefBranchStruct {
  char*         prefName;
  PRInt32       type;
  union {
    char*       stringValue;
    PRInt32     intValue;
    PRBool      boolValue;
    PRUnichar*  wstringValue;
  };
};

NS_IMPL_ISUPPORTS2(nsDogbertProfileMigrator, nsIMailProfileMigrator, nsITimerCallback)


nsDogbertProfileMigrator::nsDogbertProfileMigrator()
{
  mObserverService = do_GetService("@mozilla.org/observer-service;1");
  mMaxProgress = LL_ZERO;
  mCurrentProgress = LL_ZERO;
}

nsDogbertProfileMigrator::~nsDogbertProfileMigrator()
{
}

///////////////////////////////////////////////////////////////////////////////
// nsITimerCallback

NS_IMETHODIMP
nsDogbertProfileMigrator::Notify(nsITimer *timer)
{
  CopyNextFolder();
  return NS_OK;
}

void nsDogbertProfileMigrator::CopyNextFolder()
{
  if (mFileCopyTransactionIndex < mFileCopyTransactions->Count())
  {
    PRUint32 percentage = 0;
    fileTransactionEntry* fileTransaction = (fileTransactionEntry*) mFileCopyTransactions->SafeElementAt(mFileCopyTransactionIndex++);
    if (fileTransaction) // copy the file
    {
      fileTransaction->srcFile->CopyTo(fileTransaction->destFile, fileTransaction->newName);

      // add to our current progress
      PRInt64 fileSize;
      fileTransaction->srcFile->GetFileSize(&fileSize);
      LL_ADD(mCurrentProgress, mCurrentProgress, fileSize);

      PRInt64 percentDone;
      LL_MUL(percentDone, mCurrentProgress, 100);

      LL_DIV(percentDone, percentDone, mMaxProgress);

      LL_L2UI(percentage, percentDone);

      nsAutoString index;
      index.AppendInt( percentage );

      NOTIFY_OBSERVERS(MIGRATION_PROGRESS, index.get());
    }
    // fire a timer to handle the next one.
    mFileIOTimer = do_CreateInstance("@mozilla.org/timer;1");
    if (mFileIOTimer)
      mFileIOTimer->InitWithCallback(static_cast<nsITimerCallback *>(this), percentage == 100 ? 500 : 0, nsITimer::TYPE_ONE_SHOT);
  } else
    EndCopyFolders();

  return;
}

void nsDogbertProfileMigrator::EndCopyFolders()
{
  // clear out the file transaction array
  if (mFileCopyTransactions)
  {
    PRUint32 count = mFileCopyTransactions->Count();
    for (PRUint32 i = 0; i < count; ++i)
    {
      fileTransactionEntry* fileTransaction = (fileTransactionEntry*) mFileCopyTransactions->ElementAt(i);
      if (fileTransaction)
      {
        fileTransaction->srcFile = nsnull;
        fileTransaction->destFile = nsnull;
        delete fileTransaction;
      }
    }

    mFileCopyTransactions->Clear();
    delete mFileCopyTransactions;
  }

  // notify the UI that we are done with the migration process
  nsAutoString index;
  index.AppendInt(nsIMailProfileMigrator::MAILDATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());

  NOTIFY_OBSERVERS(MIGRATION_ENDED, nsnull);
}

///////////////////////////////////////////////////////////////////////////////
// nsIMailProfileMigrator

NS_IMETHODIMP
nsDogbertProfileMigrator::Migrate(PRUint16 aItems, nsIProfileStartup* aStartup, const PRUnichar* aProfile)
{
  nsresult rv = NS_OK;

  if (!mTargetProfile) {
    GetProfilePath(aStartup, mTargetProfile);
    if (!mTargetProfile) return NS_ERROR_FAILURE;
  }
  if (!mSourceProfile)
    GetSourceProfile(aProfile);

  NOTIFY_OBSERVERS(MIGRATION_STARTED, nsnull);

  rv = CopyPreferences();
  return rv;
}

NS_IMETHODIMP
nsDogbertProfileMigrator::GetMigrateData(const PRUnichar* aProfile,
                                           PRBool aReplace,
                                           PRUint16* aResult)
{
  // add some extra migration fields for things we also migrate
  *aResult |= nsIMailProfileMigrator::ACCOUNT_SETTINGS
           | nsIMailProfileMigrator::MAILDATA
           | nsIMailProfileMigrator::NEWSDATA
           | nsIMailProfileMigrator::ADDRESSBOOK_DATA;

  return NS_OK;
}

NS_IMETHODIMP
nsDogbertProfileMigrator::GetSourceExists(PRBool* aResult)
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
nsDogbertProfileMigrator::GetSourceHasMultipleProfiles(PRBool* aResult)
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

#if defined(XP_WIN) || defined(XP_OS2) || defined(XP_MACOSX)
NS_IMETHODIMP
nsDogbertProfileMigrator::GetSourceProfiles(nsIArray** aResult)
{
  if (!mProfiles) {
    nsresult rv;

    mProfiles = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIFile> regFile;
    rv = NS_GetSpecialDirectory(OLDREG_DIR, getter_AddRefs(regFile));
    NS_ENSURE_SUCCESS(rv, rv);
    regFile->AppendNative(NS_LITERAL_CSTRING(OLDREG_NAME));

    nsCAutoString path;
    rv = regFile->GetNativePath(path);
    NS_ENSURE_SUCCESS(rv, rv);

    if (NR_StartupRegistry())
      return NS_ERROR_FAILURE;

    HREG reg = nsnull;
    REGENUM enumstate = 0;

    if (NR_RegOpen(path.get(), &reg)) {
      NR_ShutdownRegistry();
      return NS_ERROR_FAILURE;
    }

    char profileName[MAXREGNAMELEN];
    while (!NR_RegEnumSubkeys(reg, ROOTKEY_USERS, &enumstate,
                              profileName, MAXREGNAMELEN, REGENUM_CHILDREN)) {
      nsCOMPtr<nsISupportsString> nameString
        (do_CreateInstance("@mozilla.org/supports-string;1"));
      if (nameString) {
        nameString->SetData(NS_ConvertUTF8toUTF16(profileName));
        mProfiles->AppendElement(nameString, PR_FALSE);
      }
    }
  }

  NS_IF_ADDREF(*aResult = mProfiles);
  return NS_OK;
}
#else // XP_UNIX

NS_IMETHODIMP
nsDogbertProfileMigrator::GetSourceProfiles(nsIArray** aResult)
{
  nsresult rv;
  const char* profileDir  = PR_GetEnv(PROFILE_HOME_ENVIRONMENT_VARIABLE);

  if (!profileDir) {
    profileDir = PR_GetEnv(HOME_ENVIRONMENT_VARIABLE);
  }
  if (!profileDir) return NS_ERROR_FAILURE;

  nsCAutoString profilePath(profileDir);
  profilePath += "/.netscape";

  nsCOMPtr<nsILocalFile> profileFile;
  rv = NS_NewNativeLocalFile(profilePath, PR_TRUE, getter_AddRefs(profileFile));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> prefFile;
  rv = profileFile->Clone(getter_AddRefs(prefFile));
  NS_ENSURE_SUCCESS(rv, rv);

  prefFile->AppendNative(NS_LITERAL_CSTRING("preferences.js"));

  PRBool exists;
  rv = prefFile->Exists(&exists);
  if (NS_FAILED(rv) || !exists) {
    return NS_ERROR_FAILURE;
  }

  mSourceProfile = profileFile;

  mProfiles = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsString> nameString
    (do_CreateInstance("@mozilla.org/supports-string;1"));
  if (!nameString) return NS_ERROR_FAILURE;

  nameString->SetData(NS_LITERAL_STRING("Netscape 4.x"));
  mProfiles->AppendElement(nameString, PR_FALSE);
  NS_ADDREF(*aResult = mProfiles);
  return NS_OK;
}

#endif // GetSourceProfiles

// on win/mac/os2, NS4x uses a registry to determine profile locations
#if defined(XP_WIN) || defined(XP_MACOSX) || defined(XP_OS2)
void nsDogbertProfileMigrator::GetSourceProfile(const PRUnichar* aProfile)
{
  nsresult rv;

  nsCOMPtr<nsIFile> regFile;
  rv = NS_GetSpecialDirectory(OLDREG_DIR, getter_AddRefs(regFile));
  if (NS_FAILED(rv)) return;

  regFile->AppendNative(NS_LITERAL_CSTRING(OLDREG_NAME));

  nsCAutoString path;
  rv = regFile->GetNativePath(path);
  if (NS_FAILED(rv)) return;

  if (NR_StartupRegistry())
    return;

  HREG reg = nsnull;
  RKEY profile = nsnull;

  if (NR_RegOpen(path.get(), &reg))
    goto cleanup;

  {
    // on macos, registry entries are UTF8 encoded
    NS_ConvertUTF16toUTF8 profileName(aProfile);

    if (NR_RegGetKey(reg, ROOTKEY_USERS, profileName.get(), &profile))
      goto cleanup;
  }

  char profilePath[MAXPATHLEN];
  if (NR_RegGetEntryString(reg, profile, "ProfileLocation", profilePath, MAXPATHLEN))
    goto cleanup;

  mSourceProfile = do_CreateInstance("@mozilla.org/file/local;1");
  if (!mSourceProfile) goto cleanup;

  {
    // the string is UTF8 encoded, which forces us to do some strange string-do
    rv = mSourceProfile->InitWithPath(NS_ConvertUTF8toUTF16(profilePath));
  }

  if (NS_FAILED(rv))
    mSourceProfile = nsnull;

cleanup:
  if (reg)
    NR_RegClose(reg);
  NR_ShutdownRegistry();
}
#else

void
nsDogbertProfileMigrator::GetSourceProfile(const PRUnichar* aProfile)
{
  // if GetSourceProfiles didn't do its magic, we're screwed
}

#endif


nsresult nsDogbertProfileMigrator::CopyPreferences()
{
  // Load the source pref file

  nsresult rv;
  mPrefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString oldProfDirStr;
  nsCAutoString newProfDirStr;

  nsCOMPtr<nsILocalFile> sourceProfile = do_QueryInterface(mSourceProfile);
  nsCOMPtr<nsILocalFile> targetProfile = do_QueryInterface(mTargetProfile);

  sourceProfile->GetPersistentDescriptor(oldProfDirStr);
  targetProfile->GetPersistentDescriptor(newProfDirStr);

  nsAutoString index;
  index.AppendInt(nsIMailProfileMigrator::MAILDATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());

  ProcessPrefsCallback(oldProfDirStr.get(), newProfDirStr.get());

  // Generate the max progress value now that we know all of the files we need to copy
  PRUint32 count = mFileCopyTransactions->Count();
  for (PRUint32 i = 0; i < count; ++i)
  {
    fileTransactionEntry* fileTransaction = (fileTransactionEntry*) mFileCopyTransactions->ElementAt(i);
    if (fileTransaction)
    {
      PRInt64 fileSize;
      fileTransaction->srcFile->GetFileSize(&fileSize);
      LL_ADD(mMaxProgress, mMaxProgress, fileSize);
    }
  }

  CopyNextFolder();
  return NS_OK;
}

/*--------------------------------------------------------------------------
 * ProcessPrefsCallback is the primary funtion for the class nsPrefMigration.
 *
 * Called by: The Profile Manager (nsProfile.cpp)
 * INPUT: The specific profile path (prefPath) and the 5.0 installed path
 * OUTPUT: The modified 5.0 prefs files
 * RETURN: Success or a failure code
 *
 *-------------------------------------------------------------------------*/
nsresult
nsDogbertProfileMigrator::ProcessPrefsCallback(const char* oldProfilePathStr, const char * newProfilePathStr)
{
  nsresult rv;

  nsCOMPtr<nsILocalFile> oldProfilePath;
  nsCOMPtr<nsILocalFile> newProfilePath;
  nsCOMPtr<nsILocalFile> oldPOPMailPath;
  nsCOMPtr<nsILocalFile> newPOPMailPath;
  nsCOMPtr<nsILocalFile> oldIMAPMailPath;
  nsCOMPtr<nsILocalFile> newIMAPMailPath;
  nsCOMPtr<nsILocalFile> oldIMAPLocalMailPath;
  nsCOMPtr<nsILocalFile> newIMAPLocalMailPath;
  nsCOMPtr<nsILocalFile> oldNewsPath;
  nsCOMPtr<nsILocalFile> newNewsPath;
  nsCOMPtr<nsILocalFile> newPrefsFile;
#ifdef HAVE_MOVEMAIL
  nsCOMPtr<nsILocalFile> oldMOVEMAILMailPath;
  nsCOMPtr<nsILocalFile> newMOVEMAILMailPath;
#endif /* HAVE_MOVEMAIL */
  PRBool exists                  = PR_FALSE,
         enoughSpace             = PR_TRUE,
         localMailDriveDefault   = PR_FALSE,
         summaryMailDriveDefault = PR_FALSE,
         newsDriveDefault        = PR_FALSE,
         copyMailFileInMigration = PR_TRUE;

  nsCOMPtr <nsILocalFile> localMailFile;
  nsCOMPtr <nsILocalFile> summaryMailFile;
  nsCOMPtr <nsILocalFile> newsFile;
  nsCOMPtr <nsILocalFile> oldProfileFile;
  nsCOMPtr <nsILocalFile> newProfileFile;

  PRInt32 serverType = POP_4X_MAIL_TYPE;
  char *popServerName = nsnull;

  PRUint32          totalRequired = 0;


  PRInt64  localMailDrive   = LL_Zero(),
           summaryMailDrive = LL_Zero(),
           newsDrive        = LL_Zero(),
    totalSummaryFileSize = LL_Zero(),
    profileDrive     = LL_Zero(),
           totalLocalMailSize = LL_Zero(),
    totalNewsSize = LL_Zero(),
           totalProfileSize = LL_Zero();

  PRInt64  DriveID[MAX_DRIVES];
  PRUint32 SpaceRequired[MAX_DRIVES];

#if defined(NS_DEBUG)
  printf("*Entered Actual Migration routine*\n");
#endif

  nsCOMPtr<nsIPrefService> prefService = do_QueryInterface(mPrefs, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  for (int i=0; i < MAX_DRIVES; i++)
  {
    DriveID[i] = LL_Zero();
    SpaceRequired[i] = 0;
  }

  oldProfilePath = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;
  newProfilePath = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = ConvertPersistentStringToFile(oldProfilePathStr, oldProfilePath);
  if (NS_FAILED(rv)) return rv;
  rv = ConvertPersistentStringToFile(newProfilePathStr, newProfilePath);
  if (NS_FAILED(rv)) return rv;

  oldProfileFile = oldProfilePath;
  newProfileFile = newProfilePath;

  /* initialize prefs with the old prefs.js file (which is a copy of the 4.x preferences file) */
  nsCOMPtr<nsILocalFile> PrefsFile4x = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);

  rv = PrefsFile4x->InitWithFile(oldProfilePath);
  if (NS_FAILED(rv)) return rv;

  rv = PrefsFile4x->AppendNative(NS_LITERAL_CSTRING(PREF_FILE_NAME_IN_4x));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIFile> systemTempDir;
  rv = NS_GetSpecialDirectory(NS_OS_TEMP_DIR, getter_AddRefs(systemTempDir));
  if (NS_FAILED(rv)) return rv;

  systemTempDir->AppendNative(NS_LITERAL_CSTRING("migrate"));

  //Create a unique directory in the system temp dir based on the name of the 4.x prefs file
  rv = systemTempDir->CreateUnique(nsIFile::DIRECTORY_TYPE, 0700);
  if (NS_FAILED(rv)) return rv;

  rv = PrefsFile4x->CopyToNative(systemTempDir, NS_LITERAL_CSTRING(PREF_FILE_NAME_IN_4x));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIFile> cloneFile;
  rv = systemTempDir->Clone(getter_AddRefs(cloneFile));
  if (NS_FAILED(rv)) return rv;

  m_prefsFile = do_QueryInterface(cloneFile, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = m_prefsFile->AppendNative(NS_LITERAL_CSTRING(PREF_FILE_NAME_IN_4x));
  if (NS_FAILED(rv)) return rv;

  //Clear the prefs in case a previous set was read in.
  prefService->ResetPrefs();

  //Now read the prefs from the prefs file in the system directory
  prefService->ReadUserPrefs(m_prefsFile);

  // Start computing the sizes required for migration
  //
  rv = GetSizes(oldProfileFile, PR_FALSE, &totalProfileSize);
  newProfileFile->GetDiskSpaceAvailable(&profileDrive);

  rv = mPrefs->GetIntPref(PREF_MAIL_SERVER_TYPE, &serverType);
  if (NS_FAILED(rv)) return rv;

  // get the migration mode for mail
  rv = mPrefs->GetBoolPref(PREF_MIGRATION_MODE_FOR_MAIL, &copyMailFileInMigration);
  if (NS_FAILED(rv))
    return rv;

  if (serverType == POP_4X_MAIL_TYPE) {
    summaryMailDriveDefault = PR_TRUE; //summary files are only used in IMAP so just set it to true here.
    summaryMailDrive = profileDrive;   //just set the drive for summary files to be the same as the new profile

    rv = GetDirFromPref(oldProfilePath,newProfilePath,NEW_MAIL_DIR_NAME, PREF_MAIL_DIRECTORY,
                        getter_AddRefs(newPOPMailPath), getter_AddRefs(oldPOPMailPath));
    if (NS_FAILED(rv)) {
      rv = DetermineOldPath(oldProfilePath, OLD_MAIL_DIR_NAME, "mailDirName", oldPOPMailPath);
      if (NS_FAILED(rv)) return rv;

      rv = SetPremigratedFilePref(PREF_MAIL_DIRECTORY, oldPOPMailPath);
      if (NS_FAILED(rv)) return rv;

      newPOPMailPath->InitWithFile(newProfilePath);
      if (NS_FAILED(rv)) return rv;

      localMailDriveDefault = PR_TRUE;
    }
    localMailFile = oldPOPMailPath;
    rv = GetSizes(localMailFile, PR_TRUE, &totalLocalMailSize);
    localMailFile->GetDiskSpaceAvailable(&localMailDrive);
  }
  else if(serverType == IMAP_4X_MAIL_TYPE) {
    /* First get the actual 4.x "Local Mail" files location */
    rv = GetDirFromPref(oldProfilePath,newProfilePath, NEW_MAIL_DIR_NAME, PREF_MAIL_DIRECTORY,
                        getter_AddRefs(newIMAPLocalMailPath), getter_AddRefs(oldIMAPLocalMailPath));
    if (NS_FAILED(rv)) {
      rv = DetermineOldPath(oldProfilePath, OLD_MAIL_DIR_NAME, "mailDirName", oldIMAPLocalMailPath);
      if (NS_FAILED(rv)) return rv;

      rv = SetPremigratedFilePref(PREF_MAIL_DIRECTORY, oldIMAPLocalMailPath);
      if (NS_FAILED(rv)) return rv;

      rv = newIMAPLocalMailPath->InitWithFile(newProfilePath);
      if (NS_FAILED(rv)) return rv;

      localMailDriveDefault = PR_TRUE;
    }

    localMailFile = oldIMAPLocalMailPath;
    rv = GetSizes(localMailFile, PR_TRUE, &totalLocalMailSize);
    localMailFile->GetDiskSpaceAvailable(&localMailDrive);

    /* Next get IMAP mail summary files location */
    rv = GetDirFromPref(oldProfilePath,newProfilePath, NEW_IMAPMAIL_DIR_NAME, PREF_MAIL_IMAP_ROOT_DIR,
                        getter_AddRefs(newIMAPMailPath), getter_AddRefs(oldIMAPMailPath));
    if (NS_FAILED(rv)) {
      rv = oldIMAPMailPath->InitWithFile(oldProfilePath);
      if (NS_FAILED(rv)) return rv;

      /* we didn't over localize "ImapMail" in 4.x, so this is all we have to do */
      rv = oldIMAPMailPath->AppendNative(NS_LITERAL_CSTRING(OLD_IMAPMAIL_DIR_NAME));
      if (NS_FAILED(rv)) return rv;

      rv = SetPremigratedFilePref(PREF_MAIL_IMAP_ROOT_DIR, oldIMAPMailPath);
      if (NS_FAILED(rv)) return rv;

      rv = newIMAPMailPath->InitWithFile(newProfilePath);
      if (NS_FAILED(rv)) return rv;

      summaryMailDriveDefault = PR_TRUE;
    }

    summaryMailFile = oldIMAPMailPath;
    rv = GetSizes(summaryMailFile, PR_TRUE, &totalSummaryFileSize);
    summaryMailFile->GetDiskSpaceAvailable(&summaryMailDrive);
  }

#ifdef HAVE_MOVEMAIL
  else if (serverType == MOVEMAIL_4X_MAIL_TYPE) {

    summaryMailDriveDefault = PR_TRUE;
    summaryMailDrive = profileDrive;

    rv = GetDirFromPref(oldProfilePath,newProfilePath,NEW_MAIL_DIR_NAME, PREF_MAIL_DIRECTORY,
                        getter_AddRefs(newMOVEMAILMailPath), getter_AddRefs(oldMOVEMAILMailPath));
    if (NS_FAILED(rv)) {
      rv = oldMOVEMAILMailPath->InitWithFile(oldProfilePath);
      if (NS_FAILED(rv)) return rv;

      /* we didn't over localize this in 4.x, so this is all we have to do */
      rv = oldMOVEMAILMailPath->AppendNative(NS_LITERAL_CSTRING(OLD_MAIL_DIR_NAME));
      if (NS_FAILED(rv)) return rv;

      rv = SetPremigratedFilePref(PREF_MAIL_DIRECTORY, oldMOVEMAILMailPath);
      if (NS_FAILED(rv)) return rv;

      rv = newMOVEMAILMailPath->InitWithFile(newProfilePath);
      if (NS_FAILED(rv)) return rv;

      localMailDriveDefault = PR_TRUE;
    }
    localMailFile = oldMOVEMAILMailPath;
    rv = GetSizes(localMailFile, PR_TRUE, &totalLocalMailSize);

    localMailFile->GetDiskSpaceAvailable(&localMailDrive);

  }
#endif //HAVE_MOVEMAIL

    ////////////////////////////////////////////////////////////////////////////
    // Now get the NEWS disk space requirements for migration.
    ////////////////////////////////////////////////////////////////////////////
    rv = GetDirFromPref(oldProfilePath,newProfilePath, NEW_NEWS_DIR_NAME, PREF_NEWS_DIRECTORY,
                        getter_AddRefs(newNewsPath), getter_AddRefs(oldNewsPath));
    if (NS_FAILED(rv)) {
      rv = DetermineOldPath(oldProfilePath, OLD_NEWS_DIR_NAME, "newsDirName", oldNewsPath);
      if (NS_FAILED(rv)) return rv;

      rv = SetPremigratedFilePref(PREF_NEWS_DIRECTORY, oldNewsPath);
      if (NS_FAILED(rv)) return rv;

      rv = newNewsPath->InitWithFile(newProfilePath);
      if (NS_FAILED(rv)) return rv;

      newsDriveDefault = PR_TRUE;
    }
    rv = GetSizes(oldNewsPath, PR_TRUE, &totalNewsSize);
    oldNewsPath->GetDiskSpaceAvailable(&newsDrive);

    //
    // Compute the space needed to migrate the profile
    //
    if(newsDriveDefault && localMailDriveDefault && summaryMailDriveDefault) // DEFAULT: All on the same drive
    {
      totalRequired = totalNewsSize + totalLocalMailSize + totalSummaryFileSize + totalProfileSize;
      rv = ComputeSpaceRequirements(DriveID, SpaceRequired, profileDrive, totalRequired);
      if (NS_FAILED(rv))
        enoughSpace = PR_FALSE;
    }
    else
    {
      rv = ComputeSpaceRequirements(DriveID, SpaceRequired, profileDrive, totalProfileSize);
      if (NS_FAILED(rv))
        enoughSpace = PR_FALSE;
      rv = ComputeSpaceRequirements(DriveID, SpaceRequired, localMailDrive, totalLocalMailSize);
      if (NS_FAILED(rv))
        enoughSpace = PR_FALSE;
      rv = ComputeSpaceRequirements(DriveID, SpaceRequired, summaryMailDrive, totalSummaryFileSize);
      if (NS_FAILED(rv))
        enoughSpace = PR_FALSE;
      rv = ComputeSpaceRequirements(DriveID, SpaceRequired, newsDrive, totalNewsSize);
      if (NS_FAILED(rv))
        enoughSpace = PR_FALSE;
    }

    // do something if not enough space

  ////////////////////////////////////////////////////////////////////////////
  // If we reached this point, there is enough room to do a migration.
  // Start creating directories and setting new pref values.
  ////////////////////////////////////////////////////////////////////////////

  /* Create the new profile tree for 5.x */
  rv = CreateNewUser5Tree(oldProfilePath, newProfilePath);
  if (NS_FAILED(rv)) return rv;


  if (serverType == POP_4X_MAIL_TYPE) {

    rv = newPOPMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newPOPMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    rv = newPOPMailPath->AppendNative(NS_LITERAL_CSTRING(NEW_MAIL_DIR_NAME));
    if (NS_FAILED(rv)) return rv;

    rv = newPOPMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newPOPMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    rv = mPrefs->SetComplexValue(PREF_MAIL_DIRECTORY, NS_GET_IID(nsILocalFile), newPOPMailPath);
    if (NS_FAILED(rv)) return rv;

    mPrefs->GetCharPref(PREF_NETWORK_HOSTS_POP_SERVER, &popServerName);

    nsCAutoString popServerNamewithoutPort(popServerName);
    PRInt32 colonPos = popServerNamewithoutPort.FindChar(':');

    if (colonPos != -1 ) {
      popServerNamewithoutPort.SetLength(colonPos);
      rv = newPOPMailPath->AppendNative(popServerNamewithoutPort);
    }
    else
      rv = newPOPMailPath->AppendNative(nsDependentCString(popServerName));

    if (NS_FAILED(rv)) return rv;

    rv = newPOPMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newPOPMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }
  }
  else if (serverType == IMAP_4X_MAIL_TYPE) {
   if( copyMailFileInMigration )  // copy mail files in migration
   {
     rv = newIMAPLocalMailPath->Exists(&exists);
     if (NS_FAILED(rv)) return rv;
     if (!exists)  {
        rv = newIMAPLocalMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
        if (NS_FAILED(rv)) return rv;
     }

    rv = newIMAPLocalMailPath->AppendNative(NS_LITERAL_CSTRING(NEW_MAIL_DIR_NAME));
    if (NS_FAILED(rv)) return rv;

    /* Now create the new "Mail/Local Folders" directory */
    rv = newIMAPLocalMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      newIMAPLocalMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
    }

    rv = mPrefs->SetComplexValue(PREF_MAIL_DIRECTORY, NS_GET_IID(nsILocalFile), newIMAPLocalMailPath);
    if (NS_FAILED(rv)) return rv;

    rv = newIMAPLocalMailPath->AppendNative(NS_LITERAL_CSTRING(NEW_LOCAL_MAIL_DIR_NAME));
    if (NS_FAILED(rv)) return rv;
    rv = newIMAPLocalMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newIMAPLocalMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    /* Now deal with the IMAP mail summary file location */
    rv = newIMAPMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newIMAPMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    rv = newIMAPMailPath->AppendNative(NS_LITERAL_CSTRING(NEW_IMAPMAIL_DIR_NAME));
    if (NS_FAILED(rv)) return rv;

    rv = newIMAPMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newIMAPMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    {
      rv = mPrefs->SetComplexValue(PREF_MAIL_IMAP_ROOT_DIR, NS_GET_IID(nsILocalFile), newIMAPMailPath);
      if (NS_FAILED(rv)) return rv;
    }
   }
   else
   {
      rv = mPrefs->SetComplexValue(PREF_MAIL_DIRECTORY, NS_GET_IID(nsILocalFile), oldIMAPLocalMailPath);
      if (NS_FAILED(rv)) return rv;
      rv = mPrefs->SetComplexValue(PREF_MAIL_IMAP_ROOT_DIR, NS_GET_IID(nsILocalFile), oldIMAPMailPath);
      if (NS_FAILED(rv)) return rv;
   }
  }

#ifdef HAVE_MOVEMAIL
  else if (serverType == MOVEMAIL_4X_MAIL_TYPE) {

    rv = newMOVEMAILMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newMOVEMAILMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    rv = newMOVEMAILMailPath->AppendNative(NS_LITERAL_CSTRING(NEW_MAIL_DIR_NAME));
    if (NS_FAILED(rv)) return rv;

    rv = newMOVEMAILMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newMOVEMAILMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    rv = mPrefs->SetComplexValue(PREF_MAIL_DIRECTORY, NS_GET_IID(nsILocalFile), newMOVEMAILMailPath);
    if (NS_FAILED(rv)) return rv;

    rv = newMOVEMAILMailPath->AppendNative(NS_LITERAL_CSTRING(NEW_MOVEMAIL_DIR_NAME));
    if (NS_FAILED(rv)) return rv;

    rv = newMOVEMAILMailPath->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
    if (!exists)  {
      rv = newMOVEMAILMailPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }
    rv = NS_OK;
  }
#endif /* HAVE_MOVEMAIL */
  else {
    NS_ERROR("failure, didn't recognize your mail server type.");
    return NS_ERROR_UNEXPECTED;
  }

  ////////////////////////////////////////////////////////////////////////////
  // Set all the appropriate NEWS prefs.
  ////////////////////////////////////////////////////////////////////////////

  rv = newNewsPath->Exists(&exists);
  if (NS_FAILED(rv)) return rv;
  if (!exists)  {
    rv = newNewsPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
    if (NS_FAILED(rv)) return rv;
  }

  rv = newNewsPath->AppendNative(NS_LITERAL_CSTRING(NEW_NEWS_DIR_NAME));
  if (NS_FAILED(rv)) return rv;

  rv = newNewsPath->Exists(&exists);
  if (NS_FAILED(rv)) return rv;
  if (!exists)  {
    rv = newNewsPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
    if (NS_FAILED(rv)) return rv;
  }

  rv = mPrefs->SetComplexValue(PREF_NEWS_DIRECTORY, NS_GET_IID(nsILocalFile), newNewsPath);
  if (NS_FAILED(rv)) return rv;

  PRBool needToRenameFilterFiles;
  if (PL_strcmp(IMAP_MAIL_FILTER_FILE_NAME_IN_4x,IMAP_MAIL_FILTER_FILE_NAME_IN_5x)) {
#ifdef IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x
    // if we defined a format, the filter files don't live in the host directories
    // (mac does this.)  we'll take care of those filter files later, in DoSpecialUpdates()
    needToRenameFilterFiles = PR_FALSE;
#else
    needToRenameFilterFiles = PR_TRUE;
#endif /* IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x */
  }
  else {
    // if the name was the same in 4x as in 5x, no need to rename it
    needToRenameFilterFiles = PR_FALSE;
  }

  // just copy what we need
#ifdef XP_MACOSX
  rv = DoTheCopy(oldProfilePath, newProfilePath, SECURITY_PATH, PR_TRUE);
  if (NS_FAILED(rv)) return rv;
#else
  rv = DoTheCopy(oldProfilePath, newProfilePath, PSM_CERT7_DB);
  if (NS_FAILED(rv)) return rv;
  rv = DoTheCopy(oldProfilePath, newProfilePath, PSM_KEY3_DB);
  if (NS_FAILED(rv)) return rv;
  rv = DoTheCopy(oldProfilePath, newProfilePath, PSM_SECMODULE_DB);
  if (NS_FAILED(rv)) return rv;
#endif /* XP_MACOSX */

#ifdef XP_MACOSX
  // Copy the Mac filter rule files which sits at the top level dir of a 4.x profile.
  if(serverType == IMAP_4X_MAIL_TYPE) {
    rv = CopyFilesByPattern(oldProfilePath, newProfilePath, MAC_RULES_FILE_ENDING_STRING_IN_4X);
    NS_ENSURE_SUCCESS(rv,rv);
  }
#endif

  rv = DoTheCopy(oldNewsPath, newNewsPath, PR_TRUE);
  if (NS_FAILED(rv)) return rv;

#ifdef NEED_TO_COPY_AND_RENAME_NEWSRC_FILES
  /* in 4.x, the newsrc files were in $HOME.  Now that we can have multiple
   * profiles in 5.x, with the same user, this won't fly.
   * when they migrate, we need to copy from $HOME/.newsrc-<host> to
   * ~/.mozilla/<profile>/News/newsrc-<host>
   */
  rv = CopyAndRenameNewsrcFiles(newNewsPath);
  if (NS_FAILED(rv)) return rv;
#endif /* NEED_TO_COPY_AND_RENAME_NEWSRC_FILES */

  if (serverType == IMAP_4X_MAIL_TYPE) {
    if( copyMailFileInMigration )  // copy mail files in migration
    {
    rv = DoTheCopyAndRename(oldIMAPMailPath, newIMAPMailPath, PR_TRUE, needToRenameFilterFiles, IMAP_MAIL_FILTER_FILE_NAME_IN_4x, IMAP_MAIL_FILTER_FILE_NAME_IN_5x);
    if (NS_FAILED(rv)) return rv;
    rv = DoTheCopyAndRename(oldIMAPLocalMailPath, newIMAPLocalMailPath, PR_TRUE, needToRenameFilterFiles,IMAP_MAIL_FILTER_FILE_NAME_IN_4x,IMAP_MAIL_FILTER_FILE_NAME_IN_5x);
    if (NS_FAILED(rv)) return rv;
    }
    else  // Copy & Rename filter files
    {
      // IMAP path
      // don't care if this fails
      (void)DoTheCopyAndRename(oldIMAPMailPath, PR_TRUE, IMAP_MAIL_FILTER_FILE_NAME_IN_4x, IMAP_MAIL_FILTER_FILE_NAME_IN_5x);

      // Local Folders path
      // don't care if this fails
      (void)DoTheCopyAndRename(oldIMAPLocalMailPath, PR_TRUE, IMAP_MAIL_FILTER_FILE_NAME_IN_4x, IMAP_MAIL_FILTER_FILE_NAME_IN_5x);
    }
  }
  else if (serverType == POP_4X_MAIL_TYPE) {
    // fix for bug #202010
    // copy over the pop filter and popstate files now
    // and later, in DoSpecialUpdates()
    // we'll move and rename them
#ifdef POP_MAIL_FILTER_FILE_NAME_IN_4x
    rv = DoTheCopy(oldProfilePath, newProfilePath, POP_MAIL_FILTER_FILE_NAME_IN_4x);
    if (NS_FAILED(rv)) return rv;
#endif

#ifdef POPSTATE_FILE_IN_4x
    rv = DoTheCopy(oldProfilePath, newProfilePath, POPSTATE_FILE_IN_4x);
    if (NS_FAILED(rv)) return rv;
#endif

    rv = DoTheCopy(oldPOPMailPath, newPOPMailPath, PR_TRUE);
    if (NS_FAILED(rv)) return rv;
  }
#ifdef HAVE_MOVEMAIL
  else if (serverType == MOVEMAIL_4X_MAIL_TYPE) {
    // in 4.x, the movemail filter name was the same as the pop filter name
    // copy over the filter file now
    // and later, in DoSpecialUpdates()
    // we'll move and rename them
    rv = DoTheCopy(oldProfilePath, newProfilePath, POP_MAIL_FILTER_FILE_NAME_IN_4x);
    if (NS_FAILED(rv)) return rv;

    rv = DoTheCopy(oldMOVEMAILMailPath, newMOVEMAILMailPath, PR_TRUE);
  }
#endif /* HAVE_MOVEMAIL */
  else {
    NS_ERROR("unknown mail server type!");
    return NS_ERROR_FAILURE;
  }

  // Don't inherit the 4.x cache file location for mozilla!
  // The cache pref later gets set with a default in nsAppRunner::InitCachePrefs().
  mPrefs->ClearUserPref(PREF_BROWSER_CACHE_DIRECTORY);

  rv = DoSpecialUpdates(newProfilePath);
  if (NS_FAILED(rv)) return rv;
    PR_FREEIF(popServerName);

  nsCString path;

  newProfilePath->GetNativePath(path);
  NS_NewNativeLocalFile(path, PR_TRUE, getter_AddRefs(newPrefsFile));

  rv = newPrefsFile->AppendNative(NS_LITERAL_CSTRING(PREF_FILE_NAME_IN_5x));
  if (NS_FAILED(rv)) return rv;

  rv = prefService->SavePrefFile(newPrefsFile);
  if (NS_FAILED(rv)) return rv;
  rv = prefService->ResetPrefs();
  if (NS_FAILED(rv)) return rv;

  PRBool flagExists = PR_FALSE;
  m_prefsFile->Exists(&flagExists); //Delete the prefs.js file in the temp directory.
  if (flagExists)
    m_prefsFile->Remove(PR_FALSE);

  systemTempDir->Exists(&flagExists); //Delete the unique dir in the system temp dir.
  if (flagExists)
    systemTempDir->Remove(PR_FALSE);

  return rv;
}

nsresult nsDogbertProfileMigrator::CreateNewUser5Tree(nsILocalFile * oldProfilePath, nsILocalFile * newProfilePath)
{
  nsresult rv;
  PRBool exists;

  NS_ASSERTION(*PREF_FILE_NAME_IN_4x, "don't know how to migrate your platform");
  if (!*PREF_FILE_NAME_IN_4x) {
    return NS_ERROR_UNEXPECTED;
  }

  /* Copy the old prefs file to the new profile directory for modification and reading.
     after copying it, rename it to pref.js, the 5.x pref file name on all platforms */
  nsCOMPtr<nsILocalFile> oldPrefsFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = oldPrefsFile->InitWithFile(oldProfilePath);
  if (NS_FAILED(rv)) return rv;

  rv = oldPrefsFile->AppendNative(NS_LITERAL_CSTRING(PREF_FILE_NAME_IN_4x));
  if (NS_FAILED(rv)) return rv;

  /* the new prefs file */
  nsCOMPtr<nsILocalFile> newPrefsFile  = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = newPrefsFile->InitWithFile(newProfilePath);
  if (NS_FAILED(rv)) return rv;

  rv = newPrefsFile->Exists(&exists);
  if (!exists)
    rv = newPrefsFile->Create(nsIFile::DIRECTORY_TYPE, 0700);

  rv = oldPrefsFile->CopyTo(newPrefsFile, EmptyString());
  NS_ASSERTION(NS_SUCCEEDED(rv),"failed to copy prefs file");

  rv = newPrefsFile->AppendNative(NS_LITERAL_CSTRING(PREF_FILE_NAME_IN_4x));
  rv = newPrefsFile->MoveTo(nsnull, NS_LITERAL_STRING(PREF_FILE_NAME_IN_5x));

  return NS_OK;
}

#ifdef NEED_TO_COPY_AND_RENAME_NEWSRC_FILES
nsresult nsDogbertProfileMigrator::CopyAndRenameNewsrcFiles(nsILocalFile * newPathFile)
{
  nsresult rv;
  nsCOMPtr <nsILocalFile> oldPathFile;
  nsCAutoString fileOrDirNameStr;

  rv = GetPremigratedFilePref(PREF_NEWS_DIRECTORY, getter_AddRefs(oldPathFile));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  rv = oldPathFile->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  directoryEnumerator->HasMoreElements(&hasMore);
  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsIFile> currentFile(do_QueryInterface(aSupport, &rv));
    nsCOMPtr<nsILocalFile> curLocalFile = do_QueryInterface(currentFile);

    currentFile->GetNativeLeafName(fileOrDirNameStr);

    if (nsCStringStartsWith(fileOrDirNameStr, NEWSRC_PREFIX_IN_4x) || nsCStringStartsWith(fileOrDirNameStr, SNEWSRC_PREFIX_IN_4x)) {
        rv = currentFile->CopyTo(newPathFile, EmptyString());
        NS_ASSERTION(NS_SUCCEEDED(rv),"failed to copy news file");

        nsCOMPtr <nsIFile> newFile;
        newPathFile->Clone(getter_AddRefs(newFile));
        if (newFile)
        {
          newFile->AppendNative(fileOrDirNameStr);
          fileOrDirNameStr.Cut(0, 1);
          newFile->MoveToNative(nsnull, fileOrDirNameStr); /* rename .newsrc-news to newsrc-news, no need to keep it hidden anymore */

        }
    }
  }

  return NS_OK;
}
#endif /* NEED_TO_COPY_AND_RENAME_NEWSRC_FILES */


/*-------------------------------------------------------------------------
 * DoTheCopyAndRename copies the files listed in oldPath to newPath
 *                    and renames files, if necessary
 *
 * INPUT: oldPath - The old profile path plus the specific data type
 *                  (e.g. mail or news)
 *        newPath - The new profile path plus the specific data type
 *
 *        readSubdirs
 *
 *        needToRenameFiles - do we need to search for files named oldFile
 *                            and rename them to newFile
 *
 *        oldFile           - old file name (used for renaming)
 *
 *        newFile           - new file name (used for renaming)
 *
 * RETURNS: NS_OK if successful
 *          NS_ERROR_FAILURE if failed
 *
 *--------------------------------------------------------------------------*/
nsresult nsDogbertProfileMigrator::DoTheCopyAndRename(nsIFile * oldPathFile, nsIFile *newPathFile, PRBool readSubdirs, PRBool needToRenameFiles, const char *oldName, const char *newName)
{
  nsresult rv;
  nsCAutoString fileOrDirNameStr;

  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  rv = oldPathFile->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  directoryEnumerator->HasMoreElements(&hasMore);
  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsIFile> currentFile(do_QueryInterface(aSupport, &rv));
    nsCOMPtr<nsILocalFile> curLocalFile = do_QueryInterface(currentFile);

    currentFile->GetNativeLeafName(fileOrDirNameStr);

    if (nsCStringEndsWith(fileOrDirNameStr, MAIL_SUMMARY_SUFFIX_IN_4x) || nsCStringEndsWith(fileOrDirNameStr, NEWS_SUMMARY_SUFFIX_IN_4x) ||
          nsCStringEndsWith(fileOrDirNameStr, SUMMARY_SUFFIX_IN_5x)) /* Don't copy the summary files */
      continue;
    else
    {
      PRBool isDirectory = PR_FALSE;
      currentFile->IsDirectory(&isDirectory);
      if (isDirectory)
      {
        if(readSubdirs)
        {
          nsCOMPtr<nsIFile> newPathExtended;
          rv = newPathFile->Clone(getter_AddRefs(newPathExtended));
          NS_ENSURE_SUCCESS(rv, rv);
          rv = newPathExtended->AppendNative(fileOrDirNameStr);
          rv = newPathExtended->Create(nsIFile::DIRECTORY_TYPE, 0700);

          DoTheCopyAndRename(curLocalFile, newPathExtended, PR_TRUE, needToRenameFiles, oldName, newName); /* re-enter the DoTheCopyAndRename function */
        }
        else
          continue;
      }
      else {
        // copy the file
        if (fileOrDirNameStr.Equals(oldName))
          AddFileCopyToList(curLocalFile, newPathFile, newName);
        else
          AddFileCopyToList(curLocalFile, newPathFile, "");
      }
    }
  }

  return NS_OK;
}

/*-------------------------------------------------------------------------
 * DoTheCopyAndRename copies and renames files
 *
 * INPUT: aPath - the path
 *
 *        aReadSubdirs - if sub directories should be handled
 *
 *        aOldFile - old file name (used for renaming)
 *
 *        aNewFile - new file name (used for renaming)
 *
 * RETURNS: NS_OK if successful
 *          NS_ERROR_FAILURE if failed
 *
 *--------------------------------------------------------------------------*/
nsresult nsDogbertProfileMigrator::DoTheCopyAndRename(nsIFile * aPathFile, PRBool aReadSubdirs, const char *aOldName, const char *aNewName)
{
  if( !aOldName || !aNewName || !strcmp(aOldName, aNewName) )
    return NS_ERROR_FAILURE;

  nsCOMPtr <nsIFile> file;
  nsresult rv = aPathFile->Clone(getter_AddRefs(file));
  NS_ENSURE_SUCCESS(rv, rv);
  file->AppendNative(nsDependentCString(aOldName));

  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  rv = aPathFile->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  directoryEnumerator->HasMoreElements(&hasMore);
  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsILocalFile> currentFile(do_QueryInterface(aSupport, &rv));
    // Handle sub folders
    PRBool isDirectory = PR_FALSE;
    currentFile->IsDirectory(&isDirectory);
    if (isDirectory)
    {
      if( aReadSubdirs )
      {
        nsCOMPtr<nsIFile>fileOrDirName;
        currentFile->Clone(getter_AddRefs(fileOrDirName));
        DoTheCopyAndRename(fileOrDirName, aReadSubdirs, aOldName, aNewName); /* re-enter the DoTheCopyAndRename function */
      }
      else
        continue;
    }
  }

  nsAutoString newName = NS_ConvertUTF8toUTF16(aNewName);
  file->CopyTo(aPathFile, newName);

  return NS_OK;
}

nsresult nsDogbertProfileMigrator::CopyFilesByPattern(nsILocalFile * oldPathFile, nsILocalFile * newPathFile, const char *pattern)
{
  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = oldPathFile->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  directoryEnumerator->HasMoreElements(&hasMore);
  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsILocalFile> currentFile(do_QueryInterface(aSupport, &rv));

    PRBool isDirectory = PR_FALSE;
    currentFile->IsDirectory(&isDirectory);
    if (isDirectory)
      continue;

    nsCAutoString fileOrDirNameStr;
    currentFile->GetNativeLeafName(fileOrDirNameStr);
    if (!nsCStringEndsWith(fileOrDirNameStr, pattern))
      continue;


    AddFileCopyToList(currentFile, newPathFile, "");
  }

  return NS_OK;
}

nsresult nsDogbertProfileMigrator::AddFileCopyToList(nsIFile * aOldPath, nsIFile * aNewPath, const char * newName)
{
  fileTransactionEntry* fileEntry = new fileTransactionEntry;
  fileEntry->srcFile = do_QueryInterface(aOldPath);
  fileEntry->destFile = do_QueryInterface(aNewPath);
  fileEntry->newName = NS_ConvertUTF8toUTF16(newName);
  mFileCopyTransactions->AppendElement((void*) fileEntry);

  return NS_OK;
}

nsresult nsDogbertProfileMigrator::DoTheCopy(nsIFile * oldPath, nsIFile * newPath, PRBool readSubdirs)
{
  return DoTheCopyAndRename(oldPath, newPath, readSubdirs, PR_FALSE, "", "");
}

nsresult nsDogbertProfileMigrator::DoTheCopy(nsILocalFile * oldPath, nsILocalFile * newPath, const char *fileOrDirName, PRBool isDirectory)
{
  nsresult rv;

  if (isDirectory)
  {
    nsCOMPtr<nsIFile> oldSubPath;

    oldPath->Clone(getter_AddRefs(oldSubPath));
    rv = oldSubPath->AppendNative(nsDependentCString(fileOrDirName));
    if (NS_FAILED(rv)) return rv;
    PRBool exist;
    rv = oldSubPath->Exists(&exist);
    if (NS_FAILED(rv)) return rv;
    if (!exist)
    {
      rv = oldSubPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    nsCOMPtr<nsILocalFile> newSubPath = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
    newSubPath->InitWithFile(newPath);

    rv = newSubPath->AppendNative(nsDependentCString(fileOrDirName));
    if (NS_FAILED(rv)) return rv;
    rv = newSubPath->Exists(&exist);
    if (NS_FAILED(rv)) return rv;
    if (!exist)
    {
      rv = newSubPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
      if (NS_FAILED(rv)) return rv;
    }

    DoTheCopy(oldSubPath, newSubPath, PR_TRUE);
  }
  else
  {
    nsCOMPtr<nsILocalFile> file = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
    file->InitWithFile(oldPath);
    rv = file->AppendNative(nsDependentCString(fileOrDirName));
    if( NS_FAILED(rv) ) return rv;
    PRBool exist;
    rv = file->Exists(&exist);
    if( NS_FAILED(rv) ) return rv;
    if( exist) {
      AddFileCopyToList(oldPath, newPath, "");
    }
  }

  return rv;
}


/*----------------------------------------------------------------------------
 * DoSpecialUpdates updates is a routine that does some miscellaneous updates
 * like renaming certain files, etc.
 *--------------------------------------------------------------------------*/
nsresult nsDogbertProfileMigrator::DoSpecialUpdates(nsILocalFile  * profilePath)
{
  nsresult rv;
  PRInt32 serverType;
  nsCOMPtr <nsILocalFile> prefFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;
  prefFile->InitWithFile(profilePath);
  prefFile->AppendNative(NS_LITERAL_CSTRING(PREF_FILE_NAME_IN_5x));

  nsCOMPtr <nsIOutputStream> fsStream;
  rv = NS_NewLocalFileOutputStream(getter_AddRefs(fsStream), prefFile, PR_WRONLY | PR_APPEND | PR_CREATE_FILE, 0660);
  NS_ENSURE_SUCCESS(rv, rv);

  /* Need to add a string to the top of the prefs.js file to prevent it
   * from being loaded as a standard javascript file which would be a
   * security hole.
   */
  PRUint32 bytesWritten;
  nsCAutoString headerLine(PREF_FILE_HEADER_STRING MSG_LINEBREAK);
  fsStream->Write(headerLine.get(), headerLine.Length(), &bytesWritten) ;
  fsStream->Close();

  /* Create the new mail directory from the setting in prefs.js or a default */
  rv = mPrefs->GetIntPref(PREF_MAIL_SERVER_TYPE, &serverType);
  if (NS_FAILED(rv)) return rv;
  if (serverType == POP_4X_MAIL_TYPE) {
	rv = RenameAndMove4xPopFilterFile(profilePath);
  	if (NS_FAILED(rv)) return rv;

	rv = RenameAndMove4xPopStateFile(profilePath);
  	if (NS_FAILED(rv)) return rv;
  }
#ifdef IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x
  else if (serverType == IMAP_4X_MAIL_TYPE) {
  	rv = RenameAndMove4xImapFilterFiles(profilePath);
	if (NS_FAILED(rv)) return rv;
  }
#endif /* IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x */

  return rv;
}

nsresult nsDogbertProfileMigrator::RenameAndMove4xPopFilterFile(nsILocalFile * profilePath)
{
  return RenameAndMove4xPopFile(profilePath, POP_MAIL_FILTER_FILE_NAME_IN_4x, POP_MAIL_FILTER_FILE_NAME_IN_5x);
}

nsresult nsDogbertProfileMigrator::RenameAndMove4xPopStateFile(nsILocalFile * profilePath)
{
#ifdef POPSTATE_FILE_IN_4x
  return RenameAndMove4xPopFile(profilePath, POPSTATE_FILE_IN_4x, POPSTATE_FILE_IN_5x);
#else
  // on windows, popstate.dat was in Users\<profile>\MAIL\popstate.dat
  // which is the right place, unlike linux and mac.
  // so, when we migrate Users\<profile>\Mail to Users50\<profile>\Mail\<hostname>
  // it just works
  return NS_OK;
#endif /* POPSTATE_FILE_IN_4x */
}

nsresult nsDogbertProfileMigrator::RenameAndMove4xPopFile(nsILocalFile * profilePath, const char *fileNameIn4x, const char *fileNameIn5x)
{
  nsresult rv;
  nsCOMPtr <nsILocalFile> file = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  file->InitWithFile(profilePath);

  // we assume the 4.x pop files live at <profile>/<fileNameIn4x>
  file->AppendNative(nsDependentCString(fileNameIn4x));

  // figure out where the 4.x pop mail directory got copied to
  char *popServerName = nsnull;
  nsCOMPtr <nsIFile> migratedPopDirectory;
  profilePath->Clone(getter_AddRefs(migratedPopDirectory));
  migratedPopDirectory->AppendNative(NS_LITERAL_CSTRING(NEW_MAIL_DIR_NAME));
  mPrefs->GetCharPref(PREF_NETWORK_HOSTS_POP_SERVER, &popServerName);
  migratedPopDirectory->AppendNative(nsDependentCString(popServerName));
  PR_FREEIF(popServerName);

  // copy the 4.x file from <profile>/<fileNameIn4x> to the <profile>/Mail/<hostname>/<fileNameIn4x>
  rv = file->CopyTo(migratedPopDirectory, EmptyString());
  NS_ASSERTION(NS_SUCCEEDED(rv),"failed to copy pop file");

  // XXX todo, delete the old file
  // we are leaving it behind

  // make migratedPopDirectory point the the copied filter file,
  // <profile>/Mail/<hostname>/<fileNameIn4x>
  migratedPopDirectory->AppendNative(nsDependentCString(fileNameIn4x));

  // rename <profile>/Mail/<hostname>/<fileNameIn4x>to <profile>/Mail/<hostname>/<fileNameIn5x>, if necessary
  if (PL_strcmp(fileNameIn4x,fileNameIn5x))
	  migratedPopDirectory->MoveToNative(nsnull, nsDependentCString(fileNameIn5x));

  return NS_OK;
}


#ifdef IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x
#define BUFFER_LEN	128
nsresult nsDogbertProfileMigrator::RenameAndMove4xImapFilterFile(nsILocalFile * profilePath, const char *hostname)
{
  char imapFilterFileName[BUFFER_LEN];

  // the 4.x imap filter file lives in "<profile>/<hostname> Rules"
  nsCOMPtr <nsIFile> file;
  nsresult rv = profilePath->Clone(getter_AddRefs(file));
  if (NS_FAILED(rv)) return rv;

  PR_snprintf(imapFilterFileName, BUFFER_LEN, IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x, hostname);
  file->AppendNative(nsDependentCString(imapFilterFileName));

  PRBool exists = PR_FALSE;
  file->Exists(&exists);
  // if that file didn't exist, because they didn't use filters for that server, return now
  if (!exists) return NS_OK;

  // figure out where the 4.x pop mail directory got copied to
  nsCOMPtr <nsILocalFile> migratedImapDirectory = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  migratedImapDirectory->InitWithFile(profilePath);
  migratedImapDirectory->AppendNative(NS_LITERAL_CSTRING(NEW_IMAPMAIL_DIR_NAME));
  migratedImapDirectory->AppendNative(nsDependentCString(hostname));

  // copy the 4.x file from "<profile>/<hostname> Rules" to <profile>/ImapMail/<hostname>/
  rv = file->CopyTo(migratedImapDirectory, EmptyString());
  NS_ASSERTION(NS_SUCCEEDED(rv),"failed to copy imap file");

  // make migratedPopDirectory point the the copied filter file,
  // "<profile>/ImapMail/<hostname>/<hostname> Rules"
  migratedImapDirectory->AppendNative(nsDependentCString(imapFilterFileName));

  // rename "<profile>/ImapMail/<hostname>/<hostname> Rules" to  "<profile>/ImapMail/<hostname>/rules.dat"
  migratedImapDirectory->MoveTo(nsnull, NS_LITERAL_STRING(IMAP_MAIL_FILTER_FILE_NAME_IN_5x));

  return NS_OK;
}

nsresult nsDogbertProfileMigrator::RenameAndMove4xImapFilterFiles(nsILocalFile * profilePath)
{
  nsresult rv;
  nsCString hostList;

  rv = mPrefs->GetCharPref(PREF_4X_NETWORK_HOSTS_IMAP_SERVER, getter_Copies(hostList));
  if (NS_FAILED(rv)) return rv;

  if (hostList.IsEmpty()) return NS_OK;

  char *token = nsnull;
  char *rest = hostList.BeginWriting();
  nsCAutoString str;
  token = NS_strtok(",", &rest);
  while (token && *token) {
    str = token;
    str.StripWhitespace();

    if (!str.IsEmpty()) {
      // str is the hostname
      rv = RenameAndMove4xImapFilterFile(profilePath, str.get());
      if  (NS_FAILED(rv)) {
        // failed to migrate.  bail.
        return rv;
      }
    }
    token = NS_strtok(",", &rest);
  }
  return NS_OK;
}
#endif /* IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x */

nsresult
nsDogbertProfileMigrator::Rename4xFileAfterMigration(nsIFile * profilePath, const char *oldFileName, const char *newFileName)
{
  // if they are the same, don't bother to rename the file.
  if (PL_strcmp(oldFileName, newFileName) == 0)
    return NS_OK;

  nsCOMPtr <nsIFile> file;
  nsresult rv = profilePath->Clone(getter_AddRefs(file));
  if (NS_FAILED(rv)) return rv;

  file->AppendNative(nsDependentCString(oldFileName));
  PRBool exists = PR_FALSE;
  file->Exists(&exists);
  // make sure it exists before you try to rename it
  if (exists)
    rv = file->MoveToNative(nsnull, nsDependentCString(newFileName));

  return rv;
}

#ifdef NEED_TO_COPY_AND_RENAME_NEWSRC_FILES
nsresult nsDogbertProfileMigrator::GetPremigratedFilePref(const char *pref_name, nsILocalFile **path)
{
  if (!pref_name) return NS_ERROR_FAILURE;
  char premigration_pref[MAX_PREF_LEN];
  PR_snprintf(premigration_pref,MAX_PREF_LEN,"%s%s",PREMIGRATION_PREFIX,pref_name);

  return mPrefs->GetComplexValue((const char *)premigration_pref, NS_GET_IID(nsILocalFile), (void **) path);
}

#endif /* NEED_TO_COPY_AND_RENAME_NEWSRC_FILES */

nsresult nsDogbertProfileMigrator::DetermineOldPath(nsILocalFile *profilePath, const char *oldPathName, const char *oldPathEntityName, nsILocalFile *oldPath)
{
  nsresult rv;

  /* set oldLocalFile to profilePath.  need to convert nsILocalFile->nsILocalFile */
  nsCOMPtr<nsILocalFile> oldLocalFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
        oldLocalFile->InitWithFile(profilePath);

  /* get the string bundle, and get the appropriate localized string out of it */
  nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle(MIGRATION_PROPERTIES_URL, getter_AddRefs(bundle));
  if (NS_FAILED(rv)) return rv;

  nsString localizedDirName;
  NS_ConvertASCIItoUTF16 entityName(oldPathEntityName);
  rv = bundle->GetStringFromName(entityName.get(), getter_Copies(localizedDirName));
  if (NS_FAILED(rv)) return rv;

  rv = oldLocalFile->AppendRelativePath(localizedDirName);
  if (NS_FAILED(rv)) return rv;

  PRBool exists = PR_FALSE;
  rv = oldLocalFile->Exists(&exists);
  if (!exists) {
    /* if the localized name doesn't exist, use the english name */
    rv = oldPath->InitWithFile(profilePath);
    if (NS_FAILED(rv)) return rv;

    rv = oldPath->AppendNative(nsDependentCString(oldPathName));
    if (NS_FAILED(rv)) return rv;

    return NS_OK;
  }

  /* at this point, the folder with the localized name exists, so use it */
  nsCAutoString persistentDescriptor;
  rv = oldLocalFile->GetPersistentDescriptor(persistentDescriptor);
  if (NS_FAILED(rv)) return rv;
  return oldPath->SetPersistentDescriptor(persistentDescriptor);
}

nsresult nsDogbertProfileMigrator::ConvertPersistentStringToFile(const char *str, nsILocalFile *path)
{
  nsresult rv;
  if (!str || !path) return NS_ERROR_NULL_POINTER;

  rv = path->SetPersistentDescriptor(nsDependentCString(str));
  return rv;
}

/*---------------------------------------------------------------------------------
 * GetSizes reads the 4.x files in the profile tree and accumulates their sizes
 *--------------------------------------------------------------------------------*/

nsresult nsDogbertProfileMigrator::GetSizes(nsILocalFile *inputPath, PRBool readSubdirs, PRInt64 *sizeTotal)
{
  nsCAutoString folderName;

  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = inputPath->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  directoryEnumerator->HasMoreElements(&hasMore);
  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsILocalFile> currentFile(do_QueryInterface(aSupport, &rv));
    // Handle sub folders
    PRBool isDirectory = PR_FALSE;
    currentFile->GetNativeLeafName(folderName);
    if (nsCStringEndsWith(folderName, MAIL_SUMMARY_SUFFIX_IN_4x) || nsCStringEndsWith(folderName, NEWS_SUMMARY_SUFFIX_IN_4x) || nsCStringEndsWith(folderName, SUMMARY_SUFFIX_IN_5x)) /* Don't copy the summary files */
      continue;
    else
    {
      currentFile->IsDirectory(&isDirectory);
    if (isDirectory)

      {
        if(readSubdirs)
        {
          GetSizes(currentFile, PR_TRUE, sizeTotal); /* re-enter the GetSizes function */
        }
        else
          continue;
      }
      else
      {
        PRInt64 fileSize;
        currentFile->GetFileSize(&fileSize);
        *sizeTotal += fileSize;

      }
    }
  }

  return NS_OK;
}

/*---------------------------------------------------------------------------------
 * GetDirFromPref gets a directory based on a preference set in the 4.x
 * preferences file, adds a 5 and resets the preference.
 *
 * INPUT:
 *         oldProfilePath - the path to the old 4.x profile directory.
 *                          currently only used by UNIX
 *
 *         newProfilePath - the path to the 5.0 profile directory
 *                          currently only used by UNIX
 *
 *         newDirName     - the leaf name of the directory in the 5.0 world that corresponds to
 *                          this pref.  Examples:  "Mail", "ImapMail", "News".
 *                          only used on UNIX.
 *
 *         pref - the pref in the "dot" format (e.g. mail.directory)
 *
 * OUTPUT: newPath - The old path with a 5 added (on mac and windows)
 *                   the newProfilePath + "/" + newDirName (on UNIX)
 *         oldPath - The old path from the pref (if any)
 *
 *
 * RETURNS: NS_OK if the pref was successfully pulled from the prefs file
 *
 *--------------------------------------------------------------------------------*/
nsresult
nsDogbertProfileMigrator::GetDirFromPref(nsILocalFile * oldProfilePath, nsILocalFile * newProfilePath, const char *newDirName, const char* pref, nsILocalFile** newPath, nsILocalFile** oldPath)
{
  nsresult rv;

  if (!oldProfilePath || !newProfilePath || !newDirName || !pref || !newPath || !oldPath)
    return NS_ERROR_NULL_POINTER;

  nsCOMPtr <nsILocalFile> oldPrefPath;
  nsCOMPtr <nsILocalFile> newPathFile;
  nsCOMPtr <nsILocalFile> oldPathFile;
  nsCString oldPrefPathStr;
  rv = mPrefs->GetCharPref(pref, getter_Copies(oldPrefPathStr));
  if (NS_FAILED(rv)) return rv;

  // the default on the mac was "".  doing GetFileXPref on that would return
  // the current working directory, like viewer_debug.  yikes!
  if (oldPrefPathStr.IsEmpty())
    rv = NS_ERROR_FAILURE;

  if (NS_FAILED(rv)) return rv;

  rv = mPrefs->GetComplexValue(pref, NS_GET_IID(nsILocalFile), getter_AddRefs(oldPathFile));
  if (NS_FAILED(rv)) return rv;

#ifdef XP_UNIX
	// what if they don't want to go to <profile>/<newDirName>?
	// what if unix users want "mail.directory" + "5" (like "~/ns_imap5")
	// or "mail.imap.root_dir" + "5" (like "~/nsmail5")?
	// should we let them?  no.  let's migrate them to
	// <profile>/Mail and <profile>/ImapMail
	// let's make all three platforms the same.
	if (PR_TRUE) {
#else
	nsCOMPtr <nsIFile> oldPrefPathParent;
	rv = oldPrefPath->GetParent(getter_AddRefs(oldPrefPathParent));
	if (NS_FAILED(rv)) return rv;

	// if the pref pointed to the default directory
	// treat it as if the pref wasn't set
	// this way it will get migrated as the user expects
	PRBool pathsMatch;
	rv = oldProfilePath->Equals(oldPrefPathParent, &pathsMatch);
        newPathFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
	if (NS_SUCCEEDED(rv) && pathsMatch)
        {

#endif /* XP_UNIX */
          newPathFile->InitWithFile(newProfilePath);
	}
	else
        {
          nsCAutoString leafname;
          newPathFile->InitWithFile(oldPathFile);
          rv = newPathFile->GetNativeLeafName(leafname);
          if (NS_FAILED(rv)) return rv;
          leafname.Append(NS_LITERAL_CSTRING(NEW_DIR_SUFFIX));
          rv = newPathFile->SetNativeLeafName(leafname);
          if (NS_FAILED(rv)) return rv;
	}

  rv = SetPremigratedFilePref(pref, oldPathFile);
  if (NS_FAILED(rv)) return rv;

#ifdef XP_UNIX
  /* on UNIX, we kept the newsrc files in "news.directory", (which was usually ~)
   * and the summary files in ~/.netscape/xover-cache
   * oldPath should point to ~/.netscape/xover-cache, not "news.directory"
   * but we want to save the old "news.directory" in "premigration.news.directory"
   * later, again for UNIX only,
   * we will copy the .newsrc files (from "news.directory") into the new <profile>/News directory.
   * isn't this fun?
   */
  if (PL_strcmp(PREF_NEWS_DIRECTORY, pref) == 0) {
    rv = oldProfilePath->AppendNative(NS_LITERAL_CSTRING(OLD_NEWS_DIR_NAME));
    if (NS_FAILED(rv)) return rv;
  }
#endif /* XP_UNIX */
  NS_IF_ADDREF(*newPath = newPathFile);
  NS_IF_ADDREF(*oldPath = oldPathFile);
  return rv;
}

nsresult nsDogbertProfileMigrator::SetPremigratedFilePref(const char *pref_name, nsILocalFile *pathFile)
{
  nsresult rv;

  if (!pref_name) return NS_ERROR_FAILURE;

  // save off the old pref, prefixed with "premigration"
  // for example, we need the old "mail.directory" pref when
  // migrating the copies and folder prefs in nsMsgAccountManager.cpp
  //
  // note we do this for all platforms.
  char premigration_pref[MAX_PREF_LEN];
  PR_snprintf(premigration_pref,MAX_PREF_LEN,"%s%s",PREMIGRATION_PREFIX,pref_name);


  PRBool exists = PR_FALSE;
  pathFile->Exists(&exists);

  NS_ASSERTION(exists, "the path does not exist.  see bug #55444");
  if (!exists) return NS_OK;

  rv = mPrefs->SetComplexValue((const char *)premigration_pref, NS_GET_IID(nsILocalFile), pathFile);
	return rv;
}

nsresult nsDogbertProfileMigrator::ComputeSpaceRequirements(PRInt64 DriveArray[MAX_DRIVES],
                                          PRUint32 SpaceReqArray[MAX_DRIVES],
                                          PRInt64 Drive,
                                          PRUint32 SpaceNeeded)
{
  int i=0;
  PRFloat64 temp;

  while(LL_NE(DriveArray[i],LL_Zero()) && LL_NE(DriveArray[i], Drive) && i < MAX_DRIVES)
    i++;

  if (LL_EQ(DriveArray[i], LL_Zero()))
  {
    DriveArray[i] = Drive;
    SpaceReqArray[i] += SpaceNeeded;
  }
  else if (LL_EQ(DriveArray[i], Drive))
    SpaceReqArray[i] += SpaceNeeded;
  else
    return NS_ERROR_FAILURE;

  LL_L2F(temp, DriveArray[i]);
  if (SpaceReqArray[i] > temp)
    return NS_ERROR_FAILURE;

  return NS_OK;
}

static PRBool
nsCStringEndsWith(nsCString& name, const char *ending)
{
  if (!ending || name.IsEmpty())
    return PR_FALSE;

  return StringTail(name, PL_strlen(ending)).Equals(nsDependentCString(ending));
}

#ifdef NEED_TO_COPY_AND_RENAME_NEWSRC_FILES
static PRBool
nsCStringStartsWith(nsCString& name, const char *starting)
{
  if (!starting || name.IsEmpty())
    return PR_FALSE;

  return StringHead(name, PL_strlen(starting)).Equals(nsDependentCString(starting));
}
#endif

////////////////////////////////////////////////////////////////////////
// nsPrefConverter
////////////////////////////////////////////////////////////////////////

/*
  these are the prefs we know we need to convert to utf8.
  we'll also be converting:

  Please make sure that any pref that contains native characters
  in it's value is not included in this list as we do not want to
  convert them into UTF-8 format. Prefs are being get and set in a
  unicode format (FileXPref) now and there is no need for
  conversion of those prefs.

 "ldap_2.server.*.description"
 "intl.font*.fixed_font"
 "intl.font*.prop_font"
 "mail.identity.vcard.*"
 */

static const char *prefsToConvert[] = {
      "li.server.ldap.userbase",
      "mail.identity.organization",
      "mail.identity.username",
      nsnull
};

nsPrefConverter::~nsPrefConverter()
{}


nsPrefConverter::nsPrefConverter()
{}

// Apply a charset conversion from the given charset to UTF-8 for the input C string.
static nsresult ConvertStringToUTF8(const char* aCharset, const char* inString, char** outString)
{
  if (nsnull == outString)
    return NS_ERROR_NULL_POINTER;

  nsresult rv;
  // convert result to unicode
  nsCOMPtr<nsICharsetConverterManager> ccm = do_GetService(NS_CHARSETCONVERTERMANAGER_CONTRACTID, &rv);

  if(NS_SUCCEEDED(rv)) {
    nsCOMPtr <nsIUnicodeDecoder> decoder; // this may be cached

    rv = ccm->GetUnicodeDecoderRaw(aCharset, getter_AddRefs(decoder));
    if(NS_SUCCEEDED(rv) && decoder) {
      PRInt32 uniLength = 0;
      PRInt32 srcLength = strlen(inString);
      rv = decoder->GetMaxLength(inString, srcLength, &uniLength);
      if (NS_SUCCEEDED(rv)) {
        PRUnichar *unichars = new PRUnichar [uniLength];

        if (nsnull != unichars) {
          // convert to unicode
          rv = decoder->Convert(inString, &srcLength, unichars, &uniLength);
          if (NS_SUCCEEDED(rv)) {
            nsAutoString aString;
            aString.Assign(unichars, uniLength);
            // convert to UTF-8
            *outString = ToNewUTF8String(aString);
          }
          delete [] unichars;
        }
        else {
          rv = NS_ERROR_OUT_OF_MEMORY;
        }
      }
    }
  }

  return rv;
}

nsresult ConvertPrefToUTF8(const char *prefname, nsIPrefBranch *prefs, const char* charSet)
{
  nsresult rv;

  if (!prefname || !prefs) return NS_ERROR_FAILURE;
  nsCString prefval;

  rv = prefs->GetCharPref(prefname, getter_Copies(prefval));
  if (NS_FAILED(rv)) return rv;

  if (prefval.IsEmpty())
    return NS_OK;

  nsCString outval;
  rv = ConvertStringToUTF8(charSet, prefval.get(), getter_Copies(outval));
  // only set the pref if the conversion worked, and it convert to something non null
  if (NS_SUCCEEDED(rv) && !outval.IsEmpty())
    rv = prefs->SetCharPref(prefname, outval.get());
  return NS_OK;
}

static PRBool charEndsWith(const char *str, const char *endStr)
{
  PRUint32 endStrLen = PL_strlen(endStr);
  PRUint32 strLen = PL_strlen(str);

  if (strLen < endStrLen) return PR_FALSE;

  PRUint32 pos = strLen - endStrLen;
  if (PL_strncmp(str + pos, endStr, endStrLen) == 0)
    return PR_TRUE;
  else
    return PR_FALSE;
}

static void getFontPrefs(nsIPrefBranch *prefs, nsCStringArray *data)
{
  PRUint32 count, i;
  char** childPrefs;
  prefs->GetChildList("intl.font", &count, &childPrefs);

  for (i = 0; i < count; ++i)
  {
    if (charEndsWith(childPrefs[i], ".fixed_font") || charEndsWith(childPrefs[i], ".prop_font"))
      data->AppendCString(nsDependentCString(childPrefs[i]));
  }

  NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(count, childPrefs);
}

static void getLdapPrefs(nsIPrefBranch *prefs, nsCStringArray *data)
{
  PRUint32 count, i;
  char** childPrefs;
  prefs->GetChildList("ldap_2.servers", &count, &childPrefs);

  for (i = 0; i < count; ++i)
  {
    // we only want to convert "ldap_2.servers.*.description"
    if (charEndsWith(childPrefs[i], ".description"))
      data->AppendCString(nsDependentCString(childPrefs[i]));
  }

  NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(count, childPrefs);
}

static void getVCardPrefs(nsIPrefBranch *prefs, nsCStringArray *data)
{
  PRUint32 count, i;
  char** childPrefs;
  prefs->GetChildList("mail.identity.vcard", &count, &childPrefs);

  // the 4.x vCard prefs might need converting
  for (i = 0; i < count; ++i)
    data->AppendCString(nsDependentCString(childPrefs[i]));

  NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(count, childPrefs);
}

typedef struct {
    nsIPrefBranch *prefs;
    const char* charSet;
} PrefEnumerationClosure;

PRBool convertPref(nsCString &aElement, void *aData)
{
  PrefEnumerationClosure *closure;
  closure = (PrefEnumerationClosure *)aData;

  ConvertPrefToUTF8(aElement.get(), closure->prefs, closure->charSet);
  return PR_TRUE;
}

nsresult nsPrefConverter::ConvertPrefsToUTF8()
{
  nsresult rv;

  nsCStringArray prefsToMigrate;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));

  if(NS_FAILED(rv)) return rv;

  nsCAutoString charSet;
  rv = GetPlatformCharset(charSet);

  if (NS_FAILED(rv)) return rv;

  for (PRUint32 i = 0; prefsToConvert[i]; i++) {
    nsCString prefnameStr( prefsToConvert[i] );
    prefsToMigrate.AppendCString(prefnameStr);
  }

  getFontPrefs(prefs, &prefsToMigrate);
  getLdapPrefs(prefs, &prefsToMigrate);
  getVCardPrefs(prefs, &prefsToMigrate);

  PrefEnumerationClosure closure;

  closure.prefs = prefs;
  closure.charSet = charSet.get();

  prefsToMigrate.EnumerateForwards((nsCStringArrayEnumFunc)convertPref, (void *)(&closure));

  rv = prefs->SetBoolPref("prefs.converted-to-utf8",PR_TRUE);
  return NS_OK;
}

// A wrapper function to call the interface to get a platform file charset.
nsresult
nsPrefConverter::GetPlatformCharset(nsCString& aCharset)
{
  nsresult rv;

  // we may cache it since the platform charset will not change through application life
  nsCOMPtr <nsIPlatformCharset> platformCharset = do_GetService(NS_PLATFORMCHARSET_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv) && platformCharset)
   rv = platformCharset->GetCharset(kPlatformCharsetSel_4xPrefsJS, aCharset);
  if (NS_FAILED(rv))
   aCharset.Assign(NS_LITERAL_CSTRING("ISO-8859-1"));  // use ISO-8859-1 in case of any error

  return rv;
}
