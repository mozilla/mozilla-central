/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * This file provides support for writing mailnews tests that require hooking
 * into the alerts system. Normally these tests would require a UI and fail in
 * debug mode, but with this method you can hook into the alerts system and
 * avoid the UI.
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


// This allows the send code to attempt to display errors to the user without
// failing.
var alertUtilsPrompts = {
  alert: function(aDialogTitle, aText) {
    if (typeof alert == "function") {
      alert(aDialogTitle, aText);
      return;
    }

    do_throw("alert unexpectedly called\n");
  },
  
  alertCheck: function(aDialogTitle, aText, aCheckMsg, aCheckState) {
    if (typeof alertCheck == "function") {
      alertCheck(aDialogTitle, aText, aCheckMsg, aCheckState);
      return;
    }

    do_throw("alertCheck unexpectedly called\n");
  },
  
  confirm: function(aDialogTitle, aText) {
    if (typeof confirm == "function") {
      confirm(aDialogTitle, aText);
      return;
    }

    do_throw("confirm unexpectedly called\n");
  },
  
  confirmCheck: function(aDialogTitle, aText, aCheckMsg, aCheckState) {
    if (typeof confirmCheck == "function") {
      confirmCheck(aDialogTitle, aText, aCheckMsg, aCheckState);
      return;
    }

    do_throw("confirmCheck unexpectedly called\n");
  },
  
  confirmEx: function(aDialogTitle, aText, aButtonFlags, aButton0Title,
		      aButton1Title, aButton2Title, aCheckMsg, aCheckState) {
    if (typeof confirmEx == "function") {
      confirmEx(aDialogTitle, aText, aButtonFlags, aButton0Title,
		aButton1Title, aButton2Title, aCheckMsg, aCheckState);
      return;
    }

    do_throw("confirmEx unexpectedly called\n");
  },
  
  prompt: function(aDialogTitle, aText, aValue, aCheckMsg, aCheckState) {
    if (typeof prompt == "function") {
      prompt(aDialogTitle, aText, aValue, aCheckMsg, aCheckState);
      return;
    }

    do_throw("prompt unexpectedly called\n");
  },
  
  promptUsernameAndPassword: function(aDialogTitle, aText, aUsername,
				      aPassword, aCheckMsg, aCheckState) {
    if (typeof promptUsernameAndPassword == "function") {
      promptUsernameAndPassword(aDialogTitle, aText, aUsername,
				aPassword, aCheckMsg, aCheckState);
      return;
    }

    do_throw("promptUsernameAndPassword unexpectedly called\n");
  },

  promptPassword: function(aDialogTitle, aText, aPassword, aCheckMsg,
			   aCheckState) {
    if (typeof promptPassword == "function") {
      promptPassword(aDialogTitle, aText, aPassword, aCheckMsg,
		     aCheckState);
      return;
    }

    do_throw("promptPassword unexpectedly called\n");
  },
  
  select: function(aDialogTitle, aText, aCount, aSelectList,
		   aOutSelection) {
    if (typeof select == "function") {
      select(aDialogTitle, aText, aCount, aSelectList,
	     aOutSelection);
      return;
    }

    do_throw("select unexpectedly called\n");
  },
  
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIPrompt)
     || iid.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

var alertUtilsWindowWatcher = {
  getNewPrompter: function(aParent) {
    return alertUtilsPrompts;
  },

  getNewAuthPrompter: function(aParent) {
    return alertUtilsPrompts;
  },

  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIWindowWatcher) || iid.equals(Ci.nsISupports)) {
      return this;
    }

    throw Cr.NS_ERROR_NO_INTERFACE;
  }
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
}
