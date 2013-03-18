/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMsgResultElement_h
#define __nsMsgResultElement_h

#include "nsMsgSearchCore.h"
#include "nsIMsgSearchAdapter.h"
#include "nsTArray.h"

// nsMsgResultElement specifies a single search hit.

//---------------------------------------------------------------------------
// nsMsgResultElement is a list of attribute/value pairs which are used to
// represent a search hit without requiring a message header or server connection
//---------------------------------------------------------------------------

class nsMsgResultElement
{
public:
  nsMsgResultElement (nsIMsgSearchAdapter *);
  virtual ~nsMsgResultElement ();

  static nsresult AssignValues (nsIMsgSearchValue *src, nsMsgSearchValue *dst);
  nsresult GetValue (nsMsgSearchAttribValue, nsMsgSearchValue **) const;
  nsresult AddValue (nsIMsgSearchValue*);
    nsresult AddValue (nsMsgSearchValue*);

  nsresult GetPrettyName (nsMsgSearchValue**);
  nsresult Open (void *window);

  nsTArray<nsCOMPtr<nsIMsgSearchValue> > m_valueList;
  nsIMsgSearchAdapter *m_adapter;

protected:
};

#endif
