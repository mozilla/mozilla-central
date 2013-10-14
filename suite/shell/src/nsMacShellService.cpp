/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMPtr.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIDOMElement.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIImageLoadingContent.h"
#include "nsIDocument.h"
#include "nsIContent.h"
#include "nsILocalFileMac.h"
#include "nsIObserverService.h"
#include "nsIPrefService.h"
#include "nsIServiceManager.h"
#include "nsIStringBundle.h"
#include "nsIURL.h"
#include "nsIWebBrowserPersist.h"
#include "nsMacShellService.h"
#include "nsNetUtil.h"
#include "nsShellService.h"
#include "nsStringAPI.h"
#include "nsIDocShell.h"
#include "nsILoadContext.h"

#include <ApplicationServices/ApplicationServices.h>

#define SAFARI_BUNDLE_IDENTIFIER "com.apple.Safari"

NS_IMPL_ISUPPORTS2(nsMacShellService, nsIShellService, nsIWebProgressListener)

NS_IMETHODIMP
nsMacShellService::IsDefaultClient(bool aStartupCheck, uint16_t aApps, bool *aIsDefaultClient)
{
  // If this is the first window, maintain internal state that we've
  // checked this session (so that subsequent window opens don't show the
  // default client dialog).
  if (aStartupCheck)
    mCheckedThisSessionClient = true;

  *aIsDefaultClient = false;

  if (aApps & nsIShellService::BROWSER)
    if(!isDefaultHandlerForProtocol(CFSTR("http")))
      return NS_OK;
  if (aApps & nsIShellService::MAIL)
    if(!isDefaultHandlerForProtocol(CFSTR("mailto")))
      return NS_OK;
  if (aApps & nsIShellService::NEWS)
    if(!isDefaultHandlerForProtocol(CFSTR("news")))
      return NS_OK;
  if (aApps & nsIShellService::RSS)
    if(!isDefaultHandlerForProtocol(CFSTR("feed")))
      return NS_OK;

  *aIsDefaultClient = true;

  return NS_OK;
}

NS_IMETHODIMP
nsMacShellService::SetDefaultClient(bool aForAllUsers,
                                    bool aClaimAllTypes, uint16_t aApps)
{
  // Note: We don't support aForAllUsers on Mac OS X.

  CFStringRef suiteID = ::CFBundleGetIdentifier(::CFBundleGetMainBundle());
  if (!suiteID)
    return NS_ERROR_FAILURE;

  if (aApps & nsIShellService::BROWSER)
  {
    if (::LSSetDefaultHandlerForURLScheme(CFSTR("http"), suiteID) != noErr)
      return NS_ERROR_FAILURE;
    if (::LSSetDefaultHandlerForURLScheme(CFSTR("https"), suiteID) != noErr)
      return NS_ERROR_FAILURE;
    if (::LSSetDefaultRoleHandlerForContentType(kUTTypeHTML, kLSRolesAll, suiteID) != noErr)
      return NS_ERROR_FAILURE;
    if (::LSSetDefaultRoleHandlerForContentType(CFSTR("public.xhtml"), kLSRolesAll, suiteID) != noErr)
      return NS_ERROR_FAILURE;
  }

  if (aApps & nsIShellService::MAIL)
    if (::LSSetDefaultHandlerForURLScheme(CFSTR("mailto"), suiteID) != noErr)
      return NS_ERROR_FAILURE;
  if (aApps & nsIShellService::NEWS)
    if (::LSSetDefaultHandlerForURLScheme(CFSTR("news"), suiteID) != noErr)
      return NS_ERROR_FAILURE;
  if (aApps & nsIShellService::RSS)
    if (::LSSetDefaultHandlerForURLScheme(CFSTR("feed"), suiteID) != noErr)
      return NS_ERROR_FAILURE;

  return NS_OK;
}

