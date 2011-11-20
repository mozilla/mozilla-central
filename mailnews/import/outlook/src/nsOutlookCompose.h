/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#ifndef nsOutlookCompose_h__
#define nsOutlookCompose_h__

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsIFile.h"
#include "nsVoidArray.h"
#include "nsIImportService.h"

class nsIMsgSend;
class nsIMsgCompFields;
class nsIMsgIdentity;
class nsIMsgSendListener;
class nsIIOService;

#include "nsIMsgSend.h"
#include "nsNetUtil.h"

#include "MapiMessage.h"

#include <list>

///////////////////////////////////////////////////////////////////////////////////////////////

class nsOutlookCompose {
public:
  nsOutlookCompose();
  ~nsOutlookCompose();

  nsresult ProcessMessage(nsMsgDeliverMode mode, CMapiMessage &msg, nsIOutputStream *pDst);
  static nsresult CreateIdentity(void);
  static void ReleaseIdentity(void);
private:
  struct CidReplacePair {
    nsCString cidOrig;
    nsCString cidNew;
  };

  nsresult  CreateComponents( void);

  void      UpdateHeader(CMapiMessageHeaders& oldHeaders, const CMapiMessageHeaders& newHeaders, CMapiMessageHeaders::SpecialHeader header, bool addIfAbsent = true);
  void      UpdateHeaders(CMapiMessageHeaders& oldHeaders, const CMapiMessageHeaders& newHeaders);

  nsresult  ComposeTheMessage(nsMsgDeliverMode mode, CMapiMessage &msg, nsIFile **pMsg);
  nsresult  CopyComposedMessage( nsIFile *pSrc, nsIOutputStream *pDst, CMapiMessage& origMsg);

  // Bug 593907
  void HackBody(const wchar_t* orig, size_t origLen, nsString& hack);
  void UnhackBody(nsCString& body);
  bool GenerateHackSequence(const wchar_t* body, size_t origLen);
  // End Bug 593907

  static void ClearReplaceCid(CidReplacePair* pair) { delete pair; }
  void ClearReplaceCids();
private:
  std::list<CidReplacePair*> m_replacedCids;

  class ReplaceCidInLine {
  public:
    ReplaceCidInLine(nsCString& line);
    void operator () (const CidReplacePair* pair);
  private:
    nsCString& m_line;
    bool m_finishedReplacing;
  };


  nsIMsgSendListener *  m_pListener;
  nsIMsgCompFields *    m_pMsgFields;
  static nsIMsgIdentity *    m_pIdentity;
  char* m_optimizationBuffer;
  unsigned int m_optimizationBufferSize;
  nsCOMPtr<nsIImportService>  m_pImportService;

  // Bug 593907
  nsString m_hackedPostfix;
  // End Bug 593907
};


#endif /* nsOutlookCompose_h__ */
