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

#include "nsNntpMockChannel.h"

#include "msgCore.h"
#include "nsNNTPProtocol.h"
#include "nsNetUtil.h"

NS_IMPL_THREADSAFE_ISUPPORTS2(nsNntpMockChannel, nsIChannel, nsIRequest)

nsNntpMockChannel::nsNntpMockChannel(nsIURI *aUri, nsIMsgWindow *aMsgWindow)
: m_url(aUri),
  m_msgWindow(aMsgWindow),
  m_channelState(CHANNEL_UNOPENED),
  m_protocol(nsnull),
  m_cancelStatus(NS_OK),
  m_loadFlags(0),
  m_contentLength(-1)
{
}

nsNntpMockChannel::nsNntpMockChannel(nsIURI *aUri, nsIMsgWindow *aMsgWindow,
                                     nsISupports *aConsumer)
: m_url(aUri),
  m_context(aConsumer),
  m_msgWindow(aMsgWindow),
  m_channelState(CHANNEL_OPEN_WITH_LOAD),
  m_protocol(nsnull),
  m_cancelStatus(NS_OK),
  m_loadFlags(0),
  m_contentLength(-1)
{
}

nsNntpMockChannel::~nsNntpMockChannel()
{
}

#define FORWARD_CALL(function, argument) \
  if (m_protocol) \
    return m_protocol->function(argument);

////////////////////////
// nsIRequest methods //
////////////////////////

