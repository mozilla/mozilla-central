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

#include "talk/p2p/client/basicportallocator.h"

#include <string>
#include <vector>

#include "talk/base/basicpacketsocketfactory.h"
#include "talk/base/common.h"
#include "talk/base/helpers.h"
#include "talk/base/host.h"
#include "talk/base/logging.h"
#include "talk/p2p/base/common.h"
#include "talk/p2p/base/port.h"
#include "talk/p2p/base/relayport.h"
#include "talk/p2p/base/stunport.h"
#include "talk/p2p/base/tcpport.h"
#include "talk/p2p/base/udpport.h"

using talk_base::CreateRandomId;
using talk_base::CreateRandomString;

namespace {

const uint32 MSG_CONFIG_START = 1;
const uint32 MSG_CONFIG_READY = 2;
const uint32 MSG_ALLOCATE = 3;
const uint32 MSG_ALLOCATION_PHASE = 4;
const uint32 MSG_SHAKE = 5;
const uint32 MSG_SEQUENCEOBJECTS_CREATED = 6;

const uint32 ALLOCATE_DELAY = 250;
const uint32 ALLOCATION_STEP_DELAY = 1 * 1000;

const int PHASE_UDP = 0;
const int PHASE_RELAY = 1;
const int PHASE_TCP = 2;
const int PHASE_SSLTCP = 3;

const int kNumPhases = 4;

// Modifiers of the above constants
const float RELAY_PRIMARY_PREF_MODIFIER = 0.0f;
const float RELAY_BACKUP_PREF_MODIFIER = -0.2f;

// Returns the phase in which a given local candidate (or rather, the port that
// gave rise to that local candidate) would have been created.
int LocalCandidateToPhase(const cricket::Candidate& candidate) {
  cricket::ProtocolType proto;
  bool result = cricket::StringToProto(candidate.protocol().c_str(), &proto);
  if (result) {
    if (candidate.type() == cricket::LOCAL_PORT_TYPE) {
      switch (proto) {
      case cricket::PROTO_UDP: return PHASE_UDP;
      case cricket::PROTO_TCP: return PHASE_TCP;
      default: ASSERT(false);
      }
    } else if (candidate.type() == cricket::STUN_PORT_TYPE) {
      return PHASE_UDP;
    } else if (candidate.type() == cricket::RELAY_PORT_TYPE) {
      switch (proto) {
      case cricket::PROTO_UDP: return PHASE_RELAY;
      case cricket::PROTO_TCP: return PHASE_TCP;
      case cricket::PROTO_SSLTCP: return PHASE_SSLTCP;
      default: ASSERT(false);
      }
    } else {
      ASSERT(false);
    }
  } else {
    ASSERT(false);
  }
  return PHASE_UDP;  // reached only with assert failure
}

const int SHAKE_MIN_DELAY = 45 * 1000;  // 45 seconds
const int SHAKE_MAX_DELAY = 90 * 1000;  // 90 seconds

int ShakeDelay() {
  int range = SHAKE_MAX_DELAY - SHAKE_MIN_DELAY + 1;
  return SHAKE_MIN_DELAY + CreateRandomId() % range;
}

}  // namespace

namespace cricket {

const uint32 DISABLE_ALL_PHASES =
  PORTALLOCATOR_DISABLE_UDP
  | PORTALLOCATOR_DISABLE_TCP
  | PORTALLOCATOR_DISABLE_STUN
  | PORTALLOCATOR_DISABLE_RELAY;

// Performs the allocation of ports, in a sequenced (timed) manner, for a given
// network and IP address.
class AllocationSequence : public talk_base::MessageHandler {
 public:
  enum State {
    kInit,       // Initial state.
    kRunning,    // Started allocating ports.
    kStopped,    // Stopped from running.
    kCompleted,  // All ports are allocated.

    // kInit --> kRunning --> {kCompleted|kStopped}
  };

  AllocationSequence(BasicPortAllocatorSession* session,
                     talk_base::Network* network,
                     PortConfiguration* config,
                     uint32 flags);
  ~AllocationSequence();

