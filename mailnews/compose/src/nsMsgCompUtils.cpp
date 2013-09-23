/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsCOMPtr.h"
#include "nsMsgCompUtils.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "prmem.h"
#include "nsMsgSend.h"
#include "nsIIOService.h"
#include "nsIHttpProtocolHandler.h"
#include "nsMailHeaders.h"
#include "nsMsgI18N.h"
#include "nsIMsgHeaderParser.h"
#include "nsINntpService.h"
#include "nsMimeTypes.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIURI.h"
#include "nsNetCID.h"
#include "nsMsgPrompts.h"
#include "nsMsgUtils.h"
#include "nsCExternalHandlerService.h"
#include "nsIMIMEService.h"
#include "nsComposeStrings.h"
#include "nsIMsgCompUtils.h"
#include "nsIMsgMdnGenerator.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMemory.h"
#include "nsCRTGlue.h"
#include <ctype.h>
#include "mozilla/Services.h"
#include "nsIMIMEInfo.h"

NS_IMPL_ISUPPORTS1(nsMsgCompUtils, nsIMsgCompUtils)

nsMsgCompUtils::nsMsgCompUtils()
{
}

nsMsgCompUtils::~nsMsgCompUtils()
{
}

NS_IMETHODIMP nsMsgCompUtils::MimeMakeSeparator(const char *prefix,
                                                char **_retval)
{
  NS_ENSURE_ARG_POINTER(prefix);
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = mime_make_separator(prefix);
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompUtils::MsgGenerateMessageId(nsIMsgIdentity *identity,
                                                    char **_retval)
{
  NS_ENSURE_ARG_POINTER(identity);
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = msg_generate_message_id(identity);
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompUtils::GetMsgMimeConformToStandard(bool *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = nsMsgMIMEGetConformToStandard();
  return NS_OK;
}

//
// Create a file for the a unique temp file
// on the local machine. Caller must free memory
//
nsresult
nsMsgCreateTempFile(const char *tFileName, nsIFile **tFile)
{
  if ((!tFileName) || (!*tFileName))
    tFileName = "nsmail.tmp";

  nsresult rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
                                                tFileName,
                                                tFile);

  NS_ENSURE_SUCCESS(rv, rv);

  rv = (*tFile)->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
  if (NS_FAILED(rv))
    NS_RELEASE(*tFile);

  return rv;
}

//
// Create a file spec for the a unique temp file
// on the local machine. Caller must free memory
// returned
//
char *
nsMsgCreateTempFileName(const char *tFileName)
{
  if ((!tFileName) || (!*tFileName))
    tFileName = "nsmail.tmp";

  nsCOMPtr<nsIFile> tmpFile;

  nsresult rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
                                                tFileName,
                                                getter_AddRefs(tmpFile));
  if (NS_FAILED(rv))
    return nullptr;

  rv = tmpFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
  if (NS_FAILED(rv))
    return nullptr;

  nsCString tempString;
  rv = tmpFile->GetNativePath(tempString);
  if (NS_FAILED(rv))
    return nullptr;

  char *tString = ToNewCString(tempString);
  if (!tString)
    return PL_strdup("mozmail.tmp");  // No need to I18N

  return tString;
}

// This is the value a caller will Get if they don't Set first (like MDN
// sending a return receipt), so init to the default value of the
// mail.strictly_mime_headers preference.
static bool mime_headers_use_quoted_printable_p = true;

bool
nsMsgMIMEGetConformToStandard (void)
{
  return mime_headers_use_quoted_printable_p;
}

void
nsMsgMIMESetConformToStandard (bool conform_p)
{
  /*
  * If we are conforming to mime standard no matter what we set
  * for the headers preference when generating mime headers we should
  * also conform to the standard. Otherwise, depends the preference
  * we set. For now, the headers preference is not accessible from UI.
  */
  if (conform_p)
    mime_headers_use_quoted_printable_p = true;
  else {
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    if (NS_SUCCEEDED(rv)) {
      prefs->GetBoolPref("mail.strictly_mime_headers", &mime_headers_use_quoted_printable_p);
    }
  }
}

/**
 * Checks if the recipient fields have sane values for message send.
 */
nsresult mime_sanity_check_fields_recipients (
          const char *to,
          const char *cc,
          const char *bcc,
          const char *newsgroups)
{
  if (to)
    while (IS_SPACE(*to))
      to++;
  if (cc)
    while (IS_SPACE(*cc))
      cc++;
  if (bcc)
    while (IS_SPACE(*bcc))
      bcc++;
  if (newsgroups)
    while (IS_SPACE(*newsgroups))
      newsgroups++;

  if ((!to || !*to) && (!cc || !*cc) &&
      (!bcc || !*bcc) && (!newsgroups || !*newsgroups))
    return NS_MSG_NO_RECIPIENTS;

  return NS_OK;
}

/**
 * Checks if the compose fields have sane values for message send.
 */
nsresult mime_sanity_check_fields (
          const char *from,
          const char *reply_to,
          const char *to,
          const char *cc,
          const char *bcc,
          const char *fcc,
          const char *newsgroups,
          const char *followup_to,
          const char * /*subject*/,
          const char * /*references*/,
          const char * /*organization*/,
          const char * /*other_random_headers*/)
{
  if (from)
    while (IS_SPACE(*from))
      from++;
  if (reply_to)
    while (IS_SPACE(*reply_to))
      reply_to++;
  if (fcc)
    while (IS_SPACE(*fcc))
      fcc++;
  if (followup_to)
    while (IS_SPACE(*followup_to))
      followup_to++;

  // TODO: sanity check other_random_headers for newline conventions
  if (!from || !*from)
    return NS_MSG_NO_SENDER;

  return mime_sanity_check_fields_recipients(to, cc, bcc, newsgroups);
}

static char *
nsMsgStripLine (char * string)
{
  char * ptr;

  /* remove leading blanks */
  while(*string=='\t' || *string==' ' || *string=='\r' || *string=='\n')
    string++;

  for(ptr=string; *ptr; ptr++)
    ;   /* NULL BODY; Find end of string */

  /* remove trailing blanks */
  for(ptr--; ptr >= string; ptr--)
  {
    if(*ptr=='\t' || *ptr==' ' || *ptr=='\r' || *ptr=='\n')
      *ptr = '\0';
    else
      break;
  }

  return string;
}

//
// Generate the message headers for the new RFC822 message
//
#define UA_PREF_PREFIX "general.useragent."

#define ENCODE_AND_PUSH(name, structured, body, charset, usemime) \
  { \
    PUSH_STRING((name)); \
    convbuf = nsMsgI18NEncodeMimePartIIStr((body), (structured), (charset), strlen(name), (usemime)); \
    if (convbuf) { \
      PUSH_STRING (convbuf); \
      PR_FREEIF(convbuf); \
    } \
    else \
      PUSH_STRING((body)); \
    PUSH_NEWLINE (); \
  }

