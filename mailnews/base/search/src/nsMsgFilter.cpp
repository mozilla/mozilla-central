/* -*- Mode: C++; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Howard Chu <hyc@symas.com>
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

// this file implements the nsMsgFilter interface

#include "msgCore.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgHdr.h"
#include "nsMsgFilterList.h"    // for kFileVersion
#include "nsMsgFilter.h"
#include "nsMsgUtils.h"
#include "nsMsgLocalSearch.h"
#include "nsMsgSearchTerm.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgIncomingServer.h"
#include "nsMsgSearchValue.h"
#include "nsMsgI18N.h"
#include "nsISupportsObsolete.h"
#include "nsIOutputStream.h"
#include "nsIStringBundle.h"
#include "nsDateTimeFormatCID.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsIMsgFilterService.h"
#include "prmem.h"

static const char *kImapPrefix = "//imap:";
static const char *kWhitespace = "\b\t\r\n ";

nsMsgRuleAction::nsMsgRuleAction()
{
}

nsMsgRuleAction::~nsMsgRuleAction()
{
}

NS_IMPL_ISUPPORTS1(nsMsgRuleAction, nsIMsgRuleAction)

NS_IMPL_GETSET(nsMsgRuleAction, Type, nsMsgRuleActionType, m_type)

NS_IMETHODIMP nsMsgRuleAction::SetPriority(nsMsgPriorityValue aPriority)
{
  NS_ENSURE_TRUE(m_type == nsMsgFilterAction::ChangePriority,
                NS_ERROR_ILLEGAL_VALUE);
  m_priority = aPriority;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::GetPriority(nsMsgPriorityValue *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_TRUE(m_type == nsMsgFilterAction::ChangePriority,
                 NS_ERROR_ILLEGAL_VALUE);
  *aResult = m_priority;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::SetLabel(nsMsgLabelValue aLabel)
{
  NS_ENSURE_TRUE(m_type == nsMsgFilterAction::Label,
                 NS_ERROR_ILLEGAL_VALUE);
  m_label = aLabel;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::GetLabel(nsMsgLabelValue *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_TRUE(m_type == nsMsgFilterAction::Label, NS_ERROR_ILLEGAL_VALUE);
  *aResult = m_label;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::SetTargetFolderUri(const nsACString &aUri)
{
  NS_ENSURE_TRUE(m_type == nsMsgFilterAction::MoveToFolder ||
                 m_type == nsMsgFilterAction::CopyToFolder,
                 NS_ERROR_ILLEGAL_VALUE);
  m_folderUri = aUri;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::GetTargetFolderUri(nsACString &aResult)
{
  NS_ENSURE_TRUE(m_type == nsMsgFilterAction::MoveToFolder ||
                 m_type == nsMsgFilterAction::CopyToFolder,
                 NS_ERROR_ILLEGAL_VALUE);
  aResult = m_folderUri;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::SetJunkScore(PRInt32 aJunkScore)
{
  NS_ENSURE_TRUE(m_type == nsMsgFilterAction::JunkScore && aJunkScore >= 0 && aJunkScore <= 100,
                 NS_ERROR_ILLEGAL_VALUE);
  m_junkScore = aJunkScore;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::GetJunkScore(PRInt32 *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_TRUE(m_type == nsMsgFilterAction::JunkScore, NS_ERROR_ILLEGAL_VALUE);
  *aResult = m_junkScore;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::SetStrValue(const nsACString &aStrValue)
{
  m_strValue = aStrValue;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRuleAction::GetStrValue(nsACString &aStrValue)
{
  aStrValue = m_strValue;
  return NS_OK;
}

/* attribute ACString customId; */
NS_IMETHODIMP nsMsgRuleAction::GetCustomId(nsACString & aCustomId)
{
  aCustomId = m_customId;
  return NS_OK;
}

NS_IMETHODIMP nsMsgRuleAction::SetCustomId(const nsACString & aCustomId)
{
  m_customId = aCustomId;
  return NS_OK;
}

