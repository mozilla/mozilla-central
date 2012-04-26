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

#include "talk/app/webrtc/peerconnectionfactoryimpl.h"

#include "talk/app/webrtc/mediastreamproxy.h"
#include "talk/app/webrtc/mediastreamtrackproxy.h"
#include "talk/app/webrtc/peerconnectionimpl.h"
#include "talk/app/webrtc/portallocatorfactory.h"
#include "talk/session/phone/dummydevicemanager.h"
#include "talk/session/phone/webrtcmediaengine.h"

#ifdef WEBRTC_RELATIVE_PATH
#include "modules/audio_device/main/interface/audio_device.h"
#else
#include "third_party/webrtc/files/include/audio_device.h"
#endif

using talk_base::scoped_refptr;

namespace {

typedef talk_base::TypedMessageData<bool> InitMessageData;

struct CreatePeerConnectionParams : public talk_base::MessageData {
  CreatePeerConnectionParams(bool use_roap,
                             const std::string& configuration,
                             webrtc::PeerConnectionObserver* observer)
      : use_roap(use_roap), configuration(configuration), observer(observer) {
  }
  bool use_roap;
  scoped_refptr<webrtc::PeerConnectionInterface> peerconnection;
  const std::string& configuration;
  webrtc::PeerConnectionObserver* observer;
};

enum {
  MSG_INIT_FACTORY = 1,
  MSG_TERMINATE_FACTORY = 2,
  MSG_CREATE_PEERCONNECTION = 3,
};

}  // namespace

