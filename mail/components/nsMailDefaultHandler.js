/* -*- indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

const nsISupports              = Components.interfaces.nsISupports;

const nsICommandLine           = Components.interfaces.nsICommandLine;
const nsICommandLineHandler    = Components.interfaces.nsICommandLineHandler;
const nsICommandLineValidator  = Components.interfaces.nsICommandLineValidator;
const nsIDOMWindow             = Components.interfaces.nsIDOMWindow;
const nsIFactory               = Components.interfaces.nsIFactory;
const nsIFileURL               = Components.interfaces.nsIFileURL;
const nsINetUtil               = Components.interfaces.nsINetUtil;
const nsISupportsString        = Components.interfaces.nsISupportsString;
const nsIURILoader             = Components.interfaces.nsIURILoader;

const NS_ERROR_ABORT = Components.results.NS_ERROR_ABORT;

const URI_INHERITS_SECURITY_CONTEXT = Components.interfaces.nsIProtocolHandler
                                        .URI_INHERITS_SECURITY_CONTEXT;

function resolveURIInternal(aCmdLine, aArgument) {
  var uri = aCmdLine.resolveURI(aArgument);

  if (!(uri instanceof nsIFileURL)) {
    return uri;
  }

  try {
    if (uri.file.exists())
      return uri;
  }
  catch (e) {
    Components.utils.reportError(e);
  }

  // We have interpreted the argument as a relative file URI, but the file
  // doesn't exist. Try URI fixup heuristics: see bug 290782.

  try {
    uri = Services.uriFixup.createFixupURI(aArgument, 0);
  }
  catch (e) {
    Components.utils.reportError(e);
  }

  return uri;
}

function handleIndexerResult(aFile) {
  // Do this here because xpcshell isn't too happy with this at startup
  Components.utils.import("resource:///modules/MailUtils.js");
  // Make sure the folder tree is initialized
  MailUtils.discoverFolders();

  // Use the search integration module to convert the indexer result into a
  // message header
  Components.utils.import("resource:///modules/SearchIntegration.js");
  let msgHdr = SearchIntegration.handleResult(aFile);

  // If we found a message header, open it, otherwise throw an exception
  if (msgHdr)
    MailUtils.displayMessage(msgHdr);
  else
    throw Components.results.NS_ERROR_FAILURE;
}

function mayOpenURI(uri)
{
  var ext = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
    .getService(Components.interfaces.nsIExternalProtocolService);

  return ext.isExposedProtocol(uri.scheme);
}

function openURI(uri)
{
  if (!mayOpenURI(uri))
    throw Components.results.NS_ERROR_FAILURE;

  var channel = Services.io.newChannelFromURI(uri);
  var loader = Components.classes["@mozilla.org/uriloader;1"]
                         .getService(Components.interfaces.nsIURILoader);

  // We cannot load a URI on startup asynchronously without protecting
  // the startup

  var loadgroup = Components.classes["@mozilla.org/network/load-group;1"]
                            .createInstance(Components.interfaces.nsILoadGroup);

  var loadlistener = {
    onStartRequest: function ll_start(aRequest, aContext) {
      Services.startup.enterLastWindowClosingSurvivalArea();
    },

    onStopRequest: function ll_stop(aRequest, aContext, aStatusCode) {
      Services.startup.exitLastWindowClosingSurvivalArea();
    },

    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIRequestObserver,
                                           Components.interfaces.nsISupportsWeakReference])
  };

  loadgroup.groupObserver = loadlistener;

  var listener = {
    onStartURIOpen: function(uri) { return false; },
    doContent: function(ctype, preferred, request, handler) {
      var newHandler = Components.classes["@mozilla.org/uriloader/content-handler;1?type=application/x-message-display"]
                                 .createInstance(Components.interfaces.nsIContentHandler);
      newHandler.handleContent("application/x-message-display", this, request);
      return true;
    },
    isPreferred: function(ctype, desired) {
      if (ctype == "message/rfc822")
        return true;
      return false;
    },
    canHandleContent: function(ctype, preferred, desired) { return false; },
    loadCookie: null,
    parentContentListener: null,
    getInterface: function(iid) {
      if (iid.equals(Components.interfaces.nsIURIContentListener))
        return this;

      if (iid.equals(Components.interfaces.nsILoadGroup))
        return loadgroup;

      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
  };
  loader.openURI(channel, true, listener);
}

var nsMailDefaultHandler = {
  QueryInterface: XPCOMUtils.generateQI([nsICommandLineHandler,
                                         nsICommandLineValidator,
                                         nsIFactory]),

  /* nsICommandLineHandler */

  handle : function mdh_handle(cmdLine) {
    var uri;

    try {
      var remoteCommand = cmdLine.handleFlagWithParam("remote", true);
    }
    catch (e) {
      throw NS_ERROR_ABORT;
    }

    if (remoteCommand != null) {
      try {
        var a = /^\s*(\w+)\(([^\)]*)\)\s*$/.exec(remoteCommand);
        var remoteVerb = a[1].toLowerCase();
        var remoteParams = a[2].split(",");

        switch (remoteVerb) {
        case "openurl":
          var xuri = cmdLine.resolveURI(remoteParams[0]);
          openURI(xuri);
          break;

        case "mailto":
          var xuri = cmdLine.resolveURI("mailto:" + remoteParams[0]);
          openURI(xuri);
          break;

        case "xfedocommand":
          // xfeDoCommand(openBrowser)
          switch (remoteParams[0].toLowerCase()) {
          case "openinbox":
            var win = Services.wm.getMostRecentWindow("mail:3pane");
            if (win) {
              win.focus();
            }
            else {
              // Bug 277798 - we have to pass an argument to openWindow(), or
              // else it won't honor the dialog=no instruction.
              var argstring = Components.classes["@mozilla.org/supports-string;1"]
                                        .createInstance(nsISupportsString);
              Services.ww.openWindow(null, "chrome://messenger/content/", "_blank",
                                     "chrome,dialog=no,all", argstring);
            }
            break;

          case "composemessage":
            var argstring = Components.classes["@mozilla.org/supports-string;1"]
                                      .createInstance(nsISupportsString);
            remoteParams.shift();
            argstring.data = remoteParams.join(",");
            Services.ww.openWindow(null, "chrome://messenger/content/messengercompose/messengercompose.xul",
                                   "_blank", "chrome,dialog=no,all", argstring);
            break;

          default:
            throw Components.results.NS_ERROR_ABORT;
          }
          break;

        default:
          // Somebody sent us a remote command we don't know how to process:
          // just abort.
          throw Components.results.NS_ERROR_ABORT;
        }

        cmdLine.preventDefault = true;
      }
      catch (e) {
        // If we had a -remote flag but failed to process it, throw
        // NS_ERROR_ABORT so that the xremote code knows to return a failure
        // back to the handling code.
        dump(e);
        throw Components.results.NS_ERROR_ABORT;
      }
    }

    var chromeParam = cmdLine.handleFlagWithParam("chrome", false);
    if (chromeParam) {
      try {
        var features = "chrome,dialog=no,all";
        var argstring = Components.classes["@mozilla.org/supports-string;1"]
                                  .createInstance(nsISupportsString);
        var uri = resolveURIInternal(cmdLine, chromeParam);
        var netutil = Components.classes["@mozilla.org/network/util;1"]
                                .getService(nsINetUtil);
        // only load URIs which do not inherit chrome privs
        if (!netutil.URIChainHasFlags(uri, URI_INHERITS_SECURITY_CONTEXT)) {
          Services.ww.openWindow(null, uri.spec, "_blank",
                                 "chrome,dialog=no,all", argstring);
          cmdLine.preventDefault = true;
        }
      }
      catch (e) {
        dump(e);
      }
    }

    if (cmdLine.handleFlag("silent", false)) {
      cmdLine.preventDefault = true;
    }

    if (cmdLine.handleFlag("options", false)) {
      // Open the options window
      let instantApply = Services.prefs
                                 .getBoolPref("browser.preferences.instantApply");
      let features = "chrome,titlebar,toolbar" +
                     (instantApply ? ",dialog=no" : ",modal");

      Services.ww.openWindow(null,
        "chrome://messenger/content/preferences/preferences.xul",
        "_blank", features, null);

    }

    // The URI might be passed as the argument to the file parameter
    uri = cmdLine.handleFlagWithParam("file", false);

    var count = cmdLine.length;
    if (count) {
      var i = 0;
      while (i < count) {
        var curarg = cmdLine.getArgument(i);
        if (!curarg.startsWith("-"))
          break;

        dump ("Warning: unrecognized command line flag " + curarg + "\n");
        // To emulate the pre-nsICommandLine behavior, we ignore the
        // argument after an unrecognized flag.
        i += 2;
        // xxxbsmedberg: make me use the console service!
      }

      if (i < count) {
        uri = cmdLine.getArgument(i);

        // mailto: URIs are frequently passed with spaces in them. They should be
        // escaped into %20, but we hack around bad clients, see bug 231032
        if (uri.startsWith("mailto:")) {
          while (++i < count) {
            var testarg = cmdLine.getArgument(i);
            if (testarg.startsWith("-"))
              break;

            uri += " " + testarg;
          }
        }
      }
    }

    if (!uri && cmdLine.preventDefault)
      return;

    if (!uri && cmdLine.state != nsICommandLine.STATE_INITIAL_LAUNCH) {
      try {
        var wlist = Services.wm.getEnumerator("mail:3pane");
        if (wlist.hasMoreElements()) {
          var window = wlist.getNext().QueryInterface(nsIDOMWindow);
          window.focus();
          return;
        }
      }
      catch (e) {
        dump(e);
      }
    }

    if (uri) {
      if (uri.toLowerCase().startsWith("feed:")) {
        try {
          Components.classes["@mozilla.org/newsblog-feed-downloader;1"]
                    .getService(Components.interfaces.nsINewsBlogFeedDownloader)
                    .subscribeToFeed(uri, null, null);
        }
        catch (e) {
          // If feed handling is not installed, do nothing
        }
      }
      else if (uri.toLowerCase().endsWith(".mozeml") || uri.toLowerCase().endsWith(".wdseml")) {
        handleIndexerResult(cmdLine.resolveFile(uri));
        cmdLine.preventDefault = true;
      }
      else if (uri.toLowerCase().endsWith(".eml")) {
        // Open this eml in a new message window
        let file = cmdLine.resolveFile(uri);
        // No point in trying to open a file if it doesn't exist or is empty
        if (file.exists() && file.fileSize > 0) {
          // Get the URL for this file
          let fileURL = Services.io.newFileURI(file)
                                .QueryInterface(Components.interfaces.nsIFileURL);
          fileURL.query = "?type=application/x-message-display";

          Services.ww.openWindow(null,
                                 "chrome://messenger/content/messageWindow.xul",
                                 "_blank", "all,chrome,dialog=no,status,toolbar",
                                 fileURL);
          cmdLine.preventDefault = true;
        }
        else {
          let bundle = Services.strings.createBundle("chrome://messenger/locale/messenger.properties");
          let title, message;
          if (!file.exists()) {
            title = bundle.GetStringFromName("fileNotFoundTitle");
            message = bundle.formatStringFromName("fileNotFoundMsg", [file.path], 1);
          }
          else {
            // The file is empty
            title = bundle.GetStringFromName("fileEmptyTitle");
            message = bundle.formatStringFromName("fileEmptyMsg", [file.path], 1);
          }

          Services.prompt.alert(null, title, message);
        }
      }
      else if (uri.toLowerCase().endsWith(".vcf")) {
        // A VCard! Be smart and open the "add contact" dialog.
        let file = cmdLine.resolveFile(uri);
        if (file.exists() && file.fileSize > 0) {
          NetUtil.asyncFetch(file, function(inputStream, status) {
            if (!Components.isSuccessCode(status)) {
              return;
            }

            let data = NetUtil.readInputStreamToString(
              inputStream, inputStream.available());
            let card = MailServices.ab.escapedVCardToAbCard(data);
            Services.ww.openWindow(
              null,
              "chrome://messenger/content/addressbook/abNewCardDialog.xul",
              "_blank",
              "chrome,resizable=no,titlebar,modal,centerscreen",
              card);
          });
        }
      }
      else {
        // This must be a regular filename. Use it to create a new message with attachment.
        let msgParams = Components.classes["@mozilla.org/messengercompose/composeparams;1"]
                                  .createInstance(Components.interfaces.nsIMsgComposeParams);
        let composeFields = Components.classes["@mozilla.org/messengercompose/composefields;1"]
                                      .createInstance(Components.interfaces.nsIMsgCompFields);
        let attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                                   .createInstance(Components.interfaces.nsIMsgAttachment);
        let localFile = Components.classes["@mozilla.org/file/local;1"]
                                  .createInstance(Components.interfaces.nsILocalFile);
        let fileHandler = Services.io.getProtocolHandler("file")
                                     .QueryInterface(Components.interfaces.nsIFileProtocolHandler);

        try {
          // Unescape the URI so that we work with clients that escape spaces.
          localFile.initWithPath(unescape(uri));
          attachment.url = fileHandler.getURLSpecFromFile(localFile);
          composeFields.addAttachment(attachment);

          msgParams.type = Components.interfaces.nsIMsgCompType.New;
          msgParams.format = Components.interfaces.nsIMsgCompFormat.Default;
          msgParams.composeFields = composeFields;

          MailServices.compose.OpenComposeWindowWithParams(null, msgParams);
        } catch (e) {
          openURI(cmdLine.resolveURI(uri));
        }
      }
    } else {
      var argstring = Components.classes["@mozilla.org/supports-string;1"]
                                .createInstance(nsISupportsString);

      Services.ww.openWindow(null, "chrome://messenger/content/", "_blank",
                             "chrome,dialog=no,all", argstring);
    }
  },

  /* nsICommandLineValidator */
  validate : function mdh_validate(cmdLine) {
    var osintFlagIdx = cmdLine.findFlag("osint", false);
    if (osintFlagIdx == -1)
      return;

    // Other handlers may use osint so only handle the osint flag if the mail
    // or compose flag is also present and the command line is valid.
    var mailFlagIdx = cmdLine.findFlag("mail", false);
    var composeFlagIdx = cmdLine.findFlag("compose", false);
    if (mailFlagIdx == -1 && composeFlagIdx == -1)
      return;

    // If both flags are present use the first flag found so the command line
    // length test will fail.
    if (mailFlagIdx > -1 && composeFlagIdx > -1)
      var actionFlagIdx = mailFlagIdx > composeFlagIdx ? composeFlagIdx : mailFlagIdx;
    else
      actionFlagIdx = mailFlagIdx > -1 ? mailFlagIdx : composeFlagIdx;

    if (actionFlagIdx && (osintFlagIdx > -1)) {
      var param = cmdLine.getArgument(actionFlagIdx + 1);
      if (cmdLine.length != actionFlagIdx + 2 ||
          /thunderbird.url.(mailto|news):/.test(param))
        throw NS_ERROR_ABORT;
      cmdLine.handleFlag("osint", false)
    }
  },

  helpInfo : "  -options           Open the options dialog.\n" +
             "  -file              Open the specified email file.\n",

  /* nsIFactory */

  createInstance : function mdh_CI(outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  lockFactory : function mdh_lock(lock) {
    /* no-op */
  }
};

function mailDefaultCommandLineHandler() {}

mailDefaultCommandLineHandler.prototype = {
  classDescription: "Mail default commandline handler",
  classID: Components.ID("{44346520-c5d2-44e5-a1ec-034e04d7fac4}"),
  contractID: "@mozilla.org/mail/clh;1",

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIModule]),

  _xpcom_factory: nsMailDefaultHandler
}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([mailDefaultCommandLineHandler]);
