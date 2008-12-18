/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joshua Cranmer <Pidgeot18@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
  NS_DECL_ISUPPORTS
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
  PRInt32 m_contentLength;
};

#endif  // nsNntpMockChannel_h___
