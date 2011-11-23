/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
  Outlook mail import
*/

#include "nsCOMPtr.h"
#include "nscore.h"
#include "nsMsgUtils.h"
#include "nsIServiceManager.h"
#include "nsIImportService.h"
#include "nsIImportFieldMap.h"
#include "nsIImportMailboxDescriptor.h"
#include "nsIImportABDescriptor.h"
#include "nsOutlookStringBundle.h"
#include "nsABBaseCID.h"
#include "nsIAbCard.h"
#include "mdb.h"
#include "OutlookDebugLog.h"
#include "nsOutlookMail.h"
#include "nsUnicharUtils.h"
#include "nsIOutputStream.h"
#include "nsMsgI18N.h"
#include "nsNetUtil.h"

static NS_DEFINE_IID(kISupportsIID,      NS_ISUPPORTS_IID);

/* ------------ Address book stuff ----------------- */
typedef struct {
  PRInt32    mozField;
  PRInt32    multiLine;
  ULONG    mapiTag;
} MAPIFields;

/*
  Fields in MAPI, not in Mozilla
  PR_OFFICE_LOCATION
  FIX - PR_BIRTHDAY - stored as PT_SYSTIME - FIX to extract for moz address book birthday
  PR_DISPLAY_NAME_PREFIX - Mr., Mrs. Dr., etc.
  PR_SPOUSE_NAME
  PR_GENDER - integer, not text
  FIX - PR_CONTACT_EMAIL_ADDRESSES - multiuline strings for email addresses, needs
    parsing to get secondary email address for mozilla
*/

#define kIsMultiLine  -2
#define  kNoMultiLine  -1

static MAPIFields  gMapiFields[] = {
  { 35, kIsMultiLine, PR_BODY},
  { 6, kNoMultiLine, PR_BUSINESS_TELEPHONE_NUMBER},
  { 7, kNoMultiLine, PR_HOME_TELEPHONE_NUMBER},
  { 25, kNoMultiLine, PR_COMPANY_NAME},
  { 23, kNoMultiLine, PR_TITLE},
  { 10, kNoMultiLine, PR_CELLULAR_TELEPHONE_NUMBER},
  { 9, kNoMultiLine, PR_PAGER_TELEPHONE_NUMBER},
  { 8, kNoMultiLine, PR_BUSINESS_FAX_NUMBER},
  { 8, kNoMultiLine, PR_HOME_FAX_NUMBER},
  { 22, kNoMultiLine, PR_COUNTRY},
  { 19, kNoMultiLine, PR_LOCALITY},
  { 20, kNoMultiLine, PR_STATE_OR_PROVINCE},
  { 17, 18, PR_STREET_ADDRESS},
  { 21, kNoMultiLine, PR_POSTAL_CODE},
  { 27, kNoMultiLine, PR_PERSONAL_HOME_PAGE},
  { 26, kNoMultiLine, PR_BUSINESS_HOME_PAGE},
  { 13, kNoMultiLine, PR_HOME_ADDRESS_CITY},
  { 16, kNoMultiLine, PR_HOME_ADDRESS_COUNTRY},
  { 15, kNoMultiLine, PR_HOME_ADDRESS_POSTAL_CODE},
  { 14, kNoMultiLine, PR_HOME_ADDRESS_STATE_OR_PROVINCE},
  { 11, 12, PR_HOME_ADDRESS_STREET},
  { 24, kNoMultiLine, PR_DEPARTMENT_NAME}
};
/* ---------------------------------------------------- */


#define  kCopyBufferSize    (16 * 1024)

