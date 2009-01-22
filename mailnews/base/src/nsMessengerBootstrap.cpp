/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alec Flett <alecf@netscape.com>
 *   Scott Putterman <putterman@netscape.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   David Bienvenu <bienvenu@nventure.com>
 *   Siddharth Agarwal <sid1337@gmail.com>
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

#include "nsMessengerBootstrap.h"
#include "nsCOMPtr.h"

#include "nsDOMCID.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgFolderCache.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIDOMWindow.h"
#include "nsXPCOM.h"
#include "nsISupportsPrimitives.h"
#include "nsIWindowWatcher.h"
#include "nsString.h"
#include "nsIURI.h"
#include "nsIDialogParamBlock.h"
#include "nsUnicharUtils.h"
#include "nsIMsgDatabase.h"
#include "nsICommandLine.h"
#include "nsILocalFile.h"
#include "nsNetUtil.h"
#include "nsIFileURL.h"
#include "nsNativeCharsetUtils.h"
#include "nsIRDFResource.h"
#include "nsIRDFService.h"
#include "nsIMsgHdr.h"
#include "nsMsgUtils.h"
#include "nsEscape.h"

NS_IMPL_THREADSAFE_ADDREF(nsMessengerBootstrap)
NS_IMPL_THREADSAFE_RELEASE(nsMessengerBootstrap)

NS_IMPL_QUERY_INTERFACE2(nsMessengerBootstrap,
                         nsICommandLineHandler,
                         nsIMessengerWindowService)

nsMessengerBootstrap::nsMessengerBootstrap()
{
}

nsMessengerBootstrap::~nsMessengerBootstrap()
{
}

NS_IMETHODIMP
nsMessengerBootstrap::Handle(nsICommandLine* aCmdLine)
{
  NS_ENSURE_ARG_POINTER(aCmdLine);
  nsresult rv;

  nsCOMPtr<nsIWindowWatcher> wwatch (do_GetService(NS_WINDOWWATCHER_CONTRACTID));
  NS_ENSURE_TRUE(wwatch, NS_ERROR_FAILURE);

  nsCOMPtr<nsIDOMWindow> opened;

#ifndef MOZ_SUITE
  PRBool found;
  rv = aCmdLine->HandleFlag(NS_LITERAL_STRING("options"), PR_FALSE, &found);
  if (NS_SUCCEEDED(rv) && found) {
    wwatch->OpenWindow(nsnull, "chrome://messenger/content/preferences/preferences.xul", "_blank",
                      "chrome,dialog=no,all", nsnull, getter_AddRefs(opened));
    aCmdLine->SetPreventDefault(PR_TRUE);
  }
#endif
  
  nsAutoString mailUrl; // -mail or -mail <some url> 
  PRBool flag = PR_FALSE;
  rv = aCmdLine->HandleFlagWithParam(NS_LITERAL_STRING("mail"), PR_FALSE, mailUrl);
  if (NS_SUCCEEDED(rv))
    flag = !mailUrl.IsVoid();
  else 
    aCmdLine->HandleFlag(NS_LITERAL_STRING("mail"), PR_FALSE, &flag);
  if (flag)
  {
    nsCOMPtr<nsISupportsArray> argsArray = do_CreateInstance(NS_SUPPORTSARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    // create scriptable versions of our strings that we can store in our nsISupportsArray....
    if (!mailUrl.IsEmpty())
    {
      nsCOMPtr<nsISupportsString> scriptableURL (do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID));
      NS_ENSURE_TRUE(scriptableURL, NS_ERROR_FAILURE);
      if (StringBeginsWith(mailUrl, NS_LITERAL_STRING("mailbox-message://")) ||
          StringBeginsWith(mailUrl, NS_LITERAL_STRING("imap-message://")) ||
          StringBeginsWith(mailUrl, NS_LITERAL_STRING("news-message://")))
      {
        nsCOMPtr <nsIMsgDBHdr> msgHdr;
        nsCAutoString nativeArg;
        NS_CopyUnicodeToNative(mailUrl, nativeArg);
        PRInt32 queryIndex = nativeArg.Find("?messageId=", PR_TRUE);
        if (queryIndex > 0)
        {
          nsCString messageId, folderUri;
          nativeArg.Right(messageId, nativeArg.Length() - queryIndex - 11);
          nativeArg.Left(folderUri, queryIndex);
          folderUri.Cut(folderUri.Find("-message"), 8);
          return OpenMessengerWindowForMessageId(folderUri, messageId);
        }
        else
          GetMsgDBHdrFromURI(nativeArg.get(), getter_AddRefs(msgHdr));

        if (msgHdr)
        {
          nsCOMPtr <nsIMsgFolder> folder;
          nsCString folderUri;
          nsMsgKey msgKey;
          msgHdr->GetMessageKey(&msgKey);
          msgHdr->GetFolder(getter_AddRefs(folder));
          if (folder)
          {
            folder->GetURI(folderUri);
            rv = DiscoverFoldersIfNeeded(folder);
            NS_ENSURE_SUCCESS(rv, rv);
            return OpenMessengerWindowWithUri("mail:messageWindow", folderUri.get(), msgKey);  
          }
        }
      }
      // check if it's a mail message url, and if so, convert it?
      scriptableURL->SetData((mailUrl));
      argsArray->AppendElement(scriptableURL);
    }

    wwatch->OpenWindow(nsnull, "chrome://messenger/content/", "_blank",
                       "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar,dialog=no", argsArray, getter_AddRefs(opened));
    aCmdLine->SetPreventDefault(PR_TRUE);
    return NS_OK;
  } 

#ifndef MOZ_SUITE
  PRInt32 numArgs;
  aCmdLine->GetLength(&numArgs);
  if (numArgs > 0)
  {
    nsAutoString arg;
    aCmdLine->GetArgument(0, arg);

#ifdef XP_MACOSX
    if (StringEndsWith(arg, NS_LITERAL_STRING(".mozeml"), nsCaseInsensitiveStringComparator()))
      HandleIndexerResult(arg);
#endif
#ifdef XP_WIN
    if (StringEndsWith(arg, NS_LITERAL_STRING(".wdseml"), nsCaseInsensitiveStringComparator()))
      HandleIndexerResult(arg);
#endif

    if (StringEndsWith(arg, NS_LITERAL_STRING(".eml"), nsCaseInsensitiveStringComparator()))
    {
      nsCOMPtr<nsILocalFile> file(do_CreateInstance("@mozilla.org/file/local;1"));
      NS_ENSURE_TRUE(file, NS_ERROR_FAILURE);
      rv = file->InitWithPath(arg);
      NS_ENSURE_SUCCESS(rv, rv);
      // should we check that the file exists, or looks like a mail message?

      nsCOMPtr<nsIURI> uri;
      NS_NewFileURI(getter_AddRefs(uri), file);
      nsCOMPtr<nsIFileURL> fileURL(do_QueryInterface(uri));
      NS_ENSURE_TRUE(fileURL, NS_ERROR_FAILURE);

      // create scriptable versions of our strings that we can store in our nsISupportsArray....
      nsCOMPtr<nsISupportsString> scriptableURL (do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID));
      NS_ENSURE_TRUE(scriptableURL, NS_ERROR_FAILURE);

      fileURL->SetQuery(NS_LITERAL_CSTRING("?type=application/x-message-display"));

      wwatch->OpenWindow(nsnull, "chrome://messenger/content/messageWindow.xul", "_blank",
                         "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar,dialog=no", fileURL, getter_AddRefs(opened));
      aCmdLine->SetPreventDefault(PR_TRUE);
    }
    return NS_OK;

  }
