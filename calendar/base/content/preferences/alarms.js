/**
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is OEone Calendar Code, released October 31st, 2001.
 *
 * The Initial Developer of the Original Code is
 * OEone Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mostafa Hosseini <mostafah@oeone.com>
 *   Matthew Willis <mattwillis@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK *****
 */

/**
 * Global Object to hold methods for the alarms pref pane
 */
var gAlarmsPane = {
    /**
     * Initialize the alarms pref pane. Sets up dialog controls to match the
     * values set in prefs.
     */
    init: function gAP_init() {
        // Enable/disable the alarm sound URL box and buttons
        this.alarmsPlaySoundPrefChanged();

        // Set the correct singular/plural for the time units
        this.updateMenuPlural("eventdefalarmlen", "eventdefalarmunit");
        this.updateMenuPlural("tododefalarmlen",  "tododefalarmunit");
    },

    /**
     * Update the given menu to show the correct plural form in the unit
     * menulist.
     *
     * @param lengthFieldId     The ID of the length field textbox.
     * @param menuId            The ID of the unit menu to update.
     */
    updateMenuPlural: function gAP_updateMenuPlural(lengthFieldId, menuId) {
        var field = document.getElementById(lengthFieldId);
        var menu  = document.getElementById(menuId);

        var length = field.value;
        var newLabelNumber;
        if (Number(length) > 1) {
            newLabelNumber = "labelplural";
        } else {
            newLabelNumber = "labelsingular";
        }

        // Only make necessary changes
        var oldLabelNumber = menu.getAttribute("labelnumber");
        if (newLabelNumber != oldLabelNumber) {
            // remember what we are showing now
            menu.setAttribute("labelnumber", newLabelNumber);

            // update the menu items
            var items = menu.getElementsByTagName("menuitem");

            for (var i=0; i < items.length; i++) {
                var menuItem = items[i];
                var newLabel = menuItem.getAttribute(newLabelNumber);
                menuItem.label = newLabel;
                menuItem.setAttribute("label", newLabel);
            }

            // force the menu selection to redraw
            var saveSelectedIndex = menu.selectedIndex;
            menu.selectedIndex = -1;
            menu.selectedIndex = saveSelectedIndex;
        }
    },

    /**
     * Converts the given file url to a nsILocalFile
     *
     * @param aFileURL    A string with a file:// url.
     * @return            The corresponding nsILocalFile.
     */
    convertURLToLocalFile: function gAP_convertURLToLocalFile(aFileURL) {
        // Convert the file url into a nsILocalFile
        if (aFileURL) {
            var ios = Components.classes["@mozilla.org/network/io-service;1"]
                                .getService(Components.interfaces.nsIIOService);
            var fph = ios.getProtocolHandler("file")
                         .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
            return fph.getFileFromURLSpec(aFileURL);
        } else {
            return null;
        }
    },

    /**
     * Handler function to be called when the calendar.alarms.soundURL pref has
     * changed. Updates the label in the dialog.
     */
    readSoundLocation: function gAP_readSoundLocation() {
        var soundUrl = document.getElementById("alarmSoundFileField");
        soundUrl.value = document.getElementById("calendar.alarms.soundURL").value;
        if (soundUrl.value.indexOf("file://") == 0) {
            soundUrl.label = this.convertURLToLocalFile(soundUrl.value).leafName;
        } else {
            soundUrl.label = soundUrl.value;
        }
        return undefined;
    },

    /**
     * Causes the default sound to be selected in the dialog controls
     */
    useDefaultSound: function gAP_useDefaultSound() {
        var defaultSoundUrl = "chrome://calendar/content/sound.wav";
        document.getElementById("calendar.alarms.soundURL").value = defaultSoundUrl;
        document.getElementById("alarmSoundCheckbox").checked = true;
        this.readSoundLocation();
    },

    /**
     * Opens a filepicker to open a local sound for the alarm.
     */
    browseAlarm: function gAP_browseAlarm() {
        const nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes["@mozilla.org/filepicker;1"]
                    .createInstance(nsIFilePicker);

        var bundlePreferences = document.getElementById("bundleCalendarPreferences");
        var title = bundlePreferences.getString("Open");
        var wildmat = "*.wav";
        var label = bundlePreferences.getFormattedString("filterWav", [wildmat], 1);

        fp.init(window, title, nsIFilePicker.modeOpen);
        fp.appendFilter(label, wildmat);
        fp.appendFilters(nsIFilePicker.filterAll);

        var ret = fp.show();

        if (ret == nsIFilePicker.returnOK) {
            document.getElementById("calendar.alarms.soundURL").value = fp.fileURL.spec;
            document.getElementById("alarmSoundCheckbox").checked = true;
            this.readSoundLocation();
        }
    },

    /**
     * Plays the alarm sound currently selected.
     */
    previewAlarm: function gAP_previewAlarm() {
        var soundUrl = document.getElementById("alarmSoundFileField").value;
        var soundIfc = Components.classes["@mozilla.org/sound;1"]
                            .createInstance(Components.interfaces.nsISound);
        var ios = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);
        var url;
        try {
            soundIfc.init();
            if (soundUrl && soundUrl.length && soundUrl.length > 0) {
                url = ios.newURI(soundUrl, null, null);
                soundIfc.play(url);
            } else {
                soundIfc.beep();
            }
        } catch (ex) {
            dump("alarms.js previewAlarm Exception caught! " + ex + "\n");
        }
    },

    /**
     * Handler function to call when the calendar.alarms.playsound preference
     * has been changed. Updates the disabled state of fields that depend on
     * playing a sound.
     */
    alarmsPlaySoundPrefChanged: function gAP_alarmsPlaySoundPrefChanged() {
        var alarmsPlaySoundPref =
            document.getElementById("calendar.alarms.playsound");

        var items = [document.getElementById("alarmSoundFileField"),
                     document.getElementById("calendar.prefs.alarm.sound.useDefault"),
                     document.getElementById("calendar.prefs.alarm.sound.browse"),
                     document.getElementById("calendar.prefs.alarm.sound.preview")];

        for (var i=0; i < items.length; i++) {
            items[i].disabled = !alarmsPlaySoundPref.value;
        }
    }
};
