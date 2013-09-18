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
#include "nsIFile.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsIIOService.h"
#include "nsIURI.h"
#include "nsMsgI18N.h"
#include "nsIOutputStream.h"
#include "nsMsgAttachmentData.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsIArray.h"
#include "nsIMsgCompose.h"
#include "nsIMsgCompFields.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgSend.h"
#include "nsImportEmbeddedImageData.h"
#include "nsNetCID.h"
#include "nsCRT.h"
#include "nsOutlookCompose.h"

#include "OutlookDebugLog.h"

#include "nsMimeTypes.h"
#include "nsMsgUtils.h"

#include "nsAutoPtr.h"

#include "nsMsgMessageFlags.h"
#include "nsMsgLocalFolderHdrs.h"

#include <algorithm>

static NS_DEFINE_CID(kMsgSendCID, NS_MSGSEND_CID);
static NS_DEFINE_CID(kMsgCompFieldsCID, NS_MSGCOMPFIELDS_CID);

// We need to do some calculations to set these numbers to something reasonable!
// Unless of course, CreateAndSendMessage will NEVER EVER leave us in the lurch
#define kHungCount 100000
#define kHungAbortCount 1000

#ifdef IMPORT_DEBUG
static const char *p_test_headers =
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

static const char *p_test_body =
"Hello world?\n\
";
#else
#define p_test_headers nullptr
#define p_test_body nullptr
#endif

#define kWhitespace "\b\t\r\n "

//////////////////////////////////////////////////////////////////////////////////////////////////

// A replacement for SimpleBufferTonyRCopiedTwice round-robin buffer and ReadFileState classes
class CCompositionFile {
public:
  // fifoBuffer is used for memory allocation optimization
  // convertCRs controls if we want to convert standalone CRs to CRLFs
  CCompositionFile(nsIFile* aFile, void* fifoBuffer, uint32_t fifoBufferSize, bool convertCRs=false);

  operator bool() const { return m_fileSize && m_pInputStream; }

  // Reads up to and including the term sequence, or entire file if term isn't found
  // termSize may be used to include NULLs in the terminator sequences.
  // termSize value of -1 means "zero-terminated string" -> size is calculated with strlen
  nsresult ToString(nsCString& dest, const char* term=0, int termSize=-1);
  nsresult ToStream(nsIOutputStream *dest, const char* term=0, int termSize=-1);
  char LastChar() { return m_lastChar; }
private:
  nsCOMPtr<nsIFile>  m_pFile;
  nsCOMPtr<nsIInputStream> m_pInputStream;
  int64_t m_fileSize;
  int64_t m_fileReadPos;
  char* m_fifoBuffer;
  uint32_t m_fifoBufferSize;
  char* m_fifoBufferReadPos; // next character to read
  char* m_fifoBufferWrittenPos; // if we have read less than buffer size then this will show it
  bool m_convertCRs;
  char m_lastChar;

  nsresult EnsureHasDataInBuffer();
  template <class _OutFn> nsresult ToDest(_OutFn dest, const char* term, int termSize);
};

//////////////////////////////////////////////////////////////////////////////////////////////////

// First off, a listener
class OutlookSendListener : public nsIMsgSendListener
{
public:
  OutlookSendListener() {
    m_done = false;
    m_location = nullptr;
  }

  virtual ~OutlookSendListener() { NS_IF_RELEASE(m_location); }

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
    NS_IF_ADDREF(m_location = returnFile);
    return NS_OK;
  }

   /* void OnSendNotPerformed */
   NS_IMETHOD OnSendNotPerformed(const char *aMsgID, nsresult aStatus) {return NS_OK;}

  /* void OnGetDraftFolderURI (); */
  NS_IMETHOD OnGetDraftFolderURI(const char *aFolderURI) {return NS_OK;}

  static nsresult CreateSendListener(nsIMsgSendListener **ppListener);
  void Reset() { m_done = false; NS_IF_RELEASE(m_location);}

public:
  bool m_done;
  nsIFile * m_location;
};

NS_IMPL_ISUPPORTS1(OutlookSendListener, nsIMsgSendListener)

