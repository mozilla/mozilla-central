/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#include "prprf.h"
#include "plstr.h"
#include "prmem.h"
#include "nsISupportsObsolete.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsCRTGlue.h"
#include "nsCOMPtr.h"
#include "nsIMsgFolderNotificationService.h"

#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsMsgBaseCID.h"
#include "nsMsgAccount.h"
#include "nsIMsgAccount.h"
#include "nsIMsgAccountManager.h"
#include "nsServiceManagerUtils.h"
#include "nsMemory.h"
#include "nsComponentManagerUtils.h"
#include "nsMsgUtils.h"

NS_IMPL_ISUPPORTS1(nsMsgAccount, nsIMsgAccount)

nsMsgAccount::nsMsgAccount()
  : mTriedToGetServer(false)
{
}

nsMsgAccount::~nsMsgAccount()
{
}

nsresult
nsMsgAccount::getPrefService()
{
  if (m_prefs)
    return NS_OK;

  nsresult rv;
  NS_ENSURE_FALSE(m_accountKey.IsEmpty(), NS_ERROR_NOT_INITIALIZED);
  nsCOMPtr<nsIPrefService> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString accountRoot("mail.account.");
  accountRoot.Append(m_accountKey);
  accountRoot.Append('.');
  return prefs->GetBranch(accountRoot.get(), getter_AddRefs(m_prefs));
}