namespace webrtc {

scoped_refptr<PeerConnectionFactoryInterface>
CreatePeerConnectionFactory() {
  talk_base::RefCountedObject<PeerConnectionFactory>* pc_factory =
      new talk_base::RefCountedObject<PeerConnectionFactory>();

  if (!pc_factory->Initialize()) {
    delete pc_factory;
    pc_factory = NULL;
  }
  return pc_factory;
}

scoped_refptr<PeerConnectionFactoryInterface>
CreatePeerConnectionFactory(talk_base::Thread* worker_thread,
                            talk_base::Thread* signaling_thread,
                            PortAllocatorFactoryInterface* factory,
                            AudioDeviceModule* default_adm) {
  talk_base::RefCountedObject<PeerConnectionFactory>* pc_factory =
      new talk_base::RefCountedObject<PeerConnectionFactory>(
          worker_thread, signaling_thread, factory, default_adm);
  if (!pc_factory->Initialize()) {
    delete pc_factory;
    pc_factory = NULL;
  }
  return pc_factory;
}

PeerConnectionFactory::PeerConnectionFactory()
    : owns_ptrs_(true),
      signaling_thread_(new talk_base::Thread),
      worker_thread_(new talk_base::Thread) {
  bool result = signaling_thread_->Start();
  ASSERT(result);
  result = worker_thread_->Start();
  ASSERT(result);
}

PeerConnectionFactory::PeerConnectionFactory(
    talk_base::Thread* worker_thread,
    talk_base::Thread* signaling_thread,
    PortAllocatorFactoryInterface* port_allocator_factory,
    AudioDeviceModule* default_adm)
    : owns_ptrs_(false),
      signaling_thread_(signaling_thread),
      worker_thread_(worker_thread),
      allocator_factory_(port_allocator_factory),
      default_adm_(default_adm) {
  ASSERT(worker_thread != NULL);
  ASSERT(signaling_thread != NULL);
  ASSERT(allocator_factory_.get() != NULL);
  // TODO: Currently there is no way creating an external adm in
  // libjingle source tree. So we can 't currently assert if this is NULL.
  // ASSERT(default_adm != NULL);
}

PeerConnectionFactory::~PeerConnectionFactory() {
  signaling_thread_->Clear(this);
  signaling_thread_->Send(this, MSG_TERMINATE_FACTORY);
  if (owns_ptrs_) {
    delete signaling_thread_;
    delete worker_thread_;
  }
}

bool PeerConnectionFactory::Initialize() {
  InitMessageData result(false);
  signaling_thread_->Send(this, MSG_INIT_FACTORY, &result);
  return result.data();
}

void PeerConnectionFactory::OnMessage(talk_base::Message* msg) {
  switch (msg->message_id) {
    case MSG_INIT_FACTORY: {
     InitMessageData* pdata = static_cast<InitMessageData*> (msg->pdata);
     pdata->data() = Initialize_s();
     break;
    }
    case MSG_TERMINATE_FACTORY: {
      Terminate_s();
      break;
    }
    case MSG_CREATE_PEERCONNECTION: {
      CreatePeerConnectionParams* pdata =
          static_cast<CreatePeerConnectionParams*> (msg->pdata);
      pdata->peerconnection = CreatePeerConnection_s(pdata->use_roap,
                                                     pdata->configuration,
                                                     pdata->observer);
      break;
    }
  }
}

bool PeerConnectionFactory::Initialize_s() {
  if (owns_ptrs_) {
    allocator_factory_ = PortAllocatorFactory::Create(worker_thread_);
    if (allocator_factory_.get() == NULL)
      return false;
  }

  cricket::DummyDeviceManager* device_manager(
      new cricket::DummyDeviceManager());
  // TODO:  Need to make sure only one VoE is created inside
  // WebRtcMediaEngine.
  cricket::WebRtcMediaEngine* webrtc_media_engine(
      new cricket::WebRtcMediaEngine(default_adm_.get(),
                                     NULL));   // No secondary adm.

  channel_manager_.reset(new cricket::ChannelManager(
      webrtc_media_engine, device_manager, worker_thread_));
  if (!channel_manager_->Init()) {
    return false;
  }
  return true;
}

// Terminate what we created on the signaling thread.
void PeerConnectionFactory::Terminate_s() {
  channel_manager_.reset(NULL);
  if (owns_ptrs_) {
    allocator_factory_ = NULL;
  }
}

scoped_refptr<PeerConnectionInterface>
PeerConnectionFactory::CreatePeerConnection(
    const std::string& configuration,
    PeerConnectionObserver* observer) {
  CreatePeerConnectionParams params(false, configuration, observer);
  signaling_thread_->Send(this, MSG_CREATE_PEERCONNECTION, &params);
  return params.peerconnection;
}

talk_base::scoped_refptr<PeerConnectionInterface>
PeerConnectionFactory::CreateRoapPeerConnection(
    const std::string& configuration,
    PeerConnectionObserver* observer) {
  CreatePeerConnectionParams params(true, configuration, observer);
  signaling_thread_->Send(this, MSG_CREATE_PEERCONNECTION, &params);
  return params.peerconnection;
}

scoped_refptr<PeerConnectionInterface>
PeerConnectionFactory::CreatePeerConnection_s(
    bool use_roap,
    const std::string& configuration,
    PeerConnectionObserver* observer) {
  talk_base::RefCountedObject<PeerConnection>* pc(
      new talk_base::RefCountedObject<PeerConnection>(this));
  if (!pc->Initialize(use_roap, configuration, observer)) {
    delete pc;
    pc = NULL;
  }
  return pc;
}

scoped_refptr<LocalMediaStreamInterface>
PeerConnectionFactory::CreateLocalMediaStream(
      const std::string& label) {
  return MediaStreamProxy::Create(label, signaling_thread_);
}

scoped_refptr<LocalVideoTrackInterface>
PeerConnectionFactory::CreateLocalVideoTrack(
    const std::string& label,
    cricket::VideoCapturer* video_device) {
  return VideoTrackProxy::CreateLocal(label, video_device,
                                      signaling_thread_);
}

scoped_refptr<LocalAudioTrackInterface>
PeerConnectionFactory::CreateLocalAudioTrack(
    const std::string& label,
    AudioDeviceModule* audio_device) {
  return AudioTrackProxy::CreateLocal(label, audio_device,
                                      signaling_thread_);
}

cricket::ChannelManager* PeerConnectionFactory::channel_manager() {
  return channel_manager_.get();
}

talk_base::Thread* PeerConnectionFactory::signaling_thread() {
  return signaling_thread_;
}

talk_base::Thread* PeerConnectionFactory::worker_thread() {
  return worker_thread_;
}

PortAllocatorFactoryInterface* PeerConnectionFactory::port_allocator_factory() {
  return allocator_factory_.get();
}

}  // namespace webrtc
