/**
 * Basic tests for importing accounts of Outlook Express 4.0/5.0.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

const CONTRACT_ID = "@mozilla.org/windows-registry-key;1";
const REGISTRAR = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

let gOriginalCID = Components.manager.contractIDToCID(CONTRACT_ID);
let factory;
let uuid;

function POP3Account() {}

POP3Account.prototype = {
  'Account Name': 'POP3 Account Name',
  'POP3 Server': 'pop.host.invalid',
  'POP3 User Name': 'pop3user',
  'POP3 Secure Connection': 0,
  'POP3 Port': 1100,
  'POP3 Use Sicily': 1,
  'POP3 Skip Account': 0,
  'Leave Mail On Server': 1,
  'Remove When Deleted': 1,
  'Remove When Expired': 1,
  'Expire Days': 9,
  'SMTP Server': 'smtp.host.invalid',
  'SMTP Port': 250,
  'SMTP Secure Connection': 0,
  'SMTP Display Name': 'SMTP Display Name',
  'SMTP Email Address': 'pop3user@host.invalid',
  'SMTP Reply To Email Address': 'pop3user@host.invalid',
  'SMTP Organization Name': 'SMTP Organization Name',
  'SMTP Use Sicily': 1,
  'SMTP User Name': 'smtpuser'
};

function IMAPAccount() {}

IMAPAccount.prototype = {
  'Account Name': 'IMAP Account Name',
  'IMAP Server': 'imap.host.invalid',
  'IMAP User Name': 'imapuser',
  'IMAP Secure Connection': 1,
  'IMAP Port': 1340,
  'IMAP Use Sicily': 1,
  'IMAP Root Folder': 'Root Folder',
  'SMTP Server': 'smtp.host.invalid',
  'SMTP Port': 465,
  'SMTP Secure Connection': 1,
  'SMTP Display Name': 'SMTP Display Name',
  'SMTP Email Address': 'imapuser@host.invalid',
  'SMTP Reply To Email Address': 'imapuser@host.invalid',
  'SMTP Organization Name': 'SMTP Organization Name',
  'SMTP Use Sicily': 2,
  'SMTP User Name': 'smtpuser'
};

function NNTPAccount() {}

NNTPAccount.prototype = {
  'Account Name': 'NNTP Account Name',
  'NNTP Server': 'nntp.host.invalid',
  'NNTP User Name': 'nntpuser',
  'NNTP Port': 1190,
  'NNTP Display Name': 'NNTP Display Name',
  'NNTP Email Address': 'nntpuser@host.invalid',
  'NNTP Reply To Email Address': 'nntpuser@host.invalid',
  'NNTP Organization Name': 'NNTP Organization Name',
};

/* Outlook Express 4.0 */
function OE4Registry(defaultAccount) {
  this._defaultAccount = defaultAccount;
}

OE4Registry.prototype = {
  'Identities': {
    'Default User ID': '{DEFAULT_ID}'
  },
  'Software\\Microsoft\\Outlook Express': {
    'Default Mail Account': 'defaulAccount',
    'Mail': {
      'Poll For Mail': 1234 * 60000
    },
  },
  get 'Identities\\{DEFAULT_ID}\\Software\\Microsoft\\Internet Account Manager\\Accounts'() {
    return { 'defaultAccount': this._defaultAccount };
  }
};

/* Outlook Express 5.0 */
function OE5Registry(defaultAccount) {
  this._defaultAccount = defaultAccount;
}

OE5Registry.prototype = {
  'Identities': {
    'Default User ID': '{DEFAULT_ID}'
  },
  'Identities\\{DEFAULT_ID}\\Software\\Microsoft\\Outlook Express\\5.0': {
    'Mail': {
      'Poll For Mail': 1234 * 60000
    },
  },
  'Identities\\{DEFAULT_ID}\\Software\\Microsoft\\Internet Account Manager': {
    'Default Mail Account': 'defaultAccount'
  },
  get 'Software\\Microsoft\\Internet Account Manager\\Accounts'() {
    return { 'defaultAccount': this._defaultAccount };
  }
};

