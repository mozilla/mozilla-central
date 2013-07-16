/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImportTranslator_h___
#define nsImportTranslator_h___

#include "mozilla/Attributes.h"
#include "nscore.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"

class ImportOutFile;

class UMimeEncode {
public:
  static uint32_t  GetBufferSize(uint32_t inByes);
  static uint32_t  ConvertBuffer(const uint8_t * pIn, uint32_t inLen, uint8_t *pOut, uint32_t maxLen = 72, uint32_t firstLineLen = 72, const char * pEolStr = nullptr);
};


class nsImportTranslator {
public:
  virtual ~nsImportTranslator() {}
  virtual bool      Supports8bitEncoding(void) { return false;}
  virtual uint32_t  GetMaxBufferSize(uint32_t inLen) { return inLen + 1;}
  virtual void    ConvertBuffer(const uint8_t * pIn, uint32_t inLen, uint8_t * pOut) { memcpy(pOut, pIn, inLen); pOut[inLen] = 0;}
  virtual bool      ConvertToFile(const uint8_t * pIn, uint32_t inLen, ImportOutFile *pOutFile, uint32_t *pProcessed = nullptr);
  virtual bool      FinishConvertToFile(ImportOutFile * /* pOutFile */) { return true;}

  virtual void  GetCharset(nsCString& charSet) { charSet = "us-ascii";}
  virtual void  GetLanguage(nsCString& lang) { lang = "en";}
  virtual void  GetEncoding(nsCString& encoding) { encoding.Truncate();}
};

// Specialized encoder, not a vaild language translator, used for Mime headers.
// rfc2231
class CMHTranslator : public nsImportTranslator {
public:
  virtual uint32_t  GetMaxBufferSize(uint32_t inLen) MOZ_OVERRIDE { return (inLen * 3) + 1;}
  virtual void    ConvertBuffer(const uint8_t * pIn, uint32_t inLen, uint8_t * pOut) MOZ_OVERRIDE;
  virtual bool      ConvertToFile(const uint8_t * pIn, uint32_t inLen, ImportOutFile *pOutFile, uint32_t *pProcessed = nullptr) MOZ_OVERRIDE;
};

// Specialized encoder, not a vaild language translator, used for mail headers
// rfc2047
class C2047Translator : public nsImportTranslator {
public:
  virtual ~C2047Translator() {}

  C2047Translator(const char *pCharset, uint32_t headerLen) { m_charset = pCharset; m_startLen = headerLen; m_useQuotedPrintable = false;}

  void  SetUseQuotedPrintable(void) { m_useQuotedPrintable = true;}

  virtual bool    ConvertToFile(const uint8_t * pIn, uint32_t inLen, ImportOutFile *pOutFile, uint32_t *pProcessed = nullptr) MOZ_OVERRIDE;
  bool    ConvertToFileQ(const uint8_t * pIn, uint32_t inLen, ImportOutFile *pOutFile, uint32_t *pProcessed);

protected:
  bool        m_useQuotedPrintable;
  nsCString    m_charset;
  uint32_t    m_startLen;
};

#endif /* nsImportTranslator_h__ */

