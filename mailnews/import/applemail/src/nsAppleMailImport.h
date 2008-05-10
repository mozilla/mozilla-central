/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Mailnews import code.
 *
 * The Initial Developer of the Original Code is 
 * Håkan Waara <hwaara@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
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

#ifndef nsAppleMailImport_h___
#define nsAppleMailImport_h___

#include "prlog.h"
#include "nsIImportModule.h"
#include "nsCOMPtr.h"
#include "nsIStringBundle.h"
#include "nsIImportMail.h"
#include "nsISupportsArray.h"

// logging facilities
extern PRLogModuleInfo *APPLEMAILLOGMODULE;

#define IMPORT_LOG0(x)          PR_LOG(APPLEMAILLOGMODULE, PR_LOG_DEBUG, (x))
#define IMPORT_LOG1(x, y)       PR_LOG(APPLEMAILLOGMODULE, PR_LOG_DEBUG, (x, y))
#define IMPORT_LOG2(x, y, z)    PR_LOG(APPLEMAILLOGMODULE, PR_LOG_DEBUG, (x, y, z))
#define IMPORT_LOG3(a, b, c, d) PR_LOG(APPLEMAILLOGMODULE, PR_LOG_DEBUG, (a, b, c, d))

#define NS_APPLEMAILIMPL_CID \
{ 0x9117a1ea, 0xe012, 0x43b5, { 0xa0, 0x20, 0xcb, 0x8a, 0x66, 0xcc, 0x09, 0xe1 } }

#define NS_APPLEMAILIMPORT_CID \
{ 0x6d3f101c, 0x70ec, 0x4e04, { 0xb6, 0x8d, 0x99, 0x08, 0xd1, 0xae, 0xdd, 0xf3 } }

#define NS_APPLEMAILIMPL_CONTRACTID "@mozilla.org/import/import-appleMailImpl;1" 

#define kAppleMailSupportsString "mail"

class nsIImportService;

class nsAppleMailImportModule : public nsIImportModule
{
  public:

  nsAppleMailImportModule();
  virtual ~nsAppleMailImportModule();
    
  NS_DECL_ISUPPORTS
  NS_DECL_NSIIMPORTMODULE

  private:
    
  nsCOMPtr<nsIStringBundle> mBundle;
};

class nsAppleMailImportMail : public nsIImportMail
{
  public:
  
  nsAppleMailImportMail();
  virtual ~nsAppleMailImportMail();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIIMPORTMAIL

  nsresult Initialize();

  private:
  
  void FindAccountMailDirs(nsIFile *aRoot, nsISupportsArray *aMailboxDescs, nsIImportService *aImportService);
  nsresult FindMboxDirs(nsILocalFile *aFolder, nsISupportsArray *aMailboxDescs, nsIImportService *aImportService);
  nsresult AddMboxDir(nsILocalFile *aFolder, nsISupportsArray *aMailboxDescs, nsIImportService *aImportService);
    
  // aInfoString is the format to a "foo %s" string. It may be NULL if the error string needs no such format.
  void ReportStatus(PRInt32 aErrorNum, nsString &aName, nsAString &aStream);
  static void SetLogs(const nsAString& success, const nsAString& error, PRUnichar **aOutErrorLog, PRUnichar **aSuccessLog);
  
  nsCOMPtr<nsIStringBundle>  mBundleProxy;
  PRUint32                   mProgress;
  PRUint16                   mCurDepth;
};

#endif /* nsAppleMailImport_h___ */
