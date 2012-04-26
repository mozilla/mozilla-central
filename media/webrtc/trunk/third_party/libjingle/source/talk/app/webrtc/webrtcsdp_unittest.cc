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

#include "talk/app/webrtc/jsepsessiondescription.h"
#include "talk/app/webrtc/webrtcsdp.h"
#include "talk/base/gunit.h"
#include "talk/base/logging.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/stringencode.h"
#include "talk/base/stringutils.h"
#include "talk/p2p/base/constants.h"
#include "talk/session/phone/mediasession.h"

typedef std::vector<cricket::Candidate> Candidates;
using cricket::AudioCodec;
using cricket::AudioContentDescription;
using cricket::ContentInfo;
using cricket::CryptoParams;
using cricket::ContentGroup;
using cricket::SessionDescription;
using cricket::StreamParams;
using cricket::VideoCodec;
using cricket::VideoContentDescription;
using webrtc::IceCandidateColletion;
using webrtc::IceCandidateInterface;
using webrtc::JsepIceCandidate;
using webrtc::JsepSessionDescription;
using webrtc::SessionDescriptionInterface;

// Reference sdp string
static const char kSdpFullString[] =
    "v=0\r\n"
    "o=- 0 0 IN IP4 127.0.0.1\r\n"
    "s=\r\n"
    "t=0 0\r\n"
    "m=audio 2345 RTP/AVPF 103 104\r\n"
    "c=IN IP4 74.125.127.126\r\n"
    "a=rtcp:2346 IN IP4 74.125.127.126\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1234 typ host name rtp_audio "
    "network_name eth0 username user_rtp password password_rtp "
    "generation 0\r\n"
    "a=candidate:1 2 udp 1 127.0.0.1 1235 typ host name rtcp_audio "
    "network_name eth0 username user_rtcp password password_rtcp "
    "generation 0\r\n"
    "a=candidate:1 1 udp 1 74.125.127.126 2345 typ srflx name rtp_audio "
    "network_name eth0 username user_rtp_stun password password_rtp_stun "
    "generation 0\r\n"
    "a=candidate:1 2 udp 1 74.125.127.126 2346 typ srflx name rtcp_audio "
    "network_name eth0 username user_rtcp_stun password password_rtcp_stun "
    "generation 0\r\n"
    "a=mid:audio_content_name\r\n"
    "a=rtcp-mux\r\n"
    "a=crypto:1 AES_CM_128_HMAC_SHA1_32 "
    "inline:NzB4d1BINUAvLEw6UzF3WSJ+PSdFcGdUJShpX1Zj|2^20|1:32 \r\n"
    "a=rtpmap:103 ISAC/16000\r\n"
    "a=rtpmap:104 ISAC/32000\r\n"
    "a=ssrc:1 cname:stream_1_cname\r\n"
    "a=ssrc:1 mslabel:local_stream_1\r\n"
    "a=ssrc:1 label:local_audio_1\r\n"
    "a=ssrc:4 cname:stream_2_cname\r\n"
    "a=ssrc:4 mslabel:local_stream_2\r\n"
    "a=ssrc:4 label:local_audio_2\r\n"
    "m=video 3457 RTP/AVPF 120\r\n"
    "c=IN IP4 74.125.224.39\r\n"
    "a=rtcp:3456 IN IP4 74.125.224.39\r\n"
    "a=candidate:1 2 udp 1 127.0.0.1 1236 typ host name rtcp_video "
    "network_name eth0 username user_video_rtcp password password_video_rtcp "
    "generation 0\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1237 typ host name rtp_video "
    "network_name eth0 username user_video_rtp password password_video_rtp "
    "generation 0\r\n"
    "a=candidate:1 2 udp 1 74.125.224.39 3456 typ relay name rtcp_video "
    "network_name eth0 username user_video_rtcp_relay password "
    "password_video_rtcp generation 0\r\n"
    "a=candidate:1 1 udp 1 74.125.224.39 3457 typ relay name rtp_video "
    "network_name eth0 username user_video_rtp_relay password "
    "password_video_rtp generation 0\r\n"
    "a=mid:video_content_name\r\n"
    "a=crypto:1 AES_CM_128_HMAC_SHA1_80 "
    "inline:d0RmdmcmVCspeEc3QGZiNWpVLFJhQX1cfHAwJSoj|2^20|1:32 \r\n"
    "a=rtpmap:120 VP8/90000\r\n"
    "a=ssrc:2 cname:stream_1_cname\r\n"
    "a=ssrc:2 mslabel:local_stream_1\r\n"
    "a=ssrc:2 label:local_video_1\r\n"
    "a=ssrc:3 cname:stream_1_cname\r\n"
    "a=ssrc:3 mslabel:local_stream_1\r\n"
    "a=ssrc:3 label:local_video_2\r\n"
    "a=ssrc:5 cname:stream_2_cname\r\n"
    "a=ssrc:5 mslabel:local_stream_2\r\n"
    "a=ssrc:5 label:local_video_3\r\n";

