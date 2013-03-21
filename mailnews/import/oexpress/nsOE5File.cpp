/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsOE5File.h"
#include "OEDebugLog.h"
#include "nsMsgUtils.h"
#include "msgCore.h"
#include "prprf.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsIOutputStream.h"
#include "nsIMsgPluggableStore.h"
#include "nsIMsgHdr.h"
#include "nsNetUtil.h"
#include "nsISeekableStream.h"
#include "nsMsgMessageFlags.h"
#include <windows.h>

#define  kIndexGrowBy    100
#define  kSignatureSize    12
#define  kDontSeek      0xFFFFFFFF
#define  MARKED        0x20     //  4
#define  READ          0x80     //  1
#define  HASATTACHMENT 0x4000   //  268435456  10000000h
#define  ISANSWERED    0x80000  //  2
#define  ISFORWARDED   0x100000 //  4096
#define  ISWATCHED     0x400000 //  256
#define  ISIGNORED     0x800000 //  262144
#define  XLATFLAGS(s)  (((MARKED & s) ? nsMsgMessageFlags::Marked : 0) | \
                        ((READ & s) ? nsMsgMessageFlags::Read : 0) | \
                        ((HASATTACHMENT & s) ? nsMsgMessageFlags::Attachment : 0) | \
                        ((ISANSWERED & s) ? nsMsgMessageFlags::Replied : 0) | \
                        ((ISFORWARDED & s) ? nsMsgMessageFlags::Forwarded : 0) | \
                        ((ISWATCHED & s) ? nsMsgMessageFlags::Watched : 0) | \
                        ((ISIGNORED & s) ? nsMsgMessageFlags::Ignored : 0))

static char *gSig =
  "\xCF\xAD\x12\xFE\xC5\xFD\x74\x6F\x66\xE3\xD1\x11";

// copied from nsprpub/pr/src/{io/prfile.c | md/windows/w95io.c} :
// PR_FileTimeToPRTime and _PR_FileTimeToPRTime
void nsOE5File::FileTimeToPRTime(const FILETIME *filetime, PRTime *prtm)
{
#ifdef __GNUC__
    const PRTime _pr_filetime_offset = 116444736000000000LL;
#else
    const PRTime _pr_filetime_offset = 116444736000000000i64;
#endif

    PR_ASSERT(sizeof(FILETIME) == sizeof(PRTime));
    ::CopyMemory(prtm, filetime, sizeof(PRTime));
#ifdef __GNUC__
    *prtm = (*prtm - _pr_filetime_offset) / 10LL;
#else
    *prtm = (*prtm - _pr_filetime_offset) / 10i64;
#endif
}

bool nsOE5File::VerifyLocalMailFile(nsIFile *pFile)
{
  char    sig[kSignatureSize];

  nsCOMPtr <nsIInputStream> inputStream;

  if (NS_FAILED(NS_NewLocalFileInputStream(getter_AddRefs(inputStream), pFile)))
    return false;

  if (!ReadBytes(inputStream, sig, 0, kSignatureSize))
    return false;

  bool    result = true;

  for (int i = 0; (i < kSignatureSize) && result; i++) {
    if (sig[i] != gSig[i])
      result = false;
  }

  char  storeName[14];
  if (!ReadBytes(inputStream, storeName, 0x24C1, 12))
    result = false;

  storeName[12] = 0;

  if (PL_strcasecmp("LocalStore", storeName))
    result = false;

  return result;
}

bool nsOE5File::IsLocalMailFile(nsIFile *pFile)
{
  nsresult  rv;
  bool      isFile = false;

  rv = pFile->IsFile(&isFile);
  if (NS_FAILED(rv) || !isFile)
    return false;

  bool result = VerifyLocalMailFile(pFile);

  return result;
}

bool nsOE5File::ReadIndex(nsIInputStream *pInputStream, uint32_t **ppIndex, uint32_t *pSize)
{
  *ppIndex = nullptr;
  *pSize = 0;

  char    signature[4];
  if (!ReadBytes(pInputStream, signature, 0, 4))
    return false;

  for (int i = 0; i < 4; i++) {
    if (signature[i] != gSig[i]) {
      IMPORT_LOG0("*** Outlook 5.0 dbx file signature doesn't match\n");
      return false;
    }
  }

  uint32_t  offset = 0x00e4;
  uint32_t  indexStart = 0;
  if (!ReadBytes(pInputStream, &indexStart, offset, 4)) {
    IMPORT_LOG0("*** Unable to read offset to index start\n");
    return false;
  }

  PRUint32Array array;
  array.count = 0;
  array.alloc = kIndexGrowBy;
  array.pIndex = new uint32_t[kIndexGrowBy];

  uint32_t next = ReadMsgIndex(pInputStream, indexStart, &array);
  while (next) {
    next = ReadMsgIndex(pInputStream, next, &array);
  }

  if (array.count) {
    *pSize = array.count;
    *ppIndex = array.pIndex;
    return true;
  }

  delete [] array.pIndex;
  return false;
}


