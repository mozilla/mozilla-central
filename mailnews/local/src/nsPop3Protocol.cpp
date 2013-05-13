/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Original Code has been modified by IBM Corporation. Modifications made by IBM
 * described herein are Copyright (c) International Business Machines Corporation, 2000.
 * Modifications to Mozilla code or documentation identified per MPL Section 3.3
 *
 * Jason Eager <jce2@po.cwru.edu>
 *
 * Date             Modified by     Description of modification
 * 04/20/2000       IBM Corp.      OS/2 VisualAge build.
 * 06/07/2000       Jason Eager    Added check for out of disk space
 */

#ifdef MOZ_LOGGING
#define FORCE_PR_LOG
#endif

#include "nscore.h"
#include "msgCore.h"    // precompiled header...
#include "nsNetUtil.h"
#include "nspr.h"
#include "plbase64.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsPop3Protocol.h"
#include "MailNewsTypes.h"
#include "nsStringGlue.h"
#include "nsIPrompt.h"
#include "nsIMsgIncomingServer.h"
#include "nsIMsgPluggableStore.h"
#include "nsTextFormatter.h"
#include "nsCOMPtr.h"
#include "nsIMsgWindow.h"
#include "nsIMsgFolder.h" // TO include biffState enum. Change to bool later...
#include "nsIDocShell.h"
#include "nsMsgUtils.h"
#include "nsISocketTransport.h"
#include "nsISSLSocketControl.h"
#include "nsILineInputStream.h"
#include "nsLocalStrings.h"
#include "nsIInterfaceRequestor.h"
#include "nsMsgMessageFlags.h"
#include "nsMsgBaseCID.h"
#include "mozilla/Services.h"

PRLogModuleInfo *POP3LOGMODULE = nullptr;


static int
net_pop3_remove_messages_marked_delete(PLHashEntry* he,
                                       int msgindex,
                                       void *arg)
{
  Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) he->value;
  return (uidlEntry->status == DELETE_CHAR)
    ? HT_ENUMERATE_REMOVE : HT_ENUMERATE_NEXT;
}

uint32_t TimeInSecondsFromPRTime(PRTime prTime)
{
  return (uint32_t)(prTime / PR_USEC_PER_SEC);
}

static void
put_hash(PLHashTable* table, const char* key, char value, uint32_t dateReceived)
{
  // don't put not used slots or empty uid into hash
  if (key && *key)
  {
    Pop3UidlEntry* tmp = PR_NEWZAP(Pop3UidlEntry);
    if (tmp)
    {
      tmp->uidl = PL_strdup(key);
      if (tmp->uidl)
      {
        tmp->dateReceived = dateReceived;
        tmp->status = value;
        PL_HashTableAdd(table, (const void *)tmp->uidl, (void*) tmp);
      }
      else
        PR_Free(tmp);
    }
  }
}

static int
net_pop3_copy_hash_entries(PLHashEntry* he, int msgindex, void *arg)
{
  Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) he->value;
  put_hash((PLHashTable *) arg, uidlEntry->uidl, uidlEntry->status, uidlEntry->dateReceived);
  return HT_ENUMERATE_NEXT;
}

static void *
AllocUidlTable(void * /* pool */, size_t size)
{
  return PR_MALLOC(size);
}

static void
FreeUidlTable(void * /* pool */, void *item)
{
    PR_Free(item);
}

static PLHashEntry *
AllocUidlInfo(void *pool, const void *key)
{
    return PR_NEWZAP(PLHashEntry);
}

static void
FreeUidlInfo(void * /* pool */, PLHashEntry *he, unsigned flag)
{
  if (flag == HT_FREE_ENTRY)
  {
    Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) he->value;
    if (uidlEntry)
    {
      PR_Free(uidlEntry->uidl);
      PR_Free(uidlEntry);
    }
    PR_Free(he);
  }
}

static PLHashAllocOps gHashAllocOps = {
    AllocUidlTable, FreeUidlTable,
    AllocUidlInfo, FreeUidlInfo
};


static Pop3UidlHost*
net_pop3_load_state(const char* searchhost,
                    const char* searchuser,
                    nsIFile *mailDirectory)
{
  Pop3UidlHost* result = nullptr;
  Pop3UidlHost* current = nullptr;
  Pop3UidlHost* tmp;

  result = PR_NEWZAP(Pop3UidlHost);
  if (!result)
    return nullptr;
  result->host = PL_strdup(searchhost);
  result->user = PL_strdup(searchuser);
  result->hash = PL_NewHashTable(20, PL_HashString, PL_CompareStrings, PL_CompareValues, &gHashAllocOps, nullptr);

  if (!result->host || !result->user || !result->hash)
  {
    PR_Free(result->host);
    PR_Free(result->user);
    if (result->hash)
      PL_HashTableDestroy(result->hash);
    PR_Free(result);
    return nullptr;
  }

  nsCOMPtr <nsIFile> popState;
  mailDirectory->Clone(getter_AddRefs(popState));
  if (!popState)
    return nullptr;
  popState->AppendNative(NS_LITERAL_CSTRING("popstate.dat"));

  nsCOMPtr<nsIInputStream> fileStream;
  nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(fileStream), popState);
  NS_ENSURE_SUCCESS(rv, result);

  nsCOMPtr<nsILineInputStream> lineInputStream(do_QueryInterface(fileStream, &rv));
  NS_ENSURE_SUCCESS(rv, result);

  bool more = true;
  nsCString line;

  while (more && NS_SUCCEEDED(rv))
  {
    lineInputStream->ReadLine(line, &more);
    if (line.IsEmpty())
      continue;
    char firstChar = line.CharAt(0);
    if (firstChar == '#')
      continue;
    if (firstChar == '*') {
      /* It's a host&user line. */
      current = nullptr;
      char *lineBuf = line.BeginWriting() + 1; // ok because we know the line isn't empty
      char *host = NS_strtok(" \t\r\n", &lineBuf);
      /* without space to also get realnames - see bug 225332 */
      char *user = NS_strtok("\t\r\n", &lineBuf);
      if (!host || !user)
        continue;
      for (tmp = result ; tmp ; tmp = tmp->next)
      {
        if (!strcmp(host, tmp->host) && !strcmp(user, tmp->user))
        {
          current = tmp;
          break;
        }
      }
      if (!current)
      {
        current = PR_NEWZAP(Pop3UidlHost);
        if (current)
        {
          current->host = strdup(host);
          current->user = strdup(user);
          current->hash = PL_NewHashTable(20, PL_HashString, PL_CompareStrings, PL_CompareValues, &gHashAllocOps, nullptr);
          if (!current->host || !current->user || !current->hash)
          {
            PR_Free(current->host);
            PR_Free(current->user);
            if (current->hash)
              PL_HashTableDestroy(current->hash);
            PR_Free(current);
          }
          else
          {
            current->next = result->next;
            result->next = current;
          }
        }
      }
    }
    else
    {
      /* It's a line with a UIDL on it. */
      if (current)
      {
        for (int32_t pos = line.FindChar('\t'); pos != -1; pos = line.FindChar('\t', pos))
          line.Replace(pos, 1, ' ');

        nsTArray<nsCString> lineElems;
        ParseString(line, ' ', lineElems);
        if (lineElems.Length() < 2)
          continue;
        nsCString *flags = &lineElems[0];
        nsCString *uidl = &lineElems[1];
        uint32_t dateReceived = TimeInSecondsFromPRTime(PR_Now()); // if we don't find a date str, assume now.
        if (lineElems.Length() > 2)
          dateReceived = atoi(lineElems[2].get());
        if (!flags->IsEmpty() && !uidl->IsEmpty())
        {
          char flag = flags->CharAt(0);
          if ((flag == KEEP) || (flag == DELETE_CHAR) ||
            (flag == TOO_BIG) || (flag == FETCH_BODY))
          {
            put_hash(current->hash, uidl->get(), flag, dateReceived);
          }
          else
          {
            NS_ASSERTION(false, "invalid flag in popstate.dat");
          }
        }
      }
    }
  }
  fileStream->Close();

  return result;
}

static int
hash_clear_mapper(PLHashEntry* he, int msgindex, void* arg)
{
  Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) he->value;
  PR_Free(uidlEntry->uidl);
  PR_Free(uidlEntry);
  he->value = nullptr;

  return HT_ENUMERATE_REMOVE;
}

static int
hash_empty_mapper(PLHashEntry* he, int msgindex, void* arg)
{
  *((bool*) arg) = false;
  return HT_ENUMERATE_STOP;
}

static bool
hash_empty(PLHashTable* hash)
{
  bool result = true;
  PL_HashTableEnumerateEntries(hash, hash_empty_mapper, (void *)&result);
  return result;
}


static int
net_pop3_write_mapper(PLHashEntry* he, int msgindex, void* arg)
{
  nsIOutputStream* file = (nsIOutputStream*) arg;
  Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) he->value;
  NS_ASSERTION((uidlEntry->status == KEEP) ||
    (uidlEntry->status == DELETE_CHAR) ||
    (uidlEntry->status == FETCH_BODY) ||
    (uidlEntry->status == TOO_BIG), "invalid status");
  char* tmpBuffer = PR_smprintf("%c %s %d" MSG_LINEBREAK, uidlEntry->status, (char*)
    uidlEntry->uidl, uidlEntry->dateReceived);
  PR_ASSERT(tmpBuffer);
  uint32_t numBytesWritten;
  file->Write(tmpBuffer, strlen(tmpBuffer), &numBytesWritten);
  PR_Free(tmpBuffer);
  return HT_ENUMERATE_NEXT;
}

static int
net_pop3_delete_old_msgs_mapper(PLHashEntry* he, int msgindex, void* arg)
{
  PRTime cutOffDate = (PRTime) arg;
  Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) he->value;
  if (uidlEntry->dateReceived < cutOffDate)
    uidlEntry->status = DELETE_CHAR; // mark for deletion
  return HT_ENUMERATE_NEXT;
}

static void
net_pop3_write_state(Pop3UidlHost* host, nsIFile *mailDirectory)
{
  int32_t len = 0;
  nsCOMPtr <nsIFile> popState;

  mailDirectory->Clone(getter_AddRefs(popState));
  if (!popState)
    return;
  popState->AppendNative(NS_LITERAL_CSTRING("popstate.dat"));

  nsCOMPtr<nsIOutputStream> fileOutputStream;
  nsresult rv = MsgNewBufferedFileOutputStream(getter_AddRefs(fileOutputStream), popState, -1, 00600);
  if (NS_FAILED(rv))
    return;

  const char tmpBuffer[] =
    "# POP3 State File" MSG_LINEBREAK
    "# This is a generated file!  Do not edit." MSG_LINEBREAK
    MSG_LINEBREAK;

  uint32_t numBytesWritten;
  fileOutputStream->Write(tmpBuffer, strlen(tmpBuffer), &numBytesWritten);

  for (; host && (len >= 0); host = host->next)
  {
    if (!hash_empty(host->hash))
    {
      fileOutputStream->Write("*", 1, &numBytesWritten);
      fileOutputStream->Write(host->host, strlen(host->host), &numBytesWritten);
      fileOutputStream->Write(" ", 1, &numBytesWritten);
      fileOutputStream->Write(host->user, strlen(host->user), &numBytesWritten);
      fileOutputStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &numBytesWritten);
      PL_HashTableEnumerateEntries(host->hash, net_pop3_write_mapper, (void *)fileOutputStream);
    }
  }
  fileOutputStream->Close();
}

static void
net_pop3_free_state(Pop3UidlHost* host)
{
  Pop3UidlHost* h;
  while (host)
  {
    h = host->next;
    PR_Free(host->host);
    PR_Free(host->user);
    PL_HashTableDestroy(host->hash);
    PR_Free(host);
    host = h;
  }
}

/*
Look for a specific UIDL string in our hash tables, if we have it then we need
to mark the message for deletion so that it can be deleted later. If the uidl of the
message is not found, then the message was downloaded completely and already deleted
from the server. So this only applies to messages kept on the server or too big
for download. */
/* static */
void nsPop3Protocol::MarkMsgInHashTable(PLHashTable *hashTable, const Pop3UidlEntry *uidlE, bool *changed)
{
  if (uidlE->uidl)
  {
    Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) PL_HashTableLookup(hashTable, uidlE->uidl);
    if (uidlEntry)
    {
      if (uidlEntry->status != uidlE->status)
      {
        uidlEntry->status = uidlE->status;
        *changed = true;
      }
    }
  }
}

/* static */
nsresult
nsPop3Protocol::MarkMsgForHost(const char *hostName, const char *userName,
                                      nsIFile *mailDirectory,
                                       nsVoidArray &UIDLArray)
{
  if (!hostName || !userName || !mailDirectory)
    return NS_ERROR_NULL_POINTER;

  Pop3UidlHost *uidlHost = net_pop3_load_state(hostName, userName, mailDirectory);
  if (!uidlHost)
    return NS_ERROR_OUT_OF_MEMORY;

  bool changed = false;

  uint32_t count = UIDLArray.Count();
  for (uint32_t i = 0; i < count; i++)
  {
    MarkMsgInHashTable(uidlHost->hash,
      static_cast<Pop3UidlEntry*>(UIDLArray[i]), &changed);
  }

  if (changed)
    net_pop3_write_state(uidlHost, mailDirectory);
  net_pop3_free_state(uidlHost);
  return NS_OK;
}



NS_IMPL_ADDREF_INHERITED(nsPop3Protocol, nsMsgProtocol)
NS_IMPL_RELEASE_INHERITED(nsPop3Protocol, nsMsgProtocol)



NS_INTERFACE_MAP_BEGIN(nsPop3Protocol)
  NS_INTERFACE_MAP_ENTRY(nsIPop3Protocol)
  NS_INTERFACE_MAP_ENTRY(nsIMsgAsyncPromptListener)
NS_INTERFACE_MAP_END_INHERITING(nsMsgProtocol)

// nsPop3Protocol class implementation

nsPop3Protocol::nsPop3Protocol(nsIURI* aURL)
: nsMsgProtocol(aURL),
  m_bytesInMsgReceived(0),
  m_totalFolderSize(0),
  m_totalDownloadSize(0),
  m_totalBytesReceived(0),
  m_lineStreamBuffer(nullptr),
  m_pop3ConData(nullptr)
{
}

nsresult nsPop3Protocol::Initialize(nsIURI * aURL)
{
  nsresult rv = NS_OK;
  if (!POP3LOGMODULE)
    POP3LOGMODULE = PR_NewLogModule("POP3");

  m_pop3ConData = (Pop3ConData *)PR_NEWZAP(Pop3ConData);
  if(!m_pop3ConData)
    return NS_ERROR_OUT_OF_MEMORY;

  m_totalBytesReceived = 0;
  m_bytesInMsgReceived = 0;
  m_totalFolderSize = 0;
  m_totalDownloadSize = 0;
  m_totalBytesReceived = 0;
  m_tlsEnabled = false;
  m_socketType = nsMsgSocketType::trySTARTTLS;
  m_prefAuthMethods = POP3_AUTH_MECH_UNDEFINED;
  m_failedAuthMethods = 0;
  m_password_already_sent = false;
  m_currentAuthMethod = POP3_AUTH_MECH_UNDEFINED;
  m_needToRerunUrl = false;

  if (aURL)
  {
    // extract out message feedback if there is any.
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aURL);
    if (mailnewsUrl)
    {
      nsCOMPtr<nsIMsgIncomingServer> server;
      mailnewsUrl->GetStatusFeedback(getter_AddRefs(m_statusFeedback));
      mailnewsUrl->GetServer(getter_AddRefs(server));
      NS_ENSURE_TRUE(server, NS_MSG_INVALID_OR_MISSING_SERVER);

      rv = server->GetSocketType(&m_socketType);
      NS_ENSURE_SUCCESS(rv,rv);

      int32_t authMethod = 0;
      rv = server->GetAuthMethod(&authMethod);
      NS_ENSURE_SUCCESS(rv,rv);
      InitPrefAuthMethods(authMethod);

      m_pop3Server = do_QueryInterface(server);
      if (m_pop3Server)
        m_pop3Server->GetPop3CapabilityFlags(&m_pop3ConData->capability_flags);
    }

    m_url = do_QueryInterface(aURL);

    // When we are making a secure connection, we need to make sure that we
    // pass an interface requestor down to the socket transport so that PSM can
    // retrieve a nsIPrompt instance if needed.
    nsCOMPtr<nsIInterfaceRequestor> ir;
    if (m_socketType != nsMsgSocketType::plain)
    {
      nsCOMPtr<nsIMsgWindow> msgwin;
      mailnewsUrl->GetMsgWindow(getter_AddRefs(msgwin));
      if (!msgwin)
        GetTopmostMsgWindow(getter_AddRefs(msgwin));
      if (msgwin)
      {
        nsCOMPtr<nsIDocShell> docshell;
        msgwin->GetRootDocShell(getter_AddRefs(docshell));
        ir = do_QueryInterface(docshell);
        nsCOMPtr<nsIInterfaceRequestor> notificationCallbacks;
        msgwin->GetNotificationCallbacks(getter_AddRefs(notificationCallbacks));
        if (notificationCallbacks)
        {
          nsCOMPtr<nsIInterfaceRequestor> aggregrateIR;
          MsgNewInterfaceRequestorAggregation(notificationCallbacks, ir, getter_AddRefs(aggregrateIR));
          ir = aggregrateIR;
        }
      }
    }

    int32_t port = 0;
    nsCString hostName;
    aURL->GetPort(&port);
    nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server);
    if (server)
      server->GetRealHostName(hostName);

    nsCOMPtr<nsIProxyInfo> proxyInfo;
    rv = MsgExamineForProxy("pop", hostName.get(), port, getter_AddRefs(proxyInfo));
    if (NS_FAILED(rv)) proxyInfo = nullptr;

    const char *connectionType = nullptr;
    if (m_socketType == nsMsgSocketType::SSL)
      connectionType = "ssl";
    else if (m_socketType == nsMsgSocketType::trySTARTTLS ||
          m_socketType == nsMsgSocketType::alwaysSTARTTLS)
        connectionType = "starttls";

    rv = OpenNetworkSocketWithInfo(hostName.get(), port, connectionType, proxyInfo, ir);
    if (NS_FAILED(rv) && m_socketType == nsMsgSocketType::trySTARTTLS)
    {
      m_socketType = nsMsgSocketType::plain;
      rv = OpenNetworkSocketWithInfo(hostName.get(), port, nullptr, proxyInfo, ir);
    }

    if(NS_FAILED(rv))
      return rv;
  } // if we got a url...

  m_lineStreamBuffer = new nsMsgLineStreamBuffer(OUTPUT_BUFFER_SIZE, true);
  if(!m_lineStreamBuffer)
    return NS_ERROR_OUT_OF_MEMORY;

  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
  return bundleService->CreateBundle("chrome://messenger/locale/localMsgs.properties", getter_AddRefs(mLocalBundle));
}

