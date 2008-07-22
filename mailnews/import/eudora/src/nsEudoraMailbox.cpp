/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
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

#include "msgCore.h"
#include "nsCOMPtr.h"
#include "nsReadableUtils.h"
#include "nsEudoraMailbox.h"
#include "nsDirectoryServiceDefs.h"
#include "nsEudoraCompose.h"
#include "nspr.h"
#include "nsMsgMessageFlags.h"
#include "nsMailHeaders.h"
#include "nsMsgLocalFolderHdrs.h"

#include "nsMsgUtils.h"
#include "nsNetUtil.h"
#include "EudoraDebugLog.h"
#include "nsISeekableStream.h"

#define  kCopyBufferSize    8192
#define  kMailReadBufferSize  16384
#define DATE_STR_LEN      64      // 64 bytes is plenty to hold the date header.

#define  kWhitespace  " \t\b\r\n"

const char *eudoraFromLine = "From - Mon Jan 1 00:00:00 1965\x0D\x0A";

#ifdef IMPORT_DEBUG
void DUMP_FILENAME( nsIFile *pFile, PRBool endLine);

void DUMP_FILENAME( nsIFile *pFile, PRBool endLine)
{
  nsCString pPath;
  if (pFile)
    pFile->GetNativePath(pPath);
  if (!pPath.IsEmpty()) {
    IMPORT_LOG1( "%s", pPath.get());
  }
  else {
    IMPORT_LOG0( "Unknown");
  }
  if (endLine) {
    IMPORT_LOG0( "\n");
  }
}

// #define  DONT_DELETE_EUDORA_TEMP_FILES    1

#else
#define DUMP_FILENAME( x, y)
#endif

static char *eudoraWeekDays[7] = {
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun"
};

static char *eudoraMonths[12] = {
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
};


PRUint16 EudoraTOCEntry::GetMozillaStatusFlags()
{
  // Return the mozilla equivalent of flags that Eudora supports.
  PRUint16  flags = 0;

#ifndef XP_MACOSX
  switch (m_State)
  {
    case MS_UNREAD:
      flags = 0;
      break;

    case MS_READ:
      flags = MSG_FLAG_READ;
      break;

    case MS_REPLIED:
      flags = MSG_FLAG_READ | MSG_FLAG_REPLIED;
      break;

    case MS_FORWARDED:
      flags = MSG_FLAG_READ | MSG_FLAG_FORWARDED;
      break;

    case MS_REDIRECT:
      // Redirect doesn't really mean forwarded, but forwarded
      // seems to be the closest equivalent for now.
      flags = MSG_FLAG_READ | MSG_FLAG_FORWARDED;
      break;

    case MS_UNSENDABLE:
    case MS_SENDABLE:
    case MS_QUEUED:
    case MS_SENT:
    case MS_UNSENT:
    case MS_TIME_QUEUED:
    case MS_SPOOLED:
      // To do: Add more sent message flag handling.
      flags = 0;
      break;

    case MS_RECOVERED:
      flags = MSG_FLAG_READ;
      break;
  }

  // Range check priority just to be sure
  if (m_Priority < MSP_HIGHEST)
    m_Priority = MSP_HIGHEST;
  if (m_Priority > MSP_LOWEST)
    m_Priority = MSP_LOWEST;

  // Translate priority into format used in mozilla status flags
  // (which is reversed for some reason)
  flags |= (7-m_Priority) << 13;
#endif

  return flags;
}


PRUint32 EudoraTOCEntry::GetMozillaStatus2Flags()
{
#ifdef XP_MACOSX
  return 0;
#else

  // Return the mozilla equivalent of flags that Eudora supports.
  PRUint32  flags = 0;

  if (m_Imflags & IMFLAGS_DELETED)
    flags |= MSG_FLAG_IMAP_DELETED;

  if (m_Flags & MSF_READ_RECEIPT)
    flags |= MSG_FLAG_MDN_REPORT_NEEDED;

  return flags;
#endif
}


nsEudoraMailbox::nsEudoraMailbox()
{
  m_fromLen = 0;
}

nsEudoraMailbox::~nsEudoraMailbox()
{
  EmptyAttachments();
}

nsresult nsEudoraMailbox::CreateTempFile( nsIFile **ppFile)
{
  nsresult rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
                                                "impmail.txt",
                                                ppFile);
  NS_ENSURE_SUCCESS(rv, rv);

  return (*ppFile)->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
}

nsresult nsEudoraMailbox::DeleteFile( nsIFile *pFile)
{
  PRBool    result;
  nsresult  rv = NS_OK;

  result = PR_FALSE;
  pFile->Exists( &result);
  if (result) {
    result = PR_FALSE;
    pFile->IsFile( &result);
    if (result) {
#ifndef DONT_DELETE_EUDORA_TEMP_FILES
        rv = pFile->Remove(PR_FALSE);
#endif
    }
  }
  return( rv);
}


#define kComposeErrorStr  "X-Eudora-Compose-Error: *****" "\x0D\x0A"
#define kHTMLTag "<html>"

