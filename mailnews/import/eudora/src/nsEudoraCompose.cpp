/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "prthread.h"
#include "nsStringGlue.h"
#include "nsMsgUtils.h"
#include "nsUnicharUtils.h"
#include "nsCOMPtr.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsIIOService.h"
#include "nsIURI.h"
#include "nsIOutputStream.h"
#include "nsThreadUtils.h"

#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"

#include "nsIMsgCompose.h"
#include "nsIMsgCompFields.h"
#include "nsIMsgSend.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgI18N.h"

#include "nsNetCID.h"

#include "nsEudoraCompose.h"
#include "nsEudoraEditor.h"

#include "EudoraDebugLog.h"

#include "nsMimeTypes.h"
#include "nsCRT.h"
#include "nsNetUtil.h"
#include "nsAutoPtr.h"
#include "nsIMutableArray.h"

static NS_DEFINE_CID(kMsgSendCID, NS_MSGSEND_CID);
static NS_DEFINE_CID(kMsgCompFieldsCID, NS_MSGCOMPFIELDS_CID);

// We need to do some calculations to set these numbers to something reasonable!
// Unless of course, CreateAndSendMessage will NEVER EVER leave us in the lurch
#define kHungCount 100000
#define kHungAbortCount 1000

// Define maximum possible length for content type sanity check
#define kContentTypeLengthSanityCheck 32


#ifdef IMPORT_DEBUG
static char *p_test_headers =
"Received: from netppl.invalid (IDENT:monitor@get.freebsd.because.microsoftsucks.invalid [209.3.31.115])\n\
 by mail4.sirius.invalid (8.9.1/8.9.1) with SMTP id PAA27232;\n\
 Mon, 17 May 1999 15:27:43 -0700 (PDT)\n\
Message-ID: <ikGD3jRTsKklU.Ggm2HmE2A1Jsqd0p@netppl.invalid>\n\
From: \"adsales@qualityservice.invalid\" <adsales@qualityservice.invalid>\n\
Subject: Re: Your College Diploma (36822)\n\
Date: Mon, 17 May 1999 15:09:29 -0400 (EDT)\n\
MIME-Version: 1.0\n\
Content-Type: TEXT/PLAIN; charset=\"US-ASCII\"\n\
Content-Transfer-Encoding: 7bit\n\
X-UIDL: 19990517.152941\n\
Status: RO";

static char *p_test_body =
"Hello world?\n\
";
#else
#define p_test_headers nullptr
#define p_test_body nullptr
#endif


#define kWhitespace "\b\t\r\n "

// The identity that we use in SendTheMessage is now a static. Previously the
// identity was being created and destroyed for every Eudora message imported.
// Now we create the identity when needed and keep it around until ReleaseIdentity
// is called (after Eudora email importing is complete - currently called in
// ~ImportEudoraMailImpl).
//
// This change was identified via profiling and has sped up importing email
// from Eudora over 5x on my computer (test importing of my email went from
// 6.5 hours to less than 1.2 hours). Importing from Eudora is still slow
// in my opinion, but bearably slow now.
nsIMsgIdentity * nsEudoraCompose::s_pIdentity = nullptr;


// First off, a listener
class EudoraSendListener : public nsIMsgSendListener
{
public:
  EudoraSendListener() {
    m_done = false;
  }

  virtual ~EudoraSendListener() {}

  // nsISupports interface
  NS_DECL_THREADSAFE_ISUPPORTS

  /* void OnStartSending (in string aMsgID, in uint32_t aMsgSize); */
  NS_IMETHOD OnStartSending(const char *aMsgID, uint32_t aMsgSize) {return NS_OK;}

  /* void OnProgress (in string aMsgID, in uint32_t aProgress, in uint32_t aProgressMax); */
  NS_IMETHOD OnProgress(const char *aMsgID, uint32_t aProgress, uint32_t aProgressMax) {return NS_OK;}

  /* void OnStatus (in string aMsgID, in wstring aMsg); */
  NS_IMETHOD OnStatus(const char *aMsgID, const PRUnichar *aMsg) {return NS_OK;}

  /* void OnStopSending (in string aMsgID, in nsresult aStatus, in wstring aMsg, in nsIFile returnFile); */
  NS_IMETHOD OnStopSending(const char *aMsgID, nsresult aStatus, const PRUnichar *aMsg,
               nsIFile *returnFile) {
    m_done = true;
    m_location = returnFile;
    return NS_OK;
  }

    /* void OnSendNotPerformed */
    NS_IMETHOD OnSendNotPerformed(const char *aMsgID, nsresult aStatus) {return NS_OK;}

