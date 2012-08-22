/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"    // precompiled header...

#include "nsCOMPtr.h"
#include "nsNNTPArticleList.h"
#include "nsIMsgFolder.h"
#include "nsAutoPtr.h"
#include "nsMsgKeyArray.h"

NS_IMPL_ISUPPORTS1(nsNNTPArticleList, nsINNTPArticleList)

nsNNTPArticleList::nsNNTPArticleList()
{
}

nsNNTPArticleList::~nsNNTPArticleList()
{
  if (m_newsDB) {
    m_newsDB->Commit(nsMsgDBCommitType::kSessionCommit);
    m_newsDB->Close(true);
    m_newsDB = nullptr;
  }

  m_newsFolder = nullptr;
}

NS_IMETHODIMP
nsNNTPArticleList::Initialize(nsIMsgNewsFolder *newsFolder)
{
    nsresult rv;
    NS_ENSURE_ARG_POINTER(newsFolder);

    m_dbIndex = 0;

    m_newsFolder = newsFolder;

    nsCOMPtr <nsIMsgFolder> folder = do_QueryInterface(m_newsFolder, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    rv = folder->GetMsgDatabase(getter_AddRefs(m_newsDB));
    NS_ENSURE_SUCCESS(rv,rv);
    if (!m_newsDB) return NS_ERROR_UNEXPECTED;

    nsRefPtr<nsMsgKeyArray> keys = new nsMsgKeyArray;
    rv = m_newsDB->ListAllKeys(keys);
    NS_ENSURE_SUCCESS(rv,rv);
    m_idsInDB.AppendElements(keys->m_keys);

    return NS_OK;
}

NS_IMETHODIMP
nsNNTPArticleList::AddArticleKey(int32_t key)
{
#ifdef DEBUG
  m_idsOnServer.AppendElement(key);
#endif

  if (m_dbIndex < m_idsInDB.Length())
  {
    int32_t idInDBToCheck = m_idsInDB[m_dbIndex];
    // if there are keys in the database that aren't in the newsgroup
    // on the server, remove them. We probably shouldn't do this if
    // we have a copy of the article offline.
    // We'll add to m_idsDeleted for now and remove the id later
    while (idInDBToCheck < key)
    {
      m_idsDeleted.AppendElement(idInDBToCheck);
      if (m_dbIndex >= m_idsInDB.Length())
        break;
      idInDBToCheck = m_idsInDB[++m_dbIndex];
    }
    if (idInDBToCheck == key)
      m_dbIndex++;
  }
  return NS_OK;
}

NS_IMETHODIMP
nsNNTPArticleList::FinishAddingArticleKeys()
{
  // if the last n messages in the group are cancelled, they won't have gotten removed
  // so we have to go and remove them now.
  if (m_dbIndex < m_idsInDB.Length())
    m_idsDeleted.AppendElements(&m_idsInDB[m_dbIndex],
      m_idsInDB.Length() - m_dbIndex);
  
  if (m_idsDeleted.Length())
    m_newsFolder->RemoveMessages(m_idsDeleted);

#ifdef DEBUG
  // make sure none of the deleted turned up on the idsOnServer list
  for (uint32_t i = 0; i < m_idsDeleted.Length(); i++) {
    NS_ASSERTION(m_idsOnServer.IndexOf((nsMsgKey)(m_idsDeleted[i]), 0) == nsMsgViewIndex_None, "a deleted turned up on the idsOnServer list");
  }
#endif
  return NS_OK;
}
