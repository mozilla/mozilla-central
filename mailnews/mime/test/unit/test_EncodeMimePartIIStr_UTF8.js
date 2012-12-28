/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This tests minimal mime encoding fixed in bug 458685

var converter = Components.classes["@mozilla.org/messenger/mimeconverter;1"]
                .getService(Components.interfaces.nsIMimeConverter);

function run_test() {
  var i;

  var checks =
  [
    ["", false, ""],
    ["\u0436", false, "=?UTF-8?B?0LY=?="], //CYRILLIC SMALL LETTER ZHE
    ["IamASCII", false, "IamASCII"],
    // Although an invalid email, we shouldn't crash on it (bug 479206)
    ["crash test@foo.invalid>", true, "crash test@foo.invalid>"],
  ];

  for (i = 0; i < checks.length; ++i)
  {
    do_check_eq(
      converter.encodeMimePartIIStr_UTF8(checks[i][0], checks[i][1], "UTF-8", 0, 72),
      checks[i][2]);
  }
}
