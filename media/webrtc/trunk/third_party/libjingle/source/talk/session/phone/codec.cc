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

#include "talk/session/phone/codec.h"

#include <sstream>

#include "talk/base/stringutils.h"

namespace cricket {

static const int kMaxStaticPayloadId = 95;

bool Codec::Matches(int payload, const std::string& nm) const {
  return (payload <= kMaxStaticPayloadId) ?
      (id == payload) : (_stricmp(name.c_str(), nm.c_str()) == 0);
}

bool Codec::Matches(const Codec& codec) const {
  return Matches(codec.id, codec.name);
}

bool AudioCodec::Matches(int payload, const std::string& nm) const {
  // Match the codec id/name based on the typical static/dynamic name rules.
  // Matching is case-insensitive.
  return (payload <= kMaxStaticPayloadId) ?
      (id == payload) : (_stricmp(name.c_str(), nm.c_str()) == 0);
}

bool AudioCodec::Matches(const AudioCodec& codec) const {
  // If a nonzero clockrate is specified, it must match the actual clockrate.
  // If a nonzero bitrate is specified, it must match the actual bitrate,
  // unless the codec is VBR (0), where we just force the supplied value.
  // The number of channels must match exactly.
  // Preference is ignored.
  // TODO: Treat a zero clockrate as 8000Hz, the RTP default clockrate.
  return Matches(codec.id, codec.name) &&
      ((codec.clockrate == 0 /*&& clockrate == 8000*/) ||
          clockrate == codec.clockrate) &&
      (codec.bitrate == 0 || bitrate <= 0 || bitrate == codec.bitrate) &&
      (codec.channels == 0 || channels == codec.channels);
}

std::string AudioCodec::ToString() const {
  std::ostringstream os;
  os << "AudioCodec[" << id << ":" << name << ":" << clockrate << ":" << bitrate
     << ":" << channels << ":" << preference << "]";
  return os.str();
}

std::string VideoCodec::ToString() const {
  std::ostringstream os;
  os << "VideoCodec[" << id << ":" << name << ":" << width << ":" << height
     << ":" << framerate << ":" << preference << "]";
  return os.str();
}

std::string DataCodec::ToString() const {
  std::ostringstream os;
  os << "DataCodec[" << id << ":" << name << "]";
  return os.str();
}

}  // namespace cricket
