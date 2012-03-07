// Copyright 2008 Google Inc. All Rights Reserved.
//
// Author: Justin Uberti (juberti@google.com)

#include "talk/base/byteorder.h"
#include "talk/base/gunit.h"
#include "talk/p2p/base/fakesession.h"
#include "talk/session/phone/channel.h"
#include "talk/session/phone/fakemediaengine.h"
#include "talk/session/phone/fakemediaprocessor.h"
#include "talk/session/phone/fakertp.h"
#include "talk/session/phone/fakewebrtcvoiceengine.h"
#include "talk/session/phone/webrtcvoiceengine.h"

// Tests for the WebRtcVoiceEngine/VoiceChannel code.

static const cricket::AudioCodec kPcmuCodec(0, "PCMU", 8000, 64000, 1, 0);
static const cricket::AudioCodec kIsacCodec(103, "ISAC", 16000, 32000, 1, 0);
static const cricket::AudioCodec kRedCodec(117, "red", 8000, 0, 1, 0);
static const cricket::AudioCodec kCn8000Codec(13, "CN", 8000, 0, 1, 0);
static const cricket::AudioCodec kCn16000Codec(105, "CN", 16000, 0, 1, 0);
static const cricket::AudioCodec
    kTelephoneEventCodec(106, "telephone-event", 8000, 0, 1, 0);
static const cricket::AudioCodec* const kAudioCodecs[] = {
    &kPcmuCodec, &kIsacCodec, &kRedCodec, &kCn8000Codec, &kCn16000Codec,
    &kTelephoneEventCodec,
};
const char kRingbackTone[] = "RIFF____WAVE____ABCD1234";
static uint32 kSsrc1 = 0x99;

class FakeVoEWrapper : public cricket::VoEWrapper {
 public:
  explicit FakeVoEWrapper(cricket::FakeWebRtcVoiceEngine* engine)
      : cricket::VoEWrapper(engine,  // processing
                            engine,  // base
                            engine,  // codec
                            engine,  // dtmf
                            engine,  // file
                            engine,  // hw
                            engine,  // media
                            engine,  // neteq
                            engine,  // network
                            engine,  // rtp
                            engine,  // sync
                            engine) {  // volume
  }
};

class NullVoETraceWrapper : public cricket::VoETraceWrapper {
 public:
  virtual int SetTraceFilter(const unsigned int filter) {
    return 0;
  }
  virtual int SetTraceFile(const char* fileNameUTF8) {
    return 0;
  }
  virtual int SetTraceCallback(webrtc::TraceCallback* callback) {
    return 0;
  }
};

class WebRtcVoiceEngineTestFake : public testing::Test {
 public:
  class ChannelErrorListener : public sigslot::has_slots<> {
   public:
    explicit ChannelErrorListener(cricket::VoiceMediaChannel* channel)
        : ssrc_(0), error_(cricket::VoiceMediaChannel::ERROR_NONE) {
      ASSERT(channel != NULL);
      channel->SignalMediaError.connect(
          this, &ChannelErrorListener::OnVoiceChannelError);
    }
    void OnVoiceChannelError(uint32 ssrc,
                             cricket::VoiceMediaChannel::Error error) {
      ssrc_ = ssrc;
      error_ = error;
    }
    void Reset() {
      ssrc_ = 0;
      error_ = cricket::VoiceMediaChannel::ERROR_NONE;
    }
    uint32 ssrc() const {
      return ssrc_;
    }
    cricket::VoiceMediaChannel::Error error() const {
      return error_;
    }

   private:
    uint32 ssrc_;
    cricket::VoiceMediaChannel::Error error_;
  };

  WebRtcVoiceEngineTestFake()
      : voe_(kAudioCodecs, ARRAY_SIZE(kAudioCodecs)),
        voe_sc_(kAudioCodecs, ARRAY_SIZE(kAudioCodecs)),
        engine_(new FakeVoEWrapper(&voe_),
                new FakeVoEWrapper(&voe_sc_),
                new NullVoETraceWrapper()),
        channel_(NULL), soundclip_(NULL) {
  }
  bool SetupEngine() {
    bool result = engine_.Init();
    if (result) {
      channel_ = engine_.CreateChannel();
      result = (channel_ != NULL);
    }
    if (result) {
      result = channel_->AddSendStream(
          cricket::StreamParams::CreateLegacy(kSsrc1));
    }
    return result;
  }
  void DeliverPacket(const void* data, int len) {
    talk_base::Buffer packet(data, len);
    channel_->OnPacketReceived(&packet);
  }
  virtual void TearDown() {
    delete soundclip_;
    delete channel_;
    engine_.Terminate();
  }

 protected:
  cricket::FakeWebRtcVoiceEngine voe_;
  cricket::FakeWebRtcVoiceEngine voe_sc_;
  cricket::WebRtcVoiceEngine engine_;
  cricket::VoiceMediaChannel* channel_;
  cricket::SoundclipMedia* soundclip_;
};

// Tests that our stub library "works".
TEST_F(WebRtcVoiceEngineTestFake, StartupShutdown) {
  EXPECT_FALSE(voe_.IsInited());
  EXPECT_FALSE(voe_sc_.IsInited());
  EXPECT_TRUE(engine_.Init());
  EXPECT_TRUE(voe_.IsInited());
  EXPECT_TRUE(voe_sc_.IsInited());
  engine_.Terminate();
  EXPECT_FALSE(voe_.IsInited());
  EXPECT_FALSE(voe_sc_.IsInited());
}

// Tests that we can create and destroy a channel.
TEST_F(WebRtcVoiceEngineTestFake, CreateChannel) {
  EXPECT_TRUE(engine_.Init());
  channel_ = engine_.CreateChannel();
  EXPECT_TRUE(channel_ != NULL);
}

// Tests that we properly handle failures in CreateChannel.
TEST_F(WebRtcVoiceEngineTestFake, CreateChannelFail) {
  voe_.set_fail_create_channel(true);
  EXPECT_TRUE(engine_.Init());
  channel_ = engine_.CreateChannel();
  EXPECT_TRUE(channel_ == NULL);
}

// Tests that the list of supported codecs is created properly and ordered
// correctly
TEST_F(WebRtcVoiceEngineTestFake, CodecPreference) {
  const std::vector<cricket::AudioCodec>& codecs = engine_.codecs();
  ASSERT_FALSE(codecs.empty());
  EXPECT_EQ("ISAC", codecs[0].name);
  EXPECT_EQ(16000, codecs[0].clockrate);
  EXPECT_EQ(0, codecs[0].bitrate);
  int pref = codecs[0].preference;
  for (size_t i = 1; i < codecs.size(); ++i) {
    EXPECT_GT(pref, codecs[i].preference);
    pref = codecs[i].preference;
  }
}

