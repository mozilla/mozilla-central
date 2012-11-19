/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

const nsISupports             = Components.interfaces.nsISupports;
const nsIBrowserDOMWindow     = Components.interfaces.nsIBrowserDOMWindow;
const nsIBrowserHistory       = Components.interfaces.nsIBrowserHistory;
const nsIBrowserSearchService = Components.interfaces.nsIBrowserSearchService;
const nsIChannel              = Components.interfaces.nsIChannel;
const nsICommandLine          = Components.interfaces.nsICommandLine;
const nsICommandLineHandler   = Components.interfaces.nsICommandLineHandler;
const nsICommandLineValidator = Components.interfaces.nsICommandLineValidator;
const nsIComponentRegistrar   = Components.interfaces.nsIComponentRegistrar;
const nsIContentHandler       = Components.interfaces.nsIContentHandler;
const nsIDOMWindow            = Components.interfaces.nsIDOMWindow;
const nsIFactory              = Components.interfaces.nsIFactory;
const nsIFileURL              = Components.interfaces.nsIFileURL;
const nsIHttpProtocolHandler  = Components.interfaces.nsIHttpProtocolHandler;
const nsINetUtil              = Components.interfaces.nsINetUtil;
const nsIIOService            = Components.interfaces.nsIIOService;
const nsIPrefService          = Components.interfaces.nsIPrefService;
const nsIPrefBranch           = Components.interfaces.nsIPrefBranch;
const nsIPrefLocalizedString  = Components.interfaces.nsIPrefLocalizedString;
const nsISupportsString       = Components.interfaces.nsISupportsString;
const nsIURIFixup             = Components.interfaces.nsIURIFixup;
const nsIWindowMediator       = Components.interfaces.nsIWindowMediator;
const nsIWindowWatcher        = Components.interfaces.nsIWindowWatcher;
const nsIWebNavigationInfo    = Components.interfaces.nsIWebNavigationInfo;

const NS_ERROR_WONT_HANDLE_CONTENT = 0x805d0001;

const URI_INHERITS_SECURITY_CONTEXT = nsIHttpProtocolHandler
                                        .URI_INHERITS_SECURITY_CONTEXT;

const NS_GENERAL_STARTUP_PREFIX = "@mozilla.org/commandlinehandler/general-startup;1?type=";

function shouldLoadURI(aURI)
{
  if (aURI && !aURI.schemeIs("chrome"))
    return true;

  dump("*** Preventing external load of chrome: URI into browser window\n");
  dump("    Use -chrome <uri> instead\n");
  return false;
}

function resolveURIInternal(aCmdLine, aArgument)
{
  try {
    var file = aCmdLine.resolveFile(aArgument);
    if (file.exists()) {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                .getService(nsIIOService);
      return ioService.newFileURI(file);
    }
  } catch (e) {
  }

  // We have interpreted the argument as a relative file URI, but the file
  // doesn't exist. Try URI fixup heuristics: see bug 290782.
 
  try {
    var urifixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                             .getService(nsIURIFixup);

    return urifixup.createFixupURI(aArgument,
                                   nsIURIFixup.FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP);
  } catch (e) {
    Components.utils.reportError(e);
  }

  return null;
}

function getHomePageGroup()
{
  var homePage = Services.prefs.getComplexValue("browser.startup.homepage",
                                                nsIPrefLocalizedString).data;

  var count = 0;
  try {
    count = Services.prefs.getIntPref("browser.startup.homepage.count");
  } catch (e) {
  }

  for (var i = 1; i < count; ++i) {
    try {
      homePage += '\n' + Services.prefs.getComplexValue("browser.startup.homepage." + i,
                                                        nsISupportsString).data;
    } catch (e) {
    }
  }
  return homePage;
}

function needHomePageOverride()
{
  var savedmstone = null;
  try {
    savedmstone = Services.prefs.getCharPref("browser.startup.homepage_override.mstone");
    if (savedmstone == "ignore")
      return false;
  } catch (e) {
  }

  var mstone = Components.classes["@mozilla.org/network/protocol;1?name=http"]
                         .getService(nsIHttpProtocolHandler).misc;

  if (mstone == savedmstone)
    return false;

  Services.prefs.setCharPref("browser.startup.homepage_override.mstone", mstone);

  return true;
}

