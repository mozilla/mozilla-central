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

#include "talk/p2p/base/port.h"

#include <algorithm>
#include <vector>

#include "talk/base/helpers.h"
#include "talk/base/logging.h"
#include "talk/base/messagedigest.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/stringutils.h"
#include "talk/p2p/base/common.h"

namespace {

// The length of time we wait before timing out readability on a connection.
const uint32 CONNECTION_READ_TIMEOUT = 30 * 1000;   // 30 seconds

// The length of time we wait before timing out writability on a connection.
const uint32 CONNECTION_WRITE_TIMEOUT = 15 * 1000;  // 15 seconds

// The length of time we wait before we become unwritable.
const uint32 CONNECTION_WRITE_CONNECT_TIMEOUT = 5 * 1000;  // 5 seconds

// The number of pings that must fail to respond before we become unwritable.
const uint32 CONNECTION_WRITE_CONNECT_FAILURES = 5;

// This is the length of time that we wait for a ping response to come back.
const int CONNECTION_RESPONSE_TIMEOUT = 5 * 1000;   // 5 seconds

// Determines whether we have seen at least the given maximum number of
// pings fail to have a response.
inline bool TooManyFailures(
    const std::vector<uint32>& pings_since_last_response,
    uint32 maximum_failures,
    uint32 rtt_estimate,
    uint32 now) {

  // If we haven't sent that many pings, then we can't have failed that many.
  if (pings_since_last_response.size() < maximum_failures)
    return false;

  // Check if the window in which we would expect a response to the ping has
  // already elapsed.
  return pings_since_last_response[maximum_failures - 1] + rtt_estimate < now;
}

// Determines whether we have gone too long without seeing any response.
inline bool TooLongWithoutResponse(
    const std::vector<uint32>& pings_since_last_response,
    uint32 maximum_time,
    uint32 now) {

  if (pings_since_last_response.size() == 0)
    return false;

  return pings_since_last_response[0] + maximum_time < now;
}

// We will restrict RTT estimates (when used for determining state) to be
// within a reasonable range.
const uint32 MINIMUM_RTT = 100;   // 0.1 seconds
const uint32 MAXIMUM_RTT = 3000;  // 3 seconds

// When we don't have any RTT data, we have to pick something reasonable.  We
// use a large value just in case the connection is really slow.
const uint32 DEFAULT_RTT = MAXIMUM_RTT;

// Computes our estimate of the RTT given the current estimate.
inline uint32 ConservativeRTTEstimate(uint32 rtt) {
  return talk_base::_max(MINIMUM_RTT, talk_base::_min(MAXIMUM_RTT, 2 * rtt));
}

// Weighting of the old rtt value to new data.
const int RTT_RATIO = 3;  // 3 : 1

// The delay before we begin checking if this port is useless.
const int kPortTimeoutDelay = 30 * 1000;  // 30 seconds

const uint32 MSG_CHECKTIMEOUT = 1;
const uint32 MSG_DELETE = 1;
}