// Tests that we can find codecs by name or id, and that we interpret the
// clockrate and bitrate fields properly.
TEST_F(WebRtcVoiceEngineTestFake, FindCodec) {
  cricket::AudioCodec codec;
  webrtc::CodecInst codec_inst;
  // Find PCMU with explicit clockrate and bitrate.
  EXPECT_TRUE(engine_.FindWebRtcCodec(kPcmuCodec, &codec_inst));
  // Find ISAC with explicit clockrate and 0 bitrate.
  EXPECT_TRUE(engine_.FindWebRtcCodec(kIsacCodec, &codec_inst));
  // Find telephone-event with explicit clockrate and 0 bitrate.
  EXPECT_TRUE(engine_.FindWebRtcCodec(kTelephoneEventCodec, &codec_inst));
  // Find ISAC with a different payload id.
  codec = kIsacCodec;
  codec.id = 127;
  EXPECT_TRUE(engine_.FindWebRtcCodec(codec, &codec_inst));
  EXPECT_EQ(codec.id, codec_inst.pltype);
  // Find PCMU with a 0 clockrate.
  codec = kPcmuCodec;
  codec.clockrate = 0;
  EXPECT_TRUE(engine_.FindWebRtcCodec(codec, &codec_inst));
  EXPECT_EQ(codec.id, codec_inst.pltype);
  EXPECT_EQ(8000, codec_inst.plfreq);
  // Find PCMU with a 0 bitrate.
  codec = kPcmuCodec;
  codec.bitrate = 0;
  EXPECT_TRUE(engine_.FindWebRtcCodec(codec, &codec_inst));
  EXPECT_EQ(codec.id, codec_inst.pltype);
  EXPECT_EQ(64000, codec_inst.rate);
  // Find ISAC with an explicit bitrate.
  codec = kIsacCodec;
  codec.bitrate = 32000;
  EXPECT_TRUE(engine_.FindWebRtcCodec(codec, &codec_inst));
  EXPECT_EQ(codec.id, codec_inst.pltype);
  EXPECT_EQ(32000, codec_inst.rate);
}

// Test that we set our inbound codecs properly, including changing PT.
TEST_F(WebRtcVoiceEngineTestFake, SetRecvCodecs) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs.push_back(kTelephoneEventCodec);
  codecs[0].id = 106;  // collide with existing telephone-event
  codecs[2].id = 126;
  EXPECT_TRUE(channel_->SetRecvCodecs(codecs));
  webrtc::CodecInst gcodec;
  talk_base::strcpyn(gcodec.plname, ARRAY_SIZE(gcodec.plname), "ISAC");
  gcodec.plfreq = 16000;
  EXPECT_EQ(0, voe_.GetRecPayloadType(channel_num, gcodec));
  EXPECT_EQ(106, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  talk_base::strcpyn(gcodec.plname, ARRAY_SIZE(gcodec.plname),
      "telephone-event");
  gcodec.plfreq = 8000;
  EXPECT_EQ(0, voe_.GetRecPayloadType(channel_num, gcodec));
  EXPECT_EQ(126, gcodec.pltype);
  EXPECT_STREQ("telephone-event", gcodec.plname);
}

// Test that we fail to set an unknown inbound codec.
TEST_F(WebRtcVoiceEngineTestFake, SetRecvCodecsUnsupportedCodec) {
  EXPECT_TRUE(SetupEngine());
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);
  codecs.push_back(cricket::AudioCodec(127, "XYZ", 32000, 0, 1, 0));
  EXPECT_FALSE(channel_->SetRecvCodecs(codecs));
}

// Test that we fail if we have duplicate types in the inbound list.
TEST_F(WebRtcVoiceEngineTestFake, SetRecvCodecsDuplicatePayloadType) {
  EXPECT_TRUE(SetupEngine());
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);
  codecs.push_back(kCn16000Codec);
  codecs[1].id = kIsacCodec.id;
  EXPECT_FALSE(channel_->SetRecvCodecs(codecs));
}

// Test that changes to recv codecs are applied to all streams.
TEST_F(WebRtcVoiceEngineTestFake, SetRecvCodecsWithMultipleStreams) {
  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs.push_back(kTelephoneEventCodec);
  codecs[0].id = 106;  // collide with existing telephone-event
  codecs[2].id = 126;
  EXPECT_TRUE(channel_->SetRecvCodecs(codecs));
  EXPECT_TRUE(channel_->AddRecvStream(
      cricket::StreamParams::CreateLegacy(kSsrc1)));
  int channel_num2 = voe_.GetLastChannel();
  webrtc::CodecInst gcodec;
  talk_base::strcpyn(gcodec.plname, ARRAY_SIZE(gcodec.plname), "ISAC");
  gcodec.plfreq = 16000;
  EXPECT_EQ(0, voe_.GetRecPayloadType(channel_num2, gcodec));
  EXPECT_EQ(106, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  talk_base::strcpyn(gcodec.plname, ARRAY_SIZE(gcodec.plname),
      "telephone-event");
  gcodec.plfreq = 8000;
  EXPECT_EQ(0, voe_.GetRecPayloadType(channel_num2, gcodec));
  EXPECT_EQ(126, gcodec.pltype);
  EXPECT_STREQ("telephone-event", gcodec.plname);
}

TEST_F(WebRtcVoiceEngineTestFake, SetRecvCodecsAfterAddingStreams) {
  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);
  codecs[0].id = 106;  // collide with existing telephone-event

  EXPECT_TRUE(channel_->AddRecvStream(
      cricket::StreamParams::CreateLegacy(kSsrc1)));
  EXPECT_TRUE(channel_->SetRecvCodecs(codecs));

  int channel_num2 = voe_.GetLastChannel();
  webrtc::CodecInst gcodec;
  talk_base::strcpyn(gcodec.plname, ARRAY_SIZE(gcodec.plname), "ISAC");
  gcodec.plfreq = 16000;
  EXPECT_EQ(0, voe_.GetRecPayloadType(channel_num2, gcodec));
  EXPECT_EQ(106, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
}

// Test that we apply codecs properly.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecs) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs.push_back(kRedCodec);
  codecs[0].id = 96;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_FALSE(voe_.GetVAD(channel_num));
  EXPECT_FALSE(voe_.GetFEC(channel_num));
  EXPECT_EQ(13, voe_.GetSendCNPayloadType(channel_num, false));
  EXPECT_EQ(105, voe_.GetSendCNPayloadType(channel_num, true));
  EXPECT_EQ(106, voe_.GetSendTelephoneEventPayloadType(channel_num));
}