// SDP reference string without the candidates.
static const char kSdpString[] =
    "v=0\r\n"
    "o=- 0 0 IN IP4 127.0.0.1\r\n"
    "s=\r\n"
    "t=0 0\r\n"
    "m=audio 1 RTP/AVPF 103 104\r\n"
    "a=mid:audio_content_name\r\n"
    "a=rtcp-mux\r\n"
    "a=crypto:1 AES_CM_128_HMAC_SHA1_32 "
    "inline:NzB4d1BINUAvLEw6UzF3WSJ+PSdFcGdUJShpX1Zj|2^20|1:32 \r\n"
    "a=rtpmap:103 ISAC/16000\r\n"
    "a=rtpmap:104 ISAC/32000\r\n"
    "a=ssrc:1 cname:stream_1_cname\r\n"
    "a=ssrc:1 mslabel:local_stream_1\r\n"
    "a=ssrc:1 label:local_audio_1\r\n"
    "a=ssrc:4 cname:stream_2_cname\r\n"
    "a=ssrc:4 mslabel:local_stream_2\r\n"
    "a=ssrc:4 label:local_audio_2\r\n"
    "m=video 1 RTP/AVPF 120\r\n"
    "a=mid:video_content_name\r\n"
    "a=crypto:1 AES_CM_128_HMAC_SHA1_80 "
    "inline:d0RmdmcmVCspeEc3QGZiNWpVLFJhQX1cfHAwJSoj|2^20|1:32 \r\n"
    "a=rtpmap:120 VP8/90000\r\n"
    "a=ssrc:2 cname:stream_1_cname\r\n"
    "a=ssrc:2 mslabel:local_stream_1\r\n"
    "a=ssrc:2 label:local_video_1\r\n"
    "a=ssrc:3 cname:stream_1_cname\r\n"
    "a=ssrc:3 mslabel:local_stream_1\r\n"
    "a=ssrc:3 label:local_video_2\r\n"
    "a=ssrc:5 cname:stream_2_cname\r\n"
    "a=ssrc:5 mslabel:local_stream_2\r\n"
    "a=ssrc:5 label:local_video_3\r\n";

// One candidate reference string.
static const char kSdpOneCandidate[] =
    "a=candidate:1 1 udp 1 127.0.0.1 1234 typ host name rtp_audio network_name"
    " eth0 username user_rtp password password_rtp generation 0\r\n";

// Candidates reference string.
static const char kSdpCandidates[] =
    "a=candidate:1 1 udp 1 127.0.0.1 1234 typ host name rtp_audio network_name"
    " eth0 username user_rtp password password_rtp generation 0\r\n"
    "a=candidate:1 2 udp 1 127.0.0.1 1235 typ host name rtcp_audio "
    "network_name eth0 username user_rtcp password password_rtcp "
    "generation 0\r\n"
    "a=candidate:1 1 udp 1 74.125.127.126 2345 typ srflx name rtp_audio "
    "network_name eth0 username user_rtp_stun password password_rtp_stun "
    "generation 0\r\n"
    "a=candidate:1 2 udp 1 74.125.127.126 2346 typ srflx name rtcp_audio "
    "network_name eth0 username user_rtcp_stun password password_rtcp_stun "
    "generation 0\r\n"
    "a=candidate:1 2 udp 1 127.0.0.1 1236 typ host name rtcp_video "
    "network_name eth0 username user_video_rtcp password password_video_rtcp "
    "generation 0\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1237 typ host name rtp_video "
    "network_name eth0 username user_video_rtp password password_video_rtp "
    "generation 0\r\n"
    "a=candidate:1 2 udp 1 74.125.224.39 3456 typ relay name rtcp_video "
    "network_name eth0 username user_video_rtcp_relay password "
    "password_video_rtcp generation 0\r\n"
    "a=candidate:1 1 udp 1 74.125.224.39 3457 typ relay name rtp_video "
    "network_name eth0 username user_video_rtp_relay password "
    "password_video_rtp generation 0\r\n";

