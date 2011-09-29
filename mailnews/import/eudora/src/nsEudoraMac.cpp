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
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Jeff Beckley <beckley@qualcomm.com>
 *   Steve Dorner <sdorner@qualcomm.com>
 *   Ben Frisch <bfrisch@gmail.com>
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

#include "nsCOMPtr.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgAccount.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsISmtpService.h"
#include "nsISmtpServer.h"
#include "nsEudoraMac.h"
#include "nsIImportService.h"
#include "nsIImportMailboxDescriptor.h"
#include "nsIImportABDescriptor.h"
#include "nsDirectoryServiceDefs.h"
#include "nsEudoraStringBundle.h"
#include "nsEudoraImport.h"
#include "nsIPop3IncomingServer.h"
#include "nsReadableUtils.h"
#include "nsUnicharUtils.h"
#include "nsNetUtil.h"
#include "EudoraDebugLog.h"

#include "nsILocalFileMac.h"

static NS_DEFINE_IID(kISupportsIID,      NS_ISUPPORTS_IID);

static const char *  kWhitespace = "\b\t\r\n ";

nsEudoraMac::nsEudoraMac()
{
}

nsEudoraMac::~nsEudoraMac()
{
}

bool nsEudoraMac::FindMailFolder( nsIFile **pFolder)
{
  return( FindEudoraLocation( pFolder));
}

bool nsEudoraMac::FindEudoraLocation( nsIFile **pFolder, bool findIni, nsIFile *pLookIn)
{
  bool result = false;
  // Modern versions of Eudora make the Eudora Folder in ~/Documents
  // The last versions that ran MacOS Classic made the Eudora folder in the user's documents folder
  // Early versions made the Eudora Folder in the System Folder
  // Eudora searches those three locations, earliest first (System Folder:Eudora Folder), and uses the first Eudora Folder
  // it finds.  However, it's not clear that any version of OSX can actually *find* the Classic "Documents" folder,
  // even if there was one before the machine was updated to OSX.
  // The name "Eudora Folder" should not be localized.  Early localized versions of Eudora did localize the name; later
  // localized versions looked for the localized name and changed it back.  We will therefore not
  // worry about the folder name being localized.  Japan may be an issue, though.
  // SD 11/2006

  if (!pLookIn)
  {
    result = FindEudoraLocation( pFolder, findIni, NS_OS_SYSTEM_DIR );
    if ( !result )
    {
      result = FindEudoraLocation( pFolder, findIni, NS_MAC_DOCUMENTS_DIR );
      if ( !result )
        result = FindEudoraLocation( pFolder, findIni, NS_OSX_USER_DOCUMENTS_DIR );
    }
  }
  else
  {
    *pFolder = pLookIn;
    result = VerifyEudoraLocation( pFolder, findIni );
  }

  return result;
}

bool nsEudoraMac::FindEudoraLocation( nsIFile **pFolder, bool findIni, const char *specialDirName )
{
  nsCOMPtr <nsIFile> searchDir;
  nsresult rv = NS_GetSpecialDirectory( specialDirName, getter_AddRefs(searchDir) );
  if (NS_FAILED(rv))
    return (PR_FALSE);

  // Turn it into a mac file, so we can resolve aliases
  nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(searchDir);
  if (!macFile)
    return (PR_FALSE);
  macFile->SetFollowLinks(PR_TRUE);

  // It's always called "Eudora Folder", so add that to the path
  macFile->AppendNative( NS_LITERAL_CSTRING( "Eudora Folder"  ) );

  // If it's an alias, the "target" will be the real file.  Fetch this as a string
  // and set is back as the file
  nsCString path;
  macFile->GetNativeTarget(path);
  macFile->InitWithNativePath(path);

  // Resolve any unix-style symlinks (this won't do MacOS aliases, hence the machinations above)
  bool link = false;
  rv = searchDir->IsSymlink( &link);
  if (NS_SUCCEEDED( rv) && link)
  {
    rv = macFile->SetFollowLinks(PR_TRUE);
    if (NS_FAILED( rv))
      return( PR_FALSE);
  }

  // Check for existence and directoriness
  bool exists = false;
  rv = searchDir->Exists( &exists);
  bool isFolder = false;
  if (NS_SUCCEEDED( rv) && exists)
    rv = searchDir->IsDirectory( &isFolder);
  if (!exists || !isFolder)
    return( PR_FALSE);

  NS_IF_ADDREF(*pFolder = searchDir);

  return PR_TRUE;
}

