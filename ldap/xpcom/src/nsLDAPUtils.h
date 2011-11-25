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
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jan Horak <jhorak@redhat.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

/* This module contains helper functions and macros for converting directory
   module to frozen linkage.
 */
#include "nsIProxyObjectManager.h"
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
  (((((intn)(VAL)) & 0x7f) == ((intn)(VAL))) && isspace((intn)(VAL)))

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

    PRUint32 wlen = wend - cur - 1;

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

  PRInt32 state = 0;
  bool overlong = false;
  bool surrogate = false;
  bool nonchar = false;
  PRUint16 olupper = 0; // overlong byte upper bound.
  PRUint16 slower = 0;  // surrogate byte lower bound.

  const char *ptr = aString.BeginReading();

  while (ptr < done_reading) {
    PRUint8 c;

    if (0 == state) {

      c = *ptr++;

      if ((c & 0x80) == 0x00)
        continue;

      if ( c <= 0xC1 ) // [80-BF] where not expected, [C0-C1] for overlong.
        return PR_FALSE;
      else if ((c & 0xE0) == 0xC0)
        state = 1;
      else if ((c & 0xF0) == 0xE0) {
        state = 2;
        if ( c == 0xE0 ) { // to exclude E0[80-9F][80-BF]
          overlong = PR_TRUE;
          olupper = 0x9F;
        } else if ( c == 0xED ) { // ED[A0-BF][80-BF] : surrogate codepoint
          surrogate = PR_TRUE;
          slower = 0xA0;
        } else if ( c == 0xEF ) // EF BF [BE-BF] : non-character
          nonchar = PR_TRUE;
      } else if ( c <= 0xF4 ) { // XXX replace /w UTF8traits::is4byte when it's updated to exclude [F5-F7].(bug 199090)
        state = 3;
        nonchar = PR_TRUE;
        if ( c == 0xF0 ) { // to exclude F0[80-8F][80-BF]{2}
          overlong = PR_TRUE;
          olupper = 0x8F;
        }
        else if ( c == 0xF4 ) { // to exclude F4[90-BF][80-BF]
          // actually not surrogates but codepoints beyond 0x10FFFF
          surrogate = PR_TRUE;
          slower = 0x90;
        }
      } else
        return PR_FALSE; // Not UTF-8 string
    }

    while (ptr < done_reading && state) {
      c = *ptr++;
      --state;

      // non-character : EF BF [BE-BF] or F[0-7] [89AB]F BF [BE-BF]
      if ( nonchar &&  ( !state &&  c < 0xBE ||
           state == 1 && c != 0xBF  ||
           state == 2 && 0x0F != (0x0F & c) ))
        nonchar = PR_FALSE;

      if ((c & 0xC0) != 0x80 || overlong && c <= olupper ||
           surrogate && slower <= c || nonchar && !state )
        return PR_FALSE; // Not UTF-8 string
      overlong = surrogate = PR_FALSE;
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
