/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/*

  Text import addressbook interfaces

*/
#ifdef MOZ_LOGGING
// sorry, this has to be before the pre-compiled header
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

#include "nscore.h"
#include "nsIServiceManager.h"
#include "nsCOMPtr.h"
#include "nsIImportService.h"
#include "nsMsgI18N.h"
#include "nsIComponentManager.h"
#include "nsTextImport.h"
#include "nsIMemory.h"
#include "nsIImportGeneric.h"
#include "nsIImportAddressBooks.h"
#include "nsIImportABDescriptor.h"
#include "nsIImportFieldMap.h"
#include "nsIOutputStream.h"
#include "nsIAddrDatabase.h"
#include "nsIAbLDIFService.h"
#include "nsAbBaseCID.h"
#include "nsTextFormatter.h"
#include "nsImportStringBundle.h"
#include "nsTextAddress.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "TextDebugLog.h"
#include "nsNetUtil.h"
#include "nsMsgUtils.h"

#define TEXT_MSGS_URL "chrome://messenger/locale/textImportMsgs.properties"
#define TEXTIMPORT_NAME                  2000
#define TEXTIMPORT_DESCRIPTION           2001
#define TEXTIMPORT_ADDRESS_NAME          2002
#define TEXTIMPORT_ADDRESS_SUCCESS       2003
#define TEXTIMPORT_ADDRESS_BADPARAM      2004
#define TEXTIMPORT_ADDRESS_BADSOURCEFILE 2005
#define TEXTIMPORT_ADDRESS_CONVERTERROR  2006

static NS_DEFINE_IID(kISupportsIID, NS_ISUPPORTS_IID);
PRLogModuleInfo* TEXTIMPORTLOGMODULE;

class ImportAddressImpl : public nsIImportAddressBooks
{
public:
  ImportAddressImpl(nsIStringBundle* aStringBundle);

  static nsresult Create(nsIImportAddressBooks** aImport,
                         nsIStringBundle *aStringBundle);

    // nsISupports interface
    NS_DECL_THREADSAFE_ISUPPORTS

    // nsIImportAddressBooks interface
    
  NS_IMETHOD GetSupportsMultiple(bool *_retval) { *_retval = false; return NS_OK;}

  NS_IMETHOD GetAutoFind(PRUnichar **description, bool *_retval);

  NS_IMETHOD GetNeedsFieldMap(nsIFile *location, bool *_retval);

  NS_IMETHOD GetDefaultLocation(nsIFile **location, bool *found, bool *userVerify);

  NS_IMETHOD FindAddressBooks(nsIFile *location, nsISupportsArray **_retval);

  NS_IMETHOD InitFieldMap(nsIImportFieldMap *fieldMap);

  NS_IMETHOD ImportAddressBook(nsIImportABDescriptor *source,
                               nsIAddrDatabase *destination,
                               nsIImportFieldMap *fieldMap,
                               nsISupports *aSupportService,
                               PRUnichar **errorLog,
                               PRUnichar **successLog,
                               bool *fatalError);

  NS_IMETHOD GetImportProgress(uint32_t *_retval);

  NS_IMETHOD GetSampleData(int32_t index, bool *pFound, PRUnichar **pStr);

  NS_IMETHOD SetSampleLocation(nsIFile *);

private:
  void ClearSampleFile(void);
  void SaveFieldMap(nsIImportFieldMap *pMap);

  static void ReportSuccess(nsString& name, nsString *pStream,
                            nsIStringBundle* pBundle);
  static void SetLogs(nsString& success, nsString& error, PRUnichar **pError,
                      PRUnichar **pSuccess);
  static void ReportError(int32_t errorNum, nsString& name, nsString *pStream,
                          nsIStringBundle* pBundle);
  static void SanitizeSampleData(nsString& val);

private:
  nsTextAddress m_text;
  bool m_haveDelim;
  nsCOMPtr<nsIFile> m_fileLoc;
  nsCOMPtr<nsIStringBundle> m_notProxyBundle;
  PRUnichar m_delim;
  uint32_t m_bytesImported;
};

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

nsTextImport::nsTextImport()
{
  // Init logging module.
  if (!TEXTIMPORTLOGMODULE)
    TEXTIMPORTLOGMODULE = PR_NewLogModule("IMPORT");
  IMPORT_LOG0("nsTextImport Module Created\n");

  nsImportStringBundle::GetStringBundle(TEXT_MSGS_URL,
                                        getter_AddRefs(m_stringBundle));
}

