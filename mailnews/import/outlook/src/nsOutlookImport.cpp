/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
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

/*
  Outlook Express (Win32) import mail and addressbook interfaces
*/
#ifdef MOZ_LOGGING
// sorry, this has to be before the pre-compiled header
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

#include "nscore.h"
#include "nsString.h"
#include "nsReadableUtils.h"
#include "nsIServiceManager.h"
#include "nsIImportService.h"
#include "nsIComponentManager.h"
#include "nsOutlookImport.h"
#include "nsIMemory.h"
#include "nsIImportService.h"
#include "nsIImportMail.h"
#include "nsIImportMailboxDescriptor.h"
#include "nsIImportGeneric.h"
#include "nsIImportAddressBooks.h"
#include "nsIImportABDescriptor.h"
#include "nsIImportFieldMap.h"
#include "nsXPCOM.h"
#include "nsISupportsPrimitives.h"
#include "nsIOutputStream.h"
#include "nsIAddrDatabase.h"
#include "nsOutlookSettings.h"
#include "nsTextFormatter.h"
#include "nsOutlookStringBundle.h"
#include "nsIStringBundle.h"
#include "OutlookDebugLog.h"
#include "nsUnicharUtils.h"

#include "nsOutlookMail.h"

#include "MapiApi.h"

static NS_DEFINE_IID(kISupportsIID,      NS_ISUPPORTS_IID);
PRLogModuleInfo *OUTLOOKLOGMODULE = nsnull;

class ImportOutlookMailImpl : public nsIImportMail
{
public:
  ImportOutlookMailImpl();
  virtual ~ImportOutlookMailImpl();

  static nsresult Create(nsIImportMail** aImport);

  // nsISupports interface
  NS_DECL_ISUPPORTS

  // nsIImportmail interface

  /* void GetDefaultLocation (out nsIFile location, out boolean found, out boolean userVerify); */
  NS_IMETHOD GetDefaultLocation(nsIFile **location, bool *found, bool *userVerify);

  /* nsISupportsArray FindMailboxes (in nsIFile location); */
  NS_IMETHOD FindMailboxes(nsIFile *location, nsISupportsArray **_retval);

  /* void ImportMailbox (in nsIImportMailboxDescriptor source, in nsIFile destination, out boolean fatalError); */
  NS_IMETHOD ImportMailbox(nsIImportMailboxDescriptor *source, nsIFile *destination,
                PRUnichar **pErrorLog, PRUnichar **pSuccessLog, bool *fatalError);

  /* unsigned long GetImportProgress (); */
  NS_IMETHOD GetImportProgress(PRUint32 *_retval);

  NS_IMETHOD TranslateFolderName(const nsAString & aFolderName, nsAString & _retval);

public:
  static void  ReportSuccess( nsString& name, PRInt32 count, nsString *pStream);
  static void ReportError( PRInt32 errorNum, nsString& name, nsString *pStream);
  static void  AddLinebreak( nsString *pStream);
  static void  SetLogs( nsString& success, nsString& error, PRUnichar **pError, PRUnichar **pSuccess);

private:
  nsOutlookMail  m_mail;
  PRUint32    m_bytesDone;
};


class ImportOutlookAddressImpl : public nsIImportAddressBooks
{
public:
  ImportOutlookAddressImpl();
  virtual ~ImportOutlookAddressImpl();

  static nsresult Create(nsIImportAddressBooks** aImport);

  // nsISupports interface
  NS_DECL_ISUPPORTS

  // nsIImportAddressBooks interface

  NS_IMETHOD GetSupportsMultiple(bool *_retval) { *_retval = true; return( NS_OK);}

  NS_IMETHOD GetAutoFind(PRUnichar **description, bool *_retval);

  NS_IMETHOD GetNeedsFieldMap(nsIFile *location, bool *_retval) { *_retval = false; return( NS_OK);}

  NS_IMETHOD GetDefaultLocation(nsIFile **location, bool *found, bool *userVerify)
    { return( NS_ERROR_FAILURE);}

  NS_IMETHOD FindAddressBooks(nsIFile *location, nsISupportsArray **_retval);

  NS_IMETHOD InitFieldMap(nsIImportFieldMap *fieldMap)
    { return( NS_ERROR_FAILURE); }

