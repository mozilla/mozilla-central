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

#ifndef TALK_P2P_BASE_STUN_H_
#define TALK_P2P_BASE_STUN_H_

// This file contains classes for dealing with the STUN and TURN protocols.
// Both protocols use the same wire format.

#include <string>
#include <vector>

#include "talk/base/basictypes.h"
#include "talk/base/bytebuffer.h"
#include "talk/base/socketaddress.h"

namespace cricket {

// These are the types of STUN & TURN messages as of last check.
enum StunMessageType {
  STUN_BINDING_REQUEST              = 0x0001,
  STUN_BINDING_RESPONSE             = 0x0101,
  STUN_BINDING_ERROR_RESPONSE       = 0x0111,
  STUN_SHARED_SECRET_REQUEST        = 0x0002,
  STUN_SHARED_SECRET_RESPONSE       = 0x0102,
  STUN_SHARED_SECRET_ERROR_RESPONSE = 0x0112,
  STUN_ALLOCATE_REQUEST             = 0x0003,
  STUN_ALLOCATE_RESPONSE            = 0x0103,
  STUN_ALLOCATE_ERROR_RESPONSE      = 0x0113,
  STUN_SEND_REQUEST                 = 0x0004,
  STUN_SEND_RESPONSE                = 0x0104,
  STUN_SEND_ERROR_RESPONSE          = 0x0114,
  STUN_DATA_INDICATION              = 0x0115
};

// These are the types of attributes defined in STUN & TURN.  Next to each is
// the name of the class (T is StunTAttribute) that implements that type.
//
// TODO: Some attributes defined in RFC5389 are not
// implemented yet, particularly REALM, NONCE, SOFTWARE,
// ALTERNATE-SERVE and FINGEPRINT. Implement them.
enum StunAttributeType {
  STUN_ATTR_MAPPED_ADDRESS        = 0x0001,  // Address
  STUN_ATTR_USERNAME              = 0x0006,  // ByteString, multiple of 4 bytes
  STUN_ATTR_MESSAGE_INTEGRITY     = 0x0008,  // ByteString, 20 bytes
  STUN_ATTR_ERROR_CODE            = 0x0009,  // ErrorCode
  STUN_ATTR_UNKNOWN_ATTRIBUTES    = 0x000a,  // UInt16List
  STUN_ATTR_LIFETIME              = 0x000d,  // UInt32
  STUN_ATTR_MAGIC_COOKIE          = 0x000f,  // ByteString, 4 bytes
  STUN_ATTR_BANDWIDTH             = 0x0010,  // UInt32
  STUN_ATTR_DESTINATION_ADDRESS   = 0x0011,  // Address
  STUN_ATTR_SOURCE_ADDRESS2       = 0x0012,  // Address
  STUN_ATTR_DATA                  = 0x0013,  // ByteString
  STUN_ATTR_XOR_MAPPED_ADDRESS    = 0x0020,  // XorAddress
  STUN_ATTR_OPTIONS               = 0x8001,  // UInt32
  STUN_ATTR_SOFTWARE              = 0x8022,  // ByteString
  STUN_ATTR_FINGERPRINT           = 0x8028,  // UInt32

