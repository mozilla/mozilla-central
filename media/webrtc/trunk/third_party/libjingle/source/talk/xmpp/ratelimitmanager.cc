/*
 * libjingle
 * Copyright 2004--2006, Google Inc.
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

#include <list>
#include <string>

#include "talk/xmpp/ratelimitmanager.h"

namespace buzz {

RateLimitManager::RateLimit* RateLimitManager::GetRateLimit(
    const std::string event_name) {
  RateLimitMap::iterator it = rate_limits_.find(event_name);
  if (it != rate_limits_.end()) {
    return it->second;
  }
  return NULL;
}

bool RateLimitManager::IsWithinRateLimit(const std::string event_name) {
  RateLimit* current_rate = GetRateLimit(event_name);
  if (current_rate) {
    return current_rate->IsWithinRateLimit();
  }
  return true; // If no rate limit is set, then you must be under the limit
}

void RateLimitManager::UpdateRateLimit(const std::string event_name, 
                                       int max_count, 
                                       int per_x_seconds) {
  RateLimit* current_rate = GetRateLimit(event_name);
  if (!current_rate) {
    current_rate = new RateLimit(max_count, per_x_seconds);
    rate_limits_[event_name] = current_rate;
  }
  current_rate->UpdateRateLimit();
}                            

bool RateLimitManager::VerifyRateLimit(const std::string event_name, 
                                       int max_count, 
                                       int per_x_seconds) {
  return VerifyRateLimit(event_name, max_count, per_x_seconds, false);
}

bool RateLimitManager::VerifyRateLimit(const std::string event_name, 
                                       int max_count, 
                                       int per_x_seconds, 
                                       bool always_update) {
  bool within_rate_limit = IsWithinRateLimit(event_name);
  if (within_rate_limit || always_update) {
    UpdateRateLimit(event_name, max_count, per_x_seconds);
  }
  return within_rate_limit;
}

}
