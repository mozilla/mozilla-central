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
 * Portions created by the Initial Developer are Copyright (C) 1999
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

#include "msgCore.h"
#include "nsMsgThread.h"
#include "nsMsgDatabase.h"
#include "nsCOMPtr.h"
#include "MailNewsTypes2.h"

NS_IMPL_ISUPPORTS1(nsMsgThread, nsIMsgThread)


nsMsgThread::nsMsgThread()
{

  MOZ_COUNT_CTOR(nsMsgThread);
  Init();
}
nsMsgThread::nsMsgThread(nsMsgDatabase *db, nsIMdbTable *table)
{
  MOZ_COUNT_CTOR(nsMsgThread);
  Init();
  m_mdbTable = table;
  m_mdbDB = db;
  if (db)
    db->AddRef();

  if (table && db)
  {
    table->GetMetaRow(db->GetEnv(), nsnull, nsnull, &m_metaRow);
    InitCachedValues();
  }
}

void nsMsgThread::Init()
{
  m_threadKey = nsMsgKey_None;
  m_threadRootKey = nsMsgKey_None;
  m_numChildren = 0;
  m_numUnreadChildren = 0;
  m_flags = 0;
  m_mdbTable = nsnull;
  m_mdbDB = nsnull;
  m_metaRow = nsnull;
  m_newestMsgDate = 0;
  m_cachedValuesInitialized = PR_FALSE;
}


nsMsgThread::~nsMsgThread()
{
  MOZ_COUNT_DTOR(nsMsgThread);
  if (m_mdbTable)
    m_mdbTable->Release();
  if (m_mdbDB)
    m_mdbDB->Release();
  if (m_metaRow)
    m_metaRow->Release();
}

nsresult nsMsgThread::InitCachedValues()
{
  nsresult err = NS_OK;

  NS_ENSURE_TRUE(m_mdbDB && m_metaRow, NS_ERROR_INVALID_POINTER);

  if (!m_cachedValuesInitialized)
  {
    err = m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadFlagsColumnToken, &m_flags);
    err = m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadChildrenColumnToken, &m_numChildren);
    err = m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadIdColumnToken, &m_threadKey);
    err = m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadUnreadChildrenColumnToken, &m_numUnreadChildren);
    err = m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadRootKeyColumnToken, &m_threadRootKey, nsMsgKey_None);
    err = m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadNewestMsgDateColumnToken, &m_newestMsgDate, 0);
    // fix num children if it's wrong. this doesn't work - some DB's have a bogus thread table
    // that is full of bogus headers - don't know why.
    PRUint32 rowCount = 0;
    m_mdbTable->GetCount(m_mdbDB->GetEnv(), &rowCount);
    //    NS_ASSERTION(m_numChildren <= rowCount, "num children wrong - fixing");
    if (m_numChildren > rowCount)
      ChangeChildCount((PRInt32) rowCount - (PRInt32) m_numChildren);
    if ((PRInt32) m_numUnreadChildren < 0)
      ChangeUnreadChildCount(- (PRInt32) m_numUnreadChildren);
    if (NS_SUCCEEDED(err))
      m_cachedValuesInitialized = PR_TRUE;
  }
  return err;
}

NS_IMETHODIMP nsMsgThread::SetThreadKey(nsMsgKey threadKey)
{
  m_threadKey = threadKey;
  // by definition, the initial thread key is also the thread root key.
  SetThreadRootKey(threadKey);
  // gotta set column in meta row here.
  return m_mdbDB->UInt32ToRowCellColumn(
                    m_metaRow, m_mdbDB->m_threadIdColumnToken, threadKey);
}

NS_IMETHODIMP nsMsgThread::GetThreadKey(nsMsgKey *result)
{
  NS_ENSURE_ARG_POINTER(result);
  nsresult res = m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadIdColumnToken, &m_threadKey);
  *result = m_threadKey;
  return res;
}

NS_IMETHODIMP nsMsgThread::GetFlags(PRUint32 *result)
{
  NS_ENSURE_ARG_POINTER(result);
  nsresult res = m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadFlagsColumnToken, &m_flags);
  *result = m_flags;
  return res;
}

NS_IMETHODIMP nsMsgThread::SetFlags(PRUint32 flags)
{
  m_flags = flags;
  return m_mdbDB->UInt32ToRowCellColumn(
                    m_metaRow, m_mdbDB->m_threadFlagsColumnToken, m_flags);
}

NS_IMETHODIMP nsMsgThread::SetSubject(const nsACString& aSubject)
{
  return m_mdbDB->CharPtrToRowCellColumn(m_metaRow, m_mdbDB->m_threadSubjectColumnToken, nsCString(aSubject).get());
}

NS_IMETHODIMP nsMsgThread::GetSubject(nsACString& aSubject)
{
  nsCString subjectStr;
  nsresult rv = m_mdbDB->RowCellColumnToCharPtr(m_metaRow, m_mdbDB->m_threadSubjectColumnToken, 
                                                getter_Copies(subjectStr));

  aSubject.Assign(subjectStr);
  return rv;
}

NS_IMETHODIMP nsMsgThread::GetNumChildren(PRUint32 *result)
{
  NS_ENSURE_ARG_POINTER(result);
  *result = m_numChildren;
  return NS_OK;
}


NS_IMETHODIMP nsMsgThread::GetNumUnreadChildren (PRUint32 *result)
{
  NS_ENSURE_ARG_POINTER(result);
  *result = m_numUnreadChildren;
  return NS_OK;
}

