/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsAbContentHandler_h
#define __nsAbContentHandler_h
 
#include "nsIStreamLoader.h"
#include "nsIContentHandler.h"

class nsAbContentHandler : public nsIContentHandler,
                           public nsIStreamLoaderObserver
{
public:
  nsAbContentHandler();
  virtual ~nsAbContentHandler();

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSICONTENTHANDLER
  NS_DECL_NSISTREAMLOADEROBSERVER
};

#endif
