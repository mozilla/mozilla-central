/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/*

  Outlook Express (Win32) import mail and addressbook interfaces

*/
#ifdef MOZ_LOGGING
// sorry, this has to be before the pre-compiled header
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

#include "nscore.h"
#include "nsMsgUtils.h"
#include "nsStringGlue.h"
#include "nsComponentManagerUtils.h"
#include "nsIImportService.h"
#include "nsOEImport.h"
#include "nsIMemory.h"
#include "nsOEScanBoxes.h"
#include "nsIImportService.h"
#include "nsIImportMail.h"
#include "nsIImportMailboxDescriptor.h"
#include "nsIImportGeneric.h"
#include "nsOEMailbox.h"
#include "nsIImportAddressBooks.h"
#include "nsIImportABDescriptor.h"
#include "nsIImportFieldMap.h"
#include "nsXPCOM.h"
#include "nsISupportsPrimitives.h"
#include "WabObject.h"
#include "nsOEAddressIterator.h"
#include "nsIOutputStream.h"
#include "nsOE5File.h"
#include "nsIAddrDatabase.h"
#include "nsOESettings.h"
#include "nsTextFormatter.h"
#include "nsOEStringBundle.h"
#include "nsIStringBundle.h"
#include "nsUnicharUtils.h"
#include "nsDirectoryServiceUtils.h"
#include "nsDirectoryServiceDefs.h"

#include "OEDebugLog.h"

static NS_DEFINE_IID(kISupportsIID, NS_ISUPPORTS_IID);
PRLogModuleInfo *OELOGMODULE = nullptr;

class ImportOEMailImpl : public nsIImportMail
{
public:
  ImportOEMailImpl();
  virtual ~ImportOEMailImpl();

  static nsresult Create(nsIImportMail** aImport);

  // nsISupports interface
  NS_DECL_THREADSAFE_ISUPPORTS

  // nsIImportmail interface

  /* void GetDefaultLocation (out nsIFile location, out boolean found, out boolean userVerify); */
  NS_IMETHOD GetDefaultLocation(nsIFile **location, bool *found, bool *userVerify);

  /* nsISupportsArray FindMailboxes (in nsIFile location); */
  NS_IMETHOD FindMailboxes(nsIFile *location, nsISupportsArray **_retval);

  NS_IMETHOD ImportMailbox(nsIImportMailboxDescriptor *source,
                           nsIMsgFolder *dstFolder,
                           PRUnichar **pErrorLog, PRUnichar **pSuccessLog,
                           bool *fatalError);

  /* unsigned long GetImportProgress (); */
  NS_IMETHOD GetImportProgress(uint32_t *_retval);

    NS_IMETHOD TranslateFolderName(const nsAString & aFolderName, nsAString & _retval);

public:
  static void ReportSuccess(nsString& name, int32_t count, nsString *pStream);
  static void ReportError(int32_t errorNum, nsString& name, nsString *pStream);
  static void AddLinebreak(nsString *pStream);
  static void SetLogs(nsString& success, nsString& error, PRUnichar **pError, PRUnichar **pSuccess);

private:
  uint32_t m_bytesDone;
};


class ImportOEAddressImpl : public nsIImportAddressBooks
{
public:
    ImportOEAddressImpl();
    virtual ~ImportOEAddressImpl();

  static nsresult Create(nsIImportAddressBooks** aImport);

  // nsISupports interface
  NS_DECL_THREADSAFE_ISUPPORTS

    // nsIImportAddressBooks interface

  NS_IMETHOD GetSupportsMultiple(bool *_retval) { *_retval = false; return NS_OK;}

  NS_IMETHOD GetAutoFind(PRUnichar **description, bool *_retval);

  NS_IMETHOD GetNeedsFieldMap(nsIFile *pLoc, bool *_retval) { *_retval = false; return NS_OK;}

  NS_IMETHOD GetDefaultLocation(nsIFile **location, bool *found, bool *userVerify);

  NS_IMETHOD FindAddressBooks(nsIFile *location, nsISupportsArray **_retval);

  NS_IMETHOD InitFieldMap(nsIImportFieldMap *fieldMap)
    { return NS_ERROR_FAILURE; }

  NS_IMETHOD ImportAddressBook(nsIImportABDescriptor *source,
                               nsIAddrDatabase *destination,
                               nsIImportFieldMap *fieldMap,
                               nsISupports *aSupportService,
                               PRUnichar **errorLog,
                               PRUnichar **successLog,
                               bool *fatalError);

  NS_IMETHOD GetImportProgress(uint32_t *_retval);

