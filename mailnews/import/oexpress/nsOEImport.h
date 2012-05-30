/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOEImport_h___
#define nsOEImport_h___

#include "nsIImportModule.h"
#include "nsCOMPtr.h"

#define NS_OEIMPORT_CID              \
{ /* be0bc880-1742-11d3-a206-00a0cc26da63 */      \
   0xbe0bc880, 0x1742, 0x11d3,                   \
   {0xa2, 0x06, 0x0, 0xa0, 0xcc, 0x26, 0xda, 0x63}}



#define kOESupportsString NS_IMPORT_MAIL_STR "," NS_IMPORT_ADDRESS_STR "," NS_IMPORT_SETTINGS_STR

class nsOEImport : public nsIImportModule
{
public:

  nsOEImport();
  virtual ~nsOEImport();

  NS_DECL_ISUPPORTS

  ////////////////////////////////////////////////////////////////////////////////////////
  // we suppport the nsIImportModule interface
  ////////////////////////////////////////////////////////////////////////////////////////


  NS_DECL_NSIIMPORTMODULE

protected:
};



#endif /* nsOEImport_h___ */
