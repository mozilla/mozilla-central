/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsMsgXFViewThread_h__
#define nsMsgXFViewThread_h__

#include "msgCore.h"
#include "nsCOMArray.h"
#include "nsIMsgThread.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsMsgDBView.h"

class nsMsgSearchDBView;

class nsMsgXFViewThread : public nsIMsgThread
{
public:

  nsMsgXFViewThread(nsMsgSearchDBView *view, nsMsgKey threadId);
  virtual ~nsMsgXFViewThread();

  NS_DECL_NSIMSGTHREAD
  NS_DECL_ISUPPORTS

  bool      IsHdrParentOf(nsIMsgDBHdr *possibleParent,
                          nsIMsgDBHdr *possibleChild);

  void      ChangeUnreadChildCount(int32_t delta);
  void      ChangeChildCount(int32_t delta);

  nsresult  AddHdr(nsIMsgDBHdr *newHdr, bool reparentChildren, 
                   uint32_t &whereInserted, nsIMsgDBHdr **outParent);
  int32_t   HdrIndex(nsIMsgDBHdr *hdr);
  uint32_t  ChildLevelAt(uint32_t msgIndex) {return m_levels[msgIndex];}
  uint32_t  MsgCount() {return m_numChildren;};

protected:
  nsMsgSearchDBView *m_view;
  uint32_t        m_numUnreadChildren;
  uint32_t        m_numChildren;
  uint32_t        m_flags;
  uint32_t        m_newestMsgDate;
  nsMsgKey        m_threadId;
  nsTArray<nsMsgKey> m_keys;
  nsCOMArray<nsIMsgFolder> m_folders;
  nsTArray<uint8_t> m_levels;
};

#endif
