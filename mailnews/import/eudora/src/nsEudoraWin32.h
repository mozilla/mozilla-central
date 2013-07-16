/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraWin32_h__
#define nsEudoraWin32_h__

#include "mozilla/Attributes.h"
#include "nscore.h"
#include "nsStringGlue.h"
#include "nsIFile.h"
#include "nsISupportsArray.h"
#include "nsEudoraMailbox.h"
#include "nsEudoraAddress.h"

#include <windows.h>

class nsIImportService;
class nsIMsgAccountManager;
class nsIMsgAccount;


class nsEudoraWin32 : public nsEudoraMailbox, public nsEudoraAddress {
public:
  nsEudoraWin32();
  ~nsEudoraWin32();

    // retrieve the mail folder
  virtual bool      FindMailFolder(nsIFile **pFolder) MOZ_OVERRIDE;
    // get the list of mailboxes
  virtual nsresult  FindMailboxes(nsIFile *pRoot, nsISupportsArray **ppArray) MOZ_OVERRIDE;
    // get a TOC file from a mailbox file
  virtual nsresult  FindTOCFile(nsIFile *pMailFile, nsIFile **pTOCFile, bool *pDeleteToc) MOZ_OVERRIDE;

  virtual nsresult  GetAttachmentInfo(const char *pFileName, nsIFile *pFile, nsCString& mimeType, nsCString& aAttachment) MOZ_OVERRIDE;

  // Things that must be overridden because they are platform specific.
    // retrieve the address book folder
  virtual bool      FindAddressFolder(nsIFile **pFolder) MOZ_OVERRIDE;
    // get the list of address books
  virtual nsresult  FindAddressBooks(nsIFile *pRoot, nsISupportsArray **ppArray) MOZ_OVERRIDE;

    // import settings from Win32 ini file
  static bool    ImportSettings(nsIFile *pIniFile, nsIMsgAccount **localMailAccount);
  static bool    FindSettingsFile(nsIFile **pIniFile) { return FindEudoraLocation(pIniFile, true);}

  static bool    FindFiltersFile(nsIFile **pFiltersFile);

  static bool    GetMailboxNameHierarchy(const nsACString& pEudoraLocation, const char* pEudoraFilePath, nsCString& nameHierarchy);

private:
  nsresult  ScanMailDir(nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport);
  nsresult  IterateMailDir(nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport);
  nsresult  ScanDescmap(nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport, const char *pData, int32_t len);
  nsresult  FoundMailFolder(nsIFile *mailFolder, const char *pName, nsISupportsArray *pArray, nsIImportService *pImport);
  nsresult  FoundMailbox(nsIFile *mailFile, const char *pName, nsISupportsArray *pArray, nsIImportService *pImport);
  bool      FindMimeIniFile(nsIFile *pFile);
  void    GetMimeTypeFromExtension(nsCString& ext, nsCString& mimeType);
  nsresult  FoundAddressBook(nsIFile *file, const PRUnichar *pName, nsISupportsArray *pArray, nsIImportService *impSvc);
  nsresult  ScanAddressDir(nsIFile *pDir, nsISupportsArray *pArray, nsIImportService *impSvc);


  static bool      FindEudoraLocation(nsIFile **pFolder, bool findIni = false);

    // Settings support
  static bool    BuildPOPAccount(nsIMsgAccountManager *accMgr, const char *pSection, const char *pIni, nsIMsgAccount **ppAccount);
  static bool    BuildIMAPAccount(nsIMsgAccountManager *accMgr, const char *pSection, const char *pIni, nsIMsgAccount **ppAccount);
  static void    GetServerAndUserName(const char *pSection, const char *pIni, nsCString& serverName, nsCString& userName, char *pBuff);
  static void    GetAccountName(const char *pSection, nsString& str);
  static void    SetIdentities(nsIMsgAccountManager *accMgr, nsIMsgAccount *acc, const char *pSection, const char *pIniFile, const char *userName, const char *serverName, char *pBuff);
  static void    SetSmtpServer(nsIMsgAccountManager *pMgr, nsIMsgAccount *pAcc, const char *pServer, const char *pUser);



  static BYTE *  GetValueBytes(HKEY hKey, const char *pValueName);
  static void    ConvertPath(nsCString& str);

private:
  uint32_t    m_depth;
  nsCOMPtr <nsIFile>  m_addressImportFolder;
  char *      m_pMimeSection;
};


#endif /* nsEudoraWin32_h__ */

