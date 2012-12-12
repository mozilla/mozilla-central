/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsNNTPProtocol_h___
#define nsNNTPProtocol_h___

#include "nsMsgProtocol.h"

#include "nsCOMPtr.h"
#include "nsIAsyncInputStream.h"
#include "nsIAsyncOutputStream.h"
#include "nsINntpUrl.h"
#include "nsINntpIncomingServer.h"
#include "nsINNTPProtocol.h"

#include "nsINNTPNewsgroupList.h"
#include "nsINNTPArticleList.h"
#include "nsIMsgAsyncPrompter.h"
#include "nsIMsgNewsFolder.h"
#include "nsIMsgWindow.h"

#include "nsMsgLineBuffer.h"
#include "nsIStringBundle.h"
#include "nsITimer.h"
#include "nsICacheListener.h"

// this is only needed as long as our libmime hack is in place
#include "prio.h"

// State Flags (Note, I use the word state in terms of storing
// state information about the connection (authentication, have we sent
// commands, etc. I do not intend it to refer to protocol state)

#define NNTP_PAUSE_FOR_READ      0x00000001  /* should we pause for the next read */
#define NNTP_PROXY_AUTH_REQUIRED    0x00000002  /* is auth required */
#define NNTP_SENT_PROXY_AUTH        0x00000004  /* have we sent a proxy auth? */
#define NNTP_READER_PERFORMED       0x00000010  /* have we sent any cmds to the server yet? */
#define NNTP_USE_FANCY_NEWSGROUP    0x00000020  /* use LIST XACTIVE or LIST */
#define NNTP_DESTROY_PROGRESS_GRAPH 0x00000040  /* do we need to destroy graph progress */
#define NNTP_SOME_PROTOCOL_SUCCEEDED 0x0000080  /* some protocol has suceeded so don't kill the connection */
#define NNTP_NO_XOVER_SUPPORT       0x00000100  /* xover command is not supported here */

/* states of the machine
 */
typedef enum _StatesEnum {
NNTP_RESPONSE,
#ifdef BLOCK_UNTIL_AVAILABLE_CONNECTION
NNTP_BLOCK_UNTIL_CONNECTIONS_ARE_AVAILABLE,
NNTP_CONNECTIONS_ARE_AVAILABLE,
#endif
NNTP_CONNECT,
NNTP_CONNECT_WAIT,
NNTP_LOGIN_RESPONSE,
NNTP_SEND_MODE_READER,
NNTP_SEND_MODE_READER_RESPONSE,
SEND_LIST_EXTENSIONS,
SEND_LIST_EXTENSIONS_RESPONSE,
SEND_LIST_SEARCHES,
SEND_LIST_SEARCHES_RESPONSE,
NNTP_LIST_SEARCH_HEADERS,
NNTP_LIST_SEARCH_HEADERS_RESPONSE,
NNTP_GET_PROPERTIES,
NNTP_GET_PROPERTIES_RESPONSE,
SEND_LIST_SUBSCRIPTIONS,
SEND_LIST_SUBSCRIPTIONS_RESPONSE,
SEND_FIRST_NNTP_COMMAND,
SEND_FIRST_NNTP_COMMAND_RESPONSE,
SETUP_NEWS_STREAM,
NNTP_BEGIN_AUTHORIZE,
NNTP_AUTHORIZE_RESPONSE,
NNTP_PASSWORD_RESPONSE,
NNTP_READ_LIST_BEGIN,
NNTP_READ_LIST,
DISPLAY_NEWSGROUPS,
NNTP_NEWGROUPS_BEGIN,
NNTP_NEWGROUPS,
NNTP_BEGIN_ARTICLE,
NNTP_READ_ARTICLE,
NNTP_XOVER_BEGIN,
NNTP_FIGURE_NEXT_CHUNK,
NNTP_XOVER_SEND,
NNTP_XOVER_RESPONSE,
NNTP_XOVER,
NEWS_PROCESS_XOVER,
NNTP_XHDR_SEND,
NNTP_XHDR_RESPONSE,
NNTP_READ_GROUP,
NNTP_READ_GROUP_RESPONSE,
NNTP_READ_GROUP_BODY,
NNTP_SEND_GROUP_FOR_ARTICLE,
NNTP_SEND_GROUP_FOR_ARTICLE_RESPONSE,
NNTP_SEND_ARTICLE_NUMBER,
NEWS_PROCESS_BODIES,
NNTP_PRINT_ARTICLE_HEADERS,
NNTP_SEND_POST_DATA,
NNTP_SEND_POST_DATA_RESPONSE,
NNTP_CHECK_FOR_MESSAGE,
NEWS_START_CANCEL,
NEWS_DO_CANCEL,
NNTP_XPAT_SEND,
NNTP_XPAT_RESPONSE,
NNTP_SEARCH,
NNTP_SEARCH_RESPONSE,
NNTP_SEARCH_RESULTS,
NNTP_LIST_PRETTY_NAMES,
NNTP_LIST_PRETTY_NAMES_RESPONSE,
NNTP_LIST_XACTIVE,
NNTP_LIST_XACTIVE_RESPONSE,
NNTP_LIST_GROUP,
NNTP_LIST_GROUP_RESPONSE,
NEWS_DONE,
NEWS_POST_DONE,
NEWS_ERROR,
NNTP_ERROR,
NEWS_FREE,
NNTP_SUSPENDED
} StatesEnum;

