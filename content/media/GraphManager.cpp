/*-*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "GraphManager.h"

#include "mozilla/TimeStamp.h"
#include "VideoUtils.h"
#include "nsWidgetsCID.h"
#include "nsIAppShell.h"
#include "nsServiceManagerUtils.h"
#include "nsXPCOMCIDInternal.h"
#include "prlog.h"
#include "nsContentUtils.h"
#include "nsIObserver.h"

using namespace mozilla::layers;

#ifdef PR_LOGGING
PRLogModuleInfo* gMediaStreamGraphLog;
#define LOG(type, msg) PR_LOG(gMediaStreamGraphLog, type, msg)
#else
#define LOG(type, msg)
#endif

namespace mozilla {
namespace media {

/**
 * Try to queue this much audio.
 */
static const int AUDIO_WRITTEN_TARGET_MS = 30;

/**
 * Assume we can run an iteration of the GraphManager loop in this much time
 */
static const int GRAPH_MANAGER_CONTROL_DELAY_MS = 10;

/**
 * This is how much data we should try to have precomputed at any given time.
 * If we've buffered K milliseconds, then we might write AUDIO_WRITTEN_TARGET_MS out,
 * sleep for that long, wake up, do control processing (taking GRAPH_MANAGER_CONTROL_DELAY_MS),
 * queue AUDIO_WRITTEN_TARGET_MS more data without blocking, and
 * trigger computation of the next needed data.
 */
static const int BUFFER_TARGET_MS = AUDIO_WRITTEN_TARGET_MS*2 + GRAPH_MANAGER_CONTROL_DELAY_MS;

/**
 * Allow video frames to be late by this much. Helps avoid unnecessary wakeups
 * by giving us some scheduling slack.
 */
static const int ALLOW_VIDEO_FRAME_DELAY_MS = 5;

/**
 * Allow this much delay before running the control loop after an InputStream
 * or ProcessingStream has produced output.
 */
static const int ALLOW_DELAY_AFTER_OUTPUT_MS = 2;

class StreamUpdate {
public:
  PRInt64 mGraphUpdateIndex;
  nsRefPtr<Stream> mStream;
  PRInt64 mNextMainThreadCurrentTime;
  bool mNextMainThreadFinished;
};

class GraphManagerImpl : public GraphManager {
public:
  GraphManagerImpl();
  ~GraphManagerImpl()
  {
    NS_ASSERTION(mStreams.IsEmpty(),
                 "All streams should have been destroyed by messages from the main thread");
  }

  void ApplyStreamUpdate(StreamUpdate* aUpdate);

  // Main thread only.
  // This gets run during a "stable state" whenever we need
  // to sync graph manager queues while the main thread is not in the middle
  // of a script. This can also get called by the graph manager to do things
  // on the main thread.
  void RunInStableState();
  // Make this GraphManager enter forced-shutdown state.
  void ForceShutDown();
  // Stop this GraphManager's threads.
  void StopThreads();
  bool IsEmpty() { return mStreams.IsEmpty(); }

  // Graph manager thread
  void RunThread();
  void EnsureStableStateEventPosted();
  // Call this with mMonitor held
  void PrepareUpdatesToMainThreadState();
  bool IsAlwaysExplicitlyBlocked(Stream* aStream);
  void FinishStream(Stream* aStream);
  void ExtractPendingInput(InputStream* aStream);
  void UpdateBufferSufficiencyState(InputStream* aStream);
  void ChooseActionTime();
  void PruneStreamData();
  PRInt64 CalculateTimeBlocked(Stream* aStream, PRInt64 aStart, PRInt64 aEnd);
  PRInt64 GetTimeIncludingBlocking(Stream* aStream, PRInt64 aTime, PRInt64 aToTime);
  bool UpdateCurrentTime();
  void MarkStreamBlocked(Stream* aStream, PRInt64 aTime, PRInt64* aEnd);
  /**
   * Returns true if aStream will underrun at aTime for its own audio/video
   * playback.
   */
  bool WillUnderrun(Stream* aStream, PRInt64 aTime, PRInt64 aEndBlockingDecisions, PRInt64* aEnd);
  void RecomputeBlocking();
  void RecomputeBlockingAt(PRInt64 aTime, PRInt64 aEndBlockingDecisions, PRInt64* aEnd);
  void CreateOrDestroyAudioStream(Stream* aStream);
  void PlayAudio(Stream* aStream);
  void PlayVideo(Stream* aStream);
  // Tries to ensure we wake up around time aTime. This is somewhat approximate
  // so it should not be used for anything that affects realtime playback
  // or synchronization.
  void EnsureWakeUpAt(PRInt64 aTime)
  {
    if (aTime - mCurrentTime < 2*1000) {
      LOG(PR_LOG_DEBUG, ("GraphManager %p asked to wake up very quickly!", this));
    }
    mNextWakeUpTime = NS_MIN(mNextWakeUpTime, NS_MAX(aTime, mCurrentTime));
  }
  PRInt64 GetDesiredBufferEnd(Stream* aStream);

  // For use by control messages
  PRInt64 GetProcessingGraphUpdateIndex() { return mProcessingGraphUpdateIndex; }
  /**
   * Marks aStream as affected by a change in its output at desired time aTime
   * (in the output stream). The change may not actually happen at this time,
   * it may be delayed until later if we can't rewind our buffered data.
   * aTime can be 0 to mean the earliest possible time.
   */
  void NoteStreamAffected(Stream* aStream, double aTime);
  void AddStream(Stream* aStream)
  {
    aStream->mBufferStartTime = mCurrentTime;
    aStream->mMessageAffectedTime = GetEarliestActionTime();
    *mStreams.AppendElement() = already_AddRefed<Stream>(aStream);
    LOG(PR_LOG_DEBUG, ("Adding media stream %p to the graph", aStream));
  }
  void RemoveStream(Stream* aStream)
  {
    // Remove references in mStreamUpdates before we allow aStream to die.
    // Pending updates are not needed (since the main thread has already given
    // up the stream) so we will just drop them.
    {
      MonitorAutoLock lock(mMonitor);
      for (PRUint32 i = 0; i < mStreamUpdates.Length(); ++i) {
        if (mStreamUpdates[i].mStream == aStream) {
          mStreamUpdates[i].mStream = nsnull;
        }
      }
    }

    // This unrefs the stream, probably destroying it
    mStreams.RemoveElement(aStream);

    LOG(PR_LOG_DEBUG, ("Removing media stream %p from the graph", aStream));
  }

  // Usable by any thread. Forces us to do an iteration of the processing algorithm.
  void WakeUp(PRInt64 aMaxDelay = 0)
  {
    MonitorAutoLock lock(mMonitor);
    if (mWakeUp) {
      return;
    }
    if (mIsWaiting && !mNextWakeUpTimeStamp.IsNull() &&
        mNextWakeUpTimeStamp - TimeStamp::Now() <= TimeDuration::FromMicroseconds(aMaxDelay)) {
      return;
    }
    mWakeUp = true;
    if (mIsWaiting) {
      lock.Notify();
      LOG(PR_LOG_DEBUG, ("GraphManager %p woken up with max delay %f, waking up now", this,
                         aMaxDelay/1000000.0));
    } else {
      LOG(PR_LOG_DEBUG, ("GraphManager %p woken up with max delay %f, control loop already running, will resume", this,
                         aMaxDelay/1000000.0));
    }
  }

  PRInt64 GetEarliestActionTime() { return NS_MAX(mLastActionTime, mCurrentTime); }
  PRInt64 GetActionTime(Stream* aStream, double aTime)
  {
    NS_ASSERTION(mLastActionTime >= mCurrentTime, "mLastActionTime not updated yet?");
    if (aTime < 0) {
      aStream->mGraphUpdateIndices.SetAt(mLastActionTime, mProcessingGraphUpdateIndex);
      return mLastActionTime;
    }
    return NS_MAX(mLastActionTime, aStream->StreamTimeToMediaTime(aTime));
  }

