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

#ifndef TALK_SESSION_PHONE_FAKEMEDIAENGINE_H_
#define TALK_SESSION_PHONE_FAKEMEDIAENGINE_H_

#include <list>
#include <map>
#include <set>
#include <string>
#include <vector>

#include "talk/base/buffer.h"
#include "talk/session/phone/mediaengine.h"
#include "talk/session/phone/rtputils.h"

namespace cricket {

class FakeMediaEngine;
class FakeVideoEngine;
class FakeVoiceEngine;

// A common helper class that handles sending and receiving RTP/RTCP packets.
template<class Base>
class RtpHelper : public Base {
 public:
  RtpHelper()
      : options_(0),
        sending_(false),
        playout_(false),
        fail_set_send_codecs_(false),
        fail_set_recv_codecs_(false),
        send_ssrc_(0) {
  }
  const std::vector<RtpHeaderExtension>& recv_extensions() {
    return recv_extensions_;
  }
  const std::vector<RtpHeaderExtension>& send_extensions() {
    return send_extensions_;
  }
  bool sending() const { return sending_; }
  bool playout() const { return playout_; }
  const std::list<std::string>& rtp_packets() const { return rtp_packets_; }
  const std::list<std::string>& rtcp_packets() const { return rtcp_packets_; }
  int options() const { return options_; }
  const uint32 send_ssrc() { return send_ssrc_; }

  bool SendRtp(const void* data, int len) {
    if (!sending_ || !Base::network_interface_) {
      return false;
    }
    talk_base::Buffer packet(data, len, kMaxRtpPacketLen);
    return Base::network_interface_->SendPacket(&packet);
  }
  bool SendRtcp(const void* data, int len) {
    if (!Base::network_interface_) {
      return false;
    }
    talk_base::Buffer packet(data, len, kMaxRtpPacketLen);
    return Base::network_interface_->SendRtcp(&packet);
  }

  bool CheckRtp(const void* data, int len) {
    bool success = !rtp_packets_.empty();
    if (success) {
      std::string packet = rtp_packets_.front();
      rtp_packets_.pop_front();
      success = (packet == std::string(static_cast<const char*>(data), len));
    }
    return success;
  }
  bool CheckRtcp(const void* data, int len) {
    bool success = !rtcp_packets_.empty();
    if (success) {
      std::string packet = rtcp_packets_.front();
      rtcp_packets_.pop_front();
      success = (packet == std::string(static_cast<const char*>(data), len));
    }
    return success;
  }
  bool CheckNoRtp() {
    return rtp_packets_.empty();
  }
  bool CheckNoRtcp() {
    return rtcp_packets_.empty();
  }
  virtual bool SetOptions(int options) {
    options_ = options;
    return true;
  }
  virtual bool SetRecvRtpHeaderExtensions(
      const std::vector<RtpHeaderExtension>& extensions) {
    recv_extensions_ = extensions;
    return true;
  }
  virtual bool SetSendRtpHeaderExtensions(
      const std::vector<RtpHeaderExtension>& extensions) {
    send_extensions_ = extensions;
    return true;
  }
  void set_fail_set_send_codecs(bool fail) {
    fail_set_send_codecs_ = fail;
  }
  void set_fail_set_recv_codecs(bool fail) {
    fail_set_recv_codecs_ = fail;
  }
  virtual void SetSendSsrc(uint32 ssrc) {
    send_ssrc_ = ssrc;
  }

 protected:
  void set_sending(bool send) { sending_ = send; }
  void set_playout(bool playout) { playout_ = playout; }
  virtual void OnPacketReceived(talk_base::Buffer* packet) {
    rtp_packets_.push_back(std::string(packet->data(), packet->length()));
  }
  virtual void OnRtcpReceived(talk_base::Buffer* packet) {
    rtcp_packets_.push_back(std::string(packet->data(), packet->length()));
  }
  bool fail_set_send_codecs() const {
    return fail_set_send_codecs_;
  }
  bool fail_set_recv_codecs() const {
    return fail_set_recv_codecs_;
  }

