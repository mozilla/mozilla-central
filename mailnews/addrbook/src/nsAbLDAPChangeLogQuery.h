/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbLDAPChangeLogQuery_h__
#define nsAbLDAPChangeLogQuery_h__

#include "mozilla/Attributes.h"
#include "nsAbLDAPReplicationQuery.h"
#include "nsStringGlue.h"

class nsAbLDAPChangeLogQuery : public nsIAbLDAPChangeLogQuery,
                               public nsAbLDAPReplicationQuery
{
public :
  NS_DECL_ISUPPORTS
  NS_DECL_NSIABLDAPCHANGELOGQUERY

  nsAbLDAPChangeLogQuery();
  virtual ~nsAbLDAPChangeLogQuery();

  NS_IMETHOD DoReplicationQuery() MOZ_OVERRIDE;
  NS_IMETHOD Init(const nsACString & aPrefName, nsIWebProgressListener *aProgressListener);
};

#endif // nsAbLDAPChangeLogQuery_h__
