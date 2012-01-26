/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Conley <mconley@mozilla.com>
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

/* A note to the curious: a large portion of this code was copied over from
 * mozilla/browser/base/content/browser.js
 */

#ifdef MOZ_CRASHREPORTER
XPCOMUtils.defineLazyServiceGetter(this, "gCrashReporter",
                                   "@mozilla.org/xre/app-info;1",
                                   "nsICrashReporter");
#endif

function getPluginInfo(pluginElement)
{
  var tagMimetype;
  var pluginsPage;
  if (pluginElement instanceof HTMLAppletElement) {
    tagMimetype = "application/x-java-vm";
  } else {
    if (pluginElement instanceof HTMLObjectElement) {
      pluginsPage = pluginElement.getAttribute("codebase");
    } else {
      pluginsPage = pluginElement.getAttribute("pluginspage");
    }

    // only attempt if a pluginsPage is defined.
    if (pluginsPage) {
      var doc = pluginElement.ownerDocument;
      var docShell = findChildShell(doc, gBrowser.docShell, null);
      try {
        pluginsPage = makeURI(pluginsPage, doc.characterSet, docShell.currentURI).spec;
      } catch (ex) {
        pluginsPage = "";
      }
    }

    tagMimetype = pluginElement.QueryInterface(Components.interfaces.nsIObjectLoadingContent)
                 .actualType;

    if (tagMimetype == "") {
      tagMimetype = pluginElement.type;
    }
  }

  return {mimetype: tagMimetype, pluginsPage: pluginsPage};
}

/**
 * Format a URL
 * eg:
 * echo formatURL("https://addons.mozilla.org/%LOCALE%/%APP%/%VERSION%/");
 * > https://addons.mozilla.org/en-US/firefox/3.0a1/
 *
 * Currently supported built-ins are LOCALE, APP, and any value from nsIXULAppInfo, uppercased.
 */
function formatURL(aFormat, aIsPref) {
  var formatter = Services.urlFormatter;
  return aIsPref ? formatter.formatURLPref(aFormat) : formatter.formatURL(aFormat);
}