  NS_IMETHOD GetSampleData(int32_t index, bool *pFound, PRUnichar **pStr)
    { return NS_ERROR_FAILURE;}

  NS_IMETHOD SetSampleLocation(nsIFile *) { return NS_OK; }

private:
  static void ReportSuccess(nsString& name, nsString *pStream);

private:
  CWAB * m_pWab;
  int m_doneSoFar;
};
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////


nsOEImport::nsOEImport()
{
  // Init logging module.
  if (!OELOGMODULE)
    OELOGMODULE = PR_NewLogModule("IMPORT");
  IMPORT_LOG0("nsOEImport Module Created\n");
  nsOEStringBundle::GetStringBundle();
}


nsOEImport::~nsOEImport()
{
  IMPORT_LOG0("nsOEImport Module Deleted\n");
}

NS_IMPL_ISUPPORTS1(nsOEImport, nsIImportModule)

NS_IMETHODIMP nsOEImport::GetName(PRUnichar **name)
{
  NS_ENSURE_ARG_POINTER(name);

  *name = nsOEStringBundle::GetStringByID(OEIMPORT_NAME);

    return NS_OK;
}

NS_IMETHODIMP nsOEImport::GetDescription(PRUnichar **name)
{
  NS_ENSURE_ARG_POINTER(name);

  *name = nsOEStringBundle::GetStringByID(OEIMPORT_DESCRIPTION);
  return NS_OK;
}

NS_IMETHODIMP nsOEImport::GetSupports(char **supports)
{
  NS_PRECONDITION(supports != nullptr, "null ptr");
  if (! supports)
      return NS_ERROR_NULL_POINTER;

  *supports = strdup(kOESupportsString);
  return NS_OK;
}


NS_IMETHODIMP nsOEImport::GetSupportsUpgrade(bool *pUpgrade)
{
  NS_PRECONDITION(pUpgrade != nullptr, "null ptr");
  if (! pUpgrade)
    return NS_ERROR_NULL_POINTER;

  *pUpgrade = true;
  return NS_OK;
}

NS_IMETHODIMP nsOEImport::GetImportInterface(const char *pImportType, nsISupports **ppInterface)
{
  NS_ENSURE_ARG_POINTER(pImportType);
  NS_ENSURE_ARG_POINTER(ppInterface);

  *ppInterface = nullptr;
  nsresult rv;
  if (!strcmp(pImportType, "mail")) {
    // create the nsIImportMail interface and return it!
    nsIImportMail *  pMail = nullptr;
    nsIImportGeneric *pGeneric = nullptr;
    rv = ImportOEMailImpl::Create(&pMail);
    if (NS_SUCCEEDED(rv)) {
      nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
      if (NS_SUCCEEDED(rv)) {
        rv = impSvc->CreateNewGenericMail(&pGeneric);
        if (NS_SUCCEEDED(rv)) {
          pGeneric->SetData("mailInterface", pMail);
          nsString name;
          nsOEStringBundle::GetStringByID(OEIMPORT_NAME, name);
          nsCOMPtr<nsISupportsString> nameString (do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID, &rv));
          if (NS_SUCCEEDED(rv)) {
            nameString->SetData(name);
            pGeneric->SetData("name", nameString);
            rv = pGeneric->QueryInterface(kISupportsIID, (void **)ppInterface);
          }
        }
      }
    }
    NS_IF_RELEASE(pMail);
    NS_IF_RELEASE(pGeneric);
    return rv;
  }

  if (!strcmp(pImportType, "addressbook")) {
    // create the nsIImportMail interface and return it!
    nsIImportAddressBooks * pAddress = nullptr;
    nsIImportGeneric * pGeneric = nullptr;
    rv = ImportOEAddressImpl::Create(&pAddress);
    if (NS_SUCCEEDED(rv)) {
      nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
      if (NS_SUCCEEDED(rv)) {
        rv = impSvc->CreateNewGenericAddressBooks(&pGeneric);
        if (NS_SUCCEEDED(rv)) {
          pGeneric->SetData("addressInterface", pAddress);
          rv = pGeneric->QueryInterface(kISupportsIID, (void **)ppInterface);
        }
      }
    }
    NS_IF_RELEASE(pAddress);
    NS_IF_RELEASE(pGeneric);
    return rv;
  }

  if (!strcmp(pImportType, "settings")) {
    nsIImportSettings *pSettings = nullptr;
    rv = nsOESettings::Create(&pSettings);
    if (NS_SUCCEEDED(rv))
      pSettings->QueryInterface(kISupportsIID, (void **)ppInterface);
    NS_IF_RELEASE(pSettings);
    return rv;
  }

  return NS_ERROR_NOT_AVAILABLE;
}

