/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
