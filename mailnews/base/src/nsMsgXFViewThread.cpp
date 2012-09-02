/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsMsgXFViewThread.h"
#include "nsMsgSearchDBView.h"
#include "nsMsgMessageFlags.h"

NS_IMPL_ISUPPORTS1(nsMsgXFViewThread, nsIMsgThread)

nsMsgXFViewThread::nsMsgXFViewThread(nsMsgSearchDBView *view, nsMsgKey threadId)
{
  m_numUnreadChildren = 0;
  m_numChildren = 0;
  m_flags = 0;
  m_newestMsgDate = 0;
  m_view = view;
  m_threadId = threadId;
}

nsMsgXFViewThread::~nsMsgXFViewThread()
{
}

NS_IMETHODIMP nsMsgXFViewThread::SetThreadKey(nsMsgKey threadKey)
{
  m_threadId = threadKey;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::GetThreadKey(nsMsgKey *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = m_threadId;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::GetFlags(uint32_t *aFlags)
{
  NS_ENSURE_ARG_POINTER(aFlags);
  *aFlags = m_flags;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::SetFlags(uint32_t aFlags)
{
  m_flags = aFlags;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::SetSubject(const nsACString& aSubject)
{
  NS_ASSERTION(false, "shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgXFViewThread::GetSubject(nsACString& result)
{
  NS_ASSERTION(false, "shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgXFViewThread::GetNumChildren(uint32_t *aNumChildren)
{
  NS_ENSURE_ARG_POINTER(aNumChildren);
  *aNumChildren = m_keys.Length();
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::GetNumUnreadChildren (uint32_t *aNumUnreadChildren)
{
  NS_ENSURE_ARG_POINTER(aNumUnreadChildren);
  *aNumUnreadChildren = m_numUnreadChildren;
  return NS_OK;
}

NS_IMETHODIMP 
nsMsgXFViewThread::AddChild(nsIMsgDBHdr *aNewHdr, nsIMsgDBHdr *aInReplyTo, 
                            bool aThreadInThread, nsIDBChangeAnnouncer *aAnnouncer)
{
  uint32_t whereInserted;
  return AddHdr(aNewHdr, false, whereInserted, nullptr);
}

// Returns the parent of the newly added header. If reparentChildren
// is true, we believe that the new header is a parent of an existing
// header, and we should find it, and reparent it.
nsresult nsMsgXFViewThread::AddHdr(nsIMsgDBHdr *newHdr,
                                   bool reparentChildren,
                                   uint32_t &whereInserted,
                                   nsIMsgDBHdr **outParent)
{
  nsCOMPtr<nsIMsgFolder> newHdrFolder;
  newHdr->GetFolder(getter_AddRefs(newHdrFolder));

  uint32_t newHdrFlags = 0;
  uint32_t msgDate;
  nsMsgKey newHdrKey = 0;

  newHdr->GetMessageKey(&newHdrKey);
  newHdr->GetDateInSeconds(&msgDate);
  newHdr->GetFlags(&newHdrFlags);
  if (msgDate > m_newestMsgDate)
    SetNewestMsgDate(msgDate);

  if (newHdrFlags & nsMsgMessageFlags::Watched)
    SetFlags(m_flags | nsMsgMessageFlags::Watched);

  ChangeChildCount(1);
  if (! (newHdrFlags & nsMsgMessageFlags::Read))
    ChangeUnreadChildCount(1);

  if (m_numChildren == 1)
  {
    m_keys.InsertElementAt(0, newHdrKey);
    m_levels.InsertElementAt(0, 0);
    m_folders.InsertObjectAt(newHdrFolder, 0);
    if (outParent)
      *outParent = nullptr;
    whereInserted = 0;
    return NS_OK;
  }

  // Find our parent, if any, in the thread. Starting at the newest
  // reference, and working our way back, see if we've mapped that reference
  // to this thread.
  uint16_t numReferences;
  newHdr->GetNumReferences(&numReferences);
  nsCOMPtr<nsIMsgDBHdr> parent;
  int32_t parentIndex;

  for (int32_t i = numReferences - 1; i >= 0;  i--)
  {
    nsAutoCString reference;
    newHdr->GetStringReference(i, reference);
    if (reference.IsEmpty())
      break;

    // I could look for the thread from the reference, but getting
    // the header directly should be fine. If it's not, that means
    // that the parent isn't in this thread, though it should be.
    m_view->GetMsgHdrFromHash(reference, getter_AddRefs(parent));
    if (parent)
    {
      parentIndex = HdrIndex(parent);
      if (parentIndex == -1)
      {
        NS_ERROR("how did we get in the wrong thread?");
        parent = nullptr;
      }
      break;
    }
  }
  if (parent)
  {
    if (outParent)
      NS_ADDREF(*outParent = parent);
    uint32_t parentLevel = m_levels[parentIndex];
    nsMsgKey parentKey;
    parent->GetMessageKey(&parentKey);
    nsCOMPtr<nsIMsgFolder> parentFolder;
    parent->GetFolder(getter_AddRefs(parentFolder));
    // iterate over our parents' children until we find one we're older than,
    // and insert ourselves before it, or as the last child. In other words,
    // insert, sorted by date.
    uint32_t msgDate, childDate;
    newHdr->GetDateInSeconds(&msgDate);
    nsCOMPtr<nsIMsgDBHdr> child;
    nsMsgViewIndex i;
    nsMsgViewIndex insertIndex = m_keys.Length();
    uint32_t insertLevel = parentLevel + 1;
    for (i = parentIndex; 
         i < m_keys.Length() && (i == (nsMsgViewIndex)parentIndex || m_levels[i] >= parentLevel);
         i++)
    {
      GetChildHdrAt(i, getter_AddRefs(child));
      if (child)
      {
        if (reparentChildren && IsHdrParentOf(newHdr, child))
        {
          insertIndex = i;
          // bump all the children of the current child, and the child
          nsMsgViewIndex j = insertIndex;
          uint8_t childLevel = m_levels[insertIndex];
          do
          {
            m_levels[j] = m_levels[j] + 1;
            j++;
          }
          while (j < m_keys.Length() && m_levels[j] > childLevel);
          break;
        }
        else if (m_levels[i] == parentLevel + 1) // possible sibling
        {
          child->GetDateInSeconds(&childDate);
          if (msgDate < childDate)
          {
            // if we think we need to reparent, remember this
            // insert index, but keep looking for children.
            insertIndex = i;
            insertLevel = m_levels[i];
            // if the sibling we're inserting after has children, we need
            // to go after the children.
            while (insertIndex + 1 < m_keys.Length() && m_levels[insertIndex + 1] > insertLevel)
              insertIndex++;
            if (!reparentChildren)
              break;
          }
        }
      }
    }
    m_keys.InsertElementAt(insertIndex, newHdrKey);
    m_levels.InsertElementAt(insertIndex, insertLevel);
    m_folders.InsertObjectAt(newHdrFolder, insertIndex);
    whereInserted = insertIndex;
  }
  else
  {
    if (outParent)
      *outParent = nullptr;
    nsCOMPtr<nsIMsgDBHdr> rootHdr;
    GetChildHdrAt(0, getter_AddRefs(rootHdr));
    // If the new header is a parent of the root then it should be promoted. 
    if (rootHdr && IsHdrParentOf(newHdr, rootHdr))
    {
      m_keys.InsertElementAt(0, newHdrKey);
      m_levels.InsertElementAt(0, 0);
      m_folders.InsertObjectAt(newHdrFolder, 0);
      whereInserted = 0;
      // Adjust level of old root hdr and its children
      for (nsMsgViewIndex i = 1; i < m_keys.Length(); i++)
        m_levels[i] = m_levels[1] + 1;
    }
    else
    {
      m_keys.AppendElement(newHdrKey);
      m_levels.AppendElement(1);
      m_folders.AppendObject(newHdrFolder);
      if (outParent)
        NS_IF_ADDREF(*outParent = rootHdr);
      whereInserted = m_keys.Length() -1;
    }
  }

  // ### TODO handle the case where the root header starts 
  // with Re, and the new one doesn't, and is earlier. In that
  // case, we want to promote the new header to root.

//  PRTime newHdrDate;
//  newHdr->GetDate(&newHdrDate);

//  if (numChildren > 0 && !(newHdrFlags & nsMsgMessageFlags::HasRe))
//  {
//    PRTime topLevelHdrDate;

//    nsCOMPtr<nsIMsgDBHdr> topLevelHdr;
//    rv = GetRootHdr(nullptr, getter_AddRefs(topLevelHdr));
//    if (NS_SUCCEEDED(rv) && topLevelHdr)
//    {
//      topLevelHdr->GetDate(&topLevelHdrDate);
//      if (newHdrDate < topLevelHdrDate)
      
//    }
//  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::GetChildHdrAt(int32_t aIndex, nsIMsgDBHdr **aResult)
{
  if (aIndex < 0 || aIndex >= (int32_t) m_keys.Length())
    return NS_MSG_MESSAGE_NOT_FOUND;
  nsCOMPtr<nsIMsgDatabase> db;
  nsresult rv = m_folders[aIndex]->GetMsgDatabase(getter_AddRefs(db));
  NS_ENSURE_SUCCESS(rv, rv);
  return db->GetMsgHdrForKey(m_keys[aIndex], aResult);
}

NS_IMETHODIMP nsMsgXFViewThread::RemoveChildAt(int32_t aIndex)
{
  m_keys.RemoveElementAt(aIndex);
  m_levels.RemoveElementAt(aIndex);
  m_folders.RemoveObjectAt(aIndex);
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::RemoveChildHdr(nsIMsgDBHdr *child, nsIDBChangeAnnouncer *announcer)
{
  NS_ENSURE_ARG_POINTER(child);
  nsMsgKey msgKey;
  uint32_t msgFlags;
  child->GetMessageKey(&msgKey);
  child->GetFlags(&msgFlags);
  nsCOMPtr<nsIMsgFolder> msgFolder;
  child->GetFolder(getter_AddRefs(msgFolder));
  // if this was the newest msg, clear the newest msg date so we'll recalc.
  uint32_t date;
  child->GetDateInSeconds(&date);
  if (date == m_newestMsgDate)
    SetNewestMsgDate(0);

  for (uint32_t childIndex = 0; childIndex < m_keys.Length(); childIndex++)
  {
    if (m_keys[childIndex] == msgKey && m_folders[childIndex] == msgFolder)
    {
      uint8_t levelRemoved = m_keys[childIndex];
      // Adjust the levels of all the children of this header
      nsMsgViewIndex i;
      for (i = childIndex + 1; 
               i < m_keys.Length() && m_levels[i] > levelRemoved; i++)
            m_levels[i] = m_levels[i] - 1;

      m_view->NoteChange(childIndex + 1, i - childIndex + 1,
                         nsMsgViewNotificationCode::changed);
      m_keys.RemoveElementAt(childIndex);
      m_levels.RemoveElementAt(childIndex);
      m_folders.RemoveObjectAt(childIndex);
      if (!(msgFlags & nsMsgMessageFlags::Read))
        ChangeUnreadChildCount(-1);
      ChangeChildCount(-1);
      return NS_OK;
    }
  }
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgXFViewThread::GetRootHdr(int32_t *aResultIndex, nsIMsgDBHdr **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  if (aResultIndex)
    *aResultIndex = 0;
  return GetChildHdrAt(0, aResult);
}

NS_IMETHODIMP nsMsgXFViewThread::GetChildKeyAt(int32_t aIndex, nsMsgKey *aResult)
{
  NS_ASSERTION(false, "shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgXFViewThread::GetChild(nsMsgKey msgKey, nsIMsgDBHdr **aResult)
{
  NS_ASSERTION(false, "shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}


int32_t nsMsgXFViewThread::HdrIndex(nsIMsgDBHdr *hdr)
{
  nsMsgKey msgKey;
  nsCOMPtr<nsIMsgFolder> folder;
  hdr->GetMessageKey(&msgKey);
  hdr->GetFolder(getter_AddRefs(folder));
  for (uint32_t i = 0; i < m_keys.Length(); i++)
  {
    if (m_keys[i] == msgKey && m_folders[i] == folder)
      return i;
  }
  return -1;
}

void nsMsgXFViewThread::ChangeUnreadChildCount(int32_t delta)
{
  m_numUnreadChildren += delta;
}

void nsMsgXFViewThread::ChangeChildCount(int32_t delta)
{
  m_numChildren += delta;
}

bool nsMsgXFViewThread::IsHdrParentOf(nsIMsgDBHdr *possibleParent, 
                                        nsIMsgDBHdr *possibleChild)
{
  uint16_t referenceToCheck = 0;
  possibleChild->GetNumReferences(&referenceToCheck);
  nsAutoCString reference;

  nsCString messageId;
  possibleParent->GetMessageId(getter_Copies(messageId));

  while (referenceToCheck > 0)
  {
    possibleChild->GetStringReference(referenceToCheck - 1, reference);

    if (reference.Equals(messageId))
      return true;
    // if reference didn't match, check if this ref is for a non-existent
    // header. If it is, continue looking at ancestors.
    nsCOMPtr<nsIMsgDBHdr> refHdr;
    m_view->GetMsgHdrFromHash(reference, getter_AddRefs(refHdr));
    if (refHdr)
      break;
    referenceToCheck--;
  }
  return false;
}

NS_IMETHODIMP nsMsgXFViewThread::GetNewestMsgDate(uint32_t *aResult) 
{
  // if this hasn't been set, figure it out by enumerating the msgs in the thread.
  if (!m_newestMsgDate)
  {
    uint32_t numChildren;
    nsresult rv = NS_OK;
  
    GetNumChildren(&numChildren);
  
    if ((int32_t) numChildren < 0)
      numChildren = 0;
  
    for (uint32_t childIndex = 0; childIndex < numChildren; childIndex++)
    {
      nsCOMPtr<nsIMsgDBHdr> child;
      rv = GetChildHdrAt(childIndex, getter_AddRefs(child));
      if (NS_SUCCEEDED(rv) && child)
      {
        uint32_t msgDate;
        child->GetDateInSeconds(&msgDate);
        if (msgDate > m_newestMsgDate)
          m_newestMsgDate = msgDate;
      }
    }
  }
  *aResult = m_newestMsgDate;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::SetNewestMsgDate(uint32_t aNewestMsgDate) 
{
  m_newestMsgDate = aNewestMsgDate;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::MarkChildRead(bool aRead)
{
  ChangeUnreadChildCount(aRead ? -1 : 1);
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::GetFirstUnreadChild(nsIMsgDBHdr **aResult)
{
  NS_ENSURE_ARG(aResult);
  uint32_t numChildren;
  nsresult rv = NS_OK;
  
  GetNumChildren(&numChildren);
  
  if ((int32_t) numChildren < 0)
    numChildren = 0;
  
  for (uint32_t childIndex = 0; childIndex < numChildren; childIndex++)
  {
    nsCOMPtr<nsIMsgDBHdr> child;
    rv = GetChildHdrAt(childIndex, getter_AddRefs(child));
    if (NS_SUCCEEDED(rv) && child)
    {
      nsMsgKey msgKey;
      child->GetMessageKey(&msgKey);
      
      bool isRead;
      nsCOMPtr<nsIMsgDatabase> db;
      nsresult rv = m_folders[childIndex]->GetMsgDatabase(getter_AddRefs(db));
      if (NS_SUCCEEDED(rv))
        rv = db->IsRead(msgKey, &isRead);
      if (NS_SUCCEEDED(rv) && !isRead)
      {
        NS_ADDREF(*aResult = child);
        break;
      }
    }
  }
  return rv;
}
NS_IMETHODIMP nsMsgXFViewThread::EnumerateMessages(uint32_t aParentKey,
                                                   nsISimpleEnumerator **aResult)
{
  NS_ERROR("shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}
