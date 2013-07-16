/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMessengerBootstrap.h"
#include "nsCOMPtr.h"

#include "nsIMutableArray.h"
#include "nsIMsgFolder.h"
#include "nsIWindowWatcher.h"
#include "nsMsgUtils.h"
#include "nsISupportsPrimitives.h"
#include "nsIDOMWindow.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"

NS_IMPL_ISUPPORTS1(nsMessengerBootstrap, nsIMessengerWindowService)

nsMessengerBootstrap::nsMessengerBootstrap()
{
}

nsMessengerBootstrap::~nsMessengerBootstrap()
{
}

NS_IMETHODIMP nsMessengerBootstrap::OpenMessengerWindowWithUri(const char *windowType, const char * aFolderURI, nsMsgKey aMessageKey)
{
  bool standAloneMsgWindow = false;
  nsAutoCString chromeUrl("chrome://messenger/content/");
  if (windowType && !strcmp(windowType, "mail:messageWindow"))
  {
    chromeUrl.Append("messageWindow.xul");
    standAloneMsgWindow = true;
  }
  nsresult rv;
  nsCOMPtr<nsIMutableArray> argsArray(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // create scriptable versions of our strings that we can store in our nsISupportsArray....
  if (aFolderURI)
  {
    if (standAloneMsgWindow)
    {
      nsCOMPtr <nsIMsgFolder> folder;
      rv = GetExistingFolder(nsDependentCString(aFolderURI), getter_AddRefs(folder));
      NS_ENSURE_SUCCESS(rv, rv);
      nsAutoCString msgUri;
      folder->GetBaseMessageURI(msgUri);

      nsCOMPtr<nsISupportsCString> scriptableMsgURI (do_CreateInstance(NS_SUPPORTS_CSTRING_CONTRACTID));
      NS_ENSURE_TRUE(scriptableMsgURI, NS_ERROR_FAILURE);
      msgUri.Append('#');
      msgUri.AppendInt(aMessageKey, 10);
      scriptableMsgURI->SetData(msgUri);
      argsArray->AppendElement(scriptableMsgURI, false);
    }
    nsCOMPtr<nsISupportsCString> scriptableFolderURI (do_CreateInstance(NS_SUPPORTS_CSTRING_CONTRACTID));
    NS_ENSURE_TRUE(scriptableFolderURI, NS_ERROR_FAILURE);

    scriptableFolderURI->SetData(nsDependentCString(aFolderURI));
    argsArray->AppendElement(scriptableFolderURI, false);

    if (!standAloneMsgWindow)
    {
      nsCOMPtr<nsISupportsPRUint32> scriptableMessageKey (do_CreateInstance(NS_SUPPORTS_PRUINT32_CONTRACTID));
      NS_ENSURE_TRUE(scriptableMessageKey, NS_ERROR_FAILURE);
      scriptableMessageKey->SetData(aMessageKey);
      argsArray->AppendElement(scriptableMessageKey, false);
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
