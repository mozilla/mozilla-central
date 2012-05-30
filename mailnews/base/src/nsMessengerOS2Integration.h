/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMessengerOS2Integration_h
#define __nsMessengerOS2Integration_h

#include "nsIMessengerOSIntegration.h"
#include "nsIFolderListener.h"

#define NS_MESSENGEROS2INTEGRATION_CID \
  {0xf62f3d3a, 0x1dd1, 0x11b2, \
    {0xa5, 0x16, 0xef, 0xad, 0xb1, 0x31, 0x61, 0x5c}}

class nsMessengerOS2Integration : public nsIMessengerOSIntegration,
                                  public nsIFolderListener
{
public:
  nsMessengerOS2Integration();
  virtual ~nsMessengerOS2Integration();
  virtual nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMESSENGEROSINTEGRATION
  NS_DECL_NSIFOLDERLISTENER

private:
  nsCOMPtr<nsIAtom> mBiffStateAtom;
  nsCOMPtr<nsIAtom> mTotalUnreadMessagesAtom;
};

#endif // __nsMessengerOS2Integration_h
