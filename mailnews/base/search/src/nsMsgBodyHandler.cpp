/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsMsgSearchCore.h"
#include "nsMsgUtils.h"
#include "nsMsgBodyHandler.h"
#include "nsMsgSearchTerm.h"
#include "nsIMsgHdr.h"
#include "nsMsgMessageFlags.h"
#include "nsISeekableStream.h"
#include "nsIInputStream.h"
#include "nsIFile.h"
#include "plbase64.h"
#include "prmem.h"
#include "nsMimeTypes.h"

nsMsgBodyHandler::nsMsgBodyHandler (nsIMsgSearchScopeTerm * scope,
                                    uint32_t numLines,
                                    nsIMsgDBHdr* msg, nsIMsgDatabase * db)
{
  m_scope = scope;
  m_numLocalLines = numLines;
  uint32_t flags;
  m_lineCountInBodyLines = NS_SUCCEEDED(msg->GetFlags(&flags)) ?
    !(flags & nsMsgMessageFlags::Offline) : true;
  // account for added x-mozilla-status lines, and envelope line.
  if (!m_lineCountInBodyLines)
    m_numLocalLines += 3;
  m_msgHdr = msg;
  m_db = db;
  
  // the following are variables used when the body handler is handling stuff from filters....through this constructor, that is not the
  // case so we set them to NULL.
  m_headers = NULL;
  m_headersSize = 0;
  m_Filtering = false; // make sure we set this before we call initialize...
  
  Initialize();  // common initialization stuff
  OpenLocalFolder();      
}

nsMsgBodyHandler::nsMsgBodyHandler(nsIMsgSearchScopeTerm * scope,
                                   uint32_t numLines,
                                   nsIMsgDBHdr* msg, nsIMsgDatabase* db,
                                   const char * headers, uint32_t headersSize,
                                   bool Filtering)
{
  m_scope = scope;
  m_numLocalLines = numLines;
  uint32_t flags;
  m_lineCountInBodyLines = NS_SUCCEEDED(msg->GetFlags(&flags)) ?
    !(flags & nsMsgMessageFlags::Offline) : true;
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
  m_stripHeaders = true;
  m_stripHtml = true;
  m_partIsHtml = false;
  m_base64part = false;
  m_isMultipart = false;
  m_partIsText = true; // default is text/plain
  m_pastHeaders = false;
  m_headerBytesRead = 0;
}

nsMsgBodyHandler::~nsMsgBodyHandler()
{
}

int32_t nsMsgBodyHandler::GetNextLine (nsCString &buf)
{
  int32_t length = -1;          // length of incoming line or -1 eof
  int32_t outLength = -1;       // length of outgoing line or -1 eof
  bool eatThisLine = true;
  nsAutoCString nextLine;

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
    m_base64part = false;
    // And reapply our transformations...
    outLength = ApplyTransformations(buf, buf.Length(), eatThisLine, buf);
  }

  return outLength;
}

void nsMsgBodyHandler::OpenLocalFolder()
{
  nsCOMPtr <nsIInputStream> inputStream;
  nsresult rv = m_scope->GetInputStream(m_msgHdr, getter_AddRefs(inputStream));
  // Warn and return if GetInputStream fails
  NS_ENSURE_SUCCESS_VOID(rv);
  m_fileLineStream = do_QueryInterface(inputStream);
}

int32_t nsMsgBodyHandler::GetNextFilterLine(nsCString &buf)
{
  // m_nextHdr always points to the next header in the list....the list is NULL terminated...
  uint32_t numBytesCopied = 0;
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
      
      return (int32_t) numBytesCopied;
    }
  }
  else if (m_headersSize == 0) {
    buf.Truncate();
  }
  return -1;
}

// return -1 if no more local lines, length of next line otherwise.

int32_t nsMsgBodyHandler::GetNextLocalLine(nsCString &buf)
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
      bool more = false;
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
int32_t nsMsgBodyHandler::ApplyTransformations (const nsCString &line, int32_t length,
                                                bool &eatThisLine, nsCString &buf)
{
  int32_t newLength = length;
  eatThisLine = false;
  
  if (!m_pastHeaders)  // line is a line from the message headers
  {
    if (m_stripHeaders)
      eatThisLine = true;

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
        eatThisLine = true;
      }
      else
      {
        ApplyTransformations(buf, buf.Length(), eatThisLine, buf);
        // Avoid spurious failures
        eatThisLine = false;
      }
    }
    else
    {
      buf.Truncate();
      eatThisLine = true; // We have no content...
    }

    // Reset all assumed headers
    m_base64part = false;
    m_pastHeaders = false;
    m_partIsHtml = false;
    m_partIsText = true;

    return buf.Length();
  }
 
  if (!m_partIsText)
  {
    // Ignore non-text parts
    buf.Truncate();
    eatThisLine = true;
    return 0;
  }

  if (m_base64part)
  {
    // We need to keep track of all lines to parse base64encoded...
    buf.Append(line.get());
    eatThisLine = true;
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
    bool inTag = false;
    while (*pWalkInOut) // throw away everything inside < >
    {
      if (!inTag)
        if (*pWalkInOut == '<')
          inTag = true;
        else
          *pWalk++ = *pWalkInOut;
        else
          if (*pWalkInOut == '>')
            inTag = false;
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
    if (lowerCaseLine.Find("text/html", CaseInsensitiveCompare) != -1)
      m_partIsHtml = true;
    // Strenuous edge case: a message/rfc822 is equivalent to the content type
    // of whatever the message is. Headers should be ignored here. Even more
    // strenuous are message/partial and message/external-body, where the first
    // case requires reassembly across messages and the second is actually an
    // external source. And of course, there are other message types to handle.
    // RFC 3798 complicates things with the message/disposition-notification
    // MIME type. message/rfc822 is best treated as a multipart with no proper
    // boundary; since we only use boundaries for retriggering the headers,
    // the lack of one can safely be ignored.
    else if (lowerCaseLine.Find("multipart/", CaseInsensitiveCompare) != -1 ||
        lowerCaseLine.Find("message/", CaseInsensitiveCompare) != -1)
    {
      if (m_isMultipart)
      {
        // This means we have a nested multipart tree. Since we currently only
        // handle the first children, we are probably better off assuming that
        // this nested part is going to have text/* children. After all, the
        // biggest usage that I've seen is multipart/signed.
        m_partIsText = true;
      }
      m_isMultipart = true;
    }
    else if (lowerCaseLine.Find("text/", CaseInsensitiveCompare) == -1)
      m_partIsText = false; // We have disproved our assumption
  }

  // TODO: make this work for nested multiparts (requires some redesign)
  if (m_isMultipart && boundary.IsEmpty() &&
      lowerCaseLine.Find("boundary=", CaseInsensitiveCompare) != -1)
  {
    int32_t start = lowerCaseLine.Find("boundary=", CaseInsensitiveCompare);
    start += 9;
    if (line[start] == '\"')
      start++;
    int32_t end = line.RFindChar('\"');
    if (end == -1)
      end = line.Length();

    boundary.Assign("--");
    boundary.Append(Substring(line,start,end-start));
  }

  if (StringBeginsWith(lowerCaseLine,
                       NS_LITERAL_CSTRING("content-transfer-encoding:")) &&
      lowerCaseLine.Find(ENCODING_BASE64, CaseInsensitiveCompare) != kNotFound)
    m_base64part = true;
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
  char *decodedBody = PL_Base64Decode(pBufInOut.get(), pBufInOut.Length(), nullptr);
  if (decodedBody)
    pBufInOut.Adopt(decodedBody);

  int32_t offset = pBufInOut.FindChar('\n');
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

