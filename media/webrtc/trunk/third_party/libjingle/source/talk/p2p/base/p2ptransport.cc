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

#include "talk/p2p/base/p2ptransport.h"

#include <string>
#include <vector>

#include "talk/base/base64.h"
#include "talk/base/common.h"
#include "talk/base/stringencode.h"
#include "talk/base/stringutils.h"
#include "talk/p2p/base/constants.h"
#include "talk/p2p/base/p2ptransportchannel.h"
#include "talk/p2p/base/parsing.h"
#include "talk/p2p/base/sessionmanager.h"
#include "talk/p2p/base/sessionmessages.h"
#include "talk/xmllite/qname.h"
#include "talk/xmllite/xmlelement.h"
#include "talk/xmpp/constants.h"

namespace {

// We only allow usernames to be this many characters or fewer.
const size_t kMaxUsernameSize = 16;

}  // namespace

namespace cricket {

P2PTransport::P2PTransport(talk_base::Thread* signaling_thread,
                           talk_base::Thread* worker_thread,
                           PortAllocator* allocator)
    : Transport(signaling_thread, worker_thread,
                NS_GINGLE_P2P, allocator) {
}

P2PTransport::~P2PTransport() {
  DestroyAllChannels();
}

void P2PTransport::OnTransportError(const buzz::XmlElement* error) {
  // Need to know if it was <unknown-channel name="xxx">.
  ASSERT(error->Name().Namespace() == type());
  if ((error->Name() == QN_GINGLE_P2P_UNKNOWN_CHANNEL_NAME)
      && error->HasAttr(buzz::QN_NAME)) {
    std::string channel_name = error->Attr(buzz::QN_NAME);
    if (HasChannel(channel_name)) {
      SignalChannelGone(this, channel_name);
    }
  }
}


bool P2PTransportParser::ParseCandidates(SignalingProtocol protocol,
                                         const buzz::XmlElement* elem,
                                         Candidates* candidates,
                                         ParseError* error) {
  // TODO: Once we implement standard ICE-UDP, parse the
  // candidates according to XEP-176.
  for (const buzz::XmlElement* candidate_elem = elem->FirstElement();
       candidate_elem != NULL;
       candidate_elem = candidate_elem->NextElement()) {
    // Only look at local part because it might be <session><candidate>
    //                                          or <tranport><candidate>.
    if (candidate_elem->Name().LocalPart() == LN_CANDIDATE) {
      Candidate candidate;
      if (!ParseCandidate(candidate_elem, &candidate, error))
        return false;
      candidates->push_back(candidate);
    }
  }
  return true;
}

bool P2PTransportParser::ParseCandidate(const buzz::XmlElement* elem,
                                        Candidate* candidate,
                                        ParseError* error) {
  if (!elem->HasAttr(buzz::QN_NAME) ||
      !elem->HasAttr(QN_ADDRESS) ||
      !elem->HasAttr(QN_PORT) ||
      !elem->HasAttr(QN_USERNAME) ||
      !elem->HasAttr(QN_PREFERENCE) ||
      !elem->HasAttr(QN_PROTOCOL) ||
      !elem->HasAttr(QN_GENERATION)) {
    return BadParse("candidate missing required attribute", error);
  }

  talk_base::SocketAddress address;
  if (!ParseAddress(elem, QN_ADDRESS, QN_PORT, &address, error))
    return false;

  candidate->set_name(elem->Attr(buzz::QN_NAME));
  candidate->set_address(address);
  candidate->set_username(elem->Attr(QN_USERNAME));
  candidate->set_preference_str(elem->Attr(QN_PREFERENCE));
  candidate->set_protocol(elem->Attr(QN_PROTOCOL));
  candidate->set_generation_str(elem->Attr(QN_GENERATION));
  if (elem->HasAttr(QN_PASSWORD))
    candidate->set_password(elem->Attr(QN_PASSWORD));
  if (elem->HasAttr(buzz::QN_TYPE))
    candidate->set_type(elem->Attr(buzz::QN_TYPE));
  if (elem->HasAttr(QN_NETWORK))
    candidate->set_network_name(elem->Attr(QN_NETWORK));

  if (!VerifyUsernameFormat(candidate->username(), error))
    return false;

  return true;
}

bool P2PTransportParser::VerifyUsernameFormat(const std::string& username,
                                              ParseError* error) {
  if (username.size() > kMaxUsernameSize)
    return BadParse("candidate username is too long", error);
  if (!talk_base::Base64::IsBase64Encoded(username))
    return BadParse(
        "candidate username has non-base64 encoded characters", error);
  return true;
}

const buzz::QName& GetCandidateQName(SignalingProtocol protocol) {
  if (protocol == PROTOCOL_GINGLE) {
    return QN_GINGLE_CANDIDATE;
  } else {
    // TODO: Once we implement standard ICE-UDP, use the
    // XEP-176 namespace.
    return QN_GINGLE_P2P_CANDIDATE;
  }
}

bool P2PTransportParser::WriteCandidates(SignalingProtocol protocol,
                                         const Candidates& candidates,
                                         XmlElements* candidate_elems,
                                         WriteError* error) {
  // TODO: Once we implement standard ICE-UDP, parse the
  // candidates according to XEP-176.
  for (std::vector<Candidate>::const_iterator iter = candidates.begin();
       iter != candidates.end(); ++iter) {
    buzz::XmlElement* cand_elem =
        new buzz::XmlElement(GetCandidateQName(protocol));
    if (!WriteCandidate(*iter, cand_elem, error))
      return false;
    candidate_elems->push_back(cand_elem);
  }
  return true;
}

bool P2PTransportParser::WriteCandidate(const Candidate& candidate,
                                        buzz::XmlElement* elem,
                                        WriteError* error) {
  elem->SetAttr(buzz::QN_NAME, candidate.name());
  elem->SetAttr(QN_ADDRESS, candidate.address().IPAsString());
  elem->SetAttr(QN_PORT, candidate.address().PortAsString());
  elem->SetAttr(QN_PREFERENCE, candidate.preference_str());
  elem->SetAttr(QN_USERNAME, candidate.username());
  elem->SetAttr(QN_PROTOCOL, candidate.protocol());
  elem->SetAttr(QN_GENERATION, candidate.generation_str());
  if (candidate.password().size() > 0)
    elem->SetAttr(QN_PASSWORD, candidate.password());
  if (candidate.type().size() > 0)
    elem->SetAttr(buzz::QN_TYPE, candidate.type());
  if (candidate.network_name().size() > 0)
    elem->SetAttr(QN_NETWORK, candidate.network_name());
  return true;
}

TransportChannelImpl* P2PTransport::CreateTransportChannel(
    const std::string& name, const std::string& content_type) {
  return new P2PTransportChannel(name, content_type, this, port_allocator());
}

void P2PTransport::DestroyTransportChannel(TransportChannelImpl* channel) {
  delete channel;
}

}  // namespace cricket
