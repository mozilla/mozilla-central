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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

var lightningCommandController = {

    commands: {
        "lightning_delete_item_command": true,
        "lightning_modify_item_command": true
    },

    updateCommands: function lCC_updateCommands() {
        // Update commands. This function does not use |this|, so it can be used
        // for an event listener.
        for (var command in lightningCommandController.commands) {
            goUpdateCommand(command);
        }
    },

    supportsCommand: function lCC_supportsCommand(aCommand) {
        return (aCommand in this.commands);
    },

    isCommandEnabled: function lCC_isCommandEnabled(aCommand) {
        switch (aCommand) {
            case "lightning_delete_item_command":
                return this.callFunctionByMode(calendarController.isCommandEnabled,
                                               "calendar_delete_todo_command",
                                               "calendar_delete_event_command");
            case "lightning_modify_item_command":
                return this.callFunctionByMode(calendarController.isCommandEnabled,
                                               "calendar_modify_todo_command",
                                               "calendar_modify_event_command");
        }
        return false;
    },

    doCommand: function lCC_doCommand(aCommand) {
        switch (aCommand) {
            // In Lightning, the delete item command either deletes an event or
            // a todo, depending on if we are in calendar or task mode.
            case "lightning_delete_item_command":
                this.callFunctionByMode(calendarController.doCommand,
                                        "calendar_delete_todo_command",
                                        "calendar_delete_event_command");
                break;
            case "lightning_modify_item_command":
                this.callFunctionByMode(calendarController.doCommand,
                                        "calendar_modify_todo_command",
                                        "calendar_modify_event_command");
                break;
        }
    },

    /**
     * Helper function to call a function of the calendarController with an
     * argument which depends on if task or calendar mode is enabled.
     */
    callFunctionByMode: function lCC_callFunctionByMode(aFunc, aTaskModeArg, aCalendarModeArg) {
        if (gCurrentMode == "task") {
            return aFunc.call(calendarController, aTaskModeArg);
        } else if (gCurrentMode == "calendar") {
            return aFunc.call(calendarController, aCalendarModeArg);
        }
        return null;
    }
};

function injectLightningController() {
    // The order of this command controller is not important.
    top.controllers.insertControllerAt(0, lightningCommandController);
    document.commandDispatcher.updateCommands("calendar_commands");

    // In addition to whatever the base command controller does on an update, we
    // need to update lightning commands.
    document.getElementById("calendar_commands")
            .addEventListener("commandupdate",
                              lightningCommandController.updateCommands,
                              false);
}

function finishLightningController() {
    document.getElementById("calendar_commands")
            .removeEventListener("commandupdate",
                                 lightningCommandController.updateCommands,
                                 false);
}

window.addEventListener("load", injectLightningController, false);
window.addEventListener("unload", finishLightningController, false);
