/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsPgpmimeDecrypt_h_
#define _nsPgpmimeDecrypt_h_

#include "mimecth.h"
#include "nsIPgpMimeProxy.h"
#include "nsCOMPtr.h"
#include "nsIStreamListener.h"
#include "nsIInputStream.h"
#include "nsILoadGroup.h"

#define PGPMIME_JS_DECRYPTOR_CONTRACTID "@mozilla.org/mime/pgp-mime-js-decrypt;1"

typedef struct MimeEncryptedPgpClass MimeEncryptedPgpClass;
typedef struct MimeEncryptedPgp      MimeEncryptedPgp;

struct MimeEncryptedPgpClass {
  MimeEncryptedClass encrypted;
};

struct MimeEncryptedPgp {
  MimeEncrypted encrypted;
};

class nsPgpMimeProxy : public nsIPgpMimeProxy,
                       public nsIRequest,
                       public nsIInputStream
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIPGPMIMEPROXY
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSISTREAMLISTENER
  NS_DECL_NSIREQUEST
  NS_DECL_NSIINPUTSTREAM

  nsPgpMimeProxy();
  virtual ~nsPgpMimeProxy();

  // Define a Create method to be used with a factory:
  static NS_METHOD
  Create(nsISupports *aOuter, REFNSIID aIID, void **aResult);

protected:
  bool                          mInitialized;
  nsCOMPtr<nsIStreamListener>   mDecryptor;

  MimeDecodeCallbackFun         mOutputFun;
  void*                         mOutputClosure;

  nsCOMPtr<nsILoadGroup>        mLoadGroup;
  nsLoadFlags                   mLoadFlags;
  nsresult                      mCancelStatus;

  uint32_t                      mStreamOffset;
  nsCString                     mByteBuf;
  nsCString                     mContentType;

  nsresult Finalize();
};

#endif
