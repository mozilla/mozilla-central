/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nspr.h"
#include "nsSMimeJSHelper.h"
#include "nsCOMPtr.h"
#include "nsMemory.h"
#include "nsStringGlue.h"
#include "nsIMsgHeaderParser.h"
#include "nsIX509CertDB.h"
#include "nsIX509CertValidity.h"
#include "nsIServiceManager.h"
#include "nsServiceManagerUtils.h"
#include "nsCRTGlue.h"

NS_IMPL_ISUPPORTS1(nsSMimeJSHelper, nsISMimeJSHelper)

nsSMimeJSHelper::nsSMimeJSHelper()
{
}

nsSMimeJSHelper::~nsSMimeJSHelper()
{
}

NS_IMETHODIMP nsSMimeJSHelper::GetRecipientCertsInfo(
    nsIMsgCompFields *compFields,
    uint32_t *count,
    PRUnichar ***emailAddresses,
    int32_t **certVerification,
    PRUnichar ***certIssuedInfos,
    PRUnichar ***certExpiresInfos,
    nsIX509Cert ***certs,
    bool *canEncrypt)
{
  NS_ENSURE_ARG_POINTER(count);
  *count = 0;

  NS_ENSURE_ARG_POINTER(emailAddresses);
  NS_ENSURE_ARG_POINTER(certVerification);
  NS_ENSURE_ARG_POINTER(certIssuedInfos);
  NS_ENSURE_ARG_POINTER(certExpiresInfos);
  NS_ENSURE_ARG_POINTER(certs);
  NS_ENSURE_ARG_POINTER(canEncrypt);

  NS_ENSURE_ARG_POINTER(compFields);

  uint32_t mailbox_count;
  char *mailbox_list;

  nsresult rv = getMailboxList(compFields, &mailbox_count, &mailbox_list);
  if (NS_FAILED(rv))
    return rv;

  if (!mailbox_list)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIX509CertDB> certdb = do_GetService(NS_X509CERTDB_CONTRACTID);

  *count = mailbox_count;
  *canEncrypt = false;
  rv = NS_OK;

  if (mailbox_count)
  {
    PRUnichar **outEA = static_cast<PRUnichar **>(nsMemory::Alloc(mailbox_count * sizeof(PRUnichar *)));
    int32_t *outCV = static_cast<int32_t *>(nsMemory::Alloc(mailbox_count * sizeof(int32_t)));
    PRUnichar **outCII = static_cast<PRUnichar **>(nsMemory::Alloc(mailbox_count * sizeof(PRUnichar *)));
    PRUnichar **outCEI = static_cast<PRUnichar **>(nsMemory::Alloc(mailbox_count * sizeof(PRUnichar *)));
    nsIX509Cert **outCerts = static_cast<nsIX509Cert **>(nsMemory::Alloc(mailbox_count * sizeof(nsIX509Cert *)));

    if (!outEA || !outCV || !outCII || !outCEI || !outCerts)
    {
      nsMemory::Free(outEA);
      nsMemory::Free(outCV);
      nsMemory::Free(outCII);
      nsMemory::Free(outCEI);
      nsMemory::Free(outCerts);
      rv = NS_ERROR_OUT_OF_MEMORY;
    }
    else
    {
      PRUnichar **iEA = outEA;
      int32_t *iCV = outCV;
      PRUnichar **iCII = outCII;
      PRUnichar **iCEI = outCEI;
      nsIX509Cert **iCert = outCerts;

      bool found_blocker = false;
      bool memory_failure = false;

      const char *walk = mailbox_list;

      // To understand this loop, especially the "+= strlen +1", look at the documentation
      // of ParseHeaderAddresses. Basically, it returns a list of zero terminated strings.
      for (uint32_t i = 0;
          i < mailbox_count;
          ++i, ++iEA, ++iCV, ++iCII, ++iCEI, ++iCert, walk += strlen(walk) + 1)
      {
        *iCert = nullptr;
        *iCV = 0;
        *iCII = nullptr;
        *iCEI = nullptr;

        if (memory_failure) {
          *iEA = nullptr;
          continue;
        }

        nsDependentCString email(walk);
        *iEA = ToNewUnicode(NS_ConvertUTF8toUTF16(walk));
        if (!*iEA) {
          memory_failure = true;
          continue;
        }

        nsCString email_lowercase;
        ToLowerCase(email, email_lowercase);

        nsCOMPtr<nsIX509Cert> cert;
        if (NS_SUCCEEDED(certdb->FindCertByEmailAddress(nullptr, email_lowercase.get(), getter_AddRefs(cert)))
            && cert)
        {
          *iCert = cert;
          NS_ADDREF(*iCert);

          uint32_t verification_result;

          if (NS_FAILED(
              cert->VerifyForUsage(nsIX509Cert::CERT_USAGE_EmailRecipient, &verification_result)))
          {
            *iCV = nsIX509Cert::NOT_VERIFIED_UNKNOWN;
            found_blocker = true;
          }
          else
          {
            *iCV = verification_result;

            if (verification_result != nsIX509Cert::VERIFIED_OK)
            {
              found_blocker = true;
            }
          }

          nsCOMPtr<nsIX509CertValidity> validity;
          rv = cert->GetValidity(getter_AddRefs(validity));

          if (NS_SUCCEEDED(rv)) {
            nsString id, ed;

            if (NS_SUCCEEDED(validity->GetNotBeforeLocalDay(id)))
            {
              *iCII = ToNewUnicode(id);
              if (!*iCII) {
                memory_failure = true;
                continue;
              }
            }

            if (NS_SUCCEEDED(validity->GetNotAfterLocalDay(ed)))
            {
              *iCEI = ToNewUnicode(ed);
              if (!*iCEI) {
                memory_failure = true;
                continue;
              }
            }
          }
        }
        else
        {
          found_blocker = true;
        }
      }

      if (memory_failure) {
        NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(mailbox_count, outEA);
        NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(mailbox_count, outCII);
        NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(mailbox_count, outCEI);
        NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(mailbox_count, outCerts);
        nsMemory::Free(outCV);
        rv = NS_ERROR_OUT_OF_MEMORY;
      }
      else {
        if (mailbox_count > 0 && !found_blocker)
        {
          *canEncrypt = true;
        }

        *emailAddresses = outEA;
        *certVerification = outCV;
        *certIssuedInfos = outCII;
        *certExpiresInfos = outCEI;
        *certs = outCerts;
      }
    }
  }

  if (mailbox_list) {
    nsMemory::Free(mailbox_list);
  }
  return rv;
}

