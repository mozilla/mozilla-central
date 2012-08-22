/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "msgCore.h"
#include "nsMsgSearchAdapter.h"
#include "nsUnicharUtils.h"
#include "nsMsgSearchScopeTerm.h"
#include "nsMsgResultElement.h"
#include "nsMsgSearchTerm.h"
#include "nsIMsgHdr.h"
#include "nsMsgSearchNews.h"
#include "nsIDBFolderInfo.h"
#include "prprf.h"
#include "nsIMsgDatabase.h"
#include "nsMemory.h"
#include <ctype.h>
#include "nsISupportsArray.h"

// Implementation of search for IMAP mail folders


// Implementation of search for newsgroups


//-----------------------------------------------------------------------------
//----------- Adapter class for searching XPAT-capable news servers -----------
//-----------------------------------------------------------------------------


const char *nsMsgSearchNews::m_kNntpFrom = "FROM ";
const char *nsMsgSearchNews::m_kNntpSubject = "SUBJECT ";
const char *nsMsgSearchNews::m_kTermSeparator = "/";


nsMsgSearchNews::nsMsgSearchNews (nsMsgSearchScopeTerm *scope, nsISupportsArray *termList) : nsMsgSearchAdapter (scope, termList)
{
}


nsMsgSearchNews::~nsMsgSearchNews ()
{
}


nsresult nsMsgSearchNews::ValidateTerms ()
{
  nsresult err = nsMsgSearchAdapter::ValidateTerms ();
  if (NS_OK == err)
  {
    err = Encode (&m_encoding);
  }

  return err;
}


nsresult nsMsgSearchNews::Search (bool *aDone)
{
  // the state machine runs in the news: handler
  nsresult err = NS_ERROR_NOT_IMPLEMENTED;
  return err;
}

PRUnichar *nsMsgSearchNews::EncodeToWildmat (const PRUnichar *value)
{
  // Here we take advantage of XPAT's use of the wildmat format, which allows
  // a case-insensitive match by specifying each case possibility for each character
  // So, "FooBar" is encoded as "[Ff][Oo][Bb][Aa][Rr]"

  PRUnichar *caseInsensitiveValue = (PRUnichar*) nsMemory::Alloc(sizeof(PRUnichar) * ((4 * NS_strlen(value)) + 1));
  if (caseInsensitiveValue)
  {
    PRUnichar *walkValue = caseInsensitiveValue;
    while (*value)
    {
      if (isalpha(*value))
      {
        *walkValue++ = (PRUnichar)'[';
        *walkValue++ = ToUpperCase((PRUnichar)*value);
        *walkValue++ = ToLowerCase((PRUnichar)*value);
        *walkValue++ = (PRUnichar)']';
      }
      else
        *walkValue++ = *value;
      value++;
    }
    *walkValue = 0;
  }
  return caseInsensitiveValue;
}


