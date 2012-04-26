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

#include "talk/p2p/base/stunport.h"

#include "talk/base/common.h"
#include "talk/base/logging.h"
#include "talk/base/helpers.h"
#include "talk/base/nethelpers.h"
#include "talk/p2p/base/common.h"
#include "talk/p2p/base/stun.h"

namespace cricket {

// TODO: Move these to a common place (used in relayport too)
const int KEEPALIVE_DELAY = 10 * 1000;  // 10 seconds - sort timeouts
const int RETRY_DELAY = 50;             // 50ms, from ICE spec
const int RETRY_TIMEOUT = 50 * 1000;    // ICE says 50 secs

// Handles a binding request sent to the STUN server.
class StunPortBindingRequest : public StunRequest {
 public:
  StunPortBindingRequest(StunPort* port, bool keep_alive,
                         const talk_base::SocketAddress& addr)
    : port_(port), keep_alive_(keep_alive), server_addr_(addr) {
    start_time_ = talk_base::Time();
  }

  virtual ~StunPortBindingRequest() {
  }

  const talk_base::SocketAddress& server_addr() const { return server_addr_; }

  virtual void Prepare(StunMessage* request) {
    request->SetType(STUN_BINDING_REQUEST);
  }

  virtual void OnResponse(StunMessage* response) {
    const StunAddressAttribute* addr_attr =
        response->GetAddress(STUN_ATTR_MAPPED_ADDRESS);
    if (!addr_attr) {
      LOG(LS_ERROR) << "Binding response missing mapped address.";
    } else if (addr_attr->family() != STUN_ADDRESS_IPV4 &&
               addr_attr->family() != STUN_ADDRESS_IPV6) {
      LOG(LS_ERROR) << "Binding address has bad family";
    } else {
      talk_base::SocketAddress addr(addr_attr->ipaddr(), addr_attr->port());
      port_->AddAddress(addr, "udp", true);
    }

    // We will do a keep-alive regardless of whether this request suceeds.
    // This should have almost no impact on network usage.
    if (keep_alive_) {
      port_->requests_.SendDelayed(
          new StunPortBindingRequest(port_, true, server_addr_),
          KEEPALIVE_DELAY);
    }
  }

  virtual void OnErrorResponse(StunMessage* response) {
    const StunErrorCodeAttribute* attr = response->GetErrorCode();
    if (!attr) {
      LOG(LS_ERROR) << "Bad allocate response error code";
    } else {
      LOG(LS_ERROR) << "Binding error response:"
                 << " class=" << attr->error_class()
                 << " number=" << attr->number()
                 << " reason='" << attr->reason() << "'";
    }

    port_->SignalAddressError(port_);

    if (keep_alive_
        && (talk_base::TimeSince(start_time_) <= RETRY_TIMEOUT)) {
      port_->requests_.SendDelayed(
          new StunPortBindingRequest(port_, true, server_addr_),
          KEEPALIVE_DELAY);
    }
  }

  virtual void OnTimeout() {
    LOG(LS_ERROR) << "Binding request timed out from "
      << port_->GetLocalAddress().ToString()
      << " (" << port_->network()->name() << ")";

    port_->SignalAddressError(port_);

    if (keep_alive_
        && (talk_base::TimeSince(start_time_) <= RETRY_TIMEOUT)) {
      port_->requests_.SendDelayed(
          new StunPortBindingRequest(port_, true, server_addr_),
          RETRY_DELAY);
    }
  }