// Content name
static const char kAudioContentName[] = "audio_content_name";
static const char kVideoContentName[] = "video_content_name";

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

// Helper functions

// Add some extra |newlines| to the |message| after |line|.
void InjectAfter(const std::string& line,
                 const std::string& newlines,
                 std::string* message) {
  const std::string tmp = line + newlines;
  talk_base::replace_substrs(line.c_str(), line.length(),
                             tmp.c_str(), tmp.length(), message);
}

// WebRtcSdpTest

class WebRtcSdpTest : public testing::Test {
 public:
  WebRtcSdpTest() {
    // AudioContentDescription
    talk_base::scoped_ptr<AudioContentDescription> audio(
        new AudioContentDescription());
    audio->set_rtcp_mux(true);
    StreamParams audio_stream1;
    audio_stream1.name = kAudioTrackLabel1;
    audio_stream1.cname = kStream1Cname;
    audio_stream1.sync_label = kStreamLabel1;
    audio_stream1.ssrcs.push_back(kAudioTrack1Ssrc);
    audio->AddStream(audio_stream1);
    StreamParams audio_stream2;
    audio_stream2.name = kAudioTrackLabel2;
    audio_stream2.cname = kStream2Cname;
    audio_stream2.sync_label = kStreamLabel2;
    audio_stream2.ssrcs.push_back(kAudioTrack2Ssrc);
    audio->AddStream(audio_stream2);
    audio->AddCrypto(CryptoParams(1, "AES_CM_128_HMAC_SHA1_32",
        "inline:NzB4d1BINUAvLEw6UzF3WSJ+PSdFcGdUJShpX1Zj|2^20|1:32", ""));
    audio->AddCodec(AudioCodec(103, "ISAC", 16000, 0, 0, 0));
    audio->AddCodec(AudioCodec(104, "ISAC", 32000, 0, 0, 0));
    desc_.AddContent(kAudioContentName, cricket::NS_JINGLE_RTP,
                     audio.release());

    // VideoContentDescription
    talk_base::scoped_ptr<VideoContentDescription> video(
        new VideoContentDescription());
    StreamParams video_stream1;
    video_stream1.name = kVideoTrackLabel1;
    video_stream1.cname = kStream1Cname;
    video_stream1.sync_label = kStreamLabel1;
    video_stream1.ssrcs.push_back(kVideoTrack1Ssrc);
    video->AddStream(video_stream1);
    StreamParams video_stream2;
    video_stream2.name = kVideoTrackLabel2;
    video_stream2.cname = kStream1Cname;
    video_stream2.sync_label = kStreamLabel1;
    video_stream2.ssrcs.push_back(kVideoTrack2Ssrc);
    video->AddStream(video_stream2);
    StreamParams video_stream3;
    video_stream3.name = kVideoTrackLabel3;
    video_stream3.cname = kStream2Cname;
    video_stream3.sync_label = kStreamLabel2;
    video_stream3.ssrcs.push_back(kVideoTrack3Ssrc);
    video->AddStream(video_stream3);
    video->AddCrypto(CryptoParams(1, "AES_CM_128_HMAC_SHA1_80",
        "inline:d0RmdmcmVCspeEc3QGZiNWpVLFJhQX1cfHAwJSoj|2^20|1:32", ""));
    video->AddCodec(VideoCodec(120, "VP8", 640, 480, 30, 0));
    desc_.AddContent(kVideoContentName, cricket::NS_JINGLE_RTP,
                     video.release());

    // host
    int port = 1234;
    talk_base::SocketAddress address("127.0.0.1", port++);
    cricket::Candidate candidate1("rtp_audio", "udp", address, 1,
        "user_rtp", "password_rtp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate2("rtcp_audio", "udp", address, 1,
        "user_rtcp", "password_rtcp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate3("rtcp_video", "udp", address, 1,
        "user_video_rtcp", "password_video_rtcp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate4("rtp_video", "udp", address, 1,
        "user_video_rtp", "password_video_rtp", "local", "eth0", 0);

    // stun
    int port_stun = 2345;
    talk_base::SocketAddress address_stun("74.125.127.126", port_stun++);
    cricket::Candidate candidate5("rtp_audio", "udp", address_stun, 1,
        "user_rtp_stun", "password_rtp_stun", "stun", "eth0", 0);
    address_stun.SetPort(port_stun++);
    cricket::Candidate candidate6("rtcp_audio", "udp", address_stun, 1,
        "user_rtcp_stun", "password_rtcp_stun", "stun", "eth0", 0);

    // relay
    int port_relay = 3456;
    talk_base::SocketAddress address_relay("74.125.224.39", port_relay++);
    cricket::Candidate candidate7("rtcp_video", "udp", address_relay, 1,
        "user_video_rtcp_relay", "password_video_rtcp", "relay", "eth0", 0);
    address_relay.SetPort(port_relay++);
    cricket::Candidate candidate8("rtp_video", "udp", address_relay, 1,
        "user_video_rtp_relay", "password_video_rtp", "relay", "eth0", 0);

    // voice
    candidates_.push_back(candidate1);
    candidates_.push_back(candidate2);
    candidates_.push_back(candidate5);
    candidates_.push_back(candidate6);

    // video
    candidates_.push_back(candidate3);
    candidates_.push_back(candidate4);
    candidates_.push_back(candidate7);
    candidates_.push_back(candidate8);

    jcandidate_.reset(new JsepIceCandidate("1", candidate1));

    // Set up JsepSessionDescription.
    jdesc_.SetDescription(desc_.Copy());
    int mline_index = 0;
    for (size_t i = 0; i< candidates_.size(); ++i) {
      // In this test, the audio m line index will be 0, and the video m line
      // will be 1.
      mline_index = (candidates_.at(i).name().find("video") !=
          std::string::npos) ? 1 : 0;
      JsepIceCandidate jice(talk_base::ToString<int>(mline_index),
                            candidates_.at(i));
      jdesc_.AddCandidate(&jice);
    }
  }

