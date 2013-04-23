/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import org.mozilla.gecko.GeckoPreferencesActivity;
import org.mozilla.gecko.DataReportingNotification;
import org.mozilla.gecko.util.ThreadUtils;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.preference.Preference;
import android.preference.PreferenceManager;
import android.text.TextUtils;
import android.util.Log;

import java.util.Date;

public class GeckoDataPreferences
    extends GeckoPreferencesActivity
{
    public static final String PREFS_BRANCH = "datareporting";

    private static final String LOGTAG = "GeckoDataPreferences";

    private static final String PREFS_HEALTHREPORT_UPLOAD_ENABLED = NON_PREF_PREFIX + "healthreport.uploadEnabled";

    @Override
    public void onStart() {
        super.onStart();
        // Record response time if launched from notification.
        Intent sourceIntent = getIntent();
        if (sourceIntent.hasExtra(DataReportingNotification.INTENT_EXTRAS_NOTIFICATION_INTENT)) {
            ThreadUtils.postToBackgroundThread(new Runnable() {
                @Override
                public void run() {
                    // Preferences launched from data policy notification; record response time to SharedPreferences.
                    SharedPreferences.Editor editor = getSharedPreferences(PREFS_BRANCH, 0).edit();
                    Date date = new Date();
                    editor.putString(DataReportingNotification.PREFS_POLICY_RESPONSE_TIME, String.valueOf(date.getTime()));
                    editor.commit();
                }
           });
        }
    }

    @Override
    protected int getPreferencesResource() {
        return R.xml.datareporting_preferences;
    }

    @Override
    protected void setupPrefsBranch() {
        this.getPreferenceManager().setSharedPreferencesName(PREFS_BRANCH);
    }

    @Override
    public boolean onPreferenceChange(Preference preference, Object newValue) {
        String prefName = preference.getKey();
        if (!TextUtils.isEmpty(prefName)) {
            // Healthreport pref only lives in Android. Do not persist to Gecko.
            if (!PREFS_HEALTHREPORT_UPLOAD_ENABLED.equals(prefName)) {
                PrefsHelper.setPref(prefName, newValue);
            }
        }
        return true;
    }
}
