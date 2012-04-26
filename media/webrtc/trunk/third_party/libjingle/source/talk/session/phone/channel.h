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

#ifndef TALK_SESSION_PHONE_CHANNEL_H_
#define TALK_SESSION_PHONE_CHANNEL_H_

#include <string>
#include <vector>

#include "talk/base/asyncudpsocket.h"
#include "talk/base/criticalsection.h"
#include "talk/base/network.h"
#include "talk/base/sigslot.h"
#include "talk/base/window.h"
#include "talk/p2p/client/socketmonitor.h"
#include "talk/p2p/base/session.h"
#include "talk/session/phone/audiomonitor.h"
#include "talk/session/phone/mediachannel.h"
#include "talk/session/phone/mediaengine.h"
#include "talk/session/phone/mediamonitor.h"
#include "talk/session/phone/rtcpmuxfilter.h"
#include "talk/session/phone/screencastid.h"
#include "talk/session/phone/ssrcmuxfilter.h"
#include "talk/session/phone/streamparams.h"
#include "talk/session/phone/srtpfilter.h"

namespace cricket {

class MediaContentDescription;
struct CryptoParams;
struct ViewRequest;

enum SinkType {
  SINK_PRE_CRYPTO,  // Sink packets before encryption or after decryption.
  SINK_POST_CRYPTO  // Sink packets after encryption or before decryption.
};

// BaseChannel contains logic common to voice and video, including
// enable/mute, marshaling calls to a worker thread, and
// connection and media monitors.
class BaseChannel
    : public talk_base::MessageHandler, public sigslot::has_slots<>,
      public MediaChannel::NetworkInterface {
 public:
  BaseChannel(talk_base::Thread* thread, MediaEngineInterface* media_engine,
              MediaChannel* channel, BaseSession* session,
              const std::string& content_name, bool rtcp);
  virtual ~BaseChannel();
  bool Init(TransportChannel* transport_channel,
            TransportChannel* rtcp_transport_channel);

  talk_base::Thread* worker_thread() const { return worker_thread_; }
  BaseSession* session() const { return session_; }
  const std::string& content_name() { return content_name_; }
  TransportChannel* transport_channel() const {
    return transport_channel_;
  }
  TransportChannel* rtcp_transport_channel() const {
    return rtcp_transport_channel_;
  }
  bool enabled() const { return enabled_; }
  bool secure() const { return srtp_filter_.IsActive(); }

  // Channel control
  bool SetLocalContent(const MediaContentDescription* content,
                       ContentAction action);
  bool SetRemoteContent(const MediaContentDescription* content,
                        ContentAction action);
  bool SetMaxSendBandwidth(int max_bandwidth);

  bool Enable(bool enable);
  bool Mute(bool mute);

  // Multiplexing
  bool AddRecvStream(const StreamParams& sp);
  bool RemoveRecvStream(uint32 ssrc);

  // Monitoring
  void StartConnectionMonitor(int cms);
  void StopConnectionMonitor();

  // Configuration and setting.
  void SetChannelOptions(int options);

  void set_srtp_signal_silent_time(uint32 silent_time) {
    srtp_filter_.set_signal_silent_time(silent_time);
  }

  template <class T>
  void RegisterSendSink(T* sink,
                        void (T::*OnPacket)(const void*, size_t, bool),
                        SinkType type) {
    talk_base::CritScope cs(&signal_send_packet_cs_);
    if (SINK_POST_CRYPTO == type) {
      SignalSendPacketPostCrypto.disconnect(sink);
      SignalSendPacketPostCrypto.connect(sink, OnPacket);
    } else {
      SignalSendPacketPreCrypto.disconnect(sink);
      SignalSendPacketPreCrypto.connect(sink, OnPacket);
    }
  }

  void UnregisterSendSink(sigslot::has_slots<>* sink,
                          SinkType type) {
    talk_base::CritScope cs(&signal_send_packet_cs_);
    if (SINK_POST_CRYPTO == type) {
      SignalSendPacketPostCrypto.disconnect(sink);
    } else {
      SignalSendPacketPreCrypto.disconnect(sink);
    }
  }

  bool HasSendSinks(SinkType type) {
    talk_base::CritScope cs(&signal_send_packet_cs_);
    if (SINK_POST_CRYPTO == type) {
      return !SignalSendPacketPostCrypto.is_empty();
    } else {
      return !SignalSendPacketPreCrypto.is_empty();
    }
  }

  template <class T>
  void RegisterRecvSink(T* sink,
                        void (T::*OnPacket)(const void*, size_t, bool),
                        SinkType type) {
    talk_base::CritScope cs(&signal_recv_packet_cs_);
    if (SINK_POST_CRYPTO == type) {
      SignalRecvPacketPostCrypto.disconnect(sink);
      SignalRecvPacketPostCrypto.connect(sink, OnPacket);
    } else {
      SignalRecvPacketPreCrypto.disconnect(sink);
      SignalRecvPacketPreCrypto.connect(sink, OnPacket);
    }
  }

  void UnregisterRecvSink(sigslot::has_slots<>* sink,
                          SinkType type) {
    talk_base::CritScope cs(&signal_recv_packet_cs_);
    if (SINK_POST_CRYPTO == type) {
      SignalRecvPacketPostCrypto.disconnect(sink);
    } else {
      SignalRecvPacketPreCrypto.disconnect(sink);
    }
  }

  bool HasRecvSinks(SinkType type) {
    talk_base::CritScope cs(&signal_recv_packet_cs_);
    if (SINK_POST_CRYPTO == type) {
      return !SignalRecvPacketPostCrypto.is_empty();
    } else {
      return !SignalRecvPacketPreCrypto.is_empty();
    }
  }

  SsrcMuxFilter* ssrc_filter() { return &ssrc_filter_; }

  const std::vector<StreamParams>& local_streams() const {
    return local_streams_;
  }
  const std::vector<StreamParams>& remote_streams() const {
    return remote_streams_;
  }

 protected:
  MediaEngineInterface* media_engine() const { return media_engine_; }
  virtual MediaChannel* media_channel() const { return media_channel_; }
  void set_rtcp_transport_channel(TransportChannel* transport);
  bool writable() const { return writable_; }
  bool was_ever_writable() const { return was_ever_writable_; }
  bool has_local_content() const { return has_local_content_; }
  bool has_remote_content() const { return has_remote_content_; }
  void set_has_local_content(bool has) { has_local_content_ = has; }
  void set_has_remote_content(bool has) { has_remote_content_ = has; }
  bool muted() const { return muted_; }
  talk_base::Thread* signaling_thread() { return session_->signaling_thread(); }
  SrtpFilter* srtp_filter() { return &srtp_filter_; }
  bool rtcp() const { return rtcp_; }

  void Send(uint32 id, talk_base::MessageData *pdata = NULL);
  void Post(uint32 id, talk_base::MessageData *pdata = NULL);
  void PostDelayed(int cmsDelay, uint32 id = 0,
                   talk_base::MessageData *pdata = NULL);
  void Clear(uint32 id = talk_base::MQID_ANY,
             talk_base::MessageList* removed = NULL);
  void FlushRtcpMessages();

  // NetworkInterface implementation, called by MediaEngine
  virtual bool SendPacket(talk_base::Buffer* packet);
  virtual bool SendRtcp(talk_base::Buffer* packet);
  virtual int SetOption(SocketType type, talk_base::Socket::Option o, int val);

  // From TransportChannel
  void OnWritableState(TransportChannel* channel);
  virtual void OnChannelRead(TransportChannel* channel, const char* data,
                             size_t len);

  bool PacketIsRtcp(const TransportChannel* channel, const char* data,
                    size_t len);
  bool SendPacket(bool rtcp, talk_base::Buffer* packet);
  void HandlePacket(bool rtcp, talk_base::Buffer* packet);

  // Setting the send codec based on the remote description.
  void OnSessionState(BaseSession* session, BaseSession::State state);

  void EnableMedia_w();
  void DisableMedia_w();
  void MuteMedia_w();
  void UnmuteMedia_w();
  void ChannelWritable_w();
  void ChannelNotWritable_w();
  bool AddRecvStream_w(const StreamParams& sp);
  bool RemoveRecvStream_w(uint32 ssrc);

  // Configuration and setting.
  void SetChannelOptions_w(int options);

  virtual void ChangeState() = 0;

  // Gets the content appropriate to the channel (audio or video).
  virtual const MediaContentDescription* GetFirstContent(
      const SessionDescription* sdesc) = 0;
  bool UpdateLocalStreams_w(const std::vector<StreamParams>& streams,
                            ContentAction action);
  bool UpdateRemoteStreams_w(const std::vector<StreamParams>& streams,
                             ContentAction action);
  bool SetBaseLocalContent_w(const MediaContentDescription* content,
                             ContentAction action);
  virtual bool SetLocalContent_w(const MediaContentDescription* content,
                                 ContentAction action) = 0;
  bool SetBaseRemoteContent_w(const MediaContentDescription* content,
                              ContentAction action);
  virtual bool SetRemoteContent_w(const MediaContentDescription* content,
                                  ContentAction action) = 0;

  bool SetSrtp_w(const std::vector<CryptoParams>& params, ContentAction action,
                 ContentSource src);
  bool SetRtcpMux_w(bool enable, ContentAction action, ContentSource src);

  bool SetMaxSendBandwidth_w(int max_bandwidth);

  // From MessageHandler
  virtual void OnMessage(talk_base::Message *pmsg);

  // Handled in derived classes
  virtual void OnConnectionMonitorUpdate(SocketMonitor *monitor,
      const std::vector<ConnectionInfo> &infos) = 0;

 private:
  sigslot::signal3<const void*, size_t, bool> SignalSendPacketPreCrypto;
  sigslot::signal3<const void*, size_t, bool> SignalSendPacketPostCrypto;
  sigslot::signal3<const void*, size_t, bool> SignalRecvPacketPreCrypto;
  sigslot::signal3<const void*, size_t, bool> SignalRecvPacketPostCrypto;
  talk_base::CriticalSection signal_send_packet_cs_;
  talk_base::CriticalSection signal_recv_packet_cs_;

  talk_base::Thread *worker_thread_;
  MediaEngineInterface *media_engine_;
  BaseSession *session_;
  MediaChannel *media_channel_;
  std::vector<StreamParams> local_streams_;
  std::vector<StreamParams> remote_streams_;

  std::string content_name_;
  bool rtcp_;
  TransportChannel *transport_channel_;
  TransportChannel *rtcp_transport_channel_;
  SrtpFilter srtp_filter_;
  RtcpMuxFilter rtcp_mux_filter_;
  SsrcMuxFilter ssrc_filter_;
  talk_base::scoped_ptr<SocketMonitor> socket_monitor_;
  bool enabled_;
  bool writable_;
  bool was_ever_writable_;
  bool has_local_content_;
  bool has_remote_content_;
  bool muted_;
};

// VoiceChannel is a specialization that adds support for early media, DTMF,
// and input/output level monitoring.
class VoiceChannel : public BaseChannel {
 public:
  VoiceChannel(talk_base::Thread *thread, MediaEngineInterface *media_engine,
               VoiceMediaChannel *channel, BaseSession *session,
               const std::string& content_name, bool rtcp);
  ~VoiceChannel();
  bool Init();

