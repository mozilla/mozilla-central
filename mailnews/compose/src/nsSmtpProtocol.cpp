/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifdef MOZ_LOGGING
// sorry, this has to be before the pre-compiled header
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

#include "msgCore.h"
#include "nsSmtpProtocol.h"
#include "nscore.h"
#include "nsIStreamListener.h"
#include "nsIInputStream.h"
#include "nsIOutputStream.h"
#include "nsISocketTransport.h"
#include "nsIMsgHeaderParser.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsIPrompt.h"
#include "nsIAuthPrompt.h"
#include "nsStringGlue.h"
#include "nsTextFormatter.h"
#include "nsIMsgIdentity.h"
#include "nsISmtpServer.h"
#include "prtime.h"
#include "prlog.h"
#include "prerror.h"
#include "prprf.h"
#include "prmem.h"
#include "plbase64.h"
#include "prnetdb.h"
#include "prsystem.h"
#include "nsMsgUtils.h"
#include "nsIPipe.h"
#include "nsNetUtil.h"
#include "nsIPrefService.h"
#include "nsISSLSocketControl.h"
#include "nsComposeStrings.h"
#include "nsIStringBundle.h"
#include "nsMsgCompUtils.h"
#include "nsIMsgWindow.h"
#include "MailNewsTypes2.h" // for nsMsgSocketType and nsMsgAuthMethod
#include "nsIIDNService.h"
#include "mozilla/Services.h"
#include "nsINetAddr.h"

#ifndef XP_UNIX
#include <stdarg.h>
#endif /* !XP_UNIX */

#undef PostMessage // avoid to collision with WinUser.h

static PRLogModuleInfo *SMTPLogModule = nullptr;

/* the output_buffer_size must be larger than the largest possible line
 * 2000 seems good for news
 *
 * jwz: I increased this to 4k since it must be big enough to hold the
 * entire button-bar HTML, and with the new "mailto" format, that can
 * contain arbitrarily long header fields like "references".
 *
 * fortezza: proxy auth is huge, buffer increased to 8k (sigh).
 */
#define OUTPUT_BUFFER_SIZE (4096*2)

////////////////////////////////////////////////////////////////////////////////////////////
// TEMPORARY HARD CODED FUNCTIONS
///////////////////////////////////////////////////////////////////////////////////////////

/* based on in NET_ExplainErrorDetails in mkmessag.c */
nsresult nsExplainErrorDetails(nsISmtpUrl * aSmtpUrl, nsresult code, ...)
{
  NS_ENSURE_ARG(aSmtpUrl);

  va_list args;

  nsCOMPtr<nsIPrompt> dialog;
  aSmtpUrl->GetPrompt(getter_AddRefs(dialog));
  NS_ENSURE_TRUE(dialog, NS_ERROR_FAILURE);

  PRUnichar *  msg;
  nsString eMsg;
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
  nsCOMPtr<nsIStringBundle> bundle;
  nsresult rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  va_start (args, code);

  switch (code)
  {
    case NS_ERROR_ILLEGAL_LOCALPART:
      bundle->GetStringFromName(
        NS_LITERAL_STRING("errorIllegalLocalPart").get(),
        getter_Copies(eMsg));
      msg = nsTextFormatter::vsmprintf(eMsg.get(), args);
      break;

      case NS_ERROR_SMTP_SERVER_ERROR:
      case NS_ERROR_TCP_READ_ERROR:
      case NS_ERROR_SMTP_TEMP_SIZE_EXCEEDED:
      case NS_ERROR_SMTP_PERM_SIZE_EXCEEDED_1:
      case NS_ERROR_SMTP_PERM_SIZE_EXCEEDED_2:
      case NS_ERROR_SENDING_FROM_COMMAND:
      case NS_ERROR_SENDING_RCPT_COMMAND:
      case NS_ERROR_SENDING_DATA_COMMAND:
      case NS_ERROR_SENDING_MESSAGE:
      case NS_ERROR_SMTP_GREETING:
         bundle->GetStringFromID(NS_ERROR_GET_CODE(code), getter_Copies(eMsg));
         msg = nsTextFormatter::vsmprintf(eMsg.get(), args);
         break;
      default:
         bundle->GetStringFromID(NS_ERROR_GET_CODE(NS_ERROR_COMMUNICATIONS_ERROR), getter_Copies(eMsg));
         msg = nsTextFormatter::smprintf(eMsg.get(), code);
         break;
  }

  if (msg)
  {
    rv = dialog->Alert(nullptr, msg);
    nsTextFormatter::smprintf_free(msg);
  }

  va_end (args);

  return rv;
}

/* RFC 1891 -- extended smtp value encoding scheme

  5. Additional parameters for RCPT and MAIL commands

     The extended RCPT and MAIL commands are issued by a client when it wishes to request a DSN from the
     server, under certain conditions, for a particular recipient. The extended RCPT and MAIL commands are
     identical to the RCPT and MAIL commands defined in [1], except that one or more of the following parameters
     appear after the sender or recipient address, respectively. The general syntax for extended SMTP commands is
     defined in [4].

     NOTE: Although RFC 822 ABNF is used to describe the syntax of these parameters, they are not, in the
     language of that document, "structured field bodies". Therefore, while parentheses MAY appear within an
     emstp-value, they are not recognized as comment delimiters.

     The syntax for "esmtp-value" in [4] does not allow SP, "=", control characters, or characters outside the
     traditional ASCII range of 1- 127 decimal to be transmitted in an esmtp-value. Because the ENVID and
     ORCPT parameters may need to convey values outside this range, the esmtp-values for these parameters are
     encoded as "xtext". "xtext" is formally defined as follows:

     xtext = *( xchar / hexchar )

     xchar = any ASCII CHAR between "!" (33) and "~" (126) inclusive, except for "+" and "=".

	; "hexchar"s are intended to encode octets that cannot appear
	; as ASCII characters within an esmtp-value.

		 hexchar = ASCII "+" immediately followed by two upper case hexadecimal digits

	When encoding an octet sequence as xtext:

	+ Any ASCII CHAR between "!" and "~" inclusive, except for "+" and "=",
		 MAY be encoded as itself. (A CHAR in this range MAY instead be encoded as a "hexchar", at the
		 implementor's discretion.)

	+ ASCII CHARs that fall outside the range above must be encoded as
		 "hexchar".

 */
/* caller must free the return buffer */
static char *
esmtp_value_encode(char *addr)
{
  char *buffer = (char *) PR_Malloc(512); /* esmtp ORCPT allow up to 500 chars encoded addresses */
  char *bp = buffer, *bpEnd = buffer+500;
  int len, i;

  if (!buffer) return NULL;

  *bp=0;
  if (! addr || *addr == 0) /* this will never happen */
    return buffer;

  for (i=0, len=PL_strlen(addr); i < len && bp < bpEnd; i++)
  {
    if (*addr >= 0x21 &&
      *addr <= 0x7E &&
      *addr != '+' &&
      *addr != '=')
    {
      *bp++ = *addr++;
    }
    else
    {
      PR_snprintf(bp, bpEnd-bp, "+%.2X", ((int)*addr++));
      bp += PL_strlen(bp);
    }
  }
  *bp=0;
  return buffer;
}

////////////////////////////////////////////////////////////////////////////////////////////
// END OF TEMPORARY HARD CODED FUNCTIONS
///////////////////////////////////////////////////////////////////////////////////////////

NS_IMPL_ADDREF_INHERITED(nsSmtpProtocol, nsMsgAsyncWriteProtocol)
NS_IMPL_RELEASE_INHERITED(nsSmtpProtocol, nsMsgAsyncWriteProtocol)

NS_INTERFACE_MAP_BEGIN(nsSmtpProtocol)
NS_INTERFACE_MAP_END_INHERITING(nsMsgAsyncWriteProtocol)

nsSmtpProtocol::nsSmtpProtocol(nsIURI * aURL)
    : nsMsgAsyncWriteProtocol(aURL)
{
}

nsSmtpProtocol::~nsSmtpProtocol()
{
  // free our local state
  PR_Free(m_addressCopy);
  PR_Free(m_dataBuf);
  delete m_lineStreamBuffer;
}

void nsSmtpProtocol::Initialize(nsIURI * aURL)
{
    NS_PRECONDITION(aURL, "invalid URL passed into Smtp Protocol");
    nsresult rv = NS_OK;

    m_flags = 0;
    m_prefAuthMethods = 0;
    m_failedAuthMethods = 0;
    m_currentAuthMethod = 0;
    m_usernamePrompted = false;
    m_prefSocketType = nsMsgSocketType::trySTARTTLS;
    m_tlsInitiated = false;

    m_urlErrorState = NS_ERROR_FAILURE;

    if (!SMTPLogModule)
        SMTPLogModule = PR_NewLogModule("SMTP");

    if (aURL)
        m_runningURL = do_QueryInterface(aURL);

    // extract out message feedback if there is any.
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aURL);
    if (mailnewsUrl)
        mailnewsUrl->GetStatusFeedback(getter_AddRefs(m_statusFeedback));

    m_dataBuf = (char *) PR_Malloc(sizeof(char) * OUTPUT_BUFFER_SIZE);
    m_dataBufSize = OUTPUT_BUFFER_SIZE;

    m_nextState = SMTP_START_CONNECT;
    m_nextStateAfterResponse = SMTP_START_CONNECT;
    m_responseCode = 0;
    m_previousResponseCode = 0;
    m_continuationResponse = -1;
    m_tlsEnabled = false;
    m_addressCopy = nullptr;
    m_addresses = nullptr;
    m_addressesLeft = 0;

#ifdef UNREADY_CODE
    m_totalAmountWritten = 0;
#endif /* UNREADY_CODE */

    m_sendDone = false;

    m_sizelimit = 0;
    m_totalMessageSize = 0;
    nsCOMPtr<nsIFile> file;
    m_runningURL->GetPostMessageFile(getter_AddRefs(file));
    if (file)
        file->GetFileSize(&m_totalMessageSize);

    m_originalContentLength = 0;
    m_totalAmountRead = 0;

    m_lineStreamBuffer = new nsMsgLineStreamBuffer(OUTPUT_BUFFER_SIZE, true);
    // ** may want to consider caching the server capability to save lots of
    // round trip communication between the client and server
    int32_t authMethod = 0;
    nsCOMPtr<nsISmtpServer> smtpServer;
    m_runningURL->GetSmtpServer(getter_AddRefs(smtpServer));
    if (smtpServer) {
        smtpServer->GetAuthMethod(&authMethod);
        smtpServer->GetSocketType(&m_prefSocketType);
        smtpServer->GetHelloArgument(getter_Copies(m_helloArgument));
    }
    InitPrefAuthMethods(authMethod);

