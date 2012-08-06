/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include <stdio.h>
#include "mimecom.h"
#include "modmimee.h"
#include "nscore.h"
#include "nsMimeConverter.h"
#include "comi18n.h"
#include "nsMsgI18N.h"
#include "prmem.h"
#include "plstr.h"

NS_IMPL_THREADSAFE_ADDREF(nsMimeConverter)
NS_IMPL_THREADSAFE_RELEASE(nsMimeConverter)

NS_INTERFACE_MAP_BEGIN(nsMimeConverter)
   NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMimeConverter)
   NS_INTERFACE_MAP_ENTRY(nsIMimeConverter)
NS_INTERFACE_MAP_END

/*
 * nsMimeConverter definitions....
 */

/* 
 * Inherited methods for nsMimeConverter
 */
nsMimeConverter::nsMimeConverter()
{
}

nsMimeConverter::~nsMimeConverter()
{
}

nsresult
nsMimeConverter::DecodeMimeHeaderToCharPtr(const char *header,
                                           const char *default_charset,
                                           bool override_charset,
                                           bool eatContinuations,
                                           char **decodedString)
{
  NS_ENSURE_ARG_POINTER(decodedString);

  *decodedString = MIME_DecodeMimeHeader(header, default_charset,
                                         override_charset,
                                         eatContinuations);
  return NS_OK;
}

// Decode routine (also converts output to unicode)
nsresult
nsMimeConverter::DecodeMimeHeader(const char *header,
                                  const char *default_charset,
                                  bool override_charset,
                                  bool eatContinuations,
                                  nsAString& decodedString)
{
  NS_ENSURE_ARG_POINTER(header);

  // apply MIME decode.
  char *decodedCstr = MIME_DecodeMimeHeader(header, default_charset,
                                            override_charset, eatContinuations);
  if (!decodedCstr) {
    CopyUTF8toUTF16(nsDependentCString(header), decodedString);
  } else {
    CopyUTF8toUTF16(nsDependentCString(decodedCstr), decodedString);
    PR_FREEIF(decodedCstr);
  }

  return NS_OK;
}

nsresult
nsMimeConverter::EncodeMimePartIIStr(const char       *header,
                                           bool       structured,
                                           const char *mailCharset,
                                           PRInt32    fieldnamelen,
                                           PRInt32    encodedWordSize,
                                           char       **encodedString)
{
  NS_ENSURE_ARG_POINTER(encodedString);

  // Encoder needs utf-8 string.
  nsAutoString tempUnicodeString;
  nsresult rv = ConvertToUnicode(mailCharset, header, tempUnicodeString);
  NS_ENSURE_SUCCESS(rv, rv);
  return EncodeMimePartIIStr_UTF8(NS_ConvertUTF16toUTF8(tempUnicodeString),
                                  structured, mailCharset, fieldnamelen,
                                  encodedWordSize, encodedString);
}

nsresult
nsMimeConverter::EncodeMimePartIIStr_UTF8(const nsACString &header,
                                          bool             structured,
                                          const char       *mailCharset,
                                          PRInt32          fieldnamelen,
                                          PRInt32          encodedWordSize,
                                          char             **encodedString)
{
  NS_ENSURE_ARG_POINTER(encodedString);

  char *retString = MIME_EncodeMimePartIIStr(PromiseFlatCString(header).get(),
                                             structured, mailCharset,
                                             fieldnamelen, encodedWordSize);
  NS_ENSURE_TRUE(retString, NS_ERROR_FAILURE);

  *encodedString = retString;
  return NS_OK;
}


nsresult
nsMimeConverter::B64EncoderInit(MimeConverterOutputCallback output_fn,
                                void *closure,
                                MimeEncoderData **returnEncoderData)
{
  NS_ENSURE_ARG_POINTER(returnEncoderData);

  MimeEncoderData   *ptr;

  ptr = MimeB64EncoderInit(output_fn, closure);
  NS_ENSURE_TRUE(ptr, NS_ERROR_OUT_OF_MEMORY);

  *returnEncoderData = ptr;
  return NS_OK;
}

nsresult
nsMimeConverter::QPEncoderInit(MimeConverterOutputCallback output_fn,
                               void *closure,
                               MimeEncoderData **returnEncoderData)
{
  NS_ENSURE_ARG_POINTER(returnEncoderData);

  MimeEncoderData *ptr;

  ptr = MimeQPEncoderInit(output_fn, closure);
  NS_ENSURE_TRUE(ptr, NS_ERROR_OUT_OF_MEMORY);

  *returnEncoderData = ptr;
  return NS_OK;
}

nsresult
nsMimeConverter::EncoderDestroy(MimeEncoderData *data, bool abort_p)
{
  MimeEncoderDestroy(data, abort_p);
  return NS_OK;
}

nsresult
nsMimeConverter::EncoderWrite(MimeEncoderData *data, const char *buffer,
                              PRInt32 size, PRInt32 *written)
{
  NS_ENSURE_ARG_POINTER(written);

  PRInt32 writeCount;
  writeCount = MimeEncoderWrite(data, buffer, size);
  *written = writeCount;
  return NS_OK;
}
