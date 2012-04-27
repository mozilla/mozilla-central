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

#ifndef TALK_SESSION_PHONE_WEBRTCMEDIAENGINE_H_
#define TALK_SESSION_PHONE_WEBRTCMEDIAENGINE_H_

#include "talk/session/phone/mediaengine.h"
#include "talk/session/phone/webrtcvideoengine.h"
#include "talk/session/phone/webrtcvoiceengine.h"

namespace webrtc {
class AudioDeviceModule;
class VideoCaptureModule;
}

namespace cricket {

typedef CompositeMediaEngine<WebRtcVoiceEngine, WebRtcVideoEngine>
        WebRtcCompositeMediaEngine;

class WebRtcMediaEngine : public WebRtcCompositeMediaEngine {
 public:
  WebRtcMediaEngine(webrtc::AudioDeviceModule* adm,
      webrtc::AudioDeviceModule* adm_sc) {
    voice_.SetAudioDeviceModule(adm, adm_sc);
    video_.SetVoiceEngine(&voice_);
    video_.EnableTimedRender();
  }
};

}  // namespace cricket
#endif  // TALK_SESSION_PHONE_WEBRTCMEDIAENGINE_H_
