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
 * The Original Code is mailnews vcard import.
 *
 * The Initial Developer of the Original Code is
 * Evan Stratford <evan.stratford@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2010
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
#include "nsIImportService.h"
#include "nsILocalFile.h"
#include "nsImportStringBundle.h"
#include "nsISupportsArray.h"
#include "nsServiceManagerUtils.h"
#include "nsTextFormatter.h"
#include "nsVCardAddress.h"
#include "nsVCardImport.h"

PRLogModuleInfo *VCARDLOGMODULE = nsnull;
static NS_DEFINE_IID(kISupportsIID, NS_ISUPPORTS_IID);

class ImportVCardAddressImpl : public nsIImportAddressBooks
{
public:
  ImportVCardAddressImpl(nsIStringBundle* aStringBundle); 
  virtual ~ImportVCardAddressImpl();

  static nsresult Create(
      nsIImportAddressBooks** aImport, nsIStringBundle* aStringBundle);

  // nsISupports interface
  NS_DECL_ISUPPORTS

  // nsIImportAddressBooks interface

  // TODO: support multiple vCard files in future - shouldn't be too hard,
  // since you just import each file in turn.
  NS_IMETHOD GetSupportsMultiple(PRBool *_retval)
  { *_retval = PR_FALSE; return NS_OK;}

  NS_IMETHOD GetAutoFind(PRUnichar **description, PRBool *_retval);

  NS_IMETHOD GetNeedsFieldMap(nsIFile *location, PRBool *_retval)
  { *_retval = PR_FALSE; return NS_OK;}

  NS_IMETHOD GetDefaultLocation(
      nsIFile **location, PRBool *found, PRBool *userVerify);

  NS_IMETHOD FindAddressBooks(nsIFile *location, nsISupportsArray **_retval);

  NS_IMETHOD InitFieldMap(nsIImportFieldMap *fieldMap)
  { return NS_ERROR_FAILURE;}

  NS_IMETHOD ImportAddressBook(nsIImportABDescriptor *source,
                               nsIAddrDatabase *destination,
                               nsIImportFieldMap *fieldMap,
                               nsISupports *aSupportService,
                               PRBool isAddrLocHome,
                               PRUnichar **errorLog,
                               PRUnichar **successLog,
                               PRBool *fatalError);

  NS_IMETHOD GetImportProgress(PRUint32 *_retval);