bool nsEudoraMac::VerifyEudoraLocation( nsIFile **pFolder, bool findIni )
{
  bool result = false;
  bool foundPref = false;


  bool hasMore;
  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = (*pFolder)->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  directoryEnumerator->HasMoreElements(&hasMore);
  nsCOMPtr <nsIFile> prefFile;

  int count = 0;
  OSType type, creator;
  while (hasMore && NS_SUCCEEDED(rv) && count < 2)
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsILocalFile> entry(do_QueryInterface(aSupport, &rv));
    directoryEnumerator->HasMoreElements(&hasMore);


    // find a file with TEXT, CSOm that isn't the nicknames file
    // or just cheat and look for more than 1 file?
    {
      nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(entry, &rv);
      if (NS_SUCCEEDED(rv))
      {
        macFile->GetFileCreator(&creator);
        macFile->GetFileType(&type);
      }
    }
    if (NS_SUCCEEDED( rv))
    {
      if ((type == 'TEXT') && (creator == 'CSOm'))
        count++;
      else if ((type == 'PREF') && (creator == 'CSOm'))
      {
        if (!foundPref)
        {
          prefFile = entry;
          foundPref = PR_TRUE;
        }
        else
        {
          // does one of them end in ".bkup"?
          nsCString leafName;
          entry->GetNativeLeafName(leafName);
          bool isBk = false;
          isBk = StringEndsWith(leafName, NS_LITERAL_CSTRING(".bkup"));
          if (!isBk)
          {
            prefFile->GetNativeLeafName(leafName);
            isBk = StringEndsWith(leafName, NS_LITERAL_CSTRING(".bkup"));
            if (isBk)
              prefFile = entry;
            else
            {
              // Neither of the pref files was named .bkup
              // Pick the newest one?
              PRInt64 modDate1, modDate2;

              entry->GetLastModifiedTime(&modDate2);
              prefFile->GetLastModifiedTime(&modDate1);
              if (modDate2 > modDate1)
                prefFile = entry;
            }
          }
        }
      }
    }
  }
  if (count >= 2)
    result = PR_TRUE;

  if (!findIni)
    return( result);

  if (!foundPref)
    return( PR_FALSE);

  NS_IF_ADDREF(*pFolder = prefFile);

  return( PR_TRUE);
}


nsresult nsEudoraMac::FindMailboxes( nsIFile *pRoot, nsISupportsArray **ppArray)
{
  nsresult rv = NS_NewISupportsArray( ppArray);
  if (NS_FAILED( rv))
  {
    IMPORT_LOG0( "FAILED to allocate the nsISupportsArray\n");
    return( rv);
  }

  nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  if (NS_FAILED( rv))
    return( rv);

  m_depth = 0;
  m_mailImportLocation = do_QueryInterface(pRoot);

  return( ScanMailDir( pRoot, *ppArray, impSvc));
}


nsresult nsEudoraMac::ScanMailDir( nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport)
{

  // On Windows, we look for a descmap file but on Mac we just iterate
  // the directory

  m_depth++;

  nsresult rv = IterateMailDir( pFolder, pArray, pImport);

  m_depth--;

  return( rv);
}

nsresult nsEudoraMac::IterateMailDir( nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport)
{
  bool hasMore;
  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = pFolder->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  directoryEnumerator->HasMoreElements(&hasMore);

  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsILocalFile> entry(do_QueryInterface(aSupport, &rv));
    directoryEnumerator->HasMoreElements(&hasMore);

    bool isFolder;
    bool isFile;
    nsCString fName;
    nsCString ext;
    nsCString name;
    OSType type;
    OSType creator;

    isFolder = PR_FALSE;
    isFile = PR_FALSE;
    rv = entry->IsDirectory( &isFolder);
    rv = entry->IsFile( &isFile);
    rv = entry->GetNativeLeafName(fName);
    if (NS_SUCCEEDED( rv) && !fName.IsEmpty())
    {
      if (isFolder)
      {
        if (IsValidMailFolderName( fName))
        {
          rv = FoundMailFolder( entry, fName.get(), pArray, pImport);
          if (NS_SUCCEEDED( rv))
          {
            rv = ScanMailDir( entry, pArray, pImport);
            if (NS_FAILED( rv))
              IMPORT_LOG0( "*** Error scanning mail directory\n");
          }
        }
      }
      else if (isFile)
      {
        type = 0;
        creator = 0;
        {
          nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(entry, &rv);
          if (NS_SUCCEEDED(rv))
          {
            macFile->GetFileCreator(&creator);
            macFile->GetFileType(&type);
          }
        }
        if ((type == 'TEXT') && IsValidMailboxName( fName) && IsValidMailboxFile( entry))
          rv = FoundMailbox( entry, fName.get(), pArray, pImport);
      }
    }
  }
  return( rv);
}


nsresult nsEudoraMac::FoundMailbox( nsIFile *mailFile, const char *pName, nsISupportsArray *pArray, nsIImportService *pImport)
{
  nsAutoString              displayName;
  nsCOMPtr<nsIImportMailboxDescriptor>  desc;
  nsISupports *              pInterface;

  NS_CopyNativeToUnicode(nsDependentCString(pName), displayName);

#ifdef IMPORT_DEBUG
  nsCString path;
  mailFile->GetNativePath(path);
  if (!path.IsEmpty())
    IMPORT_LOG2( "Found eudora mailbox, %s: %s\n", path.get(), pName);
  else
    IMPORT_LOG1( "Found eudora mailbox, %s\n", pName);
  IMPORT_LOG1( "\tm_depth = %d\n", (int)m_depth);
#endif

  nsresult rv = pImport->CreateNewMailboxDescriptor( getter_AddRefs( desc));
  if (NS_SUCCEEDED( rv))
  {
    PRInt64    sz = 0;
    mailFile->GetFileSize( &sz);
    desc->SetDisplayName( displayName.get());
    desc->SetDepth( m_depth);
    nsCOMPtr <nsILocalFile> pLocalFile;
    desc->GetFile(getter_AddRefs(pLocalFile));
    if (pLocalFile)
    {
      nsCOMPtr <nsILocalFile> localMailFile = do_QueryInterface(mailFile);
      pLocalFile->InitWithFile(localMailFile);
    }
    rv = desc->QueryInterface( kISupportsIID, (void **) &pInterface);
    pArray->AppendElement( pInterface);
    pInterface->Release();
  }

  return( NS_OK);
}


