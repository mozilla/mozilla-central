/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsOEMailbox.h"

#include "OEDebugLog.h"
#include "msgCore.h"
#include "prprf.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsCRT.h"
#include "nsNetUtil.h"
#include "nsIMsgFolder.h"
#include "nsIMsgHdr.h"
#include "nsIMsgPluggableStore.h"
#include "nsISeekableStream.h"
#include "nsMsgUtils.h"

class CMbxScanner {
public:
  CMbxScanner(nsString& name, nsIFile * mbxFile, nsIMsgFolder *dstFolder);
  ~CMbxScanner();

  virtual bool    Initialize(void);
  virtual bool    DoWork(bool *pAbort, uint32_t *pDone, uint32_t *pCount);

  bool      WasErrorFatal(void) { return m_fatalError;}
  uint32_t  BytesProcessed(void) { return m_didBytes;}

protected:
  bool    WriteMailItem(uint32_t flags, uint32_t offset, uint32_t size, uint32_t *pTotalMsgSize = nullptr);
  virtual void  CleanUp(void);

private:
  void  ReportWriteError(nsIMsgFolder *folder, bool fatal = true);
  void  ReportReadError(nsIFile * file, bool fatal = true);
  bool CopyMbxFileBytes(uint32_t flags, uint32_t numBytes);
  bool IsFromLineKey(uint8_t *pBuf, uint32_t max);

public:
  uint32_t      m_msgCount;

protected:
  uint32_t *    m_pDone;
  nsString      m_name;
  nsCOMPtr<nsIFile> m_mbxFile;
  nsCOMPtr<nsIMsgFolder> m_dstFolder;
  nsCOMPtr<nsIInputStream> m_mbxFileInputStream;
  nsCOMPtr<nsIOutputStream> m_dstOutputStream;
  nsCOMPtr<nsIMsgPluggableStore> m_msgStore;
  uint8_t *     m_pInBuffer;
  uint8_t *     m_pOutBuffer;
  uint32_t      m_bufSz;
  uint32_t      m_didBytes;
  bool          m_fatalError;
  int64_t      m_mbxFileSize;
  uint32_t      m_mbxOffset;

  static const char *  m_pFromLine;

};


class CIndexScanner : public CMbxScanner {
public:
  CIndexScanner(nsString& name, nsIFile * idxFile, nsIFile * mbxFile, nsIMsgFolder *dstFolder);
  ~CIndexScanner();

  virtual bool    Initialize(void);
  virtual bool    DoWork(bool *pAbort, uint32_t *pDone, uint32_t *pCount);

protected:
  virtual void    CleanUp(void);

private:
  bool            ValidateIdxFile(void);
  bool            GetMailItem(uint32_t *pFlags, uint32_t *pOffset, uint32_t *pSize);


private:
  nsCOMPtr <nsIFile>   m_idxFile;
  nsCOMPtr <nsIInputStream> m_idxFileInputStream;
  uint32_t        m_numMessages;
  uint32_t        m_idxOffset;
  uint32_t        m_curItemIndex;
};


bool CImportMailbox::ImportMailbox(uint32_t *pDone, bool *pAbort,
                                   nsString& name, nsIFile * inFile,
                                   nsIMsgFolder *outFolder, uint32_t *pCount)
{
  bool    done = false;
  nsresult rv;
  nsCOMPtr <nsIFile> idxFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv))
    rv  = idxFile->InitWithFile(inFile);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("New file spec failed!\n");
    return false;
  }

  if (GetIndexFile(idxFile)) {

    IMPORT_LOG1("Using index file for: %S\n", name.get());

    CIndexScanner *pIdxScanner = new CIndexScanner(name, idxFile, inFile, outFolder);
    if (pIdxScanner->Initialize()) {
      if (pIdxScanner->DoWork(pAbort, pDone, pCount)) {
        done = true;
      }
      else {
        IMPORT_LOG0("CIndexScanner::DoWork() failed\n");
      }
    }
    else {
      IMPORT_LOG0("CIndexScanner::Initialize() failed\n");
    }

    delete pIdxScanner;
  }

  if (done)
    return done;

    /*
    something went wrong with the index file, just scan the mailbox
    file itself.
  */
  CMbxScanner *pMbx = new CMbxScanner(name, inFile, outFolder);
  if (pMbx->Initialize()) {
    if (pMbx->DoWork(pAbort, pDone, pCount)) {
      done = true;
    }
    else {
      IMPORT_LOG0("CMbxScanner::DoWork() failed\n");
    }
  }
  else {
    IMPORT_LOG0("CMbxScanner::Initialize() failed\n");
  }

  delete pMbx;
  return done;
}


