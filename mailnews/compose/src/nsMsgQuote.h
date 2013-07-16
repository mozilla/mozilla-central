/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef __nsMsgQuote_h__
#define __nsMsgQuote_h__

#include "nsIMsgQuote.h" 
#include "nsIMsgMessageService.h"
#include "nsIStreamListener.h"
#include "nsIMimeStreamConverter.h"
#include "nsIChannel.h"
#include "nsCOMPtr.h"
#include "nsWeakReference.h"

class nsMsgQuote;

class nsMsgQuoteListener: public nsIMsgQuoteListener
{
public:
	nsMsgQuoteListener();
	virtual     ~nsMsgQuoteListener();

	NS_DECL_THREADSAFE_ISUPPORTS

	// nsIMimeStreamConverterListener support
	NS_DECL_NSIMIMESTREAMCONVERTERLISTENER
  NS_DECL_NSIMSGQUOTELISTENER

private:
  nsWeakPtr mMsgQuote;
};

class nsMsgQuote: public nsIMsgQuote, public nsSupportsWeakReference {
public: 
  nsMsgQuote();
  virtual ~nsMsgQuote();

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIMSGQUOTE

  // 
  // Implementation data...
  //
  nsCOMPtr<nsIMsgQuotingOutputStreamListener> mStreamListener;
  bool			mQuoteHeaders;
  nsCOMPtr<nsIMsgQuoteListener> mQuoteListener;
  nsCOMPtr<nsIChannel> mQuoteChannel;
};

#endif /* __nsMsgQuote_h__ */
