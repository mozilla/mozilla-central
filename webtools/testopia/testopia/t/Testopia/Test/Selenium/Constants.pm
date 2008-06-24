=head1 NAME

Selenium::Testopia::Constants

=head1 DESCRIPTION

Provides constants for the testopia PerlUnit test cases

=head1 DEPENDENCY

Exporter

=cut 

package Testopia::Test::Selenium::Constants;

use strict;

use base qw(Exporter);

@Testopia::Test::Selenium::Constants::EXPORT = qw(
   PERMANENT_USER
   TESTER_USER_LOGIN
   TESTER_USER_PASSWORD
   UNPRIVILAGED_USER_LOGIN
   UNPRIVILAGED_USER_PASSWORD
   ADMIN_USER_LOGIN
   ADMIN_USER_PASSWORD
   TWEAKPARAMS_USER_LOGIN
   TWEAKPARAMS_USER_PASSWORD
   CANCONFIRM_USER_LOGIN
   CANCONFIRM_USER_PASSWORD
   QA_SELENIUM_USER_LOGIN
   QA_SELENIUM_USER_PASSWORD
   COMMON_EMAIL
   ATTACH_PATH
   TEST_ATTACH_1
   TEST_BUG_1
   TEST_BUG_2
   TEST_CASE_1
   TEST_CASE_2
   TEST_CASE_1_CAT
   TEST_PLAN_1
   TEST_PLAN_2
   TEST_PLAN_TYPE
   TEST_RUN_1
   TEST_RUN_2
   TEST_RUN_ENV
   TEST_RUN_BUILD
   TEST_CASERUN_1
   TEST_CASERUN_2
   TEST_ENV_1
   TEST_ENV_2
   TEST_ENV_CAT                   
   TEST_ENV_ELM
   TEST_ENV_PROP
   TEST_ENV_PROP_ELM
   TEST_PRODUCT
   TEST_PRODUCT_VERSION
   TEST_BUILD_1
   TEST_BUILD_2
   TEST_CAT
   TEST_TAG_1
   TEST_COMPONENT
   TIMEOUT
   REPORT_TIMEOUT
   SEL_BASE_URL
   SEL_BROWSER
   SEL_HOST
   SEL_PORT
   TEST_ENVIRONMENT_NAME_1
   TEST_CASE_REQUIREMENT_1
   TEST_CASE_STATUS_1
   TEST_CASE_PRIORITY_1
   TEST_CASE_ISAUTOMATED_1
   TEST_TESTER_1
   PARTNER_USER_LOGIN
   PARTNER_USER_PASSWORD
   PARTNER_USER_ID
   TEST_PRODUCT_VERSION_2
   TEST_PLAN_VERSION_1
   TEST_BUILD_3
   TEST_ENV_3
   TEST_RUN_3
   QA_SELENIUM_USER_ID
   TESTER_USER_ID
   TEST_PRODUCT_2
   TEST_PRODUCT_3
   TEST_PRODUCT_3_MILESTONE
   SEL_BROWSER_URL
   SEL_BROWSER
   SEL_HOST
   SEL_PORT
   );

#Address information

use constant SEL_BROWSER      => "*chrome";
use constant SEL_BROWSER_URL  => "http://localhost/bugzilla/";
use constant SEL_HOST         => "localhost";
use constant SEL_PORT         => 4444;

# Users
use constant PERMANENT_USER             => 'admin@testopia.com';
use constant TESTER_USER_LOGIN          => 'admin@testopia.com';
use constant TESTER_USER_PASSWORD       => 'admin';
use constant TESTER_USER_ID				=> 1;
use constant UNPRIVILAGED_USER_LOGIN    => '';
use constant UNPRIVILAGED_USER_PASSWORD => '';
use constant ADMIN_USER_LOGIN           => 'admin@testopia.com';
use constant ADMIN_USER_PASSWORD        => 'admin';
use constant TWEAKPARAMS_USER_LOGIN     => '';
use constant TWEAKPARAMS_USER_PASSWORD  => '';
use constant CANCONFIRM_USER_LOGIN      => '';
use constant CANCONFIRM_USER_PASSWORD   => '';
use constant QA_SELENIUM_USER_LOGIN     => 'public_qa@testopia.com';
use constant QA_SELENIUM_USER_PASSWORD  => '';
use constant QA_SELENIUM_USER_ID		=> 5;
use constant COMMON_EMAIL               => '@testopia.com';
use constant PARTNER_USER_LOGIN			=> 'partner@testopia.com';
use constant PARTNER_USER_PASSWORD		=> 'unknown';
use constant PARTNER_USER_ID			=> 2;

