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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   David Bienvenu <bienvenu@nventure.com>
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

#include "nsMsgIncomingServer.h"
#include "nscore.h"
#include "plstr.h"
#include "prmem.h"
#include "prprf.h"

#include "nsIServiceManager.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsISupportsObsolete.h"
#include "nsISupportsPrimitives.h"

#include "nsMsgBaseCID.h"
#include "nsMsgDBCID.h"
#include "nsIMsgFolder.h"
#include "nsIMsgFolderCache.h"
#include "nsIMsgFolderCacheElement.h"
#include "nsIMsgWindow.h"
#include "nsIMsgFilterService.h"
#include "nsIMsgProtocolInfo.h"
#include "nsIMsgMailSession.h"
#include "nsIPrefService.h"
#include "nsIRelativeFilePref.h"
#include "nsIDocShell.h"
#include "nsIAuthPrompt.h"
#include "nsIObserverService.h"
#include "nsNetUtil.h"
#include "nsIWindowWatcher.h"
#include "nsIStringBundle.h"
#include "nsIMsgHdr.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"

#include "nsIMsgAccountManager.h"
#include "nsCPasswordManager.h"
#include "nsIMsgMdnGenerator.h"
#include "nsMsgFolderFlags.h"
#include "nsMsgUtils.h"
#include "nsAppDirectoryServiceDefs.h"

#define PORT_NOT_SET -1

nsMsgIncomingServer::nsMsgIncomingServer():
    m_rootFolder(0),
    m_numMsgsDownloaded(0),
    m_biffState(nsIMsgFolder::nsMsgBiffState_Unknown),
    m_serverBusy(PR_FALSE),
    m_canHaveFilters(PR_TRUE),
    m_displayStartupPage(PR_TRUE),
    mPerformingBiff(PR_FALSE)
{ 
  m_downloadedHdrs.Init(50);
}

nsMsgIncomingServer::~nsMsgIncomingServer()
{
}

NS_IMPL_THREADSAFE_ADDREF(nsMsgIncomingServer)
NS_IMPL_THREADSAFE_RELEASE(nsMsgIncomingServer)
NS_INTERFACE_MAP_BEGIN(nsMsgIncomingServer)
    NS_INTERFACE_MAP_ENTRY(nsIMsgIncomingServer)
    NS_INTERFACE_MAP_ENTRY(nsISupportsWeakReference)
    NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMsgIncomingServer)
NS_INTERFACE_MAP_END_THREADSAFE

