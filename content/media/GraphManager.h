/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MOZILLA_GRAPHMANAGER_H_
#define MOZILLA_GRAPHMANAGER_H_

#include "nsTArray.h"
#include "nsISupportsImpl.h"
#include "nsAudioStream.h"
#include "mozilla/Mutex.h"
#include "jsapi.h"
#include "TimeVarying.h"
#include "StreamBuffer.h"
#include "nsIThreadPool.h"
#include "VideoFrameContainer.h"

class nsIThread;
class nsIRunnable;
class nsIWorker;
class nsDOMMediaInput;
class nsDOMMediaStream;

namespace mozilla {
namespace media {

/*
 * GraphManager is a framework for synchronized audio/video processing
 * and playback. It is designed to be used by other browser components such as
 * HTML media elements, media capture APIs, real-time media streaming APIs,
 * multitrack media APIs, and advanced audio APIs.
 *
 * The GraphManager uses a dedicated thread to process media --- the media
 * graph thread. This ensures that we can process media through the graph
 * without blocking on main-thread activity. The media graph is only modified
 * on the media graph thread, to ensure graph changes can be processed without
 * interfering with media processing. All interaction with the media graph
 * thread is done with message passing.
 *
 * APIs that modify the graph or its properties are described as "control APIs".
 * These APIs are asynchronous; they queue graph changes internally and
 * those changes are processed all-at-once by the graph manager. The graph
 * manager monitors the main thread event loop via nsIAppShell::RunInStableState
 * to ensure that graph changes from a single event loop task are always
 * processed all together. Control APIs should only be used on the main thread,
 * currently; we may be able to relax that later.
 *
 * To allow precise synchronization of times in the control API, the media
 * graph manager maintains a "media timeline". Control APIs that take or
 * return times use that timeline. Those times never advance during
 * an event loop task. This time is returned by GraphManager::GetCurrentTime().
 *
 * Media decoding, audio processing and media playback use thread-safe APIs to
 * the media graph to ensure they can continue while the main thread is blocked.
 *
 * When the graph is changed, we may need to throw out buffered data and
 * reprocess it. This is triggered automatically by the GraphManager.
 *
 * Streams that use different sampling rates complicate things a lot. We
 * considered forcing all streams to have the same audio sample rate, resampling
 * at inputs and outputs only, but that would create situations where a stream
 * is resampled from X to Y and then back to X unnecessarily. It seems easier
 * to just live with streams having different sample rates. We do require that
 * the sample rate for a stream be constant for the life of a stream.
 *
 * XXX does not yet support blockInput/blockOutput functionality.
 */

/**
 * This is a base class for listener callbacks. Override methods to be
 * notified of audio or video data or changes in stream state.
 *
 * This can be used by stream recorders or network connections that receive
 * stream input. It could also be used for debugging.
 */
class StreamListener {
public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(StreamListener)

  // All methods are called from the media graph thread. Overriders of these
  // methods are responsible for all synchronization. Beware!
  // These methods are called without the media graph monitor held, so
  // reentry into media graph methods is possible, although very much discouraged!
  // You should do something non-blocking and non-reentrant (e.g. dispatch an
  // event to some thread) and return.

  // Notify that the blocking status of the stream changed.
  enum Blocking {
    BLOCKED,
    UNBLOCKED
  };
  virtual void NotifyBlockingChanged(PRInt64 aCurrentTime, Blocking aBlocked) {}

  // Notify that audio data is being sent to the audio output stream.
  // The StreamBufferSlice identifies the audio data being sent.
  virtual void NotifyPlayAudio(const StreamBufferSlice& aBuffer) {}

  // Notify that the stream finished.
  virtual void NotifyFinished(PRInt64 aCurrentTime) {}

