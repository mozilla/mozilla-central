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

#ifndef TALK_BASE_TIME_H__
#define TALK_BASE_TIME_H__

#ifndef WIN32
#include_next <time.h>
#endif

#include "talk/base/basictypes.h"

namespace talk_base {

typedef uint32 TimeStamp;

// Returns the current time in milliseconds.
uint32 Time();

// Approximate time when the program started.
uint32 StartTime();

// Returns a future timestamp, 'elapsed' milliseconds from now.
uint32 TimeAfter(int32 elapsed);

// Comparisons between time values, which can wrap around.
bool TimeIsBetween(uint32 earlier, uint32 middle, uint32 later);  // Inclusive
bool TimeIsLaterOrEqual(uint32 earlier, uint32 later);  // Inclusive
bool TimeIsLater(uint32 earlier, uint32 later);  // Exclusive

// Returns the later of two timestamps.
inline uint32 TimeMax(uint32 ts1, uint32 ts2) {
  return TimeIsLaterOrEqual(ts1, ts2) ? ts2 : ts1;
}

// Returns the earlier of two timestamps.
inline uint32 TimeMin(uint32 ts1, uint32 ts2) {
  return TimeIsLaterOrEqual(ts1, ts2) ? ts1 : ts2;
}

// Number of milliseconds that would elapse between 'earlier' and 'later'
// timestamps.  The value is negative if 'later' occurs before 'earlier'.
int32 TimeDiff(uint32 later, uint32 earlier);

// The number of milliseconds that have elapsed since 'earlier'.
inline int32 TimeSince(uint32 earlier) {
  return TimeDiff(Time(), earlier);
} 

// The number of milliseconds that will elapse between now and 'later'.
inline int32 TimeUntil(uint32 later) {
  return TimeDiff(later, Time());
}

} // namespace talk_base

#endif // TALK_BASE_TIME_H__