  NS_IMETHOD ImportAddressBook(nsIImportABDescriptor *source,
                               nsIAddrDatabase *destination,
                               nsIImportFieldMap *fieldMap,
                               nsISupports *aSupportService,
                               PRUnichar **errorLog,
                               PRUnichar **successLog,
                               bool *fatalError);

  NS_IMETHOD GetImportProgress(PRUint32 *_retval);

  NS_IMETHOD GetSampleData( PRInt32 index, bool *pFound, PRUnichar **pStr)
    { return( NS_ERROR_FAILURE);}

  NS_IMETHOD SetSampleLocation( nsIFile *) { return( NS_OK); }

private:
  void  ReportSuccess( nsString& name, nsString *pStream);

private:
  PRUint32    m_msgCount;
  PRUint32    m_msgTotal;
  nsOutlookMail  m_address;
};
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////


nsOutlookImport::nsOutlookImport()
{
  // Init logging module.
  if (!OUTLOOKLOGMODULE)
    OUTLOOKLOGMODULE = PR_NewLogModule("IMPORT");

  IMPORT_LOG0( "nsOutlookImport Module Created\n");

  nsOutlookStringBundle::GetStringBundle();
}


nsOutlookImport::~nsOutlookImport()
{
  IMPORT_LOG0( "nsOutlookImport Module Deleted\n");
}

NS_IMPL_ISUPPORTS1(nsOutlookImport, nsIImportModule)

NS_IMETHODIMP nsOutlookImport::GetName( PRUnichar **name)
{
  NS_PRECONDITION(name != nsnull, "null ptr");
  if (! name)
    return NS_ERROR_NULL_POINTER;

  *name = nsOutlookStringBundle::GetStringByID( OUTLOOKIMPORT_NAME);
  return NS_OK;
}

NS_IMETHODIMP nsOutlookImport::GetDescription( PRUnichar **name)
{
    NS_PRECONDITION(name != nsnull, "null ptr");
    if (! name)
        return NS_ERROR_NULL_POINTER;

  *name = nsOutlookStringBundle::GetStringByID( OUTLOOKIMPORT_DESCRIPTION);

    return NS_OK;
}

NS_IMETHODIMP nsOutlookImport::GetSupports( char **supports)
{
  NS_PRECONDITION(supports != nsnull, "null ptr");
  if (! supports)
    return NS_ERROR_NULL_POINTER;

  *supports = strdup( kOutlookSupportsString);
  return( NS_OK);
}

NS_IMETHODIMP nsOutlookImport::GetSupportsUpgrade( bool *pUpgrade)
{
  NS_PRECONDITION(pUpgrade != nsnull, "null ptr");
  if (! pUpgrade)
    return NS_ERROR_NULL_POINTER;

  *pUpgrade = true;
  return( NS_OK);
}

NS_IMETHODIMP nsOutlookImport::GetImportInterface( const char *pImportType, nsISupports **ppInterface)
{
  NS_PRECONDITION(pImportType != nsnull, "null ptr");
  if (! pImportType)
    return NS_ERROR_NULL_POINTER;
  NS_PRECONDITION(ppInterface != nsnull, "null ptr");
  if (! ppInterface)
    return NS_ERROR_NULL_POINTER;

  *ppInterface = nsnull;
  nsresult  rv;
  if (!strcmp( pImportType, "mail")) {
    // create the nsIImportMail interface and return it!
    nsIImportMail *  pMail = nsnull;
    nsIImportGeneric *pGeneric = nsnull;
    rv = ImportOutlookMailImpl::Create( &pMail);
    if (NS_SUCCEEDED( rv)) {
      nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
      if (NS_SUCCEEDED( rv)) {
        rv = impSvc->CreateNewGenericMail( &pGeneric);
        if (NS_SUCCEEDED( rv)) {
          pGeneric->SetData( "mailInterface", pMail);
          nsString name;
          nsOutlookStringBundle::GetStringByID( OUTLOOKIMPORT_NAME, name);
          nsCOMPtr<nsISupportsString> nameString (do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID, &rv));
          if (NS_SUCCEEDED(rv)) {
            nameString->SetData(name);
            pGeneric->SetData( "name", nameString);
            rv = pGeneric->QueryInterface( kISupportsIID, (void **)ppInterface);
          }
        }
      }
    }
    NS_IF_RELEASE( pMail);
    NS_IF_RELEASE( pGeneric);
    return( rv);
  }

  if (!strcmp( pImportType, "addressbook")) {
    // create the nsIImportAddressBook interface and return it!
    nsIImportAddressBooks *  pAddress = nsnull;
    nsIImportGeneric *    pGeneric = nsnull;
    rv = ImportOutlookAddressImpl::Create( &pAddress);
    if (NS_SUCCEEDED( rv)) {
      nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
      if (NS_SUCCEEDED( rv)) {
        rv = impSvc->CreateNewGenericAddressBooks( &pGeneric);
        if (NS_SUCCEEDED( rv)) {
          pGeneric->SetData( "addressInterface", pAddress);
          rv = pGeneric->QueryInterface( kISupportsIID, (void **)ppInterface);
        }
      }
    }
    NS_IF_RELEASE( pAddress);
    NS_IF_RELEASE( pGeneric);
    return( rv);
  }

  if (!strcmp( pImportType, "settings")) {
    nsIImportSettings *pSettings = nsnull;
    rv = nsOutlookSettings::Create( &pSettings);
    if (NS_SUCCEEDED( rv))
      pSettings->QueryInterface( kISupportsIID, (void **)ppInterface);
    NS_IF_RELEASE( pSettings);
    return( rv);
  }

  return( NS_ERROR_NOT_AVAILABLE);
}

