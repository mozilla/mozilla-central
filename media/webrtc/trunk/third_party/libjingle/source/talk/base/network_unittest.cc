/*
 * libjingle
 * Copyright 2004--2011, Google Inc.
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

#include <vector>
#include "talk/base/gunit.h"
#include "talk/base/network.h"

namespace talk_base {

// A network that should not be ignored.
static const Network kNetwork1("test1", "Test Network Adapter 1",
                               IPAddress(0x12345678));
// A network that should be ignored (IP is 0.1.0.4).
static const Network kNetwork2("test2", "Test Network Adapter 2",
                               IPAddress(0x00010004));

class NetworkTest : public testing::Test, public sigslot::has_slots<>  {
 public:
  NetworkTest()
      : callback_called_(false) {
  }

  void OnNetworksChanged() {
    callback_called_ = true;
  }

  void MergeNetworkList(BasicNetworkManager& network_manager,
                        const NetworkManager::NetworkList& list,
                        bool force_notification) {
    network_manager.MergeNetworkList(list, force_notification);
  }

  bool IsIgnoredNetwork(const Network& network) {
    return BasicNetworkManager::IsIgnoredNetwork(network);
  }

  NetworkManager::NetworkList GetNetworks(
      const BasicNetworkManager& network_manager, bool include_ignored) {
    NetworkManager::NetworkList list;
    network_manager.CreateNetworks(include_ignored, &list);
    return list;
  }

 protected:
  bool callback_called_;
};

// Test that the Network ctor works properly.
TEST_F(NetworkTest, TestNetworkConstruct) {
  EXPECT_EQ("test1", kNetwork1.name());
  EXPECT_EQ("Test Network Adapter 1", kNetwork1.description());
  EXPECT_EQ(IPAddress(0x12345678U), kNetwork1.ip());
  EXPECT_FALSE(kNetwork1.ignored());
}

// Tests that our ignore function works properly.
TEST_F(NetworkTest, TestNetworkIgnore) {
  EXPECT_FALSE(IsIgnoredNetwork(kNetwork1));
  EXPECT_TRUE(IsIgnoredNetwork(kNetwork2));
}

TEST_F(NetworkTest, TestCreateNetworks) {
  BasicNetworkManager manager;
  NetworkManager::NetworkList result = GetNetworks(manager, true);
  // We should be able to bind to any addresses we find.
  // (Excluding IPv6 link-local for now, as we don't (yet) record scope ids.)
  NetworkManager::NetworkList::iterator it;
  for (it = result.begin();
       it != result.end();
       ++it) {
    sockaddr_storage storage;
    memset(&storage, 0, sizeof(storage));
    IPAddress ip = (*it)->ip();
    // This condition excludes FE80::/16, i.e. IPv6 link-local addresses. These
    // require their scope id to be known. Remove when scope ids are supported.
    if (!(ip.family() == AF_INET6 && IPIsPrivate(ip) && !IPIsLoopback(ip))) {
      SocketAddress bindaddress(ip, 0);
      // TODO: Make this use talk_base::AsyncSocket once it supports IPv6.
      int fd = socket(ip.family(), SOCK_STREAM, IPPROTO_TCP);
      if (fd > 0) {
        size_t ipsize = bindaddress.ToSockAddrStorage(&storage);
        EXPECT_GE(ipsize, 0U);
        int success = ::bind(fd,
                             reinterpret_cast<sockaddr*>(&storage),
                             ipsize);
        EXPECT_EQ(0, success);
#ifdef WIN32
        closesocket(fd);
#else
        close(fd);
#endif
      }
    }
  }
}

// Test that UpdateNetworks succeeds.
TEST_F(NetworkTest, TestUpdateNetworks) {
  BasicNetworkManager manager;
  manager.SignalNetworksChanged.connect(
      static_cast<NetworkTest*>(this), &NetworkTest::OnNetworksChanged);
  manager.StartUpdating();
  Thread::Current()->ProcessMessages(0);
  EXPECT_TRUE(callback_called_);
}

// Verify that MergeNetworkList() merges network lists properly.
TEST_F(NetworkTest, TestMergeNetworkList) {
  BasicNetworkManager manager;
  manager.SignalNetworksChanged.connect(
      static_cast<NetworkTest*>(this), &NetworkTest::OnNetworksChanged);

  // Add kNetwork1 to the list of networks.
  NetworkManager::NetworkList list;
  list.push_back(new Network(kNetwork1));
  callback_called_ = false;
  MergeNetworkList(manager, list, false);
  EXPECT_TRUE(callback_called_);
  list.clear();

  manager.GetNetworks(&list);
  EXPECT_EQ(1U, list.size());
  EXPECT_EQ(kNetwork1.ToString(), list[0]->ToString());
  Network* net1 = list[0];
  list.clear();

  // Replace kNetwork1 with kNetwork2.
  list.push_back(new Network(kNetwork2));
  callback_called_ = false;
  MergeNetworkList(manager, list, false);
  EXPECT_TRUE(callback_called_);
  list.clear();

  manager.GetNetworks(&list);
  EXPECT_EQ(1U, list.size());
  EXPECT_EQ(kNetwork2.ToString(), list[0]->ToString());
  Network* net2 = list[0];
  list.clear();

  // Add Network2 back.
  list.push_back(new Network(kNetwork1));
  list.push_back(new Network(kNetwork2));
  callback_called_ = false;
  MergeNetworkList(manager, list, false);
  EXPECT_TRUE(callback_called_);
  list.clear();

  // Verify that we get previous instances of Network objects.
  manager.GetNetworks(&list);
  EXPECT_EQ(2U, list.size());
  EXPECT_TRUE((net1 == list[0] && net2 == list[1]) ||
              (net1 == list[1] && net2 == list[0]));
  list.clear();

  // Call MergeNetworkList() again and verify that we don't get update
  // notification.
  list.push_back(new Network(kNetwork2));
  list.push_back(new Network(kNetwork1));
  callback_called_ = false;
  MergeNetworkList(manager, list, false);
  EXPECT_FALSE(callback_called_);
  list.clear();

  // Verify that we get previous instances of Network objects.
  manager.GetNetworks(&list);
  EXPECT_EQ(2U, list.size());
  EXPECT_TRUE((net1 == list[0] && net2 == list[1]) ||
              (net1 == list[1] && net2 == list[0]));
  list.clear();
}

// Test that DumpNetworks works.
TEST_F(NetworkTest, TestDumpNetworks) {
  BasicNetworkManager::DumpNetworks(true);
}

}  // namespace talk_base
