/* -*- Mode: idl; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _nsMsgComposeSecure_H_
#define _nsMsgComposeSecure_H_

#include "nsIMsgComposeSecure.h"
#include "nsIMsgSMIMECompFields.h"
#include "nsCOMPtr.h"
#include "nsICMSEncoder.h"
#include "nsIX509Cert.h"
#include "nsIMimeConverter.h"
#include "nsIStringBundle.h"
#include "nsICryptoHash.h"
#include "nsICMSMessage.h"
#include "nsIMutableArray.h"
#include "nsStringGlue.h"
#include "nsIOutputStream.h"

class nsIMsgCompFields;

class nsMsgSMIMEComposeFields : public nsIMsgSMIMECompFields
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGSMIMECOMPFIELDS

  nsMsgSMIMEComposeFields();
  virtual ~nsMsgSMIMEComposeFields();

private:
  bool mSignMessage;
  bool mAlwaysEncryptMessage;
};

typedef enum {
  mime_crypto_none,				/* normal unencapsulated MIME message */
  mime_crypto_clear_signed,		/* multipart/signed encapsulation */
  mime_crypto_opaque_signed,	/* application/x-pkcs7-mime (signedData) */
  mime_crypto_encrypted,		/* application/x-pkcs7-mime */
  mime_crypto_signed_encrypted	/* application/x-pkcs7-mime */
} mimeDeliveryCryptoState;

class nsMsgComposeSecure : public nsIMsgComposeSecure
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGCOMPOSESECURE

  nsMsgComposeSecure();
  virtual ~nsMsgComposeSecure();
  /* additional members */
  void GetOutputStream(nsIOutputStream **stream) { NS_IF_ADDREF(*stream = mStream);}
private:
  nsresult MimeInitMultipartSigned(bool aOuter, nsIMsgSendReport *sendReport);
  nsresult MimeInitEncryption(bool aSign, nsIMsgSendReport *sendReport);
  nsresult MimeFinishMultipartSigned (bool aOuter, nsIMsgSendReport *sendReport);
  nsresult MimeFinishEncryption (bool aSign, nsIMsgSendReport *sendReport);
  nsresult MimeCryptoHackCerts(const char *aRecipients, nsIMsgSendReport *sendReport, bool aEncrypt, bool aSign);
  bool InitializeSMIMEBundle();
  nsresult GetSMIMEBundleString(const PRUnichar *name,
				PRUnichar **outString);
  nsresult SMIMEBundleFormatStringFromName(const PRUnichar *name,
					   const PRUnichar **params,
					   uint32_t numParams,
					   PRUnichar **outString);
  nsresult ExtractEncryptionState(nsIMsgIdentity * aIdentity, nsIMsgCompFields * aComposeFields, bool * aSignMessage, bool * aEncrypt);

  mimeDeliveryCryptoState mCryptoState;
  nsCOMPtr<nsIOutputStream> mStream;
  int16_t mHashType;
  nsCOMPtr<nsICryptoHash> mDataHash;
  MimeEncoderData *mSigEncoderData;
  char *mMultipartSignedBoundary;
  nsString mSigningCertName;
  nsCOMPtr<nsIX509Cert> mSelfSigningCert;
  nsString mEncryptionCertName;
  nsCOMPtr<nsIX509Cert> mSelfEncryptionCert;
  nsCOMPtr<nsIMutableArray> mCerts;
  nsCOMPtr<nsICMSMessage> mEncryptionCinfo;
  nsCOMPtr<nsICMSEncoder> mEncryptionContext;
  nsCOMPtr<nsIStringBundle> mSMIMEBundle;

  MimeEncoderData *mCryptoEncoderData;
  bool mIsDraft;

  enum {eBufferSize = 8192};
  char *mBuffer;
  uint32_t mBufferedBytes;

  bool mErrorAlreadyReported;
  void SetError(nsIMsgSendReport *sendReport, const PRUnichar *bundle_string);
  void SetErrorWithParam(nsIMsgSendReport *sendReport, const PRUnichar *bundle_string, const char *param);
};

#endif
