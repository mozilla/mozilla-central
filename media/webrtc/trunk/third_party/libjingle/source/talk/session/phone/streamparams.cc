/*
 * libjingle
 * Copyright 2011, Google Inc.
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

#include "talk/session/phone/streamparams.h"

#include <sstream>

namespace cricket {

const char kFecSsrcGroupSemantics[] = "FEC";
const char kFidSsrcGroupSemantics[] = "FID";
const char kSimSsrcGroupSemantics[] = "SIM";

static std::string SsrcsToString(const std::vector<uint32>& ssrcs) {
  std::ostringstream ost;
  ost << "ssrcs:[";
  for (std::vector<uint32>::const_iterator it = ssrcs.begin();
       it != ssrcs.end(); ++it) {
    if (it != ssrcs.begin()) {
      ost << ",";
    }
    ost << *it;
  }
  ost << "]";
  return ost.str();
}

bool SsrcGroup::has_semantics(const std::string& semantics_in) const {
  return (semantics == semantics_in && ssrcs.size() > 0);
}

std::string SsrcGroup::ToString() const {
  std::ostringstream ost;
  ost << "{";
  ost << "semantics:" << semantics << ";";
  ost << SsrcsToString(ssrcs);
  ost << "}";
  return ost.str();
}

std::string StreamParams::ToString() const {
  std::ostringstream ost;
  ost << "{";
  if (!nick.empty()) {
    ost << "nick:" << nick << ";";
  }
  if (!name.empty()) {
    ost << "name:" << name << ";";
  }
  ost << SsrcsToString(ssrcs) << ";";
  ost << "ssrc_groups:";
  for (std::vector<SsrcGroup>::const_iterator it = ssrc_groups.begin();
       it != ssrc_groups.end(); ++it) {
    if (it != ssrc_groups.begin()) {
      ost << ",";
    }
    ost << it->ToString();
  }
  ost << ";";
  if (!type.empty()) {
    ost << "type:" << type << ";";
  }
  if (!display.empty()) {
    ost << "display:" << display << ";";
  }
  if (!cname.empty()) {
    ost << "cname:" << cname << ";";
  }
  if (!sync_label.empty()) {
    ost << "sync_label:" << sync_label;
  }
  ost << "}";
  return ost.str();
}

bool GetStreamBySsrc(const StreamParamsVec& streams, uint32 ssrc,
                     StreamParams* stream_out) {
  for (StreamParamsVec::const_iterator stream = streams.begin();
       stream != streams.end(); ++stream) {
    if (stream->has_ssrc(ssrc)) {
      if (stream_out != NULL)
        *stream_out = *stream;
      return true;
    }
  }
  return false;
}

bool GetStreamByNickAndName(const StreamParamsVec& streams,
                            const std::string& nick,
                            const std::string& name,
                            StreamParams* stream_out) {
  for (StreamParamsVec::const_iterator stream = streams.begin();
       stream != streams.end(); ++stream) {
    if (stream->nick == nick && stream->name == name) {
      if (stream_out != NULL)
        *stream_out = *stream;
      return true;
    }
  }
  return false;
}

bool RemoveStreamBySsrc(StreamParamsVec* streams, uint32 ssrc) {
  bool ret = false;
  for (StreamParamsVec::iterator stream = streams->begin();
       stream != streams->end(); ) {
    if (stream->has_ssrc(ssrc)) {
      stream = streams->erase(stream);
      ret = true;
    } else {
      ++stream;
    }
  }
  return ret;
}

bool RemoveStreamByNickAndName(StreamParamsVec* streams,
                               const std::string& nick,
                               const std::string& name) {
  bool ret = false;
  for (StreamParamsVec::iterator stream = streams->begin();
       stream != streams->end(); ) {
    if (stream->nick == nick && stream->name == name) {
      stream = streams->erase(stream);
      ret = true;
    } else {
      ++stream;
    }
  }
  return ret;
}

}  // namespace cricket
