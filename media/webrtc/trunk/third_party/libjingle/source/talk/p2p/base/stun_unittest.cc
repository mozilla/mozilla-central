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
#include "talk/p2p/base/stun.h"

using namespace cricket;

static const unsigned char INPUT_STUN[] = {
  0x00, 0x01, 0x00, 135,   // message header
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
  'a', 'b', 'c', 'd', 'e', 'f', 'g'
};


// RTCP packet, for testing we correctly ignore non stun packet types.
// V=2, P=false, RC=0, Type=200, Len=6, Sender-SSRC=85, etc
static const unsigned char INPUT_RTCP[] = {
  0x80, 0xc8, 0x00, 0x06, 0x00, 0x00, 0x00, 0x55,
  0xce, 0xa5, 0x18, 0x3a, 0x39, 0xcc, 0x7d, 0x09,
  0x23, 0xed, 0x19, 0x07, 0x00, 0x00, 0x01, 0x56,
  0x00, 0x03, 0x73, 0x50,
};

// STUN packet with a legacy header.
static const unsigned char INPUT_LEGACY[] = {
  0x00, 0x01, 0x00, 135,   // message header
  '0', '1', '2', '3',      // transaction id
  '4', '5', '6', '7',
  '8', '9', 'a', 'b',
  'c', 'd', 'e', 'f',
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
  'a', 'b', 'c', 'd', 'e', 'f', 'g'
};

static const unsigned char INPUT_STUN_UNKNOWN_ATTR[] = {
  0x00, 0x01, 0x00, 0x1F,  // message header
  0x21, 0x12, 0xA4, 0x42,  // magic cookie
  '0', '1', '2', '3',      // transaction id
  '4', '5', '6', '7',
  '8', '9', 'a', 'b',
  0x00, 0x01, 0x00, 8,     // mapped address
  0x00, 0x01, 0x00, 13,
  0x00, 0x00, 0x00, 17,
  0x00, 0xaa, 0x00, 7,     // unknown attribute
  'a', 'b', 'c', 'd', 'e', 'f', 'g',
  0x00, 0x0d, 0x00, 4,     // lifetime
  0x00, 0x00, 0x00, 11,
};

static const unsigned char INPUT_STUN_XOR_MAPPED_ADDRESS[] = {
  0x00, 0x01, 0x00, 0x0c,  // message header
  0x21, 0x12, 0xA4, 0x42,  // magic cookie
  '0', '1', '2', '3',      // transaction id
  '4', '5', '6', '7',
  '8', '9', 'a', 'b',
  0x00, 0x20, 0x00, 0x08,  // xor mapped address
  0x00, 0x01, 0x21, 0x1F,
  0x21, 0x12, 0xA4, 0x53,
};