bool CImportMailbox::GetIndexFile(nsIFile* file)
{
  nsCString pLeaf;
  if (NS_FAILED(file->GetNativeLeafName(pLeaf)))
    return false;
  int32_t  len = pLeaf.Length();
  if (len < 5)
    return false;

  pLeaf.Replace(len - 3, 3, NS_LITERAL_CSTRING("idx"));

  IMPORT_LOG1("Looking for index leaf name: %s\n", pLeaf);

  nsresult  rv;
  rv = file->SetNativeLeafName(pLeaf);

  bool    isFile = false;
  bool    exists = false;
  if (NS_SUCCEEDED(rv)) rv = file->IsFile(&isFile);
  if (NS_SUCCEEDED(rv)) rv = file->Exists(&exists);

  return (isFile && exists);
}


const char *CMbxScanner::m_pFromLine = "From - Mon Jan 1 00:00:00 1965\x0D\x0A";
// let's try a 16K buffer and see how well that works?
#define  kBufferKB  16


CMbxScanner::CMbxScanner(nsString& name, nsIFile* mbxFile,
                         nsIMsgFolder* dstFolder)
{
  m_msgCount = 0;
  m_name = name;
  m_mbxFile = mbxFile;
  m_dstFolder = dstFolder;
  m_pInBuffer = nullptr;
  m_pOutBuffer = nullptr;
  m_bufSz = 0;
  m_fatalError = false;
  m_didBytes = 0;
  m_mbxFileSize = 0;
  m_mbxOffset = 0;
}

CMbxScanner::~CMbxScanner()
{
  CleanUp();
}

void CMbxScanner::ReportWriteError(nsIMsgFolder * folder, bool fatal)
{
  m_fatalError = fatal;
}

void CMbxScanner::ReportReadError(nsIFile * file, bool fatal)
{
  m_fatalError = fatal;
}

bool CMbxScanner::Initialize(void)
{
  m_bufSz = (kBufferKB * 1024);
  m_pInBuffer = new uint8_t[m_bufSz];
  m_pOutBuffer = new uint8_t[m_bufSz];
  if (!m_pInBuffer || !m_pOutBuffer) {
    return false;
  }

  m_mbxFile->GetFileSize(&m_mbxFileSize);
  // open the mailbox file...
  if (NS_FAILED(NS_NewLocalFileInputStream(getter_AddRefs(m_mbxFileInputStream), m_mbxFile))) {
    CleanUp();
    return false;
  }

  if (NS_FAILED(m_dstFolder->GetMsgStore(getter_AddRefs(m_msgStore)))) {
    CleanUp();
    return false;
  }

  return true;
}


#define  kMbxHeaderSize    0x0054
#define kMbxMessageHeaderSz  16

bool CMbxScanner::DoWork(bool *pAbort, uint32_t *pDone, uint32_t *pCount)
{
  m_mbxOffset = kMbxHeaderSize;
  m_didBytes = kMbxHeaderSize;

  while (!(*pAbort) && ((m_mbxOffset + kMbxMessageHeaderSz) < m_mbxFileSize)) {
    uint32_t    msgSz;
    if (!WriteMailItem(0, m_mbxOffset, 0, &msgSz)) {
      if (!WasErrorFatal())
        ReportReadError(m_mbxFile);
      return false;
    }
    m_mbxOffset += msgSz;
    m_didBytes += msgSz;
    m_msgCount++;
    if (pDone)
      *pDone = m_didBytes;
    if (pCount)
      *pCount = m_msgCount;
  }

  CleanUp();

  return true;
}


void CMbxScanner::CleanUp(void)
{
  if (m_mbxFileInputStream)
    m_mbxFileInputStream->Close();
  if (m_dstOutputStream)
    m_dstOutputStream->Close();

  delete [] m_pInBuffer;
  m_pInBuffer = nullptr;

  delete [] m_pOutBuffer;
  m_pOutBuffer = nullptr;
}


#define  kNumMbxLongsToRead  4

