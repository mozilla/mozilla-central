/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var EventUtils = {};
Cu.import('resource://mozmill/stdlib/EventUtils.js', EventUtils);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
var frame = {};
Cu.import('resource://mozmill/modules/frame.js', frame);
var os = {};
Cu.import('resource://mozmill/stdlib/os.js', os);
var utils = {};
Cu.import('resource://mozmill/modules/utils.js', utils);

Cu.import("resource:///modules/gloda/log4moz.js");

const MODULE_NAME = 'folder-display-helpers';

const RELATIVE_ROOT = '../shared-modules';
// we need window-helpers for augment_controller
const MODULE_REQUIRES = ['window-helpers'];

const nsMsgViewIndex_None = 0xffffffff;
Cu.import('resource:///modules/MailConsts.js');
Cu.import("resource:///modules/mailServices.js");
Cu.import('resource:///modules/MailUtils.js');
Cu.import('resource:///modules/mailViewManager.js');
Cu.import("resource://gre/modules/Services.jsm");

const FILE_LOAD_PATHS = [
  "../resources",
  "../../../../mailnews/test/resources",
  "../../../../mail/base/test/unit/resources",
  "../../../../mailnews/test/fakeserver"
];

/**
 * List of keys not to export via installInto; values do not matter, we just
 *  use true.
 */
const DO_NOT_EXPORT = {
  // magic globals
  MODULE_NAME: true, DO_NOT_EXPORT: true, installInto: true,
  // imported modules
  elib: true, mozmill: true, controller: true, frame: true, os: true,
  // convenience constants
  Ci: true, Cc: true, Cu: true, Cr: true,
  // useful constants (we do export MailViewConstants)
  nsMsgViewIndex_None: true, MailConsts: true,
  // utility functions
  MailUtils: true, MailViewManager: true,
  // internal setup functions
  setupModule: true, setupAccountStuff: true,
  // we export this separately
  teardownImporter: true,
  // internal setup flags
  initialized: false,
  // other libraries we use
  testHelperModule: true,
  windowHelper: true,
};

const EXPORT_VIA_GETTER_SETTER = {
  // These should be getters and setters instead of direct property accesses so
  // that setting them reflects across scopes.
  mc: true,
};

var Application = Cc["@mozilla.org/steel/application;1"]
                    .getService(Ci.steelIApplication);

/** The controller for the main 3-pane window. */
var mc;
/** the index of the current 'other' tab */
var otherTab;

// These are pseudo-modules setup by setupModule:
var testHelperModule;
// (end pseudo-modules)

var msgGen;

var inboxFolder = null;

// logHelper exports
var mark_action;
var mark_failure;

// the windowHelper module
var windowHelper;

var initialized = false;
function setupModule() {
  if (initialized)
    return;
  initialized = true;

  testHelperModule = {
    Cc: Cc,
    Ci: Ci,
    Cu: Cu,
    // fake some xpcshell stuff
    _TEST_FILE: ["mozmill"],
    _do_not_wrap_xpcshell: true,
    do_throw: function(aMsg) {
      throw new Error(aMsg);
    },
    do_check_eq: function() {},
    do_check_neq: function() {},
    gDEPTH: "../../",
  };

  // -- logging

  // The xpcshell test resources assume they are loaded into a single global
  //  namespace, so we need to help them out to maintain their delusion.
  load_via_src_path('logHelper.js', testHelperModule);
  mark_action = testHelperModule.mark_action;
  mark_failure = testHelperModule.mark_failure;

  // Remove the dump appender that got appended; it just adds noise.
  testHelperModule._testLogger.removeAppender(
    testHelperModule._testLogger.ownAppenders[
      testHelperModule._testLogger.ownAppenders.length - 1]);

  // Add a bucketing appender to the root.
  let rootLogger = Log4Moz.repository.rootLogger;
  let bucketAppender = new Log4Moz.TimeAwareMemoryBucketAppender();
  bucketAppender.level = Log4Moz.Level.All;
  rootLogger.addAppender(bucketAppender);

  // Indicate to any fancy helpers (just folderEventLogHelper right now) that
  //  we want them to log extra stuff.
  testHelperModule._logHelperInterestedListeners = true;

  // - Hook-up logHelper to the mozmill event system...
  let curTestFile = null;
  // Listen for setTest so we can change buckets and generate logHelper test
  //  begin/end notifications.
  frame.events.addListener("setTest", function(obj) {
      // ignore setupModule and teardownModule
      if (obj.name == "setupModule" ||
          obj.name == "teardownModule")
        return;
      if (obj.filename != curTestFile) {
        testHelperModule.mark_test_end();
        bucketAppender.newBucket();
        testHelperModule.mark_test_start(obj.filename);
        curTestFile = obj.filename;
      }
      else {
        testHelperModule.mark_test_end(1);
        bucketAppender.newBucket();
      }
      testHelperModule.mark_sub_test_start(obj.name);
    });
  // Listen for the fail event so that we can annotate the failure object
  //  with additional metadata.  This works out because we are directly handed
  //  a reference to the object that will be provided to the jsbridge and we
  //  can mutate it.  (The jsbridge is a global listener and so is guaranteed
  //  to be invoked after our specific named listener.)
  frame.events.addListener("fail", function(obj) {
      // normalize nsIExceptions so they look like JS exceptions...
      rawex = obj.exception;
      if (obj.exception != null &&
          (obj.exception instanceof Ci.nsIException)) {
        obj.exception = {
          message: "nsIException: " + rawex.message + " (" + rawex.result + ")",
          fileName: rawex.filename,
          lineNumber: rawex.lineNumber,
          name: rawex.name,
          result: rawex.result,
          stack: "",
        };
      }

      // generate the failure notification now so it shows up in the event log
      //  bucket for presentation purposes.
      testHelperModule._xpcshellLogger.info(
        testHelperModule._testLoggerActiveContext,
        new testHelperModule._Failure(
          obj.exception ? obj.exception.message : "No Exception!",
          rawex));

      try {
        obj.failureContext = {
          preEvents: bucketAppender.getPreviousBucketEvents(10000),
          events: bucketAppender.getBucketEvents(),
          windows: windowHelper.captureWindowStatesForErrorReporting(
                     testHelperModule._normalize_for_json),
        };
      }
      catch(ex) {
        dump("!!!!!!!!EX: " + ex);
        mark_action("fdh", "fail fail marking!", [ex]);
      }
    });

  // -- the rest of the asyncTestUtils framework (but not actually async)

  load_via_src_path('asyncTestUtils.js', testHelperModule);
  load_via_src_path('messageGenerator.js', testHelperModule);
  load_via_src_path('messageModifier.js', testHelperModule);
  load_via_src_path('messageInjection.js', testHelperModule);
  load_via_src_path('viewWrapperTestUtils.js', testHelperModule);

  // provide super helpful folder event info (when logHelper cares)
  load_via_src_path('folderEventLogHelper.js', testHelperModule);
  testHelperModule.registerFolderEventLogHelper();

  // messageInjection wants a gMessageGenerator (and so do we)
  msgGen = new testHelperModule.MessageGenerator();
  testHelperModule.gMessageGenerator = msgGen;
  testHelperModule.gMessageScenarioFactory =
    new testHelperModule.MessageScenarioFactory(msgGen);

  make_new_sets_in_folders = make_new_sets_in_folder =
    testHelperModule.make_new_sets_in_folders;
  add_sets_to_folders = testHelperModule.add_sets_to_folders;
  make_folder_with_sets = testHelperModule.make_folder_with_sets;
  make_virtual_folder = testHelperModule.make_virtual_folder;
  SyntheticPartLeaf = testHelperModule.SyntheticPartLeaf;
  SyntheticPartMultiMixed = testHelperModule.SyntheticPartMultiMixed;
  SyntheticPartMultiRelated = testHelperModule.SyntheticPartMultiRelated;

  delete_message_set = testHelperModule.async_delete_messages;

  // use window-helper's augment_controller method to get our extra good stuff
  //  we need.
  windowHelper = collector.getModule('window-helpers');
  mc = windowHelper.wait_for_existing_window("mail:3pane");
  windowHelper.augment_controller(mc);

  // Tell window-helper about the true mark_action function in order to try
  // and further complicate this horrid seven-dimensional rats' nest.
  windowHelper.hereIsMarkAction(mark_action, mark_failure,
                                testHelperModule._normalize_for_json);

  mark_action("fdh", "startup completed",
              [(mc.window.msgWindow != null) ? "3pane looks initialized"
               : "3pane does not appear to have fully loaded yet!"]);

  setupAccountStuff();
  // This will throw if we've not got the main window set up yet e.g. the
  // account wizard is open on an initial startup type test.
  try {
    mc.folderTreeView.toggleOpenState(1);
  }
  catch (ex) {
  }
}

/**
 * Install this module into the provided module.
 */
function installInto(module) {
  setupModule();

  // force the window to be a nice size we all can love.
  // note that we can't resize a window larger than the display it lives on!
  // (I think the inner window is actually limited to the display size, so since
  // resizeTo operates on outerWidth/outerHeight, their limit is actually
  // screen size + window border size)
  if (mc.window.outerWidth != 1024 || mc.window.outerHeight != 768)
    mc.window.resizeTo(1024, 768);

  // now copy everything into the module they provided to us...
  let us = collector.getModule('folder-display-helpers');
  let self = this;
  for each (let [key, value] in Iterator(us)) {
    if (key in EXPORT_VIA_GETTER_SETTER) {
      // The value of |key| changes between iterations, so it's important to
      // capture the right key in a local variable.
      let thisKey = key;
      module.__defineGetter__(thisKey, function () self[thisKey]);
      module.__defineSetter__(thisKey, function (aNewValue) {
                               self[thisKey] = aNewValue;
                             });
    }
    else if (!(key in DO_NOT_EXPORT) &&
             key[0] != "_") {
      module[key] = value;
    }
  }

  // Export the teardown helper
  let customTeardown = null;
  // Mozmill uses __teardownModule__ to store what it thinks is the
  // teardownModule function. Unfortunately, all this is figured out when the
  // file is loaded, and we're evaluated much too late for that, so overwrite
  // it.
  if ("__teardownModule__" in module)
    customTeardown = module.__teardownModule__;
  module.__teardownModule__ = teardownImporter(customTeardown);
}

function setupAccountStuff() {
  inboxFolder = testHelperModule.configure_message_injection({mode: "local"});
}

/**
 * This returns a function that cleans up state in case any tests have failed,
 * so that the chain of failures isn't propagated to the rest of the suite. We
 * attempt to guarantee that after the teardown is executed:
 * - exactly one 3-pane window is open, and its controller is assigned to |mc|
 * - there are no other windows open
 * - the 3-pane window has exactly one tab open -- the main 3-pane tab
 * - the folder mode is set to All Folders
 *
 * @param [customTeardown] A custom teardown function, if it's already been
 *     defined in a particular module. This will always be executed before any
 *     cleanup we perform.
 */
function teardownImporter(customTeardown) {
  let teardownModule = function teardownModule() {
    if (customTeardown)
      customTeardown();

    // - If there are no 3-pane windows open, open one.
    let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
    if (!mail3PaneWindow) {
      windowHelper.plan_for_new_window("mail:3pane");
      Services.ww.openWindow(null,
          "chrome://messenger/content/", "",
          "all,chrome,dialog=no,status,toolbar", args);
      mc = windowHelper.wait_for_new_window("mail:3pane");
    }
    else {
      // - We might have a window open, but not be assigned to mc -- so if
      //   mc.window.closed is true, look for a window to assign to mc.
      if (!mc || mc.window.closed)
        mc = windowHelper.wait_for_existing_window("mail:3pane");
    }

    // Run through all open windows, closing any that aren't assigned to mc.
    let enumerator = Services.wm.getEnumerator(null);
    while (enumerator.hasMoreElements()) {
      let win = enumerator.getNext();
      if (win != mc.window) {
        mark_action("fdh", "teardown",
                    ["cleanup closing non-mc window", win.toString(),
                     "window type",
                     windowHelper.getWindowTypeForXulWindow(win)]);
        win.close();
      }
    }

    // At this point we should have exactly one window open.
    // - Close all tabs other than the first one.
    mc.tabmail.closeOtherTabs(mc.tabmail.tabInfo[0]);

    // - Set the mode to All Folders.
    if (mc.folderTreeView.mode != "all") {
      mark_action("fdh", "teardown",
                  ["resetting folderTreeView mode", mc.folderTreeView.mode]);
      mc.folderTreeView.mode = "all";
    }

    // - Make sure the message pane is visible.
    if (mc.window.IsMessagePaneCollapsed()) {
      mark_action("fdh", "teardown", ["toggling message pane on again"]);
      mc.window.MsgToggleMessagePane();
    }
  };
  // Another internal mozmill thing, again figured out too early for it to have
  // a chance.
  teardownModule.__name__ = "teardownModule";
  return teardownModule;
}

