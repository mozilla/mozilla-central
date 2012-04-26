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

#include "talk/app/webrtc/test/fakevideocapturemodule.h"

#include "talk/app/webrtc/test/fileframesource.h"
#include "talk/app/webrtc/test/i420framesource.h"
#include "talk/app/webrtc/test/staticframesource.h"
#include "talk/base/refcount.h"
#include "talk/base/stream.h"
#include "talk/base/thread.h"

#ifdef WEBRTC_RELATIVE_PATH
#include "modules/video_capture/main/interface/video_capture_defines.h"
#include "modules/video_capture/main/interface/video_capture_factory.h"
#else
#include "third_party/webrtc/files/include/video_capture_defines.h"
#include "third_party/webrtc/files/include/video_capture_factory.h"
#endif

static const int kStartFrameRate = 30;
static const int kStartWidth = 352;
static const int kStartHeight = 288;
static const uint32 kStartTimeStamp = 2000;

FakeVideoCaptureModule::FakeVideoCaptureModule(talk_base::Thread* camera_thread)
    : frame_source_(NULL),
      camera_thread_(camera_thread),
      video_capture_(NULL),
      started_(false),
      capture_started_(false),
      sent_frames_(0),
      next_frame_time_(0),
      time_per_frame_ms_(0),
      fps_(0),
      width_(0),
      height_(0) {}

FakeVideoCaptureModule::~FakeVideoCaptureModule() {
  StopCapturing();
  // The memory associated with video_capture_ is owned by impl_.
}

FakeVideoCaptureModule*
FakeVideoCaptureModule::Create(talk_base::Thread* camera_thread) {
  talk_base::RefCountedObject<FakeVideoCaptureModule>* capture_module =
      new talk_base::RefCountedObject<FakeVideoCaptureModule>(camera_thread);
  if (!capture_module->Init(new StaticFrameSource())) {
    delete capture_module;
    return NULL;
  }
  return capture_module;
}

FakeVideoCaptureModule*
FakeVideoCaptureModule::Create(talk_base::Thread* camera_thread,
                               const std::string& file_name) {
  talk_base::RefCountedObject<FakeVideoCaptureModule>* capture_module =
      new talk_base::RefCountedObject<FakeVideoCaptureModule>(camera_thread);
  if (!capture_module->Init(FileFrameSource::Create(file_name))) {
    delete capture_module;
    return NULL;
  }
  return capture_module;
}

void FakeVideoCaptureModule::StartCapturing() {
  camera_thread_->Clear(this);
    // Only one post, no need to add any data to post.
  camera_thread_->Post(this);
}

void FakeVideoCaptureModule::StopCapturing() {
  camera_thread_->Clear(this);
}

bool FakeVideoCaptureModule::RegisterFrameSource(
    I420FrameSource* frame_source) {
  if (frame_source == NULL) {
    return false;
  }
  frame_source_ = frame_source;
  frame_source_->SetFrameSize(width_, height_);
  return true;
}

// TODO: deal with the rounding error.
bool FakeVideoCaptureModule::SetFrameRate(int fps) {
  if (fps <= 0) {
    return false;
  }
  fps_ = fps;
  time_per_frame_ms_ = 1000 / fps;
  return true;
}

void FakeVideoCaptureModule::SetSize(int width, int height) {
  width_ = width;
  height_ = height;
  image_.reset(new uint8[GetI420FrameLengthInBytes()]);
  if (frame_source_ != NULL) {
    frame_source_->SetFrameSize(width_, height_);
  }
}

bool FakeVideoCaptureModule::Init(I420FrameSource* frame_source) {
  if (!RegisterFrameSource(frame_source)) {
    return false;
  }
  SetSize(kStartWidth, kStartHeight);
  impl_ = webrtc::VideoCaptureFactory::Create(0,  // id
                                              video_capture_);
  if (impl_.get() == NULL) {
    return false;
  }
  if (video_capture_ == NULL) {
    return false;
  }
  if (!SetFrameRate(kStartFrameRate)) {
    return false;
  }
  return true;
}

// TODO: handle time wrapparound.
void FakeVideoCaptureModule::GenerateNewFrame() {
  if (!started_) {
    next_frame_time_ = talk_base::Time();
    started_ = true;
  }
  size_t read = 0;
  if (frame_source_->GetFrame(image_.get(), &read)) {
    ASSERT(read == GetI420FrameLengthInBytes());

    webrtc::VideoCaptureCapability capability;
    capability.width = width_;
    capability.height = height_;
    capability.rawType = webrtc::kVideoI420;
    video_capture_->IncomingFrame(image_.get(), GetI420FrameLengthInBytes(),
                                  capability, GetTimestamp());
    ++sent_frames_;
  }
  else {
    ASSERT(false);
  }
  next_frame_time_ += time_per_frame_ms_;
  const uint32 current_time = talk_base::Time();
  const uint32 wait_time = (next_frame_time_ > current_time) ?
      next_frame_time_ - current_time : 0;
  camera_thread_->PostDelayed(wait_time, this);
}

size_t FakeVideoCaptureModule::GetI420FrameLengthInBytes() {
  return webrtc_testing::GetI420FrameLengthInBytes(width_, height_);
}

// TODO: handle timestamp wrapparound.
uint32 FakeVideoCaptureModule::GetTimestamp() {
  return kStartTimeStamp + sent_frames_ * time_per_frame_ms_;
}
