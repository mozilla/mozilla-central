/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsOEScanBoxes.h"
#include "nsMsgUtils.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsIImportService.h"
#include "nsIFile.h"
#include "nsIImportMailboxDescriptor.h"
#include "nsOERegUtil.h"
#include "nsOE5File.h"
#include "nsNetUtil.h"
#include "OEDebugLog.h"
#include "nsIInputStream.h"
#include "nsISeekableStream.h"
#include "plstr.h"
#include <windows.h>
#include "nsIWindowsRegKey.h"

#ifdef MOZILLA_INTERNAL_API
#include "nsNativeCharsetUtils.h"
#else
#include "nsMsgI18N.h"
#define NS_CopyNativeToUnicode(source, dest) \
        nsMsgI18NConvertToUnicode(nsMsgI18NFileSystemCharset(), source, dest)
#define NS_CopyUnicodeToNative(source, dest) \
        nsMsgI18NConvertFromUnicode(nsMsgI18NFileSystemCharset(), source, dest)
#endif

/*
  .nch file format???

  offset 20 - long = offset to first record

*/

static NS_DEFINE_IID(kISupportsIID,      NS_ISUPPORTS_IID);

nsOEScanBoxes::nsOEScanBoxes()
{
  m_pFirst = nsnull;
}

nsOEScanBoxes::~nsOEScanBoxes()
{
  int i, max;
  MailboxEntry *pEntry;
  for (i = 0, max = m_entryArray.Count(); i < max; i++) {
    pEntry = (MailboxEntry *) m_entryArray.ElementAt(i);
    delete pEntry;
  }
  // Now free the unprocessed child entries (ie, those without parents for some reason).
  for (i = 0, max = m_pendingChildArray.Count(); i < max; i++)
  {
    pEntry = (MailboxEntry *) m_pendingChildArray.ElementAt(i);
    if (!pEntry->processed)
      delete pEntry;
  }
}

/*
 3.x & 4.x registry
  Software/Microsoft/Outlook Express/

 5.0 registry
  Identies - value of "Default User ID" is {GUID}
  Identities/{GUID}/Software/Microsoft/Outlook Express/5.0/
*/

bool nsOEScanBoxes::Find50Mail(nsIFile *pWhere)
{
  nsAutoString userId;
  nsresult rv = nsOERegUtil::GetDefaultUserId(userId);
  if (NS_FAILED(rv))
    return false;

  nsAutoString path(NS_LITERAL_STRING("Identities\\"));
  path.Append(userId);
  path.AppendLiteral("\\Software\\Microsoft\\Outlook Express\\5.0");

  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 path,
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  if (NS_FAILED(rv))
    return false;

  nsAutoString storeRoot;
  key->ReadStringValue(NS_LITERAL_STRING("Store Root"), storeRoot);
  if (NS_FAILED(rv))
    return false;

  nsCOMPtr<nsIFile> localWhere = do_QueryInterface(pWhere);
  localWhere->InitWithPath(storeRoot);

  nsCAutoString nativeStoreRoot;
  NS_CopyUnicodeToNative(storeRoot, nativeStoreRoot);
  IMPORT_LOG1("Setting native path: %s\n", nativeStoreRoot.get());

  bool isDir = false;
  rv = localWhere->IsDirectory(&isDir);
  return isDir;
}

bool nsOEScanBoxes::FindMail(nsIFile *pWhere)
{
  if (Find50Mail(pWhere))
    return true;

  nsresult rv;
  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 NS_LITERAL_STRING("Software\\Microsoft\\Outlook Express"),
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  if (NS_FAILED(rv))
    return false;

  nsAutoString storeRoot;
  key->ReadStringValue(NS_LITERAL_STRING("Store Root"), storeRoot);
  if (NS_FAILED(rv))
    return false;

  nsCOMPtr<nsIFile> localWhere = do_QueryInterface(pWhere);
  localWhere->InitWithPath(storeRoot);
  localWhere->AppendNative(NS_LITERAL_CSTRING("Mail"));

  bool isDir = false;
  rv = localWhere->IsDirectory(&isDir);

  return isDir;
}