/*
 * Although we all agree that the use of generators when dealing with async
 *  operations is awesome, the mozmill idiom is for calls to be synchronous and
 *  just spin event loops when they need to wait for things to happen.  This
 *  does make the test code significantly less confusing, so we do it too.
 * All of our operations are synchronous and just spin until they are happy.
 */

/**
 * Create a folder and rebuild the folder tree view.
 * @param aFolderName  A folder name with no support for hierarchy at this time.
 * @param aSpecialFlags An optional list of nsMsgFolderFlags bits to set.
 */
function create_folder(aFolderName, aSpecialFlags) {
  let folder = testHelperModule.make_empty_folder(aFolderName, aSpecialFlags);
  mc.folderTreeView.mode = "all";
  return folder;
}

/**
 * Create a virtual folder by deferring to |make_virtual_folder| and making
 *  sure to rebuild the folder tree afterwards.
 */
function create_virtual_folder() {
  let folder = testHelperModule.make_virtual_folder.apply(null, arguments);
  mc.folderTreeView.mode = "all";
  return folder;
}


/**
 * Create a thread with the specified number of messages in it.
 */
function create_thread(aCount) {
  return new testHelperModule.SyntheticMessageSet(
    testHelperModule.gMessageScenarioFactory.directReply(aCount));
}

/**
 * Create and return a SyntheticMessage object.
 *
 * @param {Object} aArgs An arguments object to be passed to
 *                       MessageGenerator.makeMessage()
 */
function create_message(aArgs) {
  return msgGen.makeMessage(aArgs);
}

/**
 * Create and return a SyntheticMessage object.
 *
 * @param {Object} aArgs An arguments object to be passed to
 *                       MessageGenerator.makeEncryptedSMimeMessage()
 */
function create_encrypted_smime_message(aArgs) {
  return msgGen.makeEncryptedSMimeMessage(aArgs);
}

/**
 * Add a SyntheticMessage to a folder.
 *
 * @param {SyntheticMessage} aMsg
 * @param {Object} aFolder
 */
function add_message_to_folder(aFolder, aMsg) {
  // should presumably use async_run here, but since setupAccountStuff is
  // using a local store, it should be safe to assume synchronicity
  add_sets_to_folders([aFolder],
                      [new testHelperModule.SyntheticMessageSet([aMsg])]);
}

/**
 * Make sure we are entering the folder from not having been in the folder.  We
 *  will leave the folder and come back if we have to.
 */
function enter_folder(aFolder) {
  // Drain the event queue prior to doing any work.  It's possible that there's
  //  a pending setTimeout(0) that needs to get fired.
  controller.sleep(0);
  // if we're already selected, go back to the root...
  if (mc.folderDisplay.displayedFolder == aFolder)
    enter_folder(aFolder.rootFolder);

  mark_action("fdh", "enter_folder", [aFolder]);

  // this selection event may not be synchronous...
  mc.folderTreeView.selectFolder(aFolder);
  // ... so wait until it goes through by waiting on the displayedFolder...
  function isDisplayedFolder() {
    return mc.folderDisplay.displayedFolder == aFolder;
  }
  utils.waitFor(isDisplayedFolder,
                "Timeout trying to enter folder" + aFolder.URI);

  wait_for_all_messages_to_load();

  // and drain the event queue
  controller.sleep(0);
}

/**
 * Make sure we are in the given folder, entering it if we were not.
 *
 * @return The tab info of the current tab (a more persistent identifier for
 *     tabs than the index, which will change as tabs open/close).
 */
function be_in_folder(aFolder) {
  if (mc.folderDisplay.displayedFolder != aFolder)
    enter_folder(aFolder);
  return mc.tabmail.currentTabInfo;
}

/**
 * Create a new tab displaying a folder, making that tab the current tab. This
 * does not wait for message completion, because it doesn't know whether a
 * message display will be triggered. If you know that a message display will be
 * triggered, you should follow this up with
 * |wait_for_message_display_completion(mc, true)|. If you know that a blank
 * pane should be displayed, you should follow this up with
 * |wait_for_blank_content_pane()| instead.
 *
 * @return The tab info of the current tab (a more persistent identifier for
 *     tabs than the index, which will change as tabs open/close).
 */
function open_folder_in_new_tab(aFolder) {
  // save the current tab as the 'other' tab
  otherTab = mc.tabmail.currentTabInfo;
  mc.tabmail.openTab("folder", {folder: aFolder});
  mark_action("fdh", "open_folder_in_new_tab",
              ["folder", aFolder,
               "tab info", _jsonize_tabmail_tab(mc.tabmail.currentTabInfo)]);
  wait_for_all_messages_to_load();
  return mc.tabmail.currentTabInfo;
}

/**
 * Open a new mail:3pane window displaying a folder.
 *
 * @param aFolder the folder to be displayed in the new window
 * @return the augmented controller for the new window
 */
function open_folder_in_new_window(aFolder) {
  windowHelper.plan_for_new_window("mail:3pane");
  mc.window.MsgOpenNewWindowForFolder(aFolder.URI);
  let mail3pane = windowHelper.wait_for_new_window("mail:3pane");
  return mail3pane;
}

/**
 * Open the selected message(s) by pressing Enter. The mail.openMessageBehavior
 * pref is supposed to determine how the messages are opened.
 *
 * Since we don't know where this is going to trigger a message load, you're
 * going to have to wait for message display completion yourself.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function open_selected_messages(aController) {
  if (aController == null)
    aController = mc;
  // Focus the thread tree
  focus_thread_tree();
  mark_action("fdh", "open_selected_messages",
              mc.folderDisplay.selectedMessages);
  // Open whatever's selected
  press_enter(aController);
}

var open_selected_message = open_selected_messages;

/**
 * Create a new tab displaying the currently selected message, making that tab
 *  the current tab.  We block until the message finishes loading.
 *
 * @param aBackground [optional] If true, then the tab is opened in the
 *                    background. If false or not given, then the tab is opened
 *                    in the foreground.
 *
 * @return The tab info of the new tab (a more persistent identifier for tabs
 *     than the index, which will change as tabs open/close).
 */
function open_selected_message_in_new_tab(aBackground) {
  // get the current tab count so we can make sure the tab actually opened.
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  // save the current tab as the 'other' tab
  otherTab = mc.tabmail.currentTabInfo;

  // We won't trigger a new message load if we're in the background.
  if (!aBackground)
    plan_for_message_display(mc);
  mc.tabmail.openTab("message", {msgHdr: mc.folderDisplay.selectedMessage,
      viewWrapperToClone: mc.folderDisplay.view,
      background: aBackground});
  wait_for_message_display_completion(mc, !aBackground);

  // check that the tab count increased
  if (mc.tabmail.tabContainer.childNodes.length != preCount + 1)
    throw new Error("The tab never actually got opened!");

  // We append new tabs at the end, so return the last tab
  let newTab =
    mc.tabmail.tabInfo[mc.tabmail.tabContainer.childNodes.length - 1];
  mark_action("fdh", "open_selected_message_in_new_tab",
              ["message", mc.folderDisplay.selectedMessage,
               "background?", Boolean(aBackground),
               "new tab", _jsonize_tabmail_tab(newTab),
               "current tab", _jsonize_tabmail_tab(mc.tabmail.currentTabInfo)]);
  return newTab;
}

/**
 * Create a new window displaying the currently selected message.  We do not
 *  return until the message has finished loading.
 *
 * @return The MozmillController-wrapped new window.
 */
function open_selected_message_in_new_window() {
  mark_action("fdh", "open_selected_message_in_new_window",
              ["message", mc.folderDisplay.selectedMessage]);
  windowHelper.plan_for_new_window("mail:messageWindow");
  mc.window.MsgOpenNewWindowForMessage();
  let msgc = windowHelper.wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);
  return msgc;
}

/**
 * Display the given message in a folder tab. This doesn't make any assumptions
 * about whether a new tab is opened, since that is dependent on a user
 * preference. However, we do check that the tab we're returning is a folder
 * tab.
 *
 * @param aMsgHdr The message header to display.
 * @param [aExpectNew3Pane] This should be set to true if it is expected that a
 *                          new 3-pane window will be opened as a result of
 *                          the API call.
 *
 * @returns The currently selected tab, guaranteed to be a folder tab.
 */
function display_message_in_folder_tab(aMsgHdr, aExpectNew3Pane) {
  mark_action("fdh", "display_message_in_folder_tab",
              ["message", aMsgHdr,
               "new 3 pane expected?", Boolean(aExpectNew3Pane)]);
  if (aExpectNew3Pane)
    windowHelper.plan_for_new_window("mail:3pane");
  MailUtils.displayMessageInFolderTab(aMsgHdr);
  if (aExpectNew3Pane)
    mc = windowHelper.wait_for_new_window("mail:3pane");

  wait_for_message_display_completion(mc, true);

  // Make sure that the tab we're returning is a folder tab
  let currentTab = mc.tabmail.currentTabInfo;
  assert_tab_mode_name(currentTab, "folder");

  return currentTab;
}

/**
 * Create a new window displaying a message loaded from a file.  We do not
 * return until the message has finished loading.
 *
 * @param file an nsIFile for the message
 * @return The MozmillController-wrapped new window.
 */
function open_message_from_file(file) {
  mark_action("fdh", "open_message_from_file", ["file", file.nativePath]);

  let fileURL = Services.io.newFileURI(file)
                        .QueryInterface(Components.interfaces.nsIFileURL);
  fileURL.query = "type=application/x-message-display";

  windowHelper.plan_for_new_window("mail:messageWindow");
  mc.window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank",
                       "all,chrome,dialog=no,status,toolbar", fileURL);
  let msgc = windowHelper.wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);
  return msgc;
}

function _jsonize_tabmail_tab(tab) {
  return {
    type: "tabmail-tab",
    modeName: tab.mode.name,
    typeName: tab.mode.tabType.name,
    title: tab.title,
    busy: tab.busy,
    canClose: tab.canClose,
    _focusedElement: tab._focusedElement,
  };
}

/**
 * Switch to another folder or message tab.  If no tab is specified, we switch
 *  to the 'other' tab.  That is the last tab we used, most likely the tab that
 *  was current when we created this tab.
 *
 * @param aNewTab Optional, index of the other tab to switch to.
 */
function switch_tab(aNewTab) {
  if (typeof aNewTab == "number")
    aNewTab = mc.tabmail.tabInfo[aNewTab];

  // If the new tab is the same as the current tab, none of the below applies.
  // Get out now.
  if (aNewTab == mc.tabmail.currentTabInfo)
    return;

  // If we're still loading a message at this point, wait for that to finish
  wait_for_message_display_completion();
  let targetTab = (aNewTab != null) ? aNewTab : otherTab;
  // now the current tab will be the 'other' tab after we switch
  otherTab = mc.tabmail.currentTabInfo;
  mark_action("fdh", "switch_tab",
              ["old tab", _jsonize_tabmail_tab(otherTab),
               "new tab", _jsonize_tabmail_tab(targetTab)]);

  // If the target tab's folder display has a something selected and its message
  // pane is visible, plan for a message display.
  if (targetTab.messageDisplay.visible && targetTab.folderDisplay.selectedCount)
    plan_for_message_display(targetTab);

  mc.tabmail.switchToTab(targetTab);
  if (mc.messageDisplay.visible) {
    // if there is something selected, wait for display completion
    if (mc.folderDisplay.selectedCount)
      wait_for_message_display_completion(mc, true);
    // otherwise wait for the pane to end up blank
    else
      wait_for_blank_content_pane();
  }
}

