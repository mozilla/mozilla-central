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

#include "talk/app/webrtc/roapmessages.h"
#include "talk/app/webrtc/roapsession.h"
#include "talk/base/gunit.h"
#include "talk/base/logging.h"
#include "talk/base/scoped_ptr.h"
#include "talk/p2p/base/transport.h"
#include "talk/session/phone/mediasession.h"

using cricket::AudioContentDescription;
using cricket::Candidates;
using cricket::ContentInfo;
using cricket::SessionDescription;
using cricket::VideoContentDescription;
using webrtc::RoapMessageBase;
using webrtc::RoapSession;
using webrtc::RoapOffer;

// MediaStream 1
static const char kStreamLabel1[] = "local_stream_1";
static const char kStream1Cname[] = "stream_1_cname";
static const char kAudioTrackLabel1[] = "local_audio_1";
static const uint32 kAudioTrack1Ssrc = 1;
static const char kVideoTrackLabel1[] = "local_video_1";
static const uint32 kVideoTrack1Ssrc = 2;
static const char kVideoTrackLabel2[] = "local_video_2";
static const uint32 kVideoTrack2Ssrc = 3;

// MediaStream 2
static const char kStreamLabel2[] = "local_stream_2";
static const char kStream2Cname[] = "stream_2_cname";
static const char kAudioTrackLabel2[] = "local_audio_2";
static const uint32 kAudioTrack2Ssrc = 4;
static const char kVideoTrackLabel3[] = "local_video_3";
static const uint32 kVideoTrack3Ssrc = 5;

class RoapSessionTest: public testing::Test {
 public:
  void SetUp() {
    talk_base::scoped_ptr<AudioContentDescription> audio(
        new AudioContentDescription());
    audio->set_rtcp_mux(true);
    cricket::StreamParams audio_stream1;
    audio_stream1.name = kAudioTrackLabel1;
    audio_stream1.cname = kStream1Cname;
    audio_stream1.sync_label = kStreamLabel1;
    audio_stream1.ssrcs.push_back(kAudioTrack1Ssrc);
    audio->AddStream(audio_stream1);
    desc1_.AddContent(cricket::CN_AUDIO, cricket::NS_JINGLE_RTP,
                      audio.release());

    talk_base::scoped_ptr<VideoContentDescription> video(
        new VideoContentDescription());

    cricket::StreamParams video_stream1;
    video_stream1.name = kVideoTrackLabel1;
    video_stream1.cname = kStream1Cname;
    video_stream1.sync_label = kStreamLabel1;
    video_stream1.ssrcs.push_back(kVideoTrack1Ssrc);
    video->AddStream(video_stream1);

    cricket::StreamParams video_stream2;
    video_stream2.name = kVideoTrackLabel2;
    video_stream2.cname = kStream1Cname;
    video_stream2.sync_label = kStreamLabel1;
    video_stream2.ssrcs.push_back(kVideoTrack2Ssrc);
    video->AddStream(video_stream2);
    desc1_.AddContent(cricket::CN_VIDEO, cricket::NS_JINGLE_RTP,
                      video.release());

    audio.reset(new AudioContentDescription());
    audio->set_rtcp_mux(true);
    cricket::StreamParams audio_stream2;
    audio_stream2.name = kAudioTrackLabel2;
    audio_stream2.cname = kStream2Cname;
    audio_stream2.sync_label = kStreamLabel2;
    audio_stream2.ssrcs.push_back(kAudioTrack2Ssrc);
    audio->AddStream(audio_stream2);
    desc2_.AddContent(cricket::CN_AUDIO, cricket::NS_JINGLE_RTP,
                      audio.release());

    video.reset(new VideoContentDescription());
    cricket::StreamParams video_stream3;
    video_stream3.name = kVideoTrackLabel3;
    video_stream3.cname = kStream2Cname;
    video_stream3.sync_label = kStreamLabel2;
    video_stream3.ssrcs.push_back(kVideoTrack3Ssrc);
    video->AddStream(video_stream3);
    desc2_.AddContent(cricket::CN_VIDEO, cricket::NS_JINGLE_RTP,
                      video.release());

    int port = 1234;
    talk_base::SocketAddress address("127.0.0.1", port++);
    cricket::Candidate candidate1("video_rtcp", "udp", address, 1,
        "user_video_rtcp", "password_video_rtcp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate2("video_rtp", "udp", address, 1,
        "user_video_rtp", "password_video_rtp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate3("rtp", "udp", address, 1,
        "user_rtp", "password_rtp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate4("rtcp", "udp", address, 1,
        "user_rtcp", "password_rtcp", "local", "eth0", 0);

    candidates_.push_back(candidate1);
    candidates_.push_back(candidate2);
    candidates_.push_back(candidate3);
    candidates_.push_back(candidate4);
  }