bool nsOEScanBoxes::GetMailboxes(nsIFile *pWhere, nsISupportsArray **pArray)
{
  nsCString path;
  pWhere->GetNativePath(path);
  if (!path.IsEmpty()) {
    IMPORT_LOG1("Looking for mail in: %s\n", path.get());
  }
  else {
    pWhere->GetNativeLeafName(path);
    if (!path.IsEmpty())
      IMPORT_LOG1("Looking for mail in: %s\n", path.get());
    else
      IMPORT_LOG0("Unable to get info about where to look for mail\n");
  }

  nsCOMPtr <nsIFile> location;
  pWhere->Clone(getter_AddRefs(location));
  // 1. Look for 5.0 folders.dbx
  // 2. Look for 3.x & 4.x folders.nch
  // 3. Look for 5.0 *.dbx mailboxes
  // 4. Look for 3.x & 4.x *.mbx mailboxes

  bool    result;

  location->AppendNative(NS_LITERAL_CSTRING("folders.dbx"));
  if (Find50MailBoxes(location)) {
    result = GetMailboxList(pWhere, pArray);
  }
  else {
    // 2. Look for 4.x mailboxes
    pWhere->Clone(getter_AddRefs(location));
    location->AppendNative(NS_LITERAL_CSTRING("folders.nch"));

    if (FindMailBoxes(location)) {
      result = GetMailboxList(pWhere, pArray);
    }
    else {
      // 3 & 4, look for the specific mailbox files.
      pWhere->Clone(getter_AddRefs(location));
      ScanMailboxDir(location);
      result = GetMailboxList(pWhere, pArray);
    }
  }

  return result;
}



void nsOEScanBoxes::Reset(void)
{
  int max = m_entryArray.Count();
  for (int i = 0; i < max; i++)
        {
    MailboxEntry *pEntry = (MailboxEntry *) m_entryArray.ElementAt(i);
    delete pEntry;
  }
  m_entryArray.Clear();
  m_pFirst = nsnull;
}


bool nsOEScanBoxes::FindMailBoxes(nsIFile* descFile)
{
  Reset();

  nsresult  rv;
  bool      isFile = false;

  rv = descFile->IsFile(&isFile);
  if (NS_FAILED(rv) || !isFile)
    return false;

        nsCOMPtr <nsIInputStream> descInputStream;

        rv = NS_NewLocalFileInputStream(getter_AddRefs(descInputStream), descFile);
  if (NS_FAILED(rv))
    return false;

  IMPORT_LOG0("Reading the folders.nch file\n");

  PRUint32    curRec;
  if (!ReadLong(descInputStream, curRec, 20)) {
    return false;
  }

  // Now for each record
  bool        done = false;
  PRUint32    equal;
  PRUint32    size;
  PRUint32    previous;
  PRUint32    next;
  MailboxEntry *  pEntry;
  bool        failed;

  while (!done) {

    if (!ReadLong(descInputStream, equal, curRec)) return false;
    if (curRec != equal) {
      IMPORT_LOG1("Record start invalid: %ld\n", curRec);
      break;
    }
    if (!ReadLong(descInputStream, size, curRec + 4)) return false;
    if (!ReadLong(descInputStream, previous, curRec + 8)) return false;
    if (!ReadLong(descInputStream, next, curRec + 12)) return false;
    failed = false;
    pEntry = new MailboxEntry;
    if (!ReadLong(descInputStream, pEntry->index, curRec + 16)) failed = true;
    if (!ReadString(descInputStream, pEntry->mailName, curRec + 20)) failed = true;
    if (!ReadString(descInputStream, pEntry->fileName, curRec + 279)) failed = true;
    if (!ReadLong(descInputStream, pEntry->parent, curRec + 539)) failed = true;
    if (!ReadLong(descInputStream, pEntry->child, curRec + 543)) failed = true;
    if (!ReadLong(descInputStream, pEntry->sibling, curRec + 547)) failed = true;
    if (!ReadLong(descInputStream, pEntry->type, curRec + 551)) failed = true;
    if (failed) {
      delete pEntry;
      return false;
    }

    #ifdef _TRACE_MAILBOX_ENTRIES
    IMPORT_LOG0("------------\n");
    IMPORT_LOG2("    Offset: %lx, index: %ld\n", curRec, pEntry->index);
    IMPORT_LOG2("      previous: %lx, next: %lx\n", previous, next);
    IMPORT_LOG2("      Name: %S, File: %s\n", (PRUnichar *) pEntry->mailName, (const char *) pEntry->fileName);
    IMPORT_LOG3("      Parent: %ld, Child: %ld, Sibling: %ld\n", pEntry->parent, pEntry->child, pEntry->sibling);
    #endif

    if (!StringEndsWith(pEntry->fileName, NS_LITERAL_CSTRING(".mbx")))
      pEntry->fileName.Append(".mbx");

    m_entryArray.AppendElement(pEntry);

    curRec = next;
    if (!next)
      done = true;
  }

  MailboxEntry *pZero = GetIndexEntry(0);
  if (pZero)
    m_pFirst = GetIndexEntry(pZero->child);

  IMPORT_LOG1("Read the folders.nch file, found %ld mailboxes\n", (long) m_entryArray.Count());

  return true;
}

