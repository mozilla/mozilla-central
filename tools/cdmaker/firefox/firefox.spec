
$ARCHIVE_DIR = "../archive";
$APP_AND_VOLUME_ID = "Firefox 2.0.0.1";
$ISO_FILE = "firefox-2.0.0.1.iso";

$RELEASES = [
  {
    archive_path => "firefox/releases",
    version => "2.0.0.1",
    locales => ["en-US"],
    builds => [
      { from => "%version%/win32/%locale%/Firefox Setup %version%.exe",
          to => "Windows/FirefoxSetup%version%.exe" },
      { from => "%version%/mac/%locale%/Firefox %version%.dmg",
          to => "Mac OS X/Firefox %version%.dmg" },
      { from => "%version%/linux-i686/%locale%/firefox-%version%.tar.gz",
          to => "Linux/firefox-%version%.tar.gz" },
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
