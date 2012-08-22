/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsImportEncodeScan.h"
#include "nsNetUtil.h"

#define  kBeginAppleSingle    0
#define  kBeginDataFork      1
#define  kBeginResourceFork    2
#define  kAddEntries        3
#define  kScanningDataFork    4
#define  kScanningRsrcFork    5
#define  kDoneWithFile      6

uint32_t  gAppleSingleHeader[6] = {0x00051600, 0x00020000, 0, 0, 0, 0};
#define kAppleSingleHeaderSize  (6 * sizeof(uint32_t))

#ifdef _MAC_IMPORT_CODE
#include "MoreFilesExtras.h"
#include "MoreDesktopMgr.h"

CInfoPBRec  gCatInfoPB;
U32      g2000Secs = 0;
long    gGMTDelta = 0;

long GetGmtDelta(void);
U32 Get2000Secs(void);


long GetGmtDelta(void)
{
  MachineLocation myLocation;
  ReadLocation(&myLocation);
  long  myDelta = BitAnd(myLocation.u.gmtDelta, 0x00FFFFFF);
  if (BitTst(&myDelta, 23))
    myDelta = BitOr(myDelta, 0xFF000000);
  return myDelta;
}

U32 Get2000Secs(void)
{
  DateTimeRec  dr;
  dr.year = 2000;
  dr.month = 1;
  dr.day = 1;
  dr.hour = 0;
  dr.minute = 0;
  dr.second = 0;
  dr.dayOfWeek = 0;
  U32  result;
  DateToSeconds(&dr, &result);
  return result;
}
#endif

nsImportEncodeScan::nsImportEncodeScan()
{
  m_isAppleSingle = false;
  m_encodeScanState = 0;
  m_resourceForkSize = 0;
  m_dataForkSize = 0;
}

nsImportEncodeScan::~nsImportEncodeScan()
{
}

bool nsImportEncodeScan::InitEncodeScan(bool appleSingleEncode, nsIFile *fileLoc, const char *pName, uint8_t * pBuf, uint32_t sz)
{
  CleanUpEncodeScan();
  m_isAppleSingle = appleSingleEncode;
  m_encodeScanState = kBeginAppleSingle;
  m_pInputFile = do_QueryInterface(fileLoc);
  m_useFileName = pName;
  m_pBuf = pBuf;
  m_bufSz = sz;
  if (!m_isAppleSingle)
        {
    if (!m_inputStream)
                {
                  nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(m_inputStream), m_pInputFile);
                  NS_ENSURE_SUCCESS(rv, false);
    }

    InitScan(m_inputStream, pBuf, sz);
  }
  else {
  #ifdef _MAC_IMPORT_CODE
    // Fill in the file sizes
    m_resourceForkSize = fileLoc.GetMacFileSize(UFileLocation::eResourceFork);
    m_dataForkSize = fileLoc.GetMacFileSize(UFileLocation::eDataFork);
  #endif
  }

  return true;
}

void nsImportEncodeScan::CleanUpEncodeScan(void)
{
  m_pInputStream->Close();
  m_pInputStream = nullptr;
  m_pInputFile = nullptr;
}


// 26 + 12 per entry