// Test that we handle various ways of specifying bitrate.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsBitrate) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);  // bitrate == 32000
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(103, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_EQ(32000, gcodec.rate);
  codecs[0].bitrate = 0;         // bitrate == default
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(103, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_EQ(-1, gcodec.rate);
  codecs[0].bitrate = 28000;     // bitrate == 28000
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(103, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_EQ(28000, gcodec.rate);
  codecs[0] = kPcmuCodec;        // bitrate == 64000
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(0, gcodec.pltype);
  EXPECT_STREQ("PCMU", gcodec.plname);
  EXPECT_EQ(64000, gcodec.rate);
  codecs[0].bitrate = 0;         // bitrate == default
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(0, gcodec.pltype);
  EXPECT_STREQ("PCMU", gcodec.plname);
  EXPECT_EQ(64000, gcodec.rate);
}

// Test that we fall back to PCMU if no codecs are specified.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsNoCodecs) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(0, gcodec.pltype);
  EXPECT_STREQ("PCMU", gcodec.plname);
  EXPECT_FALSE(voe_.GetVAD(channel_num));
  EXPECT_FALSE(voe_.GetFEC(channel_num));
  EXPECT_EQ(13, voe_.GetSendCNPayloadType(channel_num, false));
  EXPECT_EQ(105, voe_.GetSendCNPayloadType(channel_num, true));
  EXPECT_EQ(106, voe_.GetSendTelephoneEventPayloadType(channel_num));
}

// Test that we set VAD and DTMF types correctly.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsCNandDTMF) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  // TODO: cn 32000
  codecs.push_back(kCn16000Codec);
  codecs.push_back(kCn8000Codec);
  codecs.push_back(kTelephoneEventCodec);
  codecs.push_back(kRedCodec);
  codecs[0].id = 96;
  codecs[2].id = 97;  // wideband CN
  codecs[4].id = 98;  // DTMF
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_TRUE(voe_.GetVAD(channel_num));
  EXPECT_FALSE(voe_.GetFEC(channel_num));
  EXPECT_EQ(13, voe_.GetSendCNPayloadType(channel_num, false));
  EXPECT_EQ(97, voe_.GetSendCNPayloadType(channel_num, true));
  EXPECT_EQ(98, voe_.GetSendTelephoneEventPayloadType(channel_num));
}

// Test that we perform case-insensitive matching of codec names.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsCaseInsensitive) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs.push_back(kCn16000Codec);
  codecs.push_back(kCn8000Codec);
  codecs.push_back(kTelephoneEventCodec);
  codecs.push_back(kRedCodec);
  codecs[0].name = "iSaC";
  codecs[0].id = 96;
  codecs[2].id = 97;  // wideband CN
  codecs[4].id = 98;  // DTMF
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_TRUE(voe_.GetVAD(channel_num));
  EXPECT_FALSE(voe_.GetFEC(channel_num));
  EXPECT_EQ(13, voe_.GetSendCNPayloadType(channel_num, false));
  EXPECT_EQ(97, voe_.GetSendCNPayloadType(channel_num, true));
  EXPECT_EQ(98, voe_.GetSendTelephoneEventPayloadType(channel_num));
}

// Test that we set up FEC correctly.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsRED) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kRedCodec);
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs[0].id = 127;
  codecs[0].params[""] = "96/96";
  codecs[1].id = 96;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_TRUE(voe_.GetFEC(channel_num));
  EXPECT_EQ(127, voe_.GetSendFECPayloadType(channel_num));
}

// Test that we set up FEC correctly if params are omitted.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsREDNoParams) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kRedCodec);
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs[0].id = 127;
  codecs[1].id = 96;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_TRUE(voe_.GetFEC(channel_num));
  EXPECT_EQ(127, voe_.GetSendFECPayloadType(channel_num));
}

// Test that we ignore RED if the parameters aren't named the way we expect.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsBadRED1) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kRedCodec);
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs[0].id = 127;
  codecs[0].params["ABC"] = "96/96";
  codecs[1].id = 96;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_FALSE(voe_.GetFEC(channel_num));
}

// Test that we ignore RED if it uses different primary/secondary encoding.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsBadRED2) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kRedCodec);
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs[0].id = 127;
  codecs[0].params[""] = "96/0";
  codecs[1].id = 96;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_FALSE(voe_.GetFEC(channel_num));
}

// Test that we ignore RED if it uses more than 2 encodings.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsBadRED3) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kRedCodec);
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs[0].id = 127;
  codecs[0].params[""] = "96/96/96";
  codecs[1].id = 96;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_FALSE(voe_.GetFEC(channel_num));
}

// Test that we ignore RED if it has bogus codec ids.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsBadRED4) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kRedCodec);
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs[0].id = 127;
  codecs[0].params[""] = "ABC/ABC";
  codecs[1].id = 96;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_FALSE(voe_.GetFEC(channel_num));
}

// Test that we ignore RED if it refers to a codec that is not present.
TEST_F(WebRtcVoiceEngineTestFake, SetSendCodecsBadRED5) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kRedCodec);
  codecs.push_back(kIsacCodec);
  codecs.push_back(kPcmuCodec);
  codecs[0].id = 127;
  codecs[0].params[""] = "97/97";
  codecs[1].id = 96;
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  webrtc::CodecInst gcodec;
  EXPECT_EQ(0, voe_.GetSendCodec(channel_num, gcodec));
  EXPECT_EQ(96, gcodec.pltype);
  EXPECT_STREQ("ISAC", gcodec.plname);
  EXPECT_FALSE(voe_.GetFEC(channel_num));
}

// Test that we support setting an empty list of recv header extensions.
TEST_F(WebRtcVoiceEngineTestFake, SetRecvRtpHeaderExtensions) {
  EXPECT_TRUE(SetupEngine());
  std::vector<cricket::RtpHeaderExtension> extensions;
  int channel_num = voe_.GetLastChannel();
  bool enable = false;
  unsigned char id = 0;

  // An empty list shouldn't cause audio-level headers to be enabled.
  EXPECT_TRUE(channel_->SetRecvRtpHeaderExtensions(extensions));
  EXPECT_EQ(0, voe_.GetRTPAudioLevelIndicationStatus(
      channel_num, enable, id));
  EXPECT_FALSE(enable);

  // Nor should indicating we can receive the audio-level header.
  extensions.push_back(cricket::RtpHeaderExtension(
      "urn:ietf:params:rtp-hdrext:ssrc-audio-level", 8));
  EXPECT_TRUE(channel_->SetRecvRtpHeaderExtensions(extensions));
  EXPECT_EQ(0, voe_.GetRTPAudioLevelIndicationStatus(
      channel_num, enable, id));
  EXPECT_FALSE(enable);
}

// Test that we support setting certain send header extensions.
TEST_F(WebRtcVoiceEngineTestFake, SetSendRtpHeaderExtensions) {
  EXPECT_TRUE(SetupEngine());
  std::vector<cricket::RtpHeaderExtension> extensions;
  int channel_num = voe_.GetLastChannel();
  bool enable = false;
  unsigned char id = 0;

  // Ensure audio levels are off by default.
  EXPECT_EQ(0, voe_.GetRTPAudioLevelIndicationStatus(
      channel_num, enable, id));
  EXPECT_FALSE(enable);

  // Ensure audio levels stay off with an empty list of headers.
  EXPECT_TRUE(channel_->SetSendRtpHeaderExtensions(extensions));
  EXPECT_EQ(0, voe_.GetRTPAudioLevelIndicationStatus(
      channel_num, enable, id));
  EXPECT_FALSE(enable);

  // Ensure audio levels are enabled if the audio-level header is specified.
  extensions.push_back(cricket::RtpHeaderExtension(
      "urn:ietf:params:rtp-hdrext:ssrc-audio-level", 8));
  EXPECT_TRUE(channel_->SetSendRtpHeaderExtensions(extensions));
  EXPECT_EQ(0, voe_.GetRTPAudioLevelIndicationStatus(
      channel_num, enable, id));
  EXPECT_TRUE(enable);
  EXPECT_EQ(8, id);

  // Ensure audio levels go back off with an empty list.
  extensions.clear();
  EXPECT_TRUE(channel_->SetSendRtpHeaderExtensions(extensions));
  EXPECT_EQ(0, voe_.GetRTPAudioLevelIndicationStatus(
      channel_num, enable, id));
  EXPECT_FALSE(enable);
}

