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
#include "talk/base/natserver.h"
#include "talk/base/natsocketfactory.h"
#include "talk/base/physicalsocketserver.h"
#include "talk/base/proxyserver.h"
#include "talk/base/socketaddress.h"
#include "talk/base/thread.h"
#include "talk/base/virtualsocketserver.h"
#include "talk/p2p/base/p2ptransportchannel.h"
#include "talk/p2p/base/testrelayserver.h"
#include "talk/p2p/base/teststunserver.h"
#include "talk/p2p/client/basicportallocator.h"

using talk_base::SocketAddress;

static const int kDefaultTimeout = 1000;
static const int kOnlyLocalPorts = cricket::PORTALLOCATOR_DISABLE_STUN |
                                   cricket::PORTALLOCATOR_DISABLE_RELAY |
                                   cricket::PORTALLOCATOR_DISABLE_TCP;
// Addresses on the public internet.
static const SocketAddress kPublicAddrs[2] =
    { SocketAddress("11.11.11.11", 0), SocketAddress("22.22.22.22", 0) };
// For configuring multihomed clients.
static const SocketAddress kAlternateAddrs[2] =
    { SocketAddress("11.11.11.101", 0), SocketAddress("22.22.22.202", 0) };
// Addresses for HTTP proxy servers.
static const SocketAddress kHttpsProxyAddrs[2] =
    { SocketAddress("11.11.11.1", 443), SocketAddress("22.22.22.1", 443) };
// Addresses for SOCKS proxy servers.
static const SocketAddress kSocksProxyAddrs[2] =
    { SocketAddress("11.11.11.1", 1080), SocketAddress("22.22.22.1", 1080) };
// Internal addresses for NAT boxes.
static const SocketAddress kNatAddrs[2] =
    { SocketAddress("192.168.1.1", 0), SocketAddress("192.168.2.1", 0) };
// Private addresses inside the NAT private networks.
static const SocketAddress kPrivateAddrs[2] =
    { SocketAddress("192.168.1.11", 0), SocketAddress("192.168.2.22", 0) };
// For cascaded NATs, the internal addresses of the inner NAT boxes.
static const SocketAddress kCascadedNatAddrs[2] =
    { SocketAddress("192.168.10.1", 0), SocketAddress("192.168.20.1", 0) };
// For cascaded NATs, private addresses inside the inner private networks.
static const SocketAddress kCascadedPrivateAddrs[2] =
    { SocketAddress("192.168.10.11", 0), SocketAddress("192.168.20.22", 0) };
// The address of the public STUN server.
static const SocketAddress kStunAddr("99.99.99.1", cricket::STUN_SERVER_PORT);
// The addresses for the public relay server.
static const SocketAddress kRelayUdpIntAddr("99.99.99.2", 5000);
static const SocketAddress kRelayUdpExtAddr("99.99.99.3", 5001);
static const SocketAddress kRelayTcpIntAddr("99.99.99.2", 5002);
static const SocketAddress kRelayTcpExtAddr("99.99.99.3", 5003);
static const SocketAddress kRelaySslTcpIntAddr("99.99.99.2", 5004);
static const SocketAddress kRelaySslTcpExtAddr("99.99.99.3", 5005);

static const int kDefaultChannelsPerEndpoint = 2;

