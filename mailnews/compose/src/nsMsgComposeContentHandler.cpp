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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jean-Francois Ducarroz <ducarroz@netscape.com>
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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

#include "nsMsgComposeContentHandler.h"
#include "nsMsgComposeService.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsIChannel.h"
#include "nsIURI.h"
#include "plstr.h"
#include "nsServiceManagerUtils.h"
#include "nsCOMPtr.h"
#include "nsIDOMWindow.h"
#include "nsIDOMDocument.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsNetUtil.h"
#include "nsIMsgFolder.h"
#include "nsIMsgIncomingServer.h"
#include "nsIMsgAccountManager.h"

static NS_DEFINE_CID(kMsgComposeServiceCID, NS_MSGCOMPOSESERVICE_CID);

nsMsgComposeContentHandler::nsMsgComposeContentHandler()
{
}

// The following macro actually implement addref, release and query interface
// for our component.
NS_IMPL_ISUPPORTS1(nsMsgComposeContentHandler, nsIContentHandler)

nsMsgComposeContentHandler::~nsMsgComposeContentHandler()
{
}

// Try to get an appropriate nsIMsgIdentity by going through the window, getting
// the document's URI, then the corresponding nsIMsgDBHdr. Then find the server
// associated with that header and get the first identity for it.
nsresult nsMsgComposeContentHandler::GetBestIdentity(
  nsIInterfaceRequestor* aWindowContext, nsIMsgIdentity **aIdentity)
{
  nsresult rv;

  nsCOMPtr<nsIDOMWindow> window = do_GetInterface(aWindowContext);
  if (!window)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIDOMDocument> document;
  window->GetDocument(getter_AddRefs(document));
  nsAutoString documentURIString;
  document->GetDocumentURI(documentURIString);

  nsCOMPtr<nsIURI> documentURI;
  rv = NS_NewURI(getter_AddRefs(documentURI), documentURIString);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgMessageUrl> msgURI = do_QueryInterface(documentURI);
  if (!msgURI)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  rv = msgURI->GetMessageHeader(getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgFolder> folder;
  rv = msgHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);

  // nsIMsgDBHdrs from .eml messages have a null folder, so bail out if that's
  // the case.
  if (!folder)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = folder->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgAccountManager> accountManager = do_GetService(
    NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = accountManager->GetFirstIdentityForServer(server, aIdentity);
  NS_ENSURE_SUCCESS(rv, rv);

  return rv;
}

NS_IMETHODIMP nsMsgComposeContentHandler::HandleContent(const char * aContentType,
                                                nsIInterfaceRequestor* aWindowContext, nsIRequest *request)
{
  nsresult rv = NS_OK;
  if (!request)
    return NS_ERROR_NULL_POINTER;

  // First of all, get the content type and make sure it is a content type we
  // know how to handle!
  if (PL_strcasecmp(aContentType, "application/x-mailto") == 0) {
    nsCOMPtr<nsIMsgIdentity> identity;

    if (aWindowContext)
      GetBestIdentity(aWindowContext, getter_AddRefs(identity));

    nsCOMPtr<nsIURI> aUri;
    nsCOMPtr<nsIChannel> aChannel = do_QueryInterface(request);
    if(!aChannel) return NS_ERROR_FAILURE;

    rv = aChannel->GetURI(getter_AddRefs(aUri));
    if (aUri)
    {
      nsCOMPtr<nsIMsgComposeService> composeService = 
               do_GetService(kMsgComposeServiceCID, &rv);
      if (NS_SUCCEEDED(rv))
        rv = composeService->OpenComposeWindowWithURI(nsnull, aUri, identity);
    }
  } else {
    // The content-type was not application/x-mailto...
    return NS_ERROR_WONT_HANDLE_CONTENT;
  }

  return rv;
}
