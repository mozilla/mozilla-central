/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgAttachment_H_
#define _nsMsgAttachment_H_

#include "nsIMsgAttachment.h"
#include "nsStringGlue.h"

class nsMsgAttachment : public nsIMsgAttachment
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGATTACHMENT

  nsMsgAttachment();
  virtual ~nsMsgAttachment();

private:
  nsresult DeleteAttachment();

  nsString    mName;
  nsCString   mUrl;
  nsCString   mUrlCharset;
  bool        mTemporary;
  bool        mSendViaCloud;
  nsCString   mCloudProviderKey;
  nsCString   mContentLocation;
  nsCString   mContentType;
  nsCString   mContentTypeParam;
  nsCString   mCharset;
  nsCString   mMacType;
  nsCString   mMacCreator;
  nsString    mHtmlAnnotation;
  int64_t     mSize;
};


#endif /* _nsMsgAttachment_H_ */
