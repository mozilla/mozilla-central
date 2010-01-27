/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
#include "nsMsgImapCID.h"
#include "nsImapMoveCoalescer.h"
#include "nsIImapService.h"
#include "nsIMsgCopyService.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgFolder.h" // TO include biffState enum. Change to bool later...
#include "nsMsgFolderFlags.h"
#include "nsIMsgHdr.h"
#include "nsIMsgImapMailFolder.h"
#include "nsThreadUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"

NS_IMPL_ISUPPORTS1(nsImapMoveCoalescer, nsIUrlListener)

nsImapMoveCoalescer::nsImapMoveCoalescer(nsIMsgFolder *sourceFolder, nsIMsgWindow *msgWindow)
{
  m_sourceFolder = sourceFolder; 
  m_msgWindow = msgWindow;
  m_hasPendingMoves = PR_FALSE;
}

nsImapMoveCoalescer::~nsImapMoveCoalescer()
{
}

nsresult nsImapMoveCoalescer::AddMove(nsIMsgFolder *folder, nsMsgKey key)
{
  m_hasPendingMoves = PR_TRUE;
  PRInt32 folderIndex = m_destFolders.IndexOf(folder);
  nsTArray<nsMsgKey> *keysToAdd = nsnull;

  if (folderIndex >= 0)
    keysToAdd = &(m_sourceKeyArrays[folderIndex]);
  else
  {
    m_destFolders.AppendObject(folder);
    keysToAdd = m_sourceKeyArrays.AppendElement();
    if (!keysToAdd)
      return NS_ERROR_OUT_OF_MEMORY;
  }

  if (keysToAdd->IndexOf(key) == -1)
    keysToAdd->AppendElement(key);

  return NS_OK;
}

nsresult nsImapMoveCoalescer::PlaybackMoves(PRBool doNewMailNotification /* = PR_FALSE */)
{
  PRInt32 numFolders = m_destFolders.Count();
  // Nothing to do, so don't change the member variables.
  if (numFolders == 0)
    return NS_OK;

  nsresult rv = NS_OK;
  m_hasPendingMoves = PR_FALSE;
  m_doNewMailNotification = doNewMailNotification;
  m_outstandingMoves = 0;

  for (PRInt32 i = 0; i < numFolders; ++i)
  {
    // XXX TODO
    // JUNK MAIL RELATED
    // is this the right place to make sure dest folder exists
    // (and has proper flags?), before we start copying?
    nsCOMPtr <nsIMsgFolder> destFolder(m_destFolders[i]);
    nsTArray<nsMsgKey>& keysToAdd = m_sourceKeyArrays[i];
    PRInt32 numNewMessages = 0;
    PRInt32 numKeysToAdd = keysToAdd.Length();
    if (numKeysToAdd == 0)
      continue;

    nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID));
    for (PRUint32 keyIndex = 0; keyIndex < keysToAdd.Length(); keyIndex++)
    {
      nsCOMPtr<nsIMsgDBHdr> mailHdr = nsnull;
      rv = m_sourceFolder->GetMessageHeader(keysToAdd.ElementAt(keyIndex), getter_AddRefs(mailHdr));
      if (NS_SUCCEEDED(rv) && mailHdr)
      {
        messages->AppendElement(mailHdr, PR_FALSE);
        PRBool isRead = PR_FALSE;
        mailHdr->GetIsRead(&isRead);
        if (!isRead)
          numNewMessages++;
      }
    }
    PRUint32 destFlags;
    destFolder->GetFlags(&destFlags);
    if (! (destFlags & nsMsgFolderFlags::Junk)) // don't set has new on junk folder
    {
      destFolder->SetNumNewMessages(numNewMessages);
      if (numNewMessages > 0)
        destFolder->SetHasNewMessages(PR_TRUE);
    }
    // adjust the new message count on the source folder
    PRInt32 oldNewMessageCount = 0;
    m_sourceFolder->GetNumNewMessages(PR_FALSE, &oldNewMessageCount);
    if (oldNewMessageCount >= numKeysToAdd)
      oldNewMessageCount -= numKeysToAdd;
    else
      oldNewMessageCount = 0;

    m_sourceFolder->SetNumNewMessages(oldNewMessageCount);

    nsCOMPtr <nsISupports> sourceSupports = do_QueryInterface(m_sourceFolder, &rv);
    nsCOMPtr <nsIUrlListener> urlListener(do_QueryInterface(sourceSupports));

    keysToAdd.Clear();
    nsCOMPtr<nsIMsgCopyService> copySvc = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID);
    if (copySvc)
    {
      nsCOMPtr <nsIMsgCopyServiceListener> listener;
      if (m_doNewMailNotification)
      {
        nsMoveCoalescerCopyListener *copyListener = new nsMoveCoalescerCopyListener(this, destFolder);
        if (copyListener)
          listener = do_QueryInterface(copyListener);
      }
      rv = copySvc->CopyMessages(m_sourceFolder, messages, destFolder, PR_TRUE,
                                 listener, m_msgWindow, PR_FALSE /*allowUndo*/);
      if (NS_SUCCEEDED(rv))
        m_outstandingMoves++;
    }
  }
  return rv;
}

