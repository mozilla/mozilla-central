/*
 * libjingle
 * Copyright 2004--2010, Google Inc.
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

#ifndef TALK_SESSION_PHONE_MEDIACHANNEL_H_
#define TALK_SESSION_PHONE_MEDIACHANNEL_H_

#include <string>
#include <vector>

#include "talk/base/basictypes.h"
#include "talk/base/sigslot.h"
#include "talk/base/socket.h"
#include "talk/base/window.h"
#include "talk/session/phone/codec.h"
// TODO: re-evaluate this include
#include "talk/session/phone/audiomonitor.h"
#include "talk/session/phone/streamparams.h"

namespace talk_base {
class Buffer;
class RateLimiter;
class Timing;
}

namespace cricket {

struct RtpHeader;
class ScreencastId;
struct VideoFormat;
class VideoRenderer;

const int kMinRtpHeaderExtensionId = 1;
const int kMaxRtpHeaderExtensionId = 255;
const int kScreencastDefaultFps = 5;

// A class for playing out soundclips.
class SoundclipMedia {
 public:
  enum SoundclipFlags {
    SF_LOOP = 1,
  };

  virtual ~SoundclipMedia() {}

  // Plays a sound out to the speakers with the given audio stream. The stream
  // must be 16-bit little-endian 16 kHz PCM. If a stream is already playing
  // on this SoundclipMedia, it is stopped. If clip is NULL, nothing is played.
  // Returns whether it was successful.
  virtual bool PlaySound(const char *clip, int len, int flags) = 0;
};

struct RtpHeaderExtension {
  RtpHeaderExtension(const std::string& u, int i) : uri(u), id(i) {}
  std::string uri;
  int id;
  // TODO: SendRecv direction;
};

enum MediaChannelOptions {
  // Tune the stream for conference mode.
  OPT_CONFERENCE = 0x0001
};

enum VoiceMediaChannelOptions {
  // Tune the audio stream for vcs with different target levels.
  OPT_AGC_MINUS_10DB = 0x80000000
};

enum VideoMediaChannelOptions {
  // Increase the output framerate by 2x by interpolating frames.
  OPT_INTERPOLATE = 0x10000,
  // Adapt the video input to the encoder based on CPU.
  OPT_ADAPT_INPUT_TO_CPU_USAGE = 0x20000,
  // Enable video adaption based on encoder's estimation on bandwidth and
  // cpu load.
  OPT_ADAPT_INPUT_TO_ENCODER = 0x40000,
  // Enable video noise reduction.
  OPT_VIDEO_NOISE_REDUCTION = 0x80000
};

class MediaChannel : public sigslot::has_slots<> {
 public:
  class NetworkInterface {
   public:
    enum SocketType { ST_RTP, ST_RTCP };
    virtual bool SendPacket(talk_base::Buffer* packet) = 0;
    virtual bool SendRtcp(talk_base::Buffer* packet) = 0;
    virtual int SetOption(SocketType type, talk_base::Socket::Option opt,
                          int option) = 0;
    virtual ~NetworkInterface() {}
  };

  MediaChannel() : network_interface_(NULL) {}
  virtual ~MediaChannel() {}

  // Gets/sets the abstract inteface class for sending RTP/RTCP data.
  NetworkInterface *network_interface() { return network_interface_; }
  virtual void SetInterface(NetworkInterface *iface) {
    network_interface_ = iface;
  }

  // Called when a RTP packet is received.
  virtual void OnPacketReceived(talk_base::Buffer* packet) = 0;
  // Called when a RTCP packet is received.
  virtual void OnRtcpReceived(talk_base::Buffer* packet) = 0;
  // Creates a new outgoing media stream with SSRCs and CNAME as described
  // by sp.
  virtual bool AddSendStream(const StreamParams& sp) = 0;
  // Removes an outgoing media stream.
  // ssrc must be the first SSRC of the media stream if the stream uses
  // multiple SSRCs.
  virtual bool RemoveSendStream(uint32 ssrc) = 0;
  // Creates a new incoming media stream with SSRCs and CNAME as described
  // by sp.
  virtual bool AddRecvStream(const StreamParams& sp) = 0;
  // Removes an incoming media stream.
  // ssrc must be the first SSRC of the media stream if the stream uses
  // multiple SSRCs.
  virtual bool RemoveRecvStream(uint32 ssrc) = 0;

  // Mutes the channel.
  virtual bool Mute(bool on) = 0;

  // Sets the RTP extension headers and IDs to use when sending RTP.
  virtual bool SetRecvRtpHeaderExtensions(
      const std::vector<RtpHeaderExtension>& extensions) = 0;
  virtual bool SetSendRtpHeaderExtensions(
      const std::vector<RtpHeaderExtension>& extensions) = 0;
  // Sets the rate control to use when sending data.
  virtual bool SetSendBandwidth(bool autobw, int bps) = 0;
  // Sets the media options to use.
  virtual bool SetOptions(int options) = 0;
  virtual int GetOptions() const = 0;

 protected:
  NetworkInterface *network_interface_;
};

enum SendFlags {
  SEND_NOTHING,
  SEND_RINGBACKTONE,
  SEND_MICROPHONE
};

struct VoiceSenderInfo {
  VoiceSenderInfo()
      : ssrc(0),
        bytes_sent(0),
        packets_sent(0),
        packets_lost(0),
        fraction_lost(0.0),
        ext_seqnum(0),
        rtt_ms(0),
        jitter_ms(0),
        audio_level(0),
        echo_delay_median_ms(0),
        echo_delay_std_ms(0),
        echo_return_loss(0),
        echo_return_loss_enhancement(0) {
  }

  uint32 ssrc;
  std::string codec_name;
  int bytes_sent;
  int packets_sent;
  int packets_lost;
  float fraction_lost;
  int ext_seqnum;
  int rtt_ms;
  int jitter_ms;
  int audio_level;
  int echo_delay_median_ms;
  int echo_delay_std_ms;
  int echo_return_loss;
  int echo_return_loss_enhancement;
};

struct VoiceReceiverInfo {
  VoiceReceiverInfo()
      : ssrc(0),
        bytes_rcvd(0),
        packets_rcvd(0),
        packets_lost(0),
        fraction_lost(0.0),
        ext_seqnum(0),
        jitter_ms(0),
        jitter_buffer_ms(0),
        jitter_buffer_preferred_ms(0),
        delay_estimate_ms(0),
        audio_level(0) {
  }

  uint32 ssrc;
  int bytes_rcvd;
  int packets_rcvd;
  int packets_lost;
  float fraction_lost;
  int ext_seqnum;
  int jitter_ms;
  int jitter_buffer_ms;
  int jitter_buffer_preferred_ms;
  int delay_estimate_ms;
  int audio_level;
};

struct VideoSenderInfo {
  VideoSenderInfo()
      : bytes_sent(0),
        packets_sent(0),
        packets_cached(0),
        packets_lost(0),
        fraction_lost(0.0),
        firs_rcvd(0),
        nacks_rcvd(0),
        rtt_ms(0),
        frame_width(0),
        frame_height(0),
        framerate_input(0),
        framerate_sent(0),
        nominal_bitrate(0),
        preferred_bitrate(0) {
  }

  std::vector<uint32> ssrcs;
  std::vector<SsrcGroup> ssrc_groups;
  std::string codec_name;
  int bytes_sent;
  int packets_sent;
  int packets_cached;
  int packets_lost;
  float fraction_lost;
  int firs_rcvd;
  int nacks_rcvd;
  int rtt_ms;
  int frame_width;
  int frame_height;
  int framerate_input;
  int framerate_sent;
  int nominal_bitrate;
  int preferred_bitrate;
};

struct VideoReceiverInfo {
  VideoReceiverInfo()
      : bytes_rcvd(0),
        packets_rcvd(0),
        packets_lost(0),
        packets_concealed(0),
        fraction_lost(0.0),
        firs_sent(0),
        nacks_sent(0),
        frame_width(0),
        frame_height(0),
        framerate_rcvd(0),
        framerate_decoded(0),
        framerate_output(0) {
  }

  std::vector<uint32> ssrcs;
  std::vector<SsrcGroup> ssrc_groups;
  int bytes_rcvd;
  // vector<int> layer_bytes_rcvd;
  int packets_rcvd;
  int packets_lost;
  int packets_concealed;
  float fraction_lost;
  int firs_sent;
  int nacks_sent;
  int frame_width;
  int frame_height;
  int framerate_rcvd;
  int framerate_decoded;
  int framerate_output;
};

struct DataSenderInfo {
  DataSenderInfo()
      : ssrc(0),
        bytes_sent(0),
        packets_sent(0) {
  }

  uint32 ssrc;
  std::string codec_name;
  int bytes_sent;
  int packets_sent;
};

struct DataReceiverInfo {
  DataReceiverInfo()
      : ssrc(0),
        bytes_rcvd(0),
        packets_rcvd(0) {
  }

  uint32 ssrc;
  int bytes_rcvd;
  int packets_rcvd;
};

struct BandwidthEstimationInfo {
  BandwidthEstimationInfo()
      : available_send_bandwidth(0),
        available_recv_bandwidth(0),
        target_enc_bitrate(0),
        actual_enc_bitrate(0),
        retransmit_bitrate(0),
        transmit_bitrate(0),
        bucket_delay(0) {
  }

  int available_send_bandwidth;
  int available_recv_bandwidth;
  int target_enc_bitrate;
  int actual_enc_bitrate;
  int retransmit_bitrate;
  int transmit_bitrate;
  int bucket_delay;
};

struct VoiceMediaInfo {
  void Clear() {
    senders.clear();
    receivers.clear();
  }
  std::vector<VoiceSenderInfo> senders;
  std::vector<VoiceReceiverInfo> receivers;
};

struct VideoMediaInfo {
  void Clear() {
    senders.clear();
    receivers.clear();
    bw_estimations.clear();
  }
  std::vector<VideoSenderInfo> senders;
  std::vector<VideoReceiverInfo> receivers;
  std::vector<BandwidthEstimationInfo> bw_estimations;
};

struct DataMediaInfo {
  void Clear() {
    senders.clear();
    receivers.clear();
  }
  std::vector<DataSenderInfo> senders;
  std::vector<DataReceiverInfo> receivers;
};

class VoiceMediaChannel : public MediaChannel {
 public:
  enum Error {
    ERROR_NONE = 0,                       // No error.
    ERROR_OTHER,                          // Other errors.
    ERROR_REC_DEVICE_OPEN_FAILED = 100,   // Could not open mic.
    ERROR_REC_DEVICE_MUTED,               // Mic was muted by OS.
    ERROR_REC_DEVICE_SILENT,              // No background noise picked up.
    ERROR_REC_DEVICE_SATURATION,          // Mic input is clipping.
    ERROR_REC_DEVICE_REMOVED,             // Mic was removed while active.
    ERROR_REC_RUNTIME_ERROR,              // Processing is encountering errors.
    ERROR_REC_SRTP_ERROR,                 // Generic SRTP failure.
    ERROR_REC_SRTP_AUTH_FAILED,           // Failed to authenticate packets.
    ERROR_REC_TYPING_NOISE_DETECTED,      // Typing noise is detected.
    ERROR_PLAY_DEVICE_OPEN_FAILED = 200,  // Could not open playout.
    ERROR_PLAY_DEVICE_MUTED,              // Playout muted by OS.
    ERROR_PLAY_DEVICE_REMOVED,            // Playout removed while active.
    ERROR_PLAY_RUNTIME_ERROR,             // Errors in voice processing.
    ERROR_PLAY_SRTP_ERROR,                // Generic SRTP failure.
    ERROR_PLAY_SRTP_AUTH_FAILED,          // Failed to authenticate packets.
    ERROR_PLAY_SRTP_REPLAY,               // Packet replay detected.
  };

  VoiceMediaChannel() {}
  virtual ~VoiceMediaChannel() {}
  // Sets the codecs/payload types to be used for incoming media.
  virtual bool SetRecvCodecs(const std::vector<AudioCodec>& codecs) = 0;
  // Sets the codecs/payload types to be used for outgoing media.
  virtual bool SetSendCodecs(const std::vector<AudioCodec>& codecs) = 0;
  // Starts or stops playout of received audio.
  virtual bool SetPlayout(bool playout) = 0;
  // Starts or stops sending (and potentially capture) of local audio.
  virtual bool SetSend(SendFlags flag) = 0;
  // Gets current energy levels for all incoming streams.
  virtual bool GetActiveStreams(AudioInfo::StreamList* actives) = 0;
  // Get the current energy level of the stream sent to the speaker.
  virtual int GetOutputLevel() = 0;
  // Set left and right scale for speaker output volume of the specified ssrc.
  virtual bool SetOutputScaling(uint32 ssrc, double left, double right) = 0;
  // Get left and right scale for speaker output volume of the specified ssrc.
  virtual bool GetOutputScaling(uint32 ssrc, double* left, double* right) = 0;
  // Specifies a ringback tone to be played during call setup.
  virtual bool SetRingbackTone(const char *buf, int len) = 0;
  // Plays or stops the aforementioned ringback tone
  virtual bool PlayRingbackTone(uint32 ssrc, bool play, bool loop) = 0;
  // Sends a out-of-band DTMF signal using the specified event.
  virtual bool PressDTMF(int event, bool playout) = 0;
  // Gets quality stats for the channel.
  virtual bool GetStats(VoiceMediaInfo* info) = 0;
  // Gets last reported error for this media channel.
  virtual void GetLastMediaError(uint32* ssrc,
                                 VoiceMediaChannel::Error* error) {
    ASSERT(error != NULL);
    *error = ERROR_NONE;
  }

  // Signal errors from MediaChannel.  Arguments are:
  //     ssrc(uint32), and error(VoiceMediaChannel::Error).
  sigslot::signal2<uint32, VoiceMediaChannel::Error> SignalMediaError;
};

class VideoMediaChannel : public MediaChannel {
 public:
  enum Error {
    ERROR_NONE = 0,                       // No error.
    ERROR_OTHER,                          // Other errors.
    ERROR_REC_DEVICE_OPEN_FAILED = 100,   // Could not open camera.
    ERROR_REC_DEVICE_NO_DEVICE,           // No camera.
    ERROR_REC_DEVICE_IN_USE,              // Device is in already use.
    ERROR_REC_DEVICE_REMOVED,             // Device is removed.
    ERROR_REC_SRTP_ERROR,                 // Generic sender SRTP failure.
    ERROR_REC_SRTP_AUTH_FAILED,           // Failed to authenticate packets.
    ERROR_PLAY_SRTP_ERROR = 200,          // Generic receiver SRTP failure.
    ERROR_PLAY_SRTP_AUTH_FAILED,          // Failed to authenticate packets.
    ERROR_PLAY_SRTP_REPLAY,               // Packet replay detected.
  };

  VideoMediaChannel() : renderer_(NULL) {}
  virtual ~VideoMediaChannel() {}
  // Sets the codecs/payload types to be used for incoming media.
  virtual bool SetRecvCodecs(const std::vector<VideoCodec> &codecs) = 0;
  // Sets the codecs/payload types to be used for outgoing media.
  virtual bool SetSendCodecs(const std::vector<VideoCodec> &codecs) = 0;
  // Sets the format of a specified outgoing stream.
  virtual bool SetSendStreamFormat(uint32 ssrc, const VideoFormat& format) = 0;
  // Starts or stops playout of received video.
  virtual bool SetRender(bool render) = 0;
  // Starts or stops transmission (and potentially capture) of local video.
  virtual bool SetSend(bool send) = 0;
  // Sets the renderer object to be used for the specified stream.
  // If SSRC is 0, the renderer is used for the 'default' stream.
  virtual bool SetRenderer(uint32 ssrc, VideoRenderer* renderer) = 0;
  virtual bool AddScreencast(uint32 ssrc, const ScreencastId& id, int fps) = 0;
  virtual bool RemoveScreencast(uint32 ssrc) = 0;
  // Gets quality stats for the channel.
  virtual bool GetStats(VideoMediaInfo* info) = 0;

  // Send an intra frame to the receivers.
  virtual bool SendIntraFrame() = 0;
  // Reuqest each of the remote senders to send an intra frame.
  virtual bool RequestIntraFrame() = 0;

  // Signals events from the currently active window.
  sigslot::signal2<uint32, talk_base::WindowEvent> SignalScreencastWindowEvent;
  sigslot::signal2<uint32, Error> SignalMediaError;

 protected:
  VideoRenderer *renderer_;
};

// Info about data received in DataMediaChannel.  For use in
// DataMediaChannel::SignalDataReceived and in all of the signals that
// signal fires, on up the chain.
struct ReceiveDataParams {
  uint32 ssrc;
  int seq_num;
  int timestamp;
};

// Implemented in datamediaengine.cc.
// TODO: Should we make this abstract and make a
// DataMediaChannelImpl in datamediaengine.cc to avoid dependencies?
class DataMediaChannel : public MediaChannel {
 public:
  struct SendDataParams {
    uint32 ssrc;
  };

  enum Error {
    ERROR_NONE = 0,                       // No error.
    ERROR_OTHER,                          // Other errors.
    ERROR_SEND_SRTP_ERROR = 200,          // Generic SRTP failure.
    ERROR_SEND_SRTP_AUTH_FAILED,          // Failed to authenticate packets.
    ERROR_RECV_SRTP_ERROR,                // Generic SRTP failure.
    ERROR_RECV_SRTP_AUTH_FAILED,          // Failed to authenticate packets.
    ERROR_RECV_SRTP_REPLAY,               // Packet replay detected.
  };

  // Timing* Used for the RtpClock
  explicit DataMediaChannel(talk_base::Timing* timing);
  // Sets Timing == NULL, so you'll need to call set_timer() before
  // using it.  This is needed by FakeMediaEngine.
  DataMediaChannel();
  virtual ~DataMediaChannel();

  void set_timing(talk_base::Timing* timing) {
    timing_ = timing;
  }

  virtual bool SetOptions(int options) { return false; }
  virtual int GetOptions() const { return 0; }
  virtual bool SetSendBandwidth(bool autobw, int bps);
  virtual bool SetSendCodecs(const std::vector<DataCodec>& codecs);
  virtual bool SetRecvCodecs(const std::vector<DataCodec>& codecs);
  virtual bool SetRecvRtpHeaderExtensions(
      const std::vector<RtpHeaderExtension>& extensions) { return true; }
  virtual bool SetSendRtpHeaderExtensions(
      const std::vector<RtpHeaderExtension>& extensions) { return true; }
  virtual bool AddSendStream(const StreamParams& sp);
  virtual bool RemoveSendStream(uint32 ssrc);
  virtual bool AddRecvStream(const StreamParams& sp);
  virtual bool RemoveRecvStream(uint32 ssrc);
  virtual bool Mute(bool on) { return false; }
  // TODO: Implement this.
  virtual bool GetStats(DataMediaInfo* info) { return true; }

  virtual bool SetSend(bool send) {
    sending_ = send;
    return true;
  }
  virtual bool SetReceive(bool receive) {
    receiving_ = receive;
    return true;
  }
  virtual void OnPacketReceived(talk_base::Buffer* packet);
  virtual void OnRtcpReceived(talk_base::Buffer* packet) {}

  virtual bool SendData(
      const SendDataParams& params, const std::string& data);
  // Signals when data is received (params, data, len)
  sigslot::signal3<const ReceiveDataParams&,
                   const char*,
                   size_t> SignalDataReceived;
  // Signal errors from MediaChannel.  Arguments are:
  //     ssrc(uint32), and error(DataMediaChannel::Error).
  sigslot::signal2<uint32, DataMediaChannel::Error> SignalMediaError;

 private:
  class RtpClock;

  void Construct(talk_base::Timing* timing);

  bool sending_;
  bool receiving_;
  talk_base::Timing* timing_;
  std::vector<DataCodec> send_codecs_;
  std::vector<DataCodec> recv_codecs_;
  std::vector<StreamParams> send_streams_;
  std::vector<StreamParams> recv_streams_;
  std::map<uint32, RtpClock*> rtp_clock_by_send_ssrc_;
  talk_base::scoped_ptr<talk_base::RateLimiter> send_limiter_;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_MEDIACHANNEL_H_
