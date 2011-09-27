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

#ifndef _RATELIMITMANAGER_H_
#define _RATELIMITMANAGER_H_

#include "talk/base/time.h"
#include "talk/base/taskrunner.h"
#include <map>

namespace buzz {

/////////////////////////////////////////////////////////////////////
//
// RATELIMITMANAGER
//
/////////////////////////////////////////////////////////////////////
//
// RateLimitManager imposes client-side rate limiting for xmpp tasks and
// other events.  It ensures that no more than i events with a given name 
// can occur within k seconds. 
//
// A buffer tracks the previous max_count events.  Before an event is allowed
// to occur, it can check its rate limit with a call to VerifyRateLimit.  
// VerifyRateLimit will look up the i-th to last event and if more than
// k seconds have passed since then, it will return true and update the 
// appropriate rate limits.  Else, it will return false. 
//
/////////////////////////////////////////////////////////////////////

class RateLimitManager {
 public:

  RateLimitManager() { };
  ~RateLimitManager() { 
    for (RateLimitMap::iterator it = rate_limits_.begin();
         it != rate_limits_.end(); ++it) {
      delete it->second;
    }
  };

  // Checks if the event is under the defined rate limit and updates the
  // rate limit if so.  Returns true if it's under the rate limit.
  bool VerifyRateLimit(const std::string event_name, int max_count, 
                       int per_x_seconds);

  // Checks if the event is under the defined rate limit and updates the
  // rate limit if so *or* if always_update = true.  
  bool VerifyRateLimit(const std::string event_name, int max_count, 
                       int per_x_seconds, bool always_update);

 private:
  class RateLimit {
   public:
    RateLimit(int max, int per_x_secs) : counter_(0), max_count_(max),
                                         per_x_seconds_(per_x_secs) {
      event_times_ = new uint32[max_count_];                                                 
      for (int i = 0; i < max_count_; i++) {
        event_times_[i] = 0;
      }
    }

    ~RateLimit() {
      if (event_times_) {
        delete[] event_times_;
      }
    }

    // True iff the current time >= to the next song allowed time
    bool IsWithinRateLimit() {
      return (talk_base::TimeSince(NextTimeAllowedForCounter()) >= 0);
    }
    
    // Updates time and counter for rate limit
    void UpdateRateLimit() {
      event_times_[counter_] = talk_base::Time();
      counter_ = (counter_ + 1) % max_count_;
    }

   private:

    // The time at which the i-th (where i = max_count) event occured
    uint32 PreviousTimeAtCounter() {
      return event_times_[counter_];
    }

    // The time that the next event is allowed to occur
    uint32 NextTimeAllowedForCounter() {
      return PreviousTimeAtCounter() + per_x_seconds_ * talk_base::kSecToMsec;
    }

    int counter_; // count modulo max_count of the current event
    int max_count_; // max number of events that can occur within per_x_seconds
    int per_x_seconds_; // interval size for rate limit
    uint32* event_times_; // buffer of previous max_count event
  };

  typedef std::map<const std::string, RateLimit*> RateLimitMap;

  // Maps from event name to its rate limit
  RateLimitMap rate_limits_;

  // Returns rate limit for event with specified name
  RateLimit* GetRateLimit(const std::string event_name);

  // True iff the current time >= to the next song allowed time
  bool IsWithinRateLimit(const std::string event_name);

  // Updates time and counter for rate limit
  void UpdateRateLimit(const std::string event_name, int max_count, 
                       int per_x_seconds); 

};

}

#endif //_RATELIMITMANAGER_H_
