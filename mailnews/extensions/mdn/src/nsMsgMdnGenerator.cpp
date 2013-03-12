/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgMdnGenerator.h"
#include "nsImapCore.h"
#include "nsIMsgImapMailFolder.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsMimeTypes.h"
#include "prprf.h"
#include "prmem.h"
#include "prsystem.h"
#include "nsMsgI18N.h"
#include "nsMailHeaders.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsIHttpProtocolHandler.h"
#include "nsISmtpService.h"  // for actually sending the message...
#include "nsMsgCompCID.h"
#include "nsComposeStrings.h"
#include "nsISmtpServer.h"
#include "nsIPrompt.h"
#include "nsIMsgHeaderParser.h"
#include "nsIMsgCompUtils.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIStringBundle.h"
#include "nsDirectoryServiceDefs.h"
#include "nsMsgUtils.h"
#include "nsNetUtil.h"
#include "nsIMsgDatabase.h"
#include "mozilla/Services.h"
#include "nsIArray.h"
#include "nsArrayUtils.h"

#define MDN_NOT_IN_TO_CC          ((int) 0x0001)
#define MDN_OUTSIDE_DOMAIN        ((int) 0x0002)

#define HEADER_RETURN_PATH          "Return-Path"
#define HEADER_DISPOSITION_NOTIFICATION_TO  "Disposition-Notification-To"
#define HEADER_APPARENTLY_TO        "Apparently-To"
#define HEADER_ORIGINAL_RECIPIENT     "Original-Recipient"
#define HEADER_REPORTING_UA                 "Reporting-UA"
#define HEADER_MDN_GATEWAY                  "MDN-Gateway"
#define HEADER_FINAL_RECIPIENT              "Final-Recipient"
#define HEADER_DISPOSITION                  "Disposition"
#define HEADER_ORIGINAL_MESSAGE_ID          "Original-Message-ID"
#define HEADER_FAILURE                      "Failure"
#define HEADER_ERROR                        "Error"
#define HEADER_WARNING                      "Warning"
#define HEADER_RETURN_RECEIPT_TO            "Return-Receipt-To"
#define HEADER_X_ACCEPT_LANGUAGE      "X-Accept-Language"

#define PUSH_N_FREE_STRING(p) \
  do { if (p) { rv = WriteString(p); PR_smprintf_free(p); p=0; \
           if (NS_FAILED(rv)) return rv; } \
     else { return NS_ERROR_OUT_OF_MEMORY; } } while (0)

// String bundle for mdn. Class static.
#define MDN_STRINGBUNDLE_URL "chrome://messenger/locale/msgmdn.properties"

#if defined(DEBUG_jefft)
#define DEBUG_MDN(s) printf("%s\n", s)
#else
#define DEBUG_MDN(s)
#endif

// machine parsible string; should not be localized
char DispositionTypes[7][16] = {
    "displayed",
    "dispatched",
    "processed",
    "deleted",
    "denied",
    "failed",
    ""
};

NS_IMPL_ISUPPORTS2(nsMsgMdnGenerator, nsIMsgMdnGenerator, nsIUrlListener)

nsMsgMdnGenerator::nsMsgMdnGenerator()
{
    m_disposeType = eDisplayed;
    m_outputStream = nullptr;
    m_reallySendMdn = false;
    m_autoSend = false;
    m_autoAction = false;
    m_mdnEnabled = false;
    m_notInToCcOp = eNeverSendOp;
    m_outsideDomainOp = eNeverSendOp;
    m_otherOp = eNeverSendOp;
}

nsMsgMdnGenerator::~nsMsgMdnGenerator()
{
}

nsresult nsMsgMdnGenerator::FormatStringFromName(const PRUnichar *aName,
                                                 const PRUnichar *aString,
                                                 PRUnichar **aResultString)
{
    DEBUG_MDN("nsMsgMdnGenerator::FormatStringFromName");

    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);

    nsCOMPtr <nsIStringBundle> bundle;
    nsresult rv = bundleService->CreateBundle(MDN_STRINGBUNDLE_URL,
                                              getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv,rv);

    const PRUnichar *formatStrings[1] = { aString };
    rv = bundle->FormatStringFromName(aName,
                    formatStrings, 1, aResultString);
    NS_ENSURE_SUCCESS(rv,rv);
    return rv;
}

nsresult nsMsgMdnGenerator::GetStringFromName(const PRUnichar *aName,
                                               PRUnichar **aResultString)
{
    DEBUG_MDN("nsMsgMdnGenerator::GetStringFromName");

    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);

    nsCOMPtr <nsIStringBundle> bundle;
    nsresult rv = bundleService->CreateBundle(MDN_STRINGBUNDLE_URL,
                                              getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = bundle->GetStringFromName(aName, aResultString);
    NS_ENSURE_SUCCESS(rv,rv);
    return rv;
}

