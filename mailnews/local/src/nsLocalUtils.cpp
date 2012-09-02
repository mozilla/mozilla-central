/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsLocalUtils.h"
#include "nsIServiceManager.h"
#include "prsystem.h"
#include "nsCOMPtr.h"
#include "prmem.h"
// stuff for temporary root folder hack
#include "nsIMsgAccountManager.h"
#include "nsIMsgIncomingServer.h"
#include "nsIPop3IncomingServer.h"
#include "nsINoIncomingServer.h"
#include "nsMsgBaseCID.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"

#include "nsMsgUtils.h"
#include "nsNetCID.h"

// it would be really cool to:
// - cache the last hostname->path match
// - if no such server exists, behave like an old-style mailbox URL
// (i.e. return the mail.directory preference or something)
static nsresult
nsGetMailboxServer(const char *uriStr, nsIMsgIncomingServer** aResult)
{
  nsresult rv = NS_OK;

  nsCOMPtr<nsIURL> aUrl = do_CreateInstance(NS_STANDARDURL_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  rv = aUrl->SetSpec(nsDependentCString(uriStr));  
  if (NS_FAILED(rv)) return rv;

  // retrieve the AccountManager
  nsCOMPtr<nsIMsgAccountManager> accountManager = 
    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;
  
  // find all local mail "no servers" matching the given hostname
  nsCOMPtr<nsIMsgIncomingServer> none_server;
  aUrl->SetScheme(NS_LITERAL_CSTRING("none"));
  // No unescaping of username or hostname done here.
  // The unescaping is done inside of FindServerByURI
  rv = accountManager->FindServerByURI(aUrl, false,
                                  getter_AddRefs(none_server));
  if (NS_SUCCEEDED(rv)) {
    NS_ADDREF(*aResult = none_server);
    return rv;
  }
  
  // if that fails, look for the rss hosts matching the given hostname
  nsCOMPtr<nsIMsgIncomingServer> rss_server;
  aUrl->SetScheme(NS_LITERAL_CSTRING("rss"));
  rv = accountManager->FindServerByURI(aUrl, false,
                                  getter_AddRefs(rss_server));
  if (NS_SUCCEEDED(rv))
  {
     NS_ADDREF(*aResult = rss_server);
     return rv;
  }
#ifdef HAVE_MOVEMAIL
  // find all movemail "servers" matching the given hostname
  nsCOMPtr<nsIMsgIncomingServer> movemail_server;
  aUrl->SetScheme(NS_LITERAL_CSTRING("movemail"));
  rv = accountManager->FindServerByURI(aUrl, false,
                                  getter_AddRefs(movemail_server));
  if (NS_SUCCEEDED(rv)) {
    NS_ADDREF(*aResult = movemail_server);
    return rv;
  }
#endif /* HAVE_MOVEMAIL */

  // if that fails, look for the pop hosts matching the given hostname
  nsCOMPtr<nsIMsgIncomingServer> server;
  if (NS_FAILED(rv)) 
  {
    aUrl->SetScheme(NS_LITERAL_CSTRING("pop3"));
    rv = accountManager->FindServerByURI(aUrl, false,
                                    getter_AddRefs(server));

    // if we can't find a pop server, maybe it's a local message 
    // in an imap hierarchy. look for an imap server.
    if (NS_FAILED(rv)) 
    {
      aUrl->SetScheme(NS_LITERAL_CSTRING("imap"));
      rv = accountManager->FindServerByURI(aUrl, false,
                                    getter_AddRefs(server));
    }
  }
  if (NS_SUCCEEDED(rv)) 
  {
    NS_ADDREF(*aResult = server);
    return rv;
  }

// if you fail after looking at all "pop3", "movemail" and "none" servers, you fail.
return rv;
}

static nsresult
nsLocalURI2Server(const char* uriStr,
                  nsIMsgIncomingServer ** aResult)
{
  nsresult rv;


  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = nsGetMailboxServer(uriStr, getter_AddRefs(server));

  NS_IF_ADDREF(*aResult = server);

  return rv;
}

// given rootURI and rootURI##folder, return on-disk path of folder
nsresult
nsLocalURI2Path(const char* rootURI, const char* uriStr,
                nsCString& pathResult)
{
  nsresult rv;

  // verify that rootURI starts with "mailbox:/" or "mailbox-message:/"
  if ((PL_strcmp(rootURI, kMailboxRootURI) != 0) && 
      (PL_strcmp(rootURI, kMailboxMessageRootURI) != 0)) {
    return NS_ERROR_FAILURE;
  }

  // verify that uristr starts with rooturi
  nsAutoCString uri(uriStr);
  if (uri.Find(rootURI) != 0)
    return NS_ERROR_FAILURE;


  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = nsLocalURI2Server(uriStr, getter_AddRefs(server));

  if (NS_FAILED(rv))
    return rv;

  // now ask the server what it's root is
  // and begin pathResult with the mailbox root
  nsCOMPtr<nsIFile> localPath;
  rv = server->GetLocalPath(getter_AddRefs(localPath));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString localNativePath;

  localPath->GetNativePath(localNativePath);
  nsEscapeNativePath(localNativePath);
  pathResult = localNativePath.get();
  const char *curPos = uriStr + PL_strlen(rootURI);
  if (curPos) {
    // advance past hostname
    while ((*curPos)=='/') curPos++;
    while (*curPos && (*curPos)!='/') curPos++;

    nsAutoCString newPath("");

    // Unescape folder name
    if (curPos) {
      nsCString unescapedStr;
      MsgUnescapeString(nsDependentCString(curPos), 0, unescapedStr);
      NS_MsgCreatePathStringFromFolderURI(unescapedStr.get(), newPath, NS_LITERAL_CSTRING("none"));
    } else
      NS_MsgCreatePathStringFromFolderURI(curPos, newPath, NS_LITERAL_CSTRING("none"));

    pathResult.Append('/');
    pathResult.Append(newPath);
  }

  return NS_OK;
}

/* parses LocalMessageURI
 * mailbox-message://folder1/folder2#123?header=none or
 * mailbox-message://folder1/folder2#1234&part=1.2
 *
 * puts folder URI in folderURI (mailbox://folder1/folder2)
 * message key number in key
 */
nsresult nsParseLocalMessageURI(const char* uri,
                                nsCString& folderURI,
                                uint32_t *key)
{
  if(!key)
    return NS_ERROR_NULL_POINTER;

  nsAutoCString uriStr(uri);
  int32_t keySeparator = uriStr.FindChar('#');
  if(keySeparator != -1)
  {
    int32_t keyEndSeparator = MsgFindCharInSet(uriStr, "?&", keySeparator);
    folderURI = StringHead(uriStr, keySeparator);
    folderURI.Cut(7, 8);    // cut out the -message part of mailbox-message:

    nsAutoCString keyStr;
    if (keyEndSeparator != -1)
      keyStr = Substring(uriStr, keySeparator + 1,
                         keyEndSeparator - (keySeparator + 1));
    else
      keyStr = StringTail(uriStr, uriStr.Length() - (keySeparator + 1));

    *key = (uint32_t) ParseUint64Str(keyStr.get());
    return NS_OK;
  }
  return NS_ERROR_FAILURE;

}

nsresult nsBuildLocalMessageURI(const char *baseURI, uint32_t key, nsCString& uri)
{
  
  // need to convert mailbox://hostname/.. to mailbox-message://hostname/..

  uri.Append(baseURI);
  uri.Append('#');
  uri.AppendInt(key);
  return NS_OK;
}

nsresult nsCreateLocalBaseMessageURI(const nsACString& baseURI, nsCString &baseMessageURI)
{
  nsAutoCString tailURI(baseURI);

  // chop off mailbox:/
  if (tailURI.Find(kMailboxRootURI) == 0)
    tailURI.Cut(0, PL_strlen(kMailboxRootURI));
  
  baseMessageURI = kMailboxMessageRootURI;
  baseMessageURI += tailURI;

  return NS_OK;
}

void nsEscapeNativePath(nsCString& nativePath)
{
#if defined(XP_WIN) || defined(XP_OS2)
  nativePath.Insert('/', 0);
  MsgReplaceChar(nativePath, '\\', '/');
#endif
}
