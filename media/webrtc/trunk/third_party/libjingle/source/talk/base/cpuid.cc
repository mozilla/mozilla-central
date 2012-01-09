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

#include "talk/base/cpuid.h"

#ifdef _MSC_VER
#include <intrin.h>
#elif defined(__ANDROID__)
#include <cpu-features.h>
#elif defined(LINUX)
#include "talk/base/linux.h"
#endif

// TODO: Use cpuid.h when gcc 4.4 is used on OSX and Linux.
#if (defined(__pic__) || defined(__APPLE__)) && defined(__i386__)
static inline void __cpuid(int cpu_info[4], int info_type) {
  __asm__ volatile (
    "mov %%ebx, %%edi\n"
    "cpuid\n"
    "xchg %%edi, %%ebx\n"
    : "=a"(cpu_info[0]), "=D"(cpu_info[1]), "=c"(cpu_info[2]), "=d"(cpu_info[3])
    : "a"(info_type)
  );
}
#elif defined(__i386__) || defined(__x86_64__)
static inline void __cpuid(int cpu_info[4], int info_type) {
  __asm__ volatile (
    "cpuid\n"
    : "=a"(cpu_info[0]), "=b"(cpu_info[1]), "=c"(cpu_info[2]), "=d"(cpu_info[3])
    : "a"(info_type)
  );
}
#endif

namespace talk_base {

// CPU detect function for SIMD instruction sets.
bool CpuInfo::cpu_info_initialized_ = false;
int CpuInfo::cpu_info_ = 0;
// Global lock for cpu initialization.
CriticalSection CpuInfo::crit_;

#ifdef CPU_X86
void cpuid(int cpu_info[4], int info_type) {
  __cpuid(cpu_info, info_type);
}
#endif

void CpuInfo::InitCpuFlags() {
#ifdef CPU_X86
  int cpu_info[4];
  __cpuid(cpu_info, 1);
  cpu_info_ = (cpu_info[2] & 0x00000200 ? kCpuHasSSSE3 : 0) |
    (cpu_info[3] & 0x04000000 ? kCpuHasSSE2 : 0);
#elif defined(__ANDROID__) && defined(__arm__)
  uint64_t features = android_getCpuFeatures();
  cpu_info_ = ((features & ANDROID_CPU_ARM_FEATURE_NEON) ? kCpuHasNEON : 0);
#elif defined(LINUX) && defined(__arm__)
  cpu_info_ = 0;
  // Look for NEON support in /proc/cpuinfo
  ProcCpuInfo proc_info;
  size_t section_count;
  if (proc_info.LoadFromSystem() &&
      proc_info.GetSectionCount(&section_count)) {
    for (size_t i = 0; i < section_count; ++i) {
      std::string out_features;
      if (proc_info.GetSectionStringValue(i, "Features", &out_features)) {
        if (out_features.find("neon") != std::string::npos) {
          cpu_info_ |= kCpuHasNEON;
        }
        break;
      }
    }
  }
#elif defined(__ARM_NEON__)
  // gcc -mfpu=neon defines __ARM_NEON__
  // if code is specifically built for Neon-only, enable the flag.
  cpu_info_ |= kCpuHasNEON;
#else
  cpu_info_ = 0;
#endif
  cpu_info_initialized_ = true;
}

void CpuInfo::MaskCpuFlagsForTest(int enable_flags) {
  CritScope cs(&crit_);
  InitCpuFlags();
  cpu_info_ &= enable_flags;
}

bool CpuInfo::TestCpuFlag(int flag) {
  if (!cpu_info_initialized_) {
    CritScope cs(&crit_);
    InitCpuFlags();
  }
  return cpu_info_ & flag ? true : false;
}

// Returns the vendor string from the cpu, e.g. "GenuineIntel", "AuthenticAMD".
// See "Intel Processor Identification and the CPUID Instruction"
// (Intel document number: 241618)
std::string CpuInfo::GetCpuVendor() {
#ifdef CPU_X86
  int cpu_info[4];
  cpuid(cpu_info, 0);
  cpu_info[0] = cpu_info[1];  // Reorder output
  cpu_info[1] = cpu_info[3];
  cpu_info[2] = cpu_info[2];
  cpu_info[3] = 0;
  return std::string(reinterpret_cast<char *>(&cpu_info[0]));
#else
  return std::string("Undefined");
#endif
}

}  // namespace talk_base
