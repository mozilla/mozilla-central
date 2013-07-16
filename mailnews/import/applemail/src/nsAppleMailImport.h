/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIIMPORTMODULE

  private:
    
  nsCOMPtr<nsIStringBundle> mBundle;
};

class nsAppleMailImportMail : public nsIImportMail
{
  public:

  nsAppleMailImportMail();
  virtual ~nsAppleMailImportMail();

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIIMPORTMAIL

  nsresult Initialize();

  private:

  void FindAccountMailDirs(nsIFile *aRoot, nsISupportsArray *aMailboxDescs, nsIImportService *aImportService);
  nsresult FindMboxDirs(nsIFile *aFolder, nsISupportsArray *aMailboxDescs, nsIImportService *aImportService);
  nsresult AddMboxDir(nsIFile *aFolder, nsISupportsArray *aMailboxDescs, nsIImportService *aImportService);
    
  // aInfoString is the format to a "foo %s" string. It may be NULL if the error string needs no such format.
  void ReportStatus(int32_t aErrorNum, nsString &aName, nsAString &aStream);
  static void SetLogs(const nsAString& success, const nsAString& error, PRUnichar **aOutErrorLog, PRUnichar **aSuccessLog);

  nsCOMPtr<nsIStringBundle>  mBundle;
  uint32_t                   mProgress;
  uint16_t                   mCurDepth;
};

#endif /* nsAppleMailImport_h___ */
