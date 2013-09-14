/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"    // precompiled header...
#include "nsMsgImapCID.h"

#include "nsIURL.h"
#include "nsImapUrl.h"
#include "nsIIMAPHostSessionList.h"
#include "nsThreadUtils.h"
#include "nsStringGlue.h"
#include "prmem.h"
#include "plstr.h"
#include "prprf.h"
#include "nsMemory.h"
#include "nsCOMPtr.h"
#include "nsIImapIncomingServer.h"
#include "nsMsgBaseCID.h"
#include "nsImapUtils.h"
#include "nsIMAPNamespace.h"
#include "nsICacheEntryDescriptor.h"
#include "nsISupportsObsolete.h"
#include "nsIMsgFolder.h"
#include "nsIDocShell.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsMsgUtils.h"
#include "nsIMsgHdr.h"
#include "nsIProgressEventSink.h"
#include "nsAlgorithm.h"
#include "nsServiceManagerUtils.h"
#include <algorithm>

using namespace mozilla;

static NS_DEFINE_CID(kCImapHostSessionListCID, NS_IIMAPHOSTSESSIONLIST_CID);

nsImapUrl::nsImapUrl() : mLock("nsImapUrl.mLock")
{
  m_listOfMessageIds = nullptr;
  m_sourceCanonicalFolderPathSubString = nullptr;
  m_destinationCanonicalFolderPathSubString = nullptr;
  m_listOfMessageIds = nullptr;
  m_tokenPlaceHolder = nullptr;
  m_searchCriteriaString = nullptr;
  m_idsAreUids = false;
  m_mimePartSelectorDetected = false;
  m_allowContentChange = true;  // assume we can do MPOD.
  m_fetchPartsOnDemand = false; // but assume we're not doing it :-)
  m_msgLoadingFromCache = false;
  m_storeResultsOffline = false;
  m_storeOfflineOnFallback = false;
  m_localFetchOnly = false;
  m_rerunningUrl = false;
  m_moreHeadersToDownload = false;
  m_externalLinkUrl = true; // we'll start this at true, and set it false in nsImapService::CreateStartOfImapUrl
  m_contentModified = IMAP_CONTENT_NOT_MODIFIED;
  m_validUrl = true;  // assume the best.
  m_flags = 0;
  m_extraStatus = ImapStatusNone;
  m_onlineSubDirSeparator = '/';

  // ** jt - the following are not ref counted
  m_copyState = nullptr;
  m_file = nullptr;
  m_imapMailFolderSink = nullptr;
  m_imapMessageSink = nullptr;
  m_addDummyEnvelope = false;
  m_canonicalLineEnding = false;
}

nsImapUrl::~nsImapUrl()
{
  PR_FREEIF(m_listOfMessageIds);
  PR_FREEIF(m_destinationCanonicalFolderPathSubString);
  PR_FREEIF(m_sourceCanonicalFolderPathSubString);
  PR_FREEIF(m_searchCriteriaString);
}

NS_IMPL_ADDREF_INHERITED(nsImapUrl, nsMsgMailNewsUrl)

NS_IMPL_RELEASE_INHERITED(nsImapUrl, nsMsgMailNewsUrl)

NS_INTERFACE_MAP_BEGIN(nsImapUrl)
  NS_INTERFACE_MAP_ENTRY(nsIImapUrl)
  NS_INTERFACE_MAP_ENTRY(nsIMsgMessageUrl)
  NS_INTERFACE_MAP_ENTRY(nsIMsgI18NUrl)
NS_INTERFACE_MAP_END_INHERITING(nsMsgMailNewsUrl)

