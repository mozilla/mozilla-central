/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsIMsgHdr.h"
#include "nsLocalUndoTxn.h"
#include "nsImapCore.h"
#include "nsMsgImapCID.h"
#include "nsIImapService.h"
#include "nsIUrlListener.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsThreadUtils.h"
#include "nsIMsgDatabase.h"
#include "nsIMutableArray.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMsgUtils.h"

NS_IMPL_ISUPPORTS_INHERITED1(nsLocalMoveCopyMsgTxn, nsMsgTxn, nsIFolderListener)

nsLocalMoveCopyMsgTxn::nsLocalMoveCopyMsgTxn()  : m_srcIsImap4(false),
  m_canUndelete(false)
{
}

nsLocalMoveCopyMsgTxn::~nsLocalMoveCopyMsgTxn()
{
}

nsresult
nsLocalMoveCopyMsgTxn::Init(nsIMsgFolder* srcFolder, nsIMsgFolder* dstFolder,
                            bool isMove)
{
    nsresult rv;
    rv = SetSrcFolder(srcFolder);
    rv = SetDstFolder(dstFolder);
    m_isMove = isMove;

    mUndoFolderListener = nullptr;

    nsCString protocolType;
    rv = srcFolder->GetURI(protocolType);
    protocolType.SetLength(protocolType.FindChar(':'));
    if (MsgLowerCaseEqualsLiteral(protocolType, "imap"))
      m_srcIsImap4 = true;
    return nsMsgTxn::Init();
}
nsresult 
nsLocalMoveCopyMsgTxn::GetSrcIsImap(bool *isImap)
{
  *isImap = m_srcIsImap4;
  return NS_OK;
}
nsresult
nsLocalMoveCopyMsgTxn::SetSrcFolder(nsIMsgFolder* srcFolder)
{
  nsresult rv = NS_ERROR_NULL_POINTER;
  if (srcFolder)
    m_srcFolder = do_GetWeakReference(srcFolder, &rv);
  return rv;
}

nsresult
nsLocalMoveCopyMsgTxn::SetDstFolder(nsIMsgFolder* dstFolder)
{
  nsresult rv = NS_ERROR_NULL_POINTER;
  if (dstFolder)
    m_dstFolder = do_GetWeakReference(dstFolder, &rv);
  return rv;
}

nsresult
nsLocalMoveCopyMsgTxn::AddSrcKey(nsMsgKey aKey)
{
  m_srcKeyArray.AppendElement(aKey);
  return NS_OK;
}

nsresult
nsLocalMoveCopyMsgTxn::AddSrcStatusOffset(PRUint32 aStatusOffset)
{
  m_srcStatusOffsetArray.AppendElement(aStatusOffset);
  return NS_OK;
}


nsresult
nsLocalMoveCopyMsgTxn::AddDstKey(nsMsgKey aKey)
{
  m_dstKeyArray.AppendElement(aKey);
  return NS_OK;
}

nsresult
nsLocalMoveCopyMsgTxn::AddDstMsgSize(PRUint32 msgSize)
{
    m_dstSizeArray.AppendElement(msgSize);
    return NS_OK;
}