#if defined(PR_LOGGING)
    nsAutoCString hostName;
    aURL->GetAsciiHost(hostName);
    PR_LOG(SMTPLogModule, PR_LOG_ALWAYS, ("SMTP Connecting to: %s", hostName.get()));
#endif

    // When we are making a secure connection, we need to make sure that we
    // pass an interface requestor down to the socket transport so that PSM can
    // retrieve a nsIPrompt instance if needed.
    nsCOMPtr<nsIInterfaceRequestor> callbacks;
    nsCOMPtr<nsISmtpUrl> smtpUrl(do_QueryInterface(aURL));
    if (smtpUrl)
        smtpUrl->GetNotificationCallbacks(getter_AddRefs(callbacks));

    if (m_prefSocketType == nsMsgSocketType::SSL)
        rv = OpenNetworkSocket(aURL, "ssl", callbacks);
    else if (m_prefSocketType != nsMsgSocketType::plain)
    {
        rv = OpenNetworkSocket(aURL, "starttls", callbacks);
        if (NS_FAILED(rv) && m_prefSocketType == nsMsgSocketType::trySTARTTLS)
        {
            m_prefSocketType = nsMsgSocketType::plain;
            rv = OpenNetworkSocket(aURL, nullptr, callbacks);
        }
    }
    else
        rv = OpenNetworkSocket(aURL, nullptr, callbacks);
}

void nsSmtpProtocol::AppendHelloArgument(nsACString& aResult)
{
  nsresult rv;

  // is a custom EHLO/HELO argument configured for the transport to be used?
  if (!m_helloArgument.IsEmpty())
  {
      aResult += m_helloArgument;
  }
  else
  {
      // is a FQDN known for this system?
      char hostName[256];
      PR_GetSystemInfo(PR_SI_HOSTNAME_UNTRUNCATED, hostName, sizeof hostName);
      if ((hostName[0] != '\0') && (strchr(hostName, '.') != NULL))
      {
          nsDependentCString cleanedHostName(hostName);
          // avoid problems with hostnames containing newlines/whitespace
          cleanedHostName.StripWhitespace();
          aResult += cleanedHostName;
      }
      else
      {
          nsCOMPtr<nsINetAddr> iaddr; // IP address for this connection
          // our transport is always a nsISocketTransport
          nsCOMPtr<nsISocketTransport> socketTransport = do_QueryInterface(m_transport);
          // should return the interface ip of the SMTP connection
          // minimum case - see bug 68877 and RFC 2821, chapter 4.1.1.1
          rv = socketTransport->GetScriptableSelfAddr(getter_AddRefs(iaddr));

          if (NS_SUCCEEDED(rv))
          {
              // turn it into a string
              nsCString ipAddressString;
              rv = iaddr->GetAddress(ipAddressString);
              if (NS_SUCCEEDED(rv))
              {
#ifdef DEBUG
                  bool v4mapped = false;
                  iaddr->GetIsV4Mapped(&v4mapped);
                  NS_ASSERTION(!v4mapped,
                               "unexpected IPv4-mapped IPv6 address");
#endif

                  uint16_t family = nsINetAddr::FAMILY_INET;
                  iaddr->GetFamily(&family);

                  if (family == nsINetAddr::FAMILY_INET6) // IPv6 style address?
                      aResult.AppendLiteral("[IPv6:");
                  else
                      aResult.AppendLiteral("[");

                  aResult.Append(ipAddressString);
                  aResult.Append(']');
              }
          }
      }
  }
}

/////////////////////////////////////////////////////////////////////////////////////////////
// we suppport the nsIStreamListener interface
////////////////////////////////////////////////////////////////////////////////////////////

// stop binding is a "notification" informing us that the stream
// associated with aURL is going away.
NS_IMETHODIMP nsSmtpProtocol::OnStopRequest(nsIRequest *request, nsISupports *ctxt,
                                            nsresult aStatus)
{
  bool connDroppedDuringAuth = NS_SUCCEEDED(aStatus) && !m_sendDone &&
      (m_nextStateAfterResponse == SMTP_AUTH_LOGIN_STEP0_RESPONSE ||
       m_nextStateAfterResponse == SMTP_AUTH_LOGIN_RESPONSE);
  // ignore errors handling the QUIT command so fcc can continue.
  if (m_sendDone && NS_FAILED(aStatus))
  {
    PR_LOG(SMTPLogModule, PR_LOG_ALWAYS,
     ("SMTP connection error quitting %lx, ignoring ", aStatus));
    aStatus = NS_OK;
  }
  if (NS_SUCCEEDED(aStatus) && !m_sendDone) {
    // if we are getting OnStopRequest() with NS_OK,
    // but we haven't finished clean, that's spells trouble.
    // it means that the server has dropped us before we could send the whole mail
    // for example, see bug #200647
    PR_LOG(SMTPLogModule, PR_LOG_ALWAYS,
 ("SMTP connection dropped after %ld total bytes read", m_totalAmountRead));
    if (!connDroppedDuringAuth)
      nsMsgAsyncWriteProtocol::OnStopRequest(nullptr, ctxt, NS_ERROR_NET_INTERRUPT);
  }
  else
    nsMsgAsyncWriteProtocol::OnStopRequest(nullptr, ctxt, aStatus);

  // okay, we've been told that the send is done and the connection is going away. So
  // we need to release all of our state
  nsresult rv = nsMsgAsyncWriteProtocol::CloseSocket();
  // If the server dropped the connection when we were expecting
  // a login response, reprompt for password, and if the user asks,
  // retry the url.
  if (connDroppedDuringAuth)
  {
    nsCOMPtr<nsIURI> runningURI = do_QueryInterface(m_runningURL);
    nsresult rv = AuthLoginResponse(nullptr, 0);
    if (NS_FAILED(rv))
      return rv;
    return LoadUrl(runningURI, ctxt);
  }

  return rv;
}

/////////////////////////////////////////////////////////////////////////////////////////////
// End of nsIStreamListenerSupport
//////////////////////////////////////////////////////////////////////////////////////////////

void nsSmtpProtocol::UpdateStatus(int32_t aStatusID)
{
  if (m_statusFeedback)
  {
    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    if (!bundleService) return;
    nsCOMPtr<nsIStringBundle> bundle;
    nsresult rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
    if (NS_FAILED(rv)) return;
    nsString msg;
    bundle->GetStringFromID(aStatusID, getter_Copies(msg));
    UpdateStatusWithString(msg.get());
  }
}

void nsSmtpProtocol::UpdateStatusWithString(const PRUnichar * aStatusString)
{
  if (m_statusFeedback && aStatusString)
    m_statusFeedback->ShowStatusString(nsDependentString(aStatusString));
}

/////////////////////////////////////////////////////////////////////////////////////////////
// Begin protocol state machine functions...
//////////////////////////////////////////////////////////////////////////////////////////////

/*
 * gets the response code from the SMTP server and the
 * response line
 */
nsresult nsSmtpProtocol::SmtpResponse(nsIInputStream * inputStream, uint32_t length)
{
  char * line = nullptr;
  char cont_char;
  uint32_t ln = 0;
  bool pauseForMoreData = false;

  if (!m_lineStreamBuffer)
    // this will force an error and at least we won't crash
    return NS_ERROR_NULL_POINTER;

  line = m_lineStreamBuffer->ReadNextLine(inputStream, ln, pauseForMoreData);

  if (pauseForMoreData || !line)
  {
    SetFlag(SMTP_PAUSE_FOR_READ); /* pause */
    PR_Free(line);
    return NS_OK;
  }

  m_totalAmountRead += ln;

  PR_LOG(SMTPLogModule, PR_LOG_ALWAYS, ("SMTP Response: %s", line));
  cont_char = ' '; /* default */
  // sscanf() doesn't update m_responseCode if line doesn't start
  // with a number. That can be dangerous. So be sure to set
  // m_responseCode to 0 if no items read.
  if (PR_sscanf(line, "%d%c", &m_responseCode, &cont_char) <= 0)
    m_responseCode = 0;

  if (m_continuationResponse == -1)
  {
    if (cont_char == '-')  /* begin continuation */
      m_continuationResponse = m_responseCode;

    // display the whole message if no valid response code or
    // message shorter than 4 chars
    m_responseText = (m_responseCode >= 100 && PL_strlen(line) > 3) ? line + 4 : line;
  }
  else
  { /* have to continue */
    if (m_continuationResponse == m_responseCode && cont_char == ' ')
      m_continuationResponse = -1;    /* ended */

    if (m_responseText.IsEmpty() || m_responseText.Last() != '\n')
      m_responseText += "\n";

    m_responseText += (PL_strlen(line) > 3) ? line + 4 : line;
  }

  if (m_responseCode == 220 && m_responseText.Length() && !m_tlsInitiated &&
     !m_sendDone)
    m_nextStateAfterResponse = SMTP_EXTN_LOGIN_RESPONSE;

  if (m_continuationResponse == -1)  /* all done with this response? */
  {
    m_nextState = m_nextStateAfterResponse;
    ClearFlag(SMTP_PAUSE_FOR_READ); /* don't pause */
  }

  PR_Free(line);
  return NS_OK;
}

nsresult nsSmtpProtocol::ExtensionLoginResponse(nsIInputStream * inputStream, uint32_t length)
{
  nsresult status = NS_OK;

  if (m_responseCode != 220)
  {
#ifdef DEBUG
    nsresult rv =
#endif
    nsExplainErrorDetails(m_runningURL, NS_ERROR_SMTP_GREETING,
                          m_responseText.get());
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain SMTP error");

    m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
    return NS_ERROR_SMTP_AUTH_FAILURE;
  }

  nsAutoCString buffer("EHLO ");
  AppendHelloArgument(buffer);
  buffer += CRLF;

  status = SendData(buffer.get());

  m_nextState = SMTP_RESPONSE;
  m_nextStateAfterResponse = SMTP_SEND_EHLO_RESPONSE;
  SetFlag(SMTP_PAUSE_FOR_READ);

  return(status);
}

