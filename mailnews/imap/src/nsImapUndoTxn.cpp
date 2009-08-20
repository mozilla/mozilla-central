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
 *   David Bienvenu <bienvenu@nventure.com>
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

#include "msgCore.h" // for precompiled headers
#include "nsMsgImapCID.h"
#include "nsIMsgHdr.h"
#include "nsImapUndoTxn.h"
#include "nsIIMAPHostSessionList.h"
#include "nsIMsgIncomingServer.h"
#include "nsImapMailFolder.h"
#include "nsIDBFolderInfo.h"
#include "nsIMsgDatabase.h"
#include "nsMsgUtils.h"
#include "nsISupportsArray.h"
#include "nsThreadUtils.h"

nsImapMoveCopyMsgTxn::nsImapMoveCopyMsgTxn() :
    m_idsAreUids(PR_FALSE), m_isMove(PR_FALSE), m_srcIsPop3(PR_FALSE)
{
}

nsresult
nsImapMoveCopyMsgTxn::Init(nsIMsgFolder* srcFolder, nsTArray<nsMsgKey>* srcKeyArray, 
                           const char* srcMsgIdString, nsIMsgFolder* dstFolder,
                           PRBool idsAreUids, PRBool isMove,
                           nsIEventTarget* eventTarget)
{
  nsresult rv;
  m_srcHdrs = do_CreateInstance(NS_SUPPORTSARRAY_CONTRACTID);
  m_srcMsgIdString = srcMsgIdString;
  m_idsAreUids = idsAreUids;
  m_isMove = isMove;
  m_srcFolder = do_GetWeakReference(srcFolder);
  m_dstFolder = do_GetWeakReference(dstFolder);
  m_eventTarget = eventTarget;
  m_srcKeyArray = *srcKeyArray;
  m_dupKeyArray = *srcKeyArray;
  nsCString uri;
  rv = srcFolder->GetURI(uri);
  nsCString protocolType(uri);
  protocolType.SetLength(protocolType.FindChar(':'));
  nsCOMPtr<nsIMsgDatabase> srcDB;
  rv = srcFolder->GetMsgDatabase(getter_AddRefs(srcDB));
  NS_ENSURE_SUCCESS(rv, rv);
  PRUint32 i, count = m_srcKeyArray.Length();
  nsCOMPtr<nsIMsgDBHdr> srcHdr;
  nsCOMPtr<nsIMsgDBHdr> copySrcHdr;
  nsCString messageId;

  for (i = 0; i < count; i++)
  {
    nsMsgKey pseudoKey;
    rv = srcDB->GetMsgHdrForKey(m_srcKeyArray[i],
      getter_AddRefs(srcHdr));
    if (NS_SUCCEEDED(rv))
    {
      // ** jt -- only do this for mailbox protocol
      if (protocolType.LowerCaseEqualsLiteral("mailbox"))
      {
        m_srcIsPop3 = PR_TRUE;
        PRUint32 msgSize;
        rv = srcHdr->GetMessageSize(&msgSize);
        if (NS_SUCCEEDED(rv))
          m_srcSizeArray.AppendElement(msgSize);
        if (isMove)
        {
          srcDB->GetNextPseudoMsgKey(&pseudoKey);
          pseudoKey--;
          m_dupKeyArray[i] = pseudoKey;
          rv = srcDB->CopyHdrFromExistingHdr(pseudoKey, srcHdr, PR_FALSE,
                                             getter_AddRefs(copySrcHdr));
          if (NS_SUCCEEDED(rv)) 
          {
            nsCOMPtr<nsISupports> supports = do_QueryInterface(copySrcHdr);
            m_srcHdrs->AppendElement(supports);
          }
        }
      }
      srcHdr->GetMessageId(getter_Copies(messageId));
      m_srcMessageIds.AppendElement(messageId);
    }
  }
  return nsMsgTxn::Init();
}

nsImapMoveCopyMsgTxn::~nsImapMoveCopyMsgTxn()
{
}

NS_IMPL_ISUPPORTS_INHERITED1(nsImapMoveCopyMsgTxn, nsMsgTxn, nsIUrlListener)

