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

#include "talk/p2p/base/stun.h"

#include <cstring>

#include "talk/base/byteorder.h"
#include "talk/base/common.h"
#include "talk/base/logging.h"

using talk_base::ByteBuffer;

namespace cricket {

const char STUN_ERROR_REASON_BAD_REQUEST[] = "BAD REQUEST";
const char STUN_ERROR_REASON_STALE_CREDENTIALS[] = "STALE CREDENTIALS";
const char STUN_ERROR_REASON_SERVER_ERROR[] = "SERVER ERROR";

const char TURN_MAGIC_COOKIE_VALUE[] = { '\x72', '\xC6', '\x4B', '\xC6' };

StunMessage::StunMessage()
    : type_(0), length_(0),
      transaction_id_("000000000000") {
  ASSERT(IsValidTransactionId(transaction_id_));
  attrs_ = new std::vector<StunAttribute*>();
}

StunMessage::~StunMessage() {
  for (unsigned i = 0; i < attrs_->size(); i++)
    delete (*attrs_)[i];
  delete attrs_;
}

bool StunMessage::IsLegacy() const {
  if (transaction_id_.size() == kStunLegacyTransactionIdLength)
    return true;
  ASSERT(transaction_id_.size() == kStunTransactionIdLength);
  return false;
}

void StunMessage::SetTransactionID(const std::string& str) {
  ASSERT(IsValidTransactionId(str));
  transaction_id_ = str;
}

void StunMessage::AddAttribute(StunAttribute* attr) {
  attrs_->push_back(attr);
  length_ += attr->length() + 4;
}

const StunAddressAttribute*
StunMessage::GetAddress(StunAttributeType type) const {
  switch (type) {
    case STUN_ATTR_MAPPED_ADDRESS: {
      // Return XOR-MAPPED-ADDRESS when MAPPED-ADDRESS attribute is
      // missing.
      const StunAttribute* mapped_address =
          GetAttribute(STUN_ATTR_MAPPED_ADDRESS);
      if (!mapped_address)
        mapped_address = GetAttribute(STUN_ATTR_XOR_MAPPED_ADDRESS);
      return reinterpret_cast<const StunAddressAttribute*>(mapped_address);
    }

    case STUN_ATTR_DESTINATION_ADDRESS:
    case STUN_ATTR_SOURCE_ADDRESS2:
    case STUN_ATTR_XOR_MAPPED_ADDRESS:
      return reinterpret_cast<const StunAddressAttribute*>(GetAttribute(type));

    default:
      ASSERT(0);
      return NULL;
  }
}

const StunUInt32Attribute*
StunMessage::GetUInt32(StunAttributeType type) const {
  switch (type) {
    case STUN_ATTR_LIFETIME:
    case STUN_ATTR_BANDWIDTH:
    case STUN_ATTR_OPTIONS:
      return reinterpret_cast<const StunUInt32Attribute*>(GetAttribute(type));

    default:
      ASSERT(0);
      return NULL;
  }
}

const StunByteStringAttribute*
StunMessage::GetByteString(StunAttributeType type) const {
  switch (type) {
    case STUN_ATTR_USERNAME:
    case STUN_ATTR_MESSAGE_INTEGRITY:
    case STUN_ATTR_DATA:
    case STUN_ATTR_MAGIC_COOKIE:
      return reinterpret_cast<const StunByteStringAttribute*>(
          GetAttribute(type));

    default:
      ASSERT(0);
      return NULL;
  }
}

const StunErrorCodeAttribute* StunMessage::GetErrorCode() const {
  return reinterpret_cast<const StunErrorCodeAttribute*>(
      GetAttribute(STUN_ATTR_ERROR_CODE));
}

const StunUInt16ListAttribute* StunMessage::GetUnknownAttributes() const {
  return reinterpret_cast<const StunUInt16ListAttribute*>(
      GetAttribute(STUN_ATTR_UNKNOWN_ATTRIBUTES));
}

const StunAttribute* StunMessage::GetAttribute(StunAttributeType type) const {
  for (unsigned i = 0; i < attrs_->size(); i++) {
    if ((*attrs_)[i]->type() == type)
      return (*attrs_)[i];
  }
  return NULL;
}

bool StunMessage::Read(ByteBuffer* buf) {
  if (!buf->ReadUInt16(&type_))
    return false;

  if (type_ & 0x8000) {
    // rtp and rtcp set MSB of first byte, since first two bits are version,
    // and version is always 2 (10).  If set, this is not a stun packet.
    return false;
  }

  if (!buf->ReadUInt16(&length_))
    return false;

  std::string magic_cookie;
  if (!buf->ReadString(&magic_cookie, kStunMagicCookieLength))
    return false;

  std::string transaction_id;
  if (!buf->ReadString(&transaction_id, kStunTransactionIdLength))
    return false;

  uint32 magic_cookie_int =
      *reinterpret_cast<const uint32*>(magic_cookie.data());
  if (talk_base::NetworkToHost32(magic_cookie_int) != kStunMagicCookie) {
    // If magic cookie is invalid it means that the peer implements
    // RFC3489 instead of RFC5389.
    transaction_id.insert(0, magic_cookie);
  }
  ASSERT(IsValidTransactionId(transaction_id));
  transaction_id_ = transaction_id;

  if (length_ > buf->Length())
    return false;

  attrs_->resize(0);

  size_t rest = buf->Length() - length_;
  while (buf->Length() > rest) {
    uint16 attr_type, attr_length;
    if (!buf->ReadUInt16(&attr_type))
      return false;
    if (!buf->ReadUInt16(&attr_length))
      return false;

    StunAttribute* attr = StunAttribute::Create(attr_type, attr_length);
    if (!attr) {
      // Skip an unknown attribute.
      if (!buf->Consume(attr_length))
        return false;
    } else {
      if (!attr->Read(buf))
        return false;
      attrs_->push_back(attr);
    }
  }

  ASSERT(buf->Length() == rest);

  return true;
}

void StunMessage::Write(ByteBuffer* buf) const {
  buf->WriteUInt16(type_);
  buf->WriteUInt16(length_);
  if (!IsLegacy())
    buf->WriteUInt32(kStunMagicCookie);
  buf->WriteString(transaction_id_);

  for (unsigned i = 0; i < attrs_->size(); i++) {
    buf->WriteUInt16((*attrs_)[i]->type());
    buf->WriteUInt16((*attrs_)[i]->length());
    (*attrs_)[i]->Write(buf);
  }
}

bool StunMessage::IsValidTransactionId(const std::string& transaction_id) {
  return transaction_id.size() == kStunTransactionIdLength ||
      transaction_id.size() == kStunLegacyTransactionIdLength;
}

StunAttribute::StunAttribute(uint16 type, uint16 length)
    : type_(type), length_(length) {
}

StunAttribute* StunAttribute::Create(uint16 type, uint16 length) {
  switch (type) {
    case STUN_ATTR_MAPPED_ADDRESS:
    case STUN_ATTR_DESTINATION_ADDRESS:
    case STUN_ATTR_SOURCE_ADDRESS2:
      // TODO: Addresses may be different size for IPv6
      // addresses, but we don't support IPv6 yet. Fix address parsing
      // when IPv6 support is implemented.
      if (length != StunAddressAttribute::SIZE)
        return NULL;
      return new StunAddressAttribute(type);

    case STUN_ATTR_LIFETIME:
    case STUN_ATTR_BANDWIDTH:
    case STUN_ATTR_OPTIONS:
      if (length != StunUInt32Attribute::SIZE)
        return NULL;
      return new StunUInt32Attribute(type);

    case STUN_ATTR_USERNAME:
    case STUN_ATTR_MAGIC_COOKIE:
      return (length % 4 == 0) ? new StunByteStringAttribute(type, length) : 0;

    case STUN_ATTR_MESSAGE_INTEGRITY:
      return (length == 20) ? new StunByteStringAttribute(type, length) : 0;

    case STUN_ATTR_DATA:
      return new StunByteStringAttribute(type, length);

    case STUN_ATTR_ERROR_CODE:
      if (length < StunErrorCodeAttribute::MIN_SIZE)
        return NULL;
      return new StunErrorCodeAttribute(type, length);

    case STUN_ATTR_UNKNOWN_ATTRIBUTES:
      return (length % 2 == 0) ? new StunUInt16ListAttribute(type, length) : 0;

    case STUN_ATTR_XOR_MAPPED_ADDRESS:
      // TODO: Addresses may be different size for IPv6
      // addresses, but we don't support IPv6 yet. Fix address parsing
      // when IPv6 support is implemented.
      if (length != StunAddressAttribute::SIZE)
        return NULL;
      return new StunXorAddressAttribute(type);

    default:
      return NULL;
  }
}

StunAddressAttribute* StunAttribute::CreateAddress(uint16 type) {
  switch (type) {
    case STUN_ATTR_MAPPED_ADDRESS:
    case STUN_ATTR_DESTINATION_ADDRESS:
    case STUN_ATTR_SOURCE_ADDRESS2:
      return new StunAddressAttribute(type);

    case STUN_ATTR_XOR_MAPPED_ADDRESS:
      return new StunXorAddressAttribute(type);

  default:
    ASSERT(false);
    return NULL;
  }
}

StunUInt32Attribute* StunAttribute::CreateUInt32(uint16 type) {
  switch (type) {
  case STUN_ATTR_LIFETIME:
  case STUN_ATTR_BANDWIDTH:
  case STUN_ATTR_OPTIONS:
    return new StunUInt32Attribute(type);

  default:
    ASSERT(false);
    return NULL;
  }
}

StunByteStringAttribute* StunAttribute::CreateByteString(uint16 type) {
  switch (type) {
    case STUN_ATTR_USERNAME:
    case STUN_ATTR_MESSAGE_INTEGRITY:
    case STUN_ATTR_DATA:
    case STUN_ATTR_MAGIC_COOKIE:
      return new StunByteStringAttribute(type, 0);

    default:
      ASSERT(false);
      return NULL;
  }
}

StunErrorCodeAttribute* StunAttribute::CreateErrorCode() {
  return new StunErrorCodeAttribute(
      STUN_ATTR_ERROR_CODE, StunErrorCodeAttribute::MIN_SIZE);
}

StunUInt16ListAttribute* StunAttribute::CreateUnknownAttributes() {
  return new StunUInt16ListAttribute(STUN_ATTR_UNKNOWN_ATTRIBUTES, 0);
}

StunAddressAttribute::StunAddressAttribute(uint16 type)
    : StunAttribute(type, SIZE), family_(STUN_ADDRESS_IPV4), port_(0), ip_(0) {
}

void StunAddressAttribute::SetFamily(StunAddressFamily family) {
  family_ = family;
}

bool StunAddressAttribute::Read(ByteBuffer* buf) {
  uint8 dummy;
  if (!buf->ReadUInt8(&dummy))
    return false;

  uint8 family;
  // We don't expect IPv6 address here because IPv6 addresses would
  // not pass the attribute size check in StunAttribute::Create().
  // TODO: Support IPv6 addresses.
  if (!buf->ReadUInt8(&family) || family != STUN_ADDRESS_IPV4) {
    return false;
  }
  family_ = static_cast<StunAddressFamily>(family);

  if (!buf->ReadUInt16(&port_))
    return false;
  uint32 ip;
  if (!buf->ReadUInt32(&ip))
    return false;
  SetIP(talk_base::IPAddress(ip));

  return true;
}

void StunAddressAttribute::Write(ByteBuffer* buf) const {
  // Only IPv4 address family is currently supported.
  ASSERT(family_ == STUN_ADDRESS_IPV4);

  buf->WriteUInt8(0);
  buf->WriteUInt8(family_);
  buf->WriteUInt16(port_);
  buf->WriteUInt32(ip_.v4AddressAsHostOrderInteger());
}

StunXorAddressAttribute::StunXorAddressAttribute(uint16 type)
    : StunAddressAttribute(type) {
}

bool StunXorAddressAttribute::Read(ByteBuffer* buf) {
  if (!StunAddressAttribute::Read(buf))
    return false;

  SetPort(port() ^ (kStunMagicCookie >> 16));
  uint32 ip = ipaddr().v4AddressAsHostOrderInteger();
  SetIP(talk_base::IPAddress(ip ^ kStunMagicCookie));

  return true;
}

void StunXorAddressAttribute::Write(ByteBuffer* buf) const {
  // Only IPv4 address family is currently supported.
  ASSERT(family() == STUN_ADDRESS_IPV4);

  buf->WriteUInt8(0);
  buf->WriteUInt8(family());
  buf->WriteUInt16(port() ^ (kStunMagicCookie >> 16));
  buf->WriteUInt32(ipaddr().v4AddressAsHostOrderInteger() ^ kStunMagicCookie);
}

StunUInt32Attribute::StunUInt32Attribute(uint16 type)
    : StunAttribute(type, SIZE), bits_(0) {
}

bool StunUInt32Attribute::GetBit(int index) const {
  ASSERT((0 <= index) && (index < 32));
  return static_cast<bool>((bits_ >> index) & 0x1);
}

void StunUInt32Attribute::SetBit(int index, bool value) {
  ASSERT((0 <= index) && (index < 32));
  bits_ &= ~(1 << index);
  bits_ |= value ? (1 << index) : 0;
}

bool StunUInt32Attribute::Read(ByteBuffer* buf) {
  if (!buf->ReadUInt32(&bits_))
    return false;
  return true;
}

void StunUInt32Attribute::Write(ByteBuffer* buf) const {
  buf->WriteUInt32(bits_);
}

StunByteStringAttribute::StunByteStringAttribute(uint16 type, uint16 length)
    : StunAttribute(type, length), bytes_(0) {
}

StunByteStringAttribute::~StunByteStringAttribute() {
  delete [] bytes_;
}

void StunByteStringAttribute::SetBytes(char* bytes, uint16 length) {
  delete [] bytes_;
  bytes_ = bytes;
  SetLength(length);
}

void StunByteStringAttribute::CopyBytes(const char* bytes) {
  CopyBytes(bytes, static_cast<uint16>(strlen(bytes)));
}

void StunByteStringAttribute::CopyBytes(const void* bytes, uint16 length) {
  char* new_bytes = new char[length];
  std::memcpy(new_bytes, bytes, length);
  SetBytes(new_bytes, length);
}

uint8 StunByteStringAttribute::GetByte(int index) const {
  ASSERT(bytes_ != NULL);
  ASSERT((0 <= index) && (index < length()));
  return static_cast<uint8>(bytes_[index]);
}

void StunByteStringAttribute::SetByte(int index, uint8 value) {
  ASSERT(bytes_ != NULL);
  ASSERT((0 <= index) && (index < length()));
  bytes_[index] = value;
}

bool StunByteStringAttribute::Read(ByteBuffer* buf) {
  bytes_ = new char[length()];
  if (!buf->ReadBytes(bytes_, length()))
    return false;
  return true;
}

void StunByteStringAttribute::Write(ByteBuffer* buf) const {
  buf->WriteBytes(bytes_, length());
}

StunErrorCodeAttribute::StunErrorCodeAttribute(uint16 type, uint16 length)
    : StunAttribute(type, length), class_(0), number_(0) {
}

StunErrorCodeAttribute::~StunErrorCodeAttribute() {
}

void StunErrorCodeAttribute::SetErrorCode(uint32 code) {
  class_ = (uint8)((code >> 8) & 0x7);
  number_ = (uint8)(code & 0xff);
}

void StunErrorCodeAttribute::SetReason(const std::string& reason) {
  SetLength(MIN_SIZE + static_cast<uint16>(reason.size()));
  reason_ = reason;
}

bool StunErrorCodeAttribute::Read(ByteBuffer* buf) {
  uint32 val;
  if (!buf->ReadUInt32(&val))
    return false;

  if ((val >> 11) != 0)
    LOG(LERROR) << "error-code bits not zero";

  SetErrorCode(val);

  if (!buf->ReadString(&reason_, length() - 4))
    return false;

  return true;
}

void StunErrorCodeAttribute::Write(ByteBuffer* buf) const {
  buf->WriteUInt32(error_code());
  buf->WriteString(reason_);
}

StunUInt16ListAttribute::StunUInt16ListAttribute(uint16 type, uint16 length)
    : StunAttribute(type, length) {
  attr_types_ = new std::vector<uint16>();
}

StunUInt16ListAttribute::~StunUInt16ListAttribute() {
  delete attr_types_;
}

size_t StunUInt16ListAttribute::Size() const {
  return attr_types_->size();
}

uint16 StunUInt16ListAttribute::GetType(int index) const {
  return (*attr_types_)[index];
}

void StunUInt16ListAttribute::SetType(int index, uint16 value) {
  (*attr_types_)[index] = value;
}

void StunUInt16ListAttribute::AddType(uint16 value) {
  attr_types_->push_back(value);
  SetLength(static_cast<uint16>(attr_types_->size() * 2));
}

bool StunUInt16ListAttribute::Read(ByteBuffer* buf) {
  for (int i = 0; i < length() / 2; i++) {
    uint16 attr;
    if (!buf->ReadUInt16(&attr))
      return false;
    attr_types_->push_back(attr);
  }
  return true;
}

void StunUInt16ListAttribute::Write(ByteBuffer* buf) const {
  for (unsigned i = 0; i < attr_types_->size(); i++)
    buf->WriteUInt16((*attr_types_)[i]);
}

StunMessageType GetStunResponseType(StunMessageType request_type) {
  switch (request_type) {
    case STUN_SHARED_SECRET_REQUEST:
      return STUN_SHARED_SECRET_RESPONSE;
    case STUN_ALLOCATE_REQUEST:
      return STUN_ALLOCATE_RESPONSE;
    case STUN_SEND_REQUEST:
      return STUN_SEND_RESPONSE;
    default:
      return STUN_BINDING_RESPONSE;
  }
}

StunMessageType GetStunErrorResponseType(StunMessageType request_type) {
  switch (request_type) {
    case STUN_SHARED_SECRET_REQUEST:
      return STUN_SHARED_SECRET_ERROR_RESPONSE;
    case STUN_ALLOCATE_REQUEST:
      return STUN_ALLOCATE_ERROR_RESPONSE;
    case STUN_SEND_REQUEST:
      return STUN_SEND_ERROR_RESPONSE;
    default:
      return STUN_BINDING_ERROR_RESPONSE;
  }
}

} // namespace cricket