bool CMbxScanner::WriteMailItem(uint32_t flags, uint32_t offset, uint32_t size,
                                uint32_t *pTotalMsgSize)
{
  uint32_t  values[kNumMbxLongsToRead];
  int32_t    cnt = kNumMbxLongsToRead * sizeof(uint32_t);
  nsresult  rv;
  uint32_t    cntRead;
  int8_t *  pChar = (int8_t *) values;

  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(m_mbxFileInputStream);
  rv = seekableStream->Seek(nsISeekableStream::NS_SEEK_SET,  offset);

  if (NS_FAILED(rv)) {
    IMPORT_LOG1("Mbx seek error: 0x%lx\n", offset);
    return false;
  }
  rv = m_mbxFileInputStream->Read((char *) pChar, cnt, &cntRead);
  if (NS_FAILED(rv) || (cntRead != cnt)) {
    IMPORT_LOG1("Mbx read error at: 0x%lx\n", offset);
    return false;
  }
  if (values[0] != 0x7F007F00) {
    IMPORT_LOG2("Mbx tag field doesn't match: 0x%lx, at offset: 0x%lx\n", values[0], offset);
    return false;
  }
  if (size && (values[2] != size)) {
    IMPORT_LOG3("Mbx size doesn't match idx, mbx: %ld, idx: %ld, at offset: 0x%lx\n", values[2], size, offset);
    return false;
  }

  if (pTotalMsgSize != nullptr)
    *pTotalMsgSize = values[2];

  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  bool reusable;

  rv = m_msgStore->GetNewMsgOutputStream(m_dstFolder, getter_AddRefs(msgHdr), &reusable,
                                         getter_AddRefs(m_dstOutputStream));
  if (NS_FAILED(rv))
  {
    IMPORT_LOG1( "Mbx getting outputstream error: 0x%lx\n", rv);
    return false;
  }

  // everything looks kosher...
  // the actual message text follows and is values[3] bytes long...
  bool copyOK = CopyMbxFileBytes(flags,  values[3]);
  if (copyOK)
    m_msgStore->FinishNewMessage(m_dstOutputStream, msgHdr);
  else {
    m_msgStore->DiscardNewMessage(m_dstOutputStream, msgHdr);
    IMPORT_LOG0( "Mbx CopyMbxFileBytes failed\n");
  }
  if (!reusable)
  {
    m_dstOutputStream->Close();
    m_dstOutputStream = nullptr;
  }
  return copyOK;
}

bool CMbxScanner::IsFromLineKey(uint8_t * pBuf, uint32_t max)
{
  return (max > 5 && (pBuf[0] == 'F') && (pBuf[1] == 'r') && (pBuf[2] == 'o') && (pBuf[3] == 'm') && (pBuf[4] == ' '));
}


#define IS_ANY_SPACE(_ch) ((_ch == ' ') || (_ch == '\t') || (_ch == 10) || (_ch == 13))


