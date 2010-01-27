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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Henrik Gemal <mozilla@gemal.dk>
 *   Karsten Düsterloh <mnyromyr@tprac.de>
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

/*
 * formerly listngst.cpp
 * This class should ultimately be part of a news group listing
 * state machine - either by inheritance or delegation.
 * Currently, a folder pane owns one and libnet news group listing
 * related messages get passed to this object.
 */

#include "msgCore.h"    // precompiled header...
#include "MailNewsTypes.h"
#include "nsCOMPtr.h"
#include "nsIDBFolderInfo.h"
#include "nsINewsDatabase.h"
#include "nsIMsgStatusFeedback.h"
#include "nsCOMPtr.h"
#include "nsIDOMWindowInternal.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgIncomingServer.h"
#include "nsINntpIncomingServer.h"
#include "nsMsgBaseCID.h"

#include "nsNNTPNewsgroupList.h"

#include "nsINNTPArticleList.h"
#include "nsMsgKeySet.h"

#include "nntpCore.h"
#include "nsIStringBundle.h"

#include "plstr.h"
#include "prmem.h"
#include "prprf.h"

#include "nsMsgUtils.h"

#include "nsMsgDatabase.h"

#include "nsIDBFolderInfo.h"

#include "nsNewsUtils.h"

#include "nsMsgDBCID.h"

#include "nsINewsDownloadDialogArgs.h"

#include "nsXPCOM.h"
#include "nsISupportsPrimitives.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIMsgWindow.h"
#include "nsIDocShell.h"
#include "nsIMutableArray.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsIMsgFilterCustomAction.h"

// update status on header download once per second
#define MIN_STATUS_UPDATE_INTERVAL PR_USEC_PER_SEC


nsNNTPNewsgroupList::nsNNTPNewsgroupList()
  : m_finishingXover(PR_FALSE),
  m_getOldMessages(PR_FALSE),
  m_promptedAlready(PR_FALSE),
  m_downloadAll(PR_FALSE),
  m_maxArticles(0),
  m_lastPercent(-1),
  m_lastProcessedNumber(0),
  m_firstMsgNumber(0),
  m_lastMsgNumber(0),
  m_firstMsgToDownload(0),
  m_lastMsgToDownload(0),
  m_set(nsnull)
{
  memset(&m_knownArts, 0, sizeof(m_knownArts));
  m_lastStatusUpdate = LL_Zero();
}

nsNNTPNewsgroupList::~nsNNTPNewsgroupList()
{
  CleanUp();
}

NS_IMPL_ISUPPORTS2(nsNNTPNewsgroupList, nsINNTPNewsgroupList, nsIMsgFilterHitNotify)

nsresult
nsNNTPNewsgroupList::Initialize(nsINntpUrl *runningURL, nsIMsgNewsFolder *newsFolder)
{
  m_newsFolder = newsFolder;
  m_runningURL = runningURL;
  m_knownArts.set = nsMsgKeySet::Create();

  nsresult rv = m_newsFolder->GetDatabaseWithoutCache(getter_AddRefs(m_newsDB));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgFolder> folder = do_QueryInterface(m_newsFolder, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = folder->GetFilterList(m_msgWindow, getter_AddRefs(m_filterList));
  NS_ENSURE_SUCCESS(rv,rv);
  nsCString ngHeaders;
  m_filterList->GetArbitraryHeaders(ngHeaders);
  ParseString(ngHeaders, ' ', m_filterHeaders);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = folder->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv,rv);

  rv = server->GetFilterList(m_msgWindow, getter_AddRefs(m_serverFilterList));
  NS_ENSURE_SUCCESS(rv,rv);
  nsCAutoString servHeaders;
  m_serverFilterList->GetArbitraryHeaders(servHeaders);

  nsTArray<nsCString> servArray;
  ParseString(servHeaders, ' ', servArray);

  // servArray may have duplicates already in m_filterHeaders.
  for (PRUint32 i = 0; i < servArray.Length(); i++)
  {
    if (m_filterHeaders.IndexOf(servArray[i]) == m_filterHeaders.NoIndex)
      m_filterHeaders.AppendElement(servArray[i]);
  }
  return NS_OK;
}

nsresult
nsNNTPNewsgroupList::CleanUp()
{
  // here we make sure that there aren't missing articles in the unread set
  // So if an article is the unread set, and the known arts set, but isn't in the
  // db, then we should mark it read in the unread set.
  if (m_newsDB)
  {
    if (m_knownArts.set && m_knownArts.set->getLength() && m_set->getLength())
    {
      nsCOMPtr <nsIDBFolderInfo> folderInfo;
      m_newsDB->GetDBFolderInfo(getter_AddRefs(folderInfo));
      PRInt32 firstKnown = m_knownArts.set->GetFirstMember();
      PRInt32 lastKnown =  m_knownArts.set->GetLastMember();
      if (folderInfo)
      {
        PRUint32 lastMissingCheck;
        folderInfo->GetUint32Property("lastMissingCheck", 0, &lastMissingCheck);
        if (lastMissingCheck)
          firstKnown = lastMissingCheck + 1;
      }
      PRBool foundMissingArticle = PR_FALSE;
      while (firstKnown <= lastKnown)
      {
        PRInt32 firstUnreadStart, firstUnreadEnd;
        if (firstKnown == 0)
          firstKnown = 1;
        m_set->FirstMissingRange(firstKnown, lastKnown, &firstUnreadStart, &firstUnreadEnd);
        if (firstUnreadStart)
        {
          while (firstUnreadStart <= firstUnreadEnd)
          {
            PRBool containsKey;
            m_newsDB->ContainsKey(firstUnreadStart, &containsKey);
            if (!containsKey)
            {
              m_set->Add(firstUnreadStart);
              foundMissingArticle = PR_TRUE;
            }
            firstUnreadStart++;
          }
          firstKnown = firstUnreadStart;
        }
        else
          break;

      }
      if (folderInfo)
        folderInfo->SetUint32Property("lastMissingCheck", lastKnown);

      if (foundMissingArticle)
      {
        nsresult rv;
        nsCOMPtr<nsINewsDatabase> db(do_QueryInterface(m_newsDB, &rv));
        NS_ENSURE_SUCCESS(rv,rv);
        db->SetReadSet(m_set);
      }
    }
    m_newsDB->Commit(nsMsgDBCommitType::kSessionCommit);
    m_newsDB->Close(PR_TRUE);
    m_newsDB = nsnull;
  }

  if (m_knownArts.set)
  {
    delete m_knownArts.set;
    m_knownArts.set = nsnull;
  }
  if (m_newsFolder)
    m_newsFolder->NotifyFinishedDownloadinghdrs();

  m_newsFolder = nsnull;
  m_runningURL = nsnull;

  return NS_OK;
}

