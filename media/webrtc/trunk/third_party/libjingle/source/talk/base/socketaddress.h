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

#ifndef TALK_BASE_SOCKETADDRESS_H_
#define TALK_BASE_SOCKETADDRESS_H_

#include <string>
#include <vector>
#include <iosfwd>
#include "talk/base/basictypes.h"
#undef SetPort

struct sockaddr_in;

namespace talk_base {

// Records an IP address and port, which are 32 and 16 bit integers,
// respectively, both in <b>host byte-order</b>.
class SocketAddress {
 public:
  // Creates a nil address.
  SocketAddress();

  // Creates the address with the given host and port.  If use_dns is true,
  // the hostname will be immediately resolved to an IP (which may block for
  // several seconds if DNS is not available).  Alternately, set use_dns to
  // false, and then call Resolve() to complete resolution later, or use
  // SetResolvedIP to set the IP explictly.
  SocketAddress(const std::string& hostname, int port);

  // Creates the address with the given IP and port.
  SocketAddress(uint32 ip, int port);

  // Creates a copy of the given address.
  SocketAddress(const SocketAddress& addr);

  // Resets to the nil address.
  void Clear();

  // Determines if this is a nil address (empty hostname, any IP, null port)
  bool IsNil() const;

  // Returns true if ip and port are set.
  bool IsComplete() const;

  // Replaces our address with the given one.
  SocketAddress& operator=(const SocketAddress& addr);

  // Changes the IP of this address to the given one, and clears the hostname.
  void SetIP(uint32 ip);

  // Changes the hostname of this address to the given one.
  // Does not resolve the address; use Resolve to do so.
  void SetIP(const std::string& hostname);

  // Sets the IP address while retaining the hostname.  Useful for bypassing
  // DNS for a pre-resolved IP.
  void SetResolvedIP(uint32 ip);

  // Changes the port of this address to the given one.
  void SetPort(int port);

  // Returns the hostname
  const std::string& hostname() const { return hostname_; }

  // Returns the IP address.
  uint32 ip() const;

  // Returns the port part of this address.
  uint16 port() const;

  // Returns the IP address in dotted form.
  std::string IPAsString() const;

  // Returns the port as a string
  std::string PortAsString() const;

  // Returns hostname:port
  std::string ToString() const;

  // Parses hostname:port
  bool FromString(const std::string& str);

  friend std::ostream& operator<<(std::ostream& os, const SocketAddress& addr);

  // Determines whether this represents a missing / any IP address.  Hostname
  // and/or port may be set.
  bool IsAnyIP() const;
  inline bool IsAny() const { return IsAnyIP(); }  // deprecated

  // Determines whether the IP address refers to a loopback address, i.e. within
  // the range 127.0.0.0/8.
  bool IsLoopbackIP() const;

  // Determines wither the IP address refers to any adapter on the local
  // machine, including the loopback adapter.
  bool IsLocalIP() const;

  // Determines whether the IP address is in one of the private ranges:
  // 127.0.0.0/8 10.0.0.0/8 192.168.0.0/16 172.16.0.0/12.
  bool IsPrivateIP() const;

  // Determines whether the hostname has been resolved to an IP.
  bool IsUnresolvedIP() const;
  inline bool IsUnresolved() const { return IsUnresolvedIP(); }  // deprecated

  // Attempt to resolve a hostname to IP address.
  // Returns false if resolution is required but failed, and sets error.
  // 'force' will cause re-resolution of hostname.
  bool ResolveIP(bool force = false, int* error = NULL);

  // Determines whether this address is identical to the given one.
  bool operator ==(const SocketAddress& addr) const;
  inline bool operator !=(const SocketAddress& addr) const {
    return !this->operator ==(addr);
  }

  // Compares based on IP and then port.
  bool operator <(const SocketAddress& addr) const;

  // Determines whether this address has the same IP as the one given.
  bool EqualIPs(const SocketAddress& addr) const;

  // Determines whether this address has the same port as the one given.
  bool EqualPorts(const SocketAddress& addr) const;

  // Hashes this address into a small number.
  size_t Hash() const;

  // Returns the size of this address when written.
  size_t Size_() const;

  // Writes this address into the given buffer, according to RFC 3489.
  bool Write_(char* buf, int len) const;

  // Reads this address from the given buffer, according to RFC 3489.
  bool Read_(const char* buf, int len);

  // Write this address to a sockaddr_in.
  void ToSockAddr(sockaddr_in* saddr) const;

  // Read this address from a sockaddr_in.
  bool FromSockAddr(const sockaddr_in& saddr);

  // Converts the IP address given in compact form into dotted form.
  static std::string IPToString(uint32 ip);

  // Converts the IP address given in dotted form into compact form.
  // Only dotted names (A.B.C.D) are resolved.
  static bool StringToIP(const std::string& str, uint32* ip);
  static uint32 StringToIP(const std::string& str);  // deprecated

  // Get local machine's hostname
  static std::string GetHostname();

  // Get a list of the local machine's ip addresses
  static bool GetLocalIPs(std::vector<uint32>& ips);

 private:
  std::string hostname_;
  uint32 ip_;
  uint16 port_;
};

}  // namespace talk_base

#endif  // TALK_BASE_SOCKETADDRESS_H_
