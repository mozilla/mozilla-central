/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mailnews vcard import.
 *
 * The Initial Developer of the Original Code is
 * Evan Stratford <evan.stratford@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef nsVCardAddress_h__
#define nsVCardAddress_h__

#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsIImportFieldMap.h"
#include "nsIImportService.h"
#include "prlog.h"

extern PRLogModuleInfo *VCARDLOGMODULE;  // Logging module

#define IMPORT_LOG0(x)          PR_LOG(VCARDLOGMODULE, PR_LOG_DEBUG, (x))
#define IMPORT_LOG1(x, y)       PR_LOG(VCARDLOGMODULE, PR_LOG_DEBUG, (x, y))
#define IMPORT_LOG2(x, y, z)    PR_LOG(VCARDLOGMODULE, PR_LOG_DEBUG, (x, y, z))
#define IMPORT_LOG3(a, b, c, d) PR_LOG(VCARDLOGMODULE, PR_LOG_DEBUG, (a, b, c, d))

class nsIAddrDatabase;
class nsIFile;
class nsIInputStream;
class nsILineInputStream;

class nsVCardAddress {
public:
  nsVCardAddress();
  virtual ~nsVCardAddress();

  nsresult ImportAddresses(
      PRBool *pAbort,
      const PRUnichar *pName,
      nsIFile *pSrc,
      nsIAddrDatabase *pDb,
      nsString& errors,
      PRUint32 *pProgress);

private:
  static nsresult ReadRecord(
      nsILineInputStream *aLineStream, nsCString &aRecord, PRBool *aMore);

  nsCOMPtr<nsIImportService> m_pService;
};

#endif /* nsVCardAddress_h__ */

