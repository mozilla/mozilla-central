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

#include "talk/base/scoped_ptr.h"
#include "talk/examples/call/discoitemsquerytask.h"
#include "talk/examples/call/voicemailjidrequester.h"
#include "talk/xmpp/constants.h"
#include "talk/xmpp/xmpptask.h"

namespace buzz {

VoicemailJidRequester::VoicemailJidRequester(XmppTaskParentInterface* parent,
                                             const Jid& their_jid,
                                             const Jid& my_jid) :
    XmppTaskBase(parent),
    their_jid_(their_jid),
    my_jid_(my_jid),
    done_with_query_(false) {
}

int VoicemailJidRequester::ProcessStart() {
  // Start first query to node='voicemail'
  DiscoItemsQueryTask* disco_items_task = new DiscoItemsQueryTask(this,
      STR_VOICEMAIL, their_jid_.BareJid());
  disco_items_task->SignalGotDiscoItems.connect(this,
      &VoicemailJidRequester::OnFirstVoicemailJidSuccess);
  disco_items_task->SignalDiscoItemsError.connect(this,
      &VoicemailJidRequester::OnFirstVoicemailJidError);
  disco_items_task->Start();
  return STATE_BLOCKED;
}

void VoicemailJidRequester::OnFirstVoicemailJidError(buzz::Jid jid,
    const XmlElement* xml_element) {
  // First query gave us an error - try second query to node='outgoingvoicemail'
  // and send it to your own jid
  StartSecondQuery();
}

void VoicemailJidRequester::OnFirstVoicemailJidSuccess(buzz::Jid jid,
    const XmlElement* xml_element) {
  // Process the XML and fire the appropriate signals.  If the xml was valid,
  // then we're done with queries.  If it wasn't valid, then start the second
  // query.
  bool valid_xml = ProcessVoicemailXml(xml_element);
  if (valid_xml) {
    done_with_query_ = true;
    Wake();
  } else {
    StartSecondQuery();
  }
}

void VoicemailJidRequester::OnSecondVoicemailJidError(buzz::Jid jid,
    const XmlElement* xml_element) {
  SignalVoicemailJidError(their_jid_);
  done_with_query_ = true;
  Wake();
}

void VoicemailJidRequester::OnSecondVoicemailJidSuccess(buzz::Jid jid,
    const XmlElement* xml_element) {
  // Whether this is good xml or bad, we're still done with the query
  bool valid_xml = ProcessVoicemailXml(xml_element);
  if (!valid_xml) {
    SignalVoicemailJidError(their_jid_);
  }
  done_with_query_ = true;
  Wake();
}


void VoicemailJidRequester::StartSecondQuery() {
  // Send a query to your own jid to get the voicemail jid
  DiscoItemsQueryTask* disco_items_task = new DiscoItemsQueryTask(this,
      STR_OUTGOINGVOICEMAIL, my_jid_.BareJid());
  disco_items_task->SignalGotDiscoItems.connect(this,
      &VoicemailJidRequester::OnSecondVoicemailJidSuccess);
  disco_items_task->SignalDiscoItemsError.connect(this,
      &VoicemailJidRequester::OnSecondVoicemailJidError);
  disco_items_task->Start();
}

int VoicemailJidRequester::Process(int state) {
  if (done_with_query_) {
    return STATE_DONE;
  } else {
    return talk_base::Task::Process(state);
  }
}

bool VoicemailJidRequester::ProcessVoicemailXml(const XmlElement* xml_element) {
  if (!xml_element) {
    return false;
  }
  const std::string& node_name = xml_element->Attr(QN_NODE);
  // Verify that it's one of the two nodes - we don't really care which one
  if (node_name != "voicemail" &&
      node_name != "outgoingvoicemail") {
    return false;
  }

  const XmlElement* item = xml_element->FirstNamed(QN_DISCO_ITEM);
  if (item) {
    const std::string& jid_str = item->Attr(QN_JID);
    buzz::Jid voicemail_jid(jid_str);
    SignalGotVoicemailJid(their_jid_, voicemail_jid);
    return true;
  }
  return false;
}
}