nsresult nsEudoraMac::FoundMailFolder( nsILocalFile *mailFolder, const char *pName, nsISupportsArray *pArray, nsIImportService *pImport)
{
  nsAutoString          displayName;
  nsCOMPtr<nsIImportMailboxDescriptor>  desc;
  nsISupports *              pInterface;

  NS_CopyNativeToUnicode(nsDependentCString(pName), displayName);

#ifdef IMPORT_DEBUG
  nsCString path;
  mailFolder->GetNativePath(path);
  if (!path.IsEmpty())
    IMPORT_LOG2( "Found eudora folder, %s: %s\n",path.get(), pName);
  else
    IMPORT_LOG1( "Found eudora folder, %s\n", pName);
  IMPORT_LOG1( "\tm_depth = %d\n", (int)m_depth);
#endif

  nsresult rv = pImport->CreateNewMailboxDescriptor( getter_AddRefs( desc));
  if (NS_SUCCEEDED( rv))
  {
    PRInt64    sz = 0;
    desc->SetDisplayName( displayName.get());
    desc->SetDepth( m_depth);
    desc->SetSize( sz);
    nsCOMPtr <nsILocalFile> pFile;
    desc->GetFile(getter_AddRefs(pFile));
    if (pFile)
      pFile->InitWithFile( mailFolder);
    rv = desc->QueryInterface( kISupportsIID, (void **) &pInterface);
    pArray->AppendElement( pInterface);
    pInterface->Release();
  }

  return( NS_OK);
}

bool nsEudoraMac::CreateTocFromResource( nsIFile *pMail, nsIFile **pToc)
{
  ResFileRefNum resFile = -1;

  {
    nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(pMail);

    FSRef fsRef;
    nsresult rv = macFile->GetFSRef(&fsRef);
    if (NS_FAILED(rv))
      return PR_FALSE;

    resFile = FSOpenResFile( &fsRef, fsRdPerm);
  }

  if (resFile == -1)
    return( PR_FALSE);
  Handle  resH = nil;
  short max = Count1Resources( 'TOCF');
  if (max)
    resH = Get1IndResource( 'TOCF', 1);
  bool     result = false;
  if (resH)
  {
    PRInt32 sz = (PRInt32) GetHandleSize( resH);
    if (sz)
    {
      // Create the new TOC file
      nsCOMPtr<nsIFile> tempDir;
      nsresult rv = NS_GetSpecialDirectory(NS_OS_TEMP_DIR, getter_AddRefs(tempDir));
      if (NS_FAILED(rv))
        return (PR_FALSE);

      nsCOMPtr <nsIOutputStream> outputStream;
        rv = tempDir->Clone(pToc);
      if (NS_SUCCEEDED( rv))
        rv = (*pToc)->AppendNative( NS_LITERAL_CSTRING("temp.toc"));
      if (NS_SUCCEEDED( rv))
        rv = (*pToc)->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
      if (NS_SUCCEEDED( rv))
        rv = NS_NewLocalFileOutputStream(getter_AddRefs(outputStream), (*pToc));
      if (NS_SUCCEEDED( rv))
      {
        HLock( resH);
        PRUint32 written = 0;
        rv = outputStream->Write( *resH, sz, &written);
        HUnlock( resH);
        outputStream->Close();
        if (NS_FAILED( rv) || (written != sz))
          (*pToc)->Remove( PR_FALSE);
        else
          result = PR_TRUE;
      }
    }
    ReleaseResource( resH);
  }
  CloseResFile( resFile);

  return( result);
}


nsresult nsEudoraMac::FindTOCFile( nsIFile *pMailFile, nsIFile **ppTOCFile, bool *pDeleteToc)
{
  nsresult    rv;

  *pDeleteToc = PR_FALSE;
  *ppTOCFile = nsnull;
  nsCString leaf;
  rv = pMailFile->GetNativeLeafName(leaf);
  if (NS_FAILED( rv))
    return( rv);
  rv = pMailFile->GetParent( ppTOCFile);
  if (NS_FAILED( rv))
    return( rv);

  leaf.Append( ".toc");

  OSType  type = 0;
  OSType  creator = 0;
  bool    exists = false;
  bool    isFile = false;
  rv = (*ppTOCFile)->AppendNative(leaf);
  if (NS_SUCCEEDED( rv))
    rv = (*ppTOCFile)->Exists( &exists);
  if (NS_SUCCEEDED( rv) && exists)
    rv = (*ppTOCFile)->IsFile( &isFile);
  if (isFile)
  {
    nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(*ppTOCFile);
    if (macFile)
    {
      macFile->GetFileCreator(&creator);
      macFile->GetFileType(&type);
    }
  }


  if (exists && isFile && (type == 'TOCF') && (creator == 'CSOm'))
    return( NS_OK);

  // try and create the file from a resource.
  if (CreateTocFromResource( pMailFile, ppTOCFile))
  {
    *pDeleteToc = PR_TRUE;
    return( NS_OK);
  }
  return( NS_ERROR_FAILURE);
}

