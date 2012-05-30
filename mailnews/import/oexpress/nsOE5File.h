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

  static bool    ReadIndex(nsIInputStream *pFile, PRUint32 **ppIndex, PRUint32 *pSize);

  static nsresult ImportMailbox(PRUint32 *pBytesDone, bool *pAbort,
                                nsString& name, nsIFile *inFile,
                                nsIMsgFolder *pDstFolder, PRUint32 *pCount);

  static void FileTimeToPRTime(const FILETIME *filetime, PRTime *prtm);

private:
  typedef struct {
    PRUint32 *  pIndex;
    PRUint32  count;
    PRUint32  alloc;
  } PRUint32Array;

  static const char *m_pFromLineSep;

  static bool    ReadBytes(nsIInputStream *stream, void *pBuffer, PRUint32 offset, PRUint32 bytes);
  static PRUint32 ReadMsgIndex(nsIInputStream *file, PRUint32 offset, PRUint32Array *pArray);
  static void  ConvertIndex(nsIInputStream *pFile, char *pBuffer, PRUint32 *pIndex,
                            PRUint32 size, PRUint32 *pFlags, PRUint64 *pTime);
  static bool    IsFromLine(char *pLine, PRUint32 len);


};



#endif /* nsOE5File_h___ */
