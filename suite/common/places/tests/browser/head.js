
// We need to cache this before test runs...
let cachedLeftPaneFolderIdGetter;
let (getter = PlacesUIUtils.__lookupGetter__("leftPaneFolderId")) {
  if (!cachedLeftPaneFolderIdGetter && typeof(getter) == "function")
    cachedLeftPaneFolderIdGetter = getter;
}
// ...And restore it when test ends.
registerCleanupFunction(function(){
  let (getter = PlacesUIUtils.__lookupGetter__("leftPaneFolderId")) {
    if (cachedLeftPaneFolderIdGetter && typeof(getter) != "function")
      PlacesUIUtils.__defineGetter__("leftPaneFolderId",
                                     cachedLeftPaneFolderIdGetter);
  }
});

function openLibrary(callback) {
  var library = window.openDialog(
    "chrome://communicator/content/bookmarks/bookmarksManager.xul",
    "", "chrome,toolbar=yes,dialog=no,resizable");
  waitForFocus(function () {
    callback(library);
  }, library);
}

/**
 * Waits for completion of a clear history operation, before
 * proceeding with aCallback.
 *
 * @param aCallback
 *        Function to be called when done.
 */
function waitForClearHistory(aCallback) {
  Services.obs.addObserver(function observeCH(aSubject, aTopic, aData) {
    Services.obs.removeObserver(observeCH, PlacesUtils.TOPIC_EXPIRATION_FINISHED);
    aCallback();
  }, PlacesUtils.TOPIC_EXPIRATION_FINISHED, false);
  PlacesUtils.bhistory.removeAllPages();
}
