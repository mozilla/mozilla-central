/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * Global Object to hold methods for the advanced pref pane
 */
var gAdvancedPane = {
    _inited: false,
    /**
     * Initialize the advanced pref pane. Sets up dialog controls to match the
     * values set in prefs.
     */
    init: function advPaneInit() {
        this._inited = true;
        this._initMasterPasswordUI();

        var advancedPrefs = document.getElementById("advancedPrefs");
        var preference = document.getElementById("calendar.preferences.advanced.selectedTabIndex");
        if (preference.value === null) {
            return;
        }
        advancedPrefs.selectedIndex = preference.value;

#ifdef MOZ_UPDATER
        this.updateAppUpdateItems();
        this.updateAutoItems();
        this.updateModeItems();
#endif
    },

    /**
     * Handler function to call when the tab in the advanced pane has been
     * changed.
     */
    tabSelectionChanged: function advPaneTabSelectionChanged() {
        if (!this._inited) {
            return;
        }
        var advancedPrefs = document.getElementById("advancedPrefs");
        var preference = document.getElementById("calendar.preferences.advanced.selectedTabIndex");
        preference.valueFromPreferences = advancedPrefs.selectedIndex;
    },

    // GENERAL TAB

    /**
     * Show the connections dialog
     */
    showConnections: function advPaneShowConnections() {
        var url = "chrome://calendar/content/preferences/connection.xul";
        document.documentElement.openSubDialog(url, "", "chrome,dialog");
    },

    /**
     * Show the config editor dialog
     */
    showConfigEdit: function advPaneShowConfigEdit() {
        document.documentElement.openWindow("Preferences:ConfigManager",
                                            "chrome://global/content/config.xul",
                                            "", null);
    },

    // PASSWORDS TAB

    /**
     * Caches the security module service for multiple use.
     */
    __secModDb: null,
    get _secModDb() {
        if (!this.__secModDb) {
            this.__secModDb =
                Components.classes["@mozilla.org/security/pkcs11moduledb;1"]
                          .getService(Components.interfaces.nsIPKCS11ModuleDB);
        }
        return this.__secModDb;
    },

    /**
     * Initializes Master Password UI: the "Use Master Password" checkbox,
     * selects the Master Password button to show, and enables/disables it as
     * necessary.  The Master Password is controlled by various bits of NSS
     * functionality, so the UI for it can't be controlled by the normal
     * preference bindings.
     */
    _initMasterPasswordUI: function advPaneInitMasterPassword() {
        var noMP = !this._masterPasswordSet();

        var button = document.getElementById("changeMasterPassword");
        button.disabled = noMP;

        var checkbox = document.getElementById("useMasterPassword");
        checkbox.checked = !noMP;
    },

    /**
     * Returns true if the user has a Master Password set and false otherwise.
     */
    _masterPasswordSet: function advPaneMasterPasswordSet() {
        var slot = this._secModDb.findSlotByName("");
        if (slot) {
            const nsIPKCS11Slot = Components.interfaces.nsIPKCS11Slot;
            var status = slot.status;
            // Does the user have a Master Password set?
            return ((status != nsIPKCS11Slot.SLOT_UNINITIALIZED) &&
                    (status != nsIPKCS11Slot.SLOT_READY));
        } else {
            return false;
        }
    },

    /**
     * Enables/disables the Master Password button depending on the state of
     * the "Use Master Password" checkbox, and prompts for Master Password
     * removal if one is set. This function is called when the "Use Master
     * Password" checkbox is changed.
     */
    updateMasterPasswordButton: function advPaneUpdateMasterPasswordButton() {
        var checkbox = document.getElementById("useMasterPassword");
        var button = document.getElementById("changeMasterPassword");
        button.disabled = !checkbox.checked;

        // Unchecking the checkbox should try to immediately remove the Master
        // Password, because it's impossible to non-destructively remove the
        // Master Password used to encrypt all the passwords without providing
        // it (by design), and it would be extremely odd to pop up that dialog
        // when the user closes the prefwindow and saves his settings.
        if (!checkbox.checked) {
            this._removeMasterPassword();
        } else {
            this.changeMasterPassword();
        }
    },

    /**
     * Displays the "Remove Master Password" dialog to allow the user to
     * remove the current Master Password.  When the dialog is dismissed,
     * the Master Password UI is automatically updated.
     */
    _removeMasterPassword: function advRemoveMasterPassword() {
        if (this._secModDb.isFIPSEnabled) {
            var bundle = document.getElementById("bundleCalendarPreferences");
            Services.prompt.alert(window,
                                  bundle.getString("pw_change_failed_title"),
                                  bundle.getString("pw_change2empty_in_fips_mode"));
        } else {
            var url = "chrome://mozapps/content/preferences/removemp.xul";
            document.documentElement.openSubDialog(url, "", null);

        }
        this._initMasterPasswordUI();
    },

    /**
     * Displays a dialog in which the Master Password may be changed.
     */
    changeMasterPassword: function advPaneChangeMasterPassword() {
        var url = "chrome://mozapps/content/preferences/changemp.xul";
        document.documentElement.openSubDialog(url, "", null);

        this._initMasterPasswordUI();
    },

    /**
     * Shows the sites where the user has saved passwords and the associated
     * login information.
     */
    viewPasswords: function advPaneViewPasswords() {
        var url = "chrome://passwordmgr/content/passwordManager.xul";
        document.documentElement.openWindow("Toolkit:PasswordManager", url,
                                            "", null);
    },

    // UPDATE TAB

    /**
     * Preferences:
     *
     * app.update.enabled
     * - true if updates to the application are enabled, false otherwise
     * extensions.update.enabled
     * - true if updates to extensions and themes are enabled, false otherwise
     * app.update.auto
     * - true if updates should be automatically downloaded and installed,
     *   possibly with a warning if incompatible extensions are installed (see
     *   app.update.mode); false if the user should be asked what he wants to
     *   do when an update is available
     * app.update.mode
     * - an integer:
     *     0    do not warn if an update will disable extensions or themes
     *     1    warn if an update will disable extensions or themes
     *     2    warn if an update will disable extensions or themes *or* if
     *          the update is a major update
     */

    /**
     * Enables and disables various UI preferences as necessary to reflect
     * locked, disabled, and checked/unchecked states.
     *
     * UI state matrix for update preference conditions
     *
     * UI Elements:                                   Preferences
     * 1 = Sunbird checkbox                           i   = app.update.enabled
     * 2 = When updates for Sunbird are found label   ii  = app.update.auto
     * 3 = Automatic Radiogroup (Ask vs. Auto)        iii = app.update.mode
     * 4 = Warn before disabling add-ons checkbox
     *
     * States:
     * Element  Disabled    Pref  Value   Locked
     * 1        false       i     t/f     f
     *          true        i     t/f     t
     *          false       ii    t/f     t/f
     *          false       iii   0/1/2   t/f
     * 2,3      false       i     t       t/f
     *          true        i     f       t/f
     *          false       ii    t/f     f
     *          true        ii    t/f     t
     *          false       iii   0/1/2   t/f
     * 4        false       i     t       t/f
     *          true        i     f       t/f
     *          false       ii    t       t/f
     *          true        ii    f       t/f
     *          false       iii   0/1/2   f
     *          true        iii   0/1/2   t
     *
     */
#ifdef MOZ_UPDATER
    updateAppUpdateItems: function advPaneUpdateAppUpdateItems() {
        var aus = Components.classes["@mozilla.org/updates/update-service;1"]
                            .getService(Components.interfaces.nsIApplicationUpdateService);

        var enabledPref = document.getElementById("app.update.enabled");
        var enableAppUpdate = document.getElementById("enableAppUpdate");

        enableAppUpdate.disabled = !aus.canUpdate || enabledPref.locked;
    },

    /**
     * Enables/disables UI for "when updates are found" based on the values,
     * and "locked" states of associated preferences.
     */
    updateAutoItems: function advPaneUpdateAutoItems() {
        var enabledPref = document.getElementById("app.update.enabled");
        var autoPref = document.getElementById("app.update.auto");

        var updateModeLabel = document.getElementById("updateModeLabel");
        var updateMode = document.getElementById("updateMode");

        var disable = enabledPref.locked || !enabledPref.value ||
                      autoPref.locked;

        updateMode.disabled = disable;
        updateModeLabel.disabled = updateMode.disabled;
    },

    /**
     * Enables/disables the "warn if incompatible add-ons exist" UI based on
     * the values and "locked" states of various preferences.
     */
    updateModeItems: function advPaneUpdateModeItems() {
        var enabledPref = document.getElementById("app.update.enabled");
        var autoPref = document.getElementById("app.update.auto");
        var modePref = document.getElementById("app.update.mode");

        var warnIncompatible = document.getElementById("warnIncompatible");

        var disable = enabledPref.locked || !enabledPref.value ||
                      autoPref.locked || !autoPref.value || modePref.locked;

        warnIncompatible.disabled = disable;
    },

    /**
     * Stores the value of the app.update.mode preference, which is a tristate
     * integer preference.  We store the value here so that we can properly
     * restore the preference value if the UI reflecting the preference value
     * is in a state which can represent either of two integer values (as
     * opposed to only one possible value in the other UI state).
     */
    _modePreference: -1,

    /**
     * Reads the app.update.mode preference and converts its value into a
     * true/false value for use in determining whether the "Warn me if this
     * will disable any of my add-ons" checkbox is checked.  We also save the
     * value of the preference so that the preference value can be properly
     * restored if the user's preferences cannot adequately be expressed by a
     * single checkbox.
     *
     * app.update.mode   Checkbox State   Meaning
     * 0                 Unchecked        Do not warn
     * 1                 Checked          Warn if there are incompatibilities
     * 2                 Checked          Warn if there are incompatibilities,
     *                                    or the update is major.
     */
    readAddonWarn: function advPaneReadAddonWarn() {
        var preference = document.getElementById("app.update.mode");
        var warnMe = preference.value != 0;
        this._modePreference = warnMe ? preference.value : 1;
        return warnMe;
    },

    /**
     * Converts the state of the "Warn me if this will disable any of my
     * add-ons" checkbox into the integer preference which represents it,
     * returning that value.
     */
    writeAddonWarn: function advPaneWriteAddonWarn() {
        var warnIncompatible = document.getElementById("warnIncompatible");
        return warnIncompatible.checked ? this._modePreference : 0;
    },

    /**
     * Displays the history of installed updates.
     */
    showUpdates: function advPaneShowUpdates() {
        var prompter = Components.classes["@mozilla.org/updates/update-prompt;1"]
                                 .createInstance(Components.interfaces.nsIUpdatePrompt);
        prompter.showUpdateHistory(window);
    },
#endif

    /**
     * The Add-ons checkbox and button are disabled only if the enable
     * add-on update preference is locked.
     */
    updateAddonUpdateUI: function advPaneUpdateAddonUpdateUI() {
        var enabledPref = document.getElementById("extensions.update.enabled");
        var enableAddonUpdate = document.getElementById("enableAddonUpdate");

        enableAddonUpdate.disabled = enabledPref.locked;
    },


    // ENCRYPTION TAB

    /*
     * Preferences:
     *
     * security.enable_ssl3
     * - true if SSL 3 encryption is enabled, false otherwise
     * security.enable_tls
     * - true if TLS encryption is enabled, false otherwise
     * security.default_personal_cert
     * - a string:
     *     "Select Automatically"   select a certificate automatically when a site
     *                              requests one
     *     "Ask Every Time"         present a dialog to the user so he can select
     *                              the certificate to use on a site which
     *                              requests one
     */

    /**
     * Displays the user's certificates and associated options.
     */
    showCertificates: function gAP_showCertificates() {
      document.documentElement.openWindow("mozilla:certmanager",
                                          "chrome://pippki/content/certManager.xul",
                                          "", null);
    },

    /**
     * Displays a dialog which describes the user's CRLs.
     */
    showCRLs: function gAP_showCRLs() {
      document.documentElement.openWindow("Mozilla:CRLManager",
                                          "chrome://pippki/content/crlManager.xul",
                                          "", null);
    },

    /**
     * Displays a dialog in which OCSP preferences can be configured.
     */
    showOCSP: function gAP_showOCSP() {
      document.documentElement.openSubDialog("chrome://mozapps/content/preferences/ocsp.xul",
                                             "", null);
    },

    /**
     * Displays a dialog from which the user can manage his security devices.
     */
    showSecurityDevices: function gAP_showSecurityDevices() {
      document.documentElement.openWindow("mozilla:devicemanager",
                                          "chrome://pippki/content/device_manager.xul",
                                          "", null);
    }
};
