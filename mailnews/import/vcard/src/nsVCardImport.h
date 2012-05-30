/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsVCardImport_h___
#define nsVCardImport_h___

#include "nsIImportModule.h"
#include "nsIStringBundle.h"
#include "nsCOMPtr.h"

#define NS_VCARDIMPORT_CID \
{ /* 0EB034A3-964A-4E2F-92EBCC55D9AE9DD2 */ \
  0x0eb034a3, 0x964a, 0x4e2f, \
  {0x92, 0xeb, 0xcc, 0x55, 0xd9, 0xae, 0x9d, 0xd2}}

#define VCARDIMPORT_MSGS_URL "chrome://messenger/locale/vCardImportMsgs.properties"

class nsVCardImport : public nsIImportModule
{
public:

  nsVCardImport();
  virtual ~nsVCardImport();

  NS_DECL_ISUPPORTS

  ////////////////////////////////////////////////////////////////////////////////////////
  // we suppport the nsIImportModule interface
  ////////////////////////////////////////////////////////////////////////////////////////

  NS_DECL_NSIIMPORTMODULE

protected:
  nsCOMPtr<nsIStringBundle> m_stringBundle;
};

#endif /* nsVCardImport_h___ */
