/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImportEncodeScan_h___
#define nsImportEncodeScan_h___

#include "mozilla/Attributes.h"
#include "nsIFile.h"
#include "nsImportScanFile.h"
#include "nsStringGlue.h"

class nsImportEncodeScan : public nsImportScanFile {
public:
  nsImportEncodeScan();
  ~nsImportEncodeScan();

  bool    InitEncodeScan(bool appleSingleEncode, nsIFile *pFile, const char *pName, uint8_t * pBuf, uint32_t sz);
  void  CleanUpEncodeScan(void);

  virtual bool    Scan(bool *pDone) MOZ_OVERRIDE;

protected:
  void   FillInEntries(int numEntries);
  bool     AddEntries(void);

protected:
  bool        m_isAppleSingle;
  nsCOMPtr<nsIFile>   m_pInputFile;
        nsCOMPtr<nsIInputStream> m_inputStream;
  int      m_encodeScanState;
  long      m_resourceForkSize;
  long      m_dataForkSize;
  nsCString    m_useFileName;
};

#endif /* nsImportEncodeScan_h__ */

