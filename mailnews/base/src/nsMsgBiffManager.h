/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef NSMSGBIFFMANAGER_H
#define NSMSGBIFFMANAGER_H

#include "msgCore.h"
#include "nsIMsgBiffManager.h"
#include "nsITimer.h"
#include "nsTArray.h"
#include "nsCOMPtr.h"
#include "nsIIncomingServerListener.h"
#include "nsWeakReference.h"
#include "nsIObserver.h"

typedef struct {
  nsCOMPtr<nsIMsgIncomingServer> server;
  PRTime nextBiffTime;
} nsBiffEntry;


class nsMsgBiffManager
  : public nsIMsgBiffManager,
    public nsIIncomingServerListener,
    public nsIObserver,
    public nsSupportsWeakReference
{
public:
  nsMsgBiffManager(); 
  virtual ~nsMsgBiffManager();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGBIFFMANAGER
  NS_DECL_NSIINCOMINGSERVERLISTENER
  NS_DECL_NSIOBSERVER

  nsresult PerformBiff();

protected:
  int32_t FindServer(nsIMsgIncomingServer *server);
  nsresult SetNextBiffTime(nsBiffEntry &biffEntry, PRTime currentTime);
  nsresult SetupNextBiff();
  nsresult AddBiffEntry(nsBiffEntry &biffEntry);

protected:
  nsCOMPtr<nsITimer> mBiffTimer;
  nsTArray<nsBiffEntry> mBiffArray;
  bool mHaveShutdown;
  bool mInited;
};

#endif // NSMSGBIFFMANAGER_H
