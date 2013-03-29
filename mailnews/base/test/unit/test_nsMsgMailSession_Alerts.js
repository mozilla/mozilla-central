/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgMailSession functions relating to alerts and their
 * listeners.
 */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/alertTestUtils.js");

var gDialogTitle = null;
var gText = null;

function reset() {
  gDialogTitle = null;
  gText = null;
}

function alert(aDialogTitle, aText) {
  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, null);

  gDialogTitle = aDialogTitle;
  gText = aText;
}

var msgWindow = {
  get promptDialog() {
    return alertUtilsPrompts;
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
  // Test - No listeners, check alert tries to alert the user.

  reset();

  msgUrl._msgWindow = msgWindow;

  MailServices.mailSession.alertUser("test message", msgUrl);

  // The dialog title doesn't get set at the moment.
  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, "test message");

  // Test - No listeners and no msgWindow, check no alerts.

  reset();

  msgUrl._msgWindow = null;

  MailServices.mailSession.alertUser("test no message", msgUrl);

  // The dialog title doesn't get set at the moment.
  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, null);

  // Test - One listener, returning false (prompt should still happen).

  reset();

  var listener1 = new alertListener();
  listener1.mReturn = false;

  MailServices.mailSession.addUserFeedbackListener(listener1);

  msgUrl._msgWindow = msgWindow;

  MailServices.mailSession.alertUser("message test", msgUrl);

  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, "message test");

  do_check_eq(listener1.mMessage, "message test");
  do_check_neq(listener1.mMsgWindow, null);

  // Test - One listener, returning false, no msg window (prompt shouldn't
  //        happen).

  reset();
  listener1.reset();

  MailServices.mailSession.alertUser("message test no prompt", null);

  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, null);

  do_check_eq(listener1.mMessage, "message test no prompt");
  do_check_eq(listener1.mMsgWindow, null);

  // Test - Two listeners, both returning false (prompt should happen).

  reset();
  listener1.reset();

  var listener2 = new alertListener();
  listener2.mReturn = false;

  MailServices.mailSession.addUserFeedbackListener(listener2);

  msgUrl._msgWindow = msgWindow;

  MailServices.mailSession.alertUser("two listeners", msgUrl);

  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, "two listeners");

  do_check_eq(listener1.mMessage, "two listeners");
  do_check_neq(listener1.mMsgWindow, null);

  do_check_eq(listener2.mMessage, "two listeners");
  do_check_neq(listener2.mMsgWindow, null);

  // Test - Two listeners, one returning true (prompt shouldn't happen).

  reset();
  listener1.reset();
  listener2.reset();

  listener2.mReturn = true;

  msgUrl._msgWindow = msgWindow;

  MailServices.mailSession.alertUser("no prompt", msgUrl);

  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, null);

  do_check_eq(listener1.mMessage, "no prompt");
  do_check_neq(listener1.mMsgWindow, null);

  do_check_eq(listener2.mMessage, "no prompt");
  do_check_neq(listener2.mMsgWindow, null);

  // Test - Remove a listener.

  reset();
  listener1.reset();
  listener2.reset();

  MailServices.mailSession.removeUserFeedbackListener(listener1);

  msgUrl._msgWindow = msgWindow;

  MailServices.mailSession.alertUser("remove listener", msgUrl);

  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, null);

  do_check_eq(listener1.mMessage, null);
  do_check_eq(listener1.mMsgWindow, null);

  do_check_eq(listener2.mMessage, "remove listener");
  do_check_neq(listener2.mMsgWindow, null);

  // Test - Remove the other listener.

  reset();
  listener1.reset();
  listener2.reset();

  MailServices.mailSession.removeUserFeedbackListener(listener2);

  msgUrl._msgWindow = msgWindow;

  MailServices.mailSession.alertUser("no listeners", msgUrl);

  do_check_eq(gDialogTitle, null);
  do_check_eq(gText, "no listeners");

  do_check_eq(listener1.mMessage, null);
  do_check_eq(listener1.mMsgWindow, null);

  do_check_eq(listener2.mMessage, null);
  do_check_eq(listener2.mMsgWindow, null);
}
