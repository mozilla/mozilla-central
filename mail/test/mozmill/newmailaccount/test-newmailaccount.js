/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the get an account (account provisioning) workflow.
 */

var Cu = Components.utils;
var Cc = Components.classes;
var Ci = Components.interfaces;

const MODULE_NAME = 'test-newmailaccount';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers',
                         'content-tab-helpers',
                         'window-helpers',
                         'newmailaccount-helpers',
                         'keyboard-helpers',
                         'dom-helpers'];

var controller = {};
var mozmill = {};
var elib = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
Cu.import('resource://mozmill/modules/elementslib.js', elib);
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/iteratorUtils.jsm');
Cu.import("resource:///modules/mailServices.js");
Cu.import('resource://mozmill/stdlib/httpd.js');

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../newmailaccount/html', '');
const kProvisionerUrl = "chrome://messenger/content/newmailaccount/accountProvisioner.xhtml";
const kProvisionerEnabledPref = "mail.provider.enabled";
const kSuggestFromNamePref = "mail.provider.suggestFromName";
const kProviderListPref = "mail.provider.providerList";
const kAcceptedLanguage = "general.useragent.locale";
const kDefaultServerPort = 4444;
const kDefaultServerRoot = "http://localhost:" + kDefaultServerPort;

Services.prefs.setCharPref(kProviderListPref, url + "providerList");
Services.prefs.setCharPref(kSuggestFromNamePref, url + "suggestFromName");

// Here's a name that we'll type in later on.  It's a global const because
// we'll be using it in several distinct modal dialog event loops.
const NAME = "Leonard Shelby";

// Record what the original value of the mail.provider.enabled pref is so
// that we can put it back once the tests are done.
var gProvisionerEnabled = Services.prefs.getBoolPref(kProvisionerEnabledPref);

// Record what the original value of the mail.provider.enabled pref is so
// that we can put it back once the tests are done.
var gProvisionerEnabled = Services.prefs.getBoolPref(kProvisionerEnabledPref);
var gOldAcceptLangs = Services.prefs.getCharPref(kAcceptedLanguage);
var gNumAccounts;

function setupModule(module) {
  collector.getModule('folder-display-helpers').installInto(module);
  collector.getModule('content-tab-helpers').installInto(module);
  collector.getModule('window-helpers').installInto(module);
  collector.getModule('newmailaccount-helpers').installInto(module);
  collector.getModule('keyboard-helpers').installInto(module);
  collector.getModule('dom-helpers').installInto(module);

  // Make sure we enable the Account Provisioner.
  Services.prefs.setBoolPref(kProvisionerEnabledPref, true);
  // Restrict the user's language to just en-US
  Services.prefs.setCharPref(kAcceptedLanguage, "en-US");

  // Add a "bar" search engine that we can switch to be the default.
  Services.search.addEngineWithDetails("bar", null, null, null, "post",
                                       "http://www.example.com/search");
};

function teardownModule(module) {
  // Put the mail.provider.enabled pref back the way it was.
  Services.prefs.setBoolPref(kProvisionerEnabledPref, gProvisionerEnabled);
  // And same with the user languages
  Services.prefs.setCharPref(kAcceptedLanguage, gOldAcceptLangs);
}

/* Helper function that returns the number of accounts associated with the
 * current profile.
 */
function nAccounts() {
  return [x for each (x in fixIterator(MailServices.accounts.accounts))].length;
}

/**
 * This tests the basic workflow for Account Provisioner - it spawns the
 * Provisioner window, fills in the search input, gets the results, clicks
 * on an address, completes a dummy form in a new tab for getting the account,
 * and then sets the provider as the default search engine.
 *
 * It gets a little complicated, since the modal dialog for the provisioner
 * spins it's own event loop, so we have to have subtest functions.  Therefore,
 * this test is split over 3 functions, and uses a global gNumAccounts.  The
 * three functions are "test_get_an_account", "subtest_get_an_account",
 * and "subtest_get_an_account_part_2".
 *
 * @param aCloseAndRestore a boolean for whether or not we should close and
 *                         restore the Account Provisioner tab before filling
 *                         in the form. Defaults to false.
 */
function test_get_an_account(aCloseAndRestore) {
  let originalEngine = Services.search.currentEngine;
  // Open the provisioner - once opened, let subtest_get_an_account run.
  plan_for_modal_dialog("AccountCreation", subtest_get_an_account);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");

  // Once we're here, subtest_get_an_account has completed, and we're waiting
  // for a content tab to load for the account order form.

  // Make sure the page is loaded.
  wait_for_content_tab_load(undefined, function (aURL) {
    return aURL.host == "localhost";
  });

  let tab = mc.tabmail.currentTabInfo;

  if (aCloseAndRestore) {
    // Close the account provisioner tab, and then restore it...
    mc.tabmail.closeTab(mc.tabmail.currentTabInfo);
    mc.tabmail.undoCloseTab();
    // Wait for the page to be loaded again...
    wait_for_content_tab_load(undefined, function (aURL) {
      return aURL.host == "localhost";
    });
    tab = mc.tabmail.currentTabInfo;
  }

  // Record how many accounts we start with.
  gNumAccounts = nAccounts();

  // Plan for the account provisioner window to re-open, and then run the
  // controller through subtest_get_an_account_part_2. Since the Account
  // Provisioner dialog is non-modal in the event of success, we use our
  // normal window handlers.
  plan_for_new_window("AccountCreation");

  // Click the OK button to order the account.
  let btn = tab.browser.contentWindow.document.querySelector("input[value=Send]");
  mc.click(new elib.Elem(btn));

  let ac = wait_for_new_window("AccountCreation");

  plan_for_window_close(ac);
  subtest_get_an_account_part_2(ac);
  wait_for_window_close();

  // Make sure we set the default search engine
  let engine = Services.search.getEngineByName("bar");
  assert_equals(engine, Services.search.currentEngine);

  // Restore the original search engine.
  Services.search.currentEngine = originalEngine;
  remove_email_account("green@example.com");
}

