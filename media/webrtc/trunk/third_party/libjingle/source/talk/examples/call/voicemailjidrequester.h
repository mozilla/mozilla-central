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

// VoicemailJidRequester wraps the requesting of voicemail jids for a user.
//
// To request a voicemail jid, we first set off a query to the user's bare jid
// that looks like this:
//
//      <iq type='get'
//          from='foo@gmail.com/asdf'
//          to='bar@google.com'
//          id='1234'>
//          <query xmlns=' http://jabber.org/protocol/disco#items'
//                 node='voicemail '/>
//      </iq>
//
// If foo@gmail.com's server supports voicemail, it'll return this, and forward
// the jid up to phoneapp.  We do not do the second query.
//
//      <iq type='result'
//          from='foo@google.com'
//          to='bar@google.com/asdf'
//          id='1234'>
//          <query xmlns=' http://jabber.org/protocol/disco#items '
//                 node=' voicemail '>
//                 <item jid='bar@google.com/voicemail '/>
//          </query>
//      </iq>
//
// If we get an error, we spin off a new request:
//
//      <iq type='get'
//          from='foo@google.com/asdf'
//          to='foo@google.com'
//          id='1234'>
//          <query xmlns=' http://jabber.org/protocol/disco#items'
//                 node='outgoingvoicemail '/>
//      </iq>
//
// If both of these return errors, we then forward the request to phoneapp.

#ifndef TALK_EXAMPLES_CALL_VOICEMAILJIDREQUESTER_H_
#define TALK_EXAMPLES_CALL_VOICEMAILJIDREQUESTER_H_

#include "talk/xmpp/xmpptask.h"

namespace buzz {

class Task;

class VoicemailJidRequester : public sigslot::has_slots<>,
                              public XmppTaskBase {
 public:
  VoicemailJidRequester(XmppTaskParentInterface* parent,
                        const Jid& their_jid, const Jid& my_jid);

  // Provides the target jid and the voicemail to reach it
  sigslot::signal2<const Jid&, const Jid&> SignalGotVoicemailJid;
  sigslot::signal1<const Jid&> SignalVoicemailJidError;

  virtual int ProcessStart();
 protected:

  virtual int Process(int state);

 private:
  // The first query (to node='voicemail' has returned an error) - we now spin
  // off a request to node='outgoingvoicemail')
  void OnFirstVoicemailJidError(buzz::Jid jid, const XmlElement* xml_element);

  // The first query (to node='voicemail' has returned a successfully)
  void OnFirstVoicemailJidSuccess(buzz::Jid jid, const XmlElement* xml_element);

  // The second query (to node='outgoingvoicemail') has returned an error -
  // nothing we can do now, just fire our error signal
  void OnSecondVoicemailJidError(buzz::Jid jid, const XmlElement* xml_element);

  // The second query (to node='outgoingvoicemail') has returned a successfully
  void OnSecondVoicemailJidSuccess(buzz::Jid jid,
                                   const XmlElement* xml_element);

  // Parse the xml, fire SignalGotVoicemail jid if it was valid (and had a jid)
  // and return true if it was a valid xml.
  bool ProcessVoicemailXml(const XmlElement* xml_element);

  // Send a query to your own jid to get the voicemail jid.  This is used after
  // the first query fails.
  void StartSecondQuery();

  Jid their_jid_;

  // Your own jid (not the other user's)
  Jid my_jid_;

  // A flag indicating whether or not we're done with the query so that we can
  // set the state correctly in Process(int state)
  bool done_with_query_;
};
}

#endif  // TALK_EXAMPLES_CALL_VOICEMAILJIDREQUESTER_H_