// This test simulates 2 P2P endpoints that want to establish connectivity
// with each other over various network topologies and conditions, which can be
// specified in each individial test.
// A virtual network (via VirtualSocketServer) along with virtual firewalls and
// NATs (via Firewall/NATSocketServer) are used to simulate the various network
// conditions. We can configure the IP addresses of the endpoints,
// block various types of connectivity, or add arbitrary levels of NAT.
// We also run a STUN server and a relay server on the virtual network to allow
// our typical P2P mechanisms to do their thing.
// For each case, we expect the P2P stack to eventually settle on a specific
// form of connectivity to the other side. The test checks that the P2P
// negotiation successfully establishes connectivity within a certain time,
// and that the result is what we expect.
// Note that this class is a base class for use by other tests, who will provide
// specialized test behavior.
class P2PTransportChannelTestBase : public testing::Test,
                                    public sigslot::has_slots<> {
 public:
  P2PTransportChannelTestBase()
      : main_(talk_base::Thread::Current()),
        pss_(new talk_base::PhysicalSocketServer),
        vss_(new talk_base::VirtualSocketServer(pss_.get())),
        nss_(new talk_base::NATSocketServer(vss_.get())),
        ss_(new talk_base::FirewallSocketServer(nss_.get())),
        ss_scope_(ss_.get()),
        stun_server_(main_, kStunAddr),
        relay_server_(main_, kRelayUdpIntAddr, kRelayUdpExtAddr,
                      kRelayTcpIntAddr, kRelayTcpExtAddr,
                      kRelaySslTcpIntAddr, kRelaySslTcpExtAddr),
        socks_server1_(ss_.get(), kSocksProxyAddrs[0],
                       ss_.get(), kSocksProxyAddrs[0]),
        socks_server2_(ss_.get(), kSocksProxyAddrs[1],
                       ss_.get(), kSocksProxyAddrs[1]) {
    ep1_.allocator_.reset(new cricket::BasicPortAllocator(
        &ep1_.network_manager_, kStunAddr, kRelayUdpIntAddr,
        kRelayTcpIntAddr, kRelaySslTcpIntAddr));
    ep2_.allocator_.reset(new cricket::BasicPortAllocator(
        &ep2_.network_manager_, kStunAddr, kRelayUdpIntAddr,
        kRelayTcpIntAddr, kRelaySslTcpIntAddr));
  }

 protected:
  enum Config {
    OPEN,                           // Open to the Internet
    NAT_FULL_CONE,                  // NAT, no filtering
    NAT_ADDR_RESTRICTED,            // NAT, must send to an addr to recv
    NAT_PORT_RESTRICTED,            // NAT, must send to an addr+port to recv
    NAT_SYMMETRIC,                  // NAT, endpoint-dependent bindings
    NAT_DOUBLE_CONE,                // Double NAT, both cone
    NAT_SYMMETRIC_THEN_CONE,        // Double NAT, symmetric outer, cone inner
    BLOCK_UDP,                      // Firewall, UDP in/out blocked
    BLOCK_UDP_AND_INCOMING_TCP,     // Firewall, UDP in/out and TCP in blocked
    BLOCK_ALL_BUT_OUTGOING_HTTP,    // Firewall, only TCP out on 80/443
    PROXY_HTTPS,                    // All traffic through HTTPS proxy
    PROXY_SOCKS,                    // All traffic through SOCKS proxy
    NUM_CONFIGS
  };

  struct Result {
    Result(const std::string& lt, const std::string& lp,
           const std::string& rt, const std::string& rp,
           const std::string& lt2, const std::string& lp2,
           const std::string& rt2, const std::string& rp2, int wait)
        : local_type(lt), local_proto(lp), remote_type(rt), remote_proto(rp),
          local_type2(lt2), local_proto2(lp2), remote_type2(rt2),
          remote_proto2(rp2), connect_wait(wait) {
    }
    std::string local_type;
    std::string local_proto;
    std::string remote_type;
    std::string remote_proto;
    std::string local_type2;
    std::string local_proto2;
    std::string remote_type2;
    std::string remote_proto2;
    int connect_wait;
  };

  struct ChannelData {
    bool CheckData(const char* data, int len) {
      bool ret = false;
      if (!ch_packets_.empty()) {
        std::string packet =  ch_packets_.front();
        ret = (packet == std::string(data, len));
        ch_packets_.pop_front();
      }
      return ret;
    }

    std::string name_;  // TODO - Currently not used.
    std::list<std::string> ch_packets_;
    talk_base::scoped_ptr<cricket::P2PTransportChannel> ch_;
  };

  struct Endpoint {
    bool HasChannel(cricket::TransportChannel* ch) {
      return (ch == cd1_.ch_.get() || ch == cd2_.ch_.get());
    }
    ChannelData* GetChannelData(cricket::TransportChannel* ch) {
      if (!HasChannel(ch)) return NULL;
      if (cd1_.ch_.get() == ch)
        return &cd1_;
      else
        return &cd2_;
    }
    talk_base::FakeNetworkManager network_manager_;
    talk_base::scoped_ptr<cricket::PortAllocator> allocator_;
    ChannelData cd1_;
    ChannelData cd2_;
  };

  ChannelData* GetChannelData(cricket::TransportChannel* channel) {
    if (ep1_.HasChannel(channel))
      return ep1_.GetChannelData(channel);
    else
      return ep2_.GetChannelData(channel);
  }

  void CreateChannels() {
    ep1_.cd1_.ch_.reset(CreateChannel(0, "a", "unittest"));
    ep2_.cd1_.ch_.reset(CreateChannel(1, "a", "unittest"));
    ep1_.cd2_.ch_.reset(CreateChannel(0, "b", "unittest"));
    ep2_.cd2_.ch_.reset(CreateChannel(1, "b", "unittest"));
  }
  cricket::P2PTransportChannel* CreateChannel(int endpoint,
                                              const std::string& name,
                                              const std::string& content_type) {
    cricket::P2PTransportChannel* channel = new cricket::P2PTransportChannel(
        name, content_type, NULL, GetAllocator(endpoint));
    channel->SignalRequestSignaling.connect(
        this, &P2PTransportChannelTestBase::OnChannelRequestSignaling);
    channel->SignalCandidateReady.connect(this,
        &P2PTransportChannelTestBase::OnCandidate);
    channel->SignalReadPacket.connect(
        this, &P2PTransportChannelTestBase::OnReadPacket);
    channel->Connect();
    return channel;
  }
  void DestroyChannels() {
    ep1_.cd1_.ch_.reset();
    ep2_.cd1_.ch_.reset();
    ep1_.cd2_.ch_.reset();
    ep2_.cd2_.ch_.reset();
  }
  cricket::P2PTransportChannel* ep1_ch1() { return ep1_.cd1_.ch_.get(); }
  cricket::P2PTransportChannel* ep1_ch2() { return ep1_.cd2_.ch_.get(); }
  cricket::P2PTransportChannel* ep2_ch1() { return ep2_.cd1_.ch_.get(); }
  cricket::P2PTransportChannel* ep2_ch2() { return ep2_.cd2_.ch_.get(); }

  // Common results.
  static const Result kLocalUdpToLocalUdp;
  static const Result kLocalUdpToStunUdp;
  static const Result kStunUdpToLocalUdp;
  static const Result kStunUdpToStunUdp;
  static const Result kLocalUdpToRelayUdp;
  static const Result kLocalTcpToLocalTcp;

  static void SetUpTestCase() {
    // Ensure the RNG is inited.
    talk_base::InitRandom(NULL, 0);
  }

  talk_base::NATSocketServer* nat() { return nss_.get(); }
  talk_base::FirewallSocketServer* fw() { return ss_.get(); }

  cricket::PortAllocator* GetAllocator(int endpoint) {
    return (endpoint == 0) ? ep1_.allocator_.get() : ep2_.allocator_.get();
  }
  void AddAddress(int endpoint, const SocketAddress& addr) {
    talk_base::FakeNetworkManager& manager = (endpoint == 0) ?
        ep1_.network_manager_ : ep2_.network_manager_;
    manager.AddInterface(addr);
  }
  void RemoveAddress(int endpoint, const SocketAddress& addr) {
    talk_base::FakeNetworkManager& manager = (endpoint == 0) ?
        ep1_.network_manager_ : ep2_.network_manager_;
    manager.RemoveInterface(addr);
  }
  void SetProxy(int endpoint, talk_base::ProxyType type) {
    talk_base::ProxyInfo info;
    info.type = type;
    info.address = (type == talk_base::PROXY_HTTPS) ?
        kHttpsProxyAddrs[endpoint] : kSocksProxyAddrs[endpoint];
    GetAllocator(endpoint)->set_proxy("unittest/1.0", info);
  }
  void SetAllocatorFlags(int endpoint, int flags) {
    GetAllocator(endpoint)->set_flags(flags);
  }

  void Test(const Result& expected) {
    int32 connect_start = talk_base::Time(), connect_time;

    // Create the channels and wait for them to connect.
    CreateChannels();
    EXPECT_TRUE_WAIT_MARGIN(ep1_ch1() != NULL &&
                            ep2_ch1() != NULL &&
                            ep1_ch1()->readable() &&
                            ep1_ch1()->writable() &&
                            ep2_ch1()->readable() &&
                            ep2_ch1()->writable(),
                            expected.connect_wait,
                            1000);
    connect_time = talk_base::TimeSince(connect_start);
    if (connect_time < expected.connect_wait) {
      LOG(LS_INFO) << "Connect time: " << connect_time << " ms";
    } else {
      LOG(LS_INFO) << "Connect time: " << "TIMEOUT ("
                   << expected.connect_wait << " ms)";
    }

    // Allow a few turns of the crank for the best connections to emerge.
    // This may take up to 2 seconds.
    if (ep1_ch1()->best_connection() &&
        ep2_ch1()->best_connection()) {
      int32 converge_start = talk_base::Time(), converge_time;
      int converge_wait = 2000;
      EXPECT_TRUE_WAIT_MARGIN(
          LocalCandidate(ep1_ch1())->type() == expected.local_type &&
          LocalCandidate(ep1_ch1())->protocol() == expected.local_proto &&
          RemoteCandidate(ep1_ch1())->type() == expected.remote_type &&
          RemoteCandidate(ep1_ch1())->protocol() == expected.remote_proto,
          converge_wait,
          converge_wait);

      // Also do EXPECT_EQ on each part so that failures are more verbose.
      EXPECT_EQ(expected.local_type, LocalCandidate(ep1_ch1())->type());
      EXPECT_EQ(expected.local_proto, LocalCandidate(ep1_ch1())->protocol());
      EXPECT_EQ(expected.remote_type, RemoteCandidate(ep1_ch1())->type());
      EXPECT_EQ(expected.remote_proto, RemoteCandidate(ep1_ch1())->protocol());

      /* TODO - Enable ep2 candidates check.
      // Checking for best connection candidates information at remote.
      EXPECT_TRUE_WAIT_MARGIN(
          LocalCandidate(ep2_ch1())->type() == expected.local_type2 &&
          LocalCandidate(ep2_ch1())->protocol() == expected.local_proto2 &&
          RemoteCandidate(ep2_ch1())->type() == expected.remote_type2 &&
          RemoteCandidate(ep2_ch1())->protocol() == expected.remote_proto2,
          converge_wait - talk_base::TimeSince(converge_start),
          converge_wait - talk_base::TimeSince(converge_start));

      // For verbose
      EXPECT_EQ(expected.local_type2, LocalCandidate(ep2_ch1())->type());
      EXPECT_EQ(expected.local_proto2, LocalCandidate(ep2_ch1())->protocol());
      EXPECT_EQ(expected.remote_type2, RemoteCandidate(ep2_ch1())->type());
      EXPECT_EQ(expected.remote_proto2, RemoteCandidate(ep2_ch1())->protocol());
      */

      converge_time = talk_base::TimeSince(converge_start);
      if (converge_time < converge_wait) {
        LOG(LS_INFO) << "Converge time: " << converge_time << " ms";
      } else {
        LOG(LS_INFO) << "Converge time: " << "TIMEOUT ("
                     << converge_wait << " ms)";
      }
    }
    // Try sending some data to other end.
    TestSendRecv(kDefaultChannelsPerEndpoint);

    // Destroy the channels, and wait for them to be fully cleaned up.
    DestroyChannels();
  }

  void TestSendRecv(int channels) {
    for (int i = 0; i < 10; ++i) {
    const char* data = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
      int len = static_cast<int>(strlen(data));
      // local_channel1 <==> remote_channel1
      EXPECT_EQ_WAIT(len, SendData(ep1_ch1(), data, len), 1000);
      EXPECT_TRUE_WAIT(CheckDataOnChannel(ep2_ch1(), data, len), 1000);
      EXPECT_EQ_WAIT(len, SendData(ep2_ch1(), data, len), 1000);
      EXPECT_TRUE_WAIT(CheckDataOnChannel(ep1_ch1(), data, len), 1000);
      if (channels == kDefaultChannelsPerEndpoint) {
        // local_channel2 <==> remote_channel2
        EXPECT_EQ_WAIT(len, SendData(ep1_ch2(), data, len), 1000);
        EXPECT_TRUE_WAIT(CheckDataOnChannel(ep2_ch2(), data, len), 1000);
        EXPECT_EQ_WAIT(len, SendData(ep2_ch2(), data, len), 1000);
        EXPECT_TRUE_WAIT(CheckDataOnChannel(ep1_ch2(), data, len), 1000);
      }
    }
  }

  void OnChannelRequestSignaling(cricket::TransportChannelImpl* channel) {
    channel->OnSignalingReady();
  }
  // We pass the candidates directly to the other side.
  void OnCandidate(cricket::TransportChannelImpl* ch,
                   const cricket::Candidate& c) {
    cricket::P2PTransportChannel* rch = GetRemoteChannel(ch);
    LOG(LS_INFO) << "Candidate(" << ch->name() << "->" << rch->name() << "): "
                 << c.type() << ", " << c.protocol()
                 << ", " << c.address().ToString() << ", " << c.username()
                 << ", " << c.generation();
    rch->OnCandidate(c);
  }
  void OnReadPacket(cricket::TransportChannel* channel, const char* data,
                    size_t len) {
    std::list<std::string>& packets = GetPacketList(channel);
    packets.push_front(std::string(data, len));
  }
  int SendData(cricket::TransportChannel* channel,
               const char* data, size_t len) {
    return channel->SendPacket(data, len);
  }
  bool CheckDataOnChannel(cricket::TransportChannel* channel,
                          const char* data, int len) {
    return GetChannelData(channel)->CheckData(data, len);
  }
  static const cricket::Candidate* LocalCandidate(
      cricket::P2PTransportChannel* ch) {
    return (ch && ch->best_connection()) ?
        &ch->best_connection()->local_candidate() : NULL;
  }
  static const cricket::Candidate* RemoteCandidate(
      cricket::P2PTransportChannel* ch) {
    return (ch && ch->best_connection()) ?
        &ch->best_connection()->remote_candidate() : NULL;
  }
  cricket::P2PTransportChannel* GetRemoteChannel(
      cricket::TransportChannel* ch) {
    if (ch == ep1_ch1())
      return ep2_ch1();
    else if (ch == ep1_ch2())
      return ep2_ch2();
    else if (ch == ep2_ch1())
      return ep1_ch1();
    else if (ch == ep2_ch2())
      return ep1_ch2();
    else
      return NULL;
  }
  std::list<std::string>& GetPacketList(cricket::TransportChannel* ch) {
    return GetChannelData(ch)->ch_packets_;
  }

 private:
  talk_base::Thread* main_;
  talk_base::scoped_ptr<talk_base::PhysicalSocketServer> pss_;
  talk_base::scoped_ptr<talk_base::VirtualSocketServer> vss_;
  talk_base::scoped_ptr<talk_base::NATSocketServer> nss_;
  talk_base::scoped_ptr<talk_base::FirewallSocketServer> ss_;
  talk_base::SocketServerScope ss_scope_;
  cricket::TestStunServer stun_server_;
  cricket::TestRelayServer relay_server_;
  talk_base::SocksProxyServer socks_server1_;
  talk_base::SocksProxyServer socks_server2_;
  Endpoint ep1_;
  Endpoint ep2_;
};

