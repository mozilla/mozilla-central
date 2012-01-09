/*
 * libjingle
 * Copyright 2006, Google Inc.
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

#include <time.h>

#include <cmath>

#include "talk/base/logging.h"
#include "talk/base/gunit.h"
#include "talk/base/testclient.h"
#include "talk/base/testutils.h"
#include "talk/base/thread.h"
#include "talk/base/timeutils.h"
#include "talk/base/virtualsocketserver.h"

using namespace talk_base;

class VirtualSocketServerTest : public testing::Test {
 public:
  VirtualSocketServerTest() : ss_(new VirtualSocketServer(NULL)) {
  }

 protected:
  virtual void SetUp() {
    Thread::Current()->set_socketserver(ss_);
  }
  virtual void TearDown() {
    Thread::Current()->set_socketserver(NULL);
  }

  VirtualSocketServer* ss_;
};

TEST_F(VirtualSocketServerTest, basic) {
  SocketAddress addr1(IPAddress(INADDR_ANY), 5000);
  AsyncSocket* socket = ss_->CreateAsyncSocket(SOCK_DGRAM);
  socket->Bind(addr1);
  addr1 = socket->GetLocalAddress();

  TestClient* client1 = new TestClient(new AsyncUDPSocket(socket));
  AsyncSocket* socket2 = ss_->CreateAsyncSocket(SOCK_DGRAM);
  TestClient* client2 = new TestClient(new AsyncUDPSocket(socket2));

  SocketAddress addr2;
  EXPECT_EQ(3, client2->SendTo("foo", 3, addr1));
  EXPECT_TRUE(client1->CheckNextPacket("foo", 3, &addr2));

  SocketAddress addr3;
  EXPECT_EQ(6, client1->SendTo("bizbaz", 6, addr2));
  EXPECT_TRUE(client2->CheckNextPacket("bizbaz", 6, &addr3));
  EXPECT_EQ(addr3, addr1);

  for (int i = 0; i < 10; i++) {
    client2 = new TestClient(AsyncUDPSocket::Create(ss_, SocketAddress()));

    SocketAddress addr4;
    EXPECT_EQ(3, client2->SendTo("foo", 3, addr1));
    EXPECT_TRUE(client1->CheckNextPacket("foo", 3, &addr4));
    EXPECT_EQ(addr4.ipaddr().v4AddressAsHostOrderInteger(),
              addr2.ipaddr().v4AddressAsHostOrderInteger() + 1);
    EXPECT_EQ(addr4.port(), addr2.port() + 1);

    SocketAddress addr5;
    EXPECT_EQ(6, client1->SendTo("bizbaz", 6, addr4));
    EXPECT_TRUE(client2->CheckNextPacket("bizbaz", 6, &addr5));
    EXPECT_EQ(addr5, addr1);

    addr2 = addr4;
  }
}

TEST_F(VirtualSocketServerTest, connect) {
  testing::StreamSink sink;
  SocketAddress accept_addr;
  const SocketAddress kEmptyAddr;

  // Create client
  AsyncSocket* client = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(client);
  EXPECT_EQ(client->GetState(), AsyncSocket::CS_CLOSED);
  EXPECT_EQ(client->GetLocalAddress(), kEmptyAddr);

  // Create server
  AsyncSocket* server = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(server);
  EXPECT_NE(0, server->Listen(5));  // Bind required
  EXPECT_EQ(0, server->Bind(kEmptyAddr));
  EXPECT_EQ(0, server->Listen(5));
  EXPECT_EQ(server->GetState(), AsyncSocket::CS_CONNECTING);

  // No pending server connections
  EXPECT_FALSE(sink.Check(server, testing::SSE_READ));
  EXPECT_TRUE(NULL == server->Accept(&accept_addr));
  EXPECT_EQ(accept_addr, kEmptyAddr);

  // Attempt connect to listening socket
  EXPECT_EQ(0, client->Connect(server->GetLocalAddress()));
  EXPECT_NE(client->GetLocalAddress(), kEmptyAddr);  // Implicit Bind
  EXPECT_NE(client->GetLocalAddress(), server->GetLocalAddress());

  // Client is connecting
  EXPECT_EQ(client->GetState(), AsyncSocket::CS_CONNECTING);
  EXPECT_FALSE(sink.Check(client, testing::SSE_OPEN));
  EXPECT_FALSE(sink.Check(client, testing::SSE_CLOSE));

  ss_->ProcessMessagesUntilIdle();

  // Client still connecting
  EXPECT_EQ(client->GetState(), AsyncSocket::CS_CONNECTING);
  EXPECT_FALSE(sink.Check(client, testing::SSE_OPEN));
  EXPECT_FALSE(sink.Check(client, testing::SSE_CLOSE));

  // Server has pending connection
  EXPECT_TRUE(sink.Check(server, testing::SSE_READ));
  Socket* accepted = server->Accept(&accept_addr);
  EXPECT_TRUE(NULL != accepted);
  EXPECT_NE(accept_addr, kEmptyAddr);
  EXPECT_EQ(accepted->GetRemoteAddress(), accept_addr);

  EXPECT_EQ(accepted->GetState(), AsyncSocket::CS_CONNECTED);
  EXPECT_EQ(accepted->GetLocalAddress(), server->GetLocalAddress());
  EXPECT_EQ(accepted->GetRemoteAddress(), client->GetLocalAddress());

  ss_->ProcessMessagesUntilIdle();

  // Client has connected
  EXPECT_EQ(client->GetState(), AsyncSocket::CS_CONNECTED);
  EXPECT_TRUE(sink.Check(client, testing::SSE_OPEN));
  EXPECT_FALSE(sink.Check(client, testing::SSE_CLOSE));
  EXPECT_EQ(client->GetRemoteAddress(), server->GetLocalAddress());
  EXPECT_EQ(client->GetRemoteAddress(), accepted->GetLocalAddress());
}

TEST_F(VirtualSocketServerTest, connect_to_non_listener) {
  testing::StreamSink sink;
  SocketAddress accept_addr;
  const SocketAddress kEmptyAddr;

  // Create client
  AsyncSocket* client = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(client);

  // Create server
  AsyncSocket* server = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(server);
  EXPECT_EQ(0, server->Bind(kEmptyAddr));

  // Attempt connect to non-listening socket
  EXPECT_EQ(0, client->Connect(server->GetLocalAddress()));

  ss_->ProcessMessagesUntilIdle();

  // No pending server connections
  EXPECT_FALSE(sink.Check(server, testing::SSE_READ));
  EXPECT_TRUE(NULL == server->Accept(&accept_addr));
  EXPECT_EQ(accept_addr, kEmptyAddr);

  // Connection failed
  EXPECT_EQ(client->GetState(), AsyncSocket::CS_CLOSED);
  EXPECT_FALSE(sink.Check(client, testing::SSE_OPEN));
  EXPECT_TRUE(sink.Check(client, testing::SSE_ERROR));
  EXPECT_EQ(client->GetRemoteAddress(), kEmptyAddr);
}

TEST_F(VirtualSocketServerTest, close_during_connect) {
  testing::StreamSink sink;
  SocketAddress accept_addr;
  const SocketAddress kEmptyAddr;

  // Create client and server
  AsyncSocket* client = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(client);
  AsyncSocket* server = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(server);

  // Initiate connect
  EXPECT_EQ(0, server->Bind(kEmptyAddr));
  EXPECT_EQ(0, server->Listen(5));
  EXPECT_EQ(0, client->Connect(server->GetLocalAddress()));

  // Server close before socket enters accept queue
  EXPECT_FALSE(sink.Check(server, testing::SSE_READ));
  server->Close();

  ss_->ProcessMessagesUntilIdle();

  // Result: connection failed
  EXPECT_EQ(client->GetState(), AsyncSocket::CS_CLOSED);
  EXPECT_TRUE(sink.Check(client, testing::SSE_ERROR));

  // New server
  delete server;
  server = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(server);

  // Initiate connect
  EXPECT_EQ(0, server->Bind(kEmptyAddr));
  EXPECT_EQ(0, server->Listen(5));
  EXPECT_EQ(0, client->Connect(server->GetLocalAddress()));

  ss_->ProcessMessagesUntilIdle();

  // Server close while socket is in accept queue
  EXPECT_TRUE(sink.Check(server, testing::SSE_READ));
  server->Close();

  ss_->ProcessMessagesUntilIdle();

  // Result: connection failed
  EXPECT_EQ(client->GetState(), AsyncSocket::CS_CLOSED);
  EXPECT_TRUE(sink.Check(client, testing::SSE_ERROR));

  // New server
  delete server;
  server = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(server);

  // Initiate connect
  EXPECT_EQ(0, server->Bind(kEmptyAddr));
  EXPECT_EQ(0, server->Listen(5));
  EXPECT_EQ(0, client->Connect(server->GetLocalAddress()));

  ss_->ProcessMessagesUntilIdle();

  // Server accepts connection
  EXPECT_TRUE(sink.Check(server, testing::SSE_READ));
  AsyncSocket* accepted = server->Accept(&accept_addr);
  ASSERT_TRUE(NULL != accepted);
  sink.Monitor(accepted);

  // Client closes before connection complets
  EXPECT_EQ(accepted->GetState(), AsyncSocket::CS_CONNECTED);

  // Connected message has not been processed yet.
  EXPECT_EQ(client->GetState(), AsyncSocket::CS_CONNECTING);
  client->Close();

  ss_->ProcessMessagesUntilIdle();

  // Result: accepted socket closes
  EXPECT_EQ(accepted->GetState(), AsyncSocket::CS_CLOSED);
  EXPECT_TRUE(sink.Check(accepted, testing::SSE_CLOSE));
  EXPECT_FALSE(sink.Check(client, testing::SSE_CLOSE));
}

TEST_F(VirtualSocketServerTest, close) {
  testing::StreamSink sink;
  const SocketAddress kEmptyAddr;

  // Create clients
  AsyncSocket* a = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(a);
  a->Bind(kEmptyAddr);

  AsyncSocket* b = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(b);
  b->Bind(kEmptyAddr);

  EXPECT_EQ(0, a->Connect(b->GetLocalAddress()));
  EXPECT_EQ(0, b->Connect(a->GetLocalAddress()));

  ss_->ProcessMessagesUntilIdle();

  EXPECT_TRUE(sink.Check(a, testing::SSE_OPEN));
  EXPECT_EQ(a->GetState(), AsyncSocket::CS_CONNECTED);
  EXPECT_EQ(a->GetRemoteAddress(), b->GetLocalAddress());

  EXPECT_TRUE(sink.Check(b, testing::SSE_OPEN));
  EXPECT_EQ(b->GetState(), AsyncSocket::CS_CONNECTED);
  EXPECT_EQ(b->GetRemoteAddress(), a->GetLocalAddress());

  EXPECT_EQ(1, a->Send("a", 1));
  b->Close();
  EXPECT_EQ(1, a->Send("b", 1));

  ss_->ProcessMessagesUntilIdle();

  char buffer[10];
  EXPECT_FALSE(sink.Check(b, testing::SSE_READ));
  EXPECT_EQ(-1, b->Recv(buffer, 10));

  EXPECT_TRUE(sink.Check(a, testing::SSE_CLOSE));
  EXPECT_EQ(a->GetState(), AsyncSocket::CS_CLOSED);
  EXPECT_EQ(a->GetRemoteAddress(), kEmptyAddr);

  EXPECT_FALSE(sink.Check(b, testing::SSE_CLOSE));  // No signal for Closer
  EXPECT_EQ(b->GetState(), AsyncSocket::CS_CLOSED);
  EXPECT_EQ(b->GetRemoteAddress(), kEmptyAddr);
}

TEST_F(VirtualSocketServerTest, tcp_send) {
  testing::StreamSink sink;
  const SocketAddress kEmptyAddr;

  // Connect two sockets
  AsyncSocket* a = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(a);
  a->Bind(kEmptyAddr);

  AsyncSocket* b = ss_->CreateAsyncSocket(SOCK_STREAM);
  sink.Monitor(b);
  b->Bind(kEmptyAddr);

  EXPECT_EQ(0, a->Connect(b->GetLocalAddress()));
  EXPECT_EQ(0, b->Connect(a->GetLocalAddress()));

  ss_->ProcessMessagesUntilIdle();

  const size_t kBufferSize = 2000;
  ss_->set_send_buffer_capacity(kBufferSize);
  ss_->set_recv_buffer_capacity(kBufferSize);

  const size_t kDataSize = 5000;
  char send_buffer[kDataSize], recv_buffer[kDataSize];
  for (size_t i = 0; i < kDataSize; ++i) send_buffer[i] = i;
  memset(recv_buffer, 0, sizeof(recv_buffer));
  size_t send_pos = 0, recv_pos = 0;

  // Can't send more than send buffer in one write
  int result = a->Send(send_buffer + send_pos, kDataSize - send_pos);
  EXPECT_EQ(static_cast<int>(kBufferSize), result);
  send_pos += result;

  ss_->ProcessMessagesUntilIdle();
  EXPECT_FALSE(sink.Check(a, testing::SSE_WRITE));
  EXPECT_TRUE(sink.Check(b, testing::SSE_READ));

  // Receive buffer is already filled, fill send buffer again
  result = a->Send(send_buffer + send_pos, kDataSize - send_pos);
  EXPECT_EQ(static_cast<int>(kBufferSize), result);
  send_pos += result;

  ss_->ProcessMessagesUntilIdle();
  EXPECT_FALSE(sink.Check(a, testing::SSE_WRITE));
  EXPECT_FALSE(sink.Check(b, testing::SSE_READ));

  // No more room in send or receive buffer
  result = a->Send(send_buffer + send_pos, kDataSize - send_pos);
  EXPECT_EQ(-1, result);
  EXPECT_TRUE(a->IsBlocking());

  // Read a subset of the data
  result = b->Recv(recv_buffer + recv_pos, 500);
  EXPECT_EQ(500, result);
  recv_pos += result;

  ss_->ProcessMessagesUntilIdle();
  EXPECT_TRUE(sink.Check(a, testing::SSE_WRITE));
  EXPECT_TRUE(sink.Check(b, testing::SSE_READ));

  // Room for more on the sending side
  result = a->Send(send_buffer + send_pos, kDataSize - send_pos);
  EXPECT_EQ(500, result);
  send_pos += result;

  // Empty the recv buffer
  while (true) {
    result = b->Recv(recv_buffer + recv_pos, kDataSize - recv_pos);
    if (result < 0) {
      EXPECT_EQ(-1, result);
      EXPECT_TRUE(b->IsBlocking());
      break;
    }
    recv_pos += result;
  }

  ss_->ProcessMessagesUntilIdle();
  EXPECT_TRUE(sink.Check(b, testing::SSE_READ));

  // Continue to empty the recv buffer
  while (true) {
    result = b->Recv(recv_buffer + recv_pos, kDataSize - recv_pos);
    if (result < 0) {
      EXPECT_EQ(-1, result);
      EXPECT_TRUE(b->IsBlocking());
      break;
    }
    recv_pos += result;
  }

  // Send last of the data
  result = a->Send(send_buffer + send_pos, kDataSize - send_pos);
  EXPECT_EQ(500, result);
  send_pos += result;

  ss_->ProcessMessagesUntilIdle();
  EXPECT_TRUE(sink.Check(b, testing::SSE_READ));

  // Receive the last of the data
  while (true) {
    result = b->Recv(recv_buffer + recv_pos, kDataSize - recv_pos);
    if (result < 0) {
      EXPECT_EQ(-1, result);
      EXPECT_TRUE(b->IsBlocking());
      break;
    }
    recv_pos += result;
  }

  ss_->ProcessMessagesUntilIdle();
  EXPECT_FALSE(sink.Check(b, testing::SSE_READ));

  // The received data matches the sent data
  EXPECT_EQ(kDataSize, send_pos);
  EXPECT_EQ(kDataSize, recv_pos);
  EXPECT_EQ(0, memcmp(recv_buffer, send_buffer, kDataSize));
}

TEST_F(VirtualSocketServerTest, CreatesStandardDistribution) {
  const uint32 kTestMean[] = { 10, 100, 333, 1000 };
  const double kTestDev[] = { 0.25, 0.1, 0.01 };
  // TODO: The current code only works for 1000 data points or more.
  const uint32 kTestSamples[] = { /*10, 100,*/ 1000 };
  for (size_t midx = 0; midx < ARRAY_SIZE(kTestMean); ++midx) {
    for (size_t didx = 0; didx < ARRAY_SIZE(kTestDev); ++didx) {
      for (size_t sidx = 0; sidx < ARRAY_SIZE(kTestSamples); ++sidx) {
        ASSERT_LT(0u, kTestSamples[sidx]);
        const uint32 kStdDev =
            static_cast<uint32>(kTestDev[didx] * kTestMean[midx]);
        VirtualSocketServer::Function* f =
            VirtualSocketServer::CreateDistribution(kTestMean[midx],
                                                    kStdDev,
                                                    kTestSamples[sidx]);
        ASSERT_TRUE(NULL != f);
        ASSERT_EQ(kTestSamples[sidx], f->size());
        double sum = 0;
        for (uint32 i = 0; i < f->size(); ++i) {
          sum += (*f)[i].second;
        }
        const double mean = sum / f->size();
        double sum_sq_dev = 0;
        for (uint32 i = 0; i < f->size(); ++i) {
          double dev = (*f)[i].second - mean;
          sum_sq_dev += dev * dev;
        }
        const double stddev = std::sqrt(sum_sq_dev / f->size());
        EXPECT_NEAR(kTestMean[midx], mean, 0.1 * kTestMean[midx])
          << "M=" << kTestMean[midx]
          << " SD=" << kStdDev
          << " N=" << kTestSamples[sidx];
        EXPECT_NEAR(kStdDev, stddev, 0.1 * kStdDev)
          << "M=" << kTestMean[midx]
          << " SD=" << kStdDev
          << " N=" << kTestSamples[sidx];
        delete f;
      }
    }
  }
}

