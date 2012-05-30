/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbDirFactoryService_h__
#define nsAbDirFactoryService_h__

#include "nsIAbDirFactoryService.h"

class nsAbDirFactoryService : public nsIAbDirFactoryService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIABDIRFACTORYSERVICE

  nsAbDirFactoryService();
  virtual ~nsAbDirFactoryService();
};

#endif