nsresult OutlookSendListener::CreateSendListener(nsIMsgSendListener **ppListener)
{
  NS_PRECONDITION(ppListener != nullptr, "null ptr");
  NS_ENSURE_ARG_POINTER(ppListener);

  *ppListener = new OutlookSendListener();
  if (! *ppListener)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(*ppListener);
  return NS_OK;
}

/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////

#define hackBeginA "begin"
#define hackBeginW MOZ_UTF16(hackBeginA)
#define hackEndA "\015\012end"
#define hackEndW MOZ_UTF16(hackEndA)
#define hackCRLFA "crlf"
#define hackCRLFW MOZ_UTF16(hackCRLFA)
#define hackAmpersandA "amp"
#define hackAmpersandW MOZ_UTF16(hackAmpersandA)

nsOutlookCompose::nsOutlookCompose()
{
  m_pListener = nullptr;
  m_pMsgFields = nullptr;

  m_optimizationBufferSize = 16*1024;
  m_optimizationBuffer = new char[m_optimizationBufferSize];
}

nsOutlookCompose::~nsOutlookCompose()
{
  NS_IF_RELEASE(m_pListener);
  NS_IF_RELEASE(m_pMsgFields);
  if (m_pIdentity) {
    nsresult rv = m_pIdentity->ClearAllValues();
    NS_ASSERTION(NS_SUCCEEDED(rv),"failed to clear values");
    if (NS_FAILED(rv))
      return;
  }
  delete[] m_optimizationBuffer;
}

nsIMsgIdentity * nsOutlookCompose::m_pIdentity = nullptr;

nsresult nsOutlookCompose::CreateIdentity(void)
{
  if (m_pIdentity)
    return NS_OK;

  nsresult rv;
  nsCOMPtr<nsIMsgAccountManager> accMgr =
    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = accMgr->CreateIdentity(&m_pIdentity);
  nsString name;
  name.AssignLiteral("Import Identity");
  if (m_pIdentity) {
    m_pIdentity->SetFullName(name);
    m_pIdentity->SetIdentityName(name);
    m_pIdentity->SetEmail(NS_LITERAL_CSTRING("import@import.service"));
  }
  return rv;
}

void nsOutlookCompose::ReleaseIdentity()
{
  NS_IF_RELEASE(m_pIdentity);
}