TEST_F(VirtualSocketServerTest, TcpSendsPacketsInOrder) {
  const SocketAddress kEmptyAddr;

  // Connect two sockets
  AsyncSocket* a = ss_->CreateAsyncSocket(SOCK_STREAM);
  AsyncSocket* b = ss_->CreateAsyncSocket(SOCK_STREAM);
  a->Bind(kEmptyAddr);
  b->Bind(kEmptyAddr);
  EXPECT_EQ(0, a->Connect(b->GetLocalAddress()));
  EXPECT_EQ(0, b->Connect(a->GetLocalAddress()));
  ss_->ProcessMessagesUntilIdle();

  // First, deliver all packets in 0 ms.
  char buffer[2] = { 0, 0 };
  const size_t cNumPackets = 10;
  for (size_t i = 0; i < cNumPackets; ++i) {
    buffer[0] = '0' + i;
    EXPECT_EQ(1, a->Send(buffer, 1));
  }

  ss_->ProcessMessagesUntilIdle();

  for (size_t i = 0; i < cNumPackets; ++i) {
    EXPECT_EQ(1, b->Recv(buffer, sizeof(buffer)));
    EXPECT_EQ(static_cast<char>('0' + i), buffer[0]);
  }

  // Next, deliver packets at random intervals
  const uint32 mean = 50;
  const uint32 stddev = 50;

  ss_->set_delay_mean(mean);
  ss_->set_delay_stddev(stddev);
  ss_->UpdateDelayDistribution();

  for (size_t i = 0; i < cNumPackets; ++i) {
    buffer[0] = 'A' + i;
    EXPECT_EQ(1, a->Send(buffer, 1));
  }

  ss_->ProcessMessagesUntilIdle();

  for (size_t i = 0; i < cNumPackets; ++i) {
    EXPECT_EQ(1, b->Recv(buffer, sizeof(buffer)));
    EXPECT_EQ(static_cast<char>('A' + i), buffer[0]);
  }
}

