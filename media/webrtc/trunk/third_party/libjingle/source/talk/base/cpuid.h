/*
 * libjingle
 * Copyright 2011 Google Inc.
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

#ifndef TALK_BASE_CPUID_H_
#define TALK_BASE_CPUID_H_

#include <string>

#include "talk/base/basictypes.h"
#include "talk/base/criticalsection.h"

namespace talk_base {

#ifdef CPU_X86
void cpuid(int cpu_info[4], int info_type);
#endif

class CpuInfo {
 public:
  // These flags are only valid on x86 processors
  static const int kCpuHasSSE2 = 1;
  static const int kCpuHasSSSE3 = 2;

  // SIMD support on ARM processors
  static const int kCpuHasNEON = 4;

  // Detect CPU has SSE2 etc.
  static bool TestCpuFlag(int flag);

  // Detect CPU vendor: "GenuineIntel" or "AuthenticAMD"
  static std::string GetCpuVendor();

  // For testing, allow CPU flags to be disabled.
  static void MaskCpuFlagsForTest(int enable_flags);

 private:
  // Global lock for the cpu initialization
  static CriticalSection crit_;
  static bool cpu_info_initialized_;
  static int cpu_info_;

  static void InitCpuFlags();

  DISALLOW_IMPLICIT_CONSTRUCTORS(CpuInfo);
};

}  // namespace talk_base

#endif  // TALK_BASE_CPUID_H_
