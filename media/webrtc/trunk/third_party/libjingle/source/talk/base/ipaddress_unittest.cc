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

#include "talk/base/gunit.h"
#include "talk/base/ipaddress.h"


namespace talk_base {

static const unsigned int kIPv4AddrSize = 4;
static const unsigned int kIPv6AddrSize = 16;
static const unsigned int kIPv4RFC1918Addr = 0xC0A80701;
static const unsigned int kIPv4PublicAddr = 0x01020304;
static const in6_addr kIPv6LinkLocalAddr = {{{0xfe, 0x80, 0x00, 0x00,
                                              0x00, 0x00, 0x00, 0x00,
                                              0xbe, 0x30, 0x5b, 0xff,
                                              0xfe, 0xe5, 0x00, 0xc3}}};
static const in6_addr kIPv6PublicAddr = {{{0x24, 0x01, 0xfa, 0x00,
                                           0x00, 0x04, 0x10, 0x00,
                                           0xbe, 0x30, 0x5b, 0xff,
                                           0xfe, 0xe5, 0x00, 0xc3}}};
static const in6_addr kIPv6CompatAddr = {{{0x00, 0x00, 0x00, 0x00,
                                           0x00, 0x00, 0x00, 0x00,
                                           0x00, 0x00, 0x00, 0x00,
                                           0xfe, 0xe5, 0x00, 0xc3}}};
static const in6_addr kIPv4MappedAnyAddr = {{{0x00, 0x00, 0x00, 0x00,
                                              0x00, 0x00, 0x00, 0x00,
                                              0x00, 0x00, 0xff, 0xff,
                                              0x00, 0x00, 0x00, 0x00}}};
static const in6_addr kIPv4MappedLoopbackAddr = {{{0x00, 0x00, 0x00, 0x00,
                                                   0x00, 0x00, 0x00, 0x00,
                                                   0x00, 0x00, 0xff, 0xff,
                                                   0x7f, 0x00, 0x00, 0x01}}};
static const in6_addr kIPv4MappedRFC1918Addr = {{{0x00, 0x00, 0x00, 0x00,
                                                  0x00, 0x00, 0x00, 0x00,
                                                  0x00, 0x00, 0xff, 0xff,
                                                  0xc0, 0xa8, 0x07, 0x01}}};
static const in6_addr kIPv4MappedPublicAddr = {{{0x00, 0x00, 0x00, 0x00,
                                                 0x00, 0x00, 0x00, 0x00,
                                                 0x00, 0x00, 0xff, 0xff,
                                                 0x01, 0x02, 0x03, 0x04}}};
static const in6_addr kIPv6AllNodes = {{{0xff, 0x02, 0x00, 0x00,
                                         0x00, 0x00, 0x00, 0x00,
                                         0x00, 0x00, 0x00, 0x00,
                                         0x00, 0x00, 0x00, 0x01}}};

static const std::string kIPv4AnyAddrString = "0.0.0.0";
static const std::string kIPv4LoopbackAddrString = "127.0.0.1";
static const std::string kIPv4RFC1918AddrString = "192.168.7.1";
static const std::string kIPv4PublicAddrString = "1.2.3.4";
static const std::string kIPv6AnyAddrString = "::";
static const std::string kIPv6LoopbackAddrString = "::1";
static const std::string kIPv6LinkLocalAddrString = "fe80::be30:5bff:fee5:c3";
static const std::string kIPv6PublicAddrString =
    "2401:fa00:4:1000:be30:5bff:fee5:c3";
static const std::string kIPv4MappedAnyAddrString = "::ffff:0:0";
static const std::string kIPv4MappedRFC1918AddrString = "::ffff:c0a8:701";
static const std::string kIPv4MappedLoopbackAddrString = "::ffff:7f00:1";
static const std::string kIPv4MappedPublicAddrString = "::ffff:102:0304";
static const std::string kIPv4MappedV4StyleAddrString = "::ffff:192.168.7.1";

static const std::string kIPv4BrokenString1 = "192.168.7.";
static const std::string kIPv4BrokenString2 = "192.168.7.1.1";
static const std::string kIPv4BrokenString3 = "192.168.7.1:80";
static const std::string kIPv4BrokenString4 = "192.168.7.ONE";
static const std::string kIPv4BrokenString5 = "-192.168.7.1";
static const std::string kIPv4BrokenString6 = "256.168.7.1";
static const std::string kIPv6BrokenString1 = "2401:fa00:4:1000:be30";
static const std::string kIPv6BrokenString2 =
    "2401:fa00:4:1000:be30:5bff:fee5:c3:1";
static const std::string kIPv6BrokenString3 =
    "[2401:fa00:4:1000:be30:5bff:fee5:c3]:1";
static const std::string kIPv6BrokenString4 =
    "2401::4::be30";
static const std::string kIPv6BrokenString5 =
    "2401:::4:fee5:be30";
static const std::string kIPv6BrokenString6 =
    "2401f:fa00:4:1000:be30:5bff:fee5:c3";
static const std::string kIPv6BrokenString7 =
    "2401:ga00:4:1000:be30:5bff:fee5:c3";
static const std::string kIPv6BrokenString8 =
    "2401:fa000:4:1000:be30:5bff:fee5:c3";
static const std::string kIPv6BrokenString9 =
    "2401:fal0:4:1000:be30:5bff:fee5:c3";
static const std::string kIPv6BrokenString10 =
    "::ffff:192.168.7.";
static const std::string kIPv6BrokenString11 =
    "::ffff:192.168.7.1.1.1";
static const std::string kIPv6BrokenString12 =
    "::fffe:192.168.7.1";
static const std::string kIPv6BrokenString13 =
    "::ffff:192.168.7.ff";
static const std::string kIPv6BrokenString14 =
    "0x2401:fa00:4:1000:be30:5bff:fee5:c3";

bool IPFromHostEntWorks(const std::string& name, int expected_family,
                        IPAddress expected_addr) {
  struct hostent* ent = gethostbyname(name.c_str());
  if (ent) {
    IPAddress addr;
    if (!IPFromHostEnt(ent, &addr)) {
      return false;
    }
    return addr == expected_addr;
  }
  return true;
}

bool AreEqual(const IPAddress& addr,
              const IPAddress& addr2) {
  if ((IPIsAny(addr) != IPIsAny(addr2)) ||
      (IPIsLoopback(addr) != IPIsLoopback(addr2)) ||
      (IPIsPrivate(addr) != IPIsPrivate(addr2)) ||
      (HashIP(addr) != HashIP(addr2)) ||
      (addr.Size() != addr2.Size()) ||
      (addr.family() != addr2.family()) ||
      (addr.ToString() != addr2.ToString())) {
    return false;
  }
  in_addr v4addr, v4addr2;
  v4addr = addr.ipv4_address();
  v4addr2 = addr2.ipv4_address();
  if (0 != memcmp(&v4addr, &v4addr2, sizeof(v4addr))) {
    return false;
  }
  in6_addr v6addr, v6addr2;
  v6addr = addr.ipv6_address();
  v6addr2 = addr2.ipv6_address();
  if (0 != memcmp(&v6addr, &v6addr2, sizeof(v6addr))) {
    return false;
  }
  return true;
}

bool BrokenIPStringFails(const std::string& broken) {
  IPAddress addr(0);   // Intentionally make it v4.
  if (IPFromString(kIPv4BrokenString1, &addr)) {
    return false;
  }
  return addr.family() == AF_UNSPEC;
}

TEST(IPAddressTest, TestDefaultCtor) {
  IPAddress addr;
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_FALSE(IPIsPrivate(addr));

  EXPECT_EQ(0U, addr.Size());
  EXPECT_EQ(AF_UNSPEC, addr.family());
  EXPECT_EQ("", addr.ToString());
}

TEST(IPAddressTest, TestInAddrCtor) {
  in_addr v4addr;

  // Test V4 Any address.
  v4addr.s_addr = INADDR_ANY;
  IPAddress addr(v4addr);
  EXPECT_TRUE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_FALSE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv4AddrSize, addr.Size());
  EXPECT_EQ(kIPv4AnyAddrString, addr.ToString());

