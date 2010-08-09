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
 * The Original Code is Simdesk Technologies code.
 *
 * The Initial Developer of the Original Code is
 * Simdesk Technologies.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Clint Talbert <ctalbert.moz@gmail.com>
 *   Matthew Willis <lilmatt@mozilla.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
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
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function convertFromUnicode(aCharset, aSrc) {
    let unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                     .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    unicodeConverter.charset = aCharset;
    return unicodeConverter.ConvertFromUnicode(aSrc);
}

/**
 * Constructor of calItipEmailTransport object
 */
function calItipEmailTransport() {
    this.wrappedJSObject = this;
    this._initEmailTransport();
}

calItipEmailTransport.prototype = {
    classID: Components.ID("{d4d7b59e-c9e0-4a7a-b5e8-5958f85515f0}"),
    contractID: "@mozilla.org/calendar/itip-transport;1?type=email",
    classDescription: "Calendar iTIP Email Transport",

    getInterfaces: function getInterfaces(count) {
        const ifaces = [Components.interfaces.calIItipTransport,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calItipEmailTransport.prototype, aIID, null, this);
    },

    mHasXpcomMail: false,
    mDefaultAccount: null,
    mDefaultIdentity: null,
    mDefaultSmtpServer: null,

    get scheme() {
        return "mailto";
    },

    mSenderAddress: null,
    get senderAddress() {
        return this.mSenderAddress;
    },
    set senderAddress(aValue) {
        return (this.mSenderAddress = aValue);
    },

    get type() {
        return "email";
    },

    sendItems: function cietSI(aCount, aRecipients, aItipItem) {
        if (this.mHasXpcomMail) {
            cal.LOG("sendItems: Sending Email...");

            let item = aItipItem.getItemList({})[0];

            // Get ourselves some default text - when we handle organizer properly
            // We'll need a way to configure the Common Name attribute and we should
            // use it here rather than the email address

            let summary = (item.getProperty("SUMMARY") || "");
            let aSubject = "";
            let aBody = "";
            switch (aItipItem.responseMethod) {
                case 'REQUEST':
                    aSubject = cal.calGetString("lightning",
                                                "itipRequestSubject",
                                                [summary],
                                                "lightning");
                    aBody = cal.calGetString("lightning",
                                             "itipRequestBody",
                                             [item.organizer ? item.organizer.toString() : "", summary],
                                             "lightning");
                    break;
                case 'CANCEL':
                    aSubject = cal.calGetString("lightning",
                                                "itipCancelSubject",
                                                [summary],
                                                "lightning");
                    aBody = cal.calGetString("lightning",
                                             "itipCancelBody",
                                             [item.organizer ? item.organizer.toString() : "", summary],
                                             "lightning");
                    break;
                case 'REPLY': {
                    // Get my participation status
                    let att = (cal.calInstanceOf(aItipItem.targetCalendar, Components.interfaces.calISchedulingSupport)
                               ? aItipItem.targetCalendar.getInvitedAttendee(item) : null);
                    if (!att && aItipItem.identity) {
                        att = item.getAttendeeById("mailto:" + aItipItem.identity);
                    }
                    if (!att) { // should not happen anymore
                        return;
                    }

                    // work around BUG 351589, the below just removes RSVP:
                    aItipItem.setAttendeeStatus(att.id, att.participationStatus);
                    let myPartStat = att.participationStatus;
                    let name = att.toString();

                    // Generate proper body from my participation status
                    aSubject = cal.calGetString("lightning",
                                                "itipReplySubject",
                                                [summary],
                                                "lightning");
                    aBody = cal.calGetString("lightning",
                                             (myPartStat == "DECLINED") ? "itipReplyBodyDecline"
                                                                        : "itipReplyBodyAccept",
                                             [name],
                                             "lightning");
                    break;
                }
            }

            this._sendXpcomMail(aRecipients, aSubject, aBody, aItipItem);
        } else {
            // Sunbird case: Call user's default mailer on system.
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        }
    },

    _initEmailTransport: function cietIES() {
        this.mHasXpcomMail = true;

        try {
            let smtpSvc = Components.classes["@mozilla.org/messengercompose/smtp;1"]
                                    .getService(Components.interfaces.nsISmtpService);
            this.mSmtpServer = smtpSvc.defaultServer;

            let accountMgrSvc = Components.classes["@mozilla.org/messenger/account-manager;1"]
                                          .getService(Components.interfaces.nsIMsgAccountManager);
            this.mDefaultAccount = accountMgrSvc.defaultAccount;
            this.mDefaultIdentity = this.mDefaultAccount.defaultIdentity;

            if (!this.mDefaultIdentity) {
                // If there isn't a default identity (i.e Local Folders is your
                // default identity, then go ahead and use the first available
                // identity.
                let allIdentities = accountMgrSvc.allIdentities;
                if (allIdentities.Count() > 0) {
                    this.mDefaultIdentity = allIdentities.GetElementAt(0)
                                                         .QueryInterface(Components.interfaces.nsIMsgIdentity);
                } else {
                    // If there are no identities, then we are in the same
                    // situation as if we didn't have Xpcom Mail.
                    this.mHasXpcomMail = false;
                    cal.LOG("initEmailService: No XPCOM Mail available: " + e);
                }
            }
        } catch (ex) {
            // Then we must resort to operating system specific means
            this.mHasXpcomMail = false;
        }
    },

    _sendXpcomMail: function cietSXM(aToList, aSubject, aBody, aItem) {
        let identity = null;
        let account;
        if (aItem.targetCalendar) {
            identity = aItem.targetCalendar.getProperty("imip.identity");
            if (identity) {
                identity = identity.QueryInterface(Components.interfaces.nsIMsgIdentity);
                account = aItem.targetCalendar.getProperty("imip.account")
                                              .QueryInterface(Components.interfaces.nsIMsgAccount);
            } else {
                cal.WARN("No email identity configured for calendar " + aItem.targetCalendar.name);
            }
        }
        if (!identity) { // use some default identity/account:
            identity = this.mDefaultIdentity;
            account = this.mDefaultAccount;
        }

        let compatMode = 0;
        switch (aItem.autoResponse) {
            case (Components.interfaces.calIItipItem.USER): {
                cal.LOG("sendXpcomMail: Found USER autoResponse type.\n" +
                        "This type is currently unsupported, the compose API will always enter a text/plain\n" +
                        "or text/html part as first part of the message.\n" +
                        "This will disable OL (up to 2003) to consume the mail as an iTIP invitation showing\n" +
                        "the usual calendar buttons.");
                // To somehow have a last resort before sending spam, the user can choose to send the mail.
                let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                              .getService(Components.interfaces.nsIPromptService);
                let prefCompatMode = getPrefSafe("calendar.itip.compatSendMode", 0);
                let inoutCheck = { value: (prefCompatMode == 1) };
                if (!promptService.confirmCheck(null,
                                                cal.calGetString("lightning", "imipSendMail.title", null, "lightning"),
                                                cal.calGetString("lightning", "imipSendMail.text", null, "lightning"),
                                                cal.calGetString("lightning", "imipSendMail.Outlook2000CompatMode.text", null, "lightning"),
                                                inoutCheck)) {
                    break;
                } // else go on with auto sending for now
                compatMode = (inoutCheck.value ? 1 : 0);
                if (compatMode != prefCompatMode) {
                    setPref("calendar.itip.compatSendMode", compatMode);
                }
            }
            case (Components.interfaces.calIItipItem.AUTO): {
                cal.LOG("sendXpcomMail: Found AUTO autoResponse type.");
                let toList = "";
                for each (let recipient in aToList) {
                    // Strip leading "mailto:" if it exists.
                    let rId = recipient.id.replace(/^mailto:/i, "");
                    // Prevent trailing commas.
                    if (toList.length > 0) {
                        toList += ", ";
                    }
                    // Add this recipient id to the list.
                    toList += rId;
                }
                let mailFile = this._createTempImipFile(compatMode, toList, aSubject, aBody, aItem, identity);
                if (mailFile) {
                    // compose fields for message: from/to etc need to be specified both here and in the file
                    let composeFields = Components.classes["@mozilla.org/messengercompose/composefields;1"]
                                                  .createInstance(Components.interfaces.nsIMsgCompFields);
                    composeFields.characterSet = "UTF-8";
                    composeFields.to = toList;
                    composeFields.from = identity.email;
                    composeFields.replyTo = identity.replyTo;

                    // xxx todo: add send/progress UI, maybe recycle
                    //           "@mozilla.org/messengercompose/composesendlistener;1"
                    //           and/or "chrome://messenger/content/messengercompose/sendProgress.xul"
                    // i.e. bug 432662
                    let msgSend = Components.classes["@mozilla.org/messengercompose/send;1"]
                                            .createInstance(Components.interfaces.nsIMsgSend);
                    msgSend.sendMessageFile(identity,
                                            account.key,
                                            composeFields,
                                            mailFile,
                                            true  /* deleteSendFileOnCompletion */,
                                            false /* digest_p */,
                                            (cal.getIOService().offline ? Components.interfaces.nsIMsgSend.nsMsgQueueForLater
                                                                    : Components.interfaces.nsIMsgSend.nsMsgDeliverNow),
                                            null  /* nsIMsgDBHdr msgToReplace */,
                                            null  /* nsIMsgSendListener aListener */,
                                            null  /* nsIMsgStatusFeedback aStatusFeedback */,
                                            ""    /* password */);
                }
                break;
            }
            case (Components.interfaces.calIItipItem.NONE):
                cal.LOG("sendXpcomMail: Found NONE autoResponse type.");

                // No response
                break;
            default:
                // Unknown autoResponse type
                throw new Error("sendXpcomMail: " +
                                "Unknown autoResponse type: " +
                                aItem.autoResponse);
        }
    },

    _createTempImipFile: function cietCTIF(compatMode, aToList, aSubject, aBody, aItem, aIdentity) {
        try {
            function encodeUTF8(text) {
                return convertFromUnicode("UTF-8", text).replace(/(\r\n)|\n/g, "\r\n");
            }
            function encodeMimeHeader(header) {
                let mimeConverter = Components.classes["@mozilla.org/messenger/mimeconverter;1"]
                                              .createInstance(Components.interfaces.nsIMimeConverter);
                let fieldNameLen = (header.indexOf(": ") + 2);
                return mimeConverter.encodeMimePartIIStr_UTF8(header,
                                                              false,
                                                              "UTF-8",
                                                              fieldNameLen,
                                                              Components.interfaces.nsIMimeConverter.MIME_ENCODED_WORD_SIZE);
            }

            let itemList = aItem.getItemList({});
            let serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                                       .createInstance(Components.interfaces.calIIcsSerializer);
            serializer.addItems(itemList, itemList.length);
            let methodProp = cal.getIcsService().createIcalProperty("METHOD");
            methodProp.value = aItem.responseMethod;
            serializer.addProperty(methodProp);
            let calText = serializer.serializeToString();
            let utf8CalText = encodeUTF8(calText);

            // Home-grown mail composition; I'd love to use nsIMimeEmitter, but it's not clear to me whether
            // it can cope with nested attachments,
            // like multipart/alternative with enclosed text/calendar and text/plain.
            let mailText = ("MIME-version: 1.0\r\n" +
                            (aIdentity.replyTo
                             ? "Return-path: " + aIdentity.replyTo + "\r\n" : "") +
                            "From: " + aIdentity.email + "\r\n" +
                            "To: " + aToList + "\r\n" +
                            "Date: " + (new Date()).toUTCString() + "\r\n" +
                            "Subject: " + encodeMimeHeader(aSubject.replace(/(\n|\r\n)/, "|")) + "\r\n");
            switch (compatMode) {
                case 1:
                    mailText += ("Content-class: urn:content-classes:calendarmessage\r\n" +
                                 "Content-type: text/calendar; method=" + aItem.responseMethod + "; charset=UTF-8\r\n" +
                                 "Content-transfer-encoding: 8BIT\r\n" +
                                 "\r\n" +
                                 utf8CalText +
                                 "\r\n");
                    break;
                default:
                    mailText += ("Content-type: multipart/mixed; boundary=\"Boundary_(ID_qyG4ZdjoAsiZ+Jo19dCbWQ)\"\r\n" +
                                 "\r\n\r\n" +
                                 "--Boundary_(ID_qyG4ZdjoAsiZ+Jo19dCbWQ)\r\n" +
                                 "Content-type: multipart/alternative;\r\n" +
                                 " boundary=\"Boundary_(ID_ryU4ZdJoASiZ+Jo21dCbwA)\"\r\n" +
                                 "\r\n\r\n" +
                                 "--Boundary_(ID_ryU4ZdJoASiZ+Jo21dCbwA)\r\n" +
                                 "Content-type: text/plain; charset=UTF-8\r\n" +
                                 "Content-transfer-encoding: 8BIT\r\n" +
                                 "\r\n" +
                                 encodeUTF8(aBody) +
                                 "\r\n\r\n\r\n" +
                                 "--Boundary_(ID_ryU4ZdJoASiZ+Jo21dCbwA)\r\n" +
                                 "Content-type: text/calendar; method=" + aItem.responseMethod + "; charset=UTF-8\r\n" +
                                 "Content-transfer-encoding: 8BIT\r\n" +
                                 "\r\n" +
                                 utf8CalText +
                                 "\r\n\r\n" +
                                 "--Boundary_(ID_ryU4ZdJoASiZ+Jo21dCbwA)--\r\n" +
                                 "\r\n" +
                                 "--Boundary_(ID_qyG4ZdjoAsiZ+Jo19dCbWQ)\r\n" +
                                 "Content-type: application/ics; name=invite.ics\r\n" +
                                 "Content-transfer-encoding: 8BIT\r\n" +
                                 "Content-disposition: attachment; filename=invite.ics\r\n" +
                                 "\r\n" +
                                 utf8CalText +
                                 "\r\n\r\n" +
                                 "--Boundary_(ID_qyG4ZdjoAsiZ+Jo19dCbWQ)--\r\n");
                    break;
            }
            cal.LOG("mail text:\n" + mailText);

            let dirUtils = Components.classes["@mozilla.org/file/directory_service;1"]
                                     .createInstance(Components.interfaces.nsIProperties);
            let tempFile = dirUtils.get("TmpD", Components.interfaces.nsIFile);
            tempFile.append("itipTemp");
            tempFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE,
                                  parseInt("0600", 8));

            let outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                                         .createInstance(Components.interfaces.nsIFileOutputStream);
            // Let's write the file - constants from file-utils.js
            const MODE_WRONLY   = 0x02;
            const MODE_CREATE   = 0x08;
            const MODE_TRUNCATE = 0x20;
            outputStream.init(tempFile,
                              MODE_WRONLY | MODE_CREATE | MODE_TRUNCATE,
                              parseInt("0600", 8),
                              0);
            outputStream.write(mailText, mailText.length);
            outputStream.close();

            cal.LOG("_createTempImipFile path: " + tempFile.path);
            return tempFile;
        } catch (exc) {
            cal.ASSERT(false, exc);
            return null;
        }
    }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([calItipEmailTransport]);
