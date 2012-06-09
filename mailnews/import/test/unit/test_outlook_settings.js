Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

load("resources/mock_windows_reg_factory.js");

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
  'Leave Mail On Server': 1,
  'SMTP Server': 'smtp.host.invalid',
  'SMTP Display Name': 'SMTP Display Name',
  'SMTP Email Address': 'pop3user@host.invalid',
  'SMTP Reply To Email Address': 'pop3user@host.invalid',
  'SMTP Organization Name': 'SMTP Organization Name',
  'SMTP User Name': 'smtpuser'
};

function IMAPAccount() {}

IMAPAccount.prototype = {
  'Account Name': 'IMAP Account Name',
  'IMAP Server': 'imap.host.invalid',
  'IMAP User Name': 'imapuser',
  'SMTP Server': 'smtp.host.invalid',
  'SMTP Display Name': 'SMTP Display Name',
  'SMTP Email Address': 'imapuser@host.invalid',
  'SMTP Reply To Email Address': 'imapuser@host.invalid',
  'SMTP Organization Name': 'SMTP Organization Name',
  'SMTP User Name': 'smtpuser'
};

/* Outlook 98 */
function Outlook98Registry(defaultAccount) {
  this._defaultAccount = defaultAccount;
}

Outlook98Registry.prototype = {
  get 'Software\\Microsoft\\Office\\8.0\\Outlook\\OMI Account Manager'() {
    return {
      'Default Mail Account': '00000001',
      '00000001': this._defaultAccount
    };
  }
};

/* Outlook 2003 - */
function Outlook2003Registry(defaultAccount) {
  this._defaultAccount = defaultAccount;
}

Outlook2003Registry.prototype = {
  get 'Software\\Microsoft\\Office\\Outlook\\OMI Account Manager'() {
    return {
      'Default Mail Account': '00000001',
      '00000001': this._defaultAccount
    };
  }
};

let expectedPop3Account = {
  incomingServer: {
    type: 'pop3',
    hostName: 'pop.invalid.host',
    username: 'pop3user',
    leaveMessagesOnServer: true
  },
  identity: {
    fullName: 'SMTP Display Name',
    email: 'pop3user@host.invalid',
    replyTo: 'pop3user@host.invalid',
    organization: 'SMTP Organization Name'
  },
  smtpServer: {
    hostname: 'smtp.invalid.host',
    username: 'smtpuser'
  }
};

let expectedImapAccount = {
  incomingServer: {
    type: 'imap',
    hostName: 'imap.invalid.host',
    username: 'imapuser'
  },
  identity: {
    fullName: 'SMTP Display Name',
    email: 'imapuser@host.invalid',
    replyTo: 'imapuser@host.invalid',
    organization: 'SMTP Organization Name'
  },
  smtpServer: {
    hostname: 'smtp.invalid.host',
    username: 'smtpuser'
  }
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
  do_check_eq(expected.username, actual.username);
}

function check_identity(expected, actual) {
  do_check_eq(expected.fullName, actual.fullName);
  do_check_eq(expected.email, actual.email);
  do_check_eq(expected.replyTo, actual.replyTo);
  do_check_eq(expected.organization, actual.organization);
}

function check_pop3_incoming_server(expected, actual) {
  do_check_eq(expected.leaveMessagesOnServer, actual.leaveMessagesOnServer);
}

function check_incoming_server(expected, actual) {
  do_check_eq(expected.type, actual.type);
  do_check_eq(expected.username, actual.username);

  if (expected.type == "pop3")
    check_pop3_incoming_server(expected, actual.QueryInterface(Ci.nsIPop3IncomingServer));
}

function check_account(expected, actual) {
  check_incoming_server(expected.incomingServer, actual.incomingServer);
  do_check_eq(1, actual.identities.Count());
  let actualIdentity = actual.identities.QueryElementAt(0, Ci.nsIMsgIdentity);
  check_identity(expected.identity, actualIdentity);

  let actualSmtpServer = MailServices.smtp.getServerByKey(actualIdentity.smtpServerKey);
  check_smtp_server(expected.smtpServer, actualSmtpServer);
}

function get_interface() {
  let importService = Cc["@mozilla.org/import/import-service;1"]
                        .getService(Ci.nsIImportService);
  let count = importService.GetModuleCount("settings");
  let settingsInterface;
  for (let i = 0; i < count; i++) {
    if (importService.GetModuleName("settings", i) == "Outlook") {
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
  _test(new Outlook2003Registry(new POP3Account()), expectedPop3Account);
  _test(new Outlook2003Registry(new IMAPAccount()), expectedImapAccount);

  _test(new Outlook98Registry(new POP3Account()), expectedPop3Account);
  _test(new Outlook98Registry(new IMAPAccount()), expectedImapAccount);
}

