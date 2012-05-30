/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This module is designed to be a central place to initialise activity related
// modules.

const EXPORTED_SYMBOLS = [];

Components.utils.import("resource:///modules/activity/sendLater.js");
sendLaterModule.init();
Components.utils.import("resource:///modules/activity/moveCopy.js");
moveCopyModule.init();
Components.utils.import("resource:///modules/activity/glodaIndexer.js");
glodaIndexerActivity.init();
Components.utils.import("resource:///modules/activity/autosync.js");
autosyncModule.init();
Components.utils.import("resource:///modules/activity/alertHook.js");
alertHook.init();
Components.utils.import("resource:///modules/activity/pop3Download.js");
pop3DownloadModule.init();