NS_IMETHODIMP nsSMimeJSHelper::GetNoCertAddresses(
    nsIMsgCompFields *compFields,
    uint32_t *count,
    PRUnichar ***emailAddresses)
{
  NS_ENSURE_ARG_POINTER(count);
  *count = 0;

  NS_ENSURE_ARG_POINTER(emailAddresses);

  NS_ENSURE_ARG_POINTER(compFields);

  uint32_t mailbox_count;
  char *mailbox_list;

  nsresult rv = getMailboxList(compFields, &mailbox_count, &mailbox_list);
  if (NS_FAILED(rv))
    return rv;

  if (!mailbox_list)
    return NS_ERROR_FAILURE;

  if (!mailbox_count)
  {
    *count = 0;
    *emailAddresses = nullptr;
    if (mailbox_list) {
      nsMemory::Free(mailbox_list);
    }
    return NS_OK;
  }

  nsCOMPtr<nsIX509CertDB> certdb = do_GetService(NS_X509CERTDB_CONTRACTID);

  uint32_t missing_count = 0;
  bool *haveCert = new bool[mailbox_count];
  if (!haveCert)
  {
    if (mailbox_list) {
      nsMemory::Free(mailbox_list);
    }
    return NS_ERROR_OUT_OF_MEMORY;
  }

  rv = NS_OK;

  if (mailbox_count)
  {
    const char *walk = mailbox_list;

    // To understand this loop, especially the "+= strlen +1", look at the documentation
    // of ParseHeaderAddresses. Basically, it returns a list of zero terminated strings.
    for (uint32_t i = 0;
        i < mailbox_count;
        ++i, walk += strlen(walk) + 1)
    {
      haveCert[i] = false;

      nsDependentCString email(walk);
      nsCString email_lowercase;
      ToLowerCase(email, email_lowercase);

      nsCOMPtr<nsIX509Cert> cert;
      if (NS_SUCCEEDED(certdb->FindCertByEmailAddress(nullptr, email_lowercase.get(), getter_AddRefs(cert)))
          && cert)
      {
        uint32_t verification_result;

        if (NS_SUCCEEDED(
              cert->VerifyForUsage(nsIX509Cert::CERT_USAGE_EmailRecipient, &verification_result))
            &&
            nsIX509Cert::VERIFIED_OK == verification_result)
        {
          haveCert[i] = true;
        }
      }

      if (!haveCert[i])
        ++missing_count;
    }
  }

  *count = missing_count;

  if (missing_count)
  {
    PRUnichar **outEA = static_cast<PRUnichar **>(nsMemory::Alloc(missing_count * sizeof(PRUnichar *)));
    if (!outEA )
    {
      rv = NS_ERROR_OUT_OF_MEMORY;
    }
    else
    {
      PRUnichar **iEA = outEA;
      const char *walk = mailbox_list;

      bool memory_failure = false;

      // To understand this loop, especially the "+= strlen +1", look at the documentation
      // of ParseHeaderAddresses. Basically, it returns a list of zero terminated strings.
      for (uint32_t i = 0;
          i < mailbox_count;
          ++i, walk += strlen(walk) + 1)
      {
        if (!haveCert[i])
        {
          if (memory_failure) {
            *iEA = nullptr;
          }
          else {
            *iEA = ToNewUnicode(NS_ConvertUTF8toUTF16(walk));
            if (!*iEA) {
              memory_failure = true;
            }
          }
          ++iEA;
        }
      }

      if (memory_failure) {
        NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(missing_count, outEA);
        rv = NS_ERROR_OUT_OF_MEMORY;
      }
      else {
        *emailAddresses = outEA;
      }
    }
  }
  else
  {
    *emailAddresses = nullptr;
  }

  delete [] haveCert;
  if (mailbox_list) {
    nsMemory::Free(mailbox_list);
  }
  return rv;
}

