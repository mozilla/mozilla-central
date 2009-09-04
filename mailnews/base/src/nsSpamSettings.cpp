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
 * Portions created by the Initial Developer are Copyright (C) 2001-2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Dan Mosedale <dmose@netscape.com>
 *   David Bienvenu <bienvenu@mozilla.org>
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

#include "nsSpamSettings.h"
#include "nsISupportsObsolete.h"
#include "nsILocalFile.h"
#include "plstr.h"
#include "prmem.h"
#include "nsIMsgHdr.h"
#include "nsNetUtil.h"
#include "nsIMsgFolder.h"
#include "nsMsgUtils.h"
#include "nsMsgFolderFlags.h"
#include "nsImapCore.h"
#include "nsIImapIncomingServer.h"
#include "nsIRDFService.h"
#include "nsIRDFResource.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIStringBundle.h"
#include "nsDateTimeFormatCID.h"

#include "nsMailDirServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsDirectoryServiceDefs.h"
#include "nsISimpleEnumerator.h"
#include "nsIDirectoryEnumerator.h"
#include "nsIMsgHeaderParser.h"
#include "nsAbBaseCID.h"
#include "nsIAbManager.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"

nsSpamSettings::nsSpamSettings()
{
  mLevel = 0;
  mMoveOnSpam = PR_FALSE;
  mMoveTargetMode = nsISpamSettings::MOVE_TARGET_MODE_ACCOUNT;
  mPurge = PR_FALSE;
  mPurgeInterval = 14; // 14 days

  mServerFilterTrustFlags = 0;

  mUseWhiteList = PR_FALSE;
  mUseServerFilter = PR_FALSE;

  nsresult rv = NS_GetSpecialDirectory(NS_APP_USER_PROFILE_50_DIR, getter_AddRefs(mLogFile));
  if (NS_SUCCEEDED(rv))
    mLogFile->Append(NS_LITERAL_STRING("junklog.html"));
}

nsSpamSettings::~nsSpamSettings()
{
}

NS_IMPL_ISUPPORTS2(nsSpamSettings, nsISpamSettings, nsIUrlListener)

