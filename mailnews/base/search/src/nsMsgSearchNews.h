/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgSearchNews_h__
#include "nsMsgSearchAdapter.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"

//-----------------------------------------------------------------------------
//---------- Adapter class for searching online (news) folders ----------------
//-----------------------------------------------------------------------------

class nsMsgSearchNews : public nsMsgSearchAdapter
{
public:
  nsMsgSearchNews (nsMsgSearchScopeTerm *scope, nsISupportsArray *termList);
  virtual ~nsMsgSearchNews () MOZ_OVERRIDE;

  NS_IMETHOD ValidateTerms () MOZ_OVERRIDE;
  NS_IMETHOD Search (bool *aDone) MOZ_OVERRIDE;
  NS_IMETHOD GetEncoding (char **result) MOZ_OVERRIDE;
  NS_IMETHOD AddHit(nsMsgKey key) MOZ_OVERRIDE;
  NS_IMETHOD CurrentUrlDone(nsresult exitCode) MOZ_OVERRIDE;

  virtual nsresult Encode (nsCString *outEncoding);
  virtual char *EncodeTerm (nsIMsgSearchTerm *);
  PRUnichar *EncodeToWildmat (const PRUnichar *);

  void ReportHits ();
    void CollateHits ();
    void ReportHit (nsIMsgDBHdr *pHeaders, nsIMsgFolder *folder);

protected:
  nsCString m_encoding;
  bool m_ORSearch; // set to true if any of the search terms contains an OR for a boolean operator.

  nsTArray<nsMsgKey> m_candidateHits;
  nsTArray<nsMsgKey> m_hits;

  static const char *m_kNntpFrom;
  static const char *m_kNntpSubject;
  static const char *m_kTermSeparator;
  static const char *m_kUrlPrefix;
};

#endif

