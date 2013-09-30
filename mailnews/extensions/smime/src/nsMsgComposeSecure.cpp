/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgComposeSecure.h"

#include "msgCore.h"
#include "nsIMsgCompFields.h"
#include "nsIMsgHeaderParser.h"
#include "nsIMsgIdentity.h"
#include "nsISMimeCert.h"
#include "nsIX509CertDB.h"
#include "nsMimeTypes.h"
#include "nsMsgMimeCID.h"
#include "nspr.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsMemory.h"
#include "nsAlgorithm.h"
#include "mozilla/Services.h"
#include "mozilla/mailnews/MimeEncoder.h"
#include "nsIMimeConverter.h"
#include <algorithm>

using mozilla::mailnews::MimeEncoder;

#define MK_MIME_ERROR_WRITING_FILE -1

#define SMIME_STRBUNDLE_URL "chrome://messenger/locale/am-smime.properties"

// It doesn't make sense to encode the message because the message will be
// displayed only if the MUA doesn't support MIME.
// We need to consider what to do in case the server doesn't support 8BITMIME.
// In short, we can't use non-ASCII characters here.
static const char crypto_multipart_blurb[] = "This is a cryptographically signed message in MIME format.";

static void mime_crypto_write_base64 (void *closure, const char *buf,
              unsigned long size);
static nsresult mime_encoder_output_fn(const char *buf, int32_t size,
                                       void *closure);
static nsresult mime_nested_encoder_output_fn(const char *buf, int32_t size,
                                              void *closure);
static nsresult make_multipart_signed_header_string(bool outer_p,
                  char **header_return,
                  char **boundary_return);
static char *mime_make_separator(const char *prefix);


static void
GenerateGlobalRandomBytes(unsigned char *buf, int32_t len)
{
  static bool      firstTime = true;
  
  if (firstTime)
  {
    // Seed the random-number generator with current time so that
    // the numbers will be different every time we run.
    srand( (unsigned)PR_Now() );
    firstTime = false;
  }
  
  for( int32_t i = 0; i < len; i++ )
    buf[i] = rand() % 10;
}
   
char 
*mime_make_separator(const char *prefix)
{
  unsigned char rand_buf[13]; 
  GenerateGlobalRandomBytes(rand_buf, 12);

  return PR_smprintf("------------%s"
           "%02X%02X%02X%02X"
           "%02X%02X%02X%02X"
           "%02X%02X%02X%02X",
           prefix,
           rand_buf[0], rand_buf[1], rand_buf[2], rand_buf[3],
           rand_buf[4], rand_buf[5], rand_buf[6], rand_buf[7],
           rand_buf[8], rand_buf[9], rand_buf[10], rand_buf[11]);
}

// end of copied code which needs fixed....

/////////////////////////////////////////////////////////////////////////////////////////
// Implementation of nsMsgSMIMEComposeFields
/////////////////////////////////////////////////////////////////////////////////////////

NS_IMPL_ISUPPORTS1(nsMsgSMIMEComposeFields, nsIMsgSMIMECompFields)

nsMsgSMIMEComposeFields::nsMsgSMIMEComposeFields()
:mSignMessage(false), mAlwaysEncryptMessage(false)
{
}

nsMsgSMIMEComposeFields::~nsMsgSMIMEComposeFields()
{
}

NS_IMETHODIMP nsMsgSMIMEComposeFields::SetSignMessage(bool value)
{
  mSignMessage = value;
  return NS_OK;
}

NS_IMETHODIMP nsMsgSMIMEComposeFields::GetSignMessage(bool *_retval)
{
  *_retval = mSignMessage;
  return NS_OK;
}

NS_IMETHODIMP nsMsgSMIMEComposeFields::SetRequireEncryptMessage(bool value)
{
  mAlwaysEncryptMessage = value;
  return NS_OK;
}

NS_IMETHODIMP nsMsgSMIMEComposeFields::GetRequireEncryptMessage(bool *_retval)
{
  *_retval = mAlwaysEncryptMessage;
  return NS_OK;
}

/////////////////////////////////////////////////////////////////////////////////////////
// Implementation of nsMsgComposeSecure
/////////////////////////////////////////////////////////////////////////////////////////

NS_IMPL_ISUPPORTS1(nsMsgComposeSecure, nsIMsgComposeSecure)

nsMsgComposeSecure::nsMsgComposeSecure()
{
  /* member initializers and constructor code */
  mMultipartSignedBoundary  = 0;
  mBuffer = 0;
  mBufferedBytes = 0;
}

