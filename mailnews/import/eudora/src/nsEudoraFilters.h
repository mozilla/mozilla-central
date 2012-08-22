/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraFilters_h___
#define nsEudoraFilters_h___

#include "nsIImportFilters.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"
#include "nsMsgFilterCore.h"

class nsIMsgFolder;

class nsEudoraFilters : public nsIImportFilters {
public:
  nsEudoraFilters();
  virtual ~nsEudoraFilters();

  static nsresult Create(nsIImportFilters** aImport);

  // nsISupports interface
  NS_DECL_ISUPPORTS

  // nsIImportFilters interface
  NS_DECL_NSIIMPORTFILTERS

private:
  nsCOMPtr<nsIFile> m_pLocation;
  nsCOMPtr<nsISupportsArray> m_pServerArray;
  nsCOMPtr<nsISupportsArray> m_pFilterArray;
  nsCOMPtr<nsIMsgFolder> m_pMailboxesRoot;

  nsString m_errorLog;

  bool m_isAnd;
  bool m_isUnless;
  bool m_ignoreTerm;
  bool m_isIncoming;
  bool m_addedAction;
  bool m_hasTransfer;
  bool m_hasStop;
  bool m_termNotGroked;

  bool RealImport();
  nsresult Init();
  nsresult LoadServers();
  nsresult SaveFilters();
  nsresult CreateNewFilter(const char* pName);
  nsresult FinalizeFilter();
  nsresult EnableFilter(bool enable);
  nsresult AddTerm(const char* pHeader, const char* pVerb, const char* pValue, bool addAnd, bool negateVerb);

  nsresult AddAction(nsMsgRuleActionType actionType, int32_t junkScore = 0, nsMsgLabelValue label = 0,
                     nsMsgPriorityValue priority = 0, const char* strValue = nullptr, const char* targetFolderUri = nullptr);
  nsresult AddJunkAction(int32_t junkScore)
           { return AddAction(nsMsgFilterAction::JunkScore, junkScore); }
  nsresult AddLabelAction(nsMsgLabelValue label)
           { return AddAction(nsMsgFilterAction::Label, 0, label); }
  nsresult AddPriorityAction(nsMsgPriorityValue priority)
           { return AddAction(nsMsgFilterAction::ChangePriority, 0, 0, priority); }
  nsresult AddStringAction(nsMsgRuleActionType actionType, const char* strValue)
           { return AddAction(actionType, 0, 0, 0, strValue); }
  nsresult AddMailboxAction(const char* pMailboxPath, bool isTransfer);

  nsresult GetMailboxFolder(const char* pNameHierarchy, nsIMsgFolder** ppFolder);
};

#endif /* nsEudoraFilters_h___ */

