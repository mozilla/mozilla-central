/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef nsSmtpProtocol_h___
#define nsSmtpProtocol_h___

#include "nsMsgProtocol.h"
#include "nsIStreamListener.h"
#include "nsISmtpUrl.h"
#include "nsIMsgStatusFeedback.h"
#include "nsMsgLineBuffer.h"
#include "nsIAuthModule.h"

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
// sum of above insecure mechanisms
#define SMTP_AUTH_INSEC_ENABLED         0x00000700
// secure mechanisms follow
#define SMTP_AUTH_GSSAPI_ENABLED        0x00000800
#define SMTP_AUTH_DIGEST_MD5_ENABLED    0x00001000
#define SMTP_AUTH_CRAM_MD5_ENABLED      0x00002000
#define SMTP_AUTH_NTLM_ENABLED          0x00004000
#define SMTP_AUTH_MSN_ENABLED           0x00008000
// sum of above secure mechanisms
#define SMTP_AUTH_SEC_ENABLED           0x0000F800
// sum of all above mechanisms
#define SMTP_AUTH_ANY_ENABLED           0x0000FF00
// indicates that AUTH has been advertised
#define SMTP_AUTH                       0x00010000

typedef enum _PrefAuthMethod {
    PREF_AUTH_NONE = 0,
    PREF_AUTH_ANY = 1
} PrefAuthMethod;

typedef enum _PrefTrySSL {
    PREF_SECURE_NEVER = 0,
    PREF_SECURE_TRY_STARTTLS = 1,
    PREF_SECURE_ALWAYS_STARTTLS = 2,
    PREF_SECURE_ALWAYS_SMTPS = 3
} PrefTrySSL;

class nsSmtpProtocol : public nsMsgAsyncWriteProtocol
{
public:
    NS_DECL_ISUPPORTS_INHERITED

    // Creating a protocol instance requires the URL which needs to be run.
    nsSmtpProtocol(nsIURI * aURL);
    virtual ~nsSmtpProtocol();

    virtual nsresult LoadUrl(nsIURI * aURL, nsISupports * aConsumer = nsnull);
    virtual PRInt32 SendData(nsIURI * aURL, const char * dataBuffer, PRBool aSuppressLogging = PR_FALSE);

    ////////////////////////////////////////////////////////////////////////////////////////
    // we suppport the nsIStreamListener interface 
    ////////////////////////////////////////////////////////////////////////////////////////

    // stop binding is a "notification" informing us that the stream associated with aURL is going away. 
    NS_IMETHOD OnStopRequest(nsIRequest *request, nsISupports *ctxt, nsresult status);

private:
    // if we are asked to load a url while we are blocked waiting for redirection information,
    // then we'll store the url consumer in mPendingConsumer until we can actually load
    // the url.
    nsCOMPtr<nsISupports> mPendingConsumer;

    // the nsISmtpURL that is currently running
    nsCOMPtr<nsISmtpUrl> m_runningURL;

    // the error state we want to set on the url
    nsresult m_urlErrorState;
    PRUint32 m_LastTime;
    nsCOMPtr<nsIMsgStatusFeedback> m_statusFeedback;

    // Generic state information -- What state are we in? What state do we want to go to
    // after the next response? What was the last response code? etc. 
    SmtpState m_nextState;
    SmtpState m_nextStateAfterResponse;
    PRInt32 m_responseCode;    /* code returned from Smtp server */
    PRInt32 m_previousResponseCode; 
    PRInt32 m_continuationResponse;
    nsCString m_responseText;   /* text returned from Smtp server */
    nsMsgLineStreamBuffer *m_lineStreamBuffer; // used to efficiently extract lines from the incoming data stream

    char           *m_addressCopy;
    char           *m_addresses;
    PRUint32       m_addressesLeft;
    nsCString m_mailAddr;
    nsCString m_helloArgument;
    PRInt32        m_sizelimit;

    // *** the following should move to the smtp server when we support
    // multiple smtp servers
    PRInt32 m_prefAuthMethod;
    PRBool m_prefUseSecAuth;
    PRBool m_prefTrySecAuth;
    PRBool m_usernamePrompted;
    PRInt32 m_prefTrySSL;
    PRBool m_tlsEnabled;

    PRBool m_tlsInitiated;

    PRBool m_sendDone;

    PRInt32 m_totalAmountRead;
#ifdef UNREADY_CODE 
    // message specific information
    PRInt32 m_totalAmountWritten;
#endif /* UNREADY_CODE */
    PRInt64 m_totalMessageSize;

    char *m_dataBuf;
    PRUint32 m_dataBufSize;

    PRInt32   m_originalContentLength; /* the content length at the time of calling graph progress */

    // initialization function given a new url and transport layer
    void Initialize(nsIURI * aURL);
    virtual nsresult ProcessProtocolState(nsIURI * url, nsIInputStream * inputStream, 
                                          PRUint32 sourceOffset, PRUint32 length);

    ////////////////////////////////////////////////////////////////////////////////////////
    // Communication methods --> Reading and writing protocol
    ////////////////////////////////////////////////////////////////////////////////////////

    void UpdateStatus(PRInt32 aStatusID);
    void UpdateStatusWithString(const PRUnichar * aStatusString);

    ////////////////////////////////////////////////////////////////////////////////////////
    // Protocol Methods --> This protocol is state driven so each protocol method is 
    //						designed to re-act to the current "state". I've attempted to 
    //						group them together based on functionality. 
    ////////////////////////////////////////////////////////////////////////////////////////

    PRInt32 SmtpResponse(nsIInputStream * inputStream, PRUint32 length); 
    PRInt32 ExtensionLoginResponse(nsIInputStream * inputStream, PRUint32 length);
    PRInt32 SendHeloResponse(nsIInputStream * inputStream, PRUint32 length);
    PRInt32 SendEhloResponse(nsIInputStream * inputStream, PRUint32 length);	
    PRInt32 SendQuit();

    PRInt32 AuthGSSAPIFirst();
    PRInt32 AuthGSSAPIStep();
    PRInt32 AuthLoginStep0();
    PRInt32 AuthLoginStep0Response();
    PRInt32 AuthLoginStep1();
    PRInt32 AuthLoginStep2();
    PRInt32 AuthLoginResponse(nsIInputStream * stream, PRUint32 length);

    PRInt32 SendTLSResponse();
    PRInt32 SendMailResponse();
    PRInt32 SendRecipientResponse();
    PRInt32 SendDataResponse();
    PRInt32 SendPostData();
    PRInt32 SendMessageResponse();
    PRInt32 CramMD5LoginResponse();
    PRInt32 ProcessAuth();


    ////////////////////////////////////////////////////////////////////////////////////////
    // End of Protocol Methods
    ////////////////////////////////////////////////////////////////////////////////////////

    PRInt32 SendMessageInFile();

    void AppendHelloArgument(nsACString& aResult);
    nsresult GetPassword(nsCString &aPassword);
    nsresult GetUsernamePassword(nsACString &aUsername, nsACString &aPassword);
    nsresult PromptForPassword(nsISmtpServer *aSmtpServer, nsISmtpUrl *aSmtpUrl, 
                               const PRUnichar **formatStrings, 
                               nsACString &aPassword);

    void BackupAuthFlags();
    void RestoreAuthFlags();
    PRInt32 m_origAuthFlags;
};

#endif  // nsSmtpProtocol_h___