 private:
  StunPort* port_;
  bool keep_alive_;
  talk_base::SocketAddress server_addr_;
  uint32 start_time_;
};

const char STUN_PORT_TYPE[] = "stun";

StunPort::StunPort(talk_base::Thread* thread,
                   talk_base::PacketSocketFactory* factory,
                   talk_base::Network* network,
                   const talk_base::IPAddress& ip, int min_port, int max_port,
                   const std::string& username, const std::string& password,
                   const talk_base::SocketAddress& server_addr)
    : Port(thread, STUN_PORT_TYPE, factory, network, ip, min_port, max_port,
           username, password),
      server_addr_(server_addr),
      requests_(thread),
      socket_(NULL),
      error_(0),
      resolver_(NULL) {
  requests_.SignalSendPacket.connect(this, &StunPort::OnSendPacket);
}

bool StunPort::Init() {
  socket_ = socket_factory()->CreateUdpSocket(
      talk_base::SocketAddress(ip(), 0), min_port(), max_port());
  if (!socket_) {
    LOG_J(LS_WARNING, this) << "UDP socket creation failed";
    return false;
  }
  socket_->SignalReadPacket.connect(this, &StunPort::OnReadPacket);
  return true;
}

StunPort::~StunPort() {
  if (resolver_) {
    resolver_->Destroy(false);
  }
  delete socket_;
}

void StunPort::PrepareAddress() {
  // We will keep pinging the stun server to make sure our NAT pin-hole stays
  // open during the call.
  if (server_addr_.IsUnresolved()) {
    ResolveStunAddress();
  } else {
    requests_.Send(new StunPortBindingRequest(this, true, server_addr_));
  }
}

void StunPort::PrepareSecondaryAddress() {
  // DNS resolution of the secondary address is not currently supported.
  ASSERT(!server_addr2_.IsAny());
  requests_.Send(new StunPortBindingRequest(this, false, server_addr2_));
}

Connection* StunPort::CreateConnection(const Candidate& address,
                                       CandidateOrigin origin) {
  if (address.protocol() != "udp")
    return NULL;

  Connection* conn = new ProxyConnection(this, 0, address);
  AddConnection(conn);
  return conn;
}

int StunPort::SendTo(const void* data, size_t size,
                     const talk_base::SocketAddress& addr, bool payload) {
  int sent = socket_->SendTo(data, size, addr);
  if (sent < 0) {
    error_ = socket_->GetError();
    LOG_J(LS_ERROR, this) << "UDP send of " << size
                          << " bytes failed with error " << error_;
  }
  return sent;
}

int StunPort::SetOption(talk_base::Socket::Option opt, int value) {
  return socket_->SetOption(opt, value);
}

int StunPort::GetError() {
  return error_;
}

void StunPort::OnReadPacket(talk_base::AsyncPacketSocket* socket,
                            const char* data, size_t size,
                            const talk_base::SocketAddress& remote_addr) {
  ASSERT(socket == socket_);

  // Look for a response from the STUN server.
  // Even if the response doesn't match one of our outstanding requests, we
  // will eat it because it might be a response to a retransmitted packet, and
  // we already cleared the request when we got the first response.
  ASSERT(!server_addr_.IsUnresolved());
  if (remote_addr == server_addr_ || remote_addr == server_addr2_) {
    requests_.CheckResponse(data, size);
    return;
  }

  if (Connection* conn = GetConnection(remote_addr)) {
    conn->OnReadPacket(data, size);
  } else {
    Port::OnReadPacket(data, size, remote_addr);
  }
}

void StunPort::ResolveStunAddress() {
  if (resolver_)
    return;

  resolver_ = new talk_base::AsyncResolver();
  resolver_->SignalWorkDone.connect(this, &StunPort::OnResolveResult);
  resolver_->set_address(server_addr_);
  resolver_->Start();
}

void StunPort::OnResolveResult(talk_base::SignalThread* t) {
  ASSERT(t == resolver_);
  if (resolver_->error() != 0) {
    LOG_J(LS_WARNING, this) << "StunPort: stun host lookup received error "
                            << resolver_->error();
    SignalAddressError(this);
  }

  server_addr_ = resolver_->address();
  PrepareAddress();
}

// TODO: merge this with SendTo above.
void StunPort::OnSendPacket(const void* data, size_t size, StunRequest* req) {
  StunPortBindingRequest* sreq = static_cast<StunPortBindingRequest*>(req);
  if (socket_->SendTo(data, size, sreq->server_addr()) < 0)
    PLOG(LERROR, socket_->GetError()) << "sendto";
}

}  // namespace cricket
