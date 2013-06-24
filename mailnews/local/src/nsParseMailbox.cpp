/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsIURI.h"
#include "nsParseMailbox.h"
#include "nsIMsgHdr.h"
#include "nsIMsgDatabase.h"
#include "nsMsgMessageFlags.h"
#include "nsIDBFolderInfo.h"
#include "nsIInputStream.h"
#include "nsIFile.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsMsgBaseCID.h"
#include "nsMsgDBCID.h"
#include "nsIMailboxUrl.h"
#include "nsNetUtil.h"
#include "nsMsgFolderFlags.h"
#include "nsIMsgFolder.h"
#include "nsIURL.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMsgFilterList.h"
#include "nsIMsgFilter.h"
#include "nsIIOService.h"
#include "nsNetCID.h"
#include "nsRDFCID.h"
#include "nsIRDFService.h"
#include "nsMsgI18N.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsMsgUtils.h"
#include "prprf.h"
#include "prmem.h"
#include "nsISeekableStream.h"
#include "nsIMimeHeaders.h"
#include "nsIMsgMdnGenerator.h"
#include "nsMsgSearchCore.h"
#include "nsMailHeaders.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgComposeParams.h"
#include "nsMsgCompCID.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIDocShell.h"
#include "nsIMsgCompose.h"
#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "nsIMsgComposeService.h"
#include "nsIMsgCopyService.h"
#include "nsICryptoHash.h"
#include "nsIStringBundle.h"
#include "nsIMsgFilterPlugin.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsIMsgFilterCustomAction.h"
#include <ctype.h>
#include "nsIMsgPluggableStore.h"
#include "mozilla/Services.h"

static NS_DEFINE_CID(kCMailDB, NS_MAILDB_CID);
static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);

/* the following macros actually implement addref, release and query interface for our component. */
NS_IMPL_ISUPPORTS_INHERITED2(nsMsgMailboxParser,
                             nsParseMailMessageState,
                             nsIStreamListener,
                             nsIRequestObserver)

// Whenever data arrives from the connection, core netlib notifices the protocol by calling
// OnDataAvailable. We then read and process the incoming data from the input stream.
NS_IMETHODIMP nsMsgMailboxParser::OnDataAvailable(nsIRequest *request, nsISupports *ctxt, nsIInputStream *aIStream, uint64_t sourceOffset, uint32_t aLength)
{
    // right now, this really just means turn around and process the url
    nsresult rv = NS_OK;
    nsCOMPtr<nsIURI> url = do_QueryInterface(ctxt, &rv);
    if (NS_SUCCEEDED(rv))
        rv = ProcessMailboxInputStream(url, aIStream, aLength);
    return rv;
}

NS_IMETHODIMP nsMsgMailboxParser::OnStartRequest(nsIRequest *request, nsISupports *ctxt)
{
    m_startTime = PR_Now();


    // extract the appropriate event sinks from the url and initialize them in our protocol data
    // the URL should be queried for a nsIMailboxURL. If it doesn't support a mailbox URL interface then
    // we have an error.
    nsresult rv = NS_OK;

    nsCOMPtr<nsIIOService> ioServ =
      mozilla::services::GetIOService();
    NS_ENSURE_TRUE(ioServ, NS_ERROR_UNEXPECTED);

    nsCOMPtr<nsIMailboxUrl> runningUrl = do_QueryInterface(ctxt, &rv);

    nsCOMPtr<nsIMsgMailNewsUrl> url = do_QueryInterface(ctxt);
    nsCOMPtr<nsIMsgFolder> folder = do_QueryReferent(m_folder);

    if (NS_SUCCEEDED(rv) && runningUrl && folder)
    {
        url->GetStatusFeedback(getter_AddRefs(m_statusFeedback));

        // okay, now fill in our event sinks...Note that each getter ref counts before
        // it returns the interface to us...we'll release when we are done

        folder->GetName(m_folderName);

        nsCOMPtr<nsIFile> path;
        folder->GetFilePath(getter_AddRefs(path));

        if (path)
        {
          int64_t fileSize;
          path->GetFileSize(&fileSize);
            // the size of the mailbox file is our total base line for measuring progress
            m_graph_progress_total = (uint32_t) fileSize;
            UpdateStatusText("buildingSummary");
            nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
            if (msgDBService)
            {
                // Use OpenFolderDB to always open the db so that db's m_folder
                // is set correctly.
                rv = msgDBService->OpenFolderDB(folder, true,
                                                getter_AddRefs(m_mailDB));
                if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING)
                  rv = msgDBService->CreateNewDB(folder,
                                                 getter_AddRefs(m_mailDB));

                if (m_mailDB)
                    m_mailDB->AddListener(this);
            }
            NS_ASSERTION(m_mailDB, "failed to open mail db parsing folder");

            // try to get a backup message database
            nsresult rvignore = folder->GetBackupMsgDatabase(
                getter_AddRefs(m_backupMailDB));

            // We'll accept failures and move on, as we're dealing with some
            // sort of unknown problem to begin with.
            if (NS_FAILED(rvignore))
            {
              if (m_backupMailDB)
                m_backupMailDB->RemoveListener(this);
              m_backupMailDB = nullptr;
            }
            else if (m_backupMailDB)
            {
              m_backupMailDB->AddListener(this);
            }
        }
    }

    // need to get the mailbox name out of the url and call SetMailboxName with it.
    // then, we need to open the mail db for this parser.
    return rv;
}

// stop binding is a "notification" informing us that the stream associated with aURL is going away.
NS_IMETHODIMP nsMsgMailboxParser::OnStopRequest(nsIRequest *request, nsISupports *ctxt, nsresult aStatus)
{
    DoneParsingFolder(aStatus);
    // what can we do? we can close the stream?
    m_urlInProgress = false;  // don't close the connection...we may be re-using it.

    if (m_mailDB)
        m_mailDB->RemoveListener(this);
    // and we want to mark ourselves for deletion or some how inform our protocol manager that we are
    // available for another url if there is one....

    ReleaseFolderLock();
    // be sure to clear any status text and progress info..
    m_graph_progress_received = 0;
    UpdateProgressPercent();
    UpdateStatusText("localStatusDocumentDone");

    return NS_OK;
}

NS_IMETHODIMP
nsParseMailMessageState::OnHdrPropertyChanged(nsIMsgDBHdr *aHdrToChange,
    bool aPreChange, uint32_t *aStatus, nsIDBChangeListener * aInstigator)
{
  return NS_OK;
}


NS_IMETHODIMP
nsParseMailMessageState::OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged,
    uint32_t aOldFlags, uint32_t aNewFlags, nsIDBChangeListener *aInstigator)
{
    return NS_OK;
}

NS_IMETHODIMP
nsParseMailMessageState::OnHdrDeleted(nsIMsgDBHdr *aHdrChanged,
    nsMsgKey aParentKey, int32_t aFlags, nsIDBChangeListener *aInstigator)
{
    return NS_OK;
}

NS_IMETHODIMP
nsParseMailMessageState::OnHdrAdded(nsIMsgDBHdr *aHdrAdded,
    nsMsgKey aParentKey, int32_t aFlags, nsIDBChangeListener *aInstigator)
{
    return NS_OK;
}

/* void OnParentChanged (in nsMsgKey aKeyChanged, in nsMsgKey oldParent, in nsMsgKey newParent, in nsIDBChangeListener aInstigator); */
NS_IMETHODIMP
nsParseMailMessageState::OnParentChanged(nsMsgKey aKeyChanged,
    nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeListener *aInstigator)
{
    return NS_OK;
}

