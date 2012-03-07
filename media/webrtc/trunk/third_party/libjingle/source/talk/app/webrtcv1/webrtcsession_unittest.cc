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

#include <stdio.h>

#include <list>

#include "talk/app/webrtcv1/unittest_utilities.h"
#include "talk/app/webrtcv1/webrtcsession.h"
#include "talk/base/fakenetwork.h"
#include "talk/base/gunit.h"
#include "talk/base/helpers.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/thread.h"
#include "talk/p2p/base/fakesession.h"
#include "talk/p2p/base/portallocator.h"
#include "talk/p2p/base/sessiondescription.h"
#include "talk/p2p/client/fakeportallocator.h"
#include "talk/session/phone/dummydevicemanager.h"
#include "talk/session/phone/fakewebrtcvcmfactory.h"
#include "talk/session/phone/fakewebrtcvideocapturemodule.h"
#include "talk/session/phone/mediasessionclient.h"
#include "talk/session/phone/webrtcmediaengine.h"
#include "talk/session/phone/webrtcvideocapturer.h"

class WebRtcSessionTest
    : public sigslot::has_slots<>,
      public testing::Test {
 public:
  enum CallbackId {
    kNone,
    kOnAddStream,
    kOnRemoveStream,
    kOnLocalDescription,
    kOnFailedCall,
  };

  WebRtcSessionTest()
      : last_was_video_(false),
        last_description_ptr_(NULL),
        session_(NULL),
        receiving_(false),
        allocator_(NULL),
        channel_manager_(NULL),
        video_capturer_(NULL),
        worker_thread_(NULL),
        signaling_thread_(NULL) {
  }

  ~WebRtcSessionTest() {
    session_.reset();
    // Ensure the VideoCapturer be unregistered before destroyed.
    channel_manager_->SetVideoCapturer(NULL, 0);
  }

  void OnAddStream(const std::string& stream_id, bool video) {
    callback_ids_.push_back(kOnAddStream);
    last_stream_id_ = stream_id;
    last_was_video_ = video;
  }
  void OnRemoveStream(const std::string& stream_id, bool video) {
    callback_ids_.push_back(kOnRemoveStream);
    last_stream_id_ = stream_id;
    last_was_video_ = video;
  }
  void OnLocalDescription(
      const cricket::SessionDescription* desc,
      const std::vector<cricket::Candidate>& candidates) {
    callback_ids_.push_back(kOnLocalDescription);
    last_description_ptr_.reset(CopySessionDescription(desc));
    CopyCandidates(candidates, &last_candidates_);
  }
  cricket::SessionDescription* GetLocalDescription(
      std::vector<cricket::Candidate>* candidates) {
    if (last_candidates_.empty()) {
      return NULL;
    }
    if (!last_description_ptr_.get()) {
      return NULL;
    }
    CopyCandidates(last_candidates_, candidates);
    return CopySessionDescription(last_description_ptr_.get());
  }

  void OnFailedCall() {
    callback_ids_.push_back(kOnFailedCall);
  }

  CallbackId PopOldestCallback() {
    if (callback_ids_.empty()) {
      return kNone;
    }
    const CallbackId return_value = callback_ids_.front();
    callback_ids_.pop_front();
    return return_value;
  }

  CallbackId PeekOldestCallback() {
    if (callback_ids_.empty()) {
      return kNone;
    }
    const CallbackId return_value = callback_ids_.front();
    return return_value;
  }

  void Reset() {
    callback_ids_.clear();
    last_stream_id_ = "";
    last_was_video_ = false;
    last_description_ptr_.reset();
    last_candidates_.clear();
  }

  bool WaitForCallback(CallbackId id, int timeout_ms) {
    bool success = false;
    for (int ms = 0; ms < timeout_ms; ms++) {
      const CallbackId peek_id = PeekOldestCallback();
      if (peek_id == id) {
        PopOldestCallback();
        success = true;
        break;
      } else if (peek_id != kNone) {
        success = false;
        break;
      }
      talk_base::Thread::Current()->ProcessMessages(1);
    }
    return success;
  }

  bool Init(bool receiving) {
    if (signaling_thread_ != NULL)
        return false;
    signaling_thread_ = talk_base::Thread::Current();
    receiving_ = receiving;

    if (worker_thread_!= NULL)
        return false;
    worker_thread_ = talk_base::Thread::Current();

    cricket::FakePortAllocator* fake_port_allocator =
        new cricket::FakePortAllocator(worker_thread_, NULL);

    allocator_.reset(static_cast<cricket::PortAllocator*>(fake_port_allocator));

    cricket::DummyDeviceManager* device_manager(
        new cricket::DummyDeviceManager());
    cricket::WebRtcMediaEngine* webrtc_media_engine(
        new cricket::WebRtcMediaEngine(NULL, NULL, NULL));
    channel_manager_.reset(new cricket::ChannelManager(webrtc_media_engine,
                                                       device_manager,
                                                       worker_thread_));
    if (!channel_manager_->Init())
      return false;

    FakeWebRtcVideoCaptureModule* vcm =
        new FakeWebRtcVideoCaptureModule(NULL, 123);
    video_capturer_.reset(new cricket::WebRtcVideoCapturer);
    if (!video_capturer_->Init(vcm)) {
      return false;
    }
    // The SetVideoCapturer call doesn't transfer ownership.
    if (!channel_manager_->SetVideoCapturer(video_capturer_.get(), 0))
      return false;

    talk_base::CreateRandomString(8, &id_);

    session_.reset(new webrtc::WebRtcSession(
        id_, receiving_ , allocator_.get(),
        channel_manager_.get(),
        signaling_thread_));
    session_->SignalAddStream.connect(this, &WebRtcSessionTest::OnAddStream);
    session_->SignalRemoveStream.connect(this,
        &WebRtcSessionTest::OnRemoveStream);
    session_->SignalLocalDescription.connect(this,
        &WebRtcSessionTest::OnLocalDescription);
    session_->SignalFailedCall.connect(this, &WebRtcSessionTest::OnFailedCall);
    return true;
  }

  // All session APIs must be called from the signaling thread.
  bool CallInitiate() {
    return session_->Initiate();
  }

  bool CallConnect() {
    if (!session_->Connect())
      return false;
    // This callback does not happen with FakeTransport!
    if (!WaitForCallback(kOnLocalDescription, 1000)) {
      return false;
    }
    return true;
  }

  bool CallOnRemoteDescription(
      cricket::SessionDescription* description,
      std::vector<cricket::Candidate> candidates) {
    if (!session_->OnRemoteDescription(description, candidates)) {
      return false;
    }
    if (!WaitForCallback(kOnAddStream, 1000)) {
      return false;
    }
    return true;
  }

  bool CallOnInitiateMessage(
      cricket::SessionDescription* description,
      const std::vector<cricket::Candidate>& candidates) {
    if (!session_->OnInitiateMessage(description, candidates)) {
      return false;
    }
    if (!WaitForCallback(kOnAddStream, 1000)) {
      return false;
    }
    return true;
  }

  bool CallCreateVoiceChannel(const std::string& stream_id) {
    if (!session_->CreateVoiceChannel(stream_id)) {
      return false;
    }
    return true;
  }

  bool CallCreateVideoChannel(const std::string& stream_id) {
    if (!session_->CreateVideoChannel(stream_id)) {
      return false;
    }
    return true;
  }

  bool CallRemoveStream(const std::string& stream_id) {
    return session_->RemoveStream(stream_id);
  }

  void CallRemoveAllStreams() {
    session_->RemoveAllStreams();
  }

  bool CallHasChannel(const std::string& label) {
    return session_->HasStream(label);
  }

  bool CallHasChannel(bool video) {
    return session_->HasChannel(video);
  }

  bool CallHasAudioChannel() {
    return session_->HasAudioChannel();
  }

  bool CallHasVideoChannel() {
    return session_->HasVideoChannel();
  }

  bool CallSetVideoRenderer(const std::string& stream_id,
                            cricket::VideoRenderer* renderer) {
    return session_->SetVideoRenderer(stream_id, renderer);
  }

  const std::vector<cricket::Candidate>& CallLocalCandidates() {
    return session_->local_candidates();
  }
  cricket::ChannelManager* channel_manager() const {
    return channel_manager_.get();
  }
  const cricket::SessionDescription* local_description() const {
    return session_->local_description();
  }
  cricket::SessionDescription* remote_description() const {
    return session_->remote_description();
  }

  void VerifyCryptoParams(const cricket::SessionDescription* sdp,
                          bool offer) {
    const cricket::ContentInfo* content = cricket::GetFirstAudioContent(sdp);
    if (content) {
      const cricket::AudioContentDescription* audio_content =
          static_cast<const cricket::AudioContentDescription*>(
              content->description);
      ASSERT_TRUE(audio_content != NULL);
      ASSERT_EQ(offer ? 2U : 1U, audio_content->cryptos().size());
      // key(40) + inline string
      ASSERT_EQ(47U, audio_content->cryptos()[0].key_params.size());
      ASSERT_EQ("AES_CM_128_HMAC_SHA1_32",
                audio_content->cryptos()[0].cipher_suite);
      if (offer) {
        ASSERT_EQ(47U, audio_content->cryptos()[1].key_params.size());
        ASSERT_EQ("AES_CM_128_HMAC_SHA1_80",
                  audio_content->cryptos()[1].cipher_suite);
      }
    }
    content = cricket::GetFirstVideoContent(sdp);
    if (content) {
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
  }

 private:
  std::list<CallbackId> callback_ids_;

  std::string last_stream_id_;
  bool last_was_video_;
  talk_base::scoped_ptr<cricket::SessionDescription> last_description_ptr_;
  std::vector<cricket::Candidate> last_candidates_;

  talk_base::scoped_ptr<webrtc::WebRtcSession> session_;
  std::string id_;
  bool receiving_;

  talk_base::scoped_ptr<cricket::PortAllocator> allocator_;

  talk_base::scoped_ptr<cricket::ChannelManager> channel_manager_;
  talk_base::scoped_ptr<cricket::WebRtcVideoCapturer> video_capturer_;

  talk_base::Thread* worker_thread_;
  talk_base::Thread* signaling_thread_;
};

bool CallbackReceived(WebRtcSessionTest* session, int timeout) {
  EXPECT_EQ_WAIT(WebRtcSessionTest::kNone, session->PeekOldestCallback(),
                 timeout);
  const WebRtcSessionTest::CallbackId peek_id =
      session->PeekOldestCallback();
  return peek_id != WebRtcSessionTest::kNone;
}

TEST_F(WebRtcSessionTest, InitializationReceiveSanity) {
  const bool kReceiving = true;
  ASSERT_TRUE(Init(kReceiving));
  ASSERT_TRUE(CallInitiate());

  // Should return false because no stream has been set up yet.
  EXPECT_FALSE(CallConnect());
  const bool kVideo = true;
  EXPECT_FALSE(CallHasChannel(kVideo));
  EXPECT_FALSE(CallHasChannel(!kVideo));

  EXPECT_EQ(kNone, PopOldestCallback());
}

TEST_F(WebRtcSessionTest, AudioSendCallSetUp) {
  const bool kReceiving = false;
  ASSERT_TRUE(Init(kReceiving));

  ASSERT_TRUE(CallInitiate());

  ASSERT_TRUE(CallCreateVoiceChannel("Audio"));
  ASSERT_TRUE(CallConnect());

  std::vector<cricket::Candidate> candidates;
  cricket::SessionDescription* local_session = GetLocalDescription(
      &candidates);
  ASSERT_FALSE(candidates.empty());
  ASSERT_FALSE(local_session == NULL);
  if (!CallOnRemoteDescription(local_session, candidates)) {
      delete local_session;
      FAIL();
  }

  // All callbacks should be caught. Assert it.
  ASSERT_FALSE(CallbackReceived(this, 1000));
  ASSERT_TRUE(CallHasAudioChannel() &&
              !CallHasVideoChannel());
}

TEST_F(WebRtcSessionTest, VideoSendCallSetUp) {
  const bool kReceiving = false;
  ASSERT_TRUE(Init(kReceiving));

  ASSERT_TRUE(CallInitiate());

  ASSERT_TRUE(CallCreateVideoChannel("Video"));
  ASSERT_TRUE(CallConnect());

  std::vector<cricket::Candidate> candidates;
  cricket::SessionDescription* local_session = GetLocalDescription(
      &candidates);
  ASSERT_FALSE(candidates.empty());
  ASSERT_FALSE(local_session == NULL);

  if (!CallOnRemoteDescription(local_session, candidates)) {
      delete local_session;
      FAIL();
  }

  // All callbacks should be caught. Assert it.
  ASSERT_FALSE(CallbackReceived(this, 1000));
  ASSERT_TRUE(!CallHasAudioChannel() &&
              CallHasVideoChannel());
}

TEST_F(WebRtcSessionTest, AudioReceiveCallSetUp) {
  const bool kReceiving = true;
  const bool video = false;

  ASSERT_TRUE(Init(kReceiving));

  std::vector<cricket::Candidate> candidates;
  cricket::SessionDescription* local_session =
      GenerateFakeSession(channel_manager(), video, &candidates);
  ASSERT_FALSE(candidates.empty());
  ASSERT_FALSE(local_session == NULL);
  ASSERT_TRUE(CallInitiate());
  if (!CallOnInitiateMessage(local_session, candidates)) {
    delete local_session;
    FAIL();
  }

  ASSERT_FALSE(CallbackReceived(this, 1000));
  ASSERT_TRUE(CallHasAudioChannel() &&
              !CallHasVideoChannel());
  // Incoming call - local desc has the answer.
  VerifyCryptoParams(local_description(), false);
  VerifyCryptoParams(remote_description(), true);
}

TEST_F(WebRtcSessionTest, VideoReceiveCallSetUp) {
  const bool kReceiving = true;
  const bool video = true;

  ASSERT_TRUE(Init(kReceiving));

  std::vector<cricket::Candidate> candidates;
  cricket::SessionDescription* local_session =
      GenerateFakeSession(channel_manager(), video, &candidates);
  ASSERT_FALSE(candidates.empty());
  ASSERT_FALSE(local_session == NULL);
  ASSERT_TRUE(CallInitiate());
  if (!CallOnInitiateMessage(local_session, candidates)) {
    delete local_session;
    FAIL();
  }

  ASSERT_FALSE(CallbackReceived(this, 1000));
  ASSERT_TRUE(!CallHasAudioChannel() &&
              CallHasVideoChannel());
  // Incoming call - local desc has the answer.
  VerifyCryptoParams(local_description(), false);
  VerifyCryptoParams(remote_description(), true);
}
