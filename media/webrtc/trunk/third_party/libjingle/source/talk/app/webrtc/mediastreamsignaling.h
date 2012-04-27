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

#ifndef TALK_APP_WEBRTC_MEDIASTREAMSIGNALING_H_
#define TALK_APP_WEBRTC_MEDIASTREAMSIGNALING_H_

#include <string>

#include "talk/app/webrtc/peerconnection.h"
#include "talk/app/webrtc/streamcollectionimpl.h"
#include "talk/base/scoped_ref_ptr.h"
#include "talk/session/phone/mediasession.h"

namespace talk_base {
class Thread;
}  // namespace talk_base

namespace webrtc {

// RemoteMediaStreamObserver is triggered when
// MediaStreamSignaling::UpdateRemoteStreams is called with a new
// SessionDescription with a new set of MediaStreams.
class RemoteMediaStreamObserver {
 public:
  // Triggered when the remote SessionDescription has a new stream.
  virtual void OnAddStream(MediaStreamInterface* stream) = 0;

  // Triggered when the remote SessionDescription removes a stream.
  virtual void OnRemoveStream(MediaStreamInterface* stream) = 0;
 protected:
  ~RemoteMediaStreamObserver() {}
};

// MediaStreamSignaling works as a glue between MediaStreams and a cricket
// classes for SessionDescriptions.
// It is responsible for creating remote MediaStreams given a remote
// SessionDescription and creating cricket::MediaSessionOptions given
// local MediaStreams.
//
// MediaStreamSignaling is Thread-compatible and all non-const methods are
// expected to be called on the signaling thread.
class MediaStreamSignaling {
 public:
  MediaStreamSignaling(talk_base::Thread* signaling_thread,
                       RemoteMediaStreamObserver* stream_observer);
  virtual ~MediaStreamSignaling();

  void SetLocalStreams(StreamCollectionInterface* local_streams);

  // Returns a MediaSessionOptions struct with options decided by |hints| and
  // the local MediaStreams set by SetLocalStreams.
  virtual cricket::MediaSessionOptions GetMediaSessionOptions(
      const MediaHints& hints) const;

  // Updates or creates remote MediaStream objects given a
  // remote SessionDescription.
  // If the remote SessionDescription contain new remote MediaStreams
  // RemoteMediaStreamObserver::OnAddStream is called.
  // If a remote MediaStream is missing from
  // the remote SessionDescription RemoteMediaStreamObserver::OnRemoveStream
  // is called.
  void UpdateRemoteStreams(const SessionDescriptionInterface* desc);

  // Returns all current remote MediaStreams.
  StreamCollectionInterface* remote_streams() const {
    return remote_streams_.get(); }

 private:
  // Create new MediaStreams and Tracks if they exist in |streams|
  // Both new and existing MediaStreams are added to |current_streams|.
  template <typename TrackInterface, typename TrackProxy>
  void UpdateRemoteStreamsList(
      const std::vector<cricket::StreamParams>& streams,
      StreamCollection* current_streams);

  talk_base::Thread* signaling_thread_;
  RemoteMediaStreamObserver* stream_observer_;
  talk_base::scoped_refptr<StreamCollectionInterface> local_streams_;
  talk_base::scoped_refptr<StreamCollectionInterface> remote_streams_;
};

}  // namespace webrtc

#endif  // TALK_APP_WEBRTC_MEDIASTREAMSIGNALING_H_
