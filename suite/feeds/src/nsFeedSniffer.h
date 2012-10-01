/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIContentSniffer.h"
#include "nsIStreamListener.h"
#include "nsStringAPI.h"
#include "mozilla/Attributes.h"

#define NS_FEEDSNIFFER_CONTRACTID \
  "@mozilla.org/browser/feeds/sniffer;1"

// {E5EEEF51-05CE-4885-9434-7287616D9547}
#define NS_FEEDSNIFFER_CID \
  { 0xe5eeef51, 0x5ce, 0x4885, { 0x94, 0x34, 0x72, 0x87, 0x61, 0x6d, 0x95, 0x47 } }


class nsFeedSniffer MOZ_FINAL : public nsIContentSniffer, nsIStreamListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSICONTENTSNIFFER
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSISTREAMLISTENER

  static NS_METHOD AppendSegmentToString(nsIInputStream* inputStream,
                                         void* closure,
                                         const char* rawSegment,
                                         uint32_t toOffset,
                                         uint32_t count,
                                         uint32_t* writeCount);

protected:
  nsresult ConvertEncodedData(nsIRequest* request, const uint8_t* data,
                              uint32_t length);

private:
  nsCString mDecodedData;
};
