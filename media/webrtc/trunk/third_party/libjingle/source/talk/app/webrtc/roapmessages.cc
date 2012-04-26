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

#include "talk/app/webrtc/roapmessages.h"

#include "talk/app/webrtc/webrtcsdp.h"
#include "talk/base/common.h"
#include "talk/base/json.h"

namespace webrtc {

// ROAP message types. Must match the enum RoapMessageType.
static const char* kMessageTypes[] = {
  "OFFER",
  "ANSWER",
  "OK",
  "SHUTDOWN",
  "ERROR",
};

// ROAP error messages. Must match the enum RoapErrorCode.
static const char* kErrorMessages[] = {
  "NOMATCH",
  "TIMEOUT",
  "REFUSED",
  "CONFLICT",
  "DOUBLECONFLICT",
  "FAILED",
};

// ROAP json keys.
static const char kOffererSessionId[] = "offererSessionId";
static const char kAnswererSessionId[] = "answererSessionId";
static const char kSetSessionToken[] = "setSessionToken";
static const char kSetResponseToken[] = "setResponseToken";
static const char kResponseToken[] = "responseToken";
static const char kSessionToken[] = "sessionToken";
static const char kMessageType[] = "messageType";
static const char kSequenceNumber[] = "seq";
static const char kSessionDescription[] = "sdp";
static const char kErrorType[] = "errorType";
static const char kTieBreaker[] = "tieBreaker";
static const char kMoreComing[] = "moreComing";

RoapMessageBase::RoapMessageBase() : type_(kInvalid), seq_(0) {
}

RoapMessageBase::RoapMessageBase(RoapMessageType type,
                                 const std::string& offer_session_id,
                                 const std::string& answer_session_id,
                                 const std::string& session_token,
                                 const std::string& response_token,
                                 uint32 seq)
    : type_(type),
      offer_session_id_(offer_session_id),
      answer_session_id_(answer_session_id),
      session_token_(session_token),
      response_token_(response_token),
      seq_(seq) {
}

bool RoapMessageBase::Parse(const std::string& message) {
  Json::Reader reader;
  if (!reader.parse(message, jmessage_))
    return false;

  std::string message_type;
  GetStringFromJsonObject(jmessage_, kMessageType, &message_type);
  if (message_type.empty())
    return false;
  bool valid_message_type = false;
  for (int i = 0; i < kInvalid; i++) {
    if (message_type == kMessageTypes[i]) {
      type_ = static_cast<RoapMessageType>(i);
      valid_message_type = true;
      break;
    }
  }
  if (!valid_message_type)
    return false;

  if (!GetStringFromJsonObject(jmessage_, kOffererSessionId,
                               &offer_session_id_) ||
                               offer_session_id_.empty()) {
    // Parse offererSessionId. Allow error messages to not have an
    // offererSessionId.
    if (type_ != kError)
      return false;
  }

  // answererSessionId does not necessarily need to exist in MessageBase.
  GetStringFromJsonObject(jmessage_, kAnswererSessionId, &answer_session_id_);
  // setSessionToken and setResponseToken is not required.
  GetStringFromJsonObject(jmessage_, kSetSessionToken, &session_token_);
  GetStringFromJsonObject(jmessage_, kSetResponseToken, &response_token_);

  unsigned int temp_seq;
  if (!GetUIntFromJsonObject(jmessage_, kSequenceNumber, &temp_seq)) {
    return false;
  }
  if (temp_seq > 0xFFFFFFFF)
    return false;
  seq_ = static_cast<uint32>(temp_seq);

  return true;
}

std::string RoapMessageBase::Serialize() {
  Json::Value message;
  SerializeElement(&message);
  Json::StyledWriter writer;
  return writer.write(message);
}

void RoapMessageBase::SerializeElement(Json::Value* message) {
  ASSERT(message != NULL);
  (*message)[kMessageType] = kMessageTypes[type_];
  (*message)[kOffererSessionId] = offer_session_id_;
  if (!answer_session_id_.empty())
    (*message)[kAnswererSessionId] = answer_session_id_;
  if (!session_token_.empty())
    (*message)[kSessionToken] = session_token_;
  if (!response_token_.empty())
    (*message)[kResponseToken] = response_token_;
  (*message)[kSequenceNumber] = seq_;
}

RoapOffer::RoapOffer(const std::string& offer_session_id,
                     const std::string& answer_session_id,
                     const std::string& session_token,
                     uint32 seq,
                     uint32 tie_breaker,
                     const std::string& desc)
    : RoapMessageBase(kOffer, offer_session_id, answer_session_id,
                      session_token, "", seq),
      tie_breaker_(tie_breaker),
      desc_(desc) {
}

RoapOffer::RoapOffer(const RoapMessageBase& base)
    : RoapMessageBase(base) {}

bool RoapOffer::Parse() {
  if (!GetUIntFromJsonObject(jmessage_, kTieBreaker, &tie_breaker_)) {
    return false;
  }

  std::string sdp_message;
  if (!GetStringFromJsonObject(jmessage_, kSessionDescription, &sdp_message))
      return false;

  desc_ = sdp_message;
  return !desc_.empty();
}

void RoapOffer::SerializeElement(Json::Value* message) {
  ASSERT(message != NULL);
  RoapMessageBase::SerializeElement(message);
  (*message)[kTieBreaker] = tie_breaker_;
  (*message)[kSessionDescription] = desc_;
}

RoapAnswer::RoapAnswer(const std::string& offer_session_id,
                       const std::string& answer_session_id,
                       const std::string& session_token,
                       const std::string& response_token,
                       uint32 seq,
                       const std::string& desc)
    : RoapMessageBase(kAnswer, offer_session_id, answer_session_id,
                      session_token, response_token, seq),
      desc_(desc) {
}

RoapAnswer::RoapAnswer(const RoapMessageBase& base)
    : RoapMessageBase(base),
      more_coming_(false) {}

bool RoapAnswer::Parse() {
  std::string more;
  if (GetStringFromJsonObject(jmessage_, kMoreComing, &more) && more == "true")
    more_coming_ = true;

  std::string sdp_message;
  if (!GetStringFromJsonObject(jmessage_, kSessionDescription, &sdp_message))
      return false;

  desc_ = sdp_message;
  return !desc_.empty();
}

void RoapAnswer::SerializeElement(Json::Value* message) {
  ASSERT(message != NULL);
  RoapMessageBase::SerializeElement(message);

  (*message)[kSessionDescription] = desc_;
}

RoapError::RoapError(const RoapMessageBase& base)
    : RoapMessageBase(base), error_(kFailed) {
}

RoapError::RoapError(const std::string& offer_session_id,
                     const std::string& answer_session_id,
                     const std::string& session_token,
                     const std::string& response_token,
                     uint32 seq,
                     RoapErrorCode error)
    : RoapMessageBase(kError, offer_session_id, answer_session_id,
                      session_token, response_token, seq),
      error_(error) {
}

bool RoapError::Parse() {
  std::string error_string;
  GetStringFromJsonObject(jmessage_, kErrorType, &error_string);
  if (error_string.empty())
    return false;
  for (int i = 0; i < ARRAY_SIZE(kErrorMessages); i++) {
    if (error_string == kErrorMessages[i]) {
      error_ = static_cast<RoapErrorCode>(i);
      return true;
    }
  }
  return false;
}

void RoapError::SerializeElement(Json::Value* message) {
  ASSERT(message != NULL);
  ASSERT(error_< ARRAY_SIZE(kErrorMessages));
  RoapMessageBase::SerializeElement(message);

  (*message)[kErrorType] = kErrorMessages[error_];
}

RoapOk::RoapOk(const RoapMessageBase& base)
    : RoapMessageBase(base) {
}

RoapOk::RoapOk(const std::string& offer_session_id,
               const std::string& answer_session_id,
               const std::string& session_token,
               const std::string& response_token,
               uint32 seq)
    : RoapMessageBase(kOk, offer_session_id, answer_session_id, session_token,
                      response_token, seq) {
}

RoapShutdown::RoapShutdown(const RoapMessageBase& base)
    : RoapMessageBase(base) {
}

RoapShutdown::RoapShutdown(const std::string& offer_session_id,
                                 const std::string& answer_session_id,
                                 const std::string& session_token,
                                 uint32 seq)
    : RoapMessageBase(kShutdown, offer_session_id, answer_session_id,
                      session_token, "", seq) {
}

}  // namespace webrtc
