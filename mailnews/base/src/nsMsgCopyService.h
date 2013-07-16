/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgCopyService_h__
#define nsMsgCopyService_h__

#include "nscore.h"
#include "nsIMsgCopyService.h"
#include "nsCOMPtr.h"
#include "nsIMsgFolder.h"
#include "nsIMsgHdr.h"
#include "nsIMsgWindow.h"
#include "nsIMutableArray.h"
#include "nsTArray.h"

typedef enum _nsCopyRequestType
{
    nsCopyMessagesType = 0x0,
    nsCopyFileMessageType = 0x1,
    nsCopyFoldersType = 0x2
} nsCopyRequestType;

class nsCopyRequest;

class nsCopySource
{
public:
    nsCopySource();
    nsCopySource(nsIMsgFolder* srcFolder);
    ~nsCopySource();
    void AddMessage(nsIMsgDBHdr* aMsg);

    nsCOMPtr<nsIMsgFolder> m_msgFolder;
    nsCOMPtr<nsIMutableArray> m_messageArray;
    bool m_processed;
};

class nsCopyRequest 
{
public:
    nsCopyRequest();
    ~nsCopyRequest();

    nsresult Init(nsCopyRequestType type, nsISupports* aSupport,
                  nsIMsgFolder* dstFolder,
                  bool bVal, uint32_t newMsgFlags, 
                  const nsACString &newMsgKeywords,
                  nsIMsgCopyServiceListener* listener,
                  nsIMsgWindow *msgWindow, bool allowUndo);
    nsCopySource* AddNewCopySource(nsIMsgFolder* srcFolder);

    nsCOMPtr<nsISupports> m_srcSupport; // ui source folder or file spec
    nsCOMPtr<nsIMsgFolder> m_dstFolder;
    nsCOMPtr<nsIMsgWindow> m_msgWindow;
    nsCOMPtr<nsIMsgCopyServiceListener> m_listener;
	nsCOMPtr<nsITransactionManager> m_txnMgr;
    nsCopyRequestType m_requestType;
    bool m_isMoveOrDraftOrTemplate;
    bool m_allowUndo;
    bool m_processed;
    uint32_t m_newMsgFlags;
    nsCString m_newMsgKeywords;
    nsString m_dstFolderName;      // used for copy folder.
    nsTArray<nsCopySource*> m_copySourceArray; // array of nsCopySource
};

class nsMsgCopyService : public nsIMsgCopyService
{
public:
  nsMsgCopyService();
  virtual ~nsMsgCopyService();

  NS_DECL_THREADSAFE_ISUPPORTS 

  NS_DECL_NSIMSGCOPYSERVICE

private:

  nsresult ClearRequest(nsCopyRequest* aRequest, nsresult rv);
  nsresult DoCopy(nsCopyRequest* aRequest);
  nsresult DoNextCopy();
  nsCopyRequest* FindRequest(nsISupports* aSupport, nsIMsgFolder* dstFolder);
  nsresult QueueRequest(nsCopyRequest* aRequest, bool *aCopyImmediately);
  void LogCopyCompletion(nsISupports *aSrc, nsIMsgFolder *aDest);
  void LogCopyRequest(const char *logMsg, nsCopyRequest* aRequest);

  nsTArray<nsCopyRequest*> m_copyRequests;
};


#endif 
