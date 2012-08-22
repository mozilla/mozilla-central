/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "prprf.h"
#include "prmem.h"
#include "nsCOMPtr.h"
#include "nsIStringBundle.h"
#include "nsIServiceManager.h"
#include "nsMsgMimeCID.h"
#include "nsIMimeConverter.h"
#include "nsServiceManagerUtils.h"

extern "C" MimeEncoderData *
MIME_B64EncoderInit(MimeConverterOutputCallback output_fn, void *closure)
{
  MimeEncoderData *returnEncoderData = nullptr;
  nsCOMPtr<nsIMimeConverter> converter = do_GetService(NS_MIME_CONVERTER_CONTRACTID);
  NS_ENSURE_TRUE(converter, nullptr);

  nsresult res = converter->B64EncoderInit(output_fn, closure, &returnEncoderData);
  return NS_SUCCEEDED(res) ? returnEncoderData : nullptr;
}

extern "C" MimeEncoderData *
MIME_QPEncoderInit(MimeConverterOutputCallback output_fn, void *closure)
{
  MimeEncoderData *returnEncoderData = nullptr;
  nsCOMPtr<nsIMimeConverter> converter = do_GetService(NS_MIME_CONVERTER_CONTRACTID);
  NS_ENSURE_TRUE(converter, nullptr);

  nsresult res = converter->QPEncoderInit(output_fn, closure, &returnEncoderData);
  return NS_SUCCEEDED(res) ? returnEncoderData : nullptr;
}

extern "C" nsresult
MIME_EncoderDestroy(MimeEncoderData *data, bool abort_p)
{
  nsresult rv;
  nsCOMPtr<nsIMimeConverter> converter = do_GetService(NS_MIME_CONVERTER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return converter->EncoderDestroy(data, abort_p);
}

extern "C" nsresult
MIME_EncoderWrite(MimeEncoderData *data, const char *buffer, int32_t size)
{
  nsresult rv;
  nsCOMPtr<nsIMimeConverter> converter = do_GetService(NS_MIME_CONVERTER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  int32_t written = 0;
  return converter->EncoderWrite(data, buffer, size, &written);
}
