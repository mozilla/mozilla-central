// libjingle
// Copyright 2004 Google Inc.
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
// Common definition for video, including fourcc and VideoFormat

#ifndef TALK_SESSION_PHONE_VIDEOCOMMON_H_
#define TALK_SESSION_PHONE_VIDEOCOMMON_H_

#include <string>

#include "talk/base/basictypes.h"
#include "talk/base/timeutils.h"

namespace cricket {

//////////////////////////////////////////////////////////////////////////////
// Definition of FourCC codes
//////////////////////////////////////////////////////////////////////////////
// Convert four characters to a FourCC code.
// Needs to be a macro otherwise the OS X compiler complains when the kFormat*
// constants are used in a switch.
#define FOURCC(a, b, c, d) ( \
    (static_cast<uint32>(a)) | (static_cast<uint32>(b) << 8) | \
    (static_cast<uint32>(c) << 16) | (static_cast<uint32>(d) << 24))

// Some pages discussing FourCC codes:
//   http://www.fourcc.org/yuv.php
//   http://v4l2spec.bytesex.org/spec/book1.htm
//   http://developer.apple.com/quicktime/icefloe/dispatch020.html

enum FourCC {
  // Canonical fourcc codes used in our code.
  FOURCC_I420 = FOURCC('I', '4', '2', '0'),
  FOURCC_I422 = FOURCC('I', '4', '2', '2'),
  FOURCC_I444 = FOURCC('I', '4', '4', '4'),
  FOURCC_I400 = FOURCC('I', '4', '0', '0'),
  FOURCC_YV12 = FOURCC('Y', 'V', '1', '2'),
  FOURCC_YV16 = FOURCC('Y', 'V', '1', '6'),
  FOURCC_YV24 = FOURCC('Y', 'V', '2', '4'),
  FOURCC_YUY2 = FOURCC('Y', 'U', 'Y', '2'),
  FOURCC_UYVY = FOURCC('U', 'Y', 'V', 'Y'),
  FOURCC_M420 = FOURCC('M', '4', '2', '0'),
  FOURCC_Q420 = FOURCC('Q', '4', '2', '0'),
  FOURCC_V210 = FOURCC('V', '2', '1', '0'),
  FOURCC_24BG = FOURCC('2', '4', 'B', 'G'),
  FOURCC_ABGR = FOURCC('A', 'B', 'G', 'R'),
  FOURCC_BGRA = FOURCC('B', 'G', 'R', 'A'),
  FOURCC_ARGB = FOURCC('A', 'R', 'G', 'B'),
  FOURCC_RGBP = FOURCC('R', 'G', 'B', 'P'), // bgr565
  FOURCC_RGBO = FOURCC('R', 'G', 'B', 'O'), // abgr1555
  FOURCC_R444 = FOURCC('R', '4', '4', '4'), // argb4444
  FOURCC_MJPG = FOURCC('M', 'J', 'P', 'G'),
  FOURCC_RAW  = FOURCC('r', 'a', 'w', ' '),
  FOURCC_NV21 = FOURCC('N', 'V', '2', '1'),
  FOURCC_NV12 = FOURCC('N', 'V', '1', '2'),
  // Next four are Bayer RGB formats. The four characters define the order of
  // the colours in each 2x2 pixel grid, going left-to-right and top-to-bottom.
  FOURCC_RGGB = FOURCC('R', 'G', 'G', 'B'),
  FOURCC_BGGR = FOURCC('B', 'G', 'G', 'R'),
  FOURCC_GRBG = FOURCC('G', 'R', 'B', 'G'),
  FOURCC_GBRG = FOURCC('G', 'B', 'R', 'G'),

