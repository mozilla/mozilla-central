/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * This file provides support for writing mailnews tests that require hooking
 * into the alerts system. Normally these tests would require a UI and fail in
 * debug mode, but with this method you can hook into the alerts system and
 * avoid the UI.
 *
 * This file registers prompts for nsIWindowWatcher::getNewPrompter and also
 * registers a nsIPromptService service. nsIWindowWatcher::getNewAuthPrompter
 * is also implemented but returns the nsILoginManagerPrompter as this would
 * be expected when running mailnews.
 *
 * To register the system:
 *
 * function run_test() {
 *   registerAlertTestUtils();
 *   // ...
 * }
 *
 * You can then hook into the alerts just by defining a function of the same
 * name as the interface function:
 *
 * function alert(aDialogTitle, aText) {
 *   // do my check
 * }
 *
 * Interface functions that do not have equivalent functions defined and get
 * called will be treated as unexpected, and therefore they will call
 * do_throw().
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Wrapper to the nsIPrompt interface.
// This allows the send code to attempt to display errors to the user without
// failing.
var alertUtilsPrompts = {
  alert: function(aDialogTitle, aText) {
    if (typeof alert == "function") {
      alert(aDialogTitle, aText);
      return;
    }

    do_throw("alert unexpectedly called: " + aText + "\n");
  },
  
  alertCheck: function(aDialogTitle, aText, aCheckMsg, aCheckState) {
    if (typeof alertCheck == "function") {
      alertCheck(aDialogTitle, aText, aCheckMsg, aCheckState);
      return;
    }

    do_throw("alertCheck unexpectedly called: " + aText + "\n");
  },
  
  confirm: function(aDialogTitle, aText) {
    if (typeof confirm == "function") {
      return confirm(aDialogTitle, aText);
    }

    do_throw("confirm unexpectedly called: " + aText + "\n");
  },
  
  confirmCheck: function(aDialogTitle, aText, aCheckMsg, aCheckState) {
    if (typeof confirmCheck == "function") {
      return confirmCheck(aDialogTitle, aText, aCheckMsg, aCheckState);
    }

    do_throw("confirmCheck unexpectedly called: " + aText + "\n");
  },
  
  confirmEx: function(aDialogTitle, aText, aButtonFlags, aButton0Title,
                      aButton1Title, aButton2Title, aCheckMsg, aCheckState) {
    if (typeof confirmEx == "function") {
      return confirmEx(aDialogTitle, aText, aButtonFlags, aButton0Title,
                       aButton1Title, aButton2Title, aCheckMsg, aCheckState);
    }

    do_throw("confirmEx unexpectedly called: " + aText + "\n");
  },
  
  prompt: function(aDialogTitle, aText, aValue, aCheckMsg, aCheckState) {
    if (typeof prompt == "function") {
      return prompt(aDialogTitle, aText, aValue, aCheckMsg, aCheckState);
    }

    do_throw("prompt unexpectedly called: " + aText + "\n");
  },
  
  promptUsernameAndPassword: function(aDialogTitle, aText, aUsername,
                                      aPassword, aCheckMsg, aCheckState) {
    if (typeof promptUsernameAndPassword == "function") {
      return promptUsernameAndPassword(aDialogTitle, aText, aUsername,
                                       aPassword, aCheckMsg, aCheckState);
    }

    do_throw("promptUsernameAndPassword unexpectedly called: " + aText + "\n");
  },

  promptPassword: function(aDialogTitle, aText, aPassword, aCheckMsg,
                           aCheckState) {
    if (typeof promptPassword == "function") {
      return promptPassword(aDialogTitle, aText, aPassword, aCheckMsg,
                            aCheckState);
    }

    do_throw("promptPassword unexpectedly called: " + aText + "\n");
  },
  
  select: function(aDialogTitle, aText, aCount, aSelectList,
                   aOutSelection) {
    if (typeof select == "function") {
      select(aDialogTitle, aText, aCount, aSelectList,
             aOutSelection);
      return;
    }

    do_throw("select unexpectedly called: " + aText + "\n");
  },
  
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIPrompt])
};

