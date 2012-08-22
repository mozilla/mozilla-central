/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsIFile.h"
#include "nsImportScanFile.h"
#include "ImportCharSet.h"

nsImportScanFile::nsImportScanFile()
{
  m_allocated = false;
  m_eof = false;
  m_pBuf = nullptr;
}

nsImportScanFile::~nsImportScanFile()
{
  if (m_allocated)
    CleanUpScan();
}

void nsImportScanFile::InitScan(nsIInputStream *pInputStream, uint8_t * pBuf, uint32_t sz)
{
  m_pInputStream = pInputStream;
  m_pBuf = pBuf;
  m_bufSz = sz;
  m_bytesInBuf = 0;
  m_pos = 0;
}

void nsImportScanFile::CleanUpScan(void)
{
  m_pInputStream = nullptr;
  if (m_allocated) {
    delete [] m_pBuf;
    m_pBuf = NULL;
  }
}

void nsImportScanFile::ShiftBuffer(void)
{
  uint8_t *  pTop;
  uint8_t *  pCurrent;

  if (m_pos < m_bytesInBuf) {
    pTop = m_pBuf;
    pCurrent = pTop + m_pos;
    uint32_t    cnt = m_bytesInBuf - m_pos;
    while (cnt) {
      *pTop = *pCurrent;
      pTop++; pCurrent++;
      cnt--;
    }
  }

  m_bytesInBuf -= m_pos;
  m_pos = 0;
}

bool nsImportScanFile::FillBufferFromFile(void)
{
  uint64_t available;
  nsresult rv = m_pInputStream->Available(&available);
  if (NS_FAILED(rv))
    return false;

  // Fill up a buffer and scan it
  ShiftBuffer();

  // Read in some more bytes
  uint32_t  cnt = m_bufSz - m_bytesInBuf;
  // To distinguish from disk errors
  // Check first for end of file?
  // Set a done flag if true...
  uint32_t read;
  char *pBuf = (char *)m_pBuf;
  pBuf += m_bytesInBuf;
  rv = m_pInputStream->Read(pBuf, (int32_t) cnt, &read);

  if (NS_FAILED(rv))
    return false;
  rv = m_pInputStream->Available(&available);
  if (NS_FAILED(rv))
          m_eof = true;

  m_bytesInBuf += cnt;
  return true;
}

bool nsImportScanFile::Scan(bool *pDone)
{
  uint64_t available;
  nsresult rv = m_pInputStream->Available(&available);
  if (NS_FAILED(rv))
        {
    if (m_pos < m_bytesInBuf)
      ScanBuffer(pDone);
    *pDone = true;
    return true;
  }

  // Fill up a buffer and scan it
  if (!FillBufferFromFile())
    return false;

  return ScanBuffer(pDone);
}

bool nsImportScanFile::ScanBuffer(bool *)
{
  return true;
}


bool nsImportScanFileLines::ScanBuffer(bool *pDone)
{
  // m_pos, m_bytesInBuf, m_eof, m_pBuf are relevant

  uint32_t    pos = m_pos;
  uint32_t    max = m_bytesInBuf;
  uint8_t *    pChar = m_pBuf + pos;
  uint32_t    startPos;

  while (pos < max) {
    if (m_needEol) {
      // Find the next eol...
      while ((pos < max) && (*pChar != ImportCharSet::cCRChar) && (*pChar != ImportCharSet::cLinefeedChar)) {
        pos++;
        pChar++;
      }
      m_pos = pos;
      if (pos < max)
        m_needEol = false;
      if (pos == max) // need more buffer for an end of line
        break;
    }
    // Skip past any eol characters
    while ((pos < max) && ((*pChar == ImportCharSet::cCRChar) || (*pChar == ImportCharSet::cLinefeedChar))) {
      pos++;
      pChar++;
    }
    m_pos = pos;
    if (pos == max)
      break;
    // Make sure we can find either the eof or the
    // next end of line
    startPos = pos;
    while ((pos < max) && (*pChar != ImportCharSet::cCRChar) && (*pChar != ImportCharSet::cLinefeedChar)) {
      pos++;
      pChar++;
    }

    // Is line too big for our buffer?
    if ((pos == max) && !m_eof) {
      if (!m_pos) { // line too big for our buffer
        m_pos = pos;
        m_needEol = true;
      }
      break;
    }

    if (!ProcessLine(m_pBuf + startPos, pos - startPos, pDone)) {
      return false;
    }
    m_pos = pos;
  }

  return true;
}

