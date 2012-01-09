// libjingle
// Copyright 2009 Google Inc.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  1. Redistributions of source code must retain the above copyright notice,
//     this list of conditions and the following disclaimer.
//  2. Redistributions in binary form must reproduce the above copyright notice,
//     this list of conditions and the following disclaimer in the documentation
//     and/or other materials provided with the distribution.
//  3. The name of the author may not be used to endorse or promote products
//     derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
// WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
// EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
// OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
// OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

#include "talk/base/fileutils.h"
#include "talk/base/gunit.h"
#include "talk/base/helpers.h"
#include "talk/base/logging.h"
#include "talk/base/pathutils.h"
#include "talk/base/signalthread.h"
#include "talk/p2p/base/fakesession.h"
#include "talk/session/phone/channel.h"
#include "talk/session/phone/fakemediaengine.h"
#include "talk/session/phone/fakertp.h"
#include "talk/session/phone/mediasessionclient.h"
#include "talk/session/phone/mediarecorder.h"
#include "talk/session/phone/rtpdump.h"

using cricket::CA_OFFER;
using cricket::CA_ANSWER;
using cricket::CA_UPDATE;

static const cricket::AudioCodec kPcmuCodec(0, "PCMU", 64000, 8000, 1, 0);
static const cricket::AudioCodec kPcmaCodec(8, "PCMA", 64000, 8000, 1, 0);
static const cricket::AudioCodec kIsacCodec(103, "ISAC", 40000, 16000, 1, 0);
static const cricket::VideoCodec kH264Codec(97, "H264", 640, 400, 30, 0);
static const cricket::VideoCodec kH264SvcCodec(99, "H264-SVC", 320, 200, 15, 0);
static const uint32 kSsrc1 = 0x1111;
static const uint32 kSsrc2 = 0x2222;

class VoiceTraits {
 public:
  typedef cricket::VoiceChannel Channel;
  typedef cricket::FakeVoiceMediaChannel MediaChannel;
  typedef cricket::AudioContentDescription Content;
  typedef cricket::AudioCodec Codec;
  typedef cricket::VoiceMediaInfo MediaInfo;
};

class VideoTraits {
 public:
  typedef cricket::VideoChannel Channel;
  typedef cricket::FakeVideoMediaChannel MediaChannel;
  typedef cricket::VideoContentDescription Content;
  typedef cricket::VideoCodec Codec;
  typedef cricket::VideoMediaInfo MediaInfo;
};

// Base class for Voice/VideoChannel tests
template<class T>
class ChannelTest : public testing::Test, public sigslot::has_slots<> {
 public:
  enum Flags { RTCP = 0x1, RTCP_MUX = 0x2, SECURE = 0x4, SSRC_MUX = 0x8 };
  ChannelTest(const uint8* rtp_data, int rtp_len,
              const uint8* rtcp_data, int rtcp_len)
      : media_channel1_(NULL),
        media_channel2_(NULL),
        rtp_packet_(reinterpret_cast<const char*>(rtp_data), rtp_len),
        rtcp_packet_(reinterpret_cast<const char*>(rtcp_data), rtcp_len),
        media_info_callbacks1_(),
        media_info_callbacks2_(),
        ssrc_(0),
        error_(T::MediaChannel::ERROR_NONE) {
  }

  void CreateChannels(int flags1, int flags2) {
    CreateChannels(new typename T::MediaChannel(NULL),
                   new typename T::MediaChannel(NULL),
                   flags1, flags2, talk_base::Thread::Current());
  }
  void CreateChannels(int flags) {
     CreateChannels(new typename T::MediaChannel(NULL),
                    new typename T::MediaChannel(NULL),
                    flags, talk_base::Thread::Current());
  }
  void CreateChannels(int flags1, int flags2,
                      talk_base::Thread* thread) {
    CreateChannels(new typename T::MediaChannel(NULL),
                   new typename T::MediaChannel(NULL),
                   flags1, flags2, thread);
  }
  void CreateChannels(int flags,
                      talk_base::Thread* thread) {
    CreateChannels(new typename T::MediaChannel(NULL),
                     new typename T::MediaChannel(NULL),
                     flags, thread);
  }
  void CreateChannels(
      typename T::MediaChannel* ch1, typename T::MediaChannel* ch2,
      int flags1, int flags2, talk_base::Thread* thread) {
    media_channel1_ = ch1;
    media_channel2_ = ch2;
    channel1_.reset(CreateChannel(thread, &media_engine_, ch1, &session1_,
                                  (flags1 & RTCP) != 0));
    channel2_.reset(CreateChannel(thread, &media_engine_, ch2, &session2_,
                                  (flags2 & RTCP) != 0));
    channel1_->SignalMediaMonitor.connect(
        this, &ChannelTest<T>::OnMediaMonitor);
    channel2_->SignalMediaMonitor.connect(
        this, &ChannelTest<T>::OnMediaMonitor);
    channel1_->SignalMediaError.connect(
        this, &ChannelTest<T>::OnMediaChannelError);
    channel2_->SignalMediaError.connect(
        this, &ChannelTest<T>::OnMediaChannelError);
    CreateContent(flags1, kPcmuCodec, kH264Codec, &media_content1_);
    CreateContent(flags2, kPcmuCodec, kH264Codec, &media_content2_);
    AddLegacyStreamInContent(kSsrc1, flags1, &media_content1_);
    AddLegacyStreamInContent(kSsrc2, flags2, &media_content2_);
  }

  void CreateChannels(
      typename T::MediaChannel* ch1, typename T::MediaChannel* ch2,
      int flags, talk_base::Thread* thread) {
    media_channel1_ = ch1;
    media_channel2_ = ch2;
    channel1_.reset(CreateChannel(thread, &media_engine_, ch1, &session1_,
                                  (flags & RTCP) != 0));
    channel2_.reset(CreateChannel(thread, &media_engine_, ch2, &session1_,
                                  (flags & RTCP) != 0));
    channel1_->SignalMediaMonitor.connect(
        this, &ChannelTest<T>::OnMediaMonitor);
    channel2_->SignalMediaMonitor.connect(
        this, &ChannelTest<T>::OnMediaMonitor);
    channel2_->SignalMediaError.connect(
        this, &ChannelTest<T>::OnMediaChannelError);
    CreateContent(flags, kPcmuCodec, kH264Codec, &media_content1_);
    CreateContent(flags, kPcmuCodec, kH264Codec, &media_content2_);
    AddLegacyStreamInContent(kSsrc1, flags, &media_content1_);
    AddLegacyStreamInContent(kSsrc2, flags, &media_content2_);
  }
  typename T::Channel* CreateChannel(talk_base::Thread* thread,
                                     cricket::MediaEngineInterface* engine,
                                     typename T::MediaChannel* ch,
                                     cricket::BaseSession* session,
                                     bool rtcp) {
    typename T::Channel* channel = new typename T::Channel(
        thread, engine, ch, session, cricket::CN_AUDIO, rtcp);
    if (!channel->Init()) {
      delete channel;
      channel = NULL;
    }
    return channel;
  }

  bool SendInitiate() {
    bool result = channel1_->SetLocalContent(&media_content1_, CA_OFFER);
    if (result) {
      channel1_->Enable(true);
      result = channel2_->SetRemoteContent(&media_content1_, CA_OFFER);
      if (result) {
        result = channel2_->SetLocalContent(&media_content2_, CA_ANSWER);
        if (result) {
          session1_.Connect(&session2_);
        }
      }
    }
    return result;
  }
  bool SendAccept() {
    channel2_->Enable(true);
    return channel1_->SetRemoteContent(&media_content2_, CA_ANSWER);
  }
  bool SendTerminate() {
    channel1_.reset();
    channel2_.reset();
    return true;
  }

  bool AddStream1(int id) {
    return channel1_->AddStream(id);
  }
  bool RemoveStream1(int id) {
    return channel1_->RemoveStream(id);
  }

  cricket::FakeTransport* GetTransport1() {
    return session1_.GetTransport(channel1_->content_name());
  }
  cricket::FakeTransport* GetTransport2() {
    return session2_.GetTransport(channel2_->content_name());
  }