NS_IMETHODIMP
nsMacShellService::GetShouldCheckDefaultClient(bool* aResult)
{
  if (mCheckedThisSessionClient)
  {
    *aResult = false;
    return NS_OK;
  }

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefs->GetBoolPref(PREF_CHECKDEFAULTCLIENT, aResult);
}

NS_IMETHODIMP
nsMacShellService::SetShouldCheckDefaultClient(bool aShouldCheck)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefs->SetBoolPref(PREF_CHECKDEFAULTCLIENT, aShouldCheck);
}

bool
nsMacShellService::isDefaultHandlerForProtocol(CFStringRef aScheme)
{
  bool isDefault = false;

  CFStringRef suiteID = ::CFBundleGetIdentifier(::CFBundleGetMainBundle());
  if (!suiteID)
  {
    // CFBundleGetIdentifier is expected to return NULL only if the specified
    // bundle doesn't have a bundle identifier in its dictionary. In this case,
    // that means a failure, since our bundle does have an identifier.
    return isDefault;
  }

  // Get the default handler's bundle ID for the scheme.
  CFStringRef defaultHandlerID = ::LSCopyDefaultHandlerForURLScheme(aScheme);
  if (defaultHandlerID)
  {
    // The handler ID in LaunchServices is in all lower case, but the bundle
    // identifier could have upper case characters. So we're using
    // CFStringCompare with the kCFCompareCaseInsensitive option here.
    isDefault = ::CFStringCompare(suiteID, defaultHandlerID,
                                  kCFCompareCaseInsensitive) == kCFCompareEqualTo;
    ::CFRelease(defaultHandlerID);
   }

  return isDefault;
}

NS_IMETHODIMP
nsMacShellService::GetShouldBeDefaultClientFor(uint16_t* aApps)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  int32_t result;
  rv = prefs->GetIntPref("shell.checkDefaultApps", &result);
  *aApps = result;
  return rv;
}

NS_IMETHODIMP
nsMacShellService::SetShouldBeDefaultClientFor(uint16_t aApps)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefs->SetIntPref("shell.checkDefaultApps", aApps);
}

