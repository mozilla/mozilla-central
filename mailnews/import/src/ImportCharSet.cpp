/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#include "ImportCharSet.h"

char ImportCharSet::m_upperCaseMap[256];
char ImportCharSet::m_Ascii[256] = {0}; // the initialiser makes it strong

class UInitMaps {
public:
  UInitMaps();
};

UInitMaps  gInitMaps;

UInitMaps::UInitMaps()
{
  int  i;

  for (i = 0; i < 256; i++)
    ImportCharSet::m_upperCaseMap[i] = i;
  for (i = 'a'; i <= 'z'; i++)
    ImportCharSet::m_upperCaseMap[i] = i - 'a' + 'A';

  for (i = 0; i < 256; i++)
    ImportCharSet::m_Ascii[i] = 0;

  for (i = ImportCharSet::cUpperAChar; i <= ImportCharSet::cUpperZChar; i++)
    ImportCharSet::m_Ascii[i] |= (ImportCharSet::cAlphaNumChar | ImportCharSet::cAlphaChar);
  for (i = ImportCharSet::cLowerAChar; i <= ImportCharSet::cLowerZChar; i++)
    ImportCharSet::m_Ascii[i] |= (ImportCharSet::cAlphaNumChar | ImportCharSet::cAlphaChar);
  for (i = ImportCharSet::cZeroChar; i <= ImportCharSet::cNineChar; i++)
    ImportCharSet::m_Ascii[i] |= (ImportCharSet::cAlphaNumChar | ImportCharSet::cDigitChar);

  ImportCharSet::m_Ascii[ImportCharSet::cTabChar] |= ImportCharSet::cWhiteSpaceChar;
  ImportCharSet::m_Ascii[ImportCharSet::cCRChar] |= ImportCharSet::cWhiteSpaceChar;
  ImportCharSet::m_Ascii[ImportCharSet::cLinefeedChar] |= ImportCharSet::cWhiteSpaceChar;
  ImportCharSet::m_Ascii[ImportCharSet::cSpaceChar] |= ImportCharSet::cWhiteSpaceChar;

  ImportCharSet::m_Ascii['('] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii[')'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii['<'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii['>'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii['@'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii[','] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii[';'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii[':'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii['\\'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii['"'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii['.'] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii['['] |= ImportCharSet::c822SpecialChar;
  ImportCharSet::m_Ascii[']'] |= ImportCharSet::c822SpecialChar;


}