#endif
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerBootstrap::GetHelpInfo(nsACString& aResult)
{
  aResult.Assign(
    "  -mail                Open the mail folder view.\n"
#ifndef MOZ_SUITE
    "  -options             Open the options dialog.\n"
#endif
  );

  return NS_OK;
}
nsresult nsMessengerBootstrap::DiscoverFoldersIfNeeded(nsIMsgFolder *folder)
{
  nsCOMPtr <nsIMsgFolder> parent;
  folder->GetParent(getter_AddRefs(parent));
  // check if we've done folder discovery. If not,
  // do it so we'll have a real folder.
  if (!parent)
  {
    nsCOMPtr <nsIMsgIncomingServer> server;
    folder->GetServer(getter_AddRefs(server));
    nsresult rv = server->GetRootFolder(getter_AddRefs(parent));
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsISimpleEnumerator> enumerator;
    parent->GetSubFolders(getter_AddRefs(enumerator));
  }
  return NS_OK;
}

nsresult nsMessengerBootstrap::OpenMessengerWindowForMessageId(nsCString &folderUri, nsCString &messageId)
{
  nsresult rv;
  nsCOMPtr<nsIRDFService> rdf(do_GetService("@mozilla.org/rdf/rdf-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIRDFResource> res;
  rv = rdf->GetResource(folderUri, getter_AddRefs(res));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgFolder> containingFolder;
  containingFolder = do_QueryInterface(res, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = DiscoverFoldersIfNeeded(containingFolder);
  NS_ENSURE_SUCCESS(rv, rv);
  // once we have the folder uri, open the db and search for the message id.
  nsCOMPtr <nsIMsgDatabase> msgDB;
  containingFolder->GetMsgDatabase(getter_AddRefs(msgDB));
  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  if (msgDB)
    msgDB->GetMsgHdrForMessageID(messageId.get(), getter_AddRefs(msgHdr));
  if (msgHdr)
  {
    nsMsgKey msgKey;
    msgHdr->GetMessageKey(&msgKey);
    rv = OpenMessengerWindowWithUri("mail:messageWindow", folderUri.get(), msgKey);  
    return rv;
  }
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMessengerBootstrap::OpenMessengerWindowWithUri(const char *windowType, const char * aFolderURI, nsMsgKey aMessageKey)
{
  PRBool standAloneMsgWindow = PR_FALSE;
  nsCAutoString chromeUrl("chrome://messenger/content/");
  if (windowType && !strcmp(windowType, "mail:messageWindow"))
  {
    chromeUrl.Append("messageWindow.xul");
    standAloneMsgWindow = PR_TRUE;
  }
  nsCOMPtr<nsISupportsArray> argsArray;
  nsresult rv = NS_NewISupportsArray(getter_AddRefs(argsArray));
  NS_ENSURE_SUCCESS(rv, rv);

  // create scriptable versions of our strings that we can store in our nsISupportsArray....
  if (aFolderURI)
  {
    if (standAloneMsgWindow)
    {
      nsCOMPtr <nsIMsgFolder> folder;
      rv = GetExistingFolder(nsDependentCString(aFolderURI), getter_AddRefs(folder));
      NS_ENSURE_SUCCESS(rv, rv);
      nsCAutoString msgUri;
      folder->GetBaseMessageURI(msgUri);

      nsCOMPtr<nsISupportsCString> scriptableMsgURI (do_CreateInstance(NS_SUPPORTS_CSTRING_CONTRACTID));
      NS_ENSURE_TRUE(scriptableMsgURI, NS_ERROR_FAILURE);
      msgUri.Append('#');
      msgUri.AppendInt(aMessageKey, 10);
      scriptableMsgURI->SetData(msgUri);
      argsArray->AppendElement(scriptableMsgURI);
      
    }
    nsCOMPtr<nsISupportsCString> scriptableFolderURI (do_CreateInstance(NS_SUPPORTS_CSTRING_CONTRACTID));
    NS_ENSURE_TRUE(scriptableFolderURI, NS_ERROR_FAILURE);

    scriptableFolderURI->SetData(nsDependentCString(aFolderURI));
    argsArray->AppendElement(scriptableFolderURI);

    if (!standAloneMsgWindow)
    {
      nsCOMPtr<nsISupportsPRUint32> scriptableMessageKey (do_CreateInstance(NS_SUPPORTS_PRUINT32_CONTRACTID));
      NS_ENSURE_TRUE(scriptableMessageKey, NS_ERROR_FAILURE);
      scriptableMessageKey->SetData(aMessageKey);
      argsArray->AppendElement(scriptableMessageKey);
    }
  }
  
  nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // we need to use the "mailnews.reuse_thread_window2" pref
  // to determine if we should open a new window, or use an existing one.
  nsCOMPtr<nsIDOMWindow> newWindow;
  return wwatch->OpenWindow(0, chromeUrl.get(), "_blank",
                            "chrome,all,dialog=no", argsArray,
                             getter_AddRefs(newWindow));
}

nsresult
nsMessengerBootstrap::HandleIndexerResult(const nsString &aPath)
{
  nsresult rv;
  // parse file name - get path to containing folder, and message-id of message we're looking for
  // Then, open that message (in a 3-pane window?)
  PRInt32 mozmsgsIndex = aPath.Find(NS_LITERAL_STRING(".mozmsgs"));
  nsString folderPathStr;
  aPath.Left(folderPathStr, mozmsgsIndex);
  nsCOMPtr<nsILocalFile> folderPath;

#ifdef XP_MACOSX
  // We're going to have a native path file url:
  // file://<folder path>.mozmsgs/<message-id>.mozeml
  // need to convert to 8 bit chars...i.e., a local path.
  nsCString nativeArg;
  NS_CopyUnicodeToNative(folderPathStr, nativeArg);

  // Get the nsILocalFile for this file:// URI.
  rv = MsgGetLocalFileFromURI(nativeArg, getter_AddRefs(folderPath));
  NS_ENSURE_SUCCESS(rv, rv);
#endif
#ifdef XP_WIN
  // get the nsILocalFile for this path
  folderPath = do_CreateInstance("@mozilla.org/file/local;1");
  rv = folderPath->InitWithPath(folderPathStr);
  NS_ENSURE_SUCCESS(rv, rv);
#endif

  nsCString folderUri;
  rv = FolderUriFromDirInProfile(folderPath, folderUri);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString unicodeMessageId;
  // strip off .mozeml/.wdseml at the end as well
  aPath.Mid(unicodeMessageId, mozmsgsIndex + 9, aPath.Length() - (mozmsgsIndex + 9 + 7));
  nsCAutoString escapedMessageId;
  NS_CopyUnicodeToNative(unicodeMessageId, escapedMessageId);

  // unescape messageId
  nsCAutoString messageId;
  messageId = NS_UnescapeURL(escapedMessageId, esc_Minimal, messageId);

  return OpenMessengerWindowForMessageId(folderUri, messageId);
}
