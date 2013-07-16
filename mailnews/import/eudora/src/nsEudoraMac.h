/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraMac_h__
#define nsEudoraMac_h__

#include "mozilla/Attributes.h"
#include "nscore.h"
#include "nsStringGlue.h"
#include "nsIFile.h"
#include "nsISupportsArray.h"
#include "nsEudoraMailbox.h"
#include "nsEudoraAddress.h"

#include <CoreServices/CoreServices.h>

class nsIImportService;
class nsIMsgAccountManager;
class nsIMsgAccount;


class nsEudoraMac : public nsEudoraMailbox, public nsEudoraAddress {
public:
  nsEudoraMac();
  ~nsEudoraMac();

    // retrieve the mail folder
  virtual bool      FindMailFolder(nsIFile **pFolder) MOZ_OVERRIDE;
    // get the list of mailboxes
  virtual nsresult  FindMailboxes(nsIFile *pRoot,
                                  nsISupportsArray **ppArray) MOZ_OVERRIDE;
    // get a TOC file from a mailbox file
  virtual nsresult  FindTOCFile(nsIFile *pMailFile,
                                nsIFile **pTOCFile,
                                bool *pDeleteToc) MOZ_OVERRIDE;

  virtual nsresult  GetAttachmentInfo(const char *pFileName,
                                      nsIFile *pFile,
                                      nsCString& mimeType,
                                      nsCString& aAttachment) MOZ_OVERRIDE;

    // Address book stuff
  virtual bool      FindAddressFolder(nsIFile **pFolder) MOZ_OVERRIDE;
    // get the list of mailboxes
  virtual nsresult  FindAddressBooks(nsIFile *pRoot,
                                     nsISupportsArray **ppArray) MOZ_OVERRIDE;

    // import settings
  static bool    ImportSettings(nsIFile *pIniFile,
                                nsIMsgAccount **localMailAccount);
  static bool    FindSettingsFile(nsIFile **pIniFile) { return FindEudoraLocation(pIniFile, true);}

  static bool    FindFiltersFile(nsIFile **pFiltersFile);

private:
  static bool    FindEudoraLocation(nsIFile **pFolder,
                                    bool findIni = false,
                                    nsIFile *pLookIn = nullptr);
  static bool    FindEudoraLocation(nsIFile **pFolder,
                                    bool findIni,
                                    const char *specialDirName);
  static bool    VerifyEudoraLocation(nsIFile **pFolder, bool findIni);


  nsresult  ScanMailDir(nsIFile *pFolder,
                        nsISupportsArray *pArray,
                        nsIImportService *pImport);
  nsresult  IterateMailDir(nsIFile *pFolder,
                           nsISupportsArray *pArray,
                           nsIImportService *pImport);
  nsresult  FoundMailFolder(nsIFile *mailFolder,
                            const char *pName,
                            nsISupportsArray *pArray,
                            nsIImportService *pImport);
  nsresult  FoundMailbox(nsIFile *mailFile,
                         const char *pName,
                         nsISupportsArray *pArray,
                         nsIImportService *pImport);

  bool      IsValidMailFolderName(nsCString& name);
  bool      IsValidMailboxName(nsCString& fName);
  bool      IsValidMailboxFile(nsIFile *pFile);

  bool      CreateTocFromResource(nsIFile *pMail, nsIFile **pToc);



    // Settings support
  static bool    BuildPOPAccount(nsIMsgAccountManager *accMgr,
                                 nsCString **pStrs,
                                 nsIMsgAccount **ppAccount,
                                 nsString& accName);
  static bool    BuildIMAPAccount(nsIMsgAccountManager *accMgr,
                                  nsCString **pStrs,
                                  nsIMsgAccount **ppAccount,
                                  nsString& accName);
  static void    SetIdentities(nsIMsgAccountManager *accMgr,
                               nsIMsgAccount *acc,
                               const char *userName,
                               const char *serverName,
                               nsCString **pStrs);
  static void    SetSmtpServer(nsIMsgAccountManager *pMgr,
                               nsIMsgAccount *pAcc,
                               const char *pServer,
                               const char *pUser);
  static bool    GetSettingsFromResource(nsIFile *pSettings,
                                         short resId,
                                         nsCString **pStrs,
                                         bool *pIMAP);


private:
  uint32_t m_depth;
  nsCOMPtr <nsIFile> m_mailImportLocation;
  bool HasResourceFork(FSRef *fsRef);
};


#endif /* nsEudoraMac_h__ */

