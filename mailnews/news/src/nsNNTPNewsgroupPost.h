/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsNNTPNewsgroupPost_h
#define __nsNNTPNewsgroupPost_h

#include "msgCore.h"
#include "nsINNTPNewsgroupPost.h"
#include "nsCOMPtr.h"
#include "prmem.h"
#include "nsISupportsObsolete.h"
#include "nsIFile.h"

#define IDX_HEADER_FROM             0
#define IDX_HEADER_NEWSGROUPS       1
#define IDX_HEADER_SUBJECT          2

// set this to the last required header
#define IDX_HEADER_LAST_REQUIRED    IDX_HEADER_SUBJECT

#define IDX_HEADER_PATH             3
#define IDX_HEADER_DATE             4

#define IDX_HEADER_REPLYTO          5
#define IDX_HEADER_SENDER           6
#define IDX_HEADER_FOLLOWUPTO       7
#define IDX_HEADER_DATERECEIVED     8
#define IDX_HEADER_EXPIRES          9
#define IDX_HEADER_CONTROL          10
#define IDX_HEADER_DISTRIBUTION     11
#define IDX_HEADER_ORGANIZATION     12
#define IDX_HEADER_REFERENCES       13

// stuff that's required to be in the message,
// but probably generated on the server
#define IDX_HEADER_RELAYVERSION     14
#define IDX_HEADER_POSTINGVERSION   15
#define IDX_HEADER_MESSAGEID        16

// keep this in sync with the above
#define HEADER_LAST                 IDX_HEADER_MESSAGEID

class nsNNTPNewsgroupPost : public nsINNTPNewsgroupPost {
    
public:
    nsNNTPNewsgroupPost();
    virtual ~nsNNTPNewsgroupPost();
    
    NS_DECL_ISUPPORTS
    
    // Required headers
    NS_IMPL_CLASS_GETSET_STR(RelayVersion, m_header[IDX_HEADER_RELAYVERSION])
    NS_IMPL_CLASS_GETSET_STR(PostingVersion, m_header[IDX_HEADER_POSTINGVERSION])
    NS_IMPL_CLASS_GETSET_STR(From, m_header[IDX_HEADER_FROM])
    NS_IMPL_CLASS_GETSET_STR(Date, m_header[IDX_HEADER_DATE])
    NS_IMPL_CLASS_GETSET_STR(Subject, m_header[IDX_HEADER_SUBJECT])

    NS_IMPL_CLASS_GETTER_STR(GetNewsgroups, m_header[IDX_HEADER_NEWSGROUPS])
    NS_IMPL_CLASS_GETSET_STR(Path, m_header[IDX_HEADER_PATH])

    // Optional Headers
    NS_IMPL_CLASS_GETSET_STR(ReplyTo, m_header[IDX_HEADER_REPLYTO])
    NS_IMPL_CLASS_GETSET_STR(Sender, m_header[IDX_HEADER_SENDER])
    NS_IMPL_CLASS_GETSET_STR(FollowupTo, m_header[IDX_HEADER_FOLLOWUPTO])
    NS_IMPL_CLASS_GETSET_STR(DateReceived, m_header[IDX_HEADER_DATERECEIVED])
    NS_IMPL_CLASS_GETSET_STR(Expires, m_header[IDX_HEADER_EXPIRES])
    NS_IMPL_CLASS_GETSET_STR(Control, m_header[IDX_HEADER_CONTROL])
    NS_IMPL_CLASS_GETSET_STR(Distribution, m_header[IDX_HEADER_DISTRIBUTION])
    NS_IMPL_CLASS_GETSET_STR(Organization, m_header[IDX_HEADER_ORGANIZATION])
    NS_IMPL_CLASS_GETSET_STR(Body, m_body)
    NS_IMPL_CLASS_GETTER_STR(GetReferences, m_header[IDX_HEADER_REFERENCES])

    NS_IMPL_CLASS_GETTER(GetIsControl, bool, m_isControl)

    // the message can be stored in a file....allow accessors for getting and setting
    // the file name to post...
    NS_IMETHOD SetPostMessageFile(nsIFile * aFile);
    NS_IMETHOD GetPostMessageFile(nsIFile ** aFile);

    NS_IMETHOD AddNewsgroup(const char *newsgroupName);
    
private:
    nsCOMPtr <nsIFile> m_postMessageFile;
    char *m_header[HEADER_LAST+1];
    char *m_body;
    char *m_messageBuffer;
    bool m_isControl;
};

#endif /* __nsNNTPNewsgroupPost_h */
