/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsMsgUtils.h"
#include "nsMessengerOSXIntegration.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgIncomingServer.h"
#include "nsIMsgIdentity.h"
#include "nsIMsgAccount.h"
#include "nsIMsgFolder.h"
#include "nsCOMPtr.h"
#include "nsMsgBaseCID.h"
#include "nsMsgFolderFlags.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIDirectoryService.h"
#include "MailNewsTypes.h"
#include "nsIWindowMediator.h"
#include "nsIDOMChromeWindow.h"
#include "nsIDOMWindow.h"
#include "nsPIDOMWindow.h"
#include "nsIDocShell.h"
#include "nsIBaseWindow.h"
#include "nsIWidget.h"
#include "nsIObserverService.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIMessengerWindowService.h"
#include "prprf.h"
#include "nsIAlertsService.h"
#include "nsIStringBundle.h"
#include "nsToolkitCompsCID.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsIMsgHeaderParser.h"
#include "nsISupportsPrimitives.h"
#include "nsIWindowWatcher.h"
#include "nsMsgLocalCID.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMsgWindow.h"
#include "nsIMsgAccountManager.h"
#include "nsIMessenger.h"
#include "nsObjCExceptions.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "mozINewMailNotificationService.h"

#include <Carbon/Carbon.h>
#import <Cocoa/Cocoa.h>

#define kNewMailAlertIcon "chrome://messenger/skin/icons/new-mail-alert.png"
#define kChatEnabledPref "mail.chat.enabled"
#define kBiffShowAlertPref "mail.biff.show_alert"
#define kBiffAnimateDockIconPref "mail.biff.animate_dock_icon"
#define kMaxDisplayCount 10
#define kNewChatMessageTopic "new-directed-incoming-message"
#define kUnreadImCountChangedTopic "unread-im-count-changed"

// HACK: Limitations in Focus/SetFocus on Mac (see bug 465446)
nsresult FocusAppNative()
{
  ProcessSerialNumber psn;

  if (::GetCurrentProcess(&psn) != 0)
   return NS_ERROR_FAILURE;

  if (::SetFrontProcess(&psn) != 0)
   return NS_ERROR_FAILURE;

  return NS_OK;
}

static void openMailWindow(const nsCString& aUri)
{
  nsresult rv;
  nsCOMPtr<nsIMsgMailSession> mailSession ( do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return;

  nsCOMPtr<nsIMsgWindow> topMostMsgWindow;
  rv = mailSession->GetTopmostMsgWindow(getter_AddRefs(topMostMsgWindow));
  if (topMostMsgWindow)
  {
    if (!aUri.IsEmpty())
    {
      nsCOMPtr<nsIMsgMailNewsUrl> msgUri(do_CreateInstance(NS_MAILBOXURL_CONTRACTID, &rv));
      if (NS_FAILED(rv))
        return;

      rv = msgUri->SetSpec(aUri);
      if (NS_FAILED(rv))
        return;

      bool isMessageUri = false;
      msgUri->GetIsMessageUri(&isMessageUri);
      if (isMessageUri)
      {
        nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv));
        if (NS_FAILED(rv))
          return;

        // SeaMonkey only supports message uris, whereas Thunderbird only
        // supports message headers. This should be simplified/removed when
        // bug 507593 is implemented.
#ifdef MOZ_SUITE
        nsCOMPtr<nsIDOMWindow> newWindow;
        wwatch->OpenWindow(0, "chrome://messenger/content/messageWindow.xul",
                           "_blank", "all,chrome,dialog=no,status,toolbar", msgUri,
                           getter_AddRefs(newWindow));
#else
        nsCOMPtr<nsIMessenger> messenger(do_CreateInstance(NS_MESSENGER_CONTRACTID, &rv));
        if (NS_FAILED(rv))
          return;

        nsCOMPtr<nsIMsgDBHdr> msgHdr; 
        messenger->MsgHdrFromURI(aUri, getter_AddRefs(msgHdr));
        if (msgHdr)
        {
          nsCOMPtr<nsIDOMWindow> newWindow;
          wwatch->OpenWindow(0, "chrome://messenger/content/messageWindow.xul",
                             "_blank", "all,chrome,dialog=no,status,toolbar", msgHdr,
                             getter_AddRefs(newWindow));
        }
#endif
      }
      else
      {
        nsCOMPtr<nsIMsgWindowCommands> windowCommands;
        topMostMsgWindow->GetWindowCommands(getter_AddRefs(windowCommands));
        if (windowCommands)
          windowCommands->SelectFolder(aUri);
      }
    }

    FocusAppNative();
    nsCOMPtr<nsIDOMWindow> domWindow;
    topMostMsgWindow->GetDomWindow(getter_AddRefs(domWindow));
    if (domWindow)
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
                                "mail:3pane", aUri.get(), nsMsgKey_None);
  }
}

