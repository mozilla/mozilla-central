/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsParseMailbox_H
#define nsParseMailbox_H

#include "mozilla/Attributes.h"
#include "nsIURI.h"
#include "nsIMsgParseMailMsgState.h"
#include "nsIStreamListener.h"
#include "nsMsgLineBuffer.h"
#include "nsIMsgHeaderParser.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsIMsgStatusFeedback.h"
#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "nsIDBChangeListener.h"
#include "nsIWeakReference.h"
#include "nsIWeakReferenceUtils.h"
#include "nsIMsgWindow.h"
#include "nsImapMoveCoalescer.h"
#include "nsAutoPtr.h"
#include "nsStringGlue.h"
#include "nsIMsgFilterList.h"
#include "nsIMsgFilterHitNotify.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsVoidArray.h"

class nsByteArray;
class nsOutputFileStream;
class nsIOFileStream;
class nsInputFileStream;
class nsIMsgFilter;
class MSG_FolderInfoMail;
class nsIMsgFilterList;
class nsIMsgFolder;

/* Used for the various things that parse RFC822 headers...
 */
typedef struct message_header
{
  const char *value; /* The contents of a header (after ": ") */
  int32_t length;      /* The length of the data (it is not NULL-terminated.) */
} message_header;

// This object maintains the parse state for a single mail message.
class nsParseMailMessageState : public nsIMsgParseMailMsgState, public nsIDBChangeListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGPARSEMAILMSGSTATE
  NS_DECL_NSIDBCHANGELISTENER

  nsParseMailMessageState();
  virtual               ~nsParseMailMessageState();

  void                  Init(uint32_t fileposition);
  virtual nsresult      ParseFolderLine(const char *line, uint32_t lineLength);
  virtual nsresult      StartNewEnvelope(const char *line, uint32_t lineLength);
  nsresult              ParseHeaders();
  nsresult              FinalizeHeaders();
  nsresult              ParseEnvelope (const char *line, uint32_t line_size);
  nsresult              InternSubject (struct message_header *header);

  static bool    IsEnvelopeLine(const char *buf, int32_t buf_size);
  static int  msg_UnHex(char C);

  nsCOMPtr<nsIMsgHeaderParser> m_HeaderAddressParser;

  nsCOMPtr<nsIMsgDBHdr> m_newMsgHdr; /* current message header we're building */
  nsCOMPtr<nsIMsgDatabase>  m_mailDB;
  nsCOMPtr<nsIMsgDatabase> m_backupMailDB;

  nsMailboxParseState   m_state;
  int64_t              m_position;
  uint64_t              m_envelope_pos;
  uint64_t              m_headerstartpos;

  nsByteArray           m_headers;

  nsByteArray           m_envelope;

  struct message_header m_message_id;
  struct message_header m_references;
  struct message_header m_date;
  struct message_header m_delivery_date;
  struct message_header m_from;
  struct message_header m_sender;
  struct message_header m_newsgroups;
  struct message_header m_subject;
  struct message_header m_status;
  struct message_header m_mozstatus;
  struct message_header m_mozstatus2;
  struct message_header m_in_reply_to;
  struct message_header m_replyTo;
  struct message_header m_content_type;
  struct message_header m_bccList;

  // Support for having multiple To or Cc header lines in a message
  nsVoidArray m_toList;
  nsVoidArray m_ccList;
  struct message_header *GetNextHeaderInAggregate (nsVoidArray &list);
  void GetAggregateHeader (nsVoidArray &list, struct message_header *);
  void ClearAggregateHeader (nsVoidArray &list);

  struct message_header m_envelope_from;
  struct message_header m_envelope_date;
  struct message_header m_priority;
  struct message_header m_account_key;
  struct message_header m_keywords;
  // Mdn support
  struct message_header m_mdn_original_recipient;
  struct message_header m_return_path;
  struct message_header m_mdn_dnt; /* MDN Disposition-Notification-To: header */

  PRTime m_receivedTime;
  uint16_t              m_body_lines;

  bool                  m_IgnoreXMozillaStatus;

  // this enables extensions to add the values of particular headers to
  // the .msf file as properties of nsIMsgHdr. It is initialized from a
  // pref, mailnews.customDBHeaders
  nsTArray<nsCString>   m_customDBHeaders;
  struct message_header *m_customDBHeaderValues;
  nsCString m_receivedValue; // accumulated received header
protected:
};

// this should go in some utility class.
inline int nsParseMailMessageState::msg_UnHex(char C)
{
  return ((C >= '0' && C <= '9') ? C - '0' :
    ((C >= 'A' && C <= 'F') ? C - 'A' + 10 :
     ((C >= 'a' && C <= 'f') ? C - 'a' + 10 : 0)));
}

// This class is part of the mailbox parsing state machine
class nsMsgMailboxParser : public nsIStreamListener, public nsParseMailMessageState, public nsMsgLineBuffer
{
public:
  nsMsgMailboxParser(nsIMsgFolder *);
  nsMsgMailboxParser();
  virtual ~nsMsgMailboxParser();
  nsresult Init();

  bool    IsRunningUrl() { return m_urlInProgress;} // returns true if we are currently running a url and false otherwise...
  NS_DECL_ISUPPORTS_INHERITED

  ////////////////////////////////////////////////////////////////////////////////////////
  // we suppport the nsIStreamListener interface
  ////////////////////////////////////////////////////////////////////////////////////////
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSISTREAMLISTENER

  void    SetDB (nsIMsgDatabase *mailDB) {m_mailDB = mailDB; }

