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

  void      ChangeUnreadChildCount(PRInt32 delta);
  void      ChangeChildCount(PRInt32 delta);

  nsresult  AddHdr(nsIMsgDBHdr *newHdr, bool reparentChildren, 
                   PRUint32 &whereInserted, nsIMsgDBHdr **outParent);
  PRInt32   HdrIndex(nsIMsgDBHdr *hdr);
  PRUint32  ChildLevelAt(PRUint32 msgIndex) {return m_levels[msgIndex];}
  PRUint32  MsgCount() {return m_numChildren;};

protected:
  nsMsgSearchDBView *m_view;
  PRUint32        m_numUnreadChildren;
  PRUint32        m_numChildren;
  PRUint32        m_flags;
  PRUint32        m_newestMsgDate;
  nsMsgKey        m_threadId;
  nsTArray<nsMsgKey> m_keys;
  nsCOMArray<nsIMsgFolder> m_folders;
  nsTArray<PRUint8> m_levels;
};

#endif
