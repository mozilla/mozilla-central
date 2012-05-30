/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsIMdbFactoryFactory_h__
#define nsIMdbFactoryFactory_h__

#include "nsISupports.h"
#include "nsIFactory.h"
#include "nsIComponentManager.h"

class nsIMdbFactory;

// 2794D0B7-E740-47a4-91C0-3E4FCB95B806
#define NS_IMDBFACTORYFACTORY_IID          \
{ 0x2794d0b7, 0xe740, 0x47a4, { 0x91, 0xc0, 0x3e, 0x4f, 0xcb, 0x95, 0xb8, 0x6 } }

// because Mork doesn't support XPCOM, we have to wrap the mdb factory interface
// with an interface that gives you an mdb factory.
class nsIMdbFactoryService : public nsISupports
{
public:
  NS_DECLARE_STATIC_IID_ACCESSOR(NS_IMDBFACTORYFACTORY_IID)
  NS_IMETHOD GetMdbFactory(nsIMdbFactory **aFactory) = 0;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsIMdbFactoryService, NS_IMDBFACTORYFACTORY_IID)

#endif
