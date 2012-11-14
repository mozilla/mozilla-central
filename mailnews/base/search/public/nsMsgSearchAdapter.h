/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgSearchAdapter_H_
#define _nsMsgSearchAdapter_H_

#include "nsMsgSearchCore.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsIMsgSearchAdapter.h"
#include "nsIMsgSearchValidityTable.h"
#include "nsIMsgSearchValidityManager.h"
#include "nsIMsgSearchTerm.h"
#include "nsINntpIncomingServer.h"

class nsIMsgSearchScopeTerm;

//-----------------------------------------------------------------------------
// These Adapter classes contain the smarts to convert search criteria from
// the canonical structures in msg_srch.h into whatever format is required
// by their protocol.
//
// There is a separate Adapter class for area (pop, imap, nntp, ldap) to contain
// the special smarts for that protocol.
//-----------------------------------------------------------------------------

class nsMsgSearchAdapter : public nsIMsgSearchAdapter
{
public:
  nsMsgSearchAdapter (nsIMsgSearchScopeTerm*, nsISupportsArray *);
  virtual ~nsMsgSearchAdapter ();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGSEARCHADAPTER

  nsIMsgSearchScopeTerm        *m_scope;
  nsCOMPtr<nsISupportsArray>  m_searchTerms;       /* linked list of criteria terms */

  bool m_abortCalled;
  nsString  m_defaultCharset;
  bool m_forceAsciiSearch;

  static nsresult EncodeImap (char **ppEncoding,
           nsISupportsArray *searchTerms,
           const PRUnichar *srcCharset,
           const PRUnichar *destCharset,
           bool reallyDredd = false);

  static nsresult EncodeImapValue(char *encoding, const char *value, bool useQuotes, bool reallyDredd);

  static char *GetImapCharsetParam(const PRUnichar *destCharset);
  static PRUnichar *EscapeSearchUrl (const PRUnichar *nntpCommand);
  static PRUnichar *EscapeImapSearchProtocol(const PRUnichar *imapCommand);
  static PRUnichar *EscapeQuoteImapSearchProtocol(const PRUnichar *imapCommand);
  static char *UnEscapeSearchUrl (const char *commandSpecificData);
  // This stuff lives in the base class because the IMAP search syntax
  // is used by the Dredd SEARCH command as well as IMAP itself
  static const char *m_kImapBefore;
  static const char *m_kImapBody;
  static const char *m_kImapCC;
  static const char *m_kImapFrom;
  static const char *m_kImapNot;
  static const char *m_kImapOr;
  static const char *m_kImapSince;
  static const char *m_kImapSubject;
  static const char *m_kImapTo;
  static const char *m_kImapHeader;
  static const char *m_kImapAnyText;
  static const char *m_kImapKeyword;
  static const char *m_kNntpKeywords;
  static const char *m_kImapSentOn;
  static const char *m_kImapSeen;
  static const char *m_kImapAnswered;
  static const char *m_kImapNotSeen;
  static const char *m_kImapNotAnswered;
  static const char *m_kImapCharset;
  static const char *m_kImapUnDeleted;
  static const char *m_kImapSizeSmaller;
  static const char *m_kImapSizeLarger;
  static const char *m_kImapNew;
  static const char *m_kImapNotNew;
  static const char *m_kImapFlagged;
  static const char *m_kImapNotFlagged;
protected:
  typedef enum _msg_TransformType
  {
    kOverwrite,    /* "John Doe" -> "John*Doe",   simple contains   */
    kInsert,       /* "John Doe" -> "John* Doe",  name completion   */
    kSurround      /* "John Doe" -> "John* *Doe", advanced contains */
  } msg_TransformType;

  char *TransformSpacesToStars (const char *, msg_TransformType transformType);
  nsresult OpenNewsResultInUnknownGroup (nsMsgResultElement*);

  static nsresult EncodeImapTerm (nsIMsgSearchTerm *, bool reallyDredd, const PRUnichar *srcCharset, const PRUnichar *destCharset, char **ppOutTerm);
};

//-----------------------------------------------------------------------------
// Validity checking for attrib/op pairs. We need to know what operations are
// legal in three places:
//   1. when the FE brings up the dialog box and needs to know how to build
//      the menus and enable their items
//   2. when the FE fires off a search, we need to check their lists for
//      correctness
//   3. for on-the-fly capability negotion e.g. with XSEARCH-capable news
//      servers
//-----------------------------------------------------------------------------

class nsMsgSearchValidityTable : public nsIMsgSearchValidityTable
{
public:
  nsMsgSearchValidityTable ();
  NS_DECL_NSIMSGSEARCHVALIDITYTABLE
  NS_DECL_ISUPPORTS

protected:
  int m_numAvailAttribs;        // number of rows with at least one available operator
  typedef struct vtBits
  {
    uint16_t bitEnabled : 1;
    uint16_t bitAvailable : 1;
    uint16_t bitValidButNotShown : 1;
  } vtBits;
  vtBits m_table [nsMsgSearchAttrib::kNumMsgSearchAttributes][nsMsgSearchOp::kNumMsgSearchOperators];
private:
  nsMsgSearchAttribValue m_defaultAttrib;
};

