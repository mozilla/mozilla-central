/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgComposeProgressParams.h"
#include "nsServiceManagerUtils.h"

NS_IMPL_ISUPPORTS1(nsMsgComposeProgressParams, nsIMsgComposeProgressParams)

nsMsgComposeProgressParams::nsMsgComposeProgressParams() :
  m_deliveryMode(nsIMsgCompDeliverMode::Now)
{
}

nsMsgComposeProgressParams::~nsMsgComposeProgressParams()
{
}

/* attribute wstring subject; */
NS_IMETHODIMP nsMsgComposeProgressParams::GetSubject(PRUnichar * *aSubject)
{
  NS_ENSURE_ARG(aSubject);
  
  *aSubject = ToNewUnicode(m_subject);
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeProgressParams::SetSubject(const PRUnichar * aSubject)
{
  m_subject = aSubject;
  return NS_OK;
}

/* attribute MSG_DeliverMode deliveryMode; */
NS_IMETHODIMP nsMsgComposeProgressParams::GetDeliveryMode(MSG_DeliverMode *aDeliveryMode)
{
  NS_ENSURE_ARG(aDeliveryMode);
  
  *aDeliveryMode = m_deliveryMode;
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeProgressParams::SetDeliveryMode(MSG_DeliverMode aDeliveryMode)
{
  m_deliveryMode = aDeliveryMode;
  return NS_OK;
}
