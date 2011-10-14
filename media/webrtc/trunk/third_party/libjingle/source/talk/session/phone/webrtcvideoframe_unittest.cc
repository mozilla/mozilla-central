// Copyright 2008 Google Inc. All Rights Reserved,
//
// Author: Justin Uberti (juberti@google.com)
//         Frank Barchard (fbarchard@google.com)
#include <string>

#include "talk/base/flags.h"
#include "talk/base/gunit.h"
#include "talk/base/pathutils.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/stream.h"
#include "talk/base/stringutils.h"
#include "talk/session/phone/formatconversion.h"
#include "talk/session/phone/webrtcvideoframe.h"
#include "talk/session/phone/testutils.h"
#include "talk/session/phone/videocommon.h"

enum {
  ROTATION_0 = 0,
  ROTATION_90 = 90,
  ROTATION_180 = 180,
  ROTATION_270 = 270
};

using cricket::WebRtcVideoFrame;
using cricket::FOURCC_I420;

static const int kWidth = 1280;
static const int kHeight = 720;
static const int kAlignment = 16;
static const std::string kImageFilename = "faces.1280x720_P420.yuv";

class WebRtcVideoFrameTest : public testing::Test {
 protected:
  virtual void SetUp() {
    // TODO: Fix (add a new flag) or remove repeat_.
    repeat_ = 1;
  }

 public:
  // Load a video frame from disk or a buffer.
  bool LoadFrame(const std::string& filename, uint32 format,
                 int32 width, int32 height, WebRtcVideoFrame* frame,
                 int rotation) {
    talk_base::scoped_ptr<talk_base::MemoryStream> ms(LoadSample(filename));
    return LoadFrame(ms.get(), format, width, height, frame, rotation);
  }

  bool LoadFrame(talk_base::MemoryStream* ms, uint32 format,
                 int32 width, int32 height, WebRtcVideoFrame* frame,
                 int rotation) {
    if (!ms) {
      return false;
    }
    size_t data_size;
    bool ret = ms->GetSize(&data_size);
    EXPECT_TRUE(ret);
    if (ret) {
      ret = LoadFrame(reinterpret_cast<uint8*>(ms->GetBuffer()), data_size,
                      format, width, height, frame, rotation);
    }
    return ret;
  }

  bool LoadFrame(uint8* sample, size_t sample_size, uint32 format,
                 int32 width, int32 height, WebRtcVideoFrame* frame,
                 int rotation) {
    for (int i = 0; i < repeat_; ++i) {
      if (!frame->Init(format, width, height, width, height,
                       sample, sample_size, 1, 1, 0, 0, 0)) {
        return false;
      }
    }
    return true;
  }

  talk_base::MemoryStream* LoadSample(const std::string& filename) {
    talk_base::Pathname path(cricket::GetTestFilePath(filename));
    talk_base::scoped_ptr<talk_base::FileStream> fs(
        talk_base::Filesystem::OpenFile(path, "rb"));
    if (!fs.get()) {
      return NULL;
    }

    char buf[4096];
    talk_base::scoped_ptr<talk_base::MemoryStream> ms(
        new talk_base::MemoryStream());
    talk_base::StreamResult res = Flow(fs.get(), buf, sizeof(buf), ms.get());
    if (res != talk_base::SR_SUCCESS) {
      return NULL;
    }

    return ms.release();
  }

  // Write an I420 frame out to disk.
  bool DumpFrame(const std::string& prefix,
                 const WebRtcVideoFrame& frame) {
    char filename[256];
    talk_base::sprintfn(filename, sizeof(filename), "%s.%dx%d_P420.yuv",
                        prefix.c_str(), frame.GetWidth(), frame.GetHeight());
    size_t out_size = cricket::VideoFrame::SizeOf(frame.GetWidth(),
                                                  frame.GetHeight());
    talk_base::scoped_array<uint8> out(new uint8[out_size]);
    frame.CopyToBuffer(out.get(), out_size);
    return DumpSample(filename, out.get(), out_size);
  }

