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

// This class implements the VideoCaptureModule interface. Instead of capturing
// frames from a camera it captures frames from a file or a static frame.

#ifndef TALK_APP_WEBRTC_TEST_FAKEVIDEOCAPTUREMODULE_H_
#define TALK_APP_WEBRTC_TEST_FAKEVIDEOCAPTUREMODULE_H_

#include <string>

#include "talk/base/basictypes.h"
#include "talk/base/messagehandler.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/scoped_ref_ptr.h"

#ifdef WEBRTC_RELATIVE_PATH
#include "common_types.h"
#include "modules/video_capture/main/interface/video_capture.h"
#else
#include "third_party/webrtc/files/include/common_types.h"
#include "third_party/webrtc/files/include/video_capture.h"
#endif

namespace talk_base {

class Thread;

}  // namespace talk_base

namespace webrtc {

class VideoCaptureExternal;

}  // namespace webrtc

class I420FrameSource;

class FakeVideoCaptureModule
    : public webrtc::VideoCaptureModule,
      public talk_base::MessageHandler {
 public:
  virtual ~FakeVideoCaptureModule();

  static FakeVideoCaptureModule* Create(talk_base::Thread* camera_thread);
  static FakeVideoCaptureModule* Create(talk_base::Thread* camera_thread,
                                        const std::string& file_name);

  void StartCapturing();
  void StopCapturing();

  bool SetFrameRate(int fps);
  void SetSize(int width, int height);
  int sent_frames() const { return sent_frames_; }

  virtual int32_t ChangeUniqueId(const int32_t id) {
    return impl_->ChangeUniqueId(id);
  }

  virtual int32_t TimeUntilNextProcess() {
    return impl_->TimeUntilNextProcess();
  }

  virtual int32_t Process() {
    return impl_->Process();
  }

  virtual WebRtc_Word32 RegisterCaptureDataCallback(
      webrtc::VideoCaptureDataCallback& dataCallback) {
    return impl_->RegisterCaptureDataCallback(dataCallback);
  }

  virtual WebRtc_Word32 DeRegisterCaptureDataCallback() {
    return impl_->DeRegisterCaptureDataCallback();
  }

  virtual WebRtc_Word32 RegisterCaptureCallback(
      webrtc::VideoCaptureFeedBack& callBack) {
    return impl_->RegisterCaptureCallback(callBack);
  }

  virtual WebRtc_Word32 DeRegisterCaptureCallback() {
    return impl_->DeRegisterCaptureCallback();
  }

  virtual WebRtc_Word32 StartCapture(
      const webrtc::VideoCaptureCapability& capability) {
    capture_started_ = true;
    return 0;
  }

  virtual WebRtc_Word32 StopCapture() {
    capture_started_ = false;
    return 0;
  }

  virtual WebRtc_Word32 StartSendImage(const webrtc::VideoFrame& videoFrame,
                                       WebRtc_Word32 frameRate = 1) {
    return impl_->StartSendImage(videoFrame, frameRate = 1);
  }

  virtual WebRtc_Word32 StopSendImage() {
    return impl_->StopSendImage();
  }

  virtual const char* CurrentDeviceName() const {
    return impl_->CurrentDeviceName();
  }

  virtual bool CaptureStarted() {
    return capture_started_;
  }

  virtual WebRtc_Word32 CaptureSettings(
      webrtc::VideoCaptureCapability& settings) {
    return impl_->CaptureSettings(settings);
  }

  virtual WebRtc_Word32 SetCaptureDelay(WebRtc_Word32 delayMS) {
    return impl_->SetCaptureDelay(delayMS);
  }

  virtual WebRtc_Word32 CaptureDelay() {
    return impl_->CaptureDelay();
  }

  virtual WebRtc_Word32 SetCaptureRotation(
      webrtc::VideoCaptureRotation rotation) {
    return impl_->SetCaptureRotation(rotation);
  }

  virtual VideoCaptureEncodeInterface* GetEncodeInterface(
      const webrtc::VideoCodec& codec) {
    return impl_->GetEncodeInterface(codec);
  }

  virtual WebRtc_Word32 EnableFrameRateCallback(const bool enable) {
    return impl_->EnableFrameRateCallback(enable);
  }
  virtual WebRtc_Word32 EnableNoPictureAlarm(const bool enable) {
    return impl_->EnableNoPictureAlarm(enable);
  }

  // Inherited from MesageHandler.
  virtual void OnMessage(talk_base::Message* msg) {
    GenerateNewFrame();
  }

 protected:
  FakeVideoCaptureModule(talk_base::Thread* camera_thread);

 private:
  bool Init(I420FrameSource* frame_source);
  bool RegisterFrameSource(I420FrameSource* frame_source);

  void GenerateNewFrame();
  size_t GetI420FrameLengthInBytes();
  uint32 GetTimestamp();

  // Module interface implementation.
  talk_base::scoped_refptr<VideoCaptureModule> impl_;

  // Class that generates the frames from e.g. file or staticly.
  I420FrameSource* frame_source_;

  talk_base::Thread* camera_thread_;
  webrtc::VideoCaptureExternal* video_capture_;

  bool started_;
  bool capture_started_;
  int sent_frames_;
  uint32 next_frame_time_;
  uint32 time_per_frame_ms_;

  int fps_;
  int width_;
  int height_;
  talk_base::scoped_array<uint8> image_;
};

#endif  // TALK_APP_WEBRTC_TEST_FAKEVIDEOCAPTUREMODULE_H_
