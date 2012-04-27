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

#include "talk/app/webrtc/roapsession.h"

#include "talk/app/webrtc/roapmessages.h"
#include "talk/base/common.h"
#include "talk/base/helpers.h"
#include "talk/base/logging.h"

namespace webrtc {

static const uint32 kMaxTieBreaker = 0xFFFFFFFE;

static std::string CreateLocalId(const std::string& remote_id) {
  std::string local_id;
  do {
    talk_base::CreateRandomString(32, &local_id);
    ASSERT(!local_id.empty());
  } while (local_id == remote_id);
  return local_id;
}

RoapSession::RoapSession()
  : seq_(0),
    waiting_for_answer_(false),
    received_seq_(0) {
}

std::string RoapSession::CreateOffer(const std::string& desc) {
  if (local_id_.empty()) {
    local_id_ = CreateLocalId(remote_id_);
  }

  do {
    local_tie_breaker_ = talk_base::CreateRandomNonZeroId();
  } while (local_tie_breaker_ > kMaxTieBreaker);

  RoapOffer offer(local_id_, remote_id_, session_token_, ++seq_,
                  local_tie_breaker_, desc);
  waiting_for_answer_ = true;
  return offer.Serialize();
}

std::string RoapSession::CreateAnswer(const std::string& desc) {
  ASSERT(!remote_id_.empty());
  if (local_id_.empty()) {
    local_id_ = CreateLocalId(remote_id_);
  }

  RoapAnswer answer(remote_id_, local_id_, session_token_, response_token_,
                    seq_, desc);
  response_token_.clear();
  return answer.Serialize();
}

std::string RoapSession::CreateOk() {
  ASSERT(!remote_id_.empty());

  if (local_id_.empty()) {
    local_id_ = CreateLocalId(remote_id_);
  }
  RoapOk ok(remote_id_, local_id_, session_token_, response_token_, seq_);
  response_token_.clear();
  return ok.Serialize();
}

std::string RoapSession::CreateShutDown() {
  if (local_id_.empty()) {
    local_id_ = CreateLocalId(remote_id_);
  }
  RoapShutdown shutdown(local_id_, remote_id_, session_token_, ++seq_);
  return shutdown.Serialize();
}

std::string RoapSession::CreateErrorMessage(RoapErrorCode error) {
  if (local_id_.empty()) {
    local_id_ = CreateLocalId(remote_id_);
  }

  RoapError message(received_offer_id_, local_id_, session_token_,
                    response_token_, received_seq_, error);
  response_token_.clear();
  return message.Serialize();
}

RoapSession::ParseResult RoapSession::Parse(
    const std::string& msg) {
  RoapMessageBase message;
  if (!message.Parse(msg)) {
    LOG(LS_ERROR) << "Parse failed. Invalid Roap message?";
    return kInvalidMessage;
  }

  received_offer_id_ = message.offer_session_id();
  received_answer_id_ = message.answer_session_id();
  received_seq_ = message.seq();
  session_token_ = message.session_token();
  response_token_ = message.response_token();
  ParseResult result = kInvalidMessage;

  switch (message.type()) {
    case RoapMessageBase::kOffer: {
      RoapOffer offer(message);
      if (!offer.Parse()) {
        LOG(LS_ERROR) << "Parse failed. Invalid Offer message?";
        return kInvalidMessage;
      }
      result = ValidateOffer(&offer);
      break;
    }
    case RoapMessageBase::kAnswer: {
      RoapAnswer answer(message);
      if (!answer.Parse()) {
        LOG(LS_ERROR) << "Parse failed. Invalid Answer message?";
        result = kInvalidMessage;
      } else {
        result = ValidateAnswer(&answer);
      }
      break;
    }
    case RoapMessageBase::kOk: {
      result =  ValidateOk(message);
      break;
    }
    case RoapMessageBase::kShutdown: {
      // Always accept shutdown messages.
      if (remote_id_.empty()) {
        remote_id_ = message.offer_session_id();
      }
      seq_ = message.seq();
      result = kShutDown;
      break;
    }
    case RoapMessageBase::kError: {
      RoapError error(message);
      if (!error.Parse()) {
        LOG(LS_ERROR) << "Parse failed. Invalid Error message?";
        result = kInvalidMessage;
      } else if (ValidateError(error) == kError) {
        result = kError;
      }  // else ignore this error message.
      break;
    }
    default: {
      ASSERT(!"Unknown message type.");
      LOG(LS_ERROR) << "Received unknown message.";
      result = kInvalidMessage;
      break;
    }
  }
  return result;
}

RoapSession::ParseResult RoapSession::ValidateOffer(
    RoapOffer* received_offer) {

  /* Check if the incoming OFFER has a answererSessionId, if not it is
     an initial offer.  If the outstanding OFFER also is an initial
     OFFER there is an Error. */
  if (received_offer->answer_session_id().empty() &&
      remote_id_.empty() && waiting_for_answer_) {
    return kInvalidMessage;
  }

  if (remote_id_.empty()) {
    remote_id_ = received_offer->offer_session_id();
  }

  // Check the message belong to this session.
  bool result =
      received_offer->offer_session_id() == remote_id_ &&
      received_offer->answer_session_id() == local_id_;

  if (!result) {
    return kInvalidMessage;
  }

  if (waiting_for_answer_) {
    if (received_offer->seq() < seq_) {
      return kInvalidMessage;  // Old seq.
    }
    if (received_offer->seq() == seq_) {
      // Glare.
      if (received_offer->tie_breaker() < local_tie_breaker_) {
        return kParseConflict;
      }
      if (received_offer->tie_breaker() == local_tie_breaker_) {
        waiting_for_answer_ = false;
        return kParseDoubleConflict;
      }
    }  // Else, the sequence number is larger than our sent offer. Accept it.
  } else if (received_offer->seq() <= seq_) {
    return kInvalidMessage;  // Old seq.
  }
  // seq ok or remote offer won the glare resolution.
  waiting_for_answer_ = false;
  seq_  = received_offer->seq();
  remote_desc_ = received_offer->SessionDescription();
  return kOffer;
}

RoapSession::ParseResult RoapSession::ValidateAnswer(
    RoapAnswer* received_answer) {
  if (remote_id_.empty()) {
    remote_id_ = received_answer->answer_session_id();
  }
  bool result =
      received_answer->offer_session_id() == local_id_ &&
      received_answer->seq() == seq_ &&
      received_answer->answer_session_id() == remote_id_;
  if (!result) {
    return kInvalidMessage;
  }

  remote_desc_ = received_answer->SessionDescription();
  if (received_answer->more_coming()) {
    return kAnswerMoreComing;
  }
  waiting_for_answer_ = false;
  return kAnswer;
}

RoapSession::ParseResult RoapSession::ValidateOk(
    const RoapMessageBase& message) {
  if (remote_id_.empty()) {
    remote_id_ = message.answer_session_id();
  }
  bool result =
      message.offer_session_id() == local_id_ &&
      message.seq() == seq_ &&
      message.answer_session_id() == remote_id_;
  if (!result) {
    return kInvalidMessage;
  }
  return kOk;
}

RoapSession::ParseResult RoapSession::ValidateError(
    const RoapError& message) {
  if (message.error() != kConflict) {
    waiting_for_answer_ = false;
  }
  remote_error_ = message.error();
  return kError;
}

RoapErrorCode RoapSession::RemoteError() {
  return remote_error_;
}

}  // namespace webrtc
