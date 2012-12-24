//
// Tests if a multi-line MIME header is parsed even if it violates RFC 2047
//

function run_test() {
  const headers = [
    { encoded:
      "Subject: =?UTF-8?B?4oiAICDiiIEgIOKIgiAg4oiDICDiiIQgIOKIhSAg4oiGICDiiIcgIOKIiCAg?=\n"
    + " =?UTF-8?B?4oiJICDiiIogIOKIiyAg4oiMICDiiI0gIOKIjiAg4oiP?="
    , defaultCharset: "UTF-8"
    , overrideCharset: false
    , eatContinuation: false
    , decoded: "Subject: ∀  ∁  ∂  ∃  ∄  ∅  ∆  ∇  ∈  ∉  ∊  ∋  ∌  ∍  ∎  ∏"
    }, // Bug 493544
    { encoded:
      "Subject: =?utf-8?Q?=E2=88=80__=E2=88=81__=E2=88=82__=E2=88=83__=E2=88=84__=E2?=\n"
    + " =?utf-8?Q?=88=85__=E2=88=86__=E2=88=87__=E2=88=88__=E2=88=89__=E2=88?=\n"
    + " =?utf-8?Q?=8A__=E2=88=8B__=E2=88=8C__=E2=88=8D__=E2=88=8E__=E2=88=8F?="
    , defaultCharset: "UTF-8"
    , overrideCharset: false
    , eatContinuation: false
    , decoded: "Subject: ∀  ∁  ∂  ∃  ∄  ∅  ∆  ∇  ∈  ∉  ∊  ∋  ∌  ∍  ∎  ∏"
    }, // Bug 476741
    { encoded:
      "Subject: =?UTF-8?B?4oiAICDiiIEgIOKIgiAg4oiDICDiiIQgIOKIhSAg4oiGICDiiIcgIOKIiA==?=\n"
    + " =?UTF-8?B?ICDiiIkgIOKIiiAg4oiLICDiiIwgIOKIjSAg4oiOICDiiI8=?="
    , defaultCharset: "UTF-8"
    , overrideCharset: false
    , eatContinuation: false
    , decoded: "Subject: ∀  ∁  ∂  ∃  ∄  ∅  ∆  ∇  ∈  ∉  ∊  ∋  ∌  ∍  ∎  ∏"
    }, // Normal case
    { encoded:
      "Subject: =?UTF-8?b?4oiAICDiiIEgIOKIgiAg4oiDICDiiIQgIOKIhSAg4oiGICDiiIcgIOKIiA==?=\n"
    + " =?UTF-8?b?ICDiiIkgIOKIiiAg4oiLICDiiIwgIOKIjSAg4oiOICDiiI8=?="
    , defaultCharset: "UTF-8"
    , overrideCharset: false
    , eatContinuation: false
    , decoded: "Subject: ∀  ∁  ∂  ∃  ∄  ∅  ∆  ∇  ∈  ∉  ∊  ∋  ∌  ∍  ∎  ∏"
    }, // Normal case with the encoding character in lower case
    { encoded:
      "Subject: =?utf-8?Q?=E2=88=80__=E2=88=81__=E2=88=82__=E2=88=83__=E2=88=84__?=\n"
    + " =?utf-8?Q?=E2=88=85__=E2=88=86__=E2=88=87__=E2=88=88__=E2=88=89__?=\n"
    + " =?utf-8?Q?=E2=88=8A__=E2=88=8B__=E2=88=8C__=E2=88=8D__=E2=88=8E__?=\n"
    + " =?utf-8?Q?=E2=88=8F?="
    , defaultCharset: "UTF-8"
    , overrideCharset: false
    , eatContinuation: false
    , decoded: "Subject: ∀  ∁  ∂  ∃  ∄  ∅  ∆  ∇  ∈  ∉  ∊  ∋  ∌  ∍  ∎  ∏"
    }, // Normal case
    { encoded:
      "Subject: =?utf-8?q?=E2=88=80__=E2=88=81__=E2=88=82__=E2=88=83__=E2=88=84__?=\n"
    + " =?utf-8?q?=E2=88=85__=E2=88=86__=E2=88=87__=E2=88=88__=E2=88=89__?=\n"
    + " =?utf-8?q?=E2=88=8A__=E2=88=8B__=E2=88=8C__=E2=88=8D__=E2=88=8E__?=\n"
    + " =?utf-8?q?=E2=88=8F?="
    , defaultCharset: "UTF-8"
    , overrideCharset: false
    , eatContinuation: false
    , decoded: "Subject: ∀  ∁  ∂  ∃  ∄  ∅  ∆  ∇  ∈  ∉  ∊  ∋  ∌  ∍  ∎  ∏"
    }, // Normal case with the encoding character in lower case
    { encoded:
      "Subject: =?UTF-8?B?4oiAICDiiIEgIOKIgiAg4oiDICDiiIQgIOKIhSAg4oiGICDiiIcgIOKIiA===?=\n"
    + " =?UTF-8?B?ICDiiIkgIOKIiiAg4oiLICDiiIwgIOKIjSAg4oiOICDiiI8=?="
    , defaultCharset: "UTF-8"
    , overrideCharset: false
    , eatContinuation: false
    , decoded: "Subject: ∀  ∁  ∂  ∃  ∄  ∅  ∆  ∇  ∈  ∉  ∊  ∋  ∌  ∍  ∎  ∏"
    }, // Regression test for bug 227290
  ];

  var converter = Cc["@mozilla.org/messenger/mimeconverter;1"]
                      .getService(Ci.nsIMimeConverter);
  for (var i = 0; i < headers.length; ++i) {
    var decoded = converter.decodeMimeHeader(headers[i].encoded,
                                             headers[i].defaultCharset,
                                             headers[i].overrideCharset,
                                             headers[i].eatContinuation);
    do_check_eq(decoded, headers[i].decoded);
  }
}