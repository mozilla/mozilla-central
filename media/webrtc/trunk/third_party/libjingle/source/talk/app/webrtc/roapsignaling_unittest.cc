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

#include "talk/app/webrtc/audiotrack.h"
#include "talk/app/webrtc/mediastream.h"
#include "talk/app/webrtc/jsepsessiondescription.h"
#include "talk/app/webrtc/mediastreamsignaling.h"
#include "talk/app/webrtc/roapsignaling.h"
#include "talk/app/webrtc/streamcollectionimpl.h"
#include "talk/app/webrtc/videotrack.h"
#include "talk/base/gunit.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/thread.h"
#include "talk/session/phone/channelmanager.h"

static const char kStreamLabel1[] = "local_stream_1";
static const char kStreamLabel2[] = "local_stream_2";
static const char kAudioTrackLabel1[] = "local_audio_1";
static const char kAudioTrackLabel2[] = "local_audio_2";
static const char kVideoTrackLabel1[] = "local_video_1";

namespace webrtc {

// MockSignalingObserver implements functions for listening all signals and
// callbacks from a RoapSignaling instance.
// The method AnswerPeer can be used to forward messages from one
// RoapSignaling instance to another.
class MockSignalingObserver : public RemoteMediaStreamObserver,
                              public sigslot::has_slots<> {
 public:
  MockSignalingObserver()
      : last_error_(-1),  // Initialize last_error_ to unused error code.
        state_(RoapSignaling::kInitializing),
        remote_streams_(StreamCollection::Create()),
        remote_peer_(NULL) {
  }

  virtual ~MockSignalingObserver() {}

  // Implements RemoteMediaStreamObserver.
  virtual void OnAddStream(MediaStreamInterface* remote_stream) {
    EXPECT_EQ(MediaStreamInterface::kLive, remote_stream->ready_state());
    remote_streams_->AddStream(remote_stream);
  }
  // Implements RemoteMediaStreamObserver.
  virtual void OnRemoveStream(MediaStreamInterface* remote_stream) {
    EXPECT_TRUE(remote_streams_->find(remote_stream->label()) != NULL);
    EXPECT_EQ(MediaStreamInterface::kEnded, remote_stream->ready_state());
    remote_streams_->RemoveStream(remote_stream);
  }

  virtual void OnStateChange(RoapSignaling::State state) {
    state_  = state;
  }

  virtual void OnErrorReceived(RoapErrorCode error) {
    last_error_ = error;
  }

  void OnSignalingMessage(const std::string& smessage) {
    last_message_ = smessage;
    if (remote_peer_) {
      remote_peer_->ProcessSignalingMessage(smessage, remote_local_collection_);
    }
  }

  // Tell this object to answer the remote_peer.
  // remote_local_collection is the local collection the remote peer want to
  // send in an answer.
  void AnswerPeer(RoapSignaling* remote_peer,
                  StreamCollection* remote_local_collection) {
    remote_peer_ = remote_peer;
    remote_local_collection_ = remote_local_collection;
  }

  void CancelAnswerPeer() {
    remote_peer_ = NULL;
    remote_local_collection_.release();
  }

  MediaStreamInterface* RemoteStream(const std::string& label) {
    return remote_streams_->find(label);
  }
  StreamCollectionInterface* remote_streams() {
    return remote_streams_.get();
  }

  std::string last_message_;
  int last_error_;
  RoapSignaling::State state_;

 private:
  talk_base::scoped_refptr<StreamCollection> remote_streams_;
  talk_base::scoped_refptr<StreamCollection> remote_local_collection_;
  RoapSignaling* remote_peer_;
};

// Fake implementation of JsepInterface.
// RoapSignaling uses this object to create session descriptions and
// create remote MediaStreams.
class FakeJsep : public JsepInterface {
 public:
  explicit FakeJsep(
      cricket::ChannelManager* channel_manager,
      RemoteMediaStreamObserver* media_stream_observer)
      : update_session_description_counter_(0),
        stream_signaling_(talk_base::Thread::Current(), media_stream_observer),
        session_description_factory_(
            new cricket::MediaSessionDescriptionFactory(channel_manager)),
        offer_set_(false) {
    session_description_factory_->set_add_legacy_streams(false);
  }
  virtual SessionDescriptionInterface* CreateOffer(const MediaHints& hints) {
    cricket::MediaSessionOptions options =
        stream_signaling_.GetMediaSessionOptions(hints);
    const cricket::SessionDescription* desc =
        local_desc_.get() != NULL ? local_desc_->description() : NULL;
    return new JsepSessionDescription(
        session_description_factory_->CreateOffer(options,
                                                  desc));
  }
  virtual SessionDescriptionInterface* CreateAnswer(
      const MediaHints& hints,
      const SessionDescriptionInterface* offer) {
    cricket::MediaSessionOptions options =
        stream_signaling_.GetMediaSessionOptions(hints);
    const cricket::SessionDescription* desc =
        local_desc_.get() != NULL ? local_desc_->description() : NULL;
    return new JsepSessionDescription(
        session_description_factory_->CreateAnswer(offer->description(),
                                                   options,
                                                   desc));
  }
  virtual bool StartIce(IceOptions options) {
    return true;
  }
  virtual bool SetLocalDescription(Action action,
                                   SessionDescriptionInterface* desc) {
    local_desc_.reset(desc);
    UpdateNegotiationState(action);
    return true;
  }
  virtual bool SetRemoteDescription(Action action,
                                    SessionDescriptionInterface* desc) {
    UpdateNegotiationState(action);
    remote_desc_.reset(desc);
    stream_signaling_.UpdateRemoteStreams(desc);
    return true;
  }
  virtual bool ProcessIceMessage(const IceCandidateInterface* ice_candidate) {
    return true;
  }
  virtual const SessionDescriptionInterface* local_description() const {
    return local_desc_.get();
  }
  virtual const SessionDescriptionInterface* remote_description() const {
    return remote_desc_.get();
  }
  MediaStreamSignaling* mediastream_signaling() { return &stream_signaling_; }
  // |update_session_description_counter_| is the number of successful
  // negotiations / re-negotiations.
  size_t update_session_description_counter_;

