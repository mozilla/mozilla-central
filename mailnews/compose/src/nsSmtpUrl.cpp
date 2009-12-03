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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Eric Ballet Baz BT Global Services / Etat francais Ministere de la Defense
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "msgCore.h"

#include "nsIURI.h"
#include "nsNetCID.h"
#include "nsSmtpUrl.h"
#include "nsString.h"
#include "nsReadableUtils.h"
#include "nsEscape.h"
#include "nsMsgUtils.h"
#include "nsIMimeConverter.h"
#include "nsMsgMimeCID.h"
#include "nsISupportsObsolete.h"

/////////////////////////////////////////////////////////////////////////////////////
// mailto url definition
/////////////////////////////////////////////////////////////////////////////////////
nsMailtoUrl::nsMailtoUrl()
{
  mFormat = nsIMsgCompFormat::Default;
  m_baseURL = do_CreateInstance(NS_SIMPLEURI_CONTRACTID);
}

nsMailtoUrl::~nsMailtoUrl()
{
}

NS_IMPL_ISUPPORTS2(nsMailtoUrl, nsIMailtoUrl, nsIURI)

nsresult nsMailtoUrl::ParseMailtoUrl(char * searchPart)
{
  char *rest = searchPart;
  nsCString escapedInReplyToPart;
  nsCString escapedToPart;
  nsCString escapedCcPart;
  nsCString escapedSubjectPart;
  nsCString escapedNewsgroupPart;
  nsCString escapedNewsHostPart;
  nsCString escapedReferencePart;
  nsCString escapedBodyPart;
  nsCString escapedBccPart;
  nsCString escapedFollowUpToPart;
  nsCString escapedFromPart;
  nsCString escapedHtmlPart;
  nsCString escapedOrganizationPart;
  nsCString escapedReplyToPart;
  nsCString escapedPriorityPart;

  // okay, first, free up all of our old search part state.....
  CleanupMailtoState();
  // m_toPart has the escaped address from before the query string, copy it
  // over so we can add on any additional to= addresses and unescape them all.
  escapedToPart = m_toPart;

  if (rest && *rest == '?')
  {
    /* start past the '?' */
    rest++;
  }

  if (rest)
  {
    char *token = NS_strtok("&", &rest);
    while (token && *token)
    {
      char *value = 0;
      char *eq = PL_strchr(token, '=');
      if (eq)
      {
        value = eq+1;
        *eq = 0;
      }

      switch (toupper(*token))
      {
        /* DO NOT support attachment= in mailto urls. This poses a security fire hole!!! 
                          case 'A':
                          if (!PL_strcasecmp (token, "attachment"))
                          m_attachmentPart = value;
                          break;
                     */
      case 'B':
        if (!PL_strcasecmp (token, "bcc"))
        {
          if (!escapedBccPart.IsEmpty())
          {
            escapedBccPart += ", ";
            escapedBccPart += value;
          }
          else
            escapedBccPart = value; 
        }
        else if (!PL_strcasecmp (token, "body"))
        {
          if (!escapedBodyPart.IsEmpty())
          {
            escapedBodyPart +="\n";
            escapedBodyPart += value;
          }
          else
            escapedBodyPart = value;
        }
        break;
      case 'C': 
        if (!PL_strcasecmp  (token, "cc"))
        {
          if (!escapedCcPart.IsEmpty())
          {
            escapedCcPart += ", ";
            escapedCcPart += value;
          }
          else
            escapedCcPart = value;
        }
        break;
      case 'F': 
        if (!PL_strcasecmp (token, "followup-to"))
          escapedFollowUpToPart = value;
        else if (!PL_strcasecmp (token, "from"))
          escapedFromPart = value;
        break;
      case 'H':
        if (!PL_strcasecmp(token, "html-part") ||
            !PL_strcasecmp(token, "html-body"))
        {
          // escapedHtmlPart holds the body for both html-part and html-body.
          escapedHtmlPart = value;
          mFormat = nsIMsgCompFormat::HTML;
        }
        break;
      case 'I':
        if (!PL_strcasecmp (token, "in-reply-to"))
          escapedInReplyToPart = value;
        break;

      case 'N':
        if (!PL_strcasecmp (token, "newsgroups"))
          escapedNewsgroupPart = value;
        else if (!PL_strcasecmp (token, "newshost"))
          escapedNewsHostPart = value;
        break;
      case 'O':
        if (!PL_strcasecmp (token, "organization"))
          escapedOrganizationPart = value;
        break;
      case 'R':
        if (!PL_strcasecmp (token, "references"))
          escapedReferencePart = value;
        else if (!PL_strcasecmp (token, "reply-to"))
          escapedReplyToPart = value;
        break;
      case 'S':
        if(!PL_strcasecmp (token, "subject"))
          escapedSubjectPart = value;
        break;
      case 'P':
        if (!PL_strcasecmp (token, "priority"))
          escapedPriorityPart = PL_strdup(value);
        break;
      case 'T':
        if (!PL_strcasecmp (token, "to"))
        {
          if (!escapedToPart.IsEmpty())
          {
            escapedToPart += ", ";
            escapedToPart += value;
          }
          else
            escapedToPart = value;
        }
        break;
      default:
        break;
      } // end of switch statement...

      if (eq)
        *eq = '='; /* put it back */
      token = NS_strtok("&", &rest);
    } // while we still have part of the url to parse...
  } // if rest && *rest

  nsCOMPtr<nsIMimeConverter> mimeConverter = do_GetService(NS_MIME_CONVERTER_CONTRACTID);
  char *decodedString;

  // Now unescape everything, and mime-decode the things that can be encoded.
  if (!escapedToPart.IsEmpty())
  {
    MsgUnescapeString(escapedToPart, 0, m_toPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                           m_toPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                           &decodedString)) && decodedString)
        m_toPart.Adopt(decodedString);
    }
  }
  if (!escapedCcPart.IsEmpty())
  {
    MsgUnescapeString(escapedCcPart, 0, m_ccPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                           m_ccPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                           &decodedString)) && decodedString)
        m_ccPart.Adopt(decodedString);
    }
  }
  if (!escapedBccPart.IsEmpty())
  {
    MsgUnescapeString(escapedBccPart, 0, m_bccPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                           m_bccPart.get(),"UTF-8", PR_FALSE, PR_TRUE,
                           &decodedString)) && decodedString)
        m_bccPart.Adopt(decodedString);
    }
  }
  if (!escapedSubjectPart.IsEmpty())
  {
    MsgUnescapeString(escapedSubjectPart, 0, m_subjectPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                           m_subjectPart.get(),"UTF-8", PR_FALSE, PR_TRUE,
                           &decodedString)) && decodedString)
        m_subjectPart.Adopt(decodedString);
    }
  }
  if (!escapedNewsgroupPart.IsEmpty())
  {
    MsgUnescapeString(escapedNewsgroupPart, 0, m_newsgroupPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         m_newsgroupPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        m_newsgroupPart.Adopt(decodedString);
    }
  }
  if (!escapedReferencePart.IsEmpty())
  {
    MsgUnescapeString(escapedReferencePart, 0, m_referencePart);
    // Mime encoding allowed, but only useless such (only ascii allowed).
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         m_referencePart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        m_referencePart.Adopt(decodedString);
    }
  }
  if (!escapedBodyPart.IsEmpty())
    MsgUnescapeString(escapedBodyPart, 0, m_bodyPart);
  if (!escapedHtmlPart.IsEmpty())
    MsgUnescapeString(escapedHtmlPart, 0, m_htmlPart);
  if (!escapedNewsHostPart.IsEmpty())
  {
    MsgUnescapeString(escapedNewsHostPart, 0, m_newsHostPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         m_newsHostPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        m_newsHostPart.Adopt(decodedString);
    }
  }
  if (!escapedFollowUpToPart.IsEmpty())
  {
    MsgUnescapeString(escapedFollowUpToPart, 0, m_followUpToPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         m_followUpToPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        m_followUpToPart.Adopt(decodedString);
    }
  }
  if (!escapedFromPart.IsEmpty())
  {
    MsgUnescapeString(escapedFromPart, 0, m_fromPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         m_fromPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        m_fromPart.Adopt(decodedString);
    }
  }
  if (!escapedOrganizationPart.IsEmpty())
  {
    MsgUnescapeString(escapedOrganizationPart, 0, m_organizationPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         m_organizationPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        m_organizationPart.Adopt(decodedString);
    }
  }
  if (!escapedReplyToPart.IsEmpty())
  {
    MsgUnescapeString(escapedReplyToPart, 0, m_replyToPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         m_replyToPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        m_replyToPart.Adopt(decodedString);
    }
  }
  if (!escapedPriorityPart.IsEmpty())
  {
    MsgUnescapeString(escapedPriorityPart, 0, m_priorityPart);
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         m_priorityPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        m_priorityPart.Adopt(decodedString);
    }
  }

  nsCString inReplyToPart; // Not a member like the others...
  if (!escapedInReplyToPart.IsEmpty())
  {
    MsgUnescapeString(escapedInReplyToPart, 0, inReplyToPart);
    // Mime encoding allowed, but only useless such (non ascii not allowed).
    if (mimeConverter)
    {
      if (NS_SUCCEEDED(mimeConverter->DecodeMimeHeaderToCharPtr(
                         inReplyToPart.get(), "UTF-8", PR_FALSE, PR_TRUE,
                         &decodedString)) && decodedString)
        inReplyToPart.Adopt(decodedString);
    }
  }

  if (!inReplyToPart.IsEmpty())
  {
    // Ensure that References and In-Reply-To are consistent... The last
    // reference will be used as In-Reply-To header.
    if (m_referencePart.IsEmpty())
    {
      // If References is not set, set it to be the In-Reply-To.
      m_referencePart = inReplyToPart;
    }
    else
    {
      // References is set. Add the In-Reply-To as last header unless it's
      // set as last reference already.
      PRInt32 lastRefStart = m_referencePart.RFindChar('<');
      nsCAutoString lastReference;
      if (lastRefStart != -1)
        lastReference = StringTail(m_referencePart, lastRefStart);
      else
        lastReference = m_referencePart;

      if (lastReference != inReplyToPart)
      {
        m_referencePart += " ";
        m_referencePart += inReplyToPart;
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMailtoUrl::SetSpec(const nsACString &aSpec)
{
  m_baseURL->SetSpec(aSpec);
  return ParseUrl();
}

nsresult nsMailtoUrl::CleanupMailtoState()
{
    m_ccPart = "";
    m_subjectPart = "";
    m_newsgroupPart = "";
    m_newsHostPart = ""; 
    m_referencePart = "";
    m_bodyPart = "";
    m_bccPart = "";
    m_followUpToPart = "";
    m_fromPart = "";
    m_htmlPart = "";
    m_organizationPart = "";
    m_replyToPart = "";
    m_priorityPart = "";
	return NS_OK;
}

nsresult nsMailtoUrl::ParseUrl()
{
  nsresult rv = NS_OK;

  // we can get the path from the simple url.....
  nsCString escapedPath;
  m_baseURL->GetPath(escapedPath);

  PRInt32 startOfSearchPart = escapedPath.FindChar('?');
  if (startOfSearchPart >= 0)
  {
    // now parse out the search field...
    nsCString searchPart;
    PRUint32 numExtraChars = escapedPath.Right(searchPart,
                                               escapedPath.Length() -
                                               startOfSearchPart);
    if (!searchPart.IsEmpty())
    {
      // now we need to strip off the search part from the
      // to part....
      escapedPath.Cut(startOfSearchPart, numExtraChars);
      MsgUnescapeString(escapedPath, 0, m_toPart);
      ParseMailtoUrl(searchPart.BeginWriting());
    }
  }
  else if (!escapedPath.IsEmpty())
  {
    MsgUnescapeString(escapedPath, 0, m_toPart);
  }

  return rv;
}

NS_IMETHODIMP
nsMailtoUrl::GetMessageContents(nsACString &aToPart, nsACString &aCcPart,
                                nsACString &aBccPart, nsACString &aSubjectPart,
                                nsACString &aBodyPart, nsACString &aHtmlPart,
                                nsACString &aReferencePart,
                                nsACString &aNewsgroupPart,
                                MSG_ComposeFormat *aFormat)
{
  NS_ENSURE_ARG_POINTER(aFormat);

  aToPart = m_toPart;
  aCcPart = m_ccPart;
  aBccPart = m_bccPart;
  aSubjectPart = m_subjectPart;
  aBodyPart = m_bodyPart;
  aHtmlPart = m_htmlPart;
  aReferencePart = m_referencePart;
  aNewsgroupPart = m_newsgroupPart;
  *aFormat = mFormat;
  return NS_OK;
}

NS_IMETHODIMP
nsMailtoUrl::GetFromPart(nsACString &aResult)
{
  aResult = m_fromPart;
  return NS_OK;
}

NS_IMETHODIMP
nsMailtoUrl::GetFollowUpToPart(nsACString &aResult)
{
  aResult = m_followUpToPart;
  return NS_OK;
}

NS_IMETHODIMP
nsMailtoUrl::GetOrganizationPart(nsACString &aResult)
{
  aResult = m_organizationPart;
  return NS_OK;
}

NS_IMETHODIMP
nsMailtoUrl::GetReplyToPart(nsACString &aResult)
{
  aResult = m_replyToPart;
  return NS_OK;
}

NS_IMETHODIMP
nsMailtoUrl::GetPriorityPart(nsACString &aResult)
{
  aResult = m_priorityPart;
  return NS_OK;
}

NS_IMETHODIMP
nsMailtoUrl::GetNewsHostPart(nsACString &aResult)
{
  aResult = m_newsHostPart;
  return NS_OK;
}

//////////////////////////////////////////////////////////////////////////////
// Begin nsIURI support
//////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP nsMailtoUrl::GetSpec(nsACString &aSpec)
{
	return m_baseURL->GetSpec(aSpec);
}

NS_IMETHODIMP nsMailtoUrl::GetPrePath(nsACString &aPrePath)
{
	return m_baseURL->GetPrePath(aPrePath);
}

NS_IMETHODIMP nsMailtoUrl::GetScheme(nsACString &aScheme)
{
	return m_baseURL->GetScheme(aScheme);
}

NS_IMETHODIMP nsMailtoUrl::SetScheme(const nsACString &aScheme)
{
	m_baseURL->SetScheme(aScheme);
	return ParseUrl();
}

NS_IMETHODIMP nsMailtoUrl::GetUserPass(nsACString &aUserPass)
{
	return m_baseURL->GetUserPass(aUserPass);
}

NS_IMETHODIMP nsMailtoUrl::SetUserPass(const nsACString &aUserPass)
{
	m_baseURL->SetUserPass(aUserPass);
	return ParseUrl();
}

NS_IMETHODIMP nsMailtoUrl::GetUsername(nsACString &aUsername)
{
	return m_baseURL->GetUsername(aUsername);
}

NS_IMETHODIMP nsMailtoUrl::SetUsername(const nsACString &aUsername)
{
	m_baseURL->SetUsername(aUsername);
	return ParseUrl();
}

NS_IMETHODIMP nsMailtoUrl::GetPassword(nsACString &aPassword)
{
	return m_baseURL->GetPassword(aPassword);
}

NS_IMETHODIMP nsMailtoUrl::SetPassword(const nsACString &aPassword)
{
	m_baseURL->SetPassword(aPassword);
	return ParseUrl();
}

NS_IMETHODIMP nsMailtoUrl::GetHostPort(nsACString &aHostPort)
{
	return m_baseURL->GetHost(aHostPort);
}

NS_IMETHODIMP nsMailtoUrl::SetHostPort(const nsACString &aHostPort)
{
	m_baseURL->SetHost(aHostPort);
	return ParseUrl();
}

NS_IMETHODIMP nsMailtoUrl::GetHost(nsACString &aHost)
{
	return m_baseURL->GetHost(aHost);
}

NS_IMETHODIMP nsMailtoUrl::SetHost(const nsACString &aHost)
{
	m_baseURL->SetHost(aHost);
	return ParseUrl();
}

NS_IMETHODIMP nsMailtoUrl::GetPort(PRInt32 *aPort)
{
	return m_baseURL->GetPort(aPort);
}

NS_IMETHODIMP nsMailtoUrl::SetPort(PRInt32 aPort)
{
	m_baseURL->SetPort(aPort);
	return ParseUrl();
}

NS_IMETHODIMP nsMailtoUrl::GetPath(nsACString &aPath)
{
	return m_baseURL->GetPath(aPath);
}

NS_IMETHODIMP nsMailtoUrl::SetPath(const nsACString &aPath)
{
	m_baseURL->SetPath(aPath);
	return ParseUrl();
}

NS_IMETHODIMP nsMailtoUrl::GetAsciiHost(nsACString &aHostA)
{
	return m_baseURL->GetAsciiHost(aHostA);
}

NS_IMETHODIMP nsMailtoUrl::GetAsciiSpec(nsACString &aSpecA)
{
	return m_baseURL->GetAsciiSpec(aSpecA);
}

NS_IMETHODIMP nsMailtoUrl::GetOriginCharset(nsACString &aOriginCharset)
{
    return m_baseURL->GetOriginCharset(aOriginCharset);
}

NS_IMETHODIMP nsMailtoUrl::SchemeIs(const char *aScheme, PRBool *_retval)
{
	return m_baseURL->SchemeIs(aScheme, _retval);
}

NS_IMETHODIMP nsMailtoUrl::Equals(nsIURI *other, PRBool *_retval)
{
	return m_baseURL->Equals(other, _retval);
}

NS_IMETHODIMP nsMailtoUrl::Clone(nsIURI **_retval)
{
	return m_baseURL->Clone(_retval);
}	

NS_IMETHODIMP nsMailtoUrl::Resolve(const nsACString &relativePath, nsACString &result) 
{
	return m_baseURL->Resolve(relativePath, result);
}




/////////////////////////////////////////////////////////////////////////////////////
// smtp url definition
/////////////////////////////////////////////////////////////////////////////////////

nsSmtpUrl::nsSmtpUrl() : nsMsgMailNewsUrl()
{
  // nsISmtpUrl specific state...

  m_isPostMessage = PR_TRUE;
  m_requestDSN = PR_FALSE;
  m_verifyLogon = PR_FALSE;
}
 
nsSmtpUrl::~nsSmtpUrl()
{
}
  
NS_IMPL_ISUPPORTS_INHERITED1(nsSmtpUrl, nsMsgMailNewsUrl, nsISmtpUrl)  

////////////////////////////////////////////////////////////////////////////////////
// Begin nsISmtpUrl specific support

////////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsSmtpUrl::SetRecipients(const char * aRecipientsList)
{
  NS_ENSURE_ARG(aRecipientsList);
  m_toPart = aRecipientsList;
  if (!m_toPart.IsEmpty())
    nsUnescape(m_toPart.BeginWriting());
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::GetRecipients(char ** aRecipientsList)
{
  NS_ENSURE_ARG_POINTER(aRecipientsList);
  if (aRecipientsList)
    *aRecipientsList = ToNewCString(m_toPart);
  return NS_OK;
}

NS_IMPL_GETSET(nsSmtpUrl, PostMessage, PRBool, m_isPostMessage)

NS_IMPL_GETSET(nsSmtpUrl, VerifyLogon, PRBool, m_verifyLogon)

// the message can be stored in a file....allow accessors for getting and setting
// the file name to post...
NS_IMETHODIMP nsSmtpUrl::SetPostMessageFile(nsIFile * aFile)
{
  NS_ENSURE_ARG_POINTER(aFile);
  m_fileName = aFile;
  return NS_OK;
}

NS_IMETHODIMP nsSmtpUrl::GetPostMessageFile(nsIFile ** aFile)
{
  NS_ENSURE_ARG_POINTER(aFile);
  if (m_fileName)
  {
    // Clone the file so nsLocalFile stat caching doesn't make the caller get
    // the wrong file size.
    m_fileName->Clone(aFile);
    return *aFile ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
  }
  return NS_ERROR_NULL_POINTER;
}

NS_IMPL_GETSET(nsSmtpUrl, RequestDSN, PRBool, m_requestDSN)

NS_IMETHODIMP 
nsSmtpUrl::SetDsnEnvid(const nsACString &aDsnEnvid)
{
    m_dsnEnvid = aDsnEnvid;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::GetDsnEnvid(nsACString &aDsnEnvid)
{
    aDsnEnvid = m_dsnEnvid;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::GetSenderIdentity(nsIMsgIdentity * *aSenderIdentity)
{
  NS_ENSURE_ARG_POINTER(aSenderIdentity); 
  
  *aSenderIdentity = m_senderIdentity;
  NS_ADDREF(*aSenderIdentity);
  return NS_OK;
}

NS_IMETHODIMP 
nsSmtpUrl::SetSenderIdentity(nsIMsgIdentity * aSenderIdentity) 
{
  NS_ENSURE_ARG_POINTER(aSenderIdentity);
  
  m_senderIdentity = aSenderIdentity;
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::SetPrompt(nsIPrompt *aNetPrompt)
{
    NS_ENSURE_ARG_POINTER(aNetPrompt);
    m_netPrompt = aNetPrompt;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::GetPrompt(nsIPrompt **aNetPrompt)
{
    NS_ENSURE_ARG_POINTER(aNetPrompt);
    if (!m_netPrompt) return NS_ERROR_NULL_POINTER;
    *aNetPrompt = m_netPrompt;
    NS_ADDREF(*aNetPrompt);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::SetAuthPrompt(nsIAuthPrompt *aNetAuthPrompt)
{
    NS_ENSURE_ARG_POINTER(aNetAuthPrompt);
    m_netAuthPrompt = aNetAuthPrompt;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::GetAuthPrompt(nsIAuthPrompt **aNetAuthPrompt)
{
    NS_ENSURE_ARG_POINTER(aNetAuthPrompt);
    if (!m_netAuthPrompt) return NS_ERROR_NULL_POINTER;
    *aNetAuthPrompt = m_netAuthPrompt;
    NS_ADDREF(*aNetAuthPrompt);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::SetNotificationCallbacks(nsIInterfaceRequestor* aCallbacks)
{
    NS_ENSURE_ARG_POINTER(aCallbacks);
    m_callbacks = aCallbacks;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::GetNotificationCallbacks(nsIInterfaceRequestor** aCallbacks)
{
    NS_ENSURE_ARG_POINTER(aCallbacks);
    if (!m_callbacks) return NS_ERROR_NULL_POINTER;
    *aCallbacks = m_callbacks;
    NS_ADDREF(*aCallbacks);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::SetSmtpServer(nsISmtpServer * aSmtpServer)
{
    NS_ENSURE_ARG_POINTER(aSmtpServer);
    m_smtpServer = aSmtpServer;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpUrl::GetSmtpServer(nsISmtpServer ** aSmtpServer)
{
    NS_ENSURE_ARG_POINTER(aSmtpServer);
    if (!m_smtpServer) return NS_ERROR_NULL_POINTER;
    *aSmtpServer = m_smtpServer;
    NS_ADDREF(*aSmtpServer);
    return NS_OK;
}
