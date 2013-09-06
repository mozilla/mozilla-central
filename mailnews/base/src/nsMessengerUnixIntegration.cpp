/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMessengerUnixIntegration.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgIncomingServer.h"
#include "nsIMsgIdentity.h"
#include "nsIMsgAccount.h"
#include "nsIMsgFolder.h"
#include "nsIMsgWindow.h"
#include "nsCOMPtr.h"
#include "nsMsgBaseCID.h"
#include "nsMsgFolderFlags.h"
#include "nsDirectoryServiceDefs.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsIDirectoryService.h"
#include "nsIWindowWatcher.h"
#include "nsIWindowMediator.h"
#include "nsIDOMWindow.h"
#include "nsPIDOMWindow.h"
#include "nsIDocShell.h"
#include "nsIBaseWindow.h"
#include "nsIWidget.h"
#include "MailNewsTypes.h"
#include "nsIMessengerWindowService.h"
#include "prprf.h"
#include "nsIWeakReference.h"
#include "nsIStringBundle.h"
#include "nsIAlertsService.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsISupportsPrimitives.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsIMsgHeaderParser.h"
#include "nsAutoPtr.h"
#include "prmem.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsIWeakReferenceUtils.h"

#include "nsNativeCharsetUtils.h"
#include "nsToolkitCompsCID.h"
#include "nsMsgUtils.h"
#include "msgCore.h"
#include "nsCOMArray.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsMemory.h"
#include "mozilla/Services.h"

#define ALERT_CHROME_URL "chrome://messenger/content/newmailalert.xul"
#define NEW_MAIL_ALERT_ICON "chrome://messenger/skin/icons/new-mail-alert.png"
#define SHOW_ALERT_PREF "mail.biff.show_alert"
#define SHOW_ALERT_PREVIEW_LENGTH "mail.biff.alert.preview_length"
#define SHOW_ALERT_PREVIEW_LENGTH_DEFAULT 40
#define SHOW_ALERT_PREVIEW "mail.biff.alert.show_preview"
#define SHOW_ALERT_SENDER  "mail.biff.alert.show_sender"
#define SHOW_ALERT_SUBJECT "mail.biff.alert.show_subject"

