#!/usr/bin/perl
# -d:ptkdb
# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Mozilla Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is the Bugzilla Bug Tracking System.
#
# Contributor(s): Dallas Harken <dharken@novell.com>

=head1 NAME

client.pl - Show how to talk to Bugzilla Testopia via XMLRPC

=head1 SYNOPSIS

C<client.pl [options]>

C<client_demo.pl --help> for detailed help

=head1 OPTIONS

=over

=item --help, -h, -?

Print a short help message and exit.

=item --uri

URI to Bugzilla's C<tr_xmlrpc.cgi> script, along the lines of
C<http://your.bugzilla.installation/path/to/bugzilla/tr_xmlrpc.cgi>.

=item --login

Bugzilla login name. Specify this together with B<--password> in order to log in.

=item --password

Bugzilla password. Specify this together with B<--login> in order to log in.

=cut

use strict;
use Getopt::Long;
use Pod::Usage;
use XMLRPC::Lite;
use File::Basename qw(dirname);
use HTTP::Cookies;
use Carp;
use Data::Dumper;

my $help;
my $Bugzilla_uri;
my $Bugzilla_login;
my $Bugzilla_password;
my $soapresult;

sub show_results {
	my $plan;
	my $key;

	my ($header, $soapresult) = @_;

	print $header . "\n";
	
	if (!defined $soapresult)
	{
	  print "No Soap Result - Probably no method call made.\n";
	  exit(2);
	}

	die_on_fault($soapresult);

    print Dumper($soapresult->result);

}

sub die_on_fault {
    my $soapresult = shift;

    if ($soapresult->fault){
        confess 'Fault: ' . $soapresult->faultcode . ' ' . $soapresult->faultstring;
    }
}

sub syntaxhelp {
    my $msg = shift;

    print "Error: $msg\n";
    pod2usage({'-verbose' => 0, '-exitval' => 1});
}

#####################################################################################
#
# Code Execution Starts Here
#
#####################################################################################

GetOptions('help|h|?'       => \$help,
           'uri=s'          => \$Bugzilla_uri,
           'login=s'        => \$Bugzilla_login,
           'password=s'     => \$Bugzilla_password,
          ) or pod2usage({'-verbose' => 0, '-exitval' => 1});

pod2usage({'-verbose' => 1, '-exitval' => 0}) if $help;

syntaxhelp('URI unspecified') unless $Bugzilla_uri;

my $cookie_jar =
    new HTTP::Cookies('file' => File::Spec->catdir(dirname($0), 'cookies.txt'),
                      'autosave' => 1);

my $proxy = XMLRPC::Lite->proxy($Bugzilla_uri,
                                'cookie_jar' => $cookie_jar);

if (defined($Bugzilla_login)) {
    if ($Bugzilla_login ne '') {
        # Log in.
        $soapresult = $proxy->call('User.login',
                                   { login => $Bugzilla_login, 
                                     password => $Bugzilla_password } );
        print "Login successful.\n";
    }
    else {
        # Log out.
        $soapresult = $proxy->call('User.logout');
        print "Logout successful.\n";
    }
}


#####################
### Build Methods ###
#####################

#$soapresult = $proxy->call('Build.check_build', 'Linux', 2);
#$soapresult = $proxy->call('Build.check_build', 'Linux', 'Bugzilla');
#$soapresult = $proxy->call('Build.create', {name=>'Build '. time(), product_id=>2, isactive=>0, description=> 'API Test Build - IGNORE'});
#$soapresult = $proxy->call('Build.get', 1140);
#$soapresult = $proxy->call('Build.update', 1140, { description=>'This is a description', milestone=>'3.0', isactive=>0});

###########################
### Environment Methods ###
###########################

#$soapresult = $proxy->call('Environment.check_environment', 'Linux', 2);
#$soapresult = $proxy->call('Environment.check_environment', 'Linux', 'Bugzilla');
#$soapresult = $proxy->call('Environment.create', {product_id=>2, name=>'Environment '.time() , isactive=>1});
#$soapresult = $proxy->call('Environment.get', 1018);
#$soapresult = $proxy->call('Environment.list', {environment_id=>330});
#$soapresult = $proxy->call('Environment.list', {name=>'Linux'});
#$soapresult = $proxy->call('Environment.update', 1018, {name=>'Second Environment'});
#$soapresult = $proxy->call('Environment.get_runs', 1);
#$soapresult = $proxy->call('Environment.get_caseruns', 1);