////////////////////////////////////////////////////////////////////////////////////
// Begin nsIImapUrl specific support
////////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP nsImapUrl::GetRequiredImapState(nsImapState * aImapUrlState)
{
  if (aImapUrlState)
  {
    // the imap action determines the state we must be in...check the
    // the imap action.

    if (m_imapAction & 0x10000000)
      *aImapUrlState = nsImapSelectedState;
    else
      *aImapUrlState = nsImapAuthenticatedState;
  }

  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetImapAction(nsImapAction * aImapAction)
{
  *aImapAction = m_imapAction;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetImapAction(nsImapAction aImapAction)
{
  m_imapAction = aImapAction;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetFolder(nsIMsgFolder **aMsgFolder)
{
  NS_ENSURE_ARG_POINTER(aMsgFolder);
  NS_ENSURE_ARG_POINTER(m_imapFolder);

  nsCOMPtr<nsIMsgFolder> folder = do_QueryReferent(m_imapFolder);
  NS_IF_ADDREF(*aMsgFolder = folder);
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetFolder(nsIMsgFolder  * aMsgFolder)
{
  nsresult rv;
  m_imapFolder = do_GetWeakReference(aMsgFolder, &rv);
  if (aMsgFolder)
  {
    nsCOMPtr <nsIMsgIncomingServer> incomingServer;
    aMsgFolder->GetServer(getter_AddRefs(incomingServer));
    if (incomingServer)
      incomingServer->GetKey(m_serverKey);
  }
  return rv;
}

NS_IMETHODIMP nsImapUrl::GetImapMailFolderSink(nsIImapMailFolderSink **
                                           aImapMailFolderSink)
{
    NS_ENSURE_ARG_POINTER(aImapMailFolderSink);
    if (!m_imapMailFolderSink)
      return NS_ERROR_NULL_POINTER; // no assert, so don't use NS_ENSURE_POINTER.

    nsCOMPtr<nsIImapMailFolderSink> folderSink = do_QueryReferent(m_imapMailFolderSink);
    *aImapMailFolderSink = folderSink;
    NS_IF_ADDREF(*aImapMailFolderSink);
    return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetImapMailFolderSink(nsIImapMailFolderSink  * aImapMailFolderSink)
{
    nsresult rv;
    m_imapMailFolderSink = do_GetWeakReference(aImapMailFolderSink, &rv);
    return rv;
}

NS_IMETHODIMP nsImapUrl::GetImapMessageSink(nsIImapMessageSink ** aImapMessageSink)
{
    NS_ENSURE_ARG_POINTER(aImapMessageSink);
    NS_ENSURE_ARG_POINTER(m_imapMessageSink);

    nsCOMPtr<nsIImapMessageSink> messageSink = do_QueryReferent(m_imapMessageSink);
    *aImapMessageSink = messageSink;
    NS_IF_ADDREF(*aImapMessageSink);
    return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetImapMessageSink(nsIImapMessageSink  * aImapMessageSink)
{
  nsresult rv;
  m_imapMessageSink = do_GetWeakReference(aImapMessageSink, &rv);
  return rv;
}

NS_IMETHODIMP nsImapUrl::GetImapServerSink(nsIImapServerSink ** aImapServerSink)
{
    NS_ENSURE_ARG_POINTER(aImapServerSink);
    NS_ENSURE_ARG_POINTER(m_imapServerSink);

    nsCOMPtr<nsIImapServerSink> serverSink = do_QueryReferent(m_imapServerSink);
    *aImapServerSink = serverSink;
    NS_IF_ADDREF(*aImapServerSink);
    return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetImapServerSink(nsIImapServerSink  * aImapServerSink)
{
  nsresult rv;
  m_imapServerSink = do_GetWeakReference(aImapServerSink, &rv);
  return rv;
}


////////////////////////////////////////////////////////////////////////////////////
// End nsIImapUrl specific support
////////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP nsImapUrl::SetSpec(const nsACString &aSpec)
{
  nsresult rv = nsMsgMailNewsUrl::SetSpec(aSpec);
  if (NS_SUCCEEDED(rv))
  {
    m_validUrl = true;  // assume the best.
    rv = ParseUrl();
  }
  return rv;
}

NS_IMETHODIMP nsImapUrl::SetQuery(const nsACString &aQuery)
{
  nsresult rv = nsMsgMailNewsUrl::SetQuery(aQuery);
  if (NS_SUCCEEDED(rv))
    rv = ParseUrl();
  return rv;
}

nsresult nsImapUrl::ParseUrl()
{
  nsresult rv = NS_OK;
  // extract the user name
  GetUserPass(m_userName);

  nsAutoCString imapPartOfUrl;
  rv = GetPath(imapPartOfUrl);
  nsAutoCString unescapedImapPartOfUrl;
  MsgUnescapeString(imapPartOfUrl, 0, unescapedImapPartOfUrl);
  if (NS_SUCCEEDED(rv) && !unescapedImapPartOfUrl.IsEmpty())
  {
    ParseImapPart(unescapedImapPartOfUrl.BeginWriting()+1);  // GetPath leaves leading '/' in the path!!!
  }

  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::CreateSearchCriteriaString(char ** aResult)
{
  // this method should only be called from the imap thread...
  // o.t. add lock protection..
  if (nullptr == aResult || !m_searchCriteriaString)
    return  NS_ERROR_NULL_POINTER;
  *aResult = strdup(m_searchCriteriaString);
  return NS_OK;
}

// this method gets called from the UI thread and the imap thread
NS_IMETHODIMP nsImapUrl::GetListOfMessageIds(nsACString &aResult)
{
  MutexAutoLock mon(mLock);
  if (!m_listOfMessageIds)
    return  NS_ERROR_NULL_POINTER;

  int32_t bytesToCopy = strlen(m_listOfMessageIds);

  // mime may have glommed a "&part=" for a part download
  // we return the entire message and let mime extract
  // the part. Pop and news work this way also.
  // this algorithm truncates the "&part" string.
  char *currentChar = m_listOfMessageIds;
  while (*currentChar && (*currentChar != '?'))
    currentChar++;
  if (*currentChar == '?')
    bytesToCopy = currentChar - m_listOfMessageIds;

  // we should also strip off anything after "/;section="
  // since that can specify an IMAP MIME part
  char *wherePart = PL_strstr(m_listOfMessageIds, "/;section=");
  if (wherePart)
    bytesToCopy = std::min(bytesToCopy, int32_t(wherePart - m_listOfMessageIds));

  aResult.Assign(m_listOfMessageIds, bytesToCopy);
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetCommand(nsACString &result)
{
  result = m_command;
  return NS_OK;
}


NS_IMETHODIMP nsImapUrl::GetCustomAttributeToFetch(nsACString &result)
{
  result = m_msgFetchAttribute;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetCustomAttributeResult(nsACString &result)
{
  result = m_customAttributeResult;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetCustomAttributeResult(const nsACString &result)
{
  m_customAttributeResult = result;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetCustomCommandResult(nsACString &result)
{
  result = m_customCommandResult;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetCustomCommandResult(const nsACString &result)
{
  m_customCommandResult = result;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetCustomAddFlags(nsACString &aResult)
{
  aResult = m_customAddFlags;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetCustomSubtractFlags(nsACString &aResult)
{
  aResult = m_customSubtractFlags;
  return NS_OK;
}


NS_IMETHODIMP nsImapUrl::GetImapPartToFetch(char **result)
{
  //  here's the old code....

  // unforunately an imap part can have the form: /;section= OR
  // it can have the form ?section=. We need to look for both.
  if (m_listOfMessageIds)
  {
    char *wherepart = PL_strstr(m_listOfMessageIds, ";section=");
    if (!wherepart) // look for ?section too....
      wherepart = PL_strstr(m_listOfMessageIds, "?section=");
    if (wherepart)
    {
      wherepart += 9;  // strlen("/;section=")
      char *wherelibmimepart = PL_strstr(wherepart, "&part=");
      if (!wherelibmimepart)
        wherelibmimepart = PL_strstr(wherepart, "?part=");
      int numCharsToCopy = (wherelibmimepart) ? wherelibmimepart - wherepart :
                   PL_strlen(m_listOfMessageIds) - (wherepart - m_listOfMessageIds);
      if (numCharsToCopy)
      {
        *result = (char *) PR_Malloc(sizeof(char) * (numCharsToCopy + 1));
        if (*result)
        {
          PL_strncpy(*result, wherepart, numCharsToCopy + 1);  // appends a \0
          (*result)[numCharsToCopy] = '\0';
        }
      }
    } // if we got a wherepart
  } // if we got a m_listOfMessageIds
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetOnlineSubDirSeparator(char* separator)
{
  if (separator)
  {
      *separator = m_onlineSubDirSeparator;
      return NS_OK;
  }
  else
  {
      return NS_ERROR_NULL_POINTER;
  }
}

NS_IMETHODIMP nsImapUrl::GetNumBytesToFetch(int32_t *aNumBytesToFetch)
{
  NS_ENSURE_ARG_POINTER(aNumBytesToFetch);
  *aNumBytesToFetch = m_numBytesToFetch;
  return NS_OK;
}

NS_IMETHODIMP
nsImapUrl::SetOnlineSubDirSeparator(char onlineDirSeparator)
{
  m_onlineSubDirSeparator = onlineDirSeparator;
  return NS_OK;
}

// this method is only called from the imap thread
NS_IMETHODIMP nsImapUrl::MessageIdsAreUids(bool *result)
{
  *result = m_idsAreUids;
  return NS_OK;
}

NS_IMETHODIMP
nsImapUrl::SetExtraStatus(int32_t aExtraStatus)
{
  m_extraStatus = aExtraStatus;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetExtraStatus(int32_t *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = m_extraStatus;
  return NS_OK;
}

// this method is only called from the imap thread
NS_IMETHODIMP nsImapUrl::GetMsgFlags(imapMessageFlagsType *result)  // kAddMsgFlags or kSubtractMsgFlags only
{
  *result = m_flags;
  return NS_OK;
}

void nsImapUrl::ParseImapPart(char *imapPartOfUrl)
{
  m_tokenPlaceHolder = imapPartOfUrl;
  m_urlidSubString = m_tokenPlaceHolder ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : (char *)NULL;

  if (!m_urlidSubString)
  {
    m_validUrl = false;
    return;
  }

  if (!PL_strcasecmp(m_urlidSubString, "fetch"))
  {
    m_imapAction  = nsImapMsgFetch;
    ParseUidChoice();
    PR_FREEIF(m_sourceCanonicalFolderPathSubString);
    ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    ParseListOfMessageIds();
    // if fetched by spam filter, the action will be changed to nsImapMsgFetchPeek
  }
  else
  {
    if (!PL_strcasecmp(m_urlidSubString, "header"))
    {
      m_imapAction = nsImapMsgHeader;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "customFetch"))
    {
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseCustomMsgFetchAttribute();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "previewBody"))
    {
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseNumBytes();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "deletemsg"))
    {
      m_imapAction = nsImapDeleteMsg;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "uidexpunge"))
    {
      m_imapAction = nsImapUidExpunge;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "deleteallmsgs"))
    {
      m_imapAction = nsImapDeleteAllMsgs;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "addmsgflags"))
    {
      m_imapAction = nsImapAddMsgFlags;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseMsgFlags();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "subtractmsgflags"))
    {
      m_imapAction = nsImapSubtractMsgFlags;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseMsgFlags();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "setmsgflags"))
    {
      m_imapAction = nsImapSetMsgFlags;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseMsgFlags();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "onlinecopy"))
    {
      m_imapAction = nsImapOnlineCopy;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseFolderPath(&m_destinationCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "onlinemove"))
    {
      m_imapAction = nsImapOnlineMove;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseFolderPath(&m_destinationCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "onlinetoofflinecopy"))
    {
      m_imapAction = nsImapOnlineToOfflineCopy;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseFolderPath(&m_destinationCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "onlinetoofflinemove"))
    {
      m_imapAction = nsImapOnlineToOfflineMove;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      ParseFolderPath(&m_destinationCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "offlinetoonlinecopy"))
    {
      m_imapAction = nsImapOfflineToOnlineMove;
      ParseFolderPath(&m_destinationCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "search"))
    {
      m_imapAction = nsImapSearch;
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseSearchCriteriaString();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "test"))
    {
      m_imapAction = nsImapTest;
    }
    else if (!PL_strcasecmp(m_urlidSubString, "select"))
    {
      m_imapAction = nsImapSelectFolder;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      if (m_tokenPlaceHolder && *m_tokenPlaceHolder)
        ParseListOfMessageIds();
      else
        m_listOfMessageIds = PL_strdup("");
    }
    else if (!PL_strcasecmp(m_urlidSubString, "liteselect"))
    {
      m_imapAction = nsImapLiteSelectFolder;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "selectnoop"))
    {
      m_imapAction = nsImapSelectNoopFolder;
      m_listOfMessageIds = PL_strdup("");
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "expunge"))
    {
      m_imapAction = nsImapExpungeFolder;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      m_listOfMessageIds = PL_strdup("");    // no ids to UNDO
    }
    else if (!PL_strcasecmp(m_urlidSubString, "create"))
    {
      m_imapAction = nsImapCreateFolder;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "ensureExists"))
    {
      m_imapAction = nsImapEnsureExistsFolder;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "discoverchildren"))
    {
      m_imapAction = nsImapDiscoverChildrenUrl;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "discoverallboxes"))
    {
      m_imapAction = nsImapDiscoverAllBoxesUrl;
    }
    else if (!PL_strcasecmp(m_urlidSubString, "discoverallandsubscribedboxes"))
    {
      m_imapAction = nsImapDiscoverAllAndSubscribedBoxesUrl;
    }
    else if (!PL_strcasecmp(m_urlidSubString, "delete"))
    {
      m_imapAction = nsImapDeleteFolder;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "deletefolder"))
    {
      m_imapAction = nsImapDeleteFolderAndMsgs;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "rename"))
    {
      m_imapAction = nsImapRenameFolder;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseFolderPath(&m_destinationCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "movefolderhierarchy"))
    {
      m_imapAction = nsImapMoveFolderHierarchy;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      if (m_tokenPlaceHolder && *m_tokenPlaceHolder)  // handle promote to root
        ParseFolderPath(&m_destinationCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "list"))
    {
      m_imapAction = nsImapLsubFolders;
      ParseFolderPath(&m_destinationCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "biff"))
    {
      m_imapAction = nsImapBiff;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
    }
    else if (!PL_strcasecmp(m_urlidSubString, "netscape"))
    {
      m_imapAction = nsImapGetMailAccountUrl;
    }
    else if (!PL_strcasecmp(m_urlidSubString, "appendmsgfromfile"))
    {
      m_imapAction = nsImapAppendMsgFromFile;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "appenddraftfromfile"))
    {
      m_imapAction = nsImapAppendDraftFromFile;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseUidChoice();
      if (m_tokenPlaceHolder && *m_tokenPlaceHolder)
        ParseListOfMessageIds();
      else
        m_listOfMessageIds = strdup("");
    }
    else if (!PL_strcasecmp(m_urlidSubString, "subscribe"))
    {
      m_imapAction = nsImapSubscribe;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "unsubscribe"))
    {
      m_imapAction = nsImapUnsubscribe;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "refreshacl"))
    {
      m_imapAction = nsImapRefreshACL;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "refreshfolderurls"))
    {
      m_imapAction = nsImapRefreshFolderUrls;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "refreshallacls"))
    {
      m_imapAction = nsImapRefreshAllACLs;
    }
    else if (!PL_strcasecmp(m_urlidSubString, "listfolder"))
    {
      m_imapAction = nsImapListFolder;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "upgradetosubscription"))
    {
      m_imapAction = nsImapUpgradeToSubscription;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "folderstatus"))
    {
      m_imapAction = nsImapFolderStatus;
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
    }
    else if (!PL_strcasecmp(m_urlidSubString, "verifyLogon"))
    {
      m_imapAction = nsImapVerifylogon;
    }
    else if (m_imapAction == nsIImapUrl::nsImapUserDefinedMsgCommand)
    {
      m_command = m_urlidSubString; // save this
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
    }
    else if (m_imapAction == nsIImapUrl::nsImapMsgStoreCustomKeywords)
    {
      ParseUidChoice();
      ParseFolderPath(&m_sourceCanonicalFolderPathSubString);
      ParseListOfMessageIds();
      bool addKeyword = (m_tokenPlaceHolder && *m_tokenPlaceHolder != '>');
      // if we're not adding a keyword, m_tokenPlaceHolder will now look like >keywordToSubtract>
      // and strtok will leave flagsPtr pointing to keywordToSubtract. So detect this
      // case and only set the customSubtractFlags.
      char *flagsPtr = m_tokenPlaceHolder ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : (char *)nullptr;
      if (addKeyword)
      {
        m_customAddFlags.Assign(flagsPtr);
        flagsPtr = m_tokenPlaceHolder ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : (char *)nullptr;
      }
      m_customSubtractFlags.Assign(flagsPtr);
    }
    else
    {
      m_validUrl = false;
    }
  }
}


