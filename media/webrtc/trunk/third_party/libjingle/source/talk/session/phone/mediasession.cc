/*
 * libjingle
 * Copyright 2004--2005, Google Inc.
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

#include "talk/session/phone/mediasession.h"

#include "talk/base/helpers.h"
#include "talk/base/logging.h"
#include "talk/base/scoped_ptr.h"
#include "talk/p2p/base/constants.h"
#include "talk/session/phone/channelmanager.h"
#include "talk/session/phone/cryptoparams.h"
#include "talk/session/phone/srtpfilter.h"
#include "talk/xmpp/constants.h"

namespace {
const char kInline[] = "inline:";
}

namespace cricket {

using talk_base::scoped_ptr;

static bool CreateCryptoParams(int tag, const std::string& cipher,
                               CryptoParams *out) {
  std::string key;
  key.reserve(SRTP_MASTER_KEY_BASE64_LEN);

  if (!talk_base::CreateRandomString(SRTP_MASTER_KEY_BASE64_LEN, &key)) {
    return false;
  }
  out->tag = tag;
  out->cipher_suite = cipher;
  out->key_params = kInline;
  out->key_params += key;
  return true;
}

#ifdef HAVE_SRTP
static bool AddCryptoParams(const std::string& cipher_suite,
                            CryptoParamsVec *out) {
  int size = out->size();

  out->resize(size + 1);
  return CreateCryptoParams(size, cipher_suite, &out->at(size));
}

void AddMediaCryptos(const CryptoParamsVec& cryptos,
                     MediaContentDescription* media) {
  for (CryptoParamsVec::const_iterator crypto = cryptos.begin();
       crypto != cryptos.end(); ++crypto) {
    media->AddCrypto(*crypto);
  }
}

bool CreateMediaCryptos(const std::vector<std::string>& crypto_suites,
                        MediaContentDescription* media) {
  CryptoParamsVec cryptos;
  for (std::vector<std::string>::const_iterator it = crypto_suites.begin();
       it != crypto_suites.end(); ++it) {
    if (!AddCryptoParams(*it, &cryptos)) {
      return false;
    }
  }
  AddMediaCryptos(cryptos, media);
  return true;
}
#endif

const CryptoParamsVec* GetCryptos(const MediaContentDescription* media) {
  if (!media) {
    return NULL;
  }
  return &media->cryptos();
}

bool FindMatchingCrypto(const CryptoParamsVec& cryptos,
                        const CryptoParams& crypto,
                        CryptoParams* out) {
  for (CryptoParamsVec::const_iterator it = cryptos.begin();
       it != cryptos.end(); ++it) {
    if (crypto.Matches(*it)) {
      *out = *it;
      return true;
    }
  }
  return false;
}

// For audio, HMAC 32 is prefered because of the low overhead.
static void GetSupportedAudioCryptoSuites(
    std::vector<std::string>* crypto_suites) {
#ifdef HAVE_SRTP
  crypto_suites->push_back(CS_AES_CM_128_HMAC_SHA1_32);
  crypto_suites->push_back(CS_AES_CM_128_HMAC_SHA1_80);
#endif
}

static void GetSupportedVideoCryptoSuites(
    std::vector<std::string>* crypto_suites) {
#ifdef HAVE_SRTP
  crypto_suites->push_back(CS_AES_CM_128_HMAC_SHA1_80);
#endif
}

static void GetSupportedDataCryptoSuites(
    std::vector<std::string>* crypto_suites) {
#ifdef HAVE_SRTP
  crypto_suites->push_back(CS_AES_CM_128_HMAC_SHA1_80);
#endif
}

// For video support only 80-bit SHA1 HMAC. For audio 32-bit HMAC is
// tolerated because it is low overhead. Pick the crypto in the list
// that is supported.
static bool SelectCrypto(const MediaContentDescription* offer,
                         CryptoParams *crypto) {
  bool audio = offer->type() == MEDIA_TYPE_AUDIO;
  const CryptoParamsVec& cryptos = offer->cryptos();

  for (CryptoParamsVec::const_iterator i = cryptos.begin();
       i != cryptos.end(); ++i) {
    if (CS_AES_CM_128_HMAC_SHA1_80 == i->cipher_suite ||
        (CS_AES_CM_128_HMAC_SHA1_32 == i->cipher_suite && audio)) {
      return CreateCryptoParams(i->tag, i->cipher_suite, crypto);
    }
  }
  return false;
}

static const StreamParams* FindFirstStreamParamsByCname(
    const StreamParamsVec& params_vec,
    const std::string& cname) {
  for (StreamParamsVec::const_iterator it = params_vec.begin();
       it != params_vec.end(); ++it) {
    if (cname == it->cname)
      return &*it;
  }
  return NULL;
}

// Generates a new CNAME or the CNAME of an already existing StreamParams
// if a StreamParams exist for another Stream in streams with sync_label
// sync_label.
static bool GenerateCname(const StreamParamsVec& params_vec,
                          const MediaSessionOptions::Streams& streams,
                          const std::string& synch_label,
                          std::string* cname) {
  ASSERT(cname != NULL);
  if (!cname)
    return false;

  // Check if a CNAME exist for any of the other synched streams.
  for (MediaSessionOptions::Streams::const_iterator stream_it = streams.begin();
       stream_it != streams.end() ; ++stream_it) {
    if (synch_label != stream_it->sync_label)
      continue;

    StreamParams param;
    // nick is empty for StreamParams generated using
    // MediaSessionDescriptionFactory.
    if (GetStreamByNickAndName(params_vec, "", stream_it->name,
                               &param)) {
      *cname = param.cname;
      return true;
    }
  }
  // No other stream seems to exist that we should sync with.
  // Generate a random string for the RTCP CNAME, as stated in RFC 6222.
  // This string is only used for synchronization, and therefore is opaque.
  do {
    if (!talk_base::CreateRandomString(16, cname)) {
      ASSERT(false);
      return false;
    }
  } while (FindFirstStreamParamsByCname(params_vec, *cname));

  return true;
}

// Generate a new SSRC and make sure it does not exist in params_vec.
static uint32 GenerateSsrc(const StreamParamsVec& params_vec) {
  uint32 ssrc = 0;
  do {
    ssrc = talk_base::CreateRandomNonZeroId();
  } while (GetStreamBySsrc(params_vec, ssrc, NULL));
  return ssrc;
}

// Finds all StreamParams of all media types and attach them to stream_params.
static void GetCurrentStreamParams(const SessionDescription* sdesc,
                                   StreamParamsVec* stream_params) {
  if (!sdesc)
    return;

  const ContentInfos& contents = sdesc->contents();
  for (ContentInfos::const_iterator content = contents.begin();
       content != contents.end(); content++) {
    if (!IsAudioContent(&*content) &&
        !IsVideoContent(&*content) &&
        !IsDataContent(&*content)) {
      continue;
    }
    const MediaContentDescription* media =
        static_cast<const MediaContentDescription*>(
            content->description);
    const StreamParamsVec& streams = media->streams();
    for (StreamParamsVec::const_iterator it = streams.begin();
         it != streams.end(); ++it) {
      stream_params->push_back(*it);
    }
  }
}

// Adds a StreamParams for each Stream in Streams with media type
// media_type to content_description.
// current_parms - All currently known StreamParams of any media type.
static bool AddStreamParams(
    MediaType media_type,
    const MediaSessionOptions::Streams& streams,
    StreamParamsVec* current_streams,
    MediaContentDescription* content_description) {
  for (MediaSessionOptions::Streams::const_iterator stream_it = streams.begin();
       stream_it != streams.end(); ++stream_it) {
    if (stream_it->type != media_type)
      continue;  // Wrong media type.

    StreamParams param;
    // nick is empty for StreamParams generated using
    // MediaSessionDescriptionFactory.
    if (!GetStreamByNickAndName(*current_streams, "", stream_it->name, &param)) {
      // This is a new stream.
      // Get a CNAME. Either new or same as one of the other synched streams.
      std::string cname;
      if (!GenerateCname(*current_streams, streams, stream_it->sync_label,
                         &cname)) {
        return false;
      }
      uint32 ssrc = GenerateSsrc(*current_streams);
      // TODO: Generate the more complex types of stream_params.

      StreamParams stream_param;
      stream_param.name = stream_it->name;
      stream_param.ssrcs.push_back(ssrc);
      stream_param.cname = cname;
      stream_param.sync_label = stream_it->sync_label;
      content_description->AddStream(stream_param);

      // Store the new StreamParams in current_streams.
      // This is necessary so that we can use the CNAME for other media types.
      current_streams->push_back(stream_param);
    } else {
      content_description->AddStream(param);
    }
  }
  return true;
}

// Create a media content to be offered in a session-initiate,
// according to the given options.rtcp_mux, options.is_muc,
// options.streams, codecs, crypto, and streams.  If we don't
// currently have crypto (in current_cryptos) and it is enabled (in
// secure_policy), crypto is created (according to crypto_suites).  If
// add_legacy_stream is true, and current_streams is empty, a legacy
// stream is created.  The created content is added to the offer.
template <class C>
static bool CreateMediaContentOffer(
    const MediaSessionOptions& options,
    const std::vector<C>& codecs,
    const SecureMediaPolicy& secure_policy,
    const CryptoParamsVec* current_cryptos,
    const std::vector<std::string>& crypto_suites,
    bool add_legacy_stream,
    StreamParamsVec* current_streams,
    MediaContentDescriptionImpl<C>* offer) {
  offer->AddCodecs(codecs);
  offer->SortCodecs();

  offer->set_crypto_required(secure_policy == SEC_REQUIRED);
  offer->set_rtcp_mux(options.rtcp_mux_enabled);
  offer->set_multistream(options.is_muc);

  if (!AddStreamParams(
          offer->type(), options.streams, current_streams, offer)) {
    return false;
  }

  if (options.streams.empty() && add_legacy_stream) {
    // TODO: Remove this legacy stream when all apps use StreamParams.
    offer->AddLegacyStream(talk_base::CreateRandomNonZeroId());
  }

  if (secure_policy != SEC_DISABLED) {
    if (current_cryptos) {
      AddMediaCryptos(*current_cryptos, offer);
    }
    if (offer->cryptos().empty()) {
      if (!CreateMediaCryptos(crypto_suites, offer)) {
        return false;
      }
    }
  }

  if (offer->crypto_required() && offer->cryptos().empty()) {
    return false;
  }

  return true;
}

template <class C>
static void NegotiateCodecs(const std::vector<C>& local_codecs,
                     const std::vector<C>& offered_codecs,
                     std::vector<C>* negotiated_codecs) {
  typename std::vector<C>::const_iterator ours;
  for (ours = local_codecs.begin();
       ours != local_codecs.end(); ++ours) {
    typename std::vector<C>::const_iterator theirs;
    for (theirs = offered_codecs.begin();
         theirs != offered_codecs.end(); ++theirs) {
      if (ours->Matches(*theirs)) {
        C negotiated(*ours);
        negotiated.id = theirs->id;
        negotiated_codecs->push_back(negotiated);
      }
    }
  }
}

// Create a media content to be answered in a session-accept,
// according to the given options.rtcp_mux, options.streams, codecs,
// crypto, and streams.  If we don't currently have crypto (in
// current_cryptos) and it is enabled (in secure_policy), crypto is
// created (according to crypto_suites).  If add_legacy_stream is
// true, and current_streams is empty, a legacy stream is created.
// The codecs, rtcp_mux, and crypto are all negotiated with the offer
// from the incoming session-initiate.  If the negotiation fails, this
// method returns false.  The created content is added to the offer.
template <class C>
static bool CreateMediaContentAnswer(
    const MediaContentDescriptionImpl<C>* offer,
    const MediaSessionOptions& options,
    const std::vector<C>& local_codecs,
    const SecureMediaPolicy& secure_policy,
    const CryptoParamsVec* current_cryptos,
    StreamParamsVec* current_streams,
    bool add_legacy_stream,
    MediaContentDescriptionImpl<C>* answer) {
  std::vector<C> negotiated_codecs;
  NegotiateCodecs(local_codecs, offer->codecs(), &negotiated_codecs);
  answer->AddCodecs(negotiated_codecs);
  answer->SortCodecs();

  answer->set_rtcp_mux(options.rtcp_mux_enabled && offer->rtcp_mux());

  if (secure_policy != SEC_DISABLED) {
    CryptoParams crypto;
    if (SelectCrypto(offer, &crypto)) {
      if (current_cryptos) {
        FindMatchingCrypto(*current_cryptos, crypto, &crypto);
      }
      answer->AddCrypto(crypto);
    }
  }

  if (answer->cryptos().empty() &&
      (offer->crypto_required() || secure_policy == SEC_REQUIRED)) {
    return false;
  }

  if (!AddStreamParams(
          answer->type(), options.streams, current_streams, answer)) {
    return false;  // Something went seriously wrong.
  }

  if (options.streams.empty() && add_legacy_stream) {
    // TODO: Remove this legacy stream when all apps use StreamParams.
    answer->AddLegacyStream(talk_base::CreateRandomNonZeroId());
  }

  return true;
}

void MediaSessionOptions::AddStream(MediaType type,
                                    const std::string& name,
                                    const std::string& sync_label) {
  streams.push_back(Stream(type, name, sync_label));

  if (type == MEDIA_TYPE_VIDEO)
    has_video = true;
  else if (type == MEDIA_TYPE_AUDIO)
    has_audio = true;
  else if (type == MEDIA_TYPE_DATA)
    has_data = true;
}

void MediaSessionOptions::RemoveStream(MediaType type,
                                       const std::string& name) {
  Streams::iterator stream_it = streams.begin();
  for (; stream_it != streams.end(); ++stream_it) {
    if (stream_it->type == type && stream_it->name == name) {
      streams.erase(stream_it);
      return;
    }
  }
  ASSERT(false);
}

MediaSessionDescriptionFactory::MediaSessionDescriptionFactory()
    : secure_(SEC_DISABLED),
      add_legacy_(true) {
}

MediaSessionDescriptionFactory::MediaSessionDescriptionFactory(
    ChannelManager* channel_manager)
    : secure_(SEC_DISABLED),
      add_legacy_(true) {
  channel_manager->GetSupportedAudioCodecs(&audio_codecs_);
  channel_manager->GetSupportedVideoCodecs(&video_codecs_);
  channel_manager->GetSupportedDataCodecs(&data_codecs_);
}

SessionDescription* MediaSessionDescriptionFactory::CreateOffer(
    const MediaSessionOptions& options,
    const SessionDescription* current_description) {
  scoped_ptr<SessionDescription> offer(new SessionDescription());

  StreamParamsVec current_streams;
  GetCurrentStreamParams(current_description, &current_streams);

  if (options.has_audio) {
    scoped_ptr<AudioContentDescription> audio(new AudioContentDescription());
    std::vector<std::string> crypto_suites;
    GetSupportedAudioCryptoSuites(&crypto_suites);

    if (!CreateMediaContentOffer(
            options,
            audio_codecs_,
            secure(),
            GetCryptos(GetFirstAudioContentDescription(current_description)),
            crypto_suites,
            add_legacy_,
            &current_streams,
            audio.get())) {
      return NULL;
    }
    audio->set_lang(lang_);
    offer->AddContent(CN_AUDIO, NS_JINGLE_RTP, audio.release());
  }

  if (options.has_video) {
    scoped_ptr<VideoContentDescription> video(new VideoContentDescription());
    std::vector<std::string> crypto_suites;
    GetSupportedVideoCryptoSuites(&crypto_suites);

    if (!CreateMediaContentOffer(
            options,
            video_codecs_,
            secure(),
            GetCryptos(GetFirstVideoContentDescription(current_description)),
            crypto_suites,
            add_legacy_,
            &current_streams,
            video.get())) {
      return NULL;
    }

    video->set_bandwidth(options.video_bandwidth);
    offer->AddContent(CN_VIDEO, NS_JINGLE_RTP, video.release());
  }

  if (options.has_data) {
    scoped_ptr<DataContentDescription> data(new DataContentDescription());
    std::vector<std::string> crypto_suites;
    GetSupportedDataCryptoSuites(&crypto_suites);

    if (!CreateMediaContentOffer(
            options,
            data_codecs_,
            secure(),
            GetCryptos(GetFirstDataContentDescription(current_description)),
            crypto_suites,
            add_legacy_,
            &current_streams,
            data.get())) {
      return NULL;
    }

    data->set_bandwidth(options.data_bandwidth);
    offer->AddContent(CN_DATA, NS_JINGLE_RTP, data.release());
  }

  return offer.release();
}

SessionDescription* MediaSessionDescriptionFactory::CreateAnswer(
    const SessionDescription* offer, const MediaSessionOptions& options,
    const SessionDescription* current_description) {
  // The answer contains the intersection of the codecs in the offer with the
  // codecs we support, ordered by our local preference. As indicated by
  // XEP-0167, we retain the same payload ids from the offer in the answer.
  scoped_ptr<SessionDescription> accept(new SessionDescription());

  StreamParamsVec current_streams;
  GetCurrentStreamParams(current_description, &current_streams);

  const ContentInfo* audio_content = GetFirstAudioContent(offer);
  if (audio_content && options.has_audio) {
    scoped_ptr<AudioContentDescription> audio_accept(
        new AudioContentDescription());
    if (!CreateMediaContentAnswer(
            static_cast<const AudioContentDescription*>(
                audio_content->description),
            options,
            audio_codecs_,
            secure(),
            GetCryptos(GetFirstAudioContentDescription(current_description)),
            &current_streams,
            add_legacy_,
            audio_accept.get())) {
      return NULL;  // Fails the session setup.
    }
    accept->AddContent(audio_content->name, audio_content->type,
                       audio_accept.release());
  } else {
    LOG(LS_INFO) << "Audio is not supported in answer";
  }

  const ContentInfo* video_content = GetFirstVideoContent(offer);
  if (video_content && options.has_video) {
    scoped_ptr<VideoContentDescription> video_accept(
        new VideoContentDescription());
    if (!CreateMediaContentAnswer(
            static_cast<const VideoContentDescription*>(
                video_content->description),
            options,
            video_codecs_,
            secure(),
            GetCryptos(GetFirstVideoContentDescription(current_description)),
            &current_streams,
            add_legacy_,
            video_accept.get())) {
      return NULL;  // Fails the session setup.
    }
    video_accept->set_bandwidth(options.video_bandwidth);
    accept->AddContent(video_content->name, video_content->type,
                       video_accept.release());
  } else {
    LOG(LS_INFO) << "Video is not supported in answer";
  }

  const ContentInfo* data_content = GetFirstDataContent(offer);
  if (data_content && options.has_data) {
    scoped_ptr<DataContentDescription> data_accept(
        new DataContentDescription());
    if (!CreateMediaContentAnswer(
            static_cast<const DataContentDescription*>(
                data_content->description),
            options,
            data_codecs_,
            secure(),
            GetCryptos(GetFirstDataContentDescription(current_description)),
            &current_streams,
            add_legacy_,
            data_accept.get())) {
      return NULL;  // Fails the session setup.
    }
    data_accept->set_bandwidth(options.data_bandwidth);
    accept->AddContent(data_content->name, data_content->type,
                       data_accept.release());
  } else {
    LOG(LS_INFO) << "Data is not supported in answer";
  }

  return accept.release();
}

static bool IsMediaContent(const ContentInfo* content, MediaType media_type) {
  if (content == NULL || content->type != NS_JINGLE_RTP) {
    return false;
  }

  const MediaContentDescription* media =
      static_cast<const MediaContentDescription*>(content->description);
  return media->type() == media_type;
}

bool IsAudioContent(const ContentInfo* content) {
  return IsMediaContent(content, MEDIA_TYPE_AUDIO);
}

bool IsVideoContent(const ContentInfo* content) {
  return IsMediaContent(content, MEDIA_TYPE_VIDEO);
}

bool IsDataContent(const ContentInfo* content) {
  return IsMediaContent(content, MEDIA_TYPE_DATA);
}

static const ContentInfo* GetFirstMediaContent(const ContentInfos& contents,
                                               MediaType media_type) {
  for (ContentInfos::const_iterator content = contents.begin();
       content != contents.end(); content++) {
    if (IsMediaContent(&*content, media_type)) {
      return &*content;
    }
  }
  return NULL;
}

const ContentInfo* GetFirstAudioContent(const ContentInfos& contents) {
  return GetFirstMediaContent(contents, MEDIA_TYPE_AUDIO);
}

const ContentInfo* GetFirstVideoContent(const ContentInfos& contents) {
  return GetFirstMediaContent(contents, MEDIA_TYPE_VIDEO);
}

const ContentInfo* GetFirstDataContent(const ContentInfos& contents) {
  return GetFirstMediaContent(contents, MEDIA_TYPE_DATA);
}

static const ContentInfo* GetFirstMediaContent(const SessionDescription* sdesc,
                                               MediaType media_type) {
  if (sdesc == NULL)
    return NULL;

  return GetFirstMediaContent(sdesc->contents(), media_type);
}

const ContentInfo* GetFirstAudioContent(const SessionDescription* sdesc) {
  return GetFirstMediaContent(sdesc, MEDIA_TYPE_AUDIO);
}

const ContentInfo* GetFirstVideoContent(const SessionDescription* sdesc) {
  return GetFirstMediaContent(sdesc, MEDIA_TYPE_VIDEO);
}

const ContentInfo* GetFirstDataContent(const SessionDescription* sdesc) {
  return GetFirstMediaContent(sdesc, MEDIA_TYPE_DATA);
}

const MediaContentDescription* GetFirstMediaContentDescription(
    const SessionDescription* sdesc, MediaType media_type) {
  const ContentInfo* content = GetFirstMediaContent(sdesc, media_type);
  const ContentDescription* description = content ? content->description : NULL;
  return static_cast<const MediaContentDescription*>(description);
}

const AudioContentDescription* GetFirstAudioContentDescription(
    const SessionDescription* sdesc) {
  return static_cast<const AudioContentDescription*>(
      GetFirstMediaContentDescription(sdesc, MEDIA_TYPE_AUDIO));
}

const VideoContentDescription* GetFirstVideoContentDescription(
    const SessionDescription* sdesc) {
  return static_cast<const VideoContentDescription*>(
      GetFirstMediaContentDescription(sdesc, MEDIA_TYPE_VIDEO));
}

const DataContentDescription* GetFirstDataContentDescription(
    const SessionDescription* sdesc) {
  return static_cast<const DataContentDescription*>(
      GetFirstMediaContentDescription(sdesc, MEDIA_TYPE_DATA));
}

}  // namespace cricket
