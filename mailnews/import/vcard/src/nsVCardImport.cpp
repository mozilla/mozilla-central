/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
  VCard import addressbook interfaces
*/
#ifdef MOZ_LOGGING
// sorry, this has to be before the pre-compiled header
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

#include "nscore.h"
#include "nsIAddrDatabase.h"
#include "nsIFile.h"
#include "nsIImportABDescriptor.h"
#include "nsIImportAddressBooks.h"
#include "nsIImportFieldMap.h"
#include "nsIImportGeneric.h"
#include "nsCOMPtr.h"
#include "nsIImportService.h"
#include "nsIFile.h"
#include "nsImportStringBundle.h"
#include "nsMsgUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsTextFormatter.h"
#include "nsVCardAddress.h"
#include "nsVCardImport.h"

PRLogModuleInfo *VCARDLOGMODULE = nullptr;
static NS_DEFINE_IID(kISupportsIID, NS_ISUPPORTS_IID);

class ImportVCardAddressImpl : public nsIImportAddressBooks
{
public:
  ImportVCardAddressImpl(nsIStringBundle* aStringBundle); 
  virtual ~ImportVCardAddressImpl();

  static nsresult Create(
      nsIImportAddressBooks** aImport, nsIStringBundle* aStringBundle);

  // nsISupports interface
  NS_DECL_THREADSAFE_ISUPPORTS

  // nsIImportAddressBooks interface

  // TODO: support multiple vCard files in future - shouldn't be too hard,
  // since you just import each file in turn.
  NS_IMETHOD GetSupportsMultiple(bool *_retval)
  { *_retval = false; return NS_OK;}

  NS_IMETHOD GetAutoFind(PRUnichar **description, bool *_retval);

  NS_IMETHOD GetNeedsFieldMap(nsIFile *location, bool *_retval)
  { *_retval = false; return NS_OK;}

  NS_IMETHOD GetDefaultLocation(
      nsIFile **location, bool *found, bool *userVerify);

  NS_IMETHOD FindAddressBooks(nsIFile *location, nsISupportsArray **_retval);

  NS_IMETHOD InitFieldMap(nsIImportFieldMap *fieldMap)
  { return NS_ERROR_FAILURE;}

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

  NS_IMETHOD SetSampleLocation(nsIFile *)
  { return NS_ERROR_FAILURE; } 

private:
  static void ReportSuccess(
      nsString& name, nsString *pStream, nsIStringBundle* pBundle);
  static void SetLogs(
      nsString& success, nsString& error,
      PRUnichar **pError, PRUnichar **pSuccess);
  static void ReportError(
      const char *errorName, nsString& name, nsString *pStream,
      nsIStringBundle* pBundle);

private:
  nsVCardAddress m_vCard;
  nsCOMPtr<nsIFile> m_fileLoc;
  uint32_t m_bytesImported;
  nsCOMPtr<nsIStringBundle> m_notProxyBundle;
};

nsVCardImport::nsVCardImport()
{
  if (!VCARDLOGMODULE)
    VCARDLOGMODULE = PR_NewLogModule("IMPORT");

  nsImportStringBundle::GetStringBundle(
      VCARDIMPORT_MSGS_URL, getter_AddRefs(m_stringBundle));

  IMPORT_LOG0("nsVCardImport Module Created\n");
}

nsVCardImport::~nsVCardImport()
{
  IMPORT_LOG0("nsVCardImport Module Deleted\n");
}

NS_IMPL_ISUPPORTS1(nsVCardImport, nsIImportModule)

NS_IMETHODIMP nsVCardImport::GetName(PRUnichar **name)
{
  NS_ENSURE_ARG_POINTER(name);
  *name = nsImportStringBundle::GetStringByName(
      "vCardImportName", m_stringBundle);
  return NS_OK;
}

NS_IMETHODIMP nsVCardImport::GetDescription(PRUnichar **name)
{
  NS_ENSURE_ARG_POINTER(name);
  *name = nsImportStringBundle::GetStringByName(
      "vCardImportDescription", m_stringBundle);
  return NS_OK;
}

NS_IMETHODIMP nsVCardImport::GetSupports(char **supports)
{
  NS_ENSURE_ARG_POINTER(supports);
  *supports = strdup(NS_IMPORT_ADDRESS_STR);
  return NS_OK;
}

