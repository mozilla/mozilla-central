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

#ifndef TALK_SESSION_PHONE_RTCPMUXFILTER_H_
#define TALK_SESSION_PHONE_RTCPMUXFILTER_H_

#include "talk/base/basictypes.h"
#include "talk/p2p/base/sessiondescription.h"

namespace cricket {

// RTCP Muxer, as defined in RFC 5761 (http://tools.ietf.org/html/rfc5761)
class RtcpMuxFilter {
 public:
  RtcpMuxFilter();

  // Whether the filter is active, i.e. has RTCP mux been properly negotiated.
  bool IsActive() const;

  // Specifies whether the offer indicates the use of RTCP mux.
  bool SetOffer(bool offer_enable, ContentSource src);

  // Specifies whether the answer indicates the use of RTCP mux.
  bool SetAnswer(bool answer_enable, ContentSource src);

  // Determines whether the specified packet is RTCP.
  bool DemuxRtcp(const char* data, int len);

 private:
  enum State { ST_INIT, ST_SENTOFFER, ST_RECEIVEDOFFER, ST_ACTIVE };
  State state_;
  bool offer_enable_;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_RTCPMUXFILTER_H_
