// Import the main scripts that mailnews tests need to set up and tear down
do_import_script("mailnews/test/resources/mailDirService.js");
do_import_script("mailnews/test/resources/mailTestUtils.js");

// Import the smtp server scripts
do_import_script("mailnews/test/fakeserver/maild.js")
do_import_script("mailnews/test/fakeserver/smtpd.js")

function setup_daemon() {
  var daemon = new smtpDaemon();
  return daemon;
}