NS_IMETHODIMP nsVCardImport::GetSupportsUpgrade(bool *pUpgrade)
{
  NS_ENSURE_ARG_POINTER(pUpgrade);
  *pUpgrade = true;
  return NS_OK;
}

NS_IMETHODIMP nsVCardImport::GetImportInterface(
    const char *pImportType, nsISupports **ppInterface)
{
  NS_ENSURE_ARG_POINTER(pImportType);
  NS_ENSURE_ARG_POINTER(ppInterface);
  *ppInterface = nullptr;
  if (!strcmp(pImportType, "addressbook")) {
    nsresult rv;
    // create the nsIImportMail interface and return it!
    nsIImportAddressBooks *pAddress = nullptr;
    nsIImportGeneric *pGeneric = nullptr;
    rv = ImportVCardAddressImpl::Create(&pAddress, m_stringBundle);
    if (NS_SUCCEEDED(rv)) {
      nsCOMPtr<nsIImportService> impSvc(
          do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
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
  return NS_ERROR_NOT_AVAILABLE;
}

nsresult ImportVCardAddressImpl::Create(
    nsIImportAddressBooks** aImport, nsIStringBundle* aStringBundle)
{
  NS_ENSURE_ARG_POINTER(aImport);
  *aImport = new ImportVCardAddressImpl(aStringBundle);
  if (!*aImport)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(*aImport);
  return NS_OK;
}

ImportVCardAddressImpl::ImportVCardAddressImpl(
    nsIStringBundle* aStringBundle) : m_notProxyBundle(aStringBundle)
{
}

ImportVCardAddressImpl::~ImportVCardAddressImpl()
{
}

NS_IMPL_ISUPPORTS1(ImportVCardAddressImpl, nsIImportAddressBooks)

NS_IMETHODIMP ImportVCardAddressImpl::GetAutoFind(
    PRUnichar **addrDescription, bool *_retval)
{
  NS_ENSURE_ARG_POINTER(addrDescription);
  NS_ENSURE_ARG_POINTER(_retval);

  nsString str;
  *_retval = false;

  if (!m_notProxyBundle)
    return NS_ERROR_FAILURE;

  nsImportStringBundle::GetStringByName("vCardImportAddressName", m_notProxyBundle, str);
  *addrDescription = ToNewUnicode(str);
  return NS_OK;
}

NS_IMETHODIMP ImportVCardAddressImpl::GetDefaultLocation(
    nsIFile **ppLoc, bool *found, bool *userVerify)
{
  NS_ENSURE_ARG_POINTER(found);
  NS_ENSURE_ARG_POINTER(ppLoc);
  NS_ENSURE_ARG_POINTER(userVerify);

  *ppLoc = nullptr;
  *found = false;
  *userVerify = true;
  return NS_OK;
}

NS_IMETHODIMP ImportVCardAddressImpl::FindAddressBooks(
    nsIFile *pLoc, nsISupportsArray **ppArray)
{
  NS_ENSURE_ARG_POINTER(pLoc);
  NS_ENSURE_ARG_POINTER(ppArray);

  *ppArray = nullptr;
  bool exists = false;
  nsresult rv = pLoc->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
    return NS_ERROR_FAILURE;

  bool isFile = false;
  rv = pLoc->IsFile(&isFile);
  if (NS_FAILED(rv) || !isFile)
    return NS_ERROR_FAILURE;

  m_fileLoc = do_QueryInterface(pLoc);
  
  /* Build an address book descriptor based on the file passed in! */
  nsCOMPtr<nsISupportsArray> array;
  rv = NS_NewISupportsArray(getter_AddRefs(array));
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("FAILED to allocate the nsISupportsArray\n");
    return rv;
  }

  nsString name;
  m_fileLoc->GetLeafName(name);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Failed getting leaf name of file\n");
    return rv;
  }

  int32_t idx = name.RFindChar('.');
  if ((idx != -1) && (idx > 0) && ((name.Length() - idx - 1) < 5)) {
    name.SetLength(idx);
  }

  nsCOMPtr<nsIImportABDescriptor>  desc;
  nsCOMPtr<nsIImportService> impSvc(
      do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Failed to obtain the import service\n");
    return rv;
  }

  rv = impSvc->CreateNewABDescriptor(getter_AddRefs(desc));
  if (NS_SUCCEEDED(rv)) {
    int64_t sz = 0;
    pLoc->GetFileSize(&sz);
    desc->SetPreferredName(name);
    desc->SetSize((uint32_t) sz);
    desc->SetAbFile(m_fileLoc);
    nsCOMPtr<nsISupports> pInterface(do_QueryInterface(desc, &rv));
    array->AppendElement(pInterface);
  }
  if (NS_FAILED(rv)) {
    IMPORT_LOG0(
        "*** Error creating address book descriptor for vCard import\n");
  } else {
    array.swap(*ppArray);
  }

  return rv;
}

void ImportVCardAddressImpl::ReportSuccess(
    nsString& name, nsString *pStream, nsIStringBundle* pBundle)
{
  if (!pStream)
    return;

  // load the success string
  PRUnichar *pFmt = nsImportStringBundle::GetStringByName(
      "vCardImportAddressSuccess", pBundle);

  PRUnichar *pText = nsTextFormatter::smprintf(pFmt, name.get());
  pStream->Append(pText);
  nsTextFormatter::smprintf_free(pText);
  NS_Free(pFmt);
  pStream->Append(PRUnichar('\n'));
}

void ImportVCardAddressImpl::ReportError(
    const char *errorName, nsString& name, nsString *pStream,
    nsIStringBundle* pBundle)
{
  if (!pStream)
    return;

  // load the error string
  PRUnichar *pFmt = nsImportStringBundle::GetStringByName(errorName, pBundle);
  PRUnichar *pText = nsTextFormatter::smprintf(pFmt, name.get());
  pStream->Append(pText);
  nsTextFormatter::smprintf_free(pText);
  NS_Free(pFmt);
  pStream->Append(PRUnichar('\n'));
}

void ImportVCardAddressImpl::SetLogs(
    nsString& success, nsString& error,
    PRUnichar **pError, PRUnichar **pSuccess)
{ 
  if (pError) 
    *pError = ToNewUnicode(error);
  if (pSuccess) 
    *pSuccess = ToNewUnicode(success);
}

NS_IMETHODIMP ImportVCardAddressImpl::ImportAddressBook(
    nsIImportABDescriptor *pSource,
    nsIAddrDatabase *pDestination,
    nsIImportFieldMap *fieldMap,
    nsISupports *aSupportService,
    PRUnichar ** pErrorLog,
    PRUnichar ** pSuccessLog,
    bool * fatalError)
{
  NS_ENSURE_ARG_POINTER(pSource);
  NS_ENSURE_ARG_POINTER(pDestination);
  NS_ENSURE_ARG_POINTER(fatalError);

  if (!m_notProxyBundle)
    return NS_ERROR_FAILURE;

  m_bytesImported = 0;
  nsString success, error;
  bool addrAbort = false;
  nsString name;
  pSource->GetPreferredName(name);

  uint32_t addressSize = 0;
  pSource->GetSize(&addressSize);
  if (addressSize == 0) {
    IMPORT_LOG0("Address book size is 0, skipping import.\n");
    ReportSuccess(name, &success, m_notProxyBundle);
    SetLogs(success, error, pErrorLog, pSuccessLog);
    return NS_OK;
  }

  nsCOMPtr<nsIFile> inFile;
  if (NS_FAILED(pSource->GetAbFile(getter_AddRefs(inFile)))) {
    ReportError("vCardImportAddressBadSourceFile", name, &error, m_notProxyBundle);
    SetLogs(success, error, pErrorLog, pSuccessLog);
    return NS_ERROR_FAILURE;
  }

  if (!aSupportService) {
    IMPORT_LOG0("Missing support service to import call\n");
    return NS_ERROR_FAILURE;
  }

  nsresult rv = m_vCard.ImportAddresses(
      &addrAbort, name.get(), inFile, pDestination, error, &m_bytesImported);

  if (NS_SUCCEEDED(rv) && error.IsEmpty()) {
    ReportSuccess(name, &success, m_notProxyBundle);
    SetLogs(success, error, pErrorLog, pSuccessLog);
  }
  else {
    ReportError("vCardImportAddressConvertError", name, &error, m_notProxyBundle);
    SetLogs(success, error, pErrorLog, pSuccessLog);
  }

  IMPORT_LOG0("*** VCard address import done\n");
  return rv;
}

NS_IMETHODIMP ImportVCardAddressImpl::GetImportProgress(uint32_t *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = m_bytesImported;
  return NS_OK;
}
