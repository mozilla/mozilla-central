/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the 'Set up a Filelink Account' dialog
 */

const MODULE_NAME = 'test-cloudfile-add-account-dialog';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['cloudfile-helpers',
                         'dom-helpers',
                         'folder-display-helpers',
                         'keyboard-helpers',
                         'window-helpers'];

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource:///modules/cloudFileAccounts.js');
Cu.import('resource:///modules/iteratorUtils.jsm');

const kCategory = 'cloud-files';
const kDialogId = 'addCloudFileAccount';
const kRootURL = collector.addHttpResource('../cloudfile/html', '');
const kSettingsWithForm = kRootURL + 'settings-with-form.xhtml';

let gOldProviders = {};
XPCOMUtils.defineLazyServiceGetter(this, 'gCategoryMan',
                                   '@mozilla.org/categorymanager;1',
                                   'nsICategoryManager');

function setupModule(module) {
  collector.getModule('dom-helpers').installInto(module);
  collector.getModule('folder-display-helpers').installInto(module);
  collector.getModule('keyboard-helpers').installInto(module);
  collector.getModule('window-helpers').installInto(module);

  // Save the old providers...
  for (let entry in fixIterator(gCategoryMan.enumerateCategory(kCategory),
                                Ci.nsISupportsCString)) {
    let value = gCategoryMan.getCategoryEntry(kCategory, entry.data);
    gOldProviders[entry] = value;
  }

  // Clear out the old entries
  gCategoryMan.deleteCategory(kCategory);

  collector.getModule('cloudfile-helpers').installInto(module);
};

function teardownModule(module) {
  // Clear out any leftover entries.
  gCategoryMan.deleteCategory(kCategory);

  // Put the old entries back
  for (let [key, value] in Iterator(gOldProviders))
    gCategoryMan.addCategoryEntry(kCategory, key, value, false, true);
}

/**
 * Helper function that ensures that we know the number of registered
 * Filelink service providers.
 *
 * @param aNum the number of expected registered Filelink service providers.
 */
function assert_num_providers(aNum) {
  let providers = [provider for each 
                   (provider in cloudFileAccounts.enumerateProviders())];
  assert_equals(aNum, providers.length,
                'Expected ' + aNum + ' providers to be available, but ' +
                'found ' + providers.length + ' instead.');
}

/**
 * Helper function that takes a controller for an 'Add an Account' dialog, and
 * returns the 'Set up Account' button.
 *
 * @param aController a controller for an 'Add an Account' dialog.
 */
function get_accept_button(aController) {
  return aController.window
                    .document
                    .documentElement
                    .getButton('accept');
}

/**
 * Helper function that waits for the contents of the Filelink provider
 * settings IFrame to be fully loaded.
 *
 * @param aController a controller for an 'Add an Account' dialog
 * @param aURL the expected URL for the IFrame to load.
 */
function wait_for_settings_loaded(aController, aURL) {
  wait_for_frame_load(aController.e('accountSettings'), aURL);
}

/**
 * Test that when the dialog first spawns, and the 'Select an account type'
 * menuitem is selected, that the accept button is disabled.
 */
function test_accept_disabled_by_default() {
  gMockCloudfileManager.register('service1');
  gMockCloudfileManager.register('service2');

  assert_num_providers(2);
  plan_for_modal_dialog(kDialogId, subtest_accept_disabled_by_default);
  cloudFileAccounts.addAccountDialog();
  wait_for_modal_dialog(kDialogId);

  gMockCloudfileManager.unregister('service1');
  gMockCloudfileManager.unregister('service2');
}

function subtest_accept_disabled_by_default(aController) {
  wait_for_element_enabled(aController, get_accept_button(aController),
                           false);
  close_window(aController);
}

/**
 * Test that if the dialog spawns and there are no services available,
 * then the 'sorry' text is displayed, and the accept button is disabled.
 */
function test_accept_disabled_if_no_services() {
  assert_num_providers(0);
  plan_for_modal_dialog(kDialogId, subtest_accept_disabled_if_no_services);
  cloudFileAccounts.addAccountDialog();
  wait_for_modal_dialog(kDialogId);
}

/**
 * Subtest for test_accept_disabled_if_no_services that ensures that the
 * 'Set up Account' button is disabled, the account type menulist is
 * not visible, and the 'sorry - can't add more than one account per type'
 * is displayed.
 */
function subtest_accept_disabled_if_no_services(aController) {
  wait_for_element_enabled(aController, get_accept_button(aController),
                           false);
  assert_element_not_visible(aController.eid('accountType'),
                             'Account type selector should be invisible.');
  assert_element_visible(aController.eid('noAccountText'),
                         'Should be displaying the "sorry, you can only ' +
                         'add one account for now" text.');
  close_window(aController);
}

/**
 * Test that if only a single provider is available to be added, that we
 * select it immediately.
 */
function test_lone_provider_auto_selected() {
  gMockCloudfileManager.register('lone-service');
  assert_num_providers(1);

  plan_for_modal_dialog(kDialogId, subtest_lone_provider_auto_selected);
  cloudFileAccounts.addAccountDialog();
  wait_for_modal_dialog(kDialogId);

  gMockCloudfileManager.unregister('lone-service');
}

/**
 * Subtest for test_lone_provider_auto_selected, ensures that the lone provider
 * has been selected in the menulist.  For a bonus, because by default the
 * settings form for the mock provider 'validates', we also check to make sure
 * that the 'Set up Account' button is enabled.
 */
function subtest_lone_provider_auto_selected(aController) {
  let menulist = aController.e('accountType');
  assert_equals(0, menulist.selectedIndex);
  wait_for_element_enabled(aController, get_accept_button(aController),
                           true);
}

/**
 * Test that if a provider has a settings form, that the 'Set up Account'
 * button does not become enabled until the form passes validation.
 */
function test_accept_enabled_on_form_validation() {
  // settings-with-form.xhtml has a form with a single text input. The form
  // requires that there be something in the text input before it passes
  // validation.
  gMockCloudfileManager.register('service-with-form', {
    settingsURL: kSettingsWithForm,
  });

  assert_num_providers(1);

  plan_for_modal_dialog(kDialogId,
                        subtest_accept_enabled_on_form_validation);
  cloudFileAccounts.addAccountDialog();
  wait_for_modal_dialog(kDialogId);

  gMockCloudfileManager.unregister('service-with-form');
}

/**
 * Subtest for test_accept_enabled_on_form_validation. Waits for the settings
 * XHTML page to be loaded, and then ensures that when we type into the lone
 * input, that the 'Set up Account' button becomes enabled.
 */
function subtest_accept_enabled_on_form_validation(aController) {
  // The button should start disabled.
  wait_for_element_enabled(aController, get_accept_button(aController),
                           false);
  wait_for_settings_loaded(aController, kSettingsWithForm);
  // The lone input should automatically be focused. Let's type something
  // into it.
  input_value(aController, 'Fone Bone');

  // The 'Set up Account' button should become enabled.
  wait_for_element_enabled(aController, get_accept_button(aController),
                           true);
}