/* void OnAnnouncerGoingAway (in nsIDBChangeAnnouncer instigator); */
NS_IMETHODIMP
nsParseMailMessageState::OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator)
{
  if (m_backupMailDB && m_backupMailDB == instigator)
  {
    m_backupMailDB->RemoveListener(this);
    m_backupMailDB = nullptr;
  }
  else if (m_mailDB)
  {
    m_mailDB->RemoveListener(this);
    m_mailDB = nullptr;
    m_newMsgHdr = nullptr;
  }
  return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::OnEvent(nsIMsgDatabase *aDB, const char *aEvent)
{
  return NS_OK;
}

/* void OnReadChanged (in nsIDBChangeListener instigator); */
NS_IMETHODIMP
nsParseMailMessageState::OnReadChanged(nsIDBChangeListener *instigator)
{
    return NS_OK;
}

/* void OnJunkScoreChanged (in nsIDBChangeListener instigator); */
NS_IMETHODIMP
nsParseMailMessageState::OnJunkScoreChanged(nsIDBChangeListener *instigator)
{
    return NS_OK;
}

nsMsgMailboxParser::nsMsgMailboxParser() : nsMsgLineBuffer(nullptr, false)
{
  Init();
}

nsMsgMailboxParser::nsMsgMailboxParser(nsIMsgFolder *aFolder) : nsMsgLineBuffer(nullptr, false)
{
  m_folder = do_GetWeakReference(aFolder);
}

nsMsgMailboxParser::~nsMsgMailboxParser()
{
  ReleaseFolderLock();
}

nsresult nsMsgMailboxParser::Init()
{
  m_obuffer = nullptr;
  m_obuffer_size = 0;
  m_graph_progress_total = 0;
  m_graph_progress_received = 0;
  return AcquireFolderLock();
}

void nsMsgMailboxParser::UpdateStatusText (const char* stringName)
{
  if (m_statusFeedback)
  {
    nsresult rv;
    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    if (!bundleService)
      return;
    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle("chrome://messenger/locale/localMsgs.properties", getter_AddRefs(bundle));
    if (NS_FAILED(rv))
      return;
    nsString finalString;
    const PRUnichar * stringArray[] = { m_folderName.get() };
    rv = bundle->FormatStringFromName(NS_ConvertASCIItoUTF16(stringName).get(),
                                      stringArray, 1, getter_Copies(finalString));
    m_statusFeedback->ShowStatusString(finalString);
  }
}

void nsMsgMailboxParser::UpdateProgressPercent ()
{
  if (m_statusFeedback && m_graph_progress_total != 0)
  {
    // prevent overflow by dividing both by 100
    uint32_t progressTotal = m_graph_progress_total / 100;
    uint32_t progressReceived = m_graph_progress_received / 100;
    if (progressTotal > 0)
      m_statusFeedback->ShowProgress((100 *(progressReceived))  / progressTotal);
  }
}

nsresult nsMsgMailboxParser::ProcessMailboxInputStream(nsIURI* aURL, nsIInputStream *aIStream, uint32_t aLength)
{
  nsresult ret = NS_OK;

  uint32_t bytesRead = 0;

  if (NS_SUCCEEDED(m_inputStream.GrowBuffer(aLength)))
  {
    // OK, this sucks, but we're going to have to copy into our
    // own byte buffer, and then pass that to the line buffering code,
    // which means a couple buffer copies.
    ret = aIStream->Read(m_inputStream.GetBuffer(), aLength, &bytesRead);
    if (NS_SUCCEEDED(ret))
      ret = BufferInput(m_inputStream.GetBuffer(), bytesRead);
  }
  if (m_graph_progress_total > 0)
  {
    if (NS_SUCCEEDED(ret))
      m_graph_progress_received += bytesRead;
  }
  return (ret);
}

void nsMsgMailboxParser::DoneParsingFolder(nsresult status)
{
  /* End of file.  Flush out any partial line remaining in the buffer. */
  FlushLastLine();
  PublishMsgHeader(nullptr);

  // only mark the db valid if we've succeeded.
  if (NS_SUCCEEDED(status) && m_mailDB)  // finished parsing, so flush db folder info
    UpdateDBFolderInfo();
  else if (m_mailDB)
    m_mailDB->SetSummaryValid(false);

  // remove the backup database
  if (m_backupMailDB)
  {
    nsCOMPtr<nsIMsgFolder> folder = do_QueryReferent(m_folder);
    if (folder)
      folder->RemoveBackupMsgDatabase();
    m_backupMailDB = nullptr;
  }

  //  if (m_folder != nullptr)
  //    m_folder->SummaryChanged();
  FreeBuffers();
}

void nsMsgMailboxParser::FreeBuffers()
{
  /* We're done reading the folder - we don't need these things
   any more. */
  PR_FREEIF (m_obuffer);
  m_obuffer_size = 0;
}

void nsMsgMailboxParser::UpdateDBFolderInfo()
{
  UpdateDBFolderInfo(m_mailDB);
}

// update folder info in db so we know not to reparse.
void nsMsgMailboxParser::UpdateDBFolderInfo(nsIMsgDatabase *mailDB)
{
  mailDB->SetSummaryValid(true);
}

// Tell the world about the message header (add to db, and view, if any)
int32_t nsMsgMailboxParser::PublishMsgHeader(nsIMsgWindow *msgWindow)
{
  FinishHeader();
  if (m_newMsgHdr)
  {
    char storeToken[100];
    PR_snprintf(storeToken, sizeof(storeToken), "%lld", m_envelope_pos);
    m_newMsgHdr->SetStringProperty("storeToken", storeToken);

    uint32_t flags;
    (void)m_newMsgHdr->GetFlags(&flags);
    if (flags & nsMsgMessageFlags::Expunged)
    {
      nsCOMPtr<nsIDBFolderInfo> folderInfo;
      m_mailDB->GetDBFolderInfo(getter_AddRefs(folderInfo));
      uint32_t size;
      (void)m_newMsgHdr->GetMessageSize(&size);
      folderInfo->ChangeExpungedBytes(size);
      m_newMsgHdr = nullptr;
    }
    else if (m_mailDB)
    {
      // add hdr but don't notify - shouldn't be requiring notifications
      // during summary file rebuilding
      m_mailDB->AddNewHdrToDB(m_newMsgHdr, false);
      m_newMsgHdr = nullptr;
    }
    else
      NS_ASSERTION(false, "no database while parsing local folder");  // should have a DB, no?
  }
  else if (m_mailDB)
  {
    nsCOMPtr<nsIDBFolderInfo> folderInfo;
    m_mailDB->GetDBFolderInfo(getter_AddRefs(folderInfo));
    if (folderInfo)
      folderInfo->ChangeExpungedBytes(m_position - m_envelope_pos);
  }
  return 0;
}

void nsMsgMailboxParser::AbortNewHeader()
{
  if (m_newMsgHdr && m_mailDB)
    m_newMsgHdr = nullptr;
}

void nsMsgMailboxParser::OnNewMessage(nsIMsgWindow *msgWindow)
{
  PublishMsgHeader(msgWindow);
  Clear();
}

nsresult nsMsgMailboxParser::HandleLine(char *line, uint32_t lineLength)
{
  /* If this is the very first line of a non-empty folder, make sure it's an envelope */
  if (m_graph_progress_received == 0)
  {
    /* This is the first block from the file.  Check to see if this
       looks like a mail file. */
    const char *s = line;
    const char *end = s + lineLength;
    while (s < end && IS_SPACE(*s))
      s++;
    if ((end - s) < 20 || !IsEnvelopeLine(s, end - s))
    {
//      char buf[500];
//      PR_snprintf (buf, sizeof(buf),
//             XP_GetString(MK_MSG_NON_MAIL_FILE_READ_QUESTION),
//             folder_name);
//      else if (!FE_Confirm (m_context, buf))
//        return NS_MSG_NOT_A_MAIL_FOLDER; /* #### NOT_A_MAIL_FILE */
    }
  }
//  m_graph_progress_received += lineLength;

  // mailbox parser needs to do special stuff when it finds an envelope
  // after parsing a message body. So do that.
  if (line[0] == 'F' && IsEnvelopeLine(line, lineLength))
  {
    // **** This used to be
    // PR_ASSERT (m_parseMsgState->m_state == nsMailboxParseBodyState);
    // **** I am not sure this is a right thing to do. This happens when
    // going online, downloading a message while playing back append
    // draft/template offline operation. We are mixing
        // nsMailboxParseBodyState &&
    // nsMailboxParseHeadersState. David I need your help here too. **** jt

    NS_ASSERTION (m_state == nsIMsgParseMailMsgState::ParseBodyState ||
           m_state == nsIMsgParseMailMsgState::ParseHeadersState, "invalid parse state"); /* else folder corrupted */
    OnNewMessage(nullptr);
    nsresult rv = StartNewEnvelope(line, lineLength);
    NS_ASSERTION(NS_SUCCEEDED(rv), " error starting envelope parsing mailbox");
    // at the start of each new message, update the progress bar
    UpdateProgressPercent();
    return rv;
  }

  // otherwise, the message parser can handle it completely.
  if (m_mailDB != nullptr)  // if no DB, do we need to parse at all?
    return ParseFolderLine(line, lineLength);

  return NS_ERROR_NULL_POINTER; // need to error out if we don't have a db.
}

void
nsMsgMailboxParser::ReleaseFolderLock()
{
  nsresult result;
  nsCOMPtr<nsIMsgFolder> folder = do_QueryReferent(m_folder);
  if (!folder)
    return;
  bool haveSemaphore;
  nsCOMPtr <nsISupports> supports = do_QueryInterface(static_cast<nsIMsgParseMailMsgState*>(this));
  result = folder->TestSemaphore(supports, &haveSemaphore);
  if (NS_SUCCEEDED(result) && haveSemaphore)
    (void) folder->ReleaseSemaphore(supports);
}

nsresult
nsMsgMailboxParser::AcquireFolderLock()
{
  nsCOMPtr<nsIMsgFolder> folder = do_QueryReferent(m_folder);
  if (!folder)
    return NS_ERROR_NULL_POINTER;
  nsCOMPtr<nsISupports> supports = do_QueryObject(this);
  return folder->AcquireSemaphore(supports);
}

NS_IMPL_ISUPPORTS2(nsParseMailMessageState, nsIMsgParseMailMsgState, nsIDBChangeListener)

nsParseMailMessageState::nsParseMailMessageState()
{
  m_position = 0;
  m_IgnoreXMozillaStatus = false;
  m_state = nsIMsgParseMailMsgState::ParseBodyState;

  // setup handling of custom db headers, headers that are added to .msf files
  // as properties of the nsMsgHdr objects, controlled by the
  // pref mailnews.customDBHeaders, a space-delimited list of headers.
  // E.g., if mailnews.customDBHeaders is "X-Spam-Score", and we're parsing
  // a mail message with the X-Spam-Score header, we'll set the
  // "x-spam-score" property of nsMsgHdr to the value of the header.
  m_customDBHeaderValues = nullptr;
  nsCString customDBHeaders; // not shown in search UI
  nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (pPrefBranch)
  {
     pPrefBranch->GetCharPref("mailnews.customDBHeaders",  getter_Copies(customDBHeaders));
     ToLowerCase(customDBHeaders);
     if (customDBHeaders.Find("content-base") == -1)
      customDBHeaders.Insert(NS_LITERAL_CSTRING("content-base "), 0);
     ParseString(customDBHeaders, ' ', m_customDBHeaders);

     // now add customHeaders
     nsCString customHeadersString; // shown in search UI
     nsTArray<nsCString> customHeadersArray;
     pPrefBranch->GetCharPref("mailnews.customHeaders", getter_Copies(customHeadersString));
     ToLowerCase(customHeadersString);
     customHeadersString.StripWhitespace();
     ParseString(customHeadersString, ':', customHeadersArray);
     for (uint32_t i = 0; i < customHeadersArray.Length(); i++)
     {
       if (!m_customDBHeaders.Contains(customHeadersArray[i]))
         m_customDBHeaders.AppendElement(customHeadersArray[i]);
     }

     if (m_customDBHeaders.Length())
     {
       m_customDBHeaderValues = new struct message_header [m_customDBHeaders.Length()];
       if (!m_customDBHeaderValues)
         m_customDBHeaders.Clear();
     }
  }
  Clear();
  m_HeaderAddressParser = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID);
}

nsParseMailMessageState::~nsParseMailMessageState()
{
  ClearAggregateHeader (m_toList);
  ClearAggregateHeader (m_ccList);
  delete [] m_customDBHeaderValues;
}

void nsParseMailMessageState::Init(uint32_t fileposition)
{
  m_state = nsIMsgParseMailMsgState::ParseBodyState;
  m_position = fileposition;
  m_newMsgHdr = nullptr;
}

