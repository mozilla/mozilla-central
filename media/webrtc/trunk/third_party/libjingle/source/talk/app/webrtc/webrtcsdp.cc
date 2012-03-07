/*
 * libjingle
 * Copyright 2011, Google Inc.
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

#include "talk/app/webrtc/webrtcsdp.h"

#include <stdio.h>
#include <string>
#include <vector>

#include "talk/base/logging.h"
#include "talk/base/stringutils.h"
#include "talk/p2p/base/relayport.h"
#include "talk/p2p/base/stunport.h"
#include "talk/p2p/base/udpport.h"
#include "talk/session/phone/codec.h"
#include "talk/session/phone/cryptoparams.h"
#include "talk/session/phone/mediasession.h"
#include "talk/session/phone/mediasessionclient.h"

using cricket::AudioContentDescription;
using cricket::Candidate;
using cricket::ContentDescription;
using cricket::CryptoParams;
using cricket::MediaContentDescription;
using cricket::MediaType;
using cricket::StreamParams;
using cricket::VideoContentDescription;
using talk_base::SocketAddress;

namespace webrtc {

// Line prefix
static const int kLinePrefixLength = 2;
static const char kLinePrefixVersion[] = "v=";
static const char kLinePrefixOrigin[] = "o=";
static const char kLinePrefixSessionName[] = "s=";
static const char kLinePrefixSessionInfo[] = "i=";
static const char kLinePrefixSessionUri[] = "u=";
static const char kLinePrefixSessionEmail[] = "e=";
static const char kLinePrefixSessionPhone[] = "p=";
static const char kLinePrefixSessionConnection[] = "c=";
static const char kLinePrefixSessionBandwidth[] = "b=";
static const char kLinePrefixTiming[] = "t=";
static const char kLinePrefixRepeatTimes[] = "r=";
static const char kLinePrefixTimeZone[] = "z=";
static const char kLinePrefixEncryptionKey[] = "k=";
static const char kLinePrefixMedia[] = "m=";
static const char kLinePrefixAttributes[] = "a=";

// Attributes
static const char kAttributeMid[] = "mid:";
static const char kAttributeRtcpMux[] = "rtcp-mux";
static const char kAttributeSsrc[] = "ssrc:";
static const char kAttributeCname[] = "cname:";
static const char kAttributeMslabel[] = "mslabel:";
static const char kAttributeLabel[] = "label:";
static const char kAttributeCrypto[] = "crypto:";
static const char kAttributeCandidate[] = "candidate:";
static const char kAttributeCandidateTyp[] = "typ";
static const char kAttributeCandidateName[] = "name";
static const char kAttributeCandidateNetworkName[] = "network_name";
static const char kAttributeCandidateUsername[] = "username";
static const char kAttributeCandidatePassword[] = "password";
static const char kAttributeCandidateGeneration[] = "generation";
static const char kAttributeRtpmap[] = "rtpmap:";

// Candidate
static const char kCandidateHost[] = "host";
static const char kCandidateSrflx[] = "srflx";
// TODO: How to map the prflx with circket candidate type
// static const char kCandidatePrflx[] = "prflx";
static const char kCandidateRelay[] = "relay";

static const char kSdpDelimiter = ' ';
static const char kLineBreak[] = "\r\n";

// TODO: Generate the Session and Time description
// instead of hardcoding.
static const char kSessionVersion[] = "v=0";
static const char kSessionOrigin[] = "o=- 0 0 IN IP4 127.0.0.1";
static const char kSessionName[] = "s=";
static const char kTimeDescription[] = "t=0 0";
static const char kAttrGroup[] = "a=group:BUNDLE audio video";
static const int kIceComponent = 1;
static const int kIceFoundation = 1;
static const char kMediaTypeVideo[] = "video";
static const char kMediaTypeAudio[] = "audio";

// Default Video resolution.
// TODO: Implement negotiation of video resolution.
static const int kDefaultVideoWidth = 640;
static const int kDefaultVideoHeight = 480;
static const int kDefaultVideoFrameRate = 30;
static const int kDefaultVideoPreference = 0;

static void BuildMediaDescription(const cricket::ContentInfo& content_info,
                                  const MediaType media_type,
                                  std::string* message);
static void BuildRtpMap(const MediaContentDescription* media_desc,
                        const MediaType media_type,
                        std::string* message);
static void BuildCandidate(const std::vector<Candidate>& candidates,
                           const MediaType media_type,
                           std::string* message);

static bool ParseSessionDescription(const std::string& message, size_t* pos);
static bool ParseTimeDescription(const std::string& message, size_t* pos);
static bool ParseMediaDescription(const std::string& message, size_t* pos,
                                  cricket::SessionDescription* desc);
static bool ParseContent(const std::string& message,
                         const MediaType media_type,
                         size_t* pos,
                         ContentDescription* content);
static bool ParseCandidates(const std::string& message,
                            std::vector<Candidate>* candidates);

// Helper functions
#define LOG_PREFIX_PARSING_ERROR(line_prefix) LOG(LS_ERROR) \
    << "Failed to parse the \"" << line_prefix << "\" line";

#define LOG_LINE_PARSING_ERROR(line) LOG(LS_ERROR) \
    << "Failed to parse line:" << line;

static bool AddLine(const std::string& line, std::string* message) {
  if (!message)
    return false;

  message->append(line);
  message->append(kLineBreak);
  return true;
}

static bool GetLine(const std::string& message,
                    size_t* pos,
                    std::string* line) {
  size_t line_begin = *pos;
  size_t line_end = message.find('\n', line_begin);
  if (line_end == std::string::npos) {
    return false;
  }
  // Update the new start position
  *pos = line_end + 1;
  if (line_end > 0 && (message.at(line_end - 1) == '\r')) {
    --line_end;
  }
  *line = message.substr(line_begin, (line_end - line_begin));
  return true;
}

static bool GetLineWithPrefix(const std::string& message, size_t* pos,
                              std::string* line, const char* type) {
  if (message.compare(*pos, kLinePrefixLength, type) != 0) {
    return false;
  }

  if (!GetLine(message, pos, line))
    return false;

  return true;
}

static bool HasPrefix(const std::string& line,
                      const std::string& prefix,
                      size_t pos) {
  return (line.compare(pos, prefix.size(), prefix) == 0);
}

static bool HasPrefix(const std::string& line,
                      const std::string& prefix) {
  return HasPrefix(line, prefix, 0);
}

static bool HasAttribute(const std::string& line,
                         const std::string& attribute) {
  return (line.compare(kLinePrefixLength, attribute.size(), attribute) == 0);
}

std::string SdpSerialize(const cricket::SessionDescription& desc,
                         const std::vector<Candidate>& candidates) {
  return SdpFormat(SdpSerializeSessionDescription(desc),
                   SdpSerializeCandidates(candidates));
}

std::string SdpSerializeSessionDescription(
    const cricket::SessionDescription& desc) {
  std::string message;

  // Session Description.
  AddLine(kSessionVersion, &message);
  AddLine(kSessionOrigin, &message);
  AddLine(kSessionName, &message);

  // Time Description.
  AddLine(kTimeDescription, &message);

  const cricket::ContentInfo* audio_content = GetFirstAudioContent(&desc);
  const cricket::ContentInfo* video_content = GetFirstVideoContent(&desc);

  // Group
  if (audio_content && video_content)
    AddLine(kAttrGroup, &message);

  // Media Description
  if (audio_content) {
    BuildMediaDescription(*audio_content, cricket::MEDIA_TYPE_AUDIO, &message);
  }

  if (video_content) {
    BuildMediaDescription(*video_content, cricket::MEDIA_TYPE_VIDEO, &message);
  }

  return message;
}

std::string SdpSerializeCandidates(const std::vector<Candidate>& candidates) {
  std::string message;
  // rfc5245
  // a=candidate:<foundation> <component-id> <transport> <priority>
  // <connection-address> <port> typ <candidate-types>
  // [raddr <connection-address>] [rport <port>]
  BuildCandidate(candidates, cricket::MEDIA_TYPE_AUDIO, &message);
  BuildCandidate(candidates, cricket::MEDIA_TYPE_VIDEO, &message);
  return message;
}

std::string SdpFormat(const std::string& desc, const std::string& candidates) {
  std::string sdp;  // New sdp message.

  std::vector<Candidate> candidates_vector;
  if (!ParseCandidates(candidates, &candidates_vector))
    return sdp;

  size_t pos = 0;
  std::string line;
  while (GetLine(desc, &pos, &line)) {
    AddLine(line, &sdp);  // Copy old line to new sdp.
    if (!HasPrefix(line, kLinePrefixMedia)) {
      continue;  // Loop until the next m line.
    }
    if (HasAttribute(line, kMediaTypeVideo)) {
      BuildCandidate(candidates_vector, cricket::MEDIA_TYPE_VIDEO, &sdp);
    } else if (HasAttribute(line, kMediaTypeAudio)) {
      BuildCandidate(candidates_vector, cricket::MEDIA_TYPE_AUDIO, &sdp);
    }
  }

  return sdp;
}


bool SdpDeserialize(const std::string& message,
                    cricket::SessionDescription* desc,
                    std::vector<Candidate>* candidates) {
  return SdpDeserializeSessionDescription(message, desc) &&
         SdpDeserializeCandidates(message, candidates);
}

bool SdpDeserializeSessionDescription(const std::string& message,
                                      cricket::SessionDescription* desc) {
  size_t current_pos = 0;

  // Session Description
  if (!ParseSessionDescription(message, &current_pos)) {
    return false;
  }

  // Time Description
  if (!ParseTimeDescription(message, &current_pos)) {
    return false;
  }

  // Media Description
  if (!ParseMediaDescription(message, &current_pos, desc)) {
    return false;
  }

  return true;
}

bool SdpDeserializeCandidates(const std::string& message,
                              std::vector<Candidate>* candidates) {
  return ParseCandidates(message, candidates);
}

void BuildMediaDescription(const cricket::ContentInfo& content_info,
                           const MediaType media_type,
                           std::string* message) {
  ASSERT(message != NULL);
  // TODO: Rethink if we should use sprintfn instead of stringstream.
  // According to the style guide, streams should only be used for logging.
  // http://google-styleguide.googlecode.com/svn/
  // trunk/cppguide.xml?showone=Streams#Streams
  std::ostringstream os;
  const MediaContentDescription* media_desc =
      static_cast<const MediaContentDescription*> (
          content_info.description);
  ASSERT(media_desc != NULL);

  // m=<media> <port> <proto> <fmt>
  // fmt is a list of payload type numbers that MAY be used in the session.
  const char* type = NULL;
  if (media_type == cricket::MEDIA_TYPE_AUDIO)
    type = kMediaTypeAudio;
  else if (media_type == cricket::MEDIA_TYPE_VIDEO)
    type = kMediaTypeVideo;
  else
    ASSERT(false);

  std::string fmt;
  if (media_type == cricket::MEDIA_TYPE_VIDEO) {
    const VideoContentDescription* video_desc =
        static_cast<const VideoContentDescription*>(media_desc);
    for (std::vector<cricket::VideoCodec>::const_iterator it =
             video_desc->codecs().begin();
         it != video_desc->codecs().end(); ++it) {
      fmt.append(" ");
      fmt.append(talk_base::ToString<int>(it->id));
    }
  } else if (media_type == cricket::MEDIA_TYPE_AUDIO) {
    const AudioContentDescription* audio_desc =
        static_cast<const AudioContentDescription*>(media_desc);
    for (std::vector<cricket::AudioCodec>::const_iterator it =
             audio_desc->codecs().begin();
         it != audio_desc->codecs().end(); ++it) {
      fmt.append(" ");
      fmt.append(talk_base::ToString<int>(it->id));
    }
  }
  const int port = 0;
  const char* proto = "RTP/AVPF";
  os.str("");
  os << kLinePrefixMedia << type << " " << port << " " << proto << fmt;
  AddLine(os.str(), message);

  // a=mid:<media>
  os.str("");
  os << kLinePrefixAttributes << kAttributeMid << type;
  AddLine(os.str(), message);

  // a=rtcp-mux
  if (media_desc->rtcp_mux()) {
    os.str("");
    os << kLinePrefixAttributes << kAttributeRtcpMux;
    AddLine(os.str(), message);
  }

  // a=crypto:<tag> <crypto-suite> <key-params> [<session-params>]
  for (std::vector<CryptoParams>::const_iterator it =
           media_desc->cryptos().begin();
       it != media_desc->cryptos().end(); ++it) {
    os.str("");
    os << kLinePrefixAttributes << kAttributeCrypto << it->tag << " "
       << it->cipher_suite << " "
       << it->key_params << " "
       << it->session_params;
    AddLine(os.str(), message);
  }

  // a=rtpmap:<payload type> <encoding name>/<clock rate>
  // [/<encodingparameters>]
  BuildRtpMap(media_desc, media_type, message);

  // draft - Mechanisms for Media Source Selection in SDP
  // a=ssrc:<ssrc-id> <attribute>:<value>
  // a=ssrc:<ssrc-id> cname:<value> mslabel:<value> label:<value>
  for (cricket::StreamParamsVec::const_iterator it =
           media_desc->streams().begin();
       it != media_desc->streams().end(); ++it) {
    // Require that the track belongs to a media stream,
    // ie the sync_label is set. This extra check is necessary since the
    // MediaContentDescription always contains a streamparam with an ssrc even
    // if no track or media stream have been created.
    if (it->sync_label.empty()) continue;

    os.str("");
    os << kLinePrefixAttributes << kAttributeSsrc << it->ssrcs[0] << " "
       << kAttributeCname << it->cname << " "
       << kAttributeMslabel << it->sync_label << " "
       << kAttributeLabel << it->name;
    AddLine(os.str(), message);
  }
}

void BuildRtpMap(const MediaContentDescription* media_desc,
                 const MediaType media_type,
                 std::string* message) {
  ASSERT(message != NULL);
  ASSERT(media_desc != NULL);
  std::ostringstream os;
  if (media_type == cricket::MEDIA_TYPE_VIDEO) {
    const VideoContentDescription* video_desc =
        static_cast<const VideoContentDescription*>(media_desc);
    for (std::vector<cricket::VideoCodec>::const_iterator it =
             video_desc->codecs().begin();
         it != video_desc->codecs().end(); ++it) {
      // a=rtpmap:<payload type> <encoding name>/<clock rate>
      // [/<encodingparameters>]
      os.str("");
      os << kLinePrefixAttributes << kAttributeRtpmap << it->id << " "
         << it->name << "/" << 0;
      AddLine(os.str(), message);
    }
  } else if (media_type == cricket::MEDIA_TYPE_AUDIO) {
    const AudioContentDescription* audio_desc =
        static_cast<const AudioContentDescription*>(media_desc);
    for (std::vector<cricket::AudioCodec>::const_iterator it =
             audio_desc->codecs().begin();
         it != audio_desc->codecs().end(); ++it) {
      // a=rtpmap:<payload type> <encoding name>/<clock rate>
      // [/<encodingparameters>]
      os.str("");
      os << kLinePrefixAttributes << kAttributeRtpmap << it->id << " "
         << it->name << "/" << it->clockrate;
      AddLine(os.str(), message);
    }
  }
}

void BuildCandidate(const std::vector<Candidate>& candidates,
                    const MediaType media_type,
                    std::string* message) {
  std::ostringstream os;
  for (std::vector<Candidate>::const_iterator it = candidates.begin();
       it != candidates.end(); ++it) {
    // a=candidate:<foundation> <component-id> <transport> <priority>
    // <connection-address> <port> typ <candidate-types>
    // [raddr <connection-address>] [rport <port>]
    // *(SP extension-att-name SP extension-att-value)
    if (((media_type == cricket::MEDIA_TYPE_VIDEO) &&
         (it->name() == "video_rtcp" || it->name() == "video_rtp")) ||
        ((media_type == cricket::MEDIA_TYPE_AUDIO) &&
         (it->name() == "rtp" || it->name() == "rtcp"))) {
      std::string type;
      // Map the cricket candidate type to "host" / "srflx" / "prflx" / "relay"
      if (it->type() == cricket::LOCAL_PORT_TYPE) {
        type = kCandidateHost;
      } else if (it->type() == cricket::STUN_PORT_TYPE) {
        type = kCandidateSrflx;
      } else if (it->type() == cricket::RELAY_PORT_TYPE) {
        type = kCandidateRelay;
      } else {
        ASSERT(false);
      }
      os.str("");
      os << kLinePrefixAttributes << kAttributeCandidate
         << kIceFoundation << " " << kIceComponent << " "
         << it->protocol() << " " << it->preference_str() << " "
         << it->address().IPAsString() << " "
         << it->address().PortAsString() << " "
         << kAttributeCandidateTyp << " " << type << " "
         << kAttributeCandidateName << " " << it->name() << " "
         << kAttributeCandidateNetworkName << " " << it->network_name() << " "
         << kAttributeCandidateUsername << " " << it->username() << " "
         << kAttributeCandidatePassword << " " << it->password() << " "
         << kAttributeCandidateGeneration << " " << it->generation();
      AddLine(os.str(), message);
    }
  }
}

bool ParseSessionDescription(const std::string& message, size_t* pos) {
  std::string line;

  // v=  (protocol version)
  if (!GetLineWithPrefix(message, pos, &line, kLinePrefixVersion)) {
    LOG_PREFIX_PARSING_ERROR(kLinePrefixVersion);
    return false;
  }
  // o=  (originator and session identifier)
  if (!GetLineWithPrefix(message, pos, &line, kLinePrefixOrigin)) {
    LOG_PREFIX_PARSING_ERROR(kLinePrefixOrigin);
    return false;
  }
  // s=  (session name)
  if (!GetLineWithPrefix(message, pos, &line, kLinePrefixSessionName)) {
    LOG_PREFIX_PARSING_ERROR(kLinePrefixSessionName);
    return false;
  }

  // Optional lines
  // Those are the optional lines, so shouldn't return false if not present.
  // i=* (session information)
  GetLineWithPrefix(message, pos, &line, kLinePrefixSessionInfo);

  // u=* (URI of description)
  GetLineWithPrefix(message, pos, &line, kLinePrefixSessionUri);

  // e=* (email address)
  GetLineWithPrefix(message, pos, &line, kLinePrefixSessionEmail);

  // p=* (phone number)
  GetLineWithPrefix(message, pos, &line, kLinePrefixSessionPhone);

  // c=* (connection information -- not required if included in
  //      all media)
  GetLineWithPrefix(message, pos, &line, kLinePrefixSessionConnection);

  // b=* (zero or more bandwidth information lines)
  while (GetLineWithPrefix(message, pos, &line, kLinePrefixSessionBandwidth)) {
    // By pass zero or more b lines.
  }

  return true;
}

bool ParseTimeDescription(const std::string& message, size_t* pos) {
  std::string line;
  // One or more time descriptions ("t=" and "r=" lines; see below)
  // t=  (time the session is active)
  // r=* (zero or more repeat times)
  // Ensure there's at least one time description
  if (!GetLineWithPrefix(message, pos, &line, kLinePrefixTiming)) {
    LOG_PREFIX_PARSING_ERROR(kLinePrefixTiming);
    return false;
  }

  while (GetLineWithPrefix(message, pos, &line, kLinePrefixRepeatTimes)) {
    // By pass zero or more r lines.
  }

  // Go through the rest of the time descriptions
  while (GetLineWithPrefix(message, pos, &line, kLinePrefixTiming)) {
    while (GetLineWithPrefix(message, pos, &line, kLinePrefixRepeatTimes)) {
      // By pass zero or more r lines.
    }
  }

  // z=* (time zone adjustments)
  GetLineWithPrefix(message, pos, &line, kLinePrefixTimeZone);

  // k=* (encryption key)
  GetLineWithPrefix(message, pos, &line, kLinePrefixEncryptionKey);

  // a=* (zero or more session attribute lines)
  while (GetLineWithPrefix(message, pos, &line, kLinePrefixAttributes)) {
    // TODO: parse the a=group:BUNDLE
  }

  return true;
}

bool ParseMediaDescription(const std::string& message, size_t* pos,
                           cricket::SessionDescription* desc) {
  ASSERT(desc != NULL);

  std::string line;

  // Zero or more media descriptions
  // m=<media> <port> <proto> <fmt>
  while (GetLineWithPrefix(message, pos, &line, kLinePrefixMedia)) {
    MediaType media_type = cricket::MEDIA_TYPE_VIDEO;
    ContentDescription* content = NULL;
    if (HasAttribute(line, kMediaTypeVideo)) {
      media_type = cricket::MEDIA_TYPE_VIDEO;
      content = new VideoContentDescription();
      desc->AddContent(cricket::CN_VIDEO, cricket::NS_JINGLE_RTP, content);
    } else if (HasAttribute(line, kMediaTypeAudio)) {
      media_type = cricket::MEDIA_TYPE_AUDIO;
      content = new AudioContentDescription();
      desc->AddContent(cricket::CN_AUDIO, cricket::NS_JINGLE_RTP, content);
    } else {
      LOG(LS_WARNING) << "Unsupported media type: " << line;
    }

    if (!ParseContent(message, media_type, pos, content))
      return false;
  }
  return true;
}

bool ParseContent(const std::string& message,
                  const MediaType media_type,
                  size_t* pos,
                  ContentDescription* content) {
  std::string line;
  // Loop until the next m line
  while (!HasPrefix(message, kLinePrefixMedia, *pos)) {
    if (!GetLine(message, pos, &line)) {
      if (*pos >= message.size())
        return true;  // Done parsing
      else
        return false;
    }

    if (!content) {
      // Unsupported media type, just skip it.
      continue;
    }

    if (!HasPrefix(line, kLinePrefixAttributes)) {
      // TODO: Handle other lines if needed.
      continue;
    }

    MediaContentDescription* media_desc =
        static_cast<MediaContentDescription*> (content);

    std::vector<std::string> fields;
    talk_base::split(line.substr(kLinePrefixLength), kSdpDelimiter, &fields);

    if (HasAttribute(line, kAttributeMid)) {
      continue;
    } else if (HasAttribute(line, kAttributeRtcpMux)) {
      media_desc->set_rtcp_mux(true);
    } else if (HasAttribute(line, kAttributeSsrc)) {
      // a=ssrc:<ssrc-id> cname:<value> mslabel:<value> label:<value>
      uint32 ssrc = 0;
      std::string cname;
      std::string mslabel;
      std::string label;
      for (std::vector<std::string>::const_iterator it = fields.begin();
           it != fields.end(); ++it) {
        if (HasPrefix(*it, kAttributeSsrc)) {
          ASSERT(it == fields.begin());
          ssrc = talk_base::FromString<uint32>(
                     it->substr(strlen(kAttributeSsrc)));
        } else if (HasPrefix(*it, kAttributeCname)) {
          cname = it->substr(strlen(kAttributeCname));
        } else if (HasPrefix(*it, kAttributeMslabel)) {
          mslabel = it->substr(strlen(kAttributeMslabel));
        } else if (HasPrefix(*it, kAttributeLabel)) {
          label = it->substr(strlen(kAttributeLabel));
        }
      }
      StreamParams stream;
      stream.name = label;
      stream.cname = cname;
      stream.sync_label = mslabel;
      stream.ssrcs.push_back(ssrc);
      media_desc->AddStream(stream);
    } else if (HasAttribute(line, kAttributeCrypto)) {
      // a=crypto:<tag> <crypto-suite> <key-params> [<session-params>]
      if (fields.size() < 3) {  // 3 mandatory fields
        LOG_LINE_PARSING_ERROR(line);
        return false;
      }
      int tag = talk_base::FromString<int>(
          fields[0].substr(strlen(kAttributeCrypto)));
      const std::string crypto_suite = fields[1];
      const std::string key_params = fields[2];
      media_desc->AddCrypto(CryptoParams(tag, crypto_suite, key_params, ""));
    } else if (HasAttribute(line, kAttributeCandidate)) {
      continue;  // Parse candidates separately.
    } else if (HasAttribute(line, kAttributeRtpmap)) {
      // a=rtpmap:<payload type> <encoding name>/<clock rate>
      // [/<encodingparameters>]
      // 2 mandatory fields
      if (fields.size() < 2) {
        LOG_LINE_PARSING_ERROR(line);
        return false;
      }
      const int payload_type = talk_base::FromString<int>(
          fields[0].substr(strlen(kAttributeRtpmap)));
      const std::string encoder = fields[1];
      const size_t pos = encoder.find("/");
      if (pos == std::string::npos)
        return false;
      const std::string encoding_name = encoder.substr(0, pos);
      const int clock_rate =
          talk_base::FromString<int>(encoder.substr(pos + 1));
      if (media_type == cricket::MEDIA_TYPE_VIDEO) {
        VideoContentDescription* video_desc =
            static_cast<VideoContentDescription*>(media_desc);
        // TODO: We will send resolution in SDP. For now, use VGA.
        video_desc->AddCodec(cricket::VideoCodec(payload_type, encoding_name,
                                                 kDefaultVideoWidth,
                                                 kDefaultVideoHeight,
                                                 kDefaultVideoFrameRate,
                                                 kDefaultVideoPreference));
      } else if (media_type == cricket::MEDIA_TYPE_AUDIO) {
        AudioContentDescription* audio_desc =
            static_cast<AudioContentDescription*>(media_desc);
        audio_desc->AddCodec(cricket::AudioCodec(payload_type, encoding_name,
                                                 clock_rate, 0, 0, 0));
      }
    } else {
      LOG(LS_WARNING) << "Unsupported line: " << line;
    }
  }
  return true;
}

bool ParseCandidates(const std::string& message,
                     std::vector<Candidate>* candidates) {
  ASSERT(candidates != NULL);
  std::string line;
  size_t pos = 0;

  // Loop until the next attribute line.
  while (GetLine(message, &pos, &line)) {
    if (!HasPrefix(line, kLinePrefixAttributes) ||
        !HasAttribute(line, kAttributeCandidate)) {
      continue;  // Only parse candidates
    }
    std::vector<std::string> fields;
    talk_base::split(line.substr(kLinePrefixLength), kSdpDelimiter, &fields);
    // a=candidate:<foundation> <component-id> <transport> <priority>
    // <connection-address> <port> typ <candidate-types>
    // [raddr <connection-address>] [rport <port>]
    // *(SP extension-att-name SP extension-att-value)
    // 8 mandatory fields
    if (fields.size() < 8 || (fields[6] != kAttributeCandidateTyp)) {
      LOG_LINE_PARSING_ERROR(line);
      return false;
    }
    const std::string transport = fields[2];
    const float priority = talk_base::FromString<float>(fields[3]);
    const std::string connection_address = fields[4];
    const int port = talk_base::FromString<int>(fields[5]);
    std::string candidate_type;
    const std::string type = fields[7];
    if (type == kCandidateHost) {
      candidate_type = cricket::LOCAL_PORT_TYPE;
    } else if (type == kCandidateSrflx) {
      candidate_type = cricket::STUN_PORT_TYPE;
    } else if (type == kCandidateRelay) {
      candidate_type = cricket::RELAY_PORT_TYPE;
    } else {
      LOG(LS_ERROR) << "Unsupported candidate type from line: " << line;
      return false;
    }

    // extension
    std::string name;
    std::string network_name;
    std::string username;
    std::string password;
    uint32 generation = 0;
    for (size_t i = 8; i < (fields.size() - 1); ++i) {
      const std::string field = fields.at(i);
      if (field == kAttributeCandidateName) {
        name = fields.at(++i);
      } else if (field == kAttributeCandidateNetworkName) {
        network_name = fields.at(++i);
      } else if (field == kAttributeCandidateUsername) {
        username = fields.at(++i);
      } else if (field == kAttributeCandidatePassword) {
        password = fields.at(++i);
      } else if (field == kAttributeCandidateGeneration) {
        generation = talk_base::FromString<uint32>(fields.at(++i));
      }
    }

    SocketAddress address(connection_address, port);
    Candidate candidate(name, transport, address, priority, username,
        password, candidate_type, network_name, generation);
    candidates->push_back(candidate);
  }
  return true;
}

}  // namespace webrtc