uint32_t nsOE5File::ReadMsgIndex(nsIInputStream *pInputStream, uint32_t offset, PRUint32Array *pArray)
{
  // Record is:
    // 4 byte marker
    // 4 byte unknown
    // 4 byte nextSubIndex
    // 4 byte (parentIndex?)
    // 2 bytes unknown
    // 1 byte length - # of entries in this record
    // 1 byte unknown
    // 4 byte unknown
    // length records consisting of 3 longs
  //  1 - pointer to record
  //  2 - child index pointer
  //  3 - number of records in child

  uint32_t  marker;

  if (!ReadBytes(pInputStream, &marker, offset, 4))
    return 0;

  if (marker != offset)
    return 0;


  uint32_t  vals[3];

  if (!ReadBytes(pInputStream, vals, offset + 4, 12))
    return 0;


  uint8_t  len[4];
  if (!ReadBytes(pInputStream, len, offset + 16, 4))
    return 0;



  uint32_t  cnt = (uint32_t) len[1];
  cnt *= 3;
  uint32_t  *pData = new uint32_t[cnt];

  if (!ReadBytes(pInputStream, pData, offset + 24, cnt * 4)) {
    delete [] pData;
    return 0;
  }

  uint32_t  next;
  uint32_t  indexOffset;
  uint32_t *  pRecord = pData;
  uint32_t *  pNewIndex;

  for (uint8_t i = 0; i < (uint8_t)len[1]; i++, pRecord += 3) {
    indexOffset = pRecord[0];

    if (pArray->count >= pArray->alloc) {
      pNewIndex = new uint32_t[ pArray->alloc + kIndexGrowBy];
      memcpy(pNewIndex, pArray->pIndex, (pArray->alloc * 4));
      (pArray->alloc) += kIndexGrowBy;
      delete [] pArray->pIndex;
      pArray->pIndex = pNewIndex;
    }

    /*
    We could do some checking here if we wanted -
    make sure the index is within the file,
    make sure there isn't a duplicate index, etc.
    */

    pArray->pIndex[pArray->count] = indexOffset;
    (pArray->count)++;



    next = pRecord[1];
    if (next)
      while ((next = ReadMsgIndex(pInputStream, next, pArray)) != 0);
  }
  delete [] pData;

  // return the pointer to the next subIndex
  return vals[1];
}

bool nsOE5File::IsFromLine(char *pLine, uint32_t len)
{
   return (len > 5 && (pLine[0] == 'F') && (pLine[1] == 'r') && (pLine[2] == 'o') && (pLine[3] == 'm') && (pLine[4] == ' '));
}

// Anything over 16K will be assumed BAD, BAD, BAD!
#define  kMailboxBufferSize  0x4000
#define  kMaxAttrCount       0x0030
const char *nsOE5File::m_pFromLineSep = "From - Mon Jan 1 00:00:00 1965\x0D\x0A";

