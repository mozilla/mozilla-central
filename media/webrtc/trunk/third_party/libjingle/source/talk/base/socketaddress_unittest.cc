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
#include <netinet/in.h>  // for sockaddr_in
#endif

#include "talk/base/gunit.h"
#include "talk/base/socketaddress.h"

namespace talk_base {

TEST(SocketAddressTest, TestDefaultCtor) {
  SocketAddress addr;
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0U, addr.ip());
  EXPECT_EQ(0, addr.port());
  EXPECT_EQ("", addr.hostname());
  EXPECT_EQ("0.0.0.0:0", addr.ToString());
}

TEST(SocketAddressTest, TestIPPortCtor) {
  SocketAddress addr(0x01020304, 5678);
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestStringPortCtor) {
  SocketAddress addr("1.2.3.4", 5678);
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("1.2.3.4", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestSpecialStringPortCtor) {
  // inet_addr doesn't handle this address properly.
  SocketAddress addr("255.255.255.255", 5678);
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0xFFFFFFFFU, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("255.255.255.255", addr.hostname());
  EXPECT_EQ("255.255.255.255:5678", addr.ToString());
}

TEST(SocketAddressTest, TestHostnamePortCtor) {
  SocketAddress addr("a.b.com", 5678);
  EXPECT_TRUE(addr.IsUnresolvedIP());
  EXPECT_EQ(0U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("a.b.com", addr.hostname());
  EXPECT_EQ("a.b.com:5678", addr.ToString());
}

TEST(SocketAddressTest, TestCopyCtor) {
  SocketAddress from("1.2.3.4", 5678);
  SocketAddress addr(from);
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("1.2.3.4", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestAssign) {
  SocketAddress from("1.2.3.4", 5678);
  SocketAddress addr(0x88888888, 9999);
  addr = from;
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("1.2.3.4", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestSetIPPort) {
  SocketAddress addr(0x88888888, 9999);
  addr.SetIP(0x01020304);
  addr.SetPort(5678);
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestSetIPFromString) {
  SocketAddress addr(0x88888888, 9999);
  addr.SetIP("1.2.3.4");
  addr.SetPort(5678);
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("1.2.3.4", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestSetIPFromHostname) {
  SocketAddress addr(0x88888888, 9999);
  addr.SetIP("a.b.com");
  addr.SetPort(5678);
  EXPECT_TRUE(addr.IsUnresolvedIP());
  EXPECT_EQ(0U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("a.b.com", addr.hostname());
  EXPECT_EQ("a.b.com:5678", addr.ToString());
  addr.SetResolvedIP(0x01020304);
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ("a.b.com", addr.hostname());
  EXPECT_EQ("a.b.com:5678", addr.ToString());
}

TEST(SocketAddressTest, TestFromString) {
  SocketAddress addr;
  EXPECT_TRUE(addr.FromString("1.2.3.4:5678"));
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("1.2.3.4", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestFromHostname) {
  SocketAddress addr;
  EXPECT_TRUE(addr.FromString("a.b.com:5678"));
  EXPECT_TRUE(addr.IsUnresolvedIP());
  EXPECT_EQ(0U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("a.b.com", addr.hostname());
  EXPECT_EQ("a.b.com:5678", addr.ToString());
}

TEST(SocketAddressTest, TestToFromSockAddr) {
  SocketAddress from("1.2.3.4", 5678), addr;
  sockaddr_in addr_in;
  from.ToSockAddr(&addr_in);
  EXPECT_TRUE(addr.FromSockAddr(addr_in));
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestToFromBuffer) {
  SocketAddress from("1.2.3.4", 5678), addr;
  char buf[8];
  EXPECT_TRUE(from.Write_(buf, sizeof(buf)));
  EXPECT_TRUE(addr.Read_(buf, sizeof(buf)));
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_EQ(0x01020304U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("", addr.hostname());
  EXPECT_EQ("1.2.3.4:5678", addr.ToString());
}

TEST(SocketAddressTest, TestGoodResolve) {
  SocketAddress addr("localhost", 5678);
  int error;
  EXPECT_TRUE(addr.IsUnresolvedIP());
  EXPECT_TRUE(addr.ResolveIP(false, &error));
  EXPECT_EQ(0, error);
  EXPECT_FALSE(addr.IsUnresolvedIP());
  EXPECT_TRUE(addr.IsLoopbackIP());
  EXPECT_EQ(0x7F000001U, addr.ip());
  EXPECT_EQ(5678, addr.port());
  EXPECT_EQ("localhost", addr.hostname());
  EXPECT_EQ("localhost:5678", addr.ToString());
}

TEST(SocketAddressTest, TestBadResolve) {
  SocketAddress addr("address.bad", 5678);
  int error;
  EXPECT_TRUE(addr.IsUnresolvedIP());
  EXPECT_FALSE(addr.ResolveIP(false, &error));
  EXPECT_NE(0, error);
  EXPECT_TRUE(addr.IsUnresolvedIP());
}

}  // namespace talk_base
