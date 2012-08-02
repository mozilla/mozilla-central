/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImportTranslator_h___
#define nsImportTranslator_h___

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"

class ImportOutFile;

class UMimeEncode {
public:
  static PRUint32  GetBufferSize(PRUint32 inByes);
  static PRUint32  ConvertBuffer(const PRUint8 * pIn, PRUint32 inLen, PRUint8 *pOut, PRUint32 maxLen = 72, PRUint32 firstLineLen = 72, const char * pEolStr = nullptr);
};


class nsImportTranslator {
public:
  virtual ~nsImportTranslator() {}
  virtual bool      Supports8bitEncoding(void) { return false;}
  virtual PRUint32  GetMaxBufferSize(PRUint32 inLen) { return inLen + 1;}
  virtual void    ConvertBuffer(const PRUint8 * pIn, PRUint32 inLen, PRUint8 * pOut) { memcpy(pOut, pIn, inLen); pOut[inLen] = 0;}
  virtual bool      ConvertToFile(const PRUint8 * pIn, PRUint32 inLen, ImportOutFile *pOutFile, PRUint32 *pProcessed = nullptr);
  virtual bool      FinishConvertToFile(ImportOutFile * /* pOutFile */) { return true;}

  virtual void  GetCharset(nsCString& charSet) { charSet = "us-ascii";}
  virtual void  GetLanguage(nsCString& lang) { lang = "en";}
  virtual void  GetEncoding(nsCString& encoding) { encoding.Truncate();}
};

// Specialized encoder, not a vaild language translator, used for Mime headers.
// rfc2231
class CMHTranslator : public nsImportTranslator {
public:
  virtual PRUint32  GetMaxBufferSize(PRUint32 inLen) { return (inLen * 3) + 1;}
  virtual void    ConvertBuffer(const PRUint8 * pIn, PRUint32 inLen, PRUint8 * pOut);
  virtual bool      ConvertToFile(const PRUint8 * pIn, PRUint32 inLen, ImportOutFile *pOutFile, PRUint32 *pProcessed = nullptr);
};

// Specialized encoder, not a vaild language translator, used for mail headers
// rfc2047
class C2047Translator : public nsImportTranslator {
public:
  virtual ~C2047Translator() {}

  C2047Translator(const char *pCharset, PRUint32 headerLen) { m_charset = pCharset; m_startLen = headerLen; m_useQuotedPrintable = false;}

  void  SetUseQuotedPrintable(void) { m_useQuotedPrintable = true;}

  virtual bool    ConvertToFile(const PRUint8 * pIn, PRUint32 inLen, ImportOutFile *pOutFile, PRUint32 *pProcessed = nullptr);
  bool    ConvertToFileQ(const PRUint8 * pIn, PRUint32 inLen, ImportOutFile *pOutFile, PRUint32 *pProcessed);

protected:
  bool        m_useQuotedPrintable;
  nsCString    m_charset;
  PRUint32    m_startLen;
};

#endif /* nsImportTranslator_h__ */