nsresult nsEudoraMailbox::ImportMailbox( PRUint32 *pBytes, PRBool *pAbort, const PRUnichar *pName, nsIFile *pSrc, nsIFile *pDst, PRInt32 *pMsgCount)
{
  nsCOMPtr<nsIFile>   tocFile;
        nsCOMPtr <nsIInputStream> srcInputStream;
        nsCOMPtr <nsIInputStream> tocInputStream;
        nsCOMPtr <nsIOutputStream> mailOutputStream;
   PRBool              importWithoutToc = PR_TRUE;
  PRBool              deleteToc = PR_FALSE;
  nsresult            rv;
  nsCOMPtr<nsIFile>   mailFile;

  if (pMsgCount)
    *pMsgCount = 0;

  rv = pSrc->GetFileSize( &m_mailSize);

        rv = NS_NewLocalFileInputStream(getter_AddRefs(srcInputStream), pSrc);
        if (NS_FAILED( rv))
    return( rv);

  NS_ADDREF( pSrc);

  // First, get the index file for this mailbox
  rv = FindTOCFile( pSrc, getter_AddRefs( tocFile), &deleteToc);
  if (NS_SUCCEEDED( rv) && tocFile)
        {
    IMPORT_LOG0( "Reading euroda toc file: ");
    DUMP_FILENAME( tocFile, PR_TRUE);

                rv = NS_NewLocalFileOutputStream(getter_AddRefs(mailOutputStream), pDst);
                NS_ENSURE_SUCCESS(rv, rv);
    // Read the toc and import the messages
    rv = ImportMailboxUsingTOC( pBytes, pAbort, srcInputStream, tocFile, mailOutputStream, pMsgCount);

    // clean up
    if (deleteToc)
      DeleteFile( tocFile);

    // If we were able to import with the TOC, then we don't need to bother
    // importing without the TOC.
    if ( NS_SUCCEEDED(rv) ) {
      importWithoutToc = PR_FALSE;
      IMPORT_LOG0( "Imported mailbox: "); DUMP_FILENAME( pSrc, PR_FALSE);
      IMPORT_LOG0( "  Using TOC: "); DUMP_FILENAME(tocFile, PR_TRUE);
    }
    else {
      IMPORT_LOG0( "*** Error importing with TOC - will import without TOC.\n");
    }
  }

  // pSrc must be Released before returning

  if (importWithoutToc) {
    // The source file contains partially constructed mail messages,
    // and attachments.  We should first investigate if we can use the mailnews msgCompose
    // stuff to do the work for us.  If not we have to scan the mailboxes and do TONS
    // of work to properly reconstruct the message - Eudora is so nice that it strips things
    // like MIME headers, character encoding, and attachments - beautiful!

    rv = pSrc->GetFileSize( &m_mailSize);

    SimpleBufferTonyRCopiedOnce    readBuffer;
    SimpleBufferTonyRCopiedOnce    headers;
    SimpleBufferTonyRCopiedOnce    body;
    SimpleBufferTonyRCopiedOnce    copy;
    nsCString            fromLine(eudoraFromLine);

    headers.m_convertCRs = PR_TRUE;
    body.m_convertCRs = PR_TRUE;

    copy.Allocate( kCopyBufferSize);
    readBuffer.Allocate( kMailReadBufferSize);
    ReadFileState      state;
    state.offset = 0;
    state.size = m_mailSize;
    state.pFile = pSrc;

    IMPORT_LOG0( "Reading mailbox\n");

    if (NS_SUCCEEDED( rv ))
                {
      nsCString defaultDate;
      nsCAutoString bodyType;

      IMPORT_LOG0( "Reading first message\n");

      while (!*pAbort && NS_SUCCEEDED( rv = ReadNextMessage( &state, readBuffer, headers, body, defaultDate, bodyType, NULL))) {

        if (pBytes) {
          *pBytes += body.m_writeOffset - 1 + headers.m_writeOffset - 1;
        }

        rv = ImportMessage(headers, body, defaultDate, bodyType, mailOutputStream, pMsgCount);

        if (!readBuffer.m_bytesInBuf && (state.offset >= state.size))
          break;
      }

    }
    else {
      IMPORT_LOG0( "*** Error creating file spec for composition\n");
    }
  }

  pSrc->Release();

  return( rv);
}

#ifdef XP_MACOSX
#define kMsgHeaderSize    220
#define  kMsgFirstOffset    278
#else
#define  kMsgHeaderSize    218
#define kMsgFirstOffset    104
#endif