nsPop3Protocol::~nsPop3Protocol()
{
  Cleanup();
  PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("~nsPop3Protocol()"));
}

void nsPop3Protocol::Cleanup()
{
  if (m_pop3ConData->newuidl)
  {
    PL_HashTableDestroy(m_pop3ConData->newuidl);
    m_pop3ConData->newuidl = nullptr;
  }

  net_pop3_free_state(m_pop3ConData->uidlinfo);

  FreeMsgInfo();
  PR_Free(m_pop3ConData->only_uidl);
  PR_Free(m_pop3ConData);

  delete m_lineStreamBuffer;
  m_lineStreamBuffer = nullptr;
}

void nsPop3Protocol::SetCapFlag(uint32_t flag)
{
    m_pop3ConData->capability_flags |= flag;
}

void nsPop3Protocol::ClearCapFlag(uint32_t flag)
{
    m_pop3ConData->capability_flags &= ~flag;
}

bool nsPop3Protocol::TestCapFlag(uint32_t flag)
{
    return m_pop3ConData->capability_flags & flag;
}

uint32_t nsPop3Protocol::GetCapFlags()
{
    return m_pop3ConData->capability_flags;
}

nsresult nsPop3Protocol::FormatCounterString(const nsString &stringName,
                                             uint32_t count1,
                                             uint32_t count2,
                                             nsString &resultString)
{
  nsAutoString count1String;
  count1String.AppendInt(count1);

  nsAutoString count2String;
  count2String.AppendInt(count2);

  nsCOMPtr<nsIMsgIncomingServer> server(do_QueryInterface(m_pop3Server));
  nsString hostName;
  server->GetPrettyName(hostName);
  const PRUnichar *formatStrings[] = {
    count1String.get(),
    count2String.get(),
    hostName.get()
  };

  return mLocalBundle->FormatStringFromName(stringName.get(),
                                            formatStrings, 3,
                                            getter_Copies(resultString));
}

void nsPop3Protocol::UpdateStatus(const nsString &aStatusName)
{
  if (m_statusFeedback)
  {
    nsCOMPtr<nsIMsgIncomingServer> server(do_QueryInterface(m_pop3Server));
    nsString hostName;
    server->GetPrettyName(hostName);
    const PRUnichar *formatStrings[] = {
      hostName.get()
    };
    nsString statusString;
    mLocalBundle->FormatStringFromName(aStatusName.get(), formatStrings, 1,
                                       getter_Copies(statusString));
    UpdateStatusWithString(statusString.get());
  }
}

void nsPop3Protocol::UpdateStatusWithString(const PRUnichar * aStatusString)
{
    nsresult rv;
    if (mProgressEventSink)
    {
        rv = mProgressEventSink->OnStatus(this, m_channelContext, NS_OK, aStatusString);      // XXX i18n message
        NS_ASSERTION(NS_SUCCEEDED(rv), "dropping error result");
    }
}

void nsPop3Protocol::UpdateProgressPercent (uint32_t totalDone, uint32_t total)
{
  // XXX 64-bit
  if (mProgressEventSink)
    mProgressEventSink->OnProgress(this, m_channelContext, uint64_t(totalDone), uint64_t(total));
}

// note:  SetUsername() expects an unescaped string
// do not pass in an escaped string
void nsPop3Protocol::SetUsername(const char* name)
{
  NS_ASSERTION(name, "no name specified!");
    if (name)
      m_username = name;
}

nsresult nsPop3Protocol::RerunUrl()
{
  nsCOMPtr<nsIURI> url = do_QueryInterface(m_url);
  ClearFlag(POP3_PASSWORD_FAILED);
  m_pop3Server->SetRunningProtocol(nullptr);
  Cleanup();
  return LoadUrl(url, nullptr);
}

Pop3StatesEnum nsPop3Protocol::GetNextPasswordObtainState()
{
  switch (m_pop3ConData->next_state)
  {
  case POP3_OBTAIN_PASSWORD_EARLY:
    return POP3_FINISH_OBTAIN_PASSWORD_EARLY;
  case POP3_SEND_USERNAME:
  case POP3_OBTAIN_PASSWORD_BEFORE_USERNAME:
    return POP3_FINISH_OBTAIN_PASSWORD_BEFORE_USERNAME;
  case POP3_SEND_PASSWORD:
  case POP3_OBTAIN_PASSWORD_BEFORE_PASSWORD:
    return POP3_FINISH_OBTAIN_PASSWORD_BEFORE_PASSWORD;
  default:
    // Should never get here.
    NS_NOTREACHED("Invalid next_state in GetNextPasswordObtainState");
  }
  return POP3_ERROR_DONE;
}

nsresult nsPop3Protocol::StartGetAsyncPassword(Pop3StatesEnum aNextState)
{
  nsresult rv;

  // Try and avoid going async if possible - if we haven't got into a password
  // failure state and the server has a password stored for this session, then
  // use it.
  if (!TestFlag(POP3_PASSWORD_FAILED))
  {
    nsCOMPtr<nsIMsgIncomingServer> server =
      do_QueryInterface(m_pop3Server, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = server->GetPassword(m_passwordResult);
    if (NS_SUCCEEDED(rv) && !m_passwordResult.IsEmpty())
    {
      m_pop3ConData->next_state = GetNextPasswordObtainState();
      return NS_OK;
    }
  }

  // We're now going to need to do something that will end up with us either
  // poking the login manger or prompting the user. We need to ensure we only
  // do one prompt at a time (and loging manager could cause a master password
  // prompt), so we need to use the async prompter.
  nsCOMPtr<nsIMsgAsyncPrompter> asyncPrompter =
    do_GetService(NS_MSGASYNCPROMPTER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  m_pop3ConData->next_state = aNextState;

  // Although we're not actually pausing for a read, we'll do so anyway to let
  // the async prompt run. Once it is our turn again we'll call back into
  // ProcessProtocolState.
  m_pop3ConData->pause_for_read = true;

  nsCString server("unknown");
  m_url->GetPrePath(server);

  rv = asyncPrompter->QueueAsyncAuthPrompt(server, false, this);
  // Explict NS_ENSURE_SUCCESS for debug purposes as errors tend to get
  // hidden.
  NS_ENSURE_SUCCESS(rv, rv);
  return rv;
}

NS_IMETHODIMP nsPop3Protocol::OnPromptStart(bool *aResult)
{
  PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("OnPromptStart()"));

  *aResult = false;

  nsresult rv;
  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString passwordResult;

  // pass the failed password into the password prompt so that
  // it will be pre-filled, in case it failed because of a
  // server problem and not because it was wrong.
  if (!m_lastPasswordSent.IsEmpty())
    passwordResult = m_lastPasswordSent;

  // Set up some items that we're going to need for the prompting.
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url, &rv);
  nsCOMPtr<nsIMsgWindow> msgWindow;
  if (mailnewsUrl)
    mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow));

  nsCString userName;
  server->GetRealUsername(userName);

  nsCString hostName;
  server->GetRealHostName(hostName);

  nsString passwordPrompt;
  NS_ConvertUTF8toUTF16 userNameUTF16(userName);
  NS_ConvertUTF8toUTF16 hostNameUTF16(hostName);
  const PRUnichar* passwordParams[] = { userNameUTF16.get(),
                                        hostNameUTF16.get() };

  // if the last prompt got us a bad password then show a special dialog
  if (TestFlag(POP3_PASSWORD_FAILED))
  {
    // Biff case (no msgWindow) shouldn't cause prompts or passwords to get forgotten at all
    // TODO shouldn't we skip the new password prompt below as well for biff? Just exit here?
    if (msgWindow)
    {
      PR_LOG(POP3LOGMODULE, PR_LOG_WARN,
          ("POP: ask user what to do (after password failed): new password, retry or cancel"));

      int32_t buttonPressed = 0;
      if (NS_SUCCEEDED(MsgPromptLoginFailed(msgWindow, hostName,
                                            &buttonPressed)))
      {
        if (buttonPressed == 1) // Cancel button
        {
          PR_LOG(POP3LOGMODULE, PR_LOG_WARN, ("cancel button pressed"));
          // Abort quickly and stop trying for now.

          // If we haven't actually connected yet (i.e. we're doing an early
          // attempt to get the username/password but we've previously failed
          // for some reason), then skip straight to POP3_FREE as it isn't an
          // error in this connection, and just ends up with us closing the
          // socket and saying we've aborted the bind. Otherwise, pretend this
          // is an error and move on.
          m_pop3ConData->next_state =
            m_pop3ConData->next_state == POP3_OBTAIN_PASSWORD_EARLY ?
                                         POP3_FREE : POP3_ERROR_DONE;

          // Clear the password we're going to return to force failure in
          // the get mail instance.
          passwordResult.Truncate();

          // We also have to clear the password failed flag, otherwise we'll
          // automatically try again.
          ClearFlag(POP3_PASSWORD_FAILED);

          // As we're async, calling ProcessProtocolState gets things going
          // again.
          ProcessProtocolState(nullptr, nullptr, 0, 0);
          return NS_OK;
        }
        else if (buttonPressed == 2) // "New password" button
        {
          PR_LOG(POP3LOGMODULE, PR_LOG_WARN, ("new password button pressed"));
          // Forget the stored password
          // and we'll prompt for a new one next time around.
          rv = server->ForgetPassword();
          NS_ENSURE_SUCCESS(rv, rv);

          // try all methods again with new password
          ResetAuthMethods();
          // ... apart from GSSAPI, which doesn't care about passwords
          MarkAuthMethodAsFailed(POP3_HAS_AUTH_GSSAPI);
          if (m_needToRerunUrl)
            return RerunUrl();
        }
        else if (buttonPressed == 0) // "Retry" button
        {
          PR_LOG(POP3LOGMODULE, PR_LOG_WARN, ("retry button pressed"));
          // try all methods again, including GSSAPI
          ResetAuthMethods();
          ClearFlag(POP3_PASSWORD_FAILED|POP3_AUTH_FAILURE);

          if (m_needToRerunUrl)
            return RerunUrl();

          // It is a bit strange that we're going onto the next state that 
          // would essentially send the password. However in resetting the
          // auth methods above, we're setting up SendUsername, SendPassword
          // and friends to abort and return to the POP3_SEND_CAPA state.
          // Hence we can do this safely.
          m_pop3ConData->next_state = GetNextPasswordObtainState();
          // As we're async, calling ProcessProtocolState gets things going
          // again.
          ProcessProtocolState(nullptr, nullptr, 0, 0);
          return NS_OK;
        }
      }
    }
    mLocalBundle->FormatStringFromName(
      NS_LITERAL_STRING("pop3PreviouslyEnteredPasswordIsInvalidPrompt").get(),
      passwordParams, 2, getter_Copies(passwordPrompt));
  }
  else
    // Otherwise this is the first time we've asked about the server's
    // password so show a first time prompt.
    mLocalBundle->FormatStringFromName(
      NS_LITERAL_STRING("pop3EnterPasswordPrompt").get(),
      passwordParams, 2, getter_Copies(passwordPrompt));

  nsString passwordTitle;
  mLocalBundle->GetStringFromName(
    NS_LITERAL_STRING("pop3EnterPasswordPromptTitle").get(),
    getter_Copies(passwordTitle));

  // Now go and get the password.
  if (!passwordPrompt.IsEmpty() && !passwordTitle.IsEmpty())
    rv = server->GetPasswordWithUI(passwordPrompt, passwordTitle,
                                    msgWindow, passwordResult);
  ClearFlag(POP3_PASSWORD_FAILED|POP3_AUTH_FAILURE);

  // If it failed or the user cancelled the prompt, just abort the
  // connection.
  if (NS_FAILED(rv) ||
      rv == NS_MSG_PASSWORD_PROMPT_CANCELLED)
  {
    m_pop3ConData->next_state = POP3_ERROR_DONE;
    m_passwordResult.Truncate();
    *aResult = false;
  }
  else
  {
    m_passwordResult = passwordResult;
    m_pop3ConData->next_state = GetNextPasswordObtainState();
    *aResult = true;
  }
  // Because this was done asynchronously, now call back into
  // ProcessProtocolState to get the protocol going again.
  ProcessProtocolState(nullptr, nullptr, 0, 0);
  return NS_OK;
}

NS_IMETHODIMP nsPop3Protocol::OnPromptAuthAvailable()
{
  NS_NOTREACHED("Did not expect to get POP3 protocol queuing up auth "
                "connections for same server");
  return NS_OK;
}

NS_IMETHODIMP nsPop3Protocol::OnPromptCanceled()
{
  // A prompt was cancelled, so just abort out the connection
  m_pop3ConData->next_state = POP3_ERROR_DONE;
  // As we're async, calling ProcessProtocolState gets things going again.
  ProcessProtocolState(nullptr, nullptr, 0, 0);
  return NS_OK;
}

NS_IMETHODIMP nsPop3Protocol::OnTransportStatus(nsITransport *aTransport, nsresult aStatus, uint64_t aProgress, uint64_t aProgressMax)
{
  return nsMsgProtocol::OnTransportStatus(aTransport, aStatus, aProgress, aProgressMax);
}

// stop binding is a "notification" informing us that the stream associated with aURL is going away.
NS_IMETHODIMP nsPop3Protocol::OnStopRequest(nsIRequest *aRequest, nsISupports * aContext, nsresult aStatus)
{
  // If the server dropped the connection, m_socketIsOpen will be true, before
  // we call nsMsgProtocol::OnStopRequest. The call will force a close socket,
  // but we still want to go through the state machine one more time to cleanup
  // the protocol object.
  if (m_socketIsOpen)
  {
    // Check if the connection was dropped before getting back an auth error.
    // If we got the auth error, the next state would be
    // POP3_OBTAIN_PASSWORD_EARLY.
    if ((m_pop3ConData->next_state_after_response == POP3_NEXT_AUTH_STEP ||
         m_pop3ConData->next_state_after_response == POP3_AUTH_LOGIN_RESPONSE) &&
        m_pop3ConData->next_state != POP3_OBTAIN_PASSWORD_EARLY)
    {
      PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("dropped connection before auth error"));
      SetFlag(POP3_AUTH_FAILURE);
      m_pop3ConData->command_succeeded = false;
      m_needToRerunUrl = true;
      m_pop3ConData->next_state = POP3_NEXT_AUTH_STEP;
      ProcessProtocolState(nullptr, nullptr, 0, 0);
    }
    // We can't call nsMsgProtocol::OnStopRequest because it calls SetUrlState,
    // which notifies the URLListeners, but we need to do a bit of cleanup
    // before running the url again.
    CloseSocket();
    if (m_loadGroup)
      m_loadGroup->RemoveRequest(static_cast<nsIRequest *>(this), nullptr, aStatus);
    m_pop3ConData->next_state = POP3_ERROR_DONE;
    ProcessProtocolState(nullptr, nullptr, 0, 0);
    return NS_OK;
  }
  nsresult rv = nsMsgProtocol::OnStopRequest(aRequest, aContext, aStatus);

  // turn off the server busy flag on stop request - we know we're done, right?
  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server);
  if (server)
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("Clearing server busy in OnStopRequest"));
    server->SetServerBusy(false); // the server is not busy
  }
  if(m_pop3ConData->list_done)
    CommitState(true);
  if (NS_FAILED(aStatus) && aStatus != NS_BINDING_ABORTED)
    Abort();
  return rv;
}

void nsPop3Protocol::Abort()
{
  if(m_pop3ConData->msg_closure)
  {
      m_nsIPop3Sink->IncorporateAbort(m_pop3ConData->only_uidl != nullptr);
      m_pop3ConData->msg_closure = nullptr;
  }
  // need this to close the stream on the inbox.
  m_nsIPop3Sink->AbortMailDelivery(this);
  PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("Clearing running protocol in nsPop3Protocol::Abort"));
  m_pop3Server->SetRunningProtocol(nullptr);
}

NS_IMETHODIMP nsPop3Protocol::Cancel(nsresult status)  // handle stop button
{
  Abort();
  return nsMsgProtocol::Cancel(NS_BINDING_ABORTED);
}


