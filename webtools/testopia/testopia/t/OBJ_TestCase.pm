#!/usr/bin/perl -w
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
# The Original Code is the Bugzilla Testopia System.
#
# The Initial Developer of the Original Code is Greg Hendricks.
# Portions created by Greg Hendricks are Copyright (C) 2006
# Novell. All Rights Reserved.
#
# Contributor(s): Greg Hendricks <ghendricks@novell.com>
#                 Al Rodriguez  <arodriquez@novell.com>

package OBJ_TestCase;	

use lib '.';
use lib '../..';
use strict;

use base qw(Test::Unit::TestCase);

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::TestTag;
use Bugzilla::Testopia::TestCaseRun;

use Test;
use Testopia::Test::Util;
use Testopia::Test::Constants;

use Test::Exception;
use Test::Deep;
use Test::More;

Bugzilla->error_mode(ERROR_MODE_DIE);

use constant DB_TABLE => 'test_cases';
use constant ID_FIELD => 'case_id';

our $dbh = Bugzilla->dbh;
our $obj = Test::test_init(DB_TABLE, ID_FIELD, 'Bugzilla::Testopia::TestCase');

sub test_init{
	#$obj = Test::test_init(DB_TABLE, ID_FIELD, 'Bugzilla::Testopia::TestCase');
}

sub check_alias{
	my $id = $dbh->selectrow_array("SELECT MAX(case_id) FROM test_cases WHERE case_id <> ?", undef, $obj->id);
	$dbh->do("UPDATE test_cases SET alias = 'TEST' WHERE case_id = $id");
	dies_ok(sub{$obj->_check_alias('TEST')}, 'Alias Must be Unique');
	ok($obj->_check_alias('UNIQUE ALIAS'), 'Alias is Unique');
}	

sub check_arguments{
	# _check_arguments returns the arguments and does no checking
	ok($obj->_check_arguments('-a', 'something', 'something else'), 'Arguments Passed');
}

sub check_dependency{
	dies_ok(sub{$obj->_check_dependency('DIE')}, 'Unused Alias');
	dies_ok(sub{$obj->_check_dependency(50)}, 'Invalid Case ID');
	
	ok($obj->_check_dependency($obj->id), 'Valid Id');
}

sub check_bugs{
		my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});

	# If the user does not have rights to view the bug, this should die
		unless(Bugzilla->user->can_see_bug(2) ){
			dies_ok(sub{$obj->_check_bugs(2, 'bugs')}, "User " . Bugzilla->user->{'login_name'} ." does not have rights to view bugs")
		}
		else{
			ok( defined $obj->_check_bugs(2, 'bugs'), "User" . Bugzilla->user->{'login_name'} . " Can see bug 2");
		}
	}
			dies_ok( sub{$obj->_check_bugs(90, 'bugs')}, "Bug with ID 90 does not exist");
}

sub check_status{
	dies_ok(sub{$obj->_check_status(999)}, 'Test Case Status Does Not Exist');
	ok($obj->_check_status(1), 'Test Case Status 1 Exists');
}

sub check_components{
	dies_ok(sub{$obj->_check_components}, 'Missing Parameter Components');
	ok($obj->_check_components(1), 'Valid Component');
}

sub check_tester{
		my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		ok($obj->_check_tester($login->{'login_name'}), 'User '. $login->{'login_name'} .' has a valid Login');	
	}
}

sub check_time{
	dies_ok(sub{$obj->_check_time('2 Hours')}, 'Invalid Time Format');
	dies_ok(sub{$obj->_check_time('1:2:3:4')}, 'Invalid Time Format');
	dies_ok(sub{$obj->_check_time('2 Hours')}, 'Invalid Time Format');
	ok($obj->_check_time eq 0, 'Time Value is Required');
}

sub check_automated{
	dies_ok(sub{$obj->_check_automated('INVALID')},   'Invalid Automated Value');
	dies_ok(sub{$obj->_check_automated(undef)},   'undef Not Valid Automated Value');
	ok($obj->_check_automated(1) eq 1, '1 is Valid Value');
	ok($obj->_check_automated(0) eq 0, '0 is Valid Value');
}

