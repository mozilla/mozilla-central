/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource:///modules/imServices.jsm");
Components.utils.import("resource:///modules/imContentSink.jsm");

const kModePref = "messenger.options.filterMode";
const kStrictMode = 0, kStandardMode = 1, kPermissiveMode = 2;

function run_test() {
  let defaultMode = Services.prefs.getIntPref(kModePref);

  add_test(test_strictMode);
  add_test(test_standardMode);
  add_test(test_permissiveMode);
  add_test(test_addGlobalAllowedTag);
  add_test(test_addGlobalAllowedAttribute);
  add_test(test_addGlobalAllowedStyleRule);
  add_test(test_createDerivedRuleset);

  Services.prefs.setIntPref(kModePref, defaultMode);
  run_next_test();
}

// Sanity check: a string without HTML markup shouldn't be modified.
function test_plainText() {
  const strings = [
    "foo",
    "foo  ", // preserve trailing whitespace
//TODO    "  foo", // leading indent is currently destroyed, see bio 898
    "&lt;html&gt;&amp;" // keep escaped characters
  ];
  for each (let string in strings)
    do_check_eq(string, cleanupImMarkup(string));
}

function test_paragraphs() {
  const strings = [
    "<p>foo</p><p>bar</p>",
    "<p>foo<br>bar</p>",
    "foo<br>bar"
  ];
  for each (let string in strings)
    do_check_eq(string, cleanupImMarkup(string));
}

function test_stripScripts() {
  const strings = {
    "<script>alert('hey')</script>": "",
    "<p onclick=\"alert('hey')\">foo</p>": "<p>foo</p>",
    "<p onmouseover=\"alert('hey')\">foo</p>": "<p>foo</p>"
  };
  for each (let [input, expectedOutput] in Iterator(strings))
    do_check_eq(expectedOutput, cleanupImMarkup(input));
}

function test_links() {
  // http, https, ftp and mailto links should be preserved.
  const ok = [
    "http://example.com/",
    "https://example.com/",
    "ftp://example.com/",
    "mailto:foo@example.com"
  ];
  for each (let string in ok) {
    string = "<a href=\"" + string + "\">foo</a>";
    do_check_eq(string, cleanupImMarkup(string));
  }

  // other links should be removed
  const bad = [
    "chrome://global/content/",
    "about:",
    "about:blank",
    "foo://bar/",
    ""
  ];
  for each (let string in bad) {
    do_check_eq("<a>foo</a>",
                cleanupImMarkup("<a href=\"" + string + "\">foo</a>"));
  }

  // keep link titles
  let string = "<a title=\"foo bar\">foo</a>";
  do_check_eq(string, cleanupImMarkup(string));
}

function test_allModes() {
  test_plainText();
  test_paragraphs();
  test_stripScripts();
  test_links();
  // Remove random classes.
  do_check_eq("<p>foo</p>", cleanupImMarkup("<p class=\"foobar\">foo</p>"));
}

function test_strictMode() {
  Services.prefs.setIntPref(kModePref, kStrictMode);
  test_allModes();

  // check that basic formatting is stipped in strict mode.
  for each (let tag in ["div", "em", "strong", "b", "i", "u", "span", "code",
                        "ul", "li", "ol", "cite", "blockquote"])
    do_check_eq("foo", cleanupImMarkup("<" + tag + ">foo</" + tag + ">"));

  // check that font settings are removed.
  do_check_eq("foo",
              cleanupImMarkup("<font face=\"Times\" color=\"pink\">foo</font>"));
  do_check_eq("<p>foo</p>",
              cleanupImMarkup("<p style=\"font-weight: bold;\">foo</p>"));

  // Discard hr
  do_check_eq("foobar", cleanupImMarkup("foo<hr>bar"));

  run_next_test();
}