// The email address in Outlook Contacts doesn't have a named
// property,  we need to use this mapi name ID to access the email
// The MAPINAMEID for email address has ulKind=MNID_ID
// Outlook stores each email address in two IDs,  32899/32900 for Email1
// 32915/32916 for Email2, 32931/32932 for Email3
// Current we use OUTLOOK_EMAIL1_MAPI_ID1 for primary email
// OUTLOOK_EMAIL2_MAPI_ID1 for secondary email
#define  OUTLOOK_EMAIL1_MAPI_ID1 32899
#define  OUTLOOK_EMAIL1_MAPI_ID2 32900
#define  OUTLOOK_EMAIL2_MAPI_ID1 32915
#define  OUTLOOK_EMAIL2_MAPI_ID2 32916
#define  OUTLOOK_EMAIL3_MAPI_ID1 32931
#define  OUTLOOK_EMAIL3_MAPI_ID2 32932

nsOutlookMail::nsOutlookMail()
{
  m_gotAddresses = PR_FALSE;
  m_gotFolders = PR_FALSE;
  m_haveMapi = CMapiApi::LoadMapi();
  m_lpMdb = NULL;
}

nsOutlookMail::~nsOutlookMail()
{
//  EmptyAttachments();
}

nsresult nsOutlookMail::GetMailFolders( nsISupportsArray **pArray)
{
  if (!m_haveMapi) {
    IMPORT_LOG0( "GetMailFolders called before Mapi is initialized\n");
    return( NS_ERROR_FAILURE);
  }

  nsresult rv = NS_NewISupportsArray( pArray);
  if (NS_FAILED( rv)) {
    IMPORT_LOG0( "FAILED to allocate the nsISupportsArray for the mail folder list\n");
    return( rv);
  }

  nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  if (NS_FAILED( rv))
    return( rv);

  m_gotFolders = PR_TRUE;

  m_folderList.ClearAll();

  m_mapi.Initialize();
  m_mapi.LogOn();

  if (m_storeList.GetSize() == 0)
    m_mapi.IterateStores( m_storeList);

  int i = 0;
  CMapiFolder *pFolder;
  if (m_storeList.GetSize() > 1) {
    while ((pFolder = m_storeList.GetItem( i))) {
      CMapiFolder *pItem = new CMapiFolder( pFolder);
      pItem->SetDepth( 1);
      m_folderList.AddItem( pItem);
      if (!m_mapi.GetStoreFolders( pItem->GetCBEntryID(), pItem->GetEntryID(), m_folderList, 2)) {
        IMPORT_LOG1( "GetStoreFolders for index %d failed.\n", i);
      }
      i++;
    }
  }
  else {
    if ((pFolder = m_storeList.GetItem( i))) {
      if (!m_mapi.GetStoreFolders( pFolder->GetCBEntryID(), pFolder->GetEntryID(), m_folderList, 1)) {
        IMPORT_LOG1( "GetStoreFolders for index %d failed.\n", i);
      }
    }
  }

  // Create the mailbox descriptors for the list of folders
  nsIImportMailboxDescriptor *  pID;
  nsISupports *          pInterface;
  nsString            name;
  nsString            uniName;

  for (i = 0; i < m_folderList.GetSize(); i++) {
    pFolder = m_folderList.GetItem( i);
    rv = impSvc->CreateNewMailboxDescriptor( &pID);
    if (NS_SUCCEEDED( rv)) {
      pID->SetDepth( pFolder->GetDepth());
      pID->SetIdentifier( i);

      pFolder->GetDisplayName( name);
      pID->SetDisplayName(name.get());

      pID->SetSize( 1000);
      rv = pID->QueryInterface( kISupportsIID, (void **) &pInterface);
      (*pArray)->AppendElement( pInterface);
      pInterface->Release();
      pID->Release();
    }
  }

  return( NS_OK);
}

bool nsOutlookMail::IsAddressBookNameUnique( nsString& name, nsString& list)
{
  nsString    usedName;
  usedName.AppendLiteral("[");
  usedName.Append( name);
  usedName.AppendLiteral("],");

  return( list.Find( usedName) == -1);
}

void nsOutlookMail::MakeAddressBookNameUnique( nsString& name, nsString& list)
{
  nsString    newName;
  int        idx = 1;

  newName = name;
  while (!IsAddressBookNameUnique( newName, list)) {
    newName = name;
    newName.Append(PRUnichar(' '));
    newName.AppendInt( (PRInt32) idx);
    idx++;
  }

  name = newName;
  list.AppendLiteral("[");
  list.Append( name);
  list.AppendLiteral("],");
}

