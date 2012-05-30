/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOutlookImport_h___
#define nsOutlookImport_h___

#include "nsIImportModule.h"
#include "nsCOMPtr.h"


#define NS_OUTLOOKIMPORT_CID          \
{ /* 1DB469A0-8B00-11d3-A206-00A0CC26DA63 */      \
  0x1db469a0, 0x8b00, 0x11d3,            \
  {0xa2, 0x6, 0x0, 0xa0, 0xcc, 0x26, 0xda, 0x63 }}




#define kOutlookSupportsString NS_IMPORT_MAIL_STR "," NS_IMPORT_ADDRESS_STR "," NS_IMPORT_SETTINGS_STR

class nsOutlookImport : public nsIImportModule
{
public:

  nsOutlookImport();
  virtual ~nsOutlookImport();

  NS_DECL_ISUPPORTS

  ////////////////////////////////////////////////////////////////////////////////////////
  // we suppport the nsIImportModule interface
  ////////////////////////////////////////////////////////////////////////////////////////

  NS_DECL_NSIIMPORTMODULE

protected:
};




#endif /* nsOutlookImport_h___ */