/**
 * This is a subtest for test_get_an_account, and runs the first time the
 * account provisioner window is opened.
 */
function subtest_get_an_account(w) {
  // Make sure we don't have bar as the default engine yet.
  let engine = Services.search.getEngineByName("bar");
  assert_not_equals(engine, Services.search.currentEngine);

  wait_for_provider_list_loaded(w);
  wait_for_search_ready(w);

  // Fill in some data
  let $ = w.window.$;
  type_in_search_name(w, "Green Llama");

  $("#searchSubmit").click();
  wait_for_search_results(w);

  // Click on the first address. This reveals the button with the price.
  $(".address:first").click();
  mc.waitFor(function () $("button.create:visible").length > 0);

  // Pick the email address green@example.com
  plan_for_content_tab_load();

  // Clicking this button should close the modal dialog.
  $('button.create[address="green@example.com"]').click();
}

/**
 * This is a subtest for test_get_an_account, and runs the second time the
 * account provisioner window is opened.
 */
function subtest_get_an_account_part_2(w) {
  // Re-get the new window
  let $ = w.window.$;

  // An account should have been added.
  assert_equals(nAccounts(), gNumAccounts + 1);

  // We want this provider to be our default search engine.
  wait_for_element_invisible(w, "window");
  wait_for_element_visible(w, "successful_account");

  // Make sure the search engine is checked
  assert_true($("#search_engine_check").is(":checked"));

  // Then click "Finish"
  mc.click(w.eid("closeWindow"));
}

/**
 * Runs test_get_an_account again, but this time, closes and restores the
 * order form tab before submitting it.
 */
function test_restored_ap_tab_works() {
  test_get_an_account(true);
}

/**
 * Test that clicking on the "I think I'll configure my account later"
 * button dismisses the Account Provisioner window.
 */