  // Test a V4 loopback address.
  v4addr.s_addr = htonl(INADDR_LOOPBACK);
  addr = IPAddress(v4addr);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_TRUE(IPIsLoopback(addr));
  EXPECT_TRUE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv4AddrSize, addr.Size());
  EXPECT_EQ(kIPv4LoopbackAddrString, addr.ToString());

  // Test an RFC1918 address.
  v4addr.s_addr = htonl(kIPv4RFC1918Addr);
  addr = IPAddress(v4addr);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_TRUE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv4AddrSize, addr.Size());
  EXPECT_EQ(kIPv4RFC1918AddrString, addr.ToString());

  // Test a 'normal' v4 address.
  v4addr.s_addr = htonl(kIPv4PublicAddr);
  addr = IPAddress(v4addr);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_FALSE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv4AddrSize, addr.Size());
  EXPECT_EQ(kIPv4PublicAddrString, addr.ToString());
}

TEST(IPAddressTest, TestInAddr6Ctor) {
  // Test v6 empty.
  IPAddress addr(in6addr_any);
  EXPECT_TRUE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_FALSE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv6AddrSize, addr.Size());
  EXPECT_EQ(kIPv6AnyAddrString, addr.ToString());

  // Test v6 loopback.
  addr = IPAddress(in6addr_loopback);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_TRUE(IPIsLoopback(addr));
  EXPECT_TRUE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv6AddrSize, addr.Size());
  EXPECT_EQ(kIPv6LoopbackAddrString, addr.ToString());

  // Test v6 link-local.
  addr = IPAddress(kIPv6LinkLocalAddr);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_TRUE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv6AddrSize, addr.Size());
  EXPECT_EQ(kIPv6LinkLocalAddrString, addr.ToString());

  // Test v6 global address.
  addr = IPAddress(kIPv6PublicAddr);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_FALSE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv6AddrSize, addr.Size());
  EXPECT_EQ(kIPv6PublicAddrString, addr.ToString());
}

