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
 * The Original Code is Calendar Drag-n-drop code.
 *
 * The Initial Developer of the Original Code is 
 *   Joey Minta <jminta@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

function calendarDNDBaseObserver() {
    ASSERT(false, "Inheriting objects call calendarDNDBaseObserver!");
}

calendarDNDBaseObserver.prototype = {
    // initialize this class's members
    initBase: function calDNDInitBase() {
    },
    
    getSupportedFlavours: function calDNDGetFlavors() {
        var flavourSet = new FlavourSet();
        flavourSet.appendFlavour("text/calendar");
        flavourSet.appendFlavour("text/x-moz-url");
        flavourSet.appendFlavour("text/x-moz-message");
        flavourSet.appendFlavour("text/unicode");
        flavourSet.appendFlavour("application/x-moz-file");
        return flavourSet;
    },

    onDrop: function calDNDDrop(aEvent, aTransferData, aDragSession) {
        var transferable = Components.classes["@mozilla.org/widget/transferable;1"]
                           .createInstance(Components.interfaces.nsITransferable);
        transferable.addDataFlavor("text/calendar");
        transferable.addDataFlavor("text/x-moz-url");
        transferable.addDataFlavor("text/x-moz-message");
        transferable.addDataFlavor("text/unicode");
        transferable.addDataFlavor("application/x-moz-file");

        aDragSession.getData(transferable, 0);

        var data = new Object();
        var bestFlavor = new Object();
        var length = new Object();
        transferable.getAnyTransferData(bestFlavor, data, length);
        data = data.value.QueryInterface(Components.interfaces.nsISupportsString);

        // Treat unicode data with VEVENT in it as text/calendar
        if (bestFlavor.value == "text/unicode" && data.toString().indexOf("VEVENT") != -1) {
            bestFlavor.value = "text/calendar";
        }

        var destCal = getSelectedCalendar();
        switch (bestFlavor.value) {
            case "text/calendar":
                var parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                             .createInstance(Components.interfaces.calIIcsParser);
                parser.parseString(data, null);
                this.onDropItems(parser.getItems({}));
                break;
            case "text/unicode":
                var droppedUrl = this.retrieveURLFromData(data, bestFlavor.value);
                if (!droppedUrl)
                    return;

                var url = makeURL(droppedUrl);

                var localFileInstance = Components.classes["@mozilla.org/file/local;1"]
                                        .createInstance(Components.interfaces.nsILocalFile);
                localFileInstance.initWithPath(url.path);

                var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                                  .createInstance(Components.interfaces.nsIFileInputStream);
                inputStream.init(localFileInstance, MODE_RDONLY, 0444, {});

                try {
                    //XXX support csv
                    var importer = Components.classes["@mozilla.org/calendar/import;1?type=ics"]
                                   .getService(Components.interfaces.calIImporter);
                    var items = importer.importFromStream(inputStream, {});
                    this.onDropItems(items);
                }
                finally {
                    inputStream.close();
                }

                break;
            case "application/x-moz-file-promise":
            case "text/x-moz-url":
                var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                .getService(Components.interfaces.nsIIOService);
                var uri = ioService.newURI(data.toString(), null, null);
                var loader = Components.classes["@mozilla.org/network/unichar-stream-loader;1"]
                             .createInstance(Components.interfaces.nsIUnicharStreamLoader);
                channel = ioService.newChannelFromURI(uri);
                channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
                
                var self = this;

                var listener = {

                    // nsIUnicharStreamLoaderObserver:
                    onDetermineCharset: function(loader, context, firstSegment, length) {
                        var charset = null;
                        if (loader && loader.channel) {
                            charset = channel.contentCharset;
                        }
                        if (!charset || charset.length == 0) {
                            charset = "UTF-8";
                        }
                        return charset;
                    },

                    onStreamComplete: function(loader, context, status, unicharData) {
                        if (unicharData) {
                            var str = "";
                            var str_ = {};
                            while (unicharData.readString(-1, str_)) {
                                str += str_.value;
                            }
                            var parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                                         .createInstance(Components.interfaces.calIIcsParser);
                            parser.parseString(str, null);
                            self.onDropItems(parser.getItems({}));
                        }
                    }
                };

                try {
                    loader.init(channel, listener, null, 0);
                } catch(e) {
                    Component.utils.reportError(e)
                }
                break;
            case "text/x-moz-message":
                this.onDropMessage(messenger.msgHdrFromURI(data));
                break;
            default:
                ASSERT(false, "unknown data flavour:" + bestFlavor.value+'\n');
                break;
        }
    },

    onDragStart: function calDNDStart(aEvent, aTransferData, aDragAction) {},
    onDragOver: function calDNDOver(aEvent, aFlavor, aDragSession) {},
    onDragExit: function calDNDExit(aEvent, aDragSession) {},

    onDropItems: function calDNDDropItems(aItems) {},
    onDropMessage: function calDNDDropMessage(aMessage) {},

    calendarItemFromMessage: function calDNDItemFromMessage(aItem,aMessage) {
    
        aItem.calendar = getSelectedCalendar();
        aItem.title = aMessage.subject;
        if (isEvent(aItem)) {
            aItem.startDate = now();
            aItem.endDate = aItem.startDate.clone();
            aItem.endDate.minute += getPrefSafe("calendar.event.defaultlength", 60);
        } else if (isToDo(aItem)) {
            aItem.entryDate = now();
        }
        setDefaultAlarmValues(aItem);

        var addAttendees = function(aEmailAddresses) {
            if (msgHeaderParser) {
                var addresses = {};
                var fullNames = {};
                var names = {};
                var numAddresses =  0;
                numAddresses = msgHeaderParser.parseHeadersWithArray(
                    aEmailAddresses, addresses, names, fullNames);
                var index = 0;
                while (index < numAddresses) {
                    var attendee = createAttendee();
                    attendee.id = addresses.value[index];
                    attendee.commonName = names.value[index];
                    attendee.role = "REQ-PARTICIPANT";
                    attendee.participationStatus = "NEEDS-ACTION";
                    attendee.rsvp = true;
                    aItem.addAttendee(attendee);
                    index++;
                }
            }
        }
        
        addAttendees(aMessage.recipients);
        addAttendees(aMessage.ccList);

        var htmlToPlainText = function(html) {
          var texts = html.split(/(<\/?[^>]+>)/);
          var text = texts.map(function(string) {
              if (string.length > 0 && string[0] == '<') {
                  var regExpRes = string.match(/^<img.*?alt\s*=\s*['"](.*)["']/i)
                  if (regExpRes) {
                      return regExpRes[1];
                  } else {
                      return "";
                  }
              } else {
                  return string.replace(/&([^;]+);/g, function(str, p1) {
                        switch (p1) {
                            case "nbsp": return " ";
                            case "amp": return "&";
                            case "lt": return "<";
                            case "gt": return ">";
                            case "quot": return '"';
                        }
                        return " ";
                    });
              }
          }).join("");

          return text;
        }

        var content = document.getElementById("messagepane");
        if (content) {
            var messagePrefix = /^mailbox-message:|^imap-message:|^news-message:/i;
            if (messagePrefix.test(GetLoadedMessage())) {
                var message = content.contentDocument;
                var body = message.body;
                if (body) {
                    aItem.setProperty(
                        "DESCRIPTION",
                        htmlToPlainText(body.innerHTML));
                }
            }
        }
    
    },

    retrieveURLFromData: function calDNDRetrieveURL(aData, aFlavor) {
        var data;
        switch (aFlavor) {
            case "text/unicode":
                data = aData.toString();
                var separator = data.indexOf("\n");
                if (separator != -1)
                    data = data.substr(0, separator);
                return data;
            case "application/x-moz-file":
                return aData.URL;
            default:
                return null;
        }
    }
};