nsresult
nsLocalMoveCopyMsgTxn::UndoImapDeleteFlag(nsIMsgFolder* folder, 
                                          nsTArray<nsMsgKey>& keyArray,
                                          bool deleteFlag)
{
  nsresult rv = NS_ERROR_FAILURE;
  if (m_srcIsImap4)
  {
    nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsIUrlListener> urlListener;
    nsCString msgIds;
    PRUint32 i, count = keyArray.Length();
    urlListener = do_QueryInterface(folder, &rv);
    for (i=0; i < count; i++)
    {
      if (!msgIds.IsEmpty())
          msgIds.Append(',');
      msgIds.AppendInt((PRInt32) keyArray[i]);
    }
    // This is to make sure that we are in the selected state
    // when executing the imap url; we don't want to load the
    // folder so use lite select to do the trick
    rv = imapService->LiteSelectFolder(folder,
                                       urlListener, nullptr, nullptr);
    if (!deleteFlag)
        rv =imapService->AddMessageFlags(folder,
                                         urlListener, nullptr,
                                         msgIds,
                                         kImapMsgDeletedFlag,
                                         true);
    else
        rv = imapService->SubtractMessageFlags(folder,
                                               urlListener, nullptr,
                                               msgIds,
                                               kImapMsgDeletedFlag,
                                               true);
    if (NS_SUCCEEDED(rv) && m_msgWindow)
        folder->UpdateFolder(m_msgWindow);
    rv = NS_OK; // always return NS_OK to indicate that the src is imap
  }
  else
    rv = NS_ERROR_FAILURE;
  return rv;
}

NS_IMETHODIMP
nsLocalMoveCopyMsgTxn::UndoTransaction()
{
  nsresult rv;
  nsCOMPtr<nsIMsgDatabase> dstDB;
  
  nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgLocalMailFolder> dstlocalMailFolder = do_QueryReferent(m_dstFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  dstlocalMailFolder->GetDatabaseWOReparse(getter_AddRefs(dstDB));

  if (!dstDB)
  {
    // This will listen for the db reparse finishing, and the corresponding
    // FolderLoadedNotification. When it gets that, it will then call
    // UndoTransactionInternal.
    mUndoFolderListener = new nsLocalUndoFolderListener(this, dstFolder);
    if (!mUndoFolderListener)
      return NS_ERROR_OUT_OF_MEMORY; 
    NS_ADDREF(mUndoFolderListener);
    
    nsCOMPtr<nsIMsgMailSession> mailSession = 
      do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv); 
    NS_ENSURE_SUCCESS(rv,rv);
    
    rv = mailSession->AddFolderListener(mUndoFolderListener, nsIFolderListener::event);
    NS_ENSURE_SUCCESS(rv,rv);
    
    rv = dstFolder->GetMsgDatabase(getter_AddRefs(dstDB));
    NS_ENSURE_SUCCESS(rv,rv);
  }
  else
    rv = UndoTransactionInternal();
  return rv;
}

