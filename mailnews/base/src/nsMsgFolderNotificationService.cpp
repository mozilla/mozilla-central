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
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@mozilla.org>
 *   Siddharth Agarwal <sid1337@gmail.com>
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
#include "nsMsgFolderNotificationService.h"
#include "nsIArray.h"
#include "nsArrayUtils.h"
#include "nsIMsgHdr.h"
#include "nsIMsgImapMailFolder.h"
#include "nsIImapIncomingServer.h"

//
//  nsMsgFolderNotificationService
//
NS_IMPL_ISUPPORTS1(nsMsgFolderNotificationService, nsIMsgFolderNotificationService)

nsMsgFolderNotificationService::nsMsgFolderNotificationService()
{
}

nsMsgFolderNotificationService::~nsMsgFolderNotificationService()
{
  /* destructor code */
}

NS_IMETHODIMP nsMsgFolderNotificationService::GetHasListeners(PRBool *aHasListeners)
{
  NS_ENSURE_ARG_POINTER(aHasListeners);
  *aHasListeners = mListeners.Length() > 0;
  return NS_OK;
}


/* void addListener (in nsIMsgFolderListener aListener, in msgFolderListenerFlag flags); */
NS_IMETHODIMP nsMsgFolderNotificationService::AddListener(nsIMsgFolderListener *aListener,
                                                          msgFolderListenerFlag aFlags)
{
  NS_ENSURE_ARG_POINTER(aListener);
  if (!mListeners.Contains(aListener))
  {
    MsgFolderListener listener(aListener, aFlags);
    mListeners.AppendElement(listener);
  }
  return NS_OK;
}

/* void removeListener (in nsIMsgFolderListener aListener); */
NS_IMETHODIMP nsMsgFolderNotificationService::RemoveListener(nsIMsgFolderListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aListener);
  NS_ASSERTION(mListeners.RemoveElement(aListener), "removing non-existent listener");
  return NS_OK;
}

/* void notifyMsgAdded (in nsIMsgDBHdr aMsg); */
NS_IMETHODIMP nsMsgFolderNotificationService::NotifyMsgAdded(nsIMsgDBHdr *aMsg)
{
  PRUint32 count = mListeners.Length();

  for (PRUint32 i = 0; i < count; i++)
  {
    MsgFolderListener listener = mListeners[i];
    NS_ASSERTION(listener.mListener, "listener is null");
    if (!listener.mListener)
      return NS_ERROR_FAILURE;
    if (listener.mFlags & msgAdded)
      listener.mListener->MsgAdded(aMsg);
  }

  return NS_OK;
}

/* void notifyMsgsDeleted (in nsIArray aMsgs); */
NS_IMETHODIMP nsMsgFolderNotificationService::NotifyMsgsDeleted(nsIArray *aMsgs)
{
  PRUint32 count = mListeners.Length();

  for (PRUint32 i = 0; i < count; i++)
  {
    MsgFolderListener listener = mListeners[i];
    NS_ASSERTION(listener.mListener, "listener is null");
    if (!listener.mListener)
      return NS_ERROR_FAILURE;
    if (listener.mFlags & msgsDeleted)
      listener.mListener->MsgsDeleted(aMsgs);
  }

  return NS_OK;
}

