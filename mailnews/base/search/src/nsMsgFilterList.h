/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgFilterList_H_
#define _nsMsgFilterList_H_

#include "nscore.h"
#include "nsIMsgFolder.h"
#include "nsIMsgFilterList.h"
#include "nsCOMPtr.h"
#include "nsIArray.h"
#include "nsIFile.h"
#include "nsIOutputStream.h"

const PRInt16 kFileVersion = 9;
const PRInt16 kManualContextVersion = 9;
const PRInt16 k60Beta1Version = 7;
const PRInt16 k45Version = 6;


////////////////////////////////////////////////////////////////////////////////////////
// The Msg Filter List is an interface designed to make accessing filter lists
// easier. Clients typically open a filter list and either enumerate the filters,
// or add new filters, or change the order around...
//
////////////////////////////////////////////////////////////////////////////////////////

class nsIMsgFilter;
class nsMsgFilter;

class nsMsgFilterList : public nsIMsgFilterList
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGFILTERLIST

  nsMsgFilterList();
  virtual ~nsMsgFilterList();

  nsresult Close();
  nsresult LoadTextFilters(nsIInputStream *aStream);

  bool m_temporaryList;

protected:
  nsresult ComputeArbitraryHeaders();
  nsresult SaveTextFilters(nsIOutputStream *aStream);
  // file streaming methods
  char ReadChar(nsIInputStream *aStream);
  char SkipWhitespace(nsIInputStream *aStream);
  bool StrToBool(nsCString &str);
  char LoadAttrib(nsMsgFilterFileAttribValue &attrib, nsIInputStream *aStream);
  const char *GetStringForAttrib(nsMsgFilterFileAttribValue attrib);
  nsresult LoadValue(nsCString &value, nsIInputStream *aStream);
  PRInt16 m_fileVersion;
  bool m_loggingEnabled;
  bool m_startWritingToBuffer; //tells us when to start writing one whole filter to m_unparsedBuffer
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsMsgFilter *m_curFilter; // filter we're filing in or out(?)
  nsCString m_filterFileName;
  nsTArray<nsCOMPtr<nsIMsgFilter> > m_filters;
  nsCString m_arbitraryHeaders;
  nsCOMPtr<nsIFile> m_defaultFile;
  nsCString m_unparsedFilterBuffer; //holds one entire filter unparsed 

private:
  nsresult TruncateLog();
  nsresult GetLogFile(nsIFile **aFile);
  nsCOMPtr<nsIOutputStream> m_logStream;
};

#endif
