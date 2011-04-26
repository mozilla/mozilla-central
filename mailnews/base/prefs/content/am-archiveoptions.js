/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Mozilla Mail Code.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var gIdentity = null;

/**
 * Load the archive options dialog, set the radio/checkbox items to the
 * appropriate values, and update the archive hierarchy example.
 */
function onLoadArchiveOptions() {
  // extract the account
  gIdentity = window.arguments[0];

  let granularity = document.getElementById("archiveGranularity");
  granularity.selectedIndex = gIdentity.archiveGranularity;
  granularity.addEventListener("command", updateArchiveExample, false);

  let kfs = document.getElementById("archiveKeepFolderStructure");
  kfs.checked = gIdentity.archiveKeepFolderStructure;
  kfs.addEventListener("command", updateArchiveExample, false);

  updateArchiveExample();
}

/**
 * Save the archive settings to the current identity.
 */
function onAcceptArchiveOptions() {
  gIdentity.archiveGranularity =
    document.getElementById("archiveGranularity").selectedIndex;
  gIdentity.archiveKeepFolderStructure =
    document.getElementById("archiveKeepFolderStructure").checked;
}

/**
 * Update the example tree to show what the current options would look like.
 */
function updateArchiveExample() {
  let granularity = document.getElementById("archiveGranularity").selectedIndex;
  let kfs = document.getElementById("archiveKeepFolderStructure").checked;
  let hierarchy = [ document.getElementsByClassName("root"),
                    document.getElementsByClassName("year"),
                    document.getElementsByClassName("month") ];

  // First, show/hide the appropriate levels in the hierarchy and turn the
  // necessary items into containers.
  for (let i = 0; i < hierarchy.length; i++) {
    for (let j = 0; j < hierarchy[i].length; j++) {
      hierarchy[i][j].setAttribute("container", granularity > i);
      hierarchy[i][j].setAttribute("open", granularity > i);
      hierarchy[i][j].hidden = granularity < i;
    }
  }

  // Next, handle the "keep folder structures" case by moving a tree item around
  // and making sure its parent is a container.
  let folders = document.getElementById("folders");
  folders.hidden = !kfs;
  if (kfs) {
    let parent = hierarchy[granularity][0];
    parent.setAttribute("container", true);
    parent.setAttribute("open", true);

    let treechildren = parent.children[1];
    treechildren.appendChild(folders);
  }
}
