/*
 * libjingle
 * Copyright 2004--2008, Google Inc.
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

#ifndef TALK_P2P_CLIENT_HTTPPORTALLOCATOR_H_
#define TALK_P2P_CLIENT_HTTPPORTALLOCATOR_H_

#include <string>
#include <vector>
#include "talk/p2p/client/basicportallocator.h"

namespace talk_base {
class SignalThread;
}

namespace cricket {

class HttpPortAllocator : public BasicPortAllocator {
 public:
  // Records the port on the hosts that will receive HTTP requests.
  static const int kHostPort;

  // The number of HTTP requests we should attempt before giving up.
  static const int kNumRetries;

  // Records the URL that we will GET in order to create a session.
  static const char kCreateSessionURL[];

  HttpPortAllocator(talk_base::NetworkManager* network_manager,
                    const std::string& user_agent);
  HttpPortAllocator(talk_base::NetworkManager* network_manager,
                    talk_base::PacketSocketFactory* socket_factory,
                    const std::string& user_agent);
  virtual ~HttpPortAllocator();

  virtual PortAllocatorSession* CreateSession(const std::string& name,
                                              const std::string& session_type);
  void SetStunHosts(const std::vector<talk_base::SocketAddress>& hosts) {
    if (!hosts.empty()) {
      stun_hosts_ = hosts;
    }
  }
  void SetRelayHosts(const std::vector<std::string>& hosts) {
    if (!hosts.empty()) {
      relay_hosts_ = hosts;
    }
  }
  void SetRelayToken(const std::string& relay) { relay_token_ = relay; }

  const std::vector<talk_base::SocketAddress>& stun_hosts() const {
    return stun_hosts_;
  }

  const std::vector<std::string>& relay_hosts() const {
    return relay_hosts_;
  }

  const std::string& relay_token() const {
    return relay_token_;
  }

  const std::string& user_agent() const {
    return agent_;
  }

 private:
  std::vector<talk_base::SocketAddress> stun_hosts_;
  std::vector<std::string> relay_hosts_;
  std::string relay_token_;
  std::string agent_;
};

class RequestData;

class HttpPortAllocatorSession : public BasicPortAllocatorSession {
 public:
  HttpPortAllocatorSession(
      HttpPortAllocator* allocator,
      const std::string& name,
      const std::string& session_type,
      const std::vector<talk_base::SocketAddress>& stun_hosts,
      const std::vector<std::string>& relay_hosts,
      const std::string& relay,
      const std::string& agent);
  virtual ~HttpPortAllocatorSession() {}

  const std::string& relay_token() const {
    return relay_token_;
  }
  virtual void SendSessionRequest(const std::string& host, int port);
  virtual void ReceiveSessionResponse(const std::string& response);

 protected:
  virtual void GetPortConfigurations();
  void TryCreateRelaySession();

 private:
  virtual HttpPortAllocator* allocator() {
    return static_cast<HttpPortAllocator*>(
        BasicPortAllocatorSession::allocator());
  }

  void OnRequestDone(talk_base::SignalThread* request);

  std::vector<std::string> relay_hosts_;
  std::vector<talk_base::SocketAddress> stun_hosts_;
  std::string relay_token_;
  std::string agent_;
  int attempts_;
};

}  // namespace cricket

#endif  // TALK_P2P_CLIENT_HTTPPORTALLOCATOR_H_
