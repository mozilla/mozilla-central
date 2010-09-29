/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Thunderbird MailNews Document Loader Factory.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
#include "MailNewsDLF.h"
#include "nsIChannel.h"
#include "plstr.h"
#include "nsStringGlue.h"
#include "nsICategoryManager.h"
#include "nsIServiceManager.h"
#include "nsIStreamConverterService.h"
#include "nsNetCID.h"

namespace mozilla {
namespace mailnews {
NS_IMPL_ISUPPORTS1(MailNewsDLF, nsIDocumentLoaderFactory)

MailNewsDLF::MailNewsDLF()
{
}

MailNewsDLF::~MailNewsDLF()
{
}

NS_IMETHODIMP
MailNewsDLF::CreateInstance(const char* aCommand,
                            nsIChannel* aChannel,
                            nsILoadGroup* aLoadGroup,
                            const char* aContentType, 
                            nsISupports* aContainer,
                            nsISupports* aExtraInfo,
                            nsIStreamListener** aDocListener,
                            nsIContentViewer** aDocViewer)
{
  nsresult rv;

  PRBool viewSource = (PL_strstr(aContentType,"view-source") != 0);

  aChannel->SetContentType(NS_LITERAL_CSTRING(TEXT_HTML));

  // Get the HTML category
  nsCOMPtr<nsICategoryManager> catMan(
    do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString contractID;
  rv = catMan->GetCategoryEntry("Gecko-Content-Viewers", TEXT_HTML,
                                getter_Copies(contractID));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocumentLoaderFactory> factory(do_GetService(contractID.get(),
                                             &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStreamListener> listener;

  if (viewSource) {
    rv = factory->CreateInstance("view-source", aChannel, aLoadGroup,
                                 TEXT_HTML "; x-view-type=view-source",
                                 aContainer, aExtraInfo, getter_AddRefs(listener),
                                 aDocViewer);
  } else {
    rv = factory->CreateInstance("view", aChannel, aLoadGroup, TEXT_HTML,
                                 aContainer, aExtraInfo, getter_AddRefs(listener),
                                 aDocViewer);
  }
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStreamConverterService> scs(
    do_GetService(NS_STREAMCONVERTERSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  return scs->AsyncConvertData(MESSAGE_RFC822, TEXT_HTML, listener, aChannel,
                               aDocListener);
}

NS_IMETHODIMP
MailNewsDLF::CreateInstanceForDocument(nsISupports* aContainer,
                                       nsIDocument* aDocument,
                                       const char* aCommand,
                                       nsIContentViewer** aDocViewer)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MailNewsDLF::CreateBlankDocument(nsILoadGroup* aLoadGroup,
                                 nsIPrincipal* aPrincipal,
                                 nsIDocument** aDocument)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

}
}