nsresult nsMsgMdnGenerator::StoreMDNSentFlag(nsIMsgFolder *folder,
                                             nsMsgKey key)
{
    DEBUG_MDN("nsMsgMdnGenerator::StoreMDNSentFlag");

    nsCOMPtr<nsIMsgDatabase> msgDB;
    nsresult rv = folder->GetMsgDatabase(getter_AddRefs(msgDB));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = msgDB->MarkMDNSent(key, true, nullptr);

    nsCOMPtr<nsIMsgImapMailFolder> imapFolder = do_QueryInterface(folder);
    // Store the $MDNSent flag if the folder is an Imap Mail Folder
    if (imapFolder)
      return imapFolder->StoreImapFlags(kImapMsgMDNSentFlag, true, &key, 1, nullptr);
    return rv;
}

nsresult nsMsgMdnGenerator::ClearMDNNeededFlag(nsIMsgFolder *folder,
                                               nsMsgKey key)
{
  DEBUG_MDN("nsMsgMdnGenerator::ClearMDNNeededFlag");

  nsCOMPtr<nsIMsgDatabase> msgDB;
  nsresult rv = folder->GetMsgDatabase(getter_AddRefs(msgDB));
  NS_ENSURE_SUCCESS(rv, rv);
  return msgDB->MarkMDNNeeded(key, false, nullptr);
}

bool nsMsgMdnGenerator::ProcessSendMode()
{
    DEBUG_MDN("nsMsgMdnGenerator::ProcessSendMode");
    int32_t miscState = 0;

    if (m_identity)
    {
        m_identity->GetEmail(m_email);
        if (m_email.IsEmpty())
            return m_reallySendMdn;

        const char *accountDomain = strchr(m_email.get(), '@');
        if (!accountDomain)
            return m_reallySendMdn;

        if (MailAddrMatch(m_email.get(), m_dntRrt.get())) // return address is self, don't send
          return false;

        // *** fix me see Bug 132504 for more information
        // *** what if the message has been filtered to different account
        if (!PL_strcasestr(m_dntRrt.get(), accountDomain))
            miscState |= MDN_OUTSIDE_DOMAIN;
        if (NotInToOrCc())
            miscState |= MDN_NOT_IN_TO_CC;
        m_reallySendMdn = true;
        // *********
        // How are we gona deal with the auto forwarding issues? Some server
        // didn't bother to add addition header or modify existing header to
        // thev message when forwarding. They simply copy the exact same
        // message to another user's mailbox. Some change To: to
        // Apparently-To:
        // Unfortunately, there is nothing we can do. It's out of our control.
        // *********
        // starting from lowest denominator to highest
        if (!miscState)
        {   // under normal situation: recipent is in to and cc list,
            // and the sender is from the same domain
            switch (m_otherOp)
            {
            default:
            case eNeverSendOp:
                m_reallySendMdn = false;
                break;
            case eAutoSendOp:
                m_autoSend = true;
                break;
            case eAskMeOp:
                m_autoSend = false;
                break;
            case eDeniedOp:
                m_autoSend = true;
                m_disposeType = eDenied;
                break;
            }
        }
        else if (miscState == (MDN_OUTSIDE_DOMAIN | MDN_NOT_IN_TO_CC))
        {
            if (m_outsideDomainOp != m_notInToCcOp)
            {
                m_autoSend = false; // ambiguous; always ask user
            }
            else
            {
                switch (m_outsideDomainOp)
                {
                default:
                case eNeverSendOp:
                    m_reallySendMdn = false;
                    break;
                case eAutoSendOp:
                    m_autoSend = true;
                    break;
                case eAskMeOp:
                    m_autoSend = false;
                    break;
                }
            }
        }
        else if (miscState & MDN_OUTSIDE_DOMAIN)
        {
            switch (m_outsideDomainOp)
            {
            default:
            case eNeverSendOp:
                m_reallySendMdn = false;
                break;
            case eAutoSendOp:
                m_autoSend = true;
                break;
            case eAskMeOp:
                m_autoSend = false;
                break;
            }
        }
        else if (miscState & MDN_NOT_IN_TO_CC)
        {
            switch (m_notInToCcOp)
            {
            default:
            case eNeverSendOp:
                m_reallySendMdn = false;
                break;
            case eAutoSendOp:
                m_autoSend = true;
                break;
            case eAskMeOp:
                m_autoSend = false;
                break;
            }
        }
    }
    return m_reallySendMdn;
}

