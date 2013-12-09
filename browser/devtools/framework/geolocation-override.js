/****** BEGIN LICENSE BLOCK *****
 Version: MPL 1.1/GPL 2.0/LGPL 2.1

 The contents of this file are subject to the Mozilla Public License Version
 1.1 (the "License"); you may not use this file except in compliance with
 the License. You may obtain a copy of the License at 
 http://www.mozilla.org/MPL/

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the
 License.

 The Original Code is 3liz code,
 this modified version if from René-Luc D'Hont

 The Initial Developer of the Original Code is RenÃ©-Luc D'Hont rldhont@3liz.com
 Portions created by the Initial Developer are Copyright (C) 2009
 the Initial Developer. All Rights Reserved.

 Some Parts of the Code are taken from the original Mozilla Firefox and/or XulRunner Code. 
 If these parts were subject to a licence not in compliance with the License, 
 it is not intentionnal and please contact the Initial Developer.

 Alternatively, the contents of this file may be used under the terms of
 either of the GNU General Public License Version 2 or later (the "GPL"),
 or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 in which case the provisions of the GPL or the LGPL are applicable instead
 of those above. If you wish to allow use of your version of this file only
 under the terms of either the GPL or the LGPL, and not to allow others to
 use your version of this file under the terms of the MPL, indicate your
 decision by deleting the provisions above and replace them with the notice
 and other provisions required by the GPL or the LGPL. If you do not delete
 the provisions above, a recipient may use your version of this file under
 the terms of any one of the MPL, the GPL or the LGPL.

 ***** END LICENSE BLOCK ***** */
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

const Ci = Components.interfaces;
const Cc = Components.classes;

//Mozilla object
function WifiGeoCoordsObject(lat, lon, acc, alt, altacc) {
  this.latitude = lat;
  this.longitude = lon;
  this.accuracy = acc;
  this.altitude = alt;
  this.altitudeAccuracy = altacc;
}

WifiGeoCoordsObject.prototype = {
  QueryInterface:  XPCOMUtils.generateQI([Ci.nsIDOMGeoPositionCoords]),
  classInfo: XPCOMUtils.generateCI({interfaces: [Ci.nsIDOMGeoPositionCoords],
                                    flags: Ci.nsIClassInfo.DOM_OBJECT,
                                    classDescription: "wifi geo position coords object"}),
};

//Mozilla object
function WifiGeoPositionObject(lat, lng, acc) {
  this.coords = new WifiGeoCoordsObject(lat, lng, acc, 0, 0);
  this.address = null;
  this.timestamp = Date.now();
}

WifiGeoPositionObject.prototype = {
  QueryInterface:   XPCOMUtils.generateQI([Ci.nsIDOMGeoPosition]),
  // Class Info is required to be able to pass objects back into the DOM.
  classInfo: XPCOMUtils.generateCI({interfaces: [Ci.nsIDOMGeoPosition],
                                    flags: Ci.nsIClassInfo.DOM_OBJECT,
                                    classDescription: "wifi geo location position object"}),
};

// Geolocater Pref Manager
function Prefs() {
  this._update = Cc["@mozilla.org/geolocation/service;1"].getService(Ci.nsIGeolocationUpdate);
  this.forceUpdate = function() {
    let isOverrideActive = Services.prefs.getBoolPref('devtools.geolocation.override-position');
    if (!isOverrideActive) {
        return false;
    }
    let latitude = parseFloat(Services.prefs.getCharPref("devtools.geolocation.override-latitude").replace(",", "."));
    let longitude = parseFloat(Services.prefs.getCharPref("devtools.geolocation.override-longitude").replace(",", "."));
    let loc = new WifiGeoPositionObject(latitude,
                                        longitude,
                                        10000);
    this._update.update(loc);
  };
}

Prefs.prototype = {};

var GeolocaterPrefs = new Prefs();
GeolocaterPrefs.forceUpdate();

module.GeolocaterPrefs = GeolocaterPrefs;
