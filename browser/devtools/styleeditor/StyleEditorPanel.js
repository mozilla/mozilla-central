const Cu = Components.utils;
Cu.import("resource:///modules/devtools/StyleEditorChrome.jsm");
Cu.import("resource://gre/modules/devtools/EventEmitter.jsm");

// DevTools Panel API:

window.init = function(aContentWindow) {
  new EventEmitter(window);
  let chromeRoot = document.getElementById("style-editor-chrome");
  let chrome = new StyleEditorChrome(chromeRoot, aContentWindow);
  window.styleEditorChrome = chrome;
  window.setReady();
}

window.setReady = function() {
  window.isReady = true;
  window.emit("ready");
}

window.destroy = function() {
  // FIXME
}

// StyleEditor Specific Public API:

window.selectStyleSheet = function(aStyleSheet, aLine, aCol) {
  // FIXME
}