bool nsMsgMdnGenerator::MailAddrMatch(const char *addr1, const char *addr2)
{
    // Comparing two email addresses returns true if matched; local/account
    // part comparison is case sensitive; domain part comparison is case
    // insensitive
    DEBUG_MDN("nsMsgMdnGenerator::MailAddrMatch");
    bool isMatched = true;
    const char *atSign1 = nullptr, *atSign2 = nullptr;
    const char *lt = nullptr, *local1 = nullptr, *local2 = nullptr;
    const char *end1 = nullptr, *end2 = nullptr;

    if (!addr1 || !addr2)
        return false;

    lt = strchr(addr1, '<');
    local1 = !lt ? addr1 : lt+1;
    lt = strchr(addr2, '<');
    local2 = !lt ? addr2 : lt+1;
    end1 = strchr(local1, '>');
    if (!end1)
        end1 = addr1 + strlen(addr1);
    end2 = strchr(local2, '>');
    if (!end2)
        end2 = addr2 + strlen(addr2);
    atSign1 = strchr(local1, '@');
    atSign2 = strchr(local2, '@');
    if (!atSign1 || !atSign2 // ill formed addr spec
        || (atSign1 - local1) != (atSign2 - local2))
        isMatched = false;
    else if (strncmp(local1, local2, (atSign1-local1))) // case sensitive
        // compare for local part
        isMatched = false;
    else if ((end1 - atSign1) != (end2 - atSign2) ||
             PL_strncasecmp(atSign1, atSign2, (end1-atSign1))) // case
        // insensitive compare for domain part
        isMatched = false;
    return isMatched;
}

bool nsMsgMdnGenerator::NotInToOrCc()
{
    DEBUG_MDN("nsMsgMdnGenerator::NotInToOrCc");
    nsCString reply_to;
    nsCString to;
    nsCString cc;

    m_identity->GetReplyTo(reply_to);
    m_headers->ExtractHeader(HEADER_TO, true, to);
    m_headers->ExtractHeader(HEADER_CC, true, cc);

  // start with a simple check
  if ((!to.IsEmpty() && PL_strcasestr(to.get(), m_email.get())) ||
      (!cc.IsEmpty() && PL_strcasestr(cc.get(), m_email.get()))) {
      return false;
  }

  if ((!reply_to.IsEmpty() && !to.IsEmpty() && PL_strcasestr(to.get(), reply_to.get())) ||
      (!reply_to.IsEmpty() && !cc.IsEmpty() && PL_strcasestr(cc.get(), reply_to.get()))) {
      return false;
  }
  return true;
}

bool nsMsgMdnGenerator::ValidateReturnPath()
{
    DEBUG_MDN("nsMsgMdnGenerator::ValidateReturnPath");
    // ValidateReturnPath applies to Automatic Send Mode only. If we were not
    // in auto send mode we simply by passing the check
    if (!m_autoSend)
        return m_reallySendMdn;

    nsCString returnPath;
    m_headers->ExtractHeader(HEADER_RETURN_PATH, false, returnPath);
    if (returnPath.IsEmpty())
    {
      m_autoSend = false;
      return m_reallySendMdn;
    }
    m_autoSend = MailAddrMatch(returnPath.get(), m_dntRrt.get());
    return m_reallySendMdn;
}

nsresult nsMsgMdnGenerator::CreateMdnMsg()
{
    DEBUG_MDN("nsMsgMdnGenerator::CreateMdnMsg");
    nsresult rv;

    nsCOMPtr<nsIFile> tmpFile;
    rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
                                         "mdnmsg",
                                         getter_AddRefs(m_file));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = m_file->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = NS_NewLocalFileOutputStream(getter_AddRefs(m_outputStream),
                                     m_file,
                                     PR_CREATE_FILE | PR_WRONLY | PR_TRUNCATE,
                                     0664);
    NS_ASSERTION(NS_SUCCEEDED(rv),"creating mdn: failed to output stream");
    if (NS_FAILED(rv))
        return NS_OK;

    rv = CreateFirstPart();
    if (NS_SUCCEEDED(rv))
    {
        rv = CreateSecondPart();
        if (NS_SUCCEEDED(rv))
            rv = CreateThirdPart();
    }

    if (m_outputStream)
    {
        m_outputStream->Flush();
        m_outputStream->Close();
    }
    if (NS_FAILED(rv))
        m_file->Remove(false);
    else
        rv = SendMdnMsg();

    return NS_OK;
}

