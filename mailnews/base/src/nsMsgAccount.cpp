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


#include "prprf.h"
#include "plstr.h"
#include "prmem.h"
#include "nsISupportsObsolete.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsCRTGlue.h"
#include "nsCOMPtr.h"
#include "nsReadableUtils.h"
#include "nsIMsgFolderNotificationService.h"

#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsMsgBaseCID.h"
#include "nsMsgAccount.h"
#include "nsIMsgAccount.h"
#include "nsIMsgAccountManager.h"

NS_IMPL_ISUPPORTS1(nsMsgAccount, nsIMsgAccount)

nsMsgAccount::nsMsgAccount()
{
}

nsMsgAccount::~nsMsgAccount()
{
}

NS_IMETHODIMP
nsMsgAccount::Init()
{
  NS_ASSERTION(!m_identities, "don't call Init twice!");
  return m_identities ? NS_ERROR_FAILURE : createIdentities();
}

nsresult
nsMsgAccount::getPrefService()
{
  if (m_prefs)
    return NS_OK;

  nsresult rv;
  m_prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  return rv;
}

NS_IMETHODIMP
nsMsgAccount::GetIncomingServer(nsIMsgIncomingServer * *aIncomingServer)
{
  NS_ENSURE_ARG_POINTER(aIncomingServer);

  // create the incoming server lazily
  if (!m_incomingServer) {
    // ignore the error (and return null), but it's still bad so assert
    nsresult rv = createIncomingServer();
    NS_ASSERTION(NS_SUCCEEDED(rv), "couldn't lazily create the server\n");
  }

  NS_IF_ADDREF(*aIncomingServer = m_incomingServer);

  return NS_OK;
}

nsresult
nsMsgAccount::createIncomingServer()
{
  if (m_accountKey.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  // from here, load mail.account.myaccount.server
  // Load the incoming server
  //
  // ex) mail.account.myaccount.server = "myserver"

  nsresult rv = getPrefService();
  if (NS_FAILED(rv)) return rv;

  // get the "server" pref
  nsCAutoString serverKeyPref("mail.account.");
  serverKeyPref += m_accountKey;
  serverKeyPref += ".server";
  nsCString serverKey;
  rv = m_prefs->GetCharPref(serverKeyPref.get(), getter_Copies(serverKey));
  if (NS_FAILED(rv)) return rv;

  // get the server from the account manager
  nsCOMPtr<nsIMsgAccountManager> accountManager =
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = accountManager->GetIncomingServer(serverKey, getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  // store the server in this structure
  m_incomingServer = server;
  accountManager->NotifyServerLoaded(server);

  return NS_OK;
}


NS_IMETHODIMP
nsMsgAccount::SetIncomingServer(nsIMsgIncomingServer * aIncomingServer)
{
  nsCString key;
  nsresult rv = aIncomingServer->GetKey(key);

  if (NS_SUCCEEDED(rv)) {
    nsCAutoString serverPrefName("mail.account.");
    serverPrefName.Append(m_accountKey);
    serverPrefName.AppendLiteral(".server");
    m_prefs->SetCharPref(serverPrefName.get(), key.get());
  }

  m_incomingServer = aIncomingServer;

  PRBool serverValid;
  (void) aIncomingServer->GetValid(&serverValid);
  // only notify server loaded if server is valid so
  // account manager only gets told about finished accounts.
  if (serverValid)
  {
    // this is the point at which we can notify listeners about the
    // creation of the root folder, which implies creation of the new server.
    nsCOMPtr<nsIMsgFolder> rootFolder;
    rv = aIncomingServer->GetRootFolder(getter_AddRefs(rootFolder));
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsIFolderListener> mailSession =
             do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    mailSession->OnItemAdded(nsnull, rootFolder);
    nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    notifier->NotifyFolderAdded(rootFolder);

    nsCOMPtr<nsIMsgAccountManager> accountManager = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv))
      accountManager->NotifyServerLoaded(aIncomingServer);

    // Force built-in folders to be created and discovered. Then, notify listeners
    // about them.
    nsCOMPtr<nsISimpleEnumerator> enumerator;
    rv = rootFolder->GetSubFolders(getter_AddRefs(enumerator));
    NS_ENSURE_SUCCESS(rv, rv);

    PRBool hasMore;
    while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore)
    {
      nsCOMPtr<nsISupports> item;
      enumerator->GetNext(getter_AddRefs(item));

      nsCOMPtr<nsIMsgFolder> msgFolder(do_QueryInterface(item));
      if (!msgFolder)
        continue;
      mailSession->OnItemAdded(rootFolder, msgFolder);
      notifier->NotifyFolderAdded(msgFolder);
    }
  }
  return NS_OK;
}