nsresult nsOutlookMail::GetAddressBooks( nsISupportsArray **pArray)
{
  if (!m_haveMapi) {
    IMPORT_LOG0( "GetAddressBooks called before Mapi is initialized\n");
    return( NS_ERROR_FAILURE);
  }

  nsresult rv = NS_NewISupportsArray( pArray);
  if (NS_FAILED( rv)) {
    IMPORT_LOG0( "FAILED to allocate the nsISupportsArray for the address book list\n");
    return( rv);
  }

  nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  if (NS_FAILED( rv))
    return( rv);

  m_gotAddresses = PR_TRUE;

  m_addressList.ClearAll();
  m_mapi.Initialize();
  m_mapi.LogOn();
  if (m_storeList.GetSize() == 0)
    m_mapi.IterateStores( m_storeList);

  int i = 0;
  CMapiFolder *pFolder;
  if (m_storeList.GetSize() > 1) {
    while ((pFolder = m_storeList.GetItem( i))) {
      CMapiFolder *pItem = new CMapiFolder( pFolder);
      pItem->SetDepth( 1);
      m_addressList.AddItem( pItem);
      if (!m_mapi.GetStoreAddressFolders( pItem->GetCBEntryID(), pItem->GetEntryID(), m_addressList)) {
        IMPORT_LOG1( "GetStoreAddressFolders for index %d failed.\n", i);
      }
      i++;
    }
  }
  else {
    if ((pFolder = m_storeList.GetItem( i))) {
      if (!m_mapi.GetStoreAddressFolders( pFolder->GetCBEntryID(), pFolder->GetEntryID(), m_addressList)) {
        IMPORT_LOG1( "GetStoreFolders for index %d failed.\n", i);
      }
    }
  }

  // Create the mailbox descriptors for the list of folders
  nsIImportABDescriptor *      pID;
  nsISupports *          pInterface;
  nsString            name;
  nsString            list;

  for (i = 0; i < m_addressList.GetSize(); i++) {
    pFolder = m_addressList.GetItem( i);
    if (!pFolder->IsStore()) {
      rv = impSvc->CreateNewABDescriptor( &pID);
      if (NS_SUCCEEDED( rv)) {
        pID->SetIdentifier( i);
        pFolder->GetDisplayName( name);
        MakeAddressBookNameUnique( name, list);
        pID->SetPreferredName(name);
        pID->SetSize( 100);
        rv = pID->QueryInterface( kISupportsIID, (void **) &pInterface);
        (*pArray)->AppendElement( pInterface);
        pInterface->Release();
        pID->Release();
      }
    }
  }

  return( NS_OK);
}

void nsOutlookMail::OpenMessageStore( CMapiFolder *pNextFolder)
{
  // Open the store specified
  if (pNextFolder->IsStore()) {
    if (!m_mapi.OpenStore( pNextFolder->GetCBEntryID(), pNextFolder->GetEntryID(), &m_lpMdb)) {
      m_lpMdb = NULL;
      IMPORT_LOG0( "CMapiApi::OpenStore failed\n");
    }

    return;
  }

  // Check to see if we should open the one and only store
  if (!m_lpMdb) {
    if (m_storeList.GetSize() == 1) {
      CMapiFolder * pFolder = m_storeList.GetItem( 0);
      if (pFolder) {
        if (!m_mapi.OpenStore( pFolder->GetCBEntryID(), pFolder->GetEntryID(), &m_lpMdb)) {
          m_lpMdb = NULL;
          IMPORT_LOG0( "CMapiApi::OpenStore failed\n");
        }
      }
      else {
        IMPORT_LOG0( "Error retrieving the one & only message store\n");
      }
    }
    else {
      IMPORT_LOG0( "*** Error importing a folder without a valid message store\n");
    }
  }
}

