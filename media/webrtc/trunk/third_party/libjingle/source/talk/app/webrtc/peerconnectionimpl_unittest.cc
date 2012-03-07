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
#include "talk/app/webrtc/mediastreamimpl.h"
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
static const uint32 kTimeout = 5000U;

using talk_base::scoped_ptr;
using talk_base::scoped_refptr;
using webrtc::FakePortAllocatorFactory;
using webrtc::LocalMediaStreamInterface;
using webrtc::LocalVideoTrackInterface;
using webrtc::MediaStreamInterface;
using webrtc::PeerConnectionInterface;
using webrtc::PeerConnectionObserver;
using webrtc::PortAllocatorFactoryInterface;
using webrtc::RoapMessageBase;
using webrtc::RoapOffer;


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
  cricket::SessionDescription* sdp_offer =
      offer.ReleaseSessionDescription();
  const cricket::ContentInfo* audio_content = GetFirstAudioContent(sdp_offer);
  if (audio_content) {
    const cricket::AudioContentDescription* desc =
        static_cast<const cricket::AudioContentDescription*>(
            audio_content->description);
    cricket::CryptoParamsVec& cryptos =
        const_cast<cricket::CryptoParamsVec&>(desc->cryptos());
    cryptos.erase(cryptos.begin()++);
  }

  webrtc::RoapAnswer answer(offer.offer_session_id(), "dummy_session",
                            offer.session_token(), offer.response_token(),
                            offer.seq(), sdp_offer, offer.candidates());
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

  talk_base::scoped_refptr<PeerConnectionInterface> pc_;
  RoapMessageBase last_message_;
  PeerConnectionInterface::ReadyState state_;
  PeerConnectionInterface::SdpState sdp_state_;

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

  void CreatePeerConnection() {
    pc_ = pc_factory_->CreatePeerConnection(kStunConfiguration, &observer_);
    ASSERT_TRUE(pc_.get() != NULL);
    observer_.SetPeerConnectionInterface(pc_.get());
    EXPECT_EQ(PeerConnectionInterface::kNegotiating, observer_.state_);
  }

  void CreatePeerConnectionWithInvalidConfiguration() {
    pc_ = pc_factory_->CreatePeerConnection(kInvalidConfiguration, &observer_);
    ASSERT_TRUE(pc_.get() != NULL);
    observer_.SetPeerConnectionInterface(pc_.get());
    EXPECT_EQ(PeerConnectionInterface::kNegotiating, observer_.state_);
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

    EXPECT_EQ_WAIT(PeerConnectionInterface::kSdpWaiting, observer_.sdp_state_,
                   kTimeout);
    // Wait for the ICE agent to find the candidates and send an offer.
    EXPECT_EQ_WAIT(RoapMessageBase::kOffer, observer_.last_message_.type(),
                   kTimeout);
  }

  scoped_refptr<PortAllocatorFactoryInterface> port_allocator_factory_;
  scoped_refptr<webrtc::PeerConnectionFactoryInterface> pc_factory_;
  scoped_refptr<PeerConnectionInterface> pc_;
  MockPeerConnectionObserver observer_;
};

TEST_F(PeerConnectionImplTest, CreatePeerConnectionWithInvalidConfiguration) {
  CreatePeerConnectionWithInvalidConfiguration();
  AddStream(kStreamLabel1);
}

TEST_F(PeerConnectionImplTest, AddStream) {
  CreatePeerConnection();
  AddStream(kStreamLabel1);
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

TEST_F(PeerConnectionImplTest, DISABLED_UpdateStream) {
  CreatePeerConnection();
  AddStream(kStreamLabel1);
  WAIT(PeerConnectionInterface::kNegotiating == observer_.state_, kTimeout);
  pc_->ProcessSignalingMessage(CreateAnswerMessage(observer_.last_message_));
  WAIT(PeerConnectionInterface::kActive ==  observer_.state_, kTimeout);
  WAIT(PeerConnectionInterface::kSdpIdle == observer_.sdp_state_, kTimeout);

  AddStream(kStreamLabel2);
  ASSERT_EQ(2u, pc_->local_streams()->count());
  EXPECT_EQ(kStreamLabel2, pc_->local_streams()->at(1)->label());
  EXPECT_EQ_WAIT(PeerConnectionInterface::kSdpWaiting, observer_.sdp_state_,
                 kTimeout);
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
  EXPECT_EQ_WAIT(PeerConnectionInterface::kSdpWaiting, observer_.sdp_state_,
                 kTimeout);
  pc_->ProcessSignalingMessage(CreateAnswerMessage(observer_.last_message_));
  EXPECT_EQ_WAIT(PeerConnectionInterface::kSdpIdle, observer_.sdp_state_,
                 kTimeout);
  EXPECT_EQ(kStreamLabel2, observer_.GetLastRemovedStreamLabel());
  EXPECT_EQ(1u, pc_->local_streams()->count());
}

TEST_F(PeerConnectionImplTest, SendClose) {
  CreatePeerConnection();
  pc_->Close();
  EXPECT_EQ(RoapMessageBase::kShutdown, observer_.last_message_.type());
  EXPECT_EQ(PeerConnectionInterface::kClosing, observer_.state_);
  pc_->ProcessSignalingMessage(CreateOkMessage(observer_.last_message_));
  EXPECT_EQ_WAIT(PeerConnectionInterface::kClosed, observer_.state_, kTimeout);
}

TEST_F(PeerConnectionImplTest, ReceiveClose) {
  CreatePeerConnection();
  pc_->ProcessSignalingMessage(CreateShutdownMessage());
  EXPECT_EQ_WAIT(RoapMessageBase::kOk, observer_.last_message_.type(),
                 kTimeout);
  EXPECT_EQ(PeerConnectionInterface::kClosed, observer_.state_);
}

TEST_F(PeerConnectionImplTest, ReceiveCloseWhileExpectingAnswer) {
  CreatePeerConnection();
  AddStream(kStreamLabel1);

  // Receive the shutdown message.
  pc_->ProcessSignalingMessage(CreateShutdownMessage());
  EXPECT_EQ_WAIT(RoapMessageBase::kOk, observer_.last_message_.type(),
                 kTimeout);
  EXPECT_EQ(PeerConnectionInterface::kClosed, observer_.state_);
}