bool nsOEScanBoxes::Find50MailBoxes(nsIFile* descFile)
{
  Reset();

  nsresult  rv;
  bool      isFile = false;

  rv = descFile->IsFile(&isFile);
  if (NS_FAILED(rv) || !isFile)
    return false;

        nsCOMPtr <nsIInputStream> descInputStream;

        rv = NS_NewLocalFileInputStream(getter_AddRefs(descInputStream), descFile);
  if (NS_FAILED(rv))
    return false;

  IMPORT_LOG0("Reading the folders.dbx file\n");

  PRUint32 *    pIndex;
  PRUint32    indexSize = 0;
  if (!nsOE5File::ReadIndex(descInputStream, &pIndex, &indexSize)) {
    IMPORT_LOG0("*** NOT USING FOLDERS.DBX!!!\n");
    return false;
  }

  PRUint32  marker;
  PRUint32  size;
  char  *  pBytes;
  PRUint32    cntRead;
  PRInt32    recordId;
  PRInt32    strOffset;

  PRUint8    tag;
  PRUint32  data;
  PRInt32    dataOffset;

  PRUint32    id;
  PRUint32    parent;
  PRUint32    numMessages;
  char *      pFileName;
  char *      pDataSource;

  MailboxEntry *  pEntry;
  MailboxEntry *  pLastEntry = nsnull;

  PRUint32  localStoreId = 0;

  for (PRUint32 i = 0; i < indexSize; i++) {
    if (!ReadLong(descInputStream, marker, pIndex[i])) continue;
    if (marker != pIndex[i]) continue;
    if (!ReadLong(descInputStream, size, pIndex[i] + 4)) continue;
    size += 4;
    pBytes = new char[size];
    rv = descInputStream->Read(pBytes, size, &cntRead);
    if (NS_FAILED(rv) || ((PRUint32)cntRead != size)) {
      delete [] pBytes;
      continue;
    }
    recordId = pBytes[2];
    strOffset = (recordId * 4) + 4;
    if (recordId == 4)
      strOffset += 4;

    id = 0;
    parent = 0;
    numMessages = 0;
    pFileName = nsnull;
    pDataSource = nsnull;
    dataOffset = 4;
    while (dataOffset < strOffset) {
      tag = (PRUint8) pBytes[dataOffset];

      data = 0; // make sure all bytes are 0 before copying 3 bytes over.
      memcpy(&data, &(pBytes[dataOffset + 1]), 3);
      switch(tag) {
        case 0x80: // id record
          id = data;
        break;
        case 0x81:  // parent id
          parent = data;
        break;
        case 0x87:  // number of messages in this mailbox
          numMessages = data;
        break;
        case 0x03:  // file name for this mailbox
          if (((PRUint32)strOffset + data) < size)
            pFileName = (char *)(pBytes + strOffset + data);
        break;
        case 0x05:  // data source for this record (this is not a mailbox!)
          if (((PRUint32)strOffset + data) < size)
            pDataSource = (char *) (pBytes + strOffset + data);
        break;
      }
      dataOffset += 4;
    }

    // now build an entry if necessary!
    if (pDataSource) {
      if (!PL_strcasecmp(pDataSource, "LocalStore"))
      {
        localStoreId = id;
        // See if we have any child folders that need to be added/processed for this top level parent.
        ProcessPendingChildEntries(localStoreId, localStoreId, m_pendingChildArray);
        // Clean up the pending list.
        RemoveProcessedChildEntries();
      }
    }
    else if (id && localStoreId && parent) {
      // veryify that this mailbox is in the local store
      data = parent;
      while (data && (data != localStoreId)) {
        pEntry = GetIndexEntry(data);
        if (pEntry)
          data = pEntry->parent;
        else
          data = 0;
      }
      if (data == localStoreId) {
        // Create an entry for this bugger
        pEntry = NewMailboxEntry(id, parent, (const char *) (pBytes + strOffset), pFileName);
        if (pEntry)
        {
          AddChildEntry(pEntry, localStoreId);
          pEntry->processed =  true;
          // See if we have any child folders that need to be added/processed.
          ProcessPendingChildEntries(id, localStoreId, m_pendingChildArray);
          // Clean up the pending list.
          RemoveProcessedChildEntries();
        }
      }
      else
      {
        // Put this folder into child array and process it when its parent shows up.
        pEntry = NewMailboxEntry(id, parent, (const char *) (pBytes + strOffset), pFileName);
        if (pEntry)
          m_pendingChildArray.AppendElement(pEntry);
      }
    }
    else if (pFileName)
    {
      // Put this folder into child array and process it when its parent shows up.
      // For some reason, it's likely that child folders come before their parents.
      pEntry = NewMailboxEntry(id, parent, (const char *) (pBytes + strOffset), pFileName);
      if (pEntry)
        m_pendingChildArray.AppendElement(pEntry);
    }

    delete [] pBytes;
  }


  delete [] pIndex;

  return m_entryArray.Count();
}