let expectedPop3Account = {
  incomingServer: {
    type: 'pop3',
    hostName: 'pop.invalid.host',
    port: 1100,
    username: 'pop3user',
    isSecure: false,
    authMethod: Ci.nsMsgAuthMethod.secure,
    socketType: 0,
    doBiff: true,
    biffMinutes: 1234,
    leaveMessagesOnServer: true,
    deleteMailLeftOnServer: true,
    deleteByAgeFromServer: true,
    numDaysToLeaveOnServer: 9,
  },
  identity: {
    fullName: 'SMTP Display Name',
    email: 'pop3user@host.invalid',
    replyTo: 'pop3user@host.invalid',
    organization: 'SMTP Organization Name'
  },
  smtpServer: {
    hostname: 'smtp.invalid.host',
    port: 250,
    username: 'smtpuser',
    authMethod: Ci.nsMsgAuthMethod.secure,
    socketType: 0,
  }
};

let expectedImapAccount = {
  incomingServer: {
    type: 'imap',
    hostName: 'imap.invalid.host',
    port: 1340,
    username: 'imapuser',
    isSecure: true,
    authMethod: Ci.nsMsgAuthMethod.secure,
    socketType: Ci.nsMsgSocketType.SSL,
    doBiff: true,
    biffMinutes: 1234,
  },
  identity: {
    fullName: 'SMTP Display Name',
    email: 'imapuser@host.invalid',
    replyTo: 'imapuser@host.invalid',
    organization: 'SMTP Organization Name'
  },
  smtpServer: {
    hostname: 'smtp.invalid.host',
    port: 465,
    username: 'imapuser', // use incoming server's username if Sicily is 2.
    authMethod: Ci.nsMsgAuthMethod.secure,
    socketType: Ci.nsMsgSocketType.SSL,
  }
};

let expectedNntpAccount = {
  incomingServer: {
    type: 'nntp',
    hostName: 'nntp.invalid.host',
    port: 1190,
    username: 'nntpuser',
    isSecure: false,
    authMethod: Ci.nsMsgAuthMethod.passwordCleartext,
    socketType: 0,
    doBiff: false,
    biffMinutes: 10, // Default preference value
  },
  identity: {
    fullName: 'NNTP Display Name',
    email: 'nntpuser@host.invalid',
    replyTo: 'nntpuser@host.invalid',
    organization: 'NNTP Organization Name'
  }
};

function MockWindowsRegKey(registryData) {
  this._registryData = registryData;
}

MockWindowsRegKey.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWindowsRegKey]),

  open: function(aRootKey, aRelPath, aMode) {
    if (!this._registryData[aRelPath])
      throw Cr.NS_ERROR_FAILURE;
    this._keyPath = aRelPath;
  },

  close: function() {
  },

  openChild: function(aRelPath, aMode) {
    if (!this._registryData[this._keyPath][aRelPath])
      throw Cr.NS_ERROR_FAILURE;
    child = new MockWindowsRegKey({});
    let newKeyPath = this._keyPath + "\\" + aRelPath;
    child._keyPath = newKeyPath;
    child._registryData[newKeyPath] =
      this._registryData[this._keyPath][aRelPath];
    return child;
  },

  get childCount() {
    let count = 0;
    for (let i in this._registryData[this._keyPath])
      count++;
    return count;
  },

  getChildName: function(aIndex) {
    let count = 0;
    for (let name in this._registryData[this._keyPath]) {
      if (count == aIndex)
        return name;
      count++;
    }
    throw Cr.NS_ERROR_FAILURE;
  },

  _readValue: function(aName) {
    if (!this._registryData[this._keyPath][aName])
      throw Cr.NS_ERROR_FAILURE;
    return this._registryData[this._keyPath][aName];
  },

  readIntValue: function(aName) {
    return this._readValue(aName);
  },

  readStringValue: function(aName) {
    return this._readValue(aName);
  }
};

function MockWindowsRegFactory(registryData) {
  this._registryData = registryData;
}

MockWindowsRegFactory.prototype = {
  createInstance: function(aOuter, aIid) {
    if (aOuter)
      do_throw(Cr.NS_ERROR_NO_AGGREGATION);

    let key = new MockWindowsRegKey(this._registryData);
    return key.QueryInterface(aIid);
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFactory])
};

function setup_registry(registry) {
  uuid = Cc["@mozilla.org/uuid-generator;1"]
           .getService(Ci.nsIUUIDGenerator)
           .generateUUID().toString();
  factory = new MockWindowsRegFactory(registry);
  REGISTRAR.registerFactory(Components.ID(uuid),
                            "Mock Windows Registry Implementation",
                            CONTRACT_ID,
                            factory);
}