/* nsISupportsArray GetIdentities (); */
NS_IMETHODIMP
nsMsgAccount::GetIdentities(nsISupportsArray **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  NS_ENSURE_TRUE(m_identities, NS_ERROR_FAILURE);

  NS_IF_ADDREF(*_retval = m_identities);
  return NS_OK;
}

/*
 * set up the m_identities array
 * do not call this more than once or we'll leak.
 */
nsresult
nsMsgAccount::createIdentities()
{
  NS_ENSURE_TRUE(!m_accountKey.IsEmpty(), NS_ERROR_NOT_INITIALIZED);
  if (m_identities)
    return NS_ERROR_FAILURE;

  NS_NewISupportsArray(getter_AddRefs(m_identities));

  // get the pref
  // ex) mail.account.myaccount.identities = "joe-home,joe-work"
  nsCAutoString identitiesKeyPref("mail.account.");
  identitiesKeyPref.Append(m_accountKey);
  identitiesKeyPref.Append(".identities");

  nsCString identityKey;
  nsresult rv;
  rv = getPrefService();
  NS_ENSURE_SUCCESS(rv, rv);

  m_prefs->GetCharPref(identitiesKeyPref.get(), getter_Copies(identityKey));
  if (identityKey.IsEmpty())    // not an error if no identities, but
    return NS_OK;               // strtok will be unhappy
  // get the server from the account manager
  nsCOMPtr<nsIMsgAccountManager> accountManager =
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  char* newStr = identityKey.BeginWriting();
  char* token = NS_strtok(",", &newStr);

  // temporaries used inside the loop
  nsCOMPtr<nsIMsgIdentity> identity;
  nsCAutoString key;

  // iterate through id1,id2, etc
  while (token) {
    key = token;
    key.StripWhitespace();

    // create the account
    rv = accountManager->GetIdentity(key, getter_AddRefs(identity));
    if (NS_SUCCEEDED(rv)) {
      // ignore error from addIdentityInternal() - if it fails, it fails.
      rv = addIdentityInternal(identity);
      NS_ASSERTION(NS_SUCCEEDED(rv), "Couldn't create identity");
    }

    // advance to next key, if any
    token = NS_strtok(",", &newStr);
  }

  return rv;
}


