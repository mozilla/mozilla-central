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

#include "talk/app/webrtc/webrtcsdp.h"
#include "talk/base/gunit.h"
#include "talk/base/logging.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/stringutils.h"
#include "talk/p2p/base/constants.h"
#include "talk/session/phone/mediasession.h"

typedef std::vector<cricket::Candidate> Candidates;
using cricket::AudioCodec;
using cricket::AudioContentDescription;
using cricket::ContentInfo;
using cricket::CryptoParams;
using cricket::SessionDescription;
using cricket::StreamParams;
using cricket::VideoCodec;
using cricket::VideoContentDescription;

// Reference sdp string
static const char kSdpFullString[] =
    "v=0\r\n"
    "o=- 0 0 IN IP4 127.0.0.1\r\n"
    "s=\r\n"
    "t=0 0\r\n"
    "a=group:BUNDLE audio video\r\n"
    "m=audio 0 RTP/AVPF 103 104\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1234 typ host name rtp network_name "
    "eth0 username user_rtp password password_rtp generation 0\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1235 typ host name rtcp network_name "
    "eth0 username user_rtcp password password_rtcp generation 0\r\n"
    "a=mid:audio\r\n"
    "a=rtcp-mux\r\n"
    "a=crypto:1 AES_CM_128_HMAC_SHA1_32 "
    "inline:NzB4d1BINUAvLEw6UzF3WSJ+PSdFcGdUJShpX1Zj|2^20|1:32 \r\n"
    "a=rtpmap:103 ISAC/16000\r\n"
    "a=rtpmap:104 ISAC/32000\r\n"
    "a=ssrc:1 cname:stream_1_cname mslabel:local_stream_1 "
    "label:local_audio_1\r\n"
    "a=ssrc:4 cname:stream_2_cname mslabel:local_stream_2 "
    "label:local_audio_2\r\n"
    "m=video 0 RTP/AVPF 120\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1236 typ host name video_rtcp "
    "network_name eth0 username user_video_rtcp password password_video_rtcp "
    "generation 0\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1237 typ host name video_rtp "
    "network_name eth0 username user_video_rtp password password_video_rtp "
    "generation 0\r\n"
    "a=mid:video\r\n"
    "a=crypto:1 AES_CM_128_HMAC_SHA1_80 "
    "inline:d0RmdmcmVCspeEc3QGZiNWpVLFJhQX1cfHAwJSoj|2^20|1:32 \r\n"
    "a=rtpmap:120 VP8/0\r\n"
    "a=ssrc:2 cname:stream_1_cname mslabel:local_stream_1 "
    "label:local_video_1\r\n"
    "a=ssrc:3 cname:stream_1_cname mslabel:local_stream_1 "
    "label:local_video_2\r\n"
    "a=ssrc:5 cname:stream_2_cname mslabel:local_stream_2 "
    "label:local_video_3\r\n";

// SDP reference string without the candidates.
static const char kSdpString[] =
    "v=0\r\n"
    "o=- 0 0 IN IP4 127.0.0.1\r\n"
    "s=\r\n"
    "t=0 0\r\n"
    "a=group:BUNDLE audio video\r\n"
    "m=audio 0 RTP/AVPF 103 104\r\n"
    "a=mid:audio\r\n"
    "a=rtcp-mux\r\n"
    "a=crypto:1 AES_CM_128_HMAC_SHA1_32 "
    "inline:NzB4d1BINUAvLEw6UzF3WSJ+PSdFcGdUJShpX1Zj|2^20|1:32 \r\n"
    "a=rtpmap:103 ISAC/16000\r\n"
    "a=rtpmap:104 ISAC/32000\r\n"
    "a=ssrc:1 cname:stream_1_cname mslabel:local_stream_1 "
    "label:local_audio_1\r\n"
    "a=ssrc:4 cname:stream_2_cname mslabel:local_stream_2 "
    "label:local_audio_2\r\n"
    "m=video 0 RTP/AVPF 120\r\n"
    "a=mid:video\r\n"
    "a=crypto:1 AES_CM_128_HMAC_SHA1_80 "
    "inline:d0RmdmcmVCspeEc3QGZiNWpVLFJhQX1cfHAwJSoj|2^20|1:32 \r\n"
    "a=rtpmap:120 VP8/0\r\n"
    "a=ssrc:2 cname:stream_1_cname mslabel:local_stream_1 "
    "label:local_video_1\r\n"
    "a=ssrc:3 cname:stream_1_cname mslabel:local_stream_1 "
    "label:local_video_2\r\n"
    "a=ssrc:5 cname:stream_2_cname mslabel:local_stream_2 "
    "label:local_video_3\r\n";

// Candidates reference string.
static const char kSdpCandidates[] =
    "a=candidate:1 1 udp 1 127.0.0.1 1234 typ host name rtp network_name "
    "eth0 username user_rtp password password_rtp generation 0\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1235 typ host name rtcp network_name "
    "eth0 username user_rtcp password password_rtcp generation 0\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1236 typ host name video_rtcp "
    "network_name eth0 username user_video_rtcp password password_video_rtcp "
    "generation 0\r\n"
    "a=candidate:1 1 udp 1 127.0.0.1 1237 typ host name video_rtp "
    "network_name eth0 username user_video_rtp password password_video_rtp "
    "generation 0\r\n";

