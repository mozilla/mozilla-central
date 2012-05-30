/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraImport_h___
#define nsEudoraImport_h___

#include "nsIImportModule.h"
#include "nsCOMPtr.h"


#define NS_EUDORAIMPORT_CID          \
{ /* c8448da0-8f83-11d3-a206-00a0cc26da63 */      \
  0xc8448da0, 0x8f83, 0x11d3,            \
  {0xa2, 0x6, 0x0, 0xa0, 0xcc, 0x26, 0xda, 0x63 }}




#define kEudoraSupportsString NS_IMPORT_MAIL_STR "," NS_IMPORT_ADDRESS_STR "," NS_IMPORT_SETTINGS_STR "," NS_IMPORT_FILTERS_STR

class nsEudoraImport : public nsIImportModule
{
public:

  nsEudoraImport();
  virtual ~nsEudoraImport();

  NS_DECL_ISUPPORTS

  ////////////////////////////////////////////////////////////////////////////////////////
  // we suppport the nsIImportModule interface
  ////////////////////////////////////////////////////////////////////////////////////////

  NS_DECL_NSIIMPORTMODULE


protected:
};


#endif /* nsEudoraImport_h___ */