NS_IMETHODIMP
nsMacShellService::GetCanSetDesktopBackground(bool* aResult)
{
  *aResult = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMacShellService::SetDesktopBackground(nsIDOMElement* aElement, int32_t aPosition)
{
  // Note: We don't support aPosition on OS X.

  // Get the image URI:
  nsresult rv;
  nsCOMPtr<nsIImageLoadingContent> imageContent = do_QueryInterface(aElement, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIURI> imageURI;
  rv = imageContent->GetCurrentURI(getter_AddRefs(imageURI));
  NS_ENSURE_SUCCESS(rv, rv);

  // We need the referer URI for nsIWebBrowserPersist::saveURI.
  nsCOMPtr<nsIContent> content = do_QueryInterface(aElement, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsIURI *docURI = content->OwnerDoc()->GetDocumentURI();
  if (!docURI)
    return NS_ERROR_FAILURE;

  // Get the desired image file name:
  nsCOMPtr<nsIURL> imageURL(do_QueryInterface(imageURI));
  if (!imageURL)
  {
    // XXXmano (bug 300293): Non-URL images (e.g. the data: protocol) are not
    // yet supported. What filename should we take here?
    return NS_ERROR_NOT_IMPLEMENTED;
  }

  nsAutoCString fileName;
  imageURL->GetFileName(fileName);
  nsCOMPtr<nsIProperties> fileLocator
    (do_GetService("@mozilla.org/file/directory_service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // Get the current user's "Pictures" folder (That's ~/Pictures):
  fileLocator->Get(NS_OSX_PICTURE_DOCUMENTS_DIR, NS_GET_IID(nsIFile),
                   getter_AddRefs(mBackgroundFile));
  if (!mBackgroundFile)
    return NS_ERROR_OUT_OF_MEMORY;

  nsAutoString fileNameUnicode;
  CopyUTF8toUTF16(fileName, fileNameUnicode);

  // and add the image file name itself:
  mBackgroundFile->Append(fileNameUnicode);

  // Download the image; the desktop background will be set in OnStateChange():
  nsCOMPtr<nsIWebBrowserPersist> wbp
    (do_CreateInstance("@mozilla.org/embedding/browser/nsWebBrowserPersist;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  uint32_t flags = nsIWebBrowserPersist::PERSIST_FLAGS_NO_CONVERSION |
                   nsIWebBrowserPersist::PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                   nsIWebBrowserPersist::PERSIST_FLAGS_FROM_CACHE;

  wbp->SetPersistFlags(flags);
  wbp->SetProgressListener(this);

  nsCOMPtr<nsILoadContext> loadContext;
  nsCOMPtr<nsISupports> container = content->OwnerDoc()->GetContainer();
  nsCOMPtr<nsIDocShell> docShell = do_QueryInterface(container);
  if (docShell)
  {
    loadContext = do_QueryInterface(docShell);
  }

  return wbp->SaveURI(imageURI, nullptr, docURI, nullptr, nullptr,
                      mBackgroundFile, loadContext);
}

NS_IMETHODIMP
nsMacShellService::OnProgressChange(nsIWebProgress* aWebProgress,
                                    nsIRequest* aRequest,
                                    int32_t aCurSelfProgress,
                                    int32_t aMaxSelfProgress,
                                    int32_t aCurTotalProgress,
                                    int32_t aMaxTotalProgress)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMacShellService::OnLocationChange(nsIWebProgress* aWebProgress,
                                    nsIRequest* aRequest,
                                    nsIURI* aLocation,
                                    uint32_t aFlags)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMacShellService::OnStatusChange(nsIWebProgress* aWebProgress,
                                  nsIRequest* aRequest,
                                  nsresult aStatus,
                                  const PRUnichar* aMessage)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMacShellService::OnSecurityChange(nsIWebProgress* aWebProgress,
                                    nsIRequest* aRequest,
                                    uint32_t aState)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMacShellService::OnStateChange(nsIWebProgress* aWebProgress,
                                 nsIRequest* aRequest,
                                 uint32_t aStateFlags,
                                 nsresult aStatus)
{
  if (aStateFlags & STATE_STOP)
  {
    bool exists = false;
    mBackgroundFile->Exists(&exists);
    if (!exists)
      return NS_OK;

    nsAutoCString nativePath;
    mBackgroundFile->GetNativePath(nativePath);

    AEDesc tAEDesc = { typeNull, nil };
    OSErr err = noErr;
    AliasHandle aliasHandle = nil;
    FSRef pictureRef;
    OSStatus status;

    // Convert the path into a FSRef:
    status = ::FSPathMakeRef((const UInt8*)nativePath.get(), &pictureRef, NULL);
    if (status == noErr)
    {
      err = ::FSNewAlias(nil, &pictureRef, &aliasHandle);
      if (err == noErr && aliasHandle == nil)
        err = paramErr;

      if (err == noErr)
      {
        // We need the descriptor (based on the picture file reference)
        // for the 'Set Desktop Picture' apple event.
        char handleState = ::HGetState((Handle)aliasHandle);
        ::HLock((Handle)aliasHandle);
        err = ::AECreateDesc(typeAlias, *aliasHandle,
                             GetHandleSize((Handle)aliasHandle), &tAEDesc);
        // Unlock the alias handler:
        ::HSetState((Handle)aliasHandle, handleState);
        ::DisposeHandle((Handle)aliasHandle);
      }
      if (err == noErr)
      {
        AppleEvent tAppleEvent;
        OSType sig = 'MACS';
        AEBuildError tAEBuildError;
        // Create a 'Set Desktop Picture' Apple Event:
        err = ::AEBuildAppleEvent(kAECoreSuite, kAESetData, typeApplSignature,
                                  &sig, sizeof(OSType), kAutoGenerateReturnID,
                                  kAnyTransactionID, &tAppleEvent, &tAEBuildError,
                                  "'----':'obj '{want:type (prop),form:prop" \
                                  ",seld:type('dpic'),from:'null'()},data:(@)",
                                  &tAEDesc);
        if (err == noErr)
        {
          AppleEvent reply = { typeNull, nil };
          // Send the event we built, the reply event isn't necessary:
          err = ::AESend(&tAppleEvent, &reply, kAENoReply, kAENormalPriority,
                         kNoTimeOut, nil, nil);
          ::AEDisposeDesc(&tAppleEvent);
        }
      }
    }
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMacShellService::GetDesktopBackgroundColor(uint32_t *aColor)
{
  // This method and |SetDesktopBackgroundColor| has no meaning on Mac OS X.
  // The mac desktop preferences UI uses pictures for the few solid colors it
  // supports.
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetDesktopBackgroundColor(uint32_t aColor)
{
  // This method and |GetDesktopBackgroundColor| has no meaning on Mac OS X.
  // The mac desktop preferences UI uses pictures for the few solid colors it
  // supports.
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::OpenApplicationWithURI(nsIFile* aApplication, const nsACString& aURI)
{
  nsCOMPtr<nsILocalFileMac> lfm(do_QueryInterface(aApplication));
  CFURLRef appURL;
  nsresult rv = lfm->GetCFURL(&appURL);
  if (NS_FAILED(rv))
    return rv;
  
  const nsCString& spec = PromiseFlatCString(aURI);
  const UInt8* uriString = (const UInt8*)spec.get();
  CFURLRef uri = ::CFURLCreateWithBytes(NULL, uriString, aURI.Length(),
                                        kCFStringEncodingUTF8, NULL);
  if (!uri) 
    return NS_ERROR_OUT_OF_MEMORY;
  
  CFArrayRef uris = ::CFArrayCreate(NULL, (const void**)&uri, 1, NULL);
  if (!uris)
  {
    ::CFRelease(uri);
    return NS_ERROR_OUT_OF_MEMORY;
  }
  
  LSLaunchURLSpec launchSpec;
  launchSpec.appURL = appURL;
  launchSpec.itemURLs = uris;
  launchSpec.passThruParams = NULL;
  launchSpec.launchFlags = kLSLaunchDefaults;
  launchSpec.asyncRefCon = NULL;
  
  OSErr err = ::LSOpenFromURLSpec(&launchSpec, NULL);
  
  ::CFRelease(uris);
  ::CFRelease(uri);
  
  return err != noErr ? NS_ERROR_FAILURE : NS_OK;
}

NS_IMETHODIMP
nsMacShellService::GetDefaultFeedReader(nsIFile** _retval)
{
  nsresult rv = NS_ERROR_FAILURE;
  *_retval = nullptr;

  CFStringRef defaultHandlerID = ::LSCopyDefaultHandlerForURLScheme(CFSTR("feed"));
  if (!defaultHandlerID)
  {
    defaultHandlerID = ::CFStringCreateWithCString(kCFAllocatorDefault,
                                                   SAFARI_BUNDLE_IDENTIFIER,
                                                   kCFStringEncodingASCII);
  }

  CFURLRef defaultHandlerURL = NULL;
  OSStatus status = ::LSFindApplicationForInfo(kLSUnknownCreator,
                                               defaultHandlerID,
                                               NULL, // inName
                                               NULL, // outAppRef
                                               &defaultHandlerURL);

  if (status == noErr && defaultHandlerURL)
  {
    nsCOMPtr<nsILocalFileMac> defaultReader =
      do_CreateInstance("@mozilla.org/file/local;1", &rv);
    if (NS_SUCCEEDED(rv))
    {
      rv = defaultReader->InitWithCFURL(defaultHandlerURL);
      if (NS_SUCCEEDED(rv))
      {
        NS_ADDREF(*_retval = defaultReader);
      }
    }

    ::CFRelease(defaultHandlerURL);
  }

  ::CFRelease(defaultHandlerID);

  return rv;
}
