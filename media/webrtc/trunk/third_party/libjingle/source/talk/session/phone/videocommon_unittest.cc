/*
 * libjingle
 * Copyright 2008 Google Inc.
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

#include "talk/base/gunit.h"
#include "talk/session/phone/videocommon.h"

namespace cricket {

TEST(VideoCommonTest, TestCanonicalFourCC) {
  // Canonical fourccs are not changed.
  EXPECT_EQ(FOURCC_I420, CanonicalFourCC(FOURCC_I420));
  // The special FOURCC_ANY value is not changed.
  EXPECT_EQ(FOURCC_ANY, CanonicalFourCC(FOURCC_ANY));
  // Aliases are translated to the canonical equivalent.
  EXPECT_EQ(FOURCC_I420, CanonicalFourCC(FOURCC_IYUV));
  EXPECT_EQ(FOURCC_I422, CanonicalFourCC(FOURCC_YU16));
  EXPECT_EQ(FOURCC_I444, CanonicalFourCC(FOURCC_YU24));
  EXPECT_EQ(FOURCC_24BG, CanonicalFourCC(FOURCC_BGR3));
  EXPECT_EQ(FOURCC_RAW, CanonicalFourCC(FOURCC_RGB3));
  EXPECT_EQ(FOURCC_MJPG, CanonicalFourCC(FOURCC_DMB1));
}

// Test conversion between interval and fps
TEST(VideoCommonTest, TestVideoFormatFps) {
  EXPECT_EQ(VideoFormat::kMinimumInterval, VideoFormat::FpsToInterval(0));
  EXPECT_EQ(talk_base::kNumNanosecsPerSec / 20, VideoFormat::FpsToInterval(20));
  EXPECT_EQ(20, VideoFormat::IntervalToFps(talk_base::kNumNanosecsPerSec / 20));
}

// Test IsSize0x0
TEST(VideoCommonTest, TestVideoFormatIsSize0x0) {
  VideoFormat format;
  EXPECT_TRUE(format.IsSize0x0());
  format.width = 320;
  EXPECT_FALSE(format.IsSize0x0());
}

// Test ToString: print fourcc when it is printable.
TEST(VideoCommonTest, TestVideoFormatToString) {
  VideoFormat format;
  EXPECT_EQ("0x0x10000", format.ToString());

  format.fourcc = FOURCC_I420;
  format.width = 640;
  format.height = 480;
  format.interval = VideoFormat::FpsToInterval(20);
  EXPECT_EQ("I420 640x480x20", format.ToString());

  format.fourcc = FOURCC_ANY;
  format.width = 640;
  format.height = 480;
  format.interval = VideoFormat::FpsToInterval(20);
  EXPECT_EQ("640x480x20", format.ToString());
}

// Test comparison.
TEST(VideoCommonTest, TestVideoFormatCompare) {
  VideoFormat format(640, 480, VideoFormat::FpsToInterval(20), FOURCC_I420);
  VideoFormat format2;
  EXPECT_NE(format, format2);

  // Same pixelrate, different fourcc.
  format2 = format;
  format2.fourcc = FOURCC_YUY2;
  EXPECT_NE(format, format2);
  EXPECT_FALSE(format.IsPixelRateLess(format2) ||
               format2.IsPixelRateLess(format2));

  format2 = format;
  format2.interval /= 2;
  EXPECT_TRUE(format.IsPixelRateLess(format2));

  format2 = format;
  format2.width *= 2;
  EXPECT_TRUE(format.IsPixelRateLess(format2));
}

}  // namespace cricket
