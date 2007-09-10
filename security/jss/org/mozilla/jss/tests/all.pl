#!/usr/bin/perl
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at             
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Netscape Security Services for Java.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 2001
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

use Socket;

                                                                                                  
# dist <dist_dir>
# release <java release dir> <nss release dir> <nspr release dir>
# auto   (test the current build directory)

sub usage {
    print "Usage:\n";
    print "$0 dist <dist_dir>\n";
    print "$0 release <jss release dir> <nss release dir> "
        . "<nspr release dir>\n";
    print "$0 auto\n";
    exit(1);
}

# Force Perl to do unbuffered output
# to avoid having Java and Perl output out of sync.
$| = 1;

# Global variables
my $java           = "";
my $testdir        = "";
my $testrun        = 0;
my $testpass       = 0;
my $nss_lib_dir    = "";
my $dist_dir       = "";
my $pathsep        = ":";
my $scriptext      = "sh";
my $exe_suffix     = "";
my $lib_suffix     = ".so";
my $lib_jss        = "libjss";
my $jss_rel_dir    = "";
my $jss_classpath  = "";
my $serverPort     = 2876;
my $hostname       = localhost;
my $dbPwd          = "m1oZilla";
my $configfile     = "";
my $keystore       = "";
my $certSN_file    = "";
my $certSN         = 0;
my $osname         = `uname -s`;

# checkPort will return a free Port number
# otherwise it will die after trying 10 times. 
sub checkPort {
   my ($p) = @_; 
   my $localhost = inet_aton("localhost");
   my $max = $p + 20; # try to find a port 10 times
   my $port = sockaddr_in($p, $localhost);

   #create a socket 
   socket(SOCKET, PF_INET, SOCK_STREAM, getprotobyname('tcp')) 
   || die "Unable to create socket: $!\n";

   #loop until you find a free port
   while (connect(SOCKET, $port) && $p < $max) {
         print "$p is in use trying to find another port.\n";
         $p = $p + 1;
         $port = sockaddr_in($p, $localhost);
   }
   close SOCKET || die "Unable to close socket: $!\n";
   if ($p == $max) { 
      die "Unable to find a free port..\n";
   }

   return $p;
}


