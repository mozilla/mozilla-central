/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbContentHandler.h"
#include "nsAbBaseCID.h"
#include "nsNetUtil.h"
#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "nsISupportsPrimitives.h"
#include "plstr.h"
#include "nsIDOMWindow.h"
#include "nsMsgUtils.h"
#include "nsIMsgVCardService.h"
#include "nsIAbCard.h"
#include "nsIAbManager.h"
#include "nsVCard.h"

//
// nsAbContentHandler
//
nsAbContentHandler::nsAbContentHandler()
{
}

nsAbContentHandler::~nsAbContentHandler()
{
}

NS_IMPL_ISUPPORTS2(nsAbContentHandler, nsIContentHandler,
  nsIStreamLoaderObserver)

NS_IMETHODIMP
nsAbContentHandler::HandleContent(const char *aContentType,
                                  nsIInterfaceRequestor *aWindowContext,
                                  nsIRequest *request)
{
  NS_ENSURE_ARG_POINTER(request);

  nsresult rv = NS_OK;

  // First of all, get the content type and make sure it is a content type we know how to handle!
  if (PL_strcasecmp(aContentType, "application/x-addvcard") == 0) {
    nsCOMPtr<nsIURI> uri;
    nsCOMPtr<nsIChannel> aChannel = do_QueryInterface(request);
    if (!aChannel) return NS_ERROR_FAILURE;

    rv = aChannel->GetURI(getter_AddRefs(uri));
    if (uri)
    {
        nsAutoCString path;
        rv = uri->GetPath(path);
        NS_ENSURE_SUCCESS(rv,rv);

        const char *startOfVCard = strstr(path.get(), "add?vcard=");
        if (startOfVCard)
        {
            nsCString unescapedData;
            
            // XXX todo, explain why we is escaped twice
            MsgUnescapeString(nsDependentCString(startOfVCard + strlen("add?vcard=")), 
                                                 0, unescapedData);

            if (!aWindowContext)
                return NS_ERROR_FAILURE;

            nsCOMPtr<nsIDOMWindow> parentWindow = do_GetInterface(aWindowContext);
            if (!parentWindow)
                return NS_ERROR_FAILURE;

            nsCOMPtr<nsIAbManager> ab =
              do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
            NS_ENSURE_SUCCESS(rv, rv);

            nsCOMPtr <nsIAbCard> cardFromVCard;
            rv = ab->EscapedVCardToAbCard(unescapedData.get(),
                                          getter_AddRefs(cardFromVCard));
            NS_ENSURE_SUCCESS(rv, rv);

            nsCOMPtr<nsISupportsInterfacePointer> ifptr =
                do_CreateInstance(NS_SUPPORTS_INTERFACE_POINTER_CONTRACTID, &rv);
            NS_ENSURE_SUCCESS(rv, rv);

            ifptr->SetData(cardFromVCard);
            ifptr->SetDataIID(&NS_GET_IID(nsIAbCard));

            nsCOMPtr<nsIDOMWindow> dialogWindow;

            rv = parentWindow->OpenDialog(
                NS_LITERAL_STRING("chrome://messenger/content/addressbook/abNewCardDialog.xul"),
                EmptyString(),
                NS_LITERAL_STRING("chrome,resizable=no,titlebar,modal,centerscreen"),
                ifptr, getter_AddRefs(dialogWindow));
            NS_ENSURE_SUCCESS(rv, rv);
        }
        rv = NS_OK;
    }
  }
  else if (PL_strcasecmp(aContentType, "text/x-vcard") == 0) {
    // create a vcard stream listener that can parse the data stream
    // and bring up the appropriate UI

    // (1) cancel the current load operation. We'll restart it
    request->Cancel(NS_ERROR_ABORT);
    // get the url we were trying to open
    nsCOMPtr<nsIURI> uri;
    nsCOMPtr<nsIChannel> channel = do_QueryInterface(request);
    NS_ENSURE_TRUE(channel, NS_ERROR_FAILURE);

    rv = channel->GetURI(getter_AddRefs(uri));
    NS_ENSURE_SUCCESS(rv, rv);

    // create a stream loader to handle the v-card data
    nsCOMPtr<nsIStreamLoader> streamLoader;
    rv = NS_NewStreamLoader(getter_AddRefs(streamLoader), uri, this, aWindowContext);
    NS_ENSURE_SUCCESS(rv, rv);

  }
  else // The content-type was not application/x-addvcard...
    return NS_ERROR_WONT_HANDLE_CONTENT;

  return rv;
}

NS_IMETHODIMP
nsAbContentHandler::OnStreamComplete(nsIStreamLoader *aLoader,
                                     nsISupports *aContext, nsresult aStatus,
                                     uint32_t datalen, const uint8_t *data)
{
  NS_ENSURE_ARG_POINTER(aContext);
  NS_ENSURE_SUCCESS(aStatus, aStatus); // don't process the vcard if we got a status error
  nsresult rv = NS_OK;

  // take our vCard string and open up an address book window based on it
  nsCOMPtr<nsIMsgVCardService> vCardService = do_GetService(NS_MSGVCARDSERVICE_CONTRACTID);
  if (vCardService)
  {
    nsAutoPtr<VObject> vObj(vCardService->Parse_MIME((const char *)data, datalen));
    if (vObj)
    {
      int32_t len = 0;
      nsCString vCard;
      vCard.Adopt(vCardService->WriteMemoryVObjects(0, &len, vObj, false));

      nsCOMPtr<nsIAbManager> ab =
        do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr <nsIAbCard> cardFromVCard;
      rv = ab->EscapedVCardToAbCard(vCard.get(),
                                    getter_AddRefs(cardFromVCard));
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIDOMWindow> parentWindow = do_GetInterface(aContext);
      NS_ENSURE_TRUE(parentWindow, NS_ERROR_FAILURE);

      nsCOMPtr<nsIDOMWindow> dialogWindow;
      rv = parentWindow->OpenDialog(
           NS_LITERAL_STRING("chrome://messenger/content/addressbook/abNewCardDialog.xul"),
           EmptyString(),
           NS_LITERAL_STRING("chrome,resizable=no,titlebar,modal,centerscreen"),
           cardFromVCard, getter_AddRefs(dialogWindow));
    }
  }

  return rv;
}