#ifdef HAVE_CHANGELISTENER
void nsNNTPNewsgroupList::OnAnnouncerGoingAway (ChangeAnnouncer *instigator)
{
}
#endif

static nsresult
openWindow(nsIMsgWindow *aMsgWindow, const char *chromeURL,
           nsINewsDownloadDialogArgs *param)
{
  nsresult rv;
  NS_ENSURE_ARG_POINTER(aMsgWindow);
  nsCOMPtr<nsIDocShell> docShell;
  rv = aMsgWindow->GetRootDocShell(getter_AddRefs(docShell));
  if (NS_FAILED(rv))
      return rv;

  nsCOMPtr<nsIDOMWindowInternal> parentWindow(do_GetInterface(docShell));
  NS_ENSURE_TRUE(parentWindow, NS_ERROR_FAILURE);

  nsCOMPtr<nsISupportsInterfacePointer> ifptr = do_CreateInstance(NS_SUPPORTS_INTERFACE_POINTER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  ifptr->SetData(param);
  ifptr->SetDataIID(&NS_GET_IID(nsINewsDownloadDialogArgs));

  nsCOMPtr<nsIDOMWindow> dialogWindow;
  rv = parentWindow->OpenDialog(NS_ConvertASCIItoUTF16(chromeURL),
                                NS_LITERAL_STRING("_blank"),
                                NS_LITERAL_STRING("centerscreen,chrome,modal,titlebar"),
                                ifptr, getter_AddRefs(dialogWindow));

  return rv;
}

nsresult
nsNNTPNewsgroupList::GetRangeOfArtsToDownload(nsIMsgWindow *aMsgWindow,
                                              PRInt32 first_possible,
                                              PRInt32 last_possible,
                                              PRInt32 maxextra,
                                              PRInt32 *first,
                                              PRInt32 *last,
                                              PRInt32 *status)
{
  nsresult rv = NS_OK;

  NS_ENSURE_ARG_POINTER(first);
  NS_ENSURE_ARG_POINTER(last);
  NS_ENSURE_ARG_POINTER(status);
  *first = 0;
  *last = 0;

  nsCOMPtr <nsIMsgFolder> folder = do_QueryInterface(m_newsFolder, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  m_msgWindow = aMsgWindow;

  nsCOMPtr<nsINewsDatabase> db(do_QueryInterface(m_newsDB, &rv));
  NS_ENSURE_SUCCESS(rv,rv);

  rv = db->GetReadSet(&m_set);
  if (NS_FAILED(rv) || !m_set)
    return rv;

  m_set->SetLastMember(last_possible); // make sure highwater mark is valid.

  nsCOMPtr <nsIDBFolderInfo> newsGroupInfo;
  rv = m_newsDB->GetDBFolderInfo(getter_AddRefs(newsGroupInfo));
  if (NS_SUCCEEDED(rv) && newsGroupInfo) {
    nsCString knownArtsString;
    nsMsgKey mark;
    newsGroupInfo->GetKnownArtsSet(getter_Copies(knownArtsString));

    rv = newsGroupInfo->GetHighWater(&mark);
    NS_ENSURE_SUCCESS(rv,rv);

    if (last_possible < ((PRInt32)mark))
      newsGroupInfo->SetHighWater(last_possible);
    if (m_knownArts.set)
      delete m_knownArts.set;
    m_knownArts.set = nsMsgKeySet::Create(knownArtsString.get());
  }
  else
  {
    if (m_knownArts.set)
      delete m_knownArts.set;
    m_knownArts.set = nsMsgKeySet::Create();
    nsMsgKey low, high;
    rv = m_newsDB->GetLowWaterArticleNum(&low);
    NS_ENSURE_SUCCESS(rv,rv);
    rv = m_newsDB->GetHighWaterArticleNum(&high);
    NS_ENSURE_SUCCESS(rv,rv);
    m_knownArts.set->AddRange(low,high);
  }

  if (m_knownArts.set->IsMember(last_possible)) {
    nsString statusString;
    nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle(NEWS_MSGS_URL, getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = bundle->GetStringFromName(NS_LITERAL_STRING("noNewMessages").get(), getter_Copies(statusString));
    NS_ENSURE_SUCCESS(rv, rv);

    SetProgressStatus(statusString.get());
  }

  if (maxextra <= 0 || last_possible < first_possible || last_possible < 1)
  {
    *status=0;
    return NS_OK;
  }

  m_knownArts.first_possible = first_possible;
  m_knownArts.last_possible = last_possible;

  nsCOMPtr <nsIMsgIncomingServer> server;
  rv = folder->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsINntpIncomingServer> nntpServer = do_QueryInterface(server, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  /* Determine if we only want to get just new articles or more messages.
  If there are new articles at the end we haven't seen, we always want to get those first.
  Otherwise, we get the newest articles we haven't gotten, if we're getting more.
  My thought for now is that opening a newsgroup should only try to get new articles.
  Selecting "More Messages" will first try to get unseen messages, then old messages. */

  if (m_getOldMessages || !m_knownArts.set->IsMember(last_possible))
  {
    PRBool notifyMaxExceededOn = PR_TRUE;
    rv = nntpServer->GetNotifyOn(&notifyMaxExceededOn);
    if (NS_FAILED(rv)) notifyMaxExceededOn = PR_TRUE;

    // if the preference to notify when downloading more than x headers is not on,
    // and we're downloading new headers, set maxextra to a very large number.
    if (!m_getOldMessages && !notifyMaxExceededOn)
      maxextra = 0x7FFFFFFFL;
        int result =
            m_knownArts.set->LastMissingRange(first_possible, last_possible,
                                              first, last);
    if (result < 0) {
            *status=result;
      return NS_ERROR_NOT_INITIALIZED;
        }
    if (*first > 0 && *last - *first >= maxextra)
    {
      if (!m_getOldMessages && !m_promptedAlready && notifyMaxExceededOn)
      {
        m_downloadAll = PR_FALSE;
        nsCOMPtr<nsINewsDownloadDialogArgs> args = do_CreateInstance("@mozilla.org/messenger/newsdownloaddialogargs;1", &rv);
        if (NS_FAILED(rv)) return rv;
        NS_ENSURE_SUCCESS(rv,rv);

        rv = args->SetArticleCount(*last - *first + 1);
        NS_ENSURE_SUCCESS(rv,rv);

        nsString groupName;
        rv = m_newsFolder->GetUnicodeName(groupName);
        NS_ENSURE_SUCCESS(rv,rv);

        rv = args->SetGroupName(groupName);
        NS_ENSURE_SUCCESS(rv,rv);

        // get the server key
        nsCString serverKey;
        rv = server->GetKey(serverKey);
        NS_ENSURE_SUCCESS(rv,rv);

        rv = args->SetServerKey(serverKey.get());
        NS_ENSURE_SUCCESS(rv,rv);

        // we many not have a msgWindow if we are running an autosubscribe url from the browser
        // and there isn't a 3 pane open.
        //
        // if we don't have one, bad things will happen when we fail to open up the "download headers dialog"
        // (we will subscribe to the newsgroup, but it will appear like there are no messages!)
        //
        // for now, act like the "download headers dialog" came up, and the user hit cancel.  (very safe)
        //
        // TODO, figure out why we aren't opening and using a 3 pane when the autosubscribe url is run.
        // perhaps we can find an available 3 pane, and use it.

        PRBool download = PR_FALSE;

        if (aMsgWindow) {
          rv = openWindow(aMsgWindow, DOWNLOAD_HEADERS_URL, args);
          NS_ENSURE_SUCCESS(rv,rv);

          rv = args->GetHitOK(&download);
          NS_ENSURE_SUCCESS(rv,rv);
        }

      if (download) {
         rv = args->GetDownloadAll(&m_downloadAll);
         NS_ENSURE_SUCCESS(rv,rv);
         m_maxArticles = 0;
         rv = nntpServer->GetMaxArticles(&m_maxArticles);
         NS_ENSURE_SUCCESS(rv,rv);

          maxextra = m_maxArticles;
          if (!m_downloadAll)
          {
            PRBool markOldRead = PR_FALSE;

            rv = nntpServer->GetMarkOldRead(&markOldRead);
            if (NS_FAILED(rv)) markOldRead = PR_FALSE;

            if (markOldRead && m_set)
              m_set->AddRange(*first, *last - maxextra);
            *first = *last - maxextra + 1;
          }
        }
        else
          *first = *last = 0;
        m_promptedAlready = PR_TRUE;
      }
      else if (m_promptedAlready && !m_downloadAll)
        *first = *last - m_maxArticles + 1;
      else if (!m_downloadAll)
        *first = *last - maxextra + 1;
    }
  }

  m_firstMsgToDownload = *first;
  m_lastMsgToDownload = *last;
  *status=0;
  return NS_OK;
}

nsresult
nsNNTPNewsgroupList::AddToKnownArticles(PRInt32 first, PRInt32 last)
{
  int status;

  if (!m_knownArts.set)
  {
    m_knownArts.set = nsMsgKeySet::Create();
    if (!m_knownArts.set)
      return NS_ERROR_OUT_OF_MEMORY;
  }

  status = m_knownArts.set->AddRange(first, last);

  if (m_newsDB) {
    nsresult rv = NS_OK;
    nsCOMPtr <nsIDBFolderInfo> newsGroupInfo;
    rv = m_newsDB->GetDBFolderInfo(getter_AddRefs(newsGroupInfo));
    if (NS_SUCCEEDED(rv) && newsGroupInfo) {
      nsCString output;
      status = m_knownArts.set->Output(getter_Copies(output));
      if (!output.IsEmpty())
        newsGroupInfo->SetKnownArtsSet(output.get());
    }
  }
  return status;
}

nsresult
nsNNTPNewsgroupList::InitXOVER(PRInt32 first_msg, PRInt32 last_msg)
{
  /* Consistency checks, not that I know what to do if it fails (it will
   probably handle it OK...) */
  NS_ASSERTION(first_msg <= last_msg, "first > last");

  /* If any XOVER lines from the last time failed to come in, mark those
     messages as read. */
  if (m_lastProcessedNumber < m_lastMsgNumber)
  {
    m_set->AddRange(m_lastProcessedNumber + 1, m_lastMsgNumber);
  }
  m_firstMsgNumber = first_msg;
  m_lastMsgNumber = last_msg;
  m_lastProcessedNumber = first_msg > 1 ? first_msg - 1 : 1;
  m_currentXHDRIndex = -1;
  return NS_OK;
}

// from RFC 822, don't translate
#define FROM_HEADER "From: "
#define SUBJECT_HEADER "Subject: "
#define DATE_HEADER "Date: "

nsresult
nsNNTPNewsgroupList::ParseLine(char *line, PRUint32 * message_number)
{
  nsresult rv = NS_OK;
  nsCOMPtr <nsIMsgDBHdr> newMsgHdr;
  char *dateStr = nsnull;  // keep track of date str, for filters
  char *authorStr = nsnull; // keep track of author str, for filters

  if (!line || !message_number) {
    return NS_ERROR_NULL_POINTER;
  }

  char *next = line;

#define GET_TOKEN()                           \
  line = next;                                \
  next = (line ? PL_strchr (line, '\t') : 0); \
  if (next) *next++ = 0

  GET_TOKEN (); /* message number */
  *message_number = atol(line);

  if (atol(line) == 0) /* bogus xover data */
    return NS_ERROR_UNEXPECTED;

  m_newsDB->CreateNewHdr(*message_number, getter_AddRefs(newMsgHdr));

  NS_ASSERTION(newMsgHdr, "CreateNewHdr didn't fail, but it returned a null newMsgHdr");
  if (!newMsgHdr)
    return NS_ERROR_NULL_POINTER;

  GET_TOKEN (); /* subject */
  if (line) {
    const char *subject = line;  /* #### const evilness */
    PRUint32 subjectLen = strlen(line);

    PRUint32 flags = 0;
    // ### should call IsHeaderRead here...
    /* strip "Re: " */
    nsCString modifiedSubject;
    if (NS_MsgStripRE(&subject, &subjectLen, getter_Copies(modifiedSubject)))
      (void) newMsgHdr->OrFlags(nsMsgMessageFlags::HasRe, &flags);
    
    // this will make sure read flags agree with newsrc
    if (! (flags & nsMsgMessageFlags::Read))
      rv = newMsgHdr->OrFlags(nsMsgMessageFlags::New, &flags);

    rv = newMsgHdr->SetSubject(modifiedSubject.IsEmpty() ? subject : modifiedSubject.get());

    if (NS_FAILED(rv))
      return rv;
  }

  GET_TOKEN (); /* author */
  if (line) {
    authorStr = line;
    rv = newMsgHdr->SetAuthor(line);
    if (NS_FAILED(rv))
      return rv;
  }

  GET_TOKEN ();
  if (line) {
    dateStr = line;
    PRTime date;
    PRStatus status = PR_ParseTimeString (line, PR_FALSE, &date);
    if (PR_SUCCESS == status) {
      rv = newMsgHdr->SetDate(date); /* date */
      if (NS_FAILED(rv))
        return rv;
    }
  }

  GET_TOKEN (); /* message id */
  if (line) {
    char *strippedId = line;
    if (strippedId[0] == '<')
      strippedId++;
    char * lastChar = strippedId + PL_strlen(strippedId) -1;

    if (*lastChar == '>')
      *lastChar = '\0';

    rv = newMsgHdr->SetMessageId(strippedId);
    if (NS_FAILED(rv))
      return rv;
  }

  GET_TOKEN (); /* references */
  if (line) {
    rv = newMsgHdr->SetReferences(line);
    if (NS_FAILED(rv))
      return rv;
  }

  GET_TOKEN (); /* bytes */
  if (line) {
    PRUint32 msgSize = 0;
    msgSize = (line) ? atol (line) : 0;

    rv = newMsgHdr->SetMessageSize(msgSize);
    if (NS_FAILED(rv)) return rv;
  }

  GET_TOKEN (); /* lines */
  if (line) {
    PRUint32 numLines = 0;
    numLines = line ? atol (line) : 0;
    rv = newMsgHdr->SetLineCount(numLines);
    if (NS_FAILED(rv)) return rv;
  }

  GET_TOKEN (); /* xref */

  m_newHeaders.AppendObject(newMsgHdr);
  return NS_OK;
}

NS_IMETHODIMP nsNNTPNewsgroupList::ApplyFilterHit(nsIMsgFilter *aFilter, nsIMsgWindow *aMsgWindow, PRBool *aApplyMore)
{
  NS_ENSURE_ARG_POINTER(aFilter);
  NS_ENSURE_ARG_POINTER(aApplyMore);
  NS_ENSURE_TRUE(m_newMsgHdr, NS_ERROR_UNEXPECTED);
  NS_ENSURE_TRUE(m_newsDB, NS_ERROR_UNEXPECTED);

  // you can't move news messages, so applyMore is always true
  *aApplyMore = PR_TRUE;

  nsCOMPtr<nsISupportsArray> filterActionList;
  nsresult rv = NS_NewISupportsArray(getter_AddRefs(filterActionList));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = aFilter->GetSortedActionList(filterActionList);
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 numActions;
  rv = filterActionList->Count(&numActions);
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool loggingEnabled = PR_FALSE;
  nsCOMPtr<nsIMsgFilterList> currentFilterList;
  rv = aFilter->GetFilterList(getter_AddRefs(currentFilterList));
  if (NS_SUCCEEDED(rv) && currentFilterList && numActions)
    currentFilterList->GetLoggingEnabled(&loggingEnabled);

  for (PRUint32 actionIndex = 0; actionIndex < numActions; actionIndex++)
  {
    nsCOMPtr<nsIMsgRuleAction> filterAction;
    filterActionList->QueryElementAt(actionIndex, NS_GET_IID(nsIMsgRuleAction), getter_AddRefs(filterAction));
    if (!filterAction)
      continue;

    nsMsgRuleActionType actionType;
    if (NS_SUCCEEDED(filterAction->GetType(&actionType)))
    {
      switch (actionType)
      {
      case nsMsgFilterAction::Delete:
        m_addHdrToDB = PR_FALSE;
        break;
      case nsMsgFilterAction::MarkRead:
        m_newsDB->MarkHdrRead(m_newMsgHdr, PR_TRUE, nsnull);
        break;
      case nsMsgFilterAction::KillThread:
        m_newMsgHdr->SetUint32Property("ProtoThreadFlags", nsMsgMessageFlags::Ignored);
        break;
      case nsMsgFilterAction::KillSubthread:
        {
          PRUint32 newFlags;
          m_newMsgHdr->OrFlags(nsMsgMessageFlags::Ignored, &newFlags);
        }
        break;
      case nsMsgFilterAction::WatchThread:
        {
          PRUint32 newFlags;
          m_newMsgHdr->OrFlags(nsMsgMessageFlags::Watched, &newFlags);
        }
        break;
      case nsMsgFilterAction::MarkFlagged:
        m_newMsgHdr->MarkFlagged(PR_TRUE);
        break;
      case nsMsgFilterAction::ChangePriority:
        {
          nsMsgPriorityValue filterPriority;
          filterAction->GetPriority(&filterPriority);
          m_newMsgHdr->SetPriority(filterPriority);
        }
        break;
      case nsMsgFilterAction::AddTag:
      {
        nsCString keyword;
        filterAction->GetStrValue(keyword);
        nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID));
        messageArray->AppendElement(m_newMsgHdr, PR_FALSE);
        nsCOMPtr <nsIMsgFolder> folder = do_QueryInterface(m_newsFolder, &rv);
        if (folder)
          folder->AddKeywordsToMessages(messageArray, keyword);
        break;
      }
      case nsMsgFilterAction::Label:
        {
          nsMsgLabelValue filterLabel;
          filterAction->GetLabel(&filterLabel);
          nsMsgKey msgKey;
          m_newMsgHdr->GetMessageKey(&msgKey);
          m_newsDB->SetLabel(msgKey, filterLabel);
        }
        break;

      case nsMsgFilterAction::StopExecution:
      {
        // don't apply any more filters
        *aApplyMore = PR_FALSE;
      }
      break;

      case nsMsgFilterAction::Custom:
      {
        nsCOMPtr<nsIMsgFilterCustomAction> customAction;
        rv = filterAction->GetCustomAction(getter_AddRefs(customAction));
        NS_ENSURE_SUCCESS(rv, rv);

        nsCAutoString value;
        filterAction->GetStrValue(value);

        nsCOMPtr<nsIMutableArray> messageArray(
            do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
        NS_ENSURE_TRUE(messageArray, rv);
        messageArray->AppendElement(m_newMsgHdr, PR_FALSE);

        customAction->Apply(messageArray, value, nsnull,
                            nsMsgFilterType::NewsRule, aMsgWindow);
      }
      break;

      default:
        NS_ERROR("unexpected action");
        break;
      }

      if (loggingEnabled)
        (void) aFilter->LogRuleHit(filterAction, m_newMsgHdr);
    }
  }
  return NS_OK;
}

nsresult
nsNNTPNewsgroupList::ProcessXOVERLINE(const char *line, PRUint32 *status)
{
  PRUint32 message_number=0;
  //  PRInt32 lines;
  PRBool read_p = PR_FALSE;
  nsresult rv = NS_OK;

  NS_ASSERTION(line, "null ptr");
  if (!line)
    return NS_ERROR_NULL_POINTER;

  if (m_newsDB)
  {
    char *xoverline = PL_strdup(line);
    if (!xoverline)
      return NS_ERROR_OUT_OF_MEMORY;
    rv = ParseLine(xoverline, &message_number);
    PL_strfree(xoverline);
    xoverline = nsnull;
    if (NS_FAILED(rv))
      return rv;
  }
  else
    return NS_ERROR_NOT_INITIALIZED;

  NS_ASSERTION(message_number > m_lastProcessedNumber ||
               message_number == 1, "bad message_number");
  if (m_set && message_number > m_lastProcessedNumber + 1)
  {
  /* There are some articles that XOVER skipped; they must no longer
     exist.  Mark them as read in the newsrc, so we don't include them
     next time in our estimated number of unread messages. */
    if (m_set->AddRange(m_lastProcessedNumber + 1, message_number - 1))
    {
    /* This isn't really an important enough change to warrant causing
       the newsrc file to be saved; we haven't gathered any information
       that won't also be gathered for free next time.  */
    }
  }

  m_lastProcessedNumber = message_number;
  if (m_knownArts.set)
  {
    int result = m_knownArts.set->Add(message_number);
    if (result < 0) {
      if (status)
        *status = result;
      return NS_ERROR_NOT_INITIALIZED;
    }
  }

  if (message_number > m_lastMsgNumber)
    m_lastMsgNumber = message_number;
  else if (message_number < m_firstMsgNumber)
    m_firstMsgNumber = message_number;

  if (m_set) {
    read_p = m_set->IsMember(message_number);
  }

  /* Update the progress meter with a percentage of articles retrieved */
  if (m_lastMsgNumber > m_firstMsgNumber)
  {
    PRInt32 totalToDownload = m_lastMsgToDownload - m_firstMsgToDownload + 1;
    PRInt32 lastIndex = m_lastProcessedNumber - m_firstMsgNumber + 1;
    PRInt32 numDownloaded = lastIndex;
    PRInt32 totIndex = m_lastMsgNumber - m_firstMsgNumber + 1;

    PRTime elapsedTime = PR_Now() - m_lastStatusUpdate;

    if (elapsedTime > MIN_STATUS_UPDATE_INTERVAL || lastIndex == totIndex)
      UpdateStatus(PR_FALSE, numDownloaded, totalToDownload);
  }
  return NS_OK;
}

nsresult
nsNNTPNewsgroupList::ResetXOVER()
{
  m_lastMsgNumber = m_firstMsgNumber;
  m_lastProcessedNumber = m_lastMsgNumber;
  return 0;
}

nsresult
nsNNTPNewsgroupList::FinishXOVERLINE(int status, int *newstatus)
{
  nsresult rv;
  struct MSG_NewsKnown* k;

  /* If any XOVER lines from the last time failed to come in, mark those
     messages as read. */

  if (status >= 0 && m_lastProcessedNumber < m_lastMsgNumber) {
    m_set->AddRange(m_lastProcessedNumber + 1, m_lastMsgNumber);
  }

  if (m_lastProcessedNumber)
    AddToKnownArticles(m_firstMsgNumber, m_lastProcessedNumber);

  k = &m_knownArts;

  if (k && k->set)
  {
    PRInt32 n = k->set->FirstNonMember();
    if (n < k->first_possible || n > k->last_possible)
    {
      /* We know we've gotten all there is to know.
         Take advantage of that to update our counts... */
      // ### dmb
    }
  }

  if (!m_finishingXover)
  {
    // turn on m_finishingXover - this is a horrible hack to avoid recursive
    // calls which happen when the fe selects a message as a result of getting EndingUpdate,
    // which interrupts this url right before it was going to finish and causes FinishXOver
    // to get called again.
    m_finishingXover = PR_TRUE;

    // XXX is this correct?
    m_runningURL = nsnull;

    if (m_lastMsgNumber > 0) {
      nsAutoString firstStr;
      firstStr.AppendInt(m_lastProcessedNumber - m_firstMsgNumber + 1);

      nsAutoString lastStr;
      lastStr.AppendInt(m_lastMsgNumber - m_firstMsgNumber + 1);

      nsString statusString;
      nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIStringBundle> bundle;
      rv = bundleService->CreateBundle(NEWS_MSGS_URL, getter_AddRefs(bundle));
      NS_ENSURE_SUCCESS(rv, rv);

      const PRUnichar *formatStrings[2] = { firstStr.get(), lastStr.get() };
      rv = bundle->FormatStringFromName(NS_LITERAL_STRING("downloadingArticles").get(), formatStrings, 2, getter_Copies(statusString));
      NS_ENSURE_SUCCESS(rv, rv);

      SetProgressStatus(statusString.get());
    }
  }

  if (newstatus)
    *newstatus=0;

  return NS_OK;
}

NS_IMETHODIMP
nsNNTPNewsgroupList::InitXHDR(nsACString &header)
{
  if (++m_currentXHDRIndex >= m_filterHeaders.Length())
    header.Truncate();
  else
    header.Assign(m_filterHeaders[m_currentXHDRIndex]);
  // Don't include these in our XHDR bouts, as they are already provided through
  // XOVER. 
  if (header.EqualsLiteral("message-id") ||
      header.EqualsLiteral("references"))
    return InitXHDR(header);
  return NS_OK;
}

NS_IMETHODIMP
nsNNTPNewsgroupList::ProcessXHDRLine(const nsACString &line)
{
  PRInt32 middle = line.FindChar(' ');
  nsCString value, key = PromiseFlatCString(line);
  if (middle == -1)
    return NS_OK;
  value = Substring(line, middle+1);
  key.Truncate((PRUint32)middle);

  // According to RFC 2980, some will send (none) instead.
  // So we don't treat this is an error.
  if (key.CharAt(0) < '0' || key.CharAt(0) > '9')
    return NS_OK;

  PRInt32 code;
  PRInt32 number = key.ToInteger(&code);
  if (code != NS_OK)
    return NS_ERROR_FAILURE;
  // RFC 2980 specifies one or more spaces.
  value.Trim(" ");

  nsCOMPtr <nsIMsgDBHdr> header;
  nsresult rv = m_newsDB->GetMsgHdrForKey(number, getter_AddRefs(header));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = header->SetStringProperty(m_filterHeaders[m_currentXHDRIndex].get(), value.get());
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 totalToDownload = m_lastMsgToDownload - m_firstMsgToDownload + 1;
  PRInt32 numDownloaded = number - m_firstMsgNumber + 1;

  PRTime elapsedTime = PR_Now() - m_lastStatusUpdate;

  if (elapsedTime > MIN_STATUS_UPDATE_INTERVAL)
    UpdateStatus(PR_TRUE, numDownloaded, totalToDownload);
  return rv;
}

NS_IMETHODIMP
nsNNTPNewsgroupList::InitHEAD(PRInt32 number)
{
  if (m_newMsgHdr)
  {
    // Finish processing for this header
    // If HEAD didn't properly return, then the header won't be set
    m_newHeaders.AppendObject(m_newMsgHdr);

    PRInt32 totalToDownload = m_lastMsgToDownload - m_firstMsgToDownload + 1;
    PRInt32 lastIndex = m_lastProcessedNumber - m_firstMsgNumber + 1;
    PRInt32 numDownloaded = lastIndex;
    PRInt32 totIndex = m_lastMsgNumber - m_firstMsgNumber + 1;

    PRTime elapsedTime = PR_Now() - m_lastStatusUpdate;

    if (elapsedTime > MIN_STATUS_UPDATE_INTERVAL || lastIndex == totIndex)
      UpdateStatus(PR_FALSE, numDownloaded, totalToDownload);
  }

  if (number >= 0)
  {
    if (m_newHeaders.Count() > 0 && m_lastMsgNumber == m_lastProcessedNumber)
    {
      // We have done some processing of messages. This means that we have
      // relics of headers from XOVER. Since we will get everything from HEAD
      // anyways, just clear the array.
      m_newHeaders.Clear();
    }

    nsresult rv = m_newsDB->CreateNewHdr(number, getter_AddRefs(m_newMsgHdr));
    m_lastProcessedNumber = number;
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else
  {
    AddToKnownArticles(m_firstMsgNumber, m_lastProcessedNumber);
  }
  return NS_OK;
}

NS_IMETHODIMP
nsNNTPNewsgroupList::HEADFailed(PRInt32 number)
{
  m_set->Add(number);
  return NS_OK;
}

NS_IMETHODIMP
nsNNTPNewsgroupList::ProcessHEADLine(const nsACString &line)
{
  PRInt32 colon = line.FindChar(':');
  nsCString header = PromiseFlatCString(line), value;
  if (colon != -1)
  {
    value = Substring(line, colon+1);
    header.Truncate((PRUint32)colon);
  }
  else if (line.CharAt(0) == ' ' || line.CharAt(0) == '\t') // We are continuing the header
  {
    m_thisLine += header; // Preserve whitespace (should we?)
    return NS_OK;
  }
  else
  {
    return NS_OK; // We are malformed. Just ignore and hope for the best...
  }
  
  nsresult rv;
  if (!m_lastHeader.IsEmpty())
  {
    rv = AddHeader(m_lastHeader.get(), m_thisLine.get());
    NS_ENSURE_SUCCESS(rv,rv);
  }
  
  value.Trim(" ");

  ToLowerCase(header, m_lastHeader);
  m_thisLine.Assign(value);
  return NS_OK;
}

nsresult
nsNNTPNewsgroupList::AddHeader(const char *header, const char *value)
{
  nsresult rv = NS_OK;
  // The From, Date, and Subject headers have special requirements.
  if (PL_strcmp(header, "from") == 0)
  {
    rv = m_newMsgHdr->SetAuthor(value);
  }
  else if (PL_strcmp(header, "date") == 0)
  {
    PRTime date;
    PRStatus status = PR_ParseTimeString (value, PR_FALSE, &date);
    if (PR_SUCCESS == status)
      rv = m_newMsgHdr->SetDate(date);
  }
  else if (PL_strcmp(header, "subject") == 0)
  {
    const char *subject = value;
    PRUint32 subjectLen = strlen(value);

    PRUint32 flags = 0;
    // ### should call IsHeaderRead here...
    /* strip "Re: " */
    nsCString modifiedSubject;
    if (NS_MsgStripRE(&subject, &subjectLen, getter_Copies(modifiedSubject)))
      // this will make sure read flags agree with newsrc
     (void) m_newMsgHdr->OrFlags(nsMsgMessageFlags::HasRe, &flags);

    if (! (flags & nsMsgMessageFlags::Read))
      rv = m_newMsgHdr->OrFlags(nsMsgMessageFlags::New, &flags);

    rv = m_newMsgHdr->SetSubject(modifiedSubject.IsEmpty() ? subject :
      modifiedSubject.get());
  }
  else if (PL_strcmp(header, "message-id") == 0)
  {
    rv = m_newMsgHdr->SetMessageId(value);
  }
  else if (PL_strcmp(header, "references") == 0)
  {
    rv = m_newMsgHdr->SetReferences(value);
  }
  else if (PL_strcmp(header, "bytes") == 0)
  {
    rv = m_newMsgHdr->SetMessageSize(atol(value));
  }
  else if (PL_strcmp(header, "lines") == 0)
  {
    rv = m_newMsgHdr->SetLineCount(atol(value));
  }
  else if (m_filterHeaders.IndexOf(nsDependentCString(header)) != m_filterHeaders.NoIndex)
  {
    rv = m_newMsgHdr->SetStringProperty(header, value);
  }
  return rv;
}

nsresult
nsNNTPNewsgroupList::CallFilters()
{
  nsresult rv;
  nsCString filterString;
  
  nsCOMPtr <nsIMsgFolder> folder = do_QueryInterface(m_newsFolder, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  PRUint32 filterCount = 0;
  if (m_filterList)
  {
    rv = m_filterList->GetFilterCount(&filterCount);
    NS_ENSURE_SUCCESS(rv,rv);
  }

  PRUint32 serverFilterCount = 0;
  if (m_serverFilterList)
  {
    rv = m_serverFilterList->GetFilterCount(&serverFilterCount);
    NS_ENSURE_SUCCESS(rv,rv);
  }

  PRUint32 count = m_newHeaders.Count();

  // Notify MsgFolderListeners of message adds
  nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));

  for (PRUint32 i = 0; i < count; i++)
  {
    m_newMsgHdr = m_newHeaders[i];
    if (!filterCount && !serverFilterCount)
    {
      m_newsDB->AddNewHdrToDB(m_newMsgHdr, PR_TRUE);

      if (notifier)
        notifier->NotifyMsgAdded(m_newMsgHdr);
      // mark the header as not yet reported classified
      nsMsgKey msgKey;
      m_newMsgHdr->GetMessageKey(&msgKey);
      folder->OrProcessingFlags(msgKey,
                                nsMsgProcessingFlags::NotReportedClassified);

      continue;
    }
    m_addHdrToDB = PR_TRUE;

    // build up a "headers" for filter code
    nsCString subject, author, date;
    rv = m_newMsgHdr->GetSubject(getter_Copies(subject));
    NS_ENSURE_SUCCESS(rv,rv);
    rv = m_newMsgHdr->GetAuthor(getter_Copies(author));
    NS_ENSURE_SUCCESS(rv,rv);

    nsCString fullHeaders;
    if (!(author.IsEmpty()))
    {
      fullHeaders.AppendLiteral(FROM_HEADER);
      fullHeaders += author;
      fullHeaders += '\0';
    }

    if (!(subject.IsEmpty()))
    {
      fullHeaders.AppendLiteral(SUBJECT_HEADER);
      fullHeaders += subject;
      fullHeaders += '\0';
    }

    for (PRUint32 header = 0; header < m_filterHeaders.Length(); header++)
    {
      nsCString retValue;
      m_newMsgHdr->GetStringProperty(m_filterHeaders[header].get(),
                                     getter_Copies(retValue));
      if (!retValue.IsEmpty())
      {
        fullHeaders += m_filterHeaders[header];
        fullHeaders.AppendLiteral(": ");
        fullHeaders += retValue;
        fullHeaders += '\0';
      }
    }

    // The per-newsgroup filters should go first. If something stops filter
    // execution, then users should be able to override the global filters in
    // the per-newsgroup filters.
    if (filterCount)
    {
      rv = m_filterList->ApplyFiltersToHdr(nsMsgFilterType::NewsRule,
          m_newMsgHdr, folder, m_newsDB, fullHeaders.get(),
          fullHeaders.Length(), this, m_msgWindow, nsnull);
    }
    if (serverFilterCount)
    {
      rv = m_serverFilterList->ApplyFiltersToHdr(nsMsgFilterType::NewsRule,
          m_newMsgHdr, folder, m_newsDB, fullHeaders.get(),
          fullHeaders.Length(), this, m_msgWindow, nsnull);
    }

    NS_ENSURE_SUCCESS(rv,rv);

    if (m_addHdrToDB)
    {
      m_newsDB->AddNewHdrToDB(m_newMsgHdr, PR_TRUE);
      if (notifier)
        notifier->NotifyMsgAdded(m_newMsgHdr);
      // mark the header as not yet reported classified
      nsMsgKey msgKey;
      m_newMsgHdr->GetMessageKey(&msgKey);
      folder->OrProcessingFlags(msgKey,
                                nsMsgProcessingFlags::NotReportedClassified);
    }
  }
  m_newHeaders.Clear();
  return NS_OK;
}

void
nsNNTPNewsgroupList::SetProgressBarPercent(PRInt32 percent)
{
  if (!m_runningURL)
    return;

  nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningURL);
  if (mailnewsUrl) {
    nsCOMPtr <nsIMsgStatusFeedback> feedback;
    mailnewsUrl->GetStatusFeedback(getter_AddRefs(feedback));

    if (feedback) {
      feedback->ShowProgress(percent);
    }
  }
}

void
nsNNTPNewsgroupList::SetProgressStatus(const PRUnichar *message)
{
  if (!m_runningURL)
    return;

  nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningURL);
  if (mailnewsUrl) {
    nsCOMPtr <nsIMsgStatusFeedback> feedback;
    mailnewsUrl->GetStatusFeedback(getter_AddRefs(feedback));

    if (feedback) {
      feedback->ShowStatusString(nsDependentString(message));
    }
  }
}

void
nsNNTPNewsgroupList::UpdateStatus(PRBool filtering, PRInt32 numDLed, PRInt32 totToDL)
{
  PRInt32 numerator = (filtering ? m_currentXHDRIndex + 1 : 1) * numDLed;
  PRInt32 denominator = (m_filterHeaders.Length() + 1) * totToDL;
  PRInt32 percent = numerator * 100 / denominator;
  
  nsAutoString numDownloadedStr;
  numDownloadedStr.AppendInt(numDLed);

  nsAutoString totalToDownloadStr;
  totalToDownloadStr.AppendInt(totToDL);

  nsAutoString newsgroupName;
  nsresult rv = m_newsFolder->GetUnicodeName(newsgroupName);
  if (!NS_SUCCEEDED(rv))
      return;

  nsString statusString;
  nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  if (!NS_SUCCEEDED(rv))
    return;

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle(NEWS_MSGS_URL, getter_AddRefs(bundle));
  if (!NS_SUCCEEDED(rv))
    return;

  if (filtering)
  {
    NS_ConvertUTF8toUTF16 header(m_filterHeaders[m_currentXHDRIndex]);
    const PRUnichar *formatStrings[4] = { header.get(),
      numDownloadedStr.get(), totalToDownloadStr.get(), newsgroupName.get() };
    rv = bundle->FormatStringFromName(NS_LITERAL_STRING("newNewsgroupFilteringHeaders").get(),
      formatStrings, 4, getter_Copies(statusString));
  }
  else
  {
    const PRUnichar *formatStrings[3] = { numDownloadedStr.get(),
      totalToDownloadStr.get(), newsgroupName.get() };
    rv = bundle->FormatStringFromName(NS_LITERAL_STRING("newNewsgroupHeaders").get(),
      formatStrings, 3, getter_Copies(statusString));
  }
  if (!NS_SUCCEEDED(rv))
    return;

  SetProgressStatus(statusString.get());
  m_lastStatusUpdate = PR_Now();

  // only update the progress meter if it has changed
  if (percent != m_lastPercent)
  {
    SetProgressBarPercent(percent);
    m_lastPercent = percent;
  }
}

NS_IMETHODIMP nsNNTPNewsgroupList::SetGetOldMessages(PRBool aGetOldMessages)
{
  m_getOldMessages = aGetOldMessages;
  return NS_OK;
}

NS_IMETHODIMP nsNNTPNewsgroupList::GetGetOldMessages(PRBool *aGetOldMessages)
{
  NS_ENSURE_ARG(aGetOldMessages);

  *aGetOldMessages = m_getOldMessages;
  return NS_OK;
}
