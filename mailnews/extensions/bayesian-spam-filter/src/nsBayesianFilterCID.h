/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsBayesianFilterCID_h__
#define nsBayesianFilterCID_h__

#include "nsISupports.h"
#include "nsIFactory.h"
#include "nsIComponentManager.h"

#include "nsIMsgMdnGenerator.h"

#define NS_BAYESIANFILTER_CONTRACTID \
  "@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"
#define NS_BAYESIANFILTER_CID                    \
{ /* F1070BFA-D539-11D6-90CA-00039310A47A */      \
 0xF1070BFA, 0xD539, 0x11D6,                      \
 { 0x90, 0xCA, 0x00, 0x03, 0x93, 0x10, 0xA4, 0x7A }}

#endif /* nsBayesianFilterCID_h__ */
