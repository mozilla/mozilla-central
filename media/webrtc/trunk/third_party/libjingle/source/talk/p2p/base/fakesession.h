// libjingle
// Copyright 2009 Google Inc.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  1. Redistributions of source code must retain the above copyright notice,
//     this list of conditions and the following disclaimer.
//  2. Redistributions in binary form must reproduce the above copyright notice,
//     this list of conditions and the following disclaimer in the documentation
//     and/or other materials provided with the distribution.
//  3. The name of the author may not be used to endorse or promote products
//     derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
// WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
// EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
// OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
// OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

#ifndef TALK_SESSION_PHONE_FAKESESSION_H_
#define TALK_SESSION_PHONE_FAKESESSION_H_

#include <map>
#include <string>

#include "talk/p2p/base/session.h"
#include "talk/p2p/base/transport.h"
#include "talk/p2p/base/transportchannel.h"
#include "talk/p2p/base/transportchannelimpl.h"

namespace cricket {

class FakeTransport;

// Fake transport channel class, which can be passed to anything that needs a
// transport channel. Can be informed of another FakeTransportChannel via
// SetDestination.
class FakeTransportChannel : public TransportChannelImpl {
 public:
  explicit FakeTransportChannel(Transport* transport,
                                const std::string& name,
                                const std::string& session_type)
      : TransportChannelImpl(name, session_type),
        transport_(transport),
        dest_(NULL),
        state_(STATE_INIT) {
  }
  ~FakeTransportChannel() {
    Reset();
  }

  virtual Transport* GetTransport() {
    return transport_;
  }
  virtual void Connect() {
    if (state_ == STATE_INIT) {
      state_ = STATE_CONNECTING;
    }
  }
  virtual void Reset() {
    if (state_ != STATE_INIT) {
      state_ = STATE_INIT;
      if (dest_) {
        dest_->state_ = STATE_INIT;
        dest_->dest_ = NULL;
        dest_ = NULL;
      }
    }
  }

  void SetDestination(FakeTransportChannel* dest) {
    if (state_ == STATE_CONNECTING && dest) {
      // This simulates the delivery of candidates.
      dest_ = dest;
      dest_->dest_ = this;
      state_ = STATE_CONNECTED;
      dest_->state_ = STATE_CONNECTED;
      set_writable(true);
      dest_->set_writable(true);
    } else if (state_ == STATE_CONNECTED && !dest) {
      // Simulates loss of connectivity, by asymmetrically forgetting dest_.
      dest_ = NULL;
      state_ = STATE_CONNECTING;
      set_writable(false);
    }
  }

  virtual int SendPacket(const char *data, size_t len) {
    if (state_ != STATE_CONNECTED) {
      return -1;
    }
    dest_->SignalReadPacket(dest_, data, len);
    return len;
  }
  virtual int SetOption(talk_base::Socket::Option opt, int value) {
    return true;
  }
  virtual int GetError() {
    return 0;
  }

  virtual void OnSignalingReady() {
  }
  virtual void OnCandidate(const Candidate& candidate) {
  }

 private:
  enum State { STATE_INIT, STATE_CONNECTING, STATE_CONNECTED };
  Transport* transport_;
  FakeTransportChannel* dest_;
  State state_;
};

// Fake transport class, which can be passed to anything that needs a Transport.
// Can be informed of another FakeTransport via SetDestination (low-tech way
// of doing candidates)
class FakeTransport : public Transport {
 public:
  typedef std::map<std::string, FakeTransportChannel*> ChannelMap;
  FakeTransport(talk_base::Thread* signaling_thread,
                talk_base::Thread* worker_thread)
      : Transport(signaling_thread, worker_thread, "test", NULL),
        dest_(NULL) {
  }
  ~FakeTransport() {
    DestroyAllChannels();
  }

  const ChannelMap& channels() const { return channels_; }

  void SetDestination(FakeTransport* dest) {
    dest_ = dest;
    for (ChannelMap::iterator it = channels_.begin(); it != channels_.end();
         ++it) {
      SetChannelDestination(it->first, it->second);
    }
  }

 protected:
  virtual TransportChannelImpl* CreateTransportChannel(
      const std::string& name, const std::string& session_type) {
    if (channels_.find(name) != channels_.end()) {
      return NULL;
    }
    FakeTransportChannel* channel =
        new FakeTransportChannel(this, name, session_type);
    SetChannelDestination(name, channel);
    channels_[name] = channel;
    return channel;
  }
  virtual void DestroyTransportChannel(TransportChannelImpl* channel) {
    channels_.erase(channel->name());
    delete channel;
  }

 private:
  void SetChannelDestination(const std::string& name,
                             FakeTransportChannel* channel) {
    FakeTransportChannel* dest_channel = NULL;
    if (dest_) {
      dest_channel =
          static_cast<FakeTransportChannel*>(dest_->GetChannel(name));
    }
    channel->SetDestination(dest_channel);
  }

  ChannelMap channels_;
  FakeTransport* dest_;
};

// Fake session class, which can be passed into a BaseChannel object for
// test purposes. Can be connected to other FakeSessions via Connect().
class FakeSession : public BaseSession {
 public:
  FakeSession()
      : BaseSession(talk_base::Thread::Current(),
                    talk_base::Thread::Current(),
                    NULL, "", "", true),
        fail_create_channel_(false) {
  }

  FakeTransport* GetTransport(const std::string& content_name) {
    return static_cast<FakeTransport*>(
        BaseSession::GetTransport(content_name));
  }

  void Connect(FakeSession* dest) {
    // Simulate the exchange of candidates.
    CompleteNegotiation();
    dest->CompleteNegotiation();
    for (TransportMap::const_iterator it = transport_proxies().begin();
        it != transport_proxies().end(); ++it) {
      static_cast<FakeTransport*>(it->second->impl())->SetDestination(
          dest->GetTransport(it->first));
    }
  }

  virtual cricket::TransportChannel* CreateChannel(
      const std::string& content_name, const std::string& name) {
    if (fail_create_channel_) {
      return NULL;
    }
    return BaseSession::CreateChannel(content_name, name);
  }

  void set_fail_channel_creation(bool fail_channel_creation) {
    fail_create_channel_ = fail_channel_creation;
  }

 protected:
  virtual Transport* CreateTransport() {
    return new FakeTransport(signaling_thread(), worker_thread());
  }
  void CompleteNegotiation() {
    for (TransportMap::const_iterator it = transport_proxies().begin();
        it != transport_proxies().end(); ++it) {
      it->second->CompleteNegotiation();
    }
  }

 private:
  bool fail_create_channel_;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_FAKESESSION_H_
