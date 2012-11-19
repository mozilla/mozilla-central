/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var security = {
  // Display the server certificate (static)
  viewCert : function () {
    var cert = security._cert;
    viewCertHelper(window, cert);
  },

  _getSecurityInfo : function() {
    const nsIX509Cert = Components.interfaces.nsIX509Cert;
    const nsIX509CertDB = Components.interfaces.nsIX509CertDB;
    const nsX509CertDB = "@mozilla.org/security/x509certdb;1";
    const nsISSLStatusProvider = Components.interfaces.nsISSLStatusProvider;
    const nsISSLStatus = Components.interfaces.nsISSLStatus;
    const nsIWebProgressListener = Components.interfaces.nsIWebProgressListener;

    // We don't have separate info for a frame, return null until further notice
    // (see bug 138479)
    if (gWindow != gWindow.top)
      return null;

    var hName = null;
    try {
      hName = gWindow.location.host;
    }
    catch (exception) { }

    var ui = security._getSecurityUI();

    var isBroken = ui &&
      (ui.state & nsIWebProgressListener.STATE_IS_BROKEN);
    var isInsecure = ui &&
      (ui.state & nsIWebProgressListener.STATE_IS_INSECURE);
    var isEV = ui &&
      (ui.state & nsIWebProgressListener.STATE_IDENTITY_EV_TOPLEVEL);
    var status = ui ? ui.QueryInterface(nsISSLStatusProvider).SSLStatus : null;

    if (!isInsecure && status) {
      status.QueryInterface(nsISSLStatus);
      var cert = status.serverCert;
      var issuerName =
        this.mapIssuerOrganization(cert.issuerOrganization) || cert.issuerName;

      var retval = {
        hostName : hName,
        cAName : issuerName,
        encryptionAlgorithm : undefined,
        encryptionStrength : undefined,
        isBroken : isBroken,
        isEV : isEV,
        cert : cert,
        fullLocation : gWindow.location
      };

      try {
        retval.encryptionAlgorithm = status.cipherName;
        retval.encryptionStrength = status.secretKeyLength;
      }
      catch (e) {
      }

      return retval;
    } else {
      return {
        hostName : hName,
        cAName : "",
        encryptionAlgorithm : "",
        encryptionStrength : 0,
        isBroken : isBroken,
        isEV : isEV,
        cert : null,
        fullLocation : gWindow.location        
      };
    }
  },

  // Find the secureBrowserUI object (if present)
  _getSecurityUI : function() {
    if ("gBrowser" in window.opener)
      return window.opener.gBrowser.securityUI;
    return null;
  },

  // Interface for mapping a certificate issuer organization to
  // the value to be displayed.
  // Bug 82017 - this implementation should be moved to pipnss C++ code
  mapIssuerOrganization: function(name) {
    if (!name) return null;

    if (name == "RSA Data Security, Inc.") return "Verisign, Inc.";

    // No mapping required
    return name;
  },
  
  /**
   * Open the cookie manager window
   */
  viewCookies : function()
  {
    var hostName = "";
    try {
      hostName = gDocument.documentURIObject.asciiHost;
    }
    catch (e) {
    }

    toDataManager(hostName + '|cookies');
  },

  /**
   * Open the login manager window
   */
  viewPasswords : function()
  {
    toDataManager(this._getSecurityInfo().hostName + '|passwords');
  },

  _cert : null
};

