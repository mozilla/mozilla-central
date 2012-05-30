/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <istream>

template <size_t len>
inline bool eq(const char* str1, const char (&str2)[len])
{
  return ::strncmp(str1, str2, len) == 0;
};

class CRTFDecoder {
public:
  virtual void BeginGroup() = 0;
  virtual void EndGroup() = 0;
  virtual void Keyword(const char* name, const int* Val) = 0;
  virtual void PCDATA(const wchar_t* data, size_t cch) = 0;
  virtual void BDATA(const char* data, size_t sz) = 0;
};

void DecodeRTF(std::istream& rtf, CRTFDecoder& decoder);