function test_standardMode() {
  Services.prefs.setIntPref(kModePref, kStandardMode);
  test_allModes();

  // check that basic formatting is kept in standard mode.
  for each (let tag in ["div", "em", "strong", "b", "i", "u", "span", "code",
                        "ul", "li", "ol", "cite", "blockquote"]) {
    let string = "<" + tag + ">foo</" + tag + ">";
    do_check_eq(string, cleanupImMarkup(string));
  }

  // Keep special allowed classes.
  for each (let className in ["moz-txt-underscore", "moz-txt-tag"]) {
    let string = "<span class=\"" + className + "\">foo</span>";
    do_check_eq(string, cleanupImMarkup(string));
  }

  // Remove font settings
  let string = "<font face=\"Times\" color=\"pink\" size=\"3\">foo</font>";
  do_check_eq("foo", cleanupImMarkup(string));

  // Discard hr
  do_check_eq("foobar", cleanupImMarkup("foo<hr>bar"));

  const okCSS = [
    "font-style: italic",
    "font-weight: bold"
  ];
  for each (let css in okCSS) {
    let string = "<span style=\"" + css + "\">foo</span>";
    do_check_eq(string, cleanupImMarkup(string));
  }
  // text-decoration is a shorthand for several -moz-text-decoration properties.
  do_check_eq("<span style=\"-moz-text-decoration-line: underline;\">foo</span>",
              cleanupImMarkup("<span style=\"text-decoration: underline\">foo</span>"));

  const badCSS = [
    "color: pink;",
    "font-family: Times",
    "font-size: larger",
    "-moz-binding: url('chrome://global/content/bindings/textbox.xml#textbox');",
    "display: none",
    "visibility: hidden"
  ];
  for each (let css in badCSS) {
    do_check_eq("<span style=\"\">foo</span>",
                cleanupImMarkup("<span style=\"" + css + "\">foo</span>"));
  }
  // The shorthand 'font' is decomposed to non-shorthand properties,
  // and not recomposed as some non-shorthand properties are filtered out.
  do_check_eq("<span style=\"font-style: normal; font-weight: normal;\">foo</span>",
              cleanupImMarkup("<span style=\"font: 15px normal\">foo</span>"));

  run_next_test();
}

function test_permissiveMode() {
  Services.prefs.setIntPref(kModePref, kPermissiveMode);
  test_allModes();

  // Check that all formatting is kept in permissive mode.
  for each (let tag in ["div", "em", "strong", "b", "i", "u", "span", "code",
                        "ul", "li", "ol", "cite", "blockquote"]) {
    let string = "<" + tag + ">foo</" + tag + ">";
    do_check_eq(string, cleanupImMarkup(string));
  }

  // Keep special allowed classes.
  for each (let className in ["moz-txt-underscore", "moz-txt-tag"]) {
    let string = "<span class=\"" + className + "\">foo</span>";
    do_check_eq(string, cleanupImMarkup(string));
  }

  // Keep font settings
  const fontAttributes = [
    "face=\"Times\"",
    "color=\"pink\"",
    "size=\"3\""
  ];
  for each (let fontAttribute in fontAttributes) {
    let string = "<font " + fontAttribute + ">foo</font>";
    do_check_eq(string, cleanupImMarkup(string));
  }

  // Allow hr
  let string = "foo<hr>bar";
  do_check_eq(string, cleanupImMarkup(string));

  // Allow most CSS rules changing the text appearance.
  const okCSS = [
    "font-style: italic",
    "font-weight: bold",
    "text-decoration: underline",
    "color: pink;",
    "font-family: Times",
    "font-size: larger"
  ];
  for each (let css in okCSS) {
    let string = "<span style=\"" + css + "\">foo</span>";
    do_check_eq(string, cleanupImMarkup(string));
  }
  // The shorthand 'font' is decomposed to non-shorthand properties,
  // and not recomposed as some non-shorthand properties are filtered out.
  do_check_eq("<span style=\"font-family: normal; font-style: normal;" +
              " font-weight: normal; font-size: 15px;\">foo</span>",
              cleanupImMarkup("<span style=\"font: 15px normal\">foo</span>"));

  // But still filter out dangerous CSS rules.
  const badCSS = [
    "-moz-binding: url('chrome://global/content/bindings/textbox.xml#textbox');",
    "display: none",
    "visibility: hidden"
  ];
  for each (let css in badCSS) {
    do_check_eq("<span style=\"\">foo</span>",
                cleanupImMarkup("<span style=\"" + css + "\">foo</span>"));
  }

  run_next_test();
}