/**
 * calendarViewDNDObserver::calendarViewDNDObserver
 *
 * Drag'n'drop handler for the calendar views. This handler is
 * derived from the base handler and just implements specific actions.
 */
function calendarViewDNDObserver() {
    this.wrappedJSObject = this;
    this.initBase();
}

calendarViewDNDObserver.prototype = {
    __proto__: calendarDNDBaseObserver.prototype,

    /**
     * calendarViewDNDObserver::onDropItems
     *
     * Gets called in case we're dropping an array of items
     * on one of the calendar views. In this case we just
     * try to add these items to the currently selected calendar.
     */
    onDropItems: function(aItems) {
        var destCal = getSelectedCalendar();
        startBatchTransaction();
        try {
            for each (var item in aItems) {
                doTransaction('add', item, destCal, null, null);
            }
        }
        finally {
            endBatchTransaction();
        }
    }
};

/**
 * calendarMailButtonDNDObserver::calendarMailButtonDNDObserver
 *
 * Drag'n'drop handler for the 'mail mode'-button. This handler is
 * derived from the base handler and just implements specific actions.
 */
function calendarMailButtonDNDObserver() {
    this.wrappedJSObject = this;
    this.initBase();
}

calendarMailButtonDNDObserver.prototype = {
    __proto__: calendarDNDBaseObserver.prototype,

    /**
     * calendarMailButtonDNDObserver::onDropItems
     *
     * Gets called in case we're dropping an array of items
     * on the 'mail mode'-button.
     */
    onDropItems: function(aItems) {
        if (aItems && aItems.length > 0) {
            var item = aItems[0];
            
            var recipients = "";
            var attendees = item.getAttendees({});
            for each (var attendee in attendees) {
                if (attendee.id && attendee.id.length) {
                    var email = attendee.id;
                    var re = new RegExp("^mailto:(.*)", "i");
                    if (email && email.length) {
                        if (re.test(email)) {
                            email = RegExp.$1;
                        } else {
                            email = email;
                        }
                    }
                    // Prevent trailing commas.
                    if (recipients.length > 0) {
                        recipients += ",";
                    }
                    // Add this recipient id to the list.
                    recipients += email;
                }
            }

            // Set up the subject
            var subject = calGetString("sun-calendar-event-dialog",
                                       "emailSubjectReply",
                                       [item.title]);

            // set up message body from item description
            var body = item.getProperty("DESCRIPTION");
            
            sendMailTo(recipients, subject, body);
        }
    },

    /**
     * calendarMailButtonDNDObserver::onDropMessage
     *
     * Gets called in case we're dropping a message
     * on the 'mail mode'-button.
     */
    onDropMessage: function(aMessage) {
    }
};