/**
 * Assert that the currently selected tab is the given one.
 *
 * @param aTab The tab that should currently be selected.
 */
function assert_selected_tab(aTab) {
  if (mc.tabmail.currentTabInfo != aTab)
    mark_failure(["The currently selected tab should be", aTab,
        "(index: " + mc.tabmail.tabInfo.indexOf(aTab) + ") but is",
        _jsonize_tabmail_tab(mc.tabmail.currentTabInfo),
        "(index: " + mc.tabmail.tabInfo.indexOf(mc.tabmail.currentTabInfo) +
        ") tabs:", mc.tabmail.tabInfo,
        ]);
}

/**
 * Assert that the currently selected tab is _not_ the given one.
 *
 * @param aTab The tab that should currently not be selected.
 */
function assert_not_selected_tab(aTab) {
  if (mc.tabmail.currentTabInfo == aTab)
    mark_failure(["The currently selected tab should not be", aTab,
                  "but is. Tabs:", _jsonize_tabmail_tab(mc.tabmail.tabInfo)]);
}

/**
 * Assert that the given tab has the given mode name. Valid mode names include
 * "message" and "folder".
 *
 * @param aTab A Tab. The currently selected tab if null.
 * @param aModeName A string that should match the mode name of the tab.
 */
function assert_tab_mode_name(aTab, aModeName) {
  if (!aTab)
    aTab = mc.tabmail.currentTabInfo;

  if (aTab.mode.type != aModeName)
    mark_failure(["Tab", aTab, "should be of type", aModeName,
                  "but is actually of type", aTab.mode.type,
                  "Tabs:", mc.tabmail.tabInfo]);
}

/**
 * Assert that the number of tabs open matches the value given.
 *
 * @param aNumber The number of tabs that should be open.
 */
function assert_number_of_tabs_open(aNumber) {
  let actualNumber = mc.tabmail.tabContainer.childNodes.length;
  if (actualNumber != aNumber)
    mark_failure(["There should be " + aNumber + " tabs open, but there " +
                  "are actually " + actualNumber + " tabs open. Tabs:",
                   mc.tabmail.tabInfo]);
}

/**
 * Assert that the given tab's title is based on the provided folder or
 *  message.
 *
 * @param aTab A Tab.
 * @param aWhat Either an nsIMsgFolder or an nsIMsgDBHdr
 */
function assert_tab_titled_from(aTab, aWhat) {
  let text;
  if (aWhat instanceof Ci.nsIMsgFolder)
    text = aWhat.prettiestName;
  else if (aWhat instanceof Ci.nsIMsgDBHdr)
    text = aWhat.mime2DecodedSubject;

  if (!aTab.title.contains(text))
    mark_failure(["Tab title of tab", aTab,
                  "should include '" + text + "' but does not." +
                  " (Current title: '" + aTab.title + "')"]);
}

/**
 * Assert that the given tab's title is what is given.
 *
 * @param aTab The tab to check.
 * @param aTitle The title to check.
 */
function assert_tab_has_title(aTab, aTitle) {
  if (aTab.title != aTitle)
    mark_failure(["Tab title of tab", aTab,
                  "should be '" + aTitle + "' but is not." +
                  " (Current title: '" + aTab.title + "')"]);
}

/**
 * Close a tab.  If no tab is specified, it is assumed you want to close the
 *  current tab.
 */
function close_tab(aTabToClose) {
  mark_action("fdh", "close_tab", [aTabToClose]);

  if (typeof aTabToClose == "number")
    aTabToClose = mc.tabmail.tabInfo[aTabToClose];

  // get the current tab count so we can make sure the tab actually opened.
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  // If we're closing the current tab, a message or summary might be displayed
  // in the tab we'll select next.
  let nextTab = null;
  if (aTabToClose == mc.tabmail.currentTabInfo) {
    let selectedIndex = mc.tabmail.tabContainer.selectedIndex;
    let nextIndex = (selectedIndex == preCount - 1) ? selectedIndex - 1 :
      selectedIndex + 1;
    nextTab = mc.tabmail.tabInfo[nextIndex];
    if (nextTab.messageDisplay.visible && nextTab.folderDisplay.selectedCount)
      plan_for_message_display(nextTab);
  }

  mc.tabmail.closeTab(aTabToClose);

  // if there is a message visible in the tab, make sure we wait for the load
  if (nextTab && mc.messageDisplay.visible) {
    if (mc.folderDisplay.selectedCount)
      wait_for_message_display_completion(mc, true);
    // otherwise wait for the pane to end up blank
    else
      wait_for_blank_content_pane();
  }

  // check that the tab count decreased
  if (mc.tabmail.tabContainer.childNodes.length != preCount - 1)
    throw new Error("The tab never actually got closed!");
}

/**
 * Close a message window by calling window.close() on the controller.
 */
function close_message_window(aController) {
  mark_action("fdh", "close_message_window", []);
  windowHelper.close_window(aController);
}

/**
 * Clear the selection.  I'm not sure how we're pretending we did that, but
 *  we explicitly focus the thread tree as a side-effect.
 */
function select_none(aController) {
  mark_action("fdh", "select_none", []);
  if (aController == null)
    aController = mc;
  wait_for_message_display_completion();
  focus_thread_tree();
  aController.dbView.selection.clearSelection();
  // Because the selection event may not be generated immediately, we need to
  //  spin until the message display thinks it is not displaying a message,
  //  which is the sign that the event actually happened.
  function noMessageChecker() {
    return aController.messageDisplay.displayedMessage == null;
  }
  try {
    utils.waitFor(noMessageChecker);
  } catch (e if e instanceof utils.TimeoutError) {
    mark_failure(["Timeout waiting for displayedMessage to become null.",
                  "Current value: ",
                  aController.messageDisplay.displayedMessage]);
  }
  wait_for_blank_content_pane(aController);
}

/**
 * Normalize a view index to be an absolute index, handling slice-style negative
 *  references as well as piercing complex things like message headers and
 *  synthetic message sets.
 *
 * @param aViewIndex An absolute index (integer >= 0), slice-style index (< 0),
 *     or a SyntheticMessageSet (we only care about the first message in it).
 */
function _normalize_view_index(aViewIndex, aController) {
  if (aController == null)
    aController = mc;
  // SyntheticMessageSet special-case
  if (typeof(aViewIndex) != "number") {
    let msgHdrIter = aViewIndex.msgHdrs;
    let msgHdr = msgHdrIter.next();
    msgHdrIter.close();
    // do not expand
    aViewIndex = aController.dbView.findIndexOfMsgHdr(msgHdr, false);
  }

  if (aViewIndex < 0)
    return aController.dbView.QueryInterface(Ci.nsITreeView).rowCount +
      aViewIndex;
  return aViewIndex;
}

/**
 * Pretend we are clicking on a row with our mouse.
 *
 * @param aViewIndex If >= 0, the view index provided, if < 0, a reference to
 *     a view index counting from the last row in the tree.  -1 indicates the
 *     last message in the tree, -2 the second to last, etc.
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 *
 * @return The message header selected.
 */
function select_click_row(aViewIndex, aController) {
  if (aController == null)
    aController = mc;
  let hasMessageDisplay = "messageDisplay" in aController;
  if (hasMessageDisplay)
    wait_for_message_display_completion(aController);
  aViewIndex = _normalize_view_index(aViewIndex, aController);
  mark_action("fdh", "select_click_row", [aViewIndex]);

  var willDisplayMessage = hasMessageDisplay &&
    aController.messageDisplay.visible &&
    aController.dbView.selection.currentIndex !== aViewIndex;

  if (willDisplayMessage)
    plan_for_message_display(aController);
  _row_click_helper(aController, aController.threadTree, aViewIndex, 0);
  if (hasMessageDisplay)
    wait_for_message_display_completion(aController, willDisplayMessage);

  mark_action("fdh", "/select_click_row", [mc.folderDisplay.selectedMessages]);
  return aController.dbView.getMsgHdrAt(aViewIndex);
}

/**
 * Pretend we are toggling the thread specified by a row.
 *
 * @param aViewIndex If >= 0, the view index provided, if < 0, a reference to
 *     a view index counting from the last row in the tree.  -1 indicates the
 *     last message in the tree, -2 the second to last, etc.
 *
 */
function toggle_thread_row(aViewIndex) {
  wait_for_message_display_completion();
  aViewIndex = _normalize_view_index(aViewIndex);
  mark_action("fdh", "toggle_thread_row", [aViewIndex]);
  if (mc.messageDisplay.visible)
    plan_for_message_display(mc);
  _row_click_helper(mc, mc.threadTree, aViewIndex, 0, "toggle");
  wait_for_message_display_completion(mc, mc.messageDisplay.visible);
  mark_action("fdhb", "/toggle_thread_row", [aViewIndex]);
}


/**
 * Pretend we are clicking on a row with our mouse with the control key pressed,
 *  resulting in the addition/removal of just that row to/from the selection.
 *
 * @param aViewIndex If >= 0, the view index provided, if < 0, a reference to
 *     a view index counting from the last row in the tree.  -1 indicates the
 *     last message in the tree, -2 the second to last, etc.
 *
 * @return The message header of the affected message.
 */
function select_control_click_row(aViewIndex) {
  wait_for_message_display_completion();
  if (mc.messageDisplay.visible)
    plan_for_message_display(mc);
  aViewIndex = _normalize_view_index(aViewIndex);
  mark_action("fdh", "select_control_click_row",
              ["index", aViewIndex]);
  // note: control key on win/linux === meta on mac === accel on mozilla
  _row_click_helper(mc, mc.threadTree, aViewIndex, 0, "accel");
  // give the event queue a chance to drain...
  controller.sleep(0);
  wait_for_message_display_completion(mc, mc.messageDisplay.visible);
  mark_action("fdh", "/select_control_click_row",
              ["selected messages:", mc.folderDisplay.selectedMessages]);
  return mc.dbView.getMsgHdrAt(aViewIndex);
}

/**
 * Pretend we are clicking on a row with our mouse with the shift key pressed,
 *  adding all the messages between the shift pivot and the shift selected row.
 *
 * @param aViewIndex If >= 0, the view index provided, if < 0, a reference to
 *     a view index counting from the last row in the tree.  -1 indicates the
 *     last message in the tree, -2 the second to last, etc.
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 *
 * @return The message headers for all messages that are now selected.
 */
function select_shift_click_row(aViewIndex, aController, aDoNotRequireLoad) {
  if (aController == null)
    aController = mc;
  let hasMessageDisplay = "messageDisplay" in aController;
  if (hasMessageDisplay)
    wait_for_message_display_completion(aController);
  aViewIndex = _normalize_view_index(aViewIndex, aController);
  mark_action("fdh", "select_shift_click_row",
              ["index", aViewIndex]);

  if (hasMessageDisplay && !aDoNotRequireLoad &&
      aController.messageDisplay.visible)
    plan_for_message_display(aController);
  _row_click_helper(aController, aController.threadTree, aViewIndex, 0,
                    "shift");
  // give the event queue a chance to drain...
  controller.sleep(0);
  if (hasMessageDisplay && !aDoNotRequireLoad)
    wait_for_message_display_completion(aController,
                                        aController.messageDisplay.visible);
  mark_action("fdh", "/select_shift_click_row",
              ["selected messages:",
               aController.folderDisplay.selectedMessages]);
  return aController.folderDisplay.selectedMessages;
}

/**
 * Helper function to click on a row with a given button.
 */