char *nsMsgSearchNews::EncodeTerm (nsIMsgSearchTerm *term)
{
  // Develop an XPAT-style encoding for the search term

  NS_ASSERTION(term, "null term");
  if (!term)
    return nullptr;

  // Find a string to represent the attribute
  const char *attribEncoding = nullptr;
  nsMsgSearchAttribValue attrib;

  term->GetAttrib(&attrib);

  switch (attrib)
  {
  case nsMsgSearchAttrib::Sender:
    attribEncoding = m_kNntpFrom;
    break;
  case nsMsgSearchAttrib::Subject:
    attribEncoding = m_kNntpSubject;
    break;
  default:
    nsCString header;
    term->GetArbitraryHeader(header);
    if (header.IsEmpty())
    {
      NS_ASSERTION(false,"malformed search"); // malformed search term?
      return nullptr;
    }
    attribEncoding = header.get();
  }

  // Build a string to represent the string pattern
  bool leadingStar = false;
  bool trailingStar = false;
  int overhead = 1; // null terminator
  nsMsgSearchOpValue op;
  term->GetOp(&op);

  switch (op)
  {
  case nsMsgSearchOp::Contains:
    leadingStar = true;
    trailingStar = true;
    overhead += 2;
    break;
  case nsMsgSearchOp::Is:
    break;
  case nsMsgSearchOp::BeginsWith:
    trailingStar = true;
    overhead++;
    break;
  case nsMsgSearchOp::EndsWith:
    leadingStar = true;
    overhead++;
    break;
  default:
    NS_ASSERTION(false,"malformed search"); // malformed search term?
    return nullptr;
  }

    // ### i18N problem Get the csid from FE, which is the correct csid for term
//  int16 wincsid = INTL_GetCharSetID(INTL_DefaultTextWidgetCsidSel);

  // Do INTL_FormatNNTPXPATInRFC1522Format trick for non-ASCII string
//  unsigned char *intlNonRFC1522Value = INTL_FormatNNTPXPATInNonRFC1522Format (wincsid, (unsigned char*)term->m_value.u.string);
  nsCOMPtr <nsIMsgSearchValue> searchValue;

  nsresult rv = term->GetValue(getter_AddRefs(searchValue));
  if (NS_FAILED(rv) || !searchValue)
    return nullptr;


  nsString intlNonRFC1522Value;
  rv = searchValue->GetStr(intlNonRFC1522Value);
  if (NS_FAILED(rv) || intlNonRFC1522Value.IsEmpty())
    return nullptr;

  PRUnichar *caseInsensitiveValue = EncodeToWildmat (intlNonRFC1522Value.get());
  if (!caseInsensitiveValue)
    return nullptr;

  // TO DO: Do INTL_FormatNNTPXPATInRFC1522Format trick for non-ASCII string
  // Unfortunately, we currently do not handle xxx or xxx search in XPAT
  // Need to add the INTL_FormatNNTPXPATInRFC1522Format call after we can do that
  // so we should search a string in either RFC1522 format and non-RFC1522 format

  PRUnichar *escapedValue = EscapeSearchUrl (caseInsensitiveValue);
  nsMemory::Free(caseInsensitiveValue);
  if (!escapedValue)
    return nullptr;

#if 0
  // We also need to apply NET_Escape to it since we have to pass 8-bits data
  // And sometimes % in the 7-bit doulbe byte JIS
  //
  PRUnichar * urlEncoded = nsEscape(escapedValue, url_Path);
  NS_Free(escapedValue);

  if (! urlEncoded)
    return nullptr;

  char *pattern = new char [NS_strlen(urlEncoded) + overhead];
  if (!pattern)
    return nullptr;
  else
    pattern[0] = '\0';
#else
    nsCAutoString pattern;
#endif


  if (leadingStar)
      pattern.Append('*');
    pattern.Append(NS_ConvertUTF16toUTF8(escapedValue));
  if (trailingStar)
      pattern.Append('*');

  // Combine the XPAT command syntax with the attribute and the pattern to
  // form the term encoding
  const char xpatTemplate[] = "XPAT %s 1- %s";
  int termLength = (sizeof(xpatTemplate) - 1) + strlen(attribEncoding) + pattern.Length() + 1;
  char *termEncoding = new char [termLength];
  if (termEncoding)
    PR_snprintf (termEncoding, termLength, xpatTemplate, attribEncoding, pattern.get());

  return termEncoding;
}