nsOEScanBoxes::MailboxEntry *nsOEScanBoxes::NewMailboxEntry(PRUint32 id, PRUint32 parent, const char *prettyName, char *pFileName)
{
  MailboxEntry *pEntry = new MailboxEntry();
  if (!pEntry)
    return nsnull;

  pEntry->index = id;
  pEntry->parent = parent;
  pEntry->child = 0;
  pEntry->type = 0;
  pEntry->sibling = -1;
  pEntry->processed =  false;
  NS_CopyNativeToUnicode(nsDependentCString(prettyName), pEntry->mailName);
  if (pFileName)
    pEntry->fileName = pFileName;
  return pEntry;
}

void nsOEScanBoxes::ProcessPendingChildEntries(PRUint32 parent, PRUint32 rootIndex, nsVoidArray  &childArray)
{
  PRInt32 i, max;
  MailboxEntry *pEntry;
  for (i = 0, max = childArray.Count(); i < max; i++)
  {
    pEntry = (MailboxEntry *) childArray.ElementAt(i);
    if ((!pEntry->processed) && (pEntry->parent == parent))
    {
      AddChildEntry(pEntry, rootIndex);
      pEntry->processed =  true; // indicate it's been processed.
      // See if there are unprocessed child folders for this child in the
      // array as well (ie, both child and grand-child are on the list).
      ProcessPendingChildEntries(pEntry->index, rootIndex, childArray);
    }
  }
}

void nsOEScanBoxes::RemoveProcessedChildEntries()
{
  // Remove already processed entries from the pending list. Note that these entries are also
  // on 'm_entryArray' list so we don't want to deallocate the space for the entries now.
  MailboxEntry * pEntry;
  PRInt32 i;
  for (i = m_pendingChildArray.Count()-1; i >= 0; i--)
  {
    pEntry = (MailboxEntry *) m_pendingChildArray.ElementAt(i);
    if (pEntry->processed)
      m_pendingChildArray.RemoveElementAt(i);
  }
}