sub setup_vars {
    my $argv = shift;

    my $truncate_lib_path = 1;
    if( $osname =~ /HP/ ) {
        $ld_lib_path = "SHLIB_PATH";
        $scriptext = "sh";
        $lib_suffix = ".sl";
    } elsif( $osname =~ /Darwin/) {
        $ld_lib_path = "DYLD_LIBRARY_PATH";
        $lib_suffix = ".jnilib";
    } elsif( $osname =~ /win/i ) {
        $ld_lib_path = "PATH";
        $truncate_lib_path = 0;
        $pathsep = ";";
        $exe_suffix = ".exe";
        $lib_suffix = ".dll";
        $lib_jss    = "jss";
    } else {
        $ld_lib_path = "LD_LIBRARY_PATH";
        $scriptext = "sh";
    }

    my $jar_dbg_suffix = "_dbg";
    my $dbg_suffix     = "_DBG";
    $ENV{BUILD_OPT} and $dbg_suffix = "";
    $ENV{BUILD_OPT} and $jar_dbg_suffix = "";

    $ENV{CLASSPATH}  = "";
    $ENV{$ld_lib_path} = "" if $truncate_lib_path;


    if( $$argv[0] eq "dist" ) {
        shift @$argv;
        $dist_dir = shift @$argv or usage("did not provide dist_dir");

        $ENV{CLASSPATH} .= "$dist_dir/../xpclass$jar_dbg_suffix.jar";
        ( -f $ENV{CLASSPATH} ) or die "$ENV{CLASSPATH} does not exist";
        $ENV{$ld_lib_path} = $ENV{$ld_lib_path} . $pathsep . "$dist_dir/lib";
        $nss_lib_dir   = "$dist_dir/lib";
        $jss_rel_dir   = "$dist_dir/../classes$dbg_suffix/org";
        $jss_classpath = "$dist_dir/../xpclass$jar_dbg_suffix.jar";

    } elsif( $$argv[0] eq "auto" ) {
        my $dist_dir = `make dist_dir`;
        my $obj_dir = `make obj_dir`;
        chomp($dist_dir);
        chomp($obj_dir);
        chomp( $dist_dir = `(cd $dist_dir ; pwd)`);
        chomp( $obj_dir = `(cd $obj_dir ; pwd)`);

        $nss_lib_dir   = "$obj_dir/lib";
        $jss_rel_dir   = "$dist_dir/classes$dbg_suffix/org";
        $jss_classpath = "$dist_dir/xpclass$jar_dbg_suffix.jar";

        $ENV{CLASSPATH} .= "$dist_dir/xpclass$jar_dbg_suffix.jar";
        ( -f $ENV{CLASSPATH} ) or die "$ENV{CLASSPATH} does not exist";
        #$ENV{$ld_lib_path} = $ENV{$ld_lib_path} . $pathsep . "$obj_dir/lib";
        $ENV{$ld_lib_path} = "$obj_dir/lib";
    } elsif( $$argv[0] eq "release" ) {
        shift @$argv;

        $jss_rel_dir     = shift @$argv or usage();
        my $nss_rel_dir  = shift @$argv or usage();
        my $nspr_rel_dir = shift @$argv or usage();

        $ENV{CLASSPATH} .= "$jss_rel_dir/../xpclass$jar_dbg_suffix.jar";
        $ENV{$ld_lib_path} =
            "$jss_rel_dir/lib$pathsep$nss_rel_dir/lib$pathsep$nspr_rel_dir/lib"
            . $pathsep . $ENV{$ld_lib_path};
        $nss_lib_dir = "$nss_rel_dir/lib";
        $jss_classpath = "$jss_rel_dir/../xpclass$jar_dbg_suffix.jar";
    } else {
        usage();
    }

    if ($ENV{PORT_JSSE_SERVER}) {
       $serverPort = $ENV{PORT_JSSE_SERVER};
    }

    if ($ENV{PORT_JSS_SERVER}) { 
       $serverPort = $ENV{PORT_JSS_SERVER};
    }

    unless( $ENV{JAVA_HOME} ) {
        print "Must set JAVA_HOME environment variable\n";
        exit(1);
    }

    if ($osname =~ /Darwin/) {
        $java = "$ENV{JAVA_HOME}/bin/java";
    } else {
        $java = "$ENV{JAVA_HOME}/jre/bin/java$exe_suffix";
    }

    #
    # Use 64-bit Java on AMD64.
    #

    my $java_64bit = 0;
    if ($osname eq "SunOS") {
        if ($ENV{USE_64}) {
            my $cpu = `/usr/bin/isainfo -n`;
            if ($cpu == "amd64") {
                $java = "$ENV{JAVA_HOME}/jre/bin/amd64/java$exe_suffix";
                $java_64bit = 1;
            }
        }
    }
    (-f $java) or die "'$java' does not exist\n";
    $java = $java . $ENV{NATIVE_FLAG};

    if ($ENV{USE_64} && !$java_64bit) {
        $java = $java . " -d64";
    }

    #MAC OS X have the -Djava.library.path for the JSS JNI library
    if ($osname =~ /Darwin/) {
        $java = $java . " -Djava.library.path=$nss_lib_dir";        
    } 

    $pwfile = "passwords";

    # testdir = /<ws>/mozilla/tests_results/jss/<hostname>.<version>
    # $all_dir = Directory where all.pl is
    my $all_dir = `dirname $0`;
    chomp $all_dir;
    # Find where mozilla directory is
    my $base_mozilla = $all_dir . "/../../../../../..";
    my $abs_base_mozilla = `cd $base_mozilla; pwd`;
    chomp $abs_base_mozilla;
    # $result_dir = Directory where the results are (mozilla/tests_results/jss)
    my $result_dir =  $abs_base_mozilla . "/tests_results";
    if (! -d $result_dir) {
       mkdir( $result_dir, 0755 ) or die;
    }
    my $result_dir =  $abs_base_mozilla . "/tests_results/jss";
    if( ! -d $result_dir ) {
      mkdir( $result_dir, 0755 ) or die;
    }
    # $host = hostname
    my $host = `uname -n`;
    $host =~ s/\..*//g;
    chomp $host;
    # $version = test run number (first = 1). Stored in $result_dir/$host
    my $version_file = $result_dir ."/" . $host;
    if ( -f $version_file) {
      open (VERSION, "< $version_file") || die "couldn't open " . $version_file . " for read";
      $version = <VERSION>;
      close (VERSION);
      chomp $version;
      $version = $version + 1;
    } else {
      $version = 1;
    }
    # write the version in the file
    open (VERSION, "> $version_file")  || die "couldn't open " . $version_file . " for write";
    print VERSION $version . "\n";
    close (VERSION);
    # Finally, set $testdir
    $testdir = $result_dir . "/" . $host . "." . $version;

    #in case multiple tests are being run on the same machine increase  
    #the port numbers with version number * 10
    
    $serverPort = $serverPort + ($version * 10);

    outputEnv();
}

