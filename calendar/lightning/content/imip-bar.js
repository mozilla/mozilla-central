/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
     * NOTE: This function is called without a valid this-context!
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
     * NOTE: This function is called without a valid this-context!
     */
    unload: function ltnImipOnUnload() {
        removeEventListener("messagepane-loaded", ltnImipBar.load, true);
        removeEventListener("messagepane-unloaded", ltnImipBar.unload, true);

        ltnImipBar.hideBar();
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
        cal.itip.cleanupItipItem(ltnImipBar.itipItem);
        ltnImipBar.itipItem = null;
    },

    /**
     * This is our callback function that is called each time the itip bar UI needs updating.
     * NOTE: This function is called without a valid this-context!
     *
     * @param itipItem      The iTIP item to set up for
     * @param rc            The status code from processing
     * @param actionFunc    The action function called for execution
     * @param foundItems    An array of items found while searching for the item
     *                        in subscribed calendars
     */
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
        } else {
            let delmgr = Components.classes["@mozilla.org/calendar/deleted-items-manager;1"]
                                   .getService(Components.interfaces.calIDeletedItems);
            let items = ltnImipBar.itipItem.getItemList({});
            if (items && items.length) {
                let delTime = delmgr.getDeletedDate(items[0].id);
                let dialogText = ltnGetString("lightning", "confirmProcessInvitation");
                let dialogTitle = ltnGetString("lightning", "confirmProcessInvitationTitle");
                if (delTime && !Services.prompt.confirm(window, dialogTitle, dialogText)) {
                    return false;
                }
            }

            if (cal.itip.promptCalendar(ltnImipBar.actionFunc.method, ltnImipBar.itipItem, window)) {
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
        }
        return false;
    }
};

addEventListener("messagepane-loaded", ltnImipBar.load, true);
addEventListener("messagepane-unloaded", ltnImipBar.unload, true);