  // RFC5245 defined attributes.
  STUN_ATTR_PRIORITY              = 0x0024,  // UInt32
  STUN_ATTR_USE_CANDIDATE         = 0x0025,  // No content, Length = 0
  STUN_ATTR_ICE_CONTROLLED        = 0x8029,  // UInt64
  STUN_ATTR_ICE_CONTROLLING       = 0x802A   // UInt64
};

enum StunErrorCodes {
  STUN_ERROR_BAD_REQUEST          = 400,
  STUN_ERROR_UNAUTHORIZED         = 401,
  STUN_ERROR_UNKNOWN_ATTRIBUTE    = 420,
  STUN_ERROR_STALE_CREDENTIALS    = 430,
  STUN_ERROR_INTEGRITY_CHECK_FAILURE = 431,
  STUN_ERROR_MISSING_USERNAME     = 432,
  STUN_ERROR_USE_TLS              = 433,
  STUN_ERROR_SERVER_ERROR         = 500,
  STUN_ERROR_GLOBAL_FAILURE       = 600
};

enum StunAddressFamily {
  // NB: UNDEF is not part of the STUN spec.
  STUN_ADDRESS_UNDEF = 0,
  STUN_ADDRESS_IPV4 = 1,
  STUN_ADDRESS_IPV6 = 2
};

extern const char STUN_ERROR_REASON_BAD_REQUEST[];
extern const char STUN_ERROR_REASON_UNAUTHORIZED[];
extern const char STUN_ERROR_REASON_STALE_CREDENTIALS[];
extern const char STUN_ERROR_REASON_SERVER_ERROR[];

// STUN Attribute header length.
const size_t kStunAttributeHeaderSize = 4;

// Following values correspond to RFC5389.
const size_t kStunHeaderSize = 20;
const size_t kStunTransactionIdOffset = 8;
const size_t kStunTransactionIdLength = 12;
const uint32 kStunMagicCookie = 0x2112A442;
const size_t kStunMagicCookieLength = sizeof(kStunMagicCookie);

// Following value corresponds to an earlier version of STUN from
// RFC3489.
const size_t kStunLegacyTransactionIdLength = 16;

// STUN Message Integrity HMAC length.
const size_t kStunMessageIntegritySize = 20;

class StunAttribute;
class StunAddressAttribute;
class StunUInt32Attribute;
class StunUInt64Attribute;
class StunByteStringAttribute;
class StunErrorCodeAttribute;
class StunUInt16ListAttribute;
class StunTransportPrefsAttribute;

// Records a complete STUN/TURN message.  Each message consists of a type and
// any number of attributes.  Each attribute is parsed into an instance of an
// appropriate class (see above).  The Get* methods will return instances of
// that attribute class.
class StunMessage {
 public:
  StunMessage();
  ~StunMessage();
  StunMessageType type() const { return static_cast<StunMessageType>(type_); }
  uint16 length() const { return length_; }
  const std::string& transaction_id() const { return transaction_id_; }

  // Returns true if the message confirms to RFC3489 rather than
  // RFC5389. The main difference between two version of the STUN
  // protocol is the presence of the magic cookie and different length
  // of transaction ID. For outgoing packets version of the protocol
  // is determined by the lengths of the transaction ID.
  bool IsLegacy() const;

  static bool ValidateMessageIntegrity(
      const char* data, size_t size, const std::string& password);
  void AddMessageIntegrity(const std::string& password);
  bool HasMessageIntegrity() const;

  void SetType(StunMessageType type) { type_ = type; }
  bool SetTransactionID(const std::string& str);

  const StunAddressAttribute* GetAddress(StunAttributeType type) const;
  const StunUInt32Attribute* GetUInt32(StunAttributeType type) const;
  const StunUInt64Attribute* GetUInt64(StunAttributeType type) const;
  const StunByteStringAttribute* GetByteString(StunAttributeType type) const;
  const StunErrorCodeAttribute* GetErrorCode() const;
  const StunUInt16ListAttribute* GetUnknownAttributes() const;
  const StunTransportPrefsAttribute* GetTransportPrefs() const;

  void AddAttribute(StunAttribute* attr);

  // Parses the STUN/TURN packet in the given buffer and records it here.  The
  // return value indicates whether this was successful.
  bool Read(talk_base::ByteBuffer* buf);

  // Writes this object into a STUN/TURN packet. Return value is true if
  // successful.
  void Write(talk_base::ByteBuffer* buf) const;

 private:
  const StunAttribute* GetAttribute(StunAttributeType type) const;
  static bool IsValidTransactionId(const std::string& transaction_id);