/* attribute nsIMsgIdentity defaultIdentity; */
NS_IMETHODIMP
nsMsgAccount::GetDefaultIdentity(nsIMsgIdentity **aDefaultIdentity)
{
  NS_ENSURE_ARG_POINTER(aDefaultIdentity);
  *aDefaultIdentity = nsnull;
  nsresult rv;
  
  if (!m_identities)
  {
    rv = Init();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  PRUint32 count;
  rv = m_identities->Count(&count);
  NS_ENSURE_SUCCESS(rv, rv);
  if (count == 0)
    return NS_OK;
  
  nsCOMPtr<nsIMsgIdentity> identity( do_QueryElementAt(m_identities, 0, &rv));
  identity.swap(*aDefaultIdentity);
  return rv;
}

// todo - make sure this is in the identity array!
NS_IMETHODIMP
nsMsgAccount::SetDefaultIdentity(nsIMsgIdentity * aDefaultIdentity)
{
  NS_ENSURE_TRUE(m_identities, NS_ERROR_FAILURE);

  NS_ASSERTION(m_identities->IndexOf(aDefaultIdentity) != -1, "Where did that identity come from?!");
  if (m_identities->IndexOf(aDefaultIdentity) == -1)
    return NS_ERROR_UNEXPECTED;

  m_defaultIdentity = aDefaultIdentity;
  return NS_OK;
}

// add the identity to m_identities, but don't fiddle with the
// prefs. The assumption here is that the pref for this identity is
// already set.
nsresult
nsMsgAccount::addIdentityInternal(nsIMsgIdentity *identity)
{
  NS_ENSURE_TRUE(m_identities, NS_ERROR_FAILURE);
  return m_identities->AppendElement(identity);
}

/* void addIdentity (in nsIMsgIdentity identity); */
NS_IMETHODIMP
nsMsgAccount::AddIdentity(nsIMsgIdentity *identity)
{
  // hack hack - need to add this to the list of identities.
  // for now just treat this as a Setxxx accessor
  // when this is actually implemented, don't refcount the default identity
  nsresult rv;

  nsCString key;
  rv = identity->GetKey(key);

  if (NS_SUCCEEDED(rv)) {

    nsCAutoString identitiesKeyPref("mail.account.");
    identitiesKeyPref.Append(m_accountKey);
    identitiesKeyPref.Append(".identities");

    nsCString identityList;
    m_prefs->GetCharPref(identitiesKeyPref.get(),
                         getter_Copies(identityList));

    nsCAutoString newIdentityList(identityList);

    nsCAutoString testKey;      // temporary to strip whitespace
    PRBool foundIdentity = PR_FALSE; // if the input identity is found

    if (!identityList.IsEmpty()) {
      char *newStr = identityList.BeginWriting();
      char *token = NS_strtok(",", &newStr);

      // look for the identity key that we're adding
      while (token) {
        testKey = token;
        testKey.StripWhitespace();

        if (testKey.Equals(key))
          foundIdentity = PR_TRUE;

        token = NS_strtok(",", &newStr);
      }
    }

    // if it didn't already exist, append it
    if (!foundIdentity) {
      if (newIdentityList.IsEmpty())
        newIdentityList = key;
      else {
        newIdentityList.Append(',');
        newIdentityList.Append(key);
      }
    }

    m_prefs->SetCharPref(identitiesKeyPref.get(), newIdentityList.get());
  }

  // now add it to the in-memory list
  rv = addIdentityInternal(identity);

  if (!m_defaultIdentity)
    SetDefaultIdentity(identity);

  return rv;
}

/* void removeIdentity (in nsIMsgIdentity identity); */
NS_IMETHODIMP
nsMsgAccount::RemoveIdentity(nsIMsgIdentity * aIdentity)
{
  NS_ENSURE_ARG_POINTER(aIdentity);
  NS_ENSURE_TRUE(m_identities, NS_ERROR_FAILURE);

  PRUint32 count =0;
  m_identities->Count(&count);

  NS_ENSURE_TRUE(count > 1, NS_ERROR_FAILURE); // you must have at least one identity

  nsCString key;
  nsresult rv = aIdentity->GetKey(key);

  // remove our identity
  m_identities->RemoveElement(aIdentity);
  count--;

  // clear out the actual pref values associated with the identity
  aIdentity->ClearAllValues();

  // if we just deleted the default identity, clear it out so we pick a new one
  if (m_defaultIdentity == aIdentity)
    m_defaultIdentity = nsnull;

  // now rebuild the identity pref
  nsCAutoString identitiesKeyPref("mail.account.");
  identitiesKeyPref.Append(m_accountKey);
  identitiesKeyPref.Append(".identities");

  nsCAutoString newIdentityList;

  // iterate over the remaining identities
  for (PRUint32 index = 0; index < count; index++)
  {
    nsCOMPtr<nsIMsgIdentity> identity = do_QueryElementAt(m_identities, index, &rv);
    if (identity)
    {
      identity->GetKey(key);

      if (!index)
        newIdentityList = key;
      else
      {
        newIdentityList.Append(',');
        newIdentityList.Append(key);
      }
    }
  }

  m_prefs->SetCharPref(identitiesKeyPref.get(), newIdentityList.get());

  return rv;
}

NS_IMETHODIMP nsMsgAccount::GetKey(nsACString& accountKey)
{
  accountKey = m_accountKey;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccount::SetKey(const nsACString& accountKey)
{
  // need the prefs service to do anything
  nsresult rv = getPrefService();
  NS_ENSURE_SUCCESS(rv, rv);
  m_accountKey = accountKey;
  return Init();
}

NS_IMETHODIMP
nsMsgAccount::ToString(nsAString& aResult)
{
  nsAutoString val;
  aResult.AssignLiteral("[nsIMsgAccount: ");
  aResult.Append(NS_ConvertASCIItoUTF16(m_accountKey));
  aResult.AppendLiteral("]");
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccount::ClearAllValues()
{
  nsresult rv;
  nsCAutoString rootPref("mail.account.");
  rootPref += m_accountKey;
  rootPref += '.';

  rv = getPrefService();
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 cntChild, i;
  char **childArray;

  rv = m_prefs->GetChildList(rootPref.get(), &cntChild, &childArray);
  if (NS_SUCCEEDED(rv)) 
  {
    for (i = 0; i < cntChild; i++)
      m_prefs->ClearUserPref(childArray[i]);
    NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(cntChild, childArray);
  }

  return rv;
}