nsMsgComposeSecure::~nsMsgComposeSecure()
{
  /* destructor code */
  if (mEncryptionContext) {
    if (mBufferedBytes) {
      mEncryptionContext->Update(mBuffer, mBufferedBytes);
      mBufferedBytes = 0;
    }
    mEncryptionContext->Finish();
  }

  delete [] mBuffer;

  PR_FREEIF(mMultipartSignedBoundary);
}

NS_IMETHODIMP nsMsgComposeSecure::RequiresCryptoEncapsulation(nsIMsgIdentity * aIdentity, nsIMsgCompFields * aCompFields, bool * aRequiresEncryptionWork)
{
  NS_ENSURE_ARG_POINTER(aRequiresEncryptionWork);

  *aRequiresEncryptionWork = false;

  bool alwaysEncryptMessages = false;
  bool signMessage = false;
  nsresult rv = ExtractEncryptionState(aIdentity, aCompFields, &signMessage, &alwaysEncryptMessages);
  NS_ENSURE_SUCCESS(rv, rv);

  if (alwaysEncryptMessages || signMessage)
    *aRequiresEncryptionWork = true;

  return NS_OK;
}


nsresult nsMsgComposeSecure::GetSMIMEBundleString(const PRUnichar *name,
                                                  PRUnichar **outString)
{
  *outString = nullptr;

  NS_ENSURE_ARG_POINTER(name);

  NS_ENSURE_TRUE(InitializeSMIMEBundle(), NS_ERROR_FAILURE);

  return mSMIMEBundle->GetStringFromName(name, outString);
}

nsresult
nsMsgComposeSecure::
SMIMEBundleFormatStringFromName(const PRUnichar *name,
                                const PRUnichar **params,
                                uint32_t numParams,
                                PRUnichar **outString)
{
  NS_ENSURE_ARG_POINTER(name);

  if (!InitializeSMIMEBundle())
    return NS_ERROR_FAILURE;

  return mSMIMEBundle->FormatStringFromName(name, params,
                                            numParams, outString);
}

bool nsMsgComposeSecure::InitializeSMIMEBundle()
{
  if (mSMIMEBundle)
    return true;

  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  nsresult rv = bundleService->CreateBundle(SMIME_STRBUNDLE_URL,
                                            getter_AddRefs(mSMIMEBundle));
  NS_ENSURE_SUCCESS(rv, false);

  return true;
}

void nsMsgComposeSecure::SetError(nsIMsgSendReport *sendReport, const PRUnichar *bundle_string)
{
  if (!sendReport || !bundle_string)
    return;

  if (mErrorAlreadyReported)
    return;

  mErrorAlreadyReported = true;
  
  nsString errorString;
  nsresult res;

  res = GetSMIMEBundleString(bundle_string,
                             getter_Copies(errorString));

  if (NS_SUCCEEDED(res) && !errorString.IsEmpty())
  {
    sendReport->SetMessage(nsIMsgSendReport::process_Current,
                           errorString.get(),
                           true);
  }
}

void nsMsgComposeSecure::SetErrorWithParam(nsIMsgSendReport *sendReport, const PRUnichar *bundle_string, const char *param)
{
  if (!sendReport || !bundle_string || !param)
    return;

  if (mErrorAlreadyReported)
    return;

  mErrorAlreadyReported = true;
  
  nsString errorString;
  nsresult res;
  const PRUnichar *params[1];

  NS_ConvertASCIItoUTF16 ucs2(param);
  params[0]= ucs2.get();

  res = SMIMEBundleFormatStringFromName(bundle_string,
                                        params,
                                        1,
                                        getter_Copies(errorString));

  if (NS_SUCCEEDED(res) && !errorString.IsEmpty())
  {
    sendReport->SetMessage(nsIMsgSendReport::process_Current,
                           errorString.get(),
                           true);
  }
}