  bool SendRtp1() {
    return media_channel1_->SendRtp(rtp_packet_.c_str(), rtp_packet_.size());
  }
  bool SendRtp2() {
    return media_channel2_->SendRtp(rtp_packet_.c_str(), rtp_packet_.size());
  }
  bool SendRtcp1() {
    return media_channel1_->SendRtcp(rtcp_packet_.c_str(), rtcp_packet_.size());
  }
  bool SendRtcp2() {
    return media_channel2_->SendRtcp(rtcp_packet_.c_str(), rtcp_packet_.size());
  }
  // Methods to send custom data.
  bool SendCustomRtp1(uint32 ssrc) {
    std::string data(CreateRtpData(ssrc));
    return media_channel1_->SendRtp(data.c_str(), data.size());
  }
  bool SendCustomRtp2(uint32 ssrc) {
    std::string data(CreateRtpData(ssrc));
    return media_channel2_->SendRtp(data.c_str(), data.size());
  }
  bool SendCustomRtcp1(uint32 ssrc) {
    std::string data(CreateRtcpData(ssrc));
    return media_channel1_->SendRtcp(data.c_str(), data.size());
  }
  bool SendCustomRtcp2(uint32 ssrc) {
    std::string data(CreateRtcpData(ssrc));
    return media_channel2_->SendRtcp(data.c_str(), data.size());
  }
  bool CheckRtp1() {
    return media_channel1_->CheckRtp(rtp_packet_.c_str(), rtp_packet_.size());
  }
  bool CheckRtp2() {
    return media_channel2_->CheckRtp(rtp_packet_.c_str(), rtp_packet_.size());
  }
  bool CheckRtcp1() {
    return media_channel1_->CheckRtcp(rtcp_packet_.c_str(),
                                      rtcp_packet_.size());
  }
  bool CheckRtcp2() {
    return media_channel2_->CheckRtcp(rtcp_packet_.c_str(),
                                      rtcp_packet_.size());
  }
  // Methods to check custom data.
  bool CheckCustomRtp1(uint32 ssrc) {
    std::string data(CreateRtpData(ssrc));
    return media_channel1_->CheckRtp(data.c_str(), data.size());
  }
  bool CheckCustomRtp2(uint32 ssrc) {
    std::string data(CreateRtpData(ssrc));
    return media_channel2_->CheckRtp(data.c_str(), data.size());
  }
  bool CheckCustomRtcp1(uint32 ssrc) {
    std::string data(CreateRtcpData(ssrc));
    return media_channel1_->CheckRtcp(data.c_str(), data.size());
  }
  bool CheckCustomRtcp2(uint32 ssrc) {
    std::string data(CreateRtcpData(ssrc));
    return media_channel2_->CheckRtcp(data.c_str(), data.size());
  }
  std::string CreateRtpData(uint32 ssrc) {
    std::string data(rtp_packet_);
    // Set SSRC in the rtp packet copy.
    talk_base::SetBE32(const_cast<char*>(data.c_str()) + 8, ssrc);
    return data;
  }
  std::string CreateRtcpData(uint32 ssrc) {
    std::string data(rtcp_packet_);
    // Set SSRC in the rtcp packet copy.
    talk_base::SetBE32(const_cast<char*>(data.c_str()) + 4, ssrc);
    return data;
  }

  bool CheckNoRtp1() {
    return media_channel1_->CheckNoRtp();
  }
  bool CheckNoRtp2() {
    return media_channel2_->CheckNoRtp();
  }
  bool CheckNoRtcp1() {
    return media_channel1_->CheckNoRtcp();
  }
  bool CheckNoRtcp2() {
    return media_channel2_->CheckNoRtcp();
  }

  void CreateContent(int flags,
                     const cricket::AudioCodec& audio_codec,
                     const cricket::VideoCodec& video_codec,
                     typename T::Content* content) {
    // overridden in specialized classes
  }

  class CallThread : public talk_base::SignalThread {
   public:
    typedef bool (ChannelTest<T>::*Method)();
    CallThread(ChannelTest<T>* obj, Method method, bool* result)
        : obj_(obj),
          method_(method),
          result_(result) {
      *result = false;
    }
    virtual void DoWork() {
      bool result = (*obj_.*method_)();
      if (result_) {
        *result_ = result;
      }
    }
   private:
    ChannelTest<T>* obj_;
    Method method_;
    bool* result_;
  };
  void CallOnThread(typename CallThread::Method method, bool* result) {
    CallThread* thread = new CallThread(this, method, result);
    thread->Start();
    thread->Release();
  }

  void CallOnThreadAndWaitForDone(typename CallThread::Method method,
                                  bool* result) {
    CallThread* thread = new CallThread(this, method, result);
    thread->Start();
    thread->Destroy(true);
  }

  bool CodecMatches(const typename T::Codec& c1, const typename T::Codec& c2) {
    return false;  // overridden in specialized classes
  }

  void OnMediaMonitor(typename T::Channel* channel,
                      const typename T::MediaInfo& info) {
    if (channel == channel1_.get()) {
      media_info_callbacks1_++;
    } else if (channel == channel2_.get()) {
      media_info_callbacks2_++;
    }
  }

  void OnMediaChannelError(typename T::Channel* channel,
                           uint32 ssrc,
                           typename T::MediaChannel::Error error) {
    ssrc_ = ssrc;
    error_ = error;
  }

  void AddLegacyStreamInContent(uint32 ssrc, int flags,
                        typename T::Content* content) {
    // Base implementation.
  }

  // Tests that can be used by derived classes.

  // Basic sanity check.
  void TestInit() {
    CreateChannels(0, 0);
    EXPECT_FALSE(channel1_->secure());
    EXPECT_FALSE(media_channel1_->sending());
    EXPECT_FALSE(media_channel1_->playout());
    EXPECT_TRUE(media_channel1_->codecs().empty());
    EXPECT_TRUE(media_channel1_->streams().empty());
    EXPECT_TRUE(media_channel1_->rtp_packets().empty());
    EXPECT_TRUE(media_channel1_->rtcp_packets().empty());
  }

  // Test that SetRtcpCName sets the RTCP CNAME successfully.
  void TestSetRtcpCName() {
    static const char* kTestCName = "a@b.com";
    CreateChannels(0, 0);
    EXPECT_TRUE(channel1_->SetRtcpCName(kTestCName));
    EXPECT_EQ(kTestCName, media_channel1_->rtcp_cname());
    EXPECT_TRUE(channel2_->SetRtcpCName(kTestCName));
    EXPECT_EQ(kTestCName, media_channel2_->rtcp_cname());
  }

  // Test that SetLocalContent and SetRemoteContent properly configure
  // the codecs.
  void TestSetContents() {
    CreateChannels(0, 0);
    typename T::Content content;
    CreateContent(0, kPcmuCodec, kH264Codec, &content);
    EXPECT_TRUE(channel1_->SetLocalContent(&content, CA_OFFER));
    EXPECT_EQ(0U, media_channel1_->codecs().size());
    EXPECT_TRUE(channel1_->SetRemoteContent(&content, CA_ANSWER));
    ASSERT_EQ(1U, media_channel1_->codecs().size());
    EXPECT_TRUE(CodecMatches(content.codecs()[0],
                             media_channel1_->codecs()[0]));
  }

  // Test that SetLocalContent and SetRemoteContent properly deals
  // with an empty offer.
  void TestSetContentsNullOffer() {
    CreateChannels(0, 0);
    typename T::Content content;
    EXPECT_TRUE(channel1_->SetLocalContent(&content, CA_OFFER));
    CreateContent(0, kPcmuCodec, kH264Codec, &content);
    EXPECT_EQ(0U, media_channel1_->codecs().size());
    EXPECT_TRUE(channel1_->SetRemoteContent(&content, CA_ANSWER));
    ASSERT_EQ(1U, media_channel1_->codecs().size());
    EXPECT_TRUE(CodecMatches(content.codecs()[0],
                             media_channel1_->codecs()[0]));
  }

