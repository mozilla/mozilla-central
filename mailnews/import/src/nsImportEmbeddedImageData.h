/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __IMPORTEMBEDDEDIMAGETDATA_H__
#define __IMPORTEMBEDDEDIMAGETDATA_H__

#include "nsIMsgSend.h"
#include "nsString.h"
#include "nsIURI.h"

class nsImportEmbeddedImageData : public nsIMsgEmbeddedImageData
{
public:
  nsImportEmbeddedImageData(nsIURI *aUri, const nsACString &aCID);
  nsImportEmbeddedImageData(nsIURI *aUri, const nsACString &aCID, const nsACString &aName);
  nsImportEmbeddedImageData();
  ~nsImportEmbeddedImageData();
  NS_DECL_NSIMSGEMBEDDEDIMAGEDATA
  NS_DECL_ISUPPORTS

  nsCOMPtr<nsIURI> m_uri;
  nsCString m_cid;
  nsCString m_name;
};


#endif
