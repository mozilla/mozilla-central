/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource://gre/modules/Services.jsm");
let ircBase = {};
Services.scriptloader.loadSubScript("resource:///modules/ircBase.jsm", ircBase);

const testData = {
  "clokep": "clokep1",
  "clokep1": "clokep2",
  "clokep10": "clokep11",
  "clokep0": "clokep1",
  "clokep01": "clokep02",
  "clokep09": "clokep10",

  // Now put a number in the "first part".
  "clo1kep": "clo1kep1",
  "clo1kep1": "clo1kep2",
  "clo1kep10": "clo1kep11",
  "clo1kep0": "clo1kep1",
  "clo1kep01": "clo1kep02",
  "clo1kep09": "clo1kep10",

  // Some to test the max length.
  "abcdefghi": "abcdefgh1",
  "abcdefgh0": "abcdefgh1",
  "abcdefgh9": "abcdefg10",
  "a99999999": "a00000000" // You'd expect 100000000, but this is not valid!
};

function run_test() {
  add_test(test_tryNewNick);

  run_next_test();
}

// Dummy function.
function LOG(aStr) {};

function test_tryNewNick() {
  for (let currentNick in testData) {
    let account = {
      _nickname: null,
      maxNicknameLength: 9,
      // Dummy function.
      sendMessage: function(aCommand, aNewNick) {}
    };
    let message = {params: [null, currentNick]};

    ircBase.tryNewNick(account, message);

    do_check_eq(account._nickname, testData[currentNick]);
  }

  run_next_test();
}
