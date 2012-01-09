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

#ifndef TALK_BASE_CRITICALSECTION_H__
#define TALK_BASE_CRITICALSECTION_H__

#ifdef WIN32
#include "talk/base/win32.h"
#endif

#ifdef POSIX
#include <pthread.h>
#endif

#ifdef _DEBUG
#define CS_TRACK_OWNER 1
#endif  // _DEBUG

#if CS_TRACK_OWNER
#define TRACK_OWNER(x) x
#else  // !CS_TRACK_OWNER
#define TRACK_OWNER(x)
#endif  // !CS_TRACK_OWNER

namespace talk_base {

#ifdef WIN32
class CriticalSection {
public:
  CriticalSection() {
    InitializeCriticalSection(&crit_);
    // Windows docs say 0 is not a valid thread id
    TRACK_OWNER(thread_ = 0);
  }
  ~CriticalSection() {
    DeleteCriticalSection(&crit_);
  }
  void Enter() {
    EnterCriticalSection(&crit_);
    TRACK_OWNER(thread_ = GetCurrentThreadId());
  }
  bool TryEnter() {
    if (TryEnterCriticalSection(&crit_) != FALSE) {
      TRACK_OWNER(thread_ = GetCurrentThreadId());
      return true;
    }
    return false;
  }
  void Leave() {
    TRACK_OWNER(thread_ = 0);
    LeaveCriticalSection(&crit_);
  }

#if CS_TRACK_OWNER
  bool CurrentThreadIsOwner() const { return thread_ == GetCurrentThreadId(); }
#endif  // CS_TRACK_OWNER

private:
  CRITICAL_SECTION crit_;
  TRACK_OWNER(DWORD thread_);  // The section's owning thread id
};
#endif // WIN32

#ifdef POSIX
class CriticalSection {
public:
  CriticalSection() {
    pthread_mutexattr_t mutex_attribute;
    pthread_mutexattr_init(&mutex_attribute);
    pthread_mutexattr_settype(&mutex_attribute, PTHREAD_MUTEX_RECURSIVE);
    pthread_mutex_init(&mutex_, &mutex_attribute);
    pthread_mutexattr_destroy(&mutex_attribute);
    TRACK_OWNER(thread_ = 0);
  }
  ~CriticalSection() {
    pthread_mutex_destroy(&mutex_);
  }
  void Enter() {
    pthread_mutex_lock(&mutex_);
    TRACK_OWNER(thread_ = pthread_self());
  }
  bool TryEnter() {
    if (pthread_mutex_trylock(&mutex_) == 0) {
      TRACK_OWNER(thread_ = pthread_self());
      return true;
    }
    return false;
  }
  void Leave() {
    TRACK_OWNER(thread_ = 0);
    pthread_mutex_unlock(&mutex_);
  }

#if CS_TRACK_OWNER
  bool CurrentThreadIsOwner() const { return pthread_equal(thread_, pthread_self()); }
#endif  // CS_TRACK_OWNER

private:
  pthread_mutex_t mutex_;
  TRACK_OWNER(pthread_t thread_);
};
#endif // POSIX

// CritScope, for serializing exection through a scope

class CritScope {
public:
  CritScope(CriticalSection *pcrit) {
    pcrit_ = pcrit;
    pcrit_->Enter();
  }
  ~CritScope() {
    pcrit_->Leave();
  }
private:
  CriticalSection *pcrit_;
};

// TODO: Replace with platform-specific "atomic" ops.
// Something like: google3/base/atomicops.h TODO: And, move
// it to atomicops.h, which can't be done easily because of complex
// compile rules.
class AtomicOps {
 public:
#ifdef WIN32
  // Assumes sizeof(int) == sizeof(LONG), which it is on Win32 and Win64.
  static int Increment(int* i) {
    return ::InterlockedIncrement(reinterpret_cast<LONG*>(i));
  }
  static int Decrement(int* i) {
    return ::InterlockedDecrement(reinterpret_cast<LONG*>(i));
  }
#else
  static int Increment(int* i) {
    // Could be faster, and less readable:
    // static CriticalSection* crit = StaticCrit();
    // CritScope scope(crit);
    CritScope scope(StaticCrit());
    return ++(*i);
  }

  static int Decrement(int* i) {
    // Could be faster, and less readable:
    // static CriticalSection* crit = StaticCrit();
    // CritScope scope(crit);
    CritScope scope(StaticCrit());
    return --(*i);
  }

 private:
  static CriticalSection* StaticCrit() {
    static CriticalSection* crit = new CriticalSection();
    return crit;
  }
#endif
};

} // namespace talk_base

#endif // TALK_BASE_CRITICALSECTION_H__
