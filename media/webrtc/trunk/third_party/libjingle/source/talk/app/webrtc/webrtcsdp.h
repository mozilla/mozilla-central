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

// This file contain functions for parsing and serializing SDP messages.
// Related RFC/draft including:
// * RFC 4566 - SDP
// * RFC 5245 - ICE
// * RFC 3388 - Grouping of Media Lines in SDP
// * RFC 4568 - SDP Security Descriptions for Media Streams
// * draft-lennox-mmusic-sdp-source-selection-02 -
//   Mechanisms for Media Source Selection in SDP

#ifndef TALK_APP_WEBRTC_WEBRTCSDP_H_
#define TALK_APP_WEBRTC_WEBRTCSDP_H_

#include <string>
#include <vector>

#include "talk/p2p/base/candidate.h"

namespace cricket {
class SessionDescription;
}

namespace webrtc {

// Serializes the passed in SessionDescription and Candidates to a SDP string.
// desc - The SessionDescription object to be serialized.
// candidates - The Set of Candidate objects to be serialized.
// return - SDP string serialized from the arguments.
std::string SdpSerialize(const cricket::SessionDescription& desc,
                         const std::vector<cricket::Candidate>& candidates);

// Serializes the passed in SessionDescription to a SDP string.
// desc - The SessionDescription object to be serialized.
std::string SdpSerializeSessionDescription(
    const cricket::SessionDescription& desc);

// Serializes the passed in Candidates to a SDP string.
// candidates - The Set of Candidate objects to be serialized.
std::string SdpSerializeCandidates(
    const std::vector<cricket::Candidate>& candidates);

// Deserializes the passed in SDP string to a SessionDescription and Candidates.
// message - SDP string to be Deserialized.
// desc - The SessionDescription object deserialized from the SDP string.
// candidates - The set of Candidate deserialized from the SDP string.
// return - true on success, false on failure.
bool SdpDeserialize(const std::string& message,
                    cricket::SessionDescription* desc,
                    std::vector<cricket::Candidate>* candidates);

// Deserializes the passed in SDP string to a SessionDescription.
// Candidates are ignored.
// message - SDP string to be Deserialized.
// desc - The SessionDescription object deserialized from the SDP string.
// return - true on success, false on failure.
bool SdpDeserializeSessionDescription(const std::string& message,
                                      cricket::SessionDescription* desc);

// Deserializes the passed in SDP string to Candidates.
// Only the candidates are parsed from the SDP string.
// message - SDP string to be Deserialized.
// candidates - The set of Candidate deserialized from the SDP string.
// return - true on success, false on failure.
bool SdpDeserializeCandidates(const std::string& message,
                              std::vector<cricket::Candidate>* candidates);

// Formats a correct SDP string by reformatting a session description and
// candidates.
std::string SdpFormat(const std::string& desc, const std::string& candidates);

}  // namespace webrtc

#endif  // TALK_APP_WEBRTC_WEBRTCSDP_H_
