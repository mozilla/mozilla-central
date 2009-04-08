/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgMailSession functions relating to alerts and their
 * listeners.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// This allows us to check that we get alerts at the right time without
// involking the UI.
var prompts = {
  mDialogTitle: null,
  mText: null,

  // not part of the nsIPrompt interface, just makes it easier to test.
  reset: function() {
    this.mDialogTitle = null;
    this.mText = null;
  },

  // nsIPrompt
  alert: function(aDialogTitle, aText) {
    do_check_eq(this.mDialogTitle, null);
    do_check_eq(this.mText, null);

    this.mDialogTitle = aDialogTitle;
    this.mText = aText;
  },
  
  alertCheck: function(aDialogTitle, aText, aCheckMsg, aCheckState) {},
  
  confirm: function(aDialogTitle, aText) {},
  
  confirmCheck: function(aDialogTitle, aText, aCheckMsg, aCheckState) {},
  
  confirmEx: function(aDialogTitle, aText, aButtonFlags, aButton0Title,
		      aButton1Title, aButton2Title, aCheckMsg, aCheckState) {},
  
  prompt: function(aDialogTitle, aText, aValue, aCheckMsg, aCheckState) {},
  
  promptUsernameAndPassword: function(aDialogTitle, aText, aUsername,
				      aPassword, aCheckMsg, aCheckState) {},

  promptPassword: function(aDialogTitle, aText, aPassword, aCheckMsg,
			   aCheckState) {},
  
  select: function(aDialogTitle, aText, aCount, aSelectList,
		   aOutSelection) {},
  
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIPrompt])
};

var WindowWatcher = {
  getNewPrompter: function(aParent) {
    return prompts;
  },

  getNewAuthPrompter: function(aParent) {
    return prompts;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWindowWatcher])
};

var WindowWatcherFactory = {
  createInstance: function createInstance(outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return WindowWatcher.QueryInterface(iid);
  }
};

Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar)
          .registerFactory(Components.ID("{1dfeb90a-2193-45d5-9cb8-864928b2af55}"),
			   "Fake Window Watcher",
			   "@mozilla.org/embedcomp/window-watcher;1",
			   WindowWatcherFactory);

var msgWindow = {
  get promptDialog() {
    return prompts;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow])
};

var msgUrl = {
  _msgWindow: null,

  get msgWindow() {
    return this._msgWindow;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgMailNewsUrl])
};

function alertListener() {}

alertListener.prototype = {
  mReturn: false,
  mMessage: null,
  mMsgWindow: null,

  reset: function () {
    this.mMessage = null;
    this.mMsgWindow = null;
  },

  onAlert: function (aMessage, aMsgWindow) {
    do_check_eq(this.mMessage, null);
    do_check_eq(this.mMsgWindow, null);

    this.mMessage = aMessage;
    this.mMsgWindow = aMsgWindow;

    return this.mReturn;
  }
};

function run_test()
{
  var mailSession = Cc["@mozilla.org/messenger/services/session;1"]
    .getService(Ci.nsIMsgMailSession);

  // Test - No listeners, check alert tries to alert the user.

  prompts.reset();

  msgUrl._msgWindow = msgWindow;

  mailSession.alertUser("test message", msgUrl);

  // The dialog title doesn't get set at the moment.
  do_check_eq(prompts.mDialogTitle, null);
  do_check_eq(prompts.mText, "test message");

  // Test - No listeners and no msgWindow, check no alerts.

  prompts.reset();

  msgUrl._msgWindow = null;

  mailSession.alertUser("test no message", msgUrl);

  // The dialog title doesn't get set at the moment.
  do_check_eq(prompts.mDialogTitle, null);
  do_check_eq(prompts.mText, null);

  // Test - One listener, returning false (prompt should still happen).

  prompts.reset();

  var listener1 = new alertListener();
  listener1.mReturn = false;

  mailSession.addUserFeedbackListener(listener1);

  msgUrl._msgWindow = msgWindow;

  mailSession.alertUser("message test", msgUrl);

  do_check_eq(prompts.mDialogTitle, null);
  do_check_eq(prompts.mText, "message test");

  do_check_eq(listener1.mMessage, "message test");
  do_check_neq(listener1.mMsgWindow, null);

  // Test - One listener, returning false, no msg window (prompt shouldn't
  //        happen).

  prompts.reset();
  listener1.reset();

  mailSession.alertUser("message test no prompt", null);

  do_check_eq(prompts.mDialogTitle, null);
  do_check_eq(prompts.mText, null);

  do_check_eq(listener1.mMessage, "message test no prompt");
  do_check_eq(listener1.mMsgWindow, null);

  // Test - Two listeners, both returning false (prompt should happen).

  prompts.reset();
  listener1.reset();

  var listener2 = new alertListener();
  listener2.mReturn = false;

  mailSession.addUserFeedbackListener(listener2);

  msgUrl._msgWindow = msgWindow;

  mailSession.alertUser("two listeners", msgUrl);

  do_check_eq(prompts.mDialogTitle, null);
  do_check_eq(prompts.mText, "two listeners");

  do_check_eq(listener1.mMessage, "two listeners");
  do_check_neq(listener1.mMsgWindow, null);

  do_check_eq(listener2.mMessage, "two listeners");
  do_check_neq(listener2.mMsgWindow, null);

  // Test - Two listeners, one returning true (prompt shouldn't happen).

  prompts.reset();
  listener1.reset();
  listener2.reset();

  listener2.mReturn = true;

  msgUrl._msgWindow = msgWindow;

  mailSession.alertUser("no prompt", msgUrl);

  do_check_eq(prompts.mDialogTitle, null);
  do_check_eq(prompts.mText, null);

  do_check_eq(listener1.mMessage, "no prompt");
  do_check_neq(listener1.mMsgWindow, null);

  do_check_eq(listener2.mMessage, "no prompt");
  do_check_neq(listener2.mMsgWindow, null);

  // Test - Remove a listener.

  prompts.reset();
  listener1.reset();
  listener2.reset();

  mailSession.removeUserFeedbackListener(listener1);

  msgUrl._msgWindow = msgWindow;

  mailSession.alertUser("remove listener", msgUrl);

  do_check_eq(prompts.mDialogTitle, null);
  do_check_eq(prompts.mText, null);

  do_check_eq(listener1.mMessage, null);
  do_check_eq(listener1.mMsgWindow, null);

  do_check_eq(listener2.mMessage, "remove listener");
  do_check_neq(listener2.mMsgWindow, null);

  // Test - Remove the other listener.

  prompts.reset();
  listener1.reset();
  listener2.reset();

  mailSession.removeUserFeedbackListener(listener2);

  msgUrl._msgWindow = msgWindow;

  mailSession.alertUser("no listeners", msgUrl);

  do_check_eq(prompts.mDialogTitle, null);
  do_check_eq(prompts.mText, "no listeners");

  do_check_eq(listener1.mMessage, null);
  do_check_eq(listener1.mMsgWindow, null);

  do_check_eq(listener2.mMessage, null);
  do_check_eq(listener2.mMsgWindow, null);
}
