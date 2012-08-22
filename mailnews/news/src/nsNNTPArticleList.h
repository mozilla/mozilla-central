/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsNNTPArticleList_h___
#define nsNNTPArticleList_h___

#include "nsCOMPtr.h"
#include "nsINNTPArticleList.h"
#include "nsIMsgNewsFolder.h"
#include "nsIMsgDatabase.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"

class nsNNTPArticleList : public nsINNTPArticleList
{
public:
  nsNNTPArticleList();
  virtual ~nsNNTPArticleList();

    NS_DECL_ISUPPORTS
    NS_DECL_NSINNTPARTICLELIST

protected:
    nsTArray<nsMsgKey> m_idsInDB;

#ifdef DEBUG
    nsTArray<nsMsgKey> m_idsOnServer;
#endif
    nsTArray<nsMsgKey> m_idsDeleted;

    nsCOMPtr <nsIMsgNewsFolder> m_newsFolder;
    nsCOMPtr <nsIMsgDatabase> m_newsDB;

    uint32_t  m_dbIndex;
};

#endif /* nsNNTPArticleList_h___ */
