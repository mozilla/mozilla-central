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

#include "talk/session/phone/videoframe.h"

#include <cstring>

#ifdef HAVE_YUV
#include "libyuv/planar_functions.h"
#include "libyuv/scale.h"
#endif
#include "talk/base/logging.h"

namespace cricket {

// Round to 2 pixels because Chroma channels are half size.
#define ROUNDTO2(v) (v & ~1)

// TODO: Handle odd width/height with rounding.
void VideoFrame::StretchToPlanes(
    uint8* y, uint8* u, uint8* v,
    int32 dst_pitch_y, int32 dst_pitch_u, int32 dst_pitch_v,
    size_t width, size_t height, bool interpolate, bool vert_crop) const {
#ifdef HAVE_YUV
  if (!GetYPlane() || !GetUPlane() || !GetVPlane())
    return;

  const uint8* in_y = GetYPlane();
  const uint8* in_u = GetUPlane();
  const uint8* in_v = GetVPlane();
  int32 iwidth = GetWidth();
  int32 iheight = GetHeight();

  if (vert_crop) {
    // Adjust the input width:height ratio to be the same as the output ratio.
    if (iwidth * height > iheight * width) {
      // Reduce the input width, but keep size/position aligned for YuvScaler
      iwidth = ROUNDTO2(iheight * width / height);
      int32 iwidth_offset = ROUNDTO2((GetWidth() - iwidth) / 2);
      in_y += iwidth_offset;
      in_u += iwidth_offset / 2;
      in_v += iwidth_offset / 2;
    } else if (iwidth * height < iheight * width) {
      // Reduce the input height.
      iheight = iwidth * height / width;
      int32 iheight_offset = (GetHeight() - iheight) >> 2;
      iheight_offset <<= 1;  // Ensure that iheight_offset is even.
      in_y += iheight_offset * GetYPitch();
      in_u += iheight_offset / 2 * GetUPitch();
      in_v += iheight_offset / 2 * GetVPitch();
    }
  }

  // Scale to the output I420 frame.
  libyuv::Scale(in_y, in_u, in_v,
                GetYPitch(),
                GetUPitch(),
                GetVPitch(),
                iwidth, iheight,
                y, u, v, dst_pitch_y, dst_pitch_u, dst_pitch_v,
                width, height, interpolate);
#endif
}

size_t VideoFrame::StretchToBuffer(size_t w, size_t h,
                                   uint8* buffer, size_t size,
                                   bool interpolate, bool vert_crop) const {
  if (!buffer) return 0;

  size_t needed = SizeOf(w, h);
  if (needed <= size) {
    uint8* bufy = buffer;
    uint8* bufu = bufy + w * h;
    uint8* bufv = bufu + ((w + 1) >> 1) * ((h + 1) >> 1);
    StretchToPlanes(bufy, bufu, bufv, w, (w + 1) >> 1, (w + 1) >> 1, w, h,
                    interpolate, vert_crop);
  }
  return needed;
}

void VideoFrame::StretchToFrame(VideoFrame *target,
                                bool interpolate, bool vert_crop) const {
  if (!target) return;

  StretchToPlanes(target->GetYPlane(),
                  target->GetUPlane(),
                  target->GetVPlane(),
                  target->GetYPitch(),
                  target->GetUPitch(),
                  target->GetVPitch(),
                  target->GetWidth(),
                  target->GetHeight(),
                  interpolate, vert_crop);
  target->SetElapsedTime(GetElapsedTime());
  target->SetTimeStamp(GetTimeStamp());
}

VideoFrame* VideoFrame::Stretch(size_t w, size_t h,
                                bool interpolate, bool vert_crop) const {
  VideoFrame* dest = CreateEmptyFrame(w, h, GetPixelWidth(), GetPixelHeight(),
                                      GetElapsedTime(), GetTimeStamp());
  if (dest) {
    StretchToFrame(dest, interpolate, vert_crop);
  }
  return dest;
}

bool VideoFrame::SetToBlack() {
#ifdef HAVE_YUV
  return libyuv::I420Rect(GetYPlane(), GetYPitch(),
                          GetUPlane(), GetUPitch(),
                          GetVPlane(), GetVPitch(),
                          0, 0, GetWidth(), GetHeight(),
                          16, 128, 128) == 0;
#else
  int uv_size = GetUPitch() * GetChromaHeight();
  memset(GetYPlane(), 16, GetWidth() * GetHeight());
  memset(GetUPlane(), 128, uv_size);
  memset(GetVPlane(), 128, uv_size);
  return true;
#endif
}

static const size_t kMaxSampleSize = 1000000000u;
// Returns whether a sample is valid
bool VideoFrame::Validate(uint32 fourcc, int w, int h,
                          const uint8 *sample, size_t sample_size) {
  if (h < 0) {
    h = -h;
  }
  // 16384 is maximum resolution for VP8 codec.
  if (w < 1 || w > 16384 || h < 1 || h > 16384) {
    LOG(LS_ERROR) << "Invalid dimensions: " << w << "x" << h;
    return false;
  }

  // Sanity check size field is not too small or too large.
  // 80 x 40 is less than half the minimum camera capture size
  // even a jpeg frame will be larger than 2048 bytes.
  if ((w * h >= 80 * 40 && sample_size < 2048) ||
      sample_size > kMaxSampleSize) {
    LOG(LS_ERROR) << "Invalid size field: " << sample_size;
    return false;
  }
  if (sample == NULL) {
    LOG(LS_ERROR) << "Invalid sample pointer";
    return false;
  }
  // Scan pages to ensure they are there
  // TODO: Remove or place with a faster function such as checksum.
  for (int i = 0; i < static_cast<int>(sample_size) - 4095; i += 4096) {
    const_cast<volatile const uint8*>(sample)[i];
  }
  const_cast<volatile const uint8*>(sample)[sample_size - 1];

  return true;
}

}  // namespace cricket