nsresult nsEudoraMailbox::ImportMailboxUsingTOC(
  PRUint32 *pBytes,
  PRBool *pAbort,
  nsIInputStream *pInputStream,
  nsIFile *tocFile,
  nsIOutputStream *pDst,
  PRInt32 *pMsgCount)
{
  nsresult        rv = NS_OK;

  PRInt64  mailSize = m_mailSize;
  PRInt64  tocSize = 0;
  PRUint32  saveBytes = pBytes ? *pBytes : 0;
  nsCOMPtr <nsIInputStream> tocInputStream;

  rv = tocFile->GetFileSize( &tocSize);

  // if the index or the mail file is empty then just
  // use the original mail file.
  if (!mailSize || !tocSize)
    return NS_ERROR_FAILURE;
  rv = NS_NewLocalFileInputStream(getter_AddRefs(tocInputStream), tocFile);
  NS_ENSURE_SUCCESS(rv, rv);

  SimpleBufferTonyRCopiedOnce readBuffer;
  SimpleBufferTonyRCopiedOnce headers;
  SimpleBufferTonyRCopiedOnce body;
  SimpleBufferTonyRCopiedOnce copy;
  PRInt32 tocOffset = kMsgFirstOffset;
  EudoraTOCEntry tocEntry;

  copy.Allocate( kCopyBufferSize);
  readBuffer.Allocate(kMailReadBufferSize);

  IMPORT_LOG0( "Importing mailbox using TOC: ");
  DUMP_FILENAME( tocFile, PR_TRUE);

  nsCOMPtr <nsISeekableStream> tocSeekableStream = do_QueryInterface(tocInputStream);
  nsCOMPtr <nsISeekableStream> mailboxSeekableStream = do_QueryInterface(pInputStream);
  while (!*pAbort && (tocOffset < (PRInt32)tocSize)) {
    if ( NS_FAILED(rv = tocSeekableStream->Seek(nsISeekableStream::NS_SEEK_SET, tocOffset)) )
      break;

    if ( NS_FAILED(rv = ReadTOCEntry(tocInputStream, tocEntry)) )
      break;

    // Quick and dirty way to read in and parse the message the way the rest
    // of the code expects.
    nsCString              defaultDate;
    nsCAutoString            bodyType;
    ReadFileState            state;

    // Seek to the start of the email message.
    mailboxSeekableStream->Seek(nsISeekableStream::NS_SEEK_SET, tocEntry.m_Offset);

    // We're fudging the data to make ReadNextMessage happy. In particular
    // state.size is meant to be the size of the entire file, because it's
    // assumed that ReadNextMessage will actually have to parse. We know
    // exactly how big the message is, so we simply set the "size" to be
    // immediately where the message ends.
    state.offset = tocEntry.m_Offset;
    state.pInputStream = pInputStream;
    state.size = state.offset + tocEntry.m_Length;

    if ( NS_SUCCEEDED(rv = ReadNextMessage(&state, readBuffer, headers, body, defaultDate, bodyType, &tocEntry) ) )
    {
      rv = ImportMessage(headers, body, defaultDate, bodyType, pDst, pMsgCount);

      if (pBytes)
        *pBytes += tocEntry.m_Length;
    }

    // We currently don't consider an error from ReadNextMessage or ImportMessage to be fatal.
    // Reset the error back to no error in case this is the last time through the loop.
    rv = NS_OK;

    tocOffset += kMsgHeaderSize;
  }

  if ( NS_SUCCEEDED(rv) ) {
    IMPORT_LOG0( " finished\n");
  }
  else {
    // We failed somewhere important enough that we kept the error.
    // Bail on all that we imported since we'll be importing everything
    // again using just the mailbox.
    IMPORT_LOG0( "*** Error importing mailbox using TOC: ");
//    DUMP_FILENAME(pMail, PR_TRUE);

    // Close the destination and truncate it. We don't need to bother
    // to reopen it because the nsIFileSpec implementation will open
    // before writing if necessary (and yes legacy importing code already
    // relies on this behavior).
//    pDst->CloseStream();
//    pDst->Truncate(0);

    // Reset pBytes back to where it was before we imported this mailbox.
    // This will likely result in a funky progress bar which will move
    // backwards, but that's probably the best we can do to keep the
    // progress accurate since we'll be re-importing the same mailbox.
    if (pBytes)
      *pBytes = saveBytes;

    // Set the message count back to 0.
    if (pMsgCount)
      *pMsgCount = 0;
  }

  return rv;
}

nsresult nsEudoraMailbox::ReadTOCEntry(nsIInputStream *pToc, EudoraTOCEntry& tocEntry)
{
#define READ_TOC_FIELD(entry) pBuffer = (char *)&entry;\
  if ( NS_FAILED(pToc->Read(pBuffer, sizeof(entry), &bytesRead)) || (bytesRead != sizeof(entry)) )\
    return NS_ERROR_FAILURE

  PRUint32 bytesRead = 0;
  char * pBuffer;

  // Here we'll read any initial data that's in the same format on both Mac and Windows
  READ_TOC_FIELD(tocEntry.m_Offset);
  READ_TOC_FIELD(tocEntry.m_Length);

#ifdef XP_MACOSX
  // Read Mac specific data

#else
  // Read Windows specific data
  PRInt16      x1 = 0, y1 = 0, x2 = 400, y2 = 300, tzm = 0;
  PRInt8      nIgnoreChar;
  PRUint8      cJunkInfo = 0;
  PRUint32    ulJunkPluginID;

  READ_TOC_FIELD(tocEntry.m_Seconds);
  READ_TOC_FIELD(tocEntry.m_State);
  READ_TOC_FIELD(tocEntry.m_Flags);
  READ_TOC_FIELD(tocEntry.m_Priority);
  READ_TOC_FIELD(nIgnoreChar);
  READ_TOC_FIELD(tocEntry.m_Date);
  READ_TOC_FIELD(tocEntry.m_lArrivalSeconds);
  READ_TOC_FIELD(tocEntry.m_From);
  READ_TOC_FIELD(tocEntry.m_Subject);

  // We'll read but ignore window position
  READ_TOC_FIELD(x1);
  READ_TOC_FIELD(y1);
  READ_TOC_FIELD(x2);
  READ_TOC_FIELD(y2);

  READ_TOC_FIELD(tocEntry.m_Label);
  READ_TOC_FIELD(tocEntry.m_Hash);
  READ_TOC_FIELD(tocEntry.m_UniqueMessageId);
  READ_TOC_FIELD(tocEntry.m_FlagsEx);
  READ_TOC_FIELD(tocEntry.m_PersonaHash);

  READ_TOC_FIELD(tzm);
  tocEntry.m_TimeZoneMinutes = tzm;

  // IMAP specific info (present, but not useful when POP mailbox)
  READ_TOC_FIELD(tocEntry.m_Imflags);
  READ_TOC_FIELD(tocEntry.m_MsgSize);

  // Moodwatch info - may never be worth importing
  READ_TOC_FIELD(tocEntry.m_nMood);

  // Get the junk score byte
  READ_TOC_FIELD(cJunkInfo);
  if (cJunkInfo & 0x80)
  {
    // If the high bit is set note that this message was manually junked
    // and unset the high bit.
    tocEntry.m_bManuallyJunked = PR_TRUE;
    cJunkInfo &= 0x7F;
  }
  else
  {
    tocEntry.m_bManuallyJunked = PR_FALSE;
  }
  tocEntry.m_ucJunkScore = cJunkInfo;

  READ_TOC_FIELD(ulJunkPluginID);
#endif

  return NS_OK;
}