nsresult nsOutlookCompose::CreateComponents(void)
{
  nsresult rv = NS_OK;

  NS_IF_RELEASE(m_pMsgFields);
  if (!m_pListener && NS_SUCCEEDED(rv))
    rv = OutlookSendListener::CreateSendListener(&m_pListener);

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

nsresult nsOutlookCompose::ComposeTheMessage(nsMsgDeliverMode mode, CMapiMessage &msg, nsIFile **pMsg)
{
  nsresult rv = CreateComponents();
  NS_ENSURE_SUCCESS(rv, rv);
  rv = CreateIdentity();
  NS_ENSURE_SUCCESS(rv, rv);

  // IMPORT_LOG0("Outlook Compose created necessary components\n");

  CMapiMessageHeaders* headers = msg.GetHeaders();

  nsString unival;
  headers->UnfoldValue(CMapiMessageHeaders::hdrFrom, unival, msg.GetBodyCharset());
  m_pMsgFields->SetFrom(unival);
  headers->UnfoldValue(CMapiMessageHeaders::hdrTo, unival, msg.GetBodyCharset());
  m_pMsgFields->SetTo(unival);
  headers->UnfoldValue(CMapiMessageHeaders::hdrSubject, unival, msg.GetBodyCharset());
  m_pMsgFields->SetSubject(unival);
  m_pMsgFields->SetCharacterSet(msg.GetBodyCharset());
  headers->UnfoldValue(CMapiMessageHeaders::hdrCc, unival, msg.GetBodyCharset());
  m_pMsgFields->SetCc(unival);
  headers->UnfoldValue(CMapiMessageHeaders::hdrReplyTo, unival, msg.GetBodyCharset());
  m_pMsgFields->SetReplyTo(unival);
  m_pMsgFields->SetMessageId(headers->Value(CMapiMessageHeaders::hdrMessageID));

  // We only use those headers that may need to be processed by Thunderbird
  // to create a good rfc822 document, or need to be encoded (like To and Cc).
  // These will replace the originals on import. All the other headers
  // will be copied to the destination unaltered in CopyComposedMessage().

  nsCOMPtr<nsIArray> pAttach;
  msg.GetAttachments(getter_AddRefs(pAttach));

  nsString bodyW;
  // Bug 593907
  if (GenerateHackSequence(msg.GetBody(), msg.GetBodyLen()))
    HackBody(msg.GetBody(), msg.GetBodyLen(), bodyW);
  else
    bodyW = msg.GetBody();
  // End Bug 593907

  nsCOMPtr<nsISupportsArray> embeddedObjects;

  if (msg.BodyIsHtml()) {
    for (unsigned int i = 0; i <msg.EmbeddedAttachmentsCount(); i++) {
      nsIURI *uri;
      const char* cid;
      const char* name;
      if (msg.GetEmbeddedAttachmentInfo(i, &uri, &cid, &name)) {
        if (!embeddedObjects) {
          embeddedObjects = do_CreateInstance(NS_SUPPORTSARRAY_CONTRACTID, &rv);
          NS_ENSURE_SUCCESS(rv, rv);
        }
        nsCOMPtr<nsIMsgEmbeddedImageData> imageData =
          new nsImportEmbeddedImageData(uri, nsDependentCString(cid),
                                     nsDependentCString(name));
        embeddedObjects->AppendElement(imageData);
      }
    }
  }

  nsCString bodyA;
  nsMsgI18NConvertFromUnicode(msg.GetBodyCharset(), bodyW, bodyA);

  nsCOMPtr<nsIImportService> impService(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = impService->CreateRFC822Message(
                        m_pIdentity,                  // dummy identity
                        m_pMsgFields,                 // message fields
                        msg.BodyIsHtml() ? "text/html" : "text/plain",
                        bodyA,                        // body pointer
                        mode == nsIMsgSend::nsMsgSaveAsDraft,
                        pAttach,                      // local attachments
                        embeddedObjects,
                        m_pListener);                 // listener

  OutlookSendListener *pListen = (OutlookSendListener *)m_pListener;
  if (NS_FAILED(rv)) {
    IMPORT_LOG1("*** Error, CreateAndSendMessage FAILED: 0x%lx\n", rv);
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
      rv = NS_ERROR_FAILURE;
    }
  }

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

nsresult nsOutlookCompose::CopyComposedMessage(nsIFile *pSrc,
                                               nsIOutputStream *pDst,
                                               CMapiMessage& origMsg)
{
  // I'm unsure if we really need the convertCRs feature here.
  // The headers in the file are generated by TB, the body was generated by rtf reader that always used CRLF,
  // and the attachments were processed by TB either... However, I let it stay as it was in the original code.
  CCompositionFile f(pSrc, m_optimizationBuffer, m_optimizationBufferSize, true);
  if (!f) {
    IMPORT_LOG0("*** Error, unexpected zero file size for composed message\n");
    return NS_ERROR_FAILURE;
  }

  // The "From ..." separates the messages. Without it, TB cannot see the messages in the mailbox file.
  // Thus, the lines that look like "From ..." in the message must be escaped (see EscapeFromSpaceLine())
  int fromLineLen;
  const char* fromLine = origMsg.GetFromLine(fromLineLen);
  uint32_t written;
  nsresult rv = pDst->Write(fromLine, fromLineLen, &written);

  // Bug 219269
  // Write out the x-mozilla-status headers.
  char statusLine[50];
  uint32_t msgFlags = 0;
  if (origMsg.IsRead())
    msgFlags |= nsMsgMessageFlags::Read;
  if (!origMsg.FullMessageDownloaded())
    msgFlags |= nsMsgMessageFlags::Partial;
  if (origMsg.IsForvarded())
    msgFlags |= nsMsgMessageFlags::Forwarded;
  if (origMsg.IsReplied())
    msgFlags |= nsMsgMessageFlags::Replied;
  if (origMsg.HasAttach())
    msgFlags |= nsMsgMessageFlags::Attachment;
  _snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF);
  rv = pDst->Write(statusLine, strlen(statusLine), &written);
  _snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS2_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF0000);
  rv = pDst->Write(statusLine, strlen(statusLine), &written);
  // End Bug 219269

  // well, isn't this a hoot!
  // Read the headers from the new message, get the ones we like
  // and write out only the headers we want from the new message,
  // along with all of the other headers from the "old" message!

  nsCString newHeadersStr;
  rv = f.ToString(newHeadersStr, MSG_LINEBREAK MSG_LINEBREAK); // Read all the headers
  NS_ENSURE_SUCCESS(rv, rv);
  UpdateHeaders(*origMsg.GetHeaders(), newHeadersStr.get());
  rv = origMsg.GetHeaders()->ToStream(pDst);
  NS_ENSURE_SUCCESS(rv, rv);

  // Bug 593907
  if (!m_hackedPostfix.IsEmpty()) {
    nsCString hackedPartEnd;
    LossyCopyUTF16toASCII(m_hackedPostfix, hackedPartEnd);
    hackedPartEnd.Insert(hackEndA, 0);
    nsCString body;
    rv = f.ToString(body, hackedPartEnd.get(), hackedPartEnd.Length());
    UnhackBody(body);
    EscapeFromSpaceLine(pDst, const_cast<char*>(body.get()), body.get()+body.Length());
  }
  // End Bug 593907

  // I use the terminating sequence here to avoid a possible situation when a "From " line
  // gets split over two sequential reads and thus will not be escaped.
  // This is done by reading up to CRLF (one line every time), though it may be slower

  // Here I revert the changes that were made when the multipart/related message
  // was composed in nsMsgSend::ProcessMultipartRelated() - the Content-Ids of
  // attachments were replaced with new ones.
  nsCString line;
  while (NS_SUCCEEDED(f.ToString(line, MSG_LINEBREAK))) {
    EscapeFromSpaceLine(pDst, const_cast<char*>(line.get()), line.get()+line.Length());
  }

  if (f.LastChar() != nsCRT::LF) {
    rv = pDst->Write(MSG_LINEBREAK, 2, &written);
    if (written != 2)
      rv = NS_ERROR_FAILURE;
  }

  return rv;
}

