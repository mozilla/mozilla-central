/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMsgAppCore_h
#define __nsMsgAppCore_h

#include "nscore.h"
#include "nsIMessenger.h"
#include "nsCOMPtr.h"
#include "nsITransactionManager.h"
#include "nsIFile.h"
#include "nsIDocShell.h"
#include "nsIStringBundle.h"
#include "nsIFile.h"
#include "nsWeakReference.h"
#include "nsIDOMWindow.h"

class nsMessenger : public nsIMessenger, public nsSupportsWeakReference, public nsIFolderListener
{

public:
  nsMessenger();
  virtual ~nsMessenger();

  NS_DECL_ISUPPORTS  
  NS_DECL_NSIMESSENGER
  NS_DECL_NSIFOLDERLISTENER

  nsresult Alert(const char * stringName);

  nsresult SaveAttachment(nsIFile *file, const nsACString& unescapedUrl,
                          const nsACString& messageUri, const nsACString& contentType, 
                          void *closure, nsIUrlListener *aListener);
  nsresult PromptIfFileExists(nsIFile *file);
  nsresult DetachAttachments(uint32_t aCount,
                             const char ** aContentTypeArray,
                             const char ** aUrlArray,
                             const char ** aDisplayNameArray,
                             const char ** aMessageUriArray,
                             nsTArray<nsCString> *saveFileUris,
                             bool withoutWarning = false);
  nsresult SaveAllAttachments(uint32_t count,
                              const char **contentTypeArray,
                              const char **urlArray,
                              const char **displayNameArray,
                              const char **messageUriArray,
                              bool detaching);
  nsresult SaveOneAttachment(const char* aContentType,
                             const char* aURL,
                             const char* aDisplayName,
                             const char* aMessageUri,
                             bool detaching);

protected:
  void GetString(const nsString& aStringName, nsString& stringValue);
  nsresult InitStringBundle();
  nsresult PromptIfDeleteAttachments(bool saveFirst, uint32_t count, const char **displayNameArray);

private:
  nsresult GetLastSaveDirectory(nsIFile **aLastSaveAsDir);
  // if aLocalFile is a dir, we use it.  otherwise, we use the parent of aLocalFile.
  nsresult SetLastSaveDirectory(nsIFile *aLocalFile);

  nsresult GetSaveAsFile(const nsAString& aMsgFilename, int32_t *aSaveAsFileType,
                         nsIFile **aSaveAsFile);

  nsresult GetSaveToDir(nsIFile **aSaveToDir);

  nsString mId;
  nsCOMPtr<nsITransactionManager> mTxnMgr;

  /* rhp - need this to drive message display */
  nsCOMPtr<nsIDOMWindow>    mWindow;
  nsCOMPtr<nsIMsgWindow>    mMsgWindow;
  nsCOMPtr<nsIDocShell>     mDocShell;

  // String bundles...
  nsCOMPtr<nsIStringBundle>   mStringBundle;

  nsCString mCurrentDisplayCharset;

  nsCOMPtr<nsISupports>  mSearchContext;
  nsCString   mLastDisplayURI; // this used when the user attempts to force a charset reload of a message...we need to get the last displayed
                               // uri so we can re-display it..
  nsCString mNavigatingToUri;
  nsTArray<nsCString> mLoadedMsgHistory;
  int32_t mCurHistoryPos;
};

#define NS_MESSENGER_CID \
{ /* f436a174-e2c0-4955-9afe-e3feb68aee56 */      \
  0xf436a174, 0xe2c0, 0x4955,                     \
    {0x9a, 0xfe, 0xe3, 0xfe, 0xb6, 0x8a, 0xee, 0x56}}

#endif
