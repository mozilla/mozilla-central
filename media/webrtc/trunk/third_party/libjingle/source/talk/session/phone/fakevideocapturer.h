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

#ifndef TALK_SESSION_PHONE_FAKEVIDEOCAPTURER_H_
#define TALK_SESSION_PHONE_FAKEVIDEOCAPTURER_H_

#include <vector>

#include <string.h>

#include "talk/session/phone/videocapturer.h"
#include "talk/session/phone/videocommon.h"
#include "talk/session/phone/videoframe.h"

namespace cricket {

// Fake video capturer that allows the test to manually pump in frames.
class FakeVideoCapturer : public cricket::VideoCapturer {
 public:
  FakeVideoCapturer()
      : running_(false),
        next_timestamp_(talk_base::kNumNanosecsPerMillisec) {
    // Default supported formats. Use ResetSupportedFormats to over write.
    std::vector<cricket::VideoFormat> formats;
    formats.push_back(cricket::VideoFormat(640, 480,
        cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
    formats.push_back(cricket::VideoFormat(320, 240,
        cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
    formats.push_back(cricket::VideoFormat(160, 120,
        cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
    ResetSupportedFormats(formats);
  }
  ~FakeVideoCapturer() {
    SignalDestroyed(this);
  }

  void ResetSupportedFormats(const std::vector<cricket::VideoFormat>& formats) {
    SetSupportedFormats(formats);
  }
  bool CaptureFrame() {
    if (!GetCaptureFormat()) {
      return false;
    }
    return CaptureCustomFrame(GetCaptureFormat()->width,
                              GetCaptureFormat()->height,
                              GetCaptureFormat()->fourcc);
  }
  bool CaptureCustomFrame(int width, int height, uint32 fourcc) {
    if (!running_) {
      return false;
    }

    // Currently, |fourcc| is always I420.
    uint32 size = cricket::VideoFrame::SizeOf(width, height);
    cricket::CapturedFrame frame;
    frame.width = width;
    frame.height = height;
    frame.fourcc = fourcc;
    frame.data_size = size;
    frame.elapsed_time = frame.time_stamp = next_timestamp_;
    next_timestamp_ += 33333333;  // 30 fps

    talk_base::scoped_array<char> data(new char[size]);
    memset(data.get(), 0, size);
    frame.data = data.get();
    // TODO: SignalFrameCaptured carry returned value to be able to
    // capture results from downstream.
    SignalFrameCaptured(this, &frame);
    return true;
  }
  sigslot::signal1<FakeVideoCapturer*> SignalDestroyed;

  virtual cricket::CaptureResult Start(const cricket::VideoFormat& format) {
    cricket::VideoFormat supported;
    if (GetBestCaptureFormat(format, &supported)) {
      SetCaptureFormat(&supported);
    }
    running_ = true;
    return cricket::CR_SUCCESS;
  }
  virtual void Stop() {
    running_ = false;
    SetCaptureFormat(NULL);
  }
  virtual bool IsRunning() { return running_; }
  bool GetPreferredFourccs(std::vector<uint32>* fourccs) {
    fourccs->push_back(cricket::FOURCC_I420);
    return true;
  }

 private:
  bool running_;
  int64 next_timestamp_;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_FAKEVIDEOCAPTURER_H_