nsresult nsOE5File::ImportMailbox(uint32_t *pBytesDone, bool *pAbort,
                                  nsString& name, nsIFile *inFile,
                                  nsIMsgFolder *dstFolder, uint32_t *pCount)
{
  int32_t    msgCount = 0;
  if (pCount)
    *pCount = 0;

  nsCOMPtr<nsIInputStream> inputStream;
  nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), inFile);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  rv = dstFolder->GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);

  uint32_t *  pIndex;
  uint32_t  indexSize;
  uint32_t *  pFlags;
  uint64_t  *  pTime;

  if (!ReadIndex(inputStream, &pIndex, &indexSize)) {
    IMPORT_LOG1("No messages found in mailbox: %s\n", NS_LossyConvertUTF16toASCII(name.get()));
    return NS_OK;
  }

  pTime  = new uint64_t[ indexSize];
  pFlags = new uint32_t[ indexSize];
  char *  pBuffer = new char[kMailboxBufferSize];
  if (!(*pAbort))
    ConvertIndex(inputStream, pBuffer, pIndex, indexSize, pFlags, pTime);

  uint32_t  block[4];
  int32_t   sepLen = (int32_t) strlen(m_pFromLineSep);
  uint32_t   written;

  /*
      Each block is:
      marker - matches file offset
      block length
      text length in block
      pointer to next block. (0 if end)

      Each message is made up of a linked list of block data.
      So what we do for each message is:
      1. Read the first block data.
      2. Write out the From message separator if the message doesn't already
      start with one.
      3. If the block of data doesn't end with CRLF then a line is broken into two blocks,
      so save the incomplete line for later process when we read the next block. Then
      write out the block excluding the partial line at the end of the block (if exists).
      4. If there's next block of data then read next data block. Otherwise we're done.
      If we found a partial line in step #3 then find the rest of the line from the
      current block and write out this line separately.
      5. Reset some of the control variables and repeat step #3.
  */

  uint32_t  didBytes = 0;
  uint32_t  next, size;
  char *pStart, *pEnd, *partialLineStart;
  nsAutoCString partialLine, tempLine;
  nsCOMPtr<nsIOutputStream> outputStream;
  rv = NS_OK;

  for (uint32_t i = 0; (i < indexSize) && !(*pAbort); i++)
  {
    if (! pIndex[i])
      continue;

    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    bool reusable;

    rv = msgStore->GetNewMsgOutputStream(dstFolder, getter_AddRefs(msgHdr), &reusable,
                                         getter_AddRefs(outputStream));
    if (NS_FAILED(rv))
    {
      IMPORT_LOG1( "Mbx getting outputstream error: 0x%lx\n", rv);
      break;
    }

    if (ReadBytes(inputStream, block, pIndex[i], 16) && (block[0] == pIndex[i]) &&
      (block[2] < kMailboxBufferSize) && (ReadBytes(inputStream, pBuffer, kDontSeek, block[2])))
    {
      // block[2] contains the chars in the buffer (ie, buf content size).
      // block[3] contains offset to the next block of data (0 means no more data).
      size = block[2];
      pStart = pBuffer;
      pEnd = pStart + size;

      // write out the from separator.
      rv = NS_ERROR_FAILURE;
      if (IsFromLine(pBuffer, size))
      {
        char *pChar = pStart;
        while ((pChar < pEnd) && (*pChar != '\r') && (*(pChar+1) != '\n'))
          pChar++;

        if (pChar < pEnd)
        {
          // Get the "From " line so write it out.
          rv = outputStream->Write(pStart, pChar-pStart+2, &written);
          if (NS_SUCCEEDED(rv))
            // Now buffer starts from the 2nd line.
            pStart = pChar + 2;
        }
      }
      else if (pTime[i])
      {
        char              result[156] = "";
        PRExplodedTime    xpldTime;
        char              buffer[128] = "";
        PRTime            prt;

        nsOE5File::FileTimeToPRTime((FILETIME *)&pTime[i], &prt);
        // modeled after nsMsgSend.cpp
        PR_ExplodeTime(prt, PR_LocalTimeParameters, &xpldTime);
        PR_FormatTimeUSEnglish(buffer, sizeof(buffer),
                                "%a %b %d %H:%M:%S %Y",
                                &xpldTime);
        PL_strcpy(result, "From - ");
        PL_strcpy(result + 7, buffer);
        PL_strcpy(result + 7 + 24, CRLF);

        rv = outputStream->Write(result, (int32_t) strlen(result), &written);
      }
      if (NS_FAILED(rv))
      {
        // Write out the default from line since there is none in the msg.
        rv = outputStream->Write(m_pFromLineSep, sepLen, &written);
        // FIXME: Do I need to check the return value of written???
        if (NS_FAILED(rv))
          break;
      }

      char statusLine[50];
      uint32_t msgFlags = XLATFLAGS(pFlags[i]);
      PR_snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF);
      rv = outputStream->Write(statusLine, strlen(statusLine), &written);
      NS_ENSURE_SUCCESS(rv,rv);
      PR_snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS2_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF0000);
      rv = outputStream->Write(statusLine, strlen(statusLine), &written);
      NS_ENSURE_SUCCESS(rv,rv);

      do
      {
        partialLine.Truncate();
        partialLineStart = pEnd;

        // If the buffer doesn't end with CRLF then a line is broken into two blocks,
        // so save the incomplete line for later process when we read the next block.
        if ((size > 1) && !(*(pEnd - 2) == '\r' && *(pEnd - 1) == '\n'))
        {
          partialLineStart -= 2;
          while ((partialLineStart >= pStart) && (*partialLineStart != '\r') && (*(partialLineStart+1) != '\n'))
            partialLineStart--;
          if (partialLineStart != (pEnd - 2))
            partialLineStart += 2; // skip over CRLF if we find them.
          partialLine.Assign(partialLineStart, pEnd - partialLineStart);
        }

        // Now process the block of data which ends with CRLF.
        rv = EscapeFromSpaceLine(outputStream, pStart, partialLineStart);
        if (NS_FAILED(rv))
          break;

        didBytes += block[2];

        next = block[3];
        if (! next)
        {
          // OK, we're done so flush out the partial line if it's not empty.
          if (partialLine.Length())
            rv = EscapeFromSpaceLine(outputStream, (char *)partialLine.get(), (partialLine.get()+partialLine.Length()));
        }
        else
          if (ReadBytes(inputStream, block, next, 16) && (block[0] == next) &&
            (block[2] < kMailboxBufferSize) && (ReadBytes(inputStream, pBuffer, kDontSeek, block[2])))
          {
            // See if we have a partial line from previous block. If so then build a complete
            // line (ie, take the remaining chars from this block) and process this line. Need
            // to adjust where data start and size in this case.
            size = block[2];
            pStart = pBuffer;
            pEnd = pStart + size;
            if (partialLine.Length())
            {
              while ((pStart < pEnd) && (*pStart != '\r') && (*(pStart+1) != '\n'))
                pStart++;
              if (pStart < pEnd)  // if we found a CRLF ..
                pStart += 2;      // .. then copy that too.
              tempLine.Assign(pBuffer, pStart - pBuffer);
              partialLine.Append(tempLine);
              rv = EscapeFromSpaceLine(outputStream, (char *)partialLine.get(), (partialLine.get()+partialLine.Length()));
              if (NS_FAILED(rv))
                break;

              // Adjust where data start and size (since some of the data has been processed).
              size -= (pStart - pBuffer);
            }
          }
          else
          {
            IMPORT_LOG2("Error reading message from %s at 0x%lx\n", NS_LossyConvertUTF16toASCII(name.get()), pIndex[i]);
            rv = outputStream->Write("\x0D\x0A", 2, &written);
            next = 0;
          }
      } while (next);

      // Always end a msg with CRLF. This will make sure that OE msgs without body is
      // correctly recognized as msgs. Otherwise, we'll end up with the following in
      // the msg folder where the 2nd msg starts right after the headers of the 1st msg:
      //
      // From - Jan 1965 00:00:00     <<<--- 1st msg starts here
      // Subject: Test msg
      // . . . (more headers)
      // To: <someone@example.com>
      // From - Jan 1965 00:00:00     <<<--- 2nd msg starts here
      // Subject: How are you
      // . . .(more headers)
      //
      // In this case, the 1st msg is not recognized as a msg (it's skipped)
      // when you open the folder.
      rv = outputStream->Write("\x0D\x0A", 2, &written);

      if (NS_FAILED(rv)) {
        IMPORT_LOG0( "Error writing message during OE import\n");
        msgStore->DiscardNewMessage(outputStream, msgHdr);
        break;
      }

      msgStore->FinishNewMessage(outputStream, msgHdr);

      if (!reusable)
        outputStream->Close();

      msgCount++;
      if (pCount)
        *pCount = msgCount;
      if (pBytesDone)
        *pBytesDone = didBytes;
    }
    else {
      // Error reading message, should this be logged???
      IMPORT_LOG2("Error reading message from %s at 0x%lx\n", NS_LossyConvertUTF16toASCII(name.get()), pIndex[i]);
      *pAbort = true;
    }
  }
  if (outputStream)
    outputStream->Close();
  delete [] pBuffer;
  delete [] pFlags;
  delete [] pTime;

  if (NS_FAILED(rv))
    *pAbort = true;

  return rv;
}


