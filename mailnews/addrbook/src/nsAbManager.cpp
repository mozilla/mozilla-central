/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Mark Banner <mark@standard8.demon.co.uk>
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

#include "nsAbManager.h"
#include "nsAbBaseCID.h"
#include "nsAddrDatabase.h"
#include "nsIAbMDBDirectory.h"
#include "nsIOutputStream.h"
#include "nsNetUtil.h"
#include "nsMsgI18N.h"
#include "nsIStringBundle.h"
#include "nsMsgUtils.h"
#include "nsAppDirectoryServiceDefs.h"
#include "plstr.h"
#include "prmem.h"
#include "nsIRDFResource.h"
#include "rdf.h"
#include "nsIRDFService.h"
#include "nsIServiceManager.h"
#include "nsIDOMWindow.h"
#include "nsIFilePicker.h"
#include "plbase64.h"
#include "nsIWindowWatcher.h"
#include "nsDirectoryServiceUtils.h"
#include "nsVCard.h"
#include "nsVCardObj.h"
#include "nsIAbLDAPAttributeMap.h"
#include "nsICommandLine.h"
#include "nsILocalFile.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsDirectoryServiceUtils.h"
#include "nsIObserverService.h"
#include "nsDirPrefs.h"
#include "nsThreadUtils.h"

struct ExportAttributesTableStruct
{
  const char* abPropertyName;
  PRUint32 plainTextStringID;
};

// our schema is not fixed yet, but we still want some sort of objectclass
// for now, use obsolete in the class name, hinting that this will change
// see bugs bug #116692 and #118454
#define MOZ_AB_OBJECTCLASS "mozillaAbPersonAlpha"

// for now, the oder of the attributes with PR_TRUE for includeForPlainText
// should be in the same order as they are in the import code
// see importMsgProperties and nsImportStringBundle.
// 
// XXX todo, merge with what's in nsAbLDAPProperties.cpp, so we can
// use this for LDAP and LDIF export
//
// here's how we're coming up with the ldapPropertyName values
// if they are specified in RFC 2798, use them
// else use the 4.x LDIF attribute names (for example, "xmozillanickname"
// as we want to allow export from mozilla back to 4.x, and other apps
// are probably out there that can handle 4.x LDIF)
// else use the MOZ_AB_LDIF_PREFIX prefix, see nsIAddrDatabase.idl

const ExportAttributesTableStruct EXPORT_ATTRIBUTES_TABLE[] = {
  {kFirstNameProperty, 2100},
  {kLastNameProperty, 2101},
  {kDisplayNameProperty, 2102},
  {kNicknameProperty, 2103},
  {kPriEmailProperty, 2104},
  {k2ndEmailProperty, 2105},
  {kScreenNameProperty, 2136},
  {kPreferMailFormatProperty},
  {kLastModifiedDateProperty},
  {kWorkPhoneProperty, 2106},
  {kWorkPhoneTypeProperty},
  {kHomePhoneProperty, 2107},
  {kHomePhoneTypeProperty},
  {kFaxProperty, 2108},
  {kFaxTypeProperty},
  {kPagerProperty, 2109},
  {kPagerTypeProperty},
  {kCellularProperty, 2110},
  {kCellularTypeProperty},
  {kHomeAddressProperty, 2111},
  {kHomeAddress2Property, 2112},
  {kHomeCityProperty, 2113},
  {kHomeStateProperty, 2114},
  {kHomeZipCodeProperty, 2115},
  {kHomeCountryProperty, 2116},
  {kWorkAddressProperty, 2117},
  {kWorkAddress2Property, 2118},
  {kWorkCityProperty, 2119},
  {kWorkStateProperty, 2120},
  {kWorkZipCodeProperty, 2121},
  {kWorkCountryProperty, 2122},
  {kJobTitleProperty, 2123},
  {kDepartmentProperty, 2124},
  {kCompanyProperty, 2125},
  {kWorkWebPageProperty, 2126},
  {kHomeWebPageProperty, 2127},
  {kBirthYearProperty, 2128}, // unused for now
  {kBirthMonthProperty, 2129}, // unused for now
  {kBirthDayProperty, 2130}, // unused for now
  {kCustom1Property, 2131},
  {kCustom2Property, 2132},
  {kCustom3Property, 2133},
  {kCustom4Property, 2134},
  {kNotesProperty, 2135},
  {kAnniversaryYearProperty},
  {kAnniversaryMonthProperty},
  {kAnniversaryDayProperty},
  {kSpouseNameProperty},
  {kFamilyNameProperty},
};

//
// nsAbManager
//
nsAbManager::nsAbManager()
{
}

nsAbManager::~nsAbManager()
{
}

NS_IMPL_THREADSAFE_ADDREF(nsAbManager)
NS_IMPL_THREADSAFE_RELEASE(nsAbManager)
NS_IMPL_QUERY_INTERFACE3(nsAbManager,
                         nsIAbManager,
                         nsICommandLineHandler,
                         nsIObserver)

