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

// This file contains a class used for creating and parsing ROAP messages
// as defined in http://tools.ietf.org/html/draft-jennings-rtcweb-signaling-01.
// The RoapSession is responsible for keeping track of ROAP specific
// attributes such as offerSessionId etc of a single session but not the logic
// for when to create a specific message.

#ifndef TALK_APP_WEBRTC_ROAPSESSION_H_
#define TALK_APP_WEBRTC_ROAPSESSION_H_

#include <string>
#include <vector>

#include "talk/app/webrtc/roaperrorcodes.h"
#include "talk/base/basictypes.h"
#include "talk/base/scoped_ptr.h"
#include "talk/p2p/base/candidate.h"
#include "talk/p2p/base/sessiondescription.h"

namespace webrtc {

using cricket::Candidate;
using cricket::SessionDescription;

class RoapAnswer;
class RoapError;
class RoapMessageBase;
class RoapOffer;

class RoapSession {
 public:
  // ParseResult is the result of parsing a message.
  // It can be either an identified message type or a detected error.
  enum ParseResult {
    kOffer,
    kAnswerMoreComing,  // More coming flag set. The SDP contains candidates.
    kAnswer,
    kOk,
    kShutDown,
    kError,
    // The messages below is errors that can occur during parsing.
    kConflict,  // Conflict detected during parsing of offer.
    kDoubleConflict,  // Double conflict detected during parsing of offer.
    kInvalidMessage  // The parsed message is invalid.
  };

  RoapSession();

  // Creates a ROAP offer message based on the provided session description and
  // candidates. This will update states in the ROAP sessions variables such as
  // sequence number and create a local session id.
  std::string CreateOffer(const SessionDescription* desc,
                          const std::vector<Candidate>& candidates);

  // Creates a ROAP answer message based on the provided session description and
  // candidates. An offer must have been parsed before this function can be
  // called.
  std::string CreateAnswer(const SessionDescription* desc,
                           const std::vector<Candidate>& candidates);
  std::string CreateOk();
  std::string CreateShutDown();
  std::string CreateErrorMessage(RoapErrorCode error);
  ParseResult Parse(const std::string& msg);
  RoapErrorCode RemoteError();
  // Get remote SessionDescription. The ownership is transferred to the caller.
  SessionDescription* ReleaseRemoteDescription();
  const std::vector<Candidate>& RemoteCandidates();

 private:
  ParseResult ValidateOffer(RoapOffer* received_offer);
  ParseResult ValidateAnswer(RoapAnswer* received_answer);
  ParseResult ValidateOk(const RoapMessageBase& message);
  ParseResult ValidateError(const RoapError& message);

  uint32 seq_;  // Sequence number of current message exchange.
  std::string local_id_;  // offererSessionId / answerSessionId of local peer.
  std::string remote_id_;  // offererSessionId / answerSessionId of remote peer.
  uint32 local_tie_breaker_;  // tieBreaker of last sent offer.
  bool waiting_for_answer_;

  std::string received_offer_id_;  // offererSessionId in last received message.
  std::string received_answer_id_;  // answerSessionId in last received message.
  uint32 received_seq_;  // Sequence number of last received message.
  std::string session_token_;
  std::string response_token_;

  talk_base::scoped_ptr<SessionDescription> remote_desc_;
  std::vector<Candidate> remote_candidates_;

  RoapErrorCode remote_error_;
};

}  // namespace webrtc

#endif  // TALK_APP_WEBRTC_ROAPSESSION_H_
