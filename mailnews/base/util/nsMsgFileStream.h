/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/Attributes.h"
#include "msgCore.h"
#include "nsIInputStream.h"
#include "nsIOutputStream.h"
#include "nsISeekableStream.h"
#include "prio.h"

class nsMsgFileStream : public nsIInputStream, public nsIOutputStream, public nsISeekableStream
{
public:
  nsMsgFileStream();
  ~nsMsgFileStream();

  NS_DECL_ISUPPORTS

  NS_IMETHOD Available(uint64_t *_retval) MOZ_OVERRIDE; 
  NS_IMETHOD Read(char * aBuf, uint32_t aCount, uint32_t *_retval) MOZ_OVERRIDE; 
  NS_IMETHOD ReadSegments(nsWriteSegmentFun aWriter, void * aClosure, uint32_t aCount, uint32_t *_retval) MOZ_OVERRIDE;
  NS_DECL_NSIOUTPUTSTREAM
  NS_DECL_NSISEEKABLESTREAM

  nsresult InitWithFile(nsIFile *localFile);
protected:
  PRFileDesc *mFileDesc;
  bool mSeekedToEnd;
};
