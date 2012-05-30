/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbMDBDirFactory_h__
#define nsAbMDBDirFactory_h__

#include "nsIAbDirFactory.h"

class nsAbMDBDirFactory : public nsIAbDirFactory
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIABDIRFACTORY

  nsAbMDBDirFactory();
  virtual ~nsAbMDBDirFactory();
};


#endif