nsresult nsAbManager::Init()
{
  NS_ENSURE_TRUE(NS_IsMainThread(), NS_ERROR_FAILURE);

  nsresult rv;
  nsCOMPtr<nsIObserverService> observerService =
    do_GetService("@mozilla.org/observer-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = observerService->AddObserver(this, "profile-do-change", PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = observerService->AddObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID,
                                    PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP nsAbManager::Observe(nsISupports *aSubject, const char *aTopic,
                                   const PRUnichar *someData)
{
  // The nsDirPrefs code caches all the directories that it got
  // from the first profiles prefs.js.
  // When we profile switch, we need to force it to shut down.
  // We'll re-load all the directories from the second profiles prefs.js
  // that happens in nsAbBSDirectory::GetChildNodes()
  // when we call DIR_GetDirectories().
  if (!strcmp(aTopic, "profile-do-change"))
  {
    DIR_ShutDown();
    return NS_OK;
  }

  if (!strcmp(aTopic, NS_XPCOM_SHUTDOWN_OBSERVER_ID))
  {
    DIR_ShutDown();

    nsresult rv;
    nsCOMPtr<nsIObserverService> observerService =
      do_GetService("@mozilla.org/observer-service;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = observerService->RemoveObserver(this, "profile-do-change");
    NS_ENSURE_SUCCESS(rv, rv);

    rv = observerService->RemoveObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

//
// nsIAbManager
//

NS_IMETHODIMP nsAbManager::GetDirectories(nsISimpleEnumerator **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  // We cache the top level AB to ensure that nsIAbDirectory items are not
  // created and dumped every time GetDirectories is called. This was causing
  // performance problems, especially with the content policy on messages
  // with lots of urls.
  if (!mCacheTopLevelAb)
  {
    nsresult rv;
    nsCOMPtr<nsIRDFService> rdfService(do_GetService(NS_RDF_CONTRACTID "/rdf-service;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIRDFResource> parentResource;
    rv = rdfService->GetResource(NS_LITERAL_CSTRING(kAllDirectoryRoot),
                                 getter_AddRefs(parentResource));
    NS_ENSURE_SUCCESS(rv, rv);

    mCacheTopLevelAb = do_QueryInterface(parentResource, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return mCacheTopLevelAb->GetChildNodes(aResult);
}

NS_IMETHODIMP nsAbManager::GetDirectory(const nsACString &aURI,
                                        nsIAbDirectory **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsresult rv;
  nsCOMPtr<nsIRDFService> rdfService(do_GetService(NS_RDF_CONTRACTID "/rdf-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFResource> dirResource;
  rv = rdfService->GetResource(aURI, getter_AddRefs(dirResource));
  NS_ENSURE_SUCCESS(rv, rv);

  return CallQueryInterface(dirResource, aResult);
}

NS_IMETHODIMP nsAbManager::NewAddressBook(const nsAString &aDirName,
                                            const nsACString &aURI,
                                            const PRUint32 aType,
                                            const nsACString &aPrefName,
                                            nsACString &aResult)
{
  nsresult rv;

  nsCOMPtr<nsIRDFService> rdfService = do_GetService (NS_RDF_CONTRACTID "/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFResource> parentResource;
  rv = rdfService->GetResource(NS_LITERAL_CSTRING(kAllDirectoryRoot),
                               getter_AddRefs(parentResource));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> parentDir = do_QueryInterface(parentResource, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return parentDir->CreateNewDirectory(aDirName, aURI, aType, aPrefName, aResult);
}

NS_IMETHODIMP nsAbManager::DeleteAddressBook(const nsACString &aURI)
{
  // Find the address book
  nsresult rv;

  nsCOMPtr<nsIRDFService> rdfService =
    do_GetService(NS_RDF_CONTRACTID "/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFResource> directoryResource;
  rv = rdfService->GetResource(aURI, getter_AddRefs(directoryResource));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory = do_QueryInterface(directoryResource, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Now find the parent directory
  PRBool isMailList;
  rv = directory->GetIsMailList(&isMailList);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString uriToUse;
  if (!isMailList)
    // We only accept one layer of address books at the moment.
    uriToUse.AppendLiteral(kAllDirectoryRoot);
  else
  {
    uriToUse.Append(aURI);

    PRInt32 pos = uriToUse.RFindChar('/');

    // If we didn't find a / something really bad has happened
    if (pos == -1)
      return NS_ERROR_FAILURE;

    uriToUse = StringHead(uriToUse, pos);
  }

  nsCOMPtr<nsIRDFResource> parentResource;
  rv = rdfService->GetResource(uriToUse, getter_AddRefs(parentResource));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> parentDir(do_QueryInterface(parentResource, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  return parentDir->DeleteDirectory(directory);
}

NS_IMETHODIMP nsAbManager::AddAddressBookListener(nsIAbListener *aListener,
                                                  abListenerNotifyFlagValue aNotifyFlags)
{
  NS_ENSURE_ARG_POINTER(aListener);

  abListener newListener(aListener, aNotifyFlags);
  mListeners.AppendElementUnlessExists(newListener);
  return NS_OK;
}

NS_IMETHODIMP nsAbManager::RemoveAddressBookListener(nsIAbListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aListener);

  mListeners.RemoveElement(aListener);
  return NS_OK;
}

#define NOTIFY_AB_LISTENERS(propertyflag_, propertyfunc_, params_) \
  PR_BEGIN_MACRO                                                       \
  nsTObserverArray<abListener>::ForwardIterator iter(mListeners);      \
  while (iter.HasMore()) {                                             \
    const abListener &abL = iter.GetNext();                            \
    if (abL.mNotifyFlags & nsIAbListener::propertyflag_)               \
      abL.mListener->propertyfunc_ params_;                            \
  }                                                                    \
  PR_END_MACRO

NS_IMETHODIMP nsAbManager::NotifyItemPropertyChanged(nsISupports *aItem,
                                                     const char *aProperty,
                                                     const PRUnichar* aOldValue,
                                                     const PRUnichar* aNewValue)
{
  NOTIFY_AB_LISTENERS(itemChanged, OnItemPropertyChanged,
                      (aItem, aProperty, aOldValue, aNewValue));
  return NS_OK;
}

NS_IMETHODIMP nsAbManager::NotifyDirectoryItemAdded(nsIAbDirectory *aParentDirectory,
                                                    nsISupports *aItem)
{
  NOTIFY_AB_LISTENERS(itemAdded, OnItemAdded, (aParentDirectory, aItem));
  return NS_OK;
}

NS_IMETHODIMP nsAbManager::NotifyDirectoryItemDeleted(nsIAbDirectory *aParentDirectory,
                                                      nsISupports *aItem)
{
  NOTIFY_AB_LISTENERS(directoryItemRemoved, OnItemRemoved,
                      (aParentDirectory, aItem));
  return NS_OK;
}
  
NS_IMETHODIMP nsAbManager::NotifyDirectoryDeleted(nsIAbDirectory *aParentDirectory,
                                                  nsISupports *aDirectory)
{
  NOTIFY_AB_LISTENERS(directoryRemoved, OnItemRemoved,
                      (aParentDirectory, aDirectory));
  return NS_OK;
}

NS_IMETHODIMP nsAbManager::GetUserProfileDirectory(nsILocalFile **userDir)
{
  NS_ENSURE_ARG_POINTER(userDir);
  *userDir = nsnull;

  nsresult rv;
  nsCOMPtr<nsIFile> profileDir;
  nsCAutoString pathBuf;

  rv = NS_GetSpecialDirectory(NS_APP_USER_PROFILE_50_DIR, getter_AddRefs(profileDir));
  NS_ENSURE_SUCCESS(rv, rv);

  return CallQueryInterface(profileDir, userDir);
}

NS_IMETHODIMP nsAbManager::MailListNameExists(const PRUnichar *name, PRBool *exist)
{
  NS_ENSURE_ARG_POINTER(exist);

  *exist = PR_FALSE;

  // Get the rdf service
    nsresult rv;
  nsCOMPtr<nsIRDFService> rdfService =
    do_GetService(NS_RDF_CONTRACTID "/rdf-service;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);

  // now get the top-level book
    nsCOMPtr<nsIRDFResource> resource;
  rv = rdfService->GetResource(NS_LITERAL_CSTRING("moz-abdirectory://"),
                                     getter_AddRefs(resource));
        NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> topDirectory(do_QueryInterface(resource, &rv));
        NS_ENSURE_SUCCESS(rv, rv);

  // now go through the address books
  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = topDirectory->GetChildNodes(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupports> item;
  nsCOMPtr<nsIAbMDBDirectory> directory;

  PRBool hasMore;
  // XXX Make this not MDB specific.
  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    rv = enumerator->GetNext(getter_AddRefs(item));
    NS_ENSURE_SUCCESS(rv, rv);

    directory = do_QueryInterface(item, &rv);
    if (NS_SUCCEEDED(rv))
    {
        nsCOMPtr<nsIAddrDatabase> database;
      rv = directory->GetDatabase(getter_AddRefs(database));
        if (NS_SUCCEEDED(rv))
        {
        rv = database->FindMailListbyUnicodeName(name, exist);
        if (NS_SUCCEEDED(rv) && *exist)
            return NS_OK;
        }
      }
    }
  return NS_OK;
}

#define CSV_DELIM ","
#define CSV_DELIM_LEN 1
#define TAB_DELIM "\t"
#define TAB_DELIM_LEN 1

#define CSV_FILE_EXTENSION ".csv"
#define TAB_FILE_EXTENSION ".tab"
#define TXT_FILE_EXTENSION ".txt"
#define LDIF_FILE_EXTENSION ".ldi"
#define LDIF_FILE_EXTENSION2 ".ldif"

enum ADDRESSBOOK_EXPORT_FILE_TYPE
{
 LDIF_EXPORT_TYPE =  0,
 CSV_EXPORT_TYPE = 1,
 TAB_EXPORT_TYPE = 2
};

NS_IMETHODIMP nsAbManager::ExportAddressBook(nsIDOMWindow *aParentWin, nsIAbDirectory *aDirectory)
{
  NS_ENSURE_ARG_POINTER(aParentWin);

  nsresult rv;
  nsCOMPtr<nsIFilePicker> filePicker = do_CreateInstance("@mozilla.org/filepicker;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/addressbook/addressBook.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString title;
  rv = bundle->GetStringFromName(NS_LITERAL_STRING("ExportAddressBookTitle").get(), getter_Copies(title));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = filePicker->Init(aParentWin, title, nsIFilePicker::modeSave);
  NS_ENSURE_SUCCESS(rv, rv);

  nsString filterString;
  rv = bundle->GetStringFromName(NS_LITERAL_STRING("LDIFFiles").get(), getter_Copies(filterString));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = filePicker->AppendFilter(filterString, NS_LITERAL_STRING("*.ldi; *.ldif"));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = bundle->GetStringFromName(NS_LITERAL_STRING("CSVFiles").get(), getter_Copies(filterString));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = filePicker->AppendFilter(filterString, NS_LITERAL_STRING("*.csv"));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = bundle->GetStringFromName(NS_LITERAL_STRING("TABFiles").get(), getter_Copies(filterString));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = filePicker->AppendFilter(filterString, NS_LITERAL_STRING("*.tab; *.txt"));
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt16 dialogResult;
  filePicker->Show(&dialogResult);

  if (dialogResult == nsIFilePicker::returnCancel)
    return rv;

  nsCOMPtr<nsILocalFile> localFile;
  rv = filePicker->GetFile(getter_AddRefs(localFile));
  NS_ENSURE_SUCCESS(rv, rv);

  if (dialogResult == nsIFilePicker::returnReplace) {
    // be extra safe and only delete when the file is really a file
    PRBool isFile;
    rv = localFile->IsFile(&isFile);
    if (NS_SUCCEEDED(rv) && isFile) {
      rv = localFile->Remove(PR_FALSE /* recursive delete */);
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }

  // The type of export is determined by the drop-down in
  // the file picker dialog.
  PRInt32 exportType;
  rv = filePicker->GetFilterIndex(&exportType);
  NS_ENSURE_SUCCESS(rv,rv);

  nsAutoString fileName;
  rv = localFile->GetLeafName(fileName);
  NS_ENSURE_SUCCESS(rv, rv);

  switch ( exportType )
  {
    default:
    case LDIF_EXPORT_TYPE: // ldif
      // If filename does not have the correct ext, add one.
      if ((fileName.Find(LDIF_FILE_EXTENSION, fileName.Length() - strlen(LDIF_FILE_EXTENSION), PR_TRUE) == -1) && 
          (fileName.Find(LDIF_FILE_EXTENSION2, fileName.Length() - strlen(LDIF_FILE_EXTENSION2), PR_TRUE) == -1)) {


       // Add the extension and build a new localFile.
       fileName.AppendLiteral(LDIF_FILE_EXTENSION2);
       localFile->SetLeafName(fileName);
    }
      rv = ExportDirectoryToLDIF(aDirectory, localFile);
      break;

    case CSV_EXPORT_TYPE: // csv
      // If filename does not have the correct ext, add one.
      if (fileName.Find(CSV_FILE_EXTENSION, fileName.Length() - strlen(CSV_FILE_EXTENSION), PR_TRUE) == -1) {

       // Add the extension and build a new localFile.
       fileName.AppendLiteral(CSV_FILE_EXTENSION);
       localFile->SetLeafName(fileName);
    }
      rv = ExportDirectoryToDelimitedText(aDirectory, CSV_DELIM, CSV_DELIM_LEN, localFile);
      break;

    case TAB_EXPORT_TYPE: // tab & text
      // If filename does not have the correct ext, add one.
      if ((fileName.Find(TXT_FILE_EXTENSION, fileName.Length() - strlen(TXT_FILE_EXTENSION), PR_TRUE) == -1) && 
          (fileName.Find(TAB_FILE_EXTENSION, fileName.Length() - strlen(TAB_FILE_EXTENSION), PR_TRUE) == -1)) {

       // Add the extension and build a new localFile.
       fileName.AppendLiteral(TXT_FILE_EXTENSION);
       localFile->SetLeafName(fileName);
  }
      rv = ExportDirectoryToDelimitedText(aDirectory, TAB_DELIM, TAB_DELIM_LEN, localFile);
      break;
  };

  return rv;
}

nsresult
nsAbManager::ExportDirectoryToDelimitedText(nsIAbDirectory *aDirectory, const char *aDelim, PRUint32 aDelimLen, nsILocalFile *aLocalFile)
{
  nsCOMPtr <nsISimpleEnumerator> cardsEnumerator;
  nsCOMPtr <nsIAbCard> card;

  nsresult rv;

  nsCOMPtr <nsIOutputStream> outputStream;
  rv = NS_NewLocalFileOutputStream(getter_AddRefs(outputStream),
                                   aLocalFile,
                                   PR_CREATE_FILE | PR_WRONLY | PR_TRUNCATE,
                                   0664);

  // the desired file may be read only
  if (NS_FAILED(rv))
    return rv;

  PRUint32 i;
  PRUint32 writeCount;
  PRUint32 length;

  nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/importMsgs.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString revisedName;
  nsString columnName;

  for (i = 0; i < NS_ARRAY_LENGTH(EXPORT_ATTRIBUTES_TABLE); i++) {
    if (EXPORT_ATTRIBUTES_TABLE[i].plainTextStringID != 0) {

      // We don't need to truncate the string here as getter_Copies will
      // do that for us.
      if (NS_FAILED(bundle->GetStringFromID(EXPORT_ATTRIBUTES_TABLE[i].plainTextStringID, getter_Copies(columnName))))
        columnName.AppendInt(EXPORT_ATTRIBUTES_TABLE[i].plainTextStringID);

      rv = nsMsgI18NConvertFromUnicode(nsMsgI18NFileSystemCharset(),
                                       columnName, revisedName);
      NS_ENSURE_SUCCESS(rv,rv);

      rv = outputStream->Write(revisedName.get(),
                               revisedName.Length(),
                               &writeCount);
      NS_ENSURE_SUCCESS(rv,rv);

      if (revisedName.Length() != writeCount)
        return NS_ERROR_FAILURE;

      if (i < NS_ARRAY_LENGTH(EXPORT_ATTRIBUTES_TABLE) - 1) {
        rv = outputStream->Write(aDelim, aDelimLen, &writeCount);
        NS_ENSURE_SUCCESS(rv,rv);

        if (aDelimLen != writeCount)
          return NS_ERROR_FAILURE;
      }
    }
  }
  rv = outputStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &writeCount);
  NS_ENSURE_SUCCESS(rv,rv);
  if (MSG_LINEBREAK_LEN != writeCount)
    return NS_ERROR_FAILURE;

  rv = aDirectory->GetChildCards(getter_AddRefs(cardsEnumerator));
  if (NS_SUCCEEDED(rv) && cardsEnumerator) {
    nsCOMPtr<nsISupports> item;
    PRBool more;
    while (NS_SUCCEEDED(cardsEnumerator->HasMoreElements(&more)) && more) {
      rv = cardsEnumerator->GetNext(getter_AddRefs(item));
      if (NS_SUCCEEDED(rv)) {
        nsCOMPtr <nsIAbCard> card = do_QueryInterface(item, &rv);
        NS_ENSURE_SUCCESS(rv,rv);

        PRBool isMailList;
        rv = card->GetIsMailList(&isMailList);
        NS_ENSURE_SUCCESS(rv,rv);


        if (isMailList) {
          // .tab, .txt and .csv aren't able to export mailing lists
          // use LDIF for that.
        }
        else {
          nsString value;
          nsCString valueCStr;

          for (i = 0; i < NS_ARRAY_LENGTH(EXPORT_ATTRIBUTES_TABLE); i++) {
            if (EXPORT_ATTRIBUTES_TABLE[i].plainTextStringID != 0) {
              rv = card->GetPropertyAsAString(EXPORT_ATTRIBUTES_TABLE[i].abPropertyName, value);
              if (NS_FAILED(rv))
                value.Truncate();

              // If a string contains at least one comma, tab or double quote then
              // we need to quote the entire string. Also if double quote is part
              // of the string we need to quote the double quote(s) as well.
              nsAutoString newValue(value);
              PRBool needsQuotes = PR_FALSE;
              if(newValue.FindChar('"') != -1)
              {
                needsQuotes = PR_TRUE;
                
                PRInt32 match = 0;
                PRUint32 offset = 0;
                nsString oldSubstr = NS_LITERAL_STRING("\"");
                nsString newSubstr = NS_LITERAL_STRING("\"\""); 
                while (offset < newValue.Length()) {
                    match = newValue.Find(oldSubstr, offset);
                    if (match == -1)
                        break;

                    newValue.Replace(offset + match, oldSubstr.Length(), newSubstr);
                    offset += (match + newSubstr.Length());
                }
              }
              if (!needsQuotes && (newValue.FindChar(',') != -1 || newValue.FindChar('\x09') != -1))
                needsQuotes = PR_TRUE;

              // Make sure we quote if containing CR/LF.
              if (newValue.FindChar('\r') != -1 ||
                  newValue.FindChar('\n') != -1)
                  needsQuotes = PR_TRUE;

              if (needsQuotes)
              {
                newValue.Insert(NS_LITERAL_STRING("\""), 0);
                newValue.AppendLiteral("\"");
              }

              rv = nsMsgI18NConvertFromUnicode(nsMsgI18NFileSystemCharset(),
                                               newValue, valueCStr);
              NS_ENSURE_SUCCESS(rv,rv);

              if (NS_FAILED(rv)) {
                NS_ERROR("failed to convert string to system charset.  use LDIF");
                valueCStr = "?";
              }

              length = valueCStr.Length();
              if (length) {
                rv = outputStream->Write(valueCStr.get(), length, &writeCount);
                NS_ENSURE_SUCCESS(rv,rv);
                if (length != writeCount)
                  return NS_ERROR_FAILURE;
              }
              valueCStr = "";
            }
            else {
              // something we don't support for the current export
              // for example, .tab doesn't export preferred html format
              continue; // go to next field
            }

            if (i < NS_ARRAY_LENGTH(EXPORT_ATTRIBUTES_TABLE) - 1) {
              rv = outputStream->Write(aDelim, aDelimLen, &writeCount);
              NS_ENSURE_SUCCESS(rv,rv);
              if (aDelimLen != writeCount)
                return NS_ERROR_FAILURE;
            }
          }

          // write out the linebreak that separates the cards
          rv = outputStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &writeCount);
          NS_ENSURE_SUCCESS(rv,rv);
          if (MSG_LINEBREAK_LEN != writeCount)
            return NS_ERROR_FAILURE;
        }
      }
    }
  }

  rv = outputStream->Flush();
  NS_ENSURE_SUCCESS(rv,rv);

  rv = outputStream->Close();
  NS_ENSURE_SUCCESS(rv,rv);
  return NS_OK;
}

nsresult
nsAbManager::ExportDirectoryToLDIF(nsIAbDirectory *aDirectory, nsILocalFile *aLocalFile)
{
  nsCOMPtr <nsISimpleEnumerator> cardsEnumerator;
  nsCOMPtr <nsIAbCard> card;

  nsresult rv;

  nsCOMPtr <nsIOutputStream> outputStream;
  rv = NS_NewLocalFileOutputStream(getter_AddRefs(outputStream),
                                   aLocalFile,
                                   PR_CREATE_FILE | PR_WRONLY | PR_TRUNCATE,
                                   0664);

  // the desired file may be read only
  if (NS_FAILED(rv))
    return rv;

  // Get the default attribute map for ldap. We use the default attribute
  // map rather than one for a specific server because if people want an
  // ldif export using a servers specific schema, then they can use ldapsearch
  nsCOMPtr<nsIAbLDAPAttributeMapService> mapSrv =
    do_GetService("@mozilla.org/addressbook/ldap-attribute-map-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbLDAPAttributeMap> attrMap;
  rv = mapSrv->GetMapForPrefBranch(NS_LITERAL_CSTRING("ldap_2.servers.default.attrmap"),
                                   getter_AddRefs(attrMap));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 i;
  PRUint32 writeCount;
  PRUint32 length;

  rv = aDirectory->GetChildCards(getter_AddRefs(cardsEnumerator));
  if (NS_SUCCEEDED(rv) && cardsEnumerator) {
    nsCOMPtr<nsISupports> item;
    PRBool more;
    while (NS_SUCCEEDED(cardsEnumerator->HasMoreElements(&more)) && more) {
      rv = cardsEnumerator->GetNext(getter_AddRefs(item));
      if (NS_SUCCEEDED(rv)) {
        nsCOMPtr <nsIAbCard> card = do_QueryInterface(item, &rv);
        NS_ENSURE_SUCCESS(rv,rv);

        PRBool isMailList;
        rv = card->GetIsMailList(&isMailList);
        NS_ENSURE_SUCCESS(rv,rv);

        if (isMailList) {
          nsCString mailListCStr;

          rv = AppendLDIFForMailList(card, attrMap, mailListCStr);
          NS_ENSURE_SUCCESS(rv,rv);

          length = mailListCStr.Length();
          rv = outputStream->Write(mailListCStr.get(), length, &writeCount);
          NS_ENSURE_SUCCESS(rv,rv);
          if (length != writeCount)
            return NS_ERROR_FAILURE;
        }
        else {
          nsString value;
          nsCString valueCStr;

          rv = AppendBasicLDIFForCard(card, attrMap, valueCStr);
          NS_ENSURE_SUCCESS(rv,rv);

          length = valueCStr.Length();
          rv = outputStream->Write(valueCStr.get(), length, &writeCount);
          NS_ENSURE_SUCCESS(rv,rv);
          if (length != writeCount)
            return NS_ERROR_FAILURE;

          valueCStr.Truncate();

          nsCAutoString ldapAttribute;

          for (i = 0; i < NS_ARRAY_LENGTH(EXPORT_ATTRIBUTES_TABLE); i++) {
            if (NS_SUCCEEDED(attrMap->GetFirstAttribute(nsDependentCString(EXPORT_ATTRIBUTES_TABLE[i].abPropertyName),
                                                        ldapAttribute)) &&
                !ldapAttribute.IsEmpty()) {

              rv = card->GetPropertyAsAString(EXPORT_ATTRIBUTES_TABLE[i].abPropertyName, value);
              if (NS_FAILED(rv))
                value.Truncate();

              if (!PL_strcmp(EXPORT_ATTRIBUTES_TABLE[i].abPropertyName, kPreferMailFormatProperty)) {
                if (value.Equals(NS_LITERAL_STRING("html").get()))
                  value.AssignLiteral("true");
                else if (value.Equals(NS_LITERAL_STRING("plaintext").get()))
                  value.AssignLiteral("false");
                else
                  value.Truncate(); // unknown.
              }

              if (!value.IsEmpty()) {
                rv = AppendProperty(ldapAttribute.get(), value.get(), valueCStr);
                NS_ENSURE_SUCCESS(rv,rv);

                valueCStr += MSG_LINEBREAK;
              }
              else
                valueCStr.Truncate();

              length = valueCStr.Length();
              if (length) {
                rv = outputStream->Write(valueCStr.get(), length, &writeCount);
                NS_ENSURE_SUCCESS(rv,rv);
                if (length != writeCount)
                  return NS_ERROR_FAILURE;
              }
              valueCStr.Truncate();
            }
            else {
              // something we don't support yet
              // ldif doesn't export multiple addresses
            }
          }

          // write out the linebreak that separates the cards
          rv = outputStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &writeCount);
          NS_ENSURE_SUCCESS(rv,rv);
          if (MSG_LINEBREAK_LEN != writeCount)
            return NS_ERROR_FAILURE;
        }
      }
    }
  }

  rv = outputStream->Flush();
  NS_ENSURE_SUCCESS(rv,rv);

  rv = outputStream->Close();
  NS_ENSURE_SUCCESS(rv,rv);
  return NS_OK;
}

nsresult nsAbManager::AppendLDIFForMailList(nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult)
{
  nsresult rv;
  nsString attrValue;

  rv = AppendDNForCard("dn", aCard, aAttrMap, aResult);
  NS_ENSURE_SUCCESS(rv,rv);

  aResult += MSG_LINEBREAK \
             "objectclass: top" MSG_LINEBREAK \
             "objectclass: groupOfNames" MSG_LINEBREAK;

  rv = aCard->GetDisplayName(attrValue);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCAutoString ldapAttributeName;

  rv = aAttrMap->GetFirstAttribute(NS_LITERAL_CSTRING(kDisplayNameProperty),
                                  ldapAttributeName);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = AppendProperty(ldapAttributeName.get(), attrValue.get(), aResult);
  NS_ENSURE_SUCCESS(rv,rv);
  aResult += MSG_LINEBREAK;

  rv = aAttrMap->GetFirstAttribute(NS_LITERAL_CSTRING(kNicknameProperty),
                                  ldapAttributeName);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = aCard->GetPropertyAsAString(kNicknameProperty, attrValue);
  if (NS_SUCCEEDED(rv) && !attrValue.IsEmpty()) {
    rv = AppendProperty(ldapAttributeName.get(), attrValue.get(), aResult);
    NS_ENSURE_SUCCESS(rv,rv);
    aResult += MSG_LINEBREAK;
  }

  rv = aAttrMap->GetFirstAttribute(NS_LITERAL_CSTRING(kNotesProperty),
                                  ldapAttributeName);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = aCard->GetPropertyAsAString(kNotesProperty, attrValue);
  if (NS_SUCCEEDED(rv) && !attrValue.IsEmpty()) {
    rv = AppendProperty(ldapAttributeName.get(), attrValue.get(), aResult);
    NS_ENSURE_SUCCESS(rv,rv);
    aResult += MSG_LINEBREAK;
  }

  nsCOMPtr<nsIRDFService> rdfService = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCString mailListURI;
  rv = aCard->GetMailListURI(getter_Copies(mailListURI));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIRDFResource> resource;
  rv = rdfService->GetResource(mailListURI, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIAbDirectory> mailList = do_QueryInterface(resource, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIMutableArray> addresses;
  rv = mailList->GetAddressLists(getter_AddRefs(addresses));
  if (addresses) {
    PRUint32 total = 0;
    addresses->GetLength(&total);
    if (total) {
      PRUint32 i;
      for (i = 0; i < total; i++) {
        nsCOMPtr <nsIAbCard> listCard = do_QueryElementAt(addresses, i, &rv);
        NS_ENSURE_SUCCESS(rv,rv);

        rv = AppendDNForCard("member", listCard, aAttrMap, aResult);
        NS_ENSURE_SUCCESS(rv,rv);

        aResult += MSG_LINEBREAK;
      }
    }
  }

  aResult += MSG_LINEBREAK;
  return NS_OK;
}

nsresult nsAbManager::AppendDNForCard(const char *aProperty, nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult)
{
  nsString email;
  nsString displayName;
  nsCAutoString ldapAttributeName;

  nsresult rv = aCard->GetPrimaryEmail(email);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = aCard->GetDisplayName(displayName);
  NS_ENSURE_SUCCESS(rv,rv);

  nsString cnStr;

  rv = aAttrMap->GetFirstAttribute(NS_LITERAL_CSTRING(kDisplayNameProperty),
                                   ldapAttributeName);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!displayName.IsEmpty()) {
    cnStr += NS_ConvertUTF8toUTF16(ldapAttributeName).get();
    cnStr.AppendLiteral("=");
    cnStr.Append(displayName);
    if (!email.IsEmpty()) {
      cnStr.AppendLiteral(",");
    }
  }

  rv = aAttrMap->GetFirstAttribute(NS_LITERAL_CSTRING(kPriEmailProperty),
                                   ldapAttributeName);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!email.IsEmpty()) {
    cnStr += NS_ConvertUTF8toUTF16(ldapAttributeName).get();
    cnStr.AppendLiteral("=");
    cnStr.Append(email);
  }

  rv = AppendProperty(aProperty, cnStr.get(), aResult);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

nsresult nsAbManager::AppendBasicLDIFForCard(nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult)
{
  nsresult rv = AppendDNForCard("dn", aCard, aAttrMap, aResult);
  NS_ENSURE_SUCCESS(rv,rv);
  aResult += MSG_LINEBREAK \
    "objectclass: top" MSG_LINEBREAK \
    "objectclass: person" MSG_LINEBREAK \
    "objectclass: organizationalPerson" MSG_LINEBREAK \
    "objectclass: inetOrgPerson" MSG_LINEBREAK \
    "objectclass: " MOZ_AB_OBJECTCLASS MSG_LINEBREAK;
  return rv;
}

PRBool nsAbManager::IsSafeLDIFString(const PRUnichar *aStr)
{
  // follow RFC 2849 to determine if something is safe "as is" for LDIF
  if (aStr[0] == PRUnichar(' ') ||
      aStr[0] == PRUnichar(':') ||
      aStr[0] == PRUnichar('<'))
    return PR_FALSE;

  PRUint32 i;
  PRUint32 len = NS_strlen(aStr);
  for (i=0; i<len; i++) {
    // If string contains CR or LF, it is not safe for LDIF
    // and MUST be base64 encoded
    if ((aStr[i] == PRUnichar('\n')) ||
        (aStr[i] == PRUnichar('\r')) ||
        (!NS_IsAscii(aStr[i])))
      return PR_FALSE;
  }
  return PR_TRUE;
}

nsresult nsAbManager::AppendProperty(const char *aProperty, const PRUnichar *aValue, nsACString &aResult)
{
  NS_ENSURE_ARG_POINTER(aValue);

  aResult += aProperty;

  // if the string is not safe "as is", base64 encode it
  if (IsSafeLDIFString(aValue)) {
    aResult.AppendLiteral(": ");
    aResult.Append(NS_LossyConvertUTF16toASCII(aValue));
  }
  else {
    char *base64Str = PL_Base64Encode(NS_ConvertUTF16toUTF8(aValue).get(), 0, nsnull);
    if (!base64Str)
      return NS_ERROR_OUT_OF_MEMORY;

    aResult.AppendLiteral(":: ");
    aResult.Append(nsDependentCString(base64Str));
    PR_Free(base64Str);
  }

  return NS_OK;
}

char *getCString(VObject *vObj)
{
    if (VALUE_TYPE(vObj) == VCVT_USTRINGZ)
        return fakeCString(vObjectUStringZValue(vObj));
    if (VALUE_TYPE(vObj) == VCVT_STRINGZ)
        return PL_strdup(vObjectStringZValue(vObj));
    return NULL;
}

static void convertNameValue(VObject *vObj, nsIAbCard *aCard)
{
  const char *cardPropName = NULL;

  // if the vCard property is not a root property then we need to determine its exact property.
  // a good example of this is VCTelephoneProp, this prop has four objects underneath it:
  // fax, work and home and cellular.
  if (PL_strcasecmp(VCCityProp, vObjectName(vObj)) == 0)
      cardPropName = kWorkCityProperty;
  else if (PL_strcasecmp(VCTelephoneProp, vObjectName(vObj)) == 0)
  {
      if (isAPropertyOf(vObj, VCFaxProp))
          cardPropName = kFaxProperty;
      else if (isAPropertyOf(vObj, VCWorkProp))
          cardPropName = kWorkPhoneProperty;
      else if (isAPropertyOf(vObj, VCHomeProp))
          cardPropName = kHomePhoneProperty;
      else if (isAPropertyOf(vObj, VCCellularProp))
          cardPropName = kCellularProperty;
      else if (isAPropertyOf(vObj, VCPagerProp))
          cardPropName = kPagerProperty;
      else
          return;
  }
  else if (PL_strcasecmp(VCEmailAddressProp, vObjectName(vObj)) == 0)
      cardPropName = kPriEmailProperty;
  else if (PL_strcasecmp(VCFamilyNameProp, vObjectName(vObj)) == 0)
      cardPropName = kLastNameProperty;
  else if (PL_strcasecmp(VCFullNameProp, vObjectName(vObj)) == 0)
      cardPropName = kDisplayNameProperty;
  else if (PL_strcasecmp(VCGivenNameProp, vObjectName(vObj)) == 0)
      cardPropName = kFirstNameProperty;
  else if (PL_strcasecmp(VCOrgNameProp, vObjectName(vObj)) == 0)
      cardPropName = kCompanyProperty;
  else if (PL_strcasecmp(VCOrgUnitProp, vObjectName(vObj)) == 0)
      cardPropName = kDepartmentProperty;
  else if (PL_strcasecmp(VCPostalCodeProp, vObjectName(vObj)) == 0)
      cardPropName = kWorkZipCodeProperty;
  else if (PL_strcasecmp(VCRegionProp, vObjectName(vObj)) == 0)
      cardPropName = kWorkStateProperty;
  else if (PL_strcasecmp(VCStreetAddressProp, vObjectName(vObj)) == 0)
      cardPropName = kWorkAddressProperty;
  else if (PL_strcasecmp(VCPostalBoxProp, vObjectName(vObj)) == 0)
      cardPropName = kWorkAddress2Property;
  else if (PL_strcasecmp(VCCountryNameProp, vObjectName(vObj)) == 0)
      cardPropName = kWorkCountryProperty;
  else if (PL_strcasecmp(VCTitleProp, vObjectName(vObj)) == 0)
      cardPropName = kJobTitleProperty;
  else if (PL_strcasecmp(VCUseHTML, vObjectName(vObj)) == 0)
      cardPropName = kPreferMailFormatProperty;
  else if (PL_strcasecmp(VCNoteProp, vObjectName(vObj)) == 0)
      cardPropName = kNotesProperty;
  else if (PL_strcasecmp(VCURLProp, vObjectName(vObj)) == 0)
      cardPropName = kWorkWebPageProperty;
  else
      return;

  if (!VALUE_TYPE(vObj))
      return;

  char *cardPropValue = getCString(vObj);
  aCard->SetPropertyAsAUTF8String(cardPropName, nsDependentCString(cardPropValue));
  PR_FREEIF(cardPropValue);
  return;
}

static void convertFromVObject(VObject *vObj, nsIAbCard *aCard)
{
    if (vObj)
    {
        VObjectIterator t;

        convertNameValue(vObj, aCard);

        initPropIterator(&t, vObj);
        while (moreIteration(&t))
        {
            VObject * nextObject = nextVObject(&t);
            convertFromVObject(nextObject, aCard);
        }
    }
    return;
}

NS_IMETHODIMP nsAbManager::EscapedVCardToAbCard(const char *aEscapedVCardStr, nsIAbCard **aCard)
{
    NS_ENSURE_ARG_POINTER(aEscapedVCardStr);
    NS_ENSURE_ARG_POINTER(aCard);

    nsCOMPtr <nsIAbCard> cardFromVCard = do_CreateInstance(NS_ABCARDPROPERTY_CONTRACTID);
    if (!cardFromVCard)
        return NS_ERROR_FAILURE;

    // aEscapedVCardStr will be "" the first time, before you have a vCard
    if (*aEscapedVCardStr != '\0') {
        nsCString unescapedData;
        MsgUnescapeString(nsDependentCString(aEscapedVCardStr), 0, unescapedData);

        VObject *vObj = parse_MIME(unescapedData.get(), unescapedData.Length());
        if (vObj)
        {
          convertFromVObject(vObj, cardFromVCard);

          cleanVObject(vObj);
        }
        else
          NS_WARNING("Parse of vCard failed");
    }

    NS_IF_ADDREF(*aCard = cardFromVCard);
    return NS_OK;
}

NS_IMETHODIMP
nsAbManager::Handle(nsICommandLine* aCmdLine)
{
  nsresult rv;
  PRBool found;

  rv = aCmdLine->HandleFlag(NS_LITERAL_STRING("addressbook"), PR_FALSE, &found);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!found)
    return NS_OK;

  nsCOMPtr<nsIWindowWatcher> wwatch (do_GetService(NS_WINDOWWATCHER_CONTRACTID));
  NS_ENSURE_TRUE(wwatch, NS_ERROR_FAILURE);

  nsCOMPtr<nsIDOMWindow> opened;
  wwatch->OpenWindow(nsnull, "chrome://messenger/content/addressbook/addressbook.xul",
                     "_blank", "chrome,dialog=no,all", nsnull, getter_AddRefs(opened));
  aCmdLine->SetPreventDefault(PR_TRUE);
  return NS_OK;
}

NS_IMETHODIMP
nsAbManager::GetHelpInfo(nsACString& aResult)
{
  aResult.Assign(NS_LITERAL_CSTRING("  -addressbook         Open the address book at startup.\n"));
  return NS_OK;
}