// Roles and responsibilities:
// nsOutlookMail
//   - Connect to Outlook
//   - Enumerate the mailboxes
//   - Iterate the mailboxes
//   - For each mail, create one nsOutlookCompose object
//   - For each mail, create one CMapiMessage object
//
// nsOutlookCompose
//   - Establich a TB session
//   - Connect to all required services
//   - Perform the composition of the RC822 document from the data gathered by CMapiMessage
//   - Save the composed message to the TB mailbox
//   - Ensure the proper cleanup
//
// CMapiMessage
//   - Encapsulate the MAPI message interface
//   - Gather the information required to (re)compose the message

nsresult nsOutlookMail::ImportMailbox( PRUint32 *pDoneSoFar, bool *pAbort, PRInt32 index, const PRUnichar *pName, nsIFile *pDest, PRInt32 *pMsgCount)
{
  if ((index < 0) || (index >= m_folderList.GetSize())) {
    IMPORT_LOG0( "*** Bad mailbox identifier, unable to import\n");
    *pAbort = PR_TRUE;
    return( NS_ERROR_FAILURE);
  }

  PRInt32    dummyMsgCount = 0;
  if (pMsgCount)
    *pMsgCount = 0;
  else
    pMsgCount = &dummyMsgCount;

  CMapiFolder *pFolder = m_folderList.GetItem( index);
  OpenMessageStore( pFolder);
  if (!m_lpMdb) {
    IMPORT_LOG1( "*** Unable to obtain mapi message store for mailbox: %S\n", pName);
    return( NS_ERROR_FAILURE);
  }

  if (pFolder->IsStore())
    return( NS_OK);

  nsresult  rv;

  // now what?
  CMapiFolderContents    contents( m_lpMdb, pFolder->GetCBEntryID(), pFolder->GetEntryID());

  BOOL    done = FALSE;
  ULONG    cbEid;
  LPENTRYID  lpEid;
  ULONG    oType;
  LPMESSAGE  lpMsg = nsnull;
  ULONG    totalCount;
  PRFloat64  doneCalc;

  nsCOMPtr<nsIOutputStream> destOutputStream;
  rv = MsgNewBufferedFileOutputStream(getter_AddRefs(destOutputStream), pDest, -1, 0600);
  NS_ENSURE_SUCCESS(rv, rv);

  while (!done) {
    if (!contents.GetNext( &cbEid, &lpEid, &oType, &done)) {
      IMPORT_LOG1( "*** Error iterating mailbox: %S\n", pName);
      return( NS_ERROR_FAILURE);
    }

    totalCount = contents.GetCount();
    doneCalc = *pMsgCount;
    doneCalc /= totalCount;
    doneCalc *= 1000;
    if (pDoneSoFar) {
      *pDoneSoFar = (PRUint32) doneCalc;
      if (*pDoneSoFar > 1000)
        *pDoneSoFar = 1000;
    }

    if (!done && (oType == MAPI_MESSAGE)) {
      if (!m_mapi.OpenMdbEntry( m_lpMdb, cbEid, lpEid, (LPUNKNOWN *) &lpMsg)) {
        IMPORT_LOG1( "*** Error opening messages in mailbox: %S\n", pName);
        return( NS_ERROR_FAILURE);
      }

      // See if it's a drafts folder. Outlook doesn't allow drafts
      // folder to be configured so it's ok to hard code it here.
      nsAutoString folderName(pName);
      nsMsgDeliverMode mode = nsIMsgSend::nsMsgDeliverNow;
      mode = nsIMsgSend::nsMsgSaveAsDraft;
      if ( folderName.LowerCaseEqualsLiteral("drafts") )
        mode = nsIMsgSend::nsMsgSaveAsDraft;

      rv = ImportMessage(lpMsg, destOutputStream, mode);
      if (NS_SUCCEEDED( rv)) // No errors & really imported
        (*pMsgCount)++;
      else {
        IMPORT_LOG1( "*** Error reading message from mailbox: %S\n", pName);
      }
    }
  }

  return( NS_OK);
}