nsresult nsPop3Protocol::LoadUrl(nsIURI* aURL, nsISupports * /* aConsumer */)
{
  nsresult rv = Initialize(aURL);
  NS_ENSURE_SUCCESS(rv, rv);
  if (aURL)
    m_url = do_QueryInterface(aURL);
  else
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIURL> url = do_QueryInterface(aURL, &rv);
  if (NS_FAILED(rv)) return rv;

  int32_t port;
  rv = url->GetPort(&port);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = NS_CheckPortSafety(port, "pop");
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString queryPart;
  rv = url->GetQuery(queryPart);
  NS_ASSERTION(NS_SUCCEEDED(rv), "unable to get the url spect");

  m_pop3ConData->only_check_for_new_mail = (PL_strcasestr(queryPart.get(), "check") != nullptr);
  m_pop3ConData->verify_logon = (PL_strcasestr(queryPart.get(), "verifyLogon") != nullptr);
  m_pop3ConData->get_url = (PL_strcasestr(queryPart.get(), "gurl") != nullptr);

  bool deleteByAgeFromServer = false;
  int32_t numDaysToLeaveOnServer = -1;
  if (!m_pop3ConData->verify_logon)
  {
    // Pick up pref setting regarding leave messages on server, message size limit

    m_pop3Server->GetLeaveMessagesOnServer(&m_pop3ConData->leave_on_server);
    m_pop3Server->GetHeadersOnly(&m_pop3ConData->headers_only);
    bool limitMessageSize = false;

    nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server);
    if (server)
    {
      // size limits are superseded by headers_only mode
      if (!m_pop3ConData->headers_only)
      {
        server->GetLimitOfflineMessageSize(&limitMessageSize);
        if (limitMessageSize)
        {
          int32_t max_size = 0; // default size
          server->GetMaxMessageSize(&max_size);
          m_pop3ConData->size_limit = (max_size) ? max_size * 1024 : 50 * 1024;
       }
      }
      m_pop3Server->GetDeleteByAgeFromServer(&deleteByAgeFromServer);
      if (deleteByAgeFromServer)
        m_pop3Server->GetNumDaysToLeaveOnServer(&numDaysToLeaveOnServer);
    }
  }

  // UIDL stuff
  nsCOMPtr<nsIPop3URL> pop3Url = do_QueryInterface(m_url);
  if (pop3Url)
    pop3Url->GetPop3Sink(getter_AddRefs(m_nsIPop3Sink));

  nsCOMPtr<nsIFile> mailDirectory;

  nsCString hostName;
  nsCString userName;

  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server);
  if (server)
  {
    rv = server->GetLocalPath(getter_AddRefs(mailDirectory));
    NS_ENSURE_SUCCESS(rv, rv);
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("Setting server busy in nsPop3Protocol::LoadUrl"));
    server->SetServerBusy(true); // the server is now busy
    server->GetHostName(hostName);
    server->GetUsername(userName);
  }

  if (!m_pop3ConData->verify_logon)
    m_pop3ConData->uidlinfo = net_pop3_load_state(hostName.get(), userName.get(), mailDirectory);

  m_pop3ConData->biffstate = nsIMsgFolder::nsMsgBiffState_NoMail;

  if (m_pop3ConData->uidlinfo && numDaysToLeaveOnServer > 0)
  {
    uint32_t nowInSeconds = TimeInSecondsFromPRTime(PR_Now());
    uint32_t cutOffDay = nowInSeconds - (60 * 60 * 24 * numDaysToLeaveOnServer);

    PL_HashTableEnumerateEntries(m_pop3ConData->uidlinfo->hash, net_pop3_delete_old_msgs_mapper, (void *) cutOffDay);
  }
  const char* uidl = PL_strcasestr(queryPart.get(), "uidl=");
  PR_FREEIF(m_pop3ConData->only_uidl);

  if (uidl)
  {
    uidl += 5;
    nsCString unescapedData;
    MsgUnescapeString(nsDependentCString(uidl), 0, unescapedData);
    m_pop3ConData->only_uidl = PL_strdup(unescapedData.get());

    mSuppressListenerNotifications = true; // suppress on start and on stop because this url won't have any content to display
  }

  m_pop3ConData->next_state = POP3_START_CONNECT;
  m_pop3ConData->next_state_after_response = POP3_FINISH_CONNECT;
  if (NS_SUCCEEDED(rv))
  {
    m_pop3Server->SetRunningProtocol(this);
    return nsMsgProtocol::LoadUrl(aURL);
  }
  else
    return rv;
}

void
nsPop3Protocol::FreeMsgInfo()
{
  int i;
  if (m_pop3ConData->msg_info)
  {
    for (i=0 ; i<m_pop3ConData->number_of_messages ; i++)
    {
      if (m_pop3ConData->msg_info[i].uidl)
        PR_Free(m_pop3ConData->msg_info[i].uidl);
      m_pop3ConData->msg_info[i].uidl = nullptr;
    }
    PR_Free(m_pop3ConData->msg_info);
    m_pop3ConData->msg_info = nullptr;
  }
}

int32_t
nsPop3Protocol::WaitForStartOfConnectionResponse(nsIInputStream* aInputStream,
                                                 uint32_t length)
{
  char * line = nullptr;
  uint32_t line_length = 0;
  bool pauseForMoreData = false;
  nsresult rv;
  line = m_lineStreamBuffer->ReadNextLine(aInputStream, line_length, pauseForMoreData, &rv);

  PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));
  if (NS_FAILED(rv))
    return -1;

  if(pauseForMoreData || !line)
  {
    m_pop3ConData->pause_for_read = true; /* pause */
    PR_Free(line);
    return(line_length);
  }

  if(*line == '+')
  {
    m_pop3ConData->command_succeeded = true;
    if(PL_strlen(line) > 4)
      m_commandResponse = line + 4;
    else
      m_commandResponse = line;

    if (m_prefAuthMethods & POP3_HAS_AUTH_APOP)
    {
      if (NS_SUCCEEDED(GetApopTimestamp()))
        SetCapFlag(POP3_HAS_AUTH_APOP);
    }
    else
      ClearCapFlag(POP3_HAS_AUTH_APOP);

    m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);

    m_pop3ConData->next_state = POP3_PROCESS_AUTH;
    m_pop3ConData->pause_for_read = false; /* don't pause */
  }

  PR_Free(line);
  return(1);  /* everything ok */
}

int32_t
nsPop3Protocol::WaitForResponse(nsIInputStream* inputStream, uint32_t length)
{
  char * line;
  uint32_t ln = 0;
  bool pauseForMoreData = false;
  nsresult rv;
  line = m_lineStreamBuffer->ReadNextLine(inputStream, ln, pauseForMoreData, &rv);
  if (NS_FAILED(rv))
    return -1;

  if(pauseForMoreData || !line)
  {
    m_pop3ConData->pause_for_read = true; /* pause */

    PR_Free(line);
    return(ln);
  }

  PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));

  if(*line == '+')
  {
    m_pop3ConData->command_succeeded = true;
    if(PL_strlen(line) > 4)
    {
      if(!PL_strncasecmp(line, "+OK", 3))
        m_commandResponse = line + 4;
      else  // challenge answer to AUTH CRAM-MD5 and LOGIN username/password
        m_commandResponse = line + 2;
    }
    else
      m_commandResponse = line;
  }
  else
  {
    m_pop3ConData->command_succeeded = false;
    if(PL_strlen(line) > 5)
      m_commandResponse = line + 5;
    else
      m_commandResponse  = line;

    // search for the response codes (RFC 2449, chapter 8 and RFC 3206)
    if(TestCapFlag(POP3_HAS_RESP_CODES | POP3_HAS_AUTH_RESP_CODE))
    {
        // code for authentication failure due to the user's credentials
        if(m_commandResponse.Find("[AUTH", true) >= 0)
        {
          PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("setting auth failure"));
          SetFlag(POP3_AUTH_FAILURE);
        }

        // codes for failures due to other reasons
        if(m_commandResponse.Find("[LOGIN-DELAY", true) >= 0 ||
           m_commandResponse.Find("[IN-USE", true) >= 0 ||
           m_commandResponse.Find("[SYS", true) >= 0)
      SetFlag(POP3_STOPLOGIN);

      // remove the codes from the response string presented to the user
      int32_t i = m_commandResponse.FindChar(']');
      if(i >= 0)
        m_commandResponse.Cut(0, i + 2);
    }
  }

  m_pop3ConData->next_state = m_pop3ConData->next_state_after_response;
  m_pop3ConData->pause_for_read = false; /* don't pause */

  PR_Free(line);
  return(1);  /* everything ok */
}

int32_t
nsPop3Protocol::Error(int32_t err_code)
{
    PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS, ("ERROR: %d", err_code));

    // the error code is just the resource id for the error string...
    // so print out that error message!
    nsresult rv = NS_OK;
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url, &rv);
    // we handle POP3_TMP_DOWNLOAD_FAILED earlier...
    if (err_code != POP3_TMP_DOWNLOAD_FAILED && NS_SUCCEEDED(rv))
    {
        nsCOMPtr<nsIMsgWindow> msgWindow;
        nsCOMPtr<nsIPrompt> dialog;
        rv = mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow)); //it is ok to have null msgWindow, for example when biffing
        if (NS_SUCCEEDED(rv) && msgWindow)
        {
            rv = msgWindow->GetPromptDialog(getter_AddRefs(dialog));
            if (NS_SUCCEEDED(rv))
            {
              nsString alertString;
              mLocalBundle->GetStringFromID(err_code, getter_Copies(alertString));
              if (m_pop3ConData->command_succeeded)  //not a server error message
                dialog->Alert(nullptr, alertString.get());
              else
              {
                nsString serverSaidPrefix;
                nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server);
                nsCString hostName;
                // Fomat string with hostname.
                if (server)
                  rv = server->GetRealHostName(hostName);
                if (NS_SUCCEEDED(rv))
                {
                  nsAutoString hostStr;
                  CopyASCIItoUTF16(hostName, hostStr);
                  const PRUnichar *params[] = { hostStr.get() };
                  mLocalBundle->FormatStringFromID(POP3_SERVER_SAID, params, 1, getter_Copies(serverSaidPrefix));
                }

                nsAutoString message(alertString);
                message.AppendLiteral(" ");
                message.Append(serverSaidPrefix);
                message.AppendLiteral(" ");
                message.Append(NS_ConvertASCIItoUTF16(m_commandResponse));
                dialog->Alert(nullptr,message.get());
              }
            }
        }
    }
    m_pop3ConData->next_state = POP3_ERROR_DONE;
    m_pop3ConData->pause_for_read = false;
    return -1;
}

int32_t nsPop3Protocol::Pop3SendData(const char * dataBuffer, bool aSuppressLogging)
{
  // remove any leftover bytes in the line buffer
  // this can happen if the last message line doesn't end with a (CR)LF
  // or a server sent two reply lines
  m_lineStreamBuffer->ClearBuffer();

  nsresult result = nsMsgProtocol::SendData(dataBuffer);

  if (!aSuppressLogging)
      PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS, ("SEND: %s", dataBuffer));
  else
      PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS, ("Logging suppressed for this command (it probably contained authentication information)"));

  if (NS_SUCCEEDED(result))
  {
    m_pop3ConData->pause_for_read = true;
    m_pop3ConData->next_state = POP3_WAIT_FOR_RESPONSE;
    return 0;
  }

  m_pop3ConData->next_state = POP3_ERROR_DONE;
  PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS, ("Pop3SendData failed: %lx", result));
  return -1;
}

/*
 * POP3 AUTH extension
 */

int32_t nsPop3Protocol::SendAuth()
{
  if(!m_pop3ConData->command_succeeded)
    return(Error(POP3_SERVER_ERROR));

  nsAutoCString command("AUTH" CRLF);

  m_pop3ConData->next_state_after_response = POP3_AUTH_RESPONSE;
  return Pop3SendData(command.get());
}

int32_t nsPop3Protocol::AuthResponse(nsIInputStream* inputStream,
                             uint32_t length)
{
    char * line;
    uint32_t ln = 0;
    nsresult rv;

    if (TestCapFlag(POP3_AUTH_MECH_UNDEFINED))
    {
        ClearCapFlag(POP3_AUTH_MECH_UNDEFINED);
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }

    if (!m_pop3ConData->command_succeeded)
    {
        /* AUTH command not implemented
         * so no secure mechanisms available
         */
        m_pop3ConData->command_succeeded = true;
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
        m_pop3ConData->next_state = POP3_SEND_CAPA;
        return 0;
    }

    bool pauseForMoreData = false;
    line = m_lineStreamBuffer->ReadNextLine(inputStream, ln, pauseForMoreData, &rv);
    if (NS_FAILED(rv))
      return -1;

    if(pauseForMoreData || !line)
    {
        m_pop3ConData->pause_for_read = true; /* pause */
        PR_Free(line);
        return(0);
    }

    PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));

    if (!PL_strcmp(line, "."))
    {
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);

        // now that we've read all the AUTH responses, go for it
        m_pop3ConData->next_state = POP3_SEND_CAPA;
        m_pop3ConData->pause_for_read = false; /* don't pause */
    }
    else if (!PL_strcasecmp (line, "CRAM-MD5"))
      SetCapFlag(POP3_HAS_AUTH_CRAM_MD5);
    else if (!PL_strcasecmp (line, "NTLM"))
      SetCapFlag(POP3_HAS_AUTH_NTLM);
    else if (!PL_strcasecmp (line, "MSN"))
      SetCapFlag(POP3_HAS_AUTH_NTLM|POP3_HAS_AUTH_MSN);
    else if (!PL_strcasecmp (line, "GSSAPI"))
        SetCapFlag(POP3_HAS_AUTH_GSSAPI);
    else if (!PL_strcasecmp (line, "PLAIN"))
        SetCapFlag(POP3_HAS_AUTH_PLAIN);
    else if (!PL_strcasecmp (line, "LOGIN"))
        SetCapFlag(POP3_HAS_AUTH_LOGIN);

    PR_Free(line);
    return 0;
}

/*
 * POP3 CAPA extension, see RFC 2449, chapter 5
 */

int32_t nsPop3Protocol::SendCapa()
{
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("SendCapa()"));
    if(!m_pop3ConData->command_succeeded)
        return(Error(POP3_SERVER_ERROR));

    nsAutoCString command("CAPA" CRLF);

    m_pop3ConData->next_state_after_response = POP3_CAPA_RESPONSE;
    return Pop3SendData(command.get());
}

int32_t nsPop3Protocol::CapaResponse(nsIInputStream* inputStream,
                             uint32_t length)
{
    char * line;
    uint32_t ln = 0;

    if (!m_pop3ConData->command_succeeded)
    {
        /* CAPA command not implemented */
        m_pop3ConData->command_succeeded = true;
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
        m_pop3ConData->next_state = POP3_PROCESS_AUTH;
        return 0;
    }

    bool pauseForMoreData = false;
    nsresult rv;
    line = m_lineStreamBuffer->ReadNextLine(inputStream, ln, pauseForMoreData, &rv);
    if (NS_FAILED(rv))
      return -1;

    if(pauseForMoreData || !line)
    {
        m_pop3ConData->pause_for_read = true; /* pause */
        PR_Free(line);
        return(0);
    }

    PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));

    if (!PL_strcmp(line, "."))
    {
        // now that we've read all the CAPA responses, go for it
        m_pop3ConData->next_state = POP3_PROCESS_AUTH;
        m_pop3ConData->pause_for_read = false; /* don't pause */
    }
    else
    if (!PL_strcasecmp(line, "XSENDER"))
    {
        SetCapFlag(POP3_HAS_XSENDER);
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }
    else
    // see RFC 2449, chapter 6.4
    if (!PL_strcasecmp(line, "RESP-CODES"))
    {
        SetCapFlag(POP3_HAS_RESP_CODES);
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }
    else
    // see RFC 3206, chapter 6
    if (!PL_strcasecmp(line, "AUTH-RESP-CODE"))
    {
        SetCapFlag(POP3_HAS_AUTH_RESP_CODE);
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }
    else
    // see RFC 2595, chapter 4
    if (!PL_strcasecmp(line, "STLS"))
    {
      SetCapFlag(POP3_HAS_STLS);
      m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }
    else
    // see RFC 2449, chapter 6.3
    if (!PL_strncasecmp(line, "SASL", 4) && strlen(line) > 6)
    {
        nsAutoCString responseLine;
        responseLine.Assign(line + 5);

        if (responseLine.Find("PLAIN", CaseInsensitiveCompare) >= 0)
            SetCapFlag(POP3_HAS_AUTH_PLAIN);

        if (responseLine.Find("LOGIN", CaseInsensitiveCompare) >= 0)
            SetCapFlag(POP3_HAS_AUTH_LOGIN);

        if (responseLine.Find("GSSAPI", CaseInsensitiveCompare) >= 0)
            SetCapFlag(POP3_HAS_AUTH_GSSAPI);

        if (responseLine.Find("CRAM-MD5", CaseInsensitiveCompare) >= 0)
          SetCapFlag(POP3_HAS_AUTH_CRAM_MD5);

        if (responseLine.Find("NTLM", CaseInsensitiveCompare) >= 0)
          SetCapFlag(POP3_HAS_AUTH_NTLM);

        if (responseLine.Find("MSN", CaseInsensitiveCompare) >= 0)
          SetCapFlag(POP3_HAS_AUTH_NTLM|POP3_HAS_AUTH_MSN);

        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }

    PR_Free(line);
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("capa processed"));
    return 0;
}

int32_t nsPop3Protocol::SendTLSResponse()
{
  // only tear down our existing connection and open a new one if we received
  // a +OK response from the pop server after we issued the STLS command
  nsresult rv = NS_OK;
  if (m_pop3ConData->command_succeeded)
  {
      nsCOMPtr<nsISupports> secInfo;
      nsCOMPtr<nsISocketTransport> strans = do_QueryInterface(m_transport, &rv);
      if (NS_FAILED(rv))
        return -1;

      rv = strans->GetSecurityInfo(getter_AddRefs(secInfo));

      if (NS_SUCCEEDED(rv) && secInfo)
      {
          nsCOMPtr<nsISSLSocketControl> sslControl = do_QueryInterface(secInfo, &rv);

          if (NS_SUCCEEDED(rv) && sslControl)
              rv = sslControl->StartTLS();
      }

    if (NS_SUCCEEDED(rv))
    {
      m_pop3ConData->next_state = POP3_SEND_AUTH;
      m_tlsEnabled = true;

      // certain capabilities like POP3_HAS_AUTH_APOP should be
      // preserved across the connections.
      uint32_t preservedCapFlags = m_pop3ConData->capability_flags & POP3_HAS_AUTH_APOP;
      m_pop3ConData->capability_flags =     // resetting the flags
        POP3_AUTH_MECH_UNDEFINED |
        POP3_HAS_AUTH_USER |                // should be always there
        POP3_GURL_UNDEFINED |
        POP3_UIDL_UNDEFINED |
        POP3_TOP_UNDEFINED |
        POP3_XTND_XLST_UNDEFINED |
        preservedCapFlags;
      m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
      return 0;
    }
  }

  ClearFlag(POP3_HAS_STLS);
  m_pop3ConData->next_state = POP3_PROCESS_AUTH;

  return (NS_SUCCEEDED(rv) ? 0 : -1);
}