nsTextImport::~nsTextImport()
{
  IMPORT_LOG0("nsTextImport Module Deleted\n");
}

NS_IMPL_ISUPPORTS1(nsTextImport, nsIImportModule)

NS_IMETHODIMP nsTextImport::GetName(PRUnichar **name)
{
  NS_ENSURE_ARG_POINTER(name);
  *name = nsImportStringBundle::GetStringByID(TEXTIMPORT_NAME, m_stringBundle);
  return NS_OK;
}

NS_IMETHODIMP nsTextImport::GetDescription(PRUnichar **name)
{
  NS_ENSURE_ARG_POINTER(name);
  *name = nsImportStringBundle::GetStringByID(TEXTIMPORT_DESCRIPTION,
                                              m_stringBundle);

  return NS_OK;
}

NS_IMETHODIMP nsTextImport::GetSupports(char **supports)
{
  NS_ENSURE_ARG_POINTER(supports);
  *supports = strdup(kTextSupportsString);
  return NS_OK;
}

NS_IMETHODIMP nsTextImport::GetSupportsUpgrade(bool *pUpgrade)
{
  NS_PRECONDITION(pUpgrade != nullptr, "null ptr");
  if (! pUpgrade)
    return NS_ERROR_NULL_POINTER;

  *pUpgrade = false;
  return NS_OK;
}

NS_IMETHODIMP nsTextImport::GetImportInterface(const char *pImportType, nsISupports **ppInterface)
{
  NS_ENSURE_ARG_POINTER(pImportType);
  NS_ENSURE_ARG_POINTER(ppInterface);

  *ppInterface = nullptr;
  nsresult rv;

  if (!strcmp(pImportType, "addressbook")) {
    // create the nsIImportMail interface and return it!
    nsIImportAddressBooks * pAddress = nullptr;
    nsIImportGeneric * pGeneric = nullptr;
    rv = ImportAddressImpl::Create(&pAddress, m_stringBundle);
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
  return NS_ERROR_NOT_AVAILABLE;
}

/////////////////////////////////////////////////////////////////////////////////



nsresult ImportAddressImpl::Create(nsIImportAddressBooks** aImport,
                                   nsIStringBundle* aStringBundle)
{
  NS_ENSURE_ARG_POINTER(aImport);
  *aImport = new ImportAddressImpl(aStringBundle);
  if (! *aImport)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(*aImport);
  return NS_OK;
}

ImportAddressImpl::ImportAddressImpl(nsIStringBundle* aStringBundle) :
  m_notProxyBundle(aStringBundle)
{
  m_haveDelim = false;
}

NS_IMPL_ISUPPORTS1(ImportAddressImpl, nsIImportAddressBooks)


NS_IMETHODIMP ImportAddressImpl::GetAutoFind(PRUnichar **addrDescription, bool *_retval)
{
  NS_PRECONDITION(addrDescription != nullptr, "null ptr");
  NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (! addrDescription || !_retval)
    return NS_ERROR_NULL_POINTER;

  nsString str;
  *_retval = false;

  if (!m_notProxyBundle)
    return NS_ERROR_FAILURE;

  nsImportStringBundle::GetStringByID(TEXTIMPORT_ADDRESS_NAME, m_notProxyBundle, str);
  *addrDescription = ToNewUnicode(str);
  return NS_OK;
}


NS_IMETHODIMP ImportAddressImpl::GetDefaultLocation(nsIFile **ppLoc, bool *found, bool *userVerify)
{
  NS_PRECONDITION(found != nullptr, "null ptr");
  NS_PRECONDITION(ppLoc != nullptr, "null ptr");
  NS_PRECONDITION(userVerify != nullptr, "null ptr");
  if (! found || !userVerify || !ppLoc)
    return NS_ERROR_NULL_POINTER;

  *ppLoc = nullptr;
  *found = false;
  *userVerify = true;
  return NS_OK;
}



NS_IMETHODIMP ImportAddressImpl::FindAddressBooks(nsIFile *pLoc, nsISupportsArray **ppArray)
{
  NS_PRECONDITION(pLoc != nullptr, "null ptr");
  NS_PRECONDITION(ppArray != nullptr, "null ptr");
  if (!pLoc || !ppArray)
    return NS_ERROR_NULL_POINTER;

  ClearSampleFile();

  *ppArray = nullptr;
  bool exists = false;
  nsresult rv = pLoc->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
    return NS_ERROR_FAILURE;

  bool isFile = false;
  rv = pLoc->IsFile(&isFile);
  if (NS_FAILED(rv) || !isFile)
    return NS_ERROR_FAILURE;

  rv = m_text.DetermineDelim(pLoc);

  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error determining delimitter\n");
    return rv;
  }
  m_haveDelim = true;
  m_delim = m_text.GetDelim();

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
  nsISupports * pInterface;

  nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
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
    rv = desc->QueryInterface(kISupportsIID, (void **) &pInterface);
    array->AppendElement(pInterface);
    pInterface->Release();
  }
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error creating address book descriptor for text import\n");
  }
  else {
    rv = array->QueryInterface(NS_GET_IID(nsISupportsArray), (void **) ppArray);
  }

  return rv;
}

