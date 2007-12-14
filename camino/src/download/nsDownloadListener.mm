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
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Simon Fraser <sfraser@netscape.com>
 *   Calum Robinson <calumr@mac.com>
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

#import "NSString+Gecko.h"

#include "nsDownloadListener.h"

#include "nsIURIFixup.h"
#include "nsIWebProgress.h"
#include "nsIFileURL.h"
#include "netCore.h"
#include "nsNetError.h"
#include "nsNetUtil.h"
#include "nsILocalFileMac.h"

nsDownloadListener::nsDownloadListener()
: mDownloadStatus(NS_OK)
, mBypassCache(PR_FALSE)
, mNetworkTransfer(PR_FALSE)
, mGotFirstStateChange(PR_FALSE)
, mUserCanceled(PR_FALSE)
,	mSentCancel(PR_FALSE)
, mDownloadPaused(PR_FALSE)
{
  mStartTime = LL_ZERO;
}

nsDownloadListener::~nsDownloadListener()
{
}

NS_IMPL_ISUPPORTS_INHERITED5(nsDownloadListener, CHDownloader, 
                             nsIInterfaceRequestor,
                             nsIDownload,
                             nsITransfer, nsIWebProgressListener,
                             nsIWebProgressListener2)

// Implementation of nsIInterfaceRequestor
NS_IMETHODIMP 
nsDownloadListener::GetInterface(const nsIID &aIID, void** aInstancePtr)
{
  return QueryInterface(aIID, aInstancePtr);
}

#pragma mark -

/* void init (in nsIURI aSource, in nsIURI aTarget, in AString aDisplayName, in wstring openingWith, in long long startTime, in nsICancelable aCancelable); */
NS_IMETHODIMP
nsDownloadListener::Init(nsIURI *aSource, nsIURI *aTarget, const nsAString &aDisplayName,
        nsIMIMEInfo* aMIMEInfo, PRInt64 startTime, nsILocalFile* aTempFile,
        nsICancelable* aCancelable)
{
  // get the local file corresponding to the given target URI
  nsCOMPtr<nsILocalFile> targetFile;
  {
    nsCOMPtr<nsIFileURL> fileURL = do_QueryInterface(aTarget);
    if (fileURL)
    {
      nsCOMPtr<nsIFile> file;
      fileURL->GetFile(getter_AddRefs(file));
      if (file)
        targetFile = do_QueryInterface(file);
    }
  }
  NS_ENSURE_TRUE(targetFile, NS_ERROR_INVALID_ARG);

  CreateDownloadDisplay(); // call the base class to make the download UI

  // Note: This forms a cycle, which will be broken in DownloadDone
  mCancelable = aCancelable;

  // This is a file save if the cancelable object is a webbrowserpersist
  nsCOMPtr<nsIWebBrowserPersist> persist(do_QueryInterface(aCancelable));
  SetIsFileSave(persist != NULL);
  
  mDestination = aTarget;
  mDestinationFile = targetFile;
  mURI = aSource;
  mStartTime = startTime;
  mTempFile = aTempFile;

  InitDialog();

  return NS_OK;
}

/* readonly attribute nsIURI source; */
NS_IMETHODIMP
nsDownloadListener::GetSource(nsIURI * *aSource)
{
  NS_ENSURE_ARG_POINTER(aSource);
  NS_IF_ADDREF(*aSource = mURI);
  return NS_OK;
}

/* readonly attribute nsIURI target; */
NS_IMETHODIMP
nsDownloadListener::GetTarget(nsIURI * *aTarget)
{
  NS_ENSURE_ARG_POINTER(aTarget);
  NS_IF_ADDREF(*aTarget = mDestination);
  return NS_OK;
}

/* readonly attribute nsICancelable cancelable; */
NS_IMETHODIMP
nsDownloadListener::GetCancelable(nsICancelable * *aCancelable)
{
  NS_ENSURE_ARG_POINTER(aCancelable);
  NS_IF_ADDREF(*aCancelable = mCancelable);
  return NS_OK;
}

/* readonly attribute PRInt32 percentComplete; */
NS_IMETHODIMP
nsDownloadListener::GetPercentComplete(PRInt32 *aPercentComplete)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute PRInt64 amountTransferred; */
NS_IMETHODIMP
nsDownloadListener::GetAmountTransferred(PRInt64 *aAmountTransferred)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute PRInt64 size; */
NS_IMETHODIMP
nsDownloadListener::GetSize(PRInt64 *aSize)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


