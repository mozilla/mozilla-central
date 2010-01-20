/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 1999
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

#include "msgCore.h"
#include "nsMsgSearchCore.h"
#include "nsMsgUtils.h"
#include "nsMsgBodyHandler.h"
#include "nsMsgSearchTerm.h"
#include "nsIMsgHdr.h"
#include "nsMsgMessageFlags.h"
#include "nsISeekableStream.h"
#include "nsIInputStream.h"
#include "nsILocalFile.h"
#include "plbase64.h"
#include "prmem.h"

nsMsgBodyHandler::nsMsgBodyHandler (nsIMsgSearchScopeTerm * scope, PRUint32 offset, PRUint32 numLines, nsIMsgDBHdr* msg, nsIMsgDatabase * db)
{
  m_scope = scope;
  m_localFileOffset = offset;
  m_numLocalLines = numLines;
  PRUint32 flags;
  m_lineCountInBodyLines = NS_SUCCEEDED(msg->GetFlags(&flags)) ?
    !(flags & nsMsgMessageFlags::Offline) : PR_TRUE;
  // account for added x-mozilla-status lines, and envelope line.
  if (!m_lineCountInBodyLines)
    m_numLocalLines += 3;
  m_msgHdr = msg;
  m_db = db;
  
  // the following are variables used when the body handler is handling stuff from filters....through this constructor, that is not the
  // case so we set them to NULL.
  m_headers = NULL;
  m_headersSize = 0;
  m_Filtering = PR_FALSE; // make sure we set this before we call initialize...
  
  Initialize();  // common initialization stuff
  OpenLocalFolder();      
}

nsMsgBodyHandler::nsMsgBodyHandler(nsIMsgSearchScopeTerm * scope,
                                   PRUint64 offset, PRUint32 numLines,
                                   nsIMsgDBHdr* msg, nsIMsgDatabase* db,
                                   const char * headers, PRUint32 headersSize,
                                   PRBool Filtering)
{
  m_scope = scope;
  m_localFileOffset = offset;
  m_numLocalLines = numLines;
  PRUint32 flags;
  m_lineCountInBodyLines = NS_SUCCEEDED(msg->GetFlags(&flags)) ?
    !(flags & nsMsgMessageFlags::Offline) : PR_TRUE;
  // account for added x-mozilla-status lines, and envelope line.
  if (!m_lineCountInBodyLines)
    m_numLocalLines += 3;
  m_msgHdr = msg;
  m_db = db;
  m_headersSize = headersSize;
  m_Filtering = Filtering;
  
  Initialize();
  
  if (m_Filtering)
    m_headers = headers;
  else
    OpenLocalFolder();  // if nothing else applies, then we must be a POP folder file
}

void nsMsgBodyHandler::Initialize()
// common initialization code regardless of what body type we are handling...
{
  // Default transformations for local message search and MAPI access
  m_stripHeaders = PR_TRUE;
  m_stripHtml = PR_TRUE;
  m_partIsHtml = PR_FALSE;
  m_base64part = PR_FALSE;
  m_isMultipart = PR_FALSE;
  m_partIsText = PR_TRUE; // default is text/plain
  m_pastHeaders = PR_FALSE;
  m_headerBytesRead = 0;
}

nsMsgBodyHandler::~nsMsgBodyHandler()
{
}

PRInt32 nsMsgBodyHandler::GetNextLine (nsCString &buf)
{
  PRInt32 length = -1;          // length of incoming line or -1 eof
  PRInt32 outLength = -1;       // length of outgoing line or -1 eof
  PRBool eatThisLine = PR_TRUE;
  nsCAutoString nextLine;

  while (eatThisLine) {
    // first, handle the filtering case...this is easy....
    if (m_Filtering)
      length = GetNextFilterLine(nextLine);
    else
    {
      // 3 cases: Offline IMAP, POP, or we are dealing with a news message....
      // Offline cases should be same as local mail cases, since we're going
      // to store offline messages in berkeley format folders.
      if (m_db)
      {
         length = GetNextLocalLine (nextLine); // (2) POP
      }
    }
    
    if (length < 0)
      break; // eof in

    outLength = ApplyTransformations(nextLine, length, eatThisLine, buf);
  }

  if (outLength < 0)
    return -1; // eof out

  // For non-multipart messages, the entire message minus headers is encoded
  // ApplyTransformations can only decode a part
  if (!m_isMultipart && m_base64part)
  {
    Base64Decode(buf);
    m_base64part = PR_FALSE;
    // And reapply our transformations...
    outLength = ApplyTransformations(buf, buf.Length(), eatThisLine, buf);
  }

  return outLength;
}

void nsMsgBodyHandler::OpenLocalFolder()
{
  nsCOMPtr <nsIInputStream> inputStream;
  nsresult rv = m_scope->GetInputStream(getter_AddRefs(inputStream));
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(inputStream);
    seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, m_localFileOffset);
  }
  m_fileLineStream = do_QueryInterface(inputStream);
}

