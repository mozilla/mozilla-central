/*
 * libjingle
 * Copyright 2004--2011, Google Inc.
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

#include "talk/app/webrtcv1/webrtcjson.h"

#ifdef WEBRTC_RELATIVE_PATH
#include "json/json.h"
#else
#include "third_party/jsoncpp/json.h"
#endif

// TODO: Remove webrtcsession.h once we can get size from signaling.
// webrtcsession.h is for kDefaultVideoCodecWidth and kDefaultVideoCodecHeight.
#include "talk/app/webrtcv1/webrtcsession.h"
#include "talk/base/json.h"
#include "talk/base/logging.h"
#include "talk/base/stringutils.h"
#include "talk/session/phone/codec.h"
#include "talk/session/phone/mediasessionclient.h"

namespace webrtc {
static const int kIceComponent = 1;
static const int kIceFoundation = 1;

static std::vector<Json::Value> ReadValues(const Json::Value& value,
                                           const std::string& key);

static bool BuildMediaMessage(
    const cricket::ContentInfo& content_info,
    const std::vector<cricket::Candidate>& candidates,
    bool video,
    Json::Value* value);

static bool BuildRtpMapParams(
    const cricket::ContentInfo& audio_offer,
    bool video,
    std::vector<Json::Value>* rtpmap);

static void BuildCrypto(const cricket::ContentInfo& content_info,
                        bool video,
                        std::vector<Json::Value>* cryptos);


static bool BuildAttributes(const std::vector<cricket::Candidate>& candidates,
                            bool video,
                            std::vector<Json::Value>* jcandidates);

static std::string Serialize(const Json::Value& value);
static bool Deserialize(const std::string& message, Json::Value* value);

static bool ParseRtcpMux(const Json::Value& value);
static bool ParseAudioCodec(const Json::Value& value,
                            cricket::AudioContentDescription* content);
static bool ParseVideoCodec(const Json::Value& value,
                            cricket::VideoContentDescription* content);
static bool ParseCrypto(const Json::Value& content,
                        cricket::MediaContentDescription* desc);
static bool ParseIceCandidates(const Json::Value& value,
                               std::vector<cricket::Candidate>* candidates);

static Json::Value ReadValue(const Json::Value& value, const std::string& key);
static std::string ReadString(const Json::Value& value, const std::string& key);
static uint32 ReadUInt(const Json::Value& value, const std::string& key);

static void Append(Json::Value* object, const std::string& key, bool value);
static void Append(Json::Value* object, const std::string& key, int value);
static void Append(Json::Value* object, const std::string& key,
                   const std::string& value);
static void Append(Json::Value* object, const std::string& key, uint32 value);
static void Append(Json::Value* object, const std::string& key,
                   const Json::Value& value);
static void Append(Json::Value* object,
                   const std::string& key,
                   const std::vector<Json::Value>& values);

bool GetJsonSignalingMessage(
    const cricket::SessionDescription* sdp,
    const std::vector<cricket::Candidate>& candidates,
    std::string* signaling_message) {
  const cricket::ContentInfo* audio_content = GetFirstAudioContent(sdp);
  const cricket::ContentInfo* video_content = GetFirstVideoContent(sdp);

  std::vector<Json::Value> media;
  if (audio_content) {
    Json::Value value;
    BuildMediaMessage(*audio_content, candidates, false, &value);
    media.push_back(value);
  }

  if (video_content) {
    Json::Value value;
    BuildMediaMessage(*video_content, candidates, true, &value);
    media.push_back(value);
  }

  Json::Value signal;
  Append(&signal, "media", media);

  // Now serialize.
  *signaling_message = Serialize(signal);

  return true;
}

bool BuildMediaMessage(
    const cricket::ContentInfo& content_info,
    const std::vector<cricket::Candidate>& candidates,
    bool video,
    Json::Value* params) {
  if (video) {
    Append(params, "label", 2);  // always video 2
  } else {
    Append(params, "label", 1);  // always audio 1
  }

  const cricket::MediaContentDescription* media_info =
  static_cast<const cricket::MediaContentDescription*> (
      content_info.description);
  if (media_info->rtcp_mux()) {
    Append(params, "rtcp_mux", true);
  }

  // rtpmap
  std::vector<Json::Value> rtpmap;
  if (!BuildRtpMapParams(content_info, video, &rtpmap)) {
    return false;
  }
  Append(params, "rtpmap", rtpmap);

  // crypto
  std::vector<Json::Value> crypto;
  BuildCrypto(content_info, video, &crypto);
  Append(params, "crypto", crypto);

  // Candidates
  Json::Value attributes;
  std::vector<Json::Value> jcandidates;
  if (!BuildAttributes(candidates, video, &jcandidates)) {
    return false;
  }
  Append(&attributes, "candidate", jcandidates);

  Append(params, "attributes", attributes);
  return true;
}

bool BuildRtpMapParams(const cricket::ContentInfo& content_info,
                       bool video,
                       std::vector<Json::Value>* rtpmap) {
  if (!video) {
    const cricket::AudioContentDescription* audio_offer =
        static_cast<const cricket::AudioContentDescription*>(
            content_info.description);

    std::vector<cricket::AudioCodec>::const_iterator iter =
        audio_offer->codecs().begin();
    std::vector<cricket::AudioCodec>::const_iterator iter_end =
        audio_offer->codecs().end();
    for (; iter != iter_end; ++iter) {
      Json::Value codec;
      std::string codec_str(std::string("audio/").append(iter->name));
      // adding clockrate
      Append(&codec, "clockrate", iter->clockrate);
      Append(&codec, "codec", codec_str);
      Json::Value codec_id;
      Append(&codec_id, talk_base::ToString(iter->id), codec);
      rtpmap->push_back(codec_id);
    }
  } else {
    const cricket::VideoContentDescription* video_offer =
        static_cast<const cricket::VideoContentDescription*>(
            content_info.description);

    std::vector<cricket::VideoCodec>::const_iterator iter =
        video_offer->codecs().begin();
    std::vector<cricket::VideoCodec>::const_iterator iter_end =
        video_offer->codecs().end();
    for (; iter != iter_end; ++iter) {
      Json::Value codec;
      std::string codec_str(std::string("video/").append(iter->name));
      Append(&codec, "codec", codec_str);
      Json::Value codec_id;
      Append(&codec_id, talk_base::ToString(iter->id), codec);
      rtpmap->push_back(codec_id);
    }
  }
  return true;
}

void BuildCrypto(const cricket::ContentInfo& content_info,
                 bool video,
                 std::vector<Json::Value>* cryptos) {
  const cricket::MediaContentDescription* content_desc =
      static_cast<const cricket::MediaContentDescription*>(
          content_info.description);
  std::vector<cricket::CryptoParams>::const_iterator iter =
      content_desc->cryptos().begin();
  std::vector<cricket::CryptoParams>::const_iterator iter_end =
      content_desc->cryptos().end();
  for (; iter != iter_end; ++iter) {
    Json::Value crypto;
    Append(&crypto, "cipher_suite", iter->cipher_suite);
    Append(&crypto, "key_params", iter->key_params);
    cryptos->push_back(crypto);
  }
}

bool BuildAttributes(const std::vector<cricket::Candidate>& candidates,
                     bool video,
                     std::vector<Json::Value>* jcandidates) {
  std::vector<cricket::Candidate>::const_iterator iter =
      candidates.begin();
  std::vector<cricket::Candidate>::const_iterator iter_end =
      candidates.end();
  for (; iter != iter_end; ++iter) {
    if ((video && (!iter->name().compare("video_rtcp") ||
                  (!iter->name().compare("video_rtp")))) ||
        (!video && (!iter->name().compare("rtp") ||
                   (!iter->name().compare("rtcp"))))) {
      Json::Value candidate;
      Append(&candidate, "component", kIceComponent);
      Append(&candidate, "foundation", kIceFoundation);
      Append(&candidate, "generation", iter->generation());
      Append(&candidate, "proto", iter->protocol());
      Append(&candidate, "priority", iter->preference_str());
      Append(&candidate, "ip", iter->address().IPAsString());
      Append(&candidate, "port", iter->address().PortAsString());
      Append(&candidate, "type", iter->type());
      Append(&candidate, "name", iter->name());
      Append(&candidate, "network_name", iter->network_name());
      Append(&candidate, "username", iter->username());
      Append(&candidate, "password", iter->password());
      jcandidates->push_back(candidate);
    }
  }
  return true;
}

std::string Serialize(const Json::Value& value) {
  Json::StyledWriter writer;
  return writer.write(value);
}

bool Deserialize(const std::string& message, Json::Value* value) {
  Json::Reader reader;
  return reader.parse(message, *value);
}

bool ParseJsonSignalingMessage(const std::string& signaling_message,
                               cricket::SessionDescription** sdp,
                               std::vector<cricket::Candidate>* candidates) {
  ASSERT(!(*sdp));  // expect this to be NULL
  // first deserialize message
  Json::Value value;
  if (!Deserialize(signaling_message, &value)) {
    return false;
  }

  // get media objects
  std::vector<Json::Value> mlines = ReadValues(value, "media");
  if (mlines.empty()) {
    // no m-lines found
    return false;
  }

  *sdp = new cricket::SessionDescription();

  // get codec information
  for (size_t i = 0; i < mlines.size(); ++i) {
    if (mlines[i]["label"].asInt() == 1) {
      cricket::AudioContentDescription* audio_content =
          new cricket::AudioContentDescription();
      ParseAudioCodec(mlines[i], audio_content);
      audio_content->set_rtcp_mux(ParseRtcpMux(mlines[i]));
      audio_content->SortCodecs();
      (*sdp)->AddContent(cricket::CN_AUDIO,
                         cricket::NS_JINGLE_RTP, audio_content);
      // crypto
      if (!ParseCrypto(mlines[i], audio_content))
        return false;
      ParseIceCandidates(mlines[i], candidates);
    } else {
      cricket::VideoContentDescription* video_content =
          new cricket::VideoContentDescription();
      ParseVideoCodec(mlines[i], video_content);

      video_content->set_rtcp_mux(ParseRtcpMux(mlines[i]));
      video_content->SortCodecs();
      (*sdp)->AddContent(cricket::CN_VIDEO,
                         cricket::NS_JINGLE_RTP, video_content);
      if (!ParseCrypto(mlines[i], video_content))
        return false;
      ParseIceCandidates(mlines[i], candidates);
    }
  }
  return true;
}

bool ParseRtcpMux(const Json::Value& value) {
  Json::Value rtcp_mux(ReadValue(value, "rtcp_mux"));
  if (!rtcp_mux.empty()) {
    if (rtcp_mux.asBool()) {
      return true;
    }
  }
  return false;
}

bool ParseAudioCodec(const Json::Value& value,
                     cricket::AudioContentDescription* content) {
  std::vector<Json::Value> rtpmap(ReadValues(value, "rtpmap"));
  if (rtpmap.empty())
    return false;

  std::vector<Json::Value>::const_iterator iter =
      rtpmap.begin();
  std::vector<Json::Value>::const_iterator iter_end =
      rtpmap.end();
  for (; iter != iter_end; ++iter) {
    cricket::AudioCodec codec;
    std::string pltype(iter->begin().memberName());
    talk_base::FromString(pltype, &codec.id);
    Json::Value codec_info((*iter)[pltype]);
    std::string codec_name(ReadString(codec_info, "codec"));
    std::vector<std::string> tokens;
    talk_base::split(codec_name, '/', &tokens);
    codec.name = tokens[1];
    codec.clockrate = ReadUInt(codec_info, "clockrate");
    content->AddCodec(codec);
  }

  return true;
}

bool ParseVideoCodec(const Json::Value& value,
                     cricket::VideoContentDescription* content) {
  std::vector<Json::Value> rtpmap(ReadValues(value, "rtpmap"));
  if (rtpmap.empty())
    return false;

  std::vector<Json::Value>::const_iterator iter =
      rtpmap.begin();
  std::vector<Json::Value>::const_iterator iter_end =
      rtpmap.end();
  for (; iter != iter_end; ++iter) {
    cricket::VideoCodec codec;
    std::string pltype(iter->begin().memberName());
    talk_base::FromString(pltype, &codec.id);
    Json::Value codec_info((*iter)[pltype]);
    std::vector<std::string> tokens;
    talk_base::split(codec_info["codec"].asString(), '/', &tokens);
    codec.name = tokens[1];
    // TODO: Remove once we can get size from signaling message.
    codec.width = WebRtcSession::kDefaultVideoCodecWidth;
    codec.height = WebRtcSession::kDefaultVideoCodecHeight;
    content->AddCodec(codec);
  }
  return true;
}

bool ParseIceCandidates(const Json::Value& value,
                        std::vector<cricket::Candidate>* candidates) {
  Json::Value attributes(ReadValue(value, "attributes"));
  std::string ice_pwd(ReadString(attributes, "ice-pwd"));
  std::string ice_ufrag(ReadString(attributes, "ice-ufrag"));

  std::vector<Json::Value> jcandidates(ReadValues(attributes, "candidate"));

  std::vector<Json::Value>::const_iterator iter =
      jcandidates.begin();
  std::vector<Json::Value>::const_iterator iter_end =
      jcandidates.end();
  for (; iter != iter_end; ++iter) {
    cricket::Candidate cand;

    unsigned int generation;
    if (!GetUIntFromJsonObject(*iter, "generation", &generation))
      return false;
    cand.set_generation_str(talk_base::ToString(generation));

    std::string proto;
    if (!GetStringFromJsonObject(*iter, "proto", &proto))
      return false;
    cand.set_protocol(proto);

    std::string priority;
    if (!GetStringFromJsonObject(*iter, "priority", &priority))
      return false;
    cand.set_preference_str(priority);

    std::string str;
    talk_base::SocketAddress addr;
    if (!GetStringFromJsonObject(*iter, "ip", &str))
      return false;
    addr.SetIP(str);
    if (!GetStringFromJsonObject(*iter, "port", &str))
      return false;
    int port;
    if (!talk_base::FromString(str, &port))
      return false;
    addr.SetPort(port);
    cand.set_address(addr);

    if (!GetStringFromJsonObject(*iter, "type", &str))
      return false;
    cand.set_type(str);

    if (!GetStringFromJsonObject(*iter, "name", &str))
      return false;
    cand.set_name(str);

    if (!GetStringFromJsonObject(*iter, "network_name", &str))
      return false;
    cand.set_network_name(str);

    if (!GetStringFromJsonObject(*iter, "username", &str))
      return false;
    cand.set_username(str);

    if (!GetStringFromJsonObject(*iter, "password", &str))
      return false;
    cand.set_password(str);

    candidates->push_back(cand);
  }
  return true;
}

bool ParseCrypto(const Json::Value& content,
                 cricket::MediaContentDescription* desc) {
  std::vector<Json::Value> jcryptos(ReadValues(content, "crypto"));
  std::vector<Json::Value>::const_iterator iter =
      jcryptos.begin();
  std::vector<Json::Value>::const_iterator iter_end =
      jcryptos.end();
  for (; iter != iter_end; ++iter) {
    cricket::CryptoParams crypto;

    std::string cipher_suite;
    if (!GetStringFromJsonObject(*iter, "cipher_suite", &cipher_suite))
      return false;
    crypto.cipher_suite = cipher_suite;

    std::string key_params;
    if (!GetStringFromJsonObject(*iter, "key_params", &key_params))
      return false;
    crypto.key_params= key_params;

    desc->AddCrypto(crypto);
  }
  return true;
}

std::vector<Json::Value> ReadValues(
    const Json::Value& value, const std::string& key) {
  std::vector<Json::Value> objects;
  for (Json::Value::ArrayIndex i = 0; i < value[key].size(); ++i) {
    objects.push_back(value[key][i]);
  }
  return objects;
}

Json::Value ReadValue(const Json::Value& value, const std::string& key) {
  return value[key];
}

std::string ReadString(const Json::Value& value, const std::string& key) {
  return value[key].asString();
}

uint32 ReadUInt(const Json::Value& value, const std::string& key) {
  return value[key].asUInt();
}

void Append(Json::Value* object, const std::string& key, bool value) {
  (*object)[key] = Json::Value(value);
}

void Append(Json::Value* object, const std::string& key, int value) {
  (*object)[key] = Json::Value(value);
}

void Append(Json::Value* object, const std::string& key,
            const std::string& value) {
  (*object)[key] = Json::Value(value);
}

void Append(Json::Value* object, const std::string& key, uint32 value) {
  (*object)[key] = Json::Value(value);
}

void Append(Json::Value* object, const std::string& key,
            const Json::Value& value) {
  (*object)[key] = value;
}

void Append(Json::Value* object,
            const std::string & key,
            const std::vector<Json::Value>& values) {
  for (std::vector<Json::Value>::const_iterator iter = values.begin();
      iter != values.end(); ++iter) {
    (*object)[key].append(*iter);
  }
}

}  // namespace webrtc