NS_IMETHODIMP
nsImapMoveCoalescer::OnStartRunningUrl(nsIURI *aUrl)
{
  NS_PRECONDITION(aUrl, "just a sanity check");
  return NS_OK;
}

NS_IMETHODIMP
nsImapMoveCoalescer::OnStopRunningUrl(nsIURI *aUrl, nsresult aExitCode)
{
  m_outstandingMoves--;
  if (m_doNewMailNotification && !m_outstandingMoves)
  {
    nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_sourceFolder);
    if (imapFolder)
      imapFolder->NotifyIfNewMail();
  }
  return NS_OK;
}

nsTArray<nsMsgKey> *nsImapMoveCoalescer::GetKeyBucket(PRUint32 keyArrayIndex)
{
  if (keyArrayIndex >= m_keyBuckets.Length() &&
      !m_keyBuckets.SetLength(keyArrayIndex + 1))
    return nsnull;

  return &(m_keyBuckets[keyArrayIndex]);
}

NS_IMPL_ISUPPORTS1(nsMoveCoalescerCopyListener, nsIMsgCopyServiceListener)

nsMoveCoalescerCopyListener::nsMoveCoalescerCopyListener(nsImapMoveCoalescer * coalescer, 
                                                         nsIMsgFolder *destFolder)
{
  m_destFolder = destFolder;
  m_coalescer = coalescer;
}

nsMoveCoalescerCopyListener::~nsMoveCoalescerCopyListener()
{
}

NS_IMETHODIMP nsMoveCoalescerCopyListener::OnStartCopy()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnProgress (in PRUint32 aProgress, in PRUint32 aProgressMax); */
NS_IMETHODIMP nsMoveCoalescerCopyListener::OnProgress(PRUint32 aProgress, PRUint32 aProgressMax)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void SetMessageKey (in PRUint32 aKey); */
NS_IMETHODIMP nsMoveCoalescerCopyListener::SetMessageKey(PRUint32 aKey)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void GetMessageId (in nsACString aMessageId); */
NS_IMETHODIMP nsMoveCoalescerCopyListener::GetMessageId(nsACString& messageId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnStopCopy (in nsresult aStatus); */
NS_IMETHODIMP nsMoveCoalescerCopyListener::OnStopCopy(nsresult aStatus)
{
  nsresult rv = NS_OK;
  if (NS_SUCCEEDED(aStatus))
  {
    // if the dest folder is imap, update it.
    nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_destFolder);
    if (imapFolder)
    {
      PRUint32 folderFlags;
      m_destFolder->GetFlags(&folderFlags);
      if (!(folderFlags & (nsMsgFolderFlags::Junk | nsMsgFolderFlags::Trash)))
      {
        nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv); 
        NS_ENSURE_SUCCESS(rv, rv);
        nsCOMPtr <nsIURI> url;
        nsCOMPtr <nsIUrlListener> listener = do_QueryInterface(m_coalescer);
        nsCOMPtr <nsIThread> thread;
        NS_GetCurrentThread(getter_AddRefs(thread));
        rv = imapService->SelectFolder(thread, m_destFolder, listener, nsnull, getter_AddRefs(url));
      }
    }
    else // give junk filters a chance to run on new msgs in destination local folder
    {
      PRBool filtersRun;
      m_destFolder->CallFilterPlugins(nsnull, &filtersRun);
    }
  }
  return rv;
}



