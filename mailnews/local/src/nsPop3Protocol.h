/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsPop3Protocol_h__
#define nsPop3Protocol_h__

#include "mozilla/Attributes.h"
#include "nsIStreamListener.h"
#include "nsIOutputStream.h"
#include "nsIInputStream.h"
#include "nsIPop3URL.h"
#include "nsIPop3Sink.h"
#include "nsMsgLineBuffer.h"
#include "nsMsgProtocol.h"
#include "nsIPop3Protocol.h"
#include "MailNewsTypes.h"
#include "nsIStringBundle.h"
#include "nsIMsgStatusFeedback.h"
#include "nsIMsgFolder.h" // TO include biffState enum. Change to bool later...
#include "nsIAuthModule.h"
#include "nsITimer.h"
#include "nsIMsgAsyncPrompter.h"

#include "prerror.h"
#include "plhash.h"
#include "nsCOMPtr.h"

/* A more guaranteed way of making sure that we never get duplicate messages
is to always get each message's UIDL (if the server supports it)
and use these for storing up deletes which were not committed on the
server.  Based on our experience, it looks like we do NOT need to
do this (it has performance tradeoffs, etc.).  To turn it on, three
things need to happen: #define POP_ALWAYS_USE_UIDL_FOR_DUPLICATES, verify that
the uidl's are correctly getting added when the delete response is received,
and change the POP3_QUIT_RESPONSE state to flush the newly committed deletes. */

/*
 * Cannot have the following line uncommented. It is defined.
 * #ifdef POP_ALWAYS_USE_UIDL_FOR_DUPLICATES will always be evaluated
 * as true.
 *
#define POP_ALWAYS_USE_UIDL_FOR_DUPLICATES 0
 *
 */

#define MK_OUT_OF_MEMORY -207
#define MK_POP3_PASSWORD_UNDEFINED -313
#define XP_NO_ANSWER 14401
#define XP_THE_PREVIOUSLY_ENTERED_PASSWORD_IS_INVALID_ETC 14405
#define XP_PASSWORD_FOR_POP3_USER 14590

#define OUTPUT_BUFFER_SIZE 8192 // maximum size of command string

/* structure to hold data pertaining to the active state of
 * a transfer in progress.
 *
 */

enum Pop3CapabilityEnum {
    POP3_CAPABILITY_UNDEFINED   = 0x00000000,
    POP3_HAS_XSENDER            = 0x00000001,
    POP3_GURL_UNDEFINED         = 0x00000002,
    POP3_HAS_GURL               = 0x00000004,
    POP3_UIDL_UNDEFINED         = 0x00000008,
    POP3_HAS_UIDL               = 0x00000010,
    POP3_XTND_XLST_UNDEFINED    = 0x00000020,
    POP3_HAS_XTND_XLST          = 0x00000040,
    POP3_TOP_UNDEFINED          = 0x00000080,
    POP3_HAS_TOP                = 0x00000100,
    POP3_AUTH_MECH_UNDEFINED    = 0x00000200,
    POP3_HAS_AUTH_USER          = 0x00000400,
    POP3_HAS_AUTH_LOGIN         = 0x00000800,
    POP3_HAS_AUTH_PLAIN         = 0x00001000,
    POP3_HAS_AUTH_CRAM_MD5      = 0x00002000,
    POP3_HAS_AUTH_APOP          = 0x00004000,
    POP3_HAS_AUTH_NTLM          = 0x00008000,
    POP3_HAS_AUTH_MSN           = 0x00010000,
    POP3_HAS_RESP_CODES         = 0x00020000,
    POP3_HAS_AUTH_RESP_CODE     = 0x00040000,
    POP3_HAS_STLS               = 0x00080000,
    POP3_HAS_AUTH_GSSAPI        = 0x00100000
};

// TODO use value > 0?
#define POP3_HAS_AUTH_NONE        0
#define POP3_HAS_AUTH_ANY         0x00001C00
#define POP3_HAS_AUTH_ANY_SEC     0x0011E000

enum Pop3StatesEnum {
    POP3_READ_PASSWORD,                         // 0
                                                //
    POP3_START_CONNECT,                         // 1
    POP3_FINISH_CONNECT,                        // 2
    POP3_WAIT_FOR_RESPONSE,                     // 3
    POP3_WAIT_FOR_START_OF_CONNECTION_RESPONSE, // 4
    POP3_SEND_USERNAME,                         // 5

