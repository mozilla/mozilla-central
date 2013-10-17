/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsMsgSend.h"
#include "prmem.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsMsgSendPart.h"
#include "nsMsgBaseCID.h"
#include "nsMsgNewsCID.h"
#include "nsIMsgHeaderParser.h"
#include "nsISmtpService.h"  // for actually sending the message...
#include "nsINntpService.h"  // for actually posting the message...
#include "nsIMsgMailSession.h"
#include "nsIMsgIdentity.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsMsgCompUtils.h"
#include "nsMsgI18N.h"
#include "nsICharsetConverterManager.h"
#include "nsIMsgSendListener.h"
#include "nsIMsgCopyServiceListener.h"
#include "nsIFile.h"
#include "nsIURL.h"
#include "nsNetUtil.h"
#include "nsIFileURL.h"
#include "nsMsgCopy.h"
#include "nsUnicharUtils.h"
#include "nsMsgPrompts.h"
#include "nsIDOMHTMLBodyElement.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIDOMHTMLLinkElement.h"
#include "nsIDOMHTMLAnchorElement.h"
#include "nsCExternalHandlerService.h"
#include "nsIMIMEService.h"
#include "nsIDocument.h"
#include "nsIDOMDocument.h"
#include "nsMsgCompCID.h"
#include "nsIAbAddressCollector.h"
#include "nsAbBaseCID.h"
#include "nsCOMPtr.h"
#include "mozITXTToHTMLConv.h"
#include "nsIMsgStatusFeedback.h"
#include "nsIMsgWindow.h"
#include "nsTextFormatter.h"
#include "nsIPrompt.h"
#include "nsMailHeaders.h"
#include "nsIDocShell.h"
#include "nsMimeTypes.h"
#include "nsISmtpUrl.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIEditorMailSupport.h"
#include "nsIDocumentEncoder.h"    // for editor output flags
#include "nsILoadGroup.h"
#include "nsMsgSendReport.h"
#include "nsNetCID.h"
#include "nsError.h"
#include "nsMsgUtils.h"
#include "nsIMsgMdnGenerator.h"
#include "nsISmtpServer.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsIMsgAccountManager.h"
#include "nsNativeCharsetUtils.h"
#include "nsIAbCard.h"
#include "nsIMsgProgress.h"
#include "nsIMsgMessageService.h"
#include "nsIMsgHdr.h"
#include "nsIMsgFolder.h"
#include "nsComposeStrings.h"
#include "nsStringGlue.h"
#include "nsMsgUtils.h"
#include "nsIArray.h"
#include "nsArrayUtils.h"
#include "mozilla/Services.h"
#include "mozilla/mailnews/MimeEncoder.h"

static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);

#define PREF_MAIL_SEND_STRUCT "mail.send_struct"
#define PREF_MAIL_STRICTLY_MIME "mail.strictly_mime"
#define PREF_MAIL_MESSAGE_WARNING_SIZE "mailnews.message_warning_size"
#define PREF_MAIL_COLLECT_EMAIL_ADDRESS_OUTGOING "mail.collect_email_address_outgoing"
#define PREF_MAIL_DONT_ATTACH_SOURCE "mail.compose.dont_attach_source_of_local_network_links"

#define ATTR_MOZ_DO_NOT_SEND "moz-do-not-send"

enum  { kDefaultMode = (PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE) };

static bool mime_use_quoted_printable_p = false;

//
// Ugh, we need to do this currently to access this boolean.
//
bool
UseQuotedPrintable(void)
{
  return mime_use_quoted_printable_p;
}

/* This function will parse a list of email addresses and groups and just
 * return a list of email addresses (recipient)
 *
 * The input could be:
 *    [recipient | group] *[,recipient | group]
 *
 * The group syntax is:
 *    group-name:[recipient *[,recipient]];
 *
 * the output will be:
 *    recipient *[, recipient]
 *
 * As the result will always be equal or smaller than the input string,
 * the extraction will be made in place. Don't need to create a new buffer.
 */
static nsresult StripOutGroupNames(char * addresses)
{
  char aChar;
  char * readPtr = addresses;           // current read position
  char * writePtr = addresses;          // current write position
  char * previousSeparator = addresses; // remember last time we wrote a recipient separator
  char * endPtr = addresses + PL_strlen(addresses);

  bool quoted = false;   // indicate if we are between double quote
  bool group = false;   // indicate if we found a group prefix
  bool atFound = false;  // indicate if we found an @ in the current recipient. group name should not have an @

  while (readPtr < endPtr)
  {
    aChar = *readPtr;
    readPtr ++;
    switch(aChar)
    {
      case '\\':
        if (*readPtr == '"') //ignore escaped quote
          readPtr ++;
        continue;

      case '"':
        quoted = !quoted;
        break;

      case '@':
        if (!quoted)
          atFound = true;
        break;

      case ':':
        if (!quoted && !atFound)
        {
          // ok, we found a group name
          // let's backup the write cursor to remove the group name
          writePtr = previousSeparator + 1;
          group = true;
          continue;
        }
        break;

      case ';':
        if (quoted || !group)
          break;
        else
          group = false;
          //end of the group, act like a recipient separator now...
        /* NO BREAK */

      case ',':
        if (!quoted)
        {
          atFound = false;
          //let check if we already have a comma separator in the output string
          if (writePtr > addresses && *(writePtr - 1) == ',')
            writePtr --;
          *writePtr = ',';
          previousSeparator = writePtr;
          writePtr ++;
          continue;
        }
        break;
    }
    *writePtr = aChar;
    writePtr ++;
  }

  if (writePtr > addresses && *(writePtr - 1) == ',')
    writePtr --;
  *writePtr = '\0';

  return NS_OK;
}


// This private class just provides us an external URL listener, with callback functionality.

class MsgDeliveryListener : public nsIUrlListener
{
public:
  MsgDeliveryListener(nsIMsgSend *aMsgSend, bool inIsNewsDelivery);
  virtual ~MsgDeliveryListener();
  
  NS_DECL_ISUPPORTS
  NS_DECL_NSIURLLISTENER
    
private:
  nsCOMPtr<nsIMsgSend> mMsgSend;
  bool                 mIsNewsDelivery;
};

NS_IMPL_ISUPPORTS1(MsgDeliveryListener, nsIUrlListener)

MsgDeliveryListener::MsgDeliveryListener(nsIMsgSend *aMsgSend, bool inIsNewsDelivery)
{
  mMsgSend = aMsgSend;
  mIsNewsDelivery = inIsNewsDelivery;
}

MsgDeliveryListener::~MsgDeliveryListener()
{
}

NS_IMETHODIMP MsgDeliveryListener::OnStartRunningUrl(nsIURI *url)
{
  if (mMsgSend)
    mMsgSend->NotifyListenerOnStartSending(nullptr, 0);
  
  return NS_OK;
}

NS_IMETHODIMP MsgDeliveryListener::OnStopRunningUrl(nsIURI *url, nsresult aExitCode)
{  
  if (url)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> mailUrl = do_QueryInterface(url);
    if (mailUrl)
      mailUrl->UnRegisterListener(this);
  }

  // Let mMsgSend sort out the OnStopSending notification - it knows more about
  // the messages than we do.
  if (mMsgSend)
    mMsgSend->SendDeliveryCallback(url, mIsNewsDelivery, aExitCode);
      
  return NS_OK;
}


/* the following macro actually implement addref, release and query interface for our component. */
NS_IMPL_ISUPPORTS1(nsMsgComposeAndSend, nsIMsgSend)

nsMsgComposeAndSend::nsMsgComposeAndSend() :
    m_messageKey(0xffffffff)
{
  mGUINotificationEnabled = true;
  mAbortInProcess = false;
  mMultipartRelatedAttachmentCount = -1;
  mSendMailAlso = false;

  m_dont_deliver_p = false;
  m_deliver_mode = nsMsgDeliverNow;

  m_pre_snarfed_attachments_p = false;
  m_digest_p = false;
  m_be_synchronous_p = false;
  m_attachment1_type = 0;
  m_attachment1_encoding = 0;
  m_attachment1_body = 0;
  m_attachment1_body_length = 0;
  m_attachment_count = 0;
  m_attachment_pending_count = 0;
  m_status = NS_OK;
  m_plaintext = nullptr;
  m_related_part = nullptr;
  m_related_body_part = nullptr;
  mOriginalHTMLBody = nullptr;

  mNeedToPerformSecondFCC = false;

  mPreloadedAttachmentCount = 0;
  mRemoteAttachmentCount = 0;
  mCompFieldLocalAttachments = 0;
  mCompFieldRemoteAttachments = 0;
  mMessageWarningSize = 0;

  mSendReport = new nsMsgSendReport();
}

nsMsgComposeAndSend::~nsMsgComposeAndSend()
{
  PR_Free(m_attachment1_type);
  PR_Free(m_attachment1_encoding);
  PR_Free(m_attachment1_body);
  PR_Free(mOriginalHTMLBody);

  if (m_plaintext)
  {
    if (m_plaintext->mTmpFile)
      m_plaintext->mTmpFile->Remove(false);

    m_plaintext = nullptr;
  }

  if (mHTMLFile)
    mHTMLFile->Remove(false);

  if (mCopyFile)
    mCopyFile->Remove(false);

  if (mCopyFile2)
    mCopyFile2->Remove(false);

  if (mTempFile && !mReturnFile)
    mTempFile->Remove(false);

  m_attachments.Clear();
}

NS_IMETHODIMP nsMsgComposeAndSend::GetDefaultPrompt(nsIPrompt ** aPrompt)
{
  NS_ENSURE_ARG(aPrompt);
  *aPrompt = nullptr;

  nsresult rv = NS_OK;

  if (mParentWindow)
  {
    rv = mParentWindow->GetPrompter(aPrompt);
    if (NS_SUCCEEDED(rv) && *aPrompt)
      return NS_OK;
  }

  /* If we cannot find a prompter, try the mail3Pane window */
  nsCOMPtr<nsIMsgWindow> msgWindow;
  nsCOMPtr <nsIMsgMailSession> mailSession (do_GetService(NS_MSGMAILSESSION_CONTRACTID));
  if (mailSession)
  {
    mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
    if (msgWindow)
      rv = msgWindow->GetPromptDialog(aPrompt);
  }

  return rv;
}

nsresult nsMsgComposeAndSend::GetNotificationCallbacks(nsIInterfaceRequestor** aCallbacks)
{
// TODO: stop using mail3pane window!
  nsCOMPtr<nsIMsgWindow> msgWindow;
  nsCOMPtr<nsIMsgMailSession> mailSession(do_GetService(NS_MSGMAILSESSION_CONTRACTID));
  mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
  if (msgWindow) {
    nsCOMPtr<nsIDocShell> docShell;
    msgWindow->GetRootDocShell(getter_AddRefs(docShell));
    nsCOMPtr<nsIInterfaceRequestor> ir(do_QueryInterface(docShell));
    nsCOMPtr<nsIInterfaceRequestor> notificationCallbacks;
    msgWindow->GetNotificationCallbacks(getter_AddRefs(notificationCallbacks));
    if (notificationCallbacks) {
      nsCOMPtr<nsIInterfaceRequestor> aggregrateIR;
      MsgNewInterfaceRequestorAggregation(notificationCallbacks, ir, getter_AddRefs(aggregrateIR));
      ir = aggregrateIR;
    }
    if (ir) {
      NS_ADDREF(*aCallbacks = ir);
      return NS_OK;
    }
  }
  return NS_ERROR_FAILURE;
}


static char *mime_mailto_stream_read_buffer = 0;
static char *mime_mailto_stream_write_buffer = 0;


char * mime_get_stream_write_buffer(void)
{
  if (!mime_mailto_stream_write_buffer)
    mime_mailto_stream_write_buffer = (char *) PR_Malloc(MIME_BUFFER_SIZE);
  return mime_mailto_stream_write_buffer;
}

static bool isEmpty(const char* aString)
{
  return (!aString) || (!*aString);
}

void nsMsgComposeAndSend::GenerateMessageId()
{
  if (isEmpty(mCompFields->GetMessageId()))
  {
    if (isEmpty(mCompFields->GetTo()) &&
        isEmpty(mCompFields->GetCc()) &&
        isEmpty(mCompFields->GetBcc()) &&
        !isEmpty(mCompFields->GetNewsgroups()))
    {
      bool generateNewsMessageId = false;
      mUserIdentity->GetBoolAttribute("generate_news_message_id", &generateNewsMessageId);
      if (!generateNewsMessageId)
        return;
    }

    char* msgID = msg_generate_message_id(mUserIdentity);
    mCompFields->SetMessageId(msgID);
    PR_Free(msgID);
  }
}

// Don't I18N this line...this is per the spec!
#define   MIME_MULTIPART_BLURB     "This is a multi-part message in MIME format."

/* All of the desired attachments have been written to individual temp files,
   and we know what's in them.  Now we need to make a final temp file of the
   actual mail message, containing all of the other files after having been
   encoded as appropriate.
 */
