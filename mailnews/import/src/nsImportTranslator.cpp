/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ImportOutFile.h"
#include "nsImportTranslator.h"

#include "ImportCharSet.h"


bool nsImportTranslator::ConvertToFile(const uint8_t * pIn, uint32_t inLen, ImportOutFile *pOutFile, uint32_t *pProcessed)
{
  if (pProcessed)
    *pProcessed = inLen;
  return (pOutFile->WriteData(pIn, inLen));
}

void CMHTranslator::ConvertBuffer(const uint8_t * pIn, uint32_t inLen, uint8_t * pOut)
{
  while (inLen) {
    if (!ImportCharSet::IsUSAscii(*pIn) || ImportCharSet::Is822SpecialChar(*pIn) || ImportCharSet::Is822CtlChar(*pIn) ||
      (*pIn == ImportCharSet::cSpaceChar) || (*pIn == '*') || (*pIn == '\'') ||
      (*pIn == '%')) {
      // needs to be encode as %hex val
      *pOut = '%'; pOut++;
      ImportCharSet::ByteToHex(*pIn, pOut);
      pOut += 2;
    }
    else {
      *pOut = *pIn;
      pOut++;
    }
    pIn++; inLen--;
  }
  *pOut = 0;
}

bool CMHTranslator::ConvertToFile(const uint8_t * pIn, uint32_t inLen, ImportOutFile *pOutFile, uint32_t *pProcessed)
{
  uint8_t    hex[2];
  while (inLen) {
    if (!ImportCharSet::IsUSAscii(*pIn) || ImportCharSet::Is822SpecialChar(*pIn) || ImportCharSet::Is822CtlChar(*pIn) ||
      (*pIn == ImportCharSet::cSpaceChar) || (*pIn == '*') || (*pIn == '\'') ||
      (*pIn == '%')) {
      // needs to be encode as %hex val
      if (!pOutFile->WriteByte('%'))
        return false;
      ImportCharSet::ByteToHex(*pIn, hex);
      if (!pOutFile->WriteData(hex, 2))
        return false;
    }
    else {
      if (!pOutFile->WriteByte(*pIn))
        return false;
    }
    pIn++; inLen--;
  }

  if (pProcessed)
    *pProcessed = inLen;

  return true;
}


bool C2047Translator::ConvertToFileQ(const uint8_t * pIn, uint32_t inLen, ImportOutFile *pOutFile, uint32_t *pProcessed)
{
  if (!inLen)
    return true;

  int    maxLineLen = 64;
  int    curLineLen = m_startLen;
  bool    startLine = true;

  uint8_t  hex[2];
  while (inLen) {
    if (startLine) {
      if (!pOutFile->WriteStr(" =?"))
        return false;
      if (!pOutFile->WriteStr(m_charset.get()))
        return false;
      if (!pOutFile->WriteStr("?q?"))
        return false;
      curLineLen += (6 + m_charset.Length());
      startLine = false;
    }

    if (!ImportCharSet::IsUSAscii(*pIn) || ImportCharSet::Is822SpecialChar(*pIn) || ImportCharSet::Is822CtlChar(*pIn) ||
      (*pIn == ImportCharSet::cSpaceChar) || (*pIn == '?') || (*pIn == '=')) {
      // needs to be encode as =hex val
      if (!pOutFile->WriteByte('='))
        return false;
      ImportCharSet::ByteToHex(*pIn, hex);
      if (!pOutFile->WriteData(hex, 2))
        return false;
      curLineLen += 3;
    }
    else {
      if (!pOutFile->WriteByte(*pIn))
        return false;
      curLineLen++;
    }
    pIn++; inLen--;
    if (curLineLen > maxLineLen) {
      if (!pOutFile->WriteStr("?="))
        return false;
      if (inLen) {
        if (!pOutFile->WriteStr("\x0D\x0A "))
          return false;
      }

      startLine = true;
      curLineLen = 0;
    }
  }

  if (!startLine) {
    // end the encoding!
    if (!pOutFile->WriteStr("?="))
      return false;
  }

  if (pProcessed)
    *pProcessed = inLen;

  return true;
}