/* attribute wstring displayName; */
NS_IMETHODIMP
nsDownloadListener::GetDisplayName(nsAString &aDisplayName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute long long startTime; */
NS_IMETHODIMP
nsDownloadListener::GetStartTime(PRInt64 *aStartTime)
{
  NS_ENSURE_ARG(aStartTime);
  *aStartTime = mStartTime;
  return NS_OK;
}

/* readonly attribute double speed; */
NS_IMETHODIMP
nsDownloadListener::GetSpeed(double* aSpeed)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute nsIMIMEInfo MIMEInfo; */
NS_IMETHODIMP
nsDownloadListener::GetMIMEInfo(nsIMIMEInfo * *aMIMEInfo)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsDownloadListener::GetTargetFile(nsILocalFile ** aTargetFile)
{
  NS_ENSURE_ARG_POINTER(aTargetFile);
  NS_IF_ADDREF(*aTargetFile = mDestinationFile);
  return NS_OK;
}

NS_IMETHODIMP
nsDownloadListener::GetId(PRUint32 *aId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsDownloadListener::GetState(PRInt16 *aState)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsDownloadListener::GetReferrer(nsIURI * *aReferrer) {
  NS_ENSURE_ARG_POINTER(aReferrer);
  NS_IF_ADDREF(*aReferrer = mReferrer);
  return NS_OK;
}

#pragma mark -

/* void onProgressChange64 (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in long long aCurSelfProgress, in long long aMaxSelfProgress, in long long a
CurTotalProgress, in long long aMaxTotalProgress); */
NS_IMETHODIMP 
nsDownloadListener::OnProgressChange64(nsIWebProgress *aWebProgress, 
                                       nsIRequest *aRequest, 
                                       PRInt64 aCurSelfProgress, 
                                       PRInt64 aMaxSelfProgress, 
                                       PRInt64 aCurTotalProgress, 
                                       PRInt64 aMaxTotalProgress)
{
  if (!mRequest)
    mRequest = aRequest; // for pause/resume downloading

  FigureOutReferrer();

  [mDownloadDisplay setProgressTo:aCurTotalProgress ofMax:aMaxTotalProgress];
  return NS_OK;
}

/* boolean onRefreshAttempted (in nsIWebProgress aWebProgress, in nsIURI aRefreshURI, in long aDelay, in boolean aSameURI); */
NS_IMETHODIMP
nsDownloadListener::OnRefreshAttempted(nsIWebProgress *aWebProgress,
                                       nsIURI *aUri,
                                       PRInt32 aDelay,
                                       PRBool aSameUri,
                                       PRBool *allowRefresh)
{
    *allowRefresh = PR_TRUE;
    return NS_OK;
}

/* void onProgressChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in long aCurSelfProgress, in long aMaxSelfProgress, in long aCurTotalProgress, in long aMaxTotalProgress); */
NS_IMETHODIMP 
nsDownloadListener::OnProgressChange(nsIWebProgress *aWebProgress, 
                                     nsIRequest *aRequest, 
                                     PRInt32 aCurSelfProgress, 
                                     PRInt32 aMaxSelfProgress, 
                                     PRInt32 aCurTotalProgress, 
                                     PRInt32 aMaxTotalProgress)
{
  return OnProgressChange64(aWebProgress, aRequest,
                            aCurSelfProgress, aMaxSelfProgress,
                            aCurTotalProgress, aMaxTotalProgress);
}

/* void onLocationChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in nsIURI location); */
NS_IMETHODIMP 
nsDownloadListener::OnLocationChange(nsIWebProgress *aWebProgress, 
           nsIRequest *aRequest, 
           nsIURI *location)
{
  return NS_OK;
}

/* void onStatusChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in nsresult aStatus, in wstring aMessage); */
NS_IMETHODIMP 
nsDownloadListener::OnStatusChange(nsIWebProgress *aWebProgress, 
               nsIRequest *aRequest, 
               nsresult aStatus, 
               const PRUnichar *aMessage)
{
  // aMessage contains an error string, but it's so crappy that we don't want to use it.
  if (NS_FAILED(aStatus))
    DownloadDone(aStatus);

  return NS_OK;
}

/* void onSecurityChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in unsigned long state); */
NS_IMETHODIMP 
nsDownloadListener::OnSecurityChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, PRUint32 state)
{
  return NS_OK;
}

// Implementation of nsIWebProgressListener
/* void onStateChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in unsigned long aStateFlags, in unsigned long aStatus); */
NS_IMETHODIMP 
nsDownloadListener::OnStateChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, PRUint32 aStateFlags, 
                                    PRUint32 aStatus)
{
  // NSLog(@"State changed: state %u, status %u", aStateFlags, aStatus);  

  if (!mGotFirstStateChange) {
    mNetworkTransfer = ((aStateFlags & STATE_IS_NETWORK) != 0);
    mGotFirstStateChange = PR_TRUE;
  }
  
  // when the entire download finishes, stop the progress timer and clean up
  // the window and controller. We will get this even in the event of a cancel,
  // so this is the only place in the listener where we should kill the download.
  if ((aStateFlags & STATE_STOP) && (!mNetworkTransfer || (aStateFlags & STATE_IS_NETWORK))) {
    DownloadDone(aStatus);
  }
  return NS_OK; 
}

