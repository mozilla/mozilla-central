/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgSendLater_H_
#define _nsMsgSendLater_H_

#include "nsCOMArray.h"
#include "nsIMsgFolder.h"
#include "nsIMsgSendListener.h"
#include "nsIMsgSendLaterListener.h"
#include "nsIMsgSendLater.h"
#include "nsIMsgStatusFeedback.h"
#include "nsTObserverArray.h"
#include "nsIObserver.h"
#include "nsITimer.h"
#include "nsIMsgShutdown.h"

////////////////////////////////////////////////////////////////////////////////////
// This is the listener class for the send operation. We have to create this class 
// to listen for message send completion and eventually notify the caller
////////////////////////////////////////////////////////////////////////////////////
class nsMsgSendLater;

class SendOperationListener : public nsIMsgSendListener,
                              public nsIMsgCopyServiceListener
{
public:
  SendOperationListener(nsMsgSendLater *aSendLater);
  virtual ~SendOperationListener();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGSENDLISTENER
  NS_DECL_NSIMSGCOPYSERVICELISTENER

private:
  nsMsgSendLater *mSendLater;
};

class nsMsgSendLater: public nsIMsgSendLater,
                      public nsIFolderListener,
                      public nsIObserver,
                      public nsIUrlListener,
                      public nsIMsgShutdownTask

{
public:
  nsMsgSendLater();
  virtual     ~nsMsgSendLater();
  nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGSENDLATER
  NS_DECL_NSIFOLDERLISTENER
  NS_DECL_NSISTREAMLISTENER
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSIOBSERVER
  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIMSGSHUTDOWNTASK

  // Methods needed for implementing interface...
  nsresult                  StartNextMailFileSend(nsresult prevStatus);
  nsresult                  CompleteMailFileSend();

  nsresult                  DeleteCurrentMessage();
  nsresult                  SetOrigMsgDisposition();
  // Necessary for creating a valid list of recipients
  nsresult                  BuildHeaders();
  nsresult                  DeliverQueuedLine(char *line, PRInt32 length);
  nsresult                  RebufferLeftovers(char *startBuf,  PRUint32 aLen);
  nsresult                  BuildNewBuffer(const char* aBuf, PRUint32 aCount, PRUint32 *totalBufSize);

  // methods for listener array processing...
  void NotifyListenersOnStartSending(PRUint32 aTotalMessageCount);
  void NotifyListenersOnMessageStartSending(PRUint32 aCurrentMessage,
                                            PRUint32 aTotalMessage,
                                            nsIMsgIdentity *aIdentity);
  void NotifyListenersOnProgress(PRUint32 aCurrentMessage,
                                 PRUint32 aTotalMessage,
                                 PRUint32 aSendPercent,
                                 PRUint32 aCopyPercent);
  void NotifyListenersOnMessageSendError(PRUint32 aCurrentMessage,
                                         nsresult aStatus,
                                         const PRUnichar *aMsg);
  void EndSendMessages(nsresult aStatus, const PRUnichar *aMsg, 
                       PRUint32 aTotalTried, PRUint32 aSuccessful);

  bool OnSendStepFinished(nsresult aStatus);
  void OnCopyStepFinished(nsresult aStatus);

  // counters and things for enumeration 
  PRUint32                  mTotalSentSuccessfully;
  PRUint32                  mTotalSendCount;
  nsCOMArray<nsIMsgDBHdr> mMessagesToSend;
  nsCOMPtr<nsISimpleEnumerator> mEnumerator;
  nsCOMPtr<nsIMsgFolder>    mMessageFolder;
  nsCOMPtr<nsIMsgStatusFeedback> mFeedback;
 
  // Private Information
private:
  nsresult GetIdentityFromKey(const char *aKey, nsIMsgIdentity **aIdentity);
  nsresult ReparseDBIfNeeded(nsIUrlListener *aListener);
  nsresult InternalSendMessages(bool aUserInitiated,
                                nsIMsgIdentity *aIdentity);

  nsTObserverArray<nsCOMPtr<nsIMsgSendLaterListener> > mListenerArray;
  nsCOMPtr<nsIMsgDBHdr> mMessage;
  nsCOMPtr<nsITimer> mTimer;
  bool mTimerSet;
  nsCOMPtr<nsIUrlListener> mShutdownListener;

  //
  // File output stuff...
  //
  nsCOMPtr<nsIFile>         mTempFile;
  nsCOMPtr<nsIOutputStream> mOutFile;

  void                      *mTagData;

  // For building headers and stream parsing...
  char                      *m_to;
  char                      *m_bcc;
  char                      *m_fcc;
  char                      *m_newsgroups;
  char                      *m_newshost;
  char                      *m_headers;
  PRInt32                   m_flags;
  PRInt32                   m_headersFP;
  bool                      m_inhead;
  PRInt32                   m_headersPosition;
  PRInt32                   m_bytesRead;
  PRInt32                   m_position;
  PRInt32                   m_flagsPosition;
  PRInt32                   m_headersSize;
  char                      *mLeftoverBuffer;
  char                      *mIdentityKey;
  char                      *mAccountKey;

  bool mSendingMessages;
  bool mUserInitiated;
  nsCOMPtr<nsIMsgIdentity> mIdentity;
};


#endif /* _nsMsgSendLater_H_ */