sub check_sortkey{
	dies_ok(sub{$obj->_check_automated('INVALID')},   'Invalid Sort Key');
	ok($obj->_check_automated(1), 'Valid Sort Key');
	ok($obj->_check_automated(100000), 'Valid Sort Key');	
}


sub check_plans{
	my $plan = new Bugzilla::Testopia::TestPlan(1);
	# NOTE: The real method checks if the array is greater than 0,
	#Not if it actually holds Bugzilla::Testopia::TestPlan objects
	dies_ok(sub{$obj->_check_plans}, 'Plans Array Must Not Be Empty');
	dies_ok(sub{$obj->_check_plans(2)}, 'Plans Array Must Be An Array');
	ok($obj->_check_plans([$plan]), 'Plans Array Not Undef');
}

sub check_priority{
	my $pri1 = $obj->_check_priority(1);
	my $pri2 = $obj->_check_priority('P1');
	cmp_deeply($pri1, $pri2, 'Same Priority Found with Id and Value');
}

sub check_runs{
	dies_ok(sub{$obj->_check_runs(1000)}, 'Run ID Does Not Exist');
	ok(defined $obj->_check_runs(1), 'Run Exists');
}

sub check_summary{
	dies_ok(sub{$obj->_check_summary()}, 'Summary Must Not Be undef');
	dies_ok(sub{$obj->_check_summary('')}, 'Summary Must Not Be Empty');
	ok($obj->_check_summary('SUMMARY') eq 'SUMMARY', 'Valid Summary');
}

sub check_category{
	my $plan = new Bugzilla::Testopia::TestPlan(1);
	Bugzilla::Testopia::TestCase->_check_category(1, $plan);
}

sub test_create{
	check_alias;	
	check_arguments;
	check_dependency;
	check_bugs;
	check_status;
	check_components;
	check_tester;
	check_time;
	check_automated;
	check_plans;
	check_priority;
	check_runs;
	check_sortkey;
	check_summary;
	check_category;	

	Test::set_user('1', 'admin@testopia.com', 'admin@testopia.com');
	
	my $plan = new Bugzilla::Testopia::TestPlan(999);
	my $hash = {
	'case_status_id' 	=> 1,
	'priority_id' 		=> 999,
	'default_tester_id'	=> 1,
	'isautomated'		=> 1,
	'sortkey'			=> 1,
	'script'			=> 'SCRIPT',
	'arguments'			=> 'ARGS',
	'summary'			=> 'SUMMARY',
	'requirement'		=> '',
	'alias'				=> '',
	'estimated_time'	=> '1:23:4',
	'dependson'			=> '990',
	'blocks'			=> '999',
	'plans'				=> [$plan],
	'runs'				=> '999',
	'tags'				=> '',
	'components'		=> '999',
	'bugs'				=> '999',
	'category_id'		=> 999,
	'author_id'			=> 999};
	
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
	
	# If the user does not have rights to create a Test Case, this should die
		unless(Bugzilla->user->can_see_bug(999)){
			dies_ok( sub {Bugzilla::Testopia::TestCase->create($hash)}, "User " . Bugzilla->user->{'login_name'} ." does not have rights to create a Test Case");	
		}
		else{
			my $created_obj = Bugzilla::Testopiaj::TestCase->create($hash);
			foreach my $field ($created_obj){
				delete $created_obj->{$field} unless( defined $hash->{$field});
			}
			my $db_obj = new Bugzilla::Testopia::TestCase($created_obj->id);
			$db_obj->{'plans'} = $db_obj->plans;
			$db_obj->{'version'} = 1;
			cmp_deeply($created_obj, $db_obj, 'Created Object Matched in DB');
			$dbh->do("DELETE FROM test_cases WHERE case_id = " . $created_obj->id);		
		}
	}
}

sub test_update{
	$obj->set_alias('SOME ALIAS');
	$obj->set_isautomated('1');
	delete $obj->{'plans'};
	delete $obj->{'version'};
	delete $obj->{'type'};
	$obj->update;
	my $db_obj = new Bugzilla::Testopia::TestCase($obj->id);
	cmp_deeply($obj, $db_obj, 'Update TestCase');
}

