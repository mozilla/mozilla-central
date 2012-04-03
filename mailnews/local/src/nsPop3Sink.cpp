/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
#ifdef MOZ_LOGGING
#define FORCE_PR_LOG
#endif


#include "msgCore.h"    // precompiled header...
#include "nsPop3Sink.h"
#include "prprf.h"
#include "prlog.h"
#include "nscore.h"
#include <stdio.h>
#include <time.h>
#include "nsParseMailbox.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsIMsgIncomingServer.h"
#include "nsLocalUtils.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsIMsgFolder.h" // TO include biffState enum. Change to bool later...
#include "nsMailHeaders.h"
#include "nsIMsgAccountManager.h"
#include "nsILineInputStream.h"
#include "nsIPop3Protocol.h"
#include "nsLocalMailFolder.h"
#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIPrompt.h"
#include "nsIPromptService.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIDocShell.h"
#include "nsIDOMWindow.h"
#include "nsEmbedCID.h"
#include "nsMsgUtils.h"
#include "nsMsgBaseCID.h"
#include "nsLocalStrings.h"
#include "nsServiceManagerUtils.h"
#include "nsIPop3Service.h"
#include "nsMsgLocalCID.h"
#include "mozilla/Services.h"

extern PRLogModuleInfo *POP3LOGMODULE;

NS_IMPL_THREADSAFE_ISUPPORTS1(nsPop3Sink, nsIPop3Sink)

nsPop3Sink::nsPop3Sink()
{
    m_authed = false;
    m_downloadingToTempFile = false;
    m_accountUrl = nsnull;
    m_biffState = 0;
    m_numNewMessages = 0;
    m_numNewMessagesInFolder = 0;
    m_numMsgsDownloaded = 0;
    m_senderAuthed = false;
    m_outputBuffer = nsnull;
    m_outputBufferSize = 0;
    m_popServer = nsnull;
    m_outFileStream = nsnull;
    m_uidlDownload = false;
    m_buildMessageUri = false;
    if (!POP3LOGMODULE)
      POP3LOGMODULE = PR_NewLogModule("POP3");

}

nsPop3Sink::~nsPop3Sink()
{
    PR_Free(m_accountUrl);
    PR_Free(m_outputBuffer);
    NS_IF_RELEASE(m_popServer);
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("Calling ReleaseFolderLock from ~nsPop3Sink"));
    ReleaseFolderLock();
}

nsresult
nsPop3Sink::SetUserAuthenticated(bool authed)
{
  m_authed = authed;
  m_popServer->SetAuthenticated(authed);
  return NS_OK;
}

nsresult
nsPop3Sink::GetUserAuthenticated(bool* authed)
{
  return m_popServer->GetAuthenticated(authed);
}

nsresult
nsPop3Sink::SetSenderAuthedFlag(void* closure, bool authed)
{
  m_authed = authed;
  return NS_OK;
}

nsresult
nsPop3Sink::SetMailAccountURL(const char* urlString)
{
  if (urlString)
  {
    PR_Free(m_accountUrl);
    m_accountUrl = PL_strdup(urlString);
  }

  return NS_OK;
}

nsresult
nsPop3Sink::GetMailAccountURL(char* *urlString)
{
  NS_ASSERTION(urlString, "null getter in getMailAccountURL");
  if (!urlString)
    return NS_ERROR_NULL_POINTER;

  *urlString = strdup(m_accountUrl);
  return NS_OK;
}

partialRecord::partialRecord() :
  m_msgDBHdr(nsnull)
{
}

partialRecord::~partialRecord()
{
}

