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

#ifndef nsEmlxHelperUtils_h___
#define nsEmlxHelperUtils_h___

#include "nscore.h"
#include "nsStringGlue.h"

class nsIOutputStream;
class nsILocalFile;

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
  static nsresult ConvertToMozillaStatusFlags(const char *aXMLBufferStart, const char *aXMLBufferEnd, PRUint32 *aMozillaStatusFlags);

  public:

  // add an .emlx message to the mbox output
  static nsresult AddEmlxMessageToStream(nsILocalFile *aEmlxFile, nsIOutputStream *aOutoutStream); 

};

#endif // nsEmlxHelperUtils_h___ 