void nsPop3Protocol::InitPrefAuthMethods(int32_t authMethodPrefValue)
{
  // for m_prefAuthMethods, using the same flags as server capablities.
  switch (authMethodPrefValue)
  {
    case nsMsgAuthMethod::none:
      m_prefAuthMethods = POP3_HAS_AUTH_NONE;
      break;
    case nsMsgAuthMethod::old:
      m_prefAuthMethods = POP3_HAS_AUTH_USER;
      break;
    case nsMsgAuthMethod::passwordCleartext:
      m_prefAuthMethods = POP3_HAS_AUTH_USER |
          POP3_HAS_AUTH_LOGIN | POP3_HAS_AUTH_PLAIN;
      break;
    case nsMsgAuthMethod::passwordEncrypted:
      m_prefAuthMethods = POP3_HAS_AUTH_CRAM_MD5 |
          POP3_HAS_AUTH_APOP;
      break;
    case nsMsgAuthMethod::NTLM:
      m_prefAuthMethods = POP3_HAS_AUTH_NTLM | POP3_HAS_AUTH_MSN;
      break;
    case nsMsgAuthMethod::GSSAPI:
      m_prefAuthMethods = POP3_HAS_AUTH_GSSAPI;
      break;
    case nsMsgAuthMethod::secure:
      m_prefAuthMethods = POP3_HAS_AUTH_APOP |
          POP3_HAS_AUTH_CRAM_MD5 | POP3_HAS_AUTH_GSSAPI |
          POP3_HAS_AUTH_NTLM | POP3_HAS_AUTH_MSN;
      break;
    default:
      NS_ASSERTION(false, "POP: authMethod pref invalid");
      // TODO log to error console
      PR_LOG(POP3LOGMODULE, PR_LOG_ERROR,
          ("POP: bad pref authMethod = %d\n", authMethodPrefValue));
      // fall to any
    case nsMsgAuthMethod::anything:
      m_prefAuthMethods = POP3_HAS_AUTH_USER |
          POP3_HAS_AUTH_LOGIN | POP3_HAS_AUTH_PLAIN |
          POP3_HAS_AUTH_CRAM_MD5 | POP3_HAS_AUTH_APOP |
          POP3_HAS_AUTH_GSSAPI |
          POP3_HAS_AUTH_NTLM | POP3_HAS_AUTH_MSN;
      // TODO needed?
      break;
  }
  NS_ASSERTION(m_prefAuthMethods != POP3_AUTH_MECH_UNDEFINED,
      "POP: InitPrefAuthMethods() didn't work");
}

/**
 * Changes m_currentAuthMethod to pick the best one
 * which is allowed by server and prefs and not marked failed.
 * The order of preference and trying of auth methods is encoded here.
 */
nsresult nsPop3Protocol::ChooseAuthMethod()
{
  int32_t availCaps = GetCapFlags() & m_prefAuthMethods & ~m_failedAuthMethods;

  PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG,
        ("POP auth: server caps 0x%X, pref 0x%X, failed 0x%X, avail caps 0x%X",
        GetCapFlags(), m_prefAuthMethods, m_failedAuthMethods, availCaps));
  PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG,
        ("(GSSAPI = 0x%X, CRAM = 0x%X, APOP = 0x%X, NTLM = 0x%X, "
        "MSN =  0x%X, PLAIN = 0x%X, LOGIN = 0x%X, USER/PASS = 0x%X)",
        POP3_HAS_AUTH_GSSAPI, POP3_HAS_AUTH_CRAM_MD5, POP3_HAS_AUTH_APOP,
        POP3_HAS_AUTH_NTLM, POP3_HAS_AUTH_MSN, POP3_HAS_AUTH_PLAIN,
        POP3_HAS_AUTH_LOGIN, POP3_HAS_AUTH_USER));

  if (POP3_HAS_AUTH_GSSAPI & availCaps)
    m_currentAuthMethod = POP3_HAS_AUTH_GSSAPI;
  else if (POP3_HAS_AUTH_CRAM_MD5 & availCaps)
    m_currentAuthMethod = POP3_HAS_AUTH_CRAM_MD5;
  else if (POP3_HAS_AUTH_APOP & availCaps)
    m_currentAuthMethod = POP3_HAS_AUTH_APOP;
  else if (POP3_HAS_AUTH_NTLM & availCaps)
    m_currentAuthMethod = POP3_HAS_AUTH_NTLM;
  else if (POP3_HAS_AUTH_MSN & availCaps)
    m_currentAuthMethod = POP3_HAS_AUTH_MSN;
  else if (POP3_HAS_AUTH_PLAIN & availCaps)
    m_currentAuthMethod = POP3_HAS_AUTH_PLAIN;
  else if (POP3_HAS_AUTH_LOGIN & availCaps)
    m_currentAuthMethod = POP3_HAS_AUTH_LOGIN;
  else if (POP3_HAS_AUTH_USER & availCaps)
    m_currentAuthMethod = POP3_HAS_AUTH_USER;
  else
  {
    // there are no matching login schemes at all, per server and prefs
    m_currentAuthMethod = POP3_AUTH_MECH_UNDEFINED;
    PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("no auth method remaining"));
    return NS_ERROR_FAILURE;
  }
  PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("trying auth method 0x%X", m_currentAuthMethod));
  return NS_OK;
}

void nsPop3Protocol::MarkAuthMethodAsFailed(int32_t failedAuthMethod)
{
  PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG,
      ("marking auth method 0x%X failed", failedAuthMethod));
  m_failedAuthMethods |= failedAuthMethod;
}

/**
 * Start over, trying all auth methods again
 */
void nsPop3Protocol::ResetAuthMethods()
{
  PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("resetting (failed) auth methods"));
  m_currentAuthMethod = POP3_AUTH_MECH_UNDEFINED;
  m_failedAuthMethods = 0;
}

/**
 * state POP3_PROCESS_AUTH
 * Called when we should try to authenticate to the server.
 * Also called when one auth method fails and we want to try and start
 * the next best auth method.
 */
int32_t nsPop3Protocol::ProcessAuth()
{
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("ProcessAuth()"));

    // Try to upgrade to STARTTLS -- TODO move into its own function
    if (!m_tlsEnabled)
    {
      if(TestCapFlag(POP3_HAS_STLS))
      {
        if (m_socketType == nsMsgSocketType::trySTARTTLS ||
            m_socketType == nsMsgSocketType::alwaysSTARTTLS)
        {
            nsAutoCString command("STLS" CRLF);

            m_pop3ConData->next_state_after_response = POP3_TLS_RESPONSE;
            return Pop3SendData(command.get());
        }
      }
      else if (m_socketType == nsMsgSocketType::alwaysSTARTTLS)
      {
          m_pop3ConData->next_state = POP3_ERROR_DONE;
          return(Error(NS_ERROR_COULD_NOT_CONNECT_VIA_TLS));
      }
    }

    m_password_already_sent = false;

    nsresult rv = ChooseAuthMethod();
    if (NS_FAILED(rv))
    {
      // Pref doesn't match server. Now, find an appropriate error msg.
      PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG,
           ("ProcessAuth() early exit because no auth methods"));

      // AuthGSSAPI* falls in here in case of an auth failure.
      // If Kerberos was the only method, assume that
      // the user is just not logged in yet, and show an appropriate error.
      if (m_prefAuthMethods == POP3_HAS_AUTH_GSSAPI &&
          m_failedAuthMethods == POP3_HAS_AUTH_GSSAPI)
        return Error(POP3_GSSAPI_FAILURE);

      // pref has plaintext pw & server claims to support encrypted pw
      if (m_prefAuthMethods == (POP3_HAS_AUTH_USER | POP3_HAS_AUTH_LOGIN |
              POP3_HAS_AUTH_PLAIN) &&
          GetCapFlags() & (POP3_HAS_AUTH_CRAM_MD5 | POP3_HAS_AUTH_APOP))
        // tell user to change to encrypted pw
        return Error(POP3_AUTH_CHANGE_PLAIN_TO_ENCRYPT);
      // pref has encrypted pw & server claims to support plaintext pw
      else if (m_prefAuthMethods == (POP3_HAS_AUTH_CRAM_MD5 |
                    POP3_HAS_AUTH_APOP) &&
               GetCapFlags() & (POP3_HAS_AUTH_USER | POP3_HAS_AUTH_LOGIN |
                    POP3_HAS_AUTH_PLAIN))
      {
        // have SSL
        if (m_socketType == nsMsgSocketType::SSL ||
            m_socketType == nsMsgSocketType::alwaysSTARTTLS)
          // tell user to change to plaintext pw
          return Error(POP3_AUTH_CHANGE_ENCRYPT_TO_PLAIN_SSL);
        else
          // tell user to change to plaintext pw, with big warning
          return Error(POP3_AUTH_CHANGE_ENCRYPT_TO_PLAIN_NO_SSL);
      }
      else
        // just "change auth method"
        return Error(POP3_AUTH_MECH_NOT_SUPPORTED);
    }

    switch (m_currentAuthMethod)
    {
      case POP3_HAS_AUTH_GSSAPI:
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("POP GSSAPI"));
        m_pop3ConData->next_state = POP3_AUTH_GSSAPI;
        break;
      case POP3_HAS_AUTH_APOP:
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("POP APOP"));
        m_pop3ConData->next_state = POP3_SEND_PASSWORD;
        break;
      case POP3_HAS_AUTH_CRAM_MD5:
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("POP CRAM"));
      case POP3_HAS_AUTH_PLAIN:
      case POP3_HAS_AUTH_USER:
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("POP username"));
        m_pop3ConData->next_state = POP3_SEND_USERNAME;
        break;
      case POP3_HAS_AUTH_LOGIN:
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("POP AUTH=LOGIN"));
        m_pop3ConData->next_state = POP3_AUTH_LOGIN;
        break;
      case POP3_HAS_AUTH_NTLM:
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("POP NTLM"));
        m_pop3ConData->next_state = POP3_AUTH_NTLM;
        break;
      case POP3_HAS_AUTH_NONE:
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("POP no auth"));
        m_pop3ConData->command_succeeded = true;
        m_pop3ConData->next_state = POP3_NEXT_AUTH_STEP;
        break;
      default:
        PR_LOG(POP3LOGMODULE, PR_LOG_ERROR,
             ("POP: m_currentAuthMethod has unknown value"));
        return Error(POP3_AUTH_MECH_NOT_SUPPORTED);
    }

    m_pop3ConData->pause_for_read = false;

    return 0;
}

/**
 * state POP3_NEXT_AUTH_STEP
 * This is called when we finished one auth step (e.g. sending username
 * or password are separate steps, similarly for AUTH LOGIN, NTLM etc.)
 * and want to proceed to the next one.
 */
int32_t nsPop3Protocol::NextAuthStep()
{
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("NextAuthStep()"));
    if (m_pop3ConData->command_succeeded)
    {
        if (m_password_already_sent || // (also true for GSSAPI)
            m_currentAuthMethod == POP3_HAS_AUTH_NONE)
        {
            PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("login succeeded"));
            m_nsIPop3Sink->SetUserAuthenticated(true);
            ClearFlag(POP3_PASSWORD_FAILED);
            if (m_pop3ConData->verify_logon)
              m_pop3ConData->next_state = POP3_SEND_QUIT;
            else
              m_pop3ConData->next_state = (m_pop3ConData->get_url)
                                          ? POP3_SEND_GURL : POP3_SEND_STAT;
        }
        else
            m_pop3ConData->next_state = POP3_SEND_PASSWORD;
    }
    else
    {
        PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("command did not succeed"));
        // response code received shows that login failed not because of
        // wrong credential -> stop login without retry or pw dialog, only alert
        if (TestFlag(POP3_STOPLOGIN))
            return(Error((m_password_already_sent)
                         ? POP3_PASSWORD_FAILURE : POP3_USERNAME_FAILURE));

        // response code received shows that server is certain about the
        // credential was wrong -> no fallback, show alert and pw dialog
        if (TestFlag(POP3_AUTH_FAILURE))
        {
            PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG,
               ("auth failure, setting password failed"));
            Error((m_password_already_sent)
                         ? POP3_PASSWORD_FAILURE : POP3_USERNAME_FAILURE);
            SetFlag(POP3_PASSWORD_FAILED);
            ClearFlag(POP3_AUTH_FAILURE);
            return 0;
        }

        // We have no certain response code -> fallback and try again.
        // Mark the auth method failed, to use a different method next round.
        MarkAuthMethodAsFailed(m_currentAuthMethod);

        if (m_currentAuthMethod == POP3_HAS_AUTH_USER &&
            !m_password_already_sent)
        {
            PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("USER username failed"));
            // if USER auth method failed before sending the password,
            // the username was wrong.
            // no fallback but return error
            return Error(POP3_USERNAME_FAILURE);
        }

        // If we have no auth method left, ask user to try with new password
        nsresult rv = ChooseAuthMethod();
        if (NS_FAILED(rv))
        {
            PR_LOG(POP3LOGMODULE, PR_LOG_ERROR,
                ("POP: no auth methods remaining, setting password failure"));
            /* Sever the connection and go back to the `read password' state,
               which, upon success, will re-open the connection.  Set a flag
               which causes the prompt to be different that time (to indicate
               that the old password was bogus.)

               But if we're just checking for new mail (biff) then don't bother
               prompting the user for a password: just fail silently.
            */
            SetFlag(POP3_PASSWORD_FAILED);
            Error(POP3_PASSWORD_FAILURE);

            if (m_nsIPop3Sink)
                m_nsIPop3Sink->SetMailAccountURL(NULL);

            return 0;
        }
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG,
           ("still have some auth methods to try"));

        // TODO needed?
        //m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);

        m_pop3ConData->command_succeeded = true;

        m_pop3ConData->next_state = POP3_PROCESS_AUTH;
    }

    if (TestCapFlag(POP3_AUTH_MECH_UNDEFINED))
    {
        ClearCapFlag(POP3_AUTH_MECH_UNDEFINED);
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }

    m_pop3ConData->pause_for_read = false;

    return 0;
}

// LOGIN consists of three steps not two as USER/PASS or CRAM-MD5,
// so we've to start here and continue in SendUsername if the server
// responds + to "AUTH LOGIN"
int32_t nsPop3Protocol::AuthLogin()
{
    nsAutoCString command("AUTH LOGIN" CRLF);
    m_pop3ConData->next_state_after_response = POP3_AUTH_LOGIN_RESPONSE;
    m_pop3ConData->pause_for_read = true;

    return Pop3SendData(command.get());
}

int32_t nsPop3Protocol::AuthLoginResponse()
{
    // need the test to be here instead in NextAuthStep() to
    // differentiate between command AUTH LOGIN failed and
    // sending username using LOGIN mechanism failed.
    if (!m_pop3ConData->command_succeeded)
    {
        // we failed with LOGIN, remove it
        MarkAuthMethodAsFailed(POP3_HAS_AUTH_LOGIN);
        m_pop3ConData->next_state = POP3_PROCESS_AUTH;
    }
    else
        m_pop3ConData->next_state = POP3_SEND_USERNAME;

    m_pop3ConData->pause_for_read = false;

    return 0;
}

// NTLM, like LOGIN consists of three steps not two as USER/PASS or CRAM-MD5,
// so we've to start here and continue in SendUsername if the server
// responds + to "AUTH NTLM"
int32_t nsPop3Protocol::AuthNtlm()
{
    nsAutoCString command (m_currentAuthMethod == POP3_HAS_AUTH_MSN
          ? "AUTH MSN" CRLF : "AUTH NTLM" CRLF);
    m_pop3ConData->next_state_after_response = POP3_AUTH_NTLM_RESPONSE;
    m_pop3ConData->pause_for_read = true;

    return Pop3SendData(command.get());
}

int32_t nsPop3Protocol::AuthNtlmResponse()
{
    // need the test to be here instead in NextAuthStep() to
    // differentiate between command AUTH NTLM failed and
    // sending username using NTLM mechanism failed.
    if (!m_pop3ConData->command_succeeded)
    {
        MarkAuthMethodAsFailed(POP3_HAS_AUTH_NTLM);
        MarkAuthMethodAsFailed(POP3_HAS_AUTH_MSN);
        m_pop3ConData->next_state = POP3_PROCESS_AUTH;
    }
    else
        m_pop3ConData->next_state = POP3_SEND_USERNAME;

    m_pop3ConData->pause_for_read = false;

    return 0;
}

int32_t nsPop3Protocol::AuthGSSAPI()
{
    PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("AuthGSSAPI()"));
    nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server);
    if (server) {
        nsAutoCString cmd;
        nsAutoCString service("pop@");
        nsCString hostName;
        nsresult rv;
        server->GetRealHostName(hostName);
        service.Append(hostName);
        rv = DoGSSAPIStep1(service.get(), m_username.get(), cmd);
        if (NS_SUCCEEDED(rv)) {
            m_GSSAPICache.Assign(cmd);
            m_pop3ConData->next_state_after_response = POP3_AUTH_GSSAPI_FIRST;
            m_pop3ConData->pause_for_read = true;
            return Pop3SendData("AUTH GSSAPI" CRLF);
        }
    }

    MarkAuthMethodAsFailed(POP3_HAS_AUTH_GSSAPI);
    m_pop3ConData->next_state = POP3_PROCESS_AUTH;
    m_pop3ConData->pause_for_read = false;
    return 0;
}

int32_t nsPop3Protocol::AuthGSSAPIResponse(bool first)
{
    if (!m_pop3ConData->command_succeeded)
    {
        if (first)
            m_GSSAPICache.Truncate();
        MarkAuthMethodAsFailed(POP3_HAS_AUTH_GSSAPI);
        m_pop3ConData->next_state = POP3_PROCESS_AUTH;
        m_pop3ConData->pause_for_read = false;
        return 0;
    }

    int32_t result;

    m_pop3ConData->next_state_after_response = POP3_AUTH_GSSAPI_STEP;
    m_pop3ConData->pause_for_read = true;

    if (first) {
        m_GSSAPICache += CRLF;
        result = Pop3SendData(m_GSSAPICache.get());
        m_GSSAPICache.Truncate();
    }
    else {
        nsAutoCString cmd;
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("GSSAPI step 2"));
        nsresult rv = DoGSSAPIStep2(m_commandResponse, cmd);
        if (NS_FAILED(rv))
            cmd = "*";
        if (rv == NS_SUCCESS_AUTH_FINISHED) {
            m_pop3ConData->next_state_after_response = POP3_NEXT_AUTH_STEP;
            m_password_already_sent = true;
        }
        cmd += CRLF;
        result = Pop3SendData(cmd.get());
    }

    return result;
}

