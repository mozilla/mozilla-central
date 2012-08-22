/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAddbookProtocolHandler_h___
#define nsAddbookProtocolHandler_h___

#include "nscore.h"
#include "nsCOMPtr.h"
#include "nsAddbookProtocolHandler.h"
#include "nsIProtocolHandler.h"
#include "nsIAddbookUrl.h"
#include "nsIAddrDatabase.h"

class nsAddbookProtocolHandler : public nsIProtocolHandler
{
public:
	nsAddbookProtocolHandler();
	virtual ~nsAddbookProtocolHandler();

  NS_DECL_ISUPPORTS

  //////////////////////////////////////////////////////////////////////////
  // We support the nsIProtocolHandler interface.
  //////////////////////////////////////////////////////////////////////////
  NS_DECL_NSIPROTOCOLHANDLER

private:
  nsresult    GenerateXMLOutputChannel(nsString &aOutput,
                                         nsIAddbookUrl *addbookUrl,
                                         nsIURI *aURI, 
                                         nsIChannel **_retval);

  nsresult    GeneratePrintOutput(nsIAddbookUrl *addbookUrl, 
                                   nsString &aOutput);

  nsresult    BuildDirectoryXML(nsIAbDirectory *aDirectory, 
                                   nsString &aOutput);

  int32_t     mAddbookOperation;
};

#endif /* nsAddbookProtocolHandler_h___ */
