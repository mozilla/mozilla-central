/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MOZILLA_STREAMBUFFER_H_
#define MOZILLA_STREAMBUFFER_H_

#include "ImageLayers.h"
#include "nsTArray.h"
#include "TimeVarying.h"
#include "nsISupportsImpl.h"
#include "nsAudioStream.h"
#include "mozilla/Mutex.h"
#include "mozilla/Monitor.h"

namespace mozilla {

namespace media {

enum {
  DEFAULT_AUDIO_SAMPLE_RATE = 44100,
  DEFAULT_AUDIO_CHANNELS = 2
};

/**
 * Immutable chunk of audio data.
 * The sample rate is not specified here; it is a property of the
 * StreamBuffer to which this AudioBuffer belongs.
 * The channels are non-interleaved.
 * AudioBuffers cannot be empty. Use a null AudioBuffer to represent no
 * audio.
 */
class AudioBuffer {
public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(AudioBuffer)

  typedef nsAudioStream::SampleFormat SampleFormat;

  // Takes ownership of aData (which will be freed via moz_free()).
  // aData consists of aChannels consecutive buffers, each of aLength samples.
  AudioBuffer(PRUint32 aLength, PRUint32 aChannels,
              SampleFormat aFormat, void* aData)
    : mData(aData), mLength(aLength), mChannels(aChannels),
      mFormat(aFormat)
  {
    NS_ASSERTION(aLength > 0, "Empty AudioBuffer");
    NS_ASSERTION(aChannels > 0, "AudioBuffer has no channels");
  }
  ~AudioBuffer() { moz_free(mData); }

  void* GetData() const { return mData; }
  PRUint32 GetLength() const { return mLength; }
  PRUint32 GetChannels() const { return mChannels; }
  SampleFormat GetFormat() const { return mFormat; }

private:
  void*        mData;
  PRUint32     mLength;   // Number of samples in each channel
  PRUint32     mChannels; // can be zero to indicate silence
  SampleFormat mFormat;
};

/**
 * A slice of an AudioBuffer. We use these slices so it's easy to split
 * up an audio buffer without making copies.
 *
 * If mOffset + mDuration extends past the end of mBuffer's data, the rest of the
 * audio frame is silence.
 *
 * An AudioFrame with null mBuffer is silence of the given duration.
 *
 * An AudioFrame has no specified sample rate; that is a property of the
 * StreamBuffer to which this AudioFrame belongs. All offsets and durations
 * are in number of samples.
 */
class AudioFrame {
public:
  typedef AudioBuffer::SampleFormat SampleFormat;

