/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include <stdio.h>
#include "TestHarness.h"
#include "nsCOMPtr.h"
#include "msgCore.h"
#include "nsImapProtocol.h"
#include "nsMsgMessageFlags.h"

struct msgState {
  uint32_t uid;
  uint16_t flag;
  uint32_t index;
};

char errorMsg[200];

const char * MainChecks(nsImapFlagAndUidState* flagState, struct msgState *expectedState,
               uint32_t numMessages, uint32_t expectedNumUnread)
{
  // Verify that flag state matches the expected state.
  for (uint32_t i = 0; i < numMessages; i ++)
  {
    uint32_t uid;
    uint16_t flag;
    flagState->GetUidOfMessage(expectedState[i].index, &uid);
    flagState->GetMessageFlags(expectedState[i].index, &flag);
    if (uid != expectedState[i].uid)
    {
      PR_snprintf(errorMsg, sizeof(errorMsg),
                  "expected uid %d, got %d at index %d\n", expectedState[i].uid,
                  uid, i);
      return errorMsg;
    }
    if (flag != expectedState[i].flag)
    {
      PR_snprintf(errorMsg, sizeof(errorMsg),
                  "expected flag %d, got %d at index %d\n", expectedState[i].flag,
                  flag, i);
      return errorMsg;
    }
  }
  int32_t numMsgsInFlagState;
  int32_t numUnread = 0;
  int32_t expectedMsgIndex = 0;

  flagState->GetNumberOfMessages(&numMsgsInFlagState);
  for (int32_t msgIndex = 0; msgIndex < numMsgsInFlagState; msgIndex++)
  {
    uint32_t uidOfMessage;
    flagState->GetUidOfMessage(msgIndex, &uidOfMessage);
    if (!uidOfMessage || uidOfMessage == nsMsgKey_None)
      continue;
    if (uidOfMessage != expectedState[expectedMsgIndex++].uid)
    {
      PR_snprintf(errorMsg, sizeof(errorMsg),
                  "got a uid w/o a match in expected state, uid %d at index %d\n",
                  uidOfMessage, msgIndex);
      return errorMsg;
    }
    imapMessageFlagsType flags;
    flagState->GetMessageFlags(msgIndex, &flags);
    if (! (flags & kImapMsgSeenFlag))
      numUnread++;
  }
  if (numUnread != expectedNumUnread)
  {
      PR_snprintf(errorMsg, sizeof(errorMsg),
                  "expected %d unread message, got %d\n", expectedNumUnread,
                  numUnread);
      return errorMsg;
  }
  return nullptr;
}

// General note about return values:
// return 1 for a setup or xpcom type failure, return 2 for a real test failure
int main(int argc, char** argv)
{
  ScopedXPCOM xpcom("TestImapFlagAndUidState.cpp");
  if (xpcom.failed())
    return 1;

  struct msgState msgState1[] = {
  {10, kImapMsgSeenFlag, 0},
  {15, kImapMsgSeenFlag, 1},
  {16, kImapMsgSeenFlag, 2},
  {17, kImapMsgSeenFlag, 3},
  {18, kImapMsgSeenFlag, 4}};

  nsRefPtr<nsImapFlagAndUidState> flagState = new nsImapFlagAndUidState(10);
  int32_t numMsgs = sizeof(msgState1) / sizeof(msgState1[0]);
  for (int32_t i = 0; i < numMsgs; i++)
        flagState->AddUidFlagPair(msgState1[i].uid, msgState1[i].flag,
                                  msgState1[i].index);

  const char * error = MainChecks(flagState, msgState1, numMsgs, 0);
  if (error)
  {
    printf("TEST-UNEXPECTED-FAIL | %s | %s\n", __FILE__, error);
    return 1;
  }

  // Now reset all
  flagState->Reset();

  // This tests adding some messages to a partial uid flag state,
  // i.e., CONDSTORE.
  struct msgState msgState2[] = {
    {68, kImapMsgSeenFlag, 69},
    {71, kImapMsgSeenFlag, 70},
    {73, kImapMsgSeenFlag, 71}};
  numMsgs = sizeof(msgState2) / sizeof(msgState2[0]);
  for (int32_t i = 0; i < numMsgs; i++)
    flagState->AddUidFlagPair(msgState2[i].uid, msgState2[i].flag,
                              msgState2[i].index);
  error = MainChecks(flagState, msgState2, numMsgs, 0);
  if (error)
  {
    printf("TEST-UNEXPECTED-FAIL | %s | %s\n", __FILE__, error);
    return 1;
  }
  // Reset all
  flagState->Reset();
  // This tests generating a uid string from a non-sequential set of
  // messages where the first message is not in the flag state, but the
  // missing message from the sequence is in the set. I.e., we're
  // generating a uid string from 69,71, but only 70 and 71 are in
  // the flag state.
  struct msgState msgState3[] = {
    {10, kImapMsgSeenFlag, 0},
    {69, kImapMsgSeenFlag, 1},
    {70, kImapMsgSeenFlag, 2},
    {71, kImapMsgSeenFlag, 3}};

  flagState->SetPartialUIDFetch(false);
  numMsgs = sizeof(msgState3) / sizeof(msgState3[0]);
  for (int32_t i = 0; i < numMsgs; i++)
    flagState->AddUidFlagPair(msgState3[i].uid, msgState3[i].flag,
                              msgState3[i].index);
  flagState->ExpungeByIndex(2);
  nsCString uidString;
  uint32_t msgUids[] = {69,71};
  uint32_t msgCount = 2;
  AllocateImapUidString(&msgUids[0], msgCount, flagState, uidString);
  if (!uidString.EqualsLiteral("71"))
  {
    printf("TEST-UNEXPECTED-FAIL | uid String is %s, not 71 | %s\n", uidString.get(), __FILE__);
    return -1;
  }
  // Reset all
  flagState->Reset();
  // This tests the middle message missing from the flag state.
  struct msgState msgState4[] = {
    {10, kImapMsgSeenFlag, 0},
    {69, kImapMsgSeenFlag, 1},
    {70, kImapMsgSeenFlag, 2},
    {71, kImapMsgSeenFlag, 3},
    {73, kImapMsgSeenFlag, 4}};

  flagState->SetPartialUIDFetch(false);
  numMsgs = sizeof(msgState4) / sizeof(msgState4[0]);
  for (int32_t i = 0; i < numMsgs; i++)
    flagState->AddUidFlagPair(msgState4[i].uid, msgState4[i].flag,
                              msgState4[i].index);
  flagState->ExpungeByIndex(4);
  uint32_t msgUids2[] = {69,71,73};
  msgCount = 3;
  nsCString uidString2;

  AllocateImapUidString(&msgUids2[0], msgCount, flagState, uidString2);
  if (!uidString2.EqualsLiteral("69,73"))
  {
    printf("TEST-UNEXPECTED-FAIL | uid String is %s, not 71 | %s\n", uidString.get(), __FILE__);
    return -1;
  }

  printf("TEST-PASS | %s | all tests passed\n", __FILE__);
  return 0;
}