  // Disables the phases for a new sequence that this one already covers for an
  // equivalent network setup.
  void DisableEquivalentPhases(talk_base::Network* network,
      PortConfiguration* config, uint32* flags);

  // Starts and stops the sequence.  When started, it will continue allocating
  // new ports on its own timed schedule.
  void Start();
  void Stop();

  // MessageHandler
  void OnMessage(talk_base::Message* msg);

  void EnableProtocol(ProtocolType proto);
  bool ProtocolEnabled(ProtocolType proto) const;
  void AddCandidates(int count) {
    allocated_candidates_ += count;
  }

  // Returns true if AllocationSequence has got all expect candidates.
  bool HasAllCandidates() {
    return (state_ == kCompleted &&
            allocated_candidates_ == expected_candidates_);
  }
  // Signal from AllocationSequence, when it's done with allocating ports.
  // This signal is useful, when port allocation fails which doesn't result
  // in any candidates. Using this signal BasicPortAllocatorSession can send
  // its candidate discovery conclusion signal. Without this signal,
  // BasicPortAllocatorSession doesn't have any event to trigger signal. This
  // can also be achieved by starting timer in BPAS.
  sigslot::signal1<AllocationSequence*> SignalPortAllocationComplete;
  // Decrement expected candidate after STUN error.
  void RemoveCandidates(int count) {
    expected_candidates_ -= count;
  }

 private:
  typedef std::vector<ProtocolType> ProtocolList;

  void CreateUDPPorts();
  void CreateTCPPorts();
  void CreateStunPorts();
  void CreateRelayPorts();
  bool running() { return state_ == kRunning; }

