/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgMdnGenerator_H_
#define _nsMsgMdnGenerator_H_

#include "nsIMsgMdnGenerator.h"
#include "nsCOMPtr.h"
#include "nsIUrlListener.h"
#include "nsIMsgIncomingServer.h"
#include "nsIOutputStream.h"
#include "nsIFile.h"
#include "nsIMsgIdentity.h"
#include "nsIMsgWindow.h"
#include "nsIMimeHeaders.h"
#include "nsStringGlue.h"
#include "MailNewsTypes2.h"

#define eNeverSendOp ((int32_t) 0)
#define eAutoSendOp ((int32_t) 1)
#define eAskMeOp ((int32_t) 2)
#define eDeniedOp ((int32_t) 3)

class nsMsgMdnGenerator : public nsIMsgMdnGenerator, public nsIUrlListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGMDNGENERATOR
  NS_DECL_NSIURLLISTENER

  nsMsgMdnGenerator();
  virtual ~nsMsgMdnGenerator();

private:
  // Sanity Check methods
  bool ProcessSendMode(); // must called prior ValidateReturnPath
  bool ValidateReturnPath();
  bool NotInToOrCc();
  bool MailAddrMatch(const char *addr1, const char *addr2);

  nsresult StoreMDNSentFlag(nsIMsgFolder *folder, nsMsgKey key);
  nsresult ClearMDNNeededFlag(nsIMsgFolder *folder, nsMsgKey key);
  nsresult NoteMDNRequestHandled();

  nsresult CreateMdnMsg();
  nsresult CreateFirstPart();
  nsresult CreateSecondPart();
  nsresult CreateThirdPart();
  nsresult SendMdnMsg();

  // string bundle helper methods
  nsresult GetStringFromName(const PRUnichar *aName, PRUnichar **aResultString);
  nsresult FormatStringFromName(const PRUnichar *aName,
                                const PRUnichar *aString,
                                PRUnichar **aResultString);

  // other helper methods
  nsresult InitAndProcess(bool *needToAskUser);
  nsresult OutputAllHeaders();
  nsresult WriteString(const char *str);

private:
  EDisposeType m_disposeType;
  nsCOMPtr<nsIMsgWindow> m_window;
  nsCOMPtr<nsIOutputStream> m_outputStream;
  nsCOMPtr<nsIFile> m_file;
  nsCOMPtr<nsIMsgIdentity> m_identity;
  nsMsgKey m_key;
  nsCString m_charset;
  nsCString m_email;
  nsCString m_mimeSeparator;
  nsCString m_messageId;
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsCOMPtr<nsIMsgIncomingServer> m_server;
  nsCOMPtr<nsIMimeHeaders> m_headers;
  nsCString m_dntRrt;
  int32_t m_notInToCcOp;
  int32_t m_outsideDomainOp;
  int32_t m_otherOp;
  bool m_reallySendMdn;
  bool m_autoSend;
  bool m_autoAction;
  bool m_mdnEnabled;
};

#endif // _nsMsgMdnGenerator_H_

