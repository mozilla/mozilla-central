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

NS_IMPL_ISUPPORTS1(nsMimeConverter, nsIMimeConverter)

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
nsMimeConverter::DecodeMimeHeaderToUTF8(const nsACString &header,
                                        const char *default_charset,
                                        bool override_charset,
                                        bool eatContinuations,
                                        nsACString &result)
{
  MIME_DecodeMimeHeader(PromiseFlatCString(header).get(), default_charset,
                        override_charset, eatContinuations, result);
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
  nsCString decodedCString;
  MIME_DecodeMimeHeader(header, default_charset, override_charset,
                        eatContinuations, decodedCString);
  CopyUTF8toUTF16(decodedCString.IsEmpty() ? nsDependentCString(header)
                                           : decodedCString,
                  decodedString);
  return NS_OK;
}

nsresult
nsMimeConverter::EncodeMimePartIIStr_UTF8(const nsACString &header,
                                          bool             structured,
                                          const char       *mailCharset,
                                          int32_t          fieldnamelen,
                                          int32_t          encodedWordSize,
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