  BasicPortAllocatorSession* session_;
  talk_base::Network* network_;
  talk_base::IPAddress ip_;
  PortConfiguration* config_;
  State state_;
  int step_;
  int step_of_phase_[kNumPhases];
  uint32 flags_;
  ProtocolList protocols_;
  int allocated_candidates_;
  int expected_candidates_;
};


// BasicPortAllocator
BasicPortAllocator::BasicPortAllocator(
    talk_base::NetworkManager* network_manager,
    talk_base::PacketSocketFactory* socket_factory)
    : network_manager_(network_manager),
      socket_factory_(socket_factory) {
  ASSERT(socket_factory_ != NULL);
  Construct();
}

BasicPortAllocator::BasicPortAllocator(
    talk_base::NetworkManager* network_manager)
    : network_manager_(network_manager),
      socket_factory_(NULL) {
  Construct();
}

BasicPortAllocator::BasicPortAllocator(
    talk_base::NetworkManager* network_manager,
    const talk_base::SocketAddress& stun_address,
    const talk_base::SocketAddress& relay_address_udp,
    const talk_base::SocketAddress& relay_address_tcp,
    const talk_base::SocketAddress& relay_address_ssl)
    : network_manager_(network_manager),
      socket_factory_(NULL),
      stun_address_(stun_address),
      relay_address_udp_(relay_address_udp),
      relay_address_tcp_(relay_address_tcp),
      relay_address_ssl_(relay_address_ssl) {
  Construct();
}

void BasicPortAllocator::Construct() {
  best_writable_phase_ = -1;
  allow_tcp_listen_ = true;
}

BasicPortAllocator::~BasicPortAllocator() {
}

int BasicPortAllocator::best_writable_phase() const {
  // If we are configured with an HTTP proxy, the best bet is to use the relay
  if ((best_writable_phase_ == -1)
      && ((proxy().type == talk_base::PROXY_HTTPS)
          || (proxy().type == talk_base::PROXY_UNKNOWN))) {
    return PHASE_RELAY;
  }
  return best_writable_phase_;
}

PortAllocatorSession *BasicPortAllocator::CreateSession(
    const std::string &name, const std::string &session_type) {
  return new BasicPortAllocatorSession(this, name, session_type);
}

void BasicPortAllocator::AddWritablePhase(int phase) {
  if ((best_writable_phase_ == -1) || (phase < best_writable_phase_))
    best_writable_phase_ = phase;
}

// BasicPortAllocatorSession
BasicPortAllocatorSession::BasicPortAllocatorSession(
    BasicPortAllocator *allocator,
    const std::string &name,
    const std::string &session_type)
    : PortAllocatorSession(name, session_type, allocator->flags()),
      allocator_(allocator), network_thread_(NULL),
      socket_factory_(allocator->socket_factory()), allocation_started_(false),
      network_manager_started_(false),
      running_(false),
      allocation_sequences_created_(false) {
  allocator_->network_manager()->SignalNetworksChanged.connect(
      this, &BasicPortAllocatorSession::OnNetworksChanged);
  allocator_->network_manager()->StartUpdating();
}

BasicPortAllocatorSession::~BasicPortAllocatorSession() {
  allocator_->network_manager()->StopUpdating();
  if (network_thread_ != NULL)
    network_thread_->Clear(this);

  std::vector<PortData>::iterator it;
  for (it = ports_.begin(); it != ports_.end(); it++)
    delete it->port;

  for (uint32 i = 0; i < configs_.size(); ++i)
    delete configs_[i];

  for (uint32 i = 0; i < sequences_.size(); ++i)
    delete sequences_[i];
}

void BasicPortAllocatorSession::GetInitialPorts() {
  network_thread_ = talk_base::Thread::Current();
  if (!socket_factory_) {
    owned_socket_factory_.reset(
        new talk_base::BasicPacketSocketFactory(network_thread_));
    socket_factory_ = owned_socket_factory_.get();
  }

  network_thread_->Post(this, MSG_CONFIG_START);

  if (flags() & PORTALLOCATOR_ENABLE_SHAKER)
    network_thread_->PostDelayed(ShakeDelay(), this, MSG_SHAKE);
}

void BasicPortAllocatorSession::StartGetAllPorts() {
  ASSERT(talk_base::Thread::Current() == network_thread_);
  running_ = true;
  if (allocation_started_)
    network_thread_->PostDelayed(ALLOCATE_DELAY, this, MSG_ALLOCATE);
  for (uint32 i = 0; i < sequences_.size(); ++i)
    sequences_[i]->Start();
  for (size_t i = 0; i < ports_.size(); ++i)
    ports_[i].port->Start();
}

void BasicPortAllocatorSession::StopGetAllPorts() {
  ASSERT(talk_base::Thread::Current() == network_thread_);
  running_ = false;
  network_thread_->Clear(this, MSG_ALLOCATE);
  for (uint32 i = 0; i < sequences_.size(); ++i)
    sequences_[i]->Stop();
}

void BasicPortAllocatorSession::OnMessage(talk_base::Message *message) {
  switch (message->message_id) {
  case MSG_CONFIG_START:
    ASSERT(talk_base::Thread::Current() == network_thread_);
    GetPortConfigurations();
    break;

  case MSG_CONFIG_READY:
    ASSERT(talk_base::Thread::Current() == network_thread_);
    OnConfigReady(static_cast<PortConfiguration*>(message->pdata));
    break;

  case MSG_ALLOCATE:
    ASSERT(talk_base::Thread::Current() == network_thread_);
    OnAllocate();
    break;

  case MSG_SHAKE:
    ASSERT(talk_base::Thread::Current() == network_thread_);
    OnShake();
    break;
  case MSG_SEQUENCEOBJECTS_CREATED:
    ASSERT(talk_base::Thread::Current() == network_thread_);
    OnAllocationSequenceObjectsCreated();
    break;
  default:
    ASSERT(false);
  }
}

void BasicPortAllocatorSession::GetPortConfigurations() {
  PortConfiguration* config = new PortConfiguration(allocator_->stun_address(),
                                                    username(),
                                                    password(),
                                                    "");
  PortConfiguration::PortList ports;
  if (!allocator_->relay_address_udp().IsAny())
    ports.push_back(ProtocolAddress(
        allocator_->relay_address_udp(), PROTO_UDP));
  if (!allocator_->relay_address_tcp().IsAny())
    ports.push_back(ProtocolAddress(
        allocator_->relay_address_tcp(), PROTO_TCP));
  if (!allocator_->relay_address_ssl().IsAny())
    ports.push_back(ProtocolAddress(
        allocator_->relay_address_ssl(), PROTO_SSLTCP));
  config->AddRelay(ports, RELAY_PRIMARY_PREF_MODIFIER);

  ConfigReady(config);
}

void BasicPortAllocatorSession::ConfigReady(PortConfiguration* config) {
  network_thread_->Post(this, MSG_CONFIG_READY, config);
}

// Adds a configuration to the list.
void BasicPortAllocatorSession::OnConfigReady(PortConfiguration* config) {
  if (config)
    configs_.push_back(config);

  AllocatePorts();
}

void BasicPortAllocatorSession::AllocatePorts() {
  ASSERT(talk_base::Thread::Current() == network_thread_);
  network_thread_->Post(this, MSG_ALLOCATE);
}

void BasicPortAllocatorSession::OnAllocate() {
  if (network_manager_started_)
    DoAllocate();

  allocation_started_ = true;
  if (running_)
    network_thread_->PostDelayed(ALLOCATE_DELAY, this, MSG_ALLOCATE);
}

// For each network, see if we have a sequence that covers it already.  If not,
// create a new sequence to create the appropriate ports.
void BasicPortAllocatorSession::DoAllocate() {
  std::vector<talk_base::Network*> networks;
  allocator_->network_manager()->GetNetworks(&networks);
  if (networks.empty()) {
    LOG(LS_WARNING) << "Machine has no networks; no ports will be allocated";
  } else {
    for (uint32 i = 0; i < networks.size(); ++i) {
      PortConfiguration* config = NULL;
      if (configs_.size() > 0)
        config = configs_.back();

      uint32 sequence_flags = flags();

      // Disables phases that are not specified in this config.
      if (!config || config->stun_address.IsNil()) {
        // No STUN ports specified in this config.
        sequence_flags |= PORTALLOCATOR_DISABLE_STUN;
      }
      if (!config || config->relays.empty()) {
        // No relay ports specified in this config.
        sequence_flags |= PORTALLOCATOR_DISABLE_RELAY;
      }

      // Disable phases that would only create ports equivalent to
      // ones that we have already made.
      DisableEquivalentPhases(networks[i], config, &sequence_flags);

      if ((sequence_flags & DISABLE_ALL_PHASES) == DISABLE_ALL_PHASES) {
        // New AllocationSequence would have nothing to do, so don't make it.
        continue;
      }

      AllocationSequence* sequence =
          new AllocationSequence(this, networks[i], config, sequence_flags);
      sequence->SignalPortAllocationComplete.connect(
          this, &BasicPortAllocatorSession::OnPortAllocationComplete);
      if (running_)
        sequence->Start();

      sequences_.push_back(sequence);
    }
  }
  network_thread_->Post(this, MSG_SEQUENCEOBJECTS_CREATED);
}

void BasicPortAllocatorSession::OnNetworksChanged() {
  network_manager_started_ = true;
  if (allocation_started_)
    DoAllocate();
}

void BasicPortAllocatorSession::DisableEquivalentPhases(
    talk_base::Network* network, PortConfiguration* config, uint32* flags) {
  for (uint32 i = 0; i < sequences_.size() &&
      (*flags & DISABLE_ALL_PHASES) != DISABLE_ALL_PHASES; ++i) {
    sequences_[i]->DisableEquivalentPhases(network, config, flags);
  }
}

void BasicPortAllocatorSession::AddAllocatedPort(Port* port,
                                                 AllocationSequence * seq,
                                                 float pref,
                                                 bool prepare_address) {
  if (!port)
    return;

  port->set_name(name_);
  port->set_preference(pref);
  port->set_generation(generation());
  if (allocator_->proxy().type != talk_base::PROXY_NONE)
    port->set_proxy(allocator_->user_agent(), allocator_->proxy());

  PortData data;
  data.port = port;
  data.sequence = seq;
  data.ready = false;
  ports_.push_back(data);

  port->SignalAddressReady.connect(this,
      &BasicPortAllocatorSession::OnAddressReady);
  port->SignalConnectionCreated.connect(this,
      &BasicPortAllocatorSession::OnConnectionCreated);
  port->SignalDestroyed.connect(this,
      &BasicPortAllocatorSession::OnPortDestroyed);
  port->SignalAddressError.connect(
      this, &BasicPortAllocatorSession::OnAddressError);
  LOG_J(LS_INFO, port) << "Added port to allocator";

  if (prepare_address)
    port->PrepareAddress();
  if (running_)
    port->Start();
}

void BasicPortAllocatorSession::OnAddressReady(Port *port) {
  ASSERT(talk_base::Thread::Current() == network_thread_);
  std::vector<PortData>::iterator it
    = std::find(ports_.begin(), ports_.end(), port);
  ASSERT(it != ports_.end());
  if (it->ready)
    return;
  it->ready = true;
  SignalPortReady(this, port);

  // Only accumulate the candidates whose protocol has been enabled
  std::vector<Candidate> candidates;
  const std::vector<Candidate>& potentials = port->candidates();
  for (size_t i = 0; i < potentials.size(); ++i) {
    ProtocolType pvalue;
    if (!StringToProto(potentials[i].protocol().c_str(), &pvalue))
      continue;
    if (it->sequence->ProtocolEnabled(pvalue)) {
      candidates.push_back(potentials[i]);
    }
  }

  if (!candidates.empty()) {
    SignalCandidatesReady(this, candidates);

    for (std::vector<PortData>::iterator iter = ports_.begin();
        iter != ports_.end(); ++iter) {
      if (port == iter->port)
        iter->sequence->AddCandidates(candidates.size());
    }
    MaybeSignalCandidatesAllocationDone();
  }
}

void BasicPortAllocatorSession::OnProtocolEnabled(AllocationSequence * seq,
                                                  ProtocolType proto) {
  std::vector<Candidate> candidates;
  for (std::vector<PortData>::iterator it = ports_.begin();
       it != ports_.end(); ++it) {
    if (!it->ready || (it->sequence != seq))
      continue;

    const std::vector<Candidate>& potentials = it->port->candidates();
    for (size_t i = 0; i < potentials.size(); ++i) {
      ProtocolType pvalue;
      if (!StringToProto(potentials[i].protocol().c_str(), &pvalue))
        continue;
      if (pvalue == proto) {
        candidates.push_back(potentials[i]);
      }
    }
  }

  if (!candidates.empty()) {
    SignalCandidatesReady(this, candidates);

    seq->AddCandidates(candidates.size());
    MaybeSignalCandidatesAllocationDone();
  }

}

void BasicPortAllocatorSession::OnPortAllocationComplete(
    AllocationSequence* seq) {
  MaybeSignalCandidatesAllocationDone();
}

void BasicPortAllocatorSession::OnAllocationSequenceObjectsCreated() {
  allocation_sequences_created_ = true;
  MaybeSignalCandidatesAllocationDone();
}

void BasicPortAllocatorSession::MaybeSignalCandidatesAllocationDone() {
  // Send signal only if all required AllocationSequence objects
  // are created.
  if (!allocation_sequences_created_)
    return;

  // Check ICE candidate allocation status of each allocated sequence object.
  for (size_t i = 0; i < sequences_.size(); ++i) {
    if (!sequences_[i]->HasAllCandidates())
      return;
  }

  SignalCandidatesAllocationDone(this);
}

void BasicPortAllocatorSession::OnPortDestroyed(Port* port) {
  ASSERT(talk_base::Thread::Current() == network_thread_);
  std::vector<PortData>::iterator iter =
      std::find(ports_.begin(), ports_.end(), port);
  ASSERT(iter != ports_.end());
  ports_.erase(iter);

  LOG_J(LS_INFO, port) << "Removed port from allocator ("
                       << static_cast<int>(ports_.size()) << " remaining)";
}

void BasicPortAllocatorSession::OnAddressError(Port* port) {
  ASSERT(talk_base::Thread::Current() == network_thread_);
  std::vector<PortData>::iterator iter =
      std::find(ports_.begin(), ports_.end(), port);
  ASSERT(iter != ports_.end());
  // SignalAddressError is currently sent from StunPort. But this signal
  // itself is generic. If sent from RelayPort, it needs special handling as it
  // have more than one candidate.
  if (port->type() != RELAY_PORT_TYPE)
    iter->sequence->RemoveCandidates(1);
  // Send candidate allocation complete signal if all other expected candidates
  // are already received.
  MaybeSignalCandidatesAllocationDone();
}

void BasicPortAllocatorSession::OnConnectionCreated(Port* port,
                                                    Connection* conn) {
  conn->SignalStateChange.connect(this,
    &BasicPortAllocatorSession::OnConnectionStateChange);
}

void BasicPortAllocatorSession::OnConnectionStateChange(Connection* conn) {
  if (conn->write_state() == Connection::STATE_WRITABLE)
    allocator_->AddWritablePhase(
      LocalCandidateToPhase(conn->local_candidate()));
}

void BasicPortAllocatorSession::OnShake() {
  LOG(INFO) << ">>>>> SHAKE <<<<< >>>>> SHAKE <<<<< >>>>> SHAKE <<<<<";

  std::vector<Port*> ports;
  std::vector<Connection*> connections;

  for (size_t i = 0; i < ports_.size(); ++i) {
    if (ports_[i].ready)
      ports.push_back(ports_[i].port);
  }

  for (size_t i = 0; i < ports.size(); ++i) {
    Port::AddressMap::const_iterator iter;
    for (iter = ports[i]->connections().begin();
         iter != ports[i]->connections().end();
         ++iter) {
      connections.push_back(iter->second);
    }
  }

  LOG(INFO) << ">>>>> Destroying " << ports.size() << " ports and "
            << connections.size() << " connections";

  for (size_t i = 0; i < connections.size(); ++i)
    connections[i]->Destroy();

  if (running_ || (ports.size() > 0) || (connections.size() > 0))
    network_thread_->PostDelayed(ShakeDelay(), this, MSG_SHAKE);
}

// AllocationSequence

AllocationSequence::AllocationSequence(BasicPortAllocatorSession* session,
                                       talk_base::Network* network,
                                       PortConfiguration* config,
                                       uint32 flags)
    : session_(session),
      network_(network),
      ip_(network->ip()),
      config_(config),
      state_(kInit),
      step_(0),
      flags_(flags),
      allocated_candidates_(0),
      expected_candidates_(0) {
  // All of the phases up until the best-writable phase so far run in step 0.
  // The other phases follow sequentially in the steps after that.  If there is
  // no best-writable so far, then only phase 0 occurs in step 0.
  int last_phase_in_step_zero =
      talk_base::_max(0, session->allocator()->best_writable_phase());
  for (int phase = 0; phase < kNumPhases; ++phase)
    step_of_phase_[phase] = talk_base::_max(0, phase - last_phase_in_step_zero);

  // Immediately perform phase 0.
  OnMessage(NULL);
}

AllocationSequence::~AllocationSequence() {
  session_->network_thread()->Clear(this);
}

void AllocationSequence::DisableEquivalentPhases(talk_base::Network* network,
    PortConfiguration* config, uint32* flags) {
  if (!((network == network_) && (ip_ == network->ip()))) {
    // Different network setup; nothing is equivalent.
    return;
  }

  // Else turn off the stuff that we've already got covered.

  // Every config implicitly specifies local, so turn that off right away.
  *flags |= PORTALLOCATOR_DISABLE_UDP;
  *flags |= PORTALLOCATOR_DISABLE_TCP;

  if (config_ && config) {
    if (config_->stun_address == config->stun_address) {
      // Already got this STUN server covered.
      *flags |= PORTALLOCATOR_DISABLE_STUN;
    }
    if (!config_->relays.empty()) {
      // Already got relays covered.
      // NOTE: This will even skip a _different_ set of relay servers if we
      // were to be given one, but that never happens in our codebase. Should
      // probably get rid of the list in PortConfiguration and just keep a
      // single relay server in each one.
      *flags |= PORTALLOCATOR_DISABLE_RELAY;
    }
  }
}

void AllocationSequence::Start() {
  state_ = kRunning;
  session_->network_thread()->PostDelayed(ALLOCATION_STEP_DELAY,
                                          this,
                                          MSG_ALLOCATION_PHASE);
}

void AllocationSequence::Stop() {
  state_ = kStopped;
  session_->network_thread()->Clear(this, MSG_ALLOCATION_PHASE);
}

void AllocationSequence::OnMessage(talk_base::Message* msg) {
  ASSERT(talk_base::Thread::Current() == session_->network_thread());
  if (msg)
    ASSERT(msg->message_id == MSG_ALLOCATION_PHASE);

  const char* const PHASE_NAMES[kNumPhases] = {
    "Udp", "Relay", "Tcp", "SslTcp"
  };

  // Perform all of the phases in the current step.
  for (int phase = 0; phase < kNumPhases; phase++) {

    if (step_of_phase_[phase] != step_)
      continue;

    LOG_J(LS_INFO, network_) << "Allocation Phase=" << PHASE_NAMES[phase]
                             << " (Step=" << step_ << ")";

    switch (phase) {
    case PHASE_UDP:
      CreateUDPPorts();
      CreateStunPorts();
      EnableProtocol(PROTO_UDP);
      break;

    case PHASE_RELAY:
      CreateRelayPorts();
      break;

    case PHASE_TCP:
      CreateTCPPorts();
      EnableProtocol(PROTO_TCP);
      break;

    case PHASE_SSLTCP:
      state_ = kCompleted;
      EnableProtocol(PROTO_SSLTCP);
      break;

    default:
      ASSERT(false);
    }

    // If all phases in AllocationSequence are completed, no allocation
    // steps needed further. Canceling  pending signal.
    if (phase == kNumPhases - 1) {
      session_->network_thread()->Clear(this, MSG_ALLOCATION_PHASE);
      state_ = kCompleted;
      SignalPortAllocationComplete(this);
    }
  }

  // TODO: use different delays for each stage
  step_ += 1;
  if (running()) {
    session_->network_thread()->PostDelayed(ALLOCATION_STEP_DELAY,
                                            this,
                                            MSG_ALLOCATION_PHASE);
  }
}

void AllocationSequence::EnableProtocol(ProtocolType proto) {
  if (!ProtocolEnabled(proto)) {
    protocols_.push_back(proto);
    session_->OnProtocolEnabled(this, proto);
  }
}

bool AllocationSequence::ProtocolEnabled(ProtocolType proto) const {
  for (ProtocolList::const_iterator it = protocols_.begin();
       it != protocols_.end(); ++it) {
    if (*it == proto)
      return true;
  }
  return false;
}

void AllocationSequence::CreateUDPPorts() {
  if (flags_ & PORTALLOCATOR_DISABLE_UDP) {
    LOG(LS_VERBOSE) << "AllocationSequence: UDP ports disabled, skipping.";
    return;
  }

  Port* port = UDPPort::Create(session_->network_thread(),
                               session_->socket_factory(),
                               network_, ip_,
                               session_->allocator()->min_port(),
                               session_->allocator()->max_port(),
                               config_->username, config_->password);
  if (port) {
    // Increment expected candidate count.
    ++expected_candidates_;
    session_->AddAllocatedPort(port, this, PREF_LOCAL_UDP);
  }
}

void AllocationSequence::CreateTCPPorts() {
  if (flags_ & PORTALLOCATOR_DISABLE_TCP) {
    LOG(LS_VERBOSE) << "AllocationSequence: TCP ports disabled, skipping.";
    return;
  }

  Port* port = TCPPort::Create(session_->network_thread(),
                               session_->socket_factory(),
                               network_, ip_,
                               session_->allocator()->min_port(),
                               session_->allocator()->max_port(),
                               config_->username, config_->password,
                               session_->allocator()->allow_tcp_listen());
  if (port) {
    // Increment expected candidate count.
    ++expected_candidates_;
    session_->AddAllocatedPort(port, this, PREF_LOCAL_TCP);
  }
}

void AllocationSequence::CreateStunPorts() {
  if (flags_ & PORTALLOCATOR_DISABLE_STUN) {
    LOG(LS_VERBOSE) << "AllocationSequence: STUN ports disabled, skipping.";
    return;
  }

  // If BasicPortAllocatorSession::OnAllocate left STUN ports enabled then we
  // ought to have an address for them here.
  ASSERT(config_ && !config_->stun_address.IsNil());
  if (!(config_ && !config_->stun_address.IsNil())) {
    LOG(LS_WARNING)
        << "AllocationSequence: No STUN server configured, skipping.";
    return;
  }

  Port* port = StunPort::Create(session_->network_thread(),
                                session_->socket_factory(),
                                network_, ip_,
                                session_->allocator()->min_port(),
                                session_->allocator()->max_port(),
                                config_->username, config_->password,
                                config_->stun_address);
  if (port) {
    // Increment expected candidate count.
    ++expected_candidates_;
    session_->AddAllocatedPort(port, this, PREF_LOCAL_STUN);
  }
}

void AllocationSequence::CreateRelayPorts() {
  if (flags_ & PORTALLOCATOR_DISABLE_RELAY) {
     LOG(LS_VERBOSE) << "AllocationSequence: Relay ports disabled, skipping.";
     return;
  }

  // If BasicPortAllocatorSession::OnAllocate left relay ports enabled then we
  // ought to have a relay list for them here.
  ASSERT(config_ && !config_->relays.empty());
  if (!(config_ && !config_->relays.empty())) {
    LOG(LS_WARNING)
        << "AllocationSequence: No relay server configured, skipping.";
    return;
  }

  PortConfiguration::RelayList::const_iterator relay;
  for (relay = config_->relays.begin();
       relay != config_->relays.end(); ++relay) {
    RelayPort* port = RelayPort::Create(session_->network_thread(),
                                        session_->socket_factory(),
                                        network_, ip_,
                                        session_->allocator()->min_port(),
                                        session_->allocator()->max_port(),
                                        config_->username, config_->password,
                                        config_->magic_cookie);
    if (port) {
      // Note: We must add the allocated port before we add addresses because
      //       the latter will create candidates that need name and preference
      //       settings.  However, we also can't prepare the address (normally
      //       done by AddAllocatedPort) until we have these addresses.  So we
      //       wait to do that until below.
      session_->AddAllocatedPort(port, this, PREF_RELAY + relay->pref_modifier,
                                 false);

      // Add the addresses of this protocol.
      PortConfiguration::PortList::const_iterator relay_port;
      for (relay_port = relay->ports.begin();
            relay_port != relay->ports.end();
            ++relay_port) {
        port->AddServerAddress(*relay_port);
        port->AddExternalAddress(*relay_port);
        // Increment expected candidate count.
        ++expected_candidates_;
      }
      // Increment expected candidate count for external server.
      ++expected_candidates_;
      // Start fetching an address for this port.
      port->PrepareAddress();
    }
  }
}

// PortConfiguration
PortConfiguration::PortConfiguration(const talk_base::SocketAddress& sa,
                                     const std::string& un,
                                     const std::string& pw,
                                     const std::string& mc)
    : stun_address(sa), username(un), password(pw), magic_cookie(mc) {
}

void PortConfiguration::AddRelay(const PortList& ports, float pref_modifier) {
  RelayServer relay;
  relay.ports = ports;
  relay.pref_modifier = pref_modifier;
  relays.push_back(relay);
}

bool PortConfiguration::ResolveStunAddress() {
  int err = 0;
  if (!stun_address.ResolveIP(true, &err)) {
    LOG(LS_ERROR) << "Unable to resolve STUN host "
                  << stun_address.hostname() << ".  Error " << err;
    return false;
  }
  return true;
}

bool PortConfiguration::SupportsProtocol(
    const PortConfiguration::RelayServer& relay, ProtocolType type) {
  PortConfiguration::PortList::const_iterator relay_port;
  for (relay_port = relay.ports.begin();
        relay_port != relay.ports.end();
        ++relay_port) {
    if (relay_port->proto == type)
      return true;
  }
  return false;
}

}  // namespace cricket