  bool DumpSample(const std::string& filename, const void* buffer, int size) {
    talk_base::Pathname path(filename);
    talk_base::scoped_ptr<talk_base::FileStream> fs(
        talk_base::Filesystem::OpenFile(path, "wb"));
    if (!fs.get()) {
      return false;
    }

    return (fs->Write(buffer, size, NULL, NULL) == talk_base::SR_SUCCESS);
  }

  // Create a test image for YUV 420 formats with 12 bits per pixel.
  talk_base::MemoryStream* CreateYuv420Sample(uint32 width, uint32 height) {
    talk_base::scoped_ptr<talk_base::MemoryStream> ms(
        new talk_base::MemoryStream);
    if (!ms->ReserveSize(width * height * 12 / 8)) {
      return NULL;
    }

    for (uint32 i = 0; i < width * height * 12 / 8; ++i) {
      char value = ((i / 63) & 1) ? 192 : 64;
      ms->Write(&value, sizeof(value), NULL, NULL);
    }
    return ms.release();
  }

  talk_base::MemoryStream* CreateRgbSample(uint32 fourcc,
                                           uint32 width, uint32 height) {
    int r_pos, g_pos, b_pos, bytes;
    if (!GetRgbPacking(fourcc, &r_pos, &g_pos, &b_pos, &bytes)) {
      return NULL;
    }

    talk_base::scoped_ptr<talk_base::MemoryStream> ms(
        new talk_base::MemoryStream);
    if (!ms->ReserveSize(width * height * bytes)) {
      return NULL;
    }

    for (uint32 y = 0; y < height; ++y) {
      for (uint32 x = 0; x < width; ++x) {
        uint8 rgb[4] = { 255, 255, 255, 255 };
        rgb[r_pos] = ((x / 63) & 1) ? 224 : 32;
        rgb[g_pos] = (x % 63 + y % 63) + 96;
        rgb[b_pos] = ((y / 63) & 1) ? 224 : 32;
        ms->Write(rgb, bytes, NULL, NULL);
      }
    }
    return ms.release();
  }

  // Convert RGB to 420.
  // A negative height inverts the image.
  bool ConvertRgb(const talk_base::MemoryStream* ms,
                  uint32 fourcc, int32 width, int32 height,
                  WebRtcVideoFrame* frame) {
    int r_pos, g_pos, b_pos, bytes;
    if (!GetRgbPacking(fourcc, &r_pos, &g_pos, &b_pos, &bytes)) {
      return false;
    }
    int stride = width * bytes;
    const uint8* start = reinterpret_cast<const uint8*>(ms->GetBuffer());
    if (height < 0) {
      height = -height;
      start = start + stride * (height - 1);
      stride = -stride;
    }
    frame->InitToBlack(width, height, 1, 1, 0, 0);
    for (int32 y = 0; y < height; y += 2) {
      for (int32 x = 0; x < width; x += 2) {
        const uint8* rgb[4];
        uint8 yuv[4][3];
        rgb[0] = start + y * stride + x * bytes;
        rgb[1] = rgb[0] + bytes;
        rgb[2] = rgb[0] + stride;
        rgb[3] = rgb[2] + bytes;
        for (size_t i = 0; i < 4; ++i) {
          ConvertRgbPixel(rgb[i][r_pos], rgb[i][g_pos], rgb[i][b_pos],
                          &yuv[i][0], &yuv[i][1], &yuv[i][2]);
        }
        frame->GetYPlane()[width * y + x] = yuv[0][0];
        frame->GetYPlane()[width * y + x + 1] = yuv[1][0];
        frame->GetYPlane()[width * (y + 1) + x] = yuv[2][0];
        frame->GetYPlane()[width * (y + 1) + x + 1] = yuv[3][0];
        frame->GetUPlane()[width / 2 * (y / 2) + x / 2] =
            (yuv[0][1] + yuv[1][1] + yuv[2][1] + yuv[3][1] + 2) / 4;
        frame->GetVPlane()[width / 2 * (y / 2) + x / 2] =
            (yuv[0][2] + yuv[1][2] + yuv[2][2] + yuv[3][2] + 2) / 4;
      }
    }
    return true;
  }