NS_IMETHODIMP nsParseMailMessageState::Clear()
{
  m_message_id.length = 0;
  m_references.length = 0;
  m_date.length = 0;
  m_delivery_date.length = 0;
  m_from.length = 0;
  m_sender.length = 0;
  m_newsgroups.length = 0;
  m_subject.length = 0;
  m_status.length = 0;
  m_mozstatus.length = 0;
  m_mozstatus2.length = 0;
  m_envelope_from.length = 0;
  m_envelope_date.length = 0;
  m_priority.length = 0;
  m_keywords.length = 0;
  m_mdn_dnt.length = 0;
  m_return_path.length = 0;
  m_account_key.length = 0;
  m_in_reply_to.length = 0;
  m_replyTo.length = 0;
  m_content_type.length = 0;
  m_mdn_original_recipient.length = 0;
  m_bccList.length = 0;
  m_body_lines = 0;
  m_newMsgHdr = nullptr;
  m_envelope_pos = 0;
  ClearAggregateHeader (m_toList);
  ClearAggregateHeader (m_ccList);
  m_headers.ResetWritePos();
  m_envelope.ResetWritePos();
  m_receivedTime = 0;
  m_receivedValue.Truncate();
  for (uint32_t i = 0; i < m_customDBHeaders.Length(); i++)
    m_customDBHeaderValues[i].length = 0;

  return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::SetState(nsMailboxParseState aState)
{
  m_state = aState;
  return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::GetState(nsMailboxParseState *aState)
{
  if (!aState)
    return NS_ERROR_NULL_POINTER;

  *aState = m_state;
  return NS_OK;
}

NS_IMETHODIMP
nsParseMailMessageState::GetEnvelopePos(uint32_t *aEnvelopePos)
{
    if (!aEnvelopePos)
        return NS_ERROR_NULL_POINTER;
    *aEnvelopePos = m_envelope_pos;
    return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::SetEnvelopePos(uint32_t aEnvelopePos)
{
  m_envelope_pos = aEnvelopePos;
  m_position = m_envelope_pos;
  m_headerstartpos = m_position;
  return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::GetNewMsgHdr(nsIMsgDBHdr ** aMsgHeader)
{
  NS_ENSURE_ARG_POINTER(aMsgHeader);
  NS_IF_ADDREF(*aMsgHeader = m_newMsgHdr);
  return m_newMsgHdr ? NS_OK : NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsParseMailMessageState::SetNewMsgHdr(nsIMsgDBHdr *aMsgHeader)
{
  m_newMsgHdr = aMsgHeader;
  return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::ParseAFolderLine(const char *line, uint32_t lineLength)
{
  ParseFolderLine(line, lineLength);
  return NS_OK;
}

nsresult nsParseMailMessageState::ParseFolderLine(const char *line, uint32_t lineLength)
{
  nsresult rv;

  if (m_state == nsIMsgParseMailMsgState::ParseHeadersState)
  {
    if (EMPTY_MESSAGE_LINE(line))
    {
      /* End of headers.  Now parse them. */
      rv = ParseHeaders();
      NS_ASSERTION(NS_SUCCEEDED(rv), "error parsing headers parsing mailbox");
      NS_ENSURE_SUCCESS(rv, rv);

      rv = FinalizeHeaders();
      NS_ASSERTION(NS_SUCCEEDED(rv), "error finalizing headers parsing mailbox");
      NS_ENSURE_SUCCESS(rv, rv);

      m_state = nsIMsgParseMailMsgState::ParseBodyState;
    }
    else
    {
      /* Otherwise, this line belongs to a header.  So append it to the
         header data, and stay in MBOX `MIME_PARSE_HEADERS' state.
      */
      m_headers.AppendBuffer(line, lineLength);
    }
  }
  else if ( m_state == nsIMsgParseMailMsgState::ParseBodyState)
  {
    m_body_lines++;
  }

  m_position += lineLength;

  return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::SetMailDB(nsIMsgDatabase *mailDB)
{
  m_mailDB = mailDB;
  return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::SetBackupMailDB(nsIMsgDatabase *aBackupMailDB)
{
  m_backupMailDB = aBackupMailDB;
  if (m_backupMailDB)
    m_backupMailDB->AddListener(this);
  return NS_OK;
}

/* #define STRICT_ENVELOPE */

bool
nsParseMailMessageState::IsEnvelopeLine(const char *buf, int32_t buf_size)
{
#ifdef STRICT_ENVELOPE
  /* The required format is
     From jwz  Fri Jul  1 09:13:09 1994
   But we should also allow at least:
     From jwz  Fri, Jul 01 09:13:09 1994
     From jwz  Fri Jul  1 09:13:09 1994 PST
     From jwz  Fri Jul  1 09:13:09 1994 (+0700)

   We can't easily call XP_ParseTimeString() because the string is not
   null terminated (ok, we could copy it after a quick check...) but
   XP_ParseTimeString() may be too lenient for our purposes.

   DANGER!!  The released version of 2.0b1 was (on some systems,
   some Unix, some NT, possibly others) writing out envelope lines
   like "From - 10/13/95 11:22:33" which STRICT_ENVELOPE will reject!
   */
  const char *date, *end;

  if (buf_size < 29) return false;
  if (*buf != 'F') return false;
  if (strncmp(buf, "From ", 5)) return false;

  end = buf + buf_size;
  date = buf + 5;

  /* Skip horizontal whitespace between "From " and user name. */
  while ((*date == ' ' || *date == '\t') && date < end)
  date++;

  /* If at the end, it doesn't match. */
  if (IS_SPACE(*date) || date == end)
  return false;

  /* Skip over user name. */
  while (!IS_SPACE(*date) && date < end)
  date++;

  /* Skip horizontal whitespace between user name and date. */
  while ((*date == ' ' || *date == '\t') && date < end)
  date++;

  /* Don't want this to be localized. */
# define TMP_ISALPHA(x) (((x) >= 'A' && (x) <= 'Z') || \
             ((x) >= 'a' && (x) <= 'z'))

  /* take off day-of-the-week. */
  if (date >= end - 3)
  return false;
  if (!TMP_ISALPHA(date[0]) || !TMP_ISALPHA(date[1]) || !TMP_ISALPHA(date[2]))
  return false;
  date += 3;
  /* Skip horizontal whitespace (and commas) between dotw and month. */
  if (*date != ' ' && *date != '\t' && *date != ',')
  return false;
  while ((*date == ' ' || *date == '\t' || *date == ',') && date < end)
  date++;

  /* take off month. */
  if (date >= end - 3)
  return false;
  if (!TMP_ISALPHA(date[0]) || !TMP_ISALPHA(date[1]) || !TMP_ISALPHA(date[2]))
  return false;
  date += 3;
  /* Skip horizontal whitespace between month and dotm. */
  if (date == end || (*date != ' ' && *date != '\t'))
  return false;
  while ((*date == ' ' || *date == '\t') && date < end)
  date++;

  /* Skip over digits and whitespace. */
  while (((*date >= '0' && *date <= '9') || *date == ' ' || *date == '\t') &&
     date < end)
  date++;
  /* Next character should be a colon. */
  if (date >= end || *date != ':')
  return false;

  /* Ok, that ought to be enough... */

# undef TMP_ISALPHA

#else  /* !STRICT_ENVELOPE */

  if (buf_size < 5) return false;
  if (*buf != 'F') return false;
  if (strncmp(buf, "From ", 5)) return false;

#endif /* !STRICT_ENVELOPE */

  return true;
}

// We've found the start of the next message, so finish this one off.
NS_IMETHODIMP nsParseMailMessageState::FinishHeader()
{
  if (m_newMsgHdr)
  {
    m_newMsgHdr->SetMessageOffset(m_envelope_pos);
    m_newMsgHdr->SetMessageSize(m_position - m_envelope_pos);
    m_newMsgHdr->SetLineCount(m_body_lines);
  }
  return NS_OK;
}

NS_IMETHODIMP nsParseMailMessageState::GetAllHeaders(char ** pHeaders, int32_t *pHeadersSize)
{
  if (!pHeaders || !pHeadersSize)
    return NS_ERROR_NULL_POINTER;
  *pHeaders = m_headers.GetBuffer();
  *pHeadersSize = m_headers.GetBufferPos();
  return NS_OK;
}

// generate headers as a string, with CRLF between the headers
NS_IMETHODIMP nsParseMailMessageState::GetHeaders(char ** pHeaders)
{
  NS_ENSURE_ARG_POINTER(pHeaders);
  nsCString crlfHeaders;
  char *curHeader = m_headers.GetBuffer();
  for (uint32_t headerPos = 0; headerPos < m_headers.GetBufferPos();)
  {
    crlfHeaders.Append(curHeader);
    crlfHeaders.Append(CRLF);
    int32_t headerLen = strlen(curHeader);
    curHeader += headerLen + 1;
    headerPos += headerLen + 1;
  }
  *pHeaders = ToNewCString(crlfHeaders);
  return NS_OK;
}

struct message_header *nsParseMailMessageState::GetNextHeaderInAggregate (nsVoidArray &list)
{
  // When parsing a message with multiple To or CC header lines, we're storing each line in a
  // list, where the list represents the "aggregate" total of all the header. Here we get a new
  // line for the list

  struct message_header *header = (struct message_header*) PR_Calloc (1, sizeof(struct message_header));
  list.AppendElement (header);
  return header;
}

void nsParseMailMessageState::GetAggregateHeader (nsVoidArray &list, struct message_header *outHeader)
{
  // When parsing a message with multiple To or CC header lines, we're storing each line in a
  // list, where the list represents the "aggregate" total of all the header. Here we combine
  // all the lines together, as though they were really all found on the same line

  struct message_header *header = nullptr;
  int length = 0;
  int i;

  // Count up the bytes required to allocate the aggregated header
  for (i = 0; i < list.Count(); i++)
  {
    header = (struct message_header*) list.ElementAt(i);
    length += (header->length + 1); //+ for ","
    NS_ASSERTION(header->length == (int32_t)strlen(header->value), "header corrupted");
  }

  if (length > 0)
  {
    char *value = (char*) PR_CALLOC (length + 1); //+1 for null term
    if (value)
    {
      // Catenate all the To lines together, separated by commas
      value[0] = '\0';
      int size = list.Count();
      for (i = 0; i < size; i++)
      {
        header = (struct message_header*) list.ElementAt(i);
        PL_strncat (value, header->value, header->length);
        if (i + 1 < size)
          PL_strcat (value, ",");
      }
      outHeader->length = length;
      outHeader->value = value;
    }
  }
  else
  {
    outHeader->length = 0;
    outHeader->value = nullptr;
  }
}

void nsParseMailMessageState::ClearAggregateHeader (nsVoidArray &list)
{
  // Reset the aggregate headers. Free only the message_header struct since
  // we don't own the value pointer

  for (int i = 0; i < list.Count(); i++)
    PR_Free ((struct message_header*) list.ElementAt(i));
  list.Clear();
}

// We've found a new envelope to parse.
nsresult nsParseMailMessageState::StartNewEnvelope(const char *line, uint32_t lineLength)
{
  m_envelope_pos = m_position;
  m_state = nsIMsgParseMailMsgState::ParseHeadersState;
  m_position += lineLength;
  m_headerstartpos = m_position;
  return ParseEnvelope (line, lineLength);
}

/* largely lifted from mimehtml.c, which does similar parsing, sigh...
*/
nsresult nsParseMailMessageState::ParseHeaders ()
{
  char *buf = m_headers.GetBuffer();
  uint32_t buf_length = m_headers.GetBufferPos();
  char *buf_end = buf + buf_length;
  while (buf < buf_end)
  {
    char *colon = PL_strnchr(buf, ':', buf_length);
    char *end;
    char *value = 0;
    struct message_header *header = 0;
    struct message_header receivedBy;

    if (! colon)
      break;

    end = colon;

    switch (buf [0])
    {
    case 'B': case 'b':
      if (!PL_strncasecmp ("BCC", buf, end - buf))
        header = &m_bccList;
      break;
    case 'C': case 'c':
      if (!PL_strncasecmp ("CC", buf, end - buf))
        header = GetNextHeaderInAggregate(m_ccList);
      else if (!PL_strncasecmp ("Content-Type", buf, end - buf))
        header = &m_content_type;
      break;
    case 'D': case 'd':
      if (!PL_strncasecmp ("Date", buf, end - buf))
        header = &m_date;
      else if (!PL_strncasecmp("Disposition-Notification-To", buf, end - buf))
        header = &m_mdn_dnt;
      else if (!PL_strncasecmp("Delivery-date", buf, end - buf))
        header = &m_delivery_date;
      break;
    case 'F': case 'f':
      if (!PL_strncasecmp ("From", buf, end - buf))
        header = &m_from;
      break;
    case 'I' : case 'i':
      if (!PL_strncasecmp ("In-Reply-To", buf, end - buf))
        header = &m_in_reply_to;
      break;
    case 'M': case 'm':
      if (!PL_strncasecmp ("Message-ID", buf, end - buf))
        header = &m_message_id;
      break;
    case 'N': case 'n':
      if (!PL_strncasecmp ("Newsgroups", buf, end - buf))
        header = &m_newsgroups;
      break;
    case 'O': case 'o':
      if (!PL_strncasecmp ("Original-Recipient", buf, end - buf))
        header = &m_mdn_original_recipient;
      break;
    case 'R': case 'r':
      if (!PL_strncasecmp ("References", buf, end - buf))
        header = &m_references;
      else if (!PL_strncasecmp ("Return-Path", buf, end - buf))
        header = &m_return_path;
      // treat conventional Return-Receipt-To as MDN
      // Disposition-Notification-To
      else if (!PL_strncasecmp ("Return-Receipt-To", buf, end - buf))
        header = &m_mdn_dnt;
      else if (!PL_strncasecmp("Reply-To", buf, end - buf))
        header = &m_replyTo;
      else if (!PL_strncasecmp("Received", buf, end - buf))
      {
        header = &receivedBy;
        header->length = 0;
      }
      break;
    case 'S': case 's':
      if (!PL_strncasecmp ("Subject", buf, end - buf) && !m_subject.length)
        header = &m_subject;
      else if (!PL_strncasecmp ("Sender", buf, end - buf))
        header = &m_sender;
      else if (!PL_strncasecmp ("Status", buf, end - buf))
        header = &m_status;
      break;
    case 'T': case 't':
      if (!PL_strncasecmp ("To", buf, end - buf))
        header = GetNextHeaderInAggregate(m_toList);
      break;
    case 'X':
      if (X_MOZILLA_STATUS2_LEN == end - buf &&
        !PL_strncasecmp(X_MOZILLA_STATUS2, buf, end - buf) &&
        !m_IgnoreXMozillaStatus && !m_mozstatus2.length)
        header = &m_mozstatus2;
      else if ( X_MOZILLA_STATUS_LEN == end - buf &&
        !PL_strncasecmp(X_MOZILLA_STATUS, buf, end - buf) && !m_IgnoreXMozillaStatus
        && !m_mozstatus.length)
        header = &m_mozstatus;
      else if (!PL_strncasecmp(HEADER_X_MOZILLA_ACCOUNT_KEY, buf, end - buf)
        && !m_account_key.length)
        header = &m_account_key;
      // we could very well care what the priority header was when we
      // remember its value. If so, need to remember it here. Also,
      // different priority headers can appear in the same message,
      // but we only rememeber the last one that we see.
      else if (!PL_strncasecmp("X-Priority", buf, end - buf)
        || !PL_strncasecmp("Priority", buf, end - buf))
        header = &m_priority;
      else if (!PL_strncasecmp(HEADER_X_MOZILLA_KEYWORDS, buf, end - buf)
        && !m_keywords.length)
        header = &m_keywords;
      break;
    }
    if (!header && m_customDBHeaders.Length())
    {
#ifdef MOZILLA_INTERNAL_API
      nsDependentCSubstring headerStr(buf, end);
#else
      nsDependentCSubstring headerStr(buf, end - buf);
#endif

      ToLowerCase(headerStr);
      uint32_t customHeaderIndex = m_customDBHeaders.IndexOf(headerStr);
      if (customHeaderIndex != m_customDBHeaders.NoIndex)
        header = & m_customDBHeaderValues[customHeaderIndex];
    }

    buf = colon + 1;
    uint32_t writeOffset = 0; // number of characters replaced with a folded space

SEARCH_NEWLINE:
    // move past any non terminating characters, rewriting them if folding white space
    // exists
    while (buf < buf_end && *buf != '\r' && *buf != '\n')
    {
      if (writeOffset)
        *(buf - writeOffset) = *buf;
      buf++;
    }

    /* If "\r\n " or "\r\n\t" is next, that doesn't terminate the header. */
    if ((buf + 2 < buf_end && (buf[0] == '\r' && buf[1] == '\n') &&
                              (buf[2] == ' ' || buf[2] == '\t')) ||
    /* If "\r " or "\r\t" or "\n " or "\n\t" is next, that doesn't terminate
       the header either. */
        (buf + 1 < buf_end && (buf[0] == '\r' || buf[0] == '\n') &&
                              (buf[1] == ' ' || buf[1] == '\t')))
    {
      // locate the proper location for a folded space by eliminating any
      // leading spaces before the end-of-line character
      char* foldedSpace = buf;
      while (*(foldedSpace - 1) == ' ' || *(foldedSpace - 1) == '\t')
        foldedSpace--;

      // put a single folded space character
      *(foldedSpace - writeOffset) = ' ';
      writeOffset += (buf - foldedSpace);
      buf++;

      // eliminate any additional white space
      while (buf < buf_end &&
              (*buf == '\n' || *buf == '\r' || *buf == ' ' || *buf == '\t'))
      {
        buf++;
        writeOffset++;
      }
      goto SEARCH_NEWLINE;
    }

    if (header)
    {
      value = colon + 1;
      // eliminate trailing blanks after the colon
      while (*value == ' ' || *value == '\t')
        value++;

      header->value = value;
      header->length = buf - header->value - writeOffset;
    }
    if (*buf == '\r' || *buf == '\n')
    {
      char *last = buf - writeOffset;
      char *saveBuf = buf;
      if (*buf == '\r' && buf[1] == '\n')
        buf++;
      buf++;
      // null terminate the left-over slop so we don't confuse msg filters.
      *saveBuf = 0;
      *last = 0;  /* short-circuit const, and null-terminate header. */
    }

    if (header)
    {
      /* More const short-circuitry... */
      /* strip trailing whitespace */
      while (header->length > 0 &&
        IS_SPACE (header->value [header->length - 1]))
        ((char *) header->value) [--header->length] = 0;
      if (header == &receivedBy)
      {
        if (m_receivedTime == 0)
        {
          // parse Received: header for date.
          // We trust the first header as that is closest to recipient,
          // and less likely to be spoofed.
          nsAutoCString receivedHdr(header->value, header->length);
          int32_t lastSemicolon = receivedHdr.RFindChar(';');
          if (lastSemicolon != -1)
          {
            nsAutoCString receivedDate;
            receivedDate = Substring(receivedHdr, lastSemicolon + 1);
            receivedDate.Trim(" \t\b\r\n");
            PRTime resultTime;
            if (PR_ParseTimeString (receivedDate.get(), false, &resultTime) == PR_SUCCESS)
              m_receivedTime = resultTime;
            else
              NS_WARNING("PR_ParseTimeString failed in ParseHeaders().");
          }
        }
        // Someone might want the received header saved.
        if (m_customDBHeaders.Length())
        {
          if (m_customDBHeaders.Contains(NS_LITERAL_CSTRING("received")))
          {
            if (!m_receivedValue.IsEmpty())
              m_receivedValue.Append(' ');
            m_receivedValue.Append(header->value, header->length);
          }
        }
      }
    }
  }
  return NS_OK;
}

nsresult nsParseMailMessageState::ParseEnvelope (const char *line, uint32_t line_size)
{
  const char *end;
  char *s;

  m_envelope.AppendBuffer(line, line_size);
  end = m_envelope.GetBuffer() + line_size;
  s = m_envelope.GetBuffer() + 5;

  while (s < end && IS_SPACE (*s))
    s++;
  m_envelope_from.value = s;
  while (s < end && !IS_SPACE (*s))
    s++;
  m_envelope_from.length = s - m_envelope_from.value;

  while (s < end && IS_SPACE (*s))
    s++;
  m_envelope_date.value = s;
  m_envelope_date.length = (uint16_t) (line_size - (s - m_envelope.GetBuffer()));

  while (m_envelope_date.length > 0 &&
         IS_SPACE (m_envelope_date.value [m_envelope_date.length - 1]))
    m_envelope_date.length--;

  /* #### short-circuit const */
  ((char *) m_envelope_from.value) [m_envelope_from.length] = 0;
  ((char *) m_envelope_date.value) [m_envelope_date.length] = 0;

  return NS_OK;
}

#ifdef WE_CONDENSE_MIME_STRINGS
static char *
msg_condense_mime2_string(char *sourceStr)
{
  char *returnVal = strdup(sourceStr);
  if (!returnVal)
    return nullptr;

  MIME_StripContinuations(returnVal);

  return returnVal;
}
#endif // WE_CONDENSE_MIME_STRINGS

nsresult nsParseMailMessageState::InternSubject (struct message_header *header)
{
  char *key;
  uint32_t L;

  if (!header || header->length == 0)
  {
    m_newMsgHdr->SetSubject("");
    return NS_OK;
  }

  NS_ASSERTION (header->length == (short) strlen(header->value), "subject corrupt while parsing message");

  key = (char *) header->value;  /* #### const evilness */

  L = header->length;


  uint32_t flags;
  (void)m_newMsgHdr->GetFlags(&flags);
  /* strip "Re: " */
  /**
        We trust the X-Mozilla-Status line to be the smartest in almost
        all things.  One exception, however, is the HAS_RE flag.  Since
         we just parsed the subject header anyway, we expect that parsing
         to be smartest.  (After all, what if someone just went in and
        edited the subject line by hand?)
     */
  nsCString modifiedSubject;
  if (NS_MsgStripRE((const char **) &key, &L, getter_Copies(modifiedSubject)))
    flags |= nsMsgMessageFlags::HasRe;
  else
    flags &= ~nsMsgMessageFlags::HasRe;
  m_newMsgHdr->SetFlags(flags); // this *does not* update the mozilla-status header in the local folder

  //  if (!*key) return 0; /* To catch a subject of "Re:" */

  // Condense the subject text into as few MIME-2 encoded words as possible.
#ifdef WE_CONDENSE_MIME_STRINGS
  char *condensedKey = msg_condense_mime2_string(modifiedSubject.IsEmpty() ? key : modifiedSubject.get());
#else
  char *condensedKey = nullptr;
#endif
  m_newMsgHdr->SetSubject(condensedKey ? condensedKey :
  (modifiedSubject.IsEmpty() ? key : modifiedSubject.get()));
  PR_FREEIF(condensedKey);

  return NS_OK;
}

// we've reached the end of the envelope, and need to turn all our accumulated message_headers
// into a single nsIMsgDBHdr to store in a database.
nsresult nsParseMailMessageState::FinalizeHeaders()
{
  nsresult rv;
  struct message_header *sender;
  struct message_header *recipient;
  struct message_header *subject;
  struct message_header *id;
  struct message_header *inReplyTo;
  struct message_header *replyTo;
  struct message_header *references;
  struct message_header *date;
  struct message_header *deliveryDate;
  struct message_header *statush;
  struct message_header *mozstatus;
  struct message_header *mozstatus2;
  struct message_header *priority;
  struct message_header *keywords;
  struct message_header *account_key;
  struct message_header *ccList;
  struct message_header *bccList;
  struct message_header *mdn_dnt;
  struct message_header md5_header;
  struct message_header *content_type;
  char md5_data [50];

  const char *s;
  uint32_t flags = 0;
  uint32_t delta = 0;
  nsMsgPriorityValue priorityFlags = nsMsgPriority::notSet;
  uint32_t labelFlags = 0;

  if (!m_mailDB)    // if we don't have a valid db, skip the header.
    return NS_OK;

  struct message_header to;
  GetAggregateHeader (m_toList, &to);
  struct message_header cc;
  GetAggregateHeader (m_ccList, &cc);
  // we don't aggregate bcc, as we only generate it locally,
  // and we don't use multiple lines

  sender     = (m_from.length          ? &m_from :
  m_sender.length        ? &m_sender :
  m_envelope_from.length ? &m_envelope_from :
  0);
  recipient  = (to.length         ? &to :
  cc.length         ? &cc :
  m_newsgroups.length ? &m_newsgroups :
  0);
  ccList     = (cc.length ? &cc : 0);
  bccList    = (m_bccList.length    ? &m_bccList    : 0);
  subject    = (m_subject.length    ? &m_subject    : 0);
  id         = (m_message_id.length ? &m_message_id : 0);
  references = (m_references.length ? &m_references : 0);
  statush    = (m_status.length     ? &m_status     : 0);
  mozstatus  = (m_mozstatus.length  ? &m_mozstatus  : 0);
  mozstatus2 = (m_mozstatus2.length  ? &m_mozstatus2  : 0);
  date       = (m_date.length       ? &m_date :
  m_envelope_date.length ? &m_envelope_date :
  0);
  deliveryDate = (m_delivery_date.length ? &m_delivery_date : 0);
  priority   = (m_priority.length   ? &m_priority   : 0);
  keywords   =  (m_keywords.length   ? &m_keywords  : 0);
  mdn_dnt     = (m_mdn_dnt.length    ? &m_mdn_dnt    : 0);
  inReplyTo = (m_in_reply_to.length ? &m_in_reply_to : 0);
  replyTo = (m_replyTo.length ? &m_replyTo : 0);
  content_type = (m_content_type.length ? &m_content_type : 0);
  account_key = (m_account_key.length ? &m_account_key :0);

  if (mozstatus)
  {
    if (mozstatus->length == 4)
    {
      int i;
      for (i=0,s=mozstatus->value ; i<4 ; i++,s++)
      {
        flags = (flags << 4) | msg_UnHex(*s);
      }
      // strip off and remember priority bits.
      flags &= ~nsMsgMessageFlags::RuntimeOnly;
      priorityFlags = (nsMsgPriorityValue) ((flags & nsMsgMessageFlags::Priorities) >> 13);
      flags &= ~nsMsgMessageFlags::Priorities;
    }
    delta = (m_headerstartpos +
      (mozstatus->value - m_headers.GetBuffer()) -
      (2 + X_MOZILLA_STATUS_LEN)    /* 2 extra bytes for ": ". */
      ) - m_envelope_pos;
  }

  if (mozstatus2)
  {
    uint32_t flags2 = 0;
    sscanf(mozstatus2->value, " %x ", &flags2);
    flags |= flags2;
  }

  if (!(flags & nsMsgMessageFlags::Expunged))  // message was deleted, don't bother creating a hdr.
  {
    // We'll need the message id first to recover data from the backup database
    nsAutoCString rawMsgId;
    /* Take off <> around message ID. */
    if (id)
    {
      if (id->length > 0 && id->value[0] == '<')
        id->length--, id->value++;

      NS_WARN_IF_FALSE(id->length > 0, "id->length failure in FinalizeHeaders().");

      if (id->length > 0 && id->value[id->length - 1] == '>')
        /* generate a new null-terminated string without the final > */
        rawMsgId.Assign(id->value, id->length - 1);
      else
        rawMsgId.Assign(id->value);
    }

    /*
     * Try to copy the data from the backup database, referencing the MessageID
     * If that fails, just create a new header
     */
    nsCOMPtr<nsIMsgDBHdr> oldHeader;
    nsresult ret = NS_OK;

    if (m_backupMailDB && !rawMsgId.IsEmpty())
      ret = m_backupMailDB->GetMsgHdrForMessageID(
              rawMsgId.get(), getter_AddRefs(oldHeader));

    if (NS_SUCCEEDED(ret) && oldHeader)
        ret = m_mailDB->CopyHdrFromExistingHdr(m_envelope_pos,
                oldHeader, false, getter_AddRefs(m_newMsgHdr));
    else if (!m_newMsgHdr)
    {
      // Should assert that this is not a local message
      ret = m_mailDB->CreateNewHdr(m_envelope_pos, getter_AddRefs(m_newMsgHdr));
    }

    if (NS_SUCCEEDED(ret) && m_newMsgHdr)
    {
      uint32_t origFlags;
      (void)m_newMsgHdr->GetFlags(&origFlags);
      if (origFlags & nsMsgMessageFlags::HasRe)
        flags |= nsMsgMessageFlags::HasRe;
      else
        flags &= ~nsMsgMessageFlags::HasRe;

      flags &= ~nsMsgMessageFlags::Offline; // don't keep nsMsgMessageFlags::Offline for local msgs
      if (mdn_dnt && !(origFlags & nsMsgMessageFlags::Read) &&
          !(origFlags & nsMsgMessageFlags::MDNReportSent) &&
          !(flags & nsMsgMessageFlags::MDNReportSent))
        flags |= nsMsgMessageFlags::MDNReportNeeded;

      m_newMsgHdr->SetFlags(flags);
      if (priorityFlags != nsMsgPriority::notSet)
        m_newMsgHdr->SetPriority(priorityFlags);

      // if we have a reply to header, and it's different from the from: header,
      // set the "replyTo" attribute on the msg hdr.
      if (replyTo && (!sender || replyTo->length != sender->length || strncmp(replyTo->value, sender->value, sender->length)))
        m_newMsgHdr->SetStringProperty("replyTo", replyTo->value);
      // convert the flag values (0xE000000) to label values (0-5)
      if (mozstatus2) // only do this if we have a mozstatus2 header
      {
        labelFlags = ((flags & nsMsgMessageFlags::Labels) >> 25);
        m_newMsgHdr->SetLabel(labelFlags);
      }
      if (delta < 0xffff)
      {    /* Only use if fits in 16 bits. */
        m_newMsgHdr->SetStatusOffset((uint16_t) delta);
        if (!m_IgnoreXMozillaStatus) {  // imap doesn't care about X-MozillaStatus
          uint32_t offset;
          (void)m_newMsgHdr->GetStatusOffset(&offset);
          NS_ASSERTION(offset < 10000, "invalid status offset"); /* ### Debugging hack */
        }
      }
      if (sender)
        m_newMsgHdr->SetAuthor(sender->value);
      if (recipient == &m_newsgroups)
      {
      /* In the case where the recipient is a newsgroup, truncate the string
      at the first comma.  This is used only for presenting the thread list,
      and newsgroup lines tend to be long and non-shared, and tend to bloat
      the string table.  So, by only showing the first newsgroup, we can
      reduce memory and file usage at the expense of only showing the one
      group in the summary list, and only being able to sort on the first
        group rather than the whole list.  It's worth it. */
        char * ch;
        NS_ASSERTION (recipient->length == (uint16_t) strlen(recipient->value), "invalid recipient");
        ch = PL_strchr(recipient->value, ',');
        if (ch)
        {
          /* generate a new string that terminates before the , */
          nsAutoCString firstGroup;
          firstGroup.Assign(recipient->value, ch - recipient->value);
          m_newMsgHdr->SetRecipients(firstGroup.get());
        }
        m_newMsgHdr->SetRecipients(recipient->value);
      }
      else if (recipient)
      {
        // note that we're now setting the whole recipient list,
        // not just the pretty name of the first recipient.
        uint32_t numAddresses;
        char  *names;
        char  *addresses;

        ret = m_HeaderAddressParser->ParseHeaderAddresses(recipient->value,
                                                          &names, &addresses,
                                                          &numAddresses);
        if (NS_SUCCEEDED(ret))
        {
          m_newMsgHdr->SetRecipientsArray(names, addresses, numAddresses);
          PR_Free(addresses);
          PR_Free(names);
        }
        else {  // hmm, should we just use the original string?
          m_newMsgHdr->SetRecipients(recipient->value);
        }
      }
      if (ccList)
      {
        uint32_t numAddresses;
        char  *names;
        char  *addresses;

        ret = m_HeaderAddressParser->ParseHeaderAddresses(ccList->value,
                                                          &names, &addresses,
                                                          &numAddresses);
        if (NS_SUCCEEDED(ret) && numAddresses > 0)
        {
          m_newMsgHdr->SetCCListArray(names, addresses, numAddresses);
          PR_Free(addresses);
          PR_Free(names);
        }
        else  // hmm, should we just use the original string?
          m_newMsgHdr->SetCcList(ccList->value);
      }

      if (bccList)
      {
        uint32_t numAddresses;
        char  *names;
        char  *addresses;

        ret = m_HeaderAddressParser->ParseHeaderAddresses(bccList->value,
                                                          &names, &addresses,
                                                          &numAddresses);
        if (NS_SUCCEEDED(ret))
        {
          m_newMsgHdr->SetBCCListArray(names, addresses, numAddresses);
          PR_Free(addresses);
          PR_Free(names);
        }
        else  // hmm, should we just use the original string?
          m_newMsgHdr->SetBccList(bccList->value);
      }

      rv = InternSubject (subject);
      if (NS_SUCCEEDED(rv))
      {
        if (! id)
        {
          // what to do about this? we used to do a hash of all the headers...
          nsAutoCString hash;
          const char *md5_b64 = "dummy.message.id";
          nsresult rv;
          nsCOMPtr<nsICryptoHash> hasher = do_CreateInstance("@mozilla.org/security/hash;1", &rv);
          if (NS_SUCCEEDED(rv))
          {
            if (NS_SUCCEEDED(hasher->Init(nsICryptoHash::MD5)) &&
                NS_SUCCEEDED(hasher->Update((const uint8_t*) m_headers.GetBuffer(), m_headers.GetSize())) &&
                NS_SUCCEEDED(hasher->Finish(true, hash)))
              md5_b64 = hash.get();
          }
          PR_snprintf (md5_data, sizeof(md5_data), "<md5:%s>", md5_b64);
          md5_header.value = md5_data;
          md5_header.length = strlen(md5_data);
          id = &md5_header;
        }

        if (!rawMsgId.IsEmpty())
          m_newMsgHdr->SetMessageId(rawMsgId.get());
        else
          m_newMsgHdr->SetMessageId(id->value);
        m_mailDB->UpdatePendingAttributes(m_newMsgHdr);

        if (!mozstatus && statush)
        {
          /* Parse a little bit of the Berkeley Mail status header. */
          for (s = statush->value; *s; s++) {
            uint32_t msgFlags = 0;
            (void)m_newMsgHdr->GetFlags(&msgFlags);
            switch (*s)
            {
            case 'R': case 'r':
              m_newMsgHdr->SetFlags(msgFlags | nsMsgMessageFlags::Read);
              break;
            case 'D': case 'd':
              /* msg->flags |= nsMsgMessageFlags::Expunged;  ### Is this reasonable? */
              break;
            case 'N': case 'n':
            case 'U': case 'u':
              m_newMsgHdr->SetFlags(msgFlags & ~nsMsgMessageFlags::Read);
              break;
            default:            // Should check for corrupt file.
              NS_ERROR("Corrupt file. Should not happen.");
              break;
            }
          }
        }

        if (account_key != nullptr)
          m_newMsgHdr->SetAccountKey(account_key->value);
        // use in-reply-to header as references, if there's no references header
        if (references != nullptr)
          m_newMsgHdr->SetReferences(references->value);
        else if (inReplyTo != nullptr)
          m_newMsgHdr->SetReferences(inReplyTo->value);

        // 'Received' should be as reliable an indicator of the receipt
        // date+time as possible, whilst always giving something *from
        // the message*.  It won't use PR_Now() under any circumstance.
        // Therefore, the fall-thru order for 'Received' is:
        // Received: -> Delivery-date: -> date
        // 'Date' uses:
        // date -> PR_Now()
        //
        // date is:
        // Date: -> m_envelope_date

        uint32_t rcvTimeSecs = 0;
        if (date)
        {  // Date:
          PRTime resultTime;
          PRStatus timeStatus = PR_ParseTimeString (date->value, false, &resultTime);
          if (PR_SUCCESS == timeStatus)
          {
            m_newMsgHdr->SetDate(resultTime);
            PRTime2Seconds(resultTime, &rcvTimeSecs);
          }
          else
            NS_WARNING("PR_ParseTimeString of date failed in FinalizeHeader().");
        }
        else
        {  // PR_Now()
          // If there was some problem parsing the Date header *AND* we
          // couldn't get a valid envelope date, use now as the time.
          // PR_ParseTimeString won't touch resultTime unless it succeeds.
          // This doesn't affect local (POP3) messages, because we use the envelope
          // date if there's no Date: header, but it will affect IMAP msgs
          // w/o a Date: hdr or Received: headers.
          PRTime resultTime = PR_Now();
          m_newMsgHdr->SetDate(resultTime);
        }
        if (m_receivedTime != 0)
        {  // Upgrade 'Received' to Received: ?
          PRTime2Seconds(m_receivedTime, &rcvTimeSecs);
        }
        else if (deliveryDate)
        {  // Upgrade 'Received' to Delivery-date: ?
          PRTime resultTime;
          PRStatus timeStatus = PR_ParseTimeString (deliveryDate->value, false, &resultTime);
          if (PR_SUCCESS == timeStatus)
            PRTime2Seconds(resultTime, &rcvTimeSecs);
          else // TODO/FIXME: We need to figure out what to do in this case!
            NS_WARNING("PR_ParseTimeString of delivery date failed in FinalizeHeader().");
        }
        m_newMsgHdr->SetUint32Property("dateReceived", rcvTimeSecs);

        if (priority)
          m_newMsgHdr->SetPriorityString(priority->value);
        else if (priorityFlags == nsMsgPriority::notSet)
          m_newMsgHdr->SetPriority(nsMsgPriority::none);
        if (keywords)
        {
          // When there are many keywords, some may not have been written
          // to the message file, so add extra keywords from the backup
          nsAutoCString oldKeywords;
          m_newMsgHdr->GetStringProperty("keywords", getter_Copies(oldKeywords));
          nsTArray<nsCString> newKeywordArray, oldKeywordArray;
          ParseString(Substring(keywords->value, keywords->value + keywords->length), ' ', newKeywordArray);
          ParseString(oldKeywords, ' ', oldKeywordArray);
          for (uint32_t i = 0; i < oldKeywordArray.Length(); i++)
            if (!newKeywordArray.Contains(oldKeywordArray[i]))
              newKeywordArray.AppendElement(oldKeywordArray[i]);
          nsAutoCString newKeywords;
          for (uint32_t i = 0; i < newKeywordArray.Length(); i++)
          {
            if (i)
              newKeywords.Append(" ");
            newKeywords.Append(newKeywordArray[i]);
          }
          m_newMsgHdr->SetStringProperty("keywords", newKeywords.get());
        }
        for (uint32_t i = 0; i < m_customDBHeaders.Length(); i++)
        {
          if (m_customDBHeaderValues[i].length)
            m_newMsgHdr->SetStringProperty(m_customDBHeaders[i].get(), m_customDBHeaderValues[i].value);
          // The received header is accumulated separately
          if (m_customDBHeaders[i].EqualsLiteral("received") && !m_receivedValue.IsEmpty())
            m_newMsgHdr->SetStringProperty("received", m_receivedValue.get());
        }
        if (content_type)
        {
          char *substring = PL_strstr(content_type->value, "charset");
          if (substring)
          {
            char *charset = PL_strchr (substring, '=');
            if (charset)
            {
              charset++;
              /* strip leading whitespace and double-quote */
              while (*charset && (IS_SPACE (*charset) || '\"' == *charset))
                charset++;
              /* strip trailing whitespace and double-quote */
              char *end = charset;
              while (*end && !IS_SPACE (*end) && '\"' != *end && ';' != *end)
                end++;
              if (*charset)
              {
                if (*end != '\0') {
                  // if we're not at the very end of the line, we need
                  // to generate a new string without the trailing crud
                  nsAutoCString rawCharSet;
                  rawCharSet.Assign(charset, end - charset);
                  m_newMsgHdr->SetCharset(rawCharSet.get());
                } else {
                  m_newMsgHdr->SetCharset(charset);
                }
              }
            }
          }
          substring = PL_strcasestr(content_type->value, "multipart/mixed");
          if (substring)
          {
            uint32_t newFlags;
            m_newMsgHdr->OrFlags(nsMsgMessageFlags::Attachment, &newFlags);
          }
        }
      }
    }
    else
    {
      NS_ASSERTION(false, "error creating message header");
      rv = NS_ERROR_OUT_OF_MEMORY;
    }
  }
  else
    rv = NS_OK;

  //### why is this stuff const?
  char *tmp = (char*) to.value;
  PR_Free(tmp);
  tmp = (char*) cc.value;
  PR_Free(tmp);

  return rv;
}

nsParseNewMailState::nsParseNewMailState()
    : m_disableFilters(false)
{
  m_ibuffer = nullptr;
  m_ibuffer_size = 0;
  m_ibuffer_fp = 0;
  m_numNotNewMessages = 0;
 }

NS_IMPL_ISUPPORTS_INHERITED1(nsParseNewMailState, nsMsgMailboxParser, nsIMsgFilterHitNotify)

nsresult
nsParseNewMailState::Init(nsIMsgFolder *serverFolder, nsIMsgFolder *downloadFolder,
                          nsIMsgWindow *aMsgWindow, nsIMsgDBHdr *aHdr,
                          nsIOutputStream *aOutputStream)
{
  nsresult rv;
  Clear();
  m_rootFolder = serverFolder;
  m_msgWindow = aMsgWindow;
  m_downloadFolder = downloadFolder;

  m_newMsgHdr = aHdr;
  m_outputStream = aOutputStream;
  // the new mail parser isn't going to get the stream input, it seems, so we can't use
  // the OnStartRequest mechanism the mailbox parser uses. So, let's open the db right now.
  nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
  if (msgDBService && !m_mailDB)
    rv = msgDBService->OpenFolderDB(downloadFolder, false,
                                    getter_AddRefs(m_mailDB));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsIMsgFolder> rootMsgFolder = do_QueryInterface(serverFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = rootMsgFolder->GetServer(getter_AddRefs(server));
  if (NS_SUCCEEDED(rv))
  {
    rv = server->GetFilterList(aMsgWindow, getter_AddRefs(m_filterList));

    if (m_filterList)
      rv = server->ConfigureTemporaryFilters(m_filterList);
    // check if this server defers to another server, in which case
    // we'll use that server's filters as well.
    nsCOMPtr <nsIMsgFolder> deferredToRootFolder;
    server->GetRootMsgFolder(getter_AddRefs(deferredToRootFolder));
    if (rootMsgFolder != deferredToRootFolder)
    {
      nsCOMPtr <nsIMsgIncomingServer> deferredToServer;
      deferredToRootFolder->GetServer(getter_AddRefs(deferredToServer));
      if (deferredToServer)
        deferredToServer->GetFilterList(aMsgWindow, getter_AddRefs(m_deferredToServerFilterList));
    }
  }
  m_disableFilters = false;
  return NS_OK;
}

nsParseNewMailState::~nsParseNewMailState()
{
  if (m_mailDB)
    m_mailDB->Close(true);
  if (m_backupMailDB)
    m_backupMailDB->ForceClosed();
#ifdef DOING_JSFILTERS
  JSFilter_cleanup();
#endif
}

// not an IMETHOD so we don't need to do error checking or return an error.
// We only have one caller.
void nsParseNewMailState::GetMsgWindow(nsIMsgWindow **aMsgWindow)
{
  NS_IF_ADDREF(*aMsgWindow = m_msgWindow);
}


// This gets called for every message because libnet calls IncorporateBegin,
// IncorporateWrite (once or more), and IncorporateComplete for every message.
void nsParseNewMailState::DoneParsingFolder(nsresult status)
{
  /* End of file.  Flush out any partial line remaining in the buffer. */
  if (m_ibuffer_fp > 0)
  {
    ParseFolderLine(m_ibuffer, m_ibuffer_fp);
    m_ibuffer_fp = 0;
  }
  PublishMsgHeader(nullptr);
  if (m_mailDB)  // finished parsing, so flush db folder info
    UpdateDBFolderInfo();

    /* We're done reading the folder - we don't need these things
   any more. */
  PR_FREEIF (m_ibuffer);
  m_ibuffer_size = 0;
  PR_FREEIF (m_obuffer);
  m_obuffer_size = 0;
}

void nsParseNewMailState::OnNewMessage(nsIMsgWindow *msgWindow)
{
}

int32_t nsParseNewMailState::PublishMsgHeader(nsIMsgWindow *msgWindow)
{
  bool moved = false;
  FinishHeader();

  if (m_newMsgHdr)
  {
    uint32_t newFlags, oldFlags;
    m_newMsgHdr->GetFlags(&oldFlags);
    if (!(oldFlags & nsMsgMessageFlags::Read)) // don't mark read messages as new.
      m_newMsgHdr->OrFlags(nsMsgMessageFlags::New, &newFlags);

    if (!m_disableFilters)
    {
      uint64_t msgOffset;
      (void) m_newMsgHdr->GetMessageOffset(&msgOffset);
      m_curHdrOffset = msgOffset;

      nsCOMPtr<nsIMsgIncomingServer> server;
      nsresult rv = m_rootFolder->GetServer(getter_AddRefs(server));
      NS_ENSURE_SUCCESS(rv, 0);
      int32_t duplicateAction;
      server->GetIncomingDuplicateAction(&duplicateAction);
      if (duplicateAction != nsIMsgIncomingServer::keepDups)
      {
        bool isDup;
        server->IsNewHdrDuplicate(m_newMsgHdr, &isDup);
        if (isDup)
        {
          // we want to do something similar to applying filter hits.
          // if a dup is marked read, it shouldn't trigger biff.
          // Same for deleting it or moving it to trash.
          switch (duplicateAction)
          {
            case nsIMsgIncomingServer::deleteDups:
              {
              nsCOMPtr<nsIMsgPluggableStore> msgStore;
              nsresult rv =
                m_downloadFolder->GetMsgStore(getter_AddRefs(msgStore));
              if (NS_SUCCEEDED(rv))
              {
                rv = msgStore->DiscardNewMessage(m_outputStream, m_newMsgHdr);
                if (NS_FAILED(rv))
                  m_rootFolder->ThrowAlertMsg("dupDeleteFolderTruncateFailed", msgWindow);
              }
                m_mailDB->RemoveHeaderMdbRow(m_newMsgHdr);
              }
              break;
            case nsIMsgIncomingServer::moveDupsToTrash:
              {
                nsCOMPtr <nsIMsgFolder> trash;
                GetTrashFolder(getter_AddRefs(trash));
                if (trash)
                {
                  uint32_t newFlags;
                bool msgMoved;
                  m_newMsgHdr->AndFlags(~nsMsgMessageFlags::New, &newFlags);
                nsCOMPtr<nsIMsgPluggableStore> msgStore;
                rv = m_downloadFolder->GetMsgStore(getter_AddRefs(msgStore));
                if (NS_SUCCEEDED(rv))
                  msgStore->MoveNewlyDownloadedMessage(m_newMsgHdr, trash, &msgMoved);
                if (!msgMoved)
                {
                  MoveIncorporatedMessage(m_newMsgHdr, m_mailDB, trash,
                                                          nullptr, msgWindow);
                  m_mailDB->RemoveHeaderMdbRow(m_newMsgHdr);
                }
                }
              }
              break;
            case nsIMsgIncomingServer::markDupsRead:
              MarkFilteredMessageRead(m_newMsgHdr);
              break;
          }
          int32_t numNewMessages;
          m_downloadFolder->GetNumNewMessages(false, &numNewMessages);
          m_downloadFolder->SetNumNewMessages(numNewMessages - 1);

          m_newMsgHdr = nullptr;
          return 0;
        }
      }

      ApplyFilters(&moved, msgWindow, msgOffset);
    }
    if (!moved)
    {
      if (m_mailDB)
      {
        m_mailDB->AddNewHdrToDB(m_newMsgHdr, true);
        nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
        if (notifier)
          notifier->NotifyMsgAdded(m_newMsgHdr);
        // mark the header as not yet reported classified
        nsMsgKey msgKey;
        m_newMsgHdr->GetMessageKey(&msgKey);
        m_downloadFolder->OrProcessingFlags(
           msgKey, nsMsgProcessingFlags::NotReportedClassified);
      }
    } // if it was moved by imap filter, m_parseMsgState->m_newMsgHdr == nullptr
    m_newMsgHdr = nullptr;
  }
  return 0;
}

// We've found the start of the next message, so finish this one off.
NS_IMETHODIMP nsParseNewMailState::FinishHeader()
{
  if (m_newMsgHdr)
  {
    m_newMsgHdr->SetMessageSize(m_position - m_envelope_pos);
    m_newMsgHdr->SetLineCount(m_body_lines);
  }
  return NS_OK;
}

nsresult nsParseNewMailState::GetTrashFolder(nsIMsgFolder **pTrashFolder)
{
  nsresult rv=NS_ERROR_UNEXPECTED;
  if (!pTrashFolder)
    return NS_ERROR_NULL_POINTER;

  if (m_downloadFolder)
  {
    nsCOMPtr <nsIMsgIncomingServer> incomingServer;
    m_downloadFolder->GetServer(getter_AddRefs(incomingServer));
    nsCOMPtr <nsIMsgFolder> rootMsgFolder;
    incomingServer->GetRootMsgFolder(getter_AddRefs(rootMsgFolder));
    if (rootMsgFolder)
    {
      rv = rootMsgFolder->GetFolderWithFlags(nsMsgFolderFlags::Trash, pTrashFolder);
      if (!*pTrashFolder)
        rv = NS_ERROR_FAILURE;
    }
  }
  return rv;
}

void nsParseNewMailState::ApplyFilters(bool *pMoved, nsIMsgWindow *msgWindow, uint32_t msgOffset)
{
  m_msgMovedByFilter = m_msgCopiedByFilter = false;
  m_curHdrOffset = msgOffset;

  if (!m_disableFilters)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr = m_newMsgHdr;
    nsCOMPtr<nsIMsgFolder> downloadFolder = m_downloadFolder;
    nsCOMPtr <nsIMsgFolder> rootMsgFolder = do_QueryInterface(m_rootFolder);
    if (rootMsgFolder)
    {
      if (!downloadFolder)
        rootMsgFolder->GetFolderWithFlags(nsMsgFolderFlags::Inbox,
                                          getter_AddRefs(downloadFolder));
      if (downloadFolder)
        downloadFolder->GetURI(m_inboxUri);
      char * headers = m_headers.GetBuffer();
      uint32_t headersSize = m_headers.GetBufferPos();
      nsresult matchTermStatus;
      if (m_filterList)
        matchTermStatus =
          m_filterList->ApplyFiltersToHdr(nsMsgFilterType::InboxRule, msgHdr,
                                          downloadFolder, m_mailDB, headers,
                                          headersSize, this, msgWindow);
      if (!m_msgMovedByFilter && m_deferredToServerFilterList)
      {
        matchTermStatus = m_deferredToServerFilterList->
          ApplyFiltersToHdr(nsMsgFilterType::InboxRule, msgHdr, downloadFolder,
                            m_mailDB, headers, headersSize, this, msgWindow);
      }
    }
  }
  if (pMoved)
    *pMoved = m_msgMovedByFilter;
}

NS_IMETHODIMP nsParseNewMailState::ApplyFilterHit(nsIMsgFilter *filter, nsIMsgWindow *msgWindow, bool *applyMore)
{
  NS_ENSURE_ARG_POINTER(filter);
  NS_ENSURE_ARG_POINTER(applyMore);

  uint32_t newFlags;
  nsresult rv = NS_OK;

  *applyMore = true;

  nsCOMPtr<nsIMsgDBHdr> msgHdr = m_newMsgHdr;

  nsCOMPtr<nsIArray> filterActionList;

  rv = filter->GetSortedActionList(getter_AddRefs(filterActionList));
  NS_ENSURE_SUCCESS(rv, rv);

  uint32_t numActions;
  rv = filterActionList->GetLength(&numActions);
  NS_ENSURE_SUCCESS(rv, rv);

  bool loggingEnabled = false;
  if (m_filterList && numActions)
    m_filterList->GetLoggingEnabled(&loggingEnabled);

  bool msgIsNew = true;
  for (uint32_t actionIndex = 0; actionIndex < numActions && *applyMore; actionIndex++)
  {
    nsCOMPtr<nsIMsgRuleAction> filterAction;
    rv = filterActionList->QueryElementAt(actionIndex, NS_GET_IID(nsIMsgRuleAction),
                                                       getter_AddRefs(filterAction));
    if (NS_FAILED(rv) || !filterAction)
      continue;

    nsMsgRuleActionType actionType;
    if (NS_SUCCEEDED(filterAction->GetType(&actionType)))
    {
      nsCString actionTargetFolderUri;
      if (actionType == nsMsgFilterAction::MoveToFolder ||
          actionType == nsMsgFilterAction::CopyToFolder)
      {

        rv = filterAction->GetTargetFolderUri(actionTargetFolderUri);
        if (NS_FAILED(rv) || actionTargetFolderUri.IsEmpty())
        {
          NS_ASSERTION(false, "actionTargetFolderUri is empty");
          continue;
        }
      }
      switch (actionType)
      {
      case nsMsgFilterAction::Delete:
        {
          nsCOMPtr <nsIMsgFolder> trash;
          // set value to trash folder
          rv = GetTrashFolder(getter_AddRefs(trash));
          if (NS_SUCCEEDED(rv) && trash)
            rv = trash->GetURI(actionTargetFolderUri);

          msgHdr->OrFlags(nsMsgMessageFlags::Read, &newFlags); // mark read in trash.
          msgIsNew = false;
        }
      case nsMsgFilterAction::MoveToFolder:
        // if moving to a different file, do it.
        if (actionTargetFolderUri.get() && !m_inboxUri.Equals(actionTargetFolderUri,
                                                              nsCaseInsensitiveCStringComparator()))
        {
          nsresult err;
          nsCOMPtr<nsIRDFService> rdf(do_GetService(kRDFServiceCID, &err));
          NS_ENSURE_SUCCESS(err, err);
          nsCOMPtr<nsIRDFResource> res;
          err = rdf->GetResource(actionTargetFolderUri, getter_AddRefs(res));
          if (NS_FAILED(err))
            return err;

          nsCOMPtr<nsIMsgFolder> destIFolder(do_QueryInterface(res, &err));
          if (NS_FAILED(err))
            return err;
          bool msgMoved = false;
          // if we're moving to an imap folder, or this message has already 
          // has a pending copy action, use the imap coalescer so that
          // we won't truncate the inbox before the copy fires.
          if (m_msgCopiedByFilter ||
              StringBeginsWith(actionTargetFolderUri, NS_LITERAL_CSTRING("imap:")))
          {
            if (!m_moveCoalescer)
              m_moveCoalescer = new nsImapMoveCoalescer(m_downloadFolder, m_msgWindow);
            NS_ENSURE_TRUE(m_moveCoalescer, NS_ERROR_OUT_OF_MEMORY);
            nsMsgKey msgKey;
            (void) msgHdr->GetMessageKey(&msgKey);
            m_moveCoalescer->AddMove(destIFolder , msgKey);
            if (loggingEnabled)
              (void)filter->LogRuleHit(filterAction, msgHdr);
            err = NS_OK;
            msgIsNew = false;
          }
          else
          {
            nsCOMPtr<nsIMsgPluggableStore> msgStore;
            err = m_downloadFolder->GetMsgStore(getter_AddRefs(msgStore));
            if (NS_SUCCEEDED(err))
              msgStore->MoveNewlyDownloadedMessage(msgHdr, destIFolder, &msgMoved);
            if (!msgMoved)
              err = MoveIncorporatedMessage(msgHdr, m_mailDB, destIFolder,
                                            filter, msgWindow);
            m_msgMovedByFilter = NS_SUCCEEDED(err);
            if (m_msgMovedByFilter)
            {
              if (loggingEnabled)
                (void)filter->LogRuleHit(filterAction, msgHdr);
            }
          }
        }
        *applyMore = false;
        break;
        case nsMsgFilterAction::CopyToFolder:
        {
          nsCString uri;
          rv = m_rootFolder->GetURI(uri);

          if (!actionTargetFolderUri.IsEmpty() && !actionTargetFolderUri.Equals(uri))
          {
            nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID));
            messageArray->AppendElement(msgHdr, false);

            nsCOMPtr<nsIMsgFolder> dstFolder;
            rv = GetExistingFolder(actionTargetFolderUri,
                                   getter_AddRefs(dstFolder));
            NS_ENSURE_SUCCESS(rv, rv);

            nsCOMPtr<nsIMsgCopyService> copyService =
              do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
            NS_ENSURE_SUCCESS(rv, rv);
            rv = copyService->CopyMessages(m_downloadFolder, messageArray, dstFolder,
                                           false, nullptr, msgWindow, false);
            NS_ENSURE_SUCCESS(rv, rv);
            m_msgCopiedByFilter = true;
          }
        }
        break;
      case nsMsgFilterAction::MarkRead:
        msgIsNew = false;
        MarkFilteredMessageRead(msgHdr);
        break;
      case nsMsgFilterAction::MarkUnread:
        msgIsNew = true;
        MarkFilteredMessageUnread(msgHdr);
        break;
      case nsMsgFilterAction::KillThread:
        msgHdr->SetUint32Property("ProtoThreadFlags", nsMsgMessageFlags::Ignored);
        break;
      case nsMsgFilterAction::KillSubthread:
        msgHdr->OrFlags(nsMsgMessageFlags::Ignored, &newFlags);
        break;
      case nsMsgFilterAction::WatchThread:
        msgHdr->OrFlags(nsMsgMessageFlags::Watched, &newFlags);
        break;
      case nsMsgFilterAction::MarkFlagged:
        {
          nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID));
          messageArray->AppendElement(msgHdr, false);
          m_downloadFolder->MarkMessagesFlagged(messageArray, true);
        }
        break;
      case nsMsgFilterAction::ChangePriority:
        nsMsgPriorityValue filterPriority;
        filterAction->GetPriority(&filterPriority);
        msgHdr->SetPriority(filterPriority);
        break;
      case nsMsgFilterAction::AddTag:
      {
        nsCString keyword;
        filterAction->GetStrValue(keyword);
        nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID));
        messageArray->AppendElement(msgHdr, false);
        m_downloadFolder->AddKeywordsToMessages(messageArray, keyword);
        break;
      }
      case nsMsgFilterAction::Label:
        nsMsgLabelValue filterLabel;
        filterAction->GetLabel(&filterLabel);
        nsMsgKey msgKey;
        msgHdr->GetMessageKey(&msgKey);
        m_mailDB->SetLabel(msgKey, filterLabel);
        break;
      case nsMsgFilterAction::JunkScore:
      {
        nsAutoCString junkScoreStr;
        int32_t junkScore;
        filterAction->GetJunkScore(&junkScore);
        junkScoreStr.AppendInt(junkScore);
        if (junkScore == nsIJunkMailPlugin::IS_SPAM_SCORE)
          msgIsNew = false;
        nsMsgKey msgKey;
        msgHdr->GetMessageKey(&msgKey);
        msgHdr->SetStringProperty("junkscore", junkScoreStr.get());
        msgHdr->SetStringProperty("junkscoreorigin", "filter");
        break;
      }
      case nsMsgFilterAction::Forward:
        {
          nsCString forwardTo;
          filterAction->GetStrValue(forwardTo);
          m_forwardTo.AppendElement(forwardTo);
          m_msgToForwardOrReply = msgHdr;
        }
        break;
      case nsMsgFilterAction::Reply:
        {
          nsCString replyTemplateUri;
          filterAction->GetStrValue(replyTemplateUri);
          m_replyTemplateUri.AppendElement(replyTemplateUri);
          m_msgToForwardOrReply = msgHdr;
        }
        break;
      case nsMsgFilterAction::DeleteFromPop3Server:
        {
          uint32_t flags = 0;
          nsCOMPtr <nsIMsgFolder> downloadFolder;
          msgHdr->GetFolder(getter_AddRefs(downloadFolder));
          nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(downloadFolder);
          msgHdr->GetFlags(&flags);
          if (localFolder)
          {
            nsCOMPtr<nsIMutableArray> messages = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
            NS_ENSURE_SUCCESS(rv, rv);
            messages->AppendElement(msgHdr, false);
            // This action ignores the deleteMailLeftOnServer preference
            localFolder->MarkMsgsOnPop3Server(messages, POP3_FORCE_DEL);

            // If this is just a header, throw it away. It's useless now
            // that the server copy is being deleted.
            if (flags & nsMsgMessageFlags::Partial)
            {
              m_msgMovedByFilter = true;
              msgIsNew = false;
            }
          }
        }
        break;
      case nsMsgFilterAction::FetchBodyFromPop3Server:
        {
          uint32_t flags = 0;
          nsCOMPtr <nsIMsgFolder> downloadFolder;
          msgHdr->GetFolder(getter_AddRefs(downloadFolder));
          nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(downloadFolder);
          msgHdr->GetFlags(&flags);
          if (localFolder && (flags & nsMsgMessageFlags::Partial))
          {
            nsCOMPtr<nsIMutableArray> messages = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
            NS_ENSURE_SUCCESS(rv, rv);
            messages->AppendElement(msgHdr, false);
            localFolder->MarkMsgsOnPop3Server(messages, POP3_FETCH_BODY);
            // Don't add this header to the DB, we're going to replace it
            // with the full message.
            m_msgMovedByFilter = true;
            msgIsNew = false;
            // Don't do anything else in this filter, wait until we
            // have the full message.
            *applyMore = false;
          }
        }
        break;

      case nsMsgFilterAction::StopExecution:
      {
        // don't apply any more filters
        *applyMore = false;
      }
      break;

      case nsMsgFilterAction::Custom:
      {
        nsCOMPtr<nsIMsgFilterCustomAction> customAction;
        rv = filterAction->GetCustomAction(getter_AddRefs(customAction));
        NS_ENSURE_SUCCESS(rv, rv);

        nsAutoCString value;
        filterAction->GetStrValue(value);

        nsCOMPtr<nsIMutableArray> messageArray(
            do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
        NS_ENSURE_TRUE(messageArray, rv);
        messageArray->AppendElement(msgHdr, false);

        customAction->Apply(messageArray, value, nullptr,
                            nsMsgFilterType::InboxRule, msgWindow);
      }
      break;


      default:
        break;
      }
      if (loggingEnabled && actionType != nsMsgFilterAction::MoveToFolder && actionType != nsMsgFilterAction::Delete)
        (void)filter->LogRuleHit(filterAction, msgHdr);
    }
  }
  if (!msgIsNew)
  {
    int32_t numNewMessages;
    m_downloadFolder->GetNumNewMessages(false, &numNewMessages);
    if (numNewMessages > 0)
      m_downloadFolder->SetNumNewMessages(numNewMessages - 1);
    m_numNotNewMessages++;
  }
  return rv;
}

// this gets run in a second pass, after apply filters to a header.
nsresult nsParseNewMailState::ApplyForwardAndReplyFilter(nsIMsgWindow *msgWindow)
{
  nsresult rv = NS_OK;
  nsCOMPtr <nsIMsgIncomingServer> server;

  uint32_t i;
  uint32_t count = m_forwardTo.Length();
  for (i = 0; i < count; i++)
  {
    if (!m_forwardTo[i].IsEmpty())
    {
      nsAutoString forwardStr;
      CopyASCIItoUTF16(m_forwardTo[i], forwardStr);
      rv = m_rootFolder->GetServer(getter_AddRefs(server));
      NS_ENSURE_SUCCESS(rv, rv);
      {
        nsCOMPtr<nsIMsgComposeService> compService =
          do_GetService (NS_MSGCOMPOSESERVICE_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        rv = compService->ForwardMessage(forwardStr, m_msgToForwardOrReply,
                                         msgWindow, server,
                                         nsIMsgComposeService::kForwardAsDefault);
      }
    }
  }
  m_forwardTo.Clear();

  count = m_replyTemplateUri.Length();
  for (i = 0; i < count; i++)
  {
    if (!m_replyTemplateUri[i].IsEmpty())
    {
      // copy this and truncate the original, so we don't accidentally re-use it on the next hdr.
      rv = m_rootFolder->GetServer(getter_AddRefs(server));
      if (server)
      {
        nsCOMPtr <nsIMsgComposeService> compService = do_GetService (NS_MSGCOMPOSESERVICE_CONTRACTID) ;
        if (compService)
          rv = compService->ReplyWithTemplate(m_msgToForwardOrReply,
                                              m_replyTemplateUri[i].get(),
                                              msgWindow, server);
      }
    }
  }
  m_replyTemplateUri.Clear();
  m_msgToForwardOrReply = nullptr;
  return rv;
}

void nsParseNewMailState::MarkFilteredMessageRead(nsIMsgDBHdr *msgHdr)
{
  nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID));
  messageArray->AppendElement(msgHdr, false);
  m_downloadFolder->MarkMessagesRead(messageArray, true);
}

void nsParseNewMailState::MarkFilteredMessageUnread(nsIMsgDBHdr *msgHdr)
{
  uint32_t newFlags;
  if (m_mailDB)
  {
    nsMsgKey msgKey;
    msgHdr->GetMessageKey(&msgKey);
    m_mailDB->AddToNewList(msgKey);
  }
  else
  {
    msgHdr->OrFlags(nsMsgMessageFlags::New, &newFlags);
  }
  nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID));
  messageArray->AppendElement(msgHdr, false);
  m_downloadFolder->MarkMessagesRead(messageArray, false);
}

