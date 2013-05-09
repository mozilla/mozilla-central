/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef NSMSGPURGESERVICE_H
#define NSMSGPURGESERVICE_H

#include "msgCore.h"
#include "nsIMsgPurgeService.h"
#include "nsIMsgSearchSession.h"
#include "nsITimer.h"
#include "nsCOMPtr.h"
#include "nsIMsgSearchNotify.h"
#include "nsIMsgFolder.h"
#include "nsIMsgFolderCache.h"
#include "nsIMsgFolderCacheElement.h"
#include "nsIMutableArray.h"

class nsMsgPurgeService
	: public nsIMsgPurgeService,
		public nsIMsgSearchNotify
{
public:
	nsMsgPurgeService(); 
	virtual ~nsMsgPurgeService();

	NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGPURGESERVICE
	NS_DECL_NSIMSGSEARCHNOTIFY

	nsresult PerformPurge();

protected:
  int32_t FindServer(nsIMsgIncomingServer *server);
  nsresult SetupNextPurge();
  nsresult PurgeSurver(nsIMsgIncomingServer *server);
  nsresult SearchFolderToPurge(nsIMsgFolder *folder, int32_t purgeInterval);

protected:
  nsCOMPtr<nsITimer> mPurgeTimer;
  nsCOMPtr<nsIMsgSearchSession> mSearchSession;
  nsCOMPtr<nsIMsgFolder> mSearchFolder;
  nsCOMPtr<nsIMutableArray> mHdrsToDelete;
  bool mHaveShutdown;

private:
  int32_t mMinDelayBetweenPurges;  // in minutes, how long must pass between two consecutive purges on the same junk folder?
  int32_t mPurgeTimerInterval;  // in minutes, how often to check if we need to purge one of the junk folders?
};



#endif