void nsOEScanBoxes::AddChildEntry(MailboxEntry *pEntry, PRUint32 rootIndex)
{
  if (!m_pFirst) {
    if (pEntry->parent == rootIndex) {
      m_pFirst = pEntry;
      m_entryArray.AppendElement(pEntry);
    }
    else {
      delete pEntry;
    }
    return;
  }

  MailboxEntry *  pParent = nsnull;
  MailboxEntry *  pSibling = nsnull;
  if (pEntry->parent == rootIndex) {
    pSibling = m_pFirst;
  }
  else {
    pParent = GetIndexEntry(pEntry->parent);
  }

  if (!pParent && !pSibling) {
    delete pEntry;
    return;
  }

  if (pParent && (pParent->child == 0)) {
    pParent->child = pEntry->index;
    m_entryArray.AppendElement(pEntry);
    return;
  }

  if (!pSibling)
    pSibling = GetIndexEntry(pParent->child);

  while (pSibling && (pSibling->sibling != -1)) {
    pSibling = GetIndexEntry(pSibling->sibling);
  }

  if (!pSibling) {
    delete pEntry;
    return;
  }

  pSibling->sibling = pEntry->index;
  m_entryArray.AppendElement(pEntry);
}

bool nsOEScanBoxes::Scan50MailboxDir(nsIFile * srcDir)
{
  Reset();

  MailboxEntry *  pEntry;
  PRInt32      index = 1;
  char *      pLeaf;

  bool hasMore;
  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = srcDir->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  directoryEnumerator->HasMoreElements(&hasMore);
  bool              isFile;
  nsCOMPtr<nsIFile> entry;
  nsCString         fName;

  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsIFile> entry(do_QueryInterface(aSupport, &rv));
    directoryEnumerator->HasMoreElements(&hasMore);

    isFile = false;
    rv = entry->IsFile(&isFile);
    if (NS_SUCCEEDED(rv) && isFile) {
      pLeaf = nsnull;
      rv = entry->GetNativeLeafName(fName);
      if (NS_SUCCEEDED(rv)  &&
        (StringEndsWith(fName, NS_LITERAL_CSTRING(".dbx")))) {
          // This is a *.dbx file in the mail directory
          if (nsOE5File::IsLocalMailFile(entry)) {
            pEntry = new MailboxEntry;
            pEntry->index = index;
            index++;
            pEntry->parent = 0;
            pEntry->child = 0;
            pEntry->sibling = index;
            pEntry->type = -1;
            fName.SetLength(fName.Length() - 4);
            pEntry->fileName = fName.get();
            NS_CopyNativeToUnicode(fName, pEntry->mailName);
            m_entryArray.AppendElement(pEntry);
          }
      }
    }
  }

  if (m_entryArray.Count() > 0) {
    pEntry = (MailboxEntry *)m_entryArray.ElementAt(m_entryArray.Count() - 1);
    pEntry->sibling = -1;
    return true;
  }

  return false;
}