function _row_click_helper(aController, aTree, aViewIndex, aButton, aExtra) {
  // Force-focus the tree
  aTree.focus();
  let treeBox = aTree.treeBoxObject;
  // very important, gotta be able to see the row
  treeBox.ensureRowIsVisible(aViewIndex);
  // coordinates of the upper left of the entire tree widget (headers included)
  let tx = aTree.boxObject.x, ty = aTree.boxObject.y;
  // coordinates of the row display region of the tree (below the headers)
  let children = aController.e(aTree.id, {tagName: "treechildren"});
  let x = children.boxObject.x, y = children.boxObject.y;
  // Click in the middle of the row by default
  let rowX = children.boxObject.width / 2;
  // For the thread tree, Position our click on the subject column (which cannot
  // be hidden), and far enough in that we are in no danger of clicking the
  // expand toggler unless that is explicitly requested.
  if (aTree.id == "threadTree") {
    let subjectCol = aController.e("subjectCol");
    rowX = subjectCol.boxObject.x - tx + 8;
    // click on the toggle if so requested
    if (aExtra !== "toggle")
      rowX += 32;
  }
  let rowY = treeBox.rowHeight * (aViewIndex - treeBox.getFirstVisibleRow()) +
    treeBox.rowHeight / 2;
  if (treeBox.getRowAt(x + rowX, y + rowY) != aViewIndex) {
    throw new Error("Thought we would find row " + aViewIndex + " at " +
                    rowX + "," + rowY + " but we found " +
                    treeBox.getRowAt(rowX, rowY));
  }
  // Generate a mouse-down for all click types; the transient selection
  // logic happens on mousedown which our tests assume is happening.  (If you
  // are using a keybinding to trigger the event, that will not happen, but
  // we don't test that.)
  EventUtils.synthesizeMouse(aTree, x + rowX - tx, y + rowY - ty,
                             {type: "mousedown", button: aButton,
                              shiftKey: aExtra === "shift",
                              accelKey: aExtra === "accel"},
                             aController.window);

  // For right-clicks, the platform code generates a "contextmenu" event
  // when it sees the mouse press/down event. We are not synthesizing a platform
  // level event (though it is in our power; we just historically have not),
  // so we need to be the people to create the context menu.
  if (aButton == 2)
    EventUtils.synthesizeMouse(aTree, x + rowX - tx, y + rowY - ty,
                               {type: "contextmenu", button: aButton},
                               aController.window);

  EventUtils.synthesizeMouse(aTree, x + rowX - tx, y + rowY - ty,
                             {type: "mouseup", button: aButton,
                              shiftKey: aExtra == "shift",
                              accelKey: aExtra === "accel"},
                             aController.window);
}

/**
 * Right-click on the tree-view in question.  With any luck, this will have
 *  the side-effect of opening up a pop-up which it is then on _your_ head
 *  to do something with or close.  However, we have helpful popup function
 *  helpers because I'm so nice.
 *
 * @return The message header that you clicked on.
 */
function right_click_on_row(aViewIndex) {
  let msgHdr = mc.dbView.getMsgHdrAt(aViewIndex);
  mark_action("fdh", "right_click_on_row",
              ["index", aViewIndex, "message header", msgHdr]);
  _row_click_helper(mc, mc.threadTree, aViewIndex, 2);
  mark_action("fdh", "/right_click_on_row", []);
  return msgHdr;
}

/**
 * Middle-click on the tree-view in question, presumably opening a new message
 *  tab.
 *
 * @return [The new tab, the message that you clicked on.]
 */
function middle_click_on_row(aViewIndex) {
  let msgHdr = mc.dbView.getMsgHdrAt(aViewIndex);
  mark_action("fdh", "middle_click_on_row",
              ["index", aViewIndex, "message header", msgHdr]);
  _row_click_helper(mc, mc.threadTree, aViewIndex, 1);
  // We append new tabs at the end, so return the last tab
  mark_action("fdh", "/middle_click_on_row", []);
  return [mc.tabmail.tabInfo[mc.tabmail.tabContainer.childNodes.length - 1],
          msgHdr];
}

/**
 * Assert that the given row index is currently visible in the thread pane view.
 */
function assert_row_visible(aViewIndex) {
  let treeBox = mc.threadTree.treeBoxObject;

  if (treeBox.getFirstVisibleRow() > aViewIndex ||
      treeBox.getLastVisibleRow() < aViewIndex)
    throw new Error("Row " + aViewIndex + " should currently be visible in " +
                    "the thread pane, but isn't.");
}

/**
 * Assert that the given folder mode is the current one.
 *
 * @param aMode The expected folder mode.
 * @param [aController] The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function assert_folder_mode(aMode, aController) {
  if (aController == null)
    aController = mc;
  let actualMode = aController.folderTreeView.mode;
  if (actualMode != aMode)
    throw new Error("The folder mode should be " + aMode +
                    ", but is actually " + actualMode);
}

/**
 * Assert that the given folder is the child of the given parent in the folder
 * tree view. aParent == null is equivalent to saying that the given folder
 * should be a top-level folder.
 */
function assert_folder_child_in_view(aChild, aParent) {
  let actualParent = mc.folderTreeView.getParentOfFolder(aChild);
  if (actualParent != aParent)
    throw new Error("Folder " + aChild.URI + " should be the child of " +
                    (aParent && aParent.URI) +
                    ", but is actually the child of " +
                    (actualParent && actualParent.URI));

}

/**
 * Assert that the given folder is in the current folder mode and is visible.
 *
 * @param aFolder The folder to assert as visible
 * @param [aController] The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 * @returns The index of the folder, if it is visible.
 */
function assert_folder_visible(aFolder, aController) {
  if (aController == null)
    aController = mc;
  let folderIndex = aController.folderTreeView.getIndexOfFolder(aFolder);
  if (folderIndex == null)
    throw new Error("Folder: " + aFolder.URI + " should be visible, but isn't");

  return folderIndex;
}

/**
 * Assert that the given folder is either not in the current folder mode at all,
 * or is not currently visible.
 */
function assert_folder_not_visible(aFolder) {
  let folderIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  if (folderIndex != null)
    throw new Error("Folder: " + aFolder.URI +
                    " should not be visible, but is");
}

/**
 * Collapse a folder if it has children. This will throw if the folder itself is
 * not visible in the folder view.
 */
function collapse_folder(aFolder) {
  let folderIndex = assert_folder_visible(aFolder);
  let folderFTVItem = mc.folderTreeView.getFTVItemForIndex(folderIndex);
  if (folderFTVItem.open)
    mc.folderTreeView.toggleOpenState(folderIndex);
}

/**
 * Expand a folder if it has children. This will throw if the folder itself is
 * not visible in the folder view.
 */
function expand_folder(aFolder) {
  let folderIndex = assert_folder_visible(aFolder);
  let folderFTVItem = mc.folderTreeView.getFTVItemForIndex(folderIndex);
  if (!folderFTVItem.open)
    mc.folderTreeView.toggleOpenState(folderIndex);
}

/**
 * Assert that a folder is currently visible and collapsed. This will throw if
 * either of the two is untrue.
 */
function assert_folder_collapsed(aFolder) {
  let folderIndex = assert_folder_visible(aFolder);
  let folderFTVItem = mc.folderTreeView.getFTVItemForIndex(folderIndex);
  if (folderFTVItem.open)
    throw new Error("Folder: " + aFolder.URI + " should be collapsed, but isn't");
}

/**
 * Assert that a folder is currently visible and expanded. This will throw if
 * either of the two is untrue.
 */
function assert_folder_expanded(aFolder) {
  let folderIndex = assert_folder_visible(aFolder);
  let folderFTVItem = mc.folderTreeView.getFTVItemForIndex(folderIndex);
  if (!folderFTVItem.open)
    throw new Error("Folder: " + aFolder.URI + " should be expanded, but isn't");
}

/**
 * Clear the selection in the folder tree view.
 */
function select_no_folders() {
  wait_for_message_display_completion();
  mc.folderTreeView.selection.clearSelection();
  mark_action("fdh", "select_no_folder", []);
  // give the event queue a chance to drain...
  controller.sleep(0);
}

/**
 * Pretend we are clicking on a folder with our mouse.
 *
 * @param aFolder The folder to click on. This needs to be present in the
 *     current folder tree view, of course.
 *
 * @returns the view index that you clicked on.
 */
function select_click_folder(aFolder) {
  wait_for_all_messages_to_load();

  // this should set the current index as well as setting the selection.
  let viewIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  mc.folderTreeView.selection.select(viewIndex);
  wait_for_all_messages_to_load();
  mark_action("fdh", "select_click_folder",
              ["clicked:", aFolder,
               "now selected:", mc.folderTreeView.getSelectedFolders()]);
  // drain the event queue
  controller.sleep(0);

  return viewIndex;
}

/**
 * Pretend we are clicking on a folder with our mouse with the shift key pressed.
 *
 * @param aFolder The folder to shift-click on. This needs to be present in the
 *     current folder tree view, of course.
 *
 * @return An array containing all the folders that are now selected.
 */
function select_shift_click_folder(aFolder) {
  wait_for_all_messages_to_load();

  let viewIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  // Passing -1 as the start range checks the shift-pivot, which should be -1,
  //  so it should fall over to the current index, which is what we want.  It
  //  will then set the shift-pivot to the previously-current-index and update
  //  the current index to be what we shift-clicked on.  All matches user
  //  interaction.
  mc.folderTreeView.selection.rangedSelect(-1, viewIndex, false);
  wait_for_all_messages_to_load();
  mark_action("fdh", "select_shift_click_folder",
              ["clicked:", aFolder,
               "now selected:", mc.folderTreeView.getSelectedFolders()]);
  // give the event queue a chance to drain...
  controller.sleep(0);

  return mc.folderTreeView.getSelectedFolders();
}

/**
 * Right click on the folder tree view. With any luck, this will have the
 * side-effect of opening up a pop-up which it is then on _your_ head to do
 * something with or close.  However, we have helpful popup function helpers
 * helpers because asuth's so nice.
 *
 * @note The argument is a folder here, unlike in the message case, so beware.
 *
 * @return The view index that you clicked on.
 */
function right_click_on_folder(aFolder) {
  // Figure out the view index
  let viewIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  mark_action("fdh", "right_click_on_folder", [aFolder]);
  _row_click_helper(mc, mc.folderTree, viewIndex, 2);
  return viewIndex;
}

/**
 * Middle-click on the folder tree view, presumably opening a new folder tab.
 *
 * @note The argument is a folder here, unlike in the message case, so beware.
 *
 * @return [The new tab, the view index that you clicked on.]
 */
function middle_click_on_folder(aFolder) {
  // Figure out the view index
  let viewIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  mark_action("fdh", "middle_click_on_folder", [aFolder]);
  _row_click_helper(mc, mc.folderTree, viewIndex, 1);
  // We append new tabs at the end, so return the last tab
  return [mc.tabmail.tabInfo[mc.tabmail.tabContainer.childNodes.length - 1],
          viewIndex];
}

/**
 * Get a reference to the smart folder with the given name.
 *
 * @param aFolderName The name of the smart folder (e.g. "Inbox").
 * @returns An nsIMsgFolder representing the smart folder with the given name.
 */
function get_smart_folder_named(aFolderName) {
  let smartServer = MailServices.accounts.FindServer("nobody", "smart mailboxes", "none");
  return smartServer.rootFolder.getChildNamed(aFolderName);
}

/**
 * Assuming the context popup is popped-up (via right_click_on_row), select
 *  the deletion option.  If the popup is not popped up, you are out of luck.
 */
function delete_via_popup() {
  plan_to_wait_for_folder_events("DeleteOrMoveMsgCompleted",
                                 "DeleteOrMoveMsgFailed");
  mark_action("fdh", "delete_via_popup",
              ["selected messages:", mc.folderDisplay.selectedMessages]);
  mc.click(mc.eid("mailContext-delete"));
  // for reasons unknown, the pop-up does not close itself?
  close_popup(mc, mc.eid("mailContext"));
  wait_for_folder_events();
}

function wait_for_popup_to_open(popupElem) {
  mark_action("fdh", "wait_for_popup_to_open", [popupElem]);
  utils.waitFor(function () popupElem.state == "open",
                "Timeout waiting for popup to open", 1000, 50);
}

/**
 * Close the open pop-up.
 */
function close_popup(aController, eid) {
  if (aController == null)
    aController = mc;
  let elem = eid.getNode();
  // if it was already closing, just leave
  if (elem.state == "closed") {
    mark_action("fdh", "close_popup", ["popup suspiciously already closed!",
                                       elem]);
    return;
  }
  mark_action("fdh", "close_popup", [elem]);
  // if it's in the process of closing, don't push escape
  if (elem.state == "hiding")
    mark_action("fdh", "close_popup",
                ["popup suspiciously already closing..."]);
  else // actually push escape because it's not closing/closed
    aController.keypress(eid, "VK_ESCAPE", {});
  utils.waitFor(function () elem.state == "closed", "Popup did not close!",
                1000, 50);
}

