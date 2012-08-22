/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMPtr.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMacShellService.h"
#include "nsStringGlue.h"
#include "nsIDOMElement.h"
#include "nsILocalFileMac.h"

#include <CoreFoundation/CoreFoundation.h>
#include <Carbon/Carbon.h>

#define SAFARI_BUNDLE_IDENTIFIER "com.apple.Safari"

NS_IMPL_ISUPPORTS1(nsMacShellService, nsIShellService)

NS_IMETHODIMP
nsMacShellService::IsDefaultClient(bool aStartupCheck, uint16_t aApps, bool *aIsDefaultClient)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetDefaultClient(bool aForAllUsers,
                                    bool aClaimAllTypes, uint16_t aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::GetShouldCheckDefaultClient(bool* aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetShouldCheckDefaultClient(bool aShouldCheck)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::GetShouldBeDefaultClientFor(uint16_t* aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetShouldBeDefaultClientFor(uint16_t aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::GetCanSetDesktopBackground(bool* aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetDesktopBackground(nsIDOMElement* aElement,
                                            int32_t aPosition)
{
  return NS_ERROR_NOT_IMPLEMENTED;
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
  if (!uris) {
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
  if (!defaultHandlerID) {
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

  if (status == noErr && defaultHandlerURL) {
    nsCOMPtr<nsILocalFileMac> defaultReader =
      do_CreateInstance("@mozilla.org/file/local;1", &rv);
    if (NS_SUCCEEDED(rv)) {
      rv = defaultReader->InitWithCFURL(defaultHandlerURL);
      if (NS_SUCCEEDED(rv)) {
        NS_ADDREF(*_retval = defaultReader);
      }
    }

    ::CFRelease(defaultHandlerURL);
  }

  ::CFRelease(defaultHandlerID);

  return rv;
}