nsresult nsOutlookCompose::ProcessMessage(nsMsgDeliverMode mode,
                                          CMapiMessage &msg,
                                          nsIOutputStream *pDst)
{
  nsCOMPtr<nsIFile> compositionFile;
  nsresult rv = ComposeTheMessage(mode, msg, getter_AddRefs(compositionFile));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = CopyComposedMessage(compositionFile, pDst, msg);
  compositionFile->Remove(false);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error copying composed message to destination mailbox\n");
  }
  return rv;
}

void nsOutlookCompose::UpdateHeader(CMapiMessageHeaders& oldHeaders,
                                    const CMapiMessageHeaders& newHeaders,
                                    CMapiMessageHeaders::SpecialHeader header,
                                    bool addIfAbsent)
{
  const char* oldVal = oldHeaders.Value(header);
  if (!addIfAbsent && !oldVal)
    return;
  const char* newVal = newHeaders.Value(header);
  if (!newVal)
    return;
  // Bug 145150 - Turn "Content-Type: application/ms-tnef" into "Content-Type: text/plain"
  //              so the body text can be displayed normally (instead of in an attachment).
  if (header == CMapiMessageHeaders::hdrContentType)
    if (stricmp(newVal, "application/ms-tnef") == 0)
      newVal = "text/plain";
  // End Bug 145150
  if (oldVal) {
    if (strcmp(oldVal, newVal) == 0)
      return;
    // Backup the old header value
    nsCString backupHdrName("X-MozillaBackup-");
    backupHdrName += CMapiMessageHeaders::SpecialName(header);
    oldHeaders.SetValue(backupHdrName.get(), oldVal, false);
  }
  // Now replace it with new value
  oldHeaders.SetValue(header, newVal);
}

