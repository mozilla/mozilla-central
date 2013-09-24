/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
  * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMArray.h"
#include "nsCOMPtr.h"
#include "nsComponentManagerUtils.h"
#include "nsNetCID.h"
#include "nsStringGlue.h"
#include "nsWMUtils.h"
#include "nsIDOMDocument.h"
#include "nsIDOMNodeList.h"
#include "nsIDOMParser.h"
#include "nsIFileStreams.h"
#include "nsIFile.h"
#include "nsISimpleEnumerator.h"
#include "WMDebugLog.h"
#include "prio.h"

nsresult
nsWMUtils::FindWMKey(nsIWindowsRegKey **aKey)
{
  nsresult rv;
  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 NS_LITERAL_STRING("Software\\Microsoft\\Windows Live Mail"),
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  if (NS_SUCCEEDED(rv)) {
    NS_ADDREF(*aKey = key);
    return rv;
  }

  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 NS_LITERAL_STRING("Software\\Microsoft\\Windows Mail"),
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  key.forget(aKey);
  return rv;
}

nsresult
nsWMUtils::GetRootFolder(nsIFile **aRootFolder)
{
  nsCOMPtr<nsIWindowsRegKey> key;
  if (NS_FAILED(nsWMUtils::FindWMKey(getter_AddRefs(key)))) {
    IMPORT_LOG0("*** Error finding Windows Live Mail registry account keys\n");
    return NS_ERROR_NOT_AVAILABLE;
  }
  // This is essential to proceed; it is the location on disk of xml-type account files;
  // it is in reg_expand_sz so it will need expanding to absolute path.
  nsString  storeRoot;
  nsresult rv = key->ReadStringValue(NS_LITERAL_STRING("Store Root"), storeRoot);
  key->Close();  // Finished with windows registry key. We do not want to return before this closing
  if (NS_FAILED(rv) || storeRoot.IsEmpty()) {
    IMPORT_LOG0("*** Error finding Windows Live Mail Store Root\n");
    return rv;
  }

  uint32_t size = ::ExpandEnvironmentStringsW((LPCWSTR)storeRoot.get(), nullptr, 0);
  nsString expandedStoreRoot;
  expandedStoreRoot.SetLength(size - 1);
  if (expandedStoreRoot.Length() != size - 1)
    return NS_ERROR_FAILURE;
  ::ExpandEnvironmentStringsW((LPCWSTR)storeRoot.get(),
                              (LPWSTR)expandedStoreRoot.BeginWriting(),
                              size);
  storeRoot = expandedStoreRoot;

  nsCOMPtr<nsIFile> rootFolder(do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = rootFolder->InitWithPath(storeRoot);
  NS_ENSURE_SUCCESS(rv, rv);

  rootFolder.forget(aRootFolder);

  return NS_OK;
}

nsresult
nsWMUtils::GetOEAccountFiles(nsCOMArray<nsIFile> &aFileArray)
{
  nsCOMPtr<nsIFile> rootFolder;

  nsresult rv = GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  return GetOEAccountFilesInFolder(rootFolder, aFileArray);
}

nsresult
nsWMUtils::GetOEAccountFilesInFolder(nsIFile *aFolder,
                                     nsCOMArray<nsIFile> &aFileArray)
{
  nsCOMPtr<nsISimpleEnumerator> entries;
  nsresult rv = aFolder->GetDirectoryEntries(getter_AddRefs(entries));
  if (NS_FAILED(rv) || !entries)
    return NS_ERROR_FAILURE;

  bool hasMore;
  while (NS_SUCCEEDED(entries->HasMoreElements(&hasMore)) && hasMore) {
    nsCOMPtr<nsIFile> file;
    rv = entries->GetNext(getter_AddRefs(file));
    NS_ENSURE_SUCCESS(rv, rv);

    bool isDirectory;
    rv = file->IsDirectory(&isDirectory);
    NS_ENSURE_SUCCESS(rv, rv);

    if (isDirectory) {
      GetOEAccountFilesInFolder(file, aFileArray);
    }
    else {
      nsString name;
      rv = file->GetLeafName(name);
      NS_ENSURE_SUCCESS(rv, rv);
      if (StringEndsWith(name, NS_LITERAL_STRING(".oeaccount")))
        aFileArray.AppendObject(file);
    }
  }
  return NS_OK;
}

nsresult
nsWMUtils::MakeXMLdoc(nsIDOMDocument **aXmlDoc,
                      nsIFile *aFile)
{
  nsresult rv;
  nsCOMPtr<nsIFileInputStream> stream =
    do_CreateInstance(NS_LOCALFILEINPUTSTREAM_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = stream->Init(aFile, PR_RDONLY, -1, 0);
  nsCOMPtr<nsIDOMParser> parser = do_CreateInstance(NS_DOMPARSER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  int64_t filesize;
  aFile->GetFileSize(&filesize);
  return parser->ParseFromStream(stream, nullptr, int32_t(filesize),
                                 "application/xml", aXmlDoc);
}

nsresult
nsWMUtils::GetValueForTag(nsIDOMDocument *aXmlDoc,
                          const char *aTagName,
                          nsAString &aValue)
{
  nsAutoString tagName;
  tagName.AssignASCII(aTagName);
  nsCOMPtr<nsIDOMNodeList> list;
  if (NS_FAILED(aXmlDoc->GetElementsByTagName(tagName, getter_AddRefs(list))))
    return NS_ERROR_FAILURE;
  nsCOMPtr<nsIDOMNode> domNode;
  list->Item(0, getter_AddRefs(domNode));
  if (!domNode)
    return NS_ERROR_FAILURE;
  return domNode->GetTextContent(aValue);
}

