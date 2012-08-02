/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgComposeParams.h"

nsMsgComposeParams::nsMsgComposeParams() :
  mType(nsIMsgCompType::New),
  mFormat(nsIMsgCompFormat::Default),
  mBodyIsLink(false)
{
}

/* the following macro actually implement addref, release and query interface for our component. */
NS_IMPL_ISUPPORTS1(nsMsgComposeParams, nsIMsgComposeParams)

nsMsgComposeParams::~nsMsgComposeParams()
{
}

/* attribute MSG_ComposeType type; */
NS_IMETHODIMP nsMsgComposeParams::GetType(MSG_ComposeType *aType)
{
  NS_ENSURE_ARG_POINTER(aType);
  
  *aType = mType;
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeParams::SetType(MSG_ComposeType aType)
{
  mType = aType;
  return NS_OK;
}

/* attribute MSG_ComposeFormat format; */
NS_IMETHODIMP nsMsgComposeParams::GetFormat(MSG_ComposeFormat *aFormat)
{
  NS_ENSURE_ARG_POINTER(aFormat);
  
  *aFormat = mFormat;
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeParams::SetFormat(MSG_ComposeFormat aFormat)
{
  mFormat = aFormat;
  return NS_OK;
}

/* attribute string originalMsgURI; */
NS_IMETHODIMP nsMsgComposeParams::GetOriginalMsgURI(char * *aOriginalMsgURI)
{
  NS_ENSURE_ARG_POINTER(aOriginalMsgURI);
  
  *aOriginalMsgURI = ToNewCString(mOriginalMsgUri);
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeParams::SetOriginalMsgURI(const char * aOriginalMsgURI)
{
  mOriginalMsgUri = aOriginalMsgURI;
  return NS_OK;
}

/* attribute nsIMsgIdentity identity; */
NS_IMETHODIMP nsMsgComposeParams::GetIdentity(nsIMsgIdentity * *aIdentity)
{
  NS_ENSURE_ARG_POINTER(aIdentity);
  NS_IF_ADDREF(*aIdentity = mIdentity);
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeParams::SetIdentity(nsIMsgIdentity * aIdentity)
{
  mIdentity = aIdentity;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeParams::SetOrigMsgHdr(nsIMsgDBHdr *aMsgHdr)
{
  mOrigMsgHdr = aMsgHdr;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeParams::GetOrigMsgHdr(nsIMsgDBHdr * *aMsgHdr)
{
  NS_ENSURE_ARG_POINTER(aMsgHdr);
  NS_IF_ADDREF(*aMsgHdr = mOrigMsgHdr);
  return NS_OK;
}

/* attribute ACString htmlToQuote; */
NS_IMETHODIMP nsMsgComposeParams::GetHtmlToQuote(nsACString& aHtmlToQuote)
{
  aHtmlToQuote = mHtmlToQuote;
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeParams::SetHtmlToQuote(const nsACString& aHtmlToQuote)
{
  mHtmlToQuote = aHtmlToQuote;
  return NS_OK;
}

/* attribute nsIMsgCompFields composeFields; */
NS_IMETHODIMP nsMsgComposeParams::GetComposeFields(nsIMsgCompFields * *aComposeFields)
{
  NS_ENSURE_ARG_POINTER(aComposeFields);
  
  if (mComposeFields)
  {
     *aComposeFields = mComposeFields;
     NS_ADDREF(*aComposeFields);
  }
  else
    *aComposeFields = nullptr;
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeParams::SetComposeFields(nsIMsgCompFields * aComposeFields)
{
  mComposeFields = aComposeFields;
  return NS_OK;
}

/* attribute boolean bodyIsLink; */
NS_IMETHODIMP nsMsgComposeParams::GetBodyIsLink(bool *aBodyIsLink)
{
  NS_ENSURE_ARG_POINTER(aBodyIsLink);
  
  *aBodyIsLink = mBodyIsLink;
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeParams::SetBodyIsLink(bool aBodyIsLink)
{
  mBodyIsLink = aBodyIsLink;
  return NS_OK;
}

/* attribute nsIMsgSendLisneter sendListener; */
NS_IMETHODIMP nsMsgComposeParams::GetSendListener(nsIMsgSendListener * *aSendListener)
{
  NS_ENSURE_ARG_POINTER(aSendListener);
  
  if (mSendListener)
  {
     *aSendListener = mSendListener;
     NS_ADDREF(*aSendListener);
  }
  else
    *aSendListener = nullptr;
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeParams::SetSendListener(nsIMsgSendListener * aSendListener)
{
  mSendListener = aSendListener;
  return NS_OK;
}

/* attribute string smtpPassword; */
NS_IMETHODIMP nsMsgComposeParams::GetSmtpPassword(char * *aSmtpPassword)
{
  NS_ENSURE_ARG_POINTER(aSmtpPassword);
  
  *aSmtpPassword = ToNewCString(mSMTPPassword);
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeParams::SetSmtpPassword(const char * aSmtpPassword)
{
  mSMTPPassword = aSmtpPassword;
  return NS_OK;
}

