/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsMsgSpecialViews.h"
#include "nsIMsgThread.h"
#include "nsMsgMessageFlags.h"

nsMsgThreadsWithUnreadDBView::nsMsgThreadsWithUnreadDBView()
: m_totalUnwantedMessagesInView(0)
{
  
}

nsMsgThreadsWithUnreadDBView::~nsMsgThreadsWithUnreadDBView()
{
}

NS_IMETHODIMP nsMsgThreadsWithUnreadDBView::GetViewType(nsMsgViewTypeValue *aViewType)
{
    NS_ENSURE_ARG_POINTER(aViewType);
    *aViewType = nsMsgViewType::eShowThreadsWithUnread;
    return NS_OK;
}

bool nsMsgThreadsWithUnreadDBView::WantsThisThread(nsIMsgThread *threadHdr)
{
  if (threadHdr)
  {
    uint32_t numNewChildren;

    threadHdr->GetNumUnreadChildren(&numNewChildren);
    if (numNewChildren > 0)
      return true;
    uint32_t numChildren;
    threadHdr->GetNumChildren(&numChildren);
    m_totalUnwantedMessagesInView += numChildren;
  }
  return false;
}

nsresult nsMsgThreadsWithUnreadDBView::AddMsgToThreadNotInView(nsIMsgThread *threadHdr, nsIMsgDBHdr *msgHdr, bool ensureListed)
{
  nsresult rv = NS_OK;

  nsCOMPtr <nsIMsgDBHdr> parentHdr;
  uint32_t msgFlags;
  msgHdr->GetFlags(&msgFlags);
  GetFirstMessageHdrToDisplayInThread(threadHdr, getter_AddRefs(parentHdr));
  if (parentHdr && (ensureListed || !(msgFlags & nsMsgMessageFlags::Read)))
  {
    nsMsgKey key;
    uint32_t numMsgsInThread;
    rv = AddHdr(parentHdr);
    threadHdr->GetNumChildren(&numMsgsInThread);
    if (numMsgsInThread > 1)
    {
      parentHdr->GetMessageKey(&key);
      nsMsgViewIndex viewIndex = FindViewIndex(key);
      if (viewIndex != nsMsgViewIndex_None)
        OrExtraFlag(viewIndex, nsMsgMessageFlags::Elided | MSG_VIEW_FLAG_HASCHILDREN);
    }
    m_totalUnwantedMessagesInView -= numMsgsInThread;
  }
  else
    m_totalUnwantedMessagesInView++;
  return rv;
}

NS_IMETHODIMP
nsMsgThreadsWithUnreadDBView::CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater, nsIMsgDBView **_retval)
{
  nsMsgThreadsWithUnreadDBView* newMsgDBView = new nsMsgThreadsWithUnreadDBView();

  if (!newMsgDBView)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = CopyDBView(newMsgDBView, aMessengerInstance, aMsgWindow, aCmdUpdater);
  NS_ENSURE_SUCCESS(rv,rv);

  NS_IF_ADDREF(*_retval = newMsgDBView);
  return NS_OK;
}

NS_IMETHODIMP nsMsgThreadsWithUnreadDBView::GetNumMsgsInView(int32_t *aNumMsgs)
{
  nsresult rv = nsMsgDBView::GetNumMsgsInView(aNumMsgs);
  NS_ENSURE_SUCCESS(rv, rv);
  *aNumMsgs = *aNumMsgs - m_totalUnwantedMessagesInView;
  return rv;
}

nsMsgWatchedThreadsWithUnreadDBView::nsMsgWatchedThreadsWithUnreadDBView()
: m_totalUnwantedMessagesInView(0)
{
}

NS_IMETHODIMP nsMsgWatchedThreadsWithUnreadDBView::GetViewType(nsMsgViewTypeValue *aViewType)
{
    NS_ENSURE_ARG_POINTER(aViewType);
    *aViewType = nsMsgViewType::eShowWatchedThreadsWithUnread;
    return NS_OK;
}

bool nsMsgWatchedThreadsWithUnreadDBView::WantsThisThread(nsIMsgThread *threadHdr)
{
  if (threadHdr)
  {
    uint32_t numNewChildren;
    uint32_t threadFlags;

    threadHdr->GetNumUnreadChildren(&numNewChildren);
    threadHdr->GetFlags(&threadFlags);
    if (numNewChildren > 0 && (threadFlags & nsMsgMessageFlags::Watched) != 0)
      return true;
    uint32_t numChildren;
    threadHdr->GetNumChildren(&numChildren);
    m_totalUnwantedMessagesInView += numChildren;
  }
  return false;
}

nsresult nsMsgWatchedThreadsWithUnreadDBView::AddMsgToThreadNotInView(nsIMsgThread *threadHdr, nsIMsgDBHdr *msgHdr, bool ensureListed)
{
  nsresult rv = NS_OK;
  uint32_t threadFlags;
  uint32_t msgFlags;
  msgHdr->GetFlags(&msgFlags);
  threadHdr->GetFlags(&threadFlags);
  if (threadFlags & nsMsgMessageFlags::Watched)
  {
    nsCOMPtr <nsIMsgDBHdr> parentHdr;
    GetFirstMessageHdrToDisplayInThread(threadHdr, getter_AddRefs(parentHdr));
    if (parentHdr && (ensureListed || !(msgFlags & nsMsgMessageFlags::Read)))
    {
      uint32_t numChildren;
      threadHdr->GetNumChildren(&numChildren);
      rv = AddHdr(parentHdr);
      if (numChildren > 1)
      {
        nsMsgKey key;
        parentHdr->GetMessageKey(&key);
        nsMsgViewIndex viewIndex = FindViewIndex(key);
        if (viewIndex != nsMsgViewIndex_None)
          OrExtraFlag(viewIndex, nsMsgMessageFlags::Elided | MSG_VIEW_FLAG_ISTHREAD | MSG_VIEW_FLAG_HASCHILDREN | nsMsgMessageFlags::Watched);
      }
      m_totalUnwantedMessagesInView -= numChildren;
      return rv;
    }
  }
  m_totalUnwantedMessagesInView++;
  return rv;
}

NS_IMETHODIMP
nsMsgWatchedThreadsWithUnreadDBView::CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater, nsIMsgDBView **_retval)
{
  nsMsgWatchedThreadsWithUnreadDBView* newMsgDBView = new nsMsgWatchedThreadsWithUnreadDBView();

  if (!newMsgDBView)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = CopyDBView(newMsgDBView, aMessengerInstance, aMsgWindow, aCmdUpdater);
  NS_ENSURE_SUCCESS(rv,rv);

  NS_IF_ADDREF(*_retval = newMsgDBView);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgWatchedThreadsWithUnreadDBView::GetNumMsgsInView(int32_t *aNumMsgs)
{
  nsresult rv = nsMsgDBView::GetNumMsgsInView(aNumMsgs);
  NS_ENSURE_SUCCESS(rv, rv);
  *aNumMsgs = *aNumMsgs - m_totalUnwantedMessagesInView;
  return rv;
}