 protected:
  void UpdateNegotiationState(JsepInterface::Action action) {
    if (action  == kAnswer && offer_set_) {
      // We have received and offer and now we receive an answer.
      // Negotiation is done. Update the counter to indicate this.
      ++update_session_description_counter_;
      offer_set_ = false;
    } else {
      // Received an offer when expecting an answer?
      EXPECT_FALSE(offer_set_);
      offer_set_ = true;
    }
  }
  MediaStreamSignaling stream_signaling_;
  talk_base::scoped_ptr<cricket::MediaSessionDescriptionFactory>
      session_description_factory_;
  talk_base::scoped_ptr<SessionDescriptionInterface> local_desc_;
  talk_base::scoped_ptr<SessionDescriptionInterface> remote_desc_;
  bool offer_set_;
};

// RoapSignalingTest create two RoapSignaling instances
// and connects the signals to two MockSignalingObservers.
// This is used in tests to test the signaling between to peers.
class RoapSignalingTest: public testing::Test {
 protected:
  virtual void SetUp() {
    channel_manager_.reset(new cricket::ChannelManager(
        talk_base::Thread::Current()));
    EXPECT_TRUE(channel_manager_->Init());

    observer1_.reset(new MockSignalingObserver());
    provider1_.reset(new FakeJsep(channel_manager_.get(),
                                  observer1_.get()));
    signaling1_.reset(new RoapSignaling(provider1_->mediastream_signaling(),
                                        provider1_.get()));
    signaling1_->SignalNewPeerConnectionMessage.connect(
        observer1_.get(), &MockSignalingObserver::OnSignalingMessage);
    signaling1_->SignalErrorMessageReceived.connect(
        observer1_.get(), &MockSignalingObserver::OnErrorReceived);
    signaling1_->SignalStateChange.connect(
        observer1_.get(), &MockSignalingObserver::OnStateChange);

    observer2_.reset(new MockSignalingObserver());
    provider2_.reset(new FakeJsep(channel_manager_.get(),
                                  observer2_.get()));
    signaling2_.reset(new RoapSignaling(provider2_->mediastream_signaling(),
                                        provider2_.get()));
    signaling2_->SignalNewPeerConnectionMessage.connect(
        observer2_.get(), &MockSignalingObserver::OnSignalingMessage);
    signaling2_->SignalErrorMessageReceived.connect(
        observer2_.get(), &MockSignalingObserver::OnErrorReceived);
    signaling2_->SignalStateChange.connect(
        observer2_.get(), &MockSignalingObserver::OnStateChange);
  }

