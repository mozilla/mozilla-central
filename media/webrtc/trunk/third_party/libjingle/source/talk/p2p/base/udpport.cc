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

#include "talk/p2p/base/udpport.h"

#include "talk/base/asyncpacketsocket.h"
#include "talk/base/logging.h"
#include "talk/p2p/base/common.h"

namespace cricket {

const char LOCAL_PORT_TYPE[] = "local";

UDPPort::UDPPort(talk_base::Thread* thread,
                 talk_base::PacketSocketFactory* factory,
                 talk_base::Network* network,
                 const talk_base::IPAddress& ip, int min_port, int max_port,
                 const std::string& username, const std::string& password)
    : Port(thread, LOCAL_PORT_TYPE, factory, network, ip, min_port, max_port,
           username, password),
      socket_(NULL),
      error_(0) {
}

bool UDPPort::Init() {
  socket_ = socket_factory()->CreateUdpSocket(
      talk_base::SocketAddress(ip(), 0), min_port(), max_port());
  if (!socket_) {
    LOG_J(LS_WARNING, this) << "UDP socket creation failed";
    return false;
  }
  socket_->SignalAddressReady.connect(this, &UDPPort::OnAddressReady);
  socket_->SignalReadPacket.connect(this, &UDPPort::OnReadPacket);
  return true;
}

UDPPort::~UDPPort() {
  delete socket_;
}

void UDPPort::PrepareAddress() {
  if (socket_->GetState() == talk_base::AsyncPacketSocket::STATE_BOUND)
    AddAddress(socket_->GetLocalAddress(), "udp", true);
}

Connection* UDPPort::CreateConnection(const Candidate& address,
                                      CandidateOrigin origin) {
  if (address.protocol() != "udp")
    return NULL;

  Connection* conn = new ProxyConnection(this, 0, address);
  AddConnection(conn);
  return conn;
}

int UDPPort::SendTo(const void* data, size_t size,
                    const talk_base::SocketAddress& addr, bool payload) {
  int sent = socket_->SendTo(data, size, addr);
  if (sent < 0) {
    error_ = socket_->GetError();
    LOG_J(LS_ERROR, this) << "UDP send of " << size
                          << " bytes failed with error " << error_;
  }
  return sent;
}

int UDPPort::SetOption(talk_base::Socket::Option opt, int value) {
  return socket_->SetOption(opt, value);
}

int UDPPort::GetError() {
  return error_;
}

void UDPPort::OnAddressReady(talk_base::AsyncPacketSocket* socket,
                             const talk_base::SocketAddress& address) {
  AddAddress(address, "udp", true);
}

void UDPPort::OnReadPacket(
    talk_base::AsyncPacketSocket* socket, const char* data, size_t size,
    const talk_base::SocketAddress& remote_addr) {
  ASSERT(socket == socket_);
  if (Connection* conn = GetConnection(remote_addr)) {
    conn->OnReadPacket(data, size);
  } else {
    Port::OnReadPacket(data, size, remote_addr);
  }
}

}  // namespace cricket
