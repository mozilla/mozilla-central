/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
   Class for handling Berkeley Mailbox stores.
*/

#ifndef nsMsgBrkMboxStore_h__
#define nsMsgBrkMboxStore_h__

#include "nsMsgLocalStoreUtils.h"
#include "nsIFile.h"
#include "nsInterfaceHashtable.h"
#include "nsISeekableStream.h"

class nsMsgBrkMBoxStore MOZ_FINAL : public nsMsgLocalStoreUtils, nsIMsgPluggableStore
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGPLUGGABLESTORE

  nsMsgBrkMBoxStore();

private:
  ~nsMsgBrkMBoxStore();

protected:
  nsresult AddSubFolders(nsIMsgFolder *parent, nsCOMPtr<nsIFile> &path, bool deep);
  nsresult CreateDirectoryForFolder(nsIFile *path);
  nsresult GetOutputStream(nsIArray *aHdrArray,
                           nsCOMPtr<nsIOutputStream> &outputStream,
                           nsCOMPtr<nsISeekableStream> &seekableStream,
                           int64_t &restorePos);
  void GetMailboxModProperties(nsIMsgFolder *aFolder,
                               int64_t *aSize, uint32_t *aDate);
  void SetDBValid(nsIMsgDBHdr *aHdr);
  // We don't want to keep re-opening an output stream when downloading
  // multiple pop3 messages, or adjusting x-mozilla-status headers, so
  // we cache output streams based on folder uri's. If the caller has closed
  // the stream, we'll get a new one.
  nsInterfaceHashtable<nsCStringHashKey, nsIOutputStream> m_outputStreams;

#ifdef _DEBUG
  nsCOMPtr<nsIMsgFolder> m_streamOutstandingFolder;
#endif
};

#endif
