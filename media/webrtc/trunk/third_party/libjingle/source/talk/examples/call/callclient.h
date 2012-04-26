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

#ifndef TALK_EXAMPLES_CALL_CALLCLIENT_H_
#define TALK_EXAMPLES_CALL_CALLCLIENT_H_

#include <map>
#include <string>
#include <vector>

#include "talk/p2p/base/session.h"
#include "talk/session/phone/mediachannel.h"
#include "talk/session/phone/mediamessages.h"
#include "talk/session/phone/mediasessionclient.h"
#include "talk/xmpp/hangoutpubsubclient.h"
#include "talk/xmpp/xmppclient.h"
#include "talk/examples/call/status.h"
#include "talk/examples/call/console.h"

namespace buzz {
class PresencePushTask;
class PresenceOutTask;
class MucInviteRecvTask;
class MucInviteSendTask;
class FriendInviteSendTask;
class DiscoInfoQueryTask;
class Muc;
class Status;
class IqTask;
class MucRoomConfigTask;
class MucRoomLookupTask;
class MucStatus;
class XmlElement;
class HangoutPubSubClient;
struct AvailableMediaEntry;
struct MucRoomInfo;
}

namespace talk_base {
class Thread;
class NetworkManager;
}

namespace cricket {
class PortAllocator;
class MediaEngineInterface;
class MediaSessionClient;
class Call;
class SessionManagerTask;
struct CallOptions;
struct MediaStreams;
struct StreamParams;
}

struct RosterItem {
  buzz::Jid jid;
  buzz::Status::Show show;
  std::string status;
};

struct StaticRenderedView {
  StaticRenderedView(const cricket::StaticVideoView& view,
                     cricket::VideoRenderer* renderer) :
      view(view),
      renderer(renderer) {
  }

  cricket::StaticVideoView view;
  cricket::VideoRenderer* renderer;
};

typedef std::vector<StaticRenderedView> StaticRenderedViews;

class CallClient: public sigslot::has_slots<> {
 public:
  CallClient(buzz::XmppClient* xmpp_client,
             const std::string& caps_node,
             const std::string& version);
  ~CallClient();

  cricket::MediaSessionClient* media_client() const { return media_client_; }
  void SetMediaEngine(cricket::MediaEngineInterface* media_engine) {
    media_engine_ = media_engine;
  }
  void SetAutoAccept(bool auto_accept) {
    auto_accept_ = auto_accept;
  }
  void SetPmucDomain(const std::string &pmuc_domain) {
    pmuc_domain_ = pmuc_domain;
  }
  void SetRender(bool render) {
    render_ = render;
  }
  void SetDataChannelEnabled(bool data_channel_enabled) {
    data_channel_enabled_ = data_channel_enabled;
  }
  void SetConsole(Console *console) {
    console_ = console;
  }
  void SetPriority(int priority) {
    my_status_.set_priority(priority);
  }
  void SendStatus() {
    SendStatus(my_status_);
  }
  void SendStatus(const buzz::Status& status);

  void ParseLine(const std::string &str);

  void SendChat(const std::string& to, const std::string msg);
  void SendData(const std::string& stream_name,
                const std::string& text);
  void InviteFriend(const std::string& user);
  void JoinMuc(const buzz::Jid& room_jid);
  void JoinMuc(const std::string& room_jid_str);
  void LookupAndJoinMuc(const std::string& room_name);
  void InviteToMuc(const std::string& user, const std::string& room);
  bool InMuc();
  const buzz::Jid* FirstMucJid();
  void LeaveMuc(const std::string& room);
  void SetNick(const std::string& muc_nick);
  void SetPortAllocatorFlags(uint32 flags) { portallocator_flags_ = flags; }
  void SetAllowLocalIps(bool allow_local_ips) {
    allow_local_ips_ = allow_local_ips;
  }

  void SetInitialProtocol(cricket::SignalingProtocol initial_protocol) {
    initial_protocol_ = initial_protocol;
  }

  void SetSecurePolicy(cricket::SecureMediaPolicy secure_policy) {
    secure_policy_ = secure_policy;
  }


  typedef std::map<buzz::Jid, buzz::Muc*> MucMap;

  const MucMap& mucs() const {
    return mucs_;
  }

 private:
  void AddStream(uint32 audio_src_id, uint32 video_src_id);
  void RemoveStream(uint32 audio_src_id, uint32 video_src_id);
  void OnStateChange(buzz::XmppEngine::State state);

