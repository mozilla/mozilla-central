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
