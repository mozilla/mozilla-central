/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource:///modules/ircUtils.jsm");

const input = [
  // From http://www.mirc.com/colors.html
  "\x035,12colored text and background\x03",
  "\x035colored text\x03",
  "\x033colored text \x035,2more colored text and background\x03",
  "\x033,5colored text and background \x038other colored text but same background\x03",
  "\x033,5colored text and background \x038,7other colored text and different background\x03",

  // Based on above, but more complicated.
  "\x02\x035,12colored \x1Ftext and background\x03. You sure about this?",

  // Implied by above.
  "So a \x03,8 attribute is not valid and thus ignored.",

  // Try some of the above with two digits.
  "\x0303,5colored text and background \x0308other colored text but same background\x03",
  "\x0303,05colored text and background \x038,7other colored text and different background\x03",
];

function run_test() {
  add_test(test_mIRCColoring);
  add_test(test_ctcpFormatToText);

  run_next_test();
}

function test_mIRCColoring() {
  let expectedOutput = [
    "<font color=\"maroon\" background=\"blue\">colored text and background</font>",
    "<font color=\"maroon\">colored text</font>",
    "<font color=\"green\">colored text <font color=\"maroon\" background=\"navy\">more colored text and background</font></font>",
    "<font color=\"green\" background=\"maroon\">colored text and background <font color=\"yellow\">other colored text but same background</font></font>",
    "<font color=\"green\" background=\"maroon\">colored text and background <font color=\"yellow\" background=\"orange\">other colored text and different background</font></font>",
    "<b><font color=\"maroon\" background=\"blue\">colored <u>text and background</u></font><u>. You sure about this?</u></b>",
    "So a ,8 attribute is not valid and thus ignored.",
    "<font color=\"green\" background=\"maroon\">colored text and background <font color=\"yellow\">other colored text but same background</font></font>",
    "<font color=\"green\" background=\"maroon\">colored text and background <font color=\"yellow\" background=\"orange\">other colored text and different background</font></font>"
  ];

  for (let i = 0; i < input.length; i++)
    do_check_eq(expectedOutput[i], ctcpFormatToHTML(input[i]));

  run_next_test();
}

function test_ctcpFormatToText() {
  let expectedOutput = [
    "colored text and background",
    "colored text",
    "colored text more colored text and background",
    "colored text and background other colored text but same background",
    "colored text and background other colored text and different background",
    "colored text and background. You sure about this?",
    "So a ,8 attribute is not valid and thus ignored.",
    "colored text and background other colored text but same background",
    "colored text and background other colored text and different background",
  ];

  for (let i = 0; i < input.length; i++)
    do_check_eq(expectedOutput[i], ctcpFormatToText(input[i]));

  run_next_test();
}
