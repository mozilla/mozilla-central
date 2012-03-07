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

#include "talk/p2p/base/portproxy.h"

namespace cricket {

void PortProxy::set_impl(Port* port) {
  impl_ = port;
  impl_->SignalUnknownAddress.connect(
      this, &PortProxy::OnUnknownAddress);
  impl_->SignalDestroyed.connect(this, &PortProxy::OnPortDestroyed);
}

void PortProxy::PrepareAddress() {
  impl_->PrepareAddress();
}

Connection* PortProxy::CreateConnection(const Candidate& remote_candidate,
                                        CandidateOrigin origin) {
  ASSERT(impl_ != NULL);
  return impl_->CreateConnection(remote_candidate, origin);
}

int PortProxy::SendTo(const void* data,
                      size_t size,
                      const talk_base::SocketAddress& addr,
                      bool payload) {
  ASSERT(impl_ != NULL);
  return impl_->SendTo(data, size, addr, payload);
}

int PortProxy::SetOption(talk_base::Socket::Option opt,
                         int value) {
  ASSERT(impl_ != NULL);
  return impl_->SetOption(opt, value);
}

int PortProxy::GetError() {
  ASSERT(impl_ != NULL);
  return impl_->GetError();
}

void PortProxy::OnUnknownAddress(
    Port *port,
    const talk_base::SocketAddress &addr,
    StunMessage *stun_msg,
    const std::string &remote_username,
    bool port_muxed) {
  ASSERT(port == impl_);
  ASSERT(!port_muxed);
  SignalUnknownAddress(this, addr, stun_msg, remote_username, true);
}

void PortProxy::OnPortDestroyed(Port* port) {
  ASSERT(port == impl_);
  // |port| will be destroyed in PortAllocatorSessionMuxer.
  SignalDestroyed(this);
}

}  // namespace cricket
