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

#ifndef TALK_P2P_BASE_PORT_H_
#define TALK_P2P_BASE_PORT_H_

#include <string>
#include <vector>
#include <map>

#include "talk/base/network.h"
#include "talk/base/packetsocketfactory.h"
#include "talk/base/proxyinfo.h"
#include "talk/base/ratetracker.h"
#include "talk/base/sigslot.h"
#include "talk/base/socketaddress.h"
#include "talk/base/thread.h"
#include "talk/p2p/base/candidate.h"
#include "talk/p2p/base/stun.h"
#include "talk/p2p/base/stunrequest.h"

namespace talk_base {
class AsyncPacketSocket;
}

namespace cricket {

class Connection;
class ConnectionRequest;

enum ProtocolType {
  PROTO_UDP,
  PROTO_TCP,
  PROTO_SSLTCP,
  PROTO_LAST = PROTO_SSLTCP
};

const char* ProtoToString(ProtocolType proto);
bool StringToProto(const char* value, ProtocolType* proto);

struct ProtocolAddress {
  talk_base::SocketAddress address;
  ProtocolType proto;

  ProtocolAddress(const talk_base::SocketAddress& a, ProtocolType p)
    : address(a), proto(p) { }
};

// Represents a local communication mechanism that can be used to create
// connections to similar mechanisms of the other client.  Subclasses of this
// one add support for specific mechanisms like local UDP ports.
class Port : public talk_base::MessageHandler, public sigslot::has_slots<> {
 public:
  Port(talk_base::Thread* thread, const std::string& type,
       talk_base::PacketSocketFactory* factory, talk_base::Network* network,
       uint32 ip, int min_port, int max_port);
  virtual ~Port();

  // The thread on which this port performs its I/O.
  talk_base::Thread* thread() { return thread_; }

  // The factory used to create the sockets of this port.
  talk_base::PacketSocketFactory* socket_factory() const { return factory_; }
  void set_socket_factory(talk_base::PacketSocketFactory* factory) {
    factory_ = factory;
  }

  // Each port is identified by a name (for debugging purposes).
  const std::string& name() const { return name_; }
  void set_name(const std::string& name) { name_ = name; }

  // In order to establish a connection to this Port (so that real data can be
  // sent through), the other side must send us a STUN binding request that is
  // authenticated with this username and password.
  // Fills in the username fragment and password.  These will be initially set
  // in the constructor to random values.  Subclasses or tests can override.
  // TODO: Change this to "username" rather than "username_fragment".
  const std::string& username_fragment() const { return username_frag_; }
  void set_username_fragment(const std::string& username) {
    username_frag_ = username;
  }

  const std::string& password() const { return password_; }
  void set_password(const std::string& password) { password_ = password; }


  // A value in [0,1] that indicates the preference for this port versus other
  // ports on this client.  (Larger indicates more preference.)
  float preference() const { return preference_; }
  void set_preference(float preference) { preference_ = preference; }

  // Identifies the port type.
  const std::string& type() const { return type_; }

  // Identifies network that this port was allocated on.
  talk_base::Network* network() { return network_; }

  // Identifies the generation that this port was created in.
  uint32 generation() { return generation_; }
  void set_generation(uint32 generation) { generation_ = generation; }

  // PrepareAddress will attempt to get an address for this port that other
  // clients can send to.  It may take some time before the address is read.
  // Once it is ready, we will send SignalAddressReady.  If errors are
  // preventing the port from getting an address, it may send
  // SignalAddressError.
  virtual void PrepareAddress() = 0;
  sigslot::signal1<Port*> SignalAddressReady;
  sigslot::signal1<Port*> SignalAddressError;

  // Provides all of the above information in one handy object.
  const std::vector<Candidate>& candidates() const { return candidates_; }

  // Returns a map containing all of the connections of this port, keyed by the
  // remote address.
  typedef std::map<talk_base::SocketAddress, Connection*> AddressMap;
  const AddressMap& connections() { return connections_; }

  // Returns the connection to the given address or NULL if none exists.
  Connection* GetConnection(const talk_base::SocketAddress& remote_addr);

  // Creates a new connection to the given address.
  enum CandidateOrigin { ORIGIN_THIS_PORT, ORIGIN_OTHER_PORT, ORIGIN_MESSAGE };
  virtual Connection* CreateConnection(const Candidate& remote_candidate,
    CandidateOrigin origin) = 0;

  // Called each time a connection is created.
  sigslot::signal2<Port*, Connection*> SignalConnectionCreated;

