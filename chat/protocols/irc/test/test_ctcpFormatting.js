/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource:///modules/ircUtils.jsm");

//TODO add a test for special JS characters (|, etc...)

const input = [
  "The quick brown fox \x02jumps\x02 over the lazy dog.",
  "The quick brown fox \x02jumps\x0F over the lazy dog.",
  "The quick brown \x16fox jumps\x16 over the lazy dog.",
  "The quick brown \x16fox jumps\x0F over the lazy dog.",
  "The quick \x1Fbrown fox jumps over the lazy\x1F dog.",
  "The quick \x1Fbrown fox jumps over the lazy\x0F dog.",
  "The quick \x1Fbrown fox \x02jumps over the lazy\x1F dog.",
  "The quick \x1Fbrown fox \x02jumps\x1F over the lazy\x02 dog.",
  "The quick \x1Fbrown \x16fox \x02jumps\x1F over\x16 the lazy\x02 dog.",
  "The quick \x1Fbrown \x16fox \x02jumps\x0F over \x16the lazy \x02dog."
];

function run_test() {
  add_test(test_ctcpFormatToHTML);
  add_test(test_ctcpFormatToText);

  run_next_test();
}

function test_ctcpFormatToHTML() {
  let expectedOutput = [
    "The quick brown fox <b>jumps</b> over the lazy dog.",
    "The quick brown fox <b>jumps</b> over the lazy dog.",
    "The quick brown <i>fox jumps</i> over the lazy dog.",
    "The quick brown <i>fox jumps</i> over the lazy dog.",
    "The quick <u>brown fox jumps over the lazy</u> dog.",
    "The quick <u>brown fox jumps over the lazy</u> dog.",
    "The quick <u>brown fox <b>jumps over the lazy</b></u><b> dog.</b>",
    "The quick <u>brown fox <b>jumps</b></u><b> over the lazy</b> dog.",
    "The quick <u>brown <i>fox <b>jumps</b></i></u><i><b> over</b></i><b> the lazy</b> dog.",
    "The quick <u>brown <i>fox <b>jumps</b></i></u> over <i>the lazy <b>dog.</b></i>"
  ];

  let output = input.map(ctcpFormatToHTML);
  for (let i = 0; i < output.length; i++)
    do_check_eq(expectedOutput[i], output[i]);

  run_next_test();
}

function test_ctcpFormatToText() {
  let expectedOutput = "The quick brown fox jumps over the lazy dog.";

  let output = input.map(ctcpFormatToText);
  for (let i = 0; i < output.length; i++)
    do_check_eq(expectedOutput, output[i]);

  run_next_test();
}
