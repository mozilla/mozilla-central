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

// This file contains classes used for handling signaling between
// two PeerConnections.

#ifndef TALK_APP_WEBRTC_ROAPSIGNALING_H_
#define TALK_APP_WEBRTC_ROAPSIGNALING_H_

#include <string>

#include "talk/app/webrtc/jsep.h"
#include "talk/app/webrtc/roaperrorcodes.h"
#include "talk/app/webrtc/roapsession.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/scoped_ref_ptr.h"
#include "talk/base/sigslot.h"

namespace cricket {
class ChannelManager;
class Candidate;
typedef std::vector<Candidate> Candidates;
}

namespace talk_base {
class Thread;
}

namespace webrtc {
class MediaStreamSignaling;
class StreamCollection;
class StreamCollectionInterface;
class MediaStreamInterface;

// RoapSignaling is a class responsible for handling signaling
// between two PeerConnection objects.
//
// RoapSignaling is Thread-compatible and all non-const methods are
// expected to be called on the signaling thread.
//
// Note that before RoapSignaling can process an answer or create an
// offer OnIceComplete has to be called. The last request to create an offer
// or process an answer will be processed after OnIceComplete has been
// called.
//
// Call CreateOffer to negotiate new local streams to send.
// Call ProcessSignalingMessage when a new message has been received from the
// remote peer. This might result in one or more signals being triggered to
// indicate changes in the offer from the the remote peer or a detected error.
// RoapSignaling creates Offers and Answers asynchronous on the
// signaling thread.
//
// Example usage: Creating an offer with one audio track.
//
// class ProviderImpl : public JsepInterface {
//  ...
// };
//
// void OnSignalingMessage(const std::string& smessage) { ... }
//
// ProviderImpl impl;
// RoapSignaling pc(talk_base::Thread::Current(), &impl);
//
// // Connect the function OnSignalingMessage to the signal
// // SignalNewPeerConnectionMessage.
// pc.SignalNewPeerConnectionMessage.connect(&OnSignalingMessage);
//
// // Initialize RoapSignaling by providing the candidates for
// // this session.
// pc.OnCandidatesReady(candidates);
// // Create an offer with one stream with one audio track.
// AudioTrack audio;
// MediaStream local_stream1;
// local_stream1.AddTrack(&audio);
// StreamCollection local_streams;
// local_streams.AddStream(&local_stream1)
// pc.CreateOffer(&local_streams);
// // When the offer has been created, OnsignalingMessage is called
// // with the offer in a string. Provide this offer to the remote
// // PeerConnection. The remote PeerConnection will then respond with an answer
// // string. Provide this answer string to RoapSignaling.
// pc.ProcessSignalingMessage(remote_message, &local_streams);


class RoapSignaling : public IceCandidateObserver {
 public:
  enum State {
    // RoapSignaling is new. Ice has not started.
    kNew,
    // Ice has started. Awaiting the local candidates.
    kInitializing,
    // Ready to sent new offer or receive a new offer.
    kIdle,
    // An offer has been sent and expect an answer.
    kWaitingForAnswer,
    // An answer has been sent and expect an ok message.
    kWaitingForOK,
    // SendShutdown has been called. No more messages are processed.
    kShutingDown,
    // Shutdown message has been received or the remote peer has answered ok
    // to a sent shutdown message.
    kShutdownComplete,
  };

  // Constructs a RoapSignaling instance.
  // provider - Implementation of the JsepInterface interface.
  RoapSignaling(MediaStreamSignaling* mediastream_signaling_,
                JsepInterface* provider);
  virtual ~RoapSignaling();

  // Process a received offer/answer from the remote peer.
  // local_streams must be the collection of streams the peerconnection
  // currently would like to send.
  void ProcessSignalingMessage(const std::string& message,
                               StreamCollectionInterface* local_streams);

  // Creates an offer containing all tracks in local_streams.
  // When the offer is ready it is signaled by SignalNewPeerConnectionMessage.
  // When the remote peer is ready to receive media on a stream , the state of
  // the local streams will change to kLive.
  void CreateOffer(StreamCollectionInterface* local_streams);

  // Creates a ShutDown message to be sent to the remote peer.
  // When the message is ready it is signaled by SignalNewPeerConnectionMessage.
  // After calling this no more offers or answers to offers can be created.
  void SendShutDown();

  // Implements IceCandidateObserver interface.
  // OnIceComplete is called when all local candidates have been collected.
  // This tell RoapSignaling that it is ready to respond to offers
  // or create offer messages.
  virtual void OnIceComplete();

  // Implements IceCandidateObserver interface.
  // OnIceCandidate is called when a local candidate has been collected.
  virtual void OnIceCandidate(const IceCandidateInterface* candidate);

  // Returns the current state.
  State GetState() const { return state_; }

  // A new ROAP message is ready to be sent. The listener to this signal is
  // supposed to deliver this message to the remote peer.
  sigslot::signal1<const std::string&> SignalNewPeerConnectionMessage;

  // The signaling state has changed.
  sigslot::signal1<State> SignalStateChange;

  // Remote PeerConnection sent an error message.
  sigslot::signal1<RoapErrorCode> SignalErrorMessageReceived;

 private:
  typedef std::list<talk_base::scoped_refptr<StreamCollectionInterface> >
          StreamCollectionList;

  // Change the State and triggers the SignalStateChange signal.
  void ChangeState(State new_state);

  // This is called by CreateOffer. Creates an offer based on the first stream
  // collection in |queued_local_streams_|.
  void InitializeSendingOffer();
  // Serializes and sends |local_desc|
  void SendOffer(const SessionDescriptionInterface* local_desc);

  // This is called by ProcessSignalingMessage when a remote offer
  // has been received.
  void InitializeSendingAnswer(StreamCollectionInterface* local_streams);
  // Serializes and sends |local_desc_|.
  void SendAnswer();

  // Notifies the |provider_| about the shutdown.
  // This is either initiated by ProcessSignalingMessage when a remote shutdown
  // message has been received or by a call to SendShutDown.
  void DoShutDown();

  // Process session description from the remote peer.
  bool ProcessRemoteDescription(const std::string& sdp,
                                JsepInterface::Action action);

  // Updates the state of local streams based on the answer_desc and the streams
  // that have been negotiated in negotiated_streams.
  void UpdateSendingLocalStreams(
      const cricket::SessionDescription* answer_desc,
      StreamCollectionInterface* negotiated_streams);

  MediaStreamSignaling* stream_signaling_;
  JsepInterface* provider_;
  State state_;

  // Flag indicating RoapSignaling was called with an offer while
  // RoapSignaling is in kInitializing state.
  bool received_pre_offer_;

  // LocalStreams queued for later use if CreateOffer
  // is called while RoapSignaling is in kNew state or
  // CreateOffer is called while RoapSignaling is currently sending
  // an offer.
  StreamCollectionList queued_local_streams_;

  // The local session description of the local MediaStreams that is being
  // negotiated.
  talk_base::scoped_ptr<SessionDescriptionInterface> local_desc_;

  // Local MediaStreams being negotiated.
  talk_base::scoped_refptr<StreamCollection> local_streams_;

  // roap_session_ holds the ROAP-specific session state and is used for
  // creating a parsing ROAP messages.
  RoapSession roap_session_;

  DISALLOW_COPY_AND_ASSIGN(RoapSignaling);
};

}  // namespace webrtc

#endif  // TALK_APP_WEBRTC_ROAPSIGNALING_H_
