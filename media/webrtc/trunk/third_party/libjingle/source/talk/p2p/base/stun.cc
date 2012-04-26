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
#include "talk/base/messagedigest.h"
#include "talk/base/scoped_ptr.h"
#include "talk/base/stringencode.h"

using talk_base::ByteBuffer;

namespace cricket {

const char STUN_ERROR_REASON_BAD_REQUEST[] = "BAD REQUEST";
const char STUN_ERROR_REASON_UNAUTHORIZED[] = "UNAUTHORIZED";
const char STUN_ERROR_REASON_STALE_CREDENTIALS[] = "STALE CREDENTIALS";
const char STUN_ERROR_REASON_SERVER_ERROR[] = "SERVER ERROR";

const char TURN_MAGIC_COOKIE_VALUE[] = { '\x72', '\xC6', '\x4B', '\xC6' };
const char EMPTY_TRANSACTION_ID[] = "0000000000000000";

StunMessage::StunMessage()
    : type_(0), length_(0),
      transaction_id_(EMPTY_TRANSACTION_ID) {
  ASSERT(IsValidTransactionId(transaction_id_));
  attrs_ = new std::vector<StunAttribute*>();
}

StunMessage::~StunMessage() {
  for (size_t i = 0; i < attrs_->size(); i++)
    delete (*attrs_)[i];
  delete attrs_;
}

bool StunMessage::IsLegacy() const {
  if (transaction_id_.size() == kStunLegacyTransactionIdLength)
    return true;
  ASSERT(transaction_id_.size() == kStunTransactionIdLength);
  return false;
}

bool StunMessage::SetTransactionID(const std::string& str) {
  if (!IsValidTransactionId(str)) {
    return false;
  }
  transaction_id_ = str;
  return true;
}

void StunMessage::AddAttribute(StunAttribute* attr) {
  attrs_->push_back(attr);
  attr->SetOwner(this);
  size_t attr_length = attr->length();
  if (attr_length % 4 != 0) {
    attr_length += (4 - (attr_length % 4));
  }
  length_ += attr_length + 4;
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
    case STUN_ATTR_FINGERPRINT:
    case STUN_ATTR_PRIORITY:
      return reinterpret_cast<const StunUInt32Attribute*>(GetAttribute(type));

    default:
      ASSERT(0);
      return NULL;
  }
}