TEST(IPAddressTest, TestUint32Ctor) {
  // Test V4 Any address.
  IPAddress addr(0);
  EXPECT_TRUE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_FALSE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv4AddrSize, addr.Size());
  EXPECT_EQ(kIPv4AnyAddrString, addr.ToString());

  // Test a V4 loopback address.
  addr = IPAddress(INADDR_LOOPBACK);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_TRUE(IPIsLoopback(addr));
  EXPECT_TRUE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv4AddrSize, addr.Size());
  EXPECT_EQ(kIPv4LoopbackAddrString, addr.ToString());

  // Test an RFC1918 address.
  addr = IPAddress(kIPv4RFC1918Addr);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_TRUE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv4AddrSize, addr.Size());
  EXPECT_EQ(kIPv4RFC1918AddrString, addr.ToString());

  // Test a 'normal' v4 address.
  addr = IPAddress(kIPv4PublicAddr);
  EXPECT_FALSE(IPIsAny(addr));
  EXPECT_FALSE(IPIsLoopback(addr));
  EXPECT_FALSE(IPIsPrivate(addr));
  EXPECT_EQ(kIPv4AddrSize, addr.Size());
  EXPECT_EQ(kIPv4PublicAddrString, addr.ToString());
}

TEST(IPAddressTest, TestHostEntCtor) {
  IPAddress addr(INADDR_LOOPBACK);
  EXPECT_PRED3(IPFromHostEntWorks, "localhost", AF_INET, addr);

  addr = IPAddress(kIPv6AllNodes);
  EXPECT_PRED3(IPFromHostEntWorks, "ip6-allnodes", AF_INET6, addr);

  //  gethostbyname works for literal addresses too
  addr = IPAddress(INADDR_ANY);
  EXPECT_PRED3(IPFromHostEntWorks,
               kIPv4AnyAddrString, AF_INET, addr);
  addr = IPAddress(kIPv4RFC1918Addr);
  EXPECT_PRED3(IPFromHostEntWorks,
               kIPv4RFC1918AddrString, AF_INET, addr);
  addr = IPAddress(kIPv4PublicAddr);
  EXPECT_PRED3(IPFromHostEntWorks,
               kIPv4PublicAddrString, AF_INET, addr);

  addr = IPAddress(in6addr_any);
  EXPECT_PRED3(IPFromHostEntWorks,
               kIPv6AnyAddrString, AF_INET6, addr);
  addr = IPAddress(in6addr_loopback);
  EXPECT_PRED3(IPFromHostEntWorks,
               kIPv6LoopbackAddrString, AF_INET6, addr);
  addr = IPAddress(kIPv6LinkLocalAddr);
  EXPECT_PRED3(IPFromHostEntWorks,
               kIPv6LinkLocalAddrString, AF_INET6, addr);
  addr = IPAddress(kIPv6PublicAddr);
  EXPECT_PRED3(IPFromHostEntWorks,
               kIPv6PublicAddrString, AF_INET6, addr);
}

