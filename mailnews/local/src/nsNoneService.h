/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsNoneService_h___
#define nsNoneService_h___

#include "nscore.h"

#include "nsIMsgProtocolInfo.h"
#include "nsINoneService.h"

class nsNoneService : public nsIMsgProtocolInfo, public nsINoneService
{
public:

  nsNoneService();
  virtual ~nsNoneService();

  NS_DECL_ISUPPORTS
    NS_DECL_NSIMSGPROTOCOLINFO
  NS_DECL_NSINONESERVICE

};

#endif /* nsNoneService_h___ */