// Sends at a constant rate but with random packet sizes.
struct Sender : public MessageHandler {
  Sender(Thread* th, AsyncSocket* s, uint32 rt)
      : thread(th), socket(new AsyncUDPSocket(s)),
        done(false), rate(rt), count(0) {
    last_send = Time();
    thread->PostDelayed(NextDelay(), this, 1);
  }

  uint32 NextDelay() {
    uint32 size = (rand() % 4096) + 1;
    return 1000 * size / rate;
  }

  void OnMessage(Message* pmsg) {
    ASSERT_EQ(1u, pmsg->message_id);

    if (done)
      return;

    uint32 cur_time = Time();
    uint32 delay = cur_time - last_send;
    uint32 size = rate * delay / 1000;
    size = std::min<uint32>(size, 4096);
    size = std::max<uint32>(size, sizeof(uint32));

    count += size;
    memcpy(dummy, &cur_time, sizeof(cur_time));
    socket->Send(dummy, size);

    last_send = cur_time;
    thread->PostDelayed(NextDelay(), this, 1);
  }

  Thread* thread;
  scoped_ptr<AsyncUDPSocket> socket;
  bool done;
  uint32 rate;  // bytes per second
  uint32 count;
  uint32 last_send;
  char dummy[4096];
};

struct Receiver : public MessageHandler, public sigslot::has_slots<> {
  Receiver(Thread* th, AsyncSocket* s, uint32 bw)
      : thread(th), socket(new AsyncUDPSocket(s)), bandwidth(bw), done(false),
        count(0), sec_count(0), sum(0), sum_sq(0), samples(0) {
    socket->SignalReadPacket.connect(this, &Receiver::OnReadPacket);
    thread->PostDelayed(1000, this, 1);
  }