// Walk through all the messages in this folder and look for any
// PARTIAL messages. For each of those, dig thru the mailbox and
// find the Account that the message belongs to. If that Account
// matches the current Account, then look for the Uidl and save
// this message for later processing.
nsresult
nsPop3Sink::FindPartialMessages()
{
  nsCOMPtr<nsISimpleEnumerator> messages;
  bool hasMore = false;
  bool isOpen = false;
  nsLocalFolderScanState folderScanState;
  nsCOMPtr<nsIMsgDatabase> db;
  nsCOMPtr<nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_folder);
  m_folder->GetMsgDatabase(getter_AddRefs(db));
  if (!localFolder || !db)
    return NS_ERROR_FAILURE;  // we need it to grub thru the folder

  nsresult rv = db->EnumerateMessages(getter_AddRefs(messages));
  if (messages)
    messages->HasMoreElements(&hasMore);
  while(hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    PRUint32 flags = 0;
    rv = messages->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsIMsgDBHdr> msgDBHdr(do_QueryInterface(aSupport, &rv));
    msgDBHdr->GetFlags(&flags);
    if (flags & nsMsgMessageFlags::Partial)
    {
      // Open the various streams we need to seek and read from the mailbox
      if (!isOpen)
      {
        rv = localFolder->GetFolderScanState(&folderScanState);
        if (NS_SUCCEEDED(rv))
          isOpen = true;
        else
          break;
      }
      rv = localFolder->GetUidlFromFolder(&folderScanState, msgDBHdr);
      if (!NS_SUCCEEDED(rv))
        break;

      // If we got the uidl, see if this partial message belongs to this
      // account. Add it to the array if so...
      if (folderScanState.m_uidl && 
          m_accountKey.Equals(folderScanState.m_accountKey, nsCaseInsensitiveCStringComparator()))
      {
        partialRecord *partialMsg = new partialRecord();
        if (partialMsg)
        {
          partialMsg->m_uidl = folderScanState.m_uidl;
          partialMsg->m_msgDBHdr = msgDBHdr;
          m_partialMsgsArray.AppendElement(partialMsg);
        }
      }
    }
    messages->HasMoreElements(&hasMore);
  }
  if (isOpen)
    folderScanState.m_inputStream->Close();
  return rv;
}

// For all the partial messages saved by FindPartialMessages,
// ask the protocol handler if they still exist on the server.
// Any messages that don't exist any more are deleted from the
// msgDB.
void
nsPop3Sink::CheckPartialMessages(nsIPop3Protocol *protocol)
{
  PRUint32 count = m_partialMsgsArray.Length();
  bool deleted = false;

  for (PRUint32 i = 0; i < count; i++)
  {
    partialRecord *partialMsg;
    bool found = true;
    partialMsg = m_partialMsgsArray.ElementAt(i);
    protocol->CheckMessage(partialMsg->m_uidl.get(), &found);
    if (!found && partialMsg->m_msgDBHdr)
    {
      if (m_newMailParser)
        m_newMailParser->m_mailDB->DeleteHeader(partialMsg->m_msgDBHdr, nsnull, false, true);
      deleted = true;
    }
    delete partialMsg;
  }
  m_partialMsgsArray.Clear();
  if (deleted)
  {
    nsCOMPtr<nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_folder);
    if (localFolder)
      localFolder->NotifyDelete();
  }
}

nsresult
nsPop3Sink::BeginMailDelivery(bool uidlDownload, nsIMsgWindow *aMsgWindow, bool* aBool)
{
  nsresult rv;

  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_popServer);
  if (!server)
    return NS_ERROR_UNEXPECTED;

  m_window = aMsgWindow;

  nsCOMPtr <nsIMsgAccountManager> acctMgr = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  nsCOMPtr <nsIMsgAccount> account;
  NS_ENSURE_SUCCESS(rv, rv);
  acctMgr->FindAccountForServer(server, getter_AddRefs(account));
  if (account)
    account->GetKey(m_accountKey);

  bool isLocked;
  nsCOMPtr <nsISupports> supports = do_QueryInterface(static_cast<nsIPop3Sink*>(this));
  m_folder->GetLocked(&isLocked);
  if(!isLocked)
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("BeginMailDelivery acquiring semaphore"));
    m_folder->AcquireSemaphore(supports);
  }
  else
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("BeginMailDelivery folder locked"));
    return NS_MSG_FOLDER_BUSY;
  }
  m_uidlDownload = uidlDownload;
  if (!uidlDownload)
    FindPartialMessages();

#ifdef DEBUG
  printf("Begin mail message delivery.\n");
