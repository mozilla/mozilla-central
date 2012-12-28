/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// using the rdf service extensively here
var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);

// all the RDF resources we'll be retrieving
var NC = "http://home.netscape.com/NC-rdf#";
var Server              = rdf.GetResource(NC + "Server");
var SmtpServer          = rdf.GetResource(NC + "SmtpServer");
var ServerHost          = rdf.GetResource(NC + "ServerHost");
var ServerType          = rdf.GetResource(NC + "ServerType");
var PrefixIsUsername    = rdf.GetResource(NC + "PrefixIsUsername");
var UseAuthenticatedSmtp= rdf.GetResource(NC + "UseAuthenticatedSmtp");

// this is possibly expensive, not sure what to do here
var ispDefaults;

var nsIRDFResource = Components.interfaces.nsIRDFResource;
var nsIRDFLiteral = Components.interfaces.nsIRDFLiteral;

var ispRoot = rdf.GetResource("NC:ispinfo");

// given an ISP's domain URI, look up all relevant information about it
function getIspDefaultsForUri(domainURI)
{
    if (!ispDefaults) 
        ispDefaults = rdf.GetDataSource("rdf:ispdefaults");

    var domainRes = rdf.GetResource(domainURI);

    var result = dataSourceToObject(ispDefaults, domainRes);

    if (!result) return null;

    // The domainURI should be in the format domain:example.com. (Where 
    // example.com is the domain name to use for all email addresses). If
    // it does not match this pattern, then it is possible no domain
    // has been specified, so we should leave it uninitialized.
    if (domainURI.startsWith("domain:")) {
        // add this extra attribute which is the domain itself
        var domainData = domainURI.split(':');
        if (domainData.length > 1) {
          // To faciltate distributing two different account types for one ISP,
          // it's possible to add parameters to the domain URI 
          // - e.g. domain:example.com?type=imap.
          // This is necessary so RDF doesn't think they're the same.

          // Save the domain, but only the part up to the (possible) question mark.
          result.domain = domainData[1].replace(/\?.*/, "");
        }
    }
    return result;
}

// construct an ISP's domain URI based on it's domain
// (i.e. turns example.com -> domain:example.com)
function getIspDefaultsForDomain(domain) {
    domainURI = "domain:" + domain;
    return getIspDefaultsForUri(domainURI);
}

// Given an email address (like "joe@example.com") look up 
function getIspDefaultsForEmail(email) {

    var emailData = getEmailInfo(email);

    var ispData = null;
    if (emailData)
        ispData = getIspDefaultsForDomain(emailData.domain);

    prefillIspData(ispData, email);

    return ispData;
}

// given an email address, split it into username and domain
// return in an associative array
function getEmailInfo(email) {
    if (!email) return null;

    var result = new Object;

    var emailData = email.split('@');

    if (emailData.length != 2) {
        dump("bad e-mail address!\n");
        return null;
    }

    // all the variables we'll be returning
    result.username = emailData[0];
    result.domain = emailData[1];

    return result;
}

function prefillIspData(ispData, email, fullName) {
    if (!ispData) return;

    // make sure these objects exist
    if (!ispData.identity) ispData.identity = new Object;
    if (!ispData.incomingServer) ispData.incomingServer = new Object;

    // fill in e-mail if it's not already there
    if (email && !ispData.identity.email)
        ispData.identity.email = email;

    var emailData = getEmailInfo(email);
    if (emailData) {

        // fill in the username (assuming the ISP doesn't prevent it)
        if (!ispData.incomingServer.userName &&
            !ispData.incomingServer.noDefaultUsername)
            ispData.incomingServer.username = emailData.username;
    }
}

// this function will extract an entire datasource into a giant
// associative array for easy retrieval from JS
var NClength = NC.length;
function dataSourceToObject(datasource, root)
{
    var result = null;
    var arcs = datasource.ArcLabelsOut(root);

    while (arcs.hasMoreElements()) {
        var arc = arcs.getNext().QueryInterface(nsIRDFResource);

        var arcName = arc.Value;
        arcName = arcName.substring(NClength, arcName.length);

        if (!result) result = new Object;

        var target = datasource.GetTarget(root, arc, true);

        var value;
        var targetHasChildren = false;
        try {
            target = target.QueryInterface(nsIRDFResource);
            targetHasChildren = true;
        } catch (ex) {
            target = target.QueryInterface(nsIRDFLiteral);
        }

        if (targetHasChildren)
            value = dataSourceToObject(datasource, target);
        else {
            value = target.Value;

            // fixup booleans/numbers/etc
            if (value == "true") value = true;
            else if (value == "false") value = false;
            else {
                var num = Number(value);
                if (!isNaN(num)) value = num;
            }
        }

        // add this value
        result[arcName] = value;
    }
    return result;
}