sub updateCertSN() {

    # $certSN = certificate serial number (first = 100). Stored in $testdir/cert-SN
    $certSN_file = $testdir ."/" . "cert-SN";
    if ( -f $certSN_file) {
      open (CERT_SN, "< $certSN_file") || die "couldn't open " . $certSN_file . " for read";
      $certSN = <CERT_SN>;
      close (CERT_SN);
      chomp $certSN;
      $certSN = $certSN + 10;
    } else {
      $certSN = 100;
    }

    # write the version in the file
    open (CERT_SN, "> $certSN_file")  || die "couldn't open " . $certSN_file . " for write";
    print CERT_SN $certSN . "\n";
    close (CERT_SN);

}

sub outputEnv {

   print "*****ENVIRONMENT*****\n";
   print "java=$java\n";
   print "NATIVE_FLAG=$ENV{NATIVE_FLAG}\n";
   print "$ld_lib_path=$ENV{$ld_lib_path}\n";
   print "CLASSPATH=$ENV{CLASSPATH}\n";
   print "BUILD_OPT=$ENV{BUILD_OPT}\n";
   print "USE_64=$ENV{USE_64}\n";
   print "testdir=$testdir\n";
   print "serverPort=$serverPort\n";
   print "LIB_SUFFIX=$lib_suffix\n";
   print "osname=$osname\n";  
   print "which perl=";
   system ("which perl");
   system ("perl -version");
   system ("$java -version");
}
sub createpkcs11_cfg {
   
    $configfile = $testdir . "/" . "nsspkcs11.cfg";
    $keystore = $testdir . "/" . "keystore";
    if ( -f $configfile ) {
        print "configfile all ready exists";
       return;
    } 
 
    my $nsslibdir = $nss_lib_dir;
    my $tdir = $testdir;
    
    #On windows make sure the path starts with c:
    if ($osname =~ /_NT/i) {
       substr($nsslibdir, 0, 2) = 'c:';
       substr($tdir, 0, 2) = 'c:';
    }
    #the test for java 1.5 or 1.6 relies on the JAVA_HOME path to have the version
    #this is the case for all the build machines and tinderboxes.
    if ( $java =~ /1.6/i) {
       # java 6
       # http://java.sun.com/javase/6/docs/technotes/guides/security/p11guide.html
       # note some OS can read the 1.5 configuration but not all can.
       open (CONFIG, "> $configfile")  || die "couldn't open " . $configfile . " for write";
       print CONFIG "name=NSS\n";
       print CONFIG "nssLibraryDirectory=" . "$nsslibdir\n";
       print CONFIG "nssSecmodDirectory=$tdir\n";
       print CONFIG "nssDbMode=readWrite\n";
       print CONFIG "nssModule=keystore\n";
       close (CONFIG);

    } else { # default 

       # java 5
       #http://java.sun.com/j2se/1.5.0/docs/guide/security/p11guide.html
       open (CONFIG, "> $configfile")  || die "couldn't open " . $configfile . " for write";
       print CONFIG "name=NSS\n";
       if ($lib_suffix eq ".jnilib") {
           print CONFIG "library=" . $nsslibdir  . "/libsoftokn3.dylib\n";
       } else {
           print CONFIG "library=" . $nsslibdir  . "/libsoftokn3$lib_suffix\n";
       }
       print CONFIG "nssArgs=\"configdir=\'". $tdir . "\' ";
       print CONFIG "certPrefix=\'\' keyPrefix=\'\' secmod=\'secmod.db\'\"\n";
       print CONFIG "slot=2\n";
       close (CONFIG);

    }
    print "nsspkcs11=$configfile\n";
}

