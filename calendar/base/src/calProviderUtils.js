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
 * The Original Code is Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Bruno Browning <browning@uwalumni.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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

/*
 * Using this file requires calUtils.js to be loaded
 */

/**
 * Prepare HTTP channel with standard request headers and upload
 * data/content-type if needed
 *
 * @param arUri                      channel Uri
 * @param aUploadData                data to be uploaded, if any
 * @param aContentType               value for Content-Type header, if any
 * @param aNotificationCallbacks     calendar using channel
 */
function calPrepHttpChannel(aUri, aUploadData, aContentType, aNotificationCallbacks) {
    var ioService = getIOService();
    var channel = ioService.newChannelFromURI(aUri);
    var httpchannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);

    httpchannel.setRequestHeader("Accept", "text/xml", false);
    httpchannel.setRequestHeader("Accept-Charset", "utf-8,*;q=0.1", false);
    httpchannel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
    httpchannel.notificationCallbacks = aNotificationCallbacks;

    if (aUploadData) {
        httpchannel = httpchannel.QueryInterface(Components.interfaces.nsIUploadChannel);

        var converter =
            Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                      .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        converter.charset = "UTF-8";
        var stream = converter.convertToInputStream(aUploadData);

        httpchannel.setUploadStream(stream, aContentType, -1);
    }

    return httpchannel;
}

/**
 * calSendHttpRequest; send prepared HTTP request
 *
 * @param aStreamLoader     streamLoader for request
 * @param aChannel          channel for request
 * @param aListener         listener for method completion
 */
function calSendHttpRequest(aStreamLoader, aChannel, aListener) {
    if (isBranch()) {
        aStreamLoader.init(aChannel, aListener, aChannel);
    } else {
        aStreamLoader.init(aListener);
        aChannel.asyncOpen(aStreamLoader, aChannel);
    }
}

function createStreamLoader() {
    return Components.classes["@mozilla.org/network/stream-loader;1"]
                     .createInstance(Components.interfaces.nsIStreamLoader);
}

function convertByteArray(aResult, aResultLength, aCharset, aThrow) {
    try {
        var resultConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                    .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        resultConverter.charset = aCharset || "UTF-8";
        return resultConverter.convertFromByteArray(aResult, aResultLength);
    } catch (e) {
        if (aThrow) {
            throw e;
        }
    }
    return null;
}

/**
 * getInterface method for providers. This should be called in the context of
 * the respective provider, i.e
 *
 * return calInterfaceRequestor_getInterface.apply(this, arguments);
 *
 * or
 * ...
 * getInterface: calInterfaceRequestor_getInterface,
 * ...
 *
 * @param aIID      The interface ID to return
 */
function calInterfaceRequestor_getInterface(aIID) {
    // Support Auth Prompt Interfaces
    if (aIID.equals(Components.interfaces.nsIAuthPrompt) ||
        (Components.interfaces.nsIAuthPrompt2 &&
         aIID.equals(Components.interfaces.nsIAuthPrompt2))) {
        return new calAuthPrompt();
    } else if (aIID.equals(Components.interfaces.nsIAuthPromptProvider) ||
               aIID.equals(Components.interfaces.nsIPrompt)) {
        return Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                         .getService(Components.interfaces.nsIWindowWatcher)
                         .getNewPrompter(null);
    }

    try {
        // Try to query the this object for the requested interface but don't
        // throw if it fails since that borks the network code.
        return this.QueryInterface(aIID);
    } catch (e) {
        Components.returnCode = e;
    }
    return null;
}

/**
 * Freebusy interval implementation. All parameters are optional.
 *
 * @param aCalId         The calendar id to set up with.
 * @param aFreeBusyType  The type from calIFreeBusyInterval.
 * @param aStart         The start of the interval.
 * @param aEnd           The end of the interval.
 * @return               The fresh calIFreeBusyInterval.
 */
function calFreeBusyInterval(aCalId, aFreeBusyType, aStart, aEnd) {
    this.calId = aCalId
    this.interval = Components.classes["@mozilla.org/calendar/period;1"]
                              .createInstance(Components.interfaces.calIPeriod);
    this.interval.start = aStart;
    this.interval.end = aEnd;

    this.freeBusyType = aFreeBusyType ||
        Components.interfaces.calIFreeBusyInterval.UNKNOWN;
}

calFreeBusyInterval.prototype = {
    QueryInterface: function cFBI_QueryInterface(aIID) {
        return doQueryInterface(this,
                                calFreeBusyInterval.prototype,
                                aIID,
                                [Components.interfaces.calIFreeBusyInterval]);
    },

    calId: null,
    interval: null,
    freeBusyType: Components.interfaces.calIFreeBusyInterval.UNKNOWN
};

/**
 * Gets the iTIP/iMIP transport if the passed calendar has configured email.
 */
function calGetImipTransport(aCalendar) {
    // assure an identity is configured for the calendar
    return (aCalendar.getProperty("imip.identity")
            ? Components.classes["@mozilla.org/calendar/itip-transport;1?type=email"]
                        .getService(Components.interfaces.calIItipTransport)
            : null);
}
