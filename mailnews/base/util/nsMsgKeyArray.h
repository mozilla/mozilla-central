/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgKeyArray_h__
#define nsMsgKeyArray_h__

#include "nsIMsgKeyArray.h"
#include "nsTArray.h"

/*
 * This class is a thin wrapper around an nsTArray<nsMsgKey>
 */
class nsMsgKeyArray : public nsIMsgKeyArray
{
public:
  nsMsgKeyArray();
  virtual ~nsMsgKeyArray();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGKEYARRAY

  nsTArray<nsMsgKey> m_keys;
};

#endif
