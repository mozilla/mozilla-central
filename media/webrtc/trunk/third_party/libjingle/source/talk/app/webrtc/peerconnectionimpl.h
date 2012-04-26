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

#ifndef TALK_APP_WEBRTC_PEERCONNECTIONIMPL_H_
#define TALK_APP_WEBRTC_PEERCONNECTIONIMPL_H_

#include <map>
#include <string>

#include "talk/app/webrtc/mediastreamsignaling.h"
#include "talk/app/webrtc/peerconnection.h"
#include "talk/app/webrtc/peerconnectionfactoryimpl.h"
#include "talk/app/webrtc/roapsignaling.h"
#include "talk/app/webrtc/streamcollectionimpl.h"
#include "talk/app/webrtc/webrtcsession.h"
#include "talk/base/scoped_ptr.h"
#include "talk/p2p/client/httpportallocator.h"

namespace webrtc {
class MediaStreamHandlers;

// PeerConnectionImpl implements the PeerConnection interface.
// It uses RoapSignaling and WebRtcSession to implement
// the PeerConnection functionality.
class PeerConnection : public PeerConnectionInterface,
                       public RemoteMediaStreamObserver,
                       public talk_base::MessageHandler,
                       public sigslot::has_slots<> {
 public:
  explicit PeerConnection(PeerConnectionFactory* factory);

  bool Initialize(bool use_roap,
                  const std::string& configuration,
                  PeerConnectionObserver* observer);

  virtual ~PeerConnection();

  virtual void ProcessSignalingMessage(const std::string& msg);
  virtual bool Send(const std::string& msg) {
    // TODO: implement
    ASSERT(false);
    return false;
  }
  virtual talk_base::scoped_refptr<StreamCollectionInterface> local_streams();
  virtual talk_base::scoped_refptr<StreamCollectionInterface> remote_streams();
  virtual void AddStream(LocalMediaStreamInterface* stream);
  virtual void RemoveStream(LocalMediaStreamInterface* stream);
  virtual void CommitStreamChanges();
  virtual void Close();
  virtual ReadyState ready_state();
  virtual SdpState sdp_state();

  // Jsep functions.
  virtual SessionDescriptionInterface* CreateOffer(const MediaHints& hints);
  virtual SessionDescriptionInterface* CreateAnswer(
      const MediaHints& hints,
      const SessionDescriptionInterface* offer);

  virtual bool StartIce(IceOptions options);
  virtual bool SetLocalDescription(Action action,
                                   SessionDescriptionInterface* desc);
  virtual bool SetRemoteDescription(Action action,
                                    SessionDescriptionInterface* desc);
  virtual bool ProcessIceMessage(const IceCandidateInterface* ice_candidate);
  virtual const SessionDescriptionInterface* local_description() const;
  virtual const SessionDescriptionInterface* remote_description() const;

 private:
  // Implement talk_base::MessageHandler.
  void OnMessage(talk_base::Message* msg);

  // Signals from RoapSignaling.
  void OnNewPeerConnectionMessage(const std::string& message);
  void OnSignalingStateChange(RoapSignaling::State state);

  // Implements RemoteMediaStreamObserver.
  virtual void OnAddStream(MediaStreamInterface* stream);
  virtual void OnRemoveStream(MediaStreamInterface* stream);

  // Signals from WebRtcSession.
  void OnSessionStateChange(cricket::BaseSession* session,
                            cricket::BaseSession::State state);

  void ChangeReadyState(PeerConnectionInterface::ReadyState ready_state);
  void ChangeSdpState(PeerConnectionInterface::SdpState sdp_state);
  void Terminate_s();

  talk_base::Thread* signaling_thread() const {
    return factory_->signaling_thread();
  }

  // Storing the factory as a scoped reference pointer ensures that the memory
  // in the PeerConnectionFactoryImpl remains available as long as the
  // PeerConnection is running. It is passed to PeerConnection as a raw pointer.
  // However, since the reference counting is done in the
  // PeerConnectionFactoryInteface all instances created using the raw pointer
  // will refer to the same reference count.
  talk_base::scoped_refptr<PeerConnectionFactory> factory_;
  PeerConnectionObserver* observer_;
  ReadyState ready_state_;
  SdpState sdp_state_;
  talk_base::scoped_refptr<StreamCollection> local_media_streams_;

  talk_base::scoped_ptr<cricket::PortAllocator> port_allocator_;
  talk_base::scoped_ptr<WebRtcSession> session_;
  talk_base::scoped_ptr<RoapSignaling> roap_signaling_;
  talk_base::scoped_ptr<MediaStreamSignaling> mediastream_signaling_;
  talk_base::scoped_ptr<MediaStreamHandlers> stream_handler_;
};

}  // namespace webrtc

#endif  // TALK_APP_WEBRTC_PEERCONNECTIONIMPL_H_