  bool CompareSessionDescription(const SessionDescription& desc1,
                                 const SessionDescription& desc2) {
    const ContentInfo* ac1 = GetFirstAudioContent(&desc1);
    const AudioContentDescription* acd1 =
        static_cast<const AudioContentDescription*>(ac1->description);
    const ContentInfo* vc1 = GetFirstVideoContent(&desc1);
    const VideoContentDescription* vcd1 =
        static_cast<const VideoContentDescription*>(vc1->description);

    const ContentInfo* ac2 = GetFirstAudioContent(&desc2);
    const AudioContentDescription* acd2 =
        static_cast<const AudioContentDescription*>(ac2->description);
    const ContentInfo* vc2 = GetFirstVideoContent(&desc2);
    const VideoContentDescription* vcd2 =
        static_cast<const VideoContentDescription*>(vc2->description);

    // content name
    EXPECT_EQ(ac1->name, ac2->name);
    EXPECT_EQ(vc1->name, vc2->name);

    // type
    EXPECT_EQ(ac1->type, ac2->type);
    EXPECT_EQ(vc1->type, vc2->type);

    // rtcp_mux
    EXPECT_EQ(acd1->rtcp_mux(), acd2->rtcp_mux());
    EXPECT_EQ(vcd1->rtcp_mux(), vcd2->rtcp_mux());

    // cryptos
    EXPECT_EQ(acd1->cryptos().size(), acd2->cryptos().size());
    EXPECT_EQ(vcd1->cryptos().size(), vcd2->cryptos().size());
    if (acd1->cryptos().size() != acd2->cryptos().size() ||
        vcd1->cryptos().size() != vcd2->cryptos().size()) {
      return false;
    }
    for (size_t i = 0; i< acd1->cryptos().size(); ++i) {
      const CryptoParams c1 = acd1->cryptos().at(i);
      const CryptoParams c2 = acd2->cryptos().at(i);
      EXPECT_TRUE(c1.Matches(c2));
    }
    for (size_t i = 0; i< vcd1->cryptos().size(); ++i) {
      const CryptoParams c1 = vcd1->cryptos().at(i);
      const CryptoParams c2 = vcd2->cryptos().at(i);
      EXPECT_TRUE(c1.Matches(c2));
    }

    // codecs
    EXPECT_EQ(acd1->codecs().size(), acd2->codecs().size());
    if (acd1->codecs().size() != acd2->codecs().size())
      return false;
    EXPECT_EQ(vcd1->codecs().size(), vcd2->codecs().size());
    if (vcd1->codecs().size() != vcd2->codecs().size())
      return false;
    for (size_t i = 0; i< acd1->codecs().size(); ++i) {
      const AudioCodec c1 = acd1->codecs().at(i);
      const AudioCodec c2 = acd2->codecs().at(i);
      EXPECT_TRUE(c1.Matches(c2));
    }
    for (size_t i = 0; i< vcd1->codecs().size(); ++i) {
      const VideoCodec c1 = vcd1->codecs().at(i);
      const VideoCodec c2 = vcd2->codecs().at(i);
      EXPECT_TRUE(c1.Matches(c2));
      EXPECT_EQ(c1.id, c2.id);
      EXPECT_EQ(c1.width, c2.width);
      EXPECT_EQ(c1.height, c2.height);
      EXPECT_EQ(c1.framerate, c2.framerate);
    }

    // streams
    EXPECT_EQ(acd1->streams(), acd2->streams());
    EXPECT_EQ(vcd1->streams(), vcd2->streams());

    // group
    const cricket::ContentGroups groups1 = desc1.groups();
    const cricket::ContentGroups groups2 = desc2.groups();
    EXPECT_EQ(groups1.size(), groups1.size());
    if (groups1.size() != groups2.size()) {
      return false;
    }
    for (size_t i = 0; i < groups1.size(); ++i) {
      const cricket::ContentGroup group1 = groups1.at(i);
      const cricket::ContentGroup group2 = groups2.at(i);
      EXPECT_EQ(group1.semantics(), group2.semantics());
      const std::set<std::string> content1 = group1.content_types();
      const std::set<std::string> content2 = group2.content_types();
      EXPECT_EQ(content1.size(), content2.size());
      if (content1.size() != content2.size()) {
        return false;
      }
      std::set<std::string>::const_iterator iter1 = content1.begin();
      std::set<std::string>::const_iterator iter2 = content2.begin();
      while (iter1 != content1.end()) {
        EXPECT_EQ(*iter1++, *iter2++);
      }
    }

    return true;
  }