#######################
### Product Methods ###
#######################

#$soapresult = $proxy->call('Product.get', 2);
#$soapresult = $proxy->call('Product.check_product', 'Bugzilla');
#$soapresult = $proxy->call('Product.check_category', 'CGI', 'Bugzilla');
#$soapresult = $proxy->call('Product.get_builds', 2);
#$soapresult = $proxy->call('Product.get_cases', 2);
#$soapresult = $proxy->call('Product.get_categories', 2);
#$soapresult = $proxy->call('Product.get_components', 2);
#$soapresult = $proxy->call('Product.get_environments', 2);
#$soapresult = $proxy->call('Product.get_milestones', 2);
#$soapresult = $proxy->call('Product.get_plans', 2);
#$soapresult = $proxy->call('Product.get_runs', 2);
#$soapresult = $proxy->call('Product.get_tags', 2);
#$soapresult = $proxy->call('Product.get_versions', 2);

########################
### TestCase Methods ###
########################

#$soapresult = $proxy->call('TestCase.add_component', [278,304],[2,3,4]);
#$soapresult = $proxy->call('TestCase.add_tag', [278,304], ['Fred','Fish']);
#$soapresult = $proxy->call('TestCase.add_to_run', [278,306], [1700,1701]);
#$soapresult = $proxy->call('TestCase.attach_bug', [278,306], [33,44]);
#$soapresult = $proxy->call('TestCase.calculate_average_time', 278);
#$soapresult = $proxy->call('TestCase.create', {case_status_id => 'CONFIRMED', category_id => 'CGI', priority_id => 'P5 - None', summary => 'API TEST CASE', plans => [74]});
#$soapresult = $proxy->call('TestCase.create', [{case_status_id => 'CONFIRMED', category_id => 'CGI', priority_id => 'P5 - None', summary => 'API TEST CASE', plans => [74]}]);
#$soapresult = $proxy->call('TestCase.detach_bug', 278, 33);
#$soapresult = $proxy->call('TestCase.get', 278);
#$soapresult = $proxy->call('TestCase.get_bugs', 278);
#$soapresult = $proxy->call('TestCase.get_case_run_history', 278);
#$soapresult = $proxy->call('TestCase.get_change_history', 278);
#$soapresult = $proxy->call('TestCase.get_components', 278);
#$soapresult = $proxy->call('TestCase.get_plans', 278);
#$soapresult = $proxy->call('TestCase.get_tags', 278);
#$soapresult = $proxy->call('TestCase.get_text', 278,3);
#$soapresult = $proxy->call('TestCase.link_plan', 278, [77,78]);
#$soapresult = $proxy->call('TestCase.list', {default_tester => 'ghendricks@novell.com'});
#$soapresult = $proxy->call('TestCase.lookup_category_id_by_name' );
#$soapresult = $proxy->call('TestCase.lookup_category_name_by_id' );
#$soapresult = $proxy->call('TestCase.lookup_priority_id_by_name', 'P5 - None');
#$soapresult = $proxy->call('TestCase.lookup_priority_name_by_id', 3);
#$soapresult = $proxy->call('TestCase.lookup_status_id_by_name', 'CONFIRMED');
#$soapresult = $proxy->call('TestCase.lookup_status_name_by_id', 1);
#$soapresult = $proxy->call('TestCase.remove_component', 278,2);
#$soapresult = $proxy->call('TestCase.remove_tag', 278, 'fish');
#$soapresult = $proxy->call('TestCase.store_text', 278, 'vrb@novell.com', 'FOO', 'FISH', 'FIGHT', 'FUN');
#$soapresult = $proxy->call('TestCase.unlink_plan', 278, 78);
#$soapresult = $proxy->call('TestCase.update', 278,{priority_id => 'P2 - High', case_status_id=>3 ,summary=>'This was Entering bugs'});