/////////////////////////////////////////////////////////////////////////////////
nsresult ImportOEMailImpl::Create(nsIImportMail** aImport)
{
  NS_ENSURE_ARG_POINTER(aImport);
  *aImport = new ImportOEMailImpl();
  NS_ENSURE_TRUE(*aImport, NS_ERROR_OUT_OF_MEMORY);
  NS_ADDREF(*aImport);
  return NS_OK;
}

ImportOEMailImpl::ImportOEMailImpl()
{
}


ImportOEMailImpl::~ImportOEMailImpl()
{
}

NS_IMPL_ISUPPORTS1(ImportOEMailImpl, nsIImportMail)

NS_IMETHODIMP ImportOEMailImpl::TranslateFolderName(const nsAString & aFolderName, nsAString & _retval)
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

NS_IMETHODIMP ImportOEMailImpl::GetDefaultLocation(nsIFile **ppLoc, bool *found, bool *userVerify)
{
  NS_PRECONDITION(ppLoc != nullptr, "null ptr");
  NS_PRECONDITION(found != nullptr, "null ptr");
  NS_PRECONDITION(userVerify != nullptr, "null ptr");
  if (!ppLoc || !found || !userVerify)
    return NS_ERROR_NULL_POINTER;

  // use scanboxes to find the location.
  nsresult rv;
  nsCOMPtr <nsIFile> file = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return rv;

  if (nsOEScanBoxes::FindMail(file)) {
    *found = true;
    NS_IF_ADDREF(*ppLoc = file);
  }
  else {
    *found = false;
    *ppLoc = nullptr;
  }
  *userVerify = true;
  return NS_OK;
}


NS_IMETHODIMP ImportOEMailImpl::FindMailboxes(nsIFile *pLoc, nsISupportsArray **ppArray)
{
    NS_PRECONDITION(pLoc != nullptr, "null ptr");
    NS_PRECONDITION(ppArray != nullptr, "null ptr");
    if (!pLoc || !ppArray)
        return NS_ERROR_NULL_POINTER;

  bool exists = false;
  nsresult rv = pLoc->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
    return NS_ERROR_FAILURE;

  nsOEScanBoxes  scan;

  if (!scan.GetMailboxes(pLoc, ppArray))
    *ppArray = nullptr;

  return NS_OK;
}

void ImportOEMailImpl::AddLinebreak(nsString *pStream)
{
  if (pStream)
    pStream->Append(PRUnichar('\n'));
}

void ImportOEMailImpl::ReportSuccess(nsString& name, int32_t count, nsString *pStream)
{
  if (!pStream)
    return;
  // load the success string
  PRUnichar *pFmt = nsOEStringBundle::GetStringByID(OEIMPORT_MAILBOX_SUCCESS);
  PRUnichar *pText = nsTextFormatter::smprintf(pFmt, name.get(), count);
  pStream->Append(pText);
  nsTextFormatter::smprintf_free(pText);
  nsOEStringBundle::FreeString(pFmt);
  AddLinebreak(pStream);
}

void ImportOEMailImpl::ReportError(int32_t errorNum, nsString& name, nsString *pStream)
{
  if (!pStream)
    return;
  // load the error string
  PRUnichar *pFmt = nsOEStringBundle::GetStringByID(errorNum);
  PRUnichar *pText = nsTextFormatter::smprintf(pFmt, name.get());
  pStream->Append(pText);
  nsTextFormatter::smprintf_free(pText);
  nsOEStringBundle::FreeString(pFmt);
  AddLinebreak(pStream);
}


void ImportOEMailImpl::SetLogs(nsString& success, nsString& error, PRUnichar **pError, PRUnichar **pSuccess)
{
  if (pError)
    *pError = ToNewUnicode(error);
  if (pSuccess)
    *pSuccess = ToNewUnicode(success);
}

