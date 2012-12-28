/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function () {
   var testFolderTreeMode = {
     __proto__: IFolderTreeMode,
     generateMap: function testFolderTreeMode_generateMap(aFTV) {
       // Pick the tinderbox@foo.invalid inbox and use it as the only folder
       let acctMgr =
         Components.classes["@mozilla.org/messenger/account-manager;1"]
           .getService(Components.interfaces.nsIMsgAccountManager);
       let server = acctMgr.FindServer("tinderbox", "tinderbox", "pop3");
       let item = new ftvItem(server.rootFolder.getChildNamed("Inbox"));
       item.__defineGetter__("children", function () []);
       return [item];
     },
   };
   gFolderTreeView.registerFolderTreeMode("testmode", testFolderTreeMode,
                                          "Test Mode");
})();
