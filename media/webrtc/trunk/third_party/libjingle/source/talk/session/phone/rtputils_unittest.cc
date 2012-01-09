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
#include "talk/session/phone/fakertp.h"
#include "talk/session/phone/rtputils.h"

namespace cricket {

static const unsigned char kRtpPacketWithMarker[] = {
    0x80, 0x80, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01
};
// 3 CSRCs (0x01020304, 0x12345678, 0xAABBCCDD)
// Extension (0xBEDE, 0x1122334455667788)
static const unsigned char kRtpPacketWithMarkerAndCsrcAndExtension[] = {
    0x93, 0x80, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    0x01, 0x02, 0x03, 0x04, 0x12, 0x34, 0x56, 0x78, 0xAA, 0xBB, 0xCC, 0xDD,
    0xBE, 0xDE, 0x00, 0x02, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88
};
static const unsigned char kInvalidPacket[] = { 0x80, 0x00 };
static const unsigned char kInvalidPacketWithCsrc[] = {
    0x83, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    0x01, 0x02, 0x03, 0x04, 0x12, 0x34, 0x56, 0x78, 0xAA, 0xBB, 0xCC
};
static const unsigned char kInvalidPacketWithCsrcAndExtension1[] = {
    0x93, 0x80, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    0x01, 0x02, 0x03, 0x04, 0x12, 0x34, 0x56, 0x78, 0xAA, 0xBB, 0xCC, 0xDD,
    0xBE, 0xDE, 0x00
};
static const unsigned char kInvalidPacketWithCsrcAndExtension2[] = {
    0x93, 0x80, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    0x01, 0x02, 0x03, 0x04, 0x12, 0x34, 0x56, 0x78, 0xAA, 0xBB, 0xCC, 0xDD,
    0xBE, 0xDE, 0x00, 0x02, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77
};

TEST(RtpUtilsTest, GetRtp) {
  int pt;
  EXPECT_TRUE(GetRtpPayloadType(kPcmuFrame, sizeof(kPcmuFrame), &pt));
  EXPECT_EQ(0, pt);
  EXPECT_TRUE(GetRtpPayloadType(kRtpPacketWithMarker,
                                sizeof(kRtpPacketWithMarker), &pt));
  EXPECT_EQ(0, pt);

  int seq_num;
  EXPECT_TRUE(GetRtpSeqNum(kPcmuFrame, sizeof(kPcmuFrame), &seq_num));
  EXPECT_EQ(1, seq_num);

  uint32 ts;
  EXPECT_TRUE(GetRtpTimestamp(kPcmuFrame, sizeof(kPcmuFrame), &ts));
  EXPECT_EQ(0u, ts);

  uint32 ssrc;
  EXPECT_TRUE(GetRtpSsrc(kPcmuFrame, sizeof(kPcmuFrame), &ssrc));
  EXPECT_EQ(1u, ssrc);

  EXPECT_FALSE(GetRtpPayloadType(kInvalidPacket, sizeof(kInvalidPacket), &pt));
  EXPECT_FALSE(GetRtpSeqNum(kInvalidPacket, sizeof(kInvalidPacket), &seq_num));
  EXPECT_FALSE(GetRtpTimestamp(kInvalidPacket, sizeof(kInvalidPacket), &ts));
  EXPECT_FALSE(GetRtpSsrc(kInvalidPacket, sizeof(kInvalidPacket), &ssrc));
}

TEST(RtpUtilsTest, GetRtpHeaderLen) {
  size_t len;
  EXPECT_TRUE(GetRtpHeaderLen(kPcmuFrame, sizeof(kPcmuFrame), &len));
  EXPECT_EQ(12U, len);

  EXPECT_TRUE(GetRtpHeaderLen(kRtpPacketWithMarkerAndCsrcAndExtension,
                              sizeof(kRtpPacketWithMarkerAndCsrcAndExtension),
                              &len));
  EXPECT_EQ(sizeof(kRtpPacketWithMarkerAndCsrcAndExtension), len);

  EXPECT_FALSE(GetRtpHeaderLen(kInvalidPacket, sizeof(kInvalidPacket), &len));
  EXPECT_FALSE(GetRtpHeaderLen(kInvalidPacketWithCsrc,
                               sizeof(kInvalidPacketWithCsrc), &len));
  EXPECT_FALSE(GetRtpHeaderLen(kInvalidPacketWithCsrcAndExtension1,
                               sizeof(kInvalidPacketWithCsrcAndExtension1),
                               &len));
  EXPECT_FALSE(GetRtpHeaderLen(kInvalidPacketWithCsrcAndExtension2,
                               sizeof(kInvalidPacketWithCsrcAndExtension2),
                               &len));
}

TEST(RtpUtilsTest, GetRtcp) {
  int pt;
  EXPECT_TRUE(GetRtcpType(kRtcpReport, sizeof(kRtcpReport), &pt));
  EXPECT_EQ(0xc9, pt);

  EXPECT_FALSE(GetRtcpType(kInvalidPacket, sizeof(kInvalidPacket), &pt));
}

}  // namespace cricket

