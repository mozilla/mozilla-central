/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgHdr_H
#define _nsMsgHdr_H

#include "nsIMsgHdr.h"
#include "nsStringGlue.h"
#include "MailNewsTypes.h"
#include "mdb.h"

class nsMsgDatabase;
class nsCString;
class nsIMsgThread;

class nsMsgHdr : public nsIMsgDBHdr {
public:
    NS_DECL_NSIMSGDBHDR
	friend class nsMsgDatabase;
    friend class nsMsgPropertyEnumerator; // accesses m_mdb
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    // nsMsgHdr methods:
    nsMsgHdr(nsMsgDatabase *db, nsIMdbRow *dbRow);
    virtual ~nsMsgHdr();

    virtual nsresult    GetRawFlags(PRUint32 *result);
    void                Init();
    virtual nsresult    InitCachedValues();
    virtual nsresult    InitFlags();
    void                ClearCachedValues() {m_initedValues = 0;}

    NS_DECL_ISUPPORTS

    nsIMdbRow   *GetMDBRow() {return m_mdbRow;}
    bool        IsParentOf(nsIMsgDBHdr *possibleChild);
    bool        IsAncestorOf(nsIMsgDBHdr *possibleChild);
    bool        IsAncestorKilled(PRUint32 ancestorsToCheck);
    void        ReparentInThread(nsIMsgThread *thread);
protected:
    nsresult SetStringColumn(const char *str, mdb_token token);
    nsresult SetUInt32Column(PRUint32 value, mdb_token token);
    nsresult GetUInt32Column(mdb_token token, PRUint32 *pvalue, PRUint32 defaultValue = 0);
    nsresult SetUInt64Column(PRUint64 value, mdb_token token);
    nsresult GetUInt64Column(mdb_token token, PRUint64 *pvalue, PRUint64 defaultValue = 0);
    nsresult BuildRecipientsFromArray(const char *names, const char *addresses, PRUint32 numAddresses, nsCAutoString& allRecipients);

    // reference and threading stuff.
    nsresult	ParseReferences(const char *references);
    const char* GetNextReference(const char *startNextRef, nsCString &reference,
                                 bool acceptNonDelimitedReferences);

    nsMsgKey	m_threadId; 
    nsMsgKey	m_messageKey; 	//news: article number, mail mbox offset, imap uid...
    nsMsgKey	m_threadParent;	// message this is a reply to, in thread.
    PRTime      m_date;                         
    PRUint32    m_messageSize;	// lines for news articles, bytes for mail messages
    PRUint32    m_statusOffset;	// offset in a local mail message of the mozilla status hdr
    PRUint32    m_flags;
    // avoid parsing references every time we want one
    nsTArray<nsCString> m_references;
    nsMsgPriorityValue  m_priority;

    // nsMsgHdrs will have to know what db and row they belong to, since they are really
    // just a wrapper around the msg row in the mdb. This could cause problems,
    // though I hope not.
    nsMsgDatabase *m_mdb;
    nsIMdbRow     *m_mdbRow;
    PRUint32      m_initedValues;
};

#endif