TEST(IPAddressTest, TestCopyCtor) {
  in_addr v4addr;
  v4addr.s_addr = htonl(kIPv4PublicAddr);
  IPAddress addr(v4addr);
  IPAddress addr2(addr);

  EXPECT_PRED2(AreEqual, addr, addr2);

  addr = IPAddress(INADDR_ANY);
  addr2 = IPAddress(addr);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr = IPAddress(INADDR_LOOPBACK);
  addr2 = IPAddress(addr);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr = IPAddress(kIPv4PublicAddr);
  addr2 = IPAddress(addr);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr = IPAddress(kIPv4RFC1918Addr);
  addr2 = IPAddress(addr);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr = IPAddress(in6addr_any);
  addr2 = IPAddress(addr);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr = IPAddress(in6addr_loopback);
  addr2 = IPAddress(addr);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr = IPAddress(kIPv6LinkLocalAddr);
  addr2 = IPAddress(addr);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr = IPAddress(kIPv6PublicAddr);
  addr2 = IPAddress(addr);
  EXPECT_PRED2(AreEqual, addr, addr2);
}

TEST(IPAddressTest, TestEquality) {
  // Check v4 equality
  in_addr v4addr, v4addr2;
  v4addr.s_addr = htonl(kIPv4PublicAddr);
  v4addr2.s_addr = htonl(kIPv4PublicAddr + 1);
  IPAddress addr(v4addr);
  IPAddress addr2(v4addr2);
  IPAddress addr3(v4addr);

  EXPECT_TRUE(addr == addr);
  EXPECT_TRUE(addr2 == addr2);
  EXPECT_TRUE(addr3 == addr3);
  EXPECT_TRUE(addr == addr3);
  EXPECT_TRUE(addr3 == addr);
  EXPECT_FALSE(addr2 == addr);
  EXPECT_FALSE(addr2 == addr3);
  EXPECT_FALSE(addr == addr2);
  EXPECT_FALSE(addr3 == addr2);

  // Check v6 equality
  IPAddress addr4(kIPv6PublicAddr);
  IPAddress addr5(kIPv6LinkLocalAddr);
  IPAddress addr6(kIPv6PublicAddr);

  EXPECT_TRUE(addr4 == addr4);
  EXPECT_TRUE(addr5 == addr5);
  EXPECT_TRUE(addr4 == addr6);
  EXPECT_TRUE(addr6 == addr4);
  EXPECT_FALSE(addr4 == addr5);
  EXPECT_FALSE(addr5 == addr4);
  EXPECT_FALSE(addr6 == addr5);
  EXPECT_FALSE(addr5 == addr6);

  // Check v4/v6 cross-equality
  EXPECT_FALSE(addr == addr4);
  EXPECT_FALSE(addr == addr5);
  EXPECT_FALSE(addr == addr6);
  EXPECT_FALSE(addr4 == addr);
  EXPECT_FALSE(addr5 == addr);
  EXPECT_FALSE(addr6 == addr);
  EXPECT_FALSE(addr2 == addr4);
  EXPECT_FALSE(addr2 == addr5);
  EXPECT_FALSE(addr2 == addr6);
  EXPECT_FALSE(addr4 == addr2);
  EXPECT_FALSE(addr5 == addr2);
  EXPECT_FALSE(addr6 == addr2);
  EXPECT_FALSE(addr3 == addr4);
  EXPECT_FALSE(addr3 == addr5);
  EXPECT_FALSE(addr3 == addr6);
  EXPECT_FALSE(addr4 == addr3);
  EXPECT_FALSE(addr5 == addr3);
  EXPECT_FALSE(addr6 == addr3);

  // Special cases: loopback and any.
  // They're special but they're still not equal.
  IPAddress v4loopback(htonl(INADDR_LOOPBACK));
  IPAddress v6loopback(in6addr_loopback);
  EXPECT_FALSE(v4loopback == v6loopback);

  IPAddress v4any(0);
  IPAddress v6any(in6addr_any);
  EXPECT_FALSE(v4any == v6any);
}