function check_smtp_server(expected, actual) {
  do_check_eq(expected.port, actual.port);
  do_check_eq(expected.username, actual.username);
  do_check_eq(expected.authMethod, actual.authMethod);
  do_check_eq(expected.socketType, actual.socketType);
}

function check_identity(expected, actual) {
  do_check_eq(expected.fullName, actual.fullName);
  do_check_eq(expected.email, actual.email);
  do_check_eq(expected.replyTo, actual.replyTo);
  do_check_eq(expected.organization, actual.organization);
}

function check_pop3_incoming_server(expected, actual) {
  do_check_eq(expected.leaveMessagesOnServer, actual.leaveMessagesOnServer);
  do_check_eq(expected.deleteMailLeftOnServer, actual.deleteMailLeftOnServer);
  do_check_eq(expected.deleteByAgeFromServer, actual.deleteByAgeFromServer);
  do_check_eq(expected.numDaysToLeaveOnServer, actual.numDaysToLeaveOnServer);
}

function check_incoming_server(expected, actual) {
  do_check_eq(expected.type, actual.type);
  do_check_eq(expected.port, actual.port);
  do_check_eq(expected.username, actual.username);
  do_check_eq(expected.isSecure, actual.isSecure);
  do_check_eq(expected.authMethod, actual.authMethod);
  do_check_eq(expected.socketType, actual.socketType);
  do_check_eq(expected.doBiff, actual.doBiff);
  do_check_eq(expected.biffMinutes, actual.biffMinutes);

  if (expected.type == "pop3")
    check_pop3_incoming_server(expected, actual.QueryInterface(Ci.nsIPop3IncomingServer));
}

function check_account(expected, actual) {
  check_incoming_server(expected.incomingServer, actual.incomingServer);
  do_check_eq(1, actual.identities.Count());
  let actualIdentity = actual.identities.QueryElementAt(0, Ci.nsIMsgIdentity);
  check_identity(expected.identity, actualIdentity);

  if (expected.incomingServer.type != "nntp") {
    let actualSmtpServer = MailServices.smtp.getServerByKey(actualIdentity.smtpServerKey);
    check_smtp_server(expected.smtpServer, actualSmtpServer);
  }
}

function get_interface() {
  let importService = Cc["@mozilla.org/import/import-service;1"]
                        .getService(Ci.nsIImportService);
  let count = importService.GetModuleCount("settings");
  let settingsInterface;
  for (let i = 0; i < count; i++) {
    if (importService.GetModuleName("settings", i) == "Outlook Express") {
      return importService.GetModule("settings", i)
                          .GetImportInterface("settings")
                          .QueryInterface(Ci.nsIImportSettings);
    }
  }
}

function teardown() {
  let accounts = MailServices.accounts.accounts;

  for (let i = 0; i < accounts.Count(); i++) {
    let account = accounts.QueryElementAt(i, Ci.nsIMsgAccount);
    MailServices.accounts.removeAccount(account);
  }

  let smtpServers = MailServices.smtp.smtpServers;

  while (smtpServers.hasMoreElements()) {
    let server = smtpServers.getNext().QueryInterface(Ci.nsISmtpServer);
    MailServices.smtp.deleteSmtpServer(server);
  }

  REGISTRAR.unregisterFactory(Components.ID(uuid),
                              factory);
  REGISTRAR.registerFactory(gOriginalCID,
                            "",
                            CONTRACT_ID,
                            null);
}

function _import() {
  let settings = get_interface();
  do_check_eq(true, settings.AutoLocate({}, {}));
  do_check_eq(true, settings.Import({}));
}

function _test(registry, expectedAccount) {
  try {
    setup_registry(registry);
    _import();
    let accounts = MailServices.accounts.accounts;
    let lastIndex = accounts.Count() - 1;
    let actualAccount = accounts.QueryElementAt(lastIndex, Ci.nsIMsgAccount);
    check_account(expectedAccount, actualAccount);
  } catch(e) {
    teardown();
    do_throw(e);
  }
  teardown();
}

function run_test() {
  _test(new OE5Registry(new POP3Account()), expectedPop3Account);
  _test(new OE5Registry(new IMAPAccount()), expectedImapAccount);
  _test(new OE5Registry(new NNTPAccount()), expectedNntpAccount);

  _test(new OE4Registry(new POP3Account()), expectedPop3Account);
  _test(new OE4Registry(new IMAPAccount()), expectedImapAccount);
  _test(new OE4Registry(new NNTPAccount()), expectedNntpAccount);
}
