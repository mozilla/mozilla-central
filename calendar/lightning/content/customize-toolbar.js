/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * David Hyatt.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Hyatt (hyatt@apple.com)
 *   Blake Ross (blaker@netscape.com)
 *   Joe Hewitt (hewitt@netscape.com)
 *   Michael Buettner <michael.buettner@sun.com>
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
 * Global variables in addition to those specified in
 * mail/base/content/customizeToolbar.js
 */
var gPreviousLocation = null;
var gRepositionOnce = false;
var gIsMainApplicationContext = (window.arguments[3] != null);

/**
 * Since we want to 'inherit' several global functions
 * we retrieve the current values in order to call them
 * from their overriden version.
 */
var gOnLoad = onLoad;
var gInitDialog = initDialog;
var gOnCancel = onCancel;

/**
 * initDialog() gets called from the load handler and
 * is responsible for initializing global variables, etc.
 */
initDialog = function() {

    // Don't do any extra processing in case we're not
    // customizing one of the main application toolbars.
    // The customize toolbar dialog contains special features
    // that don't apply in that case (location drop down, etc.).
    if (gIsMainApplicationContext) {

        // remember initial toolbar location and set the
        // menulist accordingly. this applies to the mode toolbar only.
        gPreviousLocation = gToolbox.getAttribute("location");
        document.getElementById("location-list").value = gPreviousLocation;

        // set the toolbar selection according to the current mode.
        // this list allows to hop from one toolbar to another without
        // leaving the customize dialog. if this feature is to be used outside
        // of mail/news main application window, we detect this case and disable
        // all relevant controls and stuff.
        var selectorList = document.getElementById("selector-list");
        selectorList.value = window.arguments[3];
        if (selectorList.selectedItem.value != window.arguments[3]) {
            document.getElementById("selector-container").collapsed = true;
        }
    }

    // now call the original initDialog() function
    gInitDialog();
}

/**
 * onCancel() is called if the customize toolbar dialog has been canceled.
 * we're returning to the previous state and discarding any changes made
 * to the current toolbar. please note that this applies to the current toolbar
 * only. in case we've been switched from one to another, only the changes
 * made to the most recent toolbar will be discarded.
 */
onCancel = function() {

    // Don't do any extra processing in case we're not
    // customizing one of the main application toolbars.
    // The customize toolbar dialog contains special features
    // that don't apply in that case (location drop down, etc.).
    if (gIsMainApplicationContext) {
        updateToolbarLocation(gPreviousLocation);
    }

    gOnCancel();
}

/**
 * repositionDialog() to find a good position for the customize dialog.
 * it is called during initialization and subsequently if any option has been
 * altered that causes the toolbar to change size or location. we need to
 * override this function to add the ability to set the position *above*
 * the toolbar in question, since this is necessary for the mode toolbar
 * which is set at the lower left of the application window by default.
 */
_repositionDialog = function() {
 
  // Christian said it's better to not make the dialog jump...
  if (gRepositionOnce)
    return;
  gRepositionOnce = true;
    
  // Position the dialog touching the bottom of the toolbox and centered with 
  // it. We must resize the window smaller first so that it is positioned properly. 
  var screenX = gToolbox.boxObject.screenX + ((gToolbox.boxObject.width - kWindowWidth) / 2);
  var screenY = gToolbox.boxObject.screenY + gToolbox.boxObject.height;

  var newHeight = kWindowHeight;
  if (newHeight >= screen.availHeight - screenY - kVSizeSlop) {
    // the customize window doesn't fit below the toolbar. first try if there's
    // enough space at the top of the toolbar. if neither works, shrink the height.
    if(gToolbox.boxObject.screenY - newHeight - kVSizeSlop < 0) {
      newHeight = screen.availHeight - screenY - kVSizeSlop;
    } else {
      screenY = gToolbox.boxObject.screenY - newHeight;
    }
  }
  
  if(screenX < 0) {
    screenX = 0;
  }
  
  window.resizeTo(kWindowWidth, newHeight);
  window.moveTo(screenX, screenY);
}

/**
 * onLoad() is called by the load event handler. we need to override
 * this function to initialize the newly introduced controls.
 */
onLoad = function() {

    // remove the box containing all the relevant controls from
    // the dom tree, we bring a new one to the table. this is necessary
    // since those controls don't specify id's, so we need to override
    // all of them.
    var mainbox = document.getElementById("main-box");
    var controlbox = document.getElementById("control-box");
    mainbox.removeChild(controlbox.nextSibling);

    // Don't do any extra processing in case we're not
    // customizing one of the main application toolbars.
    // The customize toolbar dialog contains special features
    // that don't apply in that case (location drop down, etc.).
    if (gIsMainApplicationContext) {

        document.getElementById("selector-container")
            .removeAttribute("collapsed");

        // show the location option (place toolbar at top or bottom)
        // if this feature has been requested.
        updateLocationVisibility(window.arguments[3] == 'mode');
    }

    // now call the default implementation of the load handler, since
    // this retrieves the toolbox element from the arguments.
    gOnLoad();
}

/**
 * updateToolbarLocation() is called to handle a new location for
 * the toolbar (top or bottom). basically, we just set the appropriate
 * attribute on all customizable toolbars and rely on them intercepting
 * this modification and act accordingly.
 */
