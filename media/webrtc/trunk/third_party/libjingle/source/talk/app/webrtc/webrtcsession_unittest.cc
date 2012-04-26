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

#include "talk/app/webrtc/jsepicecandidate.h"
#include "talk/app/webrtc/jsepsessiondescription.h"
#include "talk/app/webrtc/mediastreamsignaling.h"
#include "talk/app/webrtc/webrtcsession.h"
#include "talk/base/logging.h"
#include "talk/base/fakenetwork.h"
#include "talk/base/firewallsocketserver.h"
#include "talk/base/gunit.h"
#include "talk/base/network.h"
#include "talk/base/physicalsocketserver.h"
#include "talk/base/stringutils.h"
#include "talk/base/thread.h"
#include "talk/base/virtualsocketserver.h"
#include "talk/p2p/base/stunserver.h"
#include "talk/p2p/base/teststunserver.h"
#include "talk/p2p/client/basicportallocator.h"
#include "talk/session/phone/channelmanager.h"
#include "talk/session/phone/fakedevicemanager.h"
#include "talk/session/phone/fakemediaengine.h"
#include "talk/session/phone/mediasession.h"

using talk_base::scoped_ptr;
using talk_base::SocketAddress;
using webrtc::IceCandidateColletion;
using webrtc::JsepInterface;
using webrtc::JsepSessionDescription;
using webrtc::JsepIceCandidate;
using webrtc::SessionDescriptionInterface;

using webrtc::MediaHints;

static const SocketAddress kClientAddr1("11.11.11.11", 0);
static const SocketAddress kClientAddr2("22.22.22.22", 0);
static const SocketAddress kStunAddr("99.99.99.1", cricket::STUN_SERVER_PORT);

static const char kStream1[] = "stream1";
static const char kVideoTrack1[] = "video1";
static const char kAudioTrack1[] = "audio1";

static const char kStream2[] = "stream2";
static const char kVideoTrack2[] = "video2";
static const char kAudioTrack2[] = "audio2";

// Label of candidates belonging to the first media content.
static const char kMediaContentLabel0[] = "0";
static const int kMediaContentIndex0 = 0;

// Label of candidates belonging to the second media content.
static const char kMediaContentLabel1[] = "1";
static const int kMediaContentIndex1 = 1;

static const int kIceCandidatesTimeout = 3000;


class MockCandidateObserver : public webrtc::IceCandidateObserver {
 public:
  MockCandidateObserver()
      : oncandidatesready_(false) {
  }

  // Found a new candidate.
  virtual void OnIceCandidate(const webrtc::IceCandidateInterface* candidate) {
    if (candidate->label() == kMediaContentLabel0) {
      mline_0_candidates_.push_back(candidate->candidate());
    } else if (candidate->label() == kMediaContentLabel1) {
      mline_1_candidates_.push_back(candidate->candidate());
    }
  }

  virtual void OnIceComplete() {
    EXPECT_FALSE(oncandidatesready_);
    oncandidatesready_ = true;
  }

  bool oncandidatesready_;
  std::vector<cricket::Candidate> mline_0_candidates_;
  std::vector<cricket::Candidate> mline_1_candidates_;
};

class WebRtcSessionForTest : public webrtc::WebRtcSession {
 public:
  WebRtcSessionForTest(cricket::ChannelManager* cmgr,
                       talk_base::Thread* signaling_thread,
                       talk_base::Thread* worker_thread,
                       cricket::PortAllocator* port_allocator,
                       webrtc::IceCandidateObserver* ice_observer,
                       webrtc::MediaStreamSignaling* mediastream_signaling)
    : WebRtcSession(cmgr, signaling_thread, worker_thread, port_allocator,
                    mediastream_signaling) {
    RegisterObserver(ice_observer);
  }
  virtual ~WebRtcSessionForTest() {}

  using webrtc::WebRtcSession::CreateOffer;
  using webrtc::WebRtcSession::CreateAnswer;
  using webrtc::WebRtcSession::SetLocalDescription;
  using webrtc::WebRtcSession::SetRemoteDescription;
  using webrtc::WebRtcSession::ProcessIceMessage;
};

