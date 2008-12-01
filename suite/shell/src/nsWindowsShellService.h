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
 * The Original Code is Shell Service.
 *
 * The Initial Developer of the Original Code is mozilla.org.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Ben Goodger    <ben@mozilla.org>
 *  Aaron Kaluszka <ask@swva.net>
 *  Frank Wein     <mcsmurf@mcsmurf.de>
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

#include "nscore.h"
#include "nsIShellService.h"
#include "nsStringAPI.h"

#include <windows.h>

#define NS_SUITEWININTEGRATION_CONTRACTID "@mozilla.org/suite/shell-service;1"

#define NS_SUITEWININTEGRATION_CID \
{0x39b688ec, 0xe308, 0x49e5, {0xbe, 0x6b, 0x28, 0xdc, 0x7f, 0xcd, 0x61, 0x54}}

typedef struct {
  char* keyName;
  char* valueName;
  char* valueData;

  PRInt32 flags;
} SETTING;

class nsWindowsShellService : public nsIShellService
{
public:
  nsWindowsShellService() : mCheckedThisSessionClient(PR_FALSE) {};
  ~nsWindowsShellService() {};
  NS_HIDDEN_(nsresult) Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISHELLSERVICE

protected:
  PRBool IsDefaultClientVista(PRUint16 aApps, PRBool* aIsDefaultClient);
  PRBool SetDefaultClientVista(PRUint16 aApps);
  PRBool TestForDefault(SETTING aSettings[], PRInt32 aSize);

private:
  PRBool mCheckedThisSessionClient;
  nsString mAppLongPath;
  nsString mAppShortPath;
};