  /* void OnGetDraftFolderURI (); */
  NS_IMETHOD OnGetDraftFolderURI(const char *aFolderURI) {return NS_OK;}

  static nsresult CreateSendListener(nsIMsgSendListener **ppListener);

  void Reset() { m_done = false;  m_location = nullptr;}

public:
  bool m_done;
  nsCOMPtr <nsIFile> m_location;
};


NS_IMPL_ISUPPORTS1(EudoraSendListener, nsIMsgSendListener)

nsresult EudoraSendListener::CreateSendListener(nsIMsgSendListener **ppListener)
{
  NS_ENSURE_ARG_POINTER(ppListener);
  *ppListener = new EudoraSendListener();
  NS_ENSURE_TRUE(*ppListener, NS_ERROR_OUT_OF_MEMORY);
  NS_ADDREF(*ppListener);
  return NS_OK;
}


/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////



nsEudoraCompose::nsEudoraCompose()
{
  m_pAttachments = nullptr;
  m_pListener = nullptr;
  m_pMsgFields = nullptr;
  m_pHeaders = p_test_headers;
  if (m_pHeaders)
    m_headerLen = strlen(m_pHeaders);
  else
    m_headerLen = 0;
  m_pBody = p_test_body;
  if (m_pBody)
    m_bodyLen = strlen(m_pBody);
  else
    m_bodyLen = 0;

  m_readHeaders.m_convertCRs = true;
}


nsEudoraCompose::~nsEudoraCompose()
{
  NS_IF_RELEASE(m_pListener);
  NS_IF_RELEASE(m_pMsgFields);
}