class FakeMediaStreamSignaling : public webrtc::MediaStreamSignaling,
                                 public webrtc::RemoteMediaStreamObserver {
 public:
  FakeMediaStreamSignaling() :
    webrtc::MediaStreamSignaling(talk_base::Thread::Current(), this) {
  }

  // Overrides GetMediaSessionOptions in MediaStreamSignaling.
  // Instead of depending on MediaStreams this version of GetMediaSessionOptions
  // returns the options decided by MediaSessionOptions set in one of the below
  // UseOptions functions.
  virtual cricket::MediaSessionOptions GetMediaSessionOptions(
        const MediaHints& hints) const {
    return options_;
  }

  void UseOptionsWithStream1() {
    cricket::MediaSessionOptions options;
    options.AddStream(cricket::MEDIA_TYPE_VIDEO, kVideoTrack1, kStream1);
    options.AddStream(cricket::MEDIA_TYPE_AUDIO, kAudioTrack1, kStream1);
    options_ = options;
  }

  void UseOptionsWithStream2() {
    cricket::MediaSessionOptions options;
    options.AddStream(cricket::MEDIA_TYPE_VIDEO, kVideoTrack2, kStream2);
    options.AddStream(cricket::MEDIA_TYPE_AUDIO, kAudioTrack2, kStream2);
    options_ = options;
  }

  void UseOptionsWithStream1And2() {
    cricket::MediaSessionOptions options;
    options.AddStream(cricket::MEDIA_TYPE_VIDEO, kVideoTrack1, kStream1);
    options.AddStream(cricket::MEDIA_TYPE_AUDIO, kAudioTrack1, kStream1);
    options.AddStream(cricket::MEDIA_TYPE_VIDEO, kVideoTrack2, kStream2);
    options.AddStream(cricket::MEDIA_TYPE_AUDIO, kAudioTrack2, kStream2);
    options_ = options;
  }

  void UseOptionsReceiveOnly() {
    cricket::MediaSessionOptions options;
    options.has_video = true;
    options_ = options;
  }

  // Implements RemoteMediaStreamObserver.
  virtual void OnAddStream(webrtc::MediaStreamInterface* stream) {
  }
  virtual void OnRemoveStream(webrtc::MediaStreamInterface* stream) {
  }

 private:
  cricket::MediaSessionOptions options_;
};

class WebRtcSessionTest : public testing::Test {
 protected:
  // TODO Investigate why ChannelManager crashes, if it's created
  // after stun_server.
  WebRtcSessionTest()
    : media_engine(new cricket::FakeMediaEngine()),
      device_manager(new cricket::FakeDeviceManager()),
     channel_manager_(new cricket::ChannelManager(
         media_engine, device_manager, talk_base::Thread::Current())),
      desc_factory_(new cricket::MediaSessionDescriptionFactory(
          channel_manager_.get())),
      pss_(new talk_base::PhysicalSocketServer),
      vss_(new talk_base::VirtualSocketServer(pss_.get())),
      fss_(new talk_base::FirewallSocketServer(vss_.get())),
      ss_scope_(fss_.get()),
      stun_server_(talk_base::Thread::Current(), kStunAddr),
      allocator_(&network_manager_, kStunAddr,
                 SocketAddress(), SocketAddress(), SocketAddress()) {
    EXPECT_TRUE(channel_manager_->Init());
    desc_factory_->set_add_legacy_streams(false);
  }

  void AddInterface(const SocketAddress& addr) {
    network_manager_.AddInterface(addr);
  }

  void Init() {
    ASSERT_TRUE(session_.get() == NULL);
    session_.reset(new WebRtcSessionForTest(
        channel_manager_.get(), talk_base::Thread::Current(),
        talk_base::Thread::Current(), &allocator_,
        &observer_,
        &mediastream_signaling_));

    EXPECT_TRUE(session_->Initialize());
    mediastream_signaling_.UseOptionsReceiveOnly();

    video_channel_ = media_engine->GetVideoChannel(0);
    voice_channel_ = media_engine->GetVoiceChannel(0);
  }