nsresult nsEudoraMailbox::ImportMessage(
  SimpleBufferTonyRCopiedOnce &headers,
  SimpleBufferTonyRCopiedOnce &body,
  nsCString& defaultDate,
  nsCAutoString& bodyType,
  nsIOutputStream *pDst,
  PRInt32  *pMsgCount)
{
  nsresult rv = NS_OK;
  PRUint32 written = 0;
  nsEudoraCompose compose;

  // Unfortunately Eudora stores HTML messages in the sent folder
  // without any content type header at all. If the first line of the message body is <html>
  // then mark the message as html internally...See Bug #258489
  if (body.m_pBuffer && (body.m_writeOffset > (PRInt32)strlen(kHTMLTag)) && (strncmp(body.m_pBuffer, kHTMLTag, strlen(kHTMLTag)) == 0 ))
    bodyType = "text/html"; // ignore whatever body type we were given...force html

  compose.SetBody( body.m_pBuffer, body.m_writeOffset - 1, bodyType);
  compose.SetHeaders( headers.m_pBuffer, headers.m_writeOffset - 1);
  compose.SetAttachments( &m_attachments);
  compose.SetDefaultDate(defaultDate);

        nsCOMPtr <nsIFile> compositionFile;
  rv = compose.SendTheMessage(m_mailImportLocation, getter_AddRefs(compositionFile));
  if (NS_SUCCEEDED( rv)) {
    nsCString            fromLine(eudoraFromLine);
    SimpleBufferTonyRCopiedOnce    copy;

    copy.Allocate( kCopyBufferSize);

    /* IMPORT_LOG0( "Composed message in file: "); DUMP_FILENAME( compositionFile, PR_TRUE); */
    // copy the resulting file into the destination file!
    rv = compose.CopyComposedMessage( fromLine, compositionFile, pDst, copy);
    DeleteFile(compositionFile);
    if (NS_FAILED( rv)) {
      IMPORT_LOG0( "*** Error copying composed message to destination mailbox\n");
    }
    if (pMsgCount)
      (*pMsgCount)++;
  }
  else {
    IMPORT_LOG0( "*** Error composing message, writing raw message\n");
    rv = WriteFromSep( pDst);

    rv = pDst->Write( kComposeErrorStr,
      strlen( kComposeErrorStr),
      &written );

    if (NS_SUCCEEDED( rv))
      rv = pDst->Write( headers.m_pBuffer, headers.m_writeOffset - 1, &written);
    if (NS_SUCCEEDED( rv) && (written == (headers.m_writeOffset - 1)))
      rv = pDst->Write( "\x0D\x0A" "\x0D\x0A", 4, &written);
    if (NS_SUCCEEDED( rv) && (written == 4))
      rv = pDst->Write( body.m_pBuffer, body.m_writeOffset - 1, &written);
    if (NS_SUCCEEDED( rv) && (written == (body.m_writeOffset - 1))) {
      rv = pDst->Write( "\x0D\x0A", 2, &written);
      if (written != 2)
        rv = NS_ERROR_FAILURE;
    }

    if (NS_FAILED( rv)) {
      IMPORT_LOG0( "*** Error writing to destination mailbox\n");
    }
  }

  return rv;
}