bool CMbxScanner::CopyMbxFileBytes(uint32_t flags, uint32_t numBytes)
{
  if (!numBytes)
    return true;

  uint32_t  cnt;
  uint8_t   last[2] = {0, 0};
  uint32_t  inIdx = 0;
  bool      first = true;
  uint8_t * pIn;
  uint8_t * pStart;
  int32_t   fromLen = strlen(m_pFromLine);
  nsresult  rv;
  uint32_t   cntRead;
  uint8_t * pChar;

  while (numBytes) {
    if (numBytes > (m_bufSz - inIdx))
      cnt = m_bufSz - inIdx;
    else
      cnt = numBytes;
    // Read some of the message from the file...
    pChar = m_pInBuffer + inIdx;
    rv = m_mbxFileInputStream->Read((char *) pChar, (int32_t)cnt, &cntRead);
    if (NS_FAILED(rv) || (cntRead != (int32_t)cnt)) {
      ReportReadError(m_mbxFile);
      return false;
    }
    // Keep track of the last 2 bytes of the message for terminating EOL logic
    if (cnt < 2) {
      last[0] = last[1];
      last[1] = m_pInBuffer[cnt - 1];
    }
    else {
      last[0] = m_pInBuffer[cnt - 2];
      last[1] = m_pInBuffer[cnt - 1];
    }

    inIdx = 0;
    // Handle the beginning line, don't duplicate an existing From separator
    if (first) {
      // check the first buffer to see if it already starts with a From line
      // If it does, throw it away and use our own
      if (IsFromLineKey(m_pInBuffer, cnt)) {
        // skip past the first line
        while ((inIdx < cnt) && (m_pInBuffer[inIdx] != nsCRT::CR))
          inIdx++;
        while ((inIdx < cnt) && (IS_ANY_SPACE(m_pInBuffer[inIdx])))
          inIdx++;
        if (inIdx >= cnt) {
          // This should not occurr - it means the message starts
          // with a From separator line that is longer than our
          // file buffer!  In this bizarre case, just skip this message
          // since it is probably bogus anyway.
          return true;
        }

      }
      // Begin every message with a From separator
      rv = m_dstOutputStream->Write(m_pFromLine, fromLen, &cntRead);
      if (NS_FAILED(rv) || (cntRead != fromLen)) {
        ReportWriteError(m_dstFolder);
        return false;
      }
      char statusLine[50];
      uint32_t msgFlags = flags; // need to convert from OE flags to mozilla flags
      PR_snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF);
      rv = m_dstOutputStream->Write(statusLine, strlen(statusLine), &cntRead);
      if (NS_SUCCEEDED(rv) && cntRead == fromLen)
      {
        PR_snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS2_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF0000);
        rv = m_dstOutputStream->Write(statusLine, strlen(statusLine), &cntRead);
      }
      if (NS_FAILED(rv) || (cntRead != fromLen)) {
        ReportWriteError(m_dstFolder);
        return false;
      }
      first = false;
    }

    // Handle generic data, escape any lines that begin with "From "
    pIn = m_pInBuffer + inIdx;
    numBytes -= cnt;
    m_didBytes += cnt;
    pStart = pIn;
    cnt -= inIdx;
    inIdx = 0;
    while (cnt) {
      if (*pIn == nsCRT::CR) {
        // need more in buffer?
        if ((cnt < 7) && numBytes)
          break;

        if (cnt > 6) {
          if ((pIn[1] == nsCRT::LF) && IsFromLineKey(pIn + 2, cnt)) {
            inIdx += 2;
            // Match, escape it
            rv = m_dstOutputStream->Write((const char *)pStart, (int32_t)inIdx, &cntRead);
            if (NS_SUCCEEDED(rv) && (cntRead == (int32_t)inIdx))
              rv = m_dstOutputStream->Write(">", 1, &cntRead);
            if (NS_FAILED(rv) || (cntRead != 1)) {
              ReportWriteError(m_dstFolder);
              return false;
            }

            cnt -= 2;
            pIn += 2;
            inIdx = 0;
            pStart = pIn;
            continue;
          }
        }
      } // == nsCRT::CR

      cnt--;
      inIdx++;
      pIn++;
    }
    rv = m_dstOutputStream->Write((const char *)pStart, (int32_t)inIdx, &cntRead);
    if (NS_FAILED(rv) || (cntRead != (int32_t)inIdx)) {
      ReportWriteError(m_dstFolder);
      return false;
    }

    if (cnt) {
      inIdx = cnt;
      memcpy(m_pInBuffer, pIn, cnt);
    }
    else
      inIdx = 0;
  }

  // I used to check for an eol before writing one but
  // it turns out that adding a proper EOL before the next
  // separator never really hurts so better to be safe
  // and always do it.
  //  if ((last[0] != nsCRT::CR) || (last[1] != nsCRT::LF)) {
  rv = m_dstOutputStream->Write("\x0D\x0A", 2, &cntRead);
  if (NS_FAILED(rv) || (cntRead != 2)) {
    ReportWriteError(m_dstFolder);
    return false;
  }
  //  } // != nsCRT::CR || != nsCRT::LF

  return true;
}

CIndexScanner::CIndexScanner(nsString& name, nsIFile * idxFile,
                             nsIFile * mbxFile, nsIMsgFolder * dstFolder)
  : CMbxScanner( name, mbxFile, dstFolder)
{
  m_idxFile = idxFile;
  m_curItemIndex = 0;
  m_idxOffset = 0;
}

CIndexScanner::~CIndexScanner()
{
  CleanUp();
}

bool CIndexScanner::Initialize(void)
{
  if (!CMbxScanner::Initialize())
    return false;


  nsresult   rv = NS_NewLocalFileInputStream(getter_AddRefs(m_idxFileInputStream), m_idxFile);
  if (NS_FAILED(rv)) {
    CleanUp();
    return false;
  }

  return true;
}