nsresult nsMsgMdnGenerator::CreateFirstPart()
{
    DEBUG_MDN("nsMsgMdnGenerator::CreateFirstPart");
    char *convbuf = nullptr, *tmpBuffer = nullptr;
    char *parm = nullptr;
    nsString firstPart1;
    nsString firstPart2;
    nsresult rv = NS_OK;
    nsCOMPtr <nsIMsgCompUtils> compUtils;

    if (m_mimeSeparator.IsEmpty())
    {
      compUtils = do_GetService(NS_MSGCOMPUTILS_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      rv = compUtils->MimeMakeSeparator("mdn", getter_Copies(m_mimeSeparator));
      NS_ENSURE_SUCCESS(rv, rv);
    }
    if (m_mimeSeparator.IsEmpty())
      return NS_ERROR_OUT_OF_MEMORY;

    tmpBuffer = (char *) PR_CALLOC(256);

    if (!tmpBuffer)
        return NS_ERROR_OUT_OF_MEMORY;

    PRExplodedTime now;
    PR_ExplodeTime(PR_Now(), PR_LocalTimeParameters, &now);

    int gmtoffset = (now.tm_params.tp_gmt_offset + now.tm_params.tp_dst_offset)
        / 60;
  /* Use PR_FormatTimeUSEnglish() to format the date in US English format,
     then figure out what our local GMT offset is, and append it (since
     PR_FormatTimeUSEnglish() can't do that.) Generate four digit years as
     per RFC 1123 (superceding RFC 822.)
  */
    PR_FormatTimeUSEnglish(tmpBuffer, 100,
                           "Date: %a, %d %b %Y %H:%M:%S ",
                           &now);

    PR_snprintf(tmpBuffer + strlen(tmpBuffer), 100,
                "%c%02d%02d" CRLF,
                (gmtoffset >= 0 ? '+' : '-'),
                ((gmtoffset >= 0 ? gmtoffset : -gmtoffset) / 60),
                ((gmtoffset >= 0 ? gmtoffset : -gmtoffset) % 60));

    rv = WriteString(tmpBuffer);
    PR_Free(tmpBuffer);
    if (NS_FAILED(rv))
        return rv;

    bool conformToStandard = false;
    if (compUtils)
      compUtils->GetMsgMimeConformToStandard(&conformToStandard);

    nsString fullName;
    m_identity->GetFullName(fullName);

    nsCString fullAddress;
    nsCOMPtr<nsIMsgHeaderParser> parser (do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID));
    if (parser)
    {
        // convert fullName to UTF8 before passing it to MakeFullAddressString
        parser->MakeFullAddressString(NS_ConvertUTF16toUTF8(fullName).get(),
                                      m_email.get(), getter_Copies(fullAddress));
    }

    convbuf = nsMsgI18NEncodeMimePartIIStr(
        (!fullAddress.IsEmpty()) ? fullAddress.get(): m_email.get(),
        true, m_charset.get(), 0, conformToStandard);

    parm = PR_smprintf("From: %s" CRLF, convbuf ? convbuf : m_email.get());

    rv = FormatStringFromName(NS_LITERAL_STRING("MsgMdnMsgSentTo").get(), NS_ConvertASCIItoUTF16(m_email).get(),
                            getter_Copies(firstPart1));
    if (NS_FAILED(rv))
        return rv;

    PUSH_N_FREE_STRING (parm);

    PR_Free(convbuf);

    if (compUtils)
    {
      nsCString msgId;
      rv = compUtils->MsgGenerateMessageId(m_identity, getter_Copies(msgId));
      tmpBuffer = PR_smprintf("Message-ID: %s" CRLF, msgId.get());
      PUSH_N_FREE_STRING(tmpBuffer);
    }

    nsString receipt_string;
    switch (m_disposeType)
    {
    case nsIMsgMdnGenerator::eDisplayed:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MdnDisplayedReceipt").get(),
            getter_Copies(receipt_string));
        break;
    case nsIMsgMdnGenerator::eDispatched:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MdnDispatchedReceipt").get(),
            getter_Copies(receipt_string));
        break;
    case nsIMsgMdnGenerator::eProcessed:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MdnProcessedReceipt").get(),
            getter_Copies(receipt_string));
        break;
    case nsIMsgMdnGenerator::eDeleted:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MdnDeletedReceipt").get(),
            getter_Copies(receipt_string));
        break;
    case nsIMsgMdnGenerator::eDenied:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MdnDeniedReceipt").get(),
            getter_Copies(receipt_string));
        break;
    case nsIMsgMdnGenerator::eFailed:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MdnFailedReceipt").get(),
            getter_Copies(receipt_string));
        break;
    default:
        rv = NS_ERROR_INVALID_ARG;
        break;
    }

    if (NS_FAILED(rv))
        return rv;

    receipt_string.AppendLiteral(" - ");

    char * encodedReceiptString = nsMsgI18NEncodeMimePartIIStr(NS_ConvertUTF16toUTF8(receipt_string).get(), false,
                                                               "UTF-8", 0, conformToStandard);

    nsCString subject;
    m_headers->ExtractHeader(HEADER_SUBJECT, false, subject);
    convbuf = nsMsgI18NEncodeMimePartIIStr(subject.Length() ? subject.get() : "[no subject]",
                                           false, m_charset.get(), 0, conformToStandard);
    tmpBuffer = PR_smprintf("Subject: %s%s" CRLF,
                             encodedReceiptString,
                            (convbuf ? convbuf : (subject.Length() ? subject.get() :
                              "[no subject]")));

    PUSH_N_FREE_STRING(tmpBuffer);
    PR_Free(convbuf);
    PR_Free(encodedReceiptString);

    convbuf = nsMsgI18NEncodeMimePartIIStr(m_dntRrt.get(), true, m_charset.get(), 0, conformToStandard);
    tmpBuffer = PR_smprintf("To: %s" CRLF, convbuf ? convbuf :
                            m_dntRrt.get());
    PUSH_N_FREE_STRING(tmpBuffer);

    PR_Free(convbuf);

  // *** This is not in the spec. I am adding this so we could do
  // threading
    m_headers->ExtractHeader(HEADER_MESSAGE_ID, false, m_messageId);

    if (!m_messageId.IsEmpty())
    {
      if (*m_messageId.get() == '<')
          tmpBuffer = PR_smprintf("References: %s" CRLF, m_messageId.get());
      else
          tmpBuffer = PR_smprintf("References: <%s>" CRLF, m_messageId.get());
      PUSH_N_FREE_STRING(tmpBuffer);
    }
    tmpBuffer = PR_smprintf("%s" CRLF, "MIME-Version: 1.0");
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("Content-Type: multipart/report; \
report-type=disposition-notification;\r\n\tboundary=\"%s\"" CRLF CRLF,
                            m_mimeSeparator.get());
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("--%s" CRLF, m_mimeSeparator.get());
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("Content-Type: text/plain; charset=UTF-8" CRLF);
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("Content-Transfer-Encoding: %s" CRLF CRLF,
                            ENCODING_8BIT);
    PUSH_N_FREE_STRING(tmpBuffer);

    if (!firstPart1.IsEmpty())
    {
        tmpBuffer = PR_smprintf("%s" CRLF CRLF, NS_ConvertUTF16toUTF8(firstPart1).get());
        PUSH_N_FREE_STRING(tmpBuffer);
    }

    switch (m_disposeType)
    {
    case nsIMsgMdnGenerator::eDisplayed:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MsgMdnDisplayed").get(),
            getter_Copies(firstPart2));
        break;
    case nsIMsgMdnGenerator::eDispatched:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MsgMdnDispatched").get(),
            getter_Copies(firstPart2));
        break;
    case nsIMsgMdnGenerator::eProcessed:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MsgMdnProcessed").get(),
            getter_Copies(firstPart2));
        break;
    case nsIMsgMdnGenerator::eDeleted:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MsgMdnDeleted").get(),
            getter_Copies(firstPart2));
        break;
    case nsIMsgMdnGenerator::eDenied:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MsgMdnDenied").get(),
            getter_Copies(firstPart2));
        break;
    case nsIMsgMdnGenerator::eFailed:
        rv = GetStringFromName(
            NS_LITERAL_STRING("MsgMdnFailed").get(),
            getter_Copies(firstPart2));
        break;
    default:
        rv = NS_ERROR_INVALID_ARG;
        break;
    }

    if (NS_FAILED(rv))
        return rv;

    if (!firstPart2.IsEmpty())
    {
        tmpBuffer =
            PR_smprintf("%s" CRLF CRLF,
                        NS_ConvertUTF16toUTF8(firstPart2).get());
        PUSH_N_FREE_STRING(tmpBuffer);
    }

    return rv;
}