  // Data members

  // Readonly after initialization.
  nsCOMPtr<nsIThread> mThread;

  // This state is managed on the graph manager thread only, unless
  // mForcedShutDownComplete is true in which case the graph manager thread
  // is not running and this can all be used from the main thread.
  nsTArray<nsRefPtr<Stream> > mStreams;
  // The time the last action was deemed to have occurred. This could be
  // later than mCurrentTime if actions have to be delayed during data
  // buffering, or before mCurrentTime if mCurrentTime has advanced since
  // the last action happened. In ControlMessage::Process implementations,
  // mLastActionTime has always been updated to be >= mCurrentTime.
  PRInt64 mLastActionTime; // microseconds
  PRInt64 mCurrentTime; // microseconds
  PRInt64 mNextWakeUpTime; // microseconds
  PRInt64 mBlockingDecisionsMadeUntilTime; // microseconds
  TimeStamp mInitialTimeStamp;
  TimeStamp mCurrentTimeStamp;
  PRInt64 mProcessingGraphUpdateIndex;

  // mMonitor does not guard all our data above. It only guards this data below.
  // GraphManager normally does its work without holding mMonitor, so it is
  // not safe to just grab mMonitor from some thread and start monkeying with
  // the graph. Instead, communicate with the graph manager using provided
  // mechanisms such as the ControlMessage queue.
  Monitor mMonitor;
  // Data guarded by mMonitor
  // State to copy to main thread
  PRInt64 mNextMainThreadCurrentTime;
  TimeStamp mNextWakeUpTimeStamp;
  nsTArray<StreamUpdate> mStreamUpdates;
  nsTArray<nsCOMPtr<nsIRunnable> > mUpdateRunnables;
  struct MessageBlock {
    PRInt64 mGraphUpdateIndex;
    nsTArray<nsAutoPtr<ControlMessage> > mMessages;
  };
  nsTArray<MessageBlock> mMessageQueue;
  // True when we are doing an orderly shutdown; the RunThread loop is exiting
  // and all streams have been destroyed.
  bool mShutDown;
  // True when we need to do a forced shutdown during application shutdown
  bool mForceShutDown;
  bool mWakeUp;
  bool mIsWaiting;
  bool mPostedRunInStableStateEvent;

  // Main thread only
  // When true, we should synchronously grab mMonitor and copy the mNextMainThread*
  // state for main-thread use.
  bool mNeedMainThreadStateUpdate;
};

void
GraphManagerImpl::ExtractPendingInput(InputStream* aStream)
{
  bool finished;
  {
    MutexAutoLock lock(aStream->mMutex);
    finished = aStream->mPendingFinished;
    if (aStream->mBuffer.GetAudioSampleEnd() == 0) {
      aStream->mBuffer.SetAudioSampleRate(aStream->mPending.GetAudioSampleRate());
      aStream->mBuffer.SetAudioChannels(aStream->mPending.GetAudioChannels());
    }
    PRInt64 oldBufEnd = aStream->GetBufferEndTime();
    PRInt64 oldAudioEnd = aStream->mBuffer.GetAudioEnd();
    PRInt64 oldVideoEnd = aStream->mBuffer.GetVideoEnd();
    aStream->mBuffer.AppendAndConsumeBuffer(&aStream->mPending);
    PRInt64 newBufEnd = aStream->GetBufferEndTime();
    PRInt64 newAudioEnd = aStream->mBuffer.GetAudioEnd();
    PRInt64 newVideoEnd = aStream->mBuffer.GetVideoEnd();
    if (oldBufEnd < newBufEnd) {
      LOG(PR_LOG_DEBUG, ("Input media stream %p buffer end advanced from %f to %f",
                         aStream, oldBufEnd/1000000.0, newBufEnd/1000000.0));
    }
    if (oldAudioEnd != newAudioEnd || oldVideoEnd != newVideoEnd) {
      LOG(PR_LOG_DEBUG, ("Input media stream %p audio end at %lld, video end at %lld",
                         aStream, newAudioEnd, newVideoEnd));
    }
  }
  if (finished) {
    FinishStream(aStream);
  }
}

void
GraphManagerImpl::UpdateBufferSufficiencyState(InputStream* aStream)
{
  PRInt64 desiredEnd = GetDesiredBufferEnd(aStream);
  bool haveEnoughAudio = desiredEnd <= aStream->mBufferStartTime + aStream->mBuffer.GetAudioEnd();
  bool haveEnoughVideo = desiredEnd <= aStream->mBufferStartTime + aStream->mBuffer.GetVideoEnd();
  nsTArray<InputStream::ThreadAndRunnable> runnables;

  {
    MutexAutoLock lock(aStream->mMutex);
    if (haveEnoughAudio != aStream->mHaveEnoughAudio) {
      aStream->mHaveEnoughAudio = haveEnoughAudio;
      if (!haveEnoughAudio) {
        runnables.MoveElementsFrom(aStream->mDispatchWhenNotEnoughAudio);
      }
    }
    if (haveEnoughVideo != aStream->mHaveEnoughVideo) {
      aStream->mHaveEnoughVideo = haveEnoughVideo;
      if (!haveEnoughVideo) {
        runnables.MoveElementsFrom(aStream->mDispatchWhenNotEnoughVideo);
      }
    }
  }

  for (PRUint32 i = 0; i < runnables.Length(); ++i) {
    runnables[i].mThread->Dispatch(runnables[i].mRunnable, 0);
  }
}

PRInt64
GraphManagerImpl::GetDesiredBufferEnd(Stream* aStream)
{
  PRInt64 desiredEnd = mCurrentTime;
  if (!aStream->mAudioOutputs.IsEmpty()) {
    desiredEnd = NS_MAX(desiredEnd, mCurrentTime + BUFFER_TARGET_MS*1000);
  }
  if (!aStream->mVideoOutputs.IsEmpty()) {
    desiredEnd = NS_MAX(desiredEnd, mCurrentTime + GRAPH_MANAGER_CONTROL_DELAY_MS*1000);
  }
  return desiredEnd;
}

bool
GraphManagerImpl::IsAlwaysExplicitlyBlocked(Stream* aStream)
{
  PRInt64 t = mCurrentTime;
  while (true) {
    PRInt64 end;
    if (aStream->mExplicitBlockerCount.GetAt(t, &end) == 0)
      return false;
    if (end == PR_INT64_MAX)
      return true;
    t = end;
  }
}

void
GraphManagerImpl::FinishStream(Stream* aStream)
{
  if (aStream->mFinished)
    return;
  LOG(PR_LOG_DEBUG, ("Stream %p will finish", aStream));
  aStream->mFinished = true;
  aStream->mBuffer.Finish();
}

void
GraphManagerImpl::NoteStreamAffected(Stream* aStream, double aTime)
{
  PRInt64 t = aTime < 0 ? PRInt64(0) : aStream->StreamTimeToMediaTime(aTime);
  aStream->mMessageAffectedTime =
      NS_MIN(aStream->mMessageAffectedTime, NS_MAX(GetEarliestActionTime(), t));
}

void
ControlMessage::UpdateAffectedStream(GraphManagerImpl* aManager)
{
  NS_ASSERTION(mStream, "Must have stream for default UpdateAffectedStream");
  aManager->NoteStreamAffected(mStream, -1.0);
}

void
GraphManagerImpl::ChooseActionTime()
{
  // Our actions should take effect as soon as possible, but we need to make sure
  // that any playing audio stream which is affected by our actions will be
  // able to recompute its data without under-running. Right now we have to
  // estimate how long it will take us to recompute the data --- the estimate
  // is DEFAULT_BUFFERING_MS.
  mLastActionTime = GetEarliestActionTime();

  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    if (stream->mMessageAffectedTime == PR_INT64_MAX) {
      // Stream not affected by changes --- ignore
      continue;
    }

    if (stream->mAudioOutput) {
      // We can't change anything while an affected stream is still playing
      // audio data we've already written to hardware
      mLastActionTime = NS_MAX(mLastActionTime, stream->mAudioWrittenTime);
    }
  }
}

