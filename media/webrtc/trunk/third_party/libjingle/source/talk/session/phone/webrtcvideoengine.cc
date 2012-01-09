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
#include "talk/session/phone/videorenderer.h"
#include "talk/session/phone/webrtcpassthroughrender.h"
#include "talk/session/phone/webrtcvoiceengine.h"
#include "talk/session/phone/webrtcvideocapturer.h"
#include "talk/session/phone/webrtcvideoframe.h"
#include "talk/session/phone/webrtcvie.h"
#include "talk/session/phone/webrtcvoe.h"

// TODO Change video protection calls when WebRTC API has changed.
#define WEBRTC_VIDEO_AVPF_NACK_ONLY

namespace cricket {

static const int kDefaultLogSeverity = talk_base::LS_WARNING;

static const int kMinVideoBitrate = 100;
static const int kStartVideoBitrate = 300;
static const int kMaxVideoBitrate = 2000;

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
  }
  // Implementation of webrtc::ExternalRenderer.
  virtual int FrameSizeChange(unsigned int width, unsigned int height,
                              unsigned int /*number_of_streams*/) {
    talk_base::CritScope cs(&crit_);
    if (renderer_ == NULL) {
      return 0;
    }
    width_ = width;
    height_ = height;
    return renderer_->SetSize(width_, height_, 0) ? 0 : -1;
  }
  virtual int DeliverFrame(unsigned char* buffer, int buffer_size,
                           unsigned int time_stamp) {
    talk_base::CritScope cs(&crit_);
    frame_rate_tracker_.Update(1);
    if (renderer_ == NULL) {
      return 0;
    }
    WebRtcVideoFrame video_frame;
    video_frame.Attach(buffer, buffer_size, width_, height_,
                       1, 1, 0, time_stamp, 0);

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

 private:
  talk_base::CriticalSection crit_;
  VideoRenderer* renderer_;
  unsigned int width_;
  unsigned int height_;
  talk_base::RateTracker frame_rate_tracker_;
};

class WebRtcDecoderObserver : public webrtc::ViEDecoderObserver {
 public:
  WebRtcDecoderObserver(int video_channel)
       : video_channel_(video_channel),
         framerate_(0),
         bitrate_(0),
         firs_requested_(0) { }

  // virtual functions from VieDecoderObserver.
  virtual void IncomingCodecChanged(const int videoChannel,
                                    const webrtc::VideoCodec& videoCodec) { }
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
  WebRtcEncoderObserver(int video_channel)
       : video_channel_(video_channel), framerate_(0), bitrate_(0) { }

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

class LocalStreamInfo {
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

const WebRtcVideoEngine::VideoCodecPref
    WebRtcVideoEngine::kVideoCodecPrefs[] = {
    {kVp8PayloadName, 100, 0},
#ifndef WEBRTC_VIDEO_AVPF_NACK_ONLY
    {kRedPayloadName, 101, 1},
    {kFecPayloadName, 102, 2},
#endif
};

// The formats are sorted by the descending order of width. We use the order to
// find the next format for CPU and bandwidth adaptation.
const VideoFormatPod WebRtcVideoEngine::kVideoFormats[] = {
  {1280, 800, 30, FOURCC_ANY},
  {1280, 720, 30, FOURCC_ANY},
  {960, 600, 30, FOURCC_ANY},
  {960, 540, 30, FOURCC_ANY},
  {640, 400, 30, FOURCC_ANY},
  {640, 360, 30, FOURCC_ANY},
  {640, 480, 30, FOURCC_ANY},
  {480, 300, 30, FOURCC_ANY},
  {480, 270, 30, FOURCC_ANY},
  {480, 360, 30, FOURCC_ANY},
  {320, 200, 30, FOURCC_ANY},
  {320, 180, 30, FOURCC_ANY},
  {320, 240, 30, FOURCC_ANY},
  {240, 150, 30, FOURCC_ANY},
  {240, 135, 30, FOURCC_ANY},
  {240, 180, 30, FOURCC_ANY},
  {160, 100, 30, FOURCC_ANY},
  {160, 90, 30, FOURCC_ANY},
  {160, 120, 30, FOURCC_ANY},
};

const VideoFormatPod WebRtcVideoEngine::kDefaultVideoFormat =
    {640, 400, 30, FOURCC_ANY};

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
  owns_capturer_ = false;
  video_capturer_ = NULL;
  capture_started_ = false;

