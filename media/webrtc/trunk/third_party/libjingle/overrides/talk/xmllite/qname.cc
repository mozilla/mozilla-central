// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "talk/xmllite/qname.h"

#include "talk/base/common.h"
#include "talk/xmllite/xmlelement.h"
#include "talk/xmllite/xmlconstants.h"

namespace buzz {

QName::QName() : namespace_(QN_EMPTY.namespace_),
                 local_part_(QN_EMPTY.local_part_) {}

QName::QName(const std::string & ns, const std::string & local) :
  namespace_(ns), local_part_(local) {}

QName::QName(bool add, const std::string & ns, const std::string & local) :
  namespace_(ns), local_part_(local) {}

static std::string
QName_LocalPart(const std::string & name) {
  size_t i = name.rfind(':');
  if (i == std::string::npos)
    return name;
  return name.substr(i + 1);
}

static std::string
QName_Namespace(const std::string & name) {
  size_t i = name.rfind(':');
  if (i == std::string::npos)
    return STR_EMPTY;
  return name.substr(0, i);
}

QName::QName(const std::string & mergedOrLocal) :
  namespace_(QName_Namespace(mergedOrLocal)),
  local_part_(QName_LocalPart(mergedOrLocal)) {}

std::string
QName::Merged() const {
  if (namespace_ == STR_EMPTY)
    return local_part_;
  return namespace_ + ':' + local_part_;
}

bool
QName::operator==(const QName & other) const {
  return
    local_part_ == other.local_part_ &&
    namespace_ == other.namespace_;
}

int
QName::Compare(const QName & other) const {
  int result = local_part_.compare(other.local_part_);
  if (result)
    return result;

  return namespace_.compare(other.namespace_);
}

}  // namespace buzz
