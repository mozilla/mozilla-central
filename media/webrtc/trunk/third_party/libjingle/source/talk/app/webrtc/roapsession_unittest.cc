/*
 * libjingle
 * Copyright 2011, Google Inc.
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

#include "talk/app/webrtc/roapmessages.h"
#include "talk/app/webrtc/roapsession.h"
#include "talk/base/gunit.h"
#include "talk/base/logging.h"
#include "talk/base/scoped_ptr.h"

using webrtc::RoapMessageBase;
using webrtc::RoapSession;
using webrtc::RoapAnswer;
using webrtc::RoapOffer;

// Reference sdp string
static const char kSdpDescription1[] =
    "m=fake content 1\r\n"
    "m=fake content 2\r\n";

static const char kSdpDescription2[] =
    "m=fake content 3\r\n"
    "m=fake content 4\r\n";

TEST(RoapSessionTest, OfferAnswer) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  std::string offer_message = roap_session1.CreateOffer(kSdpDescription1);

  // Check that it is valid to send to another peer.
  EXPECT_EQ(RoapSession::kOffer, roap_session2.Parse(offer_message));
  std::string received_offer(roap_session2.RemoteDescription());

  EXPECT_FALSE(received_offer.empty());
  EXPECT_EQ(kSdpDescription1, received_offer);

  std::string answer_message = roap_session2.CreateAnswer(kSdpDescription2);

  EXPECT_EQ(RoapSession::kAnswer, roap_session1.Parse(answer_message));
  std::string received_answer(roap_session1.RemoteDescription());

  EXPECT_EQ(kSdpDescription2, received_answer);
  EXPECT_NE(received_offer, received_answer);
}

TEST(RoapSessionTest, InvalidInitialization) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  std::string offer_message1 = roap_session1.CreateOffer(kSdpDescription1);
  std::string offer_message2 = roap_session2.CreateOffer(kSdpDescription2);

  // It is an error to receive an initial offer if you have sent an
  // initial offer.
  EXPECT_EQ(RoapSession::kInvalidMessage,
            roap_session1.Parse(offer_message2));

  EXPECT_EQ(RoapSession::kInvalidMessage,
            roap_session2.Parse(offer_message1));
}

TEST(RoapSessionTest, Glare) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  // Setup. Need to exchange an offer and an answer in order to test for glare.
  std::string offer_message1 = roap_session1.CreateOffer(kSdpDescription1);

  roap_session2.Parse(offer_message1);
  std::string answer_message2 = roap_session2.CreateAnswer(kSdpDescription2);
  roap_session1.Parse(answer_message2);

  // Ok- we should now have all we need. Create a glare condition by
  // updating the offer simultaneously.
  offer_message1 = roap_session1.CreateOffer(kSdpDescription2);
  std::string offer_message2 = roap_session2.CreateOffer(kSdpDescription1);

  EXPECT_TRUE(
      (RoapSession::kOffer == roap_session1.Parse(offer_message2) &&
      RoapSession::kParseConflict == roap_session2.Parse(offer_message1)) ||
      (RoapSession::kOffer == roap_session2.Parse(offer_message1) &&
      RoapSession::kParseConflict == roap_session1.Parse(offer_message2)));
}

// Test Glare resolution by setting different TieBreakers.
TEST(RoapSessionTest, TieBreaker) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  // Offer 1
  std::string offer_message1 = roap_session1.CreateOffer(kSdpDescription1);

  EXPECT_EQ(RoapSession::kOffer, roap_session2.Parse(offer_message1));
  std::string received_offer(roap_session2.RemoteDescription());
  std::string answer_message2 = roap_session2.CreateAnswer(kSdpDescription2);

  EXPECT_EQ(RoapSession::kAnswer, roap_session1.Parse(answer_message2));

  // Ok- we should now have all we need. Create a double conflict condition.
  offer_message1 = roap_session1.CreateOffer(kSdpDescription2);
  RoapMessageBase message_base;
  EXPECT_TRUE(message_base.Parse(offer_message1));
  RoapOffer message_offer(message_base);
  EXPECT_TRUE(message_offer.Parse());
  RoapOffer double_conflict_offer(message_offer.answer_session_id(),
                                  message_offer.offer_session_id(),
                                  "",
                                  message_offer.seq(),
                                  message_offer.tie_breaker(),
                                  kSdpDescription1);
  EXPECT_EQ(RoapSession::kParseDoubleConflict,
            roap_session1.Parse(double_conflict_offer.Serialize()));

  // After a double conflict both offers must be abandoned and a new offer
  // created. Recreate the sent offer.
  offer_message1 = roap_session1.CreateOffer(kSdpDescription2);
  EXPECT_TRUE(message_base.Parse(offer_message1));
  RoapOffer message_offer2(message_base);

  RoapOffer losing_offer(message_offer2.answer_session_id(),
                         message_offer2.offer_session_id(),
                         "",
                         message_offer2.seq(),
                         0,
                         kSdpDescription1);
  EXPECT_EQ(RoapSession::kParseConflict,
            roap_session1.Parse(losing_offer.Serialize()));

  RoapOffer winning_offer(message_offer2.answer_session_id(),
                          message_offer2.offer_session_id(),
                          "",
                          message_offer2.seq(),
                          0xFFFFFFFF,
                          kSdpDescription1);
  EXPECT_EQ(RoapSession::kOffer,
            roap_session1.Parse(winning_offer.Serialize()));
}

TEST(RoapSessionTest, SequenceNumberOnOffer) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  std::string offer_message = roap_session1.CreateOffer(kSdpDescription1);
  EXPECT_EQ(RoapSession::kOffer, roap_session2.Parse(offer_message));

  // Invalid since we have already received the same  message.
  EXPECT_EQ(RoapSession::kInvalidMessage, roap_session2.Parse(offer_message));

  RoapMessageBase message_base;
  EXPECT_TRUE(message_base.Parse(offer_message));
  RoapOffer message_offer(message_base);
  EXPECT_TRUE(message_offer.Parse());
  // Create a new offer with higher sequence number.
  RoapOffer new_offer(message_offer.offer_session_id(),
                      message_offer.answer_session_id(),
                      message_offer.session_token(),
                      message_offer.seq()+1,
                      0,
                      kSdpDescription1);

  EXPECT_EQ(RoapSession::kOffer, roap_session2.Parse(new_offer.Serialize()));
}

TEST(RoapSessionTest, SequenceNumberOnOfferInGlare) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  // Setup. Need to exchange an offer and an answer in order to test for glare.
  std::string offer_message1 = roap_session1.CreateOffer(kSdpDescription1);

  roap_session2.Parse(offer_message1);
  std::string answer_message2 = roap_session2.CreateAnswer(kSdpDescription2);
  roap_session1.Parse(answer_message2);

  // Ok- we should now have all we need. Create a glare condition by
  // updating the offers simultaneously.
  offer_message1 = roap_session1.CreateOffer(kSdpDescription2);
  std::string offer_message2 = roap_session2.CreateOffer(kSdpDescription1);

  RoapMessageBase message_base;
  EXPECT_TRUE(message_base.Parse(offer_message1));
  RoapOffer message_offer(message_base);
  EXPECT_TRUE(message_offer.Parse());
  // Create an offer with lower sequence number.
  RoapOffer bad_offer(message_offer.offer_session_id(),
                      message_offer.answer_session_id(),
                      message_offer.session_token(),
                      message_offer.seq()-1,
                      0,
                      kSdpDescription1);

  EXPECT_EQ(RoapSession::kInvalidMessage,
            roap_session2.Parse(bad_offer.Serialize()));

  // Test that we accept offers with higher sequence number in glare.
  RoapOffer god_offer(message_offer.offer_session_id(),
                      message_offer.answer_session_id(),
                      message_offer.session_token(),
                      message_offer.seq()+1,
                      0,
                      kSdpDescription1);

  EXPECT_EQ(RoapSession::kOffer,
            roap_session2.Parse(god_offer.Serialize()));
}


TEST(RoapSessionTest, SequenceNumberOnAnswer) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  std::string offer_message = roap_session1.CreateOffer(kSdpDescription1);

  EXPECT_EQ(RoapSession::kOffer, roap_session2.Parse(offer_message));
  std::string answer_message = roap_session2.CreateAnswer(kSdpDescription2);

  RoapMessageBase message_base;
  EXPECT_TRUE(message_base.Parse(offer_message));
  RoapAnswer message_answer(message_base);
  EXPECT_TRUE(message_answer.Parse());

  // Create an answer with higher sequence number than the offer.
  RoapAnswer bad_answer(message_answer.offer_session_id(),
                        message_answer.answer_session_id(),
                        message_answer.session_token(),
                        message_answer.response_token(),
                        message_answer.seq()+1,
                        kSdpDescription2);

  EXPECT_EQ(RoapSession::kInvalidMessage,
            roap_session1.Parse(bad_answer.Serialize()));

  RoapAnswer god_answer(message_answer.offer_session_id(),
                        message_answer.answer_session_id(),
                        message_answer.session_token(),
                        message_answer.response_token(),
                        message_answer.seq(),
                        kSdpDescription2);

  EXPECT_EQ(RoapSession::kAnswer, roap_session1.Parse(god_answer.Serialize()));
}

TEST(RoapSessionTest, ShutDownOk) {
  RoapSession roap_session1;
  std::string shutdown = roap_session1.CreateShutDown();

  RoapSession roap_session2;
  EXPECT_EQ(RoapSession::kShutDown, roap_session2.Parse(shutdown));

  std::string ok_message = roap_session2.CreateOk();
  EXPECT_EQ(RoapSession::kOk, roap_session1.Parse(ok_message));
}

TEST(RoapSessionTest, ErrorMessageCreation) {
  RoapSession roap_session1;
  RoapSession roap_session2;

  std::string message = roap_session1.CreateErrorMessage(webrtc::kNoMatch);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kNoMatch, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kTimeout);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kTimeout, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kRefused);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kRefused, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kConflict);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kConflict, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kDoubleConflict);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kDoubleConflict, roap_session2.RemoteError());

  message = roap_session1.CreateErrorMessage(webrtc::kFailed);
  EXPECT_EQ(RoapSession::kError, roap_session2.Parse(message));
  EXPECT_EQ(webrtc::kFailed, roap_session2.RemoteError());
}