void nsOutlookCompose::UpdateHeaders(CMapiMessageHeaders& oldHeaders, const CMapiMessageHeaders& newHeaders)
{
  // Well, ain't this a peach?
  // This is rather disgusting but there really isn't much to be done about it....

  // 1. For each "old" header, replace it with the new one if we want,
  // then right it out.
  // 2. Then if we haven't written the "important" new headers, write them out
  // 3. Terminate the headers with an extra eol.

  // Important headers:
  //  "Content-type",
  //  "MIME-Version",
  //  "Content-transfer-encoding"
  // consider "X-Accept-Language"?

  UpdateHeader(oldHeaders, newHeaders, CMapiMessageHeaders::hdrContentType);
  UpdateHeader(oldHeaders, newHeaders, CMapiMessageHeaders::hdrMimeVersion);
  UpdateHeader(oldHeaders, newHeaders, CMapiMessageHeaders::hdrContentTransferEncoding);

  // Other replaced headers (only if they exist):
  //  "From",
  //  "To",
  //  "Subject",
  //  "Reply-to",
  //  "Cc"

  UpdateHeader(oldHeaders, newHeaders, CMapiMessageHeaders::hdrFrom, false);
  UpdateHeader(oldHeaders, newHeaders, CMapiMessageHeaders::hdrTo, false);
  UpdateHeader(oldHeaders, newHeaders, CMapiMessageHeaders::hdrSubject, false);
  UpdateHeader(oldHeaders, newHeaders, CMapiMessageHeaders::hdrReplyTo, false);
  UpdateHeader(oldHeaders, newHeaders, CMapiMessageHeaders::hdrCc, false);
}

// Bug 593907
// This is just a workaround of the deficiency of the nsMsgComposeAndSend::EnsureLineBreaks().
// The import from Outlook will stay OK (I hope), but other messages may still suffer.
// However, I cannot deny the possibility that the (possible) recode of the body
// may interfere with this hack. A possible scenario is if a multi-byte character will either
// contain 0x0D 0x0A sequence, or end with 0x0D, after which MAC-style standalone LF will go.
// I hope that this possibility is insignificant (eg, utf-8 doesn't contain such sequences).
// This hack will slow down the import, but as the import is one-time procedure, I hope that
// the user will agree to wait a little longer to get better results.

// The process of composing the message differs depending on whether the editor is present or not.
// If the editor is absent, the "attachment1_body" parameter of CreateAndSendMessage() is taken as is,
// while in the presence o the editor, the body that is taken from it is further processed in the
// nsMsgComposeAndSend::GetBodyFromEditor(). Specifically, the TXTToHTML::ScanHTML() first calls
// UnescapeStr() to properly handle a limited number of HTML character entities (namely &amp; &lt; &gt; &quot;)
// and then calls ScanTXT() where escapes all ampersands and quotes again. As the UnescapeStr() works so
// selectively (i.e. handling only a subset of valid entities), the so often seen "&nbsp;" becomes "&amp;nbsp;"
// in the resulting body, which leads to text "&nbsp;" interspersed all over the imported mail. The same
// applies to html &#XXXX; (where XXXX is unicode codepoint).
// See also Bug 503690, where the same issue in Eudora import is reported.
// By the way, the root of the Bug 359303 lies in the same place - the nsMsgComposeAndSend::GetBodyFromEditor()
// changes the 0xA0 codes to 0x20 when it converts the body to plain text.
// We scan the body here to find all the & and convert them to the safe character sequense to revert later.

void nsOutlookCompose::HackBody(const wchar_t* orig, size_t origLen, nsString& hack)
{
#ifdef MOZILLA_INTERNAL_API
  hack.SetCapacity(static_cast<size_t>(origLen*1.4));
#endif
  hack.Assign(hackBeginW);
  hack.Append(m_hackedPostfix);

  while (*orig) {
    if (*orig == L'&') {
      hack.Append(hackAmpersandW);
      hack.Append(m_hackedPostfix);
    } else if ((*orig == L'\x0D') && (*(orig+1) == L'\x0A')) {
      hack.Append(hackCRLFW);
      hack.Append(m_hackedPostfix);
      ++orig;
    } else
      hack.Append(*orig);
    ++orig;
  }

  hack.Append(hackEndW);
  hack.Append(m_hackedPostfix);
}