  // Creates a local offer and applies it. Starts ice.
  // Call mediastream_signaling_.UseOptionsWithStreamX() before this function
  // to decide which streams to create.
  void InitiateCall() {
    SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
    EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kOffer, offer));
    EXPECT_TRUE(session_->StartIce(JsepInterface::kUseAll));
  }

  bool ChannelsExist() {
    return (session_->voice_channel() != NULL &&
            session_->video_channel() != NULL);
  }

  void CheckTransportChannels() {
    EXPECT_TRUE(session_->GetChannel(cricket::CN_AUDIO, "rtp") != NULL);
    EXPECT_TRUE(session_->GetChannel(cricket::CN_AUDIO, "rtcp") != NULL);
    EXPECT_TRUE(session_->GetChannel(cricket::CN_VIDEO, "video_rtp") != NULL);
    EXPECT_TRUE(session_->GetChannel(cricket::CN_VIDEO, "video_rtcp") != NULL);
  }

  void VerifyCryptoParams(const cricket::SessionDescription* sdp,
                          bool offer) {
    ASSERT_TRUE(session_.get() != NULL);
    const cricket::ContentInfo* content = cricket::GetFirstAudioContent(sdp);
    ASSERT_TRUE(content != NULL);
    const cricket::AudioContentDescription* audio_content =
        static_cast<const cricket::AudioContentDescription*>(
            content->description);
    ASSERT_TRUE(audio_content != NULL);
    if (offer) {
      ASSERT_EQ(2U, audio_content->cryptos().size());
      // key(40) + inline string
      ASSERT_EQ(47U, audio_content->cryptos()[0].key_params.size());
      ASSERT_EQ("AES_CM_128_HMAC_SHA1_32",
                audio_content->cryptos()[0].cipher_suite);
      ASSERT_EQ("AES_CM_128_HMAC_SHA1_80",
                audio_content->cryptos()[1].cipher_suite);
      ASSERT_EQ(47U, audio_content->cryptos()[1].key_params.size());
    } else {
      ASSERT_EQ(1U, audio_content->cryptos().size());
      // key(40) + inline string
      ASSERT_EQ(47U, audio_content->cryptos()[0].key_params.size());
      ASSERT_EQ("AES_CM_128_HMAC_SHA1_32",
                audio_content->cryptos()[0].cipher_suite);
    }

    content = cricket::GetFirstVideoContent(sdp);
    ASSERT_TRUE(content != NULL);
    const cricket::VideoContentDescription* video_content =
        static_cast<const cricket::VideoContentDescription*>(
            content->description);
    ASSERT_TRUE(video_content != NULL);
    ASSERT_EQ(1U, video_content->cryptos().size());
    ASSERT_EQ("AES_CM_128_HMAC_SHA1_80",
              video_content->cryptos()[0].cipher_suite);
    ASSERT_EQ(47U, video_content->cryptos()[0].key_params.size());
  }

  void VerifyNoCryptoParams(const cricket::SessionDescription* sdp) {
    const cricket::ContentInfo* content = cricket::GetFirstAudioContent(sdp);
    ASSERT_TRUE(content != NULL);
    const cricket::AudioContentDescription* audio_content =
        static_cast<const cricket::AudioContentDescription*>(
            content->description);
    ASSERT_TRUE(audio_content != NULL);
    ASSERT_EQ(0U, audio_content->cryptos().size());

    content = cricket::GetFirstVideoContent(sdp);
    ASSERT_TRUE(content != NULL);
    const cricket::VideoContentDescription* video_content =
        static_cast<const cricket::VideoContentDescription*>(
            content->description);
    ASSERT_TRUE(video_content != NULL);
    ASSERT_EQ(0U, video_content->cryptos().size());
  }

  void VerifyAnswerFromNonCryptoOffer() {
    // Create a SDP without Crypto.
    desc_factory_->set_secure(cricket::SEC_DISABLED);
    cricket::MediaSessionOptions options;
    options.has_video = true;
    scoped_ptr<JsepSessionDescription> offer(
        new JsepSessionDescription(desc_factory_->CreateOffer(options, NULL)));
    ASSERT_TRUE(offer.get() != NULL);
    VerifyNoCryptoParams(offer->description());
    const webrtc::SessionDescriptionInterface* answer =
        session_->CreateAnswer(MediaHints(), offer.get());
    // Answer should be NULL as no crypto params in offer.
    ASSERT_TRUE(answer->description() == NULL);
  }

  void VerifyAnswerFromCryptoOffer() {
    desc_factory_->set_secure(cricket::SEC_REQUIRED);
    cricket::MediaSessionOptions options;
    options.has_video = true;
    scoped_ptr<JsepSessionDescription> offer(
        new JsepSessionDescription(desc_factory_->CreateOffer(options, NULL)));
    ASSERT_TRUE(offer.get() != NULL);
    VerifyCryptoParams(offer->description(), true);
    scoped_ptr<SessionDescriptionInterface> answer(
        session_->CreateAnswer(MediaHints(), offer.get()));
    ASSERT_TRUE(answer.get() != NULL);
    VerifyCryptoParams(answer->description(), false);
  }
  // Creates and offer and an answer and applies it on the offer.
  // Call mediastream_signaling_.UseOptionsWithStreamX() before this function
  // to decide which streams to create.
  void SetRemoteAndLocalSessionDescription() {
    SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
    SessionDescriptionInterface* answer = session_->CreateAnswer(MediaHints(),
                                                                 offer);
    EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));
    EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kAnswer, answer));
  }
  void CreateCryptoOfferAndNonCryptoAnswer(SessionDescriptionInterface** offer,
      JsepSessionDescription** nocrypto_answer) {
    mediastream_signaling_.UseOptionsWithStream2();
    *offer = session_->CreateOffer(MediaHints());

    mediastream_signaling_.UseOptionsWithStream1();
    talk_base::scoped_ptr<SessionDescriptionInterface> answer(
        session_->CreateAnswer(MediaHints(), *offer));
    std::string nocrypto_answer_str;
    answer->ToString(&nocrypto_answer_str);
    // Disable the crypto
    const std::string kCrypto = "a=crypto";
    const std::string kCryptoX = "a=cryptx";
    talk_base::replace_substrs(kCrypto.c_str(), kCrypto.length(),
                               kCryptoX.c_str(), kCryptoX.length(),
                               &nocrypto_answer_str);
    *nocrypto_answer = new JsepSessionDescription();
    EXPECT_TRUE((*nocrypto_answer)->Initialize(nocrypto_answer_str));
  }

  cricket::FakeMediaEngine* media_engine;
  cricket::FakeDeviceManager* device_manager;
  talk_base::scoped_ptr<cricket::ChannelManager> channel_manager_;
  talk_base::scoped_ptr<cricket::MediaSessionDescriptionFactory> desc_factory_;
  talk_base::scoped_ptr<talk_base::PhysicalSocketServer> pss_;
  talk_base::scoped_ptr<talk_base::VirtualSocketServer> vss_;
  talk_base::scoped_ptr<talk_base::FirewallSocketServer> fss_;
  talk_base::SocketServerScope ss_scope_;
  cricket::TestStunServer stun_server_;
  talk_base::FakeNetworkManager network_manager_;
  cricket::BasicPortAllocator allocator_;
  FakeMediaStreamSignaling mediastream_signaling_;
  talk_base::scoped_ptr<WebRtcSessionForTest> session_;
  MockCandidateObserver observer_;
  cricket::FakeVideoMediaChannel* video_channel_;
  cricket::FakeVoiceMediaChannel* voice_channel_;
};

