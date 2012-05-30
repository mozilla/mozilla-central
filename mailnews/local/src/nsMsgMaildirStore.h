/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
   Class for handling Maildir stores.
*/

#ifndef nsMsgMaildirStore_h__
#define nsMsgMaildirStore_h__

#include "nsMsgLocalStoreUtils.h"
#include "nsILocalFile.h"
#include "nsInterfaceHashtable.h"
#include "nsMsgMessageFlags.h"

class nsMsgMaildirStore : public nsMsgLocalStoreUtils, nsIMsgPluggableStore
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGPLUGGABLESTORE

  nsMsgMaildirStore();

private:
  ~nsMsgMaildirStore();

protected:
  nsresult GetDirectoryForFolder(nsILocalFile *path);
  nsresult CreateDirectoryForFolder(nsILocalFile *path, bool aIsServer);

  nsresult CreateMaildir(nsILocalFile *path);
  nsresult AddSubFolders(nsIMsgFolder *parent, nsIFile *path, bool deep);
  nsresult GetOutputStream(nsIMsgDBHdr *aHdr,
                           nsCOMPtr<nsIOutputStream> &aOutputStream);

};
#endif