// Returns NULL if nothing was done.
// Otherwise, returns a newly allocated name.
NS_IMETHODIMP nsImapUrl::AddOnlineDirectoryIfNecessary(const char *onlineMailboxName, char ** directory)
{
  nsresult rv;
  nsString onlineDirString;
  char *newOnlineName = nullptr;

  nsCOMPtr<nsIImapHostSessionList> hostSessionList =
    do_GetService(kCImapHostSessionListCID, &rv);
  if (NS_FAILED(rv)) return rv;
  rv = hostSessionList->GetOnlineDirForHost(m_serverKey.get(), onlineDirString);
  nsAutoCString onlineDir;
  LossyCopyUTF16toASCII(onlineDirString, onlineDir);

  nsIMAPNamespace *ns = nullptr;
  rv = hostSessionList->GetNamespaceForMailboxForHost(m_serverKey.get(),
                                                      onlineMailboxName, ns);
  if (!ns)
    hostSessionList->GetDefaultNamespaceOfTypeForHost(m_serverKey.get(),
                                                      kPersonalNamespace, ns);

  if (onlineDir.IsEmpty() && ns)
    onlineDir = ns->GetPrefix();

  // If this host has an online server directory configured
  if (onlineMailboxName && !onlineDir.IsEmpty())
  {
    if (PL_strcasecmp(onlineMailboxName, "INBOX"))
    {
      NS_ASSERTION(ns, "couldn't find namespace for host");
      nsAutoCString onlineDirWithDelimiter(onlineDir);
      // make sure the onlineDir ends with the hierarchy delimiter
      if (ns)
      {
        char delimiter = ns->GetDelimiter();
        if ( delimiter && delimiter != kOnlineHierarchySeparatorUnknown )
        {
          // try to change the canonical online dir name to real dir name first
          MsgReplaceChar(onlineDirWithDelimiter, '/', delimiter);
          // make sure the last character is the delimiter
          if ( onlineDirWithDelimiter.Last() != delimiter )
            onlineDirWithDelimiter += delimiter;
          if ( !*onlineMailboxName )
            onlineDirWithDelimiter.SetLength(onlineDirWithDelimiter.Length()-1);
        }
      }
      if (ns && (PL_strlen(ns->GetPrefix()) != 0) && !onlineDirWithDelimiter.Equals(ns->GetPrefix()))
      {
        // check that onlineMailboxName doesn't start with the namespace. If that's the case,
        // we don't want to prepend the online dir.
        if (PL_strncmp(onlineMailboxName, ns->GetPrefix(), PL_strlen(ns->GetPrefix())))
        {
          // The namespace for this mailbox is the root ("").
          // Prepend the online server directory
          int finalLen = onlineDirWithDelimiter.Length() +
            strlen(onlineMailboxName) + 1;
          newOnlineName = (char *)PR_Malloc(finalLen);
          if (newOnlineName)
          {
            PL_strcpy(newOnlineName, onlineDirWithDelimiter.get());
            PL_strcat(newOnlineName, onlineMailboxName);
          }
        }
     }
      // just prepend the online server directory if it doesn't start with it already
      else if (strncmp(onlineMailboxName, onlineDirWithDelimiter.get(), onlineDirWithDelimiter.Length()))
      {
        newOnlineName = (char *)PR_Malloc(strlen(onlineMailboxName) + onlineDirWithDelimiter.Length() + 1);
        if (newOnlineName)
        {
          PL_strcpy(newOnlineName, onlineDirWithDelimiter.get());
          PL_strcat(newOnlineName, onlineMailboxName);
        }
      }
    }
  }
  if (directory)
    *directory = newOnlineName;
  else if (newOnlineName)
    NS_Free(newOnlineName);
  return rv;
}