nsresult 
nsLocalMoveCopyMsgTxn::UndoTransactionInternal()
{
  nsresult rv = NS_ERROR_FAILURE;

  if (mUndoFolderListener)
  {
    nsCOMPtr<nsIMsgMailSession> mailSession = 
      do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv); 
    NS_ENSURE_SUCCESS(rv,rv);
    
    rv = mailSession->RemoveFolderListener(mUndoFolderListener);
    NS_ENSURE_SUCCESS(rv,rv);
    
    NS_RELEASE(mUndoFolderListener);
    mUndoFolderListener = nullptr;
  }

  nsCOMPtr<nsIMsgDatabase> srcDB;
  nsCOMPtr<nsIMsgDatabase> dstDB;
  nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  
  rv = srcFolder->GetMsgDatabase(getter_AddRefs(srcDB));
  if(NS_FAILED(rv)) return rv;

  rv = dstFolder->GetMsgDatabase(getter_AddRefs(dstDB));
  if (NS_FAILED(rv)) return rv;

  PRUint32 count = m_srcKeyArray.Length();
  PRUint32 i;
  nsCOMPtr<nsIMsgDBHdr> oldHdr;
  nsCOMPtr<nsIMsgDBHdr> newHdr;

  // protect against a bogus undo txn without any source keys
  // see bug #179856 for details
  NS_ASSERTION(count, "no source keys");
  if (!count)
    return NS_ERROR_UNEXPECTED;

  if (m_isMove)
  {
    if (m_srcIsImap4)
    {
      bool deleteFlag = true;  //message has been deleted -we are trying to undo it
      CheckForToggleDelete(srcFolder, m_srcKeyArray[0], &deleteFlag); //there could have been a toggle.
      rv = UndoImapDeleteFlag(srcFolder, m_srcKeyArray, deleteFlag);
    }
    else if (m_canUndelete)
    {
      nsCOMPtr<nsIMutableArray> srcMessages =
        do_CreateInstance(NS_ARRAY_CONTRACTID);
      nsCOMPtr<nsIMutableArray> dstMessages =
        do_CreateInstance(NS_ARRAY_CONTRACTID);

      srcDB->StartBatch();
      for (i = 0; i < count; i++)
      {
        rv = dstDB->GetMsgHdrForKey(m_dstKeyArray[i], 
                                    getter_AddRefs(oldHdr));
        NS_ASSERTION(oldHdr, "fatal ... cannot get old msg header\n");
        if (NS_SUCCEEDED(rv) && oldHdr)
        {
          rv = srcDB->CopyHdrFromExistingHdr(m_srcKeyArray[i],
                                             oldHdr, true,
                                             getter_AddRefs(newHdr));
          NS_ASSERTION(newHdr, 
                       "fatal ... cannot create new msg header\n");
          if (NS_SUCCEEDED(rv) && newHdr)
          {
            newHdr->SetStatusOffset(m_srcStatusOffsetArray[i]);
            srcDB->UndoDelete(newHdr);
            srcMessages->AppendElement(newHdr, false);
            // (we want to keep these two lists in sync)
            dstMessages->AppendElement(oldHdr, false);
          }
        }
      }
      srcDB->EndBatch();

      nsCOMPtr<nsIMsgFolderNotificationService>
        notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
      {
        // Remember that we're actually moving things back from the destination
        //  to the source!
        notifier->NotifyMsgsMoveCopyCompleted(true, dstMessages,
                                              srcFolder, srcMessages);
      }

      nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(srcFolder);
      if (localFolder)
        localFolder->MarkMsgsOnPop3Server(srcMessages, POP3_NONE /*deleteMsgs*/);
    }
    else // undoing a move means moving the messages back.
    {
      nsCOMPtr<nsIMutableArray> dstMessages =
        do_CreateInstance(NS_ARRAY_CONTRACTID);
      nsCOMPtr<nsIMsgDBHdr> dstHdr;
      m_numHdrsCopied = 0;
      m_srcKeyArray.Clear();
      for (i = 0; i < count; i++)
      {
        dstDB->GetMsgHdrForKey(m_dstKeyArray[i], getter_AddRefs(dstHdr));
        NS_ASSERTION(dstHdr, "fatal ... cannot get old msg header\n");
        if (dstHdr)
        {
          nsCString messageId;
          dstHdr->GetMessageId(getter_Copies(messageId));
          dstMessages->AppendElement(dstHdr, false);
          m_copiedMsgIds.AppendElement(messageId);
        }
      }
      srcFolder->AddFolderListener(this);
      m_undoing = true;
      return srcFolder->CopyMessages(dstFolder, dstMessages,
                                     true, nullptr, nullptr, false,
                                     false);
    }
    srcDB->SetSummaryValid(true);
  }

  dstDB->DeleteMessages(m_dstKeyArray.Length(), m_dstKeyArray.Elements(), nullptr);
  dstDB->SetSummaryValid(true);

  return rv;
}

