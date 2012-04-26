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

// Implements the SessionDescriptionInterface.

#ifndef TALK_APP_WEBRTC_JSEPSESSIONDESCRIPTION_H_
#define TALK_APP_WEBRTC_JSEPSESSIONDESCRIPTION_H_

#include <string>
#include <vector>

#include "talk/app/webrtc/jsep.h"
#include "talk/app/webrtc/jsepicecandidate.h"
#include "talk/base/scoped_ptr.h"

namespace cricket {
class SessionDescription;
}

namespace webrtc {

class JsepSessionDescription : public SessionDescriptionInterface {
 public:
  JsepSessionDescription();
  // Takes ownership of |description|.
  explicit JsepSessionDescription(
      cricket::SessionDescription* description);
  ~JsepSessionDescription();

  // Takes ownership of |description|.
  void SetDescription(cricket::SessionDescription* description);
  bool Initialize(const std::string& sdp);

  virtual const cricket::SessionDescription* description() const {
    return description_.get();
  }
  virtual bool AddCandidate(const IceCandidateInterface* candidate);
  virtual size_t number_of_mediasections() const;
  virtual const IceCandidateColletion* candidates(
      size_t mediasection_index) const;
  virtual bool ToString(std::string* out) const;

 private:
  talk_base::scoped_ptr<cricket::SessionDescription> description_;
  std::vector<JsepCandidateColletion> candidate_collection_;

  DISALLOW_COPY_AND_ASSIGN(JsepSessionDescription);
};

}  // namespace webrtc

#endif  // TALK_APP_WEBRTC_JSEPSESSIONDESCRIPTION_H_
