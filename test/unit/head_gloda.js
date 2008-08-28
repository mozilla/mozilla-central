do_import_script("../mailnews/test/resources/mailDirService.js");
do_import_script("../mailnews/test/resources/mailTestUtils.js");

do_import_script("../mailnews/base/test/resources/messageGenerator.js");

do_import_script("../mailnews/database/global/test/resources/glodaTestHelper.js");


// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);
