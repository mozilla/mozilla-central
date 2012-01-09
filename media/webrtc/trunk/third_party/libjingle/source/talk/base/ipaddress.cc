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

#ifdef POSIX
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#ifdef OPENBSD
#include <netinet/in_systm.h>
#endif
#include <netinet/ip.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>
#endif

#include <stdio.h>

#include "talk/base/ipaddress.h"
#include "talk/base/nethelpers.h"
#include "talk/base/logging.h"
#include "talk/base/win32.h"

namespace talk_base {

static const unsigned char kMappedPrefix[] = {0x00, 0x00, 0x00, 0x00,
                                              0x00, 0x00, 0x00, 0x00,
                                              0x00, 0x00, 0xFF, 0xFF};
static bool IsPrivateV4(uint32 ip);
static bool IsMappedAddress(const in6_addr& addr);
static in_addr ExtractMappedAddress(const in6_addr& addr);

uint32 IPAddress::v4AddressAsHostOrderInteger() const {
  if (family_ == AF_INET) {
    return ntohl(u_.ip4.s_addr);
  } else {
    return 0;
  }
}

size_t IPAddress::Size() const {
  switch (family_) {
    case AF_INET:
      return sizeof(in_addr);
    case AF_INET6:
      return sizeof(in6_addr);
  }
  return 0;
}


bool IPAddress::operator==(const IPAddress &other) const {
  if (family_ != other.family_) {
    return false;
  }
  if (family_ == AF_INET) {
    return memcmp(&u_.ip4, &other.u_.ip4, sizeof(u_.ip4)) == 0;
  }
  if (family_ == AF_INET6) {
    return memcmp(&u_.ip6, &other.u_.ip6, sizeof(u_.ip6)) == 0;
  }
  return family_ == AF_UNSPEC;
}

bool IPAddress::operator!=(const IPAddress &other) const {
  return !((*this) == other);
}

bool IPAddress::operator >(const IPAddress &other) const {
  return (*this) != other && !((*this) < other);
}

bool IPAddress::operator <(const IPAddress &other) const {
  // IPv4 is 'less than' IPv6
  if (family_ != other.family_) {
    if (family_ == AF_UNSPEC) {
      return true;
    }
    if (family_ == AF_INET && other.family_ == AF_INET6) {
      return true;
    }
    return false;
  }
  // Comparing addresses of the same family.
  switch (family_) {
    case AF_INET: {
      return ntohl(u_.ip4.s_addr) < ntohl(other.u_.ip4.s_addr);
    }
    case AF_INET6: {
      return memcmp(&u_.ip6.s6_addr, &other.u_.ip6.s6_addr, 16) < 0;
    }
  }
  // Catches AF_UNSPEC and invalid addresses.
  return false;
}

std::ostream& operator<<(std::ostream& os, const IPAddress& ip) {
  os << ip.ToString();
  return os;
}

in6_addr IPAddress::ipv6_address() const {
  return u_.ip6;
}

in_addr IPAddress::ipv4_address() const {
  return u_.ip4;
}

std::string IPAddress::ToString() const {
  if (family_ != AF_INET && family_ != AF_INET6) {
    return std::string();
  }
  char buf[INET6_ADDRSTRLEN] = {0};
  const void* src = &u_.ip4;
  if (family_ == AF_INET6) {
    src = &u_.ip6;
  }
  if (!talk_base::inet_ntop(family_, src, buf, sizeof(buf))) {
    return std::string();
  }
  return std::string(buf);
}

IPAddress IPAddress::Normalized() const {
  if (family_ != AF_INET6) {
    return *this;
  }
  if (!IsMappedAddress(u_.ip6)) {
    return *this;
  }
  in_addr addr = ExtractMappedAddress(u_.ip6);
  return IPAddress(addr);
}

IPAddress IPAddress::AsIPv6Address() const {
  if (family_ != AF_INET) {
    return *this;
  }
  //  uint32 v4 = (u_.ip4.s_addr);
  in6_addr v6addr;
  ::memcpy(&v6addr.s6_addr, kMappedPrefix, sizeof(kMappedPrefix));
  ::memcpy(&v6addr.s6_addr[12], &u_.ip4.s_addr, sizeof(u_.ip4.s_addr));
  return IPAddress(v6addr);
}

bool IsPrivateV4(uint32 ip_in_host_order) {
  return ((ip_in_host_order >> 24) == 127) ||
      ((ip_in_host_order >> 24) == 10) ||
      ((ip_in_host_order >> 20) == ((172 << 4) | 1)) ||
      ((ip_in_host_order >> 16) == ((192 << 8) | 168)) ||
      ((ip_in_host_order >> 16) == ((169 << 8) | 254));
}

bool IsMappedAddress(const in6_addr& addr) {
  return memcmp(&(addr.s6_addr), kMappedPrefix, sizeof(kMappedPrefix)) == 0;
}

in_addr ExtractMappedAddress(const in6_addr& in6) {
  in_addr ipv4;
  ::memcpy(&ipv4.s_addr, &in6.s6_addr[12], sizeof(ipv4.s_addr));
  return ipv4;
}

bool IPFromHostEnt(hostent* host_ent, IPAddress* out) {
  return IPFromHostEnt(host_ent, 0, out);
}

bool IPFromHostEnt(hostent* host_ent, int idx, IPAddress* out) {
  if (!out || (idx < 0)) {
    return false;
  }
  char** requested_address = host_ent->h_addr_list;
  // Find the idx-th element (while checking for null, which terminates the
  // list of addresses).
  while (*requested_address && idx) {
    idx--;
    requested_address++;
  }
  if (!(*requested_address)) {
    return false;
  }

  if (host_ent->h_addrtype == AF_INET) {
    in_addr ip;
    ip.s_addr = *reinterpret_cast<uint32*>(*requested_address);
    *out = IPAddress(ip);
    return true;
  } else if (host_ent->h_addrtype == AF_INET6) {
    in6_addr ip;
    ::memcpy(&ip.s6_addr, *requested_address, host_ent->h_length);
    *out = IPAddress(ip);
    return true;
  }
  return false;
}

bool IPFromString(const std::string& str, IPAddress* out) {
  if (!out) {
    return false;
  }
  in_addr addr;
  if (talk_base::inet_pton(AF_INET, str.c_str(), &addr) == 0) {
    in6_addr addr6;
    if (talk_base::inet_pton(AF_INET6, str.c_str(), &addr6) == 0) {
      *out = IPAddress();
      return false;
    }
    *out = IPAddress(addr6);
  } else {
    *out = IPAddress(addr);
  }
  return true;
}

bool IPIsAny(const IPAddress& ip) {
  static const IPAddress kIPv4Any(INADDR_ANY);
  static const IPAddress kIPv6Any(in6addr_any);
  switch (ip.family()) {
    case AF_INET:
      return ip == kIPv4Any;
    case AF_INET6:
      return ip == kIPv6Any;
    case AF_UNSPEC:
      return false;
  }
  return false;
}

bool IPIsLoopback(const IPAddress& ip) {
  static const IPAddress kIPv4Loopback(INADDR_LOOPBACK);
  static const IPAddress kIPv6Loopback(in6addr_loopback);
  switch (ip.family()) {
    case AF_INET: {
      return ip == kIPv4Loopback;
    }
    case AF_INET6: {
      return ip == kIPv6Loopback;
    }
  }
  return false;
}

bool IPIsPrivate(const IPAddress& ip) {
  switch (ip.family()) {
    case AF_INET: {
      return IsPrivateV4(ip.v4AddressAsHostOrderInteger());
    }
    case AF_INET6: {
      in6_addr v6 = ip.ipv6_address();
      return (v6.s6_addr[0] == 0xFE && v6.s6_addr[1] == 0x80) ||
          IPIsLoopback(ip);
    }
  }
  return false;
}

size_t HashIP(const IPAddress& ip) {
  switch (ip.family()) {
    case AF_INET: {
      return ip.ipv4_address().s_addr;
    }
    case AF_INET6: {
      in6_addr v6addr = ip.ipv6_address();
      const uint32* v6_as_ints =
          reinterpret_cast<const uint32*>(&v6addr.s6_addr);
      return v6_as_ints[0] ^ v6_as_ints[1] ^ v6_as_ints[2] ^ v6_as_ints[3];
    }
  }
  return 0;
}
}  // Namespace talk base
