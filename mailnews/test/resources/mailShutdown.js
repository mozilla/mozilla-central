 
/* Provides methods to make sure our test shuts down mailnews properly. */

// Notifies everyone that the we're shutting down. This is needed to make sure
// that e.g. the account manager closes and cleans up correctly. It is semi-fake
// because we don't actually do any work to make sure the profile goes away, but
// it will mimic the behaviour in the app sufficiently.
//
// See also http://developer.mozilla.org/en/docs/Observer_Notifications
function postShutdownNotifications()
{
  var observerService = Cc["@mozilla.org/observer-service;1"]
                          .getService(Components.interfaces.nsIObserverService);
                          
  // first give everyone a heads up about us shutting down. if someone wants
  // to cancel this, our test should fail.
  var cancelQuit = Cc["@mozilla.org/supports-PRBool;1"]
                     .createInstance(Components.interfaces.nsISupportsPRBool);
  observerService.notifyObservers(cancelQuit, "quit-application-requested", null);
  if (cancelQuit.data) {
    do_throw("Cannot shutdown: Someone cancelled the quit request!");
  }
  
  // post all notifications in the right order. none of these are cancellable
  var notifications = ["quit-application", "profile-change-net-teardown", "profie-change-teardown", "profile-before-change"];
  notifications.forEach(function(notification) {
                          observerService.notifyObservers(null, notification, null)
                        });

  // finally, the xpcom-shutdown notification is handled by XPCOM itself.
}

// First do a gc to let anything not being referenced be cleaned up.
gc();

// Now shut everything down.
postShutdownNotifications();

gProfileDir = null;
if (gProfileDirProvider) {
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"]
    .getService(Ci.nsIProperties);
  dirSvc.unregisterProvider(gProfileDirProvider);
 }
