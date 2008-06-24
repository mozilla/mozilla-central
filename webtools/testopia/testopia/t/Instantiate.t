#!/usr/bin/perl -w

use lib '../..';
use strict;

use Test::More tests => 42;
use Test::Deep;

use Bugzilla;
use Bugzilla::Constants;

use Bugzilla::Testopia::Attachment;
use Bugzilla::Testopia::Build;
use Bugzilla::Testopia::Category;
use Bugzilla::Testopia::Classification;
use Bugzilla::Testopia::Environment;
use Bugzilla::Testopia::Environment::Category;
use Bugzilla::Testopia::Environment::Element;
use Bugzilla::Testopia::Environment::Property;
use Bugzilla::Testopia::Product;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::TestCaseRun;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::TestTag;

use Testopia::Test::Util;

Bugzilla->error_mode(ERROR_MODE_DIE);


my $db_obj;

my @tables =
  qw(test_attachments test_builds test_case_categories test_environments
  test_environment_category test_environment_element test_environment_property
  test_cases test_case_runs test_plans test_runs test_tags products classifications);

foreach my $table (@tables) {
    $db_obj = get_rep($table);
#    my $is = ok(defined($db_obj), "No Value in Database for Table $table");
#    next unless $is; 

# If the table has no data, we do not test it
# otherwise we check it's contents 

if (defined $db_obj){
  SWITCH: for ($table) {
        /attachments/ && do {    
            my $obj = new Bugzilla::Testopia::Attachment( $db_obj->{'attachment_id'} );

            ok( defined $obj, "Testing Attachment Instantiation" );
            isa_ok( $obj, 'BugzillaBugzilla::Testopia::Attachment' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );
            last SWITCH;
        };
        /builds/ && do {
            my $obj = new Bugzilla::Testopia::Build( $db_obj->{'build_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::Build' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );
            last SWITCH;
        };
        /case_categories/ && do{
            my $obj = new Bugzilla::Testopia::Category( $db_obj->{'category_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::Category' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;
        };
        /environments/ && do{
            my $obj = new Bugzilla::Testopia::Environment( $db_obj->{'environment_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::Environment' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        };
        /environment_category/ && do{
            my $obj = new Bugzilla::Testopia::Environment::Category( $db_obj->{'env_category_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::Environment::Category' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        };
         /environment_element/ && do{
            my $obj = new Bugzilla::Testopia::Environment::Element( $db_obj->{'element_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::Environment::Element' );
			
			# We need to delete this because it is not in the database
			# We check the get_properties subroutine somewhere else though
			delete $obj->{'properties'};
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;
        };
        /environment_property/ && do{
            my $obj = new Bugzilla::Testopia::Environment::Property( $db_obj->{'property_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::Environment::Property' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        };
        /cases/ && do{
            my $obj = new Bugzilla::Testopia::TestCase( $db_obj->{'case_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::TestCase' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        };
        /case_runs/ && do{    
        	my $obj = new Bugzilla::Testopia::TestCaseRun( $db_obj->{'case_run_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::TestCaseRun' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        };
        /plans/ && do{
        	my $obj = new Bugzilla::Testopia::TestPlan( $db_obj->{'plan_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::TestPlan' ); 
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        };
        /runs/ && do{
        	my $obj = new Bugzilla::Testopia::TestRun( $db_obj->{'run_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::TestRun' );

            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       		
        };
        /tags/ && do{
        	my $obj = new Bugzilla::Testopia::TestTag( $db_obj->{'tag_id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::TestTag' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        };
        /products/ && do{
        	my $obj = new Bugzilla::Testopia::Product( $db_obj->{'id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::Product' );

            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        }; 
        /classifications/ && do{
			my $obj = new Bugzilla::Testopia::Classification( $db_obj->{'id'} );

            ok( defined $obj, "Testing Build Instantiation" );
            isa_ok( $obj, 'Bugzilla::Testopia::Classification' );
            cmp_deeply( $db_obj, noclass($obj), "DB and Object fields match" );        	
        	last SWITCH;       	
        };
    } }
}
