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
 * Documentation is in mediamessages.h.
 */

#include "talk/session/phone/mediamessages.h"

#include "talk/base/logging.h"
#include "talk/base/stringencode.h"
#include "talk/p2p/base/constants.h"
#include "talk/p2p/base/parsing.h"
#include "talk/session/phone/mediasessionclient.h"
#include "talk/session/phone/streamparams.h"
#include "talk/xmllite/xmlelement.h"

namespace cricket {

namespace {

bool GetFirstSourceByNick(const NamedSources& sources,
                          const std::string& nick,
                          NamedSource* source_out) {
  for (NamedSources::const_iterator source = sources.begin();
       source != sources.end(); ++source) {
    if (source->nick == nick) {
      *source_out = *source;
      return true;
    }
  }
  return false;
}

bool GetSourceBySsrc(const NamedSources& sources, uint32 ssrc,
                     NamedSource* source_out) {
  for (NamedSources::const_iterator source = sources.begin();
       source != sources.end(); ++source) {
    if (source->ssrc == ssrc) {
      *source_out = *source;
      return true;
    }
  }
  return false;
}

// NOTE: There is no check here for duplicate sources, so check before
// adding.
void AddSource(NamedSources* sources, const NamedSource& source) {
  sources->push_back(source);
}

void RemoveSourceBySsrc(uint32 ssrc, NamedSources* sources) {
  for (NamedSources::iterator source = sources->begin();
       source != sources->end(); ) {
    if (source->ssrc == ssrc) {
      source = sources->erase(source);
    } else {
      ++source;
    }
  }
}

bool ParseSsrc(const std::string& string, uint32* ssrc) {
  return talk_base::FromString(string, ssrc);
}

bool ParseSsrc(const buzz::XmlElement* element, uint32* ssrc) {
  if (element == NULL) {
    return false;
  }
  return ParseSsrc(element->BodyText(), ssrc);
}

bool ParseNamedSource(const buzz::XmlElement* source_elem,
                      NamedSource* named_source,
                      ParseError* error) {
  named_source->nick = source_elem->Attr(QN_NICK);
  if (named_source->nick.empty()) {
    return BadParse("Missing or invalid nick.", error);
  }

  named_source->name = source_elem->Attr(QN_NAME);

  const buzz::XmlElement* ssrc_elem =
      source_elem->FirstNamed(QN_JINGLE_DRAFT_SSRC);
  if (ssrc_elem != NULL && !ssrc_elem->BodyText().empty()) {
    uint32 ssrc;
    if (!ParseSsrc(ssrc_elem->BodyText(), &ssrc)) {
      return BadParse("Missing or invalid ssrc.", error);
    }
    named_source->SetSsrc(ssrc);
  }

  return true;
}

// Builds a <view> element according to the following spec:
// goto/jinglemuc
buzz::XmlElement* CreateViewElem(const std::string& name,
                                 const std::string& type) {
  buzz::XmlElement* view_elem =
      new buzz::XmlElement(QN_JINGLE_DRAFT_VIEW, true);
  view_elem->AddAttr(QN_NAME, name);
  view_elem->SetAttr(QN_TYPE, type);
  return view_elem;
}

buzz::XmlElement* CreateVideoViewElem(const std::string& content_name,
                                      const std::string& type) {
  return CreateViewElem(content_name, type);
}

buzz::XmlElement* CreateNoneVideoViewElem(const std::string& content_name) {
  return CreateVideoViewElem(content_name, STR_JINGLE_DRAFT_VIEW_TYPE_NONE);
}

buzz::XmlElement* CreateStaticVideoViewElem(const std::string& content_name,
                                            const StaticVideoView& view) {
  buzz::XmlElement* view_elem =
      CreateVideoViewElem(content_name, STR_JINGLE_DRAFT_VIEW_TYPE_STATIC);
  AddXmlAttr(view_elem, QN_SSRC, view.ssrc);

  buzz::XmlElement* params_elem = new buzz::XmlElement(QN_JINGLE_DRAFT_PARAMS);
  AddXmlAttr(params_elem, QN_WIDTH, view.width);
  AddXmlAttr(params_elem, QN_HEIGHT, view.height);
  AddXmlAttr(params_elem, QN_FRAMERATE, view.framerate);
  AddXmlAttr(params_elem, QN_PREFERENCE, view.preference);
  view_elem->AddElement(params_elem);

  return view_elem;
}

}  //  namespace

bool MediaSources::GetFirstAudioSourceByNick(
    const std::string& nick, NamedSource* source) {
  return GetFirstSourceByNick(audio_, nick, source);
}

bool MediaSources::GetFirstVideoSourceByNick(
    const std::string& nick, NamedSource* source) {
  return GetFirstSourceByNick(video_, nick, source);
}

void MediaSources::CopyFrom(const MediaSources& sources) {
  audio_ = sources.audio_;
  video_ = sources.video_;
}

bool MediaSources::GetAudioSourceBySsrc(uint32 ssrc, NamedSource* source) {
  return GetSourceBySsrc(audio_, ssrc, source);
}

bool MediaSources::GetVideoSourceBySsrc(uint32 ssrc, NamedSource* source) {
  return GetSourceBySsrc(video_, ssrc, source);
}

void MediaSources::AddAudioSource(const NamedSource& source) {
  AddSource(&audio_, source);
}

void MediaSources::AddVideoSource(const NamedSource& source) {
  AddSource(&video_, source);
}

void MediaSources::RemoveAudioSourceBySsrc(uint32 ssrc) {
  RemoveSourceBySsrc(ssrc, &audio_);
}

void MediaSources::RemoveVideoSourceBySsrc(uint32 ssrc) {
  RemoveSourceBySsrc(ssrc, &video_);
}

bool IsJingleViewRequest(const XmlElements& action_elems) {
  return GetXmlElement(action_elems, QN_JINGLE_DRAFT_VIEW) != NULL;
}

bool ParseStaticVideoView(const buzz::XmlElement* view_elem,
                          StaticVideoView* view,
                          ParseError* error) {
  if (!ParseSsrc(view_elem->Attr(QN_SSRC), &(view->ssrc))) {
    return BadParse("Invalid or missing view ssrc.", error);
  }

  const buzz::XmlElement* params_elem =
      view_elem->FirstNamed(QN_JINGLE_DRAFT_PARAMS);
  if (params_elem) {
    view->width = GetXmlAttr(params_elem, QN_WIDTH, 0);
    view->height = GetXmlAttr(params_elem, QN_HEIGHT, 0);
    view->framerate = GetXmlAttr(params_elem, QN_FRAMERATE, 0);
    view->preference = GetXmlAttr(params_elem, QN_PREFERENCE, 0);
  } else {
    return BadParse("Missing view params.", error);
  }

  return true;
}

bool ParseJingleViewRequest(const XmlElements& action_elems,
                            ViewRequest* view_request,
                            ParseError* error) {
  for (XmlElements::const_iterator iter = action_elems.begin();
       iter != action_elems.end(); ++iter) {
    const buzz::XmlElement* view_elem = *iter;
    if (view_elem->Name() == QN_JINGLE_DRAFT_VIEW) {
      std::string type = view_elem->Attr(QN_TYPE);
      if (STR_JINGLE_DRAFT_VIEW_TYPE_NONE == type) {
        view_request->static_video_views.clear();
        return true;
      } else if (STR_JINGLE_DRAFT_VIEW_TYPE_STATIC == type) {
        StaticVideoView static_video_view(0, 0, 0, 0);
        if (!ParseStaticVideoView(view_elem, &static_video_view, error)) {
          return false;
        }
        view_request->static_video_views.push_back(static_video_view);
      } else {
        LOG(LS_INFO) << "Ingnoring unknown view type: " << type;
      }
    }
  }
  return true;
}

bool WriteJingleViewRequest(const std::string& content_name,
                            const ViewRequest& request,
                            XmlElements* elems,
                            WriteError* error) {
  if (request.static_video_views.empty()) {
    elems->push_back(CreateNoneVideoViewElem(content_name));
  } else {
    for (StaticVideoViews::const_iterator view =
             request.static_video_views.begin();
         view != request.static_video_views.end(); ++view) {
      elems->push_back(CreateStaticVideoViewElem(content_name, *view));
    }
  }
  return true;
}

bool IsSourcesNotify(const buzz::XmlElement* action_elem) {
  return action_elem->FirstNamed(QN_JINGLE_LEGACY_NOTIFY) != NULL;
}

bool ParseSourcesNotify(const buzz::XmlElement* action_elem,
                        const SessionDescription* session_description,
                        MediaSources* sources,
                        ParseError* error) {
  for (const buzz::XmlElement* notify_elem =
           action_elem->FirstNamed(QN_JINGLE_LEGACY_NOTIFY);
       notify_elem != NULL;
       notify_elem = notify_elem->NextNamed(QN_JINGLE_LEGACY_NOTIFY)) {
    std::string content_name = notify_elem->Attr(QN_NAME);
    for (const buzz::XmlElement* source_elem =
             notify_elem->FirstNamed(QN_JINGLE_LEGACY_SOURCE);
         source_elem != NULL;
         source_elem = source_elem->NextNamed(QN_JINGLE_LEGACY_SOURCE)) {
      NamedSource named_source;
      if (!ParseNamedSource(source_elem, &named_source, error)) {
        return false;
      }

      if (session_description == NULL) {
        return BadParse("Unknown content name: " + content_name, error);
      }
      const ContentInfo* content =
          FindContentInfoByName(session_description->contents(), content_name);
      if (content == NULL) {
        return BadParse("Unknown content name: " + content_name, error);
      }

      if (IsAudioContent(content)) {
        sources->mutable_audio()->push_back(named_source);
      } else if (IsVideoContent(content)) {
        sources->mutable_video()->push_back(named_source);
      }
    }
  }

  return true;
}

bool ParseSsrcAsLegacyStream(const buzz::XmlElement* desc_elem,
                             std::vector<StreamParams>* streams,
                             ParseError* error) {
  const std::string ssrc_str = desc_elem->Attr(QN_SSRC);
  if (!ssrc_str.empty()) {
    uint32 ssrc;
    if (!ParseSsrc(ssrc_str, &ssrc)) {
      return BadParse("Missing or invalid ssrc.", error);
    }

    streams->push_back(StreamParams::CreateLegacy(ssrc));
  }
  return true;
}

bool ParseSsrcs(const buzz::XmlElement* parent_elem,
                std::vector<uint32>* ssrcs,
                ParseError* error) {
  for (const buzz::XmlElement* ssrc_elem =
           parent_elem->FirstNamed(QN_JINGLE_DRAFT_SSRC);
       ssrc_elem != NULL;
       ssrc_elem = ssrc_elem->NextNamed(QN_JINGLE_DRAFT_SSRC)) {
    uint32 ssrc;
    if (!ParseSsrc(ssrc_elem->BodyText(), &ssrc)) {
      return BadParse("Missing or invalid ssrc.", error);
    }

    ssrcs->push_back(ssrc);
  }
  return true;
}

bool ParseSsrcGroups(const buzz::XmlElement* parent_elem,
                     std::vector<SsrcGroup>* ssrc_groups,
                     ParseError* error) {
  for (const buzz::XmlElement* group_elem =
           parent_elem->FirstNamed(QN_JINGLE_DRAFT_SSRC_GROUP);
       group_elem != NULL;
       group_elem = group_elem->NextNamed(QN_JINGLE_DRAFT_SSRC_GROUP)) {
    std::string semantics = group_elem->Attr(QN_SEMANTICS);
    std::vector<uint32> ssrcs;
    if (!ParseSsrcs(group_elem, &ssrcs, error)) {
      return false;
    }
    ssrc_groups->push_back(SsrcGroup(semantics, ssrcs));
  }
  return true;
}

bool ParseJingleStream(const buzz::XmlElement* stream_elem,
                       std::vector<StreamParams>* streams,
                       ParseError* error) {
  StreamParams stream;
  stream.nick = stream_elem->Attr(QN_NICK);
  stream.name = stream_elem->Attr(QN_NAME);
  stream.type = stream_elem->Attr(QN_TYPE);
  stream.display = stream_elem->Attr(QN_DISPLAY);
  stream.cname = stream_elem->Attr(QN_CNAME);
  if (!ParseSsrcs(stream_elem, &(stream.ssrcs), error)) {
    return false;
  }
  std::vector<SsrcGroup> ssrc_groups;
  if (!ParseSsrcGroups(stream_elem, &(stream.ssrc_groups), error)) {
    return false;
  }
  streams->push_back(stream);
  return true;
}

bool HasJingleStreams(const buzz::XmlElement* desc_elem) {
  const buzz::XmlElement* streams_elem =
      desc_elem->FirstNamed(QN_JINGLE_DRAFT_STREAMS);
  return (streams_elem != NULL);
}

bool ParseJingleStreams(const buzz::XmlElement* desc_elem,
                        std::vector<StreamParams>* streams,
                        ParseError* error) {
  const buzz::XmlElement* streams_elem =
      desc_elem->FirstNamed(QN_JINGLE_DRAFT_STREAMS);
  if (streams_elem == NULL) {
    return BadParse("Missing streams element.", error);
  }
  for (const buzz::XmlElement* stream_elem =
           streams_elem->FirstNamed(QN_JINGLE_DRAFT_STREAM);
       stream_elem != NULL;
       stream_elem = stream_elem->NextNamed(QN_JINGLE_DRAFT_STREAM)) {
    if (!ParseJingleStream(stream_elem, streams, error)) {
      return false;
    }
  }
  return true;
}

void WriteSsrcs(const std::vector<uint32>& ssrcs,
                buzz::XmlElement* parent_elem) {
  for (std::vector<uint32>::const_iterator ssrc = ssrcs.begin();
       ssrc != ssrcs.end(); ++ssrc) {
    buzz::XmlElement* ssrc_elem =
        new buzz::XmlElement(QN_JINGLE_DRAFT_SSRC, false);
    SetXmlBody(ssrc_elem, *ssrc);

    parent_elem->AddElement(ssrc_elem);
  }
}

void WriteSsrcGroups(const std::vector<SsrcGroup>& groups,
                     buzz::XmlElement* parent_elem) {
  for (std::vector<SsrcGroup>::const_iterator group = groups.begin();
       group != groups.end(); ++group) {
    buzz::XmlElement* group_elem =
        new buzz::XmlElement(QN_JINGLE_DRAFT_SSRC_GROUP, false);
    AddXmlAttrIfNonEmpty(group_elem, QN_SEMANTICS, group->semantics);
    WriteSsrcs(group->ssrcs, group_elem);

    parent_elem->AddElement(group_elem);
  }
}

void WriteJingleStream(const StreamParams& stream,
                       buzz::XmlElement* parent_elem) {
  buzz::XmlElement* stream_elem =
      new buzz::XmlElement(QN_JINGLE_DRAFT_STREAM, false);
  AddXmlAttrIfNonEmpty(stream_elem, QN_NICK, stream.nick);
  AddXmlAttrIfNonEmpty(stream_elem, QN_NAME, stream.name);
  AddXmlAttrIfNonEmpty(stream_elem, QN_TYPE, stream.type);
  AddXmlAttrIfNonEmpty(stream_elem, QN_DISPLAY, stream.display);
  AddXmlAttrIfNonEmpty(stream_elem, QN_CNAME, stream.cname);
  WriteSsrcs(stream.ssrcs, stream_elem);
  WriteSsrcGroups(stream.ssrc_groups, stream_elem);

  parent_elem->AddElement(stream_elem);
}

void WriteJingleStreams(const std::vector<StreamParams>& streams,
                        buzz::XmlElement* parent_elem) {
  buzz::XmlElement* streams_elem =
      new buzz::XmlElement(QN_JINGLE_DRAFT_STREAMS, true);
  for (std::vector<StreamParams>::const_iterator stream = streams.begin();
       stream != streams.end(); ++stream) {
    WriteJingleStream(*stream, streams_elem);
  }

  parent_elem->AddElement(streams_elem);
}

}  // namespace cricket