nsMessengerOSXIntegration::nsMessengerOSXIntegration()
{
  mBiffStateAtom = MsgGetAtom("BiffState");
  mNewMailReceivedAtom = MsgGetAtom("NewMailReceived");
  mUnreadTotal = 0;
  mUnreadChat = 0;
}

nsMessengerOSXIntegration::~nsMessengerOSXIntegration()
{
  RestoreDockIcon();
}

NS_IMPL_ADDREF(nsMessengerOSXIntegration)
NS_IMPL_RELEASE(nsMessengerOSXIntegration)

NS_INTERFACE_MAP_BEGIN(nsMessengerOSXIntegration)
   NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMessengerOSIntegration)
   NS_INTERFACE_MAP_ENTRY(nsIMessengerOSIntegration)
   NS_INTERFACE_MAP_ENTRY(nsIFolderListener)
   NS_INTERFACE_MAP_ENTRY(nsIObserver)
   NS_INTERFACE_MAP_ENTRY(mozINewMailListener)
NS_INTERFACE_MAP_END


nsresult
nsMessengerOSXIntegration::Init()
{
  nsresult rv;
  nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return observerService->AddObserver(this, "mail-startup-done", false);
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemPropertyChanged(nsIMsgFolder *, nsIAtom *, char const *, char const *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemUnicharPropertyChanged(nsIMsgFolder *, nsIAtom *, const PRUnichar *, const PRUnichar *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemRemoved(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::Observe(nsISupports* aSubject, const char* aTopic, const PRUnichar* aData)
{
  if (!strcmp(aTopic, "alertfinished"))
    return OnAlertFinished();

  if (!strcmp(aTopic, "alertclickcallback"))
    return OnAlertClicked(aData);

  if (!strcmp(aTopic, "mail-startup-done")) {
    nsresult rv;
    nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1", &rv);
    if (NS_SUCCEEDED(rv)) {
      observerService->RemoveObserver(this, "mail-startup-done");

      bool chatEnabled = false;
      nsCOMPtr<nsIPrefBranch> pref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
      if (NS_SUCCEEDED(rv))
        rv = pref->GetBoolPref(kChatEnabledPref, &chatEnabled);
      if (NS_SUCCEEDED(rv) && chatEnabled) {
        observerService->AddObserver(this, kNewChatMessageTopic, false);
        observerService->AddObserver(this, kUnreadImCountChangedTopic, false);
      }
    }

    // Register with the new mail service for changes to the unread message count
    nsCOMPtr<mozINewMailNotificationService> newmail
      = do_GetService(MOZ_NEWMAILNOTIFICATIONSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv); // This should really be an assert with a helpful message
    rv = newmail->AddListener(this, mozINewMailNotificationService::count);
    NS_ENSURE_SUCCESS(rv, rv); // This should really be an assert with a helpful message

    // Get the initial unread count. Ignore return value; if code above didn't fail, this won't
    rv = newmail->GetMessageCount(&mUnreadTotal);
    BadgeDockIcon();

    // register with the mail sesson for folder events
    // we care about new count, biff status
    nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    return mailSession->AddFolderListener(this, nsIFolderListener::boolPropertyChanged | nsIFolderListener::intPropertyChanged);
  }

  if (!strcmp(aTopic, kNewChatMessageTopic)) {
    // We don't have to bother about checking if the window is already focused
    // before attempting to bounce the dock icon, as BounceDockIcon is
    // implemented by a getAttention call which won't do anything if the window
    // requesting attention is already focused.
    return BounceDockIcon();
  }

  if (!strcmp(aTopic, kUnreadImCountChangedTopic)) {
    nsresult rv;
    nsCOMPtr<nsISupportsPRInt32> unreadCount = do_QueryInterface(aSubject, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = unreadCount->GetData(&mUnreadChat);
    NS_ENSURE_SUCCESS(rv, rv);

    return BadgeDockIcon();
  }

  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::GetStringBundle(nsIStringBundle **aBundle)
{
  NS_ENSURE_ARG_POINTER(aBundle);
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  nsCOMPtr<nsIStringBundle> bundle;
  if (bundleService && NS_SUCCEEDED(rv))
    bundleService->CreateBundle("chrome://messenger/locale/messenger.properties", getter_AddRefs(bundle));
  bundle.swap(*aBundle);
  return rv;
}

void
nsMessengerOSXIntegration::FillToolTipInfo(nsIMsgFolder *aFolder, int32_t aNewCount)
{
  if (aFolder)
  {
    nsString authors;
    int32_t numNotDisplayed;
    nsresult rv = GetNewMailAuthors(aFolder, authors, aNewCount, &numNotDisplayed);

    // If all senders are vetoed, the authors string will be empty.
    if (NS_FAILED(rv) || authors.IsEmpty())
      return;

    // If this isn't the root folder, get it so we can report for it.
    // GetRootFolder always returns the server's root, so calling on the root itself is fine.
    nsCOMPtr<nsIMsgFolder> rootFolder;
    aFolder->GetRootFolder(getter_AddRefs(rootFolder));
    if (!rootFolder)
      return;

    nsString accountName;
    rootFolder->GetPrettiestName(accountName);

    nsCOMPtr<nsIStringBundle> bundle;
    GetStringBundle(getter_AddRefs(bundle));
    if (bundle)
    {
      nsAutoString numNewMsgsText;
      numNewMsgsText.AppendInt(aNewCount);
      nsString finalText;
      nsCString uri;
      aFolder->GetURI(uri);

      if (numNotDisplayed > 0)
      {
        nsAutoString numNotDisplayedText;
        numNotDisplayedText.AppendInt(numNotDisplayed);
        const PRUnichar *formatStrings[3] = { numNewMsgsText.get(), authors.get(), numNotDisplayedText.get() };
        bundle->FormatStringFromName(NS_LITERAL_STRING("macBiffNotification_messages_extra").get(),
                                     formatStrings,
                                     3,
                                     getter_Copies(finalText));
      }
      else
      {
        const PRUnichar *formatStrings[2] = { numNewMsgsText.get(), authors.get() };

        if (aNewCount == 1)
        {
          bundle->FormatStringFromName(NS_LITERAL_STRING("macBiffNotification_message").get(),
                                       formatStrings,
                                       2,
                                       getter_Copies(finalText));
          // Since there is only 1 message, use the most recent mail's URI instead of the folder's
          nsCOMPtr<nsIMsgDatabase> db;
          rv = aFolder->GetMsgDatabase(getter_AddRefs(db));
          if (NS_SUCCEEDED(rv) && db)
          {
            uint32_t numNewKeys;
            uint32_t *newMessageKeys;
            rv = db->GetNewList(&numNewKeys, &newMessageKeys);
            if (NS_SUCCEEDED(rv))
            {
              nsCOMPtr<nsIMsgDBHdr> hdr;
              rv = db->GetMsgHdrForKey(newMessageKeys[numNewKeys - 1],
                                       getter_AddRefs(hdr));
              if (NS_SUCCEEDED(rv) && hdr)
                aFolder->GetUriForMsg(hdr, uri);
            }
            NS_Free(newMessageKeys);
          }
        }
        else
          bundle->FormatStringFromName(NS_LITERAL_STRING("macBiffNotification_messages").get(),
                                       formatStrings,
                                       2,
                                       getter_Copies(finalText));
      }
      ShowAlertMessage(accountName, finalText, uri);
    } // if we got a bundle
  } // if we got a folder
}

nsresult
nsMessengerOSXIntegration::ShowAlertMessage(const nsAString& aAlertTitle,
                                            const nsAString& aAlertText,
                                            const nsACString& aFolderURI)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  bool showAlert = true;
  prefBranch->GetBoolPref(kBiffShowAlertPref, &showAlert);

  if (showAlert)
  {
    nsCOMPtr<nsIAlertsService> alertsService (do_GetService(NS_ALERTSERVICE_CONTRACTID, &rv));
    // If we have an nsIAlertsService implementation, use it:
    if (NS_SUCCEEDED(rv))
    {
      alertsService->ShowAlertNotification(NS_LITERAL_STRING(kNewMailAlertIcon),
                                           aAlertTitle, aAlertText, true,
                                           NS_ConvertASCIItoUTF16(aFolderURI),
                                           this, EmptyString());
    }

    BounceDockIcon();
  }

  if (!showAlert || NS_FAILED(rv))
    OnAlertFinished();

  return rv;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemIntPropertyChanged(nsIMsgFolder *aFolder,
                                                    nsIAtom *aProperty,
                                                    int32_t aOldValue,
                                                    int32_t aNewValue)
{
  // if we got new mail show an alert
  if (aNewValue == nsIMsgFolder::nsMsgBiffState_NewMail)
  {
    bool performingBiff = false;
    nsCOMPtr<nsIMsgIncomingServer> server;
    aFolder->GetServer(getter_AddRefs(server));
    if (server)
      server->GetPerformingBiff(&performingBiff);
    if (!performingBiff)
      return NS_OK; // kick out right now...

    // Biff happens for the root folder, but we want info for the child with new mail
    nsCString folderUri;
    GetFirstFolderWithNewMail(aFolder, folderUri);
    nsCOMPtr<nsIMsgFolder> childFolder;
    nsresult rv = aFolder->GetChildWithURI(folderUri, true, true,
                                           getter_AddRefs(childFolder));
    if (NS_FAILED(rv) || !childFolder)
      return NS_ERROR_FAILURE;

    int32_t numNewMessages = 0;
    childFolder->GetNumNewMessages(true, &numNewMessages);
    FillToolTipInfo(childFolder, numNewMessages);
  }
  else if (mNewMailReceivedAtom == aProperty)
  {
    FillToolTipInfo(aFolder, aNewValue);
  }
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::OnAlertClicked(const PRUnichar* aAlertCookie)
{
  openMailWindow(NS_ConvertUTF16toUTF8(aAlertCookie));
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::OnAlertFinished()
{
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::BounceDockIcon()
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  bool bounceDockIcon = false;
  rv = prefBranch->GetBoolPref(kBiffAnimateDockIconPref, &bounceDockIcon);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!bounceDockIcon)
    return NS_OK;

  nsCOMPtr<nsIWindowMediator> mediator(do_GetService(NS_WINDOWMEDIATOR_CONTRACTID));
  if (mediator)
  {
    nsCOMPtr<nsIDOMWindow> domWindow;
    mediator->GetMostRecentWindow(NS_LITERAL_STRING("mail:3pane").get(), getter_AddRefs(domWindow));
    if (domWindow)
    {
      nsCOMPtr<nsIDOMChromeWindow> chromeWindow(do_QueryInterface(domWindow));
      chromeWindow->GetAttention();
    }
  }
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::RestoreDockIcon()
{
  id tile = [[NSApplication sharedApplication] dockTile];
  [tile setBadgeLabel: nil];

  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::BadgeDockIcon()
{
  int32_t unreadCount = mUnreadTotal + mUnreadChat;
  // If count is less than one, we should restore the original dock icon.
  if (unreadCount < 1)
  {
    RestoreDockIcon();
    return NS_OK;
  }

  // Draw the number, first giving extensions a chance to modify.
  // Extensions might wish to transform "1000" into "100+" or some
  // other short string. Getting back the empty string will cause
  // nothing to be drawn and us to return early.
  nsresult rv;
  nsCOMPtr<nsIObserverService> os
    (do_GetService("@mozilla.org/observer-service;1", &rv));
  if (NS_FAILED(rv))
  {
    RestoreDockIcon();
    return rv;
  }

  nsCOMPtr<nsISupportsString> str
    (do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID, &rv));
  if (NS_FAILED(rv))
  {
    RestoreDockIcon();
    return rv;
  }

  nsAutoString total;
  total.AppendInt(unreadCount);
  str->SetData(total);
  os->NotifyObservers(str, "before-unread-count-display",
                      total.get());
  nsAutoString badgeString;
  str->GetData(badgeString);
  if (badgeString.IsEmpty())
  {
    RestoreDockIcon();
    return NS_OK;
  }

  id tile = [[NSApplication sharedApplication] dockTile];
  [tile setBadgeLabel:[NSString stringWithFormat:@"%S", total.get()]];
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, uint32_t oldFlag, uint32_t newFlag)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemAdded(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemBoolPropertyChanged(nsIMsgFolder *aItem,
                                                         nsIAtom *aProperty,
                                                         bool aOldValue,
                                                         bool aNewValue)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemEvent(nsIMsgFolder *, nsIAtom *)
{
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::GetNewMailAuthors(nsIMsgFolder* aFolder,
                                             nsString& aAuthors,
                                             int32_t aNewCount,
                                             int32_t* aNotDisplayed)
{
  // Get a list of names or email addresses for the folder's authors
  // with new mail. Note that we only process the most recent "new"
  // mail (aNewCount), working from most recently added. Duplicates
  // are removed, and names are displayed to a set limit
  // (kMaxDisplayCount) with the remaining count being returned in
  // aNotDisplayed. Extension developers can listen for
  // "newmail-notification-requested" and then make a decision about
  // including a given author or not. As a result, it is possible that
  // the resulting length of aAuthors will be 0.
  nsCOMPtr<nsIMsgDatabase> db;
  nsresult rv = aFolder->GetMsgDatabase(getter_AddRefs(db));
  uint32_t numNewKeys = 0;
  if (NS_SUCCEEDED(rv) && db)
  {
    nsCOMPtr<nsIMsgHeaderParser> parser =
      do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIObserverService> os =
      do_GetService("@mozilla.org/observer-service;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    // Get proper l10n list separator -- ", " in English
    nsCOMPtr<nsIStringBundle> bundle;
    GetStringBundle(getter_AddRefs(bundle));
    if (!bundle)
      return NS_ERROR_FAILURE;

    uint32_t *newMessageKeys;
    rv = db->GetNewList(&numNewKeys, &newMessageKeys);
    if (NS_SUCCEEDED(rv))
    {
      nsString listSeparator;
      bundle->GetStringFromName(NS_LITERAL_STRING("macBiffNotification_separator").get(), getter_Copies(listSeparator));

      int32_t displayed = 0;
      for (int32_t i = numNewKeys - 1; i >= 0; i--, aNewCount--)
      {
        if (0 == aNewCount || displayed == kMaxDisplayCount)
          break;

        nsCOMPtr<nsIMsgDBHdr> hdr;
        rv = db->GetMsgHdrForKey(newMessageKeys[i],
                                 getter_AddRefs(hdr));
        if (NS_SUCCEEDED(rv) && hdr)
        {
          nsString author;
          rv = hdr->GetMime2DecodedAuthor(author);
          if (NS_FAILED(rv))
            continue;

          nsCString name;
          rv = parser->ExtractHeaderAddressName(NS_ConvertUTF16toUTF8(author),
                                                name);
          if (NS_FAILED(rv))
            continue;

          // Give extensions a chance to suppress notifications for this author
          nsCOMPtr<nsISupportsPRBool> notify =
            do_CreateInstance(NS_SUPPORTS_PRBOOL_CONTRACTID);

          notify->SetData(true);
          os->NotifyObservers(notify, "newmail-notification-requested",
                              PromiseFlatString(author).get());

          bool includeSender;
          notify->GetData(&includeSender);

          // Don't add unwanted or duplicate names
          if (includeSender &&
              aAuthors.Find(name.get(), true) == -1)
          {
            if (displayed > 0)
              aAuthors.Append(listSeparator);
            aAuthors.Append(NS_ConvertUTF8toUTF16(name));
            displayed++;
          }
        }
      }
    }
    NS_Free(newMessageKeys);
  }
  *aNotDisplayed = aNewCount;
  return rv;
}

nsresult
nsMessengerOSXIntegration::GetFirstFolderWithNewMail(nsIMsgFolder* aFolder, nsCString& aFolderURI)
{
  // Find the subfolder in aFolder with new mail and return the folderURI
  if (aFolder)
  {
    nsCOMPtr<nsIMsgFolder> msgFolder;
    // enumerate over the folders under this root folder till we find one with new mail....
    nsCOMPtr<nsISupportsArray> allFolders;
    NS_NewISupportsArray(getter_AddRefs(allFolders));
    nsresult rv = aFolder->ListDescendents(allFolders);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIEnumerator> enumerator;
    allFolders->Enumerate(getter_AddRefs(enumerator));
    if (enumerator)
    {
      nsCOMPtr<nsISupports> supports;
      int32_t numNewMessages = 0;
      nsresult more = enumerator->First();
      while (NS_SUCCEEDED(more))
      {
        rv = enumerator->CurrentItem(getter_AddRefs(supports));
        if (supports)
        {
          msgFolder = do_QueryInterface(supports, &rv);
          if (msgFolder)
          {
            numNewMessages = 0;
            msgFolder->GetNumNewMessages(false, &numNewMessages);
            if (numNewMessages)
              break; // kick out of the while loop
            more = enumerator->Next();
          }
        } // if we have a folder
      }  // if we have more potential folders to enumerate
    }  // if enumerator

    if (msgFolder)
      msgFolder->GetURI(aFolderURI);
  }

  return NS_OK;
}

/*
 * Method implementations for mozINewMailListener
 */
NS_IMETHODIMP
nsMessengerOSXIntegration::OnCountChanged(uint32_t count)
{
  mUnreadTotal = count;
  BadgeDockIcon();
  return NS_OK;
}
