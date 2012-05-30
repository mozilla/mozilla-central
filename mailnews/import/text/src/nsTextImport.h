/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsTextImport_h___
#define nsTextImport_h___

#include "nsIImportModule.h"
#include "nsCOMPtr.h"
#include "nsIStringBundle.h"

#define NS_TEXTIMPORT_CID          \
{ /* A5991D01-ADA7-11d3-A9C2-00A0CC26DA63 */      \
  0xa5991d01, 0xada7, 0x11d3,            \
  {0xa9, 0xc2, 0x0, 0xa0, 0xcc, 0x26, 0xda, 0x63 }}

#define kTextSupportsString NS_IMPORT_ADDRESS_STR

class nsTextImport : public nsIImportModule
{
public:
  nsTextImport();
  virtual ~nsTextImport();

  NS_DECL_ISUPPORTS

  ////////////////////////////////////////////////////////////////////////////////////////
  // we suppport the nsIImportModule interface
  ////////////////////////////////////////////////////////////////////////////////////////

  NS_DECL_NSIIMPORTMODULE

protected:
  nsCOMPtr<nsIStringBundle>   m_stringBundle;
};

#endif /* nsTextImport_h___ */
