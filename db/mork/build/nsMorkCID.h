/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMorkCID_h__
#define nsMorkCID_h__

#include "nsISupports.h"
#include "nsIFactory.h"
#include "nsIComponentManager.h"

#define NS_MORK_CONTRACTID \
  "@mozilla.org/db/mork;1"

// 36d90300-27f5-11d3-8d74-00805f8a6617
#define NS_MORK_CID                      \
{ 0x36d90300, 0x27f5, 0x11d3,                  \
    { 0x8d, 0x74, 0x00, 0x80, 0x5f, 0x8a, 0x66, 0x17 } }

#endif