sub run_ssl_test {
    my $testname = shift;
    my $serverCommand = shift;
    my $clientCommand = shift;

    print "\n============= $testname \n";
    print "$serverCommand \n";
    $result = system("$serverCommand");
    if ($result != 0) {
        print "launching server FAILED with return value $result\n";
        return;
    }
    sleep 5;                                    
    print "\nSSL Server is envoked using port $serverPort \n" ;
    print "$clientCommand \n";
    $result = system("$clientCommand");
    $result >>=8;
    print_case_result ($result, $testname);

    $serverPort=$serverPort+1;
    $serverPort = checkPort($serverPort);
}

sub run_test {
    my $testname = shift;
    my $command = shift;

    print "\n============= $testname \n";
    print "$command \n";
    $result = system("$command");
    $result >>=8;
    print_case_result ($result, $testname);
}

sub print_case_result {
    my $result = shift;
    my $testname = shift;

    $testrun++;
    if ($result == 0) {
        $testpass++;
        print "JSSTEST_CASE $testrun ($testname): PASS\n";
    } else {
        print "JSSTEST_CASE $testrun ($testname): FAIL return value $result\n";
    }

}

setup_vars(\@ARGV);

my $signingToken = "Internal Key Storage Token";


print "*********************\n";

#
# Make the test database directory
#
if( ! -d $testdir ) {
    mkdir( $testdir, 0755 ) or die;
}
{
    my @dbfiles = 
        ("$testdir/cert8.db", "$testdir/key3.db", "$testdir/secmod.db", "$testdir/rsa.pfx");
    (grep{ -f } @dbfiles)  and die "There is already an old database in $testdir";
    my $result = system("cp $nss_lib_dir/*nssckbi* $testdir"); $result >>= 8;
    $result and die "Failed to copy builtins library";
}

print "creating pkcs11config file\n";
createpkcs11_cfg;

my $result;
my $command;
my $serverCommand;


$testname = "Setup DBs";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.SetupDBs $testdir $pwfile";
run_test($testname, $command);

updateCertSN();
$testname = "Generate known RSA cert pair";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.GenerateTestCert $testdir $pwfile $certSN localhost SHA-256/RSA CA_RSA Server_RSA Client_RSA";
run_test($testname, $command);

updateCertSN();
$testname = "Generate known ECDSA cert pair";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.GenerateTestCert $testdir $pwfile $certSN localhost SHA-256/EC CA_ECDSA Server_ECDSA Client_ECDSA";
run_test($testname, $command);

updateCertSN();
$testname = "Generate known DSS cert pair";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.GenerateTestCert $testdir $pwfile $certSN localhost SHA-1/DSA CA_DSS Server_DSS Client_DSS";
run_test($testname, $command);

$testname = "Create PKCS11 cert to PKCS12 rsa.pfx";
$command = "$nss_lib_dir/../bin/pk12util$exe_suffix -o $testdir/rsa.pfx -n CA_RSA -d $testdir -K $dbPwd -W $dbPwd";
run_test($testname, $command);

$testname = "Create PKCS11 cert to PKCS12 ecdsa.pfx";
$command = "$nss_lib_dir/../bin/pk12util$exe_suffix -o $testdir/ecdsa.pfx -n CA_ECDSA -d $testdir -K $dbPwd -W $dbPwd";
run_test($testname, $command);