  // Create a collection of streams be sent on signaling1__
  talk_base::scoped_refptr<StreamCollection> CreateLocalCollection1() {
    std::string label(kStreamLabel1);
    talk_base::scoped_refptr<LocalMediaStreamInterface> stream1(
        MediaStream::Create(label));

    // Add a local audio track.
    talk_base::scoped_refptr<LocalAudioTrackInterface>
        audio_track(AudioTrack::CreateLocal(kAudioTrackLabel1, NULL));
    stream1->AddTrack(audio_track);

    // Add a local video track.
    talk_base::scoped_refptr<LocalVideoTrackInterface>
        video_track(VideoTrack::CreateLocal(kVideoTrackLabel1, NULL));
    stream1->AddTrack(video_track);

    talk_base::scoped_refptr<StreamCollection> local_collection1(
        StreamCollection::Create());
    local_collection1->AddStream(stream1);

    return local_collection1;
  }

  talk_base::scoped_refptr<StreamCollection> CreateLocalCollection2() {
    std::string label(kStreamLabel2);
    talk_base::scoped_refptr<LocalMediaStreamInterface> stream2(
        MediaStream::Create(label));

    // Add a local audio track.
    talk_base::scoped_refptr<LocalAudioTrackInterface>
        audio_track(AudioTrack::CreateLocal(kAudioTrackLabel2, NULL));
    stream2->AddTrack(audio_track);

    talk_base::scoped_refptr<StreamCollection> local_collection2(
        StreamCollection::Create());
    local_collection2->AddStream(stream2);

    return local_collection2;
  }

  // Initialize and setup a simple call between signaling1_ and signaling2_.
  // signaling1_ send stream with label kStreamLabel1 to signaling2_.
  void SetUpOneWayCall() {
    // Create a local stream collection to be sent on signaling1_.
    talk_base::scoped_refptr<StreamCollection> local_collection1(
        CreateLocalCollection1());

    talk_base::scoped_refptr<StreamCollection> local_collection2(
        StreamCollection::Create());

    // Connect all messages sent from signaling1_ to be received on signaling2_
    observer1_->AnswerPeer(signaling2_.get(), local_collection2);
    // Connect all messages sent from Peer2 to be received on Peer1
    observer2_->AnswerPeer(signaling1_.get(), local_collection1);

    signaling1_->CreateOffer(local_collection1);
    EXPECT_EQ(RoapSignaling::kInitializing,
              signaling1_->GetState());
    // Initialize signaling1_ by providing the candidates.
    signaling1_->OnIceComplete();
    EXPECT_EQ(RoapSignaling::kWaitingForAnswer,
             signaling1_->GetState());

    EXPECT_EQ(RoapSignaling::kInitializing, signaling2_->GetState());
    signaling2_->OnIceComplete();

    // Make sure all is setup.
    EXPECT_EQ(RoapSignaling::kIdle, signaling1_->GetState());
    EXPECT_EQ(RoapSignaling::kIdle, signaling2_->GetState());

    EXPECT_TRUE(observer2_->RemoteStream(kStreamLabel1) != NULL);
    EXPECT_EQ(0u, observer1_->remote_streams()->count());
    EXPECT_EQ(1u, observer2_->remote_streams()->count());
  }

