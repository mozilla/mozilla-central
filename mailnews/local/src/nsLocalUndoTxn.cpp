/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

nsLocalMoveCopyMsgTxn::nsLocalMoveCopyMsgTxn()  : m_srcIsImap4(PR_FALSE)
{
}

nsLocalMoveCopyMsgTxn::~nsLocalMoveCopyMsgTxn()
{
}

nsresult
nsLocalMoveCopyMsgTxn::Init(nsIMsgFolder* srcFolder, nsIMsgFolder* dstFolder,
                            PRBool isMove)
{
    nsresult rv;
    rv = SetSrcFolder(srcFolder);
    rv = SetDstFolder(dstFolder);
    m_isMove = isMove;

    mUndoFolderListener = nsnull;

    nsCString protocolType;
    rv = srcFolder->GetURI(protocolType);
    protocolType.SetLength(protocolType.FindChar(':'));
#ifdef MOZILLA_INTERNAL_API
    if (protocolType.LowerCaseEqualsLiteral("imap"))
#else
    if (protocolType.Equals("imap", CaseInsensitiveCompare))
#endif
      m_srcIsImap4 = PR_TRUE;
    return nsMsgTxn::Init();
}
nsresult 
nsLocalMoveCopyMsgTxn::GetSrcIsImap(PRBool *isImap)
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
                                          PRBool deleteFlag)
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
    nsIThread *thread;
#ifdef MOZILLA_INTERNAL_API    
    thread = NS_GetCurrentThread();
#else
    NS_GetCurrentThread(&thread);
#endif
    if (thread)
    {
      // This is to make sure that we are in the selected state
      // when executing the imap url; we don't want to load the
      // folder so use lite select to do the trick
      rv = imapService->LiteSelectFolder(thread, folder,
                                         urlListener, nsnull, nsnull);
      if (!deleteFlag)
          rv =imapService->AddMessageFlags(thread, folder,
                                          urlListener, nsnull,
                                          msgIds,
                                          kImapMsgDeletedFlag,
                                          PR_TRUE);
      else
          rv = imapService->SubtractMessageFlags(thread,
                                                folder,
                                           urlListener, nsnull,
                                           msgIds,
                                           kImapMsgDeletedFlag,
                                           PR_TRUE);
      if (NS_SUCCEEDED(rv) && m_msgWindow)
          folder->UpdateFolder(m_msgWindow);
    }
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
    mUndoFolderListener = nsnull;
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
      PRBool deleteFlag = PR_TRUE;  //message has been deleted -we are trying to undo it
      CheckForToggleDelete(srcFolder, m_srcKeyArray[0], &deleteFlag); //there could have been a toggle.
      rv = UndoImapDeleteFlag(srcFolder, m_srcKeyArray, deleteFlag);
    }
    else
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
                                             oldHdr, PR_TRUE,
                                             getter_AddRefs(newHdr));
          NS_ASSERTION(newHdr, 
                       "fatal ... cannot create new msg header\n");
          if (NS_SUCCEEDED(rv) && newHdr)
          {
            newHdr->SetStatusOffset(m_srcStatusOffsetArray[i]);
            srcDB->UndoDelete(newHdr);
            srcMessages->AppendElement(newHdr, PR_FALSE);
            // (we want to keep these two lists in sync)
            dstMessages->AppendElement(oldHdr, PR_FALSE);
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
        notifier->NotifyMsgsMoveCopyCompleted(PR_TRUE, dstMessages,
                                              srcFolder, srcMessages);
      }

      nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(srcFolder);
      if (localFolder)
        localFolder->MarkMsgsOnPop3Server(srcMessages, POP3_NONE /*deleteMsgs*/);
    }
    srcDB->SetSummaryValid(PR_TRUE);
  }

  dstDB->DeleteMessages(&m_dstKeyArray, nsnull);
  dstDB->SetSummaryValid(PR_TRUE);

  return rv;
}

NS_IMETHODIMP
nsLocalMoveCopyMsgTxn::RedoTransaction()
{
  nsresult rv = NS_ERROR_FAILURE;
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
      srcMessages->AppendElement(msgSupports, PR_FALSE);
      
      rv = dstDB->CopyHdrFromExistingHdr(m_dstKeyArray[i],
                                         oldHdr, PR_TRUE,
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
  dstDB->SetSummaryValid(PR_TRUE);

  if (m_isMove)
  {
    if (m_srcIsImap4)
    {
      // protect against a bogus undo txn without any source keys
      // see bug #179856 for details
      NS_ASSERTION(!m_srcKeyArray.IsEmpty(), "no source keys");
      if (m_srcKeyArray.IsEmpty())
        return NS_ERROR_UNEXPECTED;
    
      PRBool deleteFlag = PR_FALSE; //message is un-deleted- we are trying to redo
      CheckForToggleDelete(srcFolder, m_srcKeyArray[0], &deleteFlag); // there could have been a toggle
      rv = UndoImapDeleteFlag(srcFolder, m_srcKeyArray, deleteFlag);
    }
    else
    {
      nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(srcFolder);
      if (localFolder)
        localFolder->MarkMsgsOnPop3Server(srcMessages, POP3_DELETE /*deleteMsgs*/);

      rv = srcDB->DeleteMessages(&m_srcKeyArray, nsnull);
      srcDB->SetSummaryValid(PR_TRUE);
    }
  }

  return rv;
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

NS_IMETHODIMP nsLocalUndoFolderListener::OnItemBoolPropertyChanged(nsIMsgFolder *item, nsIAtom *property, PRBool oldValue, PRBool newValue)
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