  ApplyLogging();
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
                       kDefaultVideoFormat.framerate,
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

bool WebRtcVideoEngine::SetCaptureDevice(const Device* device) {
  if (!device) {
    ClearCapturer();
    LOG(LS_INFO) << "Camera set to NULL";
    return true;
  }
  // No-op if the device hasn't changed.
  if ((video_capturer_ != NULL) && video_capturer_->GetId() == device->id) {
    return true;
  }
  // Create a new capturer for the specified device.
  VideoCapturer* capturer = CreateVideoCapturer(*device);
  if (!capturer) {
    LOG(LS_ERROR) << "Failed to create camera '" << device->name << "', id='"
                  << device->id << "'";
    return false;
  }
  const bool owns_capturer = true;
  if (!SetCapturer(capturer, owns_capturer)) {
    return false;
  }
  LOG(LS_INFO) << "Camera set to '" << device->name << "', id='"
               << device->id << "'";
  return true;
}

bool WebRtcVideoEngine::SetCaptureModule(webrtc::VideoCaptureModule* vcm) {
  if (!vcm) {
    if ((video_capturer_ != NULL) && video_capturer_->IsRunning()) {
      LOG(LS_WARNING) << "Failed to set camera to NULL when is running.";
      return false;
    } else {
      ClearCapturer();
      LOG(LS_INFO) << "Camera set to NULL";
      return true;
    }
  }
  // Create a new capturer for the specified device.
  WebRtcVideoCapturer* capturer = new WebRtcVideoCapturer;
  if (!capturer->Init(vcm)) {
    LOG(LS_ERROR) << "Failed to create camera from VCM";
    delete capturer;
    return false;
  }
  const bool owns_capturer = true;
  if (!SetCapturer(capturer, owns_capturer)) {
    return false;
  }
  LOG(LS_INFO) << "Camera created with VCM";
  return true;
}

bool WebRtcVideoEngine::SetVideoCapturer(VideoCapturer* capturer,
                                         uint32 /*ssrc*/) {
  const bool capture = (capturer != NULL);
  const bool owns_capturer = false;
  CaptureResult res = CR_FAILURE;
  if (capture) {
    // Register the capturer before starting to capture.
    if (!SetCapturer(capturer, owns_capturer)) {
      return false;
    }
    const bool kEnableCapture = true;
    res = SetCapture(kEnableCapture);
  } else {
    // Stop capturing before unregistering the capturer.
    const bool kDisableCapture = false;
    res = SetCapture(kDisableCapture);
    if (!SetCapturer(capturer, owns_capturer)) {
      return false;
    }
  }
  return (res == CR_SUCCESS) || (res == CR_PENDING);
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

VideoCapturer* WebRtcVideoEngine::CreateVideoCapturer(const Device& device) {
  WebRtcVideoCapturer* capturer = new WebRtcVideoCapturer;
  if (!capturer->Init(device)) {
    delete capturer;
    return NULL;
  }
  return capturer;
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
  log_level_ = min_sev;
  ApplyLogging();
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
    const webrtc::VideoCodec& in_codec, VideoCodec& out_codec) {
  out_codec.id = in_codec.plType;
  out_codec.name = in_codec.plName;
  out_codec.width = in_codec.width;
  out_codec.height = in_codec.height;
  out_codec.framerate = in_codec.maxFramerate;
}

bool WebRtcVideoEngine::ConvertFromCricketVideoCodec(
    const VideoCodec& in_codec, webrtc::VideoCodec& out_codec) {
  bool found = false;
  int ncodecs = vie_wrapper_->codec()->NumberOfCodecs();
  for (int i = 0; i < ncodecs; ++i) {
    if (vie_wrapper_->codec()->GetCodec(i, out_codec) == 0 &&
      in_codec.name == out_codec.plName) {
      found = true;
      break;
    }
  }

  if (!found) {
    LOG(LS_ERROR) << "invalid codec type";
    return false;
  }

  if (in_codec.id != 0)
    out_codec.plType = in_codec.id;

  if (in_codec.width != 0)
    out_codec.width = in_codec.width;

  if (in_codec.height != 0)
    out_codec.height = in_codec.height;

  if (in_codec.framerate != 0)
    out_codec.maxFramerate = in_codec.framerate;

  // Init the codec with the default bandwidth options.
  out_codec.minBitrate = kMinVideoBitrate;
  out_codec.startBitrate = kStartVideoBitrate;
  out_codec.maxBitrate = kMaxVideoBitrate;

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
    LOG(LS_WARNING) << "SetVoiceEngine can not be called after Init.";
    return false;
  }
  voice_engine_ = voice_engine;
  return true;
}

bool WebRtcVideoEngine::EnableTimedRender() {
  if (initialized_) {
    LOG(LS_WARNING) << "EnableTimedRender can not be called after Init.";
    return false;
  }
  render_module_.reset(webrtc::VideoRender::CreateVideoRender(0, NULL,
      false, webrtc::kRenderExternal));
  return true;
}

void WebRtcVideoEngine::ApplyLogging() {
  int filter = 0;
  switch (log_level_) {
    case talk_base::LS_VERBOSE: filter |= webrtc::kTraceAll;
    case talk_base::LS_INFO: filter |= webrtc::kTraceStateInfo;
    case talk_base::LS_WARNING: filter |= webrtc::kTraceWarning;
    case talk_base::LS_ERROR: filter |=
        webrtc::kTraceError | webrtc::kTraceCritical;
  }
  tracing_->SetTraceFilter(filter);
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

bool WebRtcVideoEngine::SetCapturer(VideoCapturer* capturer,
                                    bool own_capturer) {
  if (capturer == NULL) {
    ClearCapturer();
    return true;
  }
  // Hook up signals and install the supplied capturer.
  SignalCaptureResult.repeat(capturer->SignalStartResult);
  capturer->SignalFrameCaptured.connect(this,
      &WebRtcVideoEngine::OnFrameCaptured);
  ClearCapturer();
  video_capturer_ = capturer;
  owns_capturer_ = own_capturer;
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

// TODO: stubs for now
bool WebRtcVideoEngine::RegisterProcessor(
    VideoProcessor* video_processor) {
  return true;
}
bool WebRtcVideoEngine::UnregisterProcessor(
    VideoProcessor* video_processor) {
  return true;
}

void WebRtcVideoEngine::ClearCapturer() {
  if (owns_capturer_) {
    delete video_capturer_;
  }
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
      sending_(false),
      render_started_(false),
      muted_(false),
      send_min_bitrate_(kMinVideoBitrate),
      send_start_bitrate_(kStartVideoBitrate),
      send_max_bitrate_(kMaxVideoBitrate),
      local_stream_info_(new LocalStreamInfo()) {
  engine->RegisterChannel(this);
}

bool WebRtcVideoMediaChannel::Init() {
  if (engine_->vie()->base()->CreateChannel(vie_channel_) != 0) {
    LOG_RTCERR1(CreateChannel, vie_channel_);
    return false;
  }

  LOG(LS_INFO) << "WebRtcVideoMediaChannel::Init "
               << "vie_channel " << vie_channel_ << " created";

  // Connect the voice channel, if there is one.
  if (voice_channel_) {
    WebRtcVoiceMediaChannel* channel =
        static_cast<WebRtcVoiceMediaChannel*>(voice_channel_);
    if (engine_->vie()->base()->ConnectAudioChannel(
        vie_channel_, channel->voe_channel()) != 0) {
      LOG_RTCERR2(ConnectAudioChannel, vie_channel_, channel->voe_channel());
      LOG(LS_WARNING) << "A/V not synchronized";
      // Not a fatal error.
    }
  }

  // Register external transport.
  if (engine_->vie()->network()->RegisterSendTransport(
      vie_channel_, *this) != 0) {
    LOG_RTCERR1(RegisterSendTransport, vie_channel_);
    return false;
  }

  // Set MTU.
  if (engine_->vie()->network()->SetMTU(vie_channel_, kVideoMtu) != 0) {
    LOG_RTCERR2(SetMTU, vie_channel_, kVideoMtu);
    return false;
  }

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

  // Install render adapter.
  remote_renderer_.reset(new WebRtcRenderAdapter(NULL));
  if (engine_->vie()->render()->AddRenderer(vie_channel_,
      webrtc::kVideoI420, remote_renderer_.get()) != 0) {
    LOG_RTCERR3(AddRenderer, vie_channel_, webrtc::kVideoI420,
                remote_renderer_.get());
    remote_renderer_.reset();
    return false;
  }

  // Register decoder observer for incoming framerate and bitrate.
  decoder_observer_.reset(new WebRtcDecoderObserver(vie_channel_));
  if (engine()->vie()->codec()->RegisterDecoderObserver(
      vie_channel_, *decoder_observer_) != 0) {
    LOG_RTCERR1(RegisterDecoderObserver, decoder_observer_.get());
    return false;
  }

  // Register encoder observer for outgoing framerate and bitrate.
  encoder_observer_.reset(new WebRtcEncoderObserver(vie_channel_));
  if (engine()->vie()->codec()->RegisterEncoderObserver(
      vie_channel_, *encoder_observer_) != 0) {
    LOG_RTCERR1(RegisterEncoderObserver, encoder_observer_.get());
    return false;
  }

  // Turn on RTCP and loss feedback reporting.
  if (!EnableRtcp() ||
      !EnablePli()) {
    return false;
  }

#ifdef WEBRTC_VIDEO_AVPF_NACK_ONLY
  // Turn on NACK-only loss handling.
  if (!EnableNack())
    return false;
#endif

  // Turn on TMMBR-based BWE reporting.
  if (!EnableTmmbr()) {
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
    if (engine()->vie()->codec()->DeregisterDecoderObserver(
        vie_channel_) != 0) {
      LOG_RTCERR1(DeregisterDecoderObserver, vie_channel_);
    }
    if (remote_renderer_.get() &&
        engine()->vie()->render()->RemoveRenderer(vie_channel_) != 0) {
      LOG_RTCERR1(RemoveRenderer, vie_channel_);
    }

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

    // Deregister external transport.
    if (engine()->vie()->network()->DeregisterSendTransport(
        vie_channel_) != 0) {
      LOG_RTCERR1(DeregisterSendTransport, vie_channel_);
    }

    // Delete the VideoEngine channel.
    if (engine()->vie()->base()->DeleteChannel(vie_channel_) != 0) {
      LOG_RTCERR1(DeleteChannel, vie_channel_);
    }
  }

  // Unregister the channel from the engine.
  engine()->UnregisterChannel(this);
}

bool WebRtcVideoMediaChannel::SetRecvCodecs(
    const std::vector<VideoCodec>& codecs) {
  bool ret = true;
  for (std::vector<VideoCodec>::const_iterator iter = codecs.begin();
      iter != codecs.end(); ++iter) {
    if (engine()->FindCodec(*iter)) {
      webrtc::VideoCodec wcodec;
      if (engine()->ConvertFromCricketVideoCodec(*iter, wcodec)) {
        if (engine()->vie()->codec()->SetReceiveCodec(
            vie_channel_, wcodec) != 0) {
          LOG_RTCERR2(SetReceiveCodec, vie_channel_, wcodec.plName);
          ret = false;
        }
      }
    } else {
      LOG(LS_INFO) << "Unknown codec " << iter->name;
      ret = false;
    }
  }

  // make channel ready to receive packets
  if (ret) {
    if (engine()->vie()->base()->StartReceive(vie_channel_) != 0) {
      LOG_RTCERR1(StartReceive, vie_channel_);
      ret = false;
    }
  }
  return ret;
}

bool WebRtcVideoMediaChannel::SetSendCodecs(
    const std::vector<VideoCodec>& codecs) {
  // Match with local video codec list.
  std::vector<webrtc::VideoCodec> send_codecs;
  int red_type = -1, fec_type = -1;
  VideoCodec checked_codec;
  VideoCodec current;  // defaults to 0x0
  if (sending_) {
    engine()->ConvertToCricketVideoCodec(*send_codec_, current);
  }
  for (std::vector<VideoCodec>::const_iterator iter = codecs.begin();
      iter != codecs.end(); ++iter) {
    if (_stricmp(iter->name.c_str(), kRedPayloadName) == 0) {
      red_type = iter->id;
    } else if (_stricmp(iter->name.c_str(), kFecPayloadName) == 0) {
      fec_type = iter->id;
    } else if (engine()->CanSendCodec(*iter, current, &checked_codec)) {
      webrtc::VideoCodec wcodec;
      if (engine()->ConvertFromCricketVideoCodec(checked_codec, wcodec)) {
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

#ifndef WEBRTC_VIDEO_AVPF_NACK_ONLY
  // Configure FEC if enabled.
  if (!SetNackFec(red_type, fec_type)) {
    return false;
  }
#endif

  // Select the first matched codec.
  webrtc::VideoCodec& codec(send_codecs[0]);

  // Set the default number of temporal layers for VP8.
  if (webrtc::kVideoCodecVP8 == codec.codecType) {
    codec.codecSpecific.VP8.numberOfTemporalLayers =
        kDefaultNumberOfTemporalLayers;
  }

  if (!SetSendCodec(
      codec, send_min_bitrate_, send_start_bitrate_, send_max_bitrate_)) {
    return false;
  }

  LOG(LS_INFO) << "Selected video codec " << send_codec_->plName << "/"
               << send_codec_->width << "x" << send_codec_->height << "x"
               << static_cast<int>(send_codec_->maxFramerate);
  if (webrtc::kVideoCodecVP8 == codec.codecType) {
    LOG(LS_INFO) << "VP8 number of layers: "
                 << static_cast<int>(
                    send_codec_->codecSpecific.VP8.numberOfTemporalLayers);
  }
  return true;
}

bool WebRtcVideoMediaChannel::SetRender(bool render) {
  if (render == render_started_) {
    return true;  // no action required
  }

  bool ret = true;
  if (render) {
    if (engine()->vie()->render()->StartRender(vie_channel_) != 0) {
      LOG_RTCERR1(StartRender, vie_channel_);
      ret = false;
    }
  } else {
    if (engine()->vie()->render()->StopRender(vie_channel_) != 0) {
      LOG_RTCERR1(StopRender, vie_channel_);
      ret = false;
    }
  }
  if (ret) {
    render_started_ = render;
  }

  return ret;
}

bool WebRtcVideoMediaChannel::SetSend(bool send) {
  if (send == sending()) {
    return true;  // no action required
  }

  if (send) {
    // We've been asked to start sending.
    // SetSendCodecs must have been called already.
    if (!send_codec_.get()) {
      return false;
    }

    if (engine()->vie()->base()->StartSend(vie_channel_) != 0) {
      LOG_RTCERR1(StartSend, vie_channel_);
      return false;
    }
  } else {
    // We've been asked to stop sending.
    if (engine()->vie()->base()->StopSend(vie_channel_) != 0) {
      LOG_RTCERR1(StopSend, vie_channel_);
      return false;
    }
  }

  sending_ = send;
  return true;
}

bool WebRtcVideoMediaChannel::AddStream(uint32 ssrc, uint32 voice_ssrc) {
  return false;
}

bool WebRtcVideoMediaChannel::RemoveStream(uint32 ssrc) {
  return false;
}

bool WebRtcVideoMediaChannel::SetRenderer(
    uint32 ssrc, VideoRenderer* renderer) {
  if (ssrc != 0)
    return false;

  remote_renderer_->SetRenderer(renderer);
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
  if (engine_->vie()->rtp()->GetLocalSSRC(vie_channel_, ssrc) == 0) {
    VideoSenderInfo sinfo;
    sinfo.ssrc = ssrc;
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
    sinfo.preferred_bitrate = kMaxVideoBitrate;

    // Get received RTCP statistics for the sender, if available.
    // It's not a fatal error if we can't, since RTCP may not have arrived yet.
    uint16 r_fraction_lost;
    unsigned int r_cumulative_lost;
    unsigned int r_extended_max;
    unsigned int r_jitter;
    int r_rtt_ms;
    if (engine_->vie()->rtp()->GetReceivedRTCPStatistics(vie_channel_,
            r_fraction_lost, r_cumulative_lost, r_extended_max,
            r_jitter, r_rtt_ms) == 0) {
      // Convert Q8 to float.
      sinfo.packets_lost = r_cumulative_lost;
      sinfo.fraction_lost = static_cast<float>(r_fraction_lost) / (1 << 8);
      sinfo.rtt_ms = r_rtt_ms;
    }
    info->senders.push_back(sinfo);
  } else {
    LOG_RTCERR1(GetLocalSSRC, vie_channel_);
  }

  // Get receiver statistics and build VideoReceiverInfo, if we have data.
  if (engine_->vie()->rtp()->GetRemoteSSRC(vie_channel_, ssrc) == 0) {
    VideoReceiverInfo rinfo;
    rinfo.ssrc = ssrc;
    rinfo.bytes_rcvd = bytes_recv;
    rinfo.packets_rcvd = packets_recv;
    rinfo.packets_lost = -1;
    rinfo.packets_concealed = -1;
    rinfo.fraction_lost = -1;  // from SentRTCP
    rinfo.firs_sent = decoder_observer_->firs_requested();
    rinfo.nacks_sent = -1;
    rinfo.frame_width = remote_renderer_->width();
    rinfo.frame_height = remote_renderer_->height();
    rinfo.framerate_rcvd = decoder_observer_->framerate();
    int fps = remote_renderer_->framerate();
    rinfo.framerate_decoded = fps;
    rinfo.framerate_output = fps;

    // Get sent RTCP statistics.
    uint16 s_fraction_lost;
    unsigned int s_cumulative_lost;
    unsigned int s_extended_max;
    unsigned int s_jitter;
    int s_rtt_ms;
    if (engine_->vie()->rtp()->GetSentRTCPStatistics(vie_channel_,
            s_fraction_lost, s_cumulative_lost, s_extended_max,
            s_jitter, s_rtt_ms) == 0) {
      // Convert Q8 to float.
      rinfo.packets_lost = s_cumulative_lost;
      rinfo.fraction_lost = static_cast<float>(s_fraction_lost) / (1 << 8);
    }
    info->receivers.push_back(rinfo);
  }

  // Build BandwidthEstimationInfo.
  // TODO: Fill in more BWE stats once we have them.
  unsigned int total_bitrate_sent;
  unsigned int video_bitrate_sent;
  unsigned int fec_bitrate_sent;
  unsigned int nack_bitrate_sent;
  if (engine_->vie()->rtp()->GetBandwidthUsage(vie_channel_,
      total_bitrate_sent, video_bitrate_sent,
      fec_bitrate_sent, nack_bitrate_sent) == 0) {
    BandwidthEstimationInfo bwe;
    bwe.actual_enc_bitrate = video_bitrate_sent;
    bwe.transmit_bitrate = total_bitrate_sent;
    bwe.retransmit_bitrate = nack_bitrate_sent;
    info->bw_estimations.push_back(bwe);
  } else {
    LOG_RTCERR1(GetBandwidthUsage, vie_channel_);
  }

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
  engine()->vie()->network()->ReceivedRTPPacket(vie_channel_,
                                                         packet->data(),
                                                         packet->length());
}

void WebRtcVideoMediaChannel::OnRtcpReceived(talk_base::Buffer* packet) {
  engine_->vie()->network()->ReceivedRTCPPacket(vie_channel_,
                                                         packet->data(),
                                                         packet->length());
}

void WebRtcVideoMediaChannel::SetSendSsrc(uint32 id) {
  if (!sending_) {
    if (engine()->vie()->rtp()->SetLocalSSRC(vie_channel_, id) != 0) {
      LOG_RTCERR1(SetLocalSSRC, vie_channel_);
    }
  } else {
    LOG(LS_ERROR) << "Channel already in send state";
  }
}

bool WebRtcVideoMediaChannel::SetRtcpCName(const std::string& cname) {
  if (engine()->vie()->rtp()->SetRTCPCName(vie_channel_,
                                           cname.c_str()) != 0) {
    LOG_RTCERR2(SetRTCPCName, vie_channel_, cname.c_str());
    return false;
  }
  return true;
}

bool WebRtcVideoMediaChannel::Mute(bool on) {
  muted_ = on;
  return true;
}

bool WebRtcVideoMediaChannel::SetSendBandwidth(bool autobw, int bps) {
  LOG(LS_INFO) << "RtcVideoMediaChanne::SetSendBandwidth";

  if (!send_codec_.get()) {
    LOG(LS_INFO) << "The send codec has not been set up yet.";
    return true;
  }

  int min_bitrate;
  int start_bitrate;
  int max_bitrate;
  if (autobw) {
    // Use the default values for min bitrate.
    min_bitrate = kMinVideoBitrate;
    // Use the default value or the bps for the max
    max_bitrate = (bps <= 0) ? kMaxVideoBitrate : (bps / 1000);
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

  return true;
}

bool WebRtcVideoMediaChannel::SetOptions(int options) {
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

// TODO: Add unittests to test this function.
bool WebRtcVideoMediaChannel::SendFrame(uint32 ssrc, const VideoFrame* frame) {
  if (ssrc != 0 || !sending() || !external_capture_) {
    return false;
  }

  // Update local stream statistics.
  local_stream_info_->UpdateFrame(frame->GetWidth(), frame->GetHeight());

  // If the captured video format is smaller than what we asked for, reset send
  // codec on video engine.
  if (send_codec_.get() != NULL &&
      frame->GetWidth() < send_codec_->width &&
      frame->GetHeight() < send_codec_->height) {
    LOG(LS_INFO) << "Captured video frame size changed to: "
                 << frame->GetWidth() << "x" << frame->GetHeight();
    webrtc::VideoCodec new_codec = *send_codec_;
    new_codec.width = frame->GetWidth();
    new_codec.height = frame->GetHeight();
    if (!SetSendCodec(
        new_codec, send_min_bitrate_, send_start_bitrate_, send_max_bitrate_)) {
      LOG(LS_WARNING) << "Failed to switch to new frame size: "
                      << frame->GetWidth() << "x" << frame->GetHeight();
    }
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

bool WebRtcVideoMediaChannel::EnableRtcp() {
  if (engine()->vie()->rtp()->SetRTCPStatus(
          vie_channel_, webrtc::kRtcpCompound_RFC4585) != 0) {
    LOG_RTCERR2(SetRTCPStatus, vie_channel_, webrtc::kRtcpCompound_RFC4585);
    return false;
  }
  return true;
}

bool WebRtcVideoMediaChannel::EnablePli() {
  if (engine_->vie()->rtp()->SetKeyFrameRequestMethod(
          vie_channel_, webrtc::kViEKeyFrameRequestPliRtcp) != 0) {
    LOG_RTCERR2(SetRTCPStatus,
                vie_channel_, webrtc::kViEKeyFrameRequestPliRtcp);
    return false;
  }
  return true;
}

bool WebRtcVideoMediaChannel::EnableTmmbr() {
  if (engine_->vie()->rtp()->SetTMMBRStatus(vie_channel_, true) != 0) {
    LOG_RTCERR1(SetTMMBRStatus, vie_channel_);
    return false;
  }
  return true;
}

bool WebRtcVideoMediaChannel::EnableNack() {
  if (engine_->vie()->rtp()->SetNACKStatus(vie_channel_, true) != 0) {
    LOG_RTCERR1(SetNACKStatus, vie_channel_);
    return false;
  }
  return true;
}

bool WebRtcVideoMediaChannel::SetNackFec(int red_payload_type,
                                         int fec_payload_type) {
  bool enable = (red_payload_type != -1 && fec_payload_type != -1);
  if (engine_->vie()->rtp()->SetHybridNACKFECStatus(
          vie_channel_, enable, red_payload_type, fec_payload_type) != 0) {
    LOG_RTCERR4(SetHybridNACKFECStatus,
                vie_channel_, enable, red_payload_type, fec_payload_type);
    return false;
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

  if (engine()->vie()->codec()->SetSendCodec(vie_channel_, target_codec) != 0) {
    LOG_RTCERR2(SetSendCodec, vie_channel_, send_codec_->plName);
    return false;
  }

  // Reset the send_codec_ only if SetSendCodec is success.
  send_codec_.reset(new webrtc::VideoCodec(target_codec));
  send_min_bitrate_ = min_bitrate;
  send_start_bitrate_ = start_bitrate;
  send_max_bitrate_ = max_bitrate;

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
