/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMPtr.h"
#include "MailNewsDLF.h"
#include "nsIChannel.h"
#include "plstr.h"
#include "nsStringGlue.h"
#include "nsICategoryManager.h"
#include "nsIServiceManager.h"
#include "nsIStreamConverterService.h"
#include "nsIStreamListener.h"
#include "nsNetCID.h"
#include "nsMsgUtils.h"

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

  bool viewSource = (PL_strstr(aContentType,"view-source") != 0);

  aChannel->SetContentType(NS_LITERAL_CSTRING(TEXT_HTML));

  // Get the HTML category
  nsCOMPtr<nsICategoryManager> catMan(
    do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString contractID;
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