TEST(IPAddressTest, TestComparison) {
  // Defined in 'ascending' order.
  // v6 > v4, and intra-family sorting is purely numerical
  IPAddress addr0;  // AF_UNSPEC
  IPAddress addr1(INADDR_ANY);  // 0.0.0.0
  IPAddress addr2(kIPv4PublicAddr);  // 1.2.3.4
  IPAddress addr3(INADDR_LOOPBACK);  // 127.0.0.1
  IPAddress addr4(kIPv4RFC1918Addr);  // 192.168.7.1.
  IPAddress addr5(in6addr_any);  // ::
  IPAddress addr6(in6addr_loopback);  // ::1
  IPAddress addr7(kIPv6PublicAddr);  // 2401....
  IPAddress addr8(kIPv6LinkLocalAddr);  // fe80....

  EXPECT_TRUE(addr0 < addr1);
  EXPECT_TRUE(addr1 < addr2);
  EXPECT_TRUE(addr2 < addr3);
  EXPECT_TRUE(addr3 < addr4);
  EXPECT_TRUE(addr4 < addr5);
  EXPECT_TRUE(addr5 < addr6);
  EXPECT_TRUE(addr6 < addr7);
  EXPECT_TRUE(addr7 < addr8);

  EXPECT_FALSE(addr0 > addr1);
  EXPECT_FALSE(addr1 > addr2);
  EXPECT_FALSE(addr2 > addr3);
  EXPECT_FALSE(addr3 > addr4);
  EXPECT_FALSE(addr4 > addr5);
  EXPECT_FALSE(addr5 > addr6);
  EXPECT_FALSE(addr6 > addr7);
  EXPECT_FALSE(addr7 > addr8);

  EXPECT_FALSE(addr0 > addr0);
  EXPECT_FALSE(addr1 > addr1);
  EXPECT_FALSE(addr2 > addr2);
  EXPECT_FALSE(addr3 > addr3);
  EXPECT_FALSE(addr4 > addr4);
  EXPECT_FALSE(addr5 > addr5);
  EXPECT_FALSE(addr6 > addr6);
  EXPECT_FALSE(addr7 > addr7);
  EXPECT_FALSE(addr8 > addr8);

  EXPECT_FALSE(addr0 < addr0);
  EXPECT_FALSE(addr1 < addr1);
  EXPECT_FALSE(addr2 < addr2);
  EXPECT_FALSE(addr3 < addr3);
  EXPECT_FALSE(addr4 < addr4);
  EXPECT_FALSE(addr5 < addr5);
  EXPECT_FALSE(addr6 < addr6);
  EXPECT_FALSE(addr7 < addr7);
  EXPECT_FALSE(addr8 < addr8);
}