NS_IMETHODIMP
nsMsgAccount::GetIncomingServer(nsIMsgIncomingServer **aIncomingServer)
{
  NS_ENSURE_ARG_POINTER(aIncomingServer);

  // create the incoming server lazily
  if (!mTriedToGetServer && !m_incomingServer) {
    mTriedToGetServer = true;
    // ignore the error (and return null), but it's still bad so warn
    nsresult rv = createIncomingServer();
    NS_WARN_IF_FALSE(NS_SUCCEEDED(rv), "couldn't lazily create the server\n");
  }

  NS_IF_ADDREF(*aIncomingServer = m_incomingServer);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccount::CreateServer()
{
  if (m_incomingServer)
    return NS_ERROR_ALREADY_INITIALIZED;
  return createIncomingServer();
}

nsresult
nsMsgAccount::createIncomingServer()
{
  // from here, load mail.account.myaccount.server
  // Load the incoming server
  //
  // ex) mail.account.myaccount.server = "myserver"

  nsresult rv = getPrefService();
  NS_ENSURE_SUCCESS(rv, rv);

  // get the "server" pref
  nsCString serverKey;
  rv = m_prefs->GetCharPref("server", getter_Copies(serverKey));
  NS_ENSURE_SUCCESS(rv, rv);

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
nsMsgAccount::SetIncomingServer(nsIMsgIncomingServer *aIncomingServer)
{
  NS_ENSURE_ARG_POINTER(aIncomingServer);

  nsCString key;
  nsresult rv = aIncomingServer->GetKey(key);

  if (NS_SUCCEEDED(rv)) {
    rv = getPrefService();
    NS_ENSURE_SUCCESS(rv, rv);
    m_prefs->SetCharPref("server", key.get());
  }

  m_incomingServer = aIncomingServer;

  bool serverValid;
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
    mailSession->OnItemAdded(nullptr, rootFolder);
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

    bool hasMore;
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
  NS_ENSURE_FALSE(m_identities, NS_ERROR_FAILURE);

  NS_NewISupportsArray(getter_AddRefs(m_identities));

  nsCString identityKey;
  nsresult rv;
  rv = getPrefService();
  NS_ENSURE_SUCCESS(rv, rv);

  m_prefs->GetCharPref("identities", getter_Copies(identityKey));
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
  nsAutoCString key;

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
  NS_ENSURE_TRUE(m_identities, NS_ERROR_NOT_INITIALIZED);

  *aDefaultIdentity = nullptr;
  uint32_t count;
  nsresult rv = m_identities->Count(&count);
  NS_ENSURE_SUCCESS(rv, rv);
  if (count == 0)
    return NS_OK;

  nsCOMPtr<nsIMsgIdentity> identity = do_QueryElementAt(m_identities, 0, &rv);
  identity.swap(*aDefaultIdentity);
  return rv;
}

NS_IMETHODIMP
nsMsgAccount::SetDefaultIdentity(nsIMsgIdentity *aDefaultIdentity)
{
  NS_ENSURE_TRUE(m_identities, NS_ERROR_FAILURE);

  PRInt32 position = m_identities->IndexOf(aDefaultIdentity);
  NS_ASSERTION(position != -1, "Where did that identity come from?!");
  NS_ENSURE_TRUE(position != -1, NS_ERROR_UNEXPECTED);

  // The passed in identity is in the list, so we have at least one element.
  m_identities->MoveElement(position, 0);

  return saveIdentitiesPref();
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
  NS_ENSURE_ARG_POINTER(identity);

  // hack hack - need to add this to the list of identities.
  // for now just treat this as a Setxxx accessor
  // when this is actually implemented, don't refcount the default identity
  nsCString key;
  nsresult rv = identity->GetKey(key);

  if (NS_SUCCEEDED(rv)) {
    nsCString identityList;
    m_prefs->GetCharPref("identities", getter_Copies(identityList));

    nsAutoCString newIdentityList(identityList);

    nsAutoCString testKey;      // temporary to strip whitespace
    bool foundIdentity = false; // if the input identity is found

    if (!identityList.IsEmpty()) {
      char *newStr = identityList.BeginWriting();
      char *token = NS_strtok(",", &newStr);

      // look for the identity key that we're adding
      while (token) {
        testKey = token;
        testKey.StripWhitespace();

        if (testKey.Equals(key))
          foundIdentity = true;

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

    m_prefs->SetCharPref("identities", newIdentityList.get());
  }

  // now add it to the in-memory list
  return addIdentityInternal(identity);
}

/* void removeIdentity (in nsIMsgIdentity identity); */
NS_IMETHODIMP
nsMsgAccount::RemoveIdentity(nsIMsgIdentity *aIdentity)
{
  NS_ENSURE_ARG_POINTER(aIdentity);
  NS_ENSURE_TRUE(m_identities, NS_ERROR_FAILURE);

  uint32_t count = 0;
  m_identities->Count(&count);
  // At least one identity must stay after the delete.
  NS_ENSURE_TRUE(count > 1, NS_ERROR_FAILURE);

  // remove our identity
  m_identities->RemoveElement(aIdentity);

  // clear out the actual pref values associated with the identity
  aIdentity->ClearAllValues();

  return saveIdentitiesPref();
}

nsresult
nsMsgAccount::saveIdentitiesPref()
{
  nsAutoCString newIdentityList;

  // Iterate over the existing identities and build the pref value,
  // a string of identity keys: id1, id2, idX...
  uint32_t count;
  nsresult rv = m_identities->Count(&count);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString key;
  for (uint32_t index = 0; index < count; index++)
  {
    nsCOMPtr<nsIMsgIdentity> identity = do_QueryElementAt(m_identities, index, &rv);
    if (identity)
    {
      identity->GetKey(key);

      if (!index) {
        newIdentityList = key;
      }
      else
      {
        newIdentityList.Append(',');
        newIdentityList.Append(key);
      }
    }
  }

  // Save the pref.
  m_prefs->SetCharPref("identities", newIdentityList.get());

  return NS_OK;
}

NS_IMETHODIMP nsMsgAccount::GetKey(nsACString& accountKey)
{
  accountKey = m_accountKey;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccount::SetKey(const nsACString& accountKey)
{
  m_accountKey = accountKey;
  m_prefs = nullptr;
  m_identities = nullptr;
  return createIdentities();
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
  nsresult rv = getPrefService();
  NS_ENSURE_SUCCESS(rv, rv);

  return m_prefs->DeleteBranch(nullptr);
}
