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
#include "talk/base/gunit.h"
#include "talk/base/logging.h"
#include "talk/p2p/base/transport.h"
#include "talk/session/phone/mediasession.h"

using cricket::Candidates;
using cricket::AudioContentDescription;
using cricket::SessionDescription;
using cricket::StreamParams;
using cricket::VideoContentDescription;

static const char kStreamLabel1[] = "local_stream_1";
static const char kStream1Cname[] = "stream_1_cname";
static const char kAudioTrackLabel1[] = "local_audio_1";
static const uint32 kAudioTrack1Ssrc = 1;

static const char kOfferSessionId[] = "offer_1";
static const char kAnswerSessionId[] = "answer_1";
static const char kSessionToken[] = "session_1";

#define SDP_REFERENCE "this is a fake sdp string"

static const char kOfferReference[] =
    "{\n"
    "   \"answererSessionId\" : \"answer_1\",\n"
    "   \"messageType\" : \"OFFER\",\n"
    "   \"offererSessionId\" : \"offer_1\",\n"
    "   \"sdp\" : \""
    SDP_REFERENCE
    "\",\n"  // End of sdp.
    "   \"seq\" : 1,\n"
    "   \"tieBreaker\" : 0\n"
    "}\n";

static const char kAnswerReference[] =
    "{\n"
    "   \"answererSessionId\" : \"answer_1\",\n"
    "   \"messageType\" : \"ANSWER\",\n"
    "   \"offererSessionId\" : \"offer_1\",\n"
    "   \"sdp\" : \""
    SDP_REFERENCE
    "\",\n"  // End of sdp.
    "   \"seq\" : 1\n"
    "}\n";

static const char kSdpReference[]= SDP_REFERENCE;
#undef SDP_REFERENCE

static const char kOkReference[] =
    "{\n"
    "   \"answererSessionId\" : \"answer_1\",\n"
    "   \"messageType\" : \"OK\",\n"
    "   \"offererSessionId\" : \"offer_1\",\n"
    "   \"seq\" : 1\n"
    "}\n";

static const char kShutdownReference[] =
    "{\n"
    "   \"answererSessionId\" : \"answer_1\",\n"
    "   \"messageType\" : \"SHUTDOWN\",\n"
    "   \"offererSessionId\" : \"offer_1\",\n"
    "   \"seq\" : 1\n"
    "}\n";

static const char kErrorReference[] =
    "{\n"
    "   \"answererSessionId\" : \"answer_1\",\n"
    "   \"errorType\" : \"TIMEOUT\",\n"
    "   \"messageType\" : \"ERROR\",\n"
    "   \"offererSessionId\" : \"offer_1\",\n"
    "   \"seq\" : 1\n"
    "}\n";

static bool CompareRoapBase(const webrtc::RoapMessageBase& base1,
                            const webrtc::RoapMessageBase& base2) {
  return base1.type() == base2.type() &&
      base1.offer_session_id() == base2.offer_session_id() &&
      base1.answer_session_id() == base2.answer_session_id() &&
      base1.session_token() == base2.session_token() &&
      base1.response_token() == base2.response_token() &&
      base1.seq() == base2.seq();
}

static bool CompareRoapOffer(const webrtc::RoapOffer& offer1,
                             const webrtc::RoapOffer& offer2) {
  return CompareRoapBase(offer1, offer2) &&
      offer1.tie_breaker() == offer2.tie_breaker();
}

static bool CompareRoapAnswer(const webrtc::RoapAnswer& answer1,
                              const webrtc::RoapAnswer& answer2) {
  return CompareRoapBase(answer1, answer2) &&
      answer1.more_coming() == answer1.more_coming();
}

static bool CompareRoapError(const webrtc::RoapError& error1,
                             const webrtc::RoapError& error2) {
  return CompareRoapBase(error1, error2) &&
      error1.error() == error2.error();
}

TEST(RoapMessageTest, RoapOffer) {
  webrtc::RoapOffer offer(kOfferSessionId, kAnswerSessionId, "", 1, 0,
                          kSdpReference);
  std::string offer_string = offer.Serialize();
  EXPECT_EQ(kOfferReference, offer_string);

  webrtc::RoapMessageBase base;
  EXPECT_TRUE(base.Parse(kOfferReference));
  EXPECT_EQ(webrtc::RoapMessageBase::kOffer, base.type());
  webrtc::RoapOffer parsed_offer(base);
  EXPECT_TRUE(parsed_offer.Parse());
  EXPECT_TRUE(CompareRoapOffer(offer, parsed_offer));
}

TEST(RoapMessageTest, RoapAnswer) {
  webrtc::RoapAnswer answer(kOfferSessionId, kAnswerSessionId, "", "", 1,
                            kSdpReference);
  std::string answer_string = answer.Serialize();
  EXPECT_EQ(kAnswerReference, answer_string);

  webrtc::RoapMessageBase base;
  EXPECT_TRUE(base.Parse(kAnswerReference));
  EXPECT_EQ(webrtc::RoapMessageBase::kAnswer, base.type());
  webrtc::RoapAnswer parsed_answer(base);
  EXPECT_TRUE(parsed_answer.Parse());
  EXPECT_TRUE(CompareRoapAnswer(answer, parsed_answer));
}

TEST(RoapMessageTest, RoapOk) {
  webrtc::RoapOk ok(kOfferSessionId, kAnswerSessionId, "", "", 1);
  std::string ok_string = ok.Serialize();
  EXPECT_TRUE(kOkReference == ok_string);

  webrtc::RoapMessageBase base;
  EXPECT_TRUE(base.Parse(kOkReference));
  EXPECT_EQ(webrtc::RoapMessageBase::kOk, base.type());
  webrtc::RoapOk parsed_ok(base);
  EXPECT_TRUE(CompareRoapBase(ok, parsed_ok));
}

TEST(RoapMessageTest, RoapShutdown) {
  webrtc::RoapShutdown shutdown(kOfferSessionId, kAnswerSessionId, "", 1);
  std::string shutdown_string = shutdown.Serialize();
  EXPECT_TRUE(kShutdownReference == shutdown_string);

  webrtc::RoapMessageBase base;
  EXPECT_TRUE(base.Parse(kShutdownReference));
  EXPECT_EQ(webrtc::RoapMessageBase::kShutdown, base.type());
  webrtc::RoapShutdown parsed_shutdown(base);
  EXPECT_TRUE(CompareRoapBase(shutdown, parsed_shutdown));
}

TEST(RoapMessageTest, RoapError) {
  webrtc::RoapError error(kOfferSessionId, kAnswerSessionId, "", "", 1,
                          webrtc::kTimeout);
  std::string error_string = error.Serialize();
  EXPECT_TRUE(kErrorReference == error_string);

  webrtc::RoapMessageBase base;
  EXPECT_TRUE(base.Parse(kErrorReference));
  EXPECT_EQ(webrtc::RoapMessageBase::kError, base.type());
  webrtc::RoapError parsed_error(base);
  EXPECT_TRUE(parsed_error.Parse());
  EXPECT_TRUE(CompareRoapError(error, parsed_error));
}