var alertUtilsPromptService = {
   alert: function(aParent, aDialogTitle, aText) {
    if (typeof alertPS == "function") {
      alertPS(aParent, aDialogTitle, aText);
      return;
    }

    do_throw("alertPS unexpectedly called: " + aText + "\n");
  },
  
  alertCheck: function(aParent, aDialogTitle, aText, aCheckMsg, aCheckState) {
    if (typeof alertCheckPS == "function") {
      alertCheckPS(aParent, aDialogTitle, aText, aCheckMsg, aCheckState);
      return;
    }

    do_throw("alertCheckPS unexpectedly called: " + aText + "\n");
  },
  
  confirm: function(aParent, aDialogTitle, aText) {
    if (typeof confirmPS == "function") {
      return confirmPS(aParent, aDialogTitle, aText);
    }

    do_throw("confirmPS unexpectedly called: " + aText + "\n");
  },
  
  confirmCheck: function(aParent, aDialogTitle, aText, aCheckMsg, aCheckState) {
    if (typeof confirmCheckPS == "function") {
      return confirmCheckPS(aParent, aDialogTitle, aText, aCheckMsg,
                            aCheckState);
    }

    do_throw("confirmCheckPS unexpectedly called: " + aText + "\n");
  },
  
  confirmEx: function(aParent, aDialogTitle, aText, aButtonFlags, aButton0Title,
                      aButton1Title, aButton2Title, aCheckMsg, aCheckState) {
    if (typeof confirmExPS == "function") {
      return confirmExPS(aParent, aDialogTitle, aText, aButtonFlags,
                         aButton0Title, aButton1Title, aButton2Title, aCheckMsg,
                         aCheckState);
    }

    do_throw("confirmExPS unexpectedly called: " + aText + "\n");
  },
  
  prompt: function(aParent, aDialogTitle, aText, aValue, aCheckMsg,
                   aCheckState) {
    if (typeof promptPS == "function") {
      return promptPS(aParent, aDialogTitle, aText, aValue, aCheckMsg,
                      aCheckState);
    }

    do_throw("promptPS unexpectedly called: " + aText + "\n");
  },
  
  promptUsernameAndPassword: function(aParent, aDialogTitle, aText, aUsername,
                                      aPassword, aCheckMsg, aCheckState) {
    if (typeof promptUsernameAndPasswordPS == "function") {
      return promptUsernameAndPasswordPS(aParent, aDialogTitle, aText,
                                         aUsername, aPassword, aCheckMsg,
                                         aCheckState);
    }

    do_throw("promptUsernameAndPasswordPS unexpectedly called: " + aText + "\n");
  },

  promptPassword: function(aParent, aDialogTitle, aText, aPassword, aCheckMsg,
                           aCheckState) {
    if (typeof promptPasswordPS == "function") {
      return promptPasswordPS(aParent, aDialogTitle, aText, aPassword,
                              aCheckMsg, aCheckState);
    }

    do_throw("promptPasswordPS unexpectedly called: " + aText + "\n");
  },
  
  select: function(aParent, aDialogTitle, aText, aCount, aSelectList,
                   aOutSelection) {
    if (typeof selectPS == "function") {
      selectPS(aParent, aDialogTitle, aText, aCount, aSelectList,
               aOutSelection);
      return;
    }

    do_throw("selectPS unexpectedly called: " + aText + "\n");
  },
  
  createInstance: function createInstance(outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return this.QueryInterface(iid);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIPromptService,
                                         Ci.nsIPromptService2])
};

var alertUtilsWindowWatcher = {
  getNewPrompter: function(aParent) {
    return alertUtilsPrompts;
  },

  getNewAuthPrompter: function(aParent) {
    return Cc["@mozilla.org/login-manager/prompter;1"]
            .getService(Ci.nsIAuthPrompt);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWindowWatcher])
};

function registerAlertTestUtils()
{
  var WindowWatcherFactory = {
    createInstance: function createInstance(outer, iid) {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      return alertUtilsWindowWatcher.QueryInterface(iid);
    }
  };

  Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar)
            .registerFactory(Components.ID("{1dfeb90a-2193-45d5-9cb8-864928b2af55}"),
                             "Fake Window Watcher",
                             "@mozilla.org/embedcomp/window-watcher;1",
                             WindowWatcherFactory);
  Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar)
            .registerFactory(Components.ID("{4637b567-6e2d-4a24-9775-e8fc0fb159ba}"),
                             "Fake Prompt Service",
                             "@mozilla.org/embedcomp/prompt-service;1",
                             alertUtilsPromptService);
}