// The tests have only a few outcomes, which we predefine.
const P2PTransportChannelTestBase::Result P2PTransportChannelTestBase::
    kLocalUdpToLocalUdp("local", "udp", "local", "udp",
                        "local", "udp", "local", "udp", 1000);
const P2PTransportChannelTestBase::Result P2PTransportChannelTestBase::
    kLocalUdpToStunUdp("local", "udp", "stun", "udp",
                       "stun", "udp", "local", "udp", 1000);
const P2PTransportChannelTestBase::Result P2PTransportChannelTestBase::
    kStunUdpToLocalUdp("stun", "udp", "local", "udp",
                       "local", "udp", "stun", "udp", 1000);
const P2PTransportChannelTestBase::Result P2PTransportChannelTestBase::
    kStunUdpToStunUdp("stun", "udp", "stun", "udp",
                      "stun", "udp", "stun", "udp", 1000);
const P2PTransportChannelTestBase::Result P2PTransportChannelTestBase::
    kLocalUdpToRelayUdp("local", "udp", "relay", "udp",
                        "local", "udp", "relay", "udp", 2000);
const P2PTransportChannelTestBase::Result P2PTransportChannelTestBase::
    kLocalTcpToLocalTcp("local", "tcp", "local", "tcp",
                        "local", "tcp", "local", "tcp", 3000);

