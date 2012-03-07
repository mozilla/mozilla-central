/*
 * libjingle
 * Copyright 2011 Google Inc.
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

#ifndef TALK_SESSION_PHONE_WEBRTCVIDEOFRAME_H_
#define TALK_SESSION_PHONE_WEBRTCVIDEOFRAME_H_

#ifdef WEBRTC_RELATIVE_PATH
#include "common_types.h"
#include "modules/interface/module_common_types.h"
#else
#include "third_party/webrtc/files/include/common_types.h"
#include "third_party/webrtc/files/include/module_common_types.h"
#endif
#include "talk/session/phone/videoframe.h"

namespace cricket {

struct CapturedFrame;

class WebRtcVideoFrame : public VideoFrame {
 public:
  WebRtcVideoFrame();
  ~WebRtcVideoFrame();

  // Creates a frame from a raw sample with FourCC "format" and size "w" x "h".
  // "h" can be negative indicating a vertically flipped image.
  // "dh" is destination height if cropping is desired and is always positive.
  // Returns "true" if successful.
  bool Init(uint32 format, int w, int h, int dw, int dh,
            uint8* sample, size_t sample_size,
            size_t pixel_width, size_t pixel_height,
            int64 elapsed_time, int64 time_stamp, int rotation);

  bool Init(const CapturedFrame* frame, int dw, int dh);

  bool InitToBlack(int w, int h, size_t pixel_width, size_t pixel_height,
                   int64 elapsed_time, int64 time_stamp);

  void Attach(uint8* buffer, size_t buffer_size, int w, int h,
              size_t pixel_width, size_t pixel_height,
              int64 elapsed_time, int64 time_stamp, int rotation);
  void Detach(uint8** buffer, size_t* buffer_size);
  bool AddWatermark();
  webrtc::VideoFrame* frame() { return &video_frame_; }

  // From base class VideoFrame.
  virtual bool Reset(uint32 format, int w, int h, int dw, int dh,
                   uint8* sample, size_t sample_size,
                   size_t pixel_width, size_t pixel_height,
                   int64 elapsed_time, int64 time_stamp, int rotation);

  virtual size_t GetWidth() const;
  virtual size_t GetHeight() const;
  virtual const uint8* GetYPlane() const;
  virtual const uint8* GetUPlane() const;
  virtual const uint8* GetVPlane() const;
  virtual uint8* GetYPlane();
  virtual uint8* GetUPlane();
  virtual uint8* GetVPlane();
  virtual int32 GetYPitch() const { return video_frame_.Width(); }
  virtual int32 GetUPitch() const { return (video_frame_.Width() + 1) / 2; }
  virtual int32 GetVPitch() const { return (video_frame_.Width() + 1) / 2; }

  virtual size_t GetPixelWidth() const { return pixel_width_; }
  virtual size_t GetPixelHeight() const { return pixel_height_; }
  virtual int64 GetElapsedTime() const { return elapsed_time_; }
  virtual int64 GetTimeStamp() const { return time_stamp_; }
  virtual void SetElapsedTime(int64 elapsed_time) {
    elapsed_time_ = elapsed_time;
  }
  virtual void SetTimeStamp(int64 time_stamp) {
    time_stamp_ = time_stamp;
  }

  virtual int GetRotation() const { return rotation_; }

  virtual VideoFrame* Copy() const;
  virtual bool MakeExclusive();
  virtual size_t CopyToBuffer(uint8* buffer, size_t size) const;
  virtual size_t ConvertToRgbBuffer(uint32 to_fourcc, uint8* buffer,
                                    size_t size, int stride_rgb) const;

 private:
  virtual VideoFrame* CreateEmptyFrame(int w, int h,
                                       size_t pixel_width, size_t pixel_height,
                                       int64 elapsed_time,
                                       int64 time_stamp) const;
  void InitToEmptyBuffer(int w, int h,
                         size_t pixel_width, size_t pixel_height,
                         int64 elapsed_time, int64 time_stamp);

  webrtc::VideoFrame video_frame_;
  size_t pixel_width_;
  size_t pixel_height_;
  int64 elapsed_time_;
  int64 time_stamp_;
  int rotation_;
};
}  // namespace cricket

#endif  // TALK_SESSION_PHONE_WEBRTCVIDEOFRAME_H_