  explicit AudioFrame(AudioBuffer* aBuffer)
    : mBuffer(aBuffer), mOffset(0), mDuration(aBuffer->GetLength()), mVolume(1.0f) {}
  AudioFrame(AudioBuffer* aBuffer, PRInt32 aOffset, PRInt32 aDuration)
    : mBuffer(aBuffer), mOffset(aOffset), mDuration(aDuration), mVolume(1.0f)
  {
    NS_ASSERTION(!mBuffer || aDuration > 0, "AudioFrame with buffer cannot be empty");
    NS_ASSERTION(aOffset >= 0, "AudioFrame offset cannot be negative");
    NS_ASSERTION(!mBuffer || PRUint32(aOffset + aDuration) <= mBuffer->GetLength(),
                 "AudioFrame with buffer cannot extend past buffer end");
  }
  explicit AudioFrame(PRInt32 aDuration = 0)
    : mOffset(0), mDuration(aDuration), mVolume(1.0f) {}
  void SetBuffer(AudioBuffer* aBuffer)
  {
    mBuffer = aBuffer;
    mOffset = 0;
    mDuration = aBuffer->GetLength();
    mVolume = 1.0f;
  }
  PRInt32 GetDuration() const { return mDuration; }
  PRInt32 GetOffset() const { return mOffset; }
  AudioBuffer* GetBuffer() const { return mBuffer; }
  SampleFormat GetFormat() const { return mBuffer ? mBuffer->GetFormat() : nsAudioStream::FORMAT_FLOAT32; }
  float GetVolume() const { return mVolume; }
  void SetVolume(float aVolume) { mVolume = aVolume; }
  void SetDuration(PRInt32 aDuration) { mDuration = aDuration; }
  void Slice(PRInt32 aStart, PRInt32 aEnd)
  {
    NS_ASSERTION(aStart < aEnd &&
                 aStart >= 0 && aEnd <= mOffset + mDuration, "Not a slice!");
    mOffset += aStart;
    mDuration = aEnd - aStart;
  }
  // Drop the data (replaces with silence)
  void Forget() { mBuffer = nsnull; }
  // Clones the audio buffer and ensures it's an array of floats. aChannels
  // is the number of channels to put in the array if there is currently no
  // buffer. If there is a buffer, its number of channels must match aChannels.
  // The resulting buffer is always exactly aChannels*GetDuration() samples.
  float* GetWritableBuffer(PRInt32 aChannels);
  // Ensures that the audio buffer is an array of floats, and returns a pointer
  // to those floats (which may be in the interior of the underlying buffer).
  // Also returns the per-channel stride in *aChannelStride. aChannels
  // is the number of channels to put in the array if there is currently no
  // buffer. If there is a buffer, its number of channels must match aChannels.
  const float* GetReadableBuffer(PRInt32 aChannels, PRInt32* aChannelStride);
  void TakeFrom(AudioFrame* aSource)
  {
    mBuffer = aSource->mBuffer.forget();
    mOffset = aSource->mOffset;
    mDuration = aSource->mDuration;
    mVolume = aSource->mVolume;
  }

private:
  nsRefPtr<AudioBuffer> mBuffer;
  PRInt32 mOffset;   // in samples within the buffer
  PRInt32 mDuration; // in samples within the buffer
  float mVolume;     // volume multiplier to apply
};

/**
 * A video frame with a duration in microseconds.
 *
 * A VideoFrame with null mImage is "no video" of the given duration.
 */
class VideoFrame {
public:
  typedef mozilla::layers::Image Image;