TEST_F(WebRtcSessionTest, TestInitialize) {
  WebRtcSessionTest::Init();
  EXPECT_TRUE(ChannelsExist());
  CheckTransportChannels();
}

TEST_F(WebRtcSessionTest, TestSessionCandidates) {
  AddInterface(kClientAddr1);
  WebRtcSessionTest::Init();
  WebRtcSessionTest::InitiateCall();
  EXPECT_TRUE_WAIT(observer_.oncandidatesready_, kIceCandidatesTimeout);
  EXPECT_EQ(4u, observer_.mline_0_candidates_.size());
  EXPECT_EQ(4u, observer_.mline_1_candidates_.size());
}

TEST_F(WebRtcSessionTest, TestMultihomeCandidataes) {
  AddInterface(kClientAddr1);
  AddInterface(kClientAddr2);
  WebRtcSessionTest::Init();
  WebRtcSessionTest::InitiateCall();
  EXPECT_TRUE_WAIT(observer_.oncandidatesready_, kIceCandidatesTimeout);
  EXPECT_EQ(8u, observer_.mline_0_candidates_.size());
  EXPECT_EQ(8u, observer_.mline_1_candidates_.size());
}

TEST_F(WebRtcSessionTest, TestStunError) {
  AddInterface(kClientAddr1);
  AddInterface(kClientAddr2);
  fss_->AddRule(false, talk_base::FP_UDP, talk_base::FD_ANY, kClientAddr1);
  WebRtcSessionTest::Init();
  WebRtcSessionTest::InitiateCall();
  // Since kClientAddr1 is blocked, not expecting stun candidates for it.
  EXPECT_TRUE_WAIT(observer_.oncandidatesready_, kIceCandidatesTimeout);
  EXPECT_EQ(6u, observer_.mline_0_candidates_.size());
  EXPECT_EQ(6u, observer_.mline_1_candidates_.size());
}

