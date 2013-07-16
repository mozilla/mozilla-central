/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsImapUtils.h"
#include "nsCOMPtr.h"
#include "nsIServiceManager.h"
#include "prsystem.h"
#include "prprf.h"
#include "nsNetCID.h"

// stuff for temporary root folder hack
#include "nsIMsgAccountManager.h"
#include "nsIMsgIncomingServer.h"
#include "nsIImapIncomingServer.h"
#include "nsMsgBaseCID.h"
#include "nsImapCore.h"
#include "nsMsgUtils.h"
#include "nsImapFlagAndUidState.h"
#include "nsISupportsObsolete.h"
#include "nsIMAPNamespace.h"
#include "nsIImapFlagAndUidState.h"

nsresult
nsImapURI2FullName(const char* rootURI, const char* hostName, const char* uriStr,
                   char **name)
{
    nsAutoCString uri(uriStr);
    nsAutoCString fullName;
    if (uri.Find(rootURI) != 0)
      return NS_ERROR_FAILURE;
    fullName = Substring(uri, strlen(rootURI));
    uri = fullName;
    int32_t hostStart = uri.Find(hostName);
    if (hostStart <= 0) 
      return NS_ERROR_FAILURE;
    fullName = Substring(uri, hostStart);
    uri = fullName;
    int32_t hostEnd = uri.FindChar('/');
    if (hostEnd <= 0) 
      return NS_ERROR_FAILURE;
    fullName = Substring(uri, hostEnd + 1);
    if (fullName.IsEmpty())
      return NS_ERROR_FAILURE;
    *name = ToNewCString(fullName);
    return NS_OK;
}

/* parses ImapMessageURI */
nsresult nsParseImapMessageURI(const char* uri, nsCString& folderURI, uint32_t *key, char **part)
{
  if(!key)
    return NS_ERROR_NULL_POINTER;

  nsAutoCString uriStr(uri);
  int32_t folderEnd = -1;
  // imap-message uri's can have imap:// url strings tacked on the end,
  // e.g., when opening/saving attachments. We don't want to look for '#'
  // in that part of the uri, if the attachment name contains '#',
  // so check for that here.
  if (StringBeginsWith(uriStr, NS_LITERAL_CSTRING("imap-message")))
    folderEnd = uriStr.Find("imap://");

  int32_t keySeparator = MsgRFindChar(uriStr, '#', folderEnd);
  if(keySeparator != -1)
  {
    int32_t keyEndSeparator = MsgFindCharInSet(uriStr, "/?&", keySeparator);
    nsAutoString folderPath;
    folderURI = StringHead(uriStr, keySeparator);
    folderURI.Cut(4, 8); // cut out the _message part of imap-message:
    // folder uri's don't have fully escaped usernames.
    int32_t atPos = folderURI.FindChar('@');
    if (atPos != -1)
    {
      nsCString unescapedName, escapedName;
      int32_t userNamePos = folderURI.Find("//") + 2;
      uint32_t origUserNameLen = atPos - userNamePos;
      if (NS_SUCCEEDED(MsgUnescapeString(Substring(folderURI, userNamePos,
                                                   origUserNameLen),
                                         0, unescapedName)))
      {
        // Re-escape the username, matching the way we do it in uris, not the
        // way necko escapes urls. See nsMsgIncomingServer::GetServerURI.
        MsgEscapeString(unescapedName, nsINetUtil::ESCAPE_XALPHAS, escapedName);
        folderURI.Replace(userNamePos, origUserNameLen, escapedName);
      }
    }
    nsAutoCString keyStr;
    if (keyEndSeparator != -1)
      keyStr = Substring(uriStr, keySeparator + 1, keyEndSeparator - (keySeparator + 1));
    else
      keyStr = Substring(uriStr, keySeparator + 1);

    *key = strtoul(keyStr.get(), nullptr, 10);

    if (part && keyEndSeparator != -1)
    {
      int32_t partPos = MsgFind(uriStr, "part=", false, keyEndSeparator);
      if (partPos != -1)
      {
        *part = ToNewCString(Substring(uriStr, keyEndSeparator));
      }
    }
  }
  return NS_OK;
}

nsresult nsBuildImapMessageURI(const char *baseURI, uint32_t key, nsCString& uri)
{
  uri.Append(baseURI);
  uri.Append('#');
  uri.AppendInt(key);
  return NS_OK;
}

nsresult nsCreateImapBaseMessageURI(const nsACString& baseURI, nsCString &baseMessageURI)
{
  nsAutoCString tailURI(baseURI);
  // chop off imap:/
  if (tailURI.Find(kImapRootURI) == 0)
    tailURI.Cut(0, PL_strlen(kImapRootURI));
  baseMessageURI = kImapMessageRootURI;
  baseMessageURI += tailURI;
  return NS_OK;
}

