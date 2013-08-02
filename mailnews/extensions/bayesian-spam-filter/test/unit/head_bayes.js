Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://testing-common/mailnews/mailDirService.js");
Components.utils.import("resource://testing-common/mailnews/mailTestUtils.js");
Components.utils.import("resource://testing-common/mailnews/localAccountUtils.js");

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

var gProfileDir = ProfileDir.initialize(do_get_profile());

Components.utils.import("resource://gre/modules/Services.jsm");

function getSpec(aFileName)
{
  var file = do_get_file("resources/" + aFileName);
  var uri = Services.io.newFileURI(file).QueryInterface(Ci.nsIURL);
  uri.query = "type=application/x-message-display";
  return uri.spec;
}