// Test creating offers and receive answers and make sure the
// media engine creates the expected send and receive streams.
TEST_F(WebRtcSessionTest, TestCreateOfferReceiveAnswer) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsWithStream1();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());

  mediastream_signaling_.UseOptionsWithStream2();
  SessionDescriptionInterface* answer = session_->CreateAnswer(MediaHints(),
                                                               offer);
  // SetLocalDescription and SetRemoteDescriptions takes ownership of offer
  // and answer.
  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kOffer, offer));
  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kAnswer, answer));

  ASSERT_EQ(1u, video_channel_->recv_streams().size());
  EXPECT_TRUE(kVideoTrack2 == video_channel_->recv_streams()[0].name);

  ASSERT_EQ(1u, voice_channel_->recv_streams().size());
  EXPECT_TRUE(kAudioTrack2 == voice_channel_->recv_streams()[0].name);

  ASSERT_EQ(1u, video_channel_->send_streams().size());
  EXPECT_TRUE(kVideoTrack1 == video_channel_->send_streams()[0].name);
  ASSERT_EQ(1u, voice_channel_->send_streams().size());
  EXPECT_TRUE(kAudioTrack1 == voice_channel_->send_streams()[0].name);

  // Create new offer without send streams.
  mediastream_signaling_.UseOptionsReceiveOnly();
  offer = session_->CreateOffer(MediaHints());

  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kOffer, offer));

  mediastream_signaling_.UseOptionsWithStream2();
  answer = session_->CreateAnswer(MediaHints(), offer);
  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kAnswer, answer));

  EXPECT_EQ(0u, video_channel_->send_streams().size());
  EXPECT_EQ(0u, voice_channel_->send_streams().size());

  // Make sure the receive streams have not changed.
  ASSERT_EQ(1u, video_channel_->recv_streams().size());
  EXPECT_TRUE(kVideoTrack2 == video_channel_->recv_streams()[0].name);
  ASSERT_EQ(1u, voice_channel_->recv_streams().size());
  EXPECT_TRUE(kAudioTrack2 == voice_channel_->recv_streams()[0].name);
}

// Test receiving offers and creating answers and make sure the
// media engine creates the expected send and receive streams.
TEST_F(WebRtcSessionTest, TestReceiveOfferCreateAnswer) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsWithStream2();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());

  mediastream_signaling_.UseOptionsWithStream1();
  SessionDescriptionInterface* answer = session_->CreateAnswer(MediaHints(),
                                                               offer);

  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));
  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kAnswer, answer));

  ASSERT_EQ(1u, video_channel_->recv_streams().size());
  EXPECT_TRUE(kVideoTrack2 == video_channel_->recv_streams()[0].name);

  ASSERT_EQ(1u, voice_channel_->recv_streams().size());
  EXPECT_TRUE(kAudioTrack2 == voice_channel_->recv_streams()[0].name);

  ASSERT_EQ(1u, video_channel_->send_streams().size());
  EXPECT_TRUE(kVideoTrack1 == video_channel_->send_streams()[0].name);
  ASSERT_EQ(1u, voice_channel_->send_streams().size());
  EXPECT_TRUE(kAudioTrack1 == voice_channel_->send_streams()[0].name);

  mediastream_signaling_.UseOptionsWithStream1And2();
  offer = session_->CreateOffer(MediaHints());

  // Answer by turning off all send streams.
  mediastream_signaling_.UseOptionsReceiveOnly();
  answer = session_->CreateAnswer(MediaHints(), offer);

  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));
  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kAnswer, answer));

  ASSERT_EQ(2u, video_channel_->recv_streams().size());
  EXPECT_TRUE(kVideoTrack1 == video_channel_->recv_streams()[0].name);
  EXPECT_TRUE(kVideoTrack2 == video_channel_->recv_streams()[1].name);
  ASSERT_EQ(2u, voice_channel_->recv_streams().size());
  EXPECT_TRUE(kAudioTrack1 == voice_channel_->recv_streams()[0].name);
  EXPECT_TRUE(kAudioTrack2 == voice_channel_->recv_streams()[1].name);

  // Make sure we have no send streams.
  EXPECT_EQ(0u, video_channel_->send_streams().size());
  EXPECT_EQ(0u, voice_channel_->send_streams().size());
}

