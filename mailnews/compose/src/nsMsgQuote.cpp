/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIURL.h"
#include "nsIInputStream.h"
#include "nsIOutputStream.h"
#include "nsIServiceManager.h"
#include "nsIStreamListener.h"
#include "nsIStreamConverter.h"
#include "nsIStreamConverterService.h"
#include "nsIMimeStreamConverter.h"
#include "nsMimeTypes.h"
#include "nsICharsetConverterManager.h"
#include "prprf.h"
#include "nsMsgQuote.h" 
#include "nsMsgCompUtils.h"
#include "nsIMsgMessageService.h"
#include "nsMsgUtils.h"
#include "nsNetUtil.h"
#include "nsMsgMimeCID.h"
#include "nsMsgCompCID.h"
#include "nsMsgCompose.h"
#include "nsMsgMailNewsUrl.h"
#include "mozilla/Services.h"

NS_IMPL_ISUPPORTS2(nsMsgQuoteListener, nsIMsgQuoteListener,
  nsIMimeStreamConverterListener)

nsMsgQuoteListener::nsMsgQuoteListener()
{
}

nsMsgQuoteListener::~nsMsgQuoteListener()
{
}

NS_IMETHODIMP nsMsgQuoteListener::SetMsgQuote(nsIMsgQuote * msgQuote)
{
	mMsgQuote = do_GetWeakReference(msgQuote);
  return NS_OK;
}

NS_IMETHODIMP nsMsgQuoteListener::GetMsgQuote(nsIMsgQuote ** aMsgQuote)
{
  nsresult rv = NS_OK;
  if (aMsgQuote)
  {
    nsCOMPtr<nsIMsgQuote> msgQuote = do_QueryReferent(mMsgQuote);
    *aMsgQuote = msgQuote;
    NS_IF_ADDREF(*aMsgQuote);
  }
  else
    rv = NS_ERROR_NULL_POINTER;

  return rv;
}

nsresult nsMsgQuoteListener::OnHeadersReady(nsIMimeHeaders * headers)
{
  nsCOMPtr<nsIMsgQuotingOutputStreamListener> quotingOutputStreamListener;
  nsCOMPtr<nsIMsgQuote> msgQuote = do_QueryReferent(mMsgQuote);

  if (msgQuote)
    msgQuote->GetStreamListener(getter_AddRefs(quotingOutputStreamListener));

  if (quotingOutputStreamListener)
    quotingOutputStreamListener->SetMimeHeaders(headers);
  return NS_OK;
}

//
// Implementation...
//
nsMsgQuote::nsMsgQuote()
{
  mQuoteHeaders = false;
  mQuoteListener = nullptr;
}

nsMsgQuote::~nsMsgQuote()
{
}

NS_IMPL_ISUPPORTS2(nsMsgQuote, nsIMsgQuote, nsISupportsWeakReference)

NS_IMETHODIMP nsMsgQuote::GetStreamListener(nsIMsgQuotingOutputStreamListener ** aStreamListener)
{
  nsresult rv = NS_OK;
  if (aStreamListener)
  {
    *aStreamListener = mStreamListener;
    NS_IF_ADDREF(*aStreamListener);
  }
  else
    rv = NS_ERROR_NULL_POINTER;

  return rv;
}

