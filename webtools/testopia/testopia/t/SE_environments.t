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
#                 Jeff Dayley    <jedayley@novell.com>
#                 Ben Warby      <bwarby@novell.com>

use strict;

use lib "..";
use lib "../..";

use Test::More tests => 4;
use Test::Deep;

use Bugzilla;
use Bugzilla::Util;
use Bugzilla::Constants;

use Bugzilla::Testopia::Product;
use Bugzilla::Testopia::Environment;

use Testopia::Test::Util;
use Testopia::Test::Constants;
use Testopia::Test::Selenium::Util;
use Testopia::Test::Selenium::Constants;

my ($user_type, $login, $passwd) = @ARGV;

use constant DEBUG => 1;

Bugzilla->error_mode(ERROR_MODE_DIE);

my $isanon = 0;
# $se object from Test::Selenium::Util
$se->start();

if ($login && $passwd){
    unless ( Testopia::Test::Selenium::Util->login( $login, $passwd) ) {
        $se->stop();
        fail('login');
        exit;
    }
}
else {
    $se->open( 'tr_environments.cgi' );
    $se->wait_for_page_to_load(TIMEOUT);
    $se->pause(3000) if DEBUG;
    
    ok( $se->is_text_present("I need a legitimate login and password to continue"), "anonymous user check" );
    $isanon = 1;

}
SKIP: {
    skip "Anonymous Login", 2 if $isanon;
    test_add();
    test_edit();
    test_list();
}

sub test_list{
	my $self = shift;

    $se->open("tr_list_environments.cgi?ctype=json");
    $se->wait_for_page_to_load(TIMEOUT);
    ok($se->is_text_present('totalResultsAvailable'), "basic list - environments");
    
}

sub test_add {

    #  Create a unique name for the environment using the number of seconds since epoch
    my $environment_name = "SELENIUM CREATE ". time();
    my $rep = get_rep('products');

    # Add new environment - supposed to error because missing name
    my $product = new Bugzilla::Testopia::Product($rep->{'id'});
    my $test    = {
        url    => "tr_environments.cgi",
        action => "add",
        params => {
            product_id  => $rep->{'id'},
            isactive    => 1
        }
    };

    $se->open( format_url($test) );
    $se->wait_for_page_to_load(TIMEOUT);
    $se->pause(3000) if DEBUG;
    
    ok( $se->is_text_present("testopia-missing-required-field"), "missing params check" );

    #Add valid environment
    $test->{params}->{name} = $environment_name;

    $se->open( format_url($test) );
    $se->wait_for_page_to_load(TIMEOUT);
    $se->pause(3000) if DEBUG;
    ok( $se->is_text_present("'success': true"), "'action=add'" );

    #check to make sure it was added properly
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_environments 
          WHERE name = ? 
            AND product_id = ?',
        undef, ( $environment_name, $rep->{'id'} )
    );

    $test->{params}->{environment_id} = $ref->{environment_id};
    diag(dump_all($ref, $test->{params})) if DEBUG;
    cmp_deeply( $test->{params}, $ref, "Environment Hashes match" );

    #check for adding duplicate names
    $se->open( format_url($test) );
    $se->wait_for_page_to_load(TIMEOUT);
    $se->pause(3000) if DEBUG;
    ok( $se->is_text_present("testopia-name-not-unique"), "duplicate check." );
    
}

sub test_edit {

    my $dbh = Bugzilla->dbh;

    #Get current environment inforamtion
    my $rep = get_rep('test_environments');

    my $test = {
        url    => "tr_environments.cgi",
        action => "rename",
        params => {
            env_id   => $rep->{'environment_id'},
            name     => "SELENIUM UPDATE ". time(),
        }
    };

    #Try to update things
    $se->open( format_url($test) );
    $se->wait_for_page_to_load(TIMEOUT);
    $se->pause(3000) if DEBUG;
    ok( $se->is_text_present("'success': true"), "action=edit" );
    
    $test->{action} = 'toggle';

    $se->open( format_url($test) );
    $se->wait_for_page_to_load(TIMEOUT);
    $se->pause(3000) if DEBUG;
    ok( $se->is_text_present("'success': true"), "action=toggle" );

    #check edit succeded and values updated
    my $environment = new Bugzilla::Testopia::Environment($rep->{'environment_id'});
    diag(dump_all($environment, $test)) if DEBUG;
    
    ok ($environment->name eq $test->{params}->{name}, "Names match");
    ok ($rep->{'isactive'} != $environment->isactive, "Toggle successful");
}