nsresult nsParseNewMailState::EndMsgDownload()
{
  if (m_moveCoalescer)
    m_moveCoalescer->PlaybackMoves();

  // need to do this for all folders that had messages filtered into them
  uint32_t serverCount = m_filterTargetFolders.Count();
  nsresult rv;
  nsCOMPtr<nsIMsgMailSession> session =
           do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv) && session) // don't use NS_ENSURE_SUCCESS here - we need to release semaphore below
  {
    for (uint32_t index = 0; index < serverCount; index++)
    {
      bool folderOpen;
      session->IsFolderOpenInWindow(m_filterTargetFolders[index], &folderOpen);
      if (!folderOpen)
      {
        uint32_t folderFlags;
        m_filterTargetFolders[index]->GetFlags(&folderFlags);
        if (! (folderFlags & (nsMsgFolderFlags::Trash | nsMsgFolderFlags::Inbox)))
        {
          bool filtersRun;
          m_filterTargetFolders[index]->CallFilterPlugins(nullptr, &filtersRun);
          if (!filtersRun)
            m_filterTargetFolders[index]->SetMsgDatabase(nullptr);
        }
      }
    }
  }
  m_filterTargetFolders.Clear();
  return rv;
}

nsresult nsParseNewMailState::AppendMsgFromStream(nsIInputStream *fileStream,
                                                  nsIMsgDBHdr *aHdr,
                                                  uint32_t length,
                                                  nsIMsgFolder *destFolder)
{
  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(fileStream);
  nsCOMPtr<nsIMsgPluggableStore> store;
  nsCOMPtr<nsIOutputStream> destOutputStream;
  nsresult rv = destFolder->GetMsgStore(getter_AddRefs(store));
  NS_ENSURE_SUCCESS(rv, rv);
  bool reusable;
  rv = store->GetNewMsgOutputStream(destFolder, &aHdr, &reusable,
                                    getter_AddRefs(destOutputStream));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!m_ibuffer)
    m_ibuffer_size = 10240;
  m_ibuffer_fp = 0;

  while (!m_ibuffer && (m_ibuffer_size >= 512))
  {
    m_ibuffer = (char *) PR_Malloc(m_ibuffer_size);
    if (m_ibuffer == nullptr)
      m_ibuffer_size /= 2;
  }
  NS_ASSERTION(m_ibuffer != nullptr, "couldn't get memory to move msg");
  while ((length > 0) && m_ibuffer)
  {
    uint32_t nRead;
    fileStream->Read (m_ibuffer, length > m_ibuffer_size ? m_ibuffer_size  : length, &nRead);
    if (nRead == 0)
      break;

    uint32_t bytesWritten;
    // Check the number of bytes actually written to the stream.
    destOutputStream->Write(m_ibuffer, nRead, &bytesWritten);
    if (bytesWritten != nRead)
    {
      destOutputStream->Close();
      return NS_MSG_ERROR_WRITING_MAIL_FOLDER;
    }

    length -= nRead;
  }

  NS_ASSERTION(length == 0, "didn't read all of original message in filter move");

  // non-reusable streams will get closed by the store.
  if (reusable)
    destOutputStream->Close();
  return store->FinishNewMessage(destOutputStream, aHdr);
}

