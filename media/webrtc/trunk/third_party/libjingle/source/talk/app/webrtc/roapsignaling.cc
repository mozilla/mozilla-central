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

#include "talk/app/webrtc/roapsignaling.h"

#include <utility>

#include "talk/app/webrtc/jsepsessiondescription.h"
#include "talk/app/webrtc/mediastreamsignaling.h"
#include "talk/app/webrtc/streamcollectionimpl.h"
#include "talk/base/helpers.h"
#include "talk/base/logging.h"
#include "talk/base/messagequeue.h"
#include "talk/session/phone/channelmanager.h"

using talk_base::scoped_refptr;

namespace webrtc {

enum {
  MSG_SEND_QUEUED_OFFER = 1,
  MSG_GENERATE_ANSWER = 2,
};

RoapSignaling::RoapSignaling(
    MediaStreamSignaling* mediastream_signaling,
    JsepInterface* provider)
    : stream_signaling_(mediastream_signaling),
      provider_(provider),
      state_(kNew),
      received_pre_offer_(false),
      local_streams_(StreamCollection::Create()) {
}

RoapSignaling::~RoapSignaling() {}

void RoapSignaling::OnIceComplete() {
  if (!VERIFY(state_ == kInitializing))
    return;
  // If we have a queued remote offer we need to handle this first.
  if (received_pre_offer_) {
    received_pre_offer_ = false;
    SendAnswer();
  } else if (!queued_local_streams_.empty()) {
    // Else CreateOffer have been called.
    SendOffer(provider_->local_description());
  } else {
    ChangeState(kIdle);
  }
}

void RoapSignaling::OnIceCandidate(
    const IceCandidateInterface* /*candidate*/) {
  // Ignore all candidates. We only care about when all
  // candidates have been collected.
}

void RoapSignaling::ChangeState(State new_state) {
  state_ = new_state;
  SignalStateChange(state_);
}

void RoapSignaling::ProcessSignalingMessage(
    const std::string& message,
    StreamCollectionInterface* local_streams) {
  RoapSession::ParseResult result = roap_session_.Parse(message);

  // Signal an error message and return if a message is received after shutdown
  // or it is not an ok message that is received during shutdown.
  // No other messages from the remote peer can be processed in these states.
  if (state_ == kShutdownComplete ||
      (state_ == kShutingDown && result != RoapSession::kOk)) {
    SignalNewPeerConnectionMessage(roap_session_.CreateErrorMessage(kNoMatch));
    return;
  }

  switch (result) {
    case RoapSession::kOffer: {
      if (state_ == kWaitingForAnswer) {
        // Message received out of order or Glare occurred and the decision was
        // to use the incoming offer.
        LOG(LS_INFO) << "Received offer while waiting for answer.";
      }

      // Provide the remote session description and the remote candidates from
      // the parsed ROAP message to the |provider_|.
      if (!ProcessRemoteDescription(roap_session_.RemoteDescription(),
                                    JsepInterface::kOffer)) {
        break;
      }

      InitializeSendingAnswer(local_streams);
      break;
    }
    case RoapSession::kAnswerMoreComing: {
      // We ignore this message for now and wait for the complete result.
      LOG(LS_INFO) << "Received answer more coming.";
      break;
    }
    case RoapSession::kAnswer: {
      if (state_ != kWaitingForAnswer) {
        LOG(LS_WARNING) << "Received an unexpected answer.";
        return;
      }

      // Pop the first item of queued StreamCollections containing local
      // MediaStreams that just have been negotiated.
      scoped_refptr<StreamCollectionInterface> streams(
          queued_local_streams_.front());
      queued_local_streams_.pop_front();

      // If this is an answer to an initial offer SetLocalDescription have
      // already been called.
      if (local_desc_.get()) {
        // Hand the ownership of the local session description to |provider_|.
        provider_->SetLocalDescription(JsepInterface::kOffer,
                                       local_desc_.release());
      }

      // Provide the remote session description and the remote candidates from
      // the parsed ROAP message to the |provider_|.
      if (!ProcessRemoteDescription(roap_session_.RemoteDescription(),
                                    JsepInterface::kAnswer)) {
        break;
      }


      // Let the remote peer know we have received the answer.
      SignalNewPeerConnectionMessage(roap_session_.CreateOk());
      // Check if we have more offers waiting in the queue.
      if (!queued_local_streams_.empty()) {
        // Send the next offer.
        InitializeSendingOffer();
      } else {
        ChangeState(kIdle);
      }
      break;
    }
    case RoapSession::kOk: {
      if (state_ == kWaitingForOK) {
        ChangeState(kIdle);
        // Check if we have an updated offer waiting in the queue.
        if (!queued_local_streams_.empty())
          InitializeSendingOffer();
      } else if (state_ == kShutingDown) {
        ChangeState(kShutdownComplete);
      }
      break;
    }
    case RoapSession::kParseConflict: {
      SignalNewPeerConnectionMessage(roap_session_.CreateErrorMessage(
          kConflict));
      break;
    }
    case RoapSession::kParseDoubleConflict: {
      SignalNewPeerConnectionMessage(roap_session_.CreateErrorMessage(
          kDoubleConflict));

      // Recreate the offer with new sequence values etc.
      InitializeSendingOffer();
      break;
    }
    case RoapSession::kError: {
      if (roap_session_.RemoteError() != kConflict &&
          roap_session_.RemoteError() != kDoubleConflict) {
        SignalErrorMessageReceived(roap_session_.RemoteError());
        // An error have occurred that we can't do anything about.
        // Reset the state and wait for user action.
        queued_local_streams_.clear();
        ChangeState(kIdle);
      }
      break;
    }
    case RoapSession::kShutDown: {
      DoShutDown();
      ChangeState(kShutdownComplete);
      SignalNewPeerConnectionMessage(roap_session_.CreateOk());
      break;
    }
    case RoapSession::kInvalidMessage: {
      SignalNewPeerConnectionMessage(roap_session_.CreateErrorMessage(
          kNoMatch));
      return;
    }
  }
}

void RoapSignaling::CreateOffer(StreamCollectionInterface* local_streams) {
  if (!VERIFY(state_ != kShutingDown && state_ != kShutdownComplete)) {
    return;
  }

  queued_local_streams_.push_back(local_streams);
  if (state_ == kNew || state_ == kIdle) {
    InitializeSendingOffer();
  }
  return;
}

void RoapSignaling::SendShutDown() {
  DoShutDown();
  SignalNewPeerConnectionMessage(roap_session_.CreateShutDown());
}

void RoapSignaling::InitializeSendingOffer() {
  ASSERT(!queued_local_streams_.empty());

  scoped_refptr<StreamCollectionInterface> local_streams(
      queued_local_streams_.front());

  stream_signaling_->SetLocalStreams(local_streams);
  local_desc_.reset(provider_->CreateOffer(MediaHints()));

  // If we are still in state kNew, we need to start the ice negotiation and
  // wait until we have our local candidates before we can send the offer.
  // The offer is sent in OnIceComplete.
  if (state_ == kNew) {
    ChangeState(kInitializing);
    provider_->SetLocalDescription(JsepInterface::kOffer,
                                   local_desc_.release());
    // Start Ice and set the local session description for the first time.
    provider_->StartIce(JsepInterface::kUseAll);
    return;
  }
  SendOffer(local_desc_.get());
}

void RoapSignaling::SendOffer(const SessionDescriptionInterface* local_desc) {
  ChangeState(kWaitingForAnswer);
  std::string sdp;
  local_desc->ToString(&sdp);
  SignalNewPeerConnectionMessage(roap_session_.CreateOffer(sdp));
}

void RoapSignaling::InitializeSendingAnswer(
    StreamCollectionInterface* local_streams) {
  if (state_ == kInitializing) {
    LOG(LS_WARNING) << "Unexpected offer received";
    SignalNewPeerConnectionMessage(roap_session_.CreateErrorMessage(kRefused));
    return;
  }

  // If we are still in state kNew, we need to start the ice negotiation and
  // wait until we have our local candidates before we can send the answer.
  // We need to change the state here since
  // |provider_->SetLocalDescription| Sends tasks to other threads and we
  // therefore run the risk of receiving tasks from other threads while doing so.
  bool start_ice = false;
  if (state_ == kNew) {
    start_ice = true;
    ChangeState(kInitializing);
  }
  // Clean up all queued collections of local streams.
  queued_local_streams_.clear();

  stream_signaling_->SetLocalStreams(local_streams);
  // Create an local session description based on |local_streams|.
  SessionDescriptionInterface* local_desc(provider_->CreateAnswer(
      MediaHints(), provider_->remote_description()));
  if (!local_desc || !provider_->SetLocalDescription(JsepInterface::kAnswer,
                                                     local_desc)) {
    LOG(LS_WARNING) << "Answer to Roap offer failed";
    SignalNewPeerConnectionMessage(roap_session_.CreateErrorMessage(kRefused));
    return;
  }

  if (start_ice) {
    if (!provider_->StartIce(JsepInterface::kUseAll)) {
      SignalNewPeerConnectionMessage(
          roap_session_.CreateErrorMessage(kRefused));
      return;
    }
    received_pre_offer_ = true;
    // The answer is sent in OnIceComplete.
    return;
  }
  SendAnswer();
}

void RoapSignaling::SendAnswer() {
  std::string sdp;
  provider_->local_description()->ToString(&sdp);
  received_pre_offer_ = false;
  ChangeState(kWaitingForOK);
  SignalNewPeerConnectionMessage(roap_session_.CreateAnswer(sdp));
}

void RoapSignaling::DoShutDown() {
  ChangeState(kShutingDown);
  queued_local_streams_.clear();

  stream_signaling_->SetLocalStreams(NULL);
  // Create new empty session descriptions without StreamParams.
  // By applying these descriptions we don't send or receive any streams.
  SessionDescriptionInterface* local_desc =
      provider_->CreateOffer(MediaHints());
  SessionDescriptionInterface* remote_desc =
      provider_->CreateAnswer(MediaHints(), local_desc);

  provider_->SetRemoteDescription(JsepInterface::kOffer, remote_desc);
  provider_->SetLocalDescription(JsepInterface::kAnswer, local_desc);
}

bool RoapSignaling::ProcessRemoteDescription(const std::string& sdp,
                                             JsepInterface::Action action) {
  // Provide the remote session description and the remote candidates from
  // the parsed ROAP message to the |provider_|.
  SessionDescriptionInterface* desc = CreateSessionDescription(sdp);
  bool ret = provider_->SetRemoteDescription(action, desc);
  if (!ret)
    SignalNewPeerConnectionMessage(roap_session_.CreateErrorMessage(kRefused));
  return ret;
}

}  // namespace webrtc
