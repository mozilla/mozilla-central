/* vim:set ts=2 sw=2 sts=2 et: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// Make sure that JS eval result are properly formatted as strings.

const TEST_URI = "http://example.com/browser/browser/devtools/webconsole/test/browser/test-result-format-as-string.html";

function test()
{
  waitForExplicitFinish();

  addTab(TEST_URI);

  gBrowser.selectedBrowser.addEventListener("load", function onLoad() {
    gBrowser.selectedBrowser.removeEventListener("load", onLoad, true);
    performTest();
  }, true);
}

function performTest()
{
  openConsole();
  let hudId = HUDService.getHudIdByWindow(content);
  let hud = HUDService.getHudReferenceById(hudId);
  hud.jsterm.execute("document.querySelector('p')");
  is(hud.outputNode.textContent.indexOf("bug772506_content"), -1,
        "no content element found");
  ok(!hud.outputNode.querySelector("div"), "no div element found");
  let msg = hud.outputNode.querySelector(".webconsole-msg-output");
  ok(msg, "eval output node found");
  isnot(msg.textContent.indexOf("HTMLDivElement"), -1,
        "HTMLDivElement string found");
  EventUtils.synthesizeMouseAtCenter(msg, {type: "mousemove"});
  ok(!gBrowser._bug772506, "no content variable");
  finishTest();
}