// Test that we can create a channel and start sending/playing out on it.
TEST_F(WebRtcVoiceEngineTestFake, SendAndPlayout) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kPcmuCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_MICROPHONE));
  EXPECT_TRUE(voe_.GetSend(channel_num));
  EXPECT_TRUE(channel_->SetPlayout(true));
  EXPECT_TRUE(voe_.GetPlayout(channel_num));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_NOTHING));
  EXPECT_FALSE(voe_.GetSend(channel_num));
  EXPECT_TRUE(channel_->SetPlayout(false));
  EXPECT_FALSE(voe_.GetPlayout(channel_num));
}

// Test that we can add and remove streams, and do proper send/playout.
// We can receive on multiple streams, but will only send on one.
TEST_F(WebRtcVoiceEngineTestFake, SendAndPlayoutWithMultipleStreams) {
  EXPECT_TRUE(SetupEngine());
  int channel_num1 = voe_.GetLastChannel();

  // Start playout on the default channel.
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  EXPECT_TRUE(channel_->SetPlayout(true));
  EXPECT_TRUE(voe_.GetPlayout(channel_num1));

  // Adding another stream should disable playout on the default channel.
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(2)));
  int channel_num2 = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kPcmuCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_MICROPHONE));
  EXPECT_TRUE(voe_.GetSend(channel_num1));
  EXPECT_FALSE(voe_.GetSend(channel_num2));

  // Make sure only the new channel is played out.
  EXPECT_FALSE(voe_.GetPlayout(channel_num1));
  EXPECT_TRUE(voe_.GetPlayout(channel_num2));

  // Adding yet another stream should have stream 2 and 3 enabled for playout.
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(3)));
  int channel_num3 = voe_.GetLastChannel();
  EXPECT_FALSE(voe_.GetPlayout(channel_num1));
  EXPECT_TRUE(voe_.GetPlayout(channel_num2));
  EXPECT_TRUE(voe_.GetPlayout(channel_num3));
  EXPECT_FALSE(voe_.GetSend(channel_num3));

  // Stop sending.
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_NOTHING));
  EXPECT_FALSE(voe_.GetSend(channel_num1));
  EXPECT_FALSE(voe_.GetSend(channel_num2));
  EXPECT_FALSE(voe_.GetSend(channel_num3));

  // Stop playout.
  EXPECT_TRUE(channel_->SetPlayout(false));
  EXPECT_FALSE(voe_.GetPlayout(channel_num1));
  EXPECT_FALSE(voe_.GetPlayout(channel_num2));
  EXPECT_FALSE(voe_.GetPlayout(channel_num3));

  // Restart playout and make sure the default channel still is not played out.
  EXPECT_TRUE(channel_->SetPlayout(true));
  EXPECT_FALSE(voe_.GetPlayout(channel_num1));
  EXPECT_TRUE(voe_.GetPlayout(channel_num2));
  EXPECT_TRUE(voe_.GetPlayout(channel_num3));

  // Now remove the new streams and verify that the default channel is
  // played out again.
  EXPECT_TRUE(channel_->RemoveRecvStream(3));
  EXPECT_TRUE(channel_->RemoveRecvStream(2));

  EXPECT_TRUE(voe_.GetPlayout(channel_num1));
}

// Test that we can set the devices to use.
TEST_F(WebRtcVoiceEngineTestFake, SetDevices) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kPcmuCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));

  cricket::Device default_dev(cricket::kFakeDefaultDeviceName,
                              cricket::kFakeDefaultDeviceId);
  cricket::Device dev(cricket::kFakeDeviceName,
                      cricket::kFakeDeviceId);

  // Test SetDevices() while not sending or playing.
  EXPECT_TRUE(engine_.SetDevices(&default_dev, &default_dev));

  // Test SetDevices() while sending and playing.
  EXPECT_TRUE(engine_.SetLocalMonitor(true));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_MICROPHONE));
  EXPECT_TRUE(channel_->SetPlayout(true));
  EXPECT_TRUE(voe_.GetRecordingMicrophone());
  EXPECT_TRUE(voe_.GetSend(channel_num));
  EXPECT_TRUE(voe_.GetPlayout(channel_num));

  EXPECT_TRUE(engine_.SetDevices(&dev, &dev));

  EXPECT_TRUE(voe_.GetRecordingMicrophone());
  EXPECT_TRUE(voe_.GetSend(channel_num));
  EXPECT_TRUE(voe_.GetPlayout(channel_num));

  // Test that failure to open newly selected devices does not prevent opening
  // ones after that.
  voe_.set_fail_start_recording_microphone(true);
  voe_.set_playout_fail_channel(channel_num);
  voe_.set_send_fail_channel(channel_num);

  EXPECT_FALSE(engine_.SetDevices(&default_dev, &default_dev));

  EXPECT_FALSE(voe_.GetRecordingMicrophone());
  EXPECT_FALSE(voe_.GetSend(channel_num));
  EXPECT_FALSE(voe_.GetPlayout(channel_num));

  voe_.set_fail_start_recording_microphone(false);
  voe_.set_playout_fail_channel(-1);
  voe_.set_send_fail_channel(-1);

  EXPECT_TRUE(engine_.SetDevices(&dev, &dev));

  EXPECT_TRUE(voe_.GetRecordingMicrophone());
  EXPECT_TRUE(voe_.GetSend(channel_num));
  EXPECT_TRUE(voe_.GetPlayout(channel_num));
}

// Test that we can set the devices to use even if we failed to
// open the initial ones.
TEST_F(WebRtcVoiceEngineTestFake, SetDevicesWithInitiallyBadDevices) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kPcmuCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));

  cricket::Device default_dev(cricket::kFakeDefaultDeviceName,
                              cricket::kFakeDefaultDeviceId);
  cricket::Device dev(cricket::kFakeDeviceName,
                      cricket::kFakeDeviceId);

  // Test that failure to open devices selected before starting
  // send/play does not prevent opening newly selected ones after that.
  voe_.set_fail_start_recording_microphone(true);
  voe_.set_playout_fail_channel(channel_num);
  voe_.set_send_fail_channel(channel_num);

  EXPECT_TRUE(engine_.SetDevices(&default_dev, &default_dev));

  EXPECT_FALSE(engine_.SetLocalMonitor(true));
  EXPECT_FALSE(channel_->SetSend(cricket::SEND_MICROPHONE));
  EXPECT_FALSE(channel_->SetPlayout(true));
  EXPECT_FALSE(voe_.GetRecordingMicrophone());
  EXPECT_FALSE(voe_.GetSend(channel_num));
  EXPECT_FALSE(voe_.GetPlayout(channel_num));

  voe_.set_fail_start_recording_microphone(false);
  voe_.set_playout_fail_channel(-1);
  voe_.set_send_fail_channel(-1);

  EXPECT_TRUE(engine_.SetDevices(&dev, &dev));

  EXPECT_TRUE(voe_.GetRecordingMicrophone());
  EXPECT_TRUE(voe_.GetSend(channel_num));
  EXPECT_TRUE(voe_.GetPlayout(channel_num));
}

