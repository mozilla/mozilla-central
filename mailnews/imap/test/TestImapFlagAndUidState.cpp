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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@mozillamessaging.com>
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
#include <stdio.h>
#include "TestHarness.h"
#include "nsCOMPtr.h"
#include "msgCore.h"
#include "nsImapProtocol.h"
#include "nsMsgMessageFlags.h"

struct msgState {
  PRUint32 uid;
  PRUint16 flag;
  PRUint32 index;
};

char errorMsg[200];

const char * MainChecks(nsImapFlagAndUidState* flagState, struct msgState *expectedState,
               PRUint32 numMessages, PRUint32 expectedNumUnread)
{
  // Verify that flag state matches the expected state.
  for (PRUint32 i = 0; i < numMessages; i ++)
  {
    PRUint32 uid;
    PRUint16 flag;
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
  PRInt32 numMsgsInFlagState;
  PRInt32 numUnread = 0;
  PRInt32 expectedMsgIndex = 0;

  flagState->GetNumberOfMessages(&numMsgsInFlagState);
  for (PRInt32 msgIndex = 0; msgIndex < numMsgsInFlagState; msgIndex++)
  {
    PRUint32 uidOfMessage;
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
  return nsnull;
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
  PRInt32 numMsgs = sizeof(msgState1) / sizeof(msgState1[0]);
  for (PRInt32 i = 0; i < numMsgs; i++)
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
  for (PRInt32 i = 0; i < numMsgs; i++)
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

  flagState->SetPartialUIDFetch(PR_FALSE);
  numMsgs = sizeof(msgState3) / sizeof(msgState3[0]);
  for (PRInt32 i = 0; i < numMsgs; i++)
    flagState->AddUidFlagPair(msgState3[i].uid, msgState3[i].flag,
                              msgState3[i].index);
  flagState->ExpungeByIndex(2);
  nsCString uidString;
  PRUint32 msgUids[] = {69,71};
  PRUint32 msgCount = 2;
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

  flagState->SetPartialUIDFetch(PR_FALSE);
  numMsgs = sizeof(msgState4) / sizeof(msgState4[0]);
  for (PRInt32 i = 0; i < numMsgs; i++)
    flagState->AddUidFlagPair(msgState4[i].uid, msgState4[i].flag,
                              msgState4[i].index);
  flagState->ExpungeByIndex(4);
  PRUint32 msgUids2[] = {69,71,73};
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
