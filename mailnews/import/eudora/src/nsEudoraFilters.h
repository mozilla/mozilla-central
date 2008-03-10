/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is the Mozilla Penelope project.
 *
 * The Initial Developer of the Original Code is
 * QUALCOMM Incorporated.
 * Portions created by QUALCOMM Incorporated are
 * Copyright (C) 2007 QUALCOMM Incorporated. All Rights Reserved.
 *
 * Contributor(s):
 *   Jeff Beckley <beckley@qualcomm.com> original author
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

#ifndef nsEudoraFilters_h___
#define nsEudoraFilters_h___

#include "nsIImportFilters.h"
#include "nsILocalFile.h"
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

  PRBool m_isAnd;
  PRBool m_isUnless;
  PRBool m_ignoreTerm;
  PRBool m_isIncoming;
  PRBool m_addedAction;
  PRBool m_hasTransfer;
  PRBool m_hasStop;
  PRBool m_termNotGroked;

  PRBool RealImport();
  nsresult Init();
  nsresult LoadServers();
  nsresult SaveFilters();
  nsresult CreateNewFilter(const char* pName);
  nsresult FinalizeFilter();
  nsresult EnableFilter(PRBool enable);
  nsresult AddTerm(const char* pHeader, const char* pVerb, const char* pValue, PRBool addAnd, PRBool negateVerb);

  nsresult AddAction(nsMsgRuleActionType actionType, PRInt32 junkScore = 0, nsMsgLabelValue label = 0,
                     nsMsgPriorityValue priority = 0, const char* strValue = nsnull, const char* targetFolderUri = nsnull);
  nsresult AddJunkAction(PRInt32 junkScore)
           { return AddAction(nsMsgFilterAction::JunkScore, junkScore); }
  nsresult AddLabelAction(nsMsgLabelValue label)
           { return AddAction(nsMsgFilterAction::Label, 0, label); }
  nsresult AddPriorityAction(nsMsgPriorityValue priority)
           { return AddAction(nsMsgFilterAction::ChangePriority, 0, 0, priority); }
  nsresult AddStringAction(nsMsgRuleActionType actionType, const char* strValue)
           { return AddAction(actionType, 0, 0, 0, strValue); }
  nsresult AddMailboxAction(const char* pMailboxPath, PRBool isTransfer);

  nsresult GetMailboxFolder(const char* pNameHierarchy, nsIMsgFolder** ppFolder);
};

#endif /* nsEudoraFilters_h___ */