  VideoFrame(Image* aImage, PRInt32 aDuration, const gfxIntSize& aIntrinsicSize)
    : mImage(aImage), mDuration(aDuration), mIntrinsicSize(aIntrinsicSize) {}
  VideoFrame(PRInt32 aDuration = 0)
    : mDuration(aDuration) {}
  PRInt32 GetDuration() const { return mDuration; }
  void SetDuration(PRInt32 aDuration) { mDuration = aDuration; }
  Image* GetImage() const { return mImage; }
  const gfxIntSize& GetIntrinsicSize() const { return mIntrinsicSize; }
  void Slice(PRInt32 aStart, PRInt32 aEnd)
  {
    NS_ASSERTION(aStart < aEnd &&
                 aStart >= 0 && aEnd <= mDuration, "Not a slice!");
    mDuration = aEnd - aStart;
  }
  // Drop the data (replaces with no video)
  void Forget() { mImage = nsnull; }
  bool ImageEquals(const VideoFrame& aOther) const
  {
    return mImage == aOther.mImage && mIntrinsicSize == aOther.mIntrinsicSize;
  }
  void TakeFrom(VideoFrame* aSource)
  {
    mImage = aSource->mImage.forget();
    mDuration = aSource->mDuration;
    mIntrinsicSize = aSource->mIntrinsicSize;
  }

private:
  // mImage can be null to indicate "no video" (aka "empty frame")
  nsRefPtr<Image> mImage;
  PRInt32 mDuration; // microseconds
  // The desired size to render the video frame at.
  gfxIntSize mIntrinsicSize;
};

template <class T> inline void
RemoveLeadingFrames(nsTArray<T>* aArray, PRInt32 aDuration)
{
  PRInt32 t = aDuration;
  PRUint32 framesToRemove = 0;
  for (PRUint32 i = 0; i < aArray->Length() && t > 0; ++i) {
    T* frame = &aArray->ElementAt(i);
    if (frame->GetDuration() > t) {
      frame->Slice(t, frame->GetDuration());
      break;
    }
    t -= frame->GetDuration();
    framesToRemove = i + 1;
  }
  aArray->RemoveElementsAt(0, framesToRemove);
}

template <class T> inline void
SliceFramesTo(const nsTArray<T>& aArray, PRInt32 aStart, PRInt32 aEnd,
              nsTArray<T>* aOutput)
{
  PRInt32 offset = 0;
  for (PRUint32 i = 0; i < aArray.Length() && offset < aEnd; ++i) {
    const T* frame = &aArray[i];
    PRInt32 start = NS_MAX(aStart, offset);
    PRInt32 nextOffset = offset + frame->GetDuration();
    PRInt32 end = NS_MIN(aEnd, nextOffset);
    if (start < end) {
      aOutput->AppendElement(*frame)->Slice(start - offset, end - offset);
    }
    offset = nextOffset;
  }
}

template <class T> inline PRInt32
GetTotalFrameDuration(const nsTArray<T>& aArray)
{
  PRInt32 sum = 0;
  for (PRUint32 i = 0; i < aArray.Length(); ++i) {
    sum += aArray[i].GetDuration();
  }
  return sum;
}

template <class T> inline const T*
GetFrameForTime(const nsTArray<T>& aArray, PRInt64 aOffset,
                PRInt64 aArrayDuration, PRInt64 aTime, PRInt64* aStart)
{
  if (aArray.IsEmpty()) {
    if (aStart) {
      *aStart = aOffset;
    }
    return nsnull;
  }
  if (aTime <= aOffset) {
    if (aStart) {
      *aStart = aOffset;
    }
    return &aArray[0];
  }
  if (aTime >= aOffset + aArrayDuration) {
    const T* frame = &aArray[aArray.Length() - 1];
    if (aStart) {
      *aStart = aArrayDuration - frame->GetDuration() + aOffset;
    }
    return frame;
  }
  PRInt64 offset = aOffset;
  for (PRUint32 i = 0; i < aArray.Length(); ++i) {
    PRInt64 nextOffset = offset + aArray[i].GetDuration();
    if (offset <= aTime && aTime < nextOffset) {
      if (aStart) {
        *aStart = offset;
      }
      return &aArray[i];
    }
    offset = nextOffset;
  }
  NS_ERROR("Should have bailed out early here");
  return nsnull;
}

void ApplyVolume(nsTArray<AudioFrame>* aArray, float aVolume);

void WriteAudioFrames(const nsTArray<AudioFrame>& aArray,
                      nsAudioStream* aOutput);

/**
 * All frames must have the same number of channels. The buffer will have the
 * same number of channels.
 */
typedef void (* CombineAudioValues)(float* aDest, float aSrc);
template <CombineAudioValues Combine>
void CombineAudioFrameSamples(float* aBuffer, PRInt32 aBufferDuration,
                              PRInt32 aChannels,
                              nsTArray<AudioFrame>& aAudio)
{
  float* buffer = aBuffer;
  for (PRUint32 i = 0; i < aAudio.Length(); ++i) {
    AudioFrame* f = &aAudio[i];
    PRInt32 duration = f->GetDuration();
    float volume = f->GetVolume();
    if (f->GetBuffer() && volume > 0.0f) {
      PRInt32 channelStride;
      const float* src = f->GetReadableBuffer(aChannels, &channelStride);
      float* dest = buffer;
      for (PRInt32 channel = 0; channel < aChannels; ++channel) {
        if (volume == 1.0f) {
          for (PRInt32 j = 0; j < duration; ++j) {
            Combine(dest + j, src[j]);
          }
        } else {
          for (PRInt32 j = 0; j < duration; ++j) {
            Combine(dest + j, src[j]*volume);
          }
        }
        src += channelStride;
        dest += aBufferDuration;
      }
    } else {
      float* dest = buffer;
      for (PRInt32 channel = 0; channel < aChannels; ++channel) {
        for (PRInt32 j = 0; j < duration; ++j) {
          Combine(dest + j, 0.0f);
        }
        dest += aBufferDuration;
      }
    }
    buffer += duration;
  }
}

/**
 * Stateful audio resampling object to convert from one sample rate +
 * channel configuration to another. The resampling process is allowed to
 * introduce latency.
 * XXX This is the worst possible implementation. We average the channels
 * to get mono, then we duplicate that across all channels with some super-dumb
 * linear-interpolation resampling. This must be replaced with something that
 * doesn't suck!
 *
 * This class must be thread-safe to the extent that it can be used by
 * different threads. The caller is responsible for ensuring it is not used
 * by multiple threads at the same time. All processing is done on the caller
 * thread.
 *
 * This class takes AudioFrame objects as inputs and outputs. On the input
 * side, this lets us accept various formats and optimize for them. On
 * the output side, this lets us output chains of small buffers instead of having
 * to (re)allocate a large buffer.
 *
 * We pretend that resampling preserves the duration of a finite input stream.
 * This means that the start of the first output sample is for the same time
 * as the start of the first input sample, and the end of the last output sample
 * is for the same time as the end of the last input sample. This will mean
 * that leading and trailing samples of the "true" resampled output stream have
 * to be discarded.
 *
 * However we do not require that an output sample be produced when the first
 * input sample is provided to the Process method! I.e., latency in producing
 * output is allowed.
 */
class AudioResampler {
public:
  struct Configuration {
    PRInt32 mInputRate;
    PRInt32 mInputChannels;
    PRInt32 mOutputRate;
    PRInt32 mOutputChannels;

