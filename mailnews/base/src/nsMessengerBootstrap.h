/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#ifndef __nsMessenger_h
#define __nsMessenger_h

#include "nscore.h"
#include "nsIMessengerWindowService.h"

#define NS_MESSENGERBOOTSTRAP_CID                 \
{ /* 4a85a5d0-cddd-11d2-b7f6-00805f05ffa5 */      \
  0x4a85a5d0, 0xcddd, 0x11d2,                     \
  {0xb7, 0xf6, 0x00, 0x80, 0x5f, 0x05, 0xff, 0xa5}}

class nsMessengerBootstrap :
    public nsIMessengerWindowService
{
public:
  nsMessengerBootstrap();
  virtual ~nsMessengerBootstrap();

  NS_DECL_THREADSAFE_ISUPPORTS  
  NS_DECL_NSIMESSENGERWINDOWSERVICE
};

#endif
