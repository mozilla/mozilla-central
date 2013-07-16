/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsPop3Sink_h__
#define nsPop3Sink_h__

#include "nscore.h"
#include "nsIURL.h"
#include "nsIPop3Sink.h"
#include "nsIOutputStream.h"
#include "prmem.h"
#include "prio.h"
#include "plstr.h"
#include "prenv.h"
#include "nsIMsgFolder.h"
#include "nsAutoPtr.h"
#include "nsTArray.h"
#include "nsStringGlue.h"

class nsParseNewMailState;
class nsIMsgFolder;

struct partialRecord
{
  partialRecord();
  ~partialRecord();

  nsCOMPtr<nsIMsgDBHdr> m_msgDBHdr;
  nsCString m_uidl;
};

class nsPop3Sink : public nsIPop3Sink
{
public:
    nsPop3Sink();
    virtual ~nsPop3Sink();

    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSIPOP3SINK
    nsresult GetServerFolder(nsIMsgFolder **aFolder);
    nsresult FindPartialMessages();
    void CheckPartialMessages(nsIPop3Protocol *protocol);

    static char*  GetDummyEnvelope(void);

protected:
    nsresult WriteLineToMailbox(const nsACString& buffer);
    nsresult ReleaseFolderLock();
    nsresult HandleTempDownloadFailed(nsIMsgWindow *msgWindow);

    bool m_authed;
    nsCString m_accountUrl;
    uint32_t m_biffState;
    int32_t m_numNewMessages;
    int32_t m_numNewMessagesInFolder;
    int32_t m_numMsgsDownloaded;
    bool m_senderAuthed;
    nsCString m_outputBuffer;
    nsCOMPtr<nsIPop3IncomingServer> m_popServer;
    //Currently the folder we want to update about biff info
    nsCOMPtr<nsIMsgFolder> m_folder;
    nsRefPtr<nsParseNewMailState> m_newMailParser;
    nsCOMPtr <nsIOutputStream> m_outFileStream; // the file we write to, which may be temporary
    nsCOMPtr<nsIMsgPluggableStore> m_msgStore;
    nsCOMPtr <nsIOutputStream> m_inboxOutputStream; // the actual mailbox
    bool m_uidlDownload;
    bool m_buildMessageUri;
    bool m_downloadingToTempFile;
    nsCOMPtr <nsIFile> m_tmpDownloadFile;
    nsCOMPtr<nsIMsgWindow> m_window;
    nsCString m_messageUri;
    nsCString m_baseMessageUri;
    nsCString m_origMessageUri;
    nsCString m_accountKey;
    nsTArray<partialRecord*> m_partialMsgsArray;
};

#endif