  uint16 type_;
  uint16 length_;
  std::string transaction_id_;
  std::vector<StunAttribute*>* attrs_;
};

// Base class for all STUN/TURN attributes.
class StunAttribute {
 public:
  virtual ~StunAttribute() {}

  StunAttributeType type() const {
    return static_cast<StunAttributeType>(type_);
  }
  uint16 length() const { return length_; }

  // Only XorAddressAttribute needs this so far.
  virtual void SetOwner(StunMessage* owner) { }

  // Reads the body (not the type or length) for this type of attribute from
  // the given buffer.  Return value is true if successful.
  virtual bool Read(talk_base::ByteBuffer* buf) = 0;

  // Writes the body (not the type or length) to the given buffer.  Return
  // value is true if successful.
  virtual void Write(talk_base::ByteBuffer* buf) const = 0;

  // Creates an attribute object with the given type, length and transaction id.
  static StunAttribute* Create(uint16 type, uint16 length,
                               StunMessage* owner);

  // Creates an attribute object with the given type and smallest length.
  static StunAddressAttribute* CreateAddress(uint16 type);
  static StunUInt32Attribute* CreateUInt32(uint16 type);
  static StunUInt64Attribute* CreateUInt64(uint16 type);
  static StunByteStringAttribute* CreateByteString(uint16 type);
  static StunErrorCodeAttribute* CreateErrorCode();
  static StunUInt16ListAttribute* CreateUnknownAttributes();
  static StunTransportPrefsAttribute* CreateTransportPrefs();

 protected:
  StunAttribute(uint16 type, uint16 length);
  void SetLength(uint16 length) { length_ = length; }
  void WritePadding(talk_base::ByteBuffer* buf) const;
  void ConsumePadding(talk_base::ByteBuffer* buf) const;

 private:
  uint16 type_;
  uint16 length_;
};

// Implements STUN/TURN attributes that record an Internet address.
class StunAddressAttribute : public StunAttribute {
 public:
  StunAddressAttribute(uint16 type, uint16 length);

  static const uint16 SIZE_UNDEF = 0;
  static const uint16 SIZE_IP4 = 8;
  static const uint16 SIZE_IP6 = 20;

  StunAddressFamily family() const {
    switch (address_.ipaddr().family()) {
      case AF_INET:
        return STUN_ADDRESS_IPV4;
      case AF_INET6:
        return STUN_ADDRESS_IPV6;
    }
    return STUN_ADDRESS_UNDEF;
  }

  uint16 port() const { return address_.port(); }
  const talk_base::IPAddress& ipaddr() const { return address_.ipaddr(); }
  void SetAddress(const talk_base::SocketAddress& addr) {
    address_ = addr;
    EnsureAddressLength();
  }
  const talk_base::SocketAddress& GetAddress() const { return address_; }
  void SetIP(const talk_base::IPAddress& ip) {
    address_.SetIP(ip);
    EnsureAddressLength();
  }
  void SetPort(uint16 port) { address_.SetPort(port); }

  virtual bool Read(talk_base::ByteBuffer* buf);
  virtual void Write(talk_base::ByteBuffer* buf) const;

 private:
  void EnsureAddressLength() {
    switch (family()) {
      case STUN_ADDRESS_IPV4: {
        SetLength(SIZE_IP4);
        break;
      }
      case STUN_ADDRESS_IPV6: {
        SetLength(SIZE_IP6);
        break;
      }
      default: {
        SetLength(SIZE_UNDEF);
        break;
      }
    }
  }
  talk_base::SocketAddress address_;
};

// Implements STUN/TURN attributes that record an Internet address. When encoded
// in a STUN message, the address contained in this attribute is XORed with the
// transaction ID of the message.
class StunXorAddressAttribute : public StunAddressAttribute {
 public:
  StunXorAddressAttribute(uint16 type, uint16 length);
  StunXorAddressAttribute(uint16 type, uint16 length,
                          StunMessage* owner);

