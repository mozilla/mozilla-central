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
 * The Original Code is Mailnews import code.
 *
 * The Initial Developer of the Original Code is 
 * Håkan Waara <hwaara@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
                                                        PRUint32 *aMozillaStatusFlags)
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
  const PRUint32 emlxMessageFlags = [[(NSDictionary *)plist objectForKey:@"flags"] intValue];

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
          fromLineStart++;
          foundFromLines.AppendElement(aMessageBufferStart);
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
    // pre-grow the string to the right size
    aOutBuffer.SetLength((aMessageBufferEnd-aMessageBufferStart) + foundFromLines.Length());

    const char *chunkStart = aMessageBufferStart;
    for (unsigned i=0; i<foundFromLines.Length(); ++i) {
      aOutBuffer.Append(chunkStart, (foundFromLines[i]-chunkStart));
      aOutBuffer.Append(NS_LITERAL_CSTRING(">"));

      chunkStart = foundFromLines[i];
    }
  }

  return NS_OK;
}

nsresult nsEmlxHelperUtils::AddEmlxMessageToStream(nsILocalFile *aMessage, nsIOutputStream *aOut)
{
  NS_OBJC_BEGIN_TRY_ABORT_BLOCK_NSRESULT;

  // needed to be sure autoreleased objects are released too, which they might not
  // in a C++ environment where the main event loop has no autorelease pool (e.g on a XPCOM thread)
  NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];

  nsresult rv = NS_ERROR_FAILURE;

  nsCAutoString path;
  aMessage->GetNativePath(path);

  NSData *data = [NSData dataWithContentsOfFile:[NSString stringWithUTF8String:path.get()]]; 
  if (!data) {
    [pool release];
    return NS_ERROR_FAILURE;
  }

  char *startOfMessageData = NULL;
  PRUint32 actualBytesWritten = 0;

  // The anatomy of an EMLX file:
  //
  // -------------------------------
  // < A number describing how many bytes ahead there is message data >
  // < Message data >
  // < XML metadata for this message >
  // -------------------------------

  // read the first line of the emlx file, which is a number of how many bytes ahead the actual
  // message data is. 
  PRUint64 numberOfBytesToRead = strtol((char *)[data bytes], &startOfMessageData, 10);
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

  PRUint32 x_mozilla_flags = 0;
  ConvertToMozillaStatusFlags(startOfXMLMetadata, endOfXMLMetadata, &x_mozilla_flags);

  // write the X-Mozilla-Status header according to which flags we've gathered above.
  PRUint32 dummyRv;
  nsCAutoString buf(PR_smprintf(X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, x_mozilla_flags));
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
  char x_mozilla_status_2[40];
  PR_snprintf(x_mozilla_status_2, sizeof(x_mozilla_status_2), X_MOZILLA_STATUS2_FORMAT MSG_LINEBREAK, 0);
  rv = aOut->Write(x_mozilla_status_2, strlen(x_mozilla_status_2), &dummyRv);
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
    rv = aOut->Write(startOfMessageData, (PRUint32)numberOfBytesToRead, &actualBytesWritten);
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
