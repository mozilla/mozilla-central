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

my $help;
my $Bugzilla_uri;
my $Bugzilla_login;
my $Bugzilla_password;
my $soapresult;

sub SOAP::Transport::HTTP::Client::get_basic_credentials 
{ 
	return $Bugzilla_login => $Bugzilla_password;
}

sub show_results
{
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

	my $result = $soapresult->result;

	if (ref($result) eq 'ARRAY')
	{
		my $ct = 0;
	
		print "Array Results (size = " . scalar(@$result). "):\n";

		foreach $plan (@$result)
		{
			foreach $key (keys(%$plan))
			{
				print "(object " . $ct . ") " . $key . ": " . $$plan{$key} . "\n";
			}
			
			$ct++;
		}
	}
	elsif (ref($result) eq 'HASH')
	{
		print "Hash Results:\n";
		
		foreach (keys(%$result)) 
		{
	        	print "$_: $$result{$_}\n";
		}
	}
	else
	{
		print "Simple Result: " . $result . "\n";
	}
}

sub die_on_fault 
{
    my $soapresult = shift;

    if ($soapresult->fault) 
    {
        die 'Fault: ' . $soapresult->faultcode . ' ' . $soapresult->faultstring;
    }
}

sub syntaxhelp 
{
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

my $proxy = XMLRPC::Lite->proxy($Bugzilla_uri);

my $query = {
          'field0-0-0' => 'author',
          'type0-0-0'  => 'substring',
          'value0-0-0' => 'Second'
         };


$soapresult = $proxy->call('TestPlan.list', {type_id=>4, pagesize=>1000});
#$soapresult = $proxy->call('TestPlan.list', {page=>0, pagesize=>10});
#$soapresult = $proxy->call('TestPlan.lookup_type_name_by_id', 1);
#$soapresult = $proxy->call('TestPlan.lookup_type_id_by_name', 'unit2');
#$soapresult = $proxy->call('TestPlan.get_test_runs', 122);

#$soapresult = $proxy->call('User.lookup_login_by_id', 2);
#$soapresult = $proxy->call('Product.lookup_name_by_id', 1);
#$soapresult = $proxy->call('Product.lookup_id_by_name', 'TestProduct');

#$soapresult = $proxy->call('TestCaseRun.update', 104, 183336, 1, { case_run_status_id => 1 });
#$soapresult = $proxy->call('TestCaseRun.get', 3);
#$soapresult = $proxy->call('TestCaseRun.update', 1, 1, 1, 1, { notes=>'WOW!! A note!', case_run_status_id => 1 });
#$soapresult = $proxy->call('TestCaseRun.update', 1, 1, 2, 1, { build_id => 1 });
#$soapresult = $proxy->call('TestCaseRun.update', 1, 1, 1, 1, { isCurrent => 1 });
#$soapresult = $proxy->call('TestCaseRun.update', 1, 1, 1, 2, { environment_id => 1 });
#$soapresult = $proxy->call('TestCaseRun.update', 1, 1, 1, 1, { assignee=> 1 });
#$soapresult = $proxy->call('Build.get', 2);
#$soapresult = $proxy->call('TestCaseRun.list', {});
#$soapresult = $proxy->call('TestCaseRun.list', {build_id => 99});
#$soapresult = $proxy->call('TestCaseRun.list', {case_id=>357222, isactive=>1});

#$soapresult = $proxy->call('TestCase.list', {pagesize=>25, script_type=>'equals', script => 'novell.storage.p0.NetStorageTest.NetStorage - SIMPLE - test logout'});
#$soapresult = $proxy->call('TestCase.list', {pagesize=>1500});

#$soapresult = $proxy->call('Build.lookup_id_by_name', 'First Build');
#$soapresult = $proxy->call('TestPlan.list', {pagesize=>100, plan_id=>222});
#$soapresult = $proxy->call('TestPlan.list', {pagesize=>100, name=>'Unit Test Plan', name_type=>'anyexact'});
#$soapresult = $proxy->call('TestPlan.lookup_type_name_by_id', 0);
#$soapresult = $proxy->call('TestPlan.get', 555);
#$soapresult = $proxy->call('TestPlan.update', 1, {name => 'Restricted Plan Updated', isactive2=>1});
#$soapresult = $proxy->call('TestPlan.list', {pagesize=>100});

#$soapresult = $proxy->call('TestPlan.get_categories', 2);

#$soapresult = $proxy->call('TestCaseRun.update',1,1,1,{notes=>'This is a new note to be appended.'});
#$soapresult = $proxy->call('TestCaseRun.get',1);
#$soapresult = $proxy->call('TestCaseRun.update', 1, 1, 1, { case_run_status_id => 1 });
#$soapresult = $proxy->call('TestCase.add_component', 1, 1);
#$soapresult = $proxy->call('TestCase.remove_component', 1, 1);
#$soapresult = $proxy->call('TestCase.list_components', 1);
#$soapresult = $proxy->call('Component.get', 9999);
#$soapresult = $proxy->call('TestRun.get_test_cases', 1758);
#$soapresult = $proxy->call('TestRun.get_test_case_runs', 1);
#$soapresult = $proxy->call('TestPlan.get_builds', 2);
#$soapresult = $proxy->call('Build.get', 2);
#$soapresult = $proxy->call('Build.create', {name=>'Another Build', product_id=>1});
#$soapresult = $proxy->call('Build.update', 2, {name=>'Second Build', description=>'desc', milestone=>'hmm'});
#$soapresult = $proxy->call('Build.update', 2, {milestone=>'hmm3'});

#$soapresult = $proxy->call('TestRun.get_test_cases', 130);
#$soapresult = $proxy->call('TestCase.list', {isautomated=>1});

#$soapresult = $proxy->call('TestCase.list', {run_id=>130, isautomated=>1});

#$soapresult = $proxy->call('TestPlan.list', {type_id => 1});
#$soapresult = $proxy->call('TestPlan.list', {plan_id => 2, planidtype => "lessthan"});

#$soapresult = $proxy->call('TestCase.list');
#$soapresult = $proxy->call('TestCase.list', {default_tester_id => 1});
#$soapresult = $proxy->call('TestCase.list', {case_id => 1});
#$soapresult = $proxy->call('TestCase.list', $query);

#$soapresult = $proxy->call('TestRun.list');

#$soapresult = $proxy->call('TestCaseRun.list');
#$soapresult = $proxy->call('TestCaseRun.list', {build_id => 1, case_id => 1, run_id => 1, case_run_status_id => 1});

#$soapresult = $proxy->call('TestPlan.get', 1);

#$soapresult = $proxy->call('TestCase.get', 1);

#$soapresult = $proxy->call('TestRun.get', 2);

#$soapresult = $proxy->call('TestCaseRun.get', 1);

#$soapresult = $proxy->call('TestPlan.create', { name=>"Another Test Plan", 
#	                                         product_id=>1, 
#	                                         author_id=>1, 
#	                                         editor_id=>1, 
#	                                         type_id=>1,
#	                                         default_product_version=>1
#	                                       });
#$soapresult = $proxy->call('TestPlan.get', 54);
#$soapresult = $proxy->call('TestPlan.get_components', 2);
#$soapresult = $proxy->call('TestPlan.add_tag', 1, 'This is a new tag');
#$soapresult = $proxy->call('TestPlan.remove_tag', 1, 'This is a new tag');
#$soapresult = $proxy->call('TestPlan.get_tags', 1);
#$soapresult = $proxy->call('TestPlan.lookup_type_name_by_id', 1);
#$soapresult = $proxy->call('TestPlan.lookup_type_id_by_name', 'Unit');
#$soapresult = $proxy->call('TestPlan.get_test_cases', 1);
#$soapresult = $proxy->call('TestPlan.get_test_runs', 1);


#$soapresult = $proxy->call('TestCase.create', { isautomated=>0,
#						 category_id=>1,
#						 case_status_id=>2,
#						 author_id=>1,
#                                                plan_id=>2
#                                              }); 
#$soapresult = $proxy->call('TestCase.get', 3);
#$soapresult = $proxy->call('TestCase.get_plans', 1);
#$soapresult = $proxy->call('TestCase.link_plan', 1, 2);
#$soapresult = $proxy->call('TestCase.unlink_plan', 1, 2);

#$soapresult = $proxy->call('TestCase.get_components', 1);
#$soapresult = $proxy->call('TestCase.add_tag', 1, 'This is a new tag');
#$soapresult = $proxy->call('TestCase.remove_tag', 1, 'This is a new tag');
#$soapresult = $proxy->call('TestCase.get_tags', 1);
#$soapresult = $proxy->call('TestCase.lookup_category_name_by_id', 1);
#$soapresult = $proxy->call('TestCase.lookup_category_id_by_name', 'Test Category 1');
#$soapresult = $proxy->call('TestCase.lookup_status_name_by_id', 1);
#$soapresult = $proxy->call('TestCase.lookup_status_id_by_name', 'PROPOSED');
#$soapresult = $proxy->call('TestCase.lookup_priority_name_by_id', 1);
#$soapresult = $proxy->call('TestCase.lookup_priority_id_by_name', 'P1');

#$soapresult = $proxy->call('TestCaseRun.create', { assignee => 1,
#                                                   build_id => 1,
#                                                   case_id => 1,
#                                                   case_text_version => 1,
#                                                   environment_id => 1,
#                                                   run_id => 1,
#                                                 });
#$soapresult = $proxy->call('TestCaseRun.get', 3);
#$soapresult = $proxy->call('TestCaseRun.lookup_status_name_by_id', 1);
#$soapresult = $proxy->call('TestCaseRun.lookup_status_id_by_name', 'IDLE');

#$soapresult = $proxy->call('TestRun.create', { plan_id => 1,
#                                               environment_id => 1,
#                                               build_id => 1,
#                                               plan_text_version => '1',
#                                               manager_id => 1,
#                                               summary => 'This is test run 2.',
#                                             });
#$soapresult = $proxy->call('TestRun.get', 3);
#$soapresult = $proxy->call('TestRun.get_test_plan', 3);
#$soapresult = $proxy->call('TestRun.get_test_cases', 1575);
#$soapresult = $proxy->call('TestRun.get_test_case_runs', 1);
#$soapresult = $proxy->call('TestRun.lookup_environment_name_by_id', 190);
#$soapresult = $proxy->call('TestRun.lookup_environment_id_by_name', 'Linux');
#$soapresult = $proxy->call('TestRun.add_tag', 1, 'This is a new tag');
#$soapresult = $proxy->call('TestRun.remove_tag', 1, 'This is a new tag');
#$soapresult = $proxy->call('TestRun.get_tags', 1);

#$soapresult = $proxy->call('TestPlan.update', 1, {product_id => 1});
#$soapresult = $proxy->call('TestCase.update', 1, {isautomated => 1});
#$soapresult = $proxy->call('TestCase.update', 239137, {author_id => 1});
#$soapresult = $proxy->call('TestCase.update', 1, {author_id => 2});
#$soapresult = $proxy->call('TestRun.update', 2, { notes => 'These are new notes for test run 2' });
#$soapresult = $proxy->call('TestCaseRun.update', 1, 1, 1, { case_run_status_id => 1 });

#$soapresult = $proxy->call('TestCase.store_text', 2, 1, 'Another action for test case 2', 'Another effect for test case 2');
#$soapresult = $proxy->call('TestCase.get_text', 2);

#$soapresult = $proxy->call('Environment.create', {product_id=>275, name=>'linuxtesttest', isactive=>1});
#$soapresult = $proxy->call('Environment.get', 1);
#$soapresult = $proxy->call('Environment.list', {environment_id=>330});
#$soapresult = $proxy->call('Environment.list', {environment_name=>'t1'});
#$soapresult = $proxy->call('Environment.update', 2, {name=>'Second Environment'});
#$soapresult = $proxy->call('Environment.get_runs', 1);

show_results('The results are: ', $soapresult);
