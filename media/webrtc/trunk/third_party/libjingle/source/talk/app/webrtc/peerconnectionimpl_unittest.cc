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

#include <string>

#include "talk/app/webrtc/fakeportallocatorfactory.h"
#include "talk/app/webrtc/mediastream.h"
#include "talk/app/webrtc/peerconnection.h"
#include "talk/app/webrtc/peerconnectionimpl.h"
#include "talk/app/webrtc/roapmessages.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/thread.h"
#include "talk/base/gunit.h"

static const char kStreamLabel1[] = "local_stream_1";
static const char kStreamLabel2[] = "local_stream_2";
static const char kStunConfiguration[] = "STUN stun.l.google.com:19302";
static const char kInvalidConfiguration[] = "a13151913541234:19302";
static const int kDefaultStunPort = 3478;
static const char kStunAddressOnly[] = "STUN address";
static const char kStunInvalidPort[] = "STUN address:-1";
static const char kStunAddressPortAndMore1[] = "STUN address:port:more";
static const char kStunAddressPortAndMore2[] = "STUN address:port more";
static const char kTurnAddressOnly[] = "TURN address";
static const char kTurnInvalidPort[] = "TURN address:-1";
static const char kTurnAddressPortAndMore1[] = "TURN address:port:more";
static const char kTurnAddressPortAndMore2[] = "TURN address:port more";
static const uint32 kTimeout = 5000U;

using talk_base::scoped_ptr;
using talk_base::scoped_refptr;
using webrtc::FakePortAllocatorFactory;
using webrtc::IceCandidateInterface;
using webrtc::LocalMediaStreamInterface;
using webrtc::LocalVideoTrackInterface;
using webrtc::MediaStreamInterface;
using webrtc::PeerConnectionInterface;
using webrtc::PeerConnectionObserver;
using webrtc::PortAllocatorFactoryInterface;
using webrtc::RoapMessageBase;
using webrtc::RoapOffer;
using webrtc::SessionDescriptionInterface;


// Create ROAP message for shutdown.
static std::string CreateShutdownMessage() {
  webrtc::RoapShutdown shutdown("dummy_session", "", "", 1);
  return shutdown.Serialize();
}

// Create a ROAP answer message.
// The session description in the answer is set to the same as in the offer.
static std::string CreateAnswerMessage(const RoapMessageBase& msg) {
  webrtc::RoapOffer offer(msg);
  EXPECT_TRUE(offer.Parse());
  std::string answer_sdp = offer.SessionDescription();
  webrtc::RoapAnswer answer(offer.offer_session_id(), "dummy_session",
                            offer.session_token(), offer.response_token(),
                            offer.seq(), answer_sdp);
  return answer.Serialize();
}

// Create ROAP message to answer ok to a ROAP shutdown or ROAP answer message.
static std::string CreateOkMessage(const RoapMessageBase& msg) {
  webrtc::RoapOk ok(msg.offer_session_id(), "dummy_session",
                    msg.session_token(), msg.response_token(), msg.seq());
  return ok.Serialize();
}

class MockPeerConnectionObserver : public PeerConnectionObserver {
 public:
  MockPeerConnectionObserver() : ice_complete_(false) {
  }
  ~MockPeerConnectionObserver() {
  }
  void SetPeerConnectionInterface(PeerConnectionInterface* pc) {
    pc_ = pc;
    state_ = pc_->ready_state();
    sdp_state_ = pc_->sdp_state();
  }
  virtual void OnError() {}
  virtual void OnMessage(const std::string& msg) {}
  virtual void OnSignalingMessage(const std::string& msg) {
    EXPECT_TRUE(last_message_.Parse(msg));
  }
  virtual void OnStateChange(StateType state_changed) {
    if (pc_.get() == NULL)
      return;
    switch (state_changed) {
      case kReadyState:
        state_ = pc_->ready_state();
        break;
      case kSdpState:
        sdp_state_ = pc_->sdp_state();
        break;
      case kIceState:
        ADD_FAILURE();
        break;
      default:
        ADD_FAILURE();
        break;
    }
  }
  virtual void OnAddStream(MediaStreamInterface* stream) {
    last_added_stream_ = stream;
  }
  virtual void OnRemoveStream(MediaStreamInterface* stream) {
    last_removed_stream_ = stream;
  }
  virtual void OnIceCandidate(const webrtc::IceCandidateInterface* candidate) {
    std::string sdp;
    EXPECT_TRUE(candidate->ToString(&sdp));
    EXPECT_LT(0u, sdp.size());
    last_candidate_.reset(webrtc::CreateIceCandidate(candidate->label(), sdp));
    EXPECT_TRUE(last_candidate_.get() != NULL);
  }
  virtual void OnIceComplete() {
    ice_complete_ = true;
  }

