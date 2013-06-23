/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
   Interface for representing News folders.
*/

#ifndef nsMsgNewsFolder_h__
#define nsMsgNewsFolder_h__

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
  NS_IMETHOD OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode);
  // nsIMsgFolder methods:
  NS_IMETHOD GetSubFolders(nsISimpleEnumerator **aResult);

  NS_IMETHOD GetMessages(nsISimpleEnumerator **result);
  NS_IMETHOD UpdateFolder(nsIMsgWindow *aWindow);

  NS_IMETHOD CreateSubfolder(const nsAString& folderName,nsIMsgWindow *msgWindow);

  NS_IMETHOD Delete ();
  NS_IMETHOD Rename (const nsAString& newName, nsIMsgWindow *msgWindow);

  NS_IMETHOD GetAbbreviatedName(nsAString& aAbbreviatedName);

  NS_IMETHOD GetFolderURL(nsACString& url);

  NS_IMETHOD GetExpungedBytesCount(uint32_t *count);
  NS_IMETHOD GetDeletable (bool *deletable);

  NS_IMETHOD RefreshSizeOnDisk();

  NS_IMETHOD GetSizeOnDisk(uint32_t *size);

  NS_IMETHOD GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo, nsIMsgDatabase **db);

  NS_IMETHOD DeleteMessages(nsIArray *messages,
                      nsIMsgWindow *msgWindow, bool deleteStorage, bool isMove,
                      nsIMsgCopyServiceListener* listener, bool allowUndo);
  NS_IMETHOD GetNewMessages(nsIMsgWindow *aWindow, nsIUrlListener *aListener);

  NS_IMETHOD GetCanSubscribe(bool *aResult);
  NS_IMETHOD GetCanFileMessages(bool *aResult);
  NS_IMETHOD GetCanCreateSubfolders(bool *aResult);
  NS_IMETHOD GetCanRename(bool *aResult);
  NS_IMETHOD GetCanCompact(bool *aResult);
  NS_IMETHOD OnReadChanged(nsIDBChangeListener * aInstigator);

  NS_IMETHOD DownloadMessagesForOffline(nsIArray *messages, nsIMsgWindow *window);
  NS_IMETHOD Compact(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow);
  NS_IMETHOD DownloadAllForOffline(nsIUrlListener *listener, nsIMsgWindow *msgWindow);
  NS_IMETHOD GetSortOrder(int32_t *order);
  NS_IMETHOD SetSortOrder(int32_t order);

  NS_IMETHOD Shutdown(bool shutdownChildren);

  NS_IMETHOD GetFilterList(nsIMsgWindow *aMsgWindow, nsIMsgFilterList **aFilterList);
  NS_IMETHOD GetEditableFilterList(nsIMsgWindow *aMsgWindow, nsIMsgFilterList **aFilterList);
  NS_IMETHOD SetFilterList(nsIMsgFilterList *aFilterList);
  NS_IMETHOD SetEditableFilterList(nsIMsgFilterList *aFilterList);
  NS_IMETHOD ApplyRetentionSettings();

protected:
  // helper routine to parse the URI and update member variables
  nsresult AbbreviatePrettyName(nsAString& prettyName, int32_t fullwords);
  nsresult ParseFolder(nsIFile *path);
  nsresult CreateSubFolders(nsIFile *path);
  nsresult AddDirectorySeparator(nsIFile *path);
  nsresult GetDatabase();
  virtual nsresult CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder);

  nsresult LoadNewsrcFileAndCreateNewsgroups();
  int32_t RememberLine(const nsACString& line);
  nsresult RememberUnsubscribedGroup(const nsACString& newsgroup, const nsACString& setStr);
  nsresult ForgetLine(void);
  nsresult GetNewsMessages(nsIMsgWindow *aMsgWindow, bool getOld, nsIUrlListener *aListener);

  int32_t HandleNewsrcLine(const char * line, uint32_t line_size);
  virtual void GetIncomingServerType(nsCString& serverType) { serverType.AssignLiteral("nntp");}
  virtual nsresult CreateBaseMessageURI(const nsACString& aURI);

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
