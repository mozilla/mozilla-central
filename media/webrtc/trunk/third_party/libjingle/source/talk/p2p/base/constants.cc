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

#include <string>

#include "talk/p2p/base/constants.h"
#include "talk/xmllite/qname.h"

namespace cricket {

const std::string NS_EMPTY("");
const std::string NS_JINGLE("urn:xmpp:jingle:1");
const std::string NS_JINGLE_DRAFT("google:jingle");
const std::string NS_GINGLE("http://www.google.com/session");

// actions (aka <session> or <jingle>)
const buzz::QName QN_ACTION(true, NS_EMPTY, "action");
const std::string LN_INITIATOR("initiator");
const buzz::QName QN_INITIATOR(true, NS_EMPTY, LN_INITIATOR);
const buzz::QName QN_CREATOR(true, NS_EMPTY, "creator");

const buzz::QName QN_JINGLE(true, NS_JINGLE, "jingle");
const buzz::QName QN_JINGLE_CONTENT(true, NS_JINGLE, "content");
const buzz::QName QN_JINGLE_CONTENT_NAME(true, NS_EMPTY, "name");
const buzz::QName QN_JINGLE_CONTENT_MEDIA(true, NS_EMPTY, "media");
const buzz::QName QN_JINGLE_REASON(true, NS_JINGLE, "reason");
const std::string JINGLE_CONTENT_MEDIA_AUDIO("audio");
const std::string JINGLE_CONTENT_MEDIA_VIDEO("video");
const std::string JINGLE_ACTION_SESSION_INITIATE("session-initiate");
const std::string JINGLE_ACTION_SESSION_INFO("session-info");
const std::string JINGLE_ACTION_SESSION_ACCEPT("session-accept");
const std::string JINGLE_ACTION_SESSION_TERMINATE("session-terminate");
const std::string JINGLE_ACTION_TRANSPORT_INFO("transport-info");
const std::string JINGLE_ACTION_TRANSPORT_ACCEPT("transport-accept");
const std::string JINGLE_ACTION_DESCRIPTION_INFO("description-info");

const buzz::QName QN_GINGLE_SESSION(true, NS_GINGLE, "session");
const std::string GINGLE_ACTION_INITIATE("initiate");
const std::string GINGLE_ACTION_INFO("info");
const std::string GINGLE_ACTION_ACCEPT("accept");
const std::string GINGLE_ACTION_REJECT("reject");
const std::string GINGLE_ACTION_TERMINATE("terminate");
const std::string GINGLE_ACTION_CANDIDATES("candidates");
const std::string GINGLE_ACTION_UPDATE("update");

const std::string LN_ERROR("error");
const buzz::QName QN_GINGLE_REDIRECT(true, NS_GINGLE, "redirect");
const std::string STR_REDIRECT_PREFIX("xmpp:");

// Session Contents (aka Gingle <session><description>
//                   or Jingle <content><description>)
const std::string LN_DESCRIPTION("description");
const std::string LN_PAYLOADTYPE("payload-type");
const buzz::QName QN_ID(true, NS_EMPTY, "id");
const buzz::QName QN_SID(true, NS_EMPTY, "sid");
const buzz::QName QN_NAME(true, NS_EMPTY, "name");
const buzz::QName QN_CLOCKRATE(true, NS_EMPTY, "clockrate");
const buzz::QName QN_BITRATE(true, NS_EMPTY, "bitrate");
const buzz::QName QN_CHANNELS(true, NS_EMPTY, "channels");
const buzz::QName QN_WIDTH(true, NS_EMPTY, "width");
const buzz::QName QN_HEIGHT(true, NS_EMPTY, "height");
const buzz::QName QN_FRAMERATE(true, NS_EMPTY, "framerate");
const std::string LN_NAME("name");
const std::string LN_VALUE("value");
const buzz::QName QN_PAYLOADTYPE_PARAMETER_NAME(true, NS_EMPTY, LN_NAME);
const buzz::QName QN_PAYLOADTYPE_PARAMETER_VALUE(true, NS_EMPTY, LN_VALUE);
const std::string PAYLOADTYPE_PARAMETER_BITRATE("bitrate");
const std::string PAYLOADTYPE_PARAMETER_HEIGHT("height");
const std::string PAYLOADTYPE_PARAMETER_WIDTH("width");
const std::string PAYLOADTYPE_PARAMETER_FRAMERATE("framerate");
const std::string LN_BANDWIDTH("bandwidth");

const std::string CN_AUDIO("audio");
const std::string CN_VIDEO("video");
const std::string CN_OTHER("main");

const std::string NS_JINGLE_RTP("urn:xmpp:jingle:apps:rtp:1");
const buzz::QName QN_JINGLE_RTP_CONTENT(
    true, NS_JINGLE_RTP, LN_DESCRIPTION);
const buzz::QName QN_JINGLE_SSRC(true, NS_EMPTY, "ssrc");
const buzz::QName QN_JINGLE_RTP_PAYLOADTYPE(
    true, NS_JINGLE_RTP, LN_PAYLOADTYPE);
const buzz::QName QN_JINGLE_RTP_BANDWIDTH(
    true, NS_JINGLE_RTP, LN_BANDWIDTH);
const buzz::QName QN_JINGLE_RTCP_MUX(true, NS_JINGLE_RTP, "rtcp-mux");
const buzz::QName QN_PARAMETER(true, NS_JINGLE_RTP, "parameter");

const std::string NS_GINGLE_AUDIO("http://www.google.com/session/phone");
const buzz::QName QN_GINGLE_AUDIO_CONTENT(
    true, NS_GINGLE_AUDIO, LN_DESCRIPTION);
const buzz::QName QN_GINGLE_AUDIO_PAYLOADTYPE(
    true, NS_GINGLE_AUDIO, LN_PAYLOADTYPE);
const buzz::QName QN_GINGLE_AUDIO_SRCID(true, NS_GINGLE_AUDIO, "src-id");
const std::string NS_GINGLE_VIDEO("http://www.google.com/session/video");
const buzz::QName QN_GINGLE_VIDEO_CONTENT(
    true, NS_GINGLE_VIDEO, LN_DESCRIPTION);
const buzz::QName QN_GINGLE_VIDEO_PAYLOADTYPE(
    true, NS_GINGLE_VIDEO, LN_PAYLOADTYPE);
const buzz::QName QN_GINGLE_VIDEO_SRCID(true, NS_GINGLE_VIDEO, "src-id");
const buzz::QName QN_GINGLE_VIDEO_BANDWIDTH(
    true, NS_GINGLE_VIDEO, LN_BANDWIDTH);

// Crypto support.
const buzz::QName QN_ENCRYPTION(true, NS_JINGLE_RTP, "encryption");
const buzz::QName QN_ENCRYPTION_REQUIRED(true, NS_EMPTY, "required");
const buzz::QName QN_CRYPTO(true, NS_JINGLE_RTP, "crypto");
const buzz::QName QN_GINGLE_AUDIO_CRYPTO_USAGE(true, NS_GINGLE_AUDIO, "usage");
const buzz::QName QN_GINGLE_VIDEO_CRYPTO_USAGE(true, NS_GINGLE_VIDEO, "usage");
const buzz::QName QN_CRYPTO_SUITE(true, NS_EMPTY, "crypto-suite");
const buzz::QName QN_CRYPTO_KEY_PARAMS(true, NS_EMPTY, "key-params");
const buzz::QName QN_CRYPTO_TAG(true, NS_EMPTY, "tag");
const buzz::QName QN_CRYPTO_SESSION_PARAMS(true, NS_EMPTY, "session-params");

// transports and candidates
const std::string LN_TRANSPORT("transport");
const std::string LN_CANDIDATE("candidate");
const buzz::QName QN_UFRAG(true, cricket::NS_EMPTY, "ufrag");
const buzz::QName QN_PWD(true, cricket::NS_EMPTY, "pwd");
const buzz::QName QN_COMPONENT(true, cricket::NS_EMPTY, "component");
const buzz::QName QN_IP(true, cricket::NS_EMPTY, "ip");
const buzz::QName QN_PORT(true, cricket::NS_EMPTY, "port");
const buzz::QName QN_NETWORK(true, cricket::NS_EMPTY, "network");
const buzz::QName QN_GENERATION(true, cricket::NS_EMPTY, "generation");
const buzz::QName QN_PRIORITY(true, cricket::NS_EMPTY, "priority");
const buzz::QName QN_PROTOCOL(true, cricket::NS_EMPTY, "protocol");
const std::string JINGLE_CANDIDATE_TYPE_PEER_STUN("prflx");
const std::string JINGLE_CANDIDATE_TYPE_SERVER_STUN("srflx");
const std::string JINGLE_CANDIDATE_NAME_RTP("1");
const std::string JINGLE_CANDIDATE_NAME_RTCP("2");

// TODO Once we are full ICE-UDP compliant, use this namespace.
// For now, just use the same as NS_GINGLE_P2P.
// const std::string NS_JINGLE_ICE_UDP("urn:xmpp:jingle:transports:ice-udp:1");
const std::string NS_GINGLE_P2P("http://www.google.com/transport/p2p");
const buzz::QName QN_GINGLE_P2P_TRANSPORT(true, NS_GINGLE_P2P, LN_TRANSPORT);
const buzz::QName QN_GINGLE_P2P_CANDIDATE(true, NS_GINGLE_P2P, LN_CANDIDATE);
const buzz::QName QN_GINGLE_P2P_UNKNOWN_CHANNEL_NAME(
    true, NS_GINGLE_P2P, "unknown-channel-name");
const buzz::QName QN_GINGLE_CANDIDATE(true, NS_GINGLE, LN_CANDIDATE);
const buzz::QName QN_ADDRESS(true, cricket::NS_EMPTY, "address");
const buzz::QName QN_USERNAME(true, cricket::NS_EMPTY, "username");
const buzz::QName QN_PASSWORD(true, cricket::NS_EMPTY, "password");
const buzz::QName QN_PREFERENCE(true, cricket::NS_EMPTY, "preference");
const std::string GINGLE_CANDIDATE_TYPE_STUN("stun");
const std::string GINGLE_CANDIDATE_NAME_RTP("rtp");
const std::string GINGLE_CANDIDATE_NAME_RTCP("rtcp");
const std::string GINGLE_CANDIDATE_NAME_VIDEO_RTP("video_rtp");
const std::string GINGLE_CANDIDATE_NAME_VIDEO_RTCP("video_rtcp");

// terminate reasons and errors
const std::string JINGLE_ERROR_BAD_REQUEST("bad-request");
const std::string JINGLE_ERROR_OUT_OF_ORDER("out-of-order");
const std::string JINGLE_ERROR_UNKNOWN_SESSION("unknown-session");

// Call terminate reasons from XEP-166
const std::string STR_TERMINATE_DECLINE("decline");
const std::string STR_TERMINATE_SUCCESS("success");
const std::string STR_TERMINATE_ERROR("general-error");
const std::string STR_TERMINATE_INCOMPATIBLE_PARAMETERS(
    "incompatible-parameters");

// Old terminate reasons used by cricket
const std::string STR_TERMINATE_CALL_ENDED("call-ended");
const std::string STR_TERMINATE_RECIPIENT_UNAVAILABLE("recipient-unavailable");
const std::string STR_TERMINATE_RECIPIENT_BUSY("recipient-busy");
const std::string STR_TERMINATE_INSUFFICIENT_FUNDS("insufficient-funds");
const std::string STR_TERMINATE_NUMBER_MALFORMED("number-malformed");
const std::string STR_TERMINATE_NUMBER_DISALLOWED("number-disallowed");
const std::string STR_TERMINATE_PROTOCOL_ERROR("protocol-error");
const std::string STR_TERMINATE_INTERNAL_SERVER_ERROR("internal-server-error");
const std::string STR_TERMINATE_UNKNOWN_ERROR("unknown-error");

// Draft view and notify messages.
const buzz::QName QN_JINGLE_DRAFT_CONTENT_NAME(true, cricket::NS_EMPTY, "name");
const std::string STR_JINGLE_DRAFT_CONTENT_NAME_VIDEO("video");
const std::string STR_JINGLE_DRAFT_CONTENT_NAME_AUDIO("audio");
const buzz::QName QN_JINGLE_DRAFT_NOTIFY(true, NS_JINGLE_DRAFT, "notify");
const buzz::QName QN_JINGLE_DRAFT_SOURCE(
    true, NS_JINGLE_DRAFT, "source");
const buzz::QName QN_JINGLE_DRAFT_SOURCE_NICK(true, cricket::NS_EMPTY, "nick");
const buzz::QName QN_JINGLE_DRAFT_SOURCE_NAME(true, cricket::NS_EMPTY, "name");
const buzz::QName QN_JINGLE_DRAFT_SOURCE_USAGE(true, cricket::NS_EMPTY, "usage");
const buzz::QName QN_JINGLE_DRAFT_SOURCE_STATE(true, cricket::NS_EMPTY, "state");
const std::string STR_JINGLE_DRAFT_SOURCE_STATE_REMOVED("removed");
const buzz::QName QN_JINGLE_DRAFT_SOURCE_SSRC(true, NS_JINGLE_DRAFT, "ssrc");
const buzz::QName QN_JINGLE_DRAFT_VIEW(true, NS_JINGLE_DRAFT, "view");
const buzz::QName QN_JINGLE_DRAFT_VIEW_TYPE(true, cricket::NS_EMPTY, "type");
const std::string STR_JINGLE_DRAFT_VIEW_TYPE_NONE("none");
const std::string STR_JINGLE_DRAFT_VIEW_TYPE_STATIC("static");
const buzz::QName QN_JINGLE_DRAFT_VIEW_SSRC(true, cricket::NS_EMPTY, "ssrc");
const buzz::QName QN_JINGLE_DRAFT_VIEW_PARAMS(true, NS_JINGLE_DRAFT, "params");
const buzz::QName QN_JINGLE_DRAFT_VIEW_PARAMS_WIDTH(
    true, cricket::NS_EMPTY, "width");
const buzz::QName QN_JINGLE_DRAFT_VIEW_PARAMS_HEIGHT(
    true, cricket::NS_EMPTY, "height");
const buzz::QName QN_JINGLE_DRAFT_VIEW_PARAMS_FRAMERATE(
    true, cricket::NS_EMPTY, "framerate");
const buzz::QName QN_JINGLE_DRAFT_VIEW_PARAMS_PREFERENCE(
    true, cricket::NS_EMPTY, "preference");

// old stuff
#ifdef FEATURE_ENABLE_VOICEMAIL
const std::string NS_VOICEMAIL("http://www.google.com/session/voicemail");
const buzz::QName QN_VOICEMAIL_REGARDING(true, NS_VOICEMAIL, "regarding");
#endif

}  // namespace cricket
