/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *     Jeff Beckley <beckley@qualcomm.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#ifndef nsEudoraWin32_h__
#define nsEudoraWin32_h__

#include "nscore.h"
#include "nsString.h"
#include "nsILocalFile.h"
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
  virtual PRBool    FindMailFolder( nsIFile **pFolder);
    // get the list of mailboxes
  virtual nsresult  FindMailboxes( nsIFile *pRoot, nsISupportsArray **ppArray);
    // get a TOC file from a mailbox file
  virtual nsresult  FindTOCFile( nsIFile *pMailFile, nsIFile **pTOCFile, PRBool *pDeleteToc);

  virtual nsresult  GetAttachmentInfo( const char *pFileName, nsIFile *pFile, nsCString& mimeType, nsCString& aAttachment);

  // Things that must be overridden because they are platform specific.
    // retrieve the address book folder
  virtual PRBool    FindAddressFolder( nsIFile **pFolder);
    // get the list of address books
  virtual nsresult  FindAddressBooks( nsIFile *pRoot, nsISupportsArray **ppArray);

    // import settings from Win32 ini file
  static PRBool  ImportSettings( nsIFile *pIniFile, nsIMsgAccount **localMailAccount);
  static PRBool  FindSettingsFile( nsIFile **pIniFile) { return( FindEudoraLocation( pIniFile, PR_TRUE));}

  static PRBool  FindFiltersFile( nsIFile **pFiltersFile);

  static PRBool  GetMailboxNameHierarchy( const nsACString& pEudoraLocation, const char* pEudoraFilePath, nsCString& nameHierarchy);

private:
  nsresult  ScanMailDir( nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport);
  nsresult  IterateMailDir( nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport);
  nsresult  ScanDescmap( nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport, const char *pData, PRInt32 len);
  nsresult  FoundMailFolder( nsIFile *mailFolder, const char *pName, nsISupportsArray *pArray, nsIImportService *pImport);
  nsresult  FoundMailbox( nsIFile *mailFile, const char *pName, nsISupportsArray *pArray, nsIImportService *pImport);
  PRBool    FindMimeIniFile( nsIFile *pFile);
  void    GetMimeTypeFromExtension( nsCString& ext, nsCString& mimeType);
  nsresult  FoundAddressBook( nsIFile *file, const PRUnichar *pName, nsISupportsArray *pArray, nsIImportService *impSvc);
  nsresult  ScanAddressDir( nsIFile *pDir, nsISupportsArray *pArray, nsIImportService *impSvc);


  static PRBool    FindEudoraLocation( nsIFile **pFolder, PRBool findIni = PR_FALSE);

    // Settings support
  static PRBool  BuildPOPAccount( nsIMsgAccountManager *accMgr, const char *pSection, const char *pIni, nsIMsgAccount **ppAccount);
  static PRBool  BuildIMAPAccount( nsIMsgAccountManager *accMgr, const char *pSection, const char *pIni, nsIMsgAccount **ppAccount);
  static void    GetServerAndUserName( const char *pSection, const char *pIni, nsCString& serverName, nsCString& userName, char *pBuff);
  static void    GetAccountName( const char *pSection, nsString& str);
  static void    SetIdentities( nsIMsgAccountManager *accMgr, nsIMsgAccount *acc, const char *pSection, const char *pIniFile, const char *userName, const char *serverName, char *pBuff);
  static void    SetSmtpServer( nsIMsgAccountManager *pMgr, nsIMsgAccount *pAcc, const char *pServer, const char *pUser);



  static BYTE *  GetValueBytes( HKEY hKey, const char *pValueName);
  static void    ConvertPath( nsCString& str);

private:
  PRUint32    m_depth;
  nsCOMPtr <nsIFile>  m_addressImportFolder;
  char *      m_pMimeSection;
};


#endif /* nsEudoraWin32_h__ */

