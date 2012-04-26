// libjingle
// Copyright 2010 Google Inc.
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
// Implementartion file of class VideoCapturer.

#include "talk/session/phone/videocapturer.h"

#include <algorithm>

#include "talk/base/logging.h"

namespace cricket {

static const int64 kMaxDistance = ~(static_cast<int64>(1) << 63);
static const int64  kMinDesirableFps = static_cast<int64>(14);

/////////////////////////////////////////////////////////////////////
// Implementation of struct CapturedFrame
/////////////////////////////////////////////////////////////////////
CapturedFrame::CapturedFrame()
    : width(0),
      height(0),
      fourcc(0),
      pixel_width(0),
      pixel_height(0),
      elapsed_time(0),
      time_stamp(0),
      data_size(0),
      rotation(0),
      data(NULL) {
}

// TODO: Remove this function once lmimediaengine stops using it.
bool CapturedFrame::GetDataSize(uint32* size) const {
  if (!size || data_size == CapturedFrame::kUnknownDataSize) {
    return false;
  }
  *size = data_size;
  return true;
}

/////////////////////////////////////////////////////////////////////
// Implementation of class VideoCapturer
/////////////////////////////////////////////////////////////////////
void VideoCapturer::SetSupportedFormats(
    const std::vector<VideoFormat>& formats) {
  if (!supported_formats_.get()) {
    supported_formats_.reset(new std::vector<VideoFormat>);
  }
  *(supported_formats_.get()) = formats;
}

bool VideoCapturer::GetBestCaptureFormat(const VideoFormat& desired,
                                         VideoFormat* best_format) {
  if (!supported_formats_.get()) {
    return false;
  }

  VideoFormat format = desired;
  // If the application requests 16x9 and the camera does not support 16x9 HD
  // or the application requests 16x10, change the request to 4x3. Otherwise,
  // keep the request.
  if (format.width * 9 == format.height * 16 &&
      !Includes16x9HD(*supported_formats_.get())) {
    format.height = format.width * 3 / 4;
  } else if (format.width * 10 == format.height * 16) {
    format.height = format.width * 3 / 4;
  }
  LOG(LS_INFO) << " Capture Desired " << desired.ToString()
               << " Capture Requested " << format.ToString();
  int64 best_distance = kMaxDistance;
  std::vector<VideoFormat>::const_iterator best = supported_formats_->end();
  std::vector<VideoFormat>::const_iterator i;
  for (i = supported_formats_->begin(); i != supported_formats_->end(); ++i) {
    int64 distance = GetFormatDistance(format, *i);
    // TODO: Reduce to LS_VERBOSE if/when camera capture is
    // relatively bug free.
    LOG(LS_INFO) << " Supported " << i->ToString()
                 << " distance " << distance;
    if (distance < best_distance) {
      best_distance = distance;
      best = i;
    }
  }
  if (supported_formats_->end() == best) {
    LOG(LS_ERROR) << " No acceptable camera format found";
    return false;
  }

  if (best_format) {
    best_format->width = best->width;
    best_format->height = best->height;
    best_format->fourcc = best->fourcc;
    best_format->interval = talk_base::_max(format.interval, best->interval);
    LOG(LS_INFO) << " Best " << best_format->ToString()
                 << " distance " << best_distance;
  }
  return true;
}

// Get the distance between the supported and desired formats.
// Prioritization is done according to this algorithm:
// 1) Width closeness. If not same, we prefer wider.
// 2) Height closeness. If not same, we prefer higher.
// 3) Framerate closeness. If not same, we prefer faster.
// 4) Compression. If desired format has a specific fourcc, we need exact match;
//                otherwise, we use preference.
int64 VideoCapturer::GetFormatDistance(const VideoFormat& desired,
                                       const VideoFormat& supported) {
  int64 distance = kMaxDistance;

  // Check fourcc.
  uint32 supported_fourcc = CanonicalFourCC(supported.fourcc);
  int64 delta_fourcc = kMaxDistance;
  if (FOURCC_ANY == desired.fourcc) {
    // Any fourcc is OK for the desired. Use preference to find best fourcc.
    std::vector<uint32> preferred_fourccs;
    if (!GetPreferredFourccs(&preferred_fourccs)) {
      return distance;
    }

    for (size_t i = 0; i < preferred_fourccs.size(); ++i) {
      if (supported_fourcc == CanonicalFourCC(preferred_fourccs[i])) {
        delta_fourcc = i;
        break;
      }
    }
  } else if (supported_fourcc == CanonicalFourCC(desired.fourcc)) {
    delta_fourcc = 0;  // Need exact match.
  }

  if (kMaxDistance == delta_fourcc) {
    // Failed to match fourcc.
    return distance;
  }

  // Check resolution and fps.
  int desired_width = desired.width;
  int desired_height = desired.height;
#ifdef OSX
  // QVGA on OSX is not well supported.  For 16x10, if 320x240 is used, it has
  // 15x11 pixel aspect ratio on logitech B910/C260 and others.  ComputeCrop
  // in mediaengine does not crop, so we keep 320x240, which magiccam on Mac
  // can not display.  Some other viewers can display 320x240, but do not
  // support pixel aspect ratio and appear distorted.
  // This code below bumps the preferred resolution to VGA, maintaining aspect
  // ratio. ie 320x200 -> 640x400.  VGA on logitech and most cameras is 1x1
  // pixel aspect ratio.  The camera will capture 640x480, ComputeCrop will
  // crop to 640x400, and the adapter will scale down to QVGA due to JUP view
  // request.
  static const int kMinWidth = 640;
  if (desired_width > 0 && desired_width < kMinWidth) {
    int new_desired_height = desired_height * kMinWidth / desired_width;
    LOG(LS_VERBOSE) << " Changed desired from "
                    << desired_width << "x" << desired_height
                    << " To "
                    << kMinWidth << "x" << new_desired_height;
    desired_width = kMinWidth;
    desired_height = new_desired_height;
  }
#endif
  int64 delta_w = supported.width - desired_width;
  int64 supported_fps = VideoFormat::IntervalToFps(supported.interval);
  int64 delta_fps = supported_fps -
      VideoFormat::IntervalToFps(desired.interval);
  // Check height of supported height compared to height we would like it to be.
  int64 aspect_h = desired_width ?
      supported.width * desired_height / desired_width : desired_height;
  int64 delta_h = supported.height - aspect_h;

  distance = 0;
  // Set high penalty if the supported format is lower than the desired format.
  // 3x means we would prefer down to down to 3/4, than up to double.
  // But we'd prefer up to double than down to 1/2.  This is conservative,
  // strongly avoiding going down in resolution, similar to
  // the old method, but not completely ruling it out in extreme situations.
  // It also ignores framerate, which is often very low at high resolutions.
  // TODO: Improve logic to use weighted factors.
  static const int kDownPenalty = -3;
  if (delta_w < 0) {
    delta_w = delta_w * kDownPenalty;
  }
  if (delta_h < 0) {
    delta_h = delta_h * kDownPenalty;
  }
  if (delta_fps < 0) {
    // For same resolution, prefer higher framerate but accept lower.
    // Otherwise prefer higher resolution.
    delta_fps = -delta_fps;
    if (supported_fps < kMinDesirableFps) {
      distance |= static_cast<int64>(1) << 62;
    } else {
      distance |= static_cast<int64>(1) << 15;
    }
  }

  // 12 bits for width and height and 8 bits for fps and fourcc.
  distance |= (delta_w << 28) | (delta_h << 16) |
      (delta_fps << 8) | delta_fourcc;

  return distance;
}

bool VideoCapturer::Includes16x9HD(const std::vector<VideoFormat>& formats) {
  std::vector<VideoFormat>::const_iterator i;
  for (i = formats.begin(); i != formats.end(); ++i) {
    if ((i->height >= 720) && (i->width * 9 == i->height * 16)) {
      return true;
    }
  }
  return false;
}

}  // namespace cricket