  talk_base::scoped_ptr<MockSignalingObserver> observer1_;
  talk_base::scoped_ptr<MockSignalingObserver> observer2_;
  talk_base::scoped_ptr<FakeJsep> provider1_;
  talk_base::scoped_ptr<FakeJsep> provider2_;
  talk_base::scoped_ptr<RoapSignaling> signaling1_;
  talk_base::scoped_ptr<RoapSignaling> signaling2_;
  talk_base::scoped_ptr<cricket::ChannelManager> channel_manager_;
};

TEST_F(RoapSignalingTest, SimpleOneWayCall) {
  // Peer 1 create an offer with only one audio track.
  talk_base::scoped_refptr<StreamCollection> local_collection1(
      CreateLocalCollection1());

  // Peer 2 only receive. Create an empty collection
  talk_base::scoped_refptr<StreamCollection> local_collection2(
      StreamCollection::Create());

  // Connect all messages sent from Peer1 to be received on Peer2
  observer1_->AnswerPeer(signaling2_.get(), local_collection2);
  // Connect all messages sent from Peer2 to be received on Peer1
  observer2_->AnswerPeer(signaling1_.get(), local_collection1);

  // Peer 1 generates the offer. It is not sent since there is no
  // local candidates ready.
  signaling1_->CreateOffer(local_collection1);

  EXPECT_EQ(RoapSignaling::kInitializing, signaling1_->GetState());

  // Initialize signaling1_ by providing the candidates.
  signaling1_->OnIceComplete();
  EXPECT_EQ(RoapSignaling::kWaitingForAnswer,
            signaling1_->GetState());

  // Verify that signaling_2 is still not initialized.
  // Even though it have received an offer.
  EXPECT_EQ(RoapSignaling::kInitializing, signaling2_->GetState());

  // Provide the candidates to signaling_2 and let it process the offer.
  signaling2_->OnIceComplete();

  // Verify that the offer/answer have been exchanged and the state is good.
  EXPECT_EQ(RoapSignaling::kIdle, signaling1_->GetState());
  EXPECT_EQ(RoapSignaling::kIdle, signaling2_->GetState());

  // Verify that PeerConnection2 is aware of the sending stream.
  EXPECT_TRUE(observer2_->RemoteStream(kStreamLabel1) != NULL);

  // Verify that both peers have updated the session descriptions.
  EXPECT_EQ(1u, provider1_->update_session_description_counter_);
  EXPECT_EQ(1u, provider2_->update_session_description_counter_);
}

TEST_F(RoapSignalingTest, Glare) {
  // Setup a call.
  SetUpOneWayCall();

  // Stop sending all messages automatically between Peer 1 and Peer 2.
  observer1_->CancelAnswerPeer();
  observer2_->CancelAnswerPeer();

  // Create an empty collection for Peer 1.
  talk_base::scoped_refptr<StreamCollection> local_collection1(
      StreamCollection::Create());
  // Create a collection for Peer 2.
  talk_base::scoped_refptr<StreamCollection> local_collection2(
      CreateLocalCollection2());

  // Peer 1 create an updated offer.
  signaling1_->CreateOffer(local_collection1);
  // Peer 2 create an updated offer.
  signaling2_->CreateOffer(local_collection2);

  std::string offer_1 = observer1_->last_message_;
  std::string offer_2 = observer2_->last_message_;
  EXPECT_EQ(RoapSignaling::kWaitingForAnswer, signaling1_->GetState());
  EXPECT_EQ(RoapSignaling::kWaitingForAnswer, signaling2_->GetState());

  // Connect all messages sent from Peer 1 to be received on Peer 2
  observer1_->AnswerPeer(signaling2_.get(), local_collection2);
  // Connect all messages sent from Peer 2 to be received on Peer 1
  observer2_->AnswerPeer(signaling1_.get(), local_collection1);

  // Insert the two offers to each Peer to create the Glare.
  signaling1_->ProcessSignalingMessage(offer_2, local_collection1);
  signaling2_->ProcessSignalingMessage(offer_1, local_collection2);

  // Make sure all is good.
  EXPECT_EQ(RoapSignaling::kIdle, signaling1_->GetState());
  EXPECT_EQ(RoapSignaling::kIdle, signaling2_->GetState());

  // Verify that Peer 1 is receiving kStreamLabel2.
  EXPECT_TRUE(observer1_->RemoteStream(kStreamLabel2) != NULL);
  // Verify that Peer 2 don't receive any streams
  // since it has been removed.
  EXPECT_TRUE(observer2_->RemoteStream(kStreamLabel1) == NULL);

  // Verify that both peers have updated the session descriptions.
  EXPECT_EQ(2u, provider1_->update_session_description_counter_);
  EXPECT_EQ(2u, provider2_->update_session_description_counter_);
}

TEST_F(RoapSignalingTest, AddRemoveStream) {
  // Create a local stream.
  std::string label(kStreamLabel1);
  talk_base::scoped_refptr<LocalMediaStreamInterface> stream(
      MediaStream::Create(label));

  // Add a local audio track.
  talk_base::scoped_refptr<LocalAudioTrackInterface>
      audio_track(AudioTrack::CreateLocal(kAudioTrackLabel1, NULL));
  stream->AddTrack(audio_track);

  // Add a local video track.
  talk_base::scoped_refptr<LocalVideoTrackInterface>
      video_track(VideoTrack::CreateLocal(kVideoTrackLabel1, NULL));
  stream->AddTrack(video_track);

  // Peer 1 create an empty collection
  talk_base::scoped_refptr<StreamCollection> local_collection1(
      StreamCollection::Create());

  // Peer 2 create an empty collection
  talk_base::scoped_refptr<StreamCollection> local_collection2(
      StreamCollection::Create());

  // Connect all messages sent from Peer1 to be received on Peer2
  observer1_->AnswerPeer(signaling2_.get(), local_collection2);
  // Connect all messages sent from Peer2 to be received on Peer1
  observer2_->AnswerPeer(signaling1_.get(), local_collection1);

  // Peer 1 creates an empty offer and send it to Peer2.
  signaling1_->CreateOffer(local_collection1);

  // Initialize signaling1_ and signaling_2 by providing the candidates.
  signaling1_->OnIceComplete();
  signaling2_->OnIceComplete();

  // Verify that both peers have updated the session descriptions.
  EXPECT_EQ(1u, provider1_->update_session_description_counter_);
  EXPECT_EQ(1u, provider2_->update_session_description_counter_);

  // Peer2 add a stream.
  local_collection2->AddStream(stream);

  signaling2_->CreateOffer(local_collection2);

  // Verify that PeerConnection1 is aware of the sending stream.
  EXPECT_TRUE(observer1_->RemoteStream(label) != NULL);

  // Verify that both peers have updated the session descriptions.
  EXPECT_EQ(2u, provider1_->update_session_description_counter_);
  EXPECT_EQ(2u, provider2_->update_session_description_counter_);

  // Remove the stream
  local_collection2->RemoveStream(stream);

  signaling2_->CreateOffer(local_collection2);

  // Verify that PeerConnection1 is not aware of the sending stream.
  EXPECT_TRUE(observer1_->RemoteStream(label) == NULL);

  // Verify that both peers have updated the session descriptions.
  EXPECT_EQ(3u, provider1_->update_session_description_counter_);
  EXPECT_EQ(3u, provider2_->update_session_description_counter_);
}

TEST_F(RoapSignalingTest, ShutDown) {
  // Setup a call.
  SetUpOneWayCall();

  signaling1_->SendShutDown();

  EXPECT_EQ(RoapSignaling::kShutdownComplete,
            signaling1_->GetState());
  EXPECT_EQ(RoapSignaling::kShutdownComplete,
            signaling2_->GetState());

  EXPECT_EQ(0u, observer1_->remote_streams()->count());
  EXPECT_EQ(0u, observer2_->remote_streams()->count());
  EXPECT_EQ(RoapSignaling::kShutdownComplete, observer1_->state_);
  EXPECT_EQ(RoapSignaling::kShutdownComplete, observer2_->state_);

  // Verify that both peers have updated the session descriptions.
  EXPECT_EQ(2u, provider1_->update_session_description_counter_);
  EXPECT_EQ(2u, provider2_->update_session_description_counter_);
}

TEST_F(RoapSignalingTest, ReceiveError) {
  talk_base::scoped_refptr<StreamCollection> local_collection1(
      CreateLocalCollection1());

  signaling1_->CreateOffer(local_collection1);
  // Initialize signaling1_
  signaling1_->OnIceComplete();
  EXPECT_EQ(RoapSignaling::kWaitingForAnswer,
            signaling1_->GetState());

  RoapSession roap_session;
  roap_session.Parse(observer1_->last_message_);
  signaling1_->ProcessSignalingMessage(roap_session.CreateErrorMessage(
      kNoMatch), local_collection1);
  EXPECT_EQ(kNoMatch, observer1_->last_error_);

  // Check signaling have cleaned up.
  EXPECT_EQ(RoapSignaling::kIdle, signaling1_->GetState());

  signaling1_->CreateOffer(local_collection1);
  EXPECT_EQ(RoapSignaling::kWaitingForAnswer,
            signaling1_->GetState());
}

}  // namespace webrtc
