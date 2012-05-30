/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsPop3URL_h__
#define nsPop3URL_h__

#include "nsIPop3URL.h"
#include "nsMsgMailNewsUrl.h"
#include "nsIMsgIncomingServer.h"
#include "nsCOMPtr.h"

class nsPop3URL : public nsIPop3URL, public nsMsgMailNewsUrl
{
public:
  NS_DECL_NSIPOP3URL
  nsPop3URL();
  NS_DECL_ISUPPORTS_INHERITED

protected:
  virtual ~nsPop3URL();

  nsCString m_messageUri;

  /* Pop3 specific event sinks */
  nsCOMPtr<nsIPop3Sink> m_pop3Sink;
};

#endif // nsPop3URL_h__