  NS_IMETHOD GetSampleData(PRInt32 index, PRBool *pFound, PRUnichar **pStr)
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
  nsCOMPtr<nsILocalFile> m_fileLoc;
  PRUint32 m_bytesImported;
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

NS_IMETHODIMP nsVCardImport::GetSupportsUpgrade(PRBool *pUpgrade)
{
  NS_ENSURE_ARG_POINTER(pUpgrade);
  *pUpgrade = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsVCardImport::GetImportInterface(
    const char *pImportType, nsISupports **ppInterface)
{
  NS_ENSURE_ARG_POINTER(pImportType);
  NS_ENSURE_ARG_POINTER(ppInterface);
  *ppInterface = nsnull;
  if (!strcmp(pImportType, "addressbook")) {
    nsresult rv;
    // create the nsIImportMail interface and return it!
    nsIImportAddressBooks *pAddress = nsnull;
    nsIImportGeneric *pGeneric = nsnull;
    rv = ImportVCardAddressImpl::Create(&pAddress, m_stringBundle);
    if (NS_SUCCEEDED(rv)) {
      nsCOMPtr<nsIImportService> impSvc(
          do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
      if (NS_SUCCEEDED(rv)) {
        rv = impSvc->CreateNewGenericAddressBooks(&pGeneric);
        if (NS_SUCCEEDED(rv)) {
          pGeneric->SetData("addressInterface", pAddress);
          rv = pGeneric->QueryInterface( kISupportsIID, (void **)ppInterface);
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

NS_IMPL_THREADSAFE_ISUPPORTS1(ImportVCardAddressImpl, nsIImportAddressBooks)

NS_IMETHODIMP ImportVCardAddressImpl::GetAutoFind(
    PRUnichar **addrDescription, PRBool *_retval)
{
  NS_ENSURE_ARG_POINTER(addrDescription);
  NS_ENSURE_ARG_POINTER(_retval);

  nsString str;
  *_retval = PR_FALSE;

  if (!m_notProxyBundle)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIStringBundle> proxy;
  nsresult rv = nsImportStringBundle::GetStringBundleProxy(
      m_notProxyBundle, getter_AddRefs(proxy));
  NS_ENSURE_SUCCESS(rv, rv);

  nsImportStringBundle::GetStringByName("vCardImportAddressName", proxy, str);
  *addrDescription = ToNewUnicode(str);
  return NS_OK;
}

NS_IMETHODIMP ImportVCardAddressImpl::GetDefaultLocation(
    nsIFile **ppLoc, PRBool *found, PRBool *userVerify)
{
  NS_ENSURE_ARG_POINTER(found);
  NS_ENSURE_ARG_POINTER(ppLoc);
  NS_ENSURE_ARG_POINTER(userVerify);

  *ppLoc = nsnull;
  *found = PR_FALSE;
  *userVerify = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP ImportVCardAddressImpl::FindAddressBooks(
    nsIFile *pLoc, nsISupportsArray **ppArray)
{
  NS_ENSURE_ARG_POINTER(pLoc);
  NS_ENSURE_ARG_POINTER(ppArray);

  *ppArray = nsnull;
  PRBool exists = PR_FALSE;
  nsresult rv = pLoc->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
    return NS_ERROR_FAILURE;

  PRBool isFile = PR_FALSE;
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

  PRInt32 idx = name.RFindChar('.');
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
    PRInt64 sz = 0;
    pLoc->GetFileSize(&sz);
    desc->SetPreferredName(name);
    desc->SetSize((PRUint32) sz);
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
    PRBool isAddrLocHome,
    PRUnichar ** pErrorLog,
    PRUnichar ** pSuccessLog,
    PRBool * fatalError)
{
  NS_ENSURE_ARG_POINTER(pSource);
  NS_ENSURE_ARG_POINTER(pDestination);
  NS_ENSURE_ARG_POINTER(fatalError);

  if (!m_notProxyBundle)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIStringBundle> proxy;
  nsresult rv = nsImportStringBundle::GetStringBundleProxy(
      m_notProxyBundle, getter_AddRefs(proxy));
  NS_ENSURE_SUCCESS(rv, rv);

  m_bytesImported = 0;
  nsString success, error;
  PRBool addrAbort = PR_FALSE;
  nsString name;
  pSource->GetPreferredName(name);

  PRUint32 addressSize = 0;
  pSource->GetSize(&addressSize);
  if (addressSize == 0) {
    IMPORT_LOG0("Address book size is 0, skipping import.\n");
    ReportSuccess(name, &success, proxy);
    SetLogs(success, error, pErrorLog, pSuccessLog);
    return NS_OK;
  }

  nsCOMPtr<nsIFile> inFile;
  if (NS_FAILED(pSource->GetAbFile(getter_AddRefs(inFile)))) {
    ReportError("vCardImportAddressBadSourceFile", name, &error, proxy);
    SetLogs(success, error, pErrorLog, pSuccessLog);
    return NS_ERROR_FAILURE;
  }

  if (!aSupportService) {
    IMPORT_LOG0("Missing support service to import call\n");
    return NS_ERROR_FAILURE;
  }

  rv = m_vCard.ImportAddresses(
      &addrAbort, name.get(), inFile, pDestination, error, &m_bytesImported);

  if (NS_SUCCEEDED(rv) && error.IsEmpty()) {
    ReportSuccess(name, &success, proxy);
    SetLogs(success, error, pErrorLog, pSuccessLog);
  }
  else {
    ReportError("vCardImportAddressConvertError", name, &error, proxy);
    SetLogs(success, error, pErrorLog, pSuccessLog);
  }

  IMPORT_LOG0("*** VCard address import done\n");
  return rv;
}

NS_IMETHODIMP ImportVCardAddressImpl::GetImportProgress(PRUint32 *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = m_bytesImported;
  return NS_OK;
}
