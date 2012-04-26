/*
 * libjingle
 * Copyright 2004 Google Inc.
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

#include <string>

#include "talk/base/bytebuffer.h"
#include "talk/base/gunit.h"
#include "talk/base/logging.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/socketaddress.h"
#include "talk/p2p/base/stun.h"

namespace cricket {

class StunTest : public ::testing::Test {
 protected:
  void CheckStunHeader(const StunMessage& msg, StunMessageType expected_type,
                       size_t expected_length) {
    ASSERT_EQ(expected_type, msg.type());
    ASSERT_EQ(expected_length, msg.length());
  }

  void CheckStunTransactionID(const StunMessage& msg,
                              const unsigned char* expectedID, size_t length) {
    ASSERT_EQ(0, std::memcmp(msg.transaction_id().c_str(),
                             expectedID, length));
  }

  void CheckStunAddressAttribute(const StunAddressAttribute* addr,
                                 StunAddressFamily expected_family,
                                 int expected_port,
                                 talk_base::IPAddress expected_address) {
    ASSERT_EQ(expected_family, addr->family());
    ASSERT_EQ(expected_port, addr->port());

    if (addr->family() == STUN_ADDRESS_IPV4) {
      in_addr v4_address = expected_address.ipv4_address();
      in_addr stun_address = addr->ipaddr().ipv4_address();
      ASSERT_EQ(0, std::memcmp(&v4_address, &stun_address,
                               sizeof(stun_address)));
    } else if (addr->family() == STUN_ADDRESS_IPV6) {
      in6_addr v6_address = expected_address.ipv6_address();
      in6_addr stun_address = addr->ipaddr().ipv6_address();
      ASSERT_EQ(0, std::memcmp(&v6_address, &stun_address,
                               sizeof(stun_address)));
    } else {
      ASSERT_TRUE(addr->family() == STUN_ADDRESS_IPV6 ||
                  addr->family() == STUN_ADDRESS_IPV4);
    }
  }

  size_t ReadStunMessageTestCase(StunMessage* msg,
                                 const unsigned char* testcase,
                                 size_t size) {
    const char* input = reinterpret_cast<const char*>(testcase);
    talk_base::ByteBuffer buf(input, size);
    if (msg->Read(&buf)) {
      // Returns the size the stun message should report itself as being
      return (size - 20);
    } else {
      return 0;
    }
  }
};


// Sample STUN packets with various attributes
// Gathered by wiresharking pjproject's pjnath test programs
// pjproject available at www.pjsip.org

static const unsigned char kStunMessageWithIPv6MappedAddress[] = {
  0x00, 0x01, 0x00, 0x18,  // message header
  0x21, 0x12, 0xa4, 0x42,  // transaction id
  0x29, 0x1f, 0xcd, 0x7c,
  0xba, 0x58, 0xab, 0xd7,
  0xf2, 0x41, 0x01, 0x00,
  0x00, 0x01, 0x00, 0x14,  // Address type (mapped), length
  0x00, 0x02, 0xb8, 0x81,  // family (IPv6), port
  0x24, 0x01, 0xfa, 0x00,  // an IPv6 address
  0x00, 0x04, 0x10, 0x00,
  0xbe, 0x30, 0x5b, 0xff,
  0xfe, 0xe5, 0x00, 0xc3
};

static const unsigned char kStunMessageWithIPv4MappedAddress[] = {
  0x01, 0x01, 0x00, 0x0c,   // binding response, length 12
  0x21, 0x12, 0xa4, 0x42,   // magic cookie
  0x29, 0x1f, 0xcd, 0x7c,   // transaction ID
  0xba, 0x58, 0xab, 0xd7,
  0xf2, 0x41, 0x01, 0x00,
  0x00, 0x01, 0x00, 0x08,  // Mapped, 8 byte length
  0x00, 0x01, 0x9d, 0xfc,  // AF_INET, unxor-ed port
  0xac, 0x17, 0x44, 0xe6   // IPv4 address
};

// Test XOR-mapped IP addresses:
static const unsigned char kStunMessageWithIPv6XorMappedAddress[] = {
  0x01, 0x01, 0x00, 0x18,  // message header (binding response)
  0x21, 0x12, 0xa4, 0x42,  // magic cookie (rfc5389)
  0xe3, 0xa9, 0x46, 0xe1,  // transaction ID
  0x7c, 0x00, 0xc2, 0x62,
  0x54, 0x08, 0x01, 0x00,
  0x00, 0x20, 0x00, 0x14,  // Address Type (XOR), length
  0x00, 0x02, 0xcb, 0x5b,  // family, XOR-ed port
  0x05, 0x13, 0x5e, 0x42,  // XOR-ed IPv6 address
  0xe3, 0xad, 0x56, 0xe1,
  0xc2, 0x30, 0x99, 0x9d,
  0xaa, 0xed, 0x01, 0xc3
};

static const unsigned char kStunMessageWithIPv4XorMappedAddress[] = {
  0x01, 0x01, 0x00, 0x0c,  // message header (binding response)
  0x21, 0x12, 0xa4, 0x42,  // magic cookie
  0x29, 0x1f, 0xcd, 0x7c,  // transaction ID
  0xba, 0x58, 0xab, 0xd7,
  0xf2, 0x41, 0x01, 0x00,
  0x00, 0x20, 0x00, 0x08,  // address type (xor), length
  0x00, 0x01, 0xfc, 0xb5,  // family (AF_INET), XOR-ed port
  0x8d, 0x05, 0xe0, 0xa4   // IPv4 address
};

// ByteString Attribute (username)
static const unsigned char kStunMessageWithByteStringAttribute[] = {
  0x00, 0x01, 0x00, 0x0c,
  0x21, 0x12, 0xa4, 0x42,
  0xe3, 0xa9, 0x46, 0xe1,
  0x7c, 0x00, 0xc2, 0x62,
  0x54, 0x08, 0x01, 0x00,
  0x00, 0x06, 0x00, 0x08,  // username attribute (length 8)
  0x61, 0x62, 0x63, 0x64,  // abcdefgh
  0x65, 0x66, 0x67, 0x68
};

// Message with an unknown but comprehensible optional attribute.
// Parsing should succeed despite this unknown attribute.
static const unsigned char kStunMessageWithUnknownAttribute[] = {
  0x00, 0x01, 0x00, 0x14,
  0x21, 0x12, 0xa4, 0x42,
  0xe3, 0xa9, 0x46, 0xe1,
  0x7c, 0x00, 0xc2, 0x62,
  0x54, 0x08, 0x01, 0x00,
  0x00, 0xaa, 0x00, 0x07,  // Unknown attribute, length 7 (needs padding!)
  0x61, 0x62, 0x63, 0x64,  // abcdefg + padding
  0x65, 0x66, 0x67, 0x00,
  0x00, 0x0d, 0x00, 0x04,  // Followed by a known attribute we can
  0x00, 0x00, 0x00, 0x0b   // check for.
};

// ByteString Attribute (username) with padding byte
static const unsigned char kStunMessageWithPaddedByteStringAttribute[] = {
  0x00, 0x01, 0x00, 0x08,
  0x21, 0x12, 0xa4, 0x42,
  0xe3, 0xa9, 0x46, 0xe1,
  0x7c, 0x00, 0xc2, 0x62,
  0x54, 0x08, 0x01, 0x00,
  0x00, 0x06, 0x00, 0x03,  // username attribute (length 3)
  0x61, 0x62, 0x63, 0xcc   // abc
};

// Message with an Unknown Attributes (uint16 list) attribute.
static const unsigned char kStunMessageWithUInt16ListAttribute[] = {
  0x00, 0x01, 0x00, 0x0c,
  0x21, 0x12, 0xa4, 0x42,
  0xe3, 0xa9, 0x46, 0xe1,
  0x7c, 0x00, 0xc2, 0x62,
  0x54, 0x08, 0x01, 0x00,
  0x00, 0x0a, 0x00, 0x06,  // username attribute (length 6)
  0x00, 0x01, 0x10, 0x00,  // three attributes plus padding
  0xAB, 0xCU, 0xBE, 0xEF
};

// Error response message (unauthorized)
static const unsigned char kStunMessageWithErrorAttribute[] = {
  0x01, 0x13, 0x00, 0x14,
  0x21, 0x12, 0xa4, 0x42,
  0x29, 0x1f, 0xcd, 0x7c,
  0xba, 0x58, 0xab, 0xd7,
  0xf2, 0x41, 0x01, 0x00,
  0x00, 0x09, 0x00, 0x10,
  0x00, 0x00, 0x04, 0x01,
  0x55, 0x6e, 0x61, 0x75,
  0x74, 0x68, 0x6f, 0x72,
  0x69, 0x7a, 0x65, 0x64
};

// Message with an address attribute with an unknown address family,
// and a byte string attribute. Check that we quit reading after the
// bogus address family and don't read the username attribute.
static const unsigned char kStunMessageWithInvalidAddressFamily[] = {
  0x01, 0x01, 0x00, 0x18,   // binding response, length 24
  0x21, 0x12, 0xa4, 0x42,   // magic cookie
  0x29, 0x1f, 0xcd, 0x7c,   // transaction ID
  0xba, 0x58, 0xab, 0xd7,
  0xf2, 0x41, 0x01, 0x00,
  0x00, 0x01, 0x00, 0x08,  // Mapped address, 4 byte length
  0x00, 0x09, 0xfe, 0xed,  // Bogus address family (port unimportant).
  0xac, 0x17, 0x44, 0xe6,  // Should be skipped.
  0x00, 0x06, 0x00, 0x08,  // Username attribute (length 8)
  0x61, 0x62, 0x63, 0x64,  // abcdefgh
  0x65, 0x66, 0x67, 0x68
};

// Message with an address attribute with an invalid address length.
// Should fail to be read.
static const unsigned char kStunMessageWithInvalidAddressLength[] = {
  0x01, 0x01, 0x00, 0x18,   // binding response, length 24
  0x21, 0x12, 0xa4, 0x42,   // magic cookie
  0x29, 0x1f, 0xcd, 0x7c,   // transaction ID
  0xba, 0x58, 0xab, 0xd7,
  0xf2, 0x41, 0x01, 0x00,
  0x00, 0x01, 0x00, 0x0c,  // Mapped address, 12 byte length
  0x00, 0x01, 0xfe, 0xed,  // Claims to be AF_INET.
  0xac, 0x17, 0x44, 0xe6,
  0x00, 0x06, 0x00, 0x08
};

// Sample messages with an invalid length Field

// The actual length in bytes of the invalid messages (including STUN header)
static const int kRealLengthOfInvalidLengthTestCases = 32;

static const unsigned char kStunMessageWithZeroLength[] = {
  0x00, 0x01, 0x00, 0x00,  // length of 0 (last 2 bytes)
  0x21, 0x12, 0xA4, 0x42,  // magic cookie
  '0', '1', '2', '3',      // transaction id
  '4', '5', '6', '7',
  '8', '9', 'a', 'b',
  0x00, 0x20, 0x00, 0x08,  // xor mapped address
  0x00, 0x01, 0x21, 0x1F,
  0x21, 0x12, 0xA4, 0x53,
};

static const unsigned char kStunMessageWithExcessLength[] = {
  0x00, 0x01, 0x00, 0x55,  // length of 85
  0x21, 0x12, 0xA4, 0x42,  // magic cookie
  '0', '1', '2', '3',      // transaction id
  '4', '5', '6', '7',
  '8', '9', 'a', 'b',
  0x00, 0x20, 0x00, 0x08,  // xor mapped address
  0x00, 0x01, 0x21, 0x1F,
  0x21, 0x12, 0xA4, 0x53,
};

static const unsigned char kStunMessageWithSmallLength[] = {
  0x00, 0x01, 0x00, 0x03,  // length of 3
  0x21, 0x12, 0xA4, 0x42,  // magic cookie
  '0', '1', '2', '3',      // transaction id
  '4', '5', '6', '7',
  '8', '9', 'a', 'b',
  0x00, 0x20, 0x00, 0x08,  // xor mapped address
  0x00, 0x01, 0x21, 0x1F,
  0x21, 0x12, 0xA4, 0x53,
};

// Legacy STUN tests.
// Included for completeness, but it's not recommended to change these.
static const unsigned char kStunMessageWithManyAttributes[] = {
  0x00, 0x01, 0x00, 136,   // message header
  0x21, 0x12, 0xA4, 0x42,  // magic cookie
  '0', '1', '2', '3',      // transaction id
  '4', '5', '6', '7',
  '8', '9', 'a', 'b',
  0x00, 0x01, 0x00, 8,     // mapped address
  0x00, 0x01, 0x00, 13,
  0x00, 0x00, 0x00, 17,
  0x00, 0x06, 0x00, 12,    // username
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
  0x00, 0x08, 0x00, 20,    // message integrity
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
  'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
  0x00, 0x09, 0x00, 12,    // error code
  0x00, 0x00, 2, 10,
  'f', 'o', 'o', ' ', 'b', 'a', 'r', '!',
  0x00, 0x0a, 0x00, 4,     // unknown attributes
  0x00, 0x01, 0x00, 0x02,
  0x00, 0x0d, 0x00, 4,     // lifetime
  0x00, 0x00, 0x00, 11,
  0x00, 0x0f, 0x00, 4,     // magic cookie
  0x72, 0xc6, 0x4b, 0xc6,
  0x00, 0x10, 0x00, 4,     // bandwidth
  0x00, 0x00, 0x00, 6,
  0x00, 0x11, 0x00, 8,     // destination address
  0x00, 0x01, 0x00, 13,
  0x00, 0x00, 0x00, 17,
  0x00, 0x12, 0x00, 8,     // source address 2
  0x00, 0x01, 0x00, 13,
  0x00, 0x00, 0x00, 17,
  0x00, 0x13, 0x00, 7,     // data
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 0  // DATA must be padded per rfc5766.
};

// RFC5769 Test Vectors
// Software name:  "STUN test client" (without quotes)
// Username:  "evtj:h6vY" (without quotes)
// Password:  "VOkJxbRl1RmTxUk/WvJxBt" (without quotes)
static const char kRfc5769SampleMsgPassword[] = "VOkJxbRl1RmTxUk/WvJxBt";
static const unsigned char kRfc5769SampleRequest[] = {
  0x00, 0x01, 0x00, 0x58,   //     Request type and message length
  0x21, 0x12, 0xa4, 0x42,   //  Magic cookie
  0xb7, 0xe7, 0xa7, 0x01,   // }
  0xbc, 0x34, 0xd6, 0x86,   // }  Transaction ID
  0xfa, 0x87, 0xdf, 0xae,   // }
  0x80, 0x22, 0x00, 0x10,   // SOFTWARE attribute header
  0x53, 0x54, 0x55, 0x4e,   // }
  0x20, 0x74, 0x65, 0x73,   // }  User-agent...
  0x74, 0x20, 0x63, 0x6c,   // }  ...name
  0x69, 0x65, 0x6e, 0x74,   // }
  0x00, 0x24, 0x00, 0x04,   //   PRIORITY attribute header
  0x6e, 0x00, 0x01, 0xff,   //   ICE priority value
  0x80, 0x29, 0x00, 0x08,   //   ICE-CONTROLLED attribute header
  0x93, 0x2f, 0xf9, 0xb1,   // }  Pseudo-random tie breaker...
  0x51, 0x26, 0x3b, 0x36,   // }   ...for ICE control
  0x00, 0x06, 0x00, 0x09,   //   USERNAME attribute header
  0x65, 0x76, 0x74, 0x6a,   // }
  0x3a, 0x68, 0x36, 0x76,   // }  Username (9 bytes) and padding (3 bytes)
  0x59, 0x20, 0x20, 0x20,   // }
  0x00, 0x08, 0x00, 0x14,   //   MESSAGE-INTEGRITY attribute header
  0x9a, 0xea, 0xa7, 0x0c,   // }
  0xbf, 0xd8, 0xcb, 0x56,   // }
  0x78, 0x1e, 0xf2, 0xb5,   // }  HMAC-SHA1 fingerprint
  0xb2, 0xd3, 0xf2, 0x49,   // }
  0xc1, 0xb5, 0x71, 0xa2,   // }
  0x80, 0x28, 0x00, 0x04,   //   FINGERPRINT attribute header
  0xe5, 0x7a, 0x3b, 0xcf    //   CRC32 fingerprint
};

static const unsigned char kRfc5769SampleResponse[] = {
  0x01, 0x01, 0x00, 0x3c,  //   Response type and message length
  0x21, 0x12, 0xa4, 0x42,  //   Magic cookie
  0xb7, 0xe7, 0xa7, 0x01,  // }
  0xbc, 0x34, 0xd6, 0x86,  // }  Transaction ID
  0xfa, 0x87, 0xdf, 0xae,  // }
  0x80, 0x22, 0x00, 0x0b,  //  SOFTWARE attribute header
  0x74, 0x65, 0x73, 0x74,  // }
  0x20, 0x76, 0x65, 0x63,  // }  UTF-8 server name
  0x74, 0x6f, 0x72, 0x20,  // }
  0x00, 0x20, 0x00, 0x08,  //   XOR-MAPPED-ADDRESS attribute header
  0x00, 0x01, 0xa1, 0x47,  //   Address family (IPv4) and xor'd mapped port
  0xe1, 0x12, 0xa6, 0x43,  //   Xor'd mapped IPv4 address
  0x00, 0x08, 0x00, 0x14,  //   MESSAGE-INTEGRITY attribute header
  0x2b, 0x91, 0xf5, 0x99,  // }
  0xfd, 0x9e, 0x90, 0xc3,  // }
  0x8c, 0x74, 0x89, 0xf9,  // }  HMAC-SHA1 fingerprint
  0x2a, 0xf9, 0xba, 0x53,  // }
  0xf0, 0x6b, 0xe7, 0xd7,  // }
  0x80, 0x28, 0x00, 0x04,  //   FINGERPRINT attribute header
  0xc0, 0x7d, 0x4c, 0x96   //   CRC32 fingerprint
};

static const unsigned char kRfc5769SampleIPv6Response[] = {
  0x01, 0x01, 0x00, 0x48,   //  Response type and message length
  0x21, 0x12, 0xa4, 0x42,   //  Magic cookie
  0xb7, 0xe7, 0xa7, 0x01,   // }
  0xbc, 0x34, 0xd6, 0x86,   // }  Transaction ID
  0xfa, 0x87, 0xdf, 0xae,   // }
  0x80, 0x22, 0x00, 0x0b,   //   SOFTWARE attribute header
  0x74, 0x65, 0x73, 0x74,   // }
  0x20, 0x76, 0x65, 0x63,   // }  UTF-8 server name
  0x74, 0x6f, 0x72, 0x20,   // }
  0x00, 0x20, 0x00, 0x14,   //   XOR-MAPPED-ADDRESS attribute header
  0x00, 0x02, 0xa1, 0x47,   //  Address family (IPv6) and xor'd mapped port.
  0x01, 0x13, 0xa9, 0xfa,   // }
  0xa5, 0xd3, 0xf1, 0x79,   // }  Xor'd mapped IPv6 address
  0xbc, 0x25, 0xf4, 0xb5,   // }
  0xbe, 0xd2, 0xb9, 0xd9,   // }
  0x00, 0x08, 0x00, 0x14,   //   MESSAGE-INTEGRITY attribute header
  0xa3, 0x82, 0x95, 0x4e,   // }
  0x4b, 0xe6, 0x7b, 0xf1,   // }
  0x17, 0x84, 0xc9, 0x7c,   // }  HMAC-SHA1 fingerprint
  0x82, 0x92, 0xc2, 0x75,   // }
  0xbf, 0xe3, 0xed, 0x41,   // }
  0x80, 0x28, 0x00, 0x04,   //   FINGERPRINT attribute header
  0xc8, 0xfb, 0x0b, 0x4c    //   CRC32 fingerprint
};

// Length parameter is changed to 0x38 from 0x58.
// AddMessageIntegrity will add MI information and update the length param
// accordingly.
static const unsigned char kRfc5769RequestWithoutMI[] = {
  0x00, 0x01, 0x00, 0x38,   //     Request type and message length
  0x21, 0x12, 0xa4, 0x42,   // Magic cookie
  0xb7, 0xe7, 0xa7, 0x01,   // }
  0xbc, 0x34, 0xd6, 0x86,   // }  Transaction ID
  0xfa, 0x87, 0xdf, 0xae,   // }
  0x80, 0x22, 0x00, 0x10,   // SOFTWARE attribute header
  0x53, 0x54, 0x55, 0x4e,   // }
  0x20, 0x74, 0x65, 0x73,   // }  User-agent...
  0x74, 0x20, 0x63, 0x6c,   // }  ...name
  0x69, 0x65, 0x6e, 0x74,   // }
  0x00, 0x24, 0x00, 0x04,   //   PRIORITY attribute header
  0x6e, 0x00, 0x01, 0xff,   //   ICE priority value
  0x80, 0x29, 0x00, 0x08,   //   ICE-CONTROLLED attribute header
  0x93, 0x2f, 0xf9, 0xb1,   // }  Pseudo-random tie breaker...
  0x51, 0x26, 0x3b, 0x36,   // }   ...for ICE control
  0x00, 0x06, 0x00, 0x09,   //   USERNAME attribute header
  0x65, 0x76, 0x74, 0x6a,   // }
  0x3a, 0x68, 0x36, 0x76,   // }  Username (9 bytes) and padding (3 bytes)
  0x59, 0x20, 0x20, 0x20    // }
};

// This HMAC differs from the RFC 5769 SampleRequest message. This differs
// because spec uses 0x20 for the padding where as our implementation uses 0.
static const unsigned char kCalculatedHmac1[] = {
  0x79, 0x07, 0xc2, 0xd2,   // }
  0xed, 0xbf, 0xea, 0x48,   // }
  0x0e, 0x4c, 0x76, 0xd8,   // }  HMAC-SHA1 fingerprint
  0x29, 0x62, 0xd5, 0xc3,   // }
  0x74, 0x2a, 0xf9, 0xe3    // }
};

static const unsigned char kRfc5769SampleResponseWithoutMI[] = {
  0x01, 0x01, 0x00, 0x1c,  //   Response type and message length
  0x21, 0x12, 0xa4, 0x42,  //   Magic cookie
  0xb7, 0xe7, 0xa7, 0x01,  // }
  0xbc, 0x34, 0xd6, 0x86,  // }  Transaction ID
  0xfa, 0x87, 0xdf, 0xae,  // }
  0x80, 0x22, 0x00, 0x0b,  //  SOFTWARE attribute header
  0x74, 0x65, 0x73, 0x74,  // }
  0x20, 0x76, 0x65, 0x63,  // }  UTF-8 server name
  0x74, 0x6f, 0x72, 0x20,  // }
  0x00, 0x20, 0x00, 0x08,  //   XOR-MAPPED-ADDRESS attribute header
  0x00, 0x01, 0xa1, 0x47,  //   Address family (IPv4) and xor'd mapped port
  0xe1, 0x12, 0xa6, 0x43  //   Xor'd mapped IPv4 address
};

// This HMAC differs from the RFC 5769 SampleResponse message. This differs
// because spec uses 0x20 for the padding where as our implementation uses 0.
static const unsigned char kCalculatedHmac2[] = {
  0x5d, 0x6b, 0x58, 0xbe,  // }
  0xad, 0x94, 0xe0, 0x7e,  // }
  0xef, 0x0d, 0xfc, 0x12,  // }  HMAC-SHA1 fingerprint
  0x82, 0xa2, 0xbd, 0x08,  // }
  0x43, 0x14, 0x10, 0x28   // }
};

// RTCP packet, for testing we correctly ignore non stun packet types.
// V=2, P=false, RC=0, Type=200, Len=6, Sender-SSRC=85, etc
static const unsigned char kRtcpPacket[] = {
  0x80, 0xc8, 0x00, 0x06, 0x00, 0x00, 0x00, 0x55,
  0xce, 0xa5, 0x18, 0x3a, 0x39, 0xcc, 0x7d, 0x09,
  0x23, 0xed, 0x19, 0x07, 0x00, 0x00, 0x01, 0x56,
  0x00, 0x03, 0x73, 0x50,
};

// A transaction ID without the 'magic cookie' portion
// pjnat's test programs use this transaction ID a lot.
const unsigned char kTestTransactionId1[] = { 0x029, 0x01f, 0x0cd, 0x07c,
                                              0x0ba, 0x058, 0x0ab, 0x0d7,
                                              0x0f2, 0x041, 0x001, 0x000 };

// They use this one sometimes too.
const unsigned char kTestTransactionId2[] = { 0x0e3, 0x0a9, 0x046, 0x0e1,
                                              0x07c, 0x000, 0x0c2, 0x062,
                                              0x054, 0x008, 0x001, 0x000 };

const in6_addr kIPv6TestAddress1 = { { { 0x24, 0x01, 0xfa, 0x00,
                                         0x00, 0x04, 0x10, 0x00,
                                         0xbe, 0x30, 0x5b, 0xff,
                                         0xfe, 0xe5, 0x00, 0xc3 } } };
const in6_addr kIPv6TestAddress2 = { { { 0x24, 0x01, 0xfa, 0x00,
                                         0x00, 0x04, 0x10, 0x12,
                                         0x06, 0x0c, 0xce, 0xff,
                                         0xfe, 0x1f, 0x61, 0xa4 } } };

// This is kIPv6TestAddress1 xor-ed with kTestTransactionID2.
const in6_addr kIPv6XoredTestAddress = { { { 0x05, 0x13, 0x5e, 0x42,
                                             0xe3, 0xad, 0x56, 0xe1,
                                             0xc2, 0x30, 0x99, 0x9d,
                                             0xaa, 0xed, 0x01, 0xc3 } } };

#ifdef POSIX
const in_addr kIPv4TestAddress1 =  { 0xe64417ac };
// This is kIPv4TestAddress xored with the STUN magic cookie.
const in_addr kIPv4XoredTestAddress = { 0x8d05e0a4 };
#elif defined WIN32
// Windows in_addr has a union with a uchar[] array first.
const in_addr kIPv4XoredTestAddress = { { 0x8d, 0x05, 0xe0, 0xa4 } };
const in_addr kIPv4TestAddress1 =  { { 0x0ac, 0x017, 0x044, 0x0e6 } };
#endif
const char kTestUserName1[] = "abcdefgh";
const char kTestUserName2[] = "abc";
const char kTestErrorReason[] = "Unauthorized";
const int kTestErrorClass = 4;
const int kTestErrorNumber = 1;

const int kTestMessagePort1 = 59977;
const int kTestMessagePort2 = 47233;
const int kTestMessagePort3 = 56743;
const int kTestMessagePort4 = 40444;

#define ReadStunMessage(X, Y) ReadStunMessageTestCase(X, Y, sizeof(Y));

TEST_F(StunTest, ReadMessageWithIPv4AddressAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg, kStunMessageWithIPv4MappedAddress);
  CheckStunHeader(msg, STUN_BINDING_RESPONSE, size);
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);

  const StunAddressAttribute* addr = msg.GetAddress(STUN_ATTR_MAPPED_ADDRESS);
  talk_base::IPAddress test_address(kIPv4TestAddress1);
  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV4,
                            kTestMessagePort4, test_address);
}

TEST_F(StunTest, ReadMessageWithIPv4XorAddressAttribute) {
  StunMessage msg;
  StunMessage msg2;
  size_t size = ReadStunMessage(&msg, kStunMessageWithIPv4XorMappedAddress);
  CheckStunHeader(msg, STUN_BINDING_RESPONSE, size);
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);

  const StunAddressAttribute* addr =
      msg.GetAddress(STUN_ATTR_XOR_MAPPED_ADDRESS);
  talk_base::IPAddress test_address(kIPv4TestAddress1);
  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV4,
                            kTestMessagePort3, test_address);
}

TEST_F(StunTest, ReadMessageWithIPv6AddressAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg, kStunMessageWithIPv6MappedAddress);
  CheckStunHeader(msg, STUN_BINDING_REQUEST, size);
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);

  talk_base::IPAddress test_address(kIPv6TestAddress1);

  const StunAddressAttribute* addr = msg.GetAddress(STUN_ATTR_MAPPED_ADDRESS);
  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV6,
                            kTestMessagePort2, test_address);
}

TEST_F(StunTest, ReadMessageWithInvalidAddressAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg, kStunMessageWithIPv6MappedAddress);
  CheckStunHeader(msg, STUN_BINDING_REQUEST, size);
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);

  talk_base::IPAddress test_address(kIPv6TestAddress1);

  const StunAddressAttribute* addr = msg.GetAddress(STUN_ATTR_MAPPED_ADDRESS);
  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV6,
                            kTestMessagePort2, test_address);
}

TEST_F(StunTest, ReadMessageWithIPv6XorAddressAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg, kStunMessageWithIPv6XorMappedAddress);

  talk_base::IPAddress test_address(kIPv6TestAddress1);

  CheckStunHeader(msg, STUN_BINDING_RESPONSE, size);
  CheckStunTransactionID(msg, kTestTransactionId2, kStunTransactionIdLength);

  const StunAddressAttribute* addr =
      msg.GetAddress(STUN_ATTR_XOR_MAPPED_ADDRESS);
  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV6,
                            kTestMessagePort1, test_address);
}

TEST_F(StunTest, SetIPv6XorAddressAttributeOwner) {
  StunMessage msg;
  StunMessage msg2;
  size_t size = ReadStunMessage(&msg, kStunMessageWithIPv6XorMappedAddress);

  talk_base::IPAddress test_address(kIPv6TestAddress1);

  CheckStunHeader(msg, STUN_BINDING_RESPONSE, size);
  CheckStunTransactionID(msg, kTestTransactionId2, kStunTransactionIdLength);

  const StunAddressAttribute* addr =
      msg.GetAddress(STUN_ATTR_XOR_MAPPED_ADDRESS);
  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV6,
                            kTestMessagePort1, test_address);

  // Owner with a different transaction ID.
  msg2.SetTransactionID("ABCDABCDABCD");
  StunXorAddressAttribute addr2(STUN_ATTR_XOR_MAPPED_ADDRESS, 20);
  addr2.SetIP(addr->ipaddr());
  addr2.SetPort(addr->port());
  addr2.SetOwner(&msg2);
  // The internal IP address shouldn't change.
  ASSERT_EQ(addr2.ipaddr(), addr->ipaddr());

  talk_base::ByteBuffer correct_buf;
  talk_base::ByteBuffer wrong_buf;
  addr->Write(&correct_buf);
  addr2.Write(&wrong_buf);
  // But when written out, the buffers should look different.
  ASSERT_NE(0, std::memcmp(correct_buf.Data(),
                           wrong_buf.Data(),
                           wrong_buf.Length()));
  // And when reading a known good value, the address should be wrong
  addr2.Read(&correct_buf);
  ASSERT_NE(addr->ipaddr(), addr2.ipaddr());
  addr2.SetIP(addr->ipaddr());
  addr2.SetPort(addr->port());
  // Try writing with no owner at all. Should write 4 bytes (1 byte reserved,
  // 2 bytes port, 1 byte address family, 0 bytes address). This is an invalid
  // but well-formed address attribute.
  addr2.SetOwner(NULL);
  ASSERT_EQ(addr2.ipaddr(), addr->ipaddr());
  wrong_buf.Shift(wrong_buf.Length());
  addr2.Write(&wrong_buf);
  ASSERT_EQ(4U, wrong_buf.Length());
  ASSERT_NE(wrong_buf.Length(), correct_buf.Length());
  ASSERT_NE(0, std::memcmp(correct_buf.Data(),
                           wrong_buf.Data(),
                           wrong_buf.Length()));
}

TEST_F(StunTest, SetIPv4XorAddressAttributeOwner) {
  // Unlike the IPv6XorAddressAttributeOwner test, IPv4 XOR address attributes
  // should _not_ be affected by a change in owner. IPv4 XOR address uses the
  // magic cookie value which is fixed.
  StunMessage msg;
  StunMessage msg2;
  size_t size = ReadStunMessage(&msg, kStunMessageWithIPv4XorMappedAddress);

  talk_base::IPAddress test_address(kIPv4TestAddress1);

  CheckStunHeader(msg, STUN_BINDING_RESPONSE, size);
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);

  const StunAddressAttribute* addr =
      msg.GetAddress(STUN_ATTR_XOR_MAPPED_ADDRESS);
  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV4,
                            kTestMessagePort3, test_address);

  // Owner with a different transaction ID.
  msg2.SetTransactionID("ABCDABCDABCD");
  StunXorAddressAttribute addr2(STUN_ATTR_XOR_MAPPED_ADDRESS, 20);
  addr2.SetIP(addr->ipaddr());
  addr2.SetPort(addr->port());
  addr2.SetOwner(&msg2);
  // The internal IP address shouldn't change.
  ASSERT_EQ(addr2.ipaddr(), addr->ipaddr());

  talk_base::ByteBuffer correct_buf;
  talk_base::ByteBuffer wrong_buf;
  addr->Write(&correct_buf);
  addr2.Write(&wrong_buf);
  // The same address data should be written.
  ASSERT_EQ(0, std::memcmp(correct_buf.Data(),
                           wrong_buf.Data(),
                           wrong_buf.Length()));
  // And an attribute should be able to un-XOR an address belonging to a message
  // with a different transaction ID.
  addr2.Read(&correct_buf);
  ASSERT_EQ(addr->ipaddr(), addr2.ipaddr());

  // However, no owner is still an error. Write 4 bytes and a 0 length address.
  addr2.SetOwner(NULL);
  ASSERT_EQ(addr2.ipaddr(), addr->ipaddr());
  wrong_buf.Shift(wrong_buf.Length());
  addr2.Write(&wrong_buf);
  ASSERT_NE(wrong_buf.Length(), correct_buf.Length());
  ASSERT_NE(0, std::memcmp(correct_buf.Data(),
                           wrong_buf.Data(),
                           wrong_buf.Length()));
}

TEST_F(StunTest, CreateIPv6AddressAttribute) {
  talk_base::IPAddress test_ip(kIPv6TestAddress2);

  StunAddressAttribute* addr =
      StunAttribute::CreateAddress(STUN_ATTR_MAPPED_ADDRESS);
  talk_base::SocketAddress test_addr(test_ip, kTestMessagePort2);
  addr->SetAddress(test_addr);

  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV6,
                            kTestMessagePort2, test_ip);
  delete addr;
}

TEST_F(StunTest, CreateIPv4AddressAttribute) {
  struct in_addr test_in_addr;
  test_in_addr.s_addr = 0xBEB0B0BE;
  talk_base::IPAddress test_ip(test_in_addr);

  StunAddressAttribute* addr =
      StunAttribute::CreateAddress(STUN_ATTR_MAPPED_ADDRESS);
  talk_base::SocketAddress test_addr(test_ip, kTestMessagePort2);
  addr->SetAddress(test_addr);

  CheckStunAddressAttribute(addr, STUN_ADDRESS_IPV4,
                            kTestMessagePort2, test_ip);
  delete addr;
}

TEST_F(StunTest, WriteMessageWithIPv6AddressAttribute) {
  StunMessage msg;
  size_t size = sizeof(kStunMessageWithIPv6MappedAddress);

  talk_base::IPAddress test_ip(kIPv6TestAddress1);

  msg.SetType(STUN_BINDING_REQUEST);
  msg.SetTransactionID(
      std::string(reinterpret_cast<const char*>(kTestTransactionId1),
                  kStunTransactionIdLength));
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);

  StunAddressAttribute* addr =
      StunAttribute::CreateAddress(STUN_ATTR_MAPPED_ADDRESS);
  talk_base::SocketAddress test_addr(test_ip, kTestMessagePort2);
  addr->SetAddress(test_addr);
  msg.AddAttribute(addr);

  CheckStunHeader(msg, STUN_BINDING_REQUEST, (size - 20));

  talk_base::ByteBuffer out;
  msg.Write(&out);
  ASSERT_EQ(out.Length(), sizeof(kStunMessageWithIPv6MappedAddress));
  int len1 = out.Length();
  std::string bytes;
  out.ReadString(&bytes, len1);
  ASSERT_EQ(0, std::memcmp(bytes.c_str(),
                           kStunMessageWithIPv6MappedAddress,
                           len1));
}

TEST_F(StunTest, WriteMessageWithIPv4AddressAttribute) {
  StunMessage msg;
  size_t size = sizeof(kStunMessageWithIPv4MappedAddress);

  talk_base::IPAddress test_ip(kIPv4TestAddress1);

  msg.SetType(STUN_BINDING_RESPONSE);
  msg.SetTransactionID(
      std::string(reinterpret_cast<const char*>(kTestTransactionId1),
                  kStunTransactionIdLength));
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);

  StunAddressAttribute* addr =
      StunAttribute::CreateAddress(STUN_ATTR_MAPPED_ADDRESS);
  talk_base::SocketAddress test_addr(test_ip, kTestMessagePort4);
  addr->SetAddress(test_addr);
  msg.AddAttribute(addr);

  CheckStunHeader(msg, STUN_BINDING_RESPONSE, (size - 20));

  talk_base::ByteBuffer out;
  msg.Write(&out);
  ASSERT_EQ(out.Length(), sizeof(kStunMessageWithIPv4MappedAddress));
  int len1 = out.Length();
  std::string bytes;
  out.ReadString(&bytes, len1);
  ASSERT_EQ(0, std::memcmp(bytes.c_str(),
                           kStunMessageWithIPv4MappedAddress,
                           len1));
}

TEST_F(StunTest, WriteMessageWithIPv6XorAddressAttribute) {
  StunMessage msg;
  size_t size = sizeof(kStunMessageWithIPv6XorMappedAddress);

  talk_base::IPAddress test_ip(kIPv6TestAddress1);

  msg.SetType(STUN_BINDING_RESPONSE);
  msg.SetTransactionID(
      std::string(reinterpret_cast<const char*>(kTestTransactionId2),
                  kStunTransactionIdLength));
  CheckStunTransactionID(msg, kTestTransactionId2, kStunTransactionIdLength);

  StunAddressAttribute* addr =
      StunAttribute::CreateAddress(STUN_ATTR_XOR_MAPPED_ADDRESS);
  talk_base::SocketAddress test_addr(test_ip, kTestMessagePort1);
  addr->SetAddress(test_addr);
  msg.AddAttribute(addr);

  CheckStunHeader(msg, STUN_BINDING_RESPONSE, (size - 20));

  talk_base::ByteBuffer out;
  msg.Write(&out);
  ASSERT_EQ(out.Length(), sizeof(kStunMessageWithIPv6XorMappedAddress));
  int len1 = out.Length();
  std::string bytes;
  out.ReadString(&bytes, len1);
  ASSERT_EQ(0, std::memcmp(bytes.c_str(),
                           kStunMessageWithIPv6XorMappedAddress,
                           len1));
}

TEST_F(StunTest, WriteMessageWithIPv4XoreAddressAttribute) {
  StunMessage msg;
  size_t size = sizeof(kStunMessageWithIPv4XorMappedAddress);

  talk_base::IPAddress test_ip(kIPv4TestAddress1);

  msg.SetType(STUN_BINDING_RESPONSE);
  msg.SetTransactionID(
      std::string(reinterpret_cast<const char*>(kTestTransactionId1),
                  kStunTransactionIdLength));
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);

  StunAddressAttribute* addr =
      StunAttribute::CreateAddress(STUN_ATTR_XOR_MAPPED_ADDRESS);
  talk_base::SocketAddress test_addr(test_ip, kTestMessagePort3);
  addr->SetAddress(test_addr);
  msg.AddAttribute(addr);

  CheckStunHeader(msg, STUN_BINDING_RESPONSE, (size - 20));

  talk_base::ByteBuffer out;
  msg.Write(&out);
  ASSERT_EQ(out.Length(), sizeof(kStunMessageWithIPv4XorMappedAddress));
  int len1 = out.Length();
  std::string bytes;
  out.ReadString(&bytes, len1);
  ASSERT_EQ(0, std::memcmp(bytes.c_str(),
                           kStunMessageWithIPv4XorMappedAddress,
                           len1));
}

TEST_F(StunTest, ReadByteStringAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg, kStunMessageWithByteStringAttribute);

  CheckStunHeader(msg, STUN_BINDING_REQUEST, size);
  CheckStunTransactionID(msg, kTestTransactionId2, kStunTransactionIdLength);
  const StunByteStringAttribute* username =
      msg.GetByteString(STUN_ATTR_USERNAME);
  ASSERT_EQ(0, std::memcmp(kTestUserName1, username->bytes(),
                           username->length()));
}

TEST_F(StunTest, ReadPaddedByteStringAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg,
                                kStunMessageWithPaddedByteStringAttribute);
  ASSERT_NE(0U, size);
  CheckStunHeader(msg, STUN_BINDING_REQUEST, size);
  CheckStunTransactionID(msg, kTestTransactionId2, kStunTransactionIdLength);
  const StunByteStringAttribute* username =
      msg.GetByteString(STUN_ATTR_USERNAME);
  ASSERT_EQ(0, std::memcmp(kTestUserName2, username->bytes(),
                           username->length()));
}

TEST_F(StunTest, ReadErrorCodeAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg, kStunMessageWithErrorAttribute);

  CheckStunHeader(msg, STUN_ALLOCATE_ERROR_RESPONSE, size);
  CheckStunTransactionID(msg, kTestTransactionId1, kStunTransactionIdLength);
  const StunErrorCodeAttribute* errorcode = msg.GetErrorCode();
  ASSERT_EQ(kTestErrorClass, errorcode->error_class());
  ASSERT_EQ(kTestErrorNumber, errorcode->number());
  std::string reason = errorcode->reason();
  ASSERT_EQ(0, strcmp(reason.c_str(), kTestErrorReason));
}

TEST_F(StunTest, ReadMessageWithAnUnknownAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg, kStunMessageWithUnknownAttribute);
  CheckStunHeader(msg, STUN_BINDING_REQUEST, size);

  // Parsing should have succeeded and there should be a lifetime attribute
  const StunUInt32Attribute* uval = msg.GetUInt32(STUN_ATTR_LIFETIME);
  EXPECT_TRUE(uval != NULL);
  if (uval != NULL) {
    EXPECT_EQ(11U, uval->value());
  }
}

TEST_F(StunTest, ReadMessageWithAUInt16ListAttribute) {
  StunMessage msg;
  size_t size = ReadStunMessage(&msg, kStunMessageWithUInt16ListAttribute);
  CheckStunHeader(msg, STUN_BINDING_REQUEST, size);
  const StunUInt16ListAttribute* types = msg.GetUnknownAttributes();
  EXPECT_EQ(3U, types->Size());
  EXPECT_EQ(0x1U, types->GetType(0));
  EXPECT_EQ(0x1000U, types->GetType(1));
  EXPECT_EQ(0xAB0CU, types->GetType(2));
}

TEST_F(StunTest, WriteMessageWithAUInt16ListAttribute) {
  StunMessage msg;
  size_t size = sizeof(kStunMessageWithUInt16ListAttribute);

  msg.SetType(STUN_BINDING_REQUEST);
  msg.SetTransactionID(
      std::string(reinterpret_cast<const char*>(kTestTransactionId2),
                  kStunTransactionIdLength));
  CheckStunTransactionID(msg, kTestTransactionId2, kStunTransactionIdLength);
  StunUInt16ListAttribute* list = StunAttribute::CreateUnknownAttributes();
  list->AddType(0x1U);
  list->AddType(0x1000U);
  list->AddType(0xAB0CU);
  msg.AddAttribute(list);
  CheckStunHeader(msg, STUN_BINDING_REQUEST, (size - 20));

  talk_base::ByteBuffer out;
  msg.Write(&out);
  ASSERT_EQ(size, out.Length());
  // Check everything up to the padding.
  ASSERT_EQ(0, std::memcmp(out.Data(), kStunMessageWithUInt16ListAttribute,
                           size - 2));
}

void CheckFailureToRead(const unsigned char* testcase, size_t length) {
  StunMessage msg;
  const char* input = reinterpret_cast<const char*>(testcase);
  talk_base::ByteBuffer buf(input, length);
  ASSERT_FALSE(msg.Read(&buf));
}

TEST_F(StunTest, FailToReadInvalidMessages) {
  CheckFailureToRead(kStunMessageWithZeroLength,
                     kRealLengthOfInvalidLengthTestCases);
  CheckFailureToRead(kStunMessageWithSmallLength,
                     kRealLengthOfInvalidLengthTestCases);
  CheckFailureToRead(kStunMessageWithExcessLength,
                     kRealLengthOfInvalidLengthTestCases);
}

#undef ReadStunMessage

// Test that we don't care what order we set the parts of an address
TEST_F(StunTest, CreateAddressInArbitraryOrder) {
  StunAddressAttribute* addr =
    StunAttribute::CreateAddress(STUN_ATTR_DESTINATION_ADDRESS);
  // Port first
  addr->SetPort(kTestMessagePort1);
  addr->SetIP(talk_base::IPAddress(kIPv4TestAddress1));
  ASSERT_EQ(kTestMessagePort1, addr->port());
  ASSERT_EQ(talk_base::IPAddress(kIPv4TestAddress1), addr->ipaddr());

  StunAddressAttribute* addr2 =
    StunAttribute::CreateAddress(STUN_ATTR_DESTINATION_ADDRESS);
  // IP first
  addr2->SetIP(talk_base::IPAddress(kIPv4TestAddress1));
  addr2->SetPort(kTestMessagePort2);
  ASSERT_EQ(kTestMessagePort2, addr2->port());
  ASSERT_EQ(talk_base::IPAddress(kIPv4TestAddress1), addr2->ipaddr());

  delete addr;
  delete addr2;
}

// Legacy test bodies
static void DoTest(const char* input, size_t size, const char* transaction_id) {
  StunMessage msg, msg2;
  in_addr legacy_in_addr;
  legacy_in_addr.s_addr = htonl(17U);
  talk_base::IPAddress legacy_ip(legacy_in_addr);

  talk_base::ByteBuffer buf(input, size);
  EXPECT_TRUE(msg.Read(&buf));

  EXPECT_EQ(STUN_BINDING_REQUEST, msg.type());
  EXPECT_EQ(size - 20, msg.length());
  EXPECT_EQ(transaction_id, msg.transaction_id());

  msg2.SetType(STUN_BINDING_REQUEST);
  msg2.SetTransactionID(transaction_id);

  const StunAddressAttribute* addr = msg.GetAddress(STUN_ATTR_MAPPED_ADDRESS);
  ASSERT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(legacy_ip, addr->ipaddr());

  StunAddressAttribute* addr2 =
      StunAttribute::CreateAddress(STUN_ATTR_MAPPED_ADDRESS);
  addr2->SetPort(13);
  addr2->SetIP(legacy_ip);
  msg2.AddAttribute(addr2);

  const StunByteStringAttribute* bytes = msg.GetByteString(STUN_ATTR_USERNAME);
  ASSERT_TRUE(bytes != NULL);
  EXPECT_EQ(12, bytes->length());
  EXPECT_EQ(0, std::memcmp(bytes->bytes(), "abcdefghijkl", bytes->length()));

  StunByteStringAttribute* bytes2 =
      StunAttribute::CreateByteString(STUN_ATTR_USERNAME);
  bytes2->CopyBytes("abcdefghijkl");
  msg2.AddAttribute(bytes2);

  bytes = msg.GetByteString(STUN_ATTR_MESSAGE_INTEGRITY);
  ASSERT_TRUE(bytes != NULL);
  EXPECT_EQ(20, bytes->length());
  EXPECT_EQ(0, std::memcmp(bytes->bytes(),
                      "abcdefghijklmnopqrst",
                      bytes->length()));

  bytes2 = StunAttribute::CreateByteString(STUN_ATTR_MESSAGE_INTEGRITY);
  bytes2->CopyBytes("abcdefghijklmnopqrst");
  msg2.AddAttribute(bytes2);

  const StunErrorCodeAttribute* ecode = msg.GetErrorCode();
  ASSERT_TRUE(ecode != NULL);
  EXPECT_EQ(2, ecode->error_class());
  EXPECT_EQ(10, ecode->number());
  EXPECT_EQ("foo bar!", ecode->reason());

  StunErrorCodeAttribute* ecode2 = StunAttribute::CreateErrorCode();
  ecode2->SetErrorClass(2);
  ecode2->SetNumber(10);
  ecode2->SetReason("foo bar!");
  msg2.AddAttribute(ecode2);

  const StunUInt16ListAttribute* unknown = msg.GetUnknownAttributes();
  ASSERT_TRUE(unknown != NULL);
  EXPECT_EQ(2U, unknown->Size());
  EXPECT_EQ(1U, unknown->GetType(0));
  EXPECT_EQ(2U, unknown->GetType(1));

  StunUInt16ListAttribute* unknown2 = StunAttribute::CreateUnknownAttributes();
  unknown2->AddType(1);
  unknown2->AddType(2);
  msg2.AddAttribute(unknown2);

  const StunUInt32Attribute* uval = msg.GetUInt32(STUN_ATTR_LIFETIME);
  ASSERT_TRUE(uval != NULL);
  EXPECT_EQ(11U, uval->value());

  StunUInt32Attribute* uval2 = StunAttribute::CreateUInt32(STUN_ATTR_LIFETIME);
  uval2->SetValue(11);
  msg2.AddAttribute(uval2);

  bytes = msg.GetByteString(STUN_ATTR_MAGIC_COOKIE);
  ASSERT_TRUE(bytes != NULL);
  EXPECT_EQ(4, bytes->length());
  EXPECT_EQ(0, std::memcmp(bytes->bytes(), TURN_MAGIC_COOKIE_VALUE,
                           sizeof(TURN_MAGIC_COOKIE_VALUE)));

  bytes2 = StunAttribute::CreateByteString(STUN_ATTR_MAGIC_COOKIE);
  bytes2->CopyBytes(reinterpret_cast<const char*>(TURN_MAGIC_COOKIE_VALUE),
                    sizeof(TURN_MAGIC_COOKIE_VALUE));
  msg2.AddAttribute(bytes2);

  uval = msg.GetUInt32(STUN_ATTR_BANDWIDTH);
  ASSERT_TRUE(uval != NULL);
  EXPECT_EQ(6U, uval->value());

  uval2 = StunAttribute::CreateUInt32(STUN_ATTR_BANDWIDTH);
  uval2->SetValue(6);
  msg2.AddAttribute(uval2);

  addr = msg.GetAddress(STUN_ATTR_DESTINATION_ADDRESS);
  ASSERT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(legacy_ip, addr->ipaddr());

  addr2 = StunAttribute::CreateAddress(STUN_ATTR_DESTINATION_ADDRESS);
  addr2->SetPort(13);
  addr2->SetIP(legacy_ip);
  msg2.AddAttribute(addr2);

  addr = msg.GetAddress(STUN_ATTR_SOURCE_ADDRESS2);
  ASSERT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(legacy_ip, addr->ipaddr());

  addr2 = StunAttribute::CreateAddress(STUN_ATTR_SOURCE_ADDRESS2);
  addr2->SetPort(13);
  addr2->SetIP(legacy_ip);
  msg2.AddAttribute(addr2);

  bytes = msg.GetByteString(STUN_ATTR_DATA);
  ASSERT_TRUE(bytes != NULL);
  EXPECT_EQ(7, bytes->length());
  EXPECT_EQ(0, std::memcmp(bytes->bytes(), "abcdefg", bytes->length()));

  bytes2 = StunAttribute::CreateByteString(STUN_ATTR_DATA);
  bytes2->CopyBytes("abcdefg");
  msg2.AddAttribute(bytes2);

  talk_base::ByteBuffer out;
  msg.Write(&out);
  EXPECT_EQ(size, out.Length());
  size_t len1 = out.Length();
  std::string outstring;
  out.ReadString(&outstring, len1);
  EXPECT_EQ(0, std::memcmp(outstring.c_str(), input, len1));

  talk_base::ByteBuffer out2;
  msg2.Write(&out2);
  EXPECT_EQ(size, out2.Length());
  size_t len2 = out2.Length();
  std::string outstring2;
  out2.ReadString(&outstring2, len2);
  EXPECT_EQ(0, std::memcmp(outstring2.c_str(), input, len2));
}

TEST_F(StunTest, TestStunPacket) {
  DoTest(reinterpret_cast<const char*>(kStunMessageWithManyAttributes),
         sizeof(kStunMessageWithManyAttributes),
         "0123456789ab");
}

TEST_F(StunTest, TestRejectsRtcpPacket) {
  StunMessage msg;

  talk_base::ByteBuffer buf(
      reinterpret_cast<const char*>(kRtcpPacket), sizeof(kRtcpPacket));
  EXPECT_FALSE(msg.Read(&buf));
}

TEST_F(StunTest, TestLegacyPacket) {
  // The RFC3489 packet in this test is the same as
  // kStunMessageWithManyAttributes, but with a different value where the
  // magic cookie was.
  talk_base::scoped_array<char>
      rfc3489_packet(new char[sizeof(kStunMessageWithManyAttributes)]);
  memcpy(rfc3489_packet.get(), kStunMessageWithManyAttributes,
         sizeof(kStunMessageWithManyAttributes));
  // Overwrites the magic cookie here.
  memcpy(&rfc3489_packet[4], &kStunMessageWithManyAttributes[8], 4);

  DoTest(reinterpret_cast<const char*>(rfc3489_packet.get()),
         sizeof(kStunMessageWithManyAttributes), "01230123456789ab");
}

TEST_F(StunTest, TestValidateMessageIntegrity) {
  StunMessage msg1;
  talk_base::ByteBuffer buf(reinterpret_cast<const char*>(
      kRfc5769SampleRequest), sizeof(kRfc5769SampleRequest));
  EXPECT_TRUE(msg1.Read(&buf));
  EXPECT_TRUE(msg1.ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kRfc5769SampleRequest),
      sizeof(kRfc5769SampleRequest),
      kRfc5769SampleMsgPassword));
  EXPECT_FALSE(msg1.ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kRfc5769SampleRequest),
      sizeof(kRfc5769SampleRequest),
      "InvalidPassword"));

  StunMessage msg2;
  talk_base::ByteBuffer buf2(
      reinterpret_cast<const char*>(kRfc5769SampleResponse),
      sizeof(kRfc5769SampleResponse));
  EXPECT_TRUE(msg2.Read(&buf2));
  EXPECT_TRUE(msg2.ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kRfc5769SampleResponse),
      sizeof(kRfc5769SampleResponse),
      kRfc5769SampleMsgPassword));
  EXPECT_FALSE(msg2.ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kRfc5769SampleResponse),
      sizeof(kRfc5769SampleResponse),
      "InvalidPassword"));

  StunMessage msg3;
  talk_base::ByteBuffer buf3(
      reinterpret_cast<const char*>(kRfc5769SampleIPv6Response),
      sizeof(kRfc5769SampleIPv6Response));
  EXPECT_TRUE(msg3.Read(&buf3));
  EXPECT_TRUE(msg3.ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kRfc5769SampleIPv6Response),
      sizeof(kRfc5769SampleIPv6Response),
      kRfc5769SampleMsgPassword));
  EXPECT_FALSE(msg3.ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kRfc5769SampleIPv6Response),
      sizeof(kRfc5769SampleIPv6Response),
      "InvalidPassword"));

  EXPECT_FALSE(StunMessage::ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kStunMessageWithZeroLength),
      sizeof(kStunMessageWithZeroLength),
      kRfc5769SampleMsgPassword));

  EXPECT_FALSE(StunMessage::ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kStunMessageWithExcessLength),
      sizeof(kStunMessageWithExcessLength),
      kRfc5769SampleMsgPassword));

  EXPECT_FALSE(StunMessage::ValidateMessageIntegrity(
      reinterpret_cast<const char*>(kStunMessageWithSmallLength),
      sizeof(kStunMessageWithSmallLength),
      kRfc5769SampleMsgPassword));
}

TEST_F(StunTest, TestAddMessageIntegrity) {
  StunMessage msg;
  talk_base::ByteBuffer buf(
      reinterpret_cast<const char*>(kRfc5769RequestWithoutMI),
      sizeof(kRfc5769RequestWithoutMI));
  EXPECT_TRUE(msg.Read(&buf));
  msg.AddMessageIntegrity(kRfc5769SampleMsgPassword);
  const StunByteStringAttribute* mi_attr =
      msg.GetByteString(STUN_ATTR_MESSAGE_INTEGRITY);
  EXPECT_EQ(20U, mi_attr->length());
  EXPECT_EQ(0, std::memcmp(
      mi_attr->bytes(), kCalculatedHmac1, sizeof(kCalculatedHmac1)));

  talk_base::ByteBuffer buf1;
  msg.Write(&buf1);
  EXPECT_TRUE(msg.ValidateMessageIntegrity(
        reinterpret_cast<const char*>(buf1.Data()), buf1.Length(),
        kRfc5769SampleMsgPassword));


  StunMessage msg2;
  talk_base::ByteBuffer buf2(
      reinterpret_cast<const char*>(kRfc5769SampleResponseWithoutMI),
      sizeof(kRfc5769SampleResponseWithoutMI));
  EXPECT_TRUE(msg2.Read(&buf2));
  msg2.AddMessageIntegrity(kRfc5769SampleMsgPassword);
  const StunByteStringAttribute* mi_attr2 =
      msg2.GetByteString(STUN_ATTR_MESSAGE_INTEGRITY);
  EXPECT_EQ(20U, mi_attr2->length());
  EXPECT_EQ(0, std::memcmp(
      mi_attr2->bytes(), kCalculatedHmac2, sizeof(kCalculatedHmac2)));

  talk_base::ByteBuffer buf3;
  msg2.Write(&buf3);
  EXPECT_TRUE(msg2.ValidateMessageIntegrity(
        reinterpret_cast<const char*>(buf3.Data()), buf3.Length(),
        kRfc5769SampleMsgPassword));
}

}  // namespace cricket