// Test we will return fail when apply an offer that doesn't have
// crypto enabled.
TEST_F(WebRtcSessionTest, SetNonCryptoOffer) {
  WebRtcSessionTest::Init();

  desc_factory_->set_secure(cricket::SEC_DISABLED);
  cricket::MediaSessionOptions options;
  options.has_video = true;
  talk_base::scoped_ptr<JsepSessionDescription> offer(
      new JsepSessionDescription(desc_factory_->CreateOffer(options, NULL)));
  VerifyNoCryptoParams(offer->description());
  EXPECT_FALSE(session_->SetRemoteDescription(JsepInterface::kOffer,
                                              offer.get()));
  EXPECT_FALSE(session_->SetLocalDescription(JsepInterface::kOffer,
                                             offer.get()));
}

// Test we will return fail when apply an answer that doesn't have
// crypto enabled.
TEST_F(WebRtcSessionTest, SetLocalNonCryptoAnswer) {
  WebRtcSessionTest::Init();
  SessionDescriptionInterface* offer = NULL;
  JsepSessionDescription* answer = NULL;
  CreateCryptoOfferAndNonCryptoAnswer(&offer, &answer);

  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));
  EXPECT_FALSE(session_->SetLocalDescription(JsepInterface::kAnswer, answer));
  // When the SetLocalDescription failed the ownership of answer wasn't
  // transferred. So we need to delete it here.
  delete answer;
}

// Test we will return fail when apply an answer that doesn't have
// crypto enabled.
TEST_F(WebRtcSessionTest, SetRemoteNonCryptoAnswer) {
  WebRtcSessionTest::Init();
  SessionDescriptionInterface* offer = NULL;
  JsepSessionDescription* answer = NULL;
  CreateCryptoOfferAndNonCryptoAnswer(&offer, &answer);

  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kOffer, offer));
  EXPECT_FALSE(session_->SetRemoteDescription(JsepInterface::kAnswer, answer));
  // When the SetRemoteDescription failed the ownership of answer wasn't
  // transferred. So we need to delete it here.
  delete answer;
}

TEST_F(WebRtcSessionTest, TestSetLocalOfferTwice) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsReceiveOnly();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());

  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kOffer, offer));
  EXPECT_FALSE(session_->SetLocalDescription(JsepInterface::kOffer, offer));
}

TEST_F(WebRtcSessionTest, TestSetRemoteOfferTwice) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsReceiveOnly();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));
  EXPECT_FALSE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));
}

TEST_F(WebRtcSessionTest, TestSetLocalAndRemoteOffer) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsReceiveOnly();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kOffer, offer));
  EXPECT_FALSE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));
}

TEST_F(WebRtcSessionTest, TestSetRemoteAndLocalOffer) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsReceiveOnly();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));
  EXPECT_FALSE(session_->SetLocalDescription(JsepInterface::kOffer, offer));
}

TEST_F(WebRtcSessionTest, TestSetLocalAnswerWithoutOffer) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsReceiveOnly();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
  SessionDescriptionInterface* answer = session_->CreateAnswer(MediaHints(),
                                                               offer);
  EXPECT_FALSE(session_->SetLocalDescription(JsepInterface::kAnswer, answer));
}

TEST_F(WebRtcSessionTest, TestSetRemoteAnswerWithoutOffer) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsReceiveOnly();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
  SessionDescriptionInterface* answer = session_->CreateAnswer(MediaHints(),
                                                               offer);
  EXPECT_FALSE(session_->SetRemoteDescription(JsepInterface::kAnswer, answer));
}

TEST_F(WebRtcSessionTest, TestAddRemoteCandidate) {
  WebRtcSessionTest::Init();

  cricket::Candidate candidate1;
  candidate1.set_name("fake_candidate1");
  JsepIceCandidate ice_candidate(talk_base::ToString(0), candidate1);

  // Fail since we have not set a remote description
  EXPECT_FALSE(session_->ProcessIceMessage(&ice_candidate));

  SetRemoteAndLocalSessionDescription();

  EXPECT_TRUE(session_->ProcessIceMessage(&ice_candidate));

  JsepIceCandidate bad_ice_candidate("bad content name", candidate1);
  EXPECT_FALSE(session_->ProcessIceMessage(&bad_ice_candidate));
}

