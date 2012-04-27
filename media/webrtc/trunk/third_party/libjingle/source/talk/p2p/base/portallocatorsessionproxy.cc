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

#include "talk/p2p/base/portallocatorsessionproxy.h"

#include "talk/p2p/base/portallocator.h"
#include "talk/p2p/base/portproxy.h"

namespace cricket {

PortAllocatorSessionMuxer::PortAllocatorSessionMuxer(
    PortAllocatorSession* session)
    : session_(session) {
  session_->SignalPortReady.connect(
      this, &PortAllocatorSessionMuxer::OnPortReady);
}

PortAllocatorSessionMuxer::~PortAllocatorSessionMuxer() {
  for (size_t i = 0; i < session_proxies_.size(); ++i)
    delete session_proxies_[i];

  SignalDestroyed(this);
}

void PortAllocatorSessionMuxer::RegisterSessionProxy(
    PortAllocatorSessionProxy* session_proxy) {
  session_proxies_.push_back(session_proxy);
  session_proxy->SignalDestroyed.connect(
      this, &PortAllocatorSessionMuxer::OnSessionProxyDestroyed);
  session_proxy->set_impl(session_.get());
}

void PortAllocatorSessionMuxer::OnPortReady(PortAllocatorSession* session,
                                            Port* port) {
  ASSERT(session == session_.get());
  ports_.push_back(port);
  port->SignalDestroyed.connect(
      this, &PortAllocatorSessionMuxer::OnPortDestroyed);
}

void PortAllocatorSessionMuxer::OnPortDestroyed(Port* port) {
  std::vector<Port*>::iterator it =
      std::find(ports_.begin(), ports_.end(), port);
  if (it != ports_.end())
    ports_.erase(it);
}

void PortAllocatorSessionMuxer::OnSessionProxyDestroyed(
    PortAllocatorSession* proxy) {
  std::vector<PortAllocatorSessionProxy*>::iterator it =
      std::find(session_proxies_.begin(), session_proxies_.end(), proxy);
  if (it != session_proxies_.end())
    session_proxies_.erase(it);

  if (session_proxies_.empty()) {
    // Destroy PortAllocatorSession and its associated muxer object if all
    // proxies belonging to this session are already destroyed.
    delete this;
  }
}

PortAllocatorSessionProxy::~PortAllocatorSessionProxy() {
  std::map<Port*, PortProxy*>::iterator it;
  for (it = proxy_ports_.begin(); it != proxy_ports_.end(); it++)
    delete it->second;

  SignalDestroyed(this);
}

void PortAllocatorSessionProxy::set_impl(
    PortAllocatorSession* session) {
  impl_ = session;

  impl_->SignalCandidatesReady.connect(
      this, &PortAllocatorSessionProxy::OnCandidatesReady);
  impl_->SignalPortReady.connect(
      this, &PortAllocatorSessionProxy::OnPortReady);
}

void PortAllocatorSessionProxy::GetInitialPorts() {
  ASSERT(impl_ != NULL);
  impl_->GetInitialPorts();
}

void PortAllocatorSessionProxy::StartGetAllPorts() {
  ASSERT(impl_ != NULL);
  impl_->StartGetAllPorts();
}

void PortAllocatorSessionProxy::StopGetAllPorts() {
  ASSERT(impl_ != NULL);
  impl_->StartGetAllPorts();
}

bool PortAllocatorSessionProxy::IsGettingAllPorts() {
  ASSERT(impl_ != NULL);
  return impl_->IsGettingAllPorts();
}

void PortAllocatorSessionProxy::OnPortReady(PortAllocatorSession* session,
                                            Port* port) {
  ASSERT(session == impl_);

  PortProxy* proxy_port = new PortProxy(
      port->thread(), port->type(), port->socket_factory(), port->network(),
      port->ip(), port->min_port(), port->max_port(), username(), password());
  proxy_port->set_impl(port);
  proxy_ports_[port] = proxy_port;
  SignalPortReady(this, proxy_port);
}

void PortAllocatorSessionProxy::OnCandidatesReady(
    PortAllocatorSession* session,
    const std::vector<Candidate>& candidates) {
  ASSERT(session == impl_);

  // Since all proxy sessions share a common PortAllocatorSession,
  // all Candidates will have name associated with the common PAS.
  // Change Candidate name with the PortAllocatorSessionProxy name.
  std::vector<Candidate> our_candidates;
  for (size_t i = 0; i < candidates.size(); ++i) {
    Candidate new_local_candidate = candidates[i];
    new_local_candidate.set_name(name_);
    our_candidates.push_back(new_local_candidate);
  }

  SignalCandidatesReady(this, our_candidates);
}

}  // namespace cricket