// Test that we can create a channel configured for multi-point conferences,
// and start sending/playing out on it.
TEST_F(WebRtcVoiceEngineTestFake, ConferenceSendAndPlayout) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kPcmuCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_MICROPHONE));
  EXPECT_TRUE(voe_.GetSend(channel_num));

  bool enabled;
  webrtc::EcModes ec_mode;
  webrtc::NsModes ns_mode;
  EXPECT_EQ(0, voe_.GetEcStatus(enabled, ec_mode));
#ifdef CHROMEOS
  EXPECT_EQ(webrtc::kEcDefault, ec_mode);
#else
  EXPECT_EQ(webrtc::kEcConference, ec_mode);
#endif
  EXPECT_EQ(0, voe_.GetNsStatus(enabled, ns_mode));
  EXPECT_TRUE(enabled);
#ifdef CHROMEOS
  EXPECT_EQ(webrtc::kNsDefault, ns_mode);
#else
  EXPECT_EQ(webrtc::kNsConference, ns_mode);
#endif

  EXPECT_TRUE(channel_->SetPlayout(true));
  EXPECT_TRUE(voe_.GetPlayout(channel_num));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_NOTHING));
  EXPECT_FALSE(voe_.GetSend(channel_num));

  EXPECT_EQ(0, voe_.GetEcStatus(enabled, ec_mode));
  EXPECT_EQ(webrtc::kEcDefault, ec_mode);
  EXPECT_EQ(0, voe_.GetNsStatus(enabled, ns_mode));
  EXPECT_EQ(webrtc::kNsDefault, ns_mode);

  EXPECT_TRUE(channel_->SetPlayout(false));
  EXPECT_FALSE(voe_.GetPlayout(channel_num));
}

// Test that we can create a channel configured for Codian bridges,
// and start sending/playing out on it.
TEST_F(WebRtcVoiceEngineTestFake, CodianSendAndPlayout) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  webrtc::AgcConfig agc_config;
  EXPECT_EQ(0, voe_.GetAgcConfig(agc_config));
  EXPECT_EQ(0, agc_config.targetLeveldBOv);
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_AGC_MINUS_10DB));
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kPcmuCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_MICROPHONE));
  EXPECT_TRUE(voe_.GetSend(channel_num));
  EXPECT_EQ(0, voe_.GetAgcConfig(agc_config));
  EXPECT_GT(agc_config.targetLeveldBOv, 0);  // level was attenuated
  EXPECT_TRUE(channel_->SetPlayout(true));
  EXPECT_TRUE(voe_.GetPlayout(channel_num));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_NOTHING));
  EXPECT_FALSE(voe_.GetSend(channel_num));
  EXPECT_EQ(0, voe_.GetAgcConfig(agc_config));
  EXPECT_EQ(0, agc_config.targetLeveldBOv);  // level was restored
  EXPECT_TRUE(channel_->SetPlayout(false));
  EXPECT_FALSE(voe_.GetPlayout(channel_num));
}

// Test that we can set the outgoing SSRC properly.
// SSRC is set in SetupEngine by calling AddSendStream.
TEST_F(WebRtcVoiceEngineTestFake, SetSendSsrc) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  unsigned int send_ssrc;
  EXPECT_EQ(0, voe_.GetLocalSSRC(channel_num, send_ssrc));
  EXPECT_NE(0U, send_ssrc);
  EXPECT_EQ(0, voe_.GetLocalSSRC(channel_num, send_ssrc));
  EXPECT_EQ(kSsrc1, send_ssrc);
}

// Test that we can set the outgoing SSRC properly with multiple streams.
// SSRC is set in SetupEngine by calling AddSendStream.
TEST_F(WebRtcVoiceEngineTestFake, SetSendSsrcWithMultipleStreams) {
  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  int channel_num1 = voe_.GetLastChannel();
  unsigned int send_ssrc;
  EXPECT_EQ(0, voe_.GetLocalSSRC(channel_num1, send_ssrc));
  EXPECT_EQ(kSsrc1, send_ssrc);

  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(2)));
  int channel_num2 = voe_.GetLastChannel();
  EXPECT_EQ(0, voe_.GetLocalSSRC(channel_num2, send_ssrc));
  EXPECT_EQ(kSsrc1, send_ssrc);
}

// Test that the local SSRC is the same on sending and receiving channels if the
// receive channel is created before the send channel.
TEST_F(WebRtcVoiceEngineTestFake, SetSendSsrcAfterCreatingReceiveChannel) {
  EXPECT_TRUE(engine_.Init());
  channel_ = engine_.CreateChannel();
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));

  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(1)));
  int receive_channel_num = voe_.GetLastChannel();
  EXPECT_TRUE(channel_->AddSendStream(
      cricket::StreamParams::CreateLegacy(1234)));
  int send_channel_num = voe_.GetLastChannel();

  unsigned int ssrc = 0;
  EXPECT_EQ(0, voe_.GetLocalSSRC(send_channel_num, ssrc));
  EXPECT_EQ(1234U, ssrc);
  ssrc = 0;
  EXPECT_EQ(0, voe_.GetLocalSSRC(receive_channel_num, ssrc));
  EXPECT_EQ(1234U, ssrc);
}

// Test that we can properly receive packets.
TEST_F(WebRtcVoiceEngineTestFake, Recv) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  DeliverPacket(kPcmuFrame, sizeof(kPcmuFrame));
  EXPECT_TRUE(voe_.CheckPacket(channel_num, kPcmuFrame,
                               sizeof(kPcmuFrame)));
}

// Test that we can properly receive packets on multiple streams.
TEST_F(WebRtcVoiceEngineTestFake, RecvWithMultipleStreams) {
  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(1)));
  int channel_num1 = voe_.GetLastChannel();
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(2)));
  int channel_num2 = voe_.GetLastChannel();
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(3)));
  int channel_num3 = voe_.GetLastChannel();
  // Create packets with the right SSRCs.
  char packets[4][sizeof(kPcmuFrame)];
  for (size_t i = 0; i < ARRAY_SIZE(packets); ++i) {
    memcpy(packets[i], kPcmuFrame, sizeof(kPcmuFrame));
    talk_base::SetBE32(packets[i] + 8, i);
  }
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num1));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num2));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num3));
  DeliverPacket(packets[0], sizeof(packets[0]));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num1));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num2));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num3));
  DeliverPacket(packets[1], sizeof(packets[1]));
  EXPECT_TRUE(voe_.CheckPacket(channel_num1, packets[1],
                               sizeof(packets[1])));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num2));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num3));
  DeliverPacket(packets[2], sizeof(packets[2]));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num1));
  EXPECT_TRUE(voe_.CheckPacket(channel_num2, packets[2],
                               sizeof(packets[2])));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num3));
  DeliverPacket(packets[3], sizeof(packets[3]));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num1));
  EXPECT_TRUE(voe_.CheckNoPacket(channel_num2));
  EXPECT_TRUE(voe_.CheckPacket(channel_num3, packets[3],
                               sizeof(packets[3])));
  EXPECT_TRUE(channel_->RemoveRecvStream(3));
  EXPECT_TRUE(channel_->RemoveRecvStream(2));
  EXPECT_TRUE(channel_->RemoveRecvStream(1));
}

