/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsmacshellservice_h____
#define nsmacshellservice_h____

#include "nsShellService.h"
#include "nsIWebProgressListener.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"

#include <CoreFoundation/CoreFoundation.h>

#define NS_SUITEMACINTEGRATION_CID \
{0xac17e6f0, 0x50c9, 0x4901, {0xab, 0x08, 0xf8, 0x70, 0xbf, 0xcd, 0x12, 0xce}}

class nsMacShellService : public nsIShellService,
                          public nsIWebProgressListener
{
public:
  nsMacShellService() : mCheckedThisSessionClient(false) {};
  virtual ~nsMacShellService() {};

  NS_DECL_ISUPPORTS
  NS_DECL_NSISHELLSERVICE
  NS_DECL_NSIWEBPROGRESSLISTENER

protected:
  bool isDefaultHandlerForProtocol(CFStringRef aScheme);

private:
  nsCOMPtr<nsIFile> mBackgroundFile;
  bool mCheckedThisSessionClient;
};

#endif
