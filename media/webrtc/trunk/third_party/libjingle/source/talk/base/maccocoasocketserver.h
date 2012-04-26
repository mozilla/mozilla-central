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

// A libjingle compatible SocketServer for OSX/iOS/Cocoa.

#if !defined(USE_COCOA_THREADING) || (!defined(OSX) && !defined(IOS))
#error You can only include this file on OSX or IOS, and must also define
#error USE_COCOA_THREADING.
#endif

#import <Foundation/Foundation.h>

#import "talk/base/messagequeue.h"
#import "talk/base/socketserver.h"

namespace talk_base {
class MacCocoaSocketServer;
}

// MacCocoaSocketServerHelper serves as a delegate to NSMachPort or a target for
// a timeout.
@interface MacCocoaSocketServerHelper : NSObject {
  // This is a weak reference. This works fine since the
  // talk_base::MacCocoaSocketServer owns this object.
  talk_base::MacCocoaSocketServer* socketServer; // weak.
}

@end

namespace talk_base {

// The name "SocketServer" is misleading for this class. This class inherits
// from SocketServer, some variants of which create/use physical
// sockets (specifically, PhysicalSocketServer). A general explanation
// (courtesy of bpm) is that SocketServer is responsible for allowing a thread
// to go into an efficient wait state while it waits for a timer to expire or an
// incoming message from MessageQueue.  For GUI applications, the main thread
// must continue to pump the main event loop during this wait state, hence the
// need for specialized SocketServers to run on the main thread.
//
// This particular socketServer however cannot handle a generalized wait state.
// It can only handle Wait when called with cms == 0, or when cms > 0 and
// process_io is false. In the former case, the process_io argument is ignored,
// and in the latter case, the thread will sleep for cms milliSeconds.
//
// Use this class in a Cocoa application that uses libjingle's Task and
// MessageQueue, on the main thread. The typical usage is something like this:
//
//  talk_base::Thread* current = talk_base::Thread::Current();
//  MacCocoaSocketServer* ss =
//      new talk_base::MacCocoaSocketServer(current);
//  current->set_socketserver(ss);
//
//  // Now schedule some libjingle tasks, then call
//
//  [NSApp run];

class MacCocoaSocketServer : public SocketServer {
 public:
  explicit MacCocoaSocketServer(MessageQueue* message_queue);
  virtual ~MacCocoaSocketServer();

  // SocketServer Interface. We don't create any synchronous sockets.
  virtual Socket* CreateSocket(int type) { return NULL; }
  virtual Socket* CreateSocket(int family, int type) { return NULL; }

  virtual AsyncSocket* CreateAsyncSocket(int type);
  virtual AsyncSocket* CreateAsyncSocket(int family, int type);

  virtual bool Wait(int cms, bool process_io);
  virtual void WakeUp();

  void Pump();

 private:
  // message_queue_ is not owned by this object.
  // It is cached from the constructor argument.
  MessageQueue* message_queue_; // weak.
  MacCocoaSocketServerHelper* helper_;
  NSTimer* timer_;

  DISALLOW_EVIL_CONSTRUCTORS(MacCocoaSocketServer);
};

}  // namespace talk_base