nsresult nsSmtpProtocol::SendHeloResponse(nsIInputStream * inputStream, uint32_t length)
{
  nsresult status = NS_OK;
  nsAutoCString buffer;
  nsresult rv;

  if (m_responseCode != 250)
  {
#ifdef DEBUG
    rv =
#endif
    nsExplainErrorDetails(m_runningURL, NS_ERROR_SMTP_SERVER_ERROR,
                          m_responseText.get());
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain SMTP error");

    m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
    return NS_ERROR_SMTP_AUTH_FAILURE;
  }

  // check if we're just verifying the ability to logon
  nsCOMPtr<nsISmtpUrl> smtpUrl = do_QueryInterface(m_runningURL, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  bool verifyingLogon = false;
  smtpUrl->GetVerifyLogon(&verifyingLogon);
  if (verifyingLogon)
    return SendQuit();

  // extract the email address from the identity
  nsCString emailAddress;
  nsCOMPtr <nsIMsgIdentity> senderIdentity;
  rv = m_runningURL->GetSenderIdentity(getter_AddRefs(senderIdentity));
  if (NS_FAILED(rv) || !senderIdentity)
  {
    m_urlErrorState = NS_ERROR_COULD_NOT_GET_USERS_MAIL_ADDRESS;
    return(NS_ERROR_COULD_NOT_GET_USERS_MAIL_ADDRESS);
  }
  senderIdentity->GetEmail(emailAddress);

  if (emailAddress.IsEmpty())
  {
    m_urlErrorState = NS_ERROR_COULD_NOT_GET_USERS_MAIL_ADDRESS;
    return(NS_ERROR_COULD_NOT_GET_USERS_MAIL_ADDRESS);
  }

  nsCOMPtr<nsIMsgHeaderParser> parser = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID);
  nsCString fullAddress;
  if (parser)
  {
    // pass nullptr for the name, since we just want the email.
    //
    // seems a little weird that we are passing in the emailAddress
    // when that's the out parameter
    parser->MakeFullAddressString(nullptr, emailAddress.get(),
                                  getter_Copies(fullAddress));
  }

  buffer = "MAIL FROM:<";
  buffer += fullAddress;
  buffer += ">";

  if (TestFlag(SMTP_EHLO_DSN_ENABLED))
  {
    bool requestDSN = false;
    rv = m_runningURL->GetRequestDSN(&requestDSN);

    if (requestDSN)
    {
      nsCOMPtr <nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv,rv);

      nsCOMPtr<nsIPrefBranch> prefBranch;
      rv = prefs->GetBranch(nullptr, getter_AddRefs(prefBranch));
      NS_ENSURE_SUCCESS(rv,rv);

      bool requestRetFull = false;
      rv = prefBranch->GetBoolPref("mail.dsn.ret_full_on", &requestRetFull);

      buffer += requestRetFull ? " RET=FULL" : " RET=HDRS";

      nsCString dsnEnvid;

      // get the envid from the smtpUrl
      rv = m_runningURL->GetDsnEnvid(dsnEnvid);

      if (dsnEnvid.IsEmpty())
          dsnEnvid.Adopt(msg_generate_message_id(senderIdentity));

      buffer += " ENVID=";
      buffer += dsnEnvid;
    }
  }

  if(TestFlag(SMTP_EHLO_SIZE_ENABLED))
  {
    buffer.Append(" SIZE=");
    buffer.AppendInt(m_totalMessageSize);
  }
  buffer += CRLF;

  status = SendData(buffer.get());

  m_nextState = SMTP_RESPONSE;


  m_nextStateAfterResponse = SMTP_SEND_MAIL_RESPONSE;
  SetFlag(SMTP_PAUSE_FOR_READ);

  return(status);
}

nsresult nsSmtpProtocol::SendEhloResponse(nsIInputStream * inputStream, uint32_t length)
{
    nsresult status = NS_OK;

    if (m_responseCode != 250)
    {
        /* EHLO must not be implemented by the server, so fall back to the HELO case
         * if command is unrecognized or unimplemented.
         */
        if (m_responseCode == 500 || m_responseCode == 502)
        {
            /* If STARTTLS is requested by the user, EHLO is required to advertise it.
             * But only if TLS handshake is not already accomplished.
             */
            if (m_prefSocketType == nsMsgSocketType::alwaysSTARTTLS &&
                !m_tlsEnabled)
            {
                m_nextState = SMTP_ERROR_DONE;
                m_urlErrorState = NS_ERROR_STARTTLS_FAILED_EHLO_STARTTLS;
                return(NS_ERROR_STARTTLS_FAILED_EHLO_STARTTLS);
            }

            nsAutoCString buffer("HELO ");
            AppendHelloArgument(buffer);
            buffer += CRLF;

            status = SendData(buffer.get());

            m_nextState = SMTP_RESPONSE;
            m_nextStateAfterResponse = SMTP_SEND_HELO_RESPONSE;
            SetFlag(SMTP_PAUSE_FOR_READ);
            return (status);
        }
        /* e.g. getting 421 "Server says unauthorized, bye" or
         * 501 "Syntax error in EHLOs parameters or arguments"
         */
        else
        {
#ifdef DEBUG
            nsresult rv =
#endif
            nsExplainErrorDetails(m_runningURL, NS_ERROR_SMTP_SERVER_ERROR,
                                  m_responseText.get());
            NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain SMTP error");

            m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
            return NS_ERROR_SMTP_AUTH_FAILURE;
        }
    }

    int32_t responseLength = m_responseText.Length();
    int32_t startPos = 0;
    int32_t endPos;
    do
    {
        endPos = m_responseText.FindChar('\n', startPos + 1);
        nsAutoCString responseLine;
        responseLine.Assign(Substring(m_responseText, startPos,
            (endPos >= 0 ? endPos : responseLength) - startPos));

        MsgCompressWhitespace(responseLine);
        if (responseLine.LowerCaseEqualsLiteral("starttls"))
        {
            SetFlag(SMTP_EHLO_STARTTLS_ENABLED);
        }
        else if (responseLine.LowerCaseEqualsLiteral("dsn"))
        {
            SetFlag(SMTP_EHLO_DSN_ENABLED);
        }
        else if (StringBeginsWith(responseLine, NS_LITERAL_CSTRING("AUTH"), nsCaseInsensitiveCStringComparator()))
        {
          SetFlag(SMTP_AUTH);

          if (responseLine.Find(NS_LITERAL_CSTRING("GSSAPI"),
                                CaseInsensitiveCompare) >= 0)
            SetFlag(SMTP_AUTH_GSSAPI_ENABLED);

          if (responseLine.Find(NS_LITERAL_CSTRING("CRAM-MD5"),
                                CaseInsensitiveCompare) >= 0)
            SetFlag(SMTP_AUTH_CRAM_MD5_ENABLED);

          if (responseLine.Find(NS_LITERAL_CSTRING("NTLM"),
                                CaseInsensitiveCompare) >= 0)
            SetFlag(SMTP_AUTH_NTLM_ENABLED);

          if (responseLine.Find(NS_LITERAL_CSTRING("MSN"),
                                CaseInsensitiveCompare) >= 0)
            SetFlag(SMTP_AUTH_MSN_ENABLED);

          if (responseLine.Find(NS_LITERAL_CSTRING("PLAIN"),
                                CaseInsensitiveCompare) >= 0)
            SetFlag(SMTP_AUTH_PLAIN_ENABLED);

          if (responseLine.Find(NS_LITERAL_CSTRING("LOGIN"),
                                CaseInsensitiveCompare) >= 0)
            SetFlag(SMTP_AUTH_LOGIN_ENABLED);

          if (responseLine.Find(NS_LITERAL_CSTRING("EXTERNAL"),
                                CaseInsensitiveCompare) >= 0)
            SetFlag(SMTP_AUTH_EXTERNAL_ENABLED);
        }
        else if (StringBeginsWith(responseLine, NS_LITERAL_CSTRING("SIZE"), nsCaseInsensitiveCStringComparator()))
        {
            SetFlag(SMTP_EHLO_SIZE_ENABLED);

            m_sizelimit = atol((responseLine.get()) + 4);
        }

        startPos = endPos + 1;
    } while (endPos >= 0);

    if (TestFlag(SMTP_EHLO_SIZE_ENABLED) &&
       m_sizelimit > 0 && (int32_t)m_totalMessageSize > m_sizelimit)
    {
#ifdef DEBUG
        nsresult rv =
#endif
        nsExplainErrorDetails(m_runningURL,
                      NS_ERROR_SMTP_PERM_SIZE_EXCEEDED_1, m_sizelimit);
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain SMTP error");

        m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
        return(NS_ERROR_SENDING_FROM_COMMAND);
    }

    m_nextState = SMTP_AUTH_PROCESS_STATE;
    return status;
}


nsresult nsSmtpProtocol::SendTLSResponse()
{
  // only tear down our existing connection and open a new one if we received a 220 response
  // from the smtp server after we issued the STARTTLS
  nsresult rv = NS_OK;
  if (m_responseCode == 220)
  {
      nsCOMPtr<nsISupports> secInfo;
      nsCOMPtr<nsISocketTransport> strans = do_QueryInterface(m_transport, &rv);
      if (NS_FAILED(rv)) return rv;

      rv = strans->GetSecurityInfo(getter_AddRefs(secInfo));

      if (NS_SUCCEEDED(rv) && secInfo) {
          nsCOMPtr<nsISSLSocketControl> sslControl = do_QueryInterface(secInfo, &rv);

          if (NS_SUCCEEDED(rv) && sslControl)
              rv = sslControl->StartTLS();
      }

      if (NS_SUCCEEDED(rv))
      {
          m_nextState = SMTP_EXTN_LOGIN_RESPONSE;
          m_nextStateAfterResponse = SMTP_EXTN_LOGIN_RESPONSE;
          m_tlsEnabled = true;
          m_flags = 0; // resetting the flags
          return rv;
      }
  }

  ClearFlag(SMTP_EHLO_STARTTLS_ENABLED);
  m_tlsInitiated = false;
  m_nextState = SMTP_AUTH_PROCESS_STATE;

  return rv;
}

