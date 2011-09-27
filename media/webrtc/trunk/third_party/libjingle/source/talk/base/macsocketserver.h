// Copyright 2007, Google Inc.


#ifndef TALK_BASE_MACSOCKETSERVER_H__
#define TALK_BASE_MACSOCKETSERVER_H__

#include <set>
#ifdef OSX // Invalid on IOS
#include <Carbon/Carbon.h>
#endif
#include "talk/base/physicalsocketserver.h"

namespace talk_base {

///////////////////////////////////////////////////////////////////////////////
// MacBaseSocketServer
///////////////////////////////////////////////////////////////////////////////
class MacAsyncSocket;

class MacBaseSocketServer : public PhysicalSocketServer {
 public:
  MacBaseSocketServer();
  virtual ~MacBaseSocketServer();

  // SocketServer Interface
  virtual Socket* CreateSocket(int type) { return NULL; }
  virtual AsyncSocket* CreateAsyncSocket(int type);
  virtual bool Wait(int cms, bool process_io) = 0;
  virtual void WakeUp() = 0;

  void RegisterSocket(MacAsyncSocket* socket);
  void UnregisterSocket(MacAsyncSocket* socket);

 protected:
  void EnableSocketCallbacks(bool enable);
  const std::set<MacAsyncSocket*>& sockets() {
    return sockets_;
  }

 private:
  std::set<MacAsyncSocket*> sockets_;
};

// Core Foundation implementation of the socket server. While idle it
// will run the current CF run loop. When the socket server has work
// to do the run loop will be paused. Does not support Carbon or Cocoa
// UI interaction.
class MacCFSocketServer : public MacBaseSocketServer {
 public:
  MacCFSocketServer();
  virtual ~MacCFSocketServer();

  // SocketServer Interface
  virtual bool Wait(int cms, bool process_io);
  virtual void WakeUp();
  void OnWakeUpCallback();

 private:
  CFRunLoopRef run_loop_;
  CFRunLoopSourceRef wake_up_;
};

#ifdef OSX

///////////////////////////////////////////////////////////////////////////////
// MacCarbonSocketServer
///////////////////////////////////////////////////////////////////////////////

// Interacts with the Carbon event queue. While idle it will block,
// waiting for events. When the socket server has work to do, it will
// post a 'wake up' event to the queue, causing the thread to exit the
// event loop until the next call to Wait. Other events are dispatched
// to their target. Supports Carbon and Cocoa UI interaction.
class MacCarbonSocketServer : public MacBaseSocketServer {
 public:
  MacCarbonSocketServer();
  virtual ~MacCarbonSocketServer();

  // SocketServer Interface
  virtual bool Wait(int cms, bool process_io);
  virtual void WakeUp();

 private:
  EventQueueRef event_queue_;
  EventRef wake_up_;
};

///////////////////////////////////////////////////////////////////////////////
// MacCarbonAppSocketServer
///////////////////////////////////////////////////////////////////////////////

// Runs the Carbon application event loop on the current thread while
// idle. When the socket server has work to do, it will post an event
// to the queue, causing the thread to exit the event loop until the
// next call to Wait. Other events are automatically dispatched to
// their target.
class MacCarbonAppSocketServer : public MacBaseSocketServer {
 public:
  MacCarbonAppSocketServer();
  virtual ~MacCarbonAppSocketServer();

  // SocketServer Interface
  virtual bool Wait(int cms, bool process_io);
  virtual void WakeUp();

 private:
  static OSStatus WakeUpEventHandler(EventHandlerCallRef next, EventRef event,
                                     void *data);
  static void TimerHandler(EventLoopTimerRef timer, void *data);

  EventQueueRef event_queue_;
  EventHandlerRef event_handler_;
  EventLoopTimerRef timer_;
};

#endif

///////////////////////////////////////////////////////////////////////////////
// MacNotificationsSocketServer
///////////////////////////////////////////////////////////////////////////////

// The name "SocketServer" is misleading for this class. This class inherits
// from SocketServer, some variants of which create/use physical sockets
// (specifically, PhysicalSocketServer). But generally, this class is a way for
// a thread to schedule tasks (see task.h, thread.h and taskrunner.h).
//
// Since we don't want to write a custom Cocoa event loop, we will use this
// in a non-standard way. The "Wait" method will never actually wait - it will
// return false if cms > 0. Whenever a task needs to be woken up, the WakeUp
// method here will get called, and will cause the thread to cycle through all
// messages currently available.

class MacNotificationsSocketServer : public SocketServer {
 public:
  MacNotificationsSocketServer();
  virtual ~MacNotificationsSocketServer();

  // SocketServer Interface
  virtual Socket* CreateSocket(int type) { return NULL; }
  virtual AsyncSocket* CreateAsyncSocket(int type) { return NULL; }
  // process_io argument is ignored.
  virtual bool Wait(int cms, bool process_io);
  virtual void WakeUp();

 private:
  static void NotificationCallBack(CFNotificationCenterRef center,
                                   void* observer,
                                   CFStringRef name,
                                   const void* object,
                                   CFDictionaryRef userInfo);

  bool sent_notification_;
};

///////////////////////////////////////////////////////////////////////////////

} // namespace talk_base

#endif  // TALK_BASE_MACSOCKETSERVER_H__