    Configuration(PRInt32 aInputRate, PRInt32 aInputChannels,
                  PRInt32 aOutputRate, PRInt32 aOutputChannels)
       : mInputRate(aInputRate), mInputChannels(aInputChannels),
         mOutputRate(aOutputRate), mOutputChannels(aOutputChannels)
    {
      NS_ASSERTION(aInputRate > 0, "Bad input rate");
      NS_ASSERTION(aOutputRate > 0, "Bad output rate");
      NS_ASSERTION(aInputChannels > 0, "Bad input channels");
      NS_ASSERTION(aOutputChannels > 0, "Bad output channels");
    }
    bool IsIdentity()
    {
      return mInputRate == mOutputRate && mInputChannels == mOutputChannels;
    }
    bool operator==(const Configuration& aOther) const
    {
      return mInputRate == aOther.mInputRate && mInputChannels == aOther.mInputChannels &&
             mOutputRate == aOther.mOutputRate && mOutputChannels == aOther.mOutputChannels;
    }
  };

  AudioResampler(const Configuration& aConfiguration)
    : mConfiguration(aConfiguration)
    , mInputSampleOffset(0)
    , mOutputSampleOffset(0)
  {
    mInputSamples.AppendElement(0.0f);
  }
  // Processes some input samples, and produces some output samples. Latency
  // is allowed so no output may be produced. This consumes
  // the aInputSamples array.
  void Process(nsTArray<AudioFrame>* aInputSamples,
               nsTArray<AudioFrame>* aOutput)
  {
    for (PRUint32 i = 0; i < aInputSamples->Length(); ++i) {
      AudioFrame* frame = &aInputSamples->ElementAt(i);
      PRInt32 channelStride;
      const float* samples = frame->GetReadableBuffer(mConfiguration.mInputChannels, &channelStride);
      float* out = mInputSamples.AppendElements(frame->GetDuration());
      for (PRInt32 j = 0; j < frame->GetDuration(); ++j) {
        float r = 0;
        for (PRInt32 k = 0; k < mConfiguration.mInputChannels; ++k) {
          r += samples[channelStride*k + j];
        }
        out[j] = r/mConfiguration.mInputChannels;
      }
    }
    ConsumeInput(aOutput);
  }
  // Assuming the input has ended, extracts all remaining output.
  void Drain(nsTArray<AudioFrame>* aOutput)
  {
    PRInt64 inputEnd = mInputSampleOffset + mInputSamples.Length();
    while (mInputSampleOffset < inputEnd) {
      mInputSamples.AppendElement(0.0f);
      ConsumeInput(aOutput);
    }
  }
  PRInt32 GetInputRate() { return mConfiguration.mInputRate; }
  PRInt32 GetOutputRate() { return mConfiguration.mOutputRate; }
  /**
   * Returns the latency of this resampler, in number of output samples.
   * The samples produced will lag behind the input duration by at most this
   * much.
   */
  PRInt32 GetOutputSampleLatency() { return 1; }