void ImportAddressImpl::ReportSuccess(nsString& name, nsString *pStream,
                                      nsIStringBundle* pBundle)
{
  if (!pStream)
    return;

  // load the success string
  PRUnichar *pFmt =
    nsImportStringBundle::GetStringByID(TEXTIMPORT_ADDRESS_SUCCESS, pBundle);

  PRUnichar *pText = nsTextFormatter::smprintf(pFmt, name.get());
  pStream->Append(pText);
  nsTextFormatter::smprintf_free(pText);
  NS_Free(pFmt);
  pStream->Append(PRUnichar('\n'));
}

void ImportAddressImpl::ReportError(int32_t errorNum, nsString& name,
                                    nsString *pStream, nsIStringBundle* pBundle)
{
  if (!pStream)
    return;

  // load the error string
  PRUnichar *pFmt = nsImportStringBundle::GetStringByID(errorNum, pBundle);
  PRUnichar *pText = nsTextFormatter::smprintf(pFmt, name.get());
  pStream->Append(pText);
  nsTextFormatter::smprintf_free(pText);
  NS_Free(pFmt);
  pStream->Append(PRUnichar('\n'));
}

void ImportAddressImpl::SetLogs(nsString& success, nsString& error, PRUnichar **pError, PRUnichar **pSuccess)
{
  if (pError)
    *pError = ToNewUnicode(error);
  if (pSuccess)
    *pSuccess = ToNewUnicode(success);
}


NS_IMETHODIMP
ImportAddressImpl::ImportAddressBook(nsIImportABDescriptor *pSource,
                                     nsIAddrDatabase *pDestination,
                                     nsIImportFieldMap *fieldMap,
                                     nsISupports *aSupportService,
                                     PRUnichar ** pErrorLog,
                                     PRUnichar ** pSuccessLog,
                                     bool * fatalError)
{
  NS_PRECONDITION(pSource != nullptr, "null ptr");
  NS_PRECONDITION(pDestination != nullptr, "null ptr");
  NS_PRECONDITION(fatalError != nullptr, "null ptr");

  m_bytesImported = 0;

  nsString success, error;
  if (!pSource || !pDestination || !fatalError) {
    IMPORT_LOG0("*** Bad param passed to text address import\n");
    nsImportStringBundle::GetStringByID(TEXTIMPORT_ADDRESS_BADPARAM,
                                        m_notProxyBundle,
                                        error);

    SetLogs(success, error, pErrorLog, pSuccessLog);

    if (fatalError)
      *fatalError = true;

    return NS_ERROR_NULL_POINTER;
  }

  ClearSampleFile();

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
    ReportError(TEXTIMPORT_ADDRESS_BADSOURCEFILE, name, &error, m_notProxyBundle);
    SetLogs(success, error, pErrorLog, pSuccessLog);
    return NS_ERROR_FAILURE;
  }

  if (!aSupportService) {
    IMPORT_LOG0("Missing support service to import call");
    return NS_ERROR_FAILURE;
  }

  bool isLDIF = false;
  nsresult rv;
  nsCOMPtr<nsIAbLDIFService> ldifService(do_QueryInterface(aSupportService, &rv));

    if (NS_SUCCEEDED(rv)) {
      rv = ldifService->IsLDIFFile(inFile, &isLDIF);
      if (NS_FAILED(rv)) {
        IMPORT_LOG0("*** Error reading address file\n");
      }
    }

  if (NS_FAILED(rv)) {
    ReportError(TEXTIMPORT_ADDRESS_CONVERTERROR, name, &error, m_notProxyBundle);
    SetLogs(success, error, pErrorLog, pSuccessLog);
    return rv;
  }

  if (isLDIF) {
    if (ldifService)
      rv = ldifService->ImportLDIFFile(pDestination, inFile, false, &m_bytesImported);
    else
      return NS_ERROR_FAILURE;
  }
  else {
    rv = m_text.ImportAddresses(&addrAbort, name.get(), inFile, pDestination, fieldMap, error, &m_bytesImported);
    SaveFieldMap(fieldMap);
  }

  if (NS_SUCCEEDED(rv) && error.IsEmpty()) {
    ReportSuccess(name, &success, m_notProxyBundle);
    SetLogs(success, error, pErrorLog, pSuccessLog);
  }
  else {
    ReportError(TEXTIMPORT_ADDRESS_CONVERTERROR, name, &error, m_notProxyBundle);
    SetLogs(success, error, pErrorLog, pSuccessLog);
  }

  IMPORT_LOG0("*** Text address import done\n");
  return rv;
}