/////////////////////////////////////////////////////////////////////////////////
nsresult ImportOutlookMailImpl::Create(nsIImportMail** aImport)
{
  NS_PRECONDITION(aImport != nsnull, "null ptr");
  if (! aImport)
    return NS_ERROR_NULL_POINTER;

  *aImport = new ImportOutlookMailImpl();
  if (! *aImport)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(*aImport);
  return NS_OK;
}

ImportOutlookMailImpl::ImportOutlookMailImpl()
{
  nsOutlookCompose::CreateIdentity();
}

ImportOutlookMailImpl::~ImportOutlookMailImpl()
{
  nsOutlookCompose::ReleaseIdentity();
}

NS_IMPL_THREADSAFE_ISUPPORTS1(ImportOutlookMailImpl, nsIImportMail)

NS_IMETHODIMP ImportOutlookMailImpl::GetDefaultLocation( nsIFile **ppLoc, bool *found, bool *userVerify)
{
  NS_PRECONDITION(ppLoc != nsnull, "null ptr");
  NS_PRECONDITION(found != nsnull, "null ptr");
  NS_PRECONDITION(userVerify != nsnull, "null ptr");
  if (!ppLoc || !found || !userVerify)
    return NS_ERROR_NULL_POINTER;

  *found = false;
  *ppLoc = nsnull;
  *userVerify = false;
  // We need to verify here that we can get the mail, if true then
  // return a dummy location, otherwise return no location
  CMapiApi  mapi;
  if (!mapi.Initialize())
    return( NS_OK);
  if (!mapi.LogOn())
    return( NS_OK);

  CMapiFolderList  store;
  if (!mapi.IterateStores( store))
    return( NS_OK);

  if (store.GetSize() == 0)
    return( NS_OK);


  nsresult  rv;
  nsCOMPtr <nsILocalFile> resultFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return(rv);

  *found = true;
  NS_IF_ADDREF(*ppLoc = resultFile);
  *userVerify = false;

  return( NS_OK);
}


NS_IMETHODIMP ImportOutlookMailImpl::FindMailboxes( nsIFile *pLoc, nsISupportsArray **ppArray)
{
  NS_PRECONDITION(pLoc != nsnull, "null ptr");
  NS_PRECONDITION(ppArray != nsnull, "null ptr");
  if (!pLoc || !ppArray)
    return NS_ERROR_NULL_POINTER;
  return( m_mail.GetMailFolders( ppArray));
}

void ImportOutlookMailImpl::AddLinebreak( nsString *pStream)
{
  if (pStream)
    pStream->Append( PRUnichar('\n'));
}

void ImportOutlookMailImpl::ReportSuccess( nsString& name, PRInt32 count, nsString *pStream)
{
  if (!pStream)
    return;
  // load the success string
  PRUnichar *pFmt = nsOutlookStringBundle::GetStringByID( OUTLOOKIMPORT_MAILBOX_SUCCESS);
  PRUnichar *pText = nsTextFormatter::smprintf( pFmt, name.get(), count);
  pStream->Append( pText);
  nsTextFormatter::smprintf_free( pText);
  nsOutlookStringBundle::FreeString( pFmt);
  AddLinebreak( pStream);
}

