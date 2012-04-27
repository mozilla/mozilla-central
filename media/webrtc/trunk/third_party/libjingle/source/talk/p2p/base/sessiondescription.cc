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

#include "talk/p2p/base/sessiondescription.h"

#include "talk/xmllite/xmlelement.h"

namespace cricket {

const ContentInfo* FindContentInfoByName(
    const ContentInfos& contents, const std::string& name) {
  for (ContentInfos::const_iterator content = contents.begin();
       content != contents.end(); content++) {
    if (content->name == name) {
      return &(*content);
    }
  }
  return NULL;
}

const ContentInfo* FindContentInfoByType(
    const ContentInfos& contents, const std::string& type) {
  for (ContentInfos::const_iterator content = contents.begin();
       content != contents.end(); content++) {
    if (content->type == type) {
      return &(*content);
    }
  }
  return NULL;
}

void ContentGroup::AddContentName(const std::string& content_name) {
  content_types_.insert(content_name);
}

bool ContentGroup::RemoveContentName(const std::string& content_name) {
  bool ret = false;
  std::set<std::string>::iterator iter;
  iter = content_types_.find(content_name);
  if (iter != content_types_.end()) {
    content_types_.erase(iter);
    ret = true;
  }
  return ret;
}

bool ContentGroup::HasContentName(const std::string& content_name) const {
  return (content_types_.find(content_name) != content_types_.end());
}

const std::string* ContentGroup::FirstContentName() const {
  return (content_types_.begin() != content_types_.end()) ?
      &(*content_types_.begin()) : NULL;
}

SessionDescription* SessionDescription::Copy() const {
  SessionDescription* copy = new SessionDescription(*this);
  // Copy all ContentDescriptions.
  for (ContentInfos::iterator content = copy->contents_.begin();
      content != copy->contents().end(); ++content) {
    content->description = content->description->Copy();
  }
  return copy;
}
const ContentInfo* SessionDescription::GetContentByName(
    const std::string& name) const {
  return FindContentInfoByName(contents_, name);
}

const ContentInfo* SessionDescription::FirstContentByType(
    const std::string& type) const {
  return FindContentInfoByType(contents_, type);
}

const ContentInfo* SessionDescription::FirstContent() const {
  return (contents_.empty()) ? NULL : &(*contents_.begin());
}

void SessionDescription::AddContent(const std::string& name,
                                    const std::string& type,
                                    const ContentDescription* description) {
  contents_.push_back(ContentInfo(name, type, description));
}

bool SessionDescription::RemoveContentByName(const std::string& name) {
  for (ContentInfos::iterator content = contents_.begin();
       content != contents_.end(); ++content) {
    if (content->name == name) {
      delete content->description;
      contents_.erase(content);
      return true;
    }
  }

  return false;
}

void SessionDescription::RemoveGroupByName(const std::string& name) {
  for (ContentGroups::iterator iter = content_groups_.begin();
       iter != content_groups_.end(); ++iter) {
    if (iter->semantics() == name) {
      content_groups_.erase(iter);
      break;
    }
  }
}

bool SessionDescription::HasGroup(const std::string& name) const {
  for (ContentGroups::const_iterator iter = content_groups_.begin();
       iter != content_groups_.end(); ++iter) {
    if (iter->semantics() == name) {
      return true;
    }
  }
  return false;
}

const ContentGroup* SessionDescription::GetGroupByName(
    const std::string& name) const {
  for (ContentGroups::const_iterator iter = content_groups_.begin();
       iter != content_groups_.end(); ++iter) {
    if (iter->semantics() == name) {
      return &(*iter);
    }
  }
  return NULL;
}

}  // namespace cricket