NS_IMETHODIMP ImportAddressImpl::GetImportProgress(uint32_t *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = m_bytesImported;
  return NS_OK;
}


NS_IMETHODIMP ImportAddressImpl::GetNeedsFieldMap(nsIFile *aLocation, bool *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  NS_ENSURE_ARG_POINTER(aLocation);

  *_retval = true;
  bool exists = false;
  bool isFile = false;

  nsresult rv = aLocation->Exists(&exists);
  rv = aLocation->IsFile(&isFile);

  if (!exists || !isFile)
    return NS_ERROR_FAILURE;

  bool    isLDIF = false;
  nsCOMPtr<nsIAbLDIFService> ldifService = do_GetService(NS_ABLDIFSERVICE_CONTRACTID, &rv);

  if (NS_SUCCEEDED(rv))
    rv = ldifService->IsLDIFFile(aLocation, &isLDIF);

  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error determining if file is of type LDIF\n");
    return rv;
  }

  if (isLDIF)
    *_retval = false;

  return NS_OK;
}

void ImportAddressImpl::SanitizeSampleData(nsString& val)
{
  // remove any line-feeds...
  int32_t offset = val.Find(NS_LITERAL_STRING("\x0D\x0A"));
  while (offset != -1) {
    val.Replace(offset, 2, NS_LITERAL_STRING(", "));
    offset = val.Find(NS_LITERAL_STRING("\x0D\x0A"), offset + 2);
  }
  offset = val.FindChar(13);
  while (offset != -1) {
    val.Replace(offset, 1, ',');
    offset = val.FindChar(13, offset + 2);
  }
  offset = val.FindChar(10);
  while (offset != -1) {
    val.Replace(offset, 1, ',');
    offset = val.FindChar(10, offset + 2);
  }
}

NS_IMETHODIMP ImportAddressImpl::GetSampleData(int32_t index, bool *pFound, PRUnichar **pStr)
{
  NS_PRECONDITION(pFound != nullptr, "null ptr");
  NS_PRECONDITION(pStr != nullptr, "null ptr");
  if (!pFound || !pStr)
    return NS_ERROR_NULL_POINTER;

  if (!m_fileLoc) {
    IMPORT_LOG0("*** Error, called GetSampleData before SetSampleLocation\n");
    return NS_ERROR_FAILURE;
  }

  nsresult rv;
  *pStr = nullptr;
  PRUnichar term = 0;

  if (!m_haveDelim) {
    rv = m_text.DetermineDelim(m_fileLoc);
    NS_ENSURE_SUCCESS(rv, rv);
    m_haveDelim = true;
    m_delim = m_text.GetDelim();
  }

  bool fileExists;
  rv = m_fileLoc->Exists(&fileExists);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!fileExists) {
    *pFound = false;
    *pStr = NS_strdup(&term);
    return NS_OK;
  }

  nsAutoString line;
  rv = nsTextAddress::ReadRecordNumber(m_fileLoc, line, index);
  if (NS_SUCCEEDED(rv)) {
    nsString str;
    nsString field;
    int32_t fNum = 0;
    while (nsTextAddress::GetField(line, fNum, field, m_delim)) {
      if (fNum)
        str.Append(PRUnichar('\n'));
      SanitizeSampleData(field);
      str.Append(field);
      fNum++;
      field.Truncate();
    }

    *pStr = ToNewUnicode(str);
    *pFound = true;

    /* IMPORT_LOG1("Sample data: %S\n", str.get()); */
  }
  else {
    *pFound = false;
    *pStr = NS_strdup(&term);
  }

  return NS_OK;
}

