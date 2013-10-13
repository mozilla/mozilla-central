/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef netscapeprofilemigratorbase___h___
#define netscapeprofilemigratorbase___h___

#include "nsIFile.h"
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
#define DIR_NAME_SEARCH           "searchplugins"
#define FILE_NAME_DOWNLOADS       "downloads.rdf"

#define F(a) nsNetscapeProfileMigratorBase::a

#define MAKEPREFTRANSFORM(pref, newpref, getmethod, setmethod) \
  { pref, newpref, F(Get##getmethod), F(Set##setmethod), false, { -1 } }

#define MAKESAMETYPEPREFTRANSFORM(pref, method) \
  { pref, 0, F(Get##method), F(Set##method), false, { -1 } }

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
    bool          prefHasValue;
    union {
      int32_t     intValue;
      bool        boolValue;
      char*       stringValue;
    };
  };

  struct PrefBranchStruct {
    char*         prefName;
    int32_t       type;
    union {
      char*       stringValue;
      int32_t     intValue;
      bool        boolValue;
    };
  };

  typedef nsTArray<PrefBranchStruct*> PBStructArray;

  // nsISuiteProfileMigrator methods
  NS_IMETHOD GetSourceExists(bool* aSourceExists);
  NS_IMETHOD GetSourceHasMultipleProfiles(bool* aSourceHasMultipleProfiles);
  NS_IMETHOD GetSourceProfiles(nsIArray** aResult);

  // Pref Transform Methods
  static nsresult GetString(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetString(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult GetBool(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetBool(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult GetInt(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetInt(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetFile(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetImage(PrefTransform* aTransform, nsIPrefBranch* aBranch);
  static nsresult SetCookie(PrefTransform* aTransform, nsIPrefBranch* aBranch);

protected:
  // This function is designed to be overriden by derived classes so that
  // the required profile data for the specific application can be obtained.
  virtual nsresult FillProfileDataFromRegistry() = 0;

  // General Utility Methods
  nsresult GetSourceProfile(const PRUnichar* aProfile);
  nsresult GetProfileDataFromProfilesIni(nsIFile* aDataDir,
                                         nsIMutableArray* aProfileNames,
                                         nsIMutableArray* aProfileLocations);
  nsresult GetFileValue(nsIPrefBranch* aPrefBranch, const char* aRelPrefName,
                        const char* aPrefName, nsIFile** aReturnFile);
  nsresult CopyFile(const char* aSourceFileName,
                    const char* aTargetFileName);
  nsresult RecursiveCopy(nsIFile* srcDir, nsIFile* destDir);
  void ReadBranch(const char * branchName, nsIPrefService* aPrefService,
                  PBStructArray &aPrefs);
  void WriteBranch(const char * branchName, nsIPrefService* aPrefService,
                   PBStructArray &aPrefs);

  // Generic Import Functions
  nsresult CopyCookies(bool aReplace);
  nsresult CopyUserSheet(const char* aFileName);

  // Browser Import Functions
  nsresult CopyBookmarks(bool aReplace);
  nsresult CopyOtherData(bool aReplace);
  nsresult ImportNetscapeBookmarks(const char* aBookmarksFileName,
                                   const char* aImportSourceNameKey);
  bool GetSourceHasHomePageURL();
  nsresult CopyHomePageData(bool aReplace);

  // Mail Import Functions
  nsresult CopyAddressBookDirectories(PBStructArray &aLdapServers,
                                      nsIPrefService* aPrefService);
  nsresult CopySignatureFiles(PBStructArray &aIdentities,
                              nsIPrefService* aPrefService);
  nsresult CopyJunkTraining(bool aReplace);
  nsresult CopyMailFolderPrefs(PBStructArray &aMailServers,
                               nsIPrefService* aPrefService);
  void CopyMailFolders();
  void CopyNextFolder();
  void EndCopyFolders();

  // Source & Target profiles
  nsCOMPtr<nsIFile> mSourceProfile;
  nsCOMPtr<nsIFile> mTargetProfile;

  // list of src/destination files we still have to copy into the new profile
  // directory
  nsTArray<fileTransactionEntry> mFileCopyTransactions;
  uint32_t mFileCopyTransactionIndex;

  nsCOMPtr<nsIObserverService> mObserverService;
  int64_t mMaxProgress;
  int64_t mCurrentProgress;

  nsCOMPtr<nsIMutableArray> mProfileNames;
  nsCOMPtr<nsIMutableArray> mProfileLocations;

  nsCOMPtr<nsITimer> mFileIOTimer;
};
 
#endif