  // Sends the given packet to the given address, provided that the address is
  // that of a connection or an address that has sent to us already.
  virtual int SendTo(
      const void* data, size_t size, const talk_base::SocketAddress& addr,
      bool payload) = 0;

  // Indicates that we received a successful STUN binding request from an
  // address that doesn't correspond to any current connection.  To turn this
  // into a real connection, call CreateConnection.
  sigslot::signal4<Port*, const talk_base::SocketAddress&, StunMessage*,
                   const std::string&> SignalUnknownAddress;

  // Sends a response message (normal or error) to the given request.  One of
  // these methods should be called as a response to SignalUnknownAddress.
  // NOTE: You MUST call CreateConnection BEFORE SendBindingResponse.
  void SendBindingResponse(StunMessage* request,
                           const talk_base::SocketAddress& addr);
  void SendBindingErrorResponse(
      StunMessage* request, const talk_base::SocketAddress& addr,
      int error_code, const std::string& reason);

  // Indicates that errors occurred when performing I/O.
  sigslot::signal2<Port*, int> SignalReadError;
  sigslot::signal2<Port*, int> SignalWriteError;

  // Functions on the underlying socket(s).
  virtual int SetOption(talk_base::Socket::Option opt, int value) = 0;
  virtual int GetError() = 0;

  void set_proxy(const std::string& user_agent,
                 const talk_base::ProxyInfo& proxy) {
    user_agent_ = user_agent;
    proxy_ = proxy;
  }
  const std::string& user_agent() { return user_agent_; }
  const talk_base::ProxyInfo& proxy() { return proxy_; }

  // Normally, packets arrive through a connection (or they result signaling of
  // unknown address).  Calling this method turns off delivery of packets
  // through their respective connection and instead delivers every packet
  // through this port.
  void EnablePortPackets();
  sigslot::signal4<Port*, const char*, size_t, const talk_base::SocketAddress&>
      SignalReadPacket;

  // Indicates to the port that its official use has now begun.  This will
  // start the timer that checks to see if the port is being used.
  void Start();

  // Called if the port has no connections and is no longer useful.
  void Destroy();

  // Signaled when this port decides to delete itself because it no longer has
  // any usefulness.
  sigslot::signal1<Port*> SignalDestroyed;

  virtual void OnMessage(talk_base::Message *pmsg);

  // Debugging description of this port
  std::string ToString() const;

 protected:
  // Fills in the local address of the port.
  void AddAddress(const talk_base::SocketAddress& address,
                  const std::string& protocol, bool final);

  // Adds the given connection to the list.  (Deleting removes them.)
  void AddConnection(Connection* conn);

  // Called when a packet is received from an unknown address that is not
  // currently a connection.  If this is an authenticated STUN binding request,
  // then we will signal the client.
  void OnReadPacket(const char* data, size_t size,
                    const talk_base::SocketAddress& addr);


  // If the given data comprises a complete and correct STUN message then the
  // return value is true, otherwise false. If the message username corresponds
  // with this port's username fragment, msg will contain the parsed STUN
  // message.  Otherwise, the function may send a STUN response internally.
  // remote_username contains the remote fragment of the STUN username.
  bool GetStunMessage(const char* data, size_t size,
                      const talk_base::SocketAddress& addr,
                      StunMessage** out_msg, std::string* out_username);

  // TODO: make these members private
  talk_base::Thread* thread_;
  talk_base::PacketSocketFactory* factory_;
  std::string type_;
  talk_base::Network* network_;
  uint32 ip_;
  int min_port_;
  int max_port_;
  uint32 generation_;
  std::string name_;
  std::string username_frag_;
  std::string password_;
  float preference_;
  std::vector<Candidate> candidates_;
  AddressMap connections_;
  enum Lifetime { LT_PRESTART, LT_PRETIMEOUT, LT_POSTTIMEOUT } lifetime_;
  bool enable_port_packets_;

 private:
  // Called when one of our connections deletes itself.
  void OnConnectionDestroyed(Connection* conn);

  // Checks if this port is useless, and hence, should be destroyed.
  void CheckTimeout();

  // Information to use when going through a proxy.
  std::string user_agent_;
  talk_base::ProxyInfo proxy_;

