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
 * The Original Code is The Communicator 4.x Mail Migrator Code
 *
 * The Initial Developer of the Original Code is Scott MacGregor.
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

#ifndef dogbertprofilemigrator___h___
#define dogbertprofilemigrator___h___

#include "nsIMailProfileMigrator.h"
#include "nsILocalFile.h"
#include "nsIObserverService.h"
#include "nsIMutableArray.h"
#include "nsNetscapeProfileMigratorBase.h"
#include "nsITimer.h"

#include "nsIPrefBranch.h"

class nsIFile;

// ripped off from nsPrefMigration, warts and all

#define MIGRATION_SUCCESS    0
#define MIGRATION_RETRY      1
#define MIGRATION_CANCEL     2
#define MIGRATION_CREATE_NEW 3

#define MAX_DRIVES 4

//Interfaces Needed

#ifdef XP_MACOSX
#define IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x "%s Rules" 
#endif

#if defined(XP_UNIX) && !defined(XP_MACOSX)
#define NEED_TO_COPY_AND_RENAME_NEWSRC_FILES
#endif

class nsPrefConverter
{
public:
  nsPrefConverter();
  virtual ~nsPrefConverter();
  nsresult ConvertPrefsToUTF8();
  nsresult GetPlatformCharset(nsCString& aCharset);
};

class nsDogbertProfileMigrator :   public nsNetscapeProfileMigratorBase, 
                                   public nsIMailProfileMigrator,
                                   public nsITimerCallback
{
public:
  NS_DECL_NSIMAILPROFILEMIGRATOR
  NS_DECL_ISUPPORTS
  NS_DECL_NSITIMERCALLBACK

  nsDogbertProfileMigrator();
  virtual ~nsDogbertProfileMigrator();

protected:
  void GetSourceProfile(const PRUnichar* aProfile);

  nsresult CopyPreferences();

private:
  nsCOMPtr<nsIMutableArray> mProfiles;
  nsCOMPtr<nsIObserverService> mObserverService;
  nsCOMPtr<nsITimer> mFileIOTimer;

  PRInt64 mMaxProgress;
  PRInt64 mCurrentProgress;
  
  nsCOMPtr<nsIPrefBranch> mPrefs;
  nsCOMPtr<nsILocalFile> m_prefsFile;
protected:
  nsresult ProcessPrefsCallback(const char* oldProfilePathStr, const char * newProfilePathStr);
  nsresult ConvertPersistentStringToFile(const char *str, nsILocalFile *path);
  nsresult CreateNewUser5Tree(nsILocalFile* oldProfilePath, 
                              nsILocalFile* newProfilePath);

  nsresult GetDirFromPref(nsILocalFile* oldProfilePath,
                          nsILocalFile* newProfilePath, 
                          const char* newDirName,
                          const char* pref, 
                          nsILocalFile** newPath, 
                          nsILocalFile** oldPath);

  nsresult GetSizes(nsILocalFile *inputPath,
                    PRBool readSubdirs,
                    PRInt64* sizeTotal);

  nsresult ComputeSpaceRequirements(PRInt64 DriveArray[], 
                                    PRUint32 SpaceReqArray[], 
                                    PRInt64 Drive, 
                                    PRUint32 SpaceNeeded);

  nsresult DoTheCopy(nsIFile *oldPath, 
                     nsIFile *newPath,
                     PRBool readSubdirs); 
  nsresult DoTheCopy(nsILocalFile *oldPath,
                     nsILocalFile *newPath,
                     const char *fileOrDirName,
                     PRBool isDirectory = PR_FALSE);

  nsresult DoTheCopyAndRename(nsIFile *oldPath, 
                          nsIFile *newPath,
                          PRBool readSubdirs,
                          PRBool needToRenameFiles,
                          const char *oldName,
                          const char *newName); 
  nsresult DoTheCopyAndRename(nsIFile *aPath, 
                          PRBool aReadSubdirs,
                          const char *aOldName,
                          const char *aNewName);
  nsresult CopyFilesByPattern(nsILocalFile * oldPath,
                          nsILocalFile * newPath,
                          const char *pattern);

  nsresult AddFileCopyToList(nsIFile * aOldPath, nsIFile * aNewPath, const char * newFileName);
  void CopyNextFolder();
  void EndCopyFolders();

#ifdef NEED_TO_COPY_AND_RENAME_NEWSRC_FILES
  nsresult CopyAndRenameNewsrcFiles(nsILocalFile *newPath);
#endif /* NEED_TO_COPY_AND_RENAME_NEWSRC_FILES */

  nsresult DoSpecialUpdates(nsILocalFile * profilePath);
  nsresult Rename4xFileAfterMigration(nsIFile *profilePath, const char *oldFileName, const char *newFileName);
#ifdef IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x
  nsresult RenameAndMove4xImapFilterFile(nsILocalFile *profilePath, const char *hostname);
  nsresult RenameAndMove4xImapFilterFiles(nsILocalFile *profilePath);
#endif /* IMAP_MAIL_FILTER_FILE_NAME_FORMAT_IN_4x */
  nsresult RenameAndMove4xPopStateFile(nsILocalFile *profilePath);
  nsresult RenameAndMove4xPopFilterFile(nsILocalFile *profilePath);
  nsresult RenameAndMove4xPopFile(nsILocalFile * profilePath, const char *fileNameIn4x, const char *fileNameIn5x);
  
  nsresult DetermineOldPath(nsILocalFile *profilePath, const char *oldPathName, const char *oldPathEntityName, nsILocalFile *oldPath);
  nsresult SetPremigratedFilePref(const char *pref_name, nsILocalFile *filePath);
#ifdef NEED_TO_COPY_AND_RENAME_NEWSRC_FILES
  nsresult GetPremigratedFilePref(const char *pref_name, nsILocalFile **filePath);
#endif /* NEED_TO_COPY_AND_RENAME_NEWSRC_FILES */
};

#endif