// GetIndString isn't supported on 64-bit Mac OS X
// This code is emulation for GetIndString.
static StringPtr GetStringFromHandle(Handle aResource,
                                     ResourceIndex aId)
{
  if (!aResource)
    return nsnull;

  PRUint8 *data = *(PRUint8**)aResource;
  PRUint16 count = *(PRUint16*)data;
#if defined(IS_LITTLE_ENDIAN)
  count = count << 8 | count >> 8;
#endif

  // First 2 bytes are the count of string that this resource has.
  if (count < aId)
    return nsnull;

  // skip count
  data += 2;

  // looking for data.  data is in order
  while (--aId > 0)
    data = data + (*(PRUint8*)data) + 1;

  return data;
}

// Strings returned:
//  1 - smtp server
//  2 - pop account user name
//  3 - the pop server
//  4 - Return address
//  5 - Full name
//  6 - Leave mail on server
#define kNumSettingStrs     6
#define kSmtpServerStr      0
#define kPopAccountNameStr  1
#define kPopServerStr       2
#define kReturnAddressStr   3
#define kFullNameStr        4
#define kLeaveOnServerStr   5

// resource IDs
#define kSmtpServerID         4
#define kEmailAddressID       3
#define kReturnAddressID      5
#define kFullNameID           77
#define kLeaveMailOnServerID  18


bool nsEudoraMac::GetSettingsFromResource( nsIFile *pSettings, short resId, nsCString **pStrs, bool *pIMAP)
{
  nsresult rv;
  *pIMAP = PR_FALSE;
  // Get settings from the resources...
  ResFileRefNum resFile = -1;
  {
    nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(pSettings, &rv);
    if (NS_FAILED(rv))
      return PR_FALSE;

    FSRef fsRef;
    rv = macFile->GetFSRef(&fsRef);
    if (NS_FAILED(rv))
      return PR_FALSE;

    resFile = FSOpenResFile( &fsRef, fsRdPerm);
  }
  if (resFile == -1)
    return( PR_FALSE);

  UseResFile(resFile);

  // smtp server, STR# 1000, 4
  Handle  resH = Get1Resource( 'STR#', resId /* 1000 */);
  int    idx;
  if (resH)
  {
    StringPtr  pStr[5];
    StringPtr   theStr;

    // Cannot use GetIndString due to 64-bit support
    pStr[0] = GetStringFromHandle(resH, kSmtpServerID);
    pStr[1] = GetStringFromHandle(resH, kEmailAddressID);
    pStr[2] = GetStringFromHandle(resH, kReturnAddressID);
    pStr[3] = GetStringFromHandle(resH, kFullNameID);
    pStr[4] = GetStringFromHandle(resH, kLeaveMailOnServerID);

    theStr = pStr[0];
    if (theStr && *theStr)
      pStrs[0]->Append( (const char *) (theStr + 1), *theStr);
    theStr = pStr[1];
    if (theStr && *theStr)
    {
      idx = 1;
      while (idx <= *theStr)
      {
        if (theStr[idx] == '@')
          break;
        else
          idx++;
      }
      if (idx <= *theStr)
      {
        PRUint8  save = *theStr;
        *theStr = idx - 1;
        if (*theStr)
          pStrs[1]->Append( (const char *) (theStr + 1), *theStr);
        *theStr = save;
      }
      else
        idx = 0;
      theStr[idx] = theStr[0] - idx;
      if (theStr[idx])
        pStrs[2]->Append( (const char *) (theStr + idx + 1), *(theStr + idx));
    }
    theStr = pStr[2];
    if (theStr && *theStr)
      pStrs[3]->Append( (const char *) (theStr + 1), *theStr);
    theStr = pStr[3];
    if (theStr && *theStr)
      pStrs[4]->Append( (const char *) (theStr + 1), *theStr);
    theStr = pStr[4];
    if (theStr && *theStr)
    {
      if (theStr[1] == 'y')
        *(pStrs[5]) = "Y";
      else
        *(pStrs[5]) = "N";
    }

    ReleaseResource(resH);
    CloseResFile( resFile);

    return( PR_TRUE);
  }
  else
  {
    CloseResFile( resFile);
    return( PR_FALSE);
  }
}

