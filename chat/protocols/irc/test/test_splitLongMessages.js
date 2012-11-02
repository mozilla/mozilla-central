/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource://gre/modules/Services.jsm");
let irc = {};
Services.scriptloader.loadSubScript("resource:///components/irc.js", irc);

const messages = {
  // Exactly 50 characters.
  "This is a test.": ["This is a test."],
  // Too long.
  "This is a message that is too long.":
    ["This is a", "message that is", "too long."],
  // Too short.
  "Short msg.": ["Short msg."],
  "Thismessagecan'tbecut.": ["Thismessagecan'", "tbecut."]
};

irc.GenericIRCConversation.name = "target";
irc.GenericIRCConversation.writeMessage =
  function(aSource, aMessage, aParams) this.messages.push(aMessage);
irc.GenericIRCConversation._account = {
  __proto__: irc.ircAccount.prototype,
  _nickname: "sender",
  prefix: "!user@host",
  maxMessageLength: 50, // For convenience.
  sendMessage: function(aCommand, aParams) {}
};

function run_test() {
  for (let message in messages) {
    irc.GenericIRCConversation.messages = [];
    irc.GenericIRCConversation.sendMsg(message);

    // The split messages from sendMsg.
    let generatedMsgs = irc.GenericIRCConversation.messages;
    // The expected messages as defined above.
    let expectedMsgs = messages[message];
    // Ensure both arrays have the same length.
    do_check_eq(expectedMsgs.length, generatedMsgs.length);
    // Ensure the values in the arrays are equal.
    for (let i = 0; i < expectedMsgs.length; ++i)
      do_check_eq(generatedMsgs[i], expectedMsgs[i]);
  }
}
