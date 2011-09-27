// Copyright 2008 Google Inc. All Rights Reserved.

//
// MacAsyncSocket is a kind of AsyncSocket. It only creates sockets
// of the TCP type, and does not (yet) support listen and accept. It works
// asynchronously, which means that users of this socket should connect to
// the various events declared in asyncsocket.h to receive notifications about
// this socket.

#ifndef TALK_BASE_MACASYNCSOCKET_H__
#define TALK_BASE_MACASYNCSOCKET_H__

#include <CoreFoundation/CoreFoundation.h>

#include "talk/base/asyncsocket.h"

namespace talk_base {

class MacBaseSocketServer;

class MacAsyncSocket : public AsyncSocket {
 public:
  MacAsyncSocket(MacBaseSocketServer* ss);
  virtual ~MacAsyncSocket();

  bool valid() const { return source_ != NULL; }

  // Socket interface
  virtual SocketAddress GetLocalAddress() const;
  virtual SocketAddress GetRemoteAddress() const;
  virtual int Bind(const SocketAddress& addr);
  virtual int Connect(const SocketAddress& addr);
  virtual int Send(const void* pv, size_t cb);
  virtual int SendTo(const void* pv, size_t cb, const SocketAddress& addr);
  virtual int Recv(void* pv, size_t cb);
  virtual int RecvFrom(void* pv, size_t cb, SocketAddress* paddr);
  virtual int Listen(int backlog);
  virtual MacAsyncSocket* Accept(SocketAddress* paddr);
  virtual int Close();
  virtual int GetError() const;
  virtual void SetError(int error);
  virtual ConnState GetState() const;
  virtual int EstimateMTU(uint16* mtu);
  virtual int GetOption(Option opt, int* value);
  virtual int SetOption(Option opt, int value);

  // For the MacBaseSocketServer to disable callbacks when process_io is false.
  void EnableCallbacks();
  void DisableCallbacks();

 private:
  // Creates an async socket from an existing bsd socket
  explicit MacAsyncSocket(MacBaseSocketServer* ss, int native_socket);

   // Attaches the socket to the CFRunloop and sets the wrapped bsd socket
  // to async mode
  void Initialize();

  // Translate the SocketAddress into a CFDataRef to pass to CF socket
  // functions. Caller must call CFRelease on the result when done.
  static CFDataRef CopyCFAddress(const SocketAddress& address);

  // Callback for the underlying CFSocketRef.
  static void MacAsyncSocketCallBack(CFSocketRef s,
                                     CFSocketCallBackType callbackType,
                                     CFDataRef address,
                                     const void* data,
                                     void* info);

  MacBaseSocketServer* ss_;
  CFSocketRef socket_;
  int native_socket_;
  CFRunLoopSourceRef source_;
  int current_callbacks_;
  bool disabled_;
  int error_;
  ConnState state_;

  DISALLOW_EVIL_CONSTRUCTORS(MacAsyncSocket);
};

}  // namespace talk_base

#endif  // TALK_BASE_MACASYNCSOCKET_H__
