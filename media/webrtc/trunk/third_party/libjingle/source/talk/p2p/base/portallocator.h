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

#ifndef TALK_P2P_BASE_PORTALLOCATOR_H_
#define TALK_P2P_BASE_PORTALLOCATOR_H_

#include <string>
#include <vector>

#include "talk/base/sigslot.h"
#include "talk/p2p/base/port.h"

namespace cricket {

// PortAllocator is responsible for allocating Port types for a given
// P2PSocket. It also handles port freeing.
//
// Clients can override this class to control port allocation, including
// what kinds of ports are allocated.

const uint32 PORTALLOCATOR_DISABLE_UDP = 0x01;
const uint32 PORTALLOCATOR_DISABLE_STUN = 0x02;
const uint32 PORTALLOCATOR_DISABLE_RELAY = 0x04;
const uint32 PORTALLOCATOR_DISABLE_TCP = 0x08;
const uint32 PORTALLOCATOR_ENABLE_SHAKER = 0x10;

const uint32 kDefaultPortAllocatorFlags = 0;

class PortAllocatorSession : public sigslot::has_slots<> {
 public:
  explicit PortAllocatorSession(uint32 flags) : flags_(flags) {}

  // Subclasses should clean up any ports created.
  virtual ~PortAllocatorSession() {}

  uint32 flags() const { return flags_; }
  void set_flags(uint32 flags) { flags_ = flags; }

  // Prepares an initial set of ports to try.
  virtual void GetInitialPorts() = 0;

  // Starts and stops the flow of additional ports to try.
  virtual void StartGetAllPorts() = 0;
  virtual void StopGetAllPorts() = 0;
  virtual bool IsGettingAllPorts() = 0;

  sigslot::signal2<PortAllocatorSession*, Port*> SignalPortReady;
  sigslot::signal2<PortAllocatorSession*,
                   const std::vector<Candidate>&> SignalCandidatesReady;

  uint32 generation() { return generation_; }
  void set_generation(uint32 generation) { generation_ = generation; }

 private:
  uint32 flags_;
  uint32 generation_;
};

class PortAllocator {
 public:
  PortAllocator() :
      flags_(kDefaultPortAllocatorFlags),
      min_port_(0),
      max_port_(0) {
  }
  virtual ~PortAllocator() {}

  virtual PortAllocatorSession *CreateSession(const std::string &name,
      const std::string &session_type) = 0;

  uint32 flags() const { return flags_; }
  void set_flags(uint32 flags) { flags_ = flags; }

  const std::string& user_agent() const { return agent_; }
  const talk_base::ProxyInfo& proxy() const { return proxy_; }
  void set_proxy(const std::string& agent, const talk_base::ProxyInfo& proxy) {
    agent_ = agent;
    proxy_ = proxy;
  }

  // Gets/Sets the port range to use when choosing client ports.
  int min_port() const { return min_port_; }
  int max_port() const { return max_port_; }
  bool SetPortRange(int min_port, int max_port) {
    if (min_port > max_port) {
      return false;
    }

    min_port_ = min_port;
    max_port_ = max_port;
    return true;
  }

 protected:
  uint32 flags_;
  std::string agent_;
  talk_base::ProxyInfo proxy_;
  int min_port_;
  int max_port_;
};

}  // namespace cricket

#endif  // TALK_P2P_BASE_PORTALLOCATOR_H_