void nsOEScanBoxes::ScanMailboxDir(nsIFile * srcDir)
{
  if (Scan50MailboxDir(srcDir))
    return;

  Reset();

  MailboxEntry *  pEntry;
  PRInt32      index = 1;
  nsCAutoString pLeaf;
  PRUint32    sLen;

  bool hasMore;
  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = srcDir->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  if (NS_FAILED(rv))
    return;

  directoryEnumerator->HasMoreElements(&hasMore);
  bool              isFile;
  nsCOMPtr<nsIFile> entry;
  nsCString         fName;
  nsCString         ext;
  nsCString         name;

  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsIFile> entry(do_QueryInterface(aSupport, &rv));
    directoryEnumerator->HasMoreElements(&hasMore);

    isFile = false;
    rv = entry->IsFile(&isFile);
    if (NS_SUCCEEDED(rv) && isFile)
    {
      rv = entry->GetNativeLeafName(pLeaf);
      if (NS_SUCCEEDED(rv) && !pLeaf.IsEmpty() &&
        ((sLen = pLeaf.Length()) > 4) &&
        (!PL_strcasecmp(pLeaf.get() + sLen - 3, "mbx")))
      {
          // This is a *.mbx file in the mail directory
          pEntry = new MailboxEntry;
          pEntry->index = index;
          index++;
          pEntry->parent = 0;
          pEntry->child = 0;
          pEntry->sibling = index;
          pEntry->type = -1;
          pEntry->fileName = pLeaf;
          pLeaf.SetLength(sLen - 4);
          NS_CopyNativeToUnicode(pLeaf, pEntry->mailName);
          m_entryArray.AppendElement(pEntry);
      }
    }
  }

  if (m_entryArray.Count() > 0) {
    pEntry = (MailboxEntry *)m_entryArray.ElementAt(m_entryArray.Count() - 1);
    pEntry->sibling = -1;
  }
}


PRUint32 nsOEScanBoxes::CountMailboxes(MailboxEntry *pBox)
{
  if (pBox == nsnull) {
    if (m_pFirst != nsnull)
      pBox = m_pFirst;
    else {
      if (m_entryArray.Count() > 0)
        pBox = (MailboxEntry *) m_entryArray.ElementAt(0);
    }
  }
  PRUint32    count = 0;

  MailboxEntry *  pChild;
  while (pBox) {
    count++;
    if (pBox->child) {
      pChild = GetIndexEntry(pBox->child);
      if (pChild != nsnull)
        count += CountMailboxes(pChild);
    }
    if (pBox->sibling != -1) {
      pBox = GetIndexEntry(pBox->sibling);
    }
    else
      pBox = nsnull;
  }

  return count;
}

bool nsOEScanBoxes::GetMailboxList(nsIFile * root, nsISupportsArray **pArray)
{
  nsresult rv = NS_NewISupportsArray(pArray);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("FAILED to allocate the nsISupportsArray\n");
    return false;
  }

  BuildMailboxList(nsnull, root, 1, *pArray);

  return true;
}

void nsOEScanBoxes::BuildMailboxList(MailboxEntry *pBox, nsIFile * root, PRInt32 depth, nsISupportsArray *pArray)
{
  if (pBox == nsnull) {
    if (m_pFirst != nsnull) {
      pBox = m_pFirst;

      IMPORT_LOG0("Assigning start of mailbox list to m_pFirst\n");
    }
    else {
      if (m_entryArray.Count() > 0) {
        pBox = (MailboxEntry *) m_entryArray.ElementAt(0);

        IMPORT_LOG0("Assigning start of mailbox list to entry at index 0\n");
      }
    }

    if (pBox == nsnull) {
      IMPORT_LOG0("ERROR ASSIGNING STARTING MAILBOX\n");
    }

  }

  nsresult            rv;
  nsCOMPtr <nsIFile> file;
  MailboxEntry *  pChild;
  nsIImportMailboxDescriptor *  pID;
  nsISupports *          pInterface;
  PRInt64            size;

  nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return;

  while (pBox) {
    rv = impSvc->CreateNewMailboxDescriptor(&pID);
    if (NS_SUCCEEDED(rv)) {
      pID->SetDepth(depth);
      pID->SetIdentifier(pBox->index);
      pID->SetDisplayName((PRUnichar *)pBox->mailName.get());
      if (!pBox->fileName.IsEmpty()) {
        pID->GetFile(getter_AddRefs(file));
        file->InitWithFile(root);
        file->AppendNative(pBox->fileName);
        size = 0;
        file->GetFileSize(&size);
        pID->SetSize(size);
      }
      rv = pID->QueryInterface(kISupportsIID, (void **) &pInterface);
      pArray->AppendElement(pInterface);
      pInterface->Release();
      pID->Release();
    }

    if (pBox->child) {
      pChild = GetIndexEntry(pBox->child);
      if (pChild != nsnull)
        BuildMailboxList(pChild, root, depth + 1, pArray);
    }
    if (pBox->sibling != -1) {
      pBox = GetIndexEntry(pBox->sibling);
    }
    else
      pBox = nsnull;
  }

}



