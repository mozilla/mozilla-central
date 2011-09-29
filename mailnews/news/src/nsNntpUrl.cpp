/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Joshua Cranmer <Pidgeot18@gmail.com>
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

#include "msgCore.h"    // precompiled header...
#include "nsISupportsObsolete.h"

#include "nsIURL.h"
#include "nsNntpUrl.h"

#include "nsStringGlue.h"
#include "nsNewsUtils.h"
#include "nsMsgUtils.h"

#include "nntpCore.h"

#include "nsCOMPtr.h"
#include "nsIMsgDatabase.h"
#include "nsMsgDBCID.h"
#include "nsMsgNewsCID.h"
#include "nsIMsgFolder.h"
#include "nsIMsgNewsFolder.h"
#include "nsINntpService.h"
#include "nsIMsgMessageService.h"
#include "nsIMsgAccountManager.h"
#include "nsServiceManagerUtils.h"


nsNntpUrl::nsNntpUrl()
{
  m_newsgroupPost = nsnull;
  m_newsAction = nsINntpUrl::ActionUnknown;
  m_addDummyEnvelope = PR_FALSE;
  m_canonicalLineEnding = PR_FALSE;
  m_filePath = nsnull;
  m_getOldMessages = PR_FALSE;
  m_key = nsMsgKey_None;
}

nsNntpUrl::~nsNntpUrl()
{
}

NS_IMPL_ADDREF_INHERITED(nsNntpUrl, nsMsgMailNewsUrl)
NS_IMPL_RELEASE_INHERITED(nsNntpUrl, nsMsgMailNewsUrl)

NS_INTERFACE_MAP_BEGIN(nsNntpUrl)
   NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsINntpUrl)
   NS_INTERFACE_MAP_ENTRY(nsINntpUrl)
   NS_INTERFACE_MAP_ENTRY(nsIMsgMessageUrl)
   NS_INTERFACE_MAP_ENTRY(nsIMsgI18NUrl)
NS_INTERFACE_MAP_END_INHERITING(nsMsgMailNewsUrl)

////////////////////////////////////////////////////////////////////////////////
// Begin nsINntpUrl specific support
////////////////////////////////////////////////////////////////////////////////

/* News URI parsing explanation:
 * We support 3 different news URI schemes, essentially boiling down to 8
 * different formats:
 * news://host/group
 * news://host/message
 * news://host/
 * news:group
 * news:message
 * nntp://host/group
 * nntp://host/group/key
 * news-message://host/group#key
 *
 * In addition, we use queries on the news URIs with authorities for internal
 * NNTP processing. The most important one is ?group=group&key=key, for cache
 * canonicalization.
 */