void nsImportEncodeScan::FillInEntries(int numEntries)
{
#ifdef _MAC_IMPORT_CODE
  int    len = m_useFileName.GetLength();
  if (len < 32)
    len = 32;
  long  entry[3];
  long  fileOffset = 26 + (12 * numEntries);
  entry[0] = 3;
  entry[1] = fileOffset;
  entry[2] = m_useFileName.GetLength();
  fileOffset += len;
  MemCpy(m_pBuf + m_bytesInBuf, entry, 12);
  m_bytesInBuf += 12;


  Str255  comment;
  comment[0] = 0;
  OSErr err = FSpDTGetComment(m_inputFileLoc, comment);
  if (comment[0] > 200)
    comment[0] = 200;
  entry[0] = 4;
  entry[1] = fileOffset;
  entry[2] = comment[0];
  fileOffset += 200;
  MemCpy(m_pBuf + m_bytesInBuf, entry, 12);
  m_bytesInBuf += 12;


  entry[0] = 8;
  entry[1] = fileOffset;
  entry[2] = 16;
  fileOffset += 16;
  MemCpy(m_pBuf + m_bytesInBuf, entry, 12);
  m_bytesInBuf += 12;

  entry[0] = 9;
  entry[1] = fileOffset;
  entry[2] = 32;
  fileOffset += 32;
  MemCpy(m_pBuf + m_bytesInBuf, entry, 12);
  m_bytesInBuf += 12;


  entry[0] = 10;
  entry[1] = fileOffset;
  entry[2] = 4;
  fileOffset += 4;
  MemCpy(m_pBuf + m_bytesInBuf, entry, 12);
  m_bytesInBuf += 12;

  if (m_resourceForkSize) {
    entry[0] = 2;
    entry[1] = fileOffset;
    entry[2] = m_resourceForkSize;
    fileOffset += m_resourceForkSize;
    MemCpy(m_pBuf + m_bytesInBuf, entry, 12);
    m_bytesInBuf += 12;
  }

  if (m_dataForkSize) {
    entry[0] = 1;
    entry[1] = fileOffset;
    entry[2] = m_dataForkSize;
    fileOffset += m_dataForkSize;
    MemCpy(m_pBuf + m_bytesInBuf, entry, 12);
    m_bytesInBuf += 12;
  }

#endif
}

bool nsImportEncodeScan::AddEntries(void)
{
#ifdef _MAC_IMPORT_CODE
  if (!g2000Secs) {
    g2000Secs = Get2000Secs();
    gGMTDelta = GetGmtDelta();
  }
  MemCpy(m_pBuf + m_bytesInBuf, (PC_S8) m_useFileName, m_useFileName.GetLength());
  m_bytesInBuf += m_useFileName.GetLength();
  if (m_useFileName.GetLength() < 32) {
    int len = m_useFileName.GetLength();
    while (len < 32) {
      *((P_S8)m_pBuf + m_bytesInBuf) = 0;
      m_bytesInBuf++;
      len++;
    }
  }

  Str255  comment;
  comment[0] = 0;
  OSErr err = FSpDTGetComment(m_inputFileLoc, comment);
  comment[0] = 200;
  MemCpy(m_pBuf + m_bytesInBuf, &(comment[1]), comment[0]);
  m_bytesInBuf += comment[0];

  long  dates[4];
  dates[0] = gCatInfoPB.hFileInfo.ioFlCrDat;
  dates[1] = gCatInfoPB.hFileInfo.ioFlMdDat;
  dates[2] = gCatInfoPB.hFileInfo.ioFlBkDat;
  dates[3] = 0x80000000;
  for (short i = 0; i < 3; i++) {
    dates[i] -= g2000Secs;
    dates[i] += gGMTDelta;
  }
  MemCpy(m_pBuf + m_bytesInBuf, dates, 16);
  m_bytesInBuf += 16;


  FInfo  fInfo = gCatInfoPB.hFileInfo.ioFlFndrInfo;
  FXInfo  fxInfo = gCatInfoPB.hFileInfo.ioFlXFndrInfo;
  fInfo.fdFlags = 0;
  fInfo.fdLocation.h = 0;
  fInfo.fdLocation.v = 0;
  fInfo.fdFldr = 0;
  MemSet(&fxInfo, 0, sizeof(fxInfo));
  MemCpy(m_pBuf + m_bytesInBuf, &fInfo, 16);
  m_bytesInBuf += 16;
  MemCpy(m_pBuf + m_bytesInBuf, &fxInfo, 16);
  m_bytesInBuf += 16;


  dates[0] = 0;
  if ((gCatInfoPB.hFileInfo.ioFlAttrib & 1) != 0)
    dates[0] |= 1;
  MemCpy(m_pBuf + m_bytesInBuf, dates, 4);
  m_bytesInBuf += 4;


#endif
  return true;
}