var gPluginHandler = {
  addEventListeners: function ph_addEventListeners(browser) {
    browser.addEventListener("PluginNotFound", gPluginHandler, true);
    browser.addEventListener("PluginCrashed", gPluginHandler, true);
    browser.addEventListener("PluginBlocklisted", gPluginHandler, true);
    browser.addEventListener("PluginOutdated", gPluginHandler, true);
    browser.addEventListener("PluginDisabled", gPluginHandler, true);
    browser.addEventListener("NewPluginInstalled", gPluginHandler, true);
  },

  removeEventListeners: function ph_removeEventListeners(browser) {
    browser.removeEventListener("PluginNotFound", gPluginHandler);
    browser.removeEventListener("PluginCrashed", gPluginHandler);
    browser.removeEventListener("PluginBlocklisted", gPluginHandler);
    browser.removeEventListener("PluginOutdated", gPluginHandler);
    browser.removeEventListener("PluginDisabled", gPluginHandler);
    browser.removeEventListener("NewPluginInstalled", gPluginHandler);
  },

  get CrashSubmit() {
    delete this.CrashSubmit;
    Components.utils.import("resource://gre/modules/CrashSubmit.jsm", this);
    return this.CrashSubmit;
  },

  // Map the plugin's name to a filtered version more suitable for user UI.
  makeNicePluginName : function ph_makeNicePluginName(aName, aFilename) {
    if (aName == "Shockwave Flash")
      return "Adobe Flash";

    // Clean up the plugin name by stripping off any trailing version numbers
    // or "plugin". EG, "Foo Bar Plugin 1.23_02" --> "Foo Bar"
    return aName.replace(/\bplug-?in\b/i, "").replace(/[\s\d\.\-\_\(\)]+$/, "");
  },

  isTooSmall : function ph_isTooSmall(plugin, overlay) {
    // Is the <object>'s size too small to hold what we want to show?
    let pluginRect = plugin.getBoundingClientRect();
    // XXX bug 446693. The text-shadow on the submitted-report text at
    //     the bottom causes scrollHeight to be larger than it should be.
    let overflows = (overlay.scrollWidth > pluginRect.width) ||
                    (overlay.scrollHeight - 5 > pluginRect.height);
    return overflows;
  },

  addLinkClickCallback: function ph_addLinkClickCallback(linkNode, callbackName /*callbackArgs...*/) {
    // XXX just doing (callback)(arg) was giving a same-origin error. bug?
    let self = this;
    let callbackArgs = Array.prototype.slice.call(arguments).slice(2);
    linkNode.addEventListener("click",
                              function(evt) {
                                if (!evt.isTrusted)
                                  return;
                                evt.preventDefault();
                                if (callbackArgs.length == 0)
                                  callbackArgs = [ evt ];
                                (self[callbackName]).apply(self, callbackArgs);
                              },
                              true);

    linkNode.addEventListener("keydown",
                              function(evt) {
                                if (!evt.isTrusted)
                                  return;
                                if (evt.keyCode == evt.DOM_VK_RETURN) {
                                  evt.preventDefault();
                                  if (callbackArgs.length == 0)
                                    callbackArgs = [ evt ];
                                  evt.preventDefault();
                                  (self[callbackName]).apply(self, callbackArgs);
                                }
                              },
                              true);
  },

  handleEvent : function ph_handleEvent(event) {
    let self = gPluginHandler;
    let plugin = event.target;
    let doc = plugin.ownerDocument;

    // We're expecting the target to be a plugin.
    if (!(plugin instanceof Components.interfaces.nsIObjectLoadingContent))
      return;

    // Force a style flush, so that we ensure our binding is attached.
    plugin.clientTop;

    switch (event.type) {
      case "PluginCrashed":
        self.pluginInstanceCrashed(plugin, event);
        break;

      case "PluginNotFound":
        // For non-object plugin tags, register a click handler to install the
        // plugin. Object tags can, and often do, deal with that themselves,
        // so don't stomp on the page developers toes.
        if (!(plugin instanceof HTMLObjectElement)) {
          // We don't yet check to see if there's actually an installer available.
          let installStatus = doc.getAnonymousElementByAttribute(plugin, "class", "installStatus");
          installStatus.setAttribute("status", "ready");
          let iconStatus = doc.getAnonymousElementByAttribute(plugin, "class", "icon");
          iconStatus.setAttribute("status", "ready");

          let installLink = doc.getAnonymousElementByAttribute(plugin, "class", "installPluginLink");
          self.addLinkClickCallback(installLink, "installSinglePlugin", plugin);
        }
        /* FALLTHRU */

      case "PluginBlocklisted":
      case "PluginOutdated":
#ifdef XP_MACOSX
      case "npapi-carbon-event-model-failure":
#endif
        self.pluginUnavailable(plugin, event.type);
        break;

      case "PluginDisabled":
        let manageLink = doc.getAnonymousElementByAttribute(plugin, "class", "managePluginsLink");
        self.addLinkClickCallback(manageLink, "managePlugins");
        break;
    }

    // Hide the in-content UI if it's too big. The crashed plugin handler already did this.
    if (event.type != "PluginCrashed") {
      let overlay = doc.getAnonymousElementByAttribute(plugin, "class", "mainBox");
      if (self.isTooSmall(plugin, overlay))
          overlay.style.visibility = "hidden";
    }
  },

  newPluginInstalled : function ph_newPluginInstalled(event) {
    // browser elements are anonymous so we can't just use target.
    var browser = event.originalTarget;

    // clear the plugin list, now that at least one plugin has been installed
    browser.missingPlugins = null;

    var notificationBox = getNotificationBox(browser.contentWindow);
    var notification = notificationBox.getNotificationWithValue("missing-plugins");
    if (notification)
      notificationBox.removeNotification(notification);

    // reload the browser to make the new plugin show.
    browser.reload();
  },

  // Callback for user clicking on a missing (unsupported) plugin.
  installSinglePlugin: function ph_installSinglePlugin(plugin) {
    var missingPluginsArray = {};

    var pluginInfo = getPluginInfo(plugin);
    missingPluginsArray[pluginInfo.mimetype] = pluginInfo;

    openDialog("chrome://mozapps/content/plugins/pluginInstallerWizard.xul",
               "PFSWindow", "chrome,centerscreen,resizable=yes",
               {plugins: missingPluginsArray, browser: getBrowser});
  },

  // Callback for user clicking on a disabled plugin
  managePlugins: function ph_managePlugins(aEvent) {
    openAddonsMgr("addons://list/plugin");
  },

  // Callback for user clicking "submit a report" link
  submitReport : function ph_submitReport(pluginDumpID, browserDumpID) {
    // The crash reporter wants a DOM element it can append an IFRAME to,
    // which it uses to submit a form. Let's just give it curBrowser.

    var curBrowser = document.getElementById('tabmail').getBrowserForSelectedTab();
    this.CrashSubmit.submit(pluginDumpID, curBrowser, null, null);
    if (browserDumpID)
      this.CrashSubmit.submit(browserDumpID, curBrowser, null, null);
  },

  // Callback for user clicking a "reload page" link
  reloadPage: function ph_reloadPage(browser) {
    browser.reload();
  },

  // Callback for user clicking the help icon
  openPluginCrashHelpPage: function ph_openHelpPage() {
    // Grab the plugin crash support URL
    let url = Services.urlFormatter.formatURLPref("plugins.crash.supportUrl");
    // Now open up a content tab to display it in
    let tabmail = document.getElementById('tabmail');
    tabmail.openTab("contentTab", {contentPage: url,
                                   background: false});
  },

  // event listener for missing/blocklisted/outdated/carbonFailure plugins.
  pluginUnavailable: function ph_pluginUnavailable(plugin, eventType) {
    let Cc = Components.classes;
    let Ci = Components.interfaces;
    var tabmail = document.getElementById('tabmail');
    let browser = tabmail.getBrowserForDocument(plugin.ownerDocument
                                                .defaultView).browser;

    if (!browser.missingPlugins)
      browser.missingPlugins = {};

    var pluginInfo = getPluginInfo(plugin);
    browser.missingPlugins[pluginInfo.mimetype] = pluginInfo;

    var notificationBox = getNotificationBox(browser.contentWindow);

    // Should only display one of these warnings per page.
    // In order of priority, they are: outdated > missing > blocklisted
    let outdatedNotification = notificationBox.getNotificationWithValue("outdated-plugins");
    let blockedNotification  = notificationBox.getNotificationWithValue("blocked-plugins");
    let missingNotification  = notificationBox.getNotificationWithValue("missing-plugins");

    function showBlocklistInfo() {
      var url = formatURL("extensions.blocklist.detailsURL", true);
      tabmail.openTab("contentTab", {contentPage: url,
                                     background: false});
      return true;
    }

    function showOutdatedPluginsInfo() {
      Services.prefs.setBoolPref("plugins.update.notifyUser", false);
      var url = formatURL("plugins.update.url", true);
      tabmail.openTab("contentTab", {contentPage: url,
                                     background: false});
      return true;
    }

    function showPluginsMissing() {
      // get the urls of missing plugins
      var curBrowser = tabmail.getBrowserForSelectedTab();
      var missingPluginsArray = curBrowser.missingPlugins;
      if (missingPluginsArray) {
        openDialog("chrome://mozapps/content/plugins/pluginInstallerWizard.xul",
                   "PFSWindow", "chrome,centerscreen,resizable=yes",
                   {plugins: missingPluginsArray, browser: curBrowser});
      }
    }

#ifdef XP_MACOSX
    function carbonFailurePluginsRestartBrowser()
    {
      // Notify all windows that an application quit has been requested.
      let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].
                         createInstance(Ci.nsISupportsPRBool);
      Services.obs.notifyObservers(cancelQuit, "quit-application-requested", null);

      // Something aborted the quit process.
      if (cancelQuit.data)
        return;

      let as = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup);
      as.quit(Ci.nsIAppStartup.eRestarti386 | Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
    }
#endif

    let messengerBundle = document.getElementById("bundle_messenger");

    let notifications = {
      PluginBlocklisted : {
        barID: "blocked-plugins",
        iconURL: "chrome://mozapps/skin/plugins/notifyPluginBlocked.png",
        message: messengerBundle.getString("blockedpluginsMessage.title"),
        buttons: [{
          label: messengerBundle.getString("blockedpluginsMessage.infoButton.label"),
          accessKey: messengerBundle.getString("blockedpluginsMessage.infoButton.accesskey"),
          popup: null,
          callback: showBlocklistInfo
        },
        {
          label: messengerBundle.getString("blockedpluginsMessage.searchButton.label"),
          accessKey: messengerBundle.getString("blockedpluginsMessage.searchButton.accesskey"),
          popup: null,
          callback: showOutdatedPluginsInfo
        }],
      },
      PluginOutdated: {
        barID: "outdated-plugins",
        iconURL: "chrome://mozapps/skin/plugins/notifyPluginOutdated.png",
        message: messengerBundle.getString("outdatedpluginsMessage.title"),
        buttons: [{
          label: messengerBundle.getString("outdatedpluginsMessage.updateButton.label"),
          accessKey: messengerBundle.getString("outdatedpluginsMessage.updateButton.accesskey"),
          popup: null,
          callback: showOutdatedPluginsInfo
        }],
      },
      PluginNotFound: {
        barID: "missing-plugins",
        iconURL: "chrome://mozapps/skin/plugins/notifyPluginGeneric.png",
        message: messengerBundle.getString("missingpluginsMessage.title"),
        buttons: [{
          label: messengerBundle.getString("missingpluginsMessage.button.label"),
          accessKey: messengerBundle.getString("missingpluginsMessage.button.accesskey"),
          popup: null,
          callback: showPluginsMissing
        }],
      },
#ifdef XP_MACOSX
      "npapi-carbon-event-model-failure": {
        barID: "carbon-failure-plugins",
        iconURL: "chrome://mozapps/skin/plugins/notifyPluginGeneric.png",
        message: messengerBundle.getString("carbonFailurePluginsMessage.message"),
        buttons: [{
          label: messengerBundle.getString("carbonFailurePluginsMessage.restartButton.label"),
          accessKey: messengerBundle.getString("carbonFailurePluginsMessage.restartButton.accesskey"),
          popup: null,
          callback: carbonFailurePluginsRestartBrowser
        }],
      }
#endif
    };


    // If there is already an outdated plugin notification then do nothing
    if (outdatedNotification)
      return;

#ifdef XP_MACOSX
    if (eventType == "npapi-carbon-event-model-failure") {
      if (Services.prefs.getBoolPref("plugins.hide_infobar_for_carbon_failure_plugin"))
        return;

      let carbonFailureNotification =
        notificationBox.getNotificationWithValue("carbon-failure-plugins");

      if (carbonFailureNotification)
         carbonFailureNotification.close();

      let macutils = Cc["@mozilla.org/xpcom/mac-utils;1"].getService(Ci.nsIMacUtils);
      // if this is not a Universal build, just follow PluginNotFound path
      if (!macutils.isUniversalBinary)
        eventType = "PluginNotFound";
    }
#endif

    if (eventType == "PluginBlocklisted") {
      if (Services.prefs.getBoolPref("plugins.hide_infobar_for_missing_plugin"))
        return;

      if (blockedNotification || missingNotification)
        return;
    }
    else if (eventType == "PluginOutdated") {
      if (Services.prefs.getBoolPref("plugins.hide_infobar_for_outdated_plugin"))
        return;

      // Cancel any notification about blocklisting/missing plugins
      if (blockedNotification)
        blockedNotification.close();
      if (missingNotification)
        missingNotification.close();
    }
    else if (eventType == "PluginNotFound") {
      if (Services.prefs.getBoolPref("plugins.hide_infobar_for_missing_plugin"))
        return;


      if (missingNotification)
        return;

      // Cancel any notification about blocklisting plugins
      if (blockedNotification)
        blockedNotification.close();
    }

    let notify = notifications[eventType];
    notificationBox.appendNotification(notify.message, notify.barID, notify.iconURL,
                                       notificationBox.PRIORITY_WARNING_MEDIUM,
                                       notify.buttons);
  },

  // Crashed-plugin observer. Notified once per plugin crash, before events
  // are dispatched to individual plugin instances.
  pluginCrashed : function(subject, topic, data) {
    let propertyBag = subject;
    if (!(propertyBag instanceof Components.interfaces.nsIPropertyBag2) ||
        !(propertyBag instanceof Components.interfaces.nsIWritablePropertyBag2))
     return;

#ifdef MOZ_CRASHREPORTER
    let pluginDumpID = propertyBag.getPropertyAsAString("pluginDumpID");
    let browserDumpID = propertyBag.getPropertyAsAString("browserDumpID");
    let shouldSubmit = gCrashReporter.submitReports;
    let doPrompt = true; // XXX followup to get via gCrashReporter

    // Submit automatically when appropriate.
    if (pluginDumpID && shouldSubmit && !doPrompt) {
      this.submitReport(pluginDumpID, browserDumpID);
      // Submission is async, so we can't easily show failure UI.
      propertyBag.setPropertyAsBool("submittedCrashReport", true);
    }
#endif
  },

  // Crashed-plugin event listener. Called for every instance of a
  // plugin in content.
  pluginInstanceCrashed: function (plugin, aEvent) {
    // Ensure the plugin and event are of the right type.
    if (!(aEvent instanceof Components.interfaces.nsIDOMDataContainerEvent))
      return;

    let submittedReport = aEvent.getData("submittedCrashReport");
    let doPrompt = true; // XXX followup for .getData("doPrompt");
    let submitReports = true; // XXX followup for .getData("submitReports");
    let pluginName = aEvent.getData("pluginName");
    let pluginFilename = aEvent.getData("pluginFilename");
    let pluginDumpID = aEvent.getData("pluginDumpID");
    let browserDumpID = aEvent.getData("browserDumpID");
    let messengerBundle = document.getElementById("bundle_messenger");
    let tabmail = document.getElementById('tabmail');

    // Remap the plugin name to a more user-presentable form.
    pluginName = this.makeNicePluginName(pluginName, pluginFilename);

    let messageString = messengerBundle.getFormattedString("crashedpluginsMessage.title", [pluginName]);

    //
    // Configure the crashed-plugin placeholder.
    //
    let doc = plugin.ownerDocument;
    let overlay = doc.getAnonymousElementByAttribute(plugin, "class", "mainBox");
    let statusDiv = doc.getAnonymousElementByAttribute(plugin, "class", "submitStatus");
#ifdef MOZ_CRASHREPORTER
    let status;

    // Determine which message to show regarding crash reports.
    if (submittedReport) { // submitReports && !doPrompt, handled in observer
      status = "submitted";
    }
    else if (!submitReports && !doPrompt) {
      status = "noSubmit";
    }
    else { // doPrompt
      status = "please";
      // XXX can we make the link target actually be blank?
      let pleaseLink = doc.getAnonymousElementByAttribute(
                            plugin, "class", "pleaseSubmitLink");
      this.addLinkClickCallback(pleaseLink, "submitReport",
                                pluginDumpID, browserDumpID);
    }

    // If we don't have a minidumpID, we can't (or didn't) submit anything.
    // This can happen if the plugin is killed from the task manager.
    if (!pluginDumpID) {
      status = "noReport";
    }

    statusDiv.setAttribute("status", status);

    let bottomLinks = doc.getAnonymousElementByAttribute(plugin, "class", "msg msgBottomLinks");
    bottomLinks.style.display = "block";
    let helpIcon = doc.getAnonymousElementByAttribute(plugin, "class", "helpIcon");
    this.addLinkClickCallback(helpIcon, "openPluginCrashHelpPage");

    // If we're showing the link to manually trigger report submission, we'll
    // want to be able to update all the instances of the UI for this crash to
    // show an updated message when a report is submitted.
    if (doPrompt) {
      let observer = {
        QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                               Components.interfaces.nsISupportsWeakReference]),
        observe : function(subject, topic, data) {
          let propertyBag = subject;
          if (!(propertyBag instanceof Components.interfaces.nsIPropertyBag2))
            return;
          // Ignore notifications for other crashes.
          if (propertyBag.get("minidumpID") != pluginDumpID)
            return;
          statusDiv.setAttribute("status", data);
        },

        handleEvent : function(event) {
            // Not expected to be called, just here for the closure.
        }
      };

      // Use a weak reference, so we don't have to remove it...
      Services.obs.addObserver(observer, "crash-report-status", true);
      // ...alas, now we need something to hold a strong reference to prevent
      // it from being GC. But I don't want to manually manage the reference's
      // lifetime (which should be no greater than the page).
      // Clever solution? Use a closue with an event listener on the document.
      // When the doc goes away, so do the listener references and the closure.
      doc.addEventListener("mozCleverClosureHack", observer, false);
    }