void
GraphManagerImpl::PruneStreamData()
{
  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    if (stream->mMessageAffectedTime == PR_INT64_MAX)
      continue;

    PRInt64 pruneTime = NS_MAX(mLastActionTime, stream->mMessageAffectedTime);
    if (pruneTime < stream->GetBufferEndTime()) {
      // XXX rewinding not supported yet
      NS_ERROR("Rewinding not supported yet!");
    }
  }
}

PRInt64
GraphManagerImpl::CalculateTimeBlocked(Stream* aStream, PRInt64 aStart, PRInt64 aEnd)
{
  NS_ASSERTION(aEnd <= mBlockingDecisionsMadeUntilTime,
               "Don't ask about times where we haven't made blocking decisions yet");
  PRInt64 total = 0;
  PRInt64 t = aStart;
  while (t < aEnd) {
    PRInt64 end;
    if (aStream->mBlocked.GetAt(t, &end)) {
      total += NS_MIN(end, aEnd) - t;
    }
    t = end;
  }
  return total;
}

PRInt64
GraphManagerImpl::GetTimeIncludingBlocking(Stream* aStream, PRInt64 aTime,
                                           PRInt64 aToTime)
{
  if (aTime == PR_INT64_MAX)
    return aTime;

  // Given aTime, a time in the stream timeline assuming there is no blocking,
  // adjust aTime to account for periods while the stream was/will be blocked.
  // Blocking status between mCurrentTime and aToTime
  // is taken into account.
  PRInt64 streamAmount = aTime - mCurrentTime;
  NS_ASSERTION(streamAmount >= 0, "Can't answer queries before current time");

  PRInt64 t = mCurrentTime;
  while (t < PR_INT64_MAX) {
    bool blocked;
    PRInt64 end;
    if (t < aToTime) {
      blocked = aStream->mBlocked.GetAt(t, &end);
      end = NS_MIN(end, aToTime);
    } else {
      blocked = false;
      end = PR_INT64_MAX;
    }
    if (blocked) {
      t = end;
    } else {
      if (streamAmount == 0) {
        // No more stream time to consume at time t, so we're done.
        break;
      }
      PRInt64 consume = NS_MIN(end - t, streamAmount);
      streamAmount -= consume;
      t += consume;
    }
  }
  return t;
}

bool
GraphManagerImpl::UpdateCurrentTime()
{
  PRInt64 prevCurrentTime = mCurrentTime;

  TimeStamp now = TimeStamp::Now();
  // The earliest audio play time for streams that haven't finished playing
  // audio. We use this to determine the current audio play time.
  PRInt64 minAudioPlayTime = PR_INT64_MAX;
  // The earliest buffer end time for streams that haven't finished. We can't
  // advance the current time past this point.
  PRInt64 minBufferEndTime = PR_INT64_MAX;
  nsAutoTArray<bool,10> wasBlocked;
  wasBlocked.SetLength(mStreams.Length());
  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    PRInt64 blockedBufferEndTime =
        GetTimeIncludingBlocking(stream, stream->GetBufferEndTime(),
                                 mBlockingDecisionsMadeUntilTime);
    if (stream->mAudioOutput &&
        (!stream->mFinished || stream->mAudioWrittenTime < blockedBufferEndTime)) {
      // minAudioPlayTime = NS_MIN(minAudioPlayTime, stream->GetAudioPosition(this));
      minAudioPlayTime = NS_MIN(minAudioPlayTime, stream->mAudioWrittenTime);
    }
    if (!stream->mFinished) {
      minBufferEndTime = NS_MIN(minBufferEndTime, blockedBufferEndTime);
    }
    // Save current blocked status
    wasBlocked[i] = stream->mBlocked.GetAt(prevCurrentTime);
  }

  NS_ASSERTION(mCurrentTime <= minBufferEndTime,
               "We shouldn't have already advanced beyond buffer end!");
  PRInt64 nextCurrentTime =
      PRInt64((now - mCurrentTimeStamp).ToMicroseconds()) + mCurrentTime;
  if (minAudioPlayTime < PR_INT64_MAX) {
    minAudioPlayTime = NS_MAX(mCurrentTime, minAudioPlayTime);
    // Should really be nextCurrentTime = minAudioPlayTime, but we can't
    // use GetAudioPosition currently
    nextCurrentTime = NS_MIN(nextCurrentTime, minAudioPlayTime);
  }
  nextCurrentTime = NS_MIN(nextCurrentTime, minBufferEndTime);
  mCurrentTimeStamp = now;

  PRInt64 latestAudioWrittenTime = PR_INT64_MIN;
  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    if (stream->mAudioOutput) {
      latestAudioWrittenTime = NS_MAX(latestAudioWrittenTime, stream->mAudioWrittenTime);
    }
  }
  // We're committed to the blocking decisions that have contributed to
  // written audio buffers
  mBlockingDecisionsMadeUntilTime = NS_MAX(nextCurrentTime, latestAudioWrittenTime);
  // Don't allow actions that might change our committed blocking decisions
  mLastActionTime = NS_MAX(mLastActionTime, mBlockingDecisionsMadeUntilTime);
  LOG(PR_LOG_DEBUG, ("Updating current time to %f (minAudioPlayTime %f, minBufferEndTime %f, real %f, mBlockingDecisionsMadeUntilTime %f)",
                     nextCurrentTime/1000000.0, minAudioPlayTime/1000000.0, minBufferEndTime/1000000.0,
                     (now - mInitialTimeStamp).ToSeconds(),
                     mBlockingDecisionsMadeUntilTime/1000000.0));

  if (prevCurrentTime >= nextCurrentTime) {
    NS_ASSERTION(prevCurrentTime == nextCurrentTime, "Time can't go backwards!");
    // This could happen due to low clock resolution, maybe?
    LOG(PR_LOG_DEBUG, ("Time did not advance"));
    return false;
  }

  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];

    // Calculate blocked time and fire Blocked/Unblocked events
    PRInt64 blockedTime = 0;
    PRInt64 t = prevCurrentTime;
    bool wasBlocked = false;
    while (t < nextCurrentTime) {
      PRInt64 end;
      bool blocked = stream->mBlocked.GetAt(t, &end);
      if (blocked) {
        blockedTime += NS_MIN(end, nextCurrentTime) - t;
      }
      if (t > prevCurrentTime && blocked != wasBlocked) {
        for (PRUint32 j = 0; j < stream->mListeners.Length(); ++j) {
          StreamListener* l = stream->mListeners[j];
          l->NotifyBlockingChanged(t, blocked ? StreamListener::BLOCKED : StreamListener::UNBLOCKED);
        }
      }
      wasBlocked = blocked;
      t = end;
    }

    stream->AdvanceTimeVaryingValuesToCurrentTime(nextCurrentTime, blockedTime);
    LOG(PR_LOG_DEBUG, ("Stream %p bufferStartTime=%f blockedTime=%f",
                       stream, stream->mBufferStartTime/1000000.0, blockedTime/1000000.0));
  }

  // Advance mBlocked last so we don't lose the values that the above code
  // needs to know to calculate blocked times correctly.
  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    stream->mBlocked.AdvanceCurrentTime(nextCurrentTime);
    bool blocked = stream->mBlocked.GetAt(nextCurrentTime);
    if (wasBlocked[i] != blocked) {
      for (PRUint32 j = 0; j < stream->mListeners.Length(); ++j) {
        StreamListener* l = stream->mListeners[j];
        l->NotifyBlockingChanged(nextCurrentTime,
            blocked ? StreamListener::BLOCKED : StreamListener::UNBLOCKED);
      }
    }

    if (stream->mFinished && !stream->mNotifiedFinished &&
        stream->GetBufferEndTime() <= nextCurrentTime) {
      for (PRUint32 j = 0; j < stream->mListeners.Length(); ++j) {
        StreamListener* l = stream->mListeners[j];
        l->NotifyFinished(nextCurrentTime);
        stream->mNotifiedFinished = true;
      }
    }
  }

  mCurrentTime = nextCurrentTime;
  return true;
}