bool nsEudoraMac::ImportSettings( nsIFile *pIniFile, nsIMsgAccount **localMailAccount)
{
  nsresult  rv;

  nsCOMPtr<nsIMsgAccountManager> accMgr =
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  if (NS_FAILED(rv))
  {
    IMPORT_LOG0( "*** Failed to create a account manager!\n");
    return( PR_FALSE);
  }

  short  baseResId = 1000;
  nsCString **pStrs = new nsCString *[kNumSettingStrs];
  int    i;

  for (i = 0; i < kNumSettingStrs; i++)
    pStrs[i] = new nsCString;

  nsString accName(NS_LITERAL_STRING("Eudora Settings"));
  nsEudoraStringBundle::GetStringByID( EUDORAIMPORT_ACCOUNTNAME, accName);

  // This is a little overkill but we're not sure yet how multiple accounts
  // are stored in the Mac preferences, hopefully similar to existing prefs
  // which means the following is a good start!
  bool    isIMAP = false;

  int        popCount = 0;
  int        accounts = 0;
  nsIMsgAccount *  pAccount;

  while (baseResId)
  {
    isIMAP = PR_FALSE;
    if (GetSettingsFromResource( pIniFile, baseResId, pStrs, &isIMAP))
    {
      pAccount = nsnull;
      if (!isIMAP)
      {
        // This is a POP account
        if (BuildPOPAccount( accMgr, pStrs, &pAccount, accName))
        {
          accounts++;
          popCount++;
          if (popCount > 1)
          {
            if (localMailAccount && *localMailAccount)
            {
              NS_RELEASE( *localMailAccount);
              *localMailAccount = nsnull;
            }
          }
          else
          {
            if (localMailAccount)
            {
              *localMailAccount = pAccount;
              NS_IF_ADDREF( pAccount);
            }
          }
        }
      }
      else
      {
        // This is an IMAP account
        if (BuildIMAPAccount( accMgr, pStrs, &pAccount, accName))
          accounts++;
      }
      if (pAccount && (baseResId == 1000))
        accMgr->SetDefaultAccount( pAccount);

      NS_IF_RELEASE( pAccount);
    }

    baseResId = 0;
    // Set the next account name???

    if (baseResId)
    {
      for (i = 0; i < kNumSettingStrs; i++)
        pStrs[i]->Truncate();
    }
  }

  // Now save the new acct info to pref file.
  rv = accMgr->SaveAccountInfo();
  NS_ASSERTION(NS_SUCCEEDED(rv), "Can't save account info to pref file");

  for (i = 0; i < kNumSettingStrs; i++)
    delete pStrs[i];
  delete pStrs;

  return( accounts != 0);
}

bool nsEudoraMac::FindFiltersFile( nsIFile **pFiltersFile)
{
  bool result = FindEudoraLocation( pFiltersFile, false);

  if (result)
  {
    (*pFiltersFile)->AppendNative( NS_LITERAL_CSTRING("Eudora Filters") );
    (*pFiltersFile)->IsFile(&result);
  }

  return result;
}



bool nsEudoraMac::BuildPOPAccount( nsIMsgAccountManager *accMgr, nsCString **pStrs, nsIMsgAccount **ppAccount, nsString& accName)
{
  if (ppAccount)
    *ppAccount = nsnull;


  if (!pStrs[kPopServerStr]->Length() || !pStrs[kPopAccountNameStr]->Length())
    return( PR_FALSE);

  bool    result = false;

  // I now have a user name/server name pair, find out if it already exists?
  nsCOMPtr<nsIMsgIncomingServer> in;
  nsresult rv = accMgr->FindServer( *(pStrs[kPopAccountNameStr]), *(pStrs[kPopServerStr]), NS_LITERAL_CSTRING("pop3"), getter_AddRefs( in));
  if (NS_FAILED( rv) || (in == nsnull))
  {
    // Create the incoming server and an account for it?
    rv = accMgr->CreateIncomingServer( *(pStrs[kPopAccountNameStr]), *(pStrs[kPopServerStr]), NS_LITERAL_CSTRING("pop3"), getter_AddRefs( in));
    if (NS_SUCCEEDED( rv) && in)
    {
      rv = in->SetType(NS_LITERAL_CSTRING("pop3"));
      // rv = in->SetHostName( pStrs[kPopServerStr]->get());
      // rv = in->SetUsername( pStrs[kPopAccountNameStr]->get());

      IMPORT_LOG2( "Created POP3 server named: %s, userName: %s\n", pStrs[kPopServerStr]->get(), pStrs[kPopAccountNameStr]->get());
      IMPORT_LOG1( "\tSet pretty name to: %S\n", accName.get());
      rv = in->SetPrettyName( accName);

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount>  account;
      rv = accMgr->CreateAccount( getter_AddRefs( account));
      if (NS_SUCCEEDED( rv) && account)
      {
        rv = account->SetIncomingServer( in);

        IMPORT_LOG0( "Created a new account and set the incoming server to the POP3 server.\n");

        nsCOMPtr<nsIPop3IncomingServer> pop3Server = do_QueryInterface(in, &rv);
        NS_ENSURE_SUCCESS(rv,rv);
        pop3Server->SetLeaveMessagesOnServer(pStrs[kLeaveOnServerStr]->First() == 'Y' ? PR_TRUE : PR_FALSE);

        // Fiddle with the identities
        SetIdentities(accMgr, account, pStrs[kPopAccountNameStr]->get(), pStrs[kPopServerStr]->get(), pStrs);
        result = PR_TRUE;
        if (ppAccount)
          account->QueryInterface( NS_GET_IID(nsIMsgAccount), (void **)ppAccount);
      }
    }
  }
  else
    result = PR_TRUE;

  return( result);
}