/**
 * Pretend we are pressing the delete key, triggering message deletion of the
 *  selected messages.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 * @param aModifiers (optional) Modifiers to pass to the keypress method.
 */
function press_delete(aController, aModifiers) {
  if (aController == null)
    aController = mc;
  // if something is loading, make sure it finishes loading...
  wait_for_message_display_completion(aController);
  plan_to_wait_for_folder_events("DeleteOrMoveMsgCompleted",
                                 "DeleteOrMoveMsgFailed");
  mark_action("fdh", "press_delete",
              ["selected messages:",
               aController.folderDisplay.selectedMessages].concat(
                 aController.describeFocus()));
  aController.keypress(aController == mc ? mc.eThreadTree : null,
                       "VK_DELETE", aModifiers || {});
  wait_for_folder_events();
}

/**
 * Archive the selected messages, and wait for it to complete.  Archiving
 *  plans and waits for message display if the display is visible because
 *  successful archiving will by definition change the currently displayed
 *  set of messages (unless you are looking at a virtual folder that includes
 *  the archive folder.)
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function archive_selected_messages(aController) {
  if (aController == null)
    aController = mc;
  // How many messages do we expect to remain after the archival?
  let expectedCount = aController.dbView.rowCount -
                      aController.dbView.numSelected;

  mark_action("fdh", "archive_selected_messages",
              ["selected messages:",
               aController.folderDisplay.selectedMessages].concat(
                 aController.describeFocus()));
  if (expectedCount && aController.messageDisplay.visible)
    plan_for_message_display(aController);
  aController.keypress(null, "a", {});

  // Wait for the view rowCount to decrease by the number of selected messages.
  let messagesDeletedFromView = function() {
    return aController.dbView.rowCount == expectedCount;
  };
  utils.waitFor(messagesDeletedFromView,
                "Timeout waiting for messages to be archived");
  wait_for_message_display_completion(
    aController, expectedCount && aController.messageDisplay.visible);
  // The above may return immediately, meaning the event queue might not get a
  //  chance.  give it a chance now.
  aController.sleep(0);
}

/**
 * Pretend we are pressing the Enter key, triggering opening selected messages.
 * Note that since we don't know where this is going to trigger a message load,
 * you're going to have to wait for message display completion yourself.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function press_enter(aController) {
  if (aController == null)
    aController = mc;
  // if something is loading, make sure it finishes loading...
  if ("messageDisplay" in aController)
    wait_for_message_display_completion(aController);
  mark_action("fdh", "press_enter",
              ["selected messages:",
               aController.folderDisplay.selectedMessages].concat(
                 aController.describeFocus()));
  aController.keypress(aController == mc ? mc.eThreadTree : null,
                       "VK_RETURN", {});
  // The caller's going to have to wait for message display completion
}

/**
 * Wait for the |folderDisplay| on aController (defaults to mc if omitted) to
 *  finish loading.  This generally only matters for folders that have an active
 *  search.
 * This method is generally called automatically most of the time, and you
 *  should not need to call it yourself unless you are operating outside the
 *  helper methods in this file.
 */
function wait_for_all_messages_to_load(aController) {
  if (aController == null)
    aController = mc;
  utils.waitFor(function () aController.folderDisplay.allMessagesLoaded,
                "Messages never finished loading.  Timed Out.");
  // the above may return immediately, meaning the event queue might not get a
  //  chance.  give it a chance now.
  aController.sleep(0);
}

/**
 * Call this before triggering a message display that you are going to wait for
 *  using |wait_for_message_display_completion| where you are passing true for
 *  the aLoadDemanded argument.  This ensures that if a message is already
 *  displayed for the given controller that state is sufficiently cleaned up
 *  so it doesn't trick us into thinking that there is no need to wait.
 *
 * @param [aControllerOrTab] optional controller or tab, defaulting to |mc|. If
 *     the message display is going to be caused by a tab switch, a reference to
 *     the tab to switch to should be passed in.
 */
function plan_for_message_display(aControllerOrTab) {
  if (aControllerOrTab == null)
    aControllerOrTab = mc;
  mark_action("fdhb", "plan_for_message_display", []);
  // We're relying on duck typing here -- both controllers and tabs expose their
  // message displays as the property |messageDisplay|.
  aControllerOrTab.messageDisplay.messageLoaded = false;
}

/**
 * If a message or summary is in the process of loading, let it finish;
 *  optionally, be sure to wait for a load to happen (assuming
 *  |plan_for_message_display| is used, modulo the conditions below.)
 *
 * This method is used defensively by a lot of other code in this file that is
 *  realy not sure whether there might be a load in progress or not.  So by
 *  default we only do something if there is obviously a message display in
 *  progress.  Since some events may end up getting deferred due to script
 *  blockers or the like, it is possible the event that triggers the display
 *  may not have happened by the time you call this.  In that case, you should
 *
 *  1) pass true for aLoadDemanded, and
 *  2) invoke |plan_for_message_display|
 *
 *  before triggering the event that will induce a message display.  Note that:
 *  - You cannot do #2 if you are opening a new message window and can assume
 *    that this will be the first message ever displayed in the window. This is
 *    fine, because messageLoaded is initially false.
 *  - You should not do #2 if you are opening a new folder or message tab. That
 *    is because you'll affect the old tab's message display instead of the new
 *    tab's display. Again, this is fine, because a new message display will be
 *    created for the new tab, and messageLoaded will initially be false for it.
 *
 * If we didn't use this method defensively, we would get horrible assertions
 *  like so:
 * ###!!! ASSERTION: Overwriting an existing document channel!
 *
 *
 * @param [aController] optional controller, defaulting to |mc|.
 * @param [aLoadDemanded=false] Should we require that we wait for a message to
 *     be loaded?  You should use this in conjunction with
 *     |plan_for_message_display| as per the documentation above.  If you do
 *     not pass true and there is no message load in process, this method will
 *     return immediately.
 */
function wait_for_message_display_completion(aController, aLoadDemanded) {
  if (aController == null)
    aController = mc;
  mark_action("fdhb", "wait_for_message_display_completion",
              ["load demanded?", Boolean(aLoadDemanded)]);
  let contentPane = aController.contentPane;
  let oldHref = null;

  // count checks so we can know whether we waited; >1 implies waited
  let checkCount = 0;

  // There are a couple possible states the universe can be in:
  // 1) No message load happened or is going to happen.
  // 2) The only message load that is going to happened has happened.
  // 3) A message load is happening right now.
  // 4) A message load should happen in the near future.
  //
  // We have nothing that needs to be done in cases 1 and 2.  Case 3 is pretty
  //  easy for us.  The question is differentiating between case 4 and (1, 2).
  //  We rely on MessageDisplayWidget.messageLoaded to differentiate this case
  //  for us.
  let isLoadedChecker = function() {
    checkCount++;
    // If a load is demanded, first require that MessageDisplayWidget think
    //  that the message is loaded.  Because the notification that sets the flag
    //  happens when the message reader code gets told about the last attachment,
    //  this will actually happen before the URL is finished running.  Luckily
    //  we have the code below to try and deal with that.
    if (aLoadDemanded && !aController.messageDisplay.messageLoaded)
      return false;

    let docShell = contentPane.docShell;
    if (!docShell)
      return false;
    let uri = docShell.currentURI;
    // the URL will tell us if it is running, saves us from potential error
    if (uri && (uri instanceof Components.interfaces.nsIMsgMailNewsUrl)) {
      let urlRunningObj = {};
      uri.GetUrlState(urlRunningObj);
      // GetUrlState returns true if the url is still running
      return !urlRunningObj.value;
    }
    // not a mailnews URL, just check the busy flags...
    return !docShell.busyFlags;
  };
  utils.waitFor(isLoadedChecker,
                "Timed out waiting for message display completion.");
  // the above may return immediately, meaning the event queue might not get a
  //  chance.  give it a chance now.
  aController.sleep(0);
  mark_action("fdhb", "/wait_for_message_display_completion",
              ["waited?", checkCount > 1]);
}

/**
 * Wait for the content pane to be blank because no message is to be displayed.
 * You would not want to call this once folder summaries land and if they are
 *  enabled.
 *
 * @param aController optional controller, defaulting to |mc|.
 */
function wait_for_blank_content_pane(aController) {
  if (aController == null)
    aController = mc;
  mark_action("fdh", "wait_for_blank_content_pane", []);

  let isBlankChecker = function() {
    return aController.window.content.location.href == "about:blank";
  };
  try {
    utils.waitFor(isBlankChecker);
  } catch (e if e instanceof utils.TimeoutError) {
    mark_failure(["Timeout waiting for blank content pane.  Current location:",
                  aController.window.content.location.href]);
  }

  // the above may return immediately, meaning the event queue might not get a
  //  chance.  give it a chance now.
  aController.sleep(0);
  mark_action("fdh", "/wait_for_blank_content_pane", []);
}


var FolderListener = {
  _inited: false,
  ensureInited: function() {
    if (this._inited)
      return;

    MailServices.mailSession.AddFolderListener(this,
                                               Ci.nsIFolderListener.event);

    this._inited = true;
  },

  sawEvents: false,
  watchingFor: null,
  planToWaitFor: function FolderListener_planToWaitFor() {
    this.sawEvents = false;
    this.watchingFor = [];
    for (let i = 0; i < arguments.length; i++)
      this.watchingFor[i] = arguments[i];
  },
  waitForEvents: function FolderListener_waitForEvents() {
    if (this.sawEvents)
      return;
    let self = this;
    try {
      utils.waitFor(function () self.sawEvents);
    } catch (e if e instanceof utils.TimeoutError) {
      mark_failure(["Timeout waiting for events:", this.watchingFor]);
    }
  },

  OnItemEvent: function FolderNotificationHelper_OnItemEvent(
      aFolder, aEvent) {
    if (!this.watchingFor)
      return;
    if (this.watchingFor.indexOf(aEvent.toString()) != -1) {
      this.watchingFor = null;
      this.sawEvents = true;
    }
  },
};

/**
 * Plan to wait for an nsIFolderListener.OnItemEvent matching one of the
 *  provided strings.  Call this before you do the thing that triggers the
 *  event, then call |wait_for_folder_events| after the event.  This ensures
 *  that we see the event, because it might be too late after you initiate
 *  the thing that would generate the event.
 * For example, plan_to_wait_for_folder_events("DeleteOrMoveMsgCompleted",
 *  "DeleteOrMoveMsgFailed") waits for a deletion completion notification
 *  when you call |wait_for_folder_events|.
 * The waiting is currently un-scoped, so the event happening on any folder
 *  triggers us.  It is expected that you won't try and have multiple events
 *  in-flight or will augment us when the time comes to have to deal with that.
 */
function plan_to_wait_for_folder_events() {
  FolderListener.ensureInited();
  FolderListener.planToWaitFor.apply(FolderListener, arguments);
}
function wait_for_folder_events() {
  FolderListener.waitForEvents();
}

/**
 * Assert that the given synthetic message sets are present in the folder
 *  display.
 *
 * @param aSynSets Either a single SyntheticMessageSet or a list of them.
 * @param aController Optional controller, which we get the folderDisplay
 *     property from.  If omitted, we use mc.
 */
function assert_messages_in_view(aSynSets, aController) {
  if (aController == null)
    aController = mc;
  testHelperModule.verify_messages_in_view(aSynSets,
                                           aController.folderDisplay.view);
}

/**
 * Assert the the given message/messages are not present in the view.
 * @param aMessages Either a single nsIMsgDBHdr or a list of them.
 */
function assert_messages_not_in_view(aMessages, aController) {
  if (aController == null)
    aController = mc;
  if (aMessages instanceof Ci.nsIMsgDBHdr)
    aMessages = [aMessages];
  for each (let [, msgHdr] in Iterator(aMessages)) {
    if (mc.dbView.findIndexOfMsgHdr(msgHdr, true) != nsMsgViewIndex_None)
      mark_failure(["Message header is present in view but should not be:",
                    msgHdr, "index:",
                    mc.dbView.findIndexOfMsgHdr(msgHdr, true)]);
  }
}
var assert_message_not_in_view = assert_messages_not_in_view;

/**
 * When displaying a folder, assert that the message pane is visible and all the
 *  menus, splitters, etc. are set up right.
 */