static const char kSdpDestroyer[] = "!@#$%^&";

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
    desc_.AddContent(cricket::CN_AUDIO, cricket::NS_JINGLE_RTP,
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
    desc_.AddContent(cricket::CN_VIDEO, cricket::NS_JINGLE_RTP,
                     video.release());

    int port = 1234;
    talk_base::SocketAddress address("127.0.0.1", port++);
    cricket::Candidate candidate1("rtp", "udp", address, 1,
        "user_rtp", "password_rtp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate2("rtcp", "udp", address, 1,
        "user_rtcp", "password_rtcp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate3("video_rtcp", "udp", address, 1,
        "user_video_rtcp", "password_video_rtcp", "local", "eth0", 0);
    address.SetPort(port++);
    cricket::Candidate candidate4("video_rtp", "udp", address, 1,
        "user_video_rtp", "password_video_rtp", "local", "eth0", 0);

    candidates_.push_back(candidate1);
    candidates_.push_back(candidate2);
    candidates_.push_back(candidate3);
    candidates_.push_back(candidate4);
  }

  bool CompareSessionDescription(const SessionDescription& desc1,
                                 const SessionDescription& desc2) {
    const ContentInfo* ac1 = desc1.GetContentByName("audio");
    const AudioContentDescription* acd1 =
        static_cast<const AudioContentDescription*>(ac1->description);
    const ContentInfo* vc1 = desc1.GetContentByName("video");
    const VideoContentDescription* vcd1 =
        static_cast<const VideoContentDescription*>(vc1->description);

    const ContentInfo* ac2 = desc2.GetContentByName("audio");
    const AudioContentDescription* acd2 =
        static_cast<const AudioContentDescription*>(ac2->description);
    const ContentInfo* vc2 = desc2.GetContentByName("video");
    const VideoContentDescription* vcd2 =
        static_cast<const VideoContentDescription*>(vc2->description);

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
      EXPECT_EQ(c1.width, c2.width);
      EXPECT_EQ(c1.height, c2.height);
      EXPECT_EQ(c1.framerate, c2.framerate);
    }

    // streams
    EXPECT_EQ(acd1->streams(), acd2->streams());
    EXPECT_EQ(vcd1->streams(), vcd2->streams());

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

  bool ReplaceAndTryToParse(const char* search, const char* replace) {
    SessionDescription desc;
    std::vector<cricket::Candidate> candidates;
    std::string sdp = kSdpFullString;
    talk_base::replace_substrs(search, strlen(search), replace,
        strlen(replace), &sdp);
    return webrtc::SdpDeserialize(sdp, &desc, &candidates);
  }

 protected:
  SessionDescription desc_;
  Candidates candidates_;
};

TEST_F(WebRtcSdpTest, Serialize) {
  std::string message = webrtc::SdpSerialize(desc_, candidates_);
  LOG(LS_INFO) << "SDP: " << message;
  EXPECT_EQ(std::string(kSdpFullString), message);
}

TEST_F(WebRtcSdpTest, SerializeSessionDescription) {
  std::string message = webrtc::SdpSerializeSessionDescription(desc_);
  EXPECT_EQ(std::string(kSdpString), message);
}

TEST_F(WebRtcSdpTest, SerializeCandidates) {
  std::string message = webrtc::SdpSerializeCandidates(candidates_);
  EXPECT_EQ(std::string(kSdpCandidates), message);
}

TEST_F(WebRtcSdpTest, Deserialize) {
  SessionDescription desc;
  std::vector<cricket::Candidate> candidates;
  // Deserialize
  EXPECT_TRUE(webrtc::SdpDeserialize(kSdpFullString, &desc, &candidates));
  // Verify
  LOG(LS_INFO) << "SDP: " << webrtc::SdpSerialize(desc, candidates);
  EXPECT_TRUE(CompareSessionDescription(desc_, desc));
}

TEST_F(WebRtcSdpTest, DeserializeSessionDescription) {
  SessionDescription desc;
  EXPECT_TRUE(webrtc::SdpDeserializeSessionDescription(kSdpString, &desc));
  EXPECT_TRUE(CompareSessionDescription(desc_, desc));
}

TEST_F(WebRtcSdpTest, DeserializeCandidates) {
  std::vector<cricket::Candidate> candidates;
  EXPECT_TRUE(webrtc::SdpDeserializeCandidates(kSdpCandidates, &candidates));
  EXPECT_TRUE(CompareCandidates(candidates_, candidates));
}

TEST_F(WebRtcSdpTest, DeserializeBrokenSdp) {
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

TEST_F(WebRtcSdpTest, FormatSdp) {
  std::string full_sdp = webrtc::SdpFormat(kSdpString, kSdpCandidates);
  EXPECT_EQ(kSdpFullString, full_sdp);
}