nsOEScanBoxes::MailboxEntry * nsOEScanBoxes::GetIndexEntry(PRUint32 index)
{
  PRInt32 max = m_entryArray.Count();
  for (PRInt32 i = 0; i < max; i++) {
    MailboxEntry *pEntry = (MailboxEntry *) m_entryArray.ElementAt(i);
    if (pEntry->index == index)
      return pEntry;
  }

  return nsnull;
}


// -------------------------------------------------------
// File utility routines
// -------------------------------------------------------

bool nsOEScanBoxes::ReadLong(nsIInputStream * stream, PRInt32& val, PRUint32 offset)
{
  nsresult  rv;
        nsCOMPtr <nsISeekableStream> seekStream = do_QueryInterface(stream, &rv);
        NS_ENSURE_SUCCESS(rv, false);
  rv = seekStream->Seek(nsISeekableStream::NS_SEEK_SET, offset);
  if (NS_FAILED(rv))
    return false;

  PRUint32  cntRead;
  char * pReadTo = (char *)&val;
  rv = stream->Read(pReadTo, sizeof(val), &cntRead);

  return NS_SUCCEEDED(rv) && cntRead == sizeof(val);
}

bool nsOEScanBoxes::ReadLong(nsIInputStream * stream, PRUint32& val, PRUint32 offset)
{
  nsresult  rv;
        nsCOMPtr <nsISeekableStream> seekStream = do_QueryInterface(stream, &rv);
        NS_ENSURE_SUCCESS(rv, false);
  rv = seekStream->Seek(nsISeekableStream::NS_SEEK_SET, offset);
  if (NS_FAILED(rv))
    return false;

  PRUint32  cntRead;
  char * pReadTo = (char *)&val;
  rv = stream->Read(pReadTo, sizeof(val), &cntRead);

  if (NS_FAILED(rv) || (cntRead != sizeof(val)))
    return false;
  return true;
}

// It appears as though the strings for file name and mailbox
// name are at least 254 chars - verified - they are probably 255
// but why bother going that far!  If a file name is that long then
// the heck with it.
#define  kOutlookExpressStringLength  252
bool nsOEScanBoxes::ReadString(nsIInputStream * stream, nsString& str, PRUint32 offset)
{
  nsresult rv;
  nsCOMPtr <nsISeekableStream> seekStream = do_QueryInterface(stream, &rv);
  NS_ENSURE_SUCCESS(rv, false);
  rv = seekStream->Seek(nsISeekableStream::NS_SEEK_SET, offset);
  if (NS_FAILED(rv))
    return false;


  PRUint32 cntRead;
  char buffer[kOutlookExpressStringLength];
  char * pReadTo = buffer;
  rv = stream->Read(pReadTo, kOutlookExpressStringLength, &cntRead);

  if (NS_FAILED(rv) || (cntRead != kOutlookExpressStringLength))
    return false;
  buffer[kOutlookExpressStringLength - 1] = 0;
  str.AssignASCII(buffer);
  return true;
}

bool nsOEScanBoxes::ReadString(nsIInputStream * stream, nsCString& str, PRUint32 offset)
{
  nsresult  rv;
        nsCOMPtr <nsISeekableStream> seekStream = do_QueryInterface(stream, &rv);
        NS_ENSURE_SUCCESS(rv, false);
  rv = seekStream->Seek(nsISeekableStream::NS_SEEK_SET, offset);
  if (NS_FAILED(rv))
    return false;

  PRUint32  cntRead;
  char  buffer[kOutlookExpressStringLength];
  char *  pReadTo = buffer;
  rv = stream->Read(pReadTo, kOutlookExpressStringLength, &cntRead);

  if (NS_FAILED(rv) || (cntRead != kOutlookExpressStringLength))
    return false;
  buffer[kOutlookExpressStringLength - 1] = 0;
  str = buffer;
  return true;
}
