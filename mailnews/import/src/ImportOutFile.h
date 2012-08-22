/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef ImportOutFile_h___
#define ImportOutFile_h___

#include "nsImportTranslator.h"
#include "nsIOutputStream.h"
#include "nsIFile.h"

#define kMaxMarkers    10

class ImportOutFile;

class ImportOutFile {
public:
  ImportOutFile();
  ImportOutFile(nsIFile *pFile, uint8_t * pBuf, uint32_t sz);
  ~ImportOutFile();

  bool    InitOutFile(nsIFile *pFile, uint32_t bufSz = 4096);
  void  InitOutFile(nsIFile *pFile, uint8_t * pBuf, uint32_t sz);
  inline bool    WriteData(const uint8_t * pSrc, uint32_t len);
  inline bool    WriteByte(uint8_t byte);
  bool    WriteStr(const char *pStr) {return WriteU8NullTerm((const uint8_t *) pStr, false); }
  bool    WriteU8NullTerm(const uint8_t * pSrc, bool includeNull);
  bool    WriteEol(void) { return WriteStr("\x0D\x0A"); }
  bool    Done(void) {return Flush();}

  // Marker support
  bool    SetMarker(int markerID);
  void  ClearMarker(int markerID);
  bool    WriteStrAtMarker(int markerID, const char *pStr);

  // 8-bit to 7-bit translation
  bool    Set8bitTranslator(nsImportTranslator *pTrans);
  bool    End8bitTranslation(bool *pEngaged, nsCString& useCharset, nsCString& encoding);

protected:
  bool    Flush(void);

protected:
  nsCOMPtr <nsIFile>      m_pFile;
        nsCOMPtr <nsIOutputStream> m_outputStream;
  uint8_t *    m_pBuf;
  uint32_t    m_bufSz;
  uint32_t    m_pos;
  bool        m_ownsFileAndBuffer;

  // markers
  uint32_t    m_markers[kMaxMarkers];

  // 8 bit to 7 bit translations
  nsImportTranslator  *  m_pTrans;
  bool            m_engaged;
  bool            m_supports8to7;
  ImportOutFile *      m_pTransOut;
  uint8_t *        m_pTransBuf;
};

inline bool    ImportOutFile::WriteData(const uint8_t * pSrc, uint32_t len) {
  while ((len + m_pos) > m_bufSz) {
    if ((m_bufSz - m_pos)) {
      memcpy(m_pBuf + m_pos, pSrc, m_bufSz - m_pos);
      len -= (m_bufSz - m_pos);
      pSrc += (m_bufSz - m_pos);
      m_pos = m_bufSz;
    }
    if (!Flush())
      return false;
  }

  if (len) {
    memcpy(m_pBuf + m_pos, pSrc, len);
    m_pos += len;
  }

  return true;
}

inline bool    ImportOutFile::WriteByte(uint8_t byte) {
  if (m_pos == m_bufSz) {
    if (!Flush())
      return false;
  }
  *(m_pBuf + m_pos) = byte;
  m_pos++;
  return true;
}

#endif /* ImportOutFile_h__ */


