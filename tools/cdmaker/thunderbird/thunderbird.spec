
$ARCHIVE_DIR = "../archive";
$APP_AND_VOLUME_ID = "Thunderbird 2";
$ISO_FILE = "thunderbird-2.0.0.0.iso";

$RELEASES = [
  {
    archive_path => "thunderbird/releases",
    version => "2.0.0.0",
    locales => ["en-US"],
    builds => [
      { from => "%version%/win32/%locale%/Thunderbird Setup %version%.exe",
          to => "Windows/ThunderbirdSetup%version%.exe" },
      { from => "%version%/mac/%locale%/Thunderbird %version%.dmg",
          to => "Mac OS X/Thunderbird %version%.dmg" },
      { from => "%version%/linux-i686/%locale%/thunderbird-%version%.tar.gz",
          to => "Linux/thunderbird-%version%.tar.gz" },
    ],
    others => [
      { from => "MPL-1.1.txt",
          to => "MPL-1.1.txt" },
      { from => "README.txt",
          to => "README.txt" },
      { from => "autorun/autorun.inf",
          to => "autorun.inf" },
      { from => "autorun/autorun.ico",
          to => "icon/Thunderbird.ico" },
    ],
  },
];

1;
