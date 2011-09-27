// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef TALK_XMLLITE_QNAME_H_
#define TALK_XMLLITE_QNAME_H_

#include <string>

namespace buzz {

// Default libjingle's implementation of QName class is not threadsafe. This
// one is.
class QName
{
public:
  QName();
  QName(const std::string & ns, const std::string & local);
  QName(bool add, const std::string & ns, const std::string & local);
  explicit QName(const std::string & mergedOrLocal);

  const std::string & Namespace() const { return namespace_; }
  const std::string & LocalPart() const { return local_part_; }
  std::string Merged() const;
  int Compare(const QName & other) const;
  bool operator==(const QName & other) const;
  bool operator!=(const QName & other) const { return !operator==(other); }
  bool operator<(const QName & other) const { return Compare(other) < 0; }

private:
  std::string namespace_;
  std::string local_part_;
};

}  // namespace buzz

#endif  // TALK_XMLLITE_QNAME_H_