nsresult nsMsgMdnGenerator::CreateSecondPart()
{
    DEBUG_MDN("nsMsgMdnGenerator::CreateSecondPart");
    char *tmpBuffer = nullptr;
    char *convbuf = nullptr;
    nsresult rv = NS_OK;
    nsCOMPtr <nsIMsgCompUtils> compUtils;
    bool conformToStandard = false;

    tmpBuffer = PR_smprintf("--%s" CRLF, m_mimeSeparator.get());
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("%s" CRLF, "Content-Type: message/disposition-notification; name=\042MDNPart2.txt\042");
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("%s" CRLF, "Content-Disposition: inline");
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("Content-Transfer-Encoding: %s" CRLF CRLF,
                            ENCODING_7BIT);
    PUSH_N_FREE_STRING(tmpBuffer);

    nsCOMPtr<nsIHttpProtocolHandler> pHTTPHandler =
        do_GetService(NS_NETWORK_PROTOCOL_CONTRACTID_PREFIX "http", &rv);
    if (NS_SUCCEEDED(rv) && pHTTPHandler)
    {
      nsAutoCString userAgentString;
      pHTTPHandler->GetUserAgent(userAgentString);

      if (!userAgentString.IsEmpty())
      {
        // Prepend the product name with the dns name according to RFC 3798.
        char hostName[256];
        PR_GetSystemInfo(PR_SI_HOSTNAME_UNTRUNCATED, hostName, sizeof hostName);
        if ((hostName[0] != '\0') && (strchr(hostName, '.') != NULL))
        {
          userAgentString.Insert("; ", 0);
          userAgentString.Insert(nsDependentCString(hostName), 0);
        }

        tmpBuffer = PR_smprintf("Reporting-UA: %s" CRLF,
                                userAgentString.get());
        PUSH_N_FREE_STRING(tmpBuffer);
      }
    }

    nsCString originalRecipient;
    m_headers->ExtractHeader(HEADER_ORIGINAL_RECIPIENT, false,
                             originalRecipient);

    if (!originalRecipient.IsEmpty())
    {
        tmpBuffer = PR_smprintf("Original-Recipient: %s" CRLF,
                                originalRecipient.get());
        PUSH_N_FREE_STRING(tmpBuffer);
    }

    compUtils = do_GetService(NS_MSGCOMPUTILS_CONTRACTID, &rv);
    if (compUtils)
      compUtils->GetMsgMimeConformToStandard(&conformToStandard);

    convbuf = nsMsgI18NEncodeMimePartIIStr(
        m_email.get(), true, m_charset.get(), 0,
        conformToStandard);
    tmpBuffer = PR_smprintf("Final-Recipient: rfc822;%s" CRLF, convbuf ?
                            convbuf : m_email.get());
    PUSH_N_FREE_STRING(tmpBuffer);

    PR_Free (convbuf);

    if (*m_messageId.get() == '<')
        tmpBuffer = PR_smprintf("Original-Message-ID: %s" CRLF, m_messageId.get());
    else
        tmpBuffer = PR_smprintf("Original-Message-ID: <%s>" CRLF, m_messageId.get());
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("Disposition: %s/%s; %s" CRLF CRLF,
                            (m_autoAction ? "automatic-action" :
                             "manual-action"),
                            (m_autoSend ? "MDN-sent-automatically" :
                             "MDN-sent-manually"),
                            DispositionTypes[(int) m_disposeType]);
    PUSH_N_FREE_STRING(tmpBuffer);

    return rv;
}