nsresult nsMsgComposeSecure::ExtractEncryptionState(nsIMsgIdentity * aIdentity, nsIMsgCompFields * aComposeFields, bool * aSignMessage, bool * aEncrypt)
{
  if (!aComposeFields && !aIdentity)
    return NS_ERROR_FAILURE; // kick out...invalid args....

  NS_ENSURE_ARG_POINTER(aSignMessage);
  NS_ENSURE_ARG_POINTER(aEncrypt);

  nsCOMPtr<nsISupports> securityInfo;
  if (aComposeFields)
    aComposeFields->GetSecurityInfo(getter_AddRefs(securityInfo));

  if (securityInfo) // if we were given security comp fields, use them.....
  {
    nsCOMPtr<nsIMsgSMIMECompFields> smimeCompFields = do_QueryInterface(securityInfo);
    if (smimeCompFields)
    {
      smimeCompFields->GetSignMessage(aSignMessage);
      smimeCompFields->GetRequireEncryptMessage(aEncrypt);
      return NS_OK;
    }
  }

  // get the default info from the identity....
  int32_t ep = 0;
  nsresult testrv = aIdentity->GetIntAttribute("encryptionpolicy", &ep);
  if (NS_FAILED(testrv)) {
    *aEncrypt = false;
  }
  else {
    *aEncrypt = (ep > 0);
  }

  testrv = aIdentity->GetBoolAttribute("sign_mail", aSignMessage);
  if (NS_FAILED(testrv))
  {
    *aSignMessage = false;
  }
  return NS_OK;
}

/* void beginCryptoEncapsulation (in nsOutputFileStream aStream, in boolean aEncrypt, in boolean aSign, in string aRecipeints, in boolean aIsDraft); */
NS_IMETHODIMP nsMsgComposeSecure::BeginCryptoEncapsulation(nsIOutputStream * aStream,
                                                           const char * aRecipients,
                                                           nsIMsgCompFields * aCompFields,
                                                           nsIMsgIdentity * aIdentity,
                                                           nsIMsgSendReport *sendReport,
                                                           bool aIsDraft)
{
  mErrorAlreadyReported = false;
  nsresult rv = NS_OK;

  bool encryptMessages = false;
  bool signMessage = false;
  ExtractEncryptionState(aIdentity, aCompFields, &signMessage, &encryptMessages);

  if (!signMessage && !encryptMessages) return NS_ERROR_FAILURE;

  mStream = aStream;
  mIsDraft = aIsDraft;

  if (encryptMessages && signMessage)
    mCryptoState = mime_crypto_signed_encrypted;
  else if (encryptMessages)
    mCryptoState = mime_crypto_encrypted;
  else if (signMessage)
    mCryptoState = mime_crypto_clear_signed;
  else
    PR_ASSERT(0);

  aIdentity->GetUnicharAttribute("signing_cert_name", mSigningCertName);
  aIdentity->GetUnicharAttribute("encryption_cert_name", mEncryptionCertName);

  rv = MimeCryptoHackCerts(aRecipients, sendReport, encryptMessages, signMessage);
  if (NS_FAILED(rv)) {
    goto FAIL;
  }

  switch (mCryptoState)
  {
  case mime_crypto_clear_signed:
    rv = MimeInitMultipartSigned(true, sendReport);
    break;
  case mime_crypto_opaque_signed:
    PR_ASSERT(0);    /* #### no api for this yet */
    rv = NS_ERROR_NOT_IMPLEMENTED;
    break;
  case mime_crypto_signed_encrypted:
    rv = MimeInitEncryption(true, sendReport);
    break;
  case mime_crypto_encrypted:
    rv = MimeInitEncryption(false, sendReport);
    break;
  case mime_crypto_none:
    /* This can happen if mime_crypto_hack_certs() decided to turn off
     encryption (by asking the user.) */
    // XXX 1 is not a valid nsresult
    rv = static_cast<nsresult>(1);
    break;
  default:
    PR_ASSERT(0);
    break;
  }

FAIL:
  return rv;
}

/* void finishCryptoEncapsulation (in boolean aAbort); */
NS_IMETHODIMP nsMsgComposeSecure::FinishCryptoEncapsulation(bool aAbort, nsIMsgSendReport *sendReport)
{
  nsresult rv = NS_OK;

  if (!aAbort) {
    switch (mCryptoState) {
    case mime_crypto_clear_signed:
      rv = MimeFinishMultipartSigned (true, sendReport);
      break;
    case mime_crypto_opaque_signed:
      PR_ASSERT(0);    /* #### no api for this yet */
      rv = NS_ERROR_FAILURE;
      break;
    case mime_crypto_signed_encrypted:
      rv = MimeFinishEncryption (true, sendReport);
      break;
    case mime_crypto_encrypted:
      rv = MimeFinishEncryption (false, sendReport);
      break;
    default:
      PR_ASSERT(0);
      rv = NS_ERROR_FAILURE;
      break;
    }
  }
  return rv;
}

