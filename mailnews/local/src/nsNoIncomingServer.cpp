/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h" // pre-compiled headers

#include "prmem.h"
#include "plstr.h"
#include "prprf.h"
#include "nsNoIncomingServer.h"
#include "nsMsgLocalCID.h"
#include "nsMsgFolderFlags.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsIMsgMailSession.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgAccountManager.h"
#include "nsIPop3IncomingServer.h"
#include "nsServiceManagerUtils.h"
#include "nsMsgUtils.h"

NS_IMPL_ISUPPORTS_INHERITED2(nsNoIncomingServer,
                            nsMsgIncomingServer,
                            nsINoIncomingServer,
                            nsILocalMailIncomingServer)

nsNoIncomingServer::nsNoIncomingServer()
{
}

nsNoIncomingServer::~nsNoIncomingServer()
{
}

nsresult
nsNoIncomingServer::GetLocalStoreType(nsACString& type)
{
  type.AssignLiteral("mailbox");
  return NS_OK;
}

NS_IMETHODIMP
nsNoIncomingServer::GetAccountManagerChrome(nsAString& aResult)
{
  aResult.AssignLiteral("am-serverwithnoidentities.xul");
  return NS_OK;
}

NS_IMETHODIMP
nsNoIncomingServer::SetFlagsOnDefaultMailboxes()
{
  nsCOMPtr<nsIMsgFolder> rootFolder;
  nsresult rv = GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgLocalMailFolder> localFolder =
      do_QueryInterface(rootFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // None server may have an inbox if it's deferred to,
  // or if it's the smart mailboxes account.
  uint32_t mailboxFlags = nsMsgFolderFlags::SentMail |
                          nsMsgFolderFlags::Archive |
                          nsMsgFolderFlags::Drafts |
                          nsMsgFolderFlags::Templates |
                          nsMsgFolderFlags::Trash |
                          nsMsgFolderFlags::Junk |
                          nsMsgFolderFlags::Inbox |
                          nsMsgFolderFlags::Queue;

  localFolder->SetFlagsOnDefaultMailboxes(mailboxFlags);

  return NS_OK;
}

NS_IMETHODIMP nsNoIncomingServer::CopyDefaultMessages(const char *folderNameOnDisk, nsIFile *parentDir)
{
  nsresult rv;
  bool exists;
  if (!folderNameOnDisk || !parentDir) return NS_ERROR_NULL_POINTER;

  nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Get defaults directory for messenger files. MailSession service appends 'messenger' to the
  // the app defaults folder and returns it. Locale will be added to the path, if there is one.
  nsCOMPtr<nsIFile> defaultMessagesFile;
  rv = mailSession->GetDataFilesDir("messenger", getter_AddRefs(defaultMessagesFile));
  NS_ENSURE_SUCCESS(rv,rv);

  // check if bin/defaults/messenger/<folderNameOnDisk>
  // (or bin/defaults/messenger/<locale>/<folderNameOnDisk> if we had a locale provide) exists.
  // it doesn't have to exist.  if it doesn't, return
  rv = defaultMessagesFile->AppendNative(nsDependentCString(folderNameOnDisk));
  if (NS_FAILED(rv)) return rv;
  rv = defaultMessagesFile->Exists(&exists);
  if (NS_FAILED(rv)) return rv;
  if (!exists) return NS_OK;


  // check if parentDir/<folderNameOnDisk> exists
  {
    nsCOMPtr<nsIFile> testDir;
    rv = parentDir->Clone(getter_AddRefs(testDir));
    if (NS_FAILED(rv)) return rv;
    rv = testDir->AppendNative(nsDependentCString(folderNameOnDisk));
    if (NS_FAILED(rv)) return rv;
    rv = testDir->Exists(&exists);
    if (NS_FAILED(rv)) return rv;
  }

  // if it exists add to the end, else copy
  if (exists)
  {
#ifdef DEBUG_sspitzer
    printf("append default %s\n",folderNameOnDisk);
#endif
    // todo for bug #1181
    // open folderFile, seek to end
    // read defaultMessagesFile, write to folderFile
  }
  else {
#ifdef DEBUG_sspitzer
    printf("copy default %s\n",folderNameOnDisk);
#endif
    rv = defaultMessagesFile->CopyTo(parentDir, EmptyString());
    if (NS_FAILED(rv)) return rv;
  }
  return NS_OK;
}


NS_IMETHODIMP nsNoIncomingServer::CreateDefaultMailboxes(nsIFile *aPath)
{
  NS_ENSURE_ARG_POINTER(aPath);
  
  bool isHidden = false;
  GetHidden(&isHidden);
  if (isHidden)
    return NS_OK;
    
  nsCOMPtr <nsIFile> path;
  nsresult rv = aPath->Clone(getter_AddRefs(path));
  NS_ENSURE_SUCCESS(rv, rv);

  // notice, no Inbox, unless we're deferred to...
   // need to have a leaf to start with
  rv = path->AppendNative(NS_LITERAL_CSTRING("Trash"));
  bool isDeferredTo;
  if (NS_SUCCEEDED(GetIsDeferredTo(&isDeferredTo)) && isDeferredTo)
    CreateLocalFolder(NS_LITERAL_STRING("Inbox"));
  CreateLocalFolder(NS_LITERAL_STRING("Trash"));
  NS_ENSURE_SUCCESS(rv, rv);

  // copy the default templates into the Templates folder
  nsCOMPtr<nsIFile> parentDir;
  rv = path->GetParent(getter_AddRefs(parentDir));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = CopyDefaultMessages("Templates", parentDir);
  NS_ENSURE_SUCCESS(rv, rv);

  (void ) CreateLocalFolder(NS_LITERAL_STRING("Unsent Messages"));
  return NS_OK;
}

NS_IMETHODIMP
nsNoIncomingServer::GetNewMail(nsIMsgWindow *aMsgWindow, nsIUrlListener *aUrlListener, nsIMsgFolder *aInbox, nsIURI **aResult)
{
  nsCOMPtr <nsISupportsArray> deferredServers;
  nsresult rv = GetDeferredServers(this, getter_AddRefs(deferredServers));
  NS_ENSURE_SUCCESS(rv, rv);
  uint32_t count;
  deferredServers->Count(&count);
  if (count > 0)
  {
    nsCOMPtr <nsIPop3IncomingServer> firstServer(do_QueryElementAt(deferredServers, 0));
    if (firstServer)
    {
      rv = firstServer->DownloadMailFromServers(deferredServers, aMsgWindow,
                              aInbox,
                              aUrlListener);
    }
  }
  // listener might be counting on us to send a notification.
  else if (aUrlListener)
    aUrlListener->OnStopRunningUrl(nullptr, NS_OK);
  return rv;
}


NS_IMETHODIMP
nsNoIncomingServer::GetCanSearchMessages(bool *canSearchMessages)
{
  NS_ENSURE_ARG_POINTER(canSearchMessages);
  *canSearchMessages = true;
  return NS_OK;
}

NS_IMETHODIMP
nsNoIncomingServer::GetServerRequiresPasswordForBiff(bool *aServerRequiresPasswordForBiff)
{
  NS_ENSURE_ARG_POINTER(aServerRequiresPasswordForBiff);
  *aServerRequiresPasswordForBiff = false;  // for local folders, we don't require a password
  return NS_OK;
}


