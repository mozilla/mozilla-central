/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgProgress_h_
#define nsMsgProgress_h_

#include "nsIMsgProgress.h"
#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "nsIDOMWindow.h"
#include "nsIMsgStatusFeedback.h"
#include "nsStringGlue.h"
#include "nsIMsgWindow.h"
#include "nsIProgressEventSink.h"
#include "nsIStringBundle.h"
#include "nsWeakReference.h"

class nsMsgProgress : public nsIMsgProgress, 
                      public nsIMsgStatusFeedback, 
                      public nsIProgressEventSink,
                      public nsSupportsWeakReference
{
public: 
  nsMsgProgress();
  virtual ~nsMsgProgress();
  
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIMSGPROGRESS
  NS_DECL_NSIWEBPROGRESSLISTENER
  NS_DECL_NSIMSGSTATUSFEEDBACK
  NS_DECL_NSIPROGRESSEVENTSINK

private:
  nsresult ReleaseListeners(void);
  
  bool                               m_closeProgress;
  bool                               m_processCanceled;
  nsString                           m_pendingStatus;
  int32_t                            m_pendingStateFlags;
  nsresult                           m_pendingStateValue;
  nsWeakPtr                          m_msgWindow;
  nsCOMArray<nsIWebProgressListener> m_listenerList;
};

#endif  // nsMsgProgress_h_