  virtual void SetOwner(StunMessage* owner) {
    owner_ = owner;
  }
  virtual bool Read(talk_base::ByteBuffer* buf);
  virtual void Write(talk_base::ByteBuffer* buf) const;
 private:
  talk_base::IPAddress GetXoredIP() const;
  StunMessage* owner_;
};

// Implements STUN/TURN attributs that record a 32-bit integer.
class StunUInt32Attribute : public StunAttribute {
 public:
  explicit StunUInt32Attribute(uint16 type);

  static const uint16 SIZE = 4;

  uint32 value() const { return bits_; }

  void SetValue(uint32 bits) { bits_ = bits; }

  bool GetBit(int index) const;
  void SetBit(int index, bool value);

  bool Read(talk_base::ByteBuffer* buf);
  void Write(talk_base::ByteBuffer* buf) const;

 private:
  uint32 bits_;
};

class StunUInt64Attribute : public StunAttribute {
 public:
  explicit StunUInt64Attribute(uint16 type);

  static const uint16 SIZE = 8;

  uint64 value() const { return bits_; }

  void SetValue(uint64 bits) { bits_ = bits; }

  bool Read(talk_base::ByteBuffer* buf);
  void Write(talk_base::ByteBuffer* buf) const;

 private:
  uint64 bits_;
};

// Implements STUN/TURN attributes that record an arbitrary byte string
class StunByteStringAttribute : public StunAttribute {
 public:
  StunByteStringAttribute(uint16 type, uint16 length);
  ~StunByteStringAttribute();

  const char* bytes() const { return bytes_; }

  void SetBytes(char* bytes, uint16 length);

  void CopyBytes(const char* bytes);  // uses strlen
  void CopyBytes(const void* bytes, uint16 length);

  uint8 GetByte(int index) const;
  void SetByte(int index, uint8 value);

  bool Read(talk_base::ByteBuffer* buf);
  void Write(talk_base::ByteBuffer* buf) const;

 private:
  char* bytes_;
};

// Implements STUN/TURN attributes that record an error code.
class StunErrorCodeAttribute : public StunAttribute {
 public:
  StunErrorCodeAttribute(uint16 type, uint16 length);
  ~StunErrorCodeAttribute();

  static const uint16 MIN_SIZE = 4;

  uint32 error_code() const { return (class_ << 8) | number_; }
  uint8 error_class() const { return class_; }
  uint8 number() const { return number_; }
  const std::string& reason() const { return reason_; }

  void SetErrorCode(uint32 code);
  void SetErrorClass(uint8 eclass) { class_ = eclass; }
  void SetNumber(uint8 number) { number_ = number; }
  void SetReason(const std::string& reason);

  bool Read(talk_base::ByteBuffer* buf);
  void Write(talk_base::ByteBuffer* buf) const;

 private:
  uint8 class_;
  uint8 number_;
  std::string reason_;
};

// Implements STUN/TURN attributes that record a list of attribute names.
class StunUInt16ListAttribute : public StunAttribute {
 public:
  StunUInt16ListAttribute(uint16 type, uint16 length);
  ~StunUInt16ListAttribute();

  size_t Size() const;
  uint16 GetType(int index) const;
  void SetType(int index, uint16 value);
  void AddType(uint16 value);

  bool Read(talk_base::ByteBuffer* buf);
  void Write(talk_base::ByteBuffer* buf) const;

 private:
  std::vector<uint16>* attr_types_;
};

// The special MAGIC-COOKIE attribute is used to distinguish TURN packets from
// other kinds of traffic.
// TODO: This value has nothing to do with STUN. Move it to a
// separate file.
extern const char TURN_MAGIC_COOKIE_VALUE[4];

// Returns the (successful) response type for the given request type.
StunMessageType GetStunResponseType(StunMessageType request_type);

// Returns the error response type for the given request type.
StunMessageType GetStunErrorResponseType(StunMessageType request_type);

}  // namespace cricket

#endif  // TALK_P2P_BASE_STUN_H_