char *
mime_generate_headers (nsMsgCompFields *fields,
                       const char *charset,
                       nsMsgDeliverMode deliver_mode, nsIPrompt * aPrompt, nsresult *status)
{
  nsresult rv;
  *status = NS_OK;

  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv)) {
    *status = rv;
    return nullptr;
  }

  bool usemime = nsMsgMIMEGetConformToStandard();
  int32_t size = 0;
  char *buffer = nullptr, *buffer_tail = nullptr;
  bool isDraft =
    deliver_mode == nsIMsgSend::nsMsgSaveAsDraft ||
    deliver_mode == nsIMsgSend::nsMsgSaveAsTemplate ||
    deliver_mode == nsIMsgSend::nsMsgQueueForLater ||
    deliver_mode == nsIMsgSend::nsMsgDeliverBackground;

  const char* pFrom;
  const char* pTo;
  const char* pCc;
  const char* pMessageID;
  const char* pReplyTo;
  const char* pOrg;
  const char* pNewsGrp;
  const char* pFollow;
  const char* pSubject;
  const char* pPriority;
  const char* pReference;
  const char* pOtherHdr;
  char *convbuf;

  bool hasDisclosedRecipient = false;

  nsAutoCString headerBuf;    // accumulate header strings to get length
  headerBuf.Truncate();

  NS_ASSERTION (fields, "null fields");
  if (!fields) {
    *status = NS_ERROR_NULL_POINTER;
    return nullptr;
  }
  pFrom = fields->GetFrom();
  if (pFrom)
    headerBuf.Append(pFrom);
  pReplyTo =fields->GetReplyTo();
  if (pReplyTo)
    headerBuf.Append(pReplyTo);
  pTo = fields->GetTo();
  if (pTo)
    headerBuf.Append(pTo);
  pCc = fields->GetCc();
  if (pCc)
    headerBuf.Append(pCc);
  pNewsGrp = fields->GetNewsgroups(); if (pNewsGrp)     size += 3 * PL_strlen (pNewsGrp);
  pFollow= fields->GetFollowupTo(); if (pFollow)        size += 3 * PL_strlen (pFollow);
  pSubject = fields->GetSubject();
  if (pSubject)
    headerBuf.Append(pSubject);
  pReference = fields->GetReferences(); if (pReference)   size += 3 * PL_strlen (pReference);
  pOrg= fields->GetOrganization();
  if (pOrg)
    headerBuf.Append(pOrg);
  pOtherHdr= fields->GetOtherRandomHeaders(); if (pOtherHdr)  size += 3 * PL_strlen (pOtherHdr);
  pPriority = fields->GetPriority();  if (pPriority)      size += 3 * PL_strlen (pPriority);
  pMessageID = fields->GetMessageId(); if (pMessageID)    size += PL_strlen (pMessageID);

  /* Multiply by 3 here to make enough room for MimePartII conversion */
  size += 3 * headerBuf.Length();

  /* Add a bunch of slop for the static parts of the headers. */
  /* size += 2048; */
  size += 2560;

  buffer = (char *) PR_Malloc (size);
  if (!buffer) {
    *status = NS_ERROR_OUT_OF_MEMORY;
    return nullptr; /* NS_ERROR_OUT_OF_MEMORY */
  }

  buffer_tail = buffer;

  if (pMessageID && *pMessageID) {
    PUSH_STRING ("Message-ID: ");
    PUSH_STRING (pMessageID);
    PUSH_NEWLINE ();
    /* MDN request header requires to have MessageID header presented
    * in the message in order to
    * coorelate the MDN reports to the original message. Here will be
    * the right place
    */

    if (fields->GetReturnReceipt() &&
      (deliver_mode != nsIMsgSend::nsMsgSaveAsDraft &&
      deliver_mode != nsIMsgSend::nsMsgSaveAsTemplate))
    {
        int32_t receipt_header_type = nsIMsgMdnGenerator::eDntType;
        fields->GetReceiptHeaderType(&receipt_header_type);

      // nsIMsgMdnGenerator::eDntType = MDN Disposition-Notification-To: ;
      // nsIMsgMdnGenerator::eRrtType = Return-Receipt-To: ;
      // nsIMsgMdnGenerator::eDntRrtType = both MDN DNT and RRT headers .
      if (receipt_header_type != nsIMsgMdnGenerator::eRrtType)
        ENCODE_AND_PUSH(
	  "Disposition-Notification-To: ", true, pFrom, charset, usemime);
      if (receipt_header_type != nsIMsgMdnGenerator::eDntType)
        ENCODE_AND_PUSH(
	  "Return-Receipt-To: ", true, pFrom, charset, usemime);
    }

#ifdef SUPPORT_X_TEMPLATE_NAME
    if (deliver_mode == MSG_SaveAsTemplate) {
      const char *pStr = fields->GetTemplateName();
      pStr = pStr ? pStr : "";
      ENCODE_AND_PUSH("X-Template: ", false, pStr, charset, usemime);
    }
#endif /* SUPPORT_X_TEMPLATE_NAME */
  }

  PRExplodedTime now;
  PR_ExplodeTime(PR_Now(), PR_LocalTimeParameters, &now);
  int gmtoffset = (now.tm_params.tp_gmt_offset + now.tm_params.tp_dst_offset) / 60;

  /* Use PR_FormatTimeUSEnglish() to format the date in US English format,
     then figure out what our local GMT offset is, and append it (since
     PR_FormatTimeUSEnglish() can't do that.) Generate four digit years as
     per RFC 1123 (superceding RFC 822.)
   */
  PR_FormatTimeUSEnglish(buffer_tail, 100,
               "Date: %a, %d %b %Y %H:%M:%S ",
               &now);

  buffer_tail += PL_strlen (buffer_tail);
  PR_snprintf(buffer_tail, buffer + size - buffer_tail,
        "%c%02d%02d" CRLF,
        (gmtoffset >= 0 ? '+' : '-'),
        ((gmtoffset >= 0 ? gmtoffset : -gmtoffset) / 60),
        ((gmtoffset >= 0 ? gmtoffset : -gmtoffset) % 60));
  buffer_tail += PL_strlen (buffer_tail);

  if (pFrom && *pFrom)
  {
    ENCODE_AND_PUSH("From: ", true, pFrom, charset, usemime);
  }

  if (pReplyTo && *pReplyTo)
  {
    ENCODE_AND_PUSH("Reply-To: ", true, pReplyTo, charset, usemime);
  }

  if (pOrg && *pOrg)
  {
    ENCODE_AND_PUSH("Organization: ", false, pOrg, charset, usemime);
  }

  // X-Mozilla-Draft-Info
  if (isDraft)
  {
    PUSH_STRING(HEADER_X_MOZILLA_DRAFT_INFO);
    PUSH_STRING(": internal/draft; ");
    if (fields->GetAttachVCard())
      PUSH_STRING("vcard=1");
    else
      PUSH_STRING("vcard=0");
    PUSH_STRING("; ");
    if (fields->GetReturnReceipt()) {
      // slight change compared to 4.x; we used to use receipt= to tell
      // whether the draft/template has request for either MDN or DNS or both
      // return receipt; since the DNS is out of the picture we now use the
      // header type + 1 to tell whether user has requested the return receipt
      int32_t headerType = 0;
      fields->GetReceiptHeaderType(&headerType);
      char *type = PR_smprintf("%d", (int)headerType + 1);
      if (type)
      {
        PUSH_STRING("receipt=");
        PUSH_STRING(type);
        PR_FREEIF(type);
      }
    }
    else
      PUSH_STRING("receipt=0");
    PUSH_STRING("; ");
    if (fields->GetDSN())
      PUSH_STRING("DSN=1");
    else
      PUSH_STRING("DSN=0");
    PUSH_STRING("; ");
    PUSH_STRING("uuencode=0");

    PUSH_NEWLINE ();
  }


  nsCOMPtr<nsIHttpProtocolHandler> pHTTPHandler = do_GetService(NS_NETWORK_PROTOCOL_CONTRACTID_PREFIX "http", &rv);
  if (NS_SUCCEEDED(rv) && pHTTPHandler)
  {
    nsAutoCString userAgentString;
    pHTTPHandler->GetUserAgent(userAgentString);

    if (!userAgentString.IsEmpty())
    {
      PUSH_STRING ("User-Agent: ");
      PUSH_STRING(userAgentString.get());
      PUSH_NEWLINE ();
    }
  }

  PUSH_STRING ("MIME-Version: 1.0" CRLF);

  if (pNewsGrp && *pNewsGrp) {
    /* turn whitespace into a comma list
    */
    char *duppedNewsGrp = PL_strdup(pNewsGrp);
    if (!duppedNewsGrp) {
      PR_FREEIF(buffer);
      *status = NS_ERROR_OUT_OF_MEMORY;
      return nullptr; /* NS_ERROR_OUT_OF_MEMORY */
    }
    char *n2 = nsMsgStripLine(duppedNewsGrp);

    for(char *ptr = n2; *ptr != '\0'; ptr++) {
      /* find first non white space */
      while(!IS_SPACE(*ptr) && *ptr != ',' && *ptr != '\0')
        ptr++;

      if(*ptr == '\0')
        break;

      if(*ptr != ',')
        *ptr = ',';

      /* find next non white space */
      char *ptr2 = ptr+1;
      while(IS_SPACE(*ptr2))
        ptr2++;

      if(ptr2 != ptr+1)
        PL_strcpy(ptr+1, ptr2);
    }

    // we need to decide the Newsgroup related headers
    // to write to the outgoing message. In ANY case, we need to write the
    // "Newsgroup" header which is the "proper" header as opposed to the
    // HEADER_X_MOZILLA_NEWSHOST which can contain the "news:" URL's.
    //
    // Since n2 can contain data in the form of:
    // "news://news.mozilla.org/netscape.test,news://news.mozilla.org/netscape.junk"
    // we need to turn that into: "netscape.test,netscape.junk"
    //
    nsCOMPtr<nsINntpService> nntpService = do_GetService("@mozilla.org/messenger/nntpservice;1", &rv);
    if (NS_FAILED(rv) || !nntpService) {
      *status = NS_ERROR_FAILURE;
      return nullptr;
    }

    nsCString newsgroupsHeaderVal;
    nsCString newshostHeaderVal;
    rv = nntpService->GenerateNewsHeaderValsForPosting(nsDependentCString(n2), getter_Copies(newsgroupsHeaderVal), getter_Copies(newshostHeaderVal));
    if (NS_FAILED(rv)) 
    {
      *status = rv;
      return nullptr;
    }

    // fixme:the newsgroups header had better be encoded as the server-side
    // character encoding, but this |charset| might be different from it.
    ENCODE_AND_PUSH("Newsgroups: ", false, newsgroupsHeaderVal.get(),
                    charset, false);

    // If we are here, we are NOT going to send this now. (i.e. it is a Draft,
    // Send Later file, etc...). Because of that, we need to store what the user
    // typed in on the original composition window for use later when rebuilding
    // the headers
    if (deliver_mode != nsIMsgSend::nsMsgDeliverNow && deliver_mode != nsIMsgSend::nsMsgSendUnsent)
    {
      // This is going to be saved for later, that means we should just store
      // what the user typed into the "Newsgroup" line in the HEADER_X_MOZILLA_NEWSHOST
      // header for later use by "Send Unsent Messages", "Drafts" or "Templates"
      PUSH_STRING (HEADER_X_MOZILLA_NEWSHOST);
      PUSH_STRING (": ");
      PUSH_STRING (newshostHeaderVal.get());
      PUSH_NEWLINE ();
    }

    PR_FREEIF(duppedNewsGrp);
    hasDisclosedRecipient = true;
  }

  /* #### shamelessly duplicated from above */
  if (pFollow && *pFollow) {
    /* turn whitespace into a comma list
    */
    char *duppedFollowup = PL_strdup(pFollow);
    if (!duppedFollowup) {
      PR_FREEIF(buffer);
      return nullptr; /* NS_ERROR_OUT_OF_MEMORY */
    }
    char *n2 = nsMsgStripLine (duppedFollowup);

    for (char *ptr = n2; *ptr != '\0'; ptr++) {
      /* find first non white space */
      while(!IS_SPACE(*ptr) && *ptr != ',' && *ptr != '\0')
        ptr++;

      if(*ptr == '\0')
        break;

      if(*ptr != ',')
        *ptr = ',';

      /* find next non white space */
      char *ptr2 = ptr+1;
      while(IS_SPACE(*ptr2))
        ptr2++;

      if(ptr2 != ptr+1)
        PL_strcpy(ptr+1, ptr2);
    }

    ENCODE_AND_PUSH("Followup-To: ", false, n2, charset, false);
    PR_Free (duppedFollowup);
  }

  if (pTo && *pTo) {
    ENCODE_AND_PUSH("To: ", true, pTo, charset, usemime);
    hasDisclosedRecipient = true;
  }

  if (pCc && *pCc) {
    ENCODE_AND_PUSH("CC: ", true, pCc, charset, usemime);
    hasDisclosedRecipient = true;
  }

  // If we don't have disclosed recipient (only Bcc), address the message to
  // undisclosed-recipients to prevent problem with some servers

  // If we are saving the message as a draft, don't bother inserting the undisclosed recipients field. We'll take care of that when we
  // really send the message.
  if (!hasDisclosedRecipient && !isDraft) 
  {
    bool bAddUndisclosedRecipients = true;
    prefs->GetBoolPref("mail.compose.add_undisclosed_recipients", &bAddUndisclosedRecipients);
    if (bAddUndisclosedRecipients)
    {
      const char* pBcc = fields->GetBcc(); //Do not free me!
      if (pBcc && *pBcc)
      {
        nsCOMPtr<nsIStringBundleService> stringService =
          mozilla::services::GetStringBundleService();
        if (stringService)
        {
          nsCOMPtr<nsIStringBundle> composeStringBundle;
          rv = stringService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(composeStringBundle));
          if (NS_SUCCEEDED(rv))
          {
            nsString undisclosedRecipients;
            rv = composeStringBundle->GetStringFromID(NS_MSG_UNDISCLOSED_RECIPIENTS, getter_Copies(undisclosedRecipients));
            if (NS_SUCCEEDED(rv) && !undisclosedRecipients.IsEmpty())
            {
                PUSH_STRING("To: ");
              PUSH_STRING(NS_LossyConvertUTF16toASCII(undisclosedRecipients).get());
                PUSH_STRING(":;");
                PUSH_NEWLINE ();
              }
          }
        }
      }
    }
  }

  if (pSubject && *pSubject)
    ENCODE_AND_PUSH("Subject: ", false, pSubject, charset, usemime);

  // Skip no or empty priority.
  if (pPriority && *pPriority) 
  {
    nsMsgPriorityValue priorityValue;

    NS_MsgGetPriorityFromString(pPriority, priorityValue);

    // Skip default priority.
    if (priorityValue != nsMsgPriority::Default) {
      nsAutoCString priorityName;
      nsAutoCString priorityValueString;

      NS_MsgGetPriorityValueString(priorityValue, priorityValueString);
      NS_MsgGetUntranslatedPriorityName(priorityValue, priorityName);

      // Output format: [X-Priority: <pValue> (<pName>)]
      PUSH_STRING("X-Priority: ");
      PUSH_STRING(priorityValueString.get());
      PUSH_STRING(" (");
      PUSH_STRING(priorityName.get());
      PUSH_STRING(")");
      PUSH_NEWLINE();
    }
  }

  if (pReference && *pReference) {
    PUSH_STRING ("References: ");
    if (PL_strlen(pReference) >= 986) {
      char *references = PL_strdup(pReference);
      char *trimAt = PL_strchr(references+1, '<');
      char *ptr;
      // per sfraser, RFC 1036 - a message header line should not exceed
      // 998 characters including the header identifier
      // retiring the earliest reference one after the other
      // but keep the first one for proper threading
      while (references && PL_strlen(references) >= 986 && trimAt) {
        ptr = PL_strchr(trimAt+1, '<');
        if (ptr)
          memmove(trimAt, ptr, PL_strlen(ptr)+1); // including the
        else
          break;
      }
      NS_ASSERTION(references, "null references");
      if (references) {
        PUSH_STRING (references);
        PR_Free(references);
      }
    }
    else
      PUSH_STRING (pReference);
    PUSH_NEWLINE ();
    {
      const char *lastRef = PL_strrchr(pReference, '<');

      if (lastRef) {
        PUSH_STRING ("In-Reply-To: ");
        PUSH_STRING (lastRef);
        PUSH_NEWLINE ();
      }
    }
  }

  if (pOtherHdr && *pOtherHdr) {
    /* Assume they already have the right newlines and continuations
     and so on.  for these headers, the PUSH_NEWLINE() happens in addressingWidgetOverlay.js */
    PUSH_STRING (pOtherHdr);
  }

  if (buffer_tail > buffer + size - 1) {
    PR_FREEIF(buffer);
    return nullptr;
  }
  /* realloc it smaller... */
  char *newBuffer = (char*) PR_REALLOC(buffer, buffer_tail - buffer + 1);
  if (!newBuffer) // The original bigger buffer is still usable to the caller.
    return buffer;

  return newBuffer;
}

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