nsresult
nsMsgQuote::QuoteMessage(const char *msgURI, bool quoteHeaders,
                         nsIMsgQuotingOutputStreamListener * aQuoteMsgStreamListener,
                         const char * aMsgCharSet, bool headersOnly,
                         nsIMsgDBHdr *aMsgHdr)
{
  nsresult  rv;
  if (!msgURI)
    return NS_ERROR_INVALID_ARG;

  mQuoteHeaders = quoteHeaders;
  mStreamListener = aQuoteMsgStreamListener;

  nsAutoCString msgUri(msgURI);
  bool fileUrl = !strncmp(msgURI, "file:", 5);
  bool forwardedMessage = PL_strstr(msgURI, "&realtype=message/rfc822") != nullptr;
  nsCOMPtr<nsIURI> aURL;
  if (fileUrl)
  {
    msgUri.Replace(0, 5, NS_LITERAL_CSTRING("mailbox:"));
    msgUri.AppendLiteral("?number=0");
    rv = NS_NewURI(getter_AddRefs(aURL), msgUri);
    nsCOMPtr<nsIMsgMessageUrl> mailUrl(do_QueryInterface(aURL));
    if (mailUrl)
      mailUrl->SetMessageHeader(aMsgHdr);
  }
  else if (forwardedMessage)
    rv = NS_NewURI(getter_AddRefs(aURL), msgURI);
  else
  {
    nsCOMPtr <nsIMsgMessageService> msgService;
    rv = GetMessageServiceFromURI(nsDependentCString(msgURI), getter_AddRefs(msgService));
    if (NS_FAILED(rv)) return rv;
    rv = msgService->GetUrlForUri(msgURI, getter_AddRefs(aURL), nullptr);
  }
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr <nsIURL> mailNewsUrl = do_QueryInterface(aURL, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsAutoCString queryPart;
  rv = mailNewsUrl->GetQuery(queryPart);
  if (!queryPart.IsEmpty())
    queryPart.Append('&');

  if (headersOnly) /* We don't need to quote the message body but we still need to extract the headers */
    queryPart.Append("header=only");
  else if (quoteHeaders)
    queryPart.Append("header=quote");
  else
    queryPart.Append("header=quotebody");
  rv = mailNewsUrl->SetQuery(queryPart);
  NS_ENSURE_SUCCESS(rv,rv);

  // if we were given a non empty charset, then use it
  if (aMsgCharSet && *aMsgCharSet)
  {
    nsCOMPtr<nsIMsgI18NUrl> i18nUrl (do_QueryInterface(aURL));
    if (i18nUrl)
      i18nUrl->SetCharsetOverRide(aMsgCharSet);
  }

  mQuoteListener = do_CreateInstance(NS_MSGQUOTELISTENER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;
  mQuoteListener->SetMsgQuote(this);

  // funky magic go get the isupports for this class which inherits from multiple interfaces.
  nsISupports * supports;
  QueryInterface(NS_GET_IID(nsISupports), (void **) &supports);
  nsCOMPtr<nsISupports> quoteSupport = supports;
  NS_IF_RELEASE(supports);

  // now we want to create a necko channel for this url and we want to open it
  mQuoteChannel = nullptr;
  nsCOMPtr<nsIIOService> netService =
    mozilla::services::GetIOService();
  NS_ENSURE_TRUE(netService, NS_ERROR_UNEXPECTED);
  rv = netService->NewChannelFromURI(aURL, getter_AddRefs(mQuoteChannel));
  if (NS_FAILED(rv)) return rv;
  nsCOMPtr<nsISupports> ctxt = do_QueryInterface(aURL);

  nsCOMPtr<nsIStreamConverterService> streamConverterService = 
           do_GetService("@mozilla.org/streamConverters;1", &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIStreamListener> convertedListener;
  rv = streamConverterService->AsyncConvertData("message/rfc822",
                                                "application/vnd.mozilla.xul+xml",
                                                mStreamListener,
                                                quoteSupport,
                                                getter_AddRefs(convertedListener));
  if (NS_FAILED(rv)) return rv;

  //  now try to open the channel passing in our display consumer as the listener 
  rv = mQuoteChannel->AsyncOpen(convertedListener, ctxt);
  return rv;
}

NS_IMETHODIMP
nsMsgQuote::GetQuoteListener(nsIMimeStreamConverterListener** aQuoteListener)
{
    if (!aQuoteListener || !mQuoteListener)
        return NS_ERROR_NULL_POINTER;
    *aQuoteListener = mQuoteListener;
    NS_ADDREF(*aQuoteListener);
    return NS_OK;
}

NS_IMETHODIMP
nsMsgQuote::GetQuoteChannel(nsIChannel** aQuoteChannel)
{
    if (!aQuoteChannel || !mQuoteChannel)
        return NS_ERROR_NULL_POINTER;
    *aQuoteChannel = mQuoteChannel;
    NS_ADDREF(*aQuoteChannel);
    return NS_OK;
}