  // downcasts a MediaChannel
  virtual VoiceMediaChannel* media_channel() const {
    return static_cast<VoiceMediaChannel*>(BaseChannel::media_channel());
  }

  bool SetRingbackTone(const void* buf, int len);
  void SetEarlyMedia(bool enable);
  // This signal is emitted when we have gone a period of time without
  // receiving early media. When received, a UI should start playing its
  // own ringing sound
  sigslot::signal1<VoiceChannel*> SignalEarlyMediaTimeout;

  bool PlayRingbackTone(uint32 ssrc, bool play, bool loop);
  bool PressDTMF(int digit, bool playout);
  bool SetOutputScaling(uint32 ssrc, double left, double right);
  void set_mute_on_type(bool enable, int timeout) {
    mute_on_type_ = enable;
    mute_on_type_timeout_ = talk_base::_max(0, timeout);
  }

  // Monitoring functions
  sigslot::signal2<VoiceChannel*, const std::vector<ConnectionInfo> &>
      SignalConnectionMonitor;

  void StartMediaMonitor(int cms);
  void StopMediaMonitor();
  sigslot::signal2<VoiceChannel*, const VoiceMediaInfo&> SignalMediaMonitor;

  void StartAudioMonitor(int cms);
  void StopAudioMonitor();
  bool IsAudioMonitorRunning() const;
  sigslot::signal2<VoiceChannel*, const AudioInfo&> SignalAudioMonitor;

