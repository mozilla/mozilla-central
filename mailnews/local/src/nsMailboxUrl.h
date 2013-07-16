/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMailboxUrl_h__
#define nsMailboxUrl_h__

#include "mozilla/Attributes.h"
#include "nsIMailboxUrl.h"
#include "nsMsgMailNewsUrl.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsISupportsObsolete.h"

class nsMailboxUrl : public nsIMailboxUrl, public nsMsgMailNewsUrl, public nsIMsgMessageUrl, public nsIMsgI18NUrl
{
public:
  // nsIURI over-ride...
  NS_IMETHOD SetSpec(const nsACString &aSpec) MOZ_OVERRIDE;
  NS_IMETHOD SetQuery(const nsACString &aQuery) MOZ_OVERRIDE;

  // from nsIMailboxUrl:
  NS_IMETHOD SetMailboxParser(nsIStreamListener * aConsumer) MOZ_OVERRIDE;
  NS_IMETHOD GetMailboxParser(nsIStreamListener ** aConsumer) MOZ_OVERRIDE;
  NS_IMETHOD SetMailboxCopyHandler(nsIStreamListener *  aConsumer) MOZ_OVERRIDE;
  NS_IMETHOD GetMailboxCopyHandler(nsIStreamListener ** aConsumer) MOZ_OVERRIDE;

  NS_IMETHOD GetMessageKey(nsMsgKey* aMessageKey) MOZ_OVERRIDE;
  NS_IMETHOD GetMessageSize(uint32_t *aMessageSize) MOZ_OVERRIDE;
  NS_IMETHOD SetMessageSize(uint32_t aMessageSize) MOZ_OVERRIDE;
  NS_IMPL_CLASS_GETSET(MailboxAction, nsMailboxAction, m_mailboxAction)
  NS_IMETHOD IsUrlType(uint32_t type, bool *isType);
  NS_IMETHOD SetMoveCopyMsgKeys(nsMsgKey *keysToFlag, int32_t numKeys) MOZ_OVERRIDE;
  NS_IMETHOD GetMoveCopyMsgHdrForIndex(uint32_t msgIndex, nsIMsgDBHdr **msgHdr) MOZ_OVERRIDE;
  NS_IMETHOD GetNumMoveCopyMsgs(uint32_t *numMsgs) MOZ_OVERRIDE;
  NS_IMPL_CLASS_GETSET(CurMoveCopyMsgIndex, uint32_t, m_curMsgIndex)

  NS_IMETHOD GetFolder(nsIMsgFolder **msgFolder);

  // nsIMsgMailNewsUrl override
  NS_IMETHOD Clone(nsIURI **_retval) MOZ_OVERRIDE;

  // nsMailboxUrl
  nsMailboxUrl();
  virtual ~nsMailboxUrl();
  NS_DECL_NSIMSGMESSAGEURL
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIMSGI18NURL

protected:
  // protocol specific code to parse a url...
  virtual nsresult ParseUrl();
  nsresult GetMsgHdrForKey(nsMsgKey  msgKey, nsIMsgDBHdr ** aMsgHdr);

  // mailboxurl specific state
  nsCOMPtr<nsIStreamListener> m_mailboxParser;
  nsCOMPtr<nsIStreamListener> m_mailboxCopyHandler;

  nsMailboxAction m_mailboxAction; // the action this url represents...parse mailbox, display messages, etc.
  nsCOMPtr <nsIFile>  m_filePath;
  char *m_messageID;
  uint32_t m_messageSize;
  nsMsgKey m_messageKey;
  nsCString m_file;
  // This is currently only set when we're doing something with a .eml file.
  // If that changes, we should change the name of this var.
  nsCOMPtr<nsIMsgDBHdr> m_dummyHdr;

  // used by save message to disk
  nsCOMPtr<nsIFile> m_messageFile;
  bool                  m_addDummyEnvelope;
  bool                  m_canonicalLineEnding;
  nsresult ParseSearchPart();

  // for multiple msg move/copy
  nsTArray<nsMsgKey> m_keys;
  int32_t m_curMsgIndex;

  // truncated message support
  nsCString m_originalSpec;
  nsCString mURI; // the RDF URI associated with this url.
  nsCString mCharsetOverride; // used by nsIMsgI18NUrl...
};

#endif // nsMailboxUrl_h__