const StunUInt64Attribute*
StunMessage::GetUInt64(StunAttributeType type) const {
  switch (type) {
    case STUN_ATTR_ICE_CONTROLLED:
    case STUN_ATTR_ICE_CONTROLLING:
      return reinterpret_cast<const StunUInt64Attribute*>(GetAttribute(type));

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
    case STUN_ATTR_USE_CANDIDATE:
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
  for (size_t i = 0; i < attrs_->size(); i++) {
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

  if (length_ != buf->Length())
    return false;

  attrs_->resize(0);

  size_t rest = buf->Length() - length_;
  while (buf->Length() > rest) {
    uint16 attr_type, attr_length;
    if (!buf->ReadUInt16(&attr_type))
      return false;
    if (!buf->ReadUInt16(&attr_length))
      return false;

    StunAttribute* attr = StunAttribute::Create(attr_type, attr_length,
                                                this);
    if (!attr) {
      // Skip an unknown attribute.
      if ((attr_length % 4) != 0) {
        attr_length += (4 - (attr_length % 4));
      }
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

  for (size_t i = 0; i < attrs_->size(); i++) {
    buf->WriteUInt16((*attrs_)[i]->type());
    buf->WriteUInt16((*attrs_)[i]->length());
    (*attrs_)[i]->Write(buf);
  }
}

bool StunMessage::IsValidTransactionId(const std::string& transaction_id) {
  return transaction_id.size() == kStunTransactionIdLength ||
      transaction_id.size() == kStunLegacyTransactionIdLength;
}

bool StunMessage::ValidateMessageIntegrity(
    const char* data, size_t size, const std::string& password) {

  // Verifying the size of the message.
  if ((size % 4) != 0) {
    return false;
  }
  // Getting the message length from the STUN header.
  uint16 msg_length = talk_base::GetBE16(&data[2]);
  if (size != (msg_length + kStunHeaderSize)) {
    return false;
  }
  // Finding Message Integrity attribute in stun message.
  size_t current_pos = kStunHeaderSize;
  bool has_message_integrity_attr = false;
  while (current_pos < size) {
    uint16 attr_type, attr_length;
    // Getting attribute type.
    attr_type = talk_base::GetBE16(&data[current_pos]);
    if (attr_type == STUN_ATTR_MESSAGE_INTEGRITY) {
      has_message_integrity_attr = true;
      break;
    }
    current_pos += sizeof(attr_type);

    // Getting attribute length.
    attr_length = talk_base::GetBE16(&data[current_pos]);
    if ((attr_length % 4) != 0) {
      attr_length += (4 - (attr_length % 4));
    }
    current_pos += sizeof(attr_length) + attr_length;
  }

  if (!has_message_integrity_attr) {
    return false;
  }

  // Getting length of the message to calculate Message Integrity.
  size_t mi_pos = current_pos;
  talk_base::scoped_array<char> temp_data(new char[current_pos]);
  memcpy(temp_data.get(), data, current_pos);
  if (size > mi_pos + kStunAttributeHeaderSize + kStunMessageIntegritySize) {
    // Stun message has other attributes after message integrity.
    // Adjust the length parameter in stun message to calculate HMAC.
    size_t extra_offset = size -
        (mi_pos + kStunAttributeHeaderSize + kStunMessageIntegritySize);
    size_t new_adjusted_len = size - extra_offset - kStunHeaderSize;

    // Writing new length of the STUN message @ Message Length in temp buffer.
    //      0                   1                   2                   3
    //      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
    //     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    //     |0 0|     STUN Message Type     |         Message Length        |
    //     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    talk_base::SetBE16(temp_data.get() + 2, new_adjusted_len);
  }

  char hmac[kStunMessageIntegritySize];
  size_t ret = talk_base::ComputeHmac(
      talk_base::DIGEST_SHA_1,
      password.c_str(),
      password.size(),
      temp_data.get(), mi_pos, hmac, sizeof(hmac));
  ASSERT(ret == sizeof(hmac));
  if (ret != sizeof(hmac))
    return false;
  // comparing the calculated HMAC with the one present in message.
  return (std::memcmp(data + current_pos + kStunAttributeHeaderSize,
                      hmac, sizeof(hmac)) == 0);
}

void StunMessage::AddMessageIntegrity(const std::string& password) {
  StunByteStringAttribute* msg_integrity_attr =
       StunAttribute::CreateByteString(STUN_ATTR_MESSAGE_INTEGRITY);

  std::string dummy_content(kStunMessageIntegritySize, '0');
  msg_integrity_attr->CopyBytes(dummy_content.c_str(), dummy_content.size());
  AddAttribute(msg_integrity_attr);

  // Calculating HMAC for the message.
  talk_base::ByteBuffer buf;
  Write(&buf);
  ASSERT(buf.Length() > kStunAttributeHeaderSize + kStunMessageIntegritySize);
  int msg_len_for_hmac = buf.Length() -
                        kStunAttributeHeaderSize -
                        kStunMessageIntegritySize;
  char hmac[kStunMessageIntegritySize];
  size_t ret = talk_base::ComputeHmac(
     talk_base::DIGEST_SHA_1,
     password.c_str(), password.size(),
     buf.Data(), msg_len_for_hmac, hmac, sizeof(hmac));
  ASSERT(ret == sizeof(hmac));
  if (ret != sizeof(hmac)) {
    LOG(LS_ERROR) << "HMAC computation failed. Message-Integrity "
                  << "has dummy value.";
    return;
  }
  // Insert correct HMAC into attribute.
  msg_integrity_attr->CopyBytes(hmac, sizeof(hmac));
}

bool StunMessage::HasMessageIntegrity() const {
  const StunByteStringAttribute* msg_integrity_attr =
      GetByteString(STUN_ATTR_MESSAGE_INTEGRITY);
  return msg_integrity_attr != NULL;
}

StunAttribute::StunAttribute(uint16 type, uint16 length)
    : type_(type), length_(length) {
}

StunAttribute* StunAttribute::Create(uint16 type,
                                     uint16 length,
                                     StunMessage* owner) {
  switch (type) {
    case STUN_ATTR_MAPPED_ADDRESS:
    case STUN_ATTR_DESTINATION_ADDRESS:
    case STUN_ATTR_SOURCE_ADDRESS2:
      if (length != StunAddressAttribute::SIZE_IP4 &&
          length != StunAddressAttribute::SIZE_IP6) {
        LOG(LS_WARNING) << "Invalid length specified for address attribute";
        return NULL;
      }
      return new StunAddressAttribute(type, length);

    case STUN_ATTR_LIFETIME:
    case STUN_ATTR_BANDWIDTH:
    case STUN_ATTR_OPTIONS:
    case STUN_ATTR_FINGERPRINT:
    case STUN_ATTR_PRIORITY:
      if (length != StunUInt32Attribute::SIZE)
        return NULL;
      return new StunUInt32Attribute(type);

    case STUN_ATTR_USERNAME:
    case STUN_ATTR_MAGIC_COOKIE:
    case STUN_ATTR_DATA:
    case STUN_ATTR_SOFTWARE:
      return new StunByteStringAttribute(type, length);

    case STUN_ATTR_ICE_CONTROLLED:
    case STUN_ATTR_ICE_CONTROLLING:
      return new StunUInt64Attribute(type);

    case STUN_ATTR_MESSAGE_INTEGRITY:
      return (length == 20) ? new StunByteStringAttribute(type, length) : 0;

    case STUN_ATTR_ERROR_CODE:
      if (length < StunErrorCodeAttribute::MIN_SIZE)
        return NULL;
      return new StunErrorCodeAttribute(type, length);

    case STUN_ATTR_UNKNOWN_ATTRIBUTES:
      return (length % 2 == 0) ? new StunUInt16ListAttribute(type, length) : 0;

    case STUN_ATTR_XOR_MAPPED_ADDRESS:
      if (length != StunAddressAttribute::SIZE_IP4 &&
          length != StunAddressAttribute::SIZE_IP6) {
        LOG(LS_WARNING) << "Invalid length specified for XOR address attribute";
        return NULL;
      }
      return new StunXorAddressAttribute(type, length, owner);

    case STUN_ATTR_USE_CANDIDATE:  // Attribute of 0 length.
      return (length == 0) ? new StunByteStringAttribute(type, 0) : 0;

    default:
      return NULL;
  }
}

void StunAttribute::ConsumePadding(talk_base::ByteBuffer* buf) const {
  int remainder = length_ % 4;
  if (remainder > 0) {
    buf->Consume(4 - remainder);
  }
}

void StunAttribute::WritePadding(talk_base::ByteBuffer* buf) const {
  int remainder = length_ % 4;
  if (remainder > 0) {
    char zeroes[4] = {0};
    buf->WriteBytes(zeroes, 4 - remainder);
  }
}

StunAddressAttribute* StunAttribute::CreateAddress(uint16 type) {
  switch (type) {
    case STUN_ATTR_MAPPED_ADDRESS:
    case STUN_ATTR_DESTINATION_ADDRESS:
    case STUN_ATTR_SOURCE_ADDRESS2:
      return new StunAddressAttribute(type, StunAddressAttribute::SIZE_IP4);

    case STUN_ATTR_XOR_MAPPED_ADDRESS:
      return new StunXorAddressAttribute(type, StunAddressAttribute::SIZE_IP4);

  default:
    ASSERT(false);
    return NULL;
  }
}

StunUInt64Attribute* StunAttribute::CreateUInt64(uint16 type) {
  switch (type) {
    case STUN_ATTR_ICE_CONTROLLED:
    case STUN_ATTR_ICE_CONTROLLING:
      return new StunUInt64Attribute(type);

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
  case STUN_ATTR_FINGERPRINT:
  case STUN_ATTR_PRIORITY:
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

StunAddressAttribute::StunAddressAttribute(uint16 type, uint16 length)
    : StunAttribute(type, length) { }

bool StunAddressAttribute::Read(ByteBuffer* buf) {
  uint8 dummy;
  if (!buf->ReadUInt8(&dummy))
    return false;

  uint8 stun_family;
  if (!buf->ReadUInt8(&stun_family)) {
    return false;
  }
  uint16 port;
  if (!buf->ReadUInt16(&port))
    return false;
  if (stun_family == STUN_ADDRESS_IPV4) {
    in_addr v4addr;
    if (length() != SIZE_IP4) {
      return false;
    }
    if (!buf->ReadBytes(reinterpret_cast<char*>(&v4addr), sizeof(v4addr))) {
      return false;
    }
    talk_base::IPAddress ipaddr(v4addr);
    SetAddress(talk_base::SocketAddress(ipaddr, port));
  } else if (stun_family == STUN_ADDRESS_IPV6) {
    in6_addr v6addr;
    if (length() != SIZE_IP6) {
      return false;
    }
    if (!buf->ReadBytes(reinterpret_cast<char*>(&v6addr), sizeof(v6addr))) {
      return false;
    }
    talk_base::IPAddress ipaddr(v6addr);
    SetAddress(talk_base::SocketAddress(ipaddr, port));
  } else {
    return false;
  }
  return true;
}

void StunAddressAttribute::Write(ByteBuffer* buf) const {
  StunAddressFamily address_family = family();
  if (address_family == STUN_ADDRESS_UNDEF) {
    LOG(LS_ERROR) << "Error writing address attribute: unknown family.";
    return;
  }
  buf->WriteUInt8(0);
  buf->WriteUInt8(address_family);
  buf->WriteUInt16(address_.port());
  switch (address_family) {
    case STUN_ADDRESS_IPV4: {
      in_addr v4addr = address_.ipaddr().ipv4_address();
      buf->WriteBytes(reinterpret_cast<char*>(&v4addr), sizeof(v4addr));
      break;
    }
    case STUN_ADDRESS_IPV6: {
      in6_addr v6addr = address_.ipaddr().ipv6_address();
      buf->WriteBytes(reinterpret_cast<char*>(&v6addr), sizeof(v6addr));
      break;
    }
    case STUN_ADDRESS_UNDEF:
      ASSERT(0);  // Explicitly handled above.
      break;
  }
}

StunXorAddressAttribute::StunXorAddressAttribute(uint16 type, uint16 length)
    : StunAddressAttribute(type, length), owner_(NULL) { }

StunXorAddressAttribute::StunXorAddressAttribute(uint16 type,
                                                 uint16 length,
                                                 StunMessage* owner)
    : StunAddressAttribute(type, length), owner_(owner) { }

talk_base::IPAddress StunXorAddressAttribute::GetXoredIP() const {
  if (owner_) {
    talk_base::IPAddress ip = ipaddr();
    switch (ip.family()) {
      case AF_INET: {
        in_addr v4addr = ip.ipv4_address();
        v4addr.s_addr =
            (v4addr.s_addr ^ talk_base::HostToNetwork32(kStunMagicCookie));
        return talk_base::IPAddress(v4addr);
        break;
      }
      case AF_INET6: {
        in6_addr v6addr = ip.ipv6_address();
        const std::string& transaction_id = owner_->transaction_id();
        if (transaction_id.length() == 12) {
          uint32 transactionid_as_ints[3];
          memcpy(&transactionid_as_ints[0], transaction_id.c_str(),
                 transaction_id.length());
          uint32* ip_as_ints = reinterpret_cast<uint32*>(&v6addr.s6_addr);
          // Transaction ID is in network byte order, but magic cookie
          // is stored in host byte order.
          ip_as_ints[0] =
              (ip_as_ints[0] ^ talk_base::HostToNetwork32(kStunMagicCookie));
          ip_as_ints[1] = (ip_as_ints[1] ^ transactionid_as_ints[0]);
          ip_as_ints[2] = (ip_as_ints[2] ^ transactionid_as_ints[1]);
          ip_as_ints[3] = (ip_as_ints[3] ^ transactionid_as_ints[2]);
          return talk_base::IPAddress(v6addr);
        }
        break;
      }
    }
  }
  // Invalid ip family or transaction ID, or missing owner.
  // Return an AF_UNSPEC address.
  return talk_base::IPAddress();
}

bool StunXorAddressAttribute::Read(ByteBuffer* buf) {
  if (!StunAddressAttribute::Read(buf))
    return false;
  uint16 xoredport = port() ^ (kStunMagicCookie >> 16);
  talk_base::IPAddress xored_ip = GetXoredIP();
  SetAddress(talk_base::SocketAddress(xored_ip, xoredport));
  return true;
}

void StunXorAddressAttribute::Write(ByteBuffer* buf) const {
  StunAddressFamily address_family = family();
  if (address_family == STUN_ADDRESS_UNDEF) {
    LOG(LS_ERROR) << "Error writing xor-address attribute: unknown family.";
    return;
  }
  buf->WriteUInt8(0);
  buf->WriteUInt8(family());
  buf->WriteUInt16(port() ^ (kStunMagicCookie >> 16));
  talk_base::IPAddress xored_ip = GetXoredIP();
  switch (xored_ip.family()) {
    case AF_INET: {
      in_addr v4addr = xored_ip.ipv4_address();
      buf->WriteBytes(reinterpret_cast<const char*>(&v4addr), sizeof(v4addr));
      break;
    }
    case AF_INET6: {
      in6_addr v6addr = xored_ip.ipv6_address();
      buf->WriteBytes(reinterpret_cast<const char*>(&v6addr), sizeof(v6addr));
      break;
    }
  }
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

StunUInt64Attribute::StunUInt64Attribute(uint16 type)
    : StunAttribute(type, SIZE), bits_(0) {
}

bool StunUInt64Attribute::Read(ByteBuffer* buf) {
  if (!buf->ReadUInt64(&bits_))
    return false;
  return true;
}

void StunUInt64Attribute::Write(ByteBuffer* buf) const {
  buf->WriteUInt64(bits_);
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
  if (!buf->ReadBytes(bytes_, length())) {
    return false;
  }

  ConsumePadding(buf);

  return true;
}

void StunByteStringAttribute::Write(ByteBuffer* buf) const {
  buf->WriteBytes(bytes_, length());
  WritePadding(buf);
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
  ConsumePadding(buf);

  return true;
}

void StunErrorCodeAttribute::Write(ByteBuffer* buf) const {
  buf->WriteUInt32(error_code());
  buf->WriteString(reason_);
  WritePadding(buf);
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
  // Padding of these attributes is done in RFC 5389 style. This is
  // slightly different from RFC3489, but it shouldn't be important.
  // RFC3489 pads out to a 32 bit boundary by duplicating one of the
  // entries in the list (not necessarily the last one - it's unspecified).
  // RFC5389 pads on the end, and the bytes are always ignored.
  ConsumePadding(buf);
  return true;
}

void StunUInt16ListAttribute::Write(ByteBuffer* buf) const {
  for (size_t i = 0; i < attr_types_->size(); i++) {
    buf->WriteUInt16((*attr_types_)[i]);
  }
  WritePadding(buf);
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

}  // namespace cricket
