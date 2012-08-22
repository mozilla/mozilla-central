/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsImapMoveCoalescer_H
#define _nsImapMoveCoalescer_H

#include "msgCore.h"
#include "nsCOMArray.h"
#include "nsIMsgWindow.h"
#include "nsCOMPtr.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsIUrlListener.h"
#include "nsIMsgCopyServiceListener.h"

// imap move coalescer class - in order to keep nsImapMailFolder from growing like Topsy
// Logically, we want to keep track of an nsTArray<nsMsgKey> per nsIMsgFolder, and then
// be able to retrieve them one by one and play back the moves.
// This utility class will be used by both the filter code and the offline playback code,
// to avoid multiple moves to the same folder.

class NS_MSG_BASE nsImapMoveCoalescer : public nsIUrlListener
{
public:
  friend class nsMoveCoalescerCopyListener;

  NS_DECL_ISUPPORTS
  NS_DECL_NSIURLLISTENER

  nsImapMoveCoalescer(nsIMsgFolder *sourceFolder, nsIMsgWindow *msgWindow);
  virtual ~nsImapMoveCoalescer();

  nsresult AddMove(nsIMsgFolder *folder, nsMsgKey key);
  nsresult PlaybackMoves(bool doNewMailNotification = false);
  // this lets the caller store keys in an arbitrary number of buckets. If the bucket
  // for the passed in index doesn't exist, it will get created.
  nsTArray<nsMsgKey> *GetKeyBucket(uint32_t keyArrayIndex);
  nsIMsgWindow *GetMsgWindow() {return m_msgWindow;}
  bool HasPendingMoves() {return m_hasPendingMoves;}
protected:
  // m_sourceKeyArrays and m_destFolders are parallel arrays.
  nsTArray<nsTArray<nsMsgKey> > m_sourceKeyArrays;
  nsCOMArray<nsIMsgFolder> m_destFolders;
  nsCOMPtr <nsIMsgWindow> m_msgWindow;
  nsCOMPtr <nsIMsgFolder> m_sourceFolder;
  bool m_doNewMailNotification;
  bool m_hasPendingMoves;
  nsTArray<nsTArray<nsMsgKey> > m_keyBuckets;
  int32_t m_outstandingMoves;
};

class nsMoveCoalescerCopyListener : public nsIMsgCopyServiceListener
{
public:
    nsMoveCoalescerCopyListener(nsImapMoveCoalescer * coalescer, nsIMsgFolder *destFolder);
    ~nsMoveCoalescerCopyListener();
    NS_DECL_ISUPPORTS
    NS_DECL_NSIMSGCOPYSERVICELISTENER

    nsCOMPtr <nsIMsgFolder> m_destFolder;

      nsImapMoveCoalescer *m_coalescer;
    // when we get OnStopCopy, update the folder. When we've finished all the copies,
    // send the biff notification.
};


#endif // _nsImapMoveCoalescer_H