TEST(IPAddressTest, TestFromString) {
  IPAddress addr;
  IPAddress addr2;
  addr2 = IPAddress(INADDR_ANY);

  EXPECT_TRUE(IPFromString(kIPv4AnyAddrString, &addr));
  EXPECT_EQ(addr.ToString(), kIPv4AnyAddrString);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr2 = IPAddress(INADDR_LOOPBACK);
  EXPECT_TRUE(IPFromString(kIPv4LoopbackAddrString, &addr));
  EXPECT_EQ(addr.ToString(), kIPv4LoopbackAddrString);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr2 = IPAddress(kIPv4RFC1918Addr);
  EXPECT_TRUE(IPFromString(kIPv4RFC1918AddrString, &addr));
  EXPECT_EQ(addr.ToString(), kIPv4RFC1918AddrString);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr2 = IPAddress(kIPv4PublicAddr);
  EXPECT_TRUE(IPFromString(kIPv4PublicAddrString, &addr));
  EXPECT_EQ(addr.ToString(), kIPv4PublicAddrString);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr2 = IPAddress(in6addr_any);
  EXPECT_TRUE(IPFromString(kIPv6AnyAddrString, &addr));
  EXPECT_EQ(addr.ToString(), kIPv6AnyAddrString);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr2 = IPAddress(in6addr_loopback);
  EXPECT_TRUE(IPFromString(kIPv6LoopbackAddrString, &addr));
  EXPECT_EQ(addr.ToString(), kIPv6LoopbackAddrString);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr2 = IPAddress(kIPv6LinkLocalAddr);
  EXPECT_TRUE(IPFromString(kIPv6LinkLocalAddrString, &addr));
  EXPECT_EQ(addr.ToString(), kIPv6LinkLocalAddrString);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr2 = IPAddress(kIPv6PublicAddr);
  EXPECT_TRUE(IPFromString(kIPv6PublicAddrString, &addr));
  EXPECT_EQ(addr.ToString(), kIPv6PublicAddrString);
  EXPECT_PRED2(AreEqual, addr, addr2);

  addr2 = IPAddress(kIPv4MappedRFC1918Addr);
  EXPECT_TRUE(IPFromString(kIPv4MappedV4StyleAddrString, &addr));
  EXPECT_PRED2(AreEqual, addr, addr2);

  // Broken cases, should set addr to AF_UNSPEC.
  EXPECT_PRED1(BrokenIPStringFails, kIPv4BrokenString1);
  EXPECT_PRED1(BrokenIPStringFails, kIPv4BrokenString2);
  EXPECT_PRED1(BrokenIPStringFails, kIPv4BrokenString3);
  EXPECT_PRED1(BrokenIPStringFails, kIPv4BrokenString4);
  EXPECT_PRED1(BrokenIPStringFails, kIPv4BrokenString5);
  EXPECT_PRED1(BrokenIPStringFails, kIPv4BrokenString6);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString1);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString2);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString3);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString4);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString5);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString6);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString7);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString8);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString9);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString10);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString11);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString12);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString13);
  EXPECT_PRED1(BrokenIPStringFails, kIPv6BrokenString14);
}

TEST(IPAddressTest, TestIsPrivate) {
  EXPECT_FALSE(IPIsPrivate(IPAddress(INADDR_ANY)));
  EXPECT_FALSE(IPIsPrivate(IPAddress(kIPv4PublicAddr)));
  EXPECT_FALSE(IPIsPrivate(IPAddress(in6addr_any)));
  EXPECT_FALSE(IPIsPrivate(IPAddress(kIPv6PublicAddr)));
  EXPECT_FALSE(IPIsPrivate(IPAddress(kIPv4MappedAnyAddr)));
  EXPECT_FALSE(IPIsPrivate(IPAddress(kIPv4MappedPublicAddr)));

  EXPECT_TRUE(IPIsPrivate(IPAddress(kIPv4RFC1918Addr)));
  EXPECT_TRUE(IPIsPrivate(IPAddress(INADDR_LOOPBACK)));
  EXPECT_TRUE(IPIsPrivate(IPAddress(in6addr_loopback)));
  EXPECT_TRUE(IPIsPrivate(IPAddress(kIPv6LinkLocalAddr)));
}