  // Notify that data has been queued. Due to buffering it may
  // not yet be time to play the data. If the stream is reset (e.g. because
  // a graph change invalidated buffered data), this data may never be played.
  // aCurrentTime is the current media graph time.
  // aQueuedTime is the time where the newly queued data starts.
  // aBufferStartTime is the start time for aBuffer, so the end of the newly
  // queued data is at aBufferStartTime + aBuffer->GetEnd().
  // (Note that aBuffer->GetEnd() returns the latest time for which we have
  // the data for all enabled tracks. Some tracks may have additional
  // data in the StreamBuffer.)
  virtual void NotifyQueued(PRInt64 aCurrentTime, PRInt64 aQueuedTime,
                            PRInt64 aBufferStartTime, const StreamBuffer& aBuffer) {}
  // Notify that any queued but not played data after the given time has been flushed.
  // TODO.
  virtual void NotifyReset(PRInt64 aQueuedTime) {}
};

class GraphManagerImpl;
class Stream;
class InputStream;

/**
 * This represents a message passed from the main thread to the graph manager.
 * A ControlMessage always references a particular affected stream.
 */
class ControlMessage {
public:
  ControlMessage(Stream* aStream) : mStream(aStream)
  {
    MOZ_COUNT_CTOR(ControlMessage);
  }
  // All these run on the graph manager thread
  virtual ~ControlMessage()
  {
    MOZ_COUNT_DTOR(ControlMessage);
  }
  // Executed before we know what the action time for this message will be.
  // Call aManager->NoteStreamAffected on the stream whose output will be
  // modified by this message. Default implementation calls
  // aManager->NoteStreamAffected(mStream).
  virtual void UpdateAffectedStream(GraphManagerImpl* aManager);
  // Executed after we know what the action time for this message will be.
  virtual void Process(GraphManagerImpl* aManager) {}
  // When we're shutting down the application, most messages are ignored but
  // some cleanup messages should still be processed on the main thread.
  virtual void ProcessDuringShutdown(GraphManagerImpl* aManager) {}

protected:
  // We do not hold a reference to mStream. The main thread will be holding
  // a reference to the stream while this message is in flight. The last message
  // referencing a stream is the Destroy message for that stream.
  Stream* mStream;
};

/**
 * Initially, at least, we will have a singleton Manager per
 * process.
 */
class GraphManager {
public:
  // Control API.
  // Create a stream that a media decoder can write to.
  InputStream* CreateInputStream(nsDOMMediaStream* aWrapper);

  static void CheckForShutDown();
  static GraphManager* GetInstance();

  PRInt64 GetCurrentTime()
  {
    NS_ASSERTION(NS_IsMainThread(), "main thread only");
    return mMainThreadCurrentTime; // microseconds
  }

  PRInt64 GetCurrentGraphUpdateIndex() { return mGraphUpdatesSent; }
  bool IsForcedShutDownComplete() { return mForcedShutDownComplete; }

  /**
   * Media graph thread only.
   * Dispatches a runnable that will run on the main thread after all
   * main-thread stream state has been next updated.
   * Should only be called during StreamListener callbacks.
   */
  void DispatchToMainThreadAfterStreamStateUpdate(nsIRunnable* aRunnable)
  {
    mPendingUpdateRunnables.AppendElement(aRunnable);
  }

protected:
  GraphManager()
    : mMainThreadCurrentTime(1)
    , mGraphUpdatesSent(1)
    , mPostedRunInStableState(false)
    , mForcedShutDownComplete(false)
  {
    MOZ_COUNT_CTOR(GraphManager);
  }
  ~GraphManager()
  {
    MOZ_COUNT_DTOR(GraphManager);
  }

  friend class Stream;
  friend class InputStream;

  void AppendMessage(ControlMessage* aMessage);
  void EnsureStableStateRunnablePosted();

  // Media graph thread only
  nsTArray<nsCOMPtr<nsIRunnable> > mPendingUpdateRunnables;

