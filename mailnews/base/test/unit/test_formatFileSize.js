/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Tests for the formatFileSize method.
 */

load("../../../../mailnews/resources/logHelper.js");
load("../../../../mailnews/resources/asyncTestUtils.js");

const gStringBundle = Services.strings.createBundle(
  "chrome://messenger/locale/messenger.properties");

var gMessenger = Cc["@mozilla.org/messenger;1"]
                   .createInstance(Ci.nsIMessenger);

function test_formatFileSize(aArgs) {
  const strings = {  b: "byteAbbreviation2",
                    kb: "kiloByteAbbreviation2",
                    mb: "megaByteAbbreviation2",
                    gb: "gigaByteAbbreviation2" };

  let actual = gMessenger.formatFileSize(aArgs.bytes, aArgs.useKB);
  let expected = gStringBundle.GetStringFromName(strings[aArgs.units])
                              .replace("%.*f", aArgs.mantissa);
  do_check_eq(actual, expected);
}

/* ===== Driver ===== */

var test_data = [
  { bytes:                   0, useKB: false, mantissa:    "0", units:  "b" },
  { bytes:                   1, useKB: false, mantissa:    "1", units:  "b" },
  { bytes:                  10, useKB: false, mantissa:   "10", units:  "b" },
  { bytes:                 999, useKB: false, mantissa:  "999", units:  "b" },
  { bytes:                1000, useKB: false, mantissa:  "1.0", units: "kb" },
  { bytes:                1024, useKB: false, mantissa:  "1.0", units: "kb" },
  { bytes:             10*1024, useKB: false, mantissa: "10.0", units: "kb" },
  { bytes:            999*1024, useKB: false, mantissa:  "999", units: "kb" },
  { bytes:           1000*1024, useKB: false, mantissa:  "1.0", units: "mb" },
  { bytes:           1024*1024, useKB: false, mantissa:  "1.0", units: "mb" },
  { bytes:        10*1024*1024, useKB: false, mantissa: "10.0", units: "mb" },
  { bytes:       999*1024*1024, useKB: false, mantissa:  "999", units: "mb" },
  { bytes:      1000*1024*1024, useKB: false, mantissa:  "1.0", units: "gb" },
  { bytes:      1024*1024*1024, useKB: false, mantissa:  "1.0", units: "gb" },
  { bytes:   10*1024*1024*1024, useKB: false, mantissa: "10.0", units: "gb" },
  { bytes:  999*1024*1024*1024, useKB: false, mantissa:  "999", units: "gb" },
  { bytes: 1000*1024*1024*1024, useKB: false, mantissa: "1000", units: "gb" },

  { bytes:                   0, useKB: true,  mantissa:    "0", units: "kb" },
  { bytes:                   1, useKB: true,  mantissa:  "0.1", units: "kb" },
  { bytes:                 500, useKB: true,  mantissa:  "0.5", units: "kb" },
  { bytes:                 999, useKB: true,  mantissa:  "1.0", units: "kb" },
];

var tests = [
  parameterizeTest(test_formatFileSize, test_data)
];

function run_test() {
  async_run_tests(tests);
}