// this can only be called after the customId is set
NS_IMETHODIMP nsMsgRuleAction::GetCustomAction(nsIMsgFilterCustomAction **aCustomAction)
{
  NS_ENSURE_ARG_POINTER(aCustomAction);
  if (!m_customAction)
  {
    if (m_customId.IsEmpty())
    {
      NS_ERROR("Need to set CustomId");
      return NS_ERROR_NOT_INITIALIZED;
    }
    nsresult rv;
    nsCOMPtr<nsIMsgFilterService> filterService =
        do_GetService(NS_MSGFILTERSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = filterService->GetCustomAction(m_customId, getter_AddRefs(m_customAction));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // found the correct custom action
  NS_ADDREF(*aCustomAction = m_customAction);
  return NS_OK;
}

nsMsgFilter::nsMsgFilter():
    m_temporary(PR_FALSE),
    m_unparseable(PR_FALSE),
    m_filterList(nsnull),
    m_expressionTree(nsnull)
{
  NS_NewISupportsArray(getter_AddRefs(m_termList));
  NS_NewISupportsArray(getter_AddRefs(m_actionList));

  m_type = nsMsgFilterType::InboxRule | nsMsgFilterType::Manual;
}

nsMsgFilter::~nsMsgFilter()
{
  delete m_expressionTree;
}

NS_IMPL_ISUPPORTS1(nsMsgFilter, nsIMsgFilter)

NS_IMPL_GETSET(nsMsgFilter, FilterType, nsMsgFilterTypeType, m_type)
NS_IMPL_GETSET(nsMsgFilter, Enabled, PRBool, m_enabled)
NS_IMPL_GETSET(nsMsgFilter, Temporary, PRBool, m_temporary)
NS_IMPL_GETSET(nsMsgFilter, Unparseable, PRBool, m_unparseable)

NS_IMETHODIMP nsMsgFilter::GetFilterName(nsAString &name)
{
  name = m_filterName;
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::SetFilterName(const nsAString &name)
{
  m_filterName.Assign(name);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::GetFilterDesc(nsACString &description)
{
  description = m_description;
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::SetFilterDesc(const nsACString &description)
{
  m_description.Assign(description);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::GetUnparsedBuffer(nsACString &unparsedBuffer)
{
  unparsedBuffer = m_unparsedBuffer;
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::SetUnparsedBuffer(const nsACString &unparsedBuffer)
{
  m_unparsedBuffer.Assign(unparsedBuffer);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::AddTerm(
                                   nsMsgSearchAttribValue attrib,    /* attribute for this term          */
                                   nsMsgSearchOpValue op,         /* operator e.g. opContains           */
                                   nsIMsgSearchValue *value,        /* value e.g. "Dogbert"               */
                                  PRBool BooleanAND,       /* PR_TRUE if AND is the boolean operator.
                                                            PR_FALSE if OR is the boolean operators */
                                  const nsACString & arbitraryHeader)  /* arbitrary header specified by user.
                                  ignored unless attrib = attribOtherHeader */
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::AppendTerm(nsIMsgSearchTerm * aTerm)
{
    NS_ENSURE_TRUE(aTerm, NS_ERROR_NULL_POINTER);
    // invalidate expression tree if we're changing the terms
    delete m_expressionTree;
    m_expressionTree = nsnull;
    return m_termList->AppendElement(static_cast<nsISupports*>(aTerm));
}

NS_IMETHODIMP
nsMsgFilter::CreateTerm(nsIMsgSearchTerm **aResult)
{
    nsMsgSearchTerm *term = new nsMsgSearchTerm;
    NS_ENSURE_TRUE(term, NS_ERROR_OUT_OF_MEMORY);

    *aResult = static_cast<nsIMsgSearchTerm*>(term);
    NS_ADDREF(*aResult);
    return NS_OK;
}

NS_IMETHODIMP
nsMsgFilter::CreateAction(nsIMsgRuleAction **aAction)
{
  NS_ENSURE_ARG_POINTER(aAction);
  nsMsgRuleAction *action = new nsMsgRuleAction;
  NS_ENSURE_TRUE(action, NS_ERROR_OUT_OF_MEMORY);

  *aAction = static_cast<nsIMsgRuleAction*>(action);
  NS_ADDREF(*aAction);
  return NS_OK;
}

// All the rules' actions form a unit, with no real order imposed.
// But certain actions like MoveToFolder or StopExecution would make us drop
// consecutive actions, while actions like AddTag implicitly care about the
// order of invocation. Hence we do as little reordering as possible, keeping
// the user-defined order as much as possible.
// We explicitly don't allow for filters which do "tag message as Important,
// copy it to another folder, tag it as To Do also, copy this different state
// elsewhere" in one go. You need to define separate filters for that.
//
// The order of actions returned by this method:
//   index    action(s)
//  -------   ---------
//     0      FetchBodyFromPop3Server
//    1..n    all other 'normal' actions, in their original order
//  n+1..m    CopyToFolder
//    m+1     MoveToFolder or Delete
//    m+2     StopExecution
NS_IMETHODIMP
nsMsgFilter::GetSortedActionList(nsISupportsArray *actionList)
{
  NS_ENSURE_ARG_POINTER(actionList);
  PRUint32 numActions;
  nsresult rv = m_actionList->Count(&numActions);
  NS_ENSURE_SUCCESS(rv, rv);

  // hold separate pointers into the action list
  PRUint32 nextIndexForNormal = 0, nextIndexForCopy = 0, nextIndexForMove = 0;
  for (PRUint32 index = 0; index < numActions; ++index)
  {
    nsCOMPtr<nsIMsgRuleAction> action;
    rv = m_actionList->QueryElementAt(index, NS_GET_IID(nsIMsgRuleAction), (void **)getter_AddRefs(action));
    if (!action)
      continue;

    nsMsgRuleActionType actionType;
    action->GetType(&actionType);
    switch (actionType)
    {
      case nsMsgFilterAction::FetchBodyFromPop3Server:
      {
        // always insert in front
        rv = actionList->InsertElementAt(action, 0);
        NS_ENSURE_SUCCESS(rv, rv);
        ++nextIndexForNormal;
        ++nextIndexForCopy;
        ++nextIndexForMove;
        break;
      }

      case nsMsgFilterAction::CopyToFolder:
      {
        // insert into copy actions block, in order of appearance
        rv = actionList->InsertElementAt(action, nextIndexForCopy);
        NS_ENSURE_SUCCESS(rv, rv);
        ++nextIndexForCopy;
        ++nextIndexForMove;
        break;
      }

      case nsMsgFilterAction::MoveToFolder:
      case nsMsgFilterAction::Delete:
      {
        // insert into move/delete action block
        rv = actionList->InsertElementAt(action, nextIndexForMove);
        NS_ENSURE_SUCCESS(rv, rv);
        ++nextIndexForMove;
        break;
      }

      case nsMsgFilterAction::StopExecution:
      {
        // insert into stop action block
        rv = actionList->AppendElement(action);
        NS_ENSURE_SUCCESS(rv, rv);
        break;
      }

      default:
      {
        // insert into normal action block, in order of appearance
        rv = actionList->InsertElementAt(action, nextIndexForNormal);
        NS_ENSURE_SUCCESS(rv, rv);
        ++nextIndexForNormal;
        ++nextIndexForCopy;
        ++nextIndexForMove;
        break;
      }
    }
  }
  return rv;
}

NS_IMETHODIMP
nsMsgFilter::AppendAction(nsIMsgRuleAction *aAction)
{
  return m_actionList->AppendElement(static_cast<nsISupports*>(aAction));
}

NS_IMETHODIMP
nsMsgFilter::GetActionAt(PRInt32 aIndex, nsIMsgRuleAction **aAction)
{
  NS_ENSURE_ARG_POINTER(aAction);
  return m_actionList->QueryElementAt(aIndex, NS_GET_IID(nsIMsgRuleAction),
                                       (void **) aAction);
}

NS_IMETHODIMP
nsMsgFilter::GetActionList(nsISupportsArray **actionList)
{
  NS_IF_ADDREF(*actionList = m_actionList);
  return NS_OK;
}

NS_IMETHODIMP  //for editing a filter
nsMsgFilter::ClearActionList()
{
  return m_actionList->Clear();
}

NS_IMETHODIMP nsMsgFilter::GetTerm(PRInt32 termIndex,
                                   nsMsgSearchAttribValue *attrib,    /* attribute for this term          */
                                   nsMsgSearchOpValue *op,         /* operator e.g. opContains           */
                                   nsIMsgSearchValue **value,         /* value e.g. "Dogbert"               */
                                   PRBool *booleanAnd, /* PR_TRUE if AND is the boolean operator. PR_FALSE if OR is the boolean operator */
                                   nsACString &arbitraryHeader) /* arbitrary header specified by user.ignore unless attrib = attribOtherHeader */
{
  nsresult rv;
  nsCOMPtr<nsIMsgSearchTerm> term;
  rv = m_termList->QueryElementAt(termIndex, NS_GET_IID(nsIMsgSearchTerm),
                                    (void **)getter_AddRefs(term));
  if (NS_SUCCEEDED(rv) && term)
  {
    if(attrib)
      term->GetAttrib(attrib);
    if(op)
      term->GetOp(op);
    if(value)
      term->GetValue(value);
    if(booleanAnd)
      term->GetBooleanAnd(booleanAnd);
    if (attrib && *attrib > nsMsgSearchAttrib::OtherHeader
        && *attrib < nsMsgSearchAttrib::kNumMsgSearchAttributes)
      term->GetArbitraryHeader(arbitraryHeader);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::GetSearchTerms(nsISupportsArray **aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    // caller can change m_termList, which can invalidate m_expressionTree.
    delete m_expressionTree;
    m_expressionTree = nsnull;
    NS_IF_ADDREF(*aResult = m_termList);
    return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::SetSearchTerms(nsISupportsArray *aSearchList)
{
    delete m_expressionTree;
    m_expressionTree = nsnull;
    m_termList = aSearchList;
    return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::SetScope(nsIMsgSearchScopeTerm *aResult)
{
    m_scope = aResult;
    return NS_OK;
}

NS_IMETHODIMP nsMsgFilter::GetScope(nsIMsgSearchScopeTerm **aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    NS_IF_ADDREF(*aResult = m_scope);
    return NS_OK;
}

#define LOG_ENTRY_START_TAG "<p>\n"
#define LOG_ENTRY_START_TAG_LEN (strlen(LOG_ENTRY_START_TAG))
#define LOG_ENTRY_END_TAG "</p>\n"
#define LOG_ENTRY_END_TAG_LEN (strlen(LOG_ENTRY_END_TAG))

NS_IMETHODIMP nsMsgFilter::LogRuleHit(nsIMsgRuleAction *aFilterAction, nsIMsgDBHdr *aMsgHdr)
{
    NS_ENSURE_TRUE(m_filterList, NS_OK);
    nsCOMPtr <nsIOutputStream> logStream;
    nsresult rv = m_filterList->GetLogStream(getter_AddRefs(logStream));
    NS_ENSURE_SUCCESS(rv,rv);

    PRTime date;
    nsMsgRuleActionType actionType;

    nsString authorValue;
    nsString subjectValue;
    nsString filterName;
    nsString dateValue;

    GetFilterName(filterName);
    aFilterAction->GetType(&actionType);
    (void)aMsgHdr->GetDate(&date);
    PRExplodedTime exploded;
    PR_ExplodeTime(date, PR_LocalTimeParameters, &exploded);

    if (!mDateFormatter)
    {
      mDateFormatter = do_CreateInstance(NS_DATETIMEFORMAT_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      if (!mDateFormatter)
      {
        return NS_ERROR_FAILURE;
      }
    }
    mDateFormatter->FormatPRExplodedTime(nsnull, kDateFormatShort,
                                         kTimeFormatSeconds, &exploded,
                                         dateValue);

    (void)aMsgHdr->GetMime2DecodedAuthor(authorValue);
    (void)aMsgHdr->GetMime2DecodedSubject(subjectValue);

    nsCString buffer;
#ifdef MOZILLA_INTERNAL_API
    // this is big enough to hold a log entry.
    // do this so we avoid growing and copying as we append to the log.
    buffer.SetCapacity(512);
#endif

    nsCOMPtr<nsIStringBundleService> bundleService =
      do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle("chrome://messenger/locale/filter.properties",
      getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv, rv);

    const PRUnichar *filterLogDetectFormatStrings[4] = { filterName.get(), authorValue.get(), subjectValue.get(), dateValue.get() };
    nsString filterLogDetectStr;
    rv = bundle->FormatStringFromName(
      NS_LITERAL_STRING("filterLogDetectStr").get(),
      filterLogDetectFormatStrings, 4,
      getter_Copies(filterLogDetectStr));
    NS_ENSURE_SUCCESS(rv, rv);

    buffer += NS_ConvertUTF16toUTF8(filterLogDetectStr);
    buffer +=  "\n";

    if (actionType == nsMsgFilterAction::MoveToFolder ||
        actionType == nsMsgFilterAction::CopyToFolder)
    {
      nsCString actionFolderUri;
      aFilterAction->GetTargetFolderUri(actionFolderUri);
      NS_ConvertASCIItoUTF16 actionFolderUriValue(actionFolderUri);

      nsCString msgId;
      aMsgHdr->GetMessageId(getter_Copies(msgId));
      NS_ConvertASCIItoUTF16 msgIdValue(msgId);

      const PRUnichar *logMoveFormatStrings[2] = { msgIdValue.get(), actionFolderUriValue.get() };
      nsString logMoveStr;
      rv = bundle->FormatStringFromName(
        (actionType == nsMsgFilterAction::MoveToFolder) ?
          NS_LITERAL_STRING("logMoveStr").get() :
          NS_LITERAL_STRING("logCopyStr").get(),
        logMoveFormatStrings, 2,
        getter_Copies(logMoveStr));
      NS_ENSURE_SUCCESS(rv, rv);

      buffer += NS_ConvertUTF16toUTF8(logMoveStr);
    }
    else if (actionType == nsMsgFilterAction::Custom)
    {
      nsCOMPtr<nsIMsgFilterCustomAction> customAction;
      nsAutoString filterActionName;
      rv = aFilterAction->GetCustomAction(getter_AddRefs(customAction));
      if (NS_SUCCEEDED(rv) && customAction)
        customAction->GetName(filterActionName);
      if (filterActionName.IsEmpty())
        bundle->GetStringFromName(
                  NS_LITERAL_STRING("filterMissingCustomAction").get(),
                  getter_Copies(filterActionName));
      buffer += NS_ConvertUTF16toUTF8(filterActionName);
    }
    else
    {
      nsString actionValue;
      nsAutoString filterActionID;
      filterActionID = NS_LITERAL_STRING("filterAction");
      filterActionID.AppendInt(actionType);
      rv = bundle->GetStringFromName(filterActionID.get(), getter_Copies(actionValue));
      NS_ENSURE_SUCCESS(rv, rv);

      buffer += NS_ConvertUTF16toUTF8(actionValue);
    }
    buffer += "\n";

    PRUint32 writeCount;

    rv = logStream->Write(LOG_ENTRY_START_TAG, LOG_ENTRY_START_TAG_LEN, &writeCount);
    NS_ENSURE_SUCCESS(rv,rv);
    NS_ASSERTION(writeCount == LOG_ENTRY_START_TAG_LEN, "failed to write out start log tag");

    // html escape the log for security reasons.
    // we don't want some to send us a message with a subject with
    // html tags, especially <script>
    char *escapedBuffer = MsgEscapeHTML(buffer.get());
    if (!escapedBuffer)
      return NS_ERROR_OUT_OF_MEMORY;

    PRUint32 escapedBufferLen = strlen(escapedBuffer);
    rv = logStream->Write(escapedBuffer, escapedBufferLen, &writeCount);
    PR_Free(escapedBuffer);
    NS_ENSURE_SUCCESS(rv,rv);
    NS_ASSERTION(writeCount == escapedBufferLen, "failed to write out log hit");

    rv = logStream->Write(LOG_ENTRY_END_TAG, LOG_ENTRY_END_TAG_LEN, &writeCount);
    NS_ENSURE_SUCCESS(rv,rv);
    NS_ASSERTION(writeCount == LOG_ENTRY_END_TAG_LEN, "failed to write out end log tag");
    return NS_OK;
}

NS_IMETHODIMP
nsMsgFilter::MatchHdr(nsIMsgDBHdr *msgHdr, nsIMsgFolder *folder,
                      nsIMsgDatabase *db, const char *headers,
                      PRUint32 headersSize, PRBool *pResult)
{
  NS_ENSURE_ARG_POINTER(folder);
  // use offlineMail because
  nsCString folderCharset;
  folder->GetCharset(folderCharset);
  nsresult rv = nsMsgSearchOfflineMail::MatchTermsForFilter(msgHdr, m_termList,
                  folderCharset.get(),  m_scope,  db,  headers,  headersSize, &m_expressionTree, pResult);
  return rv;
}

void
nsMsgFilter::SetFilterList(nsIMsgFilterList *filterList)
{
  // doesn't hold a ref.
  m_filterList = filterList;
}

nsresult
nsMsgFilter::GetFilterList(nsIMsgFilterList **aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    NS_IF_ADDREF(*aResult = m_filterList);
    return NS_OK;
}

void nsMsgFilter::SetFilterScript(nsCString *fileName)
{
  m_scriptFileName = *fileName;
}

nsresult nsMsgFilter::ConvertMoveOrCopyToFolderValue(nsIMsgRuleAction *filterAction, nsCString &moveValue)
{
  NS_ENSURE_ARG_POINTER(filterAction);
  PRInt16 filterVersion = kFileVersion;
  if (m_filterList)
      m_filterList->GetVersion(&filterVersion);
  if (filterVersion <= k60Beta1Version)
  {
    nsCOMPtr <nsIMsgFolder> rootFolder;
    nsCString folderUri;

    m_filterList->GetFolder(getter_AddRefs(rootFolder));
    // if relative path starts with kImap, this is a move to folder on the same server
    if (moveValue.Find(kImapPrefix) == 0)
    {
      PRInt32 prefixLen = PL_strlen(kImapPrefix);
      nsCAutoString originalServerPath(Substring(moveValue, prefixLen));
      if (filterVersion == k45Version)
      {
        nsAutoString unicodeStr;
        nsresult rv = nsMsgI18NConvertToUnicode(nsMsgI18NFileSystemCharset(),
                                                originalServerPath,
                                                unicodeStr);
        NS_ENSURE_SUCCESS(rv, rv);

        rv = CopyUTF16toMUTF7(unicodeStr, originalServerPath);
        NS_ENSURE_SUCCESS(rv, rv);
      }

      nsCOMPtr <nsIMsgFolder> destIFolder;
      if (rootFolder)
      {
        rootFolder->FindSubFolder(originalServerPath, getter_AddRefs(destIFolder));
        if (destIFolder)
        {
          destIFolder->GetURI(folderUri);
          filterAction->SetTargetFolderUri(folderUri);
          moveValue.Assign(folderUri);
        }
      }
    }
    else
    {
      // start off leaving the value the same.
      filterAction->SetTargetFolderUri(moveValue);
      nsresult rv = NS_OK;
      nsCOMPtr <nsIMsgFolder> localMailRoot;
      rootFolder->GetURI(folderUri);
      // if the root folder is not imap, than the local mail root is the server root.
      // otherwise, it's the migrated local folders.
      if (!StringBeginsWith(folderUri, NS_LITERAL_CSTRING("imap:")))
        localMailRoot = rootFolder;
      else
      {
        nsCOMPtr<nsIMsgAccountManager> accountManager =
                 do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        nsCOMPtr <nsIMsgIncomingServer> server;
        rv = accountManager->GetLocalFoldersServer(getter_AddRefs(server));
        if (NS_SUCCEEDED(rv) && server)
          rv = server->GetRootFolder(getter_AddRefs(localMailRoot));
      }
      if (NS_SUCCEEDED(rv) && localMailRoot)
      {
        nsCString localRootURI;
        nsCOMPtr <nsIMsgFolder> destIMsgFolder;
        nsCOMPtr <nsIMsgFolder> localMailRootMsgFolder = do_QueryInterface(localMailRoot);
        localMailRoot->GetURI(localRootURI);
        nsCString destFolderUri;
        destFolderUri.Assign( localRootURI);
        // need to remove ".sbd" from moveValue, and perhaps escape it.
        PRInt32 offset = moveValue.Find(".sbd/");
        if (offset != -1)
          moveValue.Cut(offset, 4);

#ifdef XP_MACOSX
        nsCString unescapedMoveValue;
        MsgUnescapeString(moveValue, 0, unescapedMoveValue);
        moveValue = unescapedMoveValue;
#endif
        destFolderUri.Append('/');
        if (filterVersion == k45Version)
        {
          nsAutoString unicodeStr;
          rv = nsMsgI18NConvertToUnicode(nsMsgI18NFileSystemCharset(),
                                         moveValue, unicodeStr);
          NS_ENSURE_SUCCESS(rv, rv);
          rv = NS_MsgEscapeEncodeURLPath(unicodeStr, moveValue);
        }
        destFolderUri.Append(moveValue);
        localMailRootMsgFolder->GetChildWithURI (destFolderUri, PR_TRUE, PR_FALSE /*caseInsensitive*/, getter_AddRefs(destIMsgFolder));

        if (destIMsgFolder)
        {
          destIMsgFolder->GetURI(folderUri);
          filterAction->SetTargetFolderUri(folderUri);
          moveValue.Assign(folderUri);
        }
      }
    }
  }
  else
    filterAction->SetTargetFolderUri(moveValue);

  return NS_OK;
  // set m_action.m_value.m_folderUri
}

nsresult nsMsgFilter::SaveToTextFile(nsIOutputStream *aStream)
{
  NS_ENSURE_ARG_POINTER(aStream);
  if (m_unparseable)
  {
    PRUint32 bytesWritten;
    //we need to trim leading whitespaces before filing out
    m_unparsedBuffer.Trim(kWhitespace, PR_TRUE /*leadingCharacters*/, PR_FALSE /*trailingCharacters*/);
    return aStream->Write(m_unparsedBuffer.get(), m_unparsedBuffer.Length(), &bytesWritten);
  }
  nsresult err = m_filterList->WriteWstrAttr(nsIMsgFilterList::attribName, m_filterName.get(), aStream);
  err = m_filterList->WriteBoolAttr(nsIMsgFilterList::attribEnabled, m_enabled, aStream);
  err = m_filterList->WriteStrAttr(nsIMsgFilterList::attribDescription, m_description.get(), aStream);
  err = m_filterList->WriteIntAttr(nsIMsgFilterList::attribType, m_type, aStream);
  if (IsScript())
    err = m_filterList->WriteStrAttr(nsIMsgFilterList::attribScriptFile, m_scriptFileName.get(), aStream);
  else
    err = SaveRule(aStream);
  return err;
}

nsresult nsMsgFilter::SaveRule(nsIOutputStream *aStream)
{
  nsresult err = NS_OK;
  nsCOMPtr<nsIMsgFilterList> filterList;
  GetFilterList(getter_AddRefs(filterList));
  nsCAutoString  actionFilingStr;

  PRUint32 numActions;
  err = m_actionList->Count(&numActions);
  NS_ENSURE_SUCCESS(err, err);

  for (PRUint32 index =0; index < numActions; index++)
  {
    nsCOMPtr<nsIMsgRuleAction> action;
    err = m_actionList->QueryElementAt(index, NS_GET_IID(nsIMsgRuleAction), (void **)getter_AddRefs(action));
    if (!action)
      continue;

    nsMsgRuleActionType actionType;
    action->GetType(&actionType);
    GetActionFilingStr(actionType, actionFilingStr);

    err = filterList->WriteStrAttr(nsIMsgFilterList::attribAction, actionFilingStr.get(), aStream);
    NS_ENSURE_SUCCESS(err, err);

    switch(actionType)
    {
      case nsMsgFilterAction::MoveToFolder:
      case nsMsgFilterAction::CopyToFolder:
      {
        nsCString imapTargetString;
        action->GetTargetFolderUri(imapTargetString);
        err = filterList->WriteStrAttr(nsIMsgFilterList::attribActionValue, imapTargetString.get(), aStream);
      }
      break;
      case nsMsgFilterAction::ChangePriority:
      {
        nsMsgPriorityValue priorityValue;
        action->GetPriority(&priorityValue);
        nsCAutoString priority;
        NS_MsgGetUntranslatedPriorityName(priorityValue, priority);
        err = filterList->WriteStrAttr(
                nsIMsgFilterList::attribActionValue, priority.get(), aStream);
      }
      break;
      case nsMsgFilterAction::Label:
      {
        nsMsgLabelValue label;
        action->GetLabel(&label);
        err = filterList->WriteIntAttr(nsIMsgFilterList::attribActionValue, label, aStream);
      }
      break;
      case nsMsgFilterAction::JunkScore:
      {
        PRInt32 junkScore;
        action->GetJunkScore(&junkScore);
        err = filterList->WriteIntAttr(nsIMsgFilterList::attribActionValue, junkScore, aStream);
      }
      break;
      case nsMsgFilterAction::AddTag:
      case nsMsgFilterAction::Reply:
      case nsMsgFilterAction::Forward:
      {
        nsCString strValue;
        action->GetStrValue(strValue);
        // strValue is e-mail address
        err = filterList->WriteStrAttr(nsIMsgFilterList::attribActionValue, strValue.get(), aStream);
      }
      break;
      case nsMsgFilterAction::Custom:
      {
        nsCAutoString id;
        action->GetCustomId(id);
        err = filterList->WriteStrAttr(nsIMsgFilterList::attribCustomId, id.get(), aStream);
        nsCAutoString strValue;
        action->GetStrValue(strValue);
        if (strValue.Length())
          err = filterList->WriteWstrAttr(nsIMsgFilterList::attribActionValue,
                                          NS_ConvertUTF8toUTF16(strValue).get(),
                                          aStream);
      }
      break;

      default:
        break;
    }
  }
  // and here the fun begins - file out term list...
  nsCAutoString  condition;
  err = MsgTermListToString(m_termList, condition);
  if (NS_SUCCEEDED(err))
    err = filterList->WriteStrAttr(nsIMsgFilterList::attribCondition, condition.get(), aStream);
  return err;
}

// for each action, this table encodes the filterTypes that support the action.
struct RuleActionsTableEntry
{
  nsMsgRuleActionType  action;
  const char*          actionFilingStr;  /* used for filing out filters, don't translate! */
};

static struct RuleActionsTableEntry ruleActionsTable[] =
{
  { nsMsgFilterAction::MoveToFolder,            "Move to folder"},
  { nsMsgFilterAction::CopyToFolder,            "Copy to folder"},
  { nsMsgFilterAction::ChangePriority,          "Change priority"},
  { nsMsgFilterAction::Delete,                  "Delete"},
  { nsMsgFilterAction::MarkRead,                "Mark read"},
  { nsMsgFilterAction::KillThread,              "Ignore thread"},
  { nsMsgFilterAction::KillSubthread,           "Ignore subthread"},
  { nsMsgFilterAction::WatchThread,             "Watch thread"},
  { nsMsgFilterAction::MarkFlagged,             "Mark flagged"},
  { nsMsgFilterAction::Label,                   "Label"},
  { nsMsgFilterAction::Reply,                   "Reply"},
  { nsMsgFilterAction::Forward,                 "Forward"},
  { nsMsgFilterAction::StopExecution,           "Stop execution"},
  { nsMsgFilterAction::DeleteFromPop3Server,    "Delete from Pop3 server"},
  { nsMsgFilterAction::LeaveOnPop3Server,       "Leave on Pop3 server"},
  { nsMsgFilterAction::JunkScore,               "JunkScore"},
  { nsMsgFilterAction::FetchBodyFromPop3Server, "Fetch body from Pop3Server"},
  { nsMsgFilterAction::AddTag,                  "AddTag"},
  { nsMsgFilterAction::Custom,                  "Custom"},
};

const char *nsMsgFilter::GetActionStr(nsMsgRuleActionType action)
{
  int  numActions = sizeof(ruleActionsTable) / sizeof(ruleActionsTable[0]);

  for (int i = 0; i < numActions; i++)
  {
    if (action == ruleActionsTable[i].action)
      return ruleActionsTable[i].actionFilingStr;
  }
  return "";
}
/*static */nsresult nsMsgFilter::GetActionFilingStr(nsMsgRuleActionType action, nsCString &actionStr)
{
  int  numActions = sizeof(ruleActionsTable) / sizeof(ruleActionsTable[0]);

  for (int i = 0; i < numActions; i++)
  {
    if (action == ruleActionsTable[i].action)
    {
      actionStr = ruleActionsTable[i].actionFilingStr;
      return NS_OK;
    }
  }
  return NS_ERROR_INVALID_ARG;
}


nsMsgRuleActionType nsMsgFilter::GetActionForFilingStr(nsCString &actionStr)
{
  int  numActions = sizeof(ruleActionsTable) / sizeof(ruleActionsTable[0]);

  for (int i = 0; i < numActions; i++)
  {
    if (actionStr.Equals(ruleActionsTable[i].actionFilingStr))
      return ruleActionsTable[i].action;
  }
  return nsMsgFilterAction::None;
}

PRInt16
nsMsgFilter::GetVersion()
{
    if (!m_filterList) return 0;
    PRInt16 version;
    m_filterList->GetVersion(&version);
    return version;
}

#ifdef DEBUG
void nsMsgFilter::Dump()
{
  nsCAutoString s;
  LossyCopyUTF16toASCII(m_filterName, s);
  printf("filter %s type = %c desc = %s\n", s.get(), m_type + '0', m_description.get());
}
#endif