    POP3_SEND_PASSWORD,                         // 6
    POP3_SEND_STAT,                             // 7
    POP3_GET_STAT,                              // 8
    POP3_SEND_LIST,                             // 9
    POP3_GET_LIST,                              // 10

    POP3_SEND_UIDL_LIST,                        // 11
    POP3_GET_UIDL_LIST,                         // 12
    POP3_SEND_XTND_XLST_MSGID,                  // 13
    POP3_GET_XTND_XLST_MSGID,                   // 14
    POP3_GET_MSG,                               // 15

    POP3_SEND_TOP,                              // 16
    POP3_TOP_RESPONSE,                          // 17
    POP3_SEND_RETR,                             // 18
    POP3_RETR_RESPONSE,                         // 19
    POP3_SEND_DELE,                             // 20

    POP3_DELE_RESPONSE,                         // 21
    POP3_SEND_QUIT,                             // 22
    POP3_DONE,                                  // 23
    POP3_ERROR_DONE,                            // 24
    POP3_FREE,                                  // 25
    POP3_SEND_AUTH,                             // 26
    POP3_AUTH_RESPONSE,                         // 27
    POP3_SEND_CAPA,                             // 28
    POP3_CAPA_RESPONSE,                         // 29
    POP3_PROCESS_AUTH,                          // 30
    POP3_NEXT_AUTH_STEP,                        // 31

    POP3_AUTH_LOGIN,                            // 32
    POP3_AUTH_LOGIN_RESPONSE,                   // 33
    POP3_AUTH_NTLM,                             // 34
    POP3_AUTH_NTLM_RESPONSE,                    // 35
    POP3_SEND_XSENDER,                          // 36
    POP3_XSENDER_RESPONSE,                      // 37
    POP3_SEND_GURL,                             // 38

    POP3_GURL_RESPONSE,                         // 39
    POP3_QUIT_RESPONSE,                         // 40
    POP3_TLS_RESPONSE,                          // 41

    POP3_AUTH_GSSAPI,                           // 42
    POP3_AUTH_GSSAPI_FIRST,                     // 43
    POP3_AUTH_GSSAPI_STEP,                      // 44

    /**
     * Async wait to obtain the password and deal with the result.
     * The *PREOBTAIN* states are used for where we try and get the password
     * before we've initiated a connection to the server.
     */
    POP3_OBTAIN_PASSWORD_EARLY,                 // 45
    POP3_FINISH_OBTAIN_PASSWORD_EARLY,          // 46
    POP3_OBTAIN_PASSWORD_BEFORE_USERNAME,       // 47
    POP3_FINISH_OBTAIN_PASSWORD_BEFORE_USERNAME,// 48
    POP3_OBTAIN_PASSWORD_BEFORE_PASSWORD,       // 49
    POP3_FINISH_OBTAIN_PASSWORD_BEFORE_PASSWORD // 50
};


#define KEEP        'k'         /* If we want to keep this item on server. */
#define DELETE_CHAR 'd'         /* If we want to delete this item. */
#define TOO_BIG     'b'         /* item left on server because it was too big */
#define FETCH_BODY  'f'         /* Fetch full body of a partial msg */

typedef struct Pop3UidlEntry { /* information about this message */
    char* uidl;
    char  status; // KEEP=='k', DELETE='d' TOO_BIG='b' FETCH_BODY='f'
    uint32_t dateReceived; // time message received, used for aging
} Pop3UidlEntry;

typedef struct Pop3UidlHost {
    char* host;
    char* user;
    PLHashTable * hash;
    Pop3UidlEntry* uidlEntries;
    struct Pop3UidlHost* next;
} Pop3UidlHost;

typedef struct Pop3MsgInfo {
    int32_t msgnum;
    int32_t size;
    char* uidl;
} Pop3MsgInfo;