// Converts from canonical format (hierarchy is indicated by '/' and all real slashes ('/') are escaped)
// to the real online name on the server.
NS_IMETHODIMP nsImapUrl::AllocateServerPath(const char * canonicalPath, char onlineDelimiter, char ** aAllocatedPath)
{
  nsresult retVal = NS_OK;
  char *rv = NULL;
  char delimiterToUse = onlineDelimiter;
  if (onlineDelimiter == kOnlineHierarchySeparatorUnknown)
    GetOnlineSubDirSeparator(&delimiterToUse);
  NS_ASSERTION(delimiterToUse != kOnlineHierarchySeparatorUnknown, "hierarchy separator unknown");
  if (canonicalPath)
    rv = ReplaceCharsInCopiedString(canonicalPath, '/', delimiterToUse);
  else
    rv = strdup("");

  if (delimiterToUse != '/')
    UnescapeSlashes(rv);
  char *onlineNameAdded = nullptr;
  AddOnlineDirectoryIfNecessary(rv, &onlineNameAdded);
  if (onlineNameAdded)
  {
    NS_Free(rv);
    rv = onlineNameAdded;
  }

  if (aAllocatedPath)
    *aAllocatedPath = rv;
  else
    NS_Free(rv);

  return retVal;
}

// escape '/' as ^, ^ -> ^^ - use UnescapeSlashes to revert
/* static */ nsresult nsImapUrl::EscapeSlashes(const char *sourcePath, char **resultPath)
{
  NS_ENSURE_ARG(sourcePath);
  NS_ENSURE_ARG(resultPath);
  int32_t extra = 0;
  int32_t len = strlen(sourcePath);
  const char *src = sourcePath;
  int32_t i;
  for ( i = 0; i < len; i++)
  {
    if (*src == '^')
      extra += 1; /* ^ -> ^^ */
    src++;
  }
  char* result = (char *)nsMemory::Alloc(len + extra + 1);
  if (!result)
    return NS_ERROR_OUT_OF_MEMORY;

  register unsigned char* dst = (unsigned char *) result;
  src = sourcePath;
  for (i = 0; i < len; i++)
  {
    unsigned char c = *src++;
    if (c == '/')
      *dst++ = '^';
    else if (c == '^')
    {
      *dst++ = '^';
      *dst++ = '^';
    }
    else
      *dst++ = c;
  }
  *dst = '\0';     /* tack on eos */
  *resultPath = result;
  return NS_OK;
}

