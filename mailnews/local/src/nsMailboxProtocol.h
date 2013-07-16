/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMailboxProtocol_h___
#define nsMailboxProtocol_h___

#include "mozilla/Attributes.h"
#include "nsMsgProtocol.h"
#include "nsCOMPtr.h"
#include "nsIFile.h"
#include "nsIChannel.h"
#include "nsIOutputStream.h"
#include "nsIMailboxUrl.h"
// State Flags (Note, I use the word state in terms of storing
// state information about the connection (authentication, have we sent
// commands, etc. I do not intend it to refer to protocol state)

#define MAILBOX_PAUSE_FOR_READ      0x00000001  /* should we pause for the next read */
#define MAILBOX_MSG_PARSE_FIRST_LINE    0x00000002 /* have we read in the first line of the msg */

/* states of the machine
 */
typedef enum _MailboxStatesEnum {
  MAILBOX_READ_FOLDER,
  MAILBOX_FINISH_OPEN_FOLDER,
  MAILBOX_OPEN_MESSAGE,
  MAILBOX_OPEN_STREAM,
  MAILBOX_READ_MESSAGE,
  MAILBOX_COMPRESS_FOLDER,
  MAILBOX_FINISH_COMPRESS_FOLDER,
  MAILBOX_BACKGROUND,
  MAILBOX_NULL,
  MAILBOX_NULL2,
  MAILBOX_DELIVER_QUEUED,
  MAILBOX_FINISH_DELIVER_QUEUED,
  MAILBOX_DONE,
  MAILBOX_ERROR_DONE,
  MAILBOX_FREE,
  MAILBOX_COPY_MESSAGES,
  MAILBOX_FINISH_COPY_MESSAGES
} MailboxStatesEnum;

class nsMsgLineStreamBuffer;

class nsMailboxProtocol : public nsMsgProtocol
{
public:
  // Creating a protocol instance requires the URL which needs to be run AND it requires
  // a transport layer.
  nsMailboxProtocol(nsIURI * aURL);
  virtual ~nsMailboxProtocol();

  // initialization function given a new url and transport layer
  nsresult Initialize(nsIURI * aURL);

  // the consumer of the url might be something like an nsIDocShell....
  virtual nsresult LoadUrl(nsIURI * aURL, nsISupports * aConsumer) MOZ_OVERRIDE;

  ////////////////////////////////////////////////////////////////////////////////////////
  // we suppport the nsIStreamListener interface
  ////////////////////////////////////////////////////////////////////////////////////////

  NS_IMETHOD OnStartRequest(nsIRequest *request, nsISupports *ctxt) MOZ_OVERRIDE;
  NS_IMETHOD OnStopRequest(nsIRequest *request, nsISupports *ctxt, nsresult aStatus) MOZ_OVERRIDE;

private:
  nsCOMPtr<nsIMailboxUrl>  m_runningUrl; // the nsIMailboxURL that is currently running
  nsMailboxAction m_mailboxAction; // current mailbox action associated with this connnection...
  uint64_t m_msgOffset;
  // Event sink handles
  nsCOMPtr<nsIStreamListener> m_mailboxParser;

  // Local state for the current operation
  nsMsgLineStreamBuffer   * m_lineStreamBuffer; // used to efficiently extract lines from the incoming data stream

  // Generic state information -- What state are we in? What state do we want to go to
  // after the next response? What was the last response code? etc.
  MailboxStatesEnum  m_nextState;
  MailboxStatesEnum  m_initialState;

  int64_t   mCurrentProgress;

        // can we just use the base class m_tempMsgFile?
  nsCOMPtr<nsIFile> m_tempMessageFile;
        nsCOMPtr<nsIOutputStream> m_msgFileOutputStream;

  // this is used to hold the source mailbox file open when move/copying
  // multiple messages.
  nsCOMPtr<nsIInputStream> m_multipleMsgMoveCopyStream;

  virtual nsresult ProcessProtocolState(nsIURI * url, nsIInputStream * inputStream,
                                        uint64_t sourceOffset, uint32_t length) MOZ_OVERRIDE;
  virtual nsresult CloseSocket() MOZ_OVERRIDE;

  nsresult SetupMessageExtraction();
  nsresult OpenMultipleMsgTransport(uint64_t offset, int32_t size);
  nsresult OpenFileSocketForReuse(nsIURI * aURL, uint64_t aStartPosition, int32_t aReadCount);
  bool RunningMultipleMsgUrl();

  ////////////////////////////////////////////////////////////////////////////////////////
  // Protocol Methods --> This protocol is state driven so each protocol method is
  //            designed to re-act to the current "state". I've attempted to
  //            group them together based on functionality.
  ////////////////////////////////////////////////////////////////////////////////////////

  // When parsing a mailbox folder in chunks, this protocol state reads in the current chunk
  // and forwards it to the mailbox parser.
  int32_t ReadFolderResponse(nsIInputStream * inputStream, uint64_t sourceOffset, uint32_t length);
  int32_t ReadMessageResponse(nsIInputStream * inputStream, uint64_t sourceOffset, uint32_t length);
  nsresult DoneReadingMessage();

  ////////////////////////////////////////////////////////////////////////////////////////
  // End of Protocol Methods
  ////////////////////////////////////////////////////////////////////////////////////////
};

#endif  // nsMailboxProtocol_h___






