/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsStringGlue.h"
#include "prio.h"
#include "nsNetUtil.h"
#include "nsISeekableStream.h"
#include "nsMsgUtils.h"
#include "ImportOutFile.h"
#include "ImportCharSet.h"

#include "ImportDebug.h"

/*
#ifdef _MAC
#define  kMacNoCreator    '????'
#define kMacTextFile    'TEXT'
#else
#define  kMacNoCreator    0
#define kMacTextFile    0
#endif
*/

ImportOutFile::ImportOutFile()
{
  m_ownsFileAndBuffer = false;
  m_pos = 0;
  m_pBuf = nullptr;
  m_bufSz = 0;
  m_pTrans = nullptr;
  m_pTransOut = nullptr;
  m_pTransBuf = nullptr;
}

ImportOutFile::ImportOutFile(nsIFile *pFile, uint8_t * pBuf, uint32_t sz)
{
  m_pTransBuf = nullptr;
  m_pTransOut = nullptr;
  m_pTrans = nullptr;
  m_ownsFileAndBuffer = false;
  InitOutFile(pFile, pBuf, sz);
}

ImportOutFile::~ImportOutFile()
{
  if (m_ownsFileAndBuffer)
  {
    Flush();
    delete [] m_pBuf;
  }

  delete m_pTrans;
  delete m_pTransOut;
  delete m_pTransBuf;
}

bool ImportOutFile::Set8bitTranslator(nsImportTranslator *pTrans)
{
  if (!Flush())
    return false;

  m_engaged = false;
  m_pTrans = pTrans;
  m_supports8to7 = pTrans->Supports8bitEncoding();


  return true;
}

bool ImportOutFile::End8bitTranslation(bool *pEngaged, nsCString& useCharset, nsCString& encoding)
{
  if (!m_pTrans)
    return false;


  bool bResult = Flush();
  if (m_supports8to7 && m_pTransOut) {
    if (bResult)
      bResult = m_pTrans->FinishConvertToFile(m_pTransOut);
    if (bResult)
      bResult = Flush();
  }

  if (m_supports8to7) {
    m_pTrans->GetCharset(useCharset);
    m_pTrans->GetEncoding(encoding);
  }
  else
    useCharset.Truncate();
  *pEngaged = m_engaged;
  delete m_pTrans;
  m_pTrans = nullptr;
  delete m_pTransOut;
  m_pTransOut = nullptr;
  delete m_pTransBuf;
  m_pTransBuf = nullptr;

  return bResult;
}

bool ImportOutFile::InitOutFile(nsIFile *pFile, uint32_t bufSz)
{
  if (!bufSz)
    bufSz = 32 * 1024;
  if (!m_pBuf)
    m_pBuf = new uint8_t[ bufSz];

  if (!m_outputStream)
  {
    nsresult rv;
    rv = MsgNewBufferedFileOutputStream(getter_AddRefs(m_outputStream),
                                        pFile,
                                        PR_CREATE_FILE | PR_WRONLY | PR_TRUNCATE,
                                        0644);

    if (NS_FAILED(rv))
    {
      IMPORT_LOG0("Couldn't create outfile\n");
      delete [] m_pBuf;
      m_pBuf = nullptr;
      return false;
    }
  }
  m_pFile = pFile;
  m_ownsFileAndBuffer = true;
  m_pos = 0;
  m_bufSz = bufSz;
  return true;
}

void ImportOutFile::InitOutFile(nsIFile *pFile, uint8_t * pBuf, uint32_t sz)
{
  m_ownsFileAndBuffer = false;
  m_pFile = pFile;
  m_pBuf = pBuf;
  m_bufSz = sz;
  m_pos = 0;
}



