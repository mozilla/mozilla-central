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

// Fires a disco items query, such as the following example:
// 
//      <iq type='get'
//          from='foo@gmail.com/asdf'
//          to='bar@google.com'
//          id='1234'>
//          <query xmlns=' http://jabber.org/protocol/disco#items'
//                 node='blah '/>
//      </iq>
//
// Sample response:
//
//      <iq type='result'
//          from=' hendriks@google.com'
//          to='rsturgell@google.com/asdf'
//          id='1234'>
//          <query xmlns=' http://jabber.org/protocol/disco#items '
//                 node='blah'>
//                 <item something='somethingelse'/>
//          </query>
//      </iq>


#ifndef _DISCOITEMSQUERYTASK_H_
#define _DISCOITEMSQUERYTASK_H_

#include "talk/xmpp/xmpptask.h"

namespace buzz {

class DiscoItemsQueryTask : public XmppTask {
 public:
  // TODO: Currently, this only supports one query stanza - we may eventually
  // need it to support multiple
  DiscoItemsQueryTask(XmppTaskParentInterface* parent,
                      const std::string& node, const Jid& to);

  virtual int ProcessStart();
  virtual int ProcessResponse();

  // On success, fires a signal with the jid we sent the query to and the inner
  // XmlElement
  sigslot::signal2<Jid, const XmlElement*> SignalGotDiscoItems;

  // The XmlElement here is the error element under the error response.  If the
  // request just timed out then this will be NULL
  sigslot::signal2<Jid, const XmlElement*> SignalDiscoItemsError;

 protected:
  virtual bool HandleStanza(const XmlElement* stanza);
  virtual int OnTimeout();
  
 private:
  // The jid we're querying
  Jid to_;
  // The name of the node
  const std::string node_;
};

}

#endif