  enum {
    // Always keep around at least 5ms of audio data (if available) to ensure
    // that we can resample accurately as required
    AUDIO_MIN_MS = 5
  };

protected:
  void ConsumeInput(nsTArray<AudioFrame>* aOutput)
  {
    double inputRate = mConfiguration.mInputRate;
    double outputRate = mConfiguration.mOutputRate;
    PRInt32 samplesToRemove = 0;
    nsTArray<float> outBuf;
    while (true) {
      // Compute output position in the input sample stream. Add 1 because
      // of the dummy zero sample at the start.
      double outputPosition = (mOutputSampleOffset*inputRate)/outputRate + 1.0;
      double nextSample = ceil(outputPosition);
      PRUint32 nextSampleIndex = PRUint32(nextSample - mInputSampleOffset);
      if (nextSampleIndex >= mInputSamples.Length())
        break;
      samplesToRemove = nextSampleIndex - 1;
      double frac = nextSample - outputPosition;
      double v = mInputSamples[nextSampleIndex - 1]*frac +
                 mInputSamples[nextSampleIndex]*(1.0 - frac);
      outBuf.AppendElement(float(v));
      ++mOutputSampleOffset;
    }
    if (!outBuf.IsEmpty()) {
      float* buf = static_cast<float*>
        (moz_xmalloc(sizeof(float)*outBuf.Length()*mConfiguration.mOutputChannels));
      for (PRInt32 i = 0; i < mConfiguration.mOutputChannels; ++i) {
        memcpy(buf + i*outBuf.Length(), outBuf.Elements(), sizeof(float)*outBuf.Length());
      }
      AudioBuffer* abuf = new AudioBuffer(outBuf.Length(), mConfiguration.mOutputChannels,
          nsAudioStream::FORMAT_FLOAT32, buf);
      aOutput->AppendElement(AudioFrame(abuf));
    }
    // Remove nextSampleIndex - 1 samples
    mInputSamples.RemoveElementsAt(0, samplesToRemove);
    mInputSampleOffset += samplesToRemove;
  }

  Configuration mConfiguration;
  // Number of input samples already removed from mInputSamples
  PRInt64 mInputSampleOffset;
  // Number of ouput samples already produced
  PRInt64 mOutputSampleOffset;
  nsTArray<float> mInputSamples;
};

inline PRInt64 USecToSampleRoundUp(PRInt32 aSampleRate, PRInt64 aMicroseconds)
{
  return (aMicroseconds * aSampleRate + 999999)/1000000;
}

inline PRInt64 USecToSampleRoundDown(PRInt32 aSampleRate, PRInt64 aMicroseconds)
{
  return (aMicroseconds * aSampleRate)/1000000;
}

inline PRInt64 SampleToUSecRoundUp(PRInt32 aSampleRate, PRInt64 aSamples)
{
  return (aSamples * 1000000 + aSampleRate - 1)/aSampleRate;
}

inline PRInt64 SampleToUSecRound(PRInt32 aSampleRate, PRInt64 aSamples)
{
  return (aSamples * 1000000 + aSampleRate/2)/aSampleRate;
}

inline PRInt64 SampleToUSecRoundDown(PRInt32 aSampleRate, PRInt64 aSamples)
{
  return (aSamples * 1000000)/aSampleRate;
}

/**
 * This class accepts audio input from the media graph thread and
 * lets multiple processor threads read resampled audio. The resampling
 * is done on the processor threads. Data is cached so that multiple threads
 * reading the same resampled stream can share the results of resampling.
 *
 * When the input configuration matches the output configuration, this class
 * doesn't do any sampling; it doesn't even copy the data. The input buffers
 * are moved directly to the output queue. In that case, this class still performs
 * the useful function of managing the data queue across threads.
 */
class SharedAudioResampler {
public:
  typedef AudioResampler::Configuration Configuration;

  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(SharedAudioResampler)