#endif
  nsCOMPtr<nsIPop3Service> pop3Service(do_GetService(NS_POP3SERVICE_CONTRACTID1, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  pop3Service->NotifyDownloadStarted(m_folder);
  if (aBool)
    *aBool = true;
  return NS_OK;
}

nsresult
nsPop3Sink::EndMailDelivery(nsIPop3Protocol *protocol)
{
  CheckPartialMessages(protocol);

  if (m_newMailParser)
  {
    if (m_outFileStream)
      m_outFileStream->Flush();  // try this.
    m_newMailParser->OnStopRequest(nsnull, nsnull, NS_OK);
    m_newMailParser->EndMsgDownload();
  }
  if (m_outFileStream)
  {
    m_outFileStream->Close();
    m_outFileStream = 0;
  }
  if (m_inboxOutputStream)
  {
    m_inboxOutputStream->Close();
    m_inboxOutputStream = nsnull;
  }

  if (m_downloadingToTempFile)
    m_tmpDownloadFile->Remove(false);

  // tell the parser to mark the db valid *after* closing the mailbox.
  if (m_newMailParser)
    m_newMailParser->UpdateDBFolderInfo();

  PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("Calling ReleaseFolderLock from EndMailDelivery"));
  nsresult rv = ReleaseFolderLock();
  NS_ASSERTION(NS_SUCCEEDED(rv),"folder lock not released successfully");

  bool filtersRun;
  m_folder->CallFilterPlugins(nsnull, &filtersRun); // ??? do we need msgWindow?
  PRInt32 numNewMessagesInFolder;
  // if filters have marked msgs read or deleted, the num new messages count
  // will go negative by the number of messages marked read or deleted,
  // so if we add that number to the number of msgs downloaded, that will give
  // us the number of actual new messages.
  m_folder->GetNumNewMessages(false, &numNewMessagesInFolder);
  m_numNewMessages -= (m_numNewMessagesInFolder  - numNewMessagesInFolder);
  m_folder->SetNumNewMessages(m_numNewMessages); // we'll adjust this for spam later
  if (!filtersRun && m_numNewMessages > 0)
  {
    nsCOMPtr <nsIMsgIncomingServer> server;
    m_folder->GetServer(getter_AddRefs(server));
    if (server)
    {
      server->SetPerformingBiff(true);
      m_folder->SetBiffState(m_biffState);
      server->SetPerformingBiff(false);
    }
  }
  // note that size on disk has possibly changed.
  nsCOMPtr<nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_folder);
  if (localFolder)
    (void) localFolder->RefreshSizeOnDisk();
  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_popServer);
  if (server)
  {
    nsCOMPtr <nsIMsgFilterList> filterList;
    rv = server->GetFilterList(nsnull, getter_AddRefs(filterList));
    NS_ENSURE_SUCCESS(rv, rv);

    if (filterList)
      (void) filterList->FlushLogIfNecessary();
  }

  // fix for bug #161999
  // we should update the summary totals for the folder (inbox)
  // in case it's not the open folder
  m_folder->UpdateSummaryTotals(true);

  // check if the folder open in this window is not the current folder, and if it has new
  // message, in which case we need to try to run the filter plugin.
  if (m_newMailParser)
  {
    nsCOMPtr <nsIMsgWindow> msgWindow;
    m_newMailParser->GetMsgWindow(getter_AddRefs(msgWindow));
    // this breaks down if it's biff downloading new mail because
    // there's no msgWindow...
    if (msgWindow)
    {
      nsCOMPtr <nsIMsgFolder> openFolder;
      (void) msgWindow->GetOpenFolder(getter_AddRefs(openFolder));
      if (openFolder && openFolder != m_folder)
      {
        // only call filter plugins if folder is a local folder, because only
        // local folders get messages filtered into them synchronously by pop3.
        nsCOMPtr<nsIMsgLocalMailFolder> localFolder = do_QueryInterface(openFolder);
        if (localFolder)
        {
          bool hasNew, isLocked;
          (void) openFolder->GetHasNewMessages(&hasNew);
          if (hasNew)
          {
            // if the open folder is locked, we shouldn't run the spam filters
            // on it because someone is using the folder. see 218433.
            // Ideally, the filter plugin code would try to grab the folder lock
            // and hold onto it until done, but that's more difficult and I think
            // this will actually fix the problem.
            openFolder->GetLocked(&isLocked);
            if(!isLocked)
              openFolder->CallFilterPlugins(nsnull, &filtersRun);
          }
        }
      }
    }
  }
#ifdef DEBUG
  printf("End mail message delivery.\n");
