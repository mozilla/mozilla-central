#!/usr/bin/perl -w

require 5.003;

# This script has split some functions off into a util
# script so they can be re-used by other scripts.
require "build-nss-util.pl";

use strict;

# "use strict" complains if we do not define these.
# They are not initialized here. The default values are after "__END__".
$TreeSpecific::nss_build_target = $TreeSpecific::jss_build_target = @TreeSpecific::tip_cvsfiles = @TreeSpecific::jes5_cvsfiles = $TreeSpecific::nss_extraflags = $::Version = undef;

$::Version = '$Revision: 1.2 $ ';

{
    TinderUtils::Setup();
    tree_specific_overides();
    TinderNssUtils::Build();
}

sub tree_specific_overides {
    $TreeSpecific::nss_build_target = 'clean nss_build_all';
    $TreeSpecific::jss_build_target = 'clean all';

    @TreeSpecific::tip_cvsfiles = (
        'mozilla/nsprpub', 
        'mozilla/dbm', 
        'mozilla/security/dbm', 
        'mozilla/security/coreconf', 
        'mozilla/security/nss', 
        'mozilla/security/jss', 
        '-r NSS_3_11_1_RTM mozilla/security/nss/lib/freebl/ecl/ecl-curve.h'
    );
    @TreeSpecific::jes5_cvsfiles = (
        '-r NSPR_4_6_BRANCH mozilla/nsprpub', 
        '-r NSS_3_11_BRANCH mozilla/dbm', 
        '-r NSS_3_11_BRANCH mozilla/security/dbm', 
        '-r NSS_3_11_BRANCH mozilla/security/coreconf', 
        '-r NSS_3_11_BRANCH mozilla/security/nss', 
        '-r JSS_4_2_5_RTM mozilla/security/jss', 
        '-r NSS_3_11_1_RTM mozilla/security/nss/lib/freebl/ecl/ecl-curve.h'
    );

    $TreeSpecific::nss_extraflags = 'NSS_ENABLE_ECC=1; export NSS_ENABLE_ECC; NSS_ECC_MORE_THAN_SUITE_B=1; export NSS_ECC_MORE_THAN_SUITE_B; IOPR_HOSTADDR_LIST=dochinups.red.iplanet.com; export IOPR_HOSTADDR_LIST; NSPR_LOG_MODULES="pkix:1"; export NSPR_LOG_MODULES; ';
}
