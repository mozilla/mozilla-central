/*
 * libjingle
 * Copyright 2009, Google Inc.
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

#include "talk/base/gunit.h"
#include "talk/base/stringutils.h"
#include "talk/base/systeminfo.h"

#ifdef CPU_X86

// CPUID-based tests only work on X86

// Tests CPUID instruction for Vendor identification.
TEST(SystemInfoTest, CpuVendorNonEmpty) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "CpuVendor: " << info.GetCpuVendor();
  EXPECT_FALSE(info.GetCpuVendor().empty());
}

// Tests Vendor identification is Intel or AMD.
// See Also http://en.wikipedia.org/wiki/CPUID
TEST(SystemInfoTest, CpuVendorIntelAMD) {
  talk_base::SystemInfo info;
  EXPECT_TRUE(talk_base::string_match(info.GetCpuVendor().c_str(),
                                      "GenuineIntel") ||
              talk_base::string_match(info.GetCpuVendor().c_str(),
                                      "AuthenticAMD"));
}

#endif // CPU_X86

// Tests MachineModel is set.
TEST(SystemInfoTest, MachineModelNonEmpty) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "MachineModel: " << info.GetMachineModel();
  EXPECT_FALSE(info.GetMachineModel().empty());
}

// Tests maximum cpu clockrate.
TEST(SystemInfoTest, CpuMaxCpuSpeed) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "MaxCpuSpeed: " << info.GetMaxCpuSpeed();
  EXPECT_GT(info.GetMaxCpuSpeed(), 0);
}

// Tests current cpu clockrate.
TEST(SystemInfoTest, CpuCurCpuSpeed) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "MaxCurSpeed: " << info.GetCurCpuSpeed();
  EXPECT_GT(info.GetCurCpuSpeed(), 0);
}

// Tests physical memory size.
TEST(SystemInfoTest, MemorySize) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "MemorySize: " << info.GetMemorySize();
  EXPECT_GT(info.GetMemorySize(), -1);
}

// Tests number of logical cpus available to the system.
TEST(SystemInfoTest, MaxCpus) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "MaxCpus: " << info.GetMaxCpus();
  EXPECT_GT(info.GetMaxCpus(), 0);
}

// Tests number of physical cpus available to the system.
TEST(SystemInfoTest, MaxPhysicalCpus) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "MaxPhysicalCpus: " << info.GetMaxPhysicalCpus();
  EXPECT_GT(info.GetMaxPhysicalCpus(), 0);
  EXPECT_LE(info.GetMaxPhysicalCpus(), info.GetMaxCpus());
}

// Tests number of logical cpus available to the process.
TEST(SystemInfoTest, CurCpus) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "CurCpus: " << info.GetCurCpus();
  EXPECT_GT(info.GetCurCpus(), 0);
  EXPECT_LE(info.GetCurCpus(), info.GetMaxCpus());
}

#ifdef CPU_X86

// CPU family/model/steeping is only available on X86

// Tests Intel CPU Family identification.
TEST(SystemInfoTest, CpuFamilyNonZero) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "CpuFamily: " << info.GetCpuFamily();
  EXPECT_GT(info.GetCpuFamily(), 0);
}

// Tests Intel CPU Model identification.
TEST(SystemInfoTest, CpuModelNonZero) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "CpuModel: " << info.GetCpuModel();
  EXPECT_GT(info.GetCpuModel(), 0);
}

// Tests Intel CPU Stepping identification.
TEST(SystemInfoTest, CpuSteppingNonZero) {
  talk_base::SystemInfo info;
  LOG(LS_INFO) << "CpuStepping: " << info.GetCpuStepping();
  EXPECT_GT(info.GetCpuStepping(), 0);
}

#endif // CPU_X86

#if WIN32 && !defined(EXCLUDE_D3D9)
TEST(SystemInfoTest, GpuInfo) {
  talk_base::SystemInfo info;
  talk_base::SystemInfo::GpuInfo gi;
  EXPECT_TRUE(info.GetGpuInfo(&gi));
  LOG(LS_INFO) << "GpuDriver: " << gi.driver;
  EXPECT_FALSE(gi.driver.empty());
  LOG(LS_INFO) << "GpuDriverVersion: " << gi.driver_version;
  EXPECT_FALSE(gi.driver_version.empty());
}
#endif
