/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMimeEmitterCID_h__
#define nsMimeEmitterCID_h__

#include "nsISupports.h"
#include "nsIFactory.h"
#include "nsIComponentManager.h"

#define NS_MIME_EMITTER_CONTRACTID_PREFIX \
  "@mozilla.org/messenger/mimeemitter;1?type="

#define NS_HTML_MIME_EMITTER_CONTRACTID   \
  NS_MIME_EMITTER_CONTRACTID_PREFIX "text/html"
// {F0A8AF16-DCCE-11d2-A411-00805F613C79}
#define NS_HTML_MIME_EMITTER_CID   \
    { 0xf0a8af16, 0xdcce, 0x11d2,         \
    { 0xa4, 0x11, 0x0, 0x80, 0x5f, 0x61, 0x3c, 0x79 } }

#define NS_XML_MIME_EMITTER_CONTRACTID   \
  NS_MIME_EMITTER_CONTRACTID_PREFIX "text/xml"
// {977E418F-E392-11d2-A2AC-00A024A7D144}
#define NS_XML_MIME_EMITTER_CID   \
    { 0x977e418f, 0xe392, 0x11d2, \
    { 0xa2, 0xac, 0x0, 0xa0, 0x24, 0xa7, 0xd1, 0x44 } }

#define NS_RAW_MIME_EMITTER_CONTRACTID   \
  NS_MIME_EMITTER_CONTRACTID_PREFIX "raw"
// {F0A8AF16-DCFF-11d2-A411-00805F613C79}
#define NS_RAW_MIME_EMITTER_CID   \
    { 0xf0a8af16, 0xdcff, 0x11d2,         \
    { 0xa4, 0x11, 0x0, 0x80, 0x5f, 0x61, 0x3c, 0x79 } }

#define NS_XUL_MIME_EMITTER_CONTRACTID   \
  NS_MIME_EMITTER_CONTRACTID_PREFIX "application/vnd.mozilla.xul+xml"
// {FAA8AF16-DCFF-11d2-A411-00805F613C19}
#define NS_XUL_MIME_EMITTER_CID   \
    { 0xfaa8af16, 0xdcff, 0x11d2,         \
    { 0xa4, 0x11, 0x0, 0x80, 0x5f, 0x61, 0x3c, 0x19 } }

#define NS_PLAIN_MIME_EMITTER_CONTRACTID   \
  NS_MIME_EMITTER_CONTRACTID_PREFIX "text/plain"
// {E8892265-7653-46c5-A290-307F3404D0F3}
#define NS_PLAIN_MIME_EMITTER_CID   \
    { 0xe8892265, 0x7653, 0x46c5,         \
    { 0xa2, 0x90, 0x30, 0x7f, 0x34, 0x4, 0xd0, 0xf3 } }

#endif // nsMimeEmitterCID_h__
