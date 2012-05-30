/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgSearchImap_h__
#include "nsMsgSearchAdapter.h"

//-----------------------------------------------------------------------------
//---------- Adapter class for searching online (IMAP) folders ----------------
//-----------------------------------------------------------------------------

class nsMsgSearchOnlineMail : public nsMsgSearchAdapter
{
public:
  nsMsgSearchOnlineMail (nsMsgSearchScopeTerm *scope, nsISupportsArray *termList);
  virtual ~nsMsgSearchOnlineMail ();

  NS_IMETHOD ValidateTerms ();
  NS_IMETHOD Search (bool *aDone);
  NS_IMETHOD GetEncoding (char **result);
  NS_IMETHOD AddResultElement (nsIMsgDBHdr *);

  static nsresult Encode (nsCString& ppEncoding,
                            nsISupportsArray *searchTerms,
                            const PRUnichar *destCharset);


protected:
  nsCString m_encoding;
};



#endif