function test_can_dismiss_account_provisioner() {
  plan_for_modal_dialog("AccountCreation", subtest_can_dismiss_account_provisioner);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Subtest for test_can_dismiss_account_provisioner, that runs
 * once the modal dialog has opened.  This function just clicks the
 * "I think I'll configure my account later" button, and then waits
 * for itself to close.
 */
function subtest_can_dismiss_account_provisioner(w) {
  plan_for_window_close(w);
  // Click on the "I think I'll configure my account later" button.
  mc.click(new elib.Elem(w.window.document.querySelector(".close")));

  // Ensure that the window has closed.
  wait_for_window_close();
}

/**
 * Test that clicking on the "Skip this and use my existing email" button
 * sends us to the existing email account wizard.
 */
function test_can_switch_to_existing_email_account_wizard() {
  plan_for_modal_dialog("AccountCreation",
                        subtest_can_switch_to_existing_email_account_wizard);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
  // Ensure that the existing email account wizard opened.
  let wizard = wait_for_new_window("mail:autoconfig");

  // Then close the wizard
  close_window(wizard);
}

/**
 * Subtest for test_can_switch_to_existing_email_account_wizard.  This
 * function simply clicks on the "Skip this and use my existing email"
 * button, and then waits for itself to close.
 */
function subtest_can_switch_to_existing_email_account_wizard(w) {
  plan_for_window_close(w);
  plan_for_new_window("mail:autoconfig");

  // Click on the "Skip this and use my existing email" button
  mc.click(new elib.Elem(w.window.document.querySelector(".existing")));

  // Ensure that the Account Provisioner window closed
  wait_for_window_close();
}

/**
 * Test that clicking on the "Other languages" div causes account
 * providers with other languages to be displayed.
 */
function test_can_display_providers_in_other_languages() {
  plan_for_modal_dialog("AccountCreation",
                        subtest_can_display_providers_in_other_languages);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Subtest for test_can_display_providers_in_other_languages. This function
 * simply clicks on the div for displaying account providers in other
 * languages, and ensures that those other providers become visible.
 */
function subtest_can_display_providers_in_other_languages(w) {
  wait_for_provider_list_loaded(w);

  // Check that the "Other languages" div is hidden
  wait_for_element_visible(w, "otherLangDesc");
  let otherLanguages = w.window.$(".otherLanguage");
  assert_false(otherLanguages.is(":visible"));
  // Click on the "Other languages" div
  mc.click(w.eid("otherLangDesc"));

  wait_for_element_invisible(w, "otherLangDesc");
}

/**
 * Spawn the provisioner window by clicking on the menuitem,
 * then flip back and forth between that and the existing email
 * wizard, and then test to see if we can dismiss the provisioner.
 */
function test_flip_flop_from_provisioner_menuitem() {
  plan_for_modal_dialog("AccountCreation",
                        subtest_flip_flop_from_provisioner_menuitem);
  plan_for_new_window("mail:autoconfig");
  open_provisioner_window();
  plan_for_new_window("mail:autoconfig");
  wait_for_modal_dialog("AccountCreation");

  const NUM_OF_FLIP_FLOPS = 3;
  let wizard;

  for (let i = 0; i < NUM_OF_FLIP_FLOPS; ++i) {
    wizard = wait_for_new_window("mail:autoconfig");
    plan_for_modal_dialog("AccountCreation",
                          subtest_flip_flop_from_provisioner_menuitem);
    plan_for_new_window("mail:autoconfig");
    plan_for_window_close(wizard);
    wizard.click(wizard.eid("provisioner_button"));
    wait_for_modal_dialog("AccountCreation");
  }

  wizard = wait_for_new_window("mail:autoconfig");
  plan_for_modal_dialog("AccountCreation",
                        subtest_close_provisioner);
  wizard.click(wizard.eid("provisioner_button"));
  wait_for_modal_dialog("AccountCreation");
}

/**
 * This function is used by test_flip_flop_from_provisioner_menuitem to switch
 * back from the account provisioner to the wizard.
 */
function subtest_flip_flop_from_provisioner_menuitem(w) {
  // We need to wait for the wizard to be closed, or else
  // it'll try to refocus when we click on the button to
  // open it.
  wait_for_the_wizard_to_be_closed(w);
  plan_for_window_close(w)
  mc.click(new elib.Elem(w.window.document.querySelector(".existing")));
  wait_for_window_close();
}

/**
 * This function is used by test_flip_flop_from_provisioner_menuitem to close
 * the provisioner.
 */
function subtest_close_provisioner(w) {
  // Now make sure we can dismiss the provisioner.
  plan_for_window_close(w);
  // Click on the "I think I'll configure my account later" button.
  mc.click(new elib.Elem(w.window.document.querySelector(".close")));
  // Ensure that the window has closed.
  wait_for_window_close();
}

/**
 * Test that the name typed into the search field gets persisted after
 * doing a search, or choosing to go to the email setup wizard.
 */
function test_persist_name_in_search_field() {
  plan_for_modal_dialog("AccountCreation",
                        subtest_persist_name_in_search_field);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
  plan_for_modal_dialog("AccountCreation",
                        subtest_persist_name_in_search_field_part_2);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Subtest used by test_persist_name_in_search_field.  This function simply
 * puts a name into the search field, starts a search, and then dismisses
 * the window.
 */
function subtest_persist_name_in_search_field(w) {
  wait_for_provider_list_loaded(w);
  wait_for_search_ready(w);
  let $ = w.window.$;

  // Type a name into the search field
  type_in_search_name(w, NAME);

  // Do a search
  $("#searchSubmit").click();
  wait_for_search_results(w);

  plan_for_window_close(w);
  // Click on the "I think I'll configure my account later" button.
  mc.click(new elib.Elem(w.window.document.querySelector(".close")));
  wait_for_window_close();
}

/**
 * Subtest used by test_persist_name_in_search_field, the second time that
 * the account provisioner window is opened.  This function simply checks to
 * ensure that the name inserted in subtest_persist_name_in_search_field has
 * indeed persisted.
 */
function subtest_persist_name_in_search_field_part_2(w) {
  mc.waitFor(function () w.window.$("#name").val() == NAME);
}

/**
 * Test that names with HTML characters are escaped properly when displayed
 * back to the user.
 */
function test_html_characters_and_ampersands() {
  plan_for_modal_dialog("AccountCreation",
                        subtest_html_characters_and_ampersands);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Subtest used by test_html_characters_and_ampersands.  This function puts
 * a name with HTML tags into the search input, does a search, and ensures
 * that the rendered name has escaped the HTML tags properly.
 */
function subtest_html_characters_and_ampersands(w) {
  wait_for_provider_list_loaded(w);
  wait_for_search_ready(w);
  let $ = w.window.$;

  // Type a name with some HTML tags and an ampersand in there
  // to see if we can trip up account provisioner.
  const CLEVER_STRING = "<i>Hey, I'm ''clever &\"\" smart!<!-- Ain't I a stinkah? --></i>";
  type_in_search_name(w, CLEVER_STRING);

  // Do the search.
  $("#searchSubmit").click();

  wait_for_search_results(w);

  let displayedName = $("#FirstAndLastName").html();

  assert_not_equals(CLEVER_STRING, displayedName);
  // & should have been replaced with &amp;, and the
  // greater than / less than characters with &gt; and
  // &lt; respectively.
  assert_true(displayedName.contains("&amp;"),
              "Should have eliminated ampersands");
  assert_true(displayedName.contains("&gt;"),
              "Should have eliminated greater-than signs");
  assert_true(displayedName.contains("&lt;"),
              "Should have eliminated less-than signs");
}

/**
 * Test that only the terms of service and privacy links for selected
 * providers are shown in the disclaimer.
 */
function test_show_tos_privacy_links_for_selected_providers() {
  plan_for_modal_dialog("AccountCreation",
                        subtest_show_tos_privacy_links_for_selected_providers);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Subtest used by test_show_tos_privacy_links_for_selected_providers.  This
 * function selects and deselects a series of providers, and ensures that the
 * appropriate terms of service and privacy links are shown.
 */
function subtest_show_tos_privacy_links_for_selected_providers(w) {
  wait_for_provider_list_loaded(w);
  let $ = w.window.$;

  // We should be showing the TOS and Privacy links for the selected
  // providers immediately after the providers have been loaded.
  // Those providers should be "foo" and "bar".
  assert_links_shown(w, ['http://www.example.com/foo-tos',
                         'http://www.example.com/foo-privacy',
                         'http://www.example.com/bar-tos',
                         'http://www.example.com/bar-privacy',]);

  assert_links_not_shown(w, ['http://www.example.com/French-tos',
                             'http://www.example.com/French-privacy']);

  // Now click off one of those providers - we shouldn't be displaying
  // and links for that one now.
  w.click(new elib.Elem($('input[type="checkbox"][value="foo"]')[0]));

  assert_links_not_shown(w, ['http://www.example.com/foo-tos',
                             'http://www.example.com/foo-privacy',]);

  // Now show the providers from different locales...
  w.click(w.eid("otherLangDesc"));
  wait_for_element_invisible(w, "otherLangDesc");

  // And click on one of those providers...
  w.click(new elib.Elem($('input[type="checkbox"][value="French"]')[0]));
  // We should be showing the French TOS / Privacy links, along
  // with those from the bar provider.
  assert_links_shown(w, ['http://www.example.com/French-tos',
                         'http://www.example.com/French-privacy',
                         'http://www.example.com/bar-tos',
                         'http://www.example.com/bar-privacy']);

  // The foo provider should still have it's links hidden.
  assert_links_not_shown(w, ['http://www.example.com/foo-tos',
                             'http://www.example.com/foo-privacy',]);

  // Click on the German provider.  It's links should now be
  // shown, along with the French and bar providers.
  w.click(new elib.Elem($('input[type="checkbox"][value="German"]')[0]));
  assert_links_shown(w, ['http://www.example.com/French-tos',
                         'http://www.example.com/French-privacy',
                         'http://www.example.com/bar-tos',
                         'http://www.example.com/bar-privacy',
                         'http://www.example.com/German-tos',
                         'http://www.example.com/German-privacy']);

  // And the foo links should still be hidden.
  assert_links_not_shown(w, ['http://www.example.com/foo-tos',
                             'http://www.example.com/foo-privacy',]);

}

/**
 * Test that if the search goes bad on the server-side, that we show an
 * error.
 */
function test_shows_error_on_bad_suggest_from_name() {
  let original = Services.prefs.getCharPref(kSuggestFromNamePref);
  Services.prefs.setCharPref(kSuggestFromNamePref, url + "badSuggestFromName");
  plan_for_modal_dialog("AccountCreation",
                        subtest_shows_error_on_bad_suggest_from_name);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
  Services.prefs.setCharPref(kSuggestFromNamePref, original);
}

/**
 * Subtest for test_shows_error_on_bad_suggest_from_name.  This function does
 * a search, and then ensures that an error is displayed, since we got back
 * garbage from the server.
 */
function subtest_shows_error_on_bad_suggest_from_name(w) {
  wait_for_provider_list_loaded(w);
  wait_for_search_ready(w);
  let $ = w.window.$;

  type_in_search_name(w, "Boston Low");

  // Do the search.
  $("#searchSubmit").click();

  mc.waitFor(function () $("#notifications .error").is(":visible"));
}

/**
 * Test that if we get an empty result from the server after a search, that
 * we show an error message.
 */
function test_shows_error_on_empty_suggest_from_name() {
  let original = Services.prefs.getCharPref(kSuggestFromNamePref);
  Services.prefs.setCharPref(kSuggestFromNamePref, url + "emptySuggestFromName");
  plan_for_modal_dialog("AccountCreation",
                        subtest_shows_error_on_empty_suggest_from_name);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
  Services.prefs.setCharPref(kSuggestFromNamePref, original);
}

/**
 * Subtest for test_shows_error_on_empty_suggest_from_name. This function does
 * a search, and then ensures that an error is displayed, since we got back
 * an empty result from the server.
 */
function subtest_shows_error_on_empty_suggest_from_name(w) {
  wait_for_provider_list_loaded(w);
  wait_for_search_ready(w);
  let $ = w.window.$;

  type_in_search_name(w, "Maggie Robbins");

  // Do the search.
  $("#searchSubmit").click();

  mc.waitFor(function () $("#notifications .error").is(":visible"));
}

/**
 * Tests that if a provider returns broken or erroneous XML back
 * to the user after account registration, that we log the error
 * in the error console.
 */
function test_throws_console_error_on_corrupt_XML() {
  // Open the provisioner - once opened, let subtest_get_an_account run.
  get_to_order_form("corrupt@corrupt.invalid");
  let tab = mc.tabmail.currentTabInfo;

  // Record how many accounts we start with.
  gNumAccounts = nAccounts();

  gConsoleListener.reset();
  gConsoleListener.listenFor("Problem interpreting provider XML:");

  Services.console.registerListener(gConsoleListener);

  // Click the OK button to order the account.
  plan_for_modal_dialog("AccountCreation", close_dialog_immediately);

  let btn = tab.browser.contentWindow.document.querySelector("input[value=Send]");
  mc.click(new elib.Elem(btn));
  wait_for_modal_dialog("AccountCreation");

  gConsoleListener.wait();

  Services.console.unregisterListener(gConsoleListener);
}

/**
 * Test that if the providerList is invalid or broken JSON, that
 * we "go offline" and display an error message.
 */
function test_broken_provider_list_goes_offline() {
  let original = Services.prefs.getCharPref(kProviderListPref);
  Services.prefs.setCharPref(kProviderListPref, url + "providerListBad");

  plan_for_modal_dialog("AccountCreation",
                        subtest_broken_provider_list_goes_offline);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
  Services.prefs.setCharPref(kProviderListPref, original);
}

/**
 * Subtest for test_broken_provider_list_goes_offline. This function just
 * waits for the offline message to appear.
 */
function subtest_broken_provider_list_goes_offline(w) {
  wait_to_be_offline(w);
}

/**
 * Test that if a provider has not included some of the required fields,
 * then they're not included as a potential provider for the user.
 */
function test_incomplete_provider_not_displayed() {
  let original = Services.prefs.getCharPref(kProviderListPref);
  Services.prefs.setCharPref(kProviderListPref, url + "providerListIncomplete");

  plan_for_modal_dialog("AccountCreation",
                        subtest_incomplete_provider_not_displayed);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
  Services.prefs.setCharPref(kProviderListPref, original);
}

/**
 * Subtest for test_incomplete_provider_not_displayed. This function just
 * ensures that the provider that didn't include all of the required fields
 * is not displayed.
 */
function subtest_incomplete_provider_not_displayed(w) {
  wait_for_provider_list_loaded(w);
  // Make sure that the provider that didn't include the required fields
  // is not displayed.
  let $ = w.window.$;
  assert_equals(0, $('input[type="checkbox"][value="corrupt"]').length,
                "The Corrupt provider should not have been displayed");

  // And check to ensure that at least one other provider is displayed
  assert_equals(1, $('input[type="checkbox"][value="foo"]').length,
                "The foo provider should have been displayed");
}

/**
 * Test that if the search text input is empty, or if no providers are selected,
 * that the search submit button is disabled.
 */
function test_search_button_disabled_cases() {
  plan_for_modal_dialog("AccountCreation",
                        subtest_search_button_disabled_cases);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Subtest for test_search_button_disabled_cases.  This function ensures that
 * if the search input is empty, or if no providers are selected, then the
 * search submit button is disabled.  If, on the other hand some providers
 * are selected AND some text is in the search input, then the search submit
 * button should be enabled.
 */
function subtest_search_button_disabled_cases(w) {
  wait_for_provider_list_loaded(w);
  let $ = w.window.$;
  let searchInput = new elib.Elem($("#name")[0]);
  // Case 1:  Search input empty, some providers selected.

  // Empty any strings in the search input.  Select all of the input with
  // Ctrl-A, and then hit backspace.
  searchInput.getNode().focus();
  w.keypress(null, 'a', {accelKey: true});
  w.keypress(null, 'VK_BACK_SPACE', {});

  // Make sure at least one provider is checked
  $('input[type="checkbox"]:checked').click();
  $('input[type="checkbox"][value="foo"]').click();

  // The search submit button should become disabled
  wait_for_element_enabled(w, w.e("searchSubmit"), false);

  // Case 2:  Search input has text, some providers selected

  // Put something into the search input
  type_in_search_name(w, "Dexter Morgan");

  // We already have at least one provider checked from the last case, so
  // the search submit button should become enabled
  wait_for_element_enabled(w, w.e("searchSubmit"), true);

  // Case 3:  Search input has text, no providers selected
  // Make sure no provider checkboxes are checked.
  $('input[type="checkbox"]:checked').click();

  // The search submit button should now be disabled
  wait_for_element_enabled(w, w.e("searchSubmit"), false);

  // We'll turn on a single provider now to enable the search button,
  // so we can ensure that it actually *becomes* disabled for the next
  // case.
  $('input[type="checkbox"][value="foo"]').click();
  wait_for_element_enabled(w, w.e("searchSubmit"), true);

  // Case 4:  Search input has no text, and no providers are
  // selected.

  // Clear out the search input
  w.keypress(null, 'a', {accelKey: true});
  w.keypress(null, 'VK_BACK_SPACE', {});
  $('input[type="checkbox"]:checked').click();

  wait_for_element_enabled(w, w.e("searchSubmit"), false);
}

/**
 * Tests that when we pref off the Account Provisioner, the menuitem for it
 * becomes hidden, and the button to switch to it from the Existing Account
 * wizard also becomes hidden.  Note that this doesn't test explicitly
 * whether or not the Account Provisioner spawns when there are no accounts.
 * The tests in this file will fail if the Account Provisioner does not spawn
 * with no accounts, and when preffed off, if the Account Provisioner does
 * spawn (which it shouldn't), the instrumentation Mozmill test should fail.
 */
function test_can_pref_off_account_provisioner() {
  // First, we'll disable the account provisioner.
  Services.prefs.setBoolPref("mail.provider.enabled", false);

  // We'll use the Mozmill Menu API to grab the main menu...
  let mailMenuBar = mc.getMenu("#mail-menubar");
  let newMenuPopup = mc.eid("menu_NewPopup");
  let newMailAccountMenuitem = mc.eid("newMailAccountMenuItem");

  // First, we do some hackery to allow the "New" menupopup to respond to
  // events...
  let oldAllowEvents = newMenuPopup.getNode().allowevents;
  newMenuPopup.getNode().allowevents = true;

  // And then call open on the menu.  This doesn't actually open the menu
  // on screen, but it simulates the act, and dynamically generated or
  // modified menuitems react accordingly.  Simulating this helps us sidestep
  // weird platform issues.
  mailMenuBar.open();

  // Next, we'll ensure that the "Get a new mail account"
  // menuitem is no longer available
  mc.waitFor(function() {
    return mc.eid("newCreateEmailAccountMenuItem").getNode().hidden;
  }, "Timed out waiting for the Account Provisioner menuitem to be hidden");

  // Open up the Existing Account wizard
  plan_for_new_window("mail:autoconfig");
  mc.click(newMailAccountMenuitem);

  // Ensure that the existing email account wizard opened.
  let wizard = wait_for_new_window("mail:autoconfig");

  // And make sure the Get a New Account button is hidden.
  assert_true(wizard.eid("provisioner_button").getNode().hidden);

  // Alright, close the Wizard.
  plan_for_window_close(wizard);
  close_window(wizard);
  wait_for_window_close();

  // Ok, now pref the Account Provisioner back on
  Services.prefs.setBoolPref("mail.provider.enabled", true);

  // Re-open the menu to repopulate it.
  mailMenuBar.open();

  // Make sure that the "Get a new mail account" menuitem is NOT hidden.
  mc.waitFor(function() {
    return !mc.eid("newCreateEmailAccountMenuItem").getNode().hidden;
  }, "Timed out waiting for the Account Provisioner menuitem to appear");

  // Open up the Existing Account wizard
  plan_for_new_window("mail:autoconfig");
  mc.click(newMailAccountMenuitem);

  // Ensure that the existing email account wizard opened.
  let wizard = wait_for_new_window("mail:autoconfig");

  // Make sure that the button to open the Account Provisioner dialog is
  // NOT hidden.
  assert_false(wizard.eid("provisioner_button").getNode().hidden);

  // Alright, close up.
  close_window(wizard);

  // And finally restore the menu to the way it was.
  newMenuPopup.getNode().allowevents = oldAllowEvents;
}

// We cannot control menus via Mozmill in OSX, so we'll skip this test.
test_can_pref_off_account_provisioner.EXCLUDED_PLATFORMS = ['darwin'];

/**
 * Tests that if we load a provider list that does not include providers in
 * other languages, then the "show me providers in other languages" link is
 * hidden.
 */
function test_other_lang_link_hides() {
  let original = Services.prefs.getCharPref(kProviderListPref);
  Services.prefs.setCharPref(kProviderListPref, url + "providerListNoOtherLangs");

  plan_for_modal_dialog("AccountCreation",
                        subtest_other_lang_link_hides);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
  Services.prefs.setCharPref(kProviderListPref, original);
}

/**
 * Subtest for test_other_lang_link_hides that just waits for the provider
 * list to be loaded, and then ensures that the "show me providers in other
 * languages" link is not visible.
 */
function subtest_other_lang_link_hides(w) {
  wait_for_provider_list_loaded(w);
  wait_for_element_invisible(w, "otherLangDesc");
}

/**
 * Quickly get us to the default order form (registration.html) and return
 * when we're there.
 */
function get_to_order_form(aAddress) {
  if (!aAddress)
    aAddress = "green@example.com";

  plan_for_modal_dialog("AccountCreation", function(aController) {
    sub_get_to_order_form(aController, aAddress);
  });
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");

  // Once we're here, subtest_get_an_account has completed, and we're waiting
  // for a content tab to load for the account order form.

  // Make sure the page is loaded.
  wait_for_content_tab_load(undefined, function (aURL) {
    return aURL.host == "localhost";
  });
}

/**
 * Fills in the Account Provisioner dialog to get us to the order form.
 */
function sub_get_to_order_form(aController, aAddress) {
  wait_for_provider_list_loaded(aController);
  wait_for_search_ready(aController);

  // Fill in some data
  let $ = aController.window.$;
  type_in_search_name(aController, "Joe Nobody");

  $("#searchSubmit").click();
  wait_for_search_results(aController);

  // Click on the first address. This reveals the button with the price.
  $(".address:first").click();
  mc.waitFor(function () $("button.create:visible").length > 0);

  // Pick the email address green@example.com
  plan_for_content_tab_load();

  // Clicking this button should close the modal dialog.
  $('button.create[address="' + aAddress + '"]').click();
}

/**
 * Helper function to be passed to plan_for_modal_dialog that closes the
 * Account Provisioner dialog immediately.
 */
function close_dialog_immediately(aController) {
  plan_for_window_close(aController);
  mc.click(new elib.Elem(aController.window.document.querySelector(".close")));
  wait_for_window_close();
}

/**
 * Test that clicking on links in the order form open in the same account
 * provisioner tab.
 */
function test_internal_link_opening_behaviour() {
  get_to_order_form();

  // Open the provisioner - once opened, let subtest_get_an_account run...
  let tab = mc.tabmail.currentTabInfo;
  let doc = tab.browser.contentWindow.document;

  // Click on the internal link.
  mc.click(new elib.Elem(doc.getElementById("internal")));

  // We should load the target page in the current tab browser.
  wait_for_browser_load(tab.browser, function(aURL) {
    return aURL.host == "localhost" && aURL.path == "/target.html";
  });
  // Now close the tab.
  mc.tabmail.closeTab(tab);
}

/**
 * Test that window.open in the order form opens in new content tabs.
 */
function test_window_open_link_opening_behaviour() {
  get_to_order_form();

  let tab = mc.tabmail.currentTabInfo;
  let doc = tab.browser.contentWindow.document;

  // First, click on the Javascript link - this should open in a new content
  // tab and be focused.
  let newTabLink = doc.getElementById("newtab");
  open_content_tab_with_click(newTabLink, function(aURL) {
    return aURL.host == "localhost" && aURL.path == "/target.html";
  });

  // Close the new tab.
  let newTab = mc.tabmail.currentTabInfo;
  mc.tabmail.closeTab(newTab);
  mc.tabmail.closeTab(tab);
}

/**
 * Test that links with target="_blank" open in the default browser.
 */
function test_external_link_opening_behaviour() {
  get_to_order_form();

  let tab = mc.tabmail.currentTabInfo;
  let doc = tab.browser.contentWindow.document;

  // Mock out the ExternalProtocolService.
  gMockExtProtSvcReg.register();

  let external = doc.getElementById("external");
  let targetHref = external.href;
  mc.click(new elib.Elem(external));

  mc.waitFor(function () gMockExtProtSvc.urlLoaded(targetHref),
             "Timed out waiting for the link " + targetHref + "to be " +
             "opened in the default browser.");
  gMockExtProtSvcReg.unregister();
  mc.tabmail.closeTab(tab);
}

/**
 * Test that if the provider returns XML that we can't turn into an account,
 * then we error out and go back to the Account Provisioner dialog.
 */
function test_return_to_provisioner_on_error_XML() {
  const kOriginalTabNum = mc.tabmail.tabContainer.childNodes.length;

  get_to_order_form("error@error.invalid");

  let tab = mc.tabmail.currentTabInfo;
  let doc = tab.browser.contentWindow.document;

  plan_for_modal_dialog("AccountCreation", close_dialog_immediately);

  // Click the OK button to order the account.
  let btn = tab.browser.contentWindow.document.querySelector("input[value=Send]");
  mc.click(new elib.Elem(btn));

  wait_for_modal_dialog("AccountCreation");

  // We should be done executing the function defined in plan_for_modal_dialog
  // now, so the Account Provisioner dialog should be closed, and the order
  // form tab should have been closed.
  assert_equals(kOriginalTabNum, mc.tabmail.tabContainer.childNodes.length,
                "Timed out waiting for the order form tab to close.");
}

/**
 * Test that if we initiate a search, then the search input, the search button,
 * and all checkboxes should be disabled. The ability to close the window should
 * still be enabled though.
 */
function test_disabled_fields_when_searching() {
  plan_for_modal_dialog("AccountCreation",
                        subtest_disabled_fields_when_searching);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Subtest for test_disabled_fields_when_searching. Sets up a fake HTTP server
 * that slowly returns a search suggestion, and then checks to ensure all the
 * right fields are disabled (search input, search button, all check boxes).
 * We also make sure those fields are renabled once the test is completed.
 */
function subtest_disabled_fields_when_searching(aController) {
  const kSuggestPath = "/slowSuggest";
  const kSearchMSeconds = 2000;
  let timer;

  function slow_results(aRequest, aResponse) {
    aResponse.processAsync();
    timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    let result = [{
      product: "personalized_email",
      addresses: ["green@example.com", "green_llama@example.com"],
      succeeded: true,
      quote: "b28acb3c0a474d33af22",
      price: 0,
      provider: "bar"
    }];
    let timerEvent = {
      notify: function(aTimer) {
        aResponse.setStatusLine(null, 200, "OK");
        aResponse.setHeader("Content-Type", "application/json");
        aResponse.write(JSON.stringify(result));
        aResponse.finish();
      }
    };
    timer.initWithCallback(timerEvent, kSearchMSeconds,
                           Ci.nsITimer.TYPE_ONE_SHOT);
  }

  // Set up a mock HTTP server to serve up a super slow search...
  let server = new HttpServer();;
  server.registerPathHandler(kSuggestPath, slow_results);
  server.start(kDefaultServerPort);

  // Now point our suggestFromName pref at that slow server.
  let originalSuggest = Services.prefs.getCharPref(kSuggestFromNamePref);
  Services.prefs.setCharPref(kSuggestFromNamePref,
                             kDefaultServerRoot + kSuggestPath);

  wait_for_provider_list_loaded(aController);
  wait_for_search_ready(aController);

  let doc = aController.window.document;
  type_in_search_name(aController, "Fone Bone");

  aController.click(aController.eid("searchSubmit"));

  // Our slow search has started. We have kSearchMSeconds milliseconds before
  // the search completes. Plenty of time to check that the right things are
  // disabled.
  wait_for_element_enabled(aController, aController.e("searchSubmit"), false);
  wait_for_element_enabled(aController, aController.e("name"), false);
  let providerCheckboxes = doc.querySelectorAll(".providerCheckbox");

  for (let [, checkbox] in Iterator(providerCheckboxes))
    wait_for_element_enabled(aController, checkbox, false);

  // Check to ensure that the buttons for switching to the wizard and closing
  // the wizard are still enabled.
  wait_for_element_enabled(aController, doc.querySelector(".close"), true);
  wait_for_element_enabled(aController, doc.querySelector(".existing"), true);

  // Ok, wait for the results to come through...
  wait_for_search_results(aController);

  wait_for_element_enabled(aController, aController.e("searchSubmit"), true);
  wait_for_element_enabled(aController, aController.e("name"), true);

  for (let [, checkbox] in Iterator(providerCheckboxes))
    wait_for_element_enabled(aController, checkbox, true);

  // Ok, cleanup time. Put the old suggest URL back.
  Services.prefs.setCharPref(kSuggestFromNamePref, originalSuggest);

  // The fake HTTP server stops asynchronously, so let's kick off the stop
  // and wait for it to complete.
  let serverStopped = false;
  server.stop(function() {
    serverStopped = true;
  });
  aController.waitFor(function() serverStopped,
                      "Timed out waiting for the fake server to stop.");

  close_dialog_immediately(aController);
}

/**
 * Tests that the search button is disabled if there is no initially
 * supported language for the user.
 */
function test_search_button_disabled_if_no_lang_support() {
  // Set the user's supported language to something ridiculous (caching the
  // old one so we can put it back later).
  let oldLang = Services.prefs.getCharPref(kAcceptedLanguage);
  Services.prefs.setCharPref(kAcceptedLanguage, "foo");

  plan_for_modal_dialog("AccountCreation", function(aController) {
    wait_for_provider_list_loaded(aController);
    // The search button should be disabled.
    wait_for_element_enabled(aController, aController.e("searchSubmit"), false);
    close_dialog_immediately(aController);
  });

  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");

  Services.prefs.setCharPref(kAcceptedLanguage, oldLang);
}

/**
 * Subtest used by several functions that checks to make sure that the
 * search button is disabled when the Account Provisioner dialog is opened,
 * in case there's no search input yet.
 */
function subtest_search_button_enabled_state_on_init(aController) {
  wait_for_provider_list_loaded(aController);

  let enabled = !!aController.e("name").value;

  // The search button should be disabled if there's not search input.
  wait_for_element_enabled(aController, aController.e("searchSubmit"), enabled);


  close_dialog_immediately(aController);
}

/**
 * Test that if the providerList contains entries with supported languages
 * including "*", they are always displayed, even if the users locale pref
 * is not set to "*".
 */
function test_provider_language_wildcard() {
  let oldLang = Services.prefs.getCharPref(kAcceptedLanguage);
  Services.prefs.setCharPref(kAcceptedLanguage, "foo-bar");

  let original = Services.prefs.getCharPref(kProviderListPref);
  Services.prefs.setCharPref(kProviderListPref, url + "providerListWildcard");

  plan_for_modal_dialog("AccountCreation",
                        subtest_provider_language_wildcard);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
  Services.prefs.setCharPref(kProviderListPref, original);
  Services.prefs.setCharPref(kAcceptedLanguage, oldLang);
}

/**
 * Subtest used by test_provider_language_wildcard, ensures that the
 * "Universal" and "OtherUniversal" providers are displayed, but the French
 * and German ones are not.
 */
function subtest_provider_language_wildcard(aController) {
  wait_for_provider_list_loaded(aController);
  let doc = aController.window.document;
  // Check that the two universal providers are visible.
  wait_for_element_visible(aController, "universal-check");
  wait_for_element_visible(aController, "otherUniversal-check");
  // The French and German providers should not be visible.
  wait_for_element_invisible(aController, "french-check");
  wait_for_element_invisible(aController, "german-check");
  close_dialog_immediately(aController);
}

/**
 * Tests that the search button is disabled if we start up the Account
 * Provisioner, and we have no search in the input.
 */
function test_search_button_disabled_if_no_query_on_init() {
  // We have to do a little bit of gymnastics to access the local storage
  // for the accountProvisioner dialog...
  let url = "chrome://content/messenger/accountProvisionerStorage/accountProvisioner";
  let dsm = Services.domStorageManager;

  let uri = Services.io.newURI(url, "", null);
  let principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(uri);
  let storage = dsm.getLocalStorageForPrincipal(principal, url);

  // Ok, got it. Now let's blank out the name.
  storage.setItem("name", "");

  plan_for_modal_dialog("AccountCreation",
                        subtest_search_button_enabled_state_on_init);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Test that if we try to open the Account Provisioner dialog when an
 * Account Provisioner tab is opened, that we focus the tab instead of opening
 * the dialog.
 */
function test_get_new_account_focuses_existing_ap_tab() {
  get_to_order_form("green@example.com");
  let apTab = mc.tabmail.getTabInfoForCurrentOrFirstModeInstance(
    mc.tabmail.tabModes["accountProvisionerTab"]);

  // Switch back to the inbox tab.
  mc.tabmail.switchToTab(0);

  // Try to re-open the provisioner dialog
  open_provisioner_window();

  // If we got here, that means that we weren't blocked by a dialog
  // being opened, which is good.
  assert_selected_tab(apTab);

  // Now open up the wizard, and try opening the Account Provisioner from
  // there.
  plan_for_new_window("mail:autoconfig");

  // Open the wizard...
  mc.click(new elib.Elem(mc.menus.menu_File.menu_New.newMailAccountMenuItem));
  let wizard = wait_for_new_window("mail:autoconfig");

  // Click on the "Get a new Account" button in the wizard.
  wizard.click(wizard.eid("provisioner_button"));

  // If we got here, that means that we weren't blocked by a dialog
  // being opened, which is what we wanted..
  assert_selected_tab(apTab);
  mc.tabmail.closeTab(apTab);
}

/**
 * Test that some prices can be per-address, instead of per-provider.
 */
function test_per_address_prices() {
  plan_for_modal_dialog("AccountCreation", subtest_per_address_prices);
  open_provisioner_window();
  wait_for_modal_dialog("AccountCreation");
}

/**
 * Subtest used by test_html_characters_and_ampersands.  This function puts
 * a name with HTML tags into the search input, does a search, and ensures
 * that the rendered name has escaped the HTML tags properly.
 */
function subtest_per_address_prices(w) {
  wait_for_provider_list_loaded(w);
  wait_for_search_ready(w);
  let $ = w.window.$;

  // Type a name with some HTML tags and an ampersand in there
  // to see if we can trip up account provisioner.
  type_in_search_name(w, "Joanna Finkelstein");

  // Do the search.
  $("#searchSubmit").click();

  wait_for_search_results(w);

  let prices = ["$20-$0 a year", "Free", "$20.00 a year"];

  // Check that the multi-provider has the default price.
  assert_true($(".provider:contains('multi') ~ .price").text(), prices[0].slice(0, 6));

  // Click on the multi provider. This reveals the buttons with the prices.
  $(".provider:contains('multi')").click();
  mc.waitFor(function () $("button.create:visible").length > 0);

  // For each button, make sure it has the correct price.
  $("button.create:visible").text(function(index, text){
    assert_equals(text, prices[index]);
  });
}
