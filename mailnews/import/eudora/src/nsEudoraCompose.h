/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraCompose_h__
#define nsEudoraCompose_h__

#include "nscore.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsMsgUtils.h"
#include "nsIFile.h"
#include "nsIInputStream.h"
#include "nsVoidArray.h"
#include "nsIImportService.h"

#ifdef MOZILLA_INTERNAL_API
#include "nsNativeCharsetUtils.h"
#else
#include "nsMsgI18N.h"
#define NS_CopyNativeToUnicode(source, dest) \
        nsMsgI18NConvertToUnicode(nsMsgI18NFileSystemCharset(), source, dest)
#endif

class nsIMsgSend;
class nsIMsgCompFields;
class nsIMsgIdentity;
class nsIMsgSendListener;
class nsIIOService;

#include "nsIMsgSend.h"


typedef class {
public:
  nsCOMPtr <nsIFile>  pAttachment;
  char *      mimeType;
  char *      description;
} ImportAttachment;

typedef class {
public:
  uint32_t    offset;
  int64_t    size;
  nsCOMPtr <nsIFile>  pFile;
        nsCOMPtr <nsIInputStream> pInputStream;
} ReadFileState;

class SimpleBufferTonyRCopiedOnce {
public:
  SimpleBufferTonyRCopiedOnce() {m_pBuffer = nullptr; m_size = 0; m_growBy = 4096; m_writeOffset = 0;
          m_bytesInBuf = 0; m_convertCRs = false;}
  ~SimpleBufferTonyRCopiedOnce() { if (m_pBuffer) delete [] m_pBuffer;}

  bool Allocate(int32_t sz) {
    if (m_pBuffer)
      delete [] m_pBuffer;
    m_pBuffer = new char[sz];
    if (m_pBuffer) {
      m_size = sz;
      return true;
    }
    m_size = 0;
    return false;
  }

  bool Grow(int32_t newSize) { if (newSize > m_size) return ReAllocate(newSize); else return true;}
  bool ReAllocate(int32_t newSize) {
    if (newSize <= m_size) return true;
    char *pOldBuffer = m_pBuffer;
    int32_t  oldSize = m_size;
    m_pBuffer = nullptr;
    while (m_size < newSize) m_size += m_growBy;
    if (Allocate(m_size)) {
      if (pOldBuffer) { memcpy(m_pBuffer, pOldBuffer, oldSize); delete [] pOldBuffer;}
      return true;
    }
    else { m_pBuffer = pOldBuffer; m_size = oldSize; return false;}
  }

  bool Write(int32_t offset, const char *pData, int32_t len, int32_t *pWritten) {
    *pWritten = len;
    if (!len) return true;
    if (!Grow(offset + len)) return false;
    if (m_convertCRs)
      return SpecialMemCpy(offset, pData, len, pWritten);
    memcpy(m_pBuffer + offset, pData, len);
    return true;
  }

  bool Write(const char *pData, int32_t len) {
    int32_t written;
    if (Write(m_writeOffset, pData, len, &written)) { m_writeOffset += written; return true;}
    else return false;
  }

  bool    SpecialMemCpy(int32_t offset, const char *pData, int32_t len, int32_t *pWritten);

  bool    m_convertCRs;
  char *  m_pBuffer;
  uint32_t  m_bytesInBuf;  // used when reading into this buffer
  int32_t  m_size;      // allocated size of buffer
  int32_t  m_growBy;    // duh
  uint32_t m_writeOffset;  // used when writing into and reading from the buffer
};



class nsEudoraCompose {
public:
  nsEudoraCompose();
  ~nsEudoraCompose();

  nsresult  SendTheMessage(nsIFile *pMailImportLocation, nsIFile **pMsg);

  void    SetBody(const char *pBody, int32_t len, nsCString &bodyType) { m_pBody = pBody; m_bodyLen = len; m_bodyType = bodyType;}
  void    SetHeaders(const char *pHeaders, int32_t len) { m_pHeaders = pHeaders; m_headerLen = len;}
  void    SetAttachments(nsVoidArray *pAttachments) { m_pAttachments = pAttachments;}
  void    SetDefaultDate(nsCString date) { m_defaultDate = date;}

  nsresult  CopyComposedMessage(nsCString& fromLine, nsIFile *pSrc, nsIOutputStream *pDst, SimpleBufferTonyRCopiedOnce& copy);

  static nsresult  FillMailBuffer(ReadFileState *pState, SimpleBufferTonyRCopiedOnce& read);
  static nsresult CreateIdentity(void);
  static void    ReleaseIdentity(void);

private:
  nsresult  CreateComponents(void);

  void    GetNthHeader(const char *pData, int32_t dataLen, int32_t n, nsCString& header, nsCString& val, bool unwrap);
  void    GetHeaderValue(const char *pData, int32_t dataLen, const char *pHeader, nsCString& val, bool unwrap = true);
  void    GetHeaderValue(const char *pData, int32_t dataLen, const char *pHeader, nsString& val) {
    val.Truncate();
    nsCString  hVal;
    GetHeaderValue(pData, dataLen, pHeader, hVal, true);
    NS_CopyNativeToUnicode(hVal, val);
  }
  void    ExtractCharset(nsString& str);
  void    ExtractType(nsString& str);

  nsresult GetLocalAttachments(nsIArray **aArray);

  nsresult  ReadHeaders(ReadFileState *pState, SimpleBufferTonyRCopiedOnce& copy, SimpleBufferTonyRCopiedOnce& header);
  int32_t    FindNextEndLine(SimpleBufferTonyRCopiedOnce& data);
  int32_t    IsEndHeaders(SimpleBufferTonyRCopiedOnce& data);
  int32_t    IsSpecialHeader(const char *pHeader);
  nsresult  WriteHeaders(nsIOutputStream *pDst, SimpleBufferTonyRCopiedOnce& newHeaders);
  bool      IsReplaceHeader(const char *pHeader);

private:
  static nsIMsgIdentity *    s_pIdentity;

  nsVoidArray *      m_pAttachments;
  nsIMsgSendListener *  m_pListener;
  nsIMsgCompFields *    m_pMsgFields;
  nsCOMPtr<nsIIOService> m_pIOService;
  int32_t          m_headerLen;
  const char *      m_pHeaders;
  int32_t          m_bodyLen;
  const char *      m_pBody;
  nsCString        m_bodyType;
  nsString        m_defCharset;
  SimpleBufferTonyRCopiedOnce      m_readHeaders;
  nsCOMPtr<nsIImportService>  m_pImportService;
  nsCString       m_defaultDate;  // Use this if no Date: header in msgs
};


#endif /* nsEudoraCompose_h__ */