void nsSmtpProtocol::InitPrefAuthMethods(int32_t authMethodPrefValue)
{
  // for m_prefAuthMethods, using the same flags as server capablities.
  switch (authMethodPrefValue)
  {
    case nsMsgAuthMethod::none:
      m_prefAuthMethods = SMTP_AUTH_NONE_ENABLED;
      break;
    //case nsMsgAuthMethod::old -- no such thing for SMTP
    case nsMsgAuthMethod::passwordCleartext:
      m_prefAuthMethods = SMTP_AUTH_LOGIN_ENABLED |
        SMTP_AUTH_PLAIN_ENABLED;
      break;
    case nsMsgAuthMethod::passwordEncrypted:
      m_prefAuthMethods = SMTP_AUTH_CRAM_MD5_ENABLED;
      break;
    case nsMsgAuthMethod::NTLM:
      m_prefAuthMethods = SMTP_AUTH_NTLM_ENABLED |
          SMTP_AUTH_MSN_ENABLED;
      break;
    case nsMsgAuthMethod::GSSAPI:
      m_prefAuthMethods = SMTP_AUTH_GSSAPI_ENABLED;
      break;
    case nsMsgAuthMethod::secure:
      m_prefAuthMethods = SMTP_AUTH_CRAM_MD5_ENABLED |
          SMTP_AUTH_GSSAPI_ENABLED |
          SMTP_AUTH_NTLM_ENABLED | SMTP_AUTH_MSN_ENABLED |
          SMTP_AUTH_EXTERNAL_ENABLED; // TODO: Expose EXTERNAL? How?
      break;
    default:
      NS_ASSERTION(false, "SMTP: authMethod pref invalid");
      // TODO log to error console
      PR_LOG(SMTPLogModule, PR_LOG_ERROR,
          ("SMTP: bad pref authMethod = %d\n", authMethodPrefValue));
      // fall to any
    case nsMsgAuthMethod::anything:
      m_prefAuthMethods =
          SMTP_AUTH_LOGIN_ENABLED | SMTP_AUTH_PLAIN_ENABLED |
          SMTP_AUTH_CRAM_MD5_ENABLED | SMTP_AUTH_GSSAPI_ENABLED |
          SMTP_AUTH_NTLM_ENABLED | SMTP_AUTH_MSN_ENABLED |
          SMTP_AUTH_EXTERNAL_ENABLED;
      break;
  }
  NS_ASSERTION(m_prefAuthMethods != 0, "SMTP:InitPrefAuthMethods() failed");
}

/**
 * Changes m_currentAuthMethod to pick the next-best one
 * which is allowed by server and prefs and not marked failed.
 * The order of preference and trying of auth methods is encoded here.
 */
nsresult nsSmtpProtocol::ChooseAuthMethod()
{
  int32_t serverCaps = m_flags; // from nsMsgProtocol::TestFlag()
  int32_t availCaps = serverCaps & m_prefAuthMethods & ~m_failedAuthMethods;

  PR_LOG(SMTPLogModule, PR_LOG_DEBUG,
        ("SMTP auth: server caps 0x%X, pref 0x%X, failed 0x%X, avail caps 0x%X",
        serverCaps, m_prefAuthMethods, m_failedAuthMethods, availCaps));
  PR_LOG(SMTPLogModule, PR_LOG_DEBUG,
        ("(GSSAPI = 0x%X, CRAM = 0x%X, NTLM = 0x%X, "
        "MSN =  0x%X, PLAIN = 0x%X, LOGIN = 0x%X, EXTERNAL = 0x%X)",
        SMTP_AUTH_GSSAPI_ENABLED, SMTP_AUTH_CRAM_MD5_ENABLED,
        SMTP_AUTH_NTLM_ENABLED, SMTP_AUTH_MSN_ENABLED, SMTP_AUTH_PLAIN_ENABLED,
        SMTP_AUTH_LOGIN_ENABLED, SMTP_AUTH_EXTERNAL_ENABLED));

  if (SMTP_AUTH_GSSAPI_ENABLED & availCaps)
    m_currentAuthMethod = SMTP_AUTH_GSSAPI_ENABLED;
  else if (SMTP_AUTH_CRAM_MD5_ENABLED & availCaps)
    m_currentAuthMethod = SMTP_AUTH_CRAM_MD5_ENABLED;
  else if (SMTP_AUTH_NTLM_ENABLED & availCaps)
    m_currentAuthMethod = SMTP_AUTH_NTLM_ENABLED;
  else if (SMTP_AUTH_MSN_ENABLED & availCaps)
    m_currentAuthMethod = SMTP_AUTH_MSN_ENABLED;
  else if (SMTP_AUTH_PLAIN_ENABLED & availCaps)
    m_currentAuthMethod = SMTP_AUTH_PLAIN_ENABLED;
  else if (SMTP_AUTH_LOGIN_ENABLED & availCaps)
    m_currentAuthMethod = SMTP_AUTH_LOGIN_ENABLED;
  else if (SMTP_AUTH_EXTERNAL_ENABLED & availCaps)
    m_currentAuthMethod = SMTP_AUTH_EXTERNAL_ENABLED;
  else
  {
    PR_LOG(SMTPLogModule, PR_LOG_ERROR, ("no auth method remaining"));
    m_currentAuthMethod = 0;
    return NS_ERROR_SMTP_AUTH_FAILURE;
  }
  PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("trying auth method 0x%X", m_currentAuthMethod));
  return NS_OK;
}

void nsSmtpProtocol::MarkAuthMethodAsFailed(int32_t failedAuthMethod)
{
  PR_LOG(SMTPLogModule, PR_LOG_DEBUG,
      ("marking auth method 0x%X failed", failedAuthMethod));
  m_failedAuthMethods |= failedAuthMethod;
}

/**
 * Start over, trying all auth methods again
 */
void nsSmtpProtocol::ResetAuthMethods()
{
  m_currentAuthMethod = 0;
  m_failedAuthMethods = 0;
}

nsresult nsSmtpProtocol::ProcessAuth()
{
    nsresult status = NS_OK;
    nsAutoCString buffer;

    if (!m_tlsEnabled)
    {
        if (TestFlag(SMTP_EHLO_STARTTLS_ENABLED))
        {
            // Do not try to combine SMTPS with STARTTLS.
            // If nsMsgSocketType::SSL is set,
            // we are alrady using a secure connection.
            // Do not attempt to do STARTTLS,
            // even if server offers it.
            if (m_prefSocketType == nsMsgSocketType::trySTARTTLS ||
                m_prefSocketType == nsMsgSocketType::alwaysSTARTTLS)
            {
                buffer = "STARTTLS";
                buffer += CRLF;

                status = SendData(buffer.get());

                m_tlsInitiated = true;

                m_nextState = SMTP_RESPONSE;
                m_nextStateAfterResponse = SMTP_TLS_RESPONSE;
                SetFlag(SMTP_PAUSE_FOR_READ);
                return status;
            }
        }
        else if (m_prefSocketType == nsMsgSocketType::alwaysSTARTTLS)
        {
            m_nextState = SMTP_ERROR_DONE;
            m_urlErrorState = NS_ERROR_STARTTLS_FAILED_EHLO_STARTTLS;
            return NS_ERROR_STARTTLS_FAILED_EHLO_STARTTLS;
        }
    }
  // (wrong indention until here)

  (void) ChooseAuthMethod(); // advance m_currentAuthMethod

   // We don't need to auth, per pref, or the server doesn't advertise AUTH,
  // so skip auth and try to send message.
  if (m_prefAuthMethods == SMTP_AUTH_NONE_ENABLED || !TestFlag(SMTP_AUTH))
  {
    m_nextState = SMTP_SEND_HELO_RESPONSE;
    // fake to 250 because SendHeloResponse() tests for this
    m_responseCode = 250;
  }
  else if (m_currentAuthMethod == SMTP_AUTH_EXTERNAL_ENABLED)
  {
    buffer = "AUTH EXTERNAL =";
    buffer += CRLF;
    SendData(buffer.get());
    m_nextState = SMTP_RESPONSE;
    m_nextStateAfterResponse = SMTP_AUTH_EXTERNAL_RESPONSE;
    SetFlag(SMTP_PAUSE_FOR_READ);
    return NS_OK;
  }
  else if (m_currentAuthMethod == SMTP_AUTH_GSSAPI_ENABLED)
  {
    m_nextState = SMTP_SEND_AUTH_GSSAPI_FIRST;
  }
  else if (m_currentAuthMethod == SMTP_AUTH_CRAM_MD5_ENABLED ||
           m_currentAuthMethod == SMTP_AUTH_PLAIN_ENABLED ||
           m_currentAuthMethod == SMTP_AUTH_NTLM_ENABLED)
  {
    m_nextState = SMTP_SEND_AUTH_LOGIN_STEP1;
  }
  else if (m_currentAuthMethod == SMTP_AUTH_LOGIN_ENABLED ||
           m_currentAuthMethod == SMTP_AUTH_MSN_ENABLED)
  {
    m_nextState = SMTP_SEND_AUTH_LOGIN_STEP0;
  }
  else // All auth methods failed
  {
    // show an appropriate error msg
    if (m_failedAuthMethods == 0)
    {
      // we didn't even try anything, so we had a non-working config:
      // pref doesn't match server
      PR_LOG(SMTPLogModule, PR_LOG_ERROR,
          ("no working auth mech - pref doesn't match server capas"));

      // pref has encrypted pw & server claims to support plaintext pw
      if (m_prefAuthMethods == SMTP_AUTH_CRAM_MD5_ENABLED &&
          m_flags & (SMTP_AUTH_LOGIN_ENABLED | SMTP_AUTH_PLAIN_ENABLED))
      {
        // have SSL
        if (m_prefSocketType == nsMsgSocketType::SSL ||
            m_prefSocketType == nsMsgSocketType::alwaysSTARTTLS)
          // tell user to change to plaintext pw
          m_urlErrorState = NS_ERROR_SMTP_AUTH_CHANGE_ENCRYPT_TO_PLAIN_SSL;
        else
          // tell user to change to plaintext pw, with big warning
          m_urlErrorState = NS_ERROR_SMTP_AUTH_CHANGE_ENCRYPT_TO_PLAIN_NO_SSL;
      }
      // pref has plaintext pw & server claims to support encrypted pw
      else if (m_prefAuthMethods == (SMTP_AUTH_LOGIN_ENABLED |
                   SMTP_AUTH_PLAIN_ENABLED) &&
               m_flags & SMTP_AUTH_CRAM_MD5_ENABLED)
        // tell user to change to encrypted pw
        m_urlErrorState = NS_ERROR_SMTP_AUTH_CHANGE_PLAIN_TO_ENCRYPT;
      else
      {
        // just "change auth method"
        m_urlErrorState = NS_ERROR_SMTP_AUTH_MECH_NOT_SUPPORTED;
      }
    }
    else if (m_failedAuthMethods == SMTP_AUTH_GSSAPI_ENABLED)
    {
      // We have only GSSAPI, and it failed, so nothing left to do.
      PR_LOG(SMTPLogModule, PR_LOG_ERROR, ("GSSAPI only and it failed"));
      m_urlErrorState = NS_ERROR_SMTP_AUTH_GSSAPI;
    }
    else
    {
      // we tried to login, but it all failed
      PR_LOG(SMTPLogModule, PR_LOG_ERROR, ("All auth attempts failed"));
      m_urlErrorState = NS_ERROR_SMTP_AUTH_FAILURE;
    }
    m_nextState = SMTP_ERROR_DONE;
    return NS_ERROR_SMTP_AUTH_FAILURE;
  }

  return NS_OK;
}