PRInt32 nsMsgBodyHandler::GetNextFilterLine(nsCString &buf)
{
  // m_nextHdr always points to the next header in the list....the list is NULL terminated...
  PRUint32 numBytesCopied = 0;
  if (m_headersSize > 0)
  {
    // #mscott. Ugly hack! filter headers list have CRs & LFs inside the NULL delimited list of header
    // strings. It is possible to have: To NULL CR LF From. We want to skip over these CR/LFs if they start
    // at the beginning of what we think is another header.
    
    while (m_headersSize > 0 && (m_headers[0] == '\r' || m_headers[0] == '\n' || m_headers[0] == ' ' || m_headers[0] == '\0'))
    {
      m_headers++;  // skip over these chars...
      m_headersSize--;
    }
    
    if (m_headersSize > 0)
    {
      numBytesCopied = strlen(m_headers) + 1 ;
      buf.Assign(m_headers);
      m_headers += numBytesCopied;  
      // be careful...m_headersSize is unsigned. Don't let it go negative or we overflow to 2^32....*yikes*  
      if (m_headersSize < numBytesCopied)
        m_headersSize = 0;
      else
        m_headersSize -= numBytesCopied;  // update # bytes we have read from the headers list
      
      return (PRInt32) numBytesCopied;
    }
  }
  else if (m_headersSize == 0) {
    buf.Truncate();
  }
  return -1;
}

// return -1 if no more local lines, length of next line otherwise.

PRInt32 nsMsgBodyHandler::GetNextLocalLine(nsCString &buf)
// returns number of bytes copied
{
  if (m_numLocalLines)
  {
    // I the line count is in body lines, only decrement once we have
    // processed all the headers.  Otherwise the line is not in body
    // lines and we want to decrement for every line.
    if (m_pastHeaders || !m_lineCountInBodyLines)
      m_numLocalLines--;
    // do we need to check the return value here?
    if (m_fileLineStream)
    {
      PRBool more = PR_FALSE;
      nsresult rv = m_fileLineStream->ReadLine(buf, &more);
      if (NS_SUCCEEDED(rv))
        return buf.Length();
    }
  }
  
  return -1;
}

/**
 * This method applies a sequence of transformations to the line.
 * 
 * It applies the following sequences in order
 * * Removes headers if the searcher doesn't want them
 *   (sets m_pastHeaders)
 * * Determines the current MIME type.
 *   (via SniffPossibleMIMEHeader)
 * * Strips any HTML if the searcher doesn't want it
 * * Strips non-text parts
 * * Decodes any base64 part
 *   (resetting part variables: m_base64part, m_pastHeaders, m_partIsHtml,
 *    m_partIsText)
 *
 * @param line        (in)    the current line
 * @param length      (in)    the length of said line
 * @param eatThisLine (out)   whether or not to ignore this line
 * @param buf         (inout) if m_base64part, the current part as needed for
 *                            decoding; else, it is treated as an out param (a
 *                            redundant version of line).
 * @return            the length of the line after applying transformations
 */
PRInt32 nsMsgBodyHandler::ApplyTransformations (const nsCString &line, PRInt32 length,
                                                PRBool &eatThisLine, nsCString &buf)
{
  PRInt32 newLength = length;
  eatThisLine = PR_FALSE;
  
  if (!m_pastHeaders)  // line is a line from the message headers
  {
    if (m_stripHeaders)
      eatThisLine = PR_TRUE;

    // We have already grabbed all worthwhile information from the headers,
    // so there is no need to keep track of the current lines
    buf.Assign(line);
   
    SniffPossibleMIMEHeader(buf);
    
    m_pastHeaders = buf.IsEmpty() || buf.First() == '\r' ||
      buf.First() == '\n';

    return length;
  }

  // Check to see if this is the boundary string
  if (m_isMultipart && StringBeginsWith(line, boundary))
  {
    if (m_base64part && m_partIsText) 
    {
      Base64Decode(buf);
      // Work on the parsed string
      if (!buf.Length())
      {
        NS_WARNING("Trying to transform an empty buffer");
        eatThisLine = PR_TRUE;
      }
      else
      {
        ApplyTransformations(buf, buf.Length(), eatThisLine, buf);
        // Avoid spurious failures
        eatThisLine = PR_FALSE;
      }
    }
    else
    {
      buf.Truncate();
      eatThisLine = PR_TRUE; // We have no content...
    }

    // Reset all assumed headers
    m_base64part = PR_FALSE;
    m_pastHeaders = PR_FALSE;
    m_partIsHtml = PR_FALSE;
    m_partIsText = PR_TRUE;

    return buf.Length();
  }
 
  if (!m_partIsText)
  {
    // Ignore non-text parts
    buf.Truncate();
    eatThisLine = PR_TRUE;
    return 0;
  }

  if (m_base64part)
  {
    // We need to keep track of all lines to parse base64encoded...
    buf.Append(line.get());
    eatThisLine = PR_TRUE;
    return buf.Length();
  }
    
  // ... but there's no point if we're not parsing base64.
  buf.Assign(line);
  if (m_stripHtml && m_partIsHtml)
  {
    StripHtml (buf);
    newLength = buf.Length();
  }
  
  return newLength;
}