#endif
  nsCOMPtr<nsIPop3Service> pop3Service(do_GetService(NS_POP3SERVICE_CONTRACTID1, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  pop3Service->NotifyDownloadCompleted(m_folder, m_numNewMessages);
  return NS_OK;
}

nsresult
nsPop3Sink::ReleaseFolderLock()
{
  nsresult result = NS_OK;
  if (!m_folder)
    return result;
  bool haveSemaphore;
  nsCOMPtr <nsISupports> supports = do_QueryInterface(static_cast<nsIPop3Sink*>(this));
  result = m_folder->TestSemaphore(supports, &haveSemaphore);
  PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("ReleaseFolderLock haveSemaphore = %s", haveSemaphore ? "TRUE" : "FALSE"));

  if(NS_SUCCEEDED(result) && haveSemaphore)
    result = m_folder->ReleaseSemaphore(supports);
  return result;
}

nsresult
nsPop3Sink::AbortMailDelivery(nsIPop3Protocol *protocol)
{
  CheckPartialMessages(protocol);

  // ### PS TODO - discard any new message?

  if (m_outFileStream)
  {
    m_outFileStream->Close();
    m_outFileStream = 0;
  }
  if (m_inboxOutputStream)
  {
    m_inboxOutputStream->Close();
    m_inboxOutputStream = nsnull;
  }

  if (m_downloadingToTempFile && m_tmpDownloadFile)
    m_tmpDownloadFile->Remove(false);

  /* tell the parser to mark the db valid *after* closing the mailbox.
  we have truncated the inbox, so berkeley mailbox and msf file are in sync*/
  if (m_newMailParser)
    m_newMailParser->UpdateDBFolderInfo();
  PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("Calling ReleaseFolderLock from AbortMailDelivery"));

  nsresult rv = ReleaseFolderLock();
  NS_ASSERTION(NS_SUCCEEDED(rv),"folder lock not released successfully");

#ifdef DEBUG
    printf("Abort mail message delivery.\n");
