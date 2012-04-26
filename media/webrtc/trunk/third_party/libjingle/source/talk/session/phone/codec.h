/*
 * libjingle
 * Copyright 2004--2007, Google Inc.
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

#ifndef TALK_SESSION_PHONE_CODEC_H_
#define TALK_SESSION_PHONE_CODEC_H_

#include <map>
#include <string>

#include "talk/session/phone/constants.h"

namespace cricket {

typedef std::map<std::string, std::string> CodecParameterMap;

struct Codec {
  int id;
  std::string name;
  int clockrate;
  int preference;

  // Creates a codec with the given parameters.
  Codec(int id, const std::string& name, int clockrate, int preference)
      : id(id),
        name(name),
        clockrate(clockrate),
        preference(preference) {
  }

  // Creates an empty codec.
  Codec() : id(0), clockrate(0), preference(0) {}

  // Indicates if this codec is compatible with the specified codec.
  bool Matches(int id, const std::string& name) const;
  bool Matches(const Codec& codec) const;

  static bool Preferable(const Codec& first, const Codec& other) {
    return first.preference > other.preference;
  }

  Codec& operator=(const Codec& c) {
    this->id = c.id;  // id is reserved in objective-c
    name = c.name;
    clockrate = c.clockrate;
    preference = c.preference;
    return *this;
  }

  bool operator==(const Codec& c) const {
    return this->id == c.id &&  // id is reserved in objective-c
        name == c.name &&
        clockrate == c.clockrate &&
        preference == c.preference;
  }

  bool operator!=(const Codec& c) const {
    return !(*this == c);
  }
};

struct AudioCodec : public Codec {
  int bitrate;
  int channels;
  CodecParameterMap params;

  // Creates a codec with the given parameters.
  AudioCodec(int pt, const std::string& nm, int cr, int br, int cs, int pr)
      : Codec(pt, nm, cr, pr),
        bitrate(br),
        channels(cs) {
  }

  // Creates an empty codec.
  AudioCodec() : Codec(), bitrate(0), channels(0) {}

  // Indicates if this codec is compatible with the specified codec.
  bool Matches(int payload, const std::string& nm) const;
  bool Matches(const AudioCodec& codec) const;

  static bool Preferable(const AudioCodec& first, const AudioCodec& other) {
    return first.preference > other.preference;
  }

  std::string ToString() const;

  AudioCodec& operator=(const AudioCodec& c) {
    this->id = c.id;  // id is reserved in objective-c
    name = c.name;
    clockrate = c.clockrate;
    bitrate = c.bitrate;
    channels = c.channels;
    preference =  c.preference;
    params = c.params;
    return *this;
  }

  bool operator==(const AudioCodec& c) const {
    return this->id == c.id &&  // id is reserved in objective-c
           name == c.name &&
           clockrate == c.clockrate &&
           bitrate == c.bitrate &&
           channels == c.channels &&
           preference == c.preference &&
           params == c.params;
  }

  bool operator!=(const AudioCodec& c) const {
    return !(*this == c);
  }
};

struct VideoCodec : public Codec {
  int width;
  int height;
  int framerate;
  CodecParameterMap params;

  // Creates a codec with the given parameters.
  VideoCodec(int pt, const std::string& nm, int w, int h, int fr, int pr)
      : Codec(pt, nm, kVideoCodecClockrate, pr),
        width(w),
        height(h),
        framerate(fr) {
  }

  // Creates an empty codec.
  VideoCodec()
      : Codec(),
        width(0),
        height(0),
        framerate(0) {
    clockrate = kVideoCodecClockrate;
  }

  static bool Preferable(const VideoCodec& first, const VideoCodec& other) {
    return first.preference > other.preference;
  }

  std::string ToString() const;

  VideoCodec& operator=(const VideoCodec& c) {
    this->id = c.id;  // id is reserved in objective-c
    name = c.name;
    clockrate = c.clockrate;
    width = c.width;
    height = c.height;
    framerate = c.framerate;
    preference =  c.preference;
    params = c.params;
    return *this;
  }

  bool operator==(const VideoCodec& c) const {
    return this->id == c.id &&  // id is reserved in objective-c
           name == c.name &&
           clockrate == c.clockrate &&
           width == c.width &&
           height == c.height &&
           framerate == c.framerate &&
           preference == c.preference &&
           params == c.params;
  }

  bool operator!=(const VideoCodec& c) const {
    return !(*this == c);
  }
};

struct DataCodec : public Codec {
  DataCodec(int id, const std::string& name, int preference)
      : Codec(id, name, kDataCodecClockrate, preference) {
  }

  DataCodec() : Codec() {
    clockrate = kDataCodecClockrate;
  }

  std::string ToString() const;
};

struct VideoEncoderConfig {
  static const int kDefaultMaxThreads = -1;
  static const int kDefaultCpuProfile = -1;

  VideoEncoderConfig()
      : max_codec(),
        num_threads(kDefaultMaxThreads),
        cpu_profile(kDefaultCpuProfile) {
  }

  VideoEncoderConfig(const VideoCodec& c)
      : max_codec(c),
        num_threads(kDefaultMaxThreads),
        cpu_profile(kDefaultCpuProfile) {
  }

  VideoEncoderConfig(const VideoCodec& c, int t, int p)
      : max_codec(c),
        num_threads(t),
        cpu_profile(p) {
  }

  VideoEncoderConfig& operator=(const VideoEncoderConfig& config) {
    max_codec = config.max_codec;
    num_threads = config.num_threads;
    cpu_profile = config.cpu_profile;
    return *this;
  }

  bool operator==(const VideoEncoderConfig& config) const {
    return max_codec == config.max_codec &&
           num_threads == config.num_threads &&
           cpu_profile == config.cpu_profile;
  }

  bool operator!=(const VideoEncoderConfig& config) const {
    return !(*this == config);
  }

  VideoCodec max_codec;
  int num_threads;
  int cpu_profile;
};

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_CODEC_H_
