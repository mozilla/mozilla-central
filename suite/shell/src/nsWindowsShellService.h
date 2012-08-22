/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsShellService.h"
#include "nsStringGlue.h"
#include "nsIWindowsShellService.h"

#include <windows.h>

#define NS_SUITEWININTEGRATION_CID \
{0x39b688ec, 0xe308, 0x49e5, {0xbe, 0x6b, 0x28, 0xdc, 0x7f, 0xcd, 0x61, 0x54}}

typedef struct {
  char* keyName;
  char* valueName;
  char* valueData;

  int32_t flags;
} SETTING;

class nsWindowsShellService : public nsIWindowsShellService
{
public:
  nsWindowsShellService() : mCheckedThisSessionClient(false) {};
  ~nsWindowsShellService() {};
  NS_HIDDEN_(nsresult) Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISHELLSERVICE
  NS_DECL_NSIWINDOWSSHELLSERVICE

protected:
  bool IsDefaultClientVista(uint16_t aApps, bool* aIsDefaultClient);
  bool TestForDefault(SETTING aSettings[], int32_t aSize);

private:
  bool mCheckedThisSessionClient;
  nsString mAppLongPath;
  nsString mAppShortPath;
};