void nsOutlookCompose::UnhackBody(nsCString& txt)
{
  nsCString hackedPostfixA;
  LossyCopyUTF16toASCII(m_hackedPostfix, hackedPostfixA);

  nsCString hackedString(hackBeginA);
  hackedString.Append(hackedPostfixA);
  int32_t begin = txt.Find(hackedString);
  if (begin == kNotFound)
    return;
  txt.Cut(begin, hackedString.Length());

  hackedString.Assign(hackEndA);
  hackedString.Append(hackedPostfixA);
  int32_t end = MsgFind(txt, hackedString, false, begin);
  if (end == kNotFound)
    return; // ?
  txt.Cut(end, hackedString.Length());

  nsCString range;
  range.Assign(Substring(txt, begin, end - begin));
  // 1. Remove all CRLFs from the selected range
  MsgReplaceSubstring(range, MSG_LINEBREAK, "");
  // 2. Restore the original CRLFs
  hackedString.Assign(hackCRLFA);
  hackedString.Append(hackedPostfixA);
  MsgReplaceSubstring(range, hackedString.get(), MSG_LINEBREAK);

  // 3. Restore the original ampersands
  hackedString.Assign(hackAmpersandA);
  hackedString.Append(hackedPostfixA);
  MsgReplaceSubstring(range, hackedString.get(), "&");

  txt.Replace(begin, end - begin, range);
}

bool nsOutlookCompose::GenerateHackSequence(const wchar_t* body, size_t origLen)
{
  nsDependentString nsBody(body, origLen);
  const wchar_t* hack_base = L"hacked";
  int i = 0;
  do {
    if (++i == 0) { // Cycle complete :) - could not generate an unique string
      m_hackedPostfix.Truncate();
      return false;
    }
    m_hackedPostfix.Assign(hack_base);
    m_hackedPostfix.AppendInt(i);
  } while (nsBody.Find(m_hackedPostfix) != kNotFound);

  return true;
}
// End Bug 593907

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

CCompositionFile::CCompositionFile(nsIFile* aFile, void* fifoBuffer,
                                   uint32_t fifoBufferSize, bool convertCRs)
  : m_pFile(aFile), m_fileSize(0), m_fileReadPos(0),
    m_fifoBuffer(static_cast<char*>(fifoBuffer)),
    m_fifoBufferSize(fifoBufferSize),
    m_fifoBufferReadPos(static_cast<char*>(fifoBuffer)),
    m_fifoBufferWrittenPos(static_cast<char*>(fifoBuffer)),
    m_convertCRs(convertCRs),
    m_lastChar(0)
{
  m_pFile->GetFileSize(&m_fileSize);
  if (!m_fileSize) {
    IMPORT_LOG0("*** Error, unexpected zero file size for composed message\n");
    return;
  }

  nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(m_pInputStream), m_pFile);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error, unable to open composed message file\n");
    return;
  }
}

nsresult CCompositionFile::EnsureHasDataInBuffer()
{
  if (m_fifoBufferReadPos < m_fifoBufferWrittenPos)
    return NS_OK;
  // Populate the buffer with new data!
  uint32_t count = m_fifoBufferSize;
  if ((m_fileReadPos + count) > m_fileSize)
    count = m_fileSize - m_fileReadPos;
  if (!count)
    return NS_ERROR_FAILURE; // Isn't there a "No more data" error?

  uint32_t bytesRead = 0;
  nsresult rv = m_pInputStream->Read(m_fifoBuffer, count, &bytesRead);
  NS_ENSURE_SUCCESS(rv, rv);
  if (!bytesRead || (bytesRead > count))
    return NS_ERROR_FAILURE;
  m_fifoBufferWrittenPos = m_fifoBuffer+bytesRead;
  m_fifoBufferReadPos = m_fifoBuffer;
  m_fileReadPos += bytesRead;

  return NS_OK;
}

class CTermGuard {
public:
  CTermGuard(const char* term, int termSize)
    : m_term(term),
    m_termSize(term ? ((termSize!=-1) ? termSize : strlen(term)) : 0),
    m_matchPos(0)
  {}

