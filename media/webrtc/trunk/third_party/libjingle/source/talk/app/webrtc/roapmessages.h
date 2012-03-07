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

// This file contain classes for parsing and serializing ROAP messages.
// The ROAP messages are defined in
// http://tools.ietf.org/html/draft-jennings-rtcweb-signaling-01.

#ifndef TALK_APP_WEBRTC_ROAPMESSAGES_H_
#define TALK_APP_WEBRTC_ROAPMESSAGES_H_

#include <string>
#include <vector>

#include "talk/app/webrtc/roaperrorcodes.h"
#include "talk/base/basictypes.h"
#include "talk/base/json.h"
#include "talk/base/scoped_ptr.h"
#include "talk/p2p/base/candidate.h"
#include "talk/p2p/base/sessiondescription.h"

namespace webrtc {

class RoapMessageBase {
 public:
  enum RoapMessageType {
    kOffer = 0,
    kAnswer = 1,
    kOk = 2,
    kShutdown = 3,
    kError = 4,
    kInvalid = 5,
  };
  RoapMessageBase();
  RoapMessageBase(RoapMessageType type,
                  const std::string& offer_session_id,
                  const std::string& answer_session_id,
                  const std::string& session_token,
                  const std::string& response_token,
                  uint32 seq);

  bool Parse(const std::string& message);
  std::string Serialize();

  RoapMessageType type() const { return type_; }
  const std::string& offer_session_id() const { return offer_session_id_; }
  const std::string& answer_session_id() const { return answer_session_id_; }
  const std::string& session_token() const { return session_token_; }
  const std::string& response_token() const { return response_token_; }
  uint32 seq() const { return seq_; }

 protected:
  virtual void SerializeElement(Json::Value* message);
  Json::Value jmessage_;  // Contains the parsed json message.

 private:
  RoapMessageType type_;
  std::string offer_session_id_;
  std::string answer_session_id_;
  std::string session_token_;
  std::string response_token_;
  uint32 seq_;
};

class RoapAnswer : public RoapMessageBase {
 public:
  explicit RoapAnswer(const RoapMessageBase& base);
  // Note that the SessionDescription desc is used as a weak reference.
  // The user of this class must ensure that desc outlives an instance of this
  // object.
  RoapAnswer(const std::string& offer_session_id,
             const std::string& answer_session_id,
             const std::string& session_token,
             const std::string& response_token,
             uint32 seq,
             const cricket::SessionDescription* desc,
             const std::vector<cricket::Candidate>& candidates);
  bool Parse();

  // Get remote SessionDescription if the session description has been parsed
  // and the ownership is transferred to the caller.
  // NULL otherwise.
  cricket::SessionDescription* ReleaseSessionDescription() {
    return parsed_desc_.release();
  }
  const std::vector<cricket::Candidate>& candidates() const {
    return candidates_;
  }
  bool more_coming() const { return more_coming_ ; }

 protected:
  virtual void SerializeElement(Json::Value* message);

 private:
  bool more_coming_;
  // Session description parsed in an offer.
  talk_base::scoped_ptr<cricket::SessionDescription> parsed_desc_;
  // Weak ref to a session description provided in the constructor.
  const cricket::SessionDescription* desc_;
  std::vector<cricket::Candidate> candidates_;
};

class RoapOffer : public RoapMessageBase {
 public:
  explicit RoapOffer(const RoapMessageBase& base);
  // Note that the SessionDescription desc is used as a weak reference.
  // The user of this class must ensure that desc outlives an instance of this
  // object.
  RoapOffer(const std::string& offer_session_id,
            const std::string& answer_session_id,
            const std::string& session_token,
            uint32 seq,
            uint32 tie_breaker,
            const cricket::SessionDescription* desc,
            const std::vector<cricket::Candidate>& candidates);
  bool Parse();

  uint32 tie_breaker() const { return tie_breaker_; }
  // Get remote SessionDescription if the session description has been parsed
  // and the ownership is transferred to the caller.
  // NULL otherwise.
  cricket::SessionDescription* ReleaseSessionDescription() {
    return parsed_desc_.release();
  }
  const std::vector<cricket::Candidate>&  candidates() { return candidates_; }

 protected:
  virtual void SerializeElement(Json::Value* message);

 private:
  uint32 tie_breaker_;
  // Session description parsed in an offer.
  talk_base::scoped_ptr<cricket::SessionDescription> parsed_desc_;
  // Weak reference to a session description provided in the constructor.
  const cricket::SessionDescription* desc_;
  std::vector<cricket::Candidate> candidates_;
};

class RoapError : public RoapMessageBase {
 public:
  explicit RoapError(const RoapMessageBase& base);
  RoapError(const std::string& offer_session_id,
            const std::string& answer_session_id,
            const std::string& session_token,
            const std::string& response_token,
            uint32 seq,
            RoapErrorCode error);
  bool Parse();
  RoapErrorCode error() const { return error_; }

 protected:
  virtual void SerializeElement(Json::Value* message);

 private:
  RoapErrorCode error_;
};

class RoapOk : public RoapMessageBase {
 public:
  explicit RoapOk(const RoapMessageBase& base);
  RoapOk(const std::string& offer_session_id,
         const std::string& answer_session_id,
         const std::string& session_token,
         const std::string& response_token,
         uint32 seq);
};

class RoapShutdown : public RoapMessageBase {
 public:
  explicit RoapShutdown(const RoapMessageBase& base);
  RoapShutdown(const std::string& offer_session_id,
               const std::string& answer_session_id,
               const std::string& session_token,
               uint32 seq);
};

}  // namespace webrtc

#endif  // TALK_APP_WEBRTC_ROAPMESSAGES_H_