sub test_get_selectable_components{
    my @components;
    push @components, {'id' => '0', 'name' => '--Please Select--'};
    my @comp_ids;
    foreach my $comp (@{$obj->components}){
    	push @comp_ids, $comp->{'id'};
    }
	my $ids = $dbh->selectrow_arrayref(
				"SELECT id FROM components WHERE product_id IN (?) AND id NOT IN (?) ORDER BY name", undef, join(",", @{$obj->get_product_ids}), join(",", @comp_ids));
    foreach my $id (@$ids){
        push @components, Bugzilla::Component->new($id);
    }
    ok( defined $obj->get_selectable_components, 'Selectable Components Match');
}

sub test_get_category_list{
	my @categories;
	my $cat_ids = $dbh->selectrow_arrayref("SELECT category_id FROM test_case_categories WHERE product_id IN (?)", undef, join(",", @{$obj->get_product_ids}));
    foreach my $id (@$cat_ids){
        push @categories, Bugzilla::Testopia::Category->new($id);
    }
	ok($obj->get_category_list, 'Category List Match');
}

sub test_get_product_ids{
	my $id = $obj->id;
	my @array = [1];
	ok($obj->get_product_ids, 'Product Ids Retrieved');
	@array = [];
	$obj->{'case_id'} = 0;
	cmp_deeply($obj->get_product_ids, @array, 'Product Ids Match W/No Case_Id');	
	$obj->{'case_id'} = $id;
}

sub test_get_caserun_count{
	my $id = $obj->{'case_id'};
	$obj->{'case_id'} = 4;
	ok($obj->get_caserun_count eq 1, '1 Test Case Run Count');
	ok($obj->get_caserun_count(1) eq 1, '1 Test Case Run Count W/Status ID');
	$obj->{'case_id'} = $id;
}

sub test_add_tag{
	my $tags = ['TEST1'];
	$obj->add_tag(@$tags);
	$obj->add_tag('TEST2', 'TEST2','TEST2','TEST3');
	
	#Get Tags associated with this TestCase
	my $query = "SELECT tag_id FROM test_case_tags WHERE case_id = ?";
	my $test_tags = $dbh->selectcol_arrayref($query, undef, $obj->id);
	for(@$test_tags){
		my $tag = new Bugzilla::Testopia::TestTag($_);
		ok(defined $tag, $tag->{'tag_name'} . " Tag Added Correctly");
	}
}

sub test_remove_tag{
	dies_ok(sub{$obj->remove_tag('FAKE_TAG')}, 'Cannot Remove Tag Not Already In DB');
	my $tag = 'TEST';
	$obj->add_tag($tag);
	$obj->remove_tag($tag);
	my $tag_id = $dbh->selectcol_arrayref("SELECT tag_id FROM test_tags WHERE tag_name = ?", undef, $tag);
	my $id = $dbh->selectcol_arrayref("SELECT tag_id FROM test_case_tags WHERE tag_id = ? and case_id = ?", undef, $tag_id->[0], $obj->id);
	ok( scalar @$id eq 0, 'Tag Removed Successfully');	
}

sub test_attach_bug{
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
	
	# If the user does not have rights to add a bug, this should die
		unless(Bugzilla->user->can_see_bug(1)){
			dies_ok( sub {$obj->attach_bug(1)}, "User " . Bugzilla->user->{'login_name'} ." does not have rights to add bugs");	
		}
		else{
			my $bugs = [1];
			$obj->attach_bug($bugs, 1);
			my $attached_bugs = $dbh->selectrow_arrayref("SELECT bug_id FROM test_case_bugs WHERE bug_id in (?) AND case_id = ?", undef, (join ",", @$bugs), $obj->id);
			cmp_deeply($attached_bugs, $bugs, 'Bugs Added Correctly');
		}
	}
}

sub test_detach_bug{
	my $bug_ids = [1, 2];
	$obj->attach_bug(1);
	$obj->attach_bug(2);
	my $query = "SELECT bug_id FROM test_case_bugs WHERE bug_id in (?)";
	my $old_bugs = $dbh->selectrow_arrayref($query, undef, join (",", @$bug_ids));
	$obj->detach_bug($bug_ids);
	my $new_bugs = $dbh->selectrow_arrayref($query, undef, join (",", @$bug_ids));
	ok( $old_bugs && ! defined $new_bugs, "Bugs Detached" );
}

