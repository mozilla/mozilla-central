/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import org.mozilla.gecko.util.GeckoEventListener;
import org.mozilla.gecko.util.ThreadUtils;

import org.json.JSONArray;
import org.json.JSONObject;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.preference.CheckBoxPreference;
import android.preference.TwoStatePreference;
import android.preference.EditTextPreference;
import android.preference.ListPreference;
import android.preference.Preference;
import android.preference.Preference.OnPreferenceChangeListener;
import android.preference.PreferenceActivity;
import android.preference.PreferenceGroup;
import android.preference.PreferenceManager;
import android.preference.PreferenceScreen;
import android.util.Log;
import android.view.MenuItem;
import android.widget.EditText;
import android.widget.Toast;

import java.util.ArrayList;

/**
 * Base PreferenceActivity class for preference screens in Settings.
 *
 * Use this for nested preference screens.
 */

public abstract class GeckoPreferencesActivity
    extends PreferenceActivity
    implements OnPreferenceChangeListener, GeckoEventListener, GeckoActivityStatus
{
    private static final String LOGTAG = "GeckoPreferencesActivity";

    private ArrayList<String> mPreferencesList;
    protected PreferenceScreen mPreferenceScreen;
    private static boolean sIsCharEncodingEnabled = false;

    protected static final String NON_PREF_PREFIX = "android.not_a_preference.";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupPrefsBranch();
        addPreferencesFromResource(getPreferencesResource());
        registerEventListener("Sanitize:Finished");

        if (Build.VERSION.SDK_INT >= 14)
            getActionBar().setHomeButtonEnabled(true);
    }

    // Return preferences resource id.
    protected abstract int getPreferencesResource();

    // Override if using non-default prefs branch.
    protected void setupPrefsBranch() {
        return;
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        if (!hasFocus)
            return;

        mPreferencesList = new ArrayList<String>();
        mPreferenceScreen = getPreferenceScreen();
        initGroups(mPreferenceScreen);
        initValues();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterEventListener("Sanitize:Finished");
    }

    @Override
    public void onPause() {
        super.onPause();

        if (getApplication() instanceof GeckoApplication) {
            ((GeckoApplication) getApplication()).onActivityPause(this);
        }
    }

    @Override
    public void onResume() {
        super.onResume();

        if (getApplication() instanceof GeckoApplication) {
            ((GeckoApplication) getApplication()).onActivityResume(this);
        }
    }

    public void handleMessage(String event, JSONObject message) {
        try {
            if (event.equals("Sanitize:Finished")) {
                boolean success = message.getBoolean("success");
                final int stringRes = success ? R.string.private_data_success : R.string.private_data_fail;
                final Context context = this;
                ThreadUtils.postToUiThread(new Runnable () {
                    @Override
                    public void run() {
                        Toast.makeText(context, stringRes, Toast.LENGTH_SHORT).show();
                    }
                });
            }
        } catch (Exception e) {
            Log.e(LOGTAG, "Exception handling message \"" + event + "\":", e);
        }
    }

    private void initGroups(PreferenceGroup preferences) {
        final int count = preferences.getPreferenceCount();
        for (int i = 0; i < count; i++) {
            Preference pref = preferences.getPreference(i);
            if (pref instanceof PreferenceGroup)
                initGroups((PreferenceGroup)pref);
            else {
                pref.setOnPreferenceChangeListener(this);

                // Some Preference UI elements are not actually preferences,
                // but they require a key to work correctly. For example,
                // "Clear private data" requires a key for its state to be
                // saved when the orientation changes. It uses the
                // "android.not_a_preference.privacy.clear" key - which doesn't
                // exist in Gecko - to satisfy this requirement.
                String key = pref.getKey();
                if (key != null && !key.startsWith(NON_PREF_PREFIX)) {
                    mPreferencesList.add(pref.getKey());
                }
            }
        }
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        switch (item.getItemId()) {
            case android.R.id.home:
                finish();
                return true;
        }

        return super.onOptionsItemSelected(item);
    }

    public static void setCharEncodingState(boolean enabled) {
        sIsCharEncodingEnabled = enabled;
    }

    public static boolean getCharEncodingState() {
        return sIsCharEncodingEnabled;
    }

    /**
     * Return the value of the named preference in the default preferences file.
     *
     * This corresponds to the storage that backs preferences.xml.
     * @param context a <code>Context</code>; the
     *                <code>PreferenceActivity</code> will suffice, but this
     *                method is intended to be called from other contexts
     *                within the application, not just this <code>Activity</code>.
     * @param name    the name of the preference to retrieve.
     * @param def     the default value to return if the preference is not present.
     * @return        the value of the preference, or the default.
     */
    public static boolean getBooleanPref(final Context context, final String name, boolean def) {
        final SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(context);
        return prefs.getBoolean(name, def);
    }

    @Override
    public abstract boolean onPreferenceChange(Preference preference, Object newValue);

    // Initialize preferences by requesting the preference values from Gecko
    private void initValues() {
        JSONArray jsonPrefs = new JSONArray(mPreferencesList);
        PrefsHelper.getPrefs(jsonPrefs, new PrefsHelper.PrefHandlerBase() {
            private Preference getField(String prefName) {
                return (mPreferenceScreen == null ? null : mPreferenceScreen.findPreference(prefName));
            }

            class CheckBoxPrefSetter {
                public void setBooleanPref(Preference preference, boolean value) {
                    if ((preference instanceof CheckBoxPreference) &&
                       ((CheckBoxPreference) preference).isChecked() != value) {
                        ((CheckBoxPreference) preference).setChecked(value);
                    }
                }
            }
            class TwoStatePrefSetter extends CheckBoxPrefSetter {
                @Override
                public void setBooleanPref(Preference preference, boolean value) {
                    if ((preference instanceof TwoStatePreference) &&
                       ((TwoStatePreference) preference).isChecked() != value) {
                        ((TwoStatePreference) preference).setChecked(value);
                    }
                }
            }

            @Override public void prefValue(String prefName, final boolean value) {
                final Preference pref = getField(prefName);
                final CheckBoxPrefSetter prefSetter;
                if (Build.VERSION.SDK_INT < 14) {
                    prefSetter = new CheckBoxPrefSetter();
                } else {
                    prefSetter = new TwoStatePrefSetter();
                }
                ThreadUtils.postToUiThread(new Runnable() {
                    public void run() {
                        prefSetter.setBooleanPref(pref, value);
                    }
                });
            }

            @Override public void prefValue(String prefName, final String value) {
                final Preference pref = getField(prefName);
                if (pref instanceof EditTextPreference) {
                    ThreadUtils.postToUiThread(new Runnable() {
                        @Override
                        public void run() {
                            ((EditTextPreference)pref).setText(value);
                        }
                    });
                } else if (pref instanceof ListPreference) {
                    ThreadUtils.postToUiThread(new Runnable() {
                        @Override
                        public void run() {
                            ((ListPreference)pref).setValue(value);
                            // Set the summary string to the current entry
                            CharSequence selectedEntry = ((ListPreference)pref).getEntry();
                            ((ListPreference)pref).setSummary(selectedEntry);
                        }
                    });
                } else if (pref instanceof FontSizePreference) {
                    final FontSizePreference fontSizePref = (FontSizePreference) pref;
                    fontSizePref.setSavedFontSize(value);
                    final String fontSizeName = fontSizePref.getSavedFontSizeName();
                    ThreadUtils.postToUiThread(new Runnable() {
                        @Override
                        public void run() {
                            fontSizePref.setSummary(fontSizeName); // Ex: "Small".
                        }
                    });
                }
            }

            @Override public void finish() {
                // enable all preferences once we have them from gecko
                ThreadUtils.postToUiThread(new Runnable() {
                    @Override
                    public void run() {
                        mPreferenceScreen.setEnabled(true);
                    }
                });
            }
        });
    }

    private void registerEventListener(String event) {
        GeckoAppShell.getEventDispatcher().registerEventListener(event, this);
    }

    private void unregisterEventListener(String event) {
        GeckoAppShell.getEventDispatcher().unregisterEventListener(event, this);
    }

    @Override
    public boolean isGeckoActivityOpened() {
        return false;
    }
}