#endif
  nsCOMPtr<nsIPop3Service> pop3Service(do_GetService(NS_POP3SERVICE_CONTRACTID1, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  pop3Service->NotifyDownloadCompleted(m_folder, 0);
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::IncorporateBegin(const char* uidlString,
                             nsIURI* aURL,
                             PRUint32 flags,
                             void** closure)
{
#ifdef DEBUG
    printf("Incorporate message begin:\n");
    if (uidlString)
        printf("uidl string: %s\n", uidlString);
#endif
  nsCOMPtr<nsILocalFile> path;

  m_folder->GetFilePath(getter_AddRefs(path));

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (pPrefBranch)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    m_folder->GetServer(getter_AddRefs(server));
    nsCString plugStoreContract;
    server->GetCharValue("storeContractID", plugStoreContract);
    // Maildir doesn't care about quaranting, but other stores besides berkeley
    // mailbox might. We should probably make this an attribute on the pluggable
    // store, though.
    if (plugStoreContract.Equals(
          NS_LITERAL_CSTRING("@mozilla.org/msgstore/berkeleystore;1")))
      pPrefBranch->GetBoolPref("mailnews.downloadToTempFile", &m_downloadingToTempFile);
  }

  nsCOMPtr<nsIMsgDBHdr> newHdr;

  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_popServer);
  if (!server)
    return NS_ERROR_UNEXPECTED;

  if (m_downloadingToTempFile)
  {
    // need to create an nsIOFileStream from a temp file...
    nsCOMPtr<nsIFile> tmpDownloadFile;
    rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
                                         "newmsg",
                                         getter_AddRefs(tmpDownloadFile));

    NS_ASSERTION(NS_SUCCEEDED(rv),
                 "writing tmp pop3 download file: failed to append filename");
    if (NS_FAILED(rv))
      return rv;

    if (!m_tmpDownloadFile)
    {
      //need a unique tmp file to prevent dataloss in multiuser environment
      rv = tmpDownloadFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
      NS_ENSURE_SUCCESS(rv, rv);

      m_tmpDownloadFile = do_QueryInterface(tmpDownloadFile, &rv);
    }
    if (NS_SUCCEEDED(rv))
    {
      rv = MsgGetFileStream(m_tmpDownloadFile, getter_AddRefs(m_outFileStream));
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }
  else
  {
    rv = server->GetMsgStore(getter_AddRefs(m_msgStore));
    bool reusable;
    NS_ENSURE_SUCCESS(rv, rv);
    m_msgStore->GetNewMsgOutputStream(m_folder, getter_AddRefs(newHdr),
                                      &reusable, getter_AddRefs(m_outFileStream));
  }
  // The following (!m_outFileStream etc) was added to make sure that we don't
  // write somewhere where for some reason or another we can't write to and
  // lose the messages. See bug 62480
  if (!m_outFileStream)
      return NS_ERROR_OUT_OF_MEMORY;

  nsCOMPtr<nsISeekableStream> seekableOutStream = do_QueryInterface(m_outFileStream);

  // create a new mail parser
  m_newMailParser = new nsParseNewMailState;
  NS_ENSURE_TRUE(m_newMailParser, NS_ERROR_OUT_OF_MEMORY);
  if (m_uidlDownload)
    m_newMailParser->DisableFilters();

  m_folder->GetNumNewMessages(false, &m_numNewMessagesInFolder);
  nsCOMPtr <nsIMsgFolder> serverFolder;
  rv = GetServerFolder(getter_AddRefs(serverFolder));
  if (NS_FAILED(rv)) return rv;

  rv = m_newMailParser->Init(serverFolder, m_folder,
                             m_window, newHdr, m_outFileStream);
  // If we failed to initialize the parser, then just don't use it!!!
  // We can still continue without one.

  if (NS_FAILED(rv))
  {
    m_newMailParser = nsnull;
    rv = NS_OK;
  }
  else
  {
    if (m_downloadingToTempFile)
    {
      // Tell the parser to use the offset that will be in the dest folder,
      // not the temp folder, so that the msg hdr will start off with
      // the correct mdb oid
      PRInt64 fileSize;
      path->GetFileSize(&fileSize);
      m_newMailParser->SetEnvelopePos((PRUint32) fileSize);
    }
  }
    if (closure)
        *closure = (void*) this;

    char *dummyEnvelope = GetDummyEnvelope();

  rv = WriteLineToMailbox(dummyEnvelope);
  NS_ENSURE_SUCCESS(rv, rv);
    // write out account-key before UIDL so the code that looks for
    // UIDL will find the account first and know it can stop looking
    // once it finds the UIDL line.
    if (!m_accountKey.IsEmpty())
    {
      nsCAutoString outputString;
      outputString.AssignLiteral(HEADER_X_MOZILLA_ACCOUNT_KEY ": ");
      outputString.Append(m_accountKey);
      outputString.AppendLiteral(MSG_LINEBREAK);
      WriteLineToMailbox(outputString.get());
    }
    if (uidlString)
    {
      nsCAutoString uidlCString("X-UIDL: ");
      uidlCString += uidlString;
      uidlCString += MSG_LINEBREAK;
      rv = WriteLineToMailbox(const_cast<char*>(uidlCString.get()));
      NS_ENSURE_SUCCESS(rv, rv);
    }
    // WriteLineToMailbox("X-Mozilla-Status: 8000" MSG_LINEBREAK);
    char *statusLine = PR_smprintf(X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, flags);
    rv = WriteLineToMailbox(statusLine);
    if (NS_FAILED(rv)) return rv;
    rv = WriteLineToMailbox("X-Mozilla-Status2: 00000000" MSG_LINEBREAK);
    if (NS_FAILED(rv)) return rv;
    // leave space for 60 bytes worth of keys/tags
    rv = WriteLineToMailbox(X_MOZILLA_KEYWORDS);
    PR_smprintf_free(statusLine);
    return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::SetPopServer(nsIPop3IncomingServer *server)
{
  NS_IF_RELEASE(m_popServer);
  m_popServer=server;
  NS_ADDREF(m_popServer);

  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::GetPopServer(nsIPop3IncomingServer **aServer)
{
  NS_ENSURE_ARG_POINTER(aServer);
  NS_IF_ADDREF(*aServer = m_popServer);
  return NS_OK;
}

NS_IMETHODIMP nsPop3Sink::GetFolder(nsIMsgFolder **aFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_IF_ADDREF(*aFolder = m_folder);
  return NS_OK;
}

NS_IMETHODIMP nsPop3Sink::SetFolder(nsIMsgFolder * aFolder)
{
  m_folder = aFolder;
  return NS_OK;
}

nsresult
nsPop3Sink::GetServerFolder(nsIMsgFolder **aFolder)
{
  if (!aFolder)
    return NS_ERROR_NULL_POINTER;
  if (m_popServer)
  {
    // not sure what this is used for - might be wrong if we have a deferred account.
    nsCOMPtr <nsIMsgIncomingServer> incomingServer = do_QueryInterface(m_popServer);
    if (incomingServer)
      return incomingServer->GetRootFolder(aFolder);
  }
  *aFolder = nsnull;
  return NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsPop3Sink::SetMsgsToDownload(PRUint32 aNumMessages)
{
  m_numNewMessages = aNumMessages;
  return NS_OK;
}

char*
nsPop3Sink::GetDummyEnvelope(void)
{
  static char result[75];
  char *ct;
  time_t now = time ((time_t *) 0);
#if defined (XP_WIN)
  if (now < 0 || now > 0x7FFFFFFF)
    now = 0x7FFFFFFF;
#endif
  ct = ctime(&now);
  PR_ASSERT(ct[24] == '\r' || ct[24] == '\n');
  ct[24] = 0;
  /* This value must be in ctime() format, with English abbreviations.
   strftime("... %c ...") is no good, because it is localized. */
  PL_strcpy(result, "From - ");
  PL_strcpy(result + 7, ct);
  PL_strcpy(result + 7 + 24, MSG_LINEBREAK);
  return result;
}

nsresult
nsPop3Sink::IncorporateWrite(const char* block,
                             PRInt32 length)
{
  PRInt32 blockOffset = 0;
  if (!strncmp(block, "From ", 5))
  {
    length++;
    blockOffset = 1;
  }
  if (!m_outputBuffer || length > m_outputBufferSize)
  {
    if (!m_outputBuffer)
      m_outputBuffer = (char*) PR_MALLOC(length+1);
    else
      m_outputBuffer = (char*) PR_REALLOC(m_outputBuffer, length+1);

    m_outputBufferSize = length;
  }
  if (m_outputBuffer)
  {
    if (blockOffset == 1)
      *m_outputBuffer = '>';
    memcpy(m_outputBuffer + blockOffset, block, length - blockOffset);
    *(m_outputBuffer + length) = 0;
    nsresult rv = WriteLineToMailbox (m_outputBuffer);
    if (NS_FAILED(rv)) return rv;
  }
  return NS_OK;
}

nsresult nsPop3Sink::WriteLineToMailbox(const char *buffer)
{

  if (buffer)
  {
    PRInt32 bufferLen = PL_strlen(buffer);
    if (m_newMailParser) // HandleLine should really take a const char *...
      m_newMailParser->HandleLine((char *) buffer, bufferLen);
    // The following (!m_outFileStream etc) was added to make sure that we don't write somewhere
    // where for some reason or another we can't write to and lose the messages
    // See bug 62480
    if (!m_outFileStream)
      return NS_ERROR_OUT_OF_MEMORY;

    // seek to the end in case someone else has seeked elsewhere in our stream.
    nsCOMPtr <nsISeekableStream> seekableOutStream = do_QueryInterface(m_outFileStream);
    seekableOutStream->Seek(nsISeekableStream::NS_SEEK_END, 0);
    PRUint32 bytesWritten;
    m_outFileStream->Write(buffer, bufferLen, &bytesWritten);
    if ((PRInt32) bytesWritten != bufferLen) return NS_ERROR_FAILURE;
  }
  return NS_OK;
}

nsresult nsPop3Sink::HandleTempDownloadFailed(nsIMsgWindow *msgWindow)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/localMsgs.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);
  nsString fromStr, subjectStr, confirmString;

  m_newMailParser->m_newMsgHdr->GetMime2DecodedSubject(subjectStr);
  m_newMailParser->m_newMsgHdr->GetMime2DecodedAuthor(fromStr);
  const PRUnichar *params[] = { fromStr.get(), subjectStr.get() };
  bundle->FormatStringFromID(POP3_TMP_DOWNLOAD_FAILED, params, 2, getter_Copies(confirmString));
  nsCOMPtr<nsIDOMWindow> parentWindow;
  nsCOMPtr<nsIPromptService> promptService = do_GetService(NS_PROMPTSERVICE_CONTRACTID);
  nsCOMPtr<nsIDocShell> docShell;
  if (msgWindow)
  {
    (void) msgWindow->GetRootDocShell(getter_AddRefs(docShell));
    parentWindow = do_QueryInterface(docShell);
  }
  if (promptService && !confirmString.IsEmpty())
  {
    PRInt32 dlgResult  = -1;
    bool dummyValue = false;
    rv = promptService->ConfirmEx(parentWindow, nsnull, confirmString.get(),
                      nsIPromptService::STD_YES_NO_BUTTONS,
                      nsnull,
                      nsnull,
                      nsnull,
                      nsnull,
                      &dummyValue,
                      &dlgResult);
    m_newMailParser->m_newMsgHdr = nsnull;

    return (dlgResult == 0) ? NS_OK : NS_MSG_ERROR_COPYING_FROM_TMP_DOWNLOAD;
  }
  return rv;
}


NS_IMETHODIMP
nsPop3Sink::IncorporateComplete(nsIMsgWindow *aMsgWindow, PRInt32 aSize)
{
  if (m_buildMessageUri && !m_baseMessageUri.IsEmpty())
  {
    PRUint32 msgKey;
    m_newMailParser->GetEnvelopePos(&msgKey);
    m_messageUri.Truncate();
    nsBuildLocalMessageURI(m_baseMessageUri.get(), msgKey, m_messageUri);
  }

  nsresult rv = WriteLineToMailbox(MSG_LINEBREAK);
  NS_ENSURE_SUCCESS(rv, rv);
  bool leaveOnServer = false;
  m_popServer->GetLeaveMessagesOnServer(&leaveOnServer);
  // We need to flush the output stream, in case mail filters move
  // the new message, which relies on all the data being flushed.
  rv = m_outFileStream->Flush(); // Make sure the message is written to the disk
  NS_ENSURE_SUCCESS(rv, rv);
  NS_ASSERTION(m_newMailParser, "could not get m_newMailParser");
  if (m_newMailParser)
  {
    // PublishMsgHdr clears m_newMsgHdr, so we need a comptr to
    // hold onto it.
    nsCOMPtr<nsIMsgDBHdr> hdr = m_newMailParser->m_newMsgHdr;
    NS_ASSERTION(hdr, "m_newMailParser->m_newMsgHdr wasn't set");
    if (!hdr)
      return NS_ERROR_FAILURE;

    nsCOMPtr<nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_folder);
    bool doSelect = false;

    // aSize is only set for partial messages. For full messages,
    // check to see if we're replacing an old partial message.
    if (!aSize && localFolder)
      (void) localFolder->DeleteDownloadMsg(hdr, &doSelect);

    // If a header already exists for this message (for example, when
    // getting a complete message when a partial exists), then update the new
    // header from the old.
    if (!m_origMessageUri.IsEmpty() && localFolder)
    {
      nsCOMPtr <nsIMsgDBHdr> oldMsgHdr;
      rv = GetMsgDBHdrFromURI(m_origMessageUri.get(), getter_AddRefs(oldMsgHdr));
      if (NS_SUCCEEDED(rv) && oldMsgHdr)
        localFolder->UpdateNewMsgHdr(oldMsgHdr, hdr);
    }

    if (m_downloadingToTempFile)
    {
      // close file to give virus checkers a chance to do their thing...
      m_outFileStream->Flush();
      m_outFileStream->Close();
      m_newMailParser->FinishHeader();
      // need to re-open the inbox file stream.
      bool exists;
      m_tmpDownloadFile->Exists(&exists);
      if (!exists)
        return HandleTempDownloadFailed(aMsgWindow);

      nsCOMPtr <nsIInputStream> inboxInputStream = do_QueryInterface(m_outFileStream);
      rv = MsgReopenFileStream(m_tmpDownloadFile, inboxInputStream);
      NS_ENSURE_SUCCESS(rv, HandleTempDownloadFailed(aMsgWindow));
      if (m_outFileStream)
      {
        PRInt64 tmpDownloadFileSize;
        PRUint32 msgSize;
        hdr->GetMessageSize(&msgSize);
        // we need to clone because nsLocalFileUnix caches its stat result,
        // so it doesn't realize the file has changed size.
        nsCOMPtr <nsIFile> tmpClone;
        rv = m_tmpDownloadFile->Clone(getter_AddRefs(tmpClone));
        NS_ENSURE_SUCCESS(rv, rv);
        tmpClone->GetFileSize(&tmpDownloadFileSize);

        if (msgSize > tmpDownloadFileSize)
          rv = NS_MSG_ERROR_WRITING_MAIL_FOLDER;
        else
          rv = m_newMailParser->AppendMsgFromStream(inboxInputStream, hdr,
                                                    msgSize, m_folder);
        if (NS_FAILED(rv))
          return HandleTempDownloadFailed(aMsgWindow);

        m_outFileStream->Close(); // close so we can truncate.
        m_tmpDownloadFile->SetFileSize(0);
      }
      else
      {
          return HandleTempDownloadFailed(aMsgWindow);
        // need to give an error here.
      }
    }
    else
    {
      m_msgStore->FinishNewMessage(m_outFileStream, hdr);
    }
    m_newMailParser->PublishMsgHeader(aMsgWindow);
    // run any reply/forward filter after we've finished with the
    // temp quarantine file, and/or moved the message to another folder.
    m_newMailParser->ApplyForwardAndReplyFilter(aMsgWindow);
    if (aSize)
      hdr->SetUint32Property("onlineSize", aSize);

    // if DeleteDownloadMsg requested it, select the new message
    else if (doSelect)
      (void) localFolder->SelectDownloadMsg();
  }

#ifdef DEBUG
  printf("Incorporate message complete.\n");
#endif
  nsCOMPtr<nsIPop3Service> pop3Service(do_GetService(NS_POP3SERVICE_CONTRACTID1, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  pop3Service->NotifyDownloadProgress(m_folder, ++m_numMsgsDownloaded, m_numNewMessages);
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::IncorporateAbort(bool uidlDownload)
{
  nsresult rv = m_outFileStream->Close();
  NS_ENSURE_SUCCESS(rv,rv);
  if (!m_downloadingToTempFile && m_msgStore)
      m_msgStore->DiscardNewMessage(m_outFileStream,
                                    m_newMailParser->m_newMsgHdr);
#ifdef DEBUG
    printf("Incorporate message abort.\n");
#endif
    return rv;
}

nsresult
nsPop3Sink::BiffGetNewMail()
{
#ifdef DEBUG
    printf("Biff get new mail.\n");
#endif
    return NS_OK;
}

nsresult
nsPop3Sink::SetBiffStateAndUpdateFE(PRUint32 aBiffState, PRInt32 numNewMessages, bool notify)
{
  m_biffState = aBiffState;
  if (m_newMailParser)
    numNewMessages -= m_newMailParser->m_numNotNewMessages;

  if (notify && m_folder && numNewMessages > 0 && numNewMessages != m_numNewMessages
      && aBiffState == nsIMsgFolder::nsMsgBiffState_NewMail)
  {
    m_folder->SetNumNewMessages(numNewMessages);
    m_folder->SetBiffState(aBiffState);
  }
  m_numNewMessages = numNewMessages;

  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::GetBuildMessageUri(bool *bVal)
{
  NS_ENSURE_ARG_POINTER(bVal);
  *bVal = m_buildMessageUri;
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::SetBuildMessageUri(bool bVal)
{
  m_buildMessageUri = bVal;
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::GetMessageUri(char **messageUri)
{
  NS_ENSURE_ARG_POINTER(messageUri);
  NS_ENSURE_TRUE(!m_messageUri.IsEmpty(), NS_ERROR_FAILURE);
  *messageUri = ToNewCString(m_messageUri);
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::SetMessageUri(const char *messageUri)
{
  NS_ENSURE_ARG_POINTER(messageUri);
  m_messageUri = messageUri;
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::GetBaseMessageUri(char ** baseMessageUri)
{
  NS_ENSURE_ARG_POINTER(baseMessageUri);
  NS_ENSURE_TRUE(!m_baseMessageUri.IsEmpty(), NS_ERROR_FAILURE);
  *baseMessageUri = ToNewCString(m_baseMessageUri);
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::SetBaseMessageUri(const char *baseMessageUri)
{
  NS_ENSURE_ARG_POINTER(baseMessageUri);
  m_baseMessageUri = baseMessageUri;
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::GetOrigMessageUri(nsACString& aOrigMessageUri)
{
  aOrigMessageUri.Assign(m_origMessageUri);
  return NS_OK;
}

NS_IMETHODIMP
nsPop3Sink::SetOrigMessageUri(const nsACString& aOrigMessageUri)
{
  m_origMessageUri.Assign(aOrigMessageUri);
  return NS_OK;
}