namespace cricket {

static const char* const PROTO_NAMES[] = { "udp", "tcp", "ssltcp" };

const float PREF_LOCAL_UDP = 1.0f;
const float PREF_LOCAL_STUN = 0.9f;
const float PREF_LOCAL_TCP = 0.8f;
const float PREF_RELAY = 0.5f;

const char* ProtoToString(ProtocolType proto) {
  return PROTO_NAMES[proto];
}

bool StringToProto(const char* value, ProtocolType* proto) {
  for (size_t i = 0; i <= PROTO_LAST; ++i) {
    if (strcmp(PROTO_NAMES[i], value) == 0) {
      *proto = static_cast<ProtocolType>(i);
      return true;
    }
  }
  return false;
}

Port::Port(talk_base::Thread* thread, const std::string& type,
           talk_base::PacketSocketFactory* factory, talk_base::Network* network,
           const talk_base::IPAddress& ip, int min_port, int max_port,
           const std::string& username_fragment, const std::string& password)
    : thread_(thread),
      factory_(factory),
      type_(type),
      network_(network),
      ip_(ip),
      min_port_(min_port),
      max_port_(max_port),
      generation_(0),
      preference_(-1),
      username_fragment_(username_fragment),
      password_(password),
      lifetime_(LT_PRESTART),
      enable_port_packets_(false),
      enable_message_integrity_(false) {
  ASSERT(factory_ != NULL);
  LOG_J(LS_INFO, this) << "Port created";
}

Port::~Port() {
  // Delete all of the remaining connections.  We copy the list up front
  // because each deletion will cause it to be modified.

  std::vector<Connection*> list;

  AddressMap::iterator iter = connections_.begin();
  while (iter != connections_.end()) {
    list.push_back(iter->second);
    ++iter;
  }

  for (uint32 i = 0; i < list.size(); i++)
    delete list[i];
}

Connection* Port::GetConnection(const talk_base::SocketAddress& remote_addr) {
  AddressMap::const_iterator iter = connections_.find(remote_addr);
  if (iter != connections_.end())
    return iter->second;
  else
    return NULL;
}

void Port::AddAddress(const talk_base::SocketAddress& address,
                      const std::string& protocol,
                      bool final) {
  Candidate c;
  c.set_name(name_);
  c.set_type(type_);
  c.set_protocol(protocol);
  c.set_address(address);
  c.set_preference(preference_);
  c.set_username(username_fragment_);
  c.set_password(password_);
  c.set_network_name(network_->name());
  c.set_generation(generation_);
  candidates_.push_back(c);

  if (final)
    SignalAddressReady(this);
}

void Port::AddConnection(Connection* conn) {
  connections_[conn->remote_candidate().address()] = conn;
  conn->SignalDestroyed.connect(this, &Port::OnConnectionDestroyed);
  SignalConnectionCreated(this, conn);
}

void Port::OnReadPacket(
    const char* data, size_t size, const talk_base::SocketAddress& addr) {
  // If the user has enabled port packets, just hand this over.
  if (enable_port_packets_) {
    SignalReadPacket(this, data, size, addr);
    return;
  }

  // If this is an authenticated STUN request, then signal unknown address and
  // send back a proper binding response.
  StunMessage* msg;
  std::string remote_username;
  if (!GetStunMessage(data, size, addr, &msg, &remote_username)) {
    LOG_J(LS_ERROR, this) << "Received non-STUN packet from unknown address ("
                          << addr.ToString() << ")";
  } else if (!msg) {
    // STUN message handled already
  } else if (msg->type() == STUN_BINDING_REQUEST) {
    SignalUnknownAddress(this, addr, msg, remote_username, false);
  } else {
    // NOTE(tschmelcher): STUN_BINDING_RESPONSE is benign. It occurs if we
    // pruned a connection for this port while it had STUN requests in flight,
    // because we then get back responses for them, which this code correctly
    // does not handle.
    if (msg->type() != STUN_BINDING_RESPONSE) {
      LOG_J(LS_ERROR, this) << "Received unexpected STUN message type ("
                            << msg->type() << ") from unknown address ("
                            << addr.ToString() << ")";
    }
    delete msg;
  }
}

bool Port::GetStunMessage(const char* data, size_t size,
                          const talk_base::SocketAddress& addr,
                          StunMessage** out_msg, std::string* out_username) {
  // NOTE: This could clearly be optimized to avoid allocating any memory.
  //       However, at the data rates we'll be looking at on the client side,
  //       this probably isn't worth worrying about.
  ASSERT(out_msg != NULL);
  ASSERT(out_username != NULL);
  *out_msg = NULL;
  out_username->clear();

  // Parse the request message.  If the packet is not a complete and correct
  // STUN message, then ignore it.
  talk_base::scoped_ptr<StunMessage> stun_msg(new StunMessage());
  talk_base::ByteBuffer buf(data, size);
  if (!stun_msg->Read(&buf) || (buf.Length() > 0)) {
    return false;
  }

  // The packet must include a username that either begins or ends with our
  // fragment.  It should begin with our fragment if it is a request and it
  // should end with our fragment if it is a response.
  const StunByteStringAttribute* username_attr =
      stun_msg->GetByteString(STUN_ATTR_USERNAME);

  int remote_frag_len = (username_attr ? username_attr->length() : 0);
  remote_frag_len -= static_cast<int>(username_fragment().size());

  if (stun_msg->type() == STUN_BINDING_REQUEST) {
    if (remote_frag_len < 0) {
      // Username not present or corrupted, don't reply.
      LOG_J(LS_ERROR, this) << "Received STUN request without username from "
                            << addr.ToString();
      return true;
    } else if (std::memcmp(username_attr->bytes(), username_fragment().c_str(),
                           username_fragment().size()) != 0) {
      LOG_J(LS_ERROR, this) << "Received STUN request with bad local username "
                            << std::string(username_attr->bytes(),
                                           username_attr->length())
                            << " from "
                            << addr.ToString();
      SendBindingErrorResponse(stun_msg.get(), addr, STUN_ERROR_UNAUTHORIZED,
                               STUN_ERROR_REASON_UNAUTHORIZED);
      return true;
    }

    if (enable_message_integrity_ &&
        !stun_msg->ValidateMessageIntegrity(data, size, password_)) {
      LOG_J(LS_ERROR, this) << "Message Integrity check failed for request, "
                            << " from "
                            << addr.ToString();
      SendBindingErrorResponse(stun_msg.get(), addr, STUN_ERROR_UNAUTHORIZED,
                               STUN_ERROR_REASON_UNAUTHORIZED);
      return true;
    }

    out_username->assign(username_attr->bytes() + username_fragment().size(),
                         username_attr->bytes() + username_attr->length());
  } else if ((stun_msg->type() == STUN_BINDING_RESPONSE)
      || (stun_msg->type() == STUN_BINDING_ERROR_RESPONSE)) {
    if (remote_frag_len < 0) {
      LOG_J(LS_ERROR, this) << "Received STUN response without username from "
                            << addr.ToString();
      // Do not send error response to a response
      return true;
    } else if (std::memcmp(username_attr->bytes() + remote_frag_len,
                           username_fragment().c_str(),
                           username_fragment().size()) != 0) {
      LOG_J(LS_ERROR, this) << "Received STUN response with bad local username "
                            << std::string(username_attr->bytes(),
                                           username_attr->length())
                            << " from "
                            << addr.ToString();
      // Do not send error response to a response
      return true;
    }
    out_username->assign(username_attr->bytes(),
                         username_attr->bytes() + remote_frag_len);

    if (stun_msg->type() == STUN_BINDING_ERROR_RESPONSE) {
      if (const StunErrorCodeAttribute* error_code = stun_msg->GetErrorCode()) {
        LOG_J(LS_ERROR, this) << "Received STUN binding error:"
                              << " class="
                              << static_cast<int>(error_code->error_class())
                              << " number="
                              << static_cast<int>(error_code->number())
                              << " reason='" << error_code->reason() << "'"
                              << " from " << addr.ToString();
        // Return message to allow error-specific processing
      } else {
        LOG_J(LS_ERROR, this) << "Received STUN binding error without a error "
                              << "code from " << addr.ToString();
        // Drop corrupt message
        return true;
      }
    }
  } else {
    LOG_J(LS_ERROR, this) << "Received STUN packet with invalid type ("
                          << stun_msg->type() << ") from " << addr.ToString();
    return true;
  }

  // Return the STUN message found.
  *out_msg = stun_msg.release();
  return true;
}

void Port::SendBindingResponse(StunMessage* request,
                               const talk_base::SocketAddress& addr) {
  ASSERT(request->type() == STUN_BINDING_REQUEST);

  // Retrieve the username from the request.
  const StunByteStringAttribute* username_attr =
      request->GetByteString(STUN_ATTR_USERNAME);
  ASSERT(username_attr != NULL);
  if (username_attr == NULL) {
    // No valid username, skip the response.
    return;
  }

  // Fill in the response message.
  StunMessage response;
  response.SetType(STUN_BINDING_RESPONSE);
  response.SetTransactionID(request->transaction_id());

  StunByteStringAttribute* username2_attr =
      StunAttribute::CreateByteString(STUN_ATTR_USERNAME);
  username2_attr->CopyBytes(username_attr->bytes(), username_attr->length());
  response.AddAttribute(username2_attr);

  StunAddressAttribute* addr_attr =
      StunAttribute::CreateAddress(STUN_ATTR_MAPPED_ADDRESS);
  addr_attr->SetPort(addr.port());
  addr_attr->SetIP(addr.ipaddr());
  response.AddAttribute(addr_attr);

  // Adding MESSAGE-INTEGRITY attribute to the response message.
  if (enable_message_integrity_)
    response.AddMessageIntegrity(password_);

  // Send the response message.
  talk_base::ByteBuffer buf;
  response.Write(&buf);
  if (SendTo(buf.Data(), buf.Length(), addr, false) < 0) {
    LOG_J(LS_ERROR, this) << "Failed to send STUN ping response to "
                          << addr.ToString();
  }

  // The fact that we received a successful request means that this connection
  // (if one exists) should now be readable.
  Connection* conn = GetConnection(addr);
  ASSERT(conn != NULL);
  if (conn)
    conn->ReceivedPing();
}

void Port::SendBindingErrorResponse(StunMessage* request,
                                    const talk_base::SocketAddress& addr,
                                    int error_code, const std::string& reason) {
  ASSERT(request->type() == STUN_BINDING_REQUEST);

  // Retrieve the username from the request. If it didn't have one, we
  // shouldn't be responding at all.
  const StunByteStringAttribute* username_attr =
      request->GetByteString(STUN_ATTR_USERNAME);
  ASSERT(username_attr != NULL);
  if (username_attr == NULL) {
    // No valid username, skip the response.
    return;
  }

  // Fill in the response message.
  StunMessage response;
  response.SetType(STUN_BINDING_ERROR_RESPONSE);
  response.SetTransactionID(request->transaction_id());

  StunByteStringAttribute* username2_attr =
      StunAttribute::CreateByteString(STUN_ATTR_USERNAME);
  username2_attr->CopyBytes(username_attr->bytes(), username_attr->length());
  response.AddAttribute(username2_attr);

  StunErrorCodeAttribute* error_attr = StunAttribute::CreateErrorCode();
  error_attr->SetErrorCode(error_code);
  error_attr->SetReason(reason);
  response.AddAttribute(error_attr);

  // Send the response message.
  // NOTE: If we wanted to, this is where we would add the HMAC.
  talk_base::ByteBuffer buf;
  response.Write(&buf);
  SendTo(buf.Data(), buf.Length(), addr, false);
  LOG_J(LS_INFO, this) << "Sending STUN binding error: reason=" << reason
                       << " to " << addr.ToString();
}

void Port::OnMessage(talk_base::Message *pmsg) {
  ASSERT(pmsg->message_id == MSG_CHECKTIMEOUT);
  ASSERT(lifetime_ == LT_PRETIMEOUT);
  lifetime_ = LT_POSTTIMEOUT;
  CheckTimeout();
}

std::string Port::ToString() const {
  std::stringstream ss;
  ss << "Port[" << name_ << ":" << generation_ << ":" << type_
     << ":" << network_->ToString() << "]";
  return ss.str();
}

void Port::EnablePortPackets() {
  enable_port_packets_ = true;
}

void Port::Start() {
  // The port sticks around for a minimum lifetime, after which
  // we destroy it when it drops to zero connections.
  if (lifetime_ == LT_PRESTART) {
    lifetime_ = LT_PRETIMEOUT;
    thread_->PostDelayed(kPortTimeoutDelay, this, MSG_CHECKTIMEOUT);
  } else {
    LOG_J(LS_WARNING, this) << "Port restart attempted";
  }
}

void Port::OnConnectionDestroyed(Connection* conn) {
  AddressMap::iterator iter =
      connections_.find(conn->remote_candidate().address());
  ASSERT(iter != connections_.end());
  connections_.erase(iter);

  CheckTimeout();
}

void Port::Destroy() {
  ASSERT(connections_.empty());
  LOG_J(LS_INFO, this) << "Port deleted";
  SignalDestroyed(this);
  delete this;
}

void Port::CheckTimeout() {
  // If this port has no connections, then there's no reason to keep it around.
  // When the connections time out (both read and write), they will delete
  // themselves, so if we have any connections, they are either readable or
  // writable (or still connecting).
  if ((lifetime_ == LT_POSTTIMEOUT) && connections_.empty()) {
    Destroy();
  }
}

// A ConnectionRequest is a simple STUN ping used to determine writability.
class ConnectionRequest : public StunRequest {
 public:
  explicit ConnectionRequest(Connection* connection) : connection_(connection) {
  }