$testname = "Create PKCS11 cert to PKCS12 dss.pfx";
$command = "$nss_lib_dir/../bin/pk12util$exe_suffix -o $testdir/dss.pfx -n CA_DSS -d $testdir -K $dbPwd -W $dbPwd";
run_test($testname, $command);

#$testname = "Convert nss db  to Java keystore";
#$command = "$java -cp $jss_classpath org.mozilla.jss.tests.NSS2JKS $keystore $dbPwd $configfile $dbPwd";
#run_test($testname, $command);


$testname = "List CA certs";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.ListCACerts $testdir";
run_test($testname, $command);

updateCertSN();
$serverPort = checkPort($serverPort);
$testname = "SSLClientAuth bypass off";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.SSLClientAuth $testdir $pwfile $serverPort bypassoff $certSN";
run_test($testname, $command);

updateCertSN();
$serverPort = checkPort($serverPort);
$testname = "SSLClientAuth bypass on";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.SSLClientAuth $testdir $pwfile $serverPort bypass $certSN";
run_test($testname, $command);

$testname = "Key Generation";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.TestKeyGen $testdir $pwfile";
run_test($testname, $command);

$testname = "Key Factory";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.KeyFactoryTest $testdir $pwfile";
run_test($testname, $command);

$testname = "Digest";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.DigestTest $testdir $pwfile";
run_test($testname, $command);

$testname = "HMAC ";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.HMACTest $testdir $pwfile";
run_test($testname, $command);

$testname = "Mozilla-JSS JCA Signature ";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JCASigTest $testdir $pwfile";
run_test($testname, $command);

$testname = "Secret Decoder Ring";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.TestSDR $testdir $pwfile";
run_test($testname, $command);

$testname = "List cert by certnick";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.ListCerts $testdir Server_RSA";
run_test($testname, $command);

$testname = "Verify cert by certnick";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.VerifyCert $testdir $pwfile Server_RSA";
run_test($testname, $command);

$testname = "Secret Key Generation";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.SymKeyGen $testdir";
run_test($testname, $command);

$testname = "Mozilla-JSS Secret Key Generation";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JCASymKeyGen $testdir";
run_test($testname, $command);


#
# SSLServer and SSLClient Ciphersuite tests
#
# Servers are kicked off by the shell script and are told to shutdown by the client test
#

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSS Server and JSS client both with Bypass Off";
$serverCommand = "./startJssSelfServ.$scriptext $jss_classpath $testdir $hostname $serverPort bypassoff $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypassOff verboseoff JSS";
run_ssl_test($testname, $serverCommand, $command);

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSS Server and JSS client both with Bypass On";
$serverCommand = "./startJssSelfServ.$scriptext $jss_classpath $testdir $hostname $serverPort bypass $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypass verboseoff JSS";
run_ssl_test($testname, $serverCommand, $command);

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSS Server with Bypass Off and JSSE client";
$serverCommand = "./startJssSelfServ.$scriptext $jss_classpath $testdir $hostname $serverPort bypassOff $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSSE_SSLClient $testdir $serverPort $hostname JSS";
run_ssl_test($testname, $serverCommand, $command);

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSS Server with Bypass On and JSSE client";
$serverCommand = "./startJssSelfServ.$scriptext $jss_classpath $testdir $hostname $serverPort bypass $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSSE_SSLClient $testdir $serverPort $hostname JSS";
run_ssl_test($testname, $serverCommand, $command);

