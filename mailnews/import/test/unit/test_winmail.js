const IMPORTNAME = 'Windows Live Mail';
const IMPORTTYPE = 'settings';

function run_test()
{
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
      prefSetting.name = aData;
      switch (prefS.getPrefType(aData)) {
        case prefS.PREF_BOOL:
          prefSetting.data = prefS.getBoolPref(aData);
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
var test = "";
// testing data--if new accounts are added, replace this with the dump 'test'.
// change all '\' to '\\' and replace this data. This test data needs to go
// to a file and probably be binary since we may have other invalid string
// characters in future checks.

var testdata = "mail.account.account1.serverserver2mail.account.account2.ide" +
"ntitiesid1mail.account.account2.serverserver1mail.account.account3.identiti" +
"esid2mail.account.account3.serverserver3mail.account.account4.identitiesid3" +
"mail.account.account4.serverserver4mail.account.account5.identitiesid4mail." +
"account.account5.serverserver5mail.account.account6.identitiesid5mail.accou" +
"nt.account6.serverserver6mail.accountmanager.accountsaccount1mail.accountma" +
"nager.accountsaccount1,account2mail.accountmanager.accountsaccount1,account" +
"2,account3mail.accountmanager.accountsaccount1,account2,account3,account4ma" +
"il.accountmanager.accountsaccount1,account2,account3,account4,account5mail." +
"accountmanager.accountsaccount1,account2,account3,account4,account5,account" +
"6mail.accountmanager.defaultaccountaccount1mail.accountmanager.localfolders" +
"serverserver2mail.identity.id1.fullNamepopdisplaynamemail.identity.id1.orga" +
"nizationpopdisplaynamemail.identity.id1.reply_totestpop@invalid.invalidmail" +
".identity.id1.smtpServersmtp1mail.identity.id1.useremailtestpop@invalid.inv" +
"alidmail.identity.id2.fullNametestmail.identity.id2.organizationtestmail.id" +
"entity.id2.reply_tomozillanews@invalid.invalidmail.identity.id2.useremailmo" +
"zillanews@invalid.invalidmail.identity.id4.fullNameDon Hallmail.identity.id" +
"4.organizationWingtip Toysmail.identity.id4.reply_todon@wingtiptoys.commail" +
".identity.id4.useremaildon@wingtiptoys.commail.identity.id5.fullNameDon Hal" +
"lmail.identity.id5.organizationWingtip Toysmail.identity.id5.reply_todon@wi" +
"ngtiptoys.commail.identity.id5.smtpServersmtp2mail.identity.id5.useremaildo" +
"n@wingtiptoys.commail.newsrc_root-rel[ProfD]Newsmail.root.imap-rel[Pr" +
"ofD]ImapMailmail.root.nntp-rel[ProfD]Newsmail.root.none-rel[ProfD]Mailmail." +
"root.pop3-rel[ProfD]Mailmail.server.server1.check_new_mailtruemail.server.s" +
"erver1.defer_get_new_mailfalsemail.server.server1.deferred_to_accountaccoun" +
"t1mail.server.server1.delete_by_age_from_servertruemail.server.server1.dele" +
"te_mail_left_on_servertruemail.server.server" +
"1.directory-rel[ProfD]Mail/pop3.test.testmail.server.server1.hostnamepop3.t" +
"est.testmail.server.server1.leave_on_servertruemail.server.server1.nametest" +
"popaccountnamemail.server.server1.typepop3mail.server.server1.userNametestp" +
"opusernamemail.server.server2.directory-rel[P" +
"rofD]Mail/Local Foldersmail.server.server2.hostnameLocal Foldersmail.server" +
".server2.nameLocal Foldersmail.server.server2.typenonemail.server.server2.u" +
"serNamenobodymail.server.server3.direc" +
"tory-rel[ProfD]News/testnews.mozilla.orgmail.server.server3.hostnametestnew" +
"s.mozilla.orgmail.server.server3.nameaccountnamemozillanewsmail.server.serv" +
"er3.newsrc.file-rel[ProfD]News/te" +
"stnews.mozilla.org.rcmail.server.server3.typenntpmail.server.server4.direct" +
"ory-rel[ProfD]News/testmsnews.micr" +
"osoft.commail.server.server4.hostnametestmsnews.microsoft.commail.server.se" +
"rver4.nameMicrosoft Communities Testmail.server.server4.newsrc.file-rel[Pro" +
"fD]News/testmsnews.microsoft." +
"com.rcmail.server.server4.typenntpmail.server.server5.always_authenticatetr" +
"uemail.server.server5.directory-rel[Pr" +
"ofD]News/news.wingtiptoys.commail.server.server5.hostnamenews.wingtiptoys.c" +
"ommail.server.server5.namedonhallnntpmail.server.server5.newsrc.file-rel[Pr" +
"ofD]News/news.wingtiptoys.com.rcm" +
"ail.server.server5.typenntpmail.server.server5.userNamedonmail.server.serve" +
"r6.check_new_mailtruemail.server.s" +
"erver6.directory-rel[ProfD]ImapMail/mail.wingtiptoys.commail.server.server6" +
".hostnamemail.wingtiptoys.commail.server.server6.namedonhallimapmail.server" +
".server6.newsrc.file-rel[ProfD]News/testmsnews.microsoft.com.rcmail.server"  +
".server6.server_sub_directoryInboxmail.server.server6.typeimapmail.server.s" +
"erver6.userNamedonmail.smtpserver.smtp1.hostnamesmtp.pop.testmail.smtpserve" +
"r.smtp2.hostnamesmtp.wingtiptoys.commail.smtpserver.smtp2.usernamedonmail.s" +
"mtpserverssmtp1mail.smtpserverssmtp1,smtp2";

  // XXX These prefs are excluded from being checked because they contain
  // relative directories, and hence make the results dependent on where
  // the tests are run. The prefs do have relative versions which are checked.
  const excludedPrefs = [
    "mail.newsrc_root", "mail.root.imap", "mail.root.nntp", "mail.root.none",
    "mail.root.pop3", "mail.server.server1.directory",
    "mail.server.server2.directory",
    "mail.server.server3.directory", "mail.server.server3.newsrc.file",
    "mail.server.server4.directory", "mail.server.server4.newsrc.file",
    "mail.server.server5.directory", "mail.server.server5.newsrc.file",
    "mail.server.server6.directory", "mail.server.server6.newsrc.file"
  ];
  dump(excludedPrefs + "\n");
  for ( let i = 0; i < importedPrefs.length ; i++){
    if (excludedPrefs.indexOf(importedPrefs[i].name) != -1)
      continue;
    dump(importedPrefs[i].name+"--"+importedPrefs[i].data+"\n");
    test += importedPrefs[i].name + importedPrefs[i].data;
  }
// uncomment following to get valid test data when changing test data files.
// dump("\nStart test dump\n" + test + "\nend test dump\n")

  do_check_true(test == testdata);

//////////////// -- Modified nsIWindowsRegKey implementation ---
  Components.manager
            .unregisterFactory(Components.ID("{0478de5b-0f38-4edb-851d-4c99f1ed8eba}"),
                                             factory);
//////////////// -- Modified nsIWindowsRegKey implementation ---
}

