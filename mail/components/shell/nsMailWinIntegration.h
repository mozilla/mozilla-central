/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMailWinIntegration_h_
#define nsMailWinIntegration_h_

#include "nsIWindowsShellService.h"
#include "nsIObserver.h"
#include "nsString.h"

#include <ole2.h>
#include <windows.h>

#define NS_MAILWININTEGRATION_CID \
{0x2ebbe84, 0xc179, 0x4598, {0xaf, 0x18, 0x1b, 0xf2, 0xc4, 0xbc, 0x1d, 0xf9}}

typedef struct {
  char* keyName;
  char* valueName;
  char* valueData;

  int32_t flags;
} SETTING;

class nsWindowsShellService : public nsIWindowsShellService
{
public:
  nsWindowsShellService();
  virtual ~nsWindowsShellService() {};
  NS_HIDDEN_(nsresult) Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISHELLSERVICE
  NS_DECL_NSIWINDOWSSHELLSERVICE

protected:
  bool TestForDefault(SETTING aSettings[], int32_t aSize);
  bool IsDefaultClientVista(uint16_t aApps, bool* aIsDefaultClient);

private:
  bool mCheckedThisSession;
  nsAutoString mAppLongPath;
 };

#endif