  // Simple and slow RGB->YUV conversion. From NTSC standard, c/o Wikipedia.
  void ConvertRgbPixel(uint8 r, uint8 g, uint8 b,
                       uint8* y, uint8* u, uint8* v) {
    *y = static_cast<int>(.257 * r + .504 * g + .098 * b) + 16;
    *u = static_cast<int>(-.148 * r - .291 * g + .439 * b) + 128;
    *v = static_cast<int>(.439 * r - .368 * g - .071 * b) + 128;
  }

  bool GetRgbPacking(uint32 fourcc,
                     int* r_pos, int* g_pos, int* b_pos, int* bytes) {
    if (fourcc == cricket::FOURCC_RAW) {
      *r_pos = 0;
      *g_pos = 1;
      *b_pos = 2;
      *bytes = 3;  // RGB in memory
    } else if (fourcc == cricket::FOURCC_24BG) {
      *r_pos = 2;
      *g_pos = 1;
      *b_pos = 0;
      *bytes = 3;  // BGR in memory
    } else if (fourcc == cricket::FOURCC_ABGR) {
      *r_pos = 0;
      *g_pos = 1;
      *b_pos = 2;
      *bytes = 4;  // RGBA in memory
    } else if (fourcc == cricket::FOURCC_BGRA) {
      *r_pos = 1;
      *g_pos = 2;
      *b_pos = 3;
      *bytes = 4;  // ARGB in memory
    } else if (fourcc == cricket::FOURCC_ARGB) {
      *r_pos = 2;
      *g_pos = 1;
      *b_pos = 0;
      *bytes = 4;  // BGRA in memory
    } else {
      return false;
    }
    return true;
  }

  // Comparison functions for testing.
  static bool IsNull(const WebRtcVideoFrame& frame) {
    return !frame.HasImage();
  }

  static bool IsSize(const WebRtcVideoFrame& frame,
                     uint32 width, uint32 height) {
    return frame.HasImage() &&
        frame.GetYPitch() >= static_cast<int32>(width) &&
        frame.GetUPitch() >= static_cast<int32>(width) / 2 &&
        frame.GetVPitch() >= static_cast<int32>(width) / 2 &&
        frame.GetWidth() == width && frame.GetHeight() == height;
  }

  static bool IsPlaneEqual(const std::string& name,
                           const uint8* plane1, uint32 pitch1,
                           const uint8* plane2, uint32 pitch2,
                           uint32 width, uint32 height,
                           int max_error) {
    const uint8* r1 = plane1;
    const uint8* r2 = plane2;
    for (uint32 y = 0; y < height; ++y) {
      for (uint32 x = 0; x < width; ++x) {
        if (abs(static_cast<int>(r1[x] - r2[x])) > max_error) {
          LOG(LS_INFO) << "IsPlaneEqual(" << name << "): pixel["
                       << x << "," << y << "] differs: "
                       << static_cast<int>(r1[x]) << " vs "
                       << static_cast<int>(r2[x]);
          return false;
        }
      }
      r1 += pitch1;
      r2 += pitch2;
    }
    return true;
  }

  static bool IsFrameContiguous(const WebRtcVideoFrame& frame) {
    int width = frame.GetWidth();
    int height = frame.GetHeight();
    const uint8* y = frame.GetYPlane();
    const uint8* u = frame.GetUPlane();
    const uint8* v = frame.GetVPlane();
    int size = width * height * 3 / 2;
    bool u_near = (u - y) < size;
    bool v_near = (v - y) < size;
    return u_near && v_near;
  }

