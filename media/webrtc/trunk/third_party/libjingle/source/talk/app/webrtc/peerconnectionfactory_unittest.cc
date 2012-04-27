/*
 * libjingle
 * Copyright 2011, Google Inc.
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
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include <string>

#include "talk/app/webrtc/mediastream.h"
#include "talk/app/webrtc/peerconnectionfactoryimpl.h"
#include "talk/app/webrtc/fakeportallocatorfactory.h"
#include "talk/base/gunit.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/thread.h"
#include "talk/session/phone/webrtccommon.h"
#include "talk/session/phone/webrtcvoe.h"

static const char kStunConfiguration[] = "STUN stun.l.google.com:19302";

namespace webrtc {

class NullPeerConnectionObserver : public PeerConnectionObserver {
 public:
  virtual void OnError() {}
  virtual void OnMessage(const std::string& msg) {}
  virtual void OnSignalingMessage(const std::string& msg) {}
  virtual void OnStateChange(StateType state_changed) {}
  virtual void OnAddStream(MediaStreamInterface* stream) {}
  virtual void OnRemoveStream(MediaStreamInterface* stream) {}
  virtual void OnIceCandidate(const webrtc::IceCandidateInterface* candidate) {}
  virtual void OnIceComplete() {}
};

TEST(PeerConnectionFactory, CreatePCUsingInternalModules) {
  talk_base::scoped_refptr<PeerConnectionFactoryInterface> factory(
      CreatePeerConnectionFactory());
  ASSERT_TRUE(factory.get() != NULL);

  NullPeerConnectionObserver observer;
  talk_base::scoped_refptr<PeerConnectionInterface> pc(
      factory->CreatePeerConnection(kStunConfiguration, &observer));

  EXPECT_TRUE(pc.get() != NULL);
}

TEST(PeerConnectionFactory, CreatePCUsingExternalModules) {
  talk_base::scoped_refptr<PortAllocatorFactoryInterface> allocator_factory(
      FakePortAllocatorFactory::Create());

  talk_base::scoped_refptr<PeerConnectionFactoryInterface> factory =
      CreatePeerConnectionFactory(talk_base::Thread::Current(),
                                  talk_base::Thread::Current(),
                                  allocator_factory.get(),
                                  NULL);
  ASSERT_TRUE(factory.get() != NULL);

  NullPeerConnectionObserver observer;
  talk_base::scoped_refptr<PeerConnectionInterface> pc(
      factory->CreatePeerConnection(kStunConfiguration, &observer));
  EXPECT_TRUE(pc.get() != NULL);
}

}  // namespace webrtc
