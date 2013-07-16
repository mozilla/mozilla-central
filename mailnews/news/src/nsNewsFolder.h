/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
   Interface for representing News folders.
*/

#ifndef nsMsgNewsFolder_h__
#define nsMsgNewsFolder_h__

#include "mozilla/Attributes.h"
#include "nsMsgDBFolder.h"
#include "nsIFile.h"
#include "nsINntpIncomingServer.h" // need this for the IID
#include "nsNewsUtils.h"
#include "nsMsgKeySet.h"
#include "nsIMsgNewsFolder.h"
#include "nsCOMPtr.h"
#include "nsIMsgFilterService.h"
#include "nsIArray.h"

class nsMsgNewsFolder : public nsMsgDBFolder, public nsIMsgNewsFolder
{
public:
  nsMsgNewsFolder(void);
  virtual ~nsMsgNewsFolder(void);

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIMSGNEWSFOLDER

  // nsIUrlListener method
  NS_IMETHOD OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode) MOZ_OVERRIDE;
  // nsIMsgFolder methods:
  NS_IMETHOD GetSubFolders(nsISimpleEnumerator **aResult) MOZ_OVERRIDE;

  NS_IMETHOD GetMessages(nsISimpleEnumerator **result) MOZ_OVERRIDE;
  NS_IMETHOD UpdateFolder(nsIMsgWindow *aWindow) MOZ_OVERRIDE;

  NS_IMETHOD CreateSubfolder(const nsAString& folderName,
                             nsIMsgWindow *msgWindow) MOZ_OVERRIDE;

  NS_IMETHOD Delete() MOZ_OVERRIDE;
  NS_IMETHOD Rename(const nsAString& newName,
                     nsIMsgWindow *msgWindow) MOZ_OVERRIDE;

  NS_IMETHOD GetAbbreviatedName(nsAString& aAbbreviatedName) MOZ_OVERRIDE;

  NS_IMETHOD GetFolderURL(nsACString& url) MOZ_OVERRIDE;

  NS_IMETHOD GetExpungedBytesCount(uint32_t *count);
  NS_IMETHOD GetDeletable(bool *deletable) MOZ_OVERRIDE;

  NS_IMETHOD RefreshSizeOnDisk();

  NS_IMETHOD GetSizeOnDisk(uint32_t *size) MOZ_OVERRIDE;

  NS_IMETHOD GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo,
                                  nsIMsgDatabase **db) MOZ_OVERRIDE;

  NS_IMETHOD DeleteMessages(nsIArray *messages,
                            nsIMsgWindow *msgWindow, bool deleteStorage,
                            bool isMove, nsIMsgCopyServiceListener* listener, 
                            bool allowUndo) MOZ_OVERRIDE;
  NS_IMETHOD GetNewMessages(nsIMsgWindow *aWindow,
                            nsIUrlListener *aListener) MOZ_OVERRIDE;

  NS_IMETHOD GetCanSubscribe(bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetCanFileMessages(bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetCanCreateSubfolders(bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetCanRename(bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetCanCompact(bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD OnReadChanged(nsIDBChangeListener * aInstigator) MOZ_OVERRIDE;

  NS_IMETHOD DownloadMessagesForOffline(nsIArray *messages,
                                        nsIMsgWindow *window) MOZ_OVERRIDE;
  NS_IMETHOD Compact(nsIUrlListener *aListener,
                     nsIMsgWindow *aMsgWindow) MOZ_OVERRIDE;
  NS_IMETHOD DownloadAllForOffline(nsIUrlListener *listener,
                                   nsIMsgWindow *msgWindow) MOZ_OVERRIDE;
  NS_IMETHOD GetSortOrder(int32_t *order) MOZ_OVERRIDE;
  NS_IMETHOD SetSortOrder(int32_t order) MOZ_OVERRIDE;

  NS_IMETHOD Shutdown(bool shutdownChildren) MOZ_OVERRIDE;

  NS_IMETHOD GetFilterList(nsIMsgWindow *aMsgWindow,
                           nsIMsgFilterList **aFilterList) MOZ_OVERRIDE;
  NS_IMETHOD GetEditableFilterList(nsIMsgWindow *aMsgWindow,
                                   nsIMsgFilterList **aFilterList) MOZ_OVERRIDE;
  NS_IMETHOD SetFilterList(nsIMsgFilterList *aFilterList) MOZ_OVERRIDE;
  NS_IMETHOD SetEditableFilterList(nsIMsgFilterList *aFilterList) MOZ_OVERRIDE;
  NS_IMETHOD ApplyRetentionSettings() MOZ_OVERRIDE;

protected:
  // helper routine to parse the URI and update member variables
  nsresult AbbreviatePrettyName(nsAString& prettyName, int32_t fullwords);
  nsresult ParseFolder(nsIFile *path);
  nsresult CreateSubFolders(nsIFile *path);
  nsresult AddDirectorySeparator(nsIFile *path);
  nsresult GetDatabase() MOZ_OVERRIDE;
  virtual nsresult CreateChildFromURI(const nsCString &uri,
                                      nsIMsgFolder **folder) MOZ_OVERRIDE;

  nsresult LoadNewsrcFileAndCreateNewsgroups();
  int32_t RememberLine(const nsACString& line);
  nsresult RememberUnsubscribedGroup(const nsACString& newsgroup, const nsACString& setStr);
  nsresult ForgetLine(void);
  nsresult GetNewsMessages(nsIMsgWindow *aMsgWindow, bool getOld, nsIUrlListener *aListener);

  int32_t HandleNewsrcLine(const char * line, uint32_t line_size);
  virtual void GetIncomingServerType(nsCString& serverType) MOZ_OVERRIDE
  {
    serverType.AssignLiteral("nntp");
  }
  virtual nsresult CreateBaseMessageURI(const nsACString& aURI) MOZ_OVERRIDE;

protected:
  uint32_t  mExpungedBytes;
  bool mGettingNews;
  bool mInitialized;
  bool m_downloadMessageForOfflineUse;
  bool m_downloadingMultipleMessages;

  nsCString mOptionLines;
  nsCString mUnsubscribedNewsgroupLines;
  nsMsgKeySet *mReadSet;

  nsCOMPtr<nsIFile> mNewsrcFilePath;

  // used for auth news
  nsCString mGroupUsername;
  nsCString mGroupPassword;

  // the name of the newsgroup.
  nsCString mRawName;
  int32_t mSortOrder;

private:
  /**
   * Constructs a signon url for use in login manager.
   *
   * @param ref    The URI ref (should be null unless working with legacy).
   * @param result The result of the string
   */
  nsresult CreateNewsgroupUrlForSignon(const char *ref, nsAString &result);
  nsCOMPtr <nsIMsgFilterList> mFilterList;
};

#endif // nsMsgNewsFolder_h__