int32_t nsPop3Protocol::SendUsername()
{
    PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("SendUsername()"));
    if(m_username.IsEmpty())
      return(Error(POP3_USERNAME_UNDEFINED));

    // <copied from="SendPassword()">
    // Needed for NTLM

    // The POP3_SEND_PASSWORD/POP3_WAIT_SEND_PASSWORD states have already
    // got the password - they will have cancelled if necessary.
    // If the password is still empty here, don't try to go on.
    if (m_passwordResult.IsEmpty())
    {
      m_pop3ConData->next_state = POP3_ERROR_DONE;
      return Error(POP3_PASSWORD_UNDEFINED);
    }
    // </copied>

    nsAutoCString cmd;

    if (m_currentAuthMethod == POP3_HAS_AUTH_NTLM)
        (void) DoNtlmStep1(m_username.get(), m_passwordResult.get(), cmd);
    else if (m_currentAuthMethod == POP3_HAS_AUTH_CRAM_MD5)
        cmd = "AUTH CRAM-MD5";
    else if (m_currentAuthMethod == POP3_HAS_AUTH_PLAIN)
        cmd = "AUTH PLAIN";
    else if (m_currentAuthMethod == POP3_HAS_AUTH_LOGIN)
    {
        char *base64Str = PL_Base64Encode(m_username.get(), m_username.Length(), nullptr);
        cmd = base64Str;
        PR_Free(base64Str);
    }
    else if (m_currentAuthMethod == POP3_HAS_AUTH_USER)
    {
        PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("USER login"));
        cmd = "USER ";
        cmd += m_username;
    }
    else
    {
      PR_LOG(POP3LOGMODULE, PR_LOG_ERROR,
          ("In nsPop3Protocol::SendUsername(), m_currentAuthMethod is 0x%X, "
          "but that is unexpected", m_currentAuthMethod));
      return Error(POP3_AUTH_INTERNAL_ERROR);
    }

    cmd += CRLF;

    m_pop3ConData->next_state_after_response = POP3_NEXT_AUTH_STEP;

    m_pop3ConData->pause_for_read = true;

    return Pop3SendData(cmd.get());
}

int32_t nsPop3Protocol::SendPassword()
{
  PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("SendPassword()"));
  if (m_username.IsEmpty())
    return(Error(POP3_USERNAME_UNDEFINED));

  // <copied to="SendUsername()">
  // Needed here, too, because APOP skips SendUsername()
  // The POP3_SEND_PASSWORD/POP3_WAIT_SEND_PASSWORD states have already
  // got the password - they will have cancelled if necessary.
  // If the password is still empty here, don't try to go on.
  if (m_passwordResult.IsEmpty())
  {
    m_pop3ConData->next_state = POP3_ERROR_DONE;
    return Error(POP3_PASSWORD_UNDEFINED);
  }
  // </copied>

  nsAutoCString cmd;
  nsresult rv;

  if (m_currentAuthMethod == POP3_HAS_AUTH_NTLM)
    rv = DoNtlmStep2(m_commandResponse, cmd);
  else if (m_currentAuthMethod == POP3_HAS_AUTH_CRAM_MD5)
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("CRAM login"));
    char buffer[512]; // TODO nsAutoCString
    unsigned char digest[DIGEST_LENGTH];

    char *decodedChallenge = PL_Base64Decode(m_commandResponse.get(),
    m_commandResponse.Length(), nullptr);

    if (decodedChallenge)
      rv = MSGCramMD5(decodedChallenge, strlen(decodedChallenge),
                      m_passwordResult.get(), m_passwordResult.Length(), digest);
    else
      rv = NS_ERROR_NULL_POINTER;

    if (NS_SUCCEEDED(rv))
    {
      nsAutoCString encodedDigest;
      char hexVal[8];

      for (uint32_t j = 0; j < 16; j++)
      {
        PR_snprintf (hexVal,8, "%.2x", 0x0ff & (unsigned short)digest[j]);
        encodedDigest.Append(hexVal);
      }

      PR_snprintf(buffer, sizeof(buffer), "%s %s", m_username.get(),
                  encodedDigest.get());
      char *base64Str = PL_Base64Encode(buffer, strlen(buffer), nullptr);
      cmd = base64Str;
      PR_Free(base64Str);
    }

    if (NS_FAILED(rv))
      cmd = "*";
  }
  else if (m_currentAuthMethod == POP3_HAS_AUTH_APOP)
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("APOP login"));
    char buffer[512];
    unsigned char digest[DIGEST_LENGTH];

    rv = MSGApopMD5(m_ApopTimestamp.get(), m_ApopTimestamp.Length(),
                    m_passwordResult.get(), m_passwordResult.Length(), digest);

    if (NS_SUCCEEDED(rv))
    {
      nsAutoCString encodedDigest;
      char hexVal[8];

      for (uint32_t j=0; j<16; j++)
      {
        PR_snprintf (hexVal,8, "%.2x", 0x0ff & (unsigned short)digest[j]);
        encodedDigest.Append(hexVal);
      }

      PR_snprintf(buffer, sizeof(buffer), "APOP %s %s", m_username.get(),
                  encodedDigest.get());
      cmd = buffer;
    }

    if (NS_FAILED(rv))
      cmd = "*";
  }
  else if (m_currentAuthMethod == POP3_HAS_AUTH_PLAIN)
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("PLAIN login"));
    // workaround for IPswitch's IMail server software
    // this server goes into LOGIN mode even if we send "AUTH PLAIN"
    // "VXNlc" is the beginning of the base64 encoded prompt ("Username:") for LOGIN
    if (StringBeginsWith(m_commandResponse, NS_LITERAL_CSTRING("VXNlc")))
    {
      // disable PLAIN and enable LOGIN (in case it's not already enabled)
      ClearCapFlag(POP3_HAS_AUTH_PLAIN);
      SetCapFlag(POP3_HAS_AUTH_LOGIN);
      m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);

      // reenter authentication again at LOGIN response handler
      m_pop3ConData->next_state = POP3_AUTH_LOGIN_RESPONSE;
      m_pop3ConData->pause_for_read = false;
      return 0;
    }

    char plain_string[512]; // TODO nsCString
    int len = 1; /* first <NUL> char */
    memset(plain_string, 0, 512);
    PR_snprintf(&plain_string[1], 510, "%s", m_username.get());
    len += m_username.Length();
    len++; /* second <NUL> char */
    PR_snprintf(&plain_string[len], 511-len, "%s", m_passwordResult.get());
    len += m_passwordResult.Length();

    char *base64Str = PL_Base64Encode(plain_string, len, nullptr);
    cmd = base64Str;
    PR_Free(base64Str);
  }
  else if (m_currentAuthMethod == POP3_HAS_AUTH_LOGIN)
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("LOGIN password"));
    char * base64Str =
        PL_Base64Encode(m_passwordResult.get(), m_passwordResult.Length(),
                        nullptr);
    cmd = base64Str;
    PR_Free(base64Str);
  }
  else if (m_currentAuthMethod == POP3_HAS_AUTH_USER)
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_DEBUG, ("PASS password"));
    cmd = "PASS ";
    cmd += m_passwordResult;
  }
  else
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_ERROR,
        ("In nsPop3Protocol::SendPassword(), m_currentAuthMethod is %X, "
        "but that is unexpected", m_currentAuthMethod));
    return Error(POP3_AUTH_INTERNAL_ERROR);
  }

  cmd += CRLF;

  // TODO needed?
  //m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);

  m_pop3ConData->next_state_after_response = POP3_NEXT_AUTH_STEP;

  m_pop3ConData->pause_for_read = true;

  m_password_already_sent = true;
  m_lastPasswordSent = m_passwordResult;
  return Pop3SendData(cmd.get(), true);
}

int32_t nsPop3Protocol::SendStatOrGurl(bool sendStat)
{
  nsAutoCString cmd;
  if (sendStat)
  {
    cmd  = "STAT" CRLF;
    m_pop3ConData->next_state_after_response = POP3_GET_STAT;
  }
  else
  {
    cmd = "GURL" CRLF;
    m_pop3ConData->next_state_after_response = POP3_GURL_RESPONSE;
  }
  return Pop3SendData(cmd.get());
}


int32_t
nsPop3Protocol::SendStat()
{
  return SendStatOrGurl(true);
}


int32_t
nsPop3Protocol::GetStat()
{
  // check stat response
  if (!m_pop3ConData->command_succeeded)
    return(Error(POP3_STAT_FAILURE));

    /* stat response looks like:  %d %d
     * The first number is the number of articles
     * The second number is the number of bytes
     *
     *  grab the first and second arg of stat response
     */
  nsCString oldStr (m_commandResponse);
  char *newStr = oldStr.BeginWriting();
  char *num = NS_strtok(" ", &newStr);  // msg num
  if (num)
  {
    m_pop3ConData->number_of_messages = atol(num);  // bytes
    num = NS_strtok(" ", &newStr);
    m_commandResponse = newStr;
    if (num)
      m_totalFolderSize = (int32_t) atol(num);  //we always initialize m_totalFolderSize to 0
  }
  else
    m_pop3ConData->number_of_messages = 0;

  m_pop3ConData->really_new_messages = 0;
  m_pop3ConData->real_new_counter = 1;

  m_totalDownloadSize = -1; // Means we need to calculate it, later.

  if (m_pop3ConData->number_of_messages <= 0)
  {
    // We're all done. We know we have no mail.
    m_pop3ConData->next_state = POP3_SEND_QUIT;
    PL_HashTableEnumerateEntries(m_pop3ConData->uidlinfo->hash, hash_clear_mapper, nullptr);
    // Hack - use nsPop3Sink to wipe out any stale Partial messages
    m_nsIPop3Sink->BeginMailDelivery(false, nullptr, nullptr);
    m_nsIPop3Sink->AbortMailDelivery(this);
    return(0);
  }

  /* We're just checking for new mail, and we're not playing any games that
     involve keeping messages on the server.  Therefore, we now know enough
     to finish up.  If we had no messages, that would have been handled
     above; therefore, we know we have some new messages. 
  */
  if (m_pop3ConData->only_check_for_new_mail && !m_pop3ConData->leave_on_server)
  {
    m_nsIPop3Sink->SetBiffStateAndUpdateFE(nsIMsgFolder::nsMsgBiffState_NewMail,
                                           m_pop3ConData->number_of_messages,
                                           true);
    m_pop3ConData->next_state = POP3_SEND_QUIT;
    return(0);
  }


  if (!m_pop3ConData->only_check_for_new_mail)
  {
      /* The following was added to prevent the loss of Data when we try and
         write to somewhere we don't have write access error to (See bug 62480)
         (Note: This is only a temp hack until the underlying XPCOM is fixed
         to return errors) */

      nsresult rv;
      nsCOMPtr <nsIMsgWindow> msgWindow;
      nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url);
      if (mailnewsUrl)
        rv = mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow));
//      NS_ASSERTION(NS_SUCCEEDED(rv) && msgWindow, "no msg window");

      rv = m_nsIPop3Sink->BeginMailDelivery(m_pop3ConData->only_uidl != nullptr, msgWindow,
                                                    &m_pop3ConData->msg_del_started);
      if (NS_FAILED(rv))
      {
        m_nsIPop3Sink->AbortMailDelivery(this);
        if (rv == NS_MSG_FOLDER_BUSY)
          return(Error(POP3_MESSAGE_FOLDER_BUSY));
        else
          return(Error(POP3_MESSAGE_WRITE_ERROR));
      }

      if(!m_pop3ConData->msg_del_started)
        return(Error(POP3_MESSAGE_WRITE_ERROR));
  }

  m_pop3ConData->next_state = POP3_SEND_LIST;
  return 0;
}



int32_t
nsPop3Protocol::SendGurl()
{
    if (m_pop3ConData->capability_flags == POP3_CAPABILITY_UNDEFINED ||
        TestCapFlag(POP3_GURL_UNDEFINED | POP3_HAS_GURL))
        return SendStatOrGurl(false);
    else
        return -1;
}


int32_t
nsPop3Protocol::GurlResponse()
{
    ClearCapFlag(POP3_GURL_UNDEFINED);

    if (m_pop3ConData->command_succeeded)
    {
        SetCapFlag(POP3_HAS_GURL);
        if (m_nsIPop3Sink)
            m_nsIPop3Sink->SetMailAccountURL(m_commandResponse.get());
    }
    else
    {
        ClearCapFlag(POP3_HAS_GURL);
    }
    m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    m_pop3ConData->next_state = POP3_SEND_QUIT;

    return 0;
}

int32_t nsPop3Protocol::SendList()
{
    // check for server returning number of messages that will cause the calculation
    // of the size of the block for msg_info to
    // overflow a 32 bit int, in turn causing us to allocate a block of memory much
    // smaller than we think we're allocating, and
    // potentially allowing the server to make us overwrite memory outside our heap
    // block.

    if (m_pop3ConData->number_of_messages > (int) (0xFFFFF000 / sizeof(Pop3MsgInfo)))
        return MK_OUT_OF_MEMORY;


    m_pop3ConData->msg_info = (Pop3MsgInfo *)
      PR_CALLOC(sizeof(Pop3MsgInfo) * m_pop3ConData->number_of_messages);
    if (!m_pop3ConData->msg_info)
        return(MK_OUT_OF_MEMORY);
    m_pop3ConData->next_state_after_response = POP3_GET_LIST;
    m_listpos = 0;
    return Pop3SendData("LIST" CRLF);
}



int32_t
nsPop3Protocol::GetList(nsIInputStream* inputStream,
                        uint32_t length)
{
  /* check list response
  * This will get called multiple times
  * but it's alright since command_succeeded
  * will remain constant
  */
  if(!m_pop3ConData->command_succeeded)
    return(Error(POP3_LIST_FAILURE));

  uint32_t ln = 0;
  bool pauseForMoreData = false;
  nsresult rv;
  char *line = m_lineStreamBuffer->ReadNextLine(inputStream, ln, pauseForMoreData, &rv);
  if (NS_FAILED(rv))
    return -1;

  if (pauseForMoreData || !line)
  {
    m_pop3ConData->pause_for_read = true;
    PR_Free(line);
    return(ln);
  }

  PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));

  /* parse the line returned from the list command
  * it looks like
  * #msg_number #bytes
  *
  * list data is terminated by a ".CRLF" line
  */
  if (!PL_strcmp(line, "."))
  {
    // limit the list if fewer entries than given in STAT response
    if(m_listpos < m_pop3ConData->number_of_messages)
      m_pop3ConData->number_of_messages = m_listpos;
    m_pop3ConData->next_state = POP3_SEND_UIDL_LIST;
    m_pop3ConData->pause_for_read = false;
    PR_Free(line);
    return(0);
  }

  char *newStr = line;
  char *token = NS_strtok(" ", &newStr);
  if (token)
  {
    int32_t msg_num = atol(token);

    if (++m_listpos <= m_pop3ConData->number_of_messages)
    {
      token = NS_strtok(" ", &newStr);
      if (token)
      {
        m_pop3ConData->msg_info[m_listpos-1].size = atol(token);
        m_pop3ConData->msg_info[m_listpos-1].msgnum = msg_num;
      }
    }
  }

  PR_Free(line);
  return(0);
}


/* UIDL and XTND are both unsupported for this mail server.
   If not enabled any advanced features, we're able to live
   without them. We're simply downloading and deleting everything
   on the server.

   Advanced features are:
   *'Keep Mail on Server' with aging or deletion support
   *'Fetch Headers Only'
   *'Limit Message Size'
   *only download a specific UID

   These require knowledge of of all messages UID's on the server at
   least when it comes to deleting deleting messages on server that
   have been deleted on client or vice versa. TOP doesn't help here
   without generating huge traffic and is mostly not supported at all
   if the server lacks UIDL and XTND XLST.

   In other cases the user has to join the 20th century.
   Tell the user this, and refuse to download any messages until
   they've gone into preferences and turned off any of the above
   prefs.
*/
int32_t nsPop3Protocol::HandleNoUidListAvailable()
{
  m_pop3ConData->pause_for_read = false;

  if(!m_pop3ConData->leave_on_server &&
     !m_pop3ConData->headers_only &&
     m_pop3ConData->size_limit <= 0 &&
     !m_pop3ConData->only_uidl)
    m_pop3ConData->next_state = POP3_GET_MSG;
  else
  {
    m_pop3ConData->next_state = POP3_SEND_QUIT;

    nsresult rv;

    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url, &rv);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIMsgWindow> msgWindow;
      rv = mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow));
      if (NS_SUCCEEDED(rv) && msgWindow)
      {
        nsCOMPtr<nsIPrompt> dialog;
        rv = msgWindow->GetPromptDialog(getter_AddRefs(dialog));
        if (NS_SUCCEEDED(rv))
        {
          nsCString hostName;
          nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server);
          if (server)
            rv = server->GetRealHostName(hostName);
          if (NS_SUCCEEDED(rv))
          {
            nsAutoString hostNameUnicode;
            CopyASCIItoUTF16(hostName, hostNameUnicode);
            const PRUnichar *formatStrings[] = { hostNameUnicode.get() };
            nsString alertString;
            rv = mLocalBundle->FormatStringFromID(POP3_SERVER_DOES_NOT_SUPPORT_UIDL_ETC,
              formatStrings, 1, getter_Copies(alertString));
            NS_ENSURE_SUCCESS(rv, -1);

            dialog->Alert(nullptr, alertString.get());
          }
        }
      }
    }
  }

  return(0);
}


