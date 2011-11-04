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
 * The Original Code is Lightning code.
 *
 * The Initial Developer of the Original Code is Simdesk Technologies Inc.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Clint Talbert <ctalbert.moz@gmail.com>
 *   Matthew Willis <lilmatt@mozilla.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
 *   Simon Vaillancourt <simon.at.orcl@gmail.com>
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calItipUtils.jsm");

/**
 * This bar lives inside the message window.
 * Its lifetime is the lifetime of the main thunderbird message window.
 */
var ltnImipBar = {

    actionFunc: null,
    itipItem: null,
    foundItems: null,

    /**
     * Thunderbird Message listener interface, hide the bar before we begin
     */
    onStartHeaders: function onImipStartHeaders() {
      ltnImipBar.hideBar();
    },

    /**
     * Thunderbird Message listener interface
     */
    onEndHeaders: function onImipEndHeaders() {

    },

    /**
     * Load Handler called to initialize the imip bar
     */
    load: function ltnImipOnLoad() {
        // Add a listener to gMessageListeners defined in msgHdrViewOverlay.js
        gMessageListeners.push(ltnImipBar);

        // We need to extend the HideMessageHeaderPane function to also hide the
        // message header pane. Otherwise, the imip bar will still be shown when
        // changing folders.
        ltnImipBar.tbHideMessageHeaderPane = HideMessageHeaderPane;
        HideMessageHeaderPane = function ltnHideMessageHeaderPane() {
            ltnImipBar.hideBar();
            ltnImipBar.tbHideMessageHeaderPane.apply(null, arguments);
        };

        // Set up our observers
        Services.obs.addObserver(ltnImipBar, "onItipItemCreation", false);
    },

    /**
     * Unload handler to clean up after the imip bar
     */
    unload: function ltnImipOnUnload() {
        removeEventListener("messagepane-loaded", ltnImipBar.load, true);
        removeEventListener("messagepane-unloaded", ltnImipBar.unload, true);

        ltnImipBar.itipItem = null;
        Services.obs.removeObserver(ltnImipBar, "onItipItemCreation");
    },

    observe: function ltnImipBar_observe(subject, topic, state) {
        if (topic == "onItipItemCreation") {
            let itipItem = null;
            try {
                if (!subject) {
                    let sinkProps = msgWindow.msgHeaderSink.properties;
                    // This property was set by lightningTextCalendarConverter.js
                    itipItem = sinkProps.getPropertyAsInterface("itipItem", Components.interfaces.calIItipItem);
                }
            } catch (e) {
                // This will throw on every message viewed that doesn't have the
                // itipItem property set on it. So we eat the errors and move on.

                // XXX TODO: Only swallow the errors we need to. Throw all others.
            }
            if (!itipItem || !gMessageDisplay.displayedMessage) {
                return;
            }

            let imipMethod = gMessageDisplay.displayedMessage.getStringProperty("imip_method");
            cal.itip.initItemFromMsgData(itipItem, imipMethod, gMessageDisplay.displayedMessage);

            let imipBar = document.getElementById("imip-bar");
            imipBar.setAttribute("collapsed", "false");
            imipBar.setAttribute("label",  cal.itip.getMethodText(itipItem.receivedMethod));

            cal.itip.processItipItem(itipItem, ltnImipBar.setupOptions);
        }
    },

    /**
     * Hide the imip bar and reset the itip item.
     */
    hideBar: function ltnHideImipBar() {
        document.getElementById("imip-bar").collapsed = true;
        hideElement("imip-button1");
        hideElement("imip-button2");
        hideElement("imip-button3");
        // Clear our iMIP/iTIP stuff so it doesn't contain stale information.
        ltnImipBar.itipItem = null;
    },

    setupOptions: function setupOptions(itipItem, rc, actionFunc, foundItems) {
        let imipBar =  document.getElementById("imip-bar");
        let data = cal.itip.getOptionsText(itipItem, rc, actionFunc);

        if (Components.isSuccessCode(rc)) {
            ltnImipBar.itipItem = itipItem;
            ltnImipBar.actionFunc = actionFunc;
            ltnImipBar.foundItems = foundItems;
        }

        imipBar.setAttribute("label", data.label);
        for each (let button in ["button1", "button2", "button3"]) {
            let buttonElement = document.getElementById("imip-" + button);
            if (data[button].label) {
                buttonElement.setAttribute("label", data[button].label);
                buttonElement.setAttribute("oncommand",
                                           "ltnImipBar.executeAction('" + data[button].actionMethod + "')");

                showElement(buttonElement);
            }
        }
    },

    executeAction: function ltnExecAction(partStat) {
        if (partStat == "X-SHOWDETAILS") {
            let items = ltnImipBar.foundItems;
            if (items && items.length) {
                let item = items[0].isMutable ? items[0] : items[0].clone();
                modifyEventWithDialog(item);
            }
        } else if (cal.itip.promptCalendar(ltnImipBar.actionFunc.method, ltnImipBar.itipItem, window)) {
            // hide the buttons now, to disable pressing them twice...
            hideElement("imip-button1");
            hideElement("imip-button2");
            hideElement("imip-button3");

            let opListener = {
                onOperationComplete: function ltnItipActionListener_onOperationComplete(aCalendar,
                                                                                        aStatus,
                                                                                        aOperationType,
                                                                                        aId,
                                                                                        aDetail) {
                    // For now, we just state the status for the user something very simple
                    let imipBar = document.getElementById("imip-bar");
                    let label = cal.itip.getCompleteText(aStatus, aOperationType);
                    imipBar.setAttribute("label", label);

                    if (!Components.isSuccessCode(aStatus)) {
                        showError(label);
                    }
                },
                onGetResult: function ltnItipActionListener_onGetResult(aCalendar,
                                                                        aStatus,
                                                                        aItemType,
                                                                        aDetail,
                                                                        aCount,
                                                                        aItems) {
                }
            };

            try {
                ltnImipBar.actionFunc(opListener, partStat);
            } catch (exc) {
                Components.utils.reportError(exc);
            }
            return true;
        }
        return false;
    }
};

addEventListener("messagepane-loaded", ltnImipBar.load, true);
addEventListener("messagepane-unloaded", ltnImipBar.unload, true);
