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
 *   Magnus Melin <mkmelin+mozilla@iki.fi>
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

#include "nsISupportsArray.h"
#include "nsIMsgFolder.h"
#include "nsIWindowWatcher.h"
#include "nsMsgUtils.h"
#include "nsISupportsPrimitives.h"
#include "nsIDOMWindow.h"

NS_IMPL_THREADSAFE_ADDREF(nsMessengerBootstrap)
NS_IMPL_THREADSAFE_RELEASE(nsMessengerBootstrap)

NS_IMPL_QUERY_INTERFACE1(nsMessengerBootstrap, nsIMessengerWindowService)

nsMessengerBootstrap::nsMessengerBootstrap()
{
}

nsMessengerBootstrap::~nsMessengerBootstrap()
{
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
