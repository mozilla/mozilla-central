/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMailMacIntegration.h"
#include "nsCOMPtr.h"
#include "nsIServiceManager.h"
#include "nsIStringBundle.h"
#include "nsIPromptService.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsString.h"
#include "nsEmbedCID.h"

// These Launch Services functions are undocumented. We're using them since
// they're the only way to set the default opener for URLs
extern "C" {
  // Returns the CFURL for application currently set as the default opener for
  // the given URL scheme. appURL must be released by the caller.
  extern OSStatus _LSCopyDefaultSchemeHandlerURL(CFStringRef scheme,
                                                 CFURLRef *appURL);
  extern OSStatus _LSSetDefaultSchemeHandlerURL(CFStringRef scheme,
                                                CFURLRef appURL);
  extern OSStatus _LSSaveAndRefresh(void);
}

NS_IMPL_ISUPPORTS1(nsMailMacIntegration, nsIShellService)

nsMailMacIntegration::nsMailMacIntegration(): mCheckedThisSession(false)
{}

NS_IMETHODIMP
nsMailMacIntegration::IsDefaultClient(bool aStartupCheck, uint16_t aApps, bool * aIsDefaultClient)
{
  *aIsDefaultClient = true;
  if (aApps & nsIShellService::MAIL)
    *aIsDefaultClient &= isDefaultHandlerForProtocol(CFSTR("mailto"));
  if (aApps & nsIShellService::NEWS)
    *aIsDefaultClient &= isDefaultHandlerForProtocol(CFSTR("news"));
  if (aApps & nsIShellService::RSS)
    *aIsDefaultClient &= isDefaultHandlerForProtocol(CFSTR("feed"));
  
  // if this is the first mail window, maintain internal state that we've
  // checked this session (so that subsequent window opens don't show the 
  // default client dialog.
  
  if (aStartupCheck)
    mCheckedThisSession = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMailMacIntegration::SetDefaultClient(bool aForAllUsers, uint16_t aApps)
{
  nsresult rv = NS_OK;
  if (aApps & nsIShellService::MAIL)
    rv = setAsDefaultHandlerForProtocol(CFSTR("mailto"));    
  if (NS_SUCCEEDED(rv) && aApps & nsIShellService::NEWS)
    rv = setAsDefaultHandlerForProtocol(CFSTR("news"));
  if (NS_SUCCEEDED(rv) && aApps & nsIShellService::RSS)
    rv = setAsDefaultHandlerForProtocol(CFSTR("feed"));

  return rv;	
}

NS_IMETHODIMP
nsMailMacIntegration::GetShouldCheckDefaultClient(bool* aResult)
{
  if (mCheckedThisSession) 
  {
    *aResult = false;
    return NS_OK;
  }

  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  return prefs->GetBoolPref("mail.shell.checkDefaultClient", aResult);
}

NS_IMETHODIMP
nsMailMacIntegration::SetShouldCheckDefaultClient(bool aShouldCheck)
{
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  return prefs->SetBoolPref("mail.shell.checkDefaultClient", aShouldCheck);
}

bool
nsMailMacIntegration::isDefaultHandlerForProtocol(CFStringRef aScheme)
{
  bool isDefault = false;
  // Since neither Launch Services nor Internet Config actually differ between 
  // bundles which have the same bundle identifier (That is, if we set our
  // URL of our bundle as the default handler for the given protocol,
  // Launch Service might return the URL of another thunderbird bundle as the
  // defualt handler for that protocol), we are comparing the identifiers of the
  // bundles rather than their URLs.

  CFStringRef tbirdID = ::CFBundleGetIdentifier(CFBundleGetMainBundle());
  if (!tbirdID) {
    // CFBundleGetIdentifier is expected to return NULL only if the specified
    // bundle doesn't have a bundle identifier in its dictionary. In this case,
    // that means a failure, since our bundle does have an identifier.
    return isDefault;
  }

  ::CFRetain(tbirdID);

  // Get the default handler URL of the given protocol
  CFURLRef defaultHandlerURL;
  OSStatus err = ::_LSCopyDefaultSchemeHandlerURL(aScheme,
                                                  &defaultHandlerURL);

  if (err == noErr) {
    // Get a reference to the bundle (based on its URL)
    CFBundleRef defaultHandlerBundle = ::CFBundleCreate(NULL, 
                                                        defaultHandlerURL);
    if (defaultHandlerBundle) {
      CFStringRef defaultHandlerID =
        ::CFBundleGetIdentifier(defaultHandlerBundle);
      if (defaultHandlerID) {
        ::CFRetain(defaultHandlerID);
        // and compare it to our bundle identifier
        isDefault = ::CFStringCompare(tbirdID, defaultHandlerID, 0)
                       == kCFCompareEqualTo;
        ::CFRelease(defaultHandlerID);
      }
      else {
        // If the bundle doesn't have an identifier in its info property list,
        // it's not our bundle.
        isDefault = false;
      }

      ::CFRelease(defaultHandlerBundle);
    }

    ::CFRelease(defaultHandlerURL);
  }
  else {
    // If |_LSCopyDefaultSchemeHandlerURL| failed, there's no default
    // handler for the given protocol
    isDefault = false;
  }

  ::CFRelease(tbirdID);
  return isDefault;
}

nsresult
nsMailMacIntegration::setAsDefaultHandlerForProtocol(CFStringRef aScheme)
{
  CFURLRef tbirdURL = ::CFBundleCopyBundleURL(CFBundleGetMainBundle());

  ::_LSSetDefaultSchemeHandlerURL(aScheme, tbirdURL);
  ::_LSSaveAndRefresh();
  ::CFRelease(tbirdURL);

  return NS_OK;
}



