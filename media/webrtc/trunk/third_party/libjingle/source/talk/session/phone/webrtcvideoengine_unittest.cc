// Copyright 2008 Google Inc. All Rights Reserved.
//
// Author: Ronghua Wu (ronghuawu@google.com)
//         Zhurun Zhang (zhurunz@google.com)

#include "talk/base/byteorder.h"
#include "talk/base/gunit.h"
#include "talk/session/phone/channel.h"
#include "talk/session/phone/fakemediaengine.h"
#include "talk/session/phone/fakertp.h"
#include "talk/session/phone/fakesession.h"
#include "talk/session/phone/fakewebrtcvideoengine.h"
#include "talk/session/phone/fakewebrtcvoiceengine.h"
#include "talk/session/phone/webrtcvideoengine.h"
#include "talk/session/phone/webrtcvoiceengine.h"

// Tests for the WebRtcVideoEngine/VideoChannel code.

static const cricket::VideoCodec kVP8Codec(104, "VP8", 320, 200, 30, 0);
static const cricket::VideoCodec* const kVideoCodecs[] = {
    &kVP8Codec,
};

class FakeViEWrapper : public cricket::ViEWrapper {
 public:
  explicit FakeViEWrapper(cricket::FakeWebRtcVideoEngine* engine)
      : cricket::ViEWrapper(engine, engine, engine, engine,
                            engine, engine, engine) {
  }
};

class FakeNetworkInterface : public cricket::MediaChannel::NetworkInterface {
 public:
  FakeNetworkInterface()
     : recv_buffer_size_(0),
       send_buffer_size_(0) {
  }
  virtual bool SendPacket(talk_base::Buffer* packet) {
    return true;
  }
  virtual bool SendRtcp(talk_base::Buffer* packet) {
    return true;
  }
  virtual int SetOption(SocketType type, talk_base::Socket::Option opt,
                        int option) {
    if (type == ST_RTP) {
     if (opt == talk_base::Socket::OPT_RCVBUF)
       recv_buffer_size_ = option;
     else if (opt == talk_base::Socket::OPT_SNDBUF)
       send_buffer_size_ = option;
    }
    return 0;
  }
  virtual ~FakeNetworkInterface() {}
  int recv_buffer_size_;
  int send_buffer_size_;
};

class WebRtcVideoEngineTest : public testing::Test {
 public:
  class ChannelErrorListener : public sigslot::has_slots<> {
   public:
    explicit ChannelErrorListener(cricket::WebRtcVideoMediaChannel* channel)
        : ssrc_(0), error_(cricket::WebRtcVideoMediaChannel::ERROR_NONE) {
      ASSERT(channel != NULL);
      channel->SignalMediaError.connect(
          this, &ChannelErrorListener::OnVideoChannelError);
    }
    void OnVideoChannelError(uint32 ssrc,
                             cricket::WebRtcVideoMediaChannel::Error error) {
      ssrc_ = ssrc;
      error_ = error;
    }
    void Reset() {
      ssrc_ = 0;
      error_ = cricket::WebRtcVideoMediaChannel::ERROR_NONE;
    }
    uint32 ssrc() const {
      return ssrc_;
    }
    cricket::WebRtcVideoMediaChannel::Error error() const {
      return error_;
    }

   private:
    uint32 ssrc_;
    cricket::WebRtcVideoMediaChannel::Error error_;
  };

  WebRtcVideoEngineTest()
      : vie_(kVideoCodecs, ARRAY_SIZE(kVideoCodecs)),
        engine_(NULL,  // cricket::WebRtcVoiceEngine
                new FakeViEWrapper(&vie_)),
        channel_(NULL),
        voice_channel_(NULL) {
  }
  bool SetupEngine() {
    bool result = engine_.Init();
    if (result) {
      channel_ = engine_.CreateChannel(voice_channel_);
      result = (channel_ != NULL);
    }
    return result;
  }
  void DeliverPacket(const void* data, int len) {
    talk_base::Buffer packet(data, len);
    channel_->OnPacketReceived(&packet);
  }
  virtual void TearDown() {
    delete channel_;
    engine_.Terminate();
  }

 protected:
  cricket::FakeWebRtcVideoEngine vie_;
  cricket::WebRtcVideoEngine engine_;
  cricket::WebRtcVideoMediaChannel* channel_;
  cricket::WebRtcVoiceMediaChannel* voice_channel_;
};

// Tests that our stub library "works".
TEST_F(WebRtcVideoEngineTest, StartupShutdown) {
  EXPECT_FALSE(vie_.IsInited());
  EXPECT_TRUE(engine_.Init());
  EXPECT_TRUE(vie_.IsInited());
  engine_.Terminate();
  // TODO: what to expect after Terminate
  // EXPECT_FALSE(vie_.IsInited());
}