// Test that we properly handle failures to add a stream.
TEST_F(WebRtcVoiceEngineTestFake, AddStreamFail) {
  EXPECT_TRUE(SetupEngine());
  voe_.set_fail_create_channel(true);
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  EXPECT_FALSE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(2)));

  // In 1:1 call, we should not try to create a new channel.
  EXPECT_TRUE(channel_->SetOptions(0));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(2)));
}

// Test that AddRecvStream doesn't create new channel for 1:1 call.
TEST_F(WebRtcVoiceEngineTestFake, AddRecvStream1On1) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(1)));
  EXPECT_EQ(channel_num, voe_.GetLastChannel());
}

// Test that we properly clean up any streams that were added, even if
// not explicitly removed.
TEST_F(WebRtcVoiceEngineTestFake, StreamCleanup) {
  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(1)));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(2)));
  EXPECT_EQ(3, voe_.GetNumChannels());  // default channel + 2 added
  delete channel_;
  channel_ = NULL;
  EXPECT_EQ(0, voe_.GetNumChannels());
}

// Test that we can send DTMF properly, but only if the other side supports
// telephone-event.
TEST_F(WebRtcVoiceEngineTestFake, SendDtmf) {
  EXPECT_TRUE(SetupEngine());
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kPcmuCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_MICROPHONE));
  EXPECT_FALSE(channel_->PressDTMF(1, true));
  codecs.push_back(kTelephoneEventCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_TRUE(channel_->PressDTMF(1, true));
}

// Test that we can play a ringback tone properly in a single-stream call.
TEST_F(WebRtcVoiceEngineTestFake, PlayRingback) {
  EXPECT_TRUE(SetupEngine());
  int channel_num = voe_.GetLastChannel();
  EXPECT_EQ(0, voe_.IsPlayingFileLocally(channel_num));
  // Check we fail if no ringback tone specified.
  EXPECT_FALSE(channel_->PlayRingbackTone(0, true, true));
  EXPECT_EQ(0, voe_.IsPlayingFileLocally(channel_num));
  // Check we can set and play a ringback tone.
  EXPECT_TRUE(channel_->SetRingbackTone(kRingbackTone, strlen(kRingbackTone)));
  EXPECT_TRUE(channel_->PlayRingbackTone(0, true, true));
  EXPECT_EQ(1, voe_.IsPlayingFileLocally(channel_num));
  // Check we can stop the tone manually.
  EXPECT_TRUE(channel_->PlayRingbackTone(0, false, false));
  EXPECT_EQ(0, voe_.IsPlayingFileLocally(channel_num));
  // Check we stop the tone if a packet arrives.
  EXPECT_TRUE(channel_->PlayRingbackTone(0, true, true));
  EXPECT_EQ(1, voe_.IsPlayingFileLocally(channel_num));
  DeliverPacket(kPcmuFrame, sizeof(kPcmuFrame));
  EXPECT_EQ(0, voe_.IsPlayingFileLocally(channel_num));
}

// Test that we can play a ringback tone properly in a multi-stream call.
TEST_F(WebRtcVoiceEngineTestFake, PlayRingbackWithMultipleStreams) {
  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(1)));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(2)));
  int channel_num = voe_.GetLastChannel();
  EXPECT_EQ(0, voe_.IsPlayingFileLocally(channel_num));
  // Check we fail if no ringback tone specified.
  EXPECT_FALSE(channel_->PlayRingbackTone(2, true, true));
  EXPECT_EQ(0, voe_.IsPlayingFileLocally(channel_num));
  // Check we can set and play a ringback tone on the correct ssrc.
  EXPECT_TRUE(channel_->SetRingbackTone(kRingbackTone, strlen(kRingbackTone)));
  EXPECT_FALSE(channel_->PlayRingbackTone(77, true, true));
  EXPECT_TRUE(channel_->PlayRingbackTone(2, true, true));
  EXPECT_EQ(1, voe_.IsPlayingFileLocally(channel_num));
  // Check we can stop the tone manually.
  EXPECT_TRUE(channel_->PlayRingbackTone(2, false, false));
  EXPECT_EQ(0, voe_.IsPlayingFileLocally(channel_num));
  // Check we stop the tone if a packet arrives, but only with the right SSRC.
  EXPECT_TRUE(channel_->PlayRingbackTone(2, true, true));
  EXPECT_EQ(1, voe_.IsPlayingFileLocally(channel_num));
  // Send a packet with SSRC 1; the tone should not stop.
  DeliverPacket(kPcmuFrame, sizeof(kPcmuFrame));
  EXPECT_EQ(1, voe_.IsPlayingFileLocally(channel_num));
  // Send a packet with SSRC 2; the tone should stop.
  char packet[sizeof(kPcmuFrame)];
  memcpy(packet, kPcmuFrame, sizeof(kPcmuFrame));
  talk_base::SetBE32(packet + 8, 2);
  DeliverPacket(packet, sizeof(packet));
  EXPECT_EQ(0, voe_.IsPlayingFileLocally(channel_num));
}

// Tests creating soundclips, and make sure they come from the right engine.
TEST_F(WebRtcVoiceEngineTestFake, CreateSoundclip) {
  EXPECT_TRUE(engine_.Init());
  soundclip_ = engine_.CreateSoundclip();
  ASSERT_TRUE(soundclip_ != NULL);
  EXPECT_EQ(0, voe_.GetNumChannels());
  EXPECT_EQ(1, voe_sc_.GetNumChannels());
  int channel_num = voe_sc_.GetLastChannel();
  EXPECT_TRUE(voe_sc_.GetPlayout(channel_num));
  delete soundclip_;
  soundclip_ = NULL;
  EXPECT_EQ(0, voe_sc_.GetNumChannels());
}

// Tests playing out a fake sound.
TEST_F(WebRtcVoiceEngineTestFake, PlaySoundclip) {
  static const char kZeroes[16000] = {};
  EXPECT_TRUE(engine_.Init());
  soundclip_ = engine_.CreateSoundclip();
  ASSERT_TRUE(soundclip_ != NULL);
  EXPECT_TRUE(soundclip_->PlaySound(kZeroes, sizeof(kZeroes), 0));
}