nsresult nsMsgComposeSecure::MimeInitMultipartSigned(bool aOuter, nsIMsgSendReport *sendReport)
{
  /* First, construct and write out the multipart/signed MIME header data.
   */
  nsresult rv = NS_OK;
  char *header = 0;
  uint32_t L;

  rv = make_multipart_signed_header_string(aOuter, &header,
                    &mMultipartSignedBoundary);
  NS_ENSURE_SUCCESS(rv, rv);

  L = strlen(header);

  if (aOuter){
    /* If this is the outer block, write it to the file. */
    uint32_t n;
    rv = mStream->Write(header, L, &n);
    if (NS_FAILED(rv) || n < L) {
      // XXX This is -1, not an nsresult
      rv = static_cast<nsresult>(MK_MIME_ERROR_WRITING_FILE);
    }
  } else {
    /* If this is an inner block, feed it through the crypto stream. */
    rv = MimeCryptoWriteBlock (header, L);
  }

  PR_Free(header);
  NS_ENSURE_SUCCESS(rv, rv);

  /* Now initialize the crypto library, so that we can compute a hash
   on the object which we are signing.
   */

  mHashType = nsICryptoHash::SHA1;

  PR_SetError(0,0);
  mDataHash = do_CreateInstance("@mozilla.org/security/hash;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mDataHash->Init(mHashType);
  NS_ENSURE_SUCCESS(rv, rv);

  PR_SetError(0,0);
  return rv;
}

nsresult nsMsgComposeSecure::MimeInitEncryption(bool aSign, nsIMsgSendReport *sendReport)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleSvc =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleSvc, NS_ERROR_UNEXPECTED);

  nsCOMPtr<nsIStringBundle> sMIMEBundle;
  nsString mime_smime_enc_content_desc;

  bundleSvc->CreateBundle(SMIME_STRBUNDLE_URL, getter_AddRefs(sMIMEBundle));

  if (!sMIMEBundle)
    return NS_ERROR_FAILURE;
 
  sMIMEBundle->GetStringFromName(NS_LITERAL_STRING("mime_smimeEncryptedContentDesc").get(),
                                 getter_Copies(mime_smime_enc_content_desc));
  NS_ConvertUTF16toUTF8 enc_content_desc_utf8(mime_smime_enc_content_desc);

  nsCOMPtr<nsIMimeConverter> mimeConverter =
     do_GetService(NS_MIME_CONVERTER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString encodedContentDescription;
  mimeConverter->EncodeMimePartIIStr_UTF8(enc_content_desc_utf8, false, "UTF-8",
      sizeof("Content-Description: "),
      nsIMimeConverter::MIME_ENCODED_WORD_SIZE,
      getter_Copies(encodedContentDescription));

  /* First, construct and write out the opaque-crypto-blob MIME header data.
   */

  char *s =
  PR_smprintf("Content-Type: " APPLICATION_PKCS7_MIME
          "; name=\"smime.p7m\"; smime-type=enveloped-data" CRLF
        "Content-Transfer-Encoding: " ENCODING_BASE64 CRLF
        "Content-Disposition: attachment"
          "; filename=\"smime.p7m\"" CRLF
        "Content-Description: %s" CRLF
        CRLF,
        encodedContentDescription.get());

  uint32_t L;
  if (!s) return NS_ERROR_OUT_OF_MEMORY;
  L = strlen(s);
  uint32_t n;
  rv = mStream->Write(s, L, &n);
  if (NS_FAILED(rv) || n < L) {
    return NS_ERROR_FAILURE;
  }
  PR_Free(s);
  s = 0;

  /* Now initialize the crypto library, so that we can filter the object
   to be encrypted through it.
   */

  if (!mIsDraft) {
    uint32_t numCerts;
    mCerts->GetLength(&numCerts);
    PR_ASSERT(numCerts > 0);
    if (numCerts == 0) return NS_ERROR_FAILURE;
  }

  // Initialize the base64 encoder
  MOZ_ASSERT(!mCryptoEncoder, "Shouldn't have an encoder already");
  mCryptoEncoder = MimeEncoder::GetBase64Encoder(mime_encoder_output_fn,
                          this);

  /* Initialize the encrypter (and add the sender's cert.) */
  PR_ASSERT(mSelfEncryptionCert);
  PR_SetError(0,0);
  mEncryptionCinfo = do_CreateInstance(NS_CMSMESSAGE_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;
  rv = mEncryptionCinfo->CreateEncrypted(mCerts);
  if (NS_FAILED(rv)) {
    SetError(sendReport, NS_LITERAL_STRING("ErrorEncryptMail").get());
    goto FAIL;
  }

  mEncryptionContext = do_CreateInstance(NS_CMSENCODER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  if (!mBuffer) {
    mBuffer = new char[eBufferSize];
    if (!mBuffer)
      return NS_ERROR_OUT_OF_MEMORY;
  }

  mBufferedBytes = 0;

  rv = mEncryptionContext->Start(mEncryptionCinfo, mime_crypto_write_base64, mCryptoEncoder);
  if (NS_FAILED(rv)) {
    SetError(sendReport, NS_LITERAL_STRING("ErrorEncryptMail").get());
    goto FAIL;
  }

  /* If we're signing, tack a multipart/signed header onto the front of
   the data to be encrypted, and initialize the sign-hashing code too.
   */
  if (aSign) {
    rv = MimeInitMultipartSigned(false, sendReport);
    if (NS_FAILED(rv)) goto FAIL;
  }

 FAIL:
  return rv;
}

nsresult nsMsgComposeSecure::MimeFinishMultipartSigned (bool aOuter, nsIMsgSendReport *sendReport)
{
  int status;
  nsresult rv;
  nsCOMPtr<nsICMSMessage> cinfo = do_CreateInstance(NS_CMSMESSAGE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsICMSEncoder> encoder = do_CreateInstance(NS_CMSENCODER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  char * header = nullptr;
  nsCOMPtr<nsIStringBundleService> bundleSvc =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleSvc, NS_ERROR_UNEXPECTED);

  nsCOMPtr<nsIStringBundle> sMIMEBundle;
  nsString mime_smime_sig_content_desc;

  bundleSvc->CreateBundle(SMIME_STRBUNDLE_URL, getter_AddRefs(sMIMEBundle));

  if (!sMIMEBundle)
    return NS_ERROR_FAILURE;
  
  sMIMEBundle->GetStringFromName(NS_LITERAL_STRING("mime_smimeSignatureContentDesc").get(),
                                 getter_Copies(mime_smime_sig_content_desc));

  NS_ConvertUTF16toUTF8 sig_content_desc_utf8(mime_smime_sig_content_desc);

  nsCOMPtr<nsIMimeConverter> mimeConverter =
     do_GetService(NS_MIME_CONVERTER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString encodedContentDescription;
  mimeConverter->EncodeMimePartIIStr_UTF8(sig_content_desc_utf8, false, "UTF-8",
      sizeof("Content-Description: "),
      nsIMimeConverter::MIME_ENCODED_WORD_SIZE,
      getter_Copies(encodedContentDescription));

  /* Compute the hash...
   */

  nsAutoCString hashString;
  mDataHash->Finish(false, hashString);

  mDataHash = 0;

  status = PR_GetError();
  if (status < 0) goto FAIL;

  /* Write out the headers for the signature.
   */
  uint32_t L;
  header =
    PR_smprintf(CRLF
          "--%s" CRLF
          "Content-Type: " APPLICATION_PKCS7_SIGNATURE
            "; name=\"smime.p7s\"" CRLF
          "Content-Transfer-Encoding: " ENCODING_BASE64 CRLF
          "Content-Disposition: attachment; "
            "filename=\"smime.p7s\"" CRLF
          "Content-Description: %s" CRLF
          CRLF,
          mMultipartSignedBoundary,
          encodedContentDescription.get());

  if (!header) {
    rv = NS_ERROR_OUT_OF_MEMORY;
    goto FAIL;
  }

  L = strlen(header);
  if (aOuter) {
    /* If this is the outer block, write it to the file. */
    uint32_t n;
    rv = mStream->Write(header, L, &n);
    if (NS_FAILED(rv) || n < L) {
      // XXX This is -1, not an nsresult
      rv = static_cast<nsresult>(MK_MIME_ERROR_WRITING_FILE);
    } 
  } else {
    /* If this is an inner block, feed it through the crypto stream. */
    rv = MimeCryptoWriteBlock (header, L);
  }

  PR_Free(header);

  /* Create the signature...
   */

  PR_ASSERT(mHashType == nsICryptoHash::SHA1);

  PR_ASSERT (mSelfSigningCert);
  PR_SetError(0,0);

  rv = cinfo->CreateSigned(mSelfSigningCert, mSelfEncryptionCert, (unsigned char*)hashString.get(), hashString.Length());
  if (NS_FAILED(rv))  {
    SetError(sendReport, NS_LITERAL_STRING("ErrorCanNotSignMail").get());
    goto FAIL;
  }

  // Initialize the base64 encoder for the signature data.
  MOZ_ASSERT(!mSigEncoder, "Shouldn't already have a mSigEncoder");
  mSigEncoder = MimeEncoder::GetBase64Encoder(
    (aOuter ? mime_encoder_output_fn : mime_nested_encoder_output_fn), this);

  /* Write out the signature.
   */
  PR_SetError(0,0);
  rv = encoder->Start(cinfo, mime_crypto_write_base64, mSigEncoder);
  if (NS_FAILED(rv)) {
    SetError(sendReport, NS_LITERAL_STRING("ErrorCanNotSignMail").get());
    goto FAIL;
  }

  // We're not passing in any data, so no update needed.
  rv = encoder->Finish();
  if (NS_FAILED(rv)) {
    SetError(sendReport, NS_LITERAL_STRING("ErrorCanNotSignMail").get());
    goto FAIL;
  }

  // Shut down the sig's base64 encoder.
  rv = mSigEncoder->Flush();
  mSigEncoder = nullptr;
  if (NS_FAILED(rv)) {
    goto FAIL;
  }

  /* Now write out the terminating boundary.
   */
  {
  uint32_t L;
  char *header = PR_smprintf(CRLF "--%s--" CRLF,
                 mMultipartSignedBoundary);
  PR_Free(mMultipartSignedBoundary);
  mMultipartSignedBoundary = 0;

  if (!header) {
    rv = NS_ERROR_OUT_OF_MEMORY;
    goto FAIL;
  }
  L = strlen(header);
  if (aOuter) {
    /* If this is the outer block, write it to the file. */
    uint32_t n;
    rv = mStream->Write(header, L, &n);
    if (NS_FAILED(rv) || n < L)
      // XXX This is -1, not an nsresult
      rv = static_cast<nsresult>(MK_MIME_ERROR_WRITING_FILE);
  } else {
    /* If this is an inner block, feed it through the crypto stream. */
    rv = MimeCryptoWriteBlock (header, L);
  }
  }

FAIL:
  return rv;
}


/* Helper function for mime_finish_crypto_encapsulation() to close off
   an opaque crypto object (for encrypted or signed-and-encrypted messages.)
 */
nsresult nsMsgComposeSecure::MimeFinishEncryption (bool aSign, nsIMsgSendReport *sendReport)
{
  nsresult rv;

  /* If this object is both encrypted and signed, close off the
   signature first (since it's inside.) */
  if (aSign) {
    rv = MimeFinishMultipartSigned (false, sendReport);
    if (NS_FAILED(rv)) {
      goto FAIL;
    }
  }

  /* Close off the opaque encrypted blob.
   */
  PR_ASSERT(mEncryptionContext);

  if (mBufferedBytes) {
    rv = mEncryptionContext->Update(mBuffer, mBufferedBytes);
    mBufferedBytes = 0;
    if (NS_FAILED(rv)) {
      PR_ASSERT(PR_GetError() < 0);
      goto FAIL;
    }
  }
  
  rv = mEncryptionContext->Finish();
  if (NS_FAILED(rv)) {
    SetError(sendReport, NS_LITERAL_STRING("ErrorEncryptMail").get());
    goto FAIL;
  }

  mEncryptionContext = 0;

  PR_ASSERT(mEncryptionCinfo);
  if (!mEncryptionCinfo) {
    rv = NS_ERROR_FAILURE;
  }
  if (mEncryptionCinfo) {
    mEncryptionCinfo = 0;
  }

  // Shut down the base64 encoder.
  mCryptoEncoder->Flush();
  mCryptoEncoder = nullptr;

  uint32_t n;
  rv = mStream->Write(CRLF, 2, &n);
  if (NS_FAILED(rv) || n < 2)
    rv = NS_ERROR_FAILURE;

 FAIL:
  return rv;
}

/* Used to figure out what certs should be used when encrypting this message.
 */
nsresult nsMsgComposeSecure::MimeCryptoHackCerts(const char *aRecipients,
                                                 nsIMsgSendReport *sendReport,
                                                 bool aEncrypt,
                                                 bool aSign)
{
  char *mailbox_list = 0;
  nsCString all_mailboxes, mailboxes;
  const char *mailbox = 0;
  uint32_t count = 0;
  nsCOMPtr<nsIX509CertDB> certdb = do_GetService(NS_X509CERTDB_CONTRACTID);
  nsresult res;
  nsCOMPtr<nsIMsgHeaderParser> pHeader = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &res);
  NS_ENSURE_SUCCESS(res,res);

  mCerts = do_CreateInstance(NS_ARRAY_CONTRACTID, &res);
  if (NS_FAILED(res)) {
    return res;
  }

  PR_ASSERT(aEncrypt || aSign);
  certdb->FindEmailEncryptionCert(mEncryptionCertName, getter_AddRefs(mSelfEncryptionCert));
  certdb->FindEmailSigningCert(mSigningCertName, getter_AddRefs(mSelfSigningCert));

  // must have both the signing and encryption certs to sign
  if ((mSelfSigningCert == nullptr) && aSign) {
    SetError(sendReport, NS_LITERAL_STRING("NoSenderSigningCert").get());
    res = NS_ERROR_FAILURE;
    goto FAIL;
  }

  if ((mSelfEncryptionCert == nullptr) && aEncrypt) {
    SetError(sendReport, NS_LITERAL_STRING("NoSenderEncryptionCert").get());
    res = NS_ERROR_FAILURE;
    goto FAIL;
  }

  pHeader->ExtractHeaderAddressMailboxes(nsDependentCString(aRecipients),
                                         all_mailboxes);
  pHeader->RemoveDuplicateAddresses(all_mailboxes, EmptyCString(), mailboxes);

  pHeader->ParseHeaderAddresses(mailboxes.get(), 0, &mailbox_list, &count);

  // XXX This is not a valid use of nsresult
  if (count < 0) return static_cast<nsresult>(count);

  if (aEncrypt && mSelfEncryptionCert) {
    // Make sure self's configured cert is prepared for being used
    // as an email recipient cert.
    
    nsCOMPtr<nsISMimeCert> sc = do_QueryInterface(mSelfEncryptionCert);
    if (sc) {
      sc->SaveSMimeProfile();
    }
  }

  /* If the message is to be encrypted, then get the recipient certs */
  if (aEncrypt) {
    mailbox = mailbox_list;

    bool already_added_self_cert = false;

    for (; count > 0; count--) {
      nsCString mailbox_lowercase;
      ToLowerCase(nsDependentCString(mailbox), mailbox_lowercase);
      nsCOMPtr<nsIX509Cert> cert;
      res = certdb->FindCertByEmailAddress(nullptr, mailbox_lowercase.get(),
                                           getter_AddRefs(cert));
      if (NS_FAILED(res)) {
        // Failure to find a valid encryption cert is fatal.
        // Here I assume that mailbox is ascii rather than utf8.
        SetErrorWithParam(sendReport,
                          NS_LITERAL_STRING("MissingRecipientEncryptionCert").get(),
                          mailbox);

        goto FAIL;
      }

    /* #### see if recipient requests `signedData'.
     if (...) no_clearsigning_p = true;
     (This is the only reason we even bother looking up the certs
     of the recipients if we're sending a signed-but-not-encrypted
     message.)
     */

      bool isSame;
      if (NS_SUCCEEDED(cert->Equals(mSelfEncryptionCert, &isSame))
          && isSame) {
        already_added_self_cert = true;
      }

      mCerts->AppendElement(cert, false);
      // To understand this loop, especially the "+= strlen +1", look at the documentation
      // of ParseHeaderAddresses. Basically, it returns a list of zero terminated strings.
      mailbox += strlen(mailbox) + 1;
    }
    
    if (!already_added_self_cert) {
      mCerts->AppendElement(mSelfEncryptionCert, false);
    }
  }
FAIL:
  if (mailbox_list) {
    nsMemory::Free(mailbox_list);
  }
  return res;
}

NS_IMETHODIMP nsMsgComposeSecure::MimeCryptoWriteBlock (const char *buf, int32_t size)
{
  int status = 0;
  nsresult rv;

  /* If this is a From line, mangle it before signing it.  You just know
   that something somewhere is going to mangle it later, and that's
   going to cause the signature check to fail.

   (This assumes that, in the cases where From-mangling must happen,
   this function is called a line at a time.  That happens to be the
   case.)
  */
  if (size >= 5 && buf[0] == 'F' && !strncmp(buf, "From ", 5)) {
    char mangle[] = ">";
    nsresult res = MimeCryptoWriteBlock (mangle, 1);
    if (NS_FAILED(res))
      return res;
    // This value will actually be cast back to an nsresult before use, so this
    // cast is reasonable under the circumstances.
    status = static_cast<int>(res);
  }

  /* If we're signing, or signing-and-encrypting, feed this data into
   the computation of the hash. */
  if (mDataHash) {
    PR_SetError(0,0);
    mDataHash->Update((const uint8_t*) buf, size);
	  status = PR_GetError();
	  if (status < 0) goto FAIL;
	}

  PR_SetError(0,0);
  if (mEncryptionContext) {
	  /* If we're encrypting, or signing-and-encrypting, write this data
		 by filtering it through the crypto library. */

    /* We want to create equally sized encryption strings */
    const char *inputBytesIterator = buf;
    uint32_t inputBytesLeft = size;

    while (inputBytesLeft) {
      const uint32_t spaceLeftInBuffer = eBufferSize - mBufferedBytes;
      const uint32_t bytesToAppend = std::min(inputBytesLeft, spaceLeftInBuffer);

      memcpy(mBuffer+mBufferedBytes, inputBytesIterator, bytesToAppend);
      mBufferedBytes += bytesToAppend;
      
      inputBytesIterator += bytesToAppend;
      inputBytesLeft -= bytesToAppend;

      if (eBufferSize == mBufferedBytes) {
        rv = mEncryptionContext->Update(mBuffer, mBufferedBytes);
        mBufferedBytes = 0;
        if (NS_FAILED(rv)) {
          status = PR_GetError();
          PR_ASSERT(status < 0);
          if (status >= 0) status = -1;
          goto FAIL;
        }
      }
    }
  } else {
	  /* If we're not encrypting (presumably just signing) then write this
		 data directly to the file. */

    uint32_t n;
    rv = mStream->Write(buf, size, &n);
    if (NS_FAILED(rv) || n < size) {
      // XXX MK_MIME_ERROR_WRITING_FILE is -1, which is not a valid nsresult
      return static_cast<nsresult>(MK_MIME_ERROR_WRITING_FILE);
    }
  }
 FAIL:
  // XXX status sometimes has invalid nsresults like -1 or PR_GetError()
  // assigned to it
  return static_cast<nsresult>(status);
}

/* Returns a string consisting of a Content-Type header, and a boundary
   string, suitable for moving from the header block, down into the body
   of a multipart object.  The boundary itself is also returned (so that
   the caller knows what to write to close it off.)
 */
static nsresult
make_multipart_signed_header_string(bool outer_p,
									char **header_return,
									char **boundary_return)
{
  *header_return = 0;
  *boundary_return = mime_make_separator("ms");

  if (!*boundary_return)
	return NS_ERROR_OUT_OF_MEMORY;

  *header_return = PR_smprintf(
        "Content-Type: " MULTIPART_SIGNED "; "
        "protocol=\"" APPLICATION_PKCS7_SIGNATURE "\"; "
				"micalg=" PARAM_MICALG_SHA1 "; "
				"boundary=\"%s\"" CRLF
				CRLF
				"%s%s"
				"--%s" CRLF,

				*boundary_return,
				(outer_p ? crypto_multipart_blurb : ""),
				(outer_p ? CRLF CRLF : ""),
				*boundary_return);

  if (!*header_return) {
	  PR_Free(*boundary_return);
	  *boundary_return = 0;
	  return NS_ERROR_OUT_OF_MEMORY;
	}

  return NS_OK;
}

/* Used as the output function of a SEC_PKCS7EncoderContext -- we feed
   plaintext into the crypto engine, and it calls this function with encrypted
   data; then this function writes a base64-encoded representation of that
   data to the file (by filtering it through the given MimeEncoder object.)

   Also used as the output function of SEC_PKCS7Encode() -- but in that case,
   it's used to write the encoded representation of the signature.  The only
   difference is which MimeEncoder object is used.
 */
static void
mime_crypto_write_base64 (void *closure, const char *buf, unsigned long size)
{
  MimeEncoder *encoder = (MimeEncoder *) closure;
  nsresult rv = encoder->Write(buf, size);
  PR_SetError(NS_FAILED(rv) ? static_cast<uint32_t>(rv) : 0, 0);
}


/* Used as the output function of MimeEncoder -- when we have generated
   the signature for a multipart/signed object, this is used to write the
   base64-encoded representation of the signature to the file.
 */
nsresult mime_encoder_output_fn(const char *buf, int32_t size, void *closure)
{
  nsMsgComposeSecure *state = (nsMsgComposeSecure *) closure;
  nsCOMPtr<nsIOutputStream> stream;
  state->GetOutputStream(getter_AddRefs(stream));
  uint32_t n;
  nsresult rv = stream->Write((char *) buf, size, &n);
  if (NS_FAILED(rv) || n < size)
    return NS_ERROR_FAILURE;
  else
    return NS_OK;
}

/* Like mime_encoder_output_fn, except this is used for the case where we
   are both signing and encrypting -- the base64-encoded output of the
   signature should be fed into the crypto engine, rather than being written
   directly to the file.
 */
static nsresult
mime_nested_encoder_output_fn (const char *buf, int32_t size, void *closure)
{
  nsMsgComposeSecure *state = (nsMsgComposeSecure *) closure;
  return state->MimeCryptoWriteBlock((char *) buf, size);
}
