/*
 * libjingle
 * Copyright 2011, Google Inc.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  1. Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "talk/xmpp/mucroomhistorytask.h"
#include "talk/xmpp/constants.h"

namespace buzz {

// TODO: Move these to xmpp/constants.cc once it's publicly
// viewable.
const char NS_GOOGLE_SETTING[] = "google:setting";
const StaticQName QN_MEETING_HISTORY = { NS_GOOGLE_SETTING, "meetinghistory" };
const StaticQName QN_MEETING_ITEM = { NS_GOOGLE_SETTING, "item" };

MucRoomHistoryGetTask::MucRoomHistoryGetTask(XmppTaskParentInterface* parent,
                                             const buzz::Jid& user_jid)
    : IqTask(parent, STR_GET, user_jid, MakeRequest()) {
}

//    <iq type='get' id='user-setting-1'>
//      <meetinghistory xmlns='google:setting' />
//    </iq>
XmlElement* MucRoomHistoryGetTask::MakeRequest() {
  XmlElement* history = new XmlElement(QN_MEETING_HISTORY, true);
  return history;
}

//   <iq type='result'
//       to='romeo@gmail.com/orchard'
//       id='user-setting-1'>
//     <meetinghistory xmlns='google:setting'>
//       <item jid=’private-muc-abc-...@groupchat.google.com’ name=’Hangout'
//             time=’2011-01-31T13:20:00Z’ />
//       <item jid=’private-muc-abc-...@groupchat.google.com’ name=’Planning’
//             time=’2011-02-11T 14:20:00Z />
//       <item jid=’private-muc-abc-...@groupchat.google.com’ name=’TGIF’
//             time=’2011-03-21T15:20:00Z’ />
//     </meetinghistory>
//   </iq>
void MucRoomHistoryGetTask::HandleResult(const XmlElement* stanza) {
  std::vector<MucRoomHistoryInfo> meeting_rooms;

  const XmlElement* history = stanza->FirstNamed(QN_MEETING_HISTORY);
  if (history == NULL) {
    SignalResult(meeting_rooms);
    return;
  }

  const XmlElement* history_item = history->FirstNamed(QN_MEETING_ITEM);
  while (history_item != NULL) {
    MucRoomHistoryInfo room;
    room.room_name = history_item->Attr(QN_NAME);
    room.last_enter_time = history_item->Attr(QN_TIME);
    meeting_rooms.push_back(room);

    history_item = history_item->NextNamed(QN_MEETING_ITEM);
  }

  SignalResult(meeting_rooms);
}

MucRoomHistorySetTask::MucRoomHistorySetTask(XmppTaskParentInterface* parent,
                                             MucRoomHistoryTaskCommand command,
                                             const buzz::Jid& user_jid,
                                             const std::string& room_name)
    : IqTask(parent, STR_SET, user_jid, MakeRequest(command, room_name)) {
}

// ADD
//   <iq type='set'
//       to='romeo@gmail.com'
//       id='user-setting-3'>
//     <meetinghistory xmlns='google:setting'>
//       <item jid=’private-muc-abc@groupchat.google.com’
//             name=’Hangout' action=’add’ />
//     </meetinghistory>
//   </iq>

// DELETE
//   <iq type='set'
//       to='romeo@gmail.com'
//       id='user-setting-3'>
//     <meetinghistory xmlns='google:setting'>
//       <item jid=’private-muc-abc@groupchat.google.com’
//             name=’Hangout' action=’remove’ />
//     </meetinghistory>
//   </iq>

// CLEAR ALL
//   <iq type='set'
//       from='romeo@gmail.com/orchard'
//       to='romeo@gmail.com'
//       id='user-setting-3'>
//     <meetinghistory xmlns='google:setting' />
//   </iq>
XmlElement* MucRoomHistorySetTask::MakeRequest(
    MucRoomHistoryTaskCommand command, const std::string& room_name) {
  XmlElement* history = new XmlElement(QN_MEETING_HISTORY, true);
  if (command != HT_CLEAR_ALL) {
    XmlElement* item = new XmlElement(QN_MEETING_ITEM, false);
    // TODO - remove QN_JID attribute when 21446107 is submitted &
    // deployed.  no harm to leave in after the change is made.
    item->AddAttr(QN_JID, room_name);
    item->AddAttr(QN_NAME, room_name);
    item->AddAttr(QN_ACTION, command == HT_ADD ? "add" : "remove");

    history->AddElement(item);
  }

  return history;
}

// MODIFY & CLEAR
//   <iq type='result'
//       to='romeo@gmail.com/orchard'
//       from='romeo@gmail.com'
//       id='user-setting-3' />
void MucRoomHistorySetTask::HandleResult(const XmlElement* stanza) {
  SignalResult();
}

}  // namespace buzz