  ~Receiver() {
    thread->Clear(this);
  }

  void OnReadPacket(AsyncPacketSocket* s, const char* data, size_t size,
                    const SocketAddress& remote_addr) {
    ASSERT_EQ(socket.get(), s);
    ASSERT_GE(size, 4U);

    count += size;
    sec_count += size;

    uint32 send_time = *reinterpret_cast<const uint32*>(data);
    uint32 recv_time = Time();
    uint32 delay = recv_time - send_time;
    sum += delay;
    sum_sq += delay * delay;
    samples += 1;
  }

  void OnMessage(Message* pmsg) {
    ASSERT_EQ(1u, pmsg->message_id);

    if (done)
      return;

    // It is always possible for us to receive more than expected because
    // packets can be further delayed in delivery.
    if (bandwidth > 0)
      ASSERT_TRUE(sec_count <= 5 * bandwidth / 4);
    sec_count = 0;
    thread->PostDelayed(1000, this, 1);
  }

  Thread* thread;
  scoped_ptr<AsyncUDPSocket> socket;
  uint32 bandwidth;
  bool done;
  uint32 count;
  uint32 sec_count;
  double sum;
  double sum_sq;
  uint32 samples;
};

TEST_F(VirtualSocketServerTest, bandwidth) {
  AsyncSocket* send_socket = ss_->CreateAsyncSocket(SOCK_DGRAM);
  AsyncSocket* recv_socket = ss_->CreateAsyncSocket(SOCK_DGRAM);
  ASSERT_EQ(0, send_socket->Bind(SocketAddress(IPAddress(INADDR_ANY), 1000)));
  ASSERT_EQ(0, recv_socket->Bind(SocketAddress(IPAddress(INADDR_ANY), 1000)));
  ASSERT_EQ(0, send_socket->Connect(recv_socket->GetLocalAddress()));

  uint32 bandwidth = 64 * 1024;
  ss_->set_bandwidth(bandwidth);

  Thread* pthMain = Thread::Current();
  Sender sender(pthMain, send_socket, 80 * 1024);
  Receiver receiver(pthMain, recv_socket, bandwidth);

  pthMain->ProcessMessages(5000);
  sender.done = true;
  pthMain->ProcessMessages(5000);

  ASSERT_TRUE(receiver.count >= 5 * 3 * bandwidth / 4);
  ASSERT_TRUE(receiver.count <= 6 * bandwidth);  // queue could drain for 1 sec

  ss_->set_bandwidth(0);
}

