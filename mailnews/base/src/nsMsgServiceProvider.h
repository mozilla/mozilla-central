/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMsgServiceProvider_h
#define __nsMsgServiceProvider_h

#include "nsIRDFDataSource.h"
#include "nsIRDFRemoteDataSource.h"
#include "nsIRDFCompositeDataSource.h"
#include "nsCOMPtr.h"

class nsMsgServiceProviderService : public nsIRDFDataSource
{

 public:
  nsMsgServiceProviderService();
  virtual ~nsMsgServiceProviderService();

  nsresult Init();
  
  NS_DECL_ISUPPORTS
  NS_FORWARD_NSIRDFDATASOURCE(mInnerDataSource->)
  
 private:
  nsCOMPtr<nsIRDFCompositeDataSource> mInnerDataSource;
  nsresult LoadDataSource(const char *aURL);

  void LoadISPFilesFromDir(nsIFile* aDir);
  void LoadISPFiles();
};
#endif
