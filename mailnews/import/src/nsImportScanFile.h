/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImportScanFile_h__
#define nsImportScanFile_h__
#include "nsCOMPtr.h"
#include "nsIInputStream.h"

class nsImportScanFile {
public:
  nsImportScanFile();
  virtual ~nsImportScanFile();

  void  InitScan(nsIInputStream *pInputStream, PRUint8 * pBuf, PRUint32 sz);

  void  CleanUpScan(void);

  virtual  bool    Scan(bool *pDone);

protected:
  void      ShiftBuffer(void);
  bool        FillBufferFromFile(void);
  virtual bool    ScanBuffer(bool *pDone);

protected:
  nsCOMPtr <nsIInputStream> m_pInputStream;
  PRUint8 *    m_pBuf;
  PRUint32    m_bufSz;
  PRUint32    m_bytesInBuf;
  PRUint32    m_pos;
  bool        m_eof;
  bool        m_allocated;
};

class nsImportScanFileLines : public nsImportScanFile {
public:
  nsImportScanFileLines() {m_needEol = false;}

  void  ResetLineScan(void) { m_needEol = false;}

  virtual bool ProcessLine(PRUint8 * /* pLine */, PRUint32 /* len */, bool * /* pDone */) {return true;}

protected:
  virtual bool    ScanBuffer(bool *pDone);

  bool    m_needEol;

};


#endif /* nsImportScanFile_h__ */