  bool CompareSessionDescription(const SessionDescription* desc1,
                                 const SessionDescription* desc2) {
    const ContentInfo* audio_1 = desc1->GetContentByName("audio");
    const AudioContentDescription* audio_desc_1 =
        static_cast<const AudioContentDescription*>(audio_1->description);
    const ContentInfo* video_1 = desc1->GetContentByName("video");
    const VideoContentDescription* video_desc_1 =
        static_cast<const VideoContentDescription*>(video_1->description);

    const ContentInfo* audio_2 = desc2->GetContentByName("audio");
    const AudioContentDescription* audio_desc_2 =
        static_cast<const AudioContentDescription*>(audio_2->description);
    const ContentInfo* video_2 = desc2->GetContentByName("video");
    const VideoContentDescription* video_desc_2 =
        static_cast<const VideoContentDescription*>(video_2->description);

    // Check that all streams are equal. We only check that the number of
    // codecs are the same and leave it for other unit tests to test
    // parsing / serialization of the session description.
    return audio_desc_1->codecs().size() == audio_desc_2->codecs().size() &&
        audio_desc_1->streams() == audio_desc_2->streams() &&
        video_desc_1->codecs().size() == video_desc_2->codecs().size() &&
        video_desc_1->streams() == video_desc_2->streams();
  }

  bool CompareCandidates(const Candidates& c1, const Candidates& c2) {
    if (c1.size() != c2.size())
      return false;

    Candidates::const_iterator it1 = c1.begin();
    for (; it1 != c1.end(); ++it1) {
      // It is ok if the order in the vector have changed.
      Candidates::const_iterator it2 = c2.begin();
      for (; it2 != c2.end(); ++it2) {
        if (it1->IsEquivalent(*it2)) {
          break;
        }
      }
      if (it2 == c2.end())
        return false;
    }
    return true;
  }

 protected:
  cricket::SessionDescription desc1_;
  cricket::SessionDescription desc2_;
  cricket::Candidates candidates_;
};

TEST_F(RoapSessionTest, OfferAnswer) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  std::string offer_message = roap_session1.CreateOffer(&desc1_, candidates_);

  // Check that it is valid to send to another peer.
  EXPECT_EQ(RoapSession::kOffer, roap_session2.Parse(offer_message));
  talk_base::scoped_ptr<const cricket::SessionDescription> received_offer(
      roap_session2.ReleaseRemoteDescription());

  ASSERT_TRUE(received_offer.get() != NULL);
  EXPECT_TRUE(CompareSessionDescription(&desc1_, received_offer.get()));
  EXPECT_TRUE(CompareCandidates(candidates_, roap_session2.RemoteCandidates()));

  std::string answer_message = roap_session2.CreateAnswer(&desc2_, candidates_);

  EXPECT_EQ(RoapSession::kAnswer, roap_session1.Parse(answer_message));
  talk_base::scoped_ptr<const cricket::SessionDescription> received_answer(
      roap_session1.ReleaseRemoteDescription());

  EXPECT_TRUE(CompareSessionDescription(&desc2_, received_answer.get()));
  EXPECT_FALSE(CompareSessionDescription(received_offer.get(),
                                         received_answer.get()));
  EXPECT_TRUE(CompareCandidates(candidates_, roap_session1.RemoteCandidates()));
}

TEST_F(RoapSessionTest, InvalidInitialization) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  std::string offer_message1 = roap_session1.CreateOffer(&desc1_, candidates_);
  std::string offer_message2 = roap_session2.CreateOffer(&desc2_, candidates_);

  // It is an error to receive an initial offer if you have sent an
  // initial offer.
  EXPECT_EQ(RoapSession::kInvalidMessage,
            roap_session1.Parse(offer_message2));

  EXPECT_EQ(RoapSession::kInvalidMessage,
            roap_session2.Parse(offer_message1));
}

