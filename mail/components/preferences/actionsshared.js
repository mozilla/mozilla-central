/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const FILEACTION_SAVE_TO_DISK     = 1;
const FILEACTION_OPEN_INTERNALLY  = 2;
const FILEACTION_OPEN_DEFAULT     = 3;
const FILEACTION_OPEN_CUSTOM      = 4;
const FILEACTION_OPEN_PLUGIN      = 5;
function FileAction ()
{
}
FileAction.prototype = {
  type        : "",
  extension   : "",
  hasExtension: true,
  editable    : true,
  smallIcon   : "",
  bigIcon     : "",
  typeName    : "",
  action      : "",
  mimeInfo    : null,
  customHandler       : "",
  handleMode          : false,
  pluginAvailable     : false,
  pluginEnabled       : false,
  handledOnlyByPlugin : false
};