nsresult nsSmtpProtocol::AuthLoginResponse(nsIInputStream * stream, uint32_t length)
{
  PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("SMTP Login response, code %d", m_responseCode));
  nsresult status = NS_OK;

  switch (m_responseCode/100)
  {
    case 2:
      m_nextState = SMTP_SEND_HELO_RESPONSE;
      // fake to 250 because SendHeloResponse() tests for this
      m_responseCode = 250;
      break;
    case 3:
      m_nextState = SMTP_SEND_AUTH_LOGIN_STEP2;
      break;
    case 5:
    default:
      nsCOMPtr<nsISmtpServer> smtpServer;
      m_runningURL->GetSmtpServer(getter_AddRefs(smtpServer));
      if (smtpServer)
      {
        // If one authentication failed, mark it failed, so that we're going to
        // fall back on a less secure login method.
        MarkAuthMethodAsFailed(m_currentAuthMethod);

        bool allFailed = NS_FAILED(ChooseAuthMethod());
        if (allFailed && m_failedAuthMethods > 0 &&
            m_failedAuthMethods != SMTP_AUTH_GSSAPI_ENABLED &&
            m_failedAuthMethods != SMTP_AUTH_EXTERNAL_ENABLED)
        {
          // We've tried all avail. methods, and they all failed, and we have no mechanism left.
          // Ask user to try with a new password.
          PR_LOG(SMTPLogModule, PR_LOG_WARN,
              ("SMTP: ask user what to do (after login failed): new password, retry or cancel"));

          nsCOMPtr<nsISmtpServer> smtpServer;
          nsresult rv = m_runningURL->GetSmtpServer(getter_AddRefs(smtpServer));
          NS_ENSURE_SUCCESS(rv, rv);

          nsCString hostname;
          rv = smtpServer->GetHostname(hostname);
          NS_ENSURE_SUCCESS(rv, rv);

          int32_t buttonPressed = 1;
          if (NS_SUCCEEDED(MsgPromptLoginFailed(nullptr, hostname,
                                                &buttonPressed)))
          {
            if (buttonPressed == 1) // Cancel button
            {
              PR_LOG(SMTPLogModule, PR_LOG_WARN, ("cancel button pressed"));
              // abort and get out of here
              status = NS_ERROR_ABORT;
              break;
            }
            else if (buttonPressed == 2) // 'New password' button
            {
              PR_LOG(SMTPLogModule, PR_LOG_WARN, ("new password button pressed"));
              // Change password was pressed. For now, forget the stored
              // password and we'll prompt for a new one next time around.
              smtpServer->ForgetPassword();
              if (m_usernamePrompted)
                smtpServer->SetUsername(EmptyCString());

              // Let's restore the original auth flags from SendEhloResponse
              // so we can try them again with new password and username
              ResetAuthMethods();
              // except for GSSAPI and EXTERNAL, which don't care about passwords.
              MarkAuthMethodAsFailed(SMTP_AUTH_GSSAPI_ENABLED);
              MarkAuthMethodAsFailed(SMTP_AUTH_EXTERNAL_ENABLED);
            }
            else if (buttonPressed == 0) // Retry button
            {
              PR_LOG(SMTPLogModule, PR_LOG_WARN, ("retry button pressed"));
              // try all again, including GSSAPI
              ResetAuthMethods();
            }
          }
        }
        PR_LOG(SMTPLogModule, PR_LOG_ERROR,
            ("SMTP: login failed: failed %X, current %X", m_failedAuthMethods, m_currentAuthMethod));

        m_nextState = SMTP_AUTH_PROCESS_STATE; // try auth (ProcessAuth()) again, with other method
      }
      else
          status = NS_ERROR_SMTP_PASSWORD_UNDEFINED;
      break;
  }

  return (status);
}

nsresult nsSmtpProtocol::AuthGSSAPIFirst()
{
  NS_ASSERTION(m_currentAuthMethod == SMTP_AUTH_GSSAPI_ENABLED, "called in invalid state");
  nsAutoCString command("AUTH GSSAPI ");
  nsAutoCString resp;
  nsAutoCString service("smtp@");
  nsCString hostName;
  nsCString userName;
  nsresult rv;
  nsCOMPtr<nsISmtpServer> smtpServer;
  rv = m_runningURL->GetSmtpServer(getter_AddRefs(smtpServer));
  if (NS_FAILED(rv))
    return NS_ERROR_FAILURE;

  rv = smtpServer->GetUsername(userName);
  if (NS_FAILED(rv))
    return NS_ERROR_FAILURE;

  rv = smtpServer->GetHostname(hostName);
  if (NS_FAILED(rv))
    return NS_ERROR_FAILURE;
  service.Append(hostName);
  PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("SMTP: GSSAPI step 1 for user %s at server %s, service %s",
      userName.get(), hostName.get(), service.get()));

  rv = DoGSSAPIStep1(service.get(), userName.get(), resp);
  if (NS_FAILED(rv))
  {
    PR_LOG(SMTPLogModule, PR_LOG_ERROR, ("SMTP: GSSAPI step 1 failed early"));
    MarkAuthMethodAsFailed(SMTP_AUTH_GSSAPI_ENABLED);
    m_nextState = SMTP_AUTH_PROCESS_STATE;
    return NS_OK;
  }
  else
    command.Append(resp);
  command.Append(CRLF);
  m_nextState = SMTP_RESPONSE;
  m_nextStateAfterResponse = SMTP_SEND_AUTH_GSSAPI_STEP;
  SetFlag(SMTP_PAUSE_FOR_READ);
  return SendData(command.get());
}

// GSSAPI may consist of multiple round trips

nsresult nsSmtpProtocol::AuthGSSAPIStep()
{
  PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("SMTP: GSSAPI auth step 2"));
  NS_ASSERTION(m_currentAuthMethod == SMTP_AUTH_GSSAPI_ENABLED, "called in invalid state");
  nsresult rv;
  nsAutoCString cmd;

  // Check to see what the server said
  if (m_responseCode / 100 != 3) {
    m_nextState = SMTP_AUTH_LOGIN_RESPONSE;
    return NS_OK;
  }

  rv = DoGSSAPIStep2(m_responseText, cmd);
  if (NS_FAILED(rv))
    cmd = "*";
  cmd += CRLF;

  m_nextStateAfterResponse = (rv == NS_SUCCESS_AUTH_FINISHED)?SMTP_AUTH_LOGIN_RESPONSE:SMTP_SEND_AUTH_GSSAPI_STEP;
  m_nextState = SMTP_RESPONSE;
  SetFlag(SMTP_PAUSE_FOR_READ);

  return SendData(cmd.get());
}


// LOGIN and MSN consist of three steps (MSN not through the mechanism
// but by non-RFC2821 compliant implementation in MS servers) not two as
// PLAIN or CRAM-MD5, so we've to start here and continue with AuthStep1
// if the server responds with with a 3xx code to "AUTH LOGIN" or "AUTH MSN"
nsresult nsSmtpProtocol::AuthLoginStep0()
{
    NS_ASSERTION(m_currentAuthMethod == SMTP_AUTH_MSN_ENABLED ||
        m_currentAuthMethod == SMTP_AUTH_LOGIN_ENABLED,
        "called in invalid state");
    PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("SMTP: MSN or LOGIN auth, step 0"));
    nsAutoCString command(m_currentAuthMethod == SMTP_AUTH_MSN_ENABLED
        ? "AUTH MSN" CRLF : "AUTH LOGIN" CRLF);
    m_nextState = SMTP_RESPONSE;
    m_nextStateAfterResponse = SMTP_AUTH_LOGIN_STEP0_RESPONSE;
    SetFlag(SMTP_PAUSE_FOR_READ);

    return SendData(command.get());
}

void nsSmtpProtocol::AuthLoginStep0Response()
{
    NS_ASSERTION(m_currentAuthMethod == SMTP_AUTH_MSN_ENABLED ||
        m_currentAuthMethod == SMTP_AUTH_LOGIN_ENABLED,
        "called in invalid state");
    // need the test to be here instead in AuthLoginResponse() to
    // continue with step 1 instead of 2 in case of a code 3xx
    m_nextState = (m_responseCode/100 == 3) ?
                  SMTP_SEND_AUTH_LOGIN_STEP1 : SMTP_AUTH_LOGIN_RESPONSE;
}

