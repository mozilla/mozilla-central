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

#include "talk/session/phone/videoadapter.h"

#include <limits.h>

#include "talk/base/logging.h"
#include "talk/base/timeutils.h"
#include "talk/session/phone/videoframe.h"

namespace cricket {

// TODO: Make downgrades settable
static const int kMaxCpuDowngrades = 4;  // Downgrade at most 4 times for CPU.
static const int kDefaultDowngradeWaitTimeMs = 2000;

// Cpu system load thresholds relative to max cpus.
static const float kHighSystemThreshold = 0.95f;
static const float kLowSystemThreshold = 0.75f;

// Cpu process load thresholds relative to current cpus.
static const float kMediumProcessThreshold = 0.50f;

// TODO: Consider making scale factor table settable, to allow
// application to select quality vs performance tradeoff.
// List of scale factors that adapter will scale by.
#if defined(IOS) || defined(ANDROID)
// Mobile needs 1/4 scale for VGA (640x360) to QQVGA (160x90)
// or 1/4 scale for HVGA (480x270) to QQHVGA (120x67)
static const int kMinNumPixels = 120 * 67;
static float kScaleFactors[] = {
  1.f, // full size
  3.f/4.f, // 3/4 scale
  1.f/2.f, // 1/2 scale
  3.f/8.f, // 3/8 scale
  1.f/4.f, // 1/4 scale
};
#else
// PC needs 1/8 scale for HD (1280x720) to QQVGA (160x90)
static const int kMinNumPixels = 160 * 100;
static float kScaleFactors[] = {
  1.f, // full size
  3.f/4.f, // 3/4 scale
  1.f/2.f, // 1/2 scale
  3.f/8.f, // 3/8 scale
  1.f/4.f, // 1/4 scale
  3.f/16.f, // 3/16 scale
  1.f/8.f // 1/8 scale
};
#endif

// Find scale factor that applied to width and height, is best match
// to num_pixels.
float VideoAdapter::FindClosestScale(int width, int height,
                                     int target_num_pixels) {
  if (!target_num_pixels) {
    return 0.f;
  }
  int best_distance = INT_MAX;
  int best_index = 0;  // default to unscaled
  for (size_t i = 0u; i < ARRAY_SIZE(kScaleFactors); ++i) {
    int test_num_pixels = static_cast<int>(width * kScaleFactors[i] *
                                           height * kScaleFactors[i]);
    int diff = test_num_pixels - target_num_pixels;
    if (diff < 0) {
      diff = -diff;
    }
    if (diff < best_distance) {
      best_distance = diff;
      best_index = i;
      if (!best_distance) { // Found exact match
        break;
      }
    }
  }
  return kScaleFactors[best_index];
}

// There are several frame sizes used by Adapter.  This explains them
// input_format - set once by server to frame size expected from the camera.
// output_format - size that output would like to be.  Includes framerate.
// output_num_pixels - size that output should be constrained to.  Used to
//   compute output_format from in_frame.
// in_frame - actual camera captured frame size, which is typically the same
//   as input_format.  This can also be rotated or cropped for aspect ratio.
// out_frame - actual frame output by adapter.  Should be a direct scale of
//   in_frame maintaining rotation and aspect ratio.
// OnOutputFormatRequest - server requests you send this resolution based on
//   view requests.
// OnEncoderResolutionRequest - encoder requests you send this resolution based
//   on bandwidth
// OnCpuLoadUpdated - cpu monitor requests you send this resolution based on
//   cpu load.

///////////////////////////////////////////////////////////////////////
// Implementation of VideoAdapter
VideoAdapter::VideoAdapter()
    : output_num_pixels_(0),
      black_output_(false),
      is_black_(false),
      drop_frame_count_(0) {
}

VideoAdapter::~VideoAdapter() {
}

// TODO: Consider SetInputFormat and SetOutputFormat without
// VideoFormat.
void VideoAdapter::SetInputFormat(const VideoFormat& format) {
  talk_base::CritScope cs(&critical_section_);
  input_format_ = format;
  output_format_.interval = talk_base::_max(
      output_format_.interval, input_format_.interval);
}

void VideoAdapter::SetOutputFormat(const VideoFormat& format) {
  talk_base::CritScope cs(&critical_section_);
  output_format_ = format;
  output_num_pixels_ = output_format_.width * output_format_.height;
  output_format_.interval = talk_base::_max(
      output_format_.interval, input_format_.interval);
  drop_frame_count_ = 0;
}

const VideoFormat& VideoAdapter::input_format() {
  talk_base::CritScope cs(&critical_section_);
  return input_format_;
}

const VideoFormat& VideoAdapter::output_format() {
  talk_base::CritScope cs(&critical_section_);
  return output_format_;
}

void VideoAdapter::SetBlackOutput(bool black) {
  talk_base::CritScope cs(&critical_section_);
  black_output_ = black;
}

// Constrain output resolution to this many pixels overall
void VideoAdapter::SetOutputNumPixels(int num_pixels) {
  output_num_pixels_ = num_pixels;
}

int VideoAdapter::GetOutputNumPixels() const {
  return output_num_pixels_;
}

bool VideoAdapter::AdaptFrame(const VideoFrame* in_frame,
                              const VideoFrame** out_frame) {
  talk_base::CritScope cs(&critical_section_);

  if (!in_frame || !out_frame || input_format_.IsSize0x0()) {
    return false;
  }

  // Drop the input frame if necessary.
  bool should_drop = false;
  if (!output_num_pixels_) {
    // Drop all frames as the output format is 0x0.
    should_drop = true;
  } else {
    // Drop some frames based on the ratio of the input fps and the output fps.
    // We assume that the output fps is a factor of the input fps. In other
    // words, the output interval is divided by the input interval evenly.
    should_drop = (drop_frame_count_ > 0);
    if (input_format_.interval > 0 &&
        output_format_.interval > input_format_.interval) {
      ++drop_frame_count_;
      drop_frame_count_ %= output_format_.interval / input_format_.interval;
    }
  }

  if (output_num_pixels_) {
    float scale = VideoAdapter::FindClosestScale(in_frame->GetWidth(),
                                                 in_frame->GetHeight(),
                                                 output_num_pixels_);
    output_format_.width = static_cast<int>(in_frame->GetWidth() * scale);
    output_format_.height = static_cast<int>(in_frame->GetHeight() * scale);
  }

  if (should_drop) {
    *out_frame = NULL;
    return true;
  }

  if (!StretchToOutputFrame(in_frame)) {
    return false;
  }

  *out_frame = output_frame_.get();
  return true;
}

bool VideoAdapter::StretchToOutputFrame(const VideoFrame* in_frame) {
  int output_width = output_format_.width;
  int output_height = output_format_.height;

  // Create and stretch the output frame if it has not been created yet or its
  // size is not same as the expected.
  bool stretched = false;
  if (!output_frame_.get() ||
      output_frame_->GetWidth() != static_cast<size_t>(output_width) ||
      output_frame_->GetHeight() != static_cast<size_t>(output_height)) {
    output_frame_.reset(
        in_frame->Stretch(output_width, output_height, true, true));
    if (!output_frame_.get()) {
      LOG(LS_WARNING) << "Adapter failed to stretch frame to "
                      << output_width << "x" << output_height;
      return false;
    }
    stretched = true;
    is_black_ = false;
  }

  if (!black_output_) {
    if (!stretched) {
      // The output frame does not need to be blacken and has not been stretched
      // from the input frame yet, stretch the input frame. This is the most
      // common case.
      in_frame->StretchToFrame(output_frame_.get(), true, true);
    }
    is_black_ = false;
  } else {
    if (!is_black_) {
      output_frame_->SetToBlack();
      is_black_ = true;
    }
    output_frame_->SetElapsedTime(in_frame->GetElapsedTime());
    output_frame_->SetTimeStamp(in_frame->GetTimeStamp());
  }

  return true;
}

///////////////////////////////////////////////////////////////////////
// Implementation of CoordinatedVideoAdapter
CoordinatedVideoAdapter::CoordinatedVideoAdapter()
    : cpu_adaptation_(false),
      gd_adaptation_(true),
      view_adaptation_(true),
      cpu_downgrade_count_(0),
      cpu_downgrade_wait_time_(0),
      view_desired_num_pixels_(INT_MAX),
      view_desired_interval_(0),
      encoder_desired_num_pixels_(INT_MAX),
      cpu_desired_num_pixels_(INT_MAX) {
}

// Helper function to UPGRADE or DOWNGRADE a number of pixels
void CoordinatedVideoAdapter::StepPixelCount(
    CoordinatedVideoAdapter::AdaptRequest request,
    int* num_pixels) {
  switch (request) {
    case CoordinatedVideoAdapter::DOWNGRADE:
      *num_pixels /= 2;
      break;

    case CoordinatedVideoAdapter::UPGRADE:
      *num_pixels *= 2;
      break;

    default:  // No change in pixel count
      break;
  }
  return;
}

// Find the adaptation request of the cpu based on the load. Return UPGRADE if
// the load is low, DOWNGRADE if the load is high, and KEEP otherwise.
CoordinatedVideoAdapter::AdaptRequest CoordinatedVideoAdapter::FindCpuRequest(
    int current_cpus, int max_cpus,
    float process_load, float system_load) {
  // Downgrade if system is high and plugin is at least more than midrange.
  if (system_load >= kHighSystemThreshold * max_cpus &&
      process_load >= kMediumProcessThreshold * current_cpus) {
    return CoordinatedVideoAdapter::DOWNGRADE;
  // Upgrade if system is low.
  } else if (system_load < kLowSystemThreshold * max_cpus) {
    return CoordinatedVideoAdapter::UPGRADE;
  }
  return CoordinatedVideoAdapter::KEEP;
}

// A remote view request for a new resolution.
void CoordinatedVideoAdapter::OnOutputFormatRequest(const VideoFormat& format) {
  talk_base::CritScope cs(&request_critical_section_);
  if (!view_adaptation_) {
    return;
  }
  // Set output for initial aspect ratio in mediachannel unittests.
  int old_num_pixels = GetOutputNumPixels();
  SetOutputFormat(format);
  SetOutputNumPixels(old_num_pixels);
  view_desired_num_pixels_ = format.width * format.height;
  view_desired_interval_ = format.interval;
  bool changed = AdaptToMinimumFormat();
  LOG(LS_INFO) << "VAdapt View Request: "
               << format.width << "x" << format.height
               << " Pixels: " << view_desired_num_pixels_
               << " Changed: " << (changed ? "true" : "false");
}

// A Bandwidth GD request for new resolution
void CoordinatedVideoAdapter::OnEncoderResolutionRequest(
    int width, int height, AdaptRequest request) {
  talk_base::CritScope cs(&request_critical_section_);
  if (!gd_adaptation_) {
    return;
  }
  if (KEEP != request) {
    int new_encoder_desired_num_pixels = width * height;
    int old_num_pixels = GetOutputNumPixels();
    if (new_encoder_desired_num_pixels != old_num_pixels) {
      LOG(LS_VERBOSE) << "VAdapt GD resolution stale.  Ignored";
    } else {
      // Update the encoder desired format based on the request.
      encoder_desired_num_pixels_ = new_encoder_desired_num_pixels;
      StepPixelCount(request, &encoder_desired_num_pixels_);
    }
  }
  bool changed = AdaptToMinimumFormat();
  LOG(LS_INFO) << "VAdapt GD Request: "
               << (DOWNGRADE == request ? "down" :
                   (UPGRADE == request ? "up" : "keep"))
               << " From: " << width << "x" << height
               << " Pixels: " << encoder_desired_num_pixels_
               << " Changed: " << (changed ? "true" : "false");
}

// A CPU request for new resolution
void CoordinatedVideoAdapter::OnCpuLoadUpdated(
    int current_cpus, int max_cpus, float process_load, float system_load) {
  talk_base::CritScope cs(&request_critical_section_);
  if (!cpu_adaptation_) {
    return;
  }
  AdaptRequest request = FindCpuRequest(current_cpus, max_cpus,
                                        process_load, system_load);
  // Update how many times we have downgraded due to the cpu load.
  switch (request) {
    case DOWNGRADE:
      if (cpu_downgrade_count_ < kMaxCpuDowngrades) {
        // Ignore downgrades if we have downgraded the maximum times or we just
        // downgraded in a short time.
        if (cpu_downgrade_wait_time_ != 0 &&
            talk_base::TimeIsLater(talk_base::Time(),
                                   cpu_downgrade_wait_time_)) {
          LOG(LS_VERBOSE) << "VAdapt CPU load high but do not downgrade until "
                          << talk_base::TimeUntil(cpu_downgrade_wait_time_)
                          << " ms.";
          request = KEEP;
        } else {
          ++cpu_downgrade_count_;
        }
      } else {
          LOG(LS_VERBOSE) << "VAdapt CPU load high but do not downgrade "
                             "because maximum downgrades reached";
      }
      break;
    case UPGRADE:
      if (cpu_downgrade_count_ > 0) {
        bool is_min = IsMinimumFormat(cpu_desired_num_pixels_);
        if (is_min) {
          --cpu_downgrade_count_;
        } else {
         LOG(LS_VERBOSE) << "VAdapt CPU load low but do not upgrade "
                             "because cpu is not limiting resolution";
        }
      } else {
          LOG(LS_VERBOSE) << "VAdapt CPU load low but do not upgrade "
                             "because minimum downgrades reached";
      }
      break;
    case KEEP:
    default:
      break;
  }
  if (KEEP != request) {
    // TODO: compute stepping up/down from OutputNumPixels but
    // clamp to inputpixels / 4 (2 steps)
    cpu_desired_num_pixels_ = static_cast<int>(
        input_format().width * input_format().height >> cpu_downgrade_count_);
  }
  bool changed = AdaptToMinimumFormat();
  LOG(LS_INFO) << "VAdapt CPU Request: "
               << (DOWNGRADE == request ? "down" :
                   (UPGRADE == request ? "up" : "keep"))
               << " Process: " << process_load
               << " System: " << system_load
               << " Steps: " << cpu_downgrade_count_
               << " Changed: " << (changed ? "true" : "false");
}

// Called by cpu adapter on up requests.
bool CoordinatedVideoAdapter::IsMinimumFormat(int pixels) {
  // Find closest scale factor that matches input resolution to min_num_pixels
  // and set that for output resolution.  This is not needed for VideoAdapter,
  // but provides feedback to unittests and users on expected resolution.
  // Actual resolution is based on input frame.
  VideoFormat new_output = output_format();
  VideoFormat input = input_format();
  if (input_format().IsSize0x0()) {
    input = new_output;
  }
  float scale = 1.0f;
  if (!input.IsSize0x0()) {
    scale = FindClosestScale(input.width,
                             input.height,
                             pixels);
  }
  new_output.width = static_cast<int>(input.width * scale);
  new_output.height = static_cast<int>(input.height * scale);
  int new_pixels = new_output.width * new_output.height;
  int num_pixels = GetOutputNumPixels();
  return new_pixels <= num_pixels;
}

// Called by all coordinators when there is a change.
bool CoordinatedVideoAdapter::AdaptToMinimumFormat() {
  int old_num_pixels = GetOutputNumPixels();
  // Get the min of the formats that the server, encoder, and cpu wants.
  int min_num_pixels = view_desired_num_pixels_;
  if (encoder_desired_num_pixels_ &&
      (encoder_desired_num_pixels_ < min_num_pixels)) {
    min_num_pixels = encoder_desired_num_pixels_;
  }
  if (cpu_adaptation_ && cpu_desired_num_pixels_ &&
      (cpu_desired_num_pixels_ < min_num_pixels)) {
    min_num_pixels = cpu_desired_num_pixels_;
    // Update the cpu_downgrade_wait_time_ if we are going to downgrade video.
    cpu_downgrade_wait_time_ =
      talk_base::TimeAfter(kDefaultDowngradeWaitTimeMs);
  }
  // prevent going below QQVGA
  if (min_num_pixels > 0 && min_num_pixels < kMinNumPixels) {
    min_num_pixels = kMinNumPixels;
  }
  SetOutputNumPixels(min_num_pixels);

  // Find closest scale factor that matches input resolution to min_num_pixels
  // and set that for output resolution.  This is not needed for VideoAdapter,
  // but provides feedback to unittests and users on expected resolution.
  // Actual resolution is based on input frame.
  VideoFormat new_output = output_format();
  VideoFormat input = input_format();
  if (input_format().IsSize0x0()) {
    input = new_output;
  }
  float scale = 1.0f;
  if (!input.IsSize0x0()) {
    scale = FindClosestScale(input.width,
                             input.height,
                             min_num_pixels);
  }
  new_output.width = static_cast<int>(input.width * scale);
  new_output.height = static_cast<int>(input.height * scale);
  new_output.interval = view_desired_interval_;
  SetOutputFormat(new_output);
  int new_num_pixels = GetOutputNumPixels();
  bool changed = new_num_pixels != old_num_pixels;

  LOG(LS_VERBOSE) << "VAdapt Status View: " << view_desired_num_pixels_
                  << " GD: " << encoder_desired_num_pixels_
                  << " CPU: " << cpu_desired_num_pixels_
                  << " Pixels: " << min_num_pixels
                  << " Scale: " << scale
                  << " Resolution: " << new_output.width
                  << "x" << new_output.height
                  << " Changed: " << (changed ? "true" : "false");
  return changed;
}

}  // namespace cricket