#pragma mark -

void
nsDownloadListener::InitDialog()
{
  // dialog has to be shown before the outlets get hooked up
  if (mURI)
  {
    nsCAutoString spec;

    // we need to be careful not to show a password in the url
    nsCAutoString userPassword;
    mURI->GetUserPass(userPassword);
    if (!userPassword.IsEmpty())
    {
      // ugh, build it by hand
      nsCAutoString hostport, path;
      mURI->GetScheme(spec);
      mURI->GetHostPort(hostport);
      mURI->GetPath(path);
      
      spec.Append("://");
      spec.Append(hostport);
      spec.Append(path);
    }
    else {
      nsCOMPtr<nsIURI> exposableURI;
      nsCOMPtr<nsIURIFixup> fixup(do_GetService("@mozilla.org/docshell/urifixup;1"));
      if (fixup && NS_SUCCEEDED(fixup->CreateExposableURI(mURI, getter_AddRefs(exposableURI))) && exposableURI)
        exposableURI->GetSpec(spec);
      else
        mURI->GetSpec(spec);
    }

    [mDownloadDisplay setSourceURL: [NSString stringWithUTF8String:spec.get()]];
  }

  nsAutoString pathStr;
  mDestinationFile->GetPath(pathStr);
  [mDownloadDisplay setDestinationPath: [NSString stringWith_nsAString:pathStr]];

  [mDownloadDisplay onStartDownload:IsFileSave()];
}

void
nsDownloadListener::PauseDownload()
{
  if (!mDownloadPaused && mRequest) 
  {
    mRequest->Suspend();
    mDownloadPaused = PR_TRUE;
  }
}

void
nsDownloadListener::ResumeDownload()
{
  if (mDownloadPaused && mRequest)
  {
    mRequest->Resume();
    mDownloadPaused = PR_FALSE;
  }
}

void
nsDownloadListener::CancelDownload()
{
  mUserCanceled = PR_TRUE;

  if (!mSentCancel)
  {
    if (mCancelable)
      mCancelable->Cancel(NS_BINDING_ABORTED);

    mSentCancel = PR_TRUE;
  }
    
  // when we cancel the download, we don't get any more notifications
  // from the backend (unlike for other transfer errors. So we have
  // to call DownloadDone ourselves.
  DownloadDone(NS_BINDING_ABORTED);
}

void
nsDownloadListener::DownloadDone(nsresult aStatus)
{
  // Quarantine the temporary file while it still exists.  This is done in
  // DownloadDone because we're assured to have as much information about the
  // download at possible at this point.
  QuarantineDownload();

  // break the reference cycle
  mCancelable = nsnull;
  
  mDownloadStatus = aStatus;
  
  if (NS_FAILED(aStatus))
  {
    // delete the file we created in CHBrowserService::Show
    if (mDestinationFile)
    {
      mDestinationFile->Remove(PR_FALSE);
      mDestinationFile = nsnull;
    }
    mDestination = nsnull;
  }
  
  [mDownloadDisplay onEndDownload:(NS_SUCCEEDED(aStatus) && !mUserCanceled) statusCode:aStatus];
}

//
// DetachDownloadDisplay
//
// there are times when the download dislpay UI goes away before the
// listener (quit, for example). This alerts us that we should forget all
// about having any UI.
//
void
nsDownloadListener::DetachDownloadDisplay()
{
  mDownloadDisplay = nil;
}

PRBool
nsDownloadListener::IsDownloadPaused()
{
  return mDownloadPaused;
}

#if MAC_OS_X_VERSION_MAX_ALLOWED <= MAC_OS_X_VERSION_10_4  // SDK
// This is a helper used by QuarantineDownload to look up strings at runtime.
static const CFStringRef GetCFStringFromBundle(CFBundleRef bundle,
                                               CFStringRef symbol) {
  const CFStringRef* string = (const CFStringRef*)
      ::CFBundleGetFunctionPointerForName(bundle, symbol);
  if (!string) {
    return NULL;
  }
  return *string;
}
#endif  // SDK

