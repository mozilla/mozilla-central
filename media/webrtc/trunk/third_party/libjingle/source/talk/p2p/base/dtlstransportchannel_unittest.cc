/*
 * libjingle
 * Copyright 2011, Google Inc.
 * Copyright 2011, RTFM, Inc.
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

#include <set>

#include "talk/base/common.h"
#include "talk/base/gunit.h"
#include "talk/base/helpers.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/stringutils.h"
#include "talk/base/thread.h"
#include "talk/p2p/base/fakesession.h"
#include "talk/base/ssladapter.h"
#include "talk/base/sslidentity.h"
#include "talk/base/sslstreamadapter.h"
#include "talk/p2p/base/dtlstransport.h"

#define MAYBE_SKIP_TEST(feature)                    \
  if (!(talk_base::SSLStreamAdapter::feature())) {  \
    LOG(LS_INFO) << "Feature disabled... skipping"; \
    return;                                         \
  }

class DtlsTestClient : public sigslot::has_slots<> {
 public:
  DtlsTestClient(const std::string& name,
                 talk_base::Thread* signaling_thread,
                 talk_base::Thread* worker_thread) :
      name_(name),
      signaling_thread_(signaling_thread),
      worker_thread_(worker_thread),
      transport_(new cricket::DtlsTransport<cricket::FakeTransport>(
          signaling_thread_, worker_thread, NULL)),
      packet_size_(0),
      dtls_bypass_(false) {
    transport_->SetAsync(true);
    transport_->SignalWritableState.connect(this,
        &DtlsTestClient::OnTransportWritableState);
  }

  void SetupDtls(bool bypass) {
    identity_.reset(talk_base::SSLIdentity::Generate(name_));
    dtls_bypass_ = bypass;
  }

  void NegotiateDtls(bool client, DtlsTestClient* peer) {
    ASSERT_TRUE(identity_.get() != NULL);
    ASSERT_TRUE(peer->identity_.get() != NULL);
    unsigned char digest[20];
    size_t digest_len;
    ASSERT_TRUE(peer->identity_->certificate().ComputeDigest(
        talk_base::DIGEST_SHA_1, digest, 20, &digest_len));

    for (std::vector<cricket::DtlsTransportChannelWrapper*>::iterator it
           = channels_.begin(); it != channels_.end(); ++it) {
      ASSERT_TRUE((*it)->SetupDtls(
          identity_.get(),
          client ? talk_base::SSL_CLIENT : talk_base::SSL_SERVER,
          talk_base::DIGEST_SHA_1, digest, digest_len));
      if (dtls_bypass_) {
        ASSERT_TRUE((*it)->SetBypassData(true));
      }
    }
  }

  void SetupChannels(int count) {
    for (int i = 0; i < count; ++i) {
      char name[20];
      talk_base::sprintfn(name, sizeof(name), "channel-%d", i);

      cricket::DtlsTransportChannelWrapper* channel =
          static_cast<cricket::DtlsTransportChannelWrapper*>(
              transport_->CreateChannel(name, "audio"));
      ASSERT_TRUE(channel != NULL);
      channel->SignalWritableState.connect(this,
        &DtlsTestClient::OnTransportChannelWritableState);
      channel->SignalReadPacket.connect(this,
        &DtlsTestClient::OnTransportChannelReadPacket);
      channels_.push_back(channel);

      // Hook the raw packets so that we can verify they are encrypted.
      channel->channel()->SignalReadPacket.connect(
          this, &DtlsTestClient::OnFakeTransportChannelReadPacket);
    }
  }

  bool Connect(DtlsTestClient* peer) {
    transport_->ConnectChannels();
    transport_->SetDestination(peer->transport_.get());
    return true;
  }

  bool writable() const { return transport_->writable(); }

  void SendPackets(size_t channel, size_t size, size_t count) {
    ASSERT(channel < channels_.size());
    char packet[1600];
    size_t sent = 0;
    do {
      memset(packet, sent & 0xff, size);
      packet[0] = 0;  // Make sure it doesn't look like DTLS
      talk_base::SetBE32(packet + 1, sent);

      int rv = channels_[channel]->SendPacket(packet, size);
      ASSERT_GT(rv, 0);
      ASSERT_EQ(size, static_cast<size_t>(rv));
      ++sent;
    } while (sent < count);
  }

  void ExpectPackets(size_t channel, size_t size) {
    packet_size_ = size;
    received_.clear();
  }

  size_t NumPacketsReceived() {
    return received_.size();
  }

  bool VerifyPacket(const char* data, size_t size, uint32* out_num) {
    if (size != packet_size_ || data[0] != 0) {
      return false;
    }
    uint32 packet_num = talk_base::GetBE32(data + 1);
    for (size_t i = 4; i < size; ++i) {
      if (static_cast<uint8>(data[i]) != (packet_num & 0xff)) {
        return false;
      }
    }
    if (out_num) {
      *out_num = packet_num;
    }
    return true;
  }
  bool VerifyEncryptedPacket(const char* data, size_t size) {
    // This is an encrypted data packet; let's make sure it's mostly random;
    // less than 10% of the bytes should be equal to the cleartext packet.
    if (size <= packet_size_) {
      return false;
    }
    uint32 packet_num = talk_base::GetBE32(data + 1);
    int num_matches = 0;
    for (size_t i = 4; i < size; ++i) {
      if (static_cast<uint8>(data[i]) == (packet_num & 0xff)) {
        ++num_matches;
      }
    }
    return (num_matches < ((static_cast<int>(size) - 5) / 10));
  }

  // Transport callbacks
  void OnTransportWritableState(cricket::Transport* transport) {
    LOG(LS_INFO) << name_ << ": is writable";
  }

  // Transport channel callbacks
  void OnTransportChannelWritableState(cricket::TransportChannel* channel) {
    LOG(LS_INFO) << name_ << ": Channel '" << channel->name()
                 << "' is writable";
  }

  void OnTransportChannelReadPacket(cricket::TransportChannel* channel,
                                    const char* data, size_t size) {
    uint32 packet_num = 0;
    ASSERT_TRUE(VerifyPacket(data, size, &packet_num));
    received_.insert(packet_num);
  }

  // Hook into the raw packet stream to make sure DTLS packets are encrypted.
  void OnFakeTransportChannelReadPacket(cricket::TransportChannel* channel,
                                        const char* data, size_t size) {
    // Chec
    if (identity_.get() && !(data[0] >= 20 && data[0] <= 22)) {
      if (!dtls_bypass_) {
        ASSERT_TRUE(VerifyEncryptedPacket(data, size));
      } else {
        ASSERT_TRUE(VerifyPacket(data, size, NULL));
      }
    }
  }

 private:
  std::string name_;
  talk_base::Thread* signaling_thread_;
  talk_base::Thread* worker_thread_;
  talk_base::scoped_ptr<cricket::FakeTransport> transport_;
  std::vector<cricket::DtlsTransportChannelWrapper*> channels_;
  size_t packet_size_;
  std::set<int> received_;
  talk_base::scoped_ptr<talk_base::SSLIdentity> identity_;
  bool dtls_bypass_;
};


class DtlsTransportChannelTest : public testing::Test {
 public:
  static void SetUpTestCase() {
    talk_base::InitializeSSL();
  }

  DtlsTransportChannelTest() :
      client1_("P1", talk_base::Thread::Current(),
               talk_base::Thread::Current()),
      client2_("P2", talk_base::Thread::Current(),
               talk_base::Thread::Current()),
      channel_ct_(1),
      dtls_setup_(false) {
  }

  void SetChannelCount(size_t channel_ct) {
    channel_ct_ = channel_ct;
  }
  void SetupDtls(bool bypass) {
    client1_.SetupDtls(bypass);
    client2_.SetupDtls(bypass);
    dtls_setup_ = true;
  }

  bool Connect() {
    client1_.SetupChannels(channel_ct_);
    client2_.SetupChannels(channel_ct_);
    if (dtls_setup_) {
      client2_.NegotiateDtls(false, &client1_);
      client1_.NegotiateDtls(true, &client2_);
    }
    bool rv = client1_.Connect(&client2_);
    EXPECT_TRUE(rv);
    if (!rv)
      return false;
    EXPECT_TRUE_WAIT(client1_.writable() && client2_.writable(), 10000);
    if (!client1_.writable())
      return false;
    if (!client2_.writable())
      return false;

    return true;
  }

  void TestTransfer(size_t channel, size_t size, size_t count) {
    LOG(LS_INFO) << "Expect packets, size=" << size;
    client2_.ExpectPackets(channel, size);
    client1_.SendPackets(channel, size, count);
    EXPECT_EQ_WAIT(count, client2_.NumPacketsReceived(), 2000);
  }

 protected:
  DtlsTestClient client1_;
  DtlsTestClient client2_;
  int channel_ct_;
  bool dtls_setup_;
};

// Connect without DTLS, and transfer some data.
TEST_F(DtlsTransportChannelTest, TestTransfer) {
  ASSERT_TRUE(Connect());
  TestTransfer(0, 1000, 100);
}

// Create two channels without DTLS, and transfer some data.
TEST_F(DtlsTransportChannelTest, TestTransferTwoChannels) {
  SetChannelCount(2);
  ASSERT_TRUE(Connect());
  TestTransfer(0, 1000, 100);
  TestTransfer(1, 1000, 100);
}

TEST_F(DtlsTransportChannelTest, TestTransferDtls) {
  MAYBE_SKIP_TEST(HaveDtls);
  SetupDtls(false);
  ASSERT_TRUE(Connect());
  TestTransfer(0, 1000, 100);
}

TEST_F(DtlsTransportChannelTest, TestTransferDtlsTwoChannels) {
  MAYBE_SKIP_TEST(HaveDtls);
  SetChannelCount(2);
  SetupDtls(false);
  ASSERT_TRUE(Connect());
  TestTransfer(0, 1000, 100);
  TestTransfer(1, 1000, 100);
}

TEST_F(DtlsTransportChannelTest, TestTransferDtlsBypass) {
  MAYBE_SKIP_TEST(HaveDtls);
  SetupDtls(true);
  ASSERT_TRUE(Connect());
  TestTransfer(0, 1000, 100);
}

TEST_F(DtlsTransportChannelTest, TestTransferDtlsBypassTwoChannels) {
  MAYBE_SKIP_TEST(HaveDtls);
  SetChannelCount(2);
  SetupDtls(true);
  ASSERT_TRUE(Connect());
  TestTransfer(0, 1000, 100);
  TestTransfer(1, 1000, 100);
}


