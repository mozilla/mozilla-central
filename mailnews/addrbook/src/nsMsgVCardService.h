/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgVCardService_h___
#define nsMsgVCardService_h___

#include "nsIMsgVCardService.h"
#include "nsISupports.h"

class nsMsgVCardService : public nsIMsgVCardService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGVCARDSERVICE

  nsMsgVCardService();
  virtual ~nsMsgVCardService();
};

#endif /* nsMsgVCardService_h___ */
