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

#include "talk/base/nethelpers.h"

#include "talk/base/byteorder.h"
#include "talk/base/signalthread.h"

namespace talk_base {

#if defined(LINUX) || defined(ANDROID)
static const size_t kInitHostentLen = 1024;
static const size_t kMaxHostentLen = kInitHostentLen * 8;
#endif

// AsyncResolver

AsyncResolver::AsyncResolver() : result_(NULL), error_(0) {
}

AsyncResolver::~AsyncResolver() {
  FreeHostEnt(result_);
}

void AsyncResolver::DoWork() {
  result_ = SafeGetHostByName(addr_.hostname().c_str(), &error_);
}

void AsyncResolver::OnWorkDone() {
  if (result_) {
    addr_.SetIP(NetworkToHost32(
        *reinterpret_cast<uint32*>(result_->h_addr_list[0])));
  }
}

#if defined(WIN32) || defined(ANDROID) || defined(OPENBSD)
static hostent* DeepCopyHostent(const hostent* ent) {
  // Get the total number of bytes we need to copy, and allocate our buffer.
  int num_aliases = 0, num_addrs = 0;
  size_t total_len = sizeof(hostent);
  total_len += strlen(ent->h_name) + 1;
  while (ent->h_aliases[num_aliases]) {
    total_len += sizeof(char*) + strlen(ent->h_aliases[num_aliases]) + 1;
    ++num_aliases;
  }
  total_len += sizeof(char*);
  while (ent->h_addr_list[num_addrs]) {
    total_len += sizeof(char*) + ent->h_length;
    ++num_addrs;
  }
  total_len += sizeof(char*);

  hostent* result = static_cast<hostent*>(malloc(total_len));
  if (NULL == result) {
    return NULL;
  }
  char* p = reinterpret_cast<char*>(result) + sizeof(hostent);

  // Copy the hostent into it, along with its embedded pointers.
  result->h_name = p;
  memcpy(p, ent->h_name, strlen(ent->h_name) + 1);
  p += strlen(ent->h_name) + 1;

  result->h_aliases = reinterpret_cast<char**>(p);
  p += (num_aliases + 1) * sizeof(char*);
  for (int i = 0; i < num_aliases; ++i) {
    result->h_aliases[i] = p;
    memcpy(p, ent->h_aliases[i], strlen(ent->h_aliases[i]) + 1);
    p += strlen(ent->h_aliases[i]) + 1;
  }
  result->h_aliases[num_aliases] = NULL;

  result->h_addrtype = ent->h_addrtype;
  result->h_length = ent->h_length;

  result->h_addr_list = reinterpret_cast<char**>(p);
  p += (num_addrs + 1) * sizeof(char*);
  for (int i = 0; i < num_addrs; ++i) {
    result->h_addr_list[i] = p;
    memcpy(p, ent->h_addr_list[i], ent->h_length);
    p += ent->h_length;
  }
  result->h_addr_list[num_addrs] = NULL;
  
  return result;
}
#endif

// The functions below are used to do gethostbyname, but with an allocated
// instead of a static buffer.
hostent* SafeGetHostByName(const char* hostname, int* herrno) {
  if (NULL == hostname || NULL == herrno) {
    return NULL;
  }
  hostent* result = NULL;
#if defined(WIN32)
  // On Windows we have to allocate a buffer, and manually copy the hostent,
  // along with its embedded pointers.
  hostent* ent = gethostbyname(hostname);
  if (!ent) {
    *herrno = WSAGetLastError();
    return NULL;
  }
  result = DeepCopyHostent(ent);
  *herrno = 0;
#elif defined(LINUX) || defined(ANDROID)
  // gethostbyname() is not thread safe, so we need to call gethostbyname_r()
  // which is a reentrant version of gethostbyname().
  ASSERT(kInitHostentLen > sizeof(hostent));
  size_t size = kInitHostentLen;
  int ret;
  void* buf = malloc(size);
  if (NULL == buf) {
    return NULL;
  }
  char* aux = static_cast<char*>(buf) + sizeof(hostent);
  size_t aux_len = size - sizeof(hostent);
  while ((ret = gethostbyname_r(hostname, reinterpret_cast<hostent*>(buf), aux,
      aux_len, &result, herrno)) == ERANGE) {
    size *= 2;
    if (size > kMaxHostentLen) {
      break;  // Just to be safe.
    }
    buf = realloc(buf, size);
    if (NULL == buf) {
      return NULL;
    }
    aux = static_cast<char*>(buf) + sizeof(hostent);
    aux_len = size - sizeof(hostent);
  }
  if (ret != 0 || buf != result) {
    free(buf);
    return NULL;
  }
#if defined(ANDROID)
  // Note that Android's version of gethostbyname_r has a bug such that the
  // returned hostent contains pointers into thread-local storage.  (See bug
  // 4383723.)  So we deep copy the result before returning.
  hostent* deep_copy = DeepCopyHostent(result);
  FreeHostEnt(result);
  result = deep_copy;
#endif
  *herrno = 0;
#elif defined(OSX) || defined(IOS) || defined(FREEBSD)
  // Mac OS returns an object with everything allocated.
  result = getipnodebyname(hostname, AF_INET, AI_DEFAULT, herrno);
#elif defined(OPENBSD)
  hostent* ent = gethostbyname(hostname);
  if (!ent) {
    return NULL;
  }
  result = DeepCopyHostent(ent);
  *herrno = 0;
#else
#error "I don't know how to do gethostbyname safely on your system."
#endif
  return result;
}

// This function should mirror the above function, and free any resources
// allocated by the above.
void FreeHostEnt(hostent* host) {
#if defined(OSX) || defined(IOS) || defined(FREEBSD)
  freehostent(host);
#elif defined(WIN32) || defined(POSIX)
  free(host);
#else
#error "I don't know how to free a hostent on your system."
#endif
}

const char* inet_ntop(int af, const void *src, char* dst, socklen_t size) {
#ifdef WIN32
  return win32_inet_ntop(af, src, dst, size);
#else
  return ::inet_ntop(af, src, dst, size);
#endif
}

int inet_pton(int af, const char* src, void *dst) {
#ifdef WIN32
  return win32_inet_pton(af, src, dst);
#else
  return ::inet_pton(af, src, dst);
#endif
}

}  // namespace talk_base