bool nsEudoraMac::BuildIMAPAccount( nsIMsgAccountManager *accMgr, nsCString **pStrs, nsIMsgAccount **ppAccount, nsString& accName)
{
  if (!pStrs[kPopServerStr]->Length() || !pStrs[kPopAccountNameStr]->Length())
    return( PR_FALSE);

  bool result = false;

  nsCOMPtr<nsIMsgIncomingServer>  in;
  nsresult rv = accMgr->FindServer(*(pStrs[kPopAccountNameStr]), *(pStrs[kPopServerStr]), NS_LITERAL_CSTRING("imap"), getter_AddRefs( in));
  if (NS_FAILED( rv) || (in == nsnull))
  {
    // Create the incoming server and an account for it?
    rv = accMgr->CreateIncomingServer( *(pStrs[kPopAccountNameStr]), *(pStrs[kPopServerStr]), NS_LITERAL_CSTRING("imap"), getter_AddRefs( in));
    if (NS_SUCCEEDED( rv) && in)
    {
      rv = in->SetType(NS_LITERAL_CSTRING("imap"));
      // rv = in->SetHostName( pStrs[kPopServerStr]->get());
      // rv = in->SetUsername( pStrs[kPopAccountNameStr]->get());

      IMPORT_LOG2( "Created IMAP server named: %s, userName: %s\n", pStrs[kPopServerStr]->get(), pStrs[kPopAccountNameStr]->get());
      IMPORT_LOG1( "\tSet pretty name to: %S\n", accName.get());
      rv = in->SetPrettyName( accName);

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount>  account;
      rv = accMgr->CreateAccount( getter_AddRefs( account));
      if (NS_SUCCEEDED( rv) && account)
      {
        rv = account->SetIncomingServer( in);

        IMPORT_LOG0( "Created an account and set the IMAP server as the incoming server\n");

        // Fiddle with the identities
        SetIdentities(accMgr, account, pStrs[kPopAccountNameStr]->get(), pStrs[kPopServerStr]->get(), pStrs);
        result = PR_TRUE;
        if (ppAccount)
          account->QueryInterface( NS_GET_IID(nsIMsgAccount), (void **)ppAccount);
      }
    }
  }
  else
    result = PR_TRUE;

  return( result);
}


void nsEudoraMac::SetIdentities(nsIMsgAccountManager *accMgr, nsIMsgAccount *acc, const char *userName, const char *serverName, nsCString **pStrs)
{
  nsresult rv;

  nsCOMPtr<nsIMsgIdentity> id;
  rv = accMgr->CreateIdentity( getter_AddRefs( id));
  if (id)
  {
    nsAutoString fullName;
    if (pStrs[kFullNameStr]->Length())
      CopyASCIItoUTF16(pStrs[kFullNameStr]->get(), fullName);
    id->SetFullName(fullName);
    id->SetIdentityName(fullName);
    if (pStrs[kReturnAddressStr]->Length())
      id->SetEmail(*(pStrs[kReturnAddressStr]));
    else
    {
      nsCAutoString emailAddress;
      emailAddress = userName;
      emailAddress += "@";
      emailAddress += serverName;
      id->SetEmail(emailAddress);
    }
    acc->AddIdentity( id);
    IMPORT_LOG0( "Created identity and added to the account\n");
    IMPORT_LOG1( "\tname: %s\n", pStrs[kFullNameStr]->get());
    IMPORT_LOG1( "\temail: %s\n", pStrs[kReturnAddressStr]->get());
  }

  SetSmtpServer( accMgr, acc, pStrs[kSmtpServerStr]->get(), userName);
}


void nsEudoraMac::SetSmtpServer( nsIMsgAccountManager *pMgr, nsIMsgAccount *pAcc, const char *pServer, const char *pUser)
{
  nsresult  rv;

  nsCOMPtr<nsISmtpService> smtpService(do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv) && smtpService)
  {
    nsCOMPtr<nsISmtpServer>    foundServer;

    rv = smtpService->FindServer( pUser, pServer, getter_AddRefs( foundServer));
    if (NS_SUCCEEDED( rv) && foundServer)
    {
      IMPORT_LOG1( "SMTP server already exists: %s\n", pServer);
      return;
    }
    nsCOMPtr<nsISmtpServer>    smtpServer;

    rv = smtpService->CreateSmtpServer( getter_AddRefs( smtpServer));
    if (NS_SUCCEEDED( rv) && smtpServer)
    {
      smtpServer->SetHostname(nsDependentCString(pServer));
      if (pUser)
        smtpServer->SetUsername(nsDependentCString(pUser));

      IMPORT_LOG1( "Created new SMTP server: %s\n", pServer);
    }
  }
}


