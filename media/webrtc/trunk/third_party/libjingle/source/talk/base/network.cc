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

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "talk/base/network.h"

#ifdef POSIX
#include <sys/socket.h>
#include <sys/utsname.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <unistd.h>
#include <errno.h>
#endif  // POSIX

#ifdef WIN32
#include "talk/base/win32.h"
#include <Iphlpapi.h>
#endif

#include <algorithm>
#include <cstdio>

#include "talk/base/host.h"
#include "talk/base/logging.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/socket.h"  // includes something that makes windows happy
#include "talk/base/stream.h"
#include "talk/base/thread.h"

namespace talk_base {

namespace {

const uint32 kUpdateNetworksMessage = 1;

// Fetch list of networks every two seconds.
const int kNetworksUpdateIntervalMs = 2000;

#ifdef POSIX
// Gets the default gateway for the specified interface.
uint32 GetDefaultGateway(const std::string& name) {
#ifdef OSX
  // TODO: /proc/net/route doesn't exist,
  // Use ioctl to get the routing table
  return 0xFFFFFFFF;
#endif

  uint32 gateway_ip = 0;

  talk_base::FileStream fs;
  if (fs.Open("/proc/net/route", "r", NULL)) {
    std::string line;
    while (fs.ReadLine(&line) == talk_base::SR_SUCCESS && gateway_ip == 0) {
      char iface[16];
      unsigned int ip, gw;
      if (sscanf(line.c_str(), "%7s %8X %8X", iface, &ip, &gw) == 3 &&
          name == iface && ip == 0) {
        gateway_ip = ntohl(gw);
      }
    }
  }

  return gateway_ip;
}
#endif  // POSIX

bool CompareNetworks(const Network* a, const Network* b) {
  return a->name() < b->name();
}

}  // namespace

NetworkManager::NetworkManager() {
}

NetworkManager::~NetworkManager() {
}

NetworkManagerBase::NetworkManagerBase() {
}

NetworkManagerBase::~NetworkManagerBase() {
  for (NetworkMap::iterator i = networks_map_.begin();
       i != networks_map_.end(); ++i) {
    delete i->second;
  }
}

void NetworkManagerBase::GetNetworks(NetworkList* result) const {
  *result = networks_;
}

void NetworkManagerBase::MergeNetworkList(const NetworkList& new_networks,
                                          bool force_notification) {
  // Sort the list so that we can detect when it changes.
  NetworkList list(new_networks);
  std::sort(list.begin(), list.end(), CompareNetworks);

  bool changed = false;

  if (networks_.size() != list.size())
    changed = true;

  networks_.resize(list.size());

  for (uint32 i = 0; i < list.size(); ++i) {
    NetworkMap::iterator iter = networks_map_.find(list[i]->name());

    Network* network;
    if (iter == networks_map_.end()) {
      // That's a new network, add it to the map.
      network = list[i];
      networks_map_[network->name()] = network;
    } else {
      network = iter->second;
      if (network->ip() != list[i]->ip()) {
        changed = true;
        network->set_ip(list[i]->ip());
      }

      if (network->gateway_ip() != list[i]->gateway_ip()) {
        changed = true;
        network->set_gateway_ip(list[i]->gateway_ip());
      }

      delete list[i];
    }

    if (!changed && networks_[i]->name() != network->name())
      changed = true;

    networks_[i] = network;
  }

  if (changed || force_notification)
    SignalNetworksChanged();
}

BasicNetworkManager::BasicNetworkManager()
    : thread_(NULL),
      started_(false) {
}

BasicNetworkManager::~BasicNetworkManager() {
}

#ifdef POSIX
bool BasicNetworkManager::CreateNetworks(bool include_ignored,
                                         NetworkList* networks) {
  int fd;
  if ((fd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
    LOG_ERR(LERROR) << "socket";
    return false;
  }

  struct ifconf ifc;
  ifc.ifc_len = 64 * sizeof(struct ifreq);
  ifc.ifc_buf = new char[ifc.ifc_len];

  if (ioctl(fd, SIOCGIFCONF, &ifc) < 0) {
    LOG_ERR(LERROR) << "ioctl";
    return false;
  }
  ASSERT(ifc.ifc_len < static_cast<int>(64 * sizeof(struct ifreq)));

  struct ifreq* ptr = reinterpret_cast<struct ifreq*>(ifc.ifc_buf);
  struct ifreq* end =
      reinterpret_cast<struct ifreq*>(ifc.ifc_buf + ifc.ifc_len);

  while (ptr < end) {
    struct sockaddr_in* inaddr =
        reinterpret_cast<struct sockaddr_in*>(&ptr->ifr_ifru.ifru_addr);
    if (inaddr->sin_family == AF_INET) {
      uint32 ip = ntohl(inaddr->sin_addr.s_addr);
      scoped_ptr<Network> network(
          new Network(ptr->ifr_name, ptr->ifr_name, ip,
                      GetDefaultGateway(ptr->ifr_name)));
      network->set_ignored(IsIgnoredNetwork(*network));
      if (include_ignored || !network->ignored()) {
        networks->push_back(network.release());
      }
    }

#ifdef _SIZEOF_ADDR_IFREQ
    ptr = reinterpret_cast<struct ifreq*>(
        reinterpret_cast<char*>(ptr) + _SIZEOF_ADDR_IFREQ(*ptr));
#else
    ptr++;
#endif
  }

  delete [] ifc.ifc_buf;
  close(fd);
  return true;
}
#endif  // POSIX

#ifdef WIN32
bool BasicNetworkManager::CreateNetworks(bool include_ignored,
                                         NetworkList* networks) {
  IP_ADAPTER_INFO info_temp;
  ULONG len = 0;

  if (GetAdaptersInfo(&info_temp, &len) != ERROR_BUFFER_OVERFLOW)
    // This just means there's zero networks, which is not an error.
    return true;

  scoped_array<char> buf(new char[len]);
  IP_ADAPTER_INFO *infos = reinterpret_cast<IP_ADAPTER_INFO *>(buf.get());
  DWORD ret = GetAdaptersInfo(infos, &len);
  if (ret != NO_ERROR) {
    LOG_ERR_EX(LS_ERROR, ret) << "GetAdaptersInfo failed";
    return false;
  }

  int count = 0;
  for (IP_ADAPTER_INFO *info = infos; info != NULL; info = info->Next) {
    // Ignore the loopback device.
    if (info->Type == MIB_IF_TYPE_LOOPBACK) {
      continue;
    }

    // In non-debug builds, don't transmit the network name because of
    // privacy concerns. Transmit a number instead.
    std::string name;
#ifdef _DEBUG
    name = info->Description;
#else  // !_DEBUG
    std::ostringstream ost;
    ost << count;
    name = ost.str();
    count++;
#endif  // !_DEBUG

    scoped_ptr<Network> network(new Network(name, info->Description,
        SocketAddress::StringToIP(info->IpAddressList.IpAddress.String),
        SocketAddress::StringToIP(info->GatewayList.IpAddress.String)));
    network->set_ignored(IsIgnoredNetwork(*network));
    if (include_ignored || !network->ignored()) {
      networks->push_back(network.release());
    }
  }

  return true;
}
#endif  // WIN32

bool BasicNetworkManager::IsIgnoredNetwork(const Network& network) {
#ifdef POSIX
  // Ignore local networks (lo, lo0, etc)
  // Also filter out VMware interfaces, typically named vmnet1 and vmnet8
  if (strncmp(network.name().c_str(), "lo", 2) == 0 ||
      strncmp(network.name().c_str(), "vmnet", 5) == 0) {
    return true;
  }
#elif defined(WIN32)
  // Ignore any HOST side vmware adapters with a description like:
  // VMware Virtual Ethernet Adapter for VMnet1
  // but don't ignore any GUEST side adapters with a description like:
  // VMware Accelerated AMD PCNet Adapter #2
  if (strstr(network.description().c_str(), "VMnet") != NULL) {
    return true;
  }
#endif

  // Ignore any networks with a 0.x.y.z IP
  return (network.ip() < 0x01000000);
}

void BasicNetworkManager::StartUpdating() {
  if (started_) {
    sent_first_update_ = false;
    return;
  }

  thread_ = Thread::Current();
  started_ = true;
  sent_first_update_ = false;
  thread_->Post(this, kUpdateNetworksMessage);
}

void BasicNetworkManager::StopUpdating() {
  ASSERT(Thread::Current() == thread_);
  started_ = false;
}

void BasicNetworkManager::OnMessage(Message* msg) {
  ASSERT(msg->message_id == kUpdateNetworksMessage);
  DoUpdateNetworks();
}

void BasicNetworkManager::DoUpdateNetworks() {
  if (!started_)
    return;

  ASSERT(Thread::Current() == thread_);

  NetworkList list;
  if (!CreateNetworks(false, &list)) {
    SignalError();
  } else {
    MergeNetworkList(list, !sent_first_update_);
    sent_first_update_ = true;
  }

  thread_->PostDelayed(kNetworksUpdateIntervalMs, this, kUpdateNetworksMessage);
}

void BasicNetworkManager::DumpNetworks(bool include_ignored) {
  NetworkList list;
  CreateNetworks(include_ignored, &list);
  LOG(LS_INFO) << "NetworkManager detected " << list.size() << " networks:";
  for (size_t i = 0; i < list.size(); ++i) {
    const Network* network = list[i];
    if (!network->ignored() || include_ignored) {
      LOG(LS_INFO) << network->ToString() << ": " << network->description()
                   << ", Gateway="
                   << SocketAddress::IPToString(network->gateway_ip())
                   << ((network->ignored()) ? ", Ignored" : "");
    }
  }
}

Network::Network(const std::string& name, const std::string& desc,
                 uint32 ip, uint32 gateway_ip)
    : name_(name), description_(desc), ip_(ip), gateway_ip_(gateway_ip),
      ignored_(false), uniform_numerator_(0), uniform_denominator_(0),
      exponential_numerator_(0), exponential_denominator_(0) {
}

std::string Network::ToString() const {
  std::stringstream ss;
  // Print out the first space-terminated token of the network desc, plus
  // the IP address.
  ss << "Net[" << description_.substr(0, description_.find(' '))
     << ":" << SocketAddress::IPToString(ip_) << "]";
  return ss.str();
}

}  // namespace talk_base
