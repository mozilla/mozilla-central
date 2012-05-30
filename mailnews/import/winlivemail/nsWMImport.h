/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsWMImport_h___
#define nsWMImport_h___

#include "nsIImportModule.h"
#include "nsCOMPtr.h"

#define NS_WMIMPORT_CID   \
{ /* 42bc82bc-8e9f-4597-8b6e-e529daaf3af1 */      \
   0x42bc82bc, 0x8e9f, 0x4597,   \
   {0x8b, 0x6e, 0xe5, 0x29, 0xda, 0xaf, 0x3a, 0xf1}}

// currently only support setting import
#define kWMSupportsString NS_IMPORT_SETTINGS_STR

class nsWMImport : public nsIImportModule
{
public:

  nsWMImport();
  virtual ~nsWMImport();

  NS_DECL_ISUPPORTS

  ////////////////////////////////////////////////////////////////////////////////////////
  // we suppport the nsIImportModule interface
  ////////////////////////////////////////////////////////////////////////////////////////

  NS_DECL_NSIIMPORTMODULE

protected:
};

#endif /* nsWMImport_h___ */