_updateToolbarLocation = function(aLocation) {

  // since the current toolbar will change its location in
  // the dom tree (most probably), we need to unwrap the toolbar items
  // and reset anything that could get in the way.
  removeToolboxListeners();
  unwrapToolbarItems(false);

  var toolboxId = gToolbox.id;

  // set the new location on the toolbox...
  setAttribute(gToolbox, "location", aLocation);
  gToolboxDocument.persist(gToolbox.id, "location");
  
  // ...and each customizable toolbar
  for (var i = 0; i < gToolbox.childNodes.length; ++i) {
    var toolbar = getToolbarAt(i);
    if (isCustomizableToolbar(toolbar)) {
      setAttribute(toolbar, "location", aLocation);
      gToolboxDocument.persist(toolbar.id, "location");
    }
  }

  gToolbox = gToolboxDocument.getElementById(toolboxId);
  gToolboxDocument = gToolbox.ownerDocument;
  
  gToolbox.addEventListener("draggesture", onToolbarDragGesture, false);
  gToolbox.addEventListener("dragover", onToolbarDragOver, false);
  gToolbox.addEventListener("dragexit", onToolbarDragExit, false);
  gToolbox.addEventListener("dragdrop", onToolbarDragDrop, false);

  // Now re-wrap the items on the toolbar, but don't clobber previousset.
  wrapToolbarItems(false);
}

/**
 * Handler that takes care of a new toolbar being selected for customization.
 */
_updateToolbarSelection = function(aSelection) {

  var callback = window.arguments[2];
  if(callback) {

    // first of all, we need to remove our listeners and unwrap
    // the toolbar items. this is important to do first, before calling
    // the outside world, since they possibly want to change those items...
    removeToolboxListeners();
    unwrapToolbarItems(true);
    
    // persist the current set of buttons in all
    // customizable toolbars to localstore.    
    persistCurrentSets();

    // execute the supplied callback function. we expect to receive
    // the toolbox we're supposed to customize as a result.
    var toolbox = callback(aSelection);

    // store some internal states in the window arguments
    // since we're going to call initDialog() again...
    window.arguments[0] = toolbox;
    window.arguments[3] = aSelection;

    // show or hide the location menu dependend
    // on the toolbar we're switching to.
    updateLocationVisibility(aSelection == 'mode');

    // nothing has changed so far...
    gToolboxChanged = false;

    // now just call the default load handler in order to
    // initialize the dialog for a fresh start.
    gOnLoad();
  }
}

/**
 * Show or hide the location selection, this option shouldn't be always visible
 */
_updateLocationVisibility = function(aShow) {

  var controls = document.getElementsByAttribute("location-option", "true");
  for (var i=0;i<controls.length;i++) {
    if (aShow) {
      controls[i].removeAttribute("collapsed");
    } else {
      controls[i].setAttribute("collapsed","true");
    }  
  }
}

/**
 * Builds the palette of draggable items that are not yet in a toolbar.
 */
_buildPalette = function() {

  // Empty the palette first.
  var paletteBox = document.getElementById("palette-box");
  while (paletteBox.lastChild)
    paletteBox.removeChild(paletteBox.lastChild);

  var currentRow = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
                                            "hbox");
  currentRow.setAttribute("class", "paletteRow");

  // Add the toolbar separator item.
  var templateNode = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
                                              "toolbarseparator");
  templateNode.id = "separator";
  wrapPaletteItem(templateNode, currentRow, null);

  // Add the toolbar spring item.
  templateNode = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
                                              "toolbarspring");
  templateNode.id = "spring";
  templateNode.flex = 1;
  wrapPaletteItem(templateNode, currentRow, null);

  // Add the toolbar spacer item.
  templateNode = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
                                              "toolbarspacer");
  templateNode.id = "spacer";
  templateNode.flex = 1;
  wrapPaletteItem(templateNode, currentRow, null);

  var rowSlot = 3;

  var currentItems = getCurrentItemIds();
  templateNode = gToolbox.palette.firstChild;
  while (templateNode) {
    // Check if the item is already in a toolbar before adding it to the palette.
    if (!(templateNode.id in currentItems)) {

      var nodeMode = templateNode.getAttribute('mode');
      if (!nodeMode)
        nodeMode = 'mail';

      if (nodeMode == window.arguments[3]) {

        var paletteItem = templateNode.cloneNode(true);

        if (rowSlot == kRowMax) {
          // Append the old row.
          paletteBox.appendChild(currentRow);

          // Make a new row.
          currentRow = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
                                                "hbox");
          currentRow.setAttribute("class", "paletteRow");
          rowSlot = 0;
        }

        ++rowSlot;
        wrapPaletteItem(paletteItem, currentRow, null);
      }
    }
    
    templateNode = templateNode.nextSibling;
  }

  if (currentRow) { 
    fillRowWithFlex(currentRow);
    paletteBox.appendChild(currentRow);
  }
}

if (gIsMainApplicationContext) {
    repositionDialog = _repositionDialog;
    updateToolbarLocation = _updateToolbarLocation;
    updateToolbarSelection = _updateToolbarSelection;
    updateLocationVisibility = _updateLocationVisibility;
    buildPalette = _buildPalette;
}