  friend class Connection;
};

// Represents a communication link between a port on the local client and a
// port on the remote client.
class Connection : public talk_base::MessageHandler,
    public sigslot::has_slots<> {
 public:
  virtual ~Connection();

  // The local port where this connection sends and receives packets.
  Port* port() { return port_; }
  const Port* port() const { return port_; }

  // Returns the description of the local port
  virtual const Candidate& local_candidate() const;

  // Returns the description of the remote port to which we communicate.
  const Candidate& remote_candidate() const { return remote_candidate_; }

  enum ReadState {
    STATE_READABLE     = 0,  // we have received pings recently
    STATE_READ_TIMEOUT = 1   // we haven't received pings in a while
  };

  ReadState read_state() const { return read_state_; }

  enum WriteState {
    STATE_WRITABLE      = 0,  // we have received ping responses recently
    STATE_WRITE_CONNECT = 1,  // we have had a few ping failures
    STATE_WRITE_TIMEOUT = 2   // we have had a large number of ping failures
  };

  WriteState write_state() const { return write_state_; }

  // Determines whether the connection has finished connecting.  This can only
  // be false for TCP connections.
  bool connected() const { return connected_; }

  // Estimate of the round-trip time over this connection.
  uint32 rtt() const { return rtt_; }

  size_t sent_total_bytes();
  size_t sent_bytes_second();
  size_t recv_total_bytes();
  size_t recv_bytes_second();
  sigslot::signal1<Connection*> SignalStateChange;

  // Sent when the connection has decided that it is no longer of value.  It
  // will delete itself immediately after this call.
  sigslot::signal1<Connection*> SignalDestroyed;

  // The connection can send and receive packets asynchronously.  This matches
  // the interface of AsyncPacketSocket, which may use UDP or TCP under the
  // covers.
  virtual int Send(const void* data, size_t size) = 0;

  // Error if Send() returns < 0
  virtual int GetError() = 0;

  sigslot::signal3<Connection*, const char*, size_t> SignalReadPacket;

  // Called when a packet is received on this connection.
  void OnReadPacket(const char* data, size_t size);

  // Called when a connection is determined to be no longer useful to us.  We
  // still keep it around in case the other side wants to use it.  But we can
  // safely stop pinging on it and we can allow it to time out if the other
  // side stops using it as well.
  bool pruned() const { return pruned_; }
  void Prune();

  // Makes the connection go away.
  void Destroy();

  // Checks that the state of this connection is up-to-date.  The argument is
  // the current time, which is compared against various timeouts.
  void UpdateState(uint32 now);

  // Called when this connection should try checking writability again.
  uint32 last_ping_sent() const { return last_ping_sent_; }
  void Ping(uint32 now);

  // Called whenever a valid ping is received on this connection.  This is
  // public because the connection intercepts the first ping for us.
  void ReceivedPing();

  // Debugging description of this connection
  std::string ToString() const;

  bool reported() const { return reported_; }
  void set_reported(bool reported) { reported_ = reported;}

 protected:
  // Constructs a new connection to the given remote port.
  Connection(Port* port, size_t index, const Candidate& candidate);

  // Called back when StunRequestManager has a stun packet to send
  void OnSendStunPacket(const void* data, size_t size, StunRequest* req);

  // Callbacks from ConnectionRequest
  void OnConnectionRequestResponse(ConnectionRequest* req,
                                   StunMessage* response);
  void OnConnectionRequestErrorResponse(ConnectionRequest* req,
                                        StunMessage* response);
  void OnConnectionRequestTimeout(ConnectionRequest* req);

  // Changes the state and signals if necessary.
  void set_read_state(ReadState value);
  void set_write_state(WriteState value);
  void set_connected(bool value);

  // Checks if this connection is useless, and hence, should be destroyed.
  void CheckTimeout();

  void OnMessage(talk_base::Message *pmsg);

  Port* port_;
  size_t local_candidate_index_;
  Candidate remote_candidate_;
  ReadState read_state_;
  WriteState write_state_;
  bool connected_;
  bool pruned_;
  StunRequestManager requests_;
  uint32 rtt_;
  uint32 last_ping_sent_;      // last time we sent a ping to the other side
  uint32 last_ping_received_;  // last time we received a ping from the other
                               // side
  uint32 last_data_received_;
  std::vector<uint32> pings_since_last_response_;

  talk_base::RateTracker recv_rate_tracker_;
  talk_base::RateTracker send_rate_tracker_;

 private:
  bool reported_;

  friend class Port;
  friend class ConnectionRequest;
};

// ProxyConnection defers all the interesting work to the port
class ProxyConnection : public Connection {
 public:
  ProxyConnection(Port* port, size_t index, const Candidate& candidate);

  virtual int Send(const void* data, size_t size);
  virtual int GetError() { return error_; }

 private:
  int error_;
};

}  // namespace cricket

#endif  // TALK_P2P_BASE_PORT_H_
