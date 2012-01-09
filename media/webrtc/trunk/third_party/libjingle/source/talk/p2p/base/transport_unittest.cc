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
#include "talk/p2p/base/p2ptransport.h"

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