nsresult nsParseNewMailState::MoveIncorporatedMessage(nsIMsgDBHdr *mailHdr,
                                                      nsIMsgDatabase *sourceDB,
                                                      nsIMsgFolder *destIFolder,
                                                      nsIMsgFilter *filter,
                                                      nsIMsgWindow *msgWindow)
{
  NS_ENSURE_ARG_POINTER(destIFolder);
  nsresult rv = NS_OK;

  // check if the destination is a real folder (by checking for null parent)
  // and if it can file messages (e.g., servers or news folders can't file messages).
  // Or read only imap folders...
  bool canFileMessages = true;
  nsCOMPtr<nsIMsgFolder> parentFolder;
  destIFolder->GetParent(getter_AddRefs(parentFolder));
  if (parentFolder)
    destIFolder->GetCanFileMessages(&canFileMessages);
  if (!parentFolder || !canFileMessages)
  {
    if (filter)
    {
      filter->SetEnabled(false);
      // we need to explicitly save the filter file.
      if (m_filterList)
        m_filterList->SaveToDefaultFile();
      destIFolder->ThrowAlertMsg("filterDisabled", msgWindow);
    }
    return NS_MSG_NOT_A_MAIL_FOLDER;
  }

  nsCOMPtr <nsIMsgLocalMailFolder> destLocalFolder = do_QueryInterface(destIFolder);
  if (destLocalFolder)
  {
    bool destFolderTooBig;
    destLocalFolder->WarnIfLocalFileTooBig(msgWindow, &destFolderTooBig);
    if (destFolderTooBig)
      return NS_MSG_ERROR_WRITING_MAIL_FOLDER;
  }
  nsCOMPtr<nsISupports> myISupports =
    do_QueryInterface(static_cast<nsIMsgParseMailMsgState*>(this));

  // Make sure no one else is writing into this folder
  if (NS_FAILED(rv = destIFolder->AcquireSemaphore (myISupports)))
  {
    destIFolder->ThrowAlertMsg("filterFolderDeniedLocked", msgWindow);
    return rv;
  }
  nsCOMPtr<nsIInputStream> inputStream;
  bool reusable;
  rv = m_downloadFolder->GetMsgInputStream(mailHdr, &reusable, getter_AddRefs(inputStream));
  if (!inputStream)
  {
    NS_ERROR("couldn't get source msg input stream in move filter");
    destIFolder->ReleaseSemaphore (myISupports);
    return NS_MSG_FOLDER_UNREADABLE;  // ### dmb
  }

  nsCOMPtr<nsIMsgLocalMailFolder> localFolder = do_QueryInterface(destIFolder);
  nsCOMPtr<nsIMsgDatabase> destMailDB;

  if (!localFolder)
    return NS_MSG_POP_FILTER_TARGET_ERROR;

  // don't force upgrade in place - open the db here before we start writing to the
  // destination file because XP_Stat can return file size including bytes written...
  rv = localFolder->GetDatabaseWOReparse(getter_AddRefs(destMailDB));
  NS_WARN_IF_FALSE(destMailDB && NS_SUCCEEDED(rv),
                   "failed to open mail db parsing folder");
  nsCOMPtr<nsIMsgDBHdr> newHdr;

  if (destMailDB)
    rv = destMailDB->CopyHdrFromExistingHdr(nsMsgKey_None, mailHdr, true,
                                            getter_AddRefs(newHdr));
  if (NS_SUCCEEDED(rv) && !newHdr)
    rv = NS_ERROR_UNEXPECTED;
  if (NS_SUCCEEDED(rv))
  {
    uint32_t messageLength;
    mailHdr->GetMessageSize(&messageLength);
    rv = AppendMsgFromStream(inputStream, newHdr, messageLength,
                             destIFolder);
  }

  if (NS_FAILED(rv))
  {
    if (destMailDB)
      destMailDB->Close(true);

    if (destIFolder)
    {
      destIFolder->ReleaseSemaphore(myISupports);
      destIFolder->ThrowAlertMsg("filterFolderWriteFailed", msgWindow);
    }
    return NS_MSG_ERROR_WRITING_MAIL_FOLDER;
  }

  bool movedMsgIsNew = false;
  // if we have made it this far then the message has successfully been written to the new folder
  // now add the header to the destMailDB.

  uint32_t newFlags;
  newHdr->GetFlags(&newFlags);
  nsMsgKey msgKey;
  newHdr->GetMessageKey(&msgKey);
  if (!(newFlags & nsMsgMessageFlags::Read))
  {
    nsCString junkScoreStr;
    (void) newHdr->GetStringProperty("junkscore", getter_Copies(junkScoreStr));
    if (atoi(junkScoreStr.get()) == nsIJunkMailPlugin::IS_HAM_SCORE)
    {
      newHdr->OrFlags(nsMsgMessageFlags::New, &newFlags);
      destMailDB->AddToNewList(msgKey);
      movedMsgIsNew = true;
    }
  }
  nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
  if (notifier)
    notifier->NotifyMsgAdded(newHdr);
  // mark the header as not yet reported classified
  destIFolder->OrProcessingFlags(
    msgKey, nsMsgProcessingFlags::NotReportedClassified);
  m_msgToForwardOrReply = newHdr;

  if (movedMsgIsNew)
    destIFolder->SetHasNewMessages(true);
  if (!m_filterTargetFolders.Contains(destIFolder))
    m_filterTargetFolders.AppendObject(destIFolder);

  destIFolder->ReleaseSemaphore (myISupports);

  (void) localFolder->RefreshSizeOnDisk();
  destIFolder->SetFlag(nsMsgFolderFlags::GotNew);

  nsCOMPtr<nsIMsgPluggableStore> store;
  rv = m_downloadFolder->GetMsgStore(getter_AddRefs(store));
  if (store)
    store->DiscardNewMessage(m_outputStream, mailHdr);
  if (sourceDB)
    sourceDB->RemoveHeaderMdbRow(mailHdr);

  // update the folder size so we won't reparse.
  UpdateDBFolderInfo(destMailDB);
  destIFolder->UpdateSummaryTotals(true);

  destMailDB->Commit(nsMsgDBCommitType::kLargeCommit);
  return rv;
}