  // Test that SetLocalContent and SetRemoteContent properly set RTCP
  // mux.
  void TestSetContentsRtcpMux() {
    CreateChannels(RTCP, RTCP);
    EXPECT_TRUE(channel1_->rtcp_transport_channel() != NULL);
    EXPECT_TRUE(channel2_->rtcp_transport_channel() != NULL);
    typename T::Content content;
    CreateContent(0, kPcmuCodec, kH264Codec, &content);
    // Both sides agree on mux. Should no longer be a separate RTCP channel.
    content.set_rtcp_mux(true);
    EXPECT_TRUE(channel1_->SetLocalContent(&content, CA_OFFER));
    EXPECT_TRUE(channel1_->SetRemoteContent(&content, CA_ANSWER));
    EXPECT_TRUE(channel1_->rtcp_transport_channel() == NULL);
    // Only initiator supports mux. Should still have a separate RTCP channel.
    EXPECT_TRUE(channel2_->SetLocalContent(&content, CA_OFFER));
    content.set_rtcp_mux(false);
    EXPECT_TRUE(channel2_->SetRemoteContent(&content, CA_ANSWER));
    EXPECT_TRUE(channel2_->rtcp_transport_channel() != NULL);
  }

  // Test that SetRemoteContent properly deals with a content update.
  void TestSetRemoteContentUpdate() {
    CreateChannels(0, 0);
    typename T::Content content;
    CreateContent(RTCP | RTCP_MUX | SECURE, kPcmuCodec, kH264Codec, &content);
    EXPECT_EQ(0U, media_channel1_->codecs().size());
    EXPECT_TRUE(channel1_->SetLocalContent(&content, CA_OFFER));
    EXPECT_TRUE(channel1_->SetRemoteContent(&content, CA_ANSWER));
    ASSERT_EQ(1U, media_channel1_->codecs().size());
    EXPECT_TRUE(CodecMatches(content.codecs()[0],
                             media_channel1_->codecs()[0]));
    // Now update with other codecs.
    typename T::Content update_content;
    CreateContent(0, kIsacCodec, kH264SvcCodec, &update_content);
    EXPECT_TRUE(channel1_->SetRemoteContent(&update_content, CA_UPDATE));
    ASSERT_EQ(1U, media_channel1_->codecs().size());
    EXPECT_TRUE(CodecMatches(update_content.codecs()[0],
                             media_channel1_->codecs()[0]));

    // Now update without any codec.
    typename T::Content empty_content;
    EXPECT_TRUE(channel1_->SetRemoteContent(&empty_content, CA_UPDATE));
    ASSERT_EQ(0U, media_channel1_->codecs().size());
  }

  // Test that Add/RemoveStream properly forward to the media channel.
  void TestStreams() {
    CreateChannels(0, 0);
    EXPECT_TRUE(AddStream1(1));
    EXPECT_TRUE(AddStream1(2));
    EXPECT_EQ(2U, media_channel1_->streams().size());
    EXPECT_TRUE(RemoveStream1(2));
    EXPECT_EQ(1U, media_channel1_->streams().size());
    EXPECT_TRUE(RemoveStream1(1));
    EXPECT_EQ(0U, media_channel1_->streams().size());
  }

  // Test that we only start playout and sending at the right times.
  void TestPlayoutAndSendingStates() {
    CreateChannels(0, 0);
    EXPECT_FALSE(media_channel1_->playout());
    EXPECT_FALSE(media_channel1_->sending());
    EXPECT_FALSE(media_channel2_->playout());
    EXPECT_FALSE(media_channel2_->sending());
    EXPECT_TRUE(channel1_->Enable(true));
    EXPECT_FALSE(media_channel1_->playout());
    EXPECT_FALSE(media_channel1_->sending());
    EXPECT_TRUE(channel1_->SetLocalContent(&media_content1_, CA_OFFER));
    EXPECT_TRUE(media_channel1_->playout());
    EXPECT_FALSE(media_channel1_->sending());
    EXPECT_TRUE(channel2_->SetRemoteContent(&media_content1_, CA_OFFER));
    EXPECT_FALSE(media_channel2_->playout());
    EXPECT_FALSE(media_channel2_->sending());
    EXPECT_TRUE(channel2_->SetLocalContent(&media_content2_, CA_ANSWER));
    EXPECT_FALSE(media_channel2_->playout());
    EXPECT_FALSE(media_channel2_->sending());
    session1_.Connect(&session2_);
    EXPECT_TRUE(media_channel1_->playout());
    EXPECT_FALSE(media_channel1_->sending());
    EXPECT_FALSE(media_channel2_->playout());
    EXPECT_FALSE(media_channel2_->sending());
    EXPECT_TRUE(channel2_->Enable(true));
    EXPECT_TRUE(media_channel2_->playout());
    EXPECT_TRUE(media_channel2_->sending());
    EXPECT_TRUE(channel1_->SetRemoteContent(&media_content2_, CA_ANSWER));
    EXPECT_TRUE(media_channel1_->playout());
    EXPECT_TRUE(media_channel1_->sending());
  }

  // Test setting up a call.
  void TestCallSetup() {
    CreateChannels(0, 0);
    EXPECT_FALSE(channel1_->secure());
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(media_channel1_->playout());
    EXPECT_FALSE(media_channel1_->sending());
    EXPECT_TRUE(SendAccept());
    EXPECT_FALSE(channel1_->secure());
    EXPECT_TRUE(media_channel1_->sending());
    EXPECT_EQ(1U, media_channel1_->codecs().size());
    EXPECT_TRUE(media_channel2_->playout());
    EXPECT_TRUE(media_channel2_->sending());
    EXPECT_EQ(1U, media_channel2_->codecs().size());
  }

  // Test that we don't crash if packets are sent during call teardown
  // when RTCP mux is enabled. This is a regression test against a specific
  // race condition that would only occur when a RTCP packet was sent during
  // teardown of a channel on which RTCP mux was enabled.
  void TestCallTeardownRtcpMux() {
    class LastWordMediaChannel : public T::MediaChannel {
     public:
      LastWordMediaChannel() : T::MediaChannel(NULL) {}
      ~LastWordMediaChannel() {
        T::MediaChannel::SendRtp(kPcmuFrame, sizeof(kPcmuFrame));
        T::MediaChannel::SendRtcp(kRtcpReport, sizeof(kRtcpReport));
      }
    };
    CreateChannels(new LastWordMediaChannel(), new LastWordMediaChannel(),
                   RTCP | RTCP_MUX, RTCP | RTCP_MUX,
                   talk_base::Thread::Current());
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_TRUE(SendTerminate());
  }

  // Send voice RTP data to the other side and ensure it gets there.
  void SendRtpToRtp() {
    CreateChannels(0, 0);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(1U, GetTransport1()->channels().size());
    EXPECT_EQ(1U, GetTransport2()->channels().size());
    EXPECT_TRUE(SendRtp1());
    EXPECT_TRUE(SendRtp2());
    EXPECT_TRUE(CheckRtp1());
    EXPECT_TRUE(CheckRtp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());
  }

