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
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Håkan Waara  <hwaara@chello.se>
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Markus Hossner <markushossner@gmx.de>
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

#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "prlog.h"

#include "msgCore.h"    // precompiled header...
#include "nntpCore.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsNewsFolder.h"
#include "nsMsgFolderFlags.h"
#include "prprf.h"
#include "prsystem.h"
#include "nsIArray.h"
#include "nsIServiceManager.h"
#include "nsIEnumerator.h"
#include "nsINntpService.h"
#include "nsIFolderListener.h"
#include "nsCOMPtr.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsMsgDBCID.h"
#include "nsMsgNewsCID.h"
#include "nsMsgUtils.h"
#include "nsNewsUtils.h"

#include "nsCOMPtr.h"
#include "nsIMsgIncomingServer.h"
#include "nsINntpIncomingServer.h"
#include "nsINewsDatabase.h"
#include "nsMsgBaseCID.h"
#include "nsILineInputStream.h"

#include "nsIMsgWindow.h"
#include "nsIDocShell.h"
#include "nsIPrompt.h"
#include "nsIWindowWatcher.h"

#include "nsNetUtil.h"
#include "nsIAuthPrompt.h"
#include "nsIURL.h"
#include "nsNetCID.h"
#include "nsINntpUrl.h"

#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsArrayEnumerator.h"
#include "nsReadableUtils.h"
#include "nsNewsDownloader.h"
#include "nsIStringBundle.h"
#include "nsEscape.h"
#include "nsMsgI18N.h"
#include "nsNativeCharsetUtils.h"
#include "nsIMsgAccountManager.h"
#include "nsArrayUtils.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsIMutableArray.h"
#include "nsILoginInfo.h"
#include "nsILoginManager.h"
#include "nsIPromptService.h"
#include "nsEmbedCID.h"
#include "nsIDOMWindow.h"

static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);

// ###tw  This really ought to be the most
// efficient file reading size for the current
// operating system.
#define NEWSRC_FILE_BUFFER_SIZE 1024

#define kNewsSortOffset 9000

#define NEWS_SCHEME "news:"
#define SNEWS_SCHEME "snews:"

////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////

nsMsgNewsFolder::nsMsgNewsFolder(void) :
     mExpungedBytes(0), mGettingNews(PR_FALSE),
    mInitialized(PR_FALSE),
    m_downloadMessageForOfflineUse(PR_FALSE), m_downloadingMultipleMessages(PR_FALSE),
    mReadSet(nsnull)
{
  MOZ_COUNT_CTOR(nsNewsFolder); // double count these for now.
}

nsMsgNewsFolder::~nsMsgNewsFolder(void)
{
  MOZ_COUNT_DTOR(nsNewsFolder);
  delete mReadSet;
}

NS_IMPL_ADDREF_INHERITED(nsMsgNewsFolder, nsMsgDBFolder)
NS_IMPL_RELEASE_INHERITED(nsMsgNewsFolder, nsMsgDBFolder)

NS_IMETHODIMP nsMsgNewsFolder::QueryInterface(REFNSIID aIID, void** aInstancePtr)
{
  if (!aInstancePtr)
    return NS_ERROR_NULL_POINTER;
  *aInstancePtr = nsnull;

  if (aIID.Equals(NS_GET_IID(nsIMsgNewsFolder)))
    *aInstancePtr = static_cast<nsIMsgNewsFolder*>(this);
  if(*aInstancePtr)
  {
    AddRef();
    return NS_OK;
  }

  return nsMsgDBFolder::QueryInterface(aIID, aInstancePtr);
}

////////////////////////////////////////////////////////////////////////////////

nsresult
nsMsgNewsFolder::CreateSubFolders(nsILocalFile *path)
{
  nsresult rv;
  PRBool isNewsServer = PR_FALSE;
  rv = GetIsServer(&isNewsServer);
  if (NS_FAILED(rv)) return rv;

  if (isNewsServer)
  {
    nsCOMPtr<nsINntpIncomingServer> nntpServer;
    rv = GetNntpServer(getter_AddRefs(nntpServer));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = nntpServer->GetNewsrcFilePath(getter_AddRefs(mNewsrcFilePath));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = LoadNewsrcFileAndCreateNewsgroups();
  }
  else // is not a host, so it has no newsgroups.  (what about categories??)
    rv = NS_OK;
  return rv;
}

