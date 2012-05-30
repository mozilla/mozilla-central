/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsCidProtocolHandler_h__
#define nsCidProtocolHandler_h__

#include "nsCOMPtr.h"
#include "nsIProtocolHandler.h"

class nsCidProtocolHandler : public nsIProtocolHandler
{
public:
  nsCidProtocolHandler();
  virtual ~nsCidProtocolHandler();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIPROTOCOLHANDLER
};

#endif /* nsCidProtocolHandler_h__ */
