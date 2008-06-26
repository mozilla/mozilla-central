
$ARCHIVE_DIR = "../archive";
$APP_AND_VOLUME_ID = "Firefox 3.0";
$ISO_FILE = "firefox-3.0.iso";

$RELEASES = [
  {
    archive_path => "firefox/releases",
    version => "3.0",
    locales => ["en-US"],
    builds => [
      { from => "%version%/win32/%locale%/Firefox Setup %version%.exe",
          to => "Windows/FirefoxSetup%version%.exe" },
      { from => "%version%/mac/%locale%/Firefox %version%.dmg",
          to => "Mac OS X/Firefox %version%.dmg" },
      { from => "%version%/linux-i686/%locale%/firefox-%version%.tar.bz2",
          to => "Linux/firefox-%version%.tar.bz2" },
    ],
    others => [
      { from => "MPL-1.1.txt",
          to => "MPL-1.1.txt" },
      { from => "README.txt",
          to => "README.txt" },
      { from => "autorun/autorun.inf",
          to => "autorun.inf" },
      { from => "autorun/autorun.ico",
          to => "icon/Firefox.ico" },
    ],
  },
];

1;
