/*
 * libjingle
 * Copyright 2011, Google Inc.
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

#ifndef TALK_SESSION_PHONE_FAKEVIDEORENDERER_H_
#define TALK_SESSION_PHONE_FAKEVIDEORENDERER_H_

#include "talk/base/sigslot.h"
#include "talk/session/phone/videoframe.h"
#include "talk/session/phone/videorenderer.h"

namespace cricket {

// Faked video renderer that has a callback for actions on rendering.
class FakeVideoRenderer : public VideoRenderer {
 public:
  FakeVideoRenderer()
      : errors_(0),
        width_(0),
        height_(0),
        num_set_sizes_(0),
        num_rendered_frames_(0) {
  }

  virtual bool SetSize(int width, int height, int reserved) {
    width_ = width;
    height_ = height;
    ++num_set_sizes_;
    SignalSetSize(width, height, reserved);
    return true;
  }

  virtual bool RenderFrame(const VideoFrame* frame) {
    // Treat unexpected frame size as error.
    if (!frame ||
        frame->GetWidth() != static_cast<size_t>(width_) ||
        frame->GetHeight() != static_cast<size_t>(height_)) {
      ++errors_;
      return false;
    }
    ++num_rendered_frames_;
    SignalRenderFrame(frame);
    return true;
  }

  int errors() const { return errors_; }
  int width() const { return width_; }
  int height() const { return height_; }
  int num_set_sizes() const { return num_set_sizes_; }
  int num_rendered_frames() const { return num_rendered_frames_; }

  sigslot::signal3<int, int, int> SignalSetSize;
  sigslot::signal1<const VideoFrame*> SignalRenderFrame;

 private:
  int errors_;
  int width_;
  int height_;
  int num_set_sizes_;
  int num_rendered_frames_;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_FAKEVIDEORENDERER_H_
