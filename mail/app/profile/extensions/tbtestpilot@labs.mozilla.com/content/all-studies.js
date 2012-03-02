/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Test Pilot.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jono X <jono@mozilla.com>
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

// for the HTML version

function _sortNewestFirst(experiments) {
    experiments.sort(
      function sortFunc(a, b) {
        if (a.endDate && b.endDate) {
          return b.endDate - a.endDate;
        }
        if (a.publishDate && b.publishDate) {
          if (isNaN(a.publishDate) || isNaN(b.publishDate)) {
            return 0;
          }
          return b.publishDate - a.publishDate;
        }
        return 0;
      });
    return experiments;
}


function fillAllStudiesPage() {
  Components.utils.import("resource://testpilot/modules/Observers.js");
  Components.utils.import("resource://testpilot/modules/setup.js");
  Components.utils.import("resource://testpilot/modules/tasks.js");
  //this._stringBundle = document.getElementById("testpilot-stringbundle");


  // Are we done loading tasks?
  if (!TestPilotSetup.startupComplete || TestPilotSetup.getAllTasks().length == 0) {
    // If you opened the window before tasks are done loading, exit now
    // but try again in a few seconds.
    window.setTimeout(fillAllStudiesPage, 2000);
    return;
  }

  // hide the 'loading' msg
  window.document.getElementById("still-loading-msg").innerHTML = "";

  // clear the table
  let table = window.document.getElementById("studies-list");
  table.innerHTML = "";

  let experiments = _sortNewestFirst(TestPilotSetup.getAllTasks());

  for (let i = 0; i < experiments.length; i++) {
    let task = experiments[i];
    let newRow = document.createElement("tr");

    let newCell = document.createElement("td");
    newCell.textContent = task.title;
    newRow.appendChild(newCell);
    newCell = document.createElement("td");
    newCell.textContent = task.summary;
    newRow.appendChild(newCell);

    let link = document.createElement("a");
    link.setAttribute("href", task.defaultUrl);
    link.textContent = "More Info";

    newCell = document.createElement("td");
    newCell.appendChild(link);
    newRow.appendChild(newCell);

    table.appendChild(newRow);
  }
}
