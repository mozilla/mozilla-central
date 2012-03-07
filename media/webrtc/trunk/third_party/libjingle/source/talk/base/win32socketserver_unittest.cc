// Copyright 2009 Google Inc. All Rights Reserved.


#include "talk/base/gunit.h"
#include "talk/base/socket_unittest.h"
#include "talk/base/thread.h"
#include "talk/base/win32socketserver.h"

namespace talk_base {

// Test that Win32SocketServer::Wait works as expected.
TEST(Win32SocketServerTest, TestWait) {
  Win32SocketServer server(NULL);
  uint32 start = Time();
  server.Wait(1000, true);
  EXPECT_GE(TimeSince(start), 1000);
}

// Test that Win32Socket::Pump does not touch general Windows messages.
TEST(Win32SocketServerTest, TestPump) {
  Win32SocketServer server(NULL);
  SocketServerScope scope(&server);
  EXPECT_EQ(TRUE, PostMessage(NULL, WM_USER, 999, 0));
  server.Pump();
  MSG msg;
  EXPECT_EQ(TRUE, PeekMessage(&msg, NULL, 0, 0, PM_REMOVE));
  EXPECT_EQ(WM_USER, msg.message);
  EXPECT_EQ(999, msg.wParam);
}

// Test that Win32Socket passes all the generic Socket tests.
class Win32SocketTest : public SocketTest {
 protected:
  Win32SocketTest() : server_(NULL), scope_(&server_) {}
  Win32SocketServer server_;
  SocketServerScope scope_;
};

TEST_F(Win32SocketTest, TestConnect) {
  SocketTest::TestConnect();
}

TEST_F(Win32SocketTest, TestConnectWithDnsLookup) {
  SocketTest::TestConnectWithDnsLookup();
}

TEST_F(Win32SocketTest, TestConnectFail) {
  SocketTest::TestConnectFail();
}

TEST_F(Win32SocketTest, TestConnectWithDnsLookupFail) {
  SocketTest::TestConnectWithDnsLookupFail();
}

TEST_F(Win32SocketTest, TestConnectWithClosedSocket) {
  SocketTest::TestConnectWithClosedSocket();
}

TEST_F(Win32SocketTest, TestServerCloseDuringConnect) {
  SocketTest::TestServerCloseDuringConnect();
}

TEST_F(Win32SocketTest, TestClientCloseDuringConnect) {
  SocketTest::TestClientCloseDuringConnect();
}

TEST_F(Win32SocketTest, TestServerClose) {
  SocketTest::TestServerClose();
}

TEST_F(Win32SocketTest, TestCloseInClosedCallback) {
  SocketTest::TestCloseInClosedCallback();
}

TEST_F(Win32SocketTest, TestSocketServerWait) {
  SocketTest::TestSocketServerWait();
}

TEST_F(Win32SocketTest, TestTcp) {
  SocketTest::TestTcp();
}

TEST_F(Win32SocketTest, TestUdp) {
  SocketTest::TestUdp();
}

TEST_F(Win32SocketTest, TestGetSetOptions) {
  SocketTest::TestGetSetOptions();
}

}  // namespace talk_base