 private:
  int options_;
  bool sending_;
  bool playout_;
  std::vector<RtpHeaderExtension> recv_extensions_;
  std::vector<RtpHeaderExtension> send_extensions_;
  std::list<std::string> rtp_packets_;
  std::list<std::string> rtcp_packets_;
  bool fail_set_send_codecs_;
  bool fail_set_recv_codecs_;
  uint32 send_ssrc_;
};

class FakeVoiceMediaChannel : public RtpHelper<VoiceMediaChannel> {
 public:
  typedef std::pair<int, bool> DtmfEvent;
  explicit FakeVoiceMediaChannel(FakeVoiceEngine* engine)
      : engine_(engine),
        muted_(false),
        fail_set_send_(false),
        ringback_tone_ssrc_(0),
        ringback_tone_play_(false),
        ringback_tone_loop_(false) {
    output_scalings_[0] = OutputScaling();  // For default channel.
  }
  ~FakeVoiceMediaChannel();
  const std::vector<AudioCodec>& recv_codecs() const { return recv_codecs_; }
  const std::vector<AudioCodec>& send_codecs() const { return send_codecs_; }
  const std::vector<AudioCodec>& codecs() const { return send_codecs(); }
  bool muted() const { return muted_; }
  const std::set<uint32>& streams() const { return streams_; }
  const std::vector<DtmfEvent>& dtmf_queue() const { return dtmf_queue_; }
  const std::string& rtcp_cname() const { return rtcp_cname_; }

  uint32 ringback_tone_ssrc() const { return ringback_tone_ssrc_; }
  bool ringback_tone_play() const { return ringback_tone_play_; }
  bool ringback_tone_loop() const { return ringback_tone_loop_; }

  virtual bool SetRecvCodecs(const std::vector<AudioCodec> &codecs) {
    if (fail_set_recv_codecs()) {
      // Fake the failure in SetRecvCodecs.
      return false;
    }
    recv_codecs_= codecs;
    return true;
  }
  virtual bool SetSendCodecs(const std::vector<AudioCodec> &codecs) {
    if (fail_set_send_codecs()) {
      // Fake the failure in SetSendCodecs.
      return false;
    }
    send_codecs_= codecs;
    return true;
  }
  virtual bool SetPlayout(bool playout) {
    set_playout(playout);
    return true;
  }
  virtual bool SetSend(SendFlags flag) {
    if (fail_set_send_) {
      return false;
    }
    set_sending(flag != SEND_NOTHING);
    return true;
  }
  virtual bool SetRtcpCName(const std::string& cname) {
    rtcp_cname_ = cname;
    return true;
  }
  virtual bool SetSendBandwidth(bool autobw, int bps) { return true; }
  virtual bool Mute(bool on) {
    muted_ = on;
    return true;
  }

  virtual bool AddStream(uint32 ssrc) {
    streams_.insert(ssrc);
    output_scalings_[ssrc] = OutputScaling();
    return true;
  }
  virtual bool RemoveStream(uint32 ssrc) {
    streams_.erase(ssrc);
    output_scalings_.erase(ssrc);
    return true;
  }

  virtual bool GetActiveStreams(AudioInfo::StreamList* streams) {
    return true;
  }
  virtual int GetOutputLevel() { return 0; }

  virtual bool SetRingbackTone(const char *buf, int len) { return true; }
  virtual bool PlayRingbackTone(uint32 ssrc, bool play, bool loop) {
    ringback_tone_ssrc_ = ssrc;
    ringback_tone_play_ = play;
    ringback_tone_loop_ = loop;
    return true;
  }

  virtual bool PressDTMF(int event, bool playout) {
    dtmf_queue_.push_back(std::make_pair(event, playout));
    return true;
  }