nsresult nsEudoraMac::GetAttachmentInfo( const char *pFileName, nsIFile *pFile, nsCString& mimeType, nsCString& aAttachment)
{
  mimeType.Truncate();

  // Sample attachment line
  // Internet:sandh.jpg (JPEG/JVWR) (0003C2E8)

  OSType    type = '????';
  OSType    creator = '????';
  PRUint32  fNum = 0;
  int      i;
  PRUnichar  c;

  nsCString  str(pFileName);
  if (str.Length() > 22)
  {
    // try and extract the mac file info from the attachment line
    nsCString  fileNum;
    nsCString  types;

    str.Right( fileNum, 10);
    if ((fileNum.CharAt( 0) == '(') && (fileNum.CharAt( 9) == ')'))
    {
      for (i = 1; i < 9; i++)
      {
        fNum *= 16;
        c = fileNum.CharAt( i);
        if ((c >= '0') && (c <= '9'))
          fNum += (c - '0');
        else if ((c >= 'a') && (c <= 'f'))
          fNum += (c - 'a' + 10);
        else if ((c >= 'A') && (c <= 'F'))
          fNum += (c - 'A' + 10);
        else
          break;
      }
      if (i == 9)
      {
        str.Left( fileNum, str.Length() - 10);
        str = fileNum;
        str.Trim( kWhitespace);
        str.Right( types, 11);
        if ((types.CharAt( 0) == '(') && (types.CharAt( 5) == '/') && (types.CharAt( 10) == ')'))
        {
          type = ((PRUint32)types.CharAt( 1)) << 24;
          type |= ((PRUint32)types.CharAt( 2)) << 16;
          type |= types.CharAt( 3) << 8;
          type |= types.CharAt( 4);
          creator = ((PRUint32)types.CharAt( 6)) << 24;
          creator |= ((PRUint32)types.CharAt( 7)) << 16;
          creator |= types.CharAt( 8) << 8;
          creator |= types.CharAt( 9);
          str.Left( types, str.Length() - 11);
          str = types;
          str.Trim( kWhitespace);
        }
      }
      else
        fNum = 0;
    }
  }

#ifdef IMPORT_DEBUG
  nsCString  typeStr;
  nsCString  creatStr;

  creatStr.Append( (const char *)&creator, 4);
  typeStr.Append( (const char *)&type, 4);
  IMPORT_LOG3( "\tAttachment type: %s, creator: %s, fileNum: %ld\n", typeStr.get(), creatStr.get(), fNum);
  IMPORT_LOG1( "\tAttachment file name: %s\n", str.get());
#endif
  FSRef  fsRef;
  memset( &fsRef, 0, sizeof( fsRef));
  {
    nsresult rv;
    nsCOMPtr <nsILocalFile> pLocalFile = do_QueryInterface(pFile, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    pLocalFile->InitWithNativePath(str);
    if (NS_FAILED(rv))
    {
      IMPORT_LOG0("\tfailed to set native path\n");
      return rv;
    }

    pFile->GetNativeLeafName( aAttachment);

    nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(pFile, &rv);
    if (NS_FAILED(rv))
    {
      IMPORT_LOG0("\tfailed to get local mac file\n");
      return rv;
    }

    rv = macFile->GetFSRef(&fsRef);
    if (NS_FAILED(rv))
    {
      IMPORT_LOG0("\tfailed to get FSRef\n");
      return rv;
    }
  }

  if (HasResourceFork(&fsRef))
    mimeType = "application/applefile";
  else
    mimeType = "application/octet-stream";

  IMPORT_LOG1( "\tMimeType: %s\n", mimeType.get());

  return( NS_OK);
}

bool nsEudoraMac::HasResourceFork(FSRef *fsRef)
{
  FSCatalogInfo catalogInfo;
  OSErr err = FSGetCatalogInfo(fsRef,
                               kFSCatInfoDataSizes + kFSCatInfoRsrcSizes,
                               &catalogInfo, nsnull, nsnull, nsnull);
  return (err == noErr && catalogInfo.rsrcLogicalSize != 0);
}


#define    kNumBadFolderNames    7
const char *cBadFolderNames[kNumBadFolderNames] =
{
  "Attachments Folder",
  "Eudora Items",
  "Nicknames Folder",
  "Parts Folder",
  "Signature Folder",
  "Spool Folder",
  "Stationery Folder"
};

bool nsEudoraMac::IsValidMailFolderName( nsCString& name)
{
  if (m_depth > 1)
    return( PR_TRUE);

  for (int i = 0; i < kNumBadFolderNames; i++)
  {
    if (name.Equals( cBadFolderNames[i], nsCaseInsensitiveCStringComparator()))
      return( PR_FALSE);
  }

  return( PR_TRUE);
}


bool nsEudoraMac::IsValidMailboxName( nsCString& fName)
{
  if (m_depth > 1)
    return( PR_TRUE);
  if (fName.LowerCaseEqualsLiteral("eudora nicknames"))
    return( PR_FALSE);
  return( PR_TRUE);
}


bool nsEudoraMac::IsValidMailboxFile( nsIFile *pFile)
{
  PRInt64  size = 0;
  nsresult rv = pFile->GetFileSize( &size);
  if (size)
  {
    if (size < 10)
      return( PR_FALSE);
    nsCOMPtr <nsIInputStream> inputStream;
    rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), pFile);
    if (NS_FAILED( rv))
      return( PR_FALSE);
    PRUint32  read = 0;
    char  buffer[6];
    char *  pBuf = buffer;
    rv = inputStream->Read( pBuf, 5, &read);
    inputStream->Close();
    if (NS_FAILED( rv) || (read != 5))
      return( PR_FALSE);
    buffer[5] = 0;
    if (strcmp( buffer, "From "))
      return( PR_FALSE);
  }

  return( PR_TRUE);
}




