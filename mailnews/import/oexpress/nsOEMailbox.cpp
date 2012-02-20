/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "nsOEMailbox.h"

#include "OEDebugLog.h"
#include "msgCore.h"
#include "prprf.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsNetUtil.h"
#include "nsISeekableStream.h"
#include "nsMsgUtils.h"

class CMbxScanner {
public:
  CMbxScanner( nsString& name, nsIFile * mbxFile, nsIFile * dstFile);
  ~CMbxScanner();

  virtual bool    Initialize( void);
  virtual bool    DoWork( bool *pAbort, PRUint32 *pDone, PRUint32 *pCount);

  bool      WasErrorFatal( void) { return( m_fatalError);}
  PRUint32  BytesProcessed( void) { return( m_didBytes);}

protected:
  bool    WriteMailItem( PRUint32 flags, PRUint32 offset, PRUint32 size, PRUint32 *pTotalMsgSize = nsnull);
  virtual void  CleanUp( void);

private:
  void  ReportWriteError( nsIFile * file, bool fatal = true);
  void  ReportReadError( nsIFile * file, bool fatal = true);
  bool CopyMbxFileBytes(PRUint32 flags, PRUint32 numBytes);
  bool IsFromLineKey( PRUint8 *pBuf, PRUint32 max);

public:
  PRUint32      m_msgCount;

protected:
  PRUint32 *    m_pDone;
  nsString      m_name;
  nsCOMPtr <nsIFile> m_mbxFile;
  nsCOMPtr <nsIFile> m_dstFile;
  nsCOMPtr <nsIInputStream> m_mbxFileInputStream;
  nsCOMPtr <nsIOutputStream> m_dstFileOutputStream;
  PRUint8 *     m_pInBuffer;
  PRUint8 *     m_pOutBuffer;
  PRUint32      m_bufSz;
  PRUint32      m_didBytes;
  bool          m_fatalError;
  PRInt64      m_mbxFileSize;
  PRUint32      m_mbxOffset;

  static const char *  m_pFromLine;

};


class CIndexScanner : public CMbxScanner {
public:
  CIndexScanner( nsString& name, nsIFile * idxFile, nsIFile * mbxFile, nsIFile *dstFile);
  ~CIndexScanner();

  virtual bool    Initialize( void);
  virtual bool    DoWork( bool *pAbort, PRUint32 *pDone, PRUint32 *pCount);

protected:
  virtual void    CleanUp( void);

private:
  bool            ValidateIdxFile( void);
  bool            GetMailItem( PRUint32 *pFlags, PRUint32 *pOffset, PRUint32 *pSize);


private:
  nsCOMPtr <nsIFile>   m_idxFile;
  nsCOMPtr <nsIInputStream> m_idxFileInputStream;
  PRUint32        m_numMessages;
  PRUint32        m_idxOffset;
  PRUint32        m_curItemIndex;
};


bool CImportMailbox::ImportMailbox( PRUint32 *pDone, bool *pAbort, nsString& name, nsIFile * inFile, nsIFile * outFile, PRUint32 *pCount)
{
  bool    done = false;
  nsresult rv;
  nsCOMPtr <nsILocalFile> localInFile = do_QueryInterface(inFile, &rv);
  nsCOMPtr <nsILocalFile> idxFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv))
    rv  = idxFile->InitWithFile(localInFile);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0( "New file spec failed!\n");
    return( false);
  }

  if (GetIndexFile(idxFile)) {

    IMPORT_LOG1( "Using index file for: %S\n", name.get());

    CIndexScanner *pIdxScanner = new CIndexScanner( name, idxFile, inFile, outFile);
    if (pIdxScanner->Initialize()) {
      if (pIdxScanner->DoWork( pAbort, pDone, pCount)) {
        done = true;
      }
      else {
        IMPORT_LOG0( "CIndexScanner::DoWork() failed\n");
      }
    }
    else {
      IMPORT_LOG0( "CIndexScanner::Initialize() failed\n");
    }

    delete pIdxScanner;
  }

  if (done)
    return( done);

    /*
    something went wrong with the index file, just scan the mailbox
    file itself.
  */
  CMbxScanner *pMbx = new CMbxScanner( name, inFile, outFile);
  if (pMbx->Initialize()) {
    if (pMbx->DoWork( pAbort, pDone, pCount)) {
      done = true;
    }
    else {
      IMPORT_LOG0( "CMbxScanner::DoWork() failed\n");
    }
  }
  else {
    IMPORT_LOG0( "CMbxScanner::Initialize() failed\n");
  }

  delete pMbx;
  return( done);
}


