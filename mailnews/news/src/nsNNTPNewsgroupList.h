/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/*
 * formerly listngst.h
 * This class should ultimately be part of a news group listing
 * state machine - either by inheritance or delegation.
 * Currently, a folder pane owns one and libnet news group listing
 * related messages get passed to this object.
 */
#ifndef nsNNTPNewsgroupListState_h___
#define nsNNTPNewsgroupListState_h___

#include "nsINNTPNewsgroupList.h"
#include "nsIMsgNewsFolder.h"
#include "nsIMsgDatabase.h"
#include "nsMsgKeySet.h"
#include "nsINntpUrl.h"
#include "nsIMsgFilterList.h"
#include "nsIMsgHdr.h"
#include "nsIMsgWindow.h"
#include "nsCOMArray.h"
#include "nsTArray.h"

/* The below is all stuff that we remember for netlib about which
   articles we've already seen in the current newsgroup. */

typedef struct MSG_NewsKnown {
  nsMsgKeySet* set; /* Set of articles we've already gotten
                       from the newsserver (if it's marked
                       "read", then we've already gotten it).
                       If an article is marked "read", it
                       doesn't mean we're actually displaying
                       it; it may be an article that no longer
                       exists, or it may be one that we've
                       marked read and we're only viewing
                       unread messages. */

  int32_t first_possible; /* The oldest article in this group. */
  int32_t last_possible; /* The newest article in this group. */

  bool shouldGetOldest;
} MSG_NewsKnown;

// This class should ultimately be part of a news group listing
// state machine - either by inheritance or delegation.
// Currently, a folder pane owns one and libnet news group listing
// related messages get passed to this object.
class nsNNTPNewsgroupList : public nsINNTPNewsgroupList, public nsIMsgFilterHitNotify
#ifdef HAVE_CHANGELISTENER
/* ,public ChangeListener */
#endif
{
public:
  nsNNTPNewsgroupList();
  virtual  ~nsNNTPNewsgroupList();
  NS_DECL_ISUPPORTS
  NS_DECL_NSINNTPNEWSGROUPLIST
  NS_DECL_NSIMSGFILTERHITNOTIFY

private:
  NS_METHOD CleanUp();
     
  bool    m_finishingXover;

#ifdef HAVE_CHANGELISTENER
  virtual void OnAnnouncerGoingAway (ChangeAnnouncer *instigator);
#endif
  nsresult ParseLine(char *line, uint32_t *message_number);
  nsresult GetDatabase(const char *uri, nsIMsgDatabase **db);
  void SetProgressBarPercent(int32_t percent);
  void SetProgressStatus(const PRUnichar *message);

  void UpdateStatus(bool filtering, int32_t numDled, int32_t totToDL);

  nsresult AddHeader(const char * header, const char * value);
protected:
  bool m_getOldMessages;
  bool m_promptedAlready;
  bool m_downloadAll;
  int32_t m_maxArticles;
  int32_t m_lastPercent;
  PRTime m_lastStatusUpdate;

  nsCOMPtr <nsIMsgNewsFolder> m_newsFolder;
  nsCOMPtr <nsIMsgDatabase> m_newsDB;
  nsCOMPtr <nsINntpUrl> m_runningURL;
 
  /**
   * The last message that we have processed (XOVER or HEAD).
   */
  nsMsgKey m_lastProcessedNumber;
  /**
   * The endpoints of the message chunk we are actually downloading.
   */
  nsMsgKey m_firstMsgNumber, m_lastMsgNumber;
  /**
   * The endpoints of the message chunk we are capable of downloading.
   */
  int32_t m_firstMsgToDownload, m_lastMsgToDownload;
  
  struct MSG_NewsKnown m_knownArts;
  nsMsgKeySet *m_set;

  nsTArray<nsCString> m_filterHeaders;
  uint32_t m_currentXHDRIndex;
  nsCString m_lastHeader;
  nsCString m_thisLine;

private:
  nsCOMPtr <nsIMsgWindow> m_msgWindow;
  nsCOMPtr <nsIMsgFilterList> m_filterList;
  nsCOMPtr <nsIMsgFilterList> m_serverFilterList;
  nsCOMPtr <nsIMsgDBHdr> m_newMsgHdr; // current message header we're building
  nsCOMArray<nsIMsgDBHdr> m_newHeaders;

  bool m_addHdrToDB;

};
    
#endif /* nsNNTPNewsgroupListState_h___ */