bool nsEudoraMac::FindAddressFolder( nsIFile **pFolder)
{
  return( FindEudoraLocation( pFolder));
}

nsresult nsEudoraMac::FindAddressBooks( nsIFile *pRoot, nsISupportsArray **ppArray)
{
  // Look for the nicknames file in this folder and then
  // additional files in the Nicknames folder
  // Try and find the nickNames file
  nsresult rv;
  nsCOMPtr<nsILocalFile> file = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsILocalFile> localRoot = do_QueryInterface(pRoot);
  rv = file->InitWithFile(localRoot);
  if (NS_FAILED( rv))
    return( rv);
  rv = NS_NewISupportsArray( ppArray);
  if (NS_FAILED( rv))
  {
    IMPORT_LOG0( "FAILED to allocate the nsISupportsArray\n");
    return( rv);
  }

  nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  if (NS_FAILED( rv))
    return( rv);

  nsString displayName;
  nsEudoraStringBundle::GetStringByID( EUDORAIMPORT_NICKNAMES_NAME, displayName);
  PRInt64  sz = 0;

  // First find the Nicknames file itself
  rv = file->AppendNative( NS_LITERAL_CSTRING("Eudora Nicknames"));
  bool exists = false;
  bool isFile = false;
  if (NS_SUCCEEDED( rv))
    rv = file->Exists( &exists);
  if (NS_SUCCEEDED( rv) && exists)
    rv = file->IsFile( &isFile);


  nsCOMPtr<nsIImportABDescriptor>  desc;
  nsISupports *pInterface;

  if (exists && isFile)
  {
    rv = impSvc->CreateNewABDescriptor( getter_AddRefs( desc));
    if (NS_SUCCEEDED( rv))
    {
      sz = 0;
      file->GetFileSize( &sz);
      desc->SetPreferredName(displayName);
      desc->SetSize( sz);
      // SetAbFile will clone the file we pass to it.
      desc->SetAbFile(file);
      rv = desc->QueryInterface( kISupportsIID, (void **) &pInterface);
      (*ppArray)->AppendElement( pInterface);
      pInterface->Release();
    }
    if (NS_FAILED( rv))
    {
      IMPORT_LOG0( "*** Error creating address book descriptor for eudora nicknames\n");
      return( rv);
    }
  }

  // Now try the directory of address books!
  rv = file->InitWithFile(localRoot);
  if (NS_SUCCEEDED( rv))
    rv = file->AppendNative(NS_LITERAL_CSTRING("Nicknames Folder"));
  exists = PR_FALSE;
  bool    isDir = false;
  if (NS_SUCCEEDED( rv))
    rv = file->Exists( &exists);
  if (NS_SUCCEEDED( rv) && exists)
    rv = file->IsDirectory( &isDir);

  if (!isDir)
    return( NS_OK);

  bool hasMore;
  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
   rv = file->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  directoryEnumerator->HasMoreElements(&hasMore);

  nsCString name;
  OSType          type;
  OSType          creator;

  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsILocalFile> entry(do_QueryInterface(aSupport, &rv));
    directoryEnumerator->HasMoreElements(&hasMore);

    if (NS_SUCCEEDED( rv))
    {
      isFile = PR_FALSE;
      rv = entry->IsFile( &isFile);
      rv = entry->GetLeafName(displayName);
      if (NS_SUCCEEDED( rv) && !displayName.IsEmpty() && isFile)
      {
        if (NS_SUCCEEDED( rv))
        {
          type = 0;
          creator = 0;
          {
            nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(entry, &rv);
            if (NS_SUCCEEDED(rv))
            {
              macFile->GetFileCreator(&creator);
              macFile->GetFileType(&type);
            }
          }
          if (type == 'TEXT')
          {

            rv = impSvc->CreateNewABDescriptor( getter_AddRefs( desc));
            if (NS_SUCCEEDED( rv))
            {
              sz = 0;
              entry->GetFileSize( &sz);
              desc->SetPreferredName(displayName);
              desc->SetSize( sz);
              // SetAbFile will clone the file we pass to it.
              desc->SetAbFile(entry);
              rv = desc->QueryInterface( kISupportsIID, (void **) &pInterface);
              (*ppArray)->AppendElement( pInterface);
              pInterface->Release();
            }
            if (NS_FAILED( rv))
            {
              IMPORT_LOG0( "*** Error creating address book descriptor for eudora address book\n");
              return( rv);
            }
          }
        }
      }
    }
  }
  return( rv);
}

