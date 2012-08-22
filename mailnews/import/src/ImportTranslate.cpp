/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ImportTranslate.h"

int ImportTranslate::m_useTranslator = -1;


bool ImportTranslate::ConvertString(const nsCString& inStr, nsCString& outStr, bool mimeHeader)
{
  if (inStr.IsEmpty()) {
    outStr = inStr;
    return true;
  }

  nsImportTranslator *pTrans = GetTranslator();
  // int      maxLen = (int) pTrans->GetMaxBufferSize(inStr.Length());
  // int      hLen = 0;
  nsCString  set;
  nsCString  lang;

  if (mimeHeader) {
    // add the charset and language
    pTrans->GetCharset(set);
    pTrans->GetLanguage(lang);
  }

  // Unfortunatly, we didn't implement ConvertBuffer for all translators,
  // just ConvertToFile.  This means that this data will not always
  // be converted to the charset of pTrans.  In that case...
  // We don't always have the data in the same charset as the current
  // translator...
  // It is safer to leave the charset and language field blank
  set.Truncate();
  lang.Truncate();

  uint8_t *  pBuf;
  /*
  pBuf = (P_U8) outStr.GetBuffer(maxLen);
  if (!pBuf) {
    delete pTrans;
    return FALSE;
  }
  pTrans->ConvertBuffer((PC_U8)(PC_S8)inStr, inStr.GetLength(), pBuf);
  outStr.ReleaseBuffer();
  */
  outStr = inStr;
  delete pTrans;


  // Now I need to run the string through the mime-header special char
  // encoder.

  pTrans = new CMHTranslator;
  pBuf = new uint8_t[pTrans->GetMaxBufferSize(outStr.Length())];
  pTrans->ConvertBuffer((const uint8_t *)(outStr.get()), outStr.Length(), pBuf);
  delete pTrans;
  outStr.Truncate();
  if (mimeHeader) {
    outStr = set;
    outStr += "'";
    outStr += lang;
    outStr += "'";
  }
  outStr += (const char *)pBuf;
  delete [] pBuf;

  return true;
}


nsImportTranslator *ImportTranslate::GetTranslator(void)
{
  if (m_useTranslator == -1) {
    // get the translator to use...
    // CString    trans;
    // trans.LoadString(IDS_LANGUAGE_TRANSLATION);
    m_useTranslator = 0;
    // if (!trans.CompareNoCase("iso-2022-jp"))
    //  gWizData.m_useTranslator = 1;
  }

  switch(m_useTranslator) {
  case 0:
    return new nsImportTranslator;
  //case 1:
  //  return new CSJis2JisTranslator;
  default:
    return new nsImportTranslator;
  }
}

nsImportTranslator *ImportTranslate::GetMatchingTranslator(const char *pCharSet)
{
/*
  CString    jp = "iso-2022-jp";
  if (!jp.CompareNoCase(pCharSet))
    return new CSJis2JisTranslator;
*/

  return nullptr;
}