  // Main thread only
  // Microseconds
  PRInt64 mMainThreadCurrentTime;
  // The number of updates we have sent to the media graph thread. We start
  // this at 1 just to ensure that it's ahead of the
  // mMainThreadParametersWaitForUpdate counters.
  PRInt64 mGraphUpdatesSent;
  // Messages posted by the current event loop task
  nsTArray<nsAutoPtr<ControlMessage> > mCurrentTaskMessageQueue;
  nsCOMPtr<nsIThreadPool> mThreadPool;
  bool mPostedRunInStableState;
  // True when a forced shutdown has been completed; the GraphManager thread
  // is no longer running.
  bool mForcedShutDownComplete;
};

/**
 * A stream of synchronized audio and video data. All (not blocked) streams
 * progress at the same rate --- "real time". Streams cannot seek. The only
 * operation readers can perform on a stream is to read the next data.
 *
 * Consumers of a stream can be reading from it at different offsets, but that
 * should only happen due to the order in which consumers are being run.
 * Those offsets must not diverge in the long term, otherwise we would require
 * unbounded buffering.
 *
 * Streams can be in a "blocked" state. While blocked, a stream does not
 * produce data. A stream can be explicitly blocked via the control API,
 * or implicitly blocked by whatever's generating it (e.g. an underrun in the
 * source resource), or implicitly blocked because something consuming it
 * blocks, or implicitly because it has finished.
 *
 * A stream can be in a "finished" state. "Finished" streams are permanently
 * blocked.
 *
 * Transitions into and out of the "blocked" and "finished" states are managed
 * by the GraphManager on the media graph thread.
 *
 * We buffer media data ahead of the consumers' reading offsets. It is possible
 * to have buffered data but still be blocked.
 *
 * Any stream can have its audio and video playing when requested. The media
 * graph manager plays audio by constructing audio output streams as necessary.
 * Video is played by setting video frames into an VideoFrameContainer at the right
 * time. To ensure video plays in sync with audio, make sure that the same
 * stream is playing both the audio and video.
 *
 * Every stream conceptually has both audio and video. We fill its buffers
 * with empty AudioFrames and VideoFrames as necessary. This avoids
 * trouble with streams like chained Oggs that might switch from having no
 * audio to having audio etc. This could also happen with other sources
 * such as input devices. This is mostly managed by StreamBuffer.
 *
 * Streams are explicitly managed. The client creates them via
 * GraphManager::CreateInput/ProcessorStream, and releases them by calling
 * Destroy() when no longer needed (actual destruction will be deferred).
 * The actual object is owned by the GraphManager. The basic idea is that
 * main thread objects will keep Streams alive as long as necessary (using the
 * cycle collector to clean up whenever needed).
 *
 * We make them refcounted only so that stream-related messages with Stream*
 * pointers can be sent to the main thread safely.
 */
class Stream {
public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(Stream)

  Stream(nsDOMMediaStream* aWrapper)
    : mBufferStartTime(0)
    , mExplicitBlockerCount(0)
    , mBlocked(false)
    , mGraphUpdateIndices(0)
    , mFinished(false)
    , mAudioFinished(false)
    , mNotifiedFinished(false)
    , mAudioPlaybackStartTime(0)
    , mAudioWrittenTime(0)
    , mAudioOutputFormat(nsAudioStream::FORMAT_FLOAT32)
    , mMessageAffectedTime(0)
    , mWrapper(aWrapper)
    , mMainThreadCurrentTime(0)
    , mMainThreadFinished(false)
  {
    MOZ_COUNT_CTOR(Stream);
  }
  virtual ~Stream()
  {
    MOZ_COUNT_DTOR(Stream);
  }

  // Control API.
  // Since a stream can be played multiple ways, we need to combine independent
  // volume settings. The aKey parameter is used to keep volume settings
  // separate. Since the stream is always playing the same contents, only
  // a single audio output stream is used; the volumes are combined.
  void AddAudioOutput(void* aKey);
  void SetAudioOutputVolume(void* aKey, float aVolume);
  void RemoveAudioOutput(void* aKey);
  // Since a stream can be played multiple ways, we need to be able to
  // play to multiple VideoFrameContainers.
  void AddVideoOutput(VideoFrameContainer* aContainer);
  void RemoveVideoOutput(VideoFrameContainer* aContainer);
  // Explicitly block. Useful for example if a media element is pausing
  // and we need to stop its stream emitting its buffered data.
  void ChangeExplicitBlockerCount(PRInt32 aDelta);
  // Events will be dispatched to aThread to call methods of aListener.
  void AddListener(StreamListener* aListener);
  void RemoveListener(StreamListener* aListener);
  // Signal that the client is done with this Stream. It will be deleted later.
  void Destroy();
  PRInt64 GetCurrentTime() { return mMainThreadCurrentTime; }
  bool IsFinished() { return mMainThreadFinished; }

  friend class GraphManager;
  friend class GraphManagerImpl;

  virtual InputStream* AsInputStream() { return nsnull; }