  int GetInputLevel_w();
  int GetOutputLevel_w();
  void GetActiveStreams_w(AudioInfo::StreamList* actives);

  // Signal errors from VoiceMediaChannel.  Arguments are:
  //     ssrc(uint32), and error(VoiceMediaChannel::Error).
  sigslot::signal3<VoiceChannel*, uint32, VoiceMediaChannel::Error>
      SignalMediaError;

  static const int kTypingBlackoutPeriod = 1500;

 private:
  // overrides from BaseChannel
  virtual void OnChannelRead(TransportChannel* channel,
                             const char *data, size_t len);
  virtual void ChangeState();
  virtual const MediaContentDescription* GetFirstContent(
      const SessionDescription* sdesc);
  virtual bool SetLocalContent_w(const MediaContentDescription* content,
                                 ContentAction action);
  virtual bool SetRemoteContent_w(const MediaContentDescription* content,
                                  ContentAction action);

  bool SetRingbackTone_w(const void* buf, int len);
  bool PlayRingbackTone_w(uint32 ssrc, bool play, bool loop);
  void HandleEarlyMediaTimeout();
  bool PressDTMF_w(int digit, bool playout);
  bool SetOutputScaling_w(uint32 ssrc, double left, double right);

  virtual void OnMessage(talk_base::Message *pmsg);
  virtual void OnConnectionMonitorUpdate(
      SocketMonitor *monitor, const std::vector<ConnectionInfo> &infos);
  virtual void OnMediaMonitorUpdate(
      VoiceMediaChannel *media_channel, const VoiceMediaInfo& info);
  void OnAudioMonitorUpdate(AudioMonitor *monitor, const AudioInfo& info);
  void OnVoiceChannelError(uint32 ssrc, VoiceMediaChannel::Error error);
  void SendLastMediaError();
  void OnSrtpError(uint32 ssrc, SrtpFilter::Mode mode, SrtpFilter::Error error);

