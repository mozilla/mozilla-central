/* libjingle
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

#include "talk/app/webrtc/jsepsessiondescription.h"

#include "talk/app/webrtc/webrtcsdp.h"
#include "talk/base/stringencode.h"
#include "talk/session/phone/mediasession.h"

using talk_base::scoped_ptr;
using cricket::SessionDescription;

namespace webrtc {

SessionDescriptionInterface* CreateSessionDescription(const std::string& sdp) {
  JsepSessionDescription* jsep_desc = new JsepSessionDescription();
  if (!jsep_desc->Initialize(sdp)) {
    delete jsep_desc;
    return NULL;
  }
  return jsep_desc;
}

JsepSessionDescription::JsepSessionDescription() {
}

JsepSessionDescription::JsepSessionDescription(
    cricket::SessionDescription* description) {
  SetDescription(description);
}

JsepSessionDescription::~JsepSessionDescription() {}

void JsepSessionDescription::SetDescription(
    cricket::SessionDescription* description) {
  description_.reset(description);
  candidate_collection_.resize(number_of_mediasections());
}

bool JsepSessionDescription::Initialize(const std::string& sdp) {
  return SdpDeserialize(sdp, this);
}

bool JsepSessionDescription::AddCandidate(
    const IceCandidateInterface* candidate) {
  if (!candidate)
    return false;
  size_t mediasection_index;
  if (!talk_base::FromString<size_t>(candidate->label(), &mediasection_index))
    return false;
  if (mediasection_index >= number_of_mediasections())
    return false;
  if (candidate_collection_[mediasection_index].HasCandidate(candidate)) {
    return true;  // Silently ignore this candidate if we already have it.
  }
  candidate_collection_[mediasection_index].add(
       new JsepIceCandidate(candidate->label(), candidate->candidate()));
  return true;
}

size_t JsepSessionDescription::number_of_mediasections() const {
  if (!description_.get())
    return 0;
  return description_->contents().size();
}

const IceCandidateColletion* JsepSessionDescription::candidates(
    size_t mediasection_index) const {
  return &candidate_collection_[mediasection_index];
}

bool JsepSessionDescription::ToString(std::string* out) const {
  if (!description_.get() || !out)
    return false;
  *out = SdpSerialize(*this);
  return !out->empty();
}

}  // namespace webrtc