// Test that a remote candidate is added to the remote session description and
// that it is retained if the remote session description is changed.
TEST_F(WebRtcSessionTest, TestRemoteCandidatesAddedToSessionDescription) {
  WebRtcSessionTest::Init();
  cricket::Candidate candidate1;
  candidate1.set_name("fake_candidate1");
  JsepIceCandidate ice_candidate1(kMediaContentLabel0, candidate1);

  SetRemoteAndLocalSessionDescription();
  EXPECT_TRUE(session_->StartIce(JsepInterface::kUseAll));

  EXPECT_TRUE(session_->ProcessIceMessage(&ice_candidate1));
  const SessionDescriptionInterface* remote_desc =
      session_->remote_description();
  ASSERT_TRUE(remote_desc != NULL);
  ASSERT_EQ(2u, remote_desc->number_of_mediasections());
  const IceCandidateColletion* candidates =
      remote_desc->candidates(kMediaContentIndex0);
  ASSERT_EQ(1u, candidates->count());
  EXPECT_EQ(kMediaContentLabel0, candidates->at(0)->label());

  // Update the RemoteSessionDescription with a new session description and
  // a candidate and check that the new remote session description contains both
  // candidates.
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
  cricket::Candidate candidate2;
  candidate2.set_name("fake_candidate2");
  JsepIceCandidate ice_candidate2(kMediaContentLabel0, candidate2);
  EXPECT_TRUE(offer->AddCandidate(&ice_candidate2));
  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));

  remote_desc = session_->remote_description();
  ASSERT_TRUE(remote_desc != NULL);
  ASSERT_EQ(2u, remote_desc->number_of_mediasections());
  candidates = remote_desc->candidates(kMediaContentIndex0);
  ASSERT_EQ(2u, candidates->count());
  EXPECT_EQ(kMediaContentLabel0, candidates->at(0)->label());
  EXPECT_TRUE(candidate2.IsEquivalent(candidates->at(0)->candidate()));
  EXPECT_EQ(kMediaContentLabel0, candidates->at(1)->label());
  EXPECT_TRUE(candidate1.IsEquivalent(candidates->at(1)->candidate()));

  // Test that the candidate is ignored if we can add the same candidate again.
  EXPECT_TRUE(session_->ProcessIceMessage(&ice_candidate2));
}

// Test that local candidates are added to the local session description and
// that they are retained if the local session description is changed.
TEST_F(WebRtcSessionTest, TestLocalCandidatesAddedToSessionDescription) {
  AddInterface(kClientAddr1);
  WebRtcSessionTest::Init();
  SetRemoteAndLocalSessionDescription();

  const SessionDescriptionInterface* local_desc = session_->local_description();
  const IceCandidateColletion* candidates =
      local_desc->candidates(kMediaContentIndex0);
  ASSERT_TRUE(candidates != NULL);
  EXPECT_EQ(0u, candidates->count());

  EXPECT_TRUE(session_->StartIce(JsepInterface::kUseAll));
  EXPECT_TRUE_WAIT(observer_.oncandidatesready_, kIceCandidatesTimeout);

  local_desc = session_->local_description();
  candidates = local_desc->candidates(kMediaContentIndex0);
  ASSERT_TRUE(candidates != NULL);
  EXPECT_LT(0u, candidates->count());
  candidates = local_desc->candidates(1);
  ASSERT_TRUE(candidates != NULL);
  EXPECT_LT(0u, candidates->count());

  // Update the session descriptions.
  mediastream_signaling_.UseOptionsWithStream1();
  SetRemoteAndLocalSessionDescription();

  local_desc = session_->local_description();
  candidates = local_desc->candidates(kMediaContentIndex0);
  ASSERT_TRUE(candidates != NULL);
  EXPECT_LT(0u, candidates->count());
  candidates = local_desc->candidates(1);
  ASSERT_TRUE(candidates != NULL);
  EXPECT_LT(0u, candidates->count());
}