function securityOnLoad() {
  var info = security._getSecurityInfo();
  if (!info)
    return;

  const pageInfoBundle = document.getElementById("pageinfobundle");

  /* Set Identity section text */
  setText("security-identity-domain-value", info.hostName);

  var owner, verifier, generalPageIdentityString, identityClass;
  if (info.cert && !info.isBroken) {
    // Try to pull out meaningful values.  Technically these fields are optional
    // so we'll employ fallbacks where appropriate.  The EV spec states that Org
    // fields must be specified for subject and issuer so that case is simpler.
    if (info.isEV) {
      owner = info.cert.organization;
      verifier = security.mapIssuerOrganization(info.cAName);
      generalPageIdentityString =
        pageInfoBundle.getFormattedString("generalSiteIdentity",
                                          [owner, verifier]);
      identityClass = "verifiedIdentity";
    }
    else {
      // Technically, a non-EV cert might specify an owner in the O field or not,
      // depending on the CA's issuing policies.  However we don't have any programmatic
      // way to tell those apart, and no policy way to establish which organization
      // vetting standards are good enough (that's what EV is for) so we default to
      // treating these certs as domain-validated only.
      owner = pageInfoBundle.getString("securityNoOwner");
      verifier = security.mapIssuerOrganization(info.cAName ||
                                                info.cert.issuerCommonName ||
                                                info.cert.issuerName);
      generalPageIdentityString = owner;
      identityClass = "verifiedDomain";
    }
  }
  else {
    // We don't have valid identity credentials.
    owner = pageInfoBundle.getString("securityNoOwner");
    verifier = pageInfoBundle.getString("notSet");
    generalPageIdentityString = owner;
    identityClass = "";
  }

  setText("security-identity-owner-value", owner);
  setText("security-identity-verifier-value", verifier);
  setText("general-security-identity", generalPageIdentityString);
  document.getElementById("identity-icon").className = identityClass;

  /* Manage the View Cert button*/
  if (info.cert)
    security._cert = info.cert;
  document.getElementById("security-view-cert").collapsed = !info.cert;

  /* Set Privacy & History section text */
  var yesStr = pageInfoBundle.getString("yes");
  var noStr = pageInfoBundle.getString("no");

  var uri = gDocument.documentURIObject;
  var hasCookies = hostHasCookies(uri);
  setText("security-privacy-cookies-value", hasCookies ? yesStr : noStr);
  document.getElementById("security-view-cookies").disabled = !hasCookies;
  var hasPasswords = realmHasPasswords(uri);
  setText("security-privacy-passwords-value", hasPasswords ? yesStr : noStr);
  document.getElementById("security-view-password").disabled = !hasPasswords;

  var visitCount = previousVisitCount(info.hostName);
  if(visitCount > 1) {
    setText("security-privacy-history-value",
            pageInfoBundle.getFormattedString("securityNVisits", [visitCount.toLocaleString()]));
  }
  else if (visitCount == 1) {
    setText("security-privacy-history-value",
            pageInfoBundle.getString("securityOneVisit"));
  }
  else {
    setText("security-privacy-history-value", noStr);
  }

  /* Set the Technical Detail section messages */
  var hdr;
  var msg1;
  var msg2;

  if (info.isBroken) {
    hdr = pageInfoBundle.getString("securityMixedContent");
    msg1 = pageInfoBundle.getString("securityMixed1");
    msg2 = pageInfoBundle.getString("securityNone2");
  }
  else if (info.encryptionStrength) {
    hdr = pageInfoBundle.getFormattedString("securityEncryptionWithBits",
                         [info.encryptionAlgorithm, info.encryptionStrength]);
    msg1 = pageInfoBundle.getString("securityEncryption1");
    msg2 = pageInfoBundle.getString("securityEncryption2");
    security._cert = info.cert;
  }
  else {
    hdr = pageInfoBundle.getString("securityNoEncryption");
    if (info.hostName)
      msg1 = pageInfoBundle.getFormattedString("securityNone1", [info.hostName]);
    else
      msg1 = pageInfoBundle.getString("securityNone3");
    msg2 = pageInfoBundle.getString("securityNone2");
  }
  setText("security-technical-shortform", hdr);
  setText("security-technical-longform1", msg1);
  setText("security-technical-longform2", msg2); 
  setText("general-security-privacy", hdr);
}

function setText(id, value)
{
  var element = document.getElementById(id);
  if (!element)
    return;
  if (element.localName == "textbox" || element.localName == "label")
    element.value = value;
  else {
    if (element.hasChildNodes())
      element.removeChild(element.firstChild);
    var textNode = document.createTextNode(value);
    element.appendChild(textNode);
  }
}

function viewCertHelper(parent, cert)
{
  if (!cert)
    return;

  var cd = Components.classes[CERTIFICATEDIALOGS_CONTRACTID].getService(nsICertificateDialogs);
  cd.viewCert(parent, cert);
}

/**
 * Return true iff we have cookies for uri.
 */
function hostHasCookies(aUri) {
  var hostName;
  try {
    hostName = aUri.asciiHost;
  }
  catch (e) {
  }
  if (!hostName)
    return false;

  return Services.cookies.countCookiesFromHost(hostName) > 0;
}

/**
 * Return true iff realm (proto://host:port) (extracted from uri) has
 * saved passwords
 */
function realmHasPasswords(aUri) {
  return Services.logins.countLogins(aUri.prePath, "", "") > 0;
}

/**
 * Return the number of previous visits recorded for host before today.
 *
 * @param host - the domain name to look for in history
 */
function previousVisitCount(host, endTimeReference) {
  if (!host)
    return false;

  var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                                 .getService(Components.interfaces.nsINavHistoryService);

  var options = historyService.getNewQueryOptions();
  options.resultType = options.RESULTS_AS_VISIT;

  // Search for visits to this host before today
  var query = historyService.getNewQuery();
  query.endTimeReference = query.TIME_RELATIVE_TODAY;
  query.endTime = 0;
  query.domain = host;

  var result = historyService.executeQuery(query, options);
  result.root.containerOpen = true;
  var cc = result.root.childCount;
  result.root.containerOpen = false;
  return cc;
}
