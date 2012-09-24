/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Global Object to hold methods for the connections dialog.
 */

Components.utils.import("resource://gre/modules/Services.jsm");

var gConnectionsDialog = {
  /**
   * Handler function to be called before the pref window is closed (i.e
   * onbeforeaccept attribute).
   */
  beforeAccept: function gCD_beforeAccept() {
    var proxyTypePref = document.getElementById("network.proxy.type");
    if (proxyTypePref.value == 2) {
      this.doAutoconfigURLFixup();
      return true;
    }

    if (proxyTypePref.value != 1)
      return true;

    var httpProxyURLPref = document.getElementById("network.proxy.http");
    var httpProxyPortPref = document.getElementById("network.proxy.http_port");
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    if (shareProxiesPref.value) {
      var proxyPrefs = ["ssl", "ftp", "socks"];
      for (var i = 0; i < proxyPrefs.length; ++i) {
        var proxyServerURLPref = document.getElementById("network.proxy." + proxyPrefs[i]);
        var proxyPortPref = document.getElementById("network.proxy." + proxyPrefs[i] + "_port");
        var backupServerURLPref = document.getElementById("network.proxy.backup." + proxyPrefs[i]);
        var backupPortPref = document.getElementById("network.proxy.backup." + proxyPrefs[i] + "_port");
        backupServerURLPref.value = proxyServerURLPref.value;
        backupPortPref.value = proxyPortPref.value;
        proxyServerURLPref.value = httpProxyURLPref.value;
        proxyPortPref.value = httpProxyPortPref.value;
      }
    }
    
    var noProxiesPref = document.getElementById("network.proxy.no_proxies_on");
    noProxiesPref.value = noProxiesPref.value.replace(/[;]/g,',');
    
    return true;
  },
  

  /**
   * Handler function to be called when the network.proxy.type preference has
   * changed while the connection preferences dialog is open.
   */
  proxyTypeChanged: function gCD_proxyTypeChanged() {
    var proxyTypePref = document.getElementById("network.proxy.type");
    
    // Update http
    var httpProxyURLPref = document.getElementById("network.proxy.http");
    httpProxyURLPref.disabled = proxyTypePref.value != 1;
    var httpProxyPortPref = document.getElementById("network.proxy.http_port");
    httpProxyPortPref.disabled = proxyTypePref.value != 1;

    // Now update the other protocols
    this.updateProtocolPrefs();

    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    shareProxiesPref.disabled = proxyTypePref.value != 1;
    
    var noProxiesPref = document.getElementById("network.proxy.no_proxies_on");
    noProxiesPref.disabled = proxyTypePref.value != 1;
    
    var autoconfigURLPref = document.getElementById("network.proxy.autoconfig_url");
    autoconfigURLPref.disabled = proxyTypePref.value != 2;

    this.updateReloadButton();
  },

  /**
   * Updates the disabled state of the Reload button depending on the selected
   * proxy option.
   * 
   * Disable the "Reload PAC" button if the selected proxy type is not PAC or
   * if the current value of the PAC textbox does not match the value stored
   * in prefs.  Likewise, disable the reload button if PAC is not configured
   * in prefs.
   */
  updateReloadButton: function gCD_updateReloadButton() {
    var typedURL = document.getElementById("networkProxyAutoconfigURL").value;
    var proxyTypeCur = document.getElementById("network.proxy.type").value;

    var pacURL = Services.prefs.getCharPref("network.proxy.autoconfig_url");
    var proxyType = Services.prefs.getIntPref("network.proxy.type");

    var disableReloadPref =
        document.getElementById("pref.advanced.proxies.disable_button.reload");
    disableReloadPref.disabled =
        (proxyTypeCur != 2 || proxyType != 2 || typedURL != pacURL);
  },

  /**
   * Handler function to be called when the network proxy type radiogroup
   * receives a 'syncfrompreference' event. Updates the proxy type and disables
   * controls related to this if needed (i.e Reload button)
   */
  readProxyType: function gCD_readProxyType() {
    this.proxyTypeChanged();
    return undefined;
  },
  
  /**
   * Handler function to be called when the shareAllProxies checkbox receives a
   * 'syncfrompreference' event.
   */
  updateProtocolPrefs: function gCD_updateProtocolPrefs() {
    var proxyTypePref = document.getElementById("network.proxy.type");
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    var proxyPrefs = ["ssl", "ftp", "socks"];
    for (var i = 0; i < proxyPrefs.length; ++i) {
      var proxyServerURLPref = document.getElementById("network.proxy." + proxyPrefs[i]);
      var proxyPortPref = document.getElementById("network.proxy." + proxyPrefs[i] + "_port");
      
      // Restore previous per-proxy custom settings, if present. 
      if (!shareProxiesPref.value) {
        var backupServerURLPref = document.getElementById("network.proxy.backup." + proxyPrefs[i]);
        var backupPortPref = document.getElementById("network.proxy.backup." + proxyPrefs[i] + "_port");
        if (backupServerURLPref.hasUserValue) {
          proxyServerURLPref.value = backupServerURLPref.value;
          backupServerURLPref.reset();
        }
        if (backupPortPref.hasUserValue) {
          proxyPortPref.value = backupPortPref.value;
          backupPortPref.reset();
        }
      }

      proxyServerURLPref.updateElements();
      proxyPortPref.updateElements();
      proxyServerURLPref.disabled = proxyTypePref.value != 1 || shareProxiesPref.value;
      proxyPortPref.disabled = proxyServerURLPref.disabled;
    }
    var socksVersionPref = document.getElementById("network.proxy.socks_version");
    socksVersionPref.disabled = proxyTypePref.value != 1 || shareProxiesPref.value;
    
    return undefined;
  },
  
  /**
   * Handler function to be called when a proxy server host/port textbox
   * receives a 'syncfrompreference' event.
   *
   * @param aProtocol       The protocol to be updated. This is the string
   *                          contained in the respective preference.
   * @param aIsPort         If true, the update comes from the port textbox.
   */
  readProxyProtocolPref: function gCD_readProxyProtocolPref (aProtocol, aIsPort) {
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    if (shareProxiesPref.value) {
      var pref = document.getElementById("network.proxy.http" + (aIsPort ? "_port" : ""));    
      return pref.value;
    }
    
    var backupPref = document.getElementById("network.proxy.backup." + aProtocol + (aIsPort ? "_port" : ""));
    return backupPref.hasUserValue ? backupPref.value : undefined;
  },

  /**
   * Reloads the proxy.pac that is set in the preferences.
   */
  reloadPAC: function gCD_reloadPAC() {
    Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
              .getService().reloadPAC();
  },
  
  /**
   * Use nsIURIFixup to fix the url entered in the autoconfig url field and the
   * respective preference element.
   */
  doAutoconfigURLFixup: function gCD_doAutoconfigURLFixup() {
    var autoURL = document.getElementById("networkProxyAutoconfigURL");
    var autoURLPref = document.getElementById("network.proxy.autoconfig_url");
    var URIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                             .getService(Components.interfaces.nsIURIFixup);
    try {
      autoURLPref.value = autoURL.value = URIFixup.createFixupURI(autoURL.value, 0).spec;
    } catch(ex) {}
  },
  
  /**
   * Special case handler function to be called when a HTTP proxy server host
   * textbox receives a 'syncfrompreference' event.
   */
  readHTTPProxyServer: function gCD_readHTTPProxyServer() {
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    if (shareProxiesPref.value)
      this.updateProtocolPrefs();
    return undefined;
  },
  
  /**
   * Special case handler function to be called when a HTTP proxy server port
   * textbox receives a 'syncfrompreference' event.
   */
  readHTTPProxyPort: function gCD_readHTTPProxyPort() {
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    if (shareProxiesPref.value)
      this.updateProtocolPrefs();
    return undefined;
  }
};