  bool CompareCandidates(const Candidates& cs1, const Candidates& cs2) {
    EXPECT_EQ(cs1.size(), cs2.size());
    if (cs1.size() != cs2.size())
      return false;
    for (size_t i = 0; i< cs1.size(); ++i) {
      const cricket::Candidate c1 = cs1.at(i);
      const cricket::Candidate c2 = cs2.at(i);
      EXPECT_TRUE(c1.IsEquivalent(c2));
    }
    return true;
  }

  bool CompareSessionDescriptionInterface(
      const SessionDescriptionInterface& desci1,
      const SessionDescriptionInterface& desci2) {
    EXPECT_TRUE(CompareSessionDescription(*desci1.description(),
                                          *desci2.description()));
    if (desci1.number_of_mediasections() != desci2.number_of_mediasections())
      return false;
    for (size_t i = 0; i < desci1.number_of_mediasections(); ++i) {
      const IceCandidateColletion* cc1 = desci1.candidates(i);
      const IceCandidateColletion* cc2 = desci2.candidates(i);
      if (cc1->count() != cc2->count())
        return false;
      for (size_t j = 0; j < cc1->count(); ++j) {
        const IceCandidateInterface* c1 = cc1->at(j);
        const IceCandidateInterface* c2 = cc2->at(j);
        EXPECT_EQ(c1->label(), c2->label());
        EXPECT_TRUE(c1->candidate().IsEquivalent(c2->candidate()));
      }
    }
    return true;
  }

  bool ReplaceAndTryToParse(const char* search, const char* replace) {
    JsepSessionDescription desc;
    std::string sdp = kSdpFullString;
    talk_base::replace_substrs(search, strlen(search), replace,
        strlen(replace), &sdp);
    return webrtc::SdpDeserialize(sdp, &desc);
  }

 protected:
  SessionDescription desc_;
  Candidates candidates_;
  talk_base::scoped_ptr<IceCandidateInterface> jcandidate_;
  JsepSessionDescription jdesc_;
};

TEST_F(WebRtcSdpTest, SerializeSessionDescriptionInterface) {
  // JsepSessionDescription with desc and candidates.
  std::string message = webrtc::SdpSerialize(jdesc_);
  EXPECT_EQ(std::string(kSdpFullString), message);
}

