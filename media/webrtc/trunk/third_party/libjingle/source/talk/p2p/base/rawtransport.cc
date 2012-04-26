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

#include <string>
#include <vector>
#include "talk/p2p/base/rawtransport.h"
#include "talk/base/common.h"
#include "talk/p2p/base/constants.h"
#include "talk/p2p/base/parsing.h"
#include "talk/p2p/base/sessionmanager.h"
#include "talk/p2p/base/rawtransportchannel.h"
#include "talk/xmllite/qname.h"
#include "talk/xmllite/xmlelement.h"
#include "talk/xmpp/constants.h"

#if defined(FEATURE_ENABLE_PSTN)
namespace cricket {

RawTransport::RawTransport(talk_base::Thread* signaling_thread,
                           talk_base::Thread* worker_thread,
                           PortAllocator* allocator)
    : Transport(signaling_thread, worker_thread,
                NS_GINGLE_RAW, allocator) {
}

RawTransport::~RawTransport() {
  DestroyAllChannels();
}

bool RawTransport::ParseCandidates(SignalingProtocol protocol,
                                   const buzz::XmlElement* elem,
                                   Candidates* candidates,
                                   ParseError* error) {
  for (const buzz::XmlElement* cand_elem = elem->FirstElement();
       cand_elem != NULL;
       cand_elem = cand_elem->NextElement()) {
    if (cand_elem->Name() == QN_GINGLE_RAW_CHANNEL) {
      talk_base::SocketAddress addr;
      if (!ParseRawAddress(cand_elem, &addr, error))
        return false;

      Candidate candidate;
      candidate.set_name(cand_elem->Attr(buzz::QN_NAME));
      candidate.set_address(addr);
      candidates->push_back(candidate);
    }
  }
  return true;
}

bool RawTransport::WriteCandidates(SignalingProtocol protocol,
                                   const Candidates& candidates,
                                   XmlElements* candidate_elems,
                                   WriteError* error) {
  for (std::vector<Candidate>::const_iterator
       cand = candidates.begin();
       cand != candidates.end();
       ++cand) {
    ASSERT(cand->protocol() == "udp");
    talk_base::SocketAddress addr = cand->address();

    buzz::XmlElement* elem = new buzz::XmlElement(QN_GINGLE_RAW_CHANNEL);
    elem->SetAttr(buzz::QN_NAME, type());
    elem->SetAttr(QN_ADDRESS, addr.ipaddr().ToString());
    elem->SetAttr(QN_PORT, addr.PortAsString());
    candidate_elems->push_back(elem);
  }
  return true;
}

bool RawTransport::ParseRawAddress(const buzz::XmlElement* elem,
                                   talk_base::SocketAddress* addr,
                                   ParseError* error) {
  // Make sure the required attributes exist
  if (!elem->HasAttr(buzz::QN_NAME) ||
      !elem->HasAttr(QN_ADDRESS) ||
      !elem->HasAttr(QN_PORT)) {
    return BadParse("channel missing required attribute", error);
  }

  // Make sure the channel named actually exists.
  if (!HasChannel(elem->Attr(buzz::QN_NAME)))
    return BadParse("channel named does not exist", error);

  // Parse the address.
  if (!ParseAddress(elem, QN_ADDRESS, QN_PORT, addr, error))
    return false;

  return true;
}

TransportChannelImpl* RawTransport::CreateTransportChannel(
    const std::string& name, const std::string& content_type) {
  return new RawTransportChannel(name, content_type, this,
                                 worker_thread(),
                                 port_allocator());
}

void RawTransport::DestroyTransportChannel(TransportChannelImpl* channel) {
  delete channel;
}

}  // namespace cricket
#endif  // defined(FEATURE_ENABLE_PSTN)