  static bool IsEqual(const WebRtcVideoFrame& frame,
                      size_t width, size_t height,
                      size_t pixel_width, size_t pixel_height,
                      int64 elapsed_time, int64 time_stamp,
                      const uint8* y, uint32 ypitch,
                      const uint8* u, uint32 upitch,
                      const uint8* v, uint32 vpitch,
                      int max_error) {
    if (!IsFrameContiguous(frame)) {
      LOG(LS_INFO) << "lmi frame is not contiguous";
    }
    return IsSize(frame, width, height) &&
        frame.GetPixelWidth() == pixel_width &&
        frame.GetPixelHeight() == pixel_height &&
        frame.GetElapsedTime() == elapsed_time &&
        frame.GetTimeStamp() == time_stamp &&
        IsPlaneEqual("y", frame.GetYPlane(), frame.GetYPitch(), y, ypitch,
                     width, height, max_error) &&
        IsPlaneEqual("u", frame.GetUPlane(), frame.GetUPitch(), u, upitch,
                     width / 2, height / 2, max_error) &&
        IsPlaneEqual("v", frame.GetVPlane(), frame.GetVPitch(), v, vpitch,
                     width / 2, height / 2, max_error);
  }

  static bool IsEqual(const WebRtcVideoFrame& frame1,
                      const WebRtcVideoFrame& frame2,
                      int max_error) {
    return IsEqual(frame1, frame2.GetWidth(), frame2.GetHeight(),
                frame2.GetPixelWidth(), frame2.GetPixelHeight(),
                frame2.GetElapsedTime(), frame2.GetTimeStamp(),
                frame2.GetYPlane(), frame2.GetYPitch(),
                frame2.GetUPlane(), frame2.GetUPitch(),
                frame2.GetVPlane(), frame2.GetVPitch(),
                max_error);
  }

 protected:
  int repeat_;
};

TEST_F(WebRtcVideoFrameTest, ConvertToARGBBuffer) {
  size_t out_size = kWidth * kHeight * 4;
  talk_base::scoped_array<uint8> outbuf(new uint8[out_size + kAlignment]);
  uint8 *out = ALIGNP(outbuf.get(), kAlignment);
  WebRtcVideoFrame frame;
  ASSERT_TRUE(LoadFrame(kImageFilename, FOURCC_I420, kWidth, kHeight,
                        &frame, ROTATION_0));

  // TODO: Add test to convert these back to I420, to ensure the
  // conversion is done correctly.
  for (int i = 0; i < repeat_; ++i) {
    EXPECT_EQ(out_size, frame.ConvertToRgbBuffer(cricket::FOURCC_ARGB,
                                                 out,
                                                 out_size, kWidth * 4));
  }
}

// Test basic contruction of an image from an I420 buffer.
TEST_F(WebRtcVideoFrameTest, InitI420) {
  WebRtcVideoFrame frame;
  EXPECT_TRUE(IsNull(frame));
  talk_base::scoped_ptr<talk_base::MemoryStream> ms(LoadSample(kImageFilename));
  ASSERT_TRUE(ms.get() != NULL);
  size_t data_size;
  ASSERT_TRUE(ms->GetSize(&data_size));
  uint8* buf = reinterpret_cast<uint8*>(ms->GetBuffer());
  EXPECT_TRUE(LoadFrame(buf, data_size, FOURCC_I420,
                        kWidth, kHeight, &frame, ROTATION_0));

  const uint8* y = reinterpret_cast<uint8*>(ms->GetBuffer());
  const uint8* u = y + kWidth * kHeight;
  const uint8* v = u + kWidth * kHeight / 4;
  EXPECT_TRUE(IsEqual(frame, kWidth, kHeight, 1, 1, 0, 0,
                      y, kWidth, u, kWidth / 2, v, kWidth / 2, 0));
}

