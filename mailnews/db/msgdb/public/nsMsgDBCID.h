/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgDBCID_h__
#define nsMsgDBCID_h__

#include "nsISupports.h"
#include "nsIFactory.h"
#include "nsIComponentManager.h"

// 03223c50-1e88-45e8-ba1a-7ce792dc3fc3
#define NS_MSGDB_SERVICE_CID \
{  0x03223c50, 0x1e88, 0x45e8, \
    { 0xba, 0x1a, 0x7c, 0xe7, 0x92, 0xdc, 0x3f, 0xc3 } }

#define NS_MSGDB_SERVICE_CONTRACTID \
  "@mozilla.org/msgDatabase/msgDBService;1"

#define NS_MSGDB_CONTRACTID \
  "@mozilla.org/nsMsgDatabase/msgDB-"

#define NS_MAILBOXDB_CONTRACTID \
  NS_MSGDB_CONTRACTID"mailbox"

//	a86c86ae-e97f-11d2-a506-0060b0fc04b7
#define NS_MAILDB_CID                      \
{ 0xa86c86ae, 0xe97f, 0x11d2,                   \
    { 0xa5, 0x06, 0x00, 0x60, 0xb0, 0xfc, 0x04, 0xb7 } }

#define NS_NEWSDB_CONTRACTID \
  NS_MSGDB_CONTRACTID"news"

// 36414aa0-e980-11d2-a506-0060b0fc04b7
#define NS_NEWSDB_CID                      \
{ 0x36414aa0, 0xe980, 0x11d2,                  \
    { 0xa5, 0x06, 0x00, 0x60, 0xb0, 0xfc, 0x04, 0xb7 } }

#define NS_IMAPDB_CONTRACTID \
  NS_MSGDB_CONTRACTID"imap"

// 9e4b07ee-e980-11d2-a506-0060b0fc04b7
#define NS_IMAPDB_CID                      \
{ 0x9e4b07ee, 0xe980, 0x11d2,                  \
    { 0xa5, 0x06, 0x00, 0x60, 0xb0, 0xfc, 0x04, 0xb7 } }

#define NS_MSG_RETENTIONSETTINGS_CID \
{ 0x1bd976d6, 0xdf44, 0x11d4,       \
  {0xa5, 0xb6, 0x00, 0x60, 0xb0, 0xfc, 0x04, 0xb7} }

#define NS_MSG_RETENTIONSETTINGS_CONTRACTID \
  "@mozilla.org/msgDatabase/retentionSettings;1"

// 4e3dae5a-157a-11d5-a5c0-0060b0fc04b7
#define NS_MSG_DOWNLOADSETTINGS_CID \
{ 0x4e3dae5a, 0x157a, 0x11d5,       \
  {0xa5, 0xc0, 0x00, 0x60, 0xb0, 0xfc, 0x04, 0xb7} }

#define NS_MSG_DOWNLOADSETTINGS_CONTRACTID \
  "@mozilla.org/msgDatabase/downloadSettings;1"

#endif
