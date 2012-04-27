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

#include "talk/p2p/base/portallocator.h"

#include "talk/p2p/base/portallocatorsessionproxy.h"

namespace cricket {

// Mediaproxy expects username to be 16 bytes.
static const int kUsernameLength = 16;
// Minimum password length of 22 characters as per RFC5245.
static const int kPasswordLength = 22;

PortAllocatorSession::PortAllocatorSession(const std::string& name,
                                           const std::string& session_type,
                                           uint32 flags)
    : name_(name),
      session_type_(session_type),
      flags_(flags),
      username_(talk_base::CreateRandomString(kUsernameLength)),
      password_(talk_base::CreateRandomString(kPasswordLength)) {
}

PortAllocator::~PortAllocator() {
  for (SessionMuxerMap::iterator iter = muxers_.begin();
       iter != muxers_.end(); ++iter) {
    delete iter->second;
  }
}

PortAllocatorSession* PortAllocator::CreateSession(
    const std::string& sid,
    const std::string& name,
    const std::string& session_type) {
  if (flags_ & PORTALLOCATOR_ENABLE_BUNDLE) {
    PortAllocatorSessionMuxer* muxer = GetSessionMuxer(sid);
    if (!muxer) {
      PortAllocatorSession* session_impl = CreateSession(name, session_type);
      // Create PortAllocatorSessionMuxer object for |session_impl|.
      muxer = new PortAllocatorSessionMuxer(session_impl);
      muxer->SignalDestroyed.connect(
          this, &PortAllocator::OnSessionMuxerDestroyed);
      // Add PortAllocatorSession to the map.
      muxers_[sid] = muxer;
    }
    PortAllocatorSessionProxy* proxy =
        new PortAllocatorSessionProxy(name, session_type, flags_);
    muxer->RegisterSessionProxy(proxy);
    return proxy;
  }
  return CreateSession(name, session_type);
}

PortAllocatorSessionMuxer* PortAllocator::GetSessionMuxer(
    const std::string& sid) const {
  SessionMuxerMap::const_iterator iter = muxers_.find(sid);
  if (iter != muxers_.end())
    return iter->second;
  return NULL;
}

void PortAllocator::OnSessionMuxerDestroyed(
    PortAllocatorSessionMuxer* session) {
  SessionMuxerMap::iterator iter;
  for (iter = muxers_.begin(); iter != muxers_.end(); ++iter) {
    if (iter->second == session)
      break;
  }
  if (iter != muxers_.end())
    muxers_.erase(iter);
}

}  // namespace cricket