sub test_add_component{
	my $comps = [1];

	my $query = "SELECT component_id FROM test_case_components WHERE case_id = ?";
	my $delete = "DELETE FROM test_case_components WHERE case_id = ". $obj->{'case_id'};
	$obj->add_component($comps);
	my @db_comps = $dbh->selectrow_arrayref($query, undef, $obj->id);
	cmp_deeply($comps, @db_comps, "Components added correctly");
	$dbh->do($delete);		

	$obj->add_component($comps, 1);
	@db_comps = $dbh->selectrow_arrayref($query, undef, $obj->id);
	cmp_deeply($comps, @db_comps, "Components added correctly");
	$dbh->do($delete);		
}

sub test_remove_component{
	my $comp = 1;	
	my $query = "SELECT component_id FROM test_case_components WHERE case_id = ?";
	$obj->add_component($comp);
	my $db_comps = $dbh->selectcol_arrayref($query, undef, $comp);
	$obj->remove_component($comp);
	my $new_db_comps = $dbh->selectcol_arrayref($query, undef, $comp);
	ok( $new_db_comps ne $db_comps, 'Components Removed');	
}

sub test_add_to_run{
	my $run = 1;
	my $before_adding = $dbh->selectrow_hashref("SELECT case_run_id, run_id, case_id, case_run_status_id, case_text_version, build_id, iscurrent, environment_id FROM test_case_runs WHERE run_id = $run");
	$obj->add_to_run($run);
	my $db_obj = $dbh->selectrow_hashref("SELECT * FROM test_case_runs WHERE run_id = $run");
	my $object = new Bugzilla::Testopia::TestCaseRun($db_obj->{'case_run_id'});
	cmp_deeply($db_obj, noclass($object), 'Test Case Added to Run');
}

sub test_add_blocks{
	my $blocks = 2;
	$obj->add_blocks($blocks);
	my $dep = $dbh->selectrow_arrayref("SELECT blocked FROM test_case_dependencies WHERE dependson = ?", undef, $obj->id);
	ok ( defined $dep , "Block Added");
	_remove_blocks();
}

sub _remove_blocks{	
	my $block = 2;
	my $id = $dbh->selectrow_array("SELECT MAX(blocked) FROM test_case_dependencies");
	my $query = "SELECT blocked FROM test_case_dependencies WHERE dependson = ?";
	my $db_deps = $dbh->selectrow_arrayref($query, undef, $obj->id);
	$obj->remove_blocks($block);
	my $new_db_deps = $dbh->selectrow_arrayref($query, undef, $obj->id);
	ok($db_deps ne $new_db_deps, 'Block Removed');
}

sub test_add_dependson{
	dies_ok ( sub{$obj->add_dependson($obj->id)}, "Cannot Be Dependant on Self");
	$obj->add_dependson(10);
	my $dep = $dbh->selectcol_arrayref("SELECT dependson FROM test_case_dependencies WHERE blocked = ?", undef, $obj->id);

	ok ( $dep->[0] eq 10, "Dependency Added");
	_remove_dependson();
}

sub _remove_dependson{
	my $id = $dbh->selectrow_array("SELECT MAX(dependson) FROM test_case_dependencies");
	my $query = "SELECT dependson FROM test_case_dependencies WHERE dependson = ?";
	my $db_deps = $dbh->selectcol_arrayref($query, undef, $id);
	$obj->remove_dependson($id);
	my $new_db_deps = $dbh->selectcol_arrayref($query, undef, $id);
	ok(@$db_deps ne @$new_db_deps, 'Dependency Removed');
}

sub test_compare_doc_versions{
	my $same = {
          'breakdown' => '',
          'setup' => '',
          'effect' => '',
          'action' => ''
        };
     
     my $id = $dbh->selectrow_array("SELECT MAX(plan_id) FROM test_plans ", undef);
	 cmp_deeply($obj->compare_doc_versions($obj->id, $obj->id), $same, 'Same Documents');
	 $dbh->do("DELETE FROM test_case_texts WHERE case_id = $id");
	 $obj->store_text($id, $obj->id, 'ACTION2', 'EFFECT', 'SETUP', 'BREAKDOWN');
	 ok($obj->compare_doc_versions($obj->id, $id) ne $same, 'Different Documents');
}

