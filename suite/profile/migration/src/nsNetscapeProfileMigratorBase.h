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

#ifndef netscapeprofilemigratorbase___h___
#define netscapeprofilemigratorbase___h___

#include "nsILocalFile.h"
#include "nsIMutableArray.h"
#include "nsStringAPI.h"
#include "nsTArray.h"
#include "nsITimer.h"
#include "nsIObserverService.h"
#include "nsISuiteProfileMigrator.h"

class nsIPrefBranch;
class nsIPrefService;

struct fileTransactionEntry {
  nsCOMPtr<nsIFile> srcFile;  // the src path including leaf name
  nsCOMPtr<nsIFile> destFile; // the destination path
  nsString newName; // only valid if the file should be renamed after
                    // getting copied
};

#define FILE_NAME_BOOKMARKS       "bookmarks.html"
#define FILE_NAME_COOKIES         "cookies.txt"
#define FILE_NAME_COOKIES_SQLITE  "cookies.sqlite"
#define FILE_NAME_PREFS           "prefs.js"
#define FILE_NAME_JUNKTRAINING    "training.dat"
#define FILE_NAME_VIRTUALFOLDERS  "virtualFolders.dat"
#define FILE_NAME_USERCONTENT     "userContent.css"
#define FILE_NAME_SEARCH          "search.rdf"
#define DIR_NAME_SEARCH           "searchplugins"
#define FILE_NAME_DOWNLOADS       "downloads.rdf"

#define F(a) nsNetscapeProfileMigratorBase::a

#define MAKEPREFTRANSFORM(pref, newpref, getmethod, setmethod) \
  { pref, newpref, F(Get##getmethod), F(Set##setmethod), PR_FALSE, { -1 } }

#define MAKESAMETYPEPREFTRANSFORM(pref, method) \
  { pref, 0, F(Get##method), F(Set##method), PR_FALSE, { -1 } }

class nsNetscapeProfileMigratorBase : public nsISuiteProfileMigrator,
                                      public nsITimerCallback
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSITIMERCALLBACK

  nsNetscapeProfileMigratorBase();
  virtual ~nsNetscapeProfileMigratorBase() { }

  struct PrefTransform;
  typedef nsresult(*prefConverter)(PrefTransform*, nsIPrefBranch*);

  struct PrefTransform {
    const char*   sourcePrefName;
    const char*   targetPrefName;
    prefConverter prefGetterFunc;
    prefConverter prefSetterFunc;
    PRBool        prefHasValue;
    union {
      PRInt32     intValue;
      PRBool      boolValue;
      char*       stringValue;
    };
  };

  struct PrefBranchStruct {
    char*         prefName;
    PRInt32       type;
    union {
      char*       stringValue;
      PRInt32     intValue;
      PRBool      boolValue;
    };
  };

  typedef nsTArray<PrefBranchStruct*> PBStructArray;

  // nsISuiteProfileMigrator methods
  NS_IMETHOD GetSourceExists(PRBool* aSourceExists);
  NS_IMETHOD GetSourceHasMultipleProfiles(PRBool* aSourceHasMultipleProfiles);
  NS_IMETHOD GetSourceProfiles(nsIArray** aResult);

  // Pref Transform Methods
  static nsresult GetString(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetString(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult GetBool(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetBool(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult GetInt(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetInt(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetImage(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetCookie(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  // XXX Bug 381157 When suite uses Toolkit's DM backend, we need to
  // activate this code.
#ifdef SUITE_USING_TOOLKIT_DM
  static nsresult SetDownloadManager(PrefTransform* aTransform,
                                     nsIPrefBranch* aBranch);
#endif

protected:
  // This function is designed to be overriden by derived classes so that
  // the required profile data for the specific application can be obtained.
  virtual nsresult FillProfileDataFromRegistry() = 0;

  // General Utility Methods
  nsresult GetSourceProfile(const PRUnichar* aProfile);
  nsresult GetProfileDataFromProfilesIni(nsILocalFile* aDataDir,
                                         nsIMutableArray* aProfileNames,
                                         nsIMutableArray* aProfileLocations);
  nsresult GetProfileDataFromRegistry(nsILocalFile* aRegistryFile,
                                      nsIMutableArray* aProfileNames,
                                      nsIMutableArray* aProfileLocations);
  nsresult CopyFile(const char* aSourceFileName,
                    const char* aTargetFileName);
  nsresult RecursiveCopy(nsIFile* srcDir, nsIFile* destDir);
  void ReadBranch(const char * branchName, nsIPrefService* aPrefService,
                  PBStructArray &aPrefs);
  void WriteBranch(const char * branchName, nsIPrefService* aPrefService,
                   PBStructArray &aPrefs);

  // Generic Import Functions
  nsresult CopyCookies(PRBool aReplace);
  nsresult CopyPasswords(PRBool aReplace);
  nsresult CopyUserSheet(const char* aFileName);
  nsresult GetSignonFileName(PRBool aReplace, char** aFileName);

  // Browser Import Functions
  nsresult CopyBookmarks(PRBool aReplace);
  nsresult CopyOtherData(PRBool aReplace);
  nsresult ImportNetscapeBookmarks(const char* aBookmarksFileName,
                                   const char* aImportSourceNameKey);
  PRBool GetSourceHasHomePageURL();
  nsresult CopyHomePageData(PRBool aReplace);

  // Mail Import Functions
  nsresult CopyAddressBookDirectories(PBStructArray &aLdapServers,
                                      nsIPrefService* aPrefService);
  nsresult CopySignatureFiles(PBStructArray &aIdentities,
                              nsIPrefService* aPrefService);
  nsresult CopyJunkTraining(PRBool aReplace);
  nsresult CopyMailFolderPrefs(PBStructArray &aMailServers,
                               nsIPrefService* aPrefService);
  void CopyMailFolders();
  void CopyNextFolder();
  void EndCopyFolders();

  // Source & Target profiles
  nsCOMPtr<nsILocalFile> mSourceProfile;
  nsCOMPtr<nsIFile> mTargetProfile;

  // list of src/destination files we still have to copy into the new profile
  // directory
  nsTArray<fileTransactionEntry> mFileCopyTransactions;
  PRUint32 mFileCopyTransactionIndex;

  nsCOMPtr<nsIObserverService> mObserverService;
  PRInt64 mMaxProgress;
  PRInt64 mCurrentProgress;

  nsCOMPtr<nsIMutableArray> mProfileNames;
  nsCOMPtr<nsIMutableArray> mProfileLocations;

  nsCOMPtr<nsITimer> mFileIOTimer;
};
 
#endif
