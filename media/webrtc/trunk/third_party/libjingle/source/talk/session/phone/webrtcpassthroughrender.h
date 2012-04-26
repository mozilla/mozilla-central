/*
 * libjingle
 * Copyright 2004--2011, Google Inc.
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

#ifndef TALK_SESSION_PHONE_WEBRTCPASSTHROUGHRENDER_H_
#define TALK_SESSION_PHONE_WEBRTCPASSTHROUGHRENDER_H_

#include <map>

#ifdef WEBRTC_RELATIVE_PATH
#include "modules/video_render/main/interface/video_render.h"
#else
#include "third_party/webrtc/files/include/video_render.h"
#endif
#include "talk/base/criticalsection.h"

namespace cricket {
class PassthroughStream;

class WebRtcPassthroughRender : public webrtc::VideoRender {
 public:
  WebRtcPassthroughRender();
  virtual ~WebRtcPassthroughRender();

  virtual WebRtc_Word32 Version(WebRtc_Word8* version,
      WebRtc_UWord32& remainingBufferInBytes,
      WebRtc_UWord32& position) const {
    return 0;
  }

  virtual WebRtc_Word32 ChangeUniqueId(const WebRtc_Word32 id) {
    return 0;
  }

  virtual WebRtc_Word32 TimeUntilNextProcess() { return 0; }

  virtual WebRtc_Word32 Process() { return 0; }

  virtual void* Window() {
    talk_base::CritScope cs(&render_critical_);
    return window_;
  }

  virtual WebRtc_Word32 ChangeWindow(void* window) {
    talk_base::CritScope cs(&render_critical_);
    window_ = window;
    return 0;
  }

  virtual webrtc::VideoRenderCallback* AddIncomingRenderStream(
      const WebRtc_UWord32 stream_id,
      const WebRtc_UWord32 zOrder,
      const float left, const float top,
      const float right, const float bottom);

  virtual WebRtc_Word32 DeleteIncomingRenderStream(
      const WebRtc_UWord32 stream_id);

  virtual WebRtc_Word32 AddExternalRenderCallback(
      const WebRtc_UWord32 stream_id,
      webrtc::VideoRenderCallback* render_object);

  virtual WebRtc_Word32 GetIncomingRenderStreamProperties(
      const WebRtc_UWord32 stream_id,
      WebRtc_UWord32& zOrder,
      float& left, float& top,
      float& right, float& bottom) const {
    return -1;
  }

  virtual WebRtc_UWord32 GetIncomingFrameRate(
      const WebRtc_UWord32 stream_id) {
    return 0;
  }

  virtual WebRtc_UWord32 GetNumIncomingRenderStreams() const {
    return stream_render_map_.size();
  }

  virtual bool HasIncomingRenderStream(const WebRtc_UWord32 stream_id) const;

  virtual WebRtc_Word32 RegisterRawFrameCallback(
      const WebRtc_UWord32 stream_id,
      webrtc::VideoRenderCallback* callback_obj) {
    return -1;
  }

  virtual WebRtc_Word32 GetLastRenderedFrame(
      const WebRtc_UWord32 stream_id,
      webrtc::VideoFrame &frame) const {
    return -1;
  }

  virtual WebRtc_Word32 StartRender(
      const WebRtc_UWord32 stream_id);

  virtual WebRtc_Word32 StopRender(
      const WebRtc_UWord32 stream_id);

  virtual WebRtc_Word32 ResetRender() { return 0; }

  virtual webrtc::RawVideoType PreferredVideoType() const;

  virtual bool IsFullScreen() { return false; }

  virtual WebRtc_Word32 GetScreenResolution(
      WebRtc_UWord32& screenWidth,
      WebRtc_UWord32& screenHeight) const {
    return -1;
  }

  virtual WebRtc_UWord32 RenderFrameRate(
      const WebRtc_UWord32 stream_id) {
    return 0;
  }

  virtual WebRtc_Word32 SetStreamCropping(
      const WebRtc_UWord32 stream_id,
      const float left, const float top,
      const float right,
      const float bottom) {
    return -1;
  }

  virtual WebRtc_Word32 ConfigureRenderer(
      const WebRtc_UWord32 stream_id,
      const unsigned int zOrder,
      const float left, const float top,
      const float right,
      const float bottom) {
    return -1;
  }

  virtual WebRtc_Word32 SetTransparentBackground(const bool enable) {
    return -1;
  }

  virtual WebRtc_Word32 FullScreenRender(void* window, const bool enable) {
    return -1;
  }

  virtual WebRtc_Word32 SetBitmap(const void* bitMap,
      const WebRtc_UWord8 pictureId, const void* colorKey,
      const float left, const float top,
      const float right, const float bottom) {
    return -1;
  }

  virtual WebRtc_Word32 SetText(const WebRtc_UWord8 textId,
      const WebRtc_UWord8* text,
      const WebRtc_Word32 textLength,
      const WebRtc_UWord32 textColorRef,
      const WebRtc_UWord32 backgroundColorRef,
      const float left, const float top,
      const float right, const float bottom) {
    return -1;
  }

  virtual WebRtc_Word32 SetStartImage(
      const WebRtc_UWord32 stream_id,
      const webrtc::VideoFrame& videoFrame) {
    return -1;
  }

  virtual WebRtc_Word32 SetTimeoutImage(
      const WebRtc_UWord32 stream_id,
      const webrtc::VideoFrame& videoFrame,
      const WebRtc_UWord32 timeout) {
    return -1;
  }

  virtual WebRtc_Word32 MirrorRenderStream(const int renderId,
                                           const bool enable,
                                           const bool mirrorXAxis,
                                           const bool mirrorYAxis) {
    return -1;
  }

 private:
  typedef std::map<WebRtc_UWord32, PassthroughStream*> StreamMap;

  PassthroughStream* FindStream(const WebRtc_UWord32 stream_id) const;

  void* window_;
  StreamMap stream_render_map_;
  talk_base::CriticalSection render_critical_;
};
}  // namespace cricket

#endif  // TALK_SESSION_PHONE_WEBRTCPASSTHROUGHRENDER_H_