function test_addGlobalAllowedTag() {
  Services.prefs.setIntPref(kModePref, kStrictMode);

  // Check that <hr> isn't allowed by default in strict mode.
  // Note: we use <hr> instead of <img> to avoid mailnews' content policy
  // messing things up.
  do_check_eq("", cleanupImMarkup("<hr>"));

  // Allow <hr> without attributes.
  addGlobalAllowedTag("hr");
  do_check_eq("<hr>", cleanupImMarkup("<hr>"));
  do_check_eq("<hr>", cleanupImMarkup("<hr src=\"http://example.com/\">"));
  removeGlobalAllowedTag("hr");

  // Allow <hr> with an unfiltered src attribute.
  addGlobalAllowedTag("hr", {src: true});
  do_check_eq("<hr>", cleanupImMarkup("<hr alt=\"foo\">"));
  do_check_eq("<hr src=\"http://example.com/\">",
              cleanupImMarkup("<hr src=\"http://example.com/\">"));
  do_check_eq("<hr src=\"chrome://global/skin/img.png\">",
              cleanupImMarkup("<hr src=\"chrome://global/skin/img.png\">"));
  removeGlobalAllowedTag("hr");

  // Allow <hr> with an src attribute taking only http(s) urls.
  addGlobalAllowedTag("hr", {src: function(aValue) /^https?:/.test(aValue)});
  do_check_eq("<hr src=\"http://example.com/\">",
              cleanupImMarkup("<hr src=\"http://example.com/\">"));
  do_check_eq("<hr>",
              cleanupImMarkup("<hr src=\"chrome://global/skin/img.png\">"));
  removeGlobalAllowedTag("hr");

  run_next_test();
}

function test_addGlobalAllowedAttribute() {
  Services.prefs.setIntPref(kModePref, kStrictMode);

  // Check that id isn't allowed by default in strict mode.
  do_check_eq("<br>", cleanupImMarkup("<br id=\"foo\">"));

  // Allow id unconditionally.
  addGlobalAllowedAttribute("id");
  do_check_eq("<br id=\"foo\">", cleanupImMarkup("<br id=\"foo\">"));
  removeGlobalAllowedAttribute("id");

  // Allow id only with numbers.
  addGlobalAllowedAttribute("id", function(aId) /^\d+$/.test(aId));
  do_check_eq("<br id=\"123\">", cleanupImMarkup("<br id=\"123\">"));
  do_check_eq("<br>", cleanupImMarkup("<br id=\"foo\">"));
  removeGlobalAllowedAttribute("id");

  run_next_test();
}

function test_addGlobalAllowedStyleRule() {
  // We need at least the standard mode to have the style attribute allowed.
  Services.prefs.setIntPref(kModePref, kStandardMode);

  // Check that clear isn't allowed by default in strict mode.
  do_check_eq("<br style=\"\">", cleanupImMarkup("<br style=\"clear: both;\">"));

  // Allow clear.
  addGlobalAllowedStyleRule("clear");
  do_check_eq("<br style=\"clear: both;\">",
              cleanupImMarkup("<br style=\"clear: both;\">"));
  removeGlobalAllowedStyleRule("clear");

  run_next_test();
}

function test_createDerivedRuleset() {
  Services.prefs.setIntPref(kModePref, kStandardMode);

  let rules = createDerivedRuleset();

  let string = "<hr>";
  do_check_eq("", cleanupImMarkup(string));
  do_check_eq("", cleanupImMarkup(string, rules));
  rules.tags["hr"] = true;
  do_check_eq(string, cleanupImMarkup(string, rules));

  string = "<br id=\"123\">";
  do_check_eq("<br>", cleanupImMarkup(string));
  do_check_eq("<br>", cleanupImMarkup(string, rules));
  rules.attrs["id"] = true;
  do_check_eq(string, cleanupImMarkup(string, rules));

  string = "<br style=\"clear: both;\">";
  do_check_eq("<br style=\"\">", cleanupImMarkup(string));
  do_check_eq("<br style=\"\">", cleanupImMarkup(string, rules));
  rules.styles["clear"] = true;
  do_check_eq(string, cleanupImMarkup(string, rules));

  run_next_test();
}