nsresult nsEudoraMailbox::ReadNextMessage( ReadFileState *pState, SimpleBufferTonyRCopiedOnce& copy,
                                          SimpleBufferTonyRCopiedOnce& header, SimpleBufferTonyRCopiedOnce& body,
                                          nsCString& defaultDate, nsCString& bodyType, EudoraTOCEntry *pTocEntry)
{
  header.m_writeOffset = 0;
  body.m_writeOffset = 0;

  nsresult    rv;
  PRInt32      lineLen;
  char      endBuffer = 0;

  lineLen = -1;
  // Find the from separator - we should actually be positioned at the
  // from separator, but for now, we'll verify this.
  while (lineLen == -1) {
    if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
      IMPORT_LOG0( "*** Error, FillMailBuffer FAILED in ReadNextMessage\n");
      return( rv);
    }
    lineLen = IsEudoraFromSeparator( copy.m_pBuffer + copy.m_writeOffset, copy.m_bytesInBuf - copy.m_writeOffset, defaultDate);

    if (lineLen == -1) {
      while ((lineLen = FindStartLine( copy)) == -1) {
        copy.m_writeOffset = copy.m_bytesInBuf;
        if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
          IMPORT_LOG0( "*** Error, FillMailBuffer FAILED in ReadNextMessage, looking for next start line\n");
          return( rv);
        }
        if (!copy.m_bytesInBuf) {
          IMPORT_LOG0( "*** Error, ReadNextMessage, looking for start of next line, got end of file.\n");
          return( NS_ERROR_FAILURE);
        }
      }
      copy.m_writeOffset += lineLen;
      lineLen = -1;
    }
  }

  // Skip past the from line separator
  while ((lineLen = FindStartLine( copy)) == -1) {
    copy.m_writeOffset = copy.m_bytesInBuf;
    if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
      IMPORT_LOG0( "*** Error, ReadNextMessage, FillMailBuffer failed looking for from sep\n");
      return( rv);
    }
    if (!copy.m_bytesInBuf) {
      IMPORT_LOG0( "*** Error, ReadNextMessage, end of file looking for from sep\n");
      return( NS_ERROR_FAILURE);
    }
  }
  copy.m_writeOffset += lineLen;
  if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
    IMPORT_LOG0( "*** Error, Unable to fill mail buffer after from sep.\n");
    return( rv);
  }

  // This should be the headers...
  PRInt32 endLen = -1;
  while ((endLen = IsEndHeaders( copy)) == -1) {
    while ((lineLen = FindNextEndLine( copy)) == -1) {
      copy.m_writeOffset = copy.m_bytesInBuf;
      if (!header.Write( copy.m_pBuffer, copy.m_writeOffset)) {
        IMPORT_LOG0( "*** ERROR, writing headers\n");
        return( NS_ERROR_FAILURE);
      }
      if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
        IMPORT_LOG0( "*** Error reading message headers\n");
        return( rv);
      }
      if (!copy.m_bytesInBuf) {
        IMPORT_LOG0( "*** Error, end of file while reading headers\n");
        return( NS_ERROR_FAILURE);
      }
    }
    copy.m_writeOffset += lineLen;
    if ((copy.m_writeOffset + 4) >= copy.m_bytesInBuf) {
      if (!header.Write( copy.m_pBuffer, copy.m_writeOffset)) {
        IMPORT_LOG0( "*** ERROR, writing headers 2\n");
        return( NS_ERROR_FAILURE);
      }
      if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
        IMPORT_LOG0( "*** Error reading message headers 2\n");
        return( rv);
      }
    }
  }

  if (!header.Write( copy.m_pBuffer, copy.m_writeOffset)) {
    IMPORT_LOG0( "*** Error writing final headers\n");
    return( NS_ERROR_FAILURE);
  }

  if (pTocEntry) {
    // This is not the prettiest spot to stick this code, but it works and it was convenient.
    char    header_str[128];

    // Write X-Mozilla-Status header
    PR_snprintf( header_str, 128, MSG_LINEBREAK X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, pTocEntry->GetMozillaStatusFlags() );
    header.Write( header_str, strlen(header_str) );

    // Write X-Mozilla-Status2 header
    PR_snprintf( header_str, 128, X_MOZILLA_STATUS2_FORMAT MSG_LINEBREAK, pTocEntry->GetMozillaStatus2Flags() );
    header.Write( header_str, strlen(header_str) );

    // Format and write X-Mozilla-Keys header
    nsCString  keywordHdr(X_MOZILLA_KEYWORDS);
    if ( pTocEntry->HasEudoraLabel() ) {
      PR_snprintf( header_str, 128, "eudoralabel%d", pTocEntry->GetLabelNumber() );
      keywordHdr.Replace(sizeof(HEADER_X_MOZILLA_KEYWORDS) + 1, strlen(header_str), header_str);
    }
    header.Write( keywordHdr.get(), keywordHdr.Length() );
  }

  if (!header.Write( &endBuffer, 1)) {
    IMPORT_LOG0( "*** Error writing header trailing null\n");
    return( NS_ERROR_FAILURE);
  }


  copy.m_writeOffset += endLen;
  if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
    IMPORT_LOG0( "*** Error reading beginning of message body\n");
    return( rv);
  }

  EmptyAttachments();

  // Get the body!
  // Read one line at a time here and look for the next separator
  nsCString tmp;
  PRBool insideEudoraTags = PR_FALSE;
  // by default we consider the body text to be plain text
  bodyType = "text/plain";

  while ((lineLen = IsEudoraFromSeparator( copy.m_pBuffer + copy.m_writeOffset, copy.m_bytesInBuf - copy.m_writeOffset, tmp)) == -1) {
    PRInt32 tagLength = 0;
    if (IsEudoraTag ( copy.m_pBuffer + copy.m_writeOffset, copy.m_bytesInBuf - copy.m_writeOffset, insideEudoraTags, bodyType, tagLength)) {
      // We don't want to keep eudora tags so skip over them.

      // let's write the previous text
      if (!body.Write( copy.m_pBuffer, copy.m_writeOffset)) {
        IMPORT_LOG0( "*** Error writing to message body\n");
        return( NS_ERROR_FAILURE);
      }

      // we want to skip over the tag...for now we are assuming the tag is always at the start of line.
      copy.m_writeOffset += tagLength;
        if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
          IMPORT_LOG0( "*** Error reading message body\n");
          return( rv);
        }

      if (!copy.m_bytesInBuf)
        break;

      continue;
    }

    // Eudora Attachment lines are always outside Eudora Tags
    // so we shouldn't try to find one here
    if (!insideEudoraTags) {
    // Debatable is whether or not to exclude these lines from the
    // text of the message, I prefer not to in case the original
    // attachment is actually missing.
    rv = ExamineAttachment( copy);
    if (NS_FAILED( rv)) {
      IMPORT_LOG0( "*** Error examining attachment line\n");
      return( rv);
    }
    }


    while (((lineLen = FindStartLine( copy)) == -1) && copy.m_bytesInBuf) {
      copy.m_writeOffset = copy.m_bytesInBuf;
      if (!body.Write( copy.m_pBuffer, copy.m_writeOffset)) {
        IMPORT_LOG0( "*** Error writing to message body\n");
        return( NS_ERROR_FAILURE);
      }
      if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
        IMPORT_LOG0( "*** Error reading message body\n");
        return( rv);
      }
    }
    if (!copy.m_bytesInBuf)
      break;

    copy.m_writeOffset += lineLen;

    // found the start of the next line
    // make sure it's long enough to check for the from line
    if ((copy.m_writeOffset + 2048) >= copy.m_bytesInBuf) {
      if (!body.Write( copy.m_pBuffer, copy.m_writeOffset)) {
        IMPORT_LOG0( "*** Error writing to message body 2\n");
        return( NS_ERROR_FAILURE);
      }
      if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
        IMPORT_LOG0( "*** Error reading message body 2\n");
        return( rv);
      }
    }
  }

  // the start of the current line is a from, we-re done
  if (!body.Write( copy.m_pBuffer, copy.m_writeOffset)) {
    IMPORT_LOG0( "*** Error writing final message body\n");
    return( NS_ERROR_FAILURE);
  }
  if (!body.Write( &endBuffer, 1)) {
    IMPORT_LOG0( "*** Error writing body trailing null\n");
    IMPORT_LOG2( "\tbody.m_size: %ld, body.m_writeOffset: %ld\n", body.m_size, body.m_writeOffset);
    return( NS_ERROR_FAILURE);
  }
  if (NS_FAILED( rv = FillMailBuffer( pState, copy))) {
    IMPORT_LOG0( "*** Error filling mail buffer for next read message\n");
    return( rv);
  }

  return( NS_OK);
}