// Test constructing an image from a I420 buffer
TEST_F(WebRtcVideoFrameTest, ConstructI420) {
  WebRtcVideoFrame frame;
  talk_base::scoped_ptr<talk_base::MemoryStream> ms(
      CreateYuv420Sample(kWidth, kHeight));
  EXPECT_TRUE(LoadFrame(ms.get(), cricket::FOURCC_I420,
                        kWidth, kHeight, &frame, ROTATION_0));

  const uint8* y = reinterpret_cast<uint8*>(ms.get()->GetBuffer());
  const uint8* u = y + kWidth * kHeight;
  const uint8* v = u + kWidth * kHeight / 4;
  EXPECT_TRUE(IsEqual(frame, kWidth, kHeight, 1, 1, 0, 0,
                      y, kWidth, u, kWidth / 2, v, kWidth / 2, 0));
}

// Test creating an empty image and initing it to black.
TEST_F(WebRtcVideoFrameTest, ConstructBlack) {
  WebRtcVideoFrame frame;
  for (int i = 0; i < repeat_; ++i) {
    EXPECT_TRUE(frame.InitToBlack(kWidth, kHeight, 1, 1, 0, 0));
  }
  EXPECT_TRUE(IsSize(frame, kWidth, kHeight));
  EXPECT_EQ(16, *frame.GetYPlane());
  EXPECT_EQ(128, *frame.GetUPlane());
  EXPECT_EQ(128, *frame.GetVPlane());
}

TEST_F(WebRtcVideoFrameTest, Copy) {
  WebRtcVideoFrame frame1;
  talk_base::scoped_ptr<cricket::WebRtcVideoFrame> frame2;
  ASSERT_TRUE(LoadFrame(kImageFilename, FOURCC_I420, kWidth, kHeight,
                        &frame1, ROTATION_0));
  frame2.reset(static_cast<WebRtcVideoFrame*>(frame1.Copy()));
  EXPECT_TRUE(IsEqual(frame1, *frame2.get(), 0));
}

TEST_F(WebRtcVideoFrameTest, CopyToBuffer) {
  size_t out_size = kWidth * kHeight * 3 / 2;
  talk_base::scoped_array<uint8> out(new uint8[out_size]);
  WebRtcVideoFrame frame;
  talk_base::scoped_ptr<talk_base::MemoryStream> ms(LoadSample(kImageFilename));
  ASSERT_TRUE(ms.get() != NULL);
  size_t data_size;
  ASSERT_TRUE(ms->GetSize(&data_size));
  EXPECT_TRUE(LoadFrame(reinterpret_cast<uint8*>(ms->GetBuffer()),
                        data_size, FOURCC_I420,
                        kWidth, kHeight, &frame, ROTATION_0));
  for (int i = 0; i < repeat_; ++i) {
    EXPECT_EQ(out_size, frame.CopyToBuffer(out.get(), out_size));
  }
  EXPECT_EQ(0, memcmp(out.get(), ms->GetBuffer(), out_size));
}

TEST_F(WebRtcVideoFrameTest, CopyToBuffer1Pixel) {
  size_t out_size = 3;
  talk_base::scoped_array<uint8> out(new uint8[out_size + 1]);
  memset(out.get(), 0xfb, out_size + 1);  // Fill buffer
  uint8 pixel[3] = { 1, 2, 3 };
  WebRtcVideoFrame frame;
  EXPECT_TRUE(LoadFrame(pixel, sizeof(pixel), FOURCC_I420,
                        1, 1, &frame, ROTATION_0));
  for (int i = 0; i < repeat_; ++i) {
    EXPECT_EQ(out_size, frame.CopyToBuffer(out.get(), out_size));
  }
  EXPECT_EQ(1, out.get()[0]);  // Check Y.  Should be 1.
  EXPECT_EQ(2, out.get()[1]);  // Check U.  Should be 2.
  EXPECT_EQ(3, out.get()[2]);  // Check V.  Should be 3.
  EXPECT_EQ(0xfb, out.get()[3]);  // Check sentinel is still intact.
}

// TODO: Merge this with the LmiVideoFrame test for more test cases
// when they are supported.
