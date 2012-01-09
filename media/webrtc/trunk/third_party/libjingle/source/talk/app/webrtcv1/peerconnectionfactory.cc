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

#include "talk/app/webrtcv1/peerconnectionfactory.h"

#include "talk/app/webrtcv1/peerconnectionproxy.h"
#include "talk/base/logging.h"
#include "talk/p2p/client/basicportallocator.h"
#include "talk/session/phone/channelmanager.h"

namespace webrtc {

PeerConnectionFactory::PeerConnectionFactory(
    cricket::MediaEngineInterface* media_engine,
    cricket::DeviceManagerInterface* device_manager,
    talk_base::Thread* worker_thread)
    : initialized_(false),
      channel_manager_(new cricket::ChannelManager(media_engine,
                                                   device_manager,
                                                   worker_thread)) {
}

PeerConnectionFactory::PeerConnectionFactory(
    talk_base::Thread* worker_thread)
    : initialized_(false),
      channel_manager_(new cricket::ChannelManager(worker_thread)) {
}

PeerConnectionFactory::~PeerConnectionFactory() {
}

bool PeerConnectionFactory::Initialize() {
  ASSERT(channel_manager_.get() != NULL);
  initialized_ = channel_manager_->Init();
  return initialized_;
}

PeerConnection* PeerConnectionFactory::CreatePeerConnection(
    cricket::PortAllocator* port_allocator,
    talk_base::Thread* signaling_thread) {
  PeerConnectionProxy* pc = NULL;
  if (initialized_) {
    pc =  new PeerConnectionProxy(
        port_allocator, channel_manager_.get(), signaling_thread);
    if (!pc->Init()) {
      LOG(LERROR) << "Error in initializing PeerConnection";
      delete pc;
      pc = NULL;
    }
  } else {
    LOG(LERROR) << "PeerConnectionFactory is not initialize";
  }
  return pc;
}

}  // namespace webrtc