function getURLToLoad()
{
  var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                            .getService(Components.interfaces.nsIURLFormatter);

  if (needHomePageOverride()) {
    try {
      return formatter.formatURLPref("startup.homepage_override_url");
    } catch (e) {
    }
  }

  try {
    var ss = Components.classes["@mozilla.org/suite/sessionstartup;1"]
                       .getService(Components.interfaces.nsISessionStartup);
    // return about:blank if we are restoring previous session
    if (ss.doRestore())
      return "about:blank";
  } catch (e) {
  }

  try {
    var st = Components.classes["@mozilla.org/suite/sessionstore;1"]
                       .getService(Components.interfaces.nsISessionStore);
    // return about:blank if the last window was closed and should be restored
    if (st.doRestoreLastWindow())
      return "about:blank";
  } catch (e) {
  }

  try {
    switch (Services.prefs.getIntPref("browser.startup.page")) {
    case 1:
      return getHomePageGroup();

    case 2:
      return Services.prefs.getComplexValue("browser.history.last_page_visited",
                                            nsISupportsString).data;
    }
  } catch (e) {
  } 

  return "about:blank";
}

function openWindow(parent, url, features, arg)
{
  var wwatch = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                         .getService(nsIWindowWatcher);
  var argstring = Components.classes["@mozilla.org/supports-string;1"]
                            .createInstance(nsISupportsString);
  argstring.data = arg;
  return wwatch.openWindow(parent, url, "", features, argstring);
}

function openPreferences()
{
  var win = getMostRecentWindow("mozilla:preferences");
  if (win)
    win.focus();
  else
    openWindow(null, "chrome://communicator/content/pref/preferences.xul",
               "chrome,titlebar,dialog=no,resizable", "");
}

function getMostRecentWindow(aType)
{
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(nsIWindowMediator);
  return wm.getMostRecentWindow(aType);
}

function getBrowserURL()
{
  try {
    return Services.prefs.getCharPref("browser.chromeURL");
  } catch (e) {
  }
  return "chrome://navigator/content/navigator.xul";
}

function handURIToExistingBrowser(uri, location, features)
{
  if (!shouldLoadURI(uri))
    return;

  var navWin = getMostRecentWindow("navigator:browser");
  if (navWin)
    navWin.browserDOMWindow.openURI(uri, null, location,
                                    nsIBrowserDOMWindow.OPEN_EXTERNAL);
  else
    openWindow(null, getBrowserURL(), features, uri.spec);
}

function doSearch(aSearchTerm, aFeatures) {
  var ss = Components.classes["@mozilla.org/browser/search-service;1"]
                     .getService(nsIBrowserSearchService);

  var submission = ss.defaultEngine.getSubmission(aSearchTerm);
  
  // fill our nsIMutableArray with uri-as-wstring, null, null, postData
  var sa = Components.classes["@mozilla.org/array;1"]
                     .createInstance(Components.interfaces.nsIMutableArray);
  
  var uristring = Components.classes["@mozilla.org/supports-string;1"]
                            .createInstance(nsISupportsString);
  uristring.data = submission.uri.spec;

  sa.appendElement(uristring, false);
  sa.appendElement(null, false);
  sa.appendElement(null, false);
  sa.appendElement(submission.postData, false);

  // XXXbsmedberg: use handURIToExistingBrowser to obey tabbed-browsing
  // preferences, but need nsIBrowserDOMWindow extensions
  var wwatch = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                         .getService(nsIWindowWatcher);

  return wwatch.openWindow(null, getBrowserURL(), "_blank", aFeatures, sa);
}

