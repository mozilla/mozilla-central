/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code
 *
 * The Initial Developer of the Original Code is
 * Mike Kaganski <mikekaganski@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include <string>
#include "rtfDecoder.h"

class CRTFMailDecoder: public CRTFDecoder {
public:
  enum Mode {mNone, mText, mHTML};
  CRTFMailDecoder() : m_mode(mNone), m_state(sNormal), m_skipLevel(0) {}
  void BeginGroup();
  void EndGroup();
  void Keyword(const char* name, const int* Val);
  void PCDATA(const wchar_t* data, size_t cch);
  void BDATA(const char* data, size_t sz);
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