PRInt32  nsEudoraMailbox::FindStartLine( SimpleBufferTonyRCopiedOnce& data)
{
  PRInt32 len = data.m_bytesInBuf - data.m_writeOffset;
  if (!len)
    return( -1);
  PRInt32  count = 0;
  const char *pData = data.m_pBuffer + data.m_writeOffset;
  while ((count < len) && (*pData != 0x0D) && (*pData != 0x0A)) {
    pData++;
    count++;
  }
  if (count == len)
    return( -1);

  while ((count < len) && ((*pData == 0x0D) || (*pData == 0x0A))) {
    pData++;
    count++;
  }

  if (count < len)
    return( count);

  return( -1);
}

PRInt32 nsEudoraMailbox::FindNextEndLine( SimpleBufferTonyRCopiedOnce& data)
{
  PRInt32 len = data.m_bytesInBuf - data.m_writeOffset;
  if (!len)
    return( -1);
  PRInt32  count = 0;
  const char *pData = data.m_pBuffer + data.m_writeOffset;
  while ((count < len) && ((*pData == 0x0D) || (*pData == 0x0A))) {
    pData++;
    count++;
  }
  while ((count < len) && (*pData != 0x0D) && (*pData != 0x0A)) {
    pData++;
    count++;
  }

  if (count < len)
    return( count);

  return( -1);
}


PRInt32 nsEudoraMailbox::IsEndHeaders( SimpleBufferTonyRCopiedOnce& data)
{
  PRInt32 len = data.m_bytesInBuf - data.m_writeOffset;
  if (len < 2)
    return( -1);
  const char *pChar = data.m_pBuffer + data.m_writeOffset;
  if ((*pChar == 0x0D) && (*(pChar + 1) == 0x0D))
    return( 2);

  if (len < 4)
    return( -1);
  if ((*pChar == 0x0D) && (*(pChar + 1) == 0x0A) &&
    (*(pChar + 2) == 0x0D) && (*(pChar + 3) == 0x0A))
    return( 4);

  return( -1);
}




static char *eudoraTag[] = {
  "<x-html>",
  "</x-html>",
  "<x-rich>",
  "</x-rich>",
  "<x-flowed>",
  "</x-flowed>"
};

static PRInt32 eudoraTagLen[] = {
  8,
  9,
  8,
  9,
  10,
  11,
  0
};


static const char *TagContentType[] = {
  "text/html",
  "text/html",
  "text/enriched",
  "text/enriched",
  "text/plain",
  "text/plain",
};


  // Determine if this line contains an eudora special tag
PRBool  nsEudoraMailbox::IsEudoraTag( const char *pChar, PRInt32 maxLen, PRBool &insideEudoraTags, nsCString &bodyType, PRInt32 &tagLength)
{
  PRInt32  idx = 0;
  while ((tagLength = eudoraTagLen[idx]) != 0) {
    if (maxLen >= tagLength && !strncmp( eudoraTag[idx], pChar, tagLength)) {
      insideEudoraTags = (pChar[1] != '/');
      bodyType = TagContentType[idx];
      return PR_TRUE;
    }
    idx++;
  }

  return PR_FALSE;
}

  // Determine if this line meets Eudora standards for a separator line
  // This logic is based on Eudora 1.3.1's strict requirements for what
  // makes a valid separator line.  This may need to be relaxed for newer
  // versions of Eudora.
  // A sample from line:
  // From john@uxc.cso.uiuc.edu Wed Jan 14 12:36:18 1989
