/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This module contains helper functions and macros for converting directory
   module to frozen linkage.
 */
#include "nsServiceManagerUtils.h"
#include "nsStringGlue.h"
#include <ctype.h>

#ifdef MOZILLA_INTERNAL_API
/* Internal API helper macros */

#define LdapCompressWhitespace(str) \
        (str).CompressWhitespace()

#else // MOZILLA_INTERNAL_API
/* Frozen linkage helper functions */

/* This macro has been copied from msgcore.h */
#define IS_SPACE(VAL) \
  (((((PRIntn)(VAL)) & 0x7f) == ((PRIntn)(VAL))) && isspace((PRIntn)(VAL)))

/* This function has been copied from nsMsgUtils.cpp */
inline void LdapCompressWhitespace(nsCString& aString)
{
  // This code is frozen linkage specific
  aString.Trim(" \f\n\r\t\v");

  char *start, *end;
  aString.BeginWriting(&start, &end);

  for (char *cur = start; cur < end; ++cur) {
    if (!IS_SPACE(*cur))
      continue;

    *cur = ' ';

    if (!IS_SPACE(*(cur + 1)))
      continue;

    // Loop through the white space
    char *wend = cur + 2;
    while (IS_SPACE(*wend))
      ++wend;

    uint32_t wlen = wend - cur - 1;

    // fix "end"
    end -= wlen;

    // move everything forwards a bit
    for (char *m = cur + 1; m < end; ++m) {
      *m = *(m + wlen);
    }
  }

  // Set the new length.
  aString.SetLength(end - start);
}

/*
 * Function copied from nsReadableUtils.
 * Migrating to frozen linkage is the only change done
 */
inline
bool IsUTF8(const nsACString& aString)
{
  const char *done_reading = aString.EndReading();

  int32_t state = 0;
  bool overlong = false;
  bool surrogate = false;
  bool nonchar = false;
  uint16_t olupper = 0; // overlong byte upper bound.
  uint16_t slower = 0;  // surrogate byte lower bound.

  const char *ptr = aString.BeginReading();

  while (ptr < done_reading) {
    uint8_t c;

    if (0 == state) {

      c = *ptr++;

      if ((c & 0x80) == 0x00)
        continue;

      if ( c <= 0xC1 ) // [80-BF] where not expected, [C0-C1] for overlong.
        return false;
      else if ((c & 0xE0) == 0xC0)
        state = 1;
      else if ((c & 0xF0) == 0xE0) {
        state = 2;
        if ( c == 0xE0 ) { // to exclude E0[80-9F][80-BF]
          overlong = true;
          olupper = 0x9F;
        } else if ( c == 0xED ) { // ED[A0-BF][80-BF] : surrogate codepoint
          surrogate = true;
          slower = 0xA0;
        } else if ( c == 0xEF ) // EF BF [BE-BF] : non-character
          nonchar = true;
      } else if ( c <= 0xF4 ) { // XXX replace /w UTF8traits::is4byte when it's updated to exclude [F5-F7].(bug 199090)
        state = 3;
        nonchar = true;
        if ( c == 0xF0 ) { // to exclude F0[80-8F][80-BF]{2}
          overlong = true;
          olupper = 0x8F;
        }
        else if ( c == 0xF4 ) { // to exclude F4[90-BF][80-BF]
          // actually not surrogates but codepoints beyond 0x10FFFF
          surrogate = true;
          slower = 0x90;
        }
      } else
        return false; // Not UTF-8 string
    }

    while (ptr < done_reading && state) {
      c = *ptr++;
      --state;

      // non-character : EF BF [BE-BF] or F[0-7] [89AB]F BF [BE-BF]
      if ( nonchar &&  ( !state &&  c < 0xBE ||
           state == 1 && c != 0xBF  ||
           state == 2 && 0x0F != (0x0F & c) ))
        nonchar = false;

      if ((c & 0xC0) != 0x80 || overlong && c <= olupper ||
           surrogate && slower <= c || nonchar && !state )
        return false; // Not UTF-8 string
      overlong = surrogate = false;
    }
  }
  return !state; // state != 0 at the end indicates an invalid UTF-8 seq.
}

#define kNotFound -1

#define nsCaseInsensitiveCStringComparator() \
        CaseInsensitiveCompare
#define nsCaseInsensitiveStringComparator() \
        CaseInsensitiveCompare

#endif // MOZILLA_INTERNAL_API
