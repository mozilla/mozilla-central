/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsImportMimeEncode.h"

#include "ImportCharSet.h"
#include "ImportTranslate.h"

#define  kNoState    0
#define  kStartState    1
#define  kEncodeState  2
#define kDoneState    3

#define kEncodeBufferSz  (8192 * 8)

nsImportMimeEncode::nsImportMimeEncode()
{
  m_pOut = nullptr;
  m_state = kNoState;
  m_bytesProcessed = 0;
  m_pInputBuf = nullptr;
}

nsImportMimeEncode::~nsImportMimeEncode()
{
  delete [] m_pInputBuf;
}

void nsImportMimeEncode::EncodeFile(nsIFile *pInFile, ImportOutFile *pOut, const char *pFileName, const char *pMimeType)
{
  m_fileName = pFileName;
  m_mimeType = pMimeType;

  m_pMimeFile = pInFile;

  m_pOut = pOut;
  m_state = kStartState;
}

void nsImportMimeEncode::CleanUp(void)
{
  CleanUpEncodeScan();
}

bool nsImportMimeEncode::SetUpEncode(void)
{
  nsCString    errStr;
  if (!m_pInputBuf) {
    m_pInputBuf = new uint8_t[kEncodeBufferSz];
  }

  m_appleSingle = false;

#ifdef _MAC_IMPORT_CODE
  // First let's see just what kind of beast we have?
  // For files with only a data fork and a known mime type
  // proceed with normal mime encoding just as on the PC.
  // For unknown mime types and files with both forks,
  // encode as AppleSingle format.
  if (m_filePath.GetMacFileSize(UFileLocation::eResourceFork) || !pMimeType) {
    m_appleSingle = TRUE;
    m_mimeType = "application/applefile";
  }
#endif

  if (!InitEncodeScan(m_appleSingle, m_pMimeFile, m_fileName.get(), m_pInputBuf, kEncodeBufferSz)) {
    return false;
  }

  m_state = kEncodeState;
  m_lineLen = 0;

  // Write out the boundary header
  bool bResult = true;
  bResult = m_pOut->WriteStr("Content-type: ");
  if (bResult)
    bResult = m_pOut->WriteStr(m_mimeType.get());

#ifdef _MAC_IMPORT_CODE
  // include the type an creator here
  if (bResult)
    bResult = m_pOut->WriteStr("; x-mac-type=\"");
  U8  hex[8];
  LongToHexBytes(m_filePath.GetFileType(), hex);
  if (bResult)
    bResult = m_pOut->WriteData(hex, 8);
  LongToHexBytes(m_filePath.GetFileCreator(), hex);
  if (bResult)
    bResult = m_pOut->WriteStr("\"; x-mac-creator=\"");
  if (bResult)
    bResult = m_pOut->WriteData(hex, 8);
  if (bResult)
    bResult = m_pOut->WriteStr("\"");
#endif

  /*
  if (bResult)
    bResult = m_pOut->WriteStr(gMimeTypeFileName);
  */
  if (bResult)
    bResult = m_pOut->WriteStr(";\x0D\x0A");

  nsCString    fName;
  bool        trans = TranslateFileName(m_fileName, fName);
  if (bResult)
    bResult = WriteFileName(fName, trans, "name");
  if (bResult)
    bResult = m_pOut->WriteStr("Content-transfer-encoding: base64");
  if (bResult)
    bResult = m_pOut->WriteEol();
  if (bResult)
    bResult = m_pOut->WriteStr("Content-Disposition: attachment;\x0D\x0A");
  if (bResult)
    bResult = WriteFileName(fName, trans, "filename");
  if (bResult)
    bResult = m_pOut->WriteEol();

  if (!bResult) {
    CleanUp();
  }

  return bResult;
}

bool nsImportMimeEncode::DoWork(bool *pDone)
{
  *pDone = false;
  switch(m_state) {
  case kNoState:
    return false;
    break;
  case kStartState:
    return SetUpEncode();
    break;
  case kEncodeState:
    if (!Scan(pDone)) {
      CleanUp();
      return false;
    }
    if (*pDone) {
      *pDone = false;
      m_state = kDoneState;
    }
    break;
  case kDoneState:
    CleanUp();
    m_state = kNoState;
    *pDone = true;
    break;
  }

  return true;
}