  virtual bool SetOutputScaling(uint32 ssrc, double left, double right) {
    if (0 == ssrc) {
      std::map<uint32, OutputScaling>::iterator it;
      for (it = output_scalings_.begin(); it != output_scalings_.end(); ++it) {
        it->second.left = left;
        it->second.right = right;
      }
      return true;
    } else if (output_scalings_.find(ssrc) != output_scalings_.end()) {
      output_scalings_[ssrc].left = left;
      output_scalings_[ssrc].right = right;
      return true;
    }
    return false;
  }
  virtual bool GetOutputScaling(uint32 ssrc, double* left, double* right) {
    if (output_scalings_.find(ssrc) == output_scalings_.end()) return false;
    *left = output_scalings_[ssrc].left;
    *right = output_scalings_[ssrc].right;
    return true;
  }

  virtual bool GetStats(VoiceMediaInfo* info) { return false; }
  virtual void GetLastMediaError(uint32* ssrc,
                                 VoiceMediaChannel::Error* error) {
    *ssrc = 0;
    *error = fail_set_send_ ? VoiceMediaChannel::ERROR_REC_DEVICE_OPEN_FAILED
        : VoiceMediaChannel::ERROR_NONE;
  }

  void set_fail_set_send(bool fail) { fail_set_send_ = fail; }
  void TriggerError(uint32 ssrc, VoiceMediaChannel::Error error) {
    VoiceMediaChannel::SignalMediaError(ssrc, error);
  }

 private:
  struct OutputScaling {
    OutputScaling() : left(1.0), right(1.0) {}
    double left, right;
  };

  FakeVoiceEngine* engine_;
  std::vector<AudioCodec> recv_codecs_;
  std::vector<AudioCodec> send_codecs_;
  bool muted_;
  std::set<uint32> streams_;
  std::map<uint32, OutputScaling> output_scalings_;
  std::vector<DtmfEvent> dtmf_queue_;
  std::string rtcp_cname_;
  bool fail_set_send_;
  uint32 ringback_tone_ssrc_;
  bool ringback_tone_play_;
  bool ringback_tone_loop_;
};

class FakeVideoMediaChannel : public RtpHelper<VideoMediaChannel> {
 public:
  explicit FakeVideoMediaChannel(FakeVideoEngine* engine)
      : engine_(engine),
        muted_(false),
        screen_casting_(false),
        sent_intra_frame_(false),
        requested_intra_frame_(false) {
  }
  ~FakeVideoMediaChannel();

  const std::vector<VideoCodec>& recv_codecs() const { return recv_codecs_; }
  const std::vector<VideoCodec>& send_codecs() const { return send_codecs_; }
  const std::vector<VideoCodec>& codecs() const { return send_codecs(); }
  bool muted() const { return muted_; }
  bool rendering() const { return playout(); }
  const std::map<uint32, VideoRenderer*>& streams() const { return streams_; }
  const std::string rtcp_cname() const { return rtcp_cname_; }

  virtual bool SetRecvCodecs(const std::vector<VideoCodec>& codecs) {
    if (fail_set_recv_codecs()) {
      // Fake the failure in SetRecvCodecs.
      return false;
    }
    recv_codecs_= codecs;
    return true;
  }
  virtual bool SetSendCodecs(const std::vector<VideoCodec>& codecs) {
    if (fail_set_send_codecs()) {
      // Fake the failure in SetSendCodecs.
      return false;
    }
    send_codecs_= codecs;
    return true;
  }
  virtual bool SetRender(bool render) {
    set_playout(render);
    return true;
  }
  virtual bool SetRenderer(uint32 ssrc, VideoRenderer* r) {
    if (ssrc != 0 && streams_.find(ssrc) == streams_.end()) {
      return false;
    }
    if (ssrc != 0) {
      streams_[ssrc] = r;
    }
    return true;
  }