NS_IMETHODIMP
nsLocalMoveCopyMsgTxn::RedoTransaction()
{
  nsresult rv;
  nsCOMPtr<nsIMsgDatabase> srcDB;
  nsCOMPtr<nsIMsgDatabase> dstDB;

  nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  
  rv = srcFolder->GetMsgDatabase(getter_AddRefs(srcDB));
  if(NS_FAILED(rv)) return rv;
  rv = dstFolder->GetMsgDatabase(getter_AddRefs(dstDB));
  if (NS_FAILED(rv)) return rv;

  PRUint32 count = m_srcKeyArray.Length();
  PRUint32 i;
  nsCOMPtr<nsIMsgDBHdr> oldHdr;
  nsCOMPtr<nsIMsgDBHdr> newHdr;

  nsCOMPtr<nsIMutableArray> srcMessages = do_CreateInstance(NS_ARRAY_CONTRACTID);
  nsCOMPtr <nsISupports> msgSupports;
  
  for (i=0; i<count; i++)
  {
    rv = srcDB->GetMsgHdrForKey(m_srcKeyArray[i], 
                                getter_AddRefs(oldHdr));
    NS_ASSERTION(oldHdr, "fatal ... cannot get old msg header\n");

    if (NS_SUCCEEDED(rv) && oldHdr)
    {
      msgSupports =do_QueryInterface(oldHdr);
      srcMessages->AppendElement(msgSupports, false);
      
      if (m_canUndelete)
      {
      rv = dstDB->CopyHdrFromExistingHdr(m_dstKeyArray[i],
                                         oldHdr, true,
                                         getter_AddRefs(newHdr));
      NS_ASSERTION(newHdr, "fatal ... cannot get new msg header\n");
      if (NS_SUCCEEDED(rv) && newHdr)
      {
        if (i < m_dstSizeArray.Length())
          rv = newHdr->SetMessageSize(m_dstSizeArray[i]);
        dstDB->UndoDelete(newHdr);
      }
    }
  }
  }
  dstDB->SetSummaryValid(true);

  if (m_isMove)
  {
    if (m_srcIsImap4)
    {
      // protect against a bogus undo txn without any source keys
      // see bug #179856 for details
      NS_ASSERTION(!m_srcKeyArray.IsEmpty(), "no source keys");
      if (m_srcKeyArray.IsEmpty())
        return NS_ERROR_UNEXPECTED;
    
      bool deleteFlag = false; //message is un-deleted- we are trying to redo
      CheckForToggleDelete(srcFolder, m_srcKeyArray[0], &deleteFlag); // there could have been a toggle
      rv = UndoImapDeleteFlag(srcFolder, m_srcKeyArray, deleteFlag);
    }
    else if (m_canUndelete)
    {
      nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(srcFolder);
      if (localFolder)
        localFolder->MarkMsgsOnPop3Server(srcMessages, POP3_DELETE /*deleteMsgs*/);

      rv = srcDB->DeleteMessages(m_srcKeyArray.Length(), m_srcKeyArray.Elements(), nullptr);
      srcDB->SetSummaryValid(true);
    }
    else
    {
      nsCOMPtr<nsIMsgDBHdr> srcHdr;
      m_numHdrsCopied = 0;
      m_dstKeyArray.Clear();
      for (i = 0; i < count; i++)
      {
        srcDB->GetMsgHdrForKey(m_srcKeyArray[i], getter_AddRefs(srcHdr));
        NS_ASSERTION(srcHdr, "fatal ... cannot get old msg header\n");
        if (srcHdr)
        {
          nsCString messageId;
          srcHdr->GetMessageId(getter_Copies(messageId));
          m_copiedMsgIds.AppendElement(messageId);
        }
      }
      dstFolder->AddFolderListener(this);
      m_undoing = false;
      return dstFolder->CopyMessages(srcFolder, srcMessages, true, nullptr,
                                     nullptr, false, false);
    }
  }

  return rv;
}

