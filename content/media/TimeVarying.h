/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MOZILLA_TIMEVARYING_H_
#define MOZILLA_TIMEVARYING_H_

#include "nsTArray.h"

namespace mozilla {

/**
 * Objects of this class represent values that can change over time ---
 * a mathematical function of time.
 * Time is measured in PRInt64s.
 * There are a finite set of "change times"; at each change time, the function
 * instantly changes to a new value.
 * There is also a "current time" which must always advance (not go backward).
 * The function is constant for all times less than the current time.
 * When the current time is advanced, the value of the function at the new
 * current time replaces the values for all previous times.
 *
 * The implementation records a mCurrent (the value at the current time)
 * and an array of "change times" (greater than the current time) and the
 * new value for each change time. This is a simple but dumb implementation.
 */
template <class T>
class TimeVarying {
public:
  TimeVarying(const T& aInitial) : mCurrent(aInitial) {}
  /**
   * This constructor can only be called if mCurrent has a no-argument
   * constructor.
   */
  TimeVarying() : mCurrent() {}
  /**
   * Sets the value for all times >= aTime to aValue.
   */
  void SetAt(PRInt64 aTime, const T& aValue)
  {
    for (PRInt32 i = mChanges.Length() - 1; i >= 0; --i) {
      NS_ASSERTION(i == mChanges.Length() - 1, "Always considering last element of array");
      if (aTime > mChanges[i].mTime) {
        if (mChanges[i].mValue != aValue) {
          mChanges.AppendElement(Entry(aTime, aValue));
        }
        return;
      }
      if (aTime == mChanges[i].mTime) {
        if ((i > 0 ? mChanges[i - 1].mValue : mCurrent) == aValue) {
          mChanges.RemoveElementAt(i);
          return;
        }
        mChanges[i].mValue = aValue;
        return;
      }
      mChanges.RemoveElementAt(i);
    }
    mChanges.InsertElementAt(0, Entry(aTime, aValue));
  }
  /**
   * Returns the final value of the function. If aTime is non-null,
   * sets aTime to the time at which the function changes to that final value.
   * If there are no changes after the current time, returns PR_INT64_MIN in aTime.
   */
  const T& GetLast(PRInt64* aTime = nsnull) const
  {
    if (mChanges.IsEmpty()) {
      if (aTime) {
        *aTime = PR_INT64_MIN;
      }
      return mCurrent;
    }
    if (aTime) {
      *aTime = mChanges[mChanges.Length() - 1].mTime;
    }
    return mChanges[mChanges.Length() - 1].mValue;
  }
  /**
   * Returns the value of the function at time aTime.
   * If aEnd is non-null, sets *aEnd to the time at which the function will
   * change from the returned value to a new value, or PR_INT64_MAX if that
   * never happens.
   * If aStart is non-null, sets *aStart to the time at which the function
   * changed to the returned value, or PR_INT64_MIN if that happened at or
   * before the current time.
   *
   * Currently uses a linear search, but could use a binary search.
   */
  const T& GetAt(PRInt64 aTime, PRInt64* aEnd = nsnull, PRInt64* aStart = nsnull) const
  {
    if (mChanges.IsEmpty() || aTime < mChanges[0].mTime) {
      if (aStart) {
        *aStart = PR_INT64_MIN;
      }
      if (aEnd) {
        *aEnd = mChanges.IsEmpty() ? PR_INT64_MAX : mChanges[0].mTime;
      }
      return mCurrent;
    }
    PRInt32 changesLength = mChanges.Length();
    if (mChanges[changesLength - 1].mTime <= aTime) {
      if (aEnd) {
        *aEnd = PR_INT64_MAX;
      }
      if (aStart) {
        *aStart = mChanges[changesLength - 1].mTime;
      }
      return mChanges[changesLength - 1].mValue;
    }

    for (PRUint32 i = 1; ; ++i) {
      if (aTime < mChanges[i].mTime) {
        if (aEnd) {
          *aEnd = mChanges[i].mTime;
        }
        if (aStart) {
          *aStart = mChanges[i - 1].mTime;
        }
        NS_ASSERTION(mChanges[i].mValue != mChanges[i - 1].mValue,
                     "Only changed values appear in array");
        return mChanges[i - 1].mValue;
      }
    }
  }
  /**
   * Advance the current time to aTime.
   */
  void AdvanceCurrentTime(PRInt64 aTime)
  {
    for (PRUint32 i = 0; i < mChanges.Length(); ++i) {
      if (aTime < mChanges[i].mTime) {
        mChanges.RemoveElementsAt(0, i);
        return;
      }
      mCurrent = mChanges[i].mValue;
    }
    mChanges.Clear();
  }
  /**
   * Make all currently pending changes happen aDelta later than their
   * current change times.
   */
  void InsertTimeAtStart(PRInt64 aDelta)
  {
    for (PRUint32 i = 0; i < mChanges.Length(); ++i) {
      mChanges[i].mTime += aDelta;
    }
  }

  /**
   * Replace the values of this function at aTimeOffset and later with the
   * values of aOther taken from zero, so if aOther is V at time T >= 0
   * then this function will be V at time T + aTimeOffset. aOther's current
   * time must be >= 0.
   */
  void Append(const TimeVarying& aOther, PRInt64 aTimeOffset)
  {
    NS_ASSERTION(aOther.mChanges.IsEmpty() || aOther.mChanges[0].mTime >= 0,
                 "Negative time not allowed here");
    NS_ASSERTION(&aOther != this, "Can't self-append");
    SetAt(aTimeOffset, aOther.mCurrent);
    for (PRUint32 i = 0; i < aOther.mChanges.Length(); ++i) {
      const Entry& e = aOther.mChanges[i];
      SetAt(aTimeOffset + e.mTime, e.mValue);
    }
  }

private:
  struct Entry {
    Entry(PRInt64 aTime, const T& aValue) : mTime(aTime), mValue(aValue) {}
    PRInt64 Time() { return mTime; }

    // The time at which the value changes to mValue
    PRInt64 mTime;
    T mValue;
  };
  nsTArray<Entry> mChanges;
  T mCurrent;
};

}

#endif /* MOZILLA_TIMEVARYING_H_ */
