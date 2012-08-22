/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEmlxHelperUtils_h___
#define nsEmlxHelperUtils_h___

#include "nscore.h"
#include "nsStringGlue.h"

class nsIOutputStream;
class nsIFile;

class nsEmlxHelperUtils {
  /* All emlx messages have a "flags" number in the metadata. 
     These are the masks to decode that, found via http://jwz.livejournal.com/505711.html */
  enum EmlxMetadataMask {
    kRead       = 1 << 0,  // read
    // 1 << 1,             // deleted
    kAnswered   = 1 << 2,  // answered
    // 1 << 3,             // encrypted
    kFlagged    = 1 << 4,  // flagged
    // 1 << 5,             // recent
    // 1 << 6,             // draft
    // 1 << 7,             // initial (no longer used)
    kForwarded  = 1 << 8,  // forwarded
    // 1 << 9,             // redirected
    // 3F << 10,           // attachment count (6 bits)
    // 7F << 16,           // priority level (7 bits)
    // 1 << 23,            // signed
    // 1 << 24,            // is junk
    // 1 << 25,            // is not junk
    // 1 << 26,            // font size delta 7 (3 bits)
    // 1 << 29,            // junk mail level recorded 
    // 1 << 30,            // highlight text in toc
    // 1 << 31             // (unused)
  };

  // This method will scan the raw EMLX message buffer for "dangerous" so-called "From-lines" that we need to escape.
  // If it needs to modify any lines, it will return a non-NULL aOutBuffer. If aOutBuffer is NULL, no modification needed
  // to be made.
  static nsresult ConvertToMboxRD(const char *aMessageBufferStart, const char *aMessageBufferEnd, nsCString &aOutBuffer);

  // returns an int representing the X-Mozilla-Status flags set (e.g. "read", "flagged") converted from EMLX flags.
  static nsresult ConvertToMozillaStatusFlags(const char *aXMLBufferStart, const char *aXMLBufferEnd, uint32_t *aMozillaStatusFlags);

  public:

  // add an .emlx message to the mbox output
  static nsresult AddEmlxMessageToStream(nsIFile *aEmlxFile, nsIOutputStream *aOutoutStream); 

};

#endif // nsEmlxHelperUtils_h___ 