NS_IMETHODIMP
nsMsgNewsFolder::AddNewsgroup(const nsACString &name, const nsACString& setStr,
                              nsIMsgFolder **child)
{
  NS_ENSURE_ARG_POINTER(child);
  nsresult rv;
  nsCOMPtr <nsIRDFService> rdf = do_GetService(kRDFServiceCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;

  nsCAutoString uri(mURI);
  uri.Append('/');
  // URI should use UTF-8
  // (see RFC2396 Uniform Resource Identifiers (URI): Generic Syntax)

  // we are handling newsgroup names in UTF-8
  NS_ConvertUTF8toUTF16 nameUtf16(name);

  nsCAutoString escapedName;
  rv = NS_MsgEscapeEncodeURLPath(nameUtf16, escapedName);
  if (NS_FAILED(rv)) return rv;

  rv = nntpServer->AddNewsgroup(nameUtf16);
  if (NS_FAILED(rv)) return rv;

  uri.Append(escapedName);

  nsCOMPtr<nsIRDFResource> res;
  rv = rdf->GetResource(uri, getter_AddRefs(res));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIMsgFolder> folder(do_QueryInterface(res, &rv));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIMsgNewsFolder> newsFolder(do_QueryInterface(res, &rv));
  if (NS_FAILED(rv)) return rv;

  // cache this for when we open the db
  rv = newsFolder->SetReadSetFromStr(setStr);

  rv = folder->SetParent(this);
  NS_ENSURE_SUCCESS(rv,rv);

  // this what shows up in the UI
  rv = folder->SetName(nameUtf16);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = folder->SetFlag(nsMsgFolderFlags::Newsgroup);
  if (NS_FAILED(rv)) return rv;

  PRInt32 numExistingGroups = mSubFolders.Count();

  // add kNewsSortOffset (9000) to prevent this problem:  1,10,11,2,3,4,5
  // We use 9000 instead of 1000 so newsgroups will sort to bottom of flat folder views
  rv = folder->SetSortOrder(numExistingGroups + kNewsSortOffset);
  NS_ENSURE_SUCCESS(rv,rv);

  mSubFolders.AppendObject(folder);
  folder->SetParent(this);
  folder.swap(*child);
  return rv;
}

nsresult nsMsgNewsFolder::ParseFolder(nsILocalFile *path)
{
  NS_ASSERTION(0,"ParseFolder not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

nsresult
nsMsgNewsFolder::AddDirectorySeparator(nsILocalFile *path)
{
  // don't concat the full separator with .sbd
  return (mURI.Equals(kNewsRootURI)) ?
                  NS_OK :
                  nsMsgDBFolder::AddDirectorySeparator(path);
}


NS_IMETHODIMP
nsMsgNewsFolder::GetSubFolders(nsISimpleEnumerator **aResult)
{
  if (!mInitialized)
  {
    // do this first, so we make sure to do it, even on failure.
    // see bug #70494
    mInitialized = PR_TRUE;

    nsCOMPtr<nsILocalFile> path;
    nsresult rv = GetFilePath(getter_AddRefs(path));
    if (NS_FAILED(rv)) return rv;

    rv = CreateSubFolders(path);
    if (NS_FAILED(rv)) return rv;

    // force ourselves to get initialized from cache
    // Don't care if it fails.  this will fail the first time after
    // migration, but we continue on.  see #66018
    (void)UpdateSummaryTotals(PR_FALSE);
  }

  return aResult ? NS_NewArrayEnumerator(aResult, mSubFolders) : NS_ERROR_NULL_POINTER;
}

//Makes sure the database is open and exists.  If the database is valid then
//returns NS_OK.  Otherwise returns a failure error value.
nsresult nsMsgNewsFolder::GetDatabase()
{
  nsresult rv;
  if (!mDatabase)
  {
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    // Get the database, blowing it away if it's out of date.
    rv = msgDBService->OpenFolderDB(this, PR_FALSE, getter_AddRefs(mDatabase));
    if (NS_FAILED(rv))
      rv = msgDBService->CreateNewDB(this, getter_AddRefs(mDatabase));
    NS_ENSURE_SUCCESS(rv, rv);

    if(mAddListener)
      rv = mDatabase->AddListener(this);

    nsCOMPtr<nsINewsDatabase> db = do_QueryInterface(mDatabase, &rv);
    if (NS_FAILED(rv))
      return rv;

    rv = db->SetReadSet(mReadSet);
    if (NS_FAILED(rv))
      return rv;

    rv = UpdateSummaryTotals(PR_TRUE);
    if (NS_FAILED(rv))
      return rv;
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::UpdateFolder(nsIMsgWindow *aWindow)
{
  // Get news.get_messages_on_select pref
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  PRBool getMessagesOnSelect = PR_TRUE;
  prefBranch->GetBoolPref("news.get_messages_on_select", &getMessagesOnSelect);

  // Only if news.get_messages_on_select is true do we get new messages automatically
  if (getMessagesOnSelect)
  {
    rv = GetDatabase(); // want this cached...
    if (NS_SUCCEEDED(rv))
    {
      if (mDatabase)
      {
        nsCOMPtr<nsIMsgRetentionSettings> retentionSettings;
        nsresult rv = GetRetentionSettings(getter_AddRefs(retentionSettings));
        if (NS_SUCCEEDED(rv))
          rv = mDatabase->ApplyRetentionSettings(retentionSettings, PR_FALSE);
      }
      rv = AutoCompact(aWindow);
      NS_ENSURE_SUCCESS(rv,rv);
      // GetNewMessages has to be the last rv set before we get to the next check, so
      // that we'll have rv set to NS_MSG_ERROR_OFFLINE when offline and send
      // a folder loaded notification to the front end.
      rv = GetNewMessages(aWindow, nsnull);
    }
    if (rv != NS_MSG_ERROR_OFFLINE)
      return rv;
  }
  // We're not getting messages because either get_messages_on_select is
  // false or we're offline. Send an immediate folder loaded notification.
  NotifyFolderEvent(mFolderLoadedAtom);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanSubscribe(PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = PR_FALSE;

  PRBool isNewsServer = PR_FALSE;
  nsresult rv = GetIsServer(&isNewsServer);
  if (NS_FAILED(rv)) return rv;

  // you can only subscribe to news servers, not news groups
  *aResult = isNewsServer;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanFileMessages(PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  // you can't file messages into a news server or news group
  *aResult = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanDeleteMessages(PRBool *aCanDeleteMessages)
{
  NS_ENSURE_ARG_POINTER(aCanDeleteMessages);
  *aCanDeleteMessages = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanCreateSubfolders(PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = PR_FALSE;
  // you can't create subfolders on a news server or a news group
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanRename(PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = PR_FALSE;
  // you can't rename a news server or a news group
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanCompact(PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = PR_FALSE;
  // you can't compact a news server or a news group
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetMessages(nsISimpleEnumerator **result)
{
  nsresult rv = GetDatabase();
  *result = nsnull;

  if(NS_SUCCEEDED(rv))
    rv = mDatabase->EnumerateMessages(result);

  return rv;
}

NS_IMETHODIMP nsMsgNewsFolder::GetFolderURL(nsACString& aUrl)
{
  nsCString hostName;
  nsresult rv = GetHostname(hostName);
  nsString groupName;
  rv = GetName(groupName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 socketType;
  rv = server->GetSocketType(&socketType);
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 port;
  rv = server->GetPort(&port);
  NS_ENSURE_SUCCESS(rv, rv);
  const char *newsScheme = (socketType == nsIMsgIncomingServer::useSSL) ?
                           SNEWS_SCHEME : NEWS_SCHEME;
  nsCString escapedName;
  rv = NS_MsgEscapeEncodeURLPath(groupName, escapedName);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString tmpStr;
  tmpStr.Adopt(PR_smprintf("%s//%s:%ld/%s", newsScheme, hostName.get(), port,
                           escapedName.get()));
  aUrl.Assign(tmpStr);
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetNewsrcHasChanged(PRBool newsrcHasChanged)
{
  nsresult rv;

  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;
  return nntpServer->SetNewsrcHasChanged(newsrcHasChanged);
}

nsresult nsMsgNewsFolder::CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder)
{
  nsMsgNewsFolder *newFolder = new nsMsgNewsFolder;
  if (!newFolder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(*folder = newFolder);
  newFolder->Init(uri.get());
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::CreateSubfolder(const nsAString& newsgroupName,
                                               nsIMsgWindow *msgWindow)
{
  nsresult rv = NS_OK;
  if (newsgroupName.IsEmpty())
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIMsgFolder> child;
  // Create an empty database for this mail folder, set its name from the user
  nsCOMPtr<nsIMsgDatabase> newsDBFactory;
  nsCOMPtr <nsIMsgDatabase> newsDB;

  //Now let's create the actual new folder
  rv = AddNewsgroup(NS_ConvertUTF16toUTF8(newsgroupName), EmptyCString(), getter_AddRefs(child));

  if (NS_SUCCEEDED(rv))
    SetNewsrcHasChanged(PR_TRUE); // subscribe UI does this - but maybe we got here through auto-subscribe

  if(NS_SUCCEEDED(rv) && child){
    nsCOMPtr <nsINntpIncomingServer> nntpServer;
    rv = GetNntpServer(getter_AddRefs(nntpServer));
    if (NS_FAILED(rv)) return rv;

    nsCAutoString dataCharset;
    rv = nntpServer->GetCharset(dataCharset);
    if (NS_FAILED(rv)) return rv;

    child->SetCharset(dataCharset);
    NotifyItemAdded(child);
    nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
    if (notifier)
      notifier->NotifyFolderAdded(child);
  }
  return rv;
}

NS_IMETHODIMP nsMsgNewsFolder::Delete()
{
  nsresult rv = GetDatabase();

  if(NS_SUCCEEDED(rv))
  {
    mDatabase->ForceClosed();
    mDatabase = nsnull;
  }

  nsCOMPtr<nsILocalFile> folderPath;
  rv = GetFilePath(getter_AddRefs(folderPath));

  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsILocalFile> summaryPath;
    rv = GetSummaryFileLocation(folderPath, getter_AddRefs(summaryPath));
    if (NS_SUCCEEDED(rv))
    {
      PRBool exists = PR_FALSE;
      rv = folderPath->Exists(&exists);

      if (NS_SUCCEEDED(rv) && exists)
        rv = folderPath->Remove(PR_FALSE);

      if (NS_FAILED(rv))
        NS_WARNING("Failed to remove News Folder");

      rv = summaryPath->Exists(&exists);

      if (NS_SUCCEEDED(rv) && exists)
        rv = summaryPath->Remove(PR_FALSE);

      if (NS_FAILED(rv))
        NS_WARNING("Failed to remove News Folder Summary File");
    }
  }

  nsCOMPtr <nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;

  nsAutoString name;
  rv = GetUnicodeName(name);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = nntpServer->RemoveNewsgroup(name);
  NS_ENSURE_SUCCESS(rv,rv);

  return SetNewsrcHasChanged(PR_TRUE);
}

NS_IMETHODIMP nsMsgNewsFolder::Rename(const nsAString& newName, nsIMsgWindow *msgWindow)
{
  NS_ASSERTION(0,"Rename not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgNewsFolder::GetAbbreviatedName(nsAString& aAbbreviatedName)
{
  nsresult rv;

  rv = nsMsgDBFolder::GetPrettyName(aAbbreviatedName);
  if(NS_FAILED(rv)) return rv;

  // only do this for newsgroup names, not for newsgroup hosts.
  PRBool isNewsServer = PR_FALSE;
  rv = GetIsServer(&isNewsServer);
  if (NS_FAILED(rv)) return rv;

  if (!isNewsServer) {
    nsCOMPtr<nsINntpIncomingServer> nntpServer;
    rv = GetNntpServer(getter_AddRefs(nntpServer));
    if (NS_FAILED(rv)) return rv;

    PRBool abbreviate = PR_TRUE;
    rv = nntpServer->GetAbbreviate(&abbreviate);
    if (NS_FAILED(rv)) return rv;

    if (abbreviate)
      rv = AbbreviatePrettyName(aAbbreviatedName, 1 /* hardcoded for now */);
  }
  return rv;
}

// original code from Oleg Rekutin
// rekusha@asan.com
// Public domain, created by Oleg Rekutin
//
// takes a newsgroup name, number of words from the end to leave unabberviated
// the newsgroup name, will get reset to the following format:
// x.x.x, where x is the first letter of each word and with the
// exception of last 'fullwords' words, which are left intact.
// If a word has a dash in it, it is abbreviated as a-b, where
// 'a' is the first letter of the part of the word before the
// dash and 'b' is the first letter of the part of the word after
// the dash
nsresult nsMsgNewsFolder::AbbreviatePrettyName(nsAString& prettyName, PRInt32 fullwords)
{
  nsAutoString name(prettyName);
  PRInt32 totalwords = 0; // total no. of words

  // get the total no. of words
  PRInt32 pos = 0;
  while(1)
  {
    pos = name.FindChar('.', pos);
    if(pos == -1)
    {
      totalwords++;
      break;
    }
    else
    {
      totalwords++;
      pos++;
    }
  }

  // get the no. of words to abbreviate
  PRInt32 abbrevnum = totalwords - fullwords;
  if (abbrevnum < 1)
    return NS_OK; // nothing to abbreviate

  // build the ellipsis
  nsAutoString out;
  out += name[0];

  PRInt32 length = name.Length();
  PRInt32 newword = 0;     // == 2 if done with all abbreviated words

  fullwords = 0;
  PRUnichar currentChar;
  for (PRInt32 i = 1; i < length; i++)
  {
    // this temporary assignment is needed to fix an intel mac compiler bug.
    // See Bug #327037 for details.
    currentChar = name[i];
    if (newword < 2) {
      switch (currentChar) {
      case '.':
        fullwords++;
        // check if done with all abbreviated words...
        if (fullwords == abbrevnum)
          newword = 2;
        else
          newword = 1;
        break;
      case '-':
        newword = 1;
        break;
      default:
        if (newword)
          newword = 0;
        else
          continue;
      }
    }
    out.Append(currentChar);
  }
  prettyName = out;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo, nsIMsgDatabase **db)
{
  NS_ENSURE_ARG_POINTER(folderInfo);
  NS_ENSURE_ARG_POINTER(db);
  nsresult openErr;
  openErr = GetDatabase();
  *db = mDatabase;
  if (mDatabase) {
    NS_ADDREF(*db);
    if (NS_SUCCEEDED(openErr))
      openErr = (*db)->GetDBFolderInfo(folderInfo);
  }
  return openErr;
}

/* this used to be MSG_FolderInfoNews::UpdateSummaryFromNNTPInfo() */
NS_IMETHODIMP
nsMsgNewsFolder::UpdateSummaryFromNNTPInfo(PRInt32 oldest, PRInt32 youngest, PRInt32 total)
{
  PRBool newsrcHasChanged = PR_FALSE;

  /* First, mark all of the articles now known to be expired as read. */
  if (oldest > 1)
  {
    nsCString oldSet;
    nsCString newSet;
    mReadSet->Output(getter_Copies(oldSet));
    mReadSet->AddRange(1, oldest - 1);
    mReadSet->Output(getter_Copies(newSet));
    if (!oldSet.Equals(newSet))
      newsrcHasChanged = PR_TRUE;
  }

  /* Now search the newsrc line and figure out how many of these messages are marked as unread. */

  /* make sure youngest is a least 1. MSNews seems to return a youngest of 0. */
  if (youngest == 0)
    youngest = 1;

  PRInt32 unread = mReadSet->CountMissingInRange(oldest, youngest);
  NS_ASSERTION(unread >= 0,"CountMissingInRange reported unread < 0");
  if (unread < 0)
    // servers can send us stuff like "211 0 41 40 nz.netstatus"
    // we should handle it gracefully.
    unread = 0;

  if (unread > total)
  {
    /* This can happen when the newsrc file shows more unread than exist in the group (total is not necessarily `end - start'.) */
    unread = total;
    PRInt32 deltaInDB = mNumTotalMessages - mNumUnreadMessages;
    //PRint32 deltaInDB = m_totalInDB - m_unreadInDB;
    /* if we know there are read messages in the db, subtract that from the unread total */
    if (deltaInDB > 0)
      unread -= deltaInDB;
  }

  PRBool dbWasOpen = mDatabase != nsnull;
  PRInt32 pendingUnreadDelta = unread - mNumUnreadMessages - mNumPendingUnreadMessages;
  PRInt32 pendingTotalDelta = total - mNumTotalMessages - mNumPendingTotalMessages;
  ChangeNumPendingUnread(pendingUnreadDelta);
  ChangeNumPendingTotalMessages(pendingTotalDelta);
  if (!dbWasOpen && mDatabase)
  {
    mDatabase->Commit(nsMsgDBCommitType::kLargeCommit);
    mDatabase->RemoveListener(this);
    mDatabase = nsnull;
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetExpungedBytesCount(PRUint32 *count)
{
  NS_ENSURE_ARG_POINTER(count);
  *count = mExpungedBytes;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetDeletable(PRBool *deletable)
{
  //  NS_ASSERTION(0,"GetDeletable() not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgNewsFolder::GetRequiresCleanup(PRBool *requiresCleanup)
{
  //  NS_ASSERTION(0,"GetRequiresCleanup not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgNewsFolder::GetSizeOnDisk(PRUint32 *size)
{
  //  NS_ASSERTION(0, "GetSizeOnDisk not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* this is news, so remember that DeleteMessage is really CANCEL. */
NS_IMETHODIMP
nsMsgNewsFolder::DeleteMessages(nsIArray *messages, nsIMsgWindow *aMsgWindow,
                                PRBool deleteStorage, PRBool isMove,
                                nsIMsgCopyServiceListener* listener, PRBool allowUndo)
{
  nsresult rv = NS_OK;

  NS_ENSURE_ARG_POINTER(messages);
  NS_ENSURE_ARG_POINTER(aMsgWindow);

  PRUint32 count = 0;
  rv = messages->GetLength(&count);
  NS_ENSURE_SUCCESS(rv, rv);

  if (count != 1)
  {
    nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle(NEWS_MSGS_URL, getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv, rv);

    nsString alertText;
    rv = bundle->GetStringFromName(NS_LITERAL_STRING("onlyCancelOneMessage").get(), getter_Copies(alertText));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIPrompt> dialog;
    rv = aMsgWindow->GetPromptDialog(getter_AddRefs(dialog));
    NS_ENSURE_SUCCESS(rv,rv);

    if (dialog)
    {
      rv = dialog->Alert(nsnull, alertText.get());
      NS_ENSURE_SUCCESS(rv,rv);
    }
    // return failure, since the cancel failed
    return NS_ERROR_FAILURE;
  }

  nsCOMPtr <nsINntpService> nntpService = do_GetService(NS_NNTPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIMsgDBHdr> msgHdr(do_QueryElementAt(messages, 0));

  // for cancel, we need to
  // turn "newsmessage://sspitzer@news.mozilla.org/netscape.test#5428"
  // into "news://sspitzer@news.mozilla.org/23423@netscape.com"

  nsCOMPtr <nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCString serverURI;
  rv = server->GetServerURI(serverURI);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCString messageID;
  rv = msgHdr->GetMessageId(getter_Copies(messageID));
  NS_ENSURE_SUCCESS(rv,rv);

  // we need to escape the message ID,
  // it might contain characters which will mess us up later, like #
  // see bug #120502
  char *escapedMessageID = nsEscape(messageID.get(), url_Path);
  if (!escapedMessageID)
    return NS_ERROR_OUT_OF_MEMORY;

  nsCAutoString cancelURL(serverURI.get());
  cancelURL += '/';
  cancelURL += escapedMessageID;
  cancelURL += "?cancel";

  NS_Free(escapedMessageID);

  nsCString messageURI;
  rv = GetUriForMsg(msgHdr, messageURI);
  NS_ENSURE_SUCCESS(rv,rv);

  return nntpService->CancelMessage(cancelURL.get(), messageURI.get(), nsnull /* consumer */, nsnull, 
                                    aMsgWindow, nsnull);
}

NS_IMETHODIMP nsMsgNewsFolder::GetNewMessages(nsIMsgWindow *aMsgWindow, nsIUrlListener *aListener)
{
  return GetNewsMessages(aMsgWindow, PR_FALSE, aListener);
}

NS_IMETHODIMP nsMsgNewsFolder::GetNextNMessages(nsIMsgWindow *aMsgWindow)
{
  return GetNewsMessages(aMsgWindow, PR_TRUE, nsnull);
}

nsresult nsMsgNewsFolder::GetNewsMessages(nsIMsgWindow *aMsgWindow, PRBool aGetOld, nsIUrlListener *aUrlListener)
{
  nsresult rv = NS_OK;

  PRBool isNewsServer = PR_FALSE;
  rv = GetIsServer(&isNewsServer);
  if (NS_FAILED(rv)) return rv;

  if (isNewsServer)
    // get new messages only works on a newsgroup, not a news server
    return NS_OK;

  nsCOMPtr <nsINntpService> nntpService = do_GetService(NS_NNTPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr <nsIURI> resultUri;
  rv = nntpService->GetNewNews(nntpServer, mURI.get(), aGetOld, this,
                               aMsgWindow, getter_AddRefs(resultUri));
  if (aUrlListener && NS_SUCCEEDED(rv) && resultUri)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> msgUrl (do_QueryInterface(resultUri));
    if (msgUrl)
      msgUrl->RegisterListener(aUrlListener);
  }
  return rv;
}

nsresult
nsMsgNewsFolder::LoadNewsrcFileAndCreateNewsgroups()
{
  nsresult rv = NS_OK;
  if (!mNewsrcFilePath) return NS_ERROR_FAILURE;

  PRBool exists;
  rv = mNewsrcFilePath->Exists(&exists);
  if (NS_FAILED(rv)) return rv;

  if (!exists)
    // it is ok for the newsrc file to not exist yet
    return NS_OK;

  nsCOMPtr<nsIInputStream> fileStream;
  rv = NS_NewLocalFileInputStream(getter_AddRefs(fileStream), mNewsrcFilePath);
  NS_ENSURE_SUCCESS(rv, nsnull);

  nsCOMPtr<nsILineInputStream> lineInputStream(do_QueryInterface(fileStream, &rv));
  NS_ENSURE_SUCCESS(rv, nsnull);

  PRBool more = PR_TRUE;
  nsCString line;

  while (more && NS_SUCCEEDED(rv))
  {
    lineInputStream->ReadLine(line, &more);
    if (line.IsEmpty())
      continue;
    HandleNewsrcLine(line.get(), line.Length());
  }

  fileStream->Close();
  return rv;
}

PRInt32
nsMsgNewsFolder::HandleNewsrcLine(const char * line, PRUint32 line_size)
{
  nsresult rv;

  /* guard against blank line lossage */
  if (line[0] == '#' || line[0] == '\r' || line[0] == '\n') return 0;

  if ((line[0] == 'o' || line[0] == 'O') &&
    !PL_strncasecmp (line, "options", 7))
    return RememberLine(nsDependentCString(line));

  const char *s = nsnull;
  const char *setStr = nsnull;
  const char *end = line + line_size;

  for (s = line; s < end;  s++)
    if ((*s == ':') || (*s == '!'))
      break;

    if (*s == 0)
      /* What is this?? Well, don't just throw it away... */
      return RememberLine(nsDependentCString(line));

    PRBool subscribed = (*s == ':');
    setStr = s+1;

    if (*line == '\0')
      return 0;

  // previous versions of Communicator poluted the
  // newsrc files with articles
  // (this would happen when you clicked on a link like
  // news://news.mozilla.org/3746EF3F.6080309@netscape.com)
  //
  // legal newsgroup names can't contain @ or %
  //
  // News group names are structured into parts separated by dots,
  // for example "netscape.public.mozilla.mail-news".
  // Each part may be up to 14 characters long, and should consist
  // only of letters, digits, "+" and "-", with at least one letter
  //
  // @ indicates an article and %40 is @ escaped.
  // previous versions of Communicator also dumped
  // the escaped version into the newsrc file
  //
  // So lines like this in a newsrc file should be ignored:
  // 3746EF3F.6080309@netscape.com:
  // 3746EF3F.6080309%40netscape.com:
  if (PL_strchr(line, '@') || PL_strstr(line, "%40"))
    // skipping, it contains @ or %40
    subscribed = PR_FALSE;

  if (subscribed)
  {
    // we're subscribed, so add it
    nsCOMPtr <nsIMsgFolder> child;

    rv = AddNewsgroup(nsDependentCSubstring(line, s), nsDependentCString(setStr), getter_AddRefs(child));
    if (NS_FAILED(rv)) return -1;
  }
  else {
    rv = RememberUnsubscribedGroup(nsDependentCString(line), nsDependentCString(setStr));
    if (NS_FAILED(rv)) return -1;
  }

  return 0;
}


nsresult
nsMsgNewsFolder::RememberUnsubscribedGroup(const nsACString& newsgroup, const nsACString& setStr)
{
  mUnsubscribedNewsgroupLines.Append(newsgroup);
  mUnsubscribedNewsgroupLines.AppendLiteral("! ");
  if (!setStr.IsEmpty())
    mUnsubscribedNewsgroupLines.Append(setStr);
  else
    mUnsubscribedNewsgroupLines.Append(MSG_LINEBREAK);
  return NS_OK;
}

PRInt32
nsMsgNewsFolder::RememberLine(const nsACString& line)
{
  mOptionLines = line;
  mOptionLines.Append(MSG_LINEBREAK);
  return 0;
}

nsresult nsMsgNewsFolder::ForgetLine()
{
  mOptionLines.Truncate();
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetGroupUsername(nsACString& aGroupUsername)
{
  aGroupUsername = mGroupUsername;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetGroupUsername(const nsACString& aGroupUsername)
{
  mGroupUsername = aGroupUsername;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetGroupPassword(nsACString& aGroupPassword)
{
  aGroupPassword = mGroupPassword;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetGroupPassword(const nsACString& aGroupPassword)
{
  mGroupPassword = aGroupPassword;
  return NS_OK;
}

nsresult nsMsgNewsFolder::CreateNewsgroupUsernameUrlForSignon(const nsACString& inUriStr, nsACString& result)
{
  return CreateNewsgroupUrlForSignon(inUriStr, "username", result);
}

nsresult nsMsgNewsFolder::CreateNewsgroupPasswordUrlForSignon(const nsACString& inUriStr, nsACString& result)
{
  return CreateNewsgroupUrlForSignon(inUriStr, "password", result);
}

nsresult nsMsgNewsFolder::CreateNewsgroupUrlForSignon(const nsACString& inUriStr, const char *ref, nsACString& result)
{
  nsresult rv;
  nsCOMPtr<nsIURL> url = do_CreateInstance(NS_STANDARDURL_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;

  PRBool singleSignon = PR_TRUE;
  rv = nntpServer->GetSingleSignon(&singleSignon);

  if (singleSignon)
  {
    nsCString serverURI;
    rv = server->GetServerURI(serverURI);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = url->SetSpec(serverURI);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else
  {
    rv = url->SetSpec(inUriStr);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  PRInt32 port = 0;
  rv = url->GetPort(&port);
  NS_ENSURE_SUCCESS(rv, rv);

  if (port <= 0)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv, rv);

    PRInt32 socketType;
    nsresult rv = server->GetSocketType(&socketType);
    NS_ENSURE_SUCCESS(rv, rv);

    // Only set this for ssl newsgroups as for non-ssl connections, we don't
    // need to specify the port as it is the default for the protocol and
    // password manager "blanks" those out.
    if (socketType == nsIMsgIncomingServer::useSSL)
    {
      rv = url->SetPort(nsINntpUrl::DEFAULT_NNTPS_PORT);
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }

  if (ref)
  {
    rv = url->SetRef(nsDependentCString(ref));
    NS_ENSURE_SUCCESS(rv, rv);

    return url->GetSpec(result);
  }

  // If the url doesn't have a path, make sure we don't get a '/' on the end
  // as that will confuse searching in password manager.
  nsCString spec;
  rv = url->GetSpec(spec);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!spec.IsEmpty() && spec[spec.Length() - 1] == '/')
    result = StringHead(spec, spec.Length() - 1);
  else
    result = spec;

  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::ForgetGroupUsername()
{
  nsCString hostname;
  nsresult rv = CreateNewsgroupUrlForSignon(mURI, nsnull, hostname);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString signonURL;
  rv = CreateNewsgroupUsernameUrlForSignon(mURI, signonURL);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILoginManager> loginMgr =
    do_GetService(NS_LOGINMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 count;
  nsILoginInfo** logins;

  // XXX we don't support multiple logins per news server, so just delete any
  // we find.
  rv = loginMgr->FindLogins(&count, NS_ConvertASCIItoUTF16(hostname),
                            EmptyString(),
                            NS_ConvertASCIItoUTF16(signonURL), &logins);
  NS_ENSURE_SUCCESS(rv, rv);

  // There should only be one-login stored for this url, however just in case
  // there isn't.
  for (PRUint32 i = 0; i < count; ++i)
  {
    // If this fails, just continue, we'll still want to remove the password
    // from our local cache.
    loginMgr->RemoveLogin(logins[i]);
  }
  NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);

  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::ForgetGroupPassword()
{
  nsCString hostname;
  nsresult rv = CreateNewsgroupUrlForSignon(mURI, nsnull, hostname);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString signonURL;
  rv = CreateNewsgroupPasswordUrlForSignon(mURI, signonURL);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILoginManager> loginMgr =
    do_GetService(NS_LOGINMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 count;
  nsILoginInfo** logins;

  // XXX we don't support multiple logins per news server, so just delete any
  // we find.
  rv = loginMgr->FindLogins(&count, NS_ConvertASCIItoUTF16(hostname),
                            EmptyString(),
                            NS_ConvertASCIItoUTF16(signonURL), &logins);
  NS_ENSURE_SUCCESS(rv, rv);

  // There should only be one-login stored for this url, however just in case
  // there isn't.
  for (PRUint32 i = 0; i < count; ++i)
  {
    // If this fails, just continue, we'll still want to remove the password
    // from our local cache.
    loginMgr->RemoveLogin(logins[i]);
  }
  NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);

  return SetGroupPassword(EmptyCString());
}

// change order of subfolders (newsgroups)
// aOrientation = -1 ... aNewsgroupToMove aRefNewsgroup ...
// aOrientation =  1 ... aRefNewsgroup aNewsgroupToMove ...
NS_IMETHODIMP nsMsgNewsFolder::MoveFolder(nsIMsgFolder *aNewsgroupToMove, nsIMsgFolder *aRefNewsgroup, PRInt32 aOrientation)
{
  // if folders are identical do nothing
  if (aNewsgroupToMove == aRefNewsgroup)
    return NS_OK;

  nsresult rv = NS_OK;

  // get index for aNewsgroupToMove
  PRInt32 indexNewsgroupToMove = mSubFolders.IndexOf(aNewsgroupToMove);
  if (indexNewsgroupToMove == -1)
    // aNewsgroupToMove is no subfolder of this folder
    return NS_ERROR_INVALID_ARG;

  // get index for aRefNewsgroup
  PRInt32 indexRefNewsgroup = mSubFolders.IndexOf(aRefNewsgroup);
  if (indexRefNewsgroup == -1)
    // aRefNewsgroup is no subfolder of this folder
    return NS_ERROR_INVALID_ARG;

  // set new index for NewsgroupToMove
  PRUint32 indexMin, indexMax;
  if (indexNewsgroupToMove < indexRefNewsgroup)
  {
    if (aOrientation < 0)
      indexRefNewsgroup--;
    indexMin = indexNewsgroupToMove;
    indexMax = indexRefNewsgroup;
  }
  else
  {
    if (aOrientation > 0)
      indexRefNewsgroup++;
    indexMin = indexRefNewsgroup;
    indexMax = indexNewsgroupToMove; 
  }

  // move NewsgroupToMove to new index and set new sort order
  NotifyItemRemoved(aNewsgroupToMove);

  if (indexNewsgroupToMove != indexRefNewsgroup)
  {
    nsCOMPtr<nsIMsgFolder> newsgroup = mSubFolders[indexNewsgroupToMove];

    mSubFolders.RemoveObjectAt(indexNewsgroupToMove);

    // indexRefNewsgroup is already set up correctly.
    mSubFolders.InsertObjectAt(newsgroup, indexRefNewsgroup);
  }
  
  for (PRUint32 i = indexMin; i <= indexMax; i++)
    mSubFolders[i]->SetSortOrder(kNewsSortOffset + i);

  NotifyItemAdded(aNewsgroupToMove);  

  // write changes back to file
  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  NS_ENSURE_SUCCESS(rv,rv);

  rv = nntpServer->SetNewsrcHasChanged(PR_TRUE);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = nntpServer->WriteNewsrcFile();
  NS_ENSURE_SUCCESS(rv,rv);

  return rv;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetGroupPasswordWithUI(const nsAString& aPromptMessage,
                                        const nsAString& aPromptTitle,
                                        nsIMsgWindow* aMsgWindow,
                                        nsACString& aGroupPassword)
{
  nsresult rv;

  if (mGroupPassword.IsEmpty())
  {
    // prompt the user for the password
    nsCOMPtr<nsIAuthPrompt> dialog;
    if (aMsgWindow)
    {
      nsCOMPtr<nsIDocShell> docShell;
      rv = aMsgWindow->GetRootDocShell(getter_AddRefs(docShell));
      if (NS_FAILED(rv)) return rv;
      dialog = do_GetInterface(docShell, &rv);
      if (NS_FAILED(rv)) return rv;
    }
    else
    {
      nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID));
      if (wwatch)
        wwatch->GetNewAuthPrompter(0, getter_AddRefs(dialog));
      if (!dialog) return NS_ERROR_FAILURE;
    }

    NS_ASSERTION(dialog,"we didn't get a net prompt");
    if (dialog)
    {
      PRBool okayValue = PR_TRUE;

      nsCString signonURL;
      rv = CreateNewsgroupPasswordUrlForSignon(mURI, signonURL);
      if (NS_FAILED(rv)) return rv;

      PRUnichar *uniGroupPassword = nsnull;
      if (!mPrevPassword.IsEmpty())
        uniGroupPassword = ToNewUnicode(NS_ConvertASCIItoUTF16(mPrevPassword));

      rv = dialog->PromptPassword(nsString(aPromptTitle).get(), nsString(aPromptMessage).get(),
                                  NS_ConvertASCIItoUTF16(signonURL).get(),
                                  nsIAuthPrompt::SAVE_PASSWORD_PERMANENTLY,
                                  &uniGroupPassword, &okayValue);
      nsAutoString uniPasswordAdopted;
      uniPasswordAdopted.Adopt(uniGroupPassword);
      if (NS_FAILED(rv)) return rv;

      if (!okayValue) // if the user pressed cancel, just return NULL;
      {
        aGroupPassword.Truncate();
        return rv;
      }

      // we got a password back...so remember it
      rv = SetGroupPassword(NS_LossyConvertUTF16toASCII(uniPasswordAdopted));
      if (NS_FAILED(rv)) return rv;

    } // if we got a prompt dialog
  } // if the password is empty

  return GetGroupPassword(aGroupPassword);
}

NS_IMETHODIMP
nsMsgNewsFolder::GetGroupUsernameWithUI(const nsAString& aPromptMessage,
                                        const nsAString& aPromptTitle,
                                        nsIMsgWindow* aMsgWindow,
                                        nsACString& aGroupUsername)
{
  nsresult rv;

  if (mGroupUsername.IsEmpty())
  {
    // prompt the user for the username
    nsCOMPtr<nsIAuthPrompt> dialog;
    if (aMsgWindow)
    {
      // prompt the user for the password
      nsCOMPtr<nsIDocShell> docShell;
      rv = aMsgWindow->GetRootDocShell(getter_AddRefs(docShell));
      if (NS_FAILED(rv)) return rv;
      dialog = do_GetInterface(docShell, &rv);
    }
    else
    {
      nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID));
      if (wwatch)
        wwatch->GetNewAuthPrompter(0, getter_AddRefs(dialog));
    }
    
    NS_ENSURE_TRUE(dialog, NS_ERROR_FAILURE);

    nsString uniGroupUsername;
    PRBool okayValue = PR_TRUE;

    nsCString signonURL;
    rv = CreateNewsgroupUsernameUrlForSignon(mURI, signonURL);
    if (NS_FAILED(rv))
      return rv;

    // This is the hostname without the #username or #password on the end.
    nsCString hostnameURL;
    rv = CreateNewsgroupUrlForSignon(mURI, nsnull, hostnameURL);
    NS_ENSURE_SUCCESS(rv, rv);

    // Due to the way the new login manager doesn't want to let us save
    // usernames in the password field, unfortunately the way mailnews has
    // worked historically, means we need to do this.
    // So we have to first check manully, then prompt, the save separately if
    // we want to get a value.
    nsCOMPtr<nsILoginManager> loginMgr =
      do_GetService(NS_LOGINMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    PRUint32 count = 0;
    nsILoginInfo **logins = nsnull;
    rv = loginMgr->FindLogins(&count, NS_ConvertASCIItoUTF16(hostnameURL),
                              EmptyString(), NS_ConvertASCIItoUTF16(signonURL), &logins);
    NS_ENSURE_SUCCESS(rv, rv);

    if (count > 0)
    {
      nsString username;
      rv = logins[0]->GetPassword(username);

      NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);

      NS_ENSURE_SUCCESS(rv, rv);

      NS_LossyConvertUTF16toASCII result(username);

      // Just use the first as that is all we should have
      rv = SetGroupUsername(result);
      if (NS_FAILED(rv))
        return rv;

      mPrevUsername = aGroupUsername = result;
      return NS_OK;
    }
    NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);


    // No logins, so time to prompt. Toolkit password manager doesn't let us
    // use nsIAuthPrompt.prompt in the way we'd like currently, and it doesn't
    // let us store username-only passwords. So go direct to the dialog and
    // cut out the middle-man.
    nsCOMPtr<nsIPromptService> promptSvc =
      do_GetService(NS_PROMPTSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    PRBool saveUsername = PR_FALSE;

    nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle(NEWS_MSGS_URL, getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv, rv);

    nsString saveUsernameText;
    rv = bundle->GetStringFromName(NS_LITERAL_STRING("saveUsername").get(),
                                   getter_Copies(saveUsernameText));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = promptSvc->Prompt(nsnull, nsString(aPromptTitle).get(),
                           nsString(aPromptMessage).get(),
                           getter_Copies(uniGroupUsername),
                           saveUsernameText.get(), &saveUsername,
                           &okayValue);
    NS_ENSURE_SUCCESS(rv, rv);

    if (!okayValue) // if the user pressed cancel, just return NULL;
    {
      aGroupUsername.Truncate();
      return rv;
    }

    if (saveUsername)
    {
      nsCOMPtr<nsILoginInfo> login =
        do_CreateInstance("@mozilla.org/login-manager/loginInfo;1", &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = login->SetHostname(NS_ConvertASCIItoUTF16(hostnameURL));
      NS_ENSURE_SUCCESS(rv, rv);

      rv = login->SetHttpRealm(NS_ConvertASCIItoUTF16(signonURL));
      NS_ENSURE_SUCCESS(rv, rv);

      rv = login->SetPassword(uniGroupUsername);
      NS_ENSURE_SUCCESS(rv, rv);

      // Apparently there is a small difference between empty strings and null
      // strings, but setting these to empty works for us.
      rv = login->SetUsername(EmptyString());
      NS_ENSURE_SUCCESS(rv, rv);

      rv = login->SetUsernameField(EmptyString());
      NS_ENSURE_SUCCESS(rv, rv);

      rv = login->SetPasswordField(EmptyString());
      NS_ENSURE_SUCCESS(rv, rv);

      rv = loginMgr->AddLogin(login);
      NS_ENSURE_SUCCESS(rv, rv);
    }

    // we got a username back, remember it
    rv = SetGroupUsername(NS_LossyConvertUTF16toASCII(uniGroupUsername));
    if (NS_FAILED(rv)) return rv;

  } // if the password is empty

  rv = GetGroupUsername(aGroupUsername);
  mPrevUsername = aGroupUsername;
  return rv;
}

nsresult nsMsgNewsFolder::CreateBaseMessageURI(const nsACString& aURI)
{
  return nsCreateNewsBaseMessageURI(nsCString(aURI).get(), mBaseMessageURI);
}

NS_IMETHODIMP
nsMsgNewsFolder::GetNewsrcLine(nsACString& newsrcLine)
{
  nsresult rv;
  nsString newsgroupNameUtf16;
  rv = GetName(newsgroupNameUtf16);
  if (NS_FAILED(rv)) return rv;
  NS_ConvertUTF16toUTF8 newsgroupName(newsgroupNameUtf16);

  newsrcLine = newsgroupName;
  newsrcLine.Append(':');

  if (mReadSet) {
    nsCString setStr;
    mReadSet->Output(getter_Copies(setStr));
    if (NS_SUCCEEDED(rv))
    {
      newsrcLine.Append(' ');
      newsrcLine.Append(setStr);
      newsrcLine.AppendLiteral(MSG_LINEBREAK);
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetReadSetFromStr(const nsACString& newsrcLine)
{
  delete mReadSet;
  mReadSet = nsMsgKeySet::Create(nsCString(newsrcLine).get());
  NS_ENSURE_TRUE(mReadSet, NS_ERROR_OUT_OF_MEMORY);

  // Now that mReadSet is recreated, make sure it's stored in the db as well.
  nsCOMPtr<nsINewsDatabase> db = do_QueryInterface(mDatabase);
  if (db) // it's ok not to have a db here.
    db->SetReadSet(mReadSet);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetUnsubscribedNewsgroupLines(nsACString& aUnsubscribedNewsgroupLines)
{
  aUnsubscribedNewsgroupLines = mUnsubscribedNewsgroupLines;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetOptionLines(nsACString& optionLines)
{
  optionLines = mOptionLines;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::OnReadChanged(nsIDBChangeListener * aInstigator)
{
  return SetNewsrcHasChanged(PR_TRUE);
}

NS_IMETHODIMP
nsMsgNewsFolder::GetUnicodeName(nsAString& aName)
{
  return GetName(aName);
}

NS_IMETHODIMP
nsMsgNewsFolder::GetRawName(nsACString & aRawName)
{
  nsresult rv;
  if (mRawName.IsEmpty())
  {
    nsString name;
    rv = GetName(name);
    NS_ENSURE_SUCCESS(rv,rv);

    // convert to the server-side encoding
    nsCOMPtr <nsINntpIncomingServer> nntpServer;
    rv = GetNntpServer(getter_AddRefs(nntpServer));
    NS_ENSURE_SUCCESS(rv,rv);

    nsCAutoString dataCharset;
    rv = nntpServer->GetCharset(dataCharset);
    NS_ENSURE_SUCCESS(rv,rv);
    rv = nsMsgI18NConvertFromUnicode(dataCharset.get(), name, mRawName);

    if (NS_FAILED(rv))
      LossyCopyUTF16toASCII(name, mRawName);
  }
  aRawName = mRawName;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetNntpServer(nsINntpIncomingServer **result)
{
  nsresult rv;
  NS_ENSURE_ARG_POINTER(result);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = server->QueryInterface(NS_GET_IID(nsINntpIncomingServer),
                              getter_AddRefs(nntpServer));
  if (NS_FAILED(rv))
    return rv;
  nntpServer.swap(*result);
  return NS_OK;
}

// this gets called after the message actually gets cancelled
// it removes the cancelled message from the db
NS_IMETHODIMP nsMsgNewsFolder::RemoveMessage(nsMsgKey key)
{
  nsresult rv = GetDatabase();
  NS_ENSURE_SUCCESS(rv, rv); // if GetDatabase succeeds, mDatabase will be non-null

  // Notify listeners of a delete for a single message
  nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
  if (notifier)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    rv = mDatabase->GetMsgHdrForKey(key, getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMutableArray> msgHdrs(do_CreateInstance(NS_ARRAY_CONTRACTID));
    msgHdrs->AppendElement(msgHdr, PR_FALSE);

    notifier->NotifyMsgsDeleted(msgHdrs);
  }
  return mDatabase->DeleteMessage(key, nsnull, PR_FALSE);
}

NS_IMETHODIMP nsMsgNewsFolder::RemoveMessages(nsTArray<nsMsgKey> &aMsgKeys)
{
  nsresult rv = GetDatabase();
  NS_ENSURE_SUCCESS(rv, rv); // if GetDatabase succeeds, mDatabase will be non-null
  
  // Notify listeners of a multiple message delete
  nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));

  if (notifier)
  {
    nsCOMPtr<nsIMutableArray> msgHdrs(do_CreateInstance(NS_ARRAY_CONTRACTID));
    rv = MsgGetHeadersFromKeys(mDatabase, aMsgKeys, msgHdrs);
    NS_ENSURE_SUCCESS(rv, rv);

    notifier->NotifyMsgsDeleted(msgHdrs);
  }

  return mDatabase->DeleteMessages(&aMsgKeys, nsnull);
}

NS_IMETHODIMP nsMsgNewsFolder::CancelComplete()
{
  NotifyFolderEvent(mDeleteOrMoveMsgCompletedAtom);
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::CancelFailed()
{
  NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetSaveArticleOffline(PRBool *aBool)
{
  NS_ENSURE_ARG(aBool);
  *aBool = m_downloadMessageForOfflineUse;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetSaveArticleOffline(PRBool aBool)
{
  m_downloadMessageForOfflineUse = aBool;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::DownloadAllForOffline(nsIUrlListener *listener, nsIMsgWindow *msgWindow)
{
  nsTArray<nsMsgKey> srcKeyArray;
  SetSaveArticleOffline(PR_TRUE);
  nsresult rv;

  // build up message keys.
  if (mDatabase)
  {
    nsCOMPtr <nsISimpleEnumerator> enumerator;
    rv = mDatabase->EnumerateMessages(getter_AddRefs(enumerator));
    if (NS_SUCCEEDED(rv) && enumerator)
    {
      PRBool hasMore;
      while (NS_SUCCEEDED(rv = enumerator->HasMoreElements(&hasMore)) && hasMore)
      {
        nsCOMPtr <nsIMsgDBHdr> pHeader;
        rv = enumerator->GetNext(getter_AddRefs(pHeader));
        NS_ASSERTION(NS_SUCCEEDED(rv), "nsMsgDBEnumerator broken");
        if (pHeader && NS_SUCCEEDED(rv))
        {
          PRBool shouldStoreMsgOffline = PR_FALSE;
          nsMsgKey msgKey;
          pHeader->GetMessageKey(&msgKey);
          MsgFitsDownloadCriteria(msgKey, &shouldStoreMsgOffline);
          if (shouldStoreMsgOffline)
            srcKeyArray.AppendElement(msgKey);
        }
      }
    }
  }
  DownloadNewsArticlesToOfflineStore *downloadState = new DownloadNewsArticlesToOfflineStore(msgWindow, mDatabase, this);
  if (!downloadState)
    return NS_ERROR_OUT_OF_MEMORY;
  m_downloadingMultipleMessages = PR_TRUE;
  return downloadState->DownloadArticles(msgWindow, this, &srcKeyArray);
}

NS_IMETHODIMP nsMsgNewsFolder::DownloadMessagesForOffline(nsIArray *messages, nsIMsgWindow *window)
{
  nsTArray<nsMsgKey> srcKeyArray;
  SetSaveArticleOffline(PR_TRUE); // ### TODO need to clear this when we've finished
  PRUint32 count = 0;
  PRUint32 i;
  nsresult rv = messages->GetLength(&count);
  NS_ENSURE_SUCCESS(rv, rv);

  // build up message keys.
  for (i = 0; i < count; i++)
  {
    nsMsgKey key;
    nsCOMPtr <nsIMsgDBHdr> msgDBHdr = do_QueryElementAt(messages, i, &rv);
    if (msgDBHdr)
      rv = msgDBHdr->GetMessageKey(&key);
    if (NS_SUCCEEDED(rv))
      srcKeyArray.AppendElement(key);
  }
  DownloadNewsArticlesToOfflineStore *downloadState = new DownloadNewsArticlesToOfflineStore(window, mDatabase, this);
  if (!downloadState)
    return NS_ERROR_OUT_OF_MEMORY;
  m_downloadingMultipleMessages = PR_TRUE;
  return downloadState->DownloadArticles(window, this, &srcKeyArray);
}

// line does not have a line terminator (e.g., CR or CRLF)
NS_IMETHODIMP nsMsgNewsFolder::NotifyDownloadedLine(const char *line, nsMsgKey keyOfArticle)
{
  nsresult rv = NS_OK;
  if (m_downloadMessageForOfflineUse)
  {
    if (!m_offlineHeader)
    {
      GetMessageHeader(keyOfArticle, getter_AddRefs(m_offlineHeader));
      rv = StartNewOfflineMessage();
    }
    m_numOfflineMsgLines++;
  }

  if (m_tempMessageStream)
  {
    // line now contains the linebreak.
    if (line[0] == '.' && line[MSG_LINEBREAK_LEN + 1] == 0)
    {
      // end of article.
      if (m_offlineHeader)
        EndNewOfflineMessage();

      if (m_tempMessageStream && !m_downloadingMultipleMessages)
      {
        m_tempMessageStream->Close();
        m_tempMessageStream = nsnull;
      }
    }
    else
    {
      PRUint32 count = 0;
      rv = m_tempMessageStream->Write(line, strlen(line), &count);
    }
  }

  return rv;
}

NS_IMETHODIMP nsMsgNewsFolder::NotifyFinishedDownloadinghdrs()
{
  ChangeNumPendingTotalMessages(-GetNumPendingTotalMessages());
  ChangeNumPendingUnread(-GetNumPendingUnread());
  PRBool filtersRun;
  // run the bayesian spam filters, if enabled.
  CallFilterPlugins(nsnull, &filtersRun);

  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::Compact(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow)
{
  nsresult rv;
  rv = GetDatabase();
  if (mDatabase)
    ApplyRetentionSettings();
  return rv;
}

NS_IMETHODIMP
nsMsgNewsFolder::ApplyRetentionSettings()
{
  return nsMsgDBFolder::ApplyRetentionSettings(PR_FALSE);
}

NS_IMETHODIMP nsMsgNewsFolder::GetMessageIdForKey(nsMsgKey key, nsACString& result)
{
  nsresult rv = GetDatabase();
  if (!mDatabase)
    return rv;
  nsCOMPtr <nsIMsgDBHdr> hdr;
  rv = mDatabase->GetMsgHdrForKey(key, getter_AddRefs(hdr));
  NS_ENSURE_SUCCESS(rv,rv);
  return hdr->GetMessageId(getter_Copies(result));
}

NS_IMETHODIMP nsMsgNewsFolder::SetSortOrder(PRInt32 order)
{
  PRInt32 oldOrder = mSortOrder;
  
  mSortOrder = order;
  nsCOMPtr<nsIAtom> sortOrderAtom = do_GetAtom("SortOrder");
  // What to do if the atom can't be allocated?
  NotifyIntPropertyChanged(sortOrderAtom, oldOrder, order);
  
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetSortOrder(PRInt32 *order)
{
  NS_ENSURE_ARG_POINTER(order);
  *order = mSortOrder;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::Shutdown(PRBool shutdownChildren)
{
  if (mFilterList)
  {
    // close the filter log stream
    nsresult rv = mFilterList->SetLogStream(nsnull);
    NS_ENSURE_SUCCESS(rv,rv);
    mFilterList = nsnull;
  }

  mInitialized = PR_FALSE;
  if (mReadSet) {
    // the nsINewsDatabase holds a weak ref to the readset,
    // and we outlive the db, so it's safe to delete it here.
    nsCOMPtr<nsINewsDatabase> db = do_QueryInterface(mDatabase);
    if (db)
      db->SetReadSet(nsnull);
    delete mReadSet;
    mReadSet = nsnull;
  }
  return nsMsgDBFolder::Shutdown(shutdownChildren);
}

NS_IMETHODIMP
nsMsgNewsFolder::SetFilterList(nsIMsgFilterList *aFilterList)
{
  if (mIsServer)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    nsresult rv = GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv,rv);
    return server->SetFilterList(aFilterList);
  }

  mFilterList = aFilterList;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetFilterList(nsIMsgWindow *aMsgWindow, nsIMsgFilterList **aResult)
{
  if (mIsServer)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    nsresult rv = GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv,rv);
    return server->GetFilterList(aMsgWindow, aResult);
  }

  if (!mFilterList)
  {
    nsCOMPtr<nsILocalFile> thisFolder;
    nsresult rv = GetFilePath(getter_AddRefs(thisFolder));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr <nsILocalFile> filterFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);;
    rv = filterFile->InitWithFile(thisFolder);
    NS_ENSURE_SUCCESS(rv, rv);

    // in 4.x, the news filter file was
    // C:\Program Files\Netscape\Users\meer\News\host-news.mcom.com\mcom.test.dat
    // where the summary file was
    // C:\Program Files\Netscape\Users\meer\News\host-news.mcom.com\mcom.test.snm
    // we make the rules file ".dat" in mozilla, so that migration works.

    // NOTE:
    // we don't we need to call NS_MsgHashIfNecessary()
    // it's already been hashed, if necessary
    nsCString filterFileName;
    rv = filterFile->GetNativeLeafName(filterFileName);
    NS_ENSURE_SUCCESS(rv,rv);

    filterFileName.AppendLiteral(".dat");

    rv = filterFile->SetNativeLeafName(filterFileName);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsIMsgFilterService> filterService =
      do_GetService(NS_MSGFILTERSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = filterService->OpenFilterList(filterFile, this, aMsgWindow, getter_AddRefs(mFilterList));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  NS_IF_ADDREF(*aResult = mFilterList);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetEditableFilterList(nsIMsgWindow *aMsgWindow, nsIMsgFilterList **aResult)
{
  // We don't support pluggable filter list types for news.
  return GetFilterList(aMsgWindow, aResult);
}

NS_IMETHODIMP
nsMsgNewsFolder::SetEditableFilterList(nsIMsgFilterList *aFilterList)
{
  return SetFilterList(aFilterList);
}

NS_IMETHODIMP
nsMsgNewsFolder::OnStopRunningUrl(nsIURI *aUrl, nsresult aExitCode)
{
 if (m_tempMessageStream)
  {
    m_tempMessageStream->Close();
    m_tempMessageStream = nsnull;
  }
  m_downloadingMultipleMessages = PR_FALSE;
  return nsMsgDBFolder::OnStopRunningUrl(aUrl, aExitCode);
}
