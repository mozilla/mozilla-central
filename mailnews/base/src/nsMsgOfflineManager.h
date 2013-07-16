/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgOfflineManager_h__
#define nsMsgOfflineManager_h__

#include "nscore.h"
#include "nsIMsgOfflineManager.h"
#include "nsCOMPtr.h"
#include "nsIObserver.h"
#include "nsWeakReference.h"
#include "nsIUrlListener.h"
#include "nsIMsgWindow.h"
#include "nsIMsgSendLaterListener.h"
#include "nsIStringBundle.h"

class nsMsgOfflineManager
	: public nsIMsgOfflineManager,
      public nsIObserver,
      public nsSupportsWeakReference,
      public nsIMsgSendLaterListener,
    public nsIUrlListener
{
public:

  nsMsgOfflineManager();
  virtual ~nsMsgOfflineManager();
  
  NS_DECL_THREADSAFE_ISUPPORTS
 
  /* nsIMsgOfflineManager methods */
  
  NS_DECL_NSIMSGOFFLINEMANAGER
  NS_DECL_NSIOBSERVER  
  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIMSGSENDLATERLISTENER

  typedef enum 
  {
    eStarting = 0,
	  eSynchronizingOfflineImapChanges = 1,
    eDownloadingNews = 2,
    eDownloadingMail = 3,
	  eSendingUnsent = 4,
    eDone = 5,
    eNoState = 6  // we're not doing anything
  } offlineManagerState;

  typedef enum 
  {
    eGoingOnline = 0,
    eDownloadingForOffline = 1,
    eNoOp = 2 // no operation in progress
  } offlineManagerOperation;

private:
  nsresult AdvanceToNextState(nsresult exitStatus);
  nsresult SynchronizeOfflineImapChanges();
  nsresult StopRunning(nsresult exitStatus);
  nsresult SendUnsentMessages();
  nsresult DownloadOfflineNewsgroups();
  nsresult DownloadMail();

  nsresult SetOnlineState(bool online);
  nsresult ShowStatus(const char *statusMsgName);

  bool m_inProgress;
  bool m_sendUnsentMessages;
  bool m_downloadNews;
  bool m_downloadMail;
  bool m_playbackOfflineImapOps;
  bool m_goOfflineWhenDone;
  offlineManagerState m_curState;
  offlineManagerOperation m_curOperation;
  nsCOMPtr <nsIMsgWindow> m_window;
  nsCOMPtr <nsIMsgStatusFeedback> m_statusFeedback;
  nsCOMPtr<nsIStringBundle>   mStringBundle;
  nsCOMPtr<nsISupports> mOfflineImapSync;

};

#endif