// Test the matrix of all the connectivity types we expect to see in the wild.
// Just test every combination of the configs in the Config enum.
class P2PTransportChannelTest : public P2PTransportChannelTestBase {
 protected:
  static const Result* kMatrix[NUM_CONFIGS][NUM_CONFIGS];
  void ConfigureEndpoints(Config config1, Config config2) {
    ConfigureEndpoint(0, config1);
    ConfigureEndpoint(1, config2);
  }
  void ConfigureEndpoint(int endpoint, Config config) {
    switch (config) {
      case OPEN:
        AddAddress(endpoint, kPublicAddrs[endpoint]);
        break;
      case NAT_FULL_CONE:
      case NAT_ADDR_RESTRICTED:
      case NAT_PORT_RESTRICTED:
      case NAT_SYMMETRIC:
        AddAddress(endpoint, kPrivateAddrs[endpoint]);
        // Add a single NAT of the desired type
        nat()->AddTranslator(kPublicAddrs[endpoint], kNatAddrs[endpoint],
            static_cast<talk_base::NATType>(config - NAT_FULL_CONE))->
            AddClient(kPrivateAddrs[endpoint]);
        break;
      case NAT_DOUBLE_CONE:
      case NAT_SYMMETRIC_THEN_CONE:
        AddAddress(endpoint, kCascadedPrivateAddrs[endpoint]);
        // Add a two cascaded NATs of the desired types
        nat()->AddTranslator(kPublicAddrs[endpoint], kNatAddrs[endpoint],
            (config == NAT_DOUBLE_CONE) ?
                talk_base::NAT_OPEN_CONE : talk_base::NAT_SYMMETRIC)->
            AddTranslator(kPrivateAddrs[endpoint], kCascadedNatAddrs[endpoint],
                talk_base::NAT_OPEN_CONE)->
                AddClient(kCascadedPrivateAddrs[endpoint]);
        break;
      case BLOCK_UDP:
      case BLOCK_UDP_AND_INCOMING_TCP:
      case BLOCK_ALL_BUT_OUTGOING_HTTP:
      case PROXY_HTTPS:
      case PROXY_SOCKS:
        AddAddress(endpoint, kPublicAddrs[endpoint]);
        // Block all UDP
        fw()->AddRule(false, talk_base::FP_UDP, talk_base::FD_ANY,
                      kPublicAddrs[endpoint]);
        if (config == BLOCK_UDP_AND_INCOMING_TCP) {
          // Block TCP inbound to the endpoint
          fw()->AddRule(false, talk_base::FP_TCP, SocketAddress(),
                        kPublicAddrs[endpoint]);
        } else if (config == BLOCK_ALL_BUT_OUTGOING_HTTP) {
          // Block all TCP to/from the endpoint except 80/443 out
          fw()->AddRule(true, talk_base::FP_TCP, kPublicAddrs[endpoint],
                        SocketAddress(talk_base::IPAddress(INADDR_ANY), 80));
          fw()->AddRule(true, talk_base::FP_TCP, kPublicAddrs[endpoint],
                        SocketAddress(talk_base::IPAddress(INADDR_ANY), 443));
          fw()->AddRule(false, talk_base::FP_TCP, talk_base::FD_ANY,
                        kPublicAddrs[endpoint]);
        } else if (config == PROXY_HTTPS) {
          // Block all TCP to/from the endpoint except to the proxy server
          fw()->AddRule(true, talk_base::FP_TCP, kPublicAddrs[endpoint],
                        kHttpsProxyAddrs[endpoint]);
          fw()->AddRule(false, talk_base::FP_TCP, talk_base::FD_ANY,
                        kPublicAddrs[endpoint]);
          SetProxy(endpoint, talk_base::PROXY_HTTPS);
        } else if (config == PROXY_SOCKS) {
          // Block all TCP to/from the endpoint except to the proxy server
          fw()->AddRule(true, talk_base::FP_TCP, kPublicAddrs[endpoint],
                        kSocksProxyAddrs[endpoint]);
          fw()->AddRule(false, talk_base::FP_TCP, talk_base::FD_ANY,
                        kPublicAddrs[endpoint]);
          SetProxy(endpoint, talk_base::PROXY_SOCKS5);
        }
        break;
      default:
        break;
    }
  }
};

