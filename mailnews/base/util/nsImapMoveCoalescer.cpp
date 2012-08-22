/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
#include "nsComponentManagerUtils.h"

NS_IMPL_ISUPPORTS1(nsImapMoveCoalescer, nsIUrlListener)

nsImapMoveCoalescer::nsImapMoveCoalescer(nsIMsgFolder *sourceFolder, nsIMsgWindow *msgWindow)
{
  m_sourceFolder = sourceFolder; 
  m_msgWindow = msgWindow;
  m_hasPendingMoves = false;
}

nsImapMoveCoalescer::~nsImapMoveCoalescer()
{
}

nsresult nsImapMoveCoalescer::AddMove(nsIMsgFolder *folder, nsMsgKey key)
{
  m_hasPendingMoves = true;
  int32_t folderIndex = m_destFolders.IndexOf(folder);
  nsTArray<nsMsgKey> *keysToAdd = nullptr;

  if (folderIndex >= 0)
    keysToAdd = &(m_sourceKeyArrays[folderIndex]);
  else
  {
    m_destFolders.AppendObject(folder);
    keysToAdd = m_sourceKeyArrays.AppendElement();
    if (!keysToAdd)
      return NS_ERROR_OUT_OF_MEMORY;
  }

  if (keysToAdd->IndexOf(key) == nsTArray<nsMsgKey>::NoIndex)
    keysToAdd->AppendElement(key);

  return NS_OK;
}

nsresult nsImapMoveCoalescer::PlaybackMoves(bool doNewMailNotification /* = false */)
{
  int32_t numFolders = m_destFolders.Count();
  // Nothing to do, so don't change the member variables.
  if (numFolders == 0)
    return NS_OK;

  nsresult rv = NS_OK;
  m_hasPendingMoves = false;
  m_doNewMailNotification = doNewMailNotification;
  m_outstandingMoves = 0;

  for (int32_t i = 0; i < numFolders; ++i)
  {
    // XXX TODO
    // JUNK MAIL RELATED
    // is this the right place to make sure dest folder exists
    // (and has proper flags?), before we start copying?
    nsCOMPtr <nsIMsgFolder> destFolder(m_destFolders[i]);
    nsTArray<nsMsgKey>& keysToAdd = m_sourceKeyArrays[i];
    int32_t numNewMessages = 0;
    int32_t numKeysToAdd = keysToAdd.Length();
    if (numKeysToAdd == 0)
      continue;

    nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID));
    for (uint32_t keyIndex = 0; keyIndex < keysToAdd.Length(); keyIndex++)
    {
      nsCOMPtr<nsIMsgDBHdr> mailHdr = nullptr;
      rv = m_sourceFolder->GetMessageHeader(keysToAdd.ElementAt(keyIndex), getter_AddRefs(mailHdr));
      if (NS_SUCCEEDED(rv) && mailHdr)
      {
        messages->AppendElement(mailHdr, false);
        bool isRead = false;
        mailHdr->GetIsRead(&isRead);
        if (!isRead)
          numNewMessages++;
      }
    }
    uint32_t destFlags;
    destFolder->GetFlags(&destFlags);
    if (! (destFlags & nsMsgFolderFlags::Junk)) // don't set has new on junk folder
    {
      destFolder->SetNumNewMessages(numNewMessages);
      if (numNewMessages > 0)
        destFolder->SetHasNewMessages(true);
    }
    // adjust the new message count on the source folder
    int32_t oldNewMessageCount = 0;
    m_sourceFolder->GetNumNewMessages(false, &oldNewMessageCount);
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
      rv = copySvc->CopyMessages(m_sourceFolder, messages, destFolder, true,
                                 listener, m_msgWindow, false /*allowUndo*/);
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

nsTArray<nsMsgKey> *nsImapMoveCoalescer::GetKeyBucket(uint32_t keyArrayIndex)
{
  if (keyArrayIndex >= m_keyBuckets.Length() &&
      !m_keyBuckets.SetLength(keyArrayIndex + 1))
    return nullptr;

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

/* void OnProgress (in uint32_t aProgress, in uint32_t aProgressMax); */
NS_IMETHODIMP nsMoveCoalescerCopyListener::OnProgress(uint32_t aProgress, uint32_t aProgressMax)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void SetMessageKey (in uint32_t aKey); */
NS_IMETHODIMP nsMoveCoalescerCopyListener::SetMessageKey(uint32_t aKey)
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
      uint32_t folderFlags;
      m_destFolder->GetFlags(&folderFlags);
      if (!(folderFlags & (nsMsgFolderFlags::Junk | nsMsgFolderFlags::Trash)))
      {
        nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv); 
        NS_ENSURE_SUCCESS(rv, rv);
        nsCOMPtr <nsIURI> url;
        nsCOMPtr <nsIUrlListener> listener = do_QueryInterface(m_coalescer);
        rv = imapService->SelectFolder(m_destFolder, listener, nullptr, getter_AddRefs(url));
      }
    }
    else // give junk filters a chance to run on new msgs in destination local folder
    {
      bool filtersRun;
      m_destFolder->CallFilterPlugins(nullptr, &filtersRun);
    }
  }
  return rv;
}



