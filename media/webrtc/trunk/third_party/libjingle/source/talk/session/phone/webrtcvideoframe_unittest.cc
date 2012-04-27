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
// TODO: Implement Jpeg
// TEST_WEBRTCVIDEOFRAME(ConstructMjpgI420)
// TEST_WEBRTCVIDEOFRAME(ConstructMjpgI422)
// TEST_WEBRTCVIDEOFRAME(ConstructMjpgI444)
// TEST_WEBRTCVIDEOFRAME(ConstructMjpgI411)
// TEST_WEBRTCVIDEOFRAME(ConstructMjpgI400)
// TEST_WEBRTCVIDEOFRAME(ValidateMjpgI420)
// TEST_WEBRTCVIDEOFRAME(ValidateMjpgI422)
// TEST_WEBRTCVIDEOFRAME(ValidateMjpgI444)
// TEST_WEBRTCVIDEOFRAME(ValidateMjpgI411)
// TEST_WEBRTCVIDEOFRAME(ValidateMjpgI400)

// TODO: WebRtcVideoFrame does not support odd sizes.
// Re-evaluate once WebRTC switches to libyuv
// TEST_WEBRTCVIDEOFRAME(ConstructYuy2AllSizes)
// TEST_WEBRTCVIDEOFRAME(ConstructARGBAllSizes)
TEST_WEBRTCVIDEOFRAME(Reset)
TEST_WEBRTCVIDEOFRAME(ConvertToABGRBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToABGRBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToABGRBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToARGB1555Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertToARGB1555BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToARGB1555BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToARGB4444Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertToARGB4444BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToARGB4444BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToARGBBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToARGBBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToARGBBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToBGRABuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToBGRABufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToBGRABufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToRAWBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToRAWBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToRAWBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToRGB24Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertToRGB24BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToRGB24BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToRGB565Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertToRGB565BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToRGB565BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerBGGRBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerBGGRBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerBGGRBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerGRBGBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerGRBGBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerGRBGBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerGBRGBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerGBRGBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerGBRGBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerRGGBBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerRGGBBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToBayerRGGBBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToI400Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertToI400BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToI400BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToYUY2Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertToYUY2BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToYUY2BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToUYVYBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertToUYVYBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToUYVYBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertToV210Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertToV210BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertToV210BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromABGRBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromABGRBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromABGRBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGB1555Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGB1555BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGB1555BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGB4444Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGB4444BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGB4444BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGBBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGBBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromARGBBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromBGRABuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromBGRABufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromBGRABufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromRAWBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromRAWBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromRAWBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromRGB24Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromRGB24BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromRGB24BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromRGB565Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromRGB565BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromRGB565BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerBGGRBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerBGGRBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerBGGRBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerGRBGBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerGRBGBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerGRBGBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerGBRGBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerGBRGBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerGBRGBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerRGGBBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerRGGBBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromBayerRGGBBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromI400Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromI400BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromI400BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromYUY2Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromYUY2BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromYUY2BufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromUYVYBuffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromUYVYBufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromUYVYBufferInverted)
TEST_WEBRTCVIDEOFRAME(ConvertFromV210Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertFromV210BufferStride)
TEST_WEBRTCVIDEOFRAME(ConvertFromV210BufferInverted)
//TEST_WEBRTCVIDEOFRAME(ConvertToI422Buffer)
TEST_WEBRTCVIDEOFRAME(ConvertARGBToBayerGRBG)
TEST_WEBRTCVIDEOFRAME(ConvertARGBToBayerGBRG)
TEST_WEBRTCVIDEOFRAME(ConvertARGBToBayerBGGR)
TEST_WEBRTCVIDEOFRAME(ConvertARGBToBayerRGGB)
TEST_WEBRTCVIDEOFRAME(CopyToBuffer)
TEST_WEBRTCVIDEOFRAME(CopyToBuffer1Pixel)
//TEST_WEBRTCVIDEOFRAME(ConstructARGBBlackWhitePixel)

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