NS_IMETHODIMP ImportOEMailImpl::ImportMailbox(nsIImportMailboxDescriptor *pSource,
                                              nsIMsgFolder *dstFolder,
                                              PRUnichar **pErrorLog,
                                              PRUnichar **pSuccessLog,
                                              bool *fatalError)
{
  NS_ENSURE_ARG_POINTER(pSource);
  NS_ENSURE_ARG_POINTER(dstFolder);
  NS_ENSURE_ARG_POINTER(fatalError);

  nsString success;
  nsString error;
  bool abort = false;
  nsString name;
  nsString pName;
  if (NS_SUCCEEDED(pSource->GetDisplayName(getter_Copies(pName))))
    name = pName;

  uint32_t mailSize = 0;
  pSource->GetSize(&mailSize);
  if (mailSize == 0) {
    ReportSuccess(name, 0, &success);
    SetLogs(success, error, pErrorLog, pSuccessLog);
    return NS_OK;
  }

  nsCOMPtr <nsIFile> inFile;
  if (NS_FAILED(pSource->GetFile(getter_AddRefs(inFile)))) {
    ReportError(OEIMPORT_MAILBOX_BADSOURCEFILE, name, &error);
    SetLogs(success, error, pErrorLog, pSuccessLog);
    return NS_ERROR_FAILURE;
  }

  nsCString pPath;
  inFile->GetNativePath(pPath);
  IMPORT_LOG1("Importing Outlook Express mailbox: %s\n", pPath.get());

  m_bytesDone = 0;
  uint32_t msgCount = 0;
  nsresult rv;
  if (nsOE5File::IsLocalMailFile(inFile)) {
    IMPORT_LOG1("Importing OE5 mailbox: %s!\n", NS_LossyConvertUTF16toASCII(name.get()));
    rv = nsOE5File::ImportMailbox( &m_bytesDone, &abort, name, inFile, dstFolder, &msgCount);
  }
  else {
    if (CImportMailbox::ImportMailbox( &m_bytesDone, &abort, name, inFile, dstFolder, &msgCount))
       rv = NS_OK;
    else
      rv = NS_ERROR_FAILURE;
  }

  if (NS_SUCCEEDED(rv))
    ReportSuccess(name, msgCount, &success);
  else
    ReportError(OEIMPORT_MAILBOX_CONVERTERROR, name, &error);

  SetLogs(success, error, pErrorLog, pSuccessLog);

  return rv;
}

NS_IMETHODIMP ImportOEMailImpl::GetImportProgress(uint32_t *pDoneSoFar)
{
  NS_ENSURE_ARG_POINTER(pDoneSoFar);
  *pDoneSoFar = m_bytesDone;
  return NS_OK;
}

nsresult ImportOEAddressImpl::Create(nsIImportAddressBooks** aImport)
{
  NS_ENSURE_ARG_POINTER(aImport);

  *aImport = new ImportOEAddressImpl();
  NS_ENSURE_TRUE(*aImport, NS_ERROR_OUT_OF_MEMORY);
  NS_ADDREF(*aImport);
  return NS_OK;
}

ImportOEAddressImpl::ImportOEAddressImpl()
{
  m_pWab = nullptr;
}


ImportOEAddressImpl::~ImportOEAddressImpl()
{
  if (m_pWab)
    delete m_pWab;
}

NS_IMPL_ISUPPORTS1(ImportOEAddressImpl, nsIImportAddressBooks)

NS_IMETHODIMP ImportOEAddressImpl::GetDefaultLocation(nsIFile **aLocation,
                                                      bool *aFound,
                                                      bool *aUserVerify)
{
  NS_ENSURE_ARG_POINTER(aLocation);
  NS_ENSURE_ARG_POINTER(aFound);
  NS_ENSURE_ARG_POINTER(aUserVerify);

  *aLocation = nullptr;
  *aUserVerify = true;

  CWAB *wab = new CWAB(nullptr);
  *aFound = wab->IsAvailable();
  delete wab;

  if (*aFound) {
    // Unfortunately WAB interface has no function to obtain address book location.
    // So we set a fake location here.
    if (NS_SUCCEEDED(NS_GetSpecialDirectory(NS_XPCOM_CURRENT_PROCESS_DIR, aLocation)))
      *aUserVerify = false;
  }

  return NS_OK;
}