  virtual bool SetSend(bool send) {
    set_sending(send);
    return true;
  }
  virtual bool AddScreencast(uint32 ssrc, talk_base::WindowId id) {
    screen_casting_ = true;
    return true;
  }
  virtual bool RemoveScreencast(uint32 ssrc) {
    screen_casting_ = false;
    return true;
  }
  virtual bool SetRtcpCName(const std::string& cname) {
    rtcp_cname_ = cname;
    return true;
  }
  virtual bool SetSendBandwidth(bool autobw, int bps) { return true; }
  virtual bool Mute(bool on) {
    muted_ = on;
    return true;
  }

  virtual bool AddStream(uint32 ssrc, uint32 voice_ssrc) {
    if (streams_.find(ssrc) != streams_.end()) {
      return false;
    }
    streams_[ssrc] = NULL;
    return true;
  }
  virtual bool RemoveStream(uint32 ssrc) {
    streams_.erase(ssrc);
    return true;
  }

  virtual bool GetStats(VideoMediaInfo* info) { return false; }
  virtual bool SendIntraFrame() {
    sent_intra_frame_= true;
    return true;
  }
  virtual bool RequestIntraFrame() {
    requested_intra_frame_ = true;
    return true;
  }
  void set_sent_intra_frame(bool v) { sent_intra_frame_ = v; }
  bool sent_intra_frame() const { return sent_intra_frame_; }
  void set_requested_intra_frame(bool v) { requested_intra_frame_ = v; }
  bool requested_intra_frame() const { return requested_intra_frame_; }

  bool IsScreencasting() {
    return screen_casting_;
  }

 private:
  FakeVideoEngine* engine_;
  std::vector<VideoCodec> recv_codecs_;
  std::vector<VideoCodec> send_codecs_;
  std::map<uint32, VideoRenderer*> streams_;
  bool muted_;
  bool screen_casting_;
  std::string rtcp_cname_;
  bool sent_intra_frame_;
  bool requested_intra_frame_;
};

class FakeSoundclipMedia : public SoundclipMedia {
 public:
  virtual bool PlaySound(const char *buf, int len, int flags) {
    return true;
  }
};

// A base class for all of the shared parts between FakeVoiceEngine
// and FakeVideoEngine.
class FakeBaseEngine {
 public:
  FakeBaseEngine()
      : loglevel_(-1),
        options_(0),
        options_changed_(false),
        fail_create_channel_(false) {
  }

  bool Init() { return true; }
  void Terminate() {}

  bool SetOptions(int options) {
    options_ = options;
    options_changed_ = true;
    return true;
  }

  void SetLogging(int level, const char* filter) {
    loglevel_ = level;
    logfilter_ = filter;
  }

  void set_fail_create_channel(bool fail) { fail_create_channel_ = fail; }

 protected:
  int loglevel_;
  std::string logfilter_;
  int options_;
  // Flag used by optionsmessagehandler_unittest for checking whether any
  // relevant setting has been updated.
  // TODO: Replace with explicit checks of before & after values.
  bool options_changed_;
  bool fail_create_channel_;
};

class FakeVoiceEngine : public FakeBaseEngine {
 public:
  FakeVoiceEngine()
      : output_volume_(-1),
        rx_processor_(NULL),
        tx_processor_(NULL) {
  }

  int GetCapabilities() {
    return AUDIO_SEND | AUDIO_RECV;
  }

  VoiceMediaChannel* CreateChannel() {
    if (fail_create_channel_) {
      return NULL;
    }

    FakeVoiceMediaChannel* ch = new FakeVoiceMediaChannel(this);
    channels_.push_back(ch);
    return ch;
  }
  FakeVoiceMediaChannel* GetChannel(size_t index) {
    return (channels_.size() > index) ? channels_[index] : NULL;
  }
  void UnregisterChannel(VoiceMediaChannel* channel) {
    channels_.erase(std::find(channels_.begin(), channels_.end(), channel));
  }
  SoundclipMedia* CreateSoundclip() {
    return new FakeSoundclipMedia();
  }