   // if the guard triggered
  inline bool IsTriggered() const {
    return m_termSize && (m_matchPos == m_termSize); }
  // indicates if the guard has something to check
  inline bool IsChecking() const { return m_termSize; }

  bool Check(char c) // returns true only if the whole sequence passed
  {
    if (!m_termSize) // no guard
      return false;
    if (m_matchPos >= m_termSize) // check past success!
      m_matchPos = 0;
    if (m_term[m_matchPos] != c) // Reset sequence
      m_matchPos = 0;
    if (m_term[m_matchPos] == c) { // Sequence continues
      return ++m_matchPos == m_termSize; // If equal then sequence complete!
    }
    // Sequence broken
    return false;
  }
private:
  const char* m_term;
  int m_termSize;
  int m_matchPos;
};

template <class _OutFn>
nsresult CCompositionFile::ToDest(_OutFn dest, const char* term, int termSize)
{
  CTermGuard guard(term, termSize);

#ifdef MOZILLA_INTERNAL_API
  // We already know the required string size, so reduce future reallocations
  if (!guard.IsChecking() && !m_convertCRs)
    dest.SetCapacity(m_fileSize - m_fileReadPos);
#endif

  bool wasCR = false;
  char c = 0;
  nsresult rv;
  while (NS_SUCCEEDED(rv = EnsureHasDataInBuffer())) {
    if (!guard.IsChecking() && !m_convertCRs) { // Use efficient algorithm
      dest.Append(m_fifoBufferReadPos, m_fifoBufferWrittenPos-m_fifoBufferReadPos);
    }
    else { // Check character by character to convert CRs and find terminating sequence
      while (m_fifoBufferReadPos < m_fifoBufferWrittenPos) {
        c = *m_fifoBufferReadPos;
        if (m_convertCRs && wasCR) {
          wasCR = false;
          if (c != nsCRT::LF) {
            const char kTmpLF = nsCRT::LF;
            dest.Append(&kTmpLF, 1);
            if (guard.Check(nsCRT::LF)) {
              c = nsCRT::LF; // save last char
              break;
            }
          }
        }
        dest.Append(&c, 1);
        m_fifoBufferReadPos++;

        if (guard.Check(c))
          break;

        if (m_convertCRs && (c == nsCRT::CR))
          wasCR = true;
      }
      if (guard.IsTriggered())
        break;
    }
  }

  // check for trailing CR (only if caller didn't specify the terminating sequence that ends with CR -
  // in this case he knows what he does!)
  if (m_convertCRs && !guard.IsTriggered() && (c == nsCRT::CR)) {
    c = nsCRT::LF;
    dest.Append(&c, 1);
  }

  NS_ENSURE_SUCCESS(rv, rv);

  m_lastChar = c;
  return NS_OK;
}

class dest_nsCString {
public:
  dest_nsCString(nsCString& str) : m_str(str) { m_str.Truncate(); }
#ifdef MOZILLA_INTERNAL_API
  void SetCapacity(int32_t sz) { m_str.SetCapacity(sz); }
#endif
  nsresult Append(const char* buf, uint32_t count) {
    m_str.Append(buf, count); return NS_OK; }
private:
  nsCString& m_str;
};

class dest_Stream {
public:
  dest_Stream(nsIOutputStream *dest) : m_stream(dest) {}
#ifdef MOZILLA_INTERNAL_API
  void SetCapacity(int32_t) { /*do nothing*/ }
#endif
  // const_cast here is due to the poor design of the EscapeFromSpaceLine()
  // that requires a non-constant pointer while doesn't modify its data
  nsresult Append(const char* buf, uint32_t count) {
    return EscapeFromSpaceLine(m_stream, const_cast<char*>(buf), buf+count); }
private:
  nsIOutputStream *m_stream;
};

nsresult CCompositionFile::ToString(nsCString& dest, const char* term,
                                    int termSize)
{
  return ToDest(dest_nsCString(dest), term, termSize);
}

nsresult CCompositionFile::ToStream(nsIOutputStream *dest, const char* term,
                                    int termSize)
{
  return ToDest(dest_Stream(dest), term, termSize);
}
