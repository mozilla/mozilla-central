/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCidProtocolHandler.h"
#include "nsStringGlue.h"
#include "nsIURI.h"
#include "nsNetCID.h"
#include "nsComponentManagerUtils.h"

nsCidProtocolHandler::nsCidProtocolHandler()
{
}

nsCidProtocolHandler::~nsCidProtocolHandler()
{
}

NS_IMPL_ISUPPORTS1(nsCidProtocolHandler, nsIProtocolHandler)

NS_IMETHODIMP nsCidProtocolHandler::GetScheme(nsACString & aScheme)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsCidProtocolHandler::GetDefaultPort(int32_t *aDefaultPort)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsCidProtocolHandler::GetProtocolFlags(uint32_t *aProtocolFlags)
{
  // XXXbz so why does this protocol handler exist, exactly?
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsCidProtocolHandler::NewURI(const nsACString & aSpec, const char *aOriginCharset, nsIURI *aBaseURI, nsIURI **_retval)
{
  nsresult rv;
  nsCOMPtr <nsIURI> url = do_CreateInstance(NS_SIMPLEURI_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // the right fix is to use the baseSpec (or aBaseUri)
  // and specify the cid, and then fix mime
  // to handle that, like it does with "...&part=1.2"
  // for now, do about blank to prevent spam
  // from popping up annoying alerts about not implementing the cid
  // protocol
  rv = url->SetSpec(nsDependentCString("about:blank"));
  NS_ENSURE_SUCCESS(rv,rv);

  NS_IF_ADDREF(*_retval = url);
  return NS_OK;
}

NS_IMETHODIMP nsCidProtocolHandler::NewChannel(nsIURI *aURI, nsIChannel **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsCidProtocolHandler::AllowPort(int32_t port, const char *scheme, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