sub test_diff_case_doc{
	my $vals = $dbh->selectcol_arrayref("SELECT action, effect, setup, breakdown FROM test_case_texts WHERE case_id = ?", undef, $obj->id);
	ok($obj->diff_case_doc('ACTION1', $vals->[1], $vals->[2], $vals->[3]), 'Case Docs are Different');
	delete $obj->{'version'};
}

sub test_store_text{
	my $dbh = Bugzilla->dbh;
	my $text = {
          'breakdown' => 'BREAKDOWN',
          'setup' => 'SETUP',
          'case_text_version' => '1',
          'who' => '999',
          'effect' => 'EFFECT',
          'action' => 'ACTION',
          'creation_ts' => '2008-06-04 14:57:00',
          'case_id' => '999'
        };
	ok($obj->store_text('999', '999', 'ACTION', 'EFFECT', 'SETUP', 'BREAKDOWN', 1, '2008-06-04 14:57:00') eq 1, 'Version Updated');
	my $db_text = $dbh->selectrow_hashref('SELECT * FROM test_case_texts WHERE case_id = 999');
	cmp_deeply($text, $db_text, 'Text Stored Correctly');
}

sub test_link_plan{
	my $id = $obj->id;
	$obj->link_plan(1, $id);
	my $db_plan = $dbh->selectrow_hashref("SELECT * FROM test_case_plans WHERE case_id = $id AND plan_id = 1");
	my $known_plan =  {'case_id' => $id, 'plan_id' => '1'};
	cmp_deeply($db_plan, $known_plan, 'Plan Linked To Test Case');
}

sub _unlink_plan{
	my $id = $obj->id;
	my $max_id = $dbh->selectrow_array("SELECT MAX(plan_id) FROM test_plans ", undef);
	$obj->link_plan($max_id, $id);
	$obj->link_plan($max_id-1, $id);
	my $query = "SELECT * FROM test_case_plans WHERE case_id = $id AND plan_id = 1";
	my $old_db_plan = $dbh->selectrow_hashref($query);
	$obj->unlink_plan($max_id);
	my $new_db_plan = $dbh->selectrow_hashref($query);
	ok(defined $old_db_plan && !defined $new_db_plan, 'Plan Unlinked');
}

sub test_copy{
	my $copy_id = $obj->copy($obj->{'author_id'}, $obj->{'default_tester_id'}, 0);
	my $copy = {
			   'case_id' => 			$copy_id,
			   'case_status_id' => 		$obj->{'case_status_id'},
               'category_id' => 		$obj->{'category_id'},
               'priority_id' => 		$obj->{'priority_id'},
               'author_id' =>			$obj->{'author_id'},
               'default_tester_id' => 	$obj->{'default_tester_id'},
               'estimated_time' => 		$obj->{'estimated_time'},
               'isautomated' => 		$obj->{'isautomated'},
               'sortkey' => 			$obj->sortkey,
               'script' => 				$obj->{'script'},
               'arguments' => 			$obj->{'arguments'},
               'summary' => 			$obj->{'summary'},
               'requirement' => 		$obj->{'requirement'}};
	my $db_copy = $dbh->selectrow_hashref("SELECT * FROM test_cases WHERE case_id = ?", undef, $copy_id); 
	delete $db_copy->{'creation_date'};
	delete $db_copy->{'alias'};
	delete $db_copy->{'version'};
	
	cmp_deeply($db_copy, $copy, 'Copy Created Successfully');
}

sub test_class_check_alias{
	my $no = $obj->class_check_alias('FAKE');
	ok( ! defined $no, 'Alias not in DB');
}
	
sub test_history{
	ok(defined $obj->history, "History Exists");
}

sub test_obliterate{
	my $id = $dbh->selectrow_array("SELECT MAX(case_id) FROM test_cases WHERE case_id <> ?", undef, $obj->id);
	my $dead_obj = new Bugzilla::Testopia::TestCase($id);
	$dead_obj->obliterate;use base qw(Exporter Test::Unit::TestCase);
	
	my $db_dead = $dbh->selectrow_arrayref("SELECT * FROM test_cases WHERE case_id = ?", undef, $id);
	ok( !defined $db_dead, 'Test Case Deleted');
}

sub new {
    my $self = shift()->SUPER::new(@_);
    return $self;
}

sub set_up {
    my $self = shift;
}

sub tear_down {
    my $self = shift;
}

1;
