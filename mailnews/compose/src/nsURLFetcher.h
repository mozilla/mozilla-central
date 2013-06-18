/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsURLFetcher_h_
#define nsURLFetcher_h_

#include "nsIURLFetcher.h"

#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "nsIInputStream.h"
#include "nsIStreamListener.h"

#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsCURILoader.h"
#include "nsIURIContentListener.h"
#include "nsIWebProgressListener.h"
#include "nsWeakReference.h"
#include "nsStringGlue.h"

class nsMsgAttachmentHandler;

class nsURLFetcher : public nsIURLFetcher,
                     public nsIStreamListener,
                     public nsIURIContentListener, 
                     public nsIInterfaceRequestor,
                     public nsIWebProgressListener,
                     public nsSupportsWeakReference
{ 
public: 
  nsURLFetcher();
  virtual ~nsURLFetcher();

  /* this macro defines QueryInterface, AddRef and Release for this class */
  NS_DECL_ISUPPORTS

  // Methods for nsIURLFetcher
  NS_DECL_NSIURLFETCHER

  // Methods for nsIStreamListener
  NS_DECL_NSISTREAMLISTENER

  // Methods for nsIRequestObserver
  NS_DECL_NSIREQUESTOBSERVER
  
  // Methods for nsIURICOntentListener
  NS_DECL_NSIURICONTENTLISTENER

  // Methods for nsIInterfaceRequestor
  NS_DECL_NSIINTERFACEREQUESTOR

  // Methods for nsIWebProgressListener
  NS_DECL_NSIWEBPROGRESSLISTENER

protected:
  nsresult InsertConverter(const char * aContentType);

private:
  nsCOMPtr<nsIOutputStream>       mOutStream;               // the output file stream
  nsCOMPtr<nsIFile>          mLocalFile;               // the output file itself
  nsCOMPtr<nsIStreamListener>     mConverter;               // the stream converter, if needed
  nsCString                  mConverterContentType;    // The content type of the converter
  bool                            mStillRunning;  // Are we still running?
  int32_t                         mTotalWritten;  // Size counter variable
  char                            *mBuffer;                 // Buffer used for reading the data
  uint32_t                        mBufferSize;              // Buffer size;
  nsCString                  mContentType;             // The content type retrieved from the server
  nsCString                  mCharset;                 // The charset retrieved from the server
  nsRefPtr<nsMsgAttachmentHandler> mTagData;      // Tag data for callback...
  nsAttachSaveCompletionCallback  mCallback;      // Callback to call once the file is saved...
  nsCOMPtr<nsISupports>           mLoadCookie;    // load cookie used by the uri loader when we fetch the url
  bool                            mOnStopRequestProcessed; // used to prevent calling OnStopRequest multiple times
  bool                            mIsFile;        // This is used to check whether the URI is a local file.

  friend class nsURLFetcherStreamConsumer;
}; 


/**
 * Stream consumer used for handling special content type like multipart/x-mixed-replace
 */

class nsURLFetcherStreamConsumer : public nsIStreamListener
{
public:
  nsURLFetcherStreamConsumer(nsURLFetcher* urlFetcher);
  virtual ~nsURLFetcherStreamConsumer();

  /* additional members */
  NS_DECL_ISUPPORTS
  NS_DECL_NSISTREAMLISTENER
  NS_DECL_NSIREQUESTOBSERVER

private:
  nsURLFetcher* mURLFetcher;
}; 


#endif /* nsURLFetcher_h_ */