// nsImapMailboxSpec definition
NS_IMPL_ISUPPORTS1(nsImapMailboxSpec, nsIMailboxSpec)

nsImapMailboxSpec::nsImapMailboxSpec()
{
  mFolder_UIDVALIDITY = 0;
  mHighestModSeq = 0;
  mNumOfMessages = 0;
  mNumOfUnseenMessages = 0;
  mNumOfRecentMessages = 0;
  mNextUID = 0;
  
  mBoxFlags = 0;
  mSupportedUserFlags = 0;
  
  mHierarchySeparator = '\0';
  
  mFolderSelected = false;
  mDiscoveredFromLsub = false;
  
  mOnlineVerified = false;
  mNamespaceForFolder = nullptr;
}

nsImapMailboxSpec::~nsImapMailboxSpec()
{
}

NS_IMPL_GETSET(nsImapMailboxSpec, Folder_UIDVALIDITY, int32_t, mFolder_UIDVALIDITY)
NS_IMPL_GETSET(nsImapMailboxSpec, HighestModSeq, uint64_t, mHighestModSeq)
NS_IMPL_GETSET(nsImapMailboxSpec, NumMessages, int32_t, mNumOfMessages)
NS_IMPL_GETSET(nsImapMailboxSpec, NumUnseenMessages, int32_t, mNumOfUnseenMessages)
NS_IMPL_GETSET(nsImapMailboxSpec, NumRecentMessages, int32_t, mNumOfRecentMessages)
NS_IMPL_GETSET(nsImapMailboxSpec, NextUID, int32_t, mNextUID)
NS_IMPL_GETSET(nsImapMailboxSpec, HierarchyDelimiter, char, mHierarchySeparator)
NS_IMPL_GETSET(nsImapMailboxSpec, FolderSelected, bool, mFolderSelected)
NS_IMPL_GETSET(nsImapMailboxSpec, DiscoveredFromLsub, bool, mDiscoveredFromLsub)
NS_IMPL_GETSET(nsImapMailboxSpec, OnlineVerified, bool, mOnlineVerified)
NS_IMPL_GETSET(nsImapMailboxSpec, SupportedUserFlags, uint32_t, mSupportedUserFlags)
NS_IMPL_GETSET(nsImapMailboxSpec, Box_flags, uint32_t, mBoxFlags)
NS_IMPL_GETSET(nsImapMailboxSpec, NamespaceForFolder, nsIMAPNamespace *, mNamespaceForFolder)

NS_IMETHODIMP nsImapMailboxSpec::GetAllocatedPathName(nsACString &aAllocatedPathName)
{
  aAllocatedPathName = mAllocatedPathName;
  return NS_OK;
} 

NS_IMETHODIMP nsImapMailboxSpec::SetAllocatedPathName(const nsACString &aAllocatedPathName)
{
  mAllocatedPathName = aAllocatedPathName;
  return NS_OK;
} 

NS_IMETHODIMP nsImapMailboxSpec::GetUnicharPathName(nsAString &aUnicharPathName)
{
  aUnicharPathName = aUnicharPathName;
  return NS_OK;
} 

NS_IMETHODIMP nsImapMailboxSpec::SetUnicharPathName(const nsAString &aUnicharPathName)
{
  mUnicharPathName = aUnicharPathName;
  return NS_OK;
} 

NS_IMETHODIMP nsImapMailboxSpec::GetHostName(nsACString &aHostName)
{
  aHostName = mHostName;
  return NS_OK;
} 

NS_IMETHODIMP nsImapMailboxSpec::SetHostName(const nsACString &aHostName)
{
  mHostName = aHostName;
  return NS_OK;
} 

NS_IMETHODIMP nsImapMailboxSpec::GetFlagState(nsIImapFlagAndUidState ** aFlagState)
{
  NS_ENSURE_ARG_POINTER(aFlagState);
  NS_IF_ADDREF(*aFlagState = mFlagState);
  return NS_OK;
}

NS_IMETHODIMP nsImapMailboxSpec::SetFlagState(nsIImapFlagAndUidState * aFlagState)
{
  NS_ENSURE_ARG_POINTER(aFlagState);
  mFlagState = aFlagState;
  return NS_OK;
}

nsImapMailboxSpec& nsImapMailboxSpec::operator= (const nsImapMailboxSpec& aCopy) 
{
  mFolder_UIDVALIDITY = aCopy.mFolder_UIDVALIDITY;
  mHighestModSeq = aCopy.mHighestModSeq;
  mNumOfMessages = aCopy.mNumOfMessages;
  mNumOfUnseenMessages = aCopy.mNumOfUnseenMessages;
  mNumOfRecentMessages = aCopy.mNumOfRecentMessages;
	
  mBoxFlags = aCopy.mBoxFlags;
  mSupportedUserFlags = aCopy.mSupportedUserFlags;
  
  mAllocatedPathName.Assign(aCopy.mAllocatedPathName);
  mUnicharPathName.Assign(aCopy.mUnicharPathName);
  mHierarchySeparator = mHierarchySeparator;
  mHostName.Assign(aCopy.mHostName);
	
  mFlagState = aCopy.mFlagState;
  mNamespaceForFolder = aCopy.mNamespaceForFolder;
	
  mFolderSelected = aCopy.mFolderSelected;
  mDiscoveredFromLsub = aCopy.mDiscoveredFromLsub;

  mOnlineVerified = aCopy.mOnlineVerified;
  
  return *this;
}

