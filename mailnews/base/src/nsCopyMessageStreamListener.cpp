/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCopyMessageStreamListener.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMailboxUrl.h"
#include "nsIMsgHdr.h"
#include "nsIMsgImapMailFolder.h"
#include "nsIMsgMessageService.h"
#include "nsMsgUtils.h"
#include "netCore.h"

NS_IMPL_ISUPPORTS3(nsCopyMessageStreamListener, nsIStreamListener,
  nsIRequestObserver, nsICopyMessageStreamListener)

static nsresult GetMessage(nsIURI *aURL, nsIMsgDBHdr **message)
{
  NS_ENSURE_ARG_POINTER(message);

	nsCOMPtr<nsIMsgMessageUrl> uriURL;
	nsresult rv;

	//Need to get message we are about to copy
	uriURL = do_QueryInterface(aURL, &rv);
	if(NS_FAILED(rv))
		return rv;

  // get the uri.  first try and use the original message spec
  // if that fails, use the spec of nsIURI that we're called with
  nsCString uri;
  rv = uriURL->GetOriginalSpec(getter_Copies(uri));
  if (NS_FAILED(rv) || uri.IsEmpty()) {
    rv = uriURL->GetUri(getter_Copies(uri));
    NS_ENSURE_SUCCESS(rv,rv);
  }

  nsCOMPtr <nsIMsgMessageService> msgMessageService;
  rv = GetMessageServiceFromURI(uri, getter_AddRefs(msgMessageService));
  NS_ENSURE_SUCCESS(rv,rv);
  if (!msgMessageService) 
    return NS_ERROR_FAILURE;

  rv = msgMessageService->MessageURIToMsgHdr(uri.get(), message);
  return rv; 
}

nsCopyMessageStreamListener::nsCopyMessageStreamListener()
{
}

nsCopyMessageStreamListener::~nsCopyMessageStreamListener()
{
	//All member variables are nsCOMPtr's.
}

NS_IMETHODIMP nsCopyMessageStreamListener::Init(nsIMsgFolder *srcFolder, nsICopyMessageListener *destination, nsISupports *listenerData)
{
	mSrcFolder = srcFolder;
	mDestination = destination;
	mListenerData = listenerData;
	return NS_OK;
}

NS_IMETHODIMP nsCopyMessageStreamListener::StartMessage()
{
	if (mDestination)
		mDestination->StartMessage();

	return NS_OK;
}

NS_IMETHODIMP nsCopyMessageStreamListener::EndMessage(nsMsgKey key)
{
	if (mDestination)
		mDestination->EndMessage(key);

	return NS_OK;
}


NS_IMETHODIMP nsCopyMessageStreamListener::OnDataAvailable(nsIRequest * /* request */, nsISupports *ctxt, nsIInputStream *aIStream, uint64_t sourceOffset, uint32_t aLength)
{
	nsresult rv;
	rv = mDestination->CopyData(aIStream, aLength);
	return rv;
}

NS_IMETHODIMP nsCopyMessageStreamListener::OnStartRequest(nsIRequest * request, nsISupports *ctxt)
{
	nsCOMPtr<nsIMsgDBHdr> message;
	nsresult rv = NS_OK;
	nsCOMPtr<nsIURI> uri = do_QueryInterface(ctxt, &rv);

  NS_ASSERTION(NS_SUCCEEDED(rv), "ahah...someone didn't pass in the expected context!!!");
	
	if (NS_SUCCEEDED(rv))
		rv = GetMessage(uri, getter_AddRefs(message));
	if(NS_SUCCEEDED(rv))
		rv = mDestination->BeginCopy(message);

  NS_ENSURE_SUCCESS(rv, rv);
	return rv;
}

NS_IMETHODIMP nsCopyMessageStreamListener::EndCopy(nsISupports *url, nsresult aStatus)
{
  nsresult rv;
  nsCOMPtr<nsIURI> uri = do_QueryInterface(url, &rv);

  NS_ENSURE_SUCCESS(rv, rv);
  bool copySucceeded = (aStatus == NS_BINDING_SUCCEEDED);
  rv = mDestination->EndCopy(copySucceeded);
  //If this is a move and we finished the copy, delete the old message.
  bool moveMessage = false;

  nsCOMPtr<nsIMsgMailNewsUrl> mailURL(do_QueryInterface(uri));
  if (mailURL)
    rv = mailURL->IsUrlType(nsIMsgMailNewsUrl::eMove, &moveMessage);

  if (NS_FAILED(rv))
    moveMessage = false;

  // OK, this is wrong if we're moving to an imap folder, for example. This really says that
  // we were able to pull the message from the source, NOT that we were able to
  // put it in the destination!
  if (moveMessage)
  {
    // don't do this if we're moving to an imap folder - that's handled elsewhere.
    nsCOMPtr<nsIMsgImapMailFolder> destImap = do_QueryInterface(mDestination);
      // if the destination is a local folder, it will handle the delete from the source in EndMove
    if (!destImap)
      rv = mDestination->EndMove(copySucceeded);
  }
  // Even if the above actions failed we probably still want to return NS_OK.
  // There should probably be some error dialog if either the copy or delete failed.
  return NS_OK;
}

NS_IMETHODIMP nsCopyMessageStreamListener::OnStopRequest(nsIRequest* request, nsISupports *ctxt, nsresult aStatus)
{
  return EndCopy(ctxt, aStatus);
}

