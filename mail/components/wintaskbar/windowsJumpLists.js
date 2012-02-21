/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Mathies <jmathies@mozilla.com> (Original author)
 *   Marco Bonardo <mak77@bonardo.net>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

let EXPORTED_SYMBOLS = ["WinTaskbarJumpList"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/iteratorUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

// Prefs
const PREF_TASKBAR_BRANCH    = "mail.taskbar.lists.";
const PREF_TASKBAR_ENABLED   = "enabled";
const PREF_TASKBAR_TASKS     = "tasks.enabled";

XPCOMUtils.defineLazyGetter(this, "_stringBundle", function () {
  return Services.strings
                 .createBundle("chrome://messenger/locale/taskbar.properties");
});

XPCOMUtils.defineLazyServiceGetter(this, "_taskbarService",
                                   "@mozilla.org/windows-taskbar;1",
                                   "nsIWinTaskbar");

XPCOMUtils.defineLazyServiceGetter(this, "_winShellService",
                                   "@mozilla.org/mail/shell-service;1",
                                   "nsIWindowsShellService");

XPCOMUtils.defineLazyGetter(this, "_prefs", function() {
  return Services.prefs.getBranch(PREF_TASKBAR_BRANCH);
});

function _getString(aName) {
  return _stringBundle.GetStringFromName(aName);
}

/**
 * Task list
 */
let gTasks = [
  // Write new message
  {
    get title()       _getString("taskbar.tasks.composeMessage.label"),
    get description() _getString("taskbar.tasks.composeMessage.description"),
    args:             "-compose",
    iconIndex:        2, // Write message icon
  },

  // Open address book
  {
    get title()       _getString("taskbar.tasks.openAddressBook.label"),
    get description() _getString("taskbar.tasks.openAddressBook.description"),
    args:             "-addressbook",
    iconIndex:        3, // Open address book icon
  },
];


let WinTaskbarJumpList = {

  /**
   * Startup, shutdown, and update
   */

  startup: function WTBJL_startup() {
    // exit if this isn't win7 or higher.
    if (!this._initTaskbar())
      return;

    // Win shell shortcut maintenance. If we've gone through an update,
    // this will update any pinned taskbar shortcuts. Not specific to
    // jump lists, but this was a convienent place to call it. 
    try {
      // dev builds may not have helper.exe, ignore failures.
      this._shortcutMaintenance();
    }
    catch (ex) {
    }

    // Store our task list config data
    this._tasks = gTasks;

    // retrieve taskbar related prefs.
    this._refreshPrefs();

    // observer for our prefs branch
    this._initObs();

    this.update();
  },

  update: function WTBJL_update() {
    // are we disabled via prefs? don't do anything!
    if (!this._enabled)
      return;

    // do what we came here to do, update the taskbar jumplist
    this._buildList();
  },

  _shutdown: function WTBJL__shutdown() {
    this._shuttingDown = true;

    this._free();
  },

  _shortcutMaintenance: function WTBJL__maintenace() {
    _winShellService.shortcutMaintenance();
  },

  /**
   * List building
   */

  _buildList: function WTBJL__buildList() {
    // anything to build?
    if (!this._showTasks) {
      // don't leave the last list hanging on the taskbar.
      this._deleteActiveJumpList();
      return;
    }

    if (!this._startBuild())
      return;

    if (this._showTasks)
      this._buildTasks();

    this._commitBuild();
  },

  /**
   * Taskbar api wrappers
   */

  _startBuild: function WTBJL__startBuild() {
    // This is useful if there are any async tasks pending. Since we don't right
    // now, it's just harmless.
    this._builder.abortListBuild();
    // Since our list is static right now, we won't actually get back any
    // removed items.
    let removedItems = Cc["@mozilla.org/array;1"]
                         .createInstance(Ci.nsIMutableArray);
    return this._builder.initListBuild(removedItems);
  },

  _commitBuild: function WTBJL__commitBuild() {
    if (!this._builder.commitListBuild()) {
      this._builder.abortListBuild();
    }
  },

  _buildTasks: function WTBJL__buildTasks() {
    if (this._tasks.length > 0) {
      let items = toXPCOMArray([this._createHandlerAppItem(task)
                                for ([, task] in Iterator(this._tasks))],
                               Ci.nsIMutableArray);
      this._builder.addListToBuild(this._builder.JUMPLIST_CATEGORY_TASKS, items);
    }
  },

  _deleteActiveJumpList: function WTBJL__deleteAJL() {
    this._builder.deleteActiveList();
  },

  /**
   * Jump list item creation helpers
   */

  _createHandlerAppItem: function WTBJL__createHandlerAppItem(aTask) {
    let file = Services.dirsvc.get("XCurProcD", Ci.nsILocalFile);

    // XXX where can we grab this from in the build? Do we need to?
    file.append("thunderbird.exe");

    let handlerApp = Cc["@mozilla.org/uriloader/local-handler-app;1"]
                       .createInstance(Ci.nsILocalHandlerApp);
    handlerApp.executable = file;
    // handlers default to the leaf name if a name is not specified
    let title = aTask.title;
    if (title && title.length != 0)
      handlerApp.name = title;
    handlerApp.detailedDescription = aTask.description;
    handlerApp.appendParameter(aTask.args);

    let item = Cc["@mozilla.org/windows-jumplistshortcut;1"]
                 .createInstance(Ci.nsIJumpListShortcut);
    item.app = handlerApp;
    item.iconIndex = aTask.iconIndex;
    return item;
  },

  _createSeparatorItem: function WTBJL__createSeparatorItem() {
    return Cc["@mozilla.org/windows-jumplistseparator;1"]
             .createInstance(Ci.nsIJumpListSeparator);
  },

  /**
   * Prefs utilities
   */

  _refreshPrefs: function WTBJL__refreshPrefs() {
    this._enabled = _prefs.getBoolPref(PREF_TASKBAR_ENABLED);
    this._showTasks = _prefs.getBoolPref(PREF_TASKBAR_TASKS);
  },

  /**
   * Init and shutdown utilities
   */

  _initTaskbar: function WTBJL__initTaskbar() {
    this._builder = _taskbarService.createJumpListBuilder();
    if (!this._builder || !this._builder.available)
      return false;

    return true;
  },

  _initObs: function WTBJL__initObs() {
    Services.obs.addObserver(this, "profile-before-change", false);
    _prefs.addObserver("", this, false);
  },

  _freeObs: function WTBJL__freeObs() {
    Services.obs.removeObserver(this, "profile-before-change");
    _prefs.removeObserver("", this);
  },

  observe: function WTBJL_observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "nsPref:changed":
        if (this._enabled == true && !_prefs.getBoolPref(PREF_TASKBAR_ENABLED))
          this._deleteActiveJumpList();
        this._refreshPrefs();
        this.update();
      break;

      case "profile-before-change":
        this._shutdown();
      break;
    }
  },

  _free: function WTBJL__free() {
    this._freeObs();
    delete this._builder;
  },
};
