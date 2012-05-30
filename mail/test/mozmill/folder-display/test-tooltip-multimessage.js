/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This just tests that tooltips work properly in the multimessage <browser>
 */

var MODULE_NAME = 'test-tooltip-multimessage';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers'];

var folder;

var setupModule = function(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  folder = create_folder("Test");
  thread1 = create_thread(10);
  add_sets_to_folders([folder], [thread1]);
};

function test_tooltips() {
  /* Trigger the message summary. This is needed otherwise we cannot compute the
   * style of aHTMLTooltip in mailWindow.js
   */
  be_in_folder(folder);
  select_click_row(0);
  make_display_threaded();
  toggle_thread_row(0);

  /* Get the needed elements */
  let mm = mc.eid("multimessage").node;
  let mmDoc = mm.contentDocument;
  let tooltip = mc.eid("aHTMLTooltip").node;

  /* Test a XUL element */
  let trashButton = mmDoc.getElementsByClassName("hdrTrashButton")[0];
  trashButton.setAttribute("title", "Title1");
  trashButton.setAttribute("tooltiptext", "TTT1");
  mc.window.FillInHTMLTooltip(trashButton);
  assert_equals(tooltip.getAttribute("label"), "TTT1", "This XUL element had its title taken as the tooltip instead of the tooltiptext attribute.");
  
  /* Test an HTML element */
  let a = mmDoc.createElement("a");
  a.setAttribute("href", "#");
  a.setAttribute("title", "Title2");
  a.setAttribute("tooltiptext", "TTT2");
  mc.window.FillInHTMLTooltip(a);
  assert_equals(tooltip.getAttribute("label"), "Title2", "This HTML element had its tooltiptext taken as the tooltip instead of the title attribute.");

  /* Create an element with xlink */
  let div = mmDoc.createElement("div");
  div.innerHTML = '<span xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0">'+
    '<a href="#" title="Title3" xlink:title="XTitle3" tooltiptext="TTT3">Hi there</a>'+
    '</span>';
  let xlink = div.getElementsByTagName("a")[0];
  mc.window.FillInHTMLTooltip(xlink);
  assert_equals(tooltip.getAttribute("label"), "XTitle3", "This HTML element had its something else taken as the tooltip instead of the xlink:title attribute.");
}
