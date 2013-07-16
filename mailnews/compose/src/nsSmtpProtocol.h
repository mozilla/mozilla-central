/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsSmtpProtocol_h___
#define nsSmtpProtocol_h___

#include "mozilla/Attributes.h"
#include "nsMsgProtocol.h"
#include "nsIStreamListener.h"
#include "nsISmtpUrl.h"
#include "nsIMsgStatusFeedback.h"
#include "nsMsgLineBuffer.h"
#include "nsIAuthModule.h"
#include "MailNewsTypes2.h" // for nsMsgSocketType

#include "nsCOMPtr.h"

 /* states of the machine
 */
typedef enum _SmtpState {
SMTP_RESPONSE = 0,                                  // 0
SMTP_START_CONNECT,                                 // 1
SMTP_FINISH_CONNECT,                                // 2
SMTP_SEND_HELO_RESPONSE,                            // 3
SMTP_SEND_EHLO_RESPONSE,                            // 4
SMTP_SEND_MAIL_RESPONSE,                            // 5
SMTP_SEND_RCPT_RESPONSE,                            // 6
SMTP_SEND_DATA_RESPONSE,                            // 7
SMTP_SEND_POST_DATA,                                // 8
SMTP_SEND_MESSAGE_RESPONSE,                         // 9
SMTP_DONE,                                          // 10
SMTP_ERROR_DONE,                                    // 11
SMTP_FREE,                                          // 12
SMTP_AUTH_LOGIN_STEP0_RESPONSE,                     // 13
SMTP_EXTN_LOGIN_RESPONSE,                           // 14
SMTP_SEND_AUTH_LOGIN_STEP0,                         // 15
SMTP_SEND_AUTH_LOGIN_STEP1,                         // 16
SMTP_SEND_AUTH_LOGIN_STEP2,                         // 17
SMTP_AUTH_LOGIN_RESPONSE,                           // 18
SMTP_TLS_RESPONSE,                                  // 19
SMTP_AUTH_EXTERNAL_RESPONSE,                        // 20
SMTP_AUTH_PROCESS_STATE,                            // 21
SMTP_AUTH_CRAM_MD5_CHALLENGE_RESPONSE,              // 22
SMTP_SEND_AUTH_GSSAPI_FIRST,                        // 23
SMTP_SEND_AUTH_GSSAPI_STEP                          // 24
} SmtpState;

// State Flags (Note, I use the word state in terms of storing 
// state information about the connection (authentication, have we sent
// commands, etc. I do not intend it to refer to protocol state)
#define SMTP_PAUSE_FOR_READ             0x00000001  /* should we pause for the next read */
#define SMTP_ESMTP_SERVER               0x00000002
#define SMTP_EHLO_DSN_ENABLED           0x00000004
#define SMTP_EHLO_STARTTLS_ENABLED      0x00000008
#define SMTP_EHLO_SIZE_ENABLED          0x00000010

// insecure mechanisms follow
#define SMTP_AUTH_LOGIN_ENABLED         0x00000100
#define SMTP_AUTH_PLAIN_ENABLED         0x00000200
#define SMTP_AUTH_EXTERNAL_ENABLED      0x00000400
// secure mechanisms follow
#define SMTP_AUTH_GSSAPI_ENABLED        0x00000800
#define SMTP_AUTH_DIGEST_MD5_ENABLED    0x00001000
#define SMTP_AUTH_CRAM_MD5_ENABLED      0x00002000
#define SMTP_AUTH_NTLM_ENABLED          0x00004000
#define SMTP_AUTH_MSN_ENABLED           0x00008000
// sum of all above auth mechanisms
#define SMTP_AUTH_ANY                   0x0000FF00
// indicates that AUTH has been advertised
#define SMTP_AUTH                       0x00010000
// No login necessary (pref)
#define SMTP_AUTH_NONE_ENABLED          0x00020000

class nsSmtpProtocol : public nsMsgAsyncWriteProtocol
{
public:
    NS_DECL_ISUPPORTS_INHERITED

    // Creating a protocol instance requires the URL which needs to be run.
    nsSmtpProtocol(nsIURI * aURL);
    virtual ~nsSmtpProtocol();

    virtual nsresult LoadUrl(nsIURI * aURL, nsISupports * aConsumer = nullptr) MOZ_OVERRIDE;
    virtual nsresult SendData(const char * dataBuffer, bool aSuppressLogging = false) MOZ_OVERRIDE;

    ////////////////////////////////////////////////////////////////////////////////////////
    // we suppport the nsIStreamListener interface 
    ////////////////////////////////////////////////////////////////////////////////////////

    // stop binding is a "notification" informing us that the stream associated with aURL is going away. 
    NS_IMETHOD OnStopRequest(nsIRequest *request, nsISupports *ctxt, nsresult status) MOZ_OVERRIDE;

private:
    // if we are asked to load a url while we are blocked waiting for redirection information,
    // then we'll store the url consumer in mPendingConsumer until we can actually load
    // the url.
    nsCOMPtr<nsISupports> mPendingConsumer;