  // Aliases for canonical fourcc codes, replaced with their canonical
  // equivalents by CanonicalFourCC().
  FOURCC_IYUV = FOURCC('I', 'Y', 'U', 'V'),  // Alias for I420
  FOURCC_YU12 = FOURCC('Y', 'U', '1', '2'),  // Alias for I420
  FOURCC_YU16 = FOURCC('Y', 'U', '1', '6'),  // Alias for I422
  FOURCC_YU24 = FOURCC('Y', 'U', '2', '4'),  // Alias for I444
  FOURCC_YUYV = FOURCC('Y', 'U', 'Y', 'V'),  // Alias for YUY2
  FOURCC_YUVS = FOURCC('y', 'u', 'v', 's'),  // Alias for YUY2 on Mac
  FOURCC_HDYC = FOURCC('H', 'D', 'Y', 'C'),  // Alias for UYVY
  FOURCC_2VUY = FOURCC('2', 'v', 'u', 'y'),  // Alias for UYVY
  FOURCC_JPEG = FOURCC('J', 'P', 'E', 'G'),  // Alias for MJPG
  FOURCC_DMB1 = FOURCC('d', 'm', 'b', '1'),  // Alias for MJPG on Mac
  FOURCC_BA81 = FOURCC('B', 'A', '8', '1'),  // Alias for BGGR
  FOURCC_RGB3 = FOURCC('R', 'G', 'B', '3'),  // Alias for RAW
  FOURCC_BGR3 = FOURCC('B', 'G', 'R', '3'),  // Alias for 24BG

  // Match any fourcc.
  FOURCC_ANY  = 0xFFFFFFFF,
};

// Converts fourcc aliases into canonical ones.
uint32 CanonicalFourCC(uint32 fourcc);

// Get FourCC code as a string
inline std::string GetFourccName(uint32 fourcc) {
  std::string name;
  name.push_back(static_cast<char>(fourcc & 0xFF));
  name.push_back(static_cast<char>((fourcc >> 8) & 0xFF));
  name.push_back(static_cast<char>((fourcc >> 16) & 0xFF));
  name.push_back(static_cast<char>((fourcc >> 24) & 0xFF));
  return name;
}

//////////////////////////////////////////////////////////////////////////////
// Definition of VideoFormat.
//////////////////////////////////////////////////////////////////////////////

// VideoFormat with Plain Old Data for global variables
struct VideoFormatPod {
  int width;  // in number of pixels
  int height;  // in number of pixels
  int64 interval;  // in nanoseconds
  uint32 fourcc;  // color space. FOURCC_ANY means that any color space is OK.
};

struct VideoFormat : VideoFormatPod{
  static const int64 kMinimumInterval =
      talk_base::kNumNanosecsPerSec / 10000;  // 10k fps

  VideoFormat() {
    Construct(0, 0, 0, 0);
  }

  VideoFormat(int w, int h, int64 interval_ns, uint32 cc) {
    Construct(w, h, interval_ns, cc);
  }

  explicit VideoFormat(const VideoFormatPod& format) {
    Construct(format.width, format.height, format.interval, format.fourcc);
  }

  void Construct(int w, int h, int64 interval_ns, uint32 cc) {
    width = w;
    height = h;
    interval = interval_ns;
    fourcc = cc;
  }

  static int64 FpsToInterval(int fps) {
    return fps ? talk_base::kNumNanosecsPerSec / fps : kMinimumInterval;
  }

  static int IntervalToFps(int64 interval) {
    // Normalize the interval first.
    interval = talk_base::_max(interval, kMinimumInterval);
    return static_cast<int>(talk_base::kNumNanosecsPerSec / interval);
  }

  bool operator==(const VideoFormat& format) const {
    return width == format.width && height == format.height &&
        interval == format.interval && fourcc == format.fourcc;
  }

  bool operator!=(const VideoFormat& format) const {
    return !(*this == format);
  }

  bool operator<(const VideoFormat& format) const {
    return (fourcc < format.fourcc) ||
        (fourcc == format.fourcc && width < format.width) ||
        (fourcc == format.fourcc && width == format.width &&
            height < format.height) ||
        (fourcc == format.fourcc && width == format.width &&
            height == format.height && interval > format.interval);
  }

  int framerate() const { return IntervalToFps(interval); }

  // Check if both width and height are 0.
  bool IsSize0x0() const { return 0 == width && 0 == height; }

  // Check if this format is less than another one by comparing the resolution
  // and frame rate.
  bool IsPixelRateLess(const VideoFormat& format) const {
    return width * height * framerate() <
        format.width * format.height * format.framerate();
  }

  // Get a string presentation in the form of "fourcc width x height x fps"
  std::string ToString() const;
};

// Result of video capturer start.
enum CaptureResult {
  CR_SUCCESS,    // The capturer starts successfully.
  CR_PENDING,    // The capturer is pending to start the capture device.
  CR_FAILURE,    // The capturer fails to start.
  CR_NO_DEVICE,  // The capturer has no device and fails to start.
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_VIDEOCOMMON_H_
