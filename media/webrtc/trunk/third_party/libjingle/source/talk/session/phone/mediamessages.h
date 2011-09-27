/*
 * libjingle
 * Copyright 2010, Google Inc.
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

/*
 * A collection of functions and types for serializing and
 * deserializing Jingle session messages related to media.
 * Specificially, the <notify> and <view> messages.  They are not yet
 * standardized, but their current documentation can be found at:
 * goto/jinglemuc
 */

#ifndef TALK_SESSION_PHONE_MEDIAMESSAGES_H_
#define TALK_SESSION_PHONE_MEDIAMESSAGES_H_

#include <string>
#include <vector>

#include "talk/base/basictypes.h"
#include "talk/p2p/base/parsing.h"
#include "talk/p2p/base/sessiondescription.h"

namespace cricket {

// In a <notify> message, there are number of sources with names.
// This represents one such named source.
struct NamedSource {
  NamedSource() : ssrc(0), ssrc_set(false), removed(false) {}

  void SetSsrc(uint32 ssrc) {
    this->ssrc = ssrc;
    this->ssrc_set = true;
  }

  std::string nick;
  std::string name;
  std::string usage;
  uint32 ssrc;
  bool ssrc_set;
  bool removed;
};

// TODO: Remove this, according to c++ readability.
typedef std::vector<NamedSource> NamedSources;

// A collection of named audio sources and named video sources, as
// would be found in a typical <notify> message.  Most of the methods
// are merely for convenience. Many of these methods are keyed by
// ssrc, which is the source identifier in the RTP spec
// (http://tools.ietf.org/html/rfc3550).
struct MediaSources {
 public:
  MediaSources() {}
  void CopyFrom(const MediaSources& sources);

  NamedSources* mutable_audio() { return &audio_; }
  NamedSources* mutable_video() { return &video_; }
  const NamedSources& audio() const { return audio_; }
  const NamedSources& video() const { return video_; }

  // Get the source with the given ssrc.  Returns true if found.
  bool GetAudioSourceBySsrc(uint32 ssrc, NamedSource* source);
  bool GetVideoSourceBySsrc(uint32 ssrc, NamedSource* source);
  // Get the first source with the given nick.  Returns true if found.
  // TODO: Remove the following two methods once all
  // senders use explicit-remove by ssrc.
  bool GetFirstAudioSourceByNick(const std::string& nick, NamedSource* source);
  bool GetFirstVideoSourceByNick(const std::string& nick, NamedSource* source);
  // Add a source.
  void AddAudioSource(const NamedSource& source);
  void AddVideoSource(const NamedSource& source);
  // Remove the source with the given ssrc.
  void RemoveAudioSourceBySsrc(uint32 ssrc);
  void RemoveVideoSourceBySsrc(uint32 ssrc);

 private:
  NamedSources audio_;
  NamedSources video_;

  DISALLOW_COPY_AND_ASSIGN(MediaSources);
};

// In a <view> message, there are a number of views specified.  This
// represents one such view.  We currently only support "static"
// views.
struct StaticVideoView {
  StaticVideoView(uint32 ssrc, int width, int height, int framerate)
      : ssrc(ssrc),
        width(width),
        height(height),
        framerate(framerate),
        preference(0) {}

  uint32 ssrc;
  int width;
  int height;
  int framerate;
  int preference;
};

typedef std::vector<StaticVideoView> StaticVideoViews;

// Represents a whole <view> message, which contains many views.
struct ViewRequest {
  StaticVideoViews static_video_views;
};

// Serializes a view request to XML.  If it fails, returns false and
// fills in an error message.
bool WriteViewRequest(const std::string& content_name,
                      const ViewRequest& view,
                      XmlElements* elems,
                      WriteError* error);

bool IsSourcesNotify(const buzz::XmlElement* action_elem);

// Parses a notify message from XML.  If it fails, returns false and
// fills in an error message.
// The session_description is needed to map content_name => media type.
bool ParseSourcesNotify(const buzz::XmlElement* action_elem,
                        const SessionDescription* session_description,
                        MediaSources* sources,
                        ParseError* error);

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_MEDIAMESSAGES_H_
