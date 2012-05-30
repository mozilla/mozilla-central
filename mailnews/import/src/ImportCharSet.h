/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef ImportCharSet_h___
#define ImportCharSet_h___

#include "nscore.h"


// Some useful ASCII values
//  'A' = 65, 0x41
//  'Z' = 90, 0x5a
//  '_' = 95, 0x5f
//  'a' = 97, 0x61
//  'z' = 122, 0x7a
//  '0' = 48, 0x30
//  '1' = 49, 0x31
//  '9' = 57, 0x39
//  ' ' = 32, 0x20
//   whitespace, 10, 13, 32, 9 (linefeed, cr, space, tab) - 0x0a, 0x0d, 0x20, 0x09
//  ':' = 58, 0x3a


// a typedef enum would be nicer but some compilers still have trouble with treating
// enum's as plain numbers when needed

class ImportCharSet {
public:
  enum {
    cTabChar = 9,
    cLinefeedChar = 10,
    cCRChar = 13,
    cSpaceChar = 32,
    cUpperAChar = 65,
    cUpperZChar = 90,
    cUnderscoreChar = 95,
    cLowerAChar = 97,
    cLowerZChar = 122,
    cZeroChar = 48,
    cNineChar = 57,

    cAlphaNumChar = 1,
    cAlphaChar = 2,
    cWhiteSpaceChar = 4,
    cDigitChar = 8,
    c822SpecialChar = 16
  };

  static char      m_upperCaseMap[256];
  static char      m_Ascii[256];

  inline static bool IsUSAscii(PRUint8 ch) { return (((ch & (PRUint8)0x80) == 0));}
  inline static bool Is822CtlChar(PRUint8 ch) { return (ch < 32);}
  inline static bool Is822SpecialChar(PRUint8 ch) { return ((m_Ascii[ch] & c822SpecialChar) == c822SpecialChar);}
  inline static bool IsWhiteSpace(PRUint8 ch) { return ((m_Ascii[ch] & cWhiteSpaceChar) == cWhiteSpaceChar); }
  inline static bool IsAlphaNum(PRUint8 ch) { return ((m_Ascii[ch] & cAlphaNumChar) == cAlphaNumChar); }
  inline static bool IsDigit(PRUint8 ch) { return ((m_Ascii[ch] & cDigitChar) == cDigitChar); }

  inline static PRUint8 ToLower(PRUint8 ch) { if ((m_Ascii[ch] & cAlphaChar) == cAlphaChar) { return cLowerAChar + (m_upperCaseMap[ch] - cUpperAChar); } else return ch; }

  inline static long AsciiToLong(const PRUint8 * pChar, PRUint32 len) {
    long num = 0;
    while (len) {
      if ((m_Ascii[*pChar] & cDigitChar) == 0)
        return num;
      num *= 10;
      num += (*pChar - cZeroChar);
      len--;
      pChar++;
    }
    return num;
  }

  inline static void ByteToHex(PRUint8 byte, PRUint8 * pHex) {
    PRUint8 val = byte;
    val /= 16;
    if (val < 10)
      *pHex = '0' + val;
    else
      *pHex = 'A' + (val - 10);
    pHex++;
    val = byte;
    val &= 0x0F;
    if (val < 10)
      *pHex = '0' + val;
    else
      *pHex = 'A' + (val - 10);
  }

  inline static void  LongToHexBytes(PRUint32 type, PRUint8 * pStr) {
    ByteToHex((PRUint8) (type >> 24), pStr);
    pStr += 2;
    ByteToHex((PRUint8) ((type >> 16) & 0x0FF), pStr);
    pStr += 2;
    ByteToHex((PRUint8) ((type >> 8) & 0x0FF), pStr);
    pStr += 2;
    ByteToHex((PRUint8) (type & 0x0FF), pStr);
  }

  inline static void SkipWhiteSpace(const PRUint8 * & pChar, PRUint32 & pos, PRUint32 max) {
    while ((pos < max) && (IsWhiteSpace(*pChar))) {
      pos++; pChar++;
    }
  }

  inline static void SkipSpaceTab(const PRUint8 * & pChar, PRUint32& pos, PRUint32 max) {
    while ((pos < max) && ((*pChar == (PRUint8)cSpaceChar) || (*pChar == (PRUint8)cTabChar))) {
      pos++; pChar++;
    }
  }

  inline static void SkipTilSpaceTab(const PRUint8 * & pChar, PRUint32& pos, PRUint32 max) {
    while ((pos < max) && (*pChar != (PRUint8)cSpaceChar) && (*pChar != (PRUint8)cTabChar)) {
      pos++;
      pChar++;
    }
  }

  inline static bool StrNICmp(const PRUint8 * pChar, const PRUint8 * pSrc, PRUint32 len) {
    while (len && (m_upperCaseMap[*pChar] == m_upperCaseMap[*pSrc])) {
      pChar++; pSrc++; len--;
    }
    return len == 0;
  }

  inline static bool StrNCmp(const PRUint8 * pChar, const PRUint8 *pSrc, PRUint32 len) {
    while (len && (*pChar == *pSrc)) {
      pChar++; pSrc++; len--;
    }
    return len == 0;
  }

  inline static int FindChar(const PRUint8 * pChar, PRUint8 ch, PRUint32 max) {
    PRUint32    pos = 0;
    while ((pos < max) && (*pChar != ch)) {
      pos++; pChar++;
    }
    if (pos < max)
      return (int) pos;
    else
      return -1;
  }

  inline static bool NextChar(const PRUint8 * & pChar, PRUint8 ch, PRUint32& pos, PRUint32 max) {
    if ((pos < max) && (*pChar == ch)) {
      pos++;
      pChar++;
      return true;
    }
    return false;
  }

  inline static PRInt32 strcmp(const char * pS1, const char * pS2) {
    while (*pS1 && *pS2 && (*pS1 == *pS2)) {
      pS1++;
      pS2++;
    }
    return *pS1 - *pS2;
  }

  inline static PRInt32 stricmp(const char * pS1, const char * pS2) {
    while (*pS1 && *pS2 && (m_upperCaseMap[PRUint8(*pS1)] == m_upperCaseMap[PRUint8(*pS2)])) {
      pS1++;
      pS2++;
    }
    return m_upperCaseMap[PRUint8(*pS1)] - m_upperCaseMap[PRUint8(*pS2)];
  }

};


#endif /* ImportCharSet_h__ */

