/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMsgSearchScopeTerm_h
#define __nsMsgSearchScopeTerm_h

#include "nsMsgSearchCore.h"
#include "nsMsgSearchScopeTerm.h"
#include "nsIMsgSearchAdapter.h"
#include "nsIMsgFolder.h"
#include "nsIMsgSearchAdapter.h"
#include "nsIMsgSearchSession.h"
#include "nsCOMPtr.h"
#include "nsIWeakReference.h"
#include "nsIWeakReferenceUtils.h"

class nsMsgSearchScopeTerm : public nsIMsgSearchScopeTerm
{
public:
  nsMsgSearchScopeTerm (nsIMsgSearchSession *, nsMsgSearchScopeValue, nsIMsgFolder *);
  nsMsgSearchScopeTerm ();
  virtual ~nsMsgSearchScopeTerm ();
  
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGSEARCHSCOPETERM
    
  nsresult TimeSlice (bool *aDone);
  nsresult InitializeAdapter (nsISupportsArray *termList);
  
  char *GetStatusBarName ();
  
  nsMsgSearchScopeValue m_attribute;
  char *m_name;
  nsCOMPtr <nsIMsgFolder> m_folder;
  nsCOMPtr <nsIMsgSearchAdapter> m_adapter;
  nsCOMPtr <nsIInputStream> m_inputStream; // for message bodies
  nsWeakPtr m_searchSession;
  bool m_searchServer;
  
};

#endif
