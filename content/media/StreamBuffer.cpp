/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "StreamBuffer.h"

using namespace mozilla::layers;

namespace mozilla {
namespace media {

static PRInt16
FlipByteOrderIfBigEndian(PRInt16 aValue)
{
  short s = aValue;
#if defined(IS_BIG_ENDIAN)
  s = ((s & 0x00ff) << 8) | ((s & 0xff00) >> 8);
#endif
  return s;
}

static float
SampleToFloat(float aValue)
{
  return aValue;
}
static float
SampleToFloat(PRUint8 aValue)
{
  return (aValue - 128)/128.0f;
}
static float
SampleToFloat(PRInt16 aValue)
{
  return FlipByteOrderIfBigEndian(aValue)/32768.0f;
}

static void
FloatToSample(float aValue, float* aOut)
{
   *aOut = aValue;
}
static void
FloatToSample(float aValue, PRUint8* aOut)
{
  PRInt32 v = PRInt32(aValue*128 + 128);
  *aOut = PRUint8(NS_MIN(v, 255));
}
static void
FloatToSample(float aValue, PRInt16* aOut)
{
  PRInt32 v = PRInt32(aValue*32768.0f);
  *aOut = FlipByteOrderIfBigEndian(PRInt16(NS_MIN(v, 32767)));
}

template <class T> static void
ConvertToFloats(AudioFrame* aFrame, PRInt32 aChannels, float* aDest)
{
  float* dest = aDest;
  AudioBuffer* buffer = aFrame->GetBuffer();
  PRInt32 duration = aFrame->GetDuration();
  for (PRInt32 i = 0; i < aChannels; ++i) {
    T* src = static_cast<T*>(buffer->GetData()) + buffer->GetLength()*i +
        aFrame->GetOffset();
    for (PRInt32 j = 0; j < duration; ++j) {
      *dest = SampleToFloat(src[j]);
      ++dest;
    }
  }
}

float*
AudioFrame::GetWritableBuffer(PRInt32 aChannels)
{
  NS_ASSERTION(!mBuffer || mBuffer->GetChannels() == aChannels,
               "Wrong number of channels");

  PRInt32 len = mDuration*aChannels*sizeof(float);
  float* buf = static_cast<float*>(moz_xmalloc(len));
  if (mBuffer) {
    switch (mBuffer->GetFormat()) {
    case nsAudioStream::FORMAT_FLOAT32:
      ConvertToFloats<float>(this, aChannels, buf);
      break;
    case nsAudioStream::FORMAT_S16_LE:
      ConvertToFloats<PRInt16>(this, aChannels, buf);
      break;
    case nsAudioStream::FORMAT_U8:
      ConvertToFloats<PRUint8>(this, aChannels, buf);
      break;
    }
  } else {
    memset(buf, 0, len);
  }
  mBuffer = new AudioBuffer(mDuration, aChannels,
                            nsAudioStream::FORMAT_FLOAT32, buf);
  mOffset = 0;
  return buf;
}

const float*
AudioFrame::GetReadableBuffer(PRInt32 aChannels, PRInt32* aChannelStride)
{
  if (mBuffer && mBuffer->GetFormat() == nsAudioStream::FORMAT_FLOAT32) {
    *aChannelStride = mBuffer->GetLength();
    return static_cast<float*>(mBuffer->GetData()) + mOffset;
  }

  *aChannelStride = mDuration;
  return GetWritableBuffer(aChannels);
}

void
StreamBufferMultiplyFloats(float* aBase, float aComputed)
{
  *aBase *= aComputed;
}

void
ApplyVolume(nsTArray<AudioFrame>* aAudio, float aVolume)
{
  for (PRUint32 i = 0; i < aAudio->Length(); ++i) {
    AudioFrame* audio = &aAudio->ElementAt(i);
    audio->SetVolume(audio->GetVolume()*aVolume);
  }
}

void
SharedAudioResampler::AppendInput(const nsTArray<AudioFrame>& aArray)
{
  MonitorAutoLock lock(mMonitor);
  if (mConfiguration.IsIdentity()) {
    mResampledLength += GetTotalFrameDuration(aArray);
    mResampled.AppendElements(aArray);
  } else {
    mNotResampled.AppendElements(aArray);
  }
}

void
SharedAudioResampler::EndInput()
{
  MonitorAutoLock lock(mMonitor);
  NS_ASSERTION(!mInputEnded, "EndInput called more than once!");
  mInputEnded = true;
}

static PRInt32
RoundDownToSeconds(PRInt64 aMicroseconds)
{
  PRInt64 seconds = aMicroseconds/1000000;
  NS_ASSERTION(seconds <= PR_INT32_MAX, "Time overflow");
  return PRInt32(seconds);
}

void
SharedAudioResampler::StartPreservingContentsAfter(PRInt64 aStart)
{
  MonitorAutoLock lock(mMonitor);
  mPreserveContentsAfter.AppendElement(RoundDownToSeconds(aStart));
}

void
SharedAudioResampler::StopPreservingContentsAfter(PRInt64 aStart)
{
  MonitorAutoLock lock(mMonitor);
  mPreserveContentsAfter.RemoveElement(RoundDownToSeconds(aStart));
}

void
SharedAudioResampler::ForgetContentsBefore(PRInt64 aStart)
{
  MonitorAutoLock lock(mMonitor);
  PRInt32 newStart = NS_MIN(RoundDownToSeconds(aStart),
                            mStart + (mResampledLength/GetOutputRate()));
  for (PRUint32 i = 0; i < mPreserveContentsAfter.Length(); ++i) {
    newStart = NS_MIN(newStart, mPreserveContentsAfter[i]);
  }
  if (newStart <= mStart)
    return;

  PRInt32 prune = newStart - mStart;
  RemoveLeadingFrames(&mResampled, prune*GetOutputRate());
  mResampledLength -= prune*GetOutputRate();
  mStart = newStart;
}

void
SharedAudioResampler::ReadOutput(PRInt64 aSampleStart, PRInt64 aSampleEnd,
                                 nsTArray<AudioFrame>* aOutput)
{
  PRInt64 sampleStart = aSampleStart;
  PRInt64 sampleEnd = aSampleEnd;

  while (sampleStart < sampleEnd) {
    nsTArray<AudioFrame> framesToResample;
    bool inputEnded;
    {
      MonitorAutoLock lock(mMonitor);
      PRInt64 bufferStart = mStart*GetOutputRate();
      PRInt64 bufStart = sampleStart - bufferStart;
      PRInt64 bufEnd = sampleEnd - bufferStart;
      NS_ASSERTION(bufStart >= 0, "Already forgotten requested data; caller should have prevented this");
      if (mConfiguration.IsIdentity()) {
        NS_ASSERTION(bufEnd <= mResampledLength,
                     "Shouldn't be trying to read beyond end of input");
      }

      if (bufStart < mResampledLength) {
        PRInt32 end = PRInt32(NS_MIN<PRInt64>(bufEnd, mResampledLength));
        SliceFramesTo(mResampled, PRInt32(bufStart), end, aOutput);
        sampleStart = end + bufferStart;
        continue;
      }

      if (mResampling) {
        lock.Wait();
        continue;
      }

      framesToResample.SwapElements(mNotResampled);
      inputEnded = mInputEnded;
      mResampling = true;
    }

    nsTArray<AudioFrame> output;
    mResampler->Process(&framesToResample, &output);
    if (inputEnded) {
      mResampler->Drain(&output);
    }

    {
      MonitorAutoLock lock(mMonitor);
      mResampledLength += GetTotalFrameDuration(output);
      mResampled.MoveElementsFrom(output);
      mResampling = false;
      lock.NotifyAll();
    }
  }
}

void
StreamBuffer::SetAudioEnabled(bool aEnabled)
{
  PRInt64 samples = mAudioLength + PRInt64(mStart)*mAudioSampleRate;
  mAudioEnabled.SetAt(samples, aEnabled);
}

void
StreamBuffer::SetVideoEnabled(bool aEnabled)
{
  PRInt64 time = mVideoLength + PRInt64(mStart)*1000000;
  mVideoEnabled.SetAt(time, aEnabled);
}

void
StreamBuffer::AppendAudio(nsTArray<AudioFrame>* aAudio)
{
#ifdef DEBUG
  for (PRUint32 i = 0; i < aAudio->Length(); ++i) {
    AudioFrame* frame = &aAudio->ElementAt(i);
    NS_ASSERTION(!frame->GetBuffer() ||
                 frame->GetBuffer()->GetChannels() == mAudioChannels,
                 "Wrong number of channels");
    NS_ASSERTION(!frame->GetBuffer() || mAudioEnabled.GetLast(),
                 "Audio must be enabled if we're playing non-silence");
  }
#endif
  AppendAudioInternal(aAudio);
}

void
StreamBuffer::AppendAudioInternal(nsTArray<AudioFrame>* aAudio)
{
  for (PRUint32 i = 0; i < mResamplers.Length(); ++i) {
    mResamplers[i]->AppendInput(*aAudio);
  }

  mAudioLength += GetTotalFrameDuration(*aAudio);
  // Move audio frames over, merging frames with the same buffer as needed. This avoids
  // frame processing. The input array may have frames for the same buffer
  // due to various processing, so check every frame for
  // merge opportunities.
  for (PRUint32 i = 0; i < aAudio->Length(); ++i) {
    AudioFrame* frame = &aAudio->ElementAt(i);
    if (!mAudio.IsEmpty()) {
      AudioFrame* last = &mAudio[mAudio.Length() - 1];
      if (last->GetBuffer() == frame->GetBuffer() &&
          last->GetVolume() == frame->GetVolume() &&
          last->GetOffset() + last->GetDuration() == frame->GetOffset()) {
        last->SetDuration(last->GetDuration() + frame->GetDuration());
        continue;
      }
    }
    mAudio.AppendElement()->TakeFrom(frame);
  }
  aAudio->Clear();
}

void
StreamBuffer::AppendVideo(nsTArray<VideoFrame>* aVideo)
{
#ifdef DEBUG
  for (PRUint32 i = 0; i < aVideo->Length(); ++i) {
    VideoFrame* frame = &aVideo->ElementAt(i);
    NS_ASSERTION(!frame->GetImage() || mVideoEnabled.GetLast(),
                 "Video must be enabled if we're playing video");
  }
#endif
  AppendVideoInternal(aVideo);
}

void
StreamBuffer::AppendVideoInternal(nsTArray<VideoFrame>* aVideo)
{
  mVideoLength += GetTotalFrameDuration(*aVideo);
  // Move video frames over, merging duplicate frames as needed. This avoids
  // unnecessary wakeups and frame processing. The input array may have
  // duplicate frames due to various processing, so check every frame for
  // merge opportunities.
  for (PRUint32 i = 0; i < aVideo->Length(); ++i) {
    VideoFrame* frame = &aVideo->ElementAt(i);
    if (!mVideo.IsEmpty()) {
      VideoFrame* last = &mVideo[mVideo.Length() - 1];
      if (last->GetImage() == frame->GetImage() &&
          last->GetIntrinsicSize() == frame->GetIntrinsicSize()) {
        last->SetDuration(last->GetDuration() + frame->GetDuration());
        continue;
      }
    }
    mVideo.AppendElement()->TakeFrom(frame);
  }
  aVideo->Clear();
}

void
StreamBuffer::Finish()
{
  NS_ASSERTION(!mFinished, "Already finished");
  mFinished = true;
  for (PRUint32 i = 0; i < mResamplers.Length(); ++i) {
    mResamplers[i]->EndInput();
  }
}

PRInt64
StreamBuffer::GetTimeToTriggerFollowers()
{
  PRInt64 audioEnabledStart = 0;
  PRInt64 audioEnabledEnd;
  bool audioEnabled = mAudioEnabled.GetAt(audioEnabledStart, &audioEnabledEnd);
  if (!audioEnabled && audioEnabledEnd < PR_INT64_MAX) {
    audioEnabledStart = audioEnabledEnd;
    audioEnabled = mAudioEnabled.GetAt(audioEnabledStart, &audioEnabledEnd);
    NS_ASSERTION(audioEnabled, "Not-enabled must transition to enabled");
  }
  // audioEnabled is true if-and-only-if audio was ever enabled. if true,
  // audioEnabledEnd is the time it ended, in samples.

  if (audioEnabled) {
    // If there was an audio track that has ended, we can trigger followers when
    // it ended.
    if (audioEnabledEnd < PR_INT64_MAX) {
      return SampleToUSecRoundDown(mAudioSampleRate, audioEnabledEnd);
    }
    // Otherwise the first audio track hasn't ended, so followers can't be triggered.
    return PR_INT64_MAX;
  }
  // Otherwise this stream has never had an audio track.

  PRInt64 videoEnabledStart = 0;
  PRInt64 videoEnabledEnd;
  bool videoEnabled = mVideoEnabled.GetAt(videoEnabledStart, &videoEnabledEnd);
  if (!videoEnabled && videoEnabledEnd < PR_INT64_MAX) {
    videoEnabledStart = videoEnabledEnd;
    videoEnabled = mVideoEnabled.GetAt(videoEnabledStart, &videoEnabledEnd);
    NS_ASSERTION(videoEnabled, "Not-enabled must transition to enabled");
  }
  // videoEnabled is true if-and-only-if video was ever enabled. if true,
  // videoEnabledEnd is the time it ended, in samples.

  if (videoEnabled) {
    // If there was an video track that has ended, we can trigger followers when
    // it ended. Otherwise the first video track hasn't ended, so we can't
    // trigger followers.
    return videoEnabledEnd;
  }

  // This stream has never had any tracks, so we can't trigger followers yet.
  return PR_INT64_MAX;
}

void
StreamBuffer::AppendAndConsumeBuffer(StreamBuffer* aBuffer)
{
  NS_ASSERTION(aBuffer->mStart == 0, "Data has been forgotten!");
  NS_ASSERTION(aBuffer->mAudioChannels == mAudioChannels, "Channel mismatch");
  NS_ASSERTION(aBuffer->mAudioSampleRate == mAudioSampleRate, "Sample rate mismatch");
  NS_ASSERTION(aBuffer->mResamplers.IsEmpty(), "Resampling the buffer we're about to consume!");

  AppendAudioInternal(&aBuffer->mAudio);
  aBuffer->mAudioLength = 0;
  AppendVideoInternal(&aBuffer->mVideo);
  aBuffer->mVideoLength = 0;

  PRInt64 audioSampleBase = PRInt64(mStart)*mAudioSampleRate + mAudioLength;
  PRInt64 videoBase = PRInt64(mStart)*1000000 + mVideoLength;
  mAudioEnabled.Append(aBuffer->mAudioEnabled, audioSampleBase);
  aBuffer->mAudioEnabled.SetAt(0, aBuffer->mAudioEnabled.GetLast());
  mVideoEnabled.Append(aBuffer->mVideoEnabled, videoBase);
  aBuffer->mVideoEnabled.SetAt(0, aBuffer->mVideoEnabled.GetLast());
}

void
StreamBuffer::ForgetContentsBefore(PRInt64 aTime)
{
  // Don't forget too much! If there is some data in the buffers, keep it,
  // in particular because we want to keep hold of the last video frame.
  PRInt64 maxStart =
      NS_MAX<PRInt64>(0, GetEnd() - SampleToUSecRoundUp(mAudioSampleRate, 1));
  PRInt32 newStart = RoundDownToSeconds(NS_MIN(aTime, maxStart));
  if (newStart <= mStart)
    return;
  // Don't forget more than 1000s at a time to avoid overflows below
  PRInt32 forget = NS_MIN(newStart - mStart, 1000);

  RemoveLeadingFrames(&mAudio, forget*mAudioSampleRate);
  mAudioLength -= forget*mAudioSampleRate;
  RemoveLeadingFrames(&mVideo, forget*1000000);
  mVideoLength -= forget*1000000;
  mStart = newStart;

  for (PRUint32 i = 0; i < mResamplers.Length(); ++i) {
    mResamplers[i]->ForgetContentsBefore(GetStart());
  }
  // Don't forget anything in mAudioEnabled/mVideoEnabled, we need all of it
  // in ShouldTriggerFollowers
}

const AudioFrame*
StreamBuffer::GetAudioFrameFor(PRInt64 aTime, PRInt64* aStart)
{
  PRInt64 startSamples;
  const AudioFrame* frame = GetFrameForTime(mAudio, PRInt64(mStart)*mAudioSampleRate,
      mAudioLength, USecToSampleRoundDown(mAudioSampleRate, aTime), &startSamples);
  if (aStart) {
    *aStart = SampleToUSecRoundUp(mAudioSampleRate, startSamples);
  }
  return frame;
}

const VideoFrame*
StreamBuffer::GetVideoFrameFor(PRInt64 aTime, PRInt64* aStart)
{
  return GetFrameForTime(mVideo, GetStart(), mVideoLength, aTime, aStart);
}

void
StreamBuffer::GetVideoFrames(PRInt64 aStart, PRInt64 aEnd,
                             nsTArray<VideoFrame>* aOutput)
{
  NS_ASSERTION(aStart >= GetStart(), "Data already forgotten!");
  NS_ASSERTION(aStart <= aEnd, "Bad interval");

  PRInt32 start = PRInt32(NS_MIN<PRInt64>(PR_INT32_MAX, aStart - GetStart()));
  PRInt32 end = PRInt32(NS_MIN<PRInt64>(PR_INT32_MAX, aEnd - GetStart()));
  SliceFramesTo(mVideo, start, end, aOutput);
}

Image*
StreamBuffer::GetLastVideoImage()
{
  return mVideo.IsEmpty() ? nsnull : mVideo[mVideo.Length() - 1].GetImage();
}

SharedAudioResampler*
StreamBuffer::GetResampledAudio(PRInt32 aOutputRate, PRInt32 aOutputChannels)
{
  SharedAudioResampler::Configuration
    config(mAudioSampleRate, mAudioChannels, aOutputRate, aOutputChannels);

  SharedAudioResampler* resampler = nsnull;
  for (PRUint32 i = 0; i < mResamplers.Length(); ++i) {
    if (mResamplers[i]->GetConfiguration() == config) {
      resampler = mResamplers[i];
      break;
    }
  }
  if (!resampler) {
    resampler = new SharedAudioResampler(config, mStart);
    resampler->AppendInput(mAudio);
    if (mFinished) {
      resampler->EndInput();
    }
    mResamplers.AppendElement(resampler);
  }
  return resampler;
}

static PRInt32
GetFormatSize(nsAudioStream::SampleFormat aOutputFormat)
{
  switch (aOutputFormat) {
  case nsAudioStream::FORMAT_FLOAT32: return 4;
  case nsAudioStream::FORMAT_S16_LE: return 2;
  case nsAudioStream::FORMAT_U8: return 1;
  }
  NS_ERROR("Bad format");
  return 0;
}

template <class SrcT, class DestT>
static void
InterleaveAndConvertBuffer(const SrcT* aSource, PRInt32 aChannels, PRInt32 aLength,
                           PRInt32 aStride, DestT* aOutput, float aVolume)
{
  DestT* output = aOutput;
  for (PRInt32 i = 0; i < aLength; ++i) {
    for (PRInt32 channel = 0; channel < aChannels; ++channel) {
      float v = SampleToFloat(aSource[channel*aStride + i])*aVolume;
      v = NS_MAX(v, -1.0f);
      v = NS_MIN(v, 1.0f);
      FloatToSample(v, output);
      ++output;
    }
  }
}

static void
InterleaveAndConvertBuffer(const PRInt16* aSource, PRInt32 aChannels, PRInt32 aLength,
                           PRInt32 aStride, PRInt16* aOutput, float aVolume)
{
  PRInt16* output = aOutput;
  float v = NS_MIN(aVolume, 1.0f);
  v = NS_MAX(v, -1.0f);
  PRInt32 volume = PRInt32((1 << 16) * v);
  for (PRInt32 i = 0; i < aLength; ++i) {
    for (PRInt32 channel = 0; channel < aChannels; ++channel) {
      short s = aSource[channel*aStride + i];
#if defined(IS_BIG_ENDIAN)
      s = ((s & 0x00ff) << 8) | ((s & 0xff00) >> 8);
#endif
      *output = short((PRInt32(s) * volume) >> 16);
      ++output;
    }
  }
}

template <class SrcT>
static void
InterleaveAndConvertBuffer(const SrcT* aSource, PRInt32 aOutputChannels, PRInt32 aLength,
                           PRInt32 aStride, void* aOutput,
                           nsAudioStream::SampleFormat aOutputFormat, float aVolume)
{
  switch (aOutputFormat) {
  case nsAudioStream::FORMAT_FLOAT32:
    InterleaveAndConvertBuffer(aSource,
                               aOutputChannels, aLength, aStride,
                               static_cast<float*>(aOutput), aVolume);
    break;
  case nsAudioStream::FORMAT_S16_LE:
    InterleaveAndConvertBuffer(aSource,
                               aOutputChannels, aLength, aStride,
                               static_cast<PRInt16*>(aOutput), aVolume);
    break;
  case nsAudioStream::FORMAT_U8:
    InterleaveAndConvertBuffer(aSource,
                               aOutputChannels, aLength, aStride,
                               static_cast<PRUint8*>(aOutput), aVolume);
    break;
  }
}

static void
InterleaveAndConvertBuffer(const void* aSource, nsAudioStream::SampleFormat aSourceFormat,
                           PRInt32 aOutputChannels, PRInt32 aOffset, PRInt32 aLength,
                           PRInt32 aStride, void* aOutput,
                           nsAudioStream::SampleFormat aOutputFormat, float aVolume)
{
  switch (aSourceFormat) {
  case nsAudioStream::FORMAT_FLOAT32:
    InterleaveAndConvertBuffer(static_cast<const float*>(aSource) + aOffset,
                               aOutputChannels, aLength, aStride,
                               aOutput, aOutputFormat, aVolume);
    break;
  case nsAudioStream::FORMAT_S16_LE:
    InterleaveAndConvertBuffer(static_cast<const PRInt16*>(aSource) + aOffset,
                               aOutputChannels, aLength, aStride,
                               aOutput, aOutputFormat, aVolume);
    break;
  case nsAudioStream::FORMAT_U8:
    InterleaveAndConvertBuffer(static_cast<const PRUint8*>(aSource) + aOffset,
                               aOutputChannels, aLength, aStride,
                               aOutput, aOutputFormat, aVolume);
    break;
  }
}

static void
WriteAudioBuffer(AudioBuffer* aBuffer, float aVolume,
                 PRInt32 aStart, PRInt32 aEnd,
                 PRInt32 aOutputChannels, nsAudioStream::SampleFormat aOutputFormat,
                 nsAudioStream* aOutput)
{
  NS_ASSERTION(aBuffer->GetChannels() == aOutputChannels, "Wrong channels");

  nsAutoTArray<PRUint8,50000> buf;
  PRInt32 length = aEnd - aStart;
  buf.SetLength(GetFormatSize(aOutputFormat)*length*aOutputChannels);
  InterleaveAndConvertBuffer(aBuffer->GetData(), aBuffer->GetFormat(),
                             aOutputChannels, aStart, length, aBuffer->GetLength(),
                             buf.Elements(), aOutputFormat, aVolume);
  aOutput->Write(buf.Elements(), length);
}

static void
WriteSilence(PRInt32 aLength, PRInt32 aChannels,
             nsAudioStream::SampleFormat aOutputFormat, nsAudioStream* aOutput)
{
  nsAutoTArray<PRUint8,50000> buf;
  buf.SetLength(GetFormatSize(aOutputFormat)*aLength*aChannels);
  memset(buf.Elements(), 0, buf.Length());
  aOutput->Write(buf.Elements(), aLength);
}

void
WriteAudioFrames(const nsTArray<AudioFrame>& aArray, nsAudioStream* aOutput)
{
  for (PRUint32 i = 0; i < aArray.Length(); ++i) {
    const AudioFrame* audio = &aArray[i];
    if (audio->GetBuffer()) {
      WriteAudioBuffer(audio->GetBuffer(), audio->GetVolume(),
                       audio->GetOffset(), audio->GetOffset() + audio->GetDuration(),
                       aOutput->GetChannels(), aOutput->GetFormat(), aOutput);
    } else {
      WriteSilence(audio->GetDuration(), aOutput->GetChannels(), aOutput->GetFormat(), aOutput);
    }
  }
}

void
StreamBufferSlice::SetSlice(StreamBuffer* aBuffer, PRInt32 aSampleRate,
                            PRInt32 aAudioChannels,
                            PRInt64 aSampleStart, PRInt32 aSampleLength,
                            PRInt32 aVideoLength)
{
  mSampleStart = aSampleStart;
  mSampleLength = aSampleLength;
  mAudioSampleRate = aSampleRate;
  mAudioChannels = aAudioChannels;

  NS_ASSERTION(aSampleLength > 0, "Empty slice?");
  NS_ASSERTION(aSampleStart >= 0,
               "Requested audio is before start of buffer");
  NS_ASSERTION(aSampleStart + aSampleLength <= USecToSampleRoundDown(mAudioSampleRate, aBuffer->GetEnd()),
               "Insufficient audio in buffer");
  mAudio = aBuffer->GetResampledAudio(aSampleRate, aAudioChannels);
  mAudio->StartPreservingContentsAfter(SampleToUSecRoundDown(mAudioSampleRate, mSampleStart));
  // Make sure we grab at least as much video as needed
  PRInt64 videoStartTime = SampleToUSecRoundDown(mAudioSampleRate, mSampleStart);
  aBuffer->GetVideoFrames(videoStartTime, videoStartTime + aVideoLength, &mVideo);
  NS_ASSERTION(GetTotalFrameDuration(mVideo) == aVideoLength,
               "Wrong duration of video");
}

StreamBufferSlice::~StreamBufferSlice()
{
  if (mAudio) {
    mAudio->StopPreservingContentsAfter(SampleToUSecRoundDown(mAudioSampleRate, mSampleStart));
  }
}

}
}
