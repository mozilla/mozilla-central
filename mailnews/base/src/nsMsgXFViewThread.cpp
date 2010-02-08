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
 * David Bienvenu.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@nventure.com>
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
#include "nsMsgXFViewThread.h"
#include "nsMsgSearchDBView.h"
#include "nsMsgMessageFlags.h"

NS_IMPL_ISUPPORTS1(nsMsgXFViewThread, nsIMsgThread)

nsMsgXFViewThread::nsMsgXFViewThread(nsMsgSearchDBView *view)
{
  m_numUnreadChildren = 0;
  m_numChildren = 0;
  m_flags = 0;
  m_newestMsgDate = 0;
  m_view = view;
}

nsMsgXFViewThread::~nsMsgXFViewThread()
{
}

NS_IMETHODIMP nsMsgXFViewThread::SetThreadKey(nsMsgKey threadKey)
{
  NS_ERROR("shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgXFViewThread::GetThreadKey(nsMsgKey *aResult)
{
  NS_ERROR("shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgXFViewThread::GetFlags(PRUint32 *aFlags)
{
  NS_ENSURE_ARG_POINTER(aFlags);
  *aFlags = m_flags;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::SetFlags(PRUint32 aFlags)
{
  m_flags = aFlags;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::SetSubject(const nsACString& aSubject)
{
  NS_ASSERTION(PR_FALSE, "shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgXFViewThread::GetSubject(nsACString& result)
{
  NS_ASSERTION(PR_FALSE, "shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgXFViewThread::GetNumChildren(PRUint32 *aNumChildren)
{
  NS_ENSURE_ARG_POINTER(aNumChildren);
  *aNumChildren = m_keys.Length();
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::GetNumUnreadChildren (PRUint32 *aNumUnreadChildren)
{
  NS_ENSURE_ARG_POINTER(aNumUnreadChildren);
  *aNumUnreadChildren = m_numUnreadChildren;
  return NS_OK;
}

NS_IMETHODIMP 
nsMsgXFViewThread::AddChild(nsIMsgDBHdr *aNewHdr, nsIMsgDBHdr *aInReplyTo, 
                            PRBool aThreadInThread, nsIDBChangeAnnouncer *aAnnouncer)
{
  PRUint32 whereInserted;
  return AddHdr(aNewHdr, PR_FALSE, whereInserted, nsnull);
}

// Returns the parent of the newly added header. If reparentChildren
// is true, we believe that the new header is a parent of an existing
// header, and we should find it, and reparent it.
nsresult nsMsgXFViewThread::AddHdr(nsIMsgDBHdr *newHdr,
                                   PRBool reparentChildren,
                                   PRUint32 &whereInserted,
                                   nsIMsgDBHdr **outParent)
{
  nsCOMPtr<nsIMsgFolder> newHdrFolder;
  newHdr->GetFolder(getter_AddRefs(newHdrFolder));

  PRUint32 newHdrFlags = 0;
  PRUint32 msgDate;
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
      *outParent = nsnull;
    whereInserted = 0;
    return NS_OK;
  }

  // Find our parent, if any, in the thread. Starting at the newest
  // reference, and working our way back, see if we've mapped that reference
  // to this thread.
  PRUint16 numReferences;
  newHdr->GetNumReferences(&numReferences);
  nsCOMPtr<nsIMsgDBHdr> parent;
  PRInt32 parentIndex;

  for (PRInt32 i = numReferences - 1; i >= 0;  i--)
  {
    nsCAutoString reference;
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
        parent = nsnull;
      }
      break;
    }
  }
  if (parent)
  {
    if (outParent)
      NS_ADDREF(*outParent = parent);
    PRUint8 parentLevel = m_levels[parentIndex];
    nsMsgKey parentKey;
    parent->GetMessageKey(&parentKey);
    nsCOMPtr<nsIMsgFolder> parentFolder;
    parent->GetFolder(getter_AddRefs(parentFolder));
    // iterate over our parents' children until we find one we're older than,
    // and insert ourselves before it, or as the last child. In other words,
    // insert, sorted by date.
    PRUint32 msgDate, childDate;
    newHdr->GetDateInSeconds(&msgDate);
    nsCOMPtr<nsIMsgDBHdr> child;
    nsMsgViewIndex i;
    PRInt32 insertIndex = m_keys.Length();
    for (i = parentIndex; 
         i < m_keys.Length() && (i == parentIndex ||  m_levels[i] > parentLevel); i++)
    {
      if (m_levels[i] == parentLevel + 1) // possible sibling
      {
        GetChildHdrAt(i, getter_AddRefs(child));
        if (child)
        {
          if (reparentChildren && IsHdrParentOf(newHdr, child))
          {
            insertIndex = i;
            // bump all the children of the current child.
            nsMsgViewIndex i = insertIndex; 
            do 
            {
              m_levels[i] = m_levels[i] + 1;
              i++;
            }
            while (i < m_keys.Length() && m_levels[i] > parentLevel + 1);
            break;
          }
          else
          {
            child->GetDateInSeconds(&childDate);
            if (msgDate < childDate)
            {
              // if we think we need to reparent, remember this
              // insert index, but keep looking for children.
              insertIndex = i;
              if (!reparentChildren)
                break;
            }
          }
        }
      }
    }
    m_keys.InsertElementAt(insertIndex, newHdrKey);
    m_levels.InsertElementAt(insertIndex, m_levels[parentIndex] + 1);
    m_folders.InsertObjectAt(newHdrFolder, insertIndex);
    whereInserted = insertIndex;
  }
  else
  {
    if (outParent)
      *outParent = nsnull;
    nsCOMPtr<nsIMsgDBHdr> rootHdr;
    GetChildHdrAt(0, getter_AddRefs(rootHdr));
    // If the new header is a parent of the root then it should be promoted. 
    if (rootHdr && IsHdrParentOf(newHdr, rootHdr))
    {
      m_keys.InsertElementAt(0, newHdrKey);
      m_levels.InsertElementAt(0, 0);
      m_folders.InsertObjectAt(newHdrFolder, 0);
      whereInserted = 0;
      // Adjust level of root hdr. We still have to reparent children of root,
      // and adjust levels if if neccessary.
      m_levels[1] = 1;
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
//    rv = GetRootHdr(nsnull, getter_AddRefs(topLevelHdr));
//    if (NS_SUCCEEDED(rv) && topLevelHdr)
//    {
//      topLevelHdr->GetDate(&topLevelHdrDate);
//      if (LL_CMP(newHdrDate, <, topLevelHdrDate))
      
//    }
//  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::GetChildAt(PRInt32 aIndex, nsIMsgDBHdr **aResult)
{
  if (aIndex >= (PRInt32) m_keys.Length())
    return NS_MSG_MESSAGE_NOT_FOUND;
  nsCOMPtr<nsIMsgDatabase> db;
  nsresult rv = m_folders[aIndex]->GetMsgDatabase(getter_AddRefs(db));
  NS_ENSURE_SUCCESS(rv, rv);
  return db->GetMsgHdrForKey(m_keys[aIndex], aResult);
}

NS_IMETHODIMP nsMsgXFViewThread::GetChildHdrAt(PRInt32 aIndex, nsIMsgDBHdr **aResult)
{
  return GetChildAt(aIndex, aResult);
}

NS_IMETHODIMP nsMsgXFViewThread::RemoveChildAt(PRInt32 aIndex)
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
  PRUint32 msgFlags;
  child->GetMessageKey(&msgKey);
  child->GetFlags(&msgFlags);
  nsCOMPtr<nsIMsgFolder> msgFolder;
  child->GetFolder(getter_AddRefs(msgFolder));
  // if this was the newest msg, clear the newest msg date so we'll recalc.
  PRUint32 date;
  child->GetDateInSeconds(&date);
  if (date == m_newestMsgDate)
    SetNewestMsgDate(0);

  for (PRUint32 childIndex = 0; childIndex < m_keys.Length(); childIndex++)
  {
    if (m_keys[childIndex] == msgKey && m_folders[childIndex] == msgFolder)
    {
      PRUint8 levelRemoved = m_keys[childIndex];
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

NS_IMETHODIMP nsMsgXFViewThread::GetRootHdr(PRInt32 *aResultIndex, nsIMsgDBHdr **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  if (aResultIndex)
    *aResultIndex = 0;
  return GetChildHdrAt(0, aResult);
}

NS_IMETHODIMP nsMsgXFViewThread::GetChildKeyAt(PRInt32 aIndex, nsMsgKey *aResult)
{
  NS_ASSERTION(PR_FALSE, "shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgXFViewThread::GetChild(nsMsgKey msgKey, nsIMsgDBHdr **aResult)
{
  NS_ASSERTION(PR_FALSE, "shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}


PRUint32 nsMsgXFViewThread::HdrIndex(nsIMsgDBHdr *hdr)
{
  nsMsgKey msgKey;
  nsCOMPtr<nsIMsgFolder> folder;
  hdr->GetMessageKey(&msgKey);
  hdr->GetFolder(getter_AddRefs(folder));
  for (PRUint32 i = 0; i < m_keys.Length(); i++)
  {
    if (m_keys[i] == msgKey && m_folders[i] == folder)
      return i;
  }
  return -1;
}

void nsMsgXFViewThread::ChangeUnreadChildCount(PRInt32 delta)
{
  m_numUnreadChildren += delta;
}

void nsMsgXFViewThread::ChangeChildCount(PRInt32 delta)
{
  m_numChildren += delta;
}

PRBool nsMsgXFViewThread::IsHdrParentOf(nsIMsgDBHdr *possibleParent, 
                                        nsIMsgDBHdr *possibleChild)
{
  PRUint16 referenceToCheck = 0;
  possibleChild->GetNumReferences(&referenceToCheck);
  nsCAutoString reference;

  nsCString messageId;
  possibleParent->GetMessageId(getter_Copies(messageId));

  while (referenceToCheck > 0)
  {
    possibleChild->GetStringReference(referenceToCheck - 1, reference);

    if (reference.Equals(messageId))
      return PR_TRUE;
    // if reference didn't match, check if this ref is for a non-existent
    // header. If it is, continue looking at ancestors.
    nsCOMPtr<nsIMsgDBHdr> refHdr;
    m_view->GetMsgHdrFromHash(reference, getter_AddRefs(refHdr));
    if (refHdr)
      break;
    referenceToCheck--;
  }
  return PR_FALSE;
}

NS_IMETHODIMP nsMsgXFViewThread::GetNewestMsgDate(PRUint32 *aResult) 
{
  // if this hasn't been set, figure it out by enumerating the msgs in the thread.
  if (!m_newestMsgDate)
  {
    PRUint32 numChildren;
    nsresult rv = NS_OK;
  
    GetNumChildren(&numChildren);
  
    if ((PRInt32) numChildren < 0)
      numChildren = 0;
  
    for (PRUint32 childIndex = 0; childIndex < numChildren; childIndex++)
    {
      nsCOMPtr<nsIMsgDBHdr> child;
      rv = GetChildHdrAt(childIndex, getter_AddRefs(child));
      if (NS_SUCCEEDED(rv) && child)
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

NS_IMETHODIMP nsMsgXFViewThread::SetNewestMsgDate(PRUint32 aNewestMsgDate) 
{
  m_newestMsgDate = aNewestMsgDate;
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::MarkChildRead(PRBool aRead)
{
  ChangeUnreadChildCount(aRead ? -1 : 1);
  return NS_OK;
}

NS_IMETHODIMP nsMsgXFViewThread::GetFirstUnreadChild(nsIMsgDBHdr **aResult)
{
  NS_ENSURE_ARG(aResult);
  PRUint32 numChildren;
  nsresult rv = NS_OK;
  
  GetNumChildren(&numChildren);
  
  if ((PRInt32) numChildren < 0)
    numChildren = 0;
  
  for (PRUint32 childIndex = 0; childIndex < numChildren; childIndex++)
  {
    nsCOMPtr<nsIMsgDBHdr> child;
    rv = GetChildHdrAt(childIndex, getter_AddRefs(child));
    if (NS_SUCCEEDED(rv) && child)
    {
      nsMsgKey msgKey;
      child->GetMessageKey(&msgKey);
      
      PRBool isRead;
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
NS_IMETHODIMP nsMsgXFViewThread::EnumerateMessages(PRUint32 aParentKey, 
                                                   nsISimpleEnumerator **aResult)
{
  NS_ERROR("shouldn't call this");
  return NS_ERROR_NOT_IMPLEMENTED;
}