TEST(IPAddressTest, TestIsLoopback) {
  EXPECT_FALSE(IPIsLoopback(IPAddress(INADDR_ANY)));
  EXPECT_FALSE(IPIsLoopback(IPAddress(kIPv4PublicAddr)));
  EXPECT_FALSE(IPIsLoopback(IPAddress(in6addr_any)));
  EXPECT_FALSE(IPIsLoopback(IPAddress(kIPv6PublicAddr)));
  EXPECT_FALSE(IPIsLoopback(IPAddress(kIPv4MappedAnyAddr)));
  EXPECT_FALSE(IPIsLoopback(IPAddress(kIPv4MappedPublicAddr)));

  EXPECT_TRUE(IPIsLoopback(IPAddress(INADDR_LOOPBACK)));
  EXPECT_TRUE(IPIsLoopback(IPAddress(in6addr_loopback)));
}

TEST(IPAddressTest, TestNormalized) {
  // Check normalizing a ::ffff:a.b.c.d address.
  IPAddress addr;
  EXPECT_TRUE(IPFromString(kIPv4MappedV4StyleAddrString, &addr));
  IPAddress addr2(kIPv4RFC1918Addr);
  addr = addr.Normalized();
  EXPECT_EQ(addr2, addr);

  // Check normalizing a ::ffff:aabb:ccdd address.
  addr = IPAddress(kIPv4MappedPublicAddr);
  addr2 = IPAddress(kIPv4PublicAddr);
  addr = addr.Normalized();
  EXPECT_EQ(addr, addr2);

  // Check that a non-mapped v6 addresses isn't altered.
  addr = IPAddress(kIPv6PublicAddr);
  addr2 = IPAddress(kIPv6PublicAddr);
  addr = addr.Normalized();
  EXPECT_EQ(addr, addr2);

  // Check that addresses that look a bit like mapped addresses aren't altered
  EXPECT_TRUE(IPFromString("fe80::ffff:0102:0304", &addr));
  addr2 = addr;
  addr = addr.Normalized();
  EXPECT_EQ(addr, addr2);
  EXPECT_TRUE(IPFromString("::0102:0304", &addr));
  addr2 = addr;
  addr = addr.Normalized();
  EXPECT_EQ(addr, addr2);
  // This string should 'work' as an IP address but is not a mapped address,
  // so it shouldn't change on normalization.
  EXPECT_TRUE(IPFromString("::192.168.7.1", &addr));
  addr2 = addr;
  addr = addr.Normalized();
  EXPECT_EQ(addr, addr2);

  // Check that v4 addresses aren't altered.
  addr = IPAddress(htonl(kIPv4PublicAddr));
  addr2 = IPAddress(htonl(kIPv4PublicAddr));
  addr = addr.Normalized();
  EXPECT_EQ(addr, addr2);
}

TEST(IPAddressTest, TestAsIPv6Address) {
  IPAddress addr(kIPv4PublicAddr);
  IPAddress addr2(kIPv4MappedPublicAddr);
  addr = addr.AsIPv6Address();
  EXPECT_EQ(addr, addr2);

  addr = IPAddress(kIPv4MappedPublicAddr);
  addr2 = IPAddress(kIPv4MappedPublicAddr);
  addr = addr.AsIPv6Address();
  EXPECT_EQ(addr, addr2);

  addr = IPAddress(kIPv6PublicAddr);
  addr2 = IPAddress(kIPv6PublicAddr);
  addr = addr.AsIPv6Address();
  EXPECT_EQ(addr, addr2);
}

}  // namespace talk_base