static char *
RFC2231ParmFolding(const char *parmName, const nsCString& charset,
                   const char *language, const nsString& parmValue);

static char *
LegacyParmFolding(const nsCString& aCharset,
                  const nsCString& aFileName, int32_t aParmFolding);

char *
mime_generate_attachment_headers (const char *type,
                  const char *type_param,
                  const char *encoding,
                  const char *description,
                  const char *x_mac_type,
                  const char *x_mac_creator,
                  const char *real_name,
                  const char *base_url,
                  bool /*digest_p*/,
                  nsMsgAttachmentHandler * /*ma*/,
                  const char *attachmentCharset,
                  const char *bodyCharset,
                  bool bodyIsAsciiOnly,
                  const char *content_id,
                  bool        aBodyDocument)
{
  NS_ASSERTION (encoding, "null encoding");

  int32_t parmFolding = 2; // RFC 2231-compliant
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (prefs)
    prefs->GetIntPref("mail.strictly_mime.parm_folding", &parmFolding);

  /* Let's encode the real name */
  char *encodedRealName = nullptr;
  nsCString charset;   // actual charset used for MIME encode
  nsAutoString realName;
  if (real_name)
  {
    // first try main body's charset to encode the file name,
    // then try local file system charset if fails
    CopyUTF8toUTF16(nsDependentCString(real_name), realName);
    if (bodyCharset && *bodyCharset &&
        nsMsgI18Ncheck_data_in_charset_range(bodyCharset, realName.get()))
      charset.Assign(bodyCharset);
    else
    {
      charset.Assign(nsMsgI18NFileSystemCharset());
      if (!nsMsgI18Ncheck_data_in_charset_range(charset.get(), realName.get()))
        charset.Assign("UTF-8"); // set to UTF-8 if fails again
    }

    encodedRealName = RFC2231ParmFolding("filename", charset, nullptr,
                                         realName);
    // somehow RFC2231ParamFolding failed. fall back to legacy method
    if (!encodedRealName || !*encodedRealName) {
      PR_FREEIF(encodedRealName);
      parmFolding = 0;
      // Not RFC 2231 style encoding (it's not standard-compliant)
      encodedRealName =
        LegacyParmFolding(charset, nsDependentCString(real_name), parmFolding);
    }
  }

  nsCString buf;  // very likely to be longer than 64 characters
  buf.Append("Content-Type: ");
  buf.Append(type);
  if (type_param && *type_param)
  {
    if (*type_param != ';')
      buf.Append("; ");
    buf.Append(type_param);
  }

  if (mime_type_needs_charset (type))
  {

    char charset_label[65] = "";   // Content-Type: charset
    if (attachmentCharset)
    {
      PL_strncpy(charset_label, attachmentCharset, sizeof(charset_label)-1);
      charset_label[sizeof(charset_label)-1] = '\0';
    }

    /* If the characters are all 7bit, arguably it's better to
    claim the charset to be US-ASCII. However, it causes
    a major 'interoperability problem' with MS OE, which makes it hard
    to sell Mozilla/TB to people most of whose correspondents use
    MS OE. MS OE turns all non-ASCII characters to question marks
    in replies to messages labeled as US-ASCII if users select 'send as is'
    with MIME turned on. (with MIME turned off, this happens without
    any warning.) To avoid this, we use the label 'US-ASCII' only when
    it's explicitly requested by setting the hidden pref.
    'mail.label_ascii_only_mail_as_us_ascii'. (bug 247958) */
    bool labelAsciiAsAscii = false;
    if (prefs)
      prefs->GetBoolPref("mail.label_ascii_only_mail_as_us_ascii",
                         &labelAsciiAsAscii);
    if (labelAsciiAsAscii && encoding &&
        !PL_strcasecmp (encoding, "7bit") && bodyIsAsciiOnly)
      PL_strcpy (charset_label, "us-ascii");

    // If charset is multibyte then no charset to be specified (apply base64 instead).
    // The list of file types match with PickEncoding() where we put base64 label.
    if ( ((attachmentCharset && !nsMsgI18Nmultibyte_charset(attachmentCharset)) ||
         ((PL_strcasecmp(type, TEXT_HTML) == 0) ||
         (PL_strcasecmp(type, TEXT_MDL) == 0) ||
         (PL_strcasecmp(type, TEXT_PLAIN) == 0) ||
         (PL_strcasecmp(type, TEXT_RICHTEXT) == 0) ||
         (PL_strcasecmp(type, TEXT_ENRICHED) == 0) ||
         (PL_strcasecmp(type, TEXT_VCARD) == 0) ||
         (PL_strcasecmp(type, APPLICATION_DIRECTORY) == 0) || /* text/x-vcard synonym */
         (PL_strcasecmp(type, TEXT_CSS) == 0) ||
         (PL_strcasecmp(type, TEXT_JSSS) == 0)) ||
         (PL_strcasecmp(encoding, ENCODING_BASE64) != 0)) &&
         (*charset_label))
    {
      buf.Append("; charset=");
      buf.Append(charset_label);
    }
  }

  // Only do this if we are in the body of a message
  if (aBodyDocument)
  {
    // Add format=flowed as in RFC 2646 if we are using that
    if(type && !PL_strcasecmp(type, "text/plain"))
    {
      if(UseFormatFlowed(bodyCharset))
        buf.Append("; format=flowed");
      // else
      // {
      // Don't add a markup. Could use
      //        PUSH_STRING ("; format=fixed");
      // but it is equivalent to nothing at all and we do want
      // to save bandwidth. Don't we?
      // }
    }
  }

  if (x_mac_type && *x_mac_type) {
    buf.Append("; x-mac-type=\"");
    buf.Append(x_mac_type);
    buf.Append("\"");
  }

  if (x_mac_creator && *x_mac_creator) {
    buf.Append("; x-mac-creator=\"");
    buf.Append(x_mac_creator);
    buf.Append("\"");
  }

#ifdef EMIT_NAME_IN_CONTENT_TYPE
  if (encodedRealName && *encodedRealName) {
    // Note that we don't need to output the name field if the name encoding is
    // RFC 2231. If the MUA knows the RFC 2231, it should know the RFC 2183 too.
    if (parmFolding != 2) {
      char *nameValue = LegacyParmFolding(charset, nsDependentCString(real_name),
                                          parmFolding);
      if (!nameValue || !*nameValue) {
        PR_FREEIF(nameValue);
        nameValue = encodedRealName;
      }
      buf.Append(";\r\n name=\"");
      buf.Append(nameValue);
      buf.Append("\"");
      if (nameValue != encodedRealName)
        PR_FREEIF(nameValue);
    }
  }
#endif /* EMIT_NAME_IN_CONTENT_TYPE */
  buf.Append(CRLF);

  buf.Append("Content-Transfer-Encoding: ");
  buf.Append(encoding);
  buf.Append(CRLF);

  if (description && *description) {
    char *s = mime_fix_header (description);
    if (s) {
      buf.Append("Content-Description: ");
      buf.Append(s);
      buf.Append(CRLF);
      PR_Free(s);
    }
  }

  if ( (content_id) && (*content_id) )
  {
    buf.Append("Content-ID: <");
    buf.Append(content_id);
    buf.Append(">");
    buf.Append(CRLF);
  }

  if (encodedRealName && *encodedRealName) {
    char *period = PL_strrchr(encodedRealName, '.');
    int32_t pref_content_disposition = 0;

    if (prefs) {
      nsresult rv = prefs->GetIntPref("mail.content_disposition_type",
                                      &pref_content_disposition);
      NS_ASSERTION(NS_SUCCEEDED(rv), "failed to get mail.content_disposition_type");
    }

    buf.Append("Content-Disposition: ");

    // If this is an attachment which is part of the message body and therefore has a
    // Content-ID (e.g, image in HTML msg), then Content-Disposition has to be inline
    if (content_id && *content_id)
      buf.Append("inline");
    else if (pref_content_disposition == 1)
      buf.Append("attachment");
    else
      if (pref_content_disposition == 2 &&
          (!PL_strcasecmp(type, TEXT_PLAIN) ||
          (period && !PL_strcasecmp(period, ".txt"))))
        buf.Append("attachment");

      /* If this document is an anonymous binary file or a vcard,
      then always show it as an attachment, never inline. */
      else
        if (!PL_strcasecmp(type, APPLICATION_OCTET_STREAM) ||
            !PL_strcasecmp(type, TEXT_VCARD) ||
            !PL_strcasecmp(type, APPLICATION_DIRECTORY)) /* text/x-vcard synonym */
          buf.Append("attachment");
        else
          buf.Append("inline");

    buf.Append(";\r\n ");
    buf.Append(encodedRealName);
    buf.Append(CRLF);
  }
  else
    if (type &&
        (!PL_strcasecmp (type, MESSAGE_RFC822) ||
        !PL_strcasecmp (type, MESSAGE_NEWS)))
      buf.Append("Content-Disposition: inline" CRLF);

#ifdef GENERATE_CONTENT_BASE
  /* If this is an HTML document, and we know the URL it originally
     came from, write out a Content-Base header. */
  if (type &&
      (!PL_strcasecmp (type, TEXT_HTML) ||
      !PL_strcasecmp (type, TEXT_MDL)) &&
      base_url && *base_url)
  {
    int32_t col = 0;
    const char *s = base_url;
    const char *colon = PL_strchr (s, ':');
    bool useContentLocation = false;   /* rhp - add this  */

    if (!colon)
      goto GIVE_UP_ON_CONTENT_BASE;  /* malformed URL? */

    /* Don't emit a content-base that points to (or into) a news or
       mail message. */
    if (!PL_strncasecmp (s, "news:", 5) ||
        !PL_strncasecmp (s, "snews:", 6) ||
        !PL_strncasecmp (s, "IMAP:", 5) ||
        !PL_strncasecmp (s, "file:", 5) ||    /* rhp: fix targets from included HTML files */
        !PL_strncasecmp (s, "mailbox:", 8))
      goto GIVE_UP_ON_CONTENT_BASE;

    /* rhp - Put in a pref for using Content-Location instead of Content-Base.
           This will get tweaked to default to true in 5.0
    */
    if (prefs)
      prefs->GetBoolPref("mail.use_content_location_on_send", &useContentLocation);

    if (useContentLocation)
      buf.Append("Content-Location: \"");
    else
      buf.Append("Content-Base: \"");
    /* rhp - Pref for Content-Location usage */

/* rhp: this is to work with the Content-Location stuff */
CONTENT_LOC_HACK:

    while (*s != 0 && *s != '#')
    {
      uint32_t ot=buf.Length();
      char tmp[]="\x00\x00";
      /* URLs must be wrapped at 40 characters or less. */
      if (col >= 38) {
        buf.Append(CRLF "\t");
        col = 0;
      }

      if (*s == ' ')
        buf.Append("%20");
      else if (*s == '\t')
        buf.Append("%09");
      else if (*s == '\n')
        buf.Append("%0A");
      else if (*s == '\r')
        buf.Append("%0D");
      else {
	      tmp[0]=*s;
	      buf.Append(tmp);
      }
      s++;
      col += (buf.Length() - ot);
    }
    buf.Append("\"" CRLF);

    /* rhp: this is to try to get around this fun problem with Content-Location */
    if (!useContentLocation) {
      buf.Append("Content-Location: \"");
      s = base_url;
      col = 0;
      useContentLocation = true;
      goto CONTENT_LOC_HACK;
    }
    /* rhp: this is to try to get around this fun problem with Content-Location */

GIVE_UP_ON_CONTENT_BASE:
    ;
  }
#endif /* GENERATE_CONTENT_BASE */

  /* realloc it smaller... */

#ifdef DEBUG_jungshik
  printf ("header=%s\n", buf.get());
#endif
  PR_Free(encodedRealName);
  return PL_strdup(buf.get());
}

