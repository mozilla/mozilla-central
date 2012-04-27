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

#ifdef HAVE_CONFIG_H
#include <config.h>
#endif

#ifdef HAVE_WEBRTC_VIDEO

#include "talk/session/phone/webrtcvideoengine.h"

#include "talk/base/basictypes.h"
#include "talk/base/common.h"
#include "talk/base/buffer.h"
#include "talk/base/byteorder.h"
#include "talk/base/logging.h"
#include "talk/base/stringutils.h"
#include "talk/session/phone/filevideocapturer.h"
#include "talk/session/phone/rtputils.h"
#include "talk/session/phone/streamparams.h"
#include "talk/session/phone/videorenderer.h"
#include "talk/session/phone/webrtcpassthroughrender.h"
#include "talk/session/phone/webrtcvoiceengine.h"
#include "talk/session/phone/webrtcvideocapturer.h"
#include "talk/session/phone/webrtcvideoframe.h"
#include "talk/session/phone/webrtcvie.h"
#include "talk/session/phone/webrtcvoe.h"

namespace cricket {

static const int kDefaultLogSeverity = talk_base::LS_WARNING;

static const int kMinVideoBitrate = 100;
static const int kStartVideoBitrate = 300;
static const int kMaxVideoBitrate = 2000;
static const int kDefaultConferenceModeMaxVideoBitrate = 500;

static const int kVideoMtu = 1200;

static const int kVideoRtpBufferSize = 65536;

static const char kVp8PayloadName[] = "VP8";
static const char kRedPayloadName[] = "red";
static const char kFecPayloadName[] = "ulpfec";

static const int kDefaultNumberOfTemporalLayers = 3;

static void LogMultiline(talk_base::LoggingSeverity sev, char* text) {
  const char* delim = "\r\n";
  for (char* tok = strtok(text, delim); tok; tok = strtok(NULL, delim)) {
    LOG_V(sev) << tok;
  }
}

static const bool kRembNotSending = false;
static const bool kRembSending = true;
// static const bool kRembNotReceiving = false;  // Not used for now.
static const bool kRembReceiving = true;

class WebRtcRenderAdapter : public webrtc::ExternalRenderer {
 public:
  explicit WebRtcRenderAdapter(VideoRenderer* renderer)
      : renderer_(renderer), width_(0), height_(0) {
  }
  virtual ~WebRtcRenderAdapter() {
  }

  void SetRenderer(VideoRenderer* renderer) {
    talk_base::CritScope cs(&crit_);
    renderer_ = renderer;
    // FrameSizeChange may have already been called when renderer was not set.
    // If so we should call SetSize here.
    // TODO: Add unit test for this case. Didn't do it now
    // because the WebRtcRenderAdapter is currently hiding in cc file. No
    // good way to get access to it from the unit test.
    if (width_ > 0 && height_ > 0 && renderer_ != NULL) {
      if (!renderer_->SetSize(width_, height_, 0)) {
        LOG(LS_ERROR)
            << "WebRtcRenderAdapter SetRenderer failed to SetSize to: "
            << width_ << "x" << height_;
      }
    }
  }
  // Implementation of webrtc::ExternalRenderer.
  virtual int FrameSizeChange(unsigned int width, unsigned int height,
                              unsigned int /*number_of_streams*/) {
    talk_base::CritScope cs(&crit_);
    width_ = width;
    height_ = height;
    LOG(LS_INFO) << "WebRtcRenderAdapter frame size changed to: "
                 << width << "x" << height;
    if (renderer_ == NULL) {
      LOG(LS_VERBOSE) << "WebRtcRenderAdapter the renderer has not been set. "
                      << "SetSize will be called later in SetRenderer.";
      return 0;
    }
    return renderer_->SetSize(width_, height_, 0) ? 0 : -1;
  }
  virtual int DeliverFrame(unsigned char* buffer, int buffer_size,
                           uint32_t time_stamp, int64_t render_time) {
    talk_base::CritScope cs(&crit_);
    frame_rate_tracker_.Update(1);
    if (renderer_ == NULL) {
      return 0;
    }
    WebRtcVideoFrame video_frame;
    // Convert 90K rtp timestamp to ns timestamp.
    int64 rtp_time_stamp_in_ns = (time_stamp / 90) *
        talk_base::kNumNanosecsPerMillisec;
    // Convert milisecond render time to ns timestamp.
    int64 render_time_stamp_in_ns = render_time *
        talk_base::kNumNanosecsPerMillisec;
    // Send the rtp timestamp to renderer as the VideoFrame timestamp.
    // and the render timestamp as the VideoFrame elapsed_time.
    video_frame.Attach(buffer, buffer_size, width_, height_,
                       1, 1, render_time_stamp_in_ns,
                       rtp_time_stamp_in_ns, 0);


    // Sanity check on decoded frame size.
    if (buffer_size != static_cast<int>(VideoFrame::SizeOf(width_, height_))) {
      LOG(LS_WARNING) << "WebRtcRenderAdapter received a strange frame size: "
                      << buffer_size;
    }

    int ret = renderer_->RenderFrame(&video_frame) ? 0 : -1;
    uint8* buffer_temp;
    size_t buffer_size_temp;
    video_frame.Detach(&buffer_temp, &buffer_size_temp);
    return ret;
  }

  unsigned int width() {
    talk_base::CritScope cs(&crit_);
    return width_;
  }
  unsigned int height() {
    talk_base::CritScope cs(&crit_);
    return height_;
  }
  int framerate() {
    talk_base::CritScope cs(&crit_);
    return frame_rate_tracker_.units_second();
  }
  VideoRenderer* renderer() {
    talk_base::CritScope cs(&crit_);
    return renderer_;
  }

 private:
  talk_base::CriticalSection crit_;
  VideoRenderer* renderer_;
  unsigned int width_;
  unsigned int height_;
  talk_base::RateTracker frame_rate_tracker_;
};

class WebRtcDecoderObserver : public webrtc::ViEDecoderObserver {
 public:
  explicit WebRtcDecoderObserver(int video_channel)
       : video_channel_(video_channel),
         framerate_(0),
         bitrate_(0),
         firs_requested_(0) {
  }

  // virtual functions from VieDecoderObserver.
  virtual void IncomingCodecChanged(const int videoChannel,
                                    const webrtc::VideoCodec& videoCodec) {}
  virtual void IncomingRate(const int videoChannel,
                            const unsigned int framerate,
                            const unsigned int bitrate) {
    ASSERT(video_channel_ == videoChannel);
    framerate_ = framerate;
    bitrate_ = bitrate;
  }
  virtual void RequestNewKeyFrame(const int videoChannel) {
    ASSERT(video_channel_ == videoChannel);
    ++firs_requested_;
  }

  int framerate() const { return framerate_; }
  int bitrate() const { return bitrate_; }
  int firs_requested() const { return firs_requested_; }

 private:
  int video_channel_;
  int framerate_;
  int bitrate_;
  int firs_requested_;
};

class WebRtcEncoderObserver : public webrtc::ViEEncoderObserver {
 public:
  explicit WebRtcEncoderObserver(int video_channel)
      : video_channel_(video_channel),
        framerate_(0),
        bitrate_(0) {
  }

  // virtual functions from VieEncoderObserver.
  virtual void OutgoingRate(const int videoChannel,
                            const unsigned int framerate,
                            const unsigned int bitrate) {
    ASSERT(video_channel_ == videoChannel);
    framerate_ = framerate;
    bitrate_ = bitrate;
  }

  int framerate() const { return framerate_; }
  int bitrate() const { return bitrate_; }

 private:
  int video_channel_;
  int framerate_;
  int bitrate_;
};

class WebRtcLocalStreamInfo {
 public:
  int width() {
    talk_base::CritScope cs(&crit_);
    return width_;
  }
  int height() {
    talk_base::CritScope cs(&crit_);
    return height_;
  }
  int framerate() {
    talk_base::CritScope cs(&crit_);
    return rate_tracker_.units_second();
  }

  void UpdateFrame(int width, int height) {
    talk_base::CritScope cs(&crit_);
    width_ = width;
    height_ = height;
    rate_tracker_.Update(1);
  }

 private:
  talk_base::CriticalSection crit_;
  unsigned int width_;
  unsigned int height_;
  talk_base::RateTracker rate_tracker_;
};

// WebRtcVideoChannelInfo is a container class with members such as renderer
// and a decoder observer that is used by receive channels.
// It must exist as long as the receive channel is connected to renderer or a
// decoder observer in this class and methods in the class should only be called
// from the worker thread.
class WebRtcVideoChannelInfo  {
 public:
  explicit WebRtcVideoChannelInfo(int channel_id)
      : channel_id_(channel_id),
        render_adapter_(NULL),
        decoder_observer_(channel_id) {
  }
  int channel_id() { return channel_id_; }
  void SetRenderer(VideoRenderer* renderer) {
    render_adapter_.SetRenderer(renderer);
  }
  WebRtcRenderAdapter* render_adapter() { return &render_adapter_; }
  WebRtcDecoderObserver* decoder_observer() { return &decoder_observer_; }

