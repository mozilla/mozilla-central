/*
 * libjingle
 * Copyright 2004--2005, Google Inc.
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

#include "talk/examples/call/discoitemsquerytask.h"
#include "talk/base/scoped_ptr.h"
#include "talk/xmpp/constants.h"


namespace buzz {

namespace {
const int kDiscoItemsTimeout = 60;
} // namespace

DiscoItemsQueryTask::DiscoItemsQueryTask(XmppTaskParentInterface* parent,
                                         const std::string& node,
                                         const Jid& to)
    : XmppTask(parent, XmppEngine::HL_SINGLE), node_(node) {
  set_timeout_seconds(kDiscoItemsTimeout);
  to_ = to;
}

int DiscoItemsQueryTask::ProcessStart() {
  talk_base::scoped_ptr<XmlElement> get(MakeIq(STR_GET, to_, task_id()));

  XmlElement* element = new XmlElement(QN_DISCO_ITEMS_QUERY, true);
  element->AddAttr(QN_NODE, node_);

  get->AddElement(element);

  if (SendStanza(get.get()) != XMPP_RETURN_OK) {
    SignalDiscoItemsError(to_, NULL);
    return STATE_ERROR;
  }

  return STATE_RESPONSE;
}

int DiscoItemsQueryTask::ProcessResponse() {
  const XmlElement* stanza = NextStanza();
  if (stanza == NULL)
    return STATE_BLOCKED;

  bool success = false;
  if (stanza->Attr(QN_TYPE) != STR_ERROR) {
    const XmlElement* query = stanza->FirstNamed(QN_DISCO_ITEMS_QUERY);
    if (query) {
      SignalGotDiscoItems(to_, query);
      success = true;
    }
  }

  if (!success) {
    SignalDiscoItemsError(to_, stanza->FirstNamed(QN_ERROR));
  }

  return STATE_DONE;
}

int DiscoItemsQueryTask::OnTimeout() {
  SignalDiscoItemsError(to_, NULL);
  return XmppTask::OnTimeout();
}

bool DiscoItemsQueryTask::HandleStanza(const XmlElement* stanza) {
  if (!MatchResponseIq(stanza, to_, task_id()))
    return false;
  QueueStanza(stanza);
  return true;

}

}