static bool isValidHost( const char* host )
{
  if ( host )
    for (const char *s = host; *s; ++s)
      if  (  !isalpha(*s)
         && !isdigit(*s)
         && *s != '-'
         && *s != '_'
         && *s != '.'
         )
      {
       host = nullptr;
       break;
      }

  return nullptr != host;
}

char *
msg_generate_message_id (nsIMsgIdentity *identity)
{
  uint32_t now = (uint32_t)(PR_Now() / PR_USEC_PER_SEC);

  uint32_t salt = 0;
  const char *host = 0;

  nsCString forcedFQDN;
  nsCString from;
  nsresult rv = NS_OK;

  rv = identity->GetCharAttribute("FQDN", forcedFQDN);

  if (NS_SUCCEEDED(rv) && !forcedFQDN.IsEmpty())
    host = forcedFQDN.get();

  if (!isValidHost(host))
  {
    nsresult rv = identity->GetEmail(from);
    if (NS_SUCCEEDED(rv) && !from.IsEmpty())
      host = strchr(from.get(),'@');

    // No '@'? Munged address, anti-spam?
    // see bug #197203
    if (host)
      ++host;
  }

  if (!isValidHost(host))
  /* If we couldn't find a valid host name to use, we can't generate a
     valid message ID, so bail, and let NNTP and SMTP generate them. */
    return 0;

  GenerateGlobalRandomBytes((unsigned char *) &salt, sizeof(salt));
  return PR_smprintf("<%lX.%lX@%s>",
           (unsigned long) now, (unsigned long) salt, host);
}


