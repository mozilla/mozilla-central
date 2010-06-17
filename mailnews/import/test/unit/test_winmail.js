const IMPORTNAME = 'Windows Live Mail';
const IMPORTTYPE = 'settings';

// XXX These prefs are excluded from being checked because they contain
// relative directories, and hence make the results dependent on where
// the tests are run. The prefs do have relative versions which are checked;
// Or because they have assigned numbers which are not absolute;
// Or mail.accountmanager the data is not relevant
// At the end of this file is detailed information and prefs
//
function excludedPrefs(name) {
  return !/\-rel/i.test(name) &&
     (/mail\.account/i.test(name) ||
      /smtpserver$/i.test(name) ||
      /newsrc_root$/i.test(name) ||
      /mail\.root/i.test(name) ||
      /deferred_to_account/i.test(name) ||
      /mail\.server\.server\d+\.(directory|newsrc)/i.test(name) ||
      /mail\.smtpservers/i.test(name));
}

function run_test()
{
  // XXX disabled for now as test is broken. Bug 561422 will fix it.
  return;

  if (!("nsIWindowsRegKey" in Ci))
    return;

//////////////// -- Modified nsIWindowsRegKey implementation ---
  Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

  function MockWindowsRegKey() {
  }
  MockWindowsRegKey.prototype = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIWindowsRegKey]),

    open: function(aRootKey, aRelPath, aMode) {
      var f = do_get_file("resources/WindowsLiveMail");
      this._rootkey = aRootKey;
      this._keypath = aRelPath;
      if (aRelPath == "Software\\Microsoft\\Windows Live Mail" ||
          aRelPath == "Software\\Microsoft\\Windows Mail") {
        this["Default Mail Account"] = "fill in mail account";
        this["Default News Account"] = "fill in news account";
        this["Store Root"] = f.path;
      }
    },
    close: function() {
    },
    openChild: function(aRelPath, aMode) {
      child = new MockWindowsRegKey();
      child._rootkey = this._rootkey;
      child._keypath = this._keypath + "\\" + aRelPath;
      if (aRelPath == "mail")
        child["Poll For Mail"] = 123456;
      return child;
    },
    readIntValue: function(aName) {
      return this[aName];
    },
    readStringValue: function(aName) {
      return this[aName];
    }
  };

  var factory = {
    createInstance: function(aOuter, aIid) {
      if (aOuter != null)
        do_throw(Cr.NS_ERROR_NO_AGGREGATION);

      var key = new MockWindowsRegKey();
      return key.QueryInterface(aIid);
    }
  };

  Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
            .registerFactory(Components.ID("{0478de5b-0f38-4edb-851d-4c99f1ed8eba}"),
                             "Mock Windows Registry Implementation",
                             "@mozilla.org/windows-registry-key;1", factory);
//////////////// -- Modified nsIWindowsRegKey implementation ---

  var importedPrefs = [];
  var prefS = Cc["@mozilla.org/preferences-service;1"]
               .getService(Ci.nsIPrefBranch2);
  var obs = {
    QueryInterface: function QueryInterface(aIID) {
      if (aIID.equals(Ci.nsIObserver) || aaIID.equals(Ci.nsISupports))
        return this;
      do_throw(Cr.NS_NOINTERFACE);
    },
    observe: function observe(aSubj, aTopic, aData) {
      let prefSetting = {};
      if (excludedPrefs(aData))
        return;
      prefSetting.name = aData;
      switch (prefS.getPrefType(aData)) {
        case prefS.PREF_BOOL:
          prefSetting.data = String(prefS.getBoolPref(aData));
          break;
        case prefS.PREF_INT:
          prefSetting.data = prefS.getIntPref(adata);
          break;
        case prefS.PREF_STRING:
          prefSetting.data = prefS.getCharPref(aData);
          break;
        case prefS.PREF_INVALID:
        default :
          prefSetting.data = null;
      }
      importedPrefs.push(prefSetting);
    }
  };
  prefS.addObserver('', obs, false);

  var impS = Cc["@mozilla.org/import/import-service;1"]
              .getService(Ci.nsIImportService);

/////// import
  // There's probably a more direct way to import a known module and type but this
  // discovery method is used by the import dialog so we'll do it this way thereby
  // testing from the UI.
  var c = impS.GetModuleCount(IMPORTTYPE);
  for (var i = 0; i < c; i++) {
    if (impS.GetModuleName(IMPORTTYPE, i) == IMPORTNAME) {
      var mod = impS.GetModule(IMPORTTYPE, i);
      break;
    }
  }
  if (!mod)
    do_throw("No import module");
  var settingsI = mod.GetImportInterface(IMPORTTYPE);
  if (settingsI)
    settingsI = settingsI.QueryInterface(Ci.nsIImportSettings);
  if (!settingsI)
    do_throw("No settings interface");
  var acct = {};
  if (!settingsI.Import(acct))
    do_throw("Import failed");