// The file quarantine was introduced in Mac OS X 10.5 ("Leopard") and is
// descibed at:
//
//    http://developer.apple.com/releasenotes/Carbon/RN-LaunchServices/index.html#//apple_ref/doc/uid/TP40001369-DontLinkElementID_2
//
// Quarantined files are marked with the "com.apple.quarantine" metadata
// attribute, tracked by Launch Services.  When the user attempts to launch
// an quarantined application, or an application in a quarantined disk image,
// the system will warn the user that the application may have untrustworthy
// origins.
//
// The system will automatically quarantine files created by applications that
// have opted in by setting the LSFileQuarantineEnabled key to true in their
// Info.plist, subject to exclusions identified in their specified
// LSFileQuarantineExcludedPathPatterns list.  Some applications are opted
// in by default, including Camino.
//
// When the system automatically quarantines files, it is only able to set
// the portions of the attribute that identify the application that created
// the file and the time that it was created.  Additional fields are available,
// to aid in identifying the source of the file.  In order to populate these
// fields, the application must make Launch Services calls on its own.
//
// This method makes those calls.
void nsDownloadListener::QuarantineDownload() {
  // Quarantining support is only present in Mac OS X 10.5 ("Leopard") and
  // later.  If building against an earlier SDK, these declarations and
  // symbols aren't available.  They'll be looked up at runtime.  When
  // running pre-10.5, this function will be a no-op.
  typedef OSStatus (*LSSetItemAttribute_type)(const FSRef*, LSRolesMask,
                                              CFStringRef, CFTypeRef);

  static LSSetItemAttribute_type lsSetItemAttributeFunc = NULL;
  static CFStringRef lsItemQuarantineProperties = NULL;

  // LaunchServices declares these as CFStringRef, but they're used here as
  // NSString.  Take advantage of data type equivalance and just call them
  // NSString.
  static NSString* lsQuarantineTypeKey = nil;
  static NSString* lsQuarantineOriginURLKey = nil;
  static NSString* lsQuarantineDataURLKey = nil;
  static NSString* lsQuarantineTypeOtherDownload = nil;
  static NSString* lsQuarantineTypeWebDownload = nil;

#if MAC_OS_X_VERSION_MAX_ALLOWED <= MAC_OS_X_VERSION_10_4  // SDK
  // The SDK is 10.4 or older, and doesn't contain 10.5 APIs.  Look up the
  // symbols we need at runtime the first time through this function.

  static bool didSymbolLookup = false;
  if (!didSymbolLookup) {
    didSymbolLookup = true;
    CFBundleRef launchServicesBundle =
        ::CFBundleGetBundleWithIdentifier(CFSTR("com.apple.LaunchServices"));
    if (!launchServicesBundle) {
      return;
    }

    lsSetItemAttributeFunc = (LSSetItemAttribute_type)
        ::CFBundleGetFunctionPointerForName(launchServicesBundle,
                                            CFSTR("LSSetItemAttribute"));

    lsItemQuarantineProperties = GetCFStringFromBundle(
        launchServicesBundle, CFSTR("kLSItemQuarantineProperties"));

    lsQuarantineTypeKey = (NSString*)GetCFStringFromBundle(
        launchServicesBundle, CFSTR("kLSQuarantineTypeKey"));

    lsQuarantineOriginURLKey = (NSString*)GetCFStringFromBundle(
        launchServicesBundle, CFSTR("kLSQuarantineOriginURLKey"));

    lsQuarantineDataURLKey = (NSString*)GetCFStringFromBundle(
        launchServicesBundle, CFSTR("kLSQuarantineDataURLKey"));

    lsQuarantineTypeOtherDownload = (NSString*)GetCFStringFromBundle(
        launchServicesBundle, CFSTR("kLSQuarantineTypeOtherDownload"));

    lsQuarantineTypeWebDownload = (NSString*)GetCFStringFromBundle(
        launchServicesBundle, CFSTR("kLSQuarantineTypeWebDownload"));
  }
#else  // SDK
  // The SDK is 10.5 or newer, and has stub libraries with these symbols.
  lsSetItemAttributeFunc = ::LSSetItemAttribute;
  lsItemQuarantineProperties = kLSItemQuarantineProperties;
  lsQuarantineTypeKey = (NSString*)kLSQuarantineTypeKey;
  lsQuarantineOriginURLKey = (NSString*)kLSQuarantineOriginURLKey;
  lsQuarantineDataURLKey = (NSString*)kLSQuarantineDataURLKey;
  lsQuarantineTypeOtherDownload = (NSString*)kLSQuarantineTypeOtherDownload;
  lsQuarantineTypeWebDownload = (NSString*)kLSQuarantineTypeWebDownload;
#endif  // SDK

#if MAC_OS_X_VERSION_MIN_REQUIRED <= MAC_OS_X_VERSION_10_4  // DT
  // Regardless of the SDK, this may run on releases older than 10.5 that
  // don't contain these symbols.  Before going any further, check to make
  // sure that everything is present.
  if (!lsSetItemAttributeFunc || !lsItemQuarantineProperties ||
      !lsQuarantineTypeKey || !lsQuarantineOriginURLKey ||
      !lsQuarantineDataURLKey || !lsQuarantineTypeOtherDownload ||
      !lsQuarantineTypeWebDownload) {
    return;
  }
#endif  // DT

  nsCOMPtr<nsILocalFileMac> tempFile = do_QueryInterface(mTempFile);
  if (!tempFile) {
    return;
  }

  FSRef tempFSRef;
  if (NS_FAILED(tempFile->GetFSRef(&tempFSRef))) {
    return;
  }

  NSDictionary* quarantineProperties = nil;
  CFTypeRef quarantinePropertiesBase = NULL;
  if (::LSCopyItemAttribute(&tempFSRef, kLSRolesAll,
                            lsItemQuarantineProperties,
                            &quarantinePropertiesBase) == noErr) {
    if (::CFGetTypeID(quarantinePropertiesBase) ==
        ::CFDictionaryGetTypeID()) {
      // Quarantine properties will already exist if LSFileQuarantineEnabled
      // is on and the file doesn't match an exclusion.
      quarantineProperties =
          [[(NSDictionary*)quarantinePropertiesBase mutableCopy] autorelease];
    }
    else {
      NSLog(@"LSItemQuarantineProperties isn't a CFDictionary?  How odd!");
    }

    ::CFRelease(quarantinePropertiesBase);
  }

  if (!quarantineProperties) {
    // If quarantine properties don't already exist, create a new dictionary
    // with enough room for the keys we're adding.
    quarantineProperties = [NSMutableDictionary dictionaryWithCapacity:3];
  }

  // The system is nice enough to set values for kLSQuarantineAgentNameKey,
  // kLSQuarantineAgentBundleIdentifierKey, and kLSQuarantineTimeStampKey,
  // so we don't have to.  It sets these values even if LSFileQuarantineEnabled
  // is false.  How nice.  Thanks, system!

  if (![quarantineProperties valueForKey:lsQuarantineTypeKey]) {
    PRBool isWebScheme = PR_FALSE;
    NSString* type = lsQuarantineTypeOtherDownload;
    if ((NS_SUCCEEDED(mURI->SchemeIs("http", &isWebScheme)) && isWebScheme) ||
        (NS_SUCCEEDED(mURI->SchemeIs("https", &isWebScheme)) && isWebScheme)) {
      type = lsQuarantineTypeWebDownload;
    }
    [quarantineProperties setValue:type forKey:lsQuarantineTypeKey];
  }

  if (![quarantineProperties valueForKey:lsQuarantineOriginURLKey] &&
      mReferrer) {
    nsCAutoString url;
    if (NS_SUCCEEDED(mReferrer->GetSpec(url))) {
      [quarantineProperties setValue:[NSString stringWith_nsACString:url]
                              forKey:lsQuarantineOriginURLKey];
    }
  }

  if (![quarantineProperties valueForKey:lsQuarantineDataURLKey]) {
    nsCAutoString url;
    if (NS_SUCCEEDED(mURI->GetSpec(url))) {
      [quarantineProperties setValue:[NSString stringWith_nsACString:url]
                              forKey:lsQuarantineDataURLKey];
    }
  }

  // If you call this more than once, it will appear to succeed, but no
  // updates are actually made to the quarantine data.
  lsSetItemAttributeFunc(&tempFSRef, kLSRolesAll, lsItemQuarantineProperties,
                         quarantineProperties);
}

void nsDownloadListener::FigureOutReferrer() {
  if (!mReferrer) {
    nsCOMPtr<nsIChannel> channel = do_QueryInterface(mRequest);
    if (channel) {
      NS_GetReferrerFromChannel(channel, getter_AddRefs(mReferrer));
    }
  }
}

#pragma mark -