NS_IMETHODIMP ImportAddressImpl::SetSampleLocation(nsIFile *pLocation)
{
  NS_ENSURE_ARG_POINTER(pLocation);

  m_fileLoc = do_QueryInterface(pLocation);
  m_haveDelim = false;
  return NS_OK;
}

void ImportAddressImpl::ClearSampleFile(void)
{
  m_fileLoc = nullptr;
  m_haveDelim = false;
}

NS_IMETHODIMP ImportAddressImpl::InitFieldMap(nsIImportFieldMap *fieldMap)
{
  // Let's remember the last one the user used!
  // This should be normal for someone importing multiple times, it's usually
  // from the same file format.

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv)) {
    nsCString  prefStr;
    rv = prefs->GetCharPref("mailnews.import.text.fieldmap", getter_Copies(prefStr));
    if (NS_SUCCEEDED(rv)) {
      const char *pStr = prefStr.get();
      if (pStr) {
        fieldMap->SetFieldMapSize(0);
        long fNum;
        bool active;
        long fIndex = 0;
        while (*pStr) {
          while (*pStr && (*pStr != '+') && (*pStr != '-'))
            pStr++;
          if (*pStr == '+')
            active = true;
          else if (*pStr == '-')
            active = false;
          else
            break;
          fNum = 0;
          while (*pStr && ((*pStr < '0') || (*pStr > '9')))
            pStr++;
          if (!(*pStr))
            break;
          while (*pStr && (*pStr >= '0') && (*pStr <= '9')) {
            fNum *= 10;
            fNum += (*pStr - '0');
            pStr++;
          }
          while (*pStr && (*pStr != ','))
            pStr++;
          if (*pStr == ',')
            pStr++;
          fieldMap->SetFieldMap(-1, fNum);
          fieldMap->SetFieldActive(fIndex, active);
          fIndex++;
        }
        if (!fIndex) {
          int num;
          fieldMap->GetNumMozFields(&num);
          fieldMap->DefaultFieldMap(num);
        }
      }
    }

    // Now also get the last used skip first record value.
    bool skipFirstRecord = false;
    rv = prefs->GetBoolPref("mailnews.import.text.skipfirstrecord", &skipFirstRecord);
    if (NS_SUCCEEDED(rv))
      fieldMap->SetSkipFirstRecord(skipFirstRecord);
  }

  return NS_OK;
}


void ImportAddressImpl::SaveFieldMap(nsIImportFieldMap *pMap)
{
  if (!pMap)
    return;

  int size;
  int index;
  bool active;
  nsCString str;

  pMap->GetMapSize(&size);
  for (long i = 0; i < size; i++) {
    index = i;
    active = false;
    pMap->GetFieldMap(i, &index);
    pMap->GetFieldActive(i, &active);
    if (active)
      str.Append('+');
    else
      str.Append('-');

    str.AppendInt(index);
    str.Append(',');
  }

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));

  if (NS_SUCCEEDED(rv)) {
    nsCString prefStr;
    rv = prefs->GetCharPref("mailnews.import.text.fieldmap", getter_Copies(prefStr));
    if (NS_FAILED(rv) || !str.Equals(prefStr))
      rv = prefs->SetCharPref("mailnews.import.text.fieldmap", str.get());
  }

  // Now also save last used skip first record value.
  bool skipFirstRecord = false;
  rv = pMap->GetSkipFirstRecord(&skipFirstRecord);
  if (NS_SUCCEEDED(rv))
    prefs->SetBoolPref("mailnews.import.text.skipfirstrecord", skipFirstRecord);
}
