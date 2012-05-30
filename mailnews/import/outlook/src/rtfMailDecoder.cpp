/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "rtfMailDecoder.h"

void CRTFMailDecoder::BeginGroup()
{
  ClearState(sAsterisk);
  SetState(sBeginGroup);
  if (m_skipLevel)
    ++m_skipLevel;
}

void CRTFMailDecoder::EndGroup()
{
  ClearState(sAsterisk|sBeginGroup);
  if (m_skipLevel)
    --m_skipLevel;
}

void CRTFMailDecoder::AddText(const wchar_t* txt, size_t cch)
{
  if (!IsHtmlRtf()) {
    if (cch == static_cast<size_t>(-1))
      m_text += txt;
    else
      m_text.append(txt, cch);
  }
}

void CRTFMailDecoder::Keyword(const char* name, const int* Val)
{
  bool asterisk = IsAsterisk(); ClearState(sAsterisk); // for inside use only
  bool beginGroup = IsBeginGroup(); ClearState(sBeginGroup); // for inside use only
  if (!m_skipLevel) {
    if (eq(name, "*") && beginGroup) SetState(sAsterisk);
    else if (asterisk) {
      if (eq(name, "htmltag") && (m_mode == mHTML)) { // \*\htmltag -> don't ignore; include the following text
      }
      else ++m_skipLevel;
    }
    else if (eq(name, "htmlrtf")) {
      if (Val && (*Val==0))
        ClearState(sHtmlRtf);
      else
        SetState(sHtmlRtf);
    }
    else if (eq(name, "par") || eq(name, "line")) {
      AddText(L"\r\n");
    }
    else if (eq(name, "tab")) {
      AddText(L"\t");
    }
    else if (eq(name, "rquote")) {
      AddText(L"\x2019"); // Unicode right single quotation mark
    }
    else if (eq(name, "fromtext") && (m_mode==mNone)) { // avoid double "fromX"
      m_mode = mText;
    }
    else if (eq(name, "fromhtml") && (m_mode==mNone)) { // avoid double "fromX"
      m_mode = mHTML;
    }
    else if (eq(name, "fonttbl") || eq(name, "colortbl") || eq(name, "stylesheet") || eq(name, "pntext"))
      ++m_skipLevel;
  }
}

void CRTFMailDecoder::PCDATA(const wchar_t* data, size_t cch)
{
  ClearState(sAsterisk|sBeginGroup);
  if (!m_skipLevel)
    AddText(data, cch);
}

void CRTFMailDecoder::BDATA(const char* data, size_t sz)
{
  ClearState(sAsterisk|sBeginGroup);
}
