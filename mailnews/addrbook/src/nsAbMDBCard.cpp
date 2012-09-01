/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbMDBCard.h"

nsAbMDBCard::nsAbMDBCard(void)
{
}

nsAbMDBCard::~nsAbMDBCard(void)
{
}

NS_IMPL_ISUPPORTS_INHERITED0(nsAbMDBCard, nsAbCardProperty)

NS_IMETHODIMP nsAbMDBCard::Equals(nsIAbCard *card, bool *result)
{
  NS_ENSURE_ARG_POINTER(card);
  NS_ENSURE_ARG_POINTER(result);

  if (this == card) {
    *result = true;
    return NS_OK;
  }

  // If we have the same directory, we will equal the other card merely given
  // the row IDs. If not, we are never equal. But we are dumb in that we don't
  // know who our directory is, which may change in the future. For now,
  // however, the only known users of this method are for locating us in a list
  // of cards, most commonly mailing lists; a warning on the IDL has also
  // notified consumers that this method is not generally safe to use. In this
  // respect, it is safe to assume that the directory portion is satisfied when
  // making this call.
  // However, if we make the wrong assumption, one of two things will happen.
  // If the other directory is a local address book, we could return a spurious
  // true result. If not, then DbRowID should be unset and we can definitively
  // return false.

  uint32_t row;
  nsresult rv = card->GetPropertyAsUint32("DbRowID", &row);
  if (NS_FAILED(rv))
  {
    *result = false;
    return NS_OK;
  }

  uint32_t ourRow;
  rv = GetPropertyAsUint32("DbRowID", &ourRow);
  NS_ENSURE_SUCCESS(rv, rv);

  *result = (row == ourRow);
  return NS_OK;
}
