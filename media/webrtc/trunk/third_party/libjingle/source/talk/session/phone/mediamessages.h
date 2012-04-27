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

struct StreamParams;

// A collection of audio and video and data streams. Most of the
// methods are merely for convenience. Many of these methods are keyed
// by ssrc, which is the source identifier in the RTP spec
// (http://tools.ietf.org/html/rfc3550).
struct MediaStreams {
 public:
  MediaStreams() {}
  void CopyFrom(const MediaStreams& sources);

  bool empty() const {
    return audio_.empty() && video_.empty() && data_.empty();
  }

  std::vector<StreamParams>* mutable_audio() { return &audio_; }
  std::vector<StreamParams>* mutable_video() { return &video_; }
  std::vector<StreamParams>* mutable_data() { return &data_; }
  const std::vector<StreamParams>& audio() const { return audio_; }
  const std::vector<StreamParams>& video() const { return video_; }
  const std::vector<StreamParams>& data() const { return data_; }

  // Remove the streams with the given name.  Names are only unique to
  // nicks, so you need the nick as well.
  bool GetAudioStreamByNickAndName(
      const std::string& nick, const std::string& name, StreamParams* source);
  bool GetVideoStreamByNickAndName(
      const std::string& nick, const std::string& name, StreamParams* source);
  bool GetDataStreamByNickAndName(
      const std::string& nick, const std::string& name, StreamParams* source);
  // Get the source with the given ssrc.  Returns true if found.
  bool GetAudioStreamBySsrc(uint32 ssrc, StreamParams* source);
  bool GetVideoStreamBySsrc(uint32 ssrc, StreamParams* source);
  bool GetDataStreamBySsrc(uint32 ssrc, StreamParams* source);
  // Add a source.
  void AddAudioStream(const StreamParams& source);
  void AddVideoStream(const StreamParams& source);
  void AddDataStream(const StreamParams& source);
  // Remove the source with the given name.  Names are only unique to
  // nicks, so you need the nick as well.
  void RemoveAudioStreamByNickAndName(const std::string& nick,
                                      const std::string& name);
  void RemoveVideoStreamByNickAndName(const std::string& nick,
                                      const std::string& name);
  void RemoveDataStreamByNickAndName(const std::string& nick,
                                      const std::string& name);

 private:
  std::vector<StreamParams> audio_;
  std::vector<StreamParams> video_;
  std::vector<StreamParams> data_;

  DISALLOW_COPY_AND_ASSIGN(MediaStreams);
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

// Represents a whole view request message, which contains many views.
struct ViewRequest {
  StaticVideoViews static_video_views;
};

// If the parent element (usually <jingle>) is a jingle view.
bool IsJingleViewRequest(const buzz::XmlElement* action_elem);

// Parses a view request from the parent element (usually
// <jingle>). If it fails, it returns false and fills an error
// message.
bool ParseJingleViewRequest(const buzz::XmlElement* action_elem,
                            ViewRequest* view_request,
                            ParseError* error);

// Serializes a view request to XML.  If it fails, returns false and
// fills in an error message.
bool WriteJingleViewRequest(const std::string& content_name,
                            const ViewRequest& view,
                            XmlElements* elems,
                            WriteError* error);

// TODO: Get rid of legacy source notify and replace with
// description-info as soon as reflector is capable of sending it.
bool IsSourcesNotify(const buzz::XmlElement* action_elem);

// If the given elem has <streams>.
bool HasJingleStreams(const buzz::XmlElement* desc_elem);

// Parses streams from a jingle <description>.  If it fails, returns
// false and fills an error message.
bool ParseJingleStreams(const buzz::XmlElement* desc_elem,
                        std::vector<StreamParams>* streams,
                        ParseError* error);

// Write a <streams> element to the parent_elem.
void WriteJingleStreams(const std::vector<StreamParams>& streams,
                        buzz::XmlElement* parent_elem);

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_MEDIAMESSAGES_H_