/*
  A message index record consists of:
  4 byte marker - matches record offset
  4 bytes size - size of data after this header
  2 bytes header length - not dependable
  1 bytes - number of attributes
  1 byte changes on this object
  Each attribute is a 4 byte value with the 1st byte being the tag
  and the remaing 3 bytes being data.  The data is either a direct
  offset of an offset within the message index that points to the
  data for the tag.
  attr[0]:
  -hi bit== 1 means PRUint24 data = attr[1]
  -hi bit== 0 means (PRUint24) attr[1] = offset into data segment for data
  -attr[0] & 7f == tag index
  Header above is 0xC bytes, attr's are number * 4 bytes then follows data segment
  The data segment length is undefined. The index data is either part of the 
  index structure or the index structure points to address in data that follows
  index structure table. Use that location to calculate file position of data.
  MSDN indicates 0x28 attributes possible.

  Current known tags are:
  0x01 - flags addressed
  0x81 - flags in attr's next 3 bytes
  0x02 - a time value - addressed- 8 bytes
  0x04 - text offset pointer, the data is the offset after the attribute
         of a 4 byte pointer to the message text <-- addr into data
  0x05 - offset to truncated subject
  0x08 - offste to subject
  0x0D - offset to from
  0x0E - offset to from addresses
  0x13 - offset to to name
  0x45 - offset to to address <----correct --> 0x14
  0x80 - msgId <-correction-> 0x07 addr to msg id
  0x84 - direct text offset, direct pointer to message text
*/