nsresult nsMsgMdnGenerator::CreateThirdPart()
{
    DEBUG_MDN("nsMsgMdnGenerator::CreateThirdPart");
    char *tmpBuffer = nullptr;
    nsresult rv = NS_OK;

    tmpBuffer = PR_smprintf("--%s" CRLF, m_mimeSeparator.get());
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("%s" CRLF, "Content-Type: text/rfc822-headers; name=\042MDNPart3.txt\042");
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("%s" CRLF, "Content-Transfer-Encoding: 7bit");
    PUSH_N_FREE_STRING(tmpBuffer);

    tmpBuffer = PR_smprintf("%s" CRLF CRLF, "Content-Disposition: inline");
    PUSH_N_FREE_STRING(tmpBuffer);

    rv = OutputAllHeaders();

    if (NS_FAILED(rv))
        return rv;

    rv = WriteString(CRLF);
    if (NS_FAILED(rv))
        return rv;

    tmpBuffer = PR_smprintf("--%s--" CRLF, m_mimeSeparator.get());
    PUSH_N_FREE_STRING(tmpBuffer);

    return rv;
}


nsresult nsMsgMdnGenerator::OutputAllHeaders()
{
    DEBUG_MDN("nsMsgMdnGenerator::OutputAllHeaders");
    nsCString all_headers;
    int32_t all_headers_size = 0;
    nsresult rv = NS_OK;

    rv = m_headers->GetAllHeaders(all_headers);
    if (NS_FAILED(rv))
        return rv;
    all_headers_size = all_headers.Length();
    char *buf = (char *) all_headers.get(),
        *buf_end = (char *) all_headers.get()+all_headers_size;
    char *start = buf, *end = buf;

    while (buf < buf_end)
    {
        switch (*buf)
        {
        case 0:
            if (*(buf+1) == '\n')
            {
                // *buf = '\r';
                end = buf;
            }
            else if (*(buf+1) == 0)
            {
                // the case of message id
                *buf = '>';
            }
            break;
        case '\r':
            end = buf;
            *buf = 0;
            break;
        case '\n':
            if (buf > start && *(buf-1) == 0)
            {
                start = buf + 1;
                end = start;
            }
            else
            {
                end = buf;
            }
            *buf = 0;
            break;
        default:
            break;
        }
        buf++;

        if (end > start && *end == 0)
        {
            // strip out private X-Mozilla-Status header & X-Mozilla-Draft-Info && envelope header
            if (!PL_strncasecmp(start, X_MOZILLA_STATUS, X_MOZILLA_STATUS_LEN)
                || !PL_strncasecmp(start, X_MOZILLA_DRAFT_INFO, X_MOZILLA_DRAFT_INFO_LEN)
                || !PL_strncasecmp(start, "From ", 5))
            {
                while ( end < buf_end &&
                        (*end == '\n' || *end == '\r' || *end == 0))
                    end++;
                start = end;
            }
            else
            {
                NS_ASSERTION (*end == 0, "content of end should be null");
                rv = WriteString(start);
                if (NS_FAILED(rv))
                    return rv;
                rv = WriteString(CRLF);
                while ( end < buf_end &&
                        (*end == '\n' || *end == '\r' || *end == 0))
                    end++;
                start = end;
            }
            buf = start;
        }
    }
    return NS_OK;
}

nsresult nsMsgMdnGenerator::SendMdnMsg()
{
    DEBUG_MDN("nsMsgMdnGenerator::SendMdnMsg");
    nsresult rv;
    nsCOMPtr<nsISmtpService> smtpService = do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsIRequest> aRequest;
    smtpService->SendMailMessage(m_file, m_dntRrt.get(), m_identity,
                                     nullptr, this, nullptr, nullptr, false, nullptr,
                                     getter_AddRefs(aRequest));

    return NS_OK;
}

nsresult nsMsgMdnGenerator::WriteString( const char *str )
{
  NS_ENSURE_ARG (str);
  uint32_t len = strlen(str);
  uint32_t wLen = 0;

  return m_outputStream->Write(str, len, &wLen);
}