  SharedAudioResampler(Configuration& aConfiguration, PRInt32 aStartSeconds) :
    mMonitor("SharedAudioResampler"),
    mConfiguration(aConfiguration),
    mStart(aStartSeconds),
    mResampledLength(0),
    mResampling(false),
    mInputEnded(false)
  {
    if (!mConfiguration.IsIdentity()) {
      mResampler = new AudioResampler(mConfiguration);
    }
  }

  // All methods can be called on any thread.
  // The following methods will not block for long.
  void AppendInput(const nsTArray<AudioFrame>& aArray);
  void EndInput();
  // Times in microseconds
  void StartPreservingContentsAfter(PRInt64 aStart);
  void StopPreservingContentsAfter(PRInt64 aStart);
  void ForgetContentsBefore(PRInt64 aStart);

  // Can block for a while, while the output is processed.
  // aSampleStart/aSampleEnd are in output samples.
  void ReadOutput(PRInt64 aSampleStart, PRInt64 aSampleEnd, nsTArray<AudioFrame>* aOutput);

  PRInt32 GetOutputRate() { return mConfiguration.mOutputRate; }
  const Configuration& GetConfiguration() { return mConfiguration; }
  /**
   * Returns the latency of this resampler, in number of output samples.
   * The samples produced will lag behind the input duration by at most this
   * much.
   */
  PRInt32 GetOutputSampleLatency()
  {
    return mResampler ? mResampler->GetOutputSampleLatency() : 0;
  }

private:
  // Accessed without holding mMonitor, but with mResampling true.
  nsAutoPtr<AudioResampler> mResampler;

  // mMonitor protects the following fields.
  Monitor mMonitor;
  nsTArray<AudioFrame> mNotResampled;
  // The audio buffer consists of mResampled samples (at output sample rate),
  // followed by the internal state of mResampler, followed by mNotResampled
  // samples (at input sample rate)
  nsTArray<AudioFrame> mResampled;
  // Times in seconds
  nsTArray<PRInt32> mPreserveContentsAfter;
  Configuration mConfiguration;
  // Start of first sample in mResampled, in seconds
  PRInt32 mStart;
  // Number of output samples in mResampled
  PRInt32 mResampledLength;
  bool mResampling;
  bool mInputEnded;
};

/**
 * The decoded audio and video data for a stream. Currently just a video
 * track and an audio track, represented as lists of AudioFrames and VideoFrames
 * respectively.
 * This could be extended to carry multiple audio and video tracks.
 * All times here are in microseconds.
 *
 * A StreamBuffer can be appended to. We also have the ability to "forget"
 * data before a certain time that we know won't be used again; we always
 * prune a whole number of seconds internally.
 *
 * These objects are only used on the media-graph thread.
 */
class StreamBuffer {
public:
  typedef mozilla::layers::Image Image;

  StreamBuffer() :
    mAudioLength(0),
    mVideoLength(0),
    mAudioEnabled(false),
    mVideoEnabled(false),
    mStart(0),
    mAudioSampleRate(DEFAULT_AUDIO_SAMPLE_RATE),
    mAudioChannels(DEFAULT_AUDIO_CHANNELS),
    mFinished(false)
  {}