  // media thread only
  void Init(GraphManagerImpl* aManager);
  PRInt32 GetAudioSampleRate() { return mBuffer.GetAudioSampleRate(); }
  PRInt32 GetAudioChannels() { return mBuffer.GetAudioChannels(); }
  PRInt64 StreamTimeToMediaTime(double aTime)
  {
    return PRInt64(aTime*1000000) + mBufferStartTime;
  }
  /**
   * Stop all stream activity and disconnect it from all inputs and outputs.
   * This must be idempotent.
   */
  virtual void DestroyImpl();
  PRInt64 GetBufferEndTime()
  {
    return mBufferStartTime + mBuffer.GetEnd();
  }
  void SetAudioOutputVolumeImpl(void* aKey, float aVolume);
  void AddAudioOutputImpl(void* aKey)
  {
    mAudioOutputs.AppendElement(AudioOutput(aKey));
  }
  void RemoveAudioOutputImpl(void* aKey);
  void AddVideoOutputImpl(already_AddRefed<VideoFrameContainer> aContainer)
  {
    *mVideoOutputs.AppendElement() = aContainer;
  }
  void RemoveVideoOutputImpl(VideoFrameContainer* aContainer)
  {
    mVideoOutputs.RemoveElement(aContainer);
  }
  void ChangeExplicitBlockerCountImpl(PRInt64 aTime, PRInt32 aDelta)
  {
    mExplicitBlockerCount.SetAt(aTime, mExplicitBlockerCount.GetAt(aTime) + aDelta);
  }
  void AddListenerImpl(already_AddRefed<StreamListener> aListener)
  {
    *mListeners.AppendElement() = aListener;
  }
  void RemoveListenerImpl(StreamListener* aListener)
  {
    mListeners.RemoveElement(aListener);
  }

#ifdef DEBUG
  const StreamBuffer& GetStreamBuffer() { return mBuffer; }
#endif

protected:
  virtual void AdvanceTimeVaryingValuesToCurrentTime(PRInt64 aCurrentTime, PRInt64 aBlockedTime)
  {
    mBufferStartTime += aBlockedTime;
    if (mAudioPlaybackStartTime) {
      mAudioPlaybackStartTime += aBlockedTime;
    }
    mGraphUpdateIndices.InsertTimeAtStart(aBlockedTime);
    mGraphUpdateIndices.AdvanceCurrentTime(aCurrentTime);
    mExplicitBlockerCount.AdvanceCurrentTime(aCurrentTime);

    mBuffer.ForgetContentsBefore(aCurrentTime - mBufferStartTime);
  }
  PRInt64 GetAudioPosition(GraphManagerImpl* aManager);

  // These might be best held in a subclass that only Manager knows about.
  // This state is all initialized on the main thread but
  // otherwise modified only on the media graph thread.

  PRInt64 mBufferStartTime;
  // Buffered data. The start of the buffer corresponds to mBufferStartTime.
  // Conceptually the buffer contains everything this stream has ever played,
  // but we forget some prefix of the buffer to bound the space usage.
  StreamBuffer mBuffer;

  // Client-set volume of this stream
  struct AudioOutput {
    AudioOutput(void* aKey) : mKey(aKey), mVolume(1.0f) {}
    void* mKey;
    float mVolume;
  };
  nsTArray<AudioOutput> mAudioOutputs;
  nsTArray<nsRefPtr<VideoFrameContainer> > mVideoOutputs;
  VideoFrame mLastPlayedVideoFrame;
  // The number of times this stream has been explicitly blocked by the control
  // API, minus the number of times it has been explicitly unblocked.
  TimeVarying<PRUint32> mExplicitBlockerCount;
  nsTArray<nsRefPtr<StreamListener> > mListeners;

  // Precomputed blocking status.
  TimeVarying<bool> mBlocked;
  // Maps stream-time to the graph update that affected this stream
  TimeVarying<PRInt64> mGraphUpdateIndices;

  /**
   * When true, this means the stream will be finished once all
   * buffered data has been consumed.
   */
  bool mFinished;
  /**
   * When true, means that the stream's audio will be finished once all
   * buffered audio has been consumed.
   */
  bool mAudioFinished;
  /**
   * When true, mFinished is true and we've played all the data in this stream
   * and fired NotifyFinished notifications.
   */
  bool mNotifiedFinished;

