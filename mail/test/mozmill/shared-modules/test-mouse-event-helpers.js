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
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
 *   Joachim Herb <Joachim.Herb@gmx.de>
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var EventUtils = {};
Cu.import('resource://mozmill/stdlib/EventUtils.js', EventUtils);

const MODULE_NAME = 'mouse-event-helpers';


function setupModule() {
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
    screenX = aDispatcher.boxObject.ScreenX;;

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