# ID's for attachments, bugs, cases, plans, runs, caseruns, environments, 
# builds, and plan types
use constant ATTACH_PATH                => '/home/ghendricks/intern-timecard.sxc';
use constant TEST_ATTACH_1              => 2;
use constant TEST_BUG_1                 => 281772;
use constant TEST_BUG_2                 => 281773;
#use constant TEST_CASE_1                => 380099;
use constant TEST_CASE_1                => 4;
#use constant TEST_CASE_2                => 380100;
use constant TEST_CASE_2                => 6;
#use constant TEST_CASE_1_CAT            => 141;
use constant TEST_CASE_1_CAT            => 1;
use constant TEST_CASE_REQUIREMENT_1	=> 'SELENIUM REQUIREMENT';
#use constant TEST_PLAN_1                => 74;
use constant TEST_PLAN_1				=> 1;
#use constant TEST_PLAN_2                => 466;
use constant TEST_PLAN_2                => 3;
use constant TEST_PLAN_TYPE             => 5;
use constant TEST_PLAN_VERSION_1		=> 2;
#use constant TEST_RUN_1                 => 1226;
use constant TEST_RUN_1                 => 1;
use constant TEST_RUN_2                 => 1243;
use constant TEST_RUN_3                 => 3;
use constant TEST_RUN_ENV               => 2;
#use constant TEST_RUN_BUILD             => 12;
use constant TEST_RUN_BUILD             => 1;
#use constant TEST_CASERUN_1             => 14;
use constant TEST_CASERUN_1             => 5;
use constant TEST_CASERUN_2             => 16;
use constant TEST_ENV_1                 => 248;
use constant TEST_ENV_2                 => 252;
use constant TEST_ENV_3                 => 2;
use constant TEST_PRODUCT               => 2;       # This is the 'Bugzilla' Product on stage/production
use constant TEST_PRODUCT_2             => 1;
use constant TEST_PRODUCT_3             => 3;
#use constant TEST_PRODUCT_VERSION       => '3.0';  
use constant TEST_PRODUCT_VERSION       => 'PRIVATE v2';
use constant TEST_PRODUCT_VERSION_2		=> 'PUBLIC v1';
use constant TEST_BUILD_1               => 34;
use constant TEST_BUILD_2		        => 718;
use constant TEST_BUILD_3		        => 3;
#use constant TEST_CAT                   => 141;
use constant TEST_CAT                   => 1;
use constant TEST_TAG_1                 => 8741;
use constant TEST_COMPONENT             => 2;
use constant TEST_CASE_STATUS_1			=> 2;
use constant TEST_CASE_PRIORITY_1		=> 1;
use constant TEST_CASE_ISAUTOMATED_1	=> 1;
use constant TEST_TESTER_1				=> 3;
use constant TEST_PRODUCT_3_MILESTONE	=> 'PARTNER M2';

# Tells selenium how long to wait for a page to load before timing out
use constant TIMEOUT                    => 120000;   # Wait 2 minutes 
use constant REPORT_TIMEOUT             => 300000;  # Wait 5 minutes for reports

# Used in tr_admin_enviroment.cgi for the category, element, and property ids
use constant TEST_ENV_CAT               => 2;
use constant TEST_ENV_ELM               => 2;
use constant TEST_ENV_PROP              => 1;
use constant TEST_ENV_PROP_ELM          => 12;

# Used in tr_list_environments
use constant TEST_ENVIRONMENT_NAME_1 => 'PRIVATE ACTIVE ENVIRONMENT';

1;

=head1 AUTHOR

Jeff Dayley <JeDayley@novell.com> - 6 June 2007

=cut

__END__