bool CImportMailbox::GetIndexFile( nsIFile* file)
{
  nsCString pLeaf;
  if (NS_FAILED( file->GetNativeLeafName(pLeaf)))
    return( false);
  PRInt32  len = pLeaf.Length();
  if (len < 5)
    return( false);

  pLeaf.Replace(len - 3, 3, NS_LITERAL_CSTRING("idx"));

  IMPORT_LOG1( "Looking for index leaf name: %s\n", pLeaf);

  nsresult  rv;
  rv = file->SetNativeLeafName( pLeaf);

  bool    isFile = false;
  bool    exists = false;
  if (NS_SUCCEEDED( rv)) rv = file->IsFile( &isFile);
  if (NS_SUCCEEDED( rv)) rv = file->Exists( &exists);

  return (isFile && exists);
}


const char *CMbxScanner::m_pFromLine = "From - Mon Jan 1 00:00:00 1965\x0D\x0A";
// let's try a 16K buffer and see how well that works?
#define  kBufferKB  16


CMbxScanner::CMbxScanner( nsString& name, nsIFile* mbxFile, nsIFile* dstFile)
{
  m_msgCount = 0;
  m_name = name;
  m_mbxFile = mbxFile;
  m_dstFile = dstFile;
  m_pInBuffer = nsnull;
  m_pOutBuffer = nsnull;
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

void CMbxScanner::ReportWriteError( nsIFile * file, bool fatal)
{
  m_fatalError = fatal;
}

void CMbxScanner::ReportReadError( nsIFile * file, bool fatal)
{
  m_fatalError = fatal;
}

bool CMbxScanner::Initialize( void)
{
  m_bufSz = (kBufferKB * 1024);
  m_pInBuffer = new PRUint8[m_bufSz];
  m_pOutBuffer = new PRUint8[m_bufSz];
  if (!m_pInBuffer || !m_pOutBuffer) {
    return( false);
  }

  m_mbxFile->GetFileSize( &m_mbxFileSize);
  // open the mailbox file...
  if (NS_FAILED( NS_NewLocalFileInputStream(getter_AddRefs(m_mbxFileInputStream), m_mbxFile))) {
    CleanUp();
    return( false);
  }

  if (NS_FAILED(MsgNewBufferedFileOutputStream(getter_AddRefs(m_dstFileOutputStream), m_dstFile, -1, 0600))) {
    CleanUp();
    return( false);
  }

  return( true);
}


#define  kMbxHeaderSize    0x0054
#define kMbxMessageHeaderSz  16

bool CMbxScanner::DoWork( bool *pAbort, PRUint32 *pDone, PRUint32 *pCount)
{
  m_mbxOffset = kMbxHeaderSize;
  m_didBytes = kMbxHeaderSize;

  while (!(*pAbort) && ((m_mbxOffset + kMbxMessageHeaderSz) < m_mbxFileSize)) {
    PRUint32    msgSz;
    if (!WriteMailItem( 0, m_mbxOffset, 0, &msgSz)) {
      if (!WasErrorFatal())
        ReportReadError( m_mbxFile);
      return( false);
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

  return( true);
}


void CMbxScanner::CleanUp( void)
{
  if (m_mbxFileInputStream)
    m_mbxFileInputStream->Close();
  if (m_dstFileOutputStream)
    m_dstFileOutputStream->Close();

  delete [] m_pInBuffer;
  m_pInBuffer = nsnull;

  delete [] m_pOutBuffer;
  m_pOutBuffer = nsnull;
}


#define  kNumMbxLongsToRead  4

bool CMbxScanner::WriteMailItem( PRUint32 flags, PRUint32 offset, PRUint32 size, PRUint32 *pTotalMsgSize)
{
  PRUint32  values[kNumMbxLongsToRead];
  PRInt32    cnt = kNumMbxLongsToRead * sizeof( PRUint32);
  nsresult  rv;
  PRUint32    cntRead;
  PRInt8 *  pChar = (PRInt8 *) values;

  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(m_mbxFileInputStream);
  rv = seekableStream->Seek(nsISeekableStream::NS_SEEK_SET,  offset);

  if (NS_FAILED( rv)) {
    IMPORT_LOG1( "Mbx seek error: 0x%lx\n", offset);
    return( false);
  }
  rv = m_mbxFileInputStream->Read( (char *) pChar, cnt, &cntRead);
  if (NS_FAILED( rv) || (cntRead != cnt)) {
    IMPORT_LOG1( "Mbx read error at: 0x%lx\n", offset);
    return( false);
  }
  if (values[0] != 0x7F007F00) {
    IMPORT_LOG2( "Mbx tag field doesn't match: 0x%lx, at offset: 0x%lx\n", values[0], offset);
    return( false);
  }
  if (size && (values[2] != size)) {
    IMPORT_LOG3( "Mbx size doesn't match idx, mbx: %ld, idx: %ld, at offset: 0x%lx\n", values[2], size, offset);
    return( false);
  }

  if (pTotalMsgSize != nsnull)
    *pTotalMsgSize = values[2];

  // everything looks kosher...
  // the actual message text follows and is values[3] bytes long...
  return( CopyMbxFileBytes(flags,  values[3]));
}

bool CMbxScanner::IsFromLineKey( PRUint8 * pBuf, PRUint32 max)
{
  return (max > 5 && (pBuf[0] == 'F') && (pBuf[1] == 'r') && (pBuf[2] == 'o') && (pBuf[3] == 'm') && (pBuf[4] == ' '));
}


#define IS_ANY_SPACE( _ch) ((_ch == ' ') || (_ch == '\t') || (_ch == 10) || (_ch == 13))


bool CMbxScanner::CopyMbxFileBytes(PRUint32 flags, PRUint32 numBytes)
{
  if (!numBytes)
    return( true);

  PRUint32  cnt;
  PRUint8   last[2] = {0, 0};
  PRUint32  inIdx = 0;
  bool      first = true;
  PRUint8 * pIn;
  PRUint8 * pStart;
  PRInt32   fromLen = strlen( m_pFromLine);
  nsresult  rv;
  PRUint32   cntRead;
  PRUint8 * pChar;

  while (numBytes) {
    if (numBytes > (m_bufSz - inIdx))
      cnt = m_bufSz - inIdx;
    else
      cnt = numBytes;
    // Read some of the message from the file...
    pChar = m_pInBuffer + inIdx;
    rv = m_mbxFileInputStream->Read( (char *) pChar, (PRInt32)cnt, &cntRead);
    if (NS_FAILED( rv) || (cntRead != (PRInt32)cnt)) {
      ReportReadError( m_mbxFile);
      return( false);
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
      if (IsFromLineKey( m_pInBuffer, cnt)) {
        // skip past the first line
        while ((inIdx < cnt) && (m_pInBuffer[inIdx] != nsCRT::CR))
          inIdx++;
        while ((inIdx < cnt) && (IS_ANY_SPACE( m_pInBuffer[inIdx])))
          inIdx++;
        if (inIdx >= cnt) {
          // This should not occurr - it means the message starts
          // with a From separator line that is longer than our
          // file buffer!  In this bizarre case, just skip this message
          // since it is probably bogus anyway.
          return( true);
        }

      }
      // Begin every message with a From separator
      rv = m_dstFileOutputStream->Write( m_pFromLine, fromLen, &cntRead);
      if (NS_FAILED( rv) || (cntRead != fromLen)) {
        ReportWriteError( m_dstFile);
        return( false);
      }
      char statusLine[50];
      PRUint32 msgFlags = flags; // need to convert from OE flags to mozilla flags
      PR_snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF);
      rv = m_dstFileOutputStream->Write(statusLine, strlen(statusLine), &cntRead);
      if (NS_SUCCEEDED(rv) && cntRead == fromLen)
      {
        PR_snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS2_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF0000);
        rv = m_dstFileOutputStream->Write(statusLine, strlen(statusLine), &cntRead);
      }
      if (NS_FAILED( rv) || (cntRead != fromLen)) {
        ReportWriteError( m_dstFile);
        return( false);
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
            rv = m_dstFileOutputStream->Write( (const char *)pStart, (PRInt32)inIdx, &cntRead);
            if (NS_SUCCEEDED( rv) && (cntRead == (PRInt32)inIdx))
              rv = m_dstFileOutputStream->Write( ">", 1, &cntRead);
            if (NS_FAILED( rv) || (cntRead != 1)) {
              ReportWriteError( m_dstFile);
              return( false);
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
    rv = m_dstFileOutputStream->Write( (const char *)pStart, (PRInt32)inIdx, &cntRead);
    if (NS_FAILED( rv) || (cntRead != (PRInt32)inIdx)) {
      ReportWriteError( m_dstFile);
      return( false);
    }

    if (cnt) {
      inIdx = cnt;
      memcpy( m_pInBuffer, pIn, cnt);
    }
    else
      inIdx = 0;
  }

  // I used to check for an eol before writing one but
  // it turns out that adding a proper EOL before the next
  // separator never really hurts so better to be safe
  // and always do it.
  //  if ((last[0] != nsCRT::CR) || (last[1] != nsCRT::LF)) {
  rv = m_dstFileOutputStream->Write( "\x0D\x0A", 2, &cntRead);
  if (NS_FAILED( rv) || (cntRead != 2)) {
    ReportWriteError( m_dstFile);
    return( false);
  }
  //  } // != nsCRT::CR || != nsCRT::LF

  return( true);
}


CIndexScanner::CIndexScanner( nsString& name, nsIFile * idxFile, nsIFile * mbxFile, nsIFile * dstFile)
: CMbxScanner( name, mbxFile, dstFile)
{
  m_idxFile = idxFile;
  m_curItemIndex = 0;
  m_idxOffset = 0;
}

CIndexScanner::~CIndexScanner()
{
  CleanUp();
}

bool CIndexScanner::Initialize( void)
{
  if (!CMbxScanner::Initialize())
    return( false);


  nsresult   rv = NS_NewLocalFileInputStream(getter_AddRefs(m_idxFileInputStream), m_idxFile);
  if (NS_FAILED( rv)) {
    CleanUp();
    return( false);
  }

  return( true);
}

bool CIndexScanner::ValidateIdxFile( void)
{
  PRInt8      id[4];
  PRInt32      cnt = 4;
  nsresult    rv;
  PRUint32      cntRead;
  PRInt8 *    pReadTo;

  pReadTo = id;
  rv = m_idxFileInputStream->Read( (char *) pReadTo, cnt, &cntRead);
  if (NS_FAILED( rv) || (cntRead != cnt))
    return( false);
  if ((id[0] != 'J') || (id[1] != 'M') || (id[2] != 'F') || (id[3] != '9'))
    return( false);
  cnt = 4;
  PRUint32    subId;
  pReadTo = (PRInt8 *) &subId;
  rv = m_idxFileInputStream->Read((char *) pReadTo, cnt, &cntRead);
  if (NS_FAILED( rv) || (cntRead != cnt))
    return( false);
  if (subId != 0x00010004) {
    IMPORT_LOG1( "Idx file subid doesn't match: 0x%lx\n", subId);
    return( false);
  }

  pReadTo = (PRInt8 *) &m_numMessages;
  rv = m_idxFileInputStream->Read( (char *) pReadTo, cnt, &cntRead);
  if (NS_FAILED( rv) || (cntRead != cnt))
    return( false);

  IMPORT_LOG1( "Idx file num messages: %ld\n", m_numMessages);

  m_didBytes += 80;
  m_idxOffset = 80;
  return( true);
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

bool CIndexScanner::GetMailItem( PRUint32 *pFlags, PRUint32 *pOffset, PRUint32 *pSize)
{
  PRUint32  values[kNumIdxLongsToRead];
  PRInt32    cnt = kNumIdxLongsToRead * sizeof( PRUint32);
  PRInt8 *  pReadTo = (PRInt8 *) values;
  PRUint32    cntRead;
  nsresult  rv;

  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(m_idxFileInputStream);
  rv = seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, m_idxOffset);
  if (NS_FAILED( rv))
    return( false);

  rv = m_idxFileInputStream->Read( (char *) pReadTo, cnt, &cntRead);
  if (NS_FAILED( rv) || (cntRead != cnt))
    return( false);

  if (values[3] != m_idxOffset) {
    IMPORT_LOG2( "Self pointer invalid: m_idxOffset=0x%lx, self=0x%lx\n", m_idxOffset, values[3]);
    return( false);
  }

  // So... what do we have here???
#ifdef DEBUG_SUBJECT_AND_FLAGS
  IMPORT_LOG2( "Number: %ld, msg offset: 0x%lx, ", values[2], values[5]);
  IMPORT_LOG2( "msg length: %ld, Flags: 0x%lx\n", values[6], values[0]);
  seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, m_idxOffset + 212);
  PRUint32  subSz = 0;
  cnt = 4;
  pReadTo = (PRInt8 *) &subSz;
  m_idxFileInputStream->Read( (char *) pReadTo, cnt, &cntRead);
  if ((subSz >= 0) && (subSz < 1024)) {
    char *pSub = new char[subSz + 1];
    m_idxFileInputStream->Read( pSub, subSz, &cntRead);
    pSub[subSz] = 0;
    IMPORT_LOG1( "    Subject: %s\n", pSub);
    delete [] pSub;
  }
#endif

  m_idxOffset += values[4];
  m_didBytes += values[4];

  *pFlags = values[0];
  *pOffset = values[5];
  *pSize = values[6];
  return( true);
}

#define  kOEDeletedFlag    0x0001

bool CIndexScanner::DoWork( bool *pAbort, PRUint32 *pDone, PRUint32 *pCount)
{
  m_didBytes = 0;
  if (!ValidateIdxFile())
    return( false);

  bool    failed = false;
  while ((m_curItemIndex < m_numMessages) && !failed && !(*pAbort)) {
    PRUint32  flags, offset, size;
    if (!GetMailItem( &flags, &offset, &size)) {
      CleanUp();
      return( false);
    }
    m_curItemIndex++;
    if (!(flags & kOEDeletedFlag)) {
      if (!WriteMailItem( flags, offset, size))
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
  return( !failed);
}


void CIndexScanner::CleanUp( void)
{
  CMbxScanner::CleanUp();
  m_idxFileInputStream->Close();
}
