/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

function calBackendLoader() {
    this.wrappedJSObject = this;
    try {
        this.loadBackend();
    } catch (e) {
        dump("### Error loading backend: " + e + "\n");
    }
}

const calBackendLoaderClassID = Components.ID("{0314c271-7168-40fa-802e-83c8c46a557e}");
const calBackendLoaderInterfaces = [Components.interfaces.nsIObserver];
calBackendLoader.prototype = {
    classID: calBackendLoaderClassID,
    QueryInterface: XPCOMUtils.generateQI(calBackendLoaderInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calBackendLoaderClassID,
        contractID: "@mozilla.org/calendar/backend-loader;1",
        classDescription: "Calendar Backend Loader",
        interaces: calBackendLoaderInterfaces,
        flags: Components.interfaces.nsIClassInfo.SINGLETON
    }),

    loaded: false,

    observe: function() {
        // Nothing to do here, just need the entry so this is instanciated
    },

    loadBackend: function loadBackend() {
        if (this.loaded) {
            return;
        }

        let useICALJS = false;
        if (Services.prefs.prefHasUserValue("calendar.icaljs")) {
            useICALJS = Services.prefs.getBoolPref("calendar.icaljs");
        }
        let uri = Services.io.getProtocolHandler("resource")
                          .QueryInterface(Components.interfaces.nsIResProtocolHandler)
                          .getSubstitution("calendar");

        let file = Services.io.getProtocolHandler("file")
                           .QueryInterface(Components.interfaces.nsIFileProtocolHandler)
                           .getFileFromURLSpec(uri.spec);

        file.append("components");
        if (useICALJS) {
            file.append("icaljs.manifest");
        } else { 
            file.append("libical.manifest");
        }

        Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar)
                  .autoRegister(file);
        dump("[calBackendLoader] Using " + backend + " backend at " + file.path + "\n");
        this.loaded = true;
    }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([calBackendLoader]);