function assert_message_pane_visible(aThreadPaneIllegal) {
  if (!mc.messageDisplay.visible)
    throw new Error("The message display does not think it is visible, but " +
                    "it should!");

  // - message pane should be visible
  if (mc.e("messagepaneboxwrapper").getAttribute("collapsed"))
    throw new Error("messagepaneboxwrapper should not be collapsed!");

  // if the thread pane is illegal, then the splitter should not be visible
  if (aThreadPaneIllegal) {
    if (mc.e("threadpane-splitter").getAttribute("collapsed") != "true")
      throw new Error("threadpane-splitter should be collapsed because the " +
                      "thread pane is illegal");
  }
  else {
    if (mc.e("threadpane-splitter").getAttribute("collapsed") == "true")
      throw new Error("threadpane-splitter should not be collapsed");
  }

  // - the menu item should be checked
  // force the view menu to update.
  mc.window.view_init();
  let paneMenuItem = mc.e("menu_showMessage");
  if (paneMenuItem.getAttribute("checked") != "true")
    throw new Error("The Message Pane menu item should be checked.");
}

/**
 * When displaying a folder, assert that the message pane is hidden and all the
 *  menus, splitters, etc. are set up right.
 *
 * @param aMessagePaneIllegal Is the pane illegal to display at this time?  This
 *     impacts whether the splitter should be visible, menu items should be
 *     visible, etc.
 */
function assert_message_pane_hidden(aMessagePaneIllegal) {
  // check messageDisplay.visible if we are not showing account central
  if (!mc.folderDisplay.isAccountCentralDisplayed && mc.messageDisplay.visible)
    throw new Error("The message display thinks it is visible, but it should " +
                    "not!");

  if (mc.e("messagepaneboxwrapper").getAttribute("collapsed") != "true")
    throw new Error("messagepaneboxwrapper should be collapsed!");

  // force the view menu to update.
  mc.window.view_init();
  let paneMenuItem = mc.e("menu_showMessage");
  if (aMessagePaneIllegal) {
    if (mc.e("threadpane-splitter").getAttribute("collapsed") != "true")
      throw new Error("threadpane-splitter should be collapsed because the " +
                      "message pane is illegal.");
    if (paneMenuItem.getAttribute("disabled") != "true")
      throw new Error("The Message Pane menu item should be disabled.");
  }
  else {
    if (mc.e("threadpane-splitter").getAttribute("collapsed"))
      throw new Error("threadpane-splitter should not be collapsed; the " +
                      "message pane is legal.");
    if (paneMenuItem.getAttribute("checked") == "true")
      throw new Error("The Message Pane menu item should not be checked.");
  }
}

/**
 * Toggle the visibility of the message pane.
 */
function toggle_message_pane() {
  let expectMessageDisplay = !mc.messageDisplay.visible &&
    mc.folderDisplay.selectedCount;
  if (expectMessageDisplay)
    plan_for_message_display(mc);
  mc.keypress(null, "VK_F8", {});
  if (expectMessageDisplay)
    wait_for_message_display_completion(mc, true);
}

/**
 * Helper function for use by assert_selected / assert_selected_and_displayed /
 *  assert_displayed.
 *
 * @return A list of two elements: [MozmillController, [list of view indices]].
 */
function _process_row_message_arguments() {
  let troller = mc;
  // - normalize into desired selected view indices
  let desiredIndices = [];
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    let arg = arguments[iArg];
    // An integer identifying a view index
    if (typeof(arg) == "number") {
      desiredIndices.push(_normalize_view_index(arg));
    }
    // A message header
    else if (arg instanceof Ci.nsIMsgDBHdr) {
      // do not expand; the thing should already be selected, eg expanded!
      let viewIndex = troller.dbView.findIndexOfMsgHdr(arg, false);
      if (viewIndex == nsMsgViewIndex_None)
        throw_and_dump_view_state(
          "Message not present in view that should be there. " +
            "(" + arg.messageKey + ": " + arg.mime2DecodedSubject + ")");
      desiredIndices.push(viewIndex);
    }
    // A list containing two integers, indicating a range of view indices.
    else if (arg.length == 2 && typeof(arg[0]) == "number") {
      let lowIndex = _normalize_view_index(arg[0]);
      let highIndex = _normalize_view_index(arg[1]);
      for (let viewIndex = lowIndex; viewIndex <= highIndex; viewIndex++)
        desiredIndices.push(viewIndex);
    }
    // a List of message headers
    else if (arg.length !== undefined) {
      for (let iMsg = 0; iMsg < arg.length; iMsg++) {
        let msgHdr = arg[iMsg].QueryInterface(Ci.nsIMsgDBHdr);
        if (!msgHdr)
          throw new Error(arg[iMsg] + " is not a message header!");
        // false means do not expand, it should already be selected
        let viewIndex = troller.dbView.findIndexOfMsgHdr(msgHdr, false);
        if (viewIndex == nsMsgViewIndex_None)
          throw_and_dump_view_state(
            "Message not present in view that should be there. " +
             "(" + msgHdr.messageKey + ": " + msgHdr.mime2DecodedSubject + ")");
        desiredIndices.push(viewIndex);
      }
    }
    // SyntheticMessageSet
    else if (arg.synMessages) {
      for each (let msgHdr in arg.msgHdrs) {
        let viewIndex = troller.dbView.findIndexOfMsgHdr(msgHdr, false);
        if (viewIndex == nsMsgViewIndex_None)
          throw_and_dump_view_state(
            "Message not present in view that should be there. " +
             "(" + msgHdr.messageKey + ": " + msgHdr.mime2DecodedSubject + ")");
        desiredIndices.push(viewIndex);
      }
    }
    // it's a MozmillController
    else if (arg.window) {
      troller = arg;
    }
    else {
      throw new Error("Illegal argument: " + arg);
    }
  }
  // sort by integer value
  desiredIndices.sort(function (a, b) { return a - b;} );

  return [troller, desiredIndices];
}

/**
 * Asserts that the given set of messages are selected.  Unless you are dealing
 *  with transient selections resulting from right-clicks, you want to be using
 *  assert_selected_and_displayed because it makes sure that the display is
 *  correct too.
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - A message header.
 * - A list of message headers.
 * - A synthetic message set.
 */
function assert_selected() {
  let [troller, desiredIndices] =
    _process_row_message_arguments.apply(this, arguments);

  // - get the actual selection (already sorted by integer value)
  let selectedIndices = troller.folderDisplay.selectedIndices;
  // - test selection equivalence
  // which is the same as string equivalence in this case. muah hah hah.
  if (desiredIndices.toString() != selectedIndices.toString())
    mark_failure(["Desired selection is:", desiredIndices,
                  "but actual selection is: ", selectedIndices]);

  return [troller, desiredIndices];
}

/**
 * Assert that the given set of messages is displayed, but not necessarily
 *  selected.  Unless you are dealing with transient selection issues or some
 *  other situation where the FolderDisplay should not be correlated with the
 *  MessageDisplay, you really should be using assert_selected_and_displayed.
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - A message header.
 * - A list of message headers.
 */
function assert_displayed() {
  let [troller, desiredIndices] =
    _process_row_message_arguments.apply(this, arguments);
  _internal_assert_displayed(false, troller, desiredIndices);
}

/**
 * Assert-that-the-display-is-right logic.  We need an internal version so that
 *  we can know whether we can trust/assert that folderDisplay.selectedMessage
 *  agrees with messageDisplay, and also so that we don't have to re-compute
 *  troller and desiredIndices.
 */
function _internal_assert_displayed(trustSelection, troller, desiredIndices) {
  // - verify that the right thing is being displayed.
  // no selection means folder summary.
  if (desiredIndices.length == 0) {
    // folder summary is not landed yet, just verify there is no message.
    if (troller.messageDisplay.displayedMessage != null)
      throw new Error("Message display should not think it is displaying a " +
                      "message.");
    // make sure the content pane is pointed at about:blank
    if (troller.window.content.location.href != "about:blank") {
      throw new Error("the content pane should be blank, but is showing: '" +
                      troller.window.content.location.href + "'");
    }
  }
  // 1 means the message should be displayed
  else if (desiredIndices.length == 1) {
    // make sure message display thinks we are in single message display mode
    if (!troller.messageDisplay.singleMessageDisplay)
      throw new Error("Message display is not in single message display mode.");
    // now make sure that we actually are in single message display mode
    let singleMessagePane = troller.e("singlemessage");
    let multiMessagePane = troller.e("multimessage");
    if (singleMessagePane && singleMessagePane.hidden)
      throw new Error("Single message pane is hidden but it should not be.");
    if (multiMessagePane && !multiMessagePane.hidden)
      throw new Error("Multiple message pane is visible but it should not be.");

    if (trustSelection) {
      if (troller.folderDisplay.selectedMessage !=
          troller.messageDisplay.displayedMessage)
        throw new Error("folderDisplay.selectedMessage != " +
                        "messageDisplay.displayedMessage! (fd: " +
                        troller.folderDisplay.selectedMessage + " vs md: " +
                        troller.messageDisplay.displayedMessage + ")");
    }

    let msgHdr = troller.messageDisplay.displayedMessage;
    let msgUri = msgHdr.folder.getUriForMsg(msgHdr);
    // wait for the document to load so that we don't try and replace it later
    //  and get that stupid assertion
    wait_for_message_display_completion();
    // make sure the content pane is pointed at the right thing

    let msgService =
      troller.folderDisplay.messenger.messageServiceFromURI(msgUri);
    let msgUrlObj = {};
    msgService.GetUrlForUri(msgUri, msgUrlObj, troller.folderDisplay.msgWindow);
    let msgUrl = msgUrlObj.value;
    if (troller.window.content.location.href != msgUrl.spec)
      throw new Error("The content pane is not displaying the right message! " +
                      "Should be: " + msgUrl.spec + " but it's: " +
                      troller.window.content.location.href);
  }
  // multiple means some form of multi-message summary
  else {
    // XXX deal with the summarization threshold bail case.

    // make sure the message display thinks we are in multi-message mode
    if (troller.messageDisplay.singleMessageDisplay)
      throw new Error("Message display should not be in single message display"+
                      "mode!  Desired indices: " + desiredIndices);

    // verify that the message pane browser is displaying about:blank
    if (mc.window.content.location.href != "about:blank")
      throw new Error("the content pane should be blank, but is showing: '" +
                      mc.window.content.location.href + "'");

    // now make sure that we actually are in nultiple message display mode
    let singleMessagePane = troller.e("singlemessage");
    let multiMessagePane = troller.e("multimessage");
    if (singleMessagePane && !singleMessagePane.hidden)
      throw new Error("Single message pane is visible but it should not be.");
    if (multiMessagePane && multiMessagePane.hidden)
      throw new Error("Multiple message pane is hidden but it should not be.");

    // and _now_ make sure that we actually summarized what we wanted to
    //  summarize.
    let desiredMessages = [mc.dbView.getMsgHdrAt(vi) for each
                            ([, vi] in Iterator(desiredIndices))];
    assert_messages_summarized(troller, desiredMessages);
  }
}

/**
 * Assert that the messages corresponding to the one or more message spec
 *  arguments are selected and displayed.  If you specify multiple messages,
 *  we verify that the multi-message selection mode is in effect and that they
 *  are doing the desired thing.  (Verifying the summarization may seem
 *  overkill, but it helps make the tests simpler and allows you to be more
 *  confident if you're just running one test that everything in the test is
 *  performing in a sane fashion.  Refactoring could be in order, of course.)
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - A message header.
 * - A list of message headers.
 */
function assert_selected_and_displayed() {
  // make sure the selection is right first.
  let [troller, desiredIndices] = assert_selected.apply(this, arguments);
  // now make sure the display is right
  _internal_assert_displayed(true, troller, desiredIndices);
}

/**
 * Use the internal archiving code for archiving any given set of messages
 *
 * @param aMsgHdrs a list of message headers
 * */
function archive_messages(aMsgHdrs) {
  plan_to_wait_for_folder_events("DeleteOrMoveMsgCompleted",
                                 "DeleteOrMoveMsgFailed");
  let batchMover = new mc.window.BatchMessageMover();
  batchMover.archiveMessages(aMsgHdrs);
  wait_for_folder_events();
}