  // Returns the label of the last added stream.
  // Empty string if no stream have been added.
  std::string GetLastAddedStreamLabel() {
    if (last_added_stream_.get())
      return last_added_stream_->label();
    return "";
  }
  std::string GetLastRemovedStreamLabel() {
    if (last_removed_stream_.get())
      return last_removed_stream_->label();
    return "";
  }

  scoped_refptr<PeerConnectionInterface> pc_;
  RoapMessageBase last_message_;
  PeerConnectionInterface::ReadyState state_;
  PeerConnectionInterface::SdpState sdp_state_;
  scoped_ptr<IceCandidateInterface> last_candidate_;
  bool ice_complete_;

 private:
  scoped_refptr<MediaStreamInterface> last_added_stream_;
  scoped_refptr<MediaStreamInterface> last_removed_stream_;
};

class PeerConnectionImplTest : public testing::Test {
 protected:
  virtual void SetUp() {
    port_allocator_factory_ = FakePortAllocatorFactory::Create();

    pc_factory_ = webrtc::CreatePeerConnectionFactory(
        talk_base::Thread::Current(), talk_base::Thread::Current(),
        port_allocator_factory_.get(), NULL);
    ASSERT_TRUE(pc_factory_.get() != NULL);
  }

  void CreateRoapPeerConnection() {
    pc_ = pc_factory_->CreateRoapPeerConnection(kStunConfiguration, &observer_);
    ASSERT_TRUE(pc_.get() != NULL);
    observer_.SetPeerConnectionInterface(pc_.get());
    EXPECT_EQ(PeerConnectionInterface::kNegotiating, observer_.state_);
  }

  void CreatePeerConnection() {
    pc_ = pc_factory_->CreatePeerConnection(kStunConfiguration, &observer_);
    ASSERT_TRUE(pc_.get() != NULL);
    observer_.SetPeerConnectionInterface(pc_.get());
    EXPECT_EQ(PeerConnectionInterface::kNew, observer_.state_);
  }

