/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * code in here is generic, shared utility code across all messenger
 * components. There should be no command or widget specific code here
 */

function MessengerSetForcedCharacterSet(aCharset)
{
  messenger.setDocumentCharset(aCharset);
  msgWindow.mailCharacterSet = aCharset;
  msgWindow.charsetOverride = true;

  // DO NOT try to reload the message here. we do this automatically now in
  //  messenger.SetDocumentCharset. You'll just break things and reak havoc
  // if you call ReloadMessage() here...
}