void
GraphManagerImpl::MarkStreamBlocked(Stream* aStream, PRInt64 aTime, PRInt64* aEnd)
{
  NS_ASSERTION(!aStream->mBlocked.GetAt(aTime), "Stream already blocked");

  aStream->mBlocked.SetAt(aTime, true);
  *aEnd = PR_INT64_MAX;
}

bool
GraphManagerImpl::WillUnderrun(Stream* aStream, PRInt64 aTime,
                               PRInt64 aEndBlockingDecisions, PRInt64* aEnd)
{
  *aEnd = PR_INT64_MAX;
  NS_ASSERTION(aStream->GetBufferEndTime() >= mCurrentTime, "Buffer underran");
  if (aStream->mFinished ||
      (aStream->mAudioOutputs.IsEmpty() && aStream->mVideoOutputs.IsEmpty())) {
    return false;
  }
  if (!aStream->mAudioOutput && aStream->mBuffer.GetAudioSampleEnd() == 0) {
    // There currently isn't a stream allocated, and there's no data to write,
    // so we should just consider this stream permanently blocked. Next time
    // through the control loop we may get some data, and we'll recompute
    // blocking.
    LOG(PR_LOG_DEBUG, ("Stream %p will block due to having no outputs and no data",
                       aStream));
    return true;
  }
  PRInt64 bufferEnd = GetTimeIncludingBlocking(aStream, aStream->GetBufferEndTime(), mBlockingDecisionsMadeUntilTime);
  // We should block after bufferEnd.
  if (bufferEnd <= aTime) {
    LOG(PR_LOG_DEBUG, ("Stream %p will block due to data underrun, "
                       "bufferEnd %f",
                       aStream, bufferEnd/1000000.0));
    return true;
  }
  *aEnd = bufferEnd;
  // We should keep blocking if we're currently blocked and we don't have
  // data all the way through to aEndBlockingDecisions. If we don't have
  // data all the way through to aEndBlockingDecisions, we'll block soon,
  // but we might as well remain unblocked and play the data we've got while
  // we can.
  if (bufferEnd <= aEndBlockingDecisions && aStream->mBlocked.GetAt(aTime - 1)) {
    LOG(PR_LOG_DEBUG, ("Stream %p will block due to speculative data underrun, "
                       "bufferEnd %f",
                       aStream, bufferEnd/1000000.0));
    return true;
  }
  return false;
}

/**
 * Recompute blocking status for all streams. Sets Stream::mBlocked for all streams.
 *
 * We can't change mBlocked for the time interval that's already written
 * (stream->mAudioWrittenTime), but we can change it after that as long as
 * we're consistent.
 */
void
GraphManagerImpl::RecomputeBlocking()
{
  PRInt64 endBlockingDecisions = mCurrentTime + AUDIO_WRITTEN_TARGET_MS*1000;

  // mBlockingDecisionsMadeUntilTime has been initialized already in
  // UpdateCurrentTime
  while (mBlockingDecisionsMadeUntilTime < endBlockingDecisions) {
    LOG(PR_LOG_DEBUG, ("Media graph %p computing blocking for time %f",
                       this, mBlockingDecisionsMadeUntilTime/1000000.0));
    PRInt64 end;
    RecomputeBlockingAt(mBlockingDecisionsMadeUntilTime, endBlockingDecisions, &end);
    LOG(PR_LOG_DEBUG, ("Media graph %p computed blocking for interval %f to %f",
                       this, mBlockingDecisionsMadeUntilTime/1000000.0,
                       end/1000000.0));
    mBlockingDecisionsMadeUntilTime = end;
  }
  mBlockingDecisionsMadeUntilTime = endBlockingDecisions;

  bool blockingDecisionsWillChange = false;
  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    PRInt64 end;
    stream->mBlocked.GetAt(mCurrentTime, &end);
    if (end < PR_INT64_MAX) {
      blockingDecisionsWillChange = true;
    }
  }
  if (blockingDecisionsWillChange) {
    // Make sure we wake up to notify listeners about these changes.
    // We *don't* try to wake up immediately when those decisions change,
    // because it's OK for those notifications to be a bit late and we don't
    // want to wake up too often.
    EnsureWakeUpAt(mBlockingDecisionsMadeUntilTime);
  }
}

void
GraphManagerImpl::RecomputeBlockingAt(PRInt64 aTime, PRInt64 aEndBlockingDecisions,
                                      PRInt64* aEnd)
{
  *aEnd = PR_INT64_MAX;

  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    stream->mBlocked.SetAt(aTime, false);
  }

  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    PRInt64 end;

    if (stream->mBlocked.GetAt(aTime)) {
      continue;
    }

    if (stream->mFinished) {
      PRInt64 endTime =
        GetTimeIncludingBlocking(stream, stream->GetBufferEndTime(), mBlockingDecisionsMadeUntilTime);
      if (endTime <= aTime) {
        LOG(PR_LOG_DEBUG, ("Stream %p is blocked due to being finished", stream));
        MarkStreamBlocked(stream, aTime, &end);
        *aEnd = NS_MIN(*aEnd, end);
        continue;
      } else {
        LOG(PR_LOG_DEBUG, ("Stream %p is finished, but not blocked yet (end at %f, with blocking at %f)",
                           stream, stream->GetBufferEndTime()/1000000.0, endTime/1000000.0));
        *aEnd = NS_MIN(*aEnd, endTime);
      }
    }

    // We don't need to explicitly check for cycles; streams in a cycle will
    // just never be able to produce data, and WillUnderrun will trigger.
    bool explicitBlock = stream->mExplicitBlockerCount.GetAt(aTime, &end) > 0;
    *aEnd = NS_MIN(*aEnd, end);
    if (explicitBlock) {
      LOG(PR_LOG_DEBUG, ("Stream %p is blocked due to explicit blocker", stream));
      MarkStreamBlocked(stream, aTime, &end);
      *aEnd = NS_MIN(*aEnd, end);
      continue;
    }

    bool underrun = WillUnderrun(stream, aTime, aEndBlockingDecisions, &end);
    *aEnd = NS_MIN(*aEnd, end);
    if (underrun) {
      MarkStreamBlocked(stream, aTime, &end);
      *aEnd = NS_MIN(*aEnd, end);
      continue;
    }

    if (stream->mAudioOutputs.IsEmpty() && stream->mVideoOutputs.IsEmpty()) {
      // See if the stream is being consumed anywhere. If not, it should block.
      LOG(PR_LOG_DEBUG, ("Stream %p is blocked due to having no consumers", stream));
      MarkStreamBlocked(stream, aTime, &end);
      *aEnd = NS_MIN(*aEnd, end);
      continue;
    }
  }

  NS_ASSERTION(*aEnd > aTime, "Failed to advance!");
}