// Tests that we can create and destroy a channel.
TEST_F(WebRtcVideoEngineTest, CreateChannel) {
  EXPECT_TRUE(engine_.Init());
  channel_ = engine_.CreateChannel(voice_channel_);
  EXPECT_TRUE(channel_ != NULL);
}

// Tests that we properly handle failures in CreateChannel.
TEST_F(WebRtcVideoEngineTest, CreateChannelFail) {
  vie_.set_fail_create_channel(true);
  EXPECT_TRUE(engine_.Init());
  channel_ = engine_.CreateChannel(voice_channel_);
  EXPECT_TRUE(channel_ == NULL);
}

// Tests that we can find codecs by name or id
TEST_F(WebRtcVideoEngineTest, FindCodec) {
  // We should not need to init engine in order to get codecs.
  const std::vector<cricket::VideoCodec>& c = engine_.codecs();
  EXPECT_EQ(1U, c.size());

  cricket::VideoCodec vp8(104, "VP8", 320, 200, 30, 0);
  EXPECT_TRUE(engine_.FindCodec(vp8));

  cricket::VideoCodec vp8_diff_fr_diff_pref(104, "VP8", 320, 200, 50, 50);
  EXPECT_TRUE(engine_.FindCodec(vp8_diff_fr_diff_pref));

  cricket::VideoCodec vp8_diff_id(95, "VP8", 320, 200, 30, 0);
  EXPECT_FALSE(engine_.FindCodec(vp8_diff_id));
  vp8_diff_id.id = 97;
  EXPECT_TRUE(engine_.FindCodec(vp8_diff_id));

  cricket::VideoCodec vp8_diff_res(104, "VP8", 320, 111, 30, 0);
  EXPECT_FALSE(engine_.FindCodec(vp8_diff_res));

  // PeerConnection doesn't negotiate the resolution at this point.
  // Test that FindCodec can handle the case when width/height is 0.
  cricket::VideoCodec vp8_zero_res(104, "VP8", 0, 0, 30, 0);
  EXPECT_TRUE(engine_.FindCodec(vp8_zero_res));
}

// Test that we set our inbound codecs properly
TEST_F(WebRtcVideoEngineTest, SetRecvCodecs) {
  EXPECT_TRUE(SetupEngine());
  std::vector<cricket::VideoCodec> codecs;
  codecs.push_back(kVP8Codec);
  EXPECT_TRUE(channel_->SetRecvCodecs(codecs));
}

// Test that we apply codecs properly.
TEST_F(WebRtcVideoEngineTest, SetSendCodecs) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = vie_.GetLastChannel();
  std::vector<cricket::VideoCodec> codecs;
  codecs.push_back(kVP8Codec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::VideoCodec gcodec;
  EXPECT_EQ(0, vie_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(kVP8Codec.id, gcodec.plType);
  EXPECT_EQ(kVP8Codec.width, gcodec.width);
  EXPECT_EQ(kVP8Codec.height, gcodec.height);
  EXPECT_STREQ(kVP8Codec.name.c_str(), gcodec.plName);
}

// Tests that the rtp buffer is set properly after the SetInterface call.
TEST_F(WebRtcVideoEngineTest, SetRtpBufferSize) {
  EXPECT_TRUE(SetupEngine());
  const int kExpectedVideoRtpBufferSize = 65536;
  FakeNetworkInterface network_interface;
  channel_->SetInterface(&network_interface);
  EXPECT_EQ(kExpectedVideoRtpBufferSize, network_interface.recv_buffer_size_);
  EXPECT_EQ(kExpectedVideoRtpBufferSize, network_interface.send_buffer_size_);
}

// TODO: add tests for below interfaces
// bool SetOptions(int options);
// bool SetCaptureDevice(const Device* device);
// bool SetLocalRenderer(VideoRenderer* renderer);
// CaptureResult SetCapture(bool capture);
// virtual bool SetRender(bool render);
// virtual bool SetSend(bool send);
// virtual bool AddStream(uint32 ssrc, uint32 voice_ssrc);
// virtual bool RemoveStream(uint32 ssrc);
// virtual bool SetRenderer(uint32 ssrc, VideoRenderer* renderer);
// virtual bool GetStats(VideoMediaInfo* info);
// virtual bool SendIntraFrame();
// virtual bool RequestIntraFrame();
// virtual void OnPacketReceived(talk_base::Buffer* packet);
// virtual void OnRtcpReceived(talk_base::Buffer* packet);
// virtual void SetSendSsrc(uint32 id);
// virtual bool SetRtcpCName(const std::string& cname);
// virtual bool Mute(bool on);
// virtual bool SetSendBandwidth(bool autobw, int bps);
// virtual bool SetOptions(int options);