nsresult nsOutlookMail::ImportMessage( LPMESSAGE lpMsg, nsIOutputStream *pDest, nsMsgDeliverMode mode)
{
  CMapiMessage  msg( lpMsg);
  // If we wanted to skip messages that were downloaded in header only mode, we
  // would return NS_ERROR_FAILURE if !msg.FullMessageDownloaded. However, we
  // don't do this because it may cause seemingly wrong import results.
  // A user will get less mails in his imported folder than were in the original folder,
  // and this may make user feel like TB import is bad.
  // In reality, the skipped messages are those that have not been downloaded yet, because
  // they were downloaded in the "headers-only" mode. This is different from the case when
  // the message is downloaded completely, but consists only of headers - in this case
  // the message will be imported anyway.

  if (!msg.ValidState())
    return NS_ERROR_FAILURE;

  // I have to create a composer for each message, since it turns out that if we create
  // one composer for several messages, the Send Proxy object that is shared between those messages
  // isn't reset properly (at least in the current implementation), which leads to crash.
  // If there's a proper way to reinitialize the Send Proxy object,
  // then we could slightly optimize the send process.
  nsOutlookCompose compose;
  nsresult rv = compose.ProcessMessage(mode, msg, pDest);

  // Just for YUCKS, let's try an extra endline
  WriteData( pDest, "\x0D\x0A", 2);

  return rv;
}

BOOL nsOutlookMail::WriteData( nsIOutputStream *pDest, const char *pData, PRInt32 len)
{
  PRUint32    written;
  nsresult rv = pDest->Write( pData, len, &written);
  if (NS_FAILED( rv) || (written != len))
    return( FALSE);
  return( TRUE);
}

