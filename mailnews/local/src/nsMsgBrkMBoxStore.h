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
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/**
   Class for handling Berkeley Mailbox stores.
*/

#ifndef nsMsgBrkMboxStore_h__
#define nsMsgBrkMboxStore_h__

#include "nsMsgLocalStoreUtils.h"
#include "nsILocalFile.h"
#include "nsInterfaceHashtable.h"
#include "nsISeekableStream.h"

class nsMsgBrkMBoxStore : public nsMsgLocalStoreUtils, nsIMsgPluggableStore
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGPLUGGABLESTORE

  nsMsgBrkMBoxStore();

private:
  ~nsMsgBrkMBoxStore();

protected:
  nsresult AddSubFolders(nsIMsgFolder *parent, nsIFile *path, bool deep);
  nsresult CreateDirectoryForFolder(nsILocalFile *path);
  nsresult GetOutputStream(nsIArray *aHdrArray,
                           nsCOMPtr<nsIOutputStream> &outputStream,
                           nsCOMPtr<nsISeekableStream> &seekableStream,
                           PRInt64 &restorePos);
  void GetMailboxModProperties(nsIMsgFolder *aFolder,
                               PRInt64 *aSize, PRUint32 *aDate);
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
