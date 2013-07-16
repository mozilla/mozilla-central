/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgSpecialViews_H_
#define _nsMsgSpecialViews_H_

#include "mozilla/Attributes.h"
#include "nsMsgThreadedDBView.h"

class nsMsgThreadsWithUnreadDBView : public nsMsgThreadedDBView
{
public:
  nsMsgThreadsWithUnreadDBView();
  virtual ~nsMsgThreadsWithUnreadDBView();
  virtual const char * GetViewName(void) MOZ_OVERRIDE {return "ThreadsWithUnreadView"; }
  NS_IMETHOD CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCommandUpdater, nsIMsgDBView **_retval) MOZ_OVERRIDE;
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType) MOZ_OVERRIDE;
  NS_IMETHOD GetNumMsgsInView(int32_t *aNumMsgs);

virtual bool WantsThisThread(nsIMsgThread *threadHdr) MOZ_OVERRIDE;
protected:
  virtual nsresult AddMsgToThreadNotInView(nsIMsgThread *threadHdr, nsIMsgDBHdr *msgHdr, bool ensureListed) MOZ_OVERRIDE;
  uint32_t m_totalUnwantedMessagesInView;
};

class nsMsgWatchedThreadsWithUnreadDBView : public nsMsgThreadedDBView
{
public:
  nsMsgWatchedThreadsWithUnreadDBView ();
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType) MOZ_OVERRIDE;
  NS_IMETHOD CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCommandUpdater, nsIMsgDBView **_retval) MOZ_OVERRIDE;
  NS_IMETHOD GetNumMsgsInView(int32_t *aNumMsgs);
  virtual const char * GetViewName(void) MOZ_OVERRIDE {return "WatchedThreadsWithUnreadView"; }
  virtual bool WantsThisThread(nsIMsgThread *threadHdr) MOZ_OVERRIDE;
protected:
  virtual nsresult AddMsgToThreadNotInView(nsIMsgThread *threadHdr, nsIMsgDBHdr *msgHdr, bool ensureListed) MOZ_OVERRIDE;
  uint32_t m_totalUnwantedMessagesInView;

};
#ifdef DOING_CACHELESS_VIEW
// This view will initially be used for cacheless IMAP.
class nsMsgCachelessView : public nsMsgDBView
{
public:
						nsMsgCachelessView();
    NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType);
	virtual 			~nsMsgCachelessView();
	virtual const char * 		GetViewName(void) {return "nsMsgCachelessView"; }
	NS_IMETHOD Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue viewType, int32_t *count);
	nsresult				SetViewSize(int32_t setSize); // Override
	virtual nsresult		AddNewMessages() ;
	virtual nsresult		AddHdr(nsIMsgDBHdr *msgHdr);
	// for news, xover line, potentially, for IMAP, imap line...
	virtual nsresult		AddHdrFromServerLine(char *line, nsMsgKey *msgId) ;
	virtual void		SetInitialSortState(void);
	virtual	nsresult		Init(uint32_t *pCount);
protected:
	void				ClearPendingIds();

	nsIMsgFolder		*m_folder;
	nsMsgViewIndex		m_curStartSeq;
	nsMsgViewIndex		m_curEndSeq;
	bool				m_sizeInitialized;
};

#endif /* DOING_CACHELESS_VIEW */
#endif