nsresult nsMsgThread::RerootThread(nsIMsgDBHdr *newParentOfOldRoot, nsIMsgDBHdr *oldRoot, nsIDBChangeAnnouncer *announcer)
{
  nsCOMPtr <nsIMsgDBHdr> ancestorHdr = newParentOfOldRoot;
  nsMsgKey newRoot;
  newParentOfOldRoot->GetMessageKey(&newRoot);
  mdb_pos outPos;

  nsMsgKey newHdrAncestor;
  ancestorHdr->GetMessageKey(&newRoot);
  nsresult rv = NS_OK;
  // loop trying to find the oldest ancestor of this msg
  // that is a parent of the root. The oldest ancestor will
  // become the root of the thread.
  do
  {
    ancestorHdr->GetThreadParent(&newHdrAncestor);
    if (newHdrAncestor != nsMsgKey_None && newHdrAncestor != m_threadRootKey && newHdrAncestor != newRoot)
    {
      newRoot = newHdrAncestor;
      rv = m_mdbDB->GetMsgHdrForKey(newRoot, getter_AddRefs(ancestorHdr));
    }
  }
  while (NS_SUCCEEDED(rv) && ancestorHdr && newHdrAncestor != nsMsgKey_None && newHdrAncestor != m_threadRootKey
    && newHdrAncestor != newRoot);
  SetThreadRootKey(newRoot);
  ReparentNonReferenceChildrenOf(oldRoot, newRoot, announcer);
  if (ancestorHdr)
  {
    nsIMsgDBHdr *msgHdr = ancestorHdr;
    nsMsgHdr* rootMsgHdr = static_cast<nsMsgHdr*>(msgHdr);          // closed system, cast ok
    nsIMdbRow *newRootHdrRow = rootMsgHdr->GetMDBRow();
    // move the  root hdr to pos 0.
    m_mdbTable->MoveRow(m_mdbDB->GetEnv(), newRootHdrRow, -1, 0, &outPos);
    ancestorHdr->SetThreadParent(nsMsgKey_None);
  }
  return rv;
}