NS_IMETHODIMP
nsImapMoveCopyMsgTxn::UndoTransaction(void)
{
  nsresult rv;
  nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool finishInOnStopRunningUrl = PR_FALSE;

  if (m_isMove || !m_dstFolder)
  {
    if (m_srcIsPop3)
    {
      rv = UndoMailboxDelete();
      NS_ENSURE_SUCCESS(rv, rv);
    }
    else
    {
      nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
      if (NS_FAILED(rv) || !srcFolder) 
        return rv;
      nsCOMPtr<nsIUrlListener> srcListener = do_QueryInterface(srcFolder, &rv);
      if (NS_FAILED(rv)) 
        return rv;
      m_onStopListener =   do_GetWeakReference(srcListener);

      // ** make sure we are in the selected state; use lite select
      // folder so we won't hit performance hard
      rv = imapService->LiteSelectFolder(m_eventTarget, srcFolder,
        srcListener, nsnull, nsnull);
      if (NS_FAILED(rv)) 
        return rv;
      PRBool deletedMsgs = PR_TRUE; //default is true unless imapDelete model
      nsMsgImapDeleteModel deleteModel;
      rv = GetImapDeleteModel(srcFolder, &deleteModel);

      // protect against a bogus undo txn without any source keys
      // see bug #179856 for details
      NS_ASSERTION(!m_srcKeyArray.IsEmpty(), "no source keys");
      if (m_srcKeyArray.IsEmpty())
        return NS_ERROR_UNEXPECTED;

      if (!m_srcMsgIdString.IsEmpty())
      {
        if (NS_SUCCEEDED(rv) && deleteModel == nsMsgImapDeleteModels::IMAPDelete)
          CheckForToggleDelete(srcFolder, m_srcKeyArray[0], &deletedMsgs);

        if (deletedMsgs)
          rv = imapService->SubtractMessageFlags(m_eventTarget, srcFolder, 
                                                 this, nsnull,
                                                 m_srcMsgIdString, 
                                                 kImapMsgDeletedFlag,
                                                 m_idsAreUids);
        else
        {
          rv = imapService->AddMessageFlags(m_eventTarget, srcFolder,
                                            srcListener, nsnull,
                                            m_srcMsgIdString,
                                            kImapMsgDeletedFlag,
                                            m_idsAreUids);
          finishInOnStopRunningUrl = PR_TRUE;
        }
        if (NS_FAILED(rv)) 
          return rv;

        if (deleteModel != nsMsgImapDeleteModels::IMAPDelete)
          rv = imapService->GetHeaders(m_eventTarget, srcFolder,
                                srcListener, nsnull, m_srcMsgIdString, PR_TRUE);
      }
    }
  }
  if (!finishInOnStopRunningUrl && !m_dstMsgIdString.IsEmpty())
  {
    nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
    if (NS_FAILED(rv) || !dstFolder)
      return rv;

    nsCOMPtr<nsIUrlListener> dstListener;

    dstListener = do_QueryInterface(dstFolder, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    // ** make sure we are in the selected state; use lite select folder
    // so we won't potentially download a bunch of headers.
    rv = imapService->LiteSelectFolder(m_eventTarget, dstFolder,
      dstListener, nsnull, nsnull);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = imapService->AddMessageFlags(m_eventTarget, dstFolder, dstListener,
                                      nsnull, m_dstMsgIdString, 
                                      kImapMsgDeletedFlag, m_idsAreUids);
  }
  return rv;
}

NS_IMETHODIMP
nsImapMoveCopyMsgTxn::RedoTransaction(void)
{
  nsresult rv;
  nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  if (m_isMove || !m_dstFolder)
  {
    if (m_srcIsPop3)
    {
      rv = RedoMailboxDelete();
      if (NS_FAILED(rv)) return rv;
    }
    else if (!m_srcMsgIdString.IsEmpty())
    {
      nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
      if (NS_FAILED(rv) || !srcFolder) 
        return rv;
      nsCOMPtr<nsIUrlListener> srcListener = do_QueryInterface(srcFolder, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      PRBool deletedMsgs = PR_FALSE;  //default will be false unless imapDeleteModel;
      nsMsgImapDeleteModel deleteModel;
      rv = GetImapDeleteModel(srcFolder, &deleteModel);
      
      // protect against a bogus undo txn without any source keys
      // see bug #179856 for details
      NS_ASSERTION(!m_srcKeyArray.IsEmpty(), "no source keys");
      if (m_srcKeyArray.IsEmpty())
        return NS_ERROR_UNEXPECTED;
      
      if (NS_SUCCEEDED(rv) && deleteModel == nsMsgImapDeleteModels::IMAPDelete)
        rv = CheckForToggleDelete(srcFolder, m_srcKeyArray[0], &deletedMsgs);
      
      // Make sure we are in the selected state; use lite select
      // folder so performance won't suffer.
      rv = imapService->LiteSelectFolder(m_eventTarget, srcFolder,
        srcListener, nsnull, nsnull);
      NS_ENSURE_SUCCESS(rv, rv);
      if (deletedMsgs)
      {
        rv = imapService->SubtractMessageFlags(m_eventTarget, srcFolder,
                                                srcListener, nsnull,
                                                m_srcMsgIdString,
                                                kImapMsgDeletedFlag,
                                                m_idsAreUids);
      }
      else
      {
        rv = imapService->AddMessageFlags(m_eventTarget, srcFolder,
                                          srcListener, nsnull, m_srcMsgIdString,
                                          kImapMsgDeletedFlag, m_idsAreUids);
      }
    }
  }
  if (!m_dstMsgIdString.IsEmpty())
  {
    nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
    if (NS_FAILED(rv) || !dstFolder) return rv;

    nsCOMPtr<nsIUrlListener> dstListener;

    dstListener = do_QueryInterface(dstFolder, &rv); 
    NS_ENSURE_SUCCESS(rv, rv);
    // ** make sure we are in the selected state; use lite select
    // folder so we won't hit performance hard
    rv = imapService->LiteSelectFolder(m_eventTarget, dstFolder,
      dstListener, nsnull, nsnull);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = imapService->SubtractMessageFlags(m_eventTarget, dstFolder,
                                           dstListener, nsnull, 
                                           m_dstMsgIdString,
                                           kImapMsgDeletedFlag,
                                           m_idsAreUids);
    NS_ENSURE_SUCCESS(rv, rv);
    nsMsgImapDeleteModel deleteModel;
    rv = GetImapDeleteModel(dstFolder, &deleteModel);
    if (NS_FAILED(rv) || deleteModel == nsMsgImapDeleteModels::MoveToTrash)
    {
      rv = imapService->GetHeaders(m_eventTarget, dstFolder, dstListener, 
                                   nsnull, m_dstMsgIdString, PR_TRUE);
    }
  }
  return rv;
}

nsresult
nsImapMoveCopyMsgTxn::SetCopyResponseUid(const char* aMsgIdString)
{
  if (!aMsgIdString) return NS_ERROR_NULL_POINTER;
  m_dstMsgIdString = aMsgIdString;
  if (m_dstMsgIdString.Last() == ']')
  {
    PRInt32 len = m_dstMsgIdString.Length();
    m_dstMsgIdString.SetLength(len - 1);
  }
  return NS_OK;
}

nsresult
nsImapMoveCopyMsgTxn::GetSrcKeyArray(nsTArray<nsMsgKey>& srcKeyArray)
{
    srcKeyArray = m_srcKeyArray;
    return NS_OK;
}

nsresult
nsImapMoveCopyMsgTxn::AddDstKey(nsMsgKey aKey)
{
    if (!m_dstMsgIdString.IsEmpty())
        m_dstMsgIdString.Append(",");
    m_dstMsgIdString.AppendInt((PRInt32) aKey);
    return NS_OK;
}

nsresult
nsImapMoveCopyMsgTxn::UndoMailboxDelete()
{
    nsresult rv = NS_ERROR_FAILURE;
    // ** jt -- only do this for mailbox protocol
    if (m_srcIsPop3)
    {
        nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
        if (NS_FAILED(rv) || !srcFolder) return rv;

        nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
        if (NS_FAILED(rv) || !dstFolder) return rv;

        nsCOMPtr<nsIMsgDatabase> srcDB;
        nsCOMPtr<nsIMsgDatabase> dstDB;
        rv = srcFolder->GetMsgDatabase(getter_AddRefs(srcDB));
        if (NS_FAILED(rv)) return rv;
        rv = dstFolder->GetMsgDatabase(getter_AddRefs(dstDB));
        if (NS_FAILED(rv)) return rv;
        
        PRUint32 count = m_srcKeyArray.Length();
        PRUint32 i;
        nsCOMPtr<nsIMsgDBHdr> oldHdr;
        nsCOMPtr<nsIMsgDBHdr> newHdr;
        for (i=0; i<count; i++)
        {
            oldHdr = do_QueryElementAt(m_srcHdrs, i);
            NS_ASSERTION(oldHdr, "fatal ... cannot get old msg header\n");
            rv = srcDB->CopyHdrFromExistingHdr(m_srcKeyArray[i],
                                               oldHdr,PR_TRUE,
                                               getter_AddRefs(newHdr));
            NS_ASSERTION(newHdr, "fatal ... cannot create new header\n");

            if (NS_SUCCEEDED(rv) && newHdr)
            {
                if (i < m_srcSizeArray.Length())
                    newHdr->SetMessageSize(m_srcSizeArray[i]);
                srcDB->UndoDelete(newHdr);
            }
        }
        srcDB->SetSummaryValid(PR_TRUE);
        return NS_OK; // always return NS_OK
    }
    else
    {
        rv = NS_ERROR_FAILURE;
    }
    return rv;
}


nsresult
nsImapMoveCopyMsgTxn::RedoMailboxDelete()
{
    nsresult rv = NS_ERROR_FAILURE;
    if (m_srcIsPop3)
    {
        nsCOMPtr<nsIMsgDatabase> srcDB;
        nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
        if (NS_FAILED(rv) || !srcFolder) return rv;
        rv = srcFolder->GetMsgDatabase(getter_AddRefs(srcDB));
        if (NS_SUCCEEDED(rv))
        {
            srcDB->DeleteMessages(&m_srcKeyArray, nsnull);
            srcDB->SetSummaryValid(PR_TRUE);
        }
        return NS_OK; // always return NS_OK
    }
    else
    {
        rv = NS_ERROR_FAILURE;
    }
    return rv;
}

nsresult nsImapMoveCopyMsgTxn::GetImapDeleteModel(nsIMsgFolder *aFolder, nsMsgImapDeleteModel *aDeleteModel)
{
  nsresult rv;
  nsCOMPtr<nsIMsgIncomingServer> server;
  if (!aFolder)
    return NS_ERROR_NULL_POINTER;
  rv = aFolder->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryInterface(server, &rv);
  if (NS_SUCCEEDED(rv) && imapServer)
   rv = imapServer->GetDeleteModel(aDeleteModel);
  return rv;
}

NS_IMETHODIMP nsImapMoveCopyMsgTxn::OnStartRunningUrl(nsIURI *aUrl)
{
  return NS_OK;
}

NS_IMETHODIMP nsImapMoveCopyMsgTxn::OnStopRunningUrl(nsIURI *aUrl, nsresult aExitCode)
{
  nsCOMPtr<nsIUrlListener> urlListener = do_QueryReferent(m_onStopListener);
  if (urlListener)
    urlListener->OnStopRunningUrl(aUrl, aExitCode);

  nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(aUrl);
  if (imapUrl)
  {
    nsresult rv;
    nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsImapAction imapAction;
    imapUrl->GetImapAction(&imapAction);
    nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    if (imapAction == nsIImapUrl::nsImapSubtractMsgFlags)
    {
      PRInt32 extraStatus;
      imapUrl->GetExtraStatus(&extraStatus);
      if (extraStatus != nsIImapUrl::ImapStatusNone)
      {
        // If subtracting the deleted flag didn't work, try
        // moving the message back from the target folder to the src folder
        if (!m_dstMsgIdString.IsEmpty())
          imapService->OnlineMessageCopy(m_eventTarget,
                                       dstFolder,
                                       m_dstMsgIdString,
                                       srcFolder,
                                       PR_TRUE,
                                       PR_TRUE,
                                       nsnull, /* listener */
                                       nsnull,
                                       nsnull,
                                       nsnull);
        else
        {
          // server doesn't support COPYUID, so we're going to update the dest
          // folder, and when that's done, use the db to find the messages
          // to move back, looking them up by message-id.
          nsCOMPtr<nsIMsgImapMailFolder> imapDest = do_QueryInterface(dstFolder);
          if (imapDest)
            imapDest->UpdateFolderWithListener(nsnull, this);
        }
      }
      else if (!m_dstMsgIdString.IsEmpty())
      {
        nsCOMPtr<nsIUrlListener> dstListener;

        dstListener = do_QueryInterface(dstFolder, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        // ** make sure we are in the selected state; use lite select folder
        // so we won't potentially download a bunch of headers.
        rv = imapService->LiteSelectFolder(m_eventTarget, dstFolder,
          dstListener, nsnull, nsnull);
        NS_ENSURE_SUCCESS(rv, rv);
        rv = imapService->AddMessageFlags(m_eventTarget, dstFolder, dstListener,
                                          nsnull, m_dstMsgIdString, 
                                          kImapMsgDeletedFlag, m_idsAreUids);
      }
    }
    else if (imapAction == nsIImapUrl::nsImapSelectFolder)
    {
      // Now we should have the headers from the dest folder.
      // Look them up and move them back to the source folder.
      PRUint32 count = m_srcMessageIds.Length();
      PRUint32 i;
      nsCString messageId;
      nsTArray<nsMsgKey> dstKeys;
      nsCOMPtr<nsIMsgDatabase> destDB;
      nsCOMPtr<nsIMsgDBHdr> dstHdr;

      rv = dstFolder->GetMsgDatabase(getter_AddRefs(destDB));
      NS_ENSURE_SUCCESS(rv, rv);
      for (i = 0; i < count; i++)
      {
        rv = destDB->GetMsgHdrForMessageID(m_srcMessageIds[i].get(), getter_AddRefs(dstHdr));
        if (NS_SUCCEEDED(rv) && dstHdr)
        {
          nsMsgKey dstKey;
          dstHdr->GetMessageKey(&dstKey);
          dstKeys.AppendElement(dstKey);
        }
      }
      if (dstKeys.Length())
      {
        nsCAutoString uids;
        nsImapMailFolder::AllocateUidStringFromKeys(dstKeys.Elements(), dstKeys.Length(), uids);
        rv = imapService->OnlineMessageCopy(m_eventTarget, dstFolder, uids, srcFolder,
                                            PR_TRUE, PR_TRUE, nsnull,
                                            nsnull, nsnull, nsnull);
      }
    }
  }
  return NS_OK;
}

nsImapOfflineTxn::nsImapOfflineTxn(nsIMsgFolder* srcFolder, nsTArray<nsMsgKey>* srcKeyArray,
                                   const char *srcMsgIdString, nsIMsgFolder* dstFolder,
                                   PRBool isMove, nsOfflineImapOperationType opType,
                                   nsIMsgDBHdr *srcHdr,
                                   nsIEventTarget* eventTarget)
{
  Init(srcFolder, srcKeyArray, srcMsgIdString, dstFolder, PR_TRUE,
       isMove, eventTarget);

  m_opType = opType; 
  m_flags = 0;
  m_addFlags = PR_FALSE;
  m_header = srcHdr;
  if (opType == nsIMsgOfflineImapOperation::kDeletedMsg)
  {
    nsCOMPtr <nsIMsgDatabase> srcDB;
    nsCOMPtr <nsIDBFolderInfo> folderInfo;

    nsresult rv = srcFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(srcDB));
    if (NS_SUCCEEDED(rv) && srcDB)
    {
      nsMsgKey pseudoKey;
      nsCOMPtr <nsIMsgDBHdr> copySrcHdr;

      srcDB->GetNextPseudoMsgKey(&pseudoKey);
      pseudoKey--;
      m_dupKeyArray[0] = pseudoKey;
      rv = srcDB->CopyHdrFromExistingHdr(pseudoKey, srcHdr, PR_FALSE, getter_AddRefs(copySrcHdr));
      if (NS_SUCCEEDED(rv)) 
      {
        nsCOMPtr<nsISupports> supports = do_QueryInterface(copySrcHdr);
        m_srcHdrs->AppendElement(supports);
      }
    }
  }
}

nsImapOfflineTxn::~nsImapOfflineTxn()
{
}

// Open the database and find the key for the offline operation that we want to
// undo, then remove it from the database, we also hold on to this
// data for a redo operation.
NS_IMETHODIMP nsImapOfflineTxn::UndoTransaction(void)
{
  nsresult rv;
  
  nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
  if (NS_FAILED(rv) || !srcFolder) 
    return rv;
  nsCOMPtr <nsIMsgOfflineImapOperation> op;
  nsCOMPtr <nsIDBFolderInfo> folderInfo;
  nsCOMPtr <nsIMsgDatabase> srcDB;
  nsCOMPtr <nsIMsgDatabase> destDB;

  nsMsgKey hdrKey = nsMsgKey_None;

  if (m_header)
    m_header->GetMessageKey(&hdrKey);

  rv = srcFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(srcDB));
  NS_ENSURE_SUCCESS(rv, rv);

  switch (m_opType)
  {
    case nsIMsgOfflineImapOperation::kMsgMoved:
    case nsIMsgOfflineImapOperation::kMsgCopy:
    case nsIMsgOfflineImapOperation::kAddedHeader:
    case nsIMsgOfflineImapOperation::kFlagsChanged:
    {
      rv = srcDB->GetOfflineOpForKey(hdrKey, PR_FALSE, getter_AddRefs(op));
      PRBool offlineOpPlayedBack = PR_TRUE;
      if (NS_SUCCEEDED(rv) && op)
      {
        op->GetPlayingBack(&offlineOpPlayedBack);
        srcDB->RemoveOfflineOp(op);
        op = nsnull;
      }
      if (!WeAreOffline() && offlineOpPlayedBack)
      {
        // couldn't find offline op - it must have been played back already
        // so we should undo the transaction online.
        return nsImapMoveCopyMsgTxn::UndoTransaction();
      }

      if (m_header && (m_opType == nsIMsgOfflineImapOperation::kAddedHeader))
      {
        nsCOMPtr <nsIMsgDBHdr> mailHdr;
        nsMsgKey msgKey;
        m_header->GetMessageKey(&msgKey);
        rv = srcDB->GetMsgHdrForKey(msgKey, getter_AddRefs(mailHdr));
        if (mailHdr)
          srcDB->DeleteHeader(mailHdr, nsnull, PR_TRUE, PR_FALSE);
      }
      break;
    }
    case nsIMsgOfflineImapOperation::kDeletedMsg:
      {
        nsMsgKey msgKey;
        m_header->GetMessageKey(&msgKey);
        nsCOMPtr<nsIMsgDBHdr> undeletedHdr;
        m_srcHdrs->QueryElementAt(0, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(undeletedHdr));
        if (undeletedHdr)
        {
          nsCOMPtr<nsIMsgDBHdr> newHdr;

          srcDB->CopyHdrFromExistingHdr (msgKey, undeletedHdr, PR_TRUE, getter_AddRefs(newHdr));
        }
        srcDB->Close(PR_TRUE);
        srcFolder->SummaryChanged();
      }
      break;
    case nsIMsgOfflineImapOperation::kMsgMarkedDeleted:
      srcDB->MarkImapDeleted(hdrKey, PR_FALSE, nsnull);
      break;
    default:
      break;
  }
  srcDB->Close(PR_TRUE);
  srcFolder->SummaryChanged();
  return NS_OK;
}

NS_IMETHODIMP nsImapOfflineTxn::RedoTransaction(void)
{
  nsresult rv;
  
  nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryReferent(m_srcFolder, &rv);
  if (NS_FAILED(rv) || !srcFolder) 
    return rv;
  nsCOMPtr <nsIMsgOfflineImapOperation> op;
  nsCOMPtr <nsIDBFolderInfo> folderInfo;
  nsCOMPtr <nsIMsgDatabase> srcDB;
  nsCOMPtr <nsIMsgDatabase> destDB;
  rv = srcFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(srcDB));
  NS_ENSURE_SUCCESS(rv, rv);
  nsMsgKey hdrKey = nsMsgKey_None;

  if (m_header)
    m_header->GetMessageKey(&hdrKey);

  switch (m_opType)
  {
  case nsIMsgOfflineImapOperation::kMsgMoved:
  case nsIMsgOfflineImapOperation::kMsgCopy:
    rv = srcDB->GetOfflineOpForKey(hdrKey, PR_FALSE, getter_AddRefs(op));
    if (NS_SUCCEEDED(rv) && op)
    {
      nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
      if (dstFolder)
      {
        nsCString folderURI;
        dstFolder->GetURI(folderURI);

        if (m_opType == nsIMsgOfflineImapOperation::kMsgMoved)
        {
          op->SetDestinationFolderURI(folderURI.get()); // offline move
        }
        if (m_opType == nsIMsgOfflineImapOperation::kMsgCopy)
        {
          op->SetOperation(nsIMsgOfflineImapOperation::kMsgMoved);
          op->AddMessageCopyOperation(folderURI.get()); // offline copy
        }
        dstFolder->SummaryChanged();
      }
    }
    else if (!WeAreOffline())
    {
      // couldn't find offline op - it must have been played back already
      // so we should redo the transaction online.
      return nsImapMoveCopyMsgTxn::RedoTransaction();
    }

    break;
  case nsIMsgOfflineImapOperation::kAddedHeader:
    {
      nsCOMPtr <nsIMsgDBHdr> restoreHdr;
      nsMsgKey msgKey;
      m_header->GetMessageKey(&msgKey);
      nsCOMPtr<nsIMsgFolder> dstFolder = do_QueryReferent(m_dstFolder, &rv);
      rv = srcFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(destDB));
      NS_ENSURE_SUCCESS(rv, rv);
      if (m_header)
        destDB->CopyHdrFromExistingHdr (msgKey, m_header, PR_TRUE, getter_AddRefs(restoreHdr));
      destDB->Close(PR_TRUE);
      dstFolder->SummaryChanged();
      rv = destDB->GetOfflineOpForKey(hdrKey, PR_TRUE, getter_AddRefs(op));
      if (NS_SUCCEEDED(rv) && op)
      {
        nsCString folderURI;
        srcFolder->GetURI(folderURI);
        op->SetSourceFolderURI(folderURI.get());
      }
      dstFolder->SummaryChanged();
      destDB->Close(PR_TRUE);
    }
    break;
  case nsIMsgOfflineImapOperation::kDeletedMsg:
    srcDB->DeleteMessage(hdrKey, nsnull, PR_TRUE);
    break;
  case nsIMsgOfflineImapOperation::kMsgMarkedDeleted:
    srcDB->MarkImapDeleted(hdrKey, PR_TRUE, nsnull);
    break;
  case nsIMsgOfflineImapOperation::kFlagsChanged:
    rv = srcDB->GetOfflineOpForKey(hdrKey, PR_TRUE, getter_AddRefs(op));
    if (NS_SUCCEEDED(rv) && op)
    {
      imapMessageFlagsType newMsgFlags;
      op->GetNewFlags(&newMsgFlags);
      if (m_addFlags)
        op->SetFlagOperation(newMsgFlags | m_flags);
      else
        op->SetFlagOperation(newMsgFlags & ~m_flags);
    }
    break;
  default:
    break;
  }
  srcDB->Close(PR_TRUE);
  srcDB = nsnull;
  srcFolder->SummaryChanged();
  return NS_OK;
}


