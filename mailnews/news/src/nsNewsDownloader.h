/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsNewsDownloader_H_
#define _nsNewsDownloader_H_


#include "nsIMsgDatabase.h"
#include "nsIUrlListener.h"
#include "nsIMsgFolder.h"
#include "nsIMsgHdr.h"
#include "nsIMsgWindow.h"
#include "nsIMsgSearchNotify.h"
#include "nsIMsgSearchSession.h"
#include "nsIEnumerator.h"

// base class for downloading articles in a single newsgroup. Keys to download are passed in
// to DownloadArticles method.
class nsNewsDownloader : public nsIUrlListener, public nsIMsgSearchNotify
{
public:
  nsNewsDownloader(nsIMsgWindow *window, nsIMsgDatabase *db, nsIUrlListener *listener);
  virtual ~nsNewsDownloader();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIMSGSEARCHNOTIFY

  virtual nsresult DownloadArticles(nsIMsgWindow *window, nsIMsgFolder *folder, nsTArray<nsMsgKey> *pKeyArray);

  bool ShouldAbort() const { return m_abort; }

protected:
  virtual int32_t Write(const char * /*block*/, int32_t length) {return length;}
  virtual void Abort();
  virtual void Complete();
  virtual bool GetNextHdrToRetrieve();
  virtual nsresult DownloadNext(bool firstTimeP);
  virtual int32_t FinishDownload() {return 0;}
  virtual int32_t  StartDownload() {return 0;}
  virtual nsresult ShowProgress(const PRUnichar *progressString, int32_t percent);

  nsTArray<nsMsgKey>      m_keysToDownload;
  nsCOMPtr <nsIMsgFolder>  m_folder;
  nsCOMPtr <nsIMsgDatabase> m_newsDB;
  nsCOMPtr <nsIUrlListener> m_listener;
  bool m_downloadFromKeys;
  bool m_existedP;
  bool m_wroteAnyP;
  bool m_summaryValidP;
  bool m_abort;
  int32_t     m_numwrote;
  nsMsgKey    m_keyToDownload;
  nsCOMPtr <nsIMsgWindow> m_window;
  nsCOMPtr <nsIMsgStatusFeedback> m_statusFeedback;
  nsCOMPtr <nsIMsgSearchSession> m_searchSession;
  int32_t m_lastPercent;
  int64_t m_lastProgressTime;
  nsresult  m_status;
};


// class for downloading articles in a single newsgroup to the offline store.
class DownloadNewsArticlesToOfflineStore : public nsNewsDownloader
{
public:
  DownloadNewsArticlesToOfflineStore(nsIMsgWindow *window, nsIMsgDatabase *db, nsIUrlListener *listener);
  virtual ~DownloadNewsArticlesToOfflineStore();

  NS_IMETHOD OnStartRunningUrl(nsIURI* url);
  NS_IMETHOD OnStopRunningUrl(nsIURI* url, nsresult exitCode);
protected:
  virtual int32_t  StartDownload();
  virtual int32_t FinishDownload();
  virtual bool GetNextHdrToRetrieve();

  nsCOMPtr <nsISimpleEnumerator>  m_headerEnumerator;
  nsCOMPtr <nsIMsgDBHdr>  m_newsHeader;
};

// class for downloading all the articles that match the passed in search criteria
// for a single newsgroup.
class DownloadMatchingNewsArticlesToNewsDB : public DownloadNewsArticlesToOfflineStore
{
public:
  DownloadMatchingNewsArticlesToNewsDB(nsIMsgWindow *window, nsIMsgFolder *folder, nsIMsgDatabase *newsDB,  nsIUrlListener *listener);
  virtual ~DownloadMatchingNewsArticlesToNewsDB();
  nsresult RunSearch(nsIMsgFolder *folder, nsIMsgDatabase *newsDB, nsIMsgSearchSession *searchSession);
protected:
};

// this class iterates all the news servers for each group on the server that's configured for
// offline use, downloads the messages that meet the download criteria for that newsgroup/server
class nsMsgDownloadAllNewsgroups : public nsIUrlListener
{
public:
  nsMsgDownloadAllNewsgroups(nsIMsgWindow *window, nsIUrlListener *listener);
  virtual ~nsMsgDownloadAllNewsgroups();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIURLLISTENER

  nsresult ProcessNextGroup();

protected:
  bool     AdvanceToNextServer();
  bool     AdvanceToNextGroup();
  nsresult DownloadMsgsForCurrentGroup();

  DownloadMatchingNewsArticlesToNewsDB *m_downloaderForGroup;

  nsCOMPtr <nsIMsgFolder> m_currentFolder;
  nsCOMPtr <nsIMsgWindow> m_window;
  nsCOMPtr <nsIArray> m_allServers;
  nsCOMPtr <nsIArray> m_allFolders;
  nsCOMPtr <nsIMsgIncomingServer> m_currentServer;
  nsCOMPtr <nsISimpleEnumerator> m_serverEnumerator;
  nsCOMPtr <nsIUrlListener> m_listener;

  bool m_downloadedHdrsForCurGroup;
};

#endif