bool C2047Translator::ConvertToFile(const uint8_t * pIn, uint32_t inLen, ImportOutFile *pOutFile, uint32_t *pProcessed)
{
  if (m_useQuotedPrintable)
    return ConvertToFileQ(pIn, inLen, pOutFile, pProcessed);

  if (!inLen)
    return true;

  int      maxLineLen = 64;
  int      curLineLen = m_startLen;
  bool      startLine = true;
  int      encodeMax;
  uint8_t *  pEncoded = new uint8_t[maxLineLen * 2];

  while (inLen) {
    if (startLine) {
      if (!pOutFile->WriteStr(" =?")) {
        delete [] pEncoded;
        return false;
      }
      if (!pOutFile->WriteStr(m_charset.get())) {
        delete [] pEncoded;
        return false;
      }
      if (!pOutFile->WriteStr("?b?")) {
        delete [] pEncoded;
        return false;
      }
      curLineLen += (6 + m_charset.Length());
      startLine = false;
    }
    encodeMax = maxLineLen - curLineLen;
    encodeMax *= 3;
    encodeMax /= 4;
    if ((uint32_t)encodeMax > inLen)
      encodeMax = (int)inLen;

    // encode the line, end the line
    // then continue. Update curLineLen, pIn, startLine, and inLen
    UMimeEncode::ConvertBuffer(pIn, encodeMax, pEncoded, maxLineLen, maxLineLen, "\x0D\x0A");

    if (!pOutFile->WriteStr((const char *)pEncoded)) {
      delete [] pEncoded;
      return false;
    }

    pIn += encodeMax;
    inLen -= encodeMax;
    startLine = true;
    curLineLen = 0;
    if (!pOutFile->WriteStr("?=")) {
      delete [] pEncoded;
      return false;
    }
    if (inLen) {
      if (!pOutFile->WriteStr("\x0D\x0A ")) {
        delete [] pEncoded;
        return false;
      }
    }
  }

  delete [] pEncoded;

  if (pProcessed)
    *pProcessed = inLen;

  return true;
}


uint32_t  UMimeEncode::GetBufferSize(uint32_t inBytes)
{
  // it takes 4 base64 bytes to represent 3 regular bytes
  inBytes += 3;
  inBytes /= 3;
  inBytes *= 4;
  // This should be plenty, but just to be safe
  inBytes += 4;

  // now allow for end of line characters
  inBytes += ((inBytes + 39) / 40) * 4;

  return inBytes;
}

static uint8_t gBase64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

uint32_t UMimeEncode::ConvertBuffer(const uint8_t * pIn, uint32_t inLen, uint8_t * pOut, uint32_t maxLen, uint32_t firstLineLen, const char * pEolStr)
{

  uint32_t  pos = 0;
  uint32_t  len = 0;
  uint32_t  lineLen = 0;
  uint32_t  maxLine = firstLineLen;
  int  eolLen = 0;
  if (pEolStr)
    eolLen = strlen(pEolStr);

  while ((pos + 2) < inLen) {
    // Encode 3 bytes
    *pOut = gBase64[*pIn >> 2];
    pOut++; len++; lineLen++;
    *pOut = gBase64[(((*pIn) & 0x3)<< 4) | (((*(pIn + 1)) & 0xF0) >> 4)];
    pIn++; pOut++; len++; lineLen++;
    *pOut = gBase64[(((*pIn) & 0xF) << 2) | (((*(pIn + 1)) & 0xC0) >>6)];
    pIn++; pOut++; len++; lineLen++;
    *pOut = gBase64[(*pIn) & 0x3F];
    pIn++; pOut++; len++; lineLen++;
    pos += 3;
    if (lineLen >= maxLine) {
      lineLen = 0;
      maxLine = maxLen;
      if (pEolStr) {
        memcpy(pOut, pEolStr, eolLen);
        pOut += eolLen;
        len += eolLen;
      }
    }
  }

  if ((pos < inLen) && ((lineLen + 3) > maxLine)) {
    lineLen = 0;
    maxLine = maxLen;
    if (pEolStr) {
      memcpy(pOut, pEolStr, eolLen);
      pOut += eolLen;
      len += eolLen;
    }
  }

  if (pos < inLen) {
    // Get the last few bytes!
    *pOut = gBase64[*pIn >> 2];
    pOut++; len++;
    pos++;
    if (pos < inLen) {
      *pOut = gBase64[(((*pIn) & 0x3)<< 4) | (((*(pIn + 1)) & 0xF0) >> 4)];
      pIn++; pOut++; pos++; len++;
      if (pos < inLen) {
        // Should be dead code!! (Then why is it here doofus?)
        *pOut = gBase64[(((*pIn) & 0xF) << 2) | (((*(pIn + 1)) & 0xC0) >>6)];
        pIn++; pOut++; len++;
        *pOut = gBase64[(*pIn) & 0x3F];
        pos++; pOut++; len++;
      }
      else {
        *pOut = gBase64[(((*pIn) & 0xF) << 2)];
        pOut++; len++;
        *pOut = '=';
        pOut++; len++;
      }
    }
    else {
      *pOut = gBase64[(((*pIn) & 0x3)<< 4)];
      pOut++; len++;
      *pOut = '=';
      pOut++; len++;
      *pOut = '=';
      pOut++; len++;
    }
  }

  *pOut = 0;

  return len;
}