inline static bool is7bitCharset(const nsCString& charset)
{
  // charset name is canonical (no worry about case-sensitivity)
  return charset.EqualsLiteral("HZ-GB-2312") ||
         Substring(charset, 0, 8).EqualsLiteral("ISO-2022-");
}

#define PR_MAX_FOLDING_LEN 75     // this is to gurantee the folded line will
                                  // never be greater than 78 = 75 + CRLFLWSP
/*static */ char *
RFC2231ParmFolding(const char *parmName, const nsCString& charset,
                   const char *language, const nsString& parmValue)
{
  NS_ENSURE_TRUE(parmName && *parmName && !parmValue.IsEmpty(), nullptr);

  bool needEscape;
  nsCString dupParm;

  if (!NS_IsAscii(parmValue.get()) || is7bitCharset(charset)) {
    needEscape = true;
    nsAutoCString nativeParmValue;
    ConvertFromUnicode(charset.get(), parmValue, nativeParmValue);
    MsgEscapeString(nativeParmValue, nsINetUtil::ESCAPE_ALL, dupParm);
  }
  else {
    needEscape = false;
    dupParm.Adopt(
      msg_make_filename_qtext(NS_LossyConvertUTF16toASCII(parmValue).get(),
                              true));
  }

  if (dupParm.IsEmpty())
    return nullptr;

  int32_t parmNameLen = PL_strlen(parmName);
  int32_t parmValueLen = dupParm.Length();

  if (needEscape)
    parmNameLen += 5;   // *=__'__'___ or *[0]*=__'__'__ or *[1]*=___
  else
    parmNameLen += 5;   // *[0]="___";

  int32_t languageLen = language ?  PL_strlen(language) : 0;
  int32_t charsetLen = charset.Length();
  char *foldedParm = nullptr;

  if ((parmValueLen + parmNameLen + charsetLen + languageLen) <
      PR_MAX_FOLDING_LEN)
  {
    foldedParm = PL_strdup(parmName);
    if (needEscape)
    {
      NS_MsgSACat(&foldedParm, "*=");
      if (charsetLen)
        NS_MsgSACat(&foldedParm, charset.get());
      NS_MsgSACat(&foldedParm, "'");
      if (languageLen)
        NS_MsgSACat(&foldedParm, language);
      NS_MsgSACat(&foldedParm, "'");
    }
    else
      NS_MsgSACat(&foldedParm, "=\"");
    NS_MsgSACat(&foldedParm, dupParm.get());
    if (!needEscape)
      NS_MsgSACat(&foldedParm, "\"");
  }
  else
  {
    int curLineLen = 0;
    int counter = 0;
    char digits[32];
    char *start = dupParm.BeginWriting();
    char *end = NULL;
    char tmp = 0;

    while (parmValueLen > 0)
    {
      curLineLen = 0;
      if (counter == 0) {
        PR_FREEIF(foldedParm)
        foldedParm = PL_strdup(parmName);
      }
      else {
        NS_MsgSACat(&foldedParm, ";\r\n ");
        NS_MsgSACat(&foldedParm, parmName);
      }
      PR_snprintf(digits, sizeof(digits), "*%d", counter);
      NS_MsgSACat(&foldedParm, digits);
      curLineLen += PL_strlen(digits);
      if (needEscape)
      {
        NS_MsgSACat(&foldedParm, "*=");
        if (counter == 0)
        {
          if (charsetLen)
            NS_MsgSACat(&foldedParm, charset.get());
          NS_MsgSACat(&foldedParm, "'");
          if (languageLen)
            NS_MsgSACat(&foldedParm, language);
          NS_MsgSACat(&foldedParm, "'");
          curLineLen += charsetLen;
          curLineLen += languageLen;
        }
      }
      else
      {
        NS_MsgSACat(&foldedParm, "=\"");
      }
      counter++;
      curLineLen += parmNameLen;
      if (parmValueLen <= PR_MAX_FOLDING_LEN - curLineLen)
        end = start + parmValueLen;
      else
        end = start + (PR_MAX_FOLDING_LEN - curLineLen);

      tmp = 0;
      if (*end && needEscape)
      {
        // check to see if we are in the middle of escaped char
        if (*end == '%')
        {
          tmp = '%'; *end = 0;
        }
        else if (end-1 > start && *(end-1) == '%')
        {
          end -= 1; tmp = '%'; *end = 0;
        }
        else if (end-2 > start && *(end-2) == '%')
        {
          end -= 2; tmp = '%'; *end = 0;
        }
        else
        {
          tmp = *end; *end = 0;
        }
      }
      else
      {
        // XXX should check if we are in the middle of escaped char (RFC 822)
        tmp = *end; *end = 0;
      }
      NS_MsgSACat(&foldedParm, start);
      if (!needEscape)
        NS_MsgSACat(&foldedParm, "\"");

      parmValueLen -= (end-start);
      if (tmp)
        *end = tmp;
      start = end;
    }
  }

  return foldedParm;
}

