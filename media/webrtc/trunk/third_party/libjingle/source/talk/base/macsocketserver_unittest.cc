/*
 * libjingle
 * Copyright 2009, Google Inc.
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
#include "talk/base/scoped_ptr.h"
#include "talk/base/socket_unittest.h"
#include "talk/base/thread.h"
#include "talk/base/macsocketserver.h"

namespace talk_base {

class WakeThread : public Thread {
 public:
  WakeThread(SocketServer* ss) : ss_(ss) {
  }
  void Run() {
    ss_->WakeUp();
  }
 private:
  SocketServer* ss_;
};

// Test that MacCFSocketServer::Wait works as expected.
TEST(MacCFSocketServerTest, TestWait) {
  MacCFSocketServer server;
  uint32 start = Time();
  server.Wait(1000, true);
  EXPECT_GE(TimeSince(start), 1000);
}

// Test that MacCFSocketServer::Wakeup works as expected.
TEST(MacCFSocketServerTest, TestWakeup) {
  MacCFSocketServer server;
  WakeThread thread(&server);
  uint32 start = Time();
  thread.Start();
  server.Wait(10000, true);
  EXPECT_LT(TimeSince(start), 10000);
}

// Test that MacCarbonSocketServer::Wait works as expected.
TEST(MacCarbonSocketServerTest, TestWait) {
  MacCarbonSocketServer server;
  uint32 start = Time();
  server.Wait(1000, true);
  EXPECT_GE(TimeSince(start), 1000);
}

// Test that MacCarbonSocketServer::Wakeup works as expected.
TEST(MacCarbonSocketServerTest, TestWakeup) {
  MacCarbonSocketServer server;
  WakeThread thread(&server);
  uint32 start = Time();
  thread.Start();
  server.Wait(10000, true);
  EXPECT_LT(TimeSince(start), 10000);
}

// Test that MacCarbonAppSocketServer::Wait works as expected.
TEST(MacCarbonAppSocketServerTest, TestWait) {
  MacCarbonAppSocketServer server;
  uint32 start = Time();
  server.Wait(1000, true);
  EXPECT_GE(TimeSince(start), 1000);
}

// Test that MacCarbonAppSocketServer::Wakeup works as expected.
TEST(MacCarbonAppSocketServerTest, TestWakeup) {
  MacCarbonAppSocketServer server;
  WakeThread thread(&server);
  uint32 start = Time();
  thread.Start();
  server.Wait(10000, true);
  EXPECT_LT(TimeSince(start), 10000);
}

// Test that MacAsyncSocket passes all the generic Socket tests.
class MacAsyncSocketTest : public SocketTest {
 protected:
  MacAsyncSocketTest()
      : server_(CreateSocketServer()),
        scope_(server_.get()) {}
  // Override for other implementations of MacBaseSocketServer.
  virtual MacBaseSocketServer* CreateSocketServer() {
    return new MacCFSocketServer();
  };
  talk_base::scoped_ptr<MacBaseSocketServer> server_;
  SocketServerScope scope_;
};

TEST_F(MacAsyncSocketTest, TestConnect) {
  SocketTest::TestConnect();
}

TEST_F(MacAsyncSocketTest, TestConnectWithDnsLookup) {
  SocketTest::TestConnectWithDnsLookup();
}

TEST_F(MacAsyncSocketTest, TestConnectFail) {
  SocketTest::TestConnectFail();
}

// Reenable once we have mac async dns
TEST_F(MacAsyncSocketTest, DISABLED_TestConnectWithDnsLookupFail) {
  SocketTest::TestConnectWithDnsLookupFail();
}

TEST_F(MacAsyncSocketTest, TestConnectWithClosedSocket) {
  SocketTest::TestConnectWithClosedSocket();
}

// Flaky at the moment (10% failure rate).  Seems the client doesn't get
// signalled in a timely manner...
TEST_F(MacAsyncSocketTest, DISABLED_TestServerCloseDuringConnect) {
  SocketTest::TestServerCloseDuringConnect();
}
// Flaky at the moment (0.5% failure rate).  Seems the client doesn't get
// signalled in a timely manner...
TEST_F(MacAsyncSocketTest, TestClientCloseDuringConnect) {
  SocketTest::TestClientCloseDuringConnect();
}

TEST_F(MacAsyncSocketTest, TestServerClose) {
  SocketTest::TestServerClose();
}

TEST_F(MacAsyncSocketTest, TestCloseInClosedCallback) {
  SocketTest::TestCloseInClosedCallback();
}

TEST_F(MacAsyncSocketTest, TestSocketServerWait) {
  SocketTest::TestSocketServerWait();
}

TEST_F(MacAsyncSocketTest, TestTcp) {
  SocketTest::TestTcp();
}

TEST_F(MacAsyncSocketTest, TestSingleFlowControlCallback) {
  SocketTest::TestSingleFlowControlCallback();
}

TEST_F(MacAsyncSocketTest, DISABLED_TestUdp) {
  SocketTest::TestUdp();
}

TEST_F(MacAsyncSocketTest, DISABLED_TestGetSetOptions) {
  SocketTest::TestGetSetOptions();
}

class MacCarbonAsyncSocketTest : public MacAsyncSocketTest {
  virtual MacBaseSocketServer* CreateSocketServer() {
    return new MacCarbonSocketServer();
  };
};

TEST_F(MacCarbonAsyncSocketTest, TestSocketServerWait) {
  SocketTest::TestSocketServerWait();
}

class MacCarbonAppAsyncSocketTest : public MacAsyncSocketTest {
  virtual MacBaseSocketServer* CreateSocketServer() {
    return new MacCarbonAppSocketServer();
  };
};

TEST_F(MacCarbonAppAsyncSocketTest, TestSocketServerWait) {
  SocketTest::TestSocketServerWait();
}

}  // namespace talk_base