bool CIndexScanner::ValidateIdxFile(void)
{
  int8_t      id[4];
  int32_t      cnt = 4;
  nsresult    rv;
  uint32_t      cntRead;
  int8_t *    pReadTo;

  pReadTo = id;
  rv = m_idxFileInputStream->Read((char *) pReadTo, cnt, &cntRead);
  if (NS_FAILED(rv) || (cntRead != cnt))
    return false;
  if ((id[0] != 'J') || (id[1] != 'M') || (id[2] != 'F') || (id[3] != '9'))
    return false;
  cnt = 4;
  uint32_t    subId;
  pReadTo = (int8_t *) &subId;
  rv = m_idxFileInputStream->Read((char *) pReadTo, cnt, &cntRead);
  if (NS_FAILED(rv) || (cntRead != cnt))
    return false;
  if (subId != 0x00010004) {
    IMPORT_LOG1("Idx file subid doesn't match: 0x%lx\n", subId);
    return false;
  }

  pReadTo = (int8_t *) &m_numMessages;
  rv = m_idxFileInputStream->Read((char *) pReadTo, cnt, &cntRead);
  if (NS_FAILED(rv) || (cntRead != cnt))
    return false;

  IMPORT_LOG1("Idx file num messages: %ld\n", m_numMessages);

  m_didBytes += 80;
  m_idxOffset = 80;
  return true;
}

/*
Idx file...
Header is 80 bytes, JMF9, subId? 0x00010004, numMessages, fileSize, 1, 0x00010010
Entries start at byte 80
4 byte numbers
Flags? maybe
?? who knows
index
start of this entry in the file
length of this record
msg offset in mbx
msg length in mbx

*/

// #define DEBUG_SUBJECT_AND_FLAGS  1
#define  kNumIdxLongsToRead    7

bool CIndexScanner::GetMailItem(uint32_t *pFlags, uint32_t *pOffset, uint32_t *pSize)
{
  uint32_t  values[kNumIdxLongsToRead];
  int32_t    cnt = kNumIdxLongsToRead * sizeof(uint32_t);
  int8_t *  pReadTo = (int8_t *) values;
  uint32_t    cntRead;
  nsresult  rv;

  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(m_idxFileInputStream);
  rv = seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, m_idxOffset);
  if (NS_FAILED(rv))
    return false;

  rv = m_idxFileInputStream->Read((char *) pReadTo, cnt, &cntRead);
  if (NS_FAILED(rv) || (cntRead != cnt))
    return false;

  if (values[3] != m_idxOffset) {
    IMPORT_LOG2("Self pointer invalid: m_idxOffset=0x%lx, self=0x%lx\n", m_idxOffset, values[3]);
    return false;
  }

  // So... what do we have here???
#ifdef DEBUG_SUBJECT_AND_FLAGS
  IMPORT_LOG2("Number: %ld, msg offset: 0x%lx, ", values[2], values[5]);
  IMPORT_LOG2("msg length: %ld, Flags: 0x%lx\n", values[6], values[0]);
  seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, m_idxOffset + 212);
  uint32_t  subSz = 0;
  cnt = 4;
  pReadTo = (int8_t *) &subSz;
  m_idxFileInputStream->Read((char *) pReadTo, cnt, &cntRead);
  if ((subSz >= 0) && (subSz < 1024)) {
    char *pSub = new char[subSz + 1];
    m_idxFileInputStream->Read(pSub, subSz, &cntRead);
    pSub[subSz] = 0;
    IMPORT_LOG1("    Subject: %s\n", pSub);
    delete [] pSub;
  }
#endif

  m_idxOffset += values[4];
  m_didBytes += values[4];

  *pFlags = values[0];
  *pOffset = values[5];
  *pSize = values[6];
  return true;
}

#define  kOEDeletedFlag    0x0001

bool CIndexScanner::DoWork(bool *pAbort, uint32_t *pDone, uint32_t *pCount)
{
  m_didBytes = 0;
  if (!ValidateIdxFile())
    return false;

  bool    failed = false;
  while ((m_curItemIndex < m_numMessages) && !failed && !(*pAbort)) {
    uint32_t  flags, offset, size;
    if (!GetMailItem(&flags, &offset, &size)) {
      CleanUp();
      return false;
    }
    m_curItemIndex++;
    if (!(flags & kOEDeletedFlag)) {
      if (!WriteMailItem(flags, offset, size))
        failed = true;
      else {
        m_msgCount++;
      }
    }
    m_didBytes += size;
    if (pDone)
      *pDone = m_didBytes;
    if (pCount)
      *pCount = m_msgCount;
  }

  CleanUp();
  return !failed;
}


void CIndexScanner::CleanUp(void)
{
  CMbxScanner::CleanUp();
  m_idxFileInputStream->Close();
}