NS_IMETHODIMP nsMsgThread::AddChild(nsIMsgDBHdr *child, nsIMsgDBHdr *inReplyTo, PRBool threadInThread,
                                    nsIDBChangeAnnouncer *announcer)
{
  nsresult rv = NS_OK;
  nsMsgHdr* hdr = static_cast<nsMsgHdr*>(child);          // closed system, cast ok
  PRUint32 newHdrFlags = 0;
  PRUint32 msgDate;
  nsMsgKey newHdrKey = 0;
  PRBool parentKeyNeedsSetting = PR_TRUE;

  nsIMdbRow *hdrRow = hdr->GetMDBRow();
  hdr->GetRawFlags(&newHdrFlags);
  hdr->GetMessageKey(&newHdrKey);
  hdr->GetDateInSeconds(&msgDate);
  if (msgDate > m_newestMsgDate)
    SetNewestMsgDate(msgDate);

  if (newHdrFlags & nsMsgMessageFlags::Watched)
    SetFlags(m_flags | nsMsgMessageFlags::Watched);

  child->AndFlags(~(nsMsgMessageFlags::Watched), &newHdrFlags);
  
  // These are threading flags that the child may have set before being added
  // to the database.
  PRUint32 protoThreadFlags;
  child->GetUint32Property("ProtoThreadFlags", &protoThreadFlags);
  SetFlags(m_flags | protoThreadFlags);
  // Clear the flag so that it doesn't fudge anywhere else
  child->SetUint32Property("ProtoThreadFlags", 0);

  PRUint32 numChildren;
  PRUint32 childIndex = 0;

  // get the num children before we add the new header.
  GetNumChildren(&numChildren);

  // if this is an empty thread, set the root key to this header's key
  if (numChildren == 0)
    SetThreadRootKey(newHdrKey);

  if (m_mdbTable)
  {
    m_mdbTable->AddRow(m_mdbDB->GetEnv(), hdrRow);
    ChangeChildCount(1);
    if (! (newHdrFlags & nsMsgMessageFlags::Read))
      ChangeUnreadChildCount(1);
  }
  if (inReplyTo)
  {
    nsMsgKey parentKey;
    inReplyTo->GetMessageKey(&parentKey);
    child->SetThreadParent(parentKey);
    parentKeyNeedsSetting = PR_FALSE;
  }
  // check if this header is a parent of one of the messages in this thread

  PRBool hdrMoved = PR_FALSE;
  nsCOMPtr <nsIMsgDBHdr> curHdr;
  PRUint32 moveIndex = 0;

  PRTime newHdrDate;
  child->GetDate(&newHdrDate);

  // This is an ugly but simple fix for a difficult problem. Basically, when we add
  // a message to a thread, we have to run through the thread to see if the new
  // message is a parent of an existing message in the thread, and adjust things
  // accordingly. If you thread by subject, and you have a large folder with
  // messages w/ all the same subject, this code can take a really long time. So the
  // pragmatic thing is to say that for threads with more than 1000 messages, it's
  // simply not worth dealing with the case where the parent comes in after the
  // child. Threads with more than 1000 messages are pretty unwieldy anyway.
  // See Bug 90452

  if (numChildren < 1000)
  {
    for (childIndex = 0; childIndex < numChildren; childIndex++)
    {
      nsMsgKey msgKey;

      rv = GetChildHdrAt(childIndex, getter_AddRefs(curHdr));
      if (NS_SUCCEEDED(rv) && curHdr)
      {
        if (hdr->IsParentOf(curHdr))
        {
          nsMsgKey oldThreadParent;
          mdb_pos outPos;
          // move this hdr before the current header.
          if (!hdrMoved)
          {
            m_mdbTable->MoveRow(m_mdbDB->GetEnv(), hdrRow, -1, childIndex, &outPos);
            hdrMoved = PR_TRUE;
            curHdr->GetThreadParent(&oldThreadParent);
            curHdr->GetMessageKey(&msgKey);
            nsCOMPtr <nsIMsgDBHdr> curParent;
            m_mdbDB->GetMsgHdrForKey(oldThreadParent, getter_AddRefs(curParent));
            if (curParent && hdr->IsAncestorOf(curParent))
            {
              nsMsgKey curParentKey;
              curParent->GetMessageKey(&curParentKey);
              if (curParentKey == m_threadRootKey)
              {
                m_mdbTable->MoveRow(m_mdbDB->GetEnv(), hdrRow, -1, 0, &outPos);
                RerootThread(child, curParent, announcer);
                parentKeyNeedsSetting = PR_FALSE;
              }
            }
            else if (msgKey == m_threadRootKey)
            {
              RerootThread(child, curHdr, announcer);
              parentKeyNeedsSetting = PR_FALSE;
            }
          }
          curHdr->SetThreadParent(newHdrKey);
          if (msgKey == newHdrKey)
            parentKeyNeedsSetting = PR_FALSE;

          // OK, this is a reparenting - need to send notification
          if (announcer)
            announcer->NotifyParentChangedAll(msgKey, oldThreadParent, newHdrKey, nsnull);
#ifdef DEBUG_bienvenu1
          if (newHdrKey != m_threadKey)
            printf("adding second level child\n");
#endif
        }
        // Calculate a position for this child in date order
        else if (!hdrMoved && childIndex > 0 && moveIndex == 0)
        {
          PRTime curHdrDate;

          curHdr->GetDate(&curHdrDate);
          if (LL_CMP(newHdrDate, <, curHdrDate))
            moveIndex = childIndex;
        }
      }
    }
  }
  // If this header is not a reply to a header in the thread, and isn't a parent
  // check to see if it starts with Re: - if not, and the first header does start
  // with re, should we make this header the top level header?
  // If it's date is less (or it's ID?), then yes.
  if (numChildren > 0 && !(newHdrFlags & nsMsgMessageFlags::HasRe) && !inReplyTo)
  {
    PRTime topLevelHdrDate;

    nsCOMPtr <nsIMsgDBHdr> topLevelHdr;
    rv = GetRootHdr(nsnull, getter_AddRefs(topLevelHdr));
    if (NS_SUCCEEDED(rv) && topLevelHdr)
    {
      topLevelHdr->GetDate(&topLevelHdrDate);
      if (LL_CMP(newHdrDate, <, topLevelHdrDate))
      {
        RerootThread(child, topLevelHdr, announcer);
        mdb_pos outPos;
        m_mdbTable->MoveRow(m_mdbDB->GetEnv(), hdrRow, -1, 0, &outPos);
        hdrMoved = PR_TRUE;
        topLevelHdr->SetThreadParent(newHdrKey);
        parentKeyNeedsSetting = PR_FALSE;
        // ### need to get ancestor of new hdr here too.
        SetThreadRootKey(newHdrKey);
        child->SetThreadParent(nsMsgKey_None);
        // argh, here we'd need to adjust all the headers that listed
        // the demoted header as their thread parent, but only because
        // of subject threading. Adjust them to point to the new parent,
        // that is.
        ReparentNonReferenceChildrenOf(topLevelHdr, newHdrKey, announcer);
      }
    }
  }
  // OK, check to see if we added this header, and didn't parent it.

  if (numChildren > 0 && parentKeyNeedsSetting)
    child->SetThreadParent(m_threadRootKey);

  // Move child to keep thread sorted in ascending date order
  if (!hdrMoved && moveIndex > 0)
  {
    mdb_pos outPos;
    m_mdbTable->MoveRow(m_mdbDB->GetEnv(), hdrRow, -1, moveIndex, &outPos);
  }

  // do this after we've put the new hdr in the thread
  PRBool isKilled;
  child->GetIsKilled(&isKilled);
  if ((m_flags & nsMsgMessageFlags::Ignored || isKilled) && m_mdbDB)
    m_mdbDB->MarkHdrRead(child, PR_TRUE, nsnull);

#ifdef DEBUG_bienvenu1
  nsMsgDatabase *msgDB = static_cast<nsMsgDatabase*>(m_mdbDB);
  msgDB->DumpThread(m_threadRootKey);
#endif
  return rv;
}

