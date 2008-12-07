// This set of prefs is copyied over the defaults that build-seamonkey-util.pl
// sets up.
user_pref("browser.dom.window.dump.enabled", true);
user_pref("extensions.palmsync.conduitRegistered", true);
user_pref("mail.account.account1.server", "server1");
user_pref("mail.account.account2.identities", "id1");
user_pref("mail.account.account2.server", "server2");
user_pref("mail.accountmanager.accounts", "account1,account2");
user_pref("mail.accountmanager.defaultaccount", "account2");
user_pref("mail.accountmanager.localfoldersserver", "server1");
user_pref("mail.identity.id1.fullName", "Tinderbox");
user_pref("mail.identity.id1.smtpServer", "smtp1");
user_pref("mail.identity.id1.useremail", "tinderbox@invalid.com");
user_pref("mail.identity.id1.valid", true);
user_pref("mail.root.none-rel", "[ProfD]Mail");
user_pref("mail.root.pop3-rel", "[ProfD]Mail");
user_pref("mail.server.server1.directory-rel", "[ProfD]Mail/Local Folders");
user_pref("mail.server.server1.hostname", "Local Folders");
user_pref("mail.server.server1.name", "Local Folders");
user_pref("mail.server.server1.type", "none");
user_pref("mail.server.server1.userName", "nobody");
user_pref("mail.server.server2.check_new_mail", false);
user_pref("mail.server.server2.directory-rel", "[ProfD]Mail/tinderbox");
user_pref("mail.server.server2.download_on_biff", true);
user_pref("mail.server.server2.hostname", "tinderbox");
user_pref("mail.server.server2.login_at_startup", false);
user_pref("mail.server.server2.name", "tinderbox@invalid.com");
user_pref("mail.server.server2.type", "pop3");
user_pref("mail.server.server2.userName", "tinderbox");
user_pref("mail.smtp.defaultserver", "smtp1");
user_pref("mail.smtpserver.smtp1.hostname", "tinderbox");
user_pref("mail.smtpserver.smtp1.username", "tinderbox");
user_pref("mail.smtpservers", "smtp1");
user_pref("mail.startup.enabledMailCheckOnce", true);
user_pref("mailnews.start_page_override.mstone", "1.9pre");
user_pref("mail.shell.checkDefaultClient", false);
// Ensure OS X and Outlook/OE books are disabled
user_pref("ldap_2.servers.osx.position", 0);
user_pref("ldap_2.servers.oe.position", 0);
