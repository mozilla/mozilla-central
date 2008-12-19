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
 *   jefft@netscape.com
 *   putterman@netscape.com
 *   bienvenu@nventure.com
 *   warren@netscape.com
 *   alecf@netscape.com
 *   sspitzer@netscape.com
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Howard Chu <hyc@highlandsun.com>
 *   William Bonnet <wbonnet@on-x.com>
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

#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "prlog.h"

#include "msgCore.h"    // precompiled header...
#include "nsArrayEnumerator.h"
#include "nsLocalMailFolder.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsMsgFolderFlags.h"
#include "nsMsgMessageFlags.h"
#include "prprf.h"
#include "nsISupportsArray.h"
#include "nsIArray.h"
#include "nsIServiceManager.h"
#include "nsIEnumerator.h"
#include "nsIMailboxService.h"
#include "nsParseMailbox.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgWindow.h"
#include "nsCOMPtr.h"
#include "nsIRDFService.h"
#include "nsMsgDBCID.h"
#include "nsMsgUtils.h"
#include "nsLocalUtils.h"
#include "nsIPop3IncomingServer.h"
#include "nsILocalMailIncomingServer.h"
#include "nsIMsgIncomingServer.h"
#include "nsMsgBaseCID.h"
#include "nsMsgLocalCID.h"
#include "nsString.h"
#include "nsIMsgFolderCacheElement.h"
#include "nsReadableUtils.h"
#include "nsUnicharUtils.h"
#include "nsMsgUtils.h"
#include "nsICopyMsgStreamListener.h"
#include "nsIMsgCopyService.h"
#include "nsMsgTxn.h"
#include "nsIMessenger.h"
#include "nsMsgBaseCID.h"
#include "nsNativeCharsetUtils.h"
#include "nsIDocShell.h"
#include "nsIPrompt.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIPop3URL.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgFolderCompactor.h"
#include "nsNetCID.h"
#include "nsEscape.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsISpamSettings.h"
#include "nsINoIncomingServer.h"
#include "nsNativeCharsetUtils.h"
#include "nsMailHeaders.h"
#include "nsCOMArray.h"
#include "nsILineInputStream.h"
#include "nsIFileStreams.h"
#include "nsAutoPtr.h"
#include "nsIRssIncomingServer.h"
#include "nsNetUtil.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsReadLine.h"
#include "nsLocalStrings.h"
#include "nsArrayUtils.h"
#include "nsIMsgTraitService.h"

static NS_DEFINE_CID(kMailboxServiceCID,          NS_MAILBOXSERVICE_CID);

//////////////////////////////////////////////////////////////////////////////
// nsLocal
/////////////////////////////////////////////////////////////////////////////

nsLocalMailCopyState::nsLocalMailCopyState() :
  m_curDstKey(0xffffffff), m_curCopyIndex(0),
  m_totalMsgCount(0), m_dataBufferSize(0), m_leftOver(0),
  m_isMove(PR_FALSE), m_dummyEnvelopeNeeded(PR_FALSE), m_fromLineSeen(PR_FALSE), m_writeFailed(PR_FALSE),
  m_notifyFolderLoaded(PR_FALSE)
{
  LL_I2L(m_lastProgressTime, PR_IntervalToMilliseconds(PR_IntervalNow()));
}

nsLocalMailCopyState::~nsLocalMailCopyState()
{
  PR_Free(m_dataBuffer);
  if (m_fileStream)
    m_fileStream->Close();
  if (m_messageService)
  {
    nsCOMPtr <nsIMsgFolder> srcFolder = do_QueryInterface(m_srcSupport);
    if (srcFolder && m_message)
    {
      nsCString uri;
      srcFolder->GetUriForMsg(m_message, uri);
    }
  }
}

nsLocalFolderScanState::nsLocalFolderScanState() : m_uidl(nsnull)
{
}

nsLocalFolderScanState::~nsLocalFolderScanState()
{
}

///////////////////////////////////////////////////////////////////////////////
// nsMsgLocalMailFolder interface
///////////////////////////////////////////////////////////////////////////////

nsMsgLocalMailFolder::nsMsgLocalMailFolder(void)
  : mCopyState(nsnull), mHaveReadNameFromDB(PR_FALSE),
    mInitialized(PR_FALSE),
    mCheckForNewMessagesAfterParsing(PR_FALSE), m_parsingFolder(PR_FALSE),
    mNumFilterClassifyRequests(0), mDownloadState(DOWNLOAD_STATE_NONE)
{
}

nsMsgLocalMailFolder::~nsMsgLocalMailFolder(void)
{
}

NS_IMPL_ISUPPORTS_INHERITED4(nsMsgLocalMailFolder,
                             nsMsgDBFolder,
                             nsICopyMessageListener,
                             nsIMsgLocalMailFolder,
                             nsIJunkMailClassificationListener,
                             nsIMsgTraitClassificationListener)

////////////////////////////////////////////////////////////////////////////////

static PRBool
nsStringEndsWith(nsString& name, const char *ending)
{
  PRInt32 len = name.Length();
  if (len == 0) return PR_FALSE;

  PRInt32 endingLen = strlen(ending);
  return (len > endingLen && name.RFind(ending, PR_TRUE) == len - endingLen);
}

static PRBool
nsShouldIgnoreFile(nsString& name)
{
  PRUnichar firstChar=name.CharAt(0);
  if (firstChar == '.' || firstChar == '#' || name.CharAt(name.Length() - 1) == '~')
    return PR_TRUE;

  if (name.LowerCaseEqualsLiteral("msgfilterrules.dat") ||
      name.LowerCaseEqualsLiteral("rules.dat") ||
      name.LowerCaseEqualsLiteral("filterlog.html") ||
      name.LowerCaseEqualsLiteral("junklog.html") ||
      name.LowerCaseEqualsLiteral("rulesbackup.dat"))
    return PR_TRUE;


  // don't add summary files to the list of folders;
  // don't add popstate files to the list either, or rules (sort.dat).
  if (nsStringEndsWith(name, ".snm") ||
      name.LowerCaseEqualsLiteral("popstate.dat") ||
      name.LowerCaseEqualsLiteral("sort.dat") ||
      name.LowerCaseEqualsLiteral("mailfilt.log") ||
      name.LowerCaseEqualsLiteral("filters.js") ||
      nsStringEndsWith(name, ".toc"))
    return PR_TRUE;

  // ignore RSS data source files
  if (name.LowerCaseEqualsLiteral("feeds.rdf") ||
      name.LowerCaseEqualsLiteral("feeditems.rdf"))
    return PR_TRUE;

  // The .mozmsgs dir is for spotlight support
    return (nsStringEndsWith(name, ".mozmsgs") || nsStringEndsWith(name,".sbd") ||
            nsStringEndsWith(name,SUMMARY_SUFFIX));
}

NS_IMETHODIMP
nsMsgLocalMailFolder::Init(const char* aURI)
{
  return nsMsgDBFolder::Init(aURI);
}

