/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsLocalUndoTxn_h__
#define nsLocalUndoTxn_h__

#include "mozilla/Attributes.h"
#include "msgCore.h"
#include "nsIMsgFolder.h"
#include "nsMailboxService.h"
#include "nsMsgTxn.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsCOMPtr.h"
#include "nsIUrlListener.h"
#include "nsIWeakReference.h"
#include "nsIWeakReferenceUtils.h"

class nsLocalUndoFolderListener;

class nsLocalMoveCopyMsgTxn : public nsIFolderListener, public nsMsgTxn
{
public:
    nsLocalMoveCopyMsgTxn();
    virtual ~nsLocalMoveCopyMsgTxn();
    NS_DECL_ISUPPORTS_INHERITED
    NS_DECL_NSIFOLDERLISTENER

    // overloading nsITransaction methods
    NS_IMETHOD UndoTransaction(void) MOZ_OVERRIDE;
    NS_IMETHOD RedoTransaction(void) MOZ_OVERRIDE;

    // helper
    nsresult AddSrcKey(nsMsgKey aKey);
    nsresult AddSrcStatusOffset(uint32_t statusOffset);
    nsresult AddDstKey(nsMsgKey aKey);
    nsresult AddDstMsgSize(uint32_t msgSize);
    nsresult SetSrcFolder(nsIMsgFolder* srcFolder);
    nsresult GetSrcIsImap(bool *isImap);
    nsresult SetDstFolder(nsIMsgFolder* dstFolder);
    nsresult Init(nsIMsgFolder* srcFolder,
                  nsIMsgFolder* dstFolder, bool isMove);
    nsresult UndoImapDeleteFlag(nsIMsgFolder* aFolder,
                                nsTArray<nsMsgKey>& aKeyArray,
                                bool deleteFlag);
    nsresult UndoTransactionInternal();
    // If the store using this undo transaction can "undelete" a message,
    // it will call this function on the transaction; This makes undo/redo
    // easy because message keys don't change after undo/redo. Otherwise,
    // we need to adjust the src or dst keys after every undo/redo action
    // to note the new keys.
    void SetCanUndelete(bool canUndelete) {m_canUndelete = canUndelete;}

private:
    nsWeakPtr m_srcFolder;
    nsTArray<nsMsgKey> m_srcKeyArray; // used when src is local or imap
    nsTArray<uint32_t> m_srcStatusOffsetArray; // used when src is local
    nsWeakPtr m_dstFolder;
    nsTArray<nsMsgKey> m_dstKeyArray;
    bool m_isMove;
    bool m_srcIsImap4;
    bool m_canUndelete;
    nsTArray<uint32_t> m_dstSizeArray;
    bool m_undoing; // if false, re-doing
    int32_t m_numHdrsCopied;
    nsTArray<nsCString> m_copiedMsgIds;
    nsLocalUndoFolderListener *mUndoFolderListener;
};

class nsLocalUndoFolderListener : public nsIFolderListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIFOLDERLISTENER

  nsLocalUndoFolderListener(nsLocalMoveCopyMsgTxn *aTxn, nsIMsgFolder *aFolder);
  virtual ~nsLocalUndoFolderListener();

private:
  nsLocalMoveCopyMsgTxn *mTxn;
  nsIMsgFolder *mFolder;
};

#endif