// Using getters and setters seems a little nicer then dumping the 2-D array
// syntax all over the code
#define CHECK_AO if (a < 0 || \
                     a >= nsMsgSearchAttrib::kNumMsgSearchAttributes || \
                     o < 0 || \
                     o >= nsMsgSearchOp::kNumMsgSearchOperators) \
                   return NS_ERROR_ILLEGAL_VALUE;
inline nsresult nsMsgSearchValidityTable::SetAvailable (int a, int o, bool b)
{ CHECK_AO; m_table [a][o].bitAvailable = b; return NS_OK;}
inline nsresult nsMsgSearchValidityTable::SetEnabled (int a, int o, bool b)
{ CHECK_AO; m_table [a][o].bitEnabled = b; return NS_OK; }
inline nsresult nsMsgSearchValidityTable::SetValidButNotShown (int a, int o, bool b)
{ CHECK_AO; m_table [a][o].bitValidButNotShown = b; return NS_OK;}

inline nsresult nsMsgSearchValidityTable::GetAvailable (int a, int o, bool *aResult)
{ CHECK_AO; *aResult = m_table [a][o].bitAvailable; return NS_OK;}
inline nsresult nsMsgSearchValidityTable::GetEnabled (int a, int o, bool *aResult)
{ CHECK_AO; *aResult = m_table [a][o].bitEnabled; return NS_OK;}
inline nsresult nsMsgSearchValidityTable::GetValidButNotShown (int a, int o, bool *aResult)
{ CHECK_AO; *aResult = m_table [a][o].bitValidButNotShown; return NS_OK;}
#undef CHECK_AO

class nsMsgSearchValidityManager : public nsIMsgSearchValidityManager
{
public:
  nsMsgSearchValidityManager ();

protected:
  virtual ~nsMsgSearchValidityManager ();

public:
  NS_DECL_NSIMSGSEARCHVALIDITYMANAGER
  NS_DECL_ISUPPORTS

  nsresult GetTable (int, nsMsgSearchValidityTable**);

protected:

  // There's one global validity manager that everyone uses. You *could* do
  // this with static members of the adapter classes, but having a dedicated
  // object makes cleanup of these tables (at shutdown-time) automagic.

  nsCOMPtr<nsIMsgSearchValidityTable> m_offlineMailTable;
  nsCOMPtr<nsIMsgSearchValidityTable> m_offlineMailFilterTable;
  nsCOMPtr<nsIMsgSearchValidityTable> m_onlineMailTable;
  nsCOMPtr<nsIMsgSearchValidityTable> m_onlineMailFilterTable;
  nsCOMPtr<nsIMsgSearchValidityTable> m_onlineManualFilterTable;

  nsCOMPtr<nsIMsgSearchValidityTable> m_newsTable;      // online news

  // Local news tables, used for local news searching or offline.
  nsCOMPtr<nsIMsgSearchValidityTable> m_localNewsTable;         // base table
  nsCOMPtr<nsIMsgSearchValidityTable> m_localNewsJunkTable;     // base + junk
  nsCOMPtr<nsIMsgSearchValidityTable> m_localNewsBodyTable;     // base + body
  nsCOMPtr<nsIMsgSearchValidityTable> m_localNewsJunkBodyTable; // base + junk + body
  nsCOMPtr<nsIMsgSearchValidityTable> m_ldapTable;
  nsCOMPtr<nsIMsgSearchValidityTable> m_ldapAndTable;
  nsCOMPtr<nsIMsgSearchValidityTable> m_localABTable;
  nsCOMPtr<nsIMsgSearchValidityTable> m_localABAndTable;
  nsCOMPtr<nsIMsgSearchValidityTable> m_newsFilterTable;

  nsresult NewTable (nsIMsgSearchValidityTable **);

  nsresult InitOfflineMailTable();
  nsresult InitOfflineMailFilterTable();
  nsresult InitOnlineMailTable();
  nsresult InitOnlineMailFilterTable();
  nsresult InitOnlineManualFilterTable();
  nsresult InitNewsTable();
  nsresult InitLocalNewsTable();
  nsresult InitLocalNewsJunkTable();
  nsresult InitLocalNewsBodyTable();
  nsresult InitLocalNewsJunkBodyTable();
  nsresult InitNewsFilterTable();

  //set the custom headers in the table, changes whenever "mailnews.customHeaders" pref changes.
  nsresult SetOtherHeadersInTable(nsIMsgSearchValidityTable *table, const char *customHeaders);

  nsresult InitLdapTable();
  nsresult InitLdapAndTable();
  nsresult InitLocalABTable();
  nsresult InitLocalABAndTable();
  nsresult SetUpABTable(nsIMsgSearchValidityTable *aTable, bool isOrTable);
  nsresult EnableDirectoryAttribute(nsIMsgSearchValidityTable *table, nsMsgSearchAttribValue aSearchAttrib);
};

#endif
