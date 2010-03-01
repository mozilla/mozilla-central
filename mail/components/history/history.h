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
 * The Original Code is Thunderbird empty history.
 *
 * The Initial Developer of the Original Code is
 *  the Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

#ifndef history_h_
#define history_h_

#include "mozilla/IHistory.h"
#include "mozilla/dom/Link.h"

namespace mozilla {

#define NS_HISTORYSERVICE_CID \
   {0x7f7ad055, 0x49e6, 0x440b, {0xa6, 0xe9, 0x89, 0x71, 0x25, 0xae, 0xc1, 0x1e}}

/**
 * This service only exists here because Thunderbird doesn't currently want
 * MOZ_PLACES and Gecko doesn't want to provide a history service for
 * non-MOZ_PLACES apps or a sane default so that they can get unvisited links
 * without having to implement the service.
 */
class History : public IHistory
{
public:
  History();

  NS_DECL_ISUPPORTS
  NS_DECL_IHISTORY

  /**
   * Obtains a pointer that has had AddRef called on it.  Used by the service
   * manager only.
   */
  static History *GetSingleton();

private:
  ~History();

  static History *gService;
};

}

#endif