nsresult nsSMimeJSHelper::getMailboxList(nsIMsgCompFields *compFields, uint32_t *mailbox_count, char **mailbox_list)
{
  NS_ENSURE_ARG(mailbox_count);
  NS_ENSURE_ARG(mailbox_list);

  if (!compFields)
    return NS_ERROR_INVALID_ARG;

  nsresult res;
  nsCOMPtr<nsIMsgHeaderParser> parser = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &res);
  if (NS_FAILED(res))
    return res;

  nsString to, cc, bcc, ng;

  res = compFields->GetTo(to);
  if (NS_FAILED(res))
    return res;

  res = compFields->GetCc(cc);
  if (NS_FAILED(res))
    return res;

  res = compFields->GetBcc(bcc);
  if (NS_FAILED(res))
    return res;

  res = compFields->GetNewsgroups(ng);
  if (NS_FAILED(res))
    return res;

  *mailbox_list = nullptr;
  *mailbox_count = 0;

  {
    nsCString all_recipients;

    if (!to.IsEmpty()) {
      all_recipients.Append(NS_ConvertUTF16toUTF8(to));
      all_recipients.Append(',');
    }

    if (!cc.IsEmpty()) {
      all_recipients.Append(NS_ConvertUTF16toUTF8(cc));
      all_recipients.Append(',');
    }

    if (!bcc.IsEmpty()) {
      all_recipients.Append(NS_ConvertUTF16toUTF8(bcc));
      all_recipients.Append(',');
    }

    if (!ng.IsEmpty())
      all_recipients.Append(NS_ConvertUTF16toUTF8(ng));

    nsCString unique_mailboxes;
    nsCString all_mailboxes;
    parser->ExtractHeaderAddressMailboxes(all_recipients, all_mailboxes);
    parser->RemoveDuplicateAddresses(all_mailboxes, EmptyCString(),
                                     unique_mailboxes);
    parser->ParseHeaderAddresses(unique_mailboxes.get(), 0, mailbox_list,
                                 mailbox_count);
  }

  return NS_OK;
}
