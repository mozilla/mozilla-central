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

#include <limits.h>

#include "talk/base/bandwidthsmoother.h"
#include "talk/base/gunit.h"

namespace talk_base {

class BandwidthSmootherTest : public testing::Test {
 public:
};

static const int kTimeBetweenIncrease = 10;
static const double kPercentIncrease = 1.1;
static const size_t kSamplesCountToAverage = 1;

TEST_F(BandwidthSmootherTest, TestSampleIncrease) {
  BandwidthSmoother mon(1000,  // initial_bandwidth_guess
                        kTimeBetweenIncrease,
                        kPercentIncrease,
                        kSamplesCountToAverage);

  int bandwidth_sample = 1000;
  EXPECT_EQ(bandwidth_sample, mon.get_bandwidth_estimation());
  bandwidth_sample =
      static_cast<int>(bandwidth_sample * kPercentIncrease);
  EXPECT_FALSE(mon.Sample(9, bandwidth_sample));
  EXPECT_TRUE(mon.Sample(10, bandwidth_sample));
  EXPECT_EQ(bandwidth_sample, mon.get_bandwidth_estimation());
  int next_expected_est =
      static_cast<int>(bandwidth_sample * kPercentIncrease);
  bandwidth_sample *= 2;
  EXPECT_TRUE(mon.Sample(20, bandwidth_sample));
  EXPECT_EQ(next_expected_est, mon.get_bandwidth_estimation());
}

TEST_F(BandwidthSmootherTest, TestSampleIncreaseFromZero) {
  BandwidthSmoother mon(0,  // initial_bandwidth_guess
                        kTimeBetweenIncrease,
                        kPercentIncrease,
                        kSamplesCountToAverage);

  int bandwidth_sample = 1000;
  EXPECT_FALSE(mon.Sample(9, bandwidth_sample));
  EXPECT_TRUE(mon.Sample(10, bandwidth_sample));
  EXPECT_EQ(bandwidth_sample/2, mon.get_bandwidth_estimation());
}

TEST_F(BandwidthSmootherTest, TestSampleDecrease) {
  BandwidthSmoother mon(1000,  // initial_bandwidth_guess
                        kTimeBetweenIncrease,
                        kPercentIncrease,
                        kSamplesCountToAverage);

  int bandwidth_sample = 999;
  EXPECT_TRUE(mon.Sample(1, bandwidth_sample));
  EXPECT_EQ(bandwidth_sample, mon.get_bandwidth_estimation());
}

TEST_F(BandwidthSmootherTest, TestSampleRollover) {
  const int initial_bandwidth_guess = 2000000000;  // > INT_MAX/1.1
  BandwidthSmoother mon(initial_bandwidth_guess,
                        kTimeBetweenIncrease,
                        kPercentIncrease,
                        kSamplesCountToAverage);

  EXPECT_FALSE(mon.Sample(10, INT_MAX));
  EXPECT_EQ(initial_bandwidth_guess, mon.get_bandwidth_estimation());
}

TEST_F(BandwidthSmootherTest, TestSampleNegative) {
  BandwidthSmoother mon(1000,  // initial_bandwidth_guess
                        kTimeBetweenIncrease,
                        kPercentIncrease,
                        kSamplesCountToAverage);

  EXPECT_FALSE(mon.Sample(10, -1));
}

}  // namespace talk_base