/* void notifyMsgsMoveCopyCompleted (in boolean aMove, in nsIArray aSrcMsgs, in nsIMsgFolder aDestFolder); */
NS_IMETHODIMP nsMsgFolderNotificationService::NotifyMsgsMoveCopyCompleted(PRBool aMove, nsIArray *aSrcMsgs, nsIMsgFolder *aDestFolder)
{
  PRUint32 count = mListeners.Length();
  
  // IMAP delete model means that a "move" isn't really a move, it is a copy,
  // followed by storing the IMAP deleted flag on the message.
  PRBool isReallyMove = aMove;
  if (count > 0 && aMove)
  {
    nsresult rv;
    // Assume that all the source messages are from the same server.
    nsCOMPtr<nsIMsgDBHdr> message(do_QueryElementAt(aSrcMsgs, 0, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgFolder> msgFolder;
    rv = message->GetFolder(getter_AddRefs(msgFolder));
    NS_ENSURE_SUCCESS(rv, rv);
    
    nsCOMPtr<nsIMsgImapMailFolder> imapFolder(do_QueryInterface(msgFolder));
    if (imapFolder)
    {
      nsCOMPtr<nsIImapIncomingServer> imapServer;
      imapFolder->GetImapIncomingServer(getter_AddRefs(imapServer));
      if (imapServer)
      {
        nsMsgImapDeleteModel deleteModel;
        imapServer->GetDeleteModel(&deleteModel);
        if (deleteModel == nsMsgImapDeleteModels::IMAPDelete)
          isReallyMove = PR_FALSE;
      }
    }
  }

  for (PRUint32 i = 0; i < count; i++)
  {
    MsgFolderListener listener = mListeners[i];
    NS_ASSERTION(listener.mListener, "listener is null");
    if (!listener.mListener)
      return NS_ERROR_FAILURE;
    if (listener.mFlags & msgsMoveCopyCompleted)
      listener.mListener->MsgsMoveCopyCompleted(aMove, aSrcMsgs, aDestFolder);
  }

  return NS_OK;
}

/* void notifyFolderDeleted(in nsIMsgFolder aFolder); */
NS_IMETHODIMP nsMsgFolderNotificationService::NotifyFolderDeleted(nsIMsgFolder *aFolder)
{
  PRUint32 count = mListeners.Length();

  for (PRUint32 i = 0; i < count; i++)
  {
    MsgFolderListener listener = mListeners[i];
    NS_ASSERTION(listener.mListener, "listener is null");
    if (!listener.mListener)
      return NS_ERROR_FAILURE;
    if (listener.mFlags & folderDeleted)
      listener.mListener->FolderDeleted(aFolder);
  }

  return NS_OK;
}

/* void notifyFolderMoveCopyCompleted(in boolean aMove, in nsIMsgFolder aSrcFolder, in nsIMsgFolder aDestFolder); */
NS_IMETHODIMP nsMsgFolderNotificationService::NotifyFolderMoveCopyCompleted(PRBool aMove, nsIMsgFolder *aSrcFolder, nsIMsgFolder *aDestFolder)
{
  PRUint32 count = mListeners.Length();

  for (PRUint32 i = 0; i < count; i++)
  {
    MsgFolderListener listener = mListeners[i];
    NS_ASSERTION(listener.mListener, "listener is null");
    if (!listener.mListener)
      return NS_ERROR_FAILURE;
    if (listener.mFlags & folderMoveCopyCompleted)
      listener.mListener->FolderMoveCopyCompleted(aMove, aSrcFolder, aDestFolder);
  }

  return NS_OK;
}

/* void notifyFolderRenamed (in nsIMsgFolder aOrigFolder, in nsIMsgFolder aNewFolder); */
NS_IMETHODIMP nsMsgFolderNotificationService::NotifyFolderRenamed(nsIMsgFolder *aOrigFolder, nsIMsgFolder *aNewFolder)
{
  PRInt32 count = mListeners.Length();

  for (PRUint32 i = 0; i < count; i++)
  {
    MsgFolderListener listener = mListeners[i];
    NS_ASSERTION(listener.mListener, "listener is null");
    if (!listener.mListener)
      return NS_ERROR_FAILURE;
    if (listener.mFlags & folderRenamed)
      listener.mListener->FolderRenamed(aOrigFolder, aNewFolder);
  }

  return NS_OK;
}

/* void notifyItemEvent (in nsISupports aItem, in string aEvent, in nsISupports aData); */
NS_IMETHODIMP nsMsgFolderNotificationService::NotifyItemEvent(nsISupports *aItem, const nsACString &aEvent, nsISupports *aData)
{
  PRUint32 count = mListeners.Length();

  for (PRUint32 i = 0; i < count; i++)
  {
    MsgFolderListener listener = mListeners[i];
    NS_ASSERTION(listener.mListener, "listener is null");
    if (!listener.mListener)
      return NS_ERROR_FAILURE;
    if (listener.mFlags & itemEvent)
      listener.mListener->ItemEvent(aItem, aEvent, aData);
  }

  return NS_OK;
}