// use the flagState to determine if the gaps in the msgUids correspond to gaps in the mailbox,
// in which case we can still use ranges. If flagState is null, we won't do this.
void AllocateImapUidString(uint32_t *msgUids, uint32_t &msgCount, 
                           nsImapFlagAndUidState *flagState, nsCString &returnString)
{
  uint32_t startSequence = (msgCount > 0) ? msgUids[0] : 0xFFFFFFFF;
  uint32_t curSequenceEnd = startSequence;
  uint32_t total = msgCount;
  int32_t  curFlagStateIndex = -1;

  // a partial fetch flag state doesn't help us, so don't use it.
  if (flagState && flagState->GetPartialUIDFetch())
    flagState = nullptr;

  
  for (uint32_t keyIndex = 0; keyIndex < total; keyIndex++)
  {
    uint32_t curKey = msgUids[keyIndex];
    uint32_t nextKey = (keyIndex + 1 < total) ? msgUids[keyIndex + 1] : 0xFFFFFFFF;
    bool lastKey = (nextKey == 0xFFFFFFFF);

    if (lastKey)
      curSequenceEnd = curKey;

    if (!lastKey)
    {
      if (nextKey == curSequenceEnd + 1)
      {
        curSequenceEnd = nextKey;
        curFlagStateIndex++;
        continue;
      }
      if (flagState)
      {
        if (curFlagStateIndex == -1)
        {
          bool foundIt;
          flagState->GetMessageFlagsFromUID(curSequenceEnd, &foundIt, &curFlagStateIndex);
          if (!foundIt)
          {
            NS_WARNING("flag state missing key");
            // The start of this sequence is missing from flag state, so move
            // on to the next key.
            curFlagStateIndex = -1;
            curSequenceEnd = startSequence = nextKey;
            continue;
          }
        }
        curFlagStateIndex++;
        uint32_t nextUidInFlagState;
        nsresult rv = flagState->GetUidOfMessage(curFlagStateIndex, &nextUidInFlagState);
        if (NS_SUCCEEDED(rv) && nextUidInFlagState == nextKey)
        {
          curSequenceEnd = nextKey;
          continue;
        }
      }
    }
    if (curSequenceEnd > startSequence)
    {
      returnString.AppendInt((int64_t) startSequence);
      returnString += ':';
      returnString.AppendInt((int64_t) curSequenceEnd);
      startSequence = nextKey;
      curSequenceEnd = startSequence;
      curFlagStateIndex = -1;
    }
    else
    {
      startSequence = nextKey;
      curSequenceEnd = startSequence;
      returnString.AppendInt((int64_t) msgUids[keyIndex]);
      curFlagStateIndex = -1;
    }
    // check if we've generated too long a string - if there's no flag state,
    // it means we just need to go ahead and generate a too long string
    // because the calling code won't handle breaking up the strings.
    if (flagState && returnString.Length() > 950) 
    {
      msgCount = keyIndex;
      break;
    }
    // If we are not the last item then we need to add the comma 
    // but it's important we do it here, after the length check 
    if (!lastKey) 
      returnString += ','; 
  }
}

void ParseUidString(const char *uidString, nsTArray<nsMsgKey> &keys)
{
  // This is in the form <id>,<id>, or <id1>:<id2>
  char curChar = *uidString;
  bool isRange = false;
  uint32_t curToken;
  uint32_t saveStartToken = 0;

  for (const char *curCharPtr = uidString; curChar && *curCharPtr;)
  {
    const char *currentKeyToken = curCharPtr;
    curChar = *curCharPtr;
    while (curChar != ':' && curChar != ',' && curChar != '\0')
      curChar = *curCharPtr++;

    // we don't need to null terminate currentKeyToken because strtoul
    // stops at non-numeric chars.
    curToken = strtoul(currentKeyToken, nullptr, 10);
    if (isRange)
    {
      while (saveStartToken < curToken)
        keys.AppendElement(saveStartToken++);
    }
    keys.AppendElement(curToken);
    isRange = (curChar == ':');
    if (isRange)
      saveStartToken = curToken + 1;
  }
}

void AppendUid(nsCString &msgIds, uint32_t uid)
{
  char buf[20];
  PR_snprintf(buf, sizeof(buf), "%u", uid);
  msgIds.Append(buf);
}