// Shorthands for use in the test matrix.
#define LULU &kLocalUdpToLocalUdp
#define LUSU &kLocalUdpToStunUdp
#define SULU &kStunUdpToLocalUdp
#define SUSU &kStunUdpToStunUdp
#define LURU &kLocalUdpToRelayUdp
#define LTLT &kLocalTcpToLocalTcp
// TODO: Enable these once TestRelayServer can accept external TCP.
#define LTRT NULL
#define LSRS NULL

// Test matrix. Originator behavior defined by rows, receiever by columns.
// TODO: Fix NULLs caused by lack of TCP support in NATSocket.
// TODO: Fix NULLs caused by no HTTP proxy support.
// TODO: Rearrange rows/columns from best to worst.
const P2PTransportChannelTest::Result*
    P2PTransportChannelTest::kMatrix[NUM_CONFIGS][NUM_CONFIGS] = {
//      OPEN  CONE  ADDR  PORT  SYMM  2CON  SCON  !UDP  !TCP  HTTP  PRXH  PRXS
/*OP*/ {LULU, LULU, LULU, LULU, LULU, LULU, LULU, LTLT, LTLT, LSRS, NULL, LTLT},
/*CO*/ {LULU, LUSU, LUSU, SUSU, SUSU, LUSU, SUSU, NULL, NULL, LSRS, NULL, LTRT},
/*AD*/ {LULU, LUSU, LULU, SUSU, SUSU, LUSU, SUSU, NULL, NULL, LSRS, NULL, LTRT},
/*PO*/ {LULU, LUSU, SUSU, SUSU, LURU, LUSU, LURU, NULL, NULL, LSRS, NULL, LTRT},
/*SY*/ {LULU, LUSU, SUSU, LURU, LURU, LUSU, LURU, NULL, NULL, LSRS, NULL, LTRT},
/*2C*/ {LULU, LUSU, LUSU, SUSU, SUSU, LUSU, SUSU, NULL, NULL, LSRS, NULL, LTRT},
/*SC*/ {LULU, LUSU, SUSU, LURU, LURU, LUSU, LURU, NULL, NULL, LSRS, NULL, LTRT},
/*!U*/ {LTLT, NULL, NULL, NULL, NULL, NULL, NULL, LTLT, LTLT, LSRS, NULL, LTRT},
/*!T*/ {LTRT, NULL, NULL, NULL, NULL, NULL, NULL, LTLT, LTRT, LSRS, NULL, LTRT},
/*HT*/ {LSRS, LSRS, LSRS, LSRS, LSRS, LSRS, LSRS, LSRS, LSRS, LSRS, NULL, LSRS},
/*PR*/ {NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL},
/*PR*/ {LTRT, LTRT, LTRT, LTRT, LTRT, LTRT, LTRT, LTRT, LTRT, LSRS, NULL, LTRT},
};