void ImportOutlookMailImpl::ReportError( PRInt32 errorNum, nsString& name, nsString *pStream)
{
  if (!pStream)
    return;
  // load the error string
  PRUnichar *pFmt = nsOutlookStringBundle::GetStringByID(errorNum);
  PRUnichar *pText = nsTextFormatter::smprintf( pFmt, name.get());
  pStream->Append( pText);
  nsTextFormatter::smprintf_free( pText);
  nsOutlookStringBundle::FreeString( pFmt);
  AddLinebreak( pStream);
}


void ImportOutlookMailImpl::SetLogs( nsString& success, nsString& error, PRUnichar **pError, PRUnichar **pSuccess)
{
  if (pError)
    *pError = ToNewUnicode(error);
  if (pSuccess)
    *pSuccess = ToNewUnicode(success);
}

NS_IMETHODIMP ImportOutlookMailImpl::ImportMailbox(  nsIImportMailboxDescriptor *pSource,
                        nsIFile *pDestination,
                        PRUnichar **pErrorLog,
                        PRUnichar **pSuccessLog,
                        bool *fatalError)
{
  NS_PRECONDITION(pSource != nsnull, "null ptr");
  NS_PRECONDITION(pDestination != nsnull, "null ptr");
  NS_PRECONDITION(fatalError != nsnull, "null ptr");

  nsString  success;
  nsString  error;
  if (!pSource || !pDestination || !fatalError) {
    nsOutlookStringBundle::GetStringByID( OUTLOOKIMPORT_MAILBOX_BADPARAM, error);
    if (fatalError)
      *fatalError = true;
    SetLogs( success, error, pErrorLog, pSuccessLog);
      return NS_ERROR_NULL_POINTER;
  }

    bool      abort = false;
    nsString  name;
    PRUnichar *  pName;
    if (NS_SUCCEEDED( pSource->GetDisplayName( &pName))) {
      name = pName;
      NS_Free( pName);
    }

  PRUint32 mailSize = 0;
  pSource->GetSize( &mailSize);
  if (mailSize == 0) {
    ReportSuccess( name, 0, &success);
    SetLogs( success, error, pErrorLog, pSuccessLog);
    return( NS_OK);
  }

  PRUint32 index = 0;
  pSource->GetIdentifier( &index);
  PRInt32  msgCount = 0;
  nsresult rv = NS_OK;

  m_bytesDone = 0;

  rv = m_mail.ImportMailbox( &m_bytesDone, &abort, (PRInt32)index, name.get(), pDestination, &msgCount);

  if (NS_SUCCEEDED( rv))
    ReportSuccess( name, msgCount, &success);
  else
    ReportError( OUTLOOKIMPORT_MAILBOX_CONVERTERROR, name, &error);

  SetLogs( success, error, pErrorLog, pSuccessLog);

    return( rv);
}


NS_IMETHODIMP ImportOutlookMailImpl::GetImportProgress( PRUint32 *pDoneSoFar)
{
  NS_PRECONDITION(pDoneSoFar != nsnull, "null ptr");
  if (! pDoneSoFar)
    return NS_ERROR_NULL_POINTER;

  *pDoneSoFar = m_bytesDone;
  return( NS_OK);
}

NS_IMETHODIMP ImportOutlookMailImpl::TranslateFolderName(const nsAString & aFolderName, nsAString & _retval)
{
  if (aFolderName.LowerCaseEqualsLiteral("deleted items"))
    _retval = NS_LITERAL_STRING(kDestTrashFolderName);
  else if (aFolderName.LowerCaseEqualsLiteral("sent items"))
    _retval = NS_LITERAL_STRING(kDestSentFolderName);
  else if (aFolderName.LowerCaseEqualsLiteral("outbox"))
    _retval = NS_LITERAL_STRING(kDestUnsentMessagesFolderName);
  else
    _retval = aFolderName;
  return NS_OK;
}

nsresult ImportOutlookAddressImpl::Create(nsIImportAddressBooks** aImport)
{
  NS_PRECONDITION(aImport != nsnull, "null ptr");
  if (! aImport)
    return NS_ERROR_NULL_POINTER;

  *aImport = new ImportOutlookAddressImpl();
  if (! *aImport)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(*aImport);
  return NS_OK;
}