void
GraphManagerImpl::CreateOrDestroyAudioStream(Stream* aStream)
{
  if (aStream->mAudioOutputs.IsEmpty()) {
    if (aStream->mAudioOutput) {
      aStream->mAudioOutput->Shutdown();
      aStream->mAudioOutput = nsnull;
    }
    return;
  }

  if (aStream->mAudioOutput)
    return;

  PRInt64 end;
  if (aStream->mBlocked.GetAt(mCurrentTime, &end) &&
      end >= mBlockingDecisionsMadeUntilTime) {
    // Stream wants to play audio, but we've decided to block it for the forseeable
    // future, so don't bother creating an output stream.
    return;
  }

  // XXX allocating a nsAudioStream could be slow so we're going to have to do
  // something here ... preallocation, async allocation, multiplexing onto a single
  // stream ...
  PRInt64 firstAudioFrameStart;
  const AudioFrame* firstAudioFrame =
    aStream->mBuffer.GetAudioFrameFor(mCurrentTime - aStream->mBufferStartTime,
                                      &firstAudioFrameStart);
  // If there's no audio data, WillUnderrun should have made the stream block
  // indefinitely
  NS_ASSERTION(firstAudioFrame, "Must have an audio frame");
  aStream->mAudioPlaybackStartTime = mCurrentTime;
  aStream->mAudioWrittenTime = mCurrentTime;
  aStream->mAudioOutput = nsAudioStream::AllocateStream();
  aStream->mAudioOutputFormat = firstAudioFrame->GetFormat();
  aStream->mAudioOutput->Init(aStream->mBuffer.GetAudioChannels(),
                              aStream->mBuffer.GetAudioSampleRate(),
                              aStream->mAudioOutputFormat);
}

void
GraphManagerImpl::PlayAudio(Stream* aStream)
{
  if (!aStream->mAudioOutput)
    return;

  PRInt32 rate = aStream->mAudioOutput->GetRate();
  PRInt64 outputStreamAvailable =
    SampleToUSecRoundDown(rate, aStream->mAudioOutput->Available());
  PRInt64 currentPosition = aStream->GetAudioPosition(this);
  // currentPosition must be >= mCurrentTime since we set mCurrentTime using
  // the earliest audio output position
  NS_ASSERTION(currentPosition >= mCurrentTime, "Written audio fell behind?");
  NS_ASSERTION(currentPosition <= aStream->mAudioWrittenTime,
               "Shouldn't play more than we've written");
  PRInt64 writeEnd = NS_MIN(GetTimeIncludingBlocking(aStream, aStream->GetBufferEndTime(), mBlockingDecisionsMadeUntilTime),
      currentPosition + outputStreamAvailable);
  // Limit how much we buffer
  writeEnd = NS_MIN(writeEnd, mBlockingDecisionsMadeUntilTime);

  PRInt64 toWrite = writeEnd - aStream->mAudioWrittenTime;
  if (toWrite <= 0) {
    LOG(PR_LOG_DEBUG, ("Stream %p not writing audio because we've written enough (to %f)",
                       aStream, aStream->mAudioWrittenTime/1000000.0));
    // Nothing to write, bail
    EnsureWakeUpAt(aStream->mAudioWrittenTime - GRAPH_MANAGER_CONTROL_DELAY_MS*1000);
    return;
  }
  if (currentPosition + AUDIO_WRITTEN_TARGET_MS*1000 <= aStream->mAudioWrittenTime) {
    LOG(PR_LOG_DEBUG, ("Stream %p not writing audio because we don't meet the minimum write amount",
                       aStream));
    // Not enough to write, don't bother
    EnsureWakeUpAt(aStream->mAudioWrittenTime - GRAPH_MANAGER_CONTROL_DELAY_MS*1000);
    return;
  }

  float volume = 0.0;
  for (PRUint32 i = 0; i < aStream->mAudioOutputs.Length(); ++i) {
    volume += aStream->mAudioOutputs[i].mVolume;
  }

  // We don't update aStream->mBufferStartTime here to account for
  // time spent blocked. Instead, we'll update it in UpdateCurrentTime after the
  // blocked period has completed. But we do need to make sure we play from the
  // right offsets in the stream buffer, even if we've already written silence for
  // some amount of blocked time after the current time.
  PRInt64 effectiveBufferStart = aStream->mBufferStartTime
      + CalculateTimeBlocked(aStream, mCurrentTime, aStream->mAudioWrittenTime);
  while (aStream->mAudioWrittenTime < writeEnd) {
    PRInt64 end;
    bool blocked = aStream->mBlocked.GetAt(aStream->mAudioWrittenTime, &end);
    end = NS_MIN(end, writeEnd);

    PRInt64 sampleStart = USecToSampleRoundDown(rate, aStream->mAudioWrittenTime - effectiveBufferStart);
    PRInt64 sampleEnd = USecToSampleRoundDown(rate, end - effectiveBufferStart);

    if (sampleStart < sampleEnd) {
      nsAutoTArray<AudioFrame,4> output;
      if (blocked) {
        // We shouldn't have too many samples here because we can't get more than
        // a buffer-size ahead of the end of written audio ... we don't
        // support more than 1MHz sample rates, and the buffer sizes will be
        // small compared to seconds.
        NS_ASSERTION(sampleEnd - sampleStart <= PR_INT32_MAX,
                     "Sample are supposed to be limited to 32-bits");
        output.AppendElement(AudioFrame(PRInt32(sampleEnd - sampleStart)));
        effectiveBufferStart += end - aStream->mAudioWrittenTime;
        LOG(PR_LOG_DEBUG, ("Stream %p writing blocking-silence samples for %f to %f",
                           aStream, aStream->mAudioWrittenTime/1000000.0, end/1000000.0));
      } else {
        // Copy buffer for the volume changes. This will avoid copying actual audio
        // data in most cases.
        StreamBufferSlice slice;
        NS_ASSERTION(sampleEnd - sampleStart <= PR_INT32_MAX,
                     "We never write this much, are buffer sizes wrong?");
        slice.SetSlice(&aStream->mBuffer, rate, aStream->mAudioOutput->GetChannels(),
                       sampleStart, PRInt32(sampleEnd - sampleStart), 0);
        slice.SetVolume(volume);
        // There could be a bit of a delay here while we apply volume. (No resampling
        // should be occurring, although it would be easy to do a software resample
        // here if we want to.)
        slice.ExtractAudioSamples(&output);
        LOG(PR_LOG_DEBUG, ("Stream %p writing samples for %f to %f (samples %lld to %lld)",
                           aStream, aStream->mAudioWrittenTime/1000000.0, end/1000000.0,
                           sampleStart, sampleEnd));
        for (PRUint32 i = 0; i < aStream->mListeners.Length(); ++i) {
          StreamListener* l = aStream->mListeners[i];
          l->NotifyPlayAudio(slice);
        }
      }
      WriteAudioFrames(output, aStream->mAudioOutput);
    }

    aStream->mAudioWrittenTime = end;
  }

  EnsureWakeUpAt(aStream->mAudioWrittenTime - GRAPH_MANAGER_CONTROL_DELAY_MS*1000);
}

void
GraphManagerImpl::PlayVideo(Stream* aStream)
{
  if (aStream->mVideoOutputs.IsEmpty())
    return;

  // Pick the frame to display using the current audio position. This should
  // give slightly better A/V sync.
  PRInt64 audioPosition = aStream->GetAudioPosition(this);
  // Audio position must not be behind mCurrentTime (we advance
  // mCurrentTime to the earliest audio position).
  NS_ASSERTION(audioPosition >= aStream->mBufferStartTime, "audio position before buffer?");
  // The cast must be safe because audioPosition will be <= the written
  // audio position, which is in the StreamBuffer, whose duration is
  // 32-bit
  PRInt64 frameBufferTime = audioPosition - aStream->mBufferStartTime;
  PRInt64 start;
  const VideoFrame* frame = aStream->mBuffer.GetVideoFrameFor(frameBufferTime, &start);
  // Don't update if the video image hasn't changed
  if (!frame)
    return;

  if (!frame->ImageEquals(aStream->mLastPlayedVideoFrame)) {
    TimeStamp targetTime = mCurrentTimeStamp +
        TimeDuration::FromMilliseconds(start + aStream->mBufferStartTime - mCurrentTime);
    LOG(PR_LOG_DEBUG, ("Stream %p writing video frame %p (%dx%d)",
                       aStream, frame->GetImage(), frame->GetIntrinsicSize().width,
                       frame->GetIntrinsicSize().height));
    for (PRUint32 i = 0; i < aStream->mVideoOutputs.Length(); ++i) {
      VideoFrameContainer* output = aStream->mVideoOutputs[i];
      output->SetCurrentFrame(frame->GetIntrinsicSize(), frame->GetImage(),
                              targetTime);
      nsCOMPtr<nsIRunnable> event =
        NS_NewRunnableMethod(output, &VideoFrameContainer::Invalidate);
      NS_DispatchToMainThread(event, NS_DISPATCH_NORMAL);
    }
    aStream->mLastPlayedVideoFrame = *frame;
  }

  PRInt64 frameEnd = aStream->mBufferStartTime + start + frame->GetDuration();
  if (frameEnd > mCurrentTime) {
    // There may be another frame. Wake up to play it.
    PRInt64 frameEndWithBlocking =
        GetTimeIncludingBlocking(aStream, frameEnd, mBlockingDecisionsMadeUntilTime);
    // Don't wake up to play the next frame before ALLOW_VIDEO_FRAME_DELAY_MS from now
    EnsureWakeUpAt(NS_MAX(mCurrentTime + ALLOW_VIDEO_FRAME_DELAY_MS*1000,
                          frameEndWithBlocking));
  }
}

