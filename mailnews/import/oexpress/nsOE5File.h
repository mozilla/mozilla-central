/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOE5File_h___
#define nsOE5File_h___

#include "nsStringGlue.h"
#include "nsIFile.h"
#include "nsIMsgFolder.h"
#include <windows.h>

class nsIInputStream;

class nsOE5File
{
public:
    /* pFile must already be open for reading. */
  static bool    VerifyLocalMailFile(nsIFile *pFile);
    /* pFile must NOT be open for reading   */
  static bool    IsLocalMailFile(nsIFile *pFile);

  static bool    ReadIndex(nsIInputStream *pFile, uint32_t **ppIndex, uint32_t *pSize);

  static nsresult ImportMailbox(uint32_t *pBytesDone, bool *pAbort,
                                nsString& name, nsIFile *inFile,
                                nsIMsgFolder *pDstFolder, uint32_t *pCount);

  static void FileTimeToPRTime(const FILETIME *filetime, PRTime *prtm);

private:
  typedef struct {
    uint32_t *  pIndex;
    uint32_t  count;
    uint32_t  alloc;
  } PRUint32Array;

  static const char *m_pFromLineSep;

  static bool    ReadBytes(nsIInputStream *stream, void *pBuffer, uint32_t offset, uint32_t bytes);
  static uint32_t ReadMsgIndex(nsIInputStream *file, uint32_t offset, PRUint32Array *pArray);
  static void  ConvertIndex(nsIInputStream *pFile, char *pBuffer, uint32_t *pIndex,
                            uint32_t size, uint32_t *pFlags, uint64_t *pTime);
  static bool    IsFromLine(char *pLine, uint32_t len);


};



#endif /* nsOE5File_h___ */