NS_IMETHODIMP nsNntpMockChannel::GetName(nsACString &result)
{
  FORWARD_CALL(GetName, result)
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsNntpMockChannel::IsPending(PRBool *result)
{
  FORWARD_CALL(IsPending, result)
  // We haven't been loaded yet, so we're still pending.
  *result = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::GetStatus(nsresult *status)
{
  FORWARD_CALL(GetStatus, status)
  *status = m_cancelStatus;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::Cancel(nsresult status)
{
  m_cancelStatus = status;
  m_channelState = CHANNEL_CLOSED;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::Suspend()
{
  NS_NOTREACHED("nsNntpMockChannel::Suspend");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsNntpMockChannel::Resume()
{
  NS_NOTREACHED("nsNntpMockChannel::Resume");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsNntpMockChannel::SetLoadGroup(nsILoadGroup *aLoadGroup)
{
  FORWARD_CALL(SetLoadGroup, aLoadGroup)
  m_loadGroup = aLoadGroup;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::GetLoadGroup(nsILoadGroup **aLoadGroup)
{
  FORWARD_CALL(GetLoadGroup, aLoadGroup)
  NS_IF_ADDREF(*aLoadGroup = m_loadGroup);
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::GetLoadFlags(nsLoadFlags *aLoadFlags)
{
  FORWARD_CALL(GetLoadFlags, aLoadFlags)
  *aLoadFlags = m_loadFlags;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::SetLoadFlags(nsLoadFlags aLoadFlags)
{
  FORWARD_CALL(SetLoadFlags, aLoadFlags)
  m_loadFlags = aLoadFlags;
  return NS_OK;
}

////////////////////////
// nsIChannel methods //
////////////////////////

NS_IMETHODIMP nsNntpMockChannel::GetOriginalURI(nsIURI **aURI)
{
  FORWARD_CALL(GetOriginalURI, aURI)
  NS_IF_ADDREF(*aURI = m_originalUrl);
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::SetOriginalURI(nsIURI *aURI)
{
  FORWARD_CALL(SetOriginalURI, aURI)
  m_originalUrl = aURI;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::GetURI(nsIURI **aURI)
{
  NS_IF_ADDREF(*aURI = m_url);
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::GetOwner(nsISupports **owner)
{
  FORWARD_CALL(GetOwner, owner)
  NS_IF_ADDREF(*owner = m_owner);
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::SetOwner(nsISupports *aOwner)
{
  FORWARD_CALL(SetOwner, aOwner)
  m_owner = aOwner;
  return NS_OK;
}

NS_IMETHODIMP
nsNntpMockChannel::GetNotificationCallbacks(nsIInterfaceRequestor **callbacks)
{
  FORWARD_CALL(GetNotificationCallbacks, callbacks)
  NS_IF_ADDREF(*callbacks = m_notificationCallbacks);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpMockChannel::SetNotificationCallbacks(nsIInterfaceRequestor *aCallbacks)
{
  FORWARD_CALL(SetNotificationCallbacks, aCallbacks)
  m_notificationCallbacks = aCallbacks;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::GetSecurityInfo(nsISupports **securityInfo)
{
  FORWARD_CALL(GetSecurityInfo, securityInfo)
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsNntpMockChannel::GetContentType(nsACString &aContentType)
{
  FORWARD_CALL(GetContentType, aContentType)
  aContentType = m_contentType;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::SetContentType(const nsACString &aContentType)
{
  FORWARD_CALL(SetContentType, aContentType)
  return NS_ParseContentType(aContentType, m_contentType, m_contentCharset);
}

NS_IMETHODIMP nsNntpMockChannel::GetContentCharset(nsACString &aCharset)
{
  FORWARD_CALL(GetContentCharset, aCharset)
  aCharset = m_contentCharset;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::SetContentCharset(const nsACString &aCharset)
{
  FORWARD_CALL(SetContentCharset, aCharset)
  m_contentCharset = aCharset;
  return NS_OK;
}

NS_IMETHODIMP nsNntpMockChannel::GetContentLength(PRInt32 *length)
{
  FORWARD_CALL(GetContentLength, length)
  *length = m_contentLength;
  return NS_OK;
}

NS_IMETHODIMP
nsNntpMockChannel::SetContentLength(PRInt32 aLength)
{
  FORWARD_CALL(SetContentLength, aLength)
  m_contentLength = aLength;
  return NS_OK;
}

////////////////////////////////////////
// nsIChannel and nsNNTPProtocol glue //
////////////////////////////////////////

NS_IMETHODIMP nsNntpMockChannel::Open(nsIInputStream **_retval)
{
  return NS_ImplementChannelOpen(this, _retval);
}

NS_IMETHODIMP nsNntpMockChannel::AsyncOpen(nsIStreamListener *listener,
                                           nsISupports *ctxt)
{
  m_channelState = CHANNEL_OPEN_WITH_ASYNC;
  m_channelListener = listener;
  m_context = ctxt;
  return NS_OK;
}

nsresult
nsNntpMockChannel::AttachNNTPConnection(nsNNTPProtocol &protocol)
{
  // First things first. Were we canceled? If so, tell the protocol.
  if (m_channelState == CHANNEL_CLOSED || m_channelState == CHANNEL_UNOPENED)
    return NS_ERROR_FAILURE;


  // We're going to active the protocol now. Note that if the user has
  // interacted with us through the nsIChannel API, we need to pass it to the
  // protocol instance. We also need to initialize it. For best results, we're
  // going to initialize the code and then set the values.
  nsresult rv = protocol.Initialize(m_url, m_msgWindow);
  NS_ENSURE_SUCCESS(rv, rv);

  // Variable fun
  protocol.SetLoadGroup(m_loadGroup);
  protocol.SetLoadFlags(m_loadFlags);
  protocol.SetOriginalURI(m_originalUrl);
  protocol.SetOwner(m_owner);
  protocol.SetNotificationCallbacks(m_notificationCallbacks);
  protocol.SetContentType(m_contentType);

  // Now that we've set up the protocol, attach it to ourselves so that we can
  // forward all future calls to the protocol instance. We do not refcount this
  // instance, since the server will be owning all of them: once the server
  // releases its reference, the protocol instance is no longer usable anyways.
  m_protocol = &protocol;

  switch (m_channelState)
  {
  case CHANNEL_OPEN_WITH_LOAD:
    rv = protocol.LoadNewsUrl(m_url, m_context);
    break;
  case CHANNEL_OPEN_WITH_ASYNC:
    rv = protocol.AsyncOpen(m_channelListener, m_context);
    break;
  default:
    NS_NOTREACHED("Unknown channel state got us here.");
    return NS_ERROR_FAILURE;
  }

  // If we fail, that means that loading the NNTP protocol failed. Since we
  // essentially promised that we would load (by virtue of returning NS_OK to
  // AsyncOpen), we must now tell our listener the bad news.
  if (NS_FAILED(rv) && m_channelListener)
    m_channelListener->OnStopRequest(this, m_context, rv);

  // Returning a failure code is our way of telling the server that this URL
  // isn't going to run, so it should give the connection the next URL in the
  // queue.
  return rv;
}