nsresult nsSmtpProtocol::AuthLoginStep1()
{
  char buffer[512]; // TODO nsAutoCString
  nsresult rv;
  nsresult status = NS_OK;
  nsCString username;
  char *base64Str = nullptr;
  nsAutoCString password;
  nsCOMPtr<nsISmtpServer> smtpServer;
  rv = m_runningURL->GetSmtpServer(getter_AddRefs(smtpServer));
  if (NS_FAILED(rv)) return NS_ERROR_FAILURE;

  rv = smtpServer->GetUsername(username);
  if (username.IsEmpty())
  {
    rv = GetUsernamePassword(username, password);
    m_usernamePrompted = true;
    if (username.IsEmpty() || password.IsEmpty())
      return NS_ERROR_SMTP_PASSWORD_UNDEFINED;
  }
  PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("SMTP AuthLoginStep1() for %s@%s",
      username.get(), smtpServer.get()));

  GetPassword(password);
  if (password.IsEmpty())
  {
    PR_LOG(SMTPLogModule, PR_LOG_ERROR, ("SMTP: password undefined"));
    m_urlErrorState = NS_ERROR_SMTP_PASSWORD_UNDEFINED;
    return NS_ERROR_SMTP_PASSWORD_UNDEFINED;
  }

  if (m_currentAuthMethod == SMTP_AUTH_CRAM_MD5_ENABLED)
  {
    PR_LOG(SMTPLogModule, PR_LOG_ERROR, ("CRAM auth, step 1"));
    PR_snprintf(buffer, sizeof(buffer), "AUTH CRAM-MD5" CRLF);
  }
  else if (m_currentAuthMethod == SMTP_AUTH_NTLM_ENABLED ||
           m_currentAuthMethod == SMTP_AUTH_MSN_ENABLED)
  {
    PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("NTLM/MSN auth, step 1"));
    nsAutoCString response;
    rv = DoNtlmStep1(username.get(), password.get(), response);
    PR_snprintf(buffer, sizeof(buffer), TestFlag(SMTP_AUTH_NTLM_ENABLED) ?
                                        "AUTH NTLM %.256s" CRLF :
                                        "%.256s" CRLF, response.get());
  }
  else if (m_currentAuthMethod == SMTP_AUTH_PLAIN_ENABLED)
  {
    PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("PLAIN auth"));
    char plain_string[512];
    int len = 1; /* first <NUL> char */

    memset(plain_string, 0, 512);
    PR_snprintf(&plain_string[1], 510, "%s", username.get());
    len += username.Length();
    len++; /* second <NUL> char */
    PR_snprintf(&plain_string[len], 511-len, "%s", password.get());
    len += password.Length();

    base64Str = PL_Base64Encode(plain_string, len, nullptr);
    PR_snprintf(buffer, sizeof(buffer), "AUTH PLAIN %.256s" CRLF, base64Str);
  }
  else if (m_currentAuthMethod == SMTP_AUTH_LOGIN_ENABLED)
  {
    PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("LOGIN auth"));
    base64Str = PL_Base64Encode(username.get(),
        username.Length(), nullptr);
    PR_snprintf(buffer, sizeof(buffer), "%.256s" CRLF, base64Str);
  }
  else
    return (NS_ERROR_COMMUNICATIONS_ERROR);

  status = SendData(buffer, true);
  m_nextState = SMTP_RESPONSE;
  m_nextStateAfterResponse = SMTP_AUTH_LOGIN_RESPONSE;
  SetFlag(SMTP_PAUSE_FOR_READ);
  NS_Free(base64Str);

  return (status);
}

nsresult nsSmtpProtocol::AuthLoginStep2()
{
  /* use cached smtp password first
  * if not then use cached pop password
  * if pop password undefined
  * sync with smtp password
  */
  nsresult status = NS_OK;
  nsresult rv;
  nsAutoCString password;

  GetPassword(password);
  if (password.IsEmpty())
  {
    m_urlErrorState = NS_ERROR_SMTP_PASSWORD_UNDEFINED;
    return NS_ERROR_SMTP_PASSWORD_UNDEFINED;
  }
  PR_LOG(SMTPLogModule, PR_LOG_MAX, ("SMTP AuthLoginStep2"));

  if (!password.IsEmpty())
  {
    char buffer[512];
    if (m_currentAuthMethod == SMTP_AUTH_CRAM_MD5_ENABLED)
    {
      PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("CRAM auth, step 2"));
      unsigned char digest[DIGEST_LENGTH];
      char * decodedChallenge = PL_Base64Decode(m_responseText.get(),
        m_responseText.Length(), nullptr);

      if (decodedChallenge)
        rv = MSGCramMD5(decodedChallenge, strlen(decodedChallenge), password.get(), password.Length(), digest);
      else
        rv = NS_ERROR_FAILURE;

      PR_Free(decodedChallenge);
      if (NS_SUCCEEDED(rv))
      {
        nsAutoCString encodedDigest;
        char hexVal[8];

        for (uint32_t j=0; j<16; j++)
        {
          PR_snprintf (hexVal,8, "%.2x", 0x0ff & (unsigned short)digest[j]);
          encodedDigest.Append(hexVal);
        }

        nsCOMPtr<nsISmtpServer> smtpServer;
        rv = m_runningURL->GetSmtpServer(getter_AddRefs(smtpServer));
        if (NS_FAILED(rv)) return NS_ERROR_FAILURE;

        nsCString userName;
        rv = smtpServer->GetUsername(userName);

        PR_snprintf(buffer, sizeof(buffer), "%s %s", userName.get(), encodedDigest.get());
        char *base64Str = PL_Base64Encode(buffer, strlen(buffer), nullptr);
        PR_snprintf(buffer, sizeof(buffer), "%s" CRLF, base64Str);
        NS_Free(base64Str);
      }
      if (NS_FAILED(rv))
        PR_snprintf(buffer, sizeof(buffer), "*" CRLF);
    }
    else if (m_currentAuthMethod == SMTP_AUTH_NTLM_ENABLED ||
             m_currentAuthMethod == SMTP_AUTH_MSN_ENABLED)
    {
      PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("NTLM/MSN auth, step 2"));
      nsAutoCString response;
      rv = DoNtlmStep2(m_responseText, response);
      PR_snprintf(buffer, sizeof(buffer), "%.256s" CRLF, response.get());
    }
    else if (m_currentAuthMethod == SMTP_AUTH_PLAIN_ENABLED ||
             m_currentAuthMethod == SMTP_AUTH_LOGIN_ENABLED)
    {
      PR_LOG(SMTPLogModule, PR_LOG_DEBUG, ("PLAIN/LOGIN auth, step 2"));
      char *base64Str = PL_Base64Encode(password.get(), password.Length(), nullptr);
      PR_snprintf(buffer, sizeof(buffer), "%.256s" CRLF, base64Str);
      NS_Free(base64Str);
    }
    else
      return NS_ERROR_COMMUNICATIONS_ERROR;

    status = SendData(buffer, true);
    m_nextState = SMTP_RESPONSE;
    m_nextStateAfterResponse = SMTP_AUTH_LOGIN_RESPONSE;
    SetFlag(SMTP_PAUSE_FOR_READ);
    return (status);
  }

  // XXX -1 is not a valid nsresult
  return static_cast<nsresult>(-1);
}


nsresult nsSmtpProtocol::SendMailResponse()
{
  nsresult status = NS_OK;
  nsAutoCString buffer;
  nsresult rv;

  if (m_responseCode/10 != 25)
  {
    nsresult errorcode;
    if (TestFlag(SMTP_EHLO_SIZE_ENABLED))
      errorcode = (m_responseCode == 452) ? NS_ERROR_SMTP_TEMP_SIZE_EXCEEDED :
                  (m_responseCode == 552) ? NS_ERROR_SMTP_PERM_SIZE_EXCEEDED_2 :
                  NS_ERROR_SENDING_FROM_COMMAND;
    else
      errorcode = NS_ERROR_SENDING_FROM_COMMAND;

    rv = nsExplainErrorDetails(m_runningURL, errorcode, m_responseText.get());
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain SMTP error");

    m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
    return(NS_ERROR_SENDING_FROM_COMMAND);
  }

  /* Send the RCPT TO: command */
  bool requestDSN = false;
  rv = m_runningURL->GetRequestDSN(&requestDSN);

  nsCOMPtr <nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIPrefBranch> prefBranch;
  rv = prefs->GetBranch(nullptr, getter_AddRefs(prefBranch));
  NS_ENSURE_SUCCESS(rv,rv);

  bool requestOnSuccess = false;
  rv = prefBranch->GetBoolPref("mail.dsn.request_on_success_on", &requestOnSuccess);

  bool requestOnFailure = false;
  rv = prefBranch->GetBoolPref("mail.dsn.request_on_failure_on", &requestOnFailure);

  bool requestOnDelay = false;
  rv = prefBranch->GetBoolPref("mail.dsn.request_on_delay_on", &requestOnDelay);

  bool requestOnNever = false;
  rv = prefBranch->GetBoolPref("mail.dsn.request_never_on", &requestOnNever);

  if (TestFlag(SMTP_EHLO_DSN_ENABLED) && requestDSN && (requestOnSuccess || requestOnFailure || requestOnDelay || requestOnNever))
    {
      char *encodedAddress = esmtp_value_encode(m_addresses);
      nsAutoCString dsnBuffer;

      if (encodedAddress)
      {
        buffer = "RCPT TO:<";
        buffer += m_addresses;
        buffer += "> NOTIFY=";

        if (requestOnNever)
          dsnBuffer += "NEVER";
        else
        {
          if (requestOnSuccess)
            dsnBuffer += "SUCCESS";

          if (requestOnFailure)
            dsnBuffer += dsnBuffer.IsEmpty() ? "FAILURE" : ",FAILURE";

          if (requestOnDelay)
            dsnBuffer += dsnBuffer.IsEmpty() ? "DELAY" : ",DELAY";
        }

        buffer += dsnBuffer;
        buffer += " ORCPT=rfc822;";
        buffer += encodedAddress;
        buffer += CRLF;
        PR_FREEIF(encodedAddress);
      }
      else
      {
        m_urlErrorState = NS_ERROR_OUT_OF_MEMORY;
        return (NS_ERROR_OUT_OF_MEMORY);
      }
    }
    else
    {
      buffer = "RCPT TO:<";
      buffer += m_addresses;
      buffer += ">";
      buffer += CRLF;
    }
    status = SendData(buffer.get());

    m_nextState = SMTP_RESPONSE;
    m_nextStateAfterResponse = SMTP_SEND_RCPT_RESPONSE;
    SetFlag(SMTP_PAUSE_FOR_READ);

    return(status);
}

