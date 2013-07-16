/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbMDBCard_h__
#define nsAbMDBCard_h__

#include "mozilla/Attributes.h"
#include "nsAbCardProperty.h"
#include "nsCOMPtr.h"

class nsAbMDBCard: public nsAbCardProperty
{
public:
  NS_DECL_ISUPPORTS_INHERITED

  nsAbMDBCard(void);
  virtual ~nsAbMDBCard(void);

  NS_IMETHOD Equals(nsIAbCard *card, bool *result) MOZ_OVERRIDE;
};

#endif