nsresult nsMsgThread::ReparentNonReferenceChildrenOf(nsIMsgDBHdr *oldTopLevelHdr, nsMsgKey newParentKey,
                                                            nsIDBChangeAnnouncer *announcer)
{
  nsCOMPtr <nsIMsgDBHdr> curHdr;
  PRUint32 numChildren;
  PRUint32 childIndex = 0;

  GetNumChildren(&numChildren);
  for (childIndex = 0; childIndex < numChildren; childIndex++)
  {
    nsMsgKey oldTopLevelHdrKey;

    oldTopLevelHdr->GetMessageKey(&oldTopLevelHdrKey);
    nsresult rv = GetChildHdrAt(childIndex, getter_AddRefs(curHdr));
    if (NS_SUCCEEDED(rv) && curHdr)
    {
      nsMsgKey oldThreadParent, curHdrKey;
      nsMsgHdr* oldTopLevelMsgHdr = static_cast<nsMsgHdr*>(oldTopLevelHdr);      // closed system, cast ok
      curHdr->GetThreadParent(&oldThreadParent);
      curHdr->GetMessageKey(&curHdrKey);
      if (oldThreadParent == oldTopLevelHdrKey && curHdrKey != newParentKey && !oldTopLevelMsgHdr->IsParentOf(curHdr))
      {
        curHdr->GetThreadParent(&oldThreadParent);
        curHdr->SetThreadParent(newParentKey);
        // OK, this is a reparenting - need to send notification
        if (announcer)
          announcer->NotifyParentChangedAll(curHdrKey, oldThreadParent, newParentKey, nsnull);
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgThread::GetChildKeyAt(PRInt32 aIndex, nsMsgKey *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  nsresult rv;

  if (aIndex >= (PRInt32) m_numChildren)
  {
    *aResult = nsMsgKey_None;
    return NS_ERROR_ILLEGAL_VALUE;
  }
  mdbOid oid;
  rv = m_mdbTable->PosToOid( m_mdbDB->GetEnv(), aIndex, &oid);
  NS_ENSURE_SUCCESS(rv, rv);

  *aResult = oid.mOid_Id;
  return NS_OK;
}

NS_IMETHODIMP nsMsgThread::GetChildAt(PRInt32 aIndex, nsIMsgDBHdr **result)
{
  nsresult rv;

  mdbOid oid;
  rv = m_mdbTable->PosToOid( m_mdbDB->GetEnv(), aIndex, &oid);
  NS_ENSURE_SUCCESS(rv, NS_MSG_MESSAGE_NOT_FOUND);
  nsIMdbRow *hdrRow = nsnull;
  //do I have to release hdrRow?
  rv = m_mdbTable->PosToRow(m_mdbDB->GetEnv(), aIndex, &hdrRow);
  NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && hdrRow, NS_ERROR_FAILURE);
  rv = m_mdbDB->CreateMsgHdr(hdrRow,  oid.mOid_Id , result);
  return (NS_SUCCEEDED(rv)) ? NS_OK : NS_MSG_MESSAGE_NOT_FOUND;
}

NS_IMETHODIMP nsMsgThread::GetChild(nsMsgKey msgKey, nsIMsgDBHdr **result)
{
  nsresult rv;

  mdb_bool hasOid;
  mdbOid rowObjectId;

  NS_ENSURE_ARG_POINTER(result);
  NS_ENSURE_TRUE(m_mdbTable, NS_ERROR_INVALID_POINTER);

  *result = NULL;
  rowObjectId.mOid_Id = msgKey;
  rowObjectId.mOid_Scope = m_mdbDB->m_hdrRowScopeToken;
  rv = m_mdbTable->HasOid(m_mdbDB->GetEnv(), &rowObjectId, &hasOid);

  if (NS_SUCCEEDED(rv) && hasOid && m_mdbDB && m_mdbDB->m_mdbStore)
  {
    nsIMdbRow *hdrRow = nsnull;
    rv = m_mdbDB->m_mdbStore->GetRow(m_mdbDB->GetEnv(), &rowObjectId,  &hdrRow);
    NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && hdrRow, NS_ERROR_FAILURE);
    rv = m_mdbDB->CreateMsgHdr(hdrRow,  msgKey, result);
  }

  return rv;
}


NS_IMETHODIMP nsMsgThread::GetChildHdrAt(PRInt32 aIndex, nsIMsgDBHdr **result)
{
  nsresult rv;

  nsIMdbRow* resultRow;
  mdb_pos pos = aIndex - 1;

  NS_ENSURE_ARG_POINTER(result);

  *result = nsnull;
  // mork doesn't seem to handle this correctly, so deal with going off
  // the end here.
  if (aIndex > (PRInt32) m_numChildren)
    return NS_OK;

  nsIMdbTableRowCursor *rowCursor;
  rv = m_mdbTable->GetTableRowCursor(m_mdbDB->GetEnv(), pos, &rowCursor);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = rowCursor->NextRow(m_mdbDB->GetEnv(), &resultRow, &pos);
  NS_RELEASE(rowCursor);
  if (NS_FAILED(rv) || !resultRow)
    return rv;

  //Get key from row
  mdbOid outOid;
  nsMsgKey key=0;
  if (resultRow->GetOid(m_mdbDB->GetEnv(), &outOid) == NS_OK)
    key = outOid.mOid_Id;

  return m_mdbDB->CreateMsgHdr(resultRow, key, result);
}


NS_IMETHODIMP nsMsgThread::RemoveChildAt(PRInt32 aIndex)
{
  return NS_OK;
}


nsresult nsMsgThread::RemoveChild(nsMsgKey msgKey)
{
  nsresult rv;

  mdbOid		rowObjectId;
  rowObjectId.mOid_Id = msgKey;
  rowObjectId.mOid_Scope = m_mdbDB->m_hdrRowScopeToken;
  rv = m_mdbTable->CutOid(m_mdbDB->GetEnv(), &rowObjectId);
  // if this thread is empty, remove it from the all threads table.
  if (m_numChildren == 0 && m_mdbDB->m_mdbAllThreadsTable)
  {
    mdbOid rowID;
    rowID.mOid_Id = m_threadKey;
    rowID.mOid_Scope = m_mdbDB->m_threadRowScopeToken;

    m_mdbDB->m_mdbAllThreadsTable->CutOid(m_mdbDB->GetEnv(), &rowID);
  }
#if 0 // this seems to cause problems
  if (m_numChildren == 0 && m_metaRow && m_mdbDB)
    m_metaRow->CutAllColumns(m_mdbDB->GetEnv());
#endif

  return rv;
}

NS_IMETHODIMP nsMsgThread::RemoveChildHdr(nsIMsgDBHdr *child, nsIDBChangeAnnouncer *announcer)
{
  PRUint32 flags;
  nsMsgKey key;
  nsMsgKey threadParent;

  NS_ENSURE_ARG_POINTER(child);

  child->GetFlags(&flags);
  child->GetMessageKey(&key);

  child->GetThreadParent(&threadParent);
  ReparentChildrenOf(key, threadParent, announcer);

  // if this was the newest msg, clear the newest msg date so we'll recalc.
  PRUint32 date;
  child->GetDateInSeconds(&date);
  if (date == m_newestMsgDate)
    SetNewestMsgDate(0);

 if (!(flags & nsMsgMessageFlags::Read))
    ChangeUnreadChildCount(-1);
  ChangeChildCount(-1);
  return RemoveChild(key);
}

nsresult nsMsgThread::ReparentChildrenOf(nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeAnnouncer *announcer)
{
  nsresult rv = NS_OK;

  PRUint32 numChildren;
  PRUint32 childIndex = 0;

  GetNumChildren(&numChildren);

  nsCOMPtr <nsIMsgDBHdr> curHdr;
  if (numChildren > 0)
  {
    for (childIndex = 0; childIndex < numChildren; childIndex++)
    {
      rv = GetChildHdrAt(childIndex, getter_AddRefs(curHdr));
      if (NS_SUCCEEDED(rv) && curHdr)
      {
        nsMsgKey threadParent;

        curHdr->GetThreadParent(&threadParent);
        if (threadParent == oldParent)
        {
          nsMsgKey curKey;

          curHdr->SetThreadParent(newParent);
          curHdr->GetMessageKey(&curKey);
          if (announcer)
            announcer->NotifyParentChangedAll(curKey, oldParent, newParent, nsnull);
          // if the old parent was the root of the thread, then only the first child gets
          // promoted to root, and other children become children of the new root.
          if (newParent == nsMsgKey_None)
          {
            SetThreadRootKey(curKey);
            newParent = curKey;
          }
        }
      }
    }
  }
  return rv;
}

NS_IMETHODIMP nsMsgThread::MarkChildRead(PRBool bRead)
{
  ChangeUnreadChildCount(bRead ? -1 : 1);
  return NS_OK;
}

class nsMsgThreadEnumerator : public nsISimpleEnumerator {
public:
  NS_DECL_ISUPPORTS

  // nsISimpleEnumerator methods:
  NS_DECL_NSISIMPLEENUMERATOR

  // nsMsgThreadEnumerator methods:
  typedef nsresult (*nsMsgThreadEnumeratorFilter)(nsIMsgDBHdr* hdr, void* closure);

  nsMsgThreadEnumerator(nsMsgThread *thread, nsMsgKey startKey,
  nsMsgThreadEnumeratorFilter filter, void* closure);
  PRInt32 MsgKeyFirstChildIndex(nsMsgKey inMsgKey);
  virtual ~nsMsgThreadEnumerator();

protected:

  nsresult                Prefetch();

  nsIMdbTableRowCursor*   mRowCursor;
  nsCOMPtr <nsIMsgDBHdr>  mResultHdr;
  nsMsgThread*            mThread;
  nsMsgKey                mThreadParentKey;
  nsMsgKey                mFirstMsgKey;
  PRInt32                 mChildIndex;
  PRBool                  mDone;
  PRBool                  mNeedToPrefetch;
  nsMsgThreadEnumeratorFilter     mFilter;
  void*                   mClosure;
  PRBool                  mFoundChildren;
};

nsMsgThreadEnumerator::nsMsgThreadEnumerator(nsMsgThread *thread, nsMsgKey startKey,
                                             nsMsgThreadEnumeratorFilter filter, void* closure)
                                             : mRowCursor(nsnull), mDone(PR_FALSE),
                                             mFilter(filter), mClosure(closure), mFoundChildren(PR_FALSE)
{
  mThreadParentKey = startKey;
  mChildIndex = 0;
  mThread = thread;
  mNeedToPrefetch = PR_TRUE;
  mFirstMsgKey = nsMsgKey_None;

  nsresult rv = mThread->GetRootHdr(nsnull, getter_AddRefs(mResultHdr));

  if (NS_SUCCEEDED(rv) && mResultHdr)
    mResultHdr->GetMessageKey(&mFirstMsgKey);

  PRUint32 numChildren;
  mThread->GetNumChildren(&numChildren);

  if (mThreadParentKey != nsMsgKey_None)
  {
    nsMsgKey msgKey = nsMsgKey_None;
    PRUint32 childIndex = 0;


    for (childIndex = 0; childIndex < numChildren; childIndex++)
    {
      rv = mThread->GetChildHdrAt(childIndex, getter_AddRefs(mResultHdr));
      if (NS_SUCCEEDED(rv) && mResultHdr)
      {
        mResultHdr->GetMessageKey(&msgKey);

        if (msgKey == startKey)
        {
          mChildIndex = MsgKeyFirstChildIndex(msgKey);
          mDone = (mChildIndex < 0);
          break;
        }

        if (mDone)
          break;

      }
      else
        NS_ASSERTION(PR_FALSE, "couldn't get child from thread");
    }
  }

#ifdef DEBUG_bienvenu1
  nsCOMPtr <nsIMsgDBHdr> child;
  for (PRUint32 childIndex = 0; childIndex < numChildren; childIndex++)
  {
    rv = mThread->GetChildHdrAt(childIndex, getter_AddRefs(child));
    if (NS_SUCCEEDED(rv) && child)
    {
      nsMsgKey threadParent;
      nsMsgKey msgKey;
      // we're only doing one level of threading, so check if caller is
      // asking for children of the first message in the thread or not.
      // if not, we will tell him there are no children.
      child->GetMessageKey(&msgKey);
      child->GetThreadParent(&threadParent);

      printf("index = %ld key = %ld parent = %lx\n", childIndex, msgKey, threadParent);
    }
  }
#endif
  NS_ADDREF(thread);
}

nsMsgThreadEnumerator::~nsMsgThreadEnumerator()
{
    NS_RELEASE(mThread);
}

NS_IMPL_ISUPPORTS1(nsMsgThreadEnumerator, nsISimpleEnumerator)


PRInt32 nsMsgThreadEnumerator::MsgKeyFirstChildIndex(nsMsgKey inMsgKey)
{
  //	if (msgKey != mThreadParentKey)
  //		mDone = PR_TRUE;
  // look through rest of thread looking for a child of this message.
  // If the inMsgKey is the first message in the thread, then all children
  // without parents are considered to be children of inMsgKey.
  // Otherwise, only true children qualify.
  PRUint32 numChildren;
  nsCOMPtr <nsIMsgDBHdr> curHdr;
  PRInt32 firstChildIndex = -1;

  mThread->GetNumChildren(&numChildren);

  // if this is the first message in the thread, just check if there's more than
  // one message in the thread.
  // if (inMsgKey == mThread->m_threadRootKey)
  // return (numChildren > 1) ? 1 : -1;

  for (PRUint32 curChildIndex = 0; curChildIndex < numChildren; curChildIndex++)
  {
    nsresult rv = mThread->GetChildHdrAt(curChildIndex, getter_AddRefs(curHdr));
    if (NS_SUCCEEDED(rv) && curHdr)
    {
      nsMsgKey parentKey;

      curHdr->GetThreadParent(&parentKey);
      if (parentKey == inMsgKey)
      {
        firstChildIndex = curChildIndex;
        break;
      }
    }
  }
#ifdef DEBUG_bienvenu1
  printf("first child index of %ld = %ld\n", inMsgKey, firstChildIndex);
#endif
  return firstChildIndex;
}

NS_IMETHODIMP nsMsgThreadEnumerator::GetNext(nsISupports **aItem)
{
  NS_ENSURE_ARG_POINTER(aItem);
  nsresult rv;

  if (mNeedToPrefetch)
  {
    rv = Prefetch();
    NS_ENSURE_SUCCESS(rv, rv);
  }  

  if (mResultHdr)
  {
    *aItem = mResultHdr;
    NS_ADDREF(*aItem);
    mNeedToPrefetch = PR_TRUE;
  }
  return NS_OK;
}

nsresult nsMsgThreadEnumerator::Prefetch()
{
  nsresult rv=NS_OK;          // XXX or should this default to an error?
  mResultHdr = nsnull;
  if (mThreadParentKey == nsMsgKey_None)
  {
    rv = mThread->GetRootHdr(&mChildIndex, getter_AddRefs(mResultHdr));
    NS_ASSERTION(NS_SUCCEEDED(rv) && mResultHdr, "better be able to get root hdr");
    mChildIndex = 0; // since root can be anywhere, set mChildIndex to 0.
  }
  else if (!mDone)
  {
    PRUint32 numChildren;
    mThread->GetNumChildren(&numChildren);

    while (mChildIndex < (PRInt32) numChildren)
    {
      rv  = mThread->GetChildHdrAt(mChildIndex++, getter_AddRefs(mResultHdr));
      if (NS_SUCCEEDED(rv) && mResultHdr)
      {
        nsMsgKey parentKey;
        nsMsgKey curKey;

        if (mFilter && NS_FAILED(mFilter(mResultHdr, mClosure))) {
          mResultHdr = nsnull;
          continue;
        }

        mResultHdr->GetThreadParent(&parentKey);
        mResultHdr->GetMessageKey(&curKey);
        // if the parent is the same as the msg we're enumerating over,
        // or the parentKey isn't set, and we're iterating over the top
        // level message in the thread, then leave mResultHdr set to cur msg.
        if (parentKey == mThreadParentKey ||
          (parentKey == nsMsgKey_None
          && mThreadParentKey == mFirstMsgKey && curKey != mThreadParentKey))
          break;
        mResultHdr = nsnull;
      }
      else
        NS_ASSERTION(PR_FALSE, "better be able to get child");
    }
    if (!mResultHdr && mThreadParentKey == mFirstMsgKey && !mFoundChildren && numChildren > 1)
      mThread->ReparentMsgsWithInvalidParent(numChildren, mThreadParentKey);
  }
  if (!mResultHdr)
  {
    mDone = PR_TRUE;
    return NS_ERROR_FAILURE;
  }
  if (NS_FAILED(rv))
  {
    mDone = PR_TRUE;
    return rv;
  }
  else
    mNeedToPrefetch = PR_FALSE;
  mFoundChildren = PR_TRUE;

#ifdef DEBUG_bienvenu1
	nsMsgKey debugMsgKey;
	mResultHdr->GetMessageKey(&debugMsgKey);
	printf("next for %ld = %ld\n", mThreadParentKey, debugMsgKey);
#endif

  return rv;
}

NS_IMETHODIMP nsMsgThreadEnumerator::HasMoreElements(PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  if (mNeedToPrefetch)
    Prefetch();
  *aResult = !mDone;
  return NS_OK;
}

NS_IMETHODIMP nsMsgThread::EnumerateMessages(nsMsgKey parentKey, nsISimpleEnumerator* *result)
{
  nsMsgThreadEnumerator* e = new nsMsgThreadEnumerator(this, parentKey, nsnull, nsnull);
  NS_ENSURE_TRUE(e, NS_ERROR_OUT_OF_MEMORY);
  NS_ADDREF(*result = e);
  return NS_OK;
}

nsresult nsMsgThread::ReparentMsgsWithInvalidParent(PRUint32 numChildren, nsMsgKey threadParentKey)
{
  nsresult rv = NS_OK;
  // run through looking for messages that don't have a correct parent,
  // i.e., a parent that's in the thread!
  for (PRInt32 childIndex = 0; childIndex < (PRInt32) numChildren; childIndex++)
  {
    nsCOMPtr <nsIMsgDBHdr> curChild;
    rv  = GetChildHdrAt(childIndex, getter_AddRefs(curChild));
    if (NS_SUCCEEDED(rv) && curChild)
    {
      nsMsgKey parentKey;
      nsCOMPtr <nsIMsgDBHdr> parent;

      curChild->GetThreadParent(&parentKey);

      if (parentKey != nsMsgKey_None)
      {
        GetChild(parentKey, getter_AddRefs(parent));
        if (!parent)
          curChild->SetThreadParent(threadParentKey);
        else
        {
          nsMsgKey childKey;
          curChild->GetMessageKey(&childKey);
          // can't be your own parent; set parent to thread parent,
          // or make ourselves the root if we are the root.
          if (childKey == parentKey)
            curChild->SetThreadParent(m_threadRootKey == childKey ? 
                                      nsMsgKey_None : m_threadRootKey);
        }
      }
    }
  }
  return rv;
}

NS_IMETHODIMP nsMsgThread::GetRootHdr(PRInt32 *resultIndex, nsIMsgDBHdr **result)
{
  NS_ENSURE_ARG_POINTER(result);

  *result = nsnull;

  if (m_threadRootKey != nsMsgKey_None)
  {
    nsresult rv = GetChildHdrForKey(m_threadRootKey, result, resultIndex);
    if (NS_SUCCEEDED(rv) && *result)
    {
      // check that we're really the root key.
      nsMsgKey parentKey;
      (*result)->GetThreadParent(&parentKey);
      if (parentKey == nsMsgKey_None)
        return rv;
      NS_RELEASE(*result);
    }
#ifdef DEBUG_David_Bienvenu
    printf("need to reset thread root key\n");
#endif
    PRUint32 numChildren;
    nsMsgKey threadParentKey = nsMsgKey_None;
    GetNumChildren(&numChildren);

    for (PRInt32 childIndex = 0; childIndex < (PRInt32) numChildren; childIndex++)
    {
      nsCOMPtr <nsIMsgDBHdr> curChild;
      rv  = GetChildHdrAt(childIndex, getter_AddRefs(curChild));
      if (NS_SUCCEEDED(rv) && curChild)
      {
        nsMsgKey parentKey;

        curChild->GetThreadParent(&parentKey);
        if (parentKey == nsMsgKey_None)
        {
          curChild->GetMessageKey(&threadParentKey);
          if (*result)
          {
            NS_WARNING("two top level msgs, not good");
            continue;
          }
          SetThreadRootKey(threadParentKey);
          if (resultIndex)
            *resultIndex = childIndex;
          NS_ADDREF(*result = curChild);
          ReparentMsgsWithInvalidParent(numChildren, threadParentKey);
          //            return NS_OK;
        }
      }
    }
    if (*result)
      return NS_OK;
    // if we can't get the thread root key, we'll just get the first hdr.
    // there's a bug where sometimes we weren't resetting the thread root key
    // when removing the thread root key.
  }
  if (resultIndex)
    *resultIndex = 0;
  return GetChildHdrAt(0, result);
}

nsresult nsMsgThread::ChangeChildCount(PRInt32 delta)
{
  nsresult rv;

  PRUint32 childCount = 0;
  m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadChildrenColumnToken, childCount);

  NS_ASSERTION(childCount != 0 || delta > 0, "child count gone negative");
  childCount += delta;

  NS_ASSERTION((PRInt32) childCount >= 0, "child count gone to 0 or below");
  if ((PRInt32) childCount < 0)	// force child count to >= 0
    childCount = 0;

  rv = m_mdbDB->UInt32ToRowCellColumn(m_metaRow, m_mdbDB->m_threadChildrenColumnToken, childCount);
  m_numChildren = childCount;
  return rv;
}

nsresult nsMsgThread::ChangeUnreadChildCount(PRInt32 delta)
{
  nsresult rv;

  PRUint32 childCount = 0;
  m_mdbDB->RowCellColumnToUInt32(m_metaRow, m_mdbDB->m_threadUnreadChildrenColumnToken, childCount);
  childCount += delta;
  if ((PRInt32) childCount < 0)
  {
#ifdef DEBUG_bienvenu1
    NS_ASSERTION(PR_FALSE, "negative unread child count");
#endif
    childCount = 0;
  }
  rv = m_mdbDB->UInt32ToRowCellColumn(m_metaRow, m_mdbDB->m_threadUnreadChildrenColumnToken, childCount);
  m_numUnreadChildren = childCount;
  return rv;
}

nsresult nsMsgThread::SetThreadRootKey(nsMsgKey threadRootKey)
{
  m_threadRootKey = threadRootKey;
  return m_mdbDB->UInt32ToRowCellColumn(m_metaRow, m_mdbDB->m_threadRootKeyColumnToken, threadRootKey);
}

nsresult nsMsgThread::GetChildHdrForKey(nsMsgKey desiredKey, nsIMsgDBHdr **result, PRInt32 *resultIndex)
{
  PRUint32 numChildren;
  PRUint32 childIndex = 0;
  nsresult rv = NS_OK;        // XXX or should this default to an error?

  NS_ENSURE_ARG_POINTER(result);

  GetNumChildren(&numChildren);

  if ((PRInt32) numChildren < 0)
    numChildren = 0;

  for (childIndex = 0; childIndex < numChildren; childIndex++)
  {
    rv = GetChildHdrAt(childIndex, result);
    if (NS_SUCCEEDED(rv) && *result)
    {
      nsMsgKey msgKey;
      // we're only doing one level of threading, so check if caller is
      // asking for children of the first message in the thread or not.
      // if not, we will tell him there are no children.
      (*result)->GetMessageKey(&msgKey);

      if (msgKey == desiredKey)
      {
        nsMsgKey threadKey;
        (*result)->GetThreadId(&threadKey);
        if (threadKey != m_threadKey) // this msg isn't in this thread
        {
          PRUint32 msgSize;
          (*result)->GetMessageSize(&msgSize);
          if (msgSize == 0) // this is a phantom message - let's get rid of it.
          {
            RemoveChild(msgKey);
            rv = NS_ERROR_UNEXPECTED;
          }
          else
          {
            // otherwise, this message really appears to be in this
            // thread, so fix up its thread id.
            (*result)->SetThreadId(threadKey);
          }
        }
        break;
      }
      NS_RELEASE(*result);
    }
  }
  if (resultIndex)
    *resultIndex = childIndex;

  return rv;
}

NS_IMETHODIMP nsMsgThread::GetFirstUnreadChild(nsIMsgDBHdr **result)
{
  NS_ENSURE_ARG_POINTER(result);
  PRUint32 numChildren;
  nsresult rv = NS_OK;
  PRUint8 minLevel = 0xff;

  GetNumChildren(&numChildren);

  if ((PRInt32) numChildren < 0)
    numChildren = 0;

  nsCOMPtr <nsIMsgDBHdr> retHdr;

  for (PRUint32 childIndex = 0; childIndex < numChildren; childIndex++)
  {
    nsCOMPtr <nsIMsgDBHdr> child;
    rv = GetChildHdrAt(childIndex, getter_AddRefs(child));
    if (NS_SUCCEEDED(rv) && child)
    {
      nsMsgKey msgKey;
      child->GetMessageKey(&msgKey);

      PRBool isRead;
      rv = m_mdbDB->IsRead(msgKey, &isRead);
      if (NS_SUCCEEDED(rv) && !isRead)
      {
        // this is the root, so it's the best we're going to do.
        if (msgKey == m_threadRootKey)
        {
          retHdr = child;
          break;
        }
        PRUint8 level = 0;
        nsMsgKey parentId;
        child->GetThreadParent(&parentId);
        nsCOMPtr <nsIMsgDBHdr> parent;
        // count number of ancestors - that's our level
        while (parentId != nsMsgKey_None)
        {
          rv = m_mdbDB->GetMsgHdrForKey(parentId, getter_AddRefs(parent));
          if (parent)
          {
            parent->GetThreadParent(&parentId);
            level++;
          }
        }
        if (level < minLevel)
        {
          minLevel = level;
          retHdr = child;
        }
      }
    }
  }

  NS_IF_ADDREF(*result = retHdr);
  return rv;
}

NS_IMETHODIMP nsMsgThread::GetNewestMsgDate(PRUint32 *aResult)
{
  // if this hasn't been set, figure it out by enumerating the msgs in the thread.
  if (!m_newestMsgDate)
  {
    PRUint32 numChildren;
    nsresult rv;

    GetNumChildren(&numChildren);

    if ((PRInt32) numChildren < 0)
      numChildren = 0;

    for (PRUint32 childIndex = 0; childIndex < numChildren; childIndex++)
    {
      nsCOMPtr <nsIMsgDBHdr> child;
      rv = GetChildHdrAt(childIndex, getter_AddRefs(child));
      if (NS_SUCCEEDED(rv))
      {
        PRUint32 msgDate;
        child->GetDateInSeconds(&msgDate);
        if (msgDate > m_newestMsgDate)
          m_newestMsgDate = msgDate;
      }
    }

  }
  *aResult = m_newestMsgDate;
  return NS_OK;
}


NS_IMETHODIMP nsMsgThread::SetNewestMsgDate(PRUint32 aNewestMsgDate)
{
  m_newestMsgDate = aNewestMsgDate;
  return m_mdbDB->UInt32ToRowCellColumn(m_metaRow, m_mdbDB->m_threadNewestMsgDateColumnToken, aNewestMsgDate);
}