nsresult nsSmtpProtocol::SendRecipientResponse()
{
  nsresult status = NS_OK;
  nsAutoCString buffer;
  nsresult rv;

  if (m_responseCode / 10 != 25)
  {
    nsresult errorcode;
    if (TestFlag(SMTP_EHLO_SIZE_ENABLED))
      errorcode = (m_responseCode == 452) ? NS_ERROR_SMTP_TEMP_SIZE_EXCEEDED :
                  (m_responseCode == 552) ? NS_ERROR_SMTP_PERM_SIZE_EXCEEDED_2 :
                  NS_ERROR_SENDING_RCPT_COMMAND;
    else
      errorcode = NS_ERROR_SENDING_RCPT_COMMAND;

    rv = nsExplainErrorDetails(m_runningURL, errorcode,
                               m_responseText.get(), m_addresses);
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain SMTP error");

    m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
    return(NS_ERROR_SENDING_RCPT_COMMAND);
  }

  /* take the address we sent off the list (move the pointer to just
     past the terminating null.) */
  m_addresses += PL_strlen (m_addresses) + 1;
  if (--m_addressesLeft > 0)
  {
    // more senders to RCPT to
    // fake to 250 because SendMailResponse() can't handle 251
    m_responseCode = 250;
    m_nextState = SMTP_SEND_MAIL_RESPONSE;
    return NS_OK;
  }

  /* else send the DATA command */
  buffer = "DATA";
  buffer += CRLF;
  status = SendData(buffer.get());

  m_nextState = SMTP_RESPONSE;
  m_nextStateAfterResponse = SMTP_SEND_DATA_RESPONSE;
  SetFlag(SMTP_PAUSE_FOR_READ);

  return(status);
}


nsresult nsSmtpProtocol::SendData(const char *dataBuffer, bool aSuppressLogging)
{
  // XXX -1 is not a valid nsresult
  if (!dataBuffer) return static_cast<nsresult>(-1);

  if (!aSuppressLogging) {
      PR_LOG(SMTPLogModule, PR_LOG_ALWAYS, ("SMTP Send: %s", dataBuffer));
  } else {
      PR_LOG(SMTPLogModule, PR_LOG_ALWAYS, ("Logging suppressed for this command (it probably contained authentication information)"));
  }
  return nsMsgAsyncWriteProtocol::SendData(dataBuffer);
}


nsresult nsSmtpProtocol::SendDataResponse()
{
  nsresult status = NS_OK;
  char *command = nullptr;

  if (m_responseCode != 354)
  {
    nsresult rv = nsExplainErrorDetails(m_runningURL, NS_ERROR_SENDING_DATA_COMMAND, m_responseText.get());
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain SMTP error");

    m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
    return(NS_ERROR_SENDING_DATA_COMMAND);
  }

  PR_FREEIF(command);

  m_nextState = SMTP_SEND_POST_DATA;
  ClearFlag(SMTP_PAUSE_FOR_READ);   /* send data directly */

  UpdateStatus(SMTP_DELIV_MAIL);

  {
//      m_runningURL->GetBodySize(&m_totalMessageSize);
  }
  return(status);
}

void nsSmtpProtocol::SendMessageInFile()
{
  nsCOMPtr<nsIFile> file;
  nsCOMPtr<nsIURI> url = do_QueryInterface(m_runningURL);
  m_runningURL->GetPostMessageFile(getter_AddRefs(file));
  if (url && file)
    // need to fully qualify to avoid getting overwritten by a #define
    // in some windows header file
    nsMsgAsyncWriteProtocol::PostMessage(url, file);

  SetFlag(SMTP_PAUSE_FOR_READ);

  // for now, we are always done at this point..we aren't making multiple calls
  // to post data...

  UpdateStatus(SMTP_DELIV_MAIL);
  m_nextState = SMTP_RESPONSE;
  m_nextStateAfterResponse = SMTP_SEND_MESSAGE_RESPONSE;
}

void nsSmtpProtocol::SendPostData()
{
	// mscott: as a first pass, I'm writing everything at once and am not
	// doing it in chunks...

	/* returns 0 on done and negative on error
	 * positive if it needs to continue.
	 */

	// check to see if url is a file..if it is...call our file handler...
	bool postMessageInFile = true;
	m_runningURL->GetPostMessage(&postMessageInFile);
	if (postMessageInFile)
	{
		SendMessageInFile();
	}

	/* Update the thermo and the status bar.  This is done by hand, rather
	   than using the FE_GraphProgress* functions, because there seems to be
	   no way to make FE_GraphProgress shut up and not display anything more
	   when all the data has arrived.  At the end, we want to show the
	   "message sent; waiting for reply" status; FE_GraphProgress gets in
	   the way of that.  See bug #23414. */
}



nsresult nsSmtpProtocol::SendMessageResponse()
{
  if((m_responseCode/10 != 25))
  {
    nsresult rv = nsExplainErrorDetails(m_runningURL, NS_ERROR_SENDING_MESSAGE, m_responseText.get());
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain SMTP error");

    m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
    return(NS_ERROR_SENDING_MESSAGE);
  }

  UpdateStatus(SMTP_PROGRESS_MAILSENT);

  /* else */
  return SendQuit();
}

nsresult nsSmtpProtocol::SendQuit(SmtpState aNextStateAfterResponse)
{
  m_sendDone = true;
  m_nextState = SMTP_RESPONSE;
  m_nextStateAfterResponse = aNextStateAfterResponse;

  return SendData("QUIT" CRLF); // send a quit command to close the connection with the server.
}

nsresult nsSmtpProtocol::LoadUrl(nsIURI * aURL, nsISupports * aConsumer )
{
  if (!aURL)
    return NS_OK;

  Initialize(aURL);

  m_continuationResponse = -1;  /* init */
  m_runningURL = do_QueryInterface(aURL);
  if (!m_runningURL)
    return NS_ERROR_FAILURE;

  // we had a bug where we failed to bring up an alert if the host
  // name was empty....so throw up an alert saying we don't have
  // a host name and inform the caller that we are not going to
  // run the url...
  nsAutoCString hostName;
  aURL->GetHost(hostName);
  if (hostName.IsEmpty())
  {
    nsCOMPtr <nsIMsgMailNewsUrl> aMsgUrl = do_QueryInterface(aURL);
    if (aMsgUrl)
    {
      aMsgUrl->SetUrlState(true, NS_OK);
      // set the url as a url currently being run...
      aMsgUrl->SetUrlState(false /* we aren't running the url */,
                           NS_ERROR_SMTP_AUTH_FAILURE);
    }
    return NS_ERROR_BUT_DONT_SHOW_ALERT;
  }

  bool postMessage = false;
  m_runningURL->GetPostMessage(&postMessage);

  if (postMessage)
  {
    m_nextState = SMTP_RESPONSE;
    m_nextStateAfterResponse = SMTP_EXTN_LOGIN_RESPONSE;

    nsCOMPtr<nsIMsgHeaderParser> parser =
      do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID);
    if (parser)
    {
      // compile a minimal list of valid target addresses by
      // - looking only at mailboxes
      // - dropping addresses with invalid localparts (until we implement RfC 5336)
      // - using ACE for IDN domainparts
      // - stripping duplicates
      nsCString addresses;
      m_runningURL->GetRecipients(getter_Copies(addresses));

      nsCString mailboxes;
      parser->ExtractHeaderAddressMailboxes(addresses, mailboxes);

      nsCOMPtr<nsIIDNService> converter = do_GetService(NS_IDNSERVICE_CONTRACTID);
      addresses.Truncate();
      const char *i = mailboxes.get();
      const char *start = i;           // first character of the current address
      const char *lastAt = nullptr;    // last @ character in the current address
      const char *firstEvil = nullptr; // first illegal character in the current address
      bool done = !*i;
      while (!done)
      {
        done = !*i; // eos?
        if (done || *i == ',')
        {
          // validate the just parsed address
          if (firstEvil)
          {
            // Fortunately, we will always have an @ in each mailbox address.
            // We try to fix illegal character in the domain part by converting
            // that to ACE. Illegal characters in the local part are not fixable
            // (which charset would it be anyway?), hence we error out in that
            // case as well.
            nsresult rv = NS_ERROR_FAILURE; // anything but NS_OK
            if (lastAt && firstEvil > lastAt)
            {
              // illegal char in the domain part, hence use ACE
              nsAutoCString domain;
              domain.Assign(lastAt + 1, i - lastAt - 1);
              rv = converter->ConvertUTF8toACE(domain, domain);
              if (NS_SUCCEEDED(rv))
              {
                addresses.Append(start, lastAt - start + 1);
                addresses.Append(domain);
                if (!done)
                  addresses.Append(',');
              }
            }
            if (NS_FAILED(rv))
            {
              // throw an error, including the broken address
              m_nextState = SMTP_ERROR_DONE;
              ClearFlag(SMTP_PAUSE_FOR_READ);
              addresses.Assign(start, i - start + 1);
              // Unfortunately, nsExplainErrorDetails will show the error above
              // the mailnews main window, because we don't necessarily get
              // passed down a compose window - we might be sending in the
              // background!
              rv = nsExplainErrorDetails(m_runningURL, NS_ERROR_ILLEGAL_LOCALPART, addresses.get());
              NS_ASSERTION(NS_SUCCEEDED(rv), "failed to explain illegal localpart");
              m_urlErrorState = NS_ERROR_BUT_DONT_SHOW_ALERT;
              return NS_ERROR_BUT_DONT_SHOW_ALERT;
            }
          }
          else
          {
            // no invalid characters, so just copy the address
            addresses.Append(start, i - start + 1);
          }
          // reset parsing
          start = i + 1;
          lastAt = nullptr;
          firstEvil = nullptr;
        }
        else if (*i == '@')
        {
          // always remember the last one
          lastAt = i;
        }
        else if (!firstEvil)
        {
          // check for first illegal character
          // strictly adhering to RfC 5322, we deny everything but 0x09,0x20-0x7e
          if ((*i < ' ' || *i > '~') && (*i != '\t'))
            firstEvil = i;
        }
        ++i;
      }

      // final cleanup
      nsCString addrs1;
      char *addrs2 = nullptr;
      m_addressesLeft = 0;
      parser->RemoveDuplicateAddresses(addresses, EmptyCString(), addrs1);
      if (!addrs1.IsEmpty())
        parser->ParseHeaderAddresses(addrs1.get(), nullptr, &addrs2, &m_addressesLeft);

      // hmm no addresses to send message to...
      if (m_addressesLeft == 0 || !addrs2)
      {
        m_nextState = SMTP_ERROR_DONE;
        ClearFlag(SMTP_PAUSE_FOR_READ);
        m_urlErrorState = NS_MSG_NO_RECIPIENTS;
        return NS_MSG_NO_RECIPIENTS;
      }

      m_addressCopy = addrs2; // zero-delimited list of mailboxes
      m_addresses = m_addressCopy;
    } // if parser
  } // if post message

  return nsMsgProtocol::LoadUrl(aURL, aConsumer);
}

