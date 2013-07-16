/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImapUndoTxn_h__
#define nsImapUndoTxn_h__

#include "mozilla/Attributes.h"
#include "nsIMsgFolder.h"
#include "nsImapCore.h"
#include "nsIImapService.h"
#include "nsIImapIncomingServer.h"
#include "nsIUrlListener.h"
#include "nsMsgTxn.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsIMsgOfflineImapOperation.h"
#include "nsCOMPtr.h"
#include "nsWeakReference.h"
#include "nsCOMArray.h"

class nsImapMoveCopyMsgTxn : public nsMsgTxn, nsIUrlListener
{
public:

  nsImapMoveCopyMsgTxn();
  nsImapMoveCopyMsgTxn(nsIMsgFolder* srcFolder, nsTArray<nsMsgKey>* srcKeyArray,
                       const char* srcMsgIdString, nsIMsgFolder* dstFolder,
                       bool isMove);
  virtual ~nsImapMoveCopyMsgTxn();

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIURLLISTENER

  NS_IMETHOD UndoTransaction(void) MOZ_OVERRIDE;
  NS_IMETHOD RedoTransaction(void) MOZ_OVERRIDE;

  // helper
  nsresult SetCopyResponseUid(const char *msgIdString);
  nsresult GetSrcKeyArray(nsTArray<nsMsgKey>& srcKeyArray);
  void GetSrcMsgIds(nsCString &srcMsgIds) {srcMsgIds = m_srcMsgIdString;}
  nsresult AddDstKey(nsMsgKey aKey);
  nsresult UndoMailboxDelete();
  nsresult RedoMailboxDelete();
  nsresult Init(nsIMsgFolder* srcFolder, nsTArray<nsMsgKey>* srcKeyArray,
                const char* srcMsgIdString, nsIMsgFolder* dstFolder,
                bool idsAreUids, bool isMove);

protected:

  nsWeakPtr m_srcFolder;
  nsCOMArray<nsIMsgDBHdr> m_srcHdrs;
  nsTArray<nsMsgKey> m_dupKeyArray;
  nsTArray<nsMsgKey> m_srcKeyArray;
  nsTArray<nsCString> m_srcMessageIds;
  nsCString m_srcMsgIdString;
  nsWeakPtr m_dstFolder;
  nsCString m_dstMsgIdString;
  bool m_idsAreUids;
  bool m_isMove;
  bool m_srcIsPop3;
  nsTArray<uint32_t> m_srcSizeArray;
  // this is used when we chain urls for imap undo, since "this" needs
  // to be the listener, but the folder may need to also be notified.
  nsWeakPtr m_onStopListener;

  nsresult GetImapDeleteModel(nsIMsgFolder* aFolder, nsMsgImapDeleteModel *aDeleteModel);
};

class nsImapOfflineTxn : public nsImapMoveCopyMsgTxn
{
public:
  nsImapOfflineTxn(nsIMsgFolder* srcFolder, nsTArray<nsMsgKey>* srcKeyArray,
                   const char* srcMsgIdString,
                   nsIMsgFolder* dstFolder,
                   bool isMove,
                   nsOfflineImapOperationType opType,
                   nsCOMArray<nsIMsgDBHdr> &srcHdrs);
  virtual ~nsImapOfflineTxn();

  NS_IMETHOD UndoTransaction(void) MOZ_OVERRIDE;
  NS_IMETHOD RedoTransaction(void) MOZ_OVERRIDE;
  void SetAddFlags(bool addFlags) {m_addFlags = addFlags;}
  void SetFlags(uint32_t flags) {m_flags = flags;}
protected:
  nsOfflineImapOperationType m_opType;
  // these two are used to undo flag changes, which we don't currently do.
  bool m_addFlags;
  uint32_t m_flags;
};
#endif