class nsICacheEntryDescriptor;

class nsNNTPProtocol : public nsMsgProtocol,
                       public nsINNTPProtocol,
                       public nsITimerCallback,
                       public nsICacheListener,
                       public nsIMsgAsyncPromptListener
{
public:
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSINNTPPROTOCOL
  NS_DECL_NSICACHELISTENER
  NS_DECL_NSITIMERCALLBACK
  NS_DECL_NSIMSGASYNCPROMPTLISTENER

  // Creating a protocol instance requires the URL
  // need to call Initialize after we do a new of nsNNTPProtocol
  nsNNTPProtocol(nsINntpIncomingServer *aServer, nsIURI *aURL,
                 nsIMsgWindow *aMsgWindow);
  virtual ~nsNNTPProtocol();

  // stop binding is a "notification" informing us that the stream associated with aURL is going away.
  NS_IMETHOD OnStopRequest(nsIRequest *request, nsISupports * aCtxt, nsresult aStatus);

  char * m_ProxyServer;    /* proxy server hostname */

  NS_IMETHOD Cancel(nsresult status);  // handle stop button
  NS_IMETHOD GetContentType(nsACString &aContentType);
  NS_IMETHOD AsyncOpen(nsIStreamListener *listener, nsISupports *ctxt);
  NS_IMETHOD GetOriginalURI(nsIURI* *aURI);
  NS_IMETHOD SetOriginalURI(nsIURI* aURI);

  nsresult LoadUrl(nsIURI * aURL, nsISupports * aConsumer);

private:
  /**
   * Triggers the protocol state machine.
   * Most of the time, this machine will read as much input as it can before
   * closing.
   *
   * This method additionally handles some states not covered by other methods:
   * NEWS_DONE: Alias for NEWS_FREE
   * NEWS_POST_DONE: Alias for NEWS_FREE that cleans up the URL state
   * NEWS_ERROR: An error which permits further use of the connection
   * NNTP_ERROR: An error which does not permit further use of the connection
   * NEWS_FREE: Cleans up from the current URL and prepares for the next one
   * NNTP_SUSPENDED: A state where the state machine does not read input until
   *                 reenabled by a non-network related callback
   *
   * @note Use of NNTP_SUSPENDED is dangerous: if input comes along the socket,
   * the code will not read the input stream at all. Therefore, it is strongly
   * advised to suspend the request before using this state.
   */
  virtual nsresult ProcessProtocolState(nsIURI * url, nsIInputStream * inputStream,
                                        uint64_t sourceOffset, uint32_t length);
  virtual nsresult CloseSocket();

  // we have our own implementation of SendData which writes to the nntp log
  // and then calls the base class to transmit the data
  nsresult SendData(const char * dataBuffer, bool aSuppressLogging = false);

  nsresult CleanupAfterRunningUrl();
  void Cleanup(); //free char* member variables

  void ParseHeaderForCancel(char *buf);

  virtual const char* GetType() {return "nntp";}

  static void CheckIfAuthor(nsIMsgIdentity *aIdentity, const nsCString &aOldFrom, nsCString &aFrom);

  nsCOMPtr <nsINNTPNewsgroupList> m_newsgroupList;
  nsCOMPtr <nsINNTPArticleList> m_articleList;

  nsCOMPtr <nsIMsgNewsFolder> m_newsFolder;
  nsCOMPtr <nsIMsgWindow> m_msgWindow;

  nsCOMPtr<nsIAsyncInputStream> mDisplayInputStream;
  nsCOMPtr<nsIAsyncOutputStream> mDisplayOutputStream;
  nsMsgLineStreamBuffer   * m_lineStreamBuffer; // used to efficiently extract lines from the incoming data stream
  // the nsINntpURL that is currently running
  nsCOMPtr<nsINntpUrl> m_runningURL;
  bool        m_connectionBusy;
  bool        m_fromCache;  // is this connection from the cache?
  PRTime      m_lastActiveTimeStamp;
  nsNewsAction m_newsAction;

  // Generic state information -- What state are we in? What state do we want to go to
  // after the next response? What was the last response code? etc.
  StatesEnum  m_nextState;
  StatesEnum  m_nextStateAfterResponse;
  int32_t     m_typeWanted;     /* Article, List, or Group */
  int32_t     m_responseCode;    /* code returned from NNTP server */
  int32_t   m_previousResponseCode;
  char       *m_responseText;   /* text returned from NNTP server */

  char    *m_dataBuf;
  uint32_t   m_dataBufSize;

  /* for group command */
  nsCString m_currentGroup;     /* current group */

  int32_t   m_firstArticle;
  int32_t   m_lastArticle;
  int32_t   m_firstPossibleArticle;
  int32_t   m_lastPossibleArticle;

  int32_t    m_numArticlesLoaded;  /* How many articles we got XOVER lines for. */
  int32_t    m_numArticlesWanted; /* How many articles we wanted to get XOVER lines for. */
  int32_t   m_maxArticles;        /* max articles to get during an XOVER */

  // Cancelation specific state. In particular, the headers that should be
  // used for the cancelation message.
  // mscott: we can probably replace this stuff with nsString
  char   *m_cancelFromHdr;
  char     *m_cancelNewsgroups;
  char     *m_cancelDistribution;
  char     *m_cancelID;
  int32_t    m_cancelStatus;

  // variable for ReadNewsList
  int32_t   m_readNewsListCount;

  // Per news article state information. (article number, author, subject, id, etc
  nsCString m_messageID;
  int32_t   m_articleNumber;   /* current article number */
  nsCString m_searchData;

  int32_t   m_originalContentLength; /* the content length at the time of calling graph progress */

  nsCOMPtr<nsIStringBundle> m_stringBundle;

  nsCOMPtr<nsINntpIncomingServer> m_nntpServer;

  nsresult GetNewsStringByName(const char *aName, PRUnichar **aString);
  nsresult GetNewsStringByID(int32_t stringID, PRUnichar **aString);

  nsresult PostMessageInFile(nsIFile * filePath);

  //////////////////////////////////////////////////////////////////////////////
  // Communication methods --> Reading and writing protocol
  //////////////////////////////////////////////////////////////////////////////

  int32_t ReadLine(nsIInputStream * inputStream, uint32_t length, char ** line);

  //////////////////////////////////////////////////////////////////////////////
  // Protocol Methods --> This protocol is state driven so each protocol method
  //            is designed to re-act to the current "state". I've attempted to
  //            group them together based on functionality.
  //////////////////////////////////////////////////////////////////////////////

  // gets the response code from the nntp server and the response line. Returns the TCP return code
  // from the read.
  nsresult NewsResponse(nsIInputStream *inputStream, uint32_t length);

  // Interpret the server response after the connect.
  // Returns negative if the server responds unexpectedly
  nsresult LoginResponse();
  nsresult SendModeReader();
  nsresult SendModeReaderResponse();

  nsresult SendListExtensions();
  nsresult SendListExtensionsResponse(nsIInputStream *inputStream, uint32_t length);

  nsresult SendListSearches();
  nsresult SendListSearchesResponse(nsIInputStream *inputStream, uint32_t length);

  nsresult SendListSearchHeaders();
  nsresult SendListSearchHeadersResponse(nsIInputStream *inputStream, uint32_t length);

  nsresult GetProperties();
  nsresult GetPropertiesResponse(nsIInputStream *inputStream, uint32_t length);

  nsresult SendListSubscriptions();
  nsresult SendListSubscriptionsResponse(nsIInputStream *inputStream, uint32_t length);

  // Figure out what the first command is and send it.
  // Returns the status from the NETWrite.
  nsresult SendFirstNNTPCommand(nsIURI *url);

  // Interprets the server response from the first command sent.
  // returns negative if the server responds unexpectedly.
  nsresult SendFirstNNTPCommandResponse();

  nsresult SetupForTransfer();

  nsresult SendGroupForArticle();
  nsresult SendGroupForArticleResponse();

  nsresult SendArticleNumber();
  nsresult BeginArticle();
  nsresult ReadArticle(nsIInputStream *inputStream, uint32_t length);
  nsresult DisplayArticle(nsIInputStream *inputStream, uint32_t length);

  //////////////////////////////////////////////////////////////////////////////
  // News authentication code
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Sends the username via AUTHINFO USER, NNTP_BEGIN_AUTHORIZE.
   * This also handles the step of getting authentication credentials; if this
   * requires a prompt to run, the connection will be suspended and we will
   * come back to this point.
   * Followed by: NNTP_AUTHORIZE_RESPONSE if the username was sent
   *              NNTP_SUSPENDED          if we need to wait for the password
   */
  nsresult BeginAuthorization();
  /**
   * Sends the password if necessary, the state NNTP_AUTHORIZE_RESPONSE.
   * This also reads the result of the username.
   * Followed by: NNTP_PASSWORD_RESPONSE  if a password is sent
   *              NNTP_SEND_MODE_READER   if MODE READER needed auth
   *              SEND_FIRST_NNTP_COMMAND if any other command needed auth
   *              NNTP_ERROR              if the username was rejected
   */
  nsresult AuthorizationResponse();
  /**
   * This state, NNTP_PASSWORD_RESPONSE, reads the password.
   * Followed by: NNTP_SEND_MODE_READER   if MODE READER needed auth
   *              SEND_FIRST_NNTP_COMMAND if any other command needed auth
   *              NNTP_ERROR              if the password was rejected
   */
  nsresult PasswordResponse();

  nsresult BeginReadNewsList();
  nsresult ReadNewsList(nsIInputStream *inputStream, uint32_t length);

  // Newsgroup specific protocol handlers
  nsresult DisplayNewsgroups();
  nsresult BeginNewsgroups();
  nsresult ProcessNewsgroups(nsIInputStream *inputStream, uint32_t length);

  // Protocol handlers used for posting data
  nsresult PostData();
  nsresult PostDataResponse();

  nsresult CheckForArticle();

  /////////////////////////////////////////////////////////////////////////////
  // XHDR, XOVER, HEAD filtering process handlers
  // These are ordered by the rough order of usage
  /////////////////////////////////////////////////////////////////////////////
 
  /**
   * The first step in the filtering process, the state NNTP_XOVER_BEGIN.
   * This method sets up m_newsgroupList.
   * Followed by: NNTP_FIGURE_NEXT_CHUNK
   */
  nsresult BeginReadXover();
  /**
   * The loop control for filtering, the state NNTP_FIGURE_NEXT_CHUNK.
   * This method contacts the newsgroupList to figure out which articles to
   * download and then prepares it for XOVER support.
   * Followed by: NEWS_PROCESS_XOVER       if everything is finished
   *              NNTP_READ_GROUP          if XOVER doesn't work
   *              NNTP_XOVER_SEND          if XOVER does work
   */
  nsresult FigureNextChunk();

  // The XOVER process core
  /**
   * The state NNTP_XOVER_SEND, which actually sends the message.
   * Followed by: NNTP_XOVER_RESPONSE
   */
  nsresult XoverSend();
  /**
   * This state, NNTP_XOVER_RESPONSE, actually checks the XOVER capabiliity.
   * Followed by: NNTP_XOVER               if XOVER is supported
   *              NNTP_READ_GROUP          if it isn't
   */
  nsresult ReadXoverResponse();
  /**
   * This state, NNTP_XOVER, processes the results from the XOVER command.
   * It asks nsNNTPNewsgroupList to process the line using ProcessXOVERLINE.
   * Followed by: NNTP_XHDR_SEND
   */
  nsresult ReadXover(nsIInputStream *inputStream, uint32_t length);

  // The XHDR process core
  /**
   * This state, NNTP_XHDR_SEND, sends the XHDR command.
   * The headers are all managed by nsNNTPNewsgroupList, and this picks them up
   * one by one as they are needed.
   * Followed by: NNTP_XHDR_RESPONSE       if there is a header to be sent
   *              NNTP_FIGURE_NEXT_CHUNK   if all headers have been sent
   */
  nsresult XhdrSend();
  /**
   * This state, NNTP_XHDR_RESPONSE, processes the XHDR response.
   * It mostly passes the information off to nsNNTPNewsgroupList, and only does
   * response code checking and a bit of preprocessing. Note that if XHDR
   * doesn't work properly, HEAD fallback is switched on and all subsequent
   * chunks will NOT use XOVER.
   * Followed by: NNTP_READ_GROUP          if XHDR doesn't work properly
   *              NNTP_XHDR_SEND           when finished processing XHR.
   */
  nsresult XhdrResponse(nsIInputStream *inputStream);

  // HEAD processing core
  /**
   * This state, NNTP_READ_GROUP, is the control for the HEAD processor.
   * It sends the HEAD command and increments the article number until it is
   * finished. WARNING: HEAD is REALLY SLOW.
   * Followed by: NNTP_FIGURE_NEXT_CHUNK   when it is finished 
   *              NNTP_READ_GROUP_RESPONSE when it is not
   */
  nsresult ReadHeaders();
  /**
   * This state, NNTP_READ_GROUP_RESPONSE, checks if the article exists.
   * Because it is required by NNTP, if it doesn't work, the only problem would
   * be that the article doesn't exist. Passes off article number data to 
   * nsNNTPNewsgroupList.
   * Followed by: NNTP_READ_GROUP_BODY     if the article exists
   *              NNTP_READ_GROUP          if it doesn't.
   */
  nsresult ReadNewsgroupResponse();
  /**
   * This state, NNTP_READ_GROUP_BODY, reads the body of the HEAD command.
   * Once again, it passes information off to nsNNTPNewsgroupList.
   * Followed by: NNTP_READ_GROUP
   */
  nsresult ReadNewsgroupBody(nsIInputStream *inputStream, uint32_t length);

  /**
   * This state, NNTP_PROCESS_XOVER, is the final step of the filter-processing
   * code. Currently, all it does is cleans up the unread count and calls the
   * filters, both via nsNNTPNewsgroupList.
   * Followed by: NEWS_DONE
   */
  nsresult ProcessXover();



  // Canceling
  nsresult StartCancel();
  nsresult DoCancel();

  // XPAT
  nsresult XPATSend();
  nsresult XPATResponse(nsIInputStream *inputStream, uint32_t length);
  nsresult ListPrettyNames();
  nsresult ListPrettyNamesResponse(nsIInputStream *inputStream, uint32_t length);

  nsresult ListXActive();
  nsresult ListXActiveResponse(nsIInputStream *inputStream, uint32_t length);

  // for "?list-ids"
  nsresult SendListGroup();
  nsresult SendListGroupResponse(nsIInputStream *inputStream, uint32_t length);

  // Searching Protocol....
  nsresult Search();
  nsresult SearchResponse();
  nsresult SearchResults(nsIInputStream *inputStream, uint32_t length);

  //////////////////////////////////////////////////////////////////////////////
  // End of Protocol Methods
  //////////////////////////////////////////////////////////////////////////////

  nsresult ParseURL(nsIURI *aURL, nsCString &aGroup, nsCString &aMessageID);

  void SetProgressBarPercent(uint32_t aProgress, uint32_t aProgressMax);
  nsresult SetProgressStatus(const PRUnichar *aMessage);
  nsresult InitializeNewsFolderFromUri(const char *uri);
  void TimerCallback();

  void HandleAuthenticationFailure();
  nsCOMPtr <nsIInputStream> mInputStream;
  nsCOMPtr <nsITimer> mUpdateTimer;
  nsresult AlertError(int32_t errorCode, const char *text);
  int32_t mBytesReceived;
  int32_t mBytesReceivedSinceLastStatusUpdate;
  PRTime m_startTime;
  int32_t mNumGroupsListed;
  nsMsgKey m_key;

  nsresult SetCurrentGroup(); /* sets m_currentGroup.  should be called after doing a successful GROUP command */
  nsresult CleanupNewsgroupList(); /* cleans up m_newsgroupList, and set it to null */

  // cache related helper methods
  void FinishMemCacheEntry(bool valid); // either mark it valid, or doom it
  nsresult OpenCacheEntry(); // makes a request to the cache service for a cache entry for a url
  bool ReadFromLocalCache(); // attempts to read the url out of our local (offline) cache....
  nsresult ReadFromNewsConnection(); // creates a new news connection to read the url
  nsresult ReadFromMemCache(nsICacheEntryDescriptor *entry); // attempts to read the url out of our memory cache
  nsresult SetupPartExtractorListener(nsIStreamListener * aConsumer);
};


#endif  // nsNNTPProtocol_h___
