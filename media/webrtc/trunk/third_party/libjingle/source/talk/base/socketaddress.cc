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

#ifdef POSIX
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/ip.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>
#endif

#include <sstream>

#include "talk/base/byteorder.h"
#include "talk/base/common.h"
#include "talk/base/logging.h"
#include "talk/base/nethelpers.h"
#include "talk/base/socketaddress.h"

#ifdef WIN32
// Win32 doesn't provide inet_aton, so we add our own version here.
// Since inet_addr returns 0xFFFFFFFF on error, if we get this value
// we need to test the input to see if the address really was 255.255.255.255.
// This is slightly fragile, but better than doing nothing.
int inet_aton(const char* cp, struct in_addr* inp) {
  inp->s_addr = inet_addr(cp);
  return (inp->s_addr == INADDR_NONE &&
          strcmp(cp, "255.255.255.255") != 0) ? 0 : 1;
}
#endif  // WIN32

namespace talk_base {

SocketAddress::SocketAddress() {
  Clear();
}

SocketAddress::SocketAddress(const std::string& hostname, int port) {
  SetIP(hostname);
  SetPort(port);
}

SocketAddress::SocketAddress(uint32 ip, int port) {
  SetIP(ip);
  SetPort(port);
}

SocketAddress::SocketAddress(const SocketAddress& addr) {
  this->operator=(addr);
}

void SocketAddress::Clear() {
  hostname_.clear();
  ip_ = 0;
  port_ = 0;
}

bool SocketAddress::IsNil() const {
  return hostname_.empty() && (0 == ip_) && (0 == port_);
}

bool SocketAddress::IsComplete() const {
  return (0 != ip_) && (0 != port_);
}

SocketAddress& SocketAddress::operator=(const SocketAddress& addr) {
  hostname_ = addr.hostname_;
  ip_ = addr.ip_;
  port_ = addr.port_;
  return *this;
}

void SocketAddress::SetIP(uint32 ip) {
  hostname_.clear();
  ip_ = ip;
}

void SocketAddress::SetIP(const std::string& hostname) {
  hostname_ = hostname;
  ip_ = StringToIP(hostname);
}

void SocketAddress::SetResolvedIP(uint32 ip) {
  ip_ = ip;
}

void SocketAddress::SetPort(int port) {
  ASSERT((0 <= port) && (port < 65536));
  port_ = port;
}

uint32 SocketAddress::ip() const {
  return ip_;
}

uint16 SocketAddress::port() const {
  return port_;
}

std::string SocketAddress::IPAsString() const {
  if (!hostname_.empty())
    return hostname_;
  return IPToString(ip_);
}

std::string SocketAddress::PortAsString() const {
  std::ostringstream ost;
  ost << port_;
  return ost.str();
}

std::string SocketAddress::ToString() const {
  std::ostringstream ost;
  ost << IPAsString();
  ost << ":";
  ost << port();
  return ost.str();
}

bool SocketAddress::FromString(const std::string& str) {
  std::string::size_type pos = str.find(':');
  if (std::string::npos == pos)
    return false;
  SetPort(strtoul(str.substr(pos + 1).c_str(), NULL, 10));
  SetIP(str.substr(0, pos));
  return true;
}

std::ostream& operator<<(std::ostream& os, const SocketAddress& addr) {
  os << addr.IPAsString() << ":" << addr.port();
  return os;
}

bool SocketAddress::IsAnyIP() const {
  return (ip_ == 0);
}

bool SocketAddress::IsLoopbackIP() const {
  if (0 == ip_) {
    return (0 == stricmp(hostname_.c_str(), "localhost"));
  } else {
    return ((ip_ >> 24) == 127);
  }
}

bool SocketAddress::IsLocalIP() const {
  if (IsLoopbackIP())
    return true;

  std::vector<uint32> ips;
  if (0 == ip_) {
    if (!hostname_.empty()
        && (0 == stricmp(hostname_.c_str(), GetHostname().c_str()))) {
      return true;
    }
  } else if (GetLocalIPs(ips)) {
    for (size_t i = 0; i < ips.size(); ++i) {
      if (ips[i] == ip_) {
        return true;
      }
    }
  }
  return false;
}

bool SocketAddress::IsPrivateIP() const {
  return ((ip_ >> 24) == 127) ||
         ((ip_ >> 24) == 10) ||
         ((ip_ >> 20) == ((172 << 4) | 1)) ||
         ((ip_ >> 16) == ((192 << 8) | 168)) ||
         ((ip_ >> 16) == ((169 << 8) | 254));
}

bool SocketAddress::IsUnresolvedIP() const {
  return IsAny() && !hostname_.empty();
}

bool SocketAddress::ResolveIP(bool force, int* error) {
  if (hostname_.empty()) {
    // nothing to resolve
  } else if (!force && !IsAny()) {
    // already resolved
  } else {
    LOG_F(LS_VERBOSE) << "(" << hostname_ << ")";
    int errcode = 0;
    if (hostent* pHost = SafeGetHostByName(hostname_.c_str(), &errcode)) {
      ip_ = NetworkToHost32(*reinterpret_cast<uint32*>(pHost->h_addr_list[0]));
      LOG_F(LS_VERBOSE) << "(" << hostname_ << ") resolved to: "
                        << IPToString(ip_);
      FreeHostEnt(pHost);
    } else {
      LOG_F(LS_ERROR) << "(" << hostname_ << ") err: " << errcode;
    }
    if (error) {
      *error = errcode;
    }
  }
  return (ip_ != 0);
}

bool SocketAddress::operator==(const SocketAddress& addr) const {
  return EqualIPs(addr) && EqualPorts(addr);
}

bool SocketAddress::operator<(const SocketAddress& addr) const {
  if (ip_ < addr.ip_)
    return true;
  else if (addr.ip_ < ip_)
    return false;

  // We only check hostnames if both IPs are zero.  This matches EqualIPs()
  if (addr.ip_ == 0) {
    if (hostname_ < addr.hostname_)
      return true;
    else if (addr.hostname_ < hostname_)
      return false;
  }

  return port_ < addr.port_;
}

bool SocketAddress::EqualIPs(const SocketAddress& addr) const {
  return (ip_ == addr.ip_) && ((ip_ != 0) || (hostname_ == addr.hostname_));
}

bool SocketAddress::EqualPorts(const SocketAddress& addr) const {
  return (port_ == addr.port_);
}

size_t SocketAddress::Hash() const {
  size_t h = 0;
  h ^= ip_;
  h ^= port_ | (port_ << 16);
  return h;
}

size_t SocketAddress::Size_() const {
  return sizeof(ip_) + sizeof(port_) + 2;
}

bool SocketAddress::Write_(char* buf, int len) const {
  if (len < static_cast<int>(Size_()))
    return false;
  buf[0] = 0;
  buf[1] = AF_INET;
  SetBE16(buf + 2, port_);
  SetBE32(buf + 4, ip_);
  return true;
}

bool SocketAddress::Read_(const char* buf, int len) {
  if (len < static_cast<int>(Size_()) || buf[1] != AF_INET)
    return false;
  port_ = GetBE16(buf + 2);
  ip_ = GetBE32(buf + 4);
  return true;
}

void SocketAddress::ToSockAddr(sockaddr_in* saddr) const {
  memset(saddr, 0, sizeof(*saddr));
  saddr->sin_family = AF_INET;
  saddr->sin_port = HostToNetwork16(port_);
  if (0 == ip_) {
    saddr->sin_addr.s_addr = INADDR_ANY;
  } else {
    saddr->sin_addr.s_addr = HostToNetwork32(ip_);
  }
}

bool SocketAddress::FromSockAddr(const sockaddr_in& saddr) {
  if (saddr.sin_family != AF_INET)
    return false;
  SetIP(NetworkToHost32(saddr.sin_addr.s_addr));
  SetPort(NetworkToHost16(saddr.sin_port));
  return true;
}

std::string SocketAddress::IPToString(uint32 ip) {
  std::ostringstream ost;
  ost << ((ip >> 24) & 0xff);
  ost << '.';
  ost << ((ip >> 16) & 0xff);
  ost << '.';
  ost << ((ip >> 8) & 0xff);
  ost << '.';
  ost << ((ip >> 0) & 0xff);
  return ost.str();
}

bool SocketAddress::StringToIP(const std::string& hostname, uint32* ip) {
  in_addr addr;
  if (inet_aton(hostname.c_str(), &addr) == 0)
    return false;
  *ip = NetworkToHost32(addr.s_addr);
  return true;
}

uint32 SocketAddress::StringToIP(const std::string& hostname) {
  uint32 ip = 0;
  StringToIP(hostname, &ip);
  return ip;
}

std::string SocketAddress::GetHostname() {
  char hostname[256];
  if (gethostname(hostname, ARRAY_SIZE(hostname)) == 0)
    return hostname;
  return "";
}

bool SocketAddress::GetLocalIPs(std::vector<uint32>& ips) {
  ips.clear();

  const std::string hostname = GetHostname();
  if (hostname.empty())
    return false;

  int errcode;
  if (hostent* pHost = SafeGetHostByName(hostname.c_str(), &errcode)) {
    for (size_t i = 0; pHost->h_addr_list[i]; ++i) {
      uint32 ip =
        NetworkToHost32(*reinterpret_cast<uint32 *>(pHost->h_addr_list[i]));
      ips.push_back(ip);
    }
    FreeHostEnt(pHost);
    return !ips.empty();
  }
  LOG(LS_ERROR) << "gethostbyname err: " << errcode;
  return false;
}

}  // namespace talk_base
