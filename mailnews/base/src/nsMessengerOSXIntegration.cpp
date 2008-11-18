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
 * The Original Code is Mac OSX New Mail Notification Code..
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Scott MacGregor <mscott@mozilla.org>
 *  Jon Baumgartner <jon@bergenstreetsoftware.com>
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
 
#include "nscore.h"
#include "nsMessengerOSXIntegration.h"
#include "nsIMsgAccountManager.h"
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
#include "nsIDOMWindowInternal.h"
#include "nsPIDOMWindow.h"
#include "nsIDocShell.h"
#include "nsIBaseWindow.h"
#include "nsIWidget.h"
#include "nsIObserverService.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h" 
#include "nsIMessengerWindowService.h"
#include "prprf.h"
#include "nsIWeakReference.h"
#include "nsIAlertsService.h"
#include "nsIStringBundle.h"
#include "nsToolkitCompsCID.h"
#include "nsINotificationsList.h"

#include <Carbon/Carbon.h>

#define kNewMailAlertIcon "chrome://messenger/skin/icons/new-mail-alert.png"
#define kBiffShowAlertPref "mail.biff.show_alert"

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
    
    FocusAppNative();
    nsCOMPtr<nsIDOMWindowInternal> domWindow;
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

nsMessengerOSXIntegration::nsMessengerOSXIntegration()
{
  mBiffStateAtom = do_GetAtom("BiffState");
  mBiffIconVisible = PR_FALSE;
  mAlertInProgress = PR_FALSE;
  NS_NewISupportsArray(getter_AddRefs(mFoldersWithNewMail));
}

nsMessengerOSXIntegration::~nsMessengerOSXIntegration()
{
  if (mBiffIconVisible) 
  {
    RestoreApplicationDockTileImage();
    mBiffIconVisible = PR_FALSE;
  }
}

NS_IMPL_ADDREF(nsMessengerOSXIntegration)
NS_IMPL_RELEASE(nsMessengerOSXIntegration)

NS_INTERFACE_MAP_BEGIN(nsMessengerOSXIntegration)
   NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMessengerOSIntegration)
   NS_INTERFACE_MAP_ENTRY(nsIMessengerOSIntegration)
   NS_INTERFACE_MAP_ENTRY(nsIFolderListener)
   NS_INTERFACE_MAP_ENTRY(nsIObserver)
NS_INTERFACE_MAP_END


nsresult
nsMessengerOSXIntegration::Init()
{
  // need to register a named Growl notification
  nsresult rv;
  nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1", &rv);
  if (NS_SUCCEEDED(rv))
    observerService->AddObserver(this, "before-growl-registration", PR_FALSE);

  nsCOMPtr <nsIMsgAccountManager> accountManager = 
    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // because we care if the default server changes
  rv = accountManager->AddRootFolderListener(this);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // because we care if the unread total count changes
  return mailSession->AddFolderListener(this, nsIFolderListener::boolPropertyChanged | nsIFolderListener::intPropertyChanged);
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
    return OnAlertFinished(nsnull);

  if (!strcmp(aTopic, "alertclickcallback"))
    return OnAlertClicked();

  // register named Growl notification for new mail alerts.
  if (!strcmp(aTopic, "before-growl-registration"))
  {
    nsresult rv;
    nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1", &rv);
    if (NS_SUCCEEDED(rv))
      observerService->RemoveObserver(this, "before-growl-registration");

    nsCOMPtr<nsINotificationsList> notifications = do_QueryInterface(aSubject, &rv);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIStringBundle> bundle; 
      GetStringBundle(getter_AddRefs(bundle));
      if (bundle)
      { 
        nsString growlNotification;
        bundle->GetStringFromName(NS_LITERAL_STRING("growlNotification").get(), getter_Copies(growlNotification));
        notifications->AddNotification(growlNotification, PR_TRUE);
      }
    }
  }
  return NS_OK;
}