NS_IMETHODIMP
nsMsgIncomingServer::SetServerBusy(PRBool aServerBusy)
{
  m_serverBusy = aServerBusy;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetServerBusy(PRBool * aServerBusy)
{
  NS_ENSURE_ARG_POINTER(aServerBusy);
  *aServerBusy = m_serverBusy;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetKey(nsACString& serverKey)
{
  serverKey = m_serverKey;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetKey(const nsACString& serverKey)
{
  m_serverKey.Assign(serverKey);

  // in order to actually make use of the key, we need the prefs
  nsresult rv;
  nsCOMPtr<nsIPrefService> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString branchName;
  branchName.AssignLiteral("mail.server.");
  branchName.Append(m_serverKey);
  branchName.Append('.');
  rv = prefs->GetBranch(branchName.get(), getter_AddRefs(mPrefBranch));
  NS_ENSURE_SUCCESS(rv, rv);

  return prefs->GetBranch("mail.server.default.", getter_AddRefs(mDefPrefBranch));
}

NS_IMETHODIMP
nsMsgIncomingServer::SetRootFolder(nsIMsgFolder * aRootFolder)
{
  m_rootFolder = aRootFolder;
  return NS_OK;
}

// this will return the root folder of this account,
// even if this server is deferred.
NS_IMETHODIMP
nsMsgIncomingServer::GetRootFolder(nsIMsgFolder * *aRootFolder)
{
  NS_ENSURE_ARG_POINTER(aRootFolder);
  if (!m_rootFolder)
  {
    nsresult rv = CreateRootFolder();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  NS_IF_ADDREF(*aRootFolder = m_rootFolder);
  return NS_OK;
}

// this will return the root folder of the deferred to account,
// if this server is deferred.
NS_IMETHODIMP
nsMsgIncomingServer::GetRootMsgFolder(nsIMsgFolder **aRootMsgFolder)
{
  return GetRootFolder(aRootMsgFolder);
}

NS_IMETHODIMP
nsMsgIncomingServer::PerformExpand(nsIMsgWindow *aMsgWindow)
{
  return NS_OK;
}


NS_IMETHODIMP
nsMsgIncomingServer::VerifyLogon(nsIUrlListener *aUrlListener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMsgIncomingServer::PerformBiff(nsIMsgWindow* aMsgWindow)
{
  //This has to be implemented in the derived class, but in case someone doesn't implement it
  //just return not implemented.
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetNewMessages(nsIMsgFolder *aFolder, nsIMsgWindow *aMsgWindow,
                      nsIUrlListener *aUrlListener)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  return aFolder->GetNewMessages(aMsgWindow, aUrlListener);
}

NS_IMETHODIMP nsMsgIncomingServer::GetPerformingBiff(PRBool *aPerformingBiff)
{
  NS_ENSURE_ARG_POINTER(aPerformingBiff);
  *aPerformingBiff = mPerformingBiff;
  return NS_OK;
}

NS_IMETHODIMP nsMsgIncomingServer::SetPerformingBiff(PRBool aPerformingBiff)
{
  mPerformingBiff = aPerformingBiff;
  return NS_OK;
}

NS_IMPL_GETSET(nsMsgIncomingServer, BiffState, PRUint32, m_biffState)

NS_IMETHODIMP nsMsgIncomingServer::WriteToFolderCache(nsIMsgFolderCache *folderCache)
{
  nsresult rv = NS_OK;
  if (m_rootFolder)
  {
    nsCOMPtr <nsIMsgFolder> msgFolder = do_QueryInterface(m_rootFolder, &rv);
    if (NS_SUCCEEDED(rv) && msgFolder)
      rv = msgFolder->WriteToFolderCache(folderCache, PR_TRUE /* deep */);
  }
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::Shutdown()
{
  nsresult rv = CloseCachedConnections();
  mFilterPlugin = nsnull;
  NS_ENSURE_SUCCESS(rv,rv);

  if (mFilterList)
  {
    // close the filter log stream
    rv = mFilterList->SetLogStream(nsnull);
    NS_ENSURE_SUCCESS(rv,rv);
    mFilterList = nsnull;
  }

  if (mSpamSettings)
  {
    // close the spam log stream
    rv = mSpamSettings->SetLogStream(nsnull);
    NS_ENSURE_SUCCESS(rv,rv);
    mSpamSettings = nsnull;
  }
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::CloseCachedConnections()
{
  // derived class should override if they cache connections.
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetDownloadMessagesAtStartup(PRBool *getMessagesAtStartup)
{
  // derived class should override if they need to do this.
  *getMessagesAtStartup = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetCanHaveFilters(PRBool *canHaveFilters)
{
  // derived class should override if they need to do this.
  *canHaveFilters = m_canHaveFilters;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetCanBeDefaultServer(PRBool *canBeDefaultServer)
{
  // derived class should override if they need to do this.
  *canBeDefaultServer = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetCanSearchMessages(PRBool *canSearchMessages)
{
  // derived class should override if they need to do this.
  NS_ENSURE_ARG_POINTER(canSearchMessages);
  *canSearchMessages = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetCanCompactFoldersOnServer(PRBool *canCompactFoldersOnServer)
{
  // derived class should override if they need to do this.
  NS_ENSURE_ARG_POINTER(canCompactFoldersOnServer);
  *canCompactFoldersOnServer = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetCanUndoDeleteOnServer(PRBool *canUndoDeleteOnServer)
{
  // derived class should override if they need to do this.
  NS_ENSURE_ARG_POINTER(canUndoDeleteOnServer);
  *canUndoDeleteOnServer = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetCanEmptyTrashOnExit(PRBool *canEmptyTrashOnExit)
{
  // derived class should override if they need to do this.
  NS_ENSURE_ARG_POINTER(canEmptyTrashOnExit);
  *canEmptyTrashOnExit = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetIsSecureServer(PRBool *isSecureServer)
{
  // derived class should override if they need to do this.
  NS_ENSURE_ARG_POINTER(isSecureServer);
  *isSecureServer = PR_TRUE;
  return NS_OK;
}

// construct <localStoreType>://[<username>@]<hostname
NS_IMETHODIMP
nsMsgIncomingServer::GetServerURI(nsACString& aResult)
{
  nsresult rv;
  rv = GetLocalStoreType(aResult);
  NS_ENSURE_SUCCESS(rv, rv);
  aResult.AppendLiteral("://");

  nsCString username;
  rv = GetUsername(username);
  if (NS_SUCCEEDED(rv) && !username.IsEmpty()) {
      nsCString escapedUsername;
      MsgEscapeString(username, nsINetUtil::ESCAPE_XALPHAS, escapedUsername);
      // not all servers have a username
      aResult.Append(escapedUsername);
      aResult.Append('@');
  }

  nsCString hostname;
  rv = GetHostName(hostname);
  if (NS_SUCCEEDED(rv) && !hostname.IsEmpty()) {
      nsCString escapedHostname;
      MsgEscapeString(hostname, nsINetUtil::ESCAPE_URL_PATH, escapedHostname);
      // not all servers have a hostname
      aResult.Append(escapedHostname);
  }
  return NS_OK;
}

// helper routine to create local folder on disk, if it doesn't exist.
// Path must already have a LeafName for this to work...
nsresult
nsMsgIncomingServer::CreateLocalFolder(nsIFile *path, const nsACString& folderName)
{
  (void) path->SetNativeLeafName(folderName);
  PRBool exists;
  nsresult rv = path->Exists(&exists);
  NS_ENSURE_SUCCESS(rv, rv);
  if (!exists)
    rv = path->Create(nsIFile::NORMAL_FILE_TYPE, 0644);
  return rv;
}

nsresult
nsMsgIncomingServer::CreateRootFolder()
{
  nsresult rv;
  // get the URI from the incoming server
  nsCString serverUri;
  rv = GetServerURI(serverUri);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // get the corresponding RDF resource
  // RDF will create the server resource if it doesn't already exist
  nsCOMPtr<nsIRDFResource> serverResource;
  rv = rdf->GetResource(serverUri, getter_AddRefs(serverResource));
  NS_ENSURE_SUCCESS(rv, rv);

  // make incoming server know about its root server folder so we
  // can find sub-folders given an incoming server.
  m_rootFolder = do_QueryInterface(serverResource, &rv);
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetBoolValue(const char *prefname,
                                 PRBool *val)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  NS_ENSURE_ARG_POINTER(val);
  *val = PR_FALSE;

  if (NS_FAILED(mPrefBranch->GetBoolPref(prefname, val)))
    mDefPrefBranch->GetBoolPref(prefname, val);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetBoolValue(const char *prefname,
                                 PRBool val)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  PRBool defaultValue;
  nsresult rv = mDefPrefBranch->GetBoolPref(prefname, &defaultValue);

  if (NS_SUCCEEDED(rv) && val == defaultValue)
    mPrefBranch->ClearUserPref(prefname);
  else
    rv = mPrefBranch->SetBoolPref(prefname, val);

  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetIntValue(const char *prefname,
                                PRInt32 *val)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  NS_ENSURE_ARG_POINTER(val);
  *val = 0;

  if (NS_FAILED(mPrefBranch->GetIntPref(prefname, val)))
    mDefPrefBranch->GetIntPref(prefname, val);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetFileValue(const char* aRelPrefName,
                                  const char* aAbsPrefName,
                                  nsILocalFile** aLocalFile)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  // Get the relative first
  nsCOMPtr<nsIRelativeFilePref> relFilePref;
  nsresult rv = mPrefBranch->GetComplexValue(aRelPrefName,
                                             NS_GET_IID(nsIRelativeFilePref),
                                             getter_AddRefs(relFilePref));
  if (relFilePref) {
    rv = relFilePref->GetFile(aLocalFile);
    NS_ASSERTION(*aLocalFile, "An nsIRelativeFilePref has no file.");
  } else {
    rv = mPrefBranch->GetComplexValue(aAbsPrefName,
                                      NS_GET_IID(nsILocalFile),
                                      reinterpret_cast<void**>(aLocalFile));
    if (NS_FAILED(rv))
      return rv;

    rv = NS_NewRelativeFilePref(*aLocalFile,
                                NS_LITERAL_CSTRING(NS_APP_USER_PROFILE_50_DIR),
                                getter_AddRefs(relFilePref));
    if (relFilePref)
      rv = mPrefBranch->SetComplexValue(aRelPrefName,
                                        NS_GET_IID(nsIRelativeFilePref),
                                        relFilePref);
  }

  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetFileValue(const char* aRelPrefName,
                                  const char* aAbsPrefName,
                                  nsILocalFile* aLocalFile)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  // Write the relative path.
  nsCOMPtr<nsIRelativeFilePref> relFilePref;
  NS_NewRelativeFilePref(aLocalFile,
                         NS_LITERAL_CSTRING(NS_APP_USER_PROFILE_50_DIR),
                         getter_AddRefs(relFilePref));
  if (relFilePref) {
    nsresult rv = mPrefBranch->SetComplexValue(aRelPrefName,
                                               NS_GET_IID(nsIRelativeFilePref),
                                               relFilePref);
    if (NS_FAILED(rv))
      return rv;
  }
  return mPrefBranch->SetComplexValue(aAbsPrefName, NS_GET_IID(nsILocalFile), aLocalFile);
}

NS_IMETHODIMP
nsMsgIncomingServer::SetIntValue(const char *prefname,
                                 PRInt32 val)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  PRInt32 defaultVal;
  nsresult rv = mDefPrefBranch->GetIntPref(prefname, &defaultVal);

  if (NS_SUCCEEDED(rv) && defaultVal == val)
    mPrefBranch->ClearUserPref(prefname);
  else
    rv = mPrefBranch->SetIntPref(prefname, val);

  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetCharValue(const char *prefname,
                                  nsACString& val)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  nsCString tmpVal;
  if (NS_FAILED(mPrefBranch->GetCharPref(prefname, getter_Copies(tmpVal))))
    mDefPrefBranch->GetCharPref(prefname, getter_Copies(tmpVal));
  val = tmpVal;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetUnicharValue(const char *prefname,
                                     nsAString& val)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  nsCOMPtr<nsISupportsString> supportsString;
  if (NS_FAILED(mPrefBranch->GetComplexValue(prefname,
                                             NS_GET_IID(nsISupportsString),
                                             getter_AddRefs(supportsString))))
    mDefPrefBranch->GetComplexValue(prefname,
                                    NS_GET_IID(nsISupportsString),
                                    getter_AddRefs(supportsString));

  if (supportsString)
    return supportsString->GetData(val);
  val.Truncate();
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetCharValue(const char *prefname,
                                  const nsACString& val)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  if (val.IsEmpty()) {
    mPrefBranch->ClearUserPref(prefname);
    return NS_OK;
  }

  nsCString defaultVal;
  nsresult rv = mDefPrefBranch->GetCharPref(prefname, getter_Copies(defaultVal));

  if (NS_SUCCEEDED(rv) && defaultVal.Equals(val))
    mPrefBranch->ClearUserPref(prefname);
  else
    rv = mPrefBranch->SetCharPref(prefname, nsCString(val).get());

  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetUnicharValue(const char *prefname,
                                     const nsAString& val)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  if (val.IsEmpty()) {
    mPrefBranch->ClearUserPref(prefname);
    return NS_OK;
  }

  nsCOMPtr<nsISupportsString> supportsString;
  nsresult rv = mDefPrefBranch->GetComplexValue(prefname,
                                                NS_GET_IID(nsISupportsString),
                                                getter_AddRefs(supportsString));
  nsString defaultVal;
  if (NS_SUCCEEDED(rv) &&
      NS_SUCCEEDED(supportsString->GetData(defaultVal)) &&
      defaultVal.Equals(val))
    mPrefBranch->ClearUserPref(prefname);
  else {
    supportsString = do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID, &rv);
    if (supportsString) {
      supportsString->SetData(val);
      rv = mPrefBranch->SetComplexValue(prefname,
                                        NS_GET_IID(nsISupportsString),
                                        supportsString);
    }
  }

  return rv;
}

// pretty name is the display name to show to the user
NS_IMETHODIMP
nsMsgIncomingServer::GetPrettyName(nsAString& retval)
{
  nsresult rv = GetUnicharValue("name", retval);
  NS_ENSURE_SUCCESS(rv, rv);

  // if there's no name, then just return the hostname
  return retval.IsEmpty() ? GetConstructedPrettyName(retval) : rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetPrettyName(const nsAString& value)
{
  SetUnicharValue("name", value);
  nsCOMPtr<nsIMsgFolder> rootFolder;
  GetRootFolder(getter_AddRefs(rootFolder));
  if (rootFolder)
    rootFolder->SetPrettyName(value);
  return NS_OK;
}


// construct the pretty name to show to the user if they haven't
// specified one. This should be overridden for news and mail.
NS_IMETHODIMP
nsMsgIncomingServer::GetConstructedPrettyName(nsAString& retval)
{
  nsCString username;
  nsresult rv = GetUsername(username);
  NS_ENSURE_SUCCESS(rv, rv);
  if (!username.IsEmpty()) {
    CopyASCIItoUTF16(username, retval);
    retval.AppendLiteral(" on ");
  }

  nsCString hostname;
  rv = GetHostName(hostname);
  NS_ENSURE_SUCCESS(rv, rv);

  retval.Append(NS_ConvertASCIItoUTF16(hostname));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::ToString(nsAString& aResult)
{
  aResult.AssignLiteral("[nsIMsgIncomingServer: ");
  aResult.Append(NS_ConvertASCIItoUTF16(m_serverKey));
  aResult.AppendLiteral("]");
  return NS_OK;
}

NS_IMETHODIMP nsMsgIncomingServer::SetPassword(const nsACString& aPassword)
{
  m_password = aPassword;

  nsresult rv;
  PRBool rememberPassword = PR_FALSE;

  rv = GetRememberPassword(&rememberPassword);
  NS_ENSURE_SUCCESS(rv, rv);

  if (rememberPassword)
    rv = StorePassword();

  return rv;
}

NS_IMETHODIMP nsMsgIncomingServer::GetPassword(nsACString& aPassword)
{
  aPassword = m_password;
  return NS_OK;
}

NS_IMETHODIMP nsMsgIncomingServer::GetServerRequiresPasswordForBiff(PRBool *aServerRequiresPasswordForBiff)
{
  NS_ENSURE_ARG_POINTER(aServerRequiresPasswordForBiff);
  *aServerRequiresPasswordForBiff = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetPasswordWithUI(const nsAString& aPromptMessage, const
                                       nsAString& aPromptTitle,
                                       nsIMsgWindow* aMsgWindow,
                                       PRBool *okayValue,
                                       nsACString& aPassword)
{
  nsresult rv = NS_OK;
  NS_ENSURE_ARG_POINTER(okayValue);

  if (m_password.IsEmpty())
  {
    // let's see if we have the password in the password manager and
    // can avoid this prompting thing. This makes it easier to get embedders
    // to get up and running w/o a password prompting UI. We already depend on
    // nsIPasswordManagerInternal so this doesn't introduce a new dependency.
    nsCOMPtr <nsIPasswordManagerInternal> passwordMgrInt = do_GetService(NS_PASSWORDMANAGER_CONTRACTID, &rv);
    if(passwordMgrInt)
    {
      // Get the current server URI
      nsCString currServerUri;
      rv = GetServerURI(currServerUri);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCAutoString hostFound;
      nsAutoString userNameFound;
      nsAutoString passwordFound;

      // Get password entry corresponding to the host URI we are passing in.
      if (NS_SUCCEEDED(passwordMgrInt->FindPasswordEntry(currServerUri, EmptyString(), EmptyString(),
                                             hostFound, userNameFound, passwordFound)))
      {
        LossyCopyUTF16toASCII(passwordFound, m_password);
        *okayValue = PR_TRUE;
      }
    }
  }
  if (m_password.IsEmpty())
  {
    nsCOMPtr<nsIAuthPrompt> dialog;
    // aMsgWindow is required if we need to prompt
    if (aMsgWindow)
    {
      // prompt the user for the password
      nsCOMPtr<nsIDocShell> docShell;
      rv = aMsgWindow->GetRootDocShell(getter_AddRefs(docShell));
      NS_ENSURE_SUCCESS(rv, rv);
      dialog = do_GetInterface(docShell, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
    }
    if (dialog)
    {
      nsCString serverUri;
      rv = GetServerURI(serverUri);
      NS_ENSURE_SUCCESS(rv, rv);

      // we pass in the previously used password, if any, into PromptPassword
      // so that it will appear as ******. This means we can't use an nsString
      // and getter_Copies.
      PRUnichar *uniPassword = nsnull;
      if (!aPassword.IsEmpty())
        uniPassword = ToNewUnicode(NS_ConvertASCIItoUTF16(aPassword));

      PRUint32 savePasswordType = PasswordProtectLocalCache() ? nsIAuthPrompt::SAVE_PASSWORD_FOR_SESSION : nsIAuthPrompt::SAVE_PASSWORD_PERMANENTLY;
      rv = dialog->PromptPassword(nsString(aPromptTitle).get(), nsString(aPromptMessage).get(),
        NS_ConvertASCIItoUTF16(serverUri).get(), savePasswordType,
        &uniPassword, okayValue);
      nsAutoString uniPasswordAdopted;
      uniPasswordAdopted.Adopt(uniPassword);
      NS_ENSURE_SUCCESS(rv, rv);

      if (!*okayValue) // if the user pressed cancel, just return an empty string;
      {
        aPassword.Truncate();
        return NS_MSG_PASSWORD_PROMPT_CANCELLED;
      }

      // we got a password back...so remember it
      rv = SetPassword(NS_LossyConvertUTF16toASCII(uniPasswordAdopted));
      NS_ENSURE_SUCCESS(rv, rv);
    } // if we got a prompt dialog
  } // if the password is empty
  return GetPassword(aPassword);
}

NS_IMETHODIMP
nsMsgIncomingServer::StorePassword()
{
  nsresult rv;

  // we only need to store this if we're password protecting the local cache.
  // Otherwise, the password manager handles storing the password if the user
  // checks the "remember password" box.
  if (!PasswordProtectLocalCache())
    return NS_OK;

  nsCString pwd;
  rv = GetPassword(pwd);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString serverSpec;
  rv = GetServerURI(serverSpec);
  NS_ENSURE_SUCCESS(rv,rv);

  // We're password protecting the local cache, we're going to munge the uri in the password mgr to
  // start with 'x', so that we can remember the password in order to challenge the user, w/o having the
  // password mgr automatically use the password.
  serverSpec.Insert('x', 0);
  nsCOMPtr<nsIURI> uri;
  NS_NewURI(getter_AddRefs(uri), serverSpec);

  //this is need to make sure wallet service has been created
  rv = CreateServicesForPasswordManager();
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1", &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  rv = observerService->NotifyObservers(uri, "login-succeeded", NS_ConvertUTF8toUTF16(pwd).get());
  NS_ENSURE_SUCCESS(rv,rv);
  nsCOMPtr<nsIMsgAccountManager> accountManager = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID);
  if (accountManager)
    accountManager->SetUserNeedsToAuthenticate(PR_FALSE);
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::ForgetPassword()
{
  //this is needed to make sure the wallet service has been created
  nsresult rv = CreateServicesForPasswordManager();
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsIPasswordManager> passwordMgr = do_GetService(NS_PASSWORDMANAGER_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv) && passwordMgr)
  {
    // Get the current server URI
    nsCString currServerUri;
    rv = GetServerURI(currServerUri);
    NS_ENSURE_SUCCESS(rv, rv);
    passwordMgr->RemoveUser(currServerUri, EmptyString());
  }
  return SetPassword(EmptyCString());
}

NS_IMETHODIMP
nsMsgIncomingServer::ForgetSessionPassword()
{
  m_password.Truncate();
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetDefaultLocalPath(nsILocalFile *aDefaultLocalPath)
{
  nsresult rv;
  nsCOMPtr<nsIMsgProtocolInfo> protocolInfo;
  rv = getProtocolInfo(getter_AddRefs(protocolInfo));
  NS_ENSURE_SUCCESS(rv, rv);
  return protocolInfo->SetDefaultLocalPath(aDefaultLocalPath);
}

NS_IMETHODIMP
nsMsgIncomingServer::GetLocalPath(nsILocalFile **aLocalPath)
{
  nsresult rv;

  // if the local path has already been set, use it
  rv = GetFileValue("directory-rel", "directory", aLocalPath);
  if (NS_SUCCEEDED(rv) && *aLocalPath)
    return rv;

  // otherwise, create the path using the protocol info.
  // note we are using the
  // hostname, unless that directory exists.
// this should prevent all collisions.
  nsCOMPtr<nsIMsgProtocolInfo> protocolInfo;
  rv = getProtocolInfo(getter_AddRefs(protocolInfo));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILocalFile> localPath;
  rv = protocolInfo->GetDefaultLocalPath(getter_AddRefs(localPath));
  NS_ENSURE_SUCCESS(rv, rv);
  localPath->Create(nsIFile::DIRECTORY_TYPE, 0755);

  nsCString hostname;
  rv = GetHostName(hostname);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // set the leaf name to "dummy", and then call MakeUnique with a suggested leaf name
  rv = localPath->AppendNative(hostname);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = localPath->CreateUnique(nsIFile::DIRECTORY_TYPE, 0755);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = SetLocalPath(localPath);
  NS_ENSURE_SUCCESS(rv, rv);

  localPath.swap(*aLocalPath);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetLocalPath(nsILocalFile *aLocalPath)
{
  NS_ENSURE_ARG_POINTER(aLocalPath);
  aLocalPath->Create(nsIFile::DIRECTORY_TYPE, 0755);
  return SetFileValue("directory-rel", "directory", aLocalPath);
}

NS_IMETHODIMP
nsMsgIncomingServer::SetRememberPassword(PRBool value)
{
  if (!value)
    ForgetPassword();
  else
    StorePassword();
  return SetBoolValue("remember_password", value);
}

PRBool nsMsgIncomingServer::PasswordProtectLocalCache()
{
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  NS_ENSURE_TRUE(prefs, PR_FALSE);

  PRBool passwordProtectLocalCache;
  nsresult rv = prefs->GetBoolPref( "mail.password_protect_local_cache", &passwordProtectLocalCache);
  NS_ENSURE_SUCCESS(rv, PR_FALSE);
  return passwordProtectLocalCache;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetRememberPassword(PRBool* aValue)
{
  NS_ENSURE_ARG_POINTER(aValue);
  return GetBoolValue("remember_password", aValue);
}

NS_IMETHODIMP
nsMsgIncomingServer::GetLocalStoreType(nsACString& aResult)
{
  NS_NOTYETIMPLEMENTED("nsMsgIncomingServer superclass not implementing GetLocalStoreType!");
  return NS_ERROR_UNEXPECTED;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetAccountManagerChrome(nsAString& aResult)
{
  aResult.AssignLiteral("am-main.xul");
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::Equals(nsIMsgIncomingServer *server, PRBool *_retval)
{
  nsresult rv;

  NS_ENSURE_ARG_POINTER(server);
  NS_ENSURE_ARG_POINTER(_retval);

  nsCString key1;
  nsCString key2;

  rv = GetKey(key1);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = server->GetKey(key2);
  NS_ENSURE_SUCCESS(rv, rv);

  // compare the server keys
#ifdef MOZILLA_INTERNAL_API
  *_retval = key1.Equals(key2, nsCaseInsensitiveCStringComparator());
#else
  *_retval = key1.Equals(key2, CaseInsensitiveCompare);
#endif

  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::ClearAllValues()
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  return mPrefBranch->DeleteBranch("");
}

NS_IMETHODIMP
nsMsgIncomingServer::RemoveFiles()
{
  // IMPORTANT, see bug #77652
  // don't turn this code on yet.  we don't inform the user that
  // we are going to be deleting the directory, and they might have
  // tweaked their localPath pref for this server to point to
  // somewhere they didn't want deleted.
  // until we tell them, we shouldn't do the delete.
  nsCString deferredToAccount;
  GetCharValue("deferred_to_account", deferredToAccount);
  PRBool isDeferredTo = PR_TRUE;
  GetIsDeferredTo(&isDeferredTo);
  if (!deferredToAccount.IsEmpty() || isDeferredTo)
  {
    NS_ASSERTION(PR_FALSE, "shouldn't remove files for a deferred account");
    return NS_ERROR_FAILURE;
  }
  nsCOMPtr <nsILocalFile> localPath;
  nsresult rv = GetLocalPath(getter_AddRefs(localPath));
  NS_ENSURE_SUCCESS(rv, rv);
  return localPath->Remove(PR_TRUE);
}

NS_IMETHODIMP
nsMsgIncomingServer::SetFilterList(nsIMsgFilterList *aFilterList)
{
  mFilterList = aFilterList;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetFilterList(nsIMsgWindow *aMsgWindow, nsIMsgFilterList **aResult)
{
  if (!mFilterList)
  {
      nsCOMPtr<nsIMsgFolder> msgFolder;
      // use GetRootFolder so for deferred pop3 accounts, we'll get the filters
      // file from the deferred account, not the deferred to account,
      // so that filters will still be per-server.
      nsresult rv = GetRootFolder(getter_AddRefs(msgFolder));
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsILocalFile> thisFolder;
      rv = msgFolder->GetFilePath(getter_AddRefs(thisFolder));
      NS_ENSURE_SUCCESS(rv, rv);

      mFilterFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      rv = mFilterFile->InitWithFile(thisFolder);
      NS_ENSURE_SUCCESS(rv, rv);

      mFilterFile->AppendNative(NS_LITERAL_CSTRING("msgFilterRules.dat"));

      PRBool fileExists;
      mFilterFile->Exists(&fileExists);
      if (!fileExists)
      {
        nsCOMPtr<nsILocalFile> oldFilterFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        rv = oldFilterFile->InitWithFile(thisFolder);
        NS_ENSURE_SUCCESS(rv, rv);
        oldFilterFile->AppendNative(NS_LITERAL_CSTRING("rules.dat"));

        oldFilterFile->Exists(&fileExists);
        if (fileExists)  //copy rules.dat --> msgFilterRules.dat
        {
          rv = oldFilterFile->CopyToNative(thisFolder, NS_LITERAL_CSTRING("msgFilterRules.dat"));
          NS_ENSURE_SUCCESS(rv, rv);
        }
      }
      nsCOMPtr<nsIMsgFilterService> filterService =
          do_GetService(NS_MSGFILTERSERVICE_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = filterService->OpenFilterList(mFilterFile, msgFolder, aMsgWindow, getter_AddRefs(mFilterList));
      NS_ENSURE_SUCCESS(rv, rv);
  }

  NS_IF_ADDREF(*aResult = mFilterList);
  return NS_OK;

}

// If the hostname contains ':' (like hostname:1431)
// then parse and set the port number.
nsresult
nsMsgIncomingServer::InternalSetHostName(const nsACString& aHostname, const char * prefName)
{
  nsCString hostname;
  hostname = aHostname;
  PRInt32 colonPos = hostname.FindChar(':');
  if (colonPos != -1)
  {
    nsCAutoString portString(StringTail(hostname, hostname.Length() - colonPos));
    hostname.SetLength(colonPos);
#ifdef MOZILLA_INTERNAL_API
    PRInt32 err;
    PRInt32 port = portString.ToInteger(&err);
    if (!err)
      SetPort(port);
#else
    nsresult err;
    PRInt32 port = portString.ToInteger(&err);
    if (NS_SUCCEEDED(err))
      SetPort(port);
#endif
  }
  return SetCharValue(prefName, hostname);
}

NS_IMETHODIMP
nsMsgIncomingServer::OnUserOrHostNameChanged(const nsACString& oldName, const nsACString& newName)
{
  nsresult rv;

  // 1. Reset password so that users are prompted for new password for the new user/host.
  ForgetPassword();

  // 2. Let the derived class close all cached connection to the old host.
  CloseCachedConnections();

  // 3. Notify any listeners for account server changes.
  nsCOMPtr<nsIMsgAccountManager> accountManager = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = accountManager->NotifyServerChanged(this);
  NS_ENSURE_SUCCESS(rv, rv);

  // 4. Lastly, replace all occurrences of old name in the acct name with the new one.
  nsString acctName;
  rv = GetPrettyName(acctName);
  if (NS_SUCCEEDED(rv) && !acctName.IsEmpty())
  {
    PRInt32 match = 0;
    PRUint32 offset = 0;
    nsString oldSubstr = NS_ConvertASCIItoUTF16(oldName);
    nsString newSubstr = NS_ConvertASCIItoUTF16(newName);
    while (offset < acctName.Length()) {
        match = acctName.Find(oldSubstr, offset);
        if (match == -1)
            break;
 
        acctName.Replace(offset + match, oldSubstr.Length(), newSubstr);
        offset += (match + newSubstr.Length());
    }

    SetPrettyName(acctName);
  }

  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetHostName(const nsACString& aHostname)
{
  return (InternalSetHostName(aHostname, "hostname"));
}

// SetRealHostName() is called only when the server name is changed from the
// UI (Account Settings page).  No one should call it in any circumstances.
NS_IMETHODIMP
nsMsgIncomingServer::SetRealHostName(const nsACString& aHostname)
{
  nsCString oldName;
  nsresult rv = GetRealHostName(oldName);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = InternalSetHostName(aHostname, "realhostname");

  // A few things to take care of if we're changing the hostname.
#ifdef MOZILLA_INTERNAL_API
  if (!aHostname.Equals(oldName, nsCaseInsensitiveCStringComparator()))
#else
  if (!aHostname.Equals(oldName, CaseInsensitiveCompare))
#endif
    rv = OnUserOrHostNameChanged(oldName, aHostname);
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetHostName(nsACString& aResult)
{
  nsresult rv;
  rv = GetCharValue("hostname", aResult);
  if (aResult.FindChar(':') != -1)
  {
    // gack, we need to reformat the hostname - SetHostName will do that
    SetHostName(aResult);
    rv = GetCharValue("hostname", aResult);
  }
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetRealHostName(nsACString& aResult)
{
  // If 'realhostname' is set (was changed) then use it, otherwise use 'hostname'
  nsresult rv;
  rv = GetCharValue("realhostname", aResult);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (aResult.IsEmpty())
    return GetHostName(aResult);

  if (aResult.FindChar(':') != -1)
  {
    SetRealHostName(aResult);
    rv = GetCharValue("realhostname", aResult);
  }

  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetRealUsername(nsACString& aResult)
{
  // If 'realuserName' is set (was changed) then use it, otherwise use 'userName'
  nsresult rv;
  rv = GetCharValue("realuserName", aResult);
  NS_ENSURE_SUCCESS(rv, rv);
  return aResult.IsEmpty() ? GetUsername(aResult) : rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetRealUsername(const nsACString& aUsername)
{
  // Need to take care of few things if we're changing the username.
  nsCString oldName;
  nsresult rv = GetRealUsername(oldName);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetCharValue("realuserName", aUsername);
  if (!oldName.Equals(aUsername))
    rv = OnUserOrHostNameChanged(oldName, aUsername);
  return rv;
}

#define BIFF_PREF_NAME "check_new_mail"

NS_IMETHODIMP
nsMsgIncomingServer::GetDoBiff(PRBool *aDoBiff)
{
  NS_ENSURE_ARG_POINTER(aDoBiff);

  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv;

  rv = mPrefBranch->GetBoolPref(BIFF_PREF_NAME, aDoBiff);
  if (NS_SUCCEEDED(rv))
    return rv;

  // if the pref isn't set, use the default
  // value based on the protocol
  nsCOMPtr<nsIMsgProtocolInfo> protocolInfo;
  rv = getProtocolInfo(getter_AddRefs(protocolInfo));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = protocolInfo->GetDefaultDoBiff(aDoBiff);
  // note, don't call SetDoBiff()
  // since we keep changing our minds on
  // if biff should be on or off, let's keep the ability
  // to change the default in future builds.
  // if we call SetDoBiff() here, it will be in the users prefs.
  // and we can't do anything after that.
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetDoBiff(PRBool aDoBiff)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  return mPrefBranch->SetBoolPref(BIFF_PREF_NAME, aDoBiff);
}

NS_IMETHODIMP
nsMsgIncomingServer::GetPort(PRInt32 *aPort)
{
  NS_ENSURE_ARG_POINTER(aPort);

  nsresult rv;
  rv = GetIntValue("port", aPort);
  if (*aPort != PORT_NOT_SET)
    return rv;

  // if the port isn't set, use the default
  // port based on the protocol
  nsCOMPtr<nsIMsgProtocolInfo> protocolInfo;
  rv = getProtocolInfo(getter_AddRefs(protocolInfo));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool isSecure = PR_FALSE;
  // Try this, and if it fails, fall back to the non-secure port
  GetIsSecure(&isSecure);
  return protocolInfo->GetDefaultServerPort(isSecure, aPort);
}

NS_IMETHODIMP
nsMsgIncomingServer::SetPort(PRInt32 aPort)
{
  nsresult rv;

  nsCOMPtr<nsIMsgProtocolInfo> protocolInfo;
  rv = getProtocolInfo(getter_AddRefs(protocolInfo));
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 defaultPort;
  PRBool isSecure = PR_FALSE;
  // Try this, and if it fails, fall back to the non-secure port
  GetIsSecure(&isSecure);
  protocolInfo->GetDefaultServerPort(isSecure, &defaultPort);
  return SetIntValue("port", aPort == defaultPort ? PORT_NOT_SET : aPort);
}

nsresult
nsMsgIncomingServer::getProtocolInfo(nsIMsgProtocolInfo **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  nsresult rv;

  nsCString type;
  rv = GetType(type);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString contractid(NS_MSGPROTOCOLINFO_CONTRACTID_PREFIX);
  contractid.Append(type);

  nsCOMPtr<nsIMsgProtocolInfo> protocolInfo = do_GetService(contractid.get(), &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  protocolInfo.swap(*aResult);
  return NS_OK;
}

NS_IMETHODIMP nsMsgIncomingServer::GetRetentionSettings(nsIMsgRetentionSettings **settings)
{
  NS_ENSURE_ARG_POINTER(settings);
  nsMsgRetainByPreference retainByPreference;
  PRInt32 daysToKeepHdrs = 0;
  PRInt32 numHeadersToKeep = 0;
  PRBool keepUnreadMessagesOnly = PR_FALSE;
  PRInt32 daysToKeepBodies = 0;
  PRBool cleanupBodiesByDays = PR_FALSE;
  nsresult rv = NS_OK;
  if (!m_retentionSettings)
  {
    m_retentionSettings = do_CreateInstance(NS_MSG_RETENTIONSETTINGS_CONTRACTID);
    if (m_retentionSettings)
    {
      rv = GetBoolValue("keepUnreadOnly", &keepUnreadMessagesOnly);
      rv = GetIntValue("retainBy", (PRInt32*) &retainByPreference);
      rv = GetIntValue("numHdrsToKeep", &numHeadersToKeep);
      rv = GetIntValue("daysToKeepHdrs", &daysToKeepHdrs);
      rv = GetIntValue("daysToKeepBodies", &daysToKeepBodies);
      rv = GetBoolValue("cleanupBodies", &cleanupBodiesByDays);
      m_retentionSettings->SetRetainByPreference(retainByPreference);
      m_retentionSettings->SetNumHeadersToKeep((PRUint32) numHeadersToKeep);
      m_retentionSettings->SetKeepUnreadMessagesOnly(keepUnreadMessagesOnly);
      m_retentionSettings->SetDaysToKeepBodies(daysToKeepBodies);
      m_retentionSettings->SetDaysToKeepHdrs(daysToKeepHdrs);
      m_retentionSettings->SetCleanupBodiesByDays(cleanupBodiesByDays);
    }
    else
      rv = NS_ERROR_OUT_OF_MEMORY;
    // Create an empty retention settings object,
    // get the settings from the server prefs, and init the object from the prefs.
  }
  NS_IF_ADDREF(*settings = m_retentionSettings);
  return rv;
}

NS_IMETHODIMP nsMsgIncomingServer::SetRetentionSettings(nsIMsgRetentionSettings *settings)
{
  nsMsgRetainByPreference retainByPreference;
  PRUint32 daysToKeepHdrs = 0;
  PRUint32 numHeadersToKeep = 0;
  PRBool keepUnreadMessagesOnly = PR_FALSE;
  PRUint32 daysToKeepBodies = 0;
  PRBool cleanupBodiesByDays = PR_FALSE;
  m_retentionSettings = settings;
  m_retentionSettings->GetRetainByPreference(&retainByPreference);
  m_retentionSettings->GetNumHeadersToKeep(&numHeadersToKeep);
  m_retentionSettings->GetKeepUnreadMessagesOnly(&keepUnreadMessagesOnly);
  m_retentionSettings->GetDaysToKeepBodies(&daysToKeepBodies);
  m_retentionSettings->GetDaysToKeepHdrs(&daysToKeepHdrs);
  m_retentionSettings->GetCleanupBodiesByDays(&cleanupBodiesByDays);
  nsresult rv = SetBoolValue("keepUnreadOnly", keepUnreadMessagesOnly);
  rv = SetIntValue("retainBy", retainByPreference);
  rv = SetIntValue("numHdrsToKeep", numHeadersToKeep);
  rv = SetIntValue("daysToKeepHdrs", daysToKeepHdrs);
  rv = SetIntValue("daysToKeepBodies", daysToKeepBodies);
  rv = SetBoolValue("cleanupBodies", cleanupBodiesByDays);
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetDisplayStartupPage(PRBool *displayStartupPage)
{
  NS_ENSURE_ARG_POINTER(displayStartupPage);
  *displayStartupPage = m_displayStartupPage;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetDisplayStartupPage(PRBool displayStartupPage)
{
  m_displayStartupPage = displayStartupPage;
  return NS_OK;
}


NS_IMETHODIMP nsMsgIncomingServer::GetDownloadSettings(nsIMsgDownloadSettings **settings)
{
  NS_ENSURE_ARG_POINTER(settings);
  PRBool downloadUnreadOnly = PR_FALSE;
  PRBool downloadByDate = PR_FALSE;
  PRUint32 ageLimitOfMsgsToDownload = 0;
  nsresult rv = NS_OK;
  if (!m_downloadSettings)
  {
    m_downloadSettings = do_CreateInstance(NS_MSG_DOWNLOADSETTINGS_CONTRACTID);
    if (m_downloadSettings)
    {
      rv = GetBoolValue("downloadUnreadOnly", &downloadUnreadOnly);
      rv = GetBoolValue("downloadByDate", &downloadByDate);
      rv = GetIntValue("ageLimit", (PRInt32 *) &ageLimitOfMsgsToDownload);
      m_downloadSettings->SetDownloadUnreadOnly(downloadUnreadOnly);
      m_downloadSettings->SetDownloadByDate(downloadByDate);
      m_downloadSettings->SetAgeLimitOfMsgsToDownload(ageLimitOfMsgsToDownload);
    }
    else
      rv = NS_ERROR_OUT_OF_MEMORY;
    // Create an empty download settings object,
    // get the settings from the server prefs, and init the object from the prefs.
  }
  NS_IF_ADDREF(*settings = m_downloadSettings);
  return rv;
}

NS_IMETHODIMP nsMsgIncomingServer::SetDownloadSettings(nsIMsgDownloadSettings *settings)
{
  m_downloadSettings = settings;
  PRBool downloadUnreadOnly = PR_FALSE;
  PRBool downloadByDate = PR_FALSE;
  PRUint32 ageLimitOfMsgsToDownload = 0;
  m_downloadSettings->GetDownloadUnreadOnly(&downloadUnreadOnly);
  m_downloadSettings->GetDownloadByDate(&downloadByDate);
  m_downloadSettings->GetAgeLimitOfMsgsToDownload(&ageLimitOfMsgsToDownload);
  nsresult rv = SetBoolValue("downloadUnreadOnly", downloadUnreadOnly);
  NS_ENSURE_SUCCESS(rv, rv);
  SetBoolValue("downloadByDate", downloadByDate);
  return SetIntValue("ageLimit", ageLimitOfMsgsToDownload);
}

NS_IMETHODIMP
nsMsgIncomingServer::GetSupportsDiskSpace(PRBool *aSupportsDiskSpace)
{
  NS_ENSURE_ARG_POINTER(aSupportsDiskSpace);
  *aSupportsDiskSpace = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetOfflineSupportLevel(PRInt32 *aSupportLevel)
{
  NS_ENSURE_ARG_POINTER(aSupportLevel);
  nsresult rv;

  rv = GetIntValue("offline_support_level", aSupportLevel);
  if (*aSupportLevel == OFFLINE_SUPPORT_LEVEL_UNDEFINED)
    *aSupportLevel = OFFLINE_SUPPORT_LEVEL_NONE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetOfflineSupportLevel(PRInt32 aSupportLevel)
{
  SetIntValue("offline_support_level", aSupportLevel);
  return NS_OK;
}
#define BASE_MSGS_URL       "chrome://messenger/locale/messenger.properties"

NS_IMETHODIMP nsMsgIncomingServer::DisplayOfflineMsg(nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aMsgWindow);

  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle(BASE_MSGS_URL, getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);
  if (bundle)
  {
    nsString errorMsgTitle;
    nsString errorMsgBody;
    bundle->GetStringFromName(NS_LITERAL_STRING("nocachedbodybody").get(), getter_Copies(errorMsgBody));
    bundle->GetStringFromName(NS_LITERAL_STRING("nocachedbodytitle").get(),  getter_Copies(errorMsgTitle));
    aMsgWindow->DisplayHTMLInMessagePane(errorMsgTitle, errorMsgBody, PR_TRUE);
  }
  
  return NS_OK;
}

// Called only during the migration process. A unique name is generated for the
// migrated account.
NS_IMETHODIMP
nsMsgIncomingServer::GeneratePrettyNameForMigration(nsAString& aPrettyName)
{
/**
   * 4.x had provisions for multiple imap servers to be maintained under
   * single identity. So, when migrated each of those server accounts need
   * to be represented by unique account name. nsImapIncomingServer will
   * override the implementation for this to do the right thing.
*/
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetFilterScope(nsMsgSearchScopeValue *filterScope)
{
  NS_ENSURE_ARG_POINTER(filterScope);
  *filterScope = nsMsgSearchScope::offlineMailFilter;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetSearchScope(nsMsgSearchScopeValue *searchScope)
{
  NS_ENSURE_ARG_POINTER(searchScope);
  *searchScope = nsMsgSearchScope::offlineMail;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetIsSecure(PRBool *aIsSecure)
{
  NS_ENSURE_ARG_POINTER(aIsSecure);
  PRInt32 socketType;
  nsresult rv = GetSocketType(&socketType);
  NS_ENSURE_SUCCESS(rv,rv);
  *aIsSecure = (socketType == nsIMsgIncomingServer::alwaysUseTLS ||
                socketType == nsIMsgIncomingServer::useSSL);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::SetIsSecure(PRBool aIsSecure)
{
  PRBool isSecure;
  nsresult rv = GetIsSecure(&isSecure);
  NS_ENSURE_SUCCESS(rv,rv);
  if (isSecure != aIsSecure) {
    SetBoolValue("isSecure", aIsSecure);
    if (m_rootFolder)
      m_rootFolder->NotifyBoolPropertyChanged(NS_NewAtom("isSecure"), isSecure, aIsSecure);
  }
  return NS_OK;
}

// use the convenience macros to implement the accessors
NS_IMPL_SERVERPREF_STR(nsMsgIncomingServer, Username, "userName")
NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer, UseSecAuth, "useSecAuth")
NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer, LogonFallback, "logon_fallback")
NS_IMPL_SERVERPREF_INT(nsMsgIncomingServer, BiffMinutes, "check_time")
NS_IMPL_SERVERPREF_STR(nsMsgIncomingServer, Type, "type")
// in 4.x, this was "mail.pop3_gets_new_mail" for pop and
// "mail.imap.new_mail_get_headers" for imap (it was global)
// in 5.0, this will be per server, and it will be "download_on_biff"
NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer, DownloadOnBiff, "download_on_biff")
NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer, Valid, "valid")
NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer, EmptyTrashOnExit,
                        "empty_trash_on_exit")
NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer, CanDelete, "canDelete")
NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer, LoginAtStartUp, "login_at_startup")
NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer,
                        DefaultCopiesAndFoldersPrefsToServer,
                        "allows_specialfolders_usage")

NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer,
                        CanCreateFoldersOnServer,
                        "canCreateFolders")

NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer,
                        CanFileMessagesOnServer,
                        "canFileMessages")

NS_IMPL_SERVERPREF_BOOL(nsMsgIncomingServer,
      LimitOfflineMessageSize,
      "limit_offline_message_size")

NS_IMPL_SERVERPREF_INT(nsMsgIncomingServer, MaxMessageSize, "max_size")

NS_IMPL_SERVERPREF_INT(nsMsgIncomingServer, IncomingDuplicateAction, "dup_action")

NS_IMETHODIMP nsMsgIncomingServer::SetUnicharAttribute(const char *aName, const nsAString& val)
{
  return SetUnicharValue(aName, val);
}

NS_IMETHODIMP nsMsgIncomingServer::GetUnicharAttribute(const char *aName, nsAString& val)
{
  return GetUnicharValue(aName, val);
}

NS_IMETHODIMP nsMsgIncomingServer::SetCharAttribute(const char *aName, const nsACString& val)
{
  return SetCharValue(aName, val);
}

NS_IMETHODIMP nsMsgIncomingServer::GetCharAttribute(const char *aName, nsACString& val)
{
  return GetCharValue(aName, val);
}

NS_IMETHODIMP nsMsgIncomingServer::SetBoolAttribute(const char *aName, PRBool val)
{
  return SetBoolValue(aName, val);
}

NS_IMETHODIMP nsMsgIncomingServer::GetBoolAttribute(const char *aName, PRBool *val)
{
  return GetBoolValue(aName, val);
}

NS_IMETHODIMP nsMsgIncomingServer::SetIntAttribute(const char *aName, PRInt32 val)
{
  return SetIntValue(aName, val);
}

NS_IMETHODIMP nsMsgIncomingServer::GetIntAttribute(const char *aName, PRInt32 *val)
{
  return GetIntValue(aName, val);
}

NS_IMETHODIMP nsMsgIncomingServer::GetSocketType(PRInt32 *aSocketType)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = mPrefBranch->GetIntPref("socketType", aSocketType);

  // socketType is set to default value. Look at isSecure setting
  if (NS_FAILED(rv))
  {
    PRBool isSecure;
    rv = mPrefBranch->GetBoolPref("isSecure", &isSecure);
    if (NS_SUCCEEDED(rv) && isSecure)
    {
       *aSocketType = nsIMsgIncomingServer::useSSL;
      // don't call virtual method in case overrides call GetSocketType
      nsMsgIncomingServer::SetSocketType(*aSocketType);
    }
    else
    {
      rv = mDefPrefBranch->GetIntPref("socketType", aSocketType);
      if (NS_FAILED(rv))
        *aSocketType = nsIMsgIncomingServer::defaultSocket;
    }
  }
  return rv;
}

NS_IMETHODIMP nsMsgIncomingServer::SetSocketType(PRInt32 aSocketType)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  return mPrefBranch->SetIntPref("socketType", aSocketType);
}

// Check if the password is available and return a boolean indicating whether
// it is being authenticated or not.
NS_IMETHODIMP
nsMsgIncomingServer::GetPasswordPromptRequired(PRBool *aPasswordIsRequired)
{
  NS_ENSURE_ARG_POINTER(aPasswordIsRequired);
  nsresult rv = NS_OK;
  *aPasswordIsRequired = PR_TRUE;

  // If the password is empty, check to see if it is stored and to be retrieved
  if (m_password.IsEmpty()) {
    nsCOMPtr <nsIPasswordManagerInternal> passwordMgrInt = do_GetService(NS_PASSWORDMANAGER_CONTRACTID, &rv);
    if(NS_SUCCEEDED(rv) && passwordMgrInt) {

      // Get the current server URI
      nsCString currServerUri;
      rv = GetServerURI(currServerUri);
      NS_ENSURE_SUCCESS(rv, rv);

      // Obtain the server URI which is in the format <protocol>://<userid>@<hostname>.
      // Password manager uses the same format when it stores the password on user's request.
      nsCAutoString hostFound;
      nsAutoString userNameFound;
      nsAutoString passwordFound;

      // Get password entry corresponding to the host URI we are passing in.
      rv = passwordMgrInt->FindPasswordEntry(currServerUri, EmptyString(), EmptyString(),
                                             hostFound, userNameFound, passwordFound);
      if (NS_FAILED(rv))
        return NS_OK;

      // If a match is found, password element is filled in. Convert the
      // obtained password and store it for the session.
      if (!passwordFound.IsEmpty())
      {
        if (PasswordProtectLocalCache()) // hmm, shouldn't be in here, so remove it.
          ForgetPassword();
        else
          rv = SetPassword(NS_LossyConvertUTF16toASCII(passwordFound));
      }
    }
  }
  *aPasswordIsRequired = m_password.IsEmpty();
  return rv;
}

NS_IMETHODIMP nsMsgIncomingServer::ConfigureTemporaryFilters(nsIMsgFilterList *aFilterList)
{
  nsresult rv = ConfigureTemporaryReturnReceiptsFilter(aFilterList);
  if (NS_FAILED(rv)) // shut up warnings...
    return rv;
  return ConfigureTemporaryServerSpamFilters(aFilterList);
}

nsresult
nsMsgIncomingServer::ConfigureTemporaryServerSpamFilters(nsIMsgFilterList *filterList)
{
  nsCOMPtr<nsISpamSettings> spamSettings;
  nsresult rv = GetSpamSettings(getter_AddRefs(spamSettings));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool useServerFilter;
  rv = spamSettings->GetUseServerFilter(&useServerFilter);
  NS_ENSURE_SUCCESS(rv, rv);

  // if we aren't configured to use server filters, then return early.
  if (!useServerFilter)
    return NS_OK;

  // For performance reasons, we'll handle clearing of filters if the user turns
  // off the server-side filters from the junk mail controls, in the junk mail controls.
  nsCAutoString serverFilterName;
  spamSettings->GetServerFilterName(serverFilterName);
  if (serverFilterName.IsEmpty())
    return NS_OK;
  PRInt32 serverFilterTrustFlags = 0;
  (void) spamSettings->GetServerFilterTrustFlags(&serverFilterTrustFlags);
  if (!serverFilterTrustFlags)
    return NS_OK;
  // check if filters have been setup already.
  nsAutoString yesFilterName, noFilterName;
  CopyASCIItoUTF16(serverFilterName, yesFilterName);
  yesFilterName.AppendLiteral("Yes");

  CopyASCIItoUTF16(serverFilterName, noFilterName);
  noFilterName.AppendLiteral("No");

  nsCOMPtr<nsIMsgFilter> newFilter;
  (void) filterList->GetFilterNamed(yesFilterName,
                                  getter_AddRefs(newFilter));

  if (!newFilter)
    (void) filterList->GetFilterNamed(noFilterName,
                                  getter_AddRefs(newFilter));
  if (newFilter)
    return NS_OK;

  nsCOMPtr<nsIFile> file;
  spamSettings->GetServerFilterFile(getter_AddRefs(file));

  // it's possible that we can no longer find the sfd file (i.e. the user disabled an extnsion that
  // was supplying the .sfd file.
  if (!file)
    return NS_OK;

  nsCOMPtr<nsIMsgFilterService> filterService = do_GetService(NS_MSGFILTERSERVICE_CONTRACTID, &rv);
  nsCOMPtr<nsIMsgFilterList> serverFilterList;

  nsCOMPtr <nsILocalFile> localFile = do_QueryInterface(file);
  rv = filterService->OpenFilterList(localFile, NULL, NULL, getter_AddRefs(serverFilterList));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = serverFilterList->GetFilterNamed(yesFilterName,
                                  getter_AddRefs(newFilter));
  if (newFilter && serverFilterTrustFlags & nsISpamSettings::TRUST_POSITIVES)
  {
    newFilter->SetTemporary(PR_TRUE);
    // check if we're supposed to move junk mail to junk folder; if so,
    // add filter action to do so.
    PRBool moveOnSpam, markAsReadOnSpam;
    spamSettings->GetMoveOnSpam(&moveOnSpam);
    if (moveOnSpam)
    {
      nsCString spamFolderURI;
      rv = spamSettings->GetSpamFolderURI(getter_Copies(spamFolderURI));
      if (NS_SUCCEEDED(rv) && (!spamFolderURI.IsEmpty()))
      {
        nsCOMPtr <nsIMsgRuleAction> moveAction;
        rv = newFilter->CreateAction(getter_AddRefs(moveAction));
        if (NS_SUCCEEDED(rv))
        {
          moveAction->SetType(nsMsgFilterAction::MoveToFolder);
          moveAction->SetTargetFolderUri(spamFolderURI);
          newFilter->AppendAction(moveAction);
        }
      }
    }
    spamSettings->GetMarkAsReadOnSpam(&markAsReadOnSpam);
    if (markAsReadOnSpam)
    {
      nsCOMPtr <nsIMsgRuleAction> markAsReadAction;
      rv = newFilter->CreateAction(getter_AddRefs(markAsReadAction));
      if (NS_SUCCEEDED(rv))
      {
        markAsReadAction->SetType(nsMsgFilterAction::MarkRead);
        newFilter->AppendAction(markAsReadAction);
      }
    }
    filterList->InsertFilterAt(0, newFilter);
  }

  rv = serverFilterList->GetFilterNamed(noFilterName,
                                  getter_AddRefs(newFilter));
  if (newFilter && serverFilterTrustFlags & nsISpamSettings::TRUST_NEGATIVES)
  {
    newFilter->SetTemporary(PR_TRUE);
    filterList->InsertFilterAt(0, newFilter);
  }

  return rv;
}

nsresult
nsMsgIncomingServer::ConfigureTemporaryReturnReceiptsFilter(nsIMsgFilterList *filterList)
{
  nsresult rv;

  nsCOMPtr<nsIMsgAccountManager> accountMgr = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgIdentity> identity;
  rv = accountMgr->GetFirstIdentityForServer(this, getter_AddRefs(identity));
  NS_ENSURE_SUCCESS(rv, rv);
  // this can return success and a null identity...

  PRBool useCustomPrefs = PR_FALSE;
  PRInt32 incorp = nsIMsgMdnGenerator::eIncorporateInbox;
  NS_ENSURE_TRUE(identity, NS_ERROR_NULL_POINTER);

  identity->GetBoolAttribute("use_custom_prefs", &useCustomPrefs);
  if (useCustomPrefs)
    rv = GetIntValue("incorporate_return_receipt", &incorp);
  else
  {
    nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
    if (prefs)
      prefs->GetIntPref("mail.incorporate.return_receipt", &incorp);
  }

  PRBool enable = (incorp == nsIMsgMdnGenerator::eIncorporateSent);

  // this is a temporary, internal mozilla filter
  // it will not show up in the UI, it will not be written to disk
  NS_NAMED_LITERAL_STRING(internalReturnReceiptFilterName, "mozilla-temporary-internal-MDN-receipt-filter");

  nsCOMPtr<nsIMsgFilter> newFilter;
  rv = filterList->GetFilterNamed(internalReturnReceiptFilterName,
                                  getter_AddRefs(newFilter));
  if (newFilter)
    newFilter->SetEnabled(enable);
  else if (enable)
  {
    nsCString actionTargetFolderUri;
    rv = identity->GetFccFolder(actionTargetFolderUri);
    if (!actionTargetFolderUri.IsEmpty())
    {
      filterList->CreateFilter(internalReturnReceiptFilterName,
                               getter_AddRefs(newFilter));
      if (newFilter)
      {
        newFilter->SetEnabled(PR_TRUE);
        // this internal filter is temporary
        // and should not show up in the UI or be written to disk
        newFilter->SetTemporary(PR_TRUE);

        nsCOMPtr<nsIMsgSearchTerm> term;
        nsCOMPtr<nsIMsgSearchValue> value;

        rv = newFilter->CreateTerm(getter_AddRefs(term));
        if (NS_SUCCEEDED(rv))
        {
          rv = term->GetValue(getter_AddRefs(value));
          if (NS_SUCCEEDED(rv))
          {
            // we need to use OtherHeader + 1 so nsMsgFilter::GetTerm will
            // return our custom header.
            value->SetAttrib(nsMsgSearchAttrib::OtherHeader + 1);
            value->SetStr(NS_LITERAL_STRING("multipart/report"));
            term->SetAttrib(nsMsgSearchAttrib::OtherHeader + 1);
            term->SetOp(nsMsgSearchOp::Contains);
            term->SetBooleanAnd(PR_TRUE);
            term->SetArbitraryHeader(NS_LITERAL_CSTRING("Content-Type"));
            term->SetValue(value);
            newFilter->AppendTerm(term);
          }
        }
        rv = newFilter->CreateTerm(getter_AddRefs(term));
        if (NS_SUCCEEDED(rv))
        {
          rv = term->GetValue(getter_AddRefs(value));
          if (NS_SUCCEEDED(rv))
          {
            // XXX todo
            // determine if ::OtherHeader is the best way to do this.
            // see nsMsgSearchOfflineMail::MatchTerms()
            value->SetAttrib(nsMsgSearchAttrib::OtherHeader + 1);
            value->SetStr(NS_LITERAL_STRING("disposition-notification"));
            term->SetAttrib(nsMsgSearchAttrib::OtherHeader + 1);
            term->SetOp(nsMsgSearchOp::Contains);
            term->SetBooleanAnd(PR_TRUE);
            term->SetArbitraryHeader(NS_LITERAL_CSTRING("Content-Type"));
            term->SetValue(value);
            newFilter->AppendTerm(term);
          }
        }
        nsCOMPtr<nsIMsgRuleAction> filterAction;
        rv = newFilter->CreateAction(getter_AddRefs(filterAction));
        if (NS_SUCCEEDED(rv))
        {
          filterAction->SetType(nsMsgFilterAction::MoveToFolder);
          filterAction->SetTargetFolderUri(actionTargetFolderUri);
          newFilter->AppendAction(filterAction);
          filterList->InsertFilterAt(0, newFilter);
        }
      }
    }
  }
  return rv;
}

NS_IMETHODIMP
nsMsgIncomingServer::ClearTemporaryReturnReceiptsFilter()
{
  if (mFilterList)
  {
    nsCOMPtr<nsIMsgFilter> mdnFilter;
    nsresult rv = mFilterList->GetFilterNamed(NS_LITERAL_STRING("mozilla-temporary-internal-MDN-receipt-filter"),
                                              getter_AddRefs(mdnFilter));
   if (NS_SUCCEEDED(rv) && mdnFilter)
     return mFilterList->RemoveFilter(mdnFilter);
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetMsgFolderFromURI(nsIMsgFolder *aFolderResource, const nsACString& aURI, nsIMsgFolder **aFolder)
{
  nsCOMPtr<nsIMsgFolder> rootMsgFolder;
  nsresult rv = GetRootMsgFolder(getter_AddRefs(rootMsgFolder));
  NS_ENSURE_TRUE(rootMsgFolder, NS_ERROR_UNEXPECTED);

  nsCOMPtr <nsIMsgFolder> msgFolder;
  rv = rootMsgFolder->GetChildWithURI(aURI, PR_TRUE, PR_TRUE /*caseInsensitive*/, getter_AddRefs(msgFolder));
  if (NS_FAILED(rv) || !msgFolder)
    msgFolder = aFolderResource;
  NS_IF_ADDREF(*aFolder = msgFolder);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetSpamSettings(nsISpamSettings **aSpamSettings)
{
  NS_ENSURE_ARG_POINTER(aSpamSettings);

  if (!mSpamSettings) {
    nsresult rv;
    mSpamSettings = do_CreateInstance(NS_SPAMSETTINGS_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);
    mSpamSettings->Initialize(this);
    NS_ENSURE_SUCCESS(rv,rv);
  }

  NS_ADDREF(*aSpamSettings = mSpamSettings);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgIncomingServer::GetSpamFilterPlugin(nsIMsgFilterPlugin **aFilterPlugin)
{
  NS_ENSURE_ARG_POINTER(aFilterPlugin);
  if (!mFilterPlugin)
  {
    nsresult rv;
    mFilterPlugin = do_GetService("@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter", &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  NS_IF_ADDREF(*aFilterPlugin = mFilterPlugin);
  return NS_OK;
}

// get all the servers that defer to the account for the passed in server. Note that
// destServer may not be "this"
nsresult nsMsgIncomingServer::GetDeferredServers(nsIMsgIncomingServer *destServer, nsISupportsArray **_retval)
{
  nsresult rv;
  nsCOMPtr<nsIMsgAccountManager> accountManager
    = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsISupportsArray> servers;
  rv = NS_NewISupportsArray(getter_AddRefs(servers));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgAccount> thisAccount;
  accountManager->FindAccountForServer(destServer, getter_AddRefs(thisAccount));
  if (thisAccount)
  {
    nsCOMPtr <nsISupportsArray> allServers;
    nsCString accountKey;
    thisAccount->GetKey(accountKey);
    accountManager->GetAllServers(getter_AddRefs(allServers));
    if (allServers)
    {
      PRUint32 serverCount;
      allServers->Count(&serverCount);
      for (PRUint32 i = 0; i < serverCount; i++)
      {
        nsCOMPtr <nsIMsgIncomingServer> server (do_QueryElementAt(allServers, i));
        if (server)
        {
          nsCString deferredToAccount;
          server->GetCharValue("deferred_to_account", deferredToAccount);
          if (deferredToAccount.Equals(accountKey))
            servers->AppendElement(server);
        }
      }
    }
  }
  servers.swap(*_retval);
  return rv;
}

NS_IMETHODIMP nsMsgIncomingServer::GetIsDeferredTo(PRBool *aIsDeferredTo)
{
  NS_ENSURE_ARG_POINTER(aIsDeferredTo);
  nsCOMPtr<nsIMsgAccountManager> accountManager
    = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID);
  if (accountManager)
  {
    nsCOMPtr <nsIMsgAccount> thisAccount;
    accountManager->FindAccountForServer(this, getter_AddRefs(thisAccount));
    if (thisAccount)
    {
      nsCOMPtr <nsISupportsArray> allServers;
      nsCString accountKey;
      thisAccount->GetKey(accountKey);
      accountManager->GetAllServers(getter_AddRefs(allServers));
      if (allServers)
      {
        PRUint32 serverCount;
        allServers->Count(&serverCount);
        for (PRUint32 i = 0; i < serverCount; i++)
        {
          nsCOMPtr <nsIMsgIncomingServer> server (do_QueryElementAt(allServers, i));
          if (server)
          {
            nsCString deferredToAccount;
            server->GetCharValue("deferred_to_account", deferredToAccount);
            if (deferredToAccount.Equals(accountKey))
            {
              *aIsDeferredTo = PR_TRUE;
              return NS_OK;
            }
          }
        }
      }
    }
  }
  *aIsDeferredTo = PR_FALSE;
  return NS_OK;
}

const long kMaxDownloadTableSize = 500;

// aClosure is the server, from that we get the cutoff point, below which we evict
// aData is the arrival index of the msg.
/* static */PLDHashOperator nsMsgIncomingServer::evictOldEntries(nsCStringHashKey::KeyType aKey, PRInt32 &aData, void *aClosure)
{
  nsMsgIncomingServer *server = (nsMsgIncomingServer *) aClosure;
  if (aData < server->m_numMsgsDownloaded - kMaxDownloadTableSize/2)
    return PL_DHASH_REMOVE;
  return server->m_downloadedHdrs.Count() > kMaxDownloadTableSize/2 ? PL_DHASH_NEXT : PL_DHASH_STOP;
}

// hash the concatenation of the message-id and subject as the hash table key,
// and store the arrival index as the value. To limit the size of the hash table,
// we just throw out ones with a lower ordinal value than the cut-off point.
NS_IMETHODIMP nsMsgIncomingServer::IsNewHdrDuplicate(nsIMsgDBHdr *aNewHdr, PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_ARG_POINTER(aNewHdr);
  *aResult = PR_FALSE;
  nsCAutoString strHashKey;
  nsCString messageId, subject;
  aNewHdr->GetMessageId(getter_Copies(messageId));
  strHashKey.Append(messageId);
  aNewHdr->GetSubject(getter_Copies(subject));
  // err on the side of caution and ignore messages w/o subject or messageid.
  if (subject.IsEmpty() || messageId.IsEmpty())
    return NS_OK;
  strHashKey.Append(subject);
  PRInt32 hashValue = 0;
  m_downloadedHdrs.Get(strHashKey, &hashValue);
  if (hashValue)
    *aResult = PR_TRUE;
  else
  {
    // we store the current size of the hash table as the hash
    // value - this allows us to delete older entries.
    m_downloadedHdrs.Put(strHashKey, ++m_numMsgsDownloaded);
    // Check if hash table is larger than some reasonable size
    // and if is it, iterate over hash table deleting messages
    // with an arrival index < number of msgs downloaded - half the reasonable size.
    if (m_downloadedHdrs.Count() >= kMaxDownloadTableSize)
      m_downloadedHdrs.Enumerate(evictOldEntries, this);
  }
  return NS_OK;
}
