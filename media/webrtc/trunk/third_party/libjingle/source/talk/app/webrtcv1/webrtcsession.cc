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

#include "talk/app/webrtcv1/webrtcsession.h"

#include <string>
#include <vector>

#include "talk/base/common.h"
#include "talk/base/scoped_ptr.h"
#include "talk/p2p/base/constants.h"
#include "talk/p2p/base/sessiondescription.h"
#include "talk/p2p/base/p2ptransport.h"
#include "talk/session/phone/channel.h"
#include "talk/session/phone/channelmanager.h"
#include "talk/session/phone/mediasessionclient.h"
#include "talk/session/phone/voicechannel.h"

namespace webrtc {

enum {
  MSG_CANDIDATE_TIMEOUT = 101,
};

static const int kAudioMonitorPollFrequency = 100;
static const int kMonitorPollFrequency = 1000;

// We allow 30 seconds to establish a connection; beyond that we consider
// it an error
static const int kCallSetupTimeout = 30 * 1000;
// A loss of connectivity is probably due to the Internet connection going
// down, and it might take a while to come back on wireless networks, so we
// use a longer timeout for that.
static const int kCallLostTimeout = 60 * 1000;

static const char kVideoStream[] = "video_rtp";
static const char kAudioStream[] = "rtp";

static const int kDefaultVideoCodecId = 100;
static const int kDefaultVideoCodecFramerate = 30;
static const char kDefaultVideoCodecName[] = "VP8";

WebRtcSession::WebRtcSession(const std::string& id,
                             bool incoming,
                             cricket::PortAllocator* allocator,
                             cricket::ChannelManager* channelmgr,
                             talk_base::Thread* signaling_thread)
    : BaseSession(signaling_thread, channelmgr->worker_thread(),
                  allocator, id, "", !incoming),
      transport_(NULL),
      channel_manager_(channelmgr),
      transports_writable_(false),
      muted_(false),
      camera_muted_(false),
      setup_timeout_(kCallSetupTimeout),
      signaling_thread_(signaling_thread),
      incoming_(incoming),
      port_allocator_(allocator),
      desc_factory_(channel_manager_) {
}

WebRtcSession::~WebRtcSession() {
  RemoveAllStreams();
  // TODO: Do we still need Terminate?
  // if (state_ != STATE_RECEIVEDTERMINATE) {
  //   Terminate();
  // }
  if (transport_) {
    delete transport_;
    transport_ = NULL;
  }
}

bool WebRtcSession::Initiate() {
  const cricket::VideoCodec default_codec(kDefaultVideoCodecId,
      kDefaultVideoCodecName, kDefaultVideoCodecWidth, kDefaultVideoCodecHeight,
      kDefaultVideoCodecFramerate, 0);
  channel_manager_->SetDefaultVideoEncoderConfig(
      cricket::VideoEncoderConfig(default_codec));

  if (signaling_thread_ == NULL)
    return false;

  transport_ = CreateTransport();

  if (transport_ == NULL)
    return false;

  transport_->set_allow_local_ips(true);

  // start transports
  transport_->SignalRequestSignaling.connect(
      this, &WebRtcSession::OnRequestSignaling);
  transport_->SignalCandidatesReady.connect(
      this, &WebRtcSession::OnCandidatesReady);
  transport_->SignalWritableState.connect(
      this, &WebRtcSession::OnWritableState);
  // Limit the amount of time that setting up a call may take.
  StartTransportTimeout(kCallSetupTimeout);
  // Set default secure option to SEC_REQUIRED.
  desc_factory_.set_secure(cricket::SEC_REQUIRED);
  return true;
}

cricket::Transport* WebRtcSession::CreateTransport() {
  ASSERT(signaling_thread()->IsCurrent());
  return new cricket::P2PTransport(
      talk_base::Thread::Current(),
      channel_manager_->worker_thread(), port_allocator());
}

bool WebRtcSession::CreateVoiceChannel(const std::string& stream_id) {
  // RTCP disabled
  cricket::VoiceChannel* voice_channel =
      channel_manager_->CreateVoiceChannel(this, stream_id, true);
  if (voice_channel == NULL) {
    LOG(LERROR) << "Unable to create voice channel.";
    return false;
  }
  StreamInfo* stream_info = new StreamInfo(stream_id);
  stream_info->channel = voice_channel;
  stream_info->video = false;
  streams_.push_back(stream_info);
  return true;
}

bool WebRtcSession::CreateVideoChannel(const std::string& stream_id) {
  // RTCP disabled
  cricket::VideoChannel* video_channel =
      channel_manager_->CreateVideoChannel(this, stream_id, true, NULL);
  if (video_channel == NULL) {
    LOG(LERROR) << "Unable to create video channel.";
    return false;
  }
  StreamInfo* stream_info = new StreamInfo(stream_id);
  stream_info->channel = video_channel;
  stream_info->video = true;
  streams_.push_back(stream_info);
  return true;
}

cricket::TransportChannel* WebRtcSession::CreateChannel(
    const std::string& content_name,
    const std::string& name) {
  if (!transport_) {
    return NULL;
  }
  std::string type;
  if (content_name.compare(kVideoStream) == 0) {
    type = cricket::NS_GINGLE_VIDEO;
  } else {
    type = cricket::NS_GINGLE_AUDIO;
  }
  cricket::TransportChannel* transport_channel =
      transport_->CreateChannel(name, type);
  ASSERT(transport_channel != NULL);
  return transport_channel;
}

cricket::TransportChannel* WebRtcSession::GetChannel(
    const std::string& content_name, const std::string& name) {
  if (!transport_)
    return NULL;

  return transport_->GetChannel(name);
}

void WebRtcSession::DestroyChannel(
    const std::string& content_name, const std::string& name) {
  if (!transport_)
    return;

  transport_->DestroyChannel(name);
}

void WebRtcSession::OnMessage(talk_base::Message* message) {
  switch (message->message_id) {
    case MSG_CANDIDATE_TIMEOUT:
      if (transport_->writable()) {
        // This should never happen: The timout triggered even
        // though a call was successfully set up.
        ASSERT(false);
      }
      SignalFailedCall();
      break;
    default:
      cricket::BaseSession::OnMessage(message);
      break;
  }
}

bool WebRtcSession::Connect() {
  if (streams_.empty()) {
    // nothing to initiate
    return false;
  }
  // lets connect all the transport channels created before for this session
  transport_->ConnectChannels();

  // create an offer now. This is to call SetState
  // Actual offer will be send when OnCandidatesReady callback received
  cricket::SessionDescription* offer = CreateOffer();
  set_local_description(offer);
  SetState((incoming()) ? STATE_SENTACCEPT : STATE_SENTINITIATE);

  // Enable all the channels
  EnableAllStreams();
  return SetVideoCapture(true);
}

bool WebRtcSession::SetVideoRenderer(const std::string& stream_id,
                                     cricket::VideoRenderer* renderer) {
  bool ret = false;
  StreamMap::iterator iter;
  for (iter = streams_.begin(); iter != streams_.end(); ++iter) {
    StreamInfo* stream_info = (*iter);
    if (stream_info->stream_id.compare(stream_id) == 0) {
      ASSERT(stream_info->channel != NULL);
      ASSERT(stream_info->video);
      cricket::VideoChannel* channel = static_cast<cricket::VideoChannel*>(
          stream_info->channel);
      ret = channel->SetRenderer(0, renderer);
      break;
    }
  }
  return ret;
}

bool WebRtcSession::SetVideoCapture(bool capture) {
  cricket::CaptureResult ret = channel_manager_->SetVideoCapture(capture);
  if (ret != cricket::CR_SUCCESS && ret != cricket::CR_PENDING) {
    LOG(LS_ERROR) << "Failed to SetVideoCapture(" << capture << ").";
    return false;
  }
  return true;
}

bool WebRtcSession::RemoveStream(const std::string& stream_id) {
  bool ret = false;
  StreamMap::iterator iter;
  for (iter = streams_.begin(); iter != streams_.end(); ++iter) {
    StreamInfo* sinfo = (*iter);
    if (sinfo->stream_id.compare(stream_id) == 0) {
      if (!sinfo->video) {
        cricket::VoiceChannel* channel = static_cast<cricket::VoiceChannel*> (
            sinfo->channel);
        channel->Enable(false);
        // Note: If later the channel is used by multiple streams, then we
        // should not destroy the channel until all the streams are removed.
        channel_manager_->DestroyVoiceChannel(channel);
      } else {
        cricket::VideoChannel* channel = static_cast<cricket::VideoChannel*> (
            sinfo->channel);
        channel->Enable(false);
        // Note: If later the channel is used by multiple streams, then we
        // should not destroy the channel until all the streams are removed.
        channel_manager_->DestroyVideoChannel(channel);
      }
      // channel and transport will be deleted in
      // DestroyVoiceChannel/DestroyVideoChannel
      streams_.erase(iter);
      ret = true;
      break;
    }
  }
  if (!ret) {
    LOG(LERROR) << "No streams found for stream id " << stream_id;
    // TODO: trigger onError callback
  }
  return ret;
}

void WebRtcSession::EnableAllStreams() {
  StreamMap::const_iterator i;
  for (i = streams_.begin(); i != streams_.end(); ++i) {
    cricket::BaseChannel* channel = (*i)->channel;
    if (channel)
      channel->Enable(true);
  }
}

void WebRtcSession::RemoveAllStreams() {
  SetState(STATE_RECEIVEDTERMINATE);

  // signaling_thread_->Post(this, MSG_RTC_REMOVEALLSTREAMS);
  // First build a list of streams to remove and then remove them.
  // The reason we do this is that if we remove the streams inside the
  // loop, a stream might get removed while we're enumerating and the iterator
  // will become invalid (and we crash).
  // streams_ entry will be removed from ChannelManager callback method
  // DestroyChannel
  std::vector<std::string> streams_to_remove;
  StreamMap::iterator iter;
  for (iter = streams_.begin(); iter != streams_.end(); ++iter)
    streams_to_remove.push_back((*iter)->stream_id);

  for (std::vector<std::string>::iterator i = streams_to_remove.begin();
       i != streams_to_remove.end(); ++i) {
    RemoveStream(*i);
  }
}

bool WebRtcSession::HasStream(const std::string& stream_id) const {
  StreamMap::const_iterator iter;
  for (iter = streams_.begin(); iter != streams_.end(); ++iter) {
    StreamInfo* sinfo = (*iter);
    if (stream_id.compare(sinfo->stream_id) == 0) {
      return true;
    }
  }
  return false;
}

bool WebRtcSession::HasChannel(bool video) const {
  StreamMap::const_iterator iter;
  for (iter = streams_.begin(); iter != streams_.end(); ++iter) {
    StreamInfo* sinfo = (*iter);
    if (sinfo->video == video) {
      return true;
    }
  }
  return false;
}

bool WebRtcSession::HasAudioChannel() const {
  return HasChannel(false);
}

bool WebRtcSession::HasVideoChannel() const {
  return HasChannel(true);
}

void WebRtcSession::OnRequestSignaling(cricket::Transport* transport) {
  transport->OnSignalingReady();
}

void WebRtcSession::OnWritableState(cricket::Transport* transport) {
  ASSERT(transport == transport_);
  const bool transports_writable = transport_->writable();
  if (transports_writable) {
    if (transports_writable != transports_writable_) {
      signaling_thread_->Clear(this, MSG_CANDIDATE_TIMEOUT);
    } else {
      // At one point all channels were writable and we had full connectivity,
      // but then we lost it. Start the timeout again to kill the call if it
      // doesn't come back.
      StartTransportTimeout(kCallLostTimeout);
    }
    transports_writable_ = transports_writable;
  }
  NotifyTransportState();
  return;
}

void WebRtcSession::StartTransportTimeout(int timeout) {
  talk_base::Thread::Current()->PostDelayed(timeout, this,
                                            MSG_CANDIDATE_TIMEOUT,
                                            NULL);
}

void WebRtcSession::NotifyTransportState() {
}

bool WebRtcSession::OnInitiateMessage(
    cricket::SessionDescription* offer,
    const std::vector<cricket::Candidate>& candidates) {
  if (!offer) {
    LOG(LERROR) << "No SessionDescription from peer";
    return false;
  }

  // Get capabilities from offer before generating an answer to it.
  cricket::MediaSessionOptions options;
  if (GetFirstAudioContent(offer))
    options.has_audio = true;
  if (GetFirstVideoContent(offer))
    options.has_video = true;

  talk_base::scoped_ptr<cricket::SessionDescription> answer;
  answer.reset(CreateAnswer(offer, options));

  if (!answer.get()) {
    return false;
  }

  const cricket::ContentInfo* audio_content = GetFirstAudioContent(
      answer.get());
  const cricket::ContentInfo* video_content = GetFirstVideoContent(
      answer.get());

  if (!audio_content && !video_content) {
    return false;
  }

  bool ret = true;
  if (audio_content) {
    ret = !HasAudioChannel() &&
          CreateVoiceChannel(audio_content->name);
    if (!ret) {
      LOG(LERROR) << "Failed to create voice channel for "
                  << audio_content->name;
      return false;
    }
  }

  if (video_content) {
    ret = !HasVideoChannel() &&
          CreateVideoChannel(video_content->name);
    if (!ret) {
      LOG(LERROR) << "Failed to create video channel for "
                  << video_content->name;
      return false;
    }
  }
  // Provide remote candidates to the transport
  transport_->OnRemoteCandidates(candidates);

  set_remote_description(offer);
  SetState(STATE_RECEIVEDINITIATE);

  transport_->ConnectChannels();
  EnableAllStreams();
  SetVideoCapture(true);

  set_local_description(answer.release());

  // AddStream called only once with Video label
  if (video_content) {
    SignalAddStream(video_content->name, true);
  } else {
    SignalAddStream(audio_content->name, false);
  }
  SetState(STATE_SENTACCEPT);
  return true;
}

bool WebRtcSession::OnRemoteDescription(
    cricket::SessionDescription* desc,
    const std::vector<cricket::Candidate>& candidates) {
  if (state() == STATE_SENTACCEPT ||
      state() == STATE_RECEIVEDACCEPT ||
      state() == STATE_INPROGRESS) {
    transport_->OnRemoteCandidates(candidates);
    return true;
  }
  // Session description is always accepted.
  set_remote_description(desc);
  SetState(STATE_RECEIVEDACCEPT);
  // Will trigger OnWritableState() if successful.
  transport_->OnRemoteCandidates(candidates);

  if (!incoming()) {
    // Trigger OnAddStream callback at the initiator
    const cricket::ContentInfo* video_content = GetFirstVideoContent(desc);
    if (video_content && !SendSignalAddStream(true)) {
      LOG(LERROR) << "Video stream unexpected in answer.";
      return false;
    } else {
      const cricket::ContentInfo* audio_content = GetFirstAudioContent(desc);
      if (audio_content && !SendSignalAddStream(false)) {
        LOG(LERROR) << "Audio stream unexpected in answer.";
        return false;
      }
    }
  }
  return true;
}

// Send the SignalAddStream with the stream_id based on the content type.
bool WebRtcSession::SendSignalAddStream(bool video) {
  StreamMap::const_iterator iter;
  for (iter = streams_.begin(); iter != streams_.end(); ++iter) {
    StreamInfo* sinfo = (*iter);
    if (sinfo->video == video) {
      SignalAddStream(sinfo->stream_id, video);
      return true;
    }
  }
  return false;
}

cricket::SessionDescription* WebRtcSession::CreateOffer() {
  cricket::MediaSessionOptions options;
  options.has_audio = false;  // disable default option
  StreamMap::const_iterator iter;
  for (iter = streams_.begin(); iter != streams_.end(); ++iter) {
    if ((*iter)->video) {
      options.has_video = true;
    } else {
      options.has_audio = true;
    }
  }
  // We didn't save the previous offer.
  const cricket::SessionDescription* previous_offer = NULL;
  return desc_factory_.CreateOffer(options, previous_offer);
}

cricket::SessionDescription* WebRtcSession::CreateAnswer(
    const cricket::SessionDescription* offer,
    const cricket::MediaSessionOptions& options) {
  // We didn't save the previous answer.
  const cricket::SessionDescription* previous_answer = NULL;
  return desc_factory_.CreateAnswer(offer, options, previous_answer);
}

void WebRtcSession::SetError(Error error) {
  BaseSession::SetError(error);
}

void WebRtcSession::OnCandidatesReady(
    cricket::Transport* transport,
    const std::vector<cricket::Candidate>& candidates) {
  std::vector<cricket::Candidate>::const_iterator iter;
  for (iter = candidates.begin(); iter != candidates.end(); ++iter) {
    local_candidates_.push_back(*iter);
  }
  SignalLocalDescription(local_description(), candidates);
}
} /* namespace webrtc */