/* km
 *
 *  net_pop3_send_xtnd_xlst_msgid
 *
 *  Process state: POP3_SEND_XTND_XLST_MSGID
 *
 *  If we get here then UIDL is not supported by the mail server.
 *  Some mail servers support a similar command:
 *
 *    XTND XLST Message-Id
 *
 *  Here is a sample transaction from a QUALCOMM server

 >>XTND XLST Message-Id
 <<+OK xlst command accepted; headers coming.
 <<1 Message-ID: <3117E4DC.2699@netscape.invalid>
 <<2 Message-Id: <199602062335.PAA19215@lemon.example.com>

 * This function will send the xtnd command and put us into the
 * POP3_GET_XTND_XLST_MSGID state
 *
*/
int32_t nsPop3Protocol::SendXtndXlstMsgid()
{
  if (TestCapFlag(POP3_HAS_XTND_XLST | POP3_XTND_XLST_UNDEFINED))
  {
    m_pop3ConData->next_state_after_response = POP3_GET_XTND_XLST_MSGID;
    m_pop3ConData->pause_for_read = true;
    m_listpos = 0;
    return Pop3SendData("XTND XLST Message-Id" CRLF);
  }
  else
    return HandleNoUidListAvailable();
}


/* km
 *
 *  net_pop3_get_xtnd_xlst_msgid
 *
 *  This code was created from the net_pop3_get_uidl_list boiler plate.
 *  The difference is that the XTND reply strings have one more token per
 *  string than the UIDL reply strings do.
 *
 */

int32_t
nsPop3Protocol::GetXtndXlstMsgid(nsIInputStream* inputStream,
                                 uint32_t length)
{
  /* check list response
  * This will get called multiple times
  * but it's alright since command_succeeded
  * will remain constant
  */
  ClearCapFlag(POP3_XTND_XLST_UNDEFINED);

  if (!m_pop3ConData->command_succeeded)
  {
    ClearCapFlag(POP3_HAS_XTND_XLST);
    m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    HandleNoUidListAvailable();
    return(0);
  }
  else
  {
    SetCapFlag(POP3_HAS_XTND_XLST);
    m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
  }

  uint32_t ln = 0;
  bool pauseForMoreData = false;
  nsresult rv;
  char *line = m_lineStreamBuffer->ReadNextLine(inputStream, ln, pauseForMoreData, &rv);
  if (NS_FAILED(rv))
    return -1;

  if (pauseForMoreData || !line)
  {
    m_pop3ConData->pause_for_read = true;
    PR_Free(line);
    return ln;
  }

  PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));

  /* parse the line returned from the list command
  * it looks like
  * 1 Message-ID: <3117E4DC.2699@example.com>
  *
  * list data is terminated by a ".CRLF" line
  */
  if (!PL_strcmp(line, "."))
  {
    // limit the list if fewer entries than given in STAT response
    if(m_listpos < m_pop3ConData->number_of_messages)
      m_pop3ConData->number_of_messages = m_listpos;
    m_pop3ConData->list_done = true;
    m_pop3ConData->next_state = POP3_GET_MSG;
    m_pop3ConData->pause_for_read = false;
    PR_Free(line);
    return(0);
  }

  char *newStr = line;
  char *token = NS_strtok(" ", &newStr);  // msg num
  if (token)
  {
    int32_t msg_num = atol(token);
    if (++m_listpos <= m_pop3ConData->number_of_messages)
    {
      NS_strtok(" ", &newStr);  // eat message ID token
      const char *uid = NS_strtok(" ", &newStr); // not really a UID but a unique token -km
      if (!uid)
        /* This is bad.  The server didn't give us a UIDL for this message.
        I've seen this happen when somehow the mail spool has a message
        that contains a header that reads "X-UIDL: \n".  But how that got
        there, I have no idea; must be a server bug.  Or something. */
        uid = "";

      // seeking right entry, but try the one that should it be first
      int32_t i;
      if(m_pop3ConData->msg_info[m_listpos - 1].msgnum == msg_num)
        i = m_listpos - 1;
      else
        for(i = 0; i < m_pop3ConData->number_of_messages &&
                   m_pop3ConData->msg_info[i].msgnum != msg_num; i++)
          ;

      // only if found a matching slot
      if (i < m_pop3ConData->number_of_messages)
      {
        // to protect us from memory leak in case of getting a msg num twice
        m_pop3ConData->msg_info[i].uidl = PL_strdup(uid);
        if (!m_pop3ConData->msg_info[i].uidl)
        {
          PR_Free(line);
          return MK_OUT_OF_MEMORY;
        }
      }
    }
  }

  PR_Free(line);
  return(0);
}


int32_t nsPop3Protocol::SendUidlList()
{
    if (TestCapFlag(POP3_HAS_UIDL | POP3_UIDL_UNDEFINED))
    {
      m_pop3ConData->next_state_after_response = POP3_GET_UIDL_LIST;
      m_pop3ConData->pause_for_read = true;
      m_listpos = 0;
      return Pop3SendData("UIDL" CRLF);
    }
    else
      return SendXtndXlstMsgid();
}


int32_t nsPop3Protocol::GetUidlList(nsIInputStream* inputStream,
                            uint32_t length)
{
    /* check list response
     * This will get called multiple times
     * but it's alright since command_succeeded
     * will remain constant
     */
    ClearCapFlag(POP3_UIDL_UNDEFINED);

    if (!m_pop3ConData->command_succeeded)
    {
      m_pop3ConData->next_state = POP3_SEND_XTND_XLST_MSGID;
      m_pop3ConData->pause_for_read = false;
      ClearCapFlag(POP3_HAS_UIDL);
      m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
      return(0);
    }
    else
    {
      SetCapFlag(POP3_HAS_UIDL);
      m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }

    uint32_t ln = 0;
    bool pauseForMoreData = false;
    nsresult rv;
    char *line = m_lineStreamBuffer->ReadNextLine(inputStream, ln, pauseForMoreData, &rv);
    if (NS_FAILED(rv))
      return -1;

    if (pauseForMoreData || !line)
    {
      PR_Free(line);
      m_pop3ConData->pause_for_read = true;
      return ln;
    }

    PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));

    /* parse the line returned from the list command
     * it looks like
     * #msg_number uidl
     *
     * list data is terminated by a ".CRLF" line
     */
    if (!PL_strcmp(line, "."))
    {
      // limit the list if fewer entries than given in STAT response
      if (m_listpos < m_pop3ConData->number_of_messages)
        m_pop3ConData->number_of_messages = m_listpos;
      m_pop3ConData->list_done = true;
      m_pop3ConData->next_state = POP3_GET_MSG;
      m_pop3ConData->pause_for_read = false;
      PR_Free(line);
      return(0);
    }

    char *newStr = line;
    char *token = NS_strtok(" ", &newStr);  // msg num
    if (token)
    {
      int32_t msg_num = atol(token);
      if (++m_listpos <= m_pop3ConData->number_of_messages)
      {
        const char *uid = NS_strtok(" ", &newStr); // UID
        if (!uid)
          /* This is bad.  The server didn't give us a UIDL for this message.
             I've seen this happen when somehow the mail spool has a message
             that contains a header that reads "X-UIDL: \n".  But how that got
             there, I have no idea; must be a server bug.  Or something. */
          uid = "";

        // seeking right entry, but try the one that should it be first
        int32_t i;
        if(m_pop3ConData->msg_info[m_listpos - 1].msgnum == msg_num)
          i = m_listpos - 1;
        else
          for(i = 0; i < m_pop3ConData->number_of_messages &&
                     m_pop3ConData->msg_info[i].msgnum != msg_num; i++)
            ;

        // only if found a matching slot
        if (i < m_pop3ConData->number_of_messages)
        {
          // to protect us from memory leak in case of getting a msg num twice
          m_pop3ConData->msg_info[i].uidl = PL_strdup(uid);
          if (!m_pop3ConData->msg_info[i].uidl)
          {
            PR_Free(line);
            return MK_OUT_OF_MEMORY;
          }
        }
      }
    }
    PR_Free(line);
    return(0);
}



/* this function decides if we are going to do a
 * normal RETR or a TOP.  The first time, it also decides the total number
 * of bytes we're probably going to get.
 */
int32_t nsPop3Protocol::GetMsg()
{
  int32_t popstateTimestamp = TimeInSecondsFromPRTime(PR_Now());

  if (m_pop3ConData->last_accessed_msg >= m_pop3ConData->number_of_messages)
  {
    /* Oh, gee, we're all done. */
    if(m_pop3ConData->msg_del_started)
    {
      if (!m_pop3ConData->only_uidl)
      {
        if (m_pop3ConData->only_check_for_new_mail)
          m_nsIPop3Sink->SetBiffStateAndUpdateFE(m_pop3ConData->biffstate, m_pop3ConData->really_new_messages, true);
        /* update old style biff */
        else
          m_nsIPop3Sink->SetBiffStateAndUpdateFE(nsIMsgFolder::nsMsgBiffState_NewMail, m_pop3ConData->really_new_messages, false);
      }
      m_nsIPop3Sink->EndMailDelivery(this);
    }

    m_pop3ConData->next_state = POP3_SEND_QUIT;
    return 0;
  }

  if (m_totalDownloadSize < 0)
  {
    /* First time.  Figure out how many bytes we're about to get.
    If we didn't get any message info, then we are going to get
    everything, and it's easy.  Otherwise, if we only want one
    uidl, than that's the only one we'll get.  Otherwise, go
    through each message info, decide if we're going to get that
    message, and add the number of bytes for it. When a message is too
    large (per user's preferences) only add the size we are supposed
    to get. */
    m_pop3ConData->really_new_messages = 0;
    m_pop3ConData->real_new_counter = 1;
    if (m_pop3ConData->msg_info)
    {
      m_totalDownloadSize = 0;
      for (int32_t i = 0; i < m_pop3ConData->number_of_messages; i++)
      {
        if (m_pop3ConData->only_uidl)
        {
          if (m_pop3ConData->msg_info[i].uidl &&
            !PL_strcmp(m_pop3ConData->msg_info[i].uidl, m_pop3ConData->only_uidl))
          {
            m_totalDownloadSize = m_pop3ConData->msg_info[i].size;
            m_pop3ConData->really_new_messages = 1;
            // we are only getting one message
            m_pop3ConData->real_new_counter = 1;
            break;
          }
          continue;
        }

        char c = 0;
        popstateTimestamp = TimeInSecondsFromPRTime(PR_Now());
        if (m_pop3ConData->msg_info[i].uidl)
        {
          Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) PL_HashTableLookup(m_pop3ConData->uidlinfo->hash,
            m_pop3ConData->msg_info[i].uidl);
          if (uidlEntry)
          {
            c = uidlEntry->status;
            popstateTimestamp = uidlEntry->dateReceived;
          }
        }
        if ((c == KEEP) && !m_pop3ConData->leave_on_server)
        { /* This message has been downloaded but kept on server, we
           * no longer want to keep it there */
          if (!m_pop3ConData->newuidl)
          {
            m_pop3ConData->newuidl = PL_NewHashTable(20, PL_HashString, PL_CompareStrings,
                                              PL_CompareValues, &gHashAllocOps, nullptr);
            if (!m_pop3ConData->newuidl)
              return MK_OUT_OF_MEMORY;
          }
          c = DELETE_CHAR;
          // Mark message to be deleted in new table
          put_hash(m_pop3ConData->newuidl,
            m_pop3ConData->msg_info[i].uidl, DELETE_CHAR, popstateTimestamp);
          // and old one too
          put_hash(m_pop3ConData->uidlinfo->hash,
            m_pop3ConData->msg_info[i].uidl, DELETE_CHAR, popstateTimestamp);
        }
        if ((c != KEEP) && (c != DELETE_CHAR) && (c != TOO_BIG))
        { // message left on server
          m_totalDownloadSize += m_pop3ConData->msg_info[i].size;
          m_pop3ConData->really_new_messages++;
          // a message we will really download
        }
      }
    }
    else
    {
      m_totalDownloadSize = m_totalFolderSize;
    }
    if (m_pop3ConData->only_check_for_new_mail)
    {
      if (m_totalDownloadSize > 0)
      {
        m_pop3ConData->biffstate = nsIMsgFolder::nsMsgBiffState_NewMail;
        m_nsIPop3Sink->SetBiffStateAndUpdateFE(nsIMsgFolder::nsMsgBiffState_NewMail, m_pop3ConData->really_new_messages, true);
      }
      m_pop3ConData->next_state = POP3_SEND_QUIT;
      return(0);
    }
    /* get the amount of available space on the drive
     * and make sure there is enough
     */
    if (m_totalDownloadSize > 0) // skip all this if there aren't any messages
    {
      nsCOMPtr<nsIMsgFolder> folder;

      // Get the current mailbox folder
      NS_ENSURE_TRUE(m_nsIPop3Sink, -1);
      nsresult rv = m_nsIPop3Sink->GetFolder(getter_AddRefs(folder));
      if (NS_FAILED(rv))
        return -1;

      nsCOMPtr<nsIMsgPluggableStore> msgStore;
      rv = folder->GetMsgStore(getter_AddRefs(msgStore));
      NS_ENSURE_SUCCESS(rv, -1);

      bool spaceAvailable;
      // check if we have a reasonable amount of space left
      rv = msgStore->HasSpaceAvailable(folder, m_totalDownloadSize, &spaceAvailable);
      if (NS_FAILED(rv) || !spaceAvailable) {
#ifdef DEBUG
        printf("Not enough disk space! Raising error!\n");
#endif
        return (Error(MK_POP3_OUT_OF_DISK_SPACE));
      }

      // Here we know how many messages we're going to download, so let
      // the pop3 sink know.
      rv = m_nsIPop3Sink->SetMsgsToDownload(m_pop3ConData->really_new_messages);
    }
  }

  /* Look at this message, and decide whether to ignore it, get it, just get
  the TOP of it, or delete it. */

  // if this is a message we've seen for the first time, we won't find it in
  // m_pop3ConData-uidlinfo->hash.  By default, we retrieve messages, unless they have a status,
  // or are too big, in which case we figure out what to do.
  if (m_prefAuthMethods != POP3_HAS_AUTH_USER && TestCapFlag(POP3_HAS_XSENDER))
    m_pop3ConData->next_state = POP3_SEND_XSENDER;
  else
    m_pop3ConData->next_state = POP3_SEND_RETR;
  m_pop3ConData->truncating_cur_msg = false;
  m_pop3ConData->pause_for_read = false;
  if (m_pop3ConData->msg_info)
  {
    Pop3MsgInfo* info = m_pop3ConData->msg_info + m_pop3ConData->last_accessed_msg;
    if (m_pop3ConData->only_uidl)
    {
      if (info->uidl == NULL || PL_strcmp(info->uidl, m_pop3ConData->only_uidl))
        m_pop3ConData->next_state = POP3_GET_MSG;
      else
        m_pop3ConData->next_state = POP3_SEND_RETR;
    }
    else
    {
      char c = 0;
      if (!m_pop3ConData->newuidl)
      {
        m_pop3ConData->newuidl = PL_NewHashTable(20, PL_HashString, PL_CompareStrings, PL_CompareValues, &gHashAllocOps, nullptr);
        if (!m_pop3ConData->newuidl)
          return MK_OUT_OF_MEMORY;
      }
      if (info->uidl)
      {
        Pop3UidlEntry *uidlEntry = (Pop3UidlEntry *) PL_HashTableLookup(m_pop3ConData->uidlinfo->hash, info->uidl);
        if (uidlEntry)
        {
          c = uidlEntry->status;
          popstateTimestamp = uidlEntry->dateReceived;
        }
      }
      if (c == DELETE_CHAR)
      {
        m_pop3ConData->next_state = POP3_SEND_DELE;
      }
      else if (c == KEEP)
      {
        // this is a message we've already downloaded and left on server;
        // Advance to next message.
        m_pop3ConData->next_state = POP3_GET_MSG;
      }
      else if (c == FETCH_BODY)
      {
        m_pop3ConData->next_state = POP3_SEND_RETR;
        PL_HashTableRemove (m_pop3ConData->uidlinfo->hash, (void*)info->uidl);
      }
      else if ((c != TOO_BIG) &&
        (TestCapFlag(POP3_TOP_UNDEFINED | POP3_HAS_TOP)) &&
        (m_pop3ConData->headers_only ||
         ((m_pop3ConData->size_limit > 0) &&
          (info->size > m_pop3ConData->size_limit) &&
          !m_pop3ConData->only_uidl)) &&
        info->uidl && *info->uidl)
      {
        // message is too big
        m_pop3ConData->truncating_cur_msg = true;
        m_pop3ConData->next_state = POP3_SEND_TOP;
        put_hash(m_pop3ConData->newuidl, info->uidl, TOO_BIG, popstateTimestamp);
      }
      else if (c == TOO_BIG)
      {
        /* message previously left on server, see if the max download size
        has changed, because we may want to download the message this time
        around. Otherwise ignore the message, we have the header. */
        if ((m_pop3ConData->size_limit > 0) && (info->size <=
          m_pop3ConData->size_limit))
          PL_HashTableRemove (m_pop3ConData->uidlinfo->hash, (void*)info->uidl);
        // remove from our table, and download
        else
        {
          m_pop3ConData->truncating_cur_msg = true;
          m_pop3ConData->next_state = POP3_GET_MSG;
          // ignore this message and get next one
          put_hash(m_pop3ConData->newuidl, info->uidl, TOO_BIG, popstateTimestamp);
        }
      }

      if (m_pop3ConData->next_state != POP3_SEND_DELE &&
          info->uidl)
      {
        /* This is a message we have decided to keep on the server. Notate
            that now for the future. (Don't change the popstate file at all
            if only_uidl is set; in that case, there might be brand new messages
            on the server that we *don't* want to mark KEEP; we just want to
            leave them around until the user next does a GetNewMail.) */

        /* If this is a message we already know about (i.e., it was
            in popstate.dat already), we need to maintain the original
            date the message was downloaded. */
        if (m_pop3ConData->truncating_cur_msg)
          put_hash(m_pop3ConData->newuidl, info->uidl, TOO_BIG, popstateTimestamp);
        else
          put_hash(m_pop3ConData->newuidl, info->uidl, KEEP, popstateTimestamp);
      }
    }
    if (m_pop3ConData->next_state == POP3_GET_MSG)
      m_pop3ConData->last_accessed_msg++;
    // Make sure we check the next message next time!
  }
  return 0;
}


