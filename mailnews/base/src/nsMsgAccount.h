/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsIMsgAccount.h"
#include "nsIPrefBranch.h"
#include "nsStringGlue.h"
#include "nsIMutableArray.h"

class nsMsgAccount : public nsIMsgAccount
{

public:
  nsMsgAccount();
  virtual ~nsMsgAccount();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGACCOUNT

private:
  nsCString m_accountKey;
  nsCOMPtr<nsIPrefBranch> m_prefs;
  nsCOMPtr<nsIMsgIncomingServer> m_incomingServer;

  nsCOMPtr<nsIMutableArray> m_identities;

  nsresult getPrefService();
  nsresult createIncomingServer();
  nsresult createIdentities();
  nsresult saveIdentitiesPref();
  nsresult addIdentityInternal(nsIMsgIdentity* identity);

  // Have we tried to get the server yet?
  bool mTriedToGetServer;
};

