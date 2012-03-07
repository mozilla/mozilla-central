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

#ifndef TALK_P2P_BASE_PORTALLOCATORSESSIONPROXY_H_
#define TALK_P2P_BASE_PORTALLOCATORSESSIONPROXY_H_

#include <string>

#include "talk/p2p/base/candidate.h"
#include "talk/p2p/base/portallocator.h"

namespace cricket {
class PortAllocator;
class PortAllocatorSessionProxy;
class PortProxy;

// This class maintains the list of cricket::Port* objects. Ports will be
// deleted upon receiving SignalDestroyed signal. This class is used when
// PORTALLOCATOR_ENABLE_BUNDLE flag is set.

class PortAllocatorSessionMuxer : public sigslot::has_slots<> {
 public:
  explicit PortAllocatorSessionMuxer(PortAllocatorSession* session);
  virtual ~PortAllocatorSessionMuxer();

  void RegisterSessionProxy(PortAllocatorSessionProxy* session_proxy);

  void OnPortReady(PortAllocatorSession* session, Port* port);
  void OnPortDestroyed(Port* port);

  const std::vector<Port*>& ports() { return ports_; }

  sigslot::signal1<PortAllocatorSessionMuxer*> SignalDestroyed;

 private:
  void OnSessionProxyDestroyed(PortAllocatorSession* proxy);

  // Port will be deleted when SignalDestroyed received, otherwise delete
  // happens when PortAllocatorSession dtor is called.
  std::vector<Port*> ports_;
  talk_base::scoped_ptr<PortAllocatorSession> session_;
  std::vector<PortAllocatorSessionProxy*> session_proxies_;
};

class PortAllocatorSessionProxy : public PortAllocatorSession {
 public:
  PortAllocatorSessionProxy(const std::string& name,
                            const std::string& session_type,
                            uint32 flags)
      : PortAllocatorSession(name, session_type, flags),
        impl_(NULL) {}

  virtual ~PortAllocatorSessionProxy();

  PortAllocatorSession* impl() { return impl_; }
  void set_impl(PortAllocatorSession* session);

  // Forwards call to the actual PortAllocatorSession.
  virtual void GetInitialPorts();
  virtual void StartGetAllPorts();
  virtual void StopGetAllPorts();
  virtual bool IsGettingAllPorts();

 private:
  void OnPortReady(PortAllocatorSession* session, Port* port);
  void OnCandidatesReady(PortAllocatorSession* session,
                         const std::vector<Candidate>& candidates);
  void OnPortDestroyed(Port* port);

  // This is the actual PortAllocatorSession, owned by PortAllocator.
  PortAllocatorSession* impl_;
  std::map<Port*, PortProxy*> proxy_ports_;
};

}  // namespace cricket

#endif  // TALK_P2P_BASE_PORTALLOCATORSESSIONPROXY_H_