bool nsImportEncodeScan::Scan(bool *pDone)
{
  nsresult  rv;

  *pDone = false;
  if (m_isAppleSingle) {
    // Stuff the buffer with things needed to encode the file...
    // then just allow UScanFile to handle each fork, but be careful
    // when handling eof.
    switch(m_encodeScanState) {
      case kBeginAppleSingle: {
#ifdef _MAC_IMPORT_CODE
        OSErr err = GetCatInfoNoName(m_inputFileLoc.GetVRefNum(), m_inputFileLoc.GetParID(), m_inputFileLoc.GetFileNamePtr(), &gCatInfoPB);
        if (err != noErr)
          return FALSE;
#endif
        m_eof = false;
        m_pos = 0;
        memcpy(m_pBuf, gAppleSingleHeader, kAppleSingleHeaderSize);
        m_bytesInBuf = kAppleSingleHeaderSize;
        int numEntries = 5;
        if (m_dataForkSize)
          numEntries++;
        if (m_resourceForkSize)
          numEntries++;
        memcpy(m_pBuf + m_bytesInBuf, &numEntries, sizeof(numEntries));
        m_bytesInBuf += sizeof(numEntries);
        FillInEntries(numEntries);
        m_encodeScanState = kAddEntries;
        return ScanBuffer(pDone);
      }
      break;

      case kBeginDataFork: {
        if (!m_dataForkSize) {
          m_encodeScanState = kDoneWithFile;
          return true;
        }
        // Initialize the scan of the data fork...
        if (!m_inputStream)
                                {
                                  rv = NS_NewLocalFileInputStream(getter_AddRefs(m_inputStream), m_pInputFile);
                                  NS_ENSURE_SUCCESS(rv, false);
                                }
        m_encodeScanState = kScanningDataFork;
        return true;
      }
      break;

      case kScanningDataFork: {
        bool result = FillBufferFromFile();
        if (!result)
          return false;
        if (m_eof) {
          m_eof = false;
          result = ScanBuffer(pDone);
          if (!result)
            return false;
          m_inputStream->Close();
                                        m_inputStream = nullptr;
          m_encodeScanState = kDoneWithFile;
          return true;
        }
        else
          return ScanBuffer(pDone);
      }
      break;

      case kScanningRsrcFork: {
        bool result = FillBufferFromFile();
        if (!result)
          return false;
        if (m_eof) {
          m_eof = false;
          result = ScanBuffer(pDone);
          if (!result)
            return false;
          m_inputStream->Close();
                                        m_inputStream = nullptr;
          m_encodeScanState = kBeginDataFork;
          return true;
        }
        else
          return ScanBuffer(pDone);
      }
      break;

      case kBeginResourceFork: {
        if (!m_resourceForkSize) {
          m_encodeScanState = kBeginDataFork;
          return true;
        }
        /*
        // FIXME: Open the resource fork on the Mac!!!
        m_fH = UFile::OpenRsrcFileRead(m_inputFileLoc);
        if (m_fH == TR_FILE_ERROR)
          return FALSE;
        */
        m_encodeScanState = kScanningRsrcFork;
        return true;
      }
      break;

      case kAddEntries: {
        ShiftBuffer();
        if (!AddEntries())
          return false;
        m_encodeScanState = kBeginResourceFork;
        return ScanBuffer(pDone);
      }
      break;

      case kDoneWithFile: {
        ShiftBuffer();
        m_eof = true;
        if (!ScanBuffer(pDone))
          return false;
        *pDone = true;
        return true;
      }
      break;
    }

  }
  else
    return nsImportScanFile::Scan(pDone);

  return false;
}