void nsMsgBodyHandler::StripHtml (nsCString &pBufInOut)
{
  char *pBuf = (char*) PR_Malloc (pBufInOut.Length() + 1);
  if (pBuf)
  {
    char *pWalk = pBuf;
    
    char *pWalkInOut = (char *) pBufInOut.get();
    PRBool inTag = PR_FALSE;
    while (*pWalkInOut) // throw away everything inside < >
    {
      if (!inTag)
        if (*pWalkInOut == '<')
          inTag = PR_TRUE;
        else
          *pWalk++ = *pWalkInOut;
        else
          if (*pWalkInOut == '>')
            inTag = PR_FALSE;
          pWalkInOut++;
    }
    *pWalk = 0; // null terminator
    
    pBufInOut.Adopt(pBuf);
  }
}

/**
 * Determines the MIME type, if present, from the current line.
 *
 * m_partIsHtml, m_isMultipart, m_partIsText, m_base64part, and boundary are
 * all set by this method at various points in time.
 *
 * @param line        (in)    a header line that may contain a MIME header
 */
void nsMsgBodyHandler::SniffPossibleMIMEHeader(nsCString &line)
{
  // Some parts of MIME are case-sensitive and other parts are case-insensitive;
  // specifically, the headers are all case-insensitive and the values we care
  // about are also case-insensitive, with the sole exception of the boundary
  // string, so we can't just take the input line and make it lower case.
  nsCString lowerCaseLine(line);
  ToLowerCase(lowerCaseLine);

  if (StringBeginsWith(lowerCaseLine, NS_LITERAL_CSTRING("content-type:")))
  {
    if (lowerCaseLine.Find("text/html", PR_TRUE) != -1)
      m_partIsHtml = PR_TRUE;
    // Strenuous edge case: a message/rfc822 is equivalent to the content type
    // of whatever the message is. Headers should be ignored here. Even more
    // strenuous are message/partial and message/external-body, where the first
    // case requires reassembly across messages and the second is actually an
    // external source. And of course, there are other message types to handle.
    // RFC 3798 complicates things with the message/disposition-notification
    // MIME type. message/rfc822 is best treated as a multipart with no proper
    // boundary; since we only use boundaries for retriggering the headers,
    // the lack of one can safely be ignored.
    else if (lowerCaseLine.Find("multipart/", PR_TRUE) != -1 ||
        lowerCaseLine.Find("message/", PR_TRUE) != -1)
    {
      if (m_isMultipart)
      {
        // This means we have a nested multipart tree. Since we currently only
        // handle the first children, we are probably better off assuming that
        // this nested part is going to have text/* children. After all, the
        // biggest usage that I've seen is multipart/signed.
        m_partIsText = PR_TRUE;
      }
      m_isMultipart = PR_TRUE;
    }
    else if (lowerCaseLine.Find("text/", PR_TRUE) == -1)
      m_partIsText = PR_FALSE; // We have disproved our assumption
  }

  // TODO: make this work for nested multiparts (requires some redesign)
  if (m_isMultipart && boundary.IsEmpty() &&
      lowerCaseLine.Find("boundary=", PR_TRUE) != -1)
  {
    PRInt32 start = lowerCaseLine.Find("boundary=", PR_TRUE);
    start += 9;
    if (line[start] == '\"')
      start++;
    PRInt32 end = line.RFindChar('\"');
    if (end == -1)
      end = line.Length();

    boundary.Assign("--");
    boundary.Append(Substring(line,start,end-start));
  }

#ifdef MOZILLA_INTERNAL_API
  if (StringBeginsWith(lowerCaseLine,
                       NS_LITERAL_CSTRING("content-transfer-encoding:")) &&
      lowerCaseLine.Find("base64", PR_TRUE) != kNotFound)
#else
  if (StringBeginsWith(lowerCaseLine,
                       NS_LITERAL_CSTRING("content-transfer-encoding:")) &&
      lowerCaseLine.Find("base64", PR_TRUE) != -1)
#endif
    m_base64part = PR_TRUE;
}

/**
 * Decodes the given base64 string.
 *
 * It returns its decoded string in its input.
 *
 * @param pBufInOut   (inout) a buffer of the string
 */
void nsMsgBodyHandler::Base64Decode (nsCString &pBufInOut)
{
  char *decodedBody = PL_Base64Decode(pBufInOut.get(), pBufInOut.Length(), nsnull);
  if (decodedBody)
    pBufInOut.Adopt(decodedBody);

  PRInt32 offset = pBufInOut.FindChar('\n');
  while (offset != -1) {
    pBufInOut.Replace(offset, 1, ' ');
    offset = pBufInOut.FindChar('\n', offset);
  }
  offset = pBufInOut.FindChar('\r');
  while (offset != -1) {
    pBufInOut.Replace(offset, 1, ' ');
    offset = pBufInOut.FindChar('\r', offset);
  } 
}

