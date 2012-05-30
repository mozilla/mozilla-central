/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgFolderNotificationService_h__
#define nsMsgFolderNotificationService_h__

#include "nsIMsgFolderNotificationService.h"
#include "nsIMsgFolderListener.h"
#include "nsTObserverArray.h"
#include "nsCOMPtr.h"

class nsMsgFolderNotificationService : public nsIMsgFolderNotificationService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGFOLDERNOTIFICATIONSERVICE

  nsMsgFolderNotificationService();

private:
  ~nsMsgFolderNotificationService();
  struct MsgFolderListener
  {
    nsCOMPtr<nsIMsgFolderListener> mListener;
    msgFolderListenerFlag mFlags;

    MsgFolderListener(nsIMsgFolderListener *aListener, msgFolderListenerFlag aFlags)
      : mListener(aListener), mFlags(aFlags) {}
    MsgFolderListener(const MsgFolderListener &aListener)
      : mListener(aListener.mListener), mFlags(aListener.mFlags) {}
    ~MsgFolderListener() {}

    int operator==(nsIMsgFolderListener* aListener) const {
      return mListener == aListener;
    }
    int operator==(const MsgFolderListener &aListener) const {
      return mListener == aListener.mListener;
    }
  };

  nsTObserverArray<MsgFolderListener> mListeners;
};

#endif