PRInt32  nsEudoraMailbox::IsEudoraFromSeparator( const char *pChar, PRInt32 maxLen, nsCString& defaultDate)
{
  if (maxLen < 12)
    return( -1);

  PRInt32    len = 0;
  if ((*pChar != 'F') || (*(pChar + 1) != 'r') || (*(pChar + 2) != 'o') || (*(pChar + 3) != 'm'))
    return( -1);
  pChar += 4;
  len += 4;

  // According to Eudora the next char MUST be a space, and there can only be 1 space
  // before the return mail address.
  // I'll be nicer and allow any amount of whitespace
  while (((*pChar == ' ') || (*pChar == '\t')) && (len < maxLen)) {
    pChar++;
    len++;
  }
  if (len == maxLen)
    return( -1);

  // Determine the length of the line
  PRInt32      lineLen = len;
  const char *  pTok = pChar;
  while ((lineLen < maxLen) && (*pTok != 0x0D) && (*pTok != 0x0A)) {
    lineLen++;
    pTok++;
  }

  if (len >= lineLen)
    return( -1);

  // Eudora allows the return address to be double quoted or not at all..
  // I'll allow single or double quote, but other than that, just skip
  // the return address until you hit a space char (I allow tab as well)
  char  quote = *pChar;
  if ((quote == '"') || (quote == '\'')) {
    pChar++;
    len++;
    while ((len < lineLen) && (*pChar != quote)) {
      pChar++;
      len++;
    }
    if (len == lineLen)
      return( -1);
    len++;
    pChar++;
  }
  else {
    while ((len < lineLen) && (*pChar != ' ') && (*pChar != '\t')) {
      pChar++;
      len++;
    }
  }
  while (((*pChar == ' ') || (*pChar == '\t')) && (len < lineLen)) {
    pChar++;
    len++;
  }
  if (len == lineLen)
    return( -1);

  // we've passed the address, now check for the remaining data
  // Now it gets really funky!
  // In no particular order, with token separators space, tab, comma, newline
  // a - the phrase "remote from", remote must be first, from is optional.  2 froms or 2 remotes fails
  // b - one and only one time value xx:xx or xx:xx:xx
  // c - one and only one day, 1 to 31
  // d - one and only one year, 2 digit anything or 4 digit > 1900
  // e - one and only one weekday, 3 letter abreviation
  // f - one and only one month, 3 letter abreviation
  // 2 allowable "other" tokens
  // to be valid, day, year, month, & tym must exist and other must be less than 3

  int    day = 0;
  int    month = 0;
  int    year = 0;
  int    weekDay = 0;
  int    other = 0;
  int    result;
  char  tymStr[9];  // Make it a null terminated string (used in PR_snprintf() call()).
  PRBool  tym = PR_FALSE;
  PRBool  remote = PR_FALSE;
  PRBool  from = PR_FALSE;
  PRInt32  tokLen;
  PRInt32  tokStart;
  PRInt32  num;

  while ((len < lineLen) && (other < 3)) {
    pTok = pChar;
    tokStart = len;
    while ((len < lineLen) && (*pChar != ' ') && (*pChar != '\t') && (*pChar != ',')) {
      pChar++;
      len++;
    }
    tokLen = len - tokStart;
    if (tokLen) {
      num = AsciiToLong( pTok, tokLen);
      if ((tokLen == 3) && ((result = IsWeekDayStr( pTok)) != 0)) {
        if (weekDay)
          return( -1);
        weekDay = result;
      }
      else if ((tokLen == 3) && ((result = IsMonthStr( pTok)) != 0)) {
        if (month)
          return( -1);
        month = result;
      }
      else if ((tokLen == 6) && !PL_strncasecmp( pTok, "remote", 6)) {
        if (remote || from)
          return( -1);
        remote = PR_TRUE;
      }
      else if ((tokLen == 4) && !PL_strncasecmp( pTok, "from", 4)) {
        if (!remote || from)
          return( -1);
        from = PR_TRUE;
      }
      else if ((tokLen == 4) && ((num > 1900) || !strncmp( pTok, "0000", 4))) {
        if (year)
          return( -1);
        year = (int)num;
        if (!year)
          year = 1900;
      }
      else if (!year && day && (tokLen == 2) && (*(pTok + 1) >= '0') && (*(pTok + 1) <= '9')) {
        if (num < 65)
          num += 1900;
        else
           num += 2000;
         year = (int) num;
      }
      else if ((tokLen <= 2) && (*pTok >= '0') && (*pTok <= '9')) {
        day = (int) num;
        if ((day < 1) || (day > 31))
          day = 1;
      }
      else if ((tokLen >= 5) && (pTok[2] == ':') && ((tokLen == 5) || ((tokLen == 8) && (pTok[5] == ':')))) {
        // looks like the tym...
        for (result = 0; result < (int)tokLen; result++) {
          if ((result != 2) && (result != 5)) {
            if ((pTok[result] < '0') || (pTok[result] > '9')) {
              break;
            }
          }
        }
        if (result == tokLen) {
          if (tym)
            return( -1);
          tym = PR_TRUE;
          // for future use, get the time value
          memcpy( tymStr, pTok, tokLen);
          if (tokLen == 5) {
            tymStr[5] = ':';
            tymStr[6] = '0';
            tymStr[7] = '0';
          }
          tymStr[8] = 0;
        }
        else {
          other++;
        }
      }
      else
        other++;
    }
    // Skip the space chars...
    while ((len < lineLen) && ((*pChar == ' ') || (*pChar == '\t') || (*pChar == ','))) {
      pChar++;
      len++;
    }
  } // end while (len < lineLen) token loop

  // Now let's see what we found on the line
  if (day && year && month && tym && (other < 3)) {
    // Now we need to make sure the next line
    // isn't blank!
    while (len < lineLen) {
      len++;
      pChar++;
    }
    if (len == maxLen)
      return( -1);

    if (*pChar == 0x0D) {
      len++;
      pChar++;
      if (*pChar == 0x0A) {
        len++;
        pChar++;
      }
    }
    else if (*pChar == 0x0A) {
      len++;
      pChar++;
    }
    else
      return( -1);
    if (len >= maxLen)
      return( -1);

    while (len < maxLen) {
      if ((*pChar == 0x0D) || (*pChar == 0x0A))
        return( -1);
      if ((*pChar != ' ') && (*pChar != '\t'))
        break;
      pChar++;
      len++;
    }

    // Whew!, the next line isn't blank.
    // Generate the default date header in case the date header is missing when we
    // write out headers later. The header looks like "Date: Tue, 5 Feb 2002 23:05:04"
    char date_header_str[DATE_STR_LEN];
    PR_snprintf(date_header_str, DATE_STR_LEN, "Date: %s, %2d %s %4d %s", eudoraWeekDays[weekDay-1], day, eudoraMonths[month-1], year, tymStr);
    defaultDate.Assign(date_header_str);

    return( lineLen);
  }

  return( -1);

}

PRInt32 nsEudoraMailbox::AsciiToLong( const char *pChar, PRInt32 len)
{
  PRInt32 num = 0;
  while (len) {
    if ((*pChar < '0') || (*pChar > '9'))
      return( num);
    num *= 10;
    num += (*pChar - '0');
    len--;
    pChar++;
  }
  return( num);
}


