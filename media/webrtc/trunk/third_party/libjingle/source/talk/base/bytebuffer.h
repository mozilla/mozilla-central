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

#ifndef TALK_BASE_BYTEBUFFER_H_
#define TALK_BASE_BYTEBUFFER_H_

#include <string>

#include "talk/base/basictypes.h"
#include "talk/base/constructormagic.h"

namespace talk_base {

class ByteBuffer {
 public:

  enum ByteOrder {
    ORDER_NETWORK = 0,  // Default, use network byte order (big endian).
    ORDER_HOST,         // Use the native order of the host.
  };

  // |byte_order| defines order of bytes in the buffer.
  ByteBuffer();
  explicit ByteBuffer(ByteOrder byte_order);
  ByteBuffer(const char* bytes, size_t len);
  ByteBuffer(const char* bytes, size_t len, ByteOrder byte_order);

  // Initializes buffer from a zero-terminated string.
  explicit ByteBuffer(const char* bytes);

  ~ByteBuffer();

  const char* Data() const { return bytes_ + start_; }
  size_t Length() const { return end_ - start_; }
  size_t Capacity() const { return size_ - start_; }

  // Read a next value from the buffer. Return false if there isn't
  // enough data left for the specified type.
  bool ReadUInt8(uint8* val);
  bool ReadUInt16(uint16* val);
  bool ReadUInt24(uint32* val);
  bool ReadUInt32(uint32* val);
  bool ReadUInt64(uint64* val);
  bool ReadBytes(char* val, size_t len);

  // Appends next |len| bytes from the buffer to |val|. Returns false
  // if there is less than |len| bytes left.
  bool ReadString(std::string* val, size_t len);

  // Write value to the buffer. Resizes the buffer when it is
  // neccessary.
  void WriteUInt8(uint8 val);
  void WriteUInt16(uint16 val);
  void WriteUInt24(uint32 val);
  void WriteUInt32(uint32 val);
  void WriteUInt64(uint64 val);
  void WriteString(const std::string& val);
  void WriteBytes(const char* val, size_t len);

  // Resize the buffer to the specified |size|.
  void Resize(size_t size);

  // Moves current position |size| bytes forward. Return false if
  // there is less than |size| bytes left in the buffer.
  bool Consume(size_t size);

  // Drops |size| bytes from the front of the buffer. Return false if
  // there is less than |size| bytes left in the buffer.
  bool Shift(size_t size);

 private:
  void Construct(const char* bytes, size_t size, ByteOrder byte_order);

  char* bytes_;
  size_t size_;
  size_t start_;
  size_t end_;
  ByteOrder byte_order_;

  // There are sensible ways to define these, but they aren't needed in our code
  // base.
  DISALLOW_COPY_AND_ASSIGN(ByteBuffer);
};

}  // namespace talk_base

#endif  // TALK_BASE_BYTEBUFFER_H_