static uint8_t gBase64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

bool nsImportMimeEncode::ScanBuffer(bool *pDone)
{

  uint32_t  pos = m_pos;
  uint32_t  start = pos;
  uint8_t *  pChar = m_pBuf + pos;
  uint32_t  max = m_bytesInBuf;
  uint8_t    byte[4];
  uint32_t  lineLen = m_lineLen;

  while ((pos + 2) < max) {
    // Encode 3 bytes
    byte[0] = gBase64[*pChar >> 2];
    byte[1] = gBase64[(((*pChar) & 0x3)<< 4) | (((*(pChar + 1)) & 0xF0) >> 4)];
    pChar++;
    byte[2] = gBase64[(((*pChar) & 0xF) << 2) | (((*(pChar + 1)) & 0xC0) >>6)];
    pChar++;
    byte[3] = gBase64[(*pChar) & 0x3F];
    if (!m_pOut->WriteData(byte, 4))
      return false;
    pos += 3;
    pChar++;
    lineLen += 4;
    if (lineLen > 71) {
      if (!m_pOut->WriteEol())
        return false;
      lineLen = 0;
    }
  }

  if ((pos < max) && m_eof) {
    // Get the last few bytes!
    byte[0] = gBase64[*pChar >> 2];
    pos++;
    if (pos < max) {
      byte[1] = gBase64[(((*pChar) & 0x3)<< 4) | (((*(pChar + 1)) & 0xF0) >> 4)];
      pChar++;
      pos++;
      if (pos < max) {
        // Should be dead code!! (Then why is it here doofus?)
        byte[2] = gBase64[(((*pChar) & 0xF) << 2) | (((*(pChar + 1)) & 0xC0) >>6)];
        pChar++;
        byte[3] = gBase64[(*pChar) & 0x3F];
        pos++;
      }
      else {
        byte[2] = gBase64[(((*pChar) & 0xF) << 2)];
        byte[3] = '=';
      }
    }
    else {
      byte[1] = gBase64[(((*pChar) & 0x3)<< 4)];
      byte[2] = '=';
      byte[3] = '=';
    }

    if (!m_pOut->WriteData(byte, 4))
      return false;
    if (!m_pOut->WriteEol())
      return false;
  }
  else if (m_eof) {
    /*
    byte[0] = '=';
    if (!m_pOut->WriteData(byte, 1))
      return FALSE;
    */
    if (!m_pOut->WriteEol())
      return false;
  }

  m_lineLen = (int) lineLen;
  m_pos = pos;
  m_bytesProcessed += (pos - start);
  return true;
}

bool nsImportMimeEncode::TranslateFileName(nsCString& inFile, nsCString& outFile)
{
  const uint8_t * pIn = (const uint8_t *) inFile.get();
  int    len = inFile.Length();

  while (len) {
    if (!ImportCharSet::IsUSAscii(*pIn))
      break;
    len--;
    pIn++;
  }
  if (len) {
    // non US ascii!
    // assume this string needs translating...
    if (!ImportTranslate::ConvertString(inFile, outFile, true)) {
      outFile = inFile;
      return false;
    }
    else {
      return true;
    }
  }
  else {
    outFile = inFile;
    return false;
  }
}

