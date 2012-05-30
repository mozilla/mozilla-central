/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgFolderCacheElement_H
#define nsMsgFolderCacheElement_H

#include "nsIMsgFolderCacheElement.h"
#include "nsMsgFolderCache.h"
#include "mdb.h"

class nsMsgFolderCacheElement : public nsIMsgFolderCacheElement
{
public:
  nsMsgFolderCacheElement();
  virtual ~nsMsgFolderCacheElement();
  friend class nsMsgFolderCache;

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGFOLDERCACHEELEMENT

  void SetMDBRow(nsIMdbRow *row);
  void SetOwningCache(nsMsgFolderCache *owningCache);
protected:
  nsIMdbRow *m_mdbRow;

  nsMsgFolderCache *m_owningCache; // this will be ref-counted. Is this going to be a problem?
  // I want to avoid circular references, but since this is
  // scriptable, I think I have to ref-count it.
  nsCString m_folderKey;
};

#endif
