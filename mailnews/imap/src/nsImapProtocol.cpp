/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifdef MOZ_LOGGING
// sorry, this has to be before the pre-compiled header
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

// as does this
#include "msgCore.h"  // for pre-compiled headers
#include "nsMsgUtils.h"

#include "nsIServiceManager.h"
#include "nsICharsetConverterManager.h"
#include "nsIStringBundle.h"
#include "nsVersionComparator.h"

#include "nsMsgImapCID.h"
#include "nsThreadUtils.h"
#include "nsISupportsObsolete.h"
#include "nsIMsgStatusFeedback.h"
#include "nsImapCore.h"
#include "nsImapProtocol.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMAPHostSessionList.h"
#include "nsIMAPBodyShell.h"
#include "nsImapMailFolder.h"
#include "nsIMsgAccountManager.h"
#include "nsImapServerResponseParser.h"
#include "nspr.h"
#include "plbase64.h"
#include "nsIImapService.h"
#include "nsISocketTransportService.h"
#include "nsIStreamListenerTee.h"
#include "nsNetUtil.h"
#include "nsIDBFolderInfo.h"
#include "nsIPipe.h"
#include "nsIMsgFolder.h"
#include "nsMsgMessageFlags.h"
#include "nsImapStringBundle.h"
#include "nsICopyMsgStreamListener.h"
#include "nsTextFormatter.h"
#include "nsIMsgHdr.h"
#include "nsMsgI18N.h"
#include <algorithm>
// for the memory cache...
#include "nsICacheEntryDescriptor.h"
#include "nsICacheSession.h"
#include "nsIPrompt.h"
#include "nsIDocShell.h"
#include "nsIDocShellLoadInfo.h"
#include "nsIMessengerWindowService.h"
#include "nsIWindowMediator.h"
#include "nsIWindowWatcher.h"
#include "nsCOMPtr.h"
#include "nsMimeTypes.h"
#include "nsIInterfaceRequestor.h"
#include "nsXPCOMCIDInternal.h"
#include "nsIXULAppInfo.h"
#include "nsSyncRunnableHelpers.h"

PRLogModuleInfo *IMAP;

// netlib required files
#include "nsIStreamListener.h"
#include "nsIMsgIncomingServer.h"
#include "nsIImapIncomingServer.h"
#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "nsIPrefLocalizedString.h"
#include "nsImapUtils.h"
#include "nsIStreamConverterService.h"
#include "nsIProxyInfo.h"
#include "nsISSLSocketControl.h"
#include "nsProxyRelease.h"
#include "nsDebug.h"
#include "nsMsgCompressIStream.h"
#include "nsMsgCompressOStream.h"
#include "nsAlgorithm.h"
using namespace mozilla;

#define ONE_SECOND ((uint32_t)1000)    // one second

#define OUTPUT_BUFFER_SIZE (4096*2) // mscott - i should be able to remove this if I can use nsMsgLineBuffer???

#define IMAP_ENV_HEADERS "From To Cc Bcc Subject Date Message-ID "
#define IMAP_DB_HEADERS "Priority X-Priority References Newsgroups In-Reply-To Content-Type Reply-To"
#define IMAP_ENV_AND_DB_HEADERS IMAP_ENV_HEADERS IMAP_DB_HEADERS
static const PRIntervalTime kImapSleepTime = PR_MillisecondsToInterval(60000);
static int32_t gPromoteNoopToCheckCount = 0;
static const uint32_t kFlagChangesBeforeCheck = 10;
static const int32_t kMaxSecondsBeforeCheck = 600;

NS_IMPL_ISUPPORTS1(nsMsgImapHdrXferInfo, nsIImapHeaderXferInfo)

nsMsgImapHdrXferInfo::nsMsgImapHdrXferInfo()
  : m_hdrInfos(kNumHdrsToXfer)
{
  m_nextFreeHdrInfo = 0;
}

nsMsgImapHdrXferInfo::~nsMsgImapHdrXferInfo()
{
}

NS_IMETHODIMP nsMsgImapHdrXferInfo::GetNumHeaders(int32_t *aNumHeaders)
{
  *aNumHeaders = m_nextFreeHdrInfo;
  return NS_OK;
}

NS_IMETHODIMP nsMsgImapHdrXferInfo::GetHeader(int32_t hdrIndex, nsIImapHeaderInfo **aResult)
{
  // If the header index is more than (or equal to) our next free pointer, then
  // its a header we haven't really got and the caller has done something
  // wrong.
  NS_ENSURE_TRUE(hdrIndex < m_nextFreeHdrInfo, NS_ERROR_NULL_POINTER);

  *aResult = m_hdrInfos.SafeObjectAt(hdrIndex);
  if (!*aResult)
    return NS_ERROR_NULL_POINTER;

  NS_ADDREF(*aResult);
  return NS_OK;
}

static const int32_t kInitLineHdrCacheSize = 512; // should be about right

nsIImapHeaderInfo* nsMsgImapHdrXferInfo::StartNewHdr()
{
  if (m_nextFreeHdrInfo >= kNumHdrsToXfer)
    return nullptr;

  nsIImapHeaderInfo *result = m_hdrInfos.SafeObjectAt(m_nextFreeHdrInfo++);
  if (result)
    return result;

  nsMsgImapLineDownloadCache *lineCache = new nsMsgImapLineDownloadCache();
  if (!lineCache)
    return nullptr;

  lineCache->GrowBuffer(kInitLineHdrCacheSize);

  m_hdrInfos.AppendObject(lineCache);

  return lineCache;
}

// maybe not needed...
void nsMsgImapHdrXferInfo::FinishCurrentHdr()
{
  // nothing to do?
}

void nsMsgImapHdrXferInfo::ResetAll()
{
  int32_t count = m_hdrInfos.Count();
  for (int32_t i = 0; i < count; i++)
  {
    nsIImapHeaderInfo *hdrInfo = m_hdrInfos[i];
    if (hdrInfo)
      hdrInfo->ResetCache();
  }
  m_nextFreeHdrInfo = 0;
}

void nsMsgImapHdrXferInfo::ReleaseAll()
{
  m_hdrInfos.Clear();
  m_nextFreeHdrInfo = 0;
}

NS_IMPL_ISUPPORTS1(nsMsgImapLineDownloadCache, nsIImapHeaderInfo)

// **** helper class for downloading line ****
nsMsgImapLineDownloadCache::nsMsgImapLineDownloadCache()
{
    fLineInfo = (msg_line_info *) PR_CALLOC(sizeof( msg_line_info));
    fLineInfo->uidOfMessage = nsMsgKey_None;
    m_msgSize = 0;
}

nsMsgImapLineDownloadCache::~nsMsgImapLineDownloadCache()
{
    PR_Free( fLineInfo);
}

uint32_t nsMsgImapLineDownloadCache::CurrentUID()
{
    return fLineInfo->uidOfMessage;
}

uint32_t nsMsgImapLineDownloadCache::SpaceAvailable()
{
    return kDownLoadCacheSize - m_bufferPos;
}

msg_line_info *nsMsgImapLineDownloadCache::GetCurrentLineInfo()
{
  AppendBuffer("", 1); // null terminate the buffer
  fLineInfo->adoptedMessageLine = GetBuffer();
  return fLineInfo;
}

NS_IMETHODIMP nsMsgImapLineDownloadCache::ResetCache()
{
    ResetWritePos();
    return NS_OK;
}

bool nsMsgImapLineDownloadCache::CacheEmpty()
{
    return m_bufferPos == 0;
}

NS_IMETHODIMP nsMsgImapLineDownloadCache::CacheLine(const char *line, uint32_t uid)
{
    NS_ASSERTION((PL_strlen(line) + 1) <= SpaceAvailable(),
                 "Oops... line length greater than space available");

    fLineInfo->uidOfMessage = uid;

    AppendString(line);
    return NS_OK;
}

/* attribute nsMsgKey msgUid; */
NS_IMETHODIMP nsMsgImapLineDownloadCache::GetMsgUid(nsMsgKey *aMsgUid)
{
    *aMsgUid = fLineInfo->uidOfMessage;
    return NS_OK;
}
NS_IMETHODIMP nsMsgImapLineDownloadCache::SetMsgUid(nsMsgKey aMsgUid)
{
    fLineInfo->uidOfMessage = aMsgUid;
    return NS_OK;
}

/* attribute long msgSize; */
NS_IMETHODIMP nsMsgImapLineDownloadCache::GetMsgSize(int32_t *aMsgSize)
{
    *aMsgSize = m_msgSize;
    return NS_OK;
}

NS_IMETHODIMP nsMsgImapLineDownloadCache::SetMsgSize(int32_t aMsgSize)
{
    m_msgSize = aMsgSize;
    return NS_OK;
}

/* attribute string msgHdrs; */
NS_IMETHODIMP nsMsgImapLineDownloadCache::GetMsgHdrs(const char **aMsgHdrs)
{
  // this doesn't copy the string
    AppendBuffer("", 1); // null terminate the buffer
    *aMsgHdrs = GetBuffer();
    return NS_OK;
}

/* the following macros actually implement addref, release and query interface for our component. */

NS_IMPL_ADDREF_INHERITED(nsImapProtocol, nsMsgProtocol)
NS_IMPL_RELEASE_INHERITED(nsImapProtocol, nsMsgProtocol )

NS_INTERFACE_MAP_BEGIN(nsImapProtocol)
   NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIImapProtocol)
   NS_INTERFACE_MAP_ENTRY(nsIRunnable)
   NS_INTERFACE_MAP_ENTRY(nsIImapProtocol)
   NS_INTERFACE_MAP_ENTRY(nsIInputStreamCallback)
   NS_INTERFACE_MAP_ENTRY(nsISupportsWeakReference)
   NS_INTERFACE_MAP_ENTRY(nsIImapProtocolSink)
   NS_INTERFACE_MAP_ENTRY(nsIMsgAsyncPromptListener)
NS_INTERFACE_MAP_END_THREADSAFE

static int32_t gTooFastTime = 2;
static int32_t gIdealTime = 4;
static int32_t gChunkAddSize = 16384;
static int32_t gChunkSize = 250000;
static int32_t gChunkThreshold = gChunkSize + gChunkSize/2;
static bool gChunkSizeDirty = false;
static bool gFetchByChunks = true;
static bool gInitialized = false;
static bool gHideUnusedNamespaces = true;
static bool gHideOtherUsersFromList = false;
static bool gUseEnvelopeCmd = false;
static bool gUseLiteralPlus = true;
static bool gExpungeAfterDelete = false;
static bool gCheckDeletedBeforeExpunge = false; //bug 235004
static int32_t gResponseTimeout = 60;

// let delete model control expunging, i.e., don't ever expunge when the
// user chooses the imap delete model, otherwise, expunge when over the
// threshhold. This is the normal TB behavior.
static const int32_t kAutoExpungeDeleteModel = 0;
// Expunge whenever the folder is opened
static const int32_t kAutoExpungeAlways = 1;
// Expunge when over the threshhold, independent of the delete model.
static const int32_t kAutoExpungeOnThreshold = 2;
static int32_t gExpungeOption = kAutoExpungeDeleteModel;
static int32_t gExpungeThreshold = 20;

const int32_t kAppBufSize = 100;
// can't use static nsCString because it shows up as a leak.
static char gAppName[kAppBufSize];
static char gAppVersion[kAppBufSize];

nsresult nsImapProtocol::GlobalInitialization(nsIPrefBranch *aPrefBranch)
{
    gInitialized = true;

    aPrefBranch->GetIntPref("mail.imap.chunk_fast", &gTooFastTime);   // secs we read too little too fast
    aPrefBranch->GetIntPref("mail.imap.chunk_ideal", &gIdealTime);    // secs we read enough in good time
    aPrefBranch->GetIntPref("mail.imap.chunk_add", &gChunkAddSize);   // buffer size to add when wasting time
    aPrefBranch->GetIntPref("mail.imap.chunk_size", &gChunkSize);
    aPrefBranch->GetIntPref("mail.imap.min_chunk_size_threshold",
                            &gChunkThreshold);
    aPrefBranch->GetBoolPref("mail.imap.hide_other_users",
                             &gHideOtherUsersFromList);
    aPrefBranch->GetBoolPref("mail.imap.hide_unused_namespaces",
                             &gHideUnusedNamespaces);
    aPrefBranch->GetIntPref("mail.imap.noop_check_count",
                            &gPromoteNoopToCheckCount);
    aPrefBranch->GetBoolPref("mail.imap.use_envelope_cmd",
                             &gUseEnvelopeCmd);
    aPrefBranch->GetBoolPref("mail.imap.use_literal_plus", &gUseLiteralPlus);
    aPrefBranch->GetBoolPref("mail.imap.expunge_after_delete",
                             &gExpungeAfterDelete);
    aPrefBranch->GetBoolPref("mail.imap.check_deleted_before_expunge",
                             &gCheckDeletedBeforeExpunge);
    aPrefBranch->GetIntPref("mail.imap.expunge_option", &gExpungeOption);
    aPrefBranch->GetIntPref("mail.imap.expunge_threshold_number",
                            &gExpungeThreshold);
    aPrefBranch->GetIntPref("mailnews.tcptimeout", &gResponseTimeout);
    nsCOMPtr<nsIXULAppInfo> appInfo(do_GetService(XULAPPINFO_SERVICE_CONTRACTID));

    if (appInfo)
    {
      nsCString appName, appVersion;
      appInfo->GetName(appName);
      appInfo->GetVersion(appVersion);
      PL_strncpyz(gAppName, appName.get(), kAppBufSize);
      PL_strncpyz(gAppVersion, appVersion.get(), kAppBufSize);
    }
    return NS_OK;
}

nsImapProtocol::nsImapProtocol() : nsMsgProtocol(nullptr),
    m_dataAvailableMonitor("imapDataAvailable"),
    m_urlReadyToRunMonitor("imapUrlReadyToRun"),
    m_pseudoInterruptMonitor("imapPseudoInterrupt"),
    m_dataMemberMonitor("imapDataMember"),
    m_threadDeathMonitor("imapThreadDeath"),
    m_waitForBodyIdsMonitor("imapWaitForBodyIds"),
    m_fetchBodyListMonitor("imapFetchBodyList"),
    m_passwordReadyMonitor("imapPasswordReady"),
    mLock("nsImapProtocol.mLock"),
    m_parser(*this)
{
  m_urlInProgress = false;
  m_idle = false;
  m_retryUrlOnError = false;
  m_useIdle = true; // by default, use it
  m_useCondStore = true;
  m_useCompressDeflate = true;
  m_ignoreExpunges = false;
  m_prefAuthMethods = kCapabilityUndefined;
  m_failedAuthMethods = 0;
  m_currentAuthMethod = kCapabilityUndefined;
  m_socketType = nsMsgSocketType::trySTARTTLS;
  m_connectionStatus = NS_OK;
  m_safeToCloseConnection = false;
  m_hostSessionList = nullptr;
  m_flagState = nullptr;
  m_fetchBodyIdList = nullptr;
  m_isGmailServer = false;
  m_fetchingWholeMessage = false;

  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
  NS_ASSERTION(prefBranch, "FAILED to create the preference service");

  // read in the accept languages preference
  if (prefBranch)
  {
    if (!gInitialized)
      GlobalInitialization(prefBranch);

    nsCOMPtr<nsIPrefLocalizedString> prefString;
    prefBranch->GetComplexValue("intl.accept_languages",
                                NS_GET_IID(nsIPrefLocalizedString),
                                getter_AddRefs(prefString));
    if (prefString)
      prefString->ToString(getter_Copies(mAcceptLanguages));

    nsCString customDBHeaders;
    prefBranch->GetCharPref("mailnews.customDBHeaders",
                            getter_Copies(customDBHeaders));

    ParseString(customDBHeaders, ' ', mCustomDBHeaders);
    prefBranch->GetBoolPref("mailnews.display.prefer_plaintext", &m_preferPlainText);

    nsAutoCString customHeaders;;
    prefBranch->GetCharPref("mailnews.customHeaders",
                            getter_Copies(customHeaders));
    customHeaders.StripWhitespace();
    ParseString(customHeaders, ':', mCustomHeaders);
  }

    // ***** Thread support *****
  m_thread = nullptr;
  m_imapThreadIsRunning = false;
  m_currentServerCommandTagNumber = 0;
  m_active = false;
  m_folderNeedsSubscribing = false;
  m_folderNeedsACLRefreshed = false;
  m_threadShouldDie = false;
  m_inThreadShouldDie = false;
  m_pseudoInterrupted = false;
  m_nextUrlReadyToRun = false;
  m_trackingTime = false;
  m_curFetchSize = 0;
  m_startTime = 0;
  m_endTime = 0;
  m_lastActiveTime = 0;
  m_lastProgressTime = 0;
  ResetProgressInfo();

  m_tooFastTime = 0;
  m_idealTime = 0;
  m_chunkAddSize = 0;
  m_chunkStartSize = 0;
  m_fetchByChunks = true;
  m_sendID = true;
  m_chunkSize = 0;
  m_chunkThreshold = 0;
  m_fromHeaderSeen = false;
  m_closeNeededBeforeSelect = false;
  m_needNoop = false;
  m_noopCount = 0;
  m_fetchBodyListIsNew = false;
  m_flagChangeCount = 0;
  m_lastCheckTime = PR_Now();

  m_checkForNewMailDownloadsHeaders = true;  // this should be on by default
  m_hierarchyNameState = kNoOperationInProgress;
  m_discoveryStatus = eContinue;

  m_overRideUrlConnectionInfo = false;
  // m_dataOutputBuf is used by Send Data
  m_dataOutputBuf = (char *) PR_CALLOC(sizeof(char) * OUTPUT_BUFFER_SIZE);
  m_allocatedSize = OUTPUT_BUFFER_SIZE;

  // used to buffer incoming data by ReadNextLine
  m_inputStreamBuffer = new nsMsgLineStreamBuffer(OUTPUT_BUFFER_SIZE, true /* allocate new lines */, false /* leave CRLFs on the returned string */);
  m_currentBiffState = nsIMsgFolder::nsMsgBiffState_Unknown;
  m_progressStringName.Truncate();

  // since these are embedded in the nsImapProtocol object, but passed
  // through proxied xpcom methods, just AddRef them here.
  m_hdrDownloadCache = new nsMsgImapHdrXferInfo();
  m_downloadLineCache = new nsMsgImapLineDownloadCache();

  // subscription
  m_autoSubscribe = true;
  m_autoUnsubscribe = true;
  m_autoSubscribeOnOpen = true;
  m_deletableChildren = nullptr;

  mFolderLastModSeq = 0;

  Configure(gTooFastTime, gIdealTime, gChunkAddSize, gChunkSize,
                    gChunkThreshold, gFetchByChunks);

  // where should we do this? Perhaps in the factory object?
  if (!IMAP)
    IMAP = PR_NewLogModule("IMAP");
}

nsresult nsImapProtocol::Configure(int32_t TooFastTime, int32_t IdealTime,
                  int32_t ChunkAddSize, int32_t ChunkSize, int32_t ChunkThreshold,
                  bool FetchByChunks)
{
  m_tooFastTime = TooFastTime;    // secs we read too little too fast
  m_idealTime = IdealTime;    // secs we read enough in good time
  m_chunkAddSize = ChunkAddSize;    // buffer size to add when wasting time
  m_chunkStartSize = m_chunkSize = ChunkSize;
  m_chunkThreshold = ChunkThreshold;
  m_fetchByChunks = FetchByChunks;

  return NS_OK;
}


NS_IMETHODIMP
nsImapProtocol::Initialize(nsIImapHostSessionList * aHostSessionList,
                           nsIImapIncomingServer *aServer)
{
  NS_PRECONDITION(aHostSessionList && aServer,
     "oops...trying to initialize with a null host session list or server!");
  if (!aHostSessionList || !aServer)
    return NS_ERROR_NULL_POINTER;

  nsresult rv = m_downloadLineCache->GrowBuffer(kDownLoadCacheSize);
  NS_ENSURE_SUCCESS(rv, rv);

  m_flagState = new nsImapFlagAndUidState(kImapFlagAndUidStateSize);
  if (!m_flagState)
    return NS_ERROR_OUT_OF_MEMORY;

  aServer->GetUseIdle(&m_useIdle);
  aServer->GetUseCondStore(&m_useCondStore);
  aServer->GetUseCompressDeflate(&m_useCompressDeflate);
  NS_ADDREF(m_flagState);

  m_hostSessionList = aHostSessionList; // no ref count...host session list has life time > connection
  m_parser.SetHostSessionList(aHostSessionList);
  m_parser.SetFlagState(m_flagState);

  // one of the initializations that should be done in UI thread
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));

  // Now initialize the thread for the connection
  if (m_thread == nullptr)
  {
    nsresult rv = NS_NewThread(getter_AddRefs(m_iThread), this);
    if (NS_FAILED(rv))
    {
      NS_ASSERTION(m_iThread, "Unable to create imap thread.\n");
      return rv;
    }
    m_iThread->GetPRThread(&m_thread);

  }
  return NS_OK;
}

nsImapProtocol::~nsImapProtocol()
{
  PR_Free(m_fetchBodyIdList);

  NS_IF_RELEASE(m_flagState);

  PR_Free(m_dataOutputBuf);
  delete m_inputStreamBuffer;

  // **** We must be out of the thread main loop function
  NS_ASSERTION(!m_imapThreadIsRunning, "Oops, thread is still running.\n");
}

const nsCString&
nsImapProtocol::GetImapHostName()
{
  if (m_runningUrl && m_hostName.IsEmpty())
  {
    nsCOMPtr<nsIURI> url = do_QueryInterface(m_runningUrl);
    url->GetAsciiHost(m_hostName);
  }

  return m_hostName;
}

const nsCString&
nsImapProtocol::GetImapUserName()
{
  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryReferent(m_server);
  if (m_userName.IsEmpty() && server)
    server->GetUsername(m_userName);
  return m_userName;
}

const char*
nsImapProtocol::GetImapServerKey()
{
  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryReferent(m_server);
  if (m_serverKey.IsEmpty() && server)
    server->GetKey(m_serverKey);
  return m_serverKey.get();
}

void
nsImapProtocol::SetupSinkProxy()
{
  nsresult res;
  if (m_runningUrl)
  {
    if (!m_imapMailFolderSink)
    {
      nsCOMPtr<nsIImapMailFolderSink> aImapMailFolderSink;
      (void) m_runningUrl->GetImapMailFolderSink(getter_AddRefs(aImapMailFolderSink));
      if (aImapMailFolderSink)
      {
        m_imapMailFolderSink = new ImapMailFolderSinkProxy(aImapMailFolderSink);
      }
    }

    if (!m_imapMessageSink)
    {
      nsCOMPtr<nsIImapMessageSink> aImapMessageSink;
      (void) m_runningUrl->GetImapMessageSink(getter_AddRefs(aImapMessageSink));
      m_imapMessageSink = new ImapMessageSinkProxy(aImapMessageSink);
    }
    if (!m_imapServerSink)
    {
       nsCOMPtr<nsIImapServerSink> aImapServerSink;
       res = m_runningUrl->GetImapServerSink(getter_AddRefs(aImapServerSink));
       m_imapServerSink = new ImapServerSinkProxy(aImapServerSink);
    }
    if (!m_imapProtocolSink)
    {
      nsCOMPtr<nsIImapProtocolSink> anImapProxyHelper(do_QueryInterface(NS_ISUPPORTS_CAST(nsIImapProtocolSink*, this), &res));
      m_imapProtocolSink = new ImapProtocolSinkProxy(anImapProxyHelper);
    }
  }
}

static void SetSecurityCallbacksFromChannel(nsISocketTransport* aTrans, nsIChannel* aChannel)
{
  nsCOMPtr<nsIInterfaceRequestor> callbacks;
  aChannel->GetNotificationCallbacks(getter_AddRefs(callbacks));

  nsCOMPtr<nsILoadGroup> loadGroup;
  aChannel->GetLoadGroup(getter_AddRefs(loadGroup));

  nsCOMPtr<nsIInterfaceRequestor> securityCallbacks;
  MsgNewNotificationCallbacksAggregation(callbacks, loadGroup,
                                         getter_AddRefs(securityCallbacks));
  if (securityCallbacks)
    aTrans->SetSecurityCallbacks(securityCallbacks);
}

// Setup With Url is intended to set up data which is held on a PER URL basis and not
// a per connection basis. If you have data which is independent of the url we are currently
// running, then you should put it in Initialize().
// This is only ever called from the UI thread. It is called from LoadUrl, right
// before the url gets run - i.e., the url is next in line to run.
nsresult nsImapProtocol::SetupWithUrl(nsIURI * aURL, nsISupports* aConsumer)
{
  nsresult rv = NS_ERROR_FAILURE;
  NS_PRECONDITION(aURL, "null URL passed into Imap Protocol");
  if (aURL)
  {
    m_runningUrl = do_QueryInterface(aURL, &rv);
    if (NS_FAILED(rv)) return rv;
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningUrl);
    nsCOMPtr<nsIMsgIncomingServer> server = do_QueryReferent(m_server);
    if (!server)
    {
      rv = mailnewsUrl->GetServer(getter_AddRefs(server));
      NS_ENSURE_SUCCESS(rv, rv);
      m_server = do_GetWeakReference(server);
    }
    nsCOMPtr <nsIMsgFolder> folder;
    mailnewsUrl->GetFolder(getter_AddRefs(folder));
    mFolderLastModSeq = 0;
    mFolderTotalMsgCount = 0;
    mFolderHighestUID = 0;
    m_uidValidity = kUidUnknown;
    if (folder)
    {
      nsCOMPtr<nsIMsgDatabase> folderDB;
      nsCOMPtr<nsIDBFolderInfo> folderInfo;
      folder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(folderDB));
      if (folderInfo)
      {
        nsCString modSeqStr;
        folderInfo->GetCharProperty(kModSeqPropertyName, modSeqStr);
        mFolderLastModSeq = ParseUint64Str(modSeqStr.get());
        folderInfo->GetNumMessages(&mFolderTotalMsgCount);
        folderInfo->GetUint32Property(kHighestRecordedUIDPropertyName, 0, &mFolderHighestUID);
        folderInfo->GetImapUidValidity(&m_uidValidity);
      }
    }
    nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryInterface(server);
    nsCOMPtr<nsIStreamListener> aRealStreamListener = do_QueryInterface(aConsumer);
    m_runningUrl->GetMockChannel(getter_AddRefs(m_mockChannel));
    imapServer->GetIsGMailServer(&m_isGmailServer);
    if (!m_mockChannel)
    {
      // there are several imap operations that aren't initiated via a nsIChannel::AsyncOpen call on the mock channel.
      // such as selecting a folder. nsImapProtocol now insists on a mock channel when processing a url.
      nsCOMPtr<nsIChannel> channel;
      rv = NS_NewChannel(getter_AddRefs(channel), aURL, nullptr, nullptr, nullptr, 0);
      m_mockChannel = do_QueryInterface(channel);

      // Certain imap operations (not initiated by the IO Service via AsyncOpen) can be interrupted by  the stop button on the toolbar.
      // We do this by using the loadgroup of the docshell for the message pane. We really shouldn't be doing this..
      // See the comment in nsMsgMailNewsUrl::GetLoadGroup.
      nsCOMPtr<nsILoadGroup> loadGroup;
      mailnewsUrl->GetLoadGroup(getter_AddRefs(loadGroup)); // get the message pane load group
      nsCOMPtr<nsIRequest> ourRequest = do_QueryInterface(m_mockChannel);
      if (loadGroup)
        loadGroup->AddRequest(ourRequest, nullptr /* context isupports */);
    }

    if (m_mockChannel)
    {
      m_mockChannel->SetImapProtocol(this);
      // if we have a listener from a mock channel, over-ride the consumer that was passed in
      nsCOMPtr<nsIStreamListener> channelListener;
      m_mockChannel->GetChannelListener(getter_AddRefs(channelListener));
      if (channelListener) // only over-ride if we have a non null channel listener
        aRealStreamListener = channelListener;
      m_mockChannel->GetChannelContext(getter_AddRefs(m_channelContext));
      nsCOMPtr<nsIMsgWindow> msgWindow;
      GetMsgWindow(getter_AddRefs(msgWindow));
      if (!msgWindow)
        GetTopmostMsgWindow(getter_AddRefs(msgWindow));
      if (msgWindow)
      {
        nsCOMPtr<nsIDocShell> docShell;
        msgWindow->GetMessageWindowDocShell(getter_AddRefs(docShell));
        nsCOMPtr<nsIInterfaceRequestor> ir(do_QueryInterface(docShell));
        nsCOMPtr<nsIInterfaceRequestor> interfaceRequestor;
        msgWindow->GetNotificationCallbacks(getter_AddRefs(interfaceRequestor));
        nsCOMPtr<nsIInterfaceRequestor> aggregateIR;
        MsgNewInterfaceRequestorAggregation(interfaceRequestor, ir, getter_AddRefs(aggregateIR));
        m_mockChannel->SetNotificationCallbacks(aggregateIR);
      }
    }

    // since we'll be making calls directly from the imap thread to the channel listener,
    // we need to turn it into a proxy object....we'll assume that the listener is on the same thread
    // as the event sink queue
    if (aRealStreamListener)
    {
      NS_ASSERTION(!m_channelListener, "shouldn't already have a channel listener");
      m_channelListener = new StreamListenerProxy(aRealStreamListener);
    }

    server->GetRealHostName(m_realHostName);
    int32_t authMethod;
    (void) server->GetAuthMethod(&authMethod);
    InitPrefAuthMethods(authMethod);
    (void) server->GetSocketType(&m_socketType);
    bool shuttingDown;
    (void) imapServer->GetShuttingDown(&shuttingDown);
    if (!shuttingDown)
      (void) imapServer->GetUseIdle(&m_useIdle);
    else
      m_useIdle = false;
    imapServer->GetFetchByChunks(&m_fetchByChunks);
    imapServer->GetSendID(&m_sendID);

    nsAutoString trashFolderName;
    if (NS_SUCCEEDED(imapServer->GetTrashFolderName(trashFolderName)))
      CopyUTF16toMUTF7(trashFolderName, m_trashFolderName);

    nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
    if (prefBranch)
    {
      bool preferPlainText;
      prefBranch->GetBoolPref("mailnews.display.prefer_plaintext", &preferPlainText);
      // If the pref has changed since the last time we ran a url,
      // clear the shell cache for this host.
      if (preferPlainText != m_preferPlainText)
      {
        m_hostSessionList->ClearShellCacheForHost(GetImapServerKey());
        m_preferPlainText = preferPlainText;
      }
    }

    if ( m_runningUrl && !m_transport /* and we don't have a transport yet */)
    {
      // extract the file name and create a file transport...
      int32_t port=-1;
      server->GetPort(&port);

      if (port <= 0)
      {
        int32_t socketType;
        // Be a bit smarter about setting the default port
        port = (NS_SUCCEEDED(server->GetSocketType(&socketType)) &&
                socketType == nsMsgSocketType::SSL) ?
               nsIImapUrl::DEFAULT_IMAPS_PORT : nsIImapUrl::DEFAULT_IMAP_PORT;
      }
      nsCOMPtr<nsISocketTransportService> socketService =
               do_GetService(NS_SOCKETTRANSPORTSERVICE_CONTRACTID, &rv);
      if (NS_SUCCEEDED(rv) && aURL)
      {
        aURL->GetPort(&port);

        Log("SetupWithUrl", nullptr, "clearing IMAP_CONNECTION_IS_OPEN");
        ClearFlag(IMAP_CONNECTION_IS_OPEN);
        const char *connectionType = nullptr;

        if (m_socketType == nsMsgSocketType::SSL)
          connectionType = "ssl";
        else if (m_socketType == nsMsgSocketType::alwaysSTARTTLS)
          connectionType = "starttls";
        // This can go away once we think everyone is migrated
        // away from the trySTARTTLS socket type.
        else if (m_socketType == nsMsgSocketType::trySTARTTLS)
          connectionType =  "starttls";

        nsCOMPtr<nsIProxyInfo> proxyInfo;
        rv = MsgExamineForProxy("imap", m_realHostName.get(), port, getter_AddRefs(proxyInfo));
        if (NS_FAILED(rv))
          proxyInfo = nullptr;

        const nsACString *socketHost;
        uint16_t socketPort;

        if (m_overRideUrlConnectionInfo)
        {
          socketHost = &m_logonHost;
          socketPort = m_logonPort;
        }
        else
        {
          socketHost = &m_realHostName;
          socketPort = port;
        }
        rv = socketService->CreateTransport(&connectionType, connectionType != nullptr,
                                            *socketHost, socketPort, proxyInfo,
                                            getter_AddRefs(m_transport));
        if (NS_FAILED(rv) && m_socketType == nsMsgSocketType::trySTARTTLS)
        {
          connectionType = nullptr;
          m_socketType = nsMsgSocketType::plain;
          rv = socketService->CreateTransport(&connectionType, connectionType != nullptr,
                                              *socketHost, socketPort, proxyInfo,
                                              getter_AddRefs(m_transport));
        }
        // remember so we can know whether we can issue a start tls or not...
        m_connectionType = connectionType;
        if (m_transport && m_mockChannel)
        {
          uint8_t qos;
          rv = GetQoSBits(&qos);
          if (NS_SUCCEEDED(rv))
            m_transport->SetQoSBits(qos);

          // Ensure that the socket can get the notification callbacks
          SetSecurityCallbacksFromChannel(m_transport, m_mockChannel);

          // open buffered, blocking input stream
          rv = m_transport->OpenInputStream(nsITransport::OPEN_BLOCKING, 0, 0, getter_AddRefs(m_inputStream));
          if (NS_FAILED(rv)) return rv;

          // open buffered, blocking output stream
          rv = m_transport->OpenOutputStream(nsITransport::OPEN_BLOCKING, 0, 0, getter_AddRefs(m_outputStream));
          if (NS_FAILED(rv)) return rv;
          SetFlag(IMAP_CONNECTION_IS_OPEN);
        }
      }
    } // if m_runningUrl

    if (m_transport && m_mockChannel)
    {
      m_transport->SetTimeout(nsISocketTransport::TIMEOUT_CONNECT, gResponseTimeout + 60);
      int32_t readWriteTimeout = gResponseTimeout;
      if (m_runningUrl)
      {
        m_runningUrl->GetImapAction(&m_imapAction);
        // this is a silly hack, but the default of 100 seconds is way too long
        // for things like APPEND, which should come back immediately.
        if (m_imapAction == nsIImapUrl::nsImapAppendMsgFromFile ||
            m_imapAction == nsIImapUrl::nsImapAppendDraftFromFile)
        {
          readWriteTimeout = 20;
        }
        else if (m_imapAction == nsIImapUrl::nsImapOnlineMove ||
                 m_imapAction == nsIImapUrl::nsImapOnlineCopy)
        {
          nsCString messageIdString;
          m_runningUrl->GetListOfMessageIds(messageIdString);
          uint32_t copyCount = CountMessagesInIdString(messageIdString.get());
          // If we're move/copying a large number of messages,
          // which should be rare, increase the timeout based on number
          // of messages. 40 messages per second should be sufficiently slow.
          if (copyCount > 2400) // 40 * 60, 60 is default read write timeout
            readWriteTimeout = std::max(readWriteTimeout, (int32_t)copyCount/40);
        }
      }
      m_transport->SetTimeout(nsISocketTransport::TIMEOUT_READ_WRITE, readWriteTimeout);
      // set the security info for the mock channel to be the security status for our underlying transport.
      nsCOMPtr<nsISupports> securityInfo;
      m_transport->GetSecurityInfo(getter_AddRefs(securityInfo));
      m_mockChannel->SetSecurityInfo(securityInfo);

      SetSecurityCallbacksFromChannel(m_transport, m_mockChannel);

      nsCOMPtr<nsITransportEventSink> sink = do_QueryInterface(m_mockChannel);
      if (sink) {
        nsCOMPtr<nsIThread> thread = do_GetMainThread();
        m_transport->SetEventSink(sink, thread);
      }

      // and if we have a cache entry that we are saving the message to, set the security info on it too.
      // since imap only uses the memory cache, passing this on is the right thing to do.
      nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningUrl);
      if (mailnewsUrl)
      {
        nsCOMPtr<nsICacheEntryDescriptor> cacheEntry;
        mailnewsUrl->GetMemCacheEntry(getter_AddRefs(cacheEntry));
        if (cacheEntry)
          cacheEntry->SetSecurityInfo(securityInfo);
      }
    }
  } // if aUR

  return rv;
}


// when the connection is done processing the current state, free any per url state data...
void nsImapProtocol::ReleaseUrlState(bool rerunning)
{
  // clear out the socket's reference to the notification callbacks for this transaction
  {
    MutexAutoLock mon(mLock);
    if (m_transport)
    {
      m_transport->SetSecurityCallbacks(nullptr);
      m_transport->SetEventSink(nullptr, nullptr);
    }
  }

  if (m_mockChannel && !rerunning)
  {
    // Proxy the close of the channel to the ui thread.
    if (m_imapMailFolderSink)
      m_imapMailFolderSink->CloseMockChannel(m_mockChannel);
    else
      m_mockChannel->Close();

    {
      // grab a lock so m_mockChannel doesn't get cleared out
      // from under us.
      MutexAutoLock mon(mLock);
      if (m_mockChannel)
      {
        // Proxy the release of the channel to the main thread.  This is something
        // that the xpcom proxy system should do for us!
        nsCOMPtr<nsIThread> thread = do_GetMainThread();
        nsIImapMockChannel *doomed = nullptr;
        m_mockChannel.swap(doomed);
        NS_ProxyRelease(thread, doomed);
      }
    }
  }

  m_channelContext = nullptr; // this might be the url - null it out before the final release of the url
  m_imapMessageSink = nullptr;

  // Proxy the release of the listener to the main thread.  This is something
  // that the xpcom proxy system should do for us!
  {
    // grab a lock so the m_channelListener doesn't get cleared.
    MutexAutoLock mon(mLock);
    if (m_channelListener)
    {
      nsCOMPtr<nsIThread> thread = do_GetMainThread();
      nsIStreamListener *doomed = nullptr;
      m_channelListener.swap(doomed);
      NS_ProxyRelease(thread, doomed);
    }
  }
  m_channelInputStream = nullptr;
  m_channelOutputStream = nullptr;

  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsurl;
  nsCOMPtr<nsIImapMailFolderSink> saveFolderSink;

  {
    MutexAutoLock mon(mLock);
    if (m_runningUrl)
    {
      mailnewsurl = do_QueryInterface(m_runningUrl);
      saveFolderSink = m_imapMailFolderSink;

      m_runningUrl = nullptr; // force us to release our last reference on the url
      m_urlInProgress = false;
    }
  }
  // Need to null this out whether we have an m_runningUrl or not
  m_imapMailFolderSink = nullptr;

  // we want to make sure the imap protocol's last reference to the url gets released
  // back on the UI thread. This ensures that the objects the imap url hangs on to
  // properly get released back on the UI thread.
  if (saveFolderSink)
  {
    nsCOMPtr<nsIThread> thread = do_GetMainThread();
    nsIMsgMailNewsUrl *doomed = nullptr;
    mailnewsurl.swap(doomed);
    NS_ProxyRelease(thread, doomed);
    saveFolderSink = nullptr;
  }
}


class nsImapThreadShutdownEvent : public nsRunnable {
public:
  nsImapThreadShutdownEvent(nsIThread *thread) : mThread(thread) {
  }
  NS_IMETHOD Run() {
    mThread->Shutdown();
    return NS_OK;
  }
private:
  nsCOMPtr<nsIThread> mThread;
};


NS_IMETHODIMP nsImapProtocol::Run()
{
  PR_CEnterMonitor(this);
  NS_ASSERTION(!m_imapThreadIsRunning,
                 "Oh. oh. thread is already running. What's wrong here?");
    if (m_imapThreadIsRunning)
    {
        PR_CExitMonitor(this);
        return NS_OK;
    }

  m_imapThreadIsRunning = true;
  PR_CExitMonitor(this);

  // call the platform specific main loop ....
  ImapThreadMainLoop();

  if (m_runningUrl)
  {
    nsCOMPtr<nsIThread> thread = do_GetMainThread();
    nsIImapUrl *doomed = nullptr;
    m_runningUrl.swap(doomed);
    NS_ProxyRelease(thread, doomed);
  }

  // close streams via UI thread if it's not already done
  if (m_imapProtocolSink)
    m_imapProtocolSink->CloseStreams();

  m_imapMailFolderSink = nullptr;
  m_imapMessageSink = nullptr;

  // shutdown this thread, but do it from the main thread
  nsCOMPtr<nsIRunnable> ev = new nsImapThreadShutdownEvent(m_iThread);
  if (NS_FAILED(NS_DispatchToMainThread(ev)))
    NS_WARNING("Failed to dispatch nsImapThreadShutdownEvent");
  m_iThread = nullptr;
  return NS_OK;
}

//
// Must be called from UI thread only
//
NS_IMETHODIMP nsImapProtocol::CloseStreams()
{
  // make sure that it is called by the UI thread
  NS_ABORT_IF_FALSE(NS_IsMainThread(), "CloseStreams() should not be called from an off UI thread");

  {
    MutexAutoLock mon(mLock);
    if (m_transport)
    {
        // make sure the transport closes (even if someone is still indirectly
        // referencing it).
        m_transport->Close(NS_ERROR_ABORT);
        m_transport = nullptr;
    }
    m_inputStream = nullptr;
    m_outputStream = nullptr;
    m_channelListener = nullptr;
    m_channelContext = nullptr;
    if (m_mockChannel)
    {
        m_mockChannel->Close();
        m_mockChannel = nullptr;
    }
    m_channelInputStream = nullptr;
    m_channelOutputStream = nullptr;

    // Close scope because we must let go of the monitor before calling
    // RemoveConnection to unblock anyone who tries to get a monitor to the
    // protocol object while holding onto a monitor to the server.
  }
  nsCOMPtr<nsIMsgIncomingServer> me_server = do_QueryReferent(m_server);
  if (me_server)
  {
      nsresult result;
      nsCOMPtr<nsIImapIncomingServer>
          aImapServer(do_QueryInterface(me_server, &result));
      if (NS_SUCCEEDED(result))
          aImapServer->RemoveConnection(this);
      me_server = nullptr;
  }
  m_server = nullptr;
  // take this opportunity of being on the UI thread to
  // persist chunk prefs if they've changed
  if (gChunkSizeDirty)
  {
    nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
    if (prefBranch)
    {
      prefBranch->SetIntPref("mail.imap.chunk_size", gChunkSize);
      prefBranch->SetIntPref("mail.imap.min_chunk_size_threshold", gChunkThreshold);
      gChunkSizeDirty = false;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsImapProtocol::GetUrlWindow(nsIMsgMailNewsUrl *aUrl,
                                           nsIMsgWindow **aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aUrl);
  NS_ENSURE_ARG_POINTER(aMsgWindow);
  return aUrl->GetMsgWindow(aMsgWindow);
}

NS_IMETHODIMP nsImapProtocol::OnInputStreamReady(nsIAsyncInputStream *inStr)
{
  // should we check if it's a close vs. data available?
  if (m_idle)
  {
    uint64_t bytesAvailable = 0;
    (void) inStr->Available(&bytesAvailable);
    // check if data available - might be a close
    if (bytesAvailable != 0)
    {
      ReentrantMonitorAutoEnter mon(m_urlReadyToRunMonitor);
      m_lastActiveTime = PR_Now();
      m_nextUrlReadyToRun = true;
      mon.Notify();
    }
  }
  return NS_OK;
}

// this is to be called from the UI thread. It sets m_threadShouldDie,
// and then signals the imap thread, which, when it wakes up, should exit.
// The imap thread cleanup code will check m_safeToCloseConnection.
NS_IMETHODIMP
nsImapProtocol::TellThreadToDie(bool aIsSafeToClose)
{
  NS_WARN_IF_FALSE(NS_IsMainThread(),
                   "TellThreadToDie(aIsSafeToClose) should only be called from UI thread");
  MutexAutoLock mon(mLock);

  nsCOMPtr<nsIMsgIncomingServer> me_server = do_QueryReferent(m_server);
  if (me_server)
  {
    nsresult rv;
    nsCOMPtr<nsIImapIncomingServer>
      aImapServer(do_QueryInterface(me_server, &rv));
    if (NS_SUCCEEDED(rv))
      aImapServer->RemoveConnection(this);
    m_server = nullptr;
    me_server = nullptr;
  }
  {
    ReentrantMonitorAutoEnter deathMon(m_threadDeathMonitor);
    m_safeToCloseConnection = aIsSafeToClose;
    m_threadShouldDie = true;
  }
  ReentrantMonitorAutoEnter readyMon(m_urlReadyToRunMonitor);
  m_nextUrlReadyToRun = true;
  readyMon.Notify();
  return NS_OK;
}

void
nsImapProtocol::TellThreadToDie()
{
  nsresult rv = NS_OK;
  NS_WARN_IF_FALSE(!NS_IsMainThread(),
                   "TellThreadToDie() should not be called from UI thread");

  // prevent re-entering this method because it may lock the UI.
  if (m_inThreadShouldDie)
    return;
  m_inThreadShouldDie = true;

  // This routine is called only from the imap protocol thread.
  // The UI thread causes this to be called by calling TellThreadToDie.
  // In that case, m_safeToCloseConnection will be FALSE if it's dropping a
  // timed out connection, true when closing a cached connection.
  // We're using PR_CEnter/ExitMonitor because Monitors don't like having
  // us to hold one monitor and call code that gets a different monitor. And
  // some of the methods we call here use Monitors.
  PR_CEnterMonitor(this);

  m_urlInProgress = true;  // let's say it's busy so no one tries to use
                                // this about to die connection.
  bool urlWritingData = false;
  bool connectionIdle = !m_runningUrl;

  if (!connectionIdle)
    urlWritingData = m_imapAction == nsIImapUrl::nsImapAppendMsgFromFile
      || m_imapAction == nsIImapUrl::nsImapAppendDraftFromFile;

  bool closeNeeded = GetServerStateParser().GetIMAPstate() ==
                nsImapServerResponseParser::kFolderSelected && m_safeToCloseConnection;
  nsCString command;
  // if a url is writing data, we can't even logout, so we're just
  // going to close the connection as if the user pressed stop.
  if (m_currentServerCommandTagNumber > 0 && !urlWritingData)
  {
    bool isAlive = false;
    if (m_transport)
      rv = m_transport->IsAlive(&isAlive);

    if (TestFlag(IMAP_CONNECTION_IS_OPEN) && m_idle && isAlive)
      EndIdle(false);

    if (NS_SUCCEEDED(rv) && isAlive && closeNeeded && GetDeleteIsMoveToTrash() &&
        TestFlag(IMAP_CONNECTION_IS_OPEN) && m_outputStream)
      Close(true, connectionIdle);

    if (NS_SUCCEEDED(rv) && isAlive && TestFlag(IMAP_CONNECTION_IS_OPEN) &&
        NS_SUCCEEDED(GetConnectionStatus()) && m_outputStream)
      Logout(true, connectionIdle);
  }
  PR_CExitMonitor(this);
  // close streams via UI thread
  if (m_imapProtocolSink)
  {
    m_imapProtocolSink->CloseStreams();
    m_imapProtocolSink = nullptr;
  }
  Log("TellThreadToDie", nullptr, "close socket connection");

  {
    ReentrantMonitorAutoEnter mon(m_threadDeathMonitor);
    m_threadShouldDie = true;
  }
  {
    ReentrantMonitorAutoEnter dataMon(m_dataAvailableMonitor);
    dataMon.Notify();
  }
  ReentrantMonitorAutoEnter urlReadyMon(m_urlReadyToRunMonitor);
  urlReadyMon.NotifyAll();
}

NS_IMETHODIMP
nsImapProtocol::GetLastActiveTimeStamp(PRTime* aTimeStamp)
{
  if (aTimeStamp)
    *aTimeStamp = m_lastActiveTime;
  return NS_OK;
}

NS_IMETHODIMP
nsImapProtocol::PseudoInterruptMsgLoad(nsIMsgFolder *aImapFolder, nsIMsgWindow *aMsgWindow, bool *interrupted)
{
  NS_ENSURE_ARG (interrupted);

  *interrupted = false;

  PR_CEnterMonitor(this);

  if (m_runningUrl && !TestFlag(IMAP_CLEAN_UP_URL_STATE))
  {
    nsImapAction imapAction;
    m_runningUrl->GetImapAction(&imapAction);

    if (imapAction == nsIImapUrl::nsImapMsgFetch)
    {
      nsresult rv = NS_OK;
      nsCOMPtr<nsIImapUrl> runningImapURL;

      rv = GetRunningImapURL(getter_AddRefs(runningImapURL));
      if (NS_SUCCEEDED(rv) && runningImapURL)
      {
        nsCOMPtr <nsIMsgFolder> runningImapFolder;
        nsCOMPtr <nsIMsgWindow> msgWindow;
        nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(runningImapURL);
        mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow));
        mailnewsUrl->GetFolder(getter_AddRefs(runningImapFolder));
        if (aImapFolder == runningImapFolder && msgWindow == aMsgWindow)
        {
          PseudoInterrupt(true);
          *interrupted = true;
        }
      }
    }
  }
  PR_CExitMonitor(this);
#ifdef DEBUG_bienvenu
  printf("interrupt msg load : %s\n", (*interrupted) ? "TRUE" : "FALSE");
#endif
  return NS_OK;
}

void
nsImapProtocol::ImapThreadMainLoop()
{
  PR_LOG(IMAP, PR_LOG_DEBUG, ("ImapThreadMainLoop entering [this=%x]\n", this));

  PRIntervalTime sleepTime = kImapSleepTime;
  while (!DeathSignalReceived())
  {
    nsresult rv = NS_OK;
    bool readyToRun;

    // wait for an URL to process...
    {
      ReentrantMonitorAutoEnter mon(m_urlReadyToRunMonitor);

      while (NS_SUCCEEDED(rv) && !DeathSignalReceived() &&
             !m_nextUrlReadyToRun && !m_threadShouldDie)
        rv = mon.Wait(sleepTime);

      readyToRun = m_nextUrlReadyToRun;
      m_nextUrlReadyToRun = false;
    }
    // This will happen if the UI thread signals us to die
    if (m_threadShouldDie)
    {
      TellThreadToDie();
      break;
    }

    if (NS_FAILED(rv) && PR_PENDING_INTERRUPT_ERROR == PR_GetError())
    {
      printf("error waiting for monitor\n");
      break;
    }

    if (readyToRun && m_runningUrl)
    {
      if (m_currentServerCommandTagNumber && m_transport)
      {
        bool isAlive;
        rv = m_transport->IsAlive(&isAlive);
        // if the transport is not alive, and we've ever sent a command with this connection, kill it.
        // otherwise, we've probably just not finished setting it so don't kill it!
        if (NS_FAILED(rv) || !isAlive)
        {
          // This says we never started running the url, which is the case.
          m_runningUrl->SetRerunningUrl(false);
          RetryUrl();
          return;
        }
      }
      //
      // NOTE: Though we cleared m_nextUrlReadyToRun above, it may have been
      //       set by LoadImapUrl, which runs on the main thread.  Because of this,
      //       we must not try to clear m_nextUrlReadyToRun here.
      //
      if (ProcessCurrentURL())
      {
        m_nextUrlReadyToRun = true;
        m_imapMailFolderSink = nullptr;
      }
      else
      {
        // see if we want to go into idle mode. Might want to check a pref here too.
        if (m_useIdle && !m_urlInProgress && GetServerStateParser().GetCapabilityFlag() & kHasIdleCapability
          && GetServerStateParser().GetIMAPstate()
                == nsImapServerResponseParser::kFolderSelected)
        {
          Idle(); // for now, lets just do it. We'll probably want to use a timer
        }
        else // if not idle, don't need to remember folder sink
          m_imapMailFolderSink = nullptr;
      }
    }
    else if (m_idle && !m_threadShouldDie)
    {
      HandleIdleResponses();
    }
    if (!GetServerStateParser().Connected())
      break;
#ifdef DEBUG_bienvenu
    else
      printf("ready to run but no url and not idle\n");
#endif
    // This can happen if the UI thread closes cached connections in the
    // OnStopRunningUrl notification.
    if (m_threadShouldDie)
      TellThreadToDie();
  }
  m_imapThreadIsRunning = false;

  PR_LOG(IMAP, PR_LOG_DEBUG, ("ImapThreadMainLoop leaving [this=%x]\n", this));
}

void nsImapProtocol::HandleIdleResponses()
{
  // int32_t oldRecent = GetServerStateParser().NumberOfRecentMessages();
  nsAutoCString commandBuffer(GetServerCommandTag());
  commandBuffer.Append(" IDLE" CRLF);

  do
  {
    ParseIMAPandCheckForNewMail(commandBuffer.get());
  }
  while (m_inputStreamBuffer->NextLineAvailable() && GetServerStateParser().Connected());

  //  if (oldRecent != GetServerStateParser().NumberOfRecentMessages())
  //  We might check that something actually changed, but for now we can
  // just assume it. OnNewIdleMessages must run a url, so that
  // we'll go back into asyncwait mode.
  if (GetServerStateParser().Connected() && m_imapMailFolderSink)
    m_imapMailFolderSink->OnNewIdleMessages();
}

void nsImapProtocol::EstablishServerConnection()
{
#define ESC_LENGTH(x) (sizeof(x) - 1)
#define ESC_OK                      "* OK"
#define ESC_OK_LEN                  ESC_LENGTH(ESC_OK)
#define ESC_PREAUTH                 "* PREAUTH"
#define ESC_PREAUTH_LEN             ESC_LENGTH(ESC_PREAUTH)
#define ESC_CAPABILITY_STAR         "* "
#define ESC_CAPABILITY_STAR_LEN     ESC_LENGTH(ESC_CAPABILITY_STAR)
#define ESC_CAPABILITY_OK           "* OK ["
#define ESC_CAPABILITY_OK_LEN       ESC_LENGTH(ESC_CAPABILITY_OK)
#define ESC_CAPABILITY_GREETING     (ESC_CAPABILITY_OK "CAPABILITY")
#define ESC_CAPABILITY_GREETING_LEN ESC_LENGTH(ESC_CAPABILITY_GREETING)

  char * serverResponse = CreateNewLineFromSocket(); // read in the greeting

  // record the fact that we've received a greeting for this connection so we don't ever
  // try to do it again..
  if (serverResponse)
    SetFlag(IMAP_RECEIVED_GREETING);

  if (!PL_strncasecmp(serverResponse, ESC_OK, ESC_OK_LEN))
  {
    SetConnectionStatus(NS_OK);

    if (!PL_strncasecmp(serverResponse, ESC_CAPABILITY_GREETING, ESC_CAPABILITY_GREETING_LEN))
    {
      nsAutoCString tmpstr(serverResponse);
      int32_t endIndex = tmpstr.FindChar(']', ESC_CAPABILITY_GREETING_LEN);
      if (endIndex >= 0)
      {
        // Allocate the new buffer here. This buffer will be passed to
        // ParseIMAPServerResponse() where it will be used to fill the
        // fCurrentLine field and will be freed by the next call to
        // ResetLexAnalyzer().
        char *fakeServerResponse = (char*)PR_Malloc(PL_strlen(serverResponse));
        // Munge the greeting into something that would pass for an IMAP
        // server's response to a "CAPABILITY" command.
        strcpy(fakeServerResponse, ESC_CAPABILITY_STAR);
        strcat(fakeServerResponse, serverResponse + ESC_CAPABILITY_OK_LEN);
        fakeServerResponse[endIndex - ESC_CAPABILITY_OK_LEN + ESC_CAPABILITY_STAR_LEN] = '\0';
        // Tell the response parser that we just issued a "CAPABILITY" and
        // got the following back.
        GetServerStateParser().ParseIMAPServerResponse("1 CAPABILITY", true, fakeServerResponse);
      }
    }
  }
  else if (!PL_strncasecmp(serverResponse, ESC_PREAUTH, ESC_PREAUTH_LEN))
  {
    // we've been pre-authenticated.
    // we can skip the whole password step, right into the
    // kAuthenticated state
    GetServerStateParser().PreauthSetAuthenticatedState();

    if (GetServerStateParser().GetCapabilityFlag() == kCapabilityUndefined)
      Capability();

    if ( !(GetServerStateParser().GetCapabilityFlag() &
          (kIMAP4Capability | kIMAP4rev1Capability | kIMAP4other) ) )
    {
      // AlertUserEvent_UsingId(MK_MSG_IMAP_SERVER_NOT_IMAP4);
      SetConnectionStatus(NS_ERROR_FAILURE);        // stop netlib
    }
    else
    {
      // let's record the user as authenticated.
      m_imapServerSink->SetUserAuthenticated(true);

      ProcessAfterAuthenticated();
      // the connection was a success
      SetConnectionStatus(NS_OK);
     }
  }

  PR_Free(serverResponse); // we don't care about the greeting yet...

#undef ESC_LENGTH
#undef ESC_OK
#undef ESC_OK_LEN
#undef ESC_PREAUTH
#undef ESC_PREAUTH_LEN
#undef ESC_CAPABILITY_STAR
#undef ESC_CAPABILITY_STAR_LEN
#undef ESC_CAPABILITY_OK
#undef ESC_CAPABILITY_OK_LEN
#undef ESC_CAPABILITY_GREETING
#undef ESC_CAPABILITY_GREETING_LEN
}

// This can get called from the UI thread or an imap thread.
// It makes sure we don't get left with partial messages in
// the memory cache.
static void DoomCacheEntry(nsIMsgMailNewsUrl *url)
{
  bool readingFromMemCache = false;
  nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(url);
  imapUrl->GetMsgLoadingFromCache(&readingFromMemCache);
  if (!readingFromMemCache)
  {
    nsCOMPtr<nsICacheEntryDescriptor>  cacheEntry;
    url->GetMemCacheEntry(getter_AddRefs(cacheEntry));
    if (cacheEntry)
      cacheEntry->Doom();
  }
}

// returns true if another url was run, false otherwise.
bool nsImapProtocol::ProcessCurrentURL()
{
  nsresult rv = NS_OK;
  if (m_idle)
    EndIdle();

  if (m_retryUrlOnError)
  {
    // we clear this flag if we're re-running immediately, because that
    // means we never sent a start running url notification, and later we
    // don't send start running notification if we think we're rerunning
    // the url (see first call to SetUrlState below). This means we won't
    // send a start running notification, which means our stop running
    // notification will be ignored because we don't think we were running.
    m_runningUrl->SetRerunningUrl(false);
    return RetryUrl();
  }
  Log("ProcessCurrentURL", nullptr, "entering");
  (void) GetImapHostName(); // force m_hostName to get set.


  bool    logonFailed = false;
  bool anotherUrlRun = false;
  bool rerunningUrl = false;
  bool isExternalUrl;
  bool validUrl = true;

  PseudoInterrupt(false);  // clear this if left over from previous url.

  m_runningUrl->GetRerunningUrl(&rerunningUrl);
  m_runningUrl->GetExternalLinkUrl(&isExternalUrl);
  m_runningUrl->GetValidUrl(&validUrl);
  m_runningUrl->GetImapAction(&m_imapAction);

  if (isExternalUrl)
  {
    if (m_imapAction == nsIImapUrl::nsImapSelectFolder)
    {
      // we need to send a start request so that the doc loader
      // will call HandleContent on the imap service so we
      // can abort this url, and run a new url in a new msg window
      // to run the folder load url and get off this crazy merry-go-round.
      if (m_channelListener)
      {
        nsCOMPtr<nsIRequest> request = do_QueryInterface(m_mockChannel);
        m_channelListener->OnStartRequest(request, m_channelContext);
      }
      return false;
    }
  }

  if (!m_imapMailFolderSink)
    SetupSinkProxy(); // try this again. Evil, but I'm desperate.

  // Reinitialize the parser
  GetServerStateParser().InitializeState();
  GetServerStateParser().SetConnected(true);

  // acknowledge that we are running the url now..
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsurl = do_QueryInterface(m_runningUrl, &rv);
  nsAutoCString urlSpec;
  mailnewsurl->GetSpec(urlSpec);
  Log("ProcessCurrentURL", urlSpec.get(), (validUrl) ? " = currentUrl\n" : " is not valid\n");
  if (!validUrl)
    return false;

  if (NS_SUCCEEDED(rv) && mailnewsurl && m_imapMailFolderSink && !rerunningUrl)
    m_imapMailFolderSink->SetUrlState(this, mailnewsurl, true, false,
                                      NS_OK);

  // if we are set up as a channel, we should notify our channel listener that we are starting...
  // so pass in ourself as the channel and not the underlying socket or file channel the protocol
  // happens to be using
  if (m_channelListener) // ### not sure we want to do this if rerunning url...
  {
    nsCOMPtr<nsIRequest> request = do_QueryInterface(m_mockChannel);
    m_channelListener->OnStartRequest(request, m_channelContext);
  }
  // If we haven't received the greeting yet, we need to make sure we strip
  // it out of the input before we start to do useful things...
  if (!TestFlag(IMAP_RECEIVED_GREETING))
    EstablishServerConnection();

  // Step 1: If we have not moved into the authenticated state yet then do so
  // by attempting to logon.
  if (!DeathSignalReceived() && NS_SUCCEEDED(GetConnectionStatus()) &&
      (GetServerStateParser().GetIMAPstate() ==
       nsImapServerResponseParser::kNonAuthenticated))
  {
      /* if we got here, the server's greeting should not have been PREAUTH */
      if (GetServerStateParser().GetCapabilityFlag() == kCapabilityUndefined)
          Capability();

      if ( !(GetServerStateParser().GetCapabilityFlag() & (kIMAP4Capability | kIMAP4rev1Capability |
             kIMAP4other) ) )
      {
        if (!DeathSignalReceived() && NS_SUCCEEDED(GetConnectionStatus()))
          AlertUserEventUsingName("imapServerNotImap4");

        SetConnectionStatus(NS_ERROR_FAILURE);        // stop netlib
      }
      else
      {
        if ((m_connectionType.Equals("starttls")
             && (m_socketType == nsMsgSocketType::trySTARTTLS
             && (GetServerStateParser().GetCapabilityFlag() & kHasStartTLSCapability)))
            || m_socketType == nsMsgSocketType::alwaysSTARTTLS)
        {
          StartTLS();
          if (GetServerStateParser().LastCommandSuccessful())
          {
            nsCOMPtr<nsISupports> secInfo;
            nsCOMPtr<nsISocketTransport> strans = do_QueryInterface(m_transport, &rv);
            if (NS_FAILED(rv))
              return false;

            rv = strans->GetSecurityInfo(getter_AddRefs(secInfo));

            if (NS_SUCCEEDED(rv) && secInfo)
            {
              nsCOMPtr<nsISSLSocketControl> sslControl = do_QueryInterface(secInfo, &rv);

              if (NS_SUCCEEDED(rv) && sslControl)
              {
                rv = sslControl->StartTLS();
                if (NS_SUCCEEDED(rv))
                {
                  if (m_socketType == nsMsgSocketType::trySTARTTLS)
                    m_imapServerSink->UpdateTrySTARTTLSPref(true);
                  // force re-issue of "capability", because servers may
                  // enable other auth features (e.g. remove LOGINDISABLED
                  // and add AUTH=PLAIN) after we upgraded to SSL.
                  Capability();
                  eIMAPCapabilityFlags capabilityFlag = GetServerStateParser().GetCapabilityFlag();
                  // Courier imap doesn't return STARTTLS capability if we've done
                  // a STARTTLS! But we need to remember this capability so we'll
                  // try to use STARTTLS next time.
                  if (!(capabilityFlag & kHasStartTLSCapability))
                  {
                    capabilityFlag |= kHasStartTLSCapability;
                    GetServerStateParser().SetCapabilityFlag(capabilityFlag);
                    CommitCapability();
                  }
                }
              }
            }
            if (NS_FAILED(rv))
            {
              nsAutoCString logLine("STARTTLS negotiation failed. Error 0x");
              logLine.AppendInt(static_cast<uint32_t>(rv), 16);
              Log("ProcessCurrentURL", nullptr, logLine.get());
              if (m_socketType == nsMsgSocketType::alwaysSTARTTLS)
              {
                SetConnectionStatus(rv);        // stop netlib
                m_transport->Close(rv);
              }
              else if (m_socketType == nsMsgSocketType::trySTARTTLS)
                m_imapServerSink->UpdateTrySTARTTLSPref(false);
            }
          }
          else if (m_socketType == nsMsgSocketType::alwaysSTARTTLS)
          {
            SetConnectionStatus(NS_ERROR_FAILURE);        // stop netlib
            if (m_transport)
              m_transport->Close(rv);
          }
          else if (m_socketType == nsMsgSocketType::trySTARTTLS)
          {
            // STARTTLS failed, so downgrade socket type
            m_imapServerSink->UpdateTrySTARTTLSPref(false);
          }
        }
        else if (m_socketType == nsMsgSocketType::trySTARTTLS)
        {
          // we didn't know the server supported TLS when we created
          // the socket, so we're going to retry with a STARTTLS socket
          if (GetServerStateParser().GetCapabilityFlag() & kHasStartTLSCapability)
          {
            ClearFlag(IMAP_CONNECTION_IS_OPEN);
            TellThreadToDie();
            SetConnectionStatus(NS_ERROR_FAILURE);
            return RetryUrl();
          }
          else
          {
            // trySTARTTLS set, but server doesn't have TLS capability,
            // so downgrade socket type
            m_imapServerSink->UpdateTrySTARTTLSPref(false);
            m_socketType = nsMsgSocketType::plain;
          }
        }
        logonFailed = !TryToLogon();
        if (m_retryUrlOnError)
          return RetryUrl();
      }
  } // if death signal not received

  if (!DeathSignalReceived() && (NS_SUCCEEDED(GetConnectionStatus())))
  {
    // if the server supports a language extension then we should
    // attempt to issue the language extension.
    if ( GetServerStateParser().GetCapabilityFlag() & kHasLanguageCapability)
      Language();

    if (m_runningUrl)
      FindMailboxesIfNecessary();

    nsImapState imapState;
    if (m_runningUrl)
      m_runningUrl->GetRequiredImapState(&imapState);

    if (imapState == nsIImapUrl::nsImapAuthenticatedState)
      ProcessAuthenticatedStateURL();
    else   // must be a url that requires us to be in the selected state
      ProcessSelectedStateURL();

    if (m_retryUrlOnError)
      return RetryUrl();

  // The URL has now been processed
    if ((!logonFailed && NS_FAILED(GetConnectionStatus())) ||
         DeathSignalReceived())
         HandleCurrentUrlError();

  }
  else if (!logonFailed)
      HandleCurrentUrlError();

// if we are set up as a channel, we should notify our channel listener that we are stopping...
// so pass in ourself as the channel and not the underlying socket or file channel the protocol
// happens to be using
  if (m_channelListener)
  {
      nsCOMPtr<nsIRequest> request = do_QueryInterface(m_mockChannel);
      NS_ASSERTION(request, "no request");
      if (request) {
        nsresult status;
        request->GetStatus(&status);
        if (!GetServerStateParser().LastCommandSuccessful() && NS_SUCCEEDED(status))
          status = NS_MSG_ERROR_IMAP_COMMAND_FAILED;
        rv = m_channelListener->OnStopRequest(request, m_channelContext, status);
      }
  }
  bool suspendUrl = false;
  m_runningUrl->GetMoreHeadersToDownload(&suspendUrl);
  if (mailnewsurl && m_imapMailFolderSink)
  {
    if (logonFailed)
      rv = NS_ERROR_FAILURE;
    else if (GetServerStateParser().CommandFailed())
      rv = NS_MSG_ERROR_IMAP_COMMAND_FAILED;
    else
      rv = GetConnectionStatus();
    // we are done with this url.
    m_imapMailFolderSink->SetUrlState(this, mailnewsurl, false, suspendUrl,
                                      rv);
     // doom the cache entry
    if (NS_FAILED(rv) && DeathSignalReceived() && m_mockChannel)
      DoomCacheEntry(mailnewsurl);
  }
  else
    NS_ERROR("missing url or sink");

  // disable timeouts before caching connection.
  if (m_transport)
    m_transport->SetTimeout(nsISocketTransport::TIMEOUT_READ_WRITE, PR_UINT32_MAX);

  SetFlag(IMAP_CLEAN_UP_URL_STATE);

  nsCOMPtr <nsISupports> copyState;
  if (m_runningUrl)
    m_runningUrl->GetCopyState(getter_AddRefs(copyState));
  // this is so hokey...we MUST clear any local references to the url
  // BEFORE calling ReleaseUrlState
  mailnewsurl = nullptr;

  if (suspendUrl)
    m_imapServerSink->SuspendUrl(m_runningUrl);
  // save the imap folder sink since we need it to do the CopyNextStreamMessage
  nsRefPtr<ImapMailFolderSinkProxy> imapMailFolderSink = m_imapMailFolderSink;
  // release the url as we are done with it...
  ReleaseUrlState(false);
  ResetProgressInfo();

  ClearFlag(IMAP_CLEAN_UP_URL_STATE);

  if (imapMailFolderSink)
  {
    if (copyState)
    {
      rv = imapMailFolderSink->CopyNextStreamMessage(GetServerStateParser().LastCommandSuccessful() &&
                                                NS_SUCCEEDED(GetConnectionStatus()),
                                                copyState);
      if (NS_FAILED(rv))
        PR_LOG(IMAP, PR_LOG_ALWAYS, ("CopyNextStreamMessage failed:%lx\n", rv));

      nsCOMPtr<nsIThread> thread = do_GetMainThread();
      nsISupports *doomed = nullptr;
      copyState.swap(doomed);
      NS_ProxyRelease(thread, doomed);
    }
    // we might need this to stick around for IDLE support
    m_imapMailFolderSink = imapMailFolderSink;
    imapMailFolderSink = nullptr;
  }
  else
    PR_LOG(IMAP, PR_LOG_ALWAYS, ("null imapMailFolderSink\n"));

  // now try queued urls, now that we've released this connection.
  if (m_imapServerSink)
  {
    if (NS_SUCCEEDED(GetConnectionStatus()))
      rv = m_imapServerSink->LoadNextQueuedUrl(this, &anotherUrlRun);
    else // if we don't do this, they'll just sit and spin until
          // we run some other url on this server.
    {
      Log("ProcessCurrentURL", nullptr, "aborting queued urls");
      rv = m_imapServerSink->AbortQueuedUrls();
    }
  }

  // if we didn't run another url, release the server sink to
  // cut circular refs.
  if (!anotherUrlRun)
      m_imapServerSink = nullptr;

  nsCOMPtr<nsIImapIncomingServer> imapServer  = do_QueryReferent(m_server, &rv);
  if (NS_FAILED(GetConnectionStatus()) || !GetServerStateParser().Connected()
    || GetServerStateParser().SyntaxError())
  {
    if (imapServer)
      imapServer->RemoveConnection(this);

    if (!DeathSignalReceived())
    {
        TellThreadToDie();
    }
  }
  else
  {
    if (imapServer)
    {
      bool shuttingDown;
      imapServer->GetShuttingDown(&shuttingDown);
      if (shuttingDown)
        m_useIdle = false;
    }
  }
  return anotherUrlRun;
}

bool nsImapProtocol::RetryUrl()
{
  nsCOMPtr <nsIImapUrl> kungFuGripImapUrl = m_runningUrl;
  nsCOMPtr <nsIImapMockChannel> saveMockChannel;

  // the mock channel might be null - that's OK.
  if (m_imapServerSink)
    (void) m_imapServerSink->PrepareToRetryUrl(kungFuGripImapUrl, getter_AddRefs(saveMockChannel));

  ReleaseUrlState(true);
  nsresult rv;
  nsCOMPtr<nsIImapIncomingServer> imapServer  = do_QueryReferent(m_server, &rv);
  if (NS_SUCCEEDED(rv))
    imapServer->RemoveConnection(this);
  if (m_imapServerSink)
    m_imapServerSink->RetryUrl(kungFuGripImapUrl, saveMockChannel);
  return (m_imapServerSink != nullptr); // we're running a url (the same url)
}

// ignoreBadAndNOResponses --> don't throw a error dialog if this command results in a NO or Bad response
// from the server..in other words the command is "exploratory" and we don't really care if it succeeds or fails.
void nsImapProtocol::ParseIMAPandCheckForNewMail(const char* commandString, bool aIgnoreBadAndNOResponses)
{
    if (commandString)
        GetServerStateParser().ParseIMAPServerResponse(commandString, aIgnoreBadAndNOResponses);
    else
        GetServerStateParser().ParseIMAPServerResponse(m_currentCommand.get(), aIgnoreBadAndNOResponses);
    // **** fix me for new mail biff state *****
}

/////////////////////////////////////////////////////////////////////////////////////////////
// End of nsIStreamListenerSupport
//////////////////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsImapProtocol::GetRunningUrl(nsIURI **result)
{
    if (result && m_runningUrl)
        return m_runningUrl->QueryInterface(NS_GET_IID(nsIURI), (void**)
                                            result);
    else
        return NS_ERROR_NULL_POINTER;
}


NS_IMETHODIMP nsImapProtocol::GetRunningImapURL(nsIImapUrl **aImapUrl)
{
  if (aImapUrl && m_runningUrl)
     return m_runningUrl->QueryInterface(NS_GET_IID(nsIImapUrl), (void**) aImapUrl);
  else
    return NS_ERROR_NULL_POINTER;

}

/*
 * Writes the data contained in dataBuffer into the current output stream. It also informs
 * the transport layer that this data is now available for transmission.
 * Returns a positive number for success, 0 for failure (not all the bytes were written to the
 * stream, etc). We need to make another pass through this file to install an error system (mscott)
 */

nsresult nsImapProtocol::SendData(const char * dataBuffer, bool aSuppressLogging)
{
  nsresult rv = NS_ERROR_NULL_POINTER;

  if (!m_transport)
  {
      Log("SendData", nullptr, "clearing IMAP_CONNECTION_IS_OPEN");
      // the connection died unexpectedly! so clear the open connection flag
      ClearFlag(IMAP_CONNECTION_IS_OPEN);
      TellThreadToDie();
      SetConnectionStatus(NS_ERROR_FAILURE);
      return NS_ERROR_FAILURE;
  }

  if (dataBuffer && m_outputStream)
  {
    m_currentCommand = dataBuffer;
    if (!aSuppressLogging)
      Log("SendData", nullptr, dataBuffer);
    else
      Log("SendData", nullptr, "Logging suppressed for this command (it probably contained authentication information)");

    {
      // don't allow someone to close the stream/transport out from under us
      // this can happen when the ui thread calls TellThreadToDie.
      PR_CEnterMonitor(this);
      uint32_t n;
      if (m_outputStream)
        rv = m_outputStream->Write(dataBuffer, PL_strlen(dataBuffer), &n);
      PR_CExitMonitor(this);
    }
    if (NS_FAILED(rv))
    {
      Log("SendData", nullptr, "clearing IMAP_CONNECTION_IS_OPEN");
      // the connection died unexpectedly! so clear the open connection flag
      ClearFlag(IMAP_CONNECTION_IS_OPEN);
      TellThreadToDie();
      SetConnectionStatus(rv);
      if (m_runningUrl && !m_retryUrlOnError)
      {
        bool alreadyRerunningUrl;
        m_runningUrl->GetRerunningUrl(&alreadyRerunningUrl);
        if (!alreadyRerunningUrl)
        {
          m_runningUrl->SetRerunningUrl(true);
          m_retryUrlOnError = true;
        }
      }
    }
  }

  return rv;
}

/////////////////////////////////////////////////////////////////////////////////////////////
// Begin protocol state machine functions...
//////////////////////////////////////////////////////////////////////////////////////////////

  // ProcessProtocolState - we override this only so we'll link - it should never get called.

nsresult nsImapProtocol::ProcessProtocolState(nsIURI * url, nsIInputStream * inputStream,
                                              uint64_t sourceOffset, uint32_t length)
{
  return NS_OK;
}

class UrlListenerNotifierEvent : public nsRunnable
{
public:
  UrlListenerNotifierEvent(nsIMsgMailNewsUrl *aUrl, nsIImapProtocol *aProtocol)
    : mUrl(aUrl), mProtocol(aProtocol)
  {}

  NS_IMETHOD Run()
  {
    if (mUrl)
    {
      nsCOMPtr<nsIMsgFolder> folder;
      mUrl->GetFolder(getter_AddRefs(folder));
      NS_ENSURE_TRUE(folder, NS_OK);
      nsCOMPtr<nsIImapMailFolderSink> folderSink(do_QueryInterface(folder));
      // This causes the url listener to get OnStart and Stop notifications.
      folderSink->SetUrlState(mProtocol, mUrl, true, false, NS_OK);
      folderSink->SetUrlState(mProtocol, mUrl, false, false, NS_OK);
    }
    return NS_OK;
  }

private:
  nsCOMPtr<nsIMsgMailNewsUrl> mUrl;
  nsCOMPtr<nsIImapProtocol> mProtocol;
};


bool nsImapProtocol::TryToRunUrlLocally(nsIURI *aURL, nsISupports *aConsumer)
{
  nsresult rv;
  nsCOMPtr<nsIImapUrl> imapUrl(do_QueryInterface(aURL, &rv));
  NS_ENSURE_SUCCESS(rv, false);
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aURL);
  nsCString messageIdString;
  imapUrl->GetListOfMessageIds(messageIdString);
  bool useLocalCache = false;
  if (!messageIdString.IsEmpty() && !HandlingMultipleMessages(messageIdString))
  {
    nsImapAction action;
    imapUrl->GetImapAction(&action);
    nsCOMPtr <nsIMsgFolder> folder;
    mailnewsUrl->GetFolder(getter_AddRefs(folder));
    NS_ENSURE_TRUE(folder, false);

    folder->HasMsgOffline(atoi(messageIdString.get()), &useLocalCache);
    mailnewsUrl->SetMsgIsInLocalCache(useLocalCache);
    // We're downloading a single message for offline use, and it's
    // already offline. So we shouldn't do anything, but we do
    // need to notify the url listener.
    if (useLocalCache && action == nsIImapUrl::nsImapMsgDownloadForOffline)
    {
      nsCOMPtr<nsIRunnable> event = new UrlListenerNotifierEvent(mailnewsUrl,
                                                                 this);
      // Post this as an event because it can lead to re-entrant calls to
      // LoadNextQueuedUrl if the listener runs a new url.
      if (event)
        NS_DispatchToCurrentThread(event);
      return true;
    }
  }
  if (!useLocalCache)
    return false;

  nsCOMPtr<nsIImapMockChannel> mockChannel;
  imapUrl->GetMockChannel(getter_AddRefs(mockChannel));
  if (!mockChannel)
    return false;

  nsImapMockChannel *imapChannel = static_cast<nsImapMockChannel *>(mockChannel.get());
  if (!imapChannel)
    return false;

  nsCOMPtr <nsILoadGroup> loadGroup;
  imapChannel->GetLoadGroup(getter_AddRefs(loadGroup));
  if (!loadGroup) // if we don't have one, the url will snag one from the msg window...
    mailnewsUrl->GetLoadGroup(getter_AddRefs(loadGroup));

  if (loadGroup)
    loadGroup->RemoveRequest((nsIRequest *) mockChannel, nullptr /* context isupports */, NS_OK);

  if (imapChannel->ReadFromLocalCache())
  {
    (void) imapChannel->NotifyStartEndReadFromCache(true);
    return true;
  }
  return false;
}


// LoadImapUrl takes a url, initializes all of our url specific data by calling SetupUrl.
// If we don't have a connection yet, we open the connection. Finally, we signal the
// url to run monitor to let the imap main thread loop process the current url (it is waiting
// on this monitor). There is a contract that the imap thread has already been started b4 we
// attempt to load a url....
NS_IMETHODIMP nsImapProtocol::LoadImapUrl(nsIURI * aURL, nsISupports * aConsumer)
{
  nsresult rv;
  if (aURL)
  {
#ifdef DEBUG_bienvenu
    nsAutoCString urlSpec;
    aURL->GetSpec(urlSpec);
    printf("loading url %s\n", urlSpec.get());
#endif
    if (TryToRunUrlLocally(aURL, aConsumer))
      return NS_OK;
    m_urlInProgress = true;
    m_imapMailFolderSink = nullptr;
    rv = SetupWithUrl(aURL, aConsumer);
    NS_ASSERTION(NS_SUCCEEDED(rv), "error setting up imap url");
    if (NS_FAILED(rv))
      return rv;

    SetupSinkProxy(); // generate proxies for all of the event sinks in the url
    m_lastActiveTime = PR_Now();
    if (m_transport && m_runningUrl)
    {
      nsImapAction imapAction;
      m_runningUrl->GetImapAction(&imapAction);
      // if we're shutting down, and not running the kinds of urls we run at
      // shutdown, then this should fail because running urls during
      // shutdown will very likely fail and potentially hang.
      nsCOMPtr<nsIMsgAccountManager> accountMgr = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      bool shuttingDown = false;
      (void) accountMgr->GetShutdownInProgress(&shuttingDown);
      if (shuttingDown && imapAction != nsIImapUrl::nsImapExpungeFolder &&
          imapAction != nsIImapUrl::nsImapDeleteAllMsgs &&
          imapAction != nsIImapUrl::nsImapDeleteFolder)
        return NS_ERROR_FAILURE;

      // if we're running a select or delete all, do a noop first.
      // this should really be in the connection cache code when we know
      // we're pulling out a selected state connection, but maybe we
      // can get away with this.
      m_needNoop = (imapAction == nsIImapUrl::nsImapSelectFolder || imapAction == nsIImapUrl::nsImapDeleteAllMsgs);

      // We now have a url to run so signal the monitor for url ready to be processed...
      ReentrantMonitorAutoEnter urlReadyMon(m_urlReadyToRunMonitor);
      m_nextUrlReadyToRun = true;
      urlReadyMon.Notify();

    } // if we have an imap url and a transport
    else
      NS_ASSERTION(false, "missing channel or running url");

  } // if we received a url!

  return rv;
}

NS_IMETHODIMP nsImapProtocol::IsBusy(bool *aIsConnectionBusy,
                                     bool *isInboxConnection)
{
  if (!aIsConnectionBusy || !isInboxConnection)
    return NS_ERROR_NULL_POINTER;
  nsresult rv = NS_OK;
  *aIsConnectionBusy = false;
  *isInboxConnection = false;
  if (!m_transport)
  {
    // this connection might not be fully set up yet.
    rv = NS_ERROR_FAILURE;
  }
  else
  {
    if (m_urlInProgress) // do we have a url? That means we're working on it...
      *aIsConnectionBusy = true;

    if (GetServerStateParser().GetIMAPstate() ==
        nsImapServerResponseParser::kFolderSelected && GetServerStateParser().GetSelectedMailboxName() &&
        PL_strcasecmp(GetServerStateParser().GetSelectedMailboxName(),
                      "Inbox") == 0)
      *isInboxConnection = true;

  }
  return rv;
}

#define IS_SUBSCRIPTION_RELATED_ACTION(action) (action == nsIImapUrl::nsImapSubscribe\
|| action == nsIImapUrl::nsImapUnsubscribe || action == nsIImapUrl::nsImapDiscoverAllBoxesUrl || action == nsIImapUrl::nsImapListFolder)


// canRunUrl means the connection is not busy, and is in the selected state
// for the desired folder (or authenticated).
// has to wait means it's in the right selected state, but busy.
NS_IMETHODIMP nsImapProtocol::CanHandleUrl(nsIImapUrl * aImapUrl,
                                           bool * aCanRunUrl,
                                           bool * hasToWait)
{
  if (!aCanRunUrl || !hasToWait || !aImapUrl)
    return NS_ERROR_NULL_POINTER;
  nsresult rv = NS_OK;
  MutexAutoLock mon(mLock);

  *aCanRunUrl = false; // assume guilty until proven otherwise...
  *hasToWait = false;

  if (DeathSignalReceived())
    return NS_ERROR_FAILURE;

  bool isBusy = false;
  bool isInboxConnection = false;

  if (!m_transport)
  {
    // this connection might not be fully set up yet.
    return NS_ERROR_FAILURE;
  }
  IsBusy(&isBusy, &isInboxConnection);
  bool inSelectedState = GetServerStateParser().GetIMAPstate() ==
    nsImapServerResponseParser::kFolderSelected;

  nsAutoCString curSelectedUrlFolderName;
  nsAutoCString pendingUrlFolderName;
  if (inSelectedState)
    curSelectedUrlFolderName = GetServerStateParser().GetSelectedMailboxName();

  if (isBusy)
  {
    nsImapState curUrlImapState;
    NS_ASSERTION(m_runningUrl,"isBusy, but no running url.");
    if (m_runningUrl)
    {
      m_runningUrl->GetRequiredImapState(&curUrlImapState);
      if (curUrlImapState == nsIImapUrl::nsImapSelectedState)
      {
        char *folderName = GetFolderPathString();
        if (!curSelectedUrlFolderName.Equals(folderName))
          pendingUrlFolderName.Assign(folderName);
        inSelectedState = true;
        PR_Free(folderName);
      }
    }
  }

  nsImapState imapState;
  nsImapAction actionForProposedUrl;
  aImapUrl->GetImapAction(&actionForProposedUrl);
  aImapUrl->GetRequiredImapState(&imapState);

  // OK, this is a bit of a hack - we're going to pretend that
  // these types of urls requires a selected state connection on
  // the folder in question. This isn't technically true,
  // but we would much rather use that connection for several reasons,
  // one is that some UW servers require us to use that connection
  // the other is that we don't want to leave a connection dangling in
  // the selected state for the deleted folder.
  // If we don't find a connection in that selected state,
  // we'll fall back to the first free connection.
  bool isSelectedStateUrl = imapState == nsIImapUrl::nsImapSelectedState
    || actionForProposedUrl == nsIImapUrl::nsImapDeleteFolder || actionForProposedUrl == nsIImapUrl::nsImapRenameFolder
    || actionForProposedUrl == nsIImapUrl::nsImapMoveFolderHierarchy
    || actionForProposedUrl == nsIImapUrl::nsImapAppendDraftFromFile
    || actionForProposedUrl == nsIImapUrl::nsImapAppendMsgFromFile
    || actionForProposedUrl == nsIImapUrl::nsImapFolderStatus;

  nsCOMPtr<nsIMsgMailNewsUrl> msgUrl = do_QueryInterface(aImapUrl);
  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = msgUrl->GetServer(getter_AddRefs(server));
  if (NS_SUCCEEDED(rv))
  {
    // compare host/user between url and connection.
    nsCString urlHostName;
    nsCString urlUserName;
    rv = server->GetHostName(urlHostName);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = server->GetUsername(urlUserName);
    NS_ENSURE_SUCCESS(rv, rv);

    if ((GetImapHostName().IsEmpty() ||
      urlHostName.Equals(GetImapHostName(), nsCaseInsensitiveCStringComparator())) &&
      (GetImapUserName().IsEmpty() ||
      urlUserName.Equals(GetImapUserName(), nsCaseInsensitiveCStringComparator())))
    {
      if (isSelectedStateUrl)
      {
        if (inSelectedState)
        {
          // *** jt - in selected state can only run url with
          // matching foldername
          char *folderNameForProposedUrl = nullptr;
          rv = aImapUrl->CreateServerSourceFolderPathString(
            &folderNameForProposedUrl);
          if (NS_SUCCEEDED(rv) && folderNameForProposedUrl)
          {
            bool isInbox =
              PL_strcasecmp("Inbox", folderNameForProposedUrl) == 0;
            if (!curSelectedUrlFolderName.IsEmpty() || !pendingUrlFolderName.IsEmpty())
            {
              bool matched = isInbox ?
                PL_strcasecmp(curSelectedUrlFolderName.get(),
                folderNameForProposedUrl) == 0 :
              PL_strcmp(curSelectedUrlFolderName.get(),
                folderNameForProposedUrl) == 0;
              if (!matched && !pendingUrlFolderName.IsEmpty())
              {
                matched = isInbox ?
                  PL_strcasecmp(pendingUrlFolderName.get(),
                  folderNameForProposedUrl) == 0 :
                PL_strcmp(pendingUrlFolderName.get(),
                  folderNameForProposedUrl) == 0;
              }
              if (matched)
              {
                if (isBusy)
                  *hasToWait = true;
                else
                  *aCanRunUrl = true;
              }
            }
          }
          PR_LOG(IMAP, PR_LOG_DEBUG,
                 ("proposed url = %s folder for connection %s has To Wait = %s can run = %s",
                  folderNameForProposedUrl, curSelectedUrlFolderName.get(),
                  (*hasToWait) ? "TRUE" : "FALSE", (*aCanRunUrl) ? "TRUE" : "FALSE"));
          PR_FREEIF(folderNameForProposedUrl);
        }
      }
      else // *** jt - an authenticated state url can be run in either
        // authenticated or selected state
      {
        nsImapAction actionForRunningUrl;

        // If proposed url is subscription related, and we are currently running
        // a subscription url, then we want to queue the proposed url after the current url.
        // Otherwise, we can run this url if we're not busy.
        // If we never find a running subscription-related url, the caller will
        // just use whatever free connection it can find, which is what we want.
        if (IS_SUBSCRIPTION_RELATED_ACTION(actionForProposedUrl))
        {
          if (isBusy && m_runningUrl)
          {
            m_runningUrl->GetImapAction(&actionForRunningUrl);
            if (IS_SUBSCRIPTION_RELATED_ACTION(actionForRunningUrl))
            {
              *aCanRunUrl = false;
              *hasToWait = true;
            }
          }
        }
        else
        {
          if (!isBusy)
            *aCanRunUrl = true;
        }
      }
    }
  }
  return rv;
}


// Command tag handling stuff
void nsImapProtocol::IncrementCommandTagNumber()
{
  sprintf(m_currentServerCommandTag, "%u", ++m_currentServerCommandTagNumber);
}

const char *nsImapProtocol::GetServerCommandTag()
{
    return m_currentServerCommandTag;
}

void nsImapProtocol::ProcessSelectedStateURL()
{
  nsCString mailboxName;
  bool bMessageIdsAreUids = true;
  bool moreHeadersToDownload;
  imapMessageFlagsType  msgFlags = 0;
  nsCString       urlHost;

  // this can't fail, can it?
  nsresult res;
  res = m_runningUrl->GetImapAction(&m_imapAction);
  m_runningUrl->MessageIdsAreUids(&bMessageIdsAreUids);
  m_runningUrl->GetMsgFlags(&msgFlags);
  m_runningUrl->GetMoreHeadersToDownload(&moreHeadersToDownload);

  res = CreateServerSourceFolderPathString(getter_Copies(mailboxName));
  if (NS_FAILED(res))
    Log("ProcessSelectedStateURL", nullptr, "error getting source folder path string");

  if (NS_SUCCEEDED(res) && !DeathSignalReceived())
  {
    bool selectIssued = false;
    if (GetServerStateParser().GetIMAPstate() == nsImapServerResponseParser::kFolderSelected)
    {
      if (GetServerStateParser().GetSelectedMailboxName() &&
        PL_strcmp(GetServerStateParser().GetSelectedMailboxName(),
        mailboxName.get()))
      {       // we are selected in another folder
        if (m_closeNeededBeforeSelect)
          Close();
        if (GetServerStateParser().LastCommandSuccessful())
        {
          selectIssued = true;
          SelectMailbox(mailboxName.get());
        }
      }
      else if (!GetServerStateParser().GetSelectedMailboxName())
      {       // why are we in the selected state with no box name?
        SelectMailbox(mailboxName.get());
        selectIssued = true;
      }
      else if (moreHeadersToDownload && m_imapMailFolderSink) // we need to fetch older headers
      {
        nsMsgKey *msgIdList = nullptr;
        uint32_t msgCount = 0;
        bool more;
        m_imapMailFolderSink->GetMsgHdrsToDownload(&more, &m_progressCount,
                                                   &msgCount, &msgIdList);
        if (msgIdList)
        {
          FolderHeaderDump(msgIdList, msgCount);
          NS_Free(msgIdList);
          m_runningUrl->SetMoreHeadersToDownload(more);
          // We're going to be re-running this url.
          if (more)
            m_runningUrl->SetRerunningUrl(true);
        }
        HeaderFetchCompleted();
      }
      else
      {
        // get new message counts, if any, from server
        if (m_needNoop)
        {
          m_noopCount++;
          if ((gPromoteNoopToCheckCount > 0 && (m_noopCount % gPromoteNoopToCheckCount) == 0) ||
            CheckNeeded())
            Check();
          else
            Noop(); // I think this is needed when we're using a cached connection
          m_needNoop = false;
        }
      }
    }
    else
    {
      // go to selected state
      SelectMailbox(mailboxName.get());
      selectIssued = GetServerStateParser().LastCommandSuccessful();
    }

    if (selectIssued)
      RefreshACLForFolderIfNecessary(mailboxName.get());

    bool uidValidityOk = true;
    if (GetServerStateParser().LastCommandSuccessful() && selectIssued &&
      (m_imapAction != nsIImapUrl::nsImapSelectFolder) && (m_imapAction != nsIImapUrl::nsImapLiteSelectFolder))
    {

      // error on the side of caution, if the fe event fails to set uidStruct->returnValidity, then assume that UIDVALIDITY
      // did not roll.  This is a common case event for attachments that are fetched within a browser context.
      if (!DeathSignalReceived())
        uidValidityOk = m_uidValidity == kUidUnknown ||
                        m_uidValidity == GetServerStateParser().FolderUID();
    }

    if (!uidValidityOk)
      Log("ProcessSelectedStateURL", nullptr, "uid validity not ok");
    if (GetServerStateParser().LastCommandSuccessful() && !DeathSignalReceived() && (uidValidityOk || m_imapAction == nsIImapUrl::nsImapDeleteAllMsgs))
    {
      if (GetServerStateParser().CurrentFolderReadOnly())
      {
        Log("ProcessSelectedStateURL", nullptr, "current folder read only");
        if (m_imapAction == nsIImapUrl::nsImapAddMsgFlags ||
          m_imapAction == nsIImapUrl::nsImapSubtractMsgFlags)
        {
          bool canChangeFlag = false;
          if (GetServerStateParser().ServerHasACLCapability() && m_imapMailFolderSink)
          {
            uint32_t aclFlags = 0;

            if (NS_SUCCEEDED(m_imapMailFolderSink->GetAclFlags(&aclFlags))
                  && aclFlags != 0) // make sure we have some acl flags
              canChangeFlag = ((msgFlags & kImapMsgSeenFlag) && (aclFlags & IMAP_ACL_STORE_SEEN_FLAG));
          }
          else
            canChangeFlag = (GetServerStateParser().SettablePermanentFlags() & msgFlags) == msgFlags;
          if (!canChangeFlag)
            return;
        }
        if (m_imapAction == nsIImapUrl::nsImapExpungeFolder || m_imapAction == nsIImapUrl::nsImapDeleteMsg ||
          m_imapAction == nsIImapUrl::nsImapDeleteAllMsgs)
          return;
      }
      switch (m_imapAction)
      {
      case nsIImapUrl::nsImapLiteSelectFolder:
        if (GetServerStateParser().LastCommandSuccessful() &&
            m_imapMailFolderSink && !moreHeadersToDownload)
        {
          m_imapMailFolderSink->SetUidValidity(GetServerStateParser().FolderUID());
          ProcessMailboxUpdate(false); // handle uidvalidity change
        }
        break;
      case nsIImapUrl::nsImapSaveMessageToDisk:
      case nsIImapUrl::nsImapMsgFetch:
      case nsIImapUrl::nsImapMsgFetchPeek:
      case nsIImapUrl::nsImapMsgDownloadForOffline:
      case nsIImapUrl::nsImapMsgPreview:
        {
          nsCString messageIdString;
          m_runningUrl->GetListOfMessageIds(messageIdString);
          // we don't want to send the flags back in a group
          if (HandlingMultipleMessages(messageIdString) || m_imapAction == nsIImapUrl::nsImapMsgDownloadForOffline
             || m_imapAction == nsIImapUrl::nsImapMsgPreview)
          {
            // multiple messages, fetch them all
            SetProgressString("imapFolderReceivingMessageOf");

            m_progressIndex = 0;
            m_progressCount = CountMessagesInIdString(messageIdString.get());

            // we need to set this so we'll get the msg from the memory cache.
            if (m_imapAction == nsIImapUrl::nsImapMsgFetchPeek)
              SetContentModified(IMAP_CONTENT_NOT_MODIFIED);

            FetchMessage(messageIdString,
              (m_imapAction == nsIImapUrl::nsImapMsgPreview)
              ? kBodyStart : kEveryThingRFC822Peek);
            if (m_imapAction == nsIImapUrl::nsImapMsgPreview)
              HeaderFetchCompleted();
            SetProgressString(nullptr);
          }
          else
          {
            // A single message ID
            nsIMAPeFetchFields whatToFetch = kEveryThingRFC822;
            if(m_imapAction == nsIImapUrl::nsImapMsgFetchPeek)
              whatToFetch = kEveryThingRFC822Peek;

            // First, let's see if we're requesting a specific MIME part
            char *imappart = nullptr;
            m_runningUrl->GetImapPartToFetch(&imappart);
            if (imappart)
            {
              if (bMessageIdsAreUids)
              {
                // We actually want a specific MIME part of the message.
                // The Body Shell will generate it, even though we haven't downloaded it yet.

                IMAP_ContentModifiedType modType = GetShowAttachmentsInline() ?
                  IMAP_CONTENT_MODIFIED_VIEW_INLINE :
                  IMAP_CONTENT_MODIFIED_VIEW_AS_LINKS ;

                nsRefPtr<nsIMAPBodyShell> foundShell;
                res = m_hostSessionList->FindShellInCacheForHost(GetImapServerKey(),
                  GetServerStateParser().GetSelectedMailboxName(),
                  messageIdString.get(), modType, getter_AddRefs(foundShell));
                if (!foundShell)
                {
                  // The shell wasn't in the cache.  Deal with this case later.
                  Log("SHELL",NULL,"Loading part, shell not found in cache!");
                  //PR_LOG(IMAP, out, ("BODYSHELL: Loading part, shell not found in cache!"));
                  // The parser will extract the part number from the current URL.
                  SetContentModified(modType);
                  Bodystructure(messageIdString, bMessageIdsAreUids);
                }
                else
                {
                  Log("SHELL", NULL, "Loading Part, using cached shell.");
                  //PR_LOG(IMAP, out, ("BODYSHELL: Loading part, using cached shell."));
                  SetContentModified(modType);
                  foundShell->SetConnection(this);
                  GetServerStateParser().UseCachedShell(foundShell);
                  //Set the current uid in server state parser (in case it was used for new mail msgs earlier).
                  GetServerStateParser().SetCurrentResponseUID((uint32_t)atoi(messageIdString.get()));
                  foundShell->Generate(imappart);
                  GetServerStateParser().UseCachedShell(NULL);
                }
              }
              else
              {
                // Message IDs are not UIDs.
                NS_ASSERTION(false, "message ids aren't uids");
              }
              PR_Free(imappart);
            }
            else
            {
              // downloading a single message: try to do it by bodystructure, and/or do it by chunks
              uint32_t messageSize = GetMessageSize(messageIdString.get(), bMessageIdsAreUids);
              // We need to check the format_out bits to see if we are allowed to leave out parts,
              // or if we are required to get the whole thing.  Some instances where we are allowed
              // to do it by parts:  when viewing a message, replying to a message, or viewing its source
              // Some times when we're NOT allowed:  when forwarding a message, saving it, moving it, etc.
              // need to set a flag in the url, I guess, equiv to allow_content_changed.
              bool allowedToBreakApart = true; // (ce  && !DeathSignalReceived()) ? ce->URL_s->allow_content_change : false;
              bool mimePartSelectorDetected;
              bool urlOKToFetchByParts = false;
              m_runningUrl->GetMimePartSelectorDetected(&mimePartSelectorDetected);
              m_runningUrl->GetFetchPartsOnDemand(&urlOKToFetchByParts);

#ifdef PR_LOGGING
              {
                nsCOMPtr<nsIMsgMailNewsUrl> mailnewsurl = do_QueryInterface(m_runningUrl);
                nsAutoCString urlSpec;
                if (mailnewsurl)
                  mailnewsurl->GetSpec(urlSpec);
                PR_LOG(IMAP, PR_LOG_DEBUG,
                       ("SHELL: URL %s, OKToFetchByParts %d, allowedToBreakApart %d, ShouldFetchAllParts %d",
                        urlSpec.get(), urlOKToFetchByParts, allowedToBreakApart,
                        GetShouldFetchAllParts()));
              }
#endif

              if (urlOKToFetchByParts &&
                  allowedToBreakApart &&
                  !GetShouldFetchAllParts() &&
                  GetServerStateParser().ServerHasIMAP4Rev1Capability() /* &&
                !mimePartSelectorDetected */)  // if a ?part=, don't do BS.
              {
                // OK, we're doing bodystructure

                // Before fetching the bodystructure, let's check our body shell cache to see if
                // we already have it around.
                nsRefPtr<nsIMAPBodyShell> foundShell;
                IMAP_ContentModifiedType modType = GetShowAttachmentsInline() ?
                  IMAP_CONTENT_MODIFIED_VIEW_INLINE :
                  IMAP_CONTENT_MODIFIED_VIEW_AS_LINKS ;

                bool wasStoringMsgOffline;
                m_runningUrl->GetStoreResultsOffline(&wasStoringMsgOffline);
                m_runningUrl->SetStoreOfflineOnFallback(wasStoringMsgOffline);
                m_runningUrl->SetStoreResultsOffline(false);
                nsCOMPtr<nsIMsgMailNewsUrl> mailurl = do_QueryInterface(m_runningUrl);
                if (mailurl)
                {
                  mailurl->SetAddToMemoryCache(false);
                  // need to proxy this over to the ui thread
                  if (m_imapMessageSink)
                    m_imapMessageSink->SetImageCacheSessionForUrl(mailurl);

                }
                SetContentModified(modType);  // This will be looked at by the cache
                if (bMessageIdsAreUids)
                {
                  res = m_hostSessionList->FindShellInCacheForHost(GetImapServerKey(),
                    GetServerStateParser().GetSelectedMailboxName(),
                    messageIdString.get(), modType, getter_AddRefs(foundShell));
                  if (foundShell)
                  {
                    Log("SHELL",NULL,"Loading message, using cached shell.");
                    //PR_LOG(IMAP, out, ("BODYSHELL: Loading message, using cached shell."));
                    foundShell->SetConnection(this);
                    GetServerStateParser().UseCachedShell(foundShell);
                    //Set the current uid in server state parser (in case it was used for new mail msgs earlier).
                    GetServerStateParser().SetCurrentResponseUID((uint32_t)atoi(messageIdString.get()));
                    foundShell->Generate(NULL);
                    GetServerStateParser().UseCachedShell(NULL);
                  }
                }

                if (!foundShell)
                  Bodystructure(messageIdString, bMessageIdsAreUids);
              }
              else
              {
                // Not doing bodystructure.  Fetch the whole thing, and try to do
                // it in chunks.
                SetContentModified(IMAP_CONTENT_NOT_MODIFIED);
                FetchTryChunking(messageIdString, whatToFetch,
                  bMessageIdsAreUids, NULL, messageSize, true);
              }
            }
            if (GetServerStateParser().LastCommandSuccessful()
                && m_imapAction != nsIImapUrl::nsImapMsgPreview
                && m_imapAction != nsIImapUrl::nsImapMsgFetchPeek)
            {
              uint32_t uid = atoi(messageIdString.get());
              int32_t index;
              bool foundIt;
              imapMessageFlagsType flags = m_flagState->GetMessageFlagsFromUID(uid, &foundIt, &index);
              if (foundIt)
              {
                flags |= kImapMsgSeenFlag;
                m_flagState->SetMessageFlags(index, flags);
              }
            }
          }
        }
        break;
      case nsIImapUrl::nsImapExpungeFolder:
        Expunge();
        // note fall through to next cases.
      case nsIImapUrl::nsImapSelectFolder:
      case nsIImapUrl::nsImapSelectNoopFolder:
        if (!moreHeadersToDownload)
          ProcessMailboxUpdate(true);
        break;
      case nsIImapUrl::nsImapMsgHeader:
        {
          nsCString messageIds;
          m_runningUrl->GetListOfMessageIds(messageIds);

          FetchMessage(messageIds,
            kHeadersRFC822andUid);
          // if we explicitly ask for headers, as opposed to getting them as a result
          // of selecting the folder, or biff, send the headerFetchCompleted notification
          // to flush out the header cache.
          HeaderFetchCompleted();
        }
        break;
      case nsIImapUrl::nsImapSearch:
        {
          nsAutoCString searchCriteriaString;
          m_runningUrl->CreateSearchCriteriaString(getter_Copies(searchCriteriaString));
          Search(searchCriteriaString.get(), bMessageIdsAreUids);
          // drop the results on the floor for now
        }
        break;
      case nsIImapUrl::nsImapUserDefinedMsgCommand:
        {
          nsCString messageIdString;
          nsCString command;

          m_runningUrl->GetCommand(command);
          m_runningUrl->GetListOfMessageIds(messageIdString);
          IssueUserDefinedMsgCommand(command.get(), messageIdString.get());
        }
        break;
      case nsIImapUrl::nsImapUserDefinedFetchAttribute:
        {
          nsCString messageIdString;
          nsCString attribute;

          m_runningUrl->GetCustomAttributeToFetch(attribute);
          m_runningUrl->GetListOfMessageIds(messageIdString);
          FetchMsgAttribute(messageIdString, attribute);
        }
        break;
      case nsIImapUrl::nsImapMsgStoreCustomKeywords:
        {
          // if the server doesn't support user defined flags, don't try to set them.
          uint16_t userFlags;
          GetSupportedUserFlags(&userFlags);
          if (! (userFlags & kImapMsgSupportUserFlag))
            break;
          nsCString messageIdString;
          nsCString addFlags;
          nsCString subtractFlags;

          m_runningUrl->GetListOfMessageIds(messageIdString);
          m_runningUrl->GetCustomAddFlags(addFlags);
          m_runningUrl->GetCustomSubtractFlags(subtractFlags);
          if (!addFlags.IsEmpty())
          {
            nsAutoCString storeString("+FLAGS (");
            storeString.Append(addFlags);
            storeString.Append(")");
            Store(messageIdString, storeString.get(), true);
          }
          if (!subtractFlags.IsEmpty())
          {
            nsAutoCString storeString("-FLAGS (");
            storeString.Append(subtractFlags);
            storeString.Append(")");
            Store(messageIdString, storeString.get(), true);
          }
        }
        break;
      case nsIImapUrl::nsImapDeleteMsg:
        {
          nsCString messageIdString;
          m_runningUrl->GetListOfMessageIds(messageIdString);

          ProgressEventFunctionUsingName(HandlingMultipleMessages(messageIdString) ?
                                         "imapDeletingMessages" :
                                         "imapDeletingMessage");

          Store(messageIdString, "+FLAGS (\\Deleted)",  bMessageIdsAreUids);

          if (GetServerStateParser().LastCommandSuccessful())
          {
            //delete_message_struct *deleteMsg = (delete_message_struct *) PR_Malloc (sizeof(delete_message_struct));
            // convert name back from utf7
            nsCString canonicalName;
            const char *selectedMailboxName = GetServerStateParser().GetSelectedMailboxName();
            if (selectedMailboxName)
            {
              m_runningUrl->AllocateCanonicalPath(selectedMailboxName,
                kOnlineHierarchySeparatorUnknown, getter_Copies(canonicalName));
            }

            if (m_imapMessageSink)
              m_imapMessageSink->NotifyMessageDeleted(canonicalName.get(), false, messageIdString.get());
            // notice we don't wait for this to finish...
          }
          else
            HandleMemoryFailure();
        }
        break;
      case nsIImapUrl::nsImapDeleteFolderAndMsgs:
        DeleteFolderAndMsgs(mailboxName.get());
        break;
      case nsIImapUrl::nsImapDeleteAllMsgs:
        {
          uint32_t numberOfMessages = GetServerStateParser().NumberOfMessages();
          if (numberOfMessages)
          {
            Store(NS_LITERAL_CSTRING("1:*"), "+FLAGS.SILENT (\\Deleted)",
              false);  // use sequence #'s

            if (GetServerStateParser().LastCommandSuccessful())
              Expunge();      // expunge messages with deleted flag
            if (GetServerStateParser().LastCommandSuccessful())
            {
              // convert name back from utf7
              nsCString canonicalName;
              const char *selectedMailboxName = GetServerStateParser().GetSelectedMailboxName();
              if (selectedMailboxName )
              {
                m_runningUrl->AllocateCanonicalPath(selectedMailboxName,
                  kOnlineHierarchySeparatorUnknown, getter_Copies(canonicalName));
              }

              if (m_imapMessageSink)
                m_imapMessageSink->NotifyMessageDeleted(canonicalName.get(), true, nullptr);
            }

          }
          bool deleteSelf = false;
          DeleteSubFolders(mailboxName.get(), deleteSelf);	// don't delete self
        }
        break;
      case nsIImapUrl::nsImapAppendDraftFromFile:
        {
          OnAppendMsgFromFile();
        }
        break;
      case nsIImapUrl::nsImapAddMsgFlags:
        {
          nsCString messageIdString;
          m_runningUrl->GetListOfMessageIds(messageIdString);

          ProcessStoreFlags(messageIdString, bMessageIdsAreUids,
            msgFlags, true);
        }
        break;
      case nsIImapUrl::nsImapSubtractMsgFlags:
        {
          nsCString messageIdString;
          m_runningUrl->GetListOfMessageIds(messageIdString);

          ProcessStoreFlags(messageIdString, bMessageIdsAreUids,
            msgFlags, false);
        }
        break;
      case nsIImapUrl::nsImapSetMsgFlags:
        {
          nsCString messageIdString;
          m_runningUrl->GetListOfMessageIds(messageIdString);

          ProcessStoreFlags(messageIdString, bMessageIdsAreUids,
            msgFlags, true);
          ProcessStoreFlags(messageIdString, bMessageIdsAreUids,
            ~msgFlags, false);
        }
        break;
      case nsIImapUrl::nsImapBiff:
        PeriodicBiff();
        break;
      case nsIImapUrl::nsImapOnlineCopy:
      case nsIImapUrl::nsImapOnlineMove:
        {
          nsCString messageIdString;
          m_runningUrl->GetListOfMessageIds(messageIdString);
          char *destinationMailbox = OnCreateServerDestinationFolderPathString();

          if (destinationMailbox)
          {
            if (m_imapAction == nsIImapUrl::nsImapOnlineMove)
            {
              if (HandlingMultipleMessages(messageIdString))
                ProgressEventFunctionUsingNameWithString("imapMovingMessages", destinationMailbox);
              else
                ProgressEventFunctionUsingNameWithString("imapMovingMessage", destinationMailbox);
            }
            else {
              if (HandlingMultipleMessages(messageIdString))
                ProgressEventFunctionUsingNameWithString("imapCopyingMessages", destinationMailbox);
              else
                ProgressEventFunctionUsingNameWithString("imapCopyingMessage", destinationMailbox);
            }
            Copy(messageIdString.get(), destinationMailbox, bMessageIdsAreUids);
            PR_FREEIF( destinationMailbox);
            ImapOnlineCopyState copyState;
            if (DeathSignalReceived())
              copyState = ImapOnlineCopyStateType::kInterruptedState;
            else
              copyState = GetServerStateParser().LastCommandSuccessful() ?
              (ImapOnlineCopyState) ImapOnlineCopyStateType::kSuccessfulCopy :
            (ImapOnlineCopyState) ImapOnlineCopyStateType::kFailedCopy;
            if (m_imapMailFolderSink)
              m_imapMailFolderSink->OnlineCopyCompleted(this, copyState);

            // Don't mark msg 'Deleted' for aol servers since we already issued 'xaol-move' cmd.
            if (GetServerStateParser().LastCommandSuccessful() &&
              (m_imapAction == nsIImapUrl::nsImapOnlineMove) &&
              !(GetServerStateParser().ServerIsAOLServer() ||
                GetServerStateParser().GetCapabilityFlag() & kHasMoveCapability))
            {
              Store(messageIdString, "+FLAGS (\\Deleted \\Seen)",
                bMessageIdsAreUids);
              bool storeSuccessful = GetServerStateParser().LastCommandSuccessful();

              if (gExpungeAfterDelete && storeSuccessful)
                Expunge();

              if (m_imapMailFolderSink)
              {
                copyState = storeSuccessful ? (ImapOnlineCopyState) ImapOnlineCopyStateType::kSuccessfulDelete
                  : (ImapOnlineCopyState) ImapOnlineCopyStateType::kFailedDelete;
                m_imapMailFolderSink->OnlineCopyCompleted(this, copyState);
              }
            }
          }
          else
            HandleMemoryFailure();
        }
        break;
      case nsIImapUrl::nsImapOnlineToOfflineCopy:
      case nsIImapUrl::nsImapOnlineToOfflineMove:
        {
          nsCString messageIdString;
          nsresult rv = m_runningUrl->GetListOfMessageIds(messageIdString);
          if (NS_SUCCEEDED(rv))
          {
            SetProgressString("imapFolderReceivingMessageOf");
            m_progressIndex = 0;
            m_progressCount = CountMessagesInIdString(messageIdString.get());

            FetchMessage(messageIdString, kEveryThingRFC822Peek);

            SetProgressString(nullptr);
            if (m_imapMailFolderSink)
            {
              ImapOnlineCopyState copyStatus;
              copyStatus = GetServerStateParser().LastCommandSuccessful() ?
                ImapOnlineCopyStateType::kSuccessfulCopy : ImapOnlineCopyStateType::kFailedCopy;

              m_imapMailFolderSink->OnlineCopyCompleted(this, copyStatus);
              if (GetServerStateParser().LastCommandSuccessful() &&
                (m_imapAction == nsIImapUrl::nsImapOnlineToOfflineMove))
              {
                Store(messageIdString, "+FLAGS (\\Deleted \\Seen)",bMessageIdsAreUids);
                if (GetServerStateParser().LastCommandSuccessful())
                {
                  copyStatus = ImapOnlineCopyStateType::kSuccessfulDelete;
                  if (gExpungeAfterDelete)
                    Expunge();
                }
                else
                  copyStatus = ImapOnlineCopyStateType::kFailedDelete;

                m_imapMailFolderSink->OnlineCopyCompleted(this,  copyStatus);
              }
            }
          }
          else
            HandleMemoryFailure();
        }
        break;
      default:
        if (GetServerStateParser().LastCommandSuccessful() && !uidValidityOk)
          ProcessMailboxUpdate(false); // handle uidvalidity change
        break;
    }
   }
  }
  else if (!DeathSignalReceived())
    HandleMemoryFailure();
}

nsresult nsImapProtocol::BeginMessageDownLoad(
                                              uint32_t total_message_size, // for user, headers and body
                                              const char *content_type)
{
  nsresult rv = NS_OK;
  char *sizeString = PR_smprintf("OPEN Size: %ld", total_message_size);
  Log("STREAM",sizeString,"Begin Message Download Stream");
  PR_Free(sizeString);
  // start counting how many bytes we see in this message after all transformations
  m_bytesToChannel = 0;

  if (content_type)
  {
    m_fromHeaderSeen = false;
    if (GetServerStateParser().GetDownloadingHeaders())
    {
      // if we get multiple calls to BeginMessageDownload w/o intervening
      // calls to NormalEndMessageDownload or Abort, then we're just
      // going to fake a NormalMessageEndDownload. This will most likely
      // cause an empty header to get written to the db, and the user
      // will have to delete the empty header themselves, which
      // should remove the message from the server as well.
      if (m_curHdrInfo)
        NormalMessageEndDownload();
      if (!m_curHdrInfo)
        m_curHdrInfo = m_hdrDownloadCache->StartNewHdr();
      if (m_curHdrInfo)
        m_curHdrInfo->SetMsgSize(total_message_size);
      return NS_OK;
    }
    // if we have a mock channel, that means we have a channel listener who wants the
    // message. So set up a pipe. We'll write the messsage into one end of the pipe
    // and they will read it out of the other end.
    else if (m_channelListener)
    {
      // create a pipe to pump the message into...the output will go to whoever
      // is consuming the message display
      // we create an "infinite" pipe in case we get extremely long lines from the imap server,
      // and the consumer is waiting for a whole line
      nsCOMPtr<nsIPipe> pipe = do_CreateInstance("@mozilla.org/pipe;1");
      rv = pipe->Init(false, false, 4096, PR_UINT32_MAX, nullptr);
      NS_ASSERTION(NS_SUCCEEDED(rv), "nsIPipe->Init failed!");

      pipe->GetInputStream(getter_AddRefs(m_channelInputStream));
      pipe->GetOutputStream(getter_AddRefs(m_channelOutputStream));
    }
    // else, if we are saving the message to disk!
    else if (m_imapMessageSink /* && m_imapAction == nsIImapUrl::nsImapSaveMessageToDisk */)
    {
      // we get here when download the inbox for offline use
      nsCOMPtr<nsIFile> file;
      bool addDummyEnvelope = true;
      nsCOMPtr<nsIMsgMessageUrl> msgurl = do_QueryInterface(m_runningUrl);
      msgurl->GetMessageFile(getter_AddRefs(file));
      msgurl->GetAddDummyEnvelope(&addDummyEnvelope);
      if (file)
        rv = m_imapMessageSink->SetupMsgWriteStream(file, addDummyEnvelope);
    }
    if (m_imapMailFolderSink && m_runningUrl)
    {
      nsCOMPtr <nsISupports> copyState;
      if (m_runningUrl)
      {
        m_runningUrl->GetCopyState(getter_AddRefs(copyState));
        if (copyState) // only need this notification during copy
        {
          nsCOMPtr<nsIMsgMailNewsUrl> mailurl = do_QueryInterface(m_runningUrl);
          m_imapMailFolderSink->StartMessage(mailurl);
        }
      }
    }

  }
  else
    HandleMemoryFailure();
  return rv;
}

void
nsImapProtocol::GetShouldDownloadAllHeaders(bool *aResult)
{
  if (m_imapMailFolderSink)
    m_imapMailFolderSink->GetShouldDownloadAllHeaders(aResult);
}

void
nsImapProtocol::GetArbitraryHeadersToDownload(nsCString &aResult)
{
  if (m_imapServerSink)
    m_imapServerSink->GetArbitraryHeaders(aResult);
}

void
nsImapProtocol::AdjustChunkSize()
{
  int32_t deltaInSeconds;
  PRTime2Seconds(m_endTime - m_startTime, &deltaInSeconds);
  m_trackingTime = false;
  if (deltaInSeconds < 0)
    return;            // bogus for some reason

  if (deltaInSeconds <= m_tooFastTime && m_curFetchSize >= m_chunkSize)
  {
    m_chunkSize += m_chunkAddSize;
    m_chunkThreshold = m_chunkSize + (m_chunkSize / 2);
    // we used to have a max for the chunk size - I don't think that's needed.
  }
  else if (deltaInSeconds <= m_idealTime)
    return;
  else
  {
    if (m_chunkSize > m_chunkStartSize)
      m_chunkSize = m_chunkStartSize;
    else if (m_chunkSize > (m_chunkAddSize * 2))
      m_chunkSize -= m_chunkAddSize;
    m_chunkThreshold = m_chunkSize + (m_chunkSize / 2);
  }
  // remember these new values globally so new connections
  // can take advantage of them.
  if (gChunkSize != m_chunkSize)
  {
    // will cause chunk size pref to be written in CloseStream.
    gChunkSizeDirty = true;
    gChunkSize = m_chunkSize;
    gChunkThreshold = m_chunkThreshold;
  }
}

// authenticated state commands

// escape any backslashes or quotes.  Backslashes are used a lot with our NT server
void nsImapProtocol::CreateEscapedMailboxName(const char *rawName, nsCString &escapedName)
{
  escapedName.Assign(rawName);

  for (int32_t strIndex = 0; *rawName; strIndex++)
  {
    char currentChar = *rawName++;
    if ((currentChar == '\\') || (currentChar == '\"'))
      escapedName.Insert('\\', strIndex++);
  }
}
void nsImapProtocol::SelectMailbox(const char *mailboxName)
{
  ProgressEventFunctionUsingNameWithString("imapStatusSelectingMailbox", mailboxName);
  IncrementCommandTagNumber();

  m_closeNeededBeforeSelect = false;   // initial value
  GetServerStateParser().ResetFlagInfo();
  nsCString escapedName;
  CreateEscapedMailboxName(mailboxName, escapedName);
  nsCString commandBuffer(GetServerCommandTag());
  commandBuffer.Append(" select \"");
  commandBuffer.Append(escapedName.get());
  commandBuffer.Append("\"");
  if (UseCondStore())
    commandBuffer.Append(" (CONDSTORE)");
  commandBuffer.Append(CRLF);

  nsresult res;
  res = SendData(commandBuffer.get());
  if (NS_FAILED(res)) return;
  ParseIMAPandCheckForNewMail();

  int32_t numOfMessagesInFlagState = 0;
  nsImapAction imapAction;
  m_flagState->GetNumberOfMessages(&numOfMessagesInFlagState);
  res = m_runningUrl->GetImapAction(&imapAction);
  // if we've selected a mailbox, and we're not going to do an update because of the
  // url type, but don't have the flags, go get them!
  if (GetServerStateParser().LastCommandSuccessful() && NS_SUCCEEDED(res) &&
    imapAction != nsIImapUrl::nsImapSelectFolder && imapAction != nsIImapUrl::nsImapExpungeFolder
    && imapAction != nsIImapUrl::nsImapLiteSelectFolder &&
    imapAction != nsIImapUrl::nsImapDeleteAllMsgs &&
    ((GetServerStateParser().NumberOfMessages() != numOfMessagesInFlagState) && (numOfMessagesInFlagState == 0)))
  {
      ProcessMailboxUpdate(false);
  }
}

// Please call only with a single message ID
void nsImapProtocol::Bodystructure(const nsCString &messageId, bool idIsUid)
{
  IncrementCommandTagNumber();

  nsCString commandString(GetServerCommandTag());
  if (idIsUid)
    commandString.Append(" UID");
  commandString.Append(" fetch ");

  commandString.Append(messageId);
  commandString.Append(" (BODYSTRUCTURE)" CRLF);

  nsresult rv = SendData(commandString.get());
  if (NS_SUCCEEDED(rv))
      ParseIMAPandCheckForNewMail(commandString.get());
}

void nsImapProtocol::PipelinedFetchMessageParts(const char *uid, nsIMAPMessagePartIDArray *parts)
{
  // assumes no chunking

  // build up a string to fetch
  nsCString stringToFetch, what;
  int32_t currentPartNum = 0;
  while ((parts->GetNumParts() > currentPartNum) && !DeathSignalReceived())
  {
    nsIMAPMessagePartID *currentPart = parts->GetPart(currentPartNum);
    if (currentPart)
    {
      // Do things here depending on the type of message part
      // Append it to the fetch string
      if (currentPartNum > 0)
        stringToFetch.Append(" ");

      switch (currentPart->GetFields())
      {
      case kMIMEHeader:
        what = "BODY.PEEK[";
        what.Append(currentPart->GetPartNumberString());
        what.Append(".MIME]");
        stringToFetch.Append(what);
        break;
      case kRFC822HeadersOnly:
        if (currentPart->GetPartNumberString())
        {
          what = "BODY.PEEK[";
          what.Append(currentPart->GetPartNumberString());
          what.Append(".HEADER]");
          stringToFetch.Append(what);
        }
        else
        {
          // headers for the top-level message
          stringToFetch.Append("BODY.PEEK[HEADER]");
        }
        break;
      default:
        NS_ASSERTION(false, "we should only be pipelining MIME headers and Message headers");
        break;
      }

    }
    currentPartNum++;
  }

  // Run the single, pipelined fetch command
  if ((parts->GetNumParts() > 0) && !DeathSignalReceived() && !GetPseudoInterrupted() && stringToFetch.get())
  {
      IncrementCommandTagNumber();

    nsCString commandString(GetServerCommandTag());
    commandString.Append(" UID fetch ");
    commandString.Append(uid, 10);
    commandString.Append(" (");
    commandString.Append(stringToFetch);
    commandString.Append(")" CRLF);
    nsresult rv = SendData(commandString.get());
        if (NS_SUCCEEDED(rv))
            ParseIMAPandCheckForNewMail(commandString.get());
  }
}


void nsImapProtocol::FetchMsgAttribute(const nsCString &messageIds, const nsCString &attribute)
{
    IncrementCommandTagNumber();

    nsAutoCString commandString (GetServerCommandTag());
    commandString.Append(" UID fetch ");
    commandString.Append(messageIds);
    commandString.Append(" (");
    commandString.Append(attribute);
    commandString.Append(")" CRLF);
    nsresult rv = SendData(commandString.get());

    if (NS_SUCCEEDED(rv))
       ParseIMAPandCheckForNewMail(commandString.get());
    GetServerStateParser().SetFetchingFlags(false);
    // Always clear this flag after every fetch.
    m_fetchingWholeMessage = false;
}

// this routine is used to fetch a message or messages, or headers for a
// message...

void nsImapProtocol::FallbackToFetchWholeMsg(const nsCString &messageId, uint32_t messageSize)
{
  if (m_imapMessageSink && m_runningUrl)
  {
    bool shouldStoreMsgOffline;
    m_runningUrl->GetStoreOfflineOnFallback(&shouldStoreMsgOffline);
    m_runningUrl->SetStoreResultsOffline(shouldStoreMsgOffline);
  }
  FetchTryChunking(messageId,
                   m_imapAction == nsIImapUrl::nsImapMsgFetchPeek ?
                     kEveryThingRFC822Peek : kEveryThingRFC822,
                   true, nullptr, messageSize, true);
}

void
nsImapProtocol::FetchMessage(const nsCString &messageIds,
                             nsIMAPeFetchFields whatToFetch,
                             const char *fetchModifier,
                             uint32_t startByte, uint32_t numBytes,
                             char *part)
{
  IncrementCommandTagNumber();

  nsCString commandString;
  commandString = "%s UID fetch";

  switch (whatToFetch) {
  case kEveryThingRFC822:
    m_flagChangeCount++;
    m_fetchingWholeMessage = true;
    if (m_trackingTime)
      AdjustChunkSize();      // we started another segment
    m_startTime = PR_Now();     // save start of download time
    m_trackingTime = true;
    PR_LOG(IMAP, PR_LOG_DEBUG, ("FetchMessage everything: curFetchSize %u numBytes %u",
                                m_curFetchSize, numBytes));
    if (numBytes > 0)
      m_curFetchSize = numBytes;

    if (GetServerStateParser().ServerHasIMAP4Rev1Capability())
    {
      if (GetServerStateParser().GetCapabilityFlag() & kHasXSenderCapability)
        commandString.Append(" %s (XSENDER UID RFC822.SIZE BODY[]");
      else
        commandString.Append(" %s (UID RFC822.SIZE BODY[]");
    }
    else
    {
      if (GetServerStateParser().GetCapabilityFlag() & kHasXSenderCapability)
        commandString.Append(" %s (XSENDER UID RFC822.SIZE RFC822");
      else
        commandString.Append(" %s (UID RFC822.SIZE RFC822");
    }
    if (numBytes > 0)
    {
      // if we are retrieving chunks
      char *byterangeString = PR_smprintf("<%ld.%ld>",startByte, numBytes);
      if (byterangeString)
      {
        commandString.Append(byterangeString);
        PR_Free(byterangeString);
      }
    }
    commandString.Append(")");

    break;

  case kEveryThingRFC822Peek:
    {
      PR_LOG(IMAP, PR_LOG_DEBUG, ("FetchMessage peek: curFetchSize %u numBytes %u",
                                  m_curFetchSize, numBytes));
      if (numBytes > 0)
        m_curFetchSize = numBytes;
      const char *formatString = "";
      eIMAPCapabilityFlags server_capabilityFlags = GetServerStateParser().GetCapabilityFlag();

      m_fetchingWholeMessage = true;
      if (server_capabilityFlags & kIMAP4rev1Capability)
      {
        // use body[].peek since rfc822.peek is not in IMAP4rev1
        if (server_capabilityFlags & kHasXSenderCapability)
          formatString = " %s (XSENDER UID RFC822.SIZE BODY.PEEK[]";
        else
          formatString = " %s (UID RFC822.SIZE BODY.PEEK[]";
      }
      else
      {
        if (server_capabilityFlags & kHasXSenderCapability)
          formatString = " %s (XSENDER UID RFC822.SIZE RFC822.peek";
        else
          formatString = " %s (UID RFC822.SIZE RFC822.peek";
      }

      commandString.Append(formatString);
      if (numBytes > 0)
      {
        // if we are retrieving chunks
        char *byterangeString = PR_smprintf("<%ld.%ld>",startByte, numBytes);
        if (byterangeString)
        {
          commandString.Append(byterangeString);
          PR_Free(byterangeString);
        }
      }
      commandString.Append(")");
    }
    break;
  case kHeadersRFC822andUid:
    if (GetServerStateParser().ServerHasIMAP4Rev1Capability())
    {
      eIMAPCapabilityFlags server_capabilityFlags = GetServerStateParser().GetCapabilityFlag();
      bool aolImapServer = ((server_capabilityFlags & kAOLImapCapability) != 0);
      bool downloadAllHeaders = false;
      // checks if we're filtering on "any header" or running a spam filter requiring all headers
      GetShouldDownloadAllHeaders(&downloadAllHeaders);

      if (!downloadAllHeaders)  // if it's ok -- no filters on any header, etc.
      {
        char *headersToDL = nullptr;
        char *what = nullptr;
        const char *dbHeaders = (gUseEnvelopeCmd) ? IMAP_DB_HEADERS : IMAP_ENV_AND_DB_HEADERS;
        nsCString arbitraryHeaders;
        GetArbitraryHeadersToDownload(arbitraryHeaders);
        for (uint32_t i = 0; i < mCustomDBHeaders.Length(); i++)
        {
          if (arbitraryHeaders.Find(mCustomDBHeaders[i], CaseInsensitiveCompare) == kNotFound)
          {
            if (!arbitraryHeaders.IsEmpty())
              arbitraryHeaders.Append(' ');
            arbitraryHeaders.Append(mCustomDBHeaders[i]);
          }
        }
        for (uint32_t i = 0; i < mCustomHeaders.Length(); i++)
        {
           if (arbitraryHeaders.Find(mCustomHeaders[i], CaseInsensitiveCompare) == kNotFound)
          {
            if (!arbitraryHeaders.IsEmpty())
              arbitraryHeaders.Append(' ');
            arbitraryHeaders.Append(mCustomHeaders[i]);
          }
        }
        if (arbitraryHeaders.IsEmpty())
          headersToDL = strdup(dbHeaders);
        else
          headersToDL = PR_smprintf("%s %s",dbHeaders, arbitraryHeaders.get());

        if (gUseEnvelopeCmd)
          what = PR_smprintf(" ENVELOPE BODY.PEEK[HEADER.FIELDS (%s)])", headersToDL);
        else
          what = PR_smprintf(" BODY.PEEK[HEADER.FIELDS (%s)])",headersToDL);
        NS_Free(headersToDL);
        if (what)
        {
          commandString.Append(" %s (UID ");
           if (m_isGmailServer)
            commandString.Append("X-GM-MSGID X-GM-THRID X-GM-LABELS ");
          if (aolImapServer)
            commandString.Append(" XAOL.SIZE") ;
          else
            commandString.Append("RFC822.SIZE");
          commandString.Append(" FLAGS");
          commandString.Append(what);
          PR_Free(what);
        }
        else
        {
          commandString.Append(" %s (UID RFC822.SIZE BODY.PEEK[HEADER] FLAGS)");
        }
      }
      else
        commandString.Append(" %s (UID RFC822.SIZE BODY.PEEK[HEADER] FLAGS)");
    }
    else
      commandString.Append(" %s (UID RFC822.SIZE RFC822.HEADER FLAGS)");
    break;
  case kUid:
    commandString.Append(" %s (UID)");
    break;
  case kFlags:
    GetServerStateParser().SetFetchingFlags(true);
    commandString.Append(" %s (FLAGS)");
    break;
  case kRFC822Size:
    commandString.Append(" %s (RFC822.SIZE)");
    break;
  case kBodyStart:
    {
      int32_t numBytesToFetch;
      m_runningUrl->GetNumBytesToFetch(&numBytesToFetch);

      commandString.Append(" %s (UID BODY.PEEK[HEADER.FIELDS (Content-Type Content-Transfer-Encoding)] BODY.PEEK[TEXT]<0.");
      commandString.AppendInt(numBytesToFetch);
      commandString.Append(">)");
    }
    break;
  case kRFC822HeadersOnly:
    if (GetServerStateParser().ServerHasIMAP4Rev1Capability())
    {
      if (part)
      {
        commandString.Append(" %s (BODY[");
        char *what = PR_smprintf("%s.HEADER])", part);
        if (what)
        {
          commandString.Append(what);
          PR_Free(what);
        }
        else
          HandleMemoryFailure();
      }
      else
      {
        // headers for the top-level message
        commandString.Append(" %s (BODY[HEADER])");
      }
    }
    else
      commandString.Append(" %s (RFC822.HEADER)");
    break;
  case kMIMEPart:
    commandString.Append(" %s (BODY.PEEK[%s]");
    if (numBytes > 0)
    {
      // if we are retrieving chunks
      char *byterangeString = PR_smprintf("<%ld.%ld>",startByte, numBytes);
      if (byterangeString)
      {
        commandString.Append(byterangeString);
        PR_Free(byterangeString);
      }
    }
    commandString.Append(")");
    break;
  case kMIMEHeader:
    commandString.Append(" %s (BODY[%s.MIME])");
    break;
  };

  if (fetchModifier)
    commandString.Append(fetchModifier);

  commandString.Append(CRLF);

  // since messageIds can be infinitely long, use a dynamic buffer rather than the fixed one
  const char *commandTag = GetServerCommandTag();
  int protocolStringSize = commandString.Length() + messageIds.Length() + PL_strlen(commandTag) + 1 +
    (part ? PL_strlen(part) : 0);
  char *protocolString = (char *) PR_CALLOC( protocolStringSize );

  if (protocolString)
  {
    char *cCommandStr = ToNewCString(commandString);
    if ((whatToFetch == kMIMEPart) ||
      (whatToFetch == kMIMEHeader))
    {
      PR_snprintf(protocolString,                                      // string to create
        protocolStringSize,                                      // max size
        cCommandStr,                                   // format string
        commandTag,                          // command tag
        messageIds.get(),
        part);
    }
    else
    {
      PR_snprintf(protocolString,                                      // string to create
        protocolStringSize,                                      // max size
        cCommandStr,                                   // format string
        commandTag,                          // command tag
        messageIds.get());
    }

    nsresult rv = SendData(protocolString);

    nsMemory::Free(cCommandStr);
    if (NS_SUCCEEDED(rv))
      ParseIMAPandCheckForNewMail(protocolString);
    PR_Free(protocolString);
    GetServerStateParser().SetFetchingFlags(false);
    // Always clear this flag after every fetch.
    m_fetchingWholeMessage = false;
    if (GetServerStateParser().LastCommandSuccessful() && CheckNeeded())
      Check();
  }
  else
    HandleMemoryFailure();
}

void nsImapProtocol::FetchTryChunking(const nsCString &messageIds,
                                      nsIMAPeFetchFields whatToFetch,
                                      bool idIsUid,
                                      char *part,
                                      uint32_t downloadSize,
                                      bool tryChunking)
{
  GetServerStateParser().SetTotalDownloadSize(downloadSize);
  PR_LOG(IMAP, PR_LOG_DEBUG, ("FetchTryChunking: curFetchSize %u", downloadSize));
  m_curFetchSize = downloadSize; // we'll change this if chunking.
  if (m_fetchByChunks && tryChunking &&
        GetServerStateParser().ServerHasIMAP4Rev1Capability() &&
    (downloadSize > (uint32_t) m_chunkThreshold))
  {
    uint32_t startByte = 0;
    GetServerStateParser().ClearLastFetchChunkReceived();
    while (!DeathSignalReceived() && !GetPseudoInterrupted() &&
      !GetServerStateParser().GetLastFetchChunkReceived() &&
      GetServerStateParser().ContinueParse())
    {
      FetchMessage(messageIds,
             whatToFetch,
             nullptr,
             startByte, m_chunkSize,
             part);
      startByte += m_chunkSize;
    }

    // Only abort the stream if this is a normal message download
    // Otherwise, let the body shell abort the stream.
    if ((whatToFetch == kEveryThingRFC822)
      &&
      ((startByte > 0 && (startByte < downloadSize) &&
      (DeathSignalReceived() || GetPseudoInterrupted())) ||
      !GetServerStateParser().ContinueParse()))
    {
      AbortMessageDownLoad();
      PseudoInterrupt(false);
    }
  }
  else
  {
    // small message, or (we're not chunking and not doing bodystructure),
    // or the server is not rev1.
    // Just fetch the whole thing.
    FetchMessage(messageIds, whatToFetch, nullptr, 0, 0, part);
  }
}


void nsImapProtocol::PipelinedFetchMessageParts(nsCString &uid, nsIMAPMessagePartIDArray *parts)
{
  // assumes no chunking

  // build up a string to fetch
  nsCString stringToFetch;
  nsCString what;

  int32_t currentPartNum = 0;
  while ((parts->GetNumParts() > currentPartNum) && !DeathSignalReceived())
  {
    nsIMAPMessagePartID *currentPart = parts->GetPart(currentPartNum);
    if (currentPart)
    {
      // Do things here depending on the type of message part
      // Append it to the fetch string
      if (currentPartNum > 0)
        stringToFetch += " ";

      switch (currentPart->GetFields())
      {
      case kMIMEHeader:
        what = "BODY.PEEK[";
        what += currentPart->GetPartNumberString();
        what += ".MIME]";
        stringToFetch += what;
        break;
      case kRFC822HeadersOnly:
        if (currentPart->GetPartNumberString())
        {
          what = "BODY.PEEK[";
          what += currentPart->GetPartNumberString();
          what += ".HEADER]";
          stringToFetch += what;
        }
        else
        {
          // headers for the top-level message
          stringToFetch += "BODY.PEEK[HEADER]";
        }
        break;
      default:
        NS_ASSERTION(false, "we should only be pipelining MIME headers and Message headers");
        break;
      }

    }
    currentPartNum++;
  }

  // Run the single, pipelined fetch command
  if ((parts->GetNumParts() > 0) && !DeathSignalReceived() && !GetPseudoInterrupted() && stringToFetch.get())
  {
      IncrementCommandTagNumber();

    char *commandString = PR_smprintf("%s UID fetch %s (%s)%s",
                                          GetServerCommandTag(), uid.get(),
                                          stringToFetch.get(), CRLF);

    if (commandString)
    {
      nsresult rv = SendData(commandString);
            if (NS_SUCCEEDED(rv))
                ParseIMAPandCheckForNewMail(commandString);
      PR_Free(commandString);
    }
    else
      HandleMemoryFailure();
  }
}


void
nsImapProtocol::PostLineDownLoadEvent(const char *line, uint32_t uidOfMessage)
{
  if (!GetServerStateParser().GetDownloadingHeaders())
  {
    uint32_t byteCount = PL_strlen(line);
    bool echoLineToMessageSink = false;
    // if we have a channel listener, then just spool the message
    // directly to the listener
    if (m_channelListener)
    {
      uint32_t count = 0;
      if (m_channelOutputStream)
      {
        nsresult rv = m_channelOutputStream->Write(line, byteCount, &count);
        NS_ASSERTION(count == byteCount, "IMAP channel pipe couldn't buffer entire write");
        if (NS_SUCCEEDED(rv))
        {
          nsCOMPtr<nsIRequest> request = do_QueryInterface(m_mockChannel);
          m_channelListener->OnDataAvailable(request, m_channelContext, m_channelInputStream, 0, count);
        }
        // else some sort of explosion?
      }
    }
    if (m_runningUrl)
      m_runningUrl->GetStoreResultsOffline(&echoLineToMessageSink);

    m_bytesToChannel += byteCount;
    if (m_imapMessageSink && line && echoLineToMessageSink && !GetPseudoInterrupted())
      m_imapMessageSink->ParseAdoptedMsgLine(line, uidOfMessage, m_runningUrl);
  }
  // ***** We need to handle the pseudo interrupt here *****
}

// Handle a line seen by the parser.
// * The argument |lineCopy| must be nullptr or should contain the same string as
//   |line|.  |lineCopy| will be modified.
// * A line may be passed by parts, e.g., "part1 part2\r\n" may be passed as
//     HandleMessageDownLoadLine("part 1 ", 1);
//     HandleMessageDownLoadLine("part 2\r\n", 0);
//   However, it is assumed that a CRLF or a CRCRLF is never split (i.e., this is
//   ensured *before* invoking this method).
void nsImapProtocol::HandleMessageDownLoadLine(const char *line, bool isPartialLine,
                                               char *lineCopy)
{
  NS_PRECONDITION(lineCopy == nullptr || !PL_strcmp(line, lineCopy),
                  "line and lineCopy must contain the same string");
  const char *messageLine = line;
  uint32_t lineLength = strlen(messageLine);
  const char *cEndOfLine = messageLine + lineLength;
  char *localMessageLine = nullptr;

  // If we obtain a partial line (due to fetching by chunks), we do not
  // add/modify the end-of-line terminator.
  if (!isPartialLine)
  {
    // Change this line to native line termination, duplicate if necessary.
    // Do not assume that the line really ends in CRLF
    // to start with, even though it is supposed to be RFC822

    // normalize line endings to CRLF unless we are saving the message to disk
    bool canonicalLineEnding = true;
    nsCOMPtr<nsIMsgMessageUrl> msgUrl = do_QueryInterface(m_runningUrl);

    if (m_imapAction == nsIImapUrl::nsImapSaveMessageToDisk && msgUrl)
      msgUrl->GetCanonicalLineEnding(&canonicalLineEnding);

    NS_PRECONDITION(MSG_LINEBREAK_LEN == 1 ||
                    (MSG_LINEBREAK_LEN == 2 && !PL_strcmp(CRLF, MSG_LINEBREAK)),
                    "violated assumptions on MSG_LINEBREAK");
    if (MSG_LINEBREAK_LEN == 1 && !canonicalLineEnding)
    {
      bool lineEndsWithCRorLF = lineLength >= 1 &&
        (cEndOfLine[-1] == '\r' || cEndOfLine[-1] == '\n');
      char *endOfLine;
      if (lineCopy && lineEndsWithCRorLF)  // true for most lines
      {
        endOfLine = lineCopy + lineLength;
        messageLine = lineCopy;
      }
      else
      {
        // leave enough room for one more char, MSG_LINEBREAK[0]
        localMessageLine = (char *) PR_MALLOC(lineLength + 2);
        if (!localMessageLine) // memory failure
          return;
        PL_strcpy(localMessageLine, line);
        endOfLine = localMessageLine + lineLength;
        messageLine = localMessageLine;
      }

      if (lineLength >= 2 &&
        endOfLine[-2] == '\r' &&
        endOfLine[-1] == '\n')
      {
        if(lineLength>=3 && endOfLine[-3] == '\r') // CRCRLF
        {
          endOfLine--;
          lineLength--;
        }
        /* CRLF -> CR or LF */
        endOfLine[-2] = MSG_LINEBREAK[0];
        endOfLine[-1] = '\0';
        lineLength--;
      }
      else if (lineLength >= 1 &&
        ((endOfLine[-1] == '\r') || (endOfLine[-1] == '\n')))
      {
        /* CR -> LF or LF -> CR */
        endOfLine[-1] = MSG_LINEBREAK[0];
      }
      else // no eol characters at all
      {
        endOfLine[0] = MSG_LINEBREAK[0]; // CR or LF
        endOfLine[1] = '\0';
        lineLength++;
      }
    }
    else  // enforce canonical CRLF linebreaks
    {
      if (lineLength==0 || (lineLength == 1 && cEndOfLine[-1] == '\n'))
      {
        messageLine = CRLF;
        lineLength = 2;
      }
      else if (cEndOfLine[-1] != '\n' || cEndOfLine[-2] != '\r' ||
               (lineLength >=3 && cEndOfLine[-3] == '\r'))
      {
        // The line does not end in CRLF (or it ends in CRCRLF).
        // Copy line and leave enough room for two more chars (CR and LF).
        localMessageLine = (char *) PR_MALLOC(lineLength + 3);
        if (!localMessageLine) // memory failure
            return;
        PL_strcpy(localMessageLine, line);
        char *endOfLine = localMessageLine + lineLength;
        messageLine = localMessageLine;

        if (lineLength>=3 && endOfLine[-1] == '\n' &&
            endOfLine[-2] == '\r')
        {
          // CRCRLF -> CRLF
          endOfLine[-2] = '\n';
          endOfLine[-1] = '\0';
          lineLength--;
        }
        else if ((endOfLine[-1] == '\r') || (endOfLine[-1] == '\n'))
        {
          // LF -> CRLF or CR -> CRLF
          endOfLine[-1] = '\r';
          endOfLine[0]  = '\n';
          endOfLine[1]  = '\0';
          lineLength++;
        }
        else // no eol characters at all
        {
          endOfLine[0] = '\r';
          endOfLine[1] = '\n';
          endOfLine[2] = '\0';
          lineLength += 2;
        }
      }
    }
  }
  NS_ASSERTION(lineLength == PL_strlen(messageLine), "lineLength not accurate");

  // check if sender obtained via XSENDER server extension matches "From:" field
  const char *xSenderInfo = GetServerStateParser().GetXSenderInfo();
  if (xSenderInfo && *xSenderInfo && !m_fromHeaderSeen)
  {
    if (!PL_strncmp("From: ", messageLine, 6))
    {
      m_fromHeaderSeen = true;
      if (PL_strstr(messageLine, xSenderInfo) != NULL)
          // Adding a X-Mozilla-Status line here is not very elegant but it
          // works.  Another X-Mozilla-Status line is added to the message when
          // downloading to a local folder; this new line will also contain the
          // 'authed' flag we are adding here.  (If the message is again
          // uploaded to the server, this flag is lost.)
          // 0x0200 == nsMsgMessageFlags::SenderAuthed
          HandleMessageDownLoadLine("X-Mozilla-Status: 0200\r\n", false);
      GetServerStateParser().FreeXSenderInfo();
    }
  }

  if (GetServerStateParser().GetDownloadingHeaders())
  {
    if (!m_curHdrInfo)
      BeginMessageDownLoad(GetServerStateParser().SizeOfMostRecentMessage(), MESSAGE_RFC822);
    if (m_curHdrInfo)
      m_curHdrInfo->CacheLine(messageLine, GetServerStateParser().CurrentResponseUID());
    PR_Free(localMessageLine);
    return;
  }
  // if this line is for a different message, or the incoming line is too big
  if (((m_downloadLineCache->CurrentUID() != GetServerStateParser().CurrentResponseUID()) && !m_downloadLineCache->CacheEmpty()) ||
      (m_downloadLineCache->SpaceAvailable() < lineLength + 1) )
    FlushDownloadCache();

  // so now the cache is flushed, but this string might still be to big
  if (m_downloadLineCache->SpaceAvailable() < lineLength + 1)
      PostLineDownLoadEvent(messageLine, GetServerStateParser().CurrentResponseUID());
  else
    m_downloadLineCache->CacheLine(messageLine, GetServerStateParser().CurrentResponseUID());

  PR_Free(localMessageLine);
}

void nsImapProtocol::FlushDownloadCache()
{
  if (!m_downloadLineCache->CacheEmpty())
  {
    msg_line_info *downloadLine = m_downloadLineCache->GetCurrentLineInfo();
    PostLineDownLoadEvent(downloadLine->adoptedMessageLine,
                          downloadLine->uidOfMessage);
    m_downloadLineCache->ResetCache();
  }
}

void nsImapProtocol::NormalMessageEndDownload()
{
  Log("STREAM", "CLOSE", "Normal Message End Download Stream");

  if (m_trackingTime)
    AdjustChunkSize();
  if (m_imapMailFolderSink && m_curHdrInfo && GetServerStateParser().GetDownloadingHeaders())
  {
    m_curHdrInfo->SetMsgSize(GetServerStateParser().SizeOfMostRecentMessage());
    m_curHdrInfo->SetMsgUid(GetServerStateParser().CurrentResponseUID());
    m_hdrDownloadCache->FinishCurrentHdr();
    int32_t numHdrsCached;
    m_hdrDownloadCache->GetNumHeaders(&numHdrsCached);
    if (numHdrsCached == kNumHdrsToXfer)
    {
      m_imapMailFolderSink->ParseMsgHdrs(this, m_hdrDownloadCache);
      m_hdrDownloadCache->ResetAll();
    }
  }
  FlushDownloadCache();

  if (!GetServerStateParser().GetDownloadingHeaders())
  {
    int32_t updatedMessageSize = -1;
    if (m_fetchingWholeMessage)
    {
      updatedMessageSize = m_bytesToChannel;
#ifdef PR_LOGGING
      if (m_bytesToChannel != GetServerStateParser().SizeOfMostRecentMessage()) {
        PR_LOG(IMAP, PR_LOG_DEBUG, ("STREAM:CLOSE Server's RFC822.SIZE %u, actual size %u",
                                    GetServerStateParser().SizeOfMostRecentMessage(),
                                    m_bytesToChannel));
      }
#endif
    }
    // need to know if we're downloading for display or not. We'll use action == nsImapMsgFetch for now
    nsImapAction imapAction = nsIImapUrl::nsImapSelectFolder; // just set it to some legal value
    if (m_runningUrl)
      m_runningUrl->GetImapAction(&imapAction);

    if (m_imapMessageSink)
      m_imapMessageSink->NormalEndMsgWriteStream(m_downloadLineCache->CurrentUID(), imapAction == nsIImapUrl::nsImapMsgFetch, m_runningUrl, updatedMessageSize);

    if (m_runningUrl && m_imapMailFolderSink)
    {
      nsCOMPtr <nsISupports> copyState;
      m_runningUrl->GetCopyState(getter_AddRefs(copyState));
      if (copyState) // only need this notification during copy
      {
        nsCOMPtr<nsIMsgMailNewsUrl> mailUrl (do_QueryInterface(m_runningUrl));
        m_imapMailFolderSink->EndMessage(mailUrl, m_downloadLineCache->CurrentUID());
      }
    }
  }
  m_curHdrInfo = nullptr;
}

void nsImapProtocol::AbortMessageDownLoad()
{
  Log("STREAM", "CLOSE", "Abort Message  Download Stream");

  if (m_trackingTime)
    AdjustChunkSize();
  FlushDownloadCache();
  if (GetServerStateParser().GetDownloadingHeaders())
  {
    if (m_imapMailFolderSink)
      m_imapMailFolderSink->AbortHeaderParseStream(this);
  }
  else if (m_imapMessageSink)
        m_imapMessageSink->AbortMsgWriteStream();

  m_curHdrInfo = nullptr;
}


void nsImapProtocol::ProcessMailboxUpdate(bool handlePossibleUndo)
{
  if (DeathSignalReceived())
    return;

  // Update quota information
  char *boxName;
  GetSelectedMailboxName(&boxName);
  GetQuotaDataIfSupported(boxName);
  PR_Free(boxName);

  // fetch the flags and uids of all existing messages or new ones
  if (!DeathSignalReceived() && GetServerStateParser().NumberOfMessages())
  {
    if (handlePossibleUndo)
    {
      // undo any delete flags we may have asked to
      nsCString undoIdsStr;
      nsAutoCString undoIds;

      GetCurrentUrl()->GetListOfMessageIds(undoIdsStr);
      undoIds.Assign(undoIdsStr);
      if (!undoIds.IsEmpty())
      {
        char firstChar = (char) undoIds.CharAt(0);
        undoIds.Cut(0, 1);  // remove first character
        // if this string started with a '-', then this is an undo of a delete
        // if its a '+' its a redo
        if (firstChar == '-')
          Store(undoIds, "-FLAGS (\\Deleted)", true);  // most servers will fail silently on a failure, deal with it?
        else  if (firstChar == '+')
          Store(undoIds, "+FLAGS (\\Deleted)", true);  // most servers will fail silently on a failure, deal with it?
        else
          NS_ASSERTION(false, "bogus undo Id's");
      }
    }

    // make the parser record these flags
    nsCString fetchStr;
    int32_t added = 0, deleted = 0;

    m_flagState->GetNumberOfMessages(&added);
    deleted = m_flagState->NumberOfDeletedMessages();
    bool flagStateEmpty = !added;
    // Figure out if we need to do any kind of sync.
    bool needFolderSync = (flagStateEmpty || added == deleted) && (!UseCondStore() ||
      (GetServerStateParser().fHighestModSeq != mFolderLastModSeq) ||
      (GetShowDeletedMessages() &&
         GetServerStateParser().NumberOfMessages() != mFolderTotalMsgCount));

    // Figure out if we need to do a full sync (UID Fetch Flags 1:*),
    // a partial sync using CHANGEDSINCE, or a sync from the previous
    // highwater mark.

    // if the folder doesn't know about the highest uid, or the flag state
    // is empty, and we're not using CondStore, we need a full sync.
    bool needFullFolderSync = !mFolderHighestUID || (flagStateEmpty && !UseCondStore());

    if (needFullFolderSync || needFolderSync)
    {
      nsCString idsToFetch("1:*");
      char fetchModifier[40] = "";
      if (!needFullFolderSync && !GetShowDeletedMessages() && UseCondStore())
        PR_snprintf(fetchModifier, sizeof(fetchModifier), " (CHANGEDSINCE %llu)",
                    mFolderLastModSeq);
      else
        m_flagState->SetPartialUIDFetch(false);

      FetchMessage(idsToFetch, kFlags, fetchModifier);
      // lets see if we should expunge during a full sync of flags.
      if (GetServerStateParser().LastCommandSuccessful())
      {
        // if we did a CHANGEDSINCE fetch, do a sanity check on the msg counts
        // to see if some other client may have done an expunge.
        if (m_flagState->GetPartialUIDFetch())
        {
          if (m_flagState->NumberOfDeletedMessages() +
              mFolderTotalMsgCount != GetServerStateParser().NumberOfMessages())
          {
            // sanity check failed - fall back to full flag sync
            m_flagState->Reset();
            m_flagState->SetPartialUIDFetch(false);
            FetchMessage(NS_LITERAL_CSTRING("1:*"), kFlags);
          }
        }
        int32_t numDeleted = m_flagState->NumberOfDeletedMessages();
        // Don't do expunge when we are lite selecting folder because we
        // could be doing undo.
        // Expunge if we're always expunging, or the number of deleted messages
        // is over the threshhold, and we're either always respecting the
        // threshhold, or we're expunging based on the delete model, and
        // the delete model is not the imap delete model.
        if (m_imapAction != nsIImapUrl::nsImapLiteSelectFolder &&
            (gExpungeOption == kAutoExpungeAlways ||
             (numDeleted >= gExpungeThreshold &&
              (gExpungeOption == kAutoExpungeOnThreshold ||
               (gExpungeOption == kAutoExpungeDeleteModel && !GetShowDeletedMessages())))))
          Expunge();
      }
    }
    else
    {
      uint32_t highestRecordedUID = GetServerStateParser().HighestRecordedUID();
      // if we're using CONDSTORE, and the parser hasn't seen any UIDs, use
      // the highest UID we've seen from the folder.
      if (UseCondStore() && !highestRecordedUID)
        highestRecordedUID = mFolderHighestUID;

      AppendUid(fetchStr, highestRecordedUID + 1);
      fetchStr.Append(":*");
      FetchMessage(fetchStr, kFlags);      // only new messages please
    }
  }
  else if (GetServerStateParser().LastCommandSuccessful())
  {
    GetServerStateParser().ResetFlagInfo();
    // the flag state is empty, but not partial.
    m_flagState->SetPartialUIDFetch(false);
  }

  if (GetServerStateParser().LastCommandSuccessful())
  {
    nsImapAction imapAction;
    nsresult res = m_runningUrl->GetImapAction(&imapAction);
    if (NS_SUCCEEDED(res) && imapAction == nsIImapUrl::nsImapLiteSelectFolder)
      return;
  }

  bool entered_waitForBodyIdsMonitor = false;

  uint32_t *msgIdList = nullptr;
  uint32_t msgCount = 0;

  nsImapMailboxSpec *new_spec = GetServerStateParser().CreateCurrentMailboxSpec();
  if (new_spec && GetServerStateParser().LastCommandSuccessful())
  {
    nsImapAction imapAction;
    nsresult res = m_runningUrl->GetImapAction(&imapAction);
    if (NS_SUCCEEDED(res) && imapAction == nsIImapUrl::nsImapExpungeFolder)
      new_spec->mBoxFlags |= kJustExpunged;
    m_waitForBodyIdsMonitor.Enter();
    entered_waitForBodyIdsMonitor = true;

    if (m_imapMailFolderSink)
    {
      bool more;
      m_imapMailFolderSink->UpdateImapMailboxInfo(this, new_spec);
      m_imapMailFolderSink->GetMsgHdrsToDownload(&more, &m_progressCount,
                                                 &msgCount, &msgIdList);
      m_progressIndex = 0;
      m_runningUrl->SetMoreHeadersToDownload(more);
      // We're going to be re-running this url if there are more headers.
      if (more)
        m_runningUrl->SetRerunningUrl(true);
    }
  }
  else if (!new_spec)
    HandleMemoryFailure();

  if (GetServerStateParser().LastCommandSuccessful())
  {
    if (entered_waitForBodyIdsMonitor)
      m_waitForBodyIdsMonitor.Exit();

    if (msgIdList && !DeathSignalReceived() && GetServerStateParser().LastCommandSuccessful())
    {
      FolderHeaderDump(msgIdList, msgCount);
      NS_Free( msgIdList);
    }
    HeaderFetchCompleted();
      // this might be bogus, how are we going to do pane notification and stuff when we fetch bodies without
      // headers!
  }
  else if (entered_waitForBodyIdsMonitor) // need to exit this monitor if death signal received
    m_waitForBodyIdsMonitor.Exit();

  // wait for a list of bodies to fetch.
  if (GetServerStateParser().LastCommandSuccessful())
  {
    WaitForPotentialListOfBodysToFetch(&msgIdList, msgCount);
    if ( msgCount && GetServerStateParser().LastCommandSuccessful())
    {
      // Tell the url that it should store the msg fetch results offline,
      // while we're dumping the messages, and then restore the setting.
      bool wasStoringOffline;
      m_runningUrl->GetStoreResultsOffline(&wasStoringOffline);
      m_runningUrl->SetStoreResultsOffline(true);
      m_progressIndex = 0;
      m_progressCount = msgCount;
      FolderMsgDump(msgIdList, msgCount, kEveryThingRFC822Peek);
      m_runningUrl->SetStoreResultsOffline(wasStoringOffline);
    }
  }
  if (!GetServerStateParser().LastCommandSuccessful())
    GetServerStateParser().ResetFlagInfo();

  NS_IF_RELEASE(new_spec);
}

void nsImapProtocol::FolderHeaderDump(uint32_t *msgUids, uint32_t msgCount)
{
  FolderMsgDump(msgUids, msgCount, kHeadersRFC822andUid);
}

void nsImapProtocol::FolderMsgDump(uint32_t *msgUids, uint32_t msgCount, nsIMAPeFetchFields fields)
{
  // lets worry about this progress stuff later.
  switch (fields) {
  case kHeadersRFC822andUid:
    SetProgressString("imapReceivingMessageHeaders");
    break;
  case kFlags:
    SetProgressString("imapReceivingMessageFlags");
    break;
  default:
    SetProgressString("imapFolderReceivingMessageOf");
    break;
  }

  FolderMsgDumpLoop(msgUids, msgCount, fields);

  SetProgressString(nullptr);
}

void nsImapProtocol::WaitForPotentialListOfBodysToFetch(uint32_t **msgIdList, uint32_t &msgCount)
{
  PRIntervalTime sleepTime = kImapSleepTime;

  ReentrantMonitorAutoEnter fetchListMon(m_fetchBodyListMonitor);
  while(!m_fetchBodyListIsNew && !DeathSignalReceived())
    fetchListMon.Wait(sleepTime);
  m_fetchBodyListIsNew = false;

  *msgIdList = m_fetchBodyIdList;
  msgCount   = m_fetchBodyCount;
}

// libmsg uses this to notify a running imap url about message bodies it should download.
// why not just have libmsg explicitly download the message bodies?
NS_IMETHODIMP nsImapProtocol::NotifyBodysToDownload(uint32_t *keys, uint32_t keyCount)
{
  ReentrantMonitorAutoEnter fetchListMon(m_fetchBodyListMonitor);
  PR_FREEIF(m_fetchBodyIdList);
  m_fetchBodyIdList = (uint32_t *) PR_MALLOC(keyCount * sizeof(uint32_t));
  if (m_fetchBodyIdList)
    memcpy(m_fetchBodyIdList, keys, keyCount * sizeof(uint32_t));
  m_fetchBodyCount    = keyCount;
  m_fetchBodyListIsNew = true;
  fetchListMon.Notify();
  return NS_OK;
}

NS_IMETHODIMP nsImapProtocol::GetFlagsForUID(uint32_t uid, bool *foundIt, imapMessageFlagsType *resultFlags, char **customFlags)
{
  int32_t i;

  imapMessageFlagsType flags = m_flagState->GetMessageFlagsFromUID(uid, foundIt, &i);
  if (*foundIt)
  {
    *resultFlags = flags;
    if ((flags & kImapMsgCustomKeywordFlag) && customFlags)
      m_flagState->GetCustomFlags(uid, customFlags);
  }
  return NS_OK;
}

NS_IMETHODIMP nsImapProtocol::GetFlagAndUidState(nsIImapFlagAndUidState **aFlagState)
{
  NS_ENSURE_ARG_POINTER(aFlagState);
  NS_IF_ADDREF(*aFlagState = m_flagState);
  return NS_OK;
}

NS_IMETHODIMP nsImapProtocol::GetSupportedUserFlags(uint16_t *supportedFlags)
{
  if (!supportedFlags)
    return NS_ERROR_NULL_POINTER;

  *supportedFlags = m_flagState->GetSupportedUserFlags();
  return NS_OK;
}
void nsImapProtocol::FolderMsgDumpLoop(uint32_t *msgUids, uint32_t msgCount, nsIMAPeFetchFields fields)
{
  int32_t msgCountLeft = msgCount;
  uint32_t msgsDownloaded = 0;
  do
  {
    nsCString idString;
    uint32_t msgsToDownload = msgCountLeft;
    AllocateImapUidString(msgUids + msgsDownloaded, msgsToDownload, m_flagState, idString);  // 20 * 200
    FetchMessage(idString, fields);
    msgsDownloaded += msgsToDownload;
    msgCountLeft -= msgsToDownload;
  }
  while (msgCountLeft > 0 && !DeathSignalReceived());
}

void nsImapProtocol::HeaderFetchCompleted()
{
  if (m_imapMailFolderSink)
    m_imapMailFolderSink->ParseMsgHdrs(this, m_hdrDownloadCache);
  m_hdrDownloadCache->ReleaseAll();

  if (m_imapMailFolderSink)
    m_imapMailFolderSink->HeaderFetchCompleted(this);
}


// Use the noop to tell the server we are still here, and therefore we are willing to receive
// status updates. The recent or exists response from the server could tell us that there is
// more mail waiting for us, but we need to check the flags of the mail and the high water mark
// to make sure that we do not tell the user that there is new mail when perhaps they have
// already read it in another machine.

void nsImapProtocol::PeriodicBiff()
{

  nsMsgBiffState startingState = m_currentBiffState;

  if (GetServerStateParser().GetIMAPstate() == nsImapServerResponseParser::kFolderSelected)
  {
    Noop(); // check the latest number of messages
    int32_t numMessages = 0;
    m_flagState->GetNumberOfMessages(&numMessages);
    if (GetServerStateParser().NumberOfMessages() != numMessages)
    {
      uint32_t id = GetServerStateParser().HighestRecordedUID() + 1;
      nsCString fetchStr;           // only update flags
      uint32_t added = 0, deleted = 0;

      deleted = m_flagState->NumberOfDeletedMessages();
      added = numMessages;
      if (!added || (added == deleted)) // empty keys, get them all
        id = 1;

      //sprintf(fetchStr, "%ld:%ld", id, id + GetServerStateParser().NumberOfMessages() - fFlagState->GetNumberOfMessages());
      AppendUid(fetchStr, id);
      fetchStr.Append(":*");
      FetchMessage(fetchStr, kFlags);
      if (((uint32_t) m_flagState->GetHighestNonDeletedUID() >= id) && m_flagState->IsLastMessageUnseen())
        m_currentBiffState = nsIMsgFolder::nsMsgBiffState_NewMail;
      else
        m_currentBiffState = nsIMsgFolder::nsMsgBiffState_NoMail;
    }
    else
      m_currentBiffState = nsIMsgFolder::nsMsgBiffState_NoMail;
  }
  else
    m_currentBiffState = nsIMsgFolder::nsMsgBiffState_Unknown;

  if (startingState != m_currentBiffState)
    SendSetBiffIndicatorEvent(m_currentBiffState);
}

void nsImapProtocol::SendSetBiffIndicatorEvent(nsMsgBiffState newState)
{
    if (m_imapMailFolderSink)
      m_imapMailFolderSink->SetBiffStateAndUpdate(newState);
}

// We get called to see if there is mail waiting for us at the server, even if it may have been
// read elsewhere. We just want to know if we should download headers or not.

bool nsImapProtocol::CheckNewMail()
{
  return m_checkForNewMailDownloadsHeaders;
}

/* static */ void nsImapProtocol::LogImapUrl(const char *logMsg, nsIImapUrl *imapUrl)
{
  // nsImapProtocol is not always constructed before this static method is called
  if (!IMAP)
    IMAP = PR_NewLogModule("IMAP");

  if (PR_LOG_TEST(IMAP, PR_LOG_ALWAYS))
  {
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(imapUrl);
    if (mailnewsUrl)
    {
      nsAutoCString urlSpec, unescapedUrlSpec;
      mailnewsUrl->GetSpec(urlSpec);
      MsgUnescapeString(urlSpec, 0, unescapedUrlSpec);
      PR_LOG(IMAP, PR_LOG_ALWAYS, ("%s:%s", logMsg, unescapedUrlSpec.get()));
    }
  }
}

// log info including current state...
void nsImapProtocol::Log(const char *logSubName, const char *extraInfo, const char *logData)
{
  if (PR_LOG_TEST(IMAP, PR_LOG_ALWAYS))
  {
    static const char nonAuthStateName[] = "NA";
    static const char authStateName[] = "A";
    static const char selectedStateName[] = "S";
    const nsCString& hostName = GetImapHostName();  // initilize to empty string

    int32_t logDataLen = PL_strlen(logData); // PL_strlen checks for null
    nsCString logDataLines;
    const char *logDataToLog;
    int32_t lastLineEnd;

    const int kLogDataChunkSize = 400; // nspr line length is 512, and we
                                       // allow some space for the log preamble.

    // break up buffers > 400 bytes on line boundaries.
    if (logDataLen > kLogDataChunkSize)
    {
      logDataLines.Assign(logData);
      lastLineEnd = MsgRFindChar(logDataLines, '\n', kLogDataChunkSize);
      // null terminate the last line
      if (lastLineEnd == kNotFound)
        lastLineEnd = kLogDataChunkSize - 1;

      logDataLines.Insert( '\0', lastLineEnd + 1);
      logDataToLog = logDataLines.get();
    }
    else
    {
      logDataToLog = logData;
      lastLineEnd = logDataLen;
    }
    switch (GetServerStateParser().GetIMAPstate())
    {
    case nsImapServerResponseParser::kFolderSelected:
      if (extraInfo)
        PR_LOG(IMAP, PR_LOG_ALWAYS, ("%x:%s:%s-%s:%s:%s: %.400s", this, hostName.get(),
               selectedStateName, GetServerStateParser().GetSelectedMailboxName(),
               logSubName, extraInfo, logDataToLog));
      else
        PR_LOG(IMAP, PR_LOG_ALWAYS, ("%x:%s:%s-%s:%s: %.400s", this, hostName.get(),
               selectedStateName, GetServerStateParser().GetSelectedMailboxName(),
               logSubName, logDataToLog));
      break;
    case nsImapServerResponseParser::kNonAuthenticated:
    case nsImapServerResponseParser::kAuthenticated:
    {
      const char *stateName = (GetServerStateParser().GetIMAPstate() ==
                               nsImapServerResponseParser::kNonAuthenticated)
                               ? nonAuthStateName : authStateName;
      if (extraInfo)
        PR_LOG(IMAP, PR_LOG_ALWAYS, ("%x:%s:%s:%s:%s: %.400s", this,
               hostName.get(),stateName,logSubName,extraInfo,logDataToLog));
      else
        PR_LOG(IMAP, PR_LOG_ALWAYS, ("%x:%s:%s:%s: %.400s",this,
               hostName.get(),stateName,logSubName,logDataToLog));
    }
    }

    // dump the rest of the string in < 400 byte chunks
    while (logDataLen > kLogDataChunkSize)
    {
      logDataLines.Cut(0, lastLineEnd + 2); // + 2 to account for the LF and the '\0' we added
      logDataLen = logDataLines.Length();
      lastLineEnd = (logDataLen > kLogDataChunkSize) ? MsgRFindChar(logDataLines, '\n', kLogDataChunkSize) : kNotFound;
      // null terminate the last line
      if (lastLineEnd == kNotFound)
        lastLineEnd = kLogDataChunkSize - 1;
      logDataLines.Insert( '\0', lastLineEnd + 1);
      logDataToLog = logDataLines.get();
      PR_LOG(IMAP, PR_LOG_ALWAYS, ("%.400s", logDataToLog));
    }
  }
}

// In 4.5, this posted an event back to libmsg and blocked until it got a response.
// We may still have to do this.It would be nice if we could preflight this value,
// but we may not always know when we'll need it.
uint32_t nsImapProtocol::GetMessageSize(const char * messageId,
                                        bool idsAreUids)
{
  const char *folderFromParser = GetServerStateParser().GetSelectedMailboxName();
  if (folderFromParser && messageId)
  {
    char *id = (char *)PR_CALLOC(strlen(messageId) + 1);
    char *folderName;
    uint32_t size;

    PL_strcpy(id, messageId);

    nsIMAPNamespace *nsForMailbox = nullptr;
        m_hostSessionList->GetNamespaceForMailboxForHost(GetImapServerKey(), folderFromParser,
            nsForMailbox);


    if (nsForMailbox)
          m_runningUrl->AllocateCanonicalPath(
              folderFromParser, nsForMailbox->GetDelimiter(),
              &folderName);
    else
       m_runningUrl->AllocateCanonicalPath(
          folderFromParser,kOnlineHierarchySeparatorUnknown,
          &folderName);

    if (id && folderName)
    {
      if (m_imapMessageSink)
          m_imapMessageSink->GetMessageSizeFromDB(id, &size);
    }
    PR_FREEIF(id);
    PR_FREEIF(folderName);

    uint32_t rv = 0;
    if (!DeathSignalReceived())
      rv = size;
    return rv;
  }
  return 0;
}

// message id string utility functions
/* static */bool nsImapProtocol::HandlingMultipleMessages(const nsCString & messageIdString)
{
  return (MsgFindCharInSet(messageIdString, ",:") != kNotFound);
}

uint32_t nsImapProtocol::CountMessagesInIdString(const char *idString)
{
  uint32_t numberOfMessages = 0;
  char *uidString = PL_strdup(idString);

  if (uidString)
  {
    // This is in the form <id>,<id>, or <id1>:<id2>
    char curChar = *uidString;
    bool isRange = false;
    int32_t curToken;
    int32_t saveStartToken=0;

    for (char *curCharPtr = uidString; curChar && *curCharPtr;)
    {
      char *currentKeyToken = curCharPtr;
      curChar = *curCharPtr;
      while (curChar != ':' && curChar != ',' && curChar != '\0')
        curChar = *curCharPtr++;
      *(curCharPtr - 1) = '\0';
      curToken = atol(currentKeyToken);
      if (isRange)
      {
        while (saveStartToken < curToken)
        {
          numberOfMessages++;
          saveStartToken++;
        }
      }

      numberOfMessages++;
      isRange = (curChar == ':');
      if (isRange)
        saveStartToken = curToken + 1;
    }
    PR_Free(uidString);
  }
  return numberOfMessages;
}


// It would be really nice not to have to use this method nearly as much as we did
// in 4.5 - we need to think about this some. Some of it may just go away in the new world order
bool nsImapProtocol::DeathSignalReceived()
{
  // ignore mock channel status if we've been pseudo interrupted
  // ### need to make sure we clear pseudo interrupted status appropriately.
  if (!GetPseudoInterrupted() && m_mockChannel)
  {
    nsCOMPtr<nsIRequest> request = do_QueryInterface(m_mockChannel);
    if (request)
    {
      nsresult returnValue;
      request->GetStatus(&returnValue);
      if (NS_FAILED(returnValue))
        return false;
    }
  }

  // Check the other way of cancelling.
  ReentrantMonitorAutoEnter threadDeathMon(m_threadDeathMonitor);
  return m_threadShouldDie;
}

NS_IMETHODIMP nsImapProtocol::ResetToAuthenticatedState()
{
    GetServerStateParser().PreauthSetAuthenticatedState();
    return NS_OK;
}


NS_IMETHODIMP nsImapProtocol::GetSelectedMailboxName(char ** folderName)
{
    if (!folderName) return NS_ERROR_NULL_POINTER;
    if (GetServerStateParser().GetSelectedMailboxName())
        *folderName =
            PL_strdup((GetServerStateParser().GetSelectedMailboxName()));
    return NS_OK;
}

bool nsImapProtocol::GetPseudoInterrupted()
{
  ReentrantMonitorAutoEnter pseudoInterruptMon(m_pseudoInterruptMonitor);
  return m_pseudoInterrupted;
}

void nsImapProtocol::PseudoInterrupt(bool the_interrupt)
{
  ReentrantMonitorAutoEnter pseudoInterruptMon(m_pseudoInterruptMonitor);
  m_pseudoInterrupted = the_interrupt;
  if (the_interrupt)
    Log("CONTROL", NULL, "PSEUDO-Interrupted");
}

void  nsImapProtocol::SetActive(bool active)
{
  ReentrantMonitorAutoEnter dataMemberMon(m_dataMemberMonitor);
  m_active = active;
}

bool    nsImapProtocol::GetActive()
{
  ReentrantMonitorAutoEnter dataMemberMon(m_dataMemberMonitor);
  return m_active;
}

bool nsImapProtocol::GetShowAttachmentsInline()
{
  bool showAttachmentsInline = true;
  if (m_imapServerSink)
    m_imapServerSink->GetShowAttachmentsInline(&showAttachmentsInline);
  return showAttachmentsInline;

}

void nsImapProtocol::SetContentModified(IMAP_ContentModifiedType modified)
{
  if (m_runningUrl && m_imapMessageSink)
    m_imapMessageSink->SetContentModified(m_runningUrl, modified);
}


bool	nsImapProtocol::GetShouldFetchAllParts()
{
  if (m_runningUrl  && !DeathSignalReceived())
  {
    nsImapContentModifiedType contentModified;
    if (NS_SUCCEEDED(m_runningUrl->GetContentModified(&contentModified)))
      return (contentModified == IMAP_CONTENT_FORCE_CONTENT_NOT_MODIFIED);
  }
  return true;
}

// Adds a set of rights for a given user on a given mailbox on the current host.
// if userName is NULL, it means "me," or MYRIGHTS.
void nsImapProtocol::AddFolderRightsForUser(const char *mailboxName, const char *userName, const char *rights)
{
  if (!userName)
    userName = "";
  if (m_imapServerSink)
    m_imapServerSink->AddFolderRights(nsDependentCString(mailboxName), nsDependentCString(userName),
                                      nsDependentCString(rights));
}

void nsImapProtocol::SetCopyResponseUid(const char *msgIdString)
{
  if (m_imapMailFolderSink)
    m_imapMailFolderSink->SetCopyResponseUid(msgIdString, m_runningUrl);
}

void nsImapProtocol::CommitNamespacesForHostEvent()
{
    if (m_imapServerSink)
        m_imapServerSink->CommitNamespaces();
}

// notifies libmsg that we have new capability data for the current host
void nsImapProtocol::CommitCapability()
{
    if (m_imapServerSink)
    {
        m_imapServerSink->SetCapability(GetServerStateParser().GetCapabilityFlag());
    }
}

// rights is a single string of rights, as specified by RFC2086, the IMAP ACL extension.
// Clears all rights for a given folder, for all users.
void nsImapProtocol::ClearAllFolderRights()
{
  if (m_imapMailFolderSink)
    m_imapMailFolderSink->ClearFolderRights();
}


char* nsImapProtocol::CreateNewLineFromSocket()
{
  bool needMoreData = false;
  char * newLine = nullptr;
  uint32_t numBytesInLine = 0;
  nsresult rv = NS_OK;
  // we hold a ref to the input stream in case we get cancelled from the
  // ui thread, which releases our ref to the input stream, and can
  // cause the pipe to get deleted before the monitor the read is
  // blocked on gets notified. When that happens, the imap thread
  // will stay blocked.
  nsCOMPtr <nsIInputStream> kungFuGrip = m_inputStream;
  do
  {
    newLine = m_inputStreamBuffer->ReadNextLine(m_inputStream, numBytesInLine, needMoreData, &rv);
    PR_LOG(IMAP, PR_LOG_DEBUG, ("ReadNextLine [stream=%x nb=%u needmore=%u]\n",
        m_inputStream.get(), numBytesInLine, needMoreData));

  } while (!newLine && NS_SUCCEEDED(rv) && !DeathSignalReceived()); // until we get the next line and haven't been interrupted

  kungFuGrip = nullptr;

  if (NS_FAILED(rv))
  {
    switch (rv)
    {
        case NS_ERROR_UNKNOWN_HOST:
        case NS_ERROR_UNKNOWN_PROXY_HOST:
            AlertUserEventUsingName("imapUnknownHostError");
            break;
        case NS_ERROR_CONNECTION_REFUSED:
        case NS_ERROR_PROXY_CONNECTION_REFUSED:
            AlertUserEventUsingName("imapConnectionRefusedError");
            break;
        case NS_ERROR_NET_TIMEOUT:
        case NS_ERROR_NET_RESET:
        case NS_BASE_STREAM_CLOSED:
        case NS_ERROR_NET_INTERRUPT:
          // we should retry on RESET, especially for SSL...
          if ((TestFlag(IMAP_RECEIVED_GREETING) || rv == NS_ERROR_NET_RESET) &&
              m_runningUrl && !m_retryUrlOnError)
          {
            bool rerunningUrl;
            nsImapAction imapAction;
            m_runningUrl->GetRerunningUrl(&rerunningUrl);
            m_runningUrl->GetImapAction(&imapAction);
            // don't rerun if we already were rerunning. And don't rerun
            // online move/copies that timeout.
            if (!rerunningUrl && (rv != NS_ERROR_NET_TIMEOUT ||
                                 (imapAction != nsIImapUrl::nsImapOnlineCopy &&
                                  imapAction != nsIImapUrl::nsImapOnlineMove)))
            {
              m_runningUrl->SetRerunningUrl(true);
              m_retryUrlOnError = true;
              break;
            }
          }
          if (rv == NS_ERROR_NET_TIMEOUT)
            AlertUserEventUsingName("imapNetTimeoutError");
          else
            AlertUserEventUsingName(TestFlag(IMAP_RECEIVED_GREETING) ?
                                    "imapServerDisconnected" :
                                    "imapServerDroppedConnection");
          break;
        default:
            break;
    }

    nsAutoCString logMsg("clearing IMAP_CONNECTION_IS_OPEN - rv = ");
    logMsg.AppendInt(static_cast<uint32_t>(rv), 16);
    Log("CreateNewLineFromSocket", nullptr, logMsg.get());
    ClearFlag(IMAP_CONNECTION_IS_OPEN);
    TellThreadToDie();
  }
  Log("CreateNewLineFromSocket", nullptr, newLine);
  SetConnectionStatus(newLine && numBytesInLine ? NS_OK : rv); // set > 0 if string is not null or empty
  return newLine;
}

nsresult
nsImapProtocol::GetConnectionStatus()
{
  return m_connectionStatus;
}

void
nsImapProtocol::SetConnectionStatus(nsresult status)
{
  m_connectionStatus = status;
}

void
nsImapProtocol::NotifyMessageFlags(imapMessageFlagsType flags,
                                   const nsACString &keywords,
                                   nsMsgKey key, uint64_t highestModSeq)
{
    if (m_imapMessageSink)
    {
      // if we're selecting the folder, don't need to report the flags; we've already fetched them.
      if (m_imapAction != nsIImapUrl::nsImapSelectFolder &&
          (m_imapAction != nsIImapUrl::nsImapMsgFetch ||
          (flags & ~kImapMsgRecentFlag) != kImapMsgSeenFlag))
        m_imapMessageSink->NotifyMessageFlags(flags, keywords, key, highestModSeq);
    }
}

void
nsImapProtocol::NotifySearchHit(const char * hitLine)
{
    nsresult rv;
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningUrl, &rv);
    if (m_imapMailFolderSink)
        m_imapMailFolderSink->NotifySearchHit(mailnewsUrl, hitLine);
}

void nsImapProtocol::SetMailboxDiscoveryStatus(EMailboxDiscoverStatus status)
{
  ReentrantMonitorAutoEnter mon(m_dataMemberMonitor);
  m_discoveryStatus = status;
}

EMailboxDiscoverStatus nsImapProtocol::GetMailboxDiscoveryStatus( )
{
  ReentrantMonitorAutoEnter mon(m_dataMemberMonitor);
  return m_discoveryStatus;
}

bool
nsImapProtocol::GetSubscribingNow()
{
    // ***** code me *****
    return false;// ***** for now
}

void
nsImapProtocol::DiscoverMailboxSpec(nsImapMailboxSpec * adoptedBoxSpec)
{
  nsIMAPNamespace *ns = nullptr;

  NS_ASSERTION (m_hostSessionList, "fatal null host session list");
  if (!m_hostSessionList)
    return;

  m_hostSessionList->GetDefaultNamespaceOfTypeForHost(
    GetImapServerKey(), kPersonalNamespace, ns);
  const char *nsPrefix = ns ? ns->GetPrefix() : 0;

  if (m_specialXListMailboxes.Count() > 0)
  {
    int32_t hashValue = 0;
    nsCString strHashKey(adoptedBoxSpec->mAllocatedPathName);
    m_specialXListMailboxes.Get(strHashKey, &hashValue);
    adoptedBoxSpec->mBoxFlags |= hashValue;
  }

  switch (m_hierarchyNameState)
  {
  case kXListing:
    if (adoptedBoxSpec->mBoxFlags &
        (kImapXListTrash|kImapAllMail|kImapInbox|kImapSent|kImapSpam|kImapDrafts))
    {
      nsCString mailboxName(adoptedBoxSpec->mAllocatedPathName);
      m_specialXListMailboxes.Put(mailboxName, adoptedBoxSpec->mBoxFlags);
      // Remember hierarchy delimiter in case this is the first time we've
      // connected to the server and we need it to be correct for the two-level
      // XLIST we send (INBOX is guaranteed to be in the first response).
      if (adoptedBoxSpec->mBoxFlags & kImapInbox)
        m_runningUrl->SetOnlineSubDirSeparator(adoptedBoxSpec->mHierarchySeparator);

    }
    NS_IF_RELEASE(adoptedBoxSpec);
    break;
  case kListingForFolderFlags:
    {
      // store mailbox flags from LIST for use by LSUB
      nsCString mailboxName(adoptedBoxSpec->mAllocatedPathName);
      m_standardListMailboxes.Put(mailboxName, adoptedBoxSpec->mBoxFlags);
    }
    NS_IF_RELEASE(adoptedBoxSpec);
    break;
  case kListingForCreate:
  case kNoOperationInProgress:
  case kDiscoverTrashFolderInProgress:
  case kListingForInfoAndDiscovery:
    {
      // standard mailbox specs are stored in m_standardListMailboxes
      // because LSUB does necessarily return all mailbox flags.
      // count should be > 0 only when we are looking at response of LSUB
      if (m_standardListMailboxes.Count() > 0)
      {
        int32_t hashValue = 0;
        nsCString strHashKey(adoptedBoxSpec->mAllocatedPathName);
        if (m_standardListMailboxes.Get(strHashKey, &hashValue))
          adoptedBoxSpec->mBoxFlags |= hashValue;
        else
          // if mailbox is not in hash list, then it is subscribed but does not
          // exist, so we make sure it can't be selected
          adoptedBoxSpec->mBoxFlags |= kNoselect;
      }
      if (ns && nsPrefix) // if no personal namespace, there can be no Trash folder
      {
        bool onlineTrashFolderExists = false;
        if (m_hostSessionList)
        {
          if (adoptedBoxSpec->mBoxFlags & (kImapTrash|kImapXListTrash))
          {
             m_hostSessionList->SetOnlineTrashFolderExistsForHost(GetImapServerKey(), true);
             onlineTrashFolderExists = true;
          }
          else
          {
            m_hostSessionList->GetOnlineTrashFolderExistsForHost(
                                  GetImapServerKey(), onlineTrashFolderExists);
          }
        }

        // Don't set the Trash flag if not using the Trash model
        if (GetDeleteIsMoveToTrash() && !onlineTrashFolderExists &&
            adoptedBoxSpec->mAllocatedPathName.Find(m_trashFolderName, CaseInsensitiveCompare) != -1)
        {
          bool trashExists = false;
          nsCString trashMatch(CreatePossibleTrashName(nsPrefix));
          nsCString serverTrashName;
          m_runningUrl->AllocateCanonicalPath(trashMatch.get(),
                                              ns->GetDelimiter(),
                                              getter_Copies(serverTrashName));
          if (StringBeginsWith(serverTrashName,
                               NS_LITERAL_CSTRING("INBOX/"),
                               nsCaseInsensitiveCStringComparator()))
          {
            nsAutoCString pathName(adoptedBoxSpec->mAllocatedPathName.get() + 6);
            trashExists =
              StringBeginsWith(adoptedBoxSpec->mAllocatedPathName,
                               serverTrashName,
                               nsCaseInsensitiveCStringComparator()) && /* "INBOX/" */
              pathName.Equals(Substring(serverTrashName, 6), nsCaseInsensitiveCStringComparator());
          }
          else
            trashExists = adoptedBoxSpec->mAllocatedPathName.Equals(serverTrashName, nsCaseInsensitiveCStringComparator());

          if (m_hostSessionList)
            m_hostSessionList->SetOnlineTrashFolderExistsForHost(GetImapServerKey(), trashExists);

          if (trashExists)
            adoptedBoxSpec->mBoxFlags |= kImapTrash;
        }
      }

      // Discover the folder (shuttle over to libmsg, yay)
      // Do this only if the folder name is not empty (i.e. the root)
      if (!adoptedBoxSpec->mAllocatedPathName.IsEmpty())
      {
        if (m_hierarchyNameState == kListingForCreate)
          adoptedBoxSpec->mBoxFlags |= kNewlyCreatedFolder;

        if (m_imapServerSink)
        {
          bool newFolder;

          m_imapServerSink->PossibleImapMailbox(adoptedBoxSpec->mAllocatedPathName,
                                                adoptedBoxSpec->mHierarchySeparator,
                                                adoptedBoxSpec->mBoxFlags, &newFolder);
          // if it's a new folder to the server sink, setting discovery status to
          // eContinueNew will cause us to get the ACL for the new folder.
          if (newFolder)
            SetMailboxDiscoveryStatus(eContinueNew);

          bool useSubscription = false;

          if (m_hostSessionList)
            m_hostSessionList->GetHostIsUsingSubscription(GetImapServerKey(),
                                                          useSubscription);

          if ((GetMailboxDiscoveryStatus() != eContinue) &&
              (GetMailboxDiscoveryStatus() != eContinueNew) &&
              (GetMailboxDiscoveryStatus() != eListMyChildren))
          {
            SetConnectionStatus(NS_ERROR_FAILURE);
          }
          else if (!adoptedBoxSpec->mAllocatedPathName.IsEmpty() &&
                   (GetMailboxDiscoveryStatus() == eListMyChildren) &&
                   (!useSubscription || GetSubscribingNow()))
          {
            NS_ASSERTION (false,
              "we should never get here anymore");
            SetMailboxDiscoveryStatus(eContinue);
          }
          else if (GetMailboxDiscoveryStatus() == eContinueNew)
          {
            if (m_hierarchyNameState == kListingForInfoAndDiscovery &&
                !adoptedBoxSpec->mAllocatedPathName.IsEmpty() &&
                !(adoptedBoxSpec->mBoxFlags & kNameSpace))
            {
              // remember the info here also
              nsIMAPMailboxInfo *mb = new nsIMAPMailboxInfo(adoptedBoxSpec->mAllocatedPathName, adoptedBoxSpec->mHierarchySeparator);
              m_listedMailboxList.AppendElement((void*) mb);
            }
            SetMailboxDiscoveryStatus(eContinue);
          }
        }
      }
      }
      NS_IF_RELEASE( adoptedBoxSpec);
      break;
    case kDiscoverBaseFolderInProgress:
      break;
    case kDeleteSubFoldersInProgress:
      {
        NS_ASSERTION(m_deletableChildren, "Oops .. null m_deletableChildren\n");
        m_deletableChildren->AppendElement((void *)ToNewCString(adoptedBoxSpec->mAllocatedPathName));
        NS_IF_RELEASE(adoptedBoxSpec);
      }
      break;
    case kListingForInfoOnly:
      {
        //UpdateProgressWindowForUpgrade(adoptedBoxSpec->allocatedPathName);
        ProgressEventFunctionUsingNameWithString("imapDiscoveringMailbox",
          adoptedBoxSpec->mAllocatedPathName.get());
        nsIMAPMailboxInfo *mb = new nsIMAPMailboxInfo(adoptedBoxSpec->mAllocatedPathName,
                                                      adoptedBoxSpec->mHierarchySeparator);
        m_listedMailboxList.AppendElement((void*) mb);
        NS_IF_RELEASE(adoptedBoxSpec);
      }
      break;
    case kDiscoveringNamespacesOnly:
      {
        NS_IF_RELEASE(adoptedBoxSpec);
      }
      break;
    default:
      NS_ASSERTION (false, "we aren't supposed to be here");
      break;
  }
}

void
nsImapProtocol::AlertUserEventUsingName(const char* aMessageName)
{
  if (m_imapServerSink)
  {
    bool suppressErrorMsg = false;

    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningUrl);
    if (mailnewsUrl)
      mailnewsUrl->GetSuppressErrorMsgs(&suppressErrorMsg);

    if (!suppressErrorMsg)
      m_imapServerSink->FEAlertWithName(aMessageName,
                                        mailnewsUrl);
  }
}

void
nsImapProtocol::AlertUserEvent(const char * message)
{
  if (m_imapServerSink)
  {
    bool suppressErrorMsg = false;

    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningUrl);
    if (mailnewsUrl)
      mailnewsUrl->GetSuppressErrorMsgs(&suppressErrorMsg);

    if (!suppressErrorMsg)
      m_imapServerSink->FEAlert(NS_ConvertASCIItoUTF16(message), mailnewsUrl);
  }
}

void
nsImapProtocol::AlertUserEventFromServer(const char * aServerEvent)
{
    if (m_imapServerSink && aServerEvent)
    {
      nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningUrl);
      m_imapServerSink->FEAlertFromServer(nsDependentCString(aServerEvent),
                                          mailnewsUrl);
    }
}

void nsImapProtocol::ResetProgressInfo()
{
  m_lastProgressTime = 0;
  m_lastPercent = -1;
  m_lastProgressStringName.Truncate();
}

void nsImapProtocol::SetProgressString(const char * stringName)
{
  m_progressStringName.Assign(stringName);
  if (!m_progressStringName.IsEmpty() && m_imapServerSink)
    m_imapServerSink->GetImapStringByName(stringName,
                                          m_progressString);
}

void
nsImapProtocol::ShowProgress()
{
  if (!m_progressString.IsEmpty() && !m_progressStringName.IsEmpty())
  {
    PRUnichar *progressString = NULL;
    const char *mailboxName = GetServerStateParser().GetSelectedMailboxName();
    nsString unicodeMailboxName;
    nsresult rv = CopyMUTF7toUTF16(nsDependentCString(mailboxName),
                                   unicodeMailboxName);
    if (NS_SUCCEEDED(rv))
    {
      // ### should convert mailboxName to PRUnichar and change %s to %S in msg text
      progressString = nsTextFormatter::smprintf(m_progressString.get(),
                                unicodeMailboxName.get(), ++m_progressIndex, m_progressCount);
      if (progressString)
      {
        PercentProgressUpdateEvent(progressString, m_progressIndex, m_progressCount);
        nsTextFormatter::smprintf_free(progressString);
      }
    }
  }
}

void
nsImapProtocol::ProgressEventFunctionUsingName(const char* aMsgName)
{
  if (m_imapMailFolderSink && !m_lastProgressStringName.Equals(aMsgName))
  {
    m_imapMailFolderSink->ProgressStatusString(this, aMsgName, nullptr);
    m_lastProgressStringName.Assign(aMsgName);
    // who's going to free this? Does ProgressStatusString complete synchronously?
  }
}

void
nsImapProtocol::ProgressEventFunctionUsingNameWithString(const char* aMsgName,
                                                         const char * aExtraInfo)
{
  if (m_imapMailFolderSink)
  {
    nsString unicodeStr;
    nsresult rv = CopyMUTF7toUTF16(nsDependentCString(aExtraInfo), unicodeStr);
    if (NS_SUCCEEDED(rv))
      m_imapMailFolderSink->ProgressStatusString(this, aMsgName, unicodeStr.get());
  }
}

void
nsImapProtocol::PercentProgressUpdateEvent(PRUnichar *message, int64_t currentProgress, int64_t maxProgress)
{
  int64_t nowMS = 0;
  int32_t percent = (100 * currentProgress) / maxProgress;
  if (percent == m_lastPercent)
    return; // hasn't changed, right? So just return. Do we need to clear this anywhere?

  if (percent < 100)  // always need to do 100%
  {
    nowMS = PR_IntervalToMilliseconds(PR_IntervalNow());
    if (nowMS - m_lastProgressTime < 750)
      return;
  }

  m_lastPercent = percent;
  m_lastProgressTime = nowMS;

  // set our max progress on the running URL
  if (m_runningUrl)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl(do_QueryInterface(m_runningUrl));
    mailnewsUrl->SetMaxProgress(maxProgress);
  }

  if (m_imapMailFolderSink)
    m_imapMailFolderSink->PercentProgress(this, message, currentProgress, maxProgress);
}

  // imap commands issued by the parser
void
nsImapProtocol::Store(const nsCString &messageList, const char * messageData,
                      bool idsAreUid)
{

  // turn messageList back into key array and then back into a message id list,
  // but use the flag state to handle ranges correctly.
  nsCString messageIdList;
  nsTArray<nsMsgKey> msgKeys;
  if (idsAreUid)
    ParseUidString(messageList.get(), msgKeys);

  int32_t msgCountLeft = msgKeys.Length();
  uint32_t msgsHandled = 0;
  do
  {
    nsCString idString;

    uint32_t msgsToHandle = msgCountLeft;
    if (idsAreUid)
      AllocateImapUidString(msgKeys.Elements() + msgsHandled, msgsToHandle, m_flagState, idString);  // 20 * 200
    else
      idString.Assign(messageList);


    msgsHandled += msgsToHandle;
    msgCountLeft -= msgsToHandle;

    IncrementCommandTagNumber();
    const char *formatString;
    if (idsAreUid)
        formatString = "%s uid store %s %s\015\012";
    else
        formatString = "%s store %s %s\015\012";

    // we might need to close this mailbox after this
    m_closeNeededBeforeSelect = GetDeleteIsMoveToTrash() &&
        (PL_strcasestr(messageData, "\\Deleted"));

    const char *commandTag = GetServerCommandTag();
    int protocolStringSize = PL_strlen(formatString) +
          messageList.Length() + PL_strlen(messageData) +
          PL_strlen(commandTag) + 1;
    char *protocolString = (char *) PR_CALLOC( protocolStringSize );

    if (protocolString)
    {
      PR_snprintf(protocolString, // string to create
                    protocolStringSize, // max size
                    formatString, // format string
                    commandTag, // command tag
                    idString.get(),
                    messageData);

      nsresult rv = SendData(protocolString);
      if (NS_SUCCEEDED(rv))
      {
        m_flagChangeCount++;
        ParseIMAPandCheckForNewMail(protocolString);
        if (GetServerStateParser().LastCommandSuccessful() && CheckNeeded())
          Check();
      }
      PR_Free(protocolString);
    }
    else
      HandleMemoryFailure();
  }
  while (msgCountLeft > 0 && !DeathSignalReceived());

}

void
nsImapProtocol::IssueUserDefinedMsgCommand(const char *command, const char * messageList)
{
  IncrementCommandTagNumber();

  const char *formatString;
  formatString = "%s uid %s %s\015\012";

  const char *commandTag = GetServerCommandTag();
  int protocolStringSize = PL_strlen(formatString) +
        PL_strlen(messageList) + PL_strlen(command) +
        PL_strlen(commandTag) + 1;
  char *protocolString = (char *) PR_CALLOC( protocolStringSize );

  if (protocolString)
  {
    PR_snprintf(protocolString, // string to create
                  protocolStringSize, // max size
                  formatString, // format string
                  commandTag, // command tag
                  command,
                  messageList);

    nsresult rv = SendData(protocolString);
    if (NS_SUCCEEDED(rv))
      ParseIMAPandCheckForNewMail(protocolString);
    PR_Free(protocolString);
  }
  else
    HandleMemoryFailure();
}

void
nsImapProtocol::UidExpunge(const nsCString &messageSet)
{
    IncrementCommandTagNumber();
    nsCString command(GetServerCommandTag());
    command.Append(" uid expunge ");
    command.Append(messageSet);
    command.Append(CRLF);
    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
}

void
nsImapProtocol::Expunge()
{
  uint32_t aclFlags = 0;
  if (GetServerStateParser().ServerHasACLCapability() && m_imapMailFolderSink)
    m_imapMailFolderSink->GetAclFlags(&aclFlags);

  if (aclFlags && !(aclFlags & IMAP_ACL_EXPUNGE_FLAG))
    return;
  ProgressEventFunctionUsingName("imapStatusExpungingMailbox");

  if(gCheckDeletedBeforeExpunge)
  {
    GetServerStateParser().ResetSearchResultSequence();
    Search("SEARCH DELETED", false, false);
    if (GetServerStateParser().LastCommandSuccessful())
    {
      nsImapSearchResultIterator *search = GetServerStateParser().CreateSearchResultIterator();
      nsMsgKey key = search->GetNextMessageNumber();
      delete search;
      if (key == 0)
        return;  //no deleted messages to expunge (bug 235004)
    }
  }

  IncrementCommandTagNumber();
  nsAutoCString command(GetServerCommandTag());
  command.Append(" expunge" CRLF);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail();
}

void
nsImapProtocol::HandleMemoryFailure()
{
    PR_CEnterMonitor(this);
    // **** jefft fix me!!!!!! ******
    // m_imapThreadIsRunning = false;
    // SetConnectionStatus(-1);
    PR_CExitMonitor(this);
}

void nsImapProtocol::HandleCurrentUrlError()
{
  // This is to handle a move/copy failing, especially because the user
  // cancelled the password prompt.
  (void) m_runningUrl->GetImapAction(&m_imapAction);
    if (m_imapAction == nsIImapUrl::nsImapOfflineToOnlineMove || m_imapAction == nsIImapUrl::nsImapAppendMsgFromFile
      || m_imapAction == nsIImapUrl::nsImapAppendDraftFromFile)
  {
    if (m_imapMailFolderSink)
      m_imapMailFolderSink->OnlineCopyCompleted(this, ImapOnlineCopyStateType::kFailedCopy);
  }
}

void nsImapProtocol::StartTLS()
{
    IncrementCommandTagNumber();
    nsCString command(GetServerCommandTag());

    command.Append(" STARTTLS" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::Capability()
{

    ProgressEventFunctionUsingName("imapStatusCheckCompat");
    IncrementCommandTagNumber();
    nsCString command(GetServerCommandTag());

    command.Append(" capability" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
    if (!gUseLiteralPlus)
    {
      eIMAPCapabilityFlags capabilityFlag = GetServerStateParser().GetCapabilityFlag();
      if (capabilityFlag & kLiteralPlusCapability)
      {
        GetServerStateParser().SetCapabilityFlag(capabilityFlag & ~kLiteralPlusCapability);
      }
    }
}

void nsImapProtocol::ID()
{
  if (!gAppName[0])
    return;
  IncrementCommandTagNumber();
  nsCString command(GetServerCommandTag());
  command.Append(" ID (\"name\" \"");
  command.Append(gAppName);
  command.Append("\" \"version\" \"");
  command.Append(gAppVersion);
  command.Append("\")" CRLF);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::EnableCondStore()
{
  IncrementCommandTagNumber();
  nsCString command(GetServerCommandTag());

  command.Append(" ENABLE CONDSTORE" CRLF);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::StartCompressDeflate()
{
  // only issue a compression request if we haven't already
  if (!TestFlag(IMAP_ISSUED_COMPRESS_REQUEST))
  {
    SetFlag(IMAP_ISSUED_COMPRESS_REQUEST);
    IncrementCommandTagNumber();
    nsCString command(GetServerCommandTag());

    command.Append(" COMPRESS DEFLATE" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
    {
      ParseIMAPandCheckForNewMail();
      if (GetServerStateParser().LastCommandSuccessful())
      {
        rv = BeginCompressing();
        if (NS_FAILED(rv))
        {
          Log("CompressDeflate", nullptr, "failed to enable compression");
          // we can't use this connection without compression any more, so die
          ClearFlag(IMAP_CONNECTION_IS_OPEN);
          TellThreadToDie();
          SetConnectionStatus(rv);
          return;
        }
      }
    }
  }
}

nsresult nsImapProtocol::BeginCompressing()
{
  // wrap the streams in compression layers that compress or decompress
  // all traffic.
  nsRefPtr<nsMsgCompressIStream> new_in = new nsMsgCompressIStream();
  if (!new_in)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = new_in->InitInputStream(m_inputStream);
  NS_ENSURE_SUCCESS(rv, rv);

  m_inputStream = new_in;

  nsRefPtr<nsMsgCompressOStream> new_out = new nsMsgCompressOStream();
  if (!new_out)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = new_out->InitOutputStream(m_outputStream);
  NS_ENSURE_SUCCESS(rv, rv);

  m_outputStream = new_out;
  return rv;
}

void nsImapProtocol::Language()
{
  // only issue the language request if we haven't done so already...
  if (!TestFlag(IMAP_ISSUED_LANGUAGE_REQUEST))
  {
    SetFlag(IMAP_ISSUED_LANGUAGE_REQUEST);
    ProgressEventFunctionUsingName("imapStatusCheckCompat");
    IncrementCommandTagNumber();
    nsCString command(GetServerCommandTag());

    // extract the desired language attribute from prefs
    nsresult rv = NS_OK;

    // we need to parse out the first language out of this comma separated list....
    // i.e if we have en,ja we only want to send en to the server.
    if (mAcceptLanguages.get())
    {
      nsAutoCString extractedLanguage;
      LossyCopyUTF16toASCII(mAcceptLanguages, extractedLanguage);
      int32_t pos = extractedLanguage.FindChar(',');
      if (pos > 0) // we have a comma separated list of languages...
        extractedLanguage.SetLength(pos); // truncate everything after the first comma (including the comma)

      if (extractedLanguage.IsEmpty())
        return;

      command.Append(" LANGUAGE ");
      command.Append(extractedLanguage);
      command.Append(CRLF);

      rv = SendData(command.get());
      if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail(nullptr, true /* ignore bad or no result from the server for this command */);
    }
  }
}

void nsImapProtocol::EscapeUserNamePasswordString(const char *strToEscape, nsCString *resultStr)
{
  if (strToEscape)
  {
    uint32_t i = 0;
    uint32_t escapeStrlen = strlen(strToEscape);
    for (i=0; i<escapeStrlen; i++)
    {
        if (strToEscape[i] == '\\' || strToEscape[i] == '\"')
        {
            resultStr->Append('\\');
        }
        resultStr->Append(strToEscape[i]);
    }
  }
}

void nsImapProtocol::InitPrefAuthMethods(int32_t authMethodPrefValue)
{
    // for m_prefAuthMethods, using the same flags as server capablities.
    switch (authMethodPrefValue)
    {
      case nsMsgAuthMethod::none:
        m_prefAuthMethods = kHasAuthNoneCapability;
        break;
      case nsMsgAuthMethod::old:
        m_prefAuthMethods = kHasAuthOldLoginCapability;
        break;
      case nsMsgAuthMethod::passwordCleartext:
        m_prefAuthMethods = kHasAuthOldLoginCapability |
            kHasAuthLoginCapability | kHasAuthPlainCapability;
        break;
      case nsMsgAuthMethod::passwordEncrypted:
        m_prefAuthMethods = kHasCRAMCapability;
        break;
      case nsMsgAuthMethod::NTLM:
        m_prefAuthMethods = kHasAuthNTLMCapability | kHasAuthMSNCapability;
        break;
      case nsMsgAuthMethod::GSSAPI:
        m_prefAuthMethods = kHasAuthGssApiCapability;
        break;
      case nsMsgAuthMethod::External:
        m_prefAuthMethods = kHasAuthExternalCapability;
        break;
      case nsMsgAuthMethod::secure:
        m_prefAuthMethods = kHasCRAMCapability |
            kHasAuthGssApiCapability |
            kHasAuthNTLMCapability | kHasAuthMSNCapability;
        break;
      default:
        NS_ASSERTION(false, "IMAP: authMethod pref invalid");
        // TODO log to error console
        PR_LOG(IMAP, PR_LOG_ERROR,
            ("IMAP: bad pref authMethod = %d\n", authMethodPrefValue));
        // fall to any
      case nsMsgAuthMethod::anything:
        m_prefAuthMethods = kHasAuthOldLoginCapability |
            kHasAuthLoginCapability | kHasAuthPlainCapability |
            kHasCRAMCapability | kHasAuthGssApiCapability |
            kHasAuthNTLMCapability | kHasAuthMSNCapability |
            kHasAuthExternalCapability;
        break;
    }
    NS_ASSERTION(m_prefAuthMethods != kCapabilityUndefined,
         "IMAP: InitPrefAuthMethods() didn't work");
}

/**
 * Changes m_currentAuthMethod to pick the best remaining one
 * which is allowed by server and prefs and not marked failed.
 * The order of preference and trying of auth methods is encoded here.
 */
nsresult nsImapProtocol::ChooseAuthMethod()
{
  eIMAPCapabilityFlags serverCaps = GetServerStateParser().GetCapabilityFlag();
  eIMAPCapabilityFlags availCaps = serverCaps & m_prefAuthMethods & ~m_failedAuthMethods;

  PR_LOG(IMAP, PR_LOG_DEBUG, ("IMAP auth: server caps 0x%X, pref 0x%X, failed 0x%X, avail caps 0x%X",
        serverCaps, m_prefAuthMethods, m_failedAuthMethods, availCaps));
  PR_LOG(IMAP, PR_LOG_DEBUG, ("(GSSAPI = 0x%X, CRAM = 0x%X, NTLM = 0x%X, "
        "MSN =  0x%X, PLAIN = 0x%X, LOGIN = 0x%X, old-style IMAP login = 0x%X)"
        "auth external IMAP login = 0x%X",
        kHasAuthGssApiCapability, kHasCRAMCapability, kHasAuthNTLMCapability,
        kHasAuthMSNCapability, kHasAuthPlainCapability, kHasAuthLoginCapability,
        kHasAuthOldLoginCapability, kHasAuthExternalCapability));

  if (kHasAuthExternalCapability & availCaps)
    m_currentAuthMethod = kHasAuthExternalCapability;
  else if (kHasAuthGssApiCapability & availCaps)
    m_currentAuthMethod = kHasAuthGssApiCapability;
  else if (kHasCRAMCapability & availCaps)
    m_currentAuthMethod = kHasCRAMCapability;
  else if (kHasAuthNTLMCapability & availCaps)
    m_currentAuthMethod = kHasAuthNTLMCapability;
  else if (kHasAuthMSNCapability & availCaps)
    m_currentAuthMethod = kHasAuthMSNCapability;
  else if (kHasAuthPlainCapability & availCaps)
    m_currentAuthMethod = kHasAuthPlainCapability;
  else if (kHasAuthLoginCapability & availCaps)
    m_currentAuthMethod = kHasAuthLoginCapability;
  else if (kHasAuthOldLoginCapability & availCaps)
    m_currentAuthMethod = kHasAuthOldLoginCapability;
  else
  {
    PR_LOG(IMAP, PR_LOG_DEBUG, ("no remaining auth method"));
    m_currentAuthMethod = kCapabilityUndefined;
    return NS_ERROR_FAILURE;
  }
  PR_LOG(IMAP, PR_LOG_DEBUG, ("trying auth method 0x%X", m_currentAuthMethod));
  return NS_OK;
}

void nsImapProtocol::MarkAuthMethodAsFailed(eIMAPCapabilityFlags failedAuthMethod)
{
  PR_LOG(IMAP, PR_LOG_DEBUG, ("marking auth method 0x%X failed", failedAuthMethod));
  m_failedAuthMethods |= failedAuthMethod;
}

/**
 * Start over, trying all auth methods again
 */
void nsImapProtocol::ResetAuthMethods()
{
  PR_LOG(IMAP, PR_LOG_DEBUG, ("resetting (failed) auth methods"));
  m_currentAuthMethod = kCapabilityUndefined;
  m_failedAuthMethods = 0;
}

nsresult nsImapProtocol::AuthLogin(const char *userName, const nsCString &password, eIMAPCapabilityFlag flag)
{
  ProgressEventFunctionUsingName("imapStatusSendingAuthLogin");
  IncrementCommandTagNumber();

  char * currentCommand=nullptr;
  nsresult rv;

  PR_LOG(IMAP, PR_LOG_DEBUG, ("IMAP: trying auth method 0x%X", m_currentAuthMethod));

  if (flag & kHasAuthExternalCapability)
  {
      char *base64UserName = PL_Base64Encode(userName, strlen(userName), nullptr);
      nsAutoCString command (GetServerCommandTag());
      command.Append(" authenticate EXTERNAL " );
      command.Append(base64UserName);
      command.Append(CRLF);
	  PR_Free(base64UserName);
      rv = SendData(command.get());
      ParseIMAPandCheckForNewMail();
      nsImapServerResponseParser &parser = GetServerStateParser();
      if (parser.LastCommandSuccessful())
        return NS_OK;
      parser.SetCapabilityFlag(parser.GetCapabilityFlag() & ~kHasAuthExternalCapability);
  }
  else if (flag & kHasCRAMCapability)
  {
    NS_ENSURE_TRUE(m_imapServerSink, NS_ERROR_NULL_POINTER);
    PR_LOG(IMAP, PR_LOG_DEBUG, ("MD5 auth"));
    // inform the server that we want to begin a CRAM authentication procedure...
    nsAutoCString command (GetServerCommandTag());
    command.Append(" authenticate CRAM-MD5" CRLF);
    rv = SendData(command.get());
    NS_ENSURE_SUCCESS(rv, rv);
    ParseIMAPandCheckForNewMail();
    if (GetServerStateParser().LastCommandSuccessful())
    {
      char *digest = nullptr;
      char *cramDigest = GetServerStateParser().fAuthChallenge;
      char *decodedChallenge = PL_Base64Decode(cramDigest,
                                                strlen(cramDigest), nullptr);
      rv = m_imapServerSink->CramMD5Hash(decodedChallenge, password.get(), &digest);
      PR_Free(decodedChallenge);
      NS_ENSURE_SUCCESS(rv, rv);
      NS_ENSURE_TRUE(digest, NS_ERROR_NULL_POINTER);
      nsAutoCString encodedDigest;
      char hexVal[8];

      for (uint32_t j=0; j<16; j++)
      {
        PR_snprintf (hexVal,8, "%.2x", 0x0ff & (unsigned short)(digest[j]));
        encodedDigest.Append(hexVal);
      }

      PR_snprintf(m_dataOutputBuf, OUTPUT_BUFFER_SIZE, "%s %s", userName, encodedDigest.get());
      char *base64Str = PL_Base64Encode(m_dataOutputBuf, strlen(m_dataOutputBuf), nullptr);
      PR_snprintf(m_dataOutputBuf, OUTPUT_BUFFER_SIZE, "%s" CRLF, base64Str);
      PR_Free(base64Str);
      PR_Free(digest);
      rv = SendData(m_dataOutputBuf);
      NS_ENSURE_SUCCESS(rv, rv);
      ParseIMAPandCheckForNewMail(command.get());
    }
  } // if CRAM response was received
  else if (flag & kHasAuthGssApiCapability)
  {
    PR_LOG(IMAP, PR_LOG_DEBUG, ("MD5 auth"));

    // Only try GSSAPI once - if it fails, its going to be because we don't
    // have valid credentials
    //MarkAuthMethodAsFailed(kHasAuthGssApiCapability);

    // We do step1 first, so we don't try GSSAPI against a server which
    // we can't get credentials for.
    nsAutoCString response;

    nsAutoCString service("imap@");
    service.Append(m_realHostName);
    rv = DoGSSAPIStep1(service.get(), userName, response);
    NS_ENSURE_SUCCESS(rv, rv);

    nsAutoCString command (GetServerCommandTag());
    command.Append(" authenticate GSSAPI" CRLF);
    rv = SendData(command.get());
    NS_ENSURE_SUCCESS(rv, rv);

    ParseIMAPandCheckForNewMail("AUTH GSSAPI");
    if (GetServerStateParser().LastCommandSuccessful())
    {
      response += CRLF;
      rv = SendData(response.get());
      NS_ENSURE_SUCCESS(rv, rv);
      ParseIMAPandCheckForNewMail(command.get());
      nsresult gssrv = NS_OK;

      while (GetServerStateParser().LastCommandSuccessful() &&
             NS_SUCCEEDED(gssrv) && gssrv != NS_SUCCESS_AUTH_FINISHED)
      {
        nsCString challengeStr(GetServerStateParser().fAuthChallenge);
        gssrv = DoGSSAPIStep2(challengeStr, response);
        if (NS_SUCCEEDED(gssrv))
        {
          response += CRLF;
          rv = SendData(response.get());
        }
        else
          rv = SendData("*" CRLF);

        NS_ENSURE_SUCCESS(rv, rv);
        ParseIMAPandCheckForNewMail(command.get());
      }
      // TODO: whether it worked or not is shown by LastCommandSuccessful(), not gssrv, right?
    }
  }
  else if (flag & (kHasAuthNTLMCapability | kHasAuthMSNCapability))
  {
    PR_LOG(IMAP, PR_LOG_DEBUG, ("NTLM auth"));
    nsAutoCString command (GetServerCommandTag());
    command.Append((flag & kHasAuthNTLMCapability) ? " authenticate NTLM" CRLF
                                                   : " authenticate MSN" CRLF);
    rv = SendData(command.get());
    ParseIMAPandCheckForNewMail("AUTH NTLM"); // this just waits for ntlm step 1
    if (GetServerStateParser().LastCommandSuccessful())
    {
      nsAutoCString cmd;
      rv = DoNtlmStep1(userName, password.get(), cmd);
      NS_ENSURE_SUCCESS(rv, rv);
      cmd += CRLF;
      rv = SendData(cmd.get());
      NS_ENSURE_SUCCESS(rv, rv);
      ParseIMAPandCheckForNewMail(command.get());
      if (GetServerStateParser().LastCommandSuccessful())
      {
        nsCString challengeStr(GetServerStateParser().fAuthChallenge);
        nsCString response;
        rv = DoNtlmStep2(challengeStr, response);
        NS_ENSURE_SUCCESS(rv, rv);
        response += CRLF;
        rv = SendData(response.get());
        ParseIMAPandCheckForNewMail(command.get());
      }
    }
  }
  else if (flag & kHasAuthPlainCapability)
  {
    PR_LOG(IMAP, PR_LOG_DEBUG, ("PLAIN auth"));
    PR_snprintf(m_dataOutputBuf, OUTPUT_BUFFER_SIZE, "%s authenticate plain" CRLF, GetServerCommandTag());
    rv = SendData(m_dataOutputBuf);
    NS_ENSURE_SUCCESS(rv, rv);
    currentCommand = PL_strdup(m_dataOutputBuf); /* StrAllocCopy(currentCommand, GetOutputBuffer()); */
    ParseIMAPandCheckForNewMail();
    if (GetServerStateParser().LastCommandSuccessful())
    {
      // RFC 4616
      char plainstr[512]; // placeholder for "<NUL>userName<NUL>password" TODO nsAutoCString
      int len = 1; // count for first <NUL> char
      memset(plainstr, 0, 512);
      PR_snprintf(&plainstr[1], 510, "%s", userName);
      len += PL_strlen(userName);
      len++;  // count for second <NUL> char
      PR_snprintf(&plainstr[len], 511-len, "%s", password.get());
      len += password.Length();
      char *base64Str = PL_Base64Encode(plainstr, len, nullptr);
      PR_snprintf(m_dataOutputBuf, OUTPUT_BUFFER_SIZE, "%s" CRLF, base64Str);
      PR_Free(base64Str);
      rv = SendData(m_dataOutputBuf, true /* suppress logging */);
      if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail(currentCommand);
    } // if the last command succeeded
  } // if auth plain capability
  else if (flag & kHasAuthLoginCapability)
  {
    PR_LOG(IMAP, PR_LOG_DEBUG, ("LOGIN auth"));
    PR_snprintf(m_dataOutputBuf, OUTPUT_BUFFER_SIZE, "%s authenticate login" CRLF, GetServerCommandTag());
    rv = SendData(m_dataOutputBuf);
    NS_ENSURE_SUCCESS(rv, rv);
    currentCommand = PL_strdup(m_dataOutputBuf);
    ParseIMAPandCheckForNewMail();

    if (GetServerStateParser().LastCommandSuccessful())
    {
      char *base64Str = PL_Base64Encode(userName, PL_strlen(userName), nullptr);
      PR_snprintf(m_dataOutputBuf, OUTPUT_BUFFER_SIZE, "%s" CRLF, base64Str);
      PR_Free(base64Str);
      rv = SendData(m_dataOutputBuf, true /* suppress logging */);
      if (NS_SUCCEEDED(rv))
      {
        ParseIMAPandCheckForNewMail(currentCommand);
        if (GetServerStateParser().LastCommandSuccessful())
        {
          base64Str = PL_Base64Encode(password.get(), password.Length(), nullptr);
          PR_snprintf(m_dataOutputBuf, OUTPUT_BUFFER_SIZE, "%s" CRLF, base64Str);
          PR_Free(base64Str);
          rv = SendData(m_dataOutputBuf, true /* suppress logging */);
          if (NS_SUCCEEDED(rv))
            ParseIMAPandCheckForNewMail(currentCommand);
        } // if last command successful
      } // if last command successful
    } // if last command successful
  } // if has auth login capability
  else if (flag & kHasAuthOldLoginCapability)
  {
    PR_LOG(IMAP, PR_LOG_DEBUG, ("old-style auth"));
    ProgressEventFunctionUsingName("imapStatusSendingLogin");
    IncrementCommandTagNumber();
    nsCString command (GetServerCommandTag());
    nsAutoCString escapedUserName;
    command.Append(" login \"");
    EscapeUserNamePasswordString(userName, &escapedUserName);
    command.Append(escapedUserName);
    command.Append("\" \"");

    // if the password contains a \, login will fail
    // turn foo\bar into foo\\bar
    nsAutoCString correctedPassword;
    EscapeUserNamePasswordString(password.get(), &correctedPassword);
    command.Append(correctedPassword);
    command.Append("\"" CRLF);
    rv = SendData(command.get(), true /* suppress logging */);
    NS_ENSURE_SUCCESS(rv, rv);
    ParseIMAPandCheckForNewMail();
  }
  else if (flag & kHasAuthNoneCapability)
  {
    // TODO What to do? "login <username>" like POP?
    return NS_ERROR_NOT_IMPLEMENTED;
  }
  else
  {
    PR_LOG(IMAP, PR_LOG_ERROR, ("flags param has no auth scheme selected"));
    return NS_ERROR_ILLEGAL_VALUE;
  }

  PR_Free(currentCommand);
  NS_ENSURE_SUCCESS(rv, rv);
  return GetServerStateParser().LastCommandSuccessful() ?
        NS_OK : NS_ERROR_FAILURE;
}

void nsImapProtocol::OnLSubFolders()
{
  // **** use to find out whether Drafts, Sent, & Templates folder
  // exists or not even the user didn't subscribe to it
  char *mailboxName = OnCreateServerSourceFolderPathString();
  if (mailboxName)
  {
    ProgressEventFunctionUsingName("imapStatusLookingForMailbox");
    IncrementCommandTagNumber();
    PR_snprintf(m_dataOutputBuf, OUTPUT_BUFFER_SIZE,"%s list \"\" \"%s\"" CRLF, GetServerCommandTag(), mailboxName);
    nsresult rv = SendData(m_dataOutputBuf);
#ifdef UNREADY_CODE
    TimeStampListNow();
#endif
    if (NS_SUCCEEDED(rv))
      ParseIMAPandCheckForNewMail();
    PR_Free(mailboxName);
  }
  else
  {
    HandleMemoryFailure();
  }

}

void nsImapProtocol::OnAppendMsgFromFile()
{
  nsCOMPtr<nsIFile> file;
  nsresult rv = NS_OK;
  rv = m_runningUrl->GetMsgFile(getter_AddRefs(file));
  if (NS_SUCCEEDED(rv) && file)
  {
    char *mailboxName =  OnCreateServerSourceFolderPathString();
    if (mailboxName)
    {
      imapMessageFlagsType flagsToSet = 0;
      uint32_t msgFlags = 0;
      PRTime date = 0;
      nsCString keywords;
      if (m_imapMessageSink)
        m_imapMessageSink->GetCurMoveCopyMessageInfo(m_runningUrl, &date,
                                                     keywords, &msgFlags);

      if (msgFlags & nsMsgMessageFlags::Read)
        flagsToSet |= kImapMsgSeenFlag;
      if (msgFlags & nsMsgMessageFlags::MDNReportSent)
        flagsToSet |= kImapMsgMDNSentFlag;
      // convert msg flag label (0xE000000) to imap flag label (0x0E00)
      if (msgFlags & nsMsgMessageFlags::Labels)
        flagsToSet |= (msgFlags & nsMsgMessageFlags::Labels) >> 16;
      if (msgFlags & nsMsgMessageFlags::Marked)
        flagsToSet |= kImapMsgFlaggedFlag;
      if (msgFlags & nsMsgMessageFlags::Replied)
        flagsToSet |= kImapMsgAnsweredFlag;
      if (msgFlags & nsMsgMessageFlags::Forwarded)
        flagsToSet |= kImapMsgForwardedFlag;

      // If the message copied was a draft, flag it as such
      nsImapAction imapAction;
      rv = m_runningUrl->GetImapAction(&imapAction);
      if (NS_SUCCEEDED(rv) && (imapAction == nsIImapUrl::nsImapAppendDraftFromFile))
        flagsToSet |= kImapMsgDraftFlag;
      UploadMessageFromFile(file, mailboxName, date, flagsToSet, keywords);
      PR_Free( mailboxName );
    }
    else
    {
      HandleMemoryFailure();
    }
  }
}

void nsImapProtocol::UploadMessageFromFile (nsIFile* file,
                                            const char* mailboxName,
                                            PRTime date,
                                            imapMessageFlagsType flags,
                                            nsCString &keywords)
{
  if (!file || !mailboxName) return;
  IncrementCommandTagNumber();

  int64_t fileSize = 0;
  int64_t totalSize;
  uint32_t readCount;
  char *dataBuffer = nullptr;
  nsCString command(GetServerCommandTag());
  nsCString escapedName;
  CreateEscapedMailboxName(mailboxName, escapedName);
  nsresult rv;
  bool eof = false;
  nsCString flagString;
  bool hasLiteralPlus = (GetServerStateParser().GetCapabilityFlag() &
    kLiteralPlusCapability);

  nsCOMPtr <nsIInputStream> fileInputStream;

  if (!escapedName.IsEmpty())
  {
    command.Append(" append \"");
    command.Append(escapedName);
    command.Append("\"");
    if (flags || keywords.Length())
    {
      command.Append(" (");

      if (flags)
      {
        SetupMessageFlagsString(flagString, flags,
          GetServerStateParser().SupportsUserFlags());
        command.Append(flagString);
      }
      if (keywords.Length())
      {
        if (flags)
          command.Append(' ');
        command.Append(keywords);
      }
      command.Append(")");
    }

    // date should never be 0, but just in case...
    if (date)
    {
      /* Use PR_FormatTimeUSEnglish() to format the date in US English format,
        then figure out what our local GMT offset is, and append it (since
        PR_FormatTimeUSEnglish() can't do that.) Generate four digit years as
        per RFC 1123 (superceding RFC 822.)
        */
      char szDateTime[64];
      char dateStr[100];
      PRExplodedTime exploded;
      PR_ExplodeTime(date, PR_LocalTimeParameters, &exploded);
      PR_FormatTimeUSEnglish(szDateTime, sizeof(szDateTime), "%d-%b-%Y %H:%M:%S", &exploded);
      PRExplodedTime now;
      PR_ExplodeTime(PR_Now(), PR_LocalTimeParameters, &now);
      int gmtoffset = (now.tm_params.tp_gmt_offset + now.tm_params.tp_dst_offset) / 60;
      PR_snprintf(dateStr, sizeof(dateStr),
                            " \"%s %c%02d%02d\"",
                            szDateTime,
                            (gmtoffset >= 0 ? '+' : '-'),
                            ((gmtoffset >= 0 ? gmtoffset : -gmtoffset) / 60),
                            ((gmtoffset >= 0 ? gmtoffset : -gmtoffset) % 60));

      command.Append(dateStr);
    }
    command.Append(" {");

    dataBuffer = (char*) PR_CALLOC(COPY_BUFFER_SIZE+1);
    if (!dataBuffer) goto done;
    rv = file->GetFileSize(&fileSize);
    NS_ASSERTION(fileSize, "got empty file in UploadMessageFromFile");
    if (NS_FAILED(rv) || !fileSize) goto done;
    rv = NS_NewLocalFileInputStream(getter_AddRefs(fileInputStream), file);
    if (NS_FAILED(rv) || !fileInputStream) goto done;
    command.AppendInt((int32_t)fileSize);
    if (hasLiteralPlus)
      command.Append("+}" CRLF);
    else
      command.Append("}" CRLF);

    rv = SendData(command.get());
    if (NS_FAILED(rv)) goto done;

    if (!hasLiteralPlus)
      ParseIMAPandCheckForNewMail();

    totalSize = fileSize;
    readCount = 0;
    while(NS_SUCCEEDED(rv) && !eof && totalSize > 0)
    {
      rv = fileInputStream->Read(dataBuffer, COPY_BUFFER_SIZE, &readCount);
      if (NS_SUCCEEDED(rv) && !readCount)
        rv = NS_ERROR_FAILURE;

      if (NS_SUCCEEDED(rv))
      {
        NS_ASSERTION(readCount <= (uint32_t) totalSize, "got more bytes than there should be");
        dataBuffer[readCount] = 0;
        rv = SendData(dataBuffer);
        totalSize -= readCount;
        PercentProgressUpdateEvent(nullptr, fileSize - totalSize, fileSize);
      }
    }
    if (NS_SUCCEEDED(rv))
    {
      rv = SendData(CRLF); // complete the append
      ParseIMAPandCheckForNewMail(command.get());

      nsImapAction imapAction;
      m_runningUrl->GetImapAction(&imapAction);

      if (GetServerStateParser().LastCommandSuccessful() &&  (
        imapAction == nsIImapUrl::nsImapAppendDraftFromFile  || imapAction==nsIImapUrl::nsImapAppendMsgFromFile))
      {
        if (GetServerStateParser().GetCapabilityFlag() &
          kUidplusCapability)
        {
          nsMsgKey newKey = GetServerStateParser().CurrentResponseUID();
          if (m_imapMailFolderSink)
            m_imapMailFolderSink->SetAppendMsgUid(newKey, m_runningUrl);

          // Courier imap server seems to have problems with recently
          // appended messages. Noop seems to clear its confusion.
          if (FolderIsSelected(mailboxName))
              Noop();

          nsCString oldMsgId;
          rv = m_runningUrl->GetListOfMessageIds(oldMsgId);
          if (NS_SUCCEEDED(rv) && !oldMsgId.IsEmpty())
          {
            bool idsAreUids = true;
            m_runningUrl->MessageIdsAreUids(&idsAreUids);
            Store(oldMsgId, "+FLAGS (\\Deleted)", idsAreUids);
            UidExpunge(oldMsgId);
          }
        }
        // for non UIDPLUS servers,
        // this code used to check for imapAction==nsIImapUrl::nsImapAppendMsgFromFile, which
        // meant we'd get into this code whenever sending a message, as well
        // as when copying messages to an imap folder from local folders or an other imap server.
        // This made sending a message slow when there was a large sent folder. I don't believe
        // this code worked anyway.
        else if (m_imapMailFolderSink && imapAction == nsIImapUrl::nsImapAppendDraftFromFile )
        {   // *** code me to search for the newly appended message
          // go to selected state
          nsCString messageId;
          rv = m_imapMailFolderSink->GetMessageId(m_runningUrl, messageId);
          if (NS_SUCCEEDED(rv) && !messageId.IsEmpty() &&
            GetServerStateParser().LastCommandSuccessful())
          {
            // if the appended to folder isn't selected in the connection,
            // select it.
            if (!FolderIsSelected(mailboxName))
              SelectMailbox(mailboxName);
            else
              Noop(); // See if this makes SEARCH work on the newly appended msg.

            if (GetServerStateParser().LastCommandSuccessful())
            {
              command = "SEARCH UNDELETED HEADER Message-ID ";
              command.Append(messageId);

              // Clean up result sequence before issuing the cmd.
              GetServerStateParser().ResetSearchResultSequence();

              Search(command.get(), true, false);
              if (GetServerStateParser().LastCommandSuccessful())
              {
                nsMsgKey newkey = nsMsgKey_None;
                nsImapSearchResultIterator *searchResult =
                  GetServerStateParser().CreateSearchResultIterator();
                newkey = searchResult->GetNextMessageNumber();
                delete searchResult;
                if (newkey != nsMsgKey_None)
                  m_imapMailFolderSink->SetAppendMsgUid(newkey, m_runningUrl);
              }
            }
          }
        }
      }
    }
  }
done:
  PR_Free(dataBuffer);
  if (fileInputStream)
    fileInputStream->Close();
}

//caller must free using PR_Free
char * nsImapProtocol::OnCreateServerSourceFolderPathString()
{
  char *sourceMailbox = nullptr;
  char hierarchyDelimiter = 0;
  char onlineDelimiter = 0;
  m_runningUrl->GetOnlineSubDirSeparator(&hierarchyDelimiter);
  if (m_imapMailFolderSink)
    m_imapMailFolderSink->GetOnlineDelimiter(&onlineDelimiter);

  if (onlineDelimiter != kOnlineHierarchySeparatorUnknown &&
      onlineDelimiter != hierarchyDelimiter)
    m_runningUrl->SetOnlineSubDirSeparator(onlineDelimiter);

  m_runningUrl->CreateServerSourceFolderPathString(&sourceMailbox);

  return sourceMailbox;
}

//caller must free using PR_Free, safe to call from ui thread
char * nsImapProtocol::GetFolderPathString()
{
  char *sourceMailbox = nullptr;
  char onlineSubDirDelimiter = 0;
  char hierarchyDelimiter = 0;
  nsCOMPtr <nsIMsgFolder> msgFolder;

  m_runningUrl->GetOnlineSubDirSeparator(&onlineSubDirDelimiter);
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_runningUrl);
  mailnewsUrl->GetFolder(getter_AddRefs(msgFolder));
  if (msgFolder)
  {
    nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(msgFolder);
    if (imapFolder)
    {
      imapFolder->GetHierarchyDelimiter(&hierarchyDelimiter);
      if (hierarchyDelimiter != kOnlineHierarchySeparatorUnknown &&
          onlineSubDirDelimiter != hierarchyDelimiter)
        m_runningUrl->SetOnlineSubDirSeparator(hierarchyDelimiter);
    }
  }
  m_runningUrl->CreateServerSourceFolderPathString(&sourceMailbox);

  return sourceMailbox;
}

nsresult nsImapProtocol::CreateServerSourceFolderPathString(char **result)
{
  NS_ENSURE_ARG(result);
  *result = OnCreateServerSourceFolderPathString();
  return (*result) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

//caller must free using PR_Free
char * nsImapProtocol::OnCreateServerDestinationFolderPathString()
{
  char *destinationMailbox = nullptr;
  char hierarchyDelimiter = 0;
  char onlineDelimiter = 0;
  m_runningUrl->GetOnlineSubDirSeparator(&hierarchyDelimiter);
  if (m_imapMailFolderSink)
    m_imapMailFolderSink->GetOnlineDelimiter(&onlineDelimiter);
  if (onlineDelimiter != kOnlineHierarchySeparatorUnknown &&
      onlineDelimiter != hierarchyDelimiter)
    m_runningUrl->SetOnlineSubDirSeparator(onlineDelimiter);

  m_runningUrl->CreateServerDestinationFolderPathString(&destinationMailbox);

  return destinationMailbox;
}

void nsImapProtocol::OnCreateFolder(const char * aSourceMailbox)
{
  bool created = CreateMailboxRespectingSubscriptions(aSourceMailbox);
  if (created)
  {
    m_hierarchyNameState = kListingForCreate;
    nsCString mailboxWODelim(aSourceMailbox);
    RemoveHierarchyDelimiter(mailboxWODelim);
    List(mailboxWODelim.get(), false);
    m_hierarchyNameState = kNoOperationInProgress;
  }
  else
    FolderNotCreated(aSourceMailbox);
}

void nsImapProtocol::OnEnsureExistsFolder(const char * aSourceMailbox)
{

  List(aSourceMailbox, false); // how to tell if that succeeded?
  bool exists = false;

  // try converting aSourceMailbox to canonical format

  nsIMAPNamespace *nsForMailbox = nullptr;
  m_hostSessionList->GetNamespaceForMailboxForHost(GetImapServerKey(),
                                                     aSourceMailbox, nsForMailbox);
  // NS_ASSERTION (nsForMailbox, "Oops .. null nsForMailbox\n");

  nsCString name;

  if (nsForMailbox)
    m_runningUrl->AllocateCanonicalPath(aSourceMailbox,
                                            nsForMailbox->GetDelimiter(),
                                            getter_Copies(name));
  else
    m_runningUrl->AllocateCanonicalPath(aSourceMailbox,
                                            kOnlineHierarchySeparatorUnknown,
                                            getter_Copies(name));

  if (m_imapServerSink)
    m_imapServerSink->FolderVerifiedOnline(name, &exists);

  if (exists)
  {
    Subscribe(aSourceMailbox);
  }
  else
  {
    bool created = CreateMailboxRespectingSubscriptions(aSourceMailbox);
    if (created)
    {
        List(aSourceMailbox, false);
    }
  }
  if (!GetServerStateParser().LastCommandSuccessful())
        FolderNotCreated(aSourceMailbox);
}


void nsImapProtocol::OnSubscribe(const char * sourceMailbox)
{
  Subscribe(sourceMailbox);
}

void nsImapProtocol::OnUnsubscribe(const char * sourceMailbox)
{
  // When we try to auto-unsubscribe from \Noselect folders,
  // some servers report errors if we were already unsubscribed
  // from them.
  bool lastReportingErrors = GetServerStateParser().GetReportingErrors();
  GetServerStateParser().SetReportingErrors(false);
  Unsubscribe(sourceMailbox);
  GetServerStateParser().SetReportingErrors(lastReportingErrors);
}

void nsImapProtocol::RefreshACLForFolderIfNecessary(const char *mailboxName)
{
  if (GetServerStateParser().ServerHasACLCapability())
  {
    if (!m_folderNeedsACLRefreshed && m_imapMailFolderSink)
      m_imapMailFolderSink->GetFolderNeedsACLListed(&m_folderNeedsACLRefreshed);
    if (m_folderNeedsACLRefreshed)
    {
      RefreshACLForFolder(mailboxName);
      m_folderNeedsACLRefreshed = false;
    }
  }
}

void nsImapProtocol::RefreshACLForFolder(const char *mailboxName)
{

  nsIMAPNamespace *ns = nullptr;
  m_hostSessionList->GetNamespaceForMailboxForHost(GetImapServerKey(), mailboxName, ns);
  if (ns)
  {
    switch (ns->GetType())
    {
    case kPersonalNamespace:
      // It's a personal folder, most likely.
      // I find it hard to imagine a server that supports ACL that doesn't support NAMESPACE,
      // so most likely we KNOW that this is a personal, rather than the default, namespace.

      // First, clear what we have.
      ClearAllFolderRights();
      // Now, get the new one.
      GetMyRightsForFolder(mailboxName);
      if (m_imapMailFolderSink)
      {
        uint32_t aclFlags = 0;
        if (NS_SUCCEEDED(m_imapMailFolderSink->GetAclFlags(&aclFlags)) && aclFlags & IMAP_ACL_ADMINISTER_FLAG)
            GetACLForFolder(mailboxName);
      }

      // We're all done, refresh the icon/flags for this folder
      RefreshFolderACLView(mailboxName, ns);
      break;
    default:
      // We know it's a public folder or other user's folder.
      // We only want our own rights

      // First, clear what we have
      ClearAllFolderRights();
      // Now, get the new one.
      GetMyRightsForFolder(mailboxName);
      // We're all done, refresh the icon/flags for this folder
      RefreshFolderACLView(mailboxName, ns);
      break;
    }
  }
  else
  {
    // no namespace, not even default... can this happen?
    NS_ASSERTION(false, "couldn't get namespace");
  }
}

void nsImapProtocol::RefreshFolderACLView(const char *mailboxName, nsIMAPNamespace *nsForMailbox)
{
  nsCString canonicalMailboxName;

  if (nsForMailbox)
    m_runningUrl->AllocateCanonicalPath(mailboxName, nsForMailbox->GetDelimiter(), getter_Copies(canonicalMailboxName));
  else
    m_runningUrl->AllocateCanonicalPath(mailboxName, kOnlineHierarchySeparatorUnknown, getter_Copies(canonicalMailboxName));

  if (m_imapServerSink)
    m_imapServerSink->RefreshFolderRights(canonicalMailboxName);
}

void nsImapProtocol::GetACLForFolder(const char *mailboxName)
{
  IncrementCommandTagNumber();

  nsCString command(GetServerCommandTag());
  nsCString escapedName;
  CreateEscapedMailboxName(mailboxName, escapedName);
  command.Append(" getacl \"");
  command.Append(escapedName);
  command.Append("\"" CRLF);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::OnRefreshAllACLs()
{
  m_hierarchyNameState = kListingForInfoOnly;
  nsIMAPMailboxInfo *mb = NULL;

  // This will fill in the list
  List("*", true);

  int32_t total = m_listedMailboxList.Count(), count = 0;
  GetServerStateParser().SetReportingErrors(false);
  for (int32_t i = 0; i < total; i++)
  {
    mb = (nsIMAPMailboxInfo *) m_listedMailboxList.ElementAt(i);
    if (mb) // paranoia
    {
      char *onlineName = nullptr;
      m_runningUrl->AllocateServerPath(PromiseFlatCString(mb->GetMailboxName()).get(), mb->GetDelimiter(), &onlineName);
      if (onlineName)
      {
        RefreshACLForFolder(onlineName);
        NS_Free(onlineName);
      }
      PercentProgressUpdateEvent(NULL, count, total);
      delete mb;
      count++;
    }
  }
  m_listedMailboxList.Clear();

  PercentProgressUpdateEvent(NULL, 100, 100);
  GetServerStateParser().SetReportingErrors(true);
  m_hierarchyNameState = kNoOperationInProgress;
}

// any state commands
void nsImapProtocol::Logout(bool shuttingDown /* = false */,
                            bool waitForResponse /* = true */)
{
  if (!shuttingDown)
    ProgressEventFunctionUsingName("imapStatusLoggingOut");

/******************************************************************
 * due to the undo functionality we cannot issule a close when logout; there
 * is no way to do an undo if the message has been permanently expunge
 * jt - 07/12/1999

    bool closeNeeded = GetServerStateParser().GetIMAPstate() ==
        nsImapServerResponseParser::kFolderSelected;

    if (closeNeeded && GetDeleteIsMoveToTrash())
        Close();
********************/

  IncrementCommandTagNumber();

  nsCString command(GetServerCommandTag());

  command.Append(" logout" CRLF);

  nsresult rv = SendData(command.get());
  if (m_transport && shuttingDown)
    m_transport->SetTimeout(nsISocketTransport::TIMEOUT_READ_WRITE, 5);
  // the socket may be dead before we read the response, so drop it.
  if (NS_SUCCEEDED(rv) && waitForResponse)
      ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::Noop()
{
  //ProgressUpdateEvent("noop...");
  IncrementCommandTagNumber();
  nsCString command(GetServerCommandTag());

  command.Append(" noop" CRLF);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
      ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::XServerInfo()
{

    ProgressEventFunctionUsingName("imapGettingServerInfo");
    IncrementCommandTagNumber();
    nsCString command(GetServerCommandTag());

  command.Append(" XSERVERINFO MANAGEACCOUNTURL MANAGELISTSURL MANAGEFILTERSURL" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::Netscape()
{
    ProgressEventFunctionUsingName("imapGettingServerInfo");
    IncrementCommandTagNumber();

    nsCString command(GetServerCommandTag());

  command.Append(" netscape" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
}



void nsImapProtocol::XMailboxInfo(const char *mailboxName)
{

    ProgressEventFunctionUsingName("imapGettingMailboxInfo");
    IncrementCommandTagNumber();
    nsCString command(GetServerCommandTag());

  command.Append(" XMAILBOXINFO \"");
  command.Append(mailboxName);
  command.Append("\" MANAGEURL POSTURL" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::Namespace()
{

    IncrementCommandTagNumber();

  nsCString command(GetServerCommandTag());
  command.Append(" namespace" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
}


void nsImapProtocol::MailboxData()
{
    IncrementCommandTagNumber();

  nsCString command(GetServerCommandTag());
  command.Append(" mailboxdata" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
}


void nsImapProtocol::GetMyRightsForFolder(const char *mailboxName)
{
  IncrementCommandTagNumber();

  nsCString command(GetServerCommandTag());
  nsCString escapedName;
  CreateEscapedMailboxName(mailboxName, escapedName);

  if (MailboxIsNoSelectMailbox(escapedName.get()))
    return; // Don't issue myrights on Noselect folder

  command.Append(" myrights \"");
  command.Append(escapedName);
  command.Append("\"" CRLF);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail();
}

bool nsImapProtocol::FolderIsSelected(const char *mailboxName)
{
  return (GetServerStateParser().GetIMAPstate() ==
      nsImapServerResponseParser::kFolderSelected && GetServerStateParser().GetSelectedMailboxName() &&
      PL_strcmp(GetServerStateParser().GetSelectedMailboxName(),
                    mailboxName) == 0);
}

void nsImapProtocol::OnStatusForFolder(const char *mailboxName)
{

  if (FolderIsSelected(mailboxName))
  {
    int32_t prevNumMessages = GetServerStateParser().NumberOfMessages();
    Noop();
    // OnNewIdleMessages will cause the ui thread to update the folder
    if (m_imapMailFolderSink && (GetServerStateParser().NumberOfRecentMessages()
          || prevNumMessages != GetServerStateParser().NumberOfMessages()))
      m_imapMailFolderSink->OnNewIdleMessages();
    return;
  }

  IncrementCommandTagNumber();

  nsAutoCString command(GetServerCommandTag());
  nsCString escapedName;
  CreateEscapedMailboxName(mailboxName, escapedName);

  command.Append(" STATUS \"");
  command.Append(escapedName);
  command.Append("\" (UIDNEXT MESSAGES UNSEEN RECENT)" CRLF);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
      ParseIMAPandCheckForNewMail();

  if (GetServerStateParser().LastCommandSuccessful())
  {
    nsImapMailboxSpec *new_spec = GetServerStateParser().CreateCurrentMailboxSpec(mailboxName);
    if (new_spec && m_imapMailFolderSink)
      m_imapMailFolderSink->UpdateImapMailboxStatus(this, new_spec);
    NS_IF_RELEASE(new_spec);
  }
}


void nsImapProtocol::OnListFolder(const char * aSourceMailbox, bool aBool)
{
  List(aSourceMailbox, aBool);
}


// Returns true if the mailbox is a NoSelect mailbox.
// If we don't know about it, returns false.
bool nsImapProtocol::MailboxIsNoSelectMailbox(const char *mailboxName)
{
  bool rv = false;

  nsIMAPNamespace *nsForMailbox = nullptr;
    m_hostSessionList->GetNamespaceForMailboxForHost(GetImapServerKey(),
                                                     mailboxName, nsForMailbox);
  // NS_ASSERTION (nsForMailbox, "Oops .. null nsForMailbox\n");

  nsCString name;

  if (nsForMailbox)
    m_runningUrl->AllocateCanonicalPath(mailboxName,
                                            nsForMailbox->GetDelimiter(),
                                            getter_Copies(name));
  else
    m_runningUrl->AllocateCanonicalPath(mailboxName,
                                            kOnlineHierarchySeparatorUnknown,
                                            getter_Copies(name));

  if (name.IsEmpty())
    return false;

  NS_ASSERTION(m_imapServerSink, "unexpected, no imap server sink, see bug #194335");
  if (m_imapServerSink)
    m_imapServerSink->FolderIsNoSelect(name, &rv);
  return rv;
}

nsresult nsImapProtocol::SetFolderAdminUrl(const char *mailboxName)
{
  nsresult rv = NS_ERROR_NULL_POINTER; // if m_imapServerSink is null, rv will be this.

  nsIMAPNamespace *nsForMailbox = nullptr;
  m_hostSessionList->GetNamespaceForMailboxForHost(GetImapServerKey(),
                                                     mailboxName, nsForMailbox);

  nsCString name;

  if (nsForMailbox)
    m_runningUrl->AllocateCanonicalPath(mailboxName,
                                            nsForMailbox->GetDelimiter(),
                                            getter_Copies(name));
  else
    m_runningUrl->AllocateCanonicalPath(mailboxName,
                                            kOnlineHierarchySeparatorUnknown,
                                            getter_Copies(name));

  if (m_imapServerSink)
    rv = m_imapServerSink->SetFolderAdminURL(name, nsDependentCString(GetServerStateParser().GetManageFolderUrl()));
  return rv;
}
// returns true is the delete succeeded (regardless of subscription changes)
bool nsImapProtocol::DeleteMailboxRespectingSubscriptions(const char *mailboxName)
{
  bool rv = true;
  if (!MailboxIsNoSelectMailbox(mailboxName))
  {
    // Only try to delete it if it really exists
    DeleteMailbox(mailboxName);
    rv = GetServerStateParser().LastCommandSuccessful();
  }

  // We can unsubscribe even if the mailbox doesn't exist.
  if (rv && m_autoUnsubscribe) // auto-unsubscribe is on
  {
    bool reportingErrors = GetServerStateParser().GetReportingErrors();
    GetServerStateParser().SetReportingErrors(false);
    Unsubscribe(mailboxName);
    GetServerStateParser().SetReportingErrors(reportingErrors);

  }
  return (rv);
}

// returns true is the rename succeeded (regardless of subscription changes)
// reallyRename tells us if we should really do the rename (true) or if we should just move subscriptions (false)
bool nsImapProtocol::RenameMailboxRespectingSubscriptions(const char *existingName, const char *newName, bool reallyRename)
{
  bool rv = true;
  if (reallyRename && !MailboxIsNoSelectMailbox(existingName))
  {
    RenameMailbox(existingName, newName);
    rv = GetServerStateParser().LastCommandSuccessful();
  }

  if (rv)
  {
    if (m_autoSubscribe)  // if auto-subscribe is on
    {
      bool reportingErrors = GetServerStateParser().GetReportingErrors();
      GetServerStateParser().SetReportingErrors(false);
      Subscribe(newName);
      GetServerStateParser().SetReportingErrors(reportingErrors);
    }
    if (m_autoUnsubscribe) // if auto-unsubscribe is on
    {
      bool reportingErrors = GetServerStateParser().GetReportingErrors();
      GetServerStateParser().SetReportingErrors(false);
      Unsubscribe(existingName);
      GetServerStateParser().SetReportingErrors(reportingErrors);
    }
  }
  return (rv);
}

bool nsImapProtocol::RenameHierarchyByHand(const char *oldParentMailboxName,
                                             const char *newParentMailboxName)
{
  bool renameSucceeded = true;
    char onlineDirSeparator = kOnlineHierarchySeparatorUnknown;
  m_deletableChildren = new nsVoidArray();

  bool nonHierarchicalRename =
        ((GetServerStateParser().GetCapabilityFlag() & kNoHierarchyRename)
         || MailboxIsNoSelectMailbox(oldParentMailboxName));

  if (m_deletableChildren)
  {
    m_hierarchyNameState = kDeleteSubFoldersInProgress;
    nsIMAPNamespace *ns = nullptr;
        m_hostSessionList->GetNamespaceForMailboxForHost(GetImapServerKey(),
                                                         oldParentMailboxName,
                                                         ns); // for delimiter
    if (!ns)
    {
      if (!PL_strcasecmp(oldParentMailboxName, "INBOX"))
                m_hostSessionList->GetDefaultNamespaceOfTypeForHost(GetImapServerKey(),
                                                                    kPersonalNamespace,
                                                                    ns);
    }
    if (ns)
    {
            nsCString pattern(oldParentMailboxName);
            pattern += ns->GetDelimiter();
            pattern += "*";
            bool isUsingSubscription = false;
            m_hostSessionList->GetHostIsUsingSubscription(GetImapServerKey(),
                                                          isUsingSubscription);

            if (isUsingSubscription)
                Lsub(pattern.get(), false);
            else
                List(pattern.get(), false);
    }
    m_hierarchyNameState = kNoOperationInProgress;

    if (GetServerStateParser().LastCommandSuccessful())
      renameSucceeded = // rename this, and move subscriptions
                RenameMailboxRespectingSubscriptions(oldParentMailboxName,
                                                     newParentMailboxName, true);

    int32_t numberToDelete = m_deletableChildren->Count();
        int32_t childIndex;

    for (childIndex = 0;
             (childIndex < numberToDelete) && renameSucceeded; childIndex++)
    {
      // the imap parser has already converted to a non UTF7 string in the canonical
      // format so convert it back
        char *currentName = (char *) m_deletableChildren->ElementAt(childIndex);
        if (currentName)
        {
          char *serverName = nullptr;
          m_runningUrl->AllocateServerPath(currentName,
                                         onlineDirSeparator,
                                         &serverName);
          PR_FREEIF(currentName);
          currentName = serverName;
        }

        // calculate the new name and do the rename
        nsCString newChildName(newParentMailboxName);
        newChildName += (currentName + PL_strlen(oldParentMailboxName));
        RenameMailboxRespectingSubscriptions(currentName,
                                             newChildName.get(),
                                             nonHierarchicalRename);
        // pass in xNonHierarchicalRename to determine if we should really
        // reanme, or just move subscriptions
        renameSucceeded = GetServerStateParser().LastCommandSuccessful();
        PR_FREEIF(currentName);
    }

    delete m_deletableChildren;
    m_deletableChildren = nullptr;
  }

  return renameSucceeded;
}

bool nsImapProtocol::DeleteSubFolders(const char* selectedMailbox, bool &aDeleteSelf)
{
  bool deleteSucceeded = true;
  m_deletableChildren = new nsVoidArray();

  if (m_deletableChildren)
  {
    bool folderDeleted = false;

    m_hierarchyNameState = kDeleteSubFoldersInProgress;
        nsCString pattern(selectedMailbox);
        char onlineDirSeparator = kOnlineHierarchySeparatorUnknown;
        m_runningUrl->GetOnlineSubDirSeparator(&onlineDirSeparator);
        pattern.Append(onlineDirSeparator);
        pattern.Append('*');

    if (!pattern.IsEmpty())
    {
      List(pattern.get(), false);
    }
    m_hierarchyNameState = kNoOperationInProgress;

    // this should be a short list so perform a sequential search for the
    // longest name mailbox.  Deleting the longest first will hopefully
        // prevent the server from having problems about deleting parents
        // ** jt - why? I don't understand this.
    int32_t numberToDelete = m_deletableChildren->Count();
    int32_t outerIndex, innerIndex;

    // intelligently decide if myself(either plain format or following the dir-separator)
    // is in the sub-folder list
    bool folderInSubfolderList = false; // For Performance
    char *selectedMailboxDir = nullptr;
    {
        int32_t length = strlen(selectedMailbox);
        selectedMailboxDir = (char *)PR_MALLOC(length+2);
        if( selectedMailboxDir )    // only do the intelligent test if there is enough memory
        {
            strcpy(selectedMailboxDir, selectedMailbox);
            selectedMailboxDir[length] = onlineDirSeparator;
            selectedMailboxDir[length+1] = '\0';
            int32_t i;
            for( i=0; i<numberToDelete && !folderInSubfolderList; i++ )
            {
                char *currentName = (char *) m_deletableChildren->ElementAt(i);
                if( !strcmp(currentName, selectedMailbox) || !strcmp(currentName, selectedMailboxDir) )
                    folderInSubfolderList = true;
            }
        }
    }

    deleteSucceeded = GetServerStateParser().LastCommandSuccessful();
    for (outerIndex = 0;
         (outerIndex < numberToDelete) && deleteSucceeded;
         outerIndex++)
    {
        char* longestName = nullptr;
        int32_t longestIndex = 0; // fix bogus warning by initializing
        for (innerIndex = 0;
             innerIndex < m_deletableChildren->Count();
             innerIndex++)
        {
            char *currentName =
                (char *) m_deletableChildren->ElementAt(innerIndex);
            if (!longestName || strlen(longestName) < strlen(currentName))
            {
                longestName = currentName;
                longestIndex = innerIndex;
            }
        }
        // the imap parser has already converted to a non UTF7 string in
        // the canonical format so convert it back
        if (longestName)
        {
            char *serverName = nullptr;

            m_deletableChildren->RemoveElementAt(longestIndex);
            m_runningUrl->AllocateServerPath(longestName,
                                             onlineDirSeparator,
                                             &serverName);
            PR_FREEIF(longestName);
            longestName = serverName;
        }

      // some imap servers include the selectedMailbox in the list of
      // subfolders of the selectedMailbox.  Check for this so we don't
            // delete the selectedMailbox (usually the trash and doing an
            // empty trash)
      // The Cyrus imap server ignores the "INBOX.Trash" constraining
            // string passed to the list command.  Be defensive and make sure
            // we only delete children of the trash
      if (longestName &&
        strcmp(selectedMailbox, longestName) &&
        !strncmp(selectedMailbox, longestName, strlen(selectedMailbox)))
      {
          if( selectedMailboxDir && !strcmp(selectedMailboxDir, longestName) )	// just myself
          {
              if( aDeleteSelf )
              {
                  bool deleted = DeleteMailboxRespectingSubscriptions(longestName);
                  if (deleted)
                      FolderDeleted(longestName);
                  folderDeleted = deleted;
                  deleteSucceeded = deleted;
              }
          }
          else
          {
              nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryReferent(m_server);
              if (imapServer)
                  imapServer->ResetConnection(nsDependentCString(longestName));
              bool deleted = false;
              if( folderInSubfolderList )	// for performance
              {
                  nsVoidArray* pDeletableChildren = m_deletableChildren;
                  m_deletableChildren = nullptr;
                  bool folderDeleted = true;
                  deleted = DeleteSubFolders(longestName, folderDeleted);
                  // longestName may have subfolder list including itself
                  if( !folderDeleted )
                  {
                      if (deleted)
                      deleted = DeleteMailboxRespectingSubscriptions(longestName);
                      if (deleted)
                          FolderDeleted(longestName);
                  }
                  m_deletableChildren = pDeletableChildren;
              }
              else
              {
                  deleted = DeleteMailboxRespectingSubscriptions(longestName);
                  if (deleted)
                      FolderDeleted(longestName);
              }
              deleteSucceeded = deleted;
          }
      }
      PR_FREEIF(longestName);
    }

    aDeleteSelf = folderDeleted;  // feedback if myself is deleted
    PR_Free(selectedMailboxDir);

    delete m_deletableChildren;
    m_deletableChildren = nullptr;
  }
  return deleteSucceeded;
}

void nsImapProtocol::FolderDeleted(const char *mailboxName)
{
    char onlineDelimiter = kOnlineHierarchySeparatorUnknown;
    nsCString orphanedMailboxName;

    if (mailboxName)
    {
        m_runningUrl->AllocateCanonicalPath(mailboxName, onlineDelimiter,
                                            getter_Copies(orphanedMailboxName));
    if (m_imapServerSink)
      m_imapServerSink->OnlineFolderDelete(orphanedMailboxName);
    }
}

void nsImapProtocol::FolderNotCreated(const char *folderName)
{
    if (folderName && m_imapServerSink)
        m_imapServerSink->OnlineFolderCreateFailed(nsDependentCString(folderName));
}

void nsImapProtocol::FolderRenamed(const char *oldName,
                                   const char *newName)
{
  char onlineDelimiter = kOnlineHierarchySeparatorUnknown;

  if ((m_hierarchyNameState == kNoOperationInProgress) ||
    (m_hierarchyNameState == kListingForInfoAndDiscovery))

  {
    nsCString canonicalOldName, canonicalNewName;
    m_runningUrl->AllocateCanonicalPath(oldName,
      onlineDelimiter,
      getter_Copies(canonicalOldName));
    m_runningUrl->AllocateCanonicalPath(newName,
      onlineDelimiter,
      getter_Copies(canonicalNewName));
    nsCOMPtr<nsIMsgWindow> msgWindow;
    GetMsgWindow(getter_AddRefs(msgWindow));
    m_imapServerSink->OnlineFolderRename(msgWindow, canonicalOldName, canonicalNewName);
  }
}

void nsImapProtocol::OnDeleteFolder(const char * sourceMailbox)
{
  // intelligently delete the folder
  bool folderDeleted = true;
  bool deleted = DeleteSubFolders(sourceMailbox, folderDeleted);
  if( !folderDeleted )
  {
    if (deleted)
      deleted = DeleteMailboxRespectingSubscriptions(sourceMailbox);
    if (deleted)
      FolderDeleted(sourceMailbox);
  }
}

void nsImapProtocol::RemoveMsgsAndExpunge()
{
  uint32_t numberOfMessages = GetServerStateParser().NumberOfMessages();
  if (numberOfMessages)
  {
    // Remove all msgs and expunge the folder (ie, compact it).
    Store(NS_LITERAL_CSTRING("1:*"), "+FLAGS.SILENT (\\Deleted)", false);  // use sequence #'s
    if (GetServerStateParser().LastCommandSuccessful())
      Expunge();
  }
}

void nsImapProtocol::DeleteFolderAndMsgs(const char * sourceMailbox)
{
  RemoveMsgsAndExpunge();
  if (GetServerStateParser().LastCommandSuccessful())
  {
    // All msgs are deleted successfully - let's remove the folder itself.
    bool reportingErrors = GetServerStateParser().GetReportingErrors();
    GetServerStateParser().SetReportingErrors(false);
    OnDeleteFolder(sourceMailbox);
    GetServerStateParser().SetReportingErrors(reportingErrors);
  }
}

void nsImapProtocol::OnRenameFolder(const char * sourceMailbox)
{
  char *destinationMailbox = OnCreateServerDestinationFolderPathString();

  if (destinationMailbox)
  {
    bool renamed = RenameHierarchyByHand(sourceMailbox, destinationMailbox);
    if (renamed)
      FolderRenamed(sourceMailbox, destinationMailbox);

    PR_Free( destinationMailbox);
  }
  else
    HandleMemoryFailure();
}

void nsImapProtocol::OnMoveFolderHierarchy(const char * sourceMailbox)
{
  char *destinationMailbox = OnCreateServerDestinationFolderPathString();

    if (destinationMailbox)
    {
        nsCString newBoxName;
        newBoxName.Adopt(destinationMailbox);

        char onlineDirSeparator = kOnlineHierarchySeparatorUnknown;
        m_runningUrl->GetOnlineSubDirSeparator(&onlineDirSeparator);

        nsCString oldBoxName(sourceMailbox);
        int32_t leafStart = oldBoxName.RFindChar(onlineDirSeparator);
        nsCString leafName;

        if (-1 == leafStart)
            leafName = oldBoxName;  // this is a root level box
        else
            leafName = Substring(oldBoxName, leafStart+1);

        if ( !newBoxName.IsEmpty() )
             newBoxName.Append(onlineDirSeparator);
        newBoxName.Append(leafName);
        bool    renamed = RenameHierarchyByHand(sourceMailbox,
                                                newBoxName.get());
        if (renamed)
            FolderRenamed(sourceMailbox, newBoxName.get());
    }
    else
      HandleMemoryFailure();
}

void nsImapProtocol::FindMailboxesIfNecessary()
{
  // biff should not discover mailboxes
  bool foundMailboxesAlready = false;
  nsImapAction imapAction;

  // need to do this for every connection in order to see folders.
  (void) m_runningUrl->GetImapAction(&imapAction);
  nsresult rv = m_hostSessionList->GetHaveWeEverDiscoveredFoldersForHost(GetImapServerKey(), foundMailboxesAlready);
  if (NS_SUCCEEDED(rv) && !foundMailboxesAlready &&
      (imapAction != nsIImapUrl::nsImapBiff) &&
      (imapAction != nsIImapUrl::nsImapVerifylogon) &&
      (imapAction != nsIImapUrl::nsImapDiscoverAllBoxesUrl) &&
      (imapAction != nsIImapUrl::nsImapUpgradeToSubscription) &&
      !GetSubscribingNow())
    DiscoverMailboxList();
}

void nsImapProtocol::DiscoverAllAndSubscribedBoxes()
{
  // used for subscribe pane
  // iterate through all namespaces
  uint32_t count = 0;
  m_hostSessionList->GetNumberOfNamespacesForHost(GetImapServerKey(), count);

  for (uint32_t i = 0; i < count; i++ )
  {
    nsIMAPNamespace *ns = nullptr;

    m_hostSessionList->GetNamespaceNumberForHost(GetImapServerKey(), i,
      ns);
    if (ns &&
      gHideOtherUsersFromList ? (ns->GetType() != kOtherUsersNamespace)
      : true)
    {
      const char *prefix = ns->GetPrefix();
      if (prefix)
      {
        if (!gHideUnusedNamespaces && *prefix &&
        PL_strcasecmp(prefix, "INBOX.")) /* only do it for
        non-empty namespace prefixes */
        {
          // Explicitly discover each Namespace, just so they're
          // there in the subscribe UI
          nsImapMailboxSpec *boxSpec = new nsImapMailboxSpec;
          if (boxSpec)
          {
            NS_ADDREF(boxSpec);
            boxSpec->mFolderSelected = false;
            boxSpec->mHostName.Assign(GetImapHostName());
            boxSpec->mConnection = this;
            boxSpec->mFlagState = nullptr;
            boxSpec->mDiscoveredFromLsub = true;
            boxSpec->mOnlineVerified = true;
            boxSpec->mBoxFlags = kNoselect;
            boxSpec->mHierarchySeparator = ns->GetDelimiter();

            m_runningUrl->AllocateCanonicalPath(ns->GetPrefix(), ns->GetDelimiter(),
                                                getter_Copies(boxSpec->mAllocatedPathName));
            boxSpec->mNamespaceForFolder = ns;
            boxSpec->mBoxFlags |= kNameSpace;

            switch (ns->GetType())
            {
            case kPersonalNamespace:
              boxSpec->mBoxFlags |= kPersonalMailbox;
              break;
            case kPublicNamespace:
              boxSpec->mBoxFlags |= kPublicMailbox;
              break;
            case kOtherUsersNamespace:
              boxSpec->mBoxFlags |= kOtherUsersMailbox;
              break;
            default:	// (kUnknownNamespace)
              break;
            }

            DiscoverMailboxSpec(boxSpec);
          }
          else
            HandleMemoryFailure();
        }

        nsAutoCString allPattern(prefix);
        allPattern += '*';

        nsAutoCString topLevelPattern(prefix);
        topLevelPattern += '%';

        nsAutoCString secondLevelPattern;

        char delimiter = ns->GetDelimiter();
        if (delimiter)
        {
          // Hierarchy delimiter might be NIL, in which case there's no hierarchy anyway
          secondLevelPattern = prefix;
          secondLevelPattern += '%';
          secondLevelPattern += delimiter;
          secondLevelPattern += '%';
        }

        nsresult rv;
        nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryReferent(m_server, &rv);
        if (NS_FAILED(rv) || !imapServer) return;

        if (!allPattern.IsEmpty())
        {
          imapServer->SetDoingLsub(true);
          Lsub(allPattern.get(), true);	// LSUB all the subscribed
        }
        if (!topLevelPattern.IsEmpty())
        {
          imapServer->SetDoingLsub(false);
          List(topLevelPattern.get(), true);	// LIST the top level
        }
        if (!secondLevelPattern.IsEmpty())
        {
          imapServer->SetDoingLsub(false);
          List(secondLevelPattern.get(), true);	// LIST the second level
        }
      }
    }
  }
}

// DiscoverMailboxList() is used to actually do the discovery of folders
// for a host.  This is used both when we initially start up (and re-sync)
// and also when the user manually requests a re-sync, by collapsing and
// expanding a host in the folder pane.  This is not used for the subscribe
// pane.
// DiscoverMailboxList() also gets the ACLs for each newly discovered folder
void nsImapProtocol::DiscoverMailboxList()
{
  bool usingSubscription = false;

  m_hostSessionList->GetHostIsUsingSubscription(GetImapServerKey(), usingSubscription);
  // Pretend that the Trash folder doesn't exist, so we will rediscover it if we need to.
  m_hostSessionList->SetOnlineTrashFolderExistsForHost(GetImapServerKey(), false);

  // should we check a pref here, to be able to turn off XList?
  bool hasXLIST = GetServerStateParser().GetCapabilityFlag() & kHasXListCapability;
  if (hasXLIST && usingSubscription)
  {
    m_hierarchyNameState = kXListing;
    nsAutoCString pattern("%");
    List("%", true, true);
    // We list the first and second levels since special folders are unlikely
    // to be more than 2 levels deep.
    char separator = 0;
    m_runningUrl->GetOnlineSubDirSeparator(&separator);
    pattern.Append(separator);
    pattern += '%';
    List(pattern.get(), true, true);
  }

  SetMailboxDiscoveryStatus(eContinue);
  if (GetServerStateParser().ServerHasACLCapability())
    m_hierarchyNameState = kListingForInfoAndDiscovery;
  else
    m_hierarchyNameState = kNoOperationInProgress;

  // iterate through all namespaces and LSUB them.
  uint32_t count = 0;
  m_hostSessionList->GetNumberOfNamespacesForHost(GetImapServerKey(), count);
  for (uint32_t i = 0; i < count; i++ )
  {
    nsIMAPNamespace * ns = nullptr;
    m_hostSessionList->GetNamespaceNumberForHost(GetImapServerKey(),i,ns);
    if (ns)
    {
      const char *prefix = ns->GetPrefix();
      if (prefix)
      {
        // static bool gHideUnusedNamespaces = true;
        // mscott -> WARNING!!! i where are we going to get this
        // global variable for unused name spaces from???
        // dmb - we should get this from a per-host preference,
        // I'd say. But for now, just make it true;
        if (!gHideUnusedNamespaces && *prefix &&
                    PL_strcasecmp(prefix, "INBOX."))  // only do it for
                    // non-empty namespace prefixes, and for non-INBOX prefix
        {
          // Explicitly discover each Namespace, so that we can
                    // create subfolders of them,
          nsImapMailboxSpec *boxSpec = new nsImapMailboxSpec;
          if (boxSpec)
          {
            NS_ADDREF(boxSpec);
            boxSpec->mFolderSelected = false;
            boxSpec->mHostName = GetImapHostName();
            boxSpec->mConnection = this;
            boxSpec->mFlagState = nullptr;
            boxSpec->mDiscoveredFromLsub = true;
            boxSpec->mOnlineVerified = true;
            boxSpec->mBoxFlags = kNoselect;
            boxSpec->mHierarchySeparator = ns->GetDelimiter();
            // Until |AllocateCanonicalPath()| gets updated:
            m_runningUrl->AllocateCanonicalPath(
                            ns->GetPrefix(), ns->GetDelimiter(),
                            getter_Copies(boxSpec->mAllocatedPathName));
            boxSpec->mNamespaceForFolder = ns;
            boxSpec->mBoxFlags |= kNameSpace;

            switch (ns->GetType())
            {
            case kPersonalNamespace:
              boxSpec->mBoxFlags |= kPersonalMailbox;
              break;
            case kPublicNamespace:
              boxSpec->mBoxFlags |= kPublicMailbox;
              break;
            case kOtherUsersNamespace:
              boxSpec->mBoxFlags |= kOtherUsersMailbox;
              break;
            default:  // (kUnknownNamespace)
              break;
            }

            DiscoverMailboxSpec(boxSpec);
          }
          else
            HandleMemoryFailure();
        }

        // now do the folders within this namespace
        nsCString pattern;
        nsCString pattern2;
        if (usingSubscription)
        {
          pattern.Append(prefix);
          pattern.Append("*");
        }
        else
        {
          pattern.Append(prefix);
          pattern.Append("%"); // mscott just need one percent right?
          // pattern = PR_smprintf("%s%%", prefix);
          char delimiter = ns->GetDelimiter();
          if (delimiter)
          {
            // delimiter might be NIL, in which case there's no hierarchy anyway
            pattern2 = prefix;
            pattern2 += "%";
            pattern2 += delimiter;
            pattern2 += "%";
            // pattern2 = PR_smprintf("%s%%%c%%", prefix, delimiter);
          }
        }
        if (usingSubscription) { // && !GetSubscribingNow())  should never get here from subscribe pane
          if (GetServerStateParser().GetCapabilityFlag() & kHasListExtendedCapability)
            Lsub(pattern.get(), true); // do LIST (SUBSCRIBED)
          else {
            // store mailbox flags from LIST
            EMailboxHierarchyNameState currentState = m_hierarchyNameState;
            m_hierarchyNameState = kListingForFolderFlags;
            List(pattern.get(), false);
            m_hierarchyNameState = currentState;
            // then do LSUB using stored flags
            Lsub(pattern.get(), true);
            m_standardListMailboxes.Clear();
          }
        }
        else
        {
          List(pattern.get(), true, hasXLIST);
          List(pattern2.get(), true, hasXLIST);
        }
      }
    }
  }

  // explicitly LIST the INBOX if (a) we're not using subscription, or (b) we are using subscription and
  // the user wants us to always show the INBOX.
  bool listInboxForHost = false;
  m_hostSessionList->GetShouldAlwaysListInboxForHost(GetImapServerKey(), listInboxForHost);
  if (!usingSubscription || listInboxForHost)
    List("INBOX", true);

  m_hierarchyNameState = kNoOperationInProgress;

  MailboxDiscoveryFinished();

  // Get the ACLs for newly discovered folders
  if (GetServerStateParser().ServerHasACLCapability())
  {
    int32_t total = m_listedMailboxList.Count(), cnt = 0;
    // Let's not turn this off here, since we don't turn it on after
    // GetServerStateParser().SetReportingErrors(false);
    if (total)
    {
      ProgressEventFunctionUsingName("imapGettingACLForFolder");
      nsIMAPMailboxInfo * mb = nullptr;
      do
      {
        if (m_listedMailboxList.Count() == 0)
            break;

        mb = (nsIMAPMailboxInfo *) m_listedMailboxList[0]; // get top element
        m_listedMailboxList.RemoveElementAt(0); // XP_ListRemoveTopObject(fListedMailboxList);
        if (mb)
        {
          if (FolderNeedsACLInitialized(PromiseFlatCString(mb->GetMailboxName()).get()))
          {
            char *onlineName = nullptr;
            m_runningUrl->AllocateServerPath(PromiseFlatCString(mb->GetMailboxName()).get(),
                                             mb->GetDelimiter(), &onlineName);
            if (onlineName)
            {
              RefreshACLForFolder(onlineName);
              PR_Free(onlineName);
            }
          }
          PercentProgressUpdateEvent(NULL, cnt, total);
          delete mb;  // this is the last time we're using the list, so delete the entries here
          cnt++;
        }
      } while (mb && !DeathSignalReceived());
    }
  }
}

bool nsImapProtocol::FolderNeedsACLInitialized(const char *folderName)
{
  bool rv = false;
  m_imapServerSink->FolderNeedsACLInitialized(nsDependentCString(folderName), &rv);
  return rv;
}

void nsImapProtocol::MailboxDiscoveryFinished()
{
  if (!DeathSignalReceived() && !GetSubscribingNow() &&
    ((m_hierarchyNameState == kNoOperationInProgress) ||
    (m_hierarchyNameState == kListingForInfoAndDiscovery)))
  {
    nsIMAPNamespace *ns = nullptr;
    m_hostSessionList->GetDefaultNamespaceOfTypeForHost(GetImapServerKey(), kPersonalNamespace, ns);
    const char *personalDir = ns ? ns->GetPrefix() : 0;

    bool trashFolderExists = false;
    bool usingSubscription = false;
    m_hostSessionList->GetOnlineTrashFolderExistsForHost(GetImapServerKey(), trashFolderExists);
    m_hostSessionList->GetHostIsUsingSubscription(GetImapServerKey(),usingSubscription);
    if (!trashFolderExists && GetDeleteIsMoveToTrash() && usingSubscription)
    {
      // maybe we're not subscribed to the Trash folder
      if (personalDir)
      {
        nsCString originalTrashName(CreatePossibleTrashName(personalDir));
        m_hierarchyNameState = kDiscoverTrashFolderInProgress;
        List(originalTrashName.get(), true);
        m_hierarchyNameState = kNoOperationInProgress;
      }
    }

    // There is no Trash folder (either LIST'd or LSUB'd), and we're using the
    // Delete-is-move-to-Trash model, and there is a personal namespace
    if (!trashFolderExists && GetDeleteIsMoveToTrash() && ns)
    {
      nsCString trashName(CreatePossibleTrashName(ns->GetPrefix()));
      nsCString onlineTrashName;
      m_runningUrl->AllocateServerPath(trashName.get(), ns->GetDelimiter(),
                                       getter_Copies(onlineTrashName));

      GetServerStateParser().SetReportingErrors(false);
      bool created = CreateMailboxRespectingSubscriptions(onlineTrashName.get());
      GetServerStateParser().SetReportingErrors(true);

      // force discovery of new trash folder.
      if (created)
      {
        m_hierarchyNameState = kDiscoverTrashFolderInProgress;
        List(onlineTrashName.get(), false);
        m_hierarchyNameState = kNoOperationInProgress;
      }
      else
        m_hostSessionList->SetOnlineTrashFolderExistsForHost(GetImapServerKey(), true);
    } //if trash folder doesn't exist
    m_hostSessionList->SetHaveWeEverDiscoveredFoldersForHost(GetImapServerKey(), true);

    // notify front end that folder discovery is complete....
    if (m_imapServerSink)
      m_imapServerSink->DiscoveryDone();
  }
}

// returns the mailboxName with the IMAP delimiter removed from the tail end
void nsImapProtocol::RemoveHierarchyDelimiter(nsCString &mailboxName)
{
  char onlineDelimiter[2] = {0, 0};
  if (m_imapMailFolderSink)
    m_imapMailFolderSink->GetOnlineDelimiter(&onlineDelimiter[0]);
  // take the hierarchy delimiter off the end, if any.
  if (onlineDelimiter[0])
    mailboxName.Trim(onlineDelimiter, false, true);
}

// returns true is the create succeeded (regardless of subscription changes)
bool nsImapProtocol::CreateMailboxRespectingSubscriptions(const char *mailboxName)
{
  CreateMailbox(mailboxName);
  bool rv = GetServerStateParser().LastCommandSuccessful();
  if (rv && m_autoSubscribe) // auto-subscribe is on
  {
    // create succeeded - let's subscribe to it
    bool reportingErrors = GetServerStateParser().GetReportingErrors();
    GetServerStateParser().SetReportingErrors(false);
    nsCString mailboxWODelim(mailboxName);
    RemoveHierarchyDelimiter(mailboxWODelim);
    OnSubscribe(mailboxWODelim.get());
    GetServerStateParser().SetReportingErrors(reportingErrors);
  }
  return rv;
}

void nsImapProtocol::CreateMailbox(const char *mailboxName)
{
  ProgressEventFunctionUsingName("imapStatusCreatingMailbox");

  IncrementCommandTagNumber();

  nsCString escapedName;
  CreateEscapedMailboxName(mailboxName, escapedName);
  nsCString command(GetServerCommandTag());
  command += " create \"";
  command += escapedName;
  command += "\"" CRLF;

  nsresult rv = SendData(command.get());
  if(NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail();
  // If that failed, let's list the parent folder to see if
  // it allows inferiors, so we won't try to create sub-folders
  // of the parent folder again in the current session.
  if (GetServerStateParser().CommandFailed())
  {
    // Figure out parent folder name.
    nsCString parentName(mailboxName);
    char hierarchyDelimiter;
    m_runningUrl->GetOnlineSubDirSeparator(&hierarchyDelimiter);
    int32_t leafPos = parentName.RFindChar(hierarchyDelimiter);
    if (leafPos > 0)
    {
      parentName.SetLength(leafPos);
      List(parentName.get(), false);
      // We still want the caller to know the create failed, so restore that.
      GetServerStateParser().SetCommandFailed(true);
    }
  }
}

void nsImapProtocol::DeleteMailbox(const char *mailboxName)
{

  // check if this connection currently has the folder to be deleted selected.
  // If so, we should close it because at least some UW servers don't like you deleting
  // a folder you have open.
  if (FolderIsSelected(mailboxName))
    Close();


  ProgressEventFunctionUsingNameWithString("imapStatusDeletingMailbox", mailboxName);

    IncrementCommandTagNumber();

    nsCString escapedName;
    CreateEscapedMailboxName(mailboxName, escapedName);
    nsCString command(GetServerCommandTag());
    command += " delete \"";
    command += escapedName;
    command += "\"" CRLF;

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
        ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::RenameMailbox(const char *existingName,
                                   const char *newName)
{
  // just like DeleteMailbox; Some UW servers don't like it.
  if (FolderIsSelected(existingName))
    Close();

  ProgressEventFunctionUsingNameWithString("imapStatusRenamingMailbox", existingName);

  IncrementCommandTagNumber();

  nsCString escapedExistingName;
  nsCString escapedNewName;
  CreateEscapedMailboxName(existingName, escapedExistingName);
  CreateEscapedMailboxName(newName, escapedNewName);
  nsCString command(GetServerCommandTag());
  command += " rename \"";
  command += escapedExistingName;
  command += "\" \"";
  command += escapedNewName;
  command += "\"" CRLF;

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail();
}

nsCString nsImapProtocol::CreatePossibleTrashName(const char *prefix)
{
  nsCString returnTrash(prefix);
  returnTrash += m_trashFolderName;
  return returnTrash;
}

bool nsImapProtocol::GetListSubscribedIsBrokenOnServer()
{
  // This is a workaround for an issue with LIST(SUBSCRIBED) crashing older versions of Zimbra
  if (GetServerStateParser().GetServerID().Find("\"NAME\" \"Zimbra\"", CaseInsensitiveCompare) != kNotFound) {
    nsCString serverID(GetServerStateParser().GetServerID());
    int start = serverID.Find("\"VERSION\" \"", CaseInsensitiveCompare) + 11;
    int length = serverID.Find("\" ", start, CaseInsensitiveCompare);
    const nsDependentCSubstring serverVersionSubstring = Substring(serverID, start, length);
    nsCString serverVersionStr(serverVersionSubstring);
    Version serverVersion(serverVersionStr.get());
    Version sevenTwoThree("7.2.3_");
    Version eightZeroZero("8.0.0_");
    Version eightZeroThree("8.0.3_");
    if ((serverVersion < sevenTwoThree) ||
        ((serverVersion >= eightZeroZero) && (serverVersion < eightZeroThree)))
      return true;
  }
  return false;
}

void nsImapProtocol::Lsub(const char *mailboxPattern, bool addDirectoryIfNecessary)
{
  ProgressEventFunctionUsingName("imapStatusLookingForMailbox");

  IncrementCommandTagNumber();

  char *boxnameWithOnlineDirectory = nullptr;
  if (addDirectoryIfNecessary)
    m_runningUrl->AddOnlineDirectoryIfNecessary(mailboxPattern, &boxnameWithOnlineDirectory);

  nsCString escapedPattern;
  CreateEscapedMailboxName(boxnameWithOnlineDirectory ?
                        boxnameWithOnlineDirectory :
                        mailboxPattern, escapedPattern);

  nsCString command (GetServerCommandTag());
  if ((GetServerStateParser().GetCapabilityFlag() & kHasListExtendedCapability) &&
      !GetListSubscribedIsBrokenOnServer())
    command += " list (subscribed)";
  else
    command += " lsub";
  command += " \"\" \"";
  command += escapedPattern;
  command += "\"" CRLF;

  PR_Free(boxnameWithOnlineDirectory);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail(command.get(), true);
}

void nsImapProtocol::List(const char *mailboxPattern, bool addDirectoryIfNecessary,
                          bool useXLIST)
{
  ProgressEventFunctionUsingName("imapStatusLookingForMailbox");

  IncrementCommandTagNumber();

  char *boxnameWithOnlineDirectory = nullptr;
  if (addDirectoryIfNecessary)
    m_runningUrl->AddOnlineDirectoryIfNecessary(mailboxPattern, &boxnameWithOnlineDirectory);

  nsCString escapedPattern;
  CreateEscapedMailboxName(boxnameWithOnlineDirectory ?
                        boxnameWithOnlineDirectory :
                        mailboxPattern, escapedPattern);

  nsCString command (GetServerCommandTag());
  command += useXLIST ?
    " xlist \"\" \"" : " list \"\" \"";
  command += escapedPattern;
  command += "\"" CRLF;

  PR_Free(boxnameWithOnlineDirectory);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail(command.get(), true);
}

void nsImapProtocol::Subscribe(const char *mailboxName)
{
  ProgressEventFunctionUsingNameWithString("imapStatusSubscribeToMailbox", mailboxName);

  IncrementCommandTagNumber();

  nsCString escapedName;
  CreateEscapedMailboxName(mailboxName, escapedName);

  nsCString command (GetServerCommandTag());
  command += " subscribe \"";
  command += escapedName;
  command += "\"" CRLF;

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
    ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::Unsubscribe(const char *mailboxName)
{
  ProgressEventFunctionUsingNameWithString("imapStatusUnsubscribeMailbox", mailboxName);
  IncrementCommandTagNumber();

  nsCString escapedName;
  CreateEscapedMailboxName(mailboxName, escapedName);

  nsCString command (GetServerCommandTag());
  command += " unsubscribe \"";
  command += escapedName;
  command += "\"" CRLF;

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
      ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::Idle()
{
  IncrementCommandTagNumber();

  if (m_urlInProgress)
    return;
  nsAutoCString command (GetServerCommandTag());
  command += " IDLE" CRLF;
  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
  {
      m_idle = true;
      // we'll just get back a continuation char at first.
      // + idling...
      ParseIMAPandCheckForNewMail();
      // this will cause us to get notified of data or the socket getting closed.
      // That notification will occur on the socket transport thread - we just
      // need to poke a monitor so the imap thread will do a blocking read
      // and parse the data.
      nsCOMPtr <nsIAsyncInputStream> asyncInputStream = do_QueryInterface(m_inputStream);
      if (asyncInputStream)
        asyncInputStream->AsyncWait(this, 0, 0, nullptr);
  }
}

// until we can fix the hang on shutdown waiting for server
// responses, we need to not wait for the server response
// on shutdown.
void nsImapProtocol::EndIdle(bool waitForResponse /* = true */)
{
  // clear the async wait - otherwise, we seem to have trouble doing a blocking read
  nsCOMPtr <nsIAsyncInputStream> asyncInputStream = do_QueryInterface(m_inputStream);
  if (asyncInputStream)
    asyncInputStream->AsyncWait(nullptr, 0, 0, nullptr);
  nsresult rv = SendData("DONE" CRLF);
  // set a short timeout if we don't want to wait for a response
  if (m_transport && !waitForResponse)
    m_transport->SetTimeout(nsISocketTransport::TIMEOUT_READ_WRITE, 5);
  if (NS_SUCCEEDED(rv))
  {
    m_idle = false;
    ParseIMAPandCheckForNewMail();
  }
  m_imapMailFolderSink = nullptr;
}


void nsImapProtocol::Search(const char * searchCriteria,
                            bool useUID,
                            bool notifyHit /* true */)
{
  m_notifySearchHit = notifyHit;
  ProgressEventFunctionUsingName("imapStatusSearchMailbox");
  IncrementCommandTagNumber();

  nsCString protocolString(GetServerCommandTag());
  // the searchCriteria string contains the 'search ....' string
  if (useUID)
     protocolString.Append(" uid");
  protocolString.Append(" ");
  protocolString.Append(searchCriteria);
  // the search criteria can contain string literals, which means we
  // need to break up the protocol string by CRLF's, and after sending CRLF,
  // wait for the server to respond OK before sending more data
  nsresult rv;
  int32_t crlfIndex;
  while (crlfIndex = protocolString.Find(CRLF), crlfIndex != kNotFound && !DeathSignalReceived())
  {
    nsAutoCString tempProtocolString;
    tempProtocolString = StringHead(protocolString, crlfIndex + 2);
    rv = SendData(tempProtocolString.get());
    if (NS_FAILED(rv))
      return;
    ParseIMAPandCheckForNewMail();
    protocolString.Cut(0, crlfIndex + 2);
  }
  protocolString.Append(CRLF);

  rv = SendData(protocolString.get());
  if (NS_SUCCEEDED(rv))
     ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::Copy(const char * messageList,
                          const char *destinationMailbox,
                          bool idsAreUid)
{
  IncrementCommandTagNumber();

  nsCString escapedDestination;
  CreateEscapedMailboxName(destinationMailbox, escapedDestination);

  // turn messageList back into key array and then back into a message id list,
  // but use the flag state to handle ranges correctly.
  nsCString messageIdList;
  nsTArray<nsMsgKey> msgKeys;
  if (idsAreUid)
    ParseUidString(messageList, msgKeys);

  int32_t msgCountLeft = msgKeys.Length();
  uint32_t msgsHandled = 0;

  do
  {
    nsCString idString;

    uint32_t msgsToHandle = msgCountLeft;
    if (idsAreUid)
      AllocateImapUidString(msgKeys.Elements() + msgsHandled, msgsToHandle, m_flagState, idString);
    else
      idString.Assign(messageList);

    msgsHandled += msgsToHandle;
    msgCountLeft -= msgsToHandle;

    IncrementCommandTagNumber();
    nsAutoCString protocolString(GetServerCommandTag());
    if (idsAreUid)
      protocolString.Append(" uid");
    // If it's a MOVE operation on aol servers then use 'xaol-move' cmd.
    if ((m_imapAction == nsIImapUrl::nsImapOnlineMove) &&
        GetServerStateParser().ServerIsAOLServer())
      protocolString.Append(" xaol-move ");
    else if ((m_imapAction == nsIImapUrl::nsImapOnlineMove) &&
             GetServerStateParser().GetCapabilityFlag() & kHasMoveCapability)
      protocolString.Append(" move ");
    else
      protocolString.Append(" copy ");


    protocolString.Append(idString);
    protocolString.Append(" \"");
    protocolString.Append(escapedDestination);
    protocolString.Append("\"" CRLF);

    nsresult rv = SendData(protocolString.get());
    if (NS_SUCCEEDED(rv))
       ParseIMAPandCheckForNewMail(protocolString.get());
  }
  while (msgCountLeft > 0 && !DeathSignalReceived());
}

void nsImapProtocol::NthLevelChildList(const char* onlineMailboxPrefix,
                                       int32_t depth)
{
  NS_ASSERTION (depth >= 0,
                  "Oops ... depth must be equal or greater than 0");
  if (depth < 0) return;

  nsCString truncatedPrefix (onlineMailboxPrefix);
  PRUnichar slash = '/';
  if (truncatedPrefix.Last() == slash)
        truncatedPrefix.SetLength(truncatedPrefix.Length()-1);

  nsAutoCString pattern(truncatedPrefix);
  nsAutoCString suffix;
  int count = 0;
  char separator = 0;
  m_runningUrl->GetOnlineSubDirSeparator(&separator);
  suffix.Assign(separator);
  suffix += '%';

  while (count < depth)
  {
      pattern += suffix;
      count++;
      List(pattern.get(), false);
  }
}

void nsImapProtocol::ProcessAuthenticatedStateURL()
{
  nsImapAction imapAction;
  char * sourceMailbox = nullptr;
  m_runningUrl->GetImapAction(&imapAction);

  // switch off of the imap url action and take an appropriate action
  switch (imapAction)
  {
    case nsIImapUrl::nsImapLsubFolders:
      OnLSubFolders();
      break;
    case nsIImapUrl::nsImapAppendMsgFromFile:
      OnAppendMsgFromFile();
      break;
    case nsIImapUrl::nsImapDiscoverAllBoxesUrl:
      NS_ASSERTION (!GetSubscribingNow(),
                      "Oops ... should not get here from subscribe UI");
      DiscoverMailboxList();
      break;
    case nsIImapUrl::nsImapDiscoverAllAndSubscribedBoxesUrl:
      DiscoverAllAndSubscribedBoxes();
      break;
    case nsIImapUrl::nsImapCreateFolder:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnCreateFolder(sourceMailbox);
      break;
    case nsIImapUrl::nsImapEnsureExistsFolder:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnEnsureExistsFolder(sourceMailbox);
      break;
    case nsIImapUrl::nsImapDiscoverChildrenUrl:
      {
        char *canonicalParent = nullptr;
        m_runningUrl->CreateServerSourceFolderPathString(&canonicalParent);
        if (canonicalParent)
        {
          NthLevelChildList(canonicalParent, 2);
          PR_Free(canonicalParent);
        }
        break;
      }
    case nsIImapUrl::nsImapSubscribe:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnSubscribe(sourceMailbox); // used to be called subscribe

      if (GetServerStateParser().LastCommandSuccessful())
      {
        bool shouldList;
        // if url is an external click url, then we should list the folder
        // after subscribing to it, so we can select it.
        m_runningUrl->GetExternalLinkUrl(&shouldList);
        if (shouldList)
          OnListFolder(sourceMailbox, true);
      }
      break;
    case nsIImapUrl::nsImapUnsubscribe:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnUnsubscribe(sourceMailbox);
      break;
    case nsIImapUrl::nsImapRefreshACL:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      RefreshACLForFolder(sourceMailbox);
      break;
    case nsIImapUrl::nsImapRefreshAllACLs:
      OnRefreshAllACLs();
      break;
    case nsIImapUrl::nsImapListFolder:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnListFolder(sourceMailbox, false);
      break;
    case nsIImapUrl::nsImapFolderStatus:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnStatusForFolder(sourceMailbox);
      break;
    case nsIImapUrl::nsImapRefreshFolderUrls:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      XMailboxInfo(sourceMailbox);
      if (GetServerStateParser().LastCommandSuccessful())
        SetFolderAdminUrl(sourceMailbox);
      break;
    case nsIImapUrl::nsImapDeleteFolder:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnDeleteFolder(sourceMailbox);
      break;
    case nsIImapUrl::nsImapRenameFolder:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnRenameFolder(sourceMailbox);
      break;
    case nsIImapUrl::nsImapMoveFolderHierarchy:
      sourceMailbox = OnCreateServerSourceFolderPathString();
      OnMoveFolderHierarchy(sourceMailbox);
      break;
    case nsIImapUrl::nsImapVerifylogon:
      break;
    default:
      break;
  }
  PR_Free(sourceMailbox);
}

void nsImapProtocol::ProcessAfterAuthenticated()
{
  // if we're a netscape server, and we haven't got the admin url, get it
  bool hasAdminUrl = true;

  if (NS_SUCCEEDED(m_hostSessionList->GetHostHasAdminURL(GetImapServerKey(), hasAdminUrl))
    && !hasAdminUrl)
  {
    if (GetServerStateParser().ServerHasServerInfo())
    {
      XServerInfo();
      if (GetServerStateParser().LastCommandSuccessful() && m_imapServerSink)
      {
        m_imapServerSink->SetMailServerUrls(GetServerStateParser().GetMailAccountUrl(),
          GetServerStateParser().GetManageListsUrl(),
          GetServerStateParser().GetManageFiltersUrl());
        // we've tried to ask for it, so don't try again this session.
        m_hostSessionList->SetHostHasAdminURL(GetImapServerKey(), true);
      }
    }
    else if (GetServerStateParser().ServerIsNetscape3xServer())
    {
      Netscape();
      if (GetServerStateParser().LastCommandSuccessful() && m_imapServerSink)
        m_imapServerSink->SetMailServerUrls(GetServerStateParser().GetMailAccountUrl(),
                                            EmptyCString(), EmptyCString());
    }
  }

  if (GetServerStateParser().ServerHasNamespaceCapability())
  {
    bool nameSpacesOverridable = false;
    bool haveNameSpacesForHost = false;
    m_hostSessionList->GetNamespacesOverridableForHost(GetImapServerKey(), nameSpacesOverridable);
    m_hostSessionList->GetGotNamespacesForHost(GetImapServerKey(), haveNameSpacesForHost);

  // mscott: VERIFY THIS CLAUSE!!!!!!!
    if (nameSpacesOverridable && !haveNameSpacesForHost)
      Namespace();
  }

  // If the server supports compression, turn it on now.
  // Choosing this spot (after login has finished) because
  // many proxies (e.g. perdition, nginx) talk IMAP to the
  // client until login is finished, then hand off to the
  // backend.  If we enable compression early the proxy
  // will be confused.
  if (UseCompressDeflate())
    StartCompressDeflate();

  if ((GetServerStateParser().GetCapabilityFlag() & kHasEnableCapability) &&
       UseCondStore())
    EnableCondStore();
  if ((GetServerStateParser().GetCapabilityFlag() & kHasIDCapability) &&
       m_sendID)
  {
    ID();
    if (m_imapServerSink && !GetServerStateParser().GetServerID().IsEmpty())
      m_imapServerSink->SetServerID(GetServerStateParser().GetServerID());
  }
}

void nsImapProtocol::SetupMessageFlagsString(nsCString& flagString,
                                             imapMessageFlagsType flags,
                                             uint16_t userFlags)
{
    if (flags & kImapMsgSeenFlag)
        flagString.Append("\\Seen ");
    if (flags & kImapMsgAnsweredFlag)
        flagString.Append("\\Answered ");
    if (flags & kImapMsgFlaggedFlag)
        flagString.Append("\\Flagged ");
    if (flags & kImapMsgDeletedFlag)
        flagString.Append("\\Deleted ");
    if (flags & kImapMsgDraftFlag)
        flagString.Append("\\Draft ");
    if (flags & kImapMsgRecentFlag)
        flagString.Append("\\Recent ");
    if ((flags & kImapMsgForwardedFlag) &&
        (userFlags & kImapMsgSupportForwardedFlag))
        flagString.Append("$Forwarded "); // Not always available
    if ((flags & kImapMsgMDNSentFlag) && (
        userFlags & kImapMsgSupportMDNSentFlag))
        flagString.Append("$MDNSent "); // Not always available

    // eat the last space
    if (!flagString.IsEmpty())
        flagString.SetLength(flagString.Length()-1);
}

void nsImapProtocol::ProcessStoreFlags(const nsCString &messageIdsString,
                                                 bool idsAreUids,
                                                 imapMessageFlagsType flags,
                                                 bool addFlags)
{
  nsCString flagString;

  uint16_t userFlags = GetServerStateParser().SupportsUserFlags();
  uint16_t settableFlags = GetServerStateParser().SettablePermanentFlags();

  if (!addFlags && (flags & userFlags) && !(flags & settableFlags))
  {
    if (m_runningUrl)
      m_runningUrl->SetExtraStatus(nsIImapUrl::ImapStatusFlagsNotSettable);
    return;         // if cannot set any of the flags bail out
  }

  if (addFlags)
      flagString = "+Flags (";
  else
      flagString = "-Flags (";

  if (flags & kImapMsgSeenFlag && kImapMsgSeenFlag & settableFlags)
      flagString .Append("\\Seen ");
  if (flags & kImapMsgAnsweredFlag && kImapMsgAnsweredFlag & settableFlags)
      flagString .Append("\\Answered ");
  if (flags & kImapMsgFlaggedFlag && kImapMsgFlaggedFlag & settableFlags)
      flagString .Append("\\Flagged ");
  if (flags & kImapMsgDeletedFlag && kImapMsgDeletedFlag & settableFlags)
      flagString .Append("\\Deleted ");
  if (flags & kImapMsgDraftFlag && kImapMsgDraftFlag & settableFlags)
      flagString .Append("\\Draft ");
  if (flags & kImapMsgForwardedFlag && kImapMsgSupportForwardedFlag & userFlags)
        flagString .Append("$Forwarded ");  // if supported
  if (flags & kImapMsgMDNSentFlag && kImapMsgSupportMDNSentFlag & userFlags)
        flagString .Append("$MDNSent ");  // if supported

  if (flagString.Length() > 8) // if more than "+Flags ("
  {
  // replace the final space with ')'
    flagString.SetCharAt(')',flagString.Length() - 1);

    Store(messageIdsString, flagString.get(), idsAreUids);
    if (m_runningUrl && idsAreUids)
    {
      nsCString messageIdString;
      m_runningUrl->GetListOfMessageIds(messageIdString);
      nsTArray<nsMsgKey> msgKeys;
      ParseUidString(messageIdString.get(), msgKeys);

      int32_t msgCount = msgKeys.Length();
      for (int32_t i = 0; i < msgCount; i++)
      {
        bool found;
        imapMessageFlagsType resultFlags;
      // check if the flags were added/removed, and if the uid really exists.
        nsresult rv = GetFlagsForUID(msgKeys[i], &found, &resultFlags, nullptr);
        if (NS_FAILED(rv) || !found ||
           (addFlags && ((flags & resultFlags) != flags)) ||
           (!addFlags && ((flags & resultFlags) != 0)))
        {
          m_runningUrl->SetExtraStatus(nsIImapUrl::ImapStatusFlagChangeFailed);
          break;
        }
      }

    }
  }
}


void nsImapProtocol::Close(bool shuttingDown /* = false */,
                           bool waitForResponse /* = true */)
{
  IncrementCommandTagNumber();

  nsCString command(GetServerCommandTag());
  command.Append(" close" CRLF);

  if (!shuttingDown)
    ProgressEventFunctionUsingName("imapStatusCloseMailbox");

  GetServerStateParser().ResetFlagInfo();

  nsresult rv = SendData(command.get());
  if (m_transport && shuttingDown)
    m_transport->SetTimeout(nsISocketTransport::TIMEOUT_READ_WRITE, 5);

  if (NS_SUCCEEDED(rv) && waitForResponse)
      ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::XAOL_Option(const char *option)
{
  IncrementCommandTagNumber();

  nsCString command(GetServerCommandTag());
  command.Append(" XAOL-OPTION ");
  command.Append(option);
  command.Append(CRLF);

  nsresult rv = SendData(command.get());
  if (NS_SUCCEEDED(rv))
      ParseIMAPandCheckForNewMail();
}

void nsImapProtocol::Check()
{
    //ProgressUpdateEvent("Checking mailbox...");

    IncrementCommandTagNumber();

  nsCString command(GetServerCommandTag());
  command.Append(" check" CRLF);

    nsresult rv = SendData(command.get());
    if (NS_SUCCEEDED(rv))
    {
        m_flagChangeCount = 0;
        m_lastCheckTime = PR_Now();
        ParseIMAPandCheckForNewMail();
    }
}

nsresult nsImapProtocol::GetMsgWindow(nsIMsgWindow **aMsgWindow)
{
  nsresult rv;
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl =
      do_QueryInterface(m_runningUrl, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  if (!m_imapProtocolSink)
    return NS_ERROR_FAILURE;
  return m_imapProtocolSink->GetUrlWindow(mailnewsUrl, aMsgWindow);
}

/**
 * Get password from RAM, disk (password manager) or user (dialog)
 * @return NS_MSG_PASSWORD_PROMPT_CANCELLED
 *    (which is NS_SUCCEEDED!) when user cancelled
 *    NS_FAILED(rv) for other errors
 */
nsresult nsImapProtocol::GetPassword(nsCString &password,
                                     bool newPasswordRequested)
{
  // we are in the imap thread so *NEVER* try to extract the password with UI
  // if logon redirection has changed the password, use the cookie as the password
  if (m_overRideUrlConnectionInfo)
  {
    password.Assign(m_logonCookie);
    return NS_OK;
  }

  NS_ENSURE_TRUE(m_imapServerSink, NS_ERROR_NULL_POINTER);
  NS_ENSURE_TRUE(m_server, NS_ERROR_NULL_POINTER);
  nsresult rv;
  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryReferent(m_server, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Get the password already stored in mem
  rv = server->GetPassword(password);
  if (NS_FAILED(rv) || password.IsEmpty())
  {
    nsCOMPtr<nsIMsgWindow> msgWindow;
    GetMsgWindow(getter_AddRefs(msgWindow));
    NS_ENSURE_TRUE(msgWindow, NS_ERROR_NOT_AVAILABLE); // biff case

    // Get the password from pw manager (harddisk) or user (dialog)
    nsAutoCString pwd; // GetPasswordWithUI truncates the password on Cancel
    rv = m_imapServerSink->AsyncGetPassword(this,
                                                     newPasswordRequested,
                                                     password);
    if (password.IsEmpty())
    {
      PRIntervalTime sleepTime = kImapSleepTime;
      m_passwordStatus = NS_OK;
      ReentrantMonitorAutoEnter mon(m_passwordReadyMonitor);
      while (m_password.IsEmpty() && !NS_FAILED(m_passwordStatus) &&
             m_passwordStatus != NS_MSG_PASSWORD_PROMPT_CANCELLED &&
             !DeathSignalReceived())
        mon.Wait(sleepTime);
      rv = m_passwordStatus;
      password = m_password;
    }
  }
  if (!password.IsEmpty())
    m_lastPasswordSent = password;
  return rv;
}

// This is called from the UI thread.
NS_IMETHODIMP
nsImapProtocol::OnPromptStart(bool *aResult)
{
  nsresult rv;
  nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryReferent(m_server, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgWindow> msgWindow;

  *aResult = false;
  GetMsgWindow(getter_AddRefs(msgWindow));
  nsCString password = m_lastPasswordSent;
  rv = imapServer->PromptPassword(msgWindow, password);
  m_password = password;
  m_passwordStatus = rv;
  if (!m_password.IsEmpty())
    *aResult = true;

  // Notify the imap thread that we have a password.
  ReentrantMonitorAutoEnter passwordMon(m_passwordReadyMonitor);
  passwordMon.Notify();
  return rv;
}

NS_IMETHODIMP
nsImapProtocol::OnPromptAuthAvailable()
{
  nsresult rv;
  nsCOMPtr<nsIMsgIncomingServer> imapServer = do_QueryReferent(m_server, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  m_passwordStatus = imapServer->GetPassword(m_password);
  // Notify the imap thread that we have a password.
  ReentrantMonitorAutoEnter passwordMon(m_passwordReadyMonitor);
  passwordMon.Notify();
  return m_passwordStatus;
}

NS_IMETHODIMP
nsImapProtocol::OnPromptCanceled()
{
  // A prompt was cancelled, so notify the imap thread.
  m_passwordStatus = NS_MSG_PASSWORD_PROMPT_CANCELLED;
  ReentrantMonitorAutoEnter passwordMon(m_passwordReadyMonitor);
  passwordMon.Notify();
  return NS_OK;
}

bool nsImapProtocol::TryToLogon()
{
  PR_LOG(IMAP, PR_LOG_DEBUG, ("try to log in"));
  NS_ENSURE_TRUE(m_imapServerSink, false);
  bool loginSucceeded = false;
  bool skipLoop = false;
  nsAutoCString password;
  nsAutoCString userName;

  nsresult rv = ChooseAuthMethod();
  if (NS_FAILED(rv)) // all methods failed
  {
    // are there any matching login schemes at all?
    if (!(GetServerStateParser().GetCapabilityFlag() & m_prefAuthMethods))
    {
      // Pref doesn't match server. Now, find an appropriate error msg.

      // pref has plaintext pw & server claims to support encrypted pw
      if (m_prefAuthMethods == (kHasAuthOldLoginCapability |
              kHasAuthLoginCapability | kHasAuthPlainCapability) &&
          GetServerStateParser().GetCapabilityFlag() & kHasCRAMCapability)
        // tell user to change to encrypted pw
        AlertUserEventUsingName("imapAuthChangePlainToEncrypt");
      // pref has encrypted pw & server claims to support plaintext pw
      else if (m_prefAuthMethods == kHasCRAMCapability &&
               GetServerStateParser().GetCapabilityFlag() &
                   (kHasAuthOldLoginCapability | kHasAuthLoginCapability |
                    kHasAuthPlainCapability))
      {
        // have SSL
        if (m_socketType == nsMsgSocketType::SSL ||
            m_socketType == nsMsgSocketType::alwaysSTARTTLS)
          // tell user to change to plaintext pw
          AlertUserEventUsingName("imapAuthChangeEncryptToPlainSSL");
        else
          // tell user to change to plaintext pw, with big warning
          AlertUserEventUsingName("imapAuthChangeEncryptToPlainNoSSL");
      }
      else
        // just "change auth method"
        AlertUserEventUsingName("imapAuthMechNotSupported");

      skipLoop = true;
    }
    else
    {
      // try to reset failed methods and try them again
      ResetAuthMethods();
      rv = ChooseAuthMethod();
      if (NS_FAILED(rv)) // all methods failed
      {
        PR_LOG(IMAP, PR_LOG_ERROR, ("huch? there are auth methods, and we resetted failed ones, but ChooseAuthMethod still fails."));
        return false;
      }
    }
  }

  // Get username, either the stored one or from user
  rv = m_imapServerSink->GetLoginUsername(userName);
  if (NS_FAILED(rv) || userName.IsEmpty())
  {
    // The user hit "Cancel" on the dialog box
    skipLoop = true;
  }

  /*
   * Login can fail for various reasons:
   * 1. Server claims to support GSSAPI, but it really doesn't.
   *    Or the client doesn't support GSSAPI, or is not logged in yet.
   *    (GSSAPI is a mechanism without password in apps).
   * 2. Server claims to support CRAM-MD5, but it's broken and will fail despite correct password.
   * 2.1. Some servers say they support CRAM but are so badly broken that trying it causes
   *    all subsequent login attempts to fail during this connection (bug 231303).
   *    So we use CRAM/NTLM/MSN only if enabled in prefs.
   *    Update: if it affects only some ISPs, we can maybe use the ISP DB
   *    and disable CRAM specifically for these.
   * 3. Prefs are set to require auth methods which the server doesn't support
   *     (per CAPS or we tried and they failed).
   * 4. User provided wrong password.
   * 5. We tried too often and the server shut us down, so even a correct attempt
   *    will now (currently) fail.
   * The above problems may overlap, e.g. 3. with 1. and 2., and we can't differentiate
   * between 2. and 4., which is really unfortunate.
   */

  bool newPasswordRequested = false;
  // remember the msgWindow before we start trying to logon, because if the
  // server drops the connection on errors, TellThreadToDie will null out the
  // protocolsink and we won't be able to get the msgWindow.
  nsCOMPtr<nsIMsgWindow> msgWindow;
  GetMsgWindow(getter_AddRefs(msgWindow));

  // This loops over 1) auth methods (only one per loop) and 2) password tries (with UI)
  while (!loginSucceeded && !skipLoop && !DeathSignalReceived())
  {
      // Get password
      if (m_currentAuthMethod != kHasAuthGssApiCapability && // GSSAPI uses no pw in apps
          m_currentAuthMethod != kHasAuthExternalCapability &&
          m_currentAuthMethod != kHasAuthNoneCapability)
      {
          rv = GetPassword(password, newPasswordRequested);
          newPasswordRequested = false;
          if (rv == NS_MSG_PASSWORD_PROMPT_CANCELLED || NS_FAILED(rv))
          {
            PR_LOG(IMAP, PR_LOG_ERROR, ("IMAP: password prompt failed or user canceled it"));
            break;
          }
          PR_LOG(IMAP, PR_LOG_DEBUG, ("got new password"));
      }

      bool lastReportingErrors = GetServerStateParser().GetReportingErrors();
      GetServerStateParser().SetReportingErrors(false); // turn off errors - we'll put up our own.

      rv = AuthLogin(userName.get(), password, m_currentAuthMethod);

      GetServerStateParser().SetReportingErrors(lastReportingErrors); // restore error reports
      loginSucceeded = NS_SUCCEEDED(rv);

      if (!loginSucceeded)
      {
        PR_LOG(IMAP, PR_LOG_DEBUG, ("authlogin failed"));
        MarkAuthMethodAsFailed(m_currentAuthMethod);
        rv = ChooseAuthMethod(); // change m_currentAuthMethod to try other one next round

        if (NS_FAILED(rv)) // all methods failed
        {
          if (m_prefAuthMethods == kHasAuthGssApiCapability)
          {
            // GSSAPI failed, and it's the only available method,
            // and it's password-less, so nothing left to do.
            AlertUserEventUsingName("imapAuthGssapiFailed");
            break;
          }

          // The reason that we failed might be a wrong password, so
          // ask user what to do
          PR_LOG(IMAP, PR_LOG_WARN, ("IMAP: ask user what to do (after login failed): new passwort, retry, cancel"));
          if (!m_imapServerSink)
            break;
          // if there's no msg window, don't forget the password
          if (!msgWindow)
            break;
          int32_t buttonPressed = 1;
          rv = m_imapServerSink->PromptLoginFailed(msgWindow,
                                                    &buttonPressed);
          if (NS_FAILED(rv))
            break;
          if (buttonPressed == 2) // 'New password' button
          {
            PR_LOG(IMAP, PR_LOG_WARN, ("new password button pressed."));
            // Forget the current password
            password.Truncate();
            m_hostSessionList->SetPasswordForHost(GetImapServerKey(), nullptr);
            m_imapServerSink->ForgetPassword();
            m_password.Truncate();
            PR_LOG(IMAP, PR_LOG_WARN, ("password resetted (nulled)"));
            newPasswordRequested = true;
            // Will call GetPassword() in beginning of next loop

            // Try all possible auth methods again with the new password.
            ResetAuthMethods();
          }
          else if (buttonPressed == 0) // Retry button
          {
            PR_LOG(IMAP, PR_LOG_WARN, ("retry button pressed"));
            // Try all possible auth methods again
            ResetAuthMethods();
          }
          else if (buttonPressed == 1) // Cancel button
          {
            PR_LOG(IMAP, PR_LOG_WARN, ("cancel button pressed"));
            break; // Abort quickly
          }

          // TODO what is this for? When does it get set to != unknown again?
          m_currentBiffState = nsIMsgFolder::nsMsgBiffState_Unknown;
          SendSetBiffIndicatorEvent(m_currentBiffState);
        } // all methods failed
      } // login failed
  } // while

  if (loginSucceeded)
  {
    PR_LOG(IMAP, PR_LOG_DEBUG, ("login succeeded"));
    bool passwordAlreadyVerified;
    m_hostSessionList->SetPasswordForHost(GetImapServerKey(), password.get());
    rv = m_hostSessionList->GetPasswordVerifiedOnline(GetImapServerKey(), passwordAlreadyVerified);
    if (NS_SUCCEEDED(rv) && !passwordAlreadyVerified)
      m_hostSessionList->SetPasswordVerifiedOnline(GetImapServerKey());
    bool imapPasswordIsNew = !passwordAlreadyVerified;
    if (imapPasswordIsNew)
    {
      if (m_currentBiffState == nsIMsgFolder::nsMsgBiffState_Unknown)
      {
          m_currentBiffState = nsIMsgFolder::nsMsgBiffState_NoMail;
          SendSetBiffIndicatorEvent(m_currentBiffState);
      }
      m_imapServerSink->SetUserAuthenticated(true);
    }

    nsImapAction imapAction;
    m_runningUrl->GetImapAction(&imapAction);
    // We don't want to do any more processing if we're just
    // verifying the ability to logon because it can leave us in
    // a half-constructed state.
    if (imapAction != nsIImapUrl::nsImapVerifylogon)
      ProcessAfterAuthenticated();
  }
  else // login failed
  {
    PR_LOG(IMAP, PR_LOG_ERROR, ("login failed entirely"));
    m_currentBiffState = nsIMsgFolder::nsMsgBiffState_Unknown;
    SendSetBiffIndicatorEvent(m_currentBiffState);
    HandleCurrentUrlError();
    SetConnectionStatus(NS_ERROR_FAILURE); // stop netlib
  }

  return loginSucceeded;
}

void nsImapProtocol::UpdateFolderQuotaData(nsCString& aQuotaRoot, uint32_t aUsed, uint32_t aMax)
{
  NS_ASSERTION(m_imapMailFolderSink, "m_imapMailFolderSink is null!");

  m_imapMailFolderSink->SetFolderQuotaData(aQuotaRoot, aUsed, aMax);
}

void nsImapProtocol::GetQuotaDataIfSupported(const char *aBoxName)
{
  // If server doesn't have quota support, don't do anything
  if (! (GetServerStateParser().GetCapabilityFlag() & kQuotaCapability))
    return;

  // If it's an aol server then only issue cmd for INBOX (since all
  // other AOL mailboxes are virtual and don't support all imap cmds).
  nsresult rv;
  nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryReferent(m_server, &rv);
  if (NS_FAILED(rv))
    return;

  nsCString escapedName;
  CreateEscapedMailboxName(aBoxName, escapedName);

  IncrementCommandTagNumber();

  nsAutoCString quotacommand(GetServerCommandTag());
  quotacommand.Append(NS_LITERAL_CSTRING(" getquotaroot \""));
  quotacommand.Append(escapedName);
  quotacommand.Append(NS_LITERAL_CSTRING("\"" CRLF));

  NS_ASSERTION(m_imapMailFolderSink, "m_imapMailFolderSink is null!");
  if (m_imapMailFolderSink)
    m_imapMailFolderSink->SetFolderQuotaCommandIssued(true);

  nsresult quotarv = SendData(quotacommand.get());
  if (NS_SUCCEEDED(quotarv))
    ParseIMAPandCheckForNewMail(nullptr, true); // don't display errors.
}

bool
nsImapProtocol::GetDeleteIsMoveToTrash()
{
    bool rv = false;
    NS_ASSERTION (m_hostSessionList, "fatal... null host session list");
    if (m_hostSessionList)
        m_hostSessionList->GetDeleteIsMoveToTrashForHost(GetImapServerKey(), rv);
    return rv;
}

bool
nsImapProtocol::GetShowDeletedMessages()
{
    bool rv = false;
    if (m_hostSessionList)
        m_hostSessionList->GetShowDeletedMessagesForHost(GetImapServerKey(), rv);
    return rv;
}

NS_IMETHODIMP nsImapProtocol::OverrideConnectionInfo(const PRUnichar *pHost, uint16_t pPort, const char *pCookieData)
{
  m_logonHost = NS_LossyConvertUTF16toASCII(pHost);
  m_logonPort = pPort;
  m_logonCookie = pCookieData;
  m_overRideUrlConnectionInfo = true;
  return NS_OK;
}

bool nsImapProtocol::CheckNeeded()
{
  if (m_flagChangeCount >= kFlagChangesBeforeCheck)
    return true;

  int32_t deltaInSeconds;

  PRTime2Seconds(PR_Now() - m_lastCheckTime, &deltaInSeconds);

  return (deltaInSeconds >= kMaxSecondsBeforeCheck);
}

bool nsImapProtocol::UseCondStore()
{
  // Check that the server is capable of cond store, and the user
  // hasn't disabled the use of constore for this server.
  return m_useCondStore &&
         GetServerStateParser().GetCapabilityFlag() & kHasCondStoreCapability &&
         GetServerStateParser().fUseModSeq;
}

bool nsImapProtocol::UseCompressDeflate()
{
  // Check that the server is capable of compression, and the user
  // hasn't disabled the use of compression for this server.
  return m_useCompressDeflate &&
         GetServerStateParser().GetCapabilityFlag() & kHasCompressDeflateCapability;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// The following is the implementation of nsImapMockChannel and an intermediary
// imap steam listener. The stream listener is used to make a clean binding between the
// imap mock channel and the memory cache channel (if we are reading from the cache)
//////////////////////////////////////////////////////////////////////////////////////////////

// WARNING: the cache stream listener is intended to be accessed from the UI thread!
// it will NOT create another proxy for the stream listener that gets passed in...
class nsImapCacheStreamListener : public nsIStreamListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSISTREAMLISTENER

  nsImapCacheStreamListener ();
  virtual ~nsImapCacheStreamListener();

  nsresult Init(nsIStreamListener * aStreamListener, nsIImapMockChannel * aMockChannelToUse);
protected:
  nsCOMPtr<nsIImapMockChannel> mChannelToUse;
  nsCOMPtr<nsIStreamListener> mListener;
};

NS_IMPL_ADDREF(nsImapCacheStreamListener)
NS_IMPL_RELEASE(nsImapCacheStreamListener)

NS_INTERFACE_MAP_BEGIN(nsImapCacheStreamListener)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIStreamListener)
  NS_INTERFACE_MAP_ENTRY(nsIRequestObserver)
  NS_INTERFACE_MAP_ENTRY(nsIStreamListener)
NS_INTERFACE_MAP_END

nsImapCacheStreamListener::nsImapCacheStreamListener()
{
}

nsImapCacheStreamListener::~nsImapCacheStreamListener()
{}

nsresult nsImapCacheStreamListener::Init(nsIStreamListener * aStreamListener, nsIImapMockChannel * aMockChannelToUse)
{
  NS_ENSURE_ARG(aStreamListener);
  NS_ENSURE_ARG(aMockChannelToUse);

  mChannelToUse = aMockChannelToUse;
  mListener = aStreamListener;

  return NS_OK;
}

NS_IMETHODIMP
nsImapCacheStreamListener::OnStartRequest(nsIRequest *request, nsISupports * aCtxt)
{
  if (!mChannelToUse)
  {
    NS_ERROR("OnStartRequest called after OnStopRequest");
    return NS_ERROR_NULL_POINTER;
  }
  nsCOMPtr<nsILoadGroup> loadGroup;
  mChannelToUse->GetLoadGroup(getter_AddRefs(loadGroup));
  nsCOMPtr<nsIRequest> ourRequest = do_QueryInterface(mChannelToUse);
  if (loadGroup)
    loadGroup->AddRequest(ourRequest, nullptr /* context isupports */);
  return mListener->OnStartRequest(ourRequest, aCtxt);
}

NS_IMETHODIMP
nsImapCacheStreamListener::OnStopRequest(nsIRequest *request, nsISupports * aCtxt, nsresult aStatus)
{
  if (!mListener)
  {
    NS_ERROR("OnStopRequest called twice");
    return NS_ERROR_NULL_POINTER;
  }
  nsresult rv = mListener->OnStopRequest(mChannelToUse, aCtxt, aStatus);
  nsCOMPtr <nsILoadGroup> loadGroup;
  mChannelToUse->GetLoadGroup(getter_AddRefs(loadGroup));
  if (loadGroup)
    loadGroup->RemoveRequest(mChannelToUse, nullptr, aStatus);

  mListener = nullptr;
  mChannelToUse->Close();
  mChannelToUse = nullptr;
  return rv;
}

NS_IMETHODIMP
nsImapCacheStreamListener::OnDataAvailable(nsIRequest *request, nsISupports * aCtxt, nsIInputStream * aInStream, uint64_t aSourceOffset, uint32_t aCount)
{
  return mListener->OnDataAvailable(mChannelToUse, aCtxt, aInStream, aSourceOffset, aCount);
}

NS_IMPL_ISUPPORTS6(nsImapMockChannel, nsIImapMockChannel, nsIChannel,
  nsIRequest, nsICacheListener, nsITransportEventSink, nsISupportsWeakReference)


nsImapMockChannel::nsImapMockChannel()
{
  m_channelContext = nullptr;
  m_cancelStatus = NS_OK;
  mLoadFlags = 0;
  mChannelClosed = false;
  mReadingFromCache = false;
  mTryingToReadPart = false;
}

nsImapMockChannel::~nsImapMockChannel()
{
  // if we're offline, we may not get to close the channel correctly.
  // we need to do this to send the url state change notification in
  // the case of mem and disk cache reads.
  NS_WARN_IF_FALSE(NS_IsMainThread(), "should only access mock channel on ui thread");
  if (!mChannelClosed)
    Close();
}

nsresult nsImapMockChannel::NotifyStartEndReadFromCache(bool start)
{
  nsresult rv = NS_OK;
  mReadingFromCache = start;
  nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(m_url, &rv);
  nsCOMPtr<nsIImapProtocol> imapProtocol = do_QueryReferent(m_protocol);
  if (imapUrl)
  {
    nsCOMPtr<nsIImapMailFolderSink> folderSink;
    rv = imapUrl->GetImapMailFolderSink(getter_AddRefs(folderSink));
    if (folderSink)
    {
      nsCOMPtr<nsIMsgMailNewsUrl> mailUrl = do_QueryInterface(m_url);
      rv = folderSink->SetUrlState(nullptr /* we don't know the protocol */,
                                   mailUrl, start, false, m_cancelStatus);

      // Required for killing ImapProtocol thread
      if (NS_FAILED(m_cancelStatus) && imapProtocol)
        imapProtocol->TellThreadToDie(false);
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapMockChannel::Close()
{
  if (mReadingFromCache)
    NotifyStartEndReadFromCache(false);
  else
  {
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url);
    if (mailnewsUrl)
    {
      nsCOMPtr<nsICacheEntryDescriptor>  cacheEntry;
      mailnewsUrl->GetMemCacheEntry(getter_AddRefs(cacheEntry));
      if (cacheEntry)
        cacheEntry->MarkValid();
      // remove the channel from the load group
      nsCOMPtr <nsILoadGroup> loadGroup;
      GetLoadGroup(getter_AddRefs(loadGroup));
      // if the mock channel wasn't initialized with a load group then
      // use our load group (they may differ)
      if (!loadGroup)
        mailnewsUrl->GetLoadGroup(getter_AddRefs(loadGroup));
      if (loadGroup)
        loadGroup->RemoveRequest((nsIRequest *) this, nullptr, NS_OK);
    }
  }

  m_channelListener = nullptr;
  mCacheRequest = nullptr;
  if (mTryingToReadPart)
  {
    // clear mem cache entry on imap part url in case it's holding
    // onto last reference in mem cache. Need to do this on ui thread
    nsresult rv;
    nsCOMPtr <nsIImapUrl> imapUrl = do_QueryInterface(m_url, &rv);
    if (imapUrl)
    {
      nsCOMPtr <nsIImapMailFolderSink> folderSink;
      rv = imapUrl->GetImapMailFolderSink(getter_AddRefs(folderSink));
      if (folderSink)
      {
        nsCOMPtr <nsIMsgMailNewsUrl> mailUrl = do_QueryInterface(m_url);
        rv = folderSink->ReleaseUrlCacheEntry(mailUrl);
      }
    }
  }
  mChannelClosed = true;
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::GetProgressEventSink(nsIProgressEventSink ** aProgressEventSink)
{
  *aProgressEventSink = mProgressEventSink;
  NS_IF_ADDREF(*aProgressEventSink);
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::SetProgressEventSink(nsIProgressEventSink * aProgressEventSink)
{
  mProgressEventSink = aProgressEventSink;
  return NS_OK;
}

NS_IMETHODIMP  nsImapMockChannel::GetChannelListener(nsIStreamListener **aChannelListener)
{
  *aChannelListener = m_channelListener;
  NS_IF_ADDREF(*aChannelListener);
  return NS_OK;
}

NS_IMETHODIMP  nsImapMockChannel::GetChannelContext(nsISupports **aChannelContext)
{
  *aChannelContext = m_channelContext;
  NS_IF_ADDREF(*aChannelContext);
  return NS_OK;
}

// now implement our mock implementation of the channel interface...we forward all calls to the real
// channel if we have one...otherwise we return something bogus...

NS_IMETHODIMP nsImapMockChannel::SetLoadGroup(nsILoadGroup * aLoadGroup)
{
  m_loadGroup = aLoadGroup;
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::GetLoadGroup(nsILoadGroup * *aLoadGroup)
{
  *aLoadGroup = m_loadGroup;
  NS_IF_ADDREF(*aLoadGroup);
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::GetOriginalURI(nsIURI* *aURI)
{
  // IMap does not seem to have the notion of an original URI :-(
  //  *aURI = m_originalUrl ? m_originalUrl : m_url;
  *aURI = m_url;
  NS_IF_ADDREF(*aURI);
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::SetOriginalURI(nsIURI* aURI)
{
  // IMap does not seem to have the notion of an original URI :-(
  //    NS_NOTREACHED("nsImapMockChannel::SetOriginalURI");
  //    return NS_ERROR_NOT_IMPLEMENTED;
  return NS_OK;       // ignore
}

NS_IMETHODIMP nsImapMockChannel::GetURI(nsIURI* *aURI)
{
  *aURI = m_url;
  NS_IF_ADDREF(*aURI);
  return NS_OK ;
}

NS_IMETHODIMP nsImapMockChannel::SetURI(nsIURI* aURI)
{
  m_url = aURI;
#ifdef DEBUG_bienvenu
  if (!aURI)
    printf("Clearing URI\n");
#endif
  if (m_url)
  {
    // if we don't have a progress event sink yet, get it from the url for now...
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url);
    if (mailnewsUrl && !mProgressEventSink)
    {
      nsCOMPtr<nsIMsgStatusFeedback> statusFeedback;
      mailnewsUrl->GetStatusFeedback(getter_AddRefs(statusFeedback));
      mProgressEventSink = do_QueryInterface(statusFeedback);
    }
    // If this is a fetch URL and we can, get the message size from the message
    // header and set it to be the content length.
    // Note that for an attachment URL, this will set the content length to be
    // equal to the size of the entire message.
    nsCOMPtr<nsIImapUrl> imapUrl(do_QueryInterface(m_url));
    nsImapAction imapAction;
    imapUrl->GetImapAction(&imapAction);
    if (imapAction == nsIImapUrl::nsImapMsgFetch)
    {
      nsCOMPtr<nsIMsgMessageUrl> msgUrl(do_QueryInterface(m_url));
      if (msgUrl)
      {
        nsCOMPtr<nsIMsgDBHdr> msgHdr;
        // A failure to get a message header isn't an error
        msgUrl->GetMessageHeader(getter_AddRefs(msgHdr));
        if (msgHdr)
        {
          uint32_t messageSize;
          if (NS_SUCCEEDED(msgHdr->GetMessageSize(&messageSize)))
            SetContentLength(messageSize);
        }
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::Open(nsIInputStream **_retval)
{
  return NS_ImplementChannelOpen(this, _retval);
}

NS_IMETHODIMP
nsImapMockChannel::OnCacheEntryAvailable(nsICacheEntryDescriptor *entry, nsCacheAccessMode access, nsresult status)
{
  nsresult rv = NS_OK;

  // make sure we didn't close the channel before the async call back came in...
  // hmmm....if we had write access and we canceled this mock channel then I wonder if we should
  // be invalidating the cache entry before kicking out...
  if (mChannelClosed)
  {
    entry->Doom();
    return NS_OK;
  }

  NS_ENSURE_ARG(m_url); // kick out if m_url is null for some reason.

#ifdef DEBUG_bienvenu
      nsAutoCString entryKey("null");
      if (entry)
        entry->GetKey(entryKey);
      printf("*** OnCacheEntryAvailable %s with access %d status %u\n", entryKey.get(), access, status);
#endif
  if (NS_SUCCEEDED(status))
  {
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url, &rv);
    mailnewsUrl->SetMemCacheEntry(entry);

    if (mTryingToReadPart && access & nsICache::ACCESS_WRITE && !(access & nsICache::ACCESS_READ))
    {
      entry->Doom();
      // whoops, we're looking for a part, but didn't find it. Fall back to fetching the whole msg.
      nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(m_url);
      SetupPartExtractorListener(imapUrl, m_channelListener);
      return OpenCacheEntry();
    }
    // if we have write access then insert a "stream T" into the flow so data
    // gets written to both
    if (access & nsICache::ACCESS_WRITE && !(access & nsICache::ACCESS_READ))
    {
      // use a stream listener Tee to force data into the cache and to our current channel listener...
      nsCOMPtr<nsIStreamListenerTee> tee = do_CreateInstance(NS_STREAMLISTENERTEE_CONTRACTID, &rv);
      if (NS_SUCCEEDED(rv))
      {
        nsCOMPtr<nsIOutputStream> out;
        // this will fail with the mem cache turned off, so we need to fall through
        // to ReadFromImapConnection instead of aborting with NS_ENSURE_SUCCESS(rv,rv)
        rv = entry->OpenOutputStream(0, getter_AddRefs(out));
        if (NS_SUCCEEDED(rv))
        {
          rv = tee->Init(m_channelListener, out, nullptr);
          m_channelListener = do_QueryInterface(tee);
        }
        else
          NS_WARNING("IMAP Protocol failed to open output stream to Necko cache");
      }
    }
    else
    {
      rv = ReadFromMemCache(entry);
      if (NS_SUCCEEDED(rv))
      {
        NotifyStartEndReadFromCache(true);
        if (access & nsICache::ACCESS_WRITE)
          entry->MarkValid();
        return NS_OK; // kick out if reading from the cache succeeded...
      }
      entry->Doom(); // doom entry if we failed to read from mem cache
      mailnewsUrl->SetMemCacheEntry(nullptr); // we aren't going to be reading from the cache
    }
  } // if we got a valid entry back from the cache...

  // if reading from the cache failed or if we are writing into the cache, default to ReadFromImapConnection.
  return ReadFromImapConnection();
}

NS_IMETHODIMP
nsImapMockChannel::OnCacheEntryDoomed(nsresult status)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

nsresult nsImapMockChannel::OpenCacheEntry()
{
  nsresult rv;
  // get the cache session from our imap service...
  nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsICacheSession> cacheSession;
  rv = imapService->GetCacheSession(getter_AddRefs(cacheSession));
  NS_ENSURE_SUCCESS(rv, rv);

  // we're going to need to extend this logic for the case where we're looking
  // for a part. If we're looking for a part, we need to first ask for the part.
  // if that comes back with a writeable cache entry, we need to doom it right
  // away and not use it, and turn around and ask for a cache entry for the whole
  // message, if that's available. But it seems like we shouldn't write into that
  // cache entry if we just fetch that part - though we're doing that now. Maybe
  // we never try to download just a single part from imap because our mime parser
  // can't handle that, though I would think saving a single part as a file wouldn't
  // need to go through mime...

  // Open a cache entry with key = url
  nsAutoCString urlSpec;
  m_url->GetAsciiSpec(urlSpec);

  // for now, truncate of the query part so we don't duplicate urls in the cache...
  int32_t anchorIndex = urlSpec.RFindChar('?');
  if (anchorIndex > 0)
  {
    // if we were trying to read a part, we failed - fall back and look for whole msg
    if (mTryingToReadPart)
    {
      mTryingToReadPart = false;
      urlSpec.SetLength(anchorIndex);
    }
    else
    {
      // check if this is a filter plugin requesting the message. In that case,we're not
      // fetching a part, and we want the cache key to be just the uri.
      nsAutoCString anchor(Substring(urlSpec, anchorIndex));

      if (!anchor.EqualsLiteral("?header=filter")
        && !anchor.EqualsLiteral("?header=attach") && !anchor.EqualsLiteral("?header=src"))
        mTryingToReadPart = true;
      else
        urlSpec.SetLength(anchorIndex);
    }
  }
  int32_t uidValidity = -1;
  nsCacheAccessMode cacheAccess = nsICache::ACCESS_READ_WRITE;

  nsCOMPtr <nsIImapUrl> imapUrl = do_QueryInterface(m_url, &rv);
  if (imapUrl)
  {
    bool storeResultsOffline;
    nsCOMPtr <nsIImapMailFolderSink> folderSink;

    rv = imapUrl->GetImapMailFolderSink(getter_AddRefs(folderSink));
    if (folderSink)
      folderSink->GetUidValidity(&uidValidity);
    imapUrl->GetStoreResultsOffline(&storeResultsOffline);
    // If we're storing the message in the offline store, don't
    // write to the disk cache.
    if (storeResultsOffline)
      cacheAccess = nsICache::ACCESS_READ;
  }
  // stick the uid validity in front of the url, so that if the uid validity
  // changes, we won't re-use the wrong cache entries.
  nsAutoCString cacheKey;
  cacheKey.AppendInt(uidValidity, 16);
  cacheKey.Append(urlSpec);
  return cacheSession->AsyncOpenCacheEntry(cacheKey, cacheAccess, this, false);
}

nsresult nsImapMockChannel::ReadFromMemCache(nsICacheEntryDescriptor *entry)
{
  NS_ENSURE_ARG(entry);

  nsCString annotation;
  nsAutoCString entryKey;
  nsAutoCString contentType;
  nsresult rv = NS_OK;
  bool shouldUseCacheEntry = false;

  entry->GetKey(entryKey);
  // if we have a part, then we should use the cache entry.
  if (entryKey.FindChar('?') != kNotFound)
  {
    entry->GetMetaDataElement("contentType", getter_Copies(contentType));
    if (!contentType.IsEmpty())
      SetContentType(contentType);
    shouldUseCacheEntry = true;
  }
  else
  {
    // otherwise, we have the whole msg, and we should make sure the content isn't modified.
    rv = entry->GetMetaDataElement("ContentModified", getter_Copies(annotation));
    if (NS_SUCCEEDED(rv) && !annotation.IsEmpty())
      shouldUseCacheEntry = annotation.EqualsLiteral("Not Modified");
    if (shouldUseCacheEntry)
    {
      uint32_t entrySize;

      rv = entry->GetDataSize(&entrySize);
      nsCOMPtr<nsIMsgMessageUrl> msgUrl(do_QueryInterface(m_url));
      if (msgUrl)
      {
        nsCOMPtr<nsIMsgDBHdr> msgHdr;
        // A failure to get a message header isn't an error
        msgUrl->GetMessageHeader(getter_AddRefs(msgHdr));
        if (msgHdr)
        {
          uint32_t messageSize;
          if (NS_SUCCEEDED(msgHdr->GetMessageSize(&messageSize)) &&
              messageSize != entrySize)
          {
            PR_LOG(IMAP, PR_LOG_WARN,
                ("ReadFromMemCache size mismatch for %s: message %d, cache %d\n",
                 entryKey.get(), messageSize, entrySize));
            shouldUseCacheEntry = false;
          }
        }
      }
    }
  }
  if (shouldUseCacheEntry)
  {
    nsCOMPtr<nsIInputStream> in;
    uint32_t readCount;
    rv = entry->OpenInputStream(0, getter_AddRefs(in));
    NS_ENSURE_SUCCESS(rv, rv);
    const int kFirstBlockSize = 100;
    char firstBlock[kFirstBlockSize + 1];

    rv = in->Read(firstBlock, sizeof(firstBlock), &readCount);
    NS_ENSURE_SUCCESS(rv, rv);
    firstBlock[kFirstBlockSize] = '\0';
    int32_t findPos = MsgFindCharInSet(nsDependentCString(firstBlock),
                                       ":\n\r", 0);
    // Check that the first line is a header line, i.e., with a ':' in it
    // Or that it begins with "From " because some IMAP servers allow that,
    // even though it's technically invalid.
    shouldUseCacheEntry = ((findPos != -1 && firstBlock[findPos] == ':') ||
                           !(strncmp(firstBlock, "From ", 5)));
    in->Close();
  }
  if (shouldUseCacheEntry)
  {
    nsCOMPtr<nsIInputStream> in;
    rv = entry->OpenInputStream(0, getter_AddRefs(in));
    NS_ENSURE_SUCCESS(rv, rv);
     // if mem cache entry is broken or empty, return error.
    uint64_t bytesAvailable;
    rv = in->Available(&bytesAvailable);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!bytesAvailable)
      return NS_ERROR_FAILURE;

    nsCOMPtr<nsIInputStreamPump> pump;
    rv = NS_NewInputStreamPump(getter_AddRefs(pump), in);
    NS_ENSURE_SUCCESS(rv, rv);

    // if we are going to read from the cache, then create a mock stream listener class and use it
    nsImapCacheStreamListener * cacheListener = new nsImapCacheStreamListener();
    NS_ADDREF(cacheListener);
    cacheListener->Init(m_channelListener, this);
    rv = pump->AsyncRead(cacheListener, m_channelContext);
    NS_RELEASE(cacheListener);

    if (NS_SUCCEEDED(rv)) // ONLY if we succeeded in actually starting the read should we return
    {
      mCacheRequest = pump;
      nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(m_url);
      // if the msg is unread, we should mark it read on the server. This lets
      // the code running this url we're loading from the cache, if it cares.
      imapUrl->SetMsgLoadingFromCache(true);

      // be sure to set the cache entry's security info status as our security info status...
      nsCOMPtr<nsISupports> securityInfo;
      entry->GetSecurityInfo(getter_AddRefs(securityInfo));
      SetSecurityInfo(securityInfo);
      return NS_OK;
    } // if AsyncRead succeeded.
  } // if content is not modified
  else
    rv = NS_ERROR_FAILURE; // content is modified so return an error so we try to open it the old fashioned way

  return rv;
}

// the requested url isn't in any of our caches so create an imap connection
// to process it.
nsresult nsImapMockChannel::ReadFromImapConnection()
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(m_url);
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url);

  bool localOnly = false;
  imapUrl->GetLocalFetchOnly(&localOnly);
  if (localOnly)
  {
    // This will cause an OnStartRunningUrl, and the subsequent close
    // will then cause an OnStopRunningUrl with the cancel status.
    NotifyStartEndReadFromCache(true);
    Cancel(NS_MSG_ERROR_MSG_NOT_OFFLINE);
    if (m_channelListener)
      m_channelListener->OnStopRequest(this, m_channelContext,
                                       NS_MSG_ERROR_MSG_NOT_OFFLINE);
    return NS_MSG_ERROR_MSG_NOT_OFFLINE;
  }

  nsCOMPtr <nsILoadGroup> loadGroup;
  GetLoadGroup(getter_AddRefs(loadGroup));
  if (!loadGroup) // if we don't have one, the url will snag one from the msg window...
    mailnewsUrl->GetLoadGroup(getter_AddRefs(loadGroup));

  // okay, add the mock channel to the load group..
  if (loadGroup)
    loadGroup->AddRequest((nsIRequest *) this, nullptr /* context isupports */);

  // loading the url consists of asking the server to add the url to it's imap event queue....
  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = mailnewsUrl->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIImapIncomingServer> imapServer (do_QueryInterface(server, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // Assume AsyncRead is always called from the UI thread.....
  return imapServer->GetImapConnectionAndLoadUrl(imapUrl, nullptr);
}

// for messages stored in our offline cache, we have special code to handle that...
// If it's in the local cache, we return true and we can abort the download because
// this method does the rest of the work.
bool nsImapMockChannel::ReadFromLocalCache()
{
  nsresult rv = NS_OK;

  nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(m_url);
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url, &rv);

  bool useLocalCache = false;
  mailnewsUrl->GetMsgIsInLocalCache(&useLocalCache);
  if (useLocalCache)
  {
    nsAutoCString messageIdString;

    SetupPartExtractorListener(imapUrl, m_channelListener);

    imapUrl->GetListOfMessageIds(messageIdString);
    nsCOMPtr <nsIMsgFolder> folder;
    rv = mailnewsUrl->GetFolder(getter_AddRefs(folder));
    if (folder && NS_SUCCEEDED(rv))
    {
      // we want to create a file channel and read the msg from there.
      nsCOMPtr<nsIInputStream> fileStream;
      nsMsgKey msgKey = strtoul(messageIdString.get(), nullptr, 10);
      uint32_t size;
      int64_t offset;
      rv = folder->GetOfflineFileStream(msgKey, &offset, &size, getter_AddRefs(fileStream));
      // get the file channel from the folder, somehow (through the message or
      // folder sink?) We also need to set the transfer offset to the message offset
      if (fileStream && NS_SUCCEEDED(rv))
      {
        // dougt - This may break the ablity to "cancel" a read from offline mail reading.
        // fileChannel->SetLoadGroup(m_loadGroup);
        nsImapCacheStreamListener * cacheListener = new nsImapCacheStreamListener();
        NS_ADDREF(cacheListener);
        cacheListener->Init(m_channelListener, this);

        // create a stream pump that will async read the specified amount of data.
        // XXX make offset/size 64-bit ints
        nsCOMPtr<nsIInputStreamPump> pump;
        rv = NS_NewInputStreamPump(getter_AddRefs(pump), fileStream,
                                   offset, (int64_t) size);
        if (NS_SUCCEEDED(rv))
          rv = pump->AsyncRead(cacheListener, m_channelContext);

        NS_RELEASE(cacheListener);

        if (NS_SUCCEEDED(rv)) // ONLY if we succeeded in actually starting the read should we return
        {
          // if the msg is unread, we should mark it read on the server. This lets
          // the code running this url we're loading from the cache, if it cares.
          imapUrl->SetMsgLoadingFromCache(true);
          return true;
        }
      } // if we got an offline file transport
    } // if we got the folder for this url
  } // if use local cache

  return false;
}

NS_IMETHODIMP nsImapMockChannel::AsyncOpen(nsIStreamListener *listener, nsISupports *ctxt)
{
  nsresult rv = NS_OK;

  int32_t port;
  if (!m_url)
    return NS_ERROR_NULL_POINTER;
  rv = m_url->GetPort(&port);
  if (NS_FAILED(rv))
      return rv;

  rv = NS_CheckPortSafety(port, "imap");
  if (NS_FAILED(rv))
      return rv;

  // set the stream listener and then load the url
  m_channelContext = ctxt;
  NS_ASSERTION(!m_channelListener, "shouldn't already have a listener");
  m_channelListener = listener;
  nsCOMPtr<nsIImapUrl> imapUrl  (do_QueryInterface(m_url));

  nsImapAction imapAction;
  imapUrl->GetImapAction(&imapAction);

  bool externalLink = true;
  imapUrl->GetExternalLinkUrl(&externalLink);

  if (externalLink)
  {
    // for security purposes, only allow imap urls originating from external sources
    // perform a limited set of actions.
    // Currently the allowed set includes:
    // 1) folder selection
    // 2) message fetch
    // 3) message part fetch

    if (! (imapAction == nsIImapUrl::nsImapSelectFolder || imapAction == nsIImapUrl::nsImapMsgFetch || imapAction == nsIImapUrl::nsImapOpenMimePart
      || imapAction == nsIImapUrl::nsImapMsgFetchPeek))
      return NS_ERROR_FAILURE; // abort the running of this url....it failed a security check
  }

  if (ReadFromLocalCache())
  {
    (void) NotifyStartEndReadFromCache(true);
    return NS_OK;
  }

  // okay, it's not in the local cache, now check the memory cache...
  // but we can't download for offline use from the memory cache
  if (imapAction != nsIImapUrl::nsImapMsgDownloadForOffline)
  {
    rv = OpenCacheEntry();
    if (NS_SUCCEEDED(rv))
      return rv;
  }

  SetupPartExtractorListener(imapUrl, m_channelListener);
  // if for some reason open cache entry failed then just default to opening an imap connection for the url
  return ReadFromImapConnection();
}

nsresult nsImapMockChannel::SetupPartExtractorListener(nsIImapUrl * aUrl, nsIStreamListener * aConsumer)
{
  // if the url we are loading refers to a specific part then we need
  // libmime to extract that part from the message for us.
  bool refersToPart = false;
  aUrl->GetMimePartSelectorDetected(&refersToPart);
  if (refersToPart)
  {
    nsCOMPtr<nsIStreamConverterService> converter = do_GetService("@mozilla.org/streamConverters;1");
    if (converter && aConsumer)
    {
      nsCOMPtr<nsIStreamListener> newConsumer;
      converter->AsyncConvertData("message/rfc822", "*/*",
           aConsumer, static_cast<nsIChannel *>(this), getter_AddRefs(newConsumer));
      if (newConsumer)
        m_channelListener = newConsumer;
    }
  }

  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::GetLoadFlags(nsLoadFlags *aLoadFlags)
{
  //*aLoadFlags = nsIRequest::LOAD_NORMAL;
  *aLoadFlags = mLoadFlags;
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::SetLoadFlags(nsLoadFlags aLoadFlags)
{
  mLoadFlags = aLoadFlags;
  return NS_OK;       // don't fail when trying to set this
}

NS_IMETHODIMP nsImapMockChannel::GetContentType(nsACString &aContentType)
{
  if (m_ContentType.IsEmpty())
  {
    nsImapAction imapAction = 0;
    if (m_url)
    {
      nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(m_url);
      if (imapUrl)
      {
        imapUrl->GetImapAction(&imapAction);
      }
    }
    if (imapAction == nsIImapUrl::nsImapSelectFolder)
      aContentType.AssignLiteral("x-application-imapfolder");
    else
      aContentType.AssignLiteral("message/rfc822");
  }
  else
    aContentType = m_ContentType;
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::SetContentType(const nsACString &aContentType)
{
  nsAutoCString charset;
  nsresult rv = NS_ParseContentType(aContentType, m_ContentType, charset);
  if (NS_FAILED(rv) || m_ContentType.IsEmpty())
    m_ContentType.AssignLiteral(UNKNOWN_CONTENT_TYPE);
  return rv;
}

NS_IMETHODIMP nsImapMockChannel::GetContentCharset(nsACString &aContentCharset)
{
  aContentCharset.Truncate();
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::SetContentCharset(const nsACString &aContentCharset)
{
  NS_WARNING("nsImapMockChannel::SetContentCharset() not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsImapMockChannel::GetContentDisposition(uint32_t *aContentDisposition)
{
  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP
nsImapMockChannel::SetContentDisposition(uint32_t aContentDisposition)
{
  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP
nsImapMockChannel::GetContentDispositionFilename(nsAString &aContentDispositionFilename)
{
  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP
nsImapMockChannel::SetContentDispositionFilename(const nsAString &aContentDispositionFilename)
{
  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP
nsImapMockChannel::GetContentDispositionHeader(nsACString &aContentDispositionHeader)
{
  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP nsImapMockChannel::GetContentLength(int64_t * aContentLength)
{
  *aContentLength = mContentLength;
  return NS_OK;
}

NS_IMETHODIMP
nsImapMockChannel::SetContentLength(int64_t aContentLength)
{
    mContentLength = aContentLength;
    return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::GetOwner(nsISupports * *aPrincipal)
{
  *aPrincipal = mOwner;
  NS_IF_ADDREF(*aPrincipal);
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::SetOwner(nsISupports * aPrincipal)
{
    mOwner = aPrincipal;
    return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::GetSecurityInfo(nsISupports * *aSecurityInfo)
{
    NS_IF_ADDREF(*aSecurityInfo = mSecurityInfo);
    return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::SetSecurityInfo(nsISupports *aSecurityInfo)
{
    mSecurityInfo = aSecurityInfo;
    return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////
// From nsIRequest
////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP nsImapMockChannel::GetName(nsACString &result)
{
  if (m_url)
    return m_url->GetSpec(result);
  result.Truncate();
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::IsPending(bool *result)
{
    *result = m_channelListener != nullptr;
    return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::GetStatus(nsresult *status)
{
    *status = m_cancelStatus;
    return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::SetImapProtocol(nsIImapProtocol *aProtocol)
{
  m_protocol = do_GetWeakReference(aProtocol);
  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::Cancel(nsresult status)
{
  NS_WARN_IF_FALSE(NS_IsMainThread(),
                   "nsImapMockChannel::Cancel should only be called from UI thread");
  m_cancelStatus = status;
  nsCOMPtr<nsIImapProtocol> imapProtocol = do_QueryReferent(m_protocol);

  // if we aren't reading from the cache and we get canceled...doom our cache entry...
  if (m_url)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url);
    DoomCacheEntry(mailnewsUrl);
  }

  // Required for killing ImapProtocol thread
  if (imapProtocol)
    imapProtocol->TellThreadToDie(false);

  return NS_OK;
}

NS_IMETHODIMP nsImapMockChannel::Suspend()
{
    NS_NOTREACHED("nsImapMockChannel::Suspend");
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsImapMockChannel::Resume()
{
    NS_NOTREACHED("nsImapMockChannel::Resume");
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsImapMockChannel::GetNotificationCallbacks(nsIInterfaceRequestor* *aNotificationCallbacks)
{
  *aNotificationCallbacks = mCallbacks.get();
  NS_IF_ADDREF(*aNotificationCallbacks);
  return NS_OK;
}

NS_IMETHODIMP
nsImapMockChannel::SetNotificationCallbacks(nsIInterfaceRequestor* aNotificationCallbacks)
{
  mCallbacks = aNotificationCallbacks;
  return NS_OK;
}

NS_IMETHODIMP
nsImapMockChannel::OnTransportStatus(nsITransport *transport, nsresult status,
                                     uint64_t progress, uint64_t progressMax)
{
  if (NS_FAILED(m_cancelStatus) || (mLoadFlags & LOAD_BACKGROUND) || !m_url)
    return NS_OK;

  // these transport events should not generate any status messages
  if (status == NS_NET_STATUS_RECEIVING_FROM ||
      status == NS_NET_STATUS_SENDING_TO)
    return NS_OK;

  if (!mProgressEventSink)
  {
    NS_QueryNotificationCallbacks(mCallbacks, m_loadGroup, mProgressEventSink);
    if (!mProgressEventSink)
      return NS_OK;
  }

  nsAutoCString host;
  m_url->GetHost(host);

  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(m_url);
  if (mailnewsUrl)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    mailnewsUrl->GetServer(getter_AddRefs(server));
    if (server)
      server->GetRealHostName(host);
  }
  mProgressEventSink->OnStatus(this, nullptr, status,
                               NS_ConvertUTF8toUTF16(host).get());

  return NS_OK;
}


nsIMAPMailboxInfo::nsIMAPMailboxInfo(const nsACString &aName, char aDelimiter)
{
  mMailboxName.Assign(aName);
  mDelimiter = aDelimiter;
  mChildrenListed = false;
}

nsIMAPMailboxInfo::~nsIMAPMailboxInfo()
{
}

void nsIMAPMailboxInfo::SetChildrenListed(bool childrenListed)
{
  mChildrenListed = childrenListed;
}

bool nsIMAPMailboxInfo::GetChildrenListed()
{
  return mChildrenListed;
}

const nsACString& nsIMAPMailboxInfo::GetMailboxName()
{
  return mMailboxName;
}

char nsIMAPMailboxInfo::GetDelimiter()
{
  return mDelimiter;
}
