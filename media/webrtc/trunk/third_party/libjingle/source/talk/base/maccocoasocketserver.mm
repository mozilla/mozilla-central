/*
 * libjingle
 * Copyright 2007, Google Inc.
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

#import <assert.h>

#import "talk/base/maccocoasocketserver.h"
#import "talk/base/logging.h"
#import "talk/base/macasyncsocket.h"

static const double kTimerIntervalSecs = 0.1;

@implementation MacCocoaSocketServerHelper

- (id)initWithSocketServer:(talk_base::MacCocoaSocketServer*)ss {
  self = [super init];
  if (self) {
    socketServer = ss;
  }
  return self;
}

- (void)timerFired:(NSTimer*)timer {
  socketServer->Pump();
}

- (void)wakeUp {
  socketServer->Pump();
}

@end

namespace talk_base {

MacCocoaSocketServer::MacCocoaSocketServer(MessageQueue* message_queue) :
    message_queue_(message_queue) {
  helper_ = [[MacCocoaSocketServerHelper alloc] initWithSocketServer:this];

  NSTimer* timer =
      [NSTimer scheduledTimerWithTimeInterval:kTimerIntervalSecs
                                       target:helper_
                                     selector:@selector(timerFired:)
                                     userInfo:nil
                                      repeats:YES];
  timer_ = [timer retain];
}

MacCocoaSocketServer::~MacCocoaSocketServer() {
  [timer_ invalidate];
  [timer_ release];
  [helper_ release];
}

AsyncSocket* MacCocoaSocketServer::CreateAsyncSocket(int type) {
  assert(type == SOCK_STREAM);
  return new MacAsyncSocket();
}

bool MacCocoaSocketServer::Wait(int cms, bool process_io) {
  // Ideally we would have some way to run the UI loop for |cms| milliSeconds,
  // or until WakeUp() is called (whichever is earlier).
  // But there is no good solution for that - stopping/restarting the
  // NSApp run loop or calling nextEventMatchingTask both have significant
  // overhead, resulting in high CPU utilization when there are a lot of
  // libjingle messages (hence WakeUp and Wait calls) floating around.

  // Simply calling "usleep" will block the UI, which is OK when |process_io|
  // is false.

  if (cms != 0) {
    assert(cms > 0 && !process_io);
    if (cms < 0 || process_io) {
      return false;
    }
    usleep(cms * 1000);
  }

  return true;
}

void MacCocoaSocketServer::WakeUp() {
  [helper_ performSelectorOnMainThread:@selector(wakeUp)
                            withObject:nil
                         waitUntilDone:NO];
}

void MacCocoaSocketServer::Pump() {
  // Process messages.

  Message msg;
  // We don't want to process an unbounded number of messages - while we do that
  // the UI remains blocked. So we only process as many messages as are in the
  // queue when we start.
  //
  // max(1,..) ensures we run Get() at least once, this is needed to check
  // for "sent" messages that otherwise are not included into size() result.
  for (size_t max_messages_to_process = _max<size_t>(1, message_queue_->size());
       max_messages_to_process > 0 && message_queue_->Get(&msg, 0);
       --max_messages_to_process) {
    message_queue_->Dispatch(&msg);
  }
}

}  // namespace talk_base