  virtual ~ConnectionRequest() {
  }

  virtual void Prepare(StunMessage* request) {
    request->SetType(STUN_BINDING_REQUEST);
    StunByteStringAttribute* username_attr =
        StunAttribute::CreateByteString(STUN_ATTR_USERNAME);
    std::string username = connection_->remote_candidate().username();
    username.append(connection_->port()->username_fragment());
    username_attr->CopyBytes(username.c_str(), username.size());
    request->AddAttribute(username_attr);

    // Adding Message Integrity to the STUN request message.
    request->AddMessageIntegrity(connection_->remote_candidate().password());
  }

  virtual void OnResponse(StunMessage* response) {
    connection_->OnConnectionRequestResponse(this, response);
  }

  virtual void OnErrorResponse(StunMessage* response) {
    connection_->OnConnectionRequestErrorResponse(this, response);
  }

  virtual void OnTimeout() {
    connection_->OnConnectionRequestTimeout(this);
  }

  virtual int GetNextDelay() {
    // Each request is sent only once.  After a single delay , the request will
    // time out.
    timeout_ = true;
    return CONNECTION_RESPONSE_TIMEOUT;
  }

 private:
  Connection* connection_;
};

//
// Connection
//

Connection::Connection(Port* port, size_t index,
                       const Candidate& remote_candidate)
  : port_(port), local_candidate_index_(index),
    remote_candidate_(remote_candidate), read_state_(STATE_READ_TIMEOUT),
    write_state_(STATE_WRITE_CONNECT), connected_(true), pruned_(false),
    requests_(port->thread()), rtt_(DEFAULT_RTT),
    last_ping_sent_(0), last_ping_received_(0), last_data_received_(0),
    reported_(false) {
  // Wire up to send stun packets
  requests_.SignalSendPacket.connect(this, &Connection::OnSendStunPacket);
  LOG_J(LS_INFO, this) << "Connection created";
}

Connection::~Connection() {
}

const Candidate& Connection::local_candidate() const {
  ASSERT(local_candidate_index_ < port_->candidates().size());
  return port_->candidates()[local_candidate_index_];
}

void Connection::set_read_state(ReadState value) {
  ReadState old_value = read_state_;
  read_state_ = value;
  if (value != old_value) {
    LOG_J(LS_VERBOSE, this) << "set_read_state";
    SignalStateChange(this);
    CheckTimeout();
  }
}

void Connection::set_write_state(WriteState value) {
  WriteState old_value = write_state_;
  write_state_ = value;
  if (value != old_value) {
    LOG_J(LS_VERBOSE, this) << "set_write_state";
    SignalStateChange(this);
    CheckTimeout();
  }
}

void Connection::set_connected(bool value) {
  bool old_value = connected_;
  connected_ = value;
  if (value != old_value) {
    LOG_J(LS_VERBOSE, this) << "set_connected";
  }
}

void Connection::OnSendStunPacket(const void* data, size_t size,
                                  StunRequest* req) {
  if (port_->SendTo(data, size, remote_candidate_.address(), false) < 0) {
    LOG_J(LS_WARNING, this) << "Failed to send STUN ping " << req->id();
  }
}

void Connection::OnReadPacket(const char* data, size_t size) {
  StunMessage* msg;
  std::string remote_username;
  const talk_base::SocketAddress& addr(remote_candidate_.address());
  if (!port_->GetStunMessage(data, size, addr, &msg, &remote_username)) {
    // The packet did not parse as a valid STUN message

    // If this connection is readable, then pass along the packet.
    if (read_state_ == STATE_READABLE) {
      // readable means data from this address is acceptable
      // Send it on!

      last_data_received_ = talk_base::Time();
      recv_rate_tracker_.Update(size);
      SignalReadPacket(this, data, size);

      // If timed out sending writability checks, start up again
      if (!pruned_ && (write_state_ == STATE_WRITE_TIMEOUT))
        set_write_state(STATE_WRITE_CONNECT);
    } else {
      // Not readable means the remote address hasn't sent a valid
      // binding request yet.

      LOG_J(LS_WARNING, this)
        << "Received non-STUN packet from an unreadable connection.";
    }
  } else if (!msg) {
    // The packet was STUN, but was already handled internally.
  } else if (remote_username != remote_candidate_.username()) {
    // The packet had the right local username, but the remote username was
    // not the right one for the remote address.
    if (msg->type() == STUN_BINDING_REQUEST) {
      LOG_J(LS_ERROR, this) << "Received STUN request with bad remote username "
                            << remote_username;
      port_->SendBindingErrorResponse(msg, addr, STUN_ERROR_BAD_REQUEST,
                                      STUN_ERROR_REASON_BAD_REQUEST);
    } else if (msg->type() == STUN_BINDING_RESPONSE ||
               msg->type() == STUN_BINDING_ERROR_RESPONSE) {
      LOG_J(LS_ERROR, this) << "Received STUN response with bad remote username"
                            " " << remote_username;
    }
    delete msg;
  } else {
    // The packet is STUN, with the right username.
    // If this is a STUN request, then update the readable bit and respond.
    // If this is a STUN response, then update the writable bit.

    switch (msg->type()) {
    case STUN_BINDING_REQUEST:
      // Incoming, validated stun request from remote peer.
      // This call will also set the connection readable.

      port_->SendBindingResponse(msg, addr);

      // If timed out sending writability checks, start up again
      if (!pruned_ && (write_state_ == STATE_WRITE_TIMEOUT))
        set_write_state(STATE_WRITE_CONNECT);
      break;

    // Response from remote peer. Does it match request sent?
    // This doesn't just check, it makes callbacks if transaction
    // id's match
    case STUN_BINDING_RESPONSE:
      if (!port_->enable_message_integrity() ||
          msg->ValidateMessageIntegrity(
              data, size, remote_candidate().password())) {
        requests_.CheckResponse(msg);
      }
      // Otherwise silently discard the response message.
      break;
    case STUN_BINDING_ERROR_RESPONSE:
      requests_.CheckResponse(msg);
      break;

    default:
      ASSERT(false);
      break;
    }

    // Done with the message; delete

    delete msg;
  }
}

void Connection::Prune() {
  if (!pruned_) {
    LOG_J(LS_VERBOSE, this) << "Connection pruned";
    pruned_ = true;
    requests_.Clear();
    set_write_state(STATE_WRITE_TIMEOUT);
  }
}

void Connection::Destroy() {
  LOG_J(LS_VERBOSE, this) << "Connection destroyed";
  set_read_state(STATE_READ_TIMEOUT);
  set_write_state(STATE_WRITE_TIMEOUT);
}

void Connection::UpdateState(uint32 now) {
  uint32 rtt = ConservativeRTTEstimate(rtt_);

  std::string pings;
  for (size_t i = 0; i < pings_since_last_response_.size(); ++i) {
    char buf[32];
    talk_base::sprintfn(buf, sizeof(buf), "%u",
        pings_since_last_response_[i]);
    pings.append(buf).append(" ");
  }
  LOG_J(LS_VERBOSE, this) << "UpdateState(): pings_since_last_response_=" <<
      pings << ", rtt=" << rtt << ", now=" << now;

  // Check the readable state.
  //
  // Since we don't know how many pings the other side has attempted, the best
  // test we can do is a simple window.

  if ((read_state_ == STATE_READABLE) &&
      (last_ping_received_ + CONNECTION_READ_TIMEOUT <= now)) {
    LOG_J(LS_INFO, this) << "Unreadable after "
                         << now - last_ping_received_
                         << " ms without a ping, rtt=" << rtt;
    set_read_state(STATE_READ_TIMEOUT);
  }

  // Check the writable state.  (The order of these checks is important.)
  //
  // Before becoming unwritable, we allow for a fixed number of pings to fail
  // (i.e., receive no response).  We also have to give the response time to
  // get back, so we include a conservative estimate of this.
  //
  // Before timing out writability, we give a fixed amount of time.  This is to
  // allow for changes in network conditions.

  if ((write_state_ == STATE_WRITABLE) &&
      TooManyFailures(pings_since_last_response_,
                      CONNECTION_WRITE_CONNECT_FAILURES,
                      rtt,
                      now) &&
      TooLongWithoutResponse(pings_since_last_response_,
                             CONNECTION_WRITE_CONNECT_TIMEOUT,
                             now)) {
    uint32 max_pings = CONNECTION_WRITE_CONNECT_FAILURES;
    LOG_J(LS_INFO, this) << "Unwritable after " << max_pings
                         << " ping failures and "
                         << now - pings_since_last_response_[0]
                         << " ms without a response,"
                         << " ms since last received ping="
                         << now - last_ping_received_
                         << " ms since last received data="
                         << now - last_data_received_
                         << " rtt=" << rtt;
    set_write_state(STATE_WRITE_CONNECT);
  }

  if ((write_state_ == STATE_WRITE_CONNECT) &&
      TooLongWithoutResponse(pings_since_last_response_,
                             CONNECTION_WRITE_TIMEOUT,
                             now)) {
    LOG_J(LS_INFO, this) << "Timed out after "
                         << now - pings_since_last_response_[0]
                         << " ms without a response, rtt=" << rtt;
    set_write_state(STATE_WRITE_TIMEOUT);
  }
}

void Connection::Ping(uint32 now) {
  ASSERT(connected_);
  last_ping_sent_ = now;
  pings_since_last_response_.push_back(now);
  ConnectionRequest *req = new ConnectionRequest(this);
  LOG_J(LS_VERBOSE, this) << "Sending STUN ping " << req->id() << " at " << now;
  requests_.Send(req);
}

void Connection::ReceivedPing() {
  last_ping_received_ = talk_base::Time();
  set_read_state(STATE_READABLE);
}

std::string Connection::ToString() const {
  const char CONNECT_STATE_ABBREV[2] = {
    '-',  // not connected (false)
    'C',  // connected (true)
  };
  const char READ_STATE_ABBREV[2] = {
    'R',  // STATE_READABLE
    '-',  // STATE_READ_TIMEOUT
  };
  const char WRITE_STATE_ABBREV[3] = {
    'W',  // STATE_WRITABLE
    'w',  // STATE_WRITE_CONNECT
    '-',  // STATE_WRITE_TIMEOUT
  };
  const Candidate& local = local_candidate();
  const Candidate& remote = remote_candidate();
  std::stringstream ss;
  ss << "Conn[" << local.name() << ":" << local.generation()
     << ":" << local.type() << ":" << local.protocol()
     << ":" << local.address().ToString()
     << "->" << remote.name() << ":" << remote.generation()
     << ":" << remote.type() << ":"
     << remote.protocol() << ":" << remote.address().ToString()
     << "|"
     << CONNECT_STATE_ABBREV[connected()]
     << READ_STATE_ABBREV[read_state()]
     << WRITE_STATE_ABBREV[write_state()]
     << "|";
  if (rtt_ < DEFAULT_RTT) {
    ss << rtt_ << "]";
  } else {
    ss << "-]";
  }
  return ss.str();
}

void Connection::OnConnectionRequestResponse(ConnectionRequest* request,
                                             StunMessage* response) {
  // We've already validated that this is a STUN binding response with
  // the correct local and remote username for this connection.
  // So if we're not already, become writable. We may be bringing a pruned
  // connection back to life, but if we don't really want it, we can always
  // prune it again.
  uint32 rtt = request->Elapsed();
  set_write_state(STATE_WRITABLE);

  std::string pings;
  for (size_t i = 0; i < pings_since_last_response_.size(); ++i) {
    char buf[32];
    talk_base::sprintfn(buf, sizeof(buf), "%u",
        pings_since_last_response_[i]);
    pings.append(buf).append(" ");
  }

  LOG_J(LS_VERBOSE, this) << "Received STUN ping response " << request->id()
                          << ", pings_since_last_response_=" << pings
                          << ", rtt=" << rtt;

  pings_since_last_response_.clear();
  rtt_ = (RTT_RATIO * rtt_ + rtt) / (RTT_RATIO + 1);
}

void Connection::OnConnectionRequestErrorResponse(ConnectionRequest* request,
                                                  StunMessage* response) {
  const StunErrorCodeAttribute* error = response->GetErrorCode();
  uint32 error_code = error ?
      error->error_code() : static_cast<uint32>(STUN_ERROR_GLOBAL_FAILURE);

  if ((error_code == STUN_ERROR_UNKNOWN_ATTRIBUTE)
      || (error_code == STUN_ERROR_SERVER_ERROR)
      || (error_code == STUN_ERROR_UNAUTHORIZED)) {
    // Recoverable error, retry
  } else if (error_code == STUN_ERROR_STALE_CREDENTIALS) {
    // Race failure, retry
  } else {
    // This is not a valid connection.
    LOG_J(LS_ERROR, this) << "Received STUN error response, code="
                          << error_code << "; killing connection";
    set_write_state(STATE_WRITE_TIMEOUT);
  }
}

void Connection::OnConnectionRequestTimeout(ConnectionRequest* request) {
  // Log at LS_INFO if we miss a ping on a writable connection.
  talk_base::LoggingSeverity sev = (write_state_ == STATE_WRITABLE) ?
      talk_base::LS_INFO : talk_base::LS_VERBOSE;
  LOG_JV(sev, this) << "Timing-out STUN ping " << request->id()
                    << " after " << request->Elapsed() << " ms";
}

void Connection::CheckTimeout() {
  // If both read and write have timed out, then this connection can contribute
  // no more to p2p socket unless at some later date readability were to come
  // back.  However, we gave readability a long time to timeout, so at this
  // point, it seems fair to get rid of this connection.
  if ((read_state_ == STATE_READ_TIMEOUT) &&
      (write_state_ == STATE_WRITE_TIMEOUT)) {
    port_->thread()->Post(this, MSG_DELETE);
  }
}

void Connection::OnMessage(talk_base::Message *pmsg) {
  ASSERT(pmsg->message_id == MSG_DELETE);

  LOG_J(LS_INFO, this) << "Connection deleted";
  SignalDestroyed(this);
  delete this;
}

size_t Connection::recv_bytes_second() {
  return recv_rate_tracker_.units_second();
}

size_t Connection::recv_total_bytes() {
  return recv_rate_tracker_.total_units();
}

size_t Connection::sent_bytes_second() {
  return send_rate_tracker_.units_second();
}

size_t Connection::sent_total_bytes() {
  return send_rate_tracker_.total_units();
}

ProxyConnection::ProxyConnection(Port* port, size_t index,
                                 const Candidate& candidate)
  : Connection(port, index, candidate), error_(0) {
}

int ProxyConnection::Send(const void* data, size_t size) {
  if (write_state() != STATE_WRITABLE) {
    error_ = EWOULDBLOCK;
    return SOCKET_ERROR;
  }
  int sent = port_->SendTo(data, size, remote_candidate_.address(), true);
  if (sent <= 0) {
    ASSERT(sent < 0);
    error_ = port_->GetError();
  } else {
    send_rate_tracker_.Update(sent);
  }
  return sent;
}

}  // namespace cricket