// The actual tests that exercise all the various configurations.
// Test names are of the form P2PTransportChannelTest_TestOPENToNAT_FULL_CONE
#define P2P_TEST_DECLARATION(x, y, z) \
  TEST_F(P2PTransportChannelTest, z##Test##x##To##y) { \
    ConfigureEndpoints(x, y); \
    if (kMatrix[x][y] != NULL) \
      Test(*kMatrix[x][y]); \
    else \
      LOG(LS_WARNING) << "Not yet implemented"; \
  }

#define P2P_TEST(x, y) \
  P2P_TEST_DECLARATION(x, y,)

#define FLAKY_P2P_TEST(x, y) \
  P2P_TEST_DECLARATION(x, y, DISABLED_)

#define P2P_TEST_SET(x) \
  P2P_TEST(x, OPEN) \
  P2P_TEST(x, NAT_FULL_CONE) \
  P2P_TEST(x, NAT_ADDR_RESTRICTED) \
  P2P_TEST(x, NAT_PORT_RESTRICTED) \
  P2P_TEST(x, NAT_SYMMETRIC) \
  P2P_TEST(x, NAT_DOUBLE_CONE) \
  P2P_TEST(x, NAT_SYMMETRIC_THEN_CONE) \
  P2P_TEST(x, BLOCK_UDP) \
  P2P_TEST(x, BLOCK_UDP_AND_INCOMING_TCP) \
  P2P_TEST(x, BLOCK_ALL_BUT_OUTGOING_HTTP) \
  P2P_TEST(x, PROXY_HTTPS) \
  P2P_TEST(x, PROXY_SOCKS)

#define FLAKY_P2P_TEST_SET(x) \
  P2P_TEST(x, OPEN) \
  P2P_TEST(x, NAT_FULL_CONE) \
  FLAKY_P2P_TEST(x, NAT_ADDR_RESTRICTED) \
  P2P_TEST(x, NAT_PORT_RESTRICTED) \
  P2P_TEST(x, NAT_SYMMETRIC) \
  P2P_TEST(x, NAT_DOUBLE_CONE) \
  P2P_TEST(x, NAT_SYMMETRIC_THEN_CONE) \
  P2P_TEST(x, BLOCK_UDP) \
  P2P_TEST(x, BLOCK_UDP_AND_INCOMING_TCP) \
  P2P_TEST(x, BLOCK_ALL_BUT_OUTGOING_HTTP) \
  P2P_TEST(x, PROXY_HTTPS) \
  P2P_TEST(x, PROXY_SOCKS)

