/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _COMI18N_LOADED_H_
#define _COMI18N_LOADED_H_

#include "msgCore.h"

class nsIUnicodeDecoder;
class nsIUnicodeEncoder;
class nsIStringCharsetDetector;


#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */

/**
 * Decode MIME header to UTF-8.
 * Uses MIME_ConvertCharset if the decoded string needs a conversion.
 *
 *
 * @param header      [IN] A header to decode.
 * @param default_charset     [IN] Default charset to apply to ulabeled non-UTF-8 8bit data
 * @param override_charset    [IN] If true, default_charset used instead of any charset labeling other than UTF-8
 * @param eatContinuations    [IN] If true, unfold headers
 * @return            Decoded buffer (in C string) or return NULL if the header needs no conversion
 */
extern "C" char *MIME_DecodeMimeHeader(const char *header, 
                                       const char *default_charset,
                                       bool override_charset,
                                       bool eatContinuations);

/**
 * Encode an input string into RFC 2047 form.
 * This is a replacement for INTL_EncodeMimePartIIStr.
 * Unlike INTL_EncodeMimePartIIStr, this does not apply any charset conversion.
 * Use MIME_ConvertCharset in advance if the encoding string needs a conversion.
 *
 *
 * @param header          [IN] A header to encode (utf-8 Cstring).
 * @param structured      [IN] A boolean to swtich between structured field body and non-structured field body.
 * @param mailCharset     [IN] Charset name (in C string) to convert.
 * @param fieldNameLen    [IN] Header field name length (e.g. "From: " -> 6)
 * @param encodedWordSize [IN] Byte length limit of the output, ususally 72 (use kMIME_ENCODED_WORD_SIZE).
 * @return            Encoded buffer (in C string) or NULL in case of error.
 */
char *MIME_EncodeMimePartIIStr(const char *header, bool structured, const char* mailCharset, const int32_t fieldNameLen, const int32_t encodedWordSize);

/**
 * Get a next character position in an UTF-8 string.
 * Example: s = NextChar_UTF8(s);  // get a pointer for the next character
 *
 *
 * @param str          [IN] An input C string (UTF-8).
 * @return             A pointer to the next character.
 */
char * NextChar_UTF8(char *str);

nsresult MIME_detect_charset(const char *aBuf, int32_t aLength, const char** aCharset);
nsresult MIME_get_unicode_decoder(const char* aInputCharset, nsIUnicodeDecoder **aDecoder);
nsresult MIME_get_unicode_encoder(const char* aOutputCharset, nsIUnicodeEncoder **aEncoder);

#ifdef __cplusplus
} /* extern "C" */
#endif /* __cplusplus */

#endif // _COMI18N_LOADED_H_