nsresult nsMsgMdnGenerator::InitAndProcess(bool *needToAskUser)
{
    DEBUG_MDN("nsMsgMdnGenerator::InitAndProcess");
    nsresult rv = m_folder->GetServer(getter_AddRefs(m_server));
    nsCOMPtr<nsIMsgAccountManager> accountManager =
        do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    if (accountManager && m_server)
    {
        if (!m_identity)
        {
          // check if this is a message delivered to the global inbox,
          // in which case we find the originating account's identity.
          nsCString accountKey;
          m_headers->ExtractHeader(HEADER_X_MOZILLA_ACCOUNT_KEY, false,
                                   accountKey);
          nsCOMPtr <nsIMsgAccount> account;
          if (!accountKey.IsEmpty())
            accountManager->GetAccount(accountKey, getter_AddRefs(account));
          if (account)
            account->GetIncomingServer(getter_AddRefs(m_server));

          if (m_server)
          {
            // Find the correct identity based on the "To:" and "Cc:" header
            nsCString mailTo;
            nsCString mailCC;
            m_headers->ExtractHeader(HEADER_TO, true, mailTo);
            m_headers->ExtractHeader(HEADER_CC, true, mailCC);
            nsCOMPtr<nsIArray> servIdentities;
            accountManager->GetIdentitiesForServer(m_server, getter_AddRefs(servIdentities));
            if (servIdentities)
            {
              nsCOMPtr<nsIMsgIdentity> ident;
              nsCString identEmail;
              uint32_t count = 0;
              servIdentities->GetLength(&count);
              // First check in the "To:" header
              for (uint32_t i = 0; i < count; i++)
              {
                ident = do_QueryElementAt(servIdentities, i, &rv);
                if (NS_FAILED(rv))
                  continue;
                ident->GetEmail(identEmail);
                if (!mailTo.IsEmpty() && !identEmail.IsEmpty() &&
                    mailTo.Find(identEmail, CaseInsensitiveCompare) != kNotFound)
                {
                  m_identity = ident;
                  break;
                }
              }
              // If no match, check the "Cc:" header
              if (!m_identity)
              {
                for (uint32_t i = 0; i < count; i++)
                {
                  rv = servIdentities->QueryElementAt(i, NS_GET_IID(nsIMsgIdentity),getter_AddRefs(ident));
                  if (NS_FAILED(rv))
                    continue;
                  ident->GetEmail(identEmail);
                  if (!mailCC.IsEmpty() && !identEmail.IsEmpty() &&
                      mailCC.Find(identEmail, CaseInsensitiveCompare) != kNotFound)
                  {
                    m_identity = ident;
                    break;
                  }
                }
              }
            }

            // If no match again, use the first identity
            if (!m_identity)
              rv = accountManager->GetFirstIdentityForServer(m_server, getter_AddRefs(m_identity));
          }
        }
        NS_ENSURE_SUCCESS(rv,rv);

        if (m_identity)
        {
            bool useCustomPrefs = false;
            m_identity->GetBoolAttribute("use_custom_prefs", &useCustomPrefs);
            if (useCustomPrefs)
            {
                bool bVal = false;
                m_server->GetBoolValue("mdn_report_enabled", &bVal);
                m_mdnEnabled = bVal;
                m_server->GetIntValue("mdn_not_in_to_cc", &m_notInToCcOp);
                m_server->GetIntValue("mdn_outside_domain",
                                      &m_outsideDomainOp);
                m_server->GetIntValue("mdn_other", &m_otherOp);
            }
            else
            {
                bool bVal = false;

                nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
                if (NS_FAILED(rv))
                    return rv;

                if(prefBranch)
                {
                    prefBranch->GetBoolPref("mail.mdn.report.enabled",
                                           &bVal);
                    m_mdnEnabled = bVal;
                    prefBranch->GetIntPref("mail.mdn.report.not_in_to_cc",
                                           &m_notInToCcOp);
                    prefBranch->GetIntPref("mail.mdn.report.outside_domain",
                                           &m_outsideDomainOp);
                    prefBranch->GetIntPref("mail.mdn.report.other",
                                           &m_otherOp);
                }
            }
        }
    }

    rv = m_folder->GetCharset(m_charset);
    if (m_mdnEnabled)
    {
        m_headers->ExtractHeader(HEADER_DISPOSITION_NOTIFICATION_TO, false,
                                 m_dntRrt);
        if (m_dntRrt.IsEmpty())
            m_headers->ExtractHeader(HEADER_RETURN_RECEIPT_TO, false,
                                     m_dntRrt);
        if (!m_dntRrt.IsEmpty() && ProcessSendMode() && ValidateReturnPath())
        {
            if (!m_autoSend)
            {
                *needToAskUser = true;
                rv = NS_OK;
            }
            else
            {
                *needToAskUser = false;
                rv = UserAgreed();
            }
        }
    }
    return rv;
}

