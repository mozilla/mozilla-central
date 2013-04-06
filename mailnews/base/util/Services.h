/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_mailnews_Services_h
#define mozilla_mailnews_Services_h

#include "mozilla/Services.h"

#define MOZ_SERVICE(NAME, TYPE, SERVICE_CID) class TYPE;
#include "mozilla/mailnews/ServiceList.h"
#undef MOZ_SERVICE

namespace mozilla {
namespace services {

#define MOZ_SERVICE(NAME, TYPE, SERVICE_CID) \
  already_AddRefed<TYPE> Get##NAME();
#include "ServiceList.h"
#undef MOZ_SERVICE

} // namespace services
} // namespace mozilla

#endif