nsresult nsOutlookMail::ImportAddresses( PRUint32 *pCount, PRUint32 *pTotal, const PRUnichar *pName, PRUint32 id, nsIAddrDatabase *pDb, nsString& errors)
{
  if (id >= (PRUint32)(m_addressList.GetSize())) {
    IMPORT_LOG0( "*** Bad address identifier, unable to import\n");
    return( NS_ERROR_FAILURE);
  }

  PRUint32  dummyCount = 0;
  if (pCount)
    *pCount = 0;
  else
    pCount = &dummyCount;

  CMapiFolder *pFolder;
  if (id > 0) {
    PRInt32 idx = (PRInt32) id;
    idx--;
    while (idx >= 0) {
      pFolder = m_addressList.GetItem( idx);
      if (pFolder->IsStore()) {
        OpenMessageStore( pFolder);
        break;
      }
      idx--;
    }
  }

  pFolder = m_addressList.GetItem( id);
  OpenMessageStore( pFolder);
  if (!m_lpMdb) {
    IMPORT_LOG1( "*** Unable to obtain mapi message store for address book: %S\n", pName);
    return( NS_ERROR_FAILURE);
  }

  if (pFolder->IsStore())
    return( NS_OK);

  nsresult  rv;

  nsCOMPtr<nsIImportFieldMap>    pFieldMap;

  nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED( rv)) {
    rv = impSvc->CreateNewFieldMap( getter_AddRefs( pFieldMap));
  }

  CMapiFolderContents    contents( m_lpMdb, pFolder->GetCBEntryID(), pFolder->GetEntryID());

  BOOL      done = FALSE;
  ULONG      cbEid;
  LPENTRYID    lpEid;
  ULONG      oType;
  LPMESSAGE    lpMsg;
  nsCString    type;
  LPSPropValue  pVal;
  nsString    subject;

  while (!done) {
    (*pCount)++;

    if (!contents.GetNext( &cbEid, &lpEid, &oType, &done)) {
      IMPORT_LOG1( "*** Error iterating address book: %S\n", pName);
      return( NS_ERROR_FAILURE);
    }

    if (pTotal && (*pTotal == 0))
      *pTotal = contents.GetCount();

    if (!done && (oType == MAPI_MESSAGE)) {
      if (!m_mapi.OpenMdbEntry( m_lpMdb, cbEid, lpEid, (LPUNKNOWN *) &lpMsg)) {
        IMPORT_LOG1( "*** Error opening messages in mailbox: %S\n", pName);
        return( NS_ERROR_FAILURE);
      }

      // Get the PR_MESSAGE_CLASS attribute,
      // ensure that it is IPM.Contact
      pVal = m_mapi.GetMapiProperty( lpMsg, PR_MESSAGE_CLASS);
      if (pVal) {
        type.Truncate();
        m_mapi.GetStringFromProp( pVal, type);
        if (type.EqualsLiteral("IPM.Contact")) {
          // This is a contact, add it to the address book!
          subject.Truncate();
          pVal = m_mapi.GetMapiProperty( lpMsg, PR_SUBJECT);
          if (pVal)
            m_mapi.GetStringFromProp( pVal, subject);

          nsIMdbRow* newRow = nsnull;
          pDb->GetNewRow( &newRow);
          // FIXME: Check with Candice about releasing the newRow if it
          // isn't added to the database.  Candice's code in nsAddressBook
          // never releases it but that doesn't seem right to me!
          if (newRow) {
            if (BuildCard( subject.get(), pDb, newRow, lpMsg, pFieldMap)) {
              pDb->AddCardRowToDB( newRow);
            }
          }
        }
        else if (type.EqualsLiteral("IPM.DistList"))
        {
          // This is a list/group, add it to the address book!
          subject.Truncate();
          pVal = m_mapi.GetMapiProperty( lpMsg, PR_SUBJECT);
          if (pVal)
            m_mapi.GetStringFromProp( pVal, subject);
          CreateList(subject.get(), pDb, lpMsg, pFieldMap);
        }
      }

      lpMsg->Release();
    }
  }

  rv = pDb->Commit(nsAddrDBCommitType::kLargeCommit);
  return rv;
}
nsresult nsOutlookMail::CreateList( const PRUnichar * pName,
                                   nsIAddrDatabase *pDb,
                                   LPMAPIPROP pUserList,
                                   nsIImportFieldMap *pFieldMap)
{
  // If no name provided then we're done.
  if (!pName || !(*pName))
    return NS_OK;

  nsresult rv = NS_ERROR_FAILURE;
  // Make sure we have db to work with.
  if (!pDb)
    return rv;

  nsCOMPtr <nsIMdbRow> newListRow;
  rv = pDb->GetNewListRow(getter_AddRefs(newListRow));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCAutoString column;
  LossyCopyUTF16toASCII(nsDependentString(pName), column);
  rv = pDb->AddListName(newListRow, column.get());
  NS_ENSURE_SUCCESS(rv, rv);

  HRESULT             hr;
  LPSPropValue value = NULL;
  ULONG valueCount = 0;

  LPSPropTagArray properties = NULL;
  m_mapi.MAPIAllocateBuffer(CbNewSPropTagArray(1),
    (void **)&properties);
  properties->cValues = 1;
  properties->aulPropTag [0] = m_mapi.GetEmailPropertyTag(pUserList, 0x8054);
  hr = pUserList->GetProps(properties, 0, &valueCount, &value);
  m_mapi.MAPIFreeBuffer(properties);
  if (HR_FAILED(hr))
    return NS_ERROR_FAILURE;
  if (!value)
    return NS_ERROR_NOT_AVAILABLE;
  // XXX from here out, value must be freed with MAPIFreeBuffer 

  SBinaryArray *sa=(SBinaryArray *)&value->Value.bin;
  if (!sa || !sa->lpbin) {
    m_mapi.MAPIFreeBuffer(value);
    return NS_ERROR_NULL_POINTER;
  }

  LPENTRYID    lpEid;
  ULONG        cbEid;
  PRInt32        idx;
  LPMESSAGE        lpMsg;
  nsCString        type;
  LPSPropValue    pVal;
  nsString        subject;
  PRUint32 total;

  total=sa->cValues;
  for (idx = 0; idx < sa->cValues; idx++)
  {
    lpEid= (LPENTRYID) sa->lpbin[idx].lpb;
    cbEid = sa->lpbin[idx].cb;

    if (!m_mapi.OpenEntry(cbEid, lpEid, (LPUNKNOWN *) &lpMsg))
    {

      IMPORT_LOG1( "*** Error opening messages in mailbox: %S\n", pName);
      m_mapi.MAPIFreeBuffer(value);
      return( NS_ERROR_FAILURE);
    }
    // This is a contact, add it to the address book!
    subject.Truncate();
    pVal = m_mapi.GetMapiProperty( lpMsg, PR_SUBJECT);
    if (pVal)
      m_mapi.GetStringFromProp( pVal, subject);

    nsCOMPtr <nsIMdbRow> newRow;
    nsCOMPtr <nsIMdbRow> oldRow;
    pDb->GetNewRow( getter_AddRefs(newRow));
    if (newRow) {
      if (BuildCard( subject.get(), pDb, newRow, lpMsg, pFieldMap))
      {
        nsCOMPtr <nsIAbCard> userCard;
        nsCOMPtr <nsIAbCard> newCard;
        userCard = do_CreateInstance(NS_ABMDBCARD_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        pDb->InitCardFromRow(userCard,newRow);

        //add card to db
        bool bl=false;
        pDb->FindRowByCard(userCard,getter_AddRefs(oldRow));
        if (oldRow)
        {
          newRow = oldRow;
        }
        else
        {
          pDb->AddCardRowToDB( newRow);
        }

        //add card list
        pDb->AddListCardColumnsToRow(userCard,
                                     newListRow,idx+1, getter_AddRefs(newCard),
                                     PR_TRUE, nsnull, nsnull);
      }
    }
  }
  m_mapi.MAPIFreeBuffer(value);

  rv = pDb->AddCardRowToDB(newListRow);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = pDb->SetListAddressTotal(newListRow, total);
  rv = pDb->AddListDirNode(newListRow);
  return rv;
}

void nsOutlookMail::SanitizeValue( nsString& val)
{
  MsgReplaceSubstring(val, NS_LITERAL_STRING("\r\n"), NS_LITERAL_STRING(", "));
  MsgReplaceChar(val, "\r\n", ',');
}

void nsOutlookMail::SplitString( nsString& val1, nsString& val2)
{
  // Find the last line if there is more than one!
  PRInt32 idx = val1.RFind( "\x0D\x0A");
  PRInt32  cnt = 2;
  if (idx == -1) {
    cnt = 1;
    idx = val1.RFindChar( 13);
  }
  if (idx == -1)
    idx= val1.RFindChar( 10);
  if (idx != -1) {
    val2 = Substring(val1, idx + cnt);
    val1.SetLength(idx);
    SanitizeValue( val1);
  }
}

bool nsOutlookMail::BuildCard( const PRUnichar *pName, nsIAddrDatabase *pDb, nsIMdbRow *newRow, LPMAPIPROP pUser, nsIImportFieldMap *pFieldMap)
{

  nsString    lastName;
  nsString    firstName;
  nsString    eMail;
  nsString    nickName;
  nsString    middleName;
  nsString    secondEMail;
  ULONG       emailTag;

  LPSPropValue  pProp = m_mapi.GetMapiProperty( pUser, PR_EMAIL_ADDRESS);
  if (!pProp) {
    emailTag = m_mapi.GetEmailPropertyTag(pUser, OUTLOOK_EMAIL1_MAPI_ID1);
    if (emailTag) {
      pProp = m_mapi.GetMapiProperty( pUser, emailTag);
    }
  }
  if (pProp) {
    m_mapi.GetStringFromProp( pProp, eMail);
    SanitizeValue( eMail);
  }

  // for secondary email
  emailTag = m_mapi.GetEmailPropertyTag(pUser, OUTLOOK_EMAIL2_MAPI_ID1);
  if (emailTag) {
    pProp = m_mapi.GetMapiProperty( pUser, emailTag);
    if (pProp) {
      m_mapi.GetStringFromProp( pProp, secondEMail);
      SanitizeValue( secondEMail);
    }
  }

  pProp = m_mapi.GetMapiProperty( pUser, PR_GIVEN_NAME);
  if (pProp) {
    m_mapi.GetStringFromProp( pProp, firstName);
    SanitizeValue( firstName);
  }
  pProp = m_mapi.GetMapiProperty( pUser, PR_SURNAME);
  if (pProp) {
    m_mapi.GetStringFromProp( pProp, lastName);
    SanitizeValue( lastName);
  }
  pProp = m_mapi.GetMapiProperty( pUser, PR_MIDDLE_NAME);
  if (pProp) {
    m_mapi.GetStringFromProp( pProp, middleName);
    SanitizeValue( middleName);
  }
  pProp = m_mapi.GetMapiProperty( pUser, PR_NICKNAME);
  if (pProp) {
    m_mapi.GetStringFromProp( pProp, nickName);
    SanitizeValue( nickName);
  }
  if (firstName.IsEmpty() && lastName.IsEmpty()) {
    firstName = pName;
  }

  nsString  displayName;
  pProp = m_mapi.GetMapiProperty( pUser, PR_DISPLAY_NAME);
  if (pProp) {
    m_mapi.GetStringFromProp( pProp, displayName);
    SanitizeValue( displayName);
  }
  if (displayName.IsEmpty()) {
    if (firstName.IsEmpty())
      displayName = pName;
    else {
      displayName = firstName;
      if (!middleName.IsEmpty()) {
        displayName.Append( PRUnichar(' '));
        displayName.Append( middleName);
      }
      if (!lastName.IsEmpty()) {
        displayName.Append( PRUnichar(' '));
        displayName.Append( lastName);
      }
    }
  }

  // We now have the required fields
  // write them out followed by any optional fields!
  if (!displayName.IsEmpty()) {
    pDb->AddDisplayName( newRow, NS_ConvertUTF16toUTF8(displayName).get());
  }
  if (!firstName.IsEmpty()) {
    pDb->AddFirstName( newRow, NS_ConvertUTF16toUTF8(firstName).get());
  }
  if (!lastName.IsEmpty()) {
    pDb->AddLastName( newRow, NS_ConvertUTF16toUTF8(lastName).get());
  }
  if (!nickName.IsEmpty()) {
    pDb->AddNickName( newRow, NS_ConvertUTF16toUTF8(nickName).get());
  }
  if (!eMail.IsEmpty()) {
    pDb->AddPrimaryEmail( newRow, NS_ConvertUTF16toUTF8(eMail).get());
  }
  if (!secondEMail.IsEmpty()) {
    pDb->Add2ndEmail( newRow, NS_ConvertUTF16toUTF8(secondEMail).get());
  }

  // Do all of the extra fields!

  nsString  value;
  nsString  line2;

  if (pFieldMap) {
    int max = sizeof( gMapiFields) / sizeof( MAPIFields);
    for (int i = 0; i < max; i++) {
      pProp = m_mapi.GetMapiProperty( pUser, gMapiFields[i].mapiTag);
      if (pProp) {
        m_mapi.GetStringFromProp( pProp, value);
        if (!value.IsEmpty()) {
          if (gMapiFields[i].multiLine == kNoMultiLine) {
            SanitizeValue( value);
            pFieldMap->SetFieldValue( pDb, newRow, gMapiFields[i].mozField, value.get());
          }
          else if (gMapiFields[i].multiLine == kIsMultiLine) {
            pFieldMap->SetFieldValue( pDb, newRow, gMapiFields[i].mozField, value.get());
          }
          else {
            line2.Truncate();
            SplitString( value, line2);
            if (!value.IsEmpty())
              pFieldMap->SetFieldValue( pDb, newRow, gMapiFields[i].mozField, value.get());
            if (!line2.IsEmpty())
              pFieldMap->SetFieldValue( pDb, newRow, gMapiFields[i].multiLine, line2.get());
          }
        }
      }
    }
  }

  return( PR_TRUE);
}