/* static */ nsresult nsImapUrl::UnescapeSlashes(char *sourcePath)
{
    register char *src = sourcePath;
    register char *dst = sourcePath;

    while (*src)
    {
      if (*src == '^')
      {
        if (*(src + 1) == '^')
        {
          *dst++ = '^';
          src++;   // skip over second '^'
        }
        else
          *dst++ = '/';
        src++;
      }
      else
        *dst++ = *src++;
    }

    *dst = 0;
    return NS_OK;
}

/*  static */ nsresult nsImapUrl::ConvertToCanonicalFormat(const char *folderName, char onlineDelimiter, char **resultingCanonicalPath)
{
  // Now, start the conversion to canonical form.

  char *canonicalPath;
  if (onlineDelimiter != '/')
  {
    nsCString escapedPath;

    EscapeSlashes(folderName, getter_Copies(escapedPath));
    canonicalPath = ReplaceCharsInCopiedString(escapedPath.get(), onlineDelimiter , '/');
  }
  else
  {
    canonicalPath = strdup(folderName);
  }
  if (canonicalPath)
    *resultingCanonicalPath = canonicalPath;

  return (canonicalPath) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

// Converts the real online name on the server to canonical format:
// result is hierarchy is indicated by '/' and all real slashes ('/') are escaped.
// The caller has already converted m-utf-7 to 8 bit ascii, which is a problem.
// this method is only called from the imap thread
NS_IMETHODIMP nsImapUrl::AllocateCanonicalPath(const char *serverPath, char onlineDelimiter, char **allocatedPath )
{
  nsresult rv = NS_ERROR_NULL_POINTER;
  char delimiterToUse = onlineDelimiter;
  char *serverKey = nullptr;
  nsString aString;
  char *currentPath = (char *) serverPath;
  nsAutoCString onlineDir;
  nsCOMPtr<nsIMsgIncomingServer> server;

  nsCOMPtr<nsIImapHostSessionList> hostSessionList =
    do_GetService(kCImapHostSessionListCID, &rv);

  *allocatedPath = nullptr;

  if (onlineDelimiter == kOnlineHierarchySeparatorUnknown ||
    onlineDelimiter == 0)
    GetOnlineSubDirSeparator(&delimiterToUse);

  NS_ASSERTION (serverPath, "Oops... null serverPath");

  if (!serverPath || NS_FAILED(rv))
    goto done;

  hostSessionList->GetOnlineDirForHost(m_serverKey.get(), aString);
  // First we have to check to see if we should strip off an online server
  // subdirectory
  // If this host has an online server directory configured
  LossyCopyUTF16toASCII(aString, onlineDir);

  if (currentPath && !onlineDir.IsEmpty())
  {
    // By definition, the online dir must be at the root.
    if (delimiterToUse && delimiterToUse != kOnlineHierarchySeparatorUnknown)
    {
      // try to change the canonical online dir name to real dir name first
      MsgReplaceChar(onlineDir, '/', delimiterToUse);
      // Add the delimiter
      if (onlineDir.Last() != delimiterToUse)
        onlineDir += delimiterToUse;
    }
    int len = onlineDir.Length();
    if (!PL_strncmp(onlineDir.get(), currentPath, len))
    {
      // This online path begins with the server sub directory
      currentPath += len;

      // This might occur, but it's most likely something not good.
      // Basically, it means we're doing something on the online sub directory itself.
      NS_ASSERTION (*currentPath, "Oops ... null currentPath");
      // Also make sure that the first character in the mailbox name is not '/'.
      NS_ASSERTION (*currentPath != '/',
        "Oops ... currentPath starts with a slash");
    }
  }


  if (!currentPath)
    goto done;

  rv = ConvertToCanonicalFormat(currentPath, delimiterToUse, allocatedPath);

done:
  PR_Free(serverKey);
  return rv;
}

// this method is only called from the imap thread
NS_IMETHODIMP  nsImapUrl::CreateServerSourceFolderPathString(char **result)
{
  NS_ENSURE_ARG_POINTER(result);
  AllocateServerPath(m_sourceCanonicalFolderPathSubString, kOnlineHierarchySeparatorUnknown, result);
  return NS_OK;
}

// this method is called from the imap thread AND the UI thread...
NS_IMETHODIMP nsImapUrl::CreateCanonicalSourceFolderPathString(char **result)
{
  NS_ENSURE_ARG_POINTER(result);
  MutexAutoLock  mon(mLock);
  *result = strdup(m_sourceCanonicalFolderPathSubString ? m_sourceCanonicalFolderPathSubString : "");
  return (*result) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

// this method is called from the imap thread AND the UI thread...
NS_IMETHODIMP nsImapUrl::CreateServerDestinationFolderPathString(char **result)
{
  NS_ENSURE_ARG_POINTER(result);
  MutexAutoLock mon(mLock);
  nsresult rv = AllocateServerPath(m_destinationCanonicalFolderPathSubString,
                                   kOnlineHierarchySeparatorUnknown,
                                   result);
  return (*result) ? rv : NS_ERROR_OUT_OF_MEMORY;
}

// for enabling or disabling mime parts on demand. Setting this to true says we
// can use mime parts on demand, if we chose.
NS_IMETHODIMP nsImapUrl::SetAllowContentChange(bool allowContentChange)
{
  m_allowContentChange = allowContentChange;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetContentModified(nsImapContentModifiedType contentModified)
{
  m_contentModified = contentModified;
  nsCOMPtr<nsICacheEntryDescriptor>  cacheEntry;
  nsresult res = GetMemCacheEntry(getter_AddRefs(cacheEntry));
  if (NS_SUCCEEDED(res) && cacheEntry)
  {
    const char *contentModifiedAnnotation = "";
    switch (m_contentModified)
    {
    case IMAP_CONTENT_NOT_MODIFIED:
      contentModifiedAnnotation = "Not Modified";
      break;
    case IMAP_CONTENT_MODIFIED_VIEW_INLINE:
      contentModifiedAnnotation = "Modified View Inline";
      break;
    case IMAP_CONTENT_MODIFIED_VIEW_AS_LINKS:
      contentModifiedAnnotation = "Modified View As Link";
      break;
    case IMAP_CONTENT_FORCE_CONTENT_NOT_MODIFIED:
      contentModifiedAnnotation = "Force Content Not Modified";
      break;
    }
    cacheEntry->SetMetaDataElement("ContentModified", contentModifiedAnnotation);
  }
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetContentModified(nsImapContentModifiedType *contentModified)
{
  if (!contentModified) return NS_ERROR_NULL_POINTER;

  *contentModified = m_contentModified;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetFetchPartsOnDemand(bool fetchPartsOnDemand)
{
  m_fetchPartsOnDemand = fetchPartsOnDemand;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetFetchPartsOnDemand(bool *fetchPartsOnDemand)
{
  if (!fetchPartsOnDemand) return NS_ERROR_NULL_POINTER;

  *fetchPartsOnDemand = m_fetchPartsOnDemand;
  return NS_OK;
}


NS_IMETHODIMP nsImapUrl::SetMimePartSelectorDetected(bool mimePartSelectorDetected)
{
  m_mimePartSelectorDetected = mimePartSelectorDetected;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetMimePartSelectorDetected(bool *mimePartSelectorDetected)
{
  if (!mimePartSelectorDetected) return NS_ERROR_NULL_POINTER;

  *mimePartSelectorDetected = m_mimePartSelectorDetected;
  return NS_OK;
}


// this method is only called from the UI thread.
NS_IMETHODIMP nsImapUrl::SetCopyState(nsISupports* copyState)
{
  MutexAutoLock  mon(mLock);
  m_copyState = copyState;
  return NS_OK;
}

//this method is only called from the imap thread..but we still
// need a monitor 'cause the setter is called from the UI thread.
NS_IMETHODIMP nsImapUrl::GetCopyState(nsISupports** copyState)
{
  NS_ENSURE_ARG_POINTER(copyState);
  MutexAutoLock mon(mLock);
  *copyState = m_copyState;
  NS_IF_ADDREF(*copyState);

  return NS_OK;
}

NS_IMETHODIMP
nsImapUrl::SetMsgFile(nsIFile* aFile)
{
  nsresult rv = NS_OK;
  MutexAutoLock mon(mLock);
  m_file = aFile;
  return rv;
}

NS_IMETHODIMP
nsImapUrl::GetMsgFile(nsIFile** aFile)
{
  NS_ENSURE_ARG_POINTER(aFile);

  MutexAutoLock mon(mLock);
  NS_IF_ADDREF(*aFile = m_file);
  return NS_OK;
}

// this method is called from the UI thread..
NS_IMETHODIMP nsImapUrl::GetMockChannel(nsIImapMockChannel ** aChannel)
{
  NS_ENSURE_ARG_POINTER(aChannel);
  NS_WARN_IF_FALSE(NS_IsMainThread(), "should only access mock channel on ui thread");
  *aChannel = nullptr;
  nsCOMPtr<nsIImapMockChannel> channel(do_QueryReferent(m_channelWeakPtr));
  channel.swap(*aChannel);
  return *aChannel ? NS_OK : NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsImapUrl::SetMockChannel(nsIImapMockChannel * aChannel)
{
  NS_WARN_IF_FALSE(NS_IsMainThread(), "should only access mock channel on ui thread");
  m_channelWeakPtr = do_GetWeakReference(aChannel);
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetAllowContentChange(bool *result)
{
  NS_ENSURE_ARG_POINTER(result);
  *result = m_allowContentChange;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::Clone(nsIURI **_retval)
{
  nsresult rv = nsMsgMailNewsUrl::Clone(_retval);
  NS_ENSURE_SUCCESS(rv, rv);
  // also clone the mURI member, because GetUri below won't work if
  // mURI isn't set due to escaping issues.
  nsCOMPtr <nsIMsgMessageUrl> clonedUrl = do_QueryInterface(*_retval);
  if (clonedUrl)
    clonedUrl->SetUri(mURI.get());
  return rv;
}


NS_IMETHODIMP nsImapUrl::SetUri(const char * aURI)
{
  mURI= aURI;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetUri(char** aURI)
{
  nsresult rv = NS_OK;
  if (!mURI.IsEmpty())
    *aURI = ToNewCString(mURI);
  else
  {
    *aURI = nullptr;
    uint32_t key = m_listOfMessageIds ? atoi(m_listOfMessageIds) : 0;
    nsCString canonicalPath;
    AllocateCanonicalPath(m_sourceCanonicalFolderPathSubString, m_onlineSubDirSeparator, (getter_Copies(canonicalPath)));
    nsCString fullFolderPath("/");
    fullFolderPath.Append(m_userName);
    nsAutoCString hostName;
    rv = GetHost(hostName);
    fullFolderPath.Append('@');
    fullFolderPath.Append(hostName);
    fullFolderPath.Append('/');
    fullFolderPath.Append(canonicalPath);

    nsCString baseMessageURI;
    nsCreateImapBaseMessageURI(fullFolderPath, baseMessageURI);
    nsAutoCString uriStr;
    rv = nsBuildImapMessageURI(baseMessageURI.get(), key, uriStr);
    *aURI = ToNewCString(uriStr);
  }
  return rv;
}

NS_IMPL_GETSET(nsImapUrl, AddDummyEnvelope, bool, m_addDummyEnvelope)
NS_IMPL_GETSET(nsImapUrl, CanonicalLineEnding, bool, m_canonicalLineEnding)
NS_IMPL_GETTER(nsImapUrl::GetMsgLoadingFromCache, bool, m_msgLoadingFromCache)
NS_IMPL_GETSET(nsImapUrl, LocalFetchOnly, bool, m_localFetchOnly)
NS_IMPL_GETSET(nsImapUrl, ExternalLinkUrl, bool, m_externalLinkUrl)
NS_IMPL_GETSET(nsImapUrl, RerunningUrl, bool, m_rerunningUrl)
NS_IMPL_GETSET(nsImapUrl, ValidUrl, bool, m_validUrl)
NS_IMPL_GETSET(nsImapUrl, MoreHeadersToDownload, bool, m_moreHeadersToDownload)

NS_IMETHODIMP nsImapUrl::SetMsgLoadingFromCache(bool loadingFromCache)
{
  nsresult rv = NS_OK;
  m_msgLoadingFromCache = loadingFromCache;
  return rv;
}

NS_IMETHODIMP nsImapUrl::SetMessageFile(nsIFile * aFile)
{
  m_messageFile = aFile;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetMessageFile(nsIFile ** aFile)
{
  if (aFile)
    NS_IF_ADDREF(*aFile = m_messageFile);
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::IsUrlType(uint32_t type, bool *isType)
{
  NS_ENSURE_ARG(isType);

  switch(type)
  {
    case nsIMsgMailNewsUrl::eCopy:
      *isType = ((m_imapAction == nsIImapUrl::nsImapOnlineCopy) ||
        (m_imapAction == nsIImapUrl::nsImapOnlineToOfflineCopy) ||
        (m_imapAction == nsIImapUrl::nsImapOfflineToOnlineCopy));
      break;
    case nsIMsgMailNewsUrl::eMove:
      *isType = ((m_imapAction == nsIImapUrl::nsImapOnlineMove) ||
        (m_imapAction == nsIImapUrl::nsImapOnlineToOfflineMove) ||
        (m_imapAction == nsIImapUrl::nsImapOfflineToOnlineMove));
      break;
    case nsIMsgMailNewsUrl::eDisplay:
      *isType = (m_imapAction == nsIImapUrl::nsImapMsgFetch ||
        m_imapAction == nsIImapUrl::nsImapMsgFetchPeek);
      break;
    default:
      *isType = false;
  };

  return NS_OK;

}

NS_IMETHODIMP
nsImapUrl::GetOriginalSpec(char ** aSpec)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsImapUrl::SetOriginalSpec(const char *aSpec)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

char *nsImapUrl::ReplaceCharsInCopiedString(const char *stringToCopy, char oldChar, char newChar)
{
  char oldCharString[2];
  *oldCharString = oldChar;
  *(oldCharString+1) = 0;

  char *translatedString = PL_strdup(stringToCopy);
  char *currentSeparator = PL_strstr(translatedString, oldCharString);

  while(currentSeparator)
  {
    *currentSeparator = newChar;
    currentSeparator = PL_strstr(currentSeparator+1, oldCharString);
  }

  return translatedString;
}


////////////////////////////////////////////////////////////////////////////////////
// End of functions which should be made obsolete after modifying nsIURI
////////////////////////////////////////////////////////////////////////////////////

void nsImapUrl::ParseFolderPath(char **resultingCanonicalPath)
{
  char *resultPath = m_tokenPlaceHolder ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : (char *)NULL;

  if (!resultPath)
  {
    m_validUrl = false;
    return;
  }
  NS_ASSERTION(*resultingCanonicalPath == nullptr, "whoops, mem leak");

  char dirSeparator = *resultPath;

  nsCString unescapedResultingCanonicalPath;
  MsgUnescapeString(nsDependentCString(resultPath + 1), 0, unescapedResultingCanonicalPath);
  *resultingCanonicalPath = ToNewCString(unescapedResultingCanonicalPath);
  // The delimiter will be set for a given URL, but will not be statically available
  // from an arbitrary URL.  It is the creator's responsibility to fill in the correct
  // delimiter from the folder's namespace when creating the URL.
  if (dirSeparator != kOnlineHierarchySeparatorUnknown)
    SetOnlineSubDirSeparator( dirSeparator);

  // if dirSeparator == kOnlineHierarchySeparatorUnknown, then this must be a create
  // of a top level imap box.  If there is an online subdir, we will automatically
  // use its separator.  If there is not an online subdir, we don't need a separator.
}

void nsImapUrl::ParseSearchCriteriaString()
{
  if (m_tokenPlaceHolder)
  {
    int quotedFlag = false;

    //skip initial separator
    while (*m_tokenPlaceHolder == *IMAP_URL_TOKEN_SEPARATOR)
      m_tokenPlaceHolder++;

     char *saveTokenPlaceHolder = m_tokenPlaceHolder;

//    m_searchCriteriaString = m_tokenPlaceHolder;

    //looking for another separator outside quoted string
    while (*m_tokenPlaceHolder)
    {
      if (*m_tokenPlaceHolder == '\\' && *(m_tokenPlaceHolder+1) == '"')
        m_tokenPlaceHolder++;
      else if (*m_tokenPlaceHolder == '"')
        quotedFlag = !quotedFlag;
      else if (!quotedFlag && *m_tokenPlaceHolder == *IMAP_URL_TOKEN_SEPARATOR)
      {
        *m_tokenPlaceHolder = '\0';
        m_tokenPlaceHolder++;
        break;
      }
      m_tokenPlaceHolder++;
    }
    m_searchCriteriaString = PL_strdup(saveTokenPlaceHolder);
    if (*m_tokenPlaceHolder == '\0')
      m_tokenPlaceHolder = NULL;

    if (*m_searchCriteriaString == '\0')
      m_searchCriteriaString = (char *)NULL;
  }
  else
    m_searchCriteriaString = (char *)NULL;
  if (!m_searchCriteriaString)
    m_validUrl = false;
}


void nsImapUrl::ParseUidChoice()
{
  char *uidChoiceString = m_tokenPlaceHolder ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : (char *)NULL;
  if (!uidChoiceString)
    m_validUrl = false;
  else
    m_idsAreUids = strcmp(uidChoiceString, "UID") == 0;
}

void nsImapUrl::ParseMsgFlags()
{
  char *flagsPtr = m_tokenPlaceHolder ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : (char *)NULL;
  if (flagsPtr)
  {
    // the url is encodes the flags byte as ascii
    int intFlags = atoi(flagsPtr);
    m_flags = (imapMessageFlagsType) intFlags;  // cast here
  }
  else
    m_flags = 0;
}

void nsImapUrl::ParseListOfMessageIds()
{
  m_listOfMessageIds = m_tokenPlaceHolder ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : (char *)NULL;
  if (!m_listOfMessageIds)
    m_validUrl = false;
  else
  {
    m_listOfMessageIds = strdup(m_listOfMessageIds);
    m_mimePartSelectorDetected = PL_strstr(m_listOfMessageIds, "&part=") != 0 || PL_strstr(m_listOfMessageIds, "?part=") != 0;

    // if we're asking for just the body, don't download the whole message. see
    // nsMsgQuote::QuoteMessage() for the "header=" settings when replying to msgs.
    if (!m_fetchPartsOnDemand)
      m_fetchPartsOnDemand = (PL_strstr(m_listOfMessageIds, "?header=quotebody") != 0 ||
      PL_strstr(m_listOfMessageIds, "?header=only") != 0);
    // if it's a spam filter trying to fetch the msg, don't let it get marked read.
    if (PL_strstr(m_listOfMessageIds,"?header=filter") != 0)
      m_imapAction = nsImapMsgFetchPeek;
  }
}

void nsImapUrl::ParseCustomMsgFetchAttribute()
{
  m_msgFetchAttribute = m_tokenPlaceHolder ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : (char *)nullptr;
}

void nsImapUrl::ParseNumBytes()
{
  const char *numBytes = (m_tokenPlaceHolder) ? NS_strtok(IMAP_URL_TOKEN_SEPARATOR, &m_tokenPlaceHolder) : 0;
  m_numBytesToFetch = numBytes ? atoi(numBytes) : 0;
}

// nsIMsgI18NUrl support

nsresult nsImapUrl::GetMsgFolder(nsIMsgFolder **msgFolder)
{
  // if we have a RDF URI, then try to get the folder for that URI and then ask the folder
  // for it's charset....

  nsCString uri;
  GetUri(getter_Copies(uri));
  NS_ENSURE_TRUE(!uri.IsEmpty(), NS_ERROR_FAILURE);

  nsCOMPtr<nsIMsgDBHdr> msg;
  GetMsgDBHdrFromURI(uri.get(), getter_AddRefs(msg));
  NS_ENSURE_TRUE(msg, NS_ERROR_FAILURE);
  nsresult rv = msg->GetFolder(msgFolder);
  NS_ENSURE_SUCCESS(rv,rv);
  NS_ENSURE_TRUE(msgFolder, NS_ERROR_FAILURE);

  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetFolderCharset(char ** aCharacterSet)
{
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = GetMsgFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv,rv);
  nsCString tmpStr;
  folder->GetCharset(tmpStr);
  *aCharacterSet = ToNewCString(tmpStr);
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetFolderCharsetOverride(bool * aCharacterSetOverride)
{
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = GetMsgFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv,rv);
  NS_ENSURE_TRUE(folder, NS_ERROR_FAILURE);
  folder->GetCharsetOverride(aCharacterSetOverride);
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetCharsetOverRide(char ** aCharacterSet)
{
  if (!mCharsetOverride.IsEmpty())
    *aCharacterSet = ToNewCString(mCharsetOverride);
  else
    *aCharacterSet = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetCharsetOverRide(const char * aCharacterSet)
{
  mCharsetOverride = aCharacterSet;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetStoreResultsOffline(bool *aStoreResultsOffline)
{
  NS_ENSURE_ARG_POINTER(aStoreResultsOffline);
  *aStoreResultsOffline = m_storeResultsOffline;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetStoreResultsOffline(bool aStoreResultsOffline)
{
  m_storeResultsOffline = aStoreResultsOffline;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetStoreOfflineOnFallback(bool *aStoreOfflineOnFallback)
{
  NS_ENSURE_ARG_POINTER(aStoreOfflineOnFallback);
  *aStoreOfflineOnFallback = m_storeOfflineOnFallback;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::SetStoreOfflineOnFallback(bool aStoreOfflineOnFallback)
{
  m_storeOfflineOnFallback = aStoreOfflineOnFallback;
  return NS_OK;
}

NS_IMETHODIMP nsImapUrl::GetMessageHeader(nsIMsgDBHdr ** aMsgHdr)
{
  nsCString uri;
  nsresult rv = GetUri(getter_Copies(uri));
  NS_ENSURE_SUCCESS(rv, rv);
  return GetMsgDBHdrFromURI(uri.get(), aMsgHdr);
}

NS_IMETHODIMP nsImapUrl::SetMessageHeader(nsIMsgDBHdr *aMsgHdr)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