    // the nsISmtpURL that is currently running
    nsCOMPtr<nsISmtpUrl> m_runningURL;

    // the error state we want to set on the url
    nsresult m_urlErrorState;
    nsCOMPtr<nsIMsgStatusFeedback> m_statusFeedback;

    // Generic state information -- What state are we in? What state do we want to go to
    // after the next response? What was the last response code? etc. 
    SmtpState m_nextState;
    SmtpState m_nextStateAfterResponse;
    int32_t m_responseCode;    /* code returned from Smtp server */
    int32_t m_previousResponseCode; 
    int32_t m_continuationResponse;
    nsCString m_responseText;   /* text returned from Smtp server */
    nsMsgLineStreamBuffer *m_lineStreamBuffer; // used to efficiently extract lines from the incoming data stream

    char           *m_addressCopy;
    char           *m_addresses;
    uint32_t       m_addressesLeft;
    nsCString m_mailAddr;
    nsCString m_helloArgument;
    int32_t        m_sizelimit;

    // *** the following should move to the smtp server when we support
    // multiple smtp servers
    bool m_usernamePrompted;
    int32_t m_prefSocketType;
    bool m_tlsEnabled;

    bool m_tlsInitiated;

    bool m_sendDone;

    int32_t m_totalAmountRead;
#ifdef UNREADY_CODE 
    // message specific information
    int32_t m_totalAmountWritten;
#endif /* UNREADY_CODE */
    int64_t m_totalMessageSize;

    char *m_dataBuf;
    uint32_t m_dataBufSize;

    int32_t   m_originalContentLength; /* the content length at the time of calling graph progress */

    // initialization function given a new url and transport layer
    void Initialize(nsIURI * aURL);
    virtual nsresult ProcessProtocolState(nsIURI * url, nsIInputStream * inputStream, 
                                          uint64_t sourceOffset, uint32_t length) MOZ_OVERRIDE;

    ////////////////////////////////////////////////////////////////////////////////////////
    // Communication methods --> Reading and writing protocol
    ////////////////////////////////////////////////////////////////////////////////////////

    void UpdateStatus(int32_t aStatusID);
    void UpdateStatusWithString(const PRUnichar * aStatusString);

    ////////////////////////////////////////////////////////////////////////////////////////
    // Protocol Methods --> This protocol is state driven so each protocol method is 
    //						designed to re-act to the current "state". I've attempted to 
    //						group them together based on functionality. 
    ////////////////////////////////////////////////////////////////////////////////////////

    nsresult SmtpResponse(nsIInputStream * inputStream, uint32_t length); 
    nsresult ExtensionLoginResponse(nsIInputStream * inputStream, uint32_t length);
    nsresult SendHeloResponse(nsIInputStream * inputStream, uint32_t length);
    nsresult SendEhloResponse(nsIInputStream * inputStream, uint32_t length);	
    nsresult SendQuit(SmtpState aNextStateAfterResponse = SMTP_DONE);

    nsresult AuthGSSAPIFirst();
    nsresult AuthGSSAPIStep();
    nsresult AuthLoginStep0();
    void     AuthLoginStep0Response();
    nsresult AuthLoginStep1();
    nsresult AuthLoginStep2();
    nsresult AuthLoginResponse(nsIInputStream * stream, uint32_t length);

    nsresult SendTLSResponse();
    nsresult SendMailResponse();
    nsresult SendRecipientResponse();
    nsresult SendDataResponse();
    void     SendPostData();
    nsresult SendMessageResponse();
    nsresult ProcessAuth();


    ////////////////////////////////////////////////////////////////////////////////////////
    // End of Protocol Methods
    ////////////////////////////////////////////////////////////////////////////////////////

    void SendMessageInFile();

    void AppendHelloArgument(nsACString& aResult);
    nsresult GetPassword(nsCString &aPassword);
    nsresult GetUsernamePassword(nsACString &aUsername, nsACString &aPassword);
    nsresult PromptForPassword(nsISmtpServer *aSmtpServer, nsISmtpUrl *aSmtpUrl, 
                               const PRUnichar **formatStrings, 
                               nsACString &aPassword);

    void    InitPrefAuthMethods(int32_t authMethodPrefValue);
    nsresult ChooseAuthMethod();
    void    MarkAuthMethodAsFailed(int32_t failedAuthMethod);
    void    ResetAuthMethods();

    virtual const char* GetType() MOZ_OVERRIDE {return "smtp";}

    int32_t m_prefAuthMethods; // set of capability flags for auth methods
    int32_t m_failedAuthMethods; // ditto
    int32_t m_currentAuthMethod; // exactly one capability flag, or 0
};

#endif  // nsSmtpProtocol_h___
