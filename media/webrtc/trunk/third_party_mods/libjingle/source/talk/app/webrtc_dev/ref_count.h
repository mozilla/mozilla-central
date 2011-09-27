/*
 * libjingle
 * Copyright 2011, Google Inc.
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

#ifndef TALK_APP_WEBRTC_REF_COUNT_H_
#define TALK_APP_WEBRTC_REF_COUNT_H_

#include <cstring>

// Reference count interface.
class RefCount {
 public:
  virtual size_t AddRef() = 0;
  virtual size_t Release() = 0;
};

template <class T>
class RefCountImpl : public T {
 public:
  RefCountImpl() : ref_count_(0) {
  }

  template<typename P>
  explicit RefCountImpl(P p) : ref_count_(0), T(p) {
  }

  template<typename P1, typename P2>
  RefCountImpl(P1 p1, P2 p2) : ref_count_(0), T(p1, p2) {
  }

  template<typename P1, typename P2, typename P3>
  RefCountImpl(P1 p1, P2 p2, P3 p3) : ref_count_(0), T(p1, p2, p3) {
  }

  template<typename P1, typename P2, typename P3, typename P4>
  RefCountImpl(P1 p1, P2 p2, P3 p3, P4 p4) : ref_count_(0), T(p1, p2, p3, p4) {
  }

  template<typename P1, typename P2, typename P3, typename P4, typename P5>
  RefCountImpl(P1 p1, P2 p2, P3 p3, P4 p4, P5 p5)
      : ref_count_(0), T(p1, p2, p3, p4, p5) {
  }

  virtual size_t AddRef() {
    ++ref_count_;
    return ref_count_;
  }

  virtual size_t Release() {
    size_t ret = --ref_count_;
    if (!ref_count_) {
      delete this;
    }
    return ret;
  }

 protected:
  size_t ref_count_;
};

#endif  // TALK_APP_WEBRTC_REF_COUNT_H_