void nsOE5File::ConvertIndex(nsIInputStream *pFile, char *pBuffer,
                              uint32_t *pIndex, uint32_t size,
                              uint32_t *pFlags, uint64_t *pTime)
{
  // for each index record, get the actual message offset!  If there is a
  // problem just record the message offset as 0 and the message reading code
  // can log that error information.
  // XXXTODO- above error reporting is not done

  uint8_t   recordHead[12];
  uint32_t  marker;
  uint32_t  recordSize;
  uint32_t  numAttrs;
  uint32_t  offset;
  uint32_t  attrIndex;
  uint32_t  attrOffset;
  uint8_t   tag;
  uint32_t  tagData;
  uint32_t  flags;
  uint64_t  time;
  uint32_t  dataStart;

  for (uint32_t i = 0; i < size; i++) {
    offset = 0;
    flags = 0;
    time = 0;
    if (ReadBytes(pFile, recordHead, pIndex[i], 12)) {
      memcpy(&marker, recordHead, 4);
      memcpy(&recordSize, recordHead + 4, 4);
      numAttrs = (uint32_t) recordHead[10];
      if (marker == pIndex[i] && numAttrs <= kMaxAttrCount) {
        dataStart = pIndex[i] + 12 + (numAttrs * 4);
        if (ReadBytes(pFile, pBuffer, kDontSeek, numAttrs * 4)) {
          attrOffset = 0;
          for (attrIndex = 0; attrIndex < numAttrs; attrIndex++, attrOffset += 4) {
            tag = (uint8_t) pBuffer[attrOffset];
            if (tag == (uint8_t) 0x84) {
              tagData = 0;
              memcpy(&tagData, pBuffer + attrOffset + 1, 3);
              offset = tagData;
            }
            else if (tag == (uint8_t) 0x04) {
              tagData = 0;
              memcpy(&tagData, pBuffer + attrOffset + 1, 3);
              ReadBytes(pFile, &offset, dataStart + tagData, 4);
            }
            else if (tag == (uint8_t) 0x81) {
              tagData = 0;
              memcpy(&tagData, pBuffer + attrOffset +1, 3);
              flags = tagData;
            }
            else if (tag == (uint8_t) 0x01) {
              tagData = 0;
              memcpy(&tagData, pBuffer + attrOffset +1, 3);
              ReadBytes(pFile, &flags, dataStart + tagData, 4);
            }
            else if (tag == (uint8_t) 0x02) {
              tagData = 0;
              memcpy(&tagData, pBuffer + attrOffset +1, 3);
              ReadBytes(pFile, &time, dataStart + tagData, 4);
            }
          }
        }
      }
    }
    pIndex[i] = offset;
    pFlags[i] = flags;
    pTime[i] = time;
  }
}


bool nsOE5File::ReadBytes(nsIInputStream *stream, void *pBuffer, uint32_t offset, uint32_t bytes)
{
  nsresult  rv;

  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(stream);
  if (offset != kDontSeek) {
    rv = seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, offset);
    if (NS_FAILED(rv))
      return false;
  }

  if (!bytes)
    return true;

  uint32_t  cntRead;
  char *  pReadTo = (char *)pBuffer;
  rv = stream->Read(pReadTo, bytes, &cntRead);
  return NS_SUCCEEDED(rv) && cntRead == bytes;

}

