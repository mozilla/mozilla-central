/*
 * libjingle
 * Copyright 2004--2005, Google Inc.
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

#ifndef TALK_SESSION_PHONE_MEDIASESSIONCLIENT_H_
#define TALK_SESSION_PHONE_MEDIASESSIONCLIENT_H_

#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include "talk/session/phone/call.h"
#include "talk/session/phone/channelmanager.h"
#include "talk/session/phone/cryptoparams.h"
#include "talk/session/phone/mediasession.h"
#include "talk/base/sigslot.h"
#include "talk/base/sigslotrepeater.h"
#include "talk/base/messagequeue.h"
#include "talk/base/thread.h"
#include "talk/p2p/base/sessionmanager.h"
#include "talk/p2p/base/session.h"
#include "talk/p2p/base/sessionclient.h"
#include "talk/p2p/base/sessiondescription.h"

namespace cricket {

class Call;

class MediaSessionClient : public SessionClient, public sigslot::has_slots<> {
 public:
  MediaSessionClient(const buzz::Jid& jid, SessionManager *manager);
  // Alternative constructor, allowing injection of media_engine
  // and device_manager.
  MediaSessionClient(const buzz::Jid& jid, SessionManager *manager,
                     MediaEngineInterface* media_engine,
                     DataEngineInterface* data_media_engine,
                     DeviceManagerInterface* device_manager);
  ~MediaSessionClient();

  const buzz::Jid &jid() const { return jid_; }
  SessionManager* session_manager() const { return session_manager_; }
  ChannelManager* channel_manager() const { return channel_manager_; }

  SecureMediaPolicy secure() const { return desc_factory_.secure(); }
  void set_secure(SecureMediaPolicy s) { desc_factory_.set_secure(s); }

  int GetCapabilities() { return channel_manager_->GetCapabilities(); }

  Call *CreateCall();
  void DestroyCall(Call *call);

  Call *GetFocus();
  void SetFocus(Call *call);

  void JoinCalls(Call *call_to_join, Call *call);

  bool GetAudioInputDevices(std::vector<std::string>* names) {
    return channel_manager_->GetAudioInputDevices(names);
  }
  bool GetAudioOutputDevices(std::vector<std::string>* names) {
    return channel_manager_->GetAudioOutputDevices(names);
  }
  bool GetVideoCaptureDevices(std::vector<std::string>* names) {
    return channel_manager_->GetVideoCaptureDevices(names);
  }

  bool SetAudioOptions(const std::string& in_name, const std::string& out_name,
                       int opts) {
    return channel_manager_->SetAudioOptions(in_name, out_name, opts);
  }
  bool SetOutputVolume(int level) {
    return channel_manager_->SetOutputVolume(level);
  }
  bool SetVideoOptions(const std::string& cam_device) {
    return channel_manager_->SetVideoOptions(cam_device);
  }

  SessionDescription* CreateOffer(const CallOptions& options) {
    return desc_factory_.CreateOffer(options, NULL);
  }
  SessionDescription* CreateAnswer(const SessionDescription* offer,
                                   const CallOptions& options) {
    return desc_factory_.CreateAnswer(offer, options, NULL);
  }

  sigslot::signal2<Call *, Call *> SignalFocus;
  sigslot::signal1<Call *> SignalCallCreate;
  sigslot::signal1<Call *> SignalCallDestroy;
  sigslot::repeater0<> SignalDevicesChange;

  virtual bool ParseContent(SignalingProtocol protocol,
                            const buzz::XmlElement* elem,
                            const ContentDescription** content,
                            ParseError* error);
  virtual bool IsWritable(SignalingProtocol protocol,
                          const ContentDescription* content);
  virtual bool WriteContent(SignalingProtocol protocol,
                            const ContentDescription* content,
                            buzz::XmlElement** elem,
                            WriteError* error);

 private:
  void Construct();
  void OnSessionCreate(Session *session, bool received_initiate);
  void OnSessionState(BaseSession *session, BaseSession::State state);
  void OnSessionDestroy(Session *session);
  Session *CreateSession(Call *call);

  buzz::Jid jid_;
  SessionManager* session_manager_;
  Call *focus_call_;
  ChannelManager *channel_manager_;
  MediaSessionDescriptionFactory desc_factory_;
  std::map<uint32, Call *> calls_;
  std::map<std::string, Call *> session_map_;
  friend class Call;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_MEDIASESSIONCLIENT_H_