TEST_F(WebRtcSdpTest, SerializeSessionDescriptionInterfaceEmpty) {
  JsepSessionDescription jdesc_empty;
  EXPECT_EQ("", webrtc::SdpSerialize(jdesc_empty));
}

TEST_F(WebRtcSdpTest, SerializeSessionDescriptionInterfaceWithoutCandidates) {
  // JsepSessionDescription with desc but without candidates.
  JsepSessionDescription jdesc_no_candidates;
  jdesc_no_candidates.SetDescription(desc_.Copy());
  std::string message = webrtc::SdpSerialize(jdesc_no_candidates);
  EXPECT_EQ(std::string(kSdpString), message);
}


TEST_F(WebRtcSdpTest, SerializeSessionDescriptionInterfaceWithBundle) {
  ContentGroup group(cricket::GROUP_TYPE_BUNDLE);
  group.AddContentName(kAudioContentName);
  group.AddContentName(kVideoContentName);
  desc_.AddGroup(group);
  jdesc_.SetDescription(desc_.Copy());
  std::string message = webrtc::SdpSerialize(jdesc_);
  std::string sdp_with_bundle = kSdpFullString;
  InjectAfter("t=0 0\r\n",
              "a=group:BUNDLE audio_content_name video_content_name\r\n",
              &sdp_with_bundle);
  EXPECT_EQ(sdp_with_bundle, message);
}

TEST_F(WebRtcSdpTest, SerializeCandidates) {
  std::string message = webrtc::SdpSerializeCandidate(*jcandidate_.get());
  EXPECT_EQ(std::string(kSdpOneCandidate), message);
}

TEST_F(WebRtcSdpTest, DeserializeSessionDescriptionInterface) {
  JsepSessionDescription jdesc;
  // Deserialize
  EXPECT_TRUE(webrtc::SdpDeserialize(kSdpFullString, &jdesc));
  // Verify
  EXPECT_TRUE(CompareSessionDescriptionInterface(jdesc_, jdesc));
}

TEST_F(WebRtcSdpTest, DeserializeSessionDescriptionInterfaceWithBundle) {
  JsepSessionDescription jdesc_with_bundle;
  std::string sdp_with_bundle = kSdpFullString;
  InjectAfter("t=0 0\r\n",
              "a=group:BUNDLE audio_content_name video_content_name\r\n",
              &sdp_with_bundle);
  EXPECT_TRUE(webrtc::SdpDeserialize(sdp_with_bundle, &jdesc_with_bundle));
  ContentGroup group(cricket::GROUP_TYPE_BUNDLE);
  group.AddContentName(kAudioContentName);
  group.AddContentName(kVideoContentName);
  desc_.AddGroup(group);
  jdesc_.SetDescription(desc_.Copy());
  EXPECT_TRUE(CompareSessionDescriptionInterface(jdesc_, jdesc_with_bundle));
}

TEST_F(WebRtcSdpTest, SdpDeserializeCandidate) {
  const std::string kDummyLabel = "dummy_label";
  JsepIceCandidate jcandidate(kDummyLabel);
  EXPECT_TRUE(SdpDeserializeCandidate(kSdpOneCandidate, &jcandidate));
  EXPECT_EQ(kDummyLabel, jcandidate.label());
  EXPECT_TRUE(jcandidate.candidate().IsEquivalent(jcandidate_->candidate()));
}

TEST_F(WebRtcSdpTest, DeserializeBrokenSdp) {
  const char kSdpDestroyer[] = "!@#$%^&";

  // Broken session description
  EXPECT_EQ(false, ReplaceAndTryToParse("v=", kSdpDestroyer));
  EXPECT_EQ(false, ReplaceAndTryToParse("o=", kSdpDestroyer));
  EXPECT_EQ(false, ReplaceAndTryToParse("s=", kSdpDestroyer));
  // Broken time description
  EXPECT_EQ(false, ReplaceAndTryToParse("t=", kSdpDestroyer));

  // No group line
  EXPECT_EQ(true, ReplaceAndTryToParse("a=group:BUNDLE audio video\r\n", ""));
  EXPECT_EQ(true, ReplaceAndTryToParse("a=mid:audio\r\n", ""));
  EXPECT_EQ(true, ReplaceAndTryToParse("a=mid:video\r\n", ""));

  // Broken media description
  EXPECT_EQ(true, ReplaceAndTryToParse("video 0 RTP/AVPF", kSdpDestroyer));
}
