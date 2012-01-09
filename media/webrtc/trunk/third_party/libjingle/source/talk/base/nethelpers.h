/*
 * libjingle
 * Copyright 2008, Google Inc.
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

#ifndef TALK_BASE_NETHELPERS_H_
#define TALK_BASE_NETHELPERS_H_

#ifdef POSIX
#include <netdb.h>
#include <cstddef>
#elif WIN32
#include <winsock2.h>  // NOLINT
#endif

#include <list>

#include "talk/base/signalthread.h"
#include "talk/base/sigslot.h"
#include "talk/base/socketaddress.h"

namespace talk_base {

// AsyncResolver will perform async DNS resolution, signaling the result on
// the inherited SignalWorkDone when the operation completes.
class AsyncResolver : public SignalThread {
 public:
  AsyncResolver();

  const SocketAddress& address() const { return addr_; }
  void set_address(const SocketAddress& addr) { addr_ = addr; }
  int error() const { return error_; }
  void set_error(int error) { error_ = error; }

 protected:
  ~AsyncResolver();
  virtual void DoWork();
  virtual void OnWorkDone();

 private:
  SocketAddress addr_;
  hostent* result_;
  int error_;
};

// SafeGetHostByName functions allocate and return their result, instead of
// using a static variable like the normal gethostbyname.
// FreeHostEnt frees the memory allocated by SafeGetHostByName.
hostent* SafeGetHostByName(const char* hostname, int* herrno);
void FreeHostEnt(hostent* host);

// talk_base namespaced wrappers for inet_ntop and inet_pton so we can avoid
// the windows-native versions of these.
const char* inet_ntop(int af, const void *src, char* dst, socklen_t size);
int inet_pton(int af, const char* src, void *dst);

}  // namespace talk_base

#endif  // TALK_BASE_NETHELPERS_H_