///////
  importedPrefs.sort(
    function(a,b){
      return (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0));
    });

// testing data--if new accounts are added, replace this with the dump 'test'.
// change all '\' to '\\' and replace this data. This test data needs to go
// to a file and probably be binary since we may have other invalid string
// characters in future checks.
var testdata = [
"popdisplayname","popdisplayname","testpop@invalid.invalid",
"testpop@invalid.invalid","test","test","mozillanews@invalid.invalid",
"mozillanews@invalid.invalid","Don Hall","Wingtip Toys","don@wingtiptoys.com",
"don@wingtiptoys.com","Don Hall","Wingtip Toys","don@wingtiptoys.com",
"don@wingtiptoys.com","[ProfD]News","[ProfD]ImapMail","[ProfD]News","[ProfD]Mail",
"[ProfD]Mail","true","false","true","true","[ProfD]Mail/pop3.test.test",
"pop3.test.test","true","testpopaccountname","pop3","testpopusername",
"[ProfD]Mail/Local Folders","Local Folders","Local Folders","none","nobody",
"[ProfD]News/testnews.mozilla.org","testnews.mozilla.org","accountnamemozillanews",
"[ProfD]News/testnews.mozilla.org.rc","nntp","[ProfD]News/testmsnews.microsoft.com",
"testmsnews.microsoft.com","Microsoft Communities Test",
"[ProfD]News/testmsnews.microsoft.com.rc","nntp","true",
"[ProfD]News/news.wingtiptoys.com","news.wingtiptoys.com","donhallnntp",
"[ProfD]News/news.wingtiptoys.com.rc","nntp","don","true",
"[ProfD]ImapMail/mail.wingtiptoys.com","mail.wingtiptoys.com","donhallimap",
"Inbox","imap","don","smtp.pop.test","smtp.wingtiptoys.com","don"
];

  var test = [];
  for ( let i = 0; i < importedPrefs.length ; i++){
    dump(importedPrefs[i].name+"--"+importedPrefs[i].data+"\n");
    test.push(importedPrefs[i].data);
  }

// Following is to create valid test data when changing test data files.
  dump("\nStart test dump\n")
  test.forEach(function(elem){
    dump("\"" + elem + "\",")
    }
  )
  dump("\nend test dump\n")

  if (test.length != testdata.length)
    do_throw("failed in test/testdata length--" + test.length + "/" + testdata.length)
  for (let i = 0; i < test.length; i++) {
    if (test[i] != testdata[i])
      do_throw("failed to match item " + i + ": " + test[i] + " ||| " + testdata[i]);
  }

//////////////// -- Modified nsIWindowsRegKey implementation ---
  Components.manager
            .unregisterFactory(Components.ID("{0478de5b-0f38-4edb-851d-4c99f1ed8eba}"),
                                             factory);
//////////////// -- Modified nsIWindowsRegKey implementation ---
}