nsresult
nsMsgLocalMailFolder::CreateSubFolders(nsIFile *path)
{
  // first find out all the current subfolders and files, before using them while
  // creating new subfolders; we don't want to modify and iterate the same
  // directory at once.
  nsCOMArray<nsIFile> currentDirEntries;

  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = path->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  while (NS_SUCCEEDED(directoryEnumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    nsCOMPtr<nsISupports> aSupport;
    directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsIFile> currentFile(do_QueryInterface(aSupport, &rv));
    if (currentFile)
      currentDirEntries.AppendObject(currentFile);
  }

  // add the folders
  PRInt32 count = currentDirEntries.Count();
  for (int i = 0; i < count; ++i)
  {
    nsCOMPtr<nsIFile> currentFile(currentDirEntries[i]);

    nsAutoString leafName;
    currentFile->GetLeafName(leafName);
    directoryEnumerator->HasMoreElements(&hasMore);
    // here we should handle the case where the current file is a .sbd directory w/o
    // a matching folder file, or a directory w/o the name .sbd
    if (nsShouldIgnoreFile(leafName))
      continue;

    nsCOMPtr<nsIMsgFolder> child;
    rv = AddSubfolder(leafName, getter_AddRefs(child));
    if (child)
    {
      nsString folderName;
      child->GetName(folderName);  // try to get it from cache/db
      if (folderName.IsEmpty())
        child->SetPrettyName(leafName);
    }
  }

  return rv;
}

nsresult nsMsgLocalMailFolder::CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder)
{
  nsMsgLocalMailFolder *newFolder = new nsMsgLocalMailFolder;
  if (!newFolder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(*folder = newFolder);
  newFolder->Init(uri.get());
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::AddSubfolder(const nsAString &name,
                                                 nsIMsgFolder **child)
{
  nsresult rv = nsMsgDBFolder::AddSubfolder(name, child);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsILocalFile> path;
  // need to make sure folder exists...
  (*child)->GetFilePath(getter_AddRefs(path));
  if (path)
  {
    PRBool exists;
    rv = path->Exists(&exists);
    if (!exists)
      rv = path->Create(nsIFile::NORMAL_FILE_TYPE, 0644);
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetManyHeadersToDownload(PRBool *retval)
{
  PRBool isLocked;
  // if the folder is locked, we're probably reparsing - let's build the
  // view when we've finished reparsing.
  GetLocked(&isLocked);
  if (isLocked)
  {
    *retval = PR_TRUE;
    return NS_OK;
  }
  else
    return nsMsgDBFolder::GetManyHeadersToDownload(retval);
}

//run the url to parse the mailbox
NS_IMETHODIMP nsMsgLocalMailFolder::ParseFolder(nsIMsgWindow *aMsgWindow, nsIUrlListener *listener)
{
  nsresult rv;
  nsCOMPtr<nsILocalFile> pathFile;
  rv = GetFilePath(getter_AddRefs(pathFile));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIMailboxService> mailboxService = do_GetService(kMailboxServiceCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsMsgMailboxParser *parser = new nsMsgMailboxParser(this);
  NS_ENSURE_TRUE(parser, NS_ERROR_OUT_OF_MEMORY);

  PRBool isLocked;
  nsCOMPtr <nsISupports> supports = do_QueryInterface(static_cast<nsIMsgParseMailMsgState*>(parser));
  GetLocked(&isLocked);
  if(!isLocked)
    AcquireSemaphore(supports);
  else
  {
    NS_ASSERTION(PR_FALSE, "Could not get folder lock");
    return NS_MSG_FOLDER_BUSY;
  }

  if (listener != this)
    mReparseListener = listener;

  rv = mailboxService->ParseMailbox(aMsgWindow, pathFile, parser, this, nsnull);
  if (NS_SUCCEEDED(rv))
    m_parsingFolder = PR_TRUE;
  return rv;
}

// this won't force a reparse of the folder if the db is invalid.
NS_IMETHODIMP
nsMsgLocalMailFolder::GetMsgDatabase(nsIMsgWindow *aMsgWindow,
                              nsIMsgDatabase** aMsgDatabase)
{
  return GetDatabaseWOReparse(aMsgDatabase);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetSubFolders(nsISimpleEnumerator **aResult)
{
  PRBool isServer;
  nsresult rv = GetIsServer(&isServer);

  if (!mInitialized) {
    nsCOMPtr<nsILocalFile> path;
    rv = GetFilePath(getter_AddRefs(path));
    if (NS_FAILED(rv)) return rv;

    PRBool exists, directory;
    path->Exists(&exists);
    if (!exists)
      path->Create(nsIFile::DIRECTORY_TYPE, 0755);

    path->IsDirectory(&directory);
    if (!directory)
    {
      nsCOMPtr <nsIFile> dirFile;
      rv = path->Clone(getter_AddRefs(dirFile));
      NS_ENSURE_SUCCESS(rv, rv);
      nsAutoString leafName;
      dirFile->GetLeafName(leafName);
      leafName.AppendLiteral(".sbd");
      dirFile->SetLeafName(leafName);
      path = do_QueryInterface(dirFile);
      path->IsDirectory(&directory);
    }

    mInitialized = PR_TRUE;      // need to set this flag here to avoid infinite recursion
    // we have to treat the root folder specially, because it's name
    // doesn't end with .sbd
    PRInt32 newFlags = nsMsgFolderFlags::Mail;
    if (directory)
    {
      newFlags |= (nsMsgFolderFlags::Directory | nsMsgFolderFlags::Elided);
      SetFlag(newFlags);

      PRBool createdDefaultMailboxes = PR_FALSE;
      nsCOMPtr<nsILocalMailIncomingServer> localMailServer;

      if (isServer)
      {
        nsCOMPtr<nsIMsgIncomingServer> server;
        rv = GetServer(getter_AddRefs(server));
        NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);
        localMailServer = do_QueryInterface(server, &rv);
        NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

        // first create the folders on disk (as empty files)
        rv = localMailServer->CreateDefaultMailboxes(path);
        NS_ENSURE_SUCCESS(rv, rv);
        createdDefaultMailboxes = PR_TRUE;
      }

      // now, discover those folders
      rv = CreateSubFolders(path);
      if (NS_FAILED(rv)) return rv;

      // must happen after CreateSubFolders, or the folders won't exist.
      if (createdDefaultMailboxes && isServer)
      {
        rv = localMailServer->SetFlagsOnDefaultMailboxes();
        if (NS_FAILED(rv)) return rv;
      }

      /* we need to create all the folders at start-up because if a folder having subfolders is
                    closed then the datasource will not ask for subfolders. For IMAP logging onto the
                    server will create imap folders and for news we don't have any 2nd level newsgroup */
      PRInt32 count = mSubFolders.Count();
      nsCOMPtr<nsISimpleEnumerator> enumerator;
      for (PRInt32 i = 0; i < count; i++)
      {
        rv = mSubFolders[i]->GetSubFolders(getter_AddRefs(enumerator));
        NS_ASSERTION(NS_SUCCEEDED(rv),"GetSubFolders failed");
      }
    }
    UpdateSummaryTotals(PR_FALSE);
  }

  return aResult ? NS_NewArrayEnumerator(aResult, mSubFolders) : NS_ERROR_NULL_POINTER;
}

nsresult nsMsgLocalMailFolder::GetDatabase(nsIMsgWindow *aMsgWindow)
{
  nsCOMPtr <nsIMsgDatabase> msgDB;
  return GetDatabaseWOReparse(getter_AddRefs(msgDB));
}

//we treat failure as null db returned
NS_IMETHODIMP nsMsgLocalMailFolder::GetDatabaseWOReparse(nsIMsgDatabase **aDatabase)
{
  NS_ENSURE_ARG(aDatabase);
  if (m_parsingFolder)
    return NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE;

  nsresult rv = NS_OK;
  if (!mDatabase)
  {
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = msgDBService->OpenFolderDB(this, PR_TRUE, getter_AddRefs(mDatabase));

    if (mDatabase && NS_SUCCEEDED(rv))
    {
      mDatabase->AddListener(this);
      UpdateNewMessages();
    }
  }
  NS_IF_ADDREF(*aDatabase = mDatabase);
  return rv;
}


// Makes sure the database is open and exists.  If the database is out of date,
// then this call will run an async url to reparse the folder. The passed in
// url listener will get called when the url is done.
NS_IMETHODIMP nsMsgLocalMailFolder::GetDatabaseWithReparse(nsIUrlListener *aReparseUrlListener, nsIMsgWindow *aMsgWindow,
                                                           nsIMsgDatabase **aMsgDatabase)
{
  nsresult rv = NS_OK;
  // if we're already reparsing, just remember the listener so we can notify it
  // when we've finished.
  if (m_parsingFolder)
  {
    NS_ASSERTION(!mReparseListener, "can't have an existing listener");
    mReparseListener = aReparseUrlListener;
    return NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE;
  }

  if (!mDatabase)
  {
    nsCOMPtr <nsILocalFile> pathFile;
    rv = GetFilePath(getter_AddRefs(pathFile));
    if (NS_FAILED(rv)) return rv;
    PRBool exists;
    rv = pathFile->Exists(&exists);
    NS_ENSURE_SUCCESS(rv,rv);
    if (!exists)
      return NS_ERROR_NULL_POINTER;  //mDatabase will be null at this point.
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsresult folderOpen = msgDBService->OpenFolderDB(this, PR_TRUE,
                                                     getter_AddRefs(mDatabase));
    if (folderOpen == NS_ERROR_FILE_TARGET_DOES_NOT_EXIST)
    {
      nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
      nsCOMPtr <nsIDBFolderInfo> transferInfo;
      if (mDatabase)
      {
        mDatabase->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
        if (dbFolderInfo)
        {
          dbFolderInfo->SetNumMessages(0);
          dbFolderInfo->SetNumUnreadMessages(0);
          dbFolderInfo->GetTransferInfo(getter_AddRefs(transferInfo));
        }
        dbFolderInfo = nsnull;

        // A backup message database might have been created earlier, for example
        // if the user requested a reindex. We'll use the earlier one if we can,
        // otherwise we'll try to backup at this point.
        if (NS_FAILED(OpenBackupMsgDatabase()))
        {
          CloseAndBackupFolderDB(EmptyCString());
          if (NS_FAILED(OpenBackupMsgDatabase()))
            mBackupDatabase = nsnull;
        }
        else
          mDatabase->ForceClosed();

        mDatabase = nsnull;
      }
      nsCOMPtr <nsILocalFile> summaryFile;
      rv = GetSummaryFileLocation(pathFile, getter_AddRefs(summaryFile));
      NS_ENSURE_SUCCESS(rv, rv);
      // Remove summary file.
      summaryFile->Remove(PR_FALSE);

      // if it's out of date then reopen with upgrade.
      rv = msgDBService->CreateNewDB(this, getter_AddRefs(mDatabase));
      NS_ENSURE_SUCCESS(rv, rv);

      if (transferInfo && mDatabase)
      {
        SetDBTransferInfo(transferInfo);
        mDatabase->SetSummaryValid(PR_FALSE);
      }
    }
    else if (folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING)
    {
      msgDBService->CreateNewDB(this, getter_AddRefs(mDatabase));
    }

    if(mDatabase)
    {
      if(mAddListener)
        mDatabase->AddListener(this);

      // if we have to regenerate the folder, run the parser url.
      if (folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING ||
          folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE)
      {
        if(NS_FAILED(rv = ParseFolder(aMsgWindow, aReparseUrlListener)))
        {
          if (rv == NS_MSG_FOLDER_BUSY)
          {
            mDatabase->RemoveListener(this);  //we need to null out the db so that parsing gets kicked off again.
            mDatabase = nsnull;
            ThrowAlertMsg("parsingFolderFailed", aMsgWindow);
          }
          return rv;
        }
        else
          return NS_ERROR_NOT_INITIALIZED;
      }
      else
      {
        // We have a valid database so lets extract necessary info.
        UpdateSummaryTotals(PR_TRUE);
      }
    }
  }
  NS_IF_ADDREF(*aMsgDatabase = mDatabase);
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::UpdateFolder(nsIMsgWindow *aWindow)
{
  (void) RefreshSizeOnDisk();
  nsresult rv;

  nsCOMPtr<nsIMsgAccountManager> accountManager =
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  PRBool userNeedsToAuthenticate = PR_FALSE;
  // if we're PasswordProtectLocalCache, then we need to find out if the server is authenticated.
  (void) accountManager->GetUserNeedsToAuthenticate(&userNeedsToAuthenticate);
  if (userNeedsToAuthenticate)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);
    // need to check if this is a pop3 or no mail server to determine which password
    // we should challenge the user with.
    nsCOMPtr<nsIMsgIncomingServer> serverToAuthenticateAgainst;
    nsCOMPtr<nsINoIncomingServer> noIncomingServer = do_QueryInterface(server);
    if (noIncomingServer)
    {
      nsCOMPtr<nsIMsgAccount> defaultAccount;
      accountManager->GetDefaultAccount(getter_AddRefs(defaultAccount));
      if (defaultAccount)
        defaultAccount->GetIncomingServer(getter_AddRefs(serverToAuthenticateAgainst));
    }
    else
      GetServer(getter_AddRefs(serverToAuthenticateAgainst));
    if (serverToAuthenticateAgainst)
    {
      PRBool passwordMatches = PR_FALSE;
      rv = PromptForCachePassword(serverToAuthenticateAgainst, aWindow, passwordMatches);
      if (!passwordMatches)
        return NS_ERROR_FAILURE;
    }
  }
  //If we don't currently have a database, get it.  Otherwise, the folder has been updated (presumably this
  //changes when we download headers when opening inbox).  If it's updated, send NotifyFolderLoaded.
  if(!mDatabase)
    // return of NS_ERROR_NOT_INITIALIZED means running parsing URL
    rv = GetDatabaseWithReparse(this, aWindow, getter_AddRefs(mDatabase));
  else
  {
    PRBool valid;
    rv = mDatabase->GetSummaryValid(&valid);
    // don't notify folder loaded or try compaction if db isn't valid
    // (we're probably reparsing or copying msgs to it)
    if (NS_SUCCEEDED(rv) && valid)
    {
      NotifyFolderEvent(mFolderLoadedAtom);
      NS_ENSURE_SUCCESS(rv,rv);
    }
    else if (mCopyState)
      mCopyState->m_notifyFolderLoaded = PR_TRUE; //defer folder loaded notification
    else if (!m_parsingFolder)// if the db was already open, it's probably OK to load it if not parsing
      NotifyFolderEvent(mFolderLoadedAtom);
  }
  PRBool filtersRun;
  PRBool hasNewMessages;
  GetHasNewMessages(&hasNewMessages);
  if (mDatabase)
    ApplyRetentionSettings();
  // if we have new messages, try the filter plugins.
  if (NS_SUCCEEDED(rv) && hasNewMessages)
    (void) CallFilterPlugins(aWindow, &filtersRun);
  // Callers should rely on folder loaded event to ensure completion of loading. So we'll
  // return NS_OK even if parsing is still in progress
  if (rv == NS_ERROR_NOT_INITIALIZED)
    rv = NS_OK;
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetMessages(nsIMsgWindow *aMsgWindow, nsISimpleEnumerator* *result)
{
  nsCOMPtr <nsIMsgDatabase> msgDB;
  nsresult rv = GetDatabaseWOReparse(getter_AddRefs(msgDB));
  return NS_SUCCEEDED(rv) ? msgDB->EnumerateMessages(result) : rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetFolderURL(nsACString& aUrl)
{
  nsresult rv;
  nsCOMPtr<nsILocalFile> path;
  rv = GetFilePath(getter_AddRefs(path));
  if (NS_FAILED(rv)) return rv;

  rv = NS_GetURLSpecFromFile(path, aUrl);
  NS_ENSURE_SUCCESS(rv, rv);

  aUrl.Replace(0, strlen("file:"), "mailbox:");

  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::CreateStorageIfMissing(nsIUrlListener* aUrlListener)
{
  nsresult rv;
  nsCOMPtr <nsIMsgFolder> msgParent;
  GetParentMsgFolder(getter_AddRefs(msgParent));

  // parent is probably not set because *this* was probably created by rdf
  // and not by folder discovery. So, we have to compute the parent.
  if (!msgParent)
  {
    nsCAutoString folderName(mURI);
    nsCAutoString uri;
    PRInt32 leafPos = folderName.RFindChar('/');
    nsCAutoString parentName(folderName);
    if (leafPos > 0)
    {
      // If there is a hierarchy, there is a parent.
      // Don't strip off slash if it's the first character
      parentName.SetLength(leafPos);
      // get the corresponding RDF resource
      // RDF will create the folder resource if it doesn't already exist
      nsCOMPtr<nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
      NS_ENSURE_SUCCESS(rv,rv);

      nsCOMPtr<nsIRDFResource> resource;
      rv = rdf->GetResource(parentName, getter_AddRefs(resource));
      NS_ENSURE_SUCCESS(rv,rv);

      msgParent = do_QueryInterface(resource, &rv);
      NS_ENSURE_SUCCESS(rv,rv);
    }
  }

  if (msgParent)
  {
    nsString folderName;
    GetName(folderName);
    rv = msgParent->CreateSubfolder(folderName, nsnull);
  }
  return rv;
}


nsresult
nsMsgLocalMailFolder::CreateSubfolder(const nsAString& folderName, nsIMsgWindow *msgWindow )
{
  nsresult rv = CheckIfFolderExists(folderName, this, msgWindow);
  if(NS_FAILED(rv))  //we already throw an alert - no need for an assertion
    return rv;

  nsCOMPtr <nsILocalFile> path;
  nsCOMPtr<nsIMsgFolder> child;
  //Get a directory based on our current path.
  rv = CreateDirectoryForFolder(getter_AddRefs(path));
  if(NS_FAILED(rv))
    return rv;

  //Now we have a valid directory or we have returned.
  //Make sure the new folder name is valid
  nsAutoString safeFolderName(folderName);
  NS_MsgHashIfNecessary(safeFolderName);
  nsCAutoString nativeFolderName;
  rv = NS_CopyUnicodeToNative(safeFolderName, nativeFolderName);
  if (NS_FAILED(rv) || nativeFolderName.IsEmpty()) {
    ThrowAlertMsg("folderCreationFailed", msgWindow);
    // I'm returning this value so the dialog stays up
    return NS_MSG_FOLDER_EXISTS;
  }

  path->AppendNative(nativeFolderName);
  PRBool exists;
  path->Exists(&exists);
  if (exists) //check this because localized names are different from disk names
  {
    ThrowAlertMsg("folderExists", msgWindow);
    return NS_MSG_FOLDER_EXISTS;
  }

  path->Create(nsIFile::NORMAL_FILE_TYPE, 0600);

  //GetFlags and SetFlags in AddSubfolder will fail because we have no db at this point but mFlags is set.
  rv = AddSubfolder(safeFolderName, getter_AddRefs(child));
  if (!child || NS_FAILED(rv))
  {
    path->Remove(PR_FALSE);
    return rv;
  }

  // Create an empty database for this mail folder, set its name from the user
  nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
  if (msgDBService)
  {
    nsCOMPtr<nsIMsgDatabase> unusedDB;
    rv = msgDBService->OpenFolderDB(child, PR_TRUE, getter_AddRefs(unusedDB));
    if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING)
      rv = msgDBService->CreateNewDB(child, getter_AddRefs(unusedDB));

    if ((NS_SUCCEEDED(rv) || rv == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE) &&
        unusedDB)
    {
      //need to set the folder name
      nsCOMPtr<nsIDBFolderInfo> folderInfo;
      rv = unusedDB->GetDBFolderInfo(getter_AddRefs(folderInfo));
      if(NS_SUCCEEDED(rv))
      {
        folderInfo->SetMailboxName(safeFolderName);
      }
      unusedDB->SetSummaryValid(PR_TRUE);
      unusedDB->Close(PR_TRUE);
    }
    else
    {
      path->Remove(PR_FALSE);
      rv = NS_MSG_CANT_CREATE_FOLDER;
    }
  }
  if(NS_SUCCEEDED(rv))
  {
    //we need to notify explicitly the flag change because it failed when we did AddSubfolder
    child->OnFlagChange(mFlags);
    child->SetPrettyName(folderName);  //because empty trash will create a new trash folder
    NotifyItemAdded(child);
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::CompactAll(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow, nsISupportsArray *aFolderArray,
                                               PRBool aCompactOfflineAlso, nsISupportsArray *aOfflineFolderArray)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsISupportsArray> folderArray;
  if (!aFolderArray)
  {
    nsCOMPtr<nsIMsgFolder> rootFolder;
    nsCOMPtr<nsISupportsArray> allDescendents;
    rv = GetRootFolder(getter_AddRefs(rootFolder));
    if (NS_SUCCEEDED(rv) && rootFolder)
    {
      NS_NewISupportsArray(getter_AddRefs(allDescendents));
      rootFolder->ListDescendents(allDescendents);
      PRUint32 cnt =0;
      rv = allDescendents->Count(&cnt);
      NS_ENSURE_SUCCESS(rv,rv);
      NS_NewISupportsArray(getter_AddRefs(folderArray));
      PRUint32 expungedBytes=0;
      for (PRUint32 i = 0; i < cnt; i++)
      {
        nsCOMPtr<nsISupports> supports = getter_AddRefs(allDescendents->ElementAt(i));
        nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(supports, &rv);
        NS_ENSURE_SUCCESS(rv,rv);

        expungedBytes=0;
        if (folder)
          rv = folder->GetExpungedBytes(&expungedBytes);

        NS_ENSURE_SUCCESS(rv,rv);

        if (expungedBytes > 0)
          rv = folderArray->AppendElement(supports);
      }
      rv = folderArray->Count(&cnt);
      NS_ENSURE_SUCCESS(rv,rv);
      if (cnt == 0 )
        return NotifyCompactCompleted();
    }
  }
  nsCOMPtr <nsIMsgFolderCompactor> folderCompactor =  do_CreateInstance(NS_MSGLOCALFOLDERCOMPACTOR_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  if (aFolderArray)
     rv = folderCompactor->CompactAll(aFolderArray, aMsgWindow, aCompactOfflineAlso, aOfflineFolderArray);
  else if (folderArray)
     rv = folderCompactor->CompactAll(folderArray, aMsgWindow, aCompactOfflineAlso, aOfflineFolderArray);
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::Compact(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow)
{
  nsresult rv;
  nsCOMPtr <nsIMsgFolderCompactor> folderCompactor =  do_CreateInstance(NS_MSGLOCALFOLDERCOMPACTOR_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 expungedBytes = 0;
  GetExpungedBytes(&expungedBytes);
  // check if we need to compact the folder
  if (expungedBytes > 0)
    rv = folderCompactor->Compact(this, PR_FALSE, aMsgWindow);
  else
    rv = NotifyCompactCompleted();
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::EmptyTrash(nsIMsgWindow *msgWindow,
                                               nsIUrlListener *aListener)
{
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> trashFolder;
  rv = GetTrashFolder(getter_AddRefs(trashFolder));
  if (NS_SUCCEEDED(rv))
  {
    PRUint32 flags;
    nsCString trashUri;
    trashFolder->GetURI(trashUri);
    trashFolder->GetFlags(&flags);
    PRInt32 totalMessages = 0;
    rv = trashFolder->GetTotalMessages(PR_TRUE, &totalMessages);

    if (totalMessages <= 0)
    {
      nsCOMPtr<nsISimpleEnumerator> enumerator;
      rv = trashFolder->GetSubFolders(getter_AddRefs(enumerator));
      NS_ENSURE_SUCCESS(rv,rv);
      // Any folders to deal with?
      PRBool hasMore;
      rv = enumerator->HasMoreElements(&hasMore);
      if (NS_FAILED(rv) || !hasMore)
        return NS_OK;
    }
    nsCOMPtr<nsIMsgFolder> parentFolder;
    rv = trashFolder->GetParentMsgFolder(getter_AddRefs(parentFolder));
    if (NS_SUCCEEDED(rv) && parentFolder)
    {
      nsCOMPtr <nsIDBFolderInfo> transferInfo;
      trashFolder->GetDBTransferInfo(getter_AddRefs(transferInfo));
      trashFolder->SetParent(nsnull);
      parentFolder->PropagateDelete(trashFolder, PR_TRUE, msgWindow);
      parentFolder->CreateSubfolder(NS_LITERAL_STRING("Trash"), nsnull);
      nsCOMPtr<nsIMsgFolder> newTrashFolder;
      rv = GetTrashFolder(getter_AddRefs(newTrashFolder));
      if (NS_SUCCEEDED(rv) && newTrashFolder)
      {
        nsCOMPtr <nsIMsgLocalMailFolder> localTrash = do_QueryInterface(newTrashFolder);
        newTrashFolder->SetDBTransferInfo(transferInfo);
        if (localTrash)
          localTrash->RefreshSizeOnDisk();
        // update the summary totals so the front end will
        // show the right thing for the new trash folder
        // see bug #161999
        nsCOMPtr<nsIDBFolderInfo> dbFolderInfo;
        nsCOMPtr<nsIMsgDatabase> db;
        newTrashFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(db));
        if (dbFolderInfo)
        {
          dbFolderInfo->SetNumUnreadMessages(0);
          dbFolderInfo->SetNumMessages(0);
        }
        newTrashFolder->UpdateSummaryTotals(PR_TRUE);
      }
    }
  }
  return rv;
}

nsresult nsMsgLocalMailFolder::IsChildOfTrash(PRBool *result)
{
  NS_ENSURE_ARG_POINTER(result);
  PRUint32 parentFlags = 0;
  *result = PR_FALSE;
  PRBool isServer;
  nsresult rv = GetIsServer(&isServer);
  if (NS_FAILED(rv) || isServer)
    return NS_OK;

  rv= GetFlags(&parentFlags);  //this is the parent folder
  if (parentFlags & nsMsgFolderFlags::Trash)
  {
    *result = PR_TRUE;
    return rv;
  }

  nsCOMPtr<nsIMsgFolder> parentFolder;
  nsCOMPtr<nsIMsgFolder> thisFolder;
  rv = QueryInterface(NS_GET_IID(nsIMsgFolder), (void **) getter_AddRefs(thisFolder));

  while (!isServer)
  {
    thisFolder->GetParentMsgFolder(getter_AddRefs(parentFolder));
    if (!parentFolder) return NS_OK;
    rv = parentFolder->GetIsServer(&isServer);
    if (NS_FAILED(rv) || isServer) return NS_OK;
    rv = parentFolder->GetFlags(&parentFlags);
    if (NS_FAILED(rv)) return NS_OK;
    if (parentFlags & nsMsgFolderFlags::Trash)
    {
      *result = PR_TRUE;
      return rv;
    }
    thisFolder = parentFolder;
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::Delete()
{
  nsresult rv;
  if(mDatabase)
  {
    mDatabase->ForceClosed();
    mDatabase = nsnull;
  }

  nsCOMPtr<nsILocalFile> pathFile;
  rv = GetFilePath(getter_AddRefs(pathFile));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr <nsILocalFile> summaryFile;
  rv = GetSummaryFileLocation(pathFile, getter_AddRefs(summaryFile));
  NS_ENSURE_SUCCESS(rv, rv);

  //Clean up .sbd folder if it exists.
  // Remove summary file.
  summaryFile->Remove(PR_FALSE);

  //Delete mailbox
  pathFile->Remove(PR_FALSE);

  PRBool isDirectory = PR_FALSE;
  pathFile->IsDirectory(&isDirectory);
  if (!isDirectory)
    AddDirectorySeparator(pathFile);
  isDirectory = PR_FALSE;
  pathFile->IsDirectory(&isDirectory);
  //If this is a directory, then remove it.
  return (isDirectory) ? pathFile->Remove(PR_TRUE) : NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::DeleteSubFolders(nsIArray *folders, nsIMsgWindow *msgWindow)
{
  nsresult rv;
  PRBool isChildOfTrash;
  IsChildOfTrash(&isChildOfTrash);

  // we don't allow multiple folder selection so this is ok.
  nsCOMPtr<nsIMsgFolder> folder = do_QueryElementAt(folders, 0);
  PRUint32 folderFlags = 0;
  if (folder)
    folder->GetFlags(&folderFlags);
  // when deleting from trash, or virtual folder, just delete it.
  if (isChildOfTrash || folderFlags & nsMsgFolderFlags::Virtual)
    return nsMsgDBFolder::DeleteSubFolders(folders, msgWindow);

  nsCOMPtr<nsIMsgFolder> trashFolder;
  rv = GetTrashFolder(getter_AddRefs(trashFolder));
  if (NS_SUCCEEDED(rv))
  {
    if (folder)
    {
      nsCOMPtr<nsIMsgCopyService> copyService(do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv));
      NS_ENSURE_SUCCESS(rv, rv);
      rv = copyService->CopyFolders(folders, trashFolder, PR_TRUE, nsnull, msgWindow);
    }
  }
  return rv;
}

nsresult nsMsgLocalMailFolder::ConfirmFolderDeletion(nsIMsgWindow *aMsgWindow,
                                                     nsIMsgFolder *aFolder, PRBool *aResult)
{
  NS_ENSURE_ARG(aResult);
  NS_ENSURE_ARG(aMsgWindow);
  NS_ENSURE_ARG(aFolder);
  nsCOMPtr<nsIDocShell> docShell;
  aMsgWindow->GetRootDocShell(getter_AddRefs(docShell));
  if (docShell)
  {
    PRBool confirmDeletion = PR_TRUE;
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    pPrefBranch->GetBoolPref("mailnews.confirm.moveFoldersToTrash", &confirmDeletion);
    if (confirmDeletion)
    {
      nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
      NS_ENSURE_SUCCESS(rv, rv);
      nsCOMPtr<nsIStringBundle> bundle;
      rv = bundleService->CreateBundle("chrome://messenger/locale/localMsgs.properties", getter_AddRefs(bundle));
      NS_ENSURE_SUCCESS(rv, rv);

      nsAutoString folderName;
      rv = aFolder->GetName(folderName);
      NS_ENSURE_SUCCESS(rv, rv);
      const PRUnichar *formatStrings[1] = { folderName.get() };

      nsAutoString deleteFolderDialogTitle;
      rv = bundle->GetStringFromID(POP3_DELETE_FOLDER_DIALOG_TITLE,
                                   getter_Copies(deleteFolderDialogTitle));
      NS_ENSURE_SUCCESS(rv, rv);

      nsAutoString deleteFolderButtonLabel;
      rv = bundle->GetStringFromID(POP3_DELETE_FOLDER_BUTTON_LABEL,
                                   getter_Copies(deleteFolderButtonLabel));
      NS_ENSURE_SUCCESS(rv, rv);

      nsAutoString confirmationStr;
      rv = bundle->FormatStringFromID(POP3_MOVE_FOLDER_TO_TRASH, formatStrings, 1,
                                      getter_Copies(confirmationStr));
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIPrompt> dialog(do_GetInterface(docShell));
      if (dialog)
      {
        PRInt32 buttonPressed = 0;
        // Default the dialog to "cancel".
        const PRUint32 buttonFlags =
          (nsIPrompt::BUTTON_TITLE_IS_STRING * nsIPrompt::BUTTON_POS_0) +
          (nsIPrompt::BUTTON_TITLE_CANCEL * nsIPrompt::BUTTON_POS_1);
        rv = dialog->ConfirmEx(deleteFolderDialogTitle.get(), confirmationStr.get(),
                               buttonFlags,  deleteFolderButtonLabel.get(),
                               nsnull, nsnull, nsnull, nsnull,
                               &buttonPressed);
        NS_ENSURE_SUCCESS(rv, rv);
        *aResult = !buttonPressed; // "ok" is in position 0
      }
    }
    else
      *aResult = PR_TRUE;
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::Rename(const nsAString& aNewName, nsIMsgWindow *msgWindow)
{
  // Renaming to the same name is easy
  if (mName.Equals(aNewName))
    return NS_OK;

  nsCOMPtr<nsILocalFile> oldPathFile;
  nsCOMPtr<nsIAtom> folderRenameAtom;
  nsresult rv = GetFilePath(getter_AddRefs(oldPathFile));
  if (NS_FAILED(rv))
    return rv;
  nsCOMPtr<nsIMsgFolder> parentFolder;
  rv = GetParentMsgFolder(getter_AddRefs(parentFolder));
  if (NS_FAILED(rv))
    return rv;
  nsCOMPtr<nsISupports> parentSupport = do_QueryInterface(parentFolder);

  nsCOMPtr <nsILocalFile> oldSummaryFile;
  rv = GetSummaryFileLocation(oldPathFile, getter_AddRefs(oldSummaryFile));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsILocalFile> dirFile;

  PRInt32 count = mSubFolders.Count();

  if (count > 0)
    rv = CreateDirectoryForFolder(getter_AddRefs(dirFile));

  // Convert from nsAString to nsCAutoString, as we will call moveToNative(),
  // not moveTo().

  nsAutoString safeName(aNewName);
  NS_MsgHashIfNecessary(safeName);
  nsCAutoString newDiskName;
  if (NS_FAILED(NS_CopyUnicodeToNative(safeName, newDiskName)))
    return NS_ERROR_FAILURE;

  nsCAutoString oldLeafName;
  oldPathFile->GetNativeLeafName(oldLeafName);

  if (mName.Equals(aNewName, nsCaseInsensitiveStringComparator()))
  {
    if(msgWindow)
      rv = ThrowAlertMsg("folderExists", msgWindow);
    return NS_MSG_FOLDER_EXISTS;
  }
  else
  {
    nsCOMPtr <nsILocalFile> parentPathFile;
    parentFolder->GetFilePath(getter_AddRefs(parentPathFile));
    NS_ENSURE_SUCCESS(rv,rv);

    PRBool isDirectory = PR_FALSE;
    parentPathFile->IsDirectory(&isDirectory);
    if (!isDirectory)
      AddDirectorySeparator(parentPathFile);

    rv = CheckIfFolderExists(aNewName, parentFolder, msgWindow);
    if (NS_FAILED(rv))
      return rv;
  }

  ForceDBClosed();
  nsCAutoString newNameDirStr = newDiskName;  //save of dir name before appending .msf
  rv = oldPathFile->MoveToNative(nsnull, newDiskName);
  if (NS_SUCCEEDED(rv))
  {
    newDiskName += SUMMARY_SUFFIX;
    oldSummaryFile->MoveToNative(nsnull, newDiskName);
  }
  else
  {
    ThrowAlertMsg("folderRenameFailed", msgWindow);
    return rv;
  }

  if (NS_SUCCEEDED(rv) && count > 0)
  {
    // rename "*.sbd" directory
    newNameDirStr += ".sbd";
    dirFile->MoveToNative(nsnull, newNameDirStr);
  }

  nsCOMPtr<nsIMsgFolder> newFolder;
  if (parentSupport)
  {
    rv = parentFolder->AddSubfolder(safeName, getter_AddRefs(newFolder));
    if (newFolder)
    {
      // Because we just renamed the db, w/o setting the pretty name in it,
      // we need to force the pretty name to be correct.
      // SetPrettyName won't write the name to the db if it doesn't think the
      // name has changed. This hack forces the pretty name to get set in the db.
      // We could set the new pretty name on the db before renaming the .msf file,
      // but if the rename failed, it would be out of sync.
      newFolder->SetPrettyName(EmptyString());
      newFolder->SetPrettyName(aNewName);
      PRBool changed = PR_FALSE;
      MatchOrChangeFilterDestination(newFolder, PR_TRUE /*caseInsenstive*/, &changed);
      if (changed)
        AlertFilterChanged(msgWindow);

      if (count > 0)
        newFolder->RenameSubFolders(msgWindow, this);

      // Discover the subfolders inside this folder (this is recursive)
      newFolder->GetSubFolders(nsnull);

      // the newFolder should have the same flags
      newFolder->SetFlags(mFlags);
      if (parentFolder)
      {
        SetParent(nsnull);
        parentFolder->PropagateDelete(this, PR_FALSE, msgWindow);
        parentFolder->NotifyItemAdded(newFolder);
      }
      SetFilePath(nsnull); // forget our path, since this folder object renamed itself
      folderRenameAtom = do_GetAtom("RenameCompleted");
      newFolder->NotifyFolderEvent(folderRenameAtom);

      nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
        notifier->NotifyFolderRenamed(this, newFolder);
    }
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::RenameSubFolders(nsIMsgWindow *msgWindow, nsIMsgFolder *oldFolder)
{
  nsresult rv =NS_OK;
  mInitialized = PR_TRUE;

  PRUint32 flags;
  oldFolder->GetFlags(&flags);
  SetFlags(flags);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = oldFolder->GetSubFolders(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    nsCOMPtr<nsISupports> item;
    enumerator->GetNext(getter_AddRefs(item));

    nsCOMPtr<nsIMsgFolder> msgFolder(do_QueryInterface(item));
    if (!msgFolder)
      continue;

    nsString folderName;
    rv = msgFolder->GetName(folderName);
    nsCOMPtr <nsIMsgFolder> newFolder;
    AddSubfolder(folderName, getter_AddRefs(newFolder));
    if (newFolder)
    {
      newFolder->SetPrettyName(folderName);
      PRBool changed = PR_FALSE;
      msgFolder->MatchOrChangeFilterDestination(newFolder, PR_TRUE /*caseInsenstive*/, &changed);
      if (changed)
        msgFolder->AlertFilterChanged(msgWindow);
      newFolder->RenameSubFolders(msgWindow, msgFolder);
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetPrettyName(nsAString& prettyName)
{
  return nsMsgDBFolder::GetPrettyName(prettyName);
}

NS_IMETHODIMP nsMsgLocalMailFolder::SetPrettyName(const nsAString& aName)
{
  nsresult rv = nsMsgDBFolder::SetPrettyName(aName);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString folderName;
  rv = GetStringProperty("folderName", folderName);
  NS_ConvertUTF16toUTF8 utf8FolderName(mName);
  return NS_FAILED(rv) || !folderName.Equals(utf8FolderName) ? SetStringProperty("folderName", utf8FolderName) : rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetName(nsAString& aName)
{
  ReadDBFolderInfo(PR_FALSE);
  return nsMsgDBFolder::GetName(aName);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo, nsIMsgDatabase **db)
{
  if(!db || !folderInfo || !mPath || mIsServer)
    return NS_ERROR_NULL_POINTER;   //ducarroz: should we use NS_ERROR_INVALID_ARG?

  nsresult rv;
  if (mDatabase)
    rv = NS_OK;
  else
  {
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    PRBool folderEmpty = PR_FALSE;
    nsCOMPtr <nsILocalFile> file;
    rv = GetFilePath(getter_AddRefs(file));
    // check for case of trying to open db for 0 byte folder (i.e., new folder),
    // and in that case, tell msg db to create a new db and set it valid after opening it.
    if (NS_SUCCEEDED(rv))
    {
      PRInt64 mailboxSize;
      if (NS_SUCCEEDED(file->GetFileSize(&mailboxSize)))
        folderEmpty = !mailboxSize;
    }

    rv = msgDBService->OpenFolderDB(this, PR_FALSE, getter_AddRefs(mDatabase));
    if (folderEmpty)
    {
      if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING)
      {
        rv = msgDBService->CreateNewDB(this, getter_AddRefs(mDatabase));
        if (mDatabase)
          mDatabase->SetSummaryValid(PR_TRUE);
      }
      else if (NS_FAILED(rv))
        mDatabase = nsnull;
    }
    if (mAddListener && mDatabase)
      mDatabase->AddListener(this);
  }

  NS_IF_ADDREF(*db = mDatabase);
  if (NS_SUCCEEDED(rv) && *db)
    rv = (*db)->GetDBFolderInfo(folderInfo);
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::ReadFromFolderCacheElem(nsIMsgFolderCacheElement *element)
{
  NS_ENSURE_ARG_POINTER(element);
  nsresult rv = nsMsgDBFolder::ReadFromFolderCacheElem(element);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString utf8Name;
  rv = element->GetStringProperty("folderName", utf8Name);
  NS_ENSURE_SUCCESS(rv, rv);
  CopyUTF8toUTF16(utf8Name, mName);
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::WriteToFolderCacheElem(nsIMsgFolderCacheElement *element)
{
  NS_ENSURE_ARG_POINTER(element);
  nsMsgDBFolder::WriteToFolderCacheElem(element);
  return element->SetStringProperty("folderName", NS_ConvertUTF16toUTF8(mName));
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetDeletable(PRBool *deletable)
{
  NS_ENSURE_ARG_POINTER(deletable);

  PRBool isServer;
  GetIsServer(&isServer);
  *deletable = !(isServer || mFlags & nsMsgFolderFlags::Inbox ||
    mFlags & nsMsgFolderFlags::Drafts ||
    mFlags & nsMsgFolderFlags::Trash ||
    mFlags & nsMsgFolderFlags::Templates ||
    mFlags & nsMsgFolderFlags::Junk);
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetRequiresCleanup(PRBool *requiresCleanup)
{
#ifdef HAVE_PORT
  if (m_expungedBytes > 0)
  {
    PRInt32 purgeThreshhold = m_master->GetPrefs()->GetPurgeThreshhold();
    PRBool purgePrompt = m_master->GetPrefs()->GetPurgeThreshholdEnabled();
    return (purgePrompt && m_expungedBytes / 1000L > purgeThreshhold);
  }
  return PR_FALSE;
#endif
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::RefreshSizeOnDisk()
{
  PRUint32 oldFolderSize = mFolderSize;
  mFolderSize = 0; // we set this to 0 to force it to get recalculated from disk
  if (NS_SUCCEEDED(GetSizeOnDisk(&mFolderSize)))
    NotifyIntPropertyChanged(kFolderSizeAtom, oldFolderSize, mFolderSize);
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetSizeOnDisk(PRUint32* aSize)
{
  NS_ENSURE_ARG_POINTER(aSize);
  nsresult rv = NS_OK;
  if (!mFolderSize)
  {
    nsCOMPtr <nsILocalFile> file;
    rv = GetFilePath(getter_AddRefs(file));
    NS_ENSURE_SUCCESS(rv, rv);
    PRInt64 folderSize;
    rv = file->GetFileSize(&folderSize);
    mFolderSize = (PRUint32) folderSize;
  }
  *aSize = mFolderSize;
  return rv;
}

nsresult
nsMsgLocalMailFolder::GetTrashFolder(nsIMsgFolder** result)
{
  NS_ENSURE_ARG_POINTER(result);
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = GetRootFolder(getter_AddRefs(rootFolder));
  if(NS_SUCCEEDED(rv))
  {
    rootFolder->GetFolderWithFlags(nsMsgFolderFlags::Trash, result);
    if (!*result)
      rv = NS_ERROR_FAILURE;
  }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::DeleteMessages(nsIArray *messages,
                                     nsIMsgWindow *msgWindow,
                                     PRBool deleteStorage, PRBool isMove,
                                     nsIMsgCopyServiceListener* listener, PRBool allowUndo)
{
  NS_ENSURE_ARG_POINTER(messages);

  PRUint32 messageCount;
  nsresult rv = messages->GetLength(&messageCount);
  NS_ENSURE_SUCCESS(rv, rv);

  // shift delete case - (delete to trash is handled in EndMove)
  // this is also the case when applying retention settings.
  if (deleteStorage && !isMove)
  {
    MarkMsgsOnPop3Server(messages, POP3_DELETE);
  }

  PRBool isTrashFolder = mFlags & nsMsgFolderFlags::Trash;

  // notify on delete from trash and shift-delete
  if (!isMove && (deleteStorage || isTrashFolder))
  {
    nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
    if (notifier)
        notifier->NotifyMsgsDeleted(messages);
  }

  if (!deleteStorage && !isTrashFolder)
  {
    nsCOMPtr<nsIMsgFolder> trashFolder;
    rv = GetTrashFolder(getter_AddRefs(trashFolder));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      return copyService->CopyMessages(this, messages, trashFolder,
                                       PR_TRUE, listener, msgWindow, allowUndo);
    }
  }
  else
  {
    nsCOMPtr <nsIMsgDatabase> msgDB;
    rv = GetDatabaseWOReparse(getter_AddRefs(msgDB));
    if(NS_SUCCEEDED(rv))
    {
      if (deleteStorage && isMove && GetDeleteFromServerOnMove())
        MarkMsgsOnPop3Server(messages, POP3_DELETE);

      nsCOMPtr<nsISupports> msgSupport;
      rv = EnableNotifications(allMessageCountNotifications, PR_FALSE, PR_TRUE /*dbBatching*/);
      if (NS_SUCCEEDED(rv))
      {
        for(PRUint32 i = 0; i < messageCount; i++)
        {
          msgSupport = do_QueryElementAt(messages, i, &rv);
          if (msgSupport)
            DeleteMessage(msgSupport, msgWindow, PR_TRUE, PR_FALSE);
        }
      }
      else if (rv == NS_MSG_FOLDER_BUSY)
        ThrowAlertMsg("deletingMsgsFailed", msgWindow);

      // we are the source folder here for a move or shift delete
      //enable notifications because that will close the file stream
      // we've been caching, mark the db as valid, and commit it.
      EnableNotifications(allMessageCountNotifications, PR_TRUE, PR_TRUE /*dbBatching*/);
      if(!isMove)
        NotifyFolderEvent(NS_SUCCEEDED(rv) ? mDeleteOrMoveMsgCompletedAtom : mDeleteOrMoveMsgFailedAtom);
      if (msgWindow && !isMove)
        AutoCompact(msgWindow);
    }
  }
  return rv;
}

nsresult
nsMsgLocalMailFolder::InitCopyState(nsISupports* aSupport,
                                    nsIArray* messages,
                                    PRBool isMove,
                                    nsIMsgCopyServiceListener* listener,
                                    nsIMsgWindow *msgWindow, PRBool isFolder,
                                    PRBool allowUndo)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsILocalFile> path;

  NS_ASSERTION(!mCopyState, "already copying a msg into this folder");
  if (mCopyState)
    return NS_ERROR_FAILURE; // already has a  copy in progress

  // get mDatabase set, so we can use it to add new hdrs to this db.
  // calling GetDatabase will set mDatabase - we use the comptr
  // here to avoid doubling the refcnt on mDatabase. We don't care if this
  // fails - we just want to give it a chance. It will definitely fail in
  // nsLocalMailFolder::EndCopy because we will have written data to the folder
  // and changed its size.
  nsCOMPtr <nsIMsgDatabase> msgDB;
  GetDatabaseWOReparse(getter_AddRefs(msgDB));
  PRBool isLocked;

  GetLocked(&isLocked);
  if(!isLocked)
    AcquireSemaphore(static_cast<nsIMsgLocalMailFolder*>(this));
  else
    return NS_MSG_FOLDER_BUSY;

  rv = GetFilePath(getter_AddRefs(path));
  NS_ENSURE_SUCCESS(rv, rv);

  mCopyState = new nsLocalMailCopyState();
  NS_ENSURE_TRUE(mCopyState, NS_ERROR_OUT_OF_MEMORY);

  mCopyState->m_dataBuffer = (char*) PR_CALLOC(COPY_BUFFER_SIZE+1);
  NS_ENSURE_TRUE(mCopyState->m_dataBuffer, NS_ERROR_OUT_OF_MEMORY);

  mCopyState->m_dataBufferSize = COPY_BUFFER_SIZE;
  mCopyState->m_destDB = msgDB;

  //Before we continue we should verify that there is enough diskspace.
  //XXX How do we do this?
  rv = NS_NewLocalFileOutputStream(getter_AddRefs( mCopyState->m_fileStream), path, PR_WRONLY | PR_CREATE_FILE, 00600);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream);
  //The new key is the end of the file
  seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);
  mCopyState->m_srcSupport = do_QueryInterface(aSupport, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  mCopyState->m_messages = messages;
  mCopyState->m_curCopyIndex = 0;
  mCopyState->m_isMove = isMove;
  mCopyState->m_isFolder = isFolder;
  mCopyState->m_allowUndo = allowUndo;
  mCopyState->m_msgWindow = msgWindow;
  rv = messages->GetLength(&mCopyState->m_totalMsgCount);
  if (listener)
    mCopyState->m_listener = do_QueryInterface(listener, &rv);
  mCopyState->m_copyingMultipleMessages = PR_FALSE;
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator)
{
  if (mCopyState)
    mCopyState->m_destDB = nsnull;
  return nsMsgDBFolder::OnAnnouncerGoingAway(instigator);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnCopyCompleted(nsISupports *srcSupport, PRBool moveCopySucceeded)
{
  if (mCopyState && mCopyState->m_notifyFolderLoaded)
    NotifyFolderEvent(mFolderLoadedAtom);

  (void) RefreshSizeOnDisk();
  // we are the destination folder for a move/copy
  PRBool haveSemaphore;
  nsresult rv = TestSemaphore(static_cast<nsIMsgLocalMailFolder*>(this), &haveSemaphore);
  if (NS_SUCCEEDED(rv) && haveSemaphore)
    ReleaseSemaphore(static_cast<nsIMsgLocalMailFolder*>(this));

  if (mCopyState && !mCopyState->m_newMsgKeywords.IsEmpty() && mCopyState->newHdr)
  {
    nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
    NS_ENSURE_TRUE(messageArray, rv);
    messageArray->AppendElement(mCopyState->newHdr, PR_FALSE);
    AddKeywordsToMessages(messageArray, mCopyState->m_newMsgKeywords);
  }
  if (moveCopySucceeded && mDatabase)
  {
    mDatabase->SetSummaryValid(PR_TRUE);
    (void) CloseDBIfFolderNotOpen();
  }

  delete mCopyState;
  mCopyState = nsnull;
  nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return copyService->NotifyCompletion(srcSupport, this, moveCopySucceeded ? NS_OK : NS_ERROR_FAILURE);
}

nsresult
nsMsgLocalMailFolder::SortMessagesBasedOnKey(nsTArray<nsMsgKey> &aKeyArray, nsIMsgFolder *srcFolder, nsIMutableArray* messages)
{
  nsresult rv = NS_OK;
  PRUint32 numMessages = aKeyArray.Length();

  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsCOMPtr<nsIDBFolderInfo> folderInfo;
  nsCOMPtr<nsIMsgDatabase> db;
  rv = srcFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(db));
  if (NS_SUCCEEDED(rv) && db)
    for (PRUint32 i=0;i < numMessages; i++)
    {
      rv = db->GetMsgHdrForKey(aKeyArray[i], getter_AddRefs(msgHdr));
      NS_ENSURE_SUCCESS(rv,rv);
      if (msgHdr)
        messages->AppendElement(msgHdr, PR_FALSE);
    }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CopyMessages(nsIMsgFolder* srcFolder, nsIArray*
                                   messages, PRBool isMove,
                                   nsIMsgWindow *msgWindow,
                                   nsIMsgCopyServiceListener* listener,
                                   PRBool isFolder, PRBool allowUndo)
{
  nsCOMPtr<nsISupports> srcSupport = do_QueryInterface(srcFolder);
  PRBool isServer;
  nsresult rv = GetIsServer(&isServer);
  if (NS_SUCCEEDED(rv) && isServer)
  {
    NS_ASSERTION(0, "Destination is the root folder. Cannot move/copy here");
    if (isMove)
      srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
    return OnCopyCompleted(srcSupport, PR_FALSE);
  }

  PRBool mailboxTooLarge;

  (void) WarnIfLocalFileTooBig(msgWindow, &mailboxTooLarge);
  if (mailboxTooLarge)
  {
    if (isMove)
      srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
    return OnCopyCompleted(srcSupport, PR_FALSE);
  }

  if (!(mFlags & (nsMsgFolderFlags::Trash|nsMsgFolderFlags::Junk)))
    SetMRUTime();

  nsCString protocolType;
  rv = srcFolder->GetURI(protocolType);
  protocolType.SetLength(protocolType.FindChar(':'));

  if (WeAreOffline() && (protocolType.LowerCaseEqualsLiteral("imap") || protocolType.LowerCaseEqualsLiteral("news")))
  {
    PRUint32 numMessages = 0;
    messages->GetLength(&numMessages);
    for (PRUint32 i = 0; i < numMessages; i++)
    {
      nsCOMPtr<nsIMsgDBHdr> message;
      messages->QueryElementAt(i, NS_GET_IID(nsIMsgDBHdr),(void **)getter_AddRefs(message));
      if(NS_SUCCEEDED(rv) && message)
      {
        nsMsgKey key;
        PRBool hasMsgOffline = PR_FALSE;
        message->GetMessageKey(&key);
        srcFolder->HasMsgOffline(key, &hasMsgOffline);
        if (!hasMsgOffline)
        {
          if (isMove)
            srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
          ThrowAlertMsg("cantMoveMsgWOBodyOffline", msgWindow);
          return OnCopyCompleted(srcSupport, PR_FALSE);
        }
      }
    }
  }

  // don't update the counts in the dest folder until it is all over
  EnableNotifications(allMessageCountNotifications, PR_FALSE, PR_FALSE /*dbBatching*/);  //dest folder doesn't need db batching

  // sort the message array by key
  PRUint32 numMsgs = 0;
  messages->GetLength(&numMsgs);
  nsTArray<nsMsgKey> keyArray(numMsgs);
  if (numMsgs > 1)
  {
    for (PRUint32 i = 0; i < numMsgs; i++)
    {
      nsCOMPtr<nsIMsgDBHdr> aMessage = do_QueryElementAt(messages, i, &rv);
      if(NS_SUCCEEDED(rv) && aMessage)
      {
        nsMsgKey key;
        aMessage->GetMessageKey(&key);
        keyArray.AppendElement(key);
      }
    }

    keyArray.Sort();

    nsCOMPtr<nsIMutableArray> sortedMsgs(do_CreateInstance(NS_ARRAY_CONTRACTID));
    rv = SortMessagesBasedOnKey(keyArray, srcFolder, sortedMsgs);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = InitCopyState(srcSupport, sortedMsgs, isMove, listener, msgWindow, isFolder, allowUndo);
  }
  else
    rv = InitCopyState(srcSupport, messages, isMove, listener, msgWindow, isFolder, allowUndo);

  if (NS_FAILED(rv))
  {
    ThrowAlertMsg("operationFailedFolderBusy", msgWindow);
    (void) OnCopyCompleted(srcSupport, PR_FALSE);
    return rv;
  }

  if (!protocolType.LowerCaseEqualsLiteral("mailbox"))
  {
    mCopyState->m_dummyEnvelopeNeeded = PR_TRUE;
    nsParseMailMessageState* parseMsgState = new nsParseMailMessageState();
    if (parseMsgState)
    {
      nsCOMPtr<nsIMsgDatabase> msgDb;
      mCopyState->m_parseMsgState = do_QueryInterface(parseMsgState, &rv);
      GetDatabaseWOReparse(getter_AddRefs(msgDb));
      if (msgDb)
        parseMsgState->SetMailDB(msgDb);
    }
  }

  // undo stuff
  if (allowUndo)    //no undo for folder move/copy or or move/copy from search window
  {
    nsRefPtr<nsLocalMoveCopyMsgTxn> msgTxn = new nsLocalMoveCopyMsgTxn;
    if (msgTxn && NS_SUCCEEDED(msgTxn->Init(srcFolder, this, isMove)))
    {
      msgTxn->SetMsgWindow(msgWindow);
      if (isMove)
      {
        if (mFlags & nsMsgFolderFlags::Trash)
          msgTxn->SetTransactionType(nsIMessenger::eDeleteMsg);
        else
          msgTxn->SetTransactionType(nsIMessenger::eMoveMsg);
      }
      else
        msgTxn->SetTransactionType(nsIMessenger::eCopyMsg);
      msgTxn.swap(mCopyState->m_undoMsgTxn);
    }
  }

  if (numMsgs > 1 && ((protocolType.LowerCaseEqualsLiteral("imap") && !WeAreOffline()) || protocolType.LowerCaseEqualsLiteral("mailbox")))
  {
    mCopyState->m_copyingMultipleMessages = PR_TRUE;
    rv = CopyMessagesTo(mCopyState->m_messages, keyArray, msgWindow, this, isMove);
    if (NS_FAILED(rv))
    {
      NS_ERROR("copy message failed");
      (void) OnCopyCompleted(srcSupport, PR_FALSE);
    }
  }
  else
  {
    nsCOMPtr<nsISupports> msgSupport = do_QueryElementAt(mCopyState->m_messages, 0);
    if (msgSupport)
    {
      rv = CopyMessageTo(msgSupport, this, msgWindow, isMove);
      if (NS_FAILED(rv))
      {
        NS_ASSERTION(PR_FALSE, "copy message failed");
        (void) OnCopyCompleted(srcSupport, PR_FALSE);
      }
    }
  }
  // if this failed immediately, need to turn back on notifications and inform FE.
  if (NS_FAILED(rv))
  {
    if (isMove)
      srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
    EnableNotifications(allMessageCountNotifications, PR_TRUE, PR_FALSE /*dbBatching*/);  //dest folder doesn't need db batching
  }
  return rv;
}
// for srcFolder that are on different server than the dstFolder.
// "this" is the parent of the new dest folder.
nsresult
nsMsgLocalMailFolder::CopyFolderAcrossServer(nsIMsgFolder* srcFolder, nsIMsgWindow *msgWindow,
                  nsIMsgCopyServiceListener *listener )
{
  mInitialized = PR_TRUE;

  nsString folderName;
  srcFolder->GetName(folderName);

  nsresult rv = CreateSubfolder(folderName, msgWindow);
  if (NS_FAILED(rv)) return rv;

  nsCAutoString escapedFolderName;
  rv = NS_MsgEscapeEncodeURLPath(folderName, escapedFolderName);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIMsgFolder> newFolder;
  nsCOMPtr<nsIMsgFolder> newMsgFolder;

  rv = FindSubFolder(escapedFolderName, getter_AddRefs(newMsgFolder));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsISimpleEnumerator> messages;
  rv = srcFolder->GetMessages(msgWindow, getter_AddRefs(messages));

  nsCOMPtr<nsIMutableArray> msgArray(do_CreateInstance(NS_ARRAY_CONTRACTID));

  PRBool hasMoreElements;
  nsCOMPtr<nsISupports> aSupport;

  if (messages)
    messages->HasMoreElements(&hasMoreElements);

  while (hasMoreElements && NS_SUCCEEDED(rv))
  {
    rv = messages->GetNext(getter_AddRefs(aSupport));
    rv = msgArray->AppendElement(aSupport, PR_FALSE);
    messages->HasMoreElements(&hasMoreElements);
  }

  PRUint32 numMsgs=0;
  msgArray->GetLength(&numMsgs);

  if (numMsgs > 0 )   //if only srcFolder has messages..
    newMsgFolder->CopyMessages(srcFolder, msgArray, PR_FALSE, msgWindow, listener, PR_TRUE /* is folder*/, PR_FALSE /* allowUndo */);
  else
  {
    nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(newMsgFolder);
    if (localFolder)
    {
      // normally these would get called from ::EndCopy when the last message
      // was finished copying. But since there are no messages, we have to call
      // them explicitly.
      nsCOMPtr<nsISupports> srcSupports = do_QueryInterface(newMsgFolder);
      localFolder->CopyAllSubFolders(srcFolder, msgWindow, listener);
      return localFolder->OnCopyCompleted(srcSupports, PR_TRUE);
    }
  }
  return NS_OK;  // otherwise the front-end will say Exception::CopyFolder
}

nsresult    //copy the sub folders
nsMsgLocalMailFolder::CopyAllSubFolders(nsIMsgFolder *srcFolder,
                                      nsIMsgWindow *msgWindow,
                                      nsIMsgCopyServiceListener *listener )
{
  nsCOMPtr<nsISimpleEnumerator> enumerator;
  nsresult rv = srcFolder->GetSubFolders(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    nsCOMPtr<nsISupports> item;
    enumerator->GetNext(getter_AddRefs(item));

    nsCOMPtr<nsIMsgFolder> folder(do_QueryInterface(item));
    if (folder)
      CopyFolderAcrossServer(folder, msgWindow, listener);
  }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CopyFolder( nsIMsgFolder* srcFolder, PRBool isMoveFolder,
                                   nsIMsgWindow *msgWindow,
                                   nsIMsgCopyServiceListener* listener)
{
  NS_ENSURE_ARG_POINTER(srcFolder);
  // isMoveFolder == true when "this" and srcFolder are on same server
  return isMoveFolder ? CopyFolderLocal(srcFolder, isMoveFolder, msgWindow, listener ) :
                      CopyFolderAcrossServer(srcFolder, msgWindow, listener );
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CopyFolderLocal(nsIMsgFolder *srcFolder,
                                      PRBool isMoveFolder,
                                      nsIMsgWindow *msgWindow,
                                      nsIMsgCopyServiceListener *listener )
{
  nsresult rv;
  mInitialized = PR_TRUE;
  nsCOMPtr<nsIMsgFolder> newMsgFolder;
  PRBool isChildOfTrash;
  rv = IsChildOfTrash(&isChildOfTrash);
  if (NS_SUCCEEDED(rv) && isChildOfTrash)
  {
    // do it just for the parent folder (isMoveFolder is true for parent only) if we are deleting/moving a folder tree
    // don't confirm for rss folders.
    if (isMoveFolder)
    {
      // if there's a msgWindow, confirm the deletion
      if (msgWindow) 
      {

        PRBool okToDelete = PR_FALSE;
        ConfirmFolderDeletion(msgWindow, srcFolder, &okToDelete);
        if (!okToDelete)
          return NS_MSG_ERROR_COPY_FOLDER_ABORTED;
      }
      // if we are moving a favorite folder to trash, we should clear the favorites flag
      // so it gets removed from the view.
      srcFolder->ClearFlag(nsMsgFolderFlags::Favorite);
    }

    PRBool match = PR_FALSE;
    rv = srcFolder->MatchOrChangeFilterDestination(nsnull, PR_FALSE, &match);
    if (match && msgWindow)
    {
      PRBool confirmed = PR_FALSE;
      srcFolder->ConfirmFolderDeletionForFilter(msgWindow, &confirmed);
      if (!confirmed)
        return NS_MSG_ERROR_COPY_FOLDER_ABORTED;
    }
  }

  nsString folderName;
  srcFolder->GetName(folderName);
  nsAutoString safeFolderName(folderName);
  NS_MsgHashIfNecessary(safeFolderName);
  nsCOMPtr <nsIMsgLocalMailFolder> localSrcFolder(do_QueryInterface(srcFolder));
  nsCOMPtr <nsIMsgDatabase> srcDB;
  if (localSrcFolder)
    localSrcFolder->GetDatabaseWOReparse(getter_AddRefs(srcDB));
  PRBool summaryValid = (srcDB != nsnull);
  srcDB = nsnull;
  srcFolder->ForceDBClosed();

  nsCOMPtr<nsILocalFile> oldPath;
  rv = srcFolder->GetFilePath(getter_AddRefs(oldPath));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsILocalFile> summaryFile;
  GetSummaryFileLocation(oldPath, getter_AddRefs(summaryFile));

  nsCOMPtr<nsILocalFile> newPath;
  rv = GetFilePath(getter_AddRefs(newPath));
  NS_ENSURE_SUCCESS(rv,rv);

  PRBool newPathIsDirectory = PR_FALSE;
  newPath->IsDirectory(&newPathIsDirectory);
  if (!newPathIsDirectory)
  {
    AddDirectorySeparator(newPath);
    newPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
  }

  rv = CheckIfFolderExists(folderName, this, msgWindow);
  if(NS_FAILED(rv))
    return rv;

  nsCOMPtr <nsIFile> origPath;
  oldPath->Clone(getter_AddRefs(origPath));

  rv = oldPath->CopyTo(newPath, NS_LITERAL_STRING(""));   //copying necessary for aborting.... if failure return
  NS_ENSURE_SUCCESS(rv, rv);      //would fail if a file by that name exists

  // Copy to dir can fail if filespec does not exist. If copy fails, we test
  // if the filespec exist or not, if it does not that's ok, we continue
  // without copying it. If it fails and filespec exist and is not zero sized
  // there is real problem
  rv = summaryFile->CopyTo(newPath, NS_LITERAL_STRING(""));      // Copy the file to the new dir
  if (! NS_SUCCEEDED(rv))                   // Test if the copy is successfull
  {
    // Test if the filespec has data
    PRBool exists;
    PRInt64 fileSize;
    summaryFile->Exists(&exists);
    summaryFile->GetFileSize(&fileSize);
    if (exists && fileSize > 0)
      NS_ENSURE_SUCCESS(rv, rv);          // Yes, it should have worked !
    // else case is filespec is zero sized, no need to copy it,
    // not an error
    // else case is filespec does not exist - not an error
  }

  // linux and mac are not good about maintaining the file stamp when copying folders
  // around. So if the source folder db is good, set the dest db as good too.
  nsCOMPtr <nsIMsgDatabase> destDB;
  if (summaryValid)
  {
    nsAutoString folderLeafName;
    origPath->GetLeafName(folderLeafName);
    newPath->Append(folderLeafName);
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = msgDBService->OpenMailDBFromFile(newPath, PR_FALSE, PR_TRUE, getter_AddRefs(destDB));
    if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE && destDB)
      destDB->SetSummaryValid(PR_TRUE);
  }
  rv = AddSubfolder(safeFolderName, getter_AddRefs(newMsgFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  newMsgFolder->SetPrettyName(folderName);
  PRUint32 flags;
  srcFolder->GetFlags(&flags);
  newMsgFolder->SetFlags(flags);
  PRBool changed = PR_FALSE;
  rv = srcFolder->MatchOrChangeFilterDestination(newMsgFolder, PR_TRUE, &changed);
  if (changed)
    srcFolder->AlertFilterChanged(msgWindow);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = srcFolder->GetSubFolders(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  // Copy subfolders to the new location
  nsresult copyStatus = NS_OK;
  nsCOMPtr<nsIMsgLocalMailFolder> localNewFolder(do_QueryInterface(newMsgFolder, &rv));
  if (NS_SUCCEEDED(rv))
  {
    PRBool hasMore;
    while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore &&
           NS_SUCCEEDED(copyStatus))
    {
      nsCOMPtr<nsISupports> item;
      enumerator->GetNext(getter_AddRefs(item));

      nsCOMPtr<nsIMsgFolder> folder(do_QueryInterface(item));
      if (!folder)
        continue;

      // PR_FALSE needed to avoid un-necessary deletions
      copyStatus = localNewFolder->CopyFolderLocal(folder, PR_FALSE, msgWindow, listener);
      // Test if the call succeeded, if not we have to stop recursive call
      if (NS_FAILED(copyStatus))
      {
        // Copy failed we have to notify caller to handle the error and stop
        // moving the folders. In case this happens to the topmost level of
        // recursive call, then we just need to break from the while loop and
        // go to error handling code.
        if (!isMoveFolder)
          return copyStatus;
        break;
      }
    }
  }

  if (isMoveFolder && NS_SUCCEEDED(copyStatus))
  {
    if (localNewFolder)
    {
      nsCOMPtr<nsISupports> srcSupport(do_QueryInterface(srcFolder));
      localNewFolder->OnCopyCompleted(srcSupport, PR_TRUE);
    }

    //notifying the "folder" that was dragged and dropped has been created.
    //no need to do this for its subfolders - isMoveFolder will be true for "folder"
    NotifyItemAdded(newMsgFolder);

    nsCOMPtr<nsIMsgFolder> msgParent;
    srcFolder->GetParentMsgFolder(getter_AddRefs(msgParent));
    srcFolder->SetParent(nsnull);
    if (msgParent)
    {
      msgParent->PropagateDelete(srcFolder, PR_FALSE, msgWindow);  // The files have already been moved, so delete storage PR_FALSE
      oldPath->Remove(PR_FALSE);  //berkeley mailbox
      nsCOMPtr <nsIMsgDatabase> srcDB; // we need to force closed the source db
      srcFolder->Delete();

      nsCOMPtr<nsILocalFile> parentPath;
      rv = msgParent->GetFilePath(getter_AddRefs(parentPath));
      NS_ENSURE_SUCCESS(rv,rv);

      AddDirectorySeparator(parentPath);
      nsCOMPtr <nsISimpleEnumerator> children;
      parentPath->GetDirectoryEntries(getter_AddRefs(children));
      PRBool more;
      // checks if the directory is empty or not
      if (children && NS_SUCCEEDED(children->HasMoreElements(&more)) && !more)
        parentPath->Remove(PR_TRUE);
    }
  }
  else
  {
    // This is the case where the copy of a subfolder failed.
    // We have to delete the newDirectory tree to make a "rollback".
    // Someone should add a popup to warn the user that the move was not
    // possible.
    if (isMoveFolder && NS_FAILED(copyStatus))
    {
      nsCOMPtr<nsIMsgFolder> msgParent;
      newMsgFolder->ForceDBClosed();
      newMsgFolder->GetParentMsgFolder(getter_AddRefs(msgParent));
      newMsgFolder->SetParent(nsnull);
      if (msgParent)
      {
        msgParent->PropagateDelete(newMsgFolder, PR_FALSE, msgWindow);
        newMsgFolder->Delete();
        newMsgFolder->ForceDBClosed();
        AddDirectorySeparator(newPath);
        newPath->Remove(PR_TRUE);  //berkeley mailbox
      }
      return NS_ERROR_FAILURE;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CopyFileMessage(nsIFile* aFile, 
                                      nsIMsgDBHdr *msgToReplace,
                                      PRBool isDraftOrTemplate,
                                      PRUint32 newMsgFlags,
                                      const nsACString &aNewMsgKeywords,
                                      nsIMsgWindow *msgWindow,
                                      nsIMsgCopyServiceListener* listener)
{
  nsresult rv = NS_ERROR_NULL_POINTER;
  nsParseMailMessageState* parseMsgState = nsnull;
  PRUint32 fileSize = 0;
  nsCOMPtr<nsISupports> fileSupport(do_QueryInterface(aFile, &rv));

  nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID));

  if (msgToReplace)
    messages->AppendElement(msgToReplace, PR_FALSE);

  rv = InitCopyState(fileSupport, messages, msgToReplace ? PR_TRUE : PR_FALSE,
                     listener, msgWindow, PR_FALSE, PR_FALSE);
  if (NS_SUCCEEDED(rv))
  {
    if (mCopyState)
      mCopyState->m_newMsgKeywords = aNewMsgKeywords;

    parseMsgState = new nsParseMailMessageState();
    if (parseMsgState)
    {
      nsCOMPtr<nsIMsgDatabase> msgDb;
      mCopyState->m_parseMsgState = do_QueryInterface(parseMsgState, &rv);
      GetDatabaseWOReparse(getter_AddRefs(msgDb));
      if (msgDb)
        parseMsgState->SetMailDB(msgDb);
    }

    nsCOMPtr<nsIInputStream> inputStream;
    rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), aFile);
    if (NS_SUCCEEDED(rv) && inputStream) 
      rv = inputStream->Available(&fileSize);

    if (NS_SUCCEEDED(rv))
      rv = BeginCopy(nsnull);

    if (NS_SUCCEEDED(rv))
      rv = CopyData(inputStream, (PRInt32) fileSize);

    if (NS_SUCCEEDED(rv))
      rv = EndCopy(PR_TRUE);

    //mDatabase should have been initialized above - if we got msgDb
    if (NS_SUCCEEDED(rv) && msgToReplace && mDatabase)
      rv = DeleteMessage(msgToReplace, msgWindow, PR_TRUE, PR_TRUE);

    if (inputStream)
      inputStream->Close();
  }

  if(NS_FAILED(rv))
    (void) OnCopyCompleted(fileSupport, PR_FALSE);

  return rv;
}

nsresult nsMsgLocalMailFolder::DeleteMessage(nsISupports *message,
                                             nsIMsgWindow *msgWindow,
                                             PRBool deleteStorage, PRBool commit)
{
  nsresult rv = NS_OK;
  if (deleteStorage)
  {
    nsCOMPtr <nsIMsgDBHdr> msgDBHdr(do_QueryInterface(message, &rv));

    if(NS_SUCCEEDED(rv))
      rv = mDatabase->DeleteHeader(msgDBHdr, nsnull, commit, PR_TRUE);
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetNewMessages(nsIMsgWindow *aWindow, nsIUrlListener *aListener)
{
  nsCOMPtr<nsIMsgIncomingServer> server;
  nsresult rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

  nsCOMPtr<nsILocalMailIncomingServer> localMailServer = do_QueryInterface(server, &rv);
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

  // XXX todo, move all this into nsILocalMailIncomingServer's GetNewMail
  // so that we don't have to have RSS foo here.
  nsCOMPtr<nsIRssIncomingServer> rssServer = do_QueryInterface(server, &rv);
  if (NS_SUCCEEDED(rv))
    return localMailServer->GetNewMail(aWindow, aListener, this, nsnull);

  nsCOMPtr<nsIMsgFolder> inbox;
  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = server->GetRootMsgFolder(getter_AddRefs(rootFolder));
  if(NS_SUCCEEDED(rv) && rootFolder)
  {
    rootFolder->GetFolderWithFlags(nsMsgFolderFlags::Inbox, getter_AddRefs(inbox));
  }
  nsCOMPtr<nsIMsgLocalMailFolder> localInbox = do_QueryInterface(inbox, &rv);
  if (NS_SUCCEEDED(rv))
  {
    PRBool valid = PR_FALSE;
    nsCOMPtr <nsIMsgDatabase> db;
    // this will kick off a reparse if the db is out of date.
    rv = localInbox->GetDatabaseWithReparse(nsnull, aWindow, getter_AddRefs(db));
    if (NS_SUCCEEDED(rv))
    {
      db->GetSummaryValid(&valid);
      rv = valid ? localMailServer->GetNewMail(aWindow, aListener, inbox, nsnull) :
                   localInbox->SetCheckForNewMessagesAfterParsing(PR_TRUE);
    }
  }
  return rv;
}

nsresult nsMsgLocalMailFolder::WriteStartOfNewMessage()
{
  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream);
  PRInt64 filePos;
  seekableStream->Tell(&filePos);
  mCopyState->m_curDstKey =(PRUint32) filePos;

  // CopyFileMessage() and CopyMessages() from servers other than pop3
  if (mCopyState->m_parseMsgState)
  {
    mCopyState->m_parseMsgState->SetEnvelopePos(mCopyState->m_curDstKey);
    mCopyState->m_parseMsgState->SetState(nsIMsgParseMailMsgState::ParseHeadersState);
  }
  if (mCopyState->m_dummyEnvelopeNeeded)
  {
    nsCString result;
    nsCAutoString nowStr;
    MsgGenerateNowStr(nowStr);
    result.AppendLiteral("From - ");
    result.Append(nowStr);
    result.Append(MSG_LINEBREAK);

    // *** jt - hard code status line for now; come back later
    nsresult rv;
    nsCOMPtr <nsIMsgDBHdr> curSourceMessage = do_QueryElementAt(mCopyState->m_messages,
                                                                mCopyState->m_curCopyIndex, &rv);

    char statusStrBuf[50];
    if (curSourceMessage)
    {
      PRUint32 dbFlags = 0;
      curSourceMessage->GetFlags(&dbFlags);

      // write out x-mozilla-status, but make sure we don't write out MSG_FLAG_OFFLINE
      PR_snprintf(statusStrBuf, sizeof(statusStrBuf), X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK,
        dbFlags & ~(MSG_FLAG_RUNTIME_ONLY | MSG_FLAG_OFFLINE) & 0x0000FFFF);
    }
    else
      strcpy(statusStrBuf, "X-Mozilla-Status: 0001" MSG_LINEBREAK);
    PRUint32 bytesWritten;
    mCopyState->m_fileStream->Write(result.get(), result.Length(), &bytesWritten);
    if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(
          result.get(), result.Length());
    mCopyState->m_fileStream->Write(statusStrBuf, strlen(statusStrBuf), &bytesWritten);
    if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(
        statusStrBuf, strlen(statusStrBuf));
    result = "X-Mozilla-Status2: 00000000" MSG_LINEBREAK;
    mCopyState->m_fileStream->Write(result.get(), result.Length(), &bytesWritten);
    if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(
          result.get(), result.Length());
    mCopyState->m_fromLineSeen = PR_TRUE;
  }
  else
    mCopyState->m_fromLineSeen = PR_FALSE;

  mCopyState->m_curCopyIndex++;
  return NS_OK;
}

//nsICopyMessageListener
NS_IMETHODIMP nsMsgLocalMailFolder::BeginCopy(nsIMsgDBHdr *message)
{
  if (!mCopyState)
    return NS_ERROR_NULL_POINTER;

  nsresult rv;
  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);

  PRInt32 messageIndex = (mCopyState->m_copyingMultipleMessages) ? mCopyState->m_curCopyIndex - 1 : mCopyState->m_curCopyIndex;
  NS_ASSERTION(!mCopyState->m_copyingMultipleMessages || mCopyState->m_curCopyIndex >= 0, "mCopyState->m_curCopyIndex invalid");
  // by the time we get here, m_curCopyIndex is 1 relative because WriteStartOfNewMessage increments it
  mCopyState->m_messages->QueryElementAt(messageIndex, NS_GET_IID(nsIMsgDBHdr),
                                  (void **)getter_AddRefs(mCopyState->m_message));

  DisplayMoveCopyStatusMsg();
  // if we're copying more than one message, StartMessage will handle this.
  return !mCopyState->m_copyingMultipleMessages ? WriteStartOfNewMessage() : rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::CopyData(nsIInputStream *aIStream, PRInt32 aLength)
{
  //check to make sure we have control of the write.
  PRBool haveSemaphore;
  nsresult rv = NS_OK;

  rv = TestSemaphore(static_cast<nsIMsgLocalMailFolder*>(this), &haveSemaphore);
  if(NS_FAILED(rv))
    return rv;
  if(!haveSemaphore)
    return NS_MSG_FOLDER_BUSY;

  if (!mCopyState)
    return NS_ERROR_OUT_OF_MEMORY;

  PRUint32 readCount;
  //allocate one extra byte for '\0' at the end and another extra byte at the
  //front to insert a '>' if we have a "From" line
  if ( aLength + mCopyState->m_leftOver + 2 > mCopyState->m_dataBufferSize )
  {
    char *newBuffer = (char *) PR_REALLOC(mCopyState->m_dataBuffer, aLength + mCopyState->m_leftOver + 2);
    if (!newBuffer)
      return NS_ERROR_OUT_OF_MEMORY;
    mCopyState->m_dataBuffer = newBuffer;
    mCopyState->m_dataBufferSize = aLength + mCopyState->m_leftOver + 1;
  }

  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);

  rv = aIStream->Read(mCopyState->m_dataBuffer + mCopyState->m_leftOver + 1, aLength, &readCount);
  NS_ENSURE_SUCCESS(rv, rv);
  mCopyState->m_leftOver += readCount;
  mCopyState->m_dataBuffer[mCopyState->m_leftOver + 1] ='\0';
  char *start = mCopyState->m_dataBuffer + 1;
  char *endBuffer = mCopyState->m_dataBuffer + mCopyState->m_leftOver + 1;

  PRInt32 lineLength;
  PRUint32 bytesWritten;

  while (1)
  {
    char *end = PL_strnpbrk(start, "\r\n", endBuffer - start);
    if (!end)
    {
      mCopyState->m_leftOver -= (start - mCopyState->m_dataBuffer - 1);
      memmove (mCopyState->m_dataBuffer + 1, start, mCopyState->m_leftOver);
      break;
    }

    //need to set the linebreak_len each time
    PRUint32 linebreak_len = 1; //assume CR or LF
    if (*end == '\r' && *(end+1) == '\n')
      linebreak_len = 2;  //CRLF

    if (!mCopyState->m_fromLineSeen)
    {
      mCopyState->m_fromLineSeen = PR_TRUE;
      NS_ASSERTION(strncmp(start, "From ", 5) == 0,
        "Fatal ... bad message format\n");
    }
    else if (strncmp(start, "From ", 5) == 0)
    {
      //if we're at the beginning of the buffer, we've reserved a byte to
      //insert a '>'.  If we're in the middle, we're overwriting the previous
      //line ending, but we've already written it to m_fileStream, so it's OK.
      *--start = '>';
    }

    lineLength = end - start + linebreak_len;
    rv = mCopyState->m_fileStream->Write(start, lineLength, &bytesWritten);
    if (bytesWritten != lineLength || NS_FAILED(rv))
    {
      ThrowAlertMsg("copyMsgWriteFailed", mCopyState->m_msgWindow);
      mCopyState->m_writeFailed = PR_TRUE;
      return NS_MSG_ERROR_WRITING_MAIL_FOLDER;
    }

    if (mCopyState->m_parseMsgState)
      mCopyState->m_parseMsgState->ParseAFolderLine(start, lineLength);

    start = end + linebreak_len;
    if (start >= endBuffer)
    {
      mCopyState->m_leftOver = 0;
      break;
    }
  }
  return rv;
}

void nsMsgLocalMailFolder::CopyPropertiesToMsgHdr(nsIMsgDBHdr *destHdr, nsIMsgDBHdr *srcHdr)
{
  nsCString sourceString;
  srcHdr->GetStringProperty("junkscore", getter_Copies(sourceString));
  destHdr->SetStringProperty("junkscore", sourceString.get());
  srcHdr->GetStringProperty("junkscoreorigin", getter_Copies(sourceString));
  destHdr->SetStringProperty("junkscoreorigin", sourceString.get());
  srcHdr->GetStringProperty("junkpercent", getter_Copies(sourceString));
  destHdr->SetStringProperty("junkpercent", sourceString.get());
  srcHdr->GetStringProperty("keywords", getter_Copies(sourceString));
  destHdr->SetStringProperty("keywords", sourceString.get());

  nsMsgLabelValue label = 0;
  srcHdr->GetLabel(&label);
  destHdr->SetLabel(label);
}

NS_IMETHODIMP nsMsgLocalMailFolder::EndCopy(PRBool copySucceeded)
{
  // we are the destination folder for a move/copy
  nsresult rv = copySucceeded ? NS_OK : NS_ERROR_FAILURE;
  if (!mCopyState) return NS_OK;
  if (!copySucceeded || mCopyState->m_writeFailed)
  {
    if (mCopyState->m_fileStream)
      mCopyState->m_fileStream->Close();

    nsCOMPtr <nsILocalFile> pathFile;
    rv = GetFilePath(getter_AddRefs(pathFile));

    if (NS_SUCCEEDED(rv) && pathFile && mCopyState->m_curDstKey != nsMsgKey_None)
      pathFile->SetFileSize(mCopyState->m_curDstKey);

    if (!mCopyState->m_isMove)
    {
      // passing PR_TRUE because the messages that have been successfully 
      // copied have their corresponding hdrs in place. The message that has 
      // failed has been truncated so the msf file and berkeley mailbox 
      // are in sync.
      (void) OnCopyCompleted(mCopyState->m_srcSupport, PR_TRUE);
      // enable the dest folder
      EnableNotifications(allMessageCountNotifications, PR_TRUE, PR_FALSE /*dbBatching*/); //dest folder doesn't need db batching
    }
    return NS_OK;
  }

  PRBool multipleCopiesFinished = (mCopyState->m_curCopyIndex >= mCopyState->m_totalMsgCount);

  nsRefPtr<nsLocalMoveCopyMsgTxn> localUndoTxn = mCopyState->m_undoMsgTxn;

  nsCOMPtr <nsISeekableStream> seekableStream;
  if (mCopyState)
  {
    NS_ASSERTION(mCopyState->m_leftOver == 0, "whoops, something wrong with previous copy");
    mCopyState->m_leftOver = 0; // reset to 0.
    // need to reset this in case we're move/copying multiple msgs.
    mCopyState->m_fromLineSeen = PR_FALSE;
    // flush the copied message.
    if (mCopyState->m_fileStream)
    {
      seekableStream = do_QueryInterface(mCopyState->m_fileStream);
      seekableStream->Seek(nsISeekableStream::NS_SEEK_CUR, 0); // seeking causes a flush, w/o syncing
    }
  }
  //Copy the header to the new database
  if (copySucceeded && mCopyState->m_message)
  {
    //  CopyMessages() goes here; CopyFileMessage() never gets in here because
    //  the mCopyState->m_message will be always null for file message
    nsCOMPtr<nsIMsgDBHdr> newHdr;
    if(!mCopyState->m_parseMsgState)
    {
      if(mCopyState->m_destDB)
      {
        rv = mCopyState->m_destDB->CopyHdrFromExistingHdr(mCopyState->m_curDstKey,
          mCopyState->m_message, PR_TRUE,
          getter_AddRefs(newHdr));
        PRUint32 newHdrFlags;
        // turn off offline flag - it's not valid for local mail folders.
        if (newHdr)
          newHdr->AndFlags(~MSG_FLAG_OFFLINE, &newHdrFlags);
      }
      // we can do undo with the dest folder db, see bug #198909
      //else
      //  mCopyState->m_undoMsgTxn = nsnull; //null out the transaction because we can't undo w/o the msg db
    }

    // if we plan on allowing undo, (if we have a mCopyState->m_parseMsgState or not)
    // we need to save the source and dest keys on the undo txn.
    // see bug #179856 for details
    PRBool isImap;
    if (NS_SUCCEEDED(rv) && localUndoTxn) {
      localUndoTxn->GetSrcIsImap(&isImap);
      if (!isImap || !mCopyState->m_copyingMultipleMessages)
      {
        nsMsgKey aKey;
        PRUint32 statusOffset;
        mCopyState->m_message->GetMessageKey(&aKey);
        mCopyState->m_message->GetStatusOffset(&statusOffset);
        localUndoTxn->AddSrcKey(aKey);
        localUndoTxn->AddSrcStatusOffset(statusOffset);
        localUndoTxn->AddDstKey(mCopyState->m_curDstKey);
      }
    }
  }
  if (mCopyState->m_dummyEnvelopeNeeded)
  {
    PRUint32 bytesWritten;
    seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);
    mCopyState->m_fileStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &bytesWritten);
    if (mCopyState->m_parseMsgState)
      mCopyState->m_parseMsgState->ParseAFolderLine(CRLF, MSG_LINEBREAK_LEN);
  }

  nsCOMPtr<nsIMsgDBHdr> newHdr;
  // CopyFileMessage() and CopyMessages() from servers other than mailbox
  if (mCopyState->m_parseMsgState)
  {
    nsCOMPtr<nsIMsgDatabase> msgDb;
    mCopyState->m_parseMsgState->FinishHeader();
    GetDatabaseWOReparse(getter_AddRefs(msgDb));
    if (msgDb)
    {
      nsresult result = mCopyState->m_parseMsgState->GetNewMsgHdr(getter_AddRefs(newHdr));
      // we need to copy newHdr because mCopyState will get cleared 
      // in OnCopyCompleted, but we need OnCopyCompleted to know about
      // the newHdr, via mCopyState. And we send a notification about newHdr
      // after OnCopyCompleted.
      mCopyState->newHdr = newHdr;
      if (NS_SUCCEEDED(result) && newHdr)
      {
        // need to copy junk score and label from mCopyState->m_message to newHdr.
        if (mCopyState->m_message)
        {
          // deal with propagating the new flag on an imap to local folder filter action
          PRUint32 msgFlags;
          mCopyState->m_message->GetFlags(&msgFlags);
          if (!(msgFlags & MSG_FLAG_READ))
          {
            nsCOMPtr <nsIMsgFolder> srcFolder;
            mCopyState->m_message->GetFolder(getter_AddRefs(srcFolder));
            if (srcFolder)
            {
              PRUint32 folderFlags;
              srcFolder->GetFlags(&folderFlags);
              // check if the src folder is an imap inbox.
              if ((folderFlags & (nsMsgFolderFlags::Inbox|nsMsgFolderFlags::ImapBox))
                            == (nsMsgFolderFlags::Inbox|nsMsgFolderFlags::ImapBox))
              {
                nsCOMPtr <nsIMsgDatabase> db;
                srcFolder->GetMsgDatabase(nsnull, getter_AddRefs(db));
                if (db)
                {
                  nsMsgKey srcKey;
                  PRBool containsKey;
                  mCopyState->m_message->GetMessageKey(&srcKey);
                  db->ContainsKey(srcKey, &containsKey);
                  // if the db doesn't have the key, it must be a filtered imap
                  // message, getting moved to a local folder.
                  if (!containsKey)
                    newHdr->OrFlags(MSG_FLAG_NEW, &msgFlags);
                }
              }
            }
          }
          CopyPropertiesToMsgHdr(newHdr, mCopyState->m_message);
        }
        msgDb->AddNewHdrToDB(newHdr, PR_TRUE);
        if (localUndoTxn)
        {
          // ** jt - recording the message size for possible undo use; the
          // message size is different for pop3 and imap4 messages
          PRUint32 msgSize;
          newHdr->GetMessageSize(&msgSize);
          localUndoTxn->AddDstMsgSize(msgSize);
        }
      }
      // msgDb->SetSummaryValid(PR_TRUE);
      // msgDb->Commit(nsMsgDBCommitType::kLargeCommit);
    }
    else
      mCopyState->m_undoMsgTxn = nsnull; //null out the transaction because we can't undo w/o the msg db

    mCopyState->m_parseMsgState->Clear();
    if (mCopyState->m_listener) // CopyFileMessage() only
      mCopyState->m_listener->SetMessageKey((PRUint32) mCopyState->m_curDstKey);
  }

  if (!multipleCopiesFinished && !mCopyState->m_copyingMultipleMessages)
  {
    // CopyMessages() goes here; CopyFileMessage() never gets in here because
    // curCopyIndex will always be less than the mCopyState->m_totalMsgCount
    nsCOMPtr<nsISupports> aSupport = do_QueryElementAt(mCopyState->m_messages, mCopyState->m_curCopyIndex);
    rv = CopyMessageTo(aSupport, this, mCopyState->m_msgWindow, mCopyState->m_isMove);
  }
  else
  {
    // If we have some headers, then there is a source, so notify itemMoveCopyCompleted.
    // If we don't have any headers already, (eg save as draft, send) then notify itemAdded.
    // This notification is done after the messages are deleted, so that saving a new draft
    // of a message works correctly -- first an itemDeleted is sent for the old draft, then
    // an itemAdded for the new draft.
    PRUint32 numHdrs;
    mCopyState->m_messages->GetLength(&numHdrs);

    if (multipleCopiesFinished && numHdrs && !mCopyState->m_isFolder)
    {
      // we need to send this notification before we delete the source messages,
      // because deleting the source messages clears out the src msg db hdr.
      nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
        notifier->NotifyMsgsMoveCopyCompleted(mCopyState->m_isMove, mCopyState->m_messages, this);
    }

    if(!mCopyState->m_isMove)
    {
      if (multipleCopiesFinished)
      {
        nsCOMPtr<nsIMsgFolder> srcFolder;
        srcFolder = do_QueryInterface(mCopyState->m_srcSupport);
        if (mCopyState->m_isFolder)
          CopyAllSubFolders(srcFolder, nsnull, nsnull);  //Copy all subfolders then notify completion

        if (mCopyState->m_msgWindow && mCopyState->m_undoMsgTxn)
        {
          nsCOMPtr<nsITransactionManager> txnMgr;
          mCopyState->m_msgWindow->GetTransactionManager(getter_AddRefs(txnMgr));
          if (txnMgr)
            txnMgr->DoTransaction(mCopyState->m_undoMsgTxn);
        }
        if (srcFolder && !mCopyState->m_isFolder)
          srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgCompletedAtom);

        (void) OnCopyCompleted(mCopyState->m_srcSupport, PR_TRUE);
        // enable the dest folder
        EnableNotifications(allMessageCountNotifications, PR_TRUE, PR_FALSE /*dbBatching*/); //dest folder doesn't need db batching
      }
    }
    // Send the itemAdded notification in case we didn't send the itemMoveCopyCompleted notification earlier.
    // Posting news messages involves this, yet doesn't have the newHdr initialized, so don't send any
    // notifications in that case.
    if (!numHdrs && newHdr)
    {
      nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
        notifier->NotifyMsgAdded(newHdr);
    }
  }
  return rv;
}

static PRBool gGotGlobalPrefs;
static PRBool gDeleteFromServerOnMove;

PRBool nsMsgLocalMailFolder::GetDeleteFromServerOnMove()
{
  if (!gGotGlobalPrefs)
  {
    nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
    if (pPrefBranch)
    {
      pPrefBranch->GetBoolPref("mail.pop3.deleteFromServerOnMove", &gDeleteFromServerOnMove);
      gGotGlobalPrefs = PR_TRUE;
    }
  }
  return gDeleteFromServerOnMove;
}

NS_IMETHODIMP nsMsgLocalMailFolder::EndMove(PRBool moveSucceeded)
{
  nsresult rv;
  if (!mCopyState)
    return NS_OK;

  if (!moveSucceeded || mCopyState->m_writeFailed)
  {
    //Notify that a completion finished.
    nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryInterface(mCopyState->m_srcSupport, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);

    /* passing PR_TRUE because the messages that have been successfully copied have their corressponding
               hdrs in place. The message that has failed has been truncated so the msf file and berkeley mailbox
               are in sync*/

    (void) OnCopyCompleted(mCopyState->m_srcSupport, PR_TRUE);
    // enable the dest folder
    EnableNotifications(allMessageCountNotifications, PR_TRUE, PR_FALSE /*dbBatching*/ );  //dest folder doesn't need db batching
    return NS_OK;
  }

  if (mCopyState && mCopyState->m_curCopyIndex >= mCopyState->m_totalMsgCount)
  {
    //Notify that a completion finished.
    nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryInterface(mCopyState->m_srcSupport, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIMsgLocalMailFolder> localSrcFolder = do_QueryInterface(srcFolder);
    if (localSrcFolder)
    {
      // if we are the trash and a local msg is being moved to us, mark the source
      // for delete from server, if so configured.
      if (mFlags & nsMsgFolderFlags::Trash)
      {
        // if we're deleting on all moves, we'll mark this message for deletion when
        // we call DeleteMessages on the source folder. So don't mark it for deletion
        // here, in that case.
        if (!GetDeleteFromServerOnMove())
          localSrcFolder->MarkMsgsOnPop3Server(mCopyState->m_messages, POP3_DELETE);
      }
    }
    // lets delete these all at once - much faster that way
    rv = srcFolder->DeleteMessages(mCopyState->m_messages, mCopyState->m_msgWindow, PR_TRUE, PR_TRUE, nsnull, mCopyState->m_allowUndo);
    srcFolder->NotifyFolderEvent(NS_SUCCEEDED(rv) ? mDeleteOrMoveMsgCompletedAtom : mDeleteOrMoveMsgFailedAtom);
    AutoCompact(mCopyState->m_msgWindow);

    // enable the dest folder
    EnableNotifications(allMessageCountNotifications, PR_TRUE, PR_FALSE /*dbBatching*/); //dest folder doesn't need db batching

    if (NS_SUCCEEDED(rv) && mCopyState->m_msgWindow && mCopyState->m_undoMsgTxn)
    {
      nsCOMPtr<nsITransactionManager> txnMgr;
      mCopyState->m_msgWindow->GetTransactionManager(getter_AddRefs(txnMgr));
      if (txnMgr)
        txnMgr->DoTransaction(mCopyState->m_undoMsgTxn);
    }
    (void) OnCopyCompleted(mCopyState->m_srcSupport, NS_SUCCEEDED(rv) ? PR_TRUE : PR_FALSE);  //clear the copy state so that the next message from a different folder can be move
  }

  return NS_OK;

}

// this is the beginning of the next message copied
NS_IMETHODIMP nsMsgLocalMailFolder::StartMessage()
{
  return WriteStartOfNewMessage();
}

// just finished the current message.
NS_IMETHODIMP nsMsgLocalMailFolder::EndMessage(nsMsgKey key)
{
  nsRefPtr<nsLocalMoveCopyMsgTxn> localUndoTxn = mCopyState->m_undoMsgTxn;
  nsCOMPtr<nsIMsgWindow> msgWindow;
  nsresult rv;

  if (localUndoTxn)
  {
    localUndoTxn->GetMsgWindow(getter_AddRefs(msgWindow));
    localUndoTxn->AddSrcKey(key);
    localUndoTxn->AddDstKey(mCopyState->m_curDstKey);
  }

  // I think this is always true for online to offline copy
  mCopyState->m_dummyEnvelopeNeeded = PR_TRUE;
  if (mCopyState->m_dummyEnvelopeNeeded)
  {
    nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream, &rv);
    seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);
    PRUint32 bytesWritten;
     mCopyState->m_fileStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &bytesWritten);
    if (mCopyState->m_parseMsgState)
      mCopyState->m_parseMsgState->ParseAFolderLine(CRLF, MSG_LINEBREAK_LEN);
  }

  // CopyFileMessage() and CopyMessages() from servers other than mailbox
  if (mCopyState->m_parseMsgState)
  {
    nsCOMPtr<nsIMsgDatabase> msgDb;
    nsCOMPtr<nsIMsgDBHdr> newHdr;

    mCopyState->m_parseMsgState->FinishHeader();

    rv = mCopyState->m_parseMsgState->GetNewMsgHdr(getter_AddRefs(newHdr));
    if (NS_SUCCEEDED(rv) && newHdr)
    {
      nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryInterface(mCopyState->m_srcSupport, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      nsCOMPtr<nsIMsgDatabase> srcDB;
      srcFolder->GetMsgDatabase(nsnull, getter_AddRefs(srcDB));
      if (srcDB)
      {
        nsCOMPtr <nsIMsgDBHdr> srcMsgHdr;
        srcDB->GetMsgHdrForKey(key, getter_AddRefs(srcMsgHdr));
        if (srcMsgHdr)
          CopyPropertiesToMsgHdr(newHdr, srcMsgHdr);
      }
      rv = GetDatabaseWOReparse(getter_AddRefs(msgDb));
      if (NS_SUCCEEDED(rv) && msgDb)
      {
        msgDb->AddNewHdrToDB(newHdr, PR_TRUE);
        if (localUndoTxn)
        {
          // ** jt - recording the message size for possible undo use; the
          // message size is different for pop3 and imap4 messages
          PRUint32 msgSize;
          newHdr->GetMessageSize(&msgSize);
          localUndoTxn->AddDstMsgSize(msgSize);
        }
      }
      else
        mCopyState->m_undoMsgTxn = nsnull; //null out the transaction because we can't undo w/o the msg db
    }
    mCopyState->m_parseMsgState->Clear();

    if (mCopyState->m_listener) // CopyFileMessage() only
      mCopyState->m_listener->SetMessageKey((PRUint32) mCopyState->m_curDstKey);
  }

  if (mCopyState->m_fileStream)
    mCopyState->m_fileStream->Flush();
  return NS_OK;
}


nsresult nsMsgLocalMailFolder::CopyMessagesTo(nsIArray *messages, nsTArray<nsMsgKey> &keyArray,
                                             nsIMsgWindow *aMsgWindow, nsIMsgFolder *dstFolder,
                                             PRBool isMove)
{
  if (!mCopyState)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv;

  nsCOMPtr<nsICopyMessageStreamListener> copyStreamListener = do_CreateInstance(NS_COPYMESSAGESTREAMLISTENER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsICopyMessageListener> copyListener(do_QueryInterface(dstFolder, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

  nsCOMPtr<nsIMsgFolder> srcFolder(do_QueryInterface(mCopyState->m_srcSupport, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

  rv = copyStreamListener->Init(srcFolder, copyListener, nsnull);
  if(NS_FAILED(rv))
    return rv;

  if (!mCopyState->m_messageService)
  {
    nsCString uri;
    srcFolder->GetURI(uri);
    rv = GetMessageServiceFromURI(uri, getter_AddRefs(mCopyState->m_messageService));
  }

  if (NS_SUCCEEDED(rv) && mCopyState->m_messageService)
  {
    nsCOMPtr<nsIStreamListener> streamListener(do_QueryInterface(copyStreamListener, &rv));
    NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

    mCopyState->m_curCopyIndex = 0;
    // we need to kick off the first message - subsequent messages
    // are kicked off by nsMailboxProtocol when it finishes a message
    // before starting the next message. Only do this if the source folder
    // is a local folder, however. IMAP will handle calling StartMessage for
    // each message that gets downloaded, and news doesn't go through here
    // because news only downloads one message at a time, and this routine
    // is for multiple message copy.
    nsCOMPtr <nsIMsgLocalMailFolder> srcLocalFolder = do_QueryInterface(srcFolder);
    if (srcLocalFolder)
      StartMessage();
    rv = mCopyState->m_messageService->CopyMessages(keyArray, srcFolder, streamListener, isMove, nsnull, aMsgWindow, nsnull);
  }
  return rv;
}

nsresult nsMsgLocalMailFolder::CopyMessageTo(nsISupports *message,
                                             nsIMsgFolder *dstFolder /* dst same as "this" */,
                                             nsIMsgWindow *aMsgWindow,
                                             PRBool isMove)
{
  if (!mCopyState)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv;
  nsCOMPtr<nsIMsgDBHdr> msgHdr(do_QueryInterface(message, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

  mCopyState->m_message = do_QueryInterface(msgHdr, &rv);

  nsCOMPtr<nsIMsgFolder> srcFolder(do_QueryInterface(mCopyState->m_srcSupport, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);
  nsCString uri;
  srcFolder->GetUriForMsg(msgHdr, uri);

  nsCOMPtr<nsICopyMessageStreamListener> copyStreamListener = do_CreateInstance(NS_COPYMESSAGESTREAMLISTENER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsICopyMessageListener> copyListener(do_QueryInterface(dstFolder, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

  rv = copyStreamListener->Init(srcFolder, copyListener, nsnull);
  if(NS_FAILED(rv))
    return rv;

  if (!mCopyState->m_messageService)
    rv = GetMessageServiceFromURI(uri, getter_AddRefs(mCopyState->m_messageService));

  if (NS_SUCCEEDED(rv) && mCopyState->m_messageService)
  {
    nsCOMPtr<nsIStreamListener> streamListener(do_QueryInterface(copyStreamListener, &rv));
    NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);
    rv = mCopyState->m_messageService->CopyMessage(uri.get(), streamListener, isMove, nsnull, aMsgWindow, nsnull);
  }
  return rv;
}

// A message is being deleted from a POP3 mail file, so check and see if we have the message
// being deleted in the server. If so, then we need to remove the message from the server as well.
// We have saved the UIDL of the message in the popstate.dat file and we must match this uidl, so
// read the message headers and see if we have it, then mark the message for deletion from the server.
// The next time we look at mail the message will be deleted from the server.

NS_IMETHODIMP
nsMsgLocalMailFolder::MarkMsgsOnPop3Server(nsIArray *aMessages, PRInt32 aMark)
{
  nsLocalFolderScanState folderScanState;
  nsCOMPtr<nsIPop3IncomingServer> curFolderPop3MailServer;
  nsCOMArray<nsIPop3IncomingServer> pop3Servers; // servers with msgs deleted...

  nsCOMPtr<nsIMsgIncomingServer> incomingServer;
  nsresult rv = GetServer(getter_AddRefs(incomingServer));
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

  nsCOMPtr <nsIMsgAccountManager> accountManager = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // I wonder if we should run through the pop3 accounts and see if any of them have
  // leave on server set. If not, we could short-circuit some of this.

  curFolderPop3MailServer = do_QueryInterface(incomingServer, &rv);
  rv = GetFolderScanState(&folderScanState);
  NS_ENSURE_SUCCESS(rv,rv);

  PRUint32 srcCount;
  aMessages->GetLength(&srcCount);

  // Filter delete requests are always honored, others are subject
  // to the deleteMailLeftOnServer preference.
  PRInt32 mark;
  mark = (aMark == POP3_FORCE_DEL) ? POP3_DELETE : aMark;

  for (PRUint32 i = 0; i < srcCount; i++)
  {
    /* get uidl for this message */
    nsCOMPtr<nsIMsgDBHdr> msgDBHdr (do_QueryElementAt(aMessages, i, &rv));

    PRUint32 flags = 0;

    if (msgDBHdr)
    {
      msgDBHdr->GetFlags(&flags);
      nsCOMPtr <nsIPop3IncomingServer> msgPop3Server = curFolderPop3MailServer;
      PRBool leaveOnServer = PR_FALSE;
      PRBool deleteMailLeftOnServer = PR_FALSE;
      // set up defaults, in case there's no x-mozilla-account header
      if (curFolderPop3MailServer)
      {
        curFolderPop3MailServer->GetDeleteMailLeftOnServer(&deleteMailLeftOnServer);
        curFolderPop3MailServer->GetLeaveMessagesOnServer(&leaveOnServer);
      }

      rv = GetUidlFromFolder(&folderScanState, msgDBHdr);
      if (!NS_SUCCEEDED(rv))
        continue;

      if (folderScanState.m_uidl)
      {
        nsCOMPtr <nsIMsgAccount> account;
        rv = accountManager->GetAccount(folderScanState.m_accountKey, getter_AddRefs(account));
        if (NS_SUCCEEDED(rv) && account)
        {
          account->GetIncomingServer(getter_AddRefs(incomingServer));
          nsCOMPtr<nsIPop3IncomingServer> curMsgPop3MailServer = do_QueryInterface(incomingServer);
          if (curMsgPop3MailServer)
          {
            msgPop3Server = curMsgPop3MailServer;
            msgPop3Server->GetDeleteMailLeftOnServer(&deleteMailLeftOnServer);
            msgPop3Server->GetLeaveMessagesOnServer(&leaveOnServer);
          }
        }
      }
      // ignore this header if not partial and leaveOnServer not set...
      // or if we can't find the pop3 server.
      if (!msgPop3Server || (! (flags & MSG_FLAG_PARTIAL) && !leaveOnServer))
        continue;
      // if marking deleted, ignore header if we're not deleting from
      // server when deleting locally.
      if (aMark == POP3_DELETE && leaveOnServer && !deleteMailLeftOnServer)
        continue;
      if (folderScanState.m_uidl)
      {
        msgPop3Server->AddUidlToMark(folderScanState.m_uidl, mark);
        // remember this pop server in list of servers with msgs deleted
        if (pop3Servers.IndexOfObject(msgPop3Server) == kNotFound)
          pop3Servers.AppendObject(msgPop3Server);
      }
    }
  }

  // need to do this for all pop3 mail servers that had messages deleted.
  PRUint32 serverCount = pop3Servers.Count();
  for (PRUint32 index = 0; index < serverCount; index++)
    pop3Servers[index]->MarkMessages();

  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::DeleteDownloadMsg(nsIMsgDBHdr *aMsgHdr, PRBool *aDoSelect)
{
  PRUint32 numMsgs;
  char *newMsgId;

  // This method is only invoked thru DownloadMessagesForOffline()
  if (mDownloadState != DOWNLOAD_STATE_NONE)
  {
    // We only remember the first key, no matter how many
    // messages were originally selected.
    if (mDownloadState == DOWNLOAD_STATE_INITED)
    {
      aMsgHdr->GetMessageKey(&mDownloadSelectKey);
      mDownloadState = DOWNLOAD_STATE_GOTMSG;
    }

    aMsgHdr->GetMessageId(&newMsgId);

    // Walk through all the selected headers, looking for a matching
    // Message-ID.
    mDownloadMessages->Count(&numMsgs);
    for (PRUint32 i = 0; i < numMsgs; i++)
    {
      nsresult rv;
      nsCOMPtr<nsIMsgDBHdr> msgDBHdr (do_QueryElementAt(mDownloadMessages, i, &rv));
      char *oldMsgId = nsnull;
      msgDBHdr->GetMessageId(&oldMsgId);

      // Delete the first match and remove it from the array
      if (!PL_strcmp(newMsgId, oldMsgId))
      {
#if DOWNLOAD_NOTIFY_STYLE == DOWNLOAD_NOTIFY_LAST
        msgDBHdr->GetMessageKey(&mDownloadOldKey);
        msgDBHdr->GetThreadParent(&mDownloadOldParent);
        msgDBHdr->GetFlags(&mDownloadOldFlags);
        mDatabase->DeleteHeader(msgDBHdr, nsnull, PR_FALSE, PR_FALSE);
        // Tell caller we want to select this message
        if (aDoSelect)
          *aDoSelect = PR_TRUE;
#else
        mDatabase->DeleteHeader(msgDBHdr, nsnull, PR_FALSE, PR_TRUE);
        // Tell caller we want to select this message
        if (aDoSelect && mDownloadState == DOWNLOAD_STATE_GOTMSG)
          *aDoSelect = PR_TRUE;
#endif
        mDownloadMessages->DeleteElementAt(i);
        break;
      }
    }
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::SelectDownloadMsg()
{

#if DOWNLOAD_NOTIFY_STYLE == DOWNLOAD_NOTIFY_LAST
  if (mDownloadState >= DOWNLOAD_STATE_GOTMSG)
    mDatabase->NotifyKeyDeletedAll(mDownloadOldKey, mDownloadOldParent, mDownloadOldFlags, nsnull);
#endif

  if (mDownloadState == DOWNLOAD_STATE_GOTMSG && mDownloadWindow)
  {
    nsCAutoString newuri;
    nsBuildLocalMessageURI(mBaseMessageURI.get(), mDownloadSelectKey, newuri);
    nsCOMPtr<nsIMsgWindowCommands> windowCommands;
    mDownloadWindow->GetWindowCommands(getter_AddRefs(windowCommands));
    if (windowCommands)
      windowCommands->SelectMessage(newuri);
    mDownloadState = DOWNLOAD_STATE_DIDSEL;
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::DownloadMessagesForOffline(nsIArray *aMessages, nsIMsgWindow *aWindow)
{
  if (mDownloadState != DOWNLOAD_STATE_NONE)
    return NS_ERROR_FAILURE; // already has a download in progress

  // We're starting a download...
  mDownloadState = DOWNLOAD_STATE_INITED;

  MarkMsgsOnPop3Server(aMessages, POP3_FETCH_BODY);

  // Pull out all the PARTIAL messages into a new array
  PRUint32 srcCount;
  aMessages->GetLength(&srcCount);

  nsresult rv;
  NS_NewISupportsArray(getter_AddRefs(mDownloadMessages));
  for (PRUint32 i = 0; i < srcCount; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> msgDBHdr (do_QueryElementAt(aMessages, i, &rv));
    if (NS_SUCCEEDED(rv))
    {
      PRUint32 flags = 0;
      msgDBHdr->GetFlags(&flags);
      if (flags & MSG_FLAG_PARTIAL)
        mDownloadMessages->AppendElement(msgDBHdr);
    }
  }
  mDownloadWindow = aWindow;

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

  nsCOMPtr<nsILocalMailIncomingServer> localMailServer = do_QueryInterface(server, &rv);
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);
  return localMailServer->GetNewMail(aWindow, this, this, nsnull);
}

NS_IMETHODIMP nsMsgLocalMailFolder::NotifyDelete()
{
  NotifyFolderEvent(mDeleteOrMoveMsgCompletedAtom);
  return NS_OK;
}

// TODO:  once we move certain code into the IncomingServer (search for TODO)
// this method will go away.
// sometimes this gets called when we don't have the server yet, so
// that's why we're not calling GetServer()
void
nsMsgLocalMailFolder::GetIncomingServerType(nsCString& aServerType)
{
  nsresult rv;
  if (mType.IsEmpty())
  {
    nsCOMPtr<nsIURL> url = do_CreateInstance(NS_STANDARDURL_CONTRACTID, &rv);
    if (NS_FAILED(rv)) return;

    rv = url->SetSpec(nsDependentCString(mURI));
    if (NS_FAILED(rv)) return;

    nsCOMPtr<nsIMsgAccountManager> accountManager =
             do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    if (NS_FAILED(rv)) return;

    nsCOMPtr<nsIMsgIncomingServer> server;
    // try "none" first
    url->SetScheme(NS_LITERAL_CSTRING("none"));
    rv = accountManager->FindServerByURI(url, PR_FALSE, getter_AddRefs(server));
    if (NS_SUCCEEDED(rv) && server)
      mType.AssignLiteral("none");
    else
    {
      // next try "pop3"
      url->SetScheme(NS_LITERAL_CSTRING("pop3"));
      rv = accountManager->FindServerByURI(url, PR_FALSE, getter_AddRefs(server));
      if (NS_SUCCEEDED(rv) && server)
        mType.AssignLiteral("pop3");
      else
      {
        // next try "rss"
        url->SetScheme(NS_LITERAL_CSTRING("rss"));
        rv = accountManager->FindServerByURI(url, PR_FALSE, getter_AddRefs(server));
        if (NS_SUCCEEDED(rv) && server)
          mType.AssignLiteral("rss");
        else
        {
#ifdef HAVE_MOVEMAIL
          // next try "movemail"
          url->SetScheme(NS_LITERAL_CSTRING("movemail"));
          rv = accountManager->FindServerByURI(url, PR_FALSE, getter_AddRefs(server));
          if (NS_SUCCEEDED(rv) && server)
            mType.AssignLiteral("movemail");
#endif /* HAVE_MOVEMAIL */
        }
      }
    }
  }
  aServerType = mType;
}

nsresult nsMsgLocalMailFolder::CreateBaseMessageURI(const nsACString& aURI)
{
  return nsCreateLocalBaseMessageURI(aURI, mBaseMessageURI);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnStartRunningUrl(nsIURI * aUrl)
{
  nsresult rv;
  nsCOMPtr<nsIPop3URL> popurl = do_QueryInterface(aUrl, &rv);
  if (NS_SUCCEEDED(rv))
  {
    nsCAutoString aSpec;
    aUrl->GetSpec(aSpec);
    if (strstr(aSpec.get(), "uidl="))
    {
      nsCOMPtr<nsIPop3Sink> popsink;
      rv = popurl->GetPop3Sink(getter_AddRefs(popsink));
      if (NS_SUCCEEDED(rv))
        popsink->SetBaseMessageUri(mBaseMessageURI.get());
    }
  }
  return nsMsgDBFolder::OnStartRunningUrl(aUrl);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode)
{
  // If we just finished a DownloadMessages call, reset...
  if (mDownloadState != DOWNLOAD_STATE_NONE)
  {
    mDownloadState = DOWNLOAD_STATE_NONE;
    mDownloadMessages = nsnull;
    mDownloadWindow = nsnull;
    return nsMsgDBFolder::OnStopRunningUrl(aUrl, aExitCode);
  }
  nsresult rv;
  if (NS_SUCCEEDED(aExitCode))
  {
    nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsIMsgWindow> msgWindow;
    rv = mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
    nsCAutoString aSpec;
    aUrl->GetSpec(aSpec);

    if (strstr(aSpec.get(), "uidl="))
    {
      nsCOMPtr<nsIPop3URL> popurl = do_QueryInterface(aUrl, &rv);
      if (NS_SUCCEEDED(rv))
      {
        nsCString messageuri;
        rv = popurl->GetMessageUri(getter_Copies(messageuri));
        if (NS_SUCCEEDED(rv))
        {
          NS_ENSURE_SUCCESS(rv, rv);
          nsCOMPtr <nsIMsgDBHdr> msgDBHdr;
          rv = GetMsgDBHdrFromURI(messageuri.get(), getter_AddRefs(msgDBHdr));
          if(NS_SUCCEEDED(rv))
              rv = mDatabase->DeleteHeader(msgDBHdr, nsnull, PR_TRUE, PR_TRUE);
          nsCOMPtr<nsIPop3Sink> pop3sink;
          nsCString newMessageUri;
          rv = popurl->GetPop3Sink(getter_AddRefs(pop3sink));
          if (NS_SUCCEEDED(rv))
          {
            pop3sink->GetMessageUri(getter_Copies(newMessageUri));
            if (msgWindow)
            {
              nsCOMPtr<nsIMsgWindowCommands> windowCommands;
              msgWindow->GetWindowCommands(getter_AddRefs(windowCommands));
              if (windowCommands)
                windowCommands->SelectMessage(newMessageUri);
            }
          }
        }
      }
    }

    if (mFlags & nsMsgFolderFlags::Inbox)
    {
      if (mDatabase && mCheckForNewMessagesAfterParsing)
      {
        PRBool valid;
        mDatabase->GetSummaryValid(&valid);
        if (valid && msgWindow)
          rv = GetNewMessages(msgWindow, nsnull);
        mCheckForNewMessagesAfterParsing = PR_FALSE;
      }
    }
  }

  if (m_parsingFolder && mReparseListener)
  {
    nsCOMPtr<nsIUrlListener> saveReparseListener = mReparseListener;
    mReparseListener = nsnull;
    saveReparseListener->OnStopRunningUrl(aUrl, aExitCode);
  }
  if (mFlags & nsMsgFolderFlags::Inbox)
  {
    // if we are the inbox and running pop url
    nsCOMPtr<nsIPop3URL> popurl = do_QueryInterface(aUrl, &rv);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIMsgIncomingServer> server;
      GetServer(getter_AddRefs(server));
      // this is the deferred to account, in the global inbox case
      if (server)
        server->SetPerformingBiff(PR_FALSE);  //biff is over
    }
  }
  m_parsingFolder = PR_FALSE;
  return nsMsgDBFolder::OnStopRunningUrl(aUrl, aExitCode);
}

nsresult nsMsgLocalMailFolder::DisplayMoveCopyStatusMsg()
{
  nsresult rv = NS_OK;
  if (mCopyState)
  {
    if (!mCopyState->m_statusFeedback)
    {
      // get msgWindow from undo txn
      nsCOMPtr<nsIMsgWindow> msgWindow;
      if (mCopyState->m_undoMsgTxn)
        mCopyState->m_undoMsgTxn->GetMsgWindow(getter_AddRefs(msgWindow));
      if (!msgWindow)
        return NS_OK; // not a fatal error.
      msgWindow->GetStatusFeedback(getter_AddRefs(mCopyState->m_statusFeedback));
    }

    if (!mCopyState->m_stringBundle)
    {
      nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
      NS_ENSURE_SUCCESS(rv, rv);
      rv = bundleService->CreateBundle("chrome://messenger/locale/localMsgs.properties", getter_AddRefs(mCopyState->m_stringBundle));
      NS_ENSURE_SUCCESS(rv, rv);
    }
    if (mCopyState->m_statusFeedback && mCopyState->m_stringBundle)
    {
      nsString folderName;
      GetName(folderName);
      PRInt32 statusMsgId = (mCopyState->m_isMove) ? MOVING_MSGS_STATUS : COPYING_MSGS_STATUS;
      nsAutoString numMsgSoFarString;
      numMsgSoFarString.AppendInt((mCopyState->m_copyingMultipleMessages) ? mCopyState->m_curCopyIndex : 1);

      nsAutoString totalMessagesString;
      totalMessagesString.AppendInt(mCopyState->m_totalMsgCount);
      nsString finalString;
      const PRUnichar * stringArray[] = { numMsgSoFarString.get(), totalMessagesString.get(), folderName.get() };
      rv = mCopyState->m_stringBundle->FormatStringFromID(statusMsgId, stringArray, 3,
                                               getter_Copies(finalString));
      PRInt64 minIntervalBetweenProgress;
      PRInt64 nowMS = LL_ZERO;

      // only update status/progress every half second
      LL_I2L(minIntervalBetweenProgress, 500);
      PRInt64 diffSinceLastProgress;
      LL_I2L(nowMS, PR_IntervalToMilliseconds(PR_IntervalNow()));
      LL_SUB(diffSinceLastProgress, nowMS, mCopyState->m_lastProgressTime); // r = a - b
      LL_SUB(diffSinceLastProgress, diffSinceLastProgress, minIntervalBetweenProgress); // r = a - b
      if (!LL_GE_ZERO(diffSinceLastProgress) && mCopyState->m_curCopyIndex < mCopyState->m_totalMsgCount)
        return NS_OK;

      mCopyState->m_lastProgressTime = nowMS;
      mCopyState->m_statusFeedback->ShowStatusString(finalString);
      mCopyState->m_statusFeedback->ShowProgress(mCopyState->m_curCopyIndex * 100 / mCopyState->m_totalMsgCount);
    }
  }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::SetFlagsOnDefaultMailboxes(PRUint32 flags)
{
  if (flags & nsMsgFolderFlags::Inbox)
    setSubfolderFlag(NS_LITERAL_STRING("Inbox"), nsMsgFolderFlags::Inbox);

  if (flags & nsMsgFolderFlags::SentMail)
    setSubfolderFlag(NS_LITERAL_STRING("Sent"), nsMsgFolderFlags::SentMail);

  if (flags & nsMsgFolderFlags::Drafts)
    setSubfolderFlag(NS_LITERAL_STRING("Drafts"), nsMsgFolderFlags::Drafts);

  if (flags & nsMsgFolderFlags::Templates)
    setSubfolderFlag(NS_LITERAL_STRING("Templates"), nsMsgFolderFlags::Templates);

  if (flags & nsMsgFolderFlags::Trash)
    setSubfolderFlag(NS_LITERAL_STRING("Trash"), nsMsgFolderFlags::Trash);

  if (flags & nsMsgFolderFlags::Queue)
    setSubfolderFlag(NS_LITERAL_STRING("Unsent Messages"), nsMsgFolderFlags::Queue);

  if (flags & nsMsgFolderFlags::Junk)
    setSubfolderFlag(NS_LITERAL_STRING("Junk"), nsMsgFolderFlags::Junk);

  return NS_OK;
}

nsresult
nsMsgLocalMailFolder::setSubfolderFlag(const nsAString& aFolderName, PRUint32 flags)
{
  // FindSubFolder() expects the folder name to be escaped
  // see bug #192043
  nsCAutoString escapedFolderName;
  nsresult rv = NS_MsgEscapeEncodeURLPath(aFolderName, escapedFolderName);
  NS_ENSURE_SUCCESS(rv,rv);
  nsCOMPtr<nsIMsgFolder> msgFolder;
  rv = FindSubFolder(escapedFolderName, getter_AddRefs(msgFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  // we only want to do this if the folder *really* exists,
  // so check if it has a parent. Otherwise, we'll create the
  // .msf file when we don't want to.
  nsCOMPtr <nsIMsgFolder> parent;
  msgFolder->GetParent(getter_AddRefs(parent));
  if (!parent)
    return NS_ERROR_FAILURE;

  rv = msgFolder->SetFlag(flags);
  NS_ENSURE_SUCCESS(rv, rv);
  return msgFolder->SetPrettyName(aFolderName);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetCheckForNewMessagesAfterParsing(PRBool *aCheckForNewMessagesAfterParsing)
{
  NS_ENSURE_ARG_POINTER(aCheckForNewMessagesAfterParsing);
  *aCheckForNewMessagesAfterParsing = mCheckForNewMessagesAfterParsing;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::SetCheckForNewMessagesAfterParsing(PRBool aCheckForNewMessagesAfterParsing)
{
  mCheckForNewMessagesAfterParsing = aCheckForNewMessagesAfterParsing;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::NotifyCompactCompleted()
{
  mExpungedBytes = 0;
  m_newMsgs.Clear(); // if compacted, m_newMsgs probably aren't valid.
  (void) RefreshSizeOnDisk();
  (void) CloseDBIfFolderNotOpen();
  nsCOMPtr <nsIAtom> compactCompletedAtom;
  compactCompletedAtom = do_GetAtom("CompactCompleted");
  NotifyFolderEvent(compactCompletedAtom);
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::Shutdown(PRBool shutdownChildren)
{
  mInitialized = PR_FALSE;
  return nsMsgDBFolder::Shutdown(shutdownChildren);
}

nsresult
nsMsgLocalMailFolder::SpamFilterClassifyMessage(const char *aURI, nsIMsgWindow *aMsgWindow, nsIJunkMailPlugin *aJunkMailPlugin)
{
  nsresult rv;
  nsCOMPtr<nsIMsgTraitService> traitService(do_GetService("@mozilla.org/msg-trait-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 count;
  PRUint32 *proIndices;
  PRUint32 *antiIndices;
  rv = traitService->GetEnabledIndices(&count, &proIndices, &antiIndices);
  NS_ENSURE_SUCCESS(rv, rv);

  ++mNumFilterClassifyRequests;
  rv = aJunkMailPlugin->ClassifyTraitsInMessage(aURI, count, proIndices, antiIndices, this, aMsgWindow, this);
  NS_Free(proIndices);
  NS_Free(antiIndices);
  return rv;
}

nsresult
nsMsgLocalMailFolder::SpamFilterClassifyMessages(const char **aURIArray, PRUint32 aURICount, nsIMsgWindow *aMsgWindow, nsIJunkMailPlugin *aJunkMailPlugin)
{
  NS_ASSERTION(!mNumFilterClassifyRequests, "shouldn't call this when already classifying messages");
  mNumFilterClassifyRequests = aURICount;
  nsresult rv;
  nsCOMPtr<nsIMsgTraitService> traitService(do_GetService("@mozilla.org/msg-trait-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 count;
  PRUint32 *proIndices;
  PRUint32 *antiIndices;
  rv = traitService->GetEnabledIndices(&count, &proIndices, &antiIndices);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = aJunkMailPlugin->ClassifyTraitsInMessages(aURICount, aURIArray, count,
      proIndices, antiIndices, this, aMsgWindow, this);
  NS_Free(proIndices);
  NS_Free(antiIndices);
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnMessageClassified(const char *aMsgURI,
  nsMsgJunkStatus aClassification,
  PRUint32 aJunkPercent)

{
  if (mNumFilterClassifyRequests > 0)
    --mNumFilterClassifyRequests;

  nsCOMPtr<nsIMsgIncomingServer> server;
  nsresult rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  rv = GetMsgDBHdrFromURI(aMsgURI, getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv, rv);

  nsMsgKey msgKey;
  rv = msgHdr->GetMessageKey(&msgKey);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISpamSettings> spamSettings;
  rv = server->GetSpamSettings(getter_AddRefs(spamSettings));
  NS_ENSURE_SUCCESS(rv, rv);

  // check if this message needs junk classification
  PRUint32 processingFlags;
  GetProcessingFlags(msgKey, &processingFlags);

  if (processingFlags & MSG_PROCESSING_FLAG_CLASSIFY_JUNK)
  {
    AndProcessingFlags(msgKey, ~MSG_PROCESSING_FLAG_CLASSIFY_JUNK);

    nsCAutoString msgJunkScore;
    msgJunkScore.AppendInt(aClassification == nsIJunkMailPlugin::JUNK ?
          nsIJunkMailPlugin::IS_SPAM_SCORE:
          nsIJunkMailPlugin::IS_HAM_SCORE);
    mDatabase->SetStringProperty(msgKey, "junkscore", msgJunkScore.get());
    mDatabase->SetStringProperty(msgKey, "junkscoreorigin", "plugin");

    nsCAutoString strPercent;
    strPercent.AppendInt(aJunkPercent);
    mDatabase->SetStringProperty(msgKey, "junkpercent", strPercent.get());

    PRBool moveOnSpam = PR_FALSE;

    if (aClassification == nsIJunkMailPlugin::JUNK)
    {
      PRBool markAsReadOnSpam;
      (void)spamSettings->GetMarkAsReadOnSpam(&markAsReadOnSpam);
      if (markAsReadOnSpam)
      {
        rv = mDatabase->MarkRead(msgKey, true, this);
          if (!NS_SUCCEEDED(rv))
            NS_WARNING("failed marking spam message as read");
      }

      PRBool willMoveMessage = PR_FALSE;

      // don't do the move when we are opening up
      // the junk mail folder or the trash folder
      // or when manually classifying messages in those folders
      if (!(mFlags & nsMsgFolderFlags::Junk || mFlags & nsMsgFolderFlags::Trash))
      {
        rv = spamSettings->GetMoveOnSpam(&moveOnSpam);
        NS_ENSURE_SUCCESS(rv,rv);
        if (moveOnSpam)
        {
          nsCString uriStr;
          rv = spamSettings->GetSpamFolderURI(getter_Copies(uriStr));
          NS_ENSURE_SUCCESS(rv,rv);
          mSpamFolderURI = uriStr;

          nsCOMPtr<nsIMsgFolder> folder;
          rv = GetExistingFolder(mSpamFolderURI, getter_AddRefs(folder));
          if (NS_SUCCEEDED(rv) && folder)
          {
            rv = folder->SetFlag(nsMsgFolderFlags::Junk);
            NS_ENSURE_SUCCESS(rv,rv);
            mSpamKeysToMove.AppendElement(msgKey);
            willMoveMessage = PR_TRUE;
          }
          else
          {
            // XXX TODO
            // JUNK MAIL RELATED
            // the listener should do
            // rv = folder->SetFlag(nsMsgFolderFlags::Junk);
            // NS_ENSURE_SUCCESS(rv,rv);
            // mSpamKeysToMove.AppendElement(msgKey);
            // willMoveMessage = PR_TRUE;
            rv = GetOrCreateFolder(mSpamFolderURI, nsnull /* aListener */);
            NS_ASSERTION(NS_SUCCEEDED(rv), "GetOrCreateFolder failed");
          }
        }
      }
      rv = spamSettings->LogJunkHit(msgHdr, willMoveMessage);
      NS_ENSURE_SUCCESS(rv,rv);
    }
  }

  if (mNumFilterClassifyRequests == 0)
  {
    if (!mSpamKeysToMove.IsEmpty())
    {
      if (!mSpamFolderURI.IsEmpty())
      {
        nsCOMPtr<nsIMsgFolder> folder;
        rv = GetExistingFolder(mSpamFolderURI, getter_AddRefs(folder));
        if (NS_SUCCEEDED(rv) && folder) {
          nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID));
          for (PRUint32 keyIndex = 0; keyIndex < mSpamKeysToMove.Length(); keyIndex++)
          {
            nsCOMPtr<nsIMsgDBHdr> mailHdr = nsnull;
            rv = GetMessageHeader(mSpamKeysToMove.ElementAt(keyIndex), getter_AddRefs(mailHdr));
            if (NS_SUCCEEDED(rv) && mailHdr)
              messages->AppendElement(mailHdr, PR_FALSE);
          }

          nsCOMPtr<nsIMsgCopyService> copySvc = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
          NS_ENSURE_SUCCESS(rv,rv);

          rv = copySvc->CopyMessages(this, messages, folder, PR_TRUE,
            /*nsIMsgCopyServiceListener* listener*/ nsnull, nsnull, PR_FALSE /*allowUndo*/);
          NS_ASSERTION(NS_SUCCEEDED(rv), "CopyMessages failed");
          if (NS_FAILED(rv))
          {
            nsCAutoString logMsg("failed to copy junk messages to junk folder rv = ");
            logMsg.AppendInt(rv, 16);
            spamSettings->LogJunkString(logMsg.get());
          }
        }
      }
    }
    PRInt32 numNewMessages;
    GetNumNewMessages(PR_FALSE, &numNewMessages);
    SetNumNewMessages(numNewMessages - mSpamKeysToMove.Length());
    mSpamKeysToMove.Clear();
    // check if this is the inbox first...
    if (mFlags & nsMsgFolderFlags::Inbox)
      PerformBiffNotifications();
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnMessageTraitsClassified(
    const char *aMsgURI, PRUint32 aTraitCount,
    PRUint32 *aTraits, PRUint32 *aPercents)
{
  nsresult rv;
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  rv = GetMsgDBHdrFromURI(aMsgURI, getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv, rv);

  nsMsgKey msgKey;
  rv = msgHdr->GetMessageKey(&msgKey);
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 processingFlags;
  GetProcessingFlags(msgKey, &processingFlags);
  if (!(processingFlags & MSG_PROCESSING_FLAG_CLASSIFY_TRAITS))
    return NS_OK;

  AndProcessingFlags(msgKey, ~MSG_PROCESSING_FLAG_CLASSIFY_TRAITS);

  nsCOMPtr<nsIMsgTraitService> traitService;
  traitService = do_GetService("@mozilla.org/msg-trait-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  for (PRUint32 i = 0; i < aTraitCount; i++)
  {
    if (aTraits[i] == nsIJunkMailPlugin::JUNK_TRAIT)
      continue; // junk is processed by the junk listener
    nsCAutoString traitId;
    rv = traitService->GetId(aTraits[i], traitId);
    traitId.Insert(NS_LITERAL_CSTRING("bayespercent/"), 0);
    nsCAutoString strPercent;
    strPercent.AppendInt(aPercents[i]);
    mDatabase->SetStringPropertyByHdr(msgHdr, traitId.get(), strPercent.get());
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetFolderScanState(nsLocalFolderScanState *aState)
{
  NS_ENSURE_ARG_POINTER(aState);

  nsresult rv;
  GetFilePath(getter_AddRefs(aState->m_localFile));
  aState->m_fileStream = do_CreateInstance(NS_LOCALFILEINPUTSTREAM_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = aState->m_fileStream->Init(aState->m_localFile, PR_RDONLY, 0664, PR_FALSE);
  if (NS_SUCCEEDED(rv))
  {
    aState->m_inputStream = do_QueryInterface(aState->m_fileStream);
    aState->m_seekableStream = do_QueryInterface(aState->m_inputStream);
    aState->m_fileLineStream = do_QueryInterface(aState->m_inputStream);
    aState->m_uidl = nsnull;
  }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetUidlFromFolder(nsLocalFolderScanState *aState, nsIMsgDBHdr *aMsgDBHdr)
{
  nsresult rv;
  PRUint32 messageOffset;
  PRBool more = PR_FALSE;
  PRUint32 size = 0, len = 0;
  const char *accountKey = nsnull;

  aMsgDBHdr->GetMessageOffset(&messageOffset);
  rv = aState->m_seekableStream->Seek(PR_SEEK_SET, messageOffset);
  NS_ENSURE_SUCCESS(rv,rv);

  nsLineBuffer<char> *lineBuffer;

  rv = NS_InitLineBuffer(&lineBuffer);
  NS_ENSURE_SUCCESS(rv, rv);
  aState->m_uidl = nsnull;

  aMsgDBHdr->GetMessageSize(&len);
  while (len > 0)
  {
    rv = NS_ReadLine(aState->m_inputStream.get(), lineBuffer, aState->m_header, &more);
    if (NS_SUCCEEDED(rv))
    {
      size = aState->m_header.Length();
      if (!size)
        break;
      // this isn't quite right - need to account for line endings
      len -= size;
      // account key header will always be before X_UIDL header
      if (!accountKey)
      {
        accountKey = strstr(aState->m_header.get(), HEADER_X_MOZILLA_ACCOUNT_KEY);
        if (accountKey)
        {
          accountKey += strlen(HEADER_X_MOZILLA_ACCOUNT_KEY) + 2;
          aState->m_accountKey = accountKey;
        }
      }
      else
      {
        aState->m_uidl = strstr(aState->m_header.get(), X_UIDL);
        if (aState->m_uidl)
        {
          aState->m_uidl += X_UIDL_LEN + 2; // skip UIDL: header
          break;
        }
      }
    }
  }
  return rv;
}

  // this adds a message to the end of the folder, parsing it as it goes, and
  // applying filters, if applicable.
NS_IMETHODIMP
nsMsgLocalMailFolder::AddMessage(const char *aMessage)
{
  nsCOMPtr<nsILocalFile> path;
  nsresult rv = GetFilePath(getter_AddRefs(path));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr <nsIOutputStream> outFileStream;
  MsgGetFileStream(path, getter_AddRefs(outFileStream));
  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(outFileStream);
  seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);

  // create a new mail parser
  nsRefPtr<nsParseNewMailState> newMailParser = new nsParseNewMailState;
  if (newMailParser == nsnull)
    return NS_ERROR_OUT_OF_MEMORY;

  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool isLocked;

  GetLocked(&isLocked);
  if(!isLocked)
    AcquireSemaphore(static_cast<nsIMsgLocalMailFolder*>(this));
  else
    return NS_MSG_FOLDER_BUSY;

  nsCOMPtr <nsIInputStream> inputStream = do_QueryInterface(outFileStream);
  rv = newMailParser->Init(rootFolder, this,
                           path, inputStream, nsnull, PR_FALSE);

  if (!mGettingNewMessages)
    newMailParser->DisableFilters();

  if (NS_SUCCEEDED(rv))
  {
    PRUint32 bytesWritten;
    outFileStream->Write(aMessage, strlen(aMessage), &bytesWritten);
    newMailParser->BufferInput(aMessage, strlen(aMessage));

    outFileStream->Flush();
    newMailParser->SetDBFolderStream(outFileStream);
    newMailParser->OnStopRequest(nsnull, nsnull, NS_OK);
    newMailParser->SetDBFolderStream(nsnull); // stream is going away
    outFileStream->Close();
    newMailParser->EndMsgDownload();
  }
  ReleaseSemaphore(static_cast<nsIMsgLocalMailFolder*>(this));
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::WarnIfLocalFileTooBig(nsIMsgWindow *aWindow, PRBool *aTooBig)
{
  NS_ENSURE_ARG_POINTER(aTooBig);
  *aTooBig = PR_FALSE;
  PRInt64 sizeOnDisk;
  nsCOMPtr <nsILocalFile> filePath;
  nsresult rv = GetFilePath(getter_AddRefs(filePath));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = filePath->GetFileSize(&sizeOnDisk);
  if (NS_SUCCEEDED(rv))
  {
    const nsInt64 kMaxFolderSize = 0xFFF00000;
    nsInt64 folderSize(sizeOnDisk);
    if (folderSize > kMaxFolderSize)
    {
      ThrowAlertMsg("mailboxTooLarge", aWindow);
      *aTooBig = PR_TRUE;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::FetchMsgPreviewText(nsMsgKey *aKeysToFetch, PRUint32 aNumKeys,
                                                 PRBool aLocalOnly, nsIUrlListener *aUrlListener,
                                                 PRBool *aAsyncResults)
{
  NS_ENSURE_ARG_POINTER(aKeysToFetch);
  NS_ENSURE_ARG_POINTER(aAsyncResults);

  *aAsyncResults = PR_FALSE;
  nsCOMPtr <nsIInputStream> inputStream;

  nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), mPath);
  NS_ENSURE_SUCCESS(rv, rv);

  for (PRUint32 i = 0; i < aNumKeys; i++)
  {
    nsCOMPtr <nsIMsgDBHdr> msgHdr;
    nsCString prevBody;
    rv = GetMessageHeader(aKeysToFetch[i], getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, rv);
    // ignore messages that already have a preview body.
    msgHdr->GetStringProperty("preview", getter_Copies(prevBody));
    if (!prevBody.IsEmpty())
      continue;
    PRUint32 messageOffset;

    msgHdr->GetMessageOffset(&messageOffset);
    nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(inputStream);
    if (seekableStream)
      rv = seekableStream->Seek(nsISeekableStream::NS_SEEK_CUR, messageOffset);
    NS_ENSURE_SUCCESS(rv,rv);
    rv = GetMsgPreviewTextFromStream(msgHdr, inputStream);

  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::AddKeywordsToMessages(nsIArray *aMessages, const nsACString& aKeywords)
{
  return ChangeKeywordForMessages(aMessages, aKeywords, PR_TRUE /* add */);
}
nsresult nsMsgLocalMailFolder::ChangeKeywordForMessages(nsIArray *aMessages, const nsACString& aKeywords, PRBool add)
{
  nsresult rv = (add) ? nsMsgDBFolder::AddKeywordsToMessages(aMessages, aKeywords)
                      : nsMsgDBFolder::RemoveKeywordsFromMessages(aMessages, aKeywords);

  if (NS_SUCCEEDED(rv))
  {
    rv = GetDatabase(nsnull);
    NS_ENSURE_SUCCESS(rv, rv);
    // this will fail if the folder is locked.
    rv = mDatabase->StartBatch();
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIOutputStream> fileStream;
    rv = mDatabase->GetFolderStream(getter_AddRefs(fileStream));
    nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(fileStream);
    nsCOMPtr <nsIInputStream> inputStream = do_QueryInterface(fileStream);
    NS_ENSURE_SUCCESS(rv, rv);
    PRUint32 count, bytesWritten;
    NS_ENSURE_ARG(aMessages);
    nsresult rv = aMessages->GetLength(&count);

    nsLineBuffer<char> *lineBuffer;
    rv = NS_InitLineBuffer(&lineBuffer);
    NS_ENSURE_SUCCESS(rv, rv);

    // for each message, we seek to the beginning of the x-mozilla-status header, and
    // start reading lines, looking for x-mozilla-keys: headers; If we're adding
    // the keyword and we find
    // a header with the desired keyword already in it, we don't need to
    // do anything. Likewise, if removing keyword and we don't find it,
    // we don't need to do anything. Otherwise, if adding, we need to
    // see if there's an x-mozilla-keys
    // header with room for the new keyword. If so, we replace the
    // corresponding number of spaces with the keyword. If no room,
    // we can't do anything until the folder is compacted and another
    // x-mozilla-keys header is added. In that case, we set a property
    // on the header, which the compaction code will check.

    // don't return out of the for loop - otherwise, we won't call EndBatch();
    for(PRUint32 i = 0; i < count; i++) // for each message
    {
      nsCOMPtr<nsIMsgDBHdr> message = do_QueryElementAt(aMessages, i, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      PRUint32 messageOffset;
      message->GetMessageOffset(&messageOffset);
      PRUint32 statusOffset = 0;
      (void)message->GetStatusOffset(&statusOffset);
      PRUint32 desiredOffset = messageOffset + statusOffset;

      nsCStringArray keywordArray;
      keywordArray.ParseString(nsCString(aKeywords).get(), " ");
      for (PRInt32 j = 0; j < keywordArray.Count(); j++)
      {
        nsCAutoString header;
        nsCAutoString keywords;
        PRBool done = PR_FALSE;
        PRUint32 len = 0;
        nsCAutoString keywordToWrite(" ");

        keywordToWrite.Append(*(keywordArray[j]));
        seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, desiredOffset);
        // need to reset lineBuffer, which is cheaper than creating a new one.
        lineBuffer->start = lineBuffer->end = lineBuffer->buf;
        PRBool inKeywordHeader = PR_FALSE;
        PRBool foundKeyword = PR_FALSE;
        PRUint32 offsetToAddKeyword = 0;
        PRBool more;
        message->GetMessageSize(&len);
        // loop through
        while (!done)
        {
          PRInt64 lineStartPos;
          seekableStream->Tell(&lineStartPos);
          // we need to adjust the linestart pos by how much extra the line
          // buffer has read from the stream.
          lineStartPos -= (lineBuffer->end - lineBuffer->start);
          // NS_ReadLine doesn't return line termination chars.
          nsCString keywordHeaders;
          rv = NS_ReadLine(inputStream.get(), lineBuffer, keywordHeaders, &more);
          if (NS_SUCCEEDED(rv))
          {
            if (keywordHeaders.IsEmpty())
              break; // passed headers; no x-mozilla-keywords header; give up.
            if (StringBeginsWith(keywordHeaders, NS_LITERAL_CSTRING(HEADER_X_MOZILLA_KEYWORDS)))
              inKeywordHeader = PR_TRUE;
            else if (inKeywordHeader && (keywordHeaders.CharAt(0) == ' ' || keywordHeaders.CharAt(0) == '\t'))
              ; // continuation header line
            else if (inKeywordHeader)
              break;
            else
              continue;
            PRInt32 keywordHdrLength = keywordHeaders.Length();
            PRInt32 startOffset, keywordLength;
            // check if we have the keyword
            if (MsgFindKeyword(*(keywordArray[j]), keywordHeaders, &startOffset, &keywordLength))
            {
              foundKeyword = PR_TRUE;
              if (!add) // if we're removing, remove it, and break;
              {
                keywordHeaders.Cut(startOffset, keywordLength);
                for (PRInt32 i = keywordLength; i > 0; i--)
                  keywordHeaders.Append(' ');
                seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, lineStartPos);
                fileStream->Write(keywordHeaders.get(), keywordHeaders.Length(), &bytesWritten);
              }
              offsetToAddKeyword = 0;
              // if adding and we already have the keyword, done
              done = PR_TRUE;
              break;
            }
            // argh, we need to check all the lines to see if we already have the
            // keyword, but if we don't find it, we want to remember the line and
            // position where we have room to add the keyword.
            if (add)
            {
              nsCAutoString curKeywordHdr(keywordHeaders);
              // strip off line ending spaces.
              curKeywordHdr.Trim(" ", PR_FALSE, PR_TRUE);
              if (!offsetToAddKeyword && curKeywordHdr.Length() + keywordToWrite.Length() < keywordHdrLength)
                offsetToAddKeyword = lineStartPos + curKeywordHdr.Length();
            }
          }
        }
        if (add && !foundKeyword)
        {
          if (!offsetToAddKeyword)
           message->SetUint32Property("growKeywords", 1);
          else
          {
            seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, offsetToAddKeyword);
            fileStream->Write(keywordToWrite.get(), keywordToWrite.Length(), &bytesWritten);
          }
        }
      }
    }
    mDatabase->EndBatch();
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::RemoveKeywordsFromMessages(nsIArray *aMessages, const nsACString& aKeywords)
{
  return ChangeKeywordForMessages(aMessages, aKeywords, PR_FALSE /* remove */);
}
