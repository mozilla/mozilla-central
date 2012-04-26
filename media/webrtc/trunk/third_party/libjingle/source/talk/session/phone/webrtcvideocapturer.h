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

#ifndef TALK_SESSION_PHONE_WEBRTCVIDEOCAPTURER_H_
#define TALK_SESSION_PHONE_WEBRTCVIDEOCAPTURER_H_

#ifdef HAVE_WEBRTC_VIDEO

#include <string>
#include <vector>

#include "talk/base/messagehandler.h"
#include "talk/session/phone/videocapturer.h"
#ifdef WEBRTC_RELATIVE_PATH
#include "modules/video_capture/main/interface/video_capture.h"
#else
#include "third_party/webrtc/files/include/video_capture.h"
#endif

namespace cricket {

// Factory to allow injection of a VCM impl into WebRtcVideoCapturer.
// DeviceInfos do not have a Release() and therefore need an explicit Destroy().
class WebRtcVcmFactoryInterface {
 public:
  virtual ~WebRtcVcmFactoryInterface() {}
  virtual webrtc::VideoCaptureModule* Create(
      int id, const char* device) = 0;
  virtual webrtc::VideoCaptureModule::DeviceInfo* CreateDeviceInfo(int id) = 0;
  virtual void DestroyDeviceInfo(
      webrtc::VideoCaptureModule::DeviceInfo* info) = 0;
};

// WebRTC-based implementation of VideoCapturer.
class WebRtcVideoCapturer : public VideoCapturer,
                            public talk_base::MessageHandler,
                            public webrtc::VideoCaptureDataCallback {
 public:
  WebRtcVideoCapturer();
  explicit WebRtcVideoCapturer(WebRtcVcmFactoryInterface* factory);
  virtual ~WebRtcVideoCapturer();

  bool Init(const Device& device);
  bool Init(webrtc::VideoCaptureModule* module);

  // Override virtual methods of the parent class VideoCapturer.
  virtual bool GetBestCaptureFormat(const VideoFormat& desired,
                                    VideoFormat* best_format);
  virtual CaptureResult Start(const VideoFormat& capture_format);
  virtual void Stop();
  virtual bool IsRunning();

 protected:
  // Override virtual methods of the parent class VideoCapturer.
  virtual bool GetPreferredFourccs(std::vector<uint32>* fourccs);

 private:
  // Callback for our started event.
  virtual void OnMessage(talk_base::Message* message);
  // Callback when a frame is captured by camera.
  virtual void OnIncomingCapturedFrame(const WebRtc_Word32 id,
                                       webrtc::VideoFrame& frame,
                                       webrtc::VideoCodecType type);
  virtual void OnCaptureDelayChanged(const WebRtc_Word32 id,
                                     const WebRtc_Word32 delay);

  talk_base::scoped_ptr<WebRtcVcmFactoryInterface> factory_;
  webrtc::VideoCaptureModule* module_;
  int captured_frames_;
};

struct WebRtcCapturedFrame : public CapturedFrame {
 public:
  explicit WebRtcCapturedFrame(const webrtc::VideoFrame& frame);
};

}  // namespace cricket

#endif  // HAVE_WEBRTC_VIDEO
#endif  // TALK_SESSION_PHONE_WEBRTCVIDEOCAPTURER_H_
