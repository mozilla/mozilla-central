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
// Only the STUN or TURN server address appears in the config string.
static const size_t kConfigAddress = 1;
// Both of the STUN or TURN server address and port appear in the config string.
static const size_t kConfigAddressAndPort = 2;
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
  MSG_ADDSTREAM = 1,
  MSG_REMOVESTREAM = 2,
  MSG_COMMITSTREAMCHANGES = 3,
  MSG_PROCESSSIGNALINGMESSAGE = 4,
  MSG_RETURNLOCALMEDIASTREAMS = 5,
  MSG_RETURNREMOTEMEDIASTREAMS = 6,
  MSG_CLOSE = 7,
  MSG_READYSTATE = 8,
  MSG_SDPSTATE = 9,
  MSG_TERMINATE = 10,
  MSG_STARTICE = 11,
  MSG_CREATEOFFER = 12,
  MSG_CREATEANSWER = 13,
  MSG_SETLOCALDESCRIPTION = 14,
  MSG_SETREMOTEDESCRIPTION = 15,
  MSG_PROCESSICEMESSAGE = 16,
  MSG_GETLOCALDESCRIPTION = 17,
  MSG_GETREMOTEDESCRIPTION = 18,
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

  std::string address;
  int port;
  tokens.clear();
  talk_base::tokenize(service_address, ':', &tokens);
  if (tokens.size() != kConfigAddress &&
      tokens.size() != kConfigAddressAndPort) {
    LOG(WARNING) << "Invalid server address and port: " << service_address;
    return false;
  }

  if (tokens.size() == kConfigAddress) {
    address = tokens[0];
    port = kDefaultPort;
  } else {
    address = tokens[0];
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
      stun_config->push_back(StunConfiguration(address, port));
      break;
    case TURN:
      turn_config->push_back(TurnConfiguration(address, port, "", ""));
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

typedef talk_base::TypedMessageData<webrtc::LocalMediaStreamInterface*>
    LocalMediaStreamParams;

typedef talk_base::TypedMessageData<std::string> RoapSignalingParams;

struct IceOptionsParams : public talk_base::MessageData {
  explicit IceOptionsParams(webrtc::JsepInterface::IceOptions options)
      : options(options),
        result(false) {
  }
  webrtc::JsepInterface::IceOptions options;
  bool result;
};

struct JsepSessionDescriptionParams : public talk_base::MessageData {
  JsepSessionDescriptionParams()
      : result(false),
        desc(NULL),
        const_desc(NULL) {}
  bool result;
  webrtc::MediaHints hints;
  webrtc::JsepInterface::Action action;
  webrtc::SessionDescriptionInterface* desc;
  const webrtc::SessionDescriptionInterface* const_desc;
};

struct JsepIceCandidateParams : public talk_base::MessageData {
  explicit JsepIceCandidateParams(
      const webrtc::IceCandidateInterface* candidate)
      : result(false),
        candidate(candidate) {}
  bool result;
  const webrtc::IceCandidateInterface* candidate;
};

struct StreamCollectionParams : public talk_base::MessageData {
  explicit StreamCollectionParams(webrtc::StreamCollectionInterface* streams)
      : streams(streams) {}
  talk_base::scoped_refptr<webrtc::StreamCollectionInterface> streams;
};

struct MediaStreamParams : public talk_base::MessageData {
  explicit MediaStreamParams(webrtc::MediaStreamInterface* stream)
      : stream(stream) {}
  talk_base::scoped_refptr<webrtc::MediaStreamInterface> stream;
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
  roap_signaling_.reset();
  mediastream_signaling_.reset();
  session_.reset();
  port_allocator_.reset();
}

bool PeerConnection::Initialize(bool use_roap,
                                const std::string& configuration,
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

  mediastream_signaling_.reset(new MediaStreamSignaling(
      factory_->signaling_thread(), this));

  session_.reset(new WebRtcSession(factory_->channel_manager(),
                                   factory_->signaling_thread(),
                                   factory_->worker_thread(),
                                   port_allocator_.get(),
                                   mediastream_signaling_.get()));
  stream_handler_.reset(new MediaStreamHandlers(session_.get()));

  // Initialize the WebRtcSession. It creates transport channels etc.
  if (!session_->Initialize())
    return false;

  if (use_roap) {
    roap_signaling_.reset(new RoapSignaling(
        mediastream_signaling_.get(),
        session_.get()));
    // Register Roap as receiver of local ice candidates.
    session_->RegisterObserver(roap_signaling_.get());
    roap_signaling_->SignalNewPeerConnectionMessage.connect(
        this, &PeerConnection::OnNewPeerConnectionMessage);
    roap_signaling_->SignalStateChange.connect(
        this, &PeerConnection::OnSignalingStateChange);
    ChangeReadyState(PeerConnectionInterface::kNegotiating);
  } else {
    // Register PeerConnection observer as receiver of local ice candidates.
    session_->RegisterObserver(observer_);
    session_->SignalState.connect(this, &PeerConnection::OnSessionStateChange);
  }
  return true;
}

talk_base::scoped_refptr<StreamCollectionInterface>
PeerConnection::local_streams() {
  StreamCollectionParams msg(NULL);
  signaling_thread()->Send(this, MSG_RETURNLOCALMEDIASTREAMS, &msg);
  return msg.streams;
}

talk_base::scoped_refptr<StreamCollectionInterface>
PeerConnection::remote_streams() {
  StreamCollectionParams msg(NULL);
  signaling_thread()->Send(this, MSG_RETURNREMOTEMEDIASTREAMS, &msg);
  return msg.streams;
}

void PeerConnection::ProcessSignalingMessage(const std::string& msg) {
  RoapSignalingParams parameter(msg);
  signaling_thread()->Send(this, MSG_PROCESSSIGNALINGMESSAGE, &parameter);
}

void PeerConnection::AddStream(LocalMediaStreamInterface* local_stream) {
  LocalMediaStreamParams msg(local_stream);
  signaling_thread()->Send(this, MSG_ADDSTREAM, &msg);
}

void PeerConnection::RemoveStream(LocalMediaStreamInterface* remove_stream) {
  LocalMediaStreamParams msg(remove_stream);
  signaling_thread()->Send(this, MSG_REMOVESTREAM, &msg);
}

void PeerConnection::CommitStreamChanges() {
  signaling_thread()->Send(this, MSG_COMMITSTREAMCHANGES);
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

bool PeerConnection::StartIce(IceOptions options) {
  IceOptionsParams msg(options);
  signaling_thread()->Send(this, MSG_STARTICE, &msg);
  return msg.result;
}

SessionDescriptionInterface* PeerConnection::CreateOffer(
    const MediaHints& hints) {
  JsepSessionDescriptionParams msg;
  msg.hints = hints;
  signaling_thread()->Send(this, MSG_CREATEOFFER, &msg);
  return msg.desc;
}

SessionDescriptionInterface* PeerConnection::CreateAnswer(
    const MediaHints& hints,
    const SessionDescriptionInterface* offer) {
  JsepSessionDescriptionParams msg;
  msg.hints = hints;
  msg.const_desc = offer;
  signaling_thread()->Send(this, MSG_CREATEANSWER, &msg);
  return msg.desc;
}

bool PeerConnection::SetLocalDescription(Action action,
                                         SessionDescriptionInterface* desc) {
  JsepSessionDescriptionParams msg;
  msg.action = action;
  msg.desc = desc;
  signaling_thread()->Send(this, MSG_SETLOCALDESCRIPTION, &msg);
  return msg.result;
}

bool PeerConnection::SetRemoteDescription(Action action,
                                          SessionDescriptionInterface* desc) {
  JsepSessionDescriptionParams msg;
  msg.action = action;
  msg.desc = desc;
  signaling_thread()->Send(this, MSG_SETREMOTEDESCRIPTION, &msg);
  return msg.result;
}

bool PeerConnection::ProcessIceMessage(
    const IceCandidateInterface* ice_candidate) {
  JsepIceCandidateParams msg(ice_candidate);
  signaling_thread()->Send(this, MSG_PROCESSICEMESSAGE, &msg);
  return msg.result;
}

const SessionDescriptionInterface* PeerConnection::local_description() const {
  JsepSessionDescriptionParams msg;
  signaling_thread()->Send(const_cast<PeerConnection*>(this),
                           MSG_GETLOCALDESCRIPTION, &msg);
  return msg.const_desc;
}

const SessionDescriptionInterface* PeerConnection::remote_description() const {
  JsepSessionDescriptionParams msg;
  signaling_thread()->Send(const_cast<PeerConnection*>(this),
                           MSG_GETREMOTEDESCRIPTION, &msg);
  return msg.const_desc;
}

void PeerConnection::OnMessage(talk_base::Message* msg) {
  talk_base::MessageData* data = msg->pdata;
  switch (msg->message_id) {
    case MSG_ADDSTREAM: {
      LocalMediaStreamParams* msg(static_cast<LocalMediaStreamParams*> (data));
      local_media_streams_->AddStream(msg->data());
      break;
    }
    case MSG_REMOVESTREAM: {
      LocalMediaStreamParams* msg(static_cast<LocalMediaStreamParams*> (data));
      local_media_streams_->RemoveStream(msg->data());
      break;
    }
    case MSG_COMMITSTREAMCHANGES: {
      if (ready_state_ != PeerConnectionInterface::kClosed ||
          ready_state_ != PeerConnectionInterface::kClosing) {
        mediastream_signaling_->SetLocalStreams(local_media_streams_);
        // If we use ROAP an offer is created and we setup the local
        // media streams.
        if (roap_signaling_.get() != NULL) {
          roap_signaling_->CreateOffer(local_media_streams_);
          stream_handler_->CommitLocalStreams(local_media_streams_);
        }
      }
      break;
    }
    case MSG_PROCESSSIGNALINGMESSAGE: {
      if (ready_state_ != PeerConnectionInterface::kClosed &&
          roap_signaling_.get() != NULL)  {
        RoapSignalingParams* params(static_cast<RoapSignalingParams*> (data));
        roap_signaling_->ProcessSignalingMessage(params->data(),
                                                 local_media_streams_);
      }
      break;
    }
    case MSG_RETURNLOCALMEDIASTREAMS: {
      StreamCollectionParams* param(
          static_cast<StreamCollectionParams*> (data));
      param->streams = StreamCollection::Create(local_media_streams_);
      break;
    }
    case MSG_RETURNREMOTEMEDIASTREAMS: {
      StreamCollectionParams* param(
          static_cast<StreamCollectionParams*> (data));
      param->streams = mediastream_signaling_->remote_streams();
      break;
    }
    case MSG_CLOSE: {
      if (ready_state_ != PeerConnectionInterface::kClosed &&
          roap_signaling_.get() != NULL)  {
        ChangeReadyState(PeerConnectionInterface::kClosing);
        roap_signaling_->SendShutDown();
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
    case MSG_STARTICE: {
      if (ready_state_ != PeerConnectionInterface::kClosed &&
          ready_state_ != PeerConnectionInterface::kClosing) {
        IceOptionsParams* param(
                    static_cast<IceOptionsParams*> (data));
        param->result = session_->StartIce(param->options);
      }
      break;
    }
    case MSG_CREATEOFFER: {
      if (ready_state_ != PeerConnectionInterface::kClosed &&
          ready_state_ != PeerConnectionInterface::kClosing) {
        JsepSessionDescriptionParams* param(
            static_cast<JsepSessionDescriptionParams*> (data));
        param->desc = session_->CreateOffer(param->hints);
      }
      break;
    }
    case MSG_CREATEANSWER: {
      if (ready_state_ != PeerConnectionInterface::kClosed &&
          ready_state_ != PeerConnectionInterface::kClosing) {
        JsepSessionDescriptionParams* param(
            static_cast<JsepSessionDescriptionParams*> (data));
        param->desc = session_->CreateAnswer(param->hints,
                                             param->const_desc);
      }
      break;
    }
    case MSG_SETLOCALDESCRIPTION: {
      if (ready_state_ != PeerConnectionInterface::kClosed &&
          ready_state_ != PeerConnectionInterface::kClosing) {
        JsepSessionDescriptionParams* param(
            static_cast<JsepSessionDescriptionParams*> (data));
        param->result  = session_->SetLocalDescription(param->action,
                                                       param->desc);
        stream_handler_->CommitLocalStreams(local_media_streams_);
      }
      break;
    }
    case MSG_SETREMOTEDESCRIPTION: {
      if (ready_state_ != PeerConnectionInterface::kClosed &&
          ready_state_ != PeerConnectionInterface::kClosing) {
        JsepSessionDescriptionParams* param(
            static_cast<JsepSessionDescriptionParams*> (data));
        param->result  = session_->SetRemoteDescription(param->action,
                                                        param->desc);
      }
      break;
    }
    case MSG_PROCESSICEMESSAGE: {
      if (ready_state_ != PeerConnectionInterface::kClosed ||
          ready_state_ != PeerConnectionInterface::kClosing) {
        JsepIceCandidateParams * param(
            static_cast<JsepIceCandidateParams*> (data));
        param->result  = session_->ProcessIceMessage(param->candidate);
      }
      break;
    }
    case MSG_GETLOCALDESCRIPTION: {
      JsepSessionDescriptionParams* param(
          static_cast<JsepSessionDescriptionParams*> (data));
      param->const_desc  = session_->local_description();
      break;
    }
    case  MSG_GETREMOTEDESCRIPTION: {
      JsepSessionDescriptionParams* param(
          static_cast<JsepSessionDescriptionParams*> (data));
      param->const_desc  = session_->remote_description();
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

void PeerConnection::OnSignalingStateChange(
    RoapSignaling::State state) {
  switch (state) {
    case RoapSignaling::kInitializing:
      break;
    case RoapSignaling::kIdle:
      if (ready_state_ == PeerConnectionInterface::kNegotiating)
        ChangeReadyState(PeerConnectionInterface::kActive);
      ChangeSdpState(PeerConnectionInterface::kSdpIdle);
      break;
    case RoapSignaling::kWaitingForAnswer:
      ChangeSdpState(PeerConnectionInterface::kSdpWaiting);
      break;
    case RoapSignaling::kWaitingForOK:
      ChangeSdpState(PeerConnectionInterface::kSdpWaiting);
      break;
    case RoapSignaling::kShutingDown:
      ChangeReadyState(PeerConnectionInterface::kClosing);
      break;
    case RoapSignaling::kShutdownComplete:
      ChangeReadyState(PeerConnectionInterface::kClosed);
      signaling_thread()->Post(this, MSG_TERMINATE);
      break;
    default:
      ASSERT(!"NOT IMPLEMENTED");
      break;
  }
}

void PeerConnection::OnSessionStateChange(cricket::BaseSession* /*session*/,
                                          cricket::BaseSession::State state) {
  switch (state) {
    case cricket::BaseSession::STATE_INIT:
      ChangeReadyState(PeerConnectionInterface::kNew);
    case cricket::BaseSession::STATE_SENTINITIATE:
    case cricket::BaseSession::STATE_RECEIVEDINITIATE:
      ChangeReadyState(PeerConnectionInterface::kNegotiating);
      break;
    case cricket::BaseSession::STATE_SENTACCEPT:
    case cricket::BaseSession::STATE_RECEIVEDACCEPT:
      ChangeReadyState(PeerConnectionInterface::kActive);
      break;
    default:
      break;
  }
}

void PeerConnection::OnAddStream(MediaStreamInterface* stream) {
  stream_handler_->AddRemoteStream(stream);
  observer_->OnAddStream(stream);
}

void PeerConnection::OnRemoveStream(MediaStreamInterface* stream) {
  stream_handler_->RemoveRemoteStream(stream);
  observer_->OnRemoveStream(stream);
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
