/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsNntpMockChannel_h___
#define nsNntpMockChannel_h___

#include "nsIChannel.h"
#include "nsIMsgWindow.h"

#include "nsCOMPtr.h"
#include "nsStringGlue.h"

class nsNNTPProtocol;

class nsNntpMockChannel : public nsIChannel
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSICHANNEL
  NS_DECL_NSIREQUEST

  nsNntpMockChannel(nsIURI *aUri, nsIMsgWindow *aMsgWindow);
  nsNntpMockChannel(nsIURI *aUri, nsIMsgWindow *aMsgWindow,
                    nsISupports *aConsumer);
  virtual ~nsNntpMockChannel();

  nsresult AttachNNTPConnection(nsNNTPProtocol &protocol);
protected:
  // The URL we will be running
  nsCOMPtr<nsIURI> m_url;

  // Variables for arguments to pass into the opening phase.
  nsCOMPtr<nsIStreamListener> m_channelListener;
  nsCOMPtr<nsISupports> m_context;
  nsCOMPtr<nsIMsgWindow> m_msgWindow;

  // The state we're in
  enum
  {
    CHANNEL_UNOPENED,        //!< No one bothered to open this yet
    CHANNEL_OPEN_WITH_LOAD,  //!< We should open with LoadNewsUrl
    CHANNEL_OPEN_WITH_ASYNC, //!< We should open with AsyncOpen
    CHANNEL_CLOSED           //!< We were closed and should not open
  } m_channelState;

  // The protocol instance
  nsNNTPProtocol *m_protocol;

  // Temporary variables for accessors before we get to the actual instance.
  nsresult m_cancelStatus;
  nsCOMPtr<nsILoadGroup> m_loadGroup;
  nsLoadFlags m_loadFlags;

  nsCOMPtr<nsIURI> m_originalUrl;
  nsCOMPtr<nsISupports> m_owner;
  nsCOMPtr<nsIInterfaceRequestor> m_notificationCallbacks;
  nsCString m_contentType;
  nsCString m_contentCharset;
  int64_t m_contentLength;
};

#endif  // nsNntpMockChannel_h___