PRInt32
nsMessengerOSXIntegration::CountNewMessages()
{
  // iterate over all the folders in mFoldersWithNewMail
  nsCOMPtr<nsIMsgFolder> folder;
  nsCOMPtr<nsIWeakReference> weakReference;
  PRInt32 numNewMessages = 0;
  PRInt32 totalNewMessages = 0;
  
  PRUint32 count = 0;
  mFoldersWithNewMail->Count(&count);

  for (PRUint32 index = 0; index < count; index++)
  {
    weakReference = do_QueryElementAt(mFoldersWithNewMail, index);
    folder = do_QueryReferent(weakReference);
    if (folder)
    {
      numNewMessages = 0;   
      folder->GetNumNewMessages(PR_TRUE, &numNewMessages);
      totalNewMessages += numNewMessages;
    } // if we got a folder
  } // for each folder

  return totalNewMessages;
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
nsMessengerOSXIntegration::FillToolTipInfo(nsIMsgFolder *aFolder)
{
  if (aFolder)
  {
    nsString accountName;
    aFolder->GetPrettiestName(accountName);

    nsCOMPtr<nsIStringBundle> bundle; 
    GetStringBundle(getter_AddRefs(bundle));
    if (bundle)
    { 
      PRInt32 numNewMessages = 0;   
      aFolder->GetNumNewMessages(PR_TRUE, &numNewMessages);
      nsAutoString numNewMsgsText;     
      numNewMsgsText.AppendInt(numNewMessages);

      const PRUnichar *formatStrings[] =
      {
        numNewMsgsText.get(),       
      };
     
      nsString finalText; 
      if (numNewMessages == 1)
        bundle->FormatStringFromName(NS_LITERAL_STRING("biffNotification_message").get(), formatStrings, 1, getter_Copies(finalText));
      else
        bundle->FormatStringFromName(NS_LITERAL_STRING("biffNotification_messages").get(), formatStrings, 1, getter_Copies(finalText));

      ShowAlertMessage(accountName, finalText, EmptyCString());
    } // if we got a bundle
  } // if we got a folder
}

nsresult
nsMessengerOSXIntegration::ShowAlertMessage(const nsAString& aAlertTitle,
                                            const nsAString& aAlertText,
                                            const nsACString& aFolderURI)
{
  // if we are alredy in the process of showing an alert, don't try to show another one
  if (mAlertInProgress)
    return NS_OK;

  mAlertInProgress = PR_TRUE;

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool showAlert = PR_TRUE;
  prefBranch->GetBoolPref(kBiffShowAlertPref, &showAlert);

  if (showAlert)
  {
    // Use growl if installed
    nsCOMPtr<nsIAlertsService> alertsService (do_GetService(NS_ALERTSERVICE_CONTRACTID, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIStringBundle> bundle; 
      GetStringBundle(getter_AddRefs(bundle));
      if (bundle)
      { 
        nsString growlNotification;
        bundle->GetStringFromName(NS_LITERAL_STRING("growlNotification").get(), 
                                  getter_Copies(growlNotification));
        rv = alertsService->ShowAlertNotification(NS_LITERAL_STRING(kNewMailAlertIcon), 
                                                  aAlertTitle,
                                                  aAlertText, 
                                                  PR_TRUE, 
                                                  NS_ConvertASCIItoUTF16(aFolderURI),
                                                  this, 
                                                  growlNotification);
      }
    }
    
    PRBool bounceDockIcon = PR_FALSE; 
    prefBranch->GetBoolPref("mail.biff.animate_dock_icon", &bounceDockIcon);

    if (bounceDockIcon)
      BounceDockIcon();
  }

  BadgeDockIcon();

  if (!showAlert || NS_FAILED(rv))
    OnAlertFinished(nsnull);

  return rv;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemIntPropertyChanged(nsIMsgFolder *aFolder,
                                                    nsIAtom *aProperty,
                                                    PRInt32 aOldValue,
                                                    PRInt32 aNewValue)
{
   // if we got new mail show an alert
  if (mBiffStateAtom == aProperty && mFoldersWithNewMail)
  {
    NS_ENSURE_TRUE(aFolder, NS_OK);

    if (aNewValue == nsIMsgFolder::nsMsgBiffState_NewMail)
    {
      // if the icon is not already visible, only show a system tray icon if
      // we are performing biff (as opposed to the user getting new mail)
      if (!mBiffIconVisible)
      {
        PRBool performingBiff = PR_FALSE;
        nsCOMPtr<nsIMsgIncomingServer> server;
        aFolder->GetServer(getter_AddRefs(server));
        if (server)
          server->GetPerformingBiff(&performingBiff);
        if (!performingBiff)
          return NS_OK; // kick out right now...
      }

      nsCOMPtr<nsIWeakReference> weakFolder = do_GetWeakReference(aFolder);

      if (mFoldersWithNewMail->IndexOf(weakFolder) == kNotFound)
          mFoldersWithNewMail->AppendElement(weakFolder);

      FillToolTipInfo(aFolder);
    }
    else if (aNewValue == nsIMsgFolder::nsMsgBiffState_NoMail)
    {
      // we are always going to remove the icon whenever we get our first no
      // mail notification.
      mFoldersWithNewMail->Clear();
      if (mBiffIconVisible)
      {
        RestoreApplicationDockTileImage();
        mBiffIconVisible = PR_FALSE;
      }
    }
  } // if the biff property changed

  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::OnAlertClicked()
{
  nsCString folderURI;
  GetFirstFolderWithNewMail(folderURI);
  openMailWindow(folderURI);

  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::OnAlertFinished(const PRUnichar * aAlertCookie)
{
  mAlertInProgress = PR_FALSE;
  return NS_OK;
}

nsresult
nsMessengerOSXIntegration::BounceDockIcon()
{
  nsCOMPtr<nsIWindowMediator> mediator(do_GetService(NS_WINDOWMEDIATOR_CONTRACTID));
  if (mediator)
  {
    nsCOMPtr<nsIDOMWindowInternal> domWindow;
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
nsMessengerOSXIntegration::BadgeDockIcon()
{
  // This will change the dock icon. If we want to overlay the number of
  // new messages on top of the icon use OverlayApplicationDockTileImage
  // you'll have to pass it a CGImage, and somehow we have to/ create
  // the CGImage with the numbers. tricky    
  PRInt32 totalNewMessages = CountNewMessages();
  CGContextRef context = ::BeginCGContextForApplicationDockTile();
    
  // Draw a circle.
  ::CGContextBeginPath(context);
  ::CGContextAddArc(context, 95.0, 95.0, 25.0, 0.0, 2 * M_PI, true);
  ::CGContextClosePath(context);

  // use #2fc600 for the color.
  ::CGContextSetRGBFillColor(context, 0.184, 0.776, 0.0, 1);
  ::CGContextFillPath(context);

  // Draw the number.
  nsAutoString total;
  total.AppendInt(totalNewMessages);

  // Use a system font (kThemeUtilityWindowTitleFont)
  ScriptCode sysScript = ::GetScriptManagerVariable(smSysScript);

  Str255 fontName;
  SInt16 fontSize;
  Style fontStyle;
  ::GetThemeFont(kThemeSmallEmphasizedSystemFont, sysScript, fontName,
                 &fontSize, &fontStyle);

  FMFontFamily family = ::FMGetFontFamilyFromName(fontName);
  FMFont fmFont;

  if (::FMGetFontFromFontFamilyInstance(family,
                                        fontStyle,
                                        &fmFont,
                                        nsnull) != noErr)
  {
    NS_WARNING("FMGetFontFromFontFamilyInstance failed");
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  ATSUStyle style;
  if (::ATSUCreateStyle(&style) != noErr) 
  {
    NS_WARNING("ATSUCreateStyle failed");
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }
        
  Fixed size = Long2Fix(24);
  RGBColor white = { 0xFFFF, 0xFFFF, 0xFFFF };
    
  ATSUAttributeTag tags[3] = { kATSUFontTag, kATSUSizeTag, kATSUColorTag };
  ByteCount valueSizes[3] = { sizeof(ATSUFontID), sizeof(Fixed),
                              sizeof(RGBColor) };
  ATSUAttributeValuePtr values[3] = { &fmFont, &size, &white };

  if (::ATSUSetAttributes(style, 3, tags, valueSizes, values) != noErr) 
  {
    NS_WARNING("ATSUSetAttributes failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  UniCharCount runLengths = kATSUToTextEnd;
  ATSUTextLayout textLayout;
  if (::ATSUCreateTextLayoutWithTextPtr(total.get(), 
                                        kATSUFromTextBeginning, 
                                        kATSUToTextEnd, 
                                        total.Length(), 
                                        1, 
                                        &runLengths, 
                                        &style, 
                                        &textLayout) != noErr) 
  {
    NS_WARNING("ATSUCreateTextLayoutWithTextPtr failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  ATSUAttributeTag layoutTags[1] = { kATSUCGContextTag };
  ByteCount layoutValueSizes[1] = { sizeof(CGContextRef) };
  ATSUAttributeValuePtr layoutValues[1] = { &context };

  if (::ATSUSetLayoutControls(textLayout, 
                              1, 
                              layoutTags, 
                              layoutValueSizes, 
                              layoutValues) != noErr) 
  {
    NS_WARNING("ATSUSetLayoutControls failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  Rect boundingBox;
  if (::ATSUMeasureTextImage(textLayout, 
                             kATSUFromTextBeginning,
                             kATSUToTextEnd,
                             Long2Fix(0),
                             Long2Fix(0),
                             &boundingBox) != noErr) 
  {
    NS_WARNING("ATSUMeasureTextImage failed");
    ::ATSUDisposeStyle(style);
    ::EndCGContextForApplicationDockTile(context);
    return NS_ERROR_FAILURE;
  }

  // Center text inside circle
  ::ATSUDrawText(textLayout, kATSUFromTextBeginning, kATSUToTextEnd,
                 Long2Fix(90 - (boundingBox.right - boundingBox.left) / 2),
                 Long2Fix(95 - (boundingBox.bottom - boundingBox.top) / 2));

  ::ATSUDisposeStyle(style);
  ::ATSUDisposeTextLayout(textLayout);

  ::CGContextFlush(context);
  ::EndCGContextForApplicationDockTile(context);

  mBiffIconVisible = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, PRUint32 oldFlag, PRUint32 newFlag)
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
                                                         PRBool aOldValue,
                                                         PRBool aNewValue)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOSXIntegration::OnItemEvent(nsIMsgFolder *, nsIAtom *)
{
  return NS_OK;
}

// get the first top level folder which we know has new mail, then enumerate over all the subfolders
// looking for the first real folder with new mail. Return the folderURI for that folder.
nsresult
nsMessengerOSXIntegration::GetFirstFolderWithNewMail(nsACString& aFolderURI)
{
  nsresult rv;
  NS_ENSURE_TRUE(mFoldersWithNewMail, NS_ERROR_FAILURE);

  nsCOMPtr<nsIMsgFolder> folder;
  nsCOMPtr<nsIWeakReference> weakReference;
  PRInt32 numNewMessages = 0;

  PRUint32 count = 0;
  mFoldersWithNewMail->Count(&count);

  if (!count)  // kick out if we don't have any folders with new mail
    return NS_OK;

  weakReference = do_QueryElementAt(mFoldersWithNewMail, 0);
  folder = do_QueryReferent(weakReference);

  if (folder)
  {
    nsCOMPtr<nsIMsgFolder> msgFolder;
    // enumerate over the folders under this root folder till we find one with new mail....
    nsCOMPtr<nsISupportsArray> allFolders;
    NS_NewISupportsArray(getter_AddRefs(allFolders));
    rv = folder->ListDescendents(allFolders);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIEnumerator> enumerator;
    allFolders->Enumerate(getter_AddRefs(enumerator));
    if (enumerator)
    {
      nsCOMPtr<nsISupports> supports;
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
            msgFolder->GetNumNewMessages(PR_FALSE, &numNewMessages);
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