  void InitMedia();
  void InitPresence();
  void OnRequestSignaling();
  void OnSessionCreate(cricket::Session* session, bool initiate);
  void OnCallCreate(cricket::Call* call);
  void OnCallDestroy(cricket::Call* call);
  void OnSessionState(cricket::Call* call,
                      cricket::Session* session,
                      cricket::Session::State state);
  void OnStatusUpdate(const buzz::Status& status);
  void OnMucInviteReceived(const buzz::Jid& inviter, const buzz::Jid& room,
      const std::vector<buzz::AvailableMediaEntry>& avail);
  void OnMucJoined(const buzz::Jid& endpoint);
  void OnMucStatusUpdate(const buzz::Jid& jid, const buzz::MucStatus& status);
  void OnMucLeft(const buzz::Jid& endpoint, int error);
  void OnPresenterStateChange(const std::string& nick,
                              bool was_presenting, bool is_presenting);
  void OnAudioMuteStateChange(const std::string& nick,
                              bool was_muted, bool is_muted);
  void OnRecordingStateChange(const std::string& nick,
                              bool was_recording, bool is_recording);
  void OnRemoteMuted(const std::string& mutee_nick,
                     const std::string& muter_nick,
                     bool should_mute_locally);
  void OnMediaBlocked(const std::string& blockee_nick,
                      const std::string& blocker_nick);
  void OnHangoutRequestError(const std::string& node,
                             const buzz::XmlElement* stanza);
  void OnHangoutPublishAudioMuteError(const std::string& task_id,
                                      const buzz::XmlElement* stanza);
  void OnHangoutPublishPresenterError(const std::string& task_id,
                                      const buzz::XmlElement* stanza);
  void OnHangoutPublishRecordingError(const std::string& task_id,
                                      const buzz::XmlElement* stanza);
  void OnHangoutRemoteMuteError(const std::string& task_id,
                                const std::string& mutee_nick,
                                const buzz::XmlElement* stanza);
  void OnDevicesChange();
  void OnMediaStreamsUpdate(cricket::Call* call,
                            cricket::Session* session,
                            const cricket::MediaStreams& added,
                            const cricket::MediaStreams& removed);
  void OnSpeakerChanged(cricket::Call* call,
                        cricket::Session* session,
                        const cricket::StreamParams& speaker_stream);
  void OnRoomLookupResponse(buzz::MucRoomLookupTask* task,
                            const buzz::MucRoomInfo& room_info);
  void OnRoomLookupError(buzz::IqTask* task,
                         const buzz::XmlElement* stanza);
  void OnRoomConfigResult(buzz::MucRoomConfigTask* task);
  void OnRoomConfigError(buzz::IqTask* task,
                         const buzz::XmlElement* stanza);
  void OnDataReceived(cricket::Call*,
                      const cricket::ReceiveDataParams& params,
                      const std::string& data);
  buzz::Jid GenerateRandomMucJid();

  void AddStaticRenderedView(
      cricket::Session* session,
      uint32 ssrc, int width, int height, int framerate,
      int x_offset, int y_offset);
  bool RemoveStaticRenderedView(uint32 ssrc);
  void RemoveAllStaticRenderedViews();
  void SendViewRequest(cricket::Session* session);
  bool SelectFirstDesktopScreencastId(cricket::ScreencastId* screencastid);


  static const std::string strerror(buzz::XmppEngine::Error err);

  void PrintRoster();
  void MakeCallTo(const std::string& name, const cricket::CallOptions& options);
  void PlaceCall(const buzz::Jid& jid, const cricket::CallOptions& options);
  void Accept(const cricket::CallOptions& options);
  void Reject();
  void Quit();

  void GetDevices();
  void PrintDevices(const std::vector<std::string>& names);

  void SetVolume(const std::string& level);

  typedef std::map<std::string, RosterItem> RosterMap;

  Console *console_;
  buzz::XmppClient* xmpp_client_;
  talk_base::Thread* worker_thread_;
  talk_base::NetworkManager* network_manager_;
  cricket::PortAllocator* port_allocator_;
  cricket::SessionManager* session_manager_;
  cricket::SessionManagerTask* session_manager_task_;
  cricket::MediaEngineInterface* media_engine_;
  cricket::DataEngineInterface* data_engine_;
  cricket::MediaSessionClient* media_client_;
  MucMap mucs_;

  cricket::Call* call_;
  cricket::Session *session_;
  buzz::HangoutPubSubClient* hangout_pubsub_client_;
  bool incoming_call_;
  bool auto_accept_;
  std::string pmuc_domain_;
  bool render_;
  bool data_channel_enabled_;
  cricket::VideoRenderer* local_renderer_;
  cricket::VideoRenderer* remote_renderer_;
  StaticRenderedViews static_rendered_views_;
  uint32 static_views_accumulated_count_;

  buzz::Status my_status_;
  buzz::PresencePushTask* presence_push_;
  buzz::PresenceOutTask* presence_out_;
  buzz::MucInviteRecvTask* muc_invite_recv_;
  buzz::MucInviteSendTask* muc_invite_send_;
  buzz::FriendInviteSendTask* friend_invite_send_;
  RosterMap* roster_;
  uint32 portallocator_flags_;

  bool allow_local_ips_;
  cricket::SignalingProtocol initial_protocol_;
  cricket::SecureMediaPolicy secure_policy_;
  std::string last_sent_to_;
};

#endif  // TALK_EXAMPLES_CALL_CALLCLIENT_H_
