/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOutlookCompose_h__
#define nsOutlookCompose_h__

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsIFile.h"
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
  nsresult  CreateComponents(void);

  void      UpdateHeader(CMapiMessageHeaders& oldHeaders, const CMapiMessageHeaders& newHeaders, CMapiMessageHeaders::SpecialHeader header, bool addIfAbsent = true);
  void      UpdateHeaders(CMapiMessageHeaders& oldHeaders, const CMapiMessageHeaders& newHeaders);

  nsresult  ComposeTheMessage(nsMsgDeliverMode mode, CMapiMessage &msg, nsIFile **pMsg);
  nsresult  CopyComposedMessage(nsIFile *pSrc, nsIOutputStream *pDst, CMapiMessage& origMsg);

  // Bug 593907
  void HackBody(const wchar_t* orig, size_t origLen, nsString& hack);
  void UnhackBody(nsCString& body);
  bool GenerateHackSequence(const wchar_t* body, size_t origLen);
  // End Bug 593907

private:
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