NS_IMETHODIMP
nsMsgComposeAndSend::GatherMimeAttachments()
{
  bool shouldDeleteDeliveryState = true;
  nsresult status;
  uint32_t    i;
  char *headers = 0;
  PRFileDesc  *in_file = 0;
  bool multipart_p = false;
  bool plaintext_is_mainbody_p = false; // only using text converted from HTML?
  char *buffer = 0;
  char *buffer_tail = 0;
  nsString msg;
  bool tonews;
  bool body_is_us_ascii = true;

  nsMsgSendPart* toppart = nullptr;      // The very top most container of the message
                      // that we are going to send.

  nsMsgSendPart* mainbody = nullptr;     // The leaf node that contains the text of the
                      // message we're going to contain.

  nsMsgSendPart* maincontainer = nullptr;  // The direct child of toppart that will
                      // contain the mainbody.  If mainbody is
                      // the same as toppart, then this is
                      // also the same.  But if mainbody is
                      // to end up somewhere inside of a
                      // multipart/alternative or a
                      // multipart/related, then this is that
                      // multipart object.

  nsMsgSendPart* plainpart = nullptr;    // If we converted HTML into plaintext,
                      // the message or child containing the plaintext
                      // goes here. (Need to use this to determine
                      // what headers to append/set to the main
                      // message body.)

  uint32_t multipartRelatedCount = GetMultipartRelatedCount(); // The number of related part we will have to generate

  nsCOMPtr<nsIPrompt> promptObject; // only used if we have to show an alert here....
  GetDefaultPrompt(getter_AddRefs(promptObject));

  char *hdrs = 0;
  bool maincontainerISrelatedpart = false;
  const char * toppart_type = nullptr;

  // If we have any attachments, we generate multipart.
  multipart_p = (m_attachment_count > 0);

  // to news is true if we have a m_field and we have a Newsgroup and it is not empty
  tonews = false;
  if (mCompFields)
  {
    const char* pstrzNewsgroup = mCompFields->GetNewsgroups();
    if (pstrzNewsgroup && *pstrzNewsgroup)
      tonews = true;
  }

  status = m_status;
  if (NS_FAILED(status))
    goto FAIL;

  if (!m_attachment1_type) {
    m_attachment1_type = PL_strdup(TEXT_PLAIN);
    if (!m_attachment1_type)
      goto FAILMEM;
  }

  nsresult rv;

  // If we have a text/html main part, and we need a plaintext attachment, then
  // we'll do so now.  This is an asynchronous thing, so we'll kick it off and
  // count on getting back here when it finishes.

  if (m_plaintext == nullptr &&
      (mCompFields->GetForcePlainText() ||
       mCompFields->GetUseMultipartAlternative()) &&
       m_attachment1_body && PL_strcmp(m_attachment1_type, TEXT_HTML) == 0)
  {
    //
    // If we get here, we have an HTML body, but we really need to send
    // a text/plain message, so we will write the HTML out to a disk file,
    // fire off another URL request for this local disk file and that will
    // take care of the conversion...
    //
    rv = nsMsgCreateTempFile("nsemail.html", getter_AddRefs(mHTMLFile));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIOutputStream> tempfile;
    rv = MsgNewBufferedFileOutputStream(getter_AddRefs(tempfile), mHTMLFile, -1, 00600);
    if (NS_FAILED(rv))
    {
      if (mSendReport)
      {
        nsAutoString error_msg;
        nsMsgBuildMessageWithTmpFile(mHTMLFile, error_msg);
        mSendReport->SetMessage(nsIMsgSendReport::process_Current, error_msg.get(), false);
      }
      status = NS_MSG_UNABLE_TO_OPEN_TMP_FILE;
      goto FAIL;
    }

    if (mOriginalHTMLBody)
    {
      uint32_t origLen = strlen(mOriginalHTMLBody);
      uint32_t n;
      nsresult rv = tempfile->Write(mOriginalHTMLBody, origLen, &n);
      if (NS_FAILED(rv) || n != origLen)
      {
        status = NS_MSG_ERROR_WRITING_FILE;
        goto FAIL;
      }
    }

    if (NS_FAILED(tempfile->Flush()))
    {
      status = NS_MSG_ERROR_WRITING_FILE;
      goto FAIL;
    }

    tempfile->Close();

    m_plaintext = new nsMsgAttachmentHandler;
    if (!m_plaintext)
      goto FAILMEM;
    m_plaintext->SetMimeDeliveryState(this);
    m_plaintext->m_bogus_attachment = true;

    nsAutoCString tempURL;
    rv = NS_GetURLSpecFromFile(mHTMLFile, tempURL);
    if (NS_FAILED(rv) || NS_FAILED(nsMsgNewURL(getter_AddRefs(m_plaintext->mURL), tempURL.get())))
    {
      m_plaintext = nullptr;
      goto FAILMEM;
    }

    m_plaintext->m_type = TEXT_HTML;
    m_plaintext->m_charset = mCompFields->GetCharacterSet();
    m_plaintext->m_desiredType = TEXT_PLAIN;
    m_attachment_pending_count ++;
    status = m_plaintext->SnarfAttachment(mCompFields);
    if (NS_FAILED(status))
      goto FAIL;
    if (m_attachment_pending_count > 0)
      return NS_OK;
  }

  /* Kludge to avoid having to allocate memory on the toy computers... */
  buffer = mime_get_stream_write_buffer();
  if (! buffer)
    goto FAILMEM;

  buffer_tail = buffer;

  NS_ASSERTION (m_attachment_pending_count == 0, "m_attachment_pending_count != 0");

  mComposeBundle->GetStringFromID(NS_MSG_ASSEMBLING_MSG, getter_Copies(msg));
  SetStatusMessage( msg );

  /* First, open the message file.
  */
  rv = nsMsgCreateTempFile("nsemail.eml", getter_AddRefs(mTempFile));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = MsgNewBufferedFileOutputStream(getter_AddRefs(mOutputFile), mTempFile, -1, 00600);
  if (NS_FAILED(rv))
  {
    status = NS_MSG_UNABLE_TO_OPEN_TMP_FILE;
    if (mSendReport)
    {
      nsAutoString error_msg;
      nsMsgBuildMessageWithTmpFile(mTempFile, error_msg);
      mSendReport->SetMessage(nsIMsgSendReport::process_Current, error_msg.get(), false);
    }
    goto FAIL;
  }

  // generate a message id, if necessary
  GenerateMessageId( );

  mainbody = new nsMsgSendPart(this, mCompFields->GetCharacterSet());
  if (!mainbody)
    goto FAILMEM;

  mainbody->SetMainPart(true);
  mainbody->SetType(m_attachment1_type ? m_attachment1_type : TEXT_PLAIN);

  NS_ASSERTION(mainbody->GetBuffer() == nullptr, "not-null buffer");
  status = mainbody->SetBuffer(m_attachment1_body ? m_attachment1_body : "");
  if (NS_FAILED(status))
    goto FAIL;

  /*
    Determine the encoding of the main message body before we free it.
    The proper way to do this should be to test whatever text is in mainbody
    just before writing it out, but that will require a fix that is less safe
    and takes more memory. */
  PR_FREEIF(m_attachment1_encoding);
  if (m_attachment1_body)
    mCompFields->GetBodyIsAsciiOnly(&body_is_us_ascii);

  if (!mCompFields->GetForceMsgEncoding() && (body_is_us_ascii ||
      nsMsgI18Nstateful_charset(mCompFields->GetCharacterSet())))
    m_attachment1_encoding = PL_strdup (ENCODING_7BIT);
  else if (mime_use_quoted_printable_p)
    m_attachment1_encoding = PL_strdup (ENCODING_QUOTED_PRINTABLE);
  else
    m_attachment1_encoding = PL_strdup (ENCODING_8BIT);
  PR_FREEIF (m_attachment1_body);

  maincontainer = mainbody;

  // If we were given a pre-saved collection of HTML and contained images,
  // then we want mainbody to point to the HTML lump therein.
  if (m_related_part)
  {
    // If m_related_part is of type text/html, set both maincontainer
    // and mainbody to point to it. If m_related_part is multipart/related,
    // however, set mainbody to be the first child within m_related_part.
    delete mainbody;

    // No matter what, maincontainer points to the outermost related part.
    maincontainer = m_related_part;
    maincontainerISrelatedpart = true;

    mainbody = m_related_part->GetChild(0);
    mainbody->SetMainPart(true);
  }
  if (m_plaintext)
  {
    //
    // OK.  We have a plaintext version of the main body that we want to
    // send instead of or with the text/html.  Shove it in.
    //
    plainpart = new nsMsgSendPart(this, mCompFields->GetCharacterSet());
    if (!plainpart)
      goto FAILMEM;
    status = plainpart->SetType(TEXT_PLAIN);
    if (NS_FAILED(status))
      goto FAIL;
    status = plainpart->SetFile(m_plaintext->mTmpFile);
    if (NS_FAILED(status))
      goto FAIL;

    m_plaintext->mMainBody = true;

    // Determine Content-Transfer-Encoding for the attachments.
    m_plaintext->PickEncoding(mCompFields->GetCharacterSet(), this);
    const char *charset = mCompFields->GetCharacterSet();
    hdrs = mime_generate_attachment_headers(m_plaintext->m_type.get(),
                        nullptr,
                        m_plaintext->m_encoding.get(),
                        m_plaintext->m_description.get(),
                        m_plaintext->m_xMacType.get(),
                        m_plaintext->m_xMacCreator.get(),
                        nullptr, 0,
                        m_digest_p,
                        m_plaintext,
                        charset,
                        charset,
                        body_is_us_ascii,
                        nullptr,
                        true);
    if (!hdrs)
      goto FAILMEM;
    status = plainpart->SetOtherHeaders(hdrs);
    PR_Free(hdrs);
    hdrs = nullptr;
    if (NS_FAILED(status))
      goto FAIL;

    if (mCompFields->GetUseMultipartAlternative())
    {
      nsMsgSendPart* htmlpart = maincontainer;
      maincontainer = new nsMsgSendPart(this);
      if (!maincontainer)
        goto FAILMEM;

      // Setup the maincontainer stuff...
      status = maincontainer->SetType(MULTIPART_ALTERNATIVE);
      if (NS_FAILED(status))
        goto FAIL;

      status = maincontainer->AddChild(plainpart);
      if (NS_FAILED(status))
        goto FAIL;

      status = maincontainer->AddChild(htmlpart);
      if (NS_FAILED(status))
        goto FAIL;

      // Create the encoder for the plaintext part here,
      // because we aren't the main part (attachment1).
      // (This, along with the rest of the routine, should really
      // be restructured so that no special treatment is given to
      // the main body text that came in. Best to put attachment1_text
      // etc. into a nsMsgSendPart, then reshuffle the parts. Sigh.)
      if (m_plaintext->m_encoding.LowerCaseEqualsLiteral(ENCODING_QUOTED_PRINTABLE))
      {
        plainpart->SetEncoder(MimeEncoder::GetQPEncoder(
          mime_encoder_output_fn, this));
      }
      else if (m_plaintext->m_encoding.LowerCaseEqualsLiteral(ENCODING_BASE64))
      {
        plainpart->SetEncoder(MimeEncoder::GetBase64Encoder(
          mime_encoder_output_fn, this));
      }
    }
    else
    {
      delete maincontainer;
      if (maincontainerISrelatedpart)
        m_related_part = nullptr; // in that case, m_related_part == maincontainer which we have just deleted!
      maincontainer = plainpart;
      mainbody = maincontainer;
      PR_FREEIF(m_attachment1_type);
      m_attachment1_type = PL_strdup(TEXT_PLAIN);
      if (!m_attachment1_type)
        goto FAILMEM;

      /* Override attachment1_encoding here. */
      PR_FREEIF(m_attachment1_encoding);
      m_attachment1_encoding = ToNewCString(m_plaintext->m_encoding);

      plaintext_is_mainbody_p = true; // converted plaintext is mainbody
    }
  }

  // check if we need to encapsulate the message in a multipart/mixed or multipart/digest
  if (m_attachment_count > multipartRelatedCount)
  {
    toppart = new nsMsgSendPart(this);
    if (!toppart)
      goto FAILMEM;

    status = toppart->SetType(m_digest_p ? MULTIPART_DIGEST : MULTIPART_MIXED);
    if (NS_FAILED(status))
      goto FAIL;

    status = toppart->AddChild(maincontainer);
    if (NS_FAILED(status))
      goto FAIL;
  }
  else
    toppart = maincontainer;

  // Is the top part a multipart container?
  // can't use m_attachment_count because it's not reliable for that
  // instead use type of main part. See bug #174396
  toppart_type = toppart->GetType(); // GetType return directly the member variable, don't free it!
  if (!m_crypto_closure && toppart_type && !PL_strncasecmp(toppart_type, "multipart/", 10))
  {
    status = toppart->SetBuffer(MIME_MULTIPART_BLURB);
    if (NS_FAILED(status))
      goto FAIL;
  }

   /* Write out the message headers.
   */
  headers = mime_generate_headers (mCompFields, mCompFields->GetCharacterSet(),
                                   m_deliver_mode, promptObject, &status);
  if (NS_FAILED(status))
    goto FAIL;

  if (!headers)
    goto FAILMEM;

  //
  // If we converted HTML into plaintext, the plaintext part (plainpart)
  // already has its content-type and content-transfer-encoding
  // ("other") headers set.
  //
  // In the specific case where such a plaintext part is the
  // top level message part (iff an HTML message is being sent
  // as text only and no other attachments exist) we want to
  // preserve the original plainpart headers, since they
  // contain accurate transfer encoding and Mac type/creator
  // information.
  //
  // So, in the above case we append the main message headers,
  // otherwise we overwrite whatever headers may have existed.
  //
  /* reordering of headers will happen in nsMsgSendPart::Write */
  if ((plainpart) && (plainpart == toppart))
    status = toppart->AppendOtherHeaders(headers);
  else
    status = toppart->SetOtherHeaders(headers);
  PR_Free(headers);
  headers = nullptr;
  if (NS_FAILED(status))
    goto FAIL;

  // Set up the first part (user-typed.)  For now, do it even if the first
  // part is empty; we need to add things to skip it if this part is empty.

  // Set up encoder for the first part (message body.)
  //
  NS_ASSERTION(!m_attachment1_encoder, "not-null m_attachment1_encoder");
  if (!PL_strcasecmp(m_attachment1_encoding, ENCODING_BASE64))
  {
    m_attachment1_encoder = MimeEncoder::GetBase64Encoder(
      mime_encoder_output_fn, this);
  }
  else if (!PL_strcasecmp(m_attachment1_encoding, ENCODING_QUOTED_PRINTABLE))
  {
    m_attachment1_encoder = MimeEncoder::GetQPEncoder(mime_encoder_output_fn,
      this);
  }

  // If we converted HTML into plaintext, the plaintext part
  // already has its type/encoding headers set. So, in the specific
  // case where such a plaintext part is the main message body
  // (iff an HTML message is being sent as text only)
  // we want to avoid generating type/encoding/digest headers;
  // in all other cases, generate such headers here.
  //
  // We really want to set up headers as a dictionary of some sort
  // so that we need not worry about duplicate header lines.
  //
  if ((!plainpart) || (plainpart != mainbody))
  {
    const char *charset = mCompFields->GetCharacterSet();
    hdrs = mime_generate_attachment_headers (m_attachment1_type,
                         nullptr,
                         m_attachment1_encoding,
                         0, 0, 0, 0, 0,
                         m_digest_p,
                         nullptr, /* no "ma"! */
                         charset,
                         charset,
                         mCompFields->GetBodyIsAsciiOnly(),
                         nullptr,
                         true);
    if (!hdrs)
      goto FAILMEM;
    status = mainbody->AppendOtherHeaders(hdrs);
    if (NS_FAILED(status))
      goto FAIL;
  }

  PR_FREEIF(hdrs);

  mainbody->SetEncoder(m_attachment1_encoder.forget());

  //
  // Now we need to process attachments and slot them in the
  // correct hierarchy.
  //
  if (m_attachment_count > 0)
  {
    // Kludge to avoid having to allocate memory on the toy computers...
    if (! mime_mailto_stream_read_buffer)
      mime_mailto_stream_read_buffer = (char *) PR_Malloc (MIME_BUFFER_SIZE);
    buffer = mime_mailto_stream_read_buffer;
    if (! buffer)
      goto FAILMEM;
    buffer_tail = buffer;

    // Gather all of the attachments for this message that are NOT
    // part of an enclosed MHTML message!
    for (i = 0; i < m_attachment_count; i++)
    {
      nsMsgAttachmentHandler *ma = m_attachments[i];
      if (!ma->mMHTMLPart)
        PreProcessPart(ma, toppart);
    }

    //
    // If we have a m_related_part as a container for children, then we have to
    // tack on these children for the part
    //
    if (m_related_part)
    {
      for (i = 0; i < m_attachment_count; i++)
      {
        //
        // look for earlier part with the same content id. If we find it,
        // need to remember the mapping between our node index and the
        // part num of the earlier part.
        int32_t nodeIndex = m_attachments[i]->mNodeIndex;
        if (nodeIndex != -1)
        {
          for (uint32_t j = 0; j < i; j++)
          {
            if (m_attachments[j]->mNodeIndex != -1 &&
                m_attachments[j]->m_contentId.Equals(m_attachments[i]->m_contentId))
              m_partNumbers[nodeIndex] = m_partNumbers[m_attachments[j]->mNodeIndex];
          }
        }
        // rhp: This is here because we could get here after saying OK
        // to a lot of prompts about not being able to fetch this part!
        //
        if (m_attachments[i]->mPartUserOmissionOverride)
          continue;

        // Now, we need to add this part to the m_related_part member so the
        // message will be generated correctly.
        if (m_attachments[i]->mMHTMLPart)
          PreProcessPart(m_attachments[i], m_related_part);
      }
    }

  }

  // Tell the user we are creating the message...
  mComposeBundle->GetStringFromID(NS_MSG_CREATING_MESSAGE, getter_Copies(msg));
  SetStatusMessage( msg );

  // OK, now actually write the structure we've carefully built up.
  status = toppart->Write();
  if (NS_FAILED(status))
    goto FAIL;

  /* Close down encryption stream */
  if (m_crypto_closure)
  {
    status = m_crypto_closure->FinishCryptoEncapsulation(false, mSendReport);
    m_crypto_closure = 0;
    if (NS_FAILED(status)) goto FAIL;
  }

  if (mOutputFile)
  {
    if (NS_FAILED(mOutputFile->Flush()))
    {
      status = NS_MSG_ERROR_WRITING_FILE;
      goto FAIL;
    }

    mOutputFile->Close();
    mOutputFile = nullptr;

    // mTempFile is stale because we wrote to it.  Get another copy to refresh.
    nsCOMPtr<nsIFile> tempFileCopy;
    mTempFile->Clone(getter_AddRefs(tempFileCopy));
    mTempFile = tempFileCopy;
    tempFileCopy = nullptr;
    /* If we don't do this check...ZERO length files can be sent */
    int64_t fileSize;
    rv = mTempFile->GetFileSize(&fileSize);
    if (NS_FAILED(rv) || fileSize == 0)
    {
      status = NS_MSG_ERROR_WRITING_FILE;
      goto FAIL;
    }
  }

  mComposeBundle->GetStringFromID(NS_MSG_ASSEMB_DONE_MSG, getter_Copies(msg));
  SetStatusMessage(msg);

  if (m_dont_deliver_p && mListener)
  {
    //
    // Need to ditch the file spec here so that we don't delete the
    // file, since in this case, the caller wants the file
    //
    mReturnFile = mTempFile;
    mTempFile = nullptr;
    if (!mReturnFile)
      NotifyListenerOnStopSending(nullptr, NS_ERROR_OUT_OF_MEMORY, nullptr, nullptr);
    else
    {
      NotifyListenerOnStopSending(nullptr, NS_OK, nullptr, mReturnFile);
    }
  }
  else
  {
    status = DeliverMessage();
    if (NS_SUCCEEDED(status))
      shouldDeleteDeliveryState = false;
  }
  goto FAIL;

FAILMEM:
  status = NS_ERROR_OUT_OF_MEMORY;

FAIL:
  if (toppart)
    delete toppart;
  toppart = nullptr;
  mainbody = nullptr;
  maincontainer = nullptr;

  PR_FREEIF(headers);
  if (in_file)
  {
    PR_Close (in_file);
    in_file = nullptr;
  }

  if (shouldDeleteDeliveryState)
  {
    if (NS_FAILED(status))
    {
      m_status = status;
      nsresult ignoreMe;
      Fail(status, nullptr, &ignoreMe);
    }
  }

  return status;
}

int32_t
nsMsgComposeAndSend::PreProcessPart(nsMsgAttachmentHandler  *ma,
                                    nsMsgSendPart           *toppart) // The very top most container of the message
{
  nsresult        status;
  char            *hdrs = 0;
  nsMsgSendPart   *part = nullptr;

  // If this was one of those dead parts from a quoted web page,
  // then just return safely.
  //
  if (ma->m_bogus_attachment)
    return 0;

  // If at this point we *still* don't have a content-type, then
  // we're never going to get one.
  if (ma->m_type.IsEmpty())
    ma->m_type = UNKNOWN_CONTENT_TYPE;

  ma->PickEncoding (mCompFields->GetCharacterSet(), this);
  ma->PickCharset();

  part = new nsMsgSendPart(this);
  if (!part)
    return 0;
  status = toppart->AddChild(part);
  // Remember the part number if it has a node index.
  if (ma->mNodeIndex != -1)
    m_partNumbers[ma->mNodeIndex] = part->m_partNum;

  if (NS_FAILED(status))
    return 0;
  status = part->SetType(ma->m_type.get());
  if (NS_FAILED(status))
    return 0;

  if (ma->mSendViaCloud)
    ma->m_encoding = ENCODING_7BIT;

  nsCString turl;
  if (!ma->mURL)
  {
    if (!ma->m_uri.IsEmpty())
      turl = ma->m_uri;
  }
  else
    ma->mURL->GetSpec(turl);

  nsCString type(ma->m_type);
  nsCString realName(ma->m_realName);

  // for cloud attachments, make the part an html part with no name,
  // so we don't show it as an attachment.
  if (ma->mSendViaCloud)
  {
    type.Assign("application/octet-stream");
    realName.Truncate();
  }
  hdrs = mime_generate_attachment_headers (type.get(),
                                           ma->m_typeParam.get(),
                                           ma->m_encoding.get(),
                                           ma->m_description.get(),
                                           ma->m_xMacType.get(),
                                           ma->m_xMacCreator.get(),
                                           realName.get(),
                                           turl.get(),
                                           m_digest_p,
                                           ma,
                                           ma->m_charset.get(), // rhp - this needs
                                                          // to be the charset
                                                          // we determine from
                                                          // the file or none
                                                          // at all!
                                           mCompFields->GetCharacterSet(),
                                           false,      // bodyIsAsciiOnly to false
                                                          // for attachments
                                           ma->m_contentId.get(),
                                           false);
  if (!hdrs)
    return 0;

  status = part->SetOtherHeaders(hdrs);
  PR_FREEIF(hdrs);
  if (ma->mSendViaCloud)
  {
    nsCString urlSpec;
    ma->mURL->GetSpec(urlSpec);
    // Need to add some headers so that libmime can restore the cloud info
    // when loading a draft message.
    nsCString draftInfo(HEADER_X_MOZILLA_CLOUD_PART": cloudFile; url=");
    draftInfo.Append(ma->mCloudUrl.get());
    // don't leak user file paths or account keys to recipients.
    if (m_deliver_mode == nsMsgSaveAsDraft)
    {
      draftInfo.Append("; provider=");
      draftInfo.Append(ma->mCloudProviderKey.get());
      draftInfo.Append("; file=");
      draftInfo.Append(urlSpec.get());
    }
    draftInfo.Append("; name=");
    draftInfo.Append(ma->m_realName.get());
    draftInfo.Append(CRLF);
    part->AppendOtherHeaders(draftInfo.get());
    part->SetType("application/octet-stream");
    part->SetBuffer("");
  }
  if (NS_FAILED(status))
    return 0;
  status = part->SetFile(ma->mTmpFile);
  if (NS_FAILED(status))
    return 0;
  if (ma->m_encoder)
  {
    part->SetEncoder(ma->m_encoder.forget());
  }

  ma->m_current_column = 0;

  if (ma->m_type.LowerCaseEqualsLiteral(MESSAGE_RFC822) ||
      ma->m_type.LowerCaseEqualsLiteral(MESSAGE_NEWS)) {
    part->SetStripSensitiveHeaders(true);
  }

  return 1;
}

# define FROB(X) \
    if (X && *X) \
    { \
      if (*recipients) PL_strcat(recipients, ","); \
      PL_strcat(recipients, X); \
    }

nsresult nsMsgComposeAndSend::BeginCryptoEncapsulation ()
{
  // Try to create a secure compose object. If we can create it, then query to see
  // if we need to use it for this send transaction.

  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgComposeSecure> secureCompose;
  secureCompose = do_CreateInstance(NS_MSGCOMPOSESECURE_CONTRACTID, &rv);
  // it's not an error scenario of there is secure compose
  if (NS_FAILED(rv))
    return NS_OK;

  if (secureCompose)
  {
    bool requiresEncryptionWork = false;
    secureCompose->RequiresCryptoEncapsulation(mUserIdentity, mCompFields, &requiresEncryptionWork);
    if (requiresEncryptionWork)
    {
      m_crypto_closure = secureCompose;
      // bah i'd like to move the following blurb into the implementation of BeginCryptoEncapsulation; however
      // the apis for nsIMsgComposeField just aren't rich enough. It requires the implementor to jump through way
      // too many string conversions....
      char * recipients = (char *)
      PR_MALLOC((mCompFields->GetTo()  ? strlen(mCompFields->GetTo())  : 0) +
         (mCompFields->GetCc()  ? strlen(mCompFields->GetCc())  : 0) +
         (mCompFields->GetBcc() ? strlen(mCompFields->GetBcc()) : 0) +
         (mCompFields->GetNewsgroups() ? strlen(mCompFields->GetNewsgroups()) : 0) + 20);
      if (!recipients) return NS_ERROR_OUT_OF_MEMORY;

      *recipients = 0;

      FROB(mCompFields->GetTo())
      FROB(mCompFields->GetCc())
      FROB(mCompFields->GetBcc())
      FROB(mCompFields->GetNewsgroups())

      // end section of code I'd like to move to the implementor.....
      rv = m_crypto_closure->BeginCryptoEncapsulation(mOutputFile,
                                                      recipients,
                                                      mCompFields,
                                                      mUserIdentity,
                                                      mSendReport,
                                                      (m_deliver_mode == nsMsgSaveAsDraft));

      PR_FREEIF(recipients);
    }

  }

  return rv;
}

nsresult
mime_write_message_body(nsIMsgSend *state, const char *buf, int32_t size)
{
  NS_ENSURE_ARG_POINTER(state);

  nsCOMPtr<nsIOutputStream> output;
  nsCOMPtr<nsIMsgComposeSecure> crypto_closure;

  state->GetOutputStream(getter_AddRefs(output));
  if (!output)
    return NS_MSG_ERROR_WRITING_FILE;

  state->GetCryptoclosure(getter_AddRefs(crypto_closure));
  if (crypto_closure)
  {
    return crypto_closure->MimeCryptoWriteBlock (buf, size);
  }

  uint32_t n;
  nsresult rv = output->Write(buf, size, &n);
  if (NS_FAILED(rv) || n != (uint32_t)size)
  {
    return NS_MSG_ERROR_WRITING_FILE;
  }
  else
  {
    return NS_OK;
  }
}

nsresult
mime_encoder_output_fn(const char *buf, int32_t size, void *closure)
{
  nsMsgComposeAndSend *state = (nsMsgComposeAndSend *) closure;
  return mime_write_message_body (state, (char *) buf, size);
}

