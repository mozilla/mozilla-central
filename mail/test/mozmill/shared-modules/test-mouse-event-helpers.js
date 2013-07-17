/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "mouse-event-helpers";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var EventUtils = {};
Cu.import('resource://mozmill/stdlib/EventUtils.js', EventUtils);

var fdh;

function setupModule() {
  fdh = collector.getModule('folder-display-helpers');
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.drag_n_drop_element = drag_n_drop_element;
  module.synthesize_drag_start = synthesize_drag_start;
  module.synthesize_drag_over = synthesize_drag_over;
  module.synthesize_drag_end = synthesize_drag_end;
  module.synthesize_drop = synthesize_drop;
}

/**
 * Execute a drag and drop session.
 * @param {XULElement} aDragObject
 *   the element from which the drag session should be started.
 * @param {} aDragWindow
 *   the window the aDragObject is in
 * @param {XULElement} aDropObject
 *   the element at which the drag session should be ended.
 * @param {} aDropWindow
 *   the window the aDropObject is in
 * @param {} aRelDropX
 *   the relative x-position the element is dropped over the aDropObject
 *   in percent of the aDropObject width
 * @param {} aRelDropY
 *   the relative y-position the element is dropped over the aDropObject
 *   in percent of the aDropObject height
 * @param {XULElement} aListener
 *   the element who's drop target should be captured and returned.
 */
function drag_n_drop_element(aDragObject, aDragWindow, aDropObject,
                             aDropWindow, aRelDropX, aRelDropY, aListener)
{
  let dt = synthesize_drag_start(aDragWindow, aDragObject, aListener);
  fdh.assert_true(dt, "Drag target was undefined");

  synthesize_drag_over(aDropWindow, aDropObject, dt);

  synthesize_drop(aDropWindow, aDropObject, dt,
      { screenX : aDropObject.boxObject.screenX +
                    (aDropObject.boxObject.width * aRelDropX),
        screenY : aDropObject.boxObject.screenY +
                    (aDropObject.boxObject.width * aRelDropY)
      });
}

/**
 * Starts a drag new session.
 * @param {} aWindow
 * @param {XULElement} aDispatcher
 *   the element from which the drag session should be started.
 * @param {XULElement} aListener
 *   the element who's drop target should be captured and returned.
 * @return {nsIDataTransfer}
 *   returns the DataTransfer Object of captured by aListener.
 */
function synthesize_drag_start(aWindow, aDispatcher, aListener)
{
  let dt;

  let trapDrag = function(event) {

    if (!event.dataTransfer)
      throw "no DataTransfer";

    dt = event.dataTransfer;

    event.preventDefault();
  };

  aListener.addEventListener("dragstart", trapDrag, true);

  EventUtils.synthesizeMouse(aDispatcher, 5, 5, {type:"mousedown"}, aWindow);
  EventUtils.synthesizeMouse(aDispatcher, 5, 10, {type:"mousemove"}, aWindow);
  EventUtils.synthesizeMouse(aDispatcher, 5, 15, {type:"mousemove"}, aWindow);

  aListener.removeEventListener("dragstart", trapDrag, true);

  return dt;
}

/**
 * Synthesizes a drag over event.
 * @param {} aWindow
 * @param {XULElement} aDispatcher
 *   the element from which the drag session should be started.
 * @param {nsIDataTransfer} aDt
 *   the DataTransfer Object of captured by listener.
 * @param {} aArgs
 *   arguments passed to the mouse event.
 */
function synthesize_drag_over(aWindow, aDispatcher, aDt, aArgs)
{
  _synthesizeDragEvent("dragover", aWindow, aDispatcher, aDt, aArgs);
}

/**
 * Synthesizes a drag end event.
 * @param {} aWindow
 * @param {XULElement} aDispatcher
 *   the element from which the drag session should be started.
 * @param {nsIDataTransfer} aDt
 *   the DataTransfer Object of captured by listener.
 * @param {} aArgs
 *   arguments passed to the mouse event.
 */
function synthesize_drag_end(aWindow, aDispatcher, aListener, aDt, aArgs)
{
  _synthesizeDragEvent("dragend", aWindow, aListener, aDt, aArgs);

  //Ensure drag has ended.
  EventUtils.synthesizeMouse(aDispatcher, 5, 5, {type:"mousemove"}, aWindow);
  EventUtils.synthesizeMouse(aDispatcher, 5, 10, {type:"mousemove"}, aWindow);
  EventUtils.synthesizeMouse(aDispatcher, 5, 5, {type:"mouseup"}, aWindow);
}

/**
 * Synthesizes a drop event.
 * @param {} aWindow
 * @param {XULElement} aDispatcher
 *   the element from which the drag session should be started.
 * @param {nsIDataTransfer} aDt
 *   the DataTransfer Object of captured by listener.
 * @param {} aArgs
 *   arguments passed to the mouse event.
 */
function synthesize_drop(aWindow, aDispatcher, aDt, aArgs)
{
  _synthesizeDragEvent("drop", aWindow, aDispatcher, aDt, aArgs);

  // Ensure drag has ended.
  EventUtils.synthesizeMouse(aDispatcher, 5, 5, {type:"mousemove"}, aWindow);
  EventUtils.synthesizeMouse(aDispatcher, 5, 10, {type:"mousemove"}, aWindow);
  EventUtils.synthesizeMouse(aDispatcher, 5, 5, {type:"mouseup"}, aWindow);
}

/**
 * Private function: Synthesizes a specified drag event.
 * @param {} aType
 *   the type of the drag event to be synthesiyzed.
 * @param {} aWindow
 * @param {XULElement} aDispatcher
 *   the element from which the drag session should be started.
 * @param {nsIDataTransfer} aDt
 *   the DataTransfer Object of captured by listener.
 * @param {} aArgs
 *   arguments passed to the mouse event.
 */
function _synthesizeDragEvent(aType, aWindow, aDispatcher, aDt, aArgs)
{
  let screenX;
  if (aArgs && ("screenX" in aArgs))
    screenX = aArgs.screenX;
  else
    screenX = aDispatcher.boxObject.ScreenX;

  let screenY;
  if (aArgs && ("screenY" in aArgs))
    screenY = aArgs.screenY;
  else
    screenY = aDispatcher.boxObject.ScreenY;

  let event = aWindow.document.createEvent("DragEvents");
  event.initDragEvent(aType, true, true, aWindow, 0,
      screenX, screenY, 0, 0, false, false, false, false, 0, null, aDt);
  aDispatcher.dispatchEvent(event);
}
