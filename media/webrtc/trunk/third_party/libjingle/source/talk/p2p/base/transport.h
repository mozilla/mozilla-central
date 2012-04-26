/*
 * libjingle
 * Copyright 2004--2005, Google Inc.
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

// A Transport manages a set of named channels of the same type.
//
// Subclasses choose the appropriate class to instantiate for each channel;
// however, this base class keeps track of the channels by name, watches their
// state changes (in order to update the manager's state), and forwards
// requests to begin connecting or to reset to each of the channels.
//
// On Threading:  Transport performs work on both the signaling and worker
// threads.  For subclasses, the rule is that all signaling related calls will
// be made on the signaling thread and all channel related calls (including
// signaling for a channel) will be made on the worker thread.  When
// information needs to be sent between the two threads, this class should do
// the work (e.g., OnRemoteCandidate).
//
// Note: Subclasses must call DestroyChannels() in their own constructors.
// It is not possible to do so here because the subclass constructor will
// already have run.

#ifndef TALK_P2P_BASE_TRANSPORT_H_
#define TALK_P2P_BASE_TRANSPORT_H_

#include <string>
#include <map>
#include <vector>
#include "talk/base/criticalsection.h"
#include "talk/base/messagequeue.h"
#include "talk/base/sigslot.h"
#include "talk/p2p/base/candidate.h"
#include "talk/p2p/base/constants.h"

namespace talk_base {
class Thread;
}

namespace buzz {
class QName;
class XmlElement;
}

namespace cricket {

struct ParseError;
struct WriteError;
class PortAllocator;
class SessionManager;
class Session;
class TransportChannel;
class TransportChannelImpl;

typedef std::vector<buzz::XmlElement*> XmlElements;
typedef std::vector<Candidate> Candidates;

// Used to parse and serialize (write) transport candidates.  For
// convenience of old code, Transports will implement TransportParser.
// Parse/Write seems better than Serialize/Deserialize or
// Create/Translate.
class TransportParser {
 public:
  virtual bool ParseCandidates(SignalingProtocol protocol,
                               const buzz::XmlElement* elem,
                               Candidates* candidates,
                               ParseError* error) = 0;
  virtual bool WriteCandidates(SignalingProtocol protocol,
                               const Candidates& candidates,
                               XmlElements* candidate_elems,
                               WriteError* error) = 0;

  // Helper function to parse an element describing an address.  This
  // retrieves the IP and port from the given element and verifies
  // that they look like plausible values.
  bool ParseAddress(const buzz::XmlElement* elem,
                    const buzz::QName& address_name,
                    const buzz::QName& port_name,
                    talk_base::SocketAddress* address,
                    ParseError* error);

  virtual ~TransportParser() {}
};

class Transport : public talk_base::MessageHandler,
                  public sigslot::has_slots<> {
 public:
  Transport(talk_base::Thread* signaling_thread,
            talk_base::Thread* worker_thread,
            const std::string& type,
            PortAllocator* allocator);
  virtual ~Transport();

  // Returns the signaling thread. The app talks to Transport on this thread.
  talk_base::Thread* signaling_thread() { return signaling_thread_; }
  // Returns the worker thread. The actual networking is done on this thread.
  talk_base::Thread* worker_thread() { return worker_thread_; }

  // Returns the type of this transport.
  const std::string& type() const { return type_; }

  // Returns the port allocator object for this transport.
  PortAllocator* port_allocator() { return allocator_; }

  // Returns the readable and states of this manager.  These bits are the ORs
  // of the corresponding bits on the managed channels.  Each time one of these
  // states changes, a signal is raised.
  bool readable() const { return readable_; }
  bool writable() const { return writable_; }
  sigslot::signal1<Transport*> SignalReadableState;
  sigslot::signal1<Transport*> SignalWritableState;

  // Returns whether the client has requested the channels to connect.
  bool connect_requested() const { return connect_requested_; }

  // Create, destroy, and lookup the channels of this type by their names.
  TransportChannelImpl* CreateChannel(const std::string& name,
                                      const std::string& content_type);
  // Note: GetChannel may lead to race conditions, since the mutex is not held
  // after the pointer is returned.
  TransportChannelImpl* GetChannel(const std::string& name);
  // Note: HasChannel does not lead to race conditions, unlike GetChannel.
  bool HasChannel(const std::string& name) {
    return (NULL != GetChannel(name));
  }
  bool HasChannels();
  void DestroyChannel(const std::string& name);

  // Tells all current and future channels to start connecting.  When the first
  // channel begins connecting, the following signal is raised.
  void ConnectChannels();
  sigslot::signal1<Transport*> SignalConnecting;

  // Resets all of the channels back to their initial state.  They are no
  // longer connecting.
  void ResetChannels();

  // Destroys every channel created so far.
  void DestroyAllChannels();

  // Before any stanza is sent, the manager will request signaling.  Once
  // signaling is available, the client should call OnSignalingReady.  Once
  // this occurs, the transport (or its channels) can send any waiting stanzas.
  // OnSignalingReady invokes OnTransportSignalingReady and then forwards this
  // signal to each channel.
  sigslot::signal1<Transport*> SignalRequestSignaling;
  void OnSignalingReady();

  // Handles sending of ready candidates and receiving of remote candidates.
  sigslot::signal2<Transport*,
                   const std::vector<Candidate>&> SignalCandidatesReady;

  sigslot::signal1<Transport*> SignalCandidatesAllocationDone;
  void OnRemoteCandidates(const std::vector<Candidate>& candidates);

  // If candidate is not acceptable, returns false and sets error.
  // Call this before calling OnRemoteCandidates.
  virtual bool VerifyCandidate(const Candidate& candidate,
                               ParseError* error);

  // Signals when the best connection for a channel changes.
  sigslot::signal3<Transport*, const std::string&,
                   const Candidate&> SignalRouteChange;

  // A transport message has generated an transport-specific error.  The
  // stanza that caused the error is available in session_msg.  If false is
  // returned, the error is considered unrecoverable, and the session is
  // terminated.
  // TODO: Make OnTransportError take an abstract data type
  // rather than an XmlElement.  It isn't needed yet, but it might be
  // later for Jingle compliance.
  virtual void OnTransportError(const buzz::XmlElement* error) {}
  sigslot::signal6<Transport*, const buzz::XmlElement*, const buzz::QName&,
                   const std::string&, const std::string&,
                   const buzz::XmlElement*>
      SignalTransportError;

  // (For testing purposes only.)  This indicates whether we will allow local
  // IPs (e.g. 127.*) to be used as addresses for P2P.
  bool allow_local_ips() const { return allow_local_ips_; }
  void set_allow_local_ips(bool value) { allow_local_ips_ = value; }

 protected:
  // These are called by Create/DestroyChannel above in order to create or
  // destroy the appropriate type of channel.
  virtual TransportChannelImpl* CreateTransportChannel(
      const std::string& name, const std::string &content_type) = 0;
  virtual void DestroyTransportChannel(TransportChannelImpl* channel) = 0;

  // Informs the subclass that we received the signaling ready message.
  virtual void OnTransportSignalingReady() {}

 private:
  struct ChannelMapEntry {
    ChannelMapEntry() : impl_(NULL), candidates_allocated_(false), ref_(0) {}
    explicit ChannelMapEntry(TransportChannelImpl *impl)
        : impl_(impl),
          candidates_allocated_(false),
          ref_(0) {
    }

    void AddRef() { ++ref_; }
    void DecRef() {
      ASSERT(ref_ > 0);
      --ref_;
    }
    int ref() const { return ref_; }

    TransportChannelImpl* get() const { return impl_; }
    void set_candidates_allocated(bool status) {
      candidates_allocated_ = status;
    }
    bool candidates_allocated() const { return candidates_allocated_; }

  private:
    TransportChannelImpl *impl_;
    bool candidates_allocated_;
    int ref_;
  };

  typedef std::map<std::string, ChannelMapEntry> ChannelMap;

  // Called when the state of a channel changes.
  void OnChannelReadableState(TransportChannel* channel);
  void OnChannelWritableState(TransportChannel* channel);

  // Called when a channel requests signaling.
  void OnChannelRequestSignaling(TransportChannelImpl* channel);

  // Called when a candidate is ready from remote peer.
  void OnRemoteCandidate(const Candidate& candidate);
  // Called when a candidate is ready from channel.
  void OnChannelCandidateReady(TransportChannelImpl* channel,
                               const Candidate& candidate);
  void OnChannelRouteChange(TransportChannel* channel,
                            const Candidate& remote_candidate);
  void OnChannelCandidatesAllocationDone(TransportChannelImpl* channel);

  // Dispatches messages to the appropriate handler (below).
  void OnMessage(talk_base::Message* msg);

  // These are versions of the above methods that are called only on a
  // particular thread (s = signaling, w = worker).  The above methods post or
  // send a message to invoke this version.
  TransportChannelImpl* CreateChannel_w(const std::string& name,
                                        const std::string& content_type);
  void DestroyChannel_w(const std::string& name);
  void ConnectChannels_w();
  void ResetChannels_w();
  void DestroyAllChannels_w();
  void OnRemoteCandidate_w(const Candidate& candidate);
  void OnChannelReadableState_s();
  void OnChannelWritableState_s();
  void OnChannelRequestSignaling_s(const std::string& name);
  void OnConnecting_s();
  void OnChannelRouteChange_s(const std::string& name,
                              const Candidate& remote_candidate);

  // Helper function that invokes the given function on every channel.
  typedef void (TransportChannelImpl::* TransportChannelFunc)();
  void CallChannels_w(TransportChannelFunc func);

  // Computes the OR of the channel's read or write state (argument picks).
  bool GetTransportState_s(bool read);

  void OnChannelCandidateReady_s();

  talk_base::Thread* signaling_thread_;
  talk_base::Thread* worker_thread_;
  std::string type_;
  PortAllocator* allocator_;
  bool destroyed_;
  bool readable_;
  bool writable_;
  bool connect_requested_;

  ChannelMap channels_;
  // Buffers the ready_candidates so that SignalCanidatesReady can
  // provide them in multiples.
  std::vector<Candidate> ready_candidates_;
  // Protects changes to channels and messages
  talk_base::CriticalSection crit_;
  bool allow_local_ips_;

  DISALLOW_EVIL_CONSTRUCTORS(Transport);
};

}  // namespace cricket

#endif  // TALK_P2P_BASE_TRANSPORT_H_
