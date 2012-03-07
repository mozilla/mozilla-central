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
 * EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include "talk/app/webrtc/peerconnectionimpl.h"

#include <vector>

#include "talk/app/webrtc/mediastreamhandler.h"
#include "talk/app/webrtc/streamcollectionimpl.h"
#include "talk/base/logging.h"
#include "talk/base/stringencode.h"
#include "talk/session/phone/channelmanager.h"
#include "talk/session/phone/webrtcvideocapturer.h"

namespace {

// The number of the tokens in the config string.
static const size_t kConfigTokens = 2;
static const size_t kServiceCount = 5;
// The default stun port.
static const int kDefaultPort = 3478;

// NOTE: Must be in the same order as the ServiceType enum.
static const char* kValidServiceTypes[kServiceCount] = {
    "STUN", "STUNS", "TURN", "TURNS", "INVALID" };

enum ServiceType {
  STUN,     // Indicates a STUN server.
  STUNS,    // Indicates a STUN server used with a TLS session.
  TURN,     // Indicates a TURN server
  TURNS,    // Indicates a TURN server used with a TLS session.
  INVALID,  // Unknown.
};

enum {
  MSG_COMMITSTREAMCHANGES = 1,
  MSG_PROCESSSIGNALINGMESSAGE = 2,
  MSG_RETURNREMOTEMEDIASTREAMS = 3,
  MSG_CLOSE = 4,
  MSG_READYSTATE = 5,
  MSG_SDPSTATE = 6,
  MSG_TERMINATE = 7
};

typedef webrtc::PortAllocatorFactoryInterface::StunConfiguration
    StunConfiguration;
typedef webrtc::PortAllocatorFactoryInterface::TurnConfiguration
    TurnConfiguration;

bool static ParseConfigString(const std::string& config,
                              std::vector<StunConfiguration>* stun_config,
                              std::vector<TurnConfiguration>* turn_config) {
  std::vector<std::string> tokens;
  talk_base::tokenize(config, ' ', &tokens);

  if (tokens.size() != kConfigTokens) {
    LOG(WARNING) << "Invalid config string";
    return false;
  }

  ServiceType service_type = INVALID;

  const std::string& type = tokens[0];
  for (size_t i = 0; i < kServiceCount; ++i) {
    if (type.compare(kValidServiceTypes[i]) == 0) {
      service_type = static_cast<ServiceType>(i);
      break;
    }
  }

  if (service_type == INVALID) {
    LOG(WARNING) << "Invalid service type: " << type;
    return false;
  }
  std::string service_address = tokens[1];

  int port;
  tokens.clear();
  talk_base::tokenize(service_address, ':', &tokens);
  if (tokens.size() != kConfigTokens) {
    port = kDefaultPort;
  } else {
    port = talk_base::FromString<int>(tokens[1]);
    if (port <= 0 || port > 0xffff) {
      LOG(WARNING) << "Invalid port: " << tokens[1];
      return false;
    }
  }

  // TODO: Currently the specification does not tell us how to parse
  // multiple addresses, username and password from the configuration string.
  switch (service_type) {
    case STUN:
      stun_config->push_back(StunConfiguration(service_address, port));
      break;
    case TURN:
      turn_config->push_back(TurnConfiguration(service_address, port, "", ""));
      break;
    case TURNS:
    case STUNS:
    case INVALID:
    default:
      LOG(WARNING) << "Configuration not supported";
      return false;
  }
  return true;
}

struct SignalingParams : public talk_base::MessageData {
  SignalingParams(const std::string& msg,
                  webrtc::StreamCollectionInterface* local_streams)
      : msg(msg),
        local_streams(local_streams) {}
  const std::string msg;
  talk_base::scoped_refptr<webrtc::StreamCollectionInterface> local_streams;
};

struct StreamCollectionParams : public talk_base::MessageData {
  explicit StreamCollectionParams(webrtc::StreamCollectionInterface* streams)
      : streams(streams) {}
  talk_base::scoped_refptr<webrtc::StreamCollectionInterface> streams;
};

struct ReadyStateMessage : public talk_base::MessageData {
  ReadyStateMessage() : state(webrtc::PeerConnectionInterface::kNew) {}
  webrtc::PeerConnectionInterface::ReadyState state;
};

struct SdpStateMessage : public talk_base::MessageData {
  SdpStateMessage() : state(webrtc::PeerConnectionInterface::kSdpNew) {}
  webrtc::PeerConnectionInterface::SdpState state;
};

}  // namespace

