/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = "test-account-port-setting";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "account-manager-helpers", "keyboard-helpers" ];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

const PORT_NUMBERS_TO_TEST =
  [
    "110", // The original port number. We don't input this though.
    "456", // Random port number.
    "995", // The SSL port number.
    "110"  // Back to the original.
  ];

var gTestNumber;

function subtest_check_set_port_number(amc, aDontSet) {
  // This test expects the following POP account to exist by default
  // with port number 110 and no security.
  let server = MailServices.accounts
                           .FindServer("tinderbox", "tinderbox", "pop3");
  let account = MailServices.accounts.FindAccountForServer(server);

  let accountRow = get_account_tree_row(account.key, "am-server.xul", amc);
  assert_not_equals(accountRow, -1);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.window.document.getElementById("contentFrame");
  let portElem = iframe.contentDocument.getElementById("server.port");
  portElem.focus();
  portElem.selectionStart = portElem.selectionEnd = portElem.value.length;

  if (portElem.value != PORT_NUMBERS_TO_TEST[gTestNumber - 1])
    throw new Error("Port Value is not " +
                    PORT_NUMBERS_TO_TEST[gTestNumber - 1] +
                    " as expected, it is: " + portElem.value);

  if (!aDontSet) {
    delete_existing(amc, new elib.Elem(portElem), 3);
    input_value(amc, PORT_NUMBERS_TO_TEST[gTestNumber]);

    mc.sleep(0);
  }

  amc.window.document.getElementById("accountManager").acceptDialog();
}

function subtest_check_port_number(amc) {
  subtest_check_set_port_number(amc, true);
}

function setupModule(module) {
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let amh = collector.getModule("account-manager-helpers");
  amh.installInto(module);
  let kh = collector.getModule("keyboard-helpers");
  kh.installInto(module);
}

function test_account_port_setting() {
  for (gTestNumber = 1; gTestNumber < PORT_NUMBERS_TO_TEST.length; ++gTestNumber) {
    open_advanced_settings(subtest_check_set_port_number);
  }

  open_advanced_settings(subtest_check_port_number);
}
