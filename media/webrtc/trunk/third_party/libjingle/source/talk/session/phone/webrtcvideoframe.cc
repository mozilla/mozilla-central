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

#include "talk/session/phone/webrtcvideoframe.h"

#include "libyuv/convert.h"
#include "libyuv/planar_functions.h"
#include "talk/base/logging.h"
#include "talk/session/phone/videocapturer.h"
#include "talk/session/phone/videocommon.h"

namespace cricket {

static const int kWatermarkWidth = 8;
static const int kWatermarkHeight = 8;
static const int kWatermarkOffsetFromLeft = 8;
static const int kWatermarkOffsetFromBottom = 8;
static const unsigned char kWatermarkMaxYValue = 64;

WebRtcVideoFrame::WebRtcVideoFrame() {
}

WebRtcVideoFrame::~WebRtcVideoFrame() {
}

bool WebRtcVideoFrame::Init(uint32 format, int w, int h, int dw, int dh,
                            uint8* sample, size_t sample_size,
                            size_t pixel_width, size_t pixel_height,
                            int64 elapsed_time, int64 time_stamp,
                            int rotation) {
  return Reset(format, w, h, dw, dh, sample, sample_size,
               pixel_width, pixel_height, elapsed_time, time_stamp, rotation);
}

bool WebRtcVideoFrame::Init(const CapturedFrame* frame, int dw, int dh) {
  return Reset(frame->fourcc, frame->width, frame->height, dw, dh,
               static_cast<uint8*>(frame->data), frame->data_size,
               frame->pixel_width, frame->pixel_height,
               frame->elapsed_time, frame->time_stamp, frame->rotation);
}

bool WebRtcVideoFrame::InitToBlack(int w, int h,
                                   size_t pixel_width, size_t pixel_height,
                                   int64 elapsed_time, int64 time_stamp) {
  InitToEmptyBuffer(w, h, pixel_width, pixel_height, elapsed_time, time_stamp);
  return SetToBlack();
}

void WebRtcVideoFrame::Attach(uint8* buffer, size_t buffer_size, int w, int h,
                              size_t pixel_width, size_t pixel_height,
                              int64 elapsed_time, int64 time_stamp,
                              int rotation) {
  video_frame_.Free();
  WebRtc_UWord8* new_memory = buffer;
  WebRtc_UWord32 new_length = buffer_size;
  WebRtc_UWord32 new_size = buffer_size;
  video_frame_.Swap(new_memory, new_length, new_size);
  video_frame_.SetWidth(w);
  video_frame_.SetHeight(h);
  pixel_width_ = pixel_width;
  pixel_height_ = pixel_height;
  elapsed_time_ = elapsed_time;
  time_stamp_ = time_stamp;
  rotation_ = rotation;
}

void WebRtcVideoFrame::Detach(uint8** buffer, size_t* buffer_size) {
  WebRtc_UWord8* new_memory = NULL;
  WebRtc_UWord32 new_length = 0;
  WebRtc_UWord32 new_size = 0;
  video_frame_.Swap(new_memory, new_length, new_size);
  *buffer = new_memory;
  *buffer_size = new_size;
}

size_t WebRtcVideoFrame::GetWidth() const {
  return video_frame_.Width();
}

size_t WebRtcVideoFrame::GetHeight() const {
  return video_frame_.Height();
}

const uint8* WebRtcVideoFrame::GetYPlane() const {
  WebRtc_UWord8* buffer = video_frame_.Buffer();
  return buffer;
}

const uint8* WebRtcVideoFrame::GetUPlane() const {
  WebRtc_UWord8* buffer = video_frame_.Buffer();
  if (buffer) {
    buffer += (video_frame_.Width() * video_frame_.Height());
  }
  return buffer;
}

const uint8* WebRtcVideoFrame::GetVPlane() const {
  WebRtc_UWord8* buffer = video_frame_.Buffer();
  if (buffer) {
    int uv_size = GetChromaSize();
    buffer += video_frame_.Width() * video_frame_.Height() + uv_size;
  }
  return buffer;
}

uint8* WebRtcVideoFrame::GetYPlane() {
  WebRtc_UWord8* buffer = video_frame_.Buffer();
  return buffer;
}

uint8* WebRtcVideoFrame::GetUPlane() {
  WebRtc_UWord8* buffer = video_frame_.Buffer();
  if (buffer) {
    buffer += (video_frame_.Width() * video_frame_.Height());
  }
  return buffer;
}

uint8* WebRtcVideoFrame::GetVPlane() {
  WebRtc_UWord8* buffer = video_frame_.Buffer();
  if (buffer) {
    int uv_size = GetChromaSize();
    buffer += video_frame_.Width() * video_frame_.Height() + uv_size;
  }
  return buffer;
}

VideoFrame* WebRtcVideoFrame::Copy() const {
  WebRtc_UWord8* buffer = video_frame_.Buffer();
  if (!buffer)
    return NULL;

  size_t new_buffer_size = video_frame_.Length();
  uint8* new_buffer = new uint8[new_buffer_size];
  memcpy(new_buffer, buffer, new_buffer_size);
  WebRtcVideoFrame* copy = new WebRtcVideoFrame();
  copy->Attach(new_buffer, new_buffer_size,
               video_frame_.Width(), video_frame_.Height(),
               pixel_width_, pixel_height_,
               elapsed_time_, time_stamp_, rotation_);
  return copy;
}

bool WebRtcVideoFrame::MakeExclusive() {
  // WebRtcVideoFrame::Copy makes a deep copy of the frame buffer.  No action
  // is needed for MakeExclusive.
  return true;
}

size_t WebRtcVideoFrame::CopyToBuffer(uint8* buffer, size_t size) const {
  if (!video_frame_.Buffer()) {
    return 0;
  }

  size_t needed = video_frame_.Length();
  if (needed <= size) {
    memcpy(buffer, video_frame_.Buffer(), needed);
  }
  return needed;
}

// TODO: Refactor into base class and share with lmi
size_t WebRtcVideoFrame::ConvertToRgbBuffer(uint32 to_fourcc,
                                            uint8* buffer,
                                            size_t size,
                                            int stride_rgb) const {
  if (!video_frame_.Buffer()) {
    return 0;
  }
  size_t width = video_frame_.Width();
  size_t height = video_frame_.Height();
  size_t needed = (stride_rgb >= 0 ? stride_rgb : -stride_rgb) * height;
  if (size < needed) {
    LOG(LS_WARNING) << "RGB buffer is not large enough";
    return needed;
  }

  if (libyuv::ConvertFromI420(GetYPlane(), GetYPitch(),
                              GetUPlane(), GetUPitch(),
                              GetVPlane(), GetVPitch(),
                              buffer, stride_rgb,
                              width, height,
                              to_fourcc)) {
    LOG(LS_WARNING) << "RGB type not supported: " << to_fourcc;
    return 0;  // 0 indicates error
  }
  return needed;
}

// Add a square watermark near the left-low corner. clamp Y.
// Returns false on error.
bool WebRtcVideoFrame::AddWatermark() {
  size_t w = GetWidth();
  size_t h = GetHeight();

  if (w < kWatermarkWidth + kWatermarkOffsetFromLeft ||
      h < kWatermarkHeight + kWatermarkOffsetFromBottom) {
    return false;
  }

  uint8* buffer = GetYPlane();
  for (size_t x = kWatermarkOffsetFromLeft;
       x < kWatermarkOffsetFromLeft + kWatermarkWidth; ++x) {
    for (size_t y = h - kWatermarkOffsetFromBottom - kWatermarkHeight;
         y < h - kWatermarkOffsetFromBottom; ++y) {
      buffer[y * w + x] = talk_base::_min(buffer[y * w + x],
                                          kWatermarkMaxYValue);
    }
  }
  return true;
}

bool WebRtcVideoFrame::Reset(uint32 format, int w, int h, int dw, int dh,
                             uint8* sample, size_t sample_size,
                             size_t pixel_width, size_t pixel_height,
                             int64 elapsed_time, int64 time_stamp,
                             int rotation) {
  // WebRtcVideoFrame currently doesn't support color conversion or rotation.
  // TODO: Add horizontal cropping support.
  if (format != FOURCC_I420 || dw != w || dh < 0 || dh > abs(h) ||
      rotation != 0) {
    return false;
  }
  if (!Validate(format, w, h, sample, sample_size)) {
    return false;
  }

  // Discard the existing buffer.
  uint8* old_buffer;
  size_t old_buffer_size;
  Detach(&old_buffer, &old_buffer_size);
  delete[] old_buffer;

  // Set up a new buffer.
  size_t desired_size = SizeOf(dw, dh);
  uint8* buffer = new uint8[desired_size];
  Attach(buffer, desired_size, dw, dh, pixel_width, pixel_height,
         elapsed_time, time_stamp, rotation);

  if (dh == h) {
    // Uncropped
    memcpy(buffer, sample, desired_size);
  } else {
    // Cropped
    // TODO: use I420Copy which supports horizontal crop and vertical
    // flip.
    int horiz_crop = ((w - dw) / 2) & ~1;
    int vert_crop = ((abs(h) - dh) / 2) & ~1;
    int y_crop_offset = w * vert_crop + horiz_crop;
    int halfwidth = (w + 1) / 2;
    int halfheight = (h + 1) / 2;
    int uv_size = GetChromaSize();
    int uv_crop_offset = (halfwidth * vert_crop + horiz_crop) / 2;
    uint8* src_y = sample + y_crop_offset;
    uint8* src_u = sample + w * h + uv_crop_offset;
    uint8* src_v = sample + w * h + halfwidth * halfheight + uv_crop_offset;
    memcpy(GetYPlane(), src_y, dw * dh);
    memcpy(GetUPlane(), src_u, uv_size);
    memcpy(GetVPlane(), src_v, uv_size);
  }

  return true;
}

VideoFrame* WebRtcVideoFrame::CreateEmptyFrame(int w, int h,
                                               size_t pixel_width,
                                               size_t pixel_height,
                                               int64 elapsed_time,
                                               int64 time_stamp) const {
  WebRtcVideoFrame* frame = new WebRtcVideoFrame();
  frame->InitToEmptyBuffer(w, h, pixel_width, pixel_height,
                           elapsed_time, time_stamp);
  return frame;
}

void WebRtcVideoFrame::InitToEmptyBuffer(int w, int h,
                                         size_t pixel_width,
                                         size_t pixel_height,
                                         int64 elapsed_time,
                                         int64 time_stamp) {
  size_t buffer_size = VideoFrame::SizeOf(w, h);
  uint8* buffer = new uint8[buffer_size];
  Attach(buffer, buffer_size, w, h, pixel_width, pixel_height,
         elapsed_time, time_stamp, 0);
}

}  // namespace cricket
