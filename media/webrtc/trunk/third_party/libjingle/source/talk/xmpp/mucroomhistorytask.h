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

// https://docs.google.com/a/google.com/document/d/1PObnyJbdEWDOrgDZJFIH1peMvRoUkSTv6382zq3hbuM/edit?hl=en#

#include <string>
#include <vector>

#include "talk/xmpp/iqtask.h"

namespace buzz {

struct MucRoomHistoryInfo {
  std::string room_name;
  std::string last_enter_time;
};

enum MucRoomHistoryTaskCommand {
  HT_ADD = 0,
  HT_CLEAR_ALL = 1,
  HT_DELETE = 2,
};

class MucRoomHistoryGetTask : public IqTask {
 public:
  MucRoomHistoryGetTask(XmppTaskParentInterface* parent,
                        const buzz::Jid& user_jid);

  sigslot::signal1<const std::vector<MucRoomHistoryInfo>&> SignalResult;

 protected:
  static XmlElement* MakeRequest();
  virtual void HandleResult(const XmlElement* stanza);
};

class MucRoomHistorySetTask : public IqTask {
 public:
  MucRoomHistorySetTask(XmppTaskParentInterface* parent,
                        MucRoomHistoryTaskCommand command,
                        const buzz::Jid& user_jid,
                        const std::string& room_name);

  sigslot::signal0<> SignalResult;

 protected:
  static XmlElement* MakeRequest(MucRoomHistoryTaskCommand command,
                                 const std::string& room_name);
  virtual void HandleResult(const XmlElement* stanza);
};

}  // namespace buzz