var nsBrowserContentHandler = {
  get wrappedJSObject() {
    return this;
  },

  /* nsISupports */
  QueryInterface: function QueryInterface(iid) {
    if (iid.equals(nsISupports) ||
        iid.equals(nsICommandLineHandler) ||
        iid.equals(nsICommandLine) ||
        iid.equals(nsICommandLineValidator) ||
        iid.equals(nsIContentHandler) ||
        iid.equals(nsIFactory))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  _handledURI: null,

  /* nsICommandLineHandler */
  handle: function handle(cmdLine) {
    var features = "chrome,all,dialog=no";
    try {
      var width = cmdLine.handleFlagWithParam("width", false);
      if (width != null)
        features += ",width=" + width;
    } catch (e) {
    }
    try {
      var height = cmdLine.handleFlagWithParam("height", false);
      if (height != null)
        features += ",height=" + height;
    } catch (e) {
    }

    try {
      var remote = cmdLine.handleFlagWithParam("remote", true);
      if (/^\s*(\w+)\s*\(\s*([^\s,]+)\s*,?\s*([^\s]*)\s*\)\s*$/.test(remote)) {
        switch (RegExp.$1.toLowerCase()) {
        case "openurl":
        case "openfile":
          // openURL(<url>)
          // openURL(<url>,new-window)
          // openURL(<url>,new-tab)

          var uri = resolveURIInternal(cmdLine, RegExp.$2);

          var location = nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW;
          if (RegExp.$3 == "new-window")
            location = nsIBrowserDOMWindow.OPEN_NEWWINDOW;
          else if (RegExp.$3 == "new-tab")
            location = nsIBrowserDOMWindow.OPEN_NEWTAB;

          handURIToExistingBrowser(uri, location, features);
          break;

        case "mailto":
          openWindow(null, "chrome://messenger/content/messengercompose/messengercompose.xul", features, RegExp.$2);
          break;

        case "xfedocommand":
          switch (RegExp.$2.toLowerCase()) {
          case "openbrowser":
            openWindow(null, getBrowserURL(), features, RegExp.$3 || getURLToLoad());
            break;
          
          case "openinbox":
            openWindow(null, "chrome://messenger/content", features);
            break;

          case "composemessage":
            openWindow(null, "chrome://messenger/content/messengercompose/messengercompose.xul", features, RegExp.$3);
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
    } catch (e) {
      // If we had a -remote flag but failed to process it, throw
      // NS_ERROR_ABORT so that the xremote code knows to return a failure
      // back to the handling code.
      throw Components.results.NS_ERROR_ABORT;
    }

    try {
      var browserParam = cmdLine.handleFlagWithParam("browser", false);
      if (browserParam) {
        openWindow(null, getBrowserURL(), features, browserParam);
        cmdLine.preventDefault = true;
      }
    } catch (e) {
      if (cmdLine.handleFlag("browser", false)) {
        openWindow(null, getBrowserURL(), features, getURLToLoad());
        cmdLine.preventDefault = true;
      }
    }

    try {
      var privateParam = cmdLine.handleFlagWithParam("private", false);
      if (privateParam) {
        openWindow(null, getBrowserURL(), "private," + features, privateParam);
        cmdLine.preventDefault = true;
      }
    } catch (e) {
      if (cmdLine.handleFlag("private", false)) {
        openWindow(null, getBrowserURL(), "private," + features, "about:privatebrowsing");
        cmdLine.preventDefault = true;
      }
    }

    // If we don't have a profile selected yet (e.g. the Profile Manager is
    // displayed) we will crash if we open an url and then select a profile. To
    // prevent this handle all url command line flag and set the command line's
    // preventDefault to true to prevent the display of the ui. The initial
    // command line will be retained when nsAppRunner calls LaunchChild though
    // urls launched after the initial launch will be lost.
    try {
      // This will throw when a profile has not been selected.
      var fl = Components.classes["@mozilla.org/file/directory_service;1"]
                         .getService(Components.interfaces.nsIProperties);
      fl.get("ProfD", Components.interfaces.nsILocalFile);
    } catch (e) {
      cmdLine.preventDefault = true;
      throw Components.results.NS_ERROR_ABORT;
    }

    try {
      var urlParam = cmdLine.handleFlagWithParam("url", false);
      if (urlParam) {
        if (this._handledURI == urlParam) {
          this._handledURI = null;
        } else {
          if (cmdLine.handleFlag("requestpending", false) &&
              cmdLine.state == nsICommandLine.STATE_INITIAL_LAUNCH) {
            // A DDE request with the URL will follow and the DDE handling code
            // will send it to the commandline handler via
            // "mozilla -url http://www.foo.com". Store the URL so we can
            // ignore this request later
            this._handledURI = urlParam;
          } 

          urlParam = resolveURIInternal(cmdLine, urlParam);
          handURIToExistingBrowser(urlParam,
                                   nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW,
                                   features);
        }
        cmdLine.preventDefault = true;
      }
    } catch (e) {
    }

    var param;
    try {
      while ((param = cmdLine.handleFlagWithParam("new-window", false)) != null) {
        var uri = resolveURIInternal(cmdLine, param);
        handURIToExistingBrowser(uri, nsIBrowserDOMWindow.OPEN_NEWWINDOW, features);
        cmdLine.preventDefault = true;
      }
    } catch (e) {
    }

    try {
      while ((param = cmdLine.handleFlagWithParam("new-tab", false)) != null) {
        var uri = resolveURIInternal(cmdLine, param);
        handURIToExistingBrowser(uri, nsIBrowserDOMWindow.OPEN_NEWTAB, features);
        cmdLine.preventDefault = true;
      }
    } catch (e) {
    }

    try {
      var chromeParam = cmdLine.handleFlagWithParam("chrome", false);
      if (chromeParam) {
        // only load URIs which do not inherit chrome privs
        var uri = resolveURIInternal(cmdLine, chromeParam);
        var netutil = Components.classes["@mozilla.org/network/util;1"]
                                .getService(nsINetUtil);
        if (!netutil.URIChainHasFlags(uri, URI_INHERITS_SECURITY_CONTEXT)) {
          openWindow(null, uri.spec, features);
          cmdLine.preventDefault = true;
        }
      }
    } catch (e) {
    }
 
    try {
      var fileParam = cmdLine.handleFlagWithParam("file", false);
      if (fileParam) {
       fileParam = resolveURIInternal(cmdLine, fileParam);
       handURIToExistingBrowser(fileParam, nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW, features);
       cmdLine.preventDefault = true;
      }
    } catch (e) {
    }

    var searchParam = cmdLine.handleFlagWithParam("search", false);
    if (searchParam) {
      doSearch(searchParam, features);
      cmdLine.preventDefault = true;
    }

    if (cmdLine.handleFlag("preferences", false)) {
      openPreferences();
      cmdLine.preventDefault = true;
    }

    if (cmdLine.handleFlag("silent", false))
      cmdLine.preventDefault = true;

    if (!cmdLine.preventDefault && cmdLine.length) {
      var arg = cmdLine.getArgument(0);
      if (!/^-/.test(arg)) {
        try {
          arg = resolveURIInternal(cmdLine, arg);
          handURIToExistingBrowser(arg, nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW, features);
          cmdLine.preventDefault = true;
        } catch (e) {
        }
      }
    }

    if (!cmdLine.preventDefault) {
      this.realCmdLine = cmdLine;

      var prefBranch = Services.prefs.getBranch("general.startup.");

      var startupArray = prefBranch.getChildList("");

      for (var i = 0; i < startupArray.length; ++i) {
        this.currentArgument = startupArray[i];
        var contract = NS_GENERAL_STARTUP_PREFIX + this.currentArgument;
        if (contract in Components.classes) {
          // Ignore any exceptions - we can't do anything about them here.
          try {
            if (prefBranch.getBoolPref(this.currentArgument)) {
              var handler = Components.classes[contract].getService(nsICommandLineHandler);
              if (handler.wrappedJSObject)
                handler.wrappedJSObject.handle(this);
              else
                handler.handle(this);
            }
          } catch (e) {
            Components.utils.reportError(e);
          }
        }
      }

      this.realCmdLine = null;
    }

    if (!cmdLine.preventDefault) {
      var homePage = getURLToLoad();
      if (!/\n/.test(homePage)) {
        try {
          var urifixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                                   .getService(nsIURIFixup);
          var uri = urifixup.createFixupURI(homePage, 0);
          handURIToExistingBrowser(uri, nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW, features);
          cmdLine.preventDefault = true;
        } catch (e) {
        }
      }

      if (!cmdLine.preventDefault) {
        openWindow(null, getBrowserURL(), features, homePage);
        cmdLine.preventDefault = true;
      }
    }

  },

  /* nsICommandLineValidator */
  validate: function validate(cmdLine) {
    var osintFlagIdx = cmdLine.findFlag("osint", false);

    // If the osint flag is not present and we are not called by DDE then we're safe
    if (cmdLine.state != nsICommandLine.STATE_REMOTE_EXPLICIT &&
        cmdLine.findFlag("osint", false) == -1)
    return;

    // Other handlers may use osint so only handle the osint flag if a
    // flag is also present and the command line is valid.
    ["url", "news", "compose"].forEach(function(value) {
      var flagIdx = cmdLine.findFlag(value, false);

      if (flagIdx > -1) {
        var testExpr = new RegExp("seamonkey" + value + ":");
        if (cmdLine.length != flagIdx + 2 ||
            testExpr.test(cmdLine.getArgument(flagIdx + 1)))
          throw Components.results.NS_ERROR_ABORT;
        cmdLine.handleFlag("osint", false);
      }
    });
  },

  helpInfo: "  -browser <url>     Open a browser window.\n" +
            "  -private <url>     Open a private window.\n" +
            "  -new-window <url>  Open <url> in a new browser window.\n" +
            "  -new-tab <url>     Open <url> in a new browser tab.\n" +
            "  -url <url>         Open the specified url.\n" +
            "  -chrome <url>      Open the specified chrome.\n" +
            "  -search <term>     Search <term> with your default search engine.\n" +
            "  -preferences       Open Preferences dialog.\n",

  /* nsICommandLine */
  length: 1,

  getArgument: function getArgument(index) {
    if (index == 0)
      return this.currentArgument;

    throw Components.results.NS_ERROR_INVALID_ARG;
  },

  findFlag: function findFlag(flag, caseSensitive) {
    if (caseSensitive)
      return flag == this.currentArgument ? 0 : -1;
    return flag.toLowerCase() == this.currentArgument.toLowerCase() ? 0 : -1;
  },

  removeArguments: function removeArguments(start, end) {
    // do nothing
  },

  handleFlag: function handleFlag(flag, caseSensitive) {
    if (caseSensitive)
      return flag == this.currentArgument;
    return flag.toLowerCase() == this.currentArgument.toLowerCase();
  },

  handleFlagWithParam : function handleFlagWithParam(flag, caseSensitive) {
    if (this.handleFlag(flag, caseSensitive))
      throw Components.results.NS_ERROR_INVALID_ARG;
  },

  get state() {
    return this.realCmdLine.state;
  },

  get preventDefault() {
    return this.realCmdLine.preventDefault;
  },

  set preventDefault(preventDefault) {
    return this.realCmdLine.preventDefault = preventDefault;
  },

  get workingDirectory() {
    return this.realCmdLine.workingDirectory;
  },

  get windowContext() {
    return this.realCmdLine.windowContext;
  },

  resolveFile: function resolveFile(arg) {
    return this.realCmdLine.resolveFile(arg);
  },

  resolveURI: function resolveURI(arg) {
    return this.realCmdLine.resolveURI(arg);
  },

  /* nsIContentHandler */
  handleContent: function handleContent(contentType, context, request) {
    var webNavInfo = Components.classes["@mozilla.org/webnavigation-info;1"]
                               .getService(nsIWebNavigationInfo);
    if (!webNavInfo.isTypeSupported(contentType, null))
      throw NS_ERROR_WONT_HANDLE_CONTENT;

    request.QueryInterface(nsIChannel);
    handURIToExistingBrowser(request.URI,
      nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW, "chrome,all,dialog=no");
    request.cancel(Components.results.NS_BINDING_ABORTED);
  },

  /* nsIFactory */
  createInstance: function createInstance(outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },
    
  lockFactory: function lockFactory(lock) {
    /* no-op */
  }
};

const BROWSER_CID = Components.ID("{c2343730-dc2c-11d3-98b3-001083010e9b}");

function NSGetFactory(cid) {
  if (cid.number == BROWSER_CID)
    return nsBrowserContentHandler;
  throw Components.results.NS_ERROR_FACTORY_NOT_REGISTERED;
}
