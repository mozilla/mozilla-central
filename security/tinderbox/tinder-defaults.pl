######## NEEDS TO SET IN CONFIG FILE ########

#- PLEASE FILL THIS IN WITH YOUR PROPER EMAIL ADDRESS
#$BuildAdministrator = "svbld@localhost";

#- Set these proper values for your tinderbox server
#$Tinderbox_server = 'tinderbox-daemon@tinderbox.mozilla.org';

# These needs to be changed based on Platform and OS
$DbgObjDir64 = '';
$OptObjDir64 = '';
$DbgObjDir32 = '';
$OptObjDir32 = '';
$JavaHome64 = '';
$JavaHome32 = '';

# 32bit/64bit build (32/64/both)
#$BuildBits = 32;

# Branch (securitytip or securityjes5)
#$Branch = 'securitytip';

######## CAN BE SET CHANGED IN CONFIG FILE #########

# Variable TESTS for NSS test suite
$NSSTests='';

#- Default values of command-line opts
#-
$ReportStatus      = 1;      # Send results to server, or not
$ReportFinalStatus = 1;      # Finer control over $ReportStatus.
$UseTimeStamp      = 0;      # Use the CVS 'pull-by-timestamp' option, or not
$BuildOnce         = 0;      # Build once, don't send results to server
$TestOnly          = 0;      # Only run tests, don't pull/build
$SkipCheckout      = 0;      # Use to debug build process without checking out new source.
$SkipBuild         = 0;      # Skip build process.
$SkipTesting       = 0;      # Skip testing.
$SkipNSS           = 0;      # Skip testing NSS.
$SkipJSS           = 0;      # Skip testing JSS.
$NoRotate          = 0;      # Not rotate old data directories

#- Timeouts, values are in seconds.
#
$CVSCheckoutTimeout	= 3600;

# Number of builds to store data
$rsync_max = 5;

#- Set these to what makes sense for your system
$Make           = 'gmake';       # Must be GNU make
$CVS            = 'cvs -d :pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot';

# win32 usually doesn't have /bin/mail
$mail           = '/bin/mail';
$blat           = 'blat';
$use_blat       = 0;

# Set moz_cvsroot to something like:
# :pserver:$ENV{USER}%netscape.com\@cvs.mozilla.org:/cvsroot
#
# Note that win32 may not need \@, depends on ' or ".
# :pserver:$ENV{USER}%netscape.com@cvs.mozilla.org:/cvsroot

#$moz_cvsroot   = $ENV{CVSROOT};
$moz_cvsroot   = ':pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot';

#- Set if you want to build in a separate object tree
$ObjDir = '';

# If the build is a combined xulrunner+something, set the "something"
# subdirectory: example "firefox/" - NOTE: need trailing slash!
$SubObjDir = '';

# Extra build name, if needed.
$BuildNameExtra = '';

# User comment, eg. ip address for dhcp builds.
# ex: $UserComment = "ip = 208.12.36.108";
$UserComment = 0;

######## NO NEED TO BE CHANGED ######## 

#- Minimum wait period from start of build to start of next build in minutes.
$BuildSleep = 60;

#- Until you get the script working. When it works,
#- change to the tree you're actually building
$BuildTree  = 'NSS';

$BuildName = '';
$Topsrcdir = 'mozilla';

# LogCompression specifies the type of compression used on the log file.
# Valid options are 'gzip', and 'bzip2'. Please make sure the binaries
# for 'gzip' or 'bzip2' are in the user's path before setting this
# option.
$LogCompression = '';

# LogEncoding specifies the encoding format used for the logs. Valid
# options are 'base64', and 'uuencode'. If $LogCompression is set above,
# this needs to be set to 'base64' or 'uuencode' to ensure that the
# binary data is transferred properly.
$LogEncoding = '';

######## NEW ########

$BuildTreeNSS = 'NSS';
$BuildTreeNSSStable = 'NSS-Stable-Branch';
