/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsEmlxHelperUtils.h"
#include "nsIFileStreams.h"
#include "nsIBufferedStreams.h"
#include "nsIOutputStream.h"
#include "nsNetUtil.h"
#include "nsCOMPtr.h"
#include "nsObjCExceptions.h"
#include "nsMsgMessageFlags.h"
#include "nsMsgLocalFolderHdrs.h"
#include "msgCore.h"
#include "nsTArray.h"
#include "nsAppleMailImport.h"
#include "prprf.h"

#import <Cocoa/Cocoa.h>


nsresult nsEmlxHelperUtils::ConvertToMozillaStatusFlags(const char *aXMLBufferStart, 
                                                        const char *aXMLBufferEnd, 
                                                        uint32_t *aMozillaStatusFlags)
{
  // create a NSData wrapper around the buffer, so we can use the Cocoa call below
  NSData *metadata = 
    [[[NSData alloc] initWithBytesNoCopy:(void *)aXMLBufferStart length:(aXMLBufferEnd-aXMLBufferStart) freeWhenDone:NO] autorelease];

  // get the XML data as a dictionary
  NSPropertyListFormat format;
  id plist = [NSPropertyListSerialization propertyListFromData:metadata
                                              mutabilityOption:NSPropertyListImmutable
                                                        format:&format
                                              errorDescription:NULL];

  if (!plist)
    return NS_ERROR_FAILURE;

  // find the <flags>...</flags> value and convert to int
  const uint32_t emlxMessageFlags = [[(NSDictionary *)plist objectForKey:@"flags"] intValue];

  if (emlxMessageFlags == 0)
    return NS_ERROR_FAILURE;

  if (emlxMessageFlags & nsEmlxHelperUtils::kRead) 
    *aMozillaStatusFlags |= nsMsgMessageFlags::Read;
  if (emlxMessageFlags & nsEmlxHelperUtils::kForwarded)
    *aMozillaStatusFlags |= nsMsgMessageFlags::Forwarded;
  if (emlxMessageFlags & nsEmlxHelperUtils::kAnswered)
    *aMozillaStatusFlags |= nsMsgMessageFlags::Replied;
  if (emlxMessageFlags & nsEmlxHelperUtils::kFlagged)
    *aMozillaStatusFlags |= nsMsgMessageFlags::Marked;

  return NS_OK;
}

nsresult nsEmlxHelperUtils::ConvertToMboxRD(const char *aMessageBufferStart, const char *aMessageBufferEnd, nsCString &aOutBuffer)
{
  nsTArray<const char *> foundFromLines;

  const char *cur = aMessageBufferStart;
  while (cur < aMessageBufferEnd) {

    const char *foundFromStr = strnstr(cur, "From ", aMessageBufferEnd-cur);

    if (foundFromStr) {
      // skip all prepending '>' chars 
      const char *fromLineStart = foundFromStr;
      while (fromLineStart-- >= aMessageBufferStart) {
        if (*fromLineStart == '\n' || fromLineStart == aMessageBufferStart) {
          if (fromLineStart > aMessageBufferStart)
            fromLineStart++;
          foundFromLines.AppendElement(fromLineStart);
          break;
        }
        else if (*fromLineStart != '>')
          break;
      }

      // advance past the last found From string.
      cur = foundFromStr + 5;

      // look for more From lines.
      continue;
    } 

    break;
  }

  // go through foundFromLines
  if (foundFromLines.Length()) {

    const char *chunkStart = aMessageBufferStart;
    for (unsigned i=0; i<foundFromLines.Length(); ++i) {
      aOutBuffer.Append(chunkStart, (foundFromLines[i]-chunkStart));
      aOutBuffer.Append(NS_LITERAL_CSTRING(">"));

      chunkStart = foundFromLines[i];
    }
    aOutBuffer.Append(chunkStart, (aMessageBufferEnd - chunkStart));
  }

  return NS_OK;
}

