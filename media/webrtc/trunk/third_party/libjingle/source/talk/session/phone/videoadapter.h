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

#ifndef TALK_SESSION_PHONE_VIDEOADAPTER_H_
#define TALK_SESSION_PHONE_VIDEOADAPTER_H_

#include "talk/base/criticalsection.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/sigslot.h"
#include "talk/session/phone/videocommon.h"

namespace cricket {

class VideoFrame;

// VideoAdapter adapts an input video frame to an output frame based on the
// specified input and output formats. The adaptation includes dropping frames
// to reduce frame rate and scaling frames. VideoAdapter is thread safe.
class VideoAdapter {
 public:
  VideoAdapter();
  virtual ~VideoAdapter();

  void SetInputFormat(const VideoFormat& format);
  void SetOutputFormat(const VideoFormat& format);
  // Constrain output resolution to this many pixels overall
  void SetOutputNumPixels(int num_pixels);
  int GetOutputNumPixels() const;

  const VideoFormat& input_format();
  const VideoFormat& output_format();
  // If the parameter black is true, the adapted frames will be black.
  void SetBlackOutput(bool black);

  // Adapt the input frame from the input format to the output format. Return
  // true and set the output frame to NULL if the input frame is dropped. Return
  // true and set the out frame to output_frame_ if the input frame is adapted
  // successfully. Return false otherwise.
  // output_frame_ is owned by the VideoAdapter that has the best knowledge on
  // the output frame.
  bool AdaptFrame(const VideoFrame* in_frame, const VideoFrame** out_frame);

 protected:
  float FindClosestScale(int width, int height, int target_num_pixels);

 private:
  bool StretchToOutputFrame(const VideoFrame* in_frame);

  VideoFormat input_format_;
  VideoFormat output_format_;
  int output_num_pixels_;
  bool black_output_;  // Flag to tell if we need to black output_frame_.
  bool is_black_;  // Flag to tell if output_frame_ is currently black.
  int64 drop_frame_count_;
  talk_base::scoped_ptr<VideoFrame> output_frame_;
  // The critical section to protect the above variables.
  talk_base::CriticalSection critical_section_;

  DISALLOW_COPY_AND_ASSIGN(VideoAdapter);
};

// CoordinatedVideoAdapter adapts the video input to the encoder by coordinating
// the format request from the server, the resolution request from the encoder,
// and the CPU load.
class CoordinatedVideoAdapter
    : public VideoAdapter, public sigslot::has_slots<>  {
 public:
  enum AdaptRequest { UPGRADE, KEEP, DOWNGRADE };

  CoordinatedVideoAdapter();
  virtual ~CoordinatedVideoAdapter() {}

  // Enable or disable video adaptation due to the change of the CPU load.
  void set_cpu_adaptation(bool enable) { cpu_adaptation_ = enable; }
  bool cpu_adaptation() const { return cpu_adaptation_; }
  // Enable or disable video adaptation due to the change of the GD
  void set_gd_adaptation(bool enable) { gd_adaptation_ = enable; }
  bool gd_adaptation() const { return gd_adaptation_; }
  // Enable or disable video adaptation due to the change of the View
  void set_view_adaptation(bool enable) { view_adaptation_ = enable; }
  bool view_adaptation() const { return view_adaptation_; }
  // When the video is decreased, set the waiting time for CPU adaptation to
  // decrease video again.
  void set_cpu_downgrade_wait_time(uint32 ms) { cpu_downgrade_wait_time_ = ms; }
  // Handle the format request from the server via Jingle update message.
  void OnOutputFormatRequest(const VideoFormat& format);
  // Handle the resolution request from the encoder due to bandwidth changes.
  void OnEncoderResolutionRequest(int width, int height, AdaptRequest request);
  // Handle the CPU load provided by a CPU monitor.
  void OnCpuLoadUpdated(int current_cpus, int max_cpus,
                        float process_load, float system_load);

 private:
  // Adapt to the minimum of the formats the server requests, the CPU wants, and
  // the encoder wants.  Returns true if resolution changed.
  bool AdaptToMinimumFormat();
  bool IsMinimumFormat(int pixels);
  void StepPixelCount(CoordinatedVideoAdapter::AdaptRequest request,
                      int* num_pixels);
  CoordinatedVideoAdapter::AdaptRequest FindCpuRequest(
    int current_cpus, int max_cpus,
    float process_load, float system_load);

  bool cpu_adaptation_;  // True if cpu adaptation is enabled.
  bool gd_adaptation_;  // True if gd adaptation is enabled.
  bool view_adaptation_;  // True if view adaptation is enabled.
  int cpu_downgrade_count_;
  int cpu_downgrade_wait_time_;
  // Video formats that the server view requests, the CPU wants, and the encoder
  // wants respectively. The adapted output format is the minimum of these.
  int view_desired_num_pixels_;
  int64 view_desired_interval_;
  int encoder_desired_num_pixels_;
  int cpu_desired_num_pixels_;
  // The critical section to protect handling requests.
  talk_base::CriticalSection request_critical_section_;

  DISALLOW_COPY_AND_ASSIGN(CoordinatedVideoAdapter);
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_VIDEOADAPTER_H_