typedef struct _Pop3ConData {
    bool leave_on_server;     /* Whether we're supposed to leave messages
                                   on server. */
    bool headers_only;        /* Whether to just fetch headers on initial
                                   downloads. */
    int32_t size_limit;         /* Leave messages bigger than this on the
                                   server and only download a partial
                                   message. */
    uint32_t capability_flags; /* What capability this server has? */

    Pop3StatesEnum next_state;  /* the next state or action to be taken */
    Pop3StatesEnum next_state_after_response;
    bool pause_for_read;       /* Pause now for next read? */

    bool command_succeeded;   /* did the last command succeed? */
    bool list_done;    /* did we get the complete list of msgIDs? */
    int32_t first_msg;

    uint32_t obuffer_size;
    uint32_t obuffer_fp;

    int32_t  really_new_messages;
    int32_t  real_new_counter;
    int32_t number_of_messages;
    Pop3MsgInfo  *msg_info;      /* Message sizes and uidls (used only if we
                                   are playing games that involve leaving
                                   messages on the server). */
    int32_t last_accessed_msg;
    int32_t cur_msg_size;
    bool truncating_cur_msg;  /* are we using top and uidl? */
    bool msg_del_started;     /* True if MSG_BeginMailDel...
                                 * called
                                 */
    bool only_check_for_new_mail;
    nsMsgBiffState biffstate;     /* If just checking for, what the answer is. */

    bool verify_logon;        /* true if we're just seeing if we can logon */

    void *msg_closure;

    bool graph_progress_bytes_p; /* whether we should display info about
                                      the bytes transferred (usually we
                                      display info about the number of
                                      messages instead.) */

    Pop3UidlHost *uidlinfo;
    PLHashTable *newuidl;
    char *only_uidl;              /* If non-NULL, then load only this UIDL. */

    bool get_url;
    bool seenFromHeader;
    int32_t parsed_bytes;
    int32_t pop3_size;
    bool dot_fix;
    bool assumed_end;
    nsresult urlStatus;
} Pop3ConData;

// State Flags (Note, I use the word state in terms of storing
// state information about the connection (authentication, have we sent
// commands, etc. I do not intend it to refer to protocol state)
#define POP3_PAUSE_FOR_READ      0x00000001  /* should we pause for the next read */
#define POP3_PASSWORD_FAILED    0x00000002
#define POP3_STOPLOGIN              0x00000004  /* error loging in, so stop here */
#define POP3_AUTH_FAILURE           0x00000008  /* extended code said authentication failed */