 private:
  int channel_id_;  // Webrtc video channel number.
  // Renderer for this channel.
  WebRtcRenderAdapter render_adapter_;
  WebRtcDecoderObserver decoder_observer_;
};

const WebRtcVideoEngine::VideoCodecPref
    WebRtcVideoEngine::kVideoCodecPrefs[] = {
    {kVp8PayloadName, 100, 0},
    {kRedPayloadName, 101, 1},
    {kFecPayloadName, 102, 2},
};

static const int64 kNsPerFrame = 33333333;  // 30fps

// The formats are sorted by the descending order of width. We use the order to
// find the next format for CPU and bandwidth adaptation.
const VideoFormatPod WebRtcVideoEngine::kVideoFormats[] = {
  {1280, 800, kNsPerFrame, FOURCC_ANY},
  {1280, 720, kNsPerFrame, FOURCC_ANY},
  {960, 600, kNsPerFrame, FOURCC_ANY},
  {960, 540, kNsPerFrame, FOURCC_ANY},
  {640, 400, kNsPerFrame, FOURCC_ANY},
  {640, 360, kNsPerFrame, FOURCC_ANY},
  {640, 480, kNsPerFrame, FOURCC_ANY},
  {480, 300, kNsPerFrame, FOURCC_ANY},
  {480, 270, kNsPerFrame, FOURCC_ANY},
  {480, 360, kNsPerFrame, FOURCC_ANY},
  {320, 200, kNsPerFrame, FOURCC_ANY},
  {320, 180, kNsPerFrame, FOURCC_ANY},
  {320, 240, kNsPerFrame, FOURCC_ANY},
  {240, 150, kNsPerFrame, FOURCC_ANY},
  {240, 135, kNsPerFrame, FOURCC_ANY},
  {240, 180, kNsPerFrame, FOURCC_ANY},
  {160, 100, kNsPerFrame, FOURCC_ANY},
  {160, 90, kNsPerFrame, FOURCC_ANY},
  {160, 120, kNsPerFrame, FOURCC_ANY},
};

const VideoFormatPod WebRtcVideoEngine::kDefaultVideoFormat =
    {640, 400, kNsPerFrame, FOURCC_ANY};

WebRtcVideoEngine::WebRtcVideoEngine() {
  Construct(new ViEWrapper(), new ViETraceWrapper(), NULL);
}

WebRtcVideoEngine::WebRtcVideoEngine(WebRtcVoiceEngine* voice_engine,
                                     ViEWrapper* vie_wrapper) {
  Construct(vie_wrapper, new ViETraceWrapper(), voice_engine);
}

WebRtcVideoEngine::WebRtcVideoEngine(WebRtcVoiceEngine* voice_engine,
                                     ViEWrapper* vie_wrapper,
                                     ViETraceWrapper* tracing) {
  Construct(vie_wrapper, tracing, voice_engine);
}

void WebRtcVideoEngine::Construct(ViEWrapper* vie_wrapper,
                                  ViETraceWrapper* tracing,
                                  WebRtcVoiceEngine* voice_engine) {
  LOG(LS_INFO) << "WebRtcVideoEngine::WebRtcVideoEngine";
  vie_wrapper_.reset(vie_wrapper);
  vie_wrapper_base_initialized_ = false;
  tracing_.reset(tracing);
  voice_engine_ = voice_engine;
  initialized_ = false;
  log_level_ = kDefaultLogSeverity;
  render_module_.reset(new WebRtcPassthroughRender());
  local_renderer_w_ = local_renderer_h_ = 0;
  local_renderer_ = NULL;
  video_capturer_ = NULL;
  capture_started_ = false;

  ApplyLogging("");
  if (tracing_->SetTraceCallback(this) != 0) {
    LOG_RTCERR1(SetTraceCallback, this);
  }

  // Set default quality levels for our supported codecs. We override them here
  // if we know your cpu performance is low, and they can be updated explicitly
  // by calling SetDefaultCodec.  For example by a flute preference setting, or
  // by the server with a jec in response to our reported system info.
  VideoCodec max_codec(kVideoCodecPrefs[0].payload_type,
                       kVideoCodecPrefs[0].name,
                       kDefaultVideoFormat.width,
                       kDefaultVideoFormat.height,
                       VideoFormat::IntervalToFps(kDefaultVideoFormat.interval),
                       0);
  if (!SetDefaultCodec(max_codec)) {
    LOG(LS_ERROR) << "Failed to initialize list of supported codec types";
  }
}

WebRtcVideoEngine::~WebRtcVideoEngine() {
  ClearCapturer();
  LOG(LS_INFO) << "WebRtcVideoEngine::~WebRtcVideoEngine";
  if (initialized_) {
    Terminate();
  }
  tracing_->SetTraceCallback(NULL);
  // Test to see if the media processor was deregistered properly.
  ASSERT(SignalMediaFrame.is_empty());
}

bool WebRtcVideoEngine::Init() {
  LOG(LS_INFO) << "WebRtcVideoEngine::Init";
  bool result = InitVideoEngine();
  if (result) {
    LOG(LS_INFO) << "VideoEngine Init done";
  } else {
    LOG(LS_ERROR) << "VideoEngine Init failed, releasing";
    Terminate();
  }
  return result;
}

bool WebRtcVideoEngine::InitVideoEngine() {
  LOG(LS_INFO) << "WebRtcVideoEngine::InitVideoEngine";

  // Init WebRTC VideoEngine.
  if (!vie_wrapper_base_initialized_) {
    if (vie_wrapper_->base()->Init() != 0) {
      LOG_RTCERR0(Init);
      return false;
    }
    vie_wrapper_base_initialized_ = true;
  }

  // Log the VoiceEngine version info.
  char buffer[1024] = "";
  if (vie_wrapper_->base()->GetVersion(buffer) != 0) {
    LOG_RTCERR0(GetVersion);
    return false;
  }

  LOG(LS_INFO) << "WebRtc VideoEngine Version:";
  LogMultiline(talk_base::LS_INFO, buffer);

  // Hook up to VoiceEngine for sync purposes, if supplied.
  if (!voice_engine_) {
    LOG(LS_WARNING) << "NULL voice engine";
  } else if ((vie_wrapper_->base()->SetVoiceEngine(
      voice_engine_->voe()->engine())) != 0) {
    LOG_RTCERR0(SetVoiceEngine);
    return false;
  }

  // Register for callbacks from the engine.
  if ((vie_wrapper_->base()->RegisterObserver(*this)) != 0) {
    LOG_RTCERR0(RegisterObserver);
    return false;
  }

  // Register our custom render module.
  if (vie_wrapper_->render()->RegisterVideoRenderModule(
      *render_module_.get()) != 0) {
    LOG_RTCERR0(RegisterVideoRenderModule);
    return false;
  }

  initialized_ = true;
  return true;
}

void WebRtcVideoEngine::Terminate() {
  LOG(LS_INFO) << "WebRtcVideoEngine::Terminate";
  initialized_ = false;
  SetCapture(false);

  if (vie_wrapper_->render()->DeRegisterVideoRenderModule(
      *render_module_.get()) != 0) {
    LOG_RTCERR0(DeRegisterVideoRenderModule);
  }

  if (vie_wrapper_->base()->DeregisterObserver() != 0) {
    LOG_RTCERR0(DeregisterObserver);
  }

  if (vie_wrapper_->base()->SetVoiceEngine(NULL) != 0) {
    LOG_RTCERR0(SetVoiceEngine);
  }
}

int WebRtcVideoEngine::GetCapabilities() {
  return VIDEO_RECV | VIDEO_SEND;
}

bool WebRtcVideoEngine::SetOptions(int options) {
  return true;
}

bool WebRtcVideoEngine::SetDefaultEncoderConfig(
    const VideoEncoderConfig& config) {
  return SetDefaultCodec(config.max_codec);
}

// SetDefaultCodec may be called while the capturer is running. For example, a
// test call is started in a page with QVGA default codec, and then a real call
// is started in another page with VGA default codec. This is the corner case
// and happens only when a session is started. We ignore this case currently.
bool WebRtcVideoEngine::SetDefaultCodec(const VideoCodec& codec) {
  if (!RebuildCodecList(codec)) {
    LOG(LS_WARNING) << "Failed to RebuildCodecList";
    return false;
  }

  default_codec_format_ = VideoFormat(
      video_codecs_[0].width,
      video_codecs_[0].height,
      VideoFormat::FpsToInterval(video_codecs_[0].framerate),
      FOURCC_ANY);
  return true;
}

WebRtcVideoMediaChannel* WebRtcVideoEngine::CreateChannel(
    VoiceMediaChannel* voice_channel) {
  WebRtcVideoMediaChannel* channel =
      new WebRtcVideoMediaChannel(this, voice_channel);
  if (!channel->Init()) {
    delete channel;
    channel = NULL;
  }
  return channel;
}

bool WebRtcVideoEngine::SetVideoCapturer(VideoCapturer* capturer) {
  return SetCapturer(capturer);
}

VideoCapturer* WebRtcVideoEngine::GetVideoCapturer() const {
  return video_capturer_;
}

bool WebRtcVideoEngine::SetLocalRenderer(VideoRenderer* renderer) {
  local_renderer_w_ = local_renderer_h_ = 0;
  local_renderer_ = renderer;
  return true;
}

CaptureResult WebRtcVideoEngine::SetCapture(bool capture) {
  bool old_capture = capture_started_;
  capture_started_ = capture;
  CaptureResult res = UpdateCapturingState();
  if (res != CR_SUCCESS && res != CR_PENDING) {
    capture_started_ = old_capture;
  }
  return res;
}

CaptureResult WebRtcVideoEngine::UpdateCapturingState() {
  CaptureResult result = CR_SUCCESS;

  bool capture = capture_started_;
  if (!IsCapturing() && capture) {  // Start capturing.
    if (video_capturer_ == NULL) {
      return CR_NO_DEVICE;
    }

    VideoFormat capture_format;
    if (!video_capturer_->GetBestCaptureFormat(default_codec_format_,
                                               &capture_format)) {
      LOG(LS_WARNING) << "Unsupported format:"
                      << " width=" << default_codec_format_.width
                      << " height=" << default_codec_format_.height
                      << ". Supported formats are:";
      const std::vector<VideoFormat>* formats =
          video_capturer_->GetSupportedFormats();
      if (formats) {
        for (std::vector<VideoFormat>::const_iterator i = formats->begin();
             i != formats->end(); ++i) {
          const VideoFormat& format = *i;
          LOG(LS_WARNING) << "  " << GetFourccName(format.fourcc) << ":"
                          << format.width << "x" << format.height << "x"
                          << format.framerate();
        }
      }
      return CR_FAILURE;
    }

    // Start the video capturer.
    result = video_capturer_->Start(capture_format);
    if (CR_SUCCESS != result && CR_PENDING != result) {
      LOG(LS_ERROR) << "Failed to start the video capturer";
      return result;
    }
  } else if (IsCapturing() && !capture) {  // Stop capturing.
    video_capturer_->Stop();
  }

  return result;
}

bool WebRtcVideoEngine::IsCapturing() const {
  return (video_capturer_ != NULL) && video_capturer_->IsRunning();
}

void WebRtcVideoEngine::OnFrameCaptured(VideoCapturer* capturer,
                                        const CapturedFrame* frame) {
  // Force 16:10 for now. We'll be smarter with the capture refactor.
  int cropped_height = frame->width * default_codec_format_.height
      / default_codec_format_.width;
  if (cropped_height > frame->height) {
    // TODO: Once we support horizontal cropping, add cropped_width.
    cropped_height = frame->height;
  }

  // This CapturedFrame* will already be in I420. In the future, when
  // WebRtcVideoFrame has support for independent planes, we can just attach
  // to it and update the pointers when cropping.
  WebRtcVideoFrame i420_frame;
  if (!i420_frame.Init(frame, frame->width, cropped_height)) {
    LOG(LS_ERROR) << "Couldn't convert to I420! "
                  << frame->width << " x " << cropped_height;
    return;
  }

  // TODO: This is the trigger point for Tx video processing.
  // Once the capturer refactoring is done, we will move this into the
  // capturer...it's not there right now because that image is in not in the
  // I420 color space.
  // The clients that subscribe will obtain meta info from the frame.
  // When this trigger is switched over to capturer, need to pass in the real
  // ssrc.
  {
    talk_base::CritScope cs(&signal_media_critical_);
    SignalMediaFrame(kDummyVideoSsrc, &i420_frame);
  }

  // Send I420 frame to the local renderer.
  if (local_renderer_) {
    if (local_renderer_w_ != static_cast<int>(i420_frame.GetWidth()) ||
        local_renderer_h_ != static_cast<int>(i420_frame.GetHeight())) {
      local_renderer_->SetSize(local_renderer_w_ = i420_frame.GetWidth(),
                               local_renderer_h_ = i420_frame.GetHeight(), 0);
    }
    local_renderer_->RenderFrame(&i420_frame);
  }

  // Send I420 frame to the registered senders.
  talk_base::CritScope cs(&channels_crit_);
  for (VideoChannels::iterator it = channels_.begin();
      it != channels_.end(); ++it) {
    if ((*it)->sending()) (*it)->SendFrame(0, &i420_frame);
  }
}

const std::vector<VideoCodec>& WebRtcVideoEngine::codecs() const {
  return video_codecs_;
}

void WebRtcVideoEngine::SetLogging(int min_sev, const char* filter) {
  // if min_sev == -1, we keep the current log level.
  if (min_sev >= 0) {
    log_level_ = min_sev;
  }
  ApplyLogging(filter);
}

int WebRtcVideoEngine::GetLastEngineError() {
  return vie_wrapper_->error();
}

// Checks to see whether we comprehend and could receive a particular codec
bool WebRtcVideoEngine::FindCodec(const VideoCodec& in) {
  for (int i = 0; i < ARRAY_SIZE(kVideoFormats); ++i) {
    const VideoFormat fmt(kVideoFormats[i]);
    if ((in.width == 0 && in.height == 0) ||
        (fmt.width == in.width && fmt.height == in.height)) {
      for (int j = 0; j < ARRAY_SIZE(kVideoCodecPrefs); ++j) {
        VideoCodec codec(kVideoCodecPrefs[j].payload_type,
                         kVideoCodecPrefs[j].name, 0, 0, 0, 0);
        if (codec.Matches(in)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Given the requested codec, returns true if we can send that codec type and
// updates out with the best quality we could send for that codec. If current is
// not empty, we constrain out so that its aspect ratio matches current's.
bool WebRtcVideoEngine::CanSendCodec(const VideoCodec& requested,
                                     const VideoCodec& current,
                                     VideoCodec* out) {
  if (!out) {
    return false;
  }

  std::vector<VideoCodec>::const_iterator local_max;
  for (local_max = video_codecs_.begin();
       local_max < video_codecs_.end();
       ++local_max) {
    // First match codecs by payload type
    if (!requested.Matches(local_max->id, local_max->name)) {
      continue;
    }

    out->id = requested.id;
    out->name = requested.name;
    out->preference = requested.preference;
    out->framerate = talk_base::_min(requested.framerate, local_max->framerate);
    out->width = 0;
    out->height = 0;

    if (0 == requested.width && 0 == requested.height) {
      // Special case with resolution 0. The channel should not send frames.
      return true;
    } else if (0 == requested.width || 0 == requested.height) {
      // 0xn and nx0 are invalid resolutions.
      return false;
    }

    // Pick the best quality that is within their and our bounds and has the
    // correct aspect ratio.
    for (int j = 0; j < ARRAY_SIZE(kVideoFormats); ++j) {
      const VideoFormat format(kVideoFormats[j]);

      // Skip any format that is larger than the local or remote maximums, or
      // smaller than the current best match
      if (format.width > requested.width || format.height > requested.height ||
          format.width > local_max->width ||
          (format.width < out->width && format.height < out->height)) {
        continue;
      }

      bool better = false;

      // Check any further constraints on this prospective format
      if (!out->width || !out->height) {
        // If we don't have any matches yet, this is the best so far.
        better = true;
      } else if (current.width && current.height) {
        // current is set so format must match its ratio exactly.
        better =
            (format.width * current.height == format.height * current.width);
      } else {
        // Prefer closer aspect ratios i.e
        // format.aspect - requested.aspect < out.aspect - requested.aspect
        better = abs(format.width * requested.height * out->height -
                     requested.width * format.height * out->height) <
                 abs(out->width * format.height * requested.height -
                     requested.width * format.height * out->height);
      }

      if (better) {
        out->width = format.width;
        out->height = format.height;
      }
    }
    if (out->width > 0) {
      return true;
    }
  }
  return false;
}

void WebRtcVideoEngine::ConvertToCricketVideoCodec(
    const webrtc::VideoCodec& in_codec, VideoCodec* out_codec) {
  out_codec->id = in_codec.plType;
  out_codec->name = in_codec.plName;
  out_codec->width = in_codec.width;
  out_codec->height = in_codec.height;
  out_codec->framerate = in_codec.maxFramerate;
}

bool WebRtcVideoEngine::ConvertFromCricketVideoCodec(
    const VideoCodec& in_codec, webrtc::VideoCodec* out_codec) {
  bool found = false;
  int ncodecs = vie_wrapper_->codec()->NumberOfCodecs();
  for (int i = 0; i < ncodecs; ++i) {
    if (vie_wrapper_->codec()->GetCodec(i, *out_codec) == 0 &&
        _stricmp(in_codec.name.c_str(), out_codec->plName) == 0) {
      found = true;
      break;
    }
  }

  if (!found) {
    LOG(LS_ERROR) << "invalid codec type";
    return false;
  }

  if (in_codec.id != 0)
    out_codec->plType = in_codec.id;

  if (in_codec.width != 0)
    out_codec->width = in_codec.width;

  if (in_codec.height != 0)
    out_codec->height = in_codec.height;

  if (in_codec.framerate != 0)
    out_codec->maxFramerate = in_codec.framerate;

  // Init the codec with the default bandwidth options.
  out_codec->minBitrate = kMinVideoBitrate;
  out_codec->startBitrate = kStartVideoBitrate;
  out_codec->maxBitrate = kMaxVideoBitrate;

  return true;
}

void WebRtcVideoEngine::RegisterChannel(WebRtcVideoMediaChannel *channel) {
  talk_base::CritScope cs(&channels_crit_);
  channels_.push_back(channel);
}

void WebRtcVideoEngine::UnregisterChannel(WebRtcVideoMediaChannel *channel) {
  talk_base::CritScope cs(&channels_crit_);
  channels_.erase(std::remove(channels_.begin(), channels_.end(), channel),
                  channels_.end());
}

bool WebRtcVideoEngine::SetVoiceEngine(WebRtcVoiceEngine* voice_engine) {
  if (initialized_) {
    LOG(LS_WARNING) << "SetVoiceEngine can not be called after Init";
    return false;
  }
  voice_engine_ = voice_engine;
  return true;
}

bool WebRtcVideoEngine::EnableTimedRender() {
  if (initialized_) {
    LOG(LS_WARNING) << "EnableTimedRender can not be called after Init";
    return false;
  }
  render_module_.reset(webrtc::VideoRender::CreateVideoRender(0, NULL,
      false, webrtc::kRenderExternal));
  return true;
}

// See https://sites.google.com/a/google.com/wavelet/
//     Home/Magic-Flute--RTC-Engine-/Magic-Flute-Command-Line-Parameters
// for all supported command line setttings.
void WebRtcVideoEngine::ApplyLogging(const std::string& log_filter) {
  int filter = 0;
  switch (log_level_) {
    case talk_base::LS_VERBOSE: filter |= webrtc::kTraceAll;
    case talk_base::LS_INFO: filter |= webrtc::kTraceStateInfo;
    case talk_base::LS_WARNING: filter |= webrtc::kTraceWarning;
    case talk_base::LS_ERROR: filter |=
        webrtc::kTraceError | webrtc::kTraceCritical;
  }
  tracing_->SetTraceFilter(filter);

  // Set WebRTC trace file.
  std::vector<std::string> opts;
  talk_base::tokenize(log_filter, ' ', '"', '"', &opts);
  std::vector<std::string>::iterator tracefile =
      std::find(opts.begin(), opts.end(), "tracefile");
  if (tracefile != opts.end() && ++tracefile != opts.end()) {
    // Write WebRTC debug output (at same loglevel) to file
    if (tracing_->SetTraceFile(tracefile->c_str()) == -1) {
      LOG_RTCERR1(SetTraceFile, *tracefile);
    }
  }
}

// Rebuilds the codec list to be only those that are less intensive
// than the specified codec.
bool WebRtcVideoEngine::RebuildCodecList(const VideoCodec& in_codec) {
  if (!FindCodec(in_codec))
    return false;

  video_codecs_.clear();

  bool found = false;
  for (size_t i = 0; i < ARRAY_SIZE(kVideoCodecPrefs); ++i) {
    const VideoCodecPref& pref(kVideoCodecPrefs[i]);
    if (!found)
      found = (in_codec.name == pref.name);
    if (found) {
      VideoCodec codec(pref.payload_type, pref.name,
                       in_codec.width, in_codec.height, in_codec.framerate,
                       ARRAY_SIZE(kVideoCodecPrefs) - i);
      video_codecs_.push_back(codec);
    }
  }
  ASSERT(found);
  return true;
}

bool WebRtcVideoEngine::SetCapturer(VideoCapturer* capturer) {
  if (capturer == NULL) {
    // Stop capturing before clearing the capturer.
    if (SetCapture(false) != CR_SUCCESS) {
      LOG(LS_WARNING) << "Camera failed to stop";
      return false;
    }
    ClearCapturer();
    return true;
  }
  // Hook up signals and install the supplied capturer.
  SignalCaptureResult.repeat(capturer->SignalStartResult);
  capturer->SignalFrameCaptured.connect(this,
      &WebRtcVideoEngine::OnFrameCaptured);
  ClearCapturer();
  video_capturer_ = capturer;
  // Possibly restart the capturer if it is supposed to be running.
  CaptureResult result = UpdateCapturingState();
  if (result != CR_SUCCESS && result != CR_PENDING) {
    LOG(LS_WARNING) << "Camera failed to restart";
    return false;
  }
  return true;
}

void WebRtcVideoEngine::PerformanceAlarm(const unsigned int cpu_load) {
  LOG(LS_INFO) << "WebRtcVideoEngine::PerformanceAlarm";
}

// Ignore spammy trace messages, mostly from the stats API when we haven't
// gotten RTCP info yet from the remote side.
bool WebRtcVideoEngine::ShouldIgnoreTrace(const std::string& trace) {
  static const char* const kTracesToIgnore[] = {
    NULL
  };
  for (const char* const* p = kTracesToIgnore; *p; ++p) {
    if (trace.find(*p) == 0) {
      return true;
    }
  }
  return false;
}

int WebRtcVideoEngine::GetNumOfChannels() {
  talk_base::CritScope cs(&channels_crit_);
  return channels_.size();
}

void WebRtcVideoEngine::Print(const webrtc::TraceLevel level,
                              const char* trace, const int length) {
  talk_base::LoggingSeverity sev = talk_base::LS_VERBOSE;
  if (level == webrtc::kTraceError || level == webrtc::kTraceCritical)
    sev = talk_base::LS_ERROR;
  else if (level == webrtc::kTraceWarning)
    sev = talk_base::LS_WARNING;
  else if (level == webrtc::kTraceStateInfo || level == webrtc::kTraceInfo)
    sev = talk_base::LS_INFO;

  if (sev >= log_level_) {
    // Skip past boilerplate prefix text
    if (length < 72) {
      std::string msg(trace, length);
      LOG(LS_ERROR) << "Malformed webrtc log message: ";
      LOG_V(sev) << msg;
    } else {
      std::string msg(trace + 71, length - 72);
      if (!ShouldIgnoreTrace(msg) &&
          (!voice_engine_ || !voice_engine_->ShouldIgnoreTrace(msg))) {
        LOG_V(sev) << "WebRtc:" << msg;
      }
    }
  }
}

bool WebRtcVideoEngine::RegisterProcessor(
    VideoProcessor* video_processor) {
  talk_base::CritScope cs(&signal_media_critical_);
  SignalMediaFrame.connect(video_processor,
                           &VideoProcessor::OnFrame);
  return true;
}
bool WebRtcVideoEngine::UnregisterProcessor(
    VideoProcessor* video_processor) {
  talk_base::CritScope cs(&signal_media_critical_);
  SignalMediaFrame.disconnect(video_processor);
  return true;
}

void WebRtcVideoEngine::ClearCapturer() {
  video_capturer_ = NULL;
}

// WebRtcVideoMediaChannel

WebRtcVideoMediaChannel::WebRtcVideoMediaChannel(
    WebRtcVideoEngine* engine, VoiceMediaChannel* channel)
    : engine_(engine),
      voice_channel_(channel),
      vie_channel_(-1),
      vie_capture_(-1),
      external_capture_(NULL),
      render_started_(false),
      muted_(false),
      first_receive_ssrc_(0),
      send_min_bitrate_(kMinVideoBitrate),
      send_start_bitrate_(kStartVideoBitrate),
      send_max_bitrate_(kMaxVideoBitrate),
      sending_(false),
      local_stream_info_(new WebRtcLocalStreamInfo()),
      options_(0) {
  engine->RegisterChannel(this);
}

bool WebRtcVideoMediaChannel::Init() {
  if (engine_->vie()->base()->CreateChannel(vie_channel_) != 0) {
    LOG_RTCERR1(CreateChannel, vie_channel_);
    return false;
  }
  if (!ConfigureChannel(vie_channel_)) {
    engine_->vie()->base()->DeleteChannel(vie_channel_);
    vie_channel_ = -1;
    return false;
  }

  if (!ConfigureReceiving(vie_channel_, 0)) {
    engine_->vie()->base()->DeleteChannel(vie_channel_);
    vie_channel_ = -1;
    return false;
  }

  LOG(LS_INFO) << "WebRtcVideoMediaChannel::Init "
               << "vie_channel " << vie_channel_ << " created";

  // Register external capture.
  if (engine()->vie()->capture()->AllocateExternalCaptureDevice(
      vie_capture_, external_capture_) != 0) {
    LOG_RTCERR0(AllocateExternalCaptureDevice);
    return false;
  }

  // Connect external capture.
  if (engine()->vie()->capture()->ConnectCaptureDevice(
      vie_capture_, vie_channel_) != 0) {
    LOG_RTCERR2(ConnectCaptureDevice, vie_capture_, vie_channel_);
    return false;
  }

  // Register encoder observer for outgoing framerate and bitrate.
  encoder_observer_.reset(new WebRtcEncoderObserver(vie_channel_));
  if (engine()->vie()->codec()->RegisterEncoderObserver(
      vie_channel_, *encoder_observer_) != 0) {
    LOG_RTCERR1(RegisterEncoderObserver, encoder_observer_.get());
    return false;
  }

  return true;
}

WebRtcVideoMediaChannel::~WebRtcVideoMediaChannel() {
  if (vie_channel_ != -1) {
    // Stop sending.
    SetSend(false);
    if (engine()->vie()->codec()->DeregisterEncoderObserver(
        vie_channel_) != 0) {
      LOG_RTCERR1(DeregisterEncoderObserver, vie_channel_);
    }

    // Stop the renderer.
    SetRender(false);

    // Destroy the external capture interface.
    if (vie_capture_ != -1) {
      if (engine()->vie()->capture()->DisconnectCaptureDevice(
          vie_channel_) != 0) {
        LOG_RTCERR1(DisconnectCaptureDevice, vie_channel_);
      }
      if (engine()->vie()->capture()->ReleaseCaptureDevice(
          vie_capture_) != 0) {
        LOG_RTCERR1(ReleaseCaptureDevice, vie_capture_);
      }
    }

    // Remove all receive streams and the default channel.
    while (!mux_channels_.empty()) {
      RemoveRecvStream(mux_channels_.begin()->first);
    }
  }

  // Unregister the channel from the engine.
  engine()->UnregisterChannel(this);
}

bool WebRtcVideoMediaChannel::SetRecvCodecs(
    const std::vector<VideoCodec>& codecs) {
  receive_codecs_.clear();
  for (std::vector<VideoCodec>::const_iterator iter = codecs.begin();
      iter != codecs.end(); ++iter) {
    if (engine()->FindCodec(*iter)) {
      webrtc::VideoCodec wcodec;
      if (engine()->ConvertFromCricketVideoCodec(*iter, &wcodec)) {
        receive_codecs_.push_back(wcodec);
      }
    } else {
      LOG(LS_INFO) << "Unknown codec " << iter->name;
      return false;
    }
  }

  for (ChannelMap::iterator it = mux_channels_.begin();
      it != mux_channels_.end(); ++it) {
    if (!SetReceiveCodecs(it->second->channel_id()))
      return false;
  }
  return true;
}

bool WebRtcVideoMediaChannel::SetSendCodecs(
    const std::vector<VideoCodec>& codecs) {
  // Match with local video codec list.
  std::vector<webrtc::VideoCodec> send_codecs;
  int red_type = -1, fec_type = -1;
  VideoCodec checked_codec;
  VideoCodec current;  // defaults to 0x0
  if (sending_) {
    engine()->ConvertToCricketVideoCodec(*send_codec_, &current);
  }
  for (std::vector<VideoCodec>::const_iterator iter = codecs.begin();
      iter != codecs.end(); ++iter) {
    if (_stricmp(iter->name.c_str(), kRedPayloadName) == 0) {
      red_type = iter->id;
    } else if (_stricmp(iter->name.c_str(), kFecPayloadName) == 0) {
      fec_type = iter->id;
    } else if (engine()->CanSendCodec(*iter, current, &checked_codec)) {
      webrtc::VideoCodec wcodec;
      if (engine()->ConvertFromCricketVideoCodec(checked_codec, &wcodec)) {
        send_codecs.push_back(wcodec);
      }
    } else {
      LOG(LS_WARNING) << "Unknown codec " << iter->name;
    }
  }

  // Fail if we don't have a match.
  if (send_codecs.empty()) {
    LOG(LS_WARNING) << "No matching codecs avilable";
    return false;
  }

  // Configure video protection.
  if (!SetNackFec(vie_channel_, red_type, fec_type)) {
    return false;
  }

  // Select the first matched codec.
  webrtc::VideoCodec& codec(send_codecs[0]);

  // Set the default number of temporal layers for VP8.
  if (webrtc::kVideoCodecVP8 == codec.codecType) {
    codec.codecSpecific.VP8.numberOfTemporalLayers =
        kDefaultNumberOfTemporalLayers;
    // Turn off the VP8 error resilience
    codec.codecSpecific.VP8.resilience = webrtc::kResilienceOff;
  }

  if (!SetSendCodec(
      codec, send_min_bitrate_, send_start_bitrate_, send_max_bitrate_)) {
    return false;
  }
  LogSendCodecChange("SetSendCodecs()");

  return true;
}

bool WebRtcVideoMediaChannel::SetSendStreamFormat(uint32 ssrc,
                                                  const VideoFormat& format) {
  if (send_params_.get() == NULL) {
    LOG(LS_WARNING) << "Sending stream has not been added yet.";
    return false;
  }
  if (!send_params_->has_ssrc(ssrc)) {
    LOG(LS_ERROR) << "The specified ssrc " << ssrc << " is not in use.";
    return false;
  }

  if (send_codec_.get() == NULL) {
    LOG(LS_ERROR) << "The send codec has not been set yet.";
    return false;
  }

  webrtc::VideoCodec codec = *send_codec_.get();
  codec.width = format.width;
  codec.height = format.height;
  codec.maxFramerate = VideoFormat::IntervalToFps(format.interval);

  bool ret = SetSendCodec(
      codec, send_min_bitrate_, send_start_bitrate_, send_max_bitrate_);
  if (ret) {
    LogSendCodecChange("SetSendStreamFormat()");
  }
  return ret;
}

bool WebRtcVideoMediaChannel::SetRender(bool render) {
  if (render == render_started_) {
    return true;  // no action required
  }

  bool ret = true;
  for (ChannelMap::iterator it = mux_channels_.begin();
      it != mux_channels_.end(); ++it) {
    if (render) {
      if (engine()->vie()->render()->StartRender(
          it->second->channel_id()) != 0) {
        LOG_RTCERR1(StartRender, it->second->channel_id());
        ret = false;
      }
    } else {
      if (engine()->vie()->render()->StopRender(
          it->second->channel_id()) != 0) {
        LOG_RTCERR1(StopRender, it->second->channel_id());
        ret = false;
      }
    }
  }
  if (ret) {
    render_started_ = render;
  }

  return ret;
}

bool WebRtcVideoMediaChannel::SetSend(bool send) {
  if (send_params_.get() == NULL && send) {
    LOG(LS_ERROR) << "No stream added";
    return false;
  }
  if (send == sending()) {
    return true;  // No action required.
  }

  if (send) {
    // We've been asked to start sending.
    // SetSendCodecs must have been called already.
    if (!send_codec_.get()) {
      return false;
    }
    // Start send now.
    if (!StartSend()) {
      return false;
    }
  } else {
    // We've been asked to stop sending.
    if (!StopSend()) {
      return false;
    }
  }
  sending_ = send;

  return true;
}

int WebRtcVideoMediaChannel::GetChannelNum(uint32 ssrc) {
  ChannelMap::iterator it = mux_channels_.find(ssrc);
  return (it != mux_channels_.end()) ? it->second->channel_id() : -1;
}

bool WebRtcVideoMediaChannel::AddSendStream(const StreamParams& sp) {
  LOG(LS_INFO) << "AddSendStream " << sp.ToString();

  if (send_params_.get() != NULL) {
    LOG(LS_ERROR) << "WebRtcVideoMediaChannel supports one sending channel";
    return false;
  }

  if (!IsOneSsrcStream(sp)) {
      LOG(LS_ERROR) << "AddSendStream: bad local stream parameters";
      return false;
  }

  // Set the send (local) SSRC.
  // If there are multiple send SSRCs, we can only set the first one here, and
  // the rest of the SSRC(s) need to be set after SetSendCodec has been called
  // (with a codec requires multiple SSRC(s)).
  if (engine()->vie()->rtp()->SetLocalSSRC(vie_channel_,
                                           sp.first_ssrc()) != 0) {
    LOG_RTCERR2(SetLocalSSRC, vie_channel_, sp.first_ssrc());
    return false;
  }

  // Set RTCP CName.
  if (engine()->vie()->rtp()->SetRTCPCName(vie_channel_,
                                           sp.cname.c_str()) != 0) {
    LOG_RTCERR2(SetRTCPCName, vie_channel_, sp.cname.c_str());
    return false;
  }

  // Set the SSRC on the receive channels and this send channel.
  // Receive channels have to have the same SSRC in order to send receiver
  // reports with this SSRC.
  for (ChannelMap::const_iterator it = mux_channels_.begin();
       it != mux_channels_.end(); ++it) {
    WebRtcVideoChannelInfo* info = it->second;
    int channel_id = info->channel_id();
    if (engine()->vie()->rtp()->SetLocalSSRC(channel_id,
                                             sp.first_ssrc()) != 0) {
      LOG_RTCERR1(SetLocalSSRC, it->first);
      return false;
    }
  }

  // Save the StreamParams.
  send_params_.reset(new StreamParams(sp));

  // Reset send codec after stream parameters changed.
  if (send_codec_.get() != NULL) {
    if (!SetSendCodec(*send_codec_, send_min_bitrate_,
                      send_start_bitrate_, send_max_bitrate_)) {
      return false;
    }
    LogSendCodecChange("SetSendStreamFormat()");
  }

  if (sending_) {
    return StartSend();
  }
  return true;
}

bool WebRtcVideoMediaChannel::RemoveSendStream(uint32 ssrc) {
  if (send_params_.get() == NULL || !send_params_->has_ssrc(ssrc)) {
    LOG(LS_WARNING) << "Try to remove stream with ssrc " << ssrc
                    << " which doesn't exist.";
    return false;
  }
  if (sending_) {
    StopSend();
  }
  send_params_.reset(NULL);
  return true;
}

bool WebRtcVideoMediaChannel::AddRecvStream(const StreamParams& sp) {
  // TODO Remove this once BWE works properly across different send
  // and receive channels.
  // Reuse default channel for recv stream in 1:1 call.
  if ((options_ & OPT_CONFERENCE) == 0 && first_receive_ssrc_ == 0) {
    LOG(LS_INFO) << "Recv stream " << sp.first_ssrc()
                 << " reuse default channel #"
                 << vie_channel_;
    first_receive_ssrc_ = sp.first_ssrc();
    return true;
  }

  if (mux_channels_.find(sp.first_ssrc()) != mux_channels_.end()) {
    LOG(LS_ERROR) << "Stream already exists";
    return false;
  }

  // TODO: Implement recv media from multiple SSRCs per stream.
  if (sp.ssrcs.size() != 1) {
    LOG(LS_ERROR) << "WebRtcVideoMediaChannel supports one receiving SSRC per"
                  << " stream";
    return false;
  }

  // Create a new channel for receiving video data.
  // In order to get the bandwidth estimation work fine for
  // receive only channels, we connect all receiving channels
  // to our master send channel.
  int channel_id = -1;
  if (engine_->vie()->base()->CreateReceiveChannel(channel_id,
                                                   vie_channel_) != 0) {
    LOG_RTCERR2(CreateReceiveChannel, channel_id, vie_channel_);
    return false;
  }

  // Get the default renderer.
  VideoRenderer* default_renderer = NULL;
  if ((options_ & OPT_CONFERENCE) != 0) {
    if (mux_channels_.size() == 1 &&
        mux_channels_.find(0) != mux_channels_.end()) {
      GetRenderer(0, &default_renderer);
    }
  }

  if (!ConfigureChannel(channel_id) ||
      !ConfigureReceiving(channel_id, sp.first_ssrc())) {
    engine_->vie()->base()->DeleteChannel(channel_id);
    return false;
  }

  // The first recv stream reuses the default renderer (if a default renderer
  // has been set).
  if (default_renderer) {
    SetRenderer(sp.first_ssrc(), default_renderer);
  }

  LOG(LS_INFO) << "New video stream " << sp.first_ssrc()
               << " registered to VideoEngine channel #"
               << channel_id << " and connected to channel #" << vie_channel_;

  return true;
}

bool WebRtcVideoMediaChannel::RemoveRecvStream(uint32 ssrc) {
  ChannelMap::iterator it = mux_channels_.find(ssrc);

  if (it == mux_channels_.end()) {
    // TODO: Remove this once BWE works properly across different send
    // and receive channels.
    // The default channel is reused for recv stream in 1:1 call.
    if (first_receive_ssrc_ == ssrc) {
      first_receive_ssrc_ = 0;
      return true;
    }
    return false;
  }
  WebRtcVideoChannelInfo* info = it->second;
  int channel_id = info->channel_id();
  if (engine()->vie()->render()->RemoveRenderer(channel_id) != 0) {
    LOG_RTCERR1(RemoveRenderer, channel_id);
  }

  if (engine()->vie()->network()->DeregisterSendTransport(channel_id) !=0) {
    LOG_RTCERR1(DeRegisterSendTransport, channel_id);
  }

  if (engine()->vie()->codec()->DeregisterDecoderObserver(
      channel_id) != 0) {
    LOG_RTCERR1(DeregisterDecoderObserver, channel_id);
  }

  LOG(LS_INFO) << "Removing video stream " << ssrc
               << " with VideoEngine channel #"
               << channel_id;
  if (engine()->vie()->base()->DeleteChannel(channel_id) == -1) {
    LOG_RTCERR1(DeleteChannel, channel_id);
    // Leak the WebRtcVideoChannelInfo owned by |it| but remove the channel from
    // mux_channels_.
    mux_channels_.erase(it);
    return false;
  }
  // Delete the WebRtcVideoChannelInfo pointed to by it->second.
  delete info;
  mux_channels_.erase(it);
  return true;
}

bool WebRtcVideoMediaChannel::StartSend() {
  if (engine()->vie()->base()->StartSend(vie_channel_) != 0) {
    LOG_RTCERR1(StartSend, vie_channel_);
    return false;
  }

  // TODO Change this once REMB supporting multiple sending channels.
  if (engine_->vie()->rtp()->SetRembStatus(vie_channel_,
                                           kRembSending,
                                           kRembReceiving) != 0) {
    LOG_RTCERR3(SetRembStatus, vie_channel_, kRembSending, kRembReceiving);
    return false;
  }

  return true;
}

bool WebRtcVideoMediaChannel::StopSend() {
  if (engine()->vie()->base()->StopSend(vie_channel_) != 0) {
    LOG_RTCERR1(StopSend, vie_channel_);
    return false;
  }

  // TODO Change this once REMB supporting multiple sending channels.
  if (engine_->vie()->rtp()->SetRembStatus(vie_channel_,
                                           kRembNotSending,
                                           kRembReceiving) != 0) {
    LOG_RTCERR3(SetRembStatus, vie_channel_, kRembNotSending, kRembReceiving);
    return false;
  }

  return true;
}


bool WebRtcVideoMediaChannel::IsOneSsrcStream(const StreamParams& sp) {
  return (sp.ssrcs.size() == 1 && sp.ssrc_groups.size() == 0);
}

bool WebRtcVideoMediaChannel::SetRenderer(uint32 ssrc,
                                          VideoRenderer* renderer) {
  if (mux_channels_.find(ssrc) == mux_channels_.end()) {
    // TODO: Remove this once BWE works properly across different send
    // and receive channels.
    // The default channel is reused for recv stream in 1:1 call.
    if (first_receive_ssrc_ == ssrc &&
        mux_channels_.find(0) != mux_channels_.end()) {
      LOG(LS_INFO) << "SetRenderer " << ssrc
                   << " reuse default channel #"
                   << vie_channel_;
      mux_channels_[0]->SetRenderer(renderer);
      return true;
    }
    return false;
  }

  mux_channels_[ssrc]->SetRenderer(renderer);
  return true;
}

bool WebRtcVideoMediaChannel::GetStats(VideoMediaInfo* info) {
  // Get basic statistics.
  unsigned int bytes_sent, packets_sent, bytes_recv, packets_recv;
  unsigned int ssrc;
  if (engine_->vie()->rtp()->GetRTPStatistics(vie_channel_,
          bytes_sent, packets_sent, bytes_recv, packets_recv) != 0) {
    LOG_RTCERR1(GetRTPStatistics, vie_channel_);
    return false;
  }

  // Get sender statistics and build VideoSenderInfo.
  if (send_params_.get() != NULL && send_codec_.get() != NULL) {
    VideoSenderInfo sinfo;
    sinfo.ssrcs = send_params_->ssrcs;
    sinfo.codec_name = send_codec_.get() ? send_codec_->plName : "";
    sinfo.bytes_sent = bytes_sent;
    sinfo.packets_sent = packets_sent;
    sinfo.packets_cached = -1;
    sinfo.packets_lost = -1;
    sinfo.fraction_lost = -1;
    sinfo.firs_rcvd = -1;
    sinfo.nacks_rcvd = -1;
    sinfo.rtt_ms = -1;
    sinfo.frame_width = local_stream_info_->width();
    sinfo.frame_height = local_stream_info_->height();
    sinfo.framerate_input = local_stream_info_->framerate();
    sinfo.framerate_sent = encoder_observer_->framerate();
    sinfo.nominal_bitrate = encoder_observer_->bitrate();
    sinfo.preferred_bitrate = send_max_bitrate_;

    // Get received RTCP statistics for the sender, if available.
    // It's not a fatal error if we can't, since RTCP may not have arrived yet.
    uint16 r_fraction_lost;
    unsigned int r_cumulative_lost;
    unsigned int r_extended_max;
    unsigned int r_jitter;
    int r_rtt_ms;
    if (engine_->vie()->rtp()->GetSentRTCPStatistics(vie_channel_,
            r_fraction_lost, r_cumulative_lost, r_extended_max,
            r_jitter, r_rtt_ms) == 0) {
      // Convert Q8 to float.
      sinfo.packets_lost = r_cumulative_lost;
      sinfo.fraction_lost = static_cast<float>(r_fraction_lost) / (1 << 8);
      sinfo.rtt_ms = r_rtt_ms;
    }
    info->senders.push_back(sinfo);
  } else {
    LOG(LS_WARNING) << "GetStats: sender information not ready.";
  }

  // Get the SSRC and stats for each receiver, based on our own calculations.
  for (ChannelMap::const_iterator it = mux_channels_.begin();
       it != mux_channels_.end(); ++it) {
    // Don't report receive statistics from the default channel if we have
    // specified receive channels.
    if (it->first == 0 && mux_channels_.size() > 1)
      continue;
    WebRtcVideoChannelInfo* channel = it->second;

    // Get receiver statistics and build VideoReceiverInfo, if we have data.
    if (engine_->vie()->rtp()->GetRemoteSSRC(channel->channel_id(), ssrc) != 0)
      continue;

    if (engine_->vie()->rtp()->GetRTPStatistics(
        channel->channel_id(), bytes_sent, packets_sent, bytes_recv,
        packets_recv) != 0) {
      LOG_RTCERR1(GetRTPStatistics, channel->channel_id());
      return false;
    }
    VideoReceiverInfo rinfo;
    rinfo.ssrcs.push_back(ssrc);
    rinfo.bytes_rcvd = bytes_recv;
    rinfo.packets_rcvd = packets_recv;
    rinfo.packets_lost = -1;
    rinfo.packets_concealed = -1;
    rinfo.fraction_lost = -1;  // from SentRTCP
    rinfo.firs_sent = channel->decoder_observer()->firs_requested();
    rinfo.nacks_sent = -1;
    rinfo.frame_width = channel->render_adapter()->width();
    rinfo.frame_height = channel->render_adapter()->height();
    rinfo.framerate_rcvd = channel->decoder_observer()->framerate();
    int fps = channel->render_adapter()->framerate();
    rinfo.framerate_decoded = fps;
    rinfo.framerate_output = fps;

    // Get sent RTCP statistics.
    uint16 s_fraction_lost;
    unsigned int s_cumulative_lost;
    unsigned int s_extended_max;
    unsigned int s_jitter;
    int s_rtt_ms;
    if (engine_->vie()->rtp()->GetReceivedRTCPStatistics(channel->channel_id(),
            s_fraction_lost, s_cumulative_lost, s_extended_max,
            s_jitter, s_rtt_ms) == 0) {
      // Convert Q8 to float.
      rinfo.packets_lost = s_cumulative_lost;
      rinfo.fraction_lost = static_cast<float>(s_fraction_lost) / (1 << 8);
    }
    info->receivers.push_back(rinfo);
  }

  // Build BandwidthEstimationInfo.
  // TODO: Add real unittest for this.
  BandwidthEstimationInfo bwe;
  unsigned int total_bitrate_sent;
  unsigned int video_bitrate_sent;
  unsigned int fec_bitrate_sent;
  unsigned int nack_bitrate_sent;
  if (engine_->vie()->rtp()->GetBandwidthUsage(vie_channel_,
      total_bitrate_sent, video_bitrate_sent,
      fec_bitrate_sent, nack_bitrate_sent) == 0) {
    bwe.actual_enc_bitrate = video_bitrate_sent;
    bwe.transmit_bitrate = total_bitrate_sent;
    bwe.retransmit_bitrate = nack_bitrate_sent;
  } else {
    LOG_RTCERR1(GetBandwidthUsage, vie_channel_);
  }
  unsigned int estimated_send_bandwidth;
  if (engine_->vie()->rtp()->GetEstimatedSendBandwidth(
      vie_channel_, &estimated_send_bandwidth) == 0) {
    bwe.available_send_bandwidth = estimated_send_bandwidth;
  } else {
    LOG_RTCERR1(GetEstimatedSendBandwidth, vie_channel_);
  }
  unsigned int estimated_recv_bandwidth;
  if (engine_->vie()->rtp()->GetEstimatedReceiveBandwidth(
      vie_channel_, &estimated_recv_bandwidth) == 0) {
    bwe.available_recv_bandwidth = estimated_recv_bandwidth;
  } else {
    LOG_RTCERR1(GetEstimatedReceiveBandwidth, vie_channel_);
  }
  unsigned int target_enc_bitrate;
  if (engine_->vie()->codec()->GetCodecTargetBitrate(
      vie_channel_, &target_enc_bitrate) == 0) {
    bwe.target_enc_bitrate = target_enc_bitrate;
  } else {
    LOG_RTCERR1(GetCodecTargetBitrate, vie_channel_);
  }
  info->bw_estimations.push_back(bwe);

  return true;
}

bool WebRtcVideoMediaChannel::SendIntraFrame() {
  bool ret = true;
  if (engine()->vie()->codec()->SendKeyFrame(vie_channel_) != 0) {
    LOG_RTCERR1(SendKeyFrame, vie_channel_);
    ret = false;
  }

  return ret;
}

bool WebRtcVideoMediaChannel::RequestIntraFrame() {
  // There is no API exposed to application to request a key frame
  // ViE does this internally when there are errors from decoder
  return false;
}

void WebRtcVideoMediaChannel::OnPacketReceived(talk_base::Buffer* packet) {
  // Pick which channel to send this packet to. If this packet doesn't match
  // any multiplexed streams, just send it to the default channel. Otherwise,
  // send it to the specific decoder instance for that stream.
  uint32 ssrc = 0;
  if (!GetRtpSsrc(packet->data(), packet->length(), &ssrc))
    return;
  int which_channel = GetChannelNum(ssrc);
  if (which_channel == -1) {
    which_channel = video_channel();
  }

  engine()->vie()->network()->ReceivedRTPPacket(which_channel,
                                                packet->data(),
                                                packet->length());
}

void WebRtcVideoMediaChannel::OnRtcpReceived(talk_base::Buffer* packet) {
// Sending channels need all RTCP packets with feedback information.
// Even sender reports can contain attached report blocks.
// Receiving channels need sender reports in order to create
// correct receiver reports.

  uint32 ssrc = 0;
  if (!GetRtcpSsrc(packet->data(), packet->length(), &ssrc)) {
    LOG(LS_WARNING) << "Failed to parse SSRC from received RTCP packet";
    return;
  }
  int type = 0;
  if (!GetRtcpType(packet->data(), packet->length(), & type)) {
    LOG(LS_WARNING) << "Failed to parse type from received RTCP packet";
    return;
  }

  // If it is a sender report, find the channel that is listening.
  if (type == kRtcpTypeSR) {
    int which_channel = GetChannelNum(ssrc);
    if (which_channel != -1 && which_channel != vie_channel_) {
      engine_->vie()->network()->ReceivedRTCPPacket(which_channel,
                                                    packet->data(),
                                                    packet->length());
    }
  }
  // The sending channel receives all RTCP packets.
  engine_->vie()->network()->ReceivedRTCPPacket(vie_channel_,
                                                packet->data(),
                                                packet->length());
}

bool WebRtcVideoMediaChannel::Mute(bool on) {
  muted_ = on;
  return true;
}

bool WebRtcVideoMediaChannel::SetSendBandwidth(bool autobw, int bps) {
  LOG(LS_INFO) << "WebRtcVideoMediaChanne::SetSendBandwidth";

  if (0 != (options_ & OPT_CONFERENCE)) {
    LOG(LS_INFO) << "Conference mode ignores SetSendBandWidth";
    return true;
  }

  if (!send_codec_.get()) {
    LOG(LS_INFO) << "The send codec has not been set up yet";
    return true;
  }

  int min_bitrate;
  int start_bitrate;
  int max_bitrate;
  if (autobw) {
    // Use the default values for min bitrate.
    min_bitrate = kMinVideoBitrate;
    // Use the default value or the bps for the max
    max_bitrate = (bps <= 0) ? send_max_bitrate_ : (bps / 1000);
    // Maximum start bitrate can be kStartVideoBitrate.
    start_bitrate = talk_base::_min(kStartVideoBitrate, max_bitrate);
  } else {
    // Use the default start or the bps as the target bitrate.
    int target_bitrate = (bps <= 0) ? kStartVideoBitrate : (bps / 1000);
    min_bitrate = target_bitrate;
    start_bitrate = target_bitrate;
    max_bitrate = target_bitrate;
  }

  if (!SetSendCodec(*send_codec_, min_bitrate, start_bitrate, max_bitrate)) {
    return false;
  }
  LogSendCodecChange("SetSendBandwidth()");

  return true;
}

bool WebRtcVideoMediaChannel::SetOptions(int options) {
  // Always accept options that are unchanged.
  if (options_ == options) {
    return true;
  }

  // Reject new options if we're already sending.
  if (sending()) {
    return false;
  }

  // Save the options, to be interpreted where appropriate.
  options_ = options;

  // Adjust send codec bitrate if needed.
  int conf_max_bitrate = kDefaultConferenceModeMaxVideoBitrate;
  int expected_bitrate = (0 != (options_ & OPT_CONFERENCE)) ?
      conf_max_bitrate : kMaxVideoBitrate;
  if (NULL != send_codec_.get() && send_max_bitrate_ != expected_bitrate) {
    // On success, SetSendCodec() will reset send_max_bitrate_ to
    // expected_bitrate.
    if (!SetSendCodec(*send_codec_,
                      send_min_bitrate_,
                      send_start_bitrate_,
                      expected_bitrate)) {
      return false;
    }
    LogSendCodecChange("SetOptions()");
  }

  // Enable denoising if needed.
  if (vie_capture_ != -1) {
    bool enable = (options_ & OPT_VIDEO_NOISE_REDUCTION) != 0;
    // The EnableDenoising may return -1 when the denoising is already
    // enabled/disabled, which should not be treated as an error.
    // TODO: Return false once EnableDenoising only
    // reports the real failure.
    engine()->vie()->image()->EnableDenoising(vie_capture_, enable);
  } else {
    LOG(LS_WARNING) << "SetOptions: Video Capture is not ready.";
  }

  return true;
}

void WebRtcVideoMediaChannel::SetInterface(NetworkInterface* iface) {
  MediaChannel::SetInterface(iface);
  // Set the RTP recv/send buffer to a bigger size
  if (network_interface_) {
    network_interface_->SetOption(NetworkInterface::ST_RTP,
                                  talk_base::Socket::OPT_RCVBUF,
                                  kVideoRtpBufferSize);
    network_interface_->SetOption(NetworkInterface::ST_RTP,
                                  talk_base::Socket::OPT_SNDBUF,
                                  kVideoRtpBufferSize);
  }
}

bool WebRtcVideoMediaChannel::GetRenderer(uint32 ssrc,
                                          VideoRenderer** renderer) {
  ChannelMap::const_iterator it = mux_channels_.find(ssrc);
  if (it == mux_channels_.end()) {
    if (first_receive_ssrc_ == ssrc &&
        mux_channels_.find(0) != mux_channels_.end()) {
      LOG(LS_INFO) << " GetRenderer " << ssrc
                   << " reuse default renderer #"
                   << vie_channel_;
      *renderer = mux_channels_[0]->render_adapter()->renderer();
      return true;
    }
    return false;
  }

  *renderer = it->second->render_adapter()->renderer();
  return true;
}

// TODO: Add unittests to test this function.
bool WebRtcVideoMediaChannel::SendFrame(uint32 ssrc, const VideoFrame* frame) {
  if (ssrc != 0 || !sending() || !external_capture_) {
    return false;
  }

  // Update local stream statistics.
  local_stream_info_->UpdateFrame(frame->GetWidth(), frame->GetHeight());

  // If we want to drop the frame.
  if (DropFrame()) {
    return true;
  }

  // Checks if we need to reset vie send codec.
  if (!MaybeResetVieSendCodec(frame->GetWidth(), frame->GetHeight(), NULL)) {
    LOG(LS_ERROR) << "MaybeResetVieSendCodec failed with "
                  << frame->GetWidth() << "x" << frame->GetHeight();
    return false;
  }

  // Blacken the frame if video is muted.
  const VideoFrame* frame_out = frame;
  talk_base::scoped_ptr<VideoFrame> black_frame;
  if (muted_) {
    black_frame.reset(frame->Copy());
    black_frame->SetToBlack();
    frame_out = black_frame.get();
  }

  webrtc::ViEVideoFrameI420 frame_i420;
  // TODO: Update the webrtc::ViEVideoFrameI420
  // to use const unsigned char*
  frame_i420.y_plane = const_cast<unsigned char*>(frame_out->GetYPlane());
  frame_i420.u_plane = const_cast<unsigned char*>(frame_out->GetUPlane());
  frame_i420.v_plane = const_cast<unsigned char*>(frame_out->GetVPlane());
  frame_i420.y_pitch = frame_out->GetYPitch();
  frame_i420.u_pitch = frame_out->GetUPitch();
  frame_i420.v_pitch = frame_out->GetVPitch();
  frame_i420.width = frame_out->GetWidth();
  frame_i420.height = frame_out->GetHeight();

  // Convert from nanoseconds to milliseconds.
  WebRtc_Word64 clocks = frame_out->GetTimeStamp() /
      talk_base::kNumNanosecsPerMillisec;

  return (external_capture_->IncomingFrameI420(frame_i420, clocks) == 0);
}

bool WebRtcVideoMediaChannel::ConfigureChannel(int channel_id) {
  // Register external transport.
  if (engine_->vie()->network()->RegisterSendTransport(
      channel_id, *this) != 0) {
    LOG_RTCERR1(RegisterSendTransport, channel_id);
    return false;
  }

  // Set MTU.
  if (engine_->vie()->network()->SetMTU(channel_id, kVideoMtu) != 0) {
    LOG_RTCERR2(SetMTU, channel_id, kVideoMtu);
    return false;
  }
  // Turn on RTCP and loss feedback reporting.
  if (engine()->vie()->rtp()->SetRTCPStatus(
      channel_id, webrtc::kRtcpCompound_RFC4585) != 0) {
    LOG_RTCERR2(SetRTCPStatus, channel_id, webrtc::kRtcpCompound_RFC4585);
    return false;
  }
  // Enable pli as key frame request method.
  if (engine_->vie()->rtp()->SetKeyFrameRequestMethod(
      channel_id, webrtc::kViEKeyFrameRequestPliRtcp) != 0) {
    LOG_RTCERR2(SetKeyFrameRequestMethod,
                channel_id, webrtc::kViEKeyFrameRequestPliRtcp);
    return false;
  }
  return true;
}

bool WebRtcVideoMediaChannel::ConfigureReceiving(int channel_id,
                                                 uint32 remote_ssrc) {
  // Connect the voice channel, if there is one.
  // TODO: The A/V is synched by the receiving channel. So we need to
  // know the SSRC of the remote audio channel in order to fetch the correct
  // webrtc VoiceEngine channel. For now- only sync the default channel used
  // in 1-1 calls.
  if (remote_ssrc == 0 && voice_channel_) {
    WebRtcVoiceMediaChannel* voice_channel =
        static_cast<WebRtcVoiceMediaChannel*>(voice_channel_);
    if (engine_->vie()->base()->ConnectAudioChannel(
        vie_channel_, voice_channel->voe_channel()) != 0) {
      LOG_RTCERR2(ConnectAudioChannel, channel_id,
                  voice_channel->voe_channel());
      LOG(LS_WARNING) << "A/V not synchronized";
      // Not a fatal error.
    }
  }

  talk_base::scoped_ptr<WebRtcVideoChannelInfo> channel_info(
      new WebRtcVideoChannelInfo(channel_id));

  // Install a render adapter.
  if (engine_->vie()->render()->AddRenderer(channel_id,
      webrtc::kVideoI420, channel_info->render_adapter()) != 0) {
    LOG_RTCERR3(AddRenderer, channel_id, webrtc::kVideoI420,
                channel_info->render_adapter());
    return false;
  }

  // TODO Change this once REMB supporting multiple sending channels.
  // Turn off remb sending (2nd param) and turn on remb reporting (3rd param)
  // here.
  // For sending channel, remb sending will be turned on after StartSending.
  if (engine_->vie()->rtp()->SetRembStatus(channel_id,
                                           kRembNotSending,
                                           kRembReceiving) != 0) {
    LOG_RTCERR3(SetRembStatus, vie_channel_, kRembSending, kRembReceiving);
    return false;
  }

  if (remote_ssrc != 0) {
    // Use the same SSRC as our default channel
    // (so the RTCP reports are correct).
    unsigned int send_ssrc = 0;
    webrtc::ViERTP_RTCP* rtp = engine()->vie()->rtp();
    if (rtp->GetLocalSSRC(vie_channel_, send_ssrc) == -1) {
      LOG_RTCERR2(GetLocalSSRC, channel_id, send_ssrc);
      return false;
    }
    if (rtp->SetLocalSSRC(channel_id, send_ssrc) == -1) {
      LOG_RTCERR2(SetLocalSSRC, channel_id, send_ssrc);
      return false;
    }
  }  // Else this is the the default channel and we don't change the SSRC.

  // Disable color enhancement since it is a bit too aggressive.
  if (engine()->vie()->image()->EnableColorEnhancement(channel_id,
                                                       false) != 0) {
    LOG_RTCERR1(EnableColorEnhancement, channel_id);
    return false;
  }

  if (!SetReceiveCodecs(channel_id)) {
    return false;
  }

  if (render_started_) {
    if (engine_->vie()->render()->StartRender(channel_id) != 0) {
      LOG_RTCERR1(StartRender, channel_id);
      return false;
    }
  }

  // Register decoder observer for incoming framerate and bitrate.
  if (engine()->vie()->codec()->RegisterDecoderObserver(
      channel_id, *channel_info->decoder_observer()) != 0) {
    LOG_RTCERR1(RegisterDecoderObserver, channel_info->decoder_observer());
    return false;
  }

  mux_channels_[remote_ssrc] = channel_info.release();

  return true;
}

bool WebRtcVideoMediaChannel::SetNackFec(int channel_id,
                                         int red_payload_type,
                                         int fec_payload_type) {
  // Enable hybrid NACK/FEC if negotiated and not in a conference, use only NACK
  // otherwise.
  bool enable = (red_payload_type != -1 && fec_payload_type != -1 &&
      !(options_ & OPT_CONFERENCE));
  if (enable) {
    if (engine_->vie()->rtp()->SetHybridNACKFECStatus(
        channel_id, enable, red_payload_type, fec_payload_type) != 0) {
      LOG_RTCERR4(SetHybridNACKFECStatus,
                  channel_id, enable, red_payload_type, fec_payload_type);
      return false;
    }
    LOG(LS_INFO) << "Hybrid NACK/FEC enabled for channel " << channel_id;
  } else {
    if (engine_->vie()->rtp()->SetNACKStatus(channel_id, true) != 0) {
      LOG_RTCERR1(SetNACKStatus, channel_id);
      return false;
    }
    LOG(LS_INFO) << "NACK enabled for channel " << channel_id;
  }
  return true;
}


bool WebRtcVideoMediaChannel::SetSendCodec(const webrtc::VideoCodec& codec,
                                           int min_bitrate,
                                           int start_bitrate,
                                           int max_bitrate) {
  // Make a copy of the codec
  webrtc::VideoCodec target_codec = codec;
  target_codec.startBitrate = start_bitrate;
  target_codec.minBitrate = min_bitrate;
  target_codec.maxBitrate = max_bitrate;

  if (codec.width == 0 && codec.height == 0) {
    LOG(LS_INFO) << "0x0 resolution selected. We will drop all the frames.";
  } else {

    if (0 !=
        engine()->vie()->codec()->SetSendCodec(vie_channel_, target_codec)) {
      LOG_RTCERR2(SetSendCodec, vie_channel_, send_codec_->plName);
      return false;
    }

  }

  // Reset the send_codec_ only if SetSendCodec is success.
  send_codec_.reset(new webrtc::VideoCodec(target_codec));
  send_min_bitrate_ = min_bitrate;
  send_start_bitrate_ = start_bitrate;
  send_max_bitrate_ = max_bitrate;

  return true;
}

void WebRtcVideoMediaChannel::LogSendCodecChange(const std::string& reason) {
  webrtc::VideoCodec vie_codec;
  if (engine()->vie()->codec()->GetSendCodec(vie_channel_, vie_codec) != 0) {
    LOG_RTCERR1(GetSendCodec, vie_channel_);
    return;
  }

  LOG(LS_INFO) << reason << " : selected video codec "
               << vie_codec.plName << "/"
               << vie_codec.width << "x" << vie_codec.height << "x"
               << static_cast<int>(vie_codec.maxFramerate) << "fps"
               << "@" << vie_codec.maxBitrate << "kbps";
  if (webrtc::kVideoCodecVP8 == vie_codec.codecType) {
    LOG(LS_INFO) << "VP8 number of temporal layers: "
                 << static_cast<int>(
                    vie_codec.codecSpecific.VP8.numberOfTemporalLayers);
  }

}

bool WebRtcVideoMediaChannel::SetReceiveCodecs(int channel_id) {
  int red_type = -1;
  int fec_type = -1;
  for (std::vector<webrtc::VideoCodec>::iterator it = receive_codecs_.begin();
       it != receive_codecs_.end(); ++it) {
    if (it->codecType == webrtc::kVideoCodecRED) {
      red_type = it->plType;
    } else if (it->codecType == webrtc::kVideoCodecULPFEC) {
      fec_type = it->plType;
    }
    if (engine()->vie()->codec()->SetReceiveCodec(channel_id, *it) != 0) {
      LOG_RTCERR2(SetReceiveCodec, channel_id, it->plName);
      return false;
    }
  }

  // Enable video protection. For a sending channel, this will be taken care of
  // in SetSendCodecs.
  if (channel_id != vie_channel_) {
    if (!SetNackFec(channel_id, red_type, fec_type)) {
      return false;
    }
  }

  // Start receiving packets if at least one receive codec has been set.
  if (!receive_codecs_.empty()) {
    if (engine()->vie()->base()->StartReceive(channel_id) != 0) {
      LOG_RTCERR1(StartReceive, channel_id);
      return false;
    }
  }
  return true;
}

// If the new frame size is different from the send codec size we set on vie,
// we need to reset the send codec on vie.
// The new send codec size should not exceed send_codec_ which is controlled
// only by the 'jec' logic.
bool WebRtcVideoMediaChannel::MaybeResetVieSendCodec(int new_width,
                                                     int new_height,
                                                     bool* reset) {
  if (reset) {
    *reset = false;
  }

  if (NULL == send_codec_.get()) {
    return false;
  }

  // Vie send codec size should not exceed send_codec_.
  int target_width = new_width;
  int target_height = new_height;
  if (new_width > send_codec_->width || new_height > send_codec_->height) {
    target_width = send_codec_->width;
    target_height = send_codec_->height;
  }

  // Get current vie codec.
  webrtc::VideoCodec vie_codec;
  if (engine()->vie()->codec()->GetSendCodec(vie_channel_, vie_codec) != 0) {
    LOG_RTCERR1(GetSendCodec, vie_channel_);
    return false;
  }

  // Only reset send codec when there is a size change.
  if (target_width != vie_codec.width || target_height != vie_codec.height) {
    // Set the new codec on vie.
    vie_codec.width = target_width;
    vie_codec.height = target_height;


    if (engine()->vie()->codec()->SetSendCodec(vie_channel_, vie_codec) != 0) {
      LOG_RTCERR1(SetSendCodec, vie_channel_);
      return false;
    }
    if (reset) {
      *reset = true;
    }
    LogSendCodecChange("Capture size changed");
  }

  return true;
}

int WebRtcVideoMediaChannel::SendPacket(int channel, const void* data,
                                        int len) {
  if (!network_interface_) {
    return -1;
  }
  talk_base::Buffer packet(data, len, kMaxRtpPacketLen);
  return network_interface_->SendPacket(&packet) ? len : -1;
}

int WebRtcVideoMediaChannel::SendRTCPPacket(int channel,
                                            const void* data,
                                            int len) {
  if (!network_interface_) {
    return -1;
  }
  talk_base::Buffer packet(data, len, kMaxRtpPacketLen);
  return network_interface_->SendRtcp(&packet) ? len : -1;
}

}  // namespace cricket

#endif  // HAVE_WEBRTC_VIDEO