#endif

    let crashText = doc.getAnonymousElementByAttribute(plugin, "class", "msg msgCrashed");
    crashText.textContent = messageString;
    let browser = tabmail.getBrowserForSelectedTab();

    let link = doc.getAnonymousElementByAttribute(plugin, "class", "reloadLink");
    this.addLinkClickCallback(link, "reloadPage", browser);

    let notificationBox = getNotificationBox(browser.contentWindow);

    // Is the <object>'s size too small to hold what we want to show?
    if (this.isTooSmall(plugin, overlay)) {
        // Hide the overlay's contents. Use visibility style, so that it
        // doesn't collapse down to 0x0.
        overlay.style.visibility = "hidden";
        // If another plugin on the page was large enough to show our UI, we
        // don't want to show a notification bar.
        if (!doc.mozNoPluginCrashedNotification)
          showNotificationBar(pluginDumpID, browserDumpID);
    } else {
        // If a previous plugin on the page was too small and resulted in
        // adding a notification bar, then remove it because this plugin
        // instance it big enough to serve as in-content notification.
        hideNotificationBar();
        doc.mozNoPluginCrashedNotification = true;
    }

    function hideNotificationBar() {
      let notification = notificationBox.getNotificationWithValue("plugin-crashed");
      if (notification)
        notificationBox.removeNotification(notification, true);
    }

    function showNotificationBar(pluginDumpID, browserDumpID) {
      // If there's already an existing notification bar, don't do anything.
      let messengerBundle = document.getElementById("bundle_messenger");
      let notification = notificationBox.getNotificationWithValue("plugin-crashed");
      if (notification)
        return;

      // Configure the notification bar
      let priority = notificationBox.PRIORITY_WARNING_MEDIUM;
      let iconURL = "chrome://mozapps/skin/plugins/notifyPluginCrashed.png";
      let reloadLabel = messengerBundle.getString("crashedpluginsMessage.reloadButton.label");
      let reloadKey   = messengerBundle.getString("crashedpluginsMessage.reloadButton.accesskey");
      let submitLabel = messengerBundle.getString("crashedpluginsMessage.submitButton.label");
      let submitKey   = messengerBundle.getString("crashedpluginsMessage.submitButton.accesskey");

      let buttons = [{
        label: reloadLabel,
        accessKey: reloadKey,
        popup: null,
        callback: function() { browser.reload(); },
      }];
#ifdef MOZ_CRASHREPORTER
      let submitButton = {
        label: submitLabel,
        accessKey: submitKey,
        popup: null,
          callback: function() { gPluginHandler.submitReport(pluginDumpID, browserDumpID); },
      };
      if (pluginDumpID)
        buttons.push(submitButton);
#endif

      let notification = notificationBox.appendNotification(messageString, "plugin-crashed",
                                                            iconURL, priority, buttons);

      // Add the "learn more" link.
      let XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      let link = notification.ownerDocument.createElementNS(XULNS, "label");
      let crashHelpUrl = Services.urlFormatter
                                 .formatURLPref("plugins.crash.supportUrl");
      link.className = "text-link";
      link.setAttribute("value", messengerBundle.getString("crashedpluginsMessage.learnMore"));
      link.href = crashHelpUrl;
      let description = notification.ownerDocument.getAnonymousElementByAttribute(notification, "anonid", "messageText");
      description.appendChild(link);

      // Remove the notfication when the page is reloaded.
      doc.defaultView.top.addEventListener("unload", function() {
        notificationBox.removeNotification(notification);
      }, false);
    }

  }
};