  static const int kEarlyMediaTimeout = 1000;
  bool received_media_;
  talk_base::scoped_ptr<VoiceMediaMonitor> media_monitor_;
  talk_base::scoped_ptr<AudioMonitor> audio_monitor_;
  bool mute_on_type_;
  int  mute_on_type_timeout_;
};

// VideoChannel is a specialization for video.
class VideoChannel : public BaseChannel {
 public:
  VideoChannel(talk_base::Thread *thread, MediaEngineInterface *media_engine,
               VideoMediaChannel *channel, BaseSession *session,
               const std::string& content_name, bool rtcp,
               VoiceChannel *voice_channel);
  ~VideoChannel();
  bool Init();

  // downcasts a MediaChannel
  virtual VideoMediaChannel* media_channel() const {
    return static_cast<VideoMediaChannel*>(BaseChannel::media_channel());
  }

  bool SetRenderer(uint32 ssrc, VideoRenderer* renderer);
  bool ApplyViewRequest(const ViewRequest& request);

  bool AddScreencast(uint32 ssrc, const ScreencastId& id, int fps);
  bool RemoveScreencast(uint32 ssrc);

  sigslot::signal2<VideoChannel*, const std::vector<ConnectionInfo> &>
      SignalConnectionMonitor;

  void StartMediaMonitor(int cms);
  void StopMediaMonitor();
  sigslot::signal2<VideoChannel*, const VideoMediaInfo&> SignalMediaMonitor;
  sigslot::signal2<uint32, talk_base::WindowEvent> SignalScreencastWindowEvent;

  bool SendIntraFrame();
  bool RequestIntraFrame();
  sigslot::signal3<VideoChannel*, uint32, VideoMediaChannel::Error>
      SignalMediaError;

 private:
  // overrides from BaseChannel
  virtual void ChangeState();
  virtual const MediaContentDescription* GetFirstContent(
      const SessionDescription* sdesc);
  virtual bool SetLocalContent_w(const MediaContentDescription* content,
                                 ContentAction action);
  virtual bool SetRemoteContent_w(const MediaContentDescription* content,
                                  ContentAction action);

