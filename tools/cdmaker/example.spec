
$APP_AND_VOLUME_ID = "Firefox 1.5";

$ISO_FILE = "firefox-1.5-en.iso";

$RELEASES = [
  {
    # The path to this app's release builds in the build archive.
    archive_path => "firefox/releases",

    # The version we're shipping.
    version => "1.5",

    # The locale(s) we're shipping.
    # Note: in addition to specifying locales here, you also have to add them
    # to the list of locales in the app's README.txt file.
    locales => ["en-US", "en-GB"],

    # Path templates defining how the builds being distributed should be synced
    # from the archive directory to the master directory.  The script replaces
    # %version% and %locale% by their actual values before copying the files.
    # The "from" paths are relative to the archive path within the archive dir,
    # while "to" paths are relative to the master directory itself.
    #
    # Builds can have a "locales" list which is a subset of the application's
    # locales list.  If a build-specific locales list is present, the script
    # only puts those locales onto the CD for that build.
    builds => [
      {    from => "%version%/win32/%locale%/Firefox Setup %version%.exe",
             to => "Firefox %version%/windows/%locale%/Firefox Setup %version%.exe" },
      {    from => "%version%/mac/%locale%/Firefox %version%.dmg",
             to => "Firefox %version%/MacOSX/%locale%/Firefox %version%.dmg" },
      {    from => "%version%/linux-i686/%locale%/firefox-%version%.tar.gz",
             to => "Firefox %version%/linux/%locale%/firefox-%version%.tar.gz" },
        locales => ["en-US"]
    ],

    # Non-build files to sync from the other directory to the master directory.
    # %version% and %locale% get replaced as with build files, and paths
    # are relative in the same way.
    others => [
      { from => "MPL-1.1.txt",
          to => "MPL-1.1.txt" },
      { from => "README-CD.txt",
          to => "README.txt" },
      { from => "README-Firefox.txt",
          to => "Firefox %version%/README.txt" },
      { from => "autorun/AutoRun.exe",
          to => "AutoRun.exe" },
      { from => "autorun/AutoRun.rdt",
          to => "AutoRun.rdt" },
      { from => "autorun/autorun.inf",
          to => "autorun.inf" },
      { from => "autorun/zAutorunfiles/AutoRun.ico",
          to => "zAutorunfiles/AutoRun.ico" },
      { from => "autorun/zAutorunfiles/background.jpg",
          to => "zAutorunfiles/background.jpg" },
    ],

    # If we need to expand Linux installer tarballs, linux_dest is their path
    # relative to the master directory, and linux_name is the name of this app
    # in tarball filenames.  %version% gets replaced by its actual value
    # when the tarballs are expanded.
    linux_dest => "Firefox %version%/linux",
    linux_name => "firefox",
  },
  # Put additional release specifications here if you're building a CD
  # containing multiple apps (f.e. Firefox and Thunderbird).
];

# This Perlism makes the "do [spec file]" call in make-cd not fail.
1;