/////////////// Following are the rules for including data in test
/*
Rules and samples for test data

Include /\-rel/
mail.newsrc_root-rel--[ProfD]News
mail.root.imap-rel--[ProfD]ImapMail
mail.root.nntp-rel--[ProfD]News
mail.root.none-rel--[ProfD]Mail
mail.root.pop3-rel--[ProfD]Mail
mail.server.server2.directory-rel--[ProfD]Mail/Local Folders
mail.server.server3.directory-rel--[ProfD]News/testnews.mozilla.org
mail.server.server3.newsrc.file-rel--[ProfD]News/testnews.mozilla.org.rc
mail.server.server4.directory-rel--[ProfD]News/testmsnews.microsoft.com
mail.server.server4.newsrc.file-rel--[ProfD]News/testmsnews.microsoft.com.rc
mail.server.server5.directory-rel--[ProfD]News/news.wingtiptoys.com
mail.server.server5.newsrc.file-rel--[ProfD]News/news.wingtiptoys.com.rc
mail.server.server6.directory-rel--[ProfD]ImapMail/mail.wingtiptoys.com
mail.server.server1.directory-rel--[ProfD]Mail/pop3.test.test

remove /mail\.account/
-mail.account.account1.server--server2
-mail.account.account2.identities--id1
-mail.account.account2.server--server1
-mail.account.account3.identities--id2
-mail.account.account3.server--server3
-mail.account.account4.identities--id3
-mail.account.account4.server--server4
-mail.account.account5.identities--id4
-mail.account.account5.server--server5
-mail.account.account6.identities--id5
-mail.account.account6.server--server6
-mail.accountmanager.accounts--account1,account2,account3,account4
-mail.accountmanager.accounts--account1,account2,account3,account4,account5,account6
-mail.accountmanager.accounts--account1,account2,account3,account4,account5
-mail.accountmanager.accounts--account1,account2,account3
-mail.accountmanager.accounts--account1
-mail.accountmanager.accounts--account1,account2
-mail.accountmanager.defaultaccount--account1
-mail.accountmanager.localfoldersserver--server2

remove /smtpserver$/
-mail.identity.id1.smtpServer--smtp1
-mail.identity.id5.smtpServer--smtp2

remove /newsrc_root$/
-mail.newsrc_root--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\News

remove after including '-rel' /mail\.root/
-mail.root.imap--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\ImapMail
-mail.root.nntp--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\News
-mail.root.none--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\Mail
-mail.root.pop3--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\Mail

remove /deferred_to_account/
-mail.server.server1.deferred_to_account--account1

remove after incl '-rel' /mail\.server\.server\d+\.(directory|newsrc)/
-mail.server.server1.directory--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\Mail\pop3.test.test
-mail.server.server2.directory--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\Mail\Local Folders
-mail.server.server3.directory--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\News\testnews.mozilla.org
-mail.server.server3.newsrc.file--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\News\testnews.mozilla.org.rc
-mail.server.server4.directory--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\News\testmsnews.microsoft.com
-mail.server.server4.newsrc.file--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\News\testmsnews.microsoft.com.rc
-mail.server.server5.directory--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\News\news.wingtiptoys.com
-mail.server.server5.newsrc.file--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\News\news.wingtiptoys.com.rc
-mail.server.server6.directory--f:\mozilla\objdir-debug_tb\mozilla\_tests\mailtest\ImapMail\mail.wingtiptoys.com

remove /mail\.smtpservers/
-mail.smtpservers--smtp1,smtp2
-mail.smtpservers--smtp1

following should be included
mail.identity.id1.fullName--popdisplayname
mail.identity.id1.organization--popdisplayname
mail.identity.id1.reply_to--testpop@invalid.invalid
mail.identity.id1.useremail--testpop@invalid.invalid
mail.identity.id2.fullName--test
mail.identity.id2.organization--test
mail.identity.id2.reply_to--mozillanews@invalid.invalid
mail.identity.id2.useremail--mozillanews@invalid.invalid
mail.identity.id4.fullName--Don Hall
mail.identity.id4.organization--Wingtip Toys
mail.identity.id4.reply_to--don@wingtiptoys.com
mail.identity.id4.useremail--don@wingtiptoys.com
mail.identity.id5.fullName--Don Hall
mail.identity.id5.organization--Wingtip Toys
mail.identity.id5.reply_to--don@wingtiptoys.com
mail.identity.id5.useremail--don@wingtiptoys.com

mail.server.server1.check_new_mail--true
mail.server.server1.defer_get_new_mail--false
mail.server.server1.delete_by_age_from_server--true
mail.server.server1.delete_mail_left_on_server--true
mail.server.server1.hostname--pop3.test.test
mail.server.server1.leave_on_server--true
mail.server.server1.name--testpopaccountname
mail.server.server1.type--pop3
mail.server.server1.userName--testpopusername
mail.server.server2.hostname--Local Folders
mail.server.server2.name--Local Folders
mail.server.server2.type--none
mail.server.server2.userName--nobody
mail.server.server3.hostname--testnews.mozilla.org
mail.server.server3.name--accountnamemozillanews
mail.server.server3.type--nntp
mail.server.server4.hostname--testmsnews.microsoft.com
mail.server.server4.name--Microsoft Communities Test
mail.server.server4.type--nntp
mail.server.server5.always_authenticate--true
mail.server.server5.hostname--news.wingtiptoys.com
mail.server.server5.name--donhallnntp
mail.server.server5.type--nntp
mail.server.server5.userName--don
mail.server.server6.check_new_mail--true
mail.server.server6.hostname--mail.wingtiptoys.com
mail.server.server6.name--donhallimap
mail.server.server6.server_sub_directory--Inbox
mail.server.server6.type--imap
mail.server.server6.userName--don
mail.smtpserver.smtp1.hostname--smtp.pop.test
mail.smtpserver.smtp2.hostname--smtp.wingtiptoys.com
mail.smtpserver.smtp2.username--don
*/
