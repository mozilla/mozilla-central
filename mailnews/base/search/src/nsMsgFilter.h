/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgFilter_H_
#define _nsMsgFilter_H_

#include "nscore.h"
#include "nsISupports.h"
#include "nsIMsgFilter.h"
#include "nsIMsgSearchScopeTerm.h"
#include "nsMsgSearchBoolExpression.h"
#include "nsIDateTimeFormat.h"
#include "nsIMsgFilterCustomAction.h"

class nsMsgRuleAction : public nsIMsgRuleAction
{
public:
  NS_DECL_ISUPPORTS

  nsMsgRuleAction();
  virtual ~nsMsgRuleAction();

  NS_DECL_NSIMSGRULEACTION

private:
    nsMsgRuleActionType      m_type;
    // this used to be a union - why bother?
    nsMsgPriorityValue  m_priority;  /* priority to set rule to */
    nsMsgLabelValue         m_label;  /* label to set rule to */
    nsCString    m_folderUri;
    PRInt32             m_junkScore;  /* junk score (or arbitrary int value?) */
    // arbitrary string value. Currently, email address to forward to
    nsCString           m_strValue;
    nsCString           m_customId;
    nsCOMPtr<nsIMsgFilterCustomAction> m_customAction;
} ;


class nsMsgFilter : public nsIMsgFilter
{
public:
  NS_DECL_ISUPPORTS

  nsMsgFilter();
  virtual ~nsMsgFilter ();

  NS_DECL_NSIMSGFILTER

  nsMsgFilterTypeType  GetType() {return m_type;}
  void    SetType(nsMsgFilterTypeType  type) {m_type = type;}
  bool    GetEnabled() {return m_enabled;}
  void    SetFilterScript(nsCString *filterName);

  bool    IsScript() {return (m_type &
                                  (nsMsgFilterType::InboxJavaScript |
                                   nsMsgFilterType::NewsJavaScript)) != 0;}

  // filing routines.
  nsresult  SaveRule(nsIOutputStream *aStream);

  PRInt16   GetVersion();
#ifdef DEBUG
  void      Dump();
#endif

  nsresult  ConvertMoveOrCopyToFolderValue(nsIMsgRuleAction *filterAction, nsCString &relativePath);
  static const char *GetActionStr(nsMsgRuleActionType action);
  static nsresult GetActionFilingStr(nsMsgRuleActionType action, nsCString &actionStr);
  static nsMsgRuleActionType GetActionForFilingStr(nsCString &actionStr);
  nsMsgRuleAction      m_action;
protected:
  nsMsgFilterTypeType m_type;
  nsString    m_filterName;
  nsCString   m_scriptFileName;  // iff this filter is a script.
  nsCString   m_description;
  nsCString   m_unparsedBuffer;

  bool m_enabled;
  bool m_temporary;
  bool m_unparseable;
  nsIMsgFilterList *m_filterList;  /* owning filter list */
  nsCOMPtr<nsISupportsArray> m_termList;       /* linked list of criteria terms */
  nsCOMPtr<nsIMsgSearchScopeTerm> m_scope;         /* default for mail rules is inbox, but news rules could
                                                  have a newsgroup - LDAP would be invalid */
  nsCOMPtr<nsISupportsArray> m_actionList;
  nsMsgSearchBoolExpression *m_expressionTree;
  nsCOMPtr<nsIDateTimeFormat> mDateFormatter;
};

#endif
