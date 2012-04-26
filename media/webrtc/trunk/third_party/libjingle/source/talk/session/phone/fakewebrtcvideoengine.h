/*
 * libjingle
 * Copyright 2010, Google Inc.
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

#ifndef TALK_SESSION_PHONE_FAKEWEBRTCVIDEOENGINE_H_
#define TALK_SESSION_PHONE_FAKEWEBRTCVIDEOENGINE_H_

#include <list>
#include <map>
#include <vector>

#include "talk/base/basictypes.h"
#include "talk/base/stringutils.h"
#include "talk/session/phone/codec.h"
#include "talk/session/phone/fakewebrtccommon.h"
#include "talk/session/phone/webrtcvie.h"

namespace webrtc {

bool operator==(const webrtc::VideoCodec& c1, const webrtc::VideoCodec& c2) {
  return memcmp(&c1, &c2, sizeof(c1)) == 0;
}

}

namespace cricket {

#define WEBRTC_CHECK_CAPTURER(capturer) \
  if (capturers_.find(capturer) == capturers_.end()) return -1;

#define WEBRTC_ASSERT_CAPTURER(capturer) \
  ASSERT(capturers_.find(capturer) != capturers_.end());

static const int kMinVideoBitrate = 100;
static const int kStartVideoBitrate = 300;
static const int kMaxVideoBitrate = 1000;

// WebRtc channel id and capture id share the same number space.
// This is how AddRenderer(renderId, ...) is able to tell if it is adding a
// renderer for a channel or it is adding a renderer for a capturer.
static const int kViEChannelIdBase = 0;
static const int kViEChannelIdMax = 1000;
static const int kViECaptureIdBase = 10000;  // Make sure there is a gap.
static const int kViECaptureIdMax = 11000;

class FakeWebRtcVideoEngine
    : public webrtc::ViEBase,
      public webrtc::ViECodec,
      public webrtc::ViECapture,
      public webrtc::ViENetwork,
      public webrtc::ViERender,
      public webrtc::ViERTP_RTCP,
      public webrtc::ViEImageProcess {
 public:
  struct Channel {
    Channel()
        : capture_id_(-1),
          original_channel_id_(-1),
          has_renderer_(false),
          render_started_(false),
          send(false),
          rtcp_status_(webrtc::kRtcpNone),
          key_frame_request_method_(webrtc::kViEKeyFrameRequestNone),
          tmmbr_(false),
          remb_send_(false),
          remb_receive_(false),
          nack_(false),
          hybrid_nack_fec_(false) {
      ssrcs_[0] = 0;  // default ssrc.
      memset(&send_codec, 0, sizeof(send_codec));
    }
    int capture_id_;
    int original_channel_id_;
    bool has_renderer_;
    bool render_started_;
    bool send;
    std::map<int, int> ssrcs_;
    std::string cname_;
    webrtc::ViERTCPMode rtcp_status_;
    webrtc::ViEKeyFrameRequestMethod key_frame_request_method_;
    bool tmmbr_;
    bool remb_send_;  // This channel sends video packets.
    bool remb_receive_;  // This channel receives video packets.
    bool nack_;
    bool hybrid_nack_fec_;
    std::vector<webrtc::VideoCodec> recv_codecs;
    webrtc::VideoCodec send_codec;
  };
  class Capturer : public webrtc::ViEExternalCapture {
   public:
    Capturer() : channel_id_(-1), denoising_(false) { }
    int channel_id() const { return channel_id_; }
    void set_channel_id(int channel_id) { channel_id_ = channel_id; }
    bool denoising() const { return denoising_; }
    void set_denoising(bool denoising) { denoising_ = denoising; }

    // From ViEExternalCapture
    virtual int IncomingFrame(unsigned char* videoFrame,
                              unsigned int videoFrameLength,
                              unsigned short width,
                              unsigned short height,
                              webrtc::RawVideoType videoType,
                              unsigned long long captureTime) {
      return 0;
    }
    virtual int IncomingFrameI420(
        const webrtc::ViEVideoFrameI420& video_frame,
        unsigned long long captureTime) {
      return 0;
    }

   private:
    int channel_id_;
    bool denoising_;
  };

  FakeWebRtcVideoEngine(const cricket::VideoCodec* const* codecs,
                        int num_codecs)
      : inited_(false),
        last_channel_(kViEChannelIdBase - 1),
        fail_create_channel_(false),
        last_capturer_(kViECaptureIdBase - 1),
        fail_alloc_capturer_(false),
        codecs_(codecs),
        num_codecs_(num_codecs) {
  }

  ~FakeWebRtcVideoEngine() {
    ASSERT(0 == channels_.size());
    ASSERT(0 == capturers_.size());
  }
  bool IsInited() const { return inited_; }

  int GetLastChannel() const { return last_channel_; }
  int GetNumChannels() const { return channels_.size(); }
  bool IsChannel(int channel) const {
    return (channels_.find(channel) != channels_.end());
  }
  void set_fail_create_channel(bool fail_create_channel) {
    fail_create_channel_ = fail_create_channel;
  }

  int GetLastCapturer() const { return last_capturer_; }
  int GetNumCapturers() const { return capturers_.size(); }
  void set_fail_alloc_capturer(bool fail_alloc_capturer) {
    fail_alloc_capturer_ = fail_alloc_capturer;
  }

  int GetCaptureId(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->capture_id_;
  }
  int GetOriginalChannelId(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->original_channel_id_;
  }
  bool GetHasRenderer(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->has_renderer_;
  }
  bool GetRenderStarted(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->render_started_;
  }
  bool GetSend(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->send;
  }
  int GetCaptureChannelId(int capture_id) const {
    WEBRTC_ASSERT_CAPTURER(capture_id);
    return capturers_.find(capture_id)->second->channel_id();
  }
  bool GetCaptureDenoising(int capture_id) const {
    WEBRTC_ASSERT_CAPTURER(capture_id);
    return capturers_.find(capture_id)->second->denoising();
  }
  webrtc::ViERTCPMode GetRtcpStatus(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->rtcp_status_;
  }
  webrtc::ViEKeyFrameRequestMethod GetKeyFrameRequestMethod(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->key_frame_request_method_;
  }
  bool GetTmmbrStatus(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->tmmbr_;
  }
  bool GetRembStatusReceive(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->remb_receive_;
  }
  bool GetRembStatusSend(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->remb_send_;
  }
  bool GetNackStatus(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->nack_;
  }
  bool GetHybridNackFecStatus(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->hybrid_nack_fec_;
  }
  int GetNumSsrcs(int channel) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    return channels_.find(channel)->second->ssrcs_.size();
  }
  int GetSimulcastSsrc(int channel,
                       int simulcast_idx) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    if (channels_.find(channel)->second->ssrcs_.find(simulcast_idx) ==
        channels_.find(channel)->second->ssrcs_.end()) {
      return -1;
    }
    return channels_.find(channel)->second->ssrcs_[simulcast_idx];
  }
  bool ReceiveCodecRegistered(int channel,
                              const webrtc::VideoCodec& codec) const {
    WEBRTC_ASSERT_CHANNEL(channel);
    const std::vector<webrtc::VideoCodec>& codecs =
      channels_.find(channel)->second->recv_codecs;
    return std::find(codecs.begin(), codecs.end(), codec) != codecs.end();
  };

  WEBRTC_STUB(Release, ());

  // webrtc::ViEBase
  WEBRTC_FUNC(Init, ()) {
    inited_ = true;
    return 0;
  };
  WEBRTC_STUB(SetVoiceEngine, (webrtc::VoiceEngine*));
  WEBRTC_FUNC(CreateChannel, (int& channel)) {  // NOLINT
    if (fail_create_channel_) {
      return -1;
    }
    if (kViEChannelIdMax == last_channel_) {
      return -1;
    }
    Channel* ch = new Channel();
    channels_[++last_channel_] = ch;
    channel = last_channel_;
    return 0;
  };
  WEBRTC_FUNC(CreateChannel, (int& channel, int original_channel)) {
    WEBRTC_CHECK_CHANNEL(original_channel);
    if (CreateChannel(channel) != 0) {
      return -1;
    }
    channels_[channel]->original_channel_id_ = original_channel;
    return 0;
  }
  WEBRTC_FUNC(CreateReceiveChannel, (int& channel, int original_channel)) {
    return CreateChannel(channel, original_channel);
  }
  WEBRTC_FUNC(DeleteChannel, (const int channel)) {
    WEBRTC_CHECK_CHANNEL(channel);
    delete channels_[channel];
    channels_.erase(channel);
    return 0;
  }
  WEBRTC_STUB(ConnectAudioChannel, (const int, const int));
  WEBRTC_STUB(DisconnectAudioChannel, (const int));
  WEBRTC_FUNC(StartSend, (const int channel)) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->send = true;
    return 0;
  }
  WEBRTC_FUNC(StopSend, (const int channel)) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->send = false;
    return 0;
  }
  WEBRTC_STUB(StartReceive, (const int));
  WEBRTC_STUB(StopReceive, (const int));
  WEBRTC_STUB(RegisterObserver, (webrtc::ViEBaseObserver&));
  WEBRTC_STUB(DeregisterObserver, ());
  WEBRTC_STUB(GetVersion, (char version[1024]));
  WEBRTC_STUB(LastError, ());

  // webrtc::ViECodec
  WEBRTC_FUNC(NumberOfCodecs, ()) const {
    return num_codecs_;
  };
  WEBRTC_FUNC(GetCodec, (const unsigned char list_number,
                         webrtc::VideoCodec& out_codec)) const {
    if (list_number >= NumberOfCodecs()) {
      return -1;
    }
    memset(&out_codec, 0, sizeof(out_codec));
    const cricket::VideoCodec& c(*codecs_[list_number]);
    if ("I420" == c.name) {
      out_codec.codecType = webrtc::kVideoCodecI420;
    } else if ("VP8" == c.name) {
      out_codec.codecType = webrtc::kVideoCodecVP8;
    } else if ("red" == c.name) {
      out_codec.codecType = webrtc::kVideoCodecRED;
    } else if ("ulpfec" == c.name) {
      out_codec.codecType = webrtc::kVideoCodecULPFEC;
    } else {
      out_codec.codecType = webrtc::kVideoCodecUnknown;
    }
    talk_base::strcpyn(out_codec.plName, sizeof(out_codec.plName),
                       c.name.c_str());
    out_codec.plType = c.id;
    out_codec.width = c.width;
    out_codec.height = c.height;
    out_codec.startBitrate = kStartVideoBitrate;
    out_codec.maxBitrate = kMaxVideoBitrate;
    out_codec.minBitrate = kMinVideoBitrate;
    out_codec.maxFramerate = c.framerate;
    return 0;
  };
  WEBRTC_FUNC(SetSendCodec, (const int channel,
                             const webrtc::VideoCodec& codec)) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->send_codec = codec;
    return 0;
  };
  WEBRTC_FUNC(GetSendCodec, (const int channel,
                             webrtc::VideoCodec& codec)) const {  // NOLINT
    WEBRTC_CHECK_CHANNEL(channel);
    codec = channels_.find(channel)->second->send_codec;
    return 0;
  };
  WEBRTC_FUNC(SetReceiveCodec, (const int channel,
                                const webrtc::VideoCodec& codec)) {  // NOLINT
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->recv_codecs.push_back(codec);
    return 0;
  };
  WEBRTC_STUB_CONST(GetReceiveCodec, (const int, webrtc::VideoCodec&));
  WEBRTC_STUB_CONST(GetCodecConfigParameters, (const int,
      unsigned char*, unsigned char&));
  WEBRTC_STUB(SetImageScaleStatus, (const int, const bool));
  WEBRTC_STUB_CONST(GetSendCodecStastistics, (const int,
      unsigned int&, unsigned int&));
  WEBRTC_STUB_CONST(GetReceiveCodecStastistics, (const int,
      unsigned int&, unsigned int&));
  WEBRTC_STUB_CONST(GetCodecTargetBitrate, (const int, unsigned int*));
  virtual unsigned int GetDiscardedPackets(const int channel) const {
    return 0;
  }

  WEBRTC_STUB(SetKeyFrameRequestCallbackStatus, (const int, const bool));
  WEBRTC_STUB(SetSignalKeyPacketLossStatus, (const int, const bool,
      const bool));
  WEBRTC_STUB(RegisterEncoderObserver, (const int,
      webrtc::ViEEncoderObserver&));
  WEBRTC_STUB(DeregisterEncoderObserver, (const int));
  WEBRTC_STUB(RegisterDecoderObserver, (const int,
      webrtc::ViEDecoderObserver&));
  WEBRTC_STUB(DeregisterDecoderObserver, (const int));
  WEBRTC_STUB(SendKeyFrame, (const int));
  WEBRTC_STUB(WaitForFirstKeyFrame, (const int, const bool));
  WEBRTC_STUB(SetInverseH263Logic, (int, bool));

  // webrtc::ViECapture
  WEBRTC_STUB(NumberOfCaptureDevices, ());
  WEBRTC_STUB(GetCaptureDevice, (unsigned int, char*,
      const unsigned int, char*, const unsigned int));
  WEBRTC_STUB(AllocateCaptureDevice, (const char*, const unsigned int, int&));
  WEBRTC_FUNC(AllocateExternalCaptureDevice,
              (int& capture_id, webrtc::ViEExternalCapture*& capture)) {
    if (fail_alloc_capturer_) {
      return -1;
    }
    if (kViECaptureIdMax == last_capturer_) {
      return -1;
    }
    Capturer* cap = new Capturer();
    capturers_[++last_capturer_] = cap;
    capture_id = last_capturer_;
    capture = cap;
    return 0;
  }
  WEBRTC_STUB(AllocateCaptureDevice, (webrtc::VideoCaptureModule&, int&));
  WEBRTC_FUNC(ReleaseCaptureDevice, (const int capture_id)) {
    WEBRTC_CHECK_CAPTURER(capture_id);
    delete capturers_[capture_id];
    capturers_.erase(capture_id);
    return 0;
  }
  WEBRTC_FUNC(ConnectCaptureDevice, (const int capture_id,
                                     const int channel)) {
    WEBRTC_CHECK_CHANNEL(channel);
    WEBRTC_CHECK_CAPTURER(capture_id);
    channels_[channel]->capture_id_ = capture_id;
    capturers_[capture_id]->set_channel_id(channel);
    return 0;
  }
  WEBRTC_FUNC(DisconnectCaptureDevice, (const int channel)) {
    WEBRTC_CHECK_CHANNEL(channel);
    int capture_id = channels_[channel]->capture_id_;
    WEBRTC_CHECK_CAPTURER(capture_id);
    channels_[channel]->capture_id_ = -1;
    capturers_[capture_id]->set_channel_id(-1);
    return 0;
  }
  WEBRTC_STUB(StartCapture, (const int, const webrtc::CaptureCapability&));
  WEBRTC_STUB(StopCapture, (const int));
  WEBRTC_STUB(SetRotateCapturedFrames, (const int,
      const webrtc::RotateCapturedFrame));
  WEBRTC_STUB(SetCaptureDelay, (const int, const unsigned int));
  WEBRTC_STUB(NumberOfCapabilities, (const char*, const unsigned int));
  WEBRTC_STUB(GetCaptureCapability, (const char*, const unsigned int,
      const unsigned int, webrtc::CaptureCapability&));
  WEBRTC_STUB(ShowCaptureSettingsDialogBox, (const char*, const unsigned int,
      const char*, void*, const unsigned int, const unsigned int));
  WEBRTC_STUB(GetOrientation, (const char*, webrtc::RotateCapturedFrame&));
  WEBRTC_STUB(EnableBrightnessAlarm, (const int, const bool));
  WEBRTC_STUB(RegisterObserver, (const int, webrtc::ViECaptureObserver&));
  WEBRTC_STUB(DeregisterObserver, (const int));

  // webrtc::ViENetwork
  WEBRTC_STUB(SetLocalReceiver, (const int, const unsigned short,
      const unsigned short, const char*));
  WEBRTC_STUB(GetLocalReceiver, (const int, unsigned short&,
      unsigned short&, char*));
  WEBRTC_STUB(SetSendDestination, (const int, const char*, const unsigned short,
      const unsigned short, const unsigned short, const unsigned short));
  WEBRTC_STUB(GetSendDestination, (const int, char*, unsigned short&,
      unsigned short&, unsigned short&, unsigned short&));
  WEBRTC_STUB(RegisterSendTransport, (const int, webrtc::Transport&));
  WEBRTC_STUB(DeregisterSendTransport, (const int));
  WEBRTC_STUB(ReceivedRTPPacket, (const int, const void*, const int));
  WEBRTC_STUB(ReceivedRTCPPacket, (const int, const void*, const int));
  WEBRTC_STUB(GetSourceInfo, (const int, unsigned short&, unsigned short&,
                              char*, unsigned int));
  WEBRTC_STUB(GetLocalIP, (char*, bool));
  WEBRTC_STUB(EnableIPv6, (int));
  // Not using WEBRTC_STUB due to bool return value
  virtual bool IsIPv6Enabled(int channel) { return true; }
  WEBRTC_STUB(SetSourceFilter, (const int, const unsigned short,
      const unsigned short, const char*));
  WEBRTC_STUB(GetSourceFilter, (const int, unsigned short&,
      unsigned short&, char*));
  WEBRTC_STUB(SetSendToS, (const int, const int, const bool));
  WEBRTC_STUB(GetSendToS, (const int, int&, bool&));
  WEBRTC_STUB(SetSendGQoS, (const int, const bool, const int, const int));
  WEBRTC_STUB(GetSendGQoS, (const int, bool&, int&, int&));
  WEBRTC_STUB(SetMTU, (int, unsigned int));
  WEBRTC_STUB(SetPacketTimeoutNotification, (const int, bool, int));
  WEBRTC_STUB(RegisterObserver, (const int, webrtc::ViENetworkObserver&));
  WEBRTC_STUB(SetPeriodicDeadOrAliveStatus, (const int, const bool,
    const unsigned int));
  WEBRTC_STUB(SendUDPPacket, (const int, const void*, const unsigned int,
      int&, bool));

  // webrtc::ViERender
  WEBRTC_STUB(RegisterVideoRenderModule, (webrtc::VideoRender&));
  WEBRTC_STUB(DeRegisterVideoRenderModule, (webrtc::VideoRender&));
  WEBRTC_STUB(AddRenderer, (const int, void*, const unsigned int, const float,
      const float, const float, const float));
  WEBRTC_FUNC(RemoveRenderer, (const int render_id)) {
    if (IsCapturerId(render_id)) {
      WEBRTC_CHECK_CAPTURER(render_id);
      return 0;
    } else if (IsChannelId(render_id)) {
      WEBRTC_CHECK_CHANNEL(render_id);
      channels_[render_id]->has_renderer_ = false;
      return 0;
    }
    return -1;
  }
  WEBRTC_FUNC(StartRender, (const int render_id)) {
    if (IsCapturerId(render_id)) {
      WEBRTC_CHECK_CAPTURER(render_id);
      return 0;
    } else if (IsChannelId(render_id)) {
      WEBRTC_CHECK_CHANNEL(render_id);
      channels_[render_id]->render_started_ = true;
      return 0;
    }
    return -1;
  }
  WEBRTC_FUNC(StopRender, (const int render_id)) {
    if (IsCapturerId(render_id)) {
      WEBRTC_CHECK_CAPTURER(render_id);
      return 0;
    } else if (IsChannelId(render_id)) {
      WEBRTC_CHECK_CHANNEL(render_id);
      channels_[render_id]->render_started_ = false;
      return 0;
    }
    return -1;
  }
  WEBRTC_STUB(ConfigureRender, (int, const unsigned int, const float,
      const float, const float, const float));
  WEBRTC_STUB(MirrorRenderStream, (const int, const bool, const bool,
      const bool));
  WEBRTC_FUNC(AddRenderer, (const int render_id,
                            webrtc::RawVideoType video_type,
                            webrtc::ExternalRenderer* renderer)) {
    if (IsCapturerId(render_id)) {
      WEBRTC_CHECK_CAPTURER(render_id);
      return 0;
    } else if (IsChannelId(render_id)) {
      WEBRTC_CHECK_CHANNEL(render_id);
      channels_[render_id]->has_renderer_ = true;
      return 0;
    }
    return -1;
  }

  // webrtc::ViERTP_RTCP
  WEBRTC_FUNC(SetLocalSSRC, (const int channel,
                             const unsigned int ssrc,
                             const webrtc::StreamType usage,
                             const unsigned char simulcast_idx)) {
    // default simulcast_idx is 0.
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->ssrcs_[simulcast_idx] = ssrc;
    return 0;
  }
  WEBRTC_STUB_CONST(SetRemoteSSRCType, (const int,
        const webrtc::StreamType, const unsigned int));

  WEBRTC_FUNC_CONST(GetLocalSSRC, (const int channel,
                                   unsigned int& ssrc)) {
    // ssrcs_[0] is the default local ssrc.
    WEBRTC_CHECK_CHANNEL(channel);
    ssrc = channels_.find(channel)->second->ssrcs_[0];
    return 0;
  }
  WEBRTC_STUB_CONST(GetRemoteSSRC, (const int, unsigned int&));
      WEBRTC_STUB_CONST(GetRemoteCSRCs, (const int, unsigned int*));
  WEBRTC_STUB(SetStartSequenceNumber, (const int, unsigned short));
  WEBRTC_FUNC(SetRTCPStatus,
              (const int channel, const webrtc::ViERTCPMode mode)) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->rtcp_status_ = mode;
    return 0;
  }
  WEBRTC_STUB_CONST(GetRTCPStatus, (const int, webrtc::ViERTCPMode&));
  WEBRTC_FUNC(SetRTCPCName, (const int channel,
                             const char rtcp_cname[KMaxRTCPCNameLength])) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->cname_.assign(rtcp_cname);
    return 0;
  }
  WEBRTC_FUNC_CONST(GetRTCPCName, (const int channel,
                                   char rtcp_cname[KMaxRTCPCNameLength])) {
    WEBRTC_CHECK_CHANNEL(channel);
    talk_base::strcpyn(rtcp_cname, KMaxRTCPCNameLength,
                       channels_.find(channel)->second->cname_.c_str());
    return 0;
  }
  WEBRTC_STUB_CONST(GetRemoteRTCPCName, (const int, char*));
  WEBRTC_STUB(SendApplicationDefinedRTCPPacket, (const int, const unsigned char,
      unsigned int, const char*, unsigned short));
  WEBRTC_FUNC(SetNACKStatus, (const int channel, const bool enable)) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->nack_ = enable;
    channels_[channel]->hybrid_nack_fec_ = false;
    return 0;
  }
  WEBRTC_STUB(SetFECStatus, (const int, const bool, const unsigned char,
      const unsigned char));
  WEBRTC_FUNC(SetHybridNACKFECStatus, (const int channel, const bool enable,
      const unsigned char red_type, const unsigned char fec_type)) {
    WEBRTC_CHECK_CHANNEL(channel);
    if (red_type == fec_type ||
        red_type == channels_[channel]->send_codec.plType ||
        fec_type == channels_[channel]->send_codec.plType) {
      return -1;
    }
    channels_[channel]->nack_ = false;
    channels_[channel]->hybrid_nack_fec_ = true;
    return 0;
  }
  WEBRTC_FUNC(SetKeyFrameRequestMethod,
              (const int channel,
               const webrtc::ViEKeyFrameRequestMethod method)) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->key_frame_request_method_ = method;
    return 0;
  }
  WEBRTC_FUNC(SetRembStatus, (int channel, bool send, bool receive)) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->remb_send_ = send;
    channels_[channel]->remb_receive_ = receive;
    return 0;
  }
  WEBRTC_FUNC(SetTMMBRStatus, (const int channel, const bool enable)) {
    WEBRTC_CHECK_CHANNEL(channel);
    channels_[channel]->tmmbr_ = enable;
    return 0;
  }
  WEBRTC_STUB_CONST(GetReceivedRTCPStatistics, (const int, unsigned short&,
      unsigned int&, unsigned int&, unsigned int&, int&));
  WEBRTC_STUB_CONST(GetSentRTCPStatistics, (const int, unsigned short&,
      unsigned int&, unsigned int&, unsigned int&, int&));
  WEBRTC_STUB_CONST(GetRTPStatistics, (const int, unsigned int&, unsigned int&,
      unsigned int&, unsigned int&));
  WEBRTC_STUB_CONST(GetBandwidthUsage, (const int, unsigned int&,
      unsigned int&, unsigned int&, unsigned int&));
  WEBRTC_STUB_CONST(GetEstimatedSendBandwidth, (const int, unsigned int*));
  WEBRTC_STUB_CONST(GetEstimatedReceiveBandwidth, (const int, unsigned int*));

  WEBRTC_STUB(SetRTPKeepAliveStatus, (const int, bool, const int,
      const unsigned int));
  WEBRTC_STUB_CONST(GetRTPKeepAliveStatus,
                    (const int, bool&, int&, unsigned int&));
  WEBRTC_STUB(StartRTPDump, (const int, const char*, webrtc::RTPDirections));
  WEBRTC_STUB(StopRTPDump, (const int, webrtc::RTPDirections));
  WEBRTC_STUB(RegisterRTPObserver, (const int, webrtc::ViERTPObserver&));
  WEBRTC_STUB(DeregisterRTPObserver, (const int));
  WEBRTC_STUB(RegisterRTCPObserver, (const int, webrtc::ViERTCPObserver&));
  WEBRTC_STUB(DeregisterRTCPObserver, (const int));

  // webrtc::ViEImageProcess
  WEBRTC_STUB(RegisterCaptureEffectFilter, (const int,
      webrtc::ViEEffectFilter&));
  WEBRTC_STUB(DeregisterCaptureEffectFilter, (const int));
  WEBRTC_STUB(RegisterSendEffectFilter, (const int,
      webrtc::ViEEffectFilter&));
  WEBRTC_STUB(DeregisterSendEffectFilter, (const int));
  WEBRTC_STUB(RegisterRenderEffectFilter, (const int,
      webrtc::ViEEffectFilter&));
  WEBRTC_STUB(DeregisterRenderEffectFilter, (const int));
  WEBRTC_STUB(EnableDeflickering, (const int, const bool));
  WEBRTC_FUNC(EnableDenoising, (const int capture_id, const bool denoising)) {
    WEBRTC_CHECK_CAPTURER(capture_id);
    capturers_[capture_id]->set_denoising(denoising);
    return 0;
  }
  WEBRTC_STUB(EnableColorEnhancement, (const int, const bool));

 private:
  bool IsChannelId(int id) const {
    return (id >= kViEChannelIdBase && id <= kViEChannelIdMax);
  }
  bool IsCapturerId(int id) const {
    return (id >= kViECaptureIdBase && id <= kViECaptureIdMax);
  }

  bool inited_;
  int last_channel_;
  std::map<int, Channel*> channels_;
  bool fail_create_channel_;
  int last_capturer_;
  std::map<int, Capturer*> capturers_;
  bool fail_alloc_capturer_;
  const cricket::VideoCodec* const* codecs_;
  int num_codecs_;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_FAKEWEBRTCVIDEOENGINE_H_