/* start retreiving just the first 20 lines
 */
int32_t nsPop3Protocol::SendTop()
{
   char * cmd = PR_smprintf( "TOP %ld %d" CRLF,
     m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg].msgnum,
     m_pop3ConData->headers_only ? 0 : 20);
   int32_t status = -1;
   if (cmd)
   {
     m_pop3ConData->next_state_after_response = POP3_TOP_RESPONSE;
     m_pop3ConData->cur_msg_size = -1;

     /* zero the bytes received in message in preparation for
     * the next
     */
     m_bytesInMsgReceived = 0;
     status = Pop3SendData(cmd);
   }
   PR_Free(cmd);
   return status;
}

/* send the xsender command
 */
int32_t nsPop3Protocol::SendXsender()
{
  char * cmd = PR_smprintf("XSENDER %ld" CRLF, m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg].msgnum);
  int32_t status = -1;
  if (cmd)
  {
    m_pop3ConData->next_state_after_response = POP3_XSENDER_RESPONSE;
    status = Pop3SendData(cmd);
    PR_Free(cmd);
  }
  return status;
}

int32_t nsPop3Protocol::XsenderResponse()
{
    m_pop3ConData->seenFromHeader = false;
    m_senderInfo = "";

    if (m_pop3ConData->command_succeeded) {
        if (m_commandResponse.Length() > 4)
            m_senderInfo = m_commandResponse;
    }
    else {
        ClearCapFlag(POP3_HAS_XSENDER);
        m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
    }

    if (m_pop3ConData->truncating_cur_msg)
        m_pop3ConData->next_state = POP3_SEND_TOP;
    else
        m_pop3ConData->next_state = POP3_SEND_RETR;
    return 0;
}

/* retreive the whole message
 */
int32_t
nsPop3Protocol::SendRetr()
{

  char * cmd = PR_smprintf("RETR %ld" CRLF, m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg].msgnum);
  int32_t status = -1;
  if (cmd)
  {
    m_pop3ConData->next_state_after_response = POP3_RETR_RESPONSE;
    m_pop3ConData->cur_msg_size = -1;


    /* zero the bytes received in message in preparation for
    * the next
    */
    m_bytesInMsgReceived = 0;

    if (m_pop3ConData->only_uidl)
    {
      /* Display bytes if we're only downloading one message. */
      PR_ASSERT(!m_pop3ConData->graph_progress_bytes_p);
      UpdateProgressPercent(0, m_totalDownloadSize);
      m_pop3ConData->graph_progress_bytes_p = true;
    }
    else
    {
      nsString finalString;
      nsresult rv = FormatCounterString(NS_LITERAL_STRING("receivingMsgs"),
                          m_pop3ConData->real_new_counter,
                          m_pop3ConData->really_new_messages,
                          finalString);

      NS_ASSERTION(NS_SUCCEEDED(rv), "couldn't format string");
      if (m_statusFeedback)
        m_statusFeedback->ShowStatusString(finalString);
    }

    status = Pop3SendData(cmd);
  } // if cmd
  PR_Free(cmd);
  return status;
}

/* digest the message
 */
int32_t
nsPop3Protocol::RetrResponse(nsIInputStream* inputStream,
                             uint32_t length)
{
    uint32_t buffer_size;
    int32_t flags = 0;
    char *uidl = NULL;
    nsresult rv;
#if 0
    int32_t old_bytes_received = m_totalBytesReceived;
#endif
    uint32_t status = 0;

    if(m_pop3ConData->cur_msg_size == -1)
    {
        /* this is the beginning of a message
         * get the response code and byte size
         */
        if(!m_pop3ConData->command_succeeded)
            return Error(POP3_RETR_FAILURE);

        /* a successful RETR response looks like: #num_bytes Junk
           from TOP we only get the +OK and data
           */
        if (m_pop3ConData->truncating_cur_msg)
        { /* TOP, truncated message */
            flags |= nsMsgMessageFlags::Partial;
        }
        else
        {
          nsCString cmdResp(m_commandResponse);
          char *newStr = cmdResp.BeginWriting();
          char *num = NS_strtok( " ", &newStr);
          if (num)
            m_pop3ConData->cur_msg_size = atol(num);
          m_commandResponse = newStr;
        }

        /* RETR complete message */
        if (!m_senderInfo.IsEmpty())
            flags |= nsMsgMessageFlags::SenderAuthed;

        if(m_pop3ConData->cur_msg_size <= 0)
        {
          if (m_pop3ConData->msg_info)
            m_pop3ConData->cur_msg_size = m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg].size;
          else
            m_pop3ConData->cur_msg_size = 0;
        }

        if (m_pop3ConData->msg_info &&
            m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg].uidl)
            uidl = m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg].uidl;

        m_pop3ConData->parsed_bytes = 0;
        m_pop3ConData->pop3_size = m_pop3ConData->cur_msg_size;
        m_pop3ConData->assumed_end = false;

        m_pop3Server->GetDotFix(&m_pop3ConData->dot_fix);

        PR_LOG(POP3LOGMODULE,PR_LOG_ALWAYS,
               ("Opening message stream: MSG_IncorporateBegin"));

        /* open the message stream so we have someplace
         * to put the data
         */
        m_pop3ConData->real_new_counter++;
        /* (rb) count only real messages being downloaded */
        rv = m_nsIPop3Sink->IncorporateBegin(uidl, m_url, flags,
                                        &m_pop3ConData->msg_closure);

        PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS, ("Done opening message stream!"));

        if(!m_pop3ConData->msg_closure || NS_FAILED(rv))
            return(Error(POP3_MESSAGE_WRITE_ERROR));
    }

    m_pop3ConData->pause_for_read = true;

    bool pauseForMoreData = false;
    char *line = m_lineStreamBuffer->ReadNextLine(inputStream, status, pauseForMoreData, &rv, true);
    PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));
    if (NS_FAILED(rv))
      return -1;

    buffer_size = status;

    if (status == 0 && !line)  // no bytes read in...
      return (0);

    if (m_pop3ConData->msg_closure) /* not done yet */
    {
      // buffer the line we just read in, and buffer all remaining lines in the stream
      status = buffer_size;
      do
      {
        if (m_pop3ConData->msg_closure)
        {
          rv = HandleLine(line, buffer_size);
          if (NS_FAILED(rv))
            return (Error(POP3_MESSAGE_WRITE_ERROR));

          // buffer_size already includes MSG_LINEBREAK_LEN so
          // subtract and add CRLF
          // but not really sure we always had CRLF in input since
          // we also treat a single LF as line ending!
          m_pop3ConData->parsed_bytes += buffer_size - MSG_LINEBREAK_LEN + 2;
        }

        // now read in the next line
        PR_Free(line);
        line = m_lineStreamBuffer->ReadNextLine(inputStream, buffer_size,
                                                pauseForMoreData, &rv, true);
        if (NS_FAILED(rv))
          return -1;

        PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,("RECV: %s", line));
        // buffer_size already includes MSG_LINEBREAK_LEN so
        // subtract and add CRLF
        // but not really sure we always had CRLF in input since
        // we also treat a single LF as line ending!
        status += buffer_size - MSG_LINEBREAK_LEN + 2;
      } while (line);
    }

    buffer_size = status;  // status holds # bytes we've actually buffered so far...

    /* normal read. Yay! */
    if ((int32_t) (m_bytesInMsgReceived + buffer_size) > m_pop3ConData->cur_msg_size)
        buffer_size = m_pop3ConData->cur_msg_size - m_bytesInMsgReceived;

    m_bytesInMsgReceived += buffer_size;
    m_totalBytesReceived += buffer_size;

    // *** jefft in case of the message size that server tells us is different
    // from the actual message size
    if (pauseForMoreData && m_pop3ConData->dot_fix &&
        m_pop3ConData->assumed_end && m_pop3ConData->msg_closure)
    {
        nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url, &rv);
        nsCOMPtr<nsIMsgWindow> msgWindow;
        if (NS_SUCCEEDED(rv))
          rv = mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow));
        rv = m_nsIPop3Sink->IncorporateComplete(msgWindow,
          m_pop3ConData->truncating_cur_msg ? m_pop3ConData->cur_msg_size : 0);

        // The following was added to prevent the loss of Data when we try
        // and write to somewhere we don't have write access error to (See
        // bug 62480)
        // (Note: This is only a temp hack until the underlying XPCOM is
        // fixed to return errors)

        if (NS_FAILED(rv))
            return (Error((rv == NS_MSG_ERROR_COPYING_FROM_TMP_DOWNLOAD)
                           ? POP3_TMP_DOWNLOAD_FAILED
                           : POP3_MESSAGE_WRITE_ERROR));

        m_pop3ConData->msg_closure = nullptr;
    }

    if (!m_pop3ConData->msg_closure)
        /* meaning _handle_line read ".\r\n" at end-of-msg */
    {
        m_pop3ConData->pause_for_read = false;

        if (m_pop3ConData->truncating_cur_msg ||
            m_pop3ConData->leave_on_server )
        {
            Pop3UidlEntry *uidlEntry = NULL;
            Pop3MsgInfo* info = m_pop3ConData->msg_info + m_pop3ConData->last_accessed_msg;

            /* Check for filter actions - FETCH or DELETE */
            if ((m_pop3ConData->newuidl) && (info->uidl))
              uidlEntry = (Pop3UidlEntry *)PL_HashTableLookup(m_pop3ConData->newuidl, info->uidl);

            if (uidlEntry && uidlEntry->status == FETCH_BODY &&
                m_pop3ConData->truncating_cur_msg)
            {
            /* A filter decided to retrieve this full msg.
               Use GetMsg() so the popstate will update correctly,
               but don't let this msg get counted twice. */
               m_pop3ConData->next_state = POP3_GET_MSG;
               m_pop3ConData->real_new_counter--;
            /* Make sure we don't try to come through here again. */
               PL_HashTableRemove (m_pop3ConData->newuidl, (void*)info->uidl);
               put_hash(m_pop3ConData->uidlinfo->hash, info->uidl, FETCH_BODY, uidlEntry->dateReceived);

            } else if (uidlEntry && uidlEntry->status == DELETE_CHAR)
            {
            // A filter decided to delete this msg from the server
               m_pop3ConData->next_state = POP3_SEND_DELE;
            } else
            {
            /* We've retrieved all or part of this message, but we want to
               keep it on the server.  Go on to the next message. */
               m_pop3ConData->last_accessed_msg++;
               m_pop3ConData->next_state = POP3_GET_MSG;
            }
            if (m_pop3ConData->only_uidl)
            {
            /* GetMsg didn't update this field. Do it now */
              uidlEntry = (Pop3UidlEntry *)PL_HashTableLookup(m_pop3ConData->uidlinfo->hash, m_pop3ConData->only_uidl);
              NS_ASSERTION(uidlEntry, "uidl not found in uidlinfo");
              if (uidlEntry)
                put_hash(m_pop3ConData->uidlinfo->hash, m_pop3ConData->only_uidl, KEEP, uidlEntry->dateReceived);
            }
        }
        else
        {
           m_pop3ConData->next_state = POP3_SEND_DELE;
        }

        /* if we didn't get the whole message add the bytes that we didn't get
           to the bytes received part so that the progress percent stays sane.
           */
        if(m_bytesInMsgReceived < m_pop3ConData->cur_msg_size)
            m_totalBytesReceived += (m_pop3ConData->cur_msg_size -
                                   m_bytesInMsgReceived);
    }

    /* set percent done to portion of total bytes of all messages
       that we're going to download. */
    if (m_totalDownloadSize)
      UpdateProgressPercent(m_totalBytesReceived, m_totalDownloadSize);

    PR_Free(line);
    return(0);
}


int32_t
nsPop3Protocol::TopResponse(nsIInputStream* inputStream, uint32_t length)
{
  if (TestCapFlag(POP3_TOP_UNDEFINED))
  {
    ClearCapFlag(POP3_TOP_UNDEFINED);
    if (m_pop3ConData->command_succeeded)
      SetCapFlag(POP3_HAS_TOP);
    else
      ClearCapFlag(POP3_HAS_TOP);
    m_pop3Server->SetPop3CapabilityFlags(m_pop3ConData->capability_flags);
  }

  if(m_pop3ConData->cur_msg_size == -1 &&  /* first line after TOP command sent */
    !m_pop3ConData->command_succeeded)  /* and TOP command failed */
  {
  /* TOP doesn't work so we can't retrieve the first part of this msg.
  So just go download the whole thing, and warn the user.

    Note that the progress bar will not be accurate in this case.
    Oops. #### */
    m_pop3ConData->truncating_cur_msg = false;

    nsString statusTemplate;
    mLocalBundle->GetStringFromID(POP3_SERVER_DOES_NOT_SUPPORT_THE_TOP_COMMAND, getter_Copies(statusTemplate));
    if (!statusTemplate.IsEmpty())
    {
      nsAutoCString hostName;
      PRUnichar * statusString = nullptr;
      m_url->GetHost(hostName);

      statusString = nsTextFormatter::smprintf(statusTemplate.get(), hostName.get());
      UpdateStatusWithString(statusString);
      nsTextFormatter::smprintf_free(statusString);
    }

    if (m_prefAuthMethods != POP3_HAS_AUTH_USER &&
        TestCapFlag(POP3_HAS_XSENDER))
      m_pop3ConData->next_state = POP3_SEND_XSENDER;
    else
      m_pop3ConData->next_state = POP3_SEND_RETR;
    return(0);
  }

  /* If TOP works, we handle it in the same way as RETR. */
  return RetrResponse(inputStream, length);
}

/* line is handed over as null-terminated string with MSG_LINEBREAK */
nsresult
nsPop3Protocol::HandleLine(char *line, uint32_t line_length)
{
    nsresult rv = NS_OK;

    NS_ASSERTION(m_pop3ConData->msg_closure, "m_pop3ConData->msg_closure is null in nsPop3Protocol::HandleLine()");
    if (!m_pop3ConData->msg_closure)
        return NS_ERROR_NULL_POINTER;

    if (!m_senderInfo.IsEmpty() && !m_pop3ConData->seenFromHeader)
    {
        if (line_length > 6 && !PL_strncasecmp("From: ", line, 6))
        {
            m_pop3ConData->seenFromHeader = true;
            if (PL_strstr(line, m_senderInfo.get()) == NULL)
                m_nsIPop3Sink->SetSenderAuthedFlag(m_pop3ConData->msg_closure,
                                                     false);
        }
    }

    // line contains only a single dot and linebreak -> message end
    if (line_length == 1 + MSG_LINEBREAK_LEN && line[0] == '.')
    {
        m_pop3ConData->assumed_end = true;  /* in case byte count from server is */
                                    /* wrong, mark we may have had the end */
        if (!m_pop3ConData->dot_fix || m_pop3ConData->truncating_cur_msg ||
            (m_pop3ConData->parsed_bytes >= (m_pop3ConData->pop3_size -3)))
        {
            nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url, &rv);
            nsCOMPtr<nsIMsgWindow> msgWindow;
            if (NS_SUCCEEDED(rv))
              rv = mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow));
            rv = m_nsIPop3Sink->IncorporateComplete(msgWindow,
              m_pop3ConData->truncating_cur_msg ? m_pop3ConData->cur_msg_size : 0);

            // The following was added to prevent the loss of Data when we try
            // and write to somewhere we don't have write access error to (See
            // bug 62480)
            // (Note: This is only a temp hack until the underlying XPCOM is
            // fixed to return errors)

            if (NS_FAILED(rv))
              // XXX Error() returns -1, which is not a valid nsresult
              return static_cast<nsresult>(Error(
                             (rv == NS_MSG_ERROR_COPYING_FROM_TMP_DOWNLOAD)
                             ? POP3_TMP_DOWNLOAD_FAILED
                             : POP3_MESSAGE_WRITE_ERROR));

            m_pop3ConData->msg_closure = nullptr;
            return rv;
        }
    }
    /* Check if the line begins with the termination octet. If so
       and if another termination octet follows, we step over the
       first occurence of it. */
    else if (line_length > 1 && line[0] == '.' && line[1] == '.') {
        line++;
        line_length--;

    }

    return m_nsIPop3Sink->IncorporateWrite(line, line_length);
}

int32_t nsPop3Protocol::SendDele()
{
    /* increment the last accessed message since we have now read it
     */
    char * cmd = PR_smprintf("DELE %ld" CRLF, m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg].msgnum);
    m_pop3ConData->last_accessed_msg++;
    int32_t status = -1;
    if (cmd)
    {
      m_pop3ConData->next_state_after_response = POP3_DELE_RESPONSE;
      status = Pop3SendData(cmd);
    }
    PR_Free(cmd);
    return status;
}

int32_t nsPop3Protocol::DeleResponse()
{
  Pop3UidlHost *host = NULL;

  host = m_pop3ConData->uidlinfo;

  /* the return from the delete will come here
  */
  if(!m_pop3ConData->command_succeeded)
    return(Error(POP3_DELE_FAILURE));


  /*  ###chrisf
  the delete succeeded.  Write out state so that we
  keep track of all the deletes which have not yet been
  committed on the server.  Flush this state upon successful
  QUIT.

  We will do this by adding each successfully deleted message id
  to a list which we will write out to popstate.dat in
  net_pop3_write_state().
  */
  if (host)
  {
    if (m_pop3ConData->msg_info &&
      m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg-1].uidl)
    {
      if (m_pop3ConData->newuidl)
        if (m_pop3ConData->leave_on_server)
        {
          PL_HashTableRemove(m_pop3ConData->newuidl, (void*)
            m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg-1].uidl);
        }
        else
        {
          put_hash(m_pop3ConData->newuidl,
            m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg-1].uidl, DELETE_CHAR, 0);
          /* kill message in new hash table */
        }
      else
        PL_HashTableRemove(host->hash,
            (void*) m_pop3ConData->msg_info[m_pop3ConData->last_accessed_msg-1].uidl);
    }
  }

  m_pop3ConData->next_state = POP3_GET_MSG;
  m_pop3ConData->pause_for_read = false;

  return(0);
}