TEST_F(WebRtcVoiceEngineTestFake, MediaEngineCallbackOnError) {
  talk_base::scoped_ptr<ChannelErrorListener> listener;
  cricket::WebRtcVoiceMediaChannel* media_channel;
  unsigned int ssrc = 0;

  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_MICROPHONE));

  media_channel = reinterpret_cast<cricket::WebRtcVoiceMediaChannel*>(channel_);
  listener.reset(new ChannelErrorListener(channel_));

  // Test on WebRtc VoE channel.
  voe_.TriggerCallbackOnError(media_channel->voe_channel(),
                              VE_SATURATION_WARNING);
  EXPECT_EQ(cricket::VoiceMediaChannel::ERROR_REC_DEVICE_SATURATION,
            listener->error());
  EXPECT_NE(-1, voe_.GetLocalSSRC(voe_.GetLastChannel(), ssrc));
  EXPECT_EQ(ssrc, listener->ssrc());

  listener->Reset();
  voe_.TriggerCallbackOnError(-1, VE_TYPING_NOISE_WARNING);
  EXPECT_EQ(cricket::VoiceMediaChannel::ERROR_REC_TYPING_NOISE_DETECTED,
            listener->error());
  EXPECT_EQ(0U, listener->ssrc());

  // Add another stream and test on that.
  ++ssrc;
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(
      ssrc)));
  listener->Reset();
  voe_.TriggerCallbackOnError(voe_.GetLastChannel(),
                              VE_SATURATION_WARNING);
  EXPECT_EQ(cricket::VoiceMediaChannel::ERROR_REC_DEVICE_SATURATION,
            listener->error());
  EXPECT_EQ(ssrc, listener->ssrc());

  // Testing a non-existing channel.
  listener->Reset();
  voe_.TriggerCallbackOnError(voe_.GetLastChannel() + 2,
                              VE_SATURATION_WARNING);
  EXPECT_EQ(0, listener->error());
}

TEST_F(WebRtcVoiceEngineTestFake, TestSetPlayoutError) {
  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  std::vector<cricket::AudioCodec> codecs;
  codecs.push_back(kPcmuCodec);
  EXPECT_TRUE(channel_->SetSendCodecs(codecs));
  EXPECT_TRUE(channel_->SetSend(cricket::SEND_MICROPHONE));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(2)));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(3)));
  EXPECT_TRUE(channel_->SetPlayout(true));
  voe_.set_playout_fail_channel(voe_.GetLastChannel() - 1);
  EXPECT_TRUE(channel_->SetPlayout(false));
  EXPECT_FALSE(channel_->SetPlayout(true));
}

// Test that the Registering/Unregistering with the
// webrtcvoiceengine works as expected
TEST_F(WebRtcVoiceEngineTestFake, RegisterVoiceProcessor) {
  EXPECT_TRUE(SetupEngine());
  EXPECT_TRUE(channel_->SetOptions(cricket::OPT_CONFERENCE));
  EXPECT_TRUE(channel_->AddRecvStream(
      cricket::StreamParams::CreateLegacy(kSsrc1)));
  uint32 ssrc = 0;
  voe_.GetLocalSSRC(0, ssrc);
  cricket::FakeMediaProcessor vp_1;
  cricket::FakeMediaProcessor vp_2;

  EXPECT_TRUE(engine_.RegisterProcessor(ssrc, &vp_1, cricket::MPD_RX));
  EXPECT_TRUE(engine_.RegisterProcessor(ssrc, &vp_2, cricket::MPD_RX));
  voe_.TriggerProcessPacket(cricket::MPD_RX);
  voe_.TriggerProcessPacket(cricket::MPD_TX);

  EXPECT_TRUE(voe_.IsExternalMediaProcessorRegistered());
  EXPECT_EQ(1, vp_1.voice_frame_count());
  EXPECT_EQ(1, vp_2.voice_frame_count());

  EXPECT_TRUE(engine_.UnregisterProcessor(ssrc,
                                          &vp_2,
                                          cricket::MPD_RX));
  voe_.TriggerProcessPacket(cricket::MPD_RX);
  EXPECT_TRUE(voe_.IsExternalMediaProcessorRegistered());
  EXPECT_EQ(1, vp_2.voice_frame_count());
  EXPECT_EQ(2, vp_1.voice_frame_count());

  EXPECT_TRUE(engine_.UnregisterProcessor(ssrc,
                                          &vp_1,
                                          cricket::MPD_RX));
  voe_.TriggerProcessPacket(cricket::MPD_RX);
  EXPECT_FALSE(voe_.IsExternalMediaProcessorRegistered());
  EXPECT_EQ(2, vp_1.voice_frame_count());

  EXPECT_TRUE(engine_.RegisterProcessor(ssrc, &vp_1, cricket::MPD_TX));
  voe_.TriggerProcessPacket(cricket::MPD_RX);
  voe_.TriggerProcessPacket(cricket::MPD_TX);
  EXPECT_TRUE(voe_.IsExternalMediaProcessorRegistered());
  EXPECT_EQ(3, vp_1.voice_frame_count());

  EXPECT_TRUE(engine_.UnregisterProcessor(ssrc,
                                          &vp_1,
                                          cricket::MPD_RX_AND_TX));
  voe_.TriggerProcessPacket(cricket::MPD_TX);
  EXPECT_FALSE(voe_.IsExternalMediaProcessorRegistered());
  EXPECT_EQ(3, vp_1.voice_frame_count());
  EXPECT_TRUE(channel_->RemoveRecvStream(kSsrc1));

  // Test that after removing the recvstream we can we can still register
  // the processor. This tests the 1:1 case.
  EXPECT_TRUE(engine_.RegisterProcessor(ssrc, &vp_1, cricket::MPD_RX));
  EXPECT_TRUE(engine_.UnregisterProcessor(ssrc, &vp_1, cricket::MPD_RX_AND_TX));

  // The following tests test that FindChannelNumFromSsrc is doing
  // what we expect.
  // pick an invalid ssrc and make sure we can't register
  EXPECT_FALSE(engine_.RegisterProcessor(0,
                                         &vp_1,
                                         cricket::MPD_RX));
  EXPECT_TRUE(channel_->AddRecvStream(cricket::StreamParams::CreateLegacy(1)));
  EXPECT_TRUE(engine_.RegisterProcessor(1,
                                        &vp_1,
                                        cricket::MPD_RX));
  EXPECT_TRUE(engine_.UnregisterProcessor(1,
                                          &vp_1,
                                          cricket::MPD_RX));
  EXPECT_FALSE(engine_.RegisterProcessor(1,
                                         &vp_1,
                                         cricket::MPD_TX));
  EXPECT_TRUE(channel_->RemoveRecvStream(1));
}

// Tests for the actual WebRtc VoE library.

// Tests that the library initializes and shuts down properly.
TEST(WebRtcVoiceEngineTest, StartupShutdown) {
  cricket::WebRtcVoiceEngine engine;
  EXPECT_TRUE(engine.Init());
  cricket::VoiceMediaChannel* channel = engine.CreateChannel();
  EXPECT_TRUE(channel != NULL);
  delete channel;
  engine.Terminate();

  // Reinit to catch regression where VoiceEngineObserver reference is lost
  EXPECT_TRUE(engine.Init());
  engine.Terminate();
}

