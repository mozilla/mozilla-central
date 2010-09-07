// Import the main scripts that mailnews tests need to set up and tear down
load("../../../../resources/mailDirService.js");
load("../../../../resources/mailTestUtils.js");

function getSpec(aFileName)
{
  var file = do_get_file("resources/" + aFileName);
  var uri = Cc["@mozilla.org/network/io-service;1"]
               .getService(Ci.nsIIOService)
               .newFileURI(file).QueryInterface(Ci.nsIURL);
  uri.query = "type=application/x-message-display";
  return uri.spec;
}
