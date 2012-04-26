/*
 * libjingle
 * Copyright 2004--2007, Google Inc.
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

#include <string>
#include "talk/base/helpers.h"
#include "talk/base/logging.h"
#include "talk/base/thread.h"
#include "talk/base/window.h"
#include "talk/p2p/base/parsing.h"
#include "talk/session/phone/call.h"
#include "talk/session/phone/mediasessionclient.h"
#include "talk/session/phone/screencastid.h"

namespace cricket {

const uint32 MSG_CHECKAUTODESTROY = 1;
const uint32 MSG_TERMINATECALL = 2;
const uint32 MSG_PLAYDTMF = 3;

namespace {
const int kDTMFDelay = 300;  // msec
const size_t kMaxDTMFDigits = 30;
const int kSendToVoicemailTimeout = 1000*20;
const int kNoVoicemailTimeout = 1000*180;
const int kMediaMonitorInterval = 1000*15;
// In order to be the same as the server-side switching, this must be 100.
const int kAudioMonitorPollPeriodMillis = 100;

// V is a pointer type.
template<class K, class V>
V FindOrNull(const std::map<K, V>& map,
             const K& key) {
  typename std::map<K, V>::const_iterator it = map.find(key);
  return (it != map.end()) ? it->second : NULL;
}

}

Call::Call(MediaSessionClient* session_client)
    : id_(talk_base::CreateRandomId()),
      session_client_(session_client),
      local_renderer_(NULL),
      has_video_(false),
      has_data_(false),
      muted_(false),
      video_muted_(false),
      send_to_voicemail_(true),
      playing_dtmf_(false) {
}

Call::~Call() {
  while (sessions_.begin() != sessions_.end()) {
    Session* session = sessions_[0];
    RemoveSession(session);
    session_client_->session_manager()->DestroySession(session);
  }
  talk_base::Thread::Current()->Clear(this);
}

Session* Call::InitiateSession(const buzz::Jid &jid,
                               const CallOptions& options) {
  const SessionDescription* offer = session_client_->CreateOffer(options);

  Session* session = session_client_->CreateSession(this);
  AddSession(session, offer);
  session->Initiate(jid.Str(), offer);

  // After this timeout, terminate the call because the callee isn't
  // answering
  session_client_->session_manager()->signaling_thread()->Clear(this,
      MSG_TERMINATECALL);
  session_client_->session_manager()->signaling_thread()->PostDelayed(
    send_to_voicemail_ ? kSendToVoicemailTimeout : kNoVoicemailTimeout,
    this, MSG_TERMINATECALL);
  return session;
}

void Call::IncomingSession(
    Session* session, const SessionDescription* offer) {
  AddSession(session, offer);

  // Missed the first state, the initiate, which is needed by
  // call_client.
  SignalSessionState(this, session, Session::STATE_RECEIVEDINITIATE);
}

void Call::AcceptSession(Session* session,
                         const cricket::CallOptions& options) {
  std::vector<Session*>::iterator it;
  it = std::find(sessions_.begin(), sessions_.end(), session);
  ASSERT(it != sessions_.end());
  if (it != sessions_.end()) {
    session->Accept(
        session_client_->CreateAnswer(session->remote_description(), options));
  }
}

void Call::RejectSession(Session* session) {
  std::vector<Session*>::iterator it;
  it = std::find(sessions_.begin(), sessions_.end(), session);
  ASSERT(it != sessions_.end());
  // Assume polite decline.
  if (it != sessions_.end())
    session->Reject(STR_TERMINATE_DECLINE);
}

void Call::TerminateSession(Session* session) {
  ASSERT(std::find(sessions_.begin(), sessions_.end(), session)
         != sessions_.end());
  std::vector<Session*>::iterator it;
  it = std::find(sessions_.begin(), sessions_.end(), session);
  // Assume polite terminations.
  if (it != sessions_.end())
    (*it)->Terminate();
}

void Call::Terminate() {
  // Copy the list so that we can iterate over it in a stable way
  std::vector<Session*> sessions = sessions_;

  // There may be more than one session to terminate
  std::vector<Session*>::iterator it;
  for (it = sessions.begin(); it != sessions.end(); it++)
    TerminateSession(*it);
}

bool Call::SendViewRequest(Session* session,
                           const ViewRequest& view_request) {
  StaticVideoViews::const_iterator it;
  for (it = view_request.static_video_views.begin();
       it != view_request.static_video_views.end(); ++it) {
    StreamParams found_stream;
    bool found = recv_streams_.GetVideoStreamBySsrc(it->ssrc, &found_stream);
    if (!found) {
      LOG(LS_WARNING) <<
          "Tried sending view request for bad ssrc: " << it->ssrc;
      return false;
    }
  }

  XmlElements elems;
  WriteError error;
  if (!WriteJingleViewRequest(CN_VIDEO, view_request, &elems, &error)) {
    LOG(LS_ERROR) << "Couldn't write out view request: " << error.text;
    return false;
  }

  return session->SendInfoMessage(elems);
}

void Call::SetLocalRenderer(VideoRenderer* renderer) {
  local_renderer_ = renderer;
  if (session_client_->GetFocus() == this) {
    session_client_->channel_manager()->SetLocalRenderer(renderer);
  }
}

void Call::SetVideoRenderer(Session* session, uint32 ssrc,
                            VideoRenderer* renderer) {
  VideoChannel* video_channel = GetVideoChannel(session);
  if (video_channel) {
    video_channel->SetRenderer(ssrc, renderer);
    LOG(LS_INFO) << "Set renderer of ssrc " << ssrc
                 << " to " << renderer << ".";
  } else {
    LOG(LS_INFO) << "Failed to set renderer of ssrc " << ssrc << ".";
  }
}

void Call::OnMessage(talk_base::Message* message) {
  switch (message->message_id) {
  case MSG_CHECKAUTODESTROY:
    // If no more sessions for this call, delete it
    if (sessions_.size() == 0)
      session_client_->DestroyCall(this);
    break;
  case MSG_TERMINATECALL:
    // Signal to the user that a timeout has happened and the call should
    // be sent to voicemail.
    if (send_to_voicemail_) {
      SignalSetupToCallVoicemail();
    }

    // Callee didn't answer - terminate call
    Terminate();
    break;
  case MSG_PLAYDTMF:
    ContinuePlayDTMF();
  }
}

const std::vector<Session*> &Call::sessions() {
  return sessions_;
}

bool Call::AddSession(Session* session, const SessionDescription* offer) {
  bool succeeded = true;
  VoiceChannel* voice_channel = NULL;
  VideoChannel* video_channel = NULL;
  DataChannel* data_channel = NULL;

  const ContentInfo* audio_offer = GetFirstAudioContent(offer);
  const ContentInfo* video_offer = GetFirstVideoContent(offer);
  const ContentInfo* data_offer = GetFirstDataContent(offer);
  has_video_ = (video_offer != NULL);
  has_data_ = (data_offer != NULL);

  ASSERT(audio_offer != NULL);
  // Create voice channel and start a media monitor.
  voice_channel = session_client_->channel_manager()->CreateVoiceChannel(
      session, audio_offer->name, has_video_);
  // voice_channel can be NULL in case of NullVoiceEngine.
  if (voice_channel) {
    voice_channel_map_[session->id()] = voice_channel;
    voice_channel->SignalMediaMonitor.connect(this, &Call::OnMediaMonitor);
    voice_channel->StartMediaMonitor(kMediaMonitorInterval);
  } else {
    succeeded = false;
  }

  // If desired, create video channel and start a media monitor.
  if (has_video_ && succeeded) {
    video_channel = session_client_->channel_manager()->CreateVideoChannel(
        session, video_offer->name, true, voice_channel);
    // video_channel can be NULL in case of NullVideoEngine.
    if (video_channel) {
      video_channel_map_[session->id()] = video_channel;
      video_channel->SignalMediaMonitor.connect(this, &Call::OnMediaMonitor);
      video_channel->StartMediaMonitor(kMediaMonitorInterval);
    } else {
      succeeded = false;
    }
  }

  // If desired, create data channel
  if (has_data_ && succeeded) {
    bool rtcp = false;
    data_channel = session_client_->channel_manager()->CreateDataChannel(
        session, data_offer->name, rtcp);
    if (data_channel) {
      data_channel_map_[session->id()] = data_channel;
      data_channel->SignalDataReceived.connect(this, &Call::OnDataReceived);
    } else {
      succeeded = false;
    }
  }

  if (succeeded) {
    // Add session to list, create channels for this session.
    sessions_.push_back(session);
    session->SignalState.connect(this, &Call::OnSessionState);
    session->SignalError.connect(this, &Call::OnSessionError);
    session->SignalInfoMessage.connect(
        this, &Call::OnSessionInfoMessage);
    session->SignalRemoteDescriptionUpdate.connect(
        this, &Call::OnRemoteDescriptionUpdate);
    session->SignalReceivedTerminateReason
      .connect(this, &Call::OnReceivedTerminateReason);

    // If this call has the focus, enable this channel.
    if (session_client_->GetFocus() == this) {
      voice_channel->Enable(true);
      if (video_channel) {
        video_channel->Enable(true);
      }
    }

    // Signal client.
    SignalAddSession(this, session);
  }

  return succeeded;
}

void Call::RemoveSession(Session* session) {
  // Remove session from list
  std::vector<Session*>::iterator it_session;
  it_session = std::find(sessions_.begin(), sessions_.end(), session);
  if (it_session == sessions_.end())
    return;
  sessions_.erase(it_session);

  // Destroy video channel
  std::map<std::string, VideoChannel*>::iterator it_vchannel;
  it_vchannel = video_channel_map_.find(session->id());
  if (it_vchannel != video_channel_map_.end()) {
    VideoChannel* video_channel = it_vchannel->second;
    video_channel_map_.erase(it_vchannel);
    session_client_->channel_manager()->DestroyVideoChannel(video_channel);
  }

  // Destroy voice channel
  std::map<std::string, VoiceChannel*>::iterator it_channel;
  it_channel = voice_channel_map_.find(session->id());
  if (it_channel != voice_channel_map_.end()) {
    VoiceChannel* voice_channel = it_channel->second;
    voice_channel_map_.erase(it_channel);
    session_client_->channel_manager()->DestroyVoiceChannel(voice_channel);
  }

  // Destroy data channel
  std::map<std::string, DataChannel*>::iterator it_dchannel;
  it_dchannel = data_channel_map_.find(session->id());
  if (it_dchannel != data_channel_map_.end()) {
    DataChannel* data_channel = it_dchannel->second;
    data_channel_map_.erase(it_dchannel);
    session_client_->channel_manager()->DestroyDataChannel(data_channel);
  }

  // Destroy speaker monitor
  StopSpeakerMonitor(session);

  // Signal client
  SignalRemoveSession(this, session);

  // The call auto destroys when the last session is removed
  talk_base::Thread::Current()->Post(this, MSG_CHECKAUTODESTROY);
}

VoiceChannel* Call::GetVoiceChannel(Session* session) {
  std::map<std::string, VoiceChannel*>::iterator it
    = voice_channel_map_.find(session->id());
  return (it != voice_channel_map_.end()) ? it->second : NULL;
}

VideoChannel* Call::GetVideoChannel(Session* session) {
  std::map<std::string, VideoChannel*>::iterator it
    = video_channel_map_.find(session->id());
  return (it != video_channel_map_.end()) ? it->second : NULL;
}

DataChannel* Call::GetDataChannel(Session* session) {
  std::map<std::string, DataChannel*>::iterator it =
      data_channel_map_.find(session->id());
  return (it != data_channel_map_.end()) ? it->second : NULL;
}

void Call::EnableChannels(bool enable) {
  std::vector<Session*>::iterator it;
  for (it = sessions_.begin(); it != sessions_.end(); it++) {
    VoiceChannel* voice_channel = GetVoiceChannel(*it);
    VideoChannel* video_channel = GetVideoChannel(*it);
    DataChannel* data_channel = GetDataChannel(*it);
    if (voice_channel != NULL)
      voice_channel->Enable(enable);
    if (video_channel != NULL)
      video_channel->Enable(enable);
    if (data_channel != NULL)
      data_channel->Enable(enable);
  }
  session_client_->channel_manager()->SetLocalRenderer(
      (enable) ? local_renderer_ : NULL);
}

void Call::Mute(bool mute) {
  muted_ = mute;
  std::vector<Session*>::iterator it;
  for (it = sessions_.begin(); it != sessions_.end(); it++) {
    VoiceChannel* voice_channel = voice_channel_map_[(*it)->id()];
    if (voice_channel != NULL)
      voice_channel->Mute(mute);
  }
}

void Call::MuteVideo(bool mute) {
  video_muted_ = mute;
  std::vector<Session*>::iterator it;
  for (it = sessions_.begin(); it != sessions_.end(); it++) {
    VideoChannel* video_channel = video_channel_map_[(*it)->id()];
    if (video_channel != NULL)
      video_channel->Mute(mute);
  }
}

void Call::SendData(Session* session,
                    const DataMediaChannel::SendDataParams& params,
                    const std::string& data) {
  DataChannel* data_channel = GetDataChannel(session);
  if (!data_channel) {
    LOG(LS_WARNING) << "Could not send data: no data channel.";
    return;
  }

  data_channel->SendData(params, data);
}

void Call::PressDTMF(int event) {
  // Queue up this digit
  if (queued_dtmf_.size() < kMaxDTMFDigits) {
    LOG(LS_INFO) << "Call::PressDTMF(" << event << ")";

    queued_dtmf_.push_back(event);

    if (!playing_dtmf_) {
      ContinuePlayDTMF();
    }
  }
}

void Call::AddScreencast(Session* session,
                         const std::string& stream_name, uint32 ssrc,
                         const ScreencastId& screencastid, int fps) {
  VideoChannel *video_channel = GetVideoChannel(session);
  if (!video_channel) {
    LOG(LS_WARNING) << "Cannot add screencast"
                    << " because there is no video channel.";
    return;
  }

  // TODO: Verify we aren't re-using an existing name or
  // ssrc.
  StreamParams stream;
  stream.name = stream_name;
  stream.ssrcs.push_back(ssrc);
  SendStreamUpdate(session, stream);
  // TODO: Wait for view request to send screencast.
  video_channel->AddScreencast(ssrc, screencastid, fps);
}

void Call::RemoveScreencast(Session* session,
                            const std::string& stream_name, uint32 ssrc) {
  VideoChannel *video_channel = GetVideoChannel(session);
  if (!video_channel) {
    LOG(LS_WARNING) << "Cannot remove screencast"
                    << " because there is no video channel.";
    return;
  }

  StreamParams stream;
  stream.name = stream_name;
  // No ssrcs
  video_channel->RemoveScreencast(ssrc);
  SendStreamUpdate(session, stream);
}

void Call::SendStreamUpdate(Session* session, const StreamParams& stream) {
  const ContentInfo* video_info =
      GetFirstVideoContent(session->local_description());
  if (video_info == NULL) {
    LOG(LS_WARNING) << "Cannot send stream update for video.";
    return;
  }

  // A "stream update" is a partial content update (a
  // "description-info") that new stream info and nothing else.
  talk_base::scoped_ptr<VideoContentDescription> video(
      new VideoContentDescription());
  video->set_multistream(true);
  video->set_partial(true);
  video->AddStream(stream);

  std::vector<ContentInfo> contents;
  contents.push_back(
      ContentInfo(video_info->name, video_info->type, video.get()));

  session->SendDescriptionInfoMessage(contents);
}

void Call::ContinuePlayDTMF() {
  playing_dtmf_ = false;

  // Check to see if we have a queued tone
  if (queued_dtmf_.size() > 0) {
    playing_dtmf_ = true;

    int tone = queued_dtmf_.front();
    queued_dtmf_.pop_front();

    LOG(LS_INFO) << "Call::ContinuePlayDTMF(" << tone << ")";
    std::vector<Session*>::iterator it;
    for (it = sessions_.begin(); it != sessions_.end(); it++) {
      VoiceChannel* voice_channel = voice_channel_map_[(*it)->id()];
      if (voice_channel != NULL) {
        voice_channel->PressDTMF(tone, true);
      }
    }

    // Post a message to play the next tone or at least clear the playing_dtmf_
    // bit.
    talk_base::Thread::Current()->PostDelayed(kDTMFDelay, this, MSG_PLAYDTMF);
  }
}

void Call::Join(Call* call, bool enable) {
  while (call->sessions_.size() != 0) {
    // Move session
    Session* session = call->sessions_[0];
    call->sessions_.erase(call->sessions_.begin());
    sessions_.push_back(session);
    session->SignalState.connect(this, &Call::OnSessionState);
    session->SignalError.connect(this, &Call::OnSessionError);
    session->SignalReceivedTerminateReason
      .connect(this, &Call::OnReceivedTerminateReason);

    // Move voice channel
    std::map<std::string, VoiceChannel*>::iterator it_channel;
    it_channel = call->voice_channel_map_.find(session->id());
    if (it_channel != call->voice_channel_map_.end()) {
      VoiceChannel* voice_channel = (*it_channel).second;
      call->voice_channel_map_.erase(it_channel);
      voice_channel_map_[session->id()] = voice_channel;
      voice_channel->Enable(enable);
    }

    // Move video channel
    std::map<std::string, VideoChannel*>::iterator it_vchannel;
    it_vchannel = call->video_channel_map_.find(session->id());
    if (it_vchannel != call->video_channel_map_.end()) {
      VideoChannel* video_channel = (*it_vchannel).second;
      call->video_channel_map_.erase(it_vchannel);
      video_channel_map_[session->id()] = video_channel;
      video_channel->Enable(enable);
    }

    // TODO: Move data channel?
  }
}

void Call::StartConnectionMonitor(Session* session, int cms) {
  VoiceChannel* voice_channel = GetVoiceChannel(session);
  if (voice_channel) {
    voice_channel->SignalConnectionMonitor.connect(this,
        &Call::OnConnectionMonitor);
    voice_channel->StartConnectionMonitor(cms);
  }

  VideoChannel* video_channel = GetVideoChannel(session);
  if (video_channel) {
    video_channel->SignalConnectionMonitor.connect(this,
        &Call::OnConnectionMonitor);
    video_channel->StartConnectionMonitor(cms);
  }
}

void Call::StopConnectionMonitor(Session* session) {
  VoiceChannel* voice_channel = GetVoiceChannel(session);
  if (voice_channel) {
    voice_channel->StopConnectionMonitor();
    voice_channel->SignalConnectionMonitor.disconnect(this);
  }

  VideoChannel* video_channel = GetVideoChannel(session);
  if (video_channel) {
    video_channel->StopConnectionMonitor();
    video_channel->SignalConnectionMonitor.disconnect(this);
  }
}

void Call::StartAudioMonitor(Session* session, int cms) {
  VoiceChannel* voice_channel = GetVoiceChannel(session);
  if (voice_channel) {
    voice_channel->SignalAudioMonitor.connect(this, &Call::OnAudioMonitor);
    voice_channel->StartAudioMonitor(cms);
  }
}

void Call::StopAudioMonitor(Session* session) {
  VoiceChannel* voice_channel = GetVoiceChannel(session);
  if (voice_channel) {
    voice_channel->StopAudioMonitor();
    voice_channel->SignalAudioMonitor.disconnect(this);
  }
}

bool Call::IsAudioMonitorRunning(Session* session) {
  VoiceChannel* voice_channel = GetVoiceChannel(session);
  if (voice_channel) {
    return voice_channel->IsAudioMonitorRunning();
  } else {
    return false;
  }
}

void Call::StartSpeakerMonitor(Session* session) {
  if (speaker_monitor_map_.find(session->id()) == speaker_monitor_map_.end()) {
    if (!IsAudioMonitorRunning(session)) {
      StartAudioMonitor(session, kAudioMonitorPollPeriodMillis);
    }
    CurrentSpeakerMonitor* speaker_monitor =
        new cricket::CurrentSpeakerMonitor(this, session);
    speaker_monitor->SignalUpdate.connect(this, &Call::OnSpeakerMonitor);
    speaker_monitor->Start();
    speaker_monitor_map_[session->id()] = speaker_monitor;
  } else {
    LOG(LS_WARNING) << "Already started speaker monitor for session "
                    << session->id() << ".";
  }
}

void Call::StopSpeakerMonitor(Session* session) {
  if (speaker_monitor_map_.find(session->id()) == speaker_monitor_map_.end()) {
    LOG(LS_WARNING) << "Speaker monitor for session "
                    << session->id() << " already stopped.";
  } else {
    CurrentSpeakerMonitor* monitor = speaker_monitor_map_[session->id()];
    monitor->Stop();
    speaker_monitor_map_.erase(session->id());
    delete monitor;
  }
}

void Call::OnConnectionMonitor(VoiceChannel* channel,
                               const std::vector<ConnectionInfo> &infos) {
  SignalConnectionMonitor(this, infos);
}

void Call::OnMediaMonitor(VoiceChannel* channel, const VoiceMediaInfo& info) {
  SignalMediaMonitor(this, info);
}

void Call::OnAudioMonitor(VoiceChannel* channel, const AudioInfo& info) {
  SignalAudioMonitor(this, info);
}

void Call::OnSpeakerMonitor(CurrentSpeakerMonitor* monitor, uint32 ssrc) {
  StreamParams stream;
  recv_streams_.GetAudioStreamBySsrc(ssrc, &stream);
  SignalSpeakerMonitor(this, static_cast<Session*>(monitor->session()),
                       stream);
}

void Call::OnConnectionMonitor(VideoChannel* channel,
                               const std::vector<ConnectionInfo> &infos) {
  SignalVideoConnectionMonitor(this, infos);
}

void Call::OnMediaMonitor(VideoChannel* channel, const VideoMediaInfo& info) {
  SignalVideoMediaMonitor(this, info);
}

void Call::OnDataReceived(DataChannel* channel,
                          const ReceiveDataParams& params,
                          const std::string& data) {
  SignalDataReceived(this, params, data);
}

uint32 Call::id() {
  return id_;
}

void Call::OnSessionState(BaseSession* session, BaseSession::State state) {
  switch (state) {
    case Session::STATE_RECEIVEDACCEPT:
    case Session::STATE_RECEIVEDREJECT:
    case Session::STATE_RECEIVEDTERMINATE:
      session_client_->session_manager()->signaling_thread()->Clear(this,
          MSG_TERMINATECALL);
      break;
    default:
      break;
  }
  SignalSessionState(this, static_cast<Session*>(session), state);
}

void Call::OnSessionError(BaseSession* session, Session::Error error) {
  session_client_->session_manager()->signaling_thread()->Clear(this,
      MSG_TERMINATECALL);
  SignalSessionError(this, static_cast<Session*>(session), error);
}

void Call::OnSessionInfoMessage(Session* session,
                                const buzz::XmlElement* action_elem) {
  if (!IsJingleViewRequest(action_elem)) {
    return;
  }

  ViewRequest view_request;
  ParseError error;
  if (!ParseJingleViewRequest(action_elem, &view_request, &error)) {
    LOG(LS_WARNING) << "Failed to parse view request: " << error.text;
    return;
  }

  VideoChannel* video_channel = GetVideoChannel(session);
  if (video_channel == NULL) {
    LOG(LS_WARNING) << "Ignore view request since we have no video channel.";
    return;
  }

  if (!video_channel->ApplyViewRequest(view_request)) {
    LOG(LS_WARNING) << "Failed to ApplyViewRequest.";
  }
}

void FindStreamChanges(const std::vector<StreamParams>& streams,
                       const std::vector<StreamParams>& updates,
                       std::vector<StreamParams>* added_streams,
                       std::vector<StreamParams>* removed_streams) {
  for (std::vector<StreamParams>::const_iterator update = updates.begin();
       update != updates.end(); ++update) {
    StreamParams stream;
    if (GetStreamByNickAndName(streams, update->nick, update->name, &stream)) {
      if (!update->has_ssrcs()) {
        removed_streams->push_back(stream);
      }
    } else {
      // There's a bug on reflector that will send <stream>s even
      // though there is not ssrc (which means there isn't really a
      // stream).  To work around it, we simply ignore new <stream>s
      // that don't have any ssrcs.
      if (update->has_ssrcs()) {
        added_streams->push_back(*update);
      }
    }
  }
}

void Call::UpdateRecvStreams(const std::vector<StreamParams>& update_streams,
                             BaseChannel* channel,
                             std::vector<StreamParams>* recv_streams,
                             std::vector<StreamParams>* added_streams,
                             std::vector<StreamParams>* removed_streams) {
  FindStreamChanges(*recv_streams,
                    update_streams, added_streams, removed_streams);
  AddRecvStreams(*added_streams,
                 channel, recv_streams);
  RemoveRecvStreams(*removed_streams,
                    channel, recv_streams);
}

void Call::AddRecvStreams(const std::vector<StreamParams>& added_streams,
                          BaseChannel* channel,
                          std::vector<StreamParams>* recv_streams) {
  std::vector<StreamParams>::const_iterator stream;
  for (stream = added_streams.begin();
       stream != added_streams.end();
       ++stream) {
    AddRecvStream(*stream, channel, recv_streams);
  }
}

void Call::AddRecvStream(const StreamParams& stream,
                         BaseChannel* channel,
                         std::vector<StreamParams>* recv_streams) {
  if (channel && stream.has_ssrcs()) {
    channel->AddRecvStream(stream);
  }
  recv_streams->push_back(stream);
}

void Call::RemoveRecvStreams(const std::vector<StreamParams>& removed_streams,
                             BaseChannel* channel,
                             std::vector<StreamParams>* recv_streams) {
  std::vector<StreamParams>::const_iterator stream;
  for (stream = removed_streams.begin();
       stream != removed_streams.end();
       ++stream) {
    RemoveRecvStream(*stream, channel, recv_streams);
  }
}

void Call::RemoveRecvStream(const StreamParams& stream,
                            BaseChannel* channel,
                            std::vector<StreamParams>* recv_streams) {
  if (channel && stream.has_ssrcs()) {
    // TODO: Change RemoveRecvStream to take a stream argument.
    channel->RemoveRecvStream(stream.first_ssrc());
  }
  RemoveStreamByNickAndName(recv_streams, stream.nick, stream.name);
}

void Call::OnRemoteDescriptionUpdate(BaseSession* base_session,
                                     const ContentInfos& updated_contents) {
  Session* session = static_cast<Session*>(base_session);

  cricket::MediaStreams added_streams;
  cricket::MediaStreams removed_streams;
  std::vector<StreamParams>::const_iterator stream;

  const ContentInfo* audio_content = GetFirstAudioContent(updated_contents);
  if (audio_content) {
    const AudioContentDescription* audio_update =
        static_cast<const AudioContentDescription*>(audio_content->description);
    if (!audio_update->codecs().empty()) {
      UpdateVoiceChannelRemoteContent(session, audio_update);
    }
    UpdateRecvStreams(audio_update->streams(),
                      GetVoiceChannel(session),
                      recv_streams_.mutable_audio(),
                      added_streams.mutable_audio(),
                      removed_streams.mutable_audio());
  }

  const ContentInfo* video_content = GetFirstVideoContent(updated_contents);
  if (video_content) {
    const VideoContentDescription* video_update =
        static_cast<const VideoContentDescription*>(video_content->description);
    if (!video_update->codecs().empty()) {
      UpdateVideoChannelRemoteContent(session, video_update);
    }
    UpdateRecvStreams(video_update->streams(),
                      GetVideoChannel(session),
                      recv_streams_.mutable_video(),
                      added_streams.mutable_video(),
                      removed_streams.mutable_video());
  }

  const ContentInfo* data_content = GetFirstDataContent(updated_contents);
  if (data_content) {
    const DataContentDescription* data_update =
        static_cast<const DataContentDescription*>(data_content->description);
    if (!data_update->codecs().empty()) {
      UpdateDataChannelRemoteContent(session, data_update);
    }
    UpdateRecvStreams(data_update->streams(),
                      GetDataChannel(session),
                      recv_streams_.mutable_data(),
                      added_streams.mutable_data(),
                      removed_streams.mutable_data());
  }

  if (!added_streams.empty() || !removed_streams.empty()) {
    SignalMediaStreamsUpdate(this, session, added_streams, removed_streams);
  }
}

bool Call::UpdateVoiceChannelRemoteContent(
    Session* session, const AudioContentDescription* audio) {
  VoiceChannel* voice_channel = GetVoiceChannel(session);
  if (!voice_channel->SetRemoteContent(audio, CA_UPDATE)) {
    LOG(LS_ERROR) << "Failure in audio SetRemoteContent with CA_UPDATE";
    session->SetError(BaseSession::ERROR_CONTENT);
    return false;
  }
  return true;
}

bool Call::UpdateVideoChannelRemoteContent(
    Session* session, const VideoContentDescription* video) {
  VideoChannel* video_channel = GetVideoChannel(session);
  if (!video_channel->SetRemoteContent(video, CA_UPDATE)) {
    LOG(LS_ERROR) << "Failure in video SetRemoteContent with CA_UPDATE";
    session->SetError(BaseSession::ERROR_CONTENT);
    return false;
  }
  return true;
}

bool Call::UpdateDataChannelRemoteContent(
    Session* session, const DataContentDescription* data) {
  DataChannel* data_channel = GetDataChannel(session);
  if (!data_channel->SetRemoteContent(data, CA_UPDATE)) {
    LOG(LS_ERROR) << "Failure in data SetRemoteContent with CA_UPDATE";
    session->SetError(BaseSession::ERROR_CONTENT);
    return false;
  }
  return true;
}

void Call::OnReceivedTerminateReason(Session* session,
                                     const std::string& reason) {
  session_client_->session_manager()->signaling_thread()->Clear(this,
    MSG_TERMINATECALL);
  SignalReceivedTerminateReason(this, session, reason);
}

}  // namespace cricket