P2P_TEST_SET(OPEN)
P2P_TEST_SET(NAT_FULL_CONE)
FLAKY_P2P_TEST_SET(NAT_ADDR_RESTRICTED)
FLAKY_P2P_TEST_SET(NAT_PORT_RESTRICTED)
FLAKY_P2P_TEST_SET(NAT_SYMMETRIC)
P2P_TEST_SET(NAT_DOUBLE_CONE)
FLAKY_P2P_TEST_SET(NAT_SYMMETRIC_THEN_CONE)
P2P_TEST_SET(BLOCK_UDP)
P2P_TEST_SET(BLOCK_UDP_AND_INCOMING_TCP)
P2P_TEST_SET(BLOCK_ALL_BUT_OUTGOING_HTTP)
P2P_TEST_SET(PROXY_HTTPS)
P2P_TEST_SET(PROXY_SOCKS)

// Test that a host behind NAT cannot be reached when incoming_only
// is set to true.
TEST_F(P2PTransportChannelTest, IncomingOnlyBlocked) {
  ConfigureEndpoints(NAT_FULL_CONE, OPEN);

  CreateChannels();
  ep1_ch1()->set_incoming_only(true);

  // Sleep for 1 second and verify that the channels are not connected.
  talk_base::Thread::SleepMs(1000);

  EXPECT_FALSE(ep1_ch1()->readable());
  EXPECT_FALSE(ep1_ch1()->writable());
  EXPECT_FALSE(ep2_ch1()->readable());
  EXPECT_FALSE(ep2_ch1()->writable());

  DestroyChannels();
}

// Test that a peer behind NAT can connect to a peer that has
// incoming_only flag set.
TEST_F(P2PTransportChannelTest, IncomingOnlyOpen) {
  ConfigureEndpoints(OPEN, NAT_FULL_CONE);

  CreateChannels();
  ep1_ch1()->set_incoming_only(true);

  EXPECT_TRUE_WAIT_MARGIN(ep1_ch1() != NULL && ep2_ch1() != NULL &&
                          ep1_ch1()->readable() && ep1_ch1()->writable() &&
                          ep2_ch1()->readable() && ep2_ch1()->writable(),
                          1000, 1000);

  DestroyChannels();
}

// Test what happens when we have 2 users behind the same NAT. This can lead
// to interesting behavior because the STUN server will only give out the
// address of the outermost NAT.
class P2PTransportChannelSameNatTest : public P2PTransportChannelTestBase {
 protected:
  void ConfigureEndpoints(Config nat_type, Config config1, Config config2) {
    ASSERT(nat_type >= NAT_FULL_CONE && nat_type <= NAT_SYMMETRIC);
    talk_base::NATSocketServer::Translator* outer_nat =
        nat()->AddTranslator(kPublicAddrs[0], kNatAddrs[0],
            static_cast<talk_base::NATType>(nat_type - NAT_FULL_CONE));
    ConfigureEndpoint(outer_nat, 0, config1);
    ConfigureEndpoint(outer_nat, 1, config2);
  }
  void ConfigureEndpoint(talk_base::NATSocketServer::Translator* nat,
                         int endpoint, Config config) {
    ASSERT(config <= NAT_SYMMETRIC);
    if (config == OPEN) {
      AddAddress(endpoint, kPrivateAddrs[endpoint]);
      nat->AddClient(kPrivateAddrs[endpoint]);
    } else {
      AddAddress(endpoint, kCascadedPrivateAddrs[endpoint]);
      nat->AddTranslator(kPrivateAddrs[endpoint], kCascadedNatAddrs[endpoint],
          static_cast<talk_base::NATType>(config - NAT_FULL_CONE))->AddClient(
              kCascadedPrivateAddrs[endpoint]);
    }
  }
};

TEST_F(P2PTransportChannelSameNatTest, TestConesBehindSameCone) {
  ConfigureEndpoints(NAT_FULL_CONE, NAT_FULL_CONE, NAT_FULL_CONE);
  Test(kLocalUdpToStunUdp);
}

// Test what happens when we have multiple available pathways.
// In the future we will try different RTTs and configs for the different
// interfaces, so that we can simulate a user with Ethernet and VPN networks.
class P2PTransportChannelMultihomedTest : public P2PTransportChannelTestBase {
};

// Test that we can establish connectivity when both peers are multihomed.
TEST_F(P2PTransportChannelMultihomedTest, TestBasic) {
  AddAddress(0, kPublicAddrs[0]);
  AddAddress(0, kAlternateAddrs[0]);
  AddAddress(1, kPublicAddrs[1]);
  AddAddress(1, kAlternateAddrs[1]);
  Test(kLocalUdpToLocalUdp);
}

