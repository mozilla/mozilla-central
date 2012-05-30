/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgSMIMECID_h__
#define nsMsgSMIMECID_h__

#include "nsISupports.h"
#include "nsIFactory.h"
#include "nsIComponentManager.h"

#define NS_MSGSMIMECOMPFIELDS_CONTRACTID \
  "@mozilla.org/messenger-smime/composefields;1"

#define NS_MSGSMIMECOMPFIELDS_CID						     \
{ /* 122C919C-96B7-49a0-BBC8-0ABC67EEFFE0 */     \
 0x122c919c, 0x96b7, 0x49a0,                     \
 { 0xbb, 0xc8, 0xa, 0xbc, 0x67, 0xee, 0xff, 0xe0 }}

#define NS_MSGCOMPOSESECURE_CID						       \
{ /* dd753201-9a23-4e08-957f-b3616bf7e012 */     \
 0xdd753201, 0x9a23, 0x4e08,                     \
 {0x95, 0x7f, 0xb3, 0x61, 0x6b, 0xf7, 0xe0, 0x12 }}

#define NS_SMIMEJSHELPER_CONTRACTID \
  "@mozilla.org/messenger-smime/smimejshelper;1"

#define NS_SMIMEJSJELPER_CID                     \
{ /* d57d928c-60e4-4f81-999d-5c762e611205 */     \
 0xd57d928c, 0x60e4, 0x4f81,                     \
 {0x99, 0x9d, 0x5c, 0x76, 0x2e, 0x61, 0x12, 0x05 }}

#define NS_SMIMEENCRYPTURISERVICE_CONTRACTID     \
  "@mozilla.org/messenger-smime/smime-encrypted-uris-service;1"

#define NS_SMIMEENCRYPTURISERVICE_CID            \
{ /* a0134d58-018f-4d40-a099-fa079e5024a6 */     \
 0xa0134d58, 0x018f, 0x4d40,                     \
 {0xa0, 0x99, 0xfa, 0x07, 0x9e, 0x50, 0x24, 0xa6 }}

#endif // nsMsgSMIMECID_h__
