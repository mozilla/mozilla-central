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

#ifndef TALK_P2P_BASE_SESSIONDESCRIPTION_H_
#define TALK_P2P_BASE_SESSIONDESCRIPTION_H_

#include <set>
#include <string>
#include <vector>

#include "talk/base/constructormagic.h"

namespace cricket {

// Describes a session content. Individual content types inherit from
// this class.  Analagous to a <jingle><content><description> or
// <session><description>.
class ContentDescription {
 public:
  virtual ~ContentDescription() {}
  virtual ContentDescription* Copy() const = 0;
};

// Analagous to a <jingle><content> or <session><description>.
// name = name of <content name="...">
// type = xmlns of <content>
struct ContentInfo {
  ContentInfo() : description(NULL) {}
  ContentInfo(const std::string& name,
              const std::string& type,
              const ContentDescription* description) :
      name(name), type(type), description(description) {}
  std::string name;
  std::string type;
  const ContentDescription* description;
};

// This class provides a mechanism to aggregate different media contents into a
// group. This group can also be shared with the peers in a pre-defined format.
// GroupInfo should be populated only with the |content_name| of the
// MediaDescription.
class ContentGroup {
 public:
  explicit ContentGroup(const std::string& semantics) :
      semantics_(semantics) {}
  void AddContentName(const std::string& content_name);
  bool RemoveContentName(const std::string& content_name);
  bool HasContentName(const std::string& content_name) const;
  const std::string* FirstContentName() const;
  const std::string& semantics() const { return semantics_; }
  const std::set<std::string>& content_types() const { return content_types_; }

 private:
  std::string semantics_;
  std::set<std::string> content_types_;
};

typedef std::vector<ContentInfo> ContentInfos;
typedef std::vector<ContentGroup> ContentGroups;

const ContentInfo* FindContentInfoByName(
    const ContentInfos& contents, const std::string& name);
const ContentInfo* FindContentInfoByType(
    const ContentInfos& contents, const std::string& type);

// Describes a collection of contents, each with its own name and
// type.  Analgous to a <jingle> or <session> stanza.  Assumes that
// contents are unique be name, but doesn't enforce that.
class SessionDescription {
 public:
  SessionDescription() {}
  explicit SessionDescription(const ContentInfos& contents) :
      contents_(contents) {}
  SessionDescription(const ContentInfos& contents,
                     const ContentGroups& groups) :
      contents_(contents),
      content_groups_(groups) {}
  SessionDescription* Copy() const;
  const ContentInfo* GetContentByName(const std::string& name) const;
  const ContentInfo* FirstContentByType(const std::string& type) const;
  const ContentInfo* FirstContent() const;
  // Takes ownership of ContentDescription*.
  void AddContent(const std::string& name,
                  const std::string& type,
                  const ContentDescription* description);
  bool RemoveContentByName(const std::string& name);
  const ContentInfos& contents() const { return contents_; }
  const ContentGroups& groups() const { return content_groups_; }

  ~SessionDescription() {
    for (ContentInfos::iterator content = contents_.begin();
         content != contents_.end(); content++) {
      delete content->description;
    }
  }
  bool HasGroup(const std::string& name) const;
  void AddGroup(const ContentGroup& group) { content_groups_.push_back(group); }
  // Remove the first group with the same semantics specified by |name|.
  void RemoveGroupByName(const std::string& name);
  const ContentGroup* GetGroupByName(const std::string& name) const;

 private:
  ContentInfos contents_;
  ContentGroups content_groups_;
};

// Indicates whether a ContentDescription was an offer or an answer, as
// described in http://www.ietf.org/rfc/rfc3264.txt. CA_UPDATE
// indicates a jingle update message which contains a subset of a full
// session description
enum ContentAction {
  CA_OFFER, CA_ANSWER, CA_UPDATE
};

// Indicates whether a ContentDescription was sent by the local client
// or received from the remote client.
enum ContentSource {
  CS_LOCAL, CS_REMOTE
};

}  // namespace cricket

#endif  // TALK_P2P_BASE_SESSIONDESCRIPTION_H_