class nsPop3Protocol : public nsMsgProtocol,
                       public nsIPop3Protocol,
                       public nsIMsgAsyncPromptListener
{
public:
  nsPop3Protocol(nsIURI* aURL);
  virtual ~nsPop3Protocol();

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIPOP3PROTOCOL
  NS_DECL_NSIMSGASYNCPROMPTLISTENER

  nsresult Initialize(nsIURI * aURL);
  virtual nsresult LoadUrl(nsIURI *aURL, nsISupports * aConsumer = nullptr) MOZ_OVERRIDE;
  void Cleanup();

  const char* GetUsername() { return m_username.get(); }
  void SetUsername(const char* name);

  nsresult StartGetAsyncPassword(Pop3StatesEnum aNextState);

  NS_IMETHOD OnTransportStatus(nsITransport *transport, nsresult status, uint64_t progress, uint64_t progressMax) MOZ_OVERRIDE;
  NS_IMETHOD OnStopRequest(nsIRequest *request, nsISupports * aContext, nsresult aStatus) MOZ_OVERRIDE;
  NS_IMETHOD Cancel(nsresult status) MOZ_OVERRIDE;

  static void MarkMsgInHashTable(PLHashTable *hashTable, const Pop3UidlEntry *uidl,
                                  bool *changed);

  static nsresult MarkMsgForHost(const char *hostName, const char *userName,
                                      nsIFile *mailDirectory,
                                      nsVoidArray  &UIDLArray);
private:
  nsCString m_ApopTimestamp;
  nsCOMPtr<nsIStringBundle> mLocalBundle;

  nsCString m_username;
  nsCString m_senderInfo;
  nsCString m_commandResponse;
  nsCOMPtr<nsIMsgStatusFeedback> m_statusFeedback;
  nsCString m_GSSAPICache;

  // Used for asynchronous password prompts to store the password temporarily.
  nsCString m_passwordResult;

  // progress state information
  void UpdateProgressPercent (uint32_t totalDone, uint32_t total);
  void UpdateStatus(const nsString &aStatusName);
  void UpdateStatusWithString(const PRUnichar * aString);
  nsresult FormatCounterString(const nsString &stringName,
                               uint32_t count1,
                               uint32_t count2,
                               nsString &resultString);

  int32_t  m_bytesInMsgReceived;
  int32_t  m_totalFolderSize;
  int32_t  m_totalDownloadSize; /* Number of bytes we're going to
                                    download.  Might be much less
                                    than the total_folder_size. */
  int32_t m_totalBytesReceived; // total # bytes received for the connection

  virtual nsresult ProcessProtocolState(nsIURI * url, nsIInputStream * inputStream,
                                        uint64_t sourceOffset, uint32_t length) MOZ_OVERRIDE;
  virtual int32_t Pop3SendData(const char * dataBuffer, bool aSuppressLogging = false);

  virtual const char* GetType() MOZ_OVERRIDE {return "pop3";}

  nsCOMPtr<nsIURI> m_url;
  nsCOMPtr<nsIPop3Sink> m_nsIPop3Sink;
  nsCOMPtr<nsIPop3IncomingServer> m_pop3Server;

  nsMsgLineStreamBuffer   * m_lineStreamBuffer; // used to efficiently extract lines from the incoming data stream
  Pop3ConData* m_pop3ConData;
  void FreeMsgInfo();
  void Abort();

  bool m_tlsEnabled;
  int32_t m_socketType;
  bool m_password_already_sent;
  bool m_needToRerunUrl;

  void SetCapFlag(uint32_t flag);
  void ClearCapFlag(uint32_t flag);
  bool TestCapFlag(uint32_t flag);
  uint32_t GetCapFlags();

  void    InitPrefAuthMethods(int32_t authMethodPrefValue);
  nsresult ChooseAuthMethod();
  void    MarkAuthMethodAsFailed(int32_t failedAuthMethod);
  void    ResetAuthMethods();
  int32_t m_prefAuthMethods; // set of capability flags for auth methods
  int32_t m_failedAuthMethods; // ditto
  int32_t m_currentAuthMethod; // exactly one capability flag, or 0

  int32_t m_listpos;

  nsresult HandleLine(char *line, uint32_t line_length);

  nsresult GetApopTimestamp();

  //////////////////////////////////////////////////////////////////////////////////////////
      // Begin Pop3 protocol state handlers
      //////////////////////////////////////////////////////////////////////////////////////////
  int32_t WaitForStartOfConnectionResponse(nsIInputStream* inputStream,
                                           uint32_t length);
  int32_t WaitForResponse(nsIInputStream* inputStream,
                          uint32_t length);
  int32_t Error(const char* err_code);
  int32_t SendAuth();
  int32_t AuthResponse(nsIInputStream* inputStream, uint32_t length);
  int32_t SendCapa();
  int32_t CapaResponse(nsIInputStream* inputStream, uint32_t length);
  int32_t SendTLSResponse();
  int32_t ProcessAuth();
  int32_t NextAuthStep();
  int32_t AuthLogin();
  int32_t AuthLoginResponse();
  int32_t AuthNtlm();
  int32_t AuthNtlmResponse();
  int32_t AuthGSSAPI();
  int32_t AuthGSSAPIResponse(bool first);
  int32_t SendUsername();
  int32_t SendPassword();
  int32_t SendStatOrGurl(bool sendStat);
  int32_t SendStat();
  int32_t GetStat();
  int32_t SendGurl();
  int32_t GurlResponse();
  int32_t SendList();
  int32_t GetList(nsIInputStream* inputStream, uint32_t length);
  int32_t HandleNoUidListAvailable();
  int32_t SendXtndXlstMsgid();
  int32_t GetXtndXlstMsgid(nsIInputStream* inputStream, uint32_t length);
  int32_t SendUidlList();
  int32_t GetUidlList(nsIInputStream* inputStream, uint32_t length);
  int32_t GetMsg();
  int32_t SendTop();
  int32_t SendXsender();
  int32_t XsenderResponse();
  int32_t SendRetr();

  int32_t RetrResponse(nsIInputStream* inputStream, uint32_t length);
  int32_t TopResponse(nsIInputStream* inputStream, uint32_t length);
  int32_t SendDele();
  int32_t DeleResponse();
  int32_t CommitState(bool remove_last_entry);

  Pop3StatesEnum GetNextPasswordObtainState();
  nsresult RerunUrl();
};

#endif /* nsPop3Protocol_h__ */
