/*
 * libjingle
 * Copyright 2004--2005, Google Inc.
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

#include "talk/p2p/client/socketmonitor.h"
#include "talk/base/common.h"

namespace cricket {

const uint32 MSG_MONITOR_POLL = 1;
const uint32 MSG_MONITOR_START = 2;
const uint32 MSG_MONITOR_STOP = 3;
const uint32 MSG_MONITOR_SIGNAL = 4;

SocketMonitor::SocketMonitor(TransportChannel* channel,
                             talk_base::Thread* worker_thread,
                             talk_base::Thread* monitor_thread) {
  channel_ = channel;
  channel_thread_ = worker_thread;
  monitoring_thread_ = monitor_thread;
  monitoring_ = false;
}

SocketMonitor::~SocketMonitor() {
  channel_thread_->Clear(this);
  monitoring_thread_->Clear(this);
}

void SocketMonitor::Start(int milliseconds) {
  rate_ = milliseconds;
  if (rate_ < 250)
    rate_ = 250;
  channel_thread_->Post(this, MSG_MONITOR_START);
}

void SocketMonitor::Stop() {
  channel_thread_->Post(this, MSG_MONITOR_STOP);
}

void SocketMonitor::OnMessage(talk_base::Message *message) {
  talk_base::CritScope cs(&crit_);

  switch (message->message_id) {
  case MSG_MONITOR_START:
    ASSERT(talk_base::Thread::Current() == channel_thread_);
    if (!monitoring_) {
      monitoring_ = true;
      if (GetP2PChannel() != NULL) {
        GetP2PChannel()->SignalConnectionMonitor.connect(
            this, &SocketMonitor::OnConnectionMonitor);
      }
      PollSocket(true);
    }
    break;

  case MSG_MONITOR_STOP:
    ASSERT(talk_base::Thread::Current() == channel_thread_);
    if (monitoring_) {
      monitoring_ = false;
      if (GetP2PChannel() != NULL)
        GetP2PChannel()->SignalConnectionMonitor.disconnect(this);
      channel_thread_->Clear(this);
    }
    break;

  case MSG_MONITOR_POLL:
    ASSERT(talk_base::Thread::Current() == channel_thread_);
    PollSocket(true);
    break;

  case MSG_MONITOR_SIGNAL:
    {
      ASSERT(talk_base::Thread::Current() == monitoring_thread_);
      std::vector<ConnectionInfo> infos = connection_infos_;
      crit_.Leave();
      SignalUpdate(this, infos);
      crit_.Enter();
    }
    break;
  }
}

void SocketMonitor::OnConnectionMonitor(P2PTransportChannel* channel) {
  talk_base::CritScope cs(&crit_);
  if (monitoring_)
    PollSocket(false);
}

void SocketMonitor::PollSocket(bool poll) {
  ASSERT(talk_base::Thread::Current() == channel_thread_);
  talk_base::CritScope cs(&crit_);

  // Gather connection infos
  P2PTransportChannel* p2p_channel = GetP2PChannel();
  if (p2p_channel != NULL) {
    connection_infos_.clear();
    const std::vector<Connection *> &connections = p2p_channel->connections();
    std::vector<Connection *>::const_iterator it;
    for (it = connections.begin(); it != connections.end(); it++) {
      Connection *connection = *it;
      ConnectionInfo info;
      info.best_connection = p2p_channel->best_connection() == connection;
      info.readable =
          (connection->read_state() == Connection::STATE_READABLE);
      info.writable =
          (connection->write_state() == Connection::STATE_WRITABLE);
      info.timeout =
          (connection->write_state() == Connection::STATE_WRITE_TIMEOUT);
      info.new_connection = !connection->reported();
      connection->set_reported(true);
      info.rtt = connection->rtt();
      info.sent_total_bytes = connection->sent_total_bytes();
      info.sent_bytes_second = connection->sent_bytes_second();
      info.recv_total_bytes = connection->recv_total_bytes();
      info.recv_bytes_second = connection->recv_bytes_second();
      info.local_candidate = connection->local_candidate();
      info.remote_candidate = connection->remote_candidate();
      info.key = connection;
      connection_infos_.push_back(info);
    }
  }

  // Signal the monitoring thread, start another poll timer

  monitoring_thread_->Post(this, MSG_MONITOR_SIGNAL);
  if (poll)
    channel_thread_->PostDelayed(rate_, this, MSG_MONITOR_POLL);
}

}