nsresult nsEudoraCompose::CreateIdentity(void)
{
  if (s_pIdentity)
    return NS_OK;

  // Should only create identity from main thread
  NS_ENSURE_TRUE(NS_IsMainThread(), NS_ERROR_FAILURE);
  nsresult rv;
  nsCOMPtr<nsIMsgAccountManager> accMgr(do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = accMgr->CreateIdentity(&s_pIdentity);
  nsString name(NS_LITERAL_STRING("Import Identity"));
  if (s_pIdentity) {
    s_pIdentity->SetFullName(name);
    s_pIdentity->SetIdentityName(name);
    s_pIdentity->SetEmail(NS_LITERAL_CSTRING("import@import.service"));

    // SetDoFcc to false to save time when CreateAndSendMessage operates.
    // Profiling revealed that GetFolderURIFromUserPrefs was taking up a significant chunk
    // of time during the operation of CreateAndSendMessage. By calling SetDoFcc(false),
    // we skip Fcc handling code inside of InitCompositionFields (called indirectly during
    // CreateAndSendMessage operation). There's no point in any Fcc code firing since the
    // message will never actually be sent anyway.
    s_pIdentity->SetDoFcc(false);
  }
  return rv;
}

void nsEudoraCompose::ReleaseIdentity(void)
{
  if (s_pIdentity) {
    nsresult rv = s_pIdentity->ClearAllValues();
    NS_ASSERTION(NS_SUCCEEDED(rv),"failed to clear values");
    if (NS_FAILED(rv)) return;

    NS_RELEASE(s_pIdentity);
  }
}


nsresult nsEudoraCompose::CreateComponents(void)
{
  nsresult  rv = NS_OK;

  if (!m_pIOService) {
    IMPORT_LOG0("Creating nsIOService\n");
    
    m_pIOService = do_GetService(NS_IOSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  NS_IF_RELEASE(m_pMsgFields);
  if (!m_pListener && NS_SUCCEEDED(rv))
    rv = EudoraSendListener::CreateSendListener(&m_pListener);

  if (NS_SUCCEEDED(rv)) {
      rv = CallCreateInstance(kMsgCompFieldsCID, &m_pMsgFields);
    if (NS_SUCCEEDED(rv) && m_pMsgFields) {
      // IMPORT_LOG0("nsOutlookCompose - CreateComponents succeeded\n");
      m_pMsgFields->SetForcePlainText(false);
      return NS_OK;
    }
  }

  return NS_ERROR_FAILURE;
}

void nsEudoraCompose::GetNthHeader(const char *pData,
                                   int32_t dataLen,
                                   int32_t n,
                                   nsCString& header,
                                   nsCString& val,
                                   bool unwrap)
{
  header.Truncate();
  val.Truncate();
  if (!pData)
    return;

  int32_t index = 0;
  int32_t len;
  int32_t start = 0;
  const char *pChar = pData;
  const char *pStart;
  if (n == 0) {
    pStart = pChar;
    len = 0;
    while ((start < dataLen) && (*pChar != ':')) {
      start++;
      len++;
      pChar++;
    }
    header.Append(pStart, len);
    header.Trim(kWhitespace);
    start++;
    pChar++;
  }
  else {
    while (start < dataLen) {
      if ((*pChar != ' ') && (*pChar != '\t')) {
        if (n == index) {
          pStart = pChar;
          len = 0;
          while ((start < dataLen) && (*pChar != ':')) {
            start++;
            len++;
            pChar++;
          }
          header.Append(pStart, len);
          header.Trim(kWhitespace);
          start++;
          pChar++;
          break;
        }
        else
          index++;
      }

      // Skip to next end of line.
      while ((start < dataLen) &&
             (*pChar != nsCRT::CR) && (*pChar != nsCRT::LF)) {
        start++;
        pChar++;
      }
      // Skip over end of line(s).
      while ((start < dataLen) &&
             ((*pChar == nsCRT::CR) || (*pChar == nsCRT::LF))) {
        start++;
        pChar++;
      }
    }
  }

  if (start >= dataLen)
    return;

  int32_t lineEnd;
  int32_t end = start;
  while (end < dataLen) {
    // Skip to next end of line.
    while ((end < dataLen) && (*pChar != nsCRT::CR) && (*pChar != nsCRT::LF)) {
      end++;
      pChar++;
    }

    if (end > start) {
      val.Append(pData + start, end - start);
    }

    lineEnd = end;
    pStart = pChar;

    // Skip over end of line(s).
    while ((end < dataLen) &&
           ((*pChar == nsCRT::CR) || (*pChar == nsCRT::LF))) {
      end++;
      pChar++;
    }

    start = end;

    // Skip over space(s) and tab(s).
    while ((end < dataLen) && ((*pChar == ' ') || (*pChar == '\t'))) {
      end++;
      pChar++;
    }

    if (start == end)
      break;

    if (unwrap)
      val.Append(' ');
    else {
      val.Append(pStart, end - lineEnd);
    }

    start = end;
  }

  val.Trim(kWhitespace);
}


void nsEudoraCompose::GetHeaderValue(const char *pData,
                                     int32_t dataLen,
                                     const char *pHeader,
                                     nsCString& val,
                                     bool unwrap)
{
  val.Truncate();
  if (!pData)
    return;

  int32_t  start = 0;
  int32_t len = strlen(pHeader);
  const char *pChar = pData;
  if (!PL_strncasecmp(pHeader, pData, len)) {
    start = len;
  }
  else {
    while (start < dataLen) {
      // Skip to next end of line.
      while ((start < dataLen) &&
             (*pChar != nsCRT::CR) && (*pChar != nsCRT::LF)) {
        start++;
        pChar++;
      }
      // Skip over end of line(s).
      while ((start < dataLen) &&
             ((*pChar == nsCRT::CR) || (*pChar == nsCRT::LF))) {
        start++;
        pChar++;
      }

      if ((start < dataLen) && !PL_strncasecmp(pChar, pHeader, len))
        break;
    }
    if (start < dataLen)
      start += len;
  }

  if (start >= dataLen)
    return;

  int32_t end = start;
  int32_t lineEnd;
  const char * pStart;

  pChar = pData + start;

  while (end < dataLen) {
    // Skip to next end of line.
    while ((end < dataLen) && (*pChar != nsCRT::CR) && (*pChar != nsCRT::LF)) {
      end++;
      pChar++;
    }

    if (end > start)
      val.Append(pData + start, end - start);

    lineEnd = end;
    pStart = pChar;

    // Skip over the end of line(s).
    while ((end < dataLen) &&
           ((*pChar == nsCRT::CR) || (*pChar == nsCRT::LF))) {
      end++;
      pChar++;
    }

    start = end;

    // Skip over space(s) and tab(s).
    while ((end < dataLen) && ((*pChar == ' ') || (*pChar == '\t'))) {
      end++;
      pChar++;
    }

    if (start == end)
      break;

    if (unwrap)
      val.Append(' ');
    else {
      val.Append(pStart, end - lineEnd);
    }

    start = end;
  }

  val.Trim(kWhitespace);
}


void nsEudoraCompose::ExtractCharset(nsString& str)
{
  int32_t idx = MsgFind(str, "charset=", true, 0);
  if (idx != -1) {
    str.Cut(0, idx + 8);
    idx = str.FindChar(';');
    if (idx != -1)
      str.SetLength(idx);
    str.Trim(kWhitespace);
    if ((str.CharAt(0) == '"') && (str.Length() > 2)) {
      str.SetLength(str.Length() - 1);
      str.Cut(0, 1);
      str.Trim(kWhitespace);
    }
  }
  else
    str.Truncate();
}

void nsEudoraCompose::ExtractType(nsString& str)
{
  nsString tStr;
  int32_t idx = str.FindChar(';');
  if (idx != -1)
    str.SetLength(idx);

  str.Trim(kWhitespace);

  if ((str.CharAt(0) == '"') && (str.Length() > 2)) {
    str.SetLength(str.Length() - 1);
    str.Cut(0, 1);
    str.Trim(kWhitespace);
  }

  // if multipart then ignore it since no outlook message body is ever
  // valid multipart!
  if (StringBeginsWith(str, NS_LITERAL_STRING("multipart/"), nsCaseInsensitiveStringComparator()))
    str.Truncate();
}

nsresult nsEudoraCompose::GetLocalAttachments(nsIArray **aArray)
{
  /*
  nsIURI      *url = nullptr;
  */
  nsresult rv;
  nsCOMPtr<nsIMutableArray> attachments (do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  NS_IF_ADDREF(*aArray = attachments);
  int32_t count = 0;
  if (m_pAttachments)
    count = m_pAttachments->Count();
  if (!count)
    return NS_OK;

  nsCString urlStr;
  ImportAttachment * pAttach;

  for (int32_t i = 0; i < count; i++) {
    nsCOMPtr<nsIMsgAttachedFile> a(do_CreateInstance(NS_MSGATTACHEDFILE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    // nsMsgNewURL(&url, "file://C:/boxster.jpg");
    // a[i].orig_url = url;

    pAttach = (ImportAttachment *) m_pAttachments->ElementAt(i);
    nsCOMPtr<nsIFile> tmpFile = do_QueryInterface(pAttach->pAttachment);
    a->SetTmpFile(tmpFile);
    urlStr.Adopt(0);

    nsCOMPtr <nsIURI> uri;
    nsresult rv = NS_NewFileURI(getter_AddRefs(uri), pAttach->pAttachment);
    NS_ENSURE_SUCCESS(rv, rv);
    uri->GetSpec(urlStr);
    if (urlStr.IsEmpty())
      return NS_ERROR_FAILURE;

    nsCOMPtr<nsIURI> origUrl;
    rv = m_pIOService->NewURI(urlStr, nullptr, nullptr, getter_AddRefs(origUrl));
    NS_ENSURE_SUCCESS(rv, rv);
    a->SetOrigUrl(origUrl);
    a->SetType(nsDependentCString(pAttach->mimeType));
    a->SetRealName(nsDependentCString(pAttach->description));
    a->SetEncoding(NS_LITERAL_CSTRING(ENCODING_BINARY));
    attachments->AppendElement(a, false);
  }
  return NS_OK;
}

// Test a message send????
nsresult nsEudoraCompose::SendTheMessage(nsIFile *pMailImportLocation, nsIFile **pMsg)
{
  nsresult rv = CreateComponents();
  if (NS_FAILED(rv))
    return rv;

  // IMPORT_LOG0("Outlook Compose created necessary components\n");

  nsString bodyType;
  nsString charSet;
  nsString headerVal;
  GetHeaderValue(m_pHeaders, m_headerLen, "From:", headerVal);
  if (!headerVal.IsEmpty())
    m_pMsgFields->SetFrom(headerVal);
  GetHeaderValue(m_pHeaders, m_headerLen, "To:", headerVal);
  if (!headerVal.IsEmpty())
    m_pMsgFields->SetTo(headerVal);
  GetHeaderValue(m_pHeaders, m_headerLen, "Subject:", headerVal);
  if (!headerVal.IsEmpty())
    m_pMsgFields->SetSubject(headerVal);
  GetHeaderValue(m_pHeaders, m_headerLen, "Content-type:", headerVal);
  bodyType = headerVal;
  ExtractType(bodyType);
  ExtractCharset(headerVal);
  // Use platform charset as default if the msg doesn't specify one
  // (ie, no 'charset' param in the Content-Type: header). As the last
  // resort we'll use the mail default charset.
  // (ie, no 'charset' param in the Content-Type: header) or if the
  // charset parameter fails a length sanity check.
  // As the last resort we'll use the mail default charset.
  if (headerVal.IsEmpty() || (headerVal.Length() > kContentTypeLengthSanityCheck))
  {
    headerVal.AssignASCII(nsMsgI18NFileSystemCharset());
    if (headerVal.IsEmpty())
    { // last resort
      if (m_defCharset.IsEmpty())
      {
        nsString defaultCharset;
        NS_GetLocalizedUnicharPreferenceWithDefault(nullptr, "mailnews.view_default_charset",
                                                    NS_LITERAL_STRING("ISO-8859-1"), defaultCharset);
        m_defCharset = defaultCharset;
      }
      headerVal = m_defCharset;
    }
  }
  m_pMsgFields->SetCharacterSet(NS_LossyConvertUTF16toASCII(headerVal).get());
  charSet = headerVal;
  GetHeaderValue(m_pHeaders, m_headerLen, "CC:", headerVal);
  if (!headerVal.IsEmpty())
    m_pMsgFields->SetCc(headerVal);
  GetHeaderValue(m_pHeaders, m_headerLen, "Message-ID:", headerVal);
  if (!headerVal.IsEmpty())
    m_pMsgFields->SetMessageId(NS_LossyConvertUTF16toASCII(headerVal).get());
  GetHeaderValue(m_pHeaders, m_headerLen, "Reply-To:", headerVal);
  if (!headerVal.IsEmpty())
    m_pMsgFields->SetReplyTo(headerVal);

  // what about all of the other headers?!?!?!?!?!?!
  char *pMimeType;
  if (!bodyType.IsEmpty())
    pMimeType = ToNewCString(NS_LossyConvertUTF16toASCII(bodyType));
  else
    pMimeType = ToNewCString(m_bodyType);

  nsCOMPtr<nsIArray> pAttach;
  GetLocalAttachments(getter_AddRefs(pAttach));
  nsEudoraEditor eudoraEditor(m_pBody, pMailImportLocation);
  nsCOMPtr<nsISupportsArray> embeddedObjects;
  if (eudoraEditor.HasEmbeddedContent())
    eudoraEditor.GetEmbeddedObjects(getter_AddRefs(embeddedObjects));

  nsString uniBody;
  NS_CopyNativeToUnicode(nsDependentCString(m_pBody), uniBody);

  /*
    l10n - I have the body of the message in the system charset,
    I need to "encode" it to be the charset for the message
    *UNLESS* of course, I don't know what the charset of the message
    should be?  How do I determine what the charset should
    be if it doesn't exist?

  */

  nsCString body;

  rv = nsMsgI18NConvertFromUnicode(NS_LossyConvertUTF16toASCII(charSet).get(),
                                    uniBody, body);
  if (NS_FAILED(rv) && !charSet.Equals(m_defCharset)) {
    // in this case, if we did not use the default compose
    // charset, then try that.
    body.Truncate();
    rv = nsMsgI18NConvertFromUnicode(NS_LossyConvertUTF16toASCII(charSet).get(),
                                     uniBody, body);
  }
  uniBody.Truncate();


  // See if it's a draft msg (ie, no From: or no To: AND no Cc: AND no Bcc:).
  // Eudora saves sent and draft msgs in Out folder (ie, mixed) and it does
  // store Bcc: header in the msg itself.
  nsAutoString from, to, cc, bcc;
  rv = m_pMsgFields->GetFrom(from);
  rv = m_pMsgFields->GetTo(to);
  rv = m_pMsgFields->GetCc(cc);
  rv = m_pMsgFields->GetBcc(bcc);
  bool createAsDraft = from.IsEmpty() || to.IsEmpty() && cc.IsEmpty() && bcc.IsEmpty();

  nsCOMPtr<nsIImportService> impService(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = impService->CreateRFC822Message(
                        s_pIdentity,                  // dummy identity
                        m_pMsgFields,                 // message fields
                        pMimeType,                    // body type
                        body,                         // body pointer
                        createAsDraft,
                        pAttach,                      // local attachments
                        embeddedObjects,
                        m_pListener);                 // listener

  EudoraSendListener *pListen = (EudoraSendListener *)m_pListener;
  if (NS_FAILED(rv)) {
    IMPORT_LOG1("*** Error, CreateAndSendMessage FAILED: 0x%lx\n", rv);
    // IMPORT_LOG1("Headers: %80s\n", m_pHeaders);
  }
  else {
    // wait for the listener to get done!
    int32_t abortCnt = 0;
    int32_t cnt = 0;
    int32_t sleepCnt = 1;
    while (!pListen->m_done && (abortCnt < kHungAbortCount)) {
      PR_Sleep(sleepCnt);
      cnt++;
      if (cnt > kHungCount) {
        abortCnt++;
        sleepCnt *= 2;
        cnt = 0;
      }
    }

    if (abortCnt >= kHungAbortCount) {
      IMPORT_LOG0("**** Create and send message hung\n");
      IMPORT_LOG1("Headers: %s\n", m_pHeaders);
      IMPORT_LOG1("Body: %s\n", m_pBody);
      rv = NS_ERROR_FAILURE;
    }

  }

  if (pMimeType)
    NS_Free(pMimeType);

  if (pListen->m_location) {
    pListen->m_location->Clone(pMsg);
    rv = NS_OK;
  }
  else {
    rv = NS_ERROR_FAILURE;
    IMPORT_LOG0("*** Error, Outlook compose unsuccessful\n");
  }

  pListen->Reset();

  return rv;
}


bool SimpleBufferTonyRCopiedOnce::SpecialMemCpy(int32_t offset, const char *pData, int32_t len, int32_t *pWritten)
{
  // Arg!!!!!  Mozilla can't handle plain CRs in any mail messages.  Particularly a
  // problem with Eudora since it doesn't give a rats a**
  *pWritten = len;
  int32_t  sz = offset + len;
  if (offset) {
    if ((m_pBuffer[offset - 1] == nsCRT::CR) && (*pData != nsCRT::LF)) {
      sz++;
      if (!Grow(sz))
        return false;
      m_pBuffer[offset] = nsCRT::LF;
      offset++;
      (*pWritten)++;
    }
  }
  while (len > 0) {
    if ((*pData == nsCRT::CR) && (*(pData + 1) != nsCRT::LF)) {
      sz++;
      if (!Grow(sz))
        return false;
      m_pBuffer[offset] = nsCRT::CR;
      offset++;
      m_pBuffer[offset] = nsCRT::LF;
      (*pWritten)++;
    }
    else {
      m_pBuffer[offset] = *pData;
    }
    offset++;
    pData++;
    len--;
  }

  return true;
}

nsresult nsEudoraCompose::ReadHeaders(ReadFileState *pState, SimpleBufferTonyRCopiedOnce& copy, SimpleBufferTonyRCopiedOnce& header)
{
  // This should be the headers...
  header.m_writeOffset = 0;

  nsresult rv;
  int32_t lineLen;
  int32_t endLen = -1;
  int8_t endBuffer = 0;

  while ((endLen = IsEndHeaders(copy)) == -1) {
    while ((lineLen = FindNextEndLine(copy)) == -1) {
      copy.m_writeOffset = copy.m_bytesInBuf;
      if (!header.Write(copy.m_pBuffer, copy.m_writeOffset)) {
        IMPORT_LOG0("*** ERROR, writing headers\n");
        return NS_ERROR_FAILURE;
      }
      if (NS_FAILED(rv = FillMailBuffer(pState, copy))) {
        IMPORT_LOG0("*** Error reading message headers\n");
        return rv;
      }
      if (!copy.m_bytesInBuf) {
        IMPORT_LOG0("*** Error, end of file while reading headers\n");
        return NS_ERROR_FAILURE;
      }
    }
    copy.m_writeOffset += lineLen;
    if ((copy.m_writeOffset + 4) >= copy.m_bytesInBuf) {
      if (!header.Write(copy.m_pBuffer, copy.m_writeOffset)) {
        IMPORT_LOG0("*** ERROR, writing headers 2\n");
        return NS_ERROR_FAILURE;
      }
      if (NS_FAILED(rv = FillMailBuffer(pState, copy))) {
        IMPORT_LOG0("*** Error reading message headers 2\n");
        return rv;
      }
    }
  }

  if (!header.Write(copy.m_pBuffer, copy.m_writeOffset)) {
    IMPORT_LOG0("*** Error writing final headers\n");
    return NS_ERROR_FAILURE;
  }
  if (!header.Write((const char *)&endBuffer, 1)) {
    IMPORT_LOG0("*** Error writing header trailing null\n");
    return NS_ERROR_FAILURE;
  }

  copy.m_writeOffset += endLen;

  return NS_OK;
}

int32_t nsEudoraCompose::FindNextEndLine(SimpleBufferTonyRCopiedOnce& data)
{
  int32_t len = data.m_bytesInBuf - data.m_writeOffset;
  if (!len)
    return -1;

  int32_t count = 0;
  const char *pData = data.m_pBuffer + data.m_writeOffset;
  // Skip over end of line(s).
  while ((count < len) && ((*pData == nsCRT::CR) || (*pData == nsCRT::LF))) {
    pData++;
    count++;
  }
  // Skip to next end of line.
  while ((count < len) && (*pData != nsCRT::CR) && (*pData != nsCRT::LF)) {
    pData++;
    count++;
  }

  return (count < len) ? count : -1;
}

int32_t nsEudoraCompose::IsEndHeaders(SimpleBufferTonyRCopiedOnce& data)
{
  int32_t len = data.m_bytesInBuf - data.m_writeOffset;
  if (len < 2)
    return -1;

  const char *pChar = data.m_pBuffer + data.m_writeOffset;
  // Double nsCRT::CR.
  if ((*pChar == nsCRT::CR) && (*(pChar + 1) == nsCRT::CR))
    return 2;

  if (len < 4)
    return -1;

  // Double (nsCRT::CR + nsCRT::LF).
  if ((*pChar == nsCRT::CR) && (*(pChar + 1) == nsCRT::LF) &&
      (*(pChar + 2) == nsCRT::CR) && (*(pChar + 3) == nsCRT::LF))
    return 4;

  return -1;
}


nsresult nsEudoraCompose::CopyComposedMessage(nsCString& fromLine,
                                              nsIFile *pSrc,
                                              nsIOutputStream *pDst,
                                              SimpleBufferTonyRCopiedOnce& copy)
{
  copy.m_bytesInBuf = 0;
  copy.m_writeOffset = 0;
  ReadFileState  state;
  state.pFile = pSrc;
  state.offset = 0;
  state.size = 0;

  pSrc->GetFileSize(&state.size);
  if (!state.size) {
    IMPORT_LOG0("*** Error, unexpected zero file size for composed message\n");
    return NS_ERROR_FAILURE;
  }

        nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(state.pInputStream), pSrc);

  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error, unable to open composed message file\n");
    return NS_ERROR_FAILURE;
  }

  uint32_t written;
  rv = pDst->Write(fromLine.get(), fromLine.Length(), &written);

  // well, isn't this a hoot!
  // Read the headers from the new message, get the ones we like
  // and write out only the headers we want from the new message,
  // along with all of the other headers from the "old" message!
  if (NS_SUCCEEDED(rv))
    rv = FillMailBuffer(&state, copy);
  if (NS_SUCCEEDED(rv))
    rv = ReadHeaders(&state, copy, m_readHeaders);

  if (NS_SUCCEEDED(rv))
    rv = WriteHeaders(pDst, m_readHeaders);

  // We need to go ahead and write out the rest of the copy buffer
  // so that the following will properly copy the rest of the body
  char lastChar = 0;

  rv = EscapeFromSpaceLine(pDst, copy.m_pBuffer + copy.m_writeOffset, copy.m_pBuffer+copy.m_bytesInBuf);
  if (copy.m_bytesInBuf)
    lastChar = copy.m_pBuffer[copy.m_bytesInBuf - 1];
  if (NS_SUCCEEDED(rv))
    copy.m_writeOffset = copy.m_bytesInBuf;

  while ((state.offset < state.size) && NS_SUCCEEDED(rv)) {
    rv = FillMailBuffer(&state, copy);
    if (NS_SUCCEEDED(rv)) {
      rv = EscapeFromSpaceLine(pDst, copy.m_pBuffer + copy.m_writeOffset, copy.m_pBuffer+copy.m_bytesInBuf);
      lastChar = copy.m_pBuffer[copy.m_bytesInBuf - 1];
      if (NS_SUCCEEDED(rv))
        copy.m_writeOffset = copy.m_bytesInBuf;
      else
        IMPORT_LOG0("*** Error writing to destination mailbox\n");
    }
  }

  state.pInputStream->Close();

  if ((lastChar != nsCRT::LF) && NS_SUCCEEDED(rv)) {
    rv = pDst->Write("\x0D\x0A", 2, &written);
    if (written != 2)
      rv = NS_ERROR_FAILURE;
  }

  return rv;
}

nsresult nsEudoraCompose::FillMailBuffer(ReadFileState *pState, SimpleBufferTonyRCopiedOnce& read)
{
  if (read.m_writeOffset >= read.m_bytesInBuf) {
    read.m_writeOffset = 0;
    read.m_bytesInBuf = 0;
  }
  else if (read.m_writeOffset) {
    memcpy(read.m_pBuffer, read.m_pBuffer + read.m_writeOffset, read.m_bytesInBuf - read.m_writeOffset);
    read.m_bytesInBuf -= read.m_writeOffset;
    read.m_writeOffset = 0;
  }

  uint32_t count = read.m_size - read.m_bytesInBuf;
  if ((count + pState->offset) > pState->size)
    count = pState->size - pState->offset;
  if (count) {
    uint32_t bytesRead = 0;
    char * pBuffer = read.m_pBuffer + read.m_bytesInBuf;
    nsresult rv = pState->pInputStream->Read(pBuffer, count, &bytesRead);
    if (NS_FAILED(rv))
      return rv;
    if (bytesRead != count)
      return NS_ERROR_FAILURE;
    read.m_bytesInBuf += bytesRead;
    pState->offset += bytesRead;
  }

  return NS_OK;
}


#define kMaxSpecialHeaders 3
static const char *gSpecialHeaders[kMaxSpecialHeaders] = {
  "Content-type",
  "MIME-Version",
  "Content-transfer-encoding"
};
// consider "X-Accept-Language"?

#define kMaxReplaceHeaders 5
static const char *gReplaceHeaders[kMaxReplaceHeaders] = {
  "From",
  "To",
  "Subject",
  "Reply-to",
  "cc"
};

bool nsEudoraCompose::IsReplaceHeader(const char *pHeader)
{
  for (int i = 0; i < kMaxReplaceHeaders; i++) {
    if (!PL_strcasecmp(pHeader, gReplaceHeaders[i]))
      return true;
  }

  return false;
}

int32_t nsEudoraCompose::IsSpecialHeader(const char *pHeader)
{
  for (int i = 0; i < kMaxSpecialHeaders; i++) {
    if (!PL_strcasecmp(pHeader, gSpecialHeaders[i]))
      return (int32_t) i;
  }

  return -1;
}


nsresult nsEudoraCompose::WriteHeaders(nsIOutputStream *pDst, SimpleBufferTonyRCopiedOnce& newHeaders)
{
  // Well, ain't this a peach?
  // This is rather disgusting but there really isn't much to be done about it....

  // 1. For each "old" header, replace it with the new one if we want,
  // then right it out.
  // 2. Then if we haven't written the "important" new headers, write them out
  // 3. Terminate the headers with an extra eol.

  int32_t n = 0;
  nsCString header;
  nsCString val;
  nsCString replaceVal;
  uint32_t written;
  nsresult rv = NS_OK; // it's ok if we don't have the first header on the predefined lists.
  int32_t specialHeader;
  bool specials[kMaxSpecialHeaders];
  bool      hasDateHeader = false;
  int i;

  for (i = 0; i < kMaxSpecialHeaders; i++)
    specials[i] = false;

  // m_pHeaders - contains headers from a Eudora msg.
  // newHeaders - contains headers from a mozilla msg (more headers here).
  do {
    GetNthHeader(m_pHeaders, m_headerLen, n, header, val, false);
    // GetNthHeader(newHeaders.m_pBuffer, newHeaders.m_writeOffset, n, header, val, false);
    if (!header.IsEmpty()) {
      if ((specialHeader = IsSpecialHeader(header.get())) != -1) {
        header.Append(':');
        GetHeaderValue(newHeaders.m_pBuffer, newHeaders.m_writeOffset - 1,
                       header.get(), val, false);
        header.SetLength(header.Length() - 1);
        specials[specialHeader] = true;
      }
      else if (IsReplaceHeader(header.get())) {
        replaceVal.Truncate();
        header.Append(':');
        GetHeaderValue(newHeaders.m_pBuffer, newHeaders.m_writeOffset - 1,
                       header.get(), replaceVal, false);
        header.SetLength(header.Length() - 1);
        if (!replaceVal.IsEmpty())
          val = replaceVal;
      }
      if (!val.IsEmpty()) {
        // See if we're writing out a Date: header.
        if (header.LowerCaseEqualsLiteral("date"))
          hasDateHeader = true;
        rv = pDst->Write(header.get(), header.Length(), &written);
        if (NS_SUCCEEDED(rv))
          rv = pDst->Write(": ", 2, &written);
        if (NS_SUCCEEDED(rv))
          rv = pDst->Write(val.get(), val.Length(), &written);
        if (NS_SUCCEEDED(rv))
          rv = pDst->Write("\x0D\x0A", 2, &written);

      }
    }
    n++;
  } while (NS_SUCCEEDED(rv) && !header.IsEmpty());

  // If we don't have Date: header so far then use the default one (taken from Eudora "From " line).
  if (!hasDateHeader)
  {
    rv = pDst->Write(m_defaultDate.get(), m_defaultDate.Length(), &written);
    if (NS_SUCCEEDED(rv))
      rv = pDst->Write("\x0D\x0A", 2, &written);
  }

  for (i = 0; (i < kMaxSpecialHeaders) && NS_SUCCEEDED(rv); i++) {
    if (!specials[i]) {
      header = gSpecialHeaders[i];
      header.Append(':');
      GetHeaderValue(newHeaders.m_pBuffer, newHeaders.m_writeOffset - 1,
                     header.get(), val, false);
      header.SetLength(header.Length() - 1);
      if (!val.IsEmpty()) {
        rv = pDst->Write(header.get(), header.Length(), &written);
        if (NS_SUCCEEDED(rv))
          rv = pDst->Write(": ", 2, &written);
        if (NS_SUCCEEDED(rv))
          rv = pDst->Write(val.get(), val.Length(), &written);
        if (NS_SUCCEEDED(rv))
          rv = pDst->Write("\x0D\x0A", 2, &written);
      }
    }
  }

  if (NS_SUCCEEDED(rv))
    rv = pDst->Write("\x0D\x0A", 2, &written);
  return rv;
}


