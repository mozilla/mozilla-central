/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "lber.h"
#include "nsILDAPBERElement.h"

// 070af769-b7f5-40e7-81be-196155ead84c
#define NS_LDAPBERELEMENT_CID \
  { 0x070af769, 0xb7f5, 0x40e7, \
      { 0x81, 0xbe, 0x19, 0x61, 0x55, 0xea, 0xd8, 0x4c }}

class nsLDAPBERElement : public nsILDAPBERElement
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSILDAPBERELEMENT

  nsLDAPBERElement();

private:
  ~nsLDAPBERElement();

  BerElement *mElement;

protected:
};