if ($osname =~ /HP/ || ( ($osname =~ /Linux/)  && $java =~ /1.5/i && ($ENV{USE_64}) )) {
    print "don't run the JSSE Server tests on HP or Linux  64 bit with java5.\n";
    print "Java 5 on HP does not have SunPKCS11 class\n"; 
} else {

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSSE Server using default provider and JSS client with Bypass Off";
$serverCommand = "./startJsseServ.$scriptext $jss_classpath $serverPort false $testdir rsa.pfx default $configfile $pwfile $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypassOff verboseoff JSSE";
run_ssl_test($testname, $serverCommand, $command);

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSSE Server using default provider and JSS client with Bypass ON";
$serverCommand = "./startJsseServ.$scriptext $jss_classpath $serverPort false $testdir rsa.pfx default $configfile $pwfile $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypass verboseoff JSSE";
run_ssl_test($testname, $serverCommand, $command);

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSSE Server using Sunpkcs11-NSS provider and JSS client with Bypass Off";
$serverCommand = "./startJsseServ.$scriptext $jss_classpath $serverPort false $testdir rsa.pfx Sunpkcs11 $configfile $pwfile $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypassOff verboseoff JSSE";
run_ssl_test($testname, $serverCommand, $command);

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSSE Server using Sunpkcs11-NSS provider and JSS client with Bypass ON";
$serverCommand = "./startJsseServ.$scriptext $jss_classpath $serverPort false $testdir rsa.pfx Sunpkcs11 $configfile $pwfile $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypass verboseoff JSSE";
run_ssl_test($testname, $serverCommand, $command);

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSSE Server using Mozilla-JSS provider and JSS client with Bypass Off";
$serverCommand = "./startJsseServ.$scriptext $jss_classpath $serverPort false $testdir rsa.pfx Mozilla-JSS $configfile $pwfile $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypass verboseoff Mozilla-JSS";
run_ssl_test($testname, $serverCommand, $command);

$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSSE Server using Mozilla-JSS provider and JSS client with Bypass ON";
$serverCommand = "./startJsseServ.$scriptext $jss_classpath $serverPort false $testdir rsa.pfx Mozilla-JSS $configfile $pwfile $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypass verboseoff Mozilla-JSS";
run_ssl_test($testname, $serverCommand, $command);

}

#
# FIPSMODE tests
#

$testname = "Enable FipsMODE";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.FipsTest $testdir enable";
run_test($testname, $command);

$testname = "Enable FipsMODE";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.FipsTest $testdir chkfips";
run_test($testname, $command);

updateCertSN();
$testname = "SSLClientAuth FIPSMODE";
$serverPort = checkPort(++$serverPort);
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.SSLClientAuth $testdir $pwfile $serverPort bypassoff $certSN";
run_test($testname, $command);


$serverPort = checkPort($serverPort);
$testname = "SSL Ciphersuite JSS Server and JSS client both with Bypass Off";
$serverCommand = "./startJssSelfServ.$scriptext $jss_classpath $testdir $hostname $serverPort bypassoff $java";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSS_SelfServClient 2 -1 $testdir $pwfile $hostname $serverPort bypassOff verboseoff JSS";
run_ssl_test($testname, $serverCommand, $command);

$testname = "Disable FipsMODE";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.FipsTest $testdir disable";
run_test($testname, $command);

#
# Test for JSS jar and library revision
#
$testname = "Check JSS jar version";
$command = "$java -cp $jss_classpath org.mozilla.jss.tests.JSSPackageTest $testdir";
run_test($testname, $command);

my $LIB = "$lib_jss"."4"."$lib_suffix";
my $strings_exist = `which strings`;
chomp($strings_exist);
if ($strings_exist ne "") {
    (-f "$nss_lib_dir/$LIB") or die "$nss_lib_dir/$LIB does not exist\n";
    my $jsslibver = `strings $nss_lib_dir/$LIB | grep Header`;
    chomp($jsslibver);
    if ($jsslibver ne "") {
        print "$LIB = $jsslibver\n";
    } else {
        print "Could not fetch Header information from $nss_lib_dir/$LIB\n";
    }
} else {
    print "Could not fetch Header information from $nss_lib_dir/$LIB\n";
    $result=1;
}

print "\n================= Test Results\n";
print "JSSTEST_SUITE: $testpass / $testrun\n";
my $rate = $testpass / $testrun * 100;
printf "JSSTEST_RATE: %.0f %\n",$rate;

if ($testpass ne $testrun) {
    printf "Test Status: FAILURE\n";
    system("false");
    printf "to test failed tests set the classpath and run the command(s)\n";
    outputEnv();
} else {
    printf "Test Status: SUCCESS\n";
    system("true");
}