  // message socket libnet callbacks, which come through folder pane
  nsresult ProcessMailboxInputStream(nsIURI* aURL, nsIInputStream *aIStream, uint32_t aLength);

  virtual void  DoneParsingFolder(nsresult status);
  virtual void  AbortNewHeader();

  // for nsMsgLineBuffer
  virtual nsresult HandleLine(const char *line, uint32_t line_length);

  void  UpdateDBFolderInfo();
  void  UpdateDBFolderInfo(nsIMsgDatabase *mailDB);
  void  UpdateStatusText(const char* stringName);

  // Update the progress bar based on what we know.
  virtual void    UpdateProgressPercent ();
  virtual void OnNewMessage(nsIMsgWindow *msgWindow);

protected:
  nsCOMPtr<nsIMsgStatusFeedback> m_statusFeedback;

  virtual int32_t     PublishMsgHeader(nsIMsgWindow *msgWindow);
  void                FreeBuffers();

  // data
  nsString        m_folderName;
  nsCString       m_inboxUri;
  nsByteArray     m_inputStream;
  int32_t         m_obuffer_size;
  char            *m_obuffer;
  uint32_t        m_graph_progress_total;
  uint32_t        m_graph_progress_received;
  bool            m_parsingDone;
  PRTime          m_startTime;
private:
  // the following flag is used to determine when a url is currently being run. It is cleared on calls
  // to ::StopBinding and it is set whenever we call Load on a url
  bool      m_urlInProgress;
  nsWeakPtr m_folder;
  void ReleaseFolderLock();
  nsresult AcquireFolderLock();

};

class nsParseNewMailState : public nsMsgMailboxParser
, public nsIMsgFilterHitNotify
{
public:
  nsParseNewMailState();
  virtual ~nsParseNewMailState();
  NS_DECL_ISUPPORTS_INHERITED

  NS_IMETHOD FinishHeader() MOZ_OVERRIDE;

  nsresult Init(nsIMsgFolder *rootFolder, nsIMsgFolder *downloadFolder,
                nsIMsgWindow *aMsgWindow, nsIMsgDBHdr *aHdr,
                nsIOutputStream *aOutputStream);

  virtual void  DoneParsingFolder(nsresult status) MOZ_OVERRIDE;

  void DisableFilters() {m_disableFilters = true;}

  NS_DECL_NSIMSGFILTERHITNOTIFY

  nsOutputFileStream *GetLogFile();
  virtual int32_t PublishMsgHeader(nsIMsgWindow *msgWindow) MOZ_OVERRIDE;
  void            GetMsgWindow(nsIMsgWindow **aMsgWindow);
  nsresult EndMsgDownload();

  nsresult AppendMsgFromStream(nsIInputStream *fileStream, nsIMsgDBHdr *aHdr,
                               uint32_t length, nsIMsgFolder *destFolder);

  virtual void ApplyFilters(bool *pMoved, nsIMsgWindow *msgWindow,
                             uint32_t msgOffset);
  nsresult    ApplyForwardAndReplyFilter(nsIMsgWindow *msgWindow);
  virtual void OnNewMessage(nsIMsgWindow *msgWindow) MOZ_OVERRIDE;

  // this keeps track of how many messages we downloaded that
  // aren't new - e.g., marked read, or moved to an other server.
  int32_t     m_numNotNewMessages;
protected:
  virtual nsresult GetTrashFolder(nsIMsgFolder **pTrashFolder);
  virtual nsresult MoveIncorporatedMessage(nsIMsgDBHdr *mailHdr,
                                          nsIMsgDatabase *sourceDB,
                                          nsIMsgFolder *destIFolder,
                                          nsIMsgFilter *filter,
                                          nsIMsgWindow *msgWindow);
  virtual void     MarkFilteredMessageRead(nsIMsgDBHdr *msgHdr);
  virtual void     MarkFilteredMessageUnread(nsIMsgDBHdr *msgHdr);
  void             LogRuleHit(nsIMsgFilter *filter, nsIMsgDBHdr *msgHdr);

  nsCOMPtr <nsIMsgFilterList> m_filterList;
  nsCOMPtr <nsIMsgFilterList> m_deferredToServerFilterList;
  nsCOMPtr <nsIMsgFolder> m_rootFolder;
  nsCOMPtr <nsIMsgWindow> m_msgWindow;
  nsCOMPtr <nsIMsgFolder> m_downloadFolder;
  nsCOMPtr<nsIOutputStream> m_outputStream;
  nsCOMArray <nsIMsgFolder> m_filterTargetFolders;

  nsRefPtr<nsImapMoveCoalescer> m_moveCoalescer;

  bool          m_msgMovedByFilter;
  bool          m_msgCopiedByFilter;
  bool          m_disableFilters;
  uint32_t      m_ibuffer_fp;
  char          *m_ibuffer;
  uint32_t      m_ibuffer_size;
  // used for applying move filters, because in the case of using a temporary
  // download file, the offset/key in the msg hdr is not right.
  uint64_t      m_curHdrOffset;

  // we have to apply the reply/forward filters in a second pass, after
  // msg quarantining and moving to other local folders, so we remember the
  // info we'll need to apply them with these vars.
  // these need to be arrays in case we have multiple reply/forward filters.
  nsTArray<nsCString> m_forwardTo;
  nsTArray<nsCString> m_replyTemplateUri;
  nsCOMPtr <nsIMsgDBHdr> m_msgToForwardOrReply;
};

#endif
