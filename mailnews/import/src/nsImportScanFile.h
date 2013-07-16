/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImportScanFile_h__
#define nsImportScanFile_h__
#include "mozilla/Attributes.h"
#include "nsCOMPtr.h"
#include "nsIInputStream.h"

class nsImportScanFile {
public:
  nsImportScanFile();
  virtual ~nsImportScanFile();

  void  InitScan(nsIInputStream *pInputStream, uint8_t * pBuf, uint32_t sz);

  void  CleanUpScan(void);

  virtual  bool    Scan(bool *pDone);

protected:
  void      ShiftBuffer(void);
  bool        FillBufferFromFile(void);
  virtual bool    ScanBuffer(bool *pDone);

protected:
  nsCOMPtr <nsIInputStream> m_pInputStream;
  uint8_t *    m_pBuf;
  uint32_t    m_bufSz;
  uint32_t    m_bytesInBuf;
  uint32_t    m_pos;
  bool        m_eof;
  bool        m_allocated;
};

class nsImportScanFileLines : public nsImportScanFile {
public:
  nsImportScanFileLines() {m_needEol = false;}

  void  ResetLineScan(void) { m_needEol = false;}

  virtual bool ProcessLine(uint8_t * /* pLine */, uint32_t /* len */, bool * /* pDone */) {return true;}

protected:
  virtual bool    ScanBuffer(bool *pDone) MOZ_OVERRIDE;

  bool    m_needEol;

};


#endif /* nsImportScanFile_h__ */