  const std::vector<AudioCodec>& codecs() {
    return codecs_;
  }
  void SetCodecs(const std::vector<AudioCodec> codecs) {
    codecs_ = codecs;
  }

  bool SetDevices(const Device* in_device,
                          const Device* out_device) {
    in_device_ = (in_device) ? in_device->name : "";
    out_device_ = (out_device) ? out_device->name : "";
    options_changed_ = true;
    return true;
  }

  bool GetOutputVolume(int* level) {
    *level = output_volume_;
    return true;
  }

  bool SetOutputVolume(int level) {
    output_volume_ = level;
    options_changed_ = true;
    return true;
  }

  int GetInputLevel() {
    return 0;
  }

  bool SetLocalMonitor(bool enable) {
    return true;
  }

  bool RegisterProcessor(uint32 ssrc,
                         VoiceProcessor* voice_processor,
                         MediaProcessorDirection direction) {
    if (direction == MPD_RX) {
      rx_processor_ = voice_processor;
      return true;
    } else if (direction == MPD_TX) {
      tx_processor_ = voice_processor;
      return true;
    }
    return false;
  }

  bool UnregisterProcessor(uint32 ssrc,
                           VoiceProcessor* voice_processor,
                           MediaProcessorDirection direction) {
    bool unregistered = false;
    if (direction & MPD_RX) {
      rx_processor_ = NULL;
      unregistered = true;
    }
    if (direction & MPD_TX) {
      tx_processor_ = NULL;
      unregistered = true;
    }
    return unregistered;
  }

 private:
  std::vector<FakeVoiceMediaChannel*> channels_;
  std::vector<AudioCodec> codecs_;
  int output_volume_;
  std::string in_device_;
  std::string out_device_;
  VoiceProcessor* rx_processor_;
  VoiceProcessor* tx_processor_;

  friend class FakeMediaEngine;
};

class FakeVideoEngine : public FakeBaseEngine {
 public:
  FakeVideoEngine()
      : renderer_(NULL),
        capture_(false),
        processor_(NULL) {
  }

  int GetCapabilities() {
    return VIDEO_SEND | VIDEO_RECV;
  }
  bool SetDefaultEncoderConfig(const VideoEncoderConfig& config) {
    default_encoder_config_ = config;
    return true;
  }
  const VideoEncoderConfig& default_encoder_config() const {
    return default_encoder_config_;
  }

  VideoMediaChannel* CreateChannel(VoiceMediaChannel* channel) {
    if (fail_create_channel_) {
      return NULL;
    }

    FakeVideoMediaChannel* ch = new FakeVideoMediaChannel(this);
    channels_.push_back(ch);
    return ch;
  }
  FakeVideoMediaChannel* GetChannel(size_t index) {
    return (channels_.size() > index) ? channels_[index] : NULL;
  }
  void UnregisterChannel(VideoMediaChannel* channel) {
    channels_.erase(std::find(channels_.begin(), channels_.end(), channel));
  }

  const std::vector<VideoCodec>& codecs() {
    return codecs_;
  }
  bool FindCodec(const VideoCodec& in) {
    for (size_t i = 0; i < codecs_.size(); ++i) {
      if (codecs_[i].Matches(in)) {
        return true;
      }
    }
    return false;
  }
  void SetCodecs(const std::vector<VideoCodec> codecs) {
    codecs_ = codecs;
  }

  bool SetCaptureDevice(const Device* device) {
    in_device_ = (device) ? device->name : "";
    options_changed_ = true;
    return true;
  }
  bool SetLocalRenderer(VideoRenderer* r) {
    renderer_ = r;
    return true;
  }
  bool SetVideoCapturer(VideoCapturer* /*capturer*/, uint32 /*ssrc*/) {
    return false;
  }
  CaptureResult SetCapture(bool capture) {
    capture_ = capture;
    return CR_SUCCESS;
  }
  bool RegisterProcessor(VideoProcessor* video_processor) {
    processor_ = video_processor;
    return true;
  }

