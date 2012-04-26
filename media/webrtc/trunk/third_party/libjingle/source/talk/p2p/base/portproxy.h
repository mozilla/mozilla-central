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

#ifndef TALK_P2P_BASE_PORTPROXY_H_
#define TALK_P2P_BASE_PORTPROXY_H_

#include "talk/p2p/base/port.h"

namespace cricket {

class PortProxy : public Port {
 public:
  PortProxy(talk_base::Thread* thread, const std::string& type,
            talk_base::PacketSocketFactory* factory,
            talk_base::Network* network,
            const talk_base::IPAddress& ip, int min_port, int max_port,
            const std::string& username, const std::string& password)
      : Port(thread, type, factory, network, ip, min_port, max_port,
             username, password) {
  }
  virtual ~PortProxy() {}

  Port* impl() { return impl_; }
  void set_impl(Port* port);

  // Forwards call to the actual Port.
  virtual void PrepareAddress();
  virtual Connection* CreateConnection(const Candidate& remote_candidate,
    CandidateOrigin origin);
  virtual int SendTo(
      const void* data, size_t size, const talk_base::SocketAddress& addr,
      bool payload);
  virtual int SetOption(talk_base::Socket::Option opt, int value);
  virtual int GetError();

  virtual void SendBindingResponse(StunMessage* request,
                           const talk_base::SocketAddress& addr) {
    impl_->SendBindingResponse(request, addr);
  }

  virtual Connection* GetConnection(
      const talk_base::SocketAddress& remote_addr) {
    return impl_->GetConnection(remote_addr);
  }

  virtual void SendBindingErrorResponse(
        StunMessage* request, const talk_base::SocketAddress& addr,
        int error_code, const std::string& reason) {
    impl_->SendBindingErrorResponse(request, addr, error_code, reason);
  }

 private:
  void OnUnknownAddress(Port *port, const talk_base::SocketAddress &addr,
                        StunMessage *stun_msg,
                        const std::string &remote_username,
                        bool port_muxed);
  void OnPortDestroyed(Port* port);
  Port* impl_;
};

}  // namespace cricket

#endif  // TALK_P2P_BASE_PORTPROXY_H_