void
GraphManagerImpl::PrepareUpdatesToMainThreadState()
{
  mMonitor.AssertCurrentThreadOwns();

  mNextMainThreadCurrentTime = mCurrentTime;
  for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
    Stream* stream = mStreams[i];
    StreamUpdate* update = mStreamUpdates.AppendElement();
    update->mGraphUpdateIndex = stream->mGraphUpdateIndices.GetAt(mCurrentTime);
    update->mStream = stream;
    update->mNextMainThreadCurrentTime = mCurrentTime - stream->mBufferStartTime;
    update->mNextMainThreadFinished =
      stream->mFinished && stream->GetBufferEndTime() <= mCurrentTime;
  }
  mUpdateRunnables.MoveElementsFrom(mPendingUpdateRunnables);

  EnsureStableStateEventPosted();
}

void
GraphManagerImpl::RunThread()
{
  for (;;) {
    nsTArray<MessageBlock> messageQueue;
    {
      MonitorAutoLock lock(mMonitor);
      PrepareUpdatesToMainThreadState();
      mNextWakeUpTimeStamp = TimeStamp();
      if (mMessageQueue.IsEmpty()) {
        if (IsEmpty()) {
          // Enter shutdown mode. The stable-state handler will detect this
          // and complete shutdown.
          mShutDown = true;
          return;
        }
        if (mForceShutDown) {
          // Enter forced-shutdown mode. The stable-state handler will detect this
          // and complete shutdown.
          mShutDown = true;
          for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
            mStreams[i]->DestroyImpl();
          }
          return;
        }
        if (!mWakeUp) {
          PRIntervalTime timeout = PR_INTERVAL_NO_TIMEOUT;
          if (mNextWakeUpTime < PR_INT64_MAX) {
            LOG(PR_LOG_DEBUG, ("Scheduling wakeup for time %f", mNextWakeUpTime/1000000.0));
            TimeStamp now = TimeStamp::Now();
            PRInt64 timeoutMS = mNextWakeUpTime - mCurrentTime -
                PRInt64((now - mCurrentTimeStamp).ToMicroseconds());
            // Make sure timeoutMS doesn't overflow 32 bits by waking up at
            // least once a minute, if we need to wake up at all
            timeoutMS = NS_MAX<PRInt64>(0, NS_MIN<PRInt64>(timeoutMS, 60*1000000));
            timeout = PR_MicrosecondsToInterval(PRUint32(timeoutMS));
            mNextWakeUpTimeStamp = now + TimeDuration::FromMicroseconds(timeoutMS);
          }
          if (timeout > 0) {
            mIsWaiting = true;
            lock.Wait(timeout);
            mIsWaiting = false;
          }
        }
      }
      mWakeUp = false;
      messageQueue.SwapElements(mMessageQueue);
    }
    mNextWakeUpTime = PR_INT64_MAX;

    // Update mCurrentTime to the min of the playing audio times, or using the
    // wall-clock time change if no audio is playing.
    UpdateCurrentTime();

    // Calculate independent action times for each batch of messages (each
    // batch corresponding to an event loop task). This isolates the performance
    // of different scripts to some extent.
    for (PRUint32 i = 0; i < messageQueue.Length(); ++i) {
      mProcessingGraphUpdateIndex = messageQueue[i].mGraphUpdateIndex;
      nsTArray<nsAutoPtr<ControlMessage> >& messages = messageQueue[i].mMessages;

      for (PRUint32 j = 0; j < mStreams.Length(); ++j) {
        mStreams[j]->mMessageAffectedTime = PR_INT64_MAX;
      }
      for (PRUint32 j = 0; j < messages.Length(); ++j) {
        messages[j]->UpdateAffectedStream(this);
      }

      ChooseActionTime();
      PruneStreamData();

      for (PRUint32 j = 0; j < messages.Length(); ++j) {
        messages[j]->Process(this);
      }
    }

    // Grab pending ProcessingEngine results.
    for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
      InputStream* is = mStreams[i]->AsInputStream();
      if (is) {
        ExtractPendingInput(is);
      }
    }

    RecomputeBlocking();

    // Figure out what each stream wants to do
    for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
      Stream* stream = mStreams[i];
      CreateOrDestroyAudioStream(stream);

      PlayAudio(stream);
      PlayVideo(stream);
    }

    for (PRUint32 i = 0; i < mStreams.Length(); ++i) {
      Stream* stream = mStreams[i];
      InputStream* is = stream->AsInputStream();
      if (is) {
        UpdateBufferSufficiencyState(is);
      }
    }
  }
}

void
GraphManagerImpl::ApplyStreamUpdate(StreamUpdate* aUpdate)
{
  mMonitor.AssertCurrentThreadOwns();

  Stream* stream = aUpdate->mStream;
  if (!stream)
    return;
  stream->mMainThreadCurrentTime = aUpdate->mNextMainThreadCurrentTime;
  stream->mMainThreadFinished = aUpdate->mNextMainThreadFinished;
}

void
GraphManagerImpl::StopThreads()
{
  NS_ASSERTION(NS_IsMainThread(), "Must be called on main thread");
  // mManager's thread is not running so it's OK to do whatever here
  LOG(PR_LOG_DEBUG, ("Stopping threads for GraphManager %p", this));

  if (mThread) {
    mThread->Shutdown();
    mThread = nsnull;
  }
  if (mThreadPool) {
    mThreadPool->Shutdown();
    mThreadPool = nsnull;
  }
}

void
GraphManagerImpl::ForceShutDown()
{
  NS_ASSERTION(NS_IsMainThread(), "Must be called on main thread");
  MonitorAutoLock lock(mMonitor);
  mForceShutDown = true;
  lock.Notify();
}

static GraphManagerImpl* gManager;

class GraphManagerThreadRunnable : public nsRunnable {
public:
  NS_IMETHOD Run()
  {
    gManager->RunThread();
    return NS_OK;
  }
};

class GraphManagerShutDownRunnable : public nsRunnable {
public:
  GraphManagerShutDownRunnable(GraphManagerImpl* aManager) : mManager(aManager) {}
  NS_IMETHOD Run()
  {
    // mManager's thread is not running so it's OK to do whatever here
    mManager->StopThreads();
    if (mManager->IsEmpty()) {
      // mManager is no longer needed, so delete it. If the manager is not empty
      // then we must be in a forced shutdown and some later AppendMessage will
      // detect that the manager has been emptied, and delete it.
      delete mManager;
    } else {
      NS_ASSERTION(mManager->IsForcedShutDownComplete(), "Not in forced shutdown?");
    }
    return NS_OK;
  }
private:
  GraphManagerImpl* mManager;
};