NS_IMETHODIMP
nsSpamSettings::GetLevel(PRInt32 *aLevel)
{
  NS_ENSURE_ARG_POINTER(aLevel);
  *aLevel = mLevel;
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::SetLevel(PRInt32 aLevel)
{
  NS_ASSERTION((aLevel >= 0 && aLevel <= 100), "bad level");
  mLevel = aLevel;
  return NS_OK;
}

NS_IMETHODIMP
nsSpamSettings::GetMoveTargetMode(PRInt32 *aMoveTargetMode)
{
  NS_ENSURE_ARG_POINTER(aMoveTargetMode);
  *aMoveTargetMode = mMoveTargetMode;
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::SetMoveTargetMode(PRInt32 aMoveTargetMode)
{
  NS_ASSERTION((aMoveTargetMode == nsISpamSettings::MOVE_TARGET_MODE_FOLDER || aMoveTargetMode == nsISpamSettings::MOVE_TARGET_MODE_ACCOUNT), "bad move target mode");
  mMoveTargetMode = aMoveTargetMode;
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::GetManualMark(PRBool *aManualMark)
{
  NS_ENSURE_ARG_POINTER(aManualMark);
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefBranch->GetBoolPref("mail.spam.manualMark", aManualMark);
}

NS_IMETHODIMP nsSpamSettings::GetManualMarkMode(PRInt32 *aManualMarkMode)
{
  NS_ENSURE_ARG_POINTER(aManualMarkMode);
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefBranch->GetIntPref("mail.spam.manualMarkMode", aManualMarkMode);
}

NS_IMETHODIMP nsSpamSettings::GetLoggingEnabled(PRBool *aLoggingEnabled)
{
  NS_ENSURE_ARG_POINTER(aLoggingEnabled);
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefBranch->GetBoolPref("mail.spam.logging.enabled", aLoggingEnabled);
}

NS_IMETHODIMP nsSpamSettings::GetMarkAsReadOnSpam(PRBool *aMarkAsReadOnSpam)
{
  NS_ENSURE_ARG_POINTER(aMarkAsReadOnSpam);
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefBranch->GetBoolPref("mail.spam.markAsReadOnSpam", aMarkAsReadOnSpam);
}

NS_IMPL_GETSET(nsSpamSettings, MoveOnSpam, PRBool, mMoveOnSpam)
NS_IMPL_GETSET(nsSpamSettings, Purge, PRBool, mPurge)
NS_IMPL_GETSET(nsSpamSettings, UseWhiteList, PRBool, mUseWhiteList)
NS_IMPL_GETSET(nsSpamSettings, UseServerFilter, PRBool, mUseServerFilter)

NS_IMETHODIMP nsSpamSettings::GetWhiteListAbURI(char * *aWhiteListAbURI)
{
  NS_ENSURE_ARG_POINTER(aWhiteListAbURI);
  *aWhiteListAbURI = ToNewCString(mWhiteListAbURI);
  return NS_OK;
}
NS_IMETHODIMP nsSpamSettings::SetWhiteListAbURI(const char * aWhiteListAbURI)
{
  mWhiteListAbURI = aWhiteListAbURI;
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::GetActionTargetAccount(char * *aActionTargetAccount)
{
  NS_ENSURE_ARG_POINTER(aActionTargetAccount);
  *aActionTargetAccount = ToNewCString(mActionTargetAccount);
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::SetActionTargetAccount(const char * aActionTargetAccount)
{
  mActionTargetAccount = aActionTargetAccount;
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::GetActionTargetFolder(char * *aActionTargetFolder)
{
  NS_ENSURE_ARG_POINTER(aActionTargetFolder);
  *aActionTargetFolder = ToNewCString(mActionTargetFolder);
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::SetActionTargetFolder(const char * aActionTargetFolder)
{
  mActionTargetFolder = aActionTargetFolder;
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::GetPurgeInterval(PRInt32 *aPurgeInterval)
{
  NS_ENSURE_ARG_POINTER(aPurgeInterval);
  *aPurgeInterval = mPurgeInterval;
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::SetPurgeInterval(PRInt32 aPurgeInterval)
{
  NS_ASSERTION(aPurgeInterval >= 0, "bad purge interval");
  mPurgeInterval = aPurgeInterval;
  return NS_OK;
}

NS_IMETHODIMP
nsSpamSettings::SetLogStream(nsIOutputStream *aLogStream)
{
  // if there is a log stream already, close it
  if (mLogStream) {
    // will flush
    nsresult rv = mLogStream->Close();
    NS_ENSURE_SUCCESS(rv,rv);
  }

  mLogStream = aLogStream;
  return NS_OK;
}

#define LOG_HEADER "<head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\"></head>"
#define LOG_HEADER_LEN (strlen(LOG_HEADER))

NS_IMETHODIMP
nsSpamSettings::GetLogStream(nsIOutputStream **aLogStream)
{
  NS_ENSURE_ARG_POINTER(aLogStream);

  nsresult rv;

  if (!mLogStream) {
    nsCOMPtr <nsILocalFile> logFile = do_QueryInterface(mLogFile, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    // append to the end of the log file
    rv = NS_NewLocalFileOutputStream(getter_AddRefs(mLogStream),
                                   logFile,
                                   PR_CREATE_FILE | PR_WRONLY | PR_APPEND,
                                   0600);
    NS_ENSURE_SUCCESS(rv, rv);

    PRInt64 fileSize;
    rv = logFile->GetFileSize(&fileSize);
    NS_ENSURE_SUCCESS(rv, rv);

    PRUint32 fileLen;
    LL_L2UI(fileLen, fileSize);
    // write the header at the start
    if (fileLen == 0)
    {
      PRUint32 writeCount;

      rv = mLogStream->Write(LOG_HEADER, LOG_HEADER_LEN, &writeCount);
      NS_ENSURE_SUCCESS(rv, rv);
      NS_ASSERTION(writeCount == LOG_HEADER_LEN, "failed to write out log header");
    }
  }

  NS_ADDREF(*aLogStream = mLogStream);
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::Initialize(nsIMsgIncomingServer *aServer)
{
  NS_ENSURE_ARG_POINTER(aServer);
  nsresult rv;
  PRInt32 spamLevel;
  rv = aServer->GetIntValue("spamLevel", &spamLevel);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetLevel(spamLevel);
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool moveOnSpam;
  rv = aServer->GetBoolValue("moveOnSpam", &moveOnSpam);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetMoveOnSpam(moveOnSpam);
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 moveTargetMode;
  rv = aServer->GetIntValue("moveTargetMode", &moveTargetMode);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetMoveTargetMode(moveTargetMode);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString spamActionTargetAccount;
  rv = aServer->GetCharValue("spamActionTargetAccount", spamActionTargetAccount);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetActionTargetAccount(spamActionTargetAccount.get());
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString spamActionTargetFolder;
  rv = aServer->GetCharValue("spamActionTargetFolder", spamActionTargetFolder);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetActionTargetFolder(spamActionTargetFolder.get());
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool useWhiteList;
  rv = aServer->GetBoolValue("useWhiteList", &useWhiteList);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetUseWhiteList(useWhiteList);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString whiteListAbURI;
  rv = aServer->GetCharValue("whiteListAbURI", whiteListAbURI);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetWhiteListAbURI(whiteListAbURI.get());
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool purgeSpam;
  rv = aServer->GetBoolValue("purgeSpam", &purgeSpam);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetPurge(purgeSpam);
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 purgeSpamInterval;
  rv = aServer->GetIntValue("purgeSpamInterval", &purgeSpamInterval);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetPurgeInterval(purgeSpamInterval);
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool useServerFilter;
  rv = aServer->GetBoolValue("useServerFilter", &useServerFilter);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetUseServerFilter(useServerFilter);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString serverFilterName;
  rv = aServer->GetCharValue("serverFilterName", serverFilterName);
  if (NS_SUCCEEDED(rv))
    SetServerFilterName(serverFilterName);
  PRInt32 serverFilterTrustFlags = 0;
  rv = aServer->GetIntValue("serverFilterTrustFlags", &serverFilterTrustFlags);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = SetServerFilterTrustFlags(serverFilterTrustFlags);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (prefBranch)
    prefBranch->GetCharPref("mail.trusteddomains",
                            getter_Copies(mTrustedMailDomains));

  mWhiteListDirArray.Clear();
  if (!mWhiteListAbURI.IsEmpty())
  {
    nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    nsTArray<nsCString> whiteListArray;
    ParseString(mWhiteListAbURI, ' ', whiteListArray);

    for (PRUint32 index = 0; index < whiteListArray.Length(); index++)
    {
      nsCOMPtr<nsIAbDirectory> directory;
      rv = abManager->GetDirectory(whiteListArray[index],
                                   getter_AddRefs(directory));
      NS_ENSURE_SUCCESS(rv, rv);

      if (directory)
        mWhiteListDirArray.AppendObject(directory);
    }
  }

  // the next two preferences affect whether we try to whitelist our own
  // address or domain. Spammers send emails with spoofed from address matching
  // either the email address of the recipient, or the recipient's domain,
  // hoping to get whitelisted.
  //
  // The terms to describe this get wrapped up in chains of negatives. A full
  // definition of the boolean inhibitWhiteListingIdentityUser is "Suppress address
  // book whitelisting if the sender matches an identity's email address"

  rv = aServer->GetBoolValue("inhibitWhiteListingIdentityUser",
                             &mInhibitWhiteListingIdentityUser);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = aServer->GetBoolValue("inhibitWhiteListingIdentityDomain",
                             &mInhibitWhiteListingIdentityDomain);
  NS_ENSURE_SUCCESS(rv, rv);

  // collect lists of identity users if needed
  if (mInhibitWhiteListingIdentityDomain || mInhibitWhiteListingIdentityUser)
  {
    nsCOMPtr<nsIMsgAccountManager>
      accountManager(do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgAccount> account;
    rv = accountManager->FindAccountForServer(aServer, getter_AddRefs(account));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCAutoString accountKey;
    rv = account->GetKey(accountKey);
    NS_ENSURE_SUCCESS(rv, rv);

    // Loop through all accounts, adding emails from this account, as well as
    // from any accounts that defer to this account.
    mEmails.Clear();
    nsCOMPtr<nsISupportsArray> accounts;
    rv = accountManager->GetAccounts(getter_AddRefs(accounts));
    NS_ENSURE_SUCCESS(rv, rv);
    PRUint32 accountCount;
    accounts->Count(&accountCount);

    for (PRUint32 i = 0; i < accountCount; i++)
    {
      nsCOMPtr<nsIMsgAccount> loopAccount(do_QueryElementAt(accounts, i));
      if (!loopAccount)
        continue;
      nsCAutoString loopAccountKey;
      loopAccount->GetKey(loopAccountKey);
      nsCOMPtr<nsIMsgIncomingServer> loopServer;
      loopAccount->GetIncomingServer(getter_AddRefs(loopServer));
      nsCAutoString deferredToAccountKey;
      if (loopServer)
        loopServer->GetCharValue("deferred_to_account", deferredToAccountKey);

      // Add the emails for any account that defers to this one, or for the
      // account itself.
      if (accountKey.Equals(deferredToAccountKey) || accountKey.Equals(loopAccountKey))
      {
        nsCOMPtr<nsISupportsArray> identities;
        loopAccount->GetIdentities(getter_AddRefs(identities));
        if (!identities)
          continue;
        PRUint32 identityCount = 0;
        identities->Count(&identityCount);
        for (PRUint32 j = 0; j < identityCount; ++j)
        {
          nsCOMPtr<nsIMsgIdentity> identity(do_QueryElementAt(identities, j));
          if (!identity)
            continue;
          nsCAutoString email;
          identity->GetEmail(email);
          if (!email.IsEmpty())
            mEmails.AppendElement(email);
        }
      }
    }
  }

  return UpdateJunkFolderState();
}

nsresult nsSpamSettings::UpdateJunkFolderState()
{
  nsresult rv;

  // if the spam folder uri changed on us, we need to unset the junk flag
  // on the old spam folder
  nsCString newJunkFolderURI;
  rv = GetSpamFolderURI(getter_Copies(newJunkFolderURI));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!mCurrentJunkFolderURI.IsEmpty() && !mCurrentJunkFolderURI.Equals(newJunkFolderURI))
  {
    nsCOMPtr<nsIMsgFolder> oldJunkFolder;
    rv = GetExistingFolder(mCurrentJunkFolderURI, getter_AddRefs(oldJunkFolder));
    if (NS_SUCCEEDED(rv) && oldJunkFolder)
    {
      // remove the nsMsgFolderFlags::Junk on the old junk folder
      // XXX TODO
      // JUNK MAIL RELATED
      // (in ClearFlag?) we need to make sure that this folder
      // is not a the junk folder for another account
      // the same goes for set flag.  have fun with all that.
      oldJunkFolder->ClearFlag(nsMsgFolderFlags::Junk);
    }
  }

  mCurrentJunkFolderURI = newJunkFolderURI;

  // only try to create the junk folder if we are moving junk
  // and we have a non-empty uri
  if (mMoveOnSpam && !mCurrentJunkFolderURI.IsEmpty()) {
    // as the url listener, the spam settings will set the nsMsgFolderFlags::Junk folder flag
    // on the junk mail folder, after it is created
    rv = GetOrCreateFolder(mCurrentJunkFolderURI, this);
  }

  return rv;
}

NS_IMETHODIMP nsSpamSettings::Clone(nsISpamSettings *aSpamSettings)
{
  NS_ENSURE_ARG_POINTER(aSpamSettings);

  nsresult rv = aSpamSettings->GetUseWhiteList(&mUseWhiteList);
  NS_ENSURE_SUCCESS(rv,rv);

  (void)aSpamSettings->GetMoveOnSpam(&mMoveOnSpam);
  (void)aSpamSettings->GetPurge(&mPurge);
  (void)aSpamSettings->GetUseServerFilter(&mUseServerFilter);

  rv = aSpamSettings->GetPurgeInterval(&mPurgeInterval);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = aSpamSettings->GetLevel(&mLevel);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = aSpamSettings->GetMoveTargetMode(&mMoveTargetMode);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCString actionTargetAccount;
  rv = aSpamSettings->GetActionTargetAccount(getter_Copies(actionTargetAccount));
  NS_ENSURE_SUCCESS(rv,rv);
  mActionTargetAccount = actionTargetAccount;

  nsCString actionTargetFolder;
  rv = aSpamSettings->GetActionTargetFolder(getter_Copies(actionTargetFolder));
  NS_ENSURE_SUCCESS(rv,rv);
  mActionTargetFolder = actionTargetFolder;

  nsCString whiteListAbURI;
  rv = aSpamSettings->GetWhiteListAbURI(getter_Copies(whiteListAbURI));
  NS_ENSURE_SUCCESS(rv,rv);
  mWhiteListAbURI = whiteListAbURI;

  aSpamSettings->GetServerFilterName(mServerFilterName);
  aSpamSettings->GetServerFilterTrustFlags(&mServerFilterTrustFlags);

  return rv;
}

NS_IMETHODIMP nsSpamSettings::GetSpamFolderURI(char **aSpamFolderURI)
{
  NS_ENSURE_ARG_POINTER(aSpamFolderURI);

  if (mMoveTargetMode == nsISpamSettings::MOVE_TARGET_MODE_FOLDER)
    return GetActionTargetFolder(aSpamFolderURI);

  // if the mode is nsISpamSettings::MOVE_TARGET_MODE_ACCOUNT
  // the spam folder URI = account uri + "/Junk"
  nsCString folderURI;
  nsresult rv = GetActionTargetAccount(getter_Copies(folderURI));
  NS_ENSURE_SUCCESS(rv,rv);

  // we might be trying to get the old spam folder uri
  // in order to clear the flag
  // if we didn't have one, bail out.
  if (folderURI.IsEmpty())
    return NS_OK;

  nsCOMPtr<nsIRDFService> rdf(do_GetService("@mozilla.org/rdf/rdf-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFResource> folderResource;
  rv = rdf->GetResource(folderURI, getter_AddRefs(folderResource));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgFolder> folder = do_QueryInterface(folderResource);
  if (!folder)
    return NS_ERROR_UNEXPECTED;

  nsCOMPtr <nsIMsgIncomingServer> server;
  rv = folder->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv,rv);

  // see nsMsgFolder::SetPrettyName() for where the pretty name is set.

  // Check for an existing junk folder - this will do a case-insensitive 
  // search by URI - if we find a junk folder, use its URI.
  nsCOMPtr<nsIMsgFolder> junkFolder;
  folderURI.Append("/Junk");
  if (NS_SUCCEEDED(server->GetMsgFolderFromURI(folder, folderURI,
                                               getter_AddRefs(junkFolder))))
      junkFolder->GetURI(folderURI);

  // XXX todo
  // better not to make base depend in imap
  // but doing it here, like in nsMsgCopy.cpp
  // one day, we'll fix this (and nsMsgCopy.cpp) to use GetMsgFolderFromURI()
  nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryInterface(server);
  if (imapServer) {
    // Make sure an specific IMAP folder has correct personal namespace
    // see bug #197043
    nsCString folderUriWithNamespace;
    (void)imapServer->GetUriWithNamespacePrefixIfNecessary(kPersonalNamespace, folderURI,
                                                           folderUriWithNamespace);
    if (!folderUriWithNamespace.IsEmpty())
      folderURI = folderUriWithNamespace;
  }

  *aSpamFolderURI = ToNewCString(folderURI);
  if (!*aSpamFolderURI)
    return NS_ERROR_OUT_OF_MEMORY;
  else
    return rv;
}

NS_IMETHODIMP nsSpamSettings::GetServerFilterName(nsACString &aFilterName)
{
  aFilterName = mServerFilterName;
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::SetServerFilterName(const nsACString &aFilterName)
{
  mServerFilterName = aFilterName;
  mServerFilterFile = nsnull; // clear out our stored location value
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::GetServerFilterFile(nsIFile ** aFile)
{
  NS_ENSURE_ARG_POINTER(aFile);
  if (!mServerFilterFile)
  {
    nsresult rv;
    nsCAutoString serverFilterFileName;
    GetServerFilterName(serverFilterFileName);
    serverFilterFileName.Append(".sfd");

    nsCOMPtr<nsIProperties> dirSvc = do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    // Walk through the list of isp directories
    nsCOMPtr<nsISimpleEnumerator> ispDirectories;
    rv = dirSvc->Get(ISP_DIRECTORY_LIST, NS_GET_IID(nsISimpleEnumerator), getter_AddRefs(ispDirectories));
    NS_ENSURE_SUCCESS(rv, rv);

    PRBool hasMore;
    nsCOMPtr<nsIFile> file;
    while (NS_SUCCEEDED(ispDirectories->HasMoreElements(&hasMore)) && hasMore)
    {
      nsCOMPtr<nsISupports> elem;
      ispDirectories->GetNext(getter_AddRefs(elem));
      file = do_QueryInterface(elem);

      if (file)
      {
        // append our desired leaf name then test to see if the file exists. If it does, we've found
        // mServerFilterFile.
        file->AppendNative(serverFilterFileName);
        PRBool exists;
        if (NS_SUCCEEDED(file->Exists(&exists)) && exists)
        {
          file.swap(mServerFilterFile);
          break;
        }
      } // if file
    } // until we find the location of mServerFilterName
  } // if we haven't already stored mServerFilterFile

  NS_IF_ADDREF(*aFile = mServerFilterFile);
  return NS_OK;
}


NS_IMPL_GETSET(nsSpamSettings, ServerFilterTrustFlags, PRBool, mServerFilterTrustFlags)

#define LOG_ENTRY_START_TAG "<p>\n"
#define LOG_ENTRY_START_TAG_LEN (strlen(LOG_ENTRY_START_TAG))
#define LOG_ENTRY_END_TAG "</p>\n"
#define LOG_ENTRY_END_TAG_LEN (strlen(LOG_ENTRY_END_TAG))

NS_IMETHODIMP nsSpamSettings::LogJunkHit(nsIMsgDBHdr *aMsgHdr, PRBool aMoveMessage)
{
  PRBool loggingEnabled;
  nsresult rv = GetLoggingEnabled(&loggingEnabled);
  NS_ENSURE_SUCCESS(rv,rv);

  if (!loggingEnabled)
    return NS_OK;

  PRTime date;

  nsString authorValue;
  nsString subjectValue;
  nsString dateValue;

  (void)aMsgHdr->GetDate(&date);
  PRExplodedTime exploded;
  PR_ExplodeTime(date, PR_LocalTimeParameters, &exploded);

  if (!mDateFormatter)
  {
    mDateFormatter = do_CreateInstance(NS_DATETIMEFORMAT_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!mDateFormatter)
    {
      return NS_ERROR_FAILURE;
    }
  }
  mDateFormatter->FormatPRExplodedTime(nsnull, kDateFormatShort,
                                      kTimeFormatSeconds, &exploded,
                                      dateValue);

  (void)aMsgHdr->GetMime2DecodedAuthor(authorValue);
  (void)aMsgHdr->GetMime2DecodedSubject(subjectValue);

  nsCString buffer;
  // this is big enough to hold a log entry.
  // do this so we avoid growing and copying as we append to the log.
  buffer.SetCapacity(512);

  nsCOMPtr<nsIStringBundleService> bundleService =
    do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/filter.properties",
    getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  const PRUnichar *junkLogDetectFormatStrings[3] = { authorValue.get(), subjectValue.get(), dateValue.get() };
  nsString junkLogDetectStr;
  rv = bundle->FormatStringFromName(
    NS_LITERAL_STRING("junkLogDetectStr").get(),
    junkLogDetectFormatStrings, 3,
    getter_Copies(junkLogDetectStr));
  NS_ENSURE_SUCCESS(rv, rv);

  buffer += NS_ConvertUTF16toUTF8(junkLogDetectStr);
  buffer +=  "\n";

  if (aMoveMessage) {
    nsCString msgId;
    aMsgHdr->GetMessageId(getter_Copies(msgId));

    nsCString junkFolderURI;
    rv = GetSpamFolderURI(getter_Copies(junkFolderURI));
    NS_ENSURE_SUCCESS(rv, rv);

    NS_ConvertASCIItoUTF16 msgIdValue(msgId);
    NS_ConvertASCIItoUTF16 junkFolderURIValue(junkFolderURI);

    const PRUnichar *logMoveFormatStrings[2] = { msgIdValue.get(), junkFolderURIValue.get() };
    nsString logMoveStr;
    rv = bundle->FormatStringFromName(
      NS_LITERAL_STRING("logMoveStr").get(),
      logMoveFormatStrings, 2,
      getter_Copies(logMoveStr));
    NS_ENSURE_SUCCESS(rv, rv);

    buffer += NS_ConvertUTF16toUTF8(logMoveStr);
    buffer += "\n";
  }

  return LogJunkString(buffer.get());
}

NS_IMETHODIMP nsSpamSettings::LogJunkString(const char *string)
{
  PRBool loggingEnabled;
  nsresult rv = GetLoggingEnabled(&loggingEnabled);
  NS_ENSURE_SUCCESS(rv,rv);

  if (!loggingEnabled)
    return NS_OK;

  nsCOMPtr <nsIOutputStream> logStream;
  rv = GetLogStream(getter_AddRefs(logStream));
  NS_ENSURE_SUCCESS(rv,rv);

  PRUint32 writeCount;

  rv = logStream->Write(LOG_ENTRY_START_TAG, LOG_ENTRY_START_TAG_LEN, &writeCount);
  NS_ENSURE_SUCCESS(rv,rv);
  NS_ASSERTION(writeCount == LOG_ENTRY_START_TAG_LEN, "failed to write out start log tag");

  // html escape the log for security reasons.
  // we don't want some to send us a message with a subject with
  // html tags, especially <script>
  char *escapedBuffer = MsgEscapeHTML(string);
  if (!escapedBuffer)
    return NS_ERROR_OUT_OF_MEMORY;

  PRUint32 escapedBufferLen = strlen(escapedBuffer);
  rv = logStream->Write(escapedBuffer, escapedBufferLen, &writeCount);
  PR_Free(escapedBuffer);
  NS_ENSURE_SUCCESS(rv,rv);
  NS_ASSERTION(writeCount == escapedBufferLen, "failed to write out log hit");

  rv = logStream->Write(LOG_ENTRY_END_TAG, LOG_ENTRY_END_TAG_LEN, &writeCount);
  NS_ENSURE_SUCCESS(rv,rv);
  NS_ASSERTION(writeCount == LOG_ENTRY_END_TAG_LEN, "failed to write out end log tag");
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::OnStartRunningUrl(nsIURI* aURL)
{
  // do nothing
  // all the action happens in OnStopRunningUrl()
  return NS_OK;
}

NS_IMETHODIMP nsSpamSettings::OnStopRunningUrl(nsIURI* aURL, nsresult exitCode)
{
  nsCString junkFolderURI;
  nsresult rv = GetSpamFolderURI(getter_Copies(junkFolderURI));
  NS_ENSURE_SUCCESS(rv,rv);

  if (junkFolderURI.IsEmpty())
    return NS_ERROR_UNEXPECTED;

  // when we get here, the folder should exist.
  nsCOMPtr <nsIMsgFolder> junkFolder;
  rv = GetExistingFolder(junkFolderURI, getter_AddRefs(junkFolder));
  NS_ENSURE_SUCCESS(rv,rv);
  if (!junkFolder)
    return NS_ERROR_UNEXPECTED;

  rv = junkFolder->SetFlag(nsMsgFolderFlags::Junk);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

NS_IMETHODIMP nsSpamSettings::CheckWhiteList(nsIMsgDBHdr *aMsgHdr, PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aMsgHdr);
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = PR_FALSE;  // default in case of error or no whitelisting

  if (!mUseWhiteList || (!mWhiteListDirArray.Count() &&
                          mTrustedMailDomains.IsEmpty()))
    return NS_OK;

  // do per-message processing

  nsCString author;
  aMsgHdr->GetAuthor(getter_Copies(author));
  nsresult rv;
  nsCOMPtr<nsIMsgHeaderParser> headerParser =
    do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString authorEmailAddress;
  rv = headerParser->ExtractHeaderAddressMailboxes(author, authorEmailAddress);
  NS_ENSURE_SUCCESS(rv, rv);

  if (authorEmailAddress.IsEmpty())
    return NS_OK;

  // should we skip whitelisting for the identity email?
  if (mInhibitWhiteListingIdentityUser)
  {
    for (PRUint32 i = 0; i < mEmails.Length(); ++i)
    {
#ifdef MOZILLA_INTERNAL_API
      if (mEmails[i].Equals(authorEmailAddress, nsCaseInsensitiveCStringComparator()))
        return NS_OK;
#else
      if (mEmails[i].Equals(authorEmailAddress, CaseInsensitiveCompare))
        return NS_OK;
#endif
    }
  }

  if (!mTrustedMailDomains.IsEmpty() || mInhibitWhiteListingIdentityDomain)
  {
    nsCAutoString domain;
    PRInt32 atPos = authorEmailAddress.FindChar('@');
    if (atPos >= 0)
      domain = Substring(authorEmailAddress, atPos + 1);
    if (!domain.IsEmpty())
    {
      if (!mTrustedMailDomains.IsEmpty() &&
          MsgHostDomainIsTrusted(domain, mTrustedMailDomains))
      {
        *aResult = PR_TRUE;
        return NS_OK;
      }

      if (mInhibitWhiteListingIdentityDomain)
      {
        for (PRUint32 i = 0; i < mEmails.Length(); ++i)
        {
          nsCAutoString identityDomain;
          PRInt32 atPos = mEmails[i].FindChar('@');
          if (atPos >= 0)
          {
            identityDomain = Substring(mEmails[i], atPos + 1);
#ifdef MOZILLA_INTERNAL_API
            if (identityDomain.Equals(domain, nsCaseInsensitiveCStringComparator()))
              return NS_OK; // don't whitelist
#else
            if (identityDomain.Equals(domain, CaseInsensitiveCompare))
              return NS_OK;
#endif
          }
        }
      }
    }
  }

  if (mWhiteListDirArray.Count())
  {
    nsCOMPtr<nsIAbCard> cardForAddress;
    for (PRInt32 index = 0;
         index < mWhiteListDirArray.Count() && !cardForAddress;
         index++)
    {
      mWhiteListDirArray[index]->CardForEmailAddress(authorEmailAddress,
                                                     getter_AddRefs(cardForAddress));
    }
    if (cardForAddress)
    {
      *aResult = PR_TRUE;
      return NS_OK;
    }
  }
  return NS_OK; // default return is false
}