nsresult nsEmlxHelperUtils::AddEmlxMessageToStream(nsIFile *aMessage, nsIOutputStream *aOut)
{
  NS_OBJC_BEGIN_TRY_ABORT_BLOCK_NSRESULT;

  // needed to be sure autoreleased objects are released too, which they might not
  // in a C++ environment where the main event loop has no autorelease pool (e.g on a XPCOM thread)
  NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];

  nsresult rv = NS_ERROR_FAILURE;

  nsAutoCString path;
  aMessage->GetNativePath(path);

  NSData *data = [NSData dataWithContentsOfFile:[NSString stringWithUTF8String:path.get()]]; 
  if (!data) {
    [pool release];
    return NS_ERROR_FAILURE;
  }

  char *startOfMessageData = NULL;
  uint32_t actualBytesWritten = 0;

  // The anatomy of an EMLX file:
  //
  // -------------------------------
  // < A number describing how many bytes ahead there is message data >
  // < Message data >
  // < XML metadata for this message >
  // -------------------------------

  // read the first line of the emlx file, which is a number of how many bytes ahead the actual
  // message data is. 
  uint64_t numberOfBytesToRead = strtol((char *)[data bytes], &startOfMessageData, 10);
  if (numberOfBytesToRead <= 0 || !startOfMessageData) {
    [pool release];
    return NS_ERROR_FAILURE;
  }

  // skip whitespace
  while (*startOfMessageData == ' '  || 
         *startOfMessageData == '\n' || 
         *startOfMessageData == '\r' || 
         *startOfMessageData == '\t')
    ++startOfMessageData;

  NS_NAMED_LITERAL_CSTRING(kBogusFromLine, "From \n");
  NS_NAMED_LITERAL_CSTRING(kEndOfMessage, "\n\n");

  // write the bogus "From " line which is a magic separator in the mbox format
  rv = aOut->Write(kBogusFromLine.get(), kBogusFromLine.Length(), &actualBytesWritten);
  if (NS_FAILED(rv)) {
    [pool release];
    return rv;
  }

  // now read the XML metadata, so we can extract info like which flags (read? replied? flagged? etc) this message has.
  const char *startOfXMLMetadata = startOfMessageData + numberOfBytesToRead;
  const char *endOfXMLMetadata = (char *)[data bytes] + [data length];

  uint32_t x_mozilla_flags = 0;
  ConvertToMozillaStatusFlags(startOfXMLMetadata, endOfXMLMetadata, &x_mozilla_flags);

  // write the X-Mozilla-Status header according to which flags we've gathered above.
  uint32_t dummyRv;
  nsAutoCString buf(PR_smprintf(X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, x_mozilla_flags));
  NS_ASSERTION(!buf.IsEmpty(), "printf error with X-Mozilla-Status header");
  if (buf.IsEmpty()) {
    [pool release];
    return rv;
  }

  rv = aOut->Write(buf.get(), buf.Length(), &dummyRv);
  if (NS_FAILED(rv)) {
    [pool release];
    return rv;
  }
  
  // write out X-Mozilla-Keywords header as well to reserve some space for it 
  // in the mbox file.
  rv = aOut->Write(X_MOZILLA_KEYWORDS, X_MOZILLA_KEYWORDS_LEN, &dummyRv);
  if (NS_FAILED(rv)) {
    [pool release];
    return rv;
  }
  
  // write out empty X-Mozilla_status2 header
  buf.Adopt(PR_smprintf(X_MOZILLA_STATUS2_FORMAT MSG_LINEBREAK, 0));
  NS_ASSERTION(!buf.IsEmpty(), "printf error with X-Mozilla-Status2 header");
  if (buf.IsEmpty()) {
    [pool release];
    return NS_ERROR_OUT_OF_MEMORY;
  }

  rv = aOut->Write(buf.get(), buf.Length(), &dummyRv);
  if (NS_FAILED(rv)) {
    [pool release];
    return rv;
  }
  
  // do any conversion needed for the mbox data to be valid mboxrd.
  nsCString convertedData;
  rv = ConvertToMboxRD(startOfMessageData, (startOfMessageData + numberOfBytesToRead), convertedData);
  if (NS_FAILED(rv)) {
    [pool release];
    return rv;
  }

  // write the actual message data.
  if (convertedData.IsEmpty())
    rv = aOut->Write(startOfMessageData, (uint32_t)numberOfBytesToRead, &actualBytesWritten);
  else {
    IMPORT_LOG1("Escaped From-lines in %s!", path.get());
    rv = aOut->Write(convertedData.get(), convertedData.Length(), &actualBytesWritten);
  }

  if (NS_FAILED(rv)) {
    [pool release];
    return rv;
  }

  NS_ASSERTION(actualBytesWritten == (convertedData.IsEmpty() ? numberOfBytesToRead : convertedData.Length()),
               "Didn't write as many bytes as expected for .emlx file?");

  // add newlines to denote the end of this message in the mbox
  rv = aOut->Write(kEndOfMessage.get(), kEndOfMessage.Length(), &actualBytesWritten);

  [pool release];

  return rv;

  NS_OBJC_END_TRY_ABORT_BLOCK_NSRESULT;
}
