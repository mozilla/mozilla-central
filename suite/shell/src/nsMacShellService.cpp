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
 * The Original Code is Shell Service.
 *
 * The Initial Developer of the Original Code is Ben Goodger.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <ben@mozilla.org> (Original Author)
 *   Asaf Romano <mozilla.mano@sent.com>
 *   Benjamin Smedberg <benjamin@smedbergs.us>
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

#include "nsCOMPtr.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMacShellService.h"
#include "nsStringGlue.h"
#include "nsIDOMElement.h"
#include "nsILocalFileMac.h"
#include "mozilla/ModuleUtils.h"

#include <CoreFoundation/CoreFoundation.h>
#include <Carbon/Carbon.h>

#define SAFARI_BUNDLE_IDENTIFIER "com.apple.Safari"

NS_IMPL_ISUPPORTS1(nsMacShellService, nsIShellService)

NS_IMETHODIMP
nsMacShellService::IsDefaultClient(PRBool aStartupCheck, PRUint16 aApps, PRBool *aIsDefaultClient)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetDefaultClient(PRBool aForAllUsers,
                                    PRBool aClaimAllTypes, PRUint16 aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::GetShouldCheckDefaultClient(PRBool* aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetShouldCheckDefaultClient(PRBool aShouldCheck)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::GetShouldBeDefaultClientFor(PRUint16* aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetShouldBeDefaultClientFor(PRUint16 aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetDesktopBackground(nsIDOMElement* aElement,
                                            PRInt32 aPosition)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::GetDesktopBackgroundColor(PRUint32 *aColor)
{
  // This method and |SetDesktopBackgroundColor| has no meaning on Mac OS X.
  // The mac desktop preferences UI uses pictures for the few solid colors it
  // supports.
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::SetDesktopBackgroundColor(PRUint32 aColor)
{
  // This method and |GetDesktopBackgroundColor| has no meaning on Mac OS X.
  // The mac desktop preferences UI uses pictures for the few solid colors it
  // supports.
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMacShellService::OpenApplicationWithURI(nsILocalFile* aApplication, const nsACString& aURI)
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
nsMacShellService::GetDefaultFeedReader(nsILocalFile** _retval)
{
  nsresult rv = NS_ERROR_FAILURE;
  *_retval = nsnull;

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

#ifdef BUILD_STATIC_SHELL
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMacShellService)
NS_DEFINE_NAMED_CID(NS_SUITEMACINTEGRATION_CID);

static const mozilla::Module::CIDEntry kSuiteShellCIDs[] = {
  { &kNS_SUITEMACINTEGRATION_CID, false, NULL, nsMacShellServiceConstructor },
  { NULL }
};

static const mozilla::Module::ContractIDEntry kSuiteShellContracts[] = {
  { NS_SUITEFEEDSERVICE_CONTRACTID, &kNS_SUITEMACINTEGRATION_CID },
  { NULL }
};

static const mozilla::Module kSuiteShellModule = {
  mozilla::Module::kVersion,
  kSuiteShellCIDs,
  kSuiteShellContracts
};

NSMODULE_DEFN(nsSuiteShellModule) = &kSuiteShellModule;
#endif