int nsEudoraMailbox::IsWeekDayStr( const char *pStr)
{
  for (int i = 0; i < 7; i++) {
    if (!PL_strncasecmp( pStr, eudoraWeekDays[i], 3))
      return( i + 1);
  }
  return( 0);
}

int nsEudoraMailbox::IsMonthStr( const char *pStr)
{
  for (int i = 0; i < 12; i++) {
    if (!PL_strncasecmp( pStr, eudoraMonths[i], 3))
      return( i + 1);
  }
  return( 0);
}

nsresult nsEudoraMailbox::WriteFromSep( nsIOutputStream *pDst)
{
  if (!m_fromLen)
    m_fromLen = strlen( eudoraFromLine);
  PRUint32  written = 0;
  nsresult rv = pDst->Write( eudoraFromLine, m_fromLen, &written);
  if (NS_SUCCEEDED( rv) && (written != m_fromLen))
    return( NS_ERROR_FAILURE);
  return( rv);
}

void nsEudoraMailbox::EmptyAttachments( void)
{
  PRInt32 max = m_attachments.Count();
  ImportAttachment *  pAttach;
  for (PRInt32 i = 0; i < max; i++) {
    pAttach = (ImportAttachment *) m_attachments.ElementAt( i);
    if (pAttach) {
      NS_Free( pAttach->description);
      NS_Free( pAttach->mimeType);
      delete pAttach;
    }
  }

  m_attachments.Clear();
}

static char *eudoraAttachLines[] = {
  "Attachment Converted:",
  "Attachment converted:",
  "Pièce jointe convertie :",
  // Japanese text encoded with Shift-JIS.
  // The meaning is "Restored attached file".
  "\x95\x9c\x8c\xb3\x82\xb3\x82\xea\x82\xbd\x93\x59\x95\x74\x83\x74\x83\x40\x83\x43\x83\x8b\x81\x46"
};

static PRInt32 eudoraAttachLen[] = {
  21,
  21,
  24,
  24,
  0
};

nsresult nsEudoraMailbox::ExamineAttachment( SimpleBufferTonyRCopiedOnce& data)
{
  // get the file, then get the mime type, and add it to the array
  // of attachments.
  PRInt32    len = data.m_bytesInBuf - data.m_writeOffset;
  const char *pChar = data.m_pBuffer + data.m_writeOffset;
  const char *pData;
  const char *pStart;
  PRInt32  nameLen;
  char  quote;
  PRInt32  cnt;
  PRInt32  idx = 0;
  while ((cnt = eudoraAttachLen[idx]) != 0) {
    if (!strncmp( eudoraAttachLines[idx], pChar, cnt)) {
      pData = pChar + cnt;
      while (((*pData == ' ') || (*pData == '\t')) && (cnt < len)) {
        cnt++;
        pData++;
      }
      if (pData != pChar) {
        quote = *pData;
        nameLen = 0;
        if ((quote == '"') || (quote == '\'')) {
          pData++;
          cnt++;
          pStart = pData;
          while ((*pData != quote) && (cnt < len)) {
            cnt++;
            pData++;
            nameLen++;
          }
        }
        else {
          pStart = pData;
          while ((*pData != 0x0D) && (*pData != 0x0A) && (cnt < len)) {
            pData++;
            cnt++;
            nameLen++;
          }
        }
        nsCString  fileName;
        fileName.Append( pStart, nameLen);
        fileName.Trim( kWhitespace);
        if (fileName.Length()) {
#ifdef XP_MACOSX
          return NS_OK;
#else
          if( AddAttachment( fileName))
            return( NS_OK);
#endif
        }
      }
    }
    idx++;
  }

  return( NS_OK);
}

PRBool nsEudoraMailbox::AddAttachment( nsCString& fileName)
{
  IMPORT_LOG1( "Found attachment: %s\n", fileName.get());

  nsresult rv;
  nsCOMPtr <nsILocalFile>  pFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_FAILED( rv))
    return( PR_FALSE);

  nsCString mimeType;
  nsCString attachmentName;
  if (NS_FAILED( GetAttachmentInfo( fileName.get(), pFile, mimeType, attachmentName)))
    return( PR_FALSE);

  ImportAttachment *a = new ImportAttachment;
  a->mimeType = ToNewCString(mimeType);
  a->description = !attachmentName.IsEmpty() ? ToNewCString(attachmentName) : strdup( "Attached File");
  a->pAttachment = pFile;

  m_attachments.AppendElement( a);

  return( PR_TRUE);
}

nsresult nsEudoraMailbox::FillMailBuffer( ReadFileState *pState, SimpleBufferTonyRCopiedOnce& read)
{
  if (read.m_writeOffset >= read.m_bytesInBuf) {
    read.m_writeOffset = 0;
    read.m_bytesInBuf = 0;
  }
  else if (read.m_writeOffset) {
    memcpy( read.m_pBuffer, read.m_pBuffer + read.m_writeOffset, read.m_bytesInBuf - read.m_writeOffset);
    read.m_bytesInBuf -= read.m_writeOffset;
    read.m_writeOffset = 0;
  }

  PRInt32  count = read.m_size - read.m_bytesInBuf;
  if (((PRUint32)count + pState->offset) > pState->size)
    count = pState->size - pState->offset;
  if (count) {
    PRUint32    bytesRead = 0;
    char *    pBuffer = read.m_pBuffer + read.m_bytesInBuf;
    nsresult  rv = pState->pInputStream->Read(pBuffer, count, &bytesRead);
    if (NS_FAILED( rv)) return( rv);
    if (bytesRead != count) return( NS_ERROR_FAILURE);
    read.m_bytesInBuf += bytesRead;
    pState->offset += bytesRead;
  }

  return( NS_OK);
}