namespace webrtc {

cricket::VideoCapturer* CreateVideoCapturer(VideoCaptureModule* vcm) {
  cricket::WebRtcVideoCapturer* video_capturer =
      new cricket::WebRtcVideoCapturer;
  if (!video_capturer->Init(vcm)) {
    delete video_capturer;
    video_capturer = NULL;
  }
  return video_capturer;
}

PeerConnection::PeerConnection(PeerConnectionFactory* factory)
    : factory_(factory),
      observer_(NULL),
      ready_state_(kNew),
      sdp_state_(kSdpNew),
      local_media_streams_(StreamCollection::Create()) {
}

PeerConnection::~PeerConnection() {
  signaling_thread()->Clear(this);
  signaling_thread()->Send(this, MSG_TERMINATE);
}

// Clean up what needs to be cleaned up on the signaling thread.
void PeerConnection::Terminate_s() {
  stream_handler_.reset();
  signaling_.reset();
  session_.reset();
  port_allocator_.reset();
}

bool PeerConnection::Initialize(const std::string& configuration,
                                PeerConnectionObserver* observer) {
  ASSERT(observer != NULL);
  if (!observer)
    return false;
  observer_ = observer;
  std::vector<PortAllocatorFactoryInterface::StunConfiguration> stun_config;
  std::vector<PortAllocatorFactoryInterface::TurnConfiguration> turn_config;

  ParseConfigString(configuration, &stun_config, &turn_config);

  port_allocator_.reset(factory_->port_allocator_factory()->CreatePortAllocator(
      stun_config, turn_config));

  session_.reset(new WebRtcSession(factory_->channel_manager(),
                                   factory_->signaling_thread(),
                                   factory_->worker_thread(),
                                   port_allocator_.get()));
  signaling_.reset(new PeerConnectionSignaling(factory_->signaling_thread(),
                                               session_.get()));
  stream_handler_.reset(new MediaStreamHandlers(session_.get()));

  signaling_->SignalNewPeerConnectionMessage.connect(
      this, &PeerConnection::OnNewPeerConnectionMessage);
  signaling_->SignalRemoteStreamAdded.connect(
      this, &PeerConnection::OnRemoteStreamAdded);
  signaling_->SignalRemoteStreamRemoved.connect(
      this, &PeerConnection::OnRemoteStreamRemoved);
  signaling_->SignalStateChange.connect(
      this, &PeerConnection::OnSignalingStateChange);
  // Register with WebRtcSession
  session_->RegisterObserver(signaling_.get());

  // Initialize the WebRtcSession. It creates transport channels etc.
  const bool result = session_->Initialize();
  if (result)
    ChangeReadyState(PeerConnectionInterface::kNegotiating);
  return result;
}

talk_base::scoped_refptr<StreamCollectionInterface>
PeerConnection::local_streams() {
  return local_media_streams_;
}

talk_base::scoped_refptr<StreamCollectionInterface>
PeerConnection::remote_streams() {
  StreamCollectionParams msg(NULL);
  signaling_thread()->Send(this, MSG_RETURNREMOTEMEDIASTREAMS, &msg);
  return msg.streams;
}

void PeerConnection::ProcessSignalingMessage(const std::string& msg) {
  SignalingParams* parameter(new SignalingParams(
      msg, StreamCollection::Create(local_media_streams_)));
  signaling_thread()->Post(this, MSG_PROCESSSIGNALINGMESSAGE, parameter);
}

void PeerConnection::AddStream(LocalMediaStreamInterface* local_stream) {
  local_media_streams_->AddStream(local_stream);
}

void PeerConnection::RemoveStream(LocalMediaStreamInterface* remove_stream) {
  local_media_streams_->RemoveStream(remove_stream);
}

void PeerConnection::CommitStreamChanges() {
  StreamCollectionParams* msg(new StreamCollectionParams(
          StreamCollection::Create(local_media_streams_)));
  signaling_thread()->Post(this, MSG_COMMITSTREAMCHANGES, msg);
}

void PeerConnection::Close() {
  signaling_thread()->Send(this, MSG_CLOSE);
}

PeerConnectionInterface::ReadyState PeerConnection::ready_state() {
  ReadyStateMessage msg;
  signaling_thread()->Send(this, MSG_READYSTATE, &msg);
  return msg.state;
}

PeerConnectionInterface::SdpState PeerConnection::sdp_state() {
  SdpStateMessage msg;
  signaling_thread()->Send(this, MSG_SDPSTATE, &msg);
  return msg.state;
}

void PeerConnection::OnMessage(talk_base::Message* msg) {
  talk_base::MessageData* data = msg->pdata;
  switch (msg->message_id) {
    case MSG_COMMITSTREAMCHANGES: {
      if (ready_state_ != PeerConnectionInterface::kClosed ||
          ready_state_ != PeerConnectionInterface::kClosing) {
        StreamCollectionParams* param(
            static_cast<StreamCollectionParams*> (data));
        signaling_->CreateOffer(param->streams);
        stream_handler_->CommitLocalStreams(param->streams);
      }
      delete data;  // Because it is Posted.
      break;
    }
    case MSG_PROCESSSIGNALINGMESSAGE: {
      if (ready_state_ != PeerConnectionInterface::kClosed) {
        SignalingParams* params(static_cast<SignalingParams*> (data));
        signaling_->ProcessSignalingMessage(params->msg, params->local_streams);
      }
      delete data;  // Because it is Posted.
      break;
    }
    case MSG_RETURNREMOTEMEDIASTREAMS: {
      StreamCollectionParams* param(
          static_cast<StreamCollectionParams*> (data));
      param->streams = StreamCollection::Create(signaling_->remote_streams());
      break;
    }
    case MSG_CLOSE: {
      if (ready_state_ != PeerConnectionInterface::kClosed) {
        ChangeReadyState(PeerConnectionInterface::kClosing);
        signaling_->SendShutDown();
      }
      break;
    }
    case MSG_READYSTATE: {
      ReadyStateMessage* msg(static_cast<ReadyStateMessage*> (data));
      msg->state = ready_state_;
      break;
    }
    case MSG_SDPSTATE: {
      SdpStateMessage* msg(static_cast<SdpStateMessage*> (data));
      msg->state = sdp_state_;
      break;
    }
    case MSG_TERMINATE: {
      Terminate_s();
      break;
    }
    default:
      ASSERT(!"NOT IMPLEMENTED");
      break;
  }
}

void PeerConnection::OnNewPeerConnectionMessage(const std::string& message) {
  observer_->OnSignalingMessage(message);
}

void PeerConnection::OnRemoteStreamAdded(MediaStreamInterface* remote_stream) {
  stream_handler_->AddRemoteStream(remote_stream);
  observer_->OnAddStream(remote_stream);
}

void PeerConnection::OnRemoteStreamRemoved(
    MediaStreamInterface* remote_stream) {
  stream_handler_->RemoveRemoteStream(remote_stream);
  observer_->OnRemoveStream(remote_stream);
}

void PeerConnection::OnSignalingStateChange(
    PeerConnectionSignaling::State state) {
  switch (state) {
    case PeerConnectionSignaling::kInitializing:
      break;
    case PeerConnectionSignaling::kIdle:
      if (ready_state_ == PeerConnectionInterface::kNegotiating)
        ChangeReadyState(PeerConnectionInterface::kActive);
      ChangeSdpState(PeerConnectionInterface::kSdpIdle);
      break;
    case PeerConnectionSignaling::kWaitingForAnswer:
      ChangeSdpState(PeerConnectionInterface::kSdpWaiting);
      break;
    case PeerConnectionSignaling::kWaitingForOK:
      ChangeSdpState(PeerConnectionInterface::kSdpWaiting);
      break;
    case PeerConnectionSignaling::kShutingDown:
      ChangeReadyState(PeerConnectionInterface::kClosing);
      break;
    case PeerConnectionSignaling::kShutdownComplete:
      ChangeReadyState(PeerConnectionInterface::kClosed);
      signaling_thread()->Post(this, MSG_TERMINATE);
      break;
    default:
      ASSERT(!"NOT IMPLEMENTED");
      break;
  }
}

void PeerConnection::ChangeReadyState(
    PeerConnectionInterface::ReadyState ready_state) {
  ready_state_ = ready_state;
  observer_->OnStateChange(PeerConnectionObserver::kReadyState);
}

void PeerConnection::ChangeSdpState(
    PeerConnectionInterface::SdpState sdp_state) {
  sdp_state_ = sdp_state;
  observer_->OnStateChange(PeerConnectionObserver::kSdpState);
}

}  // namespace webrtc