NS_IMETHODIMP nsMsgMdnGenerator::Process(EDisposeType type,
                                         nsIMsgWindow *aWindow,
                                         nsIMsgFolder *folder,
                                         nsMsgKey key,
                                         nsIMimeHeaders *headers,
                                         bool autoAction,
                                         bool *_retval)
{
    DEBUG_MDN("nsMsgMdnGenerator::Process");
    NS_ENSURE_ARG_POINTER(folder);
    NS_ENSURE_ARG_POINTER(headers);
    NS_ENSURE_ARG_POINTER(aWindow);
    NS_ENSURE_TRUE(key != nsMsgKey_None, NS_ERROR_INVALID_ARG);
    m_disposeType = type;
    m_autoAction = autoAction;
    m_window = aWindow;
    m_folder = folder;
    m_headers = headers;
    m_key = key;

    nsresult rv = InitAndProcess(_retval);
    NS_ASSERTION(NS_SUCCEEDED(rv), "InitAndProcess failed");
    return NS_OK;
}

NS_IMETHODIMP nsMsgMdnGenerator::UserAgreed()
{
  DEBUG_MDN("nsMsgMdnGenerator::UserAgreed");
  (void) NoteMDNRequestHandled();
  return CreateMdnMsg();
}

NS_IMETHODIMP nsMsgMdnGenerator::UserDeclined()
{
  DEBUG_MDN("nsMsgMdnGenerator::UserDeclined");
  return NoteMDNRequestHandled();
}

/**
 * Set/clear flags appropriately so we won't ask user again about MDN
 * request for this message.
 */
nsresult nsMsgMdnGenerator::NoteMDNRequestHandled()
{
  nsresult rv = StoreMDNSentFlag(m_folder, m_key);
  NS_ASSERTION(NS_SUCCEEDED(rv), "StoreMDNSentFlag failed");
  rv = ClearMDNNeededFlag(m_folder, m_key);
  NS_ASSERTION(NS_SUCCEEDED(rv), "ClearMDNNeededFlag failed");
  return rv;
}

NS_IMETHODIMP nsMsgMdnGenerator::OnStartRunningUrl(nsIURI *url)
{
    DEBUG_MDN("nsMsgMdnGenerator::OnStartRunningUrl");
    return NS_OK;
}

NS_IMETHODIMP nsMsgMdnGenerator::OnStopRunningUrl(nsIURI *url,
                                                  nsresult aExitCode)
{
    nsresult rv;

    DEBUG_MDN("nsMsgMdnGenerator::OnStopRunningUrl");
    if (m_file)
      m_file->Remove(false);

    if (NS_SUCCEEDED(aExitCode))
      return NS_OK;

    switch (aExitCode)
    {    
      case NS_ERROR_UNKNOWN_HOST:
      case NS_ERROR_UNKNOWN_PROXY_HOST:
        aExitCode = NS_ERROR_SMTP_SEND_FAILED_UNKNOWN_SERVER;
        break;
      case NS_ERROR_CONNECTION_REFUSED:
      case NS_ERROR_PROXY_CONNECTION_REFUSED: 
        aExitCode = NS_ERROR_SMTP_SEND_FAILED_REFUSED;
        break;
      case NS_ERROR_NET_INTERRUPT:
        aExitCode = NS_ERROR_SMTP_SEND_FAILED_INTERRUPTED;
        break; 
      case NS_ERROR_NET_TIMEOUT:
      case NS_ERROR_NET_RESET:
        aExitCode = NS_ERROR_SMTP_SEND_FAILED_TIMEOUT;
        break;
      case NS_ERROR_SMTP_PASSWORD_UNDEFINED:
        // nothing to do, just keep the code
        break;
      default:
        if (aExitCode != NS_ERROR_ABORT && !NS_IS_MSG_ERROR(aExitCode))
          aExitCode = NS_ERROR_SMTP_SEND_FAILED_UNKNOWN_REASON;
      break;
    }    

    nsCOMPtr<nsISmtpService> smtpService(do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv,rv);

    // Get the smtp hostname and format the string.
    nsCString smtpHostName;
    nsCOMPtr<nsISmtpServer> smtpServer;
    rv = smtpService->GetServerByIdentity(m_identity, getter_AddRefs(smtpServer));
    if (NS_SUCCEEDED(rv)) 
      smtpServer->GetHostname(smtpHostName);
     
    nsAutoString hostStr;
    CopyASCIItoUTF16(smtpHostName, hostStr);
    const PRUnichar *params[] = { hostStr.get() };

    nsCOMPtr<nsIStringBundle> bundle;
    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);

    rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv, rv);

    nsString failed_msg, dialogTitle;

    bundle->FormatStringFromID(NS_ERROR_GET_CODE(aExitCode), params, 1, getter_Copies(failed_msg));
    bundle->GetStringFromID(NS_MSG_SEND_ERROR_TITLE, getter_Copies(dialogTitle));

    nsCOMPtr<nsIPrompt> dialog;
    rv = m_window->GetPromptDialog(getter_AddRefs(dialog));
    if (NS_SUCCEEDED(rv))
      dialog->Alert(dialogTitle.get(),failed_msg.get());

    return NS_OK;
}