// Test that we can set a remote session description with remote candidates.
TEST_F(WebRtcSessionTest, TestSetRemoteSessionDescriptionWithCandidates) {
  WebRtcSessionTest::Init();

  cricket::Candidate candidate1;
  candidate1.set_name("fake_candidate1");

  JsepIceCandidate ice_candidate(kMediaContentLabel0, candidate1);
  mediastream_signaling_.UseOptionsReceiveOnly();
  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());

  EXPECT_TRUE(offer->AddCandidate(&ice_candidate));
  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kOffer, offer));

  const SessionDescriptionInterface* remote_desc =
      session_->remote_description();
  ASSERT_TRUE(remote_desc != NULL);
  ASSERT_EQ(2u, remote_desc->number_of_mediasections());
  const IceCandidateColletion* candidates =
      remote_desc->candidates(kMediaContentIndex0);
  ASSERT_EQ(1u, candidates->count());
  EXPECT_EQ(kMediaContentLabel0, candidates->at(0)->label());

  SessionDescriptionInterface* answer = session_->CreateAnswer(MediaHints(),
                                                              remote_desc);
  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kAnswer, answer));
  EXPECT_TRUE(session_->StartIce(JsepInterface::kUseAll));
  // TODO: How do I check that the transport have got the
  // remote candidates?
}

// Test that offers and answers contains ice canidates when Ice candidates have
// been gathered.
TEST_F(WebRtcSessionTest, TestSetLocalAndRemoteDescriptionWithCandidates) {
  AddInterface(kClientAddr1);
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsReceiveOnly();
  SetRemoteAndLocalSessionDescription();
  EXPECT_TRUE(session_->StartIce(JsepInterface::kUseAll));
  // Wait until at least one local candidate has been collected.
  EXPECT_TRUE_WAIT(0u < observer_.mline_0_candidates_.size(),
                   kIceCandidatesTimeout);
  EXPECT_TRUE_WAIT(0u < observer_.mline_1_candidates_.size(),
                   kIceCandidatesTimeout);

  SessionDescriptionInterface* offer = session_->CreateOffer(MediaHints());
  ASSERT_TRUE(offer->candidates(kMediaContentIndex0) != NULL);
  EXPECT_LT(0u, offer->candidates(kMediaContentIndex0)->count());
  ASSERT_TRUE(offer->candidates(kMediaContentIndex1) != NULL);
  EXPECT_LT(0u, offer->candidates(kMediaContentIndex1)->count());

  SessionDescriptionInterface* answer = session_->CreateAnswer(MediaHints(),
                                                               offer);
  ASSERT_TRUE(answer->candidates(kMediaContentIndex0) != NULL);
  EXPECT_LT(0u, answer->candidates(kMediaContentIndex0)->count());
  ASSERT_TRUE(answer->candidates(kMediaContentIndex1) != NULL);
  EXPECT_LT(0u, answer->candidates(kMediaContentIndex1)->count());

  EXPECT_TRUE(session_->SetLocalDescription(JsepInterface::kOffer, offer));
  EXPECT_TRUE(session_->SetRemoteDescription(JsepInterface::kAnswer, answer));
}


TEST_F(WebRtcSessionTest, TestDefaultSetSecurePolicy) {
  WebRtcSessionTest::Init();
  EXPECT_EQ(cricket::SEC_REQUIRED, session_->secure_policy());
}

TEST_F(WebRtcSessionTest, VerifyCryptoParamsInSDP) {
  WebRtcSessionTest::Init();
  mediastream_signaling_.UseOptionsWithStream1();
  scoped_ptr<SessionDescriptionInterface> offer(
      session_->CreateOffer(MediaHints()));
  VerifyCryptoParams(offer->description(), true);
}

TEST_F(WebRtcSessionTest, VerifyNoCryptoParamsInSDP) {
  WebRtcSessionTest::Init();
  session_->set_secure_policy(cricket::SEC_DISABLED);
  mediastream_signaling_.UseOptionsWithStream1();
  scoped_ptr<SessionDescriptionInterface> offer(
        session_->CreateOffer(MediaHints()));
  VerifyNoCryptoParams(offer->description());
}

TEST_F(WebRtcSessionTest, VerifyAnswerFromNonCryptoOffer) {
  WebRtcSessionTest::Init();
  VerifyAnswerFromNonCryptoOffer();
}

TEST_F(WebRtcSessionTest, VerifyAnswerFromCryptoOffer) {
  WebRtcSessionTest::Init();
  VerifyAnswerFromCryptoOffer();
}