nsresult nsMsgSearchNews::GetEncoding(char **result)
{
  NS_ENSURE_ARG(result);
  *result = ToNewCString(m_encoding);
  return (*result) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

nsresult nsMsgSearchNews::Encode (nsCString *outEncoding)
{
  NS_ASSERTION(outEncoding, "no out encoding");
  if (!outEncoding)
    return NS_ERROR_NULL_POINTER;

  nsresult err = NS_OK;

  uint32_t numTerms;

  m_searchTerms->Count(&numTerms);
  char **intermediateEncodings = new char * [numTerms];
  if (intermediateEncodings)
  {
    // Build an XPAT command for each term
    int encodingLength = 0;
    uint32_t i;
    for (i = 0; i < numTerms; i++)
    {
      nsCOMPtr<nsIMsgSearchTerm> pTerm;
      m_searchTerms->QueryElementAt(i, NS_GET_IID(nsIMsgSearchTerm),
                               (void **)getter_AddRefs(pTerm));
      // set boolean OR term if any of the search terms are an OR...this only works if we are using
      // homogeneous boolean operators.
      bool isBooleanOpAnd;
      pTerm->GetBooleanAnd(&isBooleanOpAnd);
      m_ORSearch = !isBooleanOpAnd;

      intermediateEncodings[i] = EncodeTerm (pTerm);
      if (intermediateEncodings[i])
        encodingLength += strlen(intermediateEncodings[i]) + strlen(m_kTermSeparator);
    }
    encodingLength += strlen("?search");
    // Combine all the term encodings into one big encoding
    char *encoding = new char [encodingLength + 1];
    if (encoding)
    {
      PL_strcpy (encoding, "?search");

      m_searchTerms->Count(&numTerms);

      for (i = 0; i < numTerms; i++)
      {
        if (intermediateEncodings[i])
        {
          PL_strcat (encoding, m_kTermSeparator);
          PL_strcat (encoding, intermediateEncodings[i]);
          delete [] intermediateEncodings[i];
        }
      }
      *outEncoding = encoding;
    }
    else
      err = NS_ERROR_OUT_OF_MEMORY;
  }
  else
    err = NS_ERROR_OUT_OF_MEMORY;
  delete [] intermediateEncodings;

  return err;
}

NS_IMETHODIMP nsMsgSearchNews::AddHit(nsMsgKey key)
{
  m_candidateHits.AppendElement(key);
  return NS_OK;
}

/* void CurrentUrlDone (in long exitCode); */
NS_IMETHODIMP nsMsgSearchNews::CurrentUrlDone(int32_t exitCode)
{
  CollateHits();
  ReportHits();
  return NS_OK;
}


#if 0 // need to switch this to a notify stop loading handler, I think.
void nsMsgSearchNews::PreExitFunction (URL_Struct * /*url*/, int status, MWContext *context)
{
  MSG_SearchFrame *frame = MSG_SearchFrame::FromContext (context);
  nsMsgSearchNews *adapter = (nsMsgSearchNews*) frame->GetRunningAdapter();
  adapter->CollateHits();
  adapter->ReportHits();

  if (status == MK_INTERRUPTED)
  {
    adapter->Abort();
    frame->EndCylonMode();
  }
  else
  {
    frame->m_idxRunningScope++;
    if (frame->m_idxRunningScope >= frame->m_scopeList.Count())
      frame->EndCylonMode();
  }
}
#endif // 0

void nsMsgSearchNews::CollateHits()
{
  // Since the XPAT commands are processed one at a time, the result set for the
  // entire query is the intersection of results for each XPAT command if an AND search,
  // otherwise we want the union of all the search hits (minus the duplicates of course).

  uint32_t size = m_candidateHits.Length();
  if (!size)
    return;

  // Sort the article numbers first, so it's easy to tell how many hits
  // on a given article we got
  m_candidateHits.Sort();

  // For an OR search we only need to count the first occurrence of a candidate.
  uint32_t termCount = 1;
  if (!m_ORSearch)
  {
    // We have a traditional AND search which must be collated. In order to
    // get promoted into the hits list, a candidate article number must appear
    // in the results of each XPAT command. So if we fire 3 XPAT commands (one
    // per search term), the article number must appear 3 times. If it appears
    // fewer than 3 times, it matched some search terms, but not all.
    m_searchTerms->Count(&termCount);
  }
  uint32_t candidateCount = 0;
  uint32_t candidate = m_candidateHits[0];
  for (uint32_t index = 0; index < size; ++index)   
  {
    uint32_t possibleCandidate = m_candidateHits[index];
    if (candidate == possibleCandidate)
    {
      ++candidateCount;
    }
    else
    {
      candidateCount = 1;
      candidate = possibleCandidate;
    }
    if (candidateCount == termCount)
      m_hits.AppendElement(candidate);
  }
}

void nsMsgSearchNews::ReportHits ()
{
  nsCOMPtr <nsIMsgDatabase> db;
  nsCOMPtr <nsIDBFolderInfo>  folderInfo;
  nsCOMPtr <nsIMsgFolder> scopeFolder;

  nsresult err = m_scope->GetFolder(getter_AddRefs(scopeFolder));
  if (NS_SUCCEEDED(err) && scopeFolder)
  {
    err = scopeFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(db));
  }

  if (db)
  {
    uint32_t size = m_hits.Length();
    for (uint32_t i = 0; i < size; ++i)
    {
      nsCOMPtr <nsIMsgDBHdr> header;

      db->GetMsgHdrForKey(m_hits.ElementAt(i), getter_AddRefs(header));
      if (header)
        ReportHit(header, scopeFolder);
    }
  }
}