TEST_F(VirtualSocketServerTest, delay) {
  time_t seed = ::time(NULL);
  LOG(LS_VERBOSE) << "seed = " << seed;
  srand(seed);

  const uint32 mean = 2000;
  const uint32 stddev = 500;

  ss_->set_delay_mean(mean);
  ss_->set_delay_stddev(stddev);
  ss_->UpdateDelayDistribution();

  AsyncSocket* send_socket = ss_->CreateAsyncSocket(SOCK_DGRAM);
  AsyncSocket* recv_socket = ss_->CreateAsyncSocket(SOCK_DGRAM);
  ASSERT_EQ(0, send_socket->Bind(SocketAddress(IPAddress(INADDR_ANY), 1000)));
  ASSERT_EQ(0, recv_socket->Bind(SocketAddress(IPAddress(INADDR_ANY), 1000)));
  ASSERT_EQ(0, send_socket->Connect(recv_socket->GetLocalAddress()));

  Thread* pthMain = Thread::Current();
  // Avg packet size is 2K, so at 200KB/s for 10s, we should see about
  // 1000 packets, which is necessary to get a good distribution.
  Sender sender(pthMain, send_socket, 100 * 2 * 1024);
  Receiver receiver(pthMain, recv_socket, 0);

  pthMain->ProcessMessages(10000);
  sender.done = receiver.done = true;
  ss_->ProcessMessagesUntilIdle();

  const double sample_mean = receiver.sum / receiver.samples;
  double num = receiver.samples * receiver.sum_sq - receiver.sum * receiver.sum;
  double den = receiver.samples * (receiver.samples - 1);
  const double sample_stddev = std::sqrt(num / den);
  LOG(LS_VERBOSE) << "mean=" << sample_mean << " stddev=" << sample_stddev;

  EXPECT_LE(500u, receiver.samples);
  // We initially used a 0.1 fudge factor, but on the build machine, we
  // have seen the value differ by as much as 0.13.
  EXPECT_NEAR(mean, sample_mean, 0.15 * mean);
  EXPECT_NEAR(stddev, sample_stddev, 0.15 * stddev);

  ss_->set_delay_mean(0);
  ss_->set_delay_stddev(0);
  ss_->UpdateDelayDistribution();
}