NS_IMETHODIMP ImportOEAddressImpl::GetAutoFind(PRUnichar **description, bool *_retval)
{
  NS_PRECONDITION(description != nullptr, "null ptr");
  NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (! description || !_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = false;
  nsString str;
  str.Append(nsOEStringBundle::GetStringByID(OEIMPORT_AUTOFIND));
  *description = ToNewUnicode(str);
  return NS_OK;
}



NS_IMETHODIMP ImportOEAddressImpl::FindAddressBooks(nsIFile *location, nsISupportsArray **_retval)
{
  NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  nsresult rv = NS_NewISupportsArray(_retval);
  if (NS_FAILED(rv))
    return rv;

  // Make sure we can load up the windows address book...
  rv = NS_ERROR_FAILURE;

  if (m_pWab)
    delete m_pWab;

  nsCOMPtr<nsIFile> currentProcessDir;
  rv = NS_GetSpecialDirectory(NS_XPCOM_CURRENT_PROCESS_DIR,
                              getter_AddRefs(currentProcessDir));
  bool equals = false;
  currentProcessDir->Equals(location, &equals);
  // If the location is not a fake, use it.
  if (location && !equals) {
    nsCOMPtr<nsIFile> localFile = do_QueryInterface(location, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    m_pWab = new CWAB(localFile);
  } else {
    m_pWab = new CWAB(nullptr);
  }

  nsIImportABDescriptor * pID;
  nsISupports * pInterface;
  nsString str;
  str.Append(nsOEStringBundle::GetStringByID(OEIMPORT_DEFAULT_NAME));

  if (m_pWab->Loaded()) {
    // create a new nsIImportABDescriptor and add it to the array
    nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
    if (NS_SUCCEEDED(rv)) {
      rv = impSvc->CreateNewABDescriptor(&pID);
      if (NS_SUCCEEDED(rv)) {
        pID->SetIdentifier(0x4F453334);
        pID->SetRef(1);
        pID->SetSize(100);
        pID->SetPreferredName(str);
        rv = pID->QueryInterface(kISupportsIID, (void **) &pInterface);
        (*_retval)->AppendElement(pInterface);
        pInterface->Release();
        pID->Release();
      }
    }
  }

  if (NS_FAILED(rv)) {
    delete m_pWab;
    m_pWab = nullptr;
  }
  return NS_OK;
}



NS_IMETHODIMP ImportOEAddressImpl::ImportAddressBook(nsIImportABDescriptor *source,
                                                     nsIAddrDatabase *destination,
                                                     nsIImportFieldMap *fieldMap,
                                                     nsISupports *aSupportService,
                                                     PRUnichar **errorLog,
                                                     PRUnichar **successLog,
                                                     bool *fatalError)
{
    NS_PRECONDITION(source != nullptr, "null ptr");
    // NS_PRECONDITION(destination != nullptr, "null ptr");
    // NS_PRECONDITION(fieldMap != nullptr, "null ptr");
    NS_PRECONDITION(fatalError != nullptr, "null ptr");
    if (!source || !fatalError)
        return NS_ERROR_NULL_POINTER;

  // we assume it is our one and only address book.
  if (!m_pWab) {
    IMPORT_LOG0("Wab not loaded in ImportAddressBook call\n");
    return NS_ERROR_FAILURE;
  }

  IMPORT_LOG0("IMPORTING OUTLOOK EXPRESS ADDRESS BOOK\n");

  nsString success;
  nsString error;
  if (!source || !destination || !fatalError)
  {
    nsOEStringBundle::GetStringByID(OEIMPORT_ADDRESS_BADPARAM, error);
    if (fatalError)
      *fatalError = true;
    ImportOEMailImpl::SetLogs(success, error, errorLog, successLog);
    return NS_ERROR_NULL_POINTER;
  }

  m_doneSoFar = 0;
  nsOEAddressIterator * pIter = new nsOEAddressIterator(m_pWab, destination);
  HRESULT hr = m_pWab->IterateWABContents(pIter, &m_doneSoFar);
  delete pIter;

  nsString name;
  if (SUCCEEDED(hr) && NS_SUCCEEDED(source->GetPreferredName(name)))
    ReportSuccess(name, &success);
  else
    ImportOEMailImpl::ReportError(OEIMPORT_ADDRESS_CONVERTERROR, name, &error);

  ImportOEMailImpl::SetLogs(success, error, errorLog, successLog);

  nsresult rv = destination->Commit(nsAddrDBCommitType::kLargeCommit);
  return rv;
}


NS_IMETHODIMP ImportOEAddressImpl::GetImportProgress(uint32_t *_retval)
{
  NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (! _retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = (uint32_t) m_doneSoFar;
  return NS_OK;
}

void ImportOEAddressImpl::ReportSuccess(nsString& name, nsString *pStream)
{
  if (!pStream)
    return;
  // load the success string
  PRUnichar *pFmt = nsOEStringBundle::GetStringByID(OEIMPORT_ADDRESS_SUCCESS);
  PRUnichar *pText = nsTextFormatter::smprintf(pFmt, name.get());
  pStream->Append(pText);
  nsTextFormatter::smprintf_free(pText);
  nsOEStringBundle::FreeString(pFmt);
  ImportOEMailImpl::AddLinebreak(pStream);
}