  void SendIntraFrame_w() {
    media_channel()->SendIntraFrame();
  }
  void RequestIntraFrame_w() {
    media_channel()->RequestIntraFrame();
  }

  bool ApplyViewRequest_w(const ViewRequest& request);
  void SetRenderer_w(uint32 ssrc, VideoRenderer* renderer);

  void AddScreencast_w(uint32 ssrc, const ScreencastId& id, int fps);
  void RemoveScreencast_w(uint32 ssrc);
  void OnScreencastWindowEvent_s(uint32 ssrc, talk_base::WindowEvent we);

  virtual void OnMessage(talk_base::Message *pmsg);
  virtual void OnConnectionMonitorUpdate(
      SocketMonitor *monitor, const std::vector<ConnectionInfo> &infos);
  virtual void OnMediaMonitorUpdate(
      VideoMediaChannel *media_channel, const VideoMediaInfo& info);
  virtual void OnScreencastWindowEvent(uint32 ssrc,
                                       talk_base::WindowEvent event);
  void OnVideoChannelError(uint32 ssrc, VideoMediaChannel::Error error);
  void OnSrtpError(uint32 ssrc, SrtpFilter::Mode mode, SrtpFilter::Error error);

  VoiceChannel *voice_channel_;
  VideoRenderer *renderer_;
  talk_base::scoped_ptr<VideoMediaMonitor> media_monitor_;
};

// DataChannel is a specialization for data.
class DataChannel : public BaseChannel {
 public:
  DataChannel(talk_base::Thread *thread,
              DataMediaChannel* media_channel,
              BaseSession *session,
              const std::string& content_name,
              bool rtcp);
  ~DataChannel();
  bool Init();

  // downcasts a MediaChannel
  virtual DataMediaChannel* media_channel() const {
    return static_cast<DataMediaChannel*>(BaseChannel::media_channel());
  }

  bool SendData(const DataMediaChannel::SendDataParams& params,
                const std::string& data);

  void StartMediaMonitor(int cms);
  void StopMediaMonitor();

  sigslot::signal2<DataChannel*, const DataMediaInfo&> SignalMediaMonitor;
  sigslot::signal2<DataChannel*, const std::vector<ConnectionInfo> &>
      SignalConnectionMonitor;
  sigslot::signal3<DataChannel*, uint32, DataMediaChannel::Error>
      SignalMediaError;
  sigslot::signal3<DataChannel*,
                   const ReceiveDataParams&,
                   const std::string&>
      SignalDataReceived;

 private:
  struct SendDataMessageData : public talk_base::MessageData {
    SendDataMessageData(const DataMediaChannel::SendDataParams& params,
                        const std::string& data)
        : params(params),
          data(data) {
    }
    const DataMediaChannel::SendDataParams params;
    const std::string data;
  };

  struct DataReceivedMessageData : public talk_base::MessageData {
    // We copy the data because the data will become invalid after we
    // handle DataMediaChannel::SignalDataReceived but before we fire
    // SignalDataReceived.
    DataReceivedMessageData(
        const ReceiveDataParams& params, const char* data, size_t len)
        : params(params),
          data(data, len) {
    }
    const ReceiveDataParams params;
    const std::string data;
  };

  // overrides from BaseChannel
  virtual const MediaContentDescription* GetFirstContent(
      const SessionDescription* sdesc);
  virtual bool SetLocalContent_w(const MediaContentDescription* content,
                                 ContentAction action);
  virtual bool SetRemoteContent_w(const MediaContentDescription* content,
                                  ContentAction action);
  virtual void ChangeState();

  virtual void OnMessage(talk_base::Message *pmsg);
  virtual void OnConnectionMonitorUpdate(
      SocketMonitor *monitor, const std::vector<ConnectionInfo> &infos);
  virtual void OnMediaMonitorUpdate(
      DataMediaChannel *media_channel, const DataMediaInfo& info);
  void OnDataReceived(
      const ReceiveDataParams& params, const char* data, size_t len);
  void OnDataChannelError(uint32 ssrc, DataMediaChannel::Error error);
  void OnSrtpError(uint32 ssrc, SrtpFilter::Mode mode, SrtpFilter::Error error);

  talk_base::scoped_ptr<DataMediaMonitor> media_monitor_;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_CHANNEL_H_