// Test that we can quickly switch links if an interface goes down.
TEST_F(P2PTransportChannelMultihomedTest, TestFailover) {
  AddAddress(0, kPublicAddrs[0]);
  AddAddress(1, kPublicAddrs[1]);
  AddAddress(1, kAlternateAddrs[1]);
  // Use only local ports for simplicity.
  SetAllocatorFlags(0, kOnlyLocalPorts);
  SetAllocatorFlags(1, kOnlyLocalPorts);

  // Create channels and let them go writable, as usual.
  CreateChannels();
  EXPECT_TRUE_WAIT(ep1_ch1()->readable() && ep1_ch1()->writable() &&
                   ep2_ch1()->readable() && ep2_ch1()->writable(),
                   1000);
  EXPECT_TRUE(
      ep1_ch1()->best_connection() && ep2_ch1()->best_connection() &&
      LocalCandidate(ep1_ch1())->address().EqualIPs(kPublicAddrs[0]) &&
      RemoteCandidate(ep1_ch1())->address().EqualIPs(kPublicAddrs[1]));

  // Blackhole any traffic to or from the public addrs.
  LOG(LS_INFO) << "Failing over...";
  fw()->AddRule(false, talk_base::FP_ANY, talk_base::FD_ANY,
                kPublicAddrs[1]);

  // We should detect loss of connectivity within 5 seconds or so.
  EXPECT_TRUE_WAIT(!ep1_ch1()->writable(), 7000);

  // We should switch over to use the alternate addr immediately
  // when we lose writability.
  EXPECT_TRUE_WAIT(
      ep1_ch1()->best_connection() && ep2_ch1()->best_connection() &&
      LocalCandidate(ep1_ch1())->address().EqualIPs(kPublicAddrs[0]) &&
      RemoteCandidate(ep1_ch1())->address().EqualIPs(kAlternateAddrs[1]),
      3000);

  DestroyChannels();
}

// Test that we can switch links in a coordinated fashion.
TEST_F(P2PTransportChannelMultihomedTest, TestDrain) {
  AddAddress(0, kPublicAddrs[0]);
  AddAddress(1, kPublicAddrs[1]);
  // Use only local ports for simplicity.
  SetAllocatorFlags(0, kOnlyLocalPorts);
  SetAllocatorFlags(1, kOnlyLocalPorts);

  // Create channels and let them go writable, as usual.
  CreateChannels();
  EXPECT_TRUE_WAIT(ep1_ch1()->readable() && ep1_ch1()->writable() &&
                   ep2_ch1()->readable() && ep2_ch1()->writable(),
                   1000);
  EXPECT_TRUE(
      ep1_ch1()->best_connection() && ep2_ch1()->best_connection() &&
      LocalCandidate(ep1_ch1())->address().EqualIPs(kPublicAddrs[0]) &&
      RemoteCandidate(ep1_ch1())->address().EqualIPs(kPublicAddrs[1]));

  // Remove the public interface, add the alternate interface, and allocate
  // a new generation of candidates for the new interface (via Connect()).
  LOG(LS_INFO) << "Draining...";
  AddAddress(1, kAlternateAddrs[1]);
  RemoveAddress(1, kPublicAddrs[1]);
  ep2_ch1()->Connect();

  // We should switch over to use the alternate address after
  // an exchange of pings.
  EXPECT_TRUE_WAIT(
      ep1_ch1()->best_connection() && ep2_ch1()->best_connection() &&
      LocalCandidate(ep1_ch1())->address().EqualIPs(kPublicAddrs[0]) &&
      RemoteCandidate(ep1_ch1())->address().EqualIPs(kAlternateAddrs[1]),
      3000);

  DestroyChannels();
}

TEST_F(P2PTransportChannelTest, TestBundleAllocatorToBundleAllocator) {
  AddAddress(0, kPublicAddrs[0]);
  AddAddress(1, kPublicAddrs[1]);
  SetAllocatorFlags(0, cricket::PORTALLOCATOR_ENABLE_BUNDLE);
  SetAllocatorFlags(1, cricket::PORTALLOCATOR_ENABLE_BUNDLE);

  CreateChannels();

  EXPECT_TRUE_WAIT(ep1_ch1()->readable() &&
                   ep1_ch1()->writable() &&
                   ep2_ch1()->readable() &&
                   ep2_ch1()->writable(),
                   1000);
  EXPECT_TRUE(ep1_ch1()->best_connection() &&
              ep2_ch1()->best_connection());

  EXPECT_FALSE(ep1_ch2()->readable());
  EXPECT_FALSE(ep1_ch2()->writable());
  EXPECT_FALSE(ep2_ch2()->readable());
  EXPECT_FALSE(ep2_ch2()->writable());

  TestSendRecv(1);  // Only 1 channel is writable per Endpoint.
  DestroyChannels();
}

TEST_F(P2PTransportChannelTest, TestBundleAllocatorToNonBundleAllocator) {
  AddAddress(0, kPublicAddrs[0]);
  AddAddress(1, kPublicAddrs[1]);
  // Enable BUNDLE flag at one side.
  SetAllocatorFlags(0, cricket::PORTALLOCATOR_ENABLE_BUNDLE);

  CreateChannels();

  EXPECT_TRUE_WAIT(ep1_ch1()->readable() &&
                   ep1_ch1()->writable() &&
                   ep2_ch1()->readable() &&
                   ep2_ch1()->writable(),
                   1000);
  EXPECT_TRUE_WAIT(ep1_ch2()->readable() &&
                   ep1_ch2()->writable() &&
                   ep2_ch2()->readable() &&
                   ep2_ch2()->writable(),
                   1000);

  EXPECT_TRUE(ep1_ch1()->best_connection() &&
              ep2_ch1()->best_connection());
  EXPECT_TRUE(ep1_ch2()->best_connection() &&
              ep2_ch2()->best_connection());

  TestSendRecv(2);
  DestroyChannels();
}
