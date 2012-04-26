/*
 * libjingle
 * Copyright 2011 Google Inc.
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
#include "talk/base/thread.h"
#include "talk/p2p/base/constants.h"
#include "talk/p2p/base/parsing.h"
#include "talk/p2p/base/p2ptransport.h"
#include "talk/p2p/base/rawtransport.h"
#include "talk/xmllite/xmlelement.h"
#include "talk/xmpp/constants.h"

using cricket::Candidate;
using cricket::WriteError;
using cricket::ParseError;
using talk_base::SocketAddress;

class TransportTest : public testing::Test,
                      public sigslot::has_slots<> {
 public:
  TransportTest()
      : thread_(talk_base::Thread::Current()),
        transport_(new cricket::P2PTransport(thread_, thread_, NULL)),
        connecting_signalled_(false) {
    transport_->SignalConnecting.connect(this, &TransportTest::OnConnecting);
  }

 protected:
  void OnConnecting(cricket::Transport* transport) {
    connecting_signalled_ = true;
  }

  talk_base::Thread* thread_;
  talk_base::scoped_ptr<cricket::P2PTransport> transport_;
  bool connecting_signalled_;
};

TEST_F(TransportTest, TestDestroyAllClearsPosts) {
  EXPECT_TRUE(transport_->CreateChannel("test", "media") != NULL);

  transport_->ConnectChannels();
  transport_->DestroyAllChannels();

  thread_->ProcessMessages(0);
  EXPECT_FALSE(connecting_signalled_);
}

TEST_F(TransportTest, TestConnectChannelsDoesSignal) {
  EXPECT_TRUE(transport_->CreateChannel("test", "media") != NULL);
  transport_->ConnectChannels();
  EXPECT_FALSE(connecting_signalled_);

  EXPECT_TRUE_WAIT(connecting_signalled_, 100);
}

TEST(TransportParserTest, TestP2PTransportWriteAndParseCandidate) {
  Candidate test_candidate("test", "udp",
                          talk_base::SocketAddress("2001:db8:fefe::1", 9999),
                          3.5f, "abcdef", "ghijkl", "foo", "testnet", 50);
  Candidate test_candidate2("test2", "tcp",
                           talk_base::SocketAddress("192.168.7.1", 9999),
                           6.0f, "mnopqr", "stuvwx", "bar", "testnet2", 100);
  talk_base::SocketAddress host_address("www.google.com", 24601);
  host_address.SetResolvedIP(talk_base::IPAddress(0x0A000001));
  Candidate test_candidate3("test3", "spdy", host_address, 9.9f, "yzabcd",
                           "efghij", "baz", "testnet3", 150);
  cricket::Candidates candidates;
  candidates.push_back(test_candidate);
  candidates.push_back(test_candidate2);
  candidates.push_back(test_candidate3);
  WriteError write_error;
  cricket::XmlElements elems;
  cricket::P2PTransportParser parser;

  EXPECT_TRUE(parser.WriteCandidates(cricket::PROTOCOL_GINGLE, candidates,
                                     &elems, &write_error));
  buzz::XmlElement* elem = elems[0];
  EXPECT_EQ("test", elem->Attr(buzz::QN_NAME));
  EXPECT_EQ("udp", elem->Attr(cricket::QN_PROTOCOL));
  EXPECT_EQ("2001:db8:fefe::1", elem->Attr(cricket::QN_ADDRESS));
  EXPECT_EQ("9999", elem->Attr(cricket::QN_PORT));
  EXPECT_EQ("3.5", elem->Attr(cricket::QN_PREFERENCE));
  EXPECT_EQ("abcdef", elem->Attr(cricket::QN_USERNAME));
  EXPECT_EQ("ghijkl", elem->Attr(cricket::QN_PASSWORD));
  EXPECT_EQ("foo", elem->Attr(cricket::QN_TYPE));
  EXPECT_EQ("testnet", elem->Attr(cricket::QN_NETWORK));
  EXPECT_EQ("50", elem->Attr(cricket::QN_GENERATION));

  elem = elems[1];
  EXPECT_EQ("test2", elem->Attr(buzz::QN_NAME));
  EXPECT_EQ("tcp", elem->Attr(cricket::QN_PROTOCOL));
  EXPECT_EQ("192.168.7.1", elem->Attr(cricket::QN_ADDRESS));
  EXPECT_EQ("9999", elem->Attr(cricket::QN_PORT));
  EXPECT_EQ("6", elem->Attr(cricket::QN_PREFERENCE));
  EXPECT_EQ("mnopqr", elem->Attr(cricket::QN_USERNAME));
  EXPECT_EQ("stuvwx", elem->Attr(cricket::QN_PASSWORD));
  EXPECT_EQ("bar", elem->Attr(cricket::QN_TYPE));
  EXPECT_EQ("testnet2", elem->Attr(cricket::QN_NETWORK));
  EXPECT_EQ("100", elem->Attr(cricket::QN_GENERATION));

  // Check that an ip is preferred over hostname.
  elem = elems[2];
  EXPECT_EQ("test3", elem->Attr(cricket::QN_NAME));
  EXPECT_EQ("spdy", elem->Attr(cricket::QN_PROTOCOL));
  EXPECT_EQ("10.0.0.1", elem->Attr(cricket::QN_ADDRESS));
  EXPECT_EQ("24601", elem->Attr(cricket::QN_PORT));
  EXPECT_EQ("9.9", elem->Attr(cricket::QN_PREFERENCE));
  EXPECT_EQ("yzabcd", elem->Attr(cricket::QN_USERNAME));
  EXPECT_EQ("efghij", elem->Attr(cricket::QN_PASSWORD));
  EXPECT_EQ("baz", elem->Attr(cricket::QN_TYPE));
  EXPECT_EQ("testnet3", elem->Attr(cricket::QN_NETWORK));
  EXPECT_EQ("150", elem->Attr(cricket::QN_GENERATION));

  // Test round-trip writing/parsing.
  ParseError parse_error;
  buzz::XmlElement dummy_element(cricket::QN_GINGLE_SESSION);
  dummy_element.AddElement(elems[0]);
  cricket::Candidates parsedCandidates;
  EXPECT_TRUE(parser.ParseCandidates(cricket::PROTOCOL_GINGLE, &dummy_element,
                                     &parsedCandidates, &parse_error));
  EXPECT_TRUE(test_candidate.IsEquivalent(parsedCandidates.back()));
  dummy_element.ClearChildren();  // Deletes elems[0].
  parsedCandidates.clear();

  dummy_element.AddElement(elems[1]);
  EXPECT_TRUE(parser.ParseCandidates(cricket::PROTOCOL_GINGLE, &dummy_element,
                                     &parsedCandidates, &parse_error));
  EXPECT_TRUE(test_candidate2.IsEquivalent(parsedCandidates.back()));
  dummy_element.ClearChildren();  // Deletes elems[1].
  parsedCandidates.clear();

  dummy_element.AddElement(elems[2]);
  EXPECT_TRUE(parser.ParseCandidates(cricket::PROTOCOL_GINGLE, &dummy_element,
                                     &parsedCandidates, &parse_error));
  EXPECT_TRUE(test_candidate3.IsEquivalent(parsedCandidates.back()));
  dummy_element.ClearChildren();  // Deletes elems[2].
}

#if defined(FEATURE_ENABLE_PSTN)
TEST(TransportParserTest, TestRawTransportWriteAndParseCandidate) {
  Candidate test_candidate("test", "udp",
                          talk_base::SocketAddress("2001:db8:fefe::1", 9999),
                          3.5f, "abcdef", "ghijkl", "foo", "testnet", 50);
  Candidate test_candidate2("test2", "udp",
                           talk_base::SocketAddress("192.168.7.1", 9999),
                           6.0f, "mnopqr", "stuvwx", "bar", "testnet2", 100);
  talk_base::SocketAddress host_address("www.google.com", 24601);
  host_address.SetResolvedIP(talk_base::IPAddress(0x0A000001));
  Candidate test_candidate3("test3", "udp", host_address, 9.9f, "yzabcd",
                           "efghij", "baz", "testnet3", 150);
  cricket::Candidates candidates;
  candidates.push_back(test_candidate);
  candidates.push_back(test_candidate2);
  candidates.push_back(test_candidate3);
  WriteError write_error;
  cricket::XmlElements elems;
  cricket::RawTransport parser(talk_base::Thread::Current(),
                               talk_base::Thread::Current(), NULL);
  parser.CreateChannel(cricket::NS_GINGLE_RAW, "udp");
  EXPECT_TRUE(parser.WriteCandidates(cricket::PROTOCOL_GINGLE, candidates,
                                     &elems, &write_error));
  buzz::XmlElement* elem = elems[0];
  EXPECT_EQ(std::string(cricket::NS_GINGLE_RAW), elem->Attr(buzz::QN_NAME));
  EXPECT_EQ("2001:db8:fefe::1", elem->Attr(cricket::QN_ADDRESS));
  EXPECT_EQ("9999", elem->Attr(cricket::QN_PORT));

  elem = elems[1];
  EXPECT_EQ(std::string(cricket::NS_GINGLE_RAW), elem->Attr(buzz::QN_NAME));
  EXPECT_EQ("192.168.7.1", elem->Attr(cricket::QN_ADDRESS));
  EXPECT_EQ("9999", elem->Attr(cricket::QN_PORT));

  // Check that an ip is preferred over hostname.
  elem = elems[2];
  EXPECT_EQ(std::string(cricket::NS_GINGLE_RAW), elem->Attr(cricket::QN_NAME));
  EXPECT_EQ("10.0.0.1", elem->Attr(cricket::QN_ADDRESS));
  EXPECT_EQ("24601", elem->Attr(cricket::QN_PORT));

  // Test round-trip writing/parsing.
  Candidate expectedCandidate;
  expectedCandidate.set_name(cricket::NS_GINGLE_RAW);
  expectedCandidate.set_address(SocketAddress("2001:db8:fefe::1", 9999));
  Candidate expectedCandidate2;
  expectedCandidate2.set_name(cricket::NS_GINGLE_RAW);
  expectedCandidate2.set_address(SocketAddress("192.168.7.1", 9999));
  Candidate expectedCandidate3;
  expectedCandidate3.set_name(cricket::NS_GINGLE_RAW);
  expectedCandidate3.set_address(SocketAddress("10.0.0.1", 24601));

  ParseError parse_error;
  buzz::XmlElement dummy_element(cricket::QN_GINGLE_SESSION);
  dummy_element.AddElement(elems[0]);
  cricket::Candidates parsedCandidates;
  EXPECT_TRUE(parser.ParseCandidates(cricket::PROTOCOL_GINGLE, &dummy_element,
                                     &parsedCandidates, &parse_error));
  EXPECT_TRUE(expectedCandidate.IsEquivalent(parsedCandidates.back()));
  dummy_element.ClearChildren();  // Deletes elems[0].
  parsedCandidates.clear();

  dummy_element.AddElement(elems[1]);
  EXPECT_TRUE(parser.ParseCandidates(cricket::PROTOCOL_GINGLE, &dummy_element,
                                     &parsedCandidates, &parse_error));
  EXPECT_TRUE(expectedCandidate2.IsEquivalent(parsedCandidates.back()));
  dummy_element.ClearChildren();  // Deletes elems[1].
  parsedCandidates.clear();

  dummy_element.AddElement(elems[2]);
  EXPECT_TRUE(parser.ParseCandidates(cricket::PROTOCOL_GINGLE, &dummy_element,
                                     &parsedCandidates, &parse_error));
  EXPECT_TRUE(expectedCandidate3.IsEquivalent(parsedCandidates.back()));
  dummy_element.ClearChildren();  // Deletes elems[2].
}
#endif  // defined(FEATURE_ENABLE_PSTN)