bool nsImportMimeEncode::WriteFileName(nsCString& fName, bool wasTrans, const char *pTag)
{
  int      tagNum = 0;
  int      idx = 0;
  bool      result = true;
  int      len;
  nsCString  numStr;

  while ((((fName.Length() - idx) + strlen(pTag)) > 70) && result) {
    len = 68 - strlen(pTag) - 5;
    if (wasTrans) {
      if (fName.CharAt(idx + len - 1) == '%')
        len--;
      else if (fName.CharAt(idx + len - 2) == '%')
        len -= 2;
    }

    if (result)
      result = m_pOut->WriteStr("\x09");
    if (result)
      result = m_pOut->WriteStr(pTag);
    numStr = "*";
    numStr.AppendInt(tagNum);
    if (result)
      result = m_pOut->WriteStr(numStr.get());
    if (wasTrans && result)
      result = m_pOut->WriteStr("*=");
    else if (result)
      result = m_pOut->WriteStr("=\"");
    if (result)
      result = m_pOut->WriteData(((const uint8_t *)fName.get()) + idx, len);
    if (wasTrans && result)
      result = m_pOut->WriteStr("\x0D\x0A");
    else if (result)
      result = m_pOut->WriteStr("\"\x0D\x0A");
    idx += len;
    tagNum++;
  }

  if (idx) {
    if ((fName.Length() - idx) > 0) {
      if (result)
        result = m_pOut->WriteStr("\x09");
      if (result)
        result = m_pOut->WriteStr(pTag);
      numStr = "*";
      numStr.AppendInt(tagNum);
      if (result)
        result = m_pOut->WriteStr(numStr.get());
      if (wasTrans && result)
        result = m_pOut->WriteStr("*=");
      else if (result)
        result = m_pOut->WriteStr("=\"");
      if (result)
        result = m_pOut->WriteData(((const uint8_t *)fName.get()) + idx, fName.Length() - idx);
      if (wasTrans && result)
        result = m_pOut->WriteStr("\x0D\x0A");
      else if (result)
        result = m_pOut->WriteStr("\"\x0D\x0A");
    }
  }
  else {
    if (result)
      result = m_pOut->WriteStr("\x09");
    if (result)
      result = m_pOut->WriteStr(pTag);
    if (wasTrans && result)
      result = m_pOut->WriteStr("*=");
    else if (result)
      result = m_pOut->WriteStr("=\"");
    if (result)
      result = m_pOut->WriteStr(fName.get());
    if (wasTrans && result)
      result = m_pOut->WriteStr("\x0D\x0A");
    else if (result)
      result = m_pOut->WriteStr("\"\x0D\x0A");
  }

  return result;

}


//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
nsIImportMimeEncodeImpl::nsIImportMimeEncodeImpl()
{
  m_pOut = nullptr;
  m_pEncode = nullptr;
}

nsIImportMimeEncodeImpl::~nsIImportMimeEncodeImpl()
{
  if (m_pOut)
    delete m_pOut;
  if (m_pEncode)
    delete m_pEncode;
}

NS_IMPL_ISUPPORTS1(nsIImportMimeEncodeImpl, nsIImportMimeEncode)

NS_METHOD nsIImportMimeEncodeImpl::EncodeFile(nsIFile *inFile, nsIFile *outFile, const char *fileName, const char *mimeType)
{
  return Initialize(inFile, outFile, fileName, mimeType);
}

NS_METHOD nsIImportMimeEncodeImpl::DoWork(bool *done, bool *_retval)
{
  if (done && _retval && m_pEncode) {
    *_retval = m_pEncode->DoWork(done);
    return NS_OK;
  }
  return NS_ERROR_FAILURE;
}

NS_METHOD nsIImportMimeEncodeImpl::NumBytesProcessed(int32_t *_retval)
{
  if (m_pEncode && _retval)
    *_retval = m_pEncode->NumBytesProcessed();
  return NS_OK;
}

NS_METHOD nsIImportMimeEncodeImpl::DoEncoding(bool *_retval)
{
  if (_retval && m_pEncode) {
    bool    done = false;
    while (m_pEncode->DoWork(&done) && !done);
    *_retval = done;
    return NS_OK;
  }
  return NS_ERROR_FAILURE;
}

NS_METHOD nsIImportMimeEncodeImpl::Initialize(nsIFile *inFile, nsIFile *outFile, const char *fileName, const char *mimeType)
{
  delete m_pEncode;
  delete m_pOut;

  m_pOut = new ImportOutFile();
  m_pOut->InitOutFile(outFile);

  m_pEncode = new nsImportMimeEncode();
  m_pEncode->EncodeFile(inFile, m_pOut, fileName, mimeType);

  return NS_OK;
}