  // Where audio output is going
  nsRefPtr<nsAudioStream> mAudioOutput;
  // Base time in microseconds for the start of mAudio's playback,
  // on the media graph timeline. Add mAudioOutput->GetPosition() to find the
  // current audio playback position.
  PRInt64 mAudioPlaybackStartTime;
  // End time of the audio that has been written to the hardware. The written
  // audio can be a mix of silence (while blocking) and actual samples.
  PRInt64 mAudioWrittenTime;
  // Audio rate, number of channels and output format are fixed for
  // the lifetime of the stream, but they're not set until data is first
  // produced for the stream. When unset, they're zero.
  // The audio rate and number of channels are stored in mBuffer.
  AudioBuffer::SampleFormat mAudioOutputFormat;

  // Temporary data used by GraphManager
  // The earliest time for which we would like to change this stream's output.
  PRInt64 mMessageAffectedTime;

  // This state is only used on the main thread!
  nsDOMMediaStream* mWrapper;
  PRInt64 mMainThreadCurrentTime;
  bool mMainThreadFinished;
};

/**
 * This is a stream into which a decoder can write audio and video.
 *
 * Audio and video can be written on any thread, but you probably want to
 * always write from the same thread to avoid unexpected interleavings.
 *
 * XXX This should probably be called SourceStream.
 */
class InputStream : public Stream {
public:
  InputStream(nsDOMMediaStream* aWrapper) :
    Stream(aWrapper), mMutex("mozilla::media::InputStream"),
    mPendingFinished(false),
    mHaveEnoughAudio(false),
    mHaveEnoughVideo(false)
  {}

  virtual InputStream* AsInputStream() { return this; }

  // Call these on any thread.
  void Init(PRInt32 aAudioSampleRate, PRInt32 aAudioChannels);
  // Start or end the audio track. Initially there is no audio track.
  void SetAudioEnabled(bool aEnabled);
  // Start or end the video track. Initially there is no video track.
  void SetVideoEnabled(bool aEnabled);
  // This consumes aBuffer.
  void WriteAudio(nsTArray<AudioFrame>* aBuffer);
  // This consumes aBuffer.
  void WriteVideo(nsTArray<VideoFrame>* aBuffer);
  // Indicate that this stream should enter the "finished" state.
  void Finish();
  // Returns true if the buffer currently "enough"
  // microseconds of audio data. If it returns true, then when the buffer drops
  // below "enough", aSignalRunnable is dispatched to aSignalThread.
  // This can be used to throttle decoding. If aSignalThread or aSignalRunnable
  // are null, nothing is dispatched.
  // Note that this API can race with consumption of the stream, or even
  // Write calls.
  bool HaveEnoughBufferedAudio();
  // Ensures that aSignalRunnable will be dispatched to aSignalThread when
  // we don't have "enough" buffered audio.
  void DispatchWhenNotEnoughBufferedAudio(nsIThread* aSignalThread, nsIRunnable* aSignalRunnable);
  bool HaveEnoughBufferedVideo();
  void DispatchWhenNotEnoughBufferedVideo(nsIThread* aSignalThread, nsIRunnable* aSignalRunnable);
  // Clears the buffered data in aStream. Useful if, for example, a media
  // element seeked somewhere else or started playing a new resource. Caller
  // must take care that this does not race with WriteAudio/WriteVideo or results
  // will be unpredictable.
  // TODO
  void Reset();

  friend class GraphManager;
  friend class GraphManagerImpl;

  struct ThreadAndRunnable {
    void Init(nsIThread* aThread, nsIRunnable* aRunnable)
    {
      mThread = aThread;
      mRunnable = aRunnable;
    }

    nsCOMPtr<nsIThread> mThread;
    nsCOMPtr<nsIRunnable> mRunnable;
  };

protected:
  Mutex mMutex;
  // protected by mMutex
  StreamBuffer mPending;
  nsAutoTArray<ThreadAndRunnable,1> mDispatchWhenNotEnoughAudio;
  nsAutoTArray<ThreadAndRunnable,1> mDispatchWhenNotEnoughVideo;
  bool mPendingFinished;
  bool mHaveEnoughAudio;
  bool mHaveEnoughVideo;
};

}
}

#endif /* MOZILLA_GRAPHMANAGER_H_ */
