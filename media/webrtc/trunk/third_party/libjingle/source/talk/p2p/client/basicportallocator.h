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

#ifndef TALK_P2P_CLIENT_BASICPORTALLOCATOR_H_
#define TALK_P2P_CLIENT_BASICPORTALLOCATOR_H_

#include <string>
#include <vector>

#include "talk/base/messagequeue.h"
#include "talk/base/network.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/thread.h"
#include "talk/p2p/base/portallocator.h"

namespace cricket {

class BasicPortAllocator : public PortAllocator {
 public:
  BasicPortAllocator(talk_base::NetworkManager* network_manager,
                     talk_base::PacketSocketFactory* socket_factory);
  explicit BasicPortAllocator(talk_base::NetworkManager* network_manager);
  BasicPortAllocator(talk_base::NetworkManager* network_manager,
                     const talk_base::SocketAddress& stun_server,
                     const talk_base::SocketAddress& relay_server_udp,
                     const talk_base::SocketAddress& relay_server_tcp,
                     const talk_base::SocketAddress& relay_server_ssl);
  virtual ~BasicPortAllocator();

  talk_base::NetworkManager* network_manager() { return network_manager_; }

  // If socket_factory() is set to NULL each PortAllocatorSession
  // creates its own socket factory.
  talk_base::PacketSocketFactory* socket_factory() { return socket_factory_; }

  const talk_base::SocketAddress& stun_address() const {
    return stun_address_;
  }
  const talk_base::SocketAddress& relay_address_udp() const {
    return relay_address_udp_;
  }
  const talk_base::SocketAddress& relay_address_tcp() const {
    return relay_address_tcp_;
  }
  const talk_base::SocketAddress& relay_address_ssl() const {
    return relay_address_ssl_;
  }

  // Returns the best (highest preference) phase that has produced a port that
  // produced a writable connection.  If no writable connections have been
  // produced, this returns -1.
  int best_writable_phase() const;

  virtual PortAllocatorSession* CreateSession(const std::string& name,
                                              const std::string& session_type);

  // Called whenever a connection becomes writable with the argument being the
  // phase that the corresponding port was created in.
  void AddWritablePhase(int phase);

  bool allow_tcp_listen() const {
    return allow_tcp_listen_;
  }
  void set_allow_tcp_listen(bool allow_tcp_listen) {
    allow_tcp_listen_ = allow_tcp_listen;
  }

 private:
  void Construct();

  talk_base::NetworkManager* network_manager_;
  talk_base::PacketSocketFactory* socket_factory_;
  const talk_base::SocketAddress stun_address_;
  const talk_base::SocketAddress relay_address_udp_;
  const talk_base::SocketAddress relay_address_tcp_;
  const talk_base::SocketAddress relay_address_ssl_;
  int best_writable_phase_;
  bool allow_tcp_listen_;
};

struct PortConfiguration;
class AllocationSequence;

class BasicPortAllocatorSession : public PortAllocatorSession,
                                  public talk_base::MessageHandler {
 public:
  BasicPortAllocatorSession(BasicPortAllocator* allocator,
                            const std::string& name,
                            const std::string& session_type);
  ~BasicPortAllocatorSession();

  virtual BasicPortAllocator* allocator() { return allocator_; }
  talk_base::Thread* network_thread() { return network_thread_; }
  talk_base::PacketSocketFactory* socket_factory() { return socket_factory_; }

  virtual void GetInitialPorts();
  virtual void StartGetAllPorts();
  virtual void StopGetAllPorts();
  virtual bool IsGettingAllPorts() { return running_; }

 protected:
  // Starts the process of getting the port configurations.
  virtual void GetPortConfigurations();

  // Adds a port configuration that is now ready.  Once we have one for each
  // network (or a timeout occurs), we will start allocating ports.
  virtual void ConfigReady(PortConfiguration* config);

  // MessageHandler.  Can be overriden if message IDs do not conflict.
  virtual void OnMessage(talk_base::Message *message);

 private:
  void OnConfigReady(PortConfiguration* config);
  void OnConfigTimeout();
  void AllocatePorts();
  void OnAllocate();
  void DoAllocate();
  void OnNetworksChanged();
  void OnAllocationSequenceObjectsCreated();
  void DisableEquivalentPhases(talk_base::Network* network,
      PortConfiguration* config, uint32* flags);
  void AddAllocatedPort(Port* port, AllocationSequence* seq, float pref,
      bool prepare_address = true);
  void OnAddressReady(Port* port);
  void OnProtocolEnabled(AllocationSequence* seq, ProtocolType proto);
  void OnPortDestroyed(Port* port);
  void OnAddressError(Port* port);
  void OnConnectionCreated(Port* port, Connection* conn);
  void OnConnectionStateChange(Connection* conn);
  void OnShake();
  void MaybeSignalCandidatesAllocationDone();
  void OnPortAllocationComplete(AllocationSequence* seq);

  BasicPortAllocator* allocator_;
  talk_base::Thread* network_thread_;
  talk_base::scoped_ptr<talk_base::PacketSocketFactory> owned_socket_factory_;
  talk_base::PacketSocketFactory* socket_factory_;
  bool configuration_done_;
  bool allocation_started_;
  bool network_manager_started_;
  bool running_;  // set when StartGetAllPorts is called
  bool allocation_sequences_created_;
  std::vector<PortConfiguration*> configs_;
  std::vector<AllocationSequence*> sequences_;

  struct PortData {
    Port* port;
    AllocationSequence* sequence;
    bool ready;

    bool operator==(Port* rhs) const { return (port == rhs); }
  };
  std::vector<PortData> ports_;

  friend class AllocationSequence;
};

// Records configuration information useful in creating ports.
struct PortConfiguration : public talk_base::MessageData {
  talk_base::SocketAddress stun_address;
  std::string username;
  std::string password;
  std::string magic_cookie;

  typedef std::vector<ProtocolAddress> PortList;
  struct RelayServer {
    PortList ports;
    float pref_modifier;  // added to the protocol modifier to get the
                          // preference for this particular server
  };

  typedef std::vector<RelayServer> RelayList;
  RelayList relays;

  PortConfiguration(const talk_base::SocketAddress& stun_address,
                    const std::string& username,
                    const std::string& password,
                    const std::string& magic_cookie);

  // Adds another relay server, with the given ports and modifier, to the list.
  void AddRelay(const PortList& ports, float pref_modifier);

  bool ResolveStunAddress();

  // Determines whether the given relay server supports the given protocol.
  static bool SupportsProtocol(const PortConfiguration::RelayServer& relay,
                               ProtocolType type);
};

}  // namespace cricket

#endif  // TALK_P2P_CLIENT_BASICPORTALLOCATOR_H_