/*
 * returns negative if the transfer is finished or error'd out
 *
 * returns zero or more if the transfer needs to be continued.
 */
nsresult nsSmtpProtocol::ProcessProtocolState(nsIURI * url, nsIInputStream * inputStream,
                                              uint64_t sourceOffset, uint32_t length)
 {
   nsresult status = NS_OK;
   ClearFlag(SMTP_PAUSE_FOR_READ); /* already paused; reset */

   while(!TestFlag(SMTP_PAUSE_FOR_READ))
   {
     PR_LOG(SMTPLogModule, PR_LOG_ALWAYS, ("SMTP entering state: %d",
       m_nextState));
     switch(m_nextState)
     {
     case SMTP_RESPONSE:
       if (inputStream == nullptr)
         SetFlag(SMTP_PAUSE_FOR_READ);
       else
         status = SmtpResponse(inputStream, length);
       break;

     case SMTP_START_CONNECT:
       SetFlag(SMTP_PAUSE_FOR_READ);
       m_nextState = SMTP_RESPONSE;
       m_nextStateAfterResponse = SMTP_EXTN_LOGIN_RESPONSE;
       break;
     case SMTP_FINISH_CONNECT:
       SetFlag(SMTP_PAUSE_FOR_READ);
       break;
     case SMTP_TLS_RESPONSE:
       if (inputStream == nullptr)
         SetFlag(SMTP_PAUSE_FOR_READ);
       else
         status = SendTLSResponse();
       break;
     case SMTP_EXTN_LOGIN_RESPONSE:
       if (inputStream == nullptr)
         SetFlag(SMTP_PAUSE_FOR_READ);
       else
         status = ExtensionLoginResponse(inputStream, length);
       break;

     case SMTP_SEND_HELO_RESPONSE:
       if (inputStream == nullptr)
         SetFlag(SMTP_PAUSE_FOR_READ);
       else
         status = SendHeloResponse(inputStream, length);
       break;
     case SMTP_SEND_EHLO_RESPONSE:
       if (inputStream == nullptr)
         SetFlag(SMTP_PAUSE_FOR_READ);
       else
         status = SendEhloResponse(inputStream, length);
       break;
     case SMTP_AUTH_PROCESS_STATE:
       status = ProcessAuth();
       break;

      case SMTP_SEND_AUTH_GSSAPI_FIRST:
        status = AuthGSSAPIFirst();
        break;

      case SMTP_SEND_AUTH_GSSAPI_STEP:
        status = AuthGSSAPIStep();
        break;

      case SMTP_SEND_AUTH_LOGIN_STEP0:
        status = AuthLoginStep0();
        break;

      case SMTP_AUTH_LOGIN_STEP0_RESPONSE:
        AuthLoginStep0Response();
        status = NS_OK;
        break;

      case SMTP_AUTH_EXTERNAL_RESPONSE:
      case SMTP_AUTH_LOGIN_RESPONSE:
        if (inputStream == nullptr)
          SetFlag(SMTP_PAUSE_FOR_READ);
        else
          status = AuthLoginResponse(inputStream, length);
        break;

      case SMTP_SEND_AUTH_LOGIN_STEP1:
        status = AuthLoginStep1();
        break;

      case SMTP_SEND_AUTH_LOGIN_STEP2:
        status = AuthLoginStep2();
        break;


      case SMTP_SEND_MAIL_RESPONSE:
        if (inputStream == nullptr)
          SetFlag(SMTP_PAUSE_FOR_READ);
        else
          status = SendMailResponse();
        break;

      case SMTP_SEND_RCPT_RESPONSE:
        if (inputStream == nullptr)
          SetFlag(SMTP_PAUSE_FOR_READ);
        else
          status = SendRecipientResponse();
        break;

      case SMTP_SEND_DATA_RESPONSE:
        if (inputStream == nullptr)
          SetFlag(SMTP_PAUSE_FOR_READ);
        else
          status = SendDataResponse();
        break;

      case SMTP_SEND_POST_DATA:
        SendPostData();
        status = NS_OK;
        break;

      case SMTP_SEND_MESSAGE_RESPONSE:
        if (inputStream == nullptr)
          SetFlag(SMTP_PAUSE_FOR_READ);
        else
          status = SendMessageResponse();
        break;
      case SMTP_DONE:
        {
          nsCOMPtr <nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(m_runningURL);
          mailNewsUrl->SetUrlState(false, NS_OK);
        }

        m_nextState = SMTP_FREE;
        break;

      case SMTP_ERROR_DONE:
        {
          nsCOMPtr <nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(m_runningURL);
          // propagate the right error code
          mailNewsUrl->SetUrlState(false, m_urlErrorState);
        }

        m_nextState = SMTP_FREE;
        break;

      case SMTP_FREE:
        // smtp is a one time use connection so kill it if we get here...
        nsMsgAsyncWriteProtocol::CloseSocket();
        return NS_OK; /* final end */

      default: /* should never happen !!! */
        m_nextState = SMTP_ERROR_DONE;
        break;
    }

    /* check for errors during load and call error
    * state if found
    */
    if (NS_FAILED(status) && m_nextState != SMTP_FREE) {
      // send a quit command to close the connection with the server.
      if (NS_FAILED(SendQuit(SMTP_ERROR_DONE)))
      {
        m_nextState = SMTP_ERROR_DONE;
        // Don't exit - loop around again and do the free case
        ClearFlag(SMTP_PAUSE_FOR_READ);
      }
    }
  } /* while(!SMTP_PAUSE_FOR_READ) */

  return NS_OK;
}

nsresult
nsSmtpProtocol::GetPassword(nsCString &aPassword)
{
    nsresult rv;
    nsCOMPtr<nsISmtpUrl> smtpUrl = do_QueryInterface(m_runningURL, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsISmtpServer> smtpServer;
    rv = smtpUrl->GetSmtpServer(getter_AddRefs(smtpServer));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = smtpServer->GetPassword(aPassword);
    NS_ENSURE_SUCCESS(rv,rv);

    if (!aPassword.IsEmpty())
        return rv;
    // empty password

    nsCOMPtr <nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsIPrefBranch> prefBranch;
    rv = prefs->GetBranch(nullptr, getter_AddRefs(prefBranch));
    NS_ENSURE_SUCCESS(rv,rv);

    nsCString username;
    rv = smtpServer->GetUsername(username);
    NS_ENSURE_SUCCESS(rv, rv);

    NS_ConvertASCIItoUTF16 usernameUTF16(username);

    nsCString hostname;
    rv = smtpServer->GetHostname(hostname);
    NS_ENSURE_SUCCESS(rv, rv);

    nsAutoString hostnameUTF16;
    CopyASCIItoUTF16(hostname, hostnameUTF16);

    const PRUnichar *formatStrings[] =
    {
      hostnameUTF16.get(),
      usernameUTF16.get()
    };

    rv = PromptForPassword(smtpServer, smtpUrl, formatStrings, aPassword);
    NS_ENSURE_SUCCESS(rv,rv);
    return rv;
}

/**
 * formatStrings is an array for the prompts, item 0 is the hostname, item 1
 * is the username.
 */
nsresult
nsSmtpProtocol::PromptForPassword(nsISmtpServer *aSmtpServer, nsISmtpUrl *aSmtpUrl, const PRUnichar **formatStrings, nsACString &aPassword)
{
  nsCOMPtr<nsIStringBundleService> stringService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(stringService, NS_ERROR_UNEXPECTED);

  nsCOMPtr<nsIStringBundle> composeStringBundle;
  nsresult rv = stringService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(composeStringBundle));
  NS_ENSURE_SUCCESS(rv,rv);

  nsString passwordPromptString;
  if(formatStrings[1])
    rv = composeStringBundle->FormatStringFromName(
      NS_LITERAL_STRING("smtpEnterPasswordPromptWithUsername").get(),
      formatStrings, 2, getter_Copies(passwordPromptString));
  else
    rv = composeStringBundle->FormatStringFromName(
      NS_LITERAL_STRING("smtpEnterPasswordPrompt").get(),
      formatStrings, 1, getter_Copies(passwordPromptString));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAuthPrompt> netPrompt;
  rv = aSmtpUrl->GetAuthPrompt(getter_AddRefs(netPrompt));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString passwordTitle;
  rv = composeStringBundle->GetStringFromName(
    NS_LITERAL_STRING("smtpEnterPasswordPromptTitle").get(),
    getter_Copies(passwordTitle));
  NS_ENSURE_SUCCESS(rv,rv);

  rv = aSmtpServer->GetPasswordWithUI(passwordPromptString.get(), passwordTitle.get(),
    netPrompt, aPassword);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

nsresult
nsSmtpProtocol::GetUsernamePassword(nsACString &aUsername,
                                    nsACString &aPassword)
{
    nsresult rv;
    nsCOMPtr<nsISmtpUrl> smtpUrl = do_QueryInterface(m_runningURL, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsISmtpServer> smtpServer;
    rv = smtpUrl->GetSmtpServer(getter_AddRefs(smtpServer));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = smtpServer->GetPassword(aPassword);
    NS_ENSURE_SUCCESS(rv,rv);

    if (!aPassword.IsEmpty())
    {
        rv = smtpServer->GetUsername(aUsername);
        NS_ENSURE_SUCCESS(rv,rv);

        if (!aUsername.IsEmpty())
          return rv;
    }
    // empty password

    aPassword.Truncate();

    nsCString hostname;
    rv = smtpServer->GetHostname(hostname);
    NS_ENSURE_SUCCESS(rv, rv);

    const PRUnichar *formatStrings[] =
    {
      NS_ConvertASCIItoUTF16(hostname).get(),
      nullptr
    };

    rv = PromptForPassword(smtpServer, smtpUrl, formatStrings, aPassword);
    NS_ENSURE_SUCCESS(rv,rv);
    return rv;
}