/*static */ char *
LegacyParmFolding(const nsCString& aCharset,
                  const nsCString& aFileName, int32_t aParmFolding)
{
  bool usemime = nsMsgMIMEGetConformToStandard();
  char *encodedRealName =
    nsMsgI18NEncodeMimePartIIStr(aFileName.get(), false, aCharset.get(),
                                 0, usemime);

  if (!encodedRealName || !*encodedRealName) {
    PR_FREEIF(encodedRealName);
    encodedRealName = (char *) PR_Malloc(aFileName.Length() + 1);
    if (encodedRealName)
      PL_strcpy(encodedRealName, aFileName.get());
  }

  // Now put backslashes before special characters per RFC 822
  char *qtextName =
    msg_make_filename_qtext(encodedRealName, aParmFolding == 0);
  if (qtextName) {
    PR_FREEIF(encodedRealName);
    encodedRealName = qtextName;
  }
  return encodedRealName;
}

bool
mime_7bit_data_p (const char *string, uint32_t size)
{
  if ((!string) || (!*string))
    return true;

  char *ptr = (char *)string;
  for (uint32_t i=0; i<size; i++)
  {
    if ((unsigned char) ptr[i] > 0x7F)
      return false;
  }
  return true;
}

/* Strips whitespace, and expands newlines into newline-tab for use in
   mail headers.  Returns a new string or 0 (if it would have been empty.)
   If addr_p is true, the addresses will be parsed and reemitted as
   rfc822 mailboxes.
 */
char *
mime_fix_header_1 (const char *string, bool addr_p, bool news_p)
{
  char *new_string;
  const char *in;
  char *out;
  int32_t i, old_size, new_size;

  if (!string || !*string)
    return 0;

  if (addr_p) {
    nsresult rv = NS_OK;
    nsCOMPtr<nsIMsgHeaderParser> pHeader = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv)) {
      char *n;
      pHeader->ReformatHeaderAddresses(string, &n);
      if (n)        return n;
    }
  }

  old_size = PL_strlen (string);
  new_size = old_size;
  for (i = 0; i < old_size; i++)
    if (string[i] == '\r' || string[i] == '\n')
      new_size += 2;

  new_string = (char *) PR_Malloc (new_size + 1);
  if (! new_string)
    return 0;

  in  = string;
  out = new_string;

  /* strip leading whitespace. */
  while (IS_SPACE (*in))
    in++;

  /* replace CR, LF, or CRLF with CRLF-TAB. */
  while (*in) {
    if (*in == '\r' || *in == '\n') {
      if (*in == '\r' && in[1] == '\n')
        in++;
      in++;
      *out++ = '\r';
      *out++ = '\n';
      *out++ = '\t';
    }
    else
      if (news_p && *in == ',') {
        *out++ = *in++;
        /* skip over all whitespace after a comma. */
        while (IS_SPACE (*in))
          in++;
      }
      else
        *out++ = *in++;
  }
  *out = 0;

  /* strip trailing whitespace. */
  while (out > in && IS_SPACE (out[-1]))
    *out-- = 0;

  /* If we ended up throwing it all away, use 0 instead of "". */
  if (!*new_string) {
    PR_Free (new_string);
    new_string = 0;
  }

  return new_string;
}

char *
mime_fix_header (const char *string)
{
  return mime_fix_header_1 (string, false, false);
}

char *
mime_fix_addr_header (const char *string)
{
  return mime_fix_header_1 (string, true, false);
}

char *
mime_fix_news_header (const char *string)
{
  return mime_fix_header_1 (string, false, true);
}

bool
mime_type_requires_b64_p (const char *type)
{
  if (!type || !PL_strcasecmp (type, UNKNOWN_CONTENT_TYPE))
  /* Unknown types don't necessarily require encoding.  (Note that
     "unknown" and "application/octet-stream" aren't the same.) */
  return false;

  else if (!PL_strncasecmp (type, "image/", 6) ||
       !PL_strncasecmp (type, "audio/", 6) ||
       !PL_strncasecmp (type, "video/", 6) ||
       !PL_strncasecmp (type, "application/", 12))
  {
    /* The following types are application/ or image/ types that are actually
     known to contain textual data (meaning line-based, not binary, where
     CRLF conversion is desired rather than disasterous.)  So, if the type
     is any of these, it does not *require* base64, and if we do need to
     encode it for other reasons, we'll probably use quoted-printable.
     But, if it's not one of these types, then we assume that any subtypes
     of the non-"text/" types are binary data, where CRLF conversion would
     corrupt it, so we use base64 right off the bat.

     The reason it's desirable to ship these as text instead of just using
     base64 all the time is mainly to preserve the readability of them for
     non-MIME users: if I mail a /bin/sh script to someone, it might not
     need to be encoded at all, so we should leave it readable if we can.

     This list of types was derived from the comp.mail.mime FAQ, section
     10.2.2, "List of known unregistered MIME types" on 2-Feb-96.
     */
    static const char *app_and_image_types_which_are_really_text[] = {
    "application/mac-binhex40",   /* APPLICATION_BINHEX */
    "application/pgp",        /* APPLICATION_PGP */
    "application/pgp-keys",
    "application/x-pgp-message",  /* APPLICATION_PGP2 */
    "application/postscript",   /* APPLICATION_POSTSCRIPT */
    "application/x-uuencode",   /* APPLICATION_UUENCODE */
    "application/x-uue",      /* APPLICATION_UUENCODE2 */
    "application/uue",        /* APPLICATION_UUENCODE4 */
    "application/uuencode",     /* APPLICATION_UUENCODE3 */
    "application/sgml",
    "application/x-csh",
    "application/javascript",
    "application/ecmascript",
    "application/x-javascript",
    "application/x-latex",
    "application/x-macbinhex40",
    "application/x-ns-proxy-autoconfig",
    "application/x-www-form-urlencoded",
    "application/x-perl",
    "application/x-sh",
    "application/x-shar",
    "application/x-tcl",
    "application/x-tex",
    "application/x-texinfo",
    "application/x-troff",
    "application/x-troff-man",
    "application/x-troff-me",
    "application/x-troff-ms",
    "application/x-troff-ms",
    "application/x-wais-source",
    "image/x-bitmap",
    "image/x-pbm",
    "image/x-pgm",
    "image/x-portable-anymap",
    "image/x-portable-bitmap",
    "image/x-portable-graymap",
    "image/x-portable-pixmap",    /* IMAGE_PPM */
    "image/x-ppm",
    "image/x-xbitmap",        /* IMAGE_XBM */
    "image/x-xbm",          /* IMAGE_XBM2 */
    "image/xbm",          /* IMAGE_XBM3 */
    "image/x-xpixmap",
    "image/x-xpm",
    0 };
    const char **s;
    for (s = app_and_image_types_which_are_really_text; *s; s++)
    if (!PL_strcasecmp (type, *s))
      return false;

    /* All others must be assumed to be binary formats, and need Base64. */
    return true;
  }

  else
  return false;
}