  void CreatePeerConnectionWithInvalidConfiguration() {
    pc_ = pc_factory_->CreatePeerConnection(kInvalidConfiguration, &observer_);
    ASSERT_TRUE(pc_.get() != NULL);
    EXPECT_EQ(0u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(0u, port_allocator_factory_->turn_configs().size());
    observer_.SetPeerConnectionInterface(pc_.get());
    EXPECT_EQ(PeerConnectionInterface::kNew, observer_.state_);
  }

  void CreatePeerConnectionWithDifferentConfigurations() {
    pc_ = pc_factory_->CreatePeerConnection(kStunAddressOnly, &observer_);
    EXPECT_EQ(1u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(0u, port_allocator_factory_->turn_configs().size());
    EXPECT_EQ("address",
        port_allocator_factory_->stun_configs()[0].server.hostname());
    EXPECT_EQ(kDefaultStunPort,
        port_allocator_factory_->stun_configs()[0].server.port());

    pc_ = pc_factory_->CreatePeerConnection(kStunInvalidPort, &observer_);
    EXPECT_EQ(0u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(0u, port_allocator_factory_->turn_configs().size());

    pc_ = pc_factory_->CreatePeerConnection(kStunAddressPortAndMore1,
                                            &observer_);
    EXPECT_EQ(0u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(0u, port_allocator_factory_->turn_configs().size());

    pc_ = pc_factory_->CreatePeerConnection(kStunAddressPortAndMore2,
                                            &observer_);
    EXPECT_EQ(0u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(0u, port_allocator_factory_->turn_configs().size());

    pc_ = pc_factory_->CreatePeerConnection(kTurnAddressOnly, &observer_);
    EXPECT_EQ(0u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(1u, port_allocator_factory_->turn_configs().size());
    EXPECT_EQ("address",
        port_allocator_factory_->turn_configs()[0].server.hostname());
    EXPECT_EQ(kDefaultStunPort,
        port_allocator_factory_->turn_configs()[0].server.port());

    pc_ = pc_factory_->CreatePeerConnection(kTurnInvalidPort, &observer_);
    EXPECT_EQ(0u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(0u, port_allocator_factory_->turn_configs().size());

    pc_ = pc_factory_->CreatePeerConnection(kTurnAddressPortAndMore1,
                                            &observer_);
    EXPECT_EQ(0u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(0u, port_allocator_factory_->turn_configs().size());

    pc_ = pc_factory_->CreatePeerConnection(kTurnAddressPortAndMore2,
                                            &observer_);
    EXPECT_EQ(0u, port_allocator_factory_->stun_configs().size());
    EXPECT_EQ(0u, port_allocator_factory_->turn_configs().size());
  }

  void AddStream(const std::string& label) {
    // Create a local stream.
    scoped_refptr<LocalMediaStreamInterface> stream(
        pc_factory_->CreateLocalMediaStream(label));
    scoped_refptr<LocalVideoTrackInterface> video_track(
        pc_factory_->CreateLocalVideoTrack(label, NULL));
    stream->AddTrack(video_track.get());
    pc_->AddStream(stream);
    pc_->CommitStreamChanges();
  }

  void WaitForRoapOffer() {
    EXPECT_EQ_WAIT(PeerConnectionInterface::kSdpWaiting, observer_.sdp_state_,
                   kTimeout);
    // Wait for the ICE agent to find the candidates and send an offer.
    EXPECT_EQ_WAIT(RoapMessageBase::kOffer, observer_.last_message_.type(),
                   kTimeout);
  }


  scoped_refptr<FakePortAllocatorFactory> port_allocator_factory_;
  scoped_refptr<webrtc::PeerConnectionFactoryInterface> pc_factory_;
  scoped_refptr<PeerConnectionInterface> pc_;
  MockPeerConnectionObserver observer_;
};

TEST_F(PeerConnectionImplTest, CreatePeerConnectionWithInvalidConfiguration) {
  CreatePeerConnectionWithInvalidConfiguration();
  AddStream(kStreamLabel1);
}

TEST_F(PeerConnectionImplTest,
       CreatePeerConnectionWithDifferentConfigurations) {
  CreatePeerConnectionWithDifferentConfigurations();
}

TEST_F(PeerConnectionImplTest, RoapAddStream) {
  CreateRoapPeerConnection();
  AddStream(kStreamLabel1);
  WaitForRoapOffer();
  ASSERT_EQ(1u, pc_->local_streams()->count());
  EXPECT_EQ(kStreamLabel1, pc_->local_streams()->at(0)->label());

  EXPECT_EQ_WAIT(PeerConnectionInterface::kNegotiating, observer_.state_,
                 kTimeout);
  pc_->ProcessSignalingMessage(CreateAnswerMessage(observer_.last_message_));
  EXPECT_EQ_WAIT(PeerConnectionInterface::kActive, observer_.state_, kTimeout);
  EXPECT_EQ_WAIT(PeerConnectionInterface::kSdpIdle, observer_.sdp_state_,
                 kTimeout);
  // Since we answer with the same session description as we offer we can
  // check if OnAddStream have been called.
  EXPECT_EQ(kStreamLabel1, observer_.GetLastAddedStreamLabel());
  ASSERT_EQ(1u, pc_->remote_streams()->count());
  EXPECT_EQ(kStreamLabel1, pc_->remote_streams()->at(0)->label());
}

TEST_F(PeerConnectionImplTest, RoapUpdateStream) {
  CreateRoapPeerConnection();
  AddStream(kStreamLabel1);
  WaitForRoapOffer();
  pc_->ProcessSignalingMessage(CreateAnswerMessage(observer_.last_message_));
  WAIT(PeerConnectionInterface::kActive ==  observer_.state_, kTimeout);
  WAIT(PeerConnectionInterface::kSdpIdle == observer_.sdp_state_, kTimeout);

  AddStream(kStreamLabel2);
  WaitForRoapOffer();
  ASSERT_EQ(2u, pc_->local_streams()->count());
  EXPECT_EQ(kStreamLabel2, pc_->local_streams()->at(1)->label());

  EXPECT_EQ(PeerConnectionInterface::kActive, observer_.state_);
  pc_->ProcessSignalingMessage(CreateAnswerMessage(observer_.last_message_));
  EXPECT_EQ_WAIT(PeerConnectionInterface::kSdpIdle, observer_.sdp_state_,
                 kTimeout);
  // Since we answer with the same session description as we offer we can
  // check if OnAddStream have been called.
  EXPECT_EQ(kStreamLabel2, observer_.GetLastAddedStreamLabel());
  ASSERT_EQ(2u, pc_->remote_streams()->count());
  EXPECT_EQ(kStreamLabel2, pc_->remote_streams()->at(1)->label());

  pc_->RemoveStream(static_cast<LocalMediaStreamInterface*>(
      pc_->local_streams()->at(1)));
  pc_->CommitStreamChanges();
  WaitForRoapOffer();
  pc_->ProcessSignalingMessage(CreateAnswerMessage(observer_.last_message_));
  EXPECT_EQ_WAIT(PeerConnectionInterface::kSdpIdle, observer_.sdp_state_,
                 kTimeout);
  EXPECT_EQ(kStreamLabel2, observer_.GetLastRemovedStreamLabel());
  EXPECT_EQ(1u, pc_->local_streams()->count());
}

TEST_F(PeerConnectionImplTest, RoapSendClose) {
  CreateRoapPeerConnection();
  pc_->Close();
  EXPECT_EQ(RoapMessageBase::kShutdown, observer_.last_message_.type());
  EXPECT_EQ(PeerConnectionInterface::kClosing, observer_.state_);
  pc_->ProcessSignalingMessage(CreateOkMessage(observer_.last_message_));
  EXPECT_EQ_WAIT(PeerConnectionInterface::kClosed, observer_.state_, kTimeout);
}

TEST_F(PeerConnectionImplTest, RoapReceiveClose) {
  CreateRoapPeerConnection();
  pc_->ProcessSignalingMessage(CreateShutdownMessage());
  EXPECT_EQ_WAIT(RoapMessageBase::kOk, observer_.last_message_.type(),
                 kTimeout);
  EXPECT_EQ(PeerConnectionInterface::kClosed, observer_.state_);
}

TEST_F(PeerConnectionImplTest, RoapReceiveCloseWhileExpectingAnswer) {
  CreateRoapPeerConnection();
  AddStream(kStreamLabel1);
  WaitForRoapOffer();

  // Receive the shutdown message.
  pc_->ProcessSignalingMessage(CreateShutdownMessage());
  EXPECT_EQ_WAIT(RoapMessageBase::kOk, observer_.last_message_.type(),
                 kTimeout);
  EXPECT_EQ(PeerConnectionInterface::kClosed, observer_.state_);
}

TEST_F(PeerConnectionImplTest, Jsep_InitiateCall) {
  CreatePeerConnection();
  AddStream(kStreamLabel1);

  SessionDescriptionInterface* offer(pc_->CreateOffer(webrtc::MediaHints()));
  SessionDescriptionInterface* answer(
      pc_->CreateAnswer(webrtc::MediaHints(), offer));

  // SetLocalDescription takes ownership of offer.
  EXPECT_TRUE(pc_->SetLocalDescription(PeerConnectionInterface::kOffer,
                                       offer));
  EXPECT_EQ(PeerConnectionInterface::kNegotiating, observer_.state_);
  // SetRemoteDescription takes ownership of answer.
  EXPECT_TRUE(pc_->SetRemoteDescription(PeerConnectionInterface::kAnswer,
                                        answer));
  EXPECT_EQ(PeerConnectionInterface::kActive, observer_.state_);

  // Since we answer with the same session description as we offer we can
  // check if OnAddStream have been called.
  EXPECT_EQ_WAIT(kStreamLabel1, observer_.GetLastAddedStreamLabel(), kTimeout);
}

TEST_F(PeerConnectionImplTest, Jsep_ReceiveCall) {
  CreatePeerConnection();
  AddStream(kStreamLabel1);

  SessionDescriptionInterface* offer(pc_->CreateOffer(webrtc::MediaHints()));
  SessionDescriptionInterface* answer(pc_->CreateAnswer(webrtc::MediaHints(),
                                                        offer));
  // SetRemoteDescription takes ownership of offer.
  EXPECT_TRUE(pc_->SetRemoteDescription(PeerConnectionInterface::kOffer,
                                        offer));
  EXPECT_EQ(PeerConnectionInterface::kNegotiating, observer_.state_);
  // SetLocalDescription takes ownership of answer.
  EXPECT_TRUE(pc_->SetLocalDescription(PeerConnectionInterface::kAnswer,
                                       answer));
  EXPECT_EQ(PeerConnectionInterface::kActive, observer_.state_);

  // Since we answer with the same session description as we offer we can
  // check if OnAddStream have been called.
  EXPECT_EQ_WAIT(kStreamLabel1, observer_.GetLastAddedStreamLabel(), kTimeout);
}

// Test that candidates are generated and that we can parse our own candidates.
TEST_F(PeerConnectionImplTest, Jsep_IceCandidates) {
  CreatePeerConnection();
  EXPECT_FALSE(pc_->StartIce(PeerConnectionInterface::kUseAll));

  SessionDescriptionInterface* offer(pc_->CreateOffer(webrtc::MediaHints()));
  SessionDescriptionInterface* answer(
      pc_->CreateAnswer(webrtc::MediaHints(), offer));
  EXPECT_TRUE(pc_->SetLocalDescription(PeerConnectionInterface::kOffer,
                                       offer));
  EXPECT_TRUE(pc_->StartIce(PeerConnectionInterface::kUseAll));

  EXPECT_TRUE_WAIT(observer_.last_candidate_.get() != NULL, kTimeout);
  EXPECT_TRUE_WAIT(observer_.ice_complete_, kTimeout);
  EXPECT_FALSE(pc_->ProcessIceMessage(observer_.last_candidate_.get()));

  // SetRemoteDescription takes ownership of answer.
  EXPECT_TRUE(pc_->SetRemoteDescription(PeerConnectionInterface::kAnswer,
                                        answer));

  EXPECT_TRUE(pc_->ProcessIceMessage(observer_.last_candidate_.get()));
}