/**
 * @return true if |aSetOne| is equivalent to |aSetTwo| where the sets are
 *     really just lists of nsIMsgDBHdrs with cool names.
 */
function _verify_message_sets_equivalent(aSetOne, aSetTwo) {
  let uniqy1 = [msgHdr.folder.URI + msgHdr.messageKey for each
                 ([, msgHdr] in Iterator(aSetOne))];
  uniqy1.sort();
  let uniqy2 = [msgHdr.folder.URI + msgHdr.messageKey for each
                 ([, msgHdr] in Iterator(aSetTwo))];
  uniqy2.sort();
  // stringified versions should now be equal...
  return uniqy1.toString() == uniqy2.toString();
}

/**
 * Asserts that the messages the controller's folder display widget thinks are
 *  summarized are in fact summarized.  This is automatically called by
 *  assert_selected_and_displayed, so you do not need to call this directly
 *  unless you are testing the summarization logic.
 *
 * @param aController The controller who has the summarized display going on.
 * @param [aMessages] Optional set of messages to verify.  If not provided, this
 *     is extracted via the folderDisplay.  If a SyntheticMessageSet is provided
 *     we will automatically retrieve what we need from it.
 */
function assert_messages_summarized(aController, aSelectedMessages) {
  // - Compensate for selection stabilization code.
  // Although test-window-helpers sets the stabilization interval to 0, we
  //  still need to make sure we have drained the event queue so that it has
  //  actually gotten a chance to run.
  controller.sleep(0);

  // - Verify summary object knows about right messages
  if (aSelectedMessages == null)
    aSelectedMessages = aController.folderDisplay.selectedMessages;
  // if it's a synthetic message set, we want the headers...
  if (aSelectedMessages.synMessages)
    aSelectedMessages = [msgHdr for each (msgHdr in aSelectedMessages.msgHdrs)];

  let summary = aController.window.gSummary;
  if (aSelectedMessages.length != summary._msgHdrs.length) {
    let elaboration = "Summary contains " + summary._msgHdrs.length +
                      " messages, expected " + aSelectedMessages.length + ".";
    throw new Error("Summary does not contain the right set of messages. " +
                    elaboration);
  }
  if (!_verify_message_sets_equivalent(summary._msgHdrs, aSelectedMessages)) {
    let elaboration = "Summary: " + summary._msgHdrs + "  Selected: " +
                      aSelectedMessages + ".";
    throw new Error("Summary does not contain the right set of messages. " +
                    elaboration);
  }
}

/**
 * Assert that there is nothing selected and, assuming we are in a folder, that
 *  the folder summary is displayed.
 */
let assert_nothing_selected = assert_selected_and_displayed;

/**
 * Assert that the given view index or message is visible in the thread pane.
 */
function assert_visible(aViewIndexOrMessage) {
  let viewIndex;
  if (typeof(aViewIndexOrMessage) == "number")
    viewIndex = _normalize_view_index(aViewIndexOrMessage);
  else
    viewIndex = mc.dbView.findIndexOfMsgHdr(aViewIndexOrMessage, false);
  let treeBox = mc.threadTree.boxObject.QueryInterface(Ci.nsITreeBoxObject);
  if (viewIndex < treeBox.getFirstVisibleRow() ||
      viewIndex > treeBox.getLastVisibleRow())
    throw new Error("View index " + viewIndex + " is not visible! (" +
                    treeBox.getFirstVisibleRow() + "-" +
                    treeBox.getLastVisibleRow() + " are visible)");
}

/**
 * Assert that the given message is now shown in the current view.
 */
function assert_not_shown(aMessages) {
  aMessages.forEach(function(msg) {
    let viewIndex = mc.dbView.findIndexOfMsgHdr(msg, false);
    if (viewIndex !== nsMsgViewIndex_None)
      throw new Error("Message shows; "+ msg.messageKey + ": " +
                      msg.mime2DecodedSubject);
  });
}

/**
 * @param aShouldBeElided Should the messages at the view indices be elided?
 * @param aArgs Arguments of the form processed by
 *     |_process_row_message_arguments|.
 */
function _assert_elided_helper(aShouldBeElided, aArgs) {
  let [troller, viewIndices] =
    _process_row_message_arguments.apply(this, aArgs);

  let dbView = troller.dbView;
  for each (let [, viewIndex] in Iterator(viewIndices)) {
    let flags = dbView.getFlagsAt(viewIndex);
    if (Boolean(flags & Ci.nsMsgMessageFlags.Elided) != aShouldBeElided)
      throw new Error("Message at view index " + viewIndex +
                      (aShouldBeElided ? " should be elided but is not!"
                                       : " should not be elided but is!"));
  }
}

/**
 * Assert that all of the messages at the given view indices are collapsed.
 * Arguments should be of the type accepted by |assert_selected_and_displayed|.
 */
function assert_collapsed() {
  _assert_elided_helper(true, arguments);
}

/**
 * Assert that all of the messages at the given view indices are expanded.
 * Arguments should be of the type accepted by |assert_selected_and_displayed|.
 */
function assert_expanded() {
  _assert_elided_helper(false, arguments);
}

/**
 * Add the widget with the given id to the toolbar if it is not already present.
 *  It gets added to the front if we add it.  Use |remove_from_toolbar| to
 *  remove the widget from the toolbar when you are done.
 *
 * @param aToolbarElement The DOM element that is the toolbar, like you would
 *     get from getElementById.
 * @param aElementId The id attribute of the toolbaritem item you want added to
 *     the toolbar (not the id of the thing inside the toolbaritem tag!).
 *     We take the id name rather than element itself because if not already
 *     present the element is off floating in DOM limbo.  (The toolbar widget
 *     calls removeChild on the palette.)
 */
function add_to_toolbar(aToolbarElement, aElementId) {
  mark_action("fdh", "add_to_toolbar",
              ["adding", aElementId,
               "current set", aToolbarElement.currentSet]);
  let currentSet = aToolbarElement.currentSet.split(",");
  if (currentSet.indexOf(aElementId) == -1) {
    currentSet.unshift(aElementId);
    aToolbarElement.currentSet = currentSet.join(",");
  }
}

/**
 * Remove the widget with the given id from the toolbar if it is present.  Use
 *  |add_to_toolbar| to add the item in the first place.
 *
 * @param aToolbarElement The DOM element that is the toolbar, like you would
 *     get from getElementById.
 * @param aElementId The id attribute of the item you want removed to the
 *     toolbar.
 */
function remove_from_toolbar(aToolbarElement, aElementId) {
  mark_action("fdh", "remove_from_toolbar",
              ["removing", aElementId,
               "current set", aToolbarElement.currentSet]);
  let currentSet = aToolbarElement.currentSet.split(",");
  if (currentSet.indexOf(aElementId) != -1) {
    currentSet.splice(currentSet.indexOf(aElementId), 1);
    aToolbarElement.currentSet = currentSet.join(",");
  }
}

var RECOGNIZED_WINDOWS = ["messagepane", "multimessage"];
var RECOGNIZED_ELEMENTS = ["folderTree", "threadTree", "attachmentList"];

/**
 * Focus an element.
 */
function _focus_element(aElement) {
  mark_action("fdh", "_focus_element", [aElement]);
  // We're assuming that all elements we'd like to focus are in the main window
  mc.window.focus();
  mc.e(aElement).focus();
}

/**
 * Focus a window.
 */
function _focus_window(aWindow) {
  mc.e(aWindow).contentWindow.focus();
}

/**
 * Focus the folder tree.
 */
function focus_folder_tree() {
  _focus_element("folderTree");
}

/**
 * Focus the thread tree.
 */
function focus_thread_tree() {
  _focus_element("threadTree");
}

/**
 * Focus the (single) message pane.
 */
function focus_message_pane() {
  _focus_window("messagepane");
}

/**
 * Focus the multimessage pane.
 */
function focus_multimessage_pane() {
  _focus_window("multimessage");
}

/**
 * Returns a string indicating whatever's currently focused. This will return
 * either one of the strings in RECOGNIZED_WINDOWS/RECOGNIZED_ELEMENTS or null.
 */
function _get_currently_focused_thing() {
  // If the message pane or multimessage is focused, return that
  let focusedWindow = mc.window.document.commandDispatcher.focusedWindow;
  if (focusedWindow) {
    for each (let [, windowId] in Iterator(RECOGNIZED_WINDOWS)) {
      let elem = mc.e(windowId);
      if (elem && focusedWindow == elem.contentWindow)
        return windowId;
    }
  }

  // Focused window not recognized, let's try the focused element.
  // If an element is focused, it is necessary for the main window to be
  // focused.
  if (focusedWindow != mc.window)
    return null;

  let focusedElement = mc.window.document.commandDispatcher.focusedElement;
  let elementsToMatch = [mc.e(elem)
                         for each ([, elem] in Iterator(RECOGNIZED_ELEMENTS))];
  while (focusedElement && elementsToMatch.indexOf(focusedElement) == -1)
    focusedElement = focusedElement.parentNode;

  return focusedElement ? focusedElement.id : null;
}

function _assert_thing_focused(aThing) {
  let focusedThing = _get_currently_focused_thing();
  if (focusedThing != aThing)
    throw new Error("The currently focused thing should be " + aThing +
                    ", but is actually " + focusedThing);
}

/**
 * Assert that the folder tree is focused.
 */
function assert_folder_tree_focused() {
  _assert_thing_focused("folderTree");
}

/**
 * Assert that the thread tree is focused.
 */
function assert_thread_tree_focused() {
  _assert_thing_focused("threadTree");
}

/**
 * Assert that the (single) message pane is focused.
 */
function assert_message_pane_focused() {
  _assert_thing_focused("messagepane");
}

/**
 * Assert that the multimessage pane is focused.
 */
function assert_multimessage_pane_focused() {
  _assert_thing_focused("multimessage");
}

/**
 * Assert that the attachment list is focused.
 */
function assert_attachment_list_focused() {
  _assert_thing_focused("attachmentList");
}


function _normalize_folder_view_index(aViewIndex, aController) {
  if (aController == null)
    aController = mc;
  if (aViewIndex < 0)
    return aController.folderTreeView.QueryInterface(Ci.nsITreeView).rowCount +
      aViewIndex;
  return aViewIndex;
}

/**
 * Helper function for use by assert_folders_selected /
 * assert_folders_selected_and_displayed / assert_folder_displayed.
 */
function _process_row_folder_arguments() {
  let troller = mc;
  // - normalize into desired selected view indices
  let desiredFolders = [];
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    let arg = arguments[iArg];
    // An integer identifying a view index
    if (typeof(arg) == "number") {
      let folder = troller.folderTreeView.getFolderForIndex(
                       _normalize_folder_view_index(arg));
      if (!folder)
        throw new Error("Folder index not present in folder view: " + arg);
      desiredFolders.push(folder);
    }
    // A folder
    else if (arg instanceof Ci.nsIMsgFolder) {
      desiredFolders.push(arg);
    }
    // A list containing two integers, indicating a range of view indices.
    else if (arg.length == 2 && typeof(arg[0]) == "number") {
      let lowIndex = _normalize_folder_view_index(arg[0]);
      let highIndex = _normalize_folder_view_index(arg[1]);
      for (let viewIndex = lowIndex; viewIndex <= highIndex; viewIndex++)
        desiredFolders.push(troller.folderTreeView.getFolderForIndex(viewIndex));
    }
    // a List of folders
    else if (arg.length !== undefined) {
      for (let iFolder = 0; iFolder < arg.length; iFolder++) {
        let folder = arg[iFolder].QueryInterface(Ci.nsIMsgFolder);
        if (!folder)
          throw new Error(arg[iFolder] + " is not a folder!");
        desiredFolders.push(folder);
      }
    }
    // it's a MozmillController
    else if (arg.window) {
      troller = arg;
    }
    else {
      throw new Error("Illegal argument: " + arg);
    }
  }
  // we can't really sort, so you'll have to grin and bear it
  return [troller, desiredFolders];
}

/**
 * Asserts that the given set of folders is selected.  Unless you are dealing
 *  with transient selections resulting from right-clicks, you want to be using
 *  assert_folders_selected_and_displayed because it makes sure that the
 *  display is correct too.
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - An nsIMsgFolder.
 * - A list of nsIMsgFolders.
 */