NS_IMETHODIMP nsLocalMoveCopyMsgTxn::OnItemAdded(nsIMsgFolder *parentItem, nsISupports *item)
{
  nsCOMPtr<nsIMsgDBHdr> msgHdr(do_QueryInterface(item));
  if (msgHdr)
  {
    nsresult rv;
    nsCOMPtr<nsIMsgFolder> folder = do_QueryReferent(m_undoing ? m_srcFolder :
                                                     m_dstFolder, &rv);
    NS_ENSURE_SUCCESS(rv,rv);
    nsCString messageId;
    msgHdr->GetMessageId(getter_Copies(messageId));
    if (m_copiedMsgIds.IndexOf(messageId) != kNotFound)
    {
      nsMsgKey msgKey;
      msgHdr->GetMessageKey(&msgKey);
      if (m_undoing)
        m_srcKeyArray.AppendElement(msgKey);
      else
        m_dstKeyArray.AppendElement(msgKey);
      if (++m_numHdrsCopied == m_copiedMsgIds.Length())
      {
        folder->RemoveFolderListener(this);
        m_copiedMsgIds.Clear();
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsLocalMoveCopyMsgTxn::OnItemRemoved(nsIMsgFolder *parentItem, nsISupports *item)
{
  return NS_OK;
}

NS_IMETHODIMP nsLocalMoveCopyMsgTxn::OnItemPropertyChanged(nsIMsgFolder *item, nsIAtom *property, const char *oldValue, const char *newValue)
{
  return NS_OK;
}

NS_IMETHODIMP nsLocalMoveCopyMsgTxn::OnItemIntPropertyChanged(nsIMsgFolder *item, nsIAtom *property, PRInt32 oldValue, PRInt32 newValue)
{
  return NS_OK;
}

NS_IMETHODIMP nsLocalMoveCopyMsgTxn::OnItemBoolPropertyChanged(nsIMsgFolder *item, nsIAtom *property, bool oldValue, bool newValue)
{
  return NS_OK;
}

NS_IMETHODIMP nsLocalMoveCopyMsgTxn::OnItemUnicharPropertyChanged(nsIMsgFolder *item, nsIAtom *property, const PRUnichar *oldValue, const PRUnichar *newValue)
{
  return NS_OK;
}

NS_IMETHODIMP nsLocalMoveCopyMsgTxn::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, PRUint32 oldFlag, PRUint32 newFlag)
{
  return NS_OK;
}

NS_IMETHODIMP nsLocalMoveCopyMsgTxn::OnItemEvent(nsIMsgFolder *aItem, nsIAtom *aEvent)
{
  return NS_OK;
}

NS_IMPL_ISUPPORTS1(nsLocalUndoFolderListener, nsIFolderListener)

nsLocalUndoFolderListener::nsLocalUndoFolderListener(nsLocalMoveCopyMsgTxn *aTxn, nsIMsgFolder *aFolder)
{
  mTxn = aTxn;
  mFolder = aFolder;
}

nsLocalUndoFolderListener::~nsLocalUndoFolderListener()
{
}

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemAdded(nsIMsgFolder *parentItem, nsISupports *item)
{
    return NS_OK;
}

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemRemoved(nsIMsgFolder *parentItem, nsISupports *item)
{
    return NS_OK;
}

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemPropertyChanged(nsIMsgFolder *item, nsIAtom *property, const char *oldValue, const char *newValue)
{
    return NS_OK;
}

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemIntPropertyChanged(nsIMsgFolder *item, nsIAtom *property, PRInt32 oldValue, PRInt32 newValue)
{
    return NS_OK;
}

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemBoolPropertyChanged(nsIMsgFolder *item, nsIAtom *property, bool oldValue, bool newValue)
{
    return NS_OK;
}

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemUnicharPropertyChanged(nsIMsgFolder *item, nsIAtom *property, const PRUnichar *oldValue, const PRUnichar *newValue)
{
    return NS_OK;
}

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, PRUint32 oldFlag, PRUint32 newFlag)
{
    return NS_OK;
}

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemEvent(nsIMsgFolder *aItem, nsIAtom *aEvent)
{
  if (mTxn && mFolder && aItem == mFolder &&
      aEvent->EqualsUTF8(NS_LITERAL_CSTRING("FolderLoaded")))
    return mTxn->UndoTransactionInternal();

  return NS_ERROR_FAILURE;
}
