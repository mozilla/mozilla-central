/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"  // for pre-compiled headers

#include "nsImapCore.h"
#include "nsImapFlagAndUidState.h"
#include "prcmon.h"
#include "nspr.h"

NS_IMPL_ISUPPORTS1(nsImapFlagAndUidState, nsIImapFlagAndUidState)

using namespace mozilla;

NS_IMETHODIMP nsImapFlagAndUidState::GetNumberOfMessages(int32_t *result)
{
  if (!result)
    return NS_ERROR_NULL_POINTER;
  *result = fUids.Length();
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::GetUidOfMessage(int32_t zeroBasedIndex, uint32_t *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  PR_CEnterMonitor(this);
  *aResult = fUids.SafeElementAt(zeroBasedIndex, nsMsgKey_None);
  PR_CExitMonitor(this);
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::GetMessageFlags(int32_t zeroBasedIndex, uint16_t *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = fFlags.SafeElementAt(zeroBasedIndex, kNoImapMsgFlag);
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::SetMessageFlags(int32_t zeroBasedIndex, unsigned short flags)
{
  if (zeroBasedIndex < fUids.Length())
    fFlags[zeroBasedIndex] = flags;
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::GetNumberOfRecentMessages(int32_t *result)
{
  if (!result)
    return NS_ERROR_NULL_POINTER;
  
  PR_CEnterMonitor(this);
  uint32_t counter = 0;
  int32_t numUnseenMessages = 0;
  
  for (counter = 0; counter < fUids.Length(); counter++)
  {
    if (fFlags[counter] & kImapMsgRecentFlag)
      numUnseenMessages++;
  }
  PR_CExitMonitor(this);
  
  *result = numUnseenMessages;
  
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::GetPartialUIDFetch(bool *aPartialUIDFetch)
{
  NS_ENSURE_ARG_POINTER(aPartialUIDFetch);
  *aPartialUIDFetch = fPartialUIDFetch;
  return NS_OK;
}

/* amount to expand for imap entry flags when we need more */

nsImapFlagAndUidState::nsImapFlagAndUidState(int32_t numberOfMessages)
  : fUids(numberOfMessages),
    fFlags(numberOfMessages),
    m_customFlagsHash(10),
    m_customAttributesHash(10),
    mLock("nsImapFlagAndUidState.mLock")
{
  fSupportedUserFlags = 0;
  fNumberDeleted = 0;
  fPartialUIDFetch = true;
}

/* static */PLDHashOperator nsImapFlagAndUidState::FreeCustomFlags(const uint32_t &aKey, char *aData,
                                        void *closure)
{
  PR_Free(aData);
  return PL_DHASH_NEXT;
}

nsImapFlagAndUidState::~nsImapFlagAndUidState()
{
  m_customFlagsHash.EnumerateRead(FreeCustomFlags, nullptr);
}

NS_IMETHODIMP
nsImapFlagAndUidState::OrSupportedUserFlags(uint16_t flags)
{
  fSupportedUserFlags |= flags;
  return NS_OK;
}

NS_IMETHODIMP
nsImapFlagAndUidState::GetSupportedUserFlags(uint16_t *aFlags)
{
  NS_ENSURE_ARG_POINTER(aFlags);
  *aFlags = fSupportedUserFlags;
  return NS_OK;
}

// we need to reset our flags, (re-read all) but chances are the memory allocation needed will be
// very close to what we were already using

NS_IMETHODIMP nsImapFlagAndUidState::Reset()
{
  PR_CEnterMonitor(this);
  fNumberDeleted = 0;
  m_customFlagsHash.EnumerateRead(FreeCustomFlags, nullptr);
  m_customFlagsHash.Clear();
  fUids.Clear();
  fFlags.Clear();
  fPartialUIDFetch = true;
  PR_CExitMonitor(this);
  return NS_OK;
}


// Remove (expunge) a message from our array, since now it is gone for good

NS_IMETHODIMP nsImapFlagAndUidState::ExpungeByIndex(uint32_t msgIndex)
{
  // protect ourselves in case the server gave us an index key of -1 or 0
  if ((int32_t) msgIndex <= 0)
    return NS_ERROR_INVALID_ARG;

  if ((uint32_t) fUids.Length() < msgIndex)
    return NS_ERROR_INVALID_ARG;

  PR_CEnterMonitor(this);
  msgIndex--;  // msgIndex is 1-relative
  if (fFlags[msgIndex] & kImapMsgDeletedFlag) // see if we already had counted this one as deleted
    fNumberDeleted--;
  fUids.RemoveElementAt(msgIndex);
  fFlags.RemoveElementAt(msgIndex);
  PR_CExitMonitor(this);
  return NS_OK;
}


// adds to sorted list, protects against duplicates and going past array bounds.
NS_IMETHODIMP nsImapFlagAndUidState::AddUidFlagPair(uint32_t uid, imapMessageFlagsType flags, uint32_t zeroBasedIndex)
{
  if (uid == nsMsgKey_None) // ignore uid of -1
    return NS_OK;
  // check for potential overflow in buffer size for uid array
  if (zeroBasedIndex > 0x3FFFFFFF)
    return NS_ERROR_INVALID_ARG;
  PR_CEnterMonitor(this);
  // make sure there is room for this pair
  if (zeroBasedIndex >= fUids.Length())
  {
    int32_t sizeToGrowBy = zeroBasedIndex - fUids.Length() + 1;
    fUids.InsertElementsAt(fUids.Length(), sizeToGrowBy, 0);
    fFlags.InsertElementsAt(fFlags.Length(), sizeToGrowBy, 0);
  }

  fUids[zeroBasedIndex] = uid;
  fFlags[zeroBasedIndex] = flags;
  if (flags & kImapMsgDeletedFlag)
    fNumberDeleted++;
  PR_CExitMonitor(this);
  return NS_OK;
}


NS_IMETHODIMP nsImapFlagAndUidState::GetNumberOfDeletedMessages(int32_t *numDeletedMessages)
{
  NS_ENSURE_ARG_POINTER(numDeletedMessages);
  *numDeletedMessages = NumberOfDeletedMessages();
  return NS_OK;
}

int32_t nsImapFlagAndUidState::NumberOfDeletedMessages()
{
  return fNumberDeleted;
}
	
// since the uids are sorted, start from the back (rb)

uint32_t  nsImapFlagAndUidState::GetHighestNonDeletedUID()
{
  uint32_t msgIndex = fUids.Length();
  do 
  {
    if (msgIndex <= 0)
      return(0);
    msgIndex--;
    if (fUids[msgIndex] && !(fFlags[msgIndex] & kImapMsgDeletedFlag))
      return fUids[msgIndex];
  }
  while (msgIndex > 0);
  return 0;
}


// Has the user read the last message here ? Used when we first open the inbox to see if there
// really is new mail there.

bool nsImapFlagAndUidState::IsLastMessageUnseen()
{
  uint32_t msgIndex = fUids.Length();
  
  if (msgIndex <= 0)
    return false;
  msgIndex--;
  // if last message is deleted, it was probably filtered the last time around
  if (fUids[msgIndex] && (fFlags[msgIndex] & (kImapMsgSeenFlag | kImapMsgDeletedFlag)))
    return false;
  return true; 
}

// find a message flag given a key with non-recursive binary search, since some folders
// may have thousand of messages, once we find the key set its index, or the index of
// where the key should be inserted

imapMessageFlagsType nsImapFlagAndUidState::GetMessageFlagsFromUID(uint32_t uid, bool *foundIt, int32_t *ndx)
{
  PR_CEnterMonitor(this);
  *ndx = (int32_t) fUids.IndexOfFirstElementGt(uid) - 1;
  *foundIt = *ndx >= 0 && fUids[*ndx] == uid;
  imapMessageFlagsType retFlags = (*foundIt) ? fFlags[*ndx] : kNoImapMsgFlag;
  PR_CExitMonitor(this);
  return retFlags;
}

NS_IMETHODIMP nsImapFlagAndUidState::AddUidCustomFlagPair(uint32_t uid, const char *customFlag)
{
  MutexAutoLock mon(mLock);
  char *ourCustomFlags;
  char *oldValue = nullptr;
  m_customFlagsHash.Get(uid, &oldValue);
  if (oldValue)
  {
  // we'll store multiple keys as space-delimited since space is not
  // a valid character in a keyword. First, we need to look for the
    // customFlag in the existing flags;
    char *existingCustomFlagPtr = PL_strstr(oldValue, customFlag);
    uint32_t customFlagLen = strlen(customFlag);
    while (existingCustomFlagPtr)
    {
      // if existing flags ends with this exact flag, or flag + ' ', we have this flag already;
      if (strlen(existingCustomFlagPtr) == customFlagLen || existingCustomFlagPtr[customFlagLen] == ' ')
        return NS_OK;
      // else, advance to next flag
      existingCustomFlagPtr = PL_strstr(existingCustomFlagPtr + 1, customFlag);
    }
    ourCustomFlags = (char *) PR_Malloc(strlen(oldValue) + customFlagLen + 2);
    strcpy(ourCustomFlags, oldValue);
    strcat(ourCustomFlags, " ");
    strcat(ourCustomFlags, customFlag);
    PR_Free(oldValue);
    m_customFlagsHash.Remove(uid);
  }
  else
  {
    ourCustomFlags = NS_strdup(customFlag);
    if (!ourCustomFlags)
      return NS_ERROR_OUT_OF_MEMORY;
  }
  m_customFlagsHash.Put(uid, ourCustomFlags);
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::GetCustomFlags(uint32_t uid, char **customFlags)
{
  MutexAutoLock mon(mLock);
  char *value = nullptr;
  m_customFlagsHash.Get(uid, &value);
  if (value)
  {
    *customFlags = NS_strdup(value);
    return (*customFlags) ? NS_OK : NS_ERROR_FAILURE;
  }
  *customFlags = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::ClearCustomFlags(uint32_t uid)
{
  MutexAutoLock mon(mLock);
  m_customFlagsHash.Remove(uid);
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::SetCustomAttribute(uint32_t aUid,
                                                        const nsACString &aCustomAttributeName,
                                                        const nsACString &aCustomAttributeValue)
{
  nsCString key;
  key.AppendInt((int64_t)aUid);
  key.Append(aCustomAttributeName);
  nsCString value;
  value.Assign(aCustomAttributeValue);
  m_customAttributesHash.Put(key, value);
  return NS_OK;
}

NS_IMETHODIMP nsImapFlagAndUidState::GetCustomAttribute(uint32_t aUid,
                                                        const nsACString &aCustomAttributeName,
                                                        nsACString &aCustomAttributeValue)
{
  nsCString key;
  key.AppendInt((int64_t)aUid);
  key.Append(aCustomAttributeName);
  nsCString val;
  m_customAttributesHash.Get(key, &val);
  aCustomAttributeValue.Assign(val);
  return NS_OK;
}
