/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsNewsDownloadDialogArgs_h__
#define nsNewsDownloadDialogArgs_h__

#include "nsINewsDownloadDialogArgs.h"
#include "nsStringGlue.h"

class nsNewsDownloadDialogArgs : public nsINewsDownloadDialogArgs
{
public:
  nsNewsDownloadDialogArgs();
  virtual ~nsNewsDownloadDialogArgs();

  NS_DECL_ISUPPORTS
  NS_DECL_NSINEWSDOWNLOADDIALOGARGS

private:
  nsString mGroupName;
  int32_t mArticleCount;
  nsCString mServerKey;
  bool mHitOK;
  bool mDownloadAll;
};

#endif // nsNewsDownloadDialogArgs_h__
