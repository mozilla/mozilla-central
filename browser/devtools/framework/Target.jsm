/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = [ "TargetFactory" ];

Components.utils.import("resource:///modules/devtools/EventEmitter.jsm");

/**
 * Functions for creating Targets
 */
this.TargetFactory = {
  /**
   * Construct a Target
   * @param {XULTab} tab
   *        The tab to use in creating a new target
   * @return A target object
   */
  forTab: function TF_forTab(tab) {
    let target = Object.create(Target.prototype);
    new EventEmitter(target);

    target.tab = tab;

    target._remote = false;

    let document = target.tab.linkedBrowser.contentDocument;
    target.name = document.title;
    target.url = document.location.href;

    return target;
  },

  /**
   * Construct a Target
   * @param {nsIDOMWindow} chromeWindow
   *        The chromeWindow to use in creating a new target
   * @return A target object
   */
  forWindow: function TF_forWindow(chromeWindow) {
    let target = Object.create(Target.prototype);
    new EventEmitter(target);

    target.chromeWindow = chromeWindow;

    target._remote = false;

    let document = chromeWindow.content.ownerDocument;
    target.name = document.title;
    target.url = document.location.href;

    return target;
  },

  /**
   * Construct a Target for a remote global
   * @param {FIXME} connection
   *        The connection to a remote mozilla instance
   * @param {string} id
   *        The id of a debuggable window in the remote instance
   * @return A target object
   */
  forRemote: function TF_forRemote(connection, id) {
    let target = Object.create(Target.prototype);
    new EventEmitter(target);

    target.connection = connection;
    target.id = id;

    target._remote = true;

    // FIXME: implement
    target.name = "...";
    target.url = "...";

    return target;
  },

  /**
   * Get all of the targets known to some browser instance (local if null)
   * @return An array of target objects
   */
  allTargets: function TF_allTargets() {
    let chromeWindows = [];
    let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);
    let en = wm.getXULWindowEnumerator(null);
    while (en.hasMoreElements()) {
      chromeWindows.push(en.getNext());
    }

    return chromeWindows.map(function(chromeWindow) {
      return TargetFactory.forWindow(chromeWindow);
    });
  },

  /**
   * The listing counterpart to TargetFactory.forRemote which gets
   * an array of Targets for all available remote web pages.
   * @param {FIXME} connection
   *        The connection to a remote mozilla instance
   * @return An array of target objects
   */
  allRemotes: function TF_allRemotes(connection) {
    return FixmeRemoteThing.getIds(connection).then(function(ids) {
      return ids.map(function(id) {
        return TargetFactory.forRemote(connection, id);
      });
    });
  },
};

/**
 * A Target represents something that we can debug. Targets are generally
 * read-only. Any changes that you wish to make to a target should be done via
 * a Tool that attaches to the target. i.e. a Target is just a pointer saying
 * "the thing to debug is over there".
 *
 * Providing a generalized abstraction of a web-page or web-browser (available
 * either locally or remotely) is beyond the scope of this class (and maybe
 * also beyond the scope of this universe) However Target does attempt to
 * abstract some common events and read-only properties common to many Tools.
 *
 * Supported read-only properties:
 * - name, isRemote, url
 *
 * Target extends EventEmitter and provides support for the following events:
 * - close: The target window has been closed. All tools attached to this
 *     target should close. This event is not currently cancelable.
 * - navigate: The target window has navigated to a different URL
 * - reload: The target window has been refreshed via F5 or a similar mechanism
 * - change: One of the read-only
 *
 * Target also supports 2 functions to help allow 2 different versions of
 * Firefox debug each other. The 'version' property is the equivalent of
 * browser detection - simple and easy to implement but gets fragile when things
 * are not quite what they seem. The 'supports' property is the equivalent of
 * feature detection - harder to setup, but more robust long-term.
 *
 * Comparing Targets: 2 instances of a Target object can point at the same
 * thing, so t1 !== t2 and t1 != t2 even when they represent the same object.
 * To compare to targets use 't1.equals(t2)'.
 */
function Target() {
  throw new Error("Use TargetFactory.newXXX or Target.getXXX to create a Target in place of 'new Target()'");
}

/**
 * isRemote implies that all communication with the target must be via the
 * debug API.
 */
Object.defineProperty(Target.prototype, "isRemote", {
  get: function Target_getIsRemote() {
    return this._remote;
  },
  enumerable: true
});

/**
 * The 'version' property allows the developer tools equivalent of browser
 * detection. Browser detection is evil, however while we don't know what we
 * will need to detect in the future, it is an easy way to postpone work.
 * We should be looking to use 'supports()' in place of version where
 * possible.
 */
Object.defineProperty(Target.prototype, "version", {
  get: function Target_getVersion() {
    // FIXME: return something better
    return 20;
  },
  enumerable: true
});

/**
 * A better way to support feature detection, but we're not yet at a place
 * where we have the features well enough defined for this to make lots of
 * sense.
 */
Target.prototype.supports = function Target_supports(feature) {
  return false;
};
