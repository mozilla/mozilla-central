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

function convertFromUnicode(aCharset, aSrc) {
    var unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
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

    QueryInterface: function cietQI(aIid) {
        if (!aIid.equals(Components.interfaces.nsISupports) &&
            !aIid.equals(Components.interfaces.calIItipTransport))
        {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    },

    mHasXpcomMail: false,
    mAccountMgrSvc: null,
    mDefaultAccount: null,
    mDefaultSmtpServer: null,

    mDefaultIdentity: null,
    get defaultIdentity() {
        return this.mDefaultIdentity.email;
    },

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

    /**
     * Pass the transport an itipItem and have it figure out what to do with
     * it based on the itipItem's methods.
     */
    simpleSendResponse: function cietSSR(aItem) {
        var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"].
                  getService(Components.interfaces.nsIStringBundleService);
        var sb = sbs.createBundle("chrome://lightning/locale/lightning.properties");

        var itemList = aItem.getItemList({ });

        // Get my participation status
        var myPartStat;
        var foundMyself = false;
        var attendee = itemList[0].getAttendeeById("mailto:" +
                                                   this.mDefaultIdentity.email);
        if (attendee) {
            myPartStat = attendee.participationStatus;
            foundMyself = true;
        }

        if (!foundMyself) {
            // I didn't find myself in the attendee list.
            //
            // This can happen when invitations are sent to email aliases
            // instead of mDefaultIdentity.email (ex: lilmatt vs. mwillis),
            // or if an invitation is sent to a listserv.
            //
            // We'll need to make more decisions regarding how to handle this
            // in the future. (ex: Prompt? Find myself in list?)  For now, we
            // just don't send a response.
            return;
        }

        var name = this.mDefaultIdentity.email;
        if (this.mDefaultIdentity.fullName) {
            name = this.mDefaultIdentity.fullName + " <" + name + ">";
        }

        var summary;
        if (itemList[0].getProperty("SUMMARY")) {
            summary = itemList[0].getProperty("SUMMARY");
        } else {
            summary = "";
        }
        var subj = sb.formatStringFromName("itipReplySubject", [summary], 1);

        // Generate proper body from my participation status
        var body;
        dump("\n\nthis is partstat: " + myPartStat + "\n");
        if (myPartStat == "DECLINED") {
            body = sb.formatStringFromName("itipReplyBodyDecline",
                                           [name], 1);
        } else {
            body = sb.formatStringFromName("itipReplyBodyAccept",
                                           [name], 1);
        }

        var recipients = [itemList[0].organizer];

        this.sendItems(recipients.length, recipients, subj, body, aItem);
    },

    sendItems: function cietSI(aCount, aRecipients, aSubject, aBody, aItem) {
        LOG("sendItems: Sending Email...");
        if (this.mHasXpcomMail) {
            this._sendXpcomMail(aRecipients, aSubject, aBody, aItem);
        } else {
            // Sunbird case: Call user's default mailer on system.
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        }
    },

    checkForInvitations: function cietCFI(searchStart) {
        // We only need to do trigger a check for incoming invitations if we
        // are not Thunderbird.
        if (!this.mHasXpcomMail) {
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        }
    },

    _initEmailTransport: function cietIES() {
        this.mHasXpcomMail = true;

        try {
            this.mAccountMgrSvc =
                 Components.classes["@mozilla.org/messenger/account-manager;1"].
                 getService(Components.interfaces.nsIMsgAccountManager);

            var smtpSvc = Components.classes["@mozilla.org/messengercompose/smtp;1"].
                          getService(Components.interfaces.nsISmtpService);
            this.mSmtpServer = smtpSvc.defaultServer;

            this.mDefaultAccount = this.mAccountMgrSvc.defaultAccount;
            this.mDefaultIdentity = this.mDefaultAccount.defaultIdentity;

            if (!this.mDefaultIdentity) {
                // If there isn't a default identity (i.e Local Folders is your
                // default identity, then go ahead and use the first available
                // identity.
                var allIdentities = this.mAccountMgrSvc.allIdentities;
                if (allIdentities.Count() > 0) {
                    this.mDefaultIdentity = allIdentities.GetElementAt(0)
                                                         .QueryInterface(Components.interfaces.nsIMsgIdentity);
                } else {
                    // If there are no identities, then we are in the same
                    // situation as if we didn't have Xpcom Mail.
                    this.mHasXpcomMail = false;
                    LOG("initEmailService: No XPCOM Mail available: " + e);
                }
            }
        } catch (ex) {
            // Then we must resort to operating system specific means
            this.mHasXpcomMail = false;
        }
    },

    _sendXpcomMail: function cietSXM(aToList, aSubject, aBody, aItem) {
        var compatMode = 0;
        switch (aItem.autoResponse) {
            case (Components.interfaces.calIItipItem.USER): {
                LOG("sendXpcomMail: Found USER autoResponse type.\n" +
                    "This type is currently unsupported, the compose API will always enter a text/plain\n" +
                    "or text/html part as first part of the message.\n" +
                    "This will disable OL (up to 2003) to consume the mail as an iTIP invitation showing\n" +
                    "the usual calendar buttons.");
                // To somehow have a last resort before sending spam, the user can choose to send the mail.
                // XXX todo: We should consider a more sophisticated dialiog,
                //           so the user could choose the account for sending.
                var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                              .getService(Components.interfaces.nsIPromptService);
                var prefCompatMode = getPrefSafe("calendar.itip.compatSendMode", 0);
                var inoutCheck = { value: (prefCompatMode == 1) };
                if (!promptService.confirmCheck(null,
                                                calGetString("lightning", "imipSendMailTitle", null, "lightning"),
                                                calGetString("lightning", "imipSendMail", null, "lightning"),
                                                calGetString("lightning", "imipSendMailOutlook2000CompatMode", null, "lightning"),
                                                inoutCheck)) {
                    break;
                } // else go on with auto sending for now
                compatMode = (inoutCheck.value ? 1 : 0);
                if (compatMode != prefCompatMode) {
                    setPref("calendar.itip.compatSendMode", "INT", compatMode);
                }
            }
            case (Components.interfaces.calIItipItem.AUTO): {
                LOG("sendXpcomMail: Found AUTO autoResponse type.");
                var toList = "";
                for each (var recipient in aToList) {
                    // Strip leading "mailto:" if it exists.
                    var rId = recipient.id.replace(/^mailto:/i, "");
                    // Prevent trailing commas.
                    if (toList.length > 0) {
                        toList += ", ";
                    }
                    // Add this recipient id to the list.
                    toList += rId;
                }
                var mailFile = this._createTempImipFile(compatMode, toList, aSubject, aBody, aItem);
                if (mailFile) {
#ifdef MOZILLA_1_8_BRANCH
                    var mailFileURL = getIOService().newFileURI(mailFile).spec;
                    mailFile = Components.classes["@mozilla.org/filespec;1"]
                                         .createInstance(Components.interfaces.nsIFileSpec);
                    mailFile.URLString = mailFileURL;
#endif
                    // compose fields for message: from/to etc need to be specified both here and in the file
                    var composeFields = Components.classes["@mozilla.org/messengercompose/composefields;1"]
                                                  .createInstance(Components.interfaces.nsIMsgCompFields);
                    composeFields.characterSet = "UTF-8";
                    composeFields.to = toList;
                    composeFields.from = this.mDefaultIdentity.email;
                    composeFields.replyTo = this.mDefaultIdentity.replyTo;

                    // xxx todo: add send/progress UI, maybe recycle
                    //           "@mozilla.org/messengercompose/composesendlistener;1"
                    //           and/or "chrome://messenger/content/messengercompose/sendProgress.xul"
                    var msgSend = Components.classes["@mozilla.org/messengercompose/send;1"]
                                            .createInstance(Components.interfaces.nsIMsgSend);
                    msgSend.sendMessageFile(this.mDefaultIdentity,
                                            this.mDefaultAccount.key,
                                            composeFields,
                                            mailFile,
                                            true  /* deleteSendFileOnCompletion */,
                                            false /* digest_p */,
                                            Components.interfaces.nsIMsgSend.nsMsgDeliverNow,
                                            null  /* nsIMsgDBHdr msgToReplace */,
                                            null  /* nsIMsgSendListener aListener */,
                                            null  /* nsIMsgStatusFeedback aStatusFeedback */,
                                            ""    /* password */);
                }
                break;
            }
            case (Components.interfaces.calIItipItem.NONE):
                LOG("sendXpcomMail: Found NONE autoResponse type.");

                // No response
                break;
            default:
                // Unknown autoResponse type
                throw new Error("sendXpcomMail: " +
                                "Unknown autoResponse type: " +
                                aItem.autoResponse);
        }
    },

    _createTempImipFile: function cietCTIF(compatMode, aToList, aSubject, aBody, aItem) {
        try {
            function encodeUTF8(text) {
                return convertFromUnicode("UTF-8", text).replace(/(\r\n)|\n/g, "\r\n");
            }
            function encodeMimeHeader(header) {
                var mimeConverter = Components.classes["@mozilla.org/messenger/mimeconverter;1"]
                                              .createInstance(Components.interfaces.nsIMimeConverter);
                return mimeConverter.encodeMimePartIIStr(encodeUTF8(header), false, "UTF-8", header.indexOf(":") + 2, 72);
            }

            var itemList = aItem.getItemList({});
            var calText = "";
            for (var i = 0; i < itemList.length; i++) {
                var item = itemList[i].clone();
                // This is a workaround until bug 353369 is fixed.
                // Without it, we cannot roundtrip the METHOD property, so we must
                // re-add it to the ICS data as we serialize it.
                //
                // Look at the implicit assumption in the code at:
                // http://lxr.mozilla.org/seamonkey/source/calendar/base/src/calEvent.js#162
                // and it's easy to see why.
                item.setProperty("METHOD", aItem.responseMethod);
                // xxx todo: should we consider to include exceptional/overridden items?
                calText += item.icalString;
            }
            var utf8CalText = encodeUTF8(calText);

            // Home-grown mail composition; I'd love to use nsIMimeEmitter, but it's not clear to me whether
            // it can cope with nested attachments,
            // like multipart/alternative with enclosed text/calendar and text/plain.
            var mailText = ("MIME-version: 1.0\r\n" +
                            (this.mDefaultIdentity.replyTo
                             ? "Return-path: " + this.mDefaultIdentity.replyTo + "\r\n" : "") +
                            "From: " + this.mDefaultIdentity.email + "\r\n" +
                            "To: " + aToList + "\r\n" +
                            encodeMimeHeader("Subject: " + aSubject) + "\r\n");
            switch (compatMode) {
                case 1:
                    mailText += ("Content-class: urn:content-classes:calendarmessage\r\n" +
                                 "Content-type: text/calendar; method=" + aItem.responseMethod + "; charset=UTF-8\r\n" +
                                 "Content-transfer-encoding: 8BIT\r\n" +
                                 "\r\n\r\n" +
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
                                 "\r\n\r\n" +
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
            LOG("mail text:\n" + mailText);

            var dirUtils = Components.classes["@mozilla.org/file/directory_service;1"]
                                     .createInstance(Components.interfaces.nsIProperties);
            var tempFile = dirUtils.get("TmpD", Components.interfaces.nsIFile);
            tempFile.append("itipTemp");
            tempFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);

            var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                                         .createInstance(Components.interfaces.nsIFileOutputStream);
            // Let's write the file - constants from file-utils.js
            const MODE_WRONLY   = 0x02;
            const MODE_CREATE   = 0x08;
            const MODE_TRUNCATE = 0x20;
            outputStream.init(tempFile,
                              MODE_WRONLY | MODE_CREATE | MODE_TRUNCATE,
                              0600, 0);
            outputStream.write(mailText, mailText.length);
            outputStream.close();

            LOG("_createTempImipFile path: " + tempFile.path);
            return tempFile;
        } catch (exc) {
            ASSERT(false, exc);
            return null;
        }
    }
};

// nsIFactory
const calItipEmailTransportFactory = {
    createInstance: function (outer, iid) {
        if (outer != null)
            throw Components.results.NS_ERROR_NO_AGGREGATION;
        return (new calItipEmailTransport()).QueryInterface(iid);
    }
};

/****
 **** module registration
 ****/

var calItipEmailTransportModule = {

    mCID: Components.ID("{d4d7b59e-c9e0-4a7a-b5e8-5958f85515f0}"),
    mContractID: "@mozilla.org/calendar/itip-transport;1?type=email",

    mUtilsLoaded: false,
    loadUtils: function itipEmailLoadUtils() {
        if (this.mUtilsLoaded)
            return;

        const jssslContractID = "@mozilla.org/moz/jssubscript-loader;1";
        const jssslIID = Components.interfaces.mozIJSSubScriptLoader;

        const iosvcContractID = "@mozilla.org/network/io-service;1";
        const iosvcIID = Components.interfaces.nsIIOService;

        var loader = Components.classes[jssslContractID].getService(jssslIID);
        var iosvc = Components.classes[iosvcContractID].getService(iosvcIID);

        // Note that unintuitively, __LOCATION__.parent == .
        // We expect to find utils in ./../js
        var appdir = __LOCATION__.parent.parent;
        appdir.append("js");
        var scriptName = "calUtils.js";

        var f = appdir.clone();
        f.append(scriptName);

        try {
            var fileurl = iosvc.newFileURI(f);
            loader.loadSubScript(fileurl.spec, this.__parent__.__parent__);
        } catch (e) {
            dump("Error while loading " + fileurl.spec + "\n");
            throw e;
        }

        this.mUtilsLoaded = true;
    },
    
    registerSelf: function (compMgr, fileSpec, location, type) {
        compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
        compMgr.registerFactoryLocation(this.mCID,
                                        "Calendar iTIP Email Transport",
                                        this.mContractID,
                                        fileSpec,
                                        location,
                                        type);
    },

    getClassObject: function (compMgr, cid, iid) {
        if (!cid.equals(this.mCID))
            throw Components.results.NS_ERROR_NO_INTERFACE;

        if (!iid.equals(Components.interfaces.nsIFactory))
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

        this.loadUtils();

        return calItipEmailTransportFactory;
    },

    canUnload: function(compMgr) {
        return true;
    }
};

function NSGetModule(compMgr, fileSpec) {
    return calItipEmailTransportModule;
}

function LOG(aString) {
    if (!getPrefSafe("calendar.itip.email.log", false)) {
        return;
    }
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"].
                         getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage(aString);
    dump(aString + "\n");
}
