/*
 * libjingle
 * Copyright 2009 Google Inc.
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

#include "talk/base/fakenetwork.h"
#include "talk/base/firewallsocketserver.h"
#include "talk/base/gunit.h"
#include "talk/base/helpers.h"
#include "talk/base/logging.h"
#include "talk/base/network.h"
#include "talk/base/physicalsocketserver.h"
#include "talk/base/socketaddress.h"
#include "talk/base/thread.h"
#include "talk/base/virtualsocketserver.h"
#include "talk/p2p/base/p2ptransportchannel.h"
#include "talk/p2p/base/portallocatorsessionproxy.h"
#include "talk/p2p/base/testrelayserver.h"
#include "talk/p2p/base/teststunserver.h"
#include "talk/p2p/client/basicportallocator.h"
#include "talk/p2p/client/httpportallocator.h"

using talk_base::SocketAddress;
using talk_base::Thread;

static const SocketAddress kClientAddr("11.11.11.11", 0);
static const SocketAddress kRemoteClientAddr("22.22.22.22", 0);
static const SocketAddress kStunAddr("99.99.99.1", cricket::STUN_SERVER_PORT);
static const SocketAddress kRelayUdpIntAddr("99.99.99.2", 5000);
static const SocketAddress kRelayUdpExtAddr("99.99.99.3", 5001);
static const SocketAddress kRelayTcpIntAddr("99.99.99.2", 5002);
static const SocketAddress kRelayTcpExtAddr("99.99.99.3", 5003);
static const SocketAddress kRelaySslTcpIntAddr("99.99.99.2", 5004);
static const SocketAddress kRelaySslTcpExtAddr("99.99.99.3", 5005);

// Minimum and maximum port for port range tests.
static const int kMinPort = 10000;
static const int kMaxPort = 10099;

// Helper for dumping candidates
std::ostream& operator<<(std::ostream& os, const cricket::Candidate& c) {
  os << c.ToString();
  return os;
}

class PortAllocatorTest : public testing::Test, public sigslot::has_slots<> {
 public:
  static void SetUpTestCase() {
    // Ensure the RNG is inited.
    talk_base::InitRandom(NULL, 0);
  }
  PortAllocatorTest()
      : pss_(new talk_base::PhysicalSocketServer),
        vss_(new talk_base::VirtualSocketServer(pss_.get())),
        fss_(new talk_base::FirewallSocketServer(vss_.get())),
        ss_scope_(fss_.get()),
        stun_server_(Thread::Current(), kStunAddr),
        relay_server_(Thread::Current(), kRelayUdpIntAddr, kRelayUdpExtAddr,
                      kRelayTcpIntAddr, kRelayTcpExtAddr,
                      kRelaySslTcpIntAddr, kRelaySslTcpExtAddr),
        allocator_(new cricket::BasicPortAllocator(
            &network_manager_, kStunAddr,
            kRelayUdpIntAddr, kRelayTcpIntAddr, kRelaySslTcpIntAddr)),
        candidate_allocation_done_(false) {
  }

  void AddInterface(const SocketAddress& addr) {
    network_manager_.AddInterface(addr);
  }
  bool SetPortRange(int min_port, int max_port) {
    return allocator_->SetPortRange(min_port, max_port);
  }

  bool CreateSession(const std::string& name, const std::string& type) {
    session_.reset(CreateSession("session", name, type));
    if (!session_.get())
      return false;
    return true;
  }

  cricket::PortAllocatorSession* CreateSession(
      const std::string& sid, const std::string& name,
      const std::string& type) {
    cricket::PortAllocatorSession* session =
        allocator_->CreateSession(sid, name, type);
    session->SignalPortReady.connect(this,
            &PortAllocatorTest::OnPortReady);
    session->SignalCandidatesReady.connect(this,
        &PortAllocatorTest::OnCandidatesReady);
    session->SignalCandidatesAllocationDone.connect(this,
        &PortAllocatorTest::OnCandidatesAllocationDone);
    return session;
  }

  static bool CheckCandidate(const cricket::Candidate& c,
                             const std::string& name, const std::string& type,
                             const std::string& proto,
                             const SocketAddress& addr) {
    return (c.name() == name && c.type() == type &&
        c.protocol() == proto && c.address().ipaddr() == addr.ipaddr() &&
        (addr.port() == 0 || (c.address().port() == addr.port())));
  }
  static bool CheckPort(const talk_base::SocketAddress& addr,
                        int min_port, int max_port) {
    return (addr.port() >= min_port && addr.port() <= max_port);
  }

  void OnCandidatesAllocationDone(cricket::PortAllocatorSession* allocator) {
    candidate_allocation_done_ = true;
  }

 protected:
  cricket::BasicPortAllocator& allocator() {
    return reinterpret_cast<cricket::BasicPortAllocator&> (*(allocator_.get()));
  }

  void OnPortReady(cricket::PortAllocatorSession* ses, cricket::Port* port) {
    LOG(LS_INFO) << "OnPortReady: " << port->ToString();
    ports_.push_back(port);
  }
  void OnCandidatesReady(cricket::PortAllocatorSession* ses,
                         const std::vector<cricket::Candidate>& candidates) {
    for (size_t i = 0; i < candidates.size(); ++i) {
      LOG(LS_INFO) << "OnCandidatesReady: " << candidates[i].ToString();
      candidates_.push_back(candidates[i]);
    }
  }

  talk_base::scoped_ptr<talk_base::PhysicalSocketServer> pss_;
  talk_base::scoped_ptr<talk_base::VirtualSocketServer> vss_;
  talk_base::scoped_ptr<talk_base::FirewallSocketServer> fss_;
  talk_base::SocketServerScope ss_scope_;
  cricket::TestStunServer stun_server_;
  cricket::TestRelayServer relay_server_;
  talk_base::FakeNetworkManager network_manager_;
  talk_base::scoped_ptr<cricket::PortAllocator> allocator_;
  talk_base::scoped_ptr<cricket::PortAllocatorSession> session_;
  std::vector<cricket::Port*> ports_;
  std::vector<cricket::Candidate> candidates_;
  bool candidate_allocation_done_;
};

// Tests that we can init the port allocator and create a session.
TEST_F(PortAllocatorTest, TestBasic) {
  EXPECT_EQ(&network_manager_, allocator().network_manager());
  EXPECT_EQ(kStunAddr, allocator().stun_address());
  EXPECT_EQ(kRelayUdpIntAddr, allocator().relay_address_udp());
  EXPECT_EQ(kRelayTcpIntAddr, allocator().relay_address_tcp());
  EXPECT_EQ(kRelaySslTcpIntAddr, allocator().relay_address_ssl());
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
}

// Tests that we can get the local and STUN addresses successfully.
TEST_F(PortAllocatorTest, TestGetInitialPorts) {
  AddInterface(kClientAddr);
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  ASSERT_EQ_WAIT(2U, candidates_.size(), 1000);
  EXPECT_PRED5(CheckCandidate, candidates_[0],
      "rtp", "local", "udp", kClientAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[1],
      "rtp", "stun", "udp", kClientAddr);
  EXPECT_EQ(2U, ports_.size());
}

// Tests that we can get all the desired addresses successfully.
TEST_F(PortAllocatorTest, TestGetAllPorts) {
  AddInterface(kClientAddr);
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  session_->StartGetAllPorts();
  ASSERT_EQ_WAIT(2U, candidates_.size(), 1000);
  EXPECT_EQ(2U, ports_.size());
  ASSERT_EQ_WAIT(4U, candidates_.size(), 2000);
  EXPECT_EQ(3U, ports_.size());
  EXPECT_PRED5(CheckCandidate, candidates_[2],
      "rtp", "relay", "udp", kRelayUdpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[3],
      "rtp", "relay", "udp", kRelayUdpExtAddr);
  ASSERT_EQ_WAIT(6U, candidates_.size(), 1500);
  EXPECT_PRED5(CheckCandidate, candidates_[4],
      "rtp", "relay", "tcp", kRelayTcpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[5],
      "rtp", "local", "tcp", kClientAddr);
  EXPECT_EQ(4U, ports_.size());
  ASSERT_EQ_WAIT(7U, candidates_.size(), 2000);
  EXPECT_PRED5(CheckCandidate, candidates_[6],
      "rtp", "relay", "ssltcp", kRelaySslTcpIntAddr);
  EXPECT_EQ(4U, ports_.size());
  EXPECT_TRUE(candidate_allocation_done_);
}

// Test that we restrict client ports appropriately when a port range is set.
// We check the candidates for udp/stun/tcp ports, and the from address
// for relay ports.
TEST_F(PortAllocatorTest, TestGetAllPortsPortRange) {
  AddInterface(kClientAddr);
  // Check that an invalid port range fails.
  EXPECT_FALSE(SetPortRange(kMaxPort, kMinPort));
  // Check that a null port range succeeds.
  EXPECT_TRUE(SetPortRange(0, 0));
  // Check that a valid port range succeeds.
  EXPECT_TRUE(SetPortRange(kMinPort, kMaxPort));
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  session_->StartGetAllPorts();
  ASSERT_EQ_WAIT(2U, candidates_.size(), 1000);
  EXPECT_EQ(2U, ports_.size());
  // Check the port number for the UDP port object.
  EXPECT_PRED3(CheckPort, candidates_[0].address(), kMinPort, kMaxPort);
  // Check the port number for the STUN port object.
  EXPECT_PRED3(CheckPort, candidates_[1].address(), kMinPort, kMaxPort);
  ASSERT_EQ_WAIT(4U, candidates_.size(), 2000);
  EXPECT_EQ(3U, ports_.size());
  // Check the port number used to connect to the relay server.
  EXPECT_PRED3(CheckPort, relay_server_.GetConnection(0).source(),
               kMinPort, kMaxPort);
  ASSERT_EQ_WAIT(6U, candidates_.size(), 1500);
  EXPECT_EQ(4U, ports_.size());
  ASSERT_EQ_WAIT(7U, candidates_.size(), 2000);
  EXPECT_EQ(4U, ports_.size());
  EXPECT_TRUE(candidate_allocation_done_);
  // Check the port number for the TCP port object.
  EXPECT_PRED3(CheckPort, candidates_[5].address(), kMinPort, kMaxPort);
}

// Test that we don't crash or malfunction if we have no network adapters.
// TODO: Find a way to exit early here.
TEST_F(PortAllocatorTest, TestGetAllPortsNoAdapters) {
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  session_->StartGetAllPorts();
  WAIT(candidates_.size() > 0, 2000);
  EXPECT_TRUE(candidate_allocation_done_);
}

// Test that we don't crash or malfunction if we can't create UDP sockets.
TEST_F(PortAllocatorTest, TestGetAllPortsNoUdpSockets) {
  AddInterface(kClientAddr);
  fss_->set_udp_sockets_enabled(false);
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  session_->StartGetAllPorts();
  ASSERT_EQ_WAIT(2U, candidates_.size(), 2000);
  EXPECT_PRED5(CheckCandidate, candidates_[0],
      "rtp", "relay", "udp", kRelayUdpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[1],
      "rtp", "relay", "udp", kRelayUdpExtAddr);
  ASSERT_EQ_WAIT(4U, candidates_.size(), 2000);
  EXPECT_PRED5(CheckCandidate, candidates_[2],
      "rtp", "relay", "tcp", kRelayTcpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[3],
      "rtp", "local", "tcp", kClientAddr);
  EXPECT_EQ(2U, ports_.size());
  ASSERT_EQ_WAIT(5U, candidates_.size(), 2000);
  EXPECT_PRED5(CheckCandidate, candidates_[4],
      "rtp", "relay", "ssltcp", kRelaySslTcpIntAddr);
  EXPECT_EQ(2U, ports_.size());
  EXPECT_TRUE(candidate_allocation_done_);
}

// Test that we don't crash or malfunction if we can't create UDP sockets or
// listen on TCP sockets. We still give out a local TCP address, since
// apparently this is needed for the remote side to accept our connection.
TEST_F(PortAllocatorTest, TestGetAllPortsNoUdpSocketsNoTcpListen) {
  AddInterface(kClientAddr);
  fss_->set_udp_sockets_enabled(false);
  fss_->set_tcp_listen_enabled(false);
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  session_->StartGetAllPorts();
  ASSERT_EQ_WAIT(2U, candidates_.size(), 3000);
  EXPECT_PRED5(CheckCandidate, candidates_[0],
      "rtp", "relay", "udp", kRelayUdpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[1],
      "rtp", "relay", "udp", kRelayUdpExtAddr);
  ASSERT_EQ_WAIT(4U, candidates_.size(), 2000);
  EXPECT_PRED5(CheckCandidate, candidates_[2],
      "rtp", "relay", "tcp", kRelayTcpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[3],
      "rtp", "local", "tcp", kClientAddr);
  EXPECT_EQ(2U, ports_.size());
  ASSERT_EQ_WAIT(5U, candidates_.size(), 2000);
  EXPECT_PRED5(CheckCandidate, candidates_[4],
      "rtp", "relay", "ssltcp", kRelaySslTcpIntAddr);
  EXPECT_EQ(2U, ports_.size());
  EXPECT_TRUE(candidate_allocation_done_);
}

// Test that we don't crash or malfunction if we can't create any sockets.
// TODO: Find a way to exit early here.
TEST_F(PortAllocatorTest, TestGetAllPortsNoSockets) {
  AddInterface(kClientAddr);
  fss_->set_tcp_sockets_enabled(false);
  fss_->set_udp_sockets_enabled(false);
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  session_->StartGetAllPorts();
  WAIT(candidates_.size() > 0, 2000);
  // TODO - Check candidate_allocation_done signal.
  // In case of Relay, ports creation will succeed but sockets will fail.
  // There is no error reporting from RelayEntry to handle this failure.
}

// Testing STUN timeout.
TEST_F(PortAllocatorTest, TestGetAllPortsNoUdpAllowed) {
  fss_->AddRule(false, talk_base::FP_UDP, talk_base::FD_ANY, kClientAddr);
  AddInterface(kClientAddr);
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  session_->StartGetAllPorts();
  EXPECT_EQ_WAIT(1U, candidates_.size(), 1000);
  EXPECT_PRED5(CheckCandidate, candidates_[0],
      "rtp", "local", "udp", kClientAddr);
  EXPECT_EQ_WAIT(2U, candidates_.size(), 3000);
  EXPECT_PRED5(CheckCandidate, candidates_[1],
      "rtp", "local", "tcp", kClientAddr);
  EXPECT_EQ(2U, ports_.size());
  EXPECT_EQ_WAIT(6U, candidates_.size(), 3000);
  EXPECT_PRED5(CheckCandidate, candidates_[2],
      "rtp", "relay", "udp", kRelayUdpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[3],
      "rtp", "relay", "tcp", kRelayTcpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[4],
      "rtp", "relay", "ssltcp", kRelaySslTcpIntAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[5],
      "rtp", "relay", "udp", kRelayUdpExtAddr);
  EXPECT_EQ(3U, ports_.size());
  // Stun Timeout is 9sec.
  EXPECT_TRUE_WAIT(candidate_allocation_done_, 9000);
}

// Test to verify ICE restart process.
TEST_F(PortAllocatorTest, TestGetAllPortsRestarts) {
  AddInterface(kClientAddr);
  EXPECT_TRUE(CreateSession("rtp", "unittest"));
  session_->GetInitialPorts();
  session_->StartGetAllPorts();
  EXPECT_EQ_WAIT(2U, candidates_.size(), 1000);
  EXPECT_EQ(2U, ports_.size());
  EXPECT_EQ_WAIT(4U, candidates_.size(), 2000);
  EXPECT_EQ(3U, ports_.size());
  EXPECT_EQ_WAIT(6U, candidates_.size(), 1500);
  EXPECT_EQ(4U, ports_.size());
  EXPECT_EQ_WAIT(7U, candidates_.size(), 2000);
  EXPECT_EQ(4U, ports_.size());
  EXPECT_TRUE(candidate_allocation_done_);
  // TODO - Extend this to verify ICE restart.
}

TEST_F(PortAllocatorTest, TestBasicMuxFeatures) {
  allocator().set_flags(cricket::PORTALLOCATOR_ENABLE_BUNDLE);
  // Session ID - session1.
  talk_base::scoped_ptr<cricket::PortAllocatorSession> session1(
      CreateSession("session1", "rtp", "audio"));
  talk_base::scoped_ptr<cricket::PortAllocatorSession> session2(
      CreateSession("session1", "rtcp", "audio"));
  // We know that PortAllocator is creating a proxy session when bundle flag
  // is enabled, it's safe to type cast session objects.
  cricket::PortAllocatorSessionProxy* proxy1 =
      static_cast<cricket::PortAllocatorSessionProxy*>(session1.get());
  ASSERT_TRUE(proxy1 != NULL);
  cricket::PortAllocatorSessionProxy* proxy2 =
      static_cast<cricket::PortAllocatorSessionProxy*>(session2.get());
  ASSERT_TRUE(proxy2 != NULL);
  EXPECT_EQ(proxy1->impl(), proxy2->impl());
  AddInterface(kClientAddr);
  session1->GetInitialPorts();
  session2->GetInitialPorts();
  // Each session should receive two proxy ports of local and stun.
  ASSERT_EQ_WAIT(4U, ports_.size(), 1000);
  EXPECT_EQ(4U, candidates_.size());
  EXPECT_PRED5(CheckCandidate, candidates_[0],
      "rtp", "local", "udp", kClientAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[1],
      "rtcp", "local", "udp", kClientAddr);
  EXPECT_PRED5(CheckCandidate, candidates_[2],
      "rtp", "stun", "udp", kClientAddr);

  EXPECT_PRED5(CheckCandidate, candidates_[3],
      "rtcp", "stun", "udp", kClientAddr);
  talk_base::scoped_ptr<cricket::PortAllocatorSession> session3(
      CreateSession("session1", "video_rtp", "video"));
  // ListenToEvents(session3.get());
  session3->GetInitialPorts();
  // Since real ports and sessions are already allocated and signal sent, no
  // new ports will be allocated when new proxy session created.
  talk_base::Thread::Current()->ProcessMessages(1000);
  EXPECT_NE(6U, ports_.size());
  // Creating a PortAllocatorSession with different session name from above.
  // In this case proxy PAS should have a different PAS.
  // Session ID - session2.
  talk_base::scoped_ptr<cricket::PortAllocatorSession> session4(
        CreateSession("session2", "video_rtp", "video"));
  cricket::PortAllocatorSessionProxy* proxy4 =
        static_cast<cricket::PortAllocatorSessionProxy*>(session4.get());
  EXPECT_NE(proxy4->impl(), proxy1->impl());
}

// Test that the httpportallocator correctly maintains its lists of stun and
// relay servers, by never allowing an empty list.
TEST(HttpPortAllocatorTest, TestHttpPortAllocatorHostLists) {
  talk_base::FakeNetworkManager network_manager;
  cricket::HttpPortAllocator alloc(&network_manager, "unit test agent");
  EXPECT_EQ(1U, alloc.relay_hosts().size());
  EXPECT_EQ(1U, alloc.stun_hosts().size());

  std::vector<std::string> relay_servers;
  std::vector<talk_base::SocketAddress> stun_servers;

  alloc.SetRelayHosts(relay_servers);
  alloc.SetStunHosts(stun_servers);
  EXPECT_EQ(1U, alloc.relay_hosts().size());
  EXPECT_EQ(1U, alloc.stun_hosts().size());

  relay_servers.push_back("1.unittest.corp.google.com");
  relay_servers.push_back("2.unittest.corp.google.com");
  stun_servers.push_back(
      talk_base::SocketAddress("1.unittest.corp.google.com", 0));
  stun_servers.push_back(
      talk_base::SocketAddress("2.unittest.corp.google.com", 0));
  alloc.SetRelayHosts(relay_servers);
  alloc.SetStunHosts(stun_servers);
  EXPECT_EQ(2U, alloc.relay_hosts().size());
  EXPECT_EQ(2U, alloc.stun_hosts().size());
}
