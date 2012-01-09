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

#include "talk/session/phone/ssrcmuxfilter.h"

#include <algorithm>

#include "talk/base/byteorder.h"
#include "talk/base/logging.h"
#include "talk/session/phone/rtputils.h"

namespace cricket {

static const uint32 kSsrc01 = 0x01;

SsrcMuxFilter::SsrcMuxFilter()
    : state_(ST_INIT),
      enabled_(false) {
}

SsrcMuxFilter::~SsrcMuxFilter() {
}

bool SsrcMuxFilter::SetOffer(bool offer_enable, ContentSource src) {
  bool ret = false;
  if (state_ == ST_INIT) {
    enabled_ = offer_enable;
    state_ = (src == CS_LOCAL) ? ST_SENTOFFER : ST_RECEIVEDOFFER;
    ret = true;
  } else {
    LOG(LS_ERROR) << "Invalid state for SSRC mux offer";
  }
  return ret;
}

bool SsrcMuxFilter::SetAnswer(bool answer_enable, ContentSource src) {
  bool ret = false;
  if ((state_ == ST_SENTOFFER && src == CS_REMOTE) ||
      (state_ == ST_RECEIVEDOFFER && src == CS_LOCAL)) {
    if (enabled_ && answer_enable) {
      state_ = ST_ACTIVE;
      ret = true;
    } else if (!answer_enable || !enabled_) {
      // If offer is not enabled, SSRC mux shouldn't be enabled.
      state_ = ST_INIT;
      ret = true;
    } else {
      LOG(LS_WARNING) << "Invalid parameters for SSRC mux answer";
    }
  } else {
    LOG(LS_ERROR) << "Invalid state for SSRC mux answer";
  }
  return ret;
}

bool SsrcMuxFilter::IsActive() const {
  return (state_ == ST_ACTIVE);
}

bool SsrcMuxFilter::DemuxPacket(const char* data, size_t len, bool rtcp) {
  uint32 ssrc = 0;
  if (!rtcp) {
    GetRtpSsrc(data, len, &ssrc);
  } else {
    int pl_type = 0;
    if (!GetRtcpType(data, len, &pl_type)) return false;
    if (pl_type == kRtcpTypeSR || pl_type == kRtcpTypeRR) {
      // Getting SSRC from the report packets.
      if (!GetRtcpSsrc(data, len, &ssrc)) return false;
      if (ssrc == kSsrc01) {
        // SSRC 1 has a special meaning and indicates generic feedback on
        // some systems and should never be dropped.  If it is forwarded
        // incorrectly it will be ignored by lower layers anyway.
        return true;
      }
    } else {
      // All other RTCP packets are handled by the all channels.
      // TODO: Add SSRC parsing to all RTCP messages.
      LOG(LS_INFO) << "Non RTCP report packet received for demux.";
      return true;
    }
  }
  return FindStream(ssrc);
}

bool SsrcMuxFilter::AddStream(uint32 ssrc) {
  if (FindStream(ssrc)) {
    LOG(LS_WARNING) << "SSRC is already added to filter";
    return false;
  }
  mux_ssrcs_.insert(ssrc);
  return true;
}

bool SsrcMuxFilter::RemoveStream(uint32 ssrc) {
  if (!FindStream(ssrc)) {
    LOG(LS_WARNING) << "SSRC is not added added to filter";
    return false;
  }
  bool ret = false;
  std::set<uint32>::iterator iter =
      std::find(mux_ssrcs_.begin(), mux_ssrcs_.end(), ssrc);
  if (iter != mux_ssrcs_.end()) {
    mux_ssrcs_.erase(iter);
    ret = true;
  }
  return ret;
}

bool SsrcMuxFilter::FindStream(uint32 ssrc) const {
  std::set<uint32>::const_iterator citer =
      std::find(mux_ssrcs_.begin(), mux_ssrcs_.end(), ssrc);
  return citer != mux_ssrcs_.end();
}

}  // namespace cricket