TEST_F(RoapSessionTest, Glare) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  // Setup. Need to exchange an offer and an answer in order to test for glare.
  std::string offer_message1 = roap_session1.CreateOffer(&desc1_, candidates_);

  roap_session2.Parse(offer_message1);
  talk_base::scoped_ptr<const SessionDescription> received_offer(
      roap_session2.ReleaseRemoteDescription());
  std::string answer_message2 = roap_session2.CreateAnswer(&desc2_,
                                                           candidates_);
  roap_session1.Parse(answer_message2);

  // Ok- we should now have all we need. Create a glare condition by
  // updating the offer simultaneously.
  offer_message1 = roap_session1.CreateOffer(&desc2_, candidates_);
  std::string offer_message2 = roap_session2.CreateOffer(&desc1_, candidates_);

  EXPECT_TRUE(
      (RoapSession::kOffer == roap_session1.Parse(offer_message2) &&
      RoapSession::kConflict == roap_session2.Parse(offer_message1)) ||
      (RoapSession::kOffer == roap_session2.Parse(offer_message1) &&
      RoapSession::kConflict == roap_session1.Parse(offer_message2)));
}

// Test Glare resolution by setting different TieBreakers.
TEST_F(RoapSessionTest, TieBreaker) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  // Offer 1
  std::string offer_message1 = roap_session1.CreateOffer(&desc1_, candidates_);

  EXPECT_EQ(RoapSession::kOffer, roap_session2.Parse(offer_message1));
  talk_base::scoped_ptr<const SessionDescription> received_offer(
      roap_session2.ReleaseRemoteDescription());
  std::string answer_message2 = roap_session2.CreateAnswer(&desc2_,
                                                           candidates_);

  EXPECT_EQ(RoapSession::kAnswer, roap_session1.Parse(answer_message2));

  // Ok- we should now have all we need. Create a double conflict condition.
  offer_message1 = roap_session1.CreateOffer(&desc2_, candidates_);
  RoapMessageBase message_base;
  EXPECT_TRUE(message_base.Parse(offer_message1));
  RoapOffer message_offer(message_base);
  EXPECT_TRUE(message_offer.Parse());
  RoapOffer double_conflict_offer(message_offer.answer_session_id(),
                                  message_offer.offer_session_id(),
                                  "",
                                  message_offer.seq(),
                                  message_offer.tie_breaker(),
                                  &desc1_,
                                  candidates_);
  EXPECT_EQ(RoapSession::kDoubleConflict,
            roap_session1.Parse(double_conflict_offer.Serialize()));

  RoapOffer losing_offer(message_offer.answer_session_id(),
                         message_offer.offer_session_id(),
                         "",
                         message_offer.seq(),
                         0,
                         &desc1_,
                         candidates_);
  EXPECT_EQ(RoapSession::kConflict,
            roap_session1.Parse(losing_offer.Serialize()));

  RoapOffer winning_offer(message_offer.answer_session_id(),
                          message_offer.offer_session_id(),
                          "",
                          message_offer.seq(),
                          0xFFFFFFFF,
                          &desc1_,
                          candidates_);
  EXPECT_EQ(RoapSession::kOffer,
            roap_session1.Parse(winning_offer.Serialize()));
}

TEST_F(RoapSessionTest, ShutDownOk) {
  RoapSession roap_session1;
  std::string shutdown = roap_session1.CreateShutDown();

  RoapSession roap_session2;
  EXPECT_EQ(RoapSession::kShutDown, roap_session2.Parse(shutdown));

  std::string ok_message = roap_session2.CreateOk();
  EXPECT_EQ(RoapSession::kOk, roap_session1.Parse(ok_message));
}

TEST_F(RoapSessionTest, ErrorMessageCreation) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  std::string message = roap_session1.CreateErrorMessage(webrtc::kNoMatch);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kNoMatch, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kTimeout);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kTimeout, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kRefused);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kRefused, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kConflict);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kConflict, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kDoubleConflict);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kDoubleConflict, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kFailed);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kFailed, roap_session2.RemoteError());
}
