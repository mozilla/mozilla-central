/*
 * libjingle
 * Copyright 2012, Google Inc.
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

#include "talk/app/webrtc/jsepicecandidate.h"
#include "talk/app/webrtc/jsepsessiondescription.h"
#include "talk/base/gunit.h"
#include "talk/base/scoped_ptr.h"
#include "talk/p2p/base/candidate.h"
#include "talk/p2p/base/constants.h"
#include "talk/p2p/base/sessiondescription.h"
#include "talk/session/phone/mediasession.h"

using webrtc::IceCandidateColletion;
using webrtc::IceCandidateInterface;
using webrtc::JsepIceCandidate;
using webrtc::JsepSessionDescription;
using webrtc::SessionDescriptionInterface;
using talk_base::scoped_ptr;

// This creates a session description with both audio and video media contents.
// In SDP this is described by two m lines, one audio and one video.
static cricket::SessionDescription* CreateCricketSessionDescription() {
  cricket::SessionDescription* desc(new cricket::SessionDescription());
  // AudioContentDescription
  scoped_ptr<cricket::AudioContentDescription> audio(
      new cricket::AudioContentDescription());

  // VideoContentDescription
  scoped_ptr<cricket::VideoContentDescription> video(
      new cricket::VideoContentDescription());

  audio->AddCodec(cricket::AudioCodec(103, "ISAC", 16000, 0, 0, 0));
  desc->AddContent(cricket::CN_AUDIO, cricket::NS_JINGLE_RTP,
                   audio.release());

  video->AddCodec(cricket::VideoCodec(120, "VP8", 640, 480, 30, 0));
  desc->AddContent(cricket::CN_VIDEO, cricket::NS_JINGLE_RTP,
                   video.release());
  return desc;
}

class JsepSessionDescriptionTest : public testing::Test {
 protected:
  virtual void SetUp() {
    int port = 1234;
    talk_base::SocketAddress address("127.0.0.1", port++);
    cricket::Candidate candidate("rtp", "udp", address, 1, "user_rtp",
                                 "password_rtp", "local", "eth0", 0);
    candidate_ = candidate;

    jsep_desc_.reset(new JsepSessionDescription());
    jsep_desc_->SetDescription(CreateCricketSessionDescription());
  }

  std::string Serialize(const SessionDescriptionInterface* desc) {
    std::string sdp;
    EXPECT_TRUE(desc->ToString(&sdp));
    EXPECT_FALSE(sdp.empty());
    return sdp;
  }

  SessionDescriptionInterface* DeSerialize(const std::string& sdp) {
    JsepSessionDescription* desc(new JsepSessionDescription());
    EXPECT_TRUE(desc->Initialize(sdp));
    return desc;
  }

  cricket::Candidate candidate_;
  talk_base::scoped_ptr<JsepSessionDescription> jsep_desc_;
};

// Test that number_of_mediasections() returns the number of media contents in
// a session description.
TEST_F(JsepSessionDescriptionTest, CheckSessionDescription) {
  EXPECT_EQ(2u, jsep_desc_->number_of_mediasections());
}

// Test that we can add a candidate to a session description.
TEST_F(JsepSessionDescriptionTest, AddCandidate) {
  JsepIceCandidate jsep_candidate("0", candidate_);
  EXPECT_TRUE(jsep_desc_->AddCandidate(&jsep_candidate));
  const IceCandidateColletion* ice_candidates = jsep_desc_->candidates(0);
  ASSERT_TRUE(ice_candidates != NULL);
  EXPECT_EQ(1u, ice_candidates->count());
  const IceCandidateInterface* ice_candidate = ice_candidates->at(0);
  ASSERT_TRUE(ice_candidate != NULL);
  EXPECT_TRUE(ice_candidate->candidate().IsEquivalent(candidate_));

  EXPECT_EQ(0u, jsep_desc_->candidates(1)->count());
}

// Test that we can not add a candidate if there is no corresponding media
// content in the session description.
TEST_F(JsepSessionDescriptionTest, AddBadCandidate) {
  JsepIceCandidate bad_candidate1("55", candidate_);
  EXPECT_FALSE(jsep_desc_->AddCandidate(&bad_candidate1));

  JsepIceCandidate bad_candidate2("some weird label", candidate_);
  EXPECT_FALSE(jsep_desc_->AddCandidate(&bad_candidate2));
}

// Test that we can serialize a JsepSessionDescription and deserialize it again.
TEST_F(JsepSessionDescriptionTest, SerializeDeserialize) {
  std::string sdp = Serialize(jsep_desc_.get());

  scoped_ptr<SessionDescriptionInterface> parsed_jsep_desc(DeSerialize(sdp));
  EXPECT_EQ(2u, parsed_jsep_desc->number_of_mediasections());

  std::string parsed_sdp = Serialize(parsed_jsep_desc.get());
  EXPECT_EQ(sdp, parsed_sdp);
}

// Tests that we can serialize and deserialize a JsepSesssionDescription
// with candidates.
TEST_F(JsepSessionDescriptionTest, SerializeDeserializeWithCandidates) {
  std::string sdp = Serialize(jsep_desc_.get());

  // Add a candidate and check that the serialized result is different.
  JsepIceCandidate jsep_candidate("0", candidate_);
  EXPECT_TRUE(jsep_desc_->AddCandidate(&jsep_candidate));
  std::string sdp_with_candidate = Serialize(jsep_desc_.get());
  EXPECT_NE(sdp, sdp_with_candidate);

  scoped_ptr<SessionDescriptionInterface> parsed_jsep_desc(
      DeSerialize(sdp_with_candidate));
  std::string parsed_sdp_with_candidate = Serialize(parsed_jsep_desc.get());

  EXPECT_EQ(sdp_with_candidate, parsed_sdp_with_candidate);
}

