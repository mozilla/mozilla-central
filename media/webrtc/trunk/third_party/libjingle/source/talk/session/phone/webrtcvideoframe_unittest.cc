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

#include "talk/base/flags.h"
#include "talk/session/phone/videoframe_unittest.h"
#include "talk/session/phone/webrtcvideoframe.h"

extern int FLAG_yuvconverter_repeat; // from lmivideoframe_unittest.cc

class WebRtcVideoFrameTest : public VideoFrameTest<cricket::WebRtcVideoFrame> {
 public:
  WebRtcVideoFrameTest() {
    repeat_ = FLAG_yuvconverter_repeat;
  }
};

#define TEST_WEBRTCVIDEOFRAME(X) TEST_F(WebRtcVideoFrameTest, X) { \
  VideoFrameTest<cricket::WebRtcVideoFrame>::X(); \
}

TEST_WEBRTCVIDEOFRAME(ConstructI420)
TEST_WEBRTCVIDEOFRAME(ConstructI4201Pixel)
// TODO: WebRtcVideoFrame does not support horizontal crop.
// Re-evaluate once it supports 3 independent planes, since we might want to
// just Init normally and then crop by adjusting pointers.
// TEST_WEBRTCVIDEOFRAME(ConstructI420CropHorizontal)
TEST_WEBRTCVIDEOFRAME(ConstructI420CropVertical)
// TODO: WebRtcVideoFrame is not currently refcounted.
// TEST_WEBRTCVIDEOFRAME(ConstructCopy)
// TEST_WEBRTCVIDEOFRAME(ConstructCopyIsRef)
TEST_WEBRTCVIDEOFRAME(ConstructBlack)
// TODO: WebRtcVideoFrame does not support odd sizes.
// Re-evaluate once WebRTC switches to libyuv
// TEST_LMIVIDEOFRAME(ConstructYuy2AllSizes)
// TODO: WebRtcVideoFrame currently only supports ARGB output.
#ifdef HAVE_YUV
TEST_WEBRTCVIDEOFRAME(ConvertToBGRABuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToABGRBuffer)
#endif
TEST_WEBRTCVIDEOFRAME(ConvertToARGBBuffer)
//TEST_WEBRTCVIDEOFRAME(ConvertToYUY2Buffer)
//TEST_WEBRTCVIDEOFRAME(ConvertToI422Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertARGBToBayerGRBG)
TEST_WEBRTCVIDEOFRAME(ConvertARGBToBayerGBRG)
TEST_WEBRTCVIDEOFRAME(ConvertARGBToBayerBGGR)
TEST_WEBRTCVIDEOFRAME(ConvertARGBToBayerRGGB)
TEST_WEBRTCVIDEOFRAME(CopyToBuffer)
TEST_WEBRTCVIDEOFRAME(CopyToBuffer1Pixel)
TEST_WEBRTCVIDEOFRAME(StretchToFrame)
TEST_WEBRTCVIDEOFRAME(Copy)
// TODO: WebRtcVideoFrame is not currently refcounted.
// TEST_WEBRTCVIDEOFRAME(CopyIsRef)
TEST_WEBRTCVIDEOFRAME(MakeExclusive)

// These functions test implementation-specific details.
TEST_F(WebRtcVideoFrameTest, AttachAndRelease) {
  cricket::WebRtcVideoFrame frame1, frame2;
  ASSERT_TRUE(LoadFrameNoRepeat(&frame1));
  const int64 time_stamp = 0x7FFFFFFFFFFFFFF0LL;
  frame1.SetTimeStamp(time_stamp);
  EXPECT_EQ(time_stamp, frame1.GetTimeStamp());
  frame2.Attach(frame1.frame()->Buffer(), frame1.frame()->Size(),
                kWidth, kHeight, 1, 1,
                frame1.GetElapsedTime(), frame1.GetTimeStamp(), 0);
  EXPECT_TRUE(IsEqual(frame1, frame2, 0));
  uint8* buffer;
  size_t size;
  frame2.Detach(&buffer, &size);
  EXPECT_EQ(frame1.frame()->Buffer(), buffer);
  EXPECT_EQ(frame1.frame()->Size(), size);
  EXPECT_TRUE(IsNull(frame2));
  EXPECT_TRUE(IsSize(frame1, kWidth, kHeight));
}

TEST_F(WebRtcVideoFrameTest, Transfer) {
  cricket::WebRtcVideoFrame frame1, frame2;
  ASSERT_TRUE(LoadFrameNoRepeat(&frame1));
  uint8* buffer;
  size_t size;
  frame1.Detach(&buffer, &size),
  frame2.Attach(buffer, size, kWidth, kHeight, 1, 1,
                frame1.GetElapsedTime(), frame1.GetTimeStamp(), 0);
  EXPECT_TRUE(IsNull(frame1));
  EXPECT_TRUE(IsSize(frame2, kWidth, kHeight));
}

