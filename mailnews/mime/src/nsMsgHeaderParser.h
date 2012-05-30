/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/********************************************************************************************************

   Interface for parsing RFC-822 addresses.

*********************************************************************************************************/

#ifndef nsMSGRFCPARSER_h__
#define nsMSGRFCPARSER_h__

#include "msgCore.h"
#include "nsIMsgHeaderParser.h" /* include the interface we are going to support */
#include "nsIMimeConverter.h"
#include "comi18n.h"
#include "nsCOMPtr.h"

 /*
  * RFC-822 parser
  */

class nsMsgHeaderParser: public nsIMsgHeaderParser 
{
public:
  nsMsgHeaderParser();
  virtual ~nsMsgHeaderParser();

  /* this macro defines QueryInterface, AddRef and Release for this class */
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGHEADERPARSER
};

#endif /* nsMSGRFCPARSER_h__ */
