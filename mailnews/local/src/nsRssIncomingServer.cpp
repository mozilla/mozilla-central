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
 * The Original Code is mozilla mailnews.
 *
 * The Initial Developer of the Original Code is
 * Seth Spitzer <sspitzer@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@nventure.com>
 *   Ian Neal <iann_bugzilla@blueyonder.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "nsIRssService.h"
#include "nsRssIncomingServer.h"
#include "nsMsgFolderFlags.h"
#include "nsINewsBlogFeedDownloader.h"
#include "nsMsgBaseCID.h"
#include "nsILocalFile.h"
#include "nsIMsgFolderNotificationService.h"

#include "nsIMsgLocalMailFolder.h"
#include "nsIDBFolderInfo.h"
#include "nsServiceManagerUtils.h"

nsrefcnt nsRssIncomingServer::gInstanceCount    = 0;

NS_IMPL_ISUPPORTS_INHERITED3(nsRssIncomingServer,
                             nsMsgIncomingServer,
                             nsIRssIncomingServer,
                             nsIMsgFolderListener,
                             nsILocalMailIncomingServer)

nsRssIncomingServer::nsRssIncomingServer()
{
  m_canHaveFilters = PR_TRUE;

  if (gInstanceCount == 0)
  {
    nsresult rv;
    nsCOMPtr<nsIMsgFolderNotificationService> notifyService =
      do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv))
      notifyService->AddListener(this,
          nsIMsgFolderNotificationService::folderAdded |
          nsIMsgFolderNotificationService::folderDeleted |
          nsIMsgFolderNotificationService::folderMoveCopyCompleted |
          nsIMsgFolderNotificationService::folderRenamed);
  }

  gInstanceCount++;
}

nsRssIncomingServer::~nsRssIncomingServer()
{
  gInstanceCount--;

  if (gInstanceCount == 0)
  {
    nsresult rv;
    nsCOMPtr<nsIMsgFolderNotificationService> notifyService =
      do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv))
      notifyService->RemoveListener(this);
  }
}

nsresult nsRssIncomingServer::FillInDataSourcePath(const nsAString& aDataSourceName, nsILocalFile ** aLocation)
{
  nsresult rv;
  // start by gettting the local path for this server
  nsCOMPtr<nsILocalFile> localFile;
  rv = GetLocalPath(getter_AddRefs(localFile));
  NS_ENSURE_SUCCESS(rv, rv);

  // now append the name of the subscriptions data source
  rv = localFile->Append(aDataSourceName);
  NS_IF_ADDREF(*aLocation = localFile);
  return rv;
}

// nsIRSSIncomingServer methods
NS_IMETHODIMP nsRssIncomingServer::GetSubscriptionsDataSourcePath(nsILocalFile ** aLocation)
{
  return FillInDataSourcePath(NS_LITERAL_STRING("feeds.rdf"), aLocation);
}

NS_IMETHODIMP nsRssIncomingServer::GetFeedItemsDataSourcePath(nsILocalFile ** aLocation)
{
  return FillInDataSourcePath(NS_LITERAL_STRING("feeditems.rdf"), aLocation);
}

NS_IMETHODIMP nsRssIncomingServer::CreateDefaultMailboxes(nsIFile *aPath)
{
  NS_ENSURE_ARG_POINTER(aPath);
  nsCOMPtr <nsIFile> path;
  nsresult rv = aPath->Clone(getter_AddRefs(path));
  NS_ENSURE_SUCCESS(rv, rv);
  // for RSS, all we have is Trash
  // XXX or should we be use Local Folders/Trash?
  rv = path->AppendNative(NS_LITERAL_CSTRING("Trash"));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool exists;
  rv = path->Exists(&exists);
  if (!exists)
    rv = path->Create(nsIFile::NORMAL_FILE_TYPE, 0644);
  return rv;
}

