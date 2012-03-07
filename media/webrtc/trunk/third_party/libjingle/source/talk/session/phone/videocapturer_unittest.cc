// Copyright 2008 Google Inc. All Rights Reserved

#include <stdio.h>
#include <vector>

#include "talk/base/gunit.h"
#include "talk/base/logging.h"
#include "talk/base/thread.h"
#include "talk/session/phone/videocapturer.h"
#include "talk/session/phone/testutils.h"

namespace {

class FakeVideoCapturer : public cricket::VideoCapturer {
 public:
  FakeVideoCapturer() {
    // Default supported formats. Use ResetSupportedFormats to over write.
    std::vector<cricket::VideoFormat> formats;
    formats.push_back(cricket::VideoFormat(640, 480,
        cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
    formats.push_back(cricket::VideoFormat(320, 240,
        cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
    ResetSupportedFormats(formats);
  }
  ~FakeVideoCapturer() {}

  void ResetSupportedFormats(const std::vector<cricket::VideoFormat>& formats) {
    SetSupportedFormats(formats);
  }
  virtual cricket::CaptureResult Start(const cricket::VideoFormat& format) {
    return cricket::CR_SUCCESS;
  }
  virtual void Stop() {}
  virtual bool IsRunning() { return true; }
  bool GetPreferredFourccs(std::vector<uint32>* fourccs) {
    fourccs->push_back(cricket::FOURCC_I420);
    fourccs->push_back(cricket::FOURCC_MJPG);
    return true;
  }

 private:
  DISALLOW_COPY_AND_ASSIGN(FakeVideoCapturer);
};

TEST(VideoCapturerTest, TestFourccMatch) {
  FakeVideoCapturer capturer;
  cricket::VideoFormat desired(640, 480,
                               cricket::VideoFormat::FpsToInterval(30),
                               cricket::FOURCC_ANY);
  cricket::VideoFormat best;
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.fourcc = cricket::FOURCC_MJPG;
  EXPECT_FALSE(capturer.GetBestCaptureFormat(desired, &best));

  desired.fourcc = cricket::FOURCC_I420;
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
}

TEST(VideoCapturerTest, TestResolutionMatch) {
  FakeVideoCapturer capturer;
  cricket::VideoFormat desired(960, 720,
                               cricket::VideoFormat::FpsToInterval(30),
                               cricket::FOURCC_ANY);
  cricket::VideoFormat best;
  // Ask for 960x720. Get VGA which is the highest.
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 360;
  desired.height = 250;
  // Ask for a little higher than QVGA. Get QVGA.  On OSX gets VGA
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
#ifdef OSX
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
#else
  EXPECT_EQ(320, best.width);
  EXPECT_EQ(240, best.height);
#endif
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 480;
  desired.height = 270;
  // Ask for HVGA. Get VGA.
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 320;
  desired.height = 240;
  // Ask for QVGA. Get QVGA.  On OSX get VGA
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
#ifdef OSX
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
#else
  EXPECT_EQ(320, best.width);
  EXPECT_EQ(240, best.height);
#endif
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 160;
  desired.height = 120;
  // Ask for lower than QVGA. Get QVGA, which is the lowest.  OSX gets VGA
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
#ifdef OSX
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
#else
  EXPECT_EQ(320, best.width);
  EXPECT_EQ(240, best.height);
#endif
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);
}

TEST(VideoCapturerTest, TestHDResolutionMatch) {
  FakeVideoCapturer capturer;

  // Add some HD formats
  std::vector<cricket::VideoFormat> formats;
  formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  formats.push_back(cricket::VideoFormat(960, 544,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  formats.push_back(cricket::VideoFormat(2592, 1944,
      cricket::VideoFormat::FpsToInterval(15), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(formats);

  cricket::VideoFormat desired(960, 720,
                               cricket::VideoFormat::FpsToInterval(30),
                               cricket::FOURCC_ANY);
  cricket::VideoFormat best;
  // Ask for 960x720. Get qHD
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
  EXPECT_EQ(960, best.width);
  EXPECT_EQ(544, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 360;
  desired.height = 250;
  // Ask for a litter higher than QVGA. Get QVGA.  OSX gets VGA
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
#ifdef OSX
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
#else
  EXPECT_EQ(320, best.width);
  EXPECT_EQ(240, best.height);
#endif
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 480;
  desired.height = 270;
  // Ask for HVGA. Get VGA.
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 320;
  desired.height = 240;
  // Ask for QVGA. Get QVGA.  OSX gets VGA
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
#ifdef OSX
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
#else
  EXPECT_EQ(320, best.width);
  EXPECT_EQ(240, best.height);
#endif
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 160;
  desired.height = 120;
  // Ask for lower than QVGA. Get QVGA, which is the lowest.
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
#ifdef OSX
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
#else
  EXPECT_EQ(320, best.width);
  EXPECT_EQ(240, best.height);
#endif
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 1280;
  desired.height = 720;
  // Ask for HD. Get qHD.
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
  EXPECT_EQ(960, best.width);
  EXPECT_EQ(544, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  desired.width = 1920;
  desired.height = 1080;
  // Ask for 1080p. Get 2592x1944x15.
  EXPECT_TRUE(capturer.GetBestCaptureFormat(desired, &best));
  EXPECT_EQ(2592, best.width);
  EXPECT_EQ(1944, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(15), best.interval);
}

// Some cameras support 320x240 and 320x640. Verify we choose 320x240.
// On OSX we choose VGA
TEST(VideoCapturerTest, TestStrangeFormats) {
  FakeVideoCapturer capturer;
  std::vector<cricket::VideoFormat> supported_formats;
  supported_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(320, 640,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  std::vector<cricket::VideoFormat> required_formats;
  required_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  required_formats.push_back(cricket::VideoFormat(320, 200,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  required_formats.push_back(cricket::VideoFormat(320, 180,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  cricket::VideoFormat best;
  for (size_t i = 0; i < required_formats.size(); ++i) {
    EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[i], &best));
    EXPECT_EQ(320, best.width);
    EXPECT_EQ(240, best.height);
  }

  supported_formats.clear();
  supported_formats.push_back(cricket::VideoFormat(320, 640,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  for (size_t i = 0; i < required_formats.size(); ++i) {
    EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[i], &best));
    EXPECT_EQ(320, best.width);
    EXPECT_EQ(240, best.height);
  }
}

// Some cameras only have very low fps. Verify we choose something sensible.
TEST(VideoCapturerTest, TestPoorFpsFormats) {
  FakeVideoCapturer capturer;
  // all formats are low framerate
  std::vector<cricket::VideoFormat> supported_formats;
  supported_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(10), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(7), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(1280, 720,
      cricket::VideoFormat::FpsToInterval(2), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  std::vector<cricket::VideoFormat> required_formats;
  required_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  required_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  cricket::VideoFormat best;
  for (size_t i = 0; i < required_formats.size(); ++i) {
    EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[i], &best));
#ifdef OSX
    EXPECT_EQ(640, best.width);
    EXPECT_EQ(480, best.height);
#else
    EXPECT_EQ(required_formats[i].width, best.width);
    EXPECT_EQ(required_formats[i].height, best.height);
#endif
  }

  // Increase framerate of 320x240.  Expect low fps VGA avoided.
  // Except on Mac, where QVGA is avoid due to aspect ratio.
  supported_formats.clear();
  supported_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(15), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(7), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(1280, 720,
      cricket::VideoFormat::FpsToInterval(2), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  for (size_t i = 0; i < required_formats.size(); ++i) {
    EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[i], &best));
    EXPECT_EQ(320, best.width);
    EXPECT_EQ(240, best.height);
  }
}

// Some cameras support same size with different frame rates. Verify we choose
// the frame rate properly.
TEST(VideoCapturerTest, TestSameSizeDifferentFpsFormats) {
  FakeVideoCapturer capturer;
  std::vector<cricket::VideoFormat> supported_formats;
  supported_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(10), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(20), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(320, 240,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  std::vector<cricket::VideoFormat> required_formats = supported_formats;
  cricket::VideoFormat best;
  for (size_t i = 0; i < required_formats.size(); ++i) {
    EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[i], &best));
    EXPECT_EQ(320, best.width);
    EXPECT_EQ(240, best.height);
    EXPECT_EQ(required_formats[i].interval, best.interval);
  }
}

// Some cameras support the correct resolution but at a lower fps than
// we'd like.  This tests we get the expected resolution and fps.
TEST(VideoCapturerTest, TestFpsFormats) {
  FakeVideoCapturer capturer;
  // We have VGA but low fps.  Choose VGA, not HD
  std::vector<cricket::VideoFormat> supported_formats;
  supported_formats.push_back(cricket::VideoFormat(1280, 720,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(15), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 400,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 360,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  std::vector<cricket::VideoFormat> required_formats;
  required_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_ANY));
  required_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(20), cricket::FOURCC_ANY));
  required_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(10), cricket::FOURCC_ANY));
  cricket::VideoFormat best;

  // expect 30 fps to choose 15 fps format
  EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[0], &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(15), best.interval);

  // expect 20 fps to choose 15 fps format
  EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[1], &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(15), best.interval);

  // expect 10 fps to choose 15 fps format but set fps to 10
  EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[2], &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(10), best.interval);

  // We have VGA 60 fps and 15 fps.  Choose best fps.
  supported_formats.clear();
  supported_formats.push_back(cricket::VideoFormat(1280, 720,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(60), cricket::FOURCC_MJPG));
  supported_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(15), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 400,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 360,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  // expect 30 fps to choose 60 fps format, but will set best fps to 30
  EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[0], &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(30), best.interval);

  // expect 20 fps to choose 60 fps format, but will set best fps to 20
  EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[1], &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(20), best.interval);

