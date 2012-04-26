// libjingle
// Copyright 2004--2011 Google Inc.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  1. Redistributions of source code must retain the above copyright notice,
//     this list of conditions and the following disclaimer.
//  2. Redistributions in binary form must reproduce the above copyright notice,
//     this list of conditions and the following disclaimer in the documentation
//     and/or other materials provided with the distribution.
//  3. The name of the author may not be used to endorse or promote products
//     derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
// WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
// EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
// OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
// OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// Implementation of class WebRtcVideoCapturer.

#ifdef HAVE_CONFIG_H
#include <config.h>
#endif

#ifdef HAVE_WEBRTC_VIDEO
#include "talk/session/phone/webrtcvideocapturer.h"
#include "talk/base/logging.h"
#include "talk/base/thread.h"
#include "talk/base/timeutils.h"
#include "talk/session/phone/webrtcvideoframe.h"

#include "talk/base/win32.h"  // Need this to #include the impl files
#ifdef WEBRTC_RELATIVE_PATH
#include "modules/video_capture/main/interface/video_capture_factory.h"
#else
#include "third_party/webrtc/files/include/video_capture_factory.h"
#endif

namespace cricket {

struct kVideoFourCCEntry {
  uint32 fourcc;
  webrtc::RawVideoType webrtc_type;
};

// This indicates our format preferences and defines a mapping between
// webrtc::RawVideoType (from video_capture_defines.h) to our FOURCCs.
static kVideoFourCCEntry kSupportedFourCCs[] = {
  { FOURCC_I420, webrtc::kVideoI420 },   // 12 bpp, no conversion
  { FOURCC_YV12, webrtc::kVideoYV12 },   // 12 bpp, no conversion
  { FOURCC_NV12, webrtc::kVideoNV12 },   // 12 bpp, fast conversion
  { FOURCC_NV21, webrtc::kVideoNV21 },   // 12 bpp, fast conversion
  { FOURCC_YUY2, webrtc::kVideoYUY2 },   // 16 bpp, fast conversion
  { FOURCC_UYVY, webrtc::kVideoUYVY },   // 16 bpp, fast conversion
  { FOURCC_MJPG, webrtc::kVideoMJPEG },  // compressed, slow conversion
  { FOURCC_ARGB, webrtc::kVideoARGB },   // 32 bpp, slow conversion
  { FOURCC_24BG, webrtc::kVideoRGB24 },  // 32 bpp, slow conversion
};

class WebRtcVcmFactory : public WebRtcVcmFactoryInterface {
 public:
  virtual webrtc::VideoCaptureModule* Create(int id,
                                             const char* device) {
    return webrtc::VideoCaptureFactory::Create(id, device);
  }
  virtual webrtc::VideoCaptureModule::DeviceInfo* CreateDeviceInfo(int id) {
    return webrtc::VideoCaptureFactory::CreateDeviceInfo(id);
  }
  virtual void DestroyDeviceInfo(webrtc::VideoCaptureModule::DeviceInfo* info) {
    delete info;
  }
};

static bool CapabilityToFormat(const webrtc::VideoCaptureCapability& cap,
                               VideoFormat* format) {
  uint32 fourcc = 0;
  for (size_t i = 0; i < ARRAY_SIZE(kSupportedFourCCs); ++i) {
    if (kSupportedFourCCs[i].webrtc_type == cap.rawType) {
      fourcc = kSupportedFourCCs[i].fourcc;
      break;
    }
  }
  if (fourcc == 0) {
    return false;
  }

  format->fourcc = fourcc;
  format->width = cap.width;
  format->height = cap.height;
  format->interval = VideoFormat::FpsToInterval(cap.maxFPS);
  return true;
}

static bool FormatToCapability(const VideoFormat& format,
                               webrtc::VideoCaptureCapability* cap) {
  webrtc::RawVideoType webrtc_type = webrtc::kVideoUnknown;
  for (size_t i = 0; i < ARRAY_SIZE(kSupportedFourCCs); ++i) {
    if (kSupportedFourCCs[i].fourcc == format.fourcc) {
      webrtc_type = kSupportedFourCCs[i].webrtc_type;
      break;
    }
  }
  if (webrtc_type == webrtc::kVideoUnknown) {
    return false;
  }

  cap->width = format.width;
  cap->height = format.height;
  cap->maxFPS = VideoFormat::IntervalToFps(format.interval);
  cap->expectedCaptureDelay = 0;
  cap->rawType = webrtc_type;
  cap->codecType = webrtc::kVideoCodecUnknown;
  cap->interlaced = false;
  return true;
}

///////////////////////////////////////////////////////////////////////////
// Implementation of class WebRtcVideoCapturer
///////////////////////////////////////////////////////////////////////////

WebRtcVideoCapturer::WebRtcVideoCapturer()
    : factory_(new WebRtcVcmFactory),
      module_(NULL),
      captured_frames_(0) {
}

WebRtcVideoCapturer::WebRtcVideoCapturer(WebRtcVcmFactoryInterface* factory)
    : factory_(factory),
      module_(NULL),
      captured_frames_(0) {
}

WebRtcVideoCapturer::~WebRtcVideoCapturer() {
  if (module_) {
    module_->Release();
  }
}

bool WebRtcVideoCapturer::Init(const Device& device) {
  if (module_) {
    LOG(LS_ERROR) << "The capturer is already initialized";
    return false;
  }

  webrtc::VideoCaptureModule::DeviceInfo* info = factory_->CreateDeviceInfo(0);
  if (!info) {
    return false;
  }

  // Find the desired camera, by name.
  // In the future, comparing IDs will be more robust.
  // TODO: Figure what's needed to allow this.
  int num_cams = info->NumberOfDevices();
  char vcm_id[256] = "";
  bool found = false;
  for (int index = 0; index < num_cams; ++index) {
    char vcm_name[256];
    if (info->GetDeviceName(index, vcm_name, ARRAY_SIZE(vcm_name),
                            vcm_id, ARRAY_SIZE(vcm_id)) != -1) {
      if (device.name == reinterpret_cast<char*>(vcm_name)) {
        found = true;
        break;
      }
    }
  }
  if (!found) {
    LOG(LS_WARNING) << "Failed to find capturer for id: " << device.id;
    factory_->DestroyDeviceInfo(info);
    return false;
  }

  // Enumerate the supported formats.
  // TODO: Find out why this starts/stops the camera...
  std::vector<VideoFormat> supported;
  WebRtc_UWord32 num_caps = info->NumberOfCapabilities(vcm_id);
  for (WebRtc_UWord8 i = 0; i < num_caps; ++i) {
    webrtc::VideoCaptureCapability cap;
    if (info->GetCapability(vcm_id, i, cap) != -1) {
      VideoFormat format;
      if (CapabilityToFormat(cap, &format)) {
        supported.push_back(format);
      } else {
        LOG(LS_WARNING) << "Ignoring unsupported WebRTC capture format "
                        << cap.rawType;
      }
    }
  }
  factory_->DestroyDeviceInfo(info);
  if (supported.empty()) {
    LOG(LS_ERROR) << "Failed to find usable formats for id: " << device.id;
    return false;
  }

  module_ = factory_->Create(0, vcm_id);
  if (!module_) {
    LOG(LS_ERROR) << "Failed to create capturer for id: " << device.id;
    return false;
  }

  // It is safe to change member attributes now.
  module_->AddRef();
  SetId(device.id);
  SetSupportedFormats(supported);
  return true;
}

bool WebRtcVideoCapturer::Init(webrtc::VideoCaptureModule* module) {
  if (module_) {
    LOG(LS_ERROR) << "The capturer is already initialized";
    return false;
  }
  if (!module) {
    LOG(LS_ERROR) << "Invalid VCM supplied";
    return false;
  }
  // TODO: Set id and formats.
  (module_ = module)->AddRef();
  return true;
}

bool WebRtcVideoCapturer::GetBestCaptureFormat(const VideoFormat& desired,
                                               VideoFormat* best_format) {
  if (!best_format) {
    return false;
  }

  if (!VideoCapturer::GetBestCaptureFormat(desired, best_format)) {
    // If the vcm has a list of the supported format, but didn't find the
    // best match, then we should return fail.
    if (GetSupportedFormats()) {
      return false;
    }

    // We maybe using a manually injected VCM which doesn't support enum.
    // Use the desired format as the best format.
    best_format->width = desired.width;
    best_format->height = desired.height;
    best_format->fourcc = FOURCC_I420;
    best_format->interval = desired.interval;
    LOG(LS_INFO) << "Failed to find best capture format,"
                 << " fall back to the requested format "
                 << best_format->ToString();
  }
  return true;
}

CaptureResult WebRtcVideoCapturer::Start(const VideoFormat& capture_format) {
  if (!module_) {
    LOG(LS_ERROR) << "The capturer has not been initialized";
    return CR_NO_DEVICE;
  }

  if (IsRunning()) {
    LOG(LS_ERROR) << "The capturer is already running";
    return CR_FAILURE;
  }

  SetCaptureFormat(&capture_format);

  webrtc::VideoCaptureCapability cap;
  if (!FormatToCapability(capture_format, &cap)) {
    LOG(LS_ERROR) << "Invalid capture format specified";
    return CR_FAILURE;
  }

  std::string camera_id(GetId());
  uint32 start = talk_base::Time();
  if (module_->RegisterCaptureDataCallback(*this) != 0 ||
      module_->StartCapture(cap) != 0) {
    LOG(LS_ERROR) << "Camera '" << camera_id << "' failed to start";
    return CR_FAILURE;
  }

  LOG(LS_INFO) << "Camera '" << camera_id << "' started with format "
               << capture_format.ToString() << ", elapsed time "
               << talk_base::TimeSince(start) << " ms";

  captured_frames_ = 0;
  talk_base::Thread::Current()->Post(this);
  return CR_PENDING;
}

void WebRtcVideoCapturer::Stop() {
  if (IsRunning()) {
    talk_base::Thread::Current()->Clear(this);
    module_->StopCapture();
    module_->DeRegisterCaptureDataCallback();

    // TODO: Determine if the VCM exposes any drop stats we can use.
    double drop_ratio = 0.0;
    std::string camera_id(GetId());
    LOG(LS_INFO) << "Camera '" << camera_id << "' stopped after capturing "
                 << captured_frames_ << " frames and dropping "
                 << drop_ratio << "%";
  }
  SetCaptureFormat(NULL);
}

bool WebRtcVideoCapturer::IsRunning() {
  return (module_ != NULL && module_->CaptureStarted());
}

bool WebRtcVideoCapturer::GetPreferredFourccs(
    std::vector<uint32>* fourccs) {
  if (!fourccs) {
    return false;
  }

  fourccs->clear();
  for (size_t i = 0; i < ARRAY_SIZE(kSupportedFourCCs); ++i) {
    fourccs->push_back(kSupportedFourCCs[i].fourcc);
  }
  return true;
}

void WebRtcVideoCapturer::OnMessage(talk_base::Message* message) {
  // TODO: Fire SignalCaptureEvent appropriately.
  SignalStartResult(this, CR_SUCCESS);
}

void WebRtcVideoCapturer::OnIncomingCapturedFrame(const WebRtc_Word32 id,
    webrtc::VideoFrame& sample, webrtc::VideoCodecType codec_type) {
  ASSERT(IsRunning());
  ASSERT(codec_type == webrtc::kVideoCodecUnknown);

  ++captured_frames_;
  // Log the size and pixel aspect ratio of the first captured frame.
  if (1 == captured_frames_) {
    LOG(LS_INFO) << "Captured frame size "
                 << sample.Width() << "x" << sample.Height()
                 << ". Expected format " << GetCaptureFormat()->ToString();
  }

  // Signal down stream components on captured frame.
  WebRtcCapturedFrame frame(sample);
  SignalFrameCaptured(this, &frame);
}

void WebRtcVideoCapturer::OnCaptureDelayChanged(
    const WebRtc_Word32 id, const WebRtc_Word32 delay) {
  LOG(LS_INFO) << "Capture delay changed to " << delay << " ms";
}

// WebRtcCapturedFrame
WebRtcCapturedFrame::WebRtcCapturedFrame(const webrtc::VideoFrame& sample) {
  width = sample.Width();
  height = sample.Height();
  fourcc = FOURCC_I420;
  pixel_width = 1;
  pixel_height = 1;
  // convert units from VideoFrame RenderTimeMs
  // to CapturedFrame (nanoseconds)
  elapsed_time = sample.RenderTimeMs() * talk_base::kNumNanosecsPerMillisec;
  time_stamp = elapsed_time;
  data_size = sample.Length();
  data = const_cast<WebRtc_UWord8*>(sample.Buffer());
}

}  // namespace cricket

#endif  // HAVE_WEBRTC_VIDEO