  // Check that RTCP is not transmitted if both sides don't support RTCP.
  void SendNoRtcpToNoRtcp() {
    CreateChannels(0, 0);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(1U, GetTransport1()->channels().size());
    EXPECT_EQ(1U, GetTransport2()->channels().size());
    EXPECT_FALSE(SendRtcp1());
    EXPECT_FALSE(SendRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Check that RTCP is not transmitted if the callee doesn't support RTCP.
  void SendNoRtcpToRtcp() {
    CreateChannels(0, RTCP);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(1U, GetTransport1()->channels().size());
    EXPECT_EQ(2U, GetTransport2()->channels().size());
    EXPECT_FALSE(SendRtcp1());
    EXPECT_FALSE(SendRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Check that RTCP is not transmitted if the caller doesn't support RTCP.
  void SendRtcpToNoRtcp() {
    CreateChannels(RTCP, 0);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(1U, GetTransport2()->channels().size());
    EXPECT_FALSE(SendRtcp1());
    EXPECT_FALSE(SendRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Check that RTCP is transmitted if both sides support RTCP.
  void SendRtcpToRtcp() {
    CreateChannels(RTCP, RTCP);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(2U, GetTransport2()->channels().size());
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckRtcp1());
    EXPECT_TRUE(CheckRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Check that RTCP is transmitted if only the initiator supports mux.
  void SendRtcpMuxToRtcp() {
    CreateChannels(RTCP | RTCP_MUX, RTCP);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(2U, GetTransport2()->channels().size());
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckRtcp1());
    EXPECT_TRUE(CheckRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Check that RTP and RTCP are transmitted ok when both sides support mux.
  void SendRtcpMuxToRtcpMux() {
    CreateChannels(RTCP | RTCP_MUX, RTCP | RTCP_MUX);
    EXPECT_TRUE(SendInitiate());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(1U, GetTransport2()->channels().size());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(1U, GetTransport1()->channels().size());
    EXPECT_TRUE(SendRtp1());
    EXPECT_TRUE(SendRtp2());
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckRtp1());
    EXPECT_TRUE(CheckRtp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());
    EXPECT_TRUE(CheckRtcp1());
    EXPECT_TRUE(CheckRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Check that RTCP data sent by the initiator before the accept is not muxed.
  void SendEarlyRtcpMuxToRtcp() {
    CreateChannels(RTCP | RTCP_MUX, RTCP);
    EXPECT_TRUE(SendInitiate());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(2U, GetTransport2()->channels().size());

    // RTCP can be sent before the call is accepted, if the transport is ready.
    // It should not be muxed though, as the remote side doesn't support mux.
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(CheckNoRtp2());
    EXPECT_TRUE(CheckRtcp2());

    // Send RTCP packet from callee and verify that it is received.
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckRtcp1());

    // Complete call setup and ensure everything is still OK.
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(CheckRtcp2());
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckRtcp1());
  }


  // Check that RTCP data is not muxed until both sides have enabled muxing,
  // but that we properly demux before we get the accept message, since there
  // is a race between RTP data and the jingle accept.
  void SendEarlyRtcpMuxToRtcpMux() {
    CreateChannels(RTCP | RTCP_MUX, RTCP | RTCP_MUX);
    EXPECT_TRUE(SendInitiate());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(1U, GetTransport2()->channels().size());

    // RTCP can't be sent yet, since the RTCP transport isn't writable, and
    // we haven't yet received the accept that says we should mux.
    EXPECT_FALSE(SendRtcp1());

    // Send muxed RTCP packet from callee and verify that it is received.
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckRtcp1());

    // Complete call setup and ensure everything is still OK.
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(1U, GetTransport1()->channels().size());
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(CheckRtcp2());
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckRtcp1());
  }

  // Test that we properly send SRTP with RTCP in both directions.
  void SendSrtpToSrtp() {
    CreateChannels(RTCP | SECURE, RTCP | SECURE);
    EXPECT_FALSE(channel1_->secure());
    EXPECT_FALSE(channel2_->secure());
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_TRUE(channel1_->secure());
    EXPECT_TRUE(channel2_->secure());
    EXPECT_TRUE(SendRtp1());
    EXPECT_TRUE(SendRtp2());
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckRtp1());
    EXPECT_TRUE(CheckRtp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());
    EXPECT_TRUE(CheckRtcp1());
    EXPECT_TRUE(CheckRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Test that we properly handling SRTP negotiating down to RTP.
  void SendSrtpToRtp() {
    CreateChannels(RTCP | SECURE, RTCP);
    EXPECT_FALSE(channel1_->secure());
    EXPECT_FALSE(channel2_->secure());
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_FALSE(channel1_->secure());
    EXPECT_FALSE(channel2_->secure());
    EXPECT_TRUE(SendRtp1());
    EXPECT_TRUE(SendRtp2());
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckRtp1());
    EXPECT_TRUE(CheckRtp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());
    EXPECT_TRUE(CheckRtcp1());
    EXPECT_TRUE(CheckRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Test that we properly send SRTP with RTCP mux in both directions.
  void SendSrtcpMux() {
    CreateChannels(RTCP | RTCP_MUX  | SECURE, RTCP | RTCP_MUX | SECURE);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_TRUE(SendRtp1());
    EXPECT_TRUE(SendRtp2());
    EXPECT_TRUE(SendRtcp1());
    EXPECT_TRUE(SendRtcp2());
    EXPECT_TRUE(CheckRtp1());
    EXPECT_TRUE(CheckRtp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());
    EXPECT_TRUE(CheckRtcp1());
    EXPECT_TRUE(CheckRtcp2());
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Test that we properly send RTP without SRTP from a thread.
  void SendRtpToRtpOnThread() {
    bool sent_rtp1, sent_rtp2, sent_rtcp1, sent_rtcp2;
    CreateChannels(RTCP, RTCP);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    CallOnThread(&ChannelTest<T>::SendRtp1, &sent_rtp1);
    CallOnThread(&ChannelTest<T>::SendRtp2, &sent_rtp2);
    CallOnThread(&ChannelTest<T>::SendRtcp1, &sent_rtcp1);
    CallOnThread(&ChannelTest<T>::SendRtcp2, &sent_rtcp2);
    EXPECT_TRUE_WAIT(CheckRtp1(), 1000);
    EXPECT_TRUE_WAIT(CheckRtp2(), 1000);
    EXPECT_TRUE_WAIT(sent_rtp1, 1000);
    EXPECT_TRUE_WAIT(sent_rtp2, 1000);
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());
    EXPECT_TRUE_WAIT(CheckRtcp1(), 1000);
    EXPECT_TRUE_WAIT(CheckRtcp2(), 1000);
    EXPECT_TRUE_WAIT(sent_rtcp1, 1000);
    EXPECT_TRUE_WAIT(sent_rtcp2, 1000);
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Test that we properly send SRTP with RTCP from a thread.
  void SendSrtpToSrtpOnThread() {
    bool sent_rtp1, sent_rtp2, sent_rtcp1, sent_rtcp2;
    CreateChannels(RTCP | SECURE, RTCP | SECURE);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    CallOnThread(&ChannelTest<T>::SendRtp1, &sent_rtp1);
    CallOnThread(&ChannelTest<T>::SendRtp2, &sent_rtp2);
    CallOnThread(&ChannelTest<T>::SendRtcp1, &sent_rtcp1);
    CallOnThread(&ChannelTest<T>::SendRtcp2, &sent_rtcp2);
    EXPECT_TRUE_WAIT(CheckRtp1(), 1000);
    EXPECT_TRUE_WAIT(CheckRtp2(), 1000);
    EXPECT_TRUE_WAIT(sent_rtp1, 1000);
    EXPECT_TRUE_WAIT(sent_rtp2, 1000);
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());
    EXPECT_TRUE_WAIT(CheckRtcp1(), 1000);
    EXPECT_TRUE_WAIT(CheckRtcp2(), 1000);
    EXPECT_TRUE_WAIT(sent_rtcp1, 1000);
    EXPECT_TRUE_WAIT(sent_rtcp2, 1000);
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckNoRtcp2());
  }

  // Test that the mediachannel retains its sending state after the transport
  // becomes non-writable.
  void SendWithWritabilityLoss() {
    CreateChannels(0, 0);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(1U, GetTransport1()->channels().size());
    EXPECT_EQ(1U, GetTransport2()->channels().size());
    EXPECT_TRUE(SendRtp1());
    EXPECT_TRUE(SendRtp2());
    EXPECT_TRUE(CheckRtp1());
    EXPECT_TRUE(CheckRtp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());

    GetTransport1()->SetDestination(NULL);
    EXPECT_TRUE(media_channel1_->sending());
    EXPECT_FALSE(SendRtp1());
    EXPECT_TRUE(SendRtp2());
    EXPECT_TRUE(CheckRtp1());
    EXPECT_TRUE(CheckNoRtp2());

    GetTransport1()->SetDestination(GetTransport2());
    EXPECT_TRUE(media_channel1_->sending());
    EXPECT_TRUE(SendRtp1());
    EXPECT_TRUE(SendRtp2());
    EXPECT_TRUE(CheckRtp1());
    EXPECT_TRUE(CheckRtp2());
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckNoRtp2());
  }

  void SendSsrcMuxToSsrcMuxWithRtcpMux() {
    CreateChannels(SSRC_MUX | RTCP | RTCP_MUX, SSRC_MUX | RTCP | RTCP_MUX);
    EXPECT_TRUE(SendInitiate());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(1U, GetTransport2()->channels().size());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(1U, GetTransport1()->channels().size());
    EXPECT_EQ(1U, GetTransport2()->channels().size());
    EXPECT_TRUE(channel1_->ssrc_filter()->IsActive());
    // channel1 - should have media_content2 as remote. i.e. kSsrc2
    EXPECT_TRUE(channel1_->ssrc_filter()->FindStream(kSsrc2));
    EXPECT_TRUE(channel2_->ssrc_filter()->IsActive());
    // channel2 - should have media_content1 as remote. i.e. kSsrc1
    EXPECT_TRUE(channel2_->ssrc_filter()->FindStream(kSsrc1));
    EXPECT_TRUE(SendCustomRtp1(kSsrc1));
    EXPECT_TRUE(SendCustomRtp2(kSsrc2));
    EXPECT_TRUE(SendCustomRtcp1(kSsrc1));
    EXPECT_TRUE(SendCustomRtcp2(kSsrc2));
    EXPECT_TRUE(CheckCustomRtp1(kSsrc2));
    EXPECT_TRUE(CheckNoRtp1());
    EXPECT_TRUE(CheckCustomRtp2(kSsrc1));
    EXPECT_TRUE(CheckNoRtp2());
    EXPECT_TRUE(CheckCustomRtcp1(kSsrc2));
    EXPECT_TRUE(CheckNoRtcp1());
    EXPECT_TRUE(CheckCustomRtcp2(kSsrc1));
    EXPECT_TRUE(CheckNoRtcp2());
  }

  void SendSsrcMuxToSsrcMux() {
    CreateChannels(SSRC_MUX | RTCP, SSRC_MUX | RTCP);
    EXPECT_TRUE(SendInitiate());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(2U, GetTransport2()->channels().size());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(2U, GetTransport2()->channels().size());
    EXPECT_TRUE(channel1_->ssrc_filter()->IsActive());
    // channel1 - should have media_content2 as remote. i.e. kSsrc2
    EXPECT_TRUE(channel1_->ssrc_filter()->FindStream(kSsrc2));
    EXPECT_TRUE(channel2_->ssrc_filter()->IsActive());
    // channel2 - should have media_content1 as remote. i.e. kSsrc1
    EXPECT_TRUE(SendCustomRtp1(kSsrc1));
    EXPECT_TRUE(SendCustomRtp2(kSsrc2));
    EXPECT_TRUE(SendCustomRtcp1(kSsrc1));
    EXPECT_TRUE(SendCustomRtcp2(kSsrc2));
    EXPECT_TRUE(CheckCustomRtp1(kSsrc2));
    EXPECT_FALSE(CheckCustomRtp1(kSsrc1));
    EXPECT_TRUE(CheckCustomRtp2(kSsrc1));
    EXPECT_FALSE(CheckCustomRtp2(kSsrc2));
    EXPECT_TRUE(CheckCustomRtcp1(kSsrc2));
    EXPECT_FALSE(CheckCustomRtcp1(kSsrc1));
    EXPECT_TRUE(CheckCustomRtcp2(kSsrc1));
    EXPECT_FALSE(CheckCustomRtcp2(kSsrc2));
  }

  // Test that the media monitor can be run and gives timely callbacks.
  void TestMediaMonitor() {
    static const int kTimeout = 500;
    CreateChannels(0, 0);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    channel1_->StartMediaMonitor(100);
    channel2_->StartMediaMonitor(100);
    // Ensure we get callbacks and stop.
    EXPECT_TRUE_WAIT(media_info_callbacks1_ > 0, kTimeout);
    EXPECT_TRUE_WAIT(media_info_callbacks2_ > 0, kTimeout);
    channel1_->StopMediaMonitor();
    channel2_->StopMediaMonitor();
    // Ensure a restart of a stopped monitor works.
    channel1_->StartMediaMonitor(100);
    EXPECT_TRUE_WAIT(media_info_callbacks1_ > 0, kTimeout);
    channel1_->StopMediaMonitor();
    // Ensure stopping a stopped monitor is OK.
    channel1_->StopMediaMonitor();
  }

  void TestMediaSinks() {
    CreateChannels(0, 0);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_FALSE(channel1_->HasSendSinks());
    EXPECT_FALSE(channel1_->HasRecvSinks());

    talk_base::Pathname path;
    EXPECT_TRUE(talk_base::Filesystem::GetTemporaryFolder(path, true, NULL));
    path.SetFilename("sink-test.rtpdump");
    talk_base::scoped_ptr<cricket::RtpDumpSink> sink(
        new cricket::RtpDumpSink(path.pathname()));
    sink->set_packet_filter(cricket::PF_ALL);
    EXPECT_TRUE(sink->Enable(true));
    channel1_->RegisterSendSink(sink.get(), &cricket::RtpDumpSink::OnPacket);
    EXPECT_TRUE(channel1_->HasSendSinks());
    EXPECT_FALSE(channel1_->HasRecvSinks());
    // The first packet is recorded with header + data.
    EXPECT_TRUE(SendRtp1());
    // The second packet is recorded with header only.
    sink->set_packet_filter(cricket::PF_RTPHEADER);
    EXPECT_TRUE(SendRtp1());
    // The third packet is not recorded since sink is disabled.
    EXPECT_TRUE(sink->Enable(false));
    EXPECT_TRUE(SendRtp1());
     // The fourth packet is not recorded since sink is unregistered.
    EXPECT_TRUE(sink->Enable(true));
    channel1_->UnregisterSendSink(sink.get());
    EXPECT_TRUE(SendRtp1());
    sink.reset();  // This will close the file.

    // Read the recorded file and verify two packets.
    talk_base::scoped_ptr<talk_base::StreamInterface> stream(
        talk_base::Filesystem::OpenFile(path, "rb"));

    cricket::RtpDumpReader reader(stream.get());
    cricket::RtpDumpPacket packet;
    EXPECT_EQ(talk_base::SR_SUCCESS, reader.ReadPacket(&packet));
    std::string read_packet(reinterpret_cast<const char*>(&packet.data[0]),
        packet.data.size());
    EXPECT_EQ(rtp_packet_, read_packet);

    EXPECT_EQ(talk_base::SR_SUCCESS, reader.ReadPacket(&packet));
    size_t len = 0;
    packet.GetRtpHeaderLen(&len);
    EXPECT_EQ(len, packet.data.size());
    EXPECT_EQ(0, memcmp(&packet.data[0], rtp_packet_.c_str(), len));

    EXPECT_EQ(talk_base::SR_EOS, reader.ReadPacket(&packet));

    // Delete the file for media recording.
    stream.reset();
    EXPECT_TRUE(talk_base::Filesystem::DeleteFile(path));
  }

  void TestSetContentFailure() {
    CreateChannels(0, 0);
    typename T::Content content;
    cricket::SessionDescription* sdesc_loc = new cricket::SessionDescription();
    cricket::SessionDescription* sdesc_rem = new cricket::SessionDescription();

    // Set up the session description.
    CreateContent(0, kPcmuCodec, kH264Codec, &content);
    sdesc_loc->AddContent(cricket::CN_AUDIO, cricket::NS_JINGLE_RTP,
                          new cricket::AudioContentDescription());
    sdesc_loc->AddContent(cricket::CN_VIDEO, cricket::NS_JINGLE_RTP,
                          new cricket::VideoContentDescription());
    EXPECT_TRUE(session1_.set_local_description(sdesc_loc));
    sdesc_rem->AddContent(cricket::CN_AUDIO, cricket::NS_JINGLE_RTP,
                          new cricket::AudioContentDescription());
    sdesc_rem->AddContent(cricket::CN_VIDEO, cricket::NS_JINGLE_RTP,
                          new cricket::VideoContentDescription());
    EXPECT_TRUE(session1_.set_remote_description(sdesc_rem));

    // Test failures in SetLocalContent.
    media_channel1_->set_fail_set_recv_codecs(true);
    session1_.SetError(cricket::BaseSession::ERROR_NONE);
    session1_.SignalState(&session1_, cricket::Session::STATE_SENTINITIATE);
    EXPECT_EQ(cricket::BaseSession::ERROR_CONTENT, session1_.error());
    media_channel1_->set_fail_set_recv_codecs(true);
    session1_.SetError(cricket::BaseSession::ERROR_NONE);
    session1_.SignalState(&session1_, cricket::Session::STATE_SENTACCEPT);
    EXPECT_EQ(cricket::BaseSession::ERROR_CONTENT, session1_.error());

    // Test failures in SetRemoteContent.
    media_channel1_->set_fail_set_send_codecs(true);
    session1_.SetError(cricket::BaseSession::ERROR_NONE);
    session1_.SignalState(&session1_, cricket::Session::STATE_RECEIVEDINITIATE);
    EXPECT_EQ(cricket::BaseSession::ERROR_CONTENT, session1_.error());
    media_channel1_->set_fail_set_send_codecs(true);
    session1_.SetError(cricket::BaseSession::ERROR_NONE);
    session1_.SignalState(&session1_, cricket::Session::STATE_RECEIVEDACCEPT);
    EXPECT_EQ(cricket::BaseSession::ERROR_CONTENT, session1_.error());
  }

  void TestFlushRtcp() {
    bool send_rtcp1;

    CreateChannels(RTCP, RTCP);
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_EQ(2U, GetTransport1()->channels().size());
    EXPECT_EQ(2U, GetTransport2()->channels().size());

    // Send RTCP1 from a different thread.
    CallOnThreadAndWaitForDone(&ChannelTest<T>::SendRtcp1, &send_rtcp1);
    EXPECT_TRUE(send_rtcp1);
    // The sending message is only posted.  channel2_ should be empty.
    EXPECT_TRUE(CheckNoRtcp2());

    // When channel1_ is deleted, the RTCP packet should be sent out to
    // channel2_.
    channel1_.reset();
    EXPECT_TRUE(CheckRtcp2());
  }

  void TestChangeStateError() {
    CreateChannels(RTCP, RTCP);
    EXPECT_TRUE(SendInitiate());
    media_channel2_->set_fail_set_send(true);
    EXPECT_TRUE(channel2_->Enable(true));
    EXPECT_EQ(cricket::VoiceMediaChannel::ERROR_REC_DEVICE_OPEN_FAILED,
              error_);
  }

  void TestSrtpError() {
    static const unsigned char kBadPacket[] = {
      0x90, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01
    };
    CreateChannels(RTCP | SECURE, RTCP | SECURE);
    EXPECT_FALSE(channel1_->secure());
    EXPECT_FALSE(channel2_->secure());
    EXPECT_TRUE(SendInitiate());
    EXPECT_TRUE(SendAccept());
    EXPECT_TRUE(channel1_->secure());
    EXPECT_TRUE(channel2_->secure());
    channel2_->set_srtp_signal_silent_time(200);

    // Testing failures in sending packets.
    EXPECT_FALSE(media_channel2_->SendRtp(kBadPacket, sizeof(kBadPacket)));
    // The first failure will trigger an error.
    EXPECT_EQ_WAIT(T::MediaChannel::ERROR_REC_SRTP_ERROR, error_, 500);
    error_ = T::MediaChannel::ERROR_NONE;
    // The next 1 sec failures will not trigger an error.
    EXPECT_FALSE(media_channel2_->SendRtp(kBadPacket, sizeof(kBadPacket)));
    // Wait for a while to ensure no message comes in.
    talk_base::Thread::Current()->ProcessMessages(210);
    EXPECT_EQ(T::MediaChannel::ERROR_NONE, error_);
    // The error will be triggered again.
    EXPECT_FALSE(media_channel2_->SendRtp(kBadPacket, sizeof(kBadPacket)));
    EXPECT_EQ_WAIT(T::MediaChannel::ERROR_REC_SRTP_ERROR, error_, 500);

    // Testing failures in receiving packets.
    error_ = T::MediaChannel::ERROR_NONE;
    cricket::TransportChannel* transport_channel =
        channel2_->transport_channel();
    transport_channel->SignalReadPacket(
        transport_channel, reinterpret_cast<const char*>(kBadPacket),
        sizeof(kBadPacket));
    EXPECT_EQ_WAIT(T::MediaChannel::ERROR_PLAY_SRTP_AUTH_FAILED, error_, 500);
  }

 protected:
  cricket::FakeSession session1_;
  cricket::FakeSession session2_;
  cricket::FakeMediaEngine media_engine_;
  // The media channels are owned by the voice channel objects below.
  typename T::MediaChannel* media_channel1_;
  typename T::MediaChannel* media_channel2_;
  talk_base::scoped_ptr<typename T::Channel> channel1_;
  talk_base::scoped_ptr<typename T::Channel> channel2_;
  typename T::Content media_content1_;
  typename T::Content media_content2_;
  // The RTP and RTCP packets to send in the tests.
  std::string rtp_packet_;
  std::string rtcp_packet_;
  int media_info_callbacks1_;
  int media_info_callbacks2_;
  uint32 ssrc_;
  typename T::MediaChannel::Error error_;
};


template<>
void ChannelTest<VoiceTraits>::CreateContent(
    int flags,
    const cricket::AudioCodec& audio_codec,
    const cricket::VideoCodec& video_codec,
    cricket::AudioContentDescription* audio) {
  audio->AddCodec(audio_codec);
  audio->set_rtcp_mux((flags & RTCP_MUX) != 0);
  if (flags & SECURE) {
    audio->AddCrypto(cricket::CryptoParams(
        1, cricket::CS_AES_CM_128_HMAC_SHA1_32,
        "inline:" + talk_base::CreateRandomString(40), ""));
  }
}

template<>
bool ChannelTest<VoiceTraits>::CodecMatches(const cricket::AudioCodec& c1,
                                            const cricket::AudioCodec& c2) {
  return c1.name == c2.name && c1.clockrate == c2.clockrate &&
      c1.bitrate == c2.bitrate && c1.channels == c2.channels;
}

template<>
void ChannelTest<VoiceTraits>::AddLegacyStreamInContent(
    uint32 ssrc, int flags, cricket::AudioContentDescription* audio) {
  if (flags & SSRC_MUX)
    audio->AddLegacyStream(ssrc);
}

class VoiceChannelTest
    : public ChannelTest<VoiceTraits> {
 public:
  typedef ChannelTest<VoiceTraits>
  Base;
  VoiceChannelTest() : Base(kPcmuFrame, sizeof(kPcmuFrame),
                            kRtcpReport, sizeof(kRtcpReport)) {
  }
};

// override to add NULL parameter
template<>
cricket::VideoChannel* ChannelTest<VideoTraits>::CreateChannel(
    talk_base::Thread* thread, cricket::MediaEngineInterface* engine,
    cricket::FakeVideoMediaChannel* ch, cricket::BaseSession* session,
    bool rtcp) {
  cricket::VideoChannel* channel = new cricket::VideoChannel(
      thread, engine, ch, session, cricket::CN_VIDEO, rtcp, NULL);
  if (!channel->Init()) {
    delete channel;
    channel = NULL;
  }
  return channel;
}

// override to add 0 parameter
template<>
bool ChannelTest<VideoTraits>::AddStream1(int id) {
  return channel1_->AddStream(id, 0);
}

template<>
void ChannelTest<VideoTraits>::CreateContent(
    int flags,
    const cricket::AudioCodec& audio_codec,
    const cricket::VideoCodec& video_codec,
    cricket::VideoContentDescription* video) {
  video->AddCodec(video_codec);
  video->set_rtcp_mux((flags & RTCP_MUX) != 0);
  if (flags & SECURE) {
    video->AddCrypto(cricket::CryptoParams(
        1, cricket::CS_AES_CM_128_HMAC_SHA1_80,
        "inline:" + talk_base::CreateRandomString(40), ""));
  }
}

template<>
bool ChannelTest<VideoTraits>::CodecMatches(const cricket::VideoCodec& c1,
                                            const cricket::VideoCodec& c2) {
  return c1.name == c2.name && c1.width == c2.width && c1.height == c2.height &&
      c1.framerate == c2.framerate;
}

template<>
void ChannelTest<VideoTraits>::AddLegacyStreamInContent(
    uint32 ssrc, int flags, cricket::VideoContentDescription* video) {
  if (flags & SSRC_MUX)
    video->AddLegacyStream(ssrc);
}

class VideoChannelTest
    : public ChannelTest<VideoTraits> {
 public:
  typedef ChannelTest<VideoTraits>
  Base;
  VideoChannelTest() : Base(kH264Packet, sizeof(kH264Packet),
                            kRtcpReport, sizeof(kRtcpReport)) {
  }
};


// VoiceChannelTest

TEST_F(VoiceChannelTest, TestInit) {
  Base::TestInit();
  EXPECT_FALSE(media_channel1_->muted());
  EXPECT_TRUE(media_channel1_->dtmf_queue().empty());
}

TEST_F(VoiceChannelTest, TestSetRtcpCName) {
  Base::TestSetRtcpCName();
}

TEST_F(VoiceChannelTest, TestSetContents) {
  Base::TestSetContents();
}

TEST_F(VoiceChannelTest, TestSetContentsNullOffer) {
  Base::TestSetContentsNullOffer();
}

TEST_F(VoiceChannelTest, TestSetContentsRtcpMux) {
  Base::TestSetContentsRtcpMux();
}

TEST_F(VoiceChannelTest, TestSetRemoteContentUpdate) {
  Base::TestSetRemoteContentUpdate();
}

TEST_F(VoiceChannelTest, TestStreams) {
  Base::TestStreams();
}

TEST_F(VoiceChannelTest, TestPlayoutAndSendingStates) {
  Base::TestPlayoutAndSendingStates();
}

TEST_F(VoiceChannelTest, TestCallSetup) {
  Base::TestCallSetup();
}

TEST_F(VoiceChannelTest, TestCallTeardownRtcpMux) {
  Base::TestCallTeardownRtcpMux();
}

TEST_F(VoiceChannelTest, SendRtpToRtp) {
  Base::SendRtpToRtp();
}

TEST_F(VoiceChannelTest, SendNoRtcpToNoRtcp) {
  Base::SendNoRtcpToNoRtcp();
}

TEST_F(VoiceChannelTest, SendNoRtcpToRtcp) {
  Base::SendNoRtcpToRtcp();
}

TEST_F(VoiceChannelTest, SendRtcpToNoRtcp) {
  Base::SendRtcpToNoRtcp();
}

TEST_F(VoiceChannelTest, SendRtcpToRtcp) {
  Base::SendRtcpToRtcp();
}

TEST_F(VoiceChannelTest, SendRtcpMuxToRtcp) {
  Base::SendRtcpMuxToRtcp();
}

TEST_F(VoiceChannelTest, SendRtcpMuxToRtcpMux) {
  Base::SendRtcpMuxToRtcpMux();
}

TEST_F(VoiceChannelTest, SendEarlyRtcpMuxToRtcp) {
  Base::SendEarlyRtcpMuxToRtcp();
}

TEST_F(VoiceChannelTest, SendEarlyRtcpMuxToRtcpMux) {
  Base::SendEarlyRtcpMuxToRtcpMux();
}

TEST_F(VoiceChannelTest, SendSrtpToSrtp) {
  Base::SendSrtpToSrtp();
}

TEST_F(VoiceChannelTest, SendSrtpToRtp) {
  Base::SendSrtpToSrtp();
}

TEST_F(VoiceChannelTest, SendSrtcpMux) {
  Base::SendSrtcpMux();
}

TEST_F(VoiceChannelTest, SendRtpToRtpOnThread) {
  Base::SendRtpToRtpOnThread();
}

TEST_F(VoiceChannelTest, SendSrtpToSrtpOnThread) {
  Base::SendSrtpToSrtpOnThread();
}

TEST_F(VoiceChannelTest, SendWithWritabilityLoss) {
  Base::SendWithWritabilityLoss();
}

TEST_F(VoiceChannelTest, TestMediaMonitor) {
  Base::TestMediaMonitor();
}

// Test that Mute properly forwards to the media channel.
TEST_F(VoiceChannelTest, TestMute) {
  CreateChannels(0, 0);
  EXPECT_FALSE(media_channel1_->muted());
  EXPECT_TRUE(channel1_->Mute(true));
  EXPECT_TRUE(media_channel1_->muted());
  EXPECT_TRUE(channel1_->Mute(false));
  EXPECT_FALSE(media_channel1_->muted());
}

// Test that keyboard automute works correctly.
TEST_F(VoiceChannelTest, TestKeyboardMute) {
  CreateChannels(0, 0);
  EXPECT_FALSE(media_channel1_->muted());
  EXPECT_EQ(cricket::VoiceMediaChannel::ERROR_NONE, error_);

  cricket::VoiceMediaChannel::Error e =
      cricket::VoiceMediaChannel::ERROR_REC_TYPING_NOISE_DETECTED;

  // Typing doesn't mute automatically
  media_channel1_->TriggerError(0, e);
  talk_base::Thread::Current()->ProcessMessages(0);
  EXPECT_EQ(e, error_);
  EXPECT_FALSE(media_channel1_->muted());

  // But it does when enabled
  channel1_->set_mute_on_type(true, 200);
  media_channel1_->TriggerError(0, e);
  error_ = cricket::VoiceMediaChannel::ERROR_NONE;
  EXPECT_TRUE_WAIT(error_ == e, 100);
  EXPECT_TRUE(media_channel1_->muted());
  EXPECT_TRUE_WAIT(!media_channel1_->muted(), 250);  // And resets.

  // Muting manually preemts auto-unmute
  media_channel1_->TriggerError(0, e);
  error_ = cricket::VoiceMediaChannel::ERROR_NONE;
  EXPECT_TRUE_WAIT(error_ == e, 100);
  EXPECT_TRUE(media_channel1_->muted());
  EXPECT_TRUE(channel1_->Mute(true));
  talk_base::Thread::Current()->ProcessMessages(250);
  EXPECT_TRUE(media_channel1_->muted());
}

// Test that PressDTMF properly forwards to the media channel.
TEST_F(VoiceChannelTest, TestDtmf) {
  CreateChannels(0, 0);
  EXPECT_TRUE(SendInitiate());
  EXPECT_TRUE(SendAccept());
  EXPECT_EQ(0U, media_channel1_->dtmf_queue().size());
  EXPECT_TRUE(channel1_->PressDTMF(1, true));
  EXPECT_TRUE(channel1_->PressDTMF(8, false));
  ASSERT_EQ(2U, media_channel1_->dtmf_queue().size());
  EXPECT_EQ(1, media_channel1_->dtmf_queue()[0].first);
  EXPECT_EQ(true, media_channel1_->dtmf_queue()[0].second);
  EXPECT_EQ(8, media_channel1_->dtmf_queue()[1].first);
  EXPECT_FALSE(media_channel1_->dtmf_queue()[1].second);
}

TEST_F(VoiceChannelTest, TestMediaSinks) {
  Base::TestMediaSinks();
}

TEST_F(VoiceChannelTest, TestSetContentFailure) {
  Base::TestSetContentFailure();
}

TEST_F(VoiceChannelTest, TestFlushRtcp) {
  Base::TestFlushRtcp();
}

TEST_F(VoiceChannelTest, TestChangeStateError) {
  Base::TestChangeStateError();
}

TEST_F(VoiceChannelTest, TestSrtpError) {
  Base::TestSrtpError();
}

// Test that we can play a ringback tone properly.
TEST_F(VoiceChannelTest, TestRingbackTone) {
  CreateChannels(RTCP, RTCP);
  EXPECT_FALSE(media_channel1_->ringback_tone_play());
  EXPECT_TRUE(channel1_->SetRingbackTone("RIFF", 4));
  EXPECT_TRUE(SendInitiate());
  EXPECT_TRUE(SendAccept());
  // Play ringback tone, no loop.
  EXPECT_TRUE(channel1_->PlayRingbackTone(0, true, false));
  EXPECT_EQ(0U, media_channel1_->ringback_tone_ssrc());
  EXPECT_TRUE(media_channel1_->ringback_tone_play());
  EXPECT_FALSE(media_channel1_->ringback_tone_loop());
  // Stop the ringback tone.
  EXPECT_TRUE(channel1_->PlayRingbackTone(0, false, false));
  EXPECT_FALSE(media_channel1_->ringback_tone_play());
  // Add a stream.
  EXPECT_TRUE(AddStream1(1));
  // Play ringback tone, looping, on the new stream.
  EXPECT_TRUE(channel1_->PlayRingbackTone(1, true, true));
  EXPECT_EQ(1U, media_channel1_->ringback_tone_ssrc());
  EXPECT_TRUE(media_channel1_->ringback_tone_play());
  EXPECT_TRUE(media_channel1_->ringback_tone_loop());
  // Stop the ringback tone.
  EXPECT_TRUE(channel1_->PlayRingbackTone(1, false, false));
  EXPECT_FALSE(media_channel1_->ringback_tone_play());
}

// Test that we can scale the output volume properly for 1:1 calls.
TEST_F(VoiceChannelTest, TestScaleVolume1to1Call) {
  CreateChannels(RTCP, RTCP);
  EXPECT_TRUE(SendInitiate());
  EXPECT_TRUE(SendAccept());
  double left, right;

  // Default is (1.0, 1.0).
  EXPECT_TRUE(media_channel1_->GetOutputScaling(0, &left, &right));
  EXPECT_DOUBLE_EQ(1.0, left);
  EXPECT_DOUBLE_EQ(1.0, right);
  // invalid ssrc.
  EXPECT_FALSE(media_channel1_->GetOutputScaling(3, &left, &right));

  // Set scale to (1.5, 0.5).
  EXPECT_TRUE(channel1_->SetOutputScaling(0, 1.5, 0.5));
  EXPECT_TRUE(media_channel1_->GetOutputScaling(0, &left, &right));
  EXPECT_DOUBLE_EQ(1.5, left);
  EXPECT_DOUBLE_EQ(0.5, right);

  // Set scale to (0, 0).
  EXPECT_TRUE(channel1_->SetOutputScaling(0, 0.0, 0.0));
  EXPECT_TRUE(media_channel1_->GetOutputScaling(0, &left, &right));
  EXPECT_DOUBLE_EQ(0.0, left);
  EXPECT_DOUBLE_EQ(0.0, right);
}

// Test that we can scale the output volume properly for multiway calls.
TEST_F(VoiceChannelTest, TestScaleVolumeMultiwayCall) {
  CreateChannels(RTCP, RTCP);
  EXPECT_TRUE(SendInitiate());
  EXPECT_TRUE(SendAccept());
  EXPECT_TRUE(AddStream1(1));
  EXPECT_TRUE(AddStream1(2));

  double left, right;
  // Default is (1.0, 1.0).
  EXPECT_TRUE(media_channel1_->GetOutputScaling(0, &left, &right));
  EXPECT_DOUBLE_EQ(1.0, left);
  EXPECT_DOUBLE_EQ(1.0, right);
  EXPECT_TRUE(media_channel1_->GetOutputScaling(1, &left, &right));
  EXPECT_DOUBLE_EQ(1.0, left);
  EXPECT_DOUBLE_EQ(1.0, right);
  EXPECT_TRUE(media_channel1_->GetOutputScaling(2, &left, &right));
  EXPECT_DOUBLE_EQ(1.0, left);
  EXPECT_DOUBLE_EQ(1.0, right);
  // invalid ssrc.
  EXPECT_FALSE(media_channel1_->GetOutputScaling(3, &left, &right));

  // Set scale to (1.5, 0.5) for ssrc = 1.
  EXPECT_TRUE(channel1_->SetOutputScaling(1, 1.5, 0.5));
  EXPECT_TRUE(media_channel1_->GetOutputScaling(1, &left, &right));
  EXPECT_DOUBLE_EQ(1.5, left);
  EXPECT_DOUBLE_EQ(0.5, right);
  EXPECT_TRUE(media_channel1_->GetOutputScaling(2, &left, &right));
  EXPECT_DOUBLE_EQ(1.0, left);
  EXPECT_DOUBLE_EQ(1.0, right);
  EXPECT_TRUE(media_channel1_->GetOutputScaling(0, &left, &right));
  EXPECT_DOUBLE_EQ(1.0, left);
  EXPECT_DOUBLE_EQ(1.0, right);

  // Set scale to (0, 0) for all ssrcs.
  EXPECT_TRUE(channel1_->SetOutputScaling(0,  0.0, 0.0));
  EXPECT_TRUE(media_channel1_->GetOutputScaling(0, &left, &right));
  EXPECT_DOUBLE_EQ(0.0, left);
  EXPECT_DOUBLE_EQ(0.0, right);
  EXPECT_TRUE(media_channel1_->GetOutputScaling(1, &left, &right));
  EXPECT_DOUBLE_EQ(0.0, left);
  EXPECT_DOUBLE_EQ(0.0, right);
  EXPECT_TRUE(media_channel1_->GetOutputScaling(2, &left, &right));
  EXPECT_DOUBLE_EQ(0.0, left);
  EXPECT_DOUBLE_EQ(0.0, right);
}

TEST_F(VoiceChannelTest, SendSsrcMuxToSsrcMux) {
  Base::SendSsrcMuxToSsrcMux();
}

TEST_F(VoiceChannelTest, SendSsrcMuxToSsrcMuxWithRtcpMux) {
  Base::SendSsrcMuxToSsrcMuxWithRtcpMux();
}

// VideoChannelTest
TEST_F(VideoChannelTest, TestInit) {
  Base::TestInit();
}

TEST_F(VideoChannelTest, TestSetRtcpCName) {
  Base::TestSetRtcpCName();
}

TEST_F(VideoChannelTest, TestSetContents) {
  Base::TestSetContents();
}

TEST_F(VideoChannelTest, TestSetContentsNullOffer) {
  Base::TestSetContentsNullOffer();
}

TEST_F(VideoChannelTest, TestSetContentsRtcpMux) {
  Base::TestSetContentsRtcpMux();
}

TEST_F(VideoChannelTest, TestSetRemoteContentUpdate) {
  Base::TestSetRemoteContentUpdate();
}

TEST_F(VideoChannelTest, TestStreams) {
  Base::TestStreams();
}

TEST_F(VideoChannelTest, TestPlayoutAndSendingStates) {
  Base::TestPlayoutAndSendingStates();
}

TEST_F(VideoChannelTest, TestCallSetup) {
  Base::TestCallSetup();
}

TEST_F(VideoChannelTest, TestCallTeardownRtcpMux) {
  Base::TestCallTeardownRtcpMux();
}

TEST_F(VideoChannelTest, SendRtpToRtp) {
  Base::SendRtpToRtp();
}

TEST_F(VideoChannelTest, SendNoRtcpToNoRtcp) {
  Base::SendNoRtcpToNoRtcp();
}

TEST_F(VideoChannelTest, SendNoRtcpToRtcp) {
  Base::SendNoRtcpToRtcp();
}

TEST_F(VideoChannelTest, SendRtcpToNoRtcp) {
  Base::SendRtcpToNoRtcp();
}

TEST_F(VideoChannelTest, SendRtcpToRtcp) {
  Base::SendRtcpToRtcp();
}

TEST_F(VideoChannelTest, SendRtcpMuxToRtcp) {
  Base::SendRtcpMuxToRtcp();
}

TEST_F(VideoChannelTest, SendRtcpMuxToRtcpMux) {
  Base::SendRtcpMuxToRtcpMux();
}

TEST_F(VideoChannelTest, SendEarlyRtcpMuxToRtcp) {
  Base::SendEarlyRtcpMuxToRtcp();
}

TEST_F(VideoChannelTest, SendEarlyRtcpMuxToRtcpMux) {
  Base::SendEarlyRtcpMuxToRtcpMux();
}

TEST_F(VideoChannelTest, SendSrtpToSrtp) {
  Base::SendSrtpToSrtp();
}

TEST_F(VideoChannelTest, SendSrtpToRtp) {
  Base::SendSrtpToSrtp();
}

TEST_F(VideoChannelTest, SendSrtcpMux) {
  Base::SendSrtcpMux();
}

TEST_F(VideoChannelTest, SendRtpToRtpOnThread) {
  Base::SendRtpToRtpOnThread();
}

TEST_F(VideoChannelTest, SendSrtpToSrtpOnThread) {
  Base::SendSrtpToSrtpOnThread();
}

TEST_F(VideoChannelTest, SendWithWritabilityLoss) {
  Base::SendWithWritabilityLoss();
}

TEST_F(VideoChannelTest, TestMediaMonitor) {
  Base::TestMediaMonitor();
}

TEST_F(VideoChannelTest, TestMediaSinks) {
  Base::TestMediaSinks();
}

TEST_F(VideoChannelTest, TestSetContentFailure) {
  Base::TestSetContentFailure();
}

TEST_F(VideoChannelTest, TestFlushRtcp) {
  Base::TestFlushRtcp();
}

TEST_F(VideoChannelTest, SendSsrcMuxToSsrcMux) {
  Base::SendSsrcMuxToSsrcMux();
}

TEST_F(VideoChannelTest, SendSsrcMuxToSsrcMuxWithRtcpMux) {
  Base::SendSsrcMuxToSsrcMuxWithRtcpMux();
}

// TODO: Add VideoChannelTest.TestChangeStateError.

TEST_F(VideoChannelTest, TestSrtpError) {
  Base::TestSrtpError();
}