static void DoTest(const char* input, size_t size, const char* transaction_id) {
  StunMessage msg, msg2;

  talk_base::ByteBuffer buf(input, size);
  EXPECT_TRUE(msg.Read(&buf));

  EXPECT_EQ(STUN_BINDING_REQUEST, msg.type());
  EXPECT_EQ(size - 20, msg.length());
  EXPECT_EQ(transaction_id, msg.transaction_id());

  msg2.SetType(STUN_BINDING_REQUEST);
  msg2.SetTransactionID(transaction_id);

  const StunAddressAttribute* addr = msg.GetAddress(STUN_ATTR_MAPPED_ADDRESS);
  EXPECT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(talk_base::IPAddress(17U), addr->ipaddr());

  StunAddressAttribute* addr2 =
      StunAttribute::CreateAddress(STUN_ATTR_MAPPED_ADDRESS);
  addr2->SetPort(13);
  addr2->SetIP(talk_base::IPAddress(17U));
  msg2.AddAttribute(addr2);

  const StunByteStringAttribute* bytes = msg.GetByteString(STUN_ATTR_USERNAME);
  EXPECT_TRUE(bytes != NULL);
  EXPECT_EQ(12, bytes->length());
  EXPECT_EQ(0, memcmp(bytes->bytes(), "abcdefghijkl", bytes->length()));

  StunByteStringAttribute* bytes2 =
      StunAttribute::CreateByteString(STUN_ATTR_USERNAME);
  bytes2->CopyBytes("abcdefghijkl");
  msg2.AddAttribute(bytes2);

  bytes = msg.GetByteString(STUN_ATTR_MESSAGE_INTEGRITY);
  EXPECT_TRUE(bytes != NULL);
  EXPECT_EQ(20, bytes->length());
  EXPECT_EQ(0, memcmp(bytes->bytes(), "abcdefghijklmnopqrst", bytes->length()));

  bytes2 = StunAttribute::CreateByteString(STUN_ATTR_MESSAGE_INTEGRITY);
  bytes2->CopyBytes("abcdefghijklmnopqrst");
  msg2.AddAttribute(bytes2);

  const StunErrorCodeAttribute* ecode = msg.GetErrorCode();
  EXPECT_TRUE(ecode != NULL);
  EXPECT_EQ(2, ecode->error_class());
  EXPECT_EQ(10, ecode->number());
  EXPECT_EQ("foo bar!", ecode->reason());

  StunErrorCodeAttribute* ecode2 = StunAttribute::CreateErrorCode();
  ecode2->SetErrorClass(2);
  ecode2->SetNumber(10);
  ecode2->SetReason("foo bar!");
  msg2.AddAttribute(ecode2);

  const StunUInt16ListAttribute* unknown = msg.GetUnknownAttributes();
  EXPECT_TRUE(unknown != NULL);
  EXPECT_EQ(2U, unknown->Size());
  EXPECT_EQ(1U, unknown->GetType(0));
  EXPECT_EQ(2U, unknown->GetType(1));

  StunUInt16ListAttribute* unknown2 = StunAttribute::CreateUnknownAttributes();
  unknown2->AddType(1);
  unknown2->AddType(2);
  msg2.AddAttribute(unknown2);

  const StunUInt32Attribute* uval = msg.GetUInt32(STUN_ATTR_LIFETIME);
  EXPECT_TRUE(uval != NULL);
  EXPECT_EQ(11U, uval->value());

  StunUInt32Attribute* uval2 = StunAttribute::CreateUInt32(STUN_ATTR_LIFETIME);
  uval2->SetValue(11);
  msg2.AddAttribute(uval2);

  bytes = msg.GetByteString(STUN_ATTR_MAGIC_COOKIE);
  EXPECT_TRUE(bytes != NULL);
  EXPECT_EQ(4, bytes->length());
  EXPECT_EQ(0, memcmp(bytes->bytes(), TURN_MAGIC_COOKIE_VALUE,
                      sizeof(TURN_MAGIC_COOKIE_VALUE)));

  bytes2 = StunAttribute::CreateByteString(STUN_ATTR_MAGIC_COOKIE);
  bytes2->CopyBytes(reinterpret_cast<const char*>(TURN_MAGIC_COOKIE_VALUE),
                    sizeof(TURN_MAGIC_COOKIE_VALUE));
  msg2.AddAttribute(bytes2);

  uval = msg.GetUInt32(STUN_ATTR_BANDWIDTH);
  EXPECT_TRUE(uval != NULL);
  EXPECT_EQ(6U, uval->value());

  uval2 = StunAttribute::CreateUInt32(STUN_ATTR_BANDWIDTH);
  uval2->SetValue(6);
  msg2.AddAttribute(uval2);

  addr = msg.GetAddress(STUN_ATTR_DESTINATION_ADDRESS);
  EXPECT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(talk_base::IPAddress(17U), addr->ipaddr());

  addr2 = StunAttribute::CreateAddress(STUN_ATTR_DESTINATION_ADDRESS);
  addr2->SetPort(13);
  addr2->SetIP(talk_base::IPAddress(17U));
  msg2.AddAttribute(addr2);

  addr = msg.GetAddress(STUN_ATTR_SOURCE_ADDRESS2);
  EXPECT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(talk_base::IPAddress(17U), addr->ipaddr());

  addr2 = StunAttribute::CreateAddress(STUN_ATTR_SOURCE_ADDRESS2);
  addr2->SetPort(13);
  addr2->SetIP(talk_base::IPAddress(17U));
  msg2.AddAttribute(addr2);

  bytes = msg.GetByteString(STUN_ATTR_DATA);
  EXPECT_TRUE(bytes != NULL);
  EXPECT_EQ(7, bytes->length());
  EXPECT_EQ(0, memcmp(bytes->bytes(), "abcdefg", bytes->length()));

  bytes2 = StunAttribute::CreateByteString(STUN_ATTR_DATA);
  bytes2->CopyBytes("abcdefg");
  msg2.AddAttribute(bytes2);

  talk_base::ByteBuffer out;
  msg.Write(&out);
  EXPECT_EQ(size, out.Length());
  EXPECT_EQ(0, memcmp(out.Data(), input, out.Length()));

  talk_base::ByteBuffer out2;
  msg2.Write(&out2);
  EXPECT_EQ(size, out2.Length());
  EXPECT_EQ(0, memcmp(out2.Data(), input, out2.Length()));
}

TEST(StunTest, TestStunPacket) {
  DoTest(reinterpret_cast<const char*>(INPUT_STUN), sizeof(INPUT_STUN),
         "0123456789ab");
}

TEST(StunTest, TestRejectsRtcpPacket) {
  StunMessage msg;

  talk_base::ByteBuffer buf(
      reinterpret_cast<const char*>(INPUT_RTCP), sizeof(INPUT_RTCP));
  EXPECT_FALSE(msg.Read(&buf));
}

TEST(StunTest, TestLegacyPacket) {
  DoTest(reinterpret_cast<const char*>(INPUT_LEGACY),
         sizeof(INPUT_LEGACY), "0123456789abcdef");
}

TEST(StunTest, TestIgnoreUnknownAttr) {
  StunMessage msg;
  talk_base::ByteBuffer buf(
      reinterpret_cast<const char*>(INPUT_STUN_UNKNOWN_ATTR),
      sizeof(INPUT_STUN_UNKNOWN_ATTR));
  EXPECT_TRUE(msg.Read(&buf));

  const StunAddressAttribute* addr = msg.GetAddress(STUN_ATTR_MAPPED_ADDRESS);
  EXPECT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(talk_base::IPAddress(17U), addr->ipaddr());

  const StunUInt32Attribute* uval = msg.GetUInt32(STUN_ATTR_LIFETIME);
  EXPECT_TRUE(uval != NULL);
  EXPECT_EQ(11U, uval->value());
}

TEST(StunTest, TestXorMappedAddress) {
  StunMessage msg;
  talk_base::ByteBuffer buf(
      reinterpret_cast<const char*>(INPUT_STUN_XOR_MAPPED_ADDRESS),
      sizeof(INPUT_STUN_XOR_MAPPED_ADDRESS));
  EXPECT_TRUE(msg.Read(&buf));

  const StunAddressAttribute* addr = msg.GetAddress(STUN_ATTR_MAPPED_ADDRESS);
  EXPECT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(talk_base::IPAddress(17U), addr->ipaddr());

  addr = msg.GetAddress(STUN_ATTR_XOR_MAPPED_ADDRESS);
  EXPECT_TRUE(addr != NULL);
  EXPECT_EQ(1, addr->family());
  EXPECT_EQ(13, addr->port());
  EXPECT_EQ(talk_base::IPAddress(17U), addr->ipaddr());
}