  void SetAudioSampleRate(PRInt32 aSampleRate)
  {
    NS_ASSERTION(mAudio.IsEmpty(), "Already have audio");
    NS_ASSERTION(aSampleRate > 0, "Sample rate must be positive");
    NS_ASSERTION(aSampleRate <= 1000000, "Sample rate too high");
    mAudioSampleRate = aSampleRate;
  }
  PRInt32 GetAudioSampleRate() { return mAudioSampleRate; }
  void SetAudioChannels(PRInt32 aChannels)
  {
    NS_ASSERTION(mAudio.IsEmpty(), "Already have audio");
    NS_ASSERTION(aChannels >= 0, "Channels must not be negative");
    mAudioChannels = aChannels;
  }
  PRInt32 GetAudioChannels() { return mAudioChannels; }

  PRInt64 GetStart() const { return PRInt64(mStart)*1000000; }
  PRInt64 GetEnd() const
  {
    return GetStart() +
        NS_MIN(mVideoLength, SampleToUSecRoundUp(mAudioSampleRate, mAudioLength));
  }
  PRInt64 GetAudioSampleEnd() const
  {
    return PRInt64(mStart)*mAudioSampleRate + mAudioLength;
  }
  PRInt64 GetAudioEnd() const
  {
    return GetStart() + SampleToUSecRoundUp(mAudioSampleRate, mAudioLength);
  }
  PRInt64 GetVideoEnd() const
  {
    return GetStart() + mVideoLength;
  }
  bool IsEmpty() const
  {
    return mStart == 0 && mAudioLength == 0 && mVideoLength == 0;
  }

  // Track which tracks are enabled. Tracks are initially disabled.
  // The enabled status of the track governs the interpretation of the
  // subsequent AppendAudio/AppendVideo calls --- e.g. whether silence means
  // "no track" or just "we have a track, but it's silent".
  void SetAudioEnabled(bool aEnabled);
  void SetVideoEnabled(bool aEnabled);
  // Appends audio or video to the internal buffers.
  // Both of these methods update the duration to the largest duration
  // that's covered by both the audio and video internal buffers.
  // These methods empty aAudio/aVideo.
  // Silence/no-video must be appended for disabled tracks.
  void AppendAudio(nsTArray<AudioFrame>* aAudio);
  void AppendVideo(nsTArray<VideoFrame>* aVideo);
  // Call this when the stream has finished. This will allow the final
  // resampled audio samples to be flushed and read by audio consumers.
  void Finish();

  PRInt64 GetTimeToTriggerFollowers();

  // Appends the contents of aBuffer to this buffer, consuming aBuffer. aBuffer
  // must match channels and audio rate. aBuffer's mStart must be zero
  // (i.e. nothing has been forgotten).
  void AppendAndConsumeBuffer(StreamBuffer* aBuffer);

  /**
   * Forget the contents of this stream before aTime; they will no longer
   * be needed.
   */
  void ForgetContentsBefore(PRInt64 aTime);

  /**
   * Return the AudioFrame whose time range covers the given aTime. If aTime
   * is less than zero, returns the first frame, and if aTime is beyond the
   * duration of this buffer, returns the last frame. Returns the start time
   * of the frame in *aStart.
   * If there are no audio frames, returns null.
   */
  const AudioFrame* GetAudioFrameFor(PRInt64 aTime, PRInt64* aStart);
  /**
   * Return the VideoFrame whose time range covers the given aTime. If aTime
   * is less than zero, returns the first frame, and if aTime is beyond the
   * duration of this buffer, returns the last frame. Returns the start time
   * of the frame in *aStart.
   * If there are no video frames, returns null.
   */
  const VideoFrame* GetVideoFrameFor(PRInt64 aTime, PRInt64* aStart);
  void GetVideoFrames(PRInt64 aStart, PRInt64 aEnd, nsTArray<VideoFrame>* aOutput);
  /**
   * Returns the image for the last video frame, or null if there isn't one.
   */
  Image* GetLastVideoImage();
  /**
   * This gets called even if the output rate and channels match this stream's.
   * Even an identity SharedAudioResampler is useful for piping data across
   * threads.
   */
  SharedAudioResampler*
  GetResampledAudio(PRInt32 aOutputRate, PRInt32 aOutputChannels);

protected:
  friend class StreamBufferSlice;