ImportOutlookAddressImpl::ImportOutlookAddressImpl()
{
  m_msgCount = 0;
  m_msgTotal = 0;
}

ImportOutlookAddressImpl::~ImportOutlookAddressImpl()
{
}

NS_IMPL_THREADSAFE_ISUPPORTS1(ImportOutlookAddressImpl, nsIImportAddressBooks)

NS_IMETHODIMP ImportOutlookAddressImpl::GetAutoFind(PRUnichar **description, bool *_retval)
{
  NS_PRECONDITION(description != nsnull, "null ptr");
  NS_PRECONDITION(_retval != nsnull, "null ptr");
  if (! description || !_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = true;
  nsString str;
  nsOutlookStringBundle::GetStringByID( OUTLOOKIMPORT_ADDRNAME, str);
  *description = ToNewUnicode(str);
  return( NS_OK);
}

NS_IMETHODIMP ImportOutlookAddressImpl::FindAddressBooks(nsIFile *location, nsISupportsArray **_retval)
{
  NS_PRECONDITION(_retval != nsnull, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  return( m_address.GetAddressBooks( _retval));
}

NS_IMETHODIMP ImportOutlookAddressImpl::ImportAddressBook(nsIImportABDescriptor *source,
                                                          nsIAddrDatabase *destination,
                                                          nsIImportFieldMap *fieldMap,
                                                          nsISupports *aSupportService,
                                                          PRUnichar **pErrorLog,
                                                          PRUnichar **pSuccessLog,
                                                          bool *fatalError)
{
  m_msgCount = 0;
  m_msgTotal = 0;
    NS_PRECONDITION(source != nsnull, "null ptr");
    NS_PRECONDITION(destination != nsnull, "null ptr");
  NS_PRECONDITION(fatalError != nsnull, "null ptr");

  nsString  success;
  nsString  error;
    if (!source || !destination || !fatalError) {
    IMPORT_LOG0( "*** Bad param passed to outlook address import\n");
    nsOutlookStringBundle::GetStringByID( OUTLOOKIMPORT_ADDRESS_BADPARAM, error);
    if (fatalError)
      *fatalError = true;
    ImportOutlookMailImpl::SetLogs( success, error, pErrorLog, pSuccessLog);
      return NS_ERROR_NULL_POINTER;
  }

    nsString name;
    source->GetPreferredName(name);

  PRUint32  id;
  if (NS_FAILED( source->GetIdentifier( &id))) {
    ImportOutlookMailImpl::ReportError( OUTLOOKIMPORT_ADDRESS_BADSOURCEFILE, name, &error);
    ImportOutlookMailImpl::SetLogs( success, error, pErrorLog, pSuccessLog);
    return( NS_ERROR_FAILURE);
  }

  nsresult rv = NS_OK;
  rv = m_address.ImportAddresses( &m_msgCount, &m_msgTotal, name.get(), id, destination, error);
  if (NS_SUCCEEDED( rv) && error.IsEmpty())
    ReportSuccess( name, &success);
  else
    ImportOutlookMailImpl::ReportError( OUTLOOKIMPORT_ADDRESS_CONVERTERROR, name, &error);

  ImportOutlookMailImpl::SetLogs( success, error, pErrorLog, pSuccessLog);
  IMPORT_LOG0( "*** Returning from outlook address import\n");
  return destination->Commit(nsAddrDBCommitType::kLargeCommit);
}


NS_IMETHODIMP ImportOutlookAddressImpl::GetImportProgress(PRUint32 *_retval)
{
  NS_PRECONDITION(_retval != nsnull, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  PRUint32 result = m_msgCount;
  if (m_msgTotal) {
    result *= 100;
    result /= m_msgTotal;
  }
  else
    result = 0;

  if (result > 100)
    result = 100;

  *_retval = result;

  return( NS_OK);
}

void ImportOutlookAddressImpl::ReportSuccess( nsString& name, nsString *pStream)
{
  if (!pStream)
    return;
  // load the success string
  PRUnichar *pFmt = nsOutlookStringBundle::GetStringByID(OUTLOOKIMPORT_ADDRESS_SUCCESS);
  PRUnichar *pText = nsTextFormatter::smprintf( pFmt, name.get());
  pStream->Append( pText);
  nsTextFormatter::smprintf_free( pText);
  nsOutlookStringBundle::FreeString( pFmt);
  ImportOutlookMailImpl::AddLinebreak( pStream);
}