/**
 * calendarCalendarButtonDNDObserver::calendarCalendarButtonDNDObserver
 *
 * Drag'n'drop handler for the 'calendar mode'-button. This handler is
 * derived from the base handler and just implements specific actions.
 */
function calendarCalendarButtonDNDObserver() {
    this.wrappedJSObject = this;
    this.initBase();
}

calendarCalendarButtonDNDObserver.prototype = {
    __proto__: calendarDNDBaseObserver.prototype,

    /**
     * calendarCalendarButtonDNDObserver::onDropItems
     *
     * Gets called in case we're dropping an array of items
     * on the 'calendar mode'-button.
     */
    onDropItems: function(aItems) {
        if (aItems && aItems.length > 0) {
            var item = aItems[0];
            if (!isEvent(item)) {
                var newItem = createEvent();
                newItem.wrappedJSObject.setItemBaseFromICS(
                    item.icalComponent);
                newItem.startDate = item.entryDate || now();
                newItem.endDate = item.dueDate || now();
                createEventWithDialog(null, null, null, null, newItem);
            } else {
                modifyEventWithDialog(item);
            }
        }
    },

    /**
     * calendarCalendarButtonDNDObserver::onDropMessage
     *
     * Gets called in case we're dropping a message on the
     * 'calendar mode'-button. In this case we create a new
     * event from the mail. We open the default event dialog
     * and just use the subject of the message as the event title.
     */
    onDropMessage: function(aMessage) {
        var event = createEvent();
        this.calendarItemFromMessage(event,aMessage);
        createEventWithDialog(null, null, null, null, event);
    }
};

/**
 * calendarTaskButtonDNDObserver::calendarTaskButtonDNDObserver
 *
 * Drag'n'drop handler for the 'task mode'-button. This handler is
 * derived from the base handler and just implements specific actions.
 */
function calendarTaskButtonDNDObserver() {
    this.wrappedJSObject = this;
    this.initBase();
}

calendarTaskButtonDNDObserver.prototype = {
    __proto__: calendarDNDBaseObserver.prototype,

    /**
     * calendarTaskButtonDNDObserver::onDropItems
     *
     * Gets called in case we're dropping an array of items
     * on the 'task mode'-button.
     */
    onDropItems: function(aItems) {
        if (aItems && aItems.length > 0) {
            var item = aItems[0];
            if (!isToDo(item)) {
                var newItem = createTodo();
                newItem.wrappedJSObject.setItemBaseFromICS(
                    item.icalComponent);
                newItem.entryDate = item.startDate || now();
                newItem.dueDate = item.endDate || now();
                createTodoWithDialog(null, null, null, newItem);
            } else {
                modifyEventWithDialog(newItem);
            }
        }
    },

    /**
     * calendarTaskButtonDNDObserver::onDropMessage
     *
     * Gets called in case we're dropping a message
     * on the 'task mode'-button.
     */
    onDropMessage: function(aMessage) {
        var todo = createTodo();
        this.calendarItemFromMessage(todo,aMessage);
        createTodoWithDialog(null, null, null, todo);
    }
};

var calendarViewDNDObserver = new calendarViewDNDObserver();
var calendarMailButtonDNDObserver = new calendarMailButtonDNDObserver();
var calendarCalendarButtonDNDObserver = new calendarCalendarButtonDNDObserver();
var calendarTaskButtonDNDObserver = new calendarTaskButtonDNDObserver();
