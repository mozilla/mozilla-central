/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jonathan Protzenko <jonathan.protzenko@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
