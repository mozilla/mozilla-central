/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMessengerContentHandler.h"
#include "nsIChannel.h"
#include "nsPIDOMWindow.h"
#include "nsIServiceManager.h"
#include "nsIWindowWatcher.h"
#include "nsIDocShell.h"
#include "nsIWebNavigation.h"
#include "nsIURL.h"
#include "nsStringGlue.h"
#include "nsMsgBaseCID.h"
#include "plstr.h"
#include "nsIURL.h"
#include "nsServiceManagerUtils.h"

nsMessengerContentHandler::nsMessengerContentHandler()
{
}

/* the following macro actually implement addref, release and query interface for our component. */
NS_IMPL_ISUPPORTS1(nsMessengerContentHandler, nsIContentHandler)

nsMessengerContentHandler::~nsMessengerContentHandler()
{
}

NS_IMETHODIMP nsMessengerContentHandler::HandleContent(const char * aContentType,
                                                nsIInterfaceRequestor* aWindowContext, nsIRequest *request)
{
  nsresult rv = NS_OK;
  if (!request)
    return NS_ERROR_NULL_POINTER;

  // First of all, get the content type and make sure it is a content type we know how to handle!
  if (PL_strcasecmp(aContentType, "application/x-message-display") == 0) {
    nsCOMPtr<nsIURI> aUri;
    nsCOMPtr<nsIChannel> aChannel = do_QueryInterface(request);
    if (!aChannel) return NS_ERROR_FAILURE;

    rv = aChannel->GetURI(getter_AddRefs(aUri));
    if (aUri)
    {
      rv = request->Cancel(NS_ERROR_ABORT);
      if (NS_SUCCEEDED(rv))
      {
        nsCOMPtr<nsIURL> aUrl = do_QueryInterface(aUri);
        if (aUrl)
        {
          nsAutoCString queryPart;
          aUrl->GetQuery(queryPart);
          queryPart.Replace(queryPart.Find("type=message/rfc822"),
                            sizeof("type=message/rfc822") - 1,
                            "type=application/x-message-display");
          aUrl->SetQuery(queryPart);
          rv = OpenWindow(aUri);
        }
      }
    }
  }

  return rv;
}

// Utility function to open a message display window and and load the message in it.
nsresult nsMessengerContentHandler::OpenWindow(nsIURI* aURI)
{
  NS_ENSURE_ARG_POINTER(aURI);
  
  nsCOMPtr<nsIWindowWatcher> wwatch = do_GetService("@mozilla.org/embedcomp/window-watcher;1");
  if (!wwatch)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIDOMWindow> newWindow;
  return wwatch->OpenWindow(0, "chrome://messenger/content/messageWindow.xul",
                 "_blank", "all,chrome,dialog=no,status,toolbar", aURI,
                 getter_AddRefs(newWindow));
}