int32_t
nsPop3Protocol::CommitState(bool remove_last_entry)
{
  // only use newuidl if we successfully finished looping through all the
  // messages in the inbox.
  if (m_pop3ConData->newuidl)
  {
    if (m_pop3ConData->last_accessed_msg >= m_pop3ConData->number_of_messages)
    {
      PL_HashTableDestroy(m_pop3ConData->uidlinfo->hash);
      m_pop3ConData->uidlinfo->hash = m_pop3ConData->newuidl;
      m_pop3ConData->newuidl = nullptr;
    }
    else
    {
      /* If we are leaving messages on the server, pull out the last
        uidl from the hash, because it might have been put in there before
        we got it into the database.
      */
      if (remove_last_entry && m_pop3ConData->msg_info &&
          !m_pop3ConData->only_uidl && m_pop3ConData->newuidl->nentries > 0)
      {
        Pop3MsgInfo* info = m_pop3ConData->msg_info + m_pop3ConData->last_accessed_msg;
        if (info && info->uidl)
        {
          bool val = PL_HashTableRemove(m_pop3ConData->newuidl, info->uidl);
          NS_ASSERTION(val, "uidl not in hash table");
        }
      }

      // Add the entries in newuidl to m_pop3ConData->uidlinfo->hash to keep
      // track of the messages we *did* download in this session.
      PL_HashTableEnumerateEntries(m_pop3ConData->newuidl, net_pop3_copy_hash_entries, (void *)m_pop3ConData->uidlinfo->hash);
    }
  }

  if (!m_pop3ConData->only_check_for_new_mail)
  {
    nsresult rv;
    nsCOMPtr<nsIFile> mailDirectory;

    // get the mail directory
    nsCOMPtr<nsIMsgIncomingServer> server =
      do_QueryInterface(m_pop3Server, &rv);
    if (NS_FAILED(rv)) return -1;

    rv = server->GetLocalPath(getter_AddRefs(mailDirectory));
    if (NS_FAILED(rv)) return -1;

    // write the state in the mail directory
    net_pop3_write_state(m_pop3ConData->uidlinfo, mailDirectory.get());
  }
  return 0;
}


/* NET_process_Pop3  will control the state machine that
 * loads messages from a pop3 server
 *
 * returns negative if the transfer is finished or error'd out
 *
 * returns zero or more if the transfer needs to be continued.
 */
nsresult nsPop3Protocol::ProcessProtocolState(nsIURI * url, nsIInputStream * aInputStream,
                                              uint64_t sourceOffset, uint32_t aLength)
{
  int32_t status = 0;
  bool urlStatusSet = false;
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsurl = do_QueryInterface(m_url);

  PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS, ("Entering NET_ProcessPop3 %d",
    aLength));

  m_pop3ConData->pause_for_read = false; /* already paused; reset */

  if(m_username.IsEmpty())
  {
    // net_pop3_block = false;
    // XXX Error() returns -1, which is not a valid nsresult
    return static_cast<nsresult>(Error(POP3_USERNAME_UNDEFINED));
  }

  while(!m_pop3ConData->pause_for_read)
  {
    PR_LOG(POP3LOGMODULE, PR_LOG_ALWAYS,
      ("POP3: Entering state: %d", m_pop3ConData->next_state));

    switch(m_pop3ConData->next_state)
    {
    case POP3_READ_PASSWORD:
      // This is a separate state so that we're waiting for the user to type
      // in a password while we don't actually have a connection to the pop
      // server open; this saves us from having to worry about the server
      // timing out on us while we wait for user input.
      if (NS_FAILED(StartGetAsyncPassword(POP3_OBTAIN_PASSWORD_EARLY)))
        status = -1;
      break;
    case POP3_FINISH_OBTAIN_PASSWORD_EARLY:
      {
        if (m_passwordResult.IsEmpty() || m_username.IsEmpty())
        {
          status = MK_POP3_PASSWORD_UNDEFINED;
          m_pop3ConData->biffstate = nsIMsgFolder::nsMsgBiffState_Unknown;
          m_nsIPop3Sink->SetBiffStateAndUpdateFE(m_pop3ConData->biffstate, 0, false);

          /* update old style biff */
          m_pop3ConData->next_state = POP3_FREE;
          m_pop3ConData->pause_for_read = false;
          break;
        }

        m_pop3ConData->pause_for_read = false;
        // we are already connected so just go on and send the username
        if (m_prefAuthMethods == POP3_HAS_AUTH_USER)
        {
          m_currentAuthMethod = POP3_HAS_AUTH_USER;
          m_pop3ConData->next_state = POP3_SEND_USERNAME;
        }
        else
        {
          if (TestCapFlag(POP3_AUTH_MECH_UNDEFINED))
            m_pop3ConData->next_state = POP3_SEND_AUTH;
          else
            m_pop3ConData->next_state = POP3_SEND_CAPA;
        }
        break;
      }


    case POP3_START_CONNECT:
      {
        m_pop3ConData->next_state = POP3_FINISH_CONNECT;
        m_pop3ConData->pause_for_read = false;
        break;
      }

    case POP3_FINISH_CONNECT:
      {
        m_pop3ConData->pause_for_read = false;
        m_pop3ConData->next_state = POP3_WAIT_FOR_START_OF_CONNECTION_RESPONSE;
        break;
      }

    case POP3_WAIT_FOR_RESPONSE:
      status = WaitForResponse(aInputStream, aLength);
      break;

    case POP3_WAIT_FOR_START_OF_CONNECTION_RESPONSE:
      {
        status = WaitForStartOfConnectionResponse(aInputStream, aLength);

        if(status)
        {
          if (m_prefAuthMethods == POP3_HAS_AUTH_USER)
          {
            m_currentAuthMethod = POP3_HAS_AUTH_USER;
            m_pop3ConData->next_state = POP3_SEND_USERNAME;
          }
          else
          {
            if (TestCapFlag(POP3_AUTH_MECH_UNDEFINED))
              m_pop3ConData->next_state = POP3_SEND_AUTH;
            else
              m_pop3ConData->next_state = POP3_SEND_CAPA;
          }
        }

        break;
      }

    case POP3_SEND_AUTH:
      status = SendAuth();
      break;

    case POP3_AUTH_RESPONSE:
      status = AuthResponse(aInputStream, aLength);
      break;

   case POP3_SEND_CAPA:
      status = SendCapa();
      break;

    case POP3_CAPA_RESPONSE:
      status = CapaResponse(aInputStream, aLength);
      break;

    case POP3_TLS_RESPONSE:
      status = SendTLSResponse();
      break;

    case POP3_PROCESS_AUTH:
      status = ProcessAuth();
      break;

    case POP3_NEXT_AUTH_STEP:
      status = NextAuthStep();
      break;

    case POP3_AUTH_LOGIN:
      status = AuthLogin();
      break;

    case POP3_AUTH_LOGIN_RESPONSE:
      status = AuthLoginResponse();
      break;

    case POP3_AUTH_NTLM:
      status = AuthNtlm();
      break;

    case POP3_AUTH_NTLM_RESPONSE:
      status = AuthNtlmResponse();
      break;

    case POP3_AUTH_GSSAPI:
      status = AuthGSSAPI();
      break;

    case POP3_AUTH_GSSAPI_FIRST:
      UpdateStatus(NS_LITERAL_STRING("hostContacted"));
      status = AuthGSSAPIResponse(true);
      break;

    case POP3_AUTH_GSSAPI_STEP:
      status = AuthGSSAPIResponse(false);
      break;

    case POP3_SEND_USERNAME:
      if (NS_FAILED(StartGetAsyncPassword(POP3_OBTAIN_PASSWORD_BEFORE_USERNAME)))
        status = -1;
      break;

    case POP3_OBTAIN_PASSWORD_BEFORE_USERNAME:
      status = -1;
      break;

    case POP3_FINISH_OBTAIN_PASSWORD_BEFORE_USERNAME:
      UpdateStatus(NS_LITERAL_STRING("hostContacted"));
      status = SendUsername();
      break;

    case POP3_SEND_PASSWORD:
      if (NS_FAILED(StartGetAsyncPassword(POP3_OBTAIN_PASSWORD_BEFORE_PASSWORD)))
        status = -1;
      break;

    case POP3_FINISH_OBTAIN_PASSWORD_BEFORE_PASSWORD:
      status = SendPassword();
      break;

    case POP3_SEND_GURL:
      status = SendGurl();
      break;

    case POP3_GURL_RESPONSE:
      status = GurlResponse();
      break;

    case POP3_SEND_STAT:
      status = SendStat();
      break;

    case POP3_GET_STAT:
      status = GetStat();
      break;

    case POP3_SEND_LIST:
      status = SendList();
      break;

    case POP3_GET_LIST:
      status = GetList(aInputStream, aLength);
      break;

    case POP3_SEND_UIDL_LIST:
      status = SendUidlList();
      break;

    case POP3_GET_UIDL_LIST:
      status = GetUidlList(aInputStream, aLength);
      break;

    case POP3_SEND_XTND_XLST_MSGID:
      status = SendXtndXlstMsgid();
      break;

    case POP3_GET_XTND_XLST_MSGID:
      status = GetXtndXlstMsgid(aInputStream, aLength);
      break;

    case POP3_GET_MSG:
      status = GetMsg();
      break;

    case POP3_SEND_TOP:
      status = SendTop();
      break;

    case POP3_TOP_RESPONSE:
      status = TopResponse(aInputStream, aLength);
      break;

    case POP3_SEND_XSENDER:
      status = SendXsender();
      break;

    case POP3_XSENDER_RESPONSE:
      status = XsenderResponse();
      break;

    case POP3_SEND_RETR:
      status = SendRetr();
      break;

    case POP3_RETR_RESPONSE:
      status = RetrResponse(aInputStream, aLength);
      break;

    case POP3_SEND_DELE:
      status = SendDele();
      break;

    case POP3_DELE_RESPONSE:
      status = DeleResponse();
      break;

    case POP3_SEND_QUIT:
    /* attempt to send a server quit command.  Since this means
    everything went well, this is a good time to update the
    status file and the FE's biff state.
      */
      if (!m_pop3ConData->only_uidl)
      {
        /* update old style biff */
        if (!m_pop3ConData->only_check_for_new_mail)
        {
        /* We don't want to pop up a warning message any more (see
        bug 54116), so instead we put the "no new messages" or
        "retrieved x new messages"
        in the status line.  Unfortunately, this tends to be running
        in a progress pane, so we try to get the real pane and
          show the message there. */

          if (m_totalDownloadSize <= 0)
          {
            UpdateStatus(NS_LITERAL_STRING("noMessages"));
            /* There are no new messages.  */
          }
          else
          {
            nsString statusString;
            nsresult rv = FormatCounterString(NS_LITERAL_STRING("receivedMessages"),
                                              m_pop3ConData->real_new_counter - 1,
                                              m_pop3ConData->really_new_messages,
                                              statusString);
            if (NS_SUCCEEDED(rv))
              UpdateStatusWithString(statusString.get());
          }
        }
      }

      status = Pop3SendData("QUIT" CRLF);
      m_pop3ConData->next_state = POP3_WAIT_FOR_RESPONSE;
      m_pop3ConData->next_state_after_response = POP3_QUIT_RESPONSE;
      break;

    case POP3_QUIT_RESPONSE:
      if(m_pop3ConData->command_succeeded)
      {
      /*  the QUIT succeeded.  We can now flush the state in popstate.dat which
        keeps track of any uncommitted DELE's */

        /* clear the hash of all our uncommitted deletes */
        if (!m_pop3ConData->leave_on_server && m_pop3ConData->newuidl)
        {
          PL_HashTableEnumerateEntries(m_pop3ConData->newuidl,
                                        net_pop3_remove_messages_marked_delete,
                                       (void *)m_pop3ConData);
        }
        m_pop3ConData->next_state = POP3_DONE;
      }
      else
      {
        m_pop3ConData->next_state = POP3_ERROR_DONE;
      }
      break;

    case POP3_DONE:
      CommitState(false);
      m_pop3ConData->urlStatus = NS_OK;
      urlStatusSet = true;
      m_pop3ConData->next_state = POP3_FREE;
      break;

    case POP3_ERROR_DONE:
      /*  write out the state */
      if(m_pop3ConData->list_done)
        CommitState(true);

      if(m_pop3ConData->msg_closure)
      {
        m_nsIPop3Sink->IncorporateAbort(m_pop3ConData->only_uidl != nullptr);
        m_pop3ConData->msg_closure = NULL;
        m_nsIPop3Sink->AbortMailDelivery(this);
      }

      if(m_pop3ConData->msg_del_started)
      {
        nsString statusString;
        nsresult rv = FormatCounterString(NS_LITERAL_STRING("receivedMessages"),
                                 m_pop3ConData->real_new_counter - 1,
                                 m_pop3ConData->really_new_messages,
                                 statusString);
        if (NS_SUCCEEDED(rv))
          UpdateStatusWithString(statusString.get());

        NS_ASSERTION (!TestFlag(POP3_PASSWORD_FAILED), "POP3_PASSWORD_FAILED set when del_started");
        m_nsIPop3Sink->AbortMailDelivery(this);
      }
      { // this brace is to avoid compiler error about vars in switch case.
        nsCOMPtr<nsIMsgWindow> msgWindow;

        if (mailnewsurl)
          mailnewsurl->GetMsgWindow(getter_AddRefs(msgWindow));
        // no msgWindow means no re-prompt, so treat as error.
        if (TestFlag(POP3_PASSWORD_FAILED) && msgWindow)
        {
          // We get here because the password was wrong.
          if (!m_socketIsOpen && mailnewsurl)
          {
            // The server dropped the connection, so we're going
            // to re-run the url.
            PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("need to rerun url because connection dropped during auth"));
            m_needToRerunUrl = true;
            return NS_OK;
          }
          m_pop3ConData->next_state = POP3_READ_PASSWORD;
          m_pop3ConData->command_succeeded = true;
          status = 0;
          break;
        }
        else
          /* Else we got a "real" error, so finish up. */
          m_pop3ConData->next_state = POP3_FREE;
      }
      m_pop3ConData->urlStatus = NS_ERROR_FAILURE;
      urlStatusSet = true;
      m_pop3ConData->pause_for_read = false;
      break;

    case POP3_FREE:
      {
        UpdateProgressPercent(0,0); // clear out the progress meter
        nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(m_pop3Server);
        if (server)
        {
          PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("Clearing server busy in POP3_FREE"));
          server->SetServerBusy(false); // the server is now not busy
        }
        PR_LOG(POP3LOGMODULE, PR_LOG_MAX, ("Clearing running protocol in POP3_FREE"));
        CloseSocket();
        m_pop3Server->SetRunningProtocol(nullptr);
        if (mailnewsurl && urlStatusSet)
          mailnewsurl->SetUrlState(false, m_pop3ConData->urlStatus);

        m_url = nullptr;
        return NS_OK;
      }
    default:
      NS_ERROR("Got to unexpected state in nsPop3Protocol::ProcessProtocolState");
      status = -1;
    }  /* end switch */

    if((status < 0) && m_pop3ConData->next_state != POP3_FREE)
    {
      m_pop3ConData->pause_for_read = false;
      m_pop3ConData->next_state = POP3_ERROR_DONE;
    }

  }  /* end while */

  return NS_OK;

}

NS_IMETHODIMP nsPop3Protocol::MarkMessages(nsVoidArray *aUIDLArray)
{
  NS_ENSURE_ARG_POINTER(aUIDLArray);
  uint32_t count = aUIDLArray->Count();

  for (uint32_t i = 0; i < count; i++)
  {
    bool changed;
    if (m_pop3ConData->newuidl)
      MarkMsgInHashTable(m_pop3ConData->newuidl, static_cast<Pop3UidlEntry*>(aUIDLArray->ElementAt(i)), &changed);
    if (m_pop3ConData->uidlinfo)
      MarkMsgInHashTable(m_pop3ConData->uidlinfo->hash, static_cast<Pop3UidlEntry*>(aUIDLArray->ElementAt(i)), &changed);
  }
  return NS_OK;
}

NS_IMETHODIMP nsPop3Protocol::CheckMessage(const char *aUidl, bool *aBool)
{
  Pop3UidlEntry *uidlEntry = nullptr;

  if (aUidl)
  {
    if (m_pop3ConData->newuidl)
      uidlEntry = (Pop3UidlEntry *) PL_HashTableLookup(m_pop3ConData->newuidl, aUidl);
    else if (m_pop3ConData->uidlinfo)
      uidlEntry = (Pop3UidlEntry *) PL_HashTableLookup(m_pop3ConData->uidlinfo->hash, aUidl);
  }

  *aBool = uidlEntry ? true : false;
  return NS_OK;
}


/* Function for finding an APOP Timestamp and simple check
   it for its validity. If returning NS_OK m_ApopTimestamp
   contains the validated substring of m_commandResponse. */
nsresult nsPop3Protocol::GetApopTimestamp()
{
  int32_t startMark = m_commandResponse.Length(), endMark = -1;

  while (true)
  {
    // search for previous <
    if ((startMark = MsgRFindChar(m_commandResponse, '<', startMark - 1)) < 0)
      return NS_ERROR_FAILURE;

    // search for next >
    if ((endMark = m_commandResponse.FindChar('>', startMark)) < 0)
      continue;

    // look for an @ between start and end as a raw test
    int32_t at = m_commandResponse.FindChar('@', startMark);
    if (at < 0 || at >= endMark)
      continue;

    // now test if sub only consists of chars in ASCII range
    nsCString sub(Substring(m_commandResponse, startMark, endMark - startMark + 1));
    if (NS_IsAscii(sub.get()))
    {
      // set m_ApopTimestamp to the validated substring
      m_ApopTimestamp.Assign(sub);
      break;
    }
  }

  return NS_OK;
}