static void openMailWindow(const nsACString& aFolderUri)
{
  nsresult rv;
  nsCOMPtr<nsIMsgMailSession> mailSession ( do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return;

  nsCOMPtr<nsIMsgWindow> topMostMsgWindow;
  rv = mailSession->GetTopmostMsgWindow(getter_AddRefs(topMostMsgWindow));
  if (topMostMsgWindow)
  {
    if (!aFolderUri.IsEmpty())
    {
      nsCOMPtr<nsIMsgWindowCommands> windowCommands;
      topMostMsgWindow->GetWindowCommands(getter_AddRefs(windowCommands));
      if (windowCommands)
        windowCommands->SelectFolder(aFolderUri);
    }

    nsCOMPtr<nsIDOMWindow> domWindow;
    topMostMsgWindow->GetDomWindow(getter_AddRefs(domWindow));
    domWindow->Focus();
  }
  else
  {
    // the user doesn't have a mail window open already so open one for them...
    nsCOMPtr<nsIMessengerWindowService> messengerWindowService =
      do_GetService(NS_MESSENGERWINDOWSERVICE_CONTRACTID);
    // if we want to preselect the first account with new mail,
    // here is where we would try to generate a uri to pass in
    // (and add code to the messenger window service to make that work)
    if (messengerWindowService)
      messengerWindowService->OpenMessengerWindowWithUri(
                                "mail:3pane", nsCString(aFolderUri).get(), nsMsgKey_None);
  }
}

nsMessengerUnixIntegration::nsMessengerUnixIntegration()
{
  mBiffStateAtom = MsgGetAtom("BiffState");
  mNewMailReceivedAtom = MsgGetAtom("NewMailReceived");
  mAlertInProgress = false;
  mFoldersWithNewMail = do_CreateInstance(NS_ARRAY_CONTRACTID);
}

NS_IMPL_ISUPPORTS4(nsMessengerUnixIntegration, nsIFolderListener, nsIObserver,
                   nsIMessengerOSIntegration, nsIUrlListener)

nsresult
nsMessengerUnixIntegration::Init()
{
  nsresult rv;

  nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  return mailSession->AddFolderListener(this, nsIFolderListener::intPropertyChanged);
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnItemPropertyChanged(nsIMsgFolder *, nsIAtom *, char const *, char const *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnItemUnicharPropertyChanged(nsIMsgFolder *, nsIAtom *, const PRUnichar *, const PRUnichar *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnItemRemoved(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

nsresult nsMessengerUnixIntegration::GetStringBundle(nsIStringBundle **aBundle)
{
  NS_ENSURE_ARG_POINTER(aBundle);
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
  nsCOMPtr<nsIStringBundle> bundle;
  bundleService->CreateBundle("chrome://messenger/locale/messenger.properties",
                              getter_AddRefs(bundle));
  bundle.swap(*aBundle);
  return NS_OK;
}

bool
nsMessengerUnixIntegration::BuildNotificationTitle(nsIMsgFolder *aFolder, nsIStringBundle *aBundle, nsString &aTitle)
{
  nsString accountName;
  aFolder->GetPrettiestName(accountName);

  int32_t numNewMessages = 0;
  aFolder->GetNumNewMessages(true, &numNewMessages);

  if (!numNewMessages)
    return false;

  nsAutoString numNewMsgsText;
  numNewMsgsText.AppendInt(numNewMessages);

  const PRUnichar *formatStrings[] =
  {
    accountName.get(), numNewMsgsText.get()
  };

  aBundle->FormatStringFromName(numNewMessages == 1 ?
                                  NS_LITERAL_STRING("newMailNotification_message").get() :
                                  NS_LITERAL_STRING("newMailNotification_messages").get(),
                                formatStrings, 2, getter_Copies(aTitle));
  return true;
}

/* This comparator lets us sort an nsCOMArray of nsIMsgDBHdr's by
 * their dateInSeconds attributes in ascending order.
 */
static int
nsMsgDbHdrTimestampComparator(nsIMsgDBHdr *aElement1,
                              nsIMsgDBHdr *aElement2,
                              void *aData)
{
  uint32_t aElement1Timestamp;
  nsresult rv = aElement1->GetDateInSeconds(&aElement1Timestamp);
  if (NS_FAILED(rv))
    return 0;

  uint32_t aElement2Timestamp;
  rv = aElement2->GetDateInSeconds(&aElement2Timestamp);
  if (NS_FAILED(rv))
    return 0;

  return aElement1Timestamp - aElement2Timestamp;
}


bool
nsMessengerUnixIntegration::BuildNotificationBody(nsIMsgDBHdr *aHdr,
                                                  nsIStringBundle *aBundle,
                                                  nsString &aBody)
{
  nsAutoString alertBody;

  bool showPreview = true;
  bool showSubject = true;
  bool showSender = true;
  int32_t previewLength = SHOW_ALERT_PREVIEW_LENGTH_DEFAULT;

  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (!prefBranch)
    return false;

  prefBranch->GetBoolPref(SHOW_ALERT_PREVIEW, &showPreview);
  prefBranch->GetBoolPref(SHOW_ALERT_SENDER, &showSender);
  prefBranch->GetBoolPref(SHOW_ALERT_SUBJECT, &showSubject);
  prefBranch->GetIntPref(SHOW_ALERT_PREVIEW_LENGTH, &previewLength);

  nsCOMPtr<nsIMsgHeaderParser> parser = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID);
  if (!parser)
    return false;

  nsCOMPtr<nsIMsgFolder> folder;
  aHdr->GetFolder(getter_AddRefs(folder));

  if (!folder)
    return false;

  nsCString msgURI;
  folder->GetUriForMsg(aHdr, msgURI);

  bool localOnly;

  uint32_t msgURIIndex = mFetchingURIs.IndexOf(msgURI);
  if (msgURIIndex == mFetchingURIs.NoIndex)
  {
    localOnly = false;
    mFetchingURIs.AppendElement(msgURI);
  }
  else
    localOnly = true;

  uint32_t messageKey;
  if (NS_FAILED(aHdr->GetMessageKey(&messageKey)))
    return false;

  bool asyncResult = false;
  nsresult rv = folder->FetchMsgPreviewText(&messageKey, 1,
                                            localOnly, this,
                                            &asyncResult);
  // If we're still waiting on getting the message previews,
  // bail early.  We'll come back later when the async operation
  // finishes.
  if (NS_FAILED(rv) || asyncResult)
    return false;

  // If we got here, that means that we've retrieved the message preview,
  // so we can stop tracking it with our mFetchingURIs array.
  if (msgURIIndex != mFetchingURIs.NoIndex)
    mFetchingURIs.RemoveElementAt(msgURIIndex);

  nsCString utf8previewString;
  if (showPreview &&
      NS_FAILED(aHdr->GetStringProperty("preview", getter_Copies(utf8previewString))))
    return false;

  // need listener that mailbox is remote such as IMAP
  // to generate preview message
  nsString previewString;
  CopyUTF8toUTF16(utf8previewString, previewString);

  nsString subject;
  if (showSubject && NS_FAILED(aHdr->GetMime2DecodedSubject(subject)))
    return false;

  nsString author;
  if (showSender)
  {
    if (NS_FAILED(aHdr->GetMime2DecodedAuthor(author)))
      return false;

    PRUnichar **emails;
    PRUnichar **names;
    PRUnichar **fullnames;
    uint32_t num;
    if (NS_FAILED(parser->ParseHeadersWithArray(author.get(),
                  &emails,
                  &names,
                  &fullnames, &num)))
      return false;

    if (num > 0)
    {
      author.Assign(names[0] ? names[0] : emails[0]);

      NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(num, emails);
      NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(num, names);
      NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(num, fullnames);
    }
  }

  if (showSubject && showSender)
  {
    nsString msgTitle;
    const PRUnichar *formatStrings[] =
    {
      subject.get(), author.get()
    };
    aBundle->FormatStringFromName(NS_LITERAL_STRING("newMailNotification_messagetitle").get(),
        formatStrings, 2, getter_Copies(msgTitle));
    alertBody.Append(msgTitle);
  }
  else if (showSubject)
    alertBody.Append(subject);
  else if (showSender)
    alertBody.Append(author);

  if (showPreview && (showSubject || showSender))
  {
    alertBody.AppendLiteral("\n");
  }

  if (showPreview)
    alertBody.Append(StringHead(previewString, previewLength));

  if (alertBody.IsEmpty())
    return false;

  aBody.Assign(alertBody);
  return true;
}

nsresult nsMessengerUnixIntegration::ShowAlertMessage(const nsAString& aAlertTitle, const nsAString& aAlertText, const nsACString& aFolderURI)
{
  nsresult rv;
  // if we are already in the process of showing an alert, don't try to show another....
  if (mAlertInProgress)
    return NS_OK;

  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  bool showAlert = true;
  prefBranch->GetBoolPref(SHOW_ALERT_PREF, &showAlert);

  if (showAlert)
  {
    mAlertInProgress = true;
    nsCOMPtr<nsIAlertsService> alertsService(do_GetService(NS_SYSTEMALERTSERVICE_CONTRACTID, &rv));
    if (NS_SUCCEEDED(rv)) {
      rv = alertsService->ShowAlertNotification(NS_LITERAL_STRING(NEW_MAIL_ALERT_ICON),
                                                aAlertTitle,
                                                aAlertText,
                                                false,
                                                NS_ConvertASCIItoUTF16(aFolderURI),
                                                this,
                                                EmptyString(),
                                                NS_LITERAL_STRING("auto"),
                                                EmptyString());
      if (NS_SUCCEEDED(rv))
        return rv;
    }
    AlertFinished();
    rv = ShowNewAlertNotification(false);

  }

  if (NS_FAILED(rv)) // go straight to showing the system tray icon.
    AlertFinished();

  return rv;
}

// Opening Thunderbird's new mail alert notification window for not supporting libnotify
// aUserInitiated --> true if we are opening the alert notification in response to a user action
//                    like clicking on the biff icon
nsresult nsMessengerUnixIntegration::ShowNewAlertNotification(bool aUserInitiated)
{

  nsresult rv;

  // if we are already in the process of showing an alert, don't try to show another....
  if (mAlertInProgress)
    return NS_OK;

  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  bool showAlert = true;
  prefBranch->GetBoolPref(SHOW_ALERT_PREF, &showAlert);

  if (showAlert)
  {
    nsCOMPtr<nsIMutableArray> argsArray = do_CreateInstance(NS_ARRAY_CONTRACTID);
    if (!argsArray)
      return NS_ERROR_FAILURE;

    // pass in the array of folders with unread messages
    nsCOMPtr<nsISupportsInterfacePointer> ifptr = do_CreateInstance(NS_SUPPORTS_INTERFACE_POINTER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    ifptr->SetData(mFoldersWithNewMail);
    ifptr->SetDataIID(&NS_GET_IID(nsIArray));
    argsArray->AppendElement(ifptr, false);

    // pass in the observer
    ifptr = do_CreateInstance(NS_SUPPORTS_INTERFACE_POINTER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsISupports> supports = do_QueryInterface(static_cast<nsIMessengerOSIntegration*>(this));
    ifptr->SetData(supports);
    ifptr->SetDataIID(&NS_GET_IID(nsIObserver));
    argsArray->AppendElement(ifptr, false);

    // pass in the animation flag
    nsCOMPtr<nsISupportsPRBool> scriptableUserInitiated (do_CreateInstance(NS_SUPPORTS_PRBOOL_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    scriptableUserInitiated->SetData(aUserInitiated);
    argsArray->AppendElement(scriptableUserInitiated, false);

    nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID));
    nsCOMPtr<nsIDOMWindow> newWindow;

    mAlertInProgress = true;
    rv = wwatch->OpenWindow(0, ALERT_CHROME_URL, "_blank",
                            "chrome,dialog=yes,titlebar=no,popup=yes", argsArray,
                            getter_AddRefs(newWindow));

    if (NS_FAILED(rv))
      AlertFinished();
  }

  return rv;
}

nsresult nsMessengerUnixIntegration::AlertFinished()
{
  mAlertInProgress = false;
  return NS_OK;
}

nsresult nsMessengerUnixIntegration::AlertClicked()
{
  nsCString folderURI;
  GetFirstFolderWithNewMail(folderURI);
  openMailWindow(folderURI);
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::Observe(nsISupports* aSubject, const char* aTopic, const PRUnichar* aData)
{
  if (strcmp(aTopic, "alertfinished") == 0)
    return AlertFinished();
  if (strcmp(aTopic, "alertclickcallback") == 0)
    return AlertClicked();

  return NS_OK;
}

void nsMessengerUnixIntegration::FillToolTipInfo()
{
  nsCString folderUri;
  GetFirstFolderWithNewMail(folderUri);

  uint32_t count = 0;
  NS_ENSURE_SUCCESS_VOID(mFoldersWithNewMail->GetLength(&count));

  nsCOMPtr<nsIWeakReference> weakReference;
  nsCOMPtr<nsIMsgFolder> folder = nullptr;
  nsCOMPtr<nsIMsgFolder> folderWithNewMail = nullptr;

  uint32_t i;
  for (i = 0; i < count && !folderWithNewMail; i++)
  {
    weakReference = do_QueryElementAt(mFoldersWithNewMail, i);
    folder = do_QueryReferent(weakReference);
    folder->GetChildWithURI(folderUri, true, true,
                            getter_AddRefs(folderWithNewMail));
  }

  if (folder && folderWithNewMail)
  {
    nsCOMPtr<nsIStringBundle> bundle;
    GetStringBundle(getter_AddRefs(bundle));

    if (!bundle)
      return;

    // Create the notification title
    nsString alertTitle;
    if (!BuildNotificationTitle(folder, bundle, alertTitle))
      return;

    // Let's get the new mail for this folder
    nsCOMPtr<nsIMsgDatabase> db;
    if (NS_FAILED(folderWithNewMail->GetMsgDatabase(getter_AddRefs(db))))
      return;

    uint32_t numNewKeys = 0;
    uint32_t *newMessageKeys;
    db->GetNewList(&numNewKeys, &newMessageKeys);

    // If we had new messages, we *should* have new keys, but we'll
    // check just in case.
    if (numNewKeys <= 0) {
      NS_Free(newMessageKeys);
      return;
    }

    // Find the rootFolder that folder belongs to, and find out
    // what MRUTime it maps to.  Assign this to lastMRUTime.
    uint32_t lastMRUTime = 0;
    if (NS_FAILED(GetMRUTimestampForFolder(folder, &lastMRUTime)))
      lastMRUTime = 0;

    // Next, add the new message headers to an nsCOMArray.  We
    // only add message headers that are newer than lastMRUTime.
    nsCOMArray<nsIMsgDBHdr> newMsgHdrs;
    for (unsigned int i = 0; i < numNewKeys; ++i) {
      nsCOMPtr<nsIMsgDBHdr> hdr;
      if (NS_FAILED(db->GetMsgHdrForKey(newMessageKeys[i], getter_AddRefs(hdr))))
        continue;

      uint32_t dateInSeconds = 0;
      hdr->GetDateInSeconds(&dateInSeconds);

      if (dateInSeconds > lastMRUTime)
        newMsgHdrs.AppendObject(hdr);

    }

    // At this point, we don't need newMessageKeys any more,
    // so let's free it.
    NS_Free(newMessageKeys);

    // If we didn't happen to add any message headers, bail out
    if (!newMsgHdrs.Count())
      return;

    // Sort the message headers by dateInSeconds, in ascending
    // order
    newMsgHdrs.Sort(nsMsgDbHdrTimestampComparator, nullptr);

    nsString alertBody;

    // Build the body text of the notification.
    if (!BuildNotificationBody(newMsgHdrs[0], bundle, alertBody))
      return;

    // Show the notification
    ShowAlertMessage(alertTitle, alertBody, EmptyCString());

    // Find the last, and therefore newest message header
    // in our nsCOMArray
    nsCOMPtr<nsIMsgDBHdr> lastMsgHdr = newMsgHdrs[newMsgHdrs.Count() - 1];

    uint32_t dateInSeconds = 0;
    if (NS_FAILED(lastMsgHdr->GetDateInSeconds(&dateInSeconds)))
      return;

    // Write the newest message timestamp to the appropriate
    // mapping in our hashtable of MRUTime's.
    PutMRUTimestampForFolder(folder, dateInSeconds);
  } // if we got a folder
}

// Get the first top level folder which we know has new mail, then enumerate over
// all the subfolders looking for the first real folder with new mail.
// Return the folderURI for that folder.
nsresult nsMessengerUnixIntegration::GetFirstFolderWithNewMail(nsACString& aFolderURI)
{
  NS_ENSURE_TRUE(mFoldersWithNewMail, NS_ERROR_FAILURE);

  nsCOMPtr<nsIMsgFolder> folder;
  nsCOMPtr<nsIWeakReference> weakReference;

  uint32_t count = 0;
  nsresult rv = mFoldersWithNewMail->GetLength(&count);
  if (NS_FAILED(rv) || !count)  // kick out if we don't have any folders with new mail
    return NS_OK;

  uint32_t i;
  for(i = 0; i < count; i++)
  {
    weakReference = do_QueryElementAt(mFoldersWithNewMail, i);
    folder = do_QueryReferent(weakReference);

    // We only want to find folders which haven't been notified
    // yet.  This is specific to Thunderbird.  In Seamonkey, we
    // just return 0, and we don't care about timestamps anymore.
    uint32_t lastMRUTime = 0;
    rv = GetMRUTimestampForFolder(folder, &lastMRUTime);
    if (NS_FAILED(rv))
      lastMRUTime = 0;

    if (!folder)
      continue;
    // enumerate over the folders under this root folder till we find one with new mail....
    nsCOMPtr<nsIMsgFolder> msgFolder;
    nsCOMPtr<nsIArray> allFolders;
    rv = folder->GetDescendants(getter_AddRefs(allFolders));
    NS_ENSURE_SUCCESS(rv, rv);

    uint32_t subfolderCount = 0;
    allFolders->GetLength(&subfolderCount);
    uint32_t j;
    for (j = 0; j < subfolderCount; j++)
    {
      nsCOMPtr<nsIMsgFolder> msgFolder = do_QueryElementAt(allFolders, j);

      if (!msgFolder)
        continue;

      uint32_t flags;
      rv = msgFolder->GetFlags(&flags);

      if (NS_FAILED(rv))
        continue;

      // Unless we're dealing with an Inbox, we don't care
      // about Drafts, Queue, SentMail, Template, or Junk folders
      if (!(flags & nsMsgFolderFlags::Inbox) &&
           (flags & (nsMsgFolderFlags::SpecialUse & ~nsMsgFolderFlags::Inbox)))
        continue;

      nsCString folderURI;
      msgFolder->GetURI(folderURI);
      bool hasNew = false;
      rv = msgFolder->GetHasNewMessages(&hasNew);

      if (NS_FAILED(rv))
        continue;

      // Grab the MRUTime property from the folder
      nsCString dateStr;
      msgFolder->GetStringProperty(MRU_TIME_PROPERTY, dateStr);
      uint32_t MRUTime = (uint32_t) dateStr.ToInteger(&rv, 10);
      if (NS_FAILED(rv))
        MRUTime = 0;

      if (hasNew && MRUTime > lastMRUTime)
      {
        rv = msgFolder->GetURI(aFolderURI);
        NS_ENSURE_SUCCESS(rv, rv);
        return NS_OK;
      }
    }  // if we have more potential folders to enumerate
  }

  // If we got here, then something when pretty wrong.
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, uint32_t oldFlag, uint32_t newFlag)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnItemAdded(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnItemBoolPropertyChanged(nsIMsgFolder *aItem,
                                                         nsIAtom *aProperty,
                                                         bool aOldValue,
                                                         bool aNewValue)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnItemEvent(nsIMsgFolder *, nsIAtom *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnItemIntPropertyChanged(nsIMsgFolder *aItem, nsIAtom *aProperty, int32_t aOldValue, int32_t aNewValue)
{
  nsCString atomName;
  // if we got new mail show an icon in the system tray
  if (mBiffStateAtom == aProperty && mFoldersWithNewMail)
  {
    nsCOMPtr<nsIWeakReference> weakFolder = do_GetWeakReference(aItem);
    uint32_t indexInNewArray;
    nsresult rv = mFoldersWithNewMail->IndexOf(0, weakFolder, &indexInNewArray);
    bool folderFound = NS_SUCCEEDED(rv);

    if (aNewValue == nsIMsgFolder::nsMsgBiffState_NewMail)
    {
      // only show a system tray icon iff we are performing biff
      // (as opposed to the user getting new mail)
      bool performingBiff = false;
      nsCOMPtr<nsIMsgIncomingServer> server;
      aItem->GetServer(getter_AddRefs(server));
      if (server)
        server->GetPerformingBiff(&performingBiff);
      if (!performingBiff)
        return NS_OK; // kick out right now...

      if (!folderFound)
        mFoldersWithNewMail->AppendElement(weakFolder, false);
      // now regenerate the tooltip
      FillToolTipInfo();
    }
    else if (aNewValue == nsIMsgFolder::nsMsgBiffState_NoMail)
    {
      if (folderFound) {
        mFoldersWithNewMail->RemoveElementAt(indexInNewArray);
      }
    }
  } // if the biff property changed
  else if (mNewMailReceivedAtom == aProperty)
  {
    FillToolTipInfo();
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnStartRunningUrl(nsIURI *aUrl)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerUnixIntegration::OnStopRunningUrl(nsIURI *aUrl, nsresult aExitCode)
{
  if (NS_SUCCEEDED(aExitCode))
    // preview fetch is done.
    FillToolTipInfo();
  return NS_OK;
}

nsresult
nsMessengerUnixIntegration::GetMRUTimestampForFolder(nsIMsgFolder *aFolder,
                                                     uint32_t *aLastMRUTime)
{
  nsCOMPtr<nsIMsgFolder> rootFolder = nullptr;
  nsresult rv = aFolder->GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString rootFolderURI;
  rootFolder->GetURI(rootFolderURI);
  if (!mLastMRUTimes.Get(rootFolderURI, aLastMRUTime))
    aLastMRUTime = 0;

  return NS_OK;
}

nsresult
nsMessengerUnixIntegration::PutMRUTimestampForFolder(nsIMsgFolder *aFolder,
                                                     uint32_t aLastMRUTime)
{
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> rootFolder = nullptr;
  rv = aFolder->GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString rootFolderURI;
  rootFolder->GetURI(rootFolderURI);
  mLastMRUTimes.Put(rootFolderURI, aLastMRUTime);

  return NS_OK;
}
