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

#include <iostream>

#include "talk/base/cpuid.h"
#include "talk/base/gunit.h"
#include "talk/base/stringutils.h"


// Tests CPUID instruction for Vendor identification.
TEST(CpuInfoTest, CpuVendorNonEmpty) {
  EXPECT_FALSE(talk_base::CpuInfo::GetCpuVendor().empty());
}

#ifdef CPU_X86

// Tests Vendor identification is Intel or AMD.
// See Also http://en.wikipedia.org/wiki/CPUID
TEST(CpuInfoTest, CpuVendorIntelAMD) {
  const std::string vendor = talk_base::CpuInfo::GetCpuVendor();
  LOG(LS_INFO) << "CpuVendor: " << vendor;
  EXPECT_TRUE(talk_base::string_match(vendor.c_str(),
                                      "GenuineIntel") ||
              talk_base::string_match(vendor.c_str(),
                                      "AuthenticAMD"));
}

// Tests CPUID maximum function number.
// Modern CPU has 11, but we expect at least 3.
TEST(CpuInfoTest, CpuIdMax) {
  int cpu_info[4] = { 0 };
  talk_base::cpuid(cpu_info, 0);
  LOG(LS_INFO) << "CpuId Max Function: " << cpu_info[0];
  EXPECT_GE(cpu_info[0], 1);
}

// Tests CPUID functions 0 and 1 return different values.
TEST(CpuInfoTest, CpuId) {
  int cpu_info0[4] = { 0 };
  int cpu_info1[4] = { 0 };
  talk_base::cpuid(cpu_info0, 0);
  talk_base::cpuid(cpu_info1, 1);
  LOG(LS_INFO) << "CpuId Function 0: " << std::hex
               << std::setfill('0') << std::setw(8) << cpu_info0[0] << " "
               << std::setfill('0') << std::setw(8) << cpu_info0[1] << " "
               << std::setfill('0') << std::setw(8) << cpu_info0[2] << " "
               << std::setfill('0') << std::setw(8) << cpu_info0[3];
  LOG(LS_INFO) << "CpuId Function 1: " << std::hex
               << std::setfill('0') << std::setw(8) << cpu_info1[0] << " "
               << std::setfill('0') << std::setw(8) << cpu_info1[1] << " "
               << std::setfill('0') << std::setw(8) << cpu_info1[2] << " "
               << std::setfill('0') << std::setw(8) << cpu_info1[3];
  EXPECT_NE(memcmp(cpu_info0, cpu_info1, sizeof(cpu_info0)), 0);

  LOG(LS_INFO) << "SSE2: "
      << talk_base::CpuInfo::TestCpuFlag(talk_base::CpuInfo::kCpuHasSSE2);
  LOG(LS_INFO) << "SSSE3: "
      << talk_base::CpuInfo::TestCpuFlag(talk_base::CpuInfo::kCpuHasSSSE3);
}
#endif

