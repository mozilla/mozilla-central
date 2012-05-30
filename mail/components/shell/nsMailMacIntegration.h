/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMailMacIntegration_h_
#define nsMailMacIntegration_h_

#include "nsIShellService.h"
#include "nsString.h"

#include <CoreFoundation/CoreFoundation.h>

#define NS_MAILMACINTEGRATION_CID \
{0x85a27035, 0xb970, 0x4079, {0xb9, 0xd2, 0xe2, 0x1f, 0x69, 0xe6, 0xb2, 0x1f}}

class nsMailMacIntegration : public nsIShellService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSISHELLSERVICE
  nsMailMacIntegration();

protected:
  bool isDefaultHandlerForProtocol(CFStringRef aScheme);
  nsresult setAsDefaultHandlerForProtocol(CFStringRef aScheme);

private:
  virtual ~nsMailMacIntegration() {};
  bool mCheckedThisSession;
};
#endif