NS_IMETHODIMP nsRssIncomingServer::SetFlagsOnDefaultMailboxes()
{
  nsCOMPtr<nsIMsgFolder> rootFolder;
  nsresult rv = GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgLocalMailFolder> localFolder =
      do_QueryInterface(rootFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  localFolder->SetFlagsOnDefaultMailboxes(nsMsgFolderFlags::Trash);
  return NS_OK;
}

NS_IMETHODIMP nsRssIncomingServer::PerformBiff(nsIMsgWindow *aMsgWindow)
{
  // do we need to do anything here besides download articles
  // for each feed? I don't think we have a way to check a feed for new articles without actually
  // getting the articles. Do we need to SetPerformingBiff to true for this server?
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> rootRSSFolder;
  GetRootMsgFolder(getter_AddRefs(rootRSSFolder));

  // enumerate over the RSS folders and ping each one
  nsCOMPtr<nsISupportsArray> allDescendents;
  NS_NewISupportsArray(getter_AddRefs(allDescendents));
  rv = rootRSSFolder->ListDescendents(allDescendents);
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 cnt =0;
  allDescendents->Count(&cnt);

  nsCOMPtr<nsISupports> supports;
  nsCOMPtr<nsIUrlListener> urlListener;
  nsCOMPtr<nsIMsgFolder> rssFolder;

  for (PRUint32 index = 0; index < cnt; index++)
  {
    supports = getter_AddRefs(allDescendents->ElementAt(index));
    rssFolder = do_QueryInterface(supports, &rv);
    if (rssFolder)
    {
      urlListener = do_QueryInterface(rssFolder);
      // WARNING: Never call GetNewMail with the root folder or you will trigger an infinite loop...
      GetNewMail(aMsgWindow, urlListener, rssFolder, nsnull);
    }
  }

  return NS_OK;
}

NS_IMETHODIMP nsRssIncomingServer::GetNewMail(nsIMsgWindow *aMsgWindow, nsIUrlListener *aUrlListener, nsIMsgFolder *aFolder, nsIURI **_retval)
{
  NS_ENSURE_ARG_POINTER(aFolder);

  // before we even try to get New Mail, check to see if the passed in folder was the root folder.
  // If it was, then call PerformBiff which will properly walk through each RSS folder, asking it to check for new Mail.
  PRBool rootFolder = PR_FALSE;
  aFolder->GetIsServer(&rootFolder);
  if (rootFolder)
    return PerformBiff(aMsgWindow);

  PRBool valid = PR_FALSE;
  nsCOMPtr <nsIMsgDatabase> db;
  nsresult rv;
  nsCOMPtr <nsINewsBlogFeedDownloader> rssDownloader = do_GetService("@mozilla.org/newsblog-feed-downloader;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = aFolder->GetMsgDatabase(getter_AddRefs(db));
  if (NS_SUCCEEDED(rv) && db)
  {
    rv = db->GetSummaryValid(&valid);
    NS_ASSERTION(valid, "db is invalid");
    if (valid)
    {
      nsCOMPtr <nsIDBFolderInfo> folderInfo;
      rv = db->GetDBFolderInfo(getter_AddRefs(folderInfo));
      if (folderInfo)
      {
        nsCString url;
        nsString folderName;
        aFolder->GetName(folderName);
        folderInfo->GetCharProperty("feedUrl", url);

        rv = rssDownloader->DownloadFeed(url.get(),
                                         aFolder, PR_FALSE, folderName.get(), aUrlListener, aMsgWindow);
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsRssIncomingServer::GetAccountManagerChrome(nsAString& aResult)
{
  aResult.AssignLiteral("am-newsblog.xul");
  return NS_OK;
}

NS_IMETHODIMP nsRssIncomingServer::GetOfflineSupportLevel(PRInt32 *aSupportLevel)
{
  NS_ENSURE_ARG_POINTER(aSupportLevel);
  *aSupportLevel = OFFLINE_SUPPORT_LEVEL_NONE;
  return NS_OK;
}

NS_IMETHODIMP nsRssIncomingServer::GetSupportsDiskSpace(PRBool *aSupportsDiskSpace)
{
  NS_ENSURE_ARG_POINTER(aSupportsDiskSpace);
  *aSupportsDiskSpace = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsRssIncomingServer::GetServerRequiresPasswordForBiff(PRBool *aServerRequiresPasswordForBiff)
{
  NS_ENSURE_ARG_POINTER(aServerRequiresPasswordForBiff);
  *aServerRequiresPasswordForBiff = PR_FALSE;  // for rss folders, we don't require a password
  return NS_OK;
}

NS_IMETHODIMP nsRssIncomingServer::GetCanSearchMessages(PRBool *canSearchMessages)
{
  NS_ENSURE_ARG_POINTER(canSearchMessages);
  *canSearchMessages = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsRssIncomingServer::MsgAdded(nsIMsgDBHdr *aMsg)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsRssIncomingServer::MsgsClassified(nsIArray *aMsgs,
                                                  PRBool aJunkProcessed,
                                                  PRBool aTraitProcessed)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsRssIncomingServer::MsgsDeleted(nsIArray *aMsgs)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsRssIncomingServer::MsgsMoveCopyCompleted(
  PRBool aMove, nsIArray *aSrcMsgs, nsIMsgFolder *aDestFolder,
  nsIArray *aDestMsgs)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsRssIncomingServer::FolderAdded(nsIMsgFolder *aFolder)
{
  return FolderChanged(aFolder, PR_FALSE);
}

NS_IMETHODIMP nsRssIncomingServer::FolderDeleted(nsIMsgFolder *aFolder)
{
  return FolderChanged(aFolder, PR_TRUE);
}

NS_IMETHODIMP nsRssIncomingServer::FolderMoveCopyCompleted(PRBool aMove, nsIMsgFolder *aSrcFolder, nsIMsgFolder *aDestFolder)
{
  return FolderChanged(aSrcFolder, PR_FALSE);
}

NS_IMETHODIMP nsRssIncomingServer::FolderRenamed(nsIMsgFolder *aOrigFolder, nsIMsgFolder *aNewFolder)
{
  return FolderChanged(aNewFolder, PR_FALSE);
}

NS_IMETHODIMP nsRssIncomingServer::ItemEvent(nsISupports *aItem, const nsACString &aEvent, nsISupports *aData)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

nsresult nsRssIncomingServer::FolderChanged(nsIMsgFolder *aFolder, PRBool aUnsubscribe)
{
  if (!aFolder)
    return NS_OK;

  nsCOMPtr<nsIMsgIncomingServer> server;
  nsresult rv = aFolder->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString type;
  rv = server->GetType(type);
  NS_ENSURE_SUCCESS(rv, rv);

  if (type.EqualsLiteral("rss"))
  {
    nsCOMPtr <nsINewsBlogFeedDownloader> rssDownloader = do_GetService("@mozilla.org/newsblog-feed-downloader;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    rssDownloader->UpdateSubscriptionsDS(aFolder, aUnsubscribe);

    if (!aUnsubscribe)
    {
      // If the user was moving a set of nested folders, we only
      // get a single notification, so we need to iterate over all of the
      // descedent folders of the folder whose location has changed.
      nsCOMPtr<nsISupportsArray> allDescendents;
      NS_NewISupportsArray(getter_AddRefs(allDescendents));
      rv = aFolder->ListDescendents(allDescendents);
      NS_ENSURE_SUCCESS(rv, rv);

      PRUint32 cnt = 0;
      allDescendents->Count(&cnt);

      nsCOMPtr<nsISupports> supports;
      nsCOMPtr<nsIMsgFolder> rssFolder;

      for (PRUint32 index = 0; index < cnt; index++)
      {
        supports = getter_AddRefs(allDescendents->ElementAt(index));
        rssFolder = do_QueryInterface(supports, &rv);
        if (rssFolder)
          rssDownloader->UpdateSubscriptionsDS(rssFolder, aUnsubscribe);
      }
    }
  }
  return rv;
}
