/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgMdnCID_h__
#define nsMsgMdnCID_h__

#include "nsISupports.h"
#include "nsIFactory.h"
#include "nsIComponentManager.h"

#include "nsIMsgMdnGenerator.h"

#define NS_MSGMDNGENERATOR_CONTRACTID \
  "@mozilla.org/messenger-mdn/generator;1"
#define NS_MSGMDNGENERATOR_CID                    \
{ /* ec917b13-8f73-4d4d-9146-d7f7aafe9076 */      \
 0xec917b13, 0x8f73, 0x4d4d,                      \
 { 0x91, 0x46, 0xd7, 0xf7, 0xaa, 0xfe, 0x90, 0x76 }}

#endif /* nsMsgMdnCID_h__ */