// Tests that the logging from the library is cleartext.
TEST(WebRtcVoiceEngineTest, DISABLED_HasUnencryptedLogging) {
  cricket::WebRtcVoiceEngine engine;
  talk_base::scoped_ptr<talk_base::MemoryStream> stream(
      new talk_base::MemoryStream);
  size_t size = 0;
  bool cleartext = true;
  talk_base::LogMessage::AddLogToStream(stream.get(), talk_base::LS_VERBOSE);
  engine.SetLogging(talk_base::LS_VERBOSE, "");
  EXPECT_TRUE(engine.Init());
  EXPECT_TRUE(stream->GetSize(&size));
  EXPECT_GT(size, 0U);
  engine.Terminate();
  talk_base::LogMessage::RemoveLogToStream(stream.get());
  const char* buf = stream->GetBuffer();
  for (size_t i = 0; i < size && cleartext; ++i) {
    int ch = static_cast<int>(buf[i]);
    ASSERT_GE(ch, 0) << "Out of bounds character in WebRtc VoE log: "
                     << std::hex << ch;
    cleartext = (isprint(ch) || isspace(ch));
  }
  EXPECT_TRUE(cleartext);
}

// Tests we do not see any references to a monitor thread being spun up
// when initiating the engine.
TEST(WebRtcVoiceEngineTest, HasNoMonitorThread) {
  cricket::WebRtcVoiceEngine engine;
  talk_base::scoped_ptr<talk_base::MemoryStream> stream(
      new talk_base::MemoryStream);
  talk_base::LogMessage::AddLogToStream(stream.get(), talk_base::LS_VERBOSE);
  engine.SetLogging(talk_base::LS_VERBOSE, "");
  EXPECT_TRUE(engine.Init());
  engine.Terminate();
  talk_base::LogMessage::RemoveLogToStream(stream.get());

  size_t size = 0;
  EXPECT_TRUE(stream->GetSize(&size));
  EXPECT_GT(size, 0U);
  const std::string logs(stream->GetBuffer());
  EXPECT_NE(std::string::npos, logs.find("ProcessThread"));
}

// Tests that the library is configured with the codecs we want.
TEST(WebRtcVoiceEngineTest, HasCorrectCodecs) {
  cricket::WebRtcVoiceEngine engine;
  // Check codecs by name.
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "ISAC", 16000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "ISAC", 32000, 0, 1, 0)));
  // Check that name matching is case-insensitive.
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "ILBC", 8000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "iLBC", 8000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "PCMU", 8000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "PCMA", 8000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "speex", 16000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "speex", 8000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "G722", 16000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "red", 8000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "CN", 32000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "CN", 16000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "CN", 8000, 0, 1, 0)));
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(96, "telephone-event", 8000, 0, 1, 0)));
  // Check codecs with an id by id.
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(0, "", 8000, 0, 1, 0)));   // PCMU
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(8, "", 8000, 0, 1, 0)));   // PCMA
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(9, "", 16000, 0, 1, 0)));  // G722
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(13, "", 8000, 0, 1, 0)));  // CN
  // Check sample/bitrate matching.
  EXPECT_TRUE(engine.FindCodec(
      cricket::AudioCodec(0, "PCMU", 8000, 64000, 1, 0)));
  // Check that bad codecs fail.
  EXPECT_FALSE(engine.FindCodec(cricket::AudioCodec(99, "ABCD", 0, 0, 1, 0)));
  EXPECT_FALSE(engine.FindCodec(cricket::AudioCodec(88, "", 0, 0, 1, 0)));
  EXPECT_FALSE(engine.FindCodec(cricket::AudioCodec(0, "", 0, 0, 2, 0)));
  EXPECT_FALSE(engine.FindCodec(cricket::AudioCodec(0, "", 5000, 0, 1, 0)));
  EXPECT_FALSE(engine.FindCodec(cricket::AudioCodec(0, "", 0, 5000, 1, 0)));
  // Check that there aren't any extra codecs lying around.
  EXPECT_EQ(13U, engine.codecs().size());
  // Verify the payload id of common audio codecs, including CN, ISAC, and G722.
  for (std::vector<cricket::AudioCodec>::const_iterator it =
      engine.codecs().begin(); it != engine.codecs().end(); ++it) {
    if (it->name == "CN" && it->clockrate == 16000) {
      EXPECT_EQ(105, it->id);
    } else if (it->name == "CN" && it->clockrate == 32000) {
      EXPECT_EQ(106, it->id);
    } else if (it->name == "ISAC" && it->clockrate == 16000) {
      EXPECT_EQ(103, it->id);
    } else if (it->name == "ISAC" && it->clockrate == 32000) {
      EXPECT_EQ(104, it->id);
    } else if (it->name == "G722" && it->clockrate == 16000) {
      EXPECT_EQ(9, it->id);
    } else if (it->name == "telephone-event") {
      EXPECT_EQ(126, it->id);
    } else if (it->name == "red") {
      EXPECT_EQ(127, it->id);
    }
  }

  engine.Terminate();
}

// Tests that VoE supports at least 32 channels
TEST(WebRtcVoiceEngineTest, Has32Channels) {
  cricket::WebRtcVoiceEngine engine;
  EXPECT_TRUE(engine.Init());

  cricket::VoiceMediaChannel* channels[32];
  int num_channels = 0;

  while (num_channels < ARRAY_SIZE(channels)) {
    cricket::VoiceMediaChannel* channel = engine.CreateChannel();
    if (!channel)
      break;

    channels[num_channels++] = channel;
  }

  int expected = ARRAY_SIZE(channels);
  EXPECT_EQ(expected, num_channels);

  while (num_channels > 0) {
    delete channels[--num_channels];
  }

  engine.Terminate();
}

#ifdef WIN32
// Test our workarounds to WebRtc VoE' munging of the coinit count
TEST(WebRtcVoiceEngineTest, CoInitialize) {
  cricket::WebRtcVoiceEngine* engine = new cricket::WebRtcVoiceEngine();

  // Initial refcount should be 0.
  EXPECT_EQ(S_OK, CoInitializeEx(NULL, COINIT_MULTITHREADED));

  // Engine should start even with COM already inited.
  EXPECT_TRUE(engine->Init());
  engine->Terminate();
  EXPECT_TRUE(engine->Init());
  engine->Terminate();

  // Refcount after terminate should be 1 (in reality 3); test if it is nonzero.
  EXPECT_EQ(S_FALSE, CoInitializeEx(NULL, COINIT_MULTITHREADED));
  // Decrement refcount to (hopefully) 0.
  CoUninitialize();
  CoUninitialize();
  delete engine;

  // Ensure refcount is 0.
  EXPECT_EQ(S_OK, CoInitializeEx(NULL, COINIT_MULTITHREADED));
  CoUninitialize();
}
#endif
