/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MimeEncoder_h__
#define MimeEncoder_h__

#include "nscore.h"

namespace mozilla {
namespace mailnews {

/// A class for encoding the bodies of MIME parts.
class MimeEncoder {
public:
  virtual ~MimeEncoder() {}

  /// A callback for writing the encoded output
  typedef nsresult (*OutputCallback)
    (const char *buf, int32_t size, void *closure);

  /// Encodes the string in the buffer and sends it to the callback
  virtual nsresult Write(const char *buffer, int32_t size) = 0;
  /// Flush all pending data when no more data exists
  virtual nsresult Flush() { return NS_OK; }

  /// Get an encoder that outputs Base64-encoded data
  static MimeEncoder *GetBase64Encoder(OutputCallback callback, void *closure);
  /// Get an encoder that outputs quoted-printable data
  static MimeEncoder *GetQPEncoder(OutputCallback callback, void *closure);

protected:
  MimeEncoder(OutputCallback callback, void *closure);
  OutputCallback mCallback;
  void *mClosure;
  uint32_t mCurrentColumn;
};

} // namespace mailnews
} // namespace mozilla

#endif