  bool UnregisterProcessor(VideoProcessor* video_processor) {
    processor_ = NULL;
    return true;
  }

  sigslot::signal2<VideoCapturer*, CaptureResult> SignalCaptureResult;

 private:
  std::vector<FakeVideoMediaChannel*> channels_;
  std::vector<VideoCodec> codecs_;
  VideoEncoderConfig default_encoder_config_;
  std::string in_device_;
  VideoRenderer* renderer_;
  bool capture_;
  VideoProcessor* processor_;

  friend class FakeMediaEngine;
};

class FakeMediaEngine
    : public CompositeMediaEngine<FakeVoiceEngine, FakeVideoEngine> {
 public:
  FakeMediaEngine() {
    voice_ = FakeVoiceEngine();
    video_ = FakeVideoEngine();
  }
  virtual ~FakeMediaEngine() {}

  virtual void SetAudioCodecs(const std::vector<AudioCodec> codecs) {
    voice_.SetCodecs(codecs);
  }

  virtual void SetVideoCodecs(const std::vector<VideoCodec> codecs) {
    video_.SetCodecs(codecs);
  }

  FakeVoiceMediaChannel* GetVoiceChannel(size_t index) {
    return voice_.GetChannel(index);
  }

  FakeVideoMediaChannel* GetVideoChannel(size_t index) {
    return video_.GetChannel(index);
  }

  int audio_options() const { return voice_.options_; }
  int output_volume() const { return voice_.output_volume_; }
  const VideoEncoderConfig& default_video_encoder_config() const {
    return video_.default_encoder_config_;
  }
  const std::string& audio_in_device() const { return voice_.in_device_; }
  const std::string& audio_out_device() const { return voice_.out_device_; }
  const std::string& video_in_device() const { return video_.in_device_; }
  VideoRenderer* local_renderer() { return video_.renderer_; }
  int voice_loglevel() const { return voice_.loglevel_; }
  const std::string& voice_logfilter() const { return voice_.logfilter_; }
  int video_loglevel() const { return video_.loglevel_; }
  const std::string& video_logfilter() const { return video_.logfilter_; }
  bool capture() const { return video_.capture_; }
  bool options_changed() const {
    return voice_.options_changed_ || video_.options_changed_;
  }
  void clear_options_changed() {
    video_.options_changed_ = false;
    voice_.options_changed_ = false;
  }
  void set_fail_create_channel(bool fail) {
    voice_.set_fail_create_channel(fail);
    video_.set_fail_create_channel(fail);
  }
  bool video_processor_registered () const {return video_.processor_ != NULL;}
  bool voice_processor_registered(MediaProcessorDirection direction) const {
    if (direction == MPD_RX) {
      return voice_.rx_processor_ != NULL;
    } else if (direction == MPD_TX) {
      return voice_.tx_processor_ != NULL;
    }
    return false;
  }
};

// CompositeMediaEngine with FakeVoiceEngine to expose SetAudioCodecs to
// establish a media connectionwith minimum set of audio codes required
template<class VIDEO>
class CompositeMediaEngineWithFakeVoiceEngine
    : public CompositeMediaEngine<FakeVoiceEngine, VIDEO> {
 public:
  CompositeMediaEngineWithFakeVoiceEngine() {}
  virtual ~CompositeMediaEngineWithFakeVoiceEngine() {}

  virtual void SetAudioCodecs(const std::vector<AudioCodec>& codecs) {
    CompositeMediaEngine<FakeVoiceEngine, VIDEO>::voice_.SetCodecs(codecs);
  }
};

// Have to come afterwards due to declaration order
inline FakeVoiceMediaChannel::~FakeVoiceMediaChannel() {
  if (engine_) {
    engine_->UnregisterChannel(this);
  }
}

inline FakeVideoMediaChannel::~FakeVideoMediaChannel() {
  if (engine_) {
    engine_->UnregisterChannel(this);
  }
}

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_FAKEMEDIAENGINE_H_
