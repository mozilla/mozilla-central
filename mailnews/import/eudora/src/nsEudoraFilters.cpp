/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Mozilla Penelope project.
 *
 * The Initial Developer of the Original Code is
 * QUALCOMM Incorporated.
 * Portions created by QUALCOMM Incorporated are
 * Copyright (C) 2007 QUALCOMM Incorporated. All Rights Reserved.
 *
 * Contributor(s):
 *   Jeff Beckley <beckley@qualcomm.com> original author
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
  Eudora filters
*/

#include "nsCOMPtr.h"
#include "nscore.h"
#include "nsCRTGlue.h"
#include "nspr.h"
#include "plstr.h"
#include "nsMsgBaseCID.h"
#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "nsIMsgFilterList.h"
#include "nsIMsgAccountManager.h"

#include "nsEudoraFilters.h"
#include "nsEudoraStringBundle.h"

#include "nsNetUtil.h"
#include "nsILineInputStream.h"
#include "EudoraDebugLog.h"

#if defined(XP_WIN) || defined(XP_OS2)
#include "nsEudoraWin32.h"
#endif
#ifdef XP_MACOSX
#include "nsEudoraMac.h"
#endif



////////////////////////////////////////////////////////////////////////
nsresult nsEudoraFilters::Create(nsIImportFilters** aImport)
{
  NS_ENSURE_ARG_POINTER(aImport);
  *aImport = new nsEudoraFilters();
  NS_IF_ADDREF(*aImport);

  return *aImport? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

nsEudoraFilters::nsEudoraFilters()
{
}

nsEudoraFilters::~nsEudoraFilters()
{
}

NS_IMPL_ISUPPORTS1(nsEudoraFilters, nsIImportFilters)

NS_IMETHODIMP nsEudoraFilters::AutoLocate(PRUnichar **aDescription, nsIFile **aLocation, PRBool *_retval)
{
  NS_ENSURE_ARG_POINTER(aDescription);
  NS_ENSURE_ARG_POINTER(aLocation);
  NS_ENSURE_ARG_POINTER(_retval);

  *aDescription = nsnull;
  *_retval = PR_FALSE;

  nsresult rv;
  m_pLocation =  do_CreateInstance (NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  *aDescription = nsEudoraStringBundle::GetStringByID( EUDORAIMPORT_NAME);

#if defined(XP_WIN) || defined(XP_OS2)
  *_retval = nsEudoraWin32::FindFiltersFile( getter_AddRefs(m_pLocation) );
#endif
#ifdef XP_MACOSX
  *_retval = nsEudoraMac::FindFiltersFile( getter_AddRefs(m_pLocation) );
#endif

  NS_IF_ADDREF(*aLocation = m_pLocation);
  return NS_OK;
}

NS_IMETHODIMP nsEudoraFilters::SetLocation(nsIFile *aLocation)
{
  m_pLocation = aLocation;

  return( NS_OK);
}

NS_IMETHODIMP nsEudoraFilters::Import(PRUnichar **aError, PRBool *_retval)
{
  NS_ENSURE_ARG_POINTER(aError);
  NS_ENSURE_ARG_POINTER(_retval);
  nsresult rv;

  *_retval = PR_FALSE;
  *aError = nsnull;

  // Get the settings file if it doesn't exist
  if (!m_pLocation)
  {
    m_pLocation =  do_CreateInstance (NS_LOCAL_FILE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
#if defined(XP_WIN) || defined(XP_OS2)
    if (!nsEudoraWin32::FindFiltersFile(getter_AddRefs(m_pLocation)))
      m_pLocation = nsnull;
#endif
#ifdef XP_MACOSX
    if (!nsEudoraMac::FindFiltersFile(getter_AddRefs(m_pLocation)))
      m_pLocation = nsnull;
#endif
  }

  if (!m_pLocation)
  {
    IMPORT_LOG0( "*** Error, unable to locate filters file for import.\n");
    return( NS_ERROR_FAILURE);
  }

  // Now perform actual importing task
  *_retval = RealImport();
  *aError = ToNewUnicode(m_errorLog);

  if (*_retval)
    IMPORT_LOG0( "Successful import of eudora filters\n");
  else
    IMPORT_LOG0( "*** Error, Unsuccessful import of eudora filters\n");

  return( NS_OK);
}

PRBool nsEudoraFilters::RealImport()
{
  nsresult rv;

  rv = Init();
  if (NS_FAILED(rv))
  {
    IMPORT_LOG0( "*** Error initializing filter import process\n");
    return PR_FALSE;
  }

  nsCOMPtr <nsIInputStream> inputStream;
  rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), m_pLocation);

  if (NS_FAILED(rv))
  {
    IMPORT_LOG0( "*** Error opening filters file for reading\n");
    return PR_FALSE;
  }

  rv = LoadServers();
  if (NS_FAILED(rv))
  {
    IMPORT_LOG0( "*** Error loading servers with filters\n");
    return PR_FALSE;
  }

  nsCOMPtr<nsILineInputStream> lineStream(do_QueryInterface(inputStream, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString     line;
  PRBool        more = PR_TRUE;
  nsCAutoString header;
  nsCAutoString verb;
  nsAutoString  name;

  // Windows Eudora filters files have a version header as a first line - just skip it
#if defined(XP_WIN) || defined(XP_OS2)
  rv = lineStream->ReadLine(line, &more);
#endif

  while (more && NS_SUCCEEDED(rv))
  {
    rv = lineStream->ReadLine(line, &more);
    const char* pLine = line.get();
    if (NS_SUCCEEDED(rv))
    {
      // New filters start with a "rule <name>" line
      if (!strncmp(pLine, "rule ", 5))
      {
        rv = FinalizeFilter();
        if (NS_SUCCEEDED(rv))
        {
          const char* pName = pLine + 5;
          NS_CopyNativeToUnicode(nsCString(pName), name);
          rv = CreateNewFilter(pName);
        }
      }
#ifdef XP_MACOSX
      else if (!strncmp(pLine, "id ", 3))
        ;// ids have no value to us, but we don't want them to produce a warning either
#endif
      else if (!strncmp(pLine, "conjunction ", 12))
      {
        const char* cj = pLine + 12;
        if (!strcmp(cj, "and"))
          m_isAnd = PR_TRUE;
        else if (!strcmp(cj, "unless"))
          m_isUnless = PR_TRUE;
        else if (!strcmp(cj, "ignore"))
          m_ignoreTerm = PR_TRUE;
      }
      else if (!strncmp(pLine, "header ", 7))
        header = (pLine + 7);
      else if (!strncmp(pLine, "verb ", 5))
        verb = (pLine + 5);
      else if (!strncmp(pLine, "value ", 6))
      {
        if (!m_ignoreTerm)
        {
          rv = AddTerm(header.get(), verb.get(), pLine + 6, (m_isAnd || m_isUnless), m_isUnless);
          // For now, ignoring terms that can't be represented in TB filters
          if (rv == NS_ERROR_INVALID_ARG)
          {
            rv = NS_OK;
            m_termNotGroked = PR_TRUE;
          }
        }
      }
      else if (!strcmp(pLine, "incoming"))
        m_isIncoming = PR_TRUE;
      else if (!strncmp(pLine, "transfer ", 9) ||
               !strncmp(pLine, "copy ", 5))
      {
        const char* pMailboxPath = strchr(pLine, ' ') + 1;
        PRBool isTransfer = (*pLine == 't');
        rv = AddMailboxAction(pMailboxPath, isTransfer);
        if (rv == NS_ERROR_INVALID_ARG)
        {
          nsAutoString unicodeMailboxPath;
          NS_CopyNativeToUnicode(nsCString(pMailboxPath), unicodeMailboxPath);
          m_errorLog += NS_LITERAL_STRING("- ") + name + NS_LITERAL_STRING(": ") + nsEudoraStringBundle::FormatString(EUDORAIMPORT_FILTERS_WARN_MAILBOX_MISSING, unicodeMailboxPath.get()) + NS_LITERAL_STRING("\n") ;
          rv = NS_OK;
        }
      }
      // Doing strncmp() here because Win Eudora puts a space after "stop" but Mac Eudora doesn't
      else if (!strncmp(pLine, "stop", 4))
        m_hasStop = PR_TRUE;
      else if (!strncmp(pLine, "forward ", 8))
        rv = AddStringAction(nsMsgFilterAction::Forward, pLine + 8);
      else if (!strncmp(pLine, "reply ", 6))
        rv = AddStringAction(nsMsgFilterAction::Reply, pLine + 6);
      else if (!strncmp(pLine, "priority ", 9))
      {
        // Win Eudora's  priority values are 0 (highest) to 4 (lowest)
        // Mac Eudora's  priority values are 1 (highest) to 5 (lowest)
        // Thunderbird's priority values are 6 (highest) to 2 (lowest)
        PRInt32 TBPriority = 6 - atoi(pLine + 9);
#ifdef XP_MACOSX
        TBPriority++;
#endif
        rv = AddPriorityAction(TBPriority);
      }
      else if (!strncmp(pLine, "label ", 6))
      {
        nsCAutoString tagName("$label");
        tagName += pLine + 6;
        rv = AddStringAction(nsMsgFilterAction::AddTag, tagName.get());
      }
      // Doing strncmp() here because Win Eudora puts a space after "junk" but Mac Eudora doesn't
      else if (!strncmp(pLine, "junk", 4))
        rv = AddJunkAction(100);
      else if (!strncmp(pLine, "status ", 7))
      {
        // Win Eudora's read status is 1, whereas Mac Eudora's read status is 2
        PRUint32 status = atoi(pLine + 7);
#ifdef XP_MACOSX
        status--;
#endif
        if (status == 1)
          rv = AddAction(nsMsgFilterAction::MarkRead);
      }
      else if (!strncmp(pLine, "serverOpt ", 10))
      {
        // Win and Mac Eudora have the two bits swapped in the file
        PRUint32 bits = atoi(pLine + 10);
#if defined(XP_WIN) || defined(XP_OS2)
        PRBool bFetch  = (bits & 1);
        PRBool bDelete = (bits & 2);
#endif
#ifdef XP_MACOSX
        PRBool bFetch  = (bits & 2);
        PRBool bDelete = (bits & 1);
#endif
        rv = AddAction(bDelete? (nsMsgRuleActionType)nsMsgFilterAction::DeleteFromPop3Server : (nsMsgRuleActionType)nsMsgFilterAction::LeaveOnPop3Server);
        if (NS_SUCCEEDED(rv) && bFetch)
          rv = AddAction(nsMsgFilterAction::FetchBodyFromPop3Server);
      }
      else if (strcmp(pLine, "manual") == 0)
        ;// Just ignore manual as TB handles manual in a different way
      else if (strcmp(pLine, "outgoing") == 0)
        m_errorLog += NS_LITERAL_STRING("- ") + name + NS_LITERAL_STRING(": ") + nsEudoraStringBundle::FormatString(EUDORAIMPORT_FILTERS_WARN_OUTGOING) + NS_LITERAL_STRING("\n") ;
      else
      {
        nsAutoString unicodeLine;
        NS_CopyNativeToUnicode(nsCString(pLine), unicodeLine);
        m_errorLog += NS_LITERAL_STRING("- ") + name + NS_LITERAL_STRING(": ") + nsEudoraStringBundle::FormatString(EUDORAIMPORT_FILTERS_WARN_ACTION, unicodeLine.get()) + NS_LITERAL_STRING("\n");
      }
    }
  }

  // Process the last filter
  if (!more && NS_SUCCEEDED(rv))
    rv = FinalizeFilter();

  inputStream->Close();

  if (more)
  {
    IMPORT_LOG0( "*** Error reading the filters, didn't reach the end\n");
    return PR_FALSE;
  }

  rv = SaveFilters();

  return NS_SUCCEEDED(rv);
}

nsresult nsEudoraFilters::Init()
{
  nsresult rv;

  nsCOMPtr<nsIMsgAccountManager> accMgr = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgIncomingServer> server;
  rv = accMgr->GetLocalFoldersServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgFolder> localRootFolder;
  rv = server->GetRootMsgFolder(getter_AddRefs(localRootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  // we need to call GetSubFolders() so that the folders get initialized
  // if they are not initialized yet.
  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = localRootFolder->GetSubFolders(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  localRootFolder->GetChildNamed(NS_LITERAL_STRING("Eudora Mail"), getter_AddRefs(m_pMailboxesRoot));
  if (!m_pMailboxesRoot)
  {
    // If no "Eudora Mail" folder then this is a
    // migration which just puts it in the root
    m_pMailboxesRoot = localRootFolder;
  }

  return rv;
}

nsresult nsEudoraFilters::LoadServers()
{
  nsresult rv;

  if (m_pServerArray)
    rv = m_pServerArray->Clear();
  else
    rv = NS_NewISupportsArray(getter_AddRefs(m_pServerArray));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!m_pFilterArray)
    rv = NS_NewISupportsArray(getter_AddRefs(m_pFilterArray));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgFilterList> filterList;
  nsCOMPtr<nsIMsgAccountManager> accountMgr = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsArray> allServers;
  rv = accountMgr->GetAllServers(getter_AddRefs(allServers));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 numServers;
  rv = allServers->Count(&numServers);
  NS_ENSURE_SUCCESS(rv, rv);
  for (PRUint32 serverIndex = 0; serverIndex < numServers; serverIndex++)
  {
    nsCOMPtr<nsIMsgIncomingServer> server = do_QueryElementAt(allServers, serverIndex, &rv);
    if (server && NS_SUCCEEDED(rv))
    {
      PRBool canHaveFilters;
      rv = server->GetCanHaveFilters(&canHaveFilters);
      if (NS_SUCCEEDED(rv) && canHaveFilters)
      {
        nsCAutoString serverType;
        rv = server->GetType(serverType);
        if (NS_SUCCEEDED(rv) && !serverType.IsEmpty())
        {
          // Only get imap accounts and the special "none" (Local Folders) account
          // since all imported Eudora pop3 accounts will go to Local Folders
          if (serverType.Equals("none") || serverType.Equals("imap"))
          {
            // Pre-fetch filters now so that if there's any problem reading up the
            // filter file we know about it in advance and can stop importing
            nsCOMPtr<nsIMsgFilterList> filterList;
            rv = server->GetFilterList(nsnull, getter_AddRefs(filterList));
            NS_ENSURE_SUCCESS(rv, rv);

            m_pServerArray->AppendElement(server);
          }
        }
      }
    }
  }

  return NS_OK;
}

nsresult nsEudoraFilters::SaveFilters()
{
  nsresult rv;

  PRUint32 numServers;
  rv = m_pServerArray->Count(&numServers);
  NS_ENSURE_SUCCESS(rv, rv);
  for (PRUint32 serverIndex = 0; serverIndex < numServers; serverIndex++)
  {
    nsCOMPtr<nsIMsgIncomingServer> server = do_QueryElementAt(m_pServerArray, serverIndex, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr <nsIMsgFilterList> filterList;
    rv = server->GetFilterList(nsnull, getter_AddRefs(filterList));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = filterList->SaveToDefaultFile();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

nsresult nsEudoraFilters::CreateNewFilter(const char* pName)
{
  nsresult rv;

  rv = m_pFilterArray->Clear();
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString unicodeName;
  NS_CopyNativeToUnicode(nsCString(pName), unicodeName);
  PRUint32 numServers;
  rv = m_pServerArray->Count(&numServers);
  NS_ENSURE_SUCCESS(rv, rv);
  for (PRUint32 serverIndex = 0; serverIndex < numServers; serverIndex++)
  {
    nsCOMPtr<nsIMsgIncomingServer> server = do_QueryElementAt(m_pServerArray, serverIndex, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr <nsIMsgFilterList> filterList;
    rv = server->GetFilterList(nsnull, getter_AddRefs(filterList));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgFilter> newFilter;
    rv = filterList->CreateFilter(unicodeName, getter_AddRefs(newFilter));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = newFilter->SetEnabled(PR_FALSE);
    NS_ENSURE_SUCCESS(rv, rv);

    PRUint32 count;
    rv = filterList->GetFilterCount(&count);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = filterList->InsertFilterAt(count, newFilter);
    NS_ENSURE_SUCCESS(rv, rv);

    m_pFilterArray->AppendElement(newFilter);
  }

  m_isAnd = PR_FALSE;
  m_isUnless = PR_FALSE;
  m_ignoreTerm = PR_FALSE;
  m_isIncoming = PR_FALSE;
  m_addedAction = PR_FALSE;
  m_hasTransfer = PR_FALSE;
  m_hasStop = PR_FALSE;
  m_termNotGroked = PR_FALSE;

  return NS_OK;
}

nsresult nsEudoraFilters::FinalizeFilter()
{
  nsresult rv = NS_OK;

  // Transfer actions always stop filtering, so only add a stop action when there
  // was no transfer action in order to keep the filter action list cleaner
  if (m_hasStop && !m_hasTransfer)
    AddAction(nsMsgFilterAction::StopExecution);

  // TB only does filtering on incoming messages.
  // Also, if you don't provide an action for a filter, TB will provide a default action of moving
  // the message to the first mailbox in the first set of mailboxes.  Not what we want, so
  // we disable the filter (gives the user a chance to add their own actions and enable).
  // Lastly, only enable if all terms were fully understood.
  if (m_isIncoming && m_addedAction && !m_termNotGroked)
    rv = EnableFilter(PR_TRUE);

  return rv;
}

nsresult nsEudoraFilters::EnableFilter(PRBool enable)
{
  nsresult rv;

  PRUint32 numFilters;
  rv = m_pFilterArray->Count(&numFilters);
  NS_ENSURE_SUCCESS(rv, rv);
  for (PRUint32 filterIndex = 0; filterIndex < numFilters; filterIndex++)
  {
    nsCOMPtr<nsIMsgFilter> filter = do_QueryElementAt(m_pFilterArray, filterIndex, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    filter->SetEnabled(enable);
  }

  return NS_OK;
}

// Different character sets on Windows and Mac put left and right double angle quotes in different spots
#if defined(XP_WIN) || defined(XP_OS2)
#define LDAQ "«"
#define RDAQ "»"
#elif XP_MACOSX
#define LDAQ "Ç"
#define RDAQ "È"
#endif

static const char* gStandardHeaders[] =
{
// Eudora string        nsMsgSearchAttribValue
// -------------        ----------------------
    "Subject:",              // Subject
    "From:",                 // Sender
    LDAQ"Body"RDAQ,          // Body
    "Date:",                 // Date
    "X-Priority:",           // Priority
    "",                      // MsgStatus
    "To:",                   // To
    "Cc:",                   // CC
    LDAQ"Any Recipient"RDAQ, // ToOrCC
    NULL
};

static PRInt32 FindHeader(const char* pHeader)
{
  for (PRInt32 i = 0; gStandardHeaders[i]; i++)
  {
    if (*gStandardHeaders[i] && !PL_strcasecmp(pHeader, gStandardHeaders[i]))
      return i;
  }

  return -1;
}

static const char* gOperators[] =
{
// Eudora string        nsMsgSearchOpValue
// -------------        ------------------
    "contains",         // Contains
    "!contains",        // DoesntContain
    "is",               // Is
    "!is",              // Isnt
    "",                 // IsEmpty
    "",                 // IsBefore
    "",                 // IsAfter
    "",                 // IsHigherThan
    "",                 // IsLowerThan
    "starts",           // BeginsWith
    "ends",             // EndsWith
    "",                 // SoundsLike
    "",                 // LdapDwim
    "",                 // IsGreaterThan
    "",                 // IsLessThan
    "",                 // NameCompletion
    "intersectsFile",   // IsInAB
    "disjointFile",     // IsntInAB
    NULL
};

static PRInt32 FindOperator(const char* pOperator)
{
  for (PRInt32 i = 0; gOperators[i]; i++)
  {
    if (*gOperators[i] && !strcmp(pOperator, gOperators[i]))
      return i;
  }

  return -1;
}

#define MAILNEWS_CUSTOM_HEADERS "mailnews.customHeaders"

static PRInt32 AddCustomHeader(const char* pHeader)
{
  nsresult rv;
  PRInt32 index = -1;
  nsCOMPtr<nsIPrefBranch> pref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, index);

  nsCAutoString headers;
  pref->GetCharPref(MAILNEWS_CUSTOM_HEADERS, getter_Copies(headers));
  index = 0;
  if (!headers.IsEmpty())
  {
    char *headersString = ToNewCString(headers);
    nsCAutoString hdrStr;
    hdrStr.Adopt(headersString);
    hdrStr.StripWhitespace();  //remove whitespace before parsing

    char *newStr = headersString;
    char *token = NS_strtok(":", &newStr);
    while (token)
    {
      if (!PL_strcasecmp(token, pHeader))
        return index;
      token = NS_strtok(":", &newStr);
      index++;
    }
    headers += ":";
  }
  headers += pHeader;
  pref->SetCharPref(MAILNEWS_CUSTOM_HEADERS, headers.get());

  return index;
}

nsresult nsEudoraFilters::AddTerm(const char* pHeader, const char* pVerb, const char* pValue, PRBool booleanAnd, PRBool negateVerb)
{
  nsresult rv;

  nsMsgSearchAttribValue attrib = FindHeader(pHeader);
  nsMsgSearchOpValue     op = FindOperator(pVerb);
  nsCAutoString          arbitraryHeader;
  nsAutoString           unicodeHeader, unicodeVerb, unicodeValue;
  nsAutoString           filterTitle;

  NS_CopyNativeToUnicode(nsCString(pHeader), unicodeHeader);
  NS_CopyNativeToUnicode(nsCString(pVerb), unicodeVerb);
  NS_CopyNativeToUnicode(nsCString(pValue), unicodeValue);

  filterTitle = NS_LITERAL_STRING("- ") + unicodeHeader + NS_LITERAL_STRING(" ") + unicodeVerb + NS_LITERAL_STRING(" ") + unicodeValue + NS_LITERAL_STRING(": ");

  if (op < 0)
  {
    m_errorLog += filterTitle + nsEudoraStringBundle::FormatString(EUDORAIMPORT_FILTERS_WARN_VERB, pVerb) + NS_LITERAL_STRING("\n");
    return NS_ERROR_INVALID_ARG;
  }

  if (!pHeader || !*pHeader)
  {
    m_errorLog += filterTitle + nsEudoraStringBundle::FormatString(EUDORAIMPORT_FILTERS_WARN_EMPTY_HEADER) + NS_LITERAL_STRING("\n");
    return NS_ERROR_INVALID_ARG;
  }

  if (negateVerb)
  {
    switch (op)
    {
      case nsMsgSearchOp::Contains:
      case nsMsgSearchOp::Is:
      case nsMsgSearchOp::IsInAB:
        op++;
        break;
      case nsMsgSearchOp::DoesntContain:
      case nsMsgSearchOp::Isnt:
      case nsMsgSearchOp::IsntInAB:
        op--;
        break;
      default:
        m_errorLog += filterTitle + nsEudoraStringBundle::FormatString(EUDORAIMPORT_FILTERS_WARN_NEGATE_VERB, unicodeVerb.get()) + NS_LITERAL_STRING("\n");
        return NS_ERROR_INVALID_ARG;
    }
  }

  if (attrib < 0)
  {
    // Can't handle other Eudora meta-headers (Any Header, Personality, Junk Score)
    if (*pHeader == *LDAQ)
    {
      m_errorLog += filterTitle + nsEudoraStringBundle::FormatString(EUDORAIMPORT_FILTERS_WARN_META_HEADER, unicodeHeader.get()) + NS_LITERAL_STRING("\n");
      return NS_ERROR_INVALID_ARG;
    }

    // Arbitrary headers for filters don't like the colon at the end
    arbitraryHeader = pHeader;
    PRInt32 index = arbitraryHeader.FindChar(':');
    if (index >= 0)
      arbitraryHeader.SetLength(index);

    PRInt32 headerIndex = AddCustomHeader(arbitraryHeader.get());
    NS_ENSURE_TRUE(headerIndex >= 0, NS_ERROR_FAILURE);

    attrib = nsMsgSearchAttrib::OtherHeader + 1 + headerIndex;
  }

  PRUint32 numFilters;
  rv = m_pFilterArray->Count(&numFilters);
  NS_ENSURE_SUCCESS(rv, rv);
  for (PRUint32 filterIndex = 0; filterIndex < numFilters; filterIndex++)
  {
    nsCOMPtr<nsIMsgFilter> filter = do_QueryElementAt(m_pFilterArray, filterIndex, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsISupportsArray> terms;
    rv = filter->GetSearchTerms(getter_AddRefs(terms));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgSearchTerm> term;
    if (booleanAnd)
    {
      term = do_QueryElementAt(terms, 0, &rv);
      if (NS_SUCCEEDED(rv) && term)
      {
        term->SetBooleanAnd(PR_TRUE);
        term = nsnull;
      }
    }

    rv = filter->CreateTerm(getter_AddRefs(term));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgSearchValue> value;
    rv = term->GetValue(getter_AddRefs(value));
    NS_ENSURE_SUCCESS(rv, rv);

    value->SetAttrib(attrib);
    value->SetStr(unicodeValue);
    term->SetAttrib(attrib);
    term->SetOp(op);
    term->SetBooleanAnd(booleanAnd);
    if (!arbitraryHeader.IsEmpty())
      term->SetArbitraryHeader(arbitraryHeader);
    term->SetValue(value);
    filter->AppendTerm(term);
  }

  return NS_OK;
}

nsresult nsEudoraFilters::AddAction(nsMsgRuleActionType actionType, PRInt32 junkScore /*= 0*/, nsMsgLabelValue label/*= 0*/,
                                    nsMsgPriorityValue priority/*= 0*/, const char* strValue/*= nsnull*/, const char* targetFolderUri/*= nsnull*/)
{
  nsresult rv;

  PRUint32 numFilters;
  rv = m_pFilterArray->Count(&numFilters);
  NS_ENSURE_SUCCESS(rv, rv);
  for (PRUint32 filterIndex = 0; filterIndex < numFilters; filterIndex++)
  {
    nsCOMPtr<nsIMsgFilter> filter = do_QueryElementAt(m_pFilterArray, filterIndex, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgRuleAction> action;
    rv = filter->CreateAction(getter_AddRefs(action));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = action->SetType(actionType);
    NS_ENSURE_SUCCESS(rv, rv);

    switch (actionType)
    {
      case nsMsgFilterAction::MoveToFolder:
      case nsMsgFilterAction::CopyToFolder:
        rv = action->SetTargetFolderUri(nsCAutoString(targetFolderUri));
        break;

      case nsMsgFilterAction::ChangePriority:
        rv = action->SetPriority(priority);
        break;

      case nsMsgFilterAction::JunkScore:
        rv = action->SetJunkScore(junkScore);
        break;

      case nsMsgFilterAction::AddTag:
      case nsMsgFilterAction::Reply:
      case nsMsgFilterAction::Forward:
        rv = action->SetStrValue(nsCAutoString(strValue));
        break;

      case nsMsgFilterAction::MarkRead:
      case nsMsgFilterAction::StopExecution:
      case nsMsgFilterAction::DeleteFromPop3Server:
      case nsMsgFilterAction::LeaveOnPop3Server:
      case nsMsgFilterAction::FetchBodyFromPop3Server:
        // No parameters for these
        break;

      case nsMsgFilterAction::Delete:
      case nsMsgFilterAction::KillThread:
      case nsMsgFilterAction::WatchThread:
      case nsMsgFilterAction::MarkFlagged:
      case nsMsgFilterAction::Label:
      default:
        // Something we don't handle
        return NS_ERROR_FAILURE;
    }
    NS_ENSURE_SUCCESS(rv, rv);

    rv = filter->AppendAction(action);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  m_addedAction = PR_TRUE;

  return rv;
}


nsresult nsEudoraFilters::AddMailboxAction(const char* pMailboxPath, PRBool isTransfer)
{
  nsresult rv;
  nsCString nameHierarchy;
#if defined(XP_WIN) || defined(XP_OS2)
  nsCString filePath;
  m_pLocation->GetNativePath(filePath);
  PRInt32 index = filePath.RFindChar('\\');
  if (index >= 0)
    filePath.SetLength(index);
  if (nsEudoraWin32::GetMailboxNameHierarchy(filePath, pMailboxPath, nameHierarchy) == PR_FALSE)
    return NS_ERROR_INVALID_ARG;
#endif
#if defined(XP_MAC) || defined(XP_MACOSX)
  nameHierarchy = pMailboxPath;
#endif

  nsCOMPtr<nsIMsgFolder> folder;
  rv = GetMailboxFolder(nameHierarchy.get(), getter_AddRefs(folder));

  nsCAutoString folderURI;
  if (NS_SUCCEEDED(rv))
    rv = folder->GetURI(folderURI);
  if (NS_FAILED(rv))
    return NS_ERROR_INVALID_ARG;

  rv = AddAction(isTransfer? (nsMsgRuleActionType)nsMsgFilterAction::MoveToFolder : (nsMsgRuleActionType)nsMsgFilterAction::CopyToFolder, 0, 0, 0, nsnull, folderURI.get());

  if (NS_SUCCEEDED(rv) && isTransfer)
    m_hasTransfer = PR_TRUE;

  return rv;
}

nsresult nsEudoraFilters::GetMailboxFolder(const char* pNameHierarchy, nsIMsgFolder** ppFolder)
{
  NS_ENSURE_ARG_POINTER(ppFolder);

  nsCOMPtr<nsIMsgFolder> folder(*ppFolder ? *ppFolder : m_pMailboxesRoot.get());

  // We've already grabbed the pointer on incoming, so now ensure
  // *ppFolder is null on outgoing if there is an error
  *ppFolder = nsnull;
  
  nsCAutoString name(pNameHierarchy + 1);
  PRInt32 sepIndex = name.FindChar(*pNameHierarchy);
  if (sepIndex >= 0)
    name.SetLength(sepIndex);

  nsAutoString unicodeName;
  NS_CopyNativeToUnicode(name, unicodeName);

  nsCOMPtr<nsIMsgFolder> subFolder;
  nsresult rv = folder->GetChildNamed(unicodeName, getter_AddRefs(subFolder));
  if (NS_SUCCEEDED(rv))
  {
    *ppFolder = subFolder;
    if (sepIndex >= 0)
      return GetMailboxFolder(pNameHierarchy + sepIndex + 1, ppFolder);
    NS_IF_ADDREF(*ppFolder);
  }

  return rv;
}