void
GraphManagerImpl::RunInStableState()
{
  NS_ASSERTION(NS_IsMainThread(), "Must be called on main thread");

  nsTArray<nsCOMPtr<nsIRunnable> > runnables;

  {
    MonitorAutoLock lock(mMonitor);
    mPostedRunInStableStateEvent = false;

    mMainThreadCurrentTime = mNextMainThreadCurrentTime;
    runnables.SwapElements(mUpdateRunnables);
    for (PRUint32 i = 0; i < mStreamUpdates.Length(); ++i) {
      StreamUpdate* update = &mStreamUpdates[i];
      if (update->mStream) {
        ApplyStreamUpdate(update);
      }
    }
    mStreamUpdates.Clear();

    if (mForceShutDown && mShutDown) {
      // RunThread has exited (or is in the process of doing so). Process all
      // pending messages here and set the flag to indicate that all cleanup
      // should happen on the main thread from now on.
      if (mForcedShutDownComplete) {
        NS_ASSERTION(mCurrentTaskMessageQueue.IsEmpty(),
                     "Shouldn't have accumulated any more messages in queue");
        return;
      }
      mForcedShutDownComplete = true;
      for (PRUint32 i = 0; i < mCurrentTaskMessageQueue.Length(); ++i) {
        mCurrentTaskMessageQueue[i]->ProcessDuringShutdown(this);
      }
      mCurrentTaskMessageQueue.Clear();
      // Stop GraphManager threads. Do not clear gManager since
      // we have outstanding DOM objects that may need it.
      nsCOMPtr<nsIRunnable> event = new GraphManagerShutDownRunnable(this);
      NS_DispatchToMainThread(event);
      return;
    }

    if (mCurrentTaskMessageQueue.IsEmpty()) {
      if (mShutDown && IsEmpty()) {
        NS_ASSERTION(gManager == this, "Not current manager??");
        // Complete shutdown. First, ensure that this manager is no longer used.
        // A new graph manager will be created if one is needed.
        LOG(PR_LOG_DEBUG, ("Disconnecting GraphManager %p", gManager));
        gManager = nsnull;
        // Asynchronously clean up old graph manager. We don't want to do this
        // synchronously because it spins the event loop waiting for threads
        // to shut down, and we don't want to do that in a stable state handler.
        nsCOMPtr<nsIRunnable> event = new GraphManagerShutDownRunnable(this);
        NS_DispatchToMainThread(event);
      }
    } else {
      if (mShutDown) {
        // Revive the GraphManager since we have more messages going to it
        nsCOMPtr<nsIRunnable> event = new GraphManagerThreadRunnable();
        mThread->Dispatch(event, 0);
        mShutDown = false;
      }

      MessageBlock* block = mMessageQueue.AppendElement();
      block->mMessages.SwapElements(mCurrentTaskMessageQueue);
      block->mGraphUpdateIndex = mGraphUpdatesSent;
      ++mGraphUpdatesSent;
      lock.Notify();
    }
  }

  // Make sure we get a new current time in the next event loop task
  mNeedMainThreadStateUpdate = true;
  mPostedRunInStableState = false;

  for (PRUint32 i = 0; i < runnables.Length(); ++i) {
    runnables[i]->Run();
  }
}

class GraphManagerStableStateRunnable : public nsRunnable {
public:
  NS_IMETHOD Run()
  {
    if (gManager) {
      gManager->RunInStableState();
    }
    return NS_OK;
  }
};

static NS_DEFINE_CID(kAppShellCID, NS_APPSHELL_CID);

void
GraphManager::EnsureStableStateRunnablePosted()
{
  NS_ASSERTION(NS_IsMainThread(), "main thread only");

  if (mPostedRunInStableState)
    return;
  mPostedRunInStableState = true;
  nsCOMPtr<nsIRunnable> event = new GraphManagerStableStateRunnable();
  nsCOMPtr<nsIAppShell> appShell = do_GetService(kAppShellCID);
  if (appShell) {
    appShell->RunInStableState(event);
  } else {
    NS_ERROR("Appshell already destroyed?");
  }
}

void
GraphManagerImpl::EnsureStableStateEventPosted()
{
  mMonitor.AssertCurrentThreadOwns();

  if (mPostedRunInStableStateEvent)
    return;
  mPostedRunInStableStateEvent = true;
  nsCOMPtr<nsIRunnable> event = new GraphManagerStableStateRunnable();
  NS_DispatchToMainThread(event);
}

void
GraphManager::AppendMessage(ControlMessage* aMessage)
{
  NS_ASSERTION(NS_IsMainThread(), "main thread only");

  if (mForcedShutDownComplete) {
    GraphManagerImpl* impl = static_cast<GraphManagerImpl*>(this);
    aMessage->ProcessDuringShutdown(impl);
    delete aMessage;
    if (impl->IsEmpty()) {
      NS_ASSERTION(gManager == this, "Switched managers during forced shutdown?");
      delete impl;
      gManager = nsnull;
    }
    return;
  }

  mCurrentTaskMessageQueue.AppendElement(aMessage);
  EnsureStableStateRunnablePosted();
}

void
InputStream::Init(PRInt32 aAudioSampleRate, PRInt32 aAudioChannels)
{
  MutexAutoLock lock(mMutex);
  mPending.SetAudioSampleRate(aAudioSampleRate);
  mPending.SetAudioChannels(aAudioChannels);
  // No need to do a wakeup, nothing matters until audio is written
}

void
InputStream::SetAudioEnabled(bool aEnabled)
{
  MutexAutoLock lock(mMutex);
  mPending.SetAudioEnabled(aEnabled);
  // No need to do a wakeup, nothing matters until audio is written
}

void
InputStream::SetVideoEnabled(bool aEnabled)
{
  MutexAutoLock lock(mMutex);
  mPending.SetVideoEnabled(aEnabled);
  // No need to do a wakeup, nothing matters until video is written
}

void
InputStream::WriteAudio(nsTArray<AudioFrame>* aBuffer)
{
  {
    MutexAutoLock lock(mMutex);
    mPending.AppendAudio(aBuffer);
  }
  gManager->WakeUp(ALLOW_DELAY_AFTER_OUTPUT_MS*1000);
}

void
InputStream::WriteVideo(nsTArray<VideoFrame>* aBuffer)
{
  {
    MutexAutoLock lock(mMutex);
    mPending.AppendVideo(aBuffer);
  }
  gManager->WakeUp(ALLOW_DELAY_AFTER_OUTPUT_MS*1000);
}

bool
InputStream::HaveEnoughBufferedAudio()
{
  MutexAutoLock lock(mMutex);
  return mHaveEnoughAudio;
}

void
InputStream::DispatchWhenNotEnoughBufferedAudio(nsIThread* aSignalThread, nsIRunnable* aSignalRunnable)
{
  MutexAutoLock lock(mMutex);
  if (mHaveEnoughAudio) {
    mDispatchWhenNotEnoughAudio.AppendElement()->Init(aSignalThread, aSignalRunnable);
  } else {
    aSignalThread->Dispatch(aSignalRunnable, 0);
  }
}

bool
InputStream::HaveEnoughBufferedVideo()
{
  MutexAutoLock lock(mMutex);
  return mHaveEnoughVideo;
}

void
InputStream::DispatchWhenNotEnoughBufferedVideo(nsIThread* aSignalThread, nsIRunnable* aSignalRunnable)
{
  MutexAutoLock lock(mMutex);
  if (mHaveEnoughVideo) {
    mDispatchWhenNotEnoughVideo.AppendElement()->Init(aSignalThread, aSignalRunnable);
  } else {
    aSignalThread->Dispatch(aSignalRunnable, 0);
  }
}

void
InputStream::Finish()
{
  {
    MutexAutoLock lock(mMutex);
    mPendingFinished = true;
  }
  gManager->WakeUp(ALLOW_DELAY_AFTER_OUTPUT_MS*1000);
}

/*
 * Control messages forwarded from main thread to graph manager thread
 */

class CreateMessage : public ControlMessage {
public:
  CreateMessage(Stream* aStream) : ControlMessage(aStream) {}
  virtual void Process(GraphManagerImpl* aManager)
  {
    mStream->Init(aManager);
  }
  virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
  {
    aManager->AddStream(mStream);
  }
};