  // expect 10 fps to choose 10 fps
  EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[2], &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(480, best.height);
  EXPECT_EQ(cricket::VideoFormat::FpsToInterval(10), best.interval);
}

TEST(VideoCapturerTest, TestRequest16x10_9) {
  FakeVideoCapturer capturer;
  std::vector<cricket::VideoFormat> supported_formats;
  // We do not support HD, expect 4x3 for 4x3, 16x10, and 16x9 requests.
  supported_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 400,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 360,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  std::vector<cricket::VideoFormat> required_formats = supported_formats;
  cricket::VideoFormat best;
  // Expect 4x3 for 4x3, 16x10, and 16x9 requests.
  for (size_t i = 0; i < required_formats.size(); ++i) {
    EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[i], &best));
    EXPECT_EQ(640, best.width);
    EXPECT_EQ(480, best.height);
  }

  // We do not support 16x9 HD, expect 4x3 for 4x3, 16x10, and 16x9 requests.
  supported_formats.clear();
  supported_formats.push_back(cricket::VideoFormat(960, 720,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 400,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 360,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  // Expect 4x3 for 4x3, 16x10, and 16x9 requests.
  for (size_t i = 0; i < required_formats.size(); ++i) {
    EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[i], &best));
    EXPECT_EQ(640, best.width);
    EXPECT_EQ(480, best.height);
  }

  // We support 16x9HD, expect 4x3 for 4x3 and 16x10 requests and expect 16x9
  // for 16x9 request.
  supported_formats.clear();
  supported_formats.push_back(cricket::VideoFormat(1280, 720,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 480,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 400,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  supported_formats.push_back(cricket::VideoFormat(640, 360,
      cricket::VideoFormat::FpsToInterval(30), cricket::FOURCC_I420));
  capturer.ResetSupportedFormats(supported_formats);

  // Expect 4x3 for 4x3 and 16x10 requests.
  for (size_t i = 0; i < required_formats.size() - 1; ++i) {
    EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[i], &best));
    EXPECT_EQ(640, best.width);
    EXPECT_EQ(480, best.height);
  }

  // Expect 16x9 for 16x9 request.
  EXPECT_TRUE(capturer.GetBestCaptureFormat(required_formats[2], &best));
  EXPECT_EQ(640, best.width);
  EXPECT_EQ(360, best.height);
}

}  // unnamed namespace
