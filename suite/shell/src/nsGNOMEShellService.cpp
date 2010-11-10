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
 * The Initial Developer of the Original Code is mozilla.org.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
#include "nsComponentManagerUtils.h"
#include "nsDirectoryServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsGNOMEShellService.h"
#include "nsServiceManagerUtils.h"
#include "nsIGConfService.h"
#include "mozilla/ModuleUtils.h"
#include "nsIGnomeVFSService.h"
#include "nsILocalFile.h"
#include "nsIProcess.h"
#include "prenv.h"

NS_IMPL_ISUPPORTS1(nsGNOMEShellService, nsIShellService)

nsresult
nsGNOMEShellService::Init()
{
  nsresult rv;

  // Check G_BROKEN_FILENAMES.  If it's set, then filenames in glib use
  // the locale encoding.  If it's not set, they use UTF-8.
  mUseLocaleFilenames = PR_GetEnv("G_BROKEN_FILENAMES") != nsnull;

  nsCOMPtr<nsIFile> appPath;
  rv = NS_GetSpecialDirectory(NS_XPCOM_CURRENT_PROCESS_DIR,
                              getter_AddRefs(appPath));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = appPath->AppendNative(NS_LITERAL_CSTRING(MOZ_APP_NAME));
  NS_ENSURE_SUCCESS(rv, rv);

  return appPath->GetNativePath(mAppPath);
}

NS_IMETHODIMP
nsGNOMEShellService::IsDefaultClient(PRBool aStartupCheck, PRUint16 aApps,
                                     PRBool* aIsDefaultClient)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetDefaultClient(PRBool aForAllUsers,
                                      PRBool aClaimAllTypes, PRUint16 aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::GetShouldCheckDefaultClient(PRBool* aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetShouldCheckDefaultClient(PRBool aShouldCheck)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::GetShouldBeDefaultClientFor(PRUint16* aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetShouldBeDefaultClientFor(PRUint16 aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetDesktopBackground(nsIDOMElement* aElement, 
                                          PRInt32 aPosition)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::GetDesktopBackgroundColor(PRUint32 *aColor)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetDesktopBackgroundColor(PRUint32 aColor)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::OpenApplicationWithURI(nsILocalFile* aApplication, const nsACString& aURI)
{
  nsresult rv;
  nsCOMPtr<nsIProcess> process = 
    do_CreateInstance("@mozilla.org/process/util;1", &rv);
  if (NS_FAILED(rv))
    return rv;
  
  rv = process->Init(aApplication);
  if (NS_FAILED(rv))
    return rv;

  const nsCString& spec = PromiseFlatCString(aURI);
  const char* specStr = spec.get();
  return process->Run(PR_FALSE, &specStr, 1);
}

NS_IMETHODIMP
nsGNOMEShellService::GetDefaultFeedReader(nsILocalFile** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

#ifdef BUILD_STATIC_SHELL
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsGNOMEShellService, Init)
NS_DEFINE_NAMED_CID(NS_SUITEGNOMEINTEGRATION_CID);

static const mozilla::Module::CIDEntry kSuiteShellCIDs[] = {
  { &kNS_SUITEGNOMEINTEGRATION_CID, false, NULL, nsGNOMEShellServiceConstructor },
  { NULL }
};

static const mozilla::Module::ContractIDEntry kSuiteShellContracts[] = {
  { NS_SUITEFEEDSERVICE_CONTRACTID, &kNS_SUITEGNOMEINTEGRATION_CID },
  { NULL }
};

static const mozilla::Module kSuiteShellModule = {
  mozilla::Module::kVersion,
  kSuiteShellCIDs,
  kSuiteShellContracts
};

NSMODULE_DEFN(nsSuiteShellModule) = &kSuiteShellModule;
#endif