//
// Some types should have a "charset=" parameter, and some shouldn't.
// This is what decides.
//
bool
mime_type_needs_charset (const char *type)
{
  /* Only text types should have charset. */
  if (!type || !*type)
    return false;
  else
    if (!PL_strncasecmp (type, "text", 4))
      return true;
    else
      return false;
}

/* Given a string, convert it to 'qtext' (quoted text) for RFC822 header purposes. */
char *
msg_make_filename_qtext(const char *srcText, bool stripCRLFs)
{
  /* newString can be at most twice the original string (every char quoted). */
  char *newString = (char *) PR_Malloc(PL_strlen(srcText)*2 + 1);
  if (!newString) return NULL;

  const char *s = srcText;
  const char *end = srcText + PL_strlen(srcText);
  char *d = newString;

  while(*s)
  {
    /*  Put backslashes in front of existing backslashes, or double quote
      characters.
      If stripCRLFs is true, don't write out CRs or LFs. Otherwise,
      write out a backslash followed by the CR but not
      linear-white-space.
      We might already have quoted pair of "\ " or "\\t" skip it.
      */
    if (*s == '\\' || *s == '"' ||
      (!stripCRLFs &&
       (*s == '\r' && (s[1] != '\n' ||
               (s[1] == '\n' && (s+2) < end && !IS_SPACE(s[2]))))))
      *d++ = '\\';

    if (stripCRLFs && *s == '\r' && s[1] == '\n' && (s+2) < end && IS_SPACE(s[2]))
    {
        s += 3;     // skip CRLFLWSP
    }
    else
    {
      *d++ = *s++;
    }
  }
  *d = 0;

  return newString;
}

/* Rip apart the URL and extract a reasonable value for the `real_name' slot.
 */
void
msg_pick_real_name (nsMsgAttachmentHandler *attachment, const PRUnichar *proposedName, const char *charset)
{
  const char *s, *s2;

  if (!attachment->m_realName.IsEmpty())
    return;

  if (proposedName && *proposedName)
  {
    attachment->m_realName.Adopt(ToNewUTF8String(nsAutoString(proposedName)));
  }
  else //Let's extract the name from the URL
  {
    nsCString url;
    attachment->mURL->GetSpec(url);

    s = url.get();
    s2 = PL_strchr (s, ':');
    if (s2)
      s = s2 + 1;
    /* If we know the URL doesn't have a sensible file name in it,
     don't bother emitting a content-disposition. */
    if (StringBeginsWith (url, NS_LITERAL_CSTRING("news:"), nsCaseInsensitiveCStringComparator()) ||
        StringBeginsWith (url, NS_LITERAL_CSTRING("snews:"), nsCaseInsensitiveCStringComparator()) ||
        StringBeginsWith (url, NS_LITERAL_CSTRING("IMAP:"), nsCaseInsensitiveCStringComparator()) ||
        StringBeginsWith (url, NS_LITERAL_CSTRING("mailbox:"), nsCaseInsensitiveCStringComparator()))
      return;

    if (StringBeginsWith(url, NS_LITERAL_CSTRING("data:"),
                         nsCaseInsensitiveCStringComparator()))
    {
      int32_t endNonData = url.FindChar(',');
      if (endNonData == -1)
        return;
      nsCString nonDataPart(Substring(url, 5, endNonData - 5));
      int32_t filenamePos = nonDataPart.Find("filename=");
      if (filenamePos != -1)
      {
        filenamePos += 9;
        int32_t endFilename = nonDataPart.FindChar(';', filenamePos);
        if (endFilename == -1)
          endFilename = endNonData;
        attachment->m_realName = Substring(nonDataPart, filenamePos,
                                           endFilename - filenamePos);
      }
      else
      {
        // no filename; need to construct one based on the content type.
        nsCOMPtr<nsIMIMEService> mimeService(do_GetService(NS_MIMESERVICE_CONTRACTID));
        if (!mimeService)
          return;
        nsCOMPtr<nsIMIMEInfo> mimeInfo;
        nsCString mediaType(Substring(nonDataPart, 0, nonDataPart.FindChar(';')));
        mimeService->GetFromTypeAndExtension(mediaType, EmptyCString(), getter_AddRefs(mimeInfo));
        if (!mimeInfo)
          return;
        nsCString filename;
        nsCString extension;
        mimeInfo->GetPrimaryExtension(extension);
        unsigned char filePrefix[10];
        GenerateGlobalRandomBytes(filePrefix, 8);
        for (int32_t i = 0; i < 8; i++)
          filename.Append(filePrefix[i] + 'a');
        filename.Append('.');
        filename.Append(extension);
        attachment->m_realName = filename;
      }
    }
    else
    {
      /* Take the part of the file name after the last / or \ */
      s2 = PL_strrchr (s, '/');
      if (s2) s = s2+1;
      s2 = PL_strrchr (s, '\\');

      if (s2) s = s2+1;
      /* Copy it into the attachment struct. */
      attachment->m_realName = s;
      int32_t charPos = attachment->m_realName.FindChar('?');
      if (charPos != -1)
        attachment->m_realName.SetLength(charPos);
      /* Now trim off any named anchors or search data. */
      charPos = attachment->m_realName.FindChar('#');
      if (charPos != -1)
        attachment->m_realName.SetLength(charPos);
    }
    /* Now lose the %XX crap. */
    nsCString unescaped_real_name;
    MsgUnescapeString(attachment->m_realName, 0, unescaped_real_name);
    attachment->m_realName = unescaped_real_name;
  }

  /* Now a special case for attaching uuencoded files...

   If we attach a file "foo.txt.uu", we will send it out with
   Content-Type: text/plain; Content-Transfer-Encoding: x-uuencode.
   When saving such a file, a mail reader will generally decode it first
   (thus removing the uuencoding.)  So, let's make life a little easier by
   removing the indication of uuencoding from the file name itself.  (This
   will presumably make the file name in the Content-Disposition header be
   the same as the file name in the "begin" line of the uuencoded data.)

   However, since there are mailers out there (including earlier versions of
   Mozilla) that will use "foo.txt.uu" as the file name, we still need to
   cope with that; the code which copes with that is in the MIME parser, in
   libmime/mimei.c.
   */
  if (attachment->m_already_encoded_p && !attachment->m_encoding.IsEmpty())
  {
    /* #### TOTAL KLUDGE.
     I'd like to ask the mime.types file, "what extensions correspond
     to obj->encoding (which happens to be "x-uuencode") but doing that
     in a non-sphagetti way would require brain surgery.  So, since
     currently uuencode is the only content-transfer-encoding which we
     understand which traditionally has an extension, we just special-
     case it here!

     Note that it's special-cased in a similar way in libmime/mimei.c.
     */
    if (attachment->m_encoding.LowerCaseEqualsLiteral(ENCODING_UUENCODE) ||
        attachment->m_encoding.LowerCaseEqualsLiteral(ENCODING_UUENCODE2) ||
        attachment->m_encoding.LowerCaseEqualsLiteral(ENCODING_UUENCODE3) ||
        attachment->m_encoding.LowerCaseEqualsLiteral(ENCODING_UUENCODE4))
    {
      if (StringEndsWith(attachment->m_realName, NS_LITERAL_CSTRING(".uu")))
        attachment->m_realName.Cut(attachment->m_realName.Length() - 3, 3);
      else if (StringEndsWith(attachment->m_realName, NS_LITERAL_CSTRING(".uue")))
        attachment->m_realName.Cut(attachment->m_realName.Length() - 4, 4);
    }
  }
}

// Utility to create a nsIURI object...
nsresult
nsMsgNewURL(nsIURI** aInstancePtrResult, const char * aSpec)
{
  nsresult rv = NS_OK;
  if (nullptr == aInstancePtrResult)
    return NS_ERROR_NULL_POINTER;
  nsCOMPtr<nsIIOService> pNetService =
    mozilla::services::GetIOService();
  NS_ENSURE_TRUE(pNetService, NS_ERROR_UNEXPECTED);
  if (PL_strstr(aSpec, "://") == nullptr && strncmp(aSpec, "data:", 5))
  {
    //XXXjag Temporary fix for bug 139362 until the real problem(bug 70083) get fixed
    nsAutoCString uri(NS_LITERAL_CSTRING("http://"));
    uri.Append(aSpec);
    rv = pNetService->NewURI(uri, nullptr, nullptr, aInstancePtrResult);
  }
  else
    rv = pNetService->NewURI(nsDependentCString(aSpec), nullptr, nullptr, aInstancePtrResult);
  return rv;
}