  void AppendAudioInternal(nsTArray<AudioFrame>* aAudio);
  void AppendVideoInternal(nsTArray<VideoFrame>* aVideo);

  PRInt64 mAudioLength; // samples. Sum of durations of mAudio.
  PRInt64 mVideoLength; // microseconds. Sum of durations of mVideo.
  nsTArray<AudioFrame> mAudio;
  nsTArray<VideoFrame> mVideo;
  // Which tracks are enabled.
  // Time for audio is in samples, for video in microseconds.
  TimeVarying<bool> mAudioEnabled;
  TimeVarying<bool> mVideoEnabled;
  // When we implement rewinding, rewinding will just flush out this array and create
  // all new SharedAudioResamplers.
  nsTArray<nsRefPtr<SharedAudioResampler> > mResamplers;
  // the time offset of the start of the audio/video tracks, in seconds.
  PRInt32 mStart;
  PRInt32 mAudioSampleRate;
  PRInt32 mAudioChannels;
  bool mFinished;
};

/**
 * This represents a chunk of media data that can be provided as input to
 * a processing node. Audio will be resampled to the desired rate and channel
 * configuration. Two independent volume controls are provided.
 * Should only be accessed by one thread at a time, but can be passed
 * between threads. All necessary resampling and volume application will be
 * done on the receiving thread.
 */
class StreamBufferSlice {
public:
  // aSampleStart and aSampleLength are given in output audio samples (aSampleRate)
  StreamBufferSlice()
    : mSampleStart(0)
    , mVolume(1.0f)
    , mAudioSampleRate(DEFAULT_AUDIO_SAMPLE_RATE)
    , mAudioChannels(DEFAULT_AUDIO_CHANNELS)
    , mSampleLength(0)
  {}
  ~StreamBufferSlice();

  void SetSlice(StreamBuffer* aBuffer, PRInt32 aSampleRate,
                PRInt32 aAudioChannels,
                PRInt64 aSampleStart, PRInt32 aSampleLength,
                PRInt32 aVideoLength);

  /**
   * Changes at time T in aVolume will be applied at T + aOffset.
   * aOffset is in microseconds and aVolume is by microseconds.
   */
  void SetVolume(float aVolume)
  {
    mVolume = aVolume;
  }

  // This can block while audio is resampled. This can only be called once.
  void ExtractAudioSamples(nsTArray<AudioFrame>* aOutput)
  {
    nsTArray<AudioFrame> output;
    mAudio->ReadOutput(mSampleStart, mSampleStart + mSampleLength, &output);
    ApplyVolume(&output, mVolume);
    aOutput->MoveElementsFrom(output);
  }
  // Appends all VideoFrames to aOutput. This can only be called once.
  void ExtractVideoFrames(nsTArray<VideoFrame>* aOutput)
  {
    NS_ASSERTION(!mVideo.IsEmpty(), "ExtractVideoFrames called more than once!");
    aOutput->MoveElementsFrom(mVideo);
  }

  PRInt64 GetSampleStart() const { return mSampleStart; }
  PRInt32 GetSampleLength() const { return mSampleLength; }
  PRInt32 GetAudioChannels() const { return mAudioChannels; }
  PRInt64 GetDuration() const
  {
    return SampleToUSecRoundUp(mAudioSampleRate, mSampleStart + mSampleLength) -
        SampleToUSecRoundUp(mAudioSampleRate, mSampleStart);
  }

private:
  PRInt64 mSampleStart;
  nsRefPtr<SharedAudioResampler> mAudio;
  nsTArray<VideoFrame> mVideo;
  float mVolume;
  PRInt32 mAudioSampleRate;
  PRInt32 mAudioChannels;
  PRInt32 mSampleLength;
};

}
}

#endif /* MOZILLA_STREAMBUFFER_H_ */

