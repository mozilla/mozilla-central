/*
 * libjingle
 * Copyright 2004--2011, Google Inc.
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

#include "talk/app/webrtc/portallocatorfactory.h"

#include "talk/base/logging.h"
#include "talk/base/network.h"
#include "talk/base/basicpacketsocketfactory.h"
#include "talk/base/thread.h"
#include "talk/p2p/client/httpportallocator.h"

static const char kUserAgent[] = "PeerConnection User Agent";

namespace webrtc {

using talk_base::scoped_ptr;

talk_base::scoped_refptr<PortAllocatorFactoryInterface>
PortAllocatorFactory::Create(
    talk_base::Thread* worker_thread) {
  talk_base::RefCountedObject<PortAllocatorFactory>* allocator =
        new talk_base::RefCountedObject<PortAllocatorFactory>(worker_thread);
  return allocator;
}

PortAllocatorFactory::PortAllocatorFactory(talk_base::Thread* worker_thread)
    : network_manager_(new talk_base::BasicNetworkManager()),
      socket_factory_(new talk_base::BasicPacketSocketFactory(worker_thread)) {
}

PortAllocatorFactory::~PortAllocatorFactory() {}

cricket::PortAllocator* PortAllocatorFactory::CreatePortAllocator(
    const std::vector<StunConfiguration>& stun,
    const std::vector<TurnConfiguration>& turn) {

  scoped_ptr<cricket::HttpPortAllocator> allocator(
      new cricket::HttpPortAllocator(
          network_manager_.get(), socket_factory_.get(), kUserAgent));

  std::vector<talk_base::SocketAddress> stun_hosts;
  typedef std::vector<StunConfiguration>::const_iterator StunIt;
  for (StunIt stun_it = stun.begin(); stun_it != stun.end(); ++stun_it) {
    stun_hosts.push_back(stun_it->server);
  }
  allocator->SetStunHosts(stun_hosts);

  if (turn.size() > 0)
    LOG(LS_INFO) << "Not using turn server params";

  // TODO - Enable TURN support once WebRtcSession can handle
  // relay candidates.
#if 0
  std::vector<std::string> relay_hosts;
  typedef std::vector<TurnConfiguration>::const_iterator TurnIt;
  for (TurnIt turn_it = turn.begin(); turn_it != turn.end(); ++turn_it) {
    relay_hosts.push_back(turn_it->server.hostname());
  }
  allocator->SetRelayHosts(relay_hosts);

  // Currently we can only set the password of one relay server.
  // Use the password of the first server. User name can currently not be set.
  // TODO: See above limitations.
  if (turn.size() > 0)
    allocator->SetRelayToken(turn[0].password);
#endif

  return allocator.release();
}

}  // namespace webrtc
