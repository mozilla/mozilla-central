/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsLDAPModification_h_
#define _nsLDAPModification_h_

#include "nsILDAPModification.h"
#include "nsIMutableArray.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"
#include "mozilla/Mutex.h"

// 5b0f4d00-062e-11d6-a7f2-fc943c3c039c
//
#define NS_LDAPMODIFICATION_CID \
{ 0x5b0f4d00, 0x062e, 0x11d6, \
  { 0xa7, 0xf2, 0xfc, 0x94, 0x3c, 0x3c, 0x03, 0x9c }}

class nsLDAPModification : public nsILDAPModification
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSILDAPMODIFICATION

  // constructor & destructor
  //
  nsLDAPModification();
  virtual ~nsLDAPModification();

  nsresult Init();

private:
  int32_t mOperation;
  nsCString mType;
  nsCOMPtr<nsIMutableArray> mValues;
  mozilla::Mutex mValuesLock;
};

#endif // _nsLDAPModification_h_