bool
nsMsgIsLocalFile(const char *url)
{
  /*
    A url is considered as a local file if it's start with file://
    But on Window, we need to filter UNC file url because there
    are not really local file. Those start with file:////
  */
  if (PL_strncasecmp(url, "file://", 7) == 0)
  {
#ifdef XP_WIN
    if (PL_strncasecmp(url, "file:////", 9) == 0)
      return false;
#endif
    return true;
  }
  else
    return false;
}

char
*nsMsgGetLocalFileFromURL(const char *url)
{
  char * finalPath;
  NS_ASSERTION(PL_strncasecmp(url, "file://", 7) == 0, "invalid url");
  finalPath = (char*)PR_Malloc(strlen(url));
  if (finalPath == NULL)
    return NULL;
  strcpy(finalPath, url+6+1);
  return finalPath;
}

char *
nsMsgParseURLHost(const char *url)
{
  nsIURI        *workURI = nullptr;
  nsresult      rv;

  rv = nsMsgNewURL(&workURI, url);
  if (NS_FAILED(rv) || !workURI)
    return nullptr;

  nsAutoCString host;
  rv = workURI->GetHost(host);
  NS_IF_RELEASE(workURI);
  if (NS_FAILED(rv))
    return nullptr;

  return ToNewCString(host);
}

char *
GenerateFileNameFromURI(nsIURI *aURL)
{
  nsresult    rv;
  nsCString file;
  nsCString spec;
  char        *returnString;
  char        *cp = nullptr;
  char        *cp1 = nullptr;

  rv = aURL->GetPath(file);
  if ( NS_SUCCEEDED(rv) && !file.IsEmpty())
  {
    char *newFile = ToNewCString(file);
    if (!newFile)
      return nullptr;

    // strip '/'
    cp = PL_strrchr(newFile, '/');
    if (cp)
      ++cp;
    else
      cp = newFile;

    if (*cp)
    {
      if ((cp1 = PL_strchr(cp, '/'))) *cp1 = 0;
      if ((cp1 = PL_strchr(cp, '?'))) *cp1 = 0;
      if ((cp1 = PL_strchr(cp, '>'))) *cp1 = 0;
      if (*cp != '\0')
      {
        returnString = PL_strdup(cp);
        PR_FREEIF(newFile);
        return returnString;
      }
    }
    else
      return nullptr;
  }

  cp = nullptr;
  cp1 = nullptr;


  rv = aURL->GetSpec(spec);
  if ( NS_SUCCEEDED(rv) && !spec.IsEmpty())
  {
    char *newSpec = ToNewCString(spec);
    if (!newSpec)
      return nullptr;

    char *cp2 = NULL, *cp3=NULL ;

    // strip '"'
    cp2 = newSpec;
    while (*cp2 == '"')
      cp2++;
    if ((cp3 = PL_strchr(cp2, '"')))
      *cp3 = 0;

    char *hostStr = nsMsgParseURLHost(cp2);
    if (!hostStr)
      hostStr = PL_strdup(cp2);

    bool isHTTP = false;
    if (NS_SUCCEEDED(aURL->SchemeIs("http", &isHTTP)) && isHTTP)
    {
        returnString = PR_smprintf("%s.html", hostStr);
        PR_FREEIF(hostStr);
    }
    else
      returnString = hostStr;

    PR_FREEIF(newSpec);
    return returnString;
  }

  return nullptr;
}

//
// This routine will generate a content id for use in a mail part.
// It will take the part number passed in as well as the email
// address. If the email address is null or invalid, we will simply
// use netscape.com for the interesting part. The content ID's will
// look like the following:
//
//      Content-ID: <part1.36DF1DCE.73B5A330@netscape.com>
//
char *
mime_gen_content_id(uint32_t aPartNum, const char *aEmailAddress)
{
  int32_t           randLen = 5;
  unsigned char     rand_buf1[5];
  unsigned char     rand_buf2[5];
  const char        *domain = nullptr;
  const char        *defaultDomain = "@netscape.com";

  memset(rand_buf1, 0, randLen-1);
  memset(rand_buf2, 0, randLen-1);

  GenerateGlobalRandomBytes(rand_buf1, randLen);
  GenerateGlobalRandomBytes(rand_buf2, randLen);

  // Find the @domain.com string...
  if (aEmailAddress && *aEmailAddress)
    domain = const_cast<const char*>(PL_strchr(aEmailAddress, '@'));

  if (!domain)
    domain = defaultDomain;

  char *retVal = PR_smprintf("part%d."
                              "%02X%02X%02X%02X"
                              "."
                              "%02X%02X%02X%02X"
                              "%s",
                              aPartNum,
                              rand_buf1[0], rand_buf1[1], rand_buf1[2], rand_buf1[3],
                              rand_buf2[0], rand_buf2[1], rand_buf2[2], rand_buf2[3],
                              domain);

  return retVal;
}

void
GetFolderURIFromUserPrefs(nsMsgDeliverMode aMode, nsIMsgIdentity* identity, nsCString& uri)
{
  nsresult rv;
  uri.Truncate();

  // QueueForLater (Outbox)
  if (aMode == nsIMsgSend::nsMsgQueueForLater ||
      aMode == nsIMsgSend::nsMsgDeliverBackground)
  {
    nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    if (NS_FAILED(rv))
      return;
    rv = prefs->GetCharPref("mail.default_sendlater_uri", getter_Copies(uri));
    if (NS_FAILED(rv) || uri.IsEmpty())
      uri.AssignLiteral(ANY_SERVER);
    else
    {
      // check if uri is unescaped, and if so, escape it and reset the pef.
      if (uri.FindChar(' ') != kNotFound)
      {
        MsgReplaceSubstring(uri, " ", "%20");
        prefs->SetCharPref("mail.default_sendlater_uri", uri.get());
      }
    }
    return;
  }

  if (!identity)
    return;

  if (aMode == nsIMsgSend::nsMsgSaveAsDraft)    // SaveAsDraft (Drafts)
    rv = identity->GetDraftFolder(uri);
  else if (aMode == nsIMsgSend::nsMsgSaveAsTemplate) // SaveAsTemplate (Templates)
    rv = identity->GetStationeryFolder(uri);
  else
  {
    bool doFcc = false;
    rv = identity->GetDoFcc(&doFcc);
    if (doFcc)
      rv = identity->GetFccFolder(uri);
  }
  return;
}

/**
 * Check if we should use format=flowed (RFC 2646) for a mail.
 *
 * We will use format=flowed unless prefs tells us not to do
 * or if a charset which are known to have problems with
 * format=flowed is specified. (See bug 26734 in Bugzilla)
 */
bool UseFormatFlowed(const char *charset)
{
  // Add format=flowed as in RFC 2646 unless asked to not do that.
  bool sendFlowed = true;
  bool disableForCertainCharsets = true;
  nsresult rv;

  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return false;

  rv = prefs->GetBoolPref("mailnews.send_plaintext_flowed", &sendFlowed);
  if (NS_SUCCEEDED(rv) && !sendFlowed)
    return false;

  // If we shouldn't care about charset, then we are finished
  // checking and can go on using format=flowed
  if(!charset)
    return true;
  rv = prefs->GetBoolPref("mailnews.disable_format_flowed_for_cjk",
                          &disableForCertainCharsets);
  if (NS_SUCCEEDED(rv) && !disableForCertainCharsets)
    return true;

  // Just the check for charset left.

  // This is a raw check and might include charsets which could
  // use format=flowed and might exclude charsets which couldn't
  // use format=flowed.
  //
  // The problem is the SPACE format=flowed inserts at the end of
  // the line. Not all charsets like that.
  return !(PL_strcasecmp(charset, "UTF-8") && nsMsgI18Nmultibyte_charset(charset));
}
