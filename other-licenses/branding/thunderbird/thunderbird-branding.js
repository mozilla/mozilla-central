// Default start page
pref("mailnews.start_page.url","http://live.mozillamessaging.com/%APP%/start?locale=%LOCALE%&version=%VERSION%&os=%OS%&buildid=%APPBUILDID%");

// first launch welcome page
pref("mailnews.start_page.welcome_url","http://live.mozillamessaging.com/%APP%/firstrun?locale=%LOCALE%&version=%VERSION%&os=%OS%&buildid=%APPBUILDID%");

// start page override to load after an update
pref("mailnews.start_page.override_url","http://live.mozillamessaging.com/%APP%/whatsnew?locale=%LOCALE%&version=%VERSION%&os=%OS%&buildid=%APPBUILDID%");

// Interval: Time between checks for a new version (in seconds)
// nightly=8 hours, official=24 hours
pref("app.update.interval", 86400);

// The time interval between the downloading of mar file chunks in the
// background (in seconds)
pref("app.update.download.backgroundInterval", 600);