###########################
### TestCaseRun Methods ###
###########################

#$soapresult = $proxy->call('TestCaseRun.attach_bug', 65104, [33,44] );
#$soapresult = $proxy->call('TestCaseRun.create', {case_id => 765, run_id => 501, build_id => 306, environment_id =>7});
#$soapresult = $proxy->call('TestCaseRun.detach_bug', 65104, 33);
#$soapresult = $proxy->call('TestCaseRun.get', 65104);
#$soapresult = $proxy->call('TestCaseRun.get', 501, 765, 306, 1);
#$soapresult = $proxy->call('TestCaseRun.get_bugs', 65104);
#$soapresult = $proxy->call('TestCaseRun.get_completion_time', 65104);
#$soapresult = $proxy->call('TestCaseRun.get_history',65104 );
#$soapresult = $proxy->call('TestCaseRun.list', );
#$soapresult = $proxy->call('TestCaseRun.lookup_status_id_by_name', 'PASSED');
#$soapresult = $proxy->call('TestCaseRun.lookup_status_name_by_id', 3);
#$soapresult = $proxy->call('TestCaseRun.update', 65104, {status=>3});
#$soapresult = $proxy->call('TestCaseRun.update', [65104,6105,6106] , {status=>3});
#$soapresult = $proxy->call('TestCaseRun.update', 501, 765, 306, 1, {status=>3});

########################
### TestPlan Methods ###
########################

#$soapresult = $proxy->call('TestPlan.add_tag', 74, 'Fish');
#$soapresult = $proxy->call('TestPlan.create', {product_id => 'Bugzilla', name=>'API TEST PLAN', type_id=>'Integration', default_product_version=>'3.0'});
#$soapresult = $proxy->call('TestPlan.get', 74);
#$soapresult = $proxy->call('TestPlan.get_change_history', 74);
#$soapresult = $proxy->call('TestPlan.get_product', 74);
#$soapresult = $proxy->call('TestPlan.get_tags', 74);
#$soapresult = $proxy->call('TestPlan.get_test_cases', 74);
#$soapresult = $proxy->call('TestPlan.get_test_runs', 74);
#$soapresult = $proxy->call('TestPlan.get_text', 74, 3);
#$soapresult = $proxy->call('TestPlan.list', {product_id=>2, name=> 'selenium'});
#$soapresult = $proxy->call('TestPlan.lookup_type_id_by_name', 'Integration');
#$soapresult = $proxy->call('TestPlan.lookup_type_name_by_id', 11);
#$soapresult = $proxy->call('TestPlan.remove_tag', 74, 'Fish');
#$soapresult = $proxy->call('TestPlan.store_text', 74, 'THIS IS A TEST OF THE PLAN TEXT VIA API');
#$soapresult = $proxy->call('TestPlan.update', 74, {name=>'API UPDATE', type_id=>3, default_product_version=> '2.22'});

#######################
### TestRun Methods ###
#######################

#$soapresult = $proxy->call('TestRun.add_tag', 501, "Fish");
#$soapresult = $proxy->call('TestRun.create', {plan_id => 97, environment_id => 'test', build_id => 'linux', summary => 'API TEST RUN', manager_id => 'ghendricks@novell.com', product_version=>'1.2'});
#$soapresult = $proxy->call('TestRun.get', 501);
#$soapresult = $proxy->call('TestRun.get_change_history', 501);
#$soapresult = $proxy->call('TestRun.get_completion_report', 501);
#$soapresult = $proxy->call('TestRun.get_tags', 501);
#$soapresult = $proxy->call('TestRun.get_test_case_runs', 501);
#$soapresult = $proxy->call('TestRun.get_test_cases', 501);
#$soapresult = $proxy->call('TestRun.get_test_plan', 501);
#$soapresult = $proxy->call('TestRun.list', {plan => 97});
#$soapresult = $proxy->call('TestRun.remove_tag', 501, 'fish' );
#$soapresult = $proxy->call('TestRun.update', 501, {environment_id => 'test', build_id => 'linux', summary => 'API TEST RUN', manager_id => 'ghendricks@novell.com', product_version=>'1.2'});

show_results('The results are: ', $soapresult);

