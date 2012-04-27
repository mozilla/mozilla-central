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

#ifndef TALK_SESSION_PHONE_WEBRTCVIDEOENGINE_H_
#define TALK_SESSION_PHONE_WEBRTCVIDEOENGINE_H_

#include <map>
#include <vector>

#include "talk/base/scoped_ptr.h"
#include "talk/session/phone/videocommon.h"
#include "talk/session/phone/codec.h"
#include "talk/session/phone/channel.h"
#include "talk/session/phone/webrtccommon.h"
#ifdef WEBRTC_RELATIVE_PATH
#include "video_engine/include/vie_base.h"
#else
#include "third_party/webrtc/files/include/vie_base.h"
#endif  // WEBRTC_RELATIVE_PATH

namespace webrtc {
class VideoCaptureModule;
class VideoRender;
class ViEExternalCapture;
}

namespace cricket {
struct CapturedFrame;
class WebRtcVideoChannelInfo;
struct Device;
class WebRtcLocalStreamInfo;
class VideoCapturer;
class VideoFrame;
class VideoProcessor;
class VideoRenderer;
class ViETraceWrapper;
class ViEWrapper;
class VoiceMediaChannel;
class WebRtcRenderAdapter;
class WebRtcVideoMediaChannel;
class WebRtcVoiceEngine;
class WebRtcDecoderObserver;
class WebRtcEncoderObserver;

class WebRtcVideoEngine : public sigslot::has_slots<>,
                          public webrtc::ViEBaseObserver,
                          public webrtc::TraceCallback {
 public:
  // Creates the WebRtcVideoEngine with internal VideoCaptureModule.
  WebRtcVideoEngine();
  // For testing purposes. Allows the WebRtcVoiceEngine and
  // ViEWrapper to be mocks.
  // TODO: Remove the 2-arg ctor once fake tracing is implemented.
  WebRtcVideoEngine(WebRtcVoiceEngine* voice_engine,
                    ViEWrapper* vie_wrapper);
  WebRtcVideoEngine(WebRtcVoiceEngine* voice_engine,
                    ViEWrapper* vie_wrapper,
                    ViETraceWrapper* tracing);
  ~WebRtcVideoEngine();

  // Basic video engine implementation.
  bool Init();
  void Terminate();

  int GetCapabilities();
  bool SetOptions(int options);
  bool SetDefaultEncoderConfig(const VideoEncoderConfig& config);

  WebRtcVideoMediaChannel* CreateChannel(VoiceMediaChannel* voice_channel);

  const std::vector<VideoCodec>& codecs() const;
  void SetLogging(int min_sev, const char* filter);

  // If capturer is NULL, unregisters the capturer and stops capturing.
  // Otherwise sets the capturer and starts capturing.
  bool SetVideoCapturer(VideoCapturer* capturer);
  VideoCapturer* GetVideoCapturer() const;
  bool SetLocalRenderer(VideoRenderer* renderer);
  CaptureResult SetCapture(bool capture);
  sigslot::repeater2<VideoCapturer*, CaptureResult> SignalCaptureResult;
  CaptureResult UpdateCapturingState();
  bool IsCapturing() const;
  void OnFrameCaptured(VideoCapturer* capturer, const CapturedFrame* frame);

  // Set the VoiceEngine for A/V sync. This can only be called before Init.
  bool SetVoiceEngine(WebRtcVoiceEngine* voice_engine);
  // Enable the render module with timing control.
  bool EnableTimedRender();

  bool RegisterProcessor(VideoProcessor* video_processor);
  bool UnregisterProcessor(VideoProcessor* video_processor);

  // Functions called by WebRtcVideoMediaChannel.
  ViEWrapper* vie() { return vie_wrapper_.get(); }
  const VideoFormat& default_codec_format() const {
    return default_codec_format_;
  }
  int GetLastEngineError();
  bool FindCodec(const VideoCodec& in);
  bool CanSendCodec(const VideoCodec& in, const VideoCodec& current,
                    VideoCodec* out);
  void RegisterChannel(WebRtcVideoMediaChannel* channel);
  void UnregisterChannel(WebRtcVideoMediaChannel* channel);
  void ConvertToCricketVideoCodec(const webrtc::VideoCodec& in_codec,
                                  VideoCodec*  out_codec);
  bool ConvertFromCricketVideoCodec(const VideoCodec& in_codec,
                                    webrtc::VideoCodec* out_codec);
  // Check whether the supplied trace should be ignored.
  bool ShouldIgnoreTrace(const std::string& trace);
  int GetNumOfChannels();

 protected:
  // When a video processor registers with the engine.
  // SignalMediaFrame will be invoked for every video frame.
  sigslot::signal2<uint32, VideoFrame*> SignalMediaFrame;

 private:
  typedef std::vector<WebRtcVideoMediaChannel*> VideoChannels;
  struct VideoCodecPref {
    const char* name;
    int payload_type;
    int pref;
  };

  static const VideoCodecPref kVideoCodecPrefs[];
  static const VideoFormatPod kVideoFormats[];
  static const VideoFormatPod kDefaultVideoFormat;

  void Construct(ViEWrapper* vie_wrapper,
                 ViETraceWrapper* tracing,
                 WebRtcVoiceEngine* voice_engine);
  bool SetDefaultCodec(const VideoCodec& codec);
  bool RebuildCodecList(const VideoCodec& max_codec);
  void ApplyLogging(const std::string& log_filter);
  bool InitVideoEngine();
  bool SetCapturer(VideoCapturer* capturer);

  // webrtc::ViEBaseObserver implementation.
  virtual void PerformanceAlarm(const unsigned int cpu_load);
  // webrtc::TraceCallback implementation.
  virtual void Print(const webrtc::TraceLevel level, const char* trace_string,
                     const int length);

  void ClearCapturer();

  talk_base::scoped_ptr<ViEWrapper> vie_wrapper_;
  bool vie_wrapper_base_initialized_;
  talk_base::scoped_ptr<ViETraceWrapper> tracing_;
  WebRtcVoiceEngine* voice_engine_;
  int log_level_;
  talk_base::scoped_ptr<webrtc::VideoRender> render_module_;
  std::vector<VideoCodec> video_codecs_;
  VideoFormat default_codec_format_;
  bool initialized_;
  talk_base::CriticalSection channels_crit_;
  VideoChannels channels_;

  VideoCapturer* video_capturer_;
  bool capture_started_;
  int local_renderer_w_;
  int local_renderer_h_;
  VideoRenderer* local_renderer_;

  // Critical section to protect the media processor register/unregister
  // while processing a frame
  talk_base::CriticalSection signal_media_critical_;
};

class WebRtcVideoMediaChannel : public VideoMediaChannel,
                                public webrtc::Transport {
 public:
  WebRtcVideoMediaChannel(
      WebRtcVideoEngine* engine, VoiceMediaChannel* voice_channel);
  ~WebRtcVideoMediaChannel();
  bool Init();

  WebRtcVideoEngine* engine() { return engine_; }
  VoiceMediaChannel* voice_channel() { return voice_channel_; }
  int video_channel() const { return vie_channel_; }
  bool sending() const { return sending_; }

  // VideoMediaChannel implementation
  virtual bool SetRecvCodecs(const std::vector<VideoCodec> &codecs);
  virtual bool SetSendCodecs(const std::vector<VideoCodec> &codecs);
  virtual bool SetSendStreamFormat(uint32 ssrc, const VideoFormat& format);
  virtual bool SetRender(bool render);
  virtual bool SetSend(bool send);

  virtual bool AddSendStream(const StreamParams& sp);
  virtual bool RemoveSendStream(uint32 ssrc);
  virtual bool AddRecvStream(const StreamParams& sp);
  virtual bool RemoveRecvStream(uint32 ssrc);
  virtual bool SetRenderer(uint32 ssrc, VideoRenderer* renderer);
  virtual bool GetStats(VideoMediaInfo* info);
  virtual bool AddScreencast(uint32 ssrc, const ScreencastId& id, int fps) {
    return false;
  }
  virtual bool RemoveScreencast(uint32 ssrc) {
    return false;
  }
  virtual bool SendIntraFrame();
  virtual bool RequestIntraFrame();

  virtual void OnPacketReceived(talk_base::Buffer* packet);
  virtual void OnRtcpReceived(talk_base::Buffer* packet);
  virtual bool Mute(bool on);
  virtual bool SetRecvRtpHeaderExtensions(
      const std::vector<RtpHeaderExtension>& extensions) {
    return false;
  }
  virtual bool SetSendRtpHeaderExtensions(
      const std::vector<RtpHeaderExtension>& extensions) {
    return false;
  }
  virtual bool SetSendBandwidth(bool autobw, int bps);
  virtual bool SetOptions(int options);
  virtual int GetOptions() const { return options_; }
  virtual void SetInterface(NetworkInterface* iface);

  // Public functions for use by tests and other specialized code.
  uint32 send_ssrc() const { return 0; }
  bool GetRenderer(uint32 ssrc, VideoRenderer** renderer);
  bool SendFrame(uint32 ssrc, const VideoFrame* frame);

  // Thunk functions for use with HybridVideoEngine
  void OnLocalFrame(VideoCapturer* capturer, const VideoFrame* frame) {
    SendFrame(0, frame);
  }
  void OnLocalFrameFormat(VideoCapturer* capturer, const VideoFormat* format) {
  }

 protected:
  int GetLastEngineError() { return engine()->GetLastEngineError(); }
  virtual int SendPacket(int channel, const void* data, int len);
  virtual int SendRTCPPacket(int channel, const void* data, int len);

 private:
  typedef std::map<uint32, WebRtcVideoChannelInfo*> ChannelMap;


  // Creates and initializes a WebRtc video channel.
  bool ConfigureChannel(int channel_id);
  bool ConfigureReceiving(int channel_id, uint32 remote_ssrc);
  bool SetNackFec(int channel_id, int red_payload_type, int fec_payload_type);
  bool SetSendCodec(const webrtc::VideoCodec& codec,
                    int min_bitrate,
                    int start_bitrate,
                    int max_bitrate);
  void LogSendCodecChange(const std::string& reason);
  bool DropFrame() const {
    return (send_codec_.get() == NULL ||
            (send_codec_->width == 0 && send_codec_->height == 0));
  }
  // Prepares the channel with channel id |channel_id| to receive all codecs in
  // |receive_codecs_| and start receive packets.
  bool SetReceiveCodecs(int channel_id);
  // Returns the channel number that receives the stream with SSRC |ssrc|.
  int GetChannelNum(uint32 ssrc);
  // Given captured video frame size, checks if we need to reset vie send codec.
  // |reset| is set to whether resetting has happened on vie or not.
  // Returns false on error.
  bool MaybeResetVieSendCodec(int new_width, int new_height, bool* reset);
  // Call Webrtc function to start sending media on |vie_channel_|.
  // Does not affect |sending_|.
  bool StartSend();
  // Call Webrtc function to stop sending media on |vie_channel_|.
  // Does not affect |sending_|.
  bool StopSend();
  // Send with one local SSRC. Normal case.
  bool IsOneSsrcStream(const StreamParams& sp);

  WebRtcVideoEngine* engine_;
  VoiceMediaChannel* voice_channel_;
  int vie_channel_;
  int vie_capture_;
  webrtc::ViEExternalCapture* external_capture_;
  bool render_started_;
  bool muted_;  // Flag to tell if we need to mute video.

  // |send_params_| contains local stream parameters.
  talk_base::scoped_ptr<StreamParams> send_params_;
  uint32 first_receive_ssrc_;
  int send_min_bitrate_;
  int send_start_bitrate_;
  int send_max_bitrate_;
  talk_base::scoped_ptr<webrtc::VideoCodec> send_codec_;
  bool sending_;

  std::vector<webrtc::VideoCodec> receive_codecs_;
  talk_base::scoped_ptr<WebRtcEncoderObserver> encoder_observer_;
  talk_base::scoped_ptr<WebRtcLocalStreamInfo> local_stream_info_;
  int options_;

  ChannelMap mux_channels_;  // Contains all receive channels.
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_WEBRTCVIDEOENGINE_H_