InputStream*
GraphManager::CreateInputStream(nsDOMMediaStream* aWrapper)
{
  InputStream* stream = new InputStream(aWrapper);
  NS_ADDREF(stream);
  AppendMessage(new CreateMessage(stream));
  return stream;
}

void
Stream::Init(GraphManagerImpl* aManager)
{
  mBlocked.SetAt(aManager->mCurrentTime, true);
  mExplicitBlockerCount.SetAt(aManager->mCurrentTime, true);
  mExplicitBlockerCount.SetAt(aManager->mLastActionTime, false);
}

void
Stream::DestroyImpl()
{
  if (mAudioOutput) {
    mAudioOutput->Shutdown();
    mAudioOutput = nsnull;
  }
}

PRInt64
Stream::GetAudioPosition(GraphManagerImpl* aManager)
{
  if (!mAudioOutput)
    return aManager->mCurrentTime;
  // PRInt64 time = mAudioPlaybackStartTime + mAudioOutput->GetPosition();
  PRInt64 time = aManager->mCurrentTime;
  if (time > mAudioWrittenTime) {
    NS_WARNING("Reported audio time is more than we wrote!");
    time = mAudioWrittenTime;
  }
  return time;
}

void
Stream::Destroy()
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream) : ControlMessage(aStream) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->DestroyImpl();
      aManager->RemoveStream(mStream);
    }
    virtual void ProcessDuringShutdown(GraphManagerImpl* aManager)
    { UpdateAffectedStream(aManager); }
  };
  mWrapper = nsnull;
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this));
}

void
Stream::AddAudioOutput(void* aKey)
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream, void* aKey) : ControlMessage(aStream), mKey(aKey) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->AddAudioOutputImpl(mKey);
    }
    void* mKey;
  };
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this, aKey));
}

void
Stream::SetAudioOutputVolumeImpl(void* aKey, float aVolume)
{
  for (PRUint32 i = 0; i < mAudioOutputs.Length(); ++i) {
    if (mAudioOutputs[i].mKey == aKey) {
      mAudioOutputs[i].mVolume = aVolume;
      return;
    }
  }
  NS_ERROR("Audio output key not found");
}

void
Stream::SetAudioOutputVolume(void* aKey, float aVolume)
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream, void* aKey, float aVolume) :
      ControlMessage(aStream), mKey(aKey), mVolume(aVolume) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->SetAudioOutputVolumeImpl(mKey, mVolume);
    }
    void* mKey;
    float mVolume;
  };
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this, aKey, aVolume));
}

void
Stream::RemoveAudioOutputImpl(void* aKey)
{
  for (PRUint32 i = 0; i < mAudioOutputs.Length(); ++i) {
    if (mAudioOutputs[i].mKey == aKey) {
      mAudioOutputs.RemoveElementAt(i);
      return;
    }
  }
  NS_ERROR("Audio output key not found");
}

void
Stream::RemoveAudioOutput(void* aKey)
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream, void* aKey) :
      ControlMessage(aStream), mKey(aKey) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->RemoveAudioOutputImpl(mKey);
    }
    void* mKey;
  };
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this, aKey));
}

void
Stream::AddVideoOutput(VideoFrameContainer* aContainer)
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream, VideoFrameContainer* aContainer) :
      ControlMessage(aStream), mContainer(aContainer) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->AddVideoOutputImpl(mContainer.forget());
    }
    nsRefPtr<VideoFrameContainer> mContainer;
  };
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this, aContainer));
}

void
Stream::RemoveVideoOutput(VideoFrameContainer* aContainer)
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream, VideoFrameContainer* aContainer) :
      ControlMessage(aStream), mContainer(aContainer) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->RemoveVideoOutputImpl(mContainer);
    }
    nsRefPtr<VideoFrameContainer> mContainer;
  };
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this, aContainer));
}

void
Stream::ChangeExplicitBlockerCount(PRInt32 aDelta)
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream, PRInt32 aDelta) :
      ControlMessage(aStream), mDelta(aDelta) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->ChangeExplicitBlockerCountImpl(aManager->mLastActionTime, mDelta);
    }
    PRInt32 mDelta;
  };
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this, aDelta));
}

void
Stream::AddListener(StreamListener* aListener)
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream, StreamListener* aListener) :
      ControlMessage(aStream), mListener(aListener) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->AddListenerImpl(mListener.forget());
    }
    nsRefPtr<StreamListener> mListener;
  };
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this, aListener));
}

void
Stream::RemoveListener(StreamListener* aListener)
{
  class Message : public ControlMessage {
  public:
    Message(Stream* aStream, StreamListener* aListener) :
      ControlMessage(aStream), mListener(aListener) {}
    virtual void UpdateAffectedStream(GraphManagerImpl* aManager)
    {
      mStream->RemoveListenerImpl(mListener);
    }
    nsRefPtr<StreamListener> mListener;
  };
  GraphManager* gm = GraphManager::GetInstance();
  gm->AppendMessage(new Message(this, aListener));
}

static const PRUint32 kThreadLimit = 4;
static const PRUint32 kIdleThreadLimit = 4;
static const PRUint32 kIdleThreadTimeoutMs = 2000;

GraphManagerImpl::GraphManagerImpl()
  : mLastActionTime(1)
  , mCurrentTime(1)
  , mNextWakeUpTime(PR_INT64_MAX)
  , mBlockingDecisionsMadeUntilTime(1)
  , mProcessingGraphUpdateIndex(0)
  , mMonitor("GraphManagerImpl")
  , mNextMainThreadCurrentTime(1)
  , mShutDown(false)
  , mForceShutDown(false)
  , mWakeUp(false)
  , mIsWaiting(false)
  , mPostedRunInStableStateEvent(false)
  , mNeedMainThreadStateUpdate(false)
{
#ifdef PR_LOGGING
  if (!gMediaStreamGraphLog) {
    gMediaStreamGraphLog = PR_NewLogModule("MediaStreamGraph");
  }
#endif

  mCurrentTimeStamp = mInitialTimeStamp = TimeStamp::Now();

  mThreadPool = do_CreateInstance(NS_THREADPOOL_CONTRACTID);
  if (mThreadPool) {
    mThreadPool->SetThreadLimit(kThreadLimit);
    mThreadPool->SetIdleThreadLimit(kIdleThreadLimit);
    mThreadPool->SetIdleThreadTimeout(kIdleThreadTimeoutMs);
  }
}

class GraphManagerShutdownObserver : public nsIObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER
};

NS_IMPL_ISUPPORTS1(GraphManagerShutdownObserver, nsIObserver)

static bool gShutdownObserverRegistered = false;

NS_IMETHODIMP
GraphManagerShutdownObserver::Observe(nsISupports *aSubject,
                                      const char *aTopic,
                                      const PRUnichar *aData)
{
  if (strcmp(aTopic, NS_XPCOM_SHUTDOWN_OBSERVER_ID) == 0) {
    if (gManager) {
      gManager->ForceShutDown();
    }
    nsContentUtils::UnregisterShutdownObserver(this);
    gShutdownObserverRegistered = false;
  }
  return NS_OK;
}

GraphManager*
GraphManager::GetInstance()
{
  if (!gManager) {
    if (!gShutdownObserverRegistered) {
      gShutdownObserverRegistered = true;
      nsContentUtils::RegisterShutdownObserver(new GraphManagerShutdownObserver());
    }

    gManager = new GraphManagerImpl();
    LOG(PR_LOG_DEBUG, ("Starting up GraphManager %p", gManager));

    // Dispatch the runnable only after gManager is initialized
    nsCOMPtr<nsIRunnable> event = new GraphManagerThreadRunnable();
    NS_NewThread(getter_AddRefs(gManager->mThread), event);
  }

  return gManager;
}

}
}