bool ImportOutFile::Flush(void)
{
  if (!m_pos)
    return true;

  uint32_t  transLen;
  bool      duddleyDoWrite = false;

  // handle translations if appropriate
  if (m_pTrans) {
    if (m_engaged && m_supports8to7) {
      // Markers can get confused by this crap!!!
      // TLR: FIXME: Need to update the markers based on
      // the difference between the translated len and untranslated len

      if (!m_pTrans->ConvertToFile( m_pBuf, m_pos, m_pTransOut, &transLen))
        return false;
      if (!m_pTransOut->Flush())
        return false;
      // now update our buffer...
      if (transLen < m_pos) {
        memcpy(m_pBuf, m_pBuf + transLen, m_pos - transLen);
      }
      m_pos -= transLen;
    }
    else if (m_engaged) {
      // does not actually support translation!
      duddleyDoWrite = true;
    }
    else {
      // should we engage?
      uint8_t *  pChar = m_pBuf;
      uint32_t  len = m_pos;
      while (len) {
        if (!ImportCharSet::IsUSAscii(*pChar))
          break;
        pChar++;
        len--;
      }
      if (len) {
        m_engaged = true;
        if (m_supports8to7) {
          // allocate our translation output buffer and file...
          m_pTransBuf = new uint8_t[m_bufSz];
          m_pTransOut = new ImportOutFile(m_pFile, m_pTransBuf, m_bufSz);
          return Flush();
        }
        else
          duddleyDoWrite = true;
      }
      else {
        duddleyDoWrite = true;
      }
    }
  }
  else
    duddleyDoWrite = true;

  if (duddleyDoWrite) {
    uint32_t written = 0;
    nsresult rv = m_outputStream->Write((const char *)m_pBuf, (int32_t)m_pos, &written);
    if (NS_FAILED(rv) || ((uint32_t)written != m_pos))
      return false;
    m_pos = 0;
  }

  return true;
}

bool ImportOutFile::WriteU8NullTerm(const uint8_t * pSrc, bool includeNull)
{
  while (*pSrc) {
    if (m_pos >= m_bufSz) {
      if (!Flush())
        return false;
    }
    *(m_pBuf + m_pos) = *pSrc;
    m_pos++;
    pSrc++;
  }
  if (includeNull) {
    if (m_pos >= m_bufSz) {
      if (!Flush())
        return false;
    }
    *(m_pBuf + m_pos) = 0;
    m_pos++;
  }

  return true;
}

bool ImportOutFile::SetMarker(int markerID)
{
  if (!Flush()) {
    return false;
  }

  if (markerID < kMaxMarkers) {
    int64_t pos = 0;
    if (m_outputStream)
                {
                  // do we need to flush for the seek to give us the right pos?
                  m_outputStream->Flush();
                  nsresult rv;
                  nsCOMPtr <nsISeekableStream> seekStream = do_QueryInterface(m_outputStream, &rv);
                  NS_ENSURE_SUCCESS(rv, false);
      rv = seekStream->Tell(&pos);
      if (NS_FAILED(rv)) {
        IMPORT_LOG0("*** Error, Tell failed on output stream\n");
        return false;
      }
    }
    m_markers[markerID] = (uint32_t)pos + m_pos;
  }

  return true;
}

void ImportOutFile::ClearMarker(int markerID)
{
  if (markerID < kMaxMarkers)
    m_markers[markerID] = 0;
}

bool ImportOutFile::WriteStrAtMarker(int markerID, const char *pStr)
{
  if (markerID >= kMaxMarkers)
    return false;

  if (!Flush())
    return false;
  int64_t    pos;
        m_outputStream->Flush();
        nsresult rv;
        nsCOMPtr <nsISeekableStream> seekStream = do_QueryInterface(m_outputStream, &rv);
        NS_ENSURE_SUCCESS(rv, false);
  rv = seekStream->Tell(&pos);
  if (NS_FAILED(rv))
    return false;
  rv = seekStream->Seek(nsISeekableStream::NS_SEEK_SET, (int32_t) m_markers[markerID]);
  if (NS_FAILED(rv))
    return false;
  uint32_t written;
  rv = m_outputStream->Write(pStr, strlen(pStr), &written);
  if (NS_FAILED(rv))
    return false;

  rv = seekStream->Seek(nsISeekableStream::NS_SEEK_SET, pos);
  if (NS_FAILED(rv))
    return false;

  return true;
}