function assert_folders_selected() {
  let [troller, desiredFolders] =
    _process_row_folder_arguments.apply(this, arguments);

  // - get the actual selection (already sorted by integer value)
  let selectedFolders = troller.folderTreeView.getSelectedFolders();
  // - test selection equivalence
  // no shortcuts here. check if each folder in either array is present in the
  // other array
  if (desiredFolders.some(
      function (folder) _non_strict_index_of(selectedFolders, folder) == -1) ||
      selectedFolders.some(
      function (folder) _non_strict_index_of(desiredFolders, folder) == -1))
    throw new Error("Desired selection is: " +
                    _prettify_folder_array(desiredFolders) + " but actual " +
                    "selection is: " + _prettify_folder_array(selectedFolders));

  return [troller, desiredFolders];
}

let assert_folder_selected = assert_folders_selected;

/**
 * Assert that the given folder is displayed, but not necessarily selected.
 * Unless you are dealing with transient selection issues, you really should
 * be using assert_folders_selected_and_displayed.
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - An nsIMsgFolder.
 * - A list of nsIMsgFolders.
 *
 * In each case, since we can only have one folder displayed, we only look at
 * the first folder you pass in.
 */
function assert_folder_displayed() {
  let [troller, desiredFolders] =
    _process_row_folder_arguments.apply(this, arguments);
  if (troller.folderDisplay.displayedFolder != desiredFolders[0])
    mark_failure(["The displayed folder should be", desiredFolders[0],
                  "but is actually", troller.folderDisplay.displayedFolder]);
}

/**
 * Asserts that the folders corresponding to the one or more folder spec
 * arguments are selected and displayed. If you specify multiple folders,
 * we verify that all of them are selected and that the first folder you pass
 * in is the one displayed. (If you don't pass in any folders, we can't assume
 * anything, so we don't test that case.)
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - An nsIMsgFolder.
 * - A list of nsIMsgFolders.
 */
function assert_folders_selected_and_displayed() {
  let [troller, desiredFolders] = assert_folders_selected.apply(this,
                                                                arguments);
  if (desiredFolders.length > 0) {
      if (troller.folderDisplay.displayedFolder != desiredFolders[0])
        mark_failure(["The displayed folder should be", desiredFolders[0],
                      "but is actually",
                      troller.folderDisplay.displayedFolder]);
  }
}

let assert_no_folders_selected = assert_folders_selected_and_displayed;
let assert_folder_selected_and_displayed =
    assert_folders_selected_and_displayed;

/**
 * Assert that there are the given number of rows (not including children of
 * collapsed parents) in the folder tree view.
 */
function assert_folder_tree_view_row_count(aCount) {
  if (mc.folderTreeView.rowCount != aCount)
    throw new Error("The folder tree view's row count should be " + aCount +
                    ", but is actually " + mc.folderTreeView.rowCount);
}

/**
 * Assert that the displayed text of the folder at index n equals to str.
 */
function assert_folder_at_index_as(n, str) {
  let folderN = mc.window.gFolderTreeView.getFTVItemForIndex(n);
  assert_equals(folderN.text, str)
}

/**
 * Since indexOf does strict equality checking, we need this.
 */
function _non_strict_index_of(aArray, aSearchElement) {
  for ([i, item] in Iterator(aArray)) {
    if (item == aSearchElement)
      return i;
  }
  return -1;
}

function _prettify_folder_array(aArray) {
  return aArray.map(function (folder) folder.prettiestName).join(", ");
}

/**
 * Put the view in unthreaded mode.
 */
function make_display_unthreaded() {
  wait_for_message_display_completion();
  mark_action("fdh", "make_folder_display_unthreaded", []);
  mc.folderDisplay.view.showUnthreaded = true;
  // drain event queue
  mc.sleep(0);
}

/**
 * Put the view in threaded mode.
 */
function make_display_threaded() {
  wait_for_message_display_completion();
  mark_action("fdh", "make_folder_display_threaded", []);
  mc.folderDisplay.view.showThreaded = true;
  // drain event queue
  mc.sleep(0);
}

/**
 * Put the view in group-by-sort mode.
 */
function make_display_grouped() {
  wait_for_message_display_completion();
  mark_action("fdh", "make_folder_display_grouped", []);
  mc.folderDisplay.view.showGroupedBySort = true;
  // drain event queue
  mc.sleep(0);
}

/**
 * Collapse all threads in the current view.
 */
function collapse_all_threads() {
  wait_for_message_display_completion();
  mark_action("fdh", "collapse_all_threads", []);
  mc.folderDisplay.doCommand(Ci.nsMsgViewCommandType.collapseAll);
  // drain event queue
  mc.sleep(0);
}

/**
 * Set whether to show unread messages only in the current view.
 */
function set_show_unread_only(aShowUnreadOnly) {
  wait_for_message_display_completion();
  mark_action("fdh", "set_show_unread_only", [aShowUnreadOnly]);
  mc.folderDisplay.view.showUnreadOnly = aShowUnreadOnly;
  wait_for_all_messages_to_load();
  wait_for_message_display_completion();
  // drain event queue
  mc.sleep(0);
}

/**
 * Assert that we are showing unread messages only in this view.
 */
function assert_showing_unread_only() {
  wait_for_message_display_completion();
  if (!mc.folderDisplay.view.showUnreadOnly)
    throw new Error("The view should be showing unread messages only, but it " +
                    "isn't.");
}

/**
 * Assert that we are _not_ showing unread messages only in this view.
 */
function assert_not_showing_unread_only() {
  wait_for_message_display_completion();
  if (mc.folderDisplay.view.showUnreadOnly)
    throw new Error("The view should not be showing unread messages only, " +
                    "but it is.");
}

/**
 * Set the mail view filter for the current view. The aData parameter is for
 * tags (e.g. you can specify "$label1" for the first tag).
 */
function set_mail_view(aMailViewIndex, aData) {
  wait_for_message_display_completion();
  mark_action("fdh", "set_mail_view",
              ["index", aMailViewIndex, "mail view data", aData]);
  mc.folderDisplay.view.setMailView(aMailViewIndex, aData);
  wait_for_all_messages_to_load();
  wait_for_message_display_completion();
  // drain event queue
  mc.sleep(0);
}

/**
 * Assert that the current mail view is as given. See the documentation for
 * |set_mail_view| for information about aData.
 */
function assert_mail_view(aMailViewIndex, aData) {
  let actualMailViewIndex = mc.folderDisplay.view.mailViewIndex;
  if (actualMailViewIndex != aMailViewIndex)
    throw new Error("The mail view index should be " + aMailViewIndex +
                    ", but is actually " + actualMailViewIndex);

  let actualMailViewData = mc.folderDisplay.view.mailViewData;
  if (actualMailViewData != aData)
    throw new Error("The mail view data should be " + aData +
                    ", but is actually " + actualMailViewData);
}

/**
 * Expand all threads in the current view.
 */
function expand_all_threads() {
  wait_for_message_display_completion();
  mark_action("fdh", "expand_all_threads", []);
  mc.folderDisplay.doCommand(Ci.nsMsgViewCommandType.expandAll);
  // drain event queue
  mc.sleep(0);
}

/**
 * Set the mail.openMessageBehavior pref.
 *
 * @param aPref One of "NEW_WINDOW", "EXISTING_WINDOW" or "NEW_TAB"
 */
function set_open_message_behavior(aPref) {
  Services.prefs.setIntPref("mail.openMessageBehavior",
                            MailConsts.OpenMessageBehavior[aPref]);
}

/**
 * Reset the mail.openMessageBehavior pref.
 */
function reset_open_message_behavior() {
  if (Services.prefs.prefHasUserValue("mail.openMessageBehavior"))
    Services.prefs.clearUserPref("mail.openMessageBehavior");
}

/**
 * Set the mail.tabs.loadInBackground pref.
 *
 * @param aPref true/false.
 */
function set_context_menu_background_tabs(aPref) {
  Services.prefs.setBoolPref("mail.tabs.loadInBackground", aPref);
}

/**
 * Reset the mail.tabs.loadInBackground pref.
 */
function reset_context_menu_background_tabs() {
  if (Services.prefs.prefHasUserValue("mail.tabs.loadInBackground"))
    Services.prefs.clearUserPref("mail.tabs.loadInBackground");
}

/**
 * Set the mail.close_message_window.on_delete pref.
 *
 * @param aPref true/false.
 */
function set_close_message_on_delete(aPref) {
  Services.prefs.setBoolPref("mail.close_message_window.on_delete", aPref);
}

/**
 * Reset the mail.close_message_window.on_delete pref.
 */
function reset_close_message_on_delete() {
  if (Services.prefs.prefHasUserValue("mail.close_message_window.on_delete"))
    Services.prefs.clearUserPref("mail.close_message_window.on_delete");
}

/**
 * assert that the multimessage/thread summary view contains
 * the specified number of elements of the specified class.
 *
 * @param aClassName: the class to use to select
 * @param aNumElts: the number of expected elements that have that class
 */

function assert_summary_contains_N_divs(aClassName, aNumElts) {
  let htmlframe = mc.e('multimessage');
  let matches = htmlframe.contentDocument.getElementsByClassName(aClassName);
  if (matches.length != aNumElts)
    throw new Error("Expected to find " + aNumElts + " elements with class " +
                    aClassName + ", found: " + matches.length);
}


function throw_and_dump_view_state(aMessage, aController) {
  if (aController == null)
    aController = mc;

  dump("******** " + aMessage + "\n");
  testHelperModule.dump_view_state(aController.folderDisplay.view);
  throw new Error(aMessage);
}

/**
 * Copy constants from mailWindowOverlay.js
 */

const kClassicMailLayout = 0;
const kWideMailLayout = 1;
const kVerticalMailLayout = 2;

/**
 * Assert that the current mail pane layout is shown
 */

function assert_pane_layout(aLayout) {
  let actualPaneLayout = Services.prefs.getIntPref("mail.pane_config.dynamic");
  if (actualPaneLayout != aLayout)
    throw new Error("The mail pane layout should be " + aLayout +
                    ", but is actually " + actualPaneLayout);
}

/**
 * Change that the current mail pane layout
 */

function set_pane_layout(aLayout) {
  Services.prefs.setIntPref("mail.pane_config.dynamic", aLayout);
}

/** exported from messageInjection */
var make_new_sets_in_folders;
var make_new_sets_in_folder;
var add_sets_to_folders;
var delete_message_set;
var make_folder_with_sets;
var make_virtual_folder;
var SyntheticPartLeaf;
var SyntheticPartMultiMixed;
var SyntheticPartMultiRelated;

/**
 * Load a file in its own 'module'.
 *
 * @param aPath A path relative to the comm-central source path.
 *
 * @return An object that serves as the global scope for the loaded file.
 */
function load_via_src_path(aPath, aModule) {
  let thisFilePath = os.getFileForPath(__file__);

  for (let i = 0; i < FILE_LOAD_PATHS.length; ++i) {
    let srcPath = os.abspath(FILE_LOAD_PATHS[i], thisFilePath);
    let fullPath = os.abspath(aPath, os.getFileForPath(srcPath));

    let file = Cc["@mozilla.org/file/local;1"]
                 .createInstance(Ci.nsILocalFile);
    file.initWithPath(fullPath);

    if (file.exists()) {
      try {
        let uri = Services.io.newFileURI(file).spec;
        Services.scriptloader.loadSubScript(uri, aModule);
        return;
      }
      catch (ex) {
        throw new Error("Unable to load file: " + fullPath + " exception: " + ex);
      }
    }
  }

  // If we've got this far, then we weren't successful, fail out.
  throw new Error("Could not find " + aModule + " in available paths");
}

function assert_equals(a, b, comment)
{
  if (!comment)
    comment = "a != b";
  assert_true(a == b, comment + ": '"+ a + "' != '" + b + "'.");
}

function assert_not_equals(a, b, comment)
{
  if (!comment)
    comment = "a == b";
  assert_true(a != b, comment + ": '"+ a + "' == '" + b + "'.");
}

// something less sucky than do_check_true
function assert_true(aBeTrue, aWhy) {
  if (!aBeTrue)
    throw new Error(aWhy);
}

// something less sucky than do_check_false
function assert_false(aBeTrue, aWhy) {
  if (aBeTrue)
    throw new Error(aWhy);
}