nsresult
nsMsgComposeAndSend::GetEmbeddedObjectInfo(nsIDOMNode *node, nsMsgAttachmentData *attachment, bool *acceptObject)
{
  NS_ENSURE_ARG_POINTER(node);
  NS_ENSURE_ARG_POINTER(attachment);
  NS_ENSURE_ARG_POINTER(acceptObject);

  // GetEmbeddedObjectInfo will determine if we need to attach the source of the
  // embedded object with the message. The decision is made automatically unless
  // the attribute moz-do-not-send has been set to true or false.
  // The default rule is that all image and anchor objects are attached as well
  // link to a local file
  nsresult rv = NS_OK;

  // Reset this structure to null!
  *acceptObject = false;

  // Check if the object has a moz-do-not-send attribute set. If it's true,
  // we must ignore it, if false set forceToBeAttached to be true.

  bool forceToBeAttached = false;
  nsCOMPtr<nsIDOMElement> domElement = do_QueryInterface(node);
  if (domElement)
  {
    nsAutoString attributeValue;
    if (NS_SUCCEEDED(domElement->GetAttribute(NS_LITERAL_STRING(ATTR_MOZ_DO_NOT_SEND), attributeValue)))
    {
      if (attributeValue.LowerCaseEqualsLiteral("true"))
        return NS_OK;
      if (attributeValue.LowerCaseEqualsLiteral("false"))
        forceToBeAttached = true;
    }
  }
  // Now, we know the types of objects this node can be, so we will do
  // our query interface here and see what we come up with
  nsCOMPtr<nsIDOMHTMLBodyElement>     body = (do_QueryInterface(node));
  // XXX convert to use nsIImageLoadingContent?
  nsCOMPtr<nsIDOMHTMLImageElement>    image = (do_QueryInterface(node));
  nsCOMPtr<nsIDOMHTMLLinkElement>     link = (do_QueryInterface(node));
  nsCOMPtr<nsIDOMHTMLAnchorElement>   anchor = (do_QueryInterface(node));

  // First, try to see if the body as a background image
  if (body)
  {
    nsAutoString    tUrl;
    if (NS_SUCCEEDED(body->GetBackground(tUrl)))
    {
      nsAutoCString turlC;
      CopyUTF16toUTF8(tUrl, turlC);
      if (NS_FAILED(nsMsgNewURL(getter_AddRefs(attachment->m_url), turlC.get())))
        return NS_OK;
     }
  }
  else if (image)        // Is this an image?
  {
    nsString    tUrl;
    nsString    tName;
    nsString    tDesc;

    // Create the URI
    if (NS_FAILED(image->GetSrc(tUrl)))
      return NS_ERROR_FAILURE;
    nsAutoCString turlC;
    CopyUTF16toUTF8(tUrl, turlC);
    if (NS_FAILED(nsMsgNewURL(getter_AddRefs(attachment->m_url), turlC.get())))
    {
      // Well, the first time failed...which means we probably didn't get
      // the full path name...
      //
      nsIDOMDocument    *ownerDocument = nullptr;
      node->GetOwnerDocument(&ownerDocument);
      if (ownerDocument)
      {
        nsIDocument     *doc = nullptr;
        if (NS_FAILED(ownerDocument->QueryInterface(NS_GET_IID(nsIDocument),(void**)&doc)) || !doc)
          return NS_ERROR_OUT_OF_MEMORY;

        nsAutoCString spec;
        nsIURI *uri = doc->GetDocumentURI();

        if (!uri)
          return NS_ERROR_OUT_OF_MEMORY;

        uri->GetSpec(spec);

        // Ok, now get the path to the root doc and tack on the name we
        // got from the GetSrc() call....
        NS_ConvertUTF8toUTF16 workURL(spec);

        int32_t loc = workURL.RFindChar('/');
        if (loc >= 0)
          workURL.SetLength(loc+1);
        workURL.Append(tUrl);
        NS_ConvertUTF16toUTF8 workurlC(workURL);
        if (NS_FAILED(nsMsgNewURL(getter_AddRefs(attachment->m_url), workurlC.get())))
          // rhp - just try to continue and send it without this image.
          return NS_OK;
      }
    }

    rv = image->GetName(tName);
    NS_ENSURE_SUCCESS(rv, rv);

    LossyCopyUTF16toASCII(tName, attachment->m_realName);
    rv = image->GetLongDesc(tDesc);
    NS_ENSURE_SUCCESS(rv, rv);
    attachment->m_description = NS_LossyConvertUTF16toASCII(tDesc); // XXX i18n
  }
  else if (link)        // Is this a link?
  {
    nsString    tUrl;

    // Create the URI
    rv = link->GetHref(tUrl);
    NS_ENSURE_SUCCESS(rv, rv);
    nsAutoCString turlC;
    CopyUTF16toUTF8(tUrl, turlC);
    rv = nsMsgNewURL(getter_AddRefs(attachment->m_url), turlC.get());
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else if (anchor)
  {
    nsString    tUrl;
    nsString    tName;

    // Create the URI
    rv = anchor->GetHref(tUrl);
    NS_ENSURE_SUCCESS(rv, rv);
    nsAutoCString turlC;
    CopyUTF16toUTF8(tUrl, turlC);
    // ignore errors here.
    (void) nsMsgNewURL(getter_AddRefs(attachment->m_url), turlC.get());
    rv = anchor->GetName(tName);
    NS_ENSURE_SUCCESS(rv, rv);
    LossyCopyUTF16toASCII(tName, attachment->m_realName);
  }
  else
  {
    // If we get here, we got something we didn't expect!
    // Just try to continue and send it without this thing.
    return NS_OK;
  }

  //
  // Before going further, check if we are dealing with a local file and
  // if it's the case be sure the file exists!
  bool schemeIsFile = false;
  if (attachment->m_url)
    rv = attachment->m_url->SchemeIs("file", &schemeIsFile);

  if (schemeIsFile && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIFileURL> fileUrl (do_QueryInterface(attachment->m_url));
    if (fileUrl)
    {
      bool isAValidFile = false;

      nsCOMPtr<nsIFile> aFile;
      rv = fileUrl->GetFile(getter_AddRefs(aFile));
      if (NS_SUCCEEDED(rv) && aFile)
      {
        rv = aFile->IsFile(&isAValidFile);
        if (NS_FAILED(rv))
          isAValidFile = false;
        else
        {
          if (anchor)
          {
            // One more test, if the anchor points to a local network server, let's check what the pref
            // mail.compose.dont_attach_source_of_local_network_links tells us to do.
            nsAutoCString urlSpec;
            rv = attachment->m_url->GetSpec(urlSpec);
            if (NS_SUCCEEDED(rv))
              if (StringBeginsWith(urlSpec, NS_LITERAL_CSTRING("file://///")))
              {
                nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
                if (pPrefBranch)
                {
                  bool dontSend = false;
                  rv = pPrefBranch->GetBoolPref(PREF_MAIL_DONT_ATTACH_SOURCE, &dontSend);
                  if (dontSend)
                    isAValidFile = false;
                }
              }
          }
        }
      }

      if (! isAValidFile)
        return NS_OK;
    }
  }
  else //not a file:// url
  {
    //if this is an anchor, don't attach remote file unless we have been forced to do it
    if (anchor && !forceToBeAttached)
      return NS_OK;
  }

  *acceptObject = true;
  return NS_OK;
}


uint32_t
nsMsgComposeAndSend::GetMultipartRelatedCount(bool forceToBeCalculated /*=false*/)
{
  nsresult                  rv = NS_OK;
  uint32_t                  count;

  if (mMultipartRelatedAttachmentCount != -1 && !forceToBeCalculated)
    return (uint32_t)mMultipartRelatedAttachmentCount;

  //First time here, let's calculate the correct number of related part we need to generate
  mMultipartRelatedAttachmentCount = 0;
  if (mEditor)
  {
    nsCOMPtr<nsIEditorMailSupport> mailEditor (do_QueryInterface(mEditor));
    if (!mailEditor)
      return 0;

    rv = mailEditor->GetEmbeddedObjects(getter_AddRefs(mEmbeddedObjectList));
    if (NS_FAILED(rv))
      return 0;
  }
  if (!mEmbeddedObjectList)
    return 0;

  if (NS_SUCCEEDED(mEmbeddedObjectList->Count(&count)))
  {
    if (count > 0)
    {
      // preallocate space for part numbers
      m_partNumbers.SetLength(count);
      // Let parse the list to count the number of valid objects. BTW, we can remove the others from the list
      nsMsgAttachmentData attachment;

      int32_t i;
      nsCOMPtr<nsIDOMNode> node;

      for (i = count - 1, count = 0; i >= 0; i --)
      {
        // Reset this structure to null!

        // now we need to get the element in the array and do the magic
        // to process this element.
        //
        node = do_QueryElementAt(mEmbeddedObjectList, i, &rv);
        bool acceptObject = false;
        if (node)
        {
          rv = GetEmbeddedObjectInfo(node, &attachment, &acceptObject);
        }
        else // outlook/eudora import case
        {
          nsCOMPtr<nsIMsgEmbeddedImageData> imageData =
            do_QueryElementAt(mEmbeddedObjectList, i, &rv);
          if (!imageData)
            continue;
          acceptObject = true;
        }
        if (NS_SUCCEEDED(rv) && acceptObject)
          count ++;
      }
    }
    mMultipartRelatedAttachmentCount = (int32_t)count;
    return count;
  }
  else
    return 0;
}

nsresult
nsMsgComposeAndSend::GetBodyFromEditor()
{
  //
  // Now we have to fix up and get the HTML from the editor. After we
  // get the HTML data, we need to store it in the m_attachment_1_body
  // member variable after doing the necessary charset conversion.
  //

  //
  // Query the editor, get the body of HTML!
  //
  uint32_t  flags = nsIDocumentEncoder::OutputFormatted  | nsIDocumentEncoder::OutputNoFormattingInPre;
  nsAutoString bodyStr;
  PRUnichar* bodyText = nullptr;
  nsresult rv;
  PRUnichar *origHTMLBody = nullptr;

  // Ok, get the body...the DOM should have been whacked with
  // Content ID's already
  if (mEditor)
    mEditor->OutputToString(NS_LITERAL_STRING(TEXT_HTML), flags, bodyStr);
  else
    bodyStr = NS_ConvertASCIItoUTF16(m_attachment1_body);

  // If we really didn't get a body, just return NS_OK
  if (bodyStr.IsEmpty())
    return NS_OK;
  bodyText = ToNewUnicode(bodyStr);
  if (!bodyText)
    return NS_ERROR_OUT_OF_MEMORY;

  // If we are forcing this to be plain text, we should not be
  // doing this conversion.
  bool doConversion = true;

  if ( (mCompFields) && mCompFields->GetForcePlainText() )
    doConversion = false;

  if (doConversion)
  {
    nsCOMPtr<mozITXTToHTMLConv> conv = do_CreateInstance(MOZ_TXTTOHTMLCONV_CONTRACTID, &rv);

    if (NS_SUCCEEDED(rv))
    {
      uint32_t whattodo = mozITXTToHTMLConv::kURLs;
      bool enable_structs = false;
      nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
      if (pPrefBranch)
      {
        rv = pPrefBranch->GetBoolPref(PREF_MAIL_SEND_STRUCT, &enable_structs);
        if (enable_structs)
          whattodo = whattodo | mozITXTToHTMLConv::kStructPhrase;
      }

      PRUnichar* wresult;
      rv = conv->ScanHTML(bodyText, whattodo, &wresult);
      if (NS_SUCCEEDED(rv))
      {
        // Save the original body for possible attachment as plain text
        // We should have what the user typed in stored in mOriginalHTMLBody
        origHTMLBody = bodyText;
        bodyText = wresult;
      }
    }
  }

  nsCString attachment1_body;

  // Convert body to mail charset
  nsCString    outCString;
  const char  *aCharset = mCompFields->GetCharacterSet();

  if (aCharset && *aCharset)
  {
    bool isAsciiOnly;
    rv = nsMsgI18NSaveAsCharset(mCompFields->GetForcePlainText() ? TEXT_PLAIN : TEXT_HTML,
                                aCharset, bodyText, getter_Copies(outCString), nullptr, &isAsciiOnly);

    if (mCompFields->GetForceMsgEncoding())
      isAsciiOnly = false;

    mCompFields->SetBodyIsAsciiOnly(isAsciiOnly);

    // If the body contains characters outside the current mail charset,
    // convert to UTF-8.
    if (NS_ERROR_UENC_NOMAPPING == rv) {
      // if nbsp then replace it by sp and try again
      PRUnichar *bodyTextPtr = bodyText;
      while (*bodyTextPtr) {
        if (0x00A0 == *bodyTextPtr)
          *bodyTextPtr = 0x0020;
        bodyTextPtr++;
      }

      nsCString fallbackCharset;
      rv = nsMsgI18NSaveAsCharset(mCompFields->GetForcePlainText() ? TEXT_PLAIN : TEXT_HTML,
                                 aCharset, bodyText, getter_Copies(outCString),
                                 getter_Copies(fallbackCharset));
      if (NS_ERROR_UENC_NOMAPPING == rv)
      {
        bool needToCheckCharset;
        mCompFields->GetNeedToCheckCharset(&needToCheckCharset);
        if (needToCheckCharset)
        {
          // Just use UTF-8 and be done with it
          // unless disable_fallback_to_utf8 is set for this charset.
          bool disableFallback = false;
          nsCOMPtr<nsIPrefBranch> prefBranch (do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
          if (prefBranch)
          {
            nsCString prefName("mailnews.disable_fallback_to_utf8.");
            prefName.Append(aCharset);
            prefBranch->GetBoolPref(prefName.get(), &disableFallback);
          }
          if (!disableFallback)
          {
            CopyUTF16toUTF8(nsDependentString(bodyText), outCString);
            mCompFields->SetCharacterSet("UTF-8");
          }
        }
      }
      else if (!fallbackCharset.IsEmpty())
      {
        // re-label to the fallback charset
        mCompFields->SetCharacterSet(fallbackCharset.get());
      }
    }

    if (NS_SUCCEEDED(rv))
      attachment1_body = outCString;

    // If we have an origHTMLBody that is not null, this means that it is
    // different than the bodyText because of formatting conversions. Because of
    // this we need to do the charset conversion on this part separately
    if (origHTMLBody)
    {
      char      *newBody = nullptr;
      rv = nsMsgI18NSaveAsCharset(mCompFields->GetUseMultipartAlternative() ? TEXT_PLAIN : TEXT_HTML,
                                  aCharset, origHTMLBody, &newBody);
      if (NS_SUCCEEDED(rv))
      {
        PR_FREEIF(origHTMLBody);
        origHTMLBody = (PRUnichar *)newBody;
      }
    }

    NS_Free(bodyText);    //Don't need it anymore
  }
  else
    return NS_ERROR_FAILURE;

  // If our holder for the original body text is STILL null, then just
  // just copy what we have as the original body text.

  if (!origHTMLBody)
    mOriginalHTMLBody = ToNewCString(attachment1_body);
  else
    mOriginalHTMLBody = (char *)origHTMLBody; // Whoa, origHTMLBody is declared as a PRUnichar *, what's going on here?

  rv = SnarfAndCopyBody(attachment1_body, TEXT_HTML);

  return rv;
}

// for SMTP, 16k
// for our internal protocol buffers, 4k
// for news < 1000
// so we choose the minimum, because we could be sending and posting this message.
// Use the exact value, because preceding steps might have trimmed the length
// close to it, and here e.g. we run the risk of breaking UTF-8 pairs in half.
// See #684508
#define LINE_BREAK_MAX (1000 - MSG_LINEBREAK_LEN)

// EnsureLineBreaks() will set m_attachment1_body and m_attachment1_body_length
nsresult
nsMsgComposeAndSend::EnsureLineBreaks(const nsCString &aBody)
{
  const char *body = aBody.get();
  uint32_t bodyLen = aBody.Length();

  uint32_t i;
  uint32_t charsSinceLineBreak = 0;
  uint32_t lastPos = 0;


  char *newBody = nullptr;
  char *newBodyPos = nullptr;

  // the most common way to get into the state where we have to insert
  // linebreaks is when we do HTML reply and we quote large <pre> blocks.
  // see #83381 and #84261
  //
  // until #67334 is fixed, we'll be replacing newlines with <br>, which can lead
  // to large quoted <pre> blocks without linebreaks.
  // this hack makes it so we can at least save (as draft or template) and send or post
  // the message.
  //
  // XXX TODO
  // march backwards and determine the "best" place for the linebreak
  // for example, we don't want <a hrLINEBREAKref=""> or <bLINEBREAKr>
  // or "MississLINEBREAKippi"
  for (i = 0; i < bodyLen-1; i++) {
    if (strncmp(body+i, MSG_LINEBREAK, MSG_LINEBREAK_LEN)) {
      charsSinceLineBreak++;
      if (charsSinceLineBreak == LINE_BREAK_MAX) {
        if (!newBody) {
          // in the worse case, the body will be solid, no linebreaks.
          // that will require us to insert a line break every LINE_BREAK_MAX bytes
          uint32_t worstCaseLen = bodyLen+((bodyLen/LINE_BREAK_MAX)*MSG_LINEBREAK_LEN)+1;
          newBody = (char *) PR_Calloc(1, worstCaseLen);
          if (!newBody) return NS_ERROR_OUT_OF_MEMORY;
          newBodyPos = newBody;
        }

        PL_strncpy(newBodyPos, body+lastPos, i - lastPos + 1);
        newBodyPos += i - lastPos + 1;
        PL_strncpy(newBodyPos, MSG_LINEBREAK, MSG_LINEBREAK_LEN);
        newBodyPos += MSG_LINEBREAK_LEN;

        lastPos = i+1;
        charsSinceLineBreak = 0;
      }
    }
    else {
      // found a linebreak
      charsSinceLineBreak = 0;
    }
  }

  // if newBody is non-null is non-zero, we inserted a linebreak
  if (newBody) {
      // don't forget about part after the last linebreak we inserted
     PL_strncpy(newBodyPos, body+lastPos, bodyLen - lastPos);

     m_attachment1_body = newBody;
     m_attachment1_body_length = PL_strlen(newBody);  // not worstCaseLen
  }
  else {
     // body did not require any additional linebreaks, so just use it
     // body will not have any null bytes, so we can use PL_strdup
     m_attachment1_body = PL_strdup(body);
     if (!m_attachment1_body) {
      return NS_ERROR_OUT_OF_MEMORY;
     }
     m_attachment1_body_length = bodyLen;
  }
  return NS_OK;
}

//
// This is the routine that does the magic of generating the body and the
// attachments for the multipart/related email message.
//
typedef struct
{
  nsIDOMNode    *node;
  char          *url;
} domSaveStruct;

nsresult
nsMsgComposeAndSend::ProcessMultipartRelated(int32_t *aMailboxCount, int32_t *aNewsCount)
{
  uint32_t                  multipartCount = GetMultipartRelatedCount();
  nsresult                  rv = NS_OK;
  uint32_t                  i;
  int32_t                   j = -1;
  uint32_t                  k;
  int32_t                   duplicateOf;
  domSaveStruct             *domSaveArray = nullptr;

   if (!mEmbeddedObjectList)
    return NS_ERROR_MIME_MPART_ATTACHMENT_ERROR;

  nsMsgAttachmentData   attachment;
  int32_t               locCount = -1;

  if (multipartCount > 0)
  {
    domSaveArray = (domSaveStruct *)PR_MALLOC(sizeof(domSaveStruct) * multipartCount);
    if (!domSaveArray)
      return NS_ERROR_MIME_MPART_ATTACHMENT_ERROR;
    memset(domSaveArray, 0, sizeof(domSaveStruct) * multipartCount);
  }

  nsCOMPtr<nsIDOMNode> node;
  for (i = mPreloadedAttachmentCount; i < (mPreloadedAttachmentCount + multipartCount);)
  {
    // Ok, now we need to get the element in the array and do the magic
    // to process this element.
    //

    locCount++;
    mEmbeddedObjectList->QueryElementAt(locCount, NS_GET_IID(nsIDOMNode), getter_AddRefs(node));
    if (node)
    {
      bool acceptObject = false;
      rv = GetEmbeddedObjectInfo(node, &attachment, &acceptObject);
      NS_ENSURE_SUCCESS(rv, NS_ERROR_MIME_MPART_ATTACHMENT_ERROR);
      if (!acceptObject)
        continue;
      nsString nodeValue;
      node->GetNodeValue(nodeValue);
      LossyCopyUTF16toASCII(nodeValue, m_attachments[i]->m_contentId);
    }
    else
    {
      nsCOMPtr<nsIMsgEmbeddedImageData> imageData = do_QueryElementAt(mEmbeddedObjectList, locCount, &rv);
      if (!imageData)
        return NS_ERROR_MIME_MPART_ATTACHMENT_ERROR;
      imageData->GetUri(getter_AddRefs(attachment.m_url));
      if (!attachment.m_url)
        return NS_ERROR_MIME_MPART_ATTACHMENT_ERROR;
      imageData->GetCid(m_attachments[i]->m_contentId);
      imageData->GetName(attachment.m_realName);
    }


    // MUST set this to get placed in the correct part of the message
    m_attachments[i]->mMHTMLPart = true;

    m_attachments[i]->mDeleteFile = true;
    m_attachments[i]->m_done = false;
    m_attachments[i]->SetMimeDeliveryState(this);
    m_attachments[i]->mNodeIndex = locCount;

    j++;
    domSaveArray[j].node = node;

    // check if we have alreay attached this object, don't need to attach it twice
    duplicateOf = -1;
    for (k = mPreloadedAttachmentCount; k < i; k++)
    {
      bool isEqual = false;
      NS_ASSERTION(attachment.m_url, "null attachment url!");
      if (attachment.m_url)
        (void)attachment.m_url->Equals(m_attachments[k]->mURL, &isEqual);
      if (isEqual)
      {
        duplicateOf = k;
        break;
      }
    }

    if (duplicateOf == -1)
    {
      //
      // Now we have to get all of the interesting information from
      // the nsIDOMNode we have in hand...
      m_attachments[i]->mURL = attachment.m_url;

      m_attachments[i]->m_overrideType = attachment.m_realType;
      m_attachments[i]->m_overrideEncoding = attachment.m_realEncoding;
      m_attachments[i]->m_desiredType = attachment.m_desiredType;
      m_attachments[i]->m_description = attachment.m_description;
      m_attachments[i]->m_realName = attachment.m_realName;
      m_attachments[i]->m_xMacType = attachment.m_xMacType;
      m_attachments[i]->m_xMacCreator = attachment.m_xMacCreator;

      m_attachments[i]->m_charset = mCompFields->GetCharacterSet();
      m_attachments[i]->m_encoding = ENCODING_7BIT;

      if (m_attachments[i]->mURL)
        msg_pick_real_name(m_attachments[i], nullptr, mCompFields->GetCharacterSet());

      if (m_attachments[i]->m_contentId.IsEmpty())
      {
        //
        // Next, generate a content id for use with this part
        //
        nsCString email;
        mUserIdentity->GetEmail(email);
        m_attachments[i]->m_contentId = mime_gen_content_id(locCount+1, email.get());
      }

      //
      // Start counting the attachments which are going to come from mail folders
      // and from NNTP servers.
      //
      if (m_attachments[i]->mURL)
      {
        nsIURI *uri = m_attachments[i]->mURL;
        bool match = false;
        if ((NS_SUCCEEDED(uri->SchemeIs("mailbox", &match)) && match) ||
           (NS_SUCCEEDED(uri->SchemeIs("imap", &match)) && match))
          (*aMailboxCount)++;
        else if ((NS_SUCCEEDED(uri->SchemeIs("news", &match)) && match) ||
                (NS_SUCCEEDED(uri->SchemeIs("snews", &match)) && match))
          (*aNewsCount)++;
      }
    }
    else
    {
      m_attachments[i]->m_contentId = m_attachments[duplicateOf]->m_contentId;
      m_attachments[i]->SetMimeDeliveryState(nullptr);
    }

    //
    // Ok, while we are here, we should whack the DOM with the generated
    // Content-ID for this object. This will be necessary for generating
    // the HTML we need.
    //
    nsString domURL;
    if (!m_attachments[duplicateOf == -1 ? i : duplicateOf]->m_contentId.IsEmpty())
    {
      nsString   newSpec(NS_LITERAL_STRING("cid:"));
      newSpec.AppendASCII(m_attachments[duplicateOf == -1 ? i : duplicateOf]->m_contentId.get());

      // Now, we know the types of objects this node can be, so we will do
      // our query interface here and see what we come up with
      nsCOMPtr<nsIDOMHTMLBodyElement>     body = (do_QueryInterface(domSaveArray[j].node));
      nsCOMPtr<nsIDOMHTMLImageElement>    image = (do_QueryInterface(domSaveArray[j].node));
      nsCOMPtr<nsIDOMHTMLLinkElement>     link = (do_QueryInterface(domSaveArray[j].node));
      nsCOMPtr<nsIDOMHTMLAnchorElement>   anchor = (do_QueryInterface(domSaveArray[j].node));

      if (anchor)
      {
        anchor->GetHref(domURL);
        anchor->SetHref(newSpec);
      }
      else if (link)
      {
        link->GetHref(domURL);
        link->SetHref(newSpec);
      }
      else if (image)
      {
        image->GetSrc(domURL);
        image->SetSrc(newSpec);
      }
      else if (body)
      {
        body->GetBackground(domURL);
        body->SetBackground(newSpec);
      }

      if (!domURL.IsEmpty())
        domSaveArray[j].url = ToNewCString(NS_LossyConvertUTF16toASCII(domURL));
    }
    i++;
  }

  rv = GetBodyFromEditor();

  //
  // Ok, now we need to un-whack the DOM or we have a screwed up document on
  // Send failure.
  //
  for (i = 0; i < multipartCount; i++)
  {
    if ( (!domSaveArray[i].node) || (!domSaveArray[i].url) )
      continue;

    // Now, we know the types of objects this node can be, so we will do
    // our query interface here and see what we come up with
    nsCOMPtr<nsIDOMHTMLBodyElement>     body = (do_QueryInterface(domSaveArray[i].node));
    nsCOMPtr<nsIDOMHTMLImageElement>    image = (do_QueryInterface(domSaveArray[i].node));
    nsCOMPtr<nsIDOMHTMLLinkElement>     link = (do_QueryInterface(domSaveArray[i].node));
    nsCOMPtr<nsIDOMHTMLAnchorElement>   anchor = (do_QueryInterface(domSaveArray[i].node));

      // STRING USE WARNING: hoisting the following conversion might save code-space, since it happens along every path

    if (anchor)
      anchor->SetHref(NS_ConvertASCIItoUTF16(domSaveArray[i].url));
    else if (link)
      link->SetHref(NS_ConvertASCIItoUTF16(domSaveArray[i].url));
    else if (image)
      image->SetSrc(NS_ConvertASCIItoUTF16(domSaveArray[i].url));
    else if (body)
      body->SetBackground(NS_ConvertASCIItoUTF16(domSaveArray[i].url));

    nsMemory::Free(domSaveArray[i].url);
  }

  PR_FREEIF(domSaveArray);

  //
  // Now, we have to create that first child node for the multipart
  // message that holds the body as well as the attachment handler
  // for this body part.
  //
  // If we ONLY have multipart objects, then we don't need the container
  // for the multipart section...
  //
  m_related_part = new nsMsgSendPart(this);
  if (!m_related_part)
    return NS_ERROR_OUT_OF_MEMORY;

  m_related_part->SetMimeDeliveryState(this);
  m_related_part->SetType(MULTIPART_RELATED);
  // We are now going to use the m_related_part as a way to store the
  // MHTML message for this email.
  //
  m_related_body_part = new nsMsgSendPart(this);
  if (!m_related_body_part)
    return NS_ERROR_OUT_OF_MEMORY;

  // Set the body contents...
  m_related_body_part->SetBuffer(m_attachment1_body);
  m_related_body_part->SetType(m_attachment1_type);

  m_related_part->AddChild(m_related_body_part);

  return rv;
}

nsresult
nsMsgComposeAndSend::CountCompFieldAttachments()
{
  //Reset the counters
  mCompFieldLocalAttachments = 0;
  mCompFieldRemoteAttachments = 0;

  //Get the attachments array
  nsCOMPtr<nsISimpleEnumerator> attachments;
  mCompFields->GetAttachments(getter_AddRefs(attachments));
  if (!attachments)
    return NS_OK;

  nsresult rv;

  // Parse the attachments array
  bool moreAttachments;
  nsCString url;
  nsCOMPtr<nsISupports> element;
  while (NS_SUCCEEDED(attachments->HasMoreElements(&moreAttachments)) && moreAttachments) {
    rv = attachments->GetNext(getter_AddRefs(element));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgAttachment> attachment = do_QueryInterface(element, &rv);
    if (NS_SUCCEEDED(rv) && attachment)
    {
      attachment->GetUrl(url);
      if (!url.IsEmpty())
      {
        // Check to see if this is a file URL, if so, don't retrieve
        // like a remote URL...
        if (nsMsgIsLocalFile(url.get()))
          mCompFieldLocalAttachments++;
        else    // This is a remote URL...
          mCompFieldRemoteAttachments++;
      }
    }
  }

  return NS_OK;
}

//
// Since we are at the head of the list, we start from ZERO.
//
nsresult
nsMsgComposeAndSend::AddCompFieldLocalAttachments()
{
  // If none, just return...
  if (mCompFieldLocalAttachments <= 0)
    return NS_OK;

  //Get the attachments array
  nsCOMPtr<nsISimpleEnumerator> attachments;
  mCompFields->GetAttachments(getter_AddRefs(attachments));
  if (!attachments)
    return NS_OK;

  uint32_t  newLoc = 0;
  nsresult rv;
  nsCString url;

  //Parse the attachments array
  bool moreAttachments;
  nsCOMPtr<nsISupports> element;
  while (NS_SUCCEEDED(attachments->HasMoreElements(&moreAttachments)) && moreAttachments) {
    rv = attachments->GetNext(getter_AddRefs(element));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgAttachment> attachment = do_QueryInterface(element, &rv);
    if (NS_SUCCEEDED(rv) && attachment)
    {
      bool sendViaCloud = false;
      attachment->GetSendViaCloud(&sendViaCloud);
      m_attachments[newLoc]->mSendViaCloud = sendViaCloud;
      attachment->GetUrl(url);
      if (!url.IsEmpty())
      {
        bool sendViaCloud;
        attachment->GetSendViaCloud(&sendViaCloud);
        if (sendViaCloud)
        {
          nsCString cloudProviderKey;
          // We'd like to output a part for the attachment, just an html part
          // with information about how to download the attachment.
          // m_attachments[newLoc]->m_done = true;
          attachment->GetHtmlAnnotation(m_attachments[newLoc]->mHtmlAnnotation);
          m_attachments[newLoc]->m_type.AssignLiteral("text/html");
          attachment->GetCloudProviderKey(m_attachments[newLoc]->mCloudProviderKey);
          attachment->GetContentLocation(m_attachments[newLoc]->mCloudUrl);
        }
        // Just look for local file:// attachments and do the right thing.
        if (nsMsgIsLocalFile(url.get()))
        {
          //
          // Now we have to setup the m_attachments entry for the file://
          // URL that is passed in...
          //
          m_attachments[newLoc]->mDeleteFile = false;

          nsMsgNewURL(getter_AddRefs(m_attachments[newLoc]->mURL), url.get());

          if (m_attachments[newLoc]->mTmpFile)
          {
            if (m_attachments[newLoc]->mDeleteFile)
              m_attachments[newLoc]->mTmpFile->Remove(false);
            m_attachments[newLoc]->mTmpFile =nullptr;
          }
          nsresult rv;
          nsCOMPtr<nsIIOService> ioService =
            mozilla::services::GetIOService();
          NS_ENSURE_TRUE(ioService, NS_ERROR_UNEXPECTED);
          nsCOMPtr <nsIURI> uri;
          rv = ioService->NewURI(url, nullptr, nullptr, getter_AddRefs(uri));
          NS_ENSURE_SUCCESS(rv, rv);
          nsCOMPtr <nsIFileURL> fileURL = do_QueryInterface(uri);
          NS_ENSURE_SUCCESS(rv, rv);
          nsCOMPtr <nsIFile> fileURLFile;
          fileURL->GetFile(getter_AddRefs(fileURLFile));
          m_attachments[newLoc]->mTmpFile = do_QueryInterface(fileURLFile);
          m_attachments[newLoc]->mDeleteFile = false;
          if (m_attachments[newLoc]->mURL)
          {
            nsAutoString proposedName;
            attachment->GetName(proposedName);
            msg_pick_real_name(m_attachments[newLoc], proposedName.get(), mCompFields->GetCharacterSet());
          }

          // Now, most importantly, we need to figure out what the content type is for
          // this attachment...If we can't, then just make it application/octet-stream

  #ifdef MAC_OSX
          //Mac always need to snarf the file to figure out how to send it, maybe we need to use apple double...
          //  unless caller has already set the content type, in which case, trust them.
          bool mustSnarfAttachment = true;
  #else
          bool mustSnarfAttachment = false;
  #endif
          if (sendViaCloud)
            mustSnarfAttachment = false;

          attachment->GetContentType(getter_Copies(m_attachments[newLoc]->m_type));
          if (m_attachments[newLoc]->m_type.IsEmpty())
          {
            nsresult  rv = NS_OK;
            nsCOMPtr<nsIMIMEService> mimeFinder (do_GetService(NS_MIMESERVICE_CONTRACTID, &rv));
            if (NS_SUCCEEDED(rv) && mimeFinder)
            {
              nsCOMPtr<nsIURL> fileUrl(do_CreateInstance(NS_STANDARDURL_CONTRACTID));
              if (fileUrl)
              {
                nsAutoCString fileExt;
                //First try using the real file name
                rv = fileUrl->SetFileName(m_attachments[newLoc]->m_realName);
                if (NS_SUCCEEDED(rv))
                {
                  rv = fileUrl->GetFileExtension(fileExt);
                  if (NS_SUCCEEDED(rv) && !fileExt.IsEmpty()) {
                    nsAutoCString type;
                    mimeFinder->GetTypeFromExtension(fileExt, type);
  #ifndef XP_MACOSX
                    if (!type.Equals("multipart/appledouble"))  // can't do apple double on non-macs
  #endif
                    m_attachments[newLoc]->m_type = type;
                  }
                }

                //Then try using the url if we still haven't figured out the content type
                if (m_attachments[newLoc]->m_type.IsEmpty())
                {
                  rv = fileUrl->SetSpec(url);
                  if (NS_SUCCEEDED(rv))
                  {
                    rv = fileUrl->GetFileExtension(fileExt);
                    if (NS_SUCCEEDED(rv) && !fileExt.IsEmpty()) {
                      nsAutoCString type;
                      mimeFinder->GetTypeFromExtension(fileExt, type);
  #ifndef XP_MACOSX
                    if (!type.Equals("multipart/appledouble"))  // can't do apple double on non-macs
  #endif
                      m_attachments[newLoc]->m_type = type;
                    // rtf and vcs files may look like text to sniffers,
                    // but they're not human readable.
                    if (type.IsEmpty() && !fileExt.IsEmpty() &&
                         (MsgLowerCaseEqualsLiteral(fileExt, "rtf") ||
                          MsgLowerCaseEqualsLiteral(fileExt, "vcs")))
                      m_attachments[newLoc]->m_type = APPLICATION_OCTET_STREAM;
                    }
                  }
                }
              }
            }
          }
          else
          {
            attachment->GetContentTypeParam(getter_Copies(m_attachments[newLoc]->m_typeParam));
            mustSnarfAttachment = false;
          }

          //We need to snarf the file to figure out how to send it only if we don't have a content type...
          if (mustSnarfAttachment || m_attachments[newLoc]->m_type.IsEmpty())
          {
            m_attachments[newLoc]->m_done = false;
            m_attachments[newLoc]->SetMimeDeliveryState(this);
          }
          else
          {
            m_attachments[newLoc]->m_done = true;
            m_attachments[newLoc]->SetMimeDeliveryState(nullptr);
          }
          // For local files, if they are HTML docs and we don't have a charset, we should
          // sniff the file and see if we can figure it out.
          if (!m_attachments[newLoc]->m_type.IsEmpty())
          {
            if (m_attachments[newLoc]->m_type.LowerCaseEqualsLiteral(TEXT_HTML))
            {
              char *tmpCharset = (char *)nsMsgI18NParseMetaCharset(m_attachments[newLoc]->mTmpFile);
              if (tmpCharset[0] != '\0')
                m_attachments[newLoc]->m_charset = tmpCharset;
            }
          }

          attachment->GetMacType(getter_Copies(m_attachments[newLoc]->m_xMacType));
          attachment->GetMacCreator(getter_Copies(m_attachments[newLoc]->m_xMacCreator));

          ++newLoc;
        }
      }
    }
  }
  return NS_OK;
}

nsresult
nsMsgComposeAndSend::AddCompFieldRemoteAttachments(uint32_t   aStartLocation,
                                                   int32_t    *aMailboxCount,
                                                   int32_t    *aNewsCount)
{
  // If none, just return...
  if (mCompFieldRemoteAttachments <= 0)
    return NS_OK;

  //Get the attachments array
  nsCOMPtr<nsISimpleEnumerator> attachments;
  mCompFields->GetAttachments(getter_AddRefs(attachments));
  if (!attachments)
    return NS_OK;

  uint32_t  newLoc = aStartLocation;

  nsresult rv;
  bool moreAttachments;
  nsCString url;
  nsCOMPtr<nsISupports> element;
  while (NS_SUCCEEDED(attachments->HasMoreElements(&moreAttachments)) && moreAttachments) {
    rv = attachments->GetNext(getter_AddRefs(element));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgAttachment> attachment = do_QueryInterface(element, &rv);
     if (NS_SUCCEEDED(rv) && attachment)
    {
      attachment->GetUrl(url);
      if (!url.IsEmpty())
      {
        // Just look for files that are NOT local file attachments and do
        // the right thing.
        if (! nsMsgIsLocalFile(url.get()))
        {
          bool isAMessageAttachment = !PL_strncasecmp(url.get(), "mailbox-message://", 18) ||
              !PL_strncasecmp(url.get(), "imap-message://", 15) ||
              !PL_strncasecmp(url.get(), "news-message://", 15);

          m_attachments[newLoc]->mDeleteFile = true;
          m_attachments[newLoc]->m_done = false;
          m_attachments[newLoc]->SetMimeDeliveryState(this);

          if (!isAMessageAttachment)
            nsMsgNewURL(getter_AddRefs(m_attachments[newLoc]->mURL), url.get());

          m_attachments[newLoc]->m_encoding = ENCODING_7BIT;

          attachment->GetMacType(getter_Copies(m_attachments[newLoc]->m_xMacType));
          attachment->GetMacCreator(getter_Copies(m_attachments[newLoc]->m_xMacCreator));

          /* Count up attachments which are going to come from mail folders
             and from NNTP servers. */
          bool do_add_attachment = false;
          if (isAMessageAttachment)
          {
            do_add_attachment = true;
            if (!PL_strncasecmp(url.get(), "news-message://", 15))
              (*aNewsCount)++;
            else
              (*aMailboxCount)++;

            m_attachments[newLoc]->m_uri = url;
            m_attachments[newLoc]->mURL = nullptr;
          }
          else
            do_add_attachment = (nullptr != m_attachments[newLoc]->mURL);
          m_attachments[newLoc]->mSendViaCloud = false;
          if (do_add_attachment)
          {
            nsAutoString proposedName;
            attachment->GetName(proposedName);
            msg_pick_real_name(m_attachments[newLoc], proposedName.get(), mCompFields->GetCharacterSet());
            ++newLoc;
          }
        }
      }
    }
  }
  return NS_OK;
}

nsresult
nsMsgComposeAndSend::HackAttachments(nsIArray *attachments,
                                     nsIArray *preloadedAttachments)
{
  //
  // First, count the total number of attachments we are going to process
  // for this operation! This is a little more complicated than you might
  // think because we have a few ways to specify attachments. Via the nsMsgAttachmentData
  // as well as the composition fields.
  //
  CountCompFieldAttachments();

  // Count the preloaded attachments!
  mPreloadedAttachmentCount = 0;

  // For now, manually add the local attachments in the comp field!
  mPreloadedAttachmentCount += mCompFieldLocalAttachments;
  uint32_t numAttachments = 0, numPreloadedAttachments = 0;
  if (attachments)
    attachments->GetLength(&numAttachments);
  if (preloadedAttachments)
    preloadedAttachments->GetLength(&numPreloadedAttachments);
  mPreloadedAttachmentCount += numPreloadedAttachments;

  // Count the attachments we have to go retrieve! Keep in mind, that these
  // will be APPENDED to the current list of URL's that we have gathered if
  // this is a multpart/related send operation
  mRemoteAttachmentCount = GetMultipartRelatedCount();

  // For now, manually add the remote attachments in the comp field!
  mRemoteAttachmentCount += mCompFieldRemoteAttachments;

  int32_t tCount = 0;
  mRemoteAttachmentCount += numAttachments;
  tCount += numAttachments;

  m_attachment_count = mPreloadedAttachmentCount + mRemoteAttachmentCount;

  // Now create the array of attachment handlers...
  for (int i = 0; i < m_attachment_count; i++) {
    nsRefPtr<nsMsgAttachmentHandler> handler = new nsMsgAttachmentHandler;
    m_attachments.AppendElement(handler);
  }

  // clear this new memory...
  uint32_t     i;    // counter for location in attachment array...

  //
  // First, we need to attach the files that are defined in the comp fields...
  if (NS_FAILED(AddCompFieldLocalAttachments()))
    return NS_ERROR_INVALID_ARG;

  // Now handle the preloaded attachments...
  if (numPreloadedAttachments > 0)
  {
    // These are attachments which have already been downloaded to tmp files.
    // We merely need to point the internal attachment data at those tmp
    // files.
    m_pre_snarfed_attachments_p = true;

    for (i = mCompFieldLocalAttachments; i < mPreloadedAttachmentCount; i++)
    {
      nsCOMPtr<nsIMsgAttachedFile> attachedFile = do_QueryElementAt(preloadedAttachments, i);
      if (!attachedFile)
        continue;

      /* These attachments are already "snarfed". */
      m_attachments[i]->mDeleteFile = false;
      m_attachments[i]->SetMimeDeliveryState(nullptr);
      m_attachments[i]->m_done = true;

      attachedFile->GetOrigUrl(getter_AddRefs(m_attachments[i]->mURL));

      attachedFile->GetType(m_attachments[i]->m_type);

      // Set it to the compose fields for a default...
      m_attachments[i]->m_charset = mCompFields->GetCharacterSet();

      // If we still don't have a content type, we should really try sniff one out!
      if (m_attachments[i]->m_type.IsEmpty())
        m_attachments[i]->PickEncoding(mCompFields->GetCharacterSet(), this);

      // For local files, if they are HTML docs and we don't have a charset, we should
      // sniff the file and see if we can figure it out.
      if (!m_attachments[i]->m_type.IsEmpty())
      {
        nsCOMPtr<nsIFile> tmpFile;
        attachedFile->GetTmpFile(getter_AddRefs(tmpFile));
        if (m_attachments[i]->m_type.LowerCaseEqualsLiteral(TEXT_HTML) && tmpFile)
        {
          char *tmpCharset = (char *)nsMsgI18NParseMetaCharset(tmpFile);
          if (tmpCharset[0] != '\0')
            m_attachments[i]->m_charset = tmpCharset;
        }
      }

      attachedFile->GetDescription(m_attachments[i]->m_description);
      attachedFile->GetRealName(m_attachments[i]->m_realName);
      attachedFile->GetXMacType(m_attachments[i]->m_xMacType);
      attachedFile->GetXMacCreator(m_attachments[i]->m_xMacCreator);
      attachedFile->GetEncoding(m_attachments[i]->m_encoding);

      if (m_attachments[i]->mTmpFile)
      {
        if (m_attachments[i]->mDeleteFile)
          m_attachments[i]->mTmpFile->Remove(false);
        m_attachments[i]->mTmpFile = nullptr;
      }
      attachedFile->GetTmpFile(getter_AddRefs(m_attachments[i]->mTmpFile));

      attachedFile->GetSize(&m_attachments[i]->m_size);
      attachedFile->GetUnprintableCount(&m_attachments[i]->m_unprintable_count);
      attachedFile->GetHighbitCount(&m_attachments[i]->m_highbit_count);
      attachedFile->GetCtlCount(&m_attachments[i]->m_ctl_count);
      attachedFile->GetNullCount(&m_attachments[i]->m_null_count);
      attachedFile->GetMaxLineLength(&m_attachments[i]->m_max_column);

      /* If the attachment has an encoding, and it's not one of
      the "null" encodings, then keep it. */
      if (!m_attachments[i]->m_encoding.IsEmpty() &&
          !m_attachments[i]->m_encoding.LowerCaseEqualsLiteral(ENCODING_7BIT) &&
          !m_attachments[i]->m_encoding.LowerCaseEqualsLiteral(ENCODING_8BIT) &&
          !m_attachments[i]->m_encoding.LowerCaseEqualsLiteral(ENCODING_BINARY))
        m_attachments[i]->m_already_encoded_p = true;

            if (m_attachments[i]->mURL)
        msg_pick_real_name(m_attachments[i], nullptr, mCompFields->GetCharacterSet());
    }
  }

  // First, handle the multipart related attachments if any...
  //
  int32_t mailbox_count = 0, news_count = 0;
  int32_t multipartRelatedCount = GetMultipartRelatedCount();

  if (multipartRelatedCount > 0)
  {
    nsresult rv = ProcessMultipartRelated(&mailbox_count, &news_count);
    if (NS_FAILED(rv))
    {
      // The destructor will take care of the m_attachment array
      return rv;
    }
  }

  //
  // Now add the comp field remote attachments...
  //
  if (NS_FAILED( AddCompFieldRemoteAttachments( (mPreloadedAttachmentCount + multipartRelatedCount),
                                                 &mailbox_count, &news_count) ))
    return NS_ERROR_INVALID_ARG;

  //
  // Now deal remote attachments and attach multipart/related attachments (url's and such..)
  // first!
  //
  if (attachments)
  {
    int32_t     locCount = -1;

    for (i = (mPreloadedAttachmentCount + GetMultipartRelatedCount() + mCompFieldRemoteAttachments); i < m_attachment_count; i++)
    {
      locCount++;
      nsCOMPtr<nsIMsgAttachmentData> attachment(do_QueryElementAt(attachments, i));
      if (!attachment)
        continue;
      m_attachments[i]->mDeleteFile = true;
      m_attachments[i]->m_done = false;
      m_attachments[i]->SetMimeDeliveryState(this);

      attachment->GetUrl(getter_AddRefs(m_attachments[i]->mURL));

      attachment->GetRealType(m_attachments[i]->m_overrideType);
      m_attachments[i]->m_charset = mCompFields->GetCharacterSet();
      attachment->GetRealEncoding(m_attachments[i]->m_overrideEncoding);
      attachment->GetDesiredType(m_attachments[i]->m_desiredType);
      attachment->GetDescription(m_attachments[i]->m_description);
      attachment->GetRealName(m_attachments[i]->m_realName);
      attachment->GetXMacType(m_attachments[i]->m_xMacType);
      attachment->GetXMacCreator(m_attachments[i]->m_xMacCreator);
      m_attachments[i]->m_encoding = ENCODING_7BIT;

      // real name is set in the case of vcard so don't change it.  XXX STILL NEEDED?
      // m_attachments[i]->m_real_name = 0;

      /* Count up attachments which are going to come from mail folders
      and from NNTP servers. */
    if (m_attachments[i]->mURL)
    {
    nsIURI *uri = m_attachments[i]->mURL;
    bool match = false;
    if ((NS_SUCCEEDED(uri->SchemeIs("mailbox", &match)) && match) ||
      (NS_SUCCEEDED(uri->SchemeIs("imap", &match)) && match))
      mailbox_count++;
    else if ((NS_SUCCEEDED(uri->SchemeIs("news", &match)) && match) ||
           (NS_SUCCEEDED(uri->SchemeIs("snews", &match)) && match))
        news_count++;

      if (uri)
        msg_pick_real_name(m_attachments[i], nullptr, mCompFields->GetCharacterSet());
      }
    }
  }

  bool needToCallGatherMimeAttachments = true;

  if (m_attachment_count > 0)
  {
    // If there is more than one mailbox URL, or more than one NNTP url,
    // do the load in serial rather than parallel, for efficiency.
    if (mailbox_count > 1 || news_count > 1)
      m_be_synchronous_p = true;

    m_attachment_pending_count = m_attachment_count;

    // Start the URL attachments loading (eventually, an exit routine will
    // call the done_callback).

    for (i = 0; i < m_attachment_count; i++)
    {
      if (m_attachments[i]->m_done || m_attachments[i]->mSendViaCloud)
      {
        m_attachment_pending_count--;
        continue;
      }

      //
      //  IF we get here and the URL is NULL, just dec the pending count and move on!!!
      //
      if ( (!m_attachments[i]->mURL) && (!m_attachments[i]->m_uri.Length()) )
      {
        m_attachments[i]->m_bogus_attachment = true;
        m_attachments[i]->m_done = true;
        m_attachments[i]->SetMimeDeliveryState(nullptr);
        m_attachment_pending_count--;
        continue;
      }

      //
      // This only returns a failure code if NET_GetURL was not called
      // (and thus no exit routine was or will be called.)
      //

      // Display some feedback to user...
      PRUnichar     *printfString = nullptr;
      nsString msg;
      mComposeBundle->GetStringFromID(NS_MSG_GATHERING_ATTACHMENT, getter_Copies(msg));

      printfString = nsTextFormatter::smprintf(msg.get(), m_attachments[i]->m_realName.get());

      if (printfString)
      {
        SetStatusMessage(nsDependentString(printfString));
        PR_Free(printfString);
      }

      /* As SnarfAttachment will call GatherMimeAttachments when it will be done (this is an async process),
         we need to avoid to call it ourself.
      */
      needToCallGatherMimeAttachments = false;

      nsresult status = m_attachments[i]->SnarfAttachment(mCompFields);
      if (NS_FAILED(status))
      {
        nsString errorMsg;
        nsAutoString attachmentFileName;
        nsresult rv = ConvertToUnicode(nsMsgI18NFileSystemCharset(), m_attachments[i]->m_realName, attachmentFileName);
        if (NS_SUCCEEDED(rv))
        {
          nsCOMPtr<nsIStringBundle> bundle;
          const PRUnichar *params[] = { attachmentFileName.get() };
          mComposeBundle->FormatStringFromID(NS_ERROR_GET_CODE(NS_MSG_ERROR_ATTACHING_FILE), params, 1, getter_Copies(errorMsg));
          mSendReport->SetMessage(nsIMsgSendReport::process_Current, errorMsg.get(), false);
          mSendReport->SetError(nsIMsgSendReport::process_Current,
              // XXX The following applies NS_ERROR_GENERATE_FAILURE twice,
              // which doesn't make sense.  Just NS_MSG_ERROR_ATTACHING_FILE is
              // surely what was intended.
              NS_ERROR_GENERATE_FAILURE(
                NS_ERROR_MODULE_MAILNEWS,
                static_cast<uint32_t>(NS_MSG_ERROR_ATTACHING_FILE)),
              false);
        }
        return NS_MSG_ERROR_ATTACHING_FILE;
      }
      if (m_be_synchronous_p)
        break;
    }
  }

  // If no attachments - finish now (this will call the done_callback).
  if (needToCallGatherMimeAttachments)
    return GatherMimeAttachments();

  return NS_OK;
}

nsresult nsMsgComposeAndSend::SetMimeHeader(nsMsgCompFields::MsgHeaderID header, const char *value)
{
  char * dupHeader = nullptr;
  nsresult ret = NS_ERROR_OUT_OF_MEMORY;

  switch (header)
  {
    case nsMsgCompFields::MSG_FROM_HEADER_ID :
    case nsMsgCompFields::MSG_TO_HEADER_ID :
    case nsMsgCompFields::MSG_REPLY_TO_HEADER_ID :
    case nsMsgCompFields::MSG_CC_HEADER_ID :
    case nsMsgCompFields::MSG_BCC_HEADER_ID :
      dupHeader = mime_fix_addr_header(value);
      break;

    case nsMsgCompFields::MSG_NEWSGROUPS_HEADER_ID :
    case nsMsgCompFields::MSG_FOLLOWUP_TO_HEADER_ID :
      dupHeader = mime_fix_news_header(value);
      break;

    case nsMsgCompFields::MSG_FCC_HEADER_ID :
    case nsMsgCompFields::MSG_ORGANIZATION_HEADER_ID :
    case nsMsgCompFields::MSG_SUBJECT_HEADER_ID :
    case nsMsgCompFields::MSG_REFERENCES_HEADER_ID :
    case nsMsgCompFields::MSG_X_TEMPLATE_HEADER_ID :
      dupHeader = mime_fix_header(value);
      break;

    default : NS_ASSERTION(false, "invalid header"); // unhandled header - bad boy.
  }

  if (dupHeader)
  {
    ret = mCompFields->SetAsciiHeader(header, dupHeader);
    PR_Free(dupHeader);
  }
  return ret;
}

nsresult
nsMsgComposeAndSend::InitCompositionFields(nsMsgCompFields *fields,
                                           const nsACString &aOriginalMsgURI,
                                           MSG_ComposeType aType)
{
  nsresult        rv = NS_OK;
  const char      *pStr = nullptr;

  mCompFields = new nsMsgCompFields();
  if (!mCompFields)
    return NS_ERROR_OUT_OF_MEMORY;

  const char *cset = fields->GetCharacterSet();
  // Make sure charset is sane...
  if (!cset || !*cset)
  {
    mCompFields->SetCharacterSet("us-ascii");
  }
  else
  {
    mCompFields->SetCharacterSet(fields->GetCharacterSet());
  }

  pStr = fields->GetMessageId();
  if (pStr)
  {
    mCompFields->SetMessageId((char *) pStr);
    /* Don't bother checking for out of memory; if it fails, then we'll just
       let the server generate the message-id, and suffer with the
       possibility of duplicate messages.*/
  }

  pStr = fields->GetNewspostUrl();
  if (pStr && *pStr)
  {
    mCompFields->SetNewspostUrl((char *)pStr);
  }

  // Now, we will look for a URI defined as the default FCC pref. If this is set,
  // then SetFcc will use this value. The FCC field is a URI for the server that
  // will hold the "Sent" folder...the
  //
  // First, look at what was passed in via the "fields" structure...if that was
  // set then use it, otherwise, fall back to what is set in the prefs...
  //
  // But even before that, pay attention to the new OVERRIDE pref that will cancel
  // any and all copy operations!
  //
  bool      doFcc = true;
  rv = mUserIdentity->GetDoFcc(&doFcc);
  if (!doFcc)
  {
    // If the identity pref "fcc" is set to false, then we will not do
    // any FCC operation!
    mCompFields->SetFcc("");
  }
  else
  {
    bool useDefaultFCC = true;
    const char *fieldsFCC = fields->GetFcc();
    if (fieldsFCC && *fieldsFCC)
    {
      if (PL_strcasecmp(fieldsFCC, "nocopy://") == 0)
      {
        useDefaultFCC = false;
        mCompFields->SetFcc("");
      }
      else
      {
        nsCOMPtr<nsIMsgFolder> folder;
        GetExistingFolder(nsDependentCString(fieldsFCC), getter_AddRefs(folder));
        if (folder)
        {
          useDefaultFCC = false;
          SetMimeHeader(nsMsgCompFields::MSG_FCC_HEADER_ID, fieldsFCC);
        }
      }
    }

    // We use default FCC setting if it's not set or was set to an invalid folder.
    if (useDefaultFCC)
    {
      // Only check whether the user wants the message in the original message
      // folder if the msgcomptype is some kind of a reply.
      if (!aOriginalMsgURI.IsEmpty() && (
            aType == nsIMsgCompType::Reply ||
            aType == nsIMsgCompType::ReplyAll ||
            aType == nsIMsgCompType::ReplyToGroup ||
            aType == nsIMsgCompType::ReplyToSender ||
            aType == nsIMsgCompType::ReplyToSenderAndGroup ||
            aType == nsIMsgCompType::ReplyWithTemplate )
         )
      {
        nsCOMPtr <nsIMsgAccountManager> accountManager =
            do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
        if (NS_SUCCEEDED(rv))
        {
          nsCOMPtr <nsIMsgDBHdr> msgHdr;
          rv = GetMsgDBHdrFromURI(PromiseFlatCString(aOriginalMsgURI).get(),
                                  getter_AddRefs(msgHdr));
          if (NS_SUCCEEDED(rv))
          {
            nsCOMPtr <nsIMsgFolder> folder;
            msgHdr->GetFolder(getter_AddRefs(folder));
            if (NS_SUCCEEDED(rv))
            {
              bool canFileMessages;
              rv = folder->GetCanFileMessages(&canFileMessages);
              if (NS_SUCCEEDED(rv) && canFileMessages)
              {
                nsCOMPtr <nsIMsgIncomingServer> incomingServer;
                rv = folder->GetServer(getter_AddRefs(incomingServer));
                if (NS_SUCCEEDED(rv))
                {
                  nsCString incomingServerType;
                  rv = incomingServer->GetCharValue("type", incomingServerType);
                  // Exclude RSS accounts, as they falsely report
                  // 'canFileMessages' = true
                  if (NS_SUCCEEDED(rv) && !incomingServerType.Equals("rss"))
                  {
                    bool fccReplyFollowsParent;
                    rv = mUserIdentity->GetFccReplyFollowsParent(
                             &fccReplyFollowsParent);
                    if (NS_SUCCEEDED(rv) && fccReplyFollowsParent)
                    {
                      nsCString folderURI;
                      rv = folder->GetURI(folderURI);
                      if (NS_SUCCEEDED(rv))
                      {
                        mCompFields->SetFcc(folderURI.get());
                        useDefaultFCC = false;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (useDefaultFCC)
      {
        nsCString uri;
        GetFolderURIFromUserPrefs(nsMsgDeliverNow, mUserIdentity, uri);
        mCompFields->SetFcc(MsgLowerCaseEqualsLiteral(uri, "nocopy://") ? "" : uri.get());
      }
    }
  }

  //
  // Deal with an additional FCC operation for this email.
  //
  const char *fieldsFCC2 = fields->GetFcc2();
  if ( (fieldsFCC2) && (*fieldsFCC2) )
  {
    if (PL_strcasecmp(fieldsFCC2, "nocopy://") == 0)
    {
      mCompFields->SetFcc2("");
      mNeedToPerformSecondFCC = false;
    }
    else
    {
      mCompFields->SetFcc2(fieldsFCC2);
      mNeedToPerformSecondFCC = true;
    }
  }

  mCompFields->SetNewspostUrl((char *) fields->GetNewspostUrl());

  /* strip whitespace from and duplicate header fields. */
  SetMimeHeader(nsMsgCompFields::MSG_FROM_HEADER_ID, fields->GetFrom());
  SetMimeHeader(nsMsgCompFields::MSG_REPLY_TO_HEADER_ID, fields->GetReplyTo());
  SetMimeHeader(nsMsgCompFields::MSG_TO_HEADER_ID, fields->GetTo());
  SetMimeHeader(nsMsgCompFields::MSG_CC_HEADER_ID, fields->GetCc());
  SetMimeHeader(nsMsgCompFields::MSG_BCC_HEADER_ID, fields->GetBcc());
  SetMimeHeader(nsMsgCompFields::MSG_NEWSGROUPS_HEADER_ID, fields->GetNewsgroups());
  SetMimeHeader(nsMsgCompFields::MSG_FOLLOWUP_TO_HEADER_ID, fields->GetFollowupTo());
  SetMimeHeader(nsMsgCompFields::MSG_ORGANIZATION_HEADER_ID, fields->GetOrganization());
  SetMimeHeader(nsMsgCompFields::MSG_SUBJECT_HEADER_ID, fields->GetSubject());
  SetMimeHeader(nsMsgCompFields::MSG_REFERENCES_HEADER_ID, fields->GetReferences());
  SetMimeHeader(nsMsgCompFields::MSG_X_TEMPLATE_HEADER_ID, fields->GetTemplateName());

  nsCOMPtr<nsISimpleEnumerator> srcAttachments;
  fields->GetAttachments(getter_AddRefs(srcAttachments));
  if (srcAttachments)
  {
    bool moreAttachments;
    nsCOMPtr<nsISupports> element;
    while (NS_SUCCEEDED(srcAttachments->HasMoreElements(&moreAttachments)) && moreAttachments) {
      rv = srcAttachments->GetNext(getter_AddRefs(element));
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIMsgAttachment> attachment = do_QueryInterface(element, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      mCompFields->AddAttachment(attachment);
    }
  }

  pStr = fields->GetOtherRandomHeaders();
  if (pStr)
    mCompFields->SetOtherRandomHeaders((char *) pStr);

  AddDefaultCustomHeaders();

  AddMailFollowupToHeader();
  AddMailReplyToHeader();

  if (aType == nsIMsgCompType::ForwardInline ||
      aType == nsIMsgCompType::ForwardAsAttachment)
    AddXForwardedMessageIdHeader();

  pStr = fields->GetPriority();
  if (pStr)
    mCompFields->SetPriority((char *) pStr);

  mCompFields->SetAttachVCard(fields->GetAttachVCard());
  mCompFields->SetForcePlainText(fields->GetForcePlainText());
  mCompFields->SetUseMultipartAlternative(fields->GetUseMultipartAlternative());
  int32_t receiptType = nsIMsgMdnGenerator::eDntType;
  fields->GetReceiptHeaderType(&receiptType);

  mCompFields->SetReturnReceipt(fields->GetReturnReceipt());
  mCompFields->SetReceiptHeaderType(receiptType);

  mCompFields->SetDSN(fields->GetDSN());

  mCompFields->SetBodyIsAsciiOnly(fields->GetBodyIsAsciiOnly());
  mCompFields->SetForceMsgEncoding(fields->GetForceMsgEncoding());

  nsCOMPtr<nsISupports> secInfo;
  fields->GetSecurityInfo(getter_AddRefs(secInfo));

  mCompFields->SetSecurityInfo(secInfo);

  bool needToCheckCharset;
  fields->GetNeedToCheckCharset(&needToCheckCharset);
  mCompFields->SetNeedToCheckCharset(needToCheckCharset);

  if ( m_deliver_mode != nsMsgSaveAsDraft && m_deliver_mode != nsMsgSaveAsTemplate )
  {
    // Check the fields for legitimacy...
    return mime_sanity_check_fields (
                    mCompFields->GetFrom(), mCompFields->GetReplyTo(),
                    mCompFields->GetTo(), mCompFields->GetCc(),
                    mCompFields->GetBcc(), mCompFields->GetFcc(),
                    mCompFields->GetNewsgroups(), mCompFields->GetFollowupTo(),
                    mCompFields->GetSubject(), mCompFields->GetReferences(),
                    mCompFields->GetOrganization(),
                    mCompFields->GetOtherRandomHeaders());
  }
  return NS_OK;
}

// Add default headers to outgoing messages see Bug #61520
// mail.identity.<id#>.headers pref is a comma separated value of pref names
// containging headers to add headers are stored in
// mail.identity.<id#>.header.<header name> grab all the headers, mime encode
// them and add them to the other custom headers.
nsresult
nsMsgComposeAndSend::AddDefaultCustomHeaders() {
  nsCString headersList;
  // get names of prefs containing headers to add
  nsresult rv = mUserIdentity->GetCharAttribute("headers", headersList);
  if (NS_SUCCEEDED(rv) && !headersList.IsEmpty()) {
    int32_t start = 0;
    int32_t end = 0;
    int32_t len = 0;
    // preserve any custom headers that have been added through the UI
    nsAutoCString newHeaderVal(mCompFields->GetOtherRandomHeaders());

    while (end != -1) {
      end = headersList.FindChar(',', start);
      if (end == -1) {
        len = headersList.Length() - start;
      } else {
        len = end - start;
      }
      // grab the name of the current header pref
      nsAutoCString headerName("header.");
      headerName.Append(Substring(headersList, start, len));
      start = end + 1;

      nsCString headerVal;
      rv = mUserIdentity->GetCharAttribute(headerName.get(), headerVal);
      if (NS_SUCCEEDED(rv)) {
        int32_t colonIdx = headerVal.FindChar(':') + 1;
        if (colonIdx != 0) { // check that the header is *most likely* valid.
          char * convHeader =
            nsMsgI18NEncodeMimePartIIStr(headerVal.get() + colonIdx,
                                         false,
                                         mCompFields->GetCharacterSet(),
                                         colonIdx,
                                         true);
          if (convHeader) {
            newHeaderVal.Append(Substring(headerVal, 0, colonIdx));
            newHeaderVal.Append(convHeader);
            // we must terminate the header with CRLF here
            // as nsMsgCompUtils.cpp just calls PUSH_STRING
            newHeaderVal.Append("\r\n");
            PR_Free(convHeader);
          }
        }
      }
    }
    mCompFields->SetOtherRandomHeaders(newHeaderVal.get());
  }
  return rv;
}

// Add Mail-Followup-To header
// See bug #204339 and http://cr.yp.to/proto/replyto.html for details
nsresult
nsMsgComposeAndSend::AddMailFollowupToHeader() {
  nsresult rv;

  // Get OtherRandomHeaders...
  nsDependentCString customHeaders(mCompFields->GetOtherRandomHeaders());
  // ...and look for MFT-Header.  Stop here if MFT is already set.
  NS_NAMED_LITERAL_CSTRING(mftHeaderLabel, "Mail-Followup-To: ");
  if (StringBeginsWith(customHeaders, mftHeaderLabel) ||
      customHeaders.Find("\r\nMail-Followup-To: ") != -1)
    return NS_OK;

  // Get list of subscribed mailing lists
  nsAutoCString mailing_lists;
  rv = mUserIdentity->GetCharAttribute("subscribed_mailing_lists", mailing_lists);
  // Stop here if this list is missing or empty
  if (NS_FAILED(rv) || mailing_lists.IsEmpty())
    return NS_OK;

  // Get a list of all recipients excluding bcc
  nsDependentCString to(mCompFields->GetTo());
  nsDependentCString cc(mCompFields->GetCc());
  nsAutoCString recipients;

  if (to.IsEmpty() && cc.IsEmpty())
    // We have bcc recipients only, so we don't add the Mail-Followup-To header
    return NS_OK;

  if (!to.IsEmpty() && cc.IsEmpty())
    recipients = to;
  else if (to.IsEmpty() && !cc.IsEmpty())
    recipients = cc;
  else
  {
    recipients.Assign(to);
    recipients.AppendLiteral(", ");
    recipients.Append(cc);
  }

  // Create nsIMsgHeaderParser object
  nsCOMPtr<nsIMsgHeaderParser> headerParser =
    do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Remove duplicate addresses in recipients
  nsCString recipients_no_dups;
  rv = headerParser->RemoveDuplicateAddresses(recipients, EmptyCString(),
                                              recipients_no_dups);
  NS_ENSURE_SUCCESS(rv, rv);

  // Remove subscribed mailing lists from recipients...
  nsCString recipients_without_mailing_lists;
  rv = headerParser->RemoveDuplicateAddresses(recipients_no_dups, mailing_lists,
                                              recipients_without_mailing_lists);
  NS_ENSURE_SUCCESS(rv, rv);

  // ... If the result is equal to the input, we don't write to a subscribed
  // mailing list and therefore we don't add Mail-Followup-To
  if (recipients_no_dups == recipients_without_mailing_lists)
    return NS_OK;

  // Set Mail-Followup-To
  char * mimeHeader = nsMsgI18NEncodeMimePartIIStr(recipients.get(), true,
      mCompFields->GetCharacterSet(), mftHeaderLabel.Length(), true);
  if (!mimeHeader)
    return NS_ERROR_FAILURE;

  customHeaders.Append(mftHeaderLabel);
  customHeaders.Append(mimeHeader);
  customHeaders.AppendLiteral("\r\n");
  mCompFields->SetOtherRandomHeaders(customHeaders.get());
  PR_Free(mimeHeader);
  return NS_OK;
}

// Add Mail-Reply-To header
// See bug #204339 and http://cr.yp.to/proto/replyto.html for details
nsresult
nsMsgComposeAndSend::AddMailReplyToHeader() {
  nsresult rv;

  // Get OtherRandomHeaders...
  nsDependentCString customHeaders(mCompFields->GetOtherRandomHeaders());
  // ...and look for MRT-Header.  Stop here if MRT is already set.
  NS_NAMED_LITERAL_CSTRING(mrtHeaderLabel, "Mail-Reply-To: ");
  nsAutoCString headers_match = nsAutoCString("\r\n");
  headers_match.Append(mrtHeaderLabel);
  if ((StringHead(customHeaders, mrtHeaderLabel.Length()) == mrtHeaderLabel) ||
      (customHeaders.Find(headers_match) != -1))
    return NS_OK;

  // Get list of reply-to mangling mailing lists
  nsAutoCString mailing_lists;
  rv = mUserIdentity->GetCharAttribute("replyto_mangling_mailing_lists", mailing_lists);
  // Stop here if this list is missing or empty
  if (NS_FAILED(rv) || mailing_lists.IsEmpty())
    return NS_OK;

  // MRT will be set if the recipients of the message contains at least one
  // of the addresses in mailing_lists or if mailing_lists has '*' as first
  // character.  The latter case gives the user an easy way to always set
  // the MRT header.  Notice that this behaviour wouldn't make sense for MFT
  // in AddMailFollowupToHeader() above.

  if (mailing_lists[0] != '*') {
    // Get a list of all recipients excluding bcc
    nsDependentCString to(mCompFields->GetTo());
    nsDependentCString cc(mCompFields->GetCc());
    nsAutoCString recipients;

    if (to.IsEmpty() && cc.IsEmpty())
      // We have bcc recipients only, so we don't add the Mail-Reply-To header
      return NS_OK;

    if (!to.IsEmpty() && cc.IsEmpty())
      recipients = to;
    else if (to.IsEmpty() && !cc.IsEmpty())
      recipients = cc;
    else
    {
      recipients.Assign(to);
      recipients.AppendLiteral(", ");
      recipients.Append(cc);
    }

    // Create nsIMsgHeaderParser object
    nsCOMPtr<nsIMsgHeaderParser> headerParser =
      do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    // Remove duplicate addresses in recipients
    nsCString recipients_no_dups;
    rv = headerParser->RemoveDuplicateAddresses(recipients, EmptyCString(),
                                                recipients_no_dups);
    NS_ENSURE_SUCCESS(rv, rv);

    // Remove reply-to mangling mailing lists from recipients...
    nsCString recipients_without_mailing_lists;
    rv = headerParser->RemoveDuplicateAddresses(recipients_no_dups,
                                                mailing_lists,
                                                recipients_without_mailing_lists);
    NS_ENSURE_SUCCESS(rv, rv);

    // ... If the result is equal to the input, none of the recipients
    // occure in the MRT addresses and therefore we stop here.
    if (recipients_no_dups == recipients_without_mailing_lists)
      return NS_OK;
  }

  // Set Mail-Reply-To
  nsAutoCString replyTo, mailReplyTo;
  replyTo = mCompFields->GetReplyTo();
  if (replyTo.IsEmpty())
    mailReplyTo = mCompFields->GetFrom();
  else
    mailReplyTo = replyTo;
  char * mimeHeader = nsMsgI18NEncodeMimePartIIStr(mailReplyTo.get(), true,
    mCompFields->GetCharacterSet(), mrtHeaderLabel.Length(), true);
  if (!mimeHeader)
    return NS_ERROR_FAILURE;

  customHeaders.Append(mrtHeaderLabel);
  customHeaders.Append(mimeHeader);
  customHeaders.AppendLiteral("\r\n");
  mCompFields->SetOtherRandomHeaders(customHeaders.get());
  PR_Free(mimeHeader);
  return NS_OK;
}

nsresult
nsMsgComposeAndSend::AddXForwardedMessageIdHeader() {
  nsAutoCString otherHeaders;
  otherHeaders.Append(nsDependentCString(mCompFields->GetOtherRandomHeaders()));
  otherHeaders.Append(NS_LITERAL_CSTRING("X-Forwarded-Message-Id: "));
  otherHeaders.Append(nsDependentCString(mCompFields->GetReferences()));
  otherHeaders.Append(NS_LITERAL_CSTRING("\r\n"));
  return mCompFields->SetOtherRandomHeaders(otherHeaders.get());
}

nsresult
nsMsgComposeAndSend::SnarfAndCopyBody(const nsACString &attachment1_body,
                                      const char  *attachment1_type)
{
  //
  // If we are here, then just process the body from what was
  // passed in the attachment1_body field.
  //
  // strip out whitespaces from the end of body ONLY.
  nsAutoCString body(attachment1_body);
  body.Trim(" ", false, true);

  if (body.Length() > 0)
  {
    // will set m_attachment1_body and m_attachment1_body_length
    nsresult rv = EnsureLineBreaks(body);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  PR_FREEIF(m_attachment1_type);
  m_attachment1_type = PL_strdup (attachment1_type);
  PR_FREEIF(m_attachment1_encoding);
  m_attachment1_encoding = PL_strdup (ENCODING_8BIT);
  return NS_OK;
}

nsresult
nsMsgComposeAndSend::Init(
              nsIMsgIdentity  *aUserIdentity,
              const char *aAccountKey,
              nsMsgCompFields *fields,
              nsIFile      *sendFile,
              bool digest_p,
              bool dont_deliver_p,
              nsMsgDeliverMode mode,
              nsIMsgDBHdr *msgToReplace,
              const char *attachment1_type,
              const nsACString &attachment1_body,
              nsIArray *attachments,
              nsIArray *preloaded_attachments,
              const char *password,
              const nsACString &aOriginalMsgURI,
              MSG_ComposeType aType)
{
  nsresult      rv = NS_OK;

  //Let make sure we retreive the correct number of related parts. It may have changed since last time
  GetMultipartRelatedCount(true);

  nsString msg;
  if (!mComposeBundle)
  {
    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(mComposeBundle));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // Tell the user we are assembling the message...
  mComposeBundle->GetStringFromID(NS_MSG_ASSEMBLING_MESSAGE, getter_Copies(msg));
  SetStatusMessage(msg);
  if (mSendReport)
    mSendReport->SetCurrentProcess(nsIMsgSendReport::process_BuildMessage);

  //
  // The Init() method should initialize a send operation for full
  // blown create and send operations as well as just the "send a file"
  // operations.
  //
  m_dont_deliver_p = dont_deliver_p;
  m_deliver_mode = mode;
  mMsgToReplace = msgToReplace;

  mUserIdentity = aUserIdentity;
  mAccountKey = aAccountKey;
  NS_ASSERTION(mUserIdentity, "Got null identity!\n");
  if (!mUserIdentity) return NS_ERROR_UNEXPECTED;

  //
  // First sanity check the composition fields parameter and
  // see if we should continue
  //
  if (!fields)
    return NS_ERROR_OUT_OF_MEMORY;

  m_digest_p = digest_p;

  //
  // Needed for mime encoding!
  //
  bool strictly_mime = true;
  nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (pPrefBranch)
  {
    rv = pPrefBranch->GetBoolPref(PREF_MAIL_STRICTLY_MIME, &strictly_mime);
    rv = pPrefBranch->GetIntPref(PREF_MAIL_MESSAGE_WARNING_SIZE, (int32_t *) &mMessageWarningSize);
  }

  nsCOMPtr<nsIMsgComposeSecure> secureCompose
    = do_CreateInstance(NS_MSGCOMPOSESECURE_CONTRACTID, &rv);
  // It's not an error scenario if there is no secure compose.
  // The S/MIME extension may be unavailable.
  if (NS_SUCCEEDED(rv) && secureCompose)
  {
    bool requiresEncryptionWork = false;
    rv = secureCompose->RequiresCryptoEncapsulation(aUserIdentity, fields,
                                                    &requiresEncryptionWork);
    NS_ENSURE_SUCCESS(rv, rv);
    if (requiresEncryptionWork)
    {
      strictly_mime = true;
      // RFC2633 3.1.3 doesn't require multipart/signed entities to have
      // transfer encoding applied for ascii, but do it anyway to make sure
      // the content (e.g. line endings) isn't mangled along the way.
      fields->SetForceMsgEncoding(true);
    }
  }

  nsMsgMIMESetConformToStandard(strictly_mime);
  mime_use_quoted_printable_p = strictly_mime;

  rv = InitCompositionFields(fields, aOriginalMsgURI, aType);
  if (NS_FAILED(rv))
    return rv;

  //
  // At this point, if we are only creating this object to do
  // send operations on externally created RFC822 disk files,
  // make sure we have setup the appropriate nsIFile and
  // move on with life.
  //
  //
  // First check to see if we are doing a send operation on an external file
  // or creating the file itself.
  //
  if (sendFile)
  {
    mTempFile = sendFile;
    return NS_OK;
  }

  // Ok, now watch me pull a rabbit out of my hat....what we need
  // to do here is figure out what the body will be. If this is a
  // MHTML request, then we need to do some processing of the document
  // and figure out what we need to package along with this message
  // to send. See ProcessMultipartRelated() for further details.
  //

  //
  // If we don't have an editor, then we won't be doing multipart related processing
  // for the body, so make a copy of the one passed in.
  //
  if (!mEditor)
  {
    SnarfAndCopyBody(attachment1_body, attachment1_type);
  }
  else if (GetMultipartRelatedCount() == 0) // Only do this if there are not embedded objects
  {
    rv = GetBodyFromEditor();
    if (NS_FAILED(rv))
      return rv;
  }

  mSmtpPassword = password;

  return HackAttachments(attachments, preloaded_attachments);
}

NS_IMETHODIMP nsMsgComposeAndSend::SendDeliveryCallback(nsIURI *aUrl, bool inIsNewsDelivery, nsresult aExitCode)
{
  if (inIsNewsDelivery)
  {
    if (NS_FAILED(aExitCode))
      if (aExitCode != NS_ERROR_ABORT && !NS_IS_MSG_ERROR(aExitCode))
        aExitCode = NS_ERROR_POST_FAILED;

    DeliverAsNewsExit(aUrl, aExitCode);
  }
  else
  {
    if (NS_FAILED(aExitCode))
    {
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
    }
    DeliverAsMailExit(aUrl, aExitCode);
  }
  
  return aExitCode;
}

nsresult
nsMsgComposeAndSend::DeliverMessage()
{
  if (mSendProgress)
  {
    bool canceled = false;
    mSendProgress->GetProcessCanceledByUser(&canceled);
    if (canceled)
      return NS_ERROR_ABORT;
  }

  bool mail_p = ((mCompFields->GetTo() && *mCompFields->GetTo()) ||
          (mCompFields->GetCc() && *mCompFields->GetCc()) ||
          (mCompFields->GetBcc() && *mCompFields->GetBcc()));
  bool news_p = mCompFields->GetNewsgroups() && *(mCompFields->GetNewsgroups());
  NS_ASSERTION(!( m_deliver_mode != nsMsgSaveAsDraft && m_deliver_mode != nsMsgSaveAsTemplate)  || (mail_p || news_p), "message without destination");
  if (m_deliver_mode == nsMsgQueueForLater ||
      m_deliver_mode == nsMsgDeliverBackground ||
      m_deliver_mode == nsMsgSaveAsDraft ||
      m_deliver_mode == nsMsgSaveAsTemplate)
    return SendToMagicFolder(m_deliver_mode);

  //
  // Ok, we are about to send the file that we have built up...but what
  // if this is a mongo email...we should have a way to warn the user that
  // they are about to do something they may not want to do.
  //
  int64_t fileSize;
  nsresult rv = mTempFile->GetFileSize(&fileSize);
  if (NS_FAILED(rv))
    return NS_ERROR_FAILURE;

  if ((mMessageWarningSize > 0) && (fileSize > mMessageWarningSize) && (mGUINotificationEnabled))
  {
    bool abortTheSend = false;
    nsString msg;
    mComposeBundle->GetStringFromID(NS_MSG_LARGE_MESSAGE_WARNING, getter_Copies(msg));

    if (!msg.IsEmpty())
    {
      PRUnichar *printfString = nsTextFormatter::smprintf(msg.get(), fileSize);

      if (printfString)
      {
        nsCOMPtr<nsIPrompt> prompt;
        GetDefaultPrompt(getter_AddRefs(prompt));

        nsMsgAskBooleanQuestionByString(prompt, printfString, &abortTheSend);
        if (!abortTheSend)
        {
          nsresult ignoreMe;
          Fail(NS_ERROR_BUT_DONT_SHOW_ALERT, printfString, &ignoreMe);
          PR_Free(printfString);
          return NS_ERROR_FAILURE;
        }
        else
          PR_Free(printfString);
      }
    }
  }

  if (news_p)
  {
    if (mail_p)
      mSendMailAlso = true;

    return DeliverFileAsNews();   /* will call DeliverFileAsMail if it needs to */
  }
  else if (mail_p)
    return DeliverFileAsMail();
  else
    return NS_ERROR_UNEXPECTED;
  return NS_OK;
}


nsresult
nsMsgComposeAndSend::DeliverFileAsMail()
{
  char *buf, *buf2;
  buf = (char *) PR_Malloc ((mCompFields->GetTo() ? PL_strlen (mCompFields->GetTo())  + 10 : 0) +
               (mCompFields->GetCc() ? PL_strlen (mCompFields->GetCc())  + 10 : 0) +
               (mCompFields->GetBcc() ? PL_strlen (mCompFields->GetBcc()) + 10 : 0) +
               10);

  if (mSendReport)
    mSendReport->SetCurrentProcess(nsIMsgSendReport::process_SMTP);

  nsCOMPtr<nsIPrompt> promptObject;
  GetDefaultPrompt(getter_AddRefs(promptObject));

  if (!buf)
  {
    nsresult ignoreMe;
    Fail(NS_ERROR_OUT_OF_MEMORY, nullptr, &ignoreMe);
    NotifyListenerOnStopSending(nullptr, NS_ERROR_OUT_OF_MEMORY, nullptr, nullptr);
    return NS_ERROR_OUT_OF_MEMORY;
  }
  
  bool collectOutgoingAddresses = true;
  nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (pPrefBranch)
    pPrefBranch->GetBoolPref(PREF_MAIL_COLLECT_EMAIL_ADDRESS_OUTGOING, &collectOutgoingAddresses);

  nsCOMPtr<nsIAbAddressCollector> addressCollector =
           do_GetService(NS_ABADDRESSCOLLECTOR_CONTRACTID);

  bool collectAddresses = (collectOutgoingAddresses && addressCollector);
  uint32_t sendFormat = nsIAbPreferMailFormat::unknown;

  // this code is not ready yet
  // see bug #44494 for more details
  // so for now, just pass in nsIAbPreferMailFormat::unknown
  // which will have no effect on the "prefers" attribute in the ab
#if 0
  bool forcePlainText = mCompFields->GetForcePlainText();
  bool useMultipartAlternative = mCompFields->GetUseMultipartAlternative();
  // see GenericSendMessage() in MsgComposeCommands.js for the reverse logic
  // if we choose to send both (html and plain) remember html.
  if (forcePlainText && !useMultipartAlternative)
  {
    // for now, don't remember the "plaintext" decision.
    // we could get in here because while sending html mail
    // the body was "convertible", but that doesn't mean
    // we intended to force plain text here.
    // so for now, use "unknown" which will have no effect on the
    // "prefers" attribute in the ab.
    // see bug #245520 for more details
    // sendFormat = nsIAbPreferMailFormat::plaintext;
    sendFormat = nsIAbPreferMailFormat::unknown;
  }
  else if (!forcePlainText)
    sendFormat = nsIAbPreferMailFormat::html;
  else
    NS_ERROR("unknown send format, should not happen");
#endif

  PL_strcpy (buf, "");
  buf2 = buf + PL_strlen (buf);
  if (mCompFields->GetTo() && *mCompFields->GetTo())
  {
    PL_strcat (buf2, mCompFields->GetTo());
    if (addressCollector)
      addressCollector->CollectAddress(nsCString(mCompFields->GetTo()), 
            collectAddresses /* create card if one doesn't exist */, sendFormat);
  }
  if (mCompFields->GetCc() && *mCompFields->GetCc()) {
    if (*buf2) PL_strcat (buf2, ",");
      PL_strcat (buf2, mCompFields->GetCc());
    if (addressCollector)
      addressCollector->CollectAddress(nsCString(mCompFields->GetCc()), 
            collectAddresses /* create card if one doesn't exist */, sendFormat);
  }
  if (mCompFields->GetBcc() && *mCompFields->GetBcc()) {
    if (*buf2) PL_strcat (buf2, ",");
      PL_strcat (buf2, mCompFields->GetBcc());
    if (addressCollector)
      addressCollector->CollectAddress(nsCString(mCompFields->GetBcc()), 
            collectAddresses /* create card if one doesn't exist */, sendFormat);
  }

  // We need undo groups to keep only the addresses
  nsresult rv = StripOutGroupNames(buf);
  NS_ENSURE_SUCCESS(rv, rv);

  // Ok, now MIME II encode this to prevent 8bit problems...
  char *convbuf = nsMsgI18NEncodeMimePartIIStr(buf, true,
            mCompFields->GetCharacterSet(), 0, nsMsgMIMEGetConformToStandard());
  if (convbuf)
  {
    // MIME-PartII conversion
    PR_FREEIF(buf);
    buf = convbuf;
  }

  nsCString escaped_buf;
  MsgEscapeString(nsDependentCString(buf), nsINetUtil::ESCAPE_URL_PATH, escaped_buf);

  if (!escaped_buf.IsEmpty())
  {
    NS_Free(buf);
    buf = ToNewCString(escaped_buf);
  }

  nsCOMPtr<nsISmtpService> smtpService(do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv) && smtpService)
  {
    MsgDeliveryListener *deliveryListener = new MsgDeliveryListener(this, false);
    if (!deliveryListener)
      return NS_ERROR_OUT_OF_MEMORY;

    // we used to get the prompt from the compose window and we'd pass that in
    // to the smtp protocol as the prompt to use. But when you send a message,
    // we dismiss the compose window.....so you are parenting off of a window that
    // isn't there. To have it work correctly I think we want the alert dialogs to be modal
    // to the top most mail window...after all, that's where we are going to be sending status
    // update information too....

    nsCOMPtr<nsIInterfaceRequestor> callbacks;
    GetNotificationCallbacks(getter_AddRefs(callbacks));

    // Tell the user we are sending the message!
    nsString msg;
    mComposeBundle->GetStringFromID(NS_MSG_SENDING_MESSAGE, getter_Copies(msg));
    SetStatusMessage(msg);
    nsCOMPtr<nsIMsgStatusFeedback> msgStatus (do_QueryInterface(mSendProgress));
    // if the sendProgress isn't set, let's use the member variable.
    if (!msgStatus)
      msgStatus = do_QueryInterface(mStatusFeedback);

    nsCOMPtr<nsIURI> runningUrl;
    rv = smtpService->SendMailMessage(mTempFile, buf, mUserIdentity,
                                      mSmtpPassword.get(), deliveryListener, msgStatus,
                                      callbacks, mCompFields->GetDSN(),
                                      getter_AddRefs(runningUrl),
                                      getter_AddRefs(mRunningRequest));
    // set envid on the returned URL
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsISmtpUrl> smtpUrl(do_QueryInterface(runningUrl, &rv));
      if (NS_SUCCEEDED(rv))
        smtpUrl->SetDsnEnvid(nsDependentCString(mCompFields->GetMessageId()));
    }
  }

  PR_FREEIF(buf); // free the buf because we are done with it....
  return rv;
}

nsresult
nsMsgComposeAndSend::DeliverFileAsNews()
{
  nsresult rv = NS_OK;
  if (!(mCompFields->GetNewsgroups()))
    return rv;

  if (mSendReport)
    mSendReport->SetCurrentProcess(nsIMsgSendReport::process_NNTP);

  nsCOMPtr<nsIPrompt> promptObject;
  GetDefaultPrompt(getter_AddRefs(promptObject));

  nsCOMPtr<nsINntpService> nntpService(do_GetService(NS_NNTPSERVICE_CONTRACTID, &rv));

  if (NS_SUCCEEDED(rv) && nntpService)
  {
    MsgDeliveryListener *deliveryListener = new MsgDeliveryListener(this, true);
    if (!deliveryListener)
      return NS_ERROR_OUT_OF_MEMORY;

    // Tell the user we are posting the message!
    nsString msg;
    mComposeBundle->GetStringFromID(NS_MSG_POSTING_MESSAGE, getter_Copies(msg));
    SetStatusMessage(msg);

    nsCOMPtr <nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    // JFD TODO: we should use GetDefaultPrompt instead
    nsCOMPtr<nsIMsgWindow> msgWindow;
    rv = mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
    // see bug #163139
    // we might not have a msg window if only the compose window is open.
    if(NS_FAILED(rv))
      msgWindow = nullptr;

    rv = nntpService->PostMessage(mTempFile, mCompFields->GetNewsgroups(), mAccountKey.get(),
                                  deliveryListener, msgWindow, nullptr);
    if (NS_FAILED(rv)) return rv;
  }

  return rv;
}

NS_IMETHODIMP
nsMsgComposeAndSend::Fail(nsresult aFailureCode, const PRUnichar *aErrorMsg,
                          nsresult *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = aFailureCode;

  if (NS_FAILED(aFailureCode))
  {
    nsCOMPtr<nsIPrompt> prompt;
    GetDefaultPrompt(getter_AddRefs(prompt));

    if (mSendReport)
    {
      int32_t process;
      if (NS_SUCCEEDED(mSendReport->GetCurrentProcess(&process)) && process == nsIMsgSendReport::process_Current)
      {
        // currentProcess isn't set yet, so we need another value.
        mSendReport->SetCurrentProcess(nsIMsgSendReport::process_BuildMessage);
      }
      mSendReport->SetError(nsIMsgSendReport::process_Current, aFailureCode, false);
      mSendReport->SetMessage(nsIMsgSendReport::process_Current, aErrorMsg, false);
      mSendReport->DisplayReport(prompt, true, true, aResult);
    }
    else
    {
      if (aFailureCode != NS_ERROR_BUT_DONT_SHOW_ALERT)
        nsMsgDisplayMessageByID(prompt, NS_ERROR_SEND_FAILED);
    }
  }

  if (NS_SUCCEEDED(m_status))
    m_status = NS_ERROR_BUT_DONT_SHOW_ALERT;

  //Stop any pending process...
  Abort();

  return NS_OK;
}

nsresult
nsMsgComposeAndSend::FormatStringWithSMTPHostNameByID(nsresult aMsgId, PRUnichar **aString)
{
  NS_ENSURE_ARG(aString);

  nsresult rv;
  nsCOMPtr<nsISmtpService> smtpService(do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv,rv);

  // Get the smtp hostname and format the string.
  nsCString smtpHostName;
  nsCOMPtr<nsISmtpServer> smtpServer;
  rv = smtpService->GetServerByIdentity(mUserIdentity, getter_AddRefs(smtpServer));
  if (NS_SUCCEEDED(rv))
    smtpServer->GetHostname(smtpHostName);

  nsAutoString hostStr;
  CopyASCIItoUTF16(smtpHostName, hostStr);
  const PRUnichar *params[] = { hostStr.get() };
  if (NS_SUCCEEDED(rv))
    mComposeBundle->FormatStringFromID(NS_ERROR_GET_CODE(aMsgId), params, 1, aString);
  return rv;
}

void
nsMsgComposeAndSend::DoDeliveryExitProcessing(nsIURI * aUri, nsresult aExitCode, bool aCheckForMail)
{
  // If we fail on the news delivery, no sense in going on so just notify
  // the user and exit.
  if (NS_FAILED(aExitCode))
  {

    nsString eMsg;
    if (aExitCode == NS_ERROR_SMTP_SEND_FAILED_UNKNOWN_SERVER ||
        aExitCode == NS_ERROR_SMTP_SEND_FAILED_UNKNOWN_REASON ||
        aExitCode == NS_ERROR_SMTP_SEND_FAILED_REFUSED ||
        aExitCode == NS_ERROR_SMTP_SEND_FAILED_INTERRUPTED ||
        aExitCode == NS_ERROR_SMTP_SEND_FAILED_TIMEOUT ||
        aExitCode == NS_ERROR_SMTP_PASSWORD_UNDEFINED ||
        aExitCode == NS_ERROR_SMTP_AUTH_FAILURE ||
        aExitCode == NS_ERROR_SMTP_AUTH_GSSAPI ||
        aExitCode == NS_ERROR_SMTP_AUTH_MECH_NOT_SUPPORTED ||
        aExitCode == NS_ERROR_SMTP_AUTH_NOT_SUPPORTED ||
        aExitCode == NS_ERROR_SMTP_AUTH_CHANGE_ENCRYPT_TO_PLAIN_NO_SSL ||
        aExitCode == NS_ERROR_SMTP_AUTH_CHANGE_ENCRYPT_TO_PLAIN_SSL ||
        aExitCode == NS_ERROR_SMTP_AUTH_CHANGE_PLAIN_TO_ENCRYPT ||
        aExitCode == NS_ERROR_STARTTLS_FAILED_EHLO_STARTTLS)
      FormatStringWithSMTPHostNameByID(aExitCode, getter_Copies(eMsg));
    else
      mComposeBundle->GetStringFromID(NS_ERROR_GET_CODE(aExitCode), getter_Copies(eMsg));

    Fail(aExitCode, eMsg.get(), &aExitCode);
    NotifyListenerOnStopSending(nullptr, aExitCode, nullptr, nullptr);
    return;
  }

  if (aCheckForMail)
  {
    if ((mCompFields->GetTo() && *mCompFields->GetTo()) ||
        (mCompFields->GetCc() && *mCompFields->GetCc()) ||
        (mCompFields->GetBcc() && *mCompFields->GetBcc()))
    {
      // If we're sending this news message to mail as well, start it now.
      // Completion and further errors will be handled there.
      DeliverFileAsMail();
      return;
    }
  }

  //
  // Tell the listeners that we are done with the sending operation...
  //
  NotifyListenerOnStopSending(mCompFields->GetMessageId(),
                              aExitCode,
                              nullptr,
                              nullptr);

  // If we hit here, we are done with delivery!
  //
  // Just call the DoFCC() method and if that fails, then we should just
  // cleanup and get out. If DoFCC "succeeds", then all that means is the
  // async copy operation has been started and we will be notified later
  // when it is done. DON'T cleanup until the copy is complete and don't
  // notify the listeners with OnStop() until we are done.
  //
  // For now, we don't need to do anything here, but the code will stay this
  // way until later...
  //

  DoFcc();
}

NS_IMETHODIMP
nsMsgComposeAndSend::DeliverAsMailExit(nsIURI *aUrl, nsresult aExitCode)
{
  DoDeliveryExitProcessing(aUrl, aExitCode, false);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::DeliverAsNewsExit(nsIURI *aUrl, nsresult aExitCode)
{
  DoDeliveryExitProcessing(aUrl, aExitCode, mSendMailAlso);
  return NS_OK;
}

bool nsMsgComposeAndSend::CanSaveMessagesToFolder(const char *folderURL)
{
  nsresult rv;
  nsCOMPtr<nsIRDFService> rdf(do_GetService("@mozilla.org/rdf/rdf-service;1", &rv));
  if (NS_FAILED(rv))
    return false;

  nsCOMPtr<nsIRDFResource> resource;
  rv = rdf->GetResource(nsDependentCString(folderURL), getter_AddRefs(resource));
  if (NS_FAILED(rv))
    return false;

  nsCOMPtr <nsIMsgFolder> thisFolder;
  thisFolder = do_QueryInterface(resource, &rv);
  if (NS_FAILED(rv) || !thisFolder)
    return false;

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = thisFolder->GetServer(getter_AddRefs(server));
  if (NS_FAILED(rv) || !server)
    return false;

  // See if we are allowed to save/file msgs to this folder.
  bool canSave;
  rv = server->GetCanFileMessagesOnServer(&canSave);
  return canSave;
}

//
// Now, start the appropriate copy operation.
//
nsresult
nsMsgComposeAndSend::DoFcc()
{
  //
  // Just cleanup and return success if we're not allowed to save msgs to FCC folder.
  //
  const char* fcc = mCompFields->GetFcc();
  if (!fcc || !*fcc || !CanSaveMessagesToFolder(fcc))
  {

    // It is the caller's responsibility to say we've stopped sending, so just
    // let the listeners know we're not doing a copy.
    NotifyListenerOnStopCopy(NS_OK);  // For closure of compose window...
    return NS_OK;
  }

  if (mSendReport)
    mSendReport->SetCurrentProcess(nsIMsgSendReport::process_Copy);

  //
  // If we are here, then we need to save off the FCC file to save and
  // start the copy operation. MimeDoFCC() will take care of all of this
  // for us.
  //
  nsresult rv = MimeDoFCC(mTempFile,
                          nsMsgDeliverNow,
                          mCompFields->GetBcc(),
                          mCompFields->GetFcc(),
                          mCompFields->GetNewspostUrl());
  if (NS_FAILED(rv))
  {
    //
    // If we hit here, the copy operation FAILED and we should at least tell the
    // user that it did fail but the send operation has already succeeded.
    //
    NotifyListenerOnStopCopy(rv);
  }

  return rv;
}

NS_IMETHODIMP
nsMsgComposeAndSend::NotifyListenerOnStartSending(const char *aMsgID, uint32_t aMsgSize)
{
  if (mListener)
    mListener->OnStartSending(aMsgID, aMsgSize);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::NotifyListenerOnProgress(const char *aMsgID, uint32_t aProgress, uint32_t aProgressMax)
{
  if (mListener)
    mListener->OnProgress(aMsgID, aProgress, aProgressMax);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::NotifyListenerOnStatus(const char *aMsgID, const PRUnichar *aMsg)
{
  if (mListener)
    mListener->OnStatus(aMsgID, aMsg);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::NotifyListenerOnStopSending(const char *aMsgID, nsresult aStatus, const PRUnichar *aMsg,
                                                  nsIFile *returnFile)
{
  if (mListener != nullptr)
    mListener->OnStopSending(aMsgID, aStatus, aMsg, returnFile);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::NotifyListenerOnStartCopy()
{
  nsCOMPtr<nsIMsgCopyServiceListener> copyListener;

  if (mListener)
  {
    copyListener = do_QueryInterface(mListener);
    if (copyListener)
      copyListener->OnStartCopy();
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::NotifyListenerOnProgressCopy(uint32_t aProgress,
                                                   uint32_t aProgressMax)
{
  nsCOMPtr<nsIMsgCopyServiceListener> copyListener;

  if (mListener)
  {
    copyListener = do_QueryInterface(mListener);
    if (copyListener)
      copyListener->OnProgress(aProgress, aProgressMax);
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::SetMessageKey(uint32_t aMessageKey)
{
    m_messageKey = aMessageKey;
    return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::GetMessageKey(uint32_t *aMessageKey)
{
    *aMessageKey = m_messageKey;
    return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::GetFolderUri(nsACString &aFolderUri)
{
  aFolderUri = m_folderName;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::GetPartForDomIndex(int32_t aDomIndex, nsACString &aPartNum)
{
  aPartNum = m_partNumbers.SafeElementAt(aDomIndex, EmptyCString());
  return NS_OK;
}

NS_IMETHODIMP
nsMsgComposeAndSend::GetMessageId(nsACString& aMessageId)
{
  nsresult rv = NS_OK;
  if (mCompFields)
    aMessageId = mCompFields->GetMessageId();
  else
    rv = NS_ERROR_NULL_POINTER;
  return rv;
}

NS_IMETHODIMP
nsMsgComposeAndSend::NotifyListenerOnStopCopy(nsresult aStatus)
{
  // This is one per copy so make sure we clean this up first.
  mCopyObj = nullptr;

  // Set a status message...
  nsString msg;
  if (NS_SUCCEEDED(aStatus))
    mComposeBundle->GetStringFromID(NS_MSG_START_COPY_MESSAGE_COMPLETE, getter_Copies(msg));
  else
    mComposeBundle->GetStringFromID(NS_MSG_START_COPY_MESSAGE_FAILED, getter_Copies(msg));

  SetStatusMessage(msg);
  nsCOMPtr<nsIPrompt> prompt;
  GetDefaultPrompt(getter_AddRefs(prompt));

  if (NS_FAILED(aStatus))
  {
    nsresult rv;
    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv, rv);

    nsString msg;
    const PRUnichar *formatStrings[] = { mSavedToFolderName.get() };

    rv = bundle->FormatStringFromName(NS_LITERAL_STRING("errorSavingMsg").get(),
                                      formatStrings, 1,
                                      getter_Copies(msg));
    if (NS_SUCCEEDED(rv))
    {
      bool retry = false;
      nsMsgAskBooleanQuestionByString(prompt, msg.get(), &retry, nullptr);
      if (retry)
      {
        mSendProgress = nullptr; // this was cancelled, so we need to clear it.
        return SendToMagicFolder(m_deliver_mode);
      }
    }

    // We failed, and the user decided not to retry. So we're just going to
    // fail out. However, give Fail a success code so that it doesn't prompt
    // the user a second time as they already know about the failure.
    Fail(NS_OK, nullptr, &aStatus);
  }
  // Ok, now to support a second copy operation, we need to figure
  // out which copy request just finished. If the user has requested
  // a second copy operation, then we need to fire that off, but if they
  // just wanted a single copy operation, we can tell everyone we are done
  // and move on with life. Only do the second copy if the first one worked.
  //
  if ( NS_SUCCEEDED(aStatus) && (mNeedToPerformSecondFCC) )
  {
    if (mSendReport)
      mSendReport->SetCurrentProcess(nsIMsgSendReport::process_FCC);

    mNeedToPerformSecondFCC = false;

    const char *fcc2 = mCompFields->GetFcc2();
    if (fcc2 && *fcc2)
    {
      nsresult rv = MimeDoFCC(mTempFile,
                              nsMsgDeliverNow,
                              mCompFields->GetBcc(),
                              fcc2,
                              mCompFields->GetNewspostUrl());
      if (NS_FAILED(rv))
        Fail(rv, nullptr, &aStatus);
      else
        return NS_OK;
    }
  }

  // If we are here, its real cleanup time!
  if (mListener)
  {
    nsCOMPtr<nsIMsgCopyServiceListener> copyListener =
      do_QueryInterface(mListener);
    if (copyListener)
      copyListener->OnStopCopy(aStatus);
  }

  return aStatus;
}

/* This is the main driving function of this module.  It generates a
   document of type message/rfc822, which contains the stuff provided.
   The first few arguments are the standard header fields that the
   generated document should have.

   `other_random_headers' is a string of additional headers that should
   be inserted beyond the standard ones.  If provided, it is just tacked
   on to the end of the header block, so it should have newlines at the
   end of each line, shouldn't have blank lines, multi-line headers
   should be properly continued, etc.

   `digest_p' says that most of the documents we are attaching are
   themselves messages, and so we should generate a multipart/digest
   container instead of multipart/mixed.  (It's a minor difference.)

   The full text of the first attachment is provided via `attachment1_type'
   and `attachment1_body'. These may all be 0 if all attachments are
   provided externally.

   Subsequent attachments are provided as URLs to load, described in the
   nsMsgAttachmentData structures.

   If `dont_deliver_p' is false, then we actually deliver the message to the
   SMTP and/or NNTP server, and the message_delivery_done_callback will be
   invoked with the status.

   If `dont_deliver_p' is true, then we just generate the message, we don't
   actually deliver it, and the message_delivery_done_callback will be called
   with the name of the generated file.  The callback is responsible for both
   freeing the file name string, and deleting the file when it is done with
   it.  If an error occurred, then `status' will be negative and
   `error_message' may be an error message to display.  If status is non-
   negative, then `error_message' contains the file name (this is kind of
   a kludge...)
 */
NS_IMETHODIMP
nsMsgComposeAndSend::CreateAndSendMessage(
              nsIEditor                         *aEditor,
              nsIMsgIdentity                    *aUserIdentity,
              const char                        *aAccountKey,
              nsIMsgCompFields                  *fields,
              bool                              digest_p,
              bool                              dont_deliver_p,
              nsMsgDeliverMode                  mode,
              nsIMsgDBHdr                       *msgToReplace,
              const char                        *attachment1_type,
              const nsACString                  &attachment1_body,
              nsIArray *attachments,
              nsIArray *preloaded_attachments,
              nsIDOMWindow                      *parentWindow,
              nsIMsgProgress                    *progress,
              nsIMsgSendListener                *aListener,
              const char                        *password,
              const nsACString                  &aOriginalMsgURI,
              MSG_ComposeType                   aType
              )
{
  nsresult      rv;
  /* First thing to do is to reset the send errors report */
  mSendReport->Reset();
  mSendReport->SetDeliveryMode(mode);

  mParentWindow = parentWindow;
  mSendProgress = progress;
  mListener = aListener;

  // Set the editor for MHTML operations if necessary
  if (aEditor)
    mEditor = aEditor;

  rv = Init(aUserIdentity, aAccountKey, (nsMsgCompFields *)fields, nullptr,
          digest_p, dont_deliver_p, mode, msgToReplace,
          attachment1_type, attachment1_body,
          attachments, preloaded_attachments,
          password, aOriginalMsgURI, aType);

  if (NS_FAILED(rv) && mSendReport)
    mSendReport->SetError(nsIMsgSendReport::process_Current, rv, false);

  return rv;
}

NS_IMETHODIMP
nsMsgComposeAndSend::CreateRFC822Message(
              nsIMsgIdentity *aUserIdentity,
              nsIMsgCompFields *aFields,
              const char *aMsgType,
              const nsACString &aMsgBody,
              bool aIsDraft,
              nsIArray *aAttachments,
              nsISupportsArray *aEmbeddedObjects,
              nsIMsgSendListener *aListener
              )
{
  nsresult rv;
  nsMsgDeliverMode mode = aIsDraft ? nsIMsgSend::nsMsgSaveAsDraft :
                                     nsIMsgSend::nsMsgDeliverNow;

  /* First thing to do is to reset the send errors report */
  mSendReport->Reset();
  mSendReport->SetDeliveryMode(mode);

  mParentWindow = nullptr;
  mSendProgress = nullptr;
  mListener = aListener;
  mEmbeddedObjectList = aEmbeddedObjects;

  rv = Init(aUserIdentity, nullptr, (nsMsgCompFields *)aFields, nullptr,
            false, true, mode, nullptr,
            aMsgType,
            aMsgBody,
            nullptr, aAttachments,
            nullptr, EmptyCString(), nsIMsgCompType::New);

  if (NS_FAILED(rv) && mSendReport)
    mSendReport->SetError(nsIMsgSendReport::process_Current, rv, false);

  return rv;
}

nsresult
nsMsgComposeAndSend::SendMessageFile(
              nsIMsgIdentity                    *aUserIndentity,
              const char                        *aAccountKey,
              nsIMsgCompFields                  *fields,
              nsIFile                           *sendIFile,
              bool                              deleteSendFileOnCompletion,
              bool                              digest_p,
              nsMsgDeliverMode                  mode,
              nsIMsgDBHdr                       *msgToReplace,
              nsIMsgSendListener                *aListener,
              nsIMsgStatusFeedback              *aStatusFeedback,
              const char                        *password
              )
{
  NS_ENSURE_ARG_POINTER(fields);
  NS_ENSURE_ARG_POINTER(sendIFile);

  nsresult      rv;

  /* First thing to do is to reset the send errors report */
  mSendReport->Reset();
  mSendReport->SetDeliveryMode(mode);

  mStatusFeedback = aStatusFeedback;
  //
  // First check to see if the external file we are sending is a valid file.
  //
  bool exists;
  if (NS_FAILED(sendIFile->Exists(&exists)))
    return NS_ERROR_INVALID_ARG;

  if (!exists)
    return NS_ERROR_INVALID_ARG;

  // Setup the listener...
  mListener = aListener;

  // Should we delete the temp file when done?
  if (!deleteSendFileOnCompletion)
    mReturnFile = sendIFile;

  rv = Init(aUserIndentity, aAccountKey, (nsMsgCompFields *)fields, sendIFile,
            digest_p, false, mode, msgToReplace,
            nullptr, EmptyCString(),
            nullptr, nullptr,
            password, EmptyCString(), nsIMsgCompType::New);

  if (NS_SUCCEEDED(rv))
    rv = DeliverMessage();

  if (NS_FAILED(rv) && mSendReport)
    mSendReport->SetError(nsIMsgSendReport::process_Current, rv, false);

  return rv;
}

nsMsgAttachmentData *
BuildURLAttachmentData(nsIURI *url)
{
  int                 attachCount = 2;  // one entry and one empty entry
  nsMsgAttachmentData *attachments;
  const char          *theName = nullptr;

  if (!url)
    return nullptr;

  attachments = new nsMsgAttachmentData[attachCount];
  if (!attachments)
    return nullptr;

  // Now get a readable name...
  nsAutoCString spec;
  url->GetSpec(spec);
  if (!spec.IsEmpty())
  {
    theName = strrchr(spec.get(), '/');
  }

  if (!theName)
    theName = "Unknown"; // Don't I18N this string...should never happen...
  else
    theName++;

  attachments[0].m_url = url; // The URL to attach.
  attachments[0].m_realName = theName;  // The original name of this document, which will eventually show up in the

  NS_IF_ADDREF(url);
  return attachments;
}

//
// Send the message to the magic folder, and runs the completion/failure
// callback.
//
nsresult
nsMsgComposeAndSend::SendToMagicFolder(nsMsgDeliverMode mode)
{
    nsresult rv = MimeDoFCC(mTempFile,
                            mode,
                            mCompFields->GetBcc(),
                            mCompFields->GetFcc(),
                            mCompFields->GetNewspostUrl());
    //
    // The caller of MimeDoFCC needs to deal with failure.
    //
    if (NS_FAILED(rv))
      rv = NotifyListenerOnStopCopy(rv);

    return rv;
}

char*
nsMsgGetEnvelopeLine(void)
{
  static char       result[75] = "";
  PRExplodedTime    now;
  char              buffer[128] = "";

  // Generate envelope line in format of:  From - Sat Apr 18 20:01:49 1998
  //
  // Use PR_FormatTimeUSEnglish() to format the date in US English format,
  // then figure out what our local GMT offset is, and append it (since
  // PR_FormatTimeUSEnglish() can't do that.) Generate four digit years as
  // per RFC 1123 (superceding RFC 822.)
  //
  PR_ExplodeTime(PR_Now(), PR_LocalTimeParameters, &now);
  PR_FormatTimeUSEnglish(buffer, sizeof(buffer),
               "%a %b %d %H:%M:%S %Y",
               &now);

  // This value must be in ctime() format, with English abbreviations.
  // PL_strftime("... %c ...") is no good, because it is localized.
  //
  PL_strcpy(result, "From - ");
  PL_strcpy(result + 7, buffer);
  PL_strcpy(result + 7 + 24, CRLF);
  return result;
}

nsresult
nsMsgComposeAndSend::MimeDoFCC(nsIFile          *input_file,
                               nsMsgDeliverMode mode,
                               const char       *bcc_header,
                               const char       *fcc_header,
                               const char       *news_url)
{
  nsresult      status = NS_OK;
  char          *ibuffer = 0;
  int32_t       ibuffer_size = TEN_K;
  char          *obuffer = 0;
  uint32_t      n;
  bool          folderIsLocal = true;
  nsCString     turi;
  PRUnichar     *printfString = nullptr;
  nsString msg;
  nsCOMPtr<nsIMsgFolder> folder;

  // Before continuing, just check the user has not cancel the operation
  if (mSendProgress)
  {
    bool canceled = false;
    mSendProgress->GetProcessCanceledByUser(&canceled);
    if (canceled)
      return NS_ERROR_ABORT;
    else
      mSendProgress->OnProgressChange(nullptr, nullptr, 0, 0, 0, -1);
  }

  //
  // Ok, this is here to keep track of this for 2 copy operations...
  //
  if (mCopyFile)
  {
    mCopyFile2 = mCopyFile;
    mCopyFile = nullptr;
  }

  //
  // Create the file that will be used for the copy service!
  //
  nsresult rv = nsMsgCreateTempFile("nscopy.tmp", getter_AddRefs(mCopyFile));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIOutputStream> tempOutfile;
  rv = MsgNewBufferedFileOutputStream(getter_AddRefs(tempOutfile), mCopyFile, -1, 00600);
  if (NS_FAILED(rv))
  {
    if (mSendReport)
    {
      nsAutoString error_msg;
      nsMsgBuildMessageWithTmpFile(mCopyFile, error_msg);
      mSendReport->SetMessage(nsIMsgSendReport::process_Current, error_msg.get(), false);
    }
    status = NS_MSG_UNABLE_TO_OPEN_TMP_FILE;

    mCopyFile = nullptr;
    return status;
  }

  //
  // Get our files ready...
  //
  nsCOMPtr<nsIInputStream> inputFile;
  rv = NS_NewLocalFileInputStream(getter_AddRefs(inputFile), input_file);
  if (NS_FAILED(rv))
  {
    if (mSendReport)
    {
      nsAutoString error_msg;
      nsMsgBuildMessageWithFile(input_file, error_msg);
      mSendReport->SetMessage(nsIMsgSendReport::process_Current, error_msg.get(), false);
    }
    status = NS_MSG_UNABLE_TO_OPEN_FILE;
    goto FAIL;
  }

  // now the buffers...
  ibuffer = nullptr;
  while (!ibuffer && (ibuffer_size >= 1024))
  {
    ibuffer = (char *) PR_Malloc(ibuffer_size);
    if (!ibuffer)
      ibuffer_size /= 2;
  }

  if (!ibuffer)
  {
    status = NS_ERROR_OUT_OF_MEMORY;
    goto FAIL;
  }

  //
  // First, we we need to put a Berkeley "From - " delimiter at the head of
  // the file for parsing...
  //

  if (fcc_header && *fcc_header)
    GetExistingFolder(nsDependentCString(fcc_header), getter_AddRefs(folder));

  if ((mode == nsMsgDeliverNow || mode == nsMsgSendUnsent) && folder)
    turi = fcc_header;
  else
    GetFolderURIFromUserPrefs(mode, mUserIdentity, turi);
  status = MessageFolderIsLocal(mUserIdentity, mode, turi.get(), &folderIsLocal);
  if (NS_FAILED(status))
    goto FAIL;

  // Tell the user we are copying the message...
  mComposeBundle->GetStringFromID(NS_MSG_START_COPY_MESSAGE, getter_Copies(msg));
  if (!msg.IsEmpty())
  {
    nsCOMPtr<nsIRDFService> rdfService = do_GetService(kRDFServiceCID);
    if (rdfService)
    {
      nsCOMPtr<nsIRDFResource> res;
      rdfService->GetResource(turi, getter_AddRefs(res));
      nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(res);
      if (folder)
        folder->GetName(mSavedToFolderName);
    }
    if (!mSavedToFolderName.IsEmpty())
      printfString = nsTextFormatter::smprintf(msg.get(), mSavedToFolderName.get());
    else
      printfString = nsTextFormatter::smprintf(msg.get(), "?");
    if (printfString)
    {
      SetStatusMessage(nsDependentString(printfString));
      PR_Free(printfString);
    }
  }

  if (folderIsLocal)
  {
    char *envelopeLine = nsMsgGetEnvelopeLine();
    uint32_t   len = PL_strlen(envelopeLine);

    rv = tempOutfile->Write(envelopeLine, len, &n);
    if (NS_FAILED(rv) || n != len)
    {
      status = NS_ERROR_FAILURE;
      goto FAIL;
    }
  }

  //
  // Write out an X-Mozilla-Status header.
  //
  // This is required for the queue file, so that we can overwrite it once
  // the messages have been delivered, and so that the nsMsgMessageFlags::Queued bit
  // is set.
  //
  // For FCC files, we don't necessarily need one, but we might as well put
  // one in so that it's marked as read already.
  //
  //
  // Need to add these lines for POP3 ONLY! IMAP servers will handle
  // this status information for summary file regeneration for us.
  if ((mode == nsMsgQueueForLater || mode == nsMsgSaveAsDraft ||
       mode == nsMsgSaveAsTemplate || mode == nsMsgDeliverNow ||
       mode == nsMsgSendUnsent || mode == nsMsgDeliverBackground) &&
      folderIsLocal)
  {
    char       *buf = 0;
    uint16_t   flags = 0;

    // for save as draft and send later, we want to leave the message as unread.
    // See Bug #198087
    // Messages sent with mode nsMsgDeliverBackground must not have the Queued
    // flag sent so that they get picked up by the background send function.
    if (mode == nsMsgQueueForLater)
      flags |= nsMsgMessageFlags::Queued;
    else if (mode != nsMsgSaveAsDraft && mode != nsMsgDeliverBackground)
      flags |= nsMsgMessageFlags::Read;
    buf = PR_smprintf(X_MOZILLA_STATUS_FORMAT CRLF, flags);
    if (buf)
    {
      uint32_t   len = PL_strlen(buf);
      rv = tempOutfile->Write(buf, len, &n);
      PR_Free(buf);
      if (NS_FAILED(rv) || n != len)
      {
        status = NS_ERROR_FAILURE;
        goto FAIL;
      }
    }

    uint32_t flags2 = 0;
    if (mode == nsMsgSaveAsTemplate)
      flags2 |= nsMsgMessageFlags::Template;
    if (mode == nsMsgDeliverNow || mode == nsMsgSendUnsent)
    {
      flags2 &= ~nsMsgMessageFlags::MDNReportNeeded;
      flags2 |= nsMsgMessageFlags::MDNReportSent;
    }
    buf = PR_smprintf(X_MOZILLA_STATUS2_FORMAT CRLF, flags2);
    if (buf)
    {
      uint32_t   len = PL_strlen(buf);
      rv = tempOutfile->Write(buf, len, &n);
      PR_Free(buf);
      if (NS_FAILED(rv) || n != len)
      {
        status = NS_ERROR_FAILURE;
        goto FAIL;
      }
    }
    tempOutfile->Write(X_MOZILLA_KEYWORDS, sizeof(X_MOZILLA_KEYWORDS) - 1, &n);
  }

  // Write out the FCC and BCC headers.
  // When writing to the Queue file, we *must* write the FCC and BCC
  // headers, or else that information would be lost.  Because, when actually
  // delivering the message (with "deliver now") we do FCC/BCC right away;
  // but when queueing for later delivery, we do FCC/BCC at delivery-time.
  //
  // The question remains of whether FCC and BCC should be written into normal
  // BCC folders (like the Sent Mail folder.)
  //
  // For FCC, there seems no point to do that; it's not information that one
  // would want to refer back to.
  //
  // For BCC, the question isn't as clear.  On the one hand, if I send someone
  // a BCC'ed copy of the message, and save a copy of it for myself (with FCC)
  // I might want to be able to look at that message later and see the list of
  // people to whom I had BCC'ed it.
  //
  // On the other hand, the contents of the BCC header is sensitive
  // information, and should perhaps not be stored at all.
  //
  // Thus the consultation of the #define SAVE_BCC_IN_FCC_FILE.
  //
  // (Note that, if there is a BCC header present in a message in some random
  // folder, and that message is forwarded to someone, then the attachment
  // code will strip out the BCC header before forwarding it.)
  //
  if ((mode == nsMsgQueueForLater || mode == nsMsgDeliverBackground ||
       mode == nsMsgSaveAsDraft || mode == nsMsgSaveAsTemplate) &&
      fcc_header && *fcc_header)
  {
    int32_t L = PL_strlen(fcc_header) + 20;
    char  *buf = (char *) PR_Malloc (L);
    if (!buf)
    {
      status = NS_ERROR_OUT_OF_MEMORY;
      goto FAIL;
    }

    PR_snprintf(buf, L-1, "FCC: %s" CRLF, fcc_header);

    uint32_t   len = PL_strlen(buf);
    rv = tempOutfile->Write(buf, len, &n);
    if (NS_FAILED(rv) || n != len)
    {
      status = NS_ERROR_FAILURE;
      goto FAIL;
    }
  }

  //
  // Ok, now I want to get the identity key and write it out if this is for a
  // nsMsgQueueForLater operation!
  //
  if ((nsMsgQueueForLater == mode || nsMsgSaveAsDraft == mode ||
       nsMsgDeliverBackground == mode || nsMsgSaveAsTemplate == mode) &&
      mUserIdentity)
  {
    char *buf = nullptr;
    nsCString key;

    if (NS_SUCCEEDED(mUserIdentity->GetKey(key)) && !key.IsEmpty())
    {
      buf = PR_smprintf(HEADER_X_MOZILLA_IDENTITY_KEY ": %s" CRLF, key.get());
      if (buf)
      {
        uint32_t len = strlen(buf);
        rv = tempOutfile->Write(buf, len, &n);
        PR_Free(buf);
        if (NS_FAILED(rv) || n != len)
        {
          status = NS_ERROR_FAILURE;
          goto FAIL;
        }
      }
    }

    if (!mAccountKey.IsEmpty())
    {
      buf = PR_smprintf(HEADER_X_MOZILLA_ACCOUNT_KEY ": %s" CRLF, mAccountKey.get());
      if (buf)
      {
        uint32_t len = strlen(buf);
        rv = tempOutfile->Write(buf, len, &n);
        PR_Free(buf);
        if (NS_FAILED(rv) || n != len)
        {
          status = NS_ERROR_FAILURE;
          goto FAIL;
        }
      }
    }
  }

  if (bcc_header && *bcc_header
#ifndef SAVE_BCC_IN_FCC_FILE
      && (mode == MSG_QueueForLater || mode == MSG_SaveAsDraft ||
          mode == MSG_SaveAsTemplate)
#endif
    )
  {
    char *convBcc;
    convBcc = nsMsgI18NEncodeMimePartIIStr(bcc_header, true,
                    mCompFields->GetCharacterSet(), sizeof("BCC: "),
                    nsMsgMIMEGetConformToStandard());

    int32_t L = strlen(convBcc ? convBcc : bcc_header) + 20;
    char *buf = (char *) PR_Malloc (L);
    if (!buf)
    {
      status = NS_ERROR_OUT_OF_MEMORY;
      goto FAIL;
    }

    PR_snprintf(buf, L-1, "BCC: %s" CRLF, convBcc ? convBcc : bcc_header);
    uint32_t   len = strlen(buf);
    rv = tempOutfile->Write(buf, len, &n);
    PR_Free(buf);
    PR_Free(convBcc);
    if (NS_FAILED(rv) || n != len)
    {
      status = NS_ERROR_FAILURE;
      goto FAIL;
    }
  }

  //
  // Write out the X-Mozilla-News-Host header.
  // This is done only when writing to the queue file, not the FCC file.
  // We need this to complement the "Newsgroups" header for the case of
  // queueing a message for a non-default news host.
  //
  // Convert a URL like "snews://host:123/" to the form "host:123/secure"
  // or "news://user@host:222" to simply "host:222".
  //
  if ((mode == nsMsgQueueForLater || mode == nsMsgSaveAsDraft ||
       mode == nsMsgSaveAsTemplate || mode == nsMsgDeliverBackground) &&
      news_url && *news_url)
  {
    bool secure_p = (news_url[0] == 's' || news_url[0] == 'S');
    char *orig_hap = nsMsgParseURLHost (news_url);
    char *host_and_port = orig_hap;
    if (host_and_port)
    {
      // There may be authinfo at the front of the host - it could be of
      // the form "user:password@host:port", so take off everything before
      // the first at-sign.  We don't want to store authinfo in the queue
      // folder, I guess, but would want it to be re-prompted-for at
      // delivery-time.
      //
      char *at = PL_strchr (host_and_port, '@');
      if (at)
        host_and_port = at + 1;
    }

    if ((host_and_port && *host_and_port) || !secure_p)
    {
      char *line = PR_smprintf(X_MOZILLA_NEWSHOST ": %s%s" CRLF,
                   host_and_port ? host_and_port : "",
                   secure_p ? "/secure" : "");
      PR_FREEIF(orig_hap);
      if (!line)
      {
        status = NS_ERROR_OUT_OF_MEMORY;
        goto FAIL;
      }

      uint32_t   len = PL_strlen(line);
      rv = tempOutfile->Write(line, len, &n);
      PR_Free(line);
      if (NS_FAILED(rv) || n != len)
      {
        status = NS_ERROR_FAILURE;
        goto FAIL;
      }
    }

    PR_Free(orig_hap);
  }

  //
  // Read from the message file, and write to the FCC or Queue file.
  // There are two tricky parts: the first is that the message file
  // uses CRLF, and the FCC file should use LINEBREAK.  The second
  // is that the message file may have lines beginning with "From "
  // but the FCC file must have those lines mangled.
  //
  // It's unfortunate that we end up writing the FCC file a line
  // at a time, but it's the easiest way...
  //
  uint64_t available;
  rv = inputFile->Available(&available);
  NS_ENSURE_SUCCESS(rv, rv);
  while (available > 0)
  {
    // check *ibuffer in case that ibuffer isn't big enough
    uint32_t readCount;
    rv = inputFile->Read(ibuffer, ibuffer_size, &readCount);
    if (NS_FAILED(rv) || readCount == 0 || *ibuffer == 0)
    {
      status = NS_ERROR_FAILURE;
      goto FAIL;
    }

    rv = tempOutfile->Write(ibuffer, readCount, &n);
    if (NS_FAILED(rv) || n != readCount) // write failed
    {
      status = NS_MSG_ERROR_WRITING_FILE;
      goto FAIL;
    }

    rv = inputFile->Available(&available);
    NS_ENSURE_SUCCESS(rv, rv);
  }

FAIL:
  PR_Free(ibuffer);
  if (obuffer != ibuffer)
    PR_Free(obuffer);


  if (NS_FAILED(tempOutfile->Flush()))
    status = NS_MSG_ERROR_WRITING_FILE;

  tempOutfile->Close();

  if (inputFile)
    inputFile->Close();


  // here we should clone mCopyFile, since it has changed on disk.
  nsCOMPtr <nsIFile> clonedFile;
  mCopyFile->Clone(getter_AddRefs(clonedFile));
  mCopyFile = clonedFile;

  // When we get here, we have to see if we have been successful so far.
  // If we have, then we should start up the async copy service operation.
  // If we weren't successful, then we should just return the error and
  // bail out.
  if (NS_SUCCEEDED(status))
  {
    // If we are here, time to start the async copy service operation!
    status = StartMessageCopyOperation(mCopyFile, mode, turi);
  }
  return status;
}

//
// This is pretty much a wrapper to the functionality that lives in the
// nsMsgCopy class
//
nsresult
nsMsgComposeAndSend::StartMessageCopyOperation(nsIFile          *aFile,
                                               nsMsgDeliverMode mode,
                                               const nsCString& dest_uri)
{
  mCopyObj = new nsMsgCopy();
  if (!mCopyObj)
    return NS_ERROR_OUT_OF_MEMORY;

  //
  // Actually, we need to pick up the proper folder from the prefs and not
  // default to the default "Flagged" folder choices
  //
  nsresult    rv;
  if (!dest_uri.IsEmpty())
    m_folderName = dest_uri;
  else
    GetFolderURIFromUserPrefs(mode, mUserIdentity, m_folderName);

  if (mListener)
    mListener->OnGetDraftFolderURI(m_folderName.get());

  rv = mCopyObj->StartCopyOperation(mUserIdentity, aFile, mode,
                                    this, m_folderName.get(), mMsgToReplace);
  return rv;
}

//I'm getting this each time without holding onto the feedback so that 3 pane windows can be closed
//without any chance of crashing due to holding onto a deleted feedback.
nsresult
nsMsgComposeAndSend::SetStatusMessage(const nsString &aMsgString)
{
  if (mSendProgress)
    mSendProgress->OnStatusChange(nullptr, nullptr, NS_OK, aMsgString.get());
  return NS_OK;
}

// For GUI notification...
nsresult
nsMsgComposeAndSend::SetGUINotificationState(bool aEnableFlag)
{
  mGUINotificationEnabled = aEnableFlag;
  return NS_OK;
}

/* readonly attribute nsIMsgSendReport sendReport; */
NS_IMETHODIMP
nsMsgComposeAndSend::GetSendReport(nsIMsgSendReport * *aSendReport)
{
  NS_ENSURE_ARG_POINTER(aSendReport);
  NS_IF_ADDREF(*aSendReport = mSendReport);
  return NS_OK;
}

nsresult nsMsgComposeAndSend::Abort()
{
  uint32_t i;
  nsresult rv;

  if (mAbortInProcess)
    return NS_OK;

  mAbortInProcess = true;

  if (m_plaintext)
    rv = m_plaintext->Abort();

  for (i = 0; i < m_attachment_count; i ++)
  {
    nsMsgAttachmentHandler *ma = m_attachments[i];
    if (ma)
      rv = ma->Abort();
  }

  /* stop the current running url */
  if (mRunningRequest)
  {
    mRunningRequest->Cancel(NS_ERROR_ABORT);
    mRunningRequest = nullptr;
  }

  if (mCopyObj)
  {
    nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    copyService->NotifyCompletion(mCopyFile, mCopyObj->mDstFolder, NS_ERROR_ABORT);
  }
  mAbortInProcess = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetProcessAttachmentsSynchronously(bool *_retval)
{
  NS_ENSURE_ARG(_retval);
  *_retval = m_be_synchronous_p;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetAttachmentHandlers(nsTArray<nsRefPtr<nsMsgAttachmentHandler>> **_retval)
{
  NS_ENSURE_ARG(_retval);
  *_retval = &m_attachments;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetAttachmentCount(uint32_t *aAttachmentCount)
{
  NS_ENSURE_ARG(aAttachmentCount);
  *aAttachmentCount = m_attachment_count;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetPendingAttachmentCount(uint32_t *aPendingAttachmentCount)
{
  NS_ENSURE_ARG(aPendingAttachmentCount);
  *aPendingAttachmentCount = m_attachment_pending_count;
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeAndSend::SetPendingAttachmentCount(uint32_t aPendingAttachmentCount)
{
  m_attachment_pending_count = aPendingAttachmentCount;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetDeliveryMode(nsMsgDeliverMode *aDeliveryMode)
{
  NS_ENSURE_ARG(aDeliveryMode);
  *aDeliveryMode = m_deliver_mode;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetProgress(nsIMsgProgress **_retval)
{
  NS_ENSURE_ARG(_retval);
  NS_IF_ADDREF(*_retval = mSendProgress);
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetOutputStream(nsIOutputStream **_retval)
{
  NS_ENSURE_ARG(_retval);
  NS_IF_ADDREF(*_retval = mOutputFile);
  return NS_OK;
}


/* [noscript] attribute nsIURI runningURL; */
NS_IMETHODIMP nsMsgComposeAndSend::GetRunningRequest(nsIRequest **request)
{
  NS_ENSURE_ARG(request);
  NS_IF_ADDREF(*request = mRunningRequest);
  return NS_OK;
}
NS_IMETHODIMP nsMsgComposeAndSend::SetRunningRequest(nsIRequest *request)
{
  mRunningRequest = request;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetStatus(nsresult *aStatus)
{
  NS_ENSURE_ARG(aStatus);
  *aStatus = m_status;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::SetStatus(nsresult aStatus)
{
  m_status = aStatus;
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::GetCryptoclosure(nsIMsgComposeSecure ** aCryptoclosure)
{
  NS_ENSURE_ARG(aCryptoclosure);
  NS_IF_ADDREF(*aCryptoclosure = m_crypto_closure);
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeAndSend::SetCryptoclosure(nsIMsgComposeSecure * aCryptoclosure)
{
  m_crypto_closure = aCryptoclosure;
  return NS_OK;
}

NS_IMPL_ISUPPORTS1(nsMsgAttachmentData, nsIMsgAttachmentData)

nsMsgAttachmentData::nsMsgAttachmentData() :  m_size(0), m_isExternalAttachment(0),
  m_isDownloaded(false), m_hasFilename(false), m_displayableInline(false)
{
}

nsMsgAttachmentData::~nsMsgAttachmentData()
{
}

NS_IMETHODIMP nsMsgAttachmentData::GetUrl(nsIURI **aUrl)
{
  NS_ENSURE_ARG_POINTER(aUrl);
  NS_IF_ADDREF(*aUrl = m_url);
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::SetUrl(nsIURI *aUrl)
{
  m_url = aUrl;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::GetDesiredType(nsACString &aDesiredType)
{
  aDesiredType = m_desiredType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::SetDesiredType(const nsACString &aDesiredType)
{
  m_desiredType = aDesiredType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::GetRealType(nsACString &aRealType)
{
  aRealType = m_realType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::SetRealType(const nsACString &aRealType)
{
  m_realType = aRealType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::GetRealEncoding(nsACString &aRealEncoding)
{
  aRealEncoding = m_realEncoding;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::SetRealEncoding(const nsACString &aRealEncoding)
{
  m_realEncoding = aRealEncoding;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::GetRealName(nsACString &aRealName)
{
  aRealName = m_realName;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::SetRealName(const nsACString &aRealName)
{
  m_realName = aRealName;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::GetDescription(nsACString &aDescription)
{
  aDescription = m_description;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::SetDescription(const nsACString &aDescription)
{
  m_description = aDescription;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::GetXMacType(nsACString & aXMacType)
{
  aXMacType = m_xMacType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::SetXMacType(const nsACString & aXMacType)
{
  m_xMacType = aXMacType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::GetXMacCreator(nsACString & aXMacCreator)
{
  aXMacCreator = m_xMacCreator;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachmentData::SetXMacCreator(const nsACString & aXMacCreator)
{
  m_xMacCreator = aXMacCreator;
  return NS_OK;
}

NS_IMPL_ISUPPORTS1(nsMsgAttachedFile, nsIMsgAttachedFile)

nsMsgAttachedFile::nsMsgAttachedFile() :  m_size(0), m_unprintableCount(0),
  m_highbitCount(0), m_ctlCount(0), m_nullCount(0), m_maxLineLength(0)
{
}

nsMsgAttachedFile::~nsMsgAttachedFile()
{
}

NS_IMETHODIMP nsMsgAttachedFile::GetOrigUrl(nsIURI **aOrigUrl)
{
  NS_ENSURE_ARG_POINTER(aOrigUrl);
  NS_IF_ADDREF(*aOrigUrl = m_origUrl);
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetOrigUrl(nsIURI *aOrigUrl)
{
  m_origUrl = aOrigUrl;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetTmpFile(nsIFile **aTmpFile)
{
  NS_ENSURE_ARG_POINTER(aTmpFile);
  NS_IF_ADDREF(*aTmpFile = m_tmpFile);
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetTmpFile(nsIFile *aTmpFile)
{
  m_tmpFile = aTmpFile;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetType(nsACString &aType)
{
  aType = m_type;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetType(const nsACString &aType)
{
  m_type = aType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetEncoding(nsACString &aEncoding)
{
  aEncoding = m_encoding;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetEncoding(const nsACString &aEncoding)
{
  m_encoding = aEncoding;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetDescription(nsACString &aDescription)
{
  aDescription = m_description;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetDescription(const nsACString &aDescription)
{
  m_description = aDescription;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetCloudPartInfo(nsACString &aCloudPartInfo)
{
  aCloudPartInfo = m_cloudPartInfo;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetCloudPartInfo(const nsACString &aCloudPartInfo)
{
  m_cloudPartInfo = aCloudPartInfo;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetXMacType(nsACString & aXMacType)
{
  aXMacType = m_xMacType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetXMacType(const nsACString & aXMacType)
{
  m_xMacType = aXMacType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetXMacCreator(nsACString & aXMacCreator)
{
  aXMacCreator = m_xMacCreator;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetXMacCreator(const nsACString & aXMacCreator)
{
  m_xMacCreator = aXMacCreator;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetRealName(nsACString & aRealName)
{
  aRealName = m_realName;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetRealName(const nsACString & aRealName)
{
  m_realName = aRealName;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetSize(uint32_t *aSize)
{
  NS_ENSURE_ARG_POINTER(aSize);
  *aSize = m_size;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetSize(uint32_t aSize)
{
  m_size = aSize;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetUnprintableCount(uint32_t *aUnprintableCount)
{
  NS_ENSURE_ARG_POINTER(aUnprintableCount);
  *aUnprintableCount = m_unprintableCount;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetUnprintableCount(uint32_t aUnprintableCount)
{
  m_unprintableCount = aUnprintableCount;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetHighbitCount(uint32_t *aHighbitCount)
{
  NS_ENSURE_ARG_POINTER(aHighbitCount);
  *aHighbitCount = m_highbitCount;
  return NS_OK;
}
NS_IMETHODIMP nsMsgAttachedFile::SetHighbitCount(uint32_t aHighbitCount)
{
  m_highbitCount = aHighbitCount;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetCtlCount(uint32_t *aCtlCount)
{
  NS_ENSURE_ARG_POINTER(aCtlCount);
  *aCtlCount = m_ctlCount;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetCtlCount(uint32_t aCtlCount)
{
  m_ctlCount = aCtlCount;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetNullCount(uint32_t *aNullCount)
{
  NS_ENSURE_ARG_POINTER(aNullCount);
  *aNullCount = m_nullCount;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetNullCount(uint32_t aNullCount)
{
  m_nullCount = aNullCount;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::GetMaxLineLength(uint32_t *aMaxLineLength)
{
  NS_ENSURE_ARG_POINTER(aMaxLineLength);
  *aMaxLineLength = m_maxLineLength;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachedFile::SetMaxLineLength(uint32_t aMaxLineLength)
{
  m_maxLineLength = aMaxLineLength;
  return NS_OK;
}
