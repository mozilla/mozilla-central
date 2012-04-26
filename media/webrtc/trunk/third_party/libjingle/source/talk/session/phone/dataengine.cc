/*
 * libjingle
 * Copyright 2012, Google Inc.
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

#include "talk/session/phone/dataengine.h"

#include "talk/base/buffer.h"
#include "talk/base/logging.h"
#include "talk/base/helpers.h"
#include "talk/base/ratelimiter.h"
#include "talk/base/timing.h"
#include "talk/session/phone/codec.h"
#include "talk/session/phone/constants.h"
#include "talk/session/phone/rtputils.h"
#include "talk/session/phone/streamparams.h"

namespace cricket {

// We want to avoid IP fragmentation.
static const size_t kDataMaxRtpPacketLen = 1200U;
// We reserve space after the RTP header for future wiggle room.
static const unsigned char kReservedSpace[] = {
  0x00, 0x00, 0x00, 0x00
};
// Amount of overhead SRTP may take.  We need to leave room in the
// buffer for it, otherwise SRTP will fail later.  If SRTP ever uses
// more than this, we need to increase this number.
static const size_t kMaxSrtpHmacOverhead = 16;

DataEngine::DataEngine() {
  data_codecs_.push_back(
      DataCodec(cricket::kGoogleDataCodecId,
                cricket::kGoogleDataCodecName, 0));
  SetTiming(new talk_base::Timing());
}

DataMediaChannel* DataEngine::CreateChannel() {
  return new DataMediaChannel(timing_.get());
}

// TODO: Should we move these find/get functions somewhere
// common?
bool FindCodecById(const std::vector<cricket::DataCodec>& codecs,
                   int id, cricket::DataCodec* codec_out) {
  std::vector<cricket::DataCodec>::const_iterator iter;
  for (iter = codecs.begin(); iter != codecs.end(); ++iter) {
    if (iter->id == id) {
      *codec_out = *iter;
      return true;
    }
  }
  return false;
}

bool FindCodecByName(const std::vector<cricket::DataCodec>& codecs,
                     const std::string& name, cricket::DataCodec* codec_out) {
  std::vector<cricket::DataCodec>::const_iterator iter;
  for (iter = codecs.begin(); iter != codecs.end(); ++iter) {
    if (iter->name == name) {
      *codec_out = *iter;
      return true;
    }
  }
  return false;
}

DataMediaChannel::DataMediaChannel(talk_base::Timing* timing) {
  Construct(timing);
}

DataMediaChannel::DataMediaChannel() {
  Construct(NULL);
}

void DataMediaChannel::Construct(talk_base::Timing* timing) {
  sending_ = false;
  receiving_ = false;
  timing_ = timing;
  send_limiter_.reset(new talk_base::RateLimiter(kDataMaxBandwidth / 8, 1.0));
}


DataMediaChannel::~DataMediaChannel() {
  std::map<uint32, RtpClock*>::const_iterator iter;
  for (iter = rtp_clock_by_send_ssrc_.begin();
       iter != rtp_clock_by_send_ssrc_.end();
       ++iter) {
    delete iter->second;
  }
}

void DataMediaChannel::RtpClock::Tick(
    double now, int* seq_num, uint32* timestamp) {
  *seq_num = ++last_seq_num_;
  *timestamp = timestamp_offset_ + static_cast<uint32>(now * clockrate_);
}

const DataCodec* FindUnknownCodec(const std::vector<DataCodec>& codecs) {
  std::vector<cricket::DataCodec>::const_iterator iter;
  for (iter = codecs.begin(); iter != codecs.end(); ++iter) {
    if (!iter->Matches(kGoogleDataCodecId, kGoogleDataCodecName)) {
      return &(*iter);
    }
  }
  return NULL;
}

const DataCodec* FindKnownCodec(const std::vector<DataCodec>& codecs) {
  std::vector<cricket::DataCodec>::const_iterator iter;
  for (iter = codecs.begin(); iter != codecs.end(); ++iter) {
    if (iter->Matches(kGoogleDataCodecId, kGoogleDataCodecName)) {
      return &(*iter);
    }
  }
  return NULL;
}

bool DataMediaChannel::SetRecvCodecs(const std::vector<DataCodec>& codecs) {
  const DataCodec* unknown_codec = FindUnknownCodec(codecs);
  if (unknown_codec) {
    LOG(LS_WARNING) << "Failed to SetRecvCodecs because of unknown codec: "
                    << unknown_codec->ToString();
    return false;
  }

  recv_codecs_ = codecs;
  return true;
}

bool DataMediaChannel::SetSendCodecs(const std::vector<DataCodec>& codecs) {
  const DataCodec* known_codec = FindKnownCodec(codecs);
  if (!known_codec) {
    LOG(LS_WARNING) <<
        "Failed to SetSendCodecs because there is no known codec.";
    return false;
  }

  send_codecs_ = codecs;
  return true;
}

bool DataMediaChannel::AddSendStream(const StreamParams& stream) {
  if (!stream.has_ssrcs()) {
    return false;
  }

  StreamParams found_stream;
  if (GetStreamBySsrc(send_streams_, stream.first_ssrc(), &found_stream)) {
    LOG(LS_WARNING) << "Not adding data send stream '" << stream.name
                    << "' with ssrc=" << stream.first_ssrc()
                    << " because stream already exists.";
    return false;
  }

  send_streams_.push_back(stream);
  // TODO: This should be per-stream, not per-ssrc.
  // And we should probably allow more than one per stream.
  rtp_clock_by_send_ssrc_[stream.first_ssrc()] = new RtpClock(
      kDataCodecClockrate,
      talk_base::CreateRandomNonZeroId(), talk_base::CreateRandomNonZeroId());

  LOG(LS_INFO) << "Added data send stream '" << stream.name
               << "' with ssrc=" << stream.first_ssrc();
  return true;
}

bool DataMediaChannel::RemoveSendStream(uint32 ssrc) {
  StreamParams found_stream;
  if (GetStreamBySsrc(send_streams_, ssrc, &found_stream)) {
    return false;
  }

  RemoveStreamBySsrc(&recv_streams_, ssrc);
  delete rtp_clock_by_send_ssrc_[ssrc];
  rtp_clock_by_send_ssrc_.erase(ssrc);
  return true;
}

bool DataMediaChannel::AddRecvStream(const StreamParams& stream) {
  if (!stream.has_ssrcs()) {
    return false;
  }

  StreamParams found_stream;
  if (GetStreamBySsrc(recv_streams_, stream.first_ssrc(), &found_stream)) {
    LOG(LS_WARNING) << "Not adding data recv stream '" << stream.name
                    << "' with ssrc=" << stream.first_ssrc()
                    << " because stream already exists.";
    return false;
  }

  recv_streams_.push_back(stream);
  LOG(LS_INFO) << "Added data recv stream '" << stream.name
               << "' with ssrc=" << stream.first_ssrc();
  return true;
}

bool DataMediaChannel::RemoveRecvStream(uint32 ssrc) {
  RemoveStreamBySsrc(&recv_streams_, ssrc);
  return true;
}

void DataMediaChannel::OnPacketReceived(talk_base::Buffer* packet) {
  RtpHeader header;
  if (!GetRtpHeader(packet->data(), packet->length(), &header)) {
    // Don't want to log for every corrupt packet.
    // LOG(LS_WARNING) << "Could not read rtp header from packet of length "
    //                 << packet->length() << ".";
    return;
  }

  size_t header_length;
  if (!GetRtpHeaderLen(packet->data(), packet->length(), &header_length)) {
    // Don't want to log for every corrupt packet.
    // LOG(LS_WARNING) << "Could not read rtp header"
    //                 << length from packet of length "
    //                 << packet->length() << ".";
    return;
  }
  const char* data = packet->data() + header_length + sizeof(kReservedSpace);
  size_t data_len = packet->length() - header_length - sizeof(kReservedSpace);

  if (!receiving_) {
    LOG(LS_WARNING) << "Not receiving packet "
                    << header.ssrc << ":" << header.seq_num
                    << " before SetReceive(true) called.";
    return;
  }

  DataCodec codec;
  if (!FindCodecById(recv_codecs_, header.payload_type, &codec)) {
    LOG(LS_WARNING) << "Not receiving packet "
                    << header.ssrc << ":" << header.seq_num
                    << " (" << data_len << ")"
                    << " because unknown payload id: " << header.payload_type;
    return;
  }

  StreamParams found_stream;
  if (!GetStreamBySsrc(recv_streams_, header.ssrc, &found_stream)) {
    LOG(LS_WARNING) << "Received packet for unknown ssrc: " << header.ssrc;
    return;
  }

  // Uncomment this for easy debugging.
  // LOG(LS_INFO) << "Received packet from " << found_stream.nick << ":"
  //              << ", ssrc=" << header.ssrc
  //              << ", seqnum=" << header.seq_num
  //              << ", timestamp=" << header.timestamp
  //              << ", len=" << data_len;

  ReceiveDataParams params;
  params.ssrc = header.ssrc;
  params.seq_num = header.seq_num;
  params.timestamp = header.timestamp;
  SignalDataReceived(params, data, data_len);
}

bool DataMediaChannel::SetSendBandwidth(bool autobw, int bps) {
  if (autobw || bps <= 0) {
    bps = kDataMaxBandwidth;
  }
  send_limiter_.reset(new talk_base::RateLimiter(bps / 8, 1.0));
  LOG(LS_INFO) << "DataMediaChannel::SetSendBandwidth to " << bps << "bps.";
  return true;
}

bool DataMediaChannel::SendData(
    const SendDataParams& params, const std::string& data) {
  if (!sending_) {
    LOG(LS_WARNING) << "Not sending packet with ssrc=" << params.ssrc
                    << " len=" << data.length() << " before SetSend(true).";
    return false;
  }

  StreamParams found_stream;
  if (!GetStreamBySsrc(send_streams_, params.ssrc, &found_stream)) {
    LOG(LS_WARNING) << "Not sending data because ssrc is unknown: "
                    << params.ssrc;
    return false;
  }

  DataCodec found_codec;
  if (!FindCodecByName(send_codecs_, kGoogleDataCodecName, &found_codec)) {
    LOG(LS_WARNING) << "Not sending data because codec is unknown: "
                    << kGoogleDataCodecName;
    return false;
  }

  size_t packet_len = (kMinRtpPacketLen + sizeof(kReservedSpace)
                       + data.length() + kMaxSrtpHmacOverhead);
  if (packet_len > kDataMaxRtpPacketLen) {
    return false;
  }

  double now = timing_->TimerNow();

  if (!send_limiter_->CanUse(packet_len, now)) {
    // TODO: Should we log something?
    return false;
  }

  RtpHeader header;
  header.payload_type = found_codec.id;
  header.ssrc = params.ssrc;
  rtp_clock_by_send_ssrc_[header.ssrc]->Tick(
      now, &header.seq_num, &header.timestamp);

  talk_base::Buffer packet;
  packet.SetCapacity(packet_len);
  packet.SetLength(kMinRtpPacketLen);
  if (!SetRtpHeader(packet.data(), packet.length(), header)) {
    return false;
  }
  packet.AppendData(&kReservedSpace, sizeof(kReservedSpace));
  packet.AppendData(data.data(), data.length());

  // Uncomment this for easy debugging.
  // LOG(LS_INFO) << "Sent packet: "
  //              << " stream=" << found_stream.name
  //              << ", seqnum=" << header.seq_num
  //              << ", timestamp=" << header.timestamp
  //              << ", len=" << data_len;

  network_interface()->SendPacket(&packet);
  send_limiter_->Use(packet_len, now);
  return true;
}

}  // namespace cricket
