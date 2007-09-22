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

var calendarDNDObserver = {
    getSupportedFlavours: function calDNDGetFlavors() {
        var flavourSet = new FlavourSet();
        flavourSet.appendFlavour("application/x-moz-file");
        flavourSet.appendFlavour("text/x-moz-url");
        flavourSet.appendFlavour("text/calendar");
        flavourSet.appendFlavour("text/unicode");
        return flavourSet;
    },

    onDrop: function calDNDDrop(aEvent, aTransferData, aDragSession) {
        var transferable = Components.classes["@mozilla.org/widget/transferable;1"]
                           .createInstance(Components.interfaces.nsITransferable);
        transferable.addDataFlavor("text/x-moz-url");
        transferable.addDataFlavor("application/x-moz-file");
        transferable.addDataFlavor("text/calendar");
        transferable.addDataFlavor("text/unicode");

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
                parser.parseString(data);
                startBatchTransaction();
                try {
                    for each (var item in parser.getItems({})) {
                        doTransaction('add', item, destCal, null, null);
                    }
                }
                finally {
                    endBatchTransaction();
                }
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
                    startBatchTransaction();
                    try {
                        for each (item in items) {
                            doTransaction('add', item, destCal, null, null);
                        }
                    }
                    finally {
                        endBatchTransaction();
                    }
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
                            parser.parseString(str);
                            startBatchTransaction();
                            try {
                                for each (var item in parser.getItems({})) {
                                    doTransaction('add', item, destCal, null, null);
                                }
                            }
                            finally {
                                endBatchTransaction();
                            }
                        }
                    }
                };

                try {
                    loader.init(channel, listener, null, 0);
                } catch(e) {
                    Component.utils.reportError(e)
                }
                break;
            default:
                dump("unknown data flavour:" + bestFlavor.value+'\n');
                break;
        }
    },

    onDragStart: function calDNDStart(aEvent, aTransferData, aDragAction) {},
    onDragOver: function calDNDOver(aEvent, aFlavor, aDragSession) {},
    onDragExit: function calDNDExit(aEvent, aDragSession) {},

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