// ### this should take an nsIMsgFolder instead of a string location.
void nsMsgSearchNews::ReportHit (nsIMsgDBHdr *pHeaders, nsIMsgFolder *folder)
{
    // this is totally filched from msg_SearchOfflineMail until I decide whether the
    // right thing is to get them from the db or from NNTP

    nsresult err = NS_OK;
    nsCOMPtr<nsIMsgSearchSession> session;
    nsCOMPtr <nsIMsgFolder> scopeFolder;
    err = m_scope->GetFolder(getter_AddRefs(scopeFolder));
    m_scope->GetSearchSession(getter_AddRefs(session));
    if (session)
      session->AddSearchHit (pHeaders, scopeFolder);
}

nsresult nsMsgSearchValidityManager::InitNewsTable()
{
  NS_ASSERTION (nullptr == m_newsTable,"don't call this twice!");
  nsresult rv = NewTable (getter_AddRefs(m_newsTable));

  if (NS_SUCCEEDED(rv))
  {
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Contains, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Contains, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Is, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Is, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::BeginsWith, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::BeginsWith, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::EndsWith, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::EndsWith, 1);

    m_newsTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Contains, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Contains, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Is, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Is, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::BeginsWith, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::BeginsWith, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::EndsWith, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::EndsWith, 1);

#if 0
    // Size should be handled after the fact...
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Size, nsMsgSearchOp::IsGreaterThan, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Size, nsMsgSearchOp::IsGreaterThan, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::Size, nsMsgSearchOp::IsLessThan, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::Size, nsMsgSearchOp::IsLessThan, 1);
#endif
    
    m_newsTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Contains, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Contains, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Is, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Is, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::BeginsWith, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::BeginsWith, 1);
    m_newsTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::EndsWith, 1);
    m_newsTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::EndsWith, 1);
  }

  return rv;
}

nsresult nsMsgSearchValidityManager::InitNewsFilterTable()
{
  NS_ASSERTION (nullptr == m_newsFilterTable, "news filter table already initted");
  nsresult rv = NewTable (getter_AddRefs(m_newsFilterTable));

  if (NS_SUCCEEDED(rv))
  {
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Contains, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Contains, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::DoesntContain, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::DoesntContain, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Is, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Is, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Isnt, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::Isnt, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::BeginsWith, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::BeginsWith, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::EndsWith, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::EndsWith, 1);

    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::IsInAB, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::IsInAB, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Sender, nsMsgSearchOp::IsntInAB, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Sender, nsMsgSearchOp::IsntInAB, 1);

    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Contains, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Contains, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::DoesntContain, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::DoesntContain, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Is, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Is, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Isnt, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::Isnt, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::BeginsWith, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::BeginsWith, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Subject, nsMsgSearchOp::EndsWith, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Subject, nsMsgSearchOp::EndsWith, 1);

    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Date, nsMsgSearchOp::IsBefore, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Date, nsMsgSearchOp::IsBefore, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Date, nsMsgSearchOp::IsAfter, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Date, nsMsgSearchOp::IsAfter, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Date, nsMsgSearchOp::Is, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Date, nsMsgSearchOp::Is, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Date, nsMsgSearchOp::Isnt, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Date, nsMsgSearchOp::Isnt, 1);

    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Size, nsMsgSearchOp::IsGreaterThan, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Size, nsMsgSearchOp::IsGreaterThan, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::Size, nsMsgSearchOp::IsLessThan, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::Size, nsMsgSearchOp::IsLessThan, 1);

    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Contains, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Contains, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::DoesntContain, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::DoesntContain, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Is, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Is, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Isnt, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::Isnt, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::BeginsWith, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::BeginsWith, 1);
    m_newsFilterTable->SetAvailable (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::EndsWith, 1);
    m_newsFilterTable->SetEnabled   (nsMsgSearchAttrib::OtherHeader, nsMsgSearchOp::EndsWith, 1);
  }

  return rv;
}