NS_IMETHODIMP nsNntpUrl::SetSpec(const nsACString &aSpec)
{
  // For [s]news: URIs, we need to munge the spec if it is no authority, because
  // the URI parser guesses the wrong thing otherwise
  nsCString parseSpec(aSpec);
  PRInt32 colon = parseSpec.Find(":");

  // Our smallest scheme is 4 characters long, so colon must be at least 4
  if (colon < 4 || colon + 1 == (PRInt32) parseSpec.Length())
    return NS_ERROR_MALFORMED_URI;

  if (Substring(parseSpec, colon - 4, 4).EqualsLiteral("news") &&
      parseSpec[colon + 1] != '/')
  {
    // To make this parse properly, we add in three slashes, which convinces the
    // parser that the authority component is empty.
    parseSpec = Substring(aSpec, 0, colon + 1);
    parseSpec.AppendLiteral("///");
    parseSpec += Substring(aSpec, colon + 1);
  }

  nsresult rv = nsMsgMailNewsUrl::SetSpec(parseSpec);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCAutoString scheme;
  rv = GetScheme(scheme);
  NS_ENSURE_SUCCESS(rv, rv);

  if (scheme.EqualsLiteral("news") || scheme.EqualsLiteral("snews"))
    rv = ParseNewsURL();
  else if (scheme.EqualsLiteral("nntp") || scheme.EqualsLiteral("nntps"))
    rv = ParseNntpURL();
  else if (scheme.EqualsLiteral("news-message"))
  {
    nsCAutoString spec;
    GetSpec(spec);
    rv = nsParseNewsMessageURI(spec.get(), m_group, &m_key);
    NS_ENSURE_SUCCESS(rv, NS_ERROR_MALFORMED_URI);
  }
  else
    return NS_ERROR_MALFORMED_URI;
  NS_ENSURE_SUCCESS(rv, rv);

  rv = DetermineNewsAction();
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

nsresult nsNntpUrl::ParseNewsURL()
{
  // The path here is the group/msgid portion
  nsCAutoString path;
  nsresult rv = GetFilePath(path);
  NS_ENSURE_SUCCESS(rv, rv);

  // Drop the potential beginning from the path
  if (path.Length() && path[0] == '/')
    path = Substring(path, 1);

  // The presence of an `@' is a sign we have a msgid
  if (path.Find("@") != -1 || path.Find("%40") != -1)
  {
    MsgUnescapeString(path, 0, m_messageID);

    // Set group, key for ?group=foo&key=123 uris
    nsCAutoString spec;
    GetSpec(spec);
    PRInt32 groupPos = spec.Find(kNewsURIGroupQuery); // find ?group=
    PRInt32 keyPos   = spec.Find(kNewsURIKeyQuery);   // find &key=
    if (groupPos != kNotFound && keyPos != kNotFound)
    {
      // get group name and message key
      m_group = Substring(spec, groupPos + kNewsURIGroupQueryLen,
                          keyPos - groupPos - kNewsURIGroupQueryLen);
      nsCString keyStr(Substring(spec, keyPos + kNewsURIKeyQueryLen));
      m_key = keyStr.ToInteger(&rv, 10);
      NS_ENSURE_SUCCESS(rv, NS_ERROR_MALFORMED_URI);
    }
  }
  else
    MsgUnescapeString(path, 0, m_group);

  return NS_OK;
}

nsresult nsNntpUrl::ParseNntpURL()
{
  nsCAutoString path;
  nsresult rv = GetFilePath(path);
  NS_ENSURE_SUCCESS(rv, rv);

  if (path.Length() > 0 && path[0] == '/')
    path = Substring(path, 1);

  if (path.IsEmpty())
    return NS_ERROR_MALFORMED_URI;

  PRInt32 slash = path.FindChar('/');
  if (slash == -1)
  {
    m_group = path;
    m_key = nsMsgKey_None;
  }
  else
  {
    m_group = Substring(path, 0, slash);
    nsCAutoString keyStr;
    keyStr = Substring(path, slash + 1);
    m_key = keyStr.ToInteger(&rv, 10);
    NS_ENSURE_SUCCESS(rv, NS_ERROR_MALFORMED_URI);

    // Keys must be at least one
    if (m_key == 0)
      return NS_ERROR_MALFORMED_URI;
  }

  return NS_OK;
}

nsresult nsNntpUrl::DetermineNewsAction()
{
  nsCAutoString path;
  nsresult rv = nsMsgMailNewsUrl::GetPath(path);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCAutoString query;
  rv = GetQuery(query);
  NS_ENSURE_SUCCESS(rv, rv);

  if (query.EqualsLiteral("cancel"))
  {
    m_newsAction = nsINntpUrl::ActionCancelArticle;
    return NS_OK;
  }
  if (query.EqualsLiteral("list-ids"))
  {
    m_newsAction = nsINntpUrl::ActionListIds;
    return NS_OK;
  }
  if (query.EqualsLiteral("newgroups"))
  {
    m_newsAction = nsINntpUrl::ActionListNewGroups;
    return NS_OK;
  }
  if (StringBeginsWith(query, NS_LITERAL_CSTRING("search")))
  {
    m_newsAction = nsINntpUrl::ActionSearch;
    return NS_OK;
  }
  if (StringBeginsWith(query, NS_LITERAL_CSTRING("part=")) ||
      query.Find("&part=") > 0)
  {
    // news://news.mozilla.org:119/3B98D201.3020100%40cs.com?part=1
    // news://news.mozilla.org:119/b58dme%24aia2%40ripley.netscape.com?header=print&part=1.2&type=image/jpeg&filename=Pole.jpg
    m_newsAction = nsINntpUrl::ActionFetchPart;
    return NS_OK;
  }

  if (!m_messageID.IsEmpty() || m_key != nsMsgKey_None)
  {
    m_newsAction = nsINntpUrl::ActionFetchArticle;
    return NS_OK;
  }

  if (m_group.Find("*") >= 0)
  {
    // If the group is a wildmat, list groups instead of grabbing a group.
    m_newsAction = nsINntpUrl::ActionListGroups;
    return NS_OK;
  }
  if (!m_group.IsEmpty())
  {
    m_newsAction = nsINntpUrl::ActionGetNewNews;
    return NS_OK;
  }

  // At this point, we have a URI that contains neither a query, a group, nor a
  // message ID. Ergo, we don't know what it is.
  m_newsAction = nsINntpUrl::ActionUnknown;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::SetGetOldMessages(bool aGetOldMessages)
{
  m_getOldMessages = aGetOldMessages;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::GetGetOldMessages(bool * aGetOldMessages)
{
  NS_ENSURE_ARG(aGetOldMessages);
  *aGetOldMessages = m_getOldMessages;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::GetNewsAction(nsNewsAction *aNewsAction)
{
  if (aNewsAction)
    *aNewsAction = m_newsAction;
  return NS_OK;
}


NS_IMETHODIMP nsNntpUrl::SetNewsAction(nsNewsAction aNewsAction)
{
  m_newsAction = aNewsAction;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::GetGroup(nsACString &group)
{
  group = m_group;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::GetMessageID(nsACString &messageID)
{
  messageID = m_messageID;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::GetKey(PRUint32 *key)
{
  NS_ENSURE_ARG_POINTER(key);
  *key = m_key;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::SetUri(const char * aURI)
{
  mURI = aURI;
  return NS_OK;
}

// from nsIMsgMessageUrl
NS_IMETHODIMP nsNntpUrl::GetUri(char ** aURI)
{
  nsresult rv = NS_OK;

  // if we have been given a uri to associate with this url, then use it
  // otherwise try to reconstruct a URI on the fly....
  if (mURI.IsEmpty()) {
    nsCAutoString spec;
    rv = GetSpec(spec);
    NS_ENSURE_SUCCESS(rv,rv);
    mURI = spec;
  }

  *aURI = ToNewCString(mURI);
  if (!*aURI) return NS_ERROR_OUT_OF_MEMORY;
  return rv;
}


NS_IMPL_GETSET(nsNntpUrl, AddDummyEnvelope, bool, m_addDummyEnvelope)
NS_IMPL_GETSET(nsNntpUrl, CanonicalLineEnding, bool, m_canonicalLineEnding)

NS_IMETHODIMP nsNntpUrl::SetMessageFile(nsIFile * aFile)
{
  m_messageFile = aFile;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::GetMessageFile(nsIFile ** aFile)
{
  if (aFile)
    NS_IF_ADDREF(*aFile = m_messageFile);
  return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////
// End nsINntpUrl specific support
////////////////////////////////////////////////////////////////////////////////

nsresult nsNntpUrl::SetMessageToPost(nsINNTPNewsgroupPost *post)
{
  m_newsgroupPost = post;
  if (post)
    SetNewsAction(nsINntpUrl::ActionPostArticle);
  return NS_OK;
}

nsresult nsNntpUrl::GetMessageToPost(nsINNTPNewsgroupPost **aPost)
{
  NS_ENSURE_ARG_POINTER(aPost);
  NS_IF_ADDREF(*aPost = m_newsgroupPost);
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::GetMessageHeader(nsIMsgDBHdr ** aMsgHdr)
{
  nsresult rv;

  nsCOMPtr <nsINntpService> nntpService = do_GetService(NS_NNTPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIMsgMessageService> msgService = do_QueryInterface(nntpService, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCAutoString spec(mOriginalSpec);
  if (spec.IsEmpty())
    // Handle the case where necko directly runs an internal news:// URL,
    // one that looks like news://host/message-id?group=mozilla.announce&key=15
    // Other sorts of URLs -- e.g. news://host/message-id -- will not succeed.
    GetSpec(spec);

  return msgService->MessageURIToMsgHdr(spec.get(), aMsgHdr);
}

NS_IMETHODIMP nsNntpUrl::IsUrlType(PRUint32 type, bool *isType)
{
  NS_ENSURE_ARG(isType);

  switch(type)
  {
    case nsIMsgMailNewsUrl::eDisplay:
      *isType = (m_newsAction == nsINntpUrl::ActionFetchArticle);
      break;
    default:
      *isType = PR_FALSE;
  };

  return NS_OK;

}

NS_IMETHODIMP
nsNntpUrl::GetOriginalSpec(char **aSpec)
{
    NS_ENSURE_ARG_POINTER(aSpec);
    *aSpec = ToNewCString(mOriginalSpec);
    if (!*aSpec) return NS_ERROR_OUT_OF_MEMORY;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpUrl::SetOriginalSpec(const char *aSpec)
{
    mOriginalSpec = aSpec;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpUrl::GetServer(nsIMsgIncomingServer **aServer)
{
  NS_ENSURE_ARG_POINTER(aServer);
  
  nsresult rv;
  nsCAutoString scheme, user, host;

  GetScheme(scheme);
  GetUsername(user);
  GetHost(host);

  // No authority -> no server
  if (host.IsEmpty())
  {
    *aServer = nsnull;
    return NS_OK;
  }

  // Looking up the server...
  // news-message is used purely internally, so it can never refer to the real
  // attribute. nntp is never used internally, so it probably refers to the real
  // one. news is used both internally and externally, so it could refer to
  // either one. We'll assume it's an internal one first, though.
  bool isNews = scheme.EqualsLiteral("news") || scheme.EqualsLiteral("snews");
  bool isNntp = scheme.EqualsLiteral("nntp") || scheme.EqualsLiteral("nntps");
  
  bool tryReal = isNntp;

  nsCOMPtr<nsIMsgAccountManager> accountManager = 
    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Ignoring return results: it is perfectly acceptable for the server to not
  // exist, but FindServer (and not FindRealServer) throws NS_ERROR_UNEXPECTED
  // in this case.
  *aServer = nsnull;
  if (tryReal)
    accountManager->FindRealServer(user, host, NS_LITERAL_CSTRING("nntp"), 0,
      aServer);
  else
    accountManager->FindServer(user, host, NS_LITERAL_CSTRING("nntp"), aServer);
  if (!*aServer && (isNews || isNntp))
  {
    // Didn't find it, try the other option
    if (tryReal)
      accountManager->FindServer(user, host, NS_LITERAL_CSTRING("nntp"),
        aServer);
    else
      accountManager->FindRealServer(user, host, NS_LITERAL_CSTRING("nntp"), 0,
        aServer);
  }
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::GetFolder(nsIMsgFolder **msgFolder)
{
  NS_ENSURE_ARG_POINTER(msgFolder);

  nsresult rv;

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  // Need a server and a group to get the folder
  if (!server || m_group.IsEmpty())
  {
    *msgFolder = nsnull;
    return NS_OK;
  }

  // Find the group on the server
  nsCOMPtr<nsINntpIncomingServer> nntpServer = do_QueryInterface(server, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasGroup = false;
  rv = nntpServer->ContainsNewsgroup(m_group, &hasGroup);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!hasGroup)
  {
    *msgFolder = nsnull;
    return NS_OK;
  }

  nsCOMPtr<nsIMsgNewsFolder> newsFolder;
  rv = nntpServer->FindGroup(m_group, getter_AddRefs(newsFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  return newsFolder->QueryInterface(NS_GET_IID(nsIMsgFolder), (void**)msgFolder);
}

NS_IMETHODIMP
nsNntpUrl::GetFolderCharset(char **aCharacterSet)
{
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = GetFolder(getter_AddRefs(folder));
  // don't assert here.  this can happen if there is no message folder
  // like when we display a news://host/message-id url
  if (NS_FAILED(rv) || !folder)
    return rv;
  nsCString tmpStr;
  rv = folder->GetCharset(tmpStr);
  *aCharacterSet = ToNewCString(tmpStr);
  return rv;
}

NS_IMETHODIMP nsNntpUrl::GetFolderCharsetOverride(bool * aCharacterSetOverride)
{
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv,rv);
  NS_ENSURE_TRUE(folder, NS_ERROR_FAILURE);
  rv = folder->GetCharsetOverride(aCharacterSetOverride);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

NS_IMETHODIMP nsNntpUrl::GetCharsetOverRide(char ** aCharacterSet)
{
  if (!mCharsetOverride.IsEmpty())
    *aCharacterSet = ToNewCString(mCharsetOverride);
  else
    *aCharacterSet = nsnull;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::SetCharsetOverRide(const char * aCharacterSet)
{
  mCharsetOverride = aCharacterSet;
  return NS_OK;
}

NS_IMETHODIMP nsNntpUrl::Clone(nsIURI **_retval)
{
  nsresult rv;
  rv = nsMsgMailNewsUrl::Clone(_retval);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgMessageUrl> newsurl = do_QueryInterface(*_retval, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return newsurl->SetUri(mURI.get());
}

