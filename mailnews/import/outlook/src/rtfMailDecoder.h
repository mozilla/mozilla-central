/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/Attributes.h"
#include <string>
#include "rtfDecoder.h"

class CRTFMailDecoder: public CRTFDecoder {
public:
  enum Mode {mNone, mText, mHTML};
  CRTFMailDecoder() : m_mode(mNone), m_state(sNormal), m_skipLevel(0) {}
  void BeginGroup() MOZ_OVERRIDE;
  void EndGroup() MOZ_OVERRIDE;
  void Keyword(const char* name, const int* Val) MOZ_OVERRIDE;
  void PCDATA(const wchar_t* data, size_t cch) MOZ_OVERRIDE;
  void BDATA(const char* data, size_t sz) MOZ_OVERRIDE;
  const wchar_t* text() { return m_text.c_str(); }
  std::wstring::size_type textSize() { return m_text.size(); }
  Mode mode() { return m_mode; }
private:
  enum State {sNormal = 0x0000,
              sBeginGroup = 0x0001,
              sAsterisk = 0x0002,
              sHtmlRtf = 0x0004};

  std::wstring m_text;
  Mode m_mode;
  unsigned int m_state; // bitmask of State
// bool m_beginGroup; // true just after the {
//bool m_asterisk; // true just after the {\*
  int m_skipLevel; // if >0 then we ignore everything
// bool m_htmlrtf;
  inline void SetState(unsigned int s) { m_state |= s; }
  inline void ClearState(unsigned int s) { m_state &= ~s; }
  inline bool CheckState(State s) { return (m_state & s) != 0; }
  inline bool IsAsterisk() { return CheckState(sAsterisk); }
  inline bool IsBeginGroup() { return CheckState(sBeginGroup); }
  inline bool IsHtmlRtf() { return CheckState(sHtmlRtf); }
  void AddText(const wchar_t* txt, size_t cch=static_cast<size_t>(-1));
};
