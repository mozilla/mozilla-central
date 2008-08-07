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
# The Original Code is the Bugzilla Test Runner System.
#
# The Initial Developer of the Original Code is Maciej Maczynski.
# Portions created by Maciej Maczynski are Copyright (C) 2001
# Maciej Maczynski. All Rights Reserved.

# Large portions lifted uncerimoniously from Bugzilla::Search.pm
# Which is copyrighted by its respective copyright holders
# Many thanks to the geniouses that contributed to that work of art:
#                 Gervase Markham <gerv@gerv.net>
#                 Terry Weissman <terry@mozilla.org>
#                 Dan Mosedale <dmose@mozilla.org>
#                 Stephan Niemz <st.n@gmx.net>
#                 Andreas Franke <afranke@mathweb.org>
#                 Myk Melez <myk@mozilla.org>
#                 Michael Schindler <michael@compressconsult.com>
#                 Max Kanat-Alexander <mkanat@bugzilla.org>
#
# Contributor(s): Greg Hendricks <ghendricks@novell.com>

=head1 NAME

Bugzilla::Testopia::Search - A module to support searches in Testopis

=head1 DESCRIPTION

Testopia::Search is based heavilly on Bugzilla::Search. It takes a 
CGI instance and parses its parameters to generate an SQL query that
can be used to get a result set from the database. The query is 
usually passed to Table.pm to execute and display the results.
Search.pm supports searching for all major objects in the Testopia
database, Cases, Plans, Runs and Case-runs. It supports sorting
on one column at a time in ascending order.

=head1 SYNOPSIS

 $search = Bugzilla::Testopia::Search($cgi);

=cut

package Bugzilla::Testopia::Search;

use strict;

use Bugzilla::Util;
use Bugzilla::User;
use Bugzilla::Config;
use Bugzilla::Error;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestCase;

use Date::Format;
use Date::Parse;
use Data::Dumper;

sub new {
    my $invocant = shift;
    my $class = ref($invocant) || $invocant;
  
    my $self = {};
    bless($self, $class);

    $self->init(@_);
 
    return $self;
}

sub init {
    my $self = shift;
    my $cgi = shift;
    my $fields = shift;
    my $user = $self->{'user'} || Bugzilla->user;
    $self->{'cgi'} = $cgi;
    $self->{'fields'} = $fields if $fields;
    my $debug = $cgi->param('debug') || 0;
    my $dbh = Bugzilla->dbh;
    print $cgi->header if $debug;
    if ($debug && !$cgi->{'final_separator'}){
        print "<h3>URL Params</h3>";
        print '<p>', join('<br>', split('&', $cgi->canonicalise_query)), "</p>";
    }
    my $page = $cgi->param('page') || 0;
    my $start = $cgi->param('start') || 0;
    my $limit = $cgi->param('limit') || 25;
    detaint_natural($page) if $page;
    detaint_natural($start) if $start;
    detaint_natural($limit) if $limit;
    if ($cgi->param('viewall')){
        $page = undef;
        $start = undef; 
    }
    my $pagesize;
    if ($cgi->param('pagesize') || $cgi->param('page')){
         $pagesize = $cgi->param('pagesize');
         $start = undef;
    }
    detaint_natural($pagesize) if defined $pagesize;
    $pagesize ||= 25;
    my $sortdir; 
    if ($cgi->param('dir')){
        $sortdir = $cgi->param('dir') eq 'ASC' ? 'ASC' : 'DESC';
    } 
    
    my $distinct = $cgi->param('distinct') ? 'DISTINCT' : '';
    
    my @specialchart;
    my @supptables;
    my @wherepart;
    my @having;
    my @groupby;
    my @andlist;
    my @orderby;
    my @inputorder;
    my @fields;
    my %specialorderjoin;
    my %chartfields;
    #my ($testergroup) = $dbh->selectrow_array("SELECT id FROM groups WHERE name = ?",undef, 'Testers');

# $chartid is the number of the current chart whose SQL we're constructing
# $row is the current row of the current chart

# names for table aliases are constructed using $chartid and $row
#   SELECT blah  FROM $table "$table_$chartid_$row" WHERE ....

# $f  = field of table in bug db (e.g. bug_id, reporter, etc)
# $ff = qualified field name (field name prefixed by table)
#       e.g. bugs_activity.bug_id
# $t  = type of query. e.g. "equal to", "changed after", case sensitive substr"
# $v  = value - value the user typed in to the form
# $q  = sanitized version of user input (SqlQuote($v))
# @supptables = Tables and/or table aliases used in query
# %suppseen   = A hash used to store all the tables in supptables to weed
#               out duplicates.
# @supplist   = A list used to accumulate all the JOIN clauses for each
#               chart to merge the ON sections of each.
# $suppstring = String which is pasted into query containing all table names    
    my $chartid;
    my $sequence = 0;
    my $f;
    my $ff;
    my $t;
    my $q;
    my $v;
    my $term;
    my %funcsbykey;
    my $type;
    
    my $obj = trim($cgi->param('current_tab')) || ThrowUserError('testopia-missing-parameter', {'param' => 'current_tab'});
    ThrowUserError('testopia-unknown-tab', {tab => $obj}) if $obj !~ '^(case|plan|run|case_run|environment)$';
    trick_taint($obj);
    
    # If what we intend to do is generate a report, we need some tables
    # to map names to ids
    if ($fields){
        ## Cases ##
        if (grep(/map_categories/, @$fields)) {
            push @supptables, "INNER JOIN test_case_categories AS map_categories " .
                              "ON test_cases.category_id = map_categories.category_id";
        }
        if (grep(/map_priority/, @$fields)) {
            push @supptables, "INNER JOIN priority AS map_priority " .
                              "ON test_cases.priority_id = map_priority.id";
        }
        if (grep(/map_case_status/, @$fields)) {
            push @supptables, "INNER JOIN test_case_status AS map_case_status " .
                              "ON test_cases.case_status_id = map_case_status.case_status_id";
        }
        if (grep(/map_case_components/, @$fields)) {
            push @supptables, "INNER JOIN test_case_components AS tccomps " .
                              "ON test_cases.case_id = tccomps.case_id";
            push @supptables, "INNER JOIN components AS map_case_components " .
                              "ON tccomps.component_id = map_case_components.id";
        }
        if (grep(/map_case_product/, @$fields)) {
            push(@supptables, "INNER JOIN test_case_plans AS map_case_plans " .
                              "ON test_cases.case_id = map_case_plans.case_id");
            push(@supptables, "INNER JOIN test_plans AS map_product_plans " .
                              "ON map_case_plans.plan_id = map_product_plans.plan_id");
            push(@supptables, "INNER JOIN products AS map_case_product " .
                              "ON map_product_plans.product_id = map_case_product.id");
        }
        if (grep(/map_case_tags/, @$fields)) {
            push @supptables, "INNER JOIN test_case_tags AS tctags " .
                              "ON test_cases.case_id = tctags.case_id";
            push @supptables, "INNER JOIN test_tags AS map_case_tags " .
                              "ON tctags.tag_id = map_case_tags.tag_id";
        }
        if (grep(/map_case_author/, @$fields)) {
            push @supptables, "INNER JOIN profiles AS map_case_author " .
                              "ON test_cases.author_id = map_case_author.userid";
        }
        if (grep(/map_default_tester/, @$fields)) {
            push @supptables, "INNER JOIN profiles AS map_default_tester " .
                              "ON test_cases.default_tester_id = map_default_tester.userid";
        }
        ## Runs ##
            
        if (grep(/map_run_product/, @$fields)) {
            push @supptables, "INNER JOIN test_plans " .
                              "ON test_runs.plan_id = test_plans.plan_id";
            push @supptables, "INNER JOIN products AS map_run_product " .
                              "ON test_plans.product_id = map_run_product.id";
        }
        if (grep(/map_run_build/, @$fields)) {
            push @supptables, "INNER JOIN test_builds AS map_run_build " .
                              "ON test_runs.build_id = map_run_build.build_id";
        }
        if (grep(/map_run_milestone/, @$fields)) {
            push @supptables, "INNER JOIN test_builds AS map_run_milestone " .
                              "ON test_runs.build_id = map_run_milestone.build_id";
        }
        if (grep(/map_run_environment/, @$fields)) {
            push @supptables, "INNER JOIN test_environments AS map_run_environment " .
                              "ON test_runs.environment_id = map_run_environment.environment_id";
        }
        if (grep(/map_run_tags/, @$fields)) {
            push @supptables, "INNER JOIN test_run_tags " .
                              "ON test_runs.run_id = test_run_tags.run_id";
            push @supptables, "INNER JOIN test_tags AS map_run_tags " .
                              "ON test_run_tags.tag_id = map_run_tags.tag_id";
        }
        if (grep(/map_run_manager/, @$fields)) {
            push @supptables, "INNER JOIN profiles AS map_run_manager " .
                              "ON test_runs.manager_id = map_run_manager.userid";
        }

        ## Plans ##
        if (grep(/map_plan_type/, @$fields)) {
            push @supptables, "INNER JOIN test_plan_types AS map_plan_type " .
                              "ON test_plans.type_id = map_plan_type.type_id";
        }
        if (grep(/map_plan_product/, @$fields)) {
            push @supptables, "INNER JOIN products AS map_plan_product " .
                              "ON test_plans.product_id = map_plan_product.id";
        }
        if (grep(/map_plan_tags/, @$fields)) {
            push @supptables, "INNER JOIN test_plan_tags " .
                              "ON test_plans.plan_id = test_plan_tags.plan_id";
            push @supptables, "INNER JOIN test_tags AS map_plan_tags " .
                              "ON test_plan_tags.tag_id = map_plan_tags.tag_id";
        }
        if (grep(/map_plan_author/, @$fields)) {
            push @supptables, "INNER JOIN profiles AS map_plan_author " .
                              "ON test_plans.author_id = map_plan_author.userid";
        }
        ## Case-runs ##
        if (grep(/map_caserun_assignee/, @$fields)) {
            push @supptables, "INNER JOIN profiles AS map_caserun_assignee " .
                              "ON test_case_runs.assignee = map_caserun_assignee.userid";
        }
        if (grep(/map_caserun_testedby/, @$fields)) {
            push @supptables, "INNER JOIN profiles AS map_caserun_testedby " .
                              "ON test_case_runs.testedby = map_caserun_testedby.userid";
        }
        if (grep(/map_caserun_build/, @$fields)) {
            push @supptables, "INNER JOIN test_builds AS map_caserun_build " .
                              "ON test_case_runs.build_id = map_caserun_build.build_id";
        }
        if (grep(/map_caserun_environment/, @$fields)) {
            push @supptables, "INNER JOIN test_environments AS map_caserun_environment " .
                              "ON test_case_runs.environment_id = map_caserun_environment.environment_id";
        }
        if (grep(/map_caserun_status/, @$fields)) {
            push @supptables, "INNER JOIN test_case_run_status AS map_caserun_status " .
                              "ON test_case_runs.case_run_status_id = map_caserun_status.case_run_status_id";
        }
        if (grep(/map_caserun_milestone/, @$fields)) {
            push @supptables, "INNER JOIN test_builds AS map_caserun_milestone " .
                              "ON test_case_runs.build_id = map_caserun_milestone.build_id";
        }
        if (grep(/map_caserun_case_tags/, @$fields)) {
            push @supptables, "INNER JOIN test_case_tags AS tctags " .
                              "ON test_case_runs.case_id = tctags.case_id";
            push @supptables, "INNER JOIN test_tags AS map_caserun_case_tags " .
                              "ON tctags.tag_id = map_caserun_case_tags.tag_id";
        }
        if (grep(/map_caserun_run_tags/, @$fields)) {
            push @supptables, "INNER JOIN test_run_tags " .
                              "ON test_case_runs.run_id = test_run_tags.run_id";
            push @supptables, "INNER JOIN test_tags AS map_caserun_run_tags " .
                              "ON test_run_tags.tag_id = map_caserun_run_tags.tag_id";
        }
        if (grep(/map_caserun_cases/, @$fields)) {
            push @supptables, "INNER JOIN test_cases AS map_caserun_cases " .
                              "ON test_case_runs.case_id = map_caserun_cases.case_id";
        }
        if (grep(/map_caserun_priority/, @$fields)) {
            push @supptables, "INNER JOIN test_cases AS map_caserun_cases " .
                              "ON test_case_runs.case_id = map_caserun_cases.case_id";
            push @supptables, "INNER JOIN priority AS map_caserun_priority " .
                              "ON map_caserun_cases.priority_id = map_caserun_priority.id";
        }
        if (grep(/map_caserun_default_tester/, @$fields)) {
            push @supptables, "INNER JOIN test_cases AS map_caserun_cases " .
                              "ON test_case_runs.case_id = map_caserun_cases.case_id";
            push @supptables, "INNER JOIN profiles AS map_caserun_default_tester " .
                              "ON map_caserun_cases.default_tester_id = map_caserun_default_tester.userid";
        }
        if (grep(/map_caserun_category/, @$fields)) {
            push @supptables, "INNER JOIN test_cases AS map_caserun_cases " .
                              "ON test_case_runs.case_id = map_caserun_cases.case_id";
            push @supptables, "INNER JOIN test_case_categories AS map_caserun_category " .
                              "ON map_caserun_cases.category_id = map_caserun_category.category_id";
        }
        if (grep(/map_caserun_components/, @$fields)) {
            push @supptables, "INNER JOIN test_cases AS map_caserun_cases " .
                              "ON test_case_runs.case_id = map_caserun_cases.case_id";
            push @supptables, "INNER JOIN test_case_components AS case_components " .
                              "ON map_caserun_cases.case_id = case_components.case_id";
            push @supptables, "INNER JOIN components AS map_caserun_components " .
                              "ON case_components.component_id = map_caserun_components.id";
        }
        
    }
    # Set up tables for access control
    unless (Bugzilla->user->in_group('Testers')){
        if ($obj eq 'case'){
           push(@supptables, "INNER JOIN test_case_plans AS case_plans " .
                  "ON test_cases.case_id = case_plans.case_id");
           push(@supptables, "INNER JOIN test_plans " .
                  "ON case_plans.plan_id = test_plans.plan_id");    }
        elsif ($obj eq 'case_run'){
           push(@supptables, "INNER JOIN test_runs " .
                  "ON test_case_runs.run_id = test_runs.run_id");
           push(@supptables, "INNER JOIN test_plans " .
                  "ON test_runs.plan_id = test_plans.plan_id");
        }
        elsif ($obj eq 'run'){
           push(@supptables,  "INNER JOIN test_plans " .
                  "ON test_runs.plan_id = test_plans.plan_id");
        }
        unless ($obj eq 'environment'){
            push @supptables, "INNER JOIN test_plan_permissions ON test_plans.plan_id = test_plan_permissions.plan_id";
            push @wherepart, "test_plan_permissions.permissions > 0 AND test_plan_permissions.userid = ". Bugzilla->user->id;
        } 
    }
    # Set up tables for field sort order
    my $order = $cgi->param('order') || '';
    if ($order eq 'author') {        
        push @supptables, "INNER JOIN profiles as map_author ON map_author.userid = test_". $obj ."s.author_id";
        push @orderby, 'map_author.login_name';
    }
    elsif ($order eq 'manager') {        
        push @supptables, "INNER JOIN profiles as map_manager ON map_manager.userid = test_". $obj ."s.manager_id";
        push @orderby, 'map_manager.login_name';
    }
    elsif ($order eq 'assignee') {        
        push @supptables, "LEFT JOIN profiles as map_assignee ON map_assignee.userid = test_". $obj ."s.assignee";
        push @orderby, 'map_assignee.login_name';
    }
    elsif ($order eq 'testedby') {        
        push @supptables, "LEFT JOIN profiles as map_testedby ON map_testedby.userid = test_". $obj ."s.testedby";
        push @orderby, 'map_testedby.login_name';
    }
    elsif ($order eq 'tester') {        
        push @supptables, "LEFT JOIN profiles as map_tester ON map_tester.userid = test_". $obj ."s.default_tester_id";
        push @orderby, 'map_tester.login_name';
    }
    elsif ($order eq 'product') {        
        push @supptables, "LEFT JOIN products ON products.id = test_". $obj ."s.product_id";
        push @orderby, 'products.name';
    }
    elsif ($order eq 'build') {        
        push @supptables, "INNER JOIN test_builds AS build ON build.build_id = test_". $obj ."s.build_id";
        push @orderby, 'build.name';
    }
    elsif ($order eq 'environment') {        
        push @supptables, "INNER JOIN test_environments AS env ON env.environment_id = test_". $obj ."s.environment_id";
        push @orderby, 'env.name';
    }
    elsif ($order eq 'plan_type') {        
        push @supptables, "INNER JOIN test_plan_types AS ptype ON ptype.type_id = test_plans.type_id";
        push @orderby, 'ptype.name';
    }
    elsif ($order eq 'plan_prodver') {        
        push @supptables, "INNER JOIN versions ON versions.value = test_plans.default_product_version";
        push @orderby, 'versions.value';
    }
    elsif($order eq 'plan_id' && $obj eq 'case_run'){
        push @supptables, "INNER JOIN test_case_plans AS case_plans ON test_cases.case_id = case_plans.case_id";
        push @orderby, 'case_plans.plan_id';
    }
    elsif($order eq 'requirement' && $obj eq 'case_run'){
        push @supptables, "INNER JOIN test_cases ON test_cases.case_id = test_case_runs.case_id";
        push @orderby, 'test_cases.requirement';
    }
    elsif ($order eq 'priority') {
        if ($obj eq 'case_run'){
            push @supptables, "INNER JOIN test_cases ON test_cases.case_id = test_case_runs.case_id";
        }
        push @supptables, "INNER JOIN priority ON priority.id = test_cases.priority_id";
        push @orderby, 'test_cases.priority_id';
    }
    elsif ($order eq 'build') {
        push @supptables, "INNER JOIN test_builds ON test_builds.build_id = test_case_runs.build_id";
        push @orderby, 'test_builds.name';
    }
    elsif ($order eq 'status') {
        if ($obj eq 'case_run'){
            push @supptables, "INNER JOIN test_case_run_status as case_run_status ON case_run_status.case_run_status_id = test_case_runs.case_run_status_id";
            push @orderby, 'case_run_status.sortkey';
        }
        elsif ($obj eq 'case'){
            push @supptables, "INNER JOIN test_case_status AS case_status ON test_cases.case_status_id = case_status.case_status_id";
            push @orderby, 'case_status.name';
        }
        elsif ($obj eq 'run'){
            push @orderby, 'test_runs.stop_date';
        }
    }
    elsif ($order eq 'category') {
        if ($obj eq 'case_run'){
            push @supptables, "INNER JOIN test_cases ON test_cases.case_id = test_case_runs.case_id";
        }
        push @supptables, "INNER JOIN test_case_categories AS categories ON test_cases.category_id = categories.category_id";
        push @orderby, 'categories.name';
    }
    elsif ($order eq 'component') {
        if ($obj eq 'case_run'){
            push @supptables, "INNER JOIN test_cases ON test_cases.case_id = test_case_runs.case_id";
        }
        push @supptables, "INNER JOIN test_case_components ON test_cases.case_id = test_case_components.case_id";
        push @supptables, "LEFT JOIN components ON components.id = test_case_components.component_id";
        push @orderby, 'components.name';
    }
    elsif ($order eq 'summary') {
        if ($obj eq 'case_run'){
            push @supptables, "INNER JOIN test_cases AS cases ON cases.case_id = test_case_runs.case_id";
            push @orderby, 'cases.summary';
        }
        else{            
            push @orderby, 'test_'. $obj .'s.summary';
        }
    }
    elsif ($order eq 'created') {
        push @orderby, 'test_'. $obj .'s.creation_date';
    }
    elsif ($order eq 'name') {
        push @orderby, 'test_'. $obj .'s.name';
    }
    else{
        if ($order){
            trick_taint($order) if ($order);
            push @orderby, 'test_'. $obj .'s.' . $order;
        }
    }
    
    my @funcdefs =
    (
         "^category," => sub {
               if ($obj eq 'case_run'){
                   push(@supptables,
                          "INNER JOIN test_cases " .
                          "ON test_case_runs.case_id = test_cases.case_id");
               }                   
               push(@supptables,
                      "INNER JOIN test_case_categories AS categories " .
                      "ON test_cases.category_id = categories.category_id");
               $f = "categories.name";
         },
         "^category_id," => sub {
               if ($obj eq 'case_run'){
                   push(@supptables,
                          "INNER JOIN test_cases " .
                          "ON test_case_runs.case_id = test_cases.case_id");
               }                   
               
               $f = "test_cases.category_id";
         },
         "^build," => sub {
               my $str = '';
               $str = 'case_' if ($obj eq 'case_run');
               push(@supptables,
                      "INNER JOIN test_builds AS builds " .
                      "ON test_". $str ."runs.build_id = builds.build_id");
               $f = "builds.name";
         },
         "^(tcaction|tceffect)," => sub {
               push(@supptables,
                      "LEFT JOIN test_case_texts AS case_texts " .
                      "ON test_cases.case_id = case_texts.case_id");
               my $fid = ($1 eq 'tcaction' ? 'action' : 'effect');
               $f = "case_texts.$fid";
         },
         "^plan_text," => sub {
               push(@supptables,
                      "LEFT JOIN test_plan_texts AS plan_texts " .
                      "ON test_plans.plan_id = plan_texts.plan_id");
               $f = "plan_texts.plan_text";
         },
         "^prod_name," => sub {
               push(@supptables,
                    "INNER JOIN products ".
                    "ON test_". $obj ."s.product_id = products.id");
               $f = 'products.name';
         },
         "^case_status," => sub {
               push(@supptables,
                    "INNER JOIN test_case_status AS case_status " . 
                    "ON test_cases.case_status_id = case_status.case_status_id");
               $f = 'case_status.name';      
         },
         "^priority," => sub {
             if ($obj eq 'case_run'){
                    push(@supptables,
                        "INNER JOIN test_cases 
                         ON test_cases.case_id = test_case_runs.case_id");
               }
               push(@supptables,
                    "INNER JOIN priority ".
                    "ON test_cases.priority_id = priority.id");
               $f = 'priority.value';      
         },
         "^environment," => sub {
               push(@supptables,
                    "INNER JOIN test_environments ".
                    "ON test_". $obj ."s.environment_id = test_environments.environment_id");
               $f = 'test_environments.name';      
         },
         "^environment_name," => sub {
               push(@supptables,
                    "INNER JOIN test_environments ".
                    "ON test_". $obj ."s.environment_id = test_environments.environment_id");
               $f = 'test_environments.name';      
         },
         "^plan_type," => sub {
               push(@supptables,
                    "INNER JOIN test_plan_types ".
                    "ON test_plans.type_id = test_plan_types.type_id");
               $f = 'test_plan_types.name';      
         },
         "^plan_perms," => sub {
               push(@supptables,
                    "INNER JOIN test_plan_permissions ".
                    "ON test_plans.plan_id = test_plan_permissions.plan_id");
               if ($cgi->param('case_plans_tester')){
                   $f = 'test_plan_permissions.userid';
               }
               else {
                   $f = 'test_plan_permissions.permissions';
               }
         },
         "^case_run_status," => sub {
             if ($obj eq 'case'){
               push(@supptables,
                    "INNER JOIN test_case_run_status AS tcrs ".
                    "ON case_runs.case_run_status_id = tcrs.case_run_status_id");
             }
             else {
               push(@supptables,
                    "INNER JOIN test_case_run_status AS tcrs ".
                    "ON test_case_runs.case_run_status_id = tcrs.case_run_status_id");
             }
               $f = 'tcrs.name';      
         },
         "^env_products," => sub {
               push(@supptables,
                    "INNER JOIN products as env_products
                     ON test_environments.product_id = env_products.id");
               $f = 'env_products.id'      
         },
         "^env_.*," => sub {
             if ($obj eq 'run'){
                 push(@supptables,
                    "INNER JOIN test_environment_map
                     ON test_runs.environment_id = test_environment_map.environment_id");
             }
             elsif ($obj eq 'case_run'){
                 push(@supptables,
                    "INNER JOIN test_environment_map
                     ON test_case_runs.environment_id = test_environment_map.environment_id");                 
             }
         },
         "^env_category," => sub {
               push(@supptables,
                    "INNER JOIN test_environment_element
                     ON test_environment_map.element_id = test_environment_element.element_id");
               push(@supptables,
                    "INNER JOIN test_environment_category
                     ON test_environment_element.env_category_id = test_environment_category.env_category_id");
               $f = 'test_environment_category.name'      
         },
         "^env_element," => sub {
               push(@supptables,
                    "INNER JOIN test_environment_element as env_element
                     ON test_environment_map.element_id = env_element.element_id");
               $f = 'env_element.name'      
         },
         "^env_property," => sub {
               push(@supptables,
                    "INNER JOIN test_environment_property as env_property
                     ON test_environment_map.property_id = env_property.property_id");
               $f = 'env_property.name'      
         },
         "^env_value," => sub {
               $f = 'test_environment_map.value_selected'      
         },
         "^env_value_selected," => sub {
               push(@supptables,
                    "INNER JOIN test_environment_map as env_map_value_selected
                     ON test_environments.environment_id = env_map_value_selected.environment_id");
               $f = 'env_map_value_selected.value_selected'      
         },
         "^component," => sub {
               if ($obj eq 'case_run'){
                    push(@supptables,
                        "INNER JOIN test_cases 
                         ON test_cases.case_id = test_case_runs.case_id");
               }
               push(@supptables,
                      "INNER JOIN test_case_components AS tc_components " .
                      "ON test_cases.case_id = tc_components.case_id");
               push(@supptables,
                      "INNER JOIN components ".
                      "ON components.id = tc_components.component_id");
               $f = "components.name";
         },
         "^priority_id," => sub {
               if ($obj eq 'case_run'){
                    push(@supptables,
                        "INNER JOIN test_cases 
                         ON test_cases.case_id = test_case_runs.case_id");
               }
               $f = "test_cases.priority_id";
         },
         "^isautomated," => sub {
               if ($obj eq 'case_run'){
                    push(@supptables,
                        "INNER JOIN test_cases 
                         ON test_cases.case_id = test_case_runs.case_id");
               }
               $f = "test_cases.isautomated";
         },
         "^milestone," => sub {
               push(@supptables,
                      "INNER JOIN test_builds AS builds " .
                      "ON test_runs.build_id = builds.build_id");
               push(@supptables,
                      "INNER JOIN milestones ".
                      "ON milestones.value = builds.milestone");
               $f = "milestones.value";
         },
         "^(?:assigned_to|reporter|qa_contact|bug.*)," => sub {
             if ($obj eq 'case_run'){
               push(@supptables,
                      "INNER JOIN test_case_bugs AS case_bugs " .
                      "ON test_case_runs.case_run_id = case_bugs.case_run_id");
               push(@supptables,
                      "INNER JOIN bugs ".
                      "ON case_bugs.bug_id = bugs.bug_id");
             }
             elsif($obj eq 'case'){
               push(@supptables,
                      "INNER JOIN test_case_bugs AS case_bugs " .
                      "ON test_cases.case_id = case_bugs.case_id");
               push(@supptables,
                      "INNER JOIN bugs ".
                      "ON case_bugs.bug_id = bugs.bug_id");
             }
             push(@supptables,
                  "INNER JOIN bugs " .
                  "ON case_bugs.bug_id = bugs.bug_id");
         },
         "^bug," => sub {
               $f = "bugs.bug_id";
         },
         "^bug_status," => sub {
               $f = "bugs.bug_status";
         },
         "^bug_resolution," => sub {
               $f = "bugs.resolution";
         },
         "^bug_priority," => sub {
               $f = "bugs.priority";
         },"^bug_op_sys," => sub {
               $f = "bugs.op_sys";
         },
         "^bug_severity," => sub {
               $f = "bugs.bug_severity";
         },
         "^bug_rep_platform," => sub {
               $f = "bugs.rep_platform";
         },
         "^bug_short_desc," => sub {
               $f = "bugs.short_desc";
         },
         "^bug_file_loc," => sub {
               $f = "bugs.bug_file_loc";
         },
         "^bug_status_whiteboard," => sub {
               $f = "bugs.status_whiteboard";
         },
         "^bug_long_desc," => sub {
             my $table = "longdescs";
             my $extra = "";
             if (Bugzilla->params->{"insidergroup"} 
                 && !Bugzilla->user->in_group(Bugzilla->params->{"insidergroup"})) 
             {
                 $extra = "AND $table.isprivate < 1";
             }
             push(@supptables, "INNER JOIN longdescs AS $table " .
                               "ON $table.bug_id = bugs.bug_id $extra");
             $f = "$table.thetext";
         },
         "^bug_keywords," => sub {
             my @list;
             my $table = "keywords";
             foreach my $value (split(/[\s,]+/, $v)) {
                 if ($value eq '') {
                     next;
                 }
                 my $keyword = new Bugzilla::Keyword({name => $value});
                 if ($keyword) {
                     push(@list, "$table.keywordid = " . $keyword->id);
                 }
                 else {
                     ThrowUserError("unknown_keyword",
                                    { keyword => $v });
                 }
             }
             my $haveawordterm;
             if (@list) {
                 $haveawordterm = "(" . join(' OR ', @list) . ")";
                 if ($t eq "anywords") {
                     $term = $haveawordterm;
                 } elsif ($t eq "allwords") {
                     my $ref = $funcsbykey{",$t"};
                     &$ref;
                     if ($term && $haveawordterm) {
                         $term = "(($term) AND $haveawordterm)";
                     }
                 }
             }
             if ($term) {
                 push(@supptables, "LEFT JOIN keywords AS $table " .
                                   "ON $table.bug_id = bugs.bug_id");
             }
             $f = "bugs.keywords";
         },
         "^(?:assigned_to|reporter|qa_contact)," => sub {
             push(@supptables, "INNER JOIN profiles AS map_$f " .
                                   "ON bugs.$f = map_$f.userid");
                 $f = "map_$f.login_name";
         },
         "^case_summary," => sub {
               push(@supptables,
                      "INNER JOIN test_cases AS cases " .
                      "ON cases.case_id = test_case_runs.case_id");
               $f = "cases.summary";
         },
         
         "^tags," => sub {
             if ($t !~ 'notag'){
               if ($obj eq 'case_run'){
                   push(@supptables,
                      "INNER JOIN test_cases " .
                      "ON test_case_runs.case_id = test_cases.case_id");
                   push(@supptables,
                      "INNER JOIN test_case_tags  AS case_tags " .
                      "ON test_cases.case_id = case_tags.case_id");
                   push(@supptables,
                       "INNER JOIN test_tags " .
                       "ON case_tags.tag_id = test_tags.tag_id");
               }
               else{
                   push(@supptables,
                          "INNER JOIN test_". $obj ."_tags  AS ". $obj ."_tags " .
                          "ON test_". $obj ."s.". $obj ."_id = ". $obj ."_tags.". $obj ."_id");
                   push(@supptables,
                          "INNER JOIN test_tags " .
                          "ON ". $obj ."_tags.tag_id = test_tags.tag_id");
                   }
             }
             $f = "test_tags.tag_name";
         },
         "^requirement," => sub {
             if ($obj eq 'case_run'){
                   push(@supptables,
                      "INNER JOIN test_cases " .
                      "ON test_case_runs.case_id = test_cases.case_id");
             }
             $f = "test_cases.requirement"; 
         },
         "^case_plan_id," => sub {
               if ($cgi->param('case_plans_tester')){
                   my $join = $cgi->param('case_plans_tester') ? 'LEFT' : 'INNER';
                   push(@supptables,
                      "$join JOIN test_case_plans AS case_plans_tester " .
                      "ON test_plans.plan_id = case_plans_tester.plan_id");
                   push(@supptables,
                      "$join JOIN test_cases " .
                      "ON case_plans_tester.case_id = test_cases.case_id");
                   push(@supptables,
                      "$join JOIN profiles as map_plan_testers " .
                      "ON test_cases.default_tester_id = map_plan_testers.userid");
                   $f = "map_plan_testers.login_name";
               }
               else {
                   push(@supptables,
                          "INNER JOIN test_case_plans AS case_plans " .
                          "ON test_cases.case_id = case_plans.case_id");
                   push(@supptables,
                          "INNER JOIN test_plans " .
                          "ON case_plans.plan_id = test_plans.plan_id");
                   $f = "test_plans.plan_id";
               }
         },
         "^plan_case_id," => sub {
               push(@supptables,
                      "INNER JOIN test_case_plans AS case_plans " .
                      "ON test_plans.plan_id = case_plans.plan_id");
               push(@supptables,
                      "INNER JOIN test_cases " .
                      "ON case_plans.case_id = test_cases.case_id");
               $f = "test_cases.case_id";
         },
         "^cases_in_runs," => sub {
               push(@supptables,
                      "INNER JOIN test_case_runs AS case_runs " .
                      "ON test_cases.case_id = case_runs.case_id");
               push(@supptables,
                      "INNER JOIN test_runs " .
                      "ON case_runs.run_id = test_runs.run_id");
               $f = "test_runs.run_id";
         },
         "^run_plan_id," => sub {
               $f = "test_runs.plan_id";
         },
         "^run_case_id," => sub {
               push(@supptables,
                      "INNER JOIN test_case_runs AS case_runs " .
                      "ON test_runs.run_id = case_runs.run_id");
               push(@supptables,
                      "INNER JOIN test_cases " .
                      "ON case_runs.case_id = test_cases.case_id");
               $f = "test_cases.case_id";
         },
         "^caserun_plan_id," => sub {
               push(@supptables,
                      "INNER JOIN test_runs " .
                      "ON test_case_runs.run_id = test_runs.run_id");
               push(@supptables,
                      "INNER JOIN test_plans " .
                      "ON test_runs.plan_id = test_plans.plan_id");
               $f = "test_plans.plan_id";
         },
         "^case_prod," => sub {
               push(@supptables,
                      "INNER JOIN test_case_plans AS case_plans " .
                      "ON test_cases.case_id = case_plans.case_id");
               push(@supptables,
                      "INNER JOIN test_plans " .
                      "ON case_plans.plan_id = test_plans.plan_id");
               push(@supptables,
                      "INNER JOIN products " .
                      "ON test_plans.product_id = products.id");
               if ($cgi->param('product_id')){
                   $f = "test_plans.product_id"; 
               }
               else {
                   $f = "products.name";
               }

         },
         "^classification," => sub {
               if ($obj eq 'run'){
                   push(@supptables,
                          "INNER JOIN test_plans " .
                          "ON test_runs.plan_id = test_plans.plan_id");
                   push(@supptables,
                          "INNER JOIN products " .
                          "ON test_plans.product_id = products.id");
               }
               elsif ($obj eq 'case'){
                   push(@supptables,
                          "INNER JOIN test_case_plans AS case_plans " .
                          "ON test_cases.case_id = case_plans.case_id");
                   push(@supptables,
                          "INNER JOIN test_plans " .
                          "ON case_plans.plan_id = test_plans.plan_id");
                   push(@supptables,
                          "INNER JOIN products " .
                          "ON test_plans.product_id = products.id");
               }
               elsif ($obj eq 'case_run'){
                   push(@supptables,
                          "INNER JOIN test_runs " .
                          "ON test_case_runs.run_id = test_runs.run_id");
                   push(@supptables,
                          "INNER JOIN test_plans " .
                          "ON test_runs.plan_id = test_plans.plan_id");
                   push(@supptables,
                          "INNER JOIN products " .
                          "ON test_plans.product_id = products.id");
               }
               elsif ($obj eq 'environment'){
                   push(@supptables,
                        "INNER JOIN products
                         ON test_environments.product_id = products.id");
               }
               else{
                   push(@supptables,
                        "INNER JOIN products ".
                        "ON test_". $obj ."s.product_id = products.id");
               }
               push(@supptables,
                      "INNER JOIN classifications " .
                      "ON products.classification_id = classifications.id");
               $f = "classifications.name";
         },
         "^caserun_prod," => sub {
               push(@supptables,
                      "INNER JOIN test_runs " .
                      "ON test_case_runs.run_id = test_runs.run_id");
               push(@supptables,
                      "INNER JOIN test_plans " .
                      "ON test_runs.plan_id = test_plans.plan_id");
               push(@supptables,
                      "INNER JOIN products " .
                      "ON test_plans.product_id = products.id");
               if ($cgi->param('product_id')){
                   $f = "test_plans.product_id"; 
               }
               else {
                   $f = "products.name";
               }

         },
         "^run_prod," => sub {
               push(@supptables,
                      "INNER JOIN test_plans " .
                      "ON test_runs.plan_id = test_plans.plan_id");
               push(@supptables,
                      "INNER JOIN products " .
                      "ON test_plans.product_id = products.id");
               if ($cgi->param('product_id')){
                   $f = "test_plans.product_id"; 
               }
               else {
                   $f = "products.name";
               }
         },
         "^stop_date," => sub {
            if ($obj eq 'case_run'){
                push(@supptables,
                      "INNER JOIN test_runs " .
                      "ON test_case_runs.run_id = test_runs.run_id");
                $f = "test_runs.stop_date";
            }
         },
         "^run_product_version," => sub {
               push(@supptables,
                      "INNER JOIN test_runs " .
                      "ON test_case_runs.run_id = test_runs.run_id");
               $f = "test_runs.product_version";
         },
         "^(author|manager|default_tester)," => sub {
               push(@supptables,
                      "INNER JOIN profiles AS map_$1 " . 
                      "ON test_". $obj ."s.". $1 ."_id = map_$1.userid");
               $f = "map_$1.login_name"; 
         },
         "^(assignee|testedby)," => sub {
               if ($obj eq 'run'){
                   push(@supptables,
                      "LEFT JOIN test_case_runs AS case_run " . 
                      "ON case_run.run_id = test_runs.run_id");
                   push(@supptables,
                      "LEFT JOIN profiles AS map_$1 " . 
                      "ON case_run.". $1 ." = map_$1.userid");
               }
               else {
                   push(@supptables,
                      "LEFT JOIN profiles AS map_$1 " . 
                      "ON test_". $obj ."s.". $1 ." = map_$1.userid");
               }
               $f = "map_$1.login_name";
               
         },
         ",isnotnull" => sub {
             $term = "$ff is not null";
         },
         ",isnull" => sub {
             $term = "$ff is null";
         },
         ",equals" => sub {
             $term = "$ff = $q";
         },
         ",notequals" => sub {
             $term = "$ff != $q";
         },
         ",casesubstring" => sub {
             $term = $dbh->sql_position($q, $ff) . " > 0";
         },
         ",substring" => sub {
             $term = $dbh->sql_position(lc($q), "LOWER($ff)") . " > 0";
         },
         ",substr" => sub {
             $funcsbykey{",substring"}->();
         },
         ",notsubstring" => sub {
             $term = $dbh->sql_position(lc($q), "LOWER($ff)") . " = 0";
         },
         ",regexp" => sub {
             $term = "$ff " . $dbh->sql_regexp() . " $q";
         },
         ",notregexp" => sub {
             $term = "$ff " . $dbh->sql_not_regexp() . " $q";
         },
         ",lessthan" => sub {
             $term = "$ff < $q";
         },
         ",greaterthan" => sub {
             $term = "$ff > $q";
         },
         ",anyexact" => sub {
             my @list;
             foreach my $w (split(/,/, $v)) {
                 $q = $dbh->quote($w);
                 trick_taint($q);
                 push(@list, $q);
             }
             if (@list) {
                 $term = "$ff IN (" . join (',', @list) . ")";
             }
         },
         ",anywordssubstr" => sub {
             $term = join(" OR ", @{GetByWordListSubstr($ff, $v)});
         },
         ",allwordssubstr" => sub {
             $term = join(" AND ", @{GetByWordListSubstr($ff, $v)});
         },
         ",nowordssubstr" => sub {
             my @list = @{GetByWordListSubstr($ff, $v)};
             if (@list) {
                 $term = "NOT (" . join(" OR ", @list) . ")";
             }
         },
         ",anywords" => sub {
             $term = join(" OR ", @{GetByWordList($ff, $v)});
         },
         ",allwords" => sub {
             $term = join(" AND ", @{GetByWordList($ff, $v)});
         },
         ",nowords" => sub {
             my @list = @{GetByWordList($ff, $v)};
             if (@list) {
                 $term = "NOT (" . join(" OR ", @list) . ")";
             }
         },
         ",notag" => sub {
             $term = "test_". $obj ."s.". $obj ."_id NOT IN (SELECT junc.". $obj ."_id FROM test_". $obj ."_tags AS junc JOIN test_tags AS junc_tags ON junc.tag_id = junc_tags.tag_id WHERE junc_tags.tag_name = " . $q .")";
         },
     );
     
    my $chfieldfrom = trim(lc($cgi->param('chfieldfrom'))) || '';
    my $chfieldto = trim(lc($cgi->param('chfieldto'))) || '';
    $chfieldfrom = '' if ($chfieldfrom eq 'now');
    $chfieldto = '' if ($chfieldto eq 'now');
    my @chfield = $cgi->param('chfield_type');
    my $chvalue = trim($cgi->param('chfieldvalue')) || '';

    if ($chfieldfrom ne '' || $chfieldto ne '') {
        my $sql_chfrom = $chfieldfrom ? $dbh->quote(SqlifyDate($chfieldfrom)):'';
        my $sql_chto   = $chfieldto   ? $dbh->quote(SqlifyDate($chfieldto))  :'';
        my $sql_chvalue = $chvalue ne '' ? $dbh->quote($chvalue) : '';
        trick_taint($sql_chvalue);
        if(!@chfield) {
            push(@supptables,
              "INNER JOIN test_" . $obj ."_activity " . 
              "ON test_". $obj ."s.". $obj ."_id = test_" . $obj ."_activity." . $obj ."_id");
            push(@wherepart, "test_" . $obj ."_activity.changed >= $sql_chfrom") if ($sql_chfrom);
            push(@wherepart, "test_" . $obj ."_activity.changed <= $sql_chto") if ($sql_chto);
        } else {
            my $bug_creation_clause;
            my @list;
            my @actlist;
            foreach my $f (@chfield) {
                if ($f eq "[Creation]") {
                    my @l;
                    if ($obj eq 'run'){
                        push(@l, "test_" . $obj ."s.start_date >= $sql_chfrom") if($sql_chfrom);
                        push(@l, "test_" . $obj ."s.start_date <= $sql_chto") if($sql_chto);
                    }
                    else{
                        push(@l, "test_" . $obj ."s.creation_date >= $sql_chfrom") if($sql_chfrom);
                        push(@l, "test_" . $obj ."s.creation_date <= $sql_chto") if($sql_chto);
                    }
                    $bug_creation_clause = "(" . join(' AND ', @l) . ")";
                }
                elsif ($f eq "text"){
                    push(@supptables,
                      "INNER JOIN test_" . $obj ."_texts " . 
                      "ON test_". $obj ."s.". $obj ."_id = test_" . $obj ."_texts." . $obj ."_id");
                    push(@wherepart, "test_" . $obj ."_texts.creation_ts >= $sql_chfrom") if ($sql_chfrom);
                    push(@wherepart, "test_" . $obj ."_texts.creation_ts <= $sql_chto") if ($sql_chto);
                    
                } 
                else {
                    push(@actlist, $f);
                }
            }

            # @actlist won't have any elements if the only field being searched
            # is [Bug creation] (in which case we don't need bugs_activity).
            if(@actlist) {
                my $extra = " actcheck." . $obj . "_id = test_" . $obj ."s." . $obj . "_id";
                push(@list, "(actcheck.changed IS NOT NULL)");
                if($sql_chfrom) {
                    $extra .= " AND actcheck.changed >= $sql_chfrom";
                }
                if($sql_chto) {
                    $extra .= " AND actcheck.changed <= $sql_chto";
                }
                if($sql_chvalue) {
                    $extra .= " AND actcheck.newvalue = $sql_chvalue";
                }
                push(@supptables, "LEFT JOIN test_" . $obj ."_activity AS actcheck " .
                                  "ON $extra AND actcheck.fieldid IN (" .
                                  join(",", @actlist) . ")");
            }

            # Now that we're done using @list to determine if there are any
            # regular fields to search (and thus we need bugs_activity),
            # add the [Bug creation] criterion to the list so we can OR it
            # together with the others.
            push(@list, $bug_creation_clause) if $bug_creation_clause;

            push(@wherepart, "(" . join(" OR ", @list) . ")") if scalar @list;
        }
    }
    if ($cgi->param('permuser')) {
        my $permuser = login_to_id($cgi->param('permuser'), "BARF");
        my $perm = $cgi->param('permission');
        detaint_natural($permuser);
        push(@wherepart, "test_plan_permissions.userid = $permuser");
        push(@specialchart, ["plan_perms", 'equals', $perm]);
    }
    if ($cgi->param('bug_keywords')) {
        my $t = $cgi->param('bug_keywords_type');
        if (!$t || $t eq "or") {
            $t = "anywords";
        }
        push(@specialchart, ["bug_keywords", $t, $cgi->param('keywords')]);
    }
    if ($cgi->param('case_id')) {
        my $type = "anyexact";
        if ($cgi->param('caseidtype'))
        {
            if ($cgi->param('caseidtype') eq 'exclude') 
            {
                $type = "nowords";
            }
            else
            {
                $type = $cgi->param('caseidtype')
            } 
        }
        if ($obj eq 'run'){
            push(@specialchart, ["run_case_id", $type, join(',', $cgi->param('case_id'))]);
        }
        elsif ($obj eq 'plan'){
            push(@specialchart, ["plan_case_id", $type, join(',', $cgi->param('case_id'))]);
        }
        else{
            push(@specialchart, ["case_id", $type, join(',', $cgi->param('case_id'))]);
        }
    }
    if ($cgi->param('run_id')) {
        my $type = "anyexact";
        if ($cgi->param('runidtype'))
        {
            if ($cgi->param('runidtype') eq 'exclude') 
            {
                $type = "nowords";
            }
            else
            {
                $type = $cgi->param('runidtype')
            } 
        }
        if ($obj eq 'case'){
            push(@specialchart, ["cases_in_runs", $type, join(',', $cgi->param('run_id'))]);
        }
        else {
            push(@specialchart, ["run_id", $type, join(',', $cgi->param('run_id'))]);
        }
    }
    if ($cgi->param('plan_id')) {
        my $type = "anyexact";
        if ($cgi->param('planidtype'))
        {
            if ($cgi->param('planidtype') eq 'exclude') 
            {
                $type = "nowords";
            }
            else
            {
                $type = $cgi->param('planidtype')
            } 
        }
        if ($obj eq 'case'){
            push(@specialchart, ["case_plan_id", $type, join(',', $cgi->param('plan_id'))]);
            if ($cgi->param('exclude')){
                my @runs = split(/,/, $cgi->param('exclude'));
                foreach (@runs){
                    detaint_natural($_);
                }
                my $exclusions = $dbh->selectcol_arrayref('SELECT DISTINCT case_id FROM test_case_runs WHERE run_id IN ('. join(',', @runs) .')');
                push @wherepart, 'test_cases.case_id NOT IN ('. join(',', @$exclusions) .')' if scalar @$exclusions > 0;
            }
        }
        elsif ($obj eq 'run'){
            push(@specialchart, ["run_plan_id", $type, join(',', $cgi->param('plan_id'))]);
        }
        elsif ($obj eq 'case_run'){
            push(@specialchart, ["caserun_plan_id", $type, join(',', $cgi->param('plan_id'))]);
        }
        else{
            push(@specialchart, ["plan_id", $type, join(',', $cgi->param('plan_id'))]);
        }
    }
    if ($cgi->param('bug_id')) {
        my $type = "anyexact";
        if ($cgi->param('bugidtype') && $cgi->param('bugidtype') eq 'exclude') {
            $type = "nowords";
        }
        push(@specialchart, ["bug", $type, join(',', $cgi->param('bug_id'))]);
    }
    if ($cgi->param("product_id") || $cgi->param("product")){
        my $attribute = $cgi->param("product_id") ? "product_id" : "product";
        my $type = "anyexact";
        if ($cgi->param('prodidtype') && $cgi->param('prodidtype') eq 'exclude') {
            $type = "nowords";
        }
        if ($obj eq 'run'){
            push(@specialchart, ["run_prod", $type, join(',', $cgi->param($attribute))]);
        }
        elsif ($obj eq 'case'){
            push(@specialchart, ["case_prod", $type, join(',', $cgi->param($attribute))]);
        }
        elsif ($obj eq 'case_run'){
            push(@specialchart, ["caserun_prod", $type, join(',', $cgi->param($attribute))]);
        }
        elsif ($obj eq 'environment'){
            push(@specialchart, ["env_products", $type, join(',', $cgi->param($attribute))]);
        }
        else{
            if ($cgi->param("product")){
                push(@specialchart, ["prod_name", $type, join(',', $cgi->param($attribute))]);
            }
            else{
                push(@specialchart, ["product_id", $type, join(',', $cgi->param($attribute))]);
            }
        }
    } 
    my $email = trim($cgi->param("bug_email"));
    my $email_type = $cgi->param("bug_emailtype");
    if ($email_type eq "exact") {
        $email_type = "anyexact";
        foreach my $name (split(',', $email)) {
            $name = trim($name);
            if ($name) {
                login_to_id($name, "BARF");
            }
        }
    }

    my @bug_clist;
    foreach my $field ("assigned_to", "reporter", "cc", "qa_contact", "infoprovider") {
        if ($cgi->param("bug_email$field")) {
            push(@bug_clist, $field, $type, $email);
        }
    }
    if ($cgi->param("bug_emaillongdesc")) {
        push(@bug_clist, "commenter", $type, $email);
    }
    if (@bug_clist) {
        push(@specialchart, \@bug_clist);
    }
           
    # Check the Multi select fields and add them to the chart
    my @legal_fields = ("case_status_id", "category", "category_id", "priority_id",
                        "component", "isautomated", "case_run_status_id",
                        "default_product_version", "run_product_version", "type_id", 
                        "build", "build_id", "environment_id", "milestone", "env_products",
                        "env_categories", "env_elements", "env_properties", 
                        "env_expressions", "case_status", "priority", "environment",
                        "plan_type", "case_run_status", "classification",
                        "bug_severity", "bug_resolution","bug_priority", "bug_status",
                        "bug_rep_platform","bug_os_sys");

    foreach my $field ($cgi->param()) {
        if (lsearch(\@legal_fields, $field) != -1) {
            push(@specialchart, [$field, $cgi->param($field."_type") || "anyexact",
                                 join(',', $cgi->param($field))]);
        }
    }
    # 19.01.2007 - Changed multiselct version fields to 'version'.
    # Changing them above in @legal_fields could break API funtionality
    # So we redifine them here.
    if (defined $cgi->param('version')){
        my $field;
        if ($obj eq 'case_run'){
            $field = 'run_product_version';
        }
        elsif ($obj eq 'run'){
            $field = 'product_version';
        }
        elsif ($obj eq 'plan'){
            $field = 'default_product_version';
        }
        push(@specialchart, [$field, "anyexact", join(',', $cgi->param('version'))]);
    }
    if (defined $cgi->param('run_status')){
        my @sta = $cgi->param('run_status');
        unless (scalar @sta > 1){
            if ($cgi->param('run_status') == 1){
                push(@specialchart, ['stop_date', 'isnotnull', 'null']);
            }
            else {
                push(@specialchart, ['stop_date', 'isnull', 'null']);
            }
        }
    }
    if ($cgi->param('closed_from') || $cgi->param('closed_to')){
        if ($obj eq 'case_run'){
            my $closedfrom = $cgi->param('closed_from');
            my $closedto = $cgi->param('closed_to');
            trick_taint($closedfrom);
            trick_taint($closedto);
            push(@specialchart, ['close_date', 'greaterthan', SqlifyDate($closedfrom)||'']);
            push(@specialchart, ['close_date', 'lessthan', SqlifyDate($closedto)||'']);
        }
    }
    if (defined $cgi->param('close_date')){
        my @sta = $cgi->param('close_date');
        unless (scalar @sta > 1){
            if ($cgi->param('close_date') == 1){
                push(@specialchart, ['close_date', 'isnotnull', 'null']);
            }
            else {
                push(@specialchart, ['close_date', 'isnull', 'null']);
            }
        }
    }
    # Check the tags and add them to the chart
    if ($cgi->param('tags')) {
        my $t = $cgi->param('tags_type');
        if (!$t || $t eq "or") {
            $t = "anywords";
        }
        push(@specialchart, ["tags", $t, $cgi->param('tags')]);
    }
    # Check for author
    my @clist;
    foreach my $profile ("author", "manager", "default_tester", 
                         "assignee", "testedby"){
        $t = $cgi->param($profile . "_type") || '';
        if ($t eq "exact"  || $t eq '') {
            $t = "anyexact";
            if ($cgi->param($profile)){
                foreach my $name (split(',', $cgi->param($profile))) {
                    $name = trim($name);
                    if ($name) {
                        login_to_id($name);
                        trick_taint($name);
                    }
                }
            }
        }
        if ($cgi->param($profile)){
            my $user = trim($cgi->param($profile));
            trick_taint($user);
            if ($cgi->param('andor')){
                push(@specialchart, [$profile, $t, $user]);
            }
            else{
                push(@clist, $profile, $t, $user);
            }
        }
    }
    if (@clist) {
        push(@specialchart, \@clist);
    }
    
    # check static text fields
    foreach my $f ("case_summary", "summary", "tcaction", "tceffect", "script",
                   "requirement", "name", "plan_text", "environment_name",
                   "notes", "env_value_selected","bug_short_desc","bug_long_desc",
                   "bug_file_loc","bug_status_whiteboard","bug_keywords",
                   "env_category","env_element","env_property","env_value",
                   "start_date", "stop_date") {
        if (defined $cgi->param($f)) {
            my $s = trim($cgi->param($f));
            if ($s ne "") {
                trick_taint($s);
                my $type = $cgi->param($f . "_type") || 'allwordssubstr';
                push(@specialchart, [$f, $type, $s]);
            }
        }
    }
    if ($obj eq 'plan'){
        unless ($cgi->param('isactive')){
            push @wherepart, 'test_plans.isactive = 1';
        }
    }
    if ($obj eq 'environment'){
        if ($cgi->param('isactive')){
            push @wherepart, 'test_environments.isactive = 1';
        }
    }
    if ($obj eq 'case_run'){
        unless ($cgi->param('isactive')){
            push @wherepart, 'test_case_runs.iscurrent = 1';
        }
    }
    if ($obj eq 'case'){
        if ($cgi->param('isactive')){
            push @wherepart, 'case_runs.iscurrent = 1';
        }
    }

    my @funcnames;
    while (@funcdefs) {
        my $key = shift(@funcdefs);
        my $value = shift(@funcdefs);
        if ($key =~ /^[^,]*$/) {
            die "All defs in %funcs must have a comma in their name: $key";
        }
        if (exists $funcsbykey{$key}) {
            die "Duplicate key in %funcs: $key";
        }
        $funcsbykey{$key} = $value;
        push(@funcnames, $key);
    }

    # first we delete any sign of "Chart #-1" from the HTML form hash
    # since we want to guarantee the user didn't hide something here
    my @badcharts = grep /^(field|type|value)-1-/, $cgi->param();
    foreach my $field (@badcharts) {
        $cgi->delete($field);
    }

    # now we take our special chart and stuff it into the form hash
    my $chart = -1;
    my $row = 0;
    foreach my $ref (@specialchart) {
        my $col = 0;
        while (@$ref) {
            $cgi->param("field$chart-$row-$col", shift(@$ref));
            $cgi->param("type$chart-$row-$col", shift(@$ref));
            $cgi->param("value$chart-$row-$col", shift(@$ref));
            if ($debug) {
                print "field$chart-$row-$col => " . $cgi->param("field$chart-$row-$col") ." | ". "type$chart-$row-$col => " . $cgi->param("type$chart-$row-$col") ." | ". "value$chart-$row-$col => " . $cgi->param("value$chart-$row-$col") . "<br>\n";
            }
            $col++;

        }
        $row++;
    }
    if ($debug){
        foreach my $p ($cgi->param){
            print "PARAM: $p => " . $cgi->param($p) . "<br>";
        }
    }
    # get a list of field names to verify the user-submitted chart fields against
    my $ref = $dbh->selectall_arrayref("SELECT name, fieldid FROM test_fielddefs");
    foreach my $list (@{$ref}) {
        my ($name, $id) = @{$list};
        $chartfields{$name} = $id;
    }

    $row = 0;
    for ($chart=-1 ;
         $chart < 0 || $cgi->param("field$chart-0-0") ;
         $chart++) {
        $chartid = $chart >= 0 ? $chart : "";
        my @chartandlist = ();
        for ($row = 0 ;
             $cgi->param("field$chart-$row-0") ;
             $row++) {
            my @orlist;
            for (my $col = 0 ;
                 $cgi->param("field$chart-$row-$col") ;
                 $col++) {
                $f = $cgi->param("field$chart-$row-$col") || "noop";
                $t = $cgi->param("type$chart-$row-$col") || "noop";
                $v = $cgi->param("value$chart-$row-$col");
                $v = "" if !defined $v;
                $v = trim($v);
                if ($f eq "noop" || $t eq "noop" || $v eq "") {
                    next;
                }
                # chart -1 is generated by other code above, not from the user-
                # submitted form, so we'll blindly accept any values in chart -1
                if ((!$chartfields{$f}) && ($chart != -1) && ! grep($f, @funcnames)) {
                    ThrowCodeError("invalid_field_name", {field => $f});
                }

                # This is either from the internal chart (in which case we
                # already know about it), or it was in %chartfields, so it is
                # a valid field name, which means that it's ok.
                trick_taint($f);
                $q = $dbh->quote($v);
                # Now that the value has been quoted, we can detaint it.
                trick_taint($q);
                my $rhs = $v;
                $rhs =~ tr/,//;
                my $func;
                $term = undef;
                foreach my $key (@funcnames) {
                    if ("$f,$t,$rhs" =~ m/$key/) {
                        my $ref = $funcsbykey{$key};
                        if ($debug) {
                            print "<p>$key ($f , $t , $rhs ) => ";
                        }
                        $ff = $f;
                       if ($f !~ /\./) {
                            $ff = "test_". $obj ."s.$f";
                        }
                        &$ref;
                        if ($debug) {
                            print "$f , $t , $v , $term</p>";
                        }
                        if ($term) {
                            last;
                        }
                    }
                }
                if ($term) {
                    push(@orlist, $term);
                }
                else {
                    # This field and this type don't work together.
                    ThrowCodeError("field_type_mismatch",
                                   { field => $cgi->param("field$chart-$row-$col"),
                                     type => $cgi->param("type$chart-$row-$col"),
                                   });
                }
            }
            if (@orlist) {
                @orlist = map("($_)", @orlist) if (scalar(@orlist) > 1);
                push(@chartandlist, "(" . join(" OR ", @orlist) . ")");
            }
        }
        if (@chartandlist) {
            if ($cgi->param("negate$chart")) {
                push(@andlist, "NOT(" . join(" AND ", @chartandlist) . ")");
            } else {
                push(@andlist, "(" . join(" AND ", @chartandlist) . ")");
            }
        }
    }

    # The ORDER BY clause goes last, but can require modifications
    # to other parts of the query, so we want to create it before we
    # write the FROM clause.
    foreach my $orderitem (@inputorder) {
        # Some fields have 'AS' aliases. The aliases go in the ORDER BY,
        # not the whole fields.
        # XXX - Ideally, we would get just the aliases in @inputorder,
        # and we'd never have to deal with this.
        if ($orderitem =~ /\s+AS\s+(.+)$/i) {
            $orderitem = $1;
        }
        BuildOrderBy($orderitem, \@orderby);
    }
    # Now JOIN the correct tables in the FROM clause.
    # This is done separately from the above because it's
    # cleaner to do it this way.
    foreach my $orderitem (@inputorder) {
        # Grab the part without ASC or DESC.
        my @splitfield = split(/\s+/, $orderitem);
        if ($specialorderjoin{$splitfield[0]}) {
            push(@supptables, $specialorderjoin{$splitfield[0]});
        }
    }
    if ($debug){
        print "<pre>";
        print join("\n", @supptables);
        print "</pre>";
    }
    my %suppseen = ("test_". $obj ."s" => 1);
    my $suppstring = "test_". $obj ."s";
    my @supplist = (" ");
    foreach my $str (@supptables) {
        if (!$suppseen{$str}) {
            if ($str =~ /^(LEFT|INNER|RIGHT)\s+JOIN/i) {
                $str =~ /^(.*?)\s+ON\s+(.*)$/i;
                my ($leftside, $rightside) = ($1, $2);
                if ($suppseen{$leftside}) {
                    $supplist[$suppseen{$leftside}] .= " AND ($rightside)" unless ($rightside eq 'case_bugs.bug_id = bugs.bug_id' || 'test_runs.environment_id = test_environment_map.environment_id');
                } else {
                    $suppseen{$leftside} = scalar @supplist;
                    push @supplist, " $leftside ON ($rightside)";
                }
            } else {
                # Do not accept implicit joins using comma operator
                # as they are not DB agnostic
                # ThrowCodeError("comma_operator_deprecated");
                $suppstring .= ", $str";
                $suppseen{$str} = 1;
            }
        }
    }
    $suppstring .= join('', @supplist);
    
    # Make sure we create a legal SQL query.
    @andlist = ("1 = 1") if !@andlist;
    print "WHEREPART: " . Data::Dumper::Dumper(\@wherepart) if $debug;
    my $query;
    if ($self->{'fields'}){
        $query = "SELECT $distinct". join(",", @{$self->{'fields'}});
    }
    else {
        $query = "SELECT $distinct test_". $obj ."s.". $obj. "_id";
    }
    $query .= " FROM $suppstring";
    $query .= " WHERE " . join(' AND ', (@wherepart, @andlist));
    if ($obj eq 'case_run' && $cgi->param('addcases')){
        my $addcases = $cgi->param('addcases');
        my $run_id = $cgi->param('run_id'); 
        trick_taint($addcases);
        trick_taint($run_id);
        $query .= ' OR (test_case_runs.case_id IN ('. $addcases .') AND test_case_runs.iscurrent = 1 AND test_case_runs.run_id = '. $run_id . ')';
    }


    foreach my $field (@fields, @orderby) {
        next if ($field =~ /(AVG|SUM|COUNT|MAX|MIN|VARIANCE)\s*\(/i ||
                 $field =~ /^\d+$/ || $field eq "bugs.bug_id" ||
                 $field =~ /^relevance/);
        if ($field =~ /.*AS\s+(\w+)$/i) {
            push(@groupby, $1) if !grep($_ eq $1, @groupby);
        } else {
            push(@groupby, $field) if !grep($_ eq $field, @groupby);
        }
    }
    if (scalar @groupby && $cgi->param('report')){
        $query .= " " . $dbh->sql_group_by("test_${obj}s.${obj}_id", join(', ', @groupby));
    }
    elsif ($cgi->param('report')) {
        $query .= " " . $dbh->sql_group_by("test_${obj}s.${obj}_id");
    }


    if (@having) {
        $query .= " HAVING " . join(" AND ", @having);
    }

    if (@orderby) {
        $query .= " ORDER BY " . join(',', @orderby) . ' ' . $sortdir; #This works for now since there is only single field sort
    }
    if(defined $start){
        $query .= " LIMIT $limit OFFSET $start";
    }
    elsif (defined $page){
        $query .= " LIMIT $pagesize OFFSET ". $page*$pagesize;
    }
    if ($debug) {
        print "<p><code>" . value_quote($query) . "</code></p>\n";
    }
    
    $self->{'sql'} = $query;

}

sub query {
    my $self = shift;
    return $self->{'sql'};    
}

sub SqlifyDate {
    my ($str) = @_;
    $str = "" if !defined $str;
    if ($str eq "" || lc($str) eq 'now') {
        my ($sec, $min, $hour, $mday, $month, $year, $wday) = localtime(time());
        return sprintf("%4d-%02d-%02d %02d:%02d:%02d", $year+1900, $month+1, $mday, $hour, $min, $sec);
    }


    if ($str =~ /^(-|\+)?(\d+)([hHdDwWmMyY])$/) {   # relative date
        my ($sign, $amount, $unit, $date) = ($1, $2, lc $3, time);
        my ($sec, $min, $hour, $mday, $month, $year, $wday)  = localtime($date);
        if ($sign && $sign eq '+') { $amount = -$amount; }
        if ($unit eq 'w') {                  # convert weeks to days
            $amount = 7*$amount + $wday;
            $unit = 'd';
        }
        if ($unit eq 'd') {
            $date -= $sec + 60*$min + 3600*$hour + 24*3600*$amount;
            return time2str("%Y-%m-%d %H:%M:%S", $date);
        }
        elsif ($unit eq 'y') {
            return sprintf("%4d-01-01 00:00:00", $year+1900-$amount);
        }
        elsif ($unit eq 'm') {
            $month -= $amount;
            while ($month<0) { $year--; $month += 12; }
            return sprintf("%4d-%02d-01 00:00:00", $year+1900, $month+1);
        }
        elsif ($unit eq 'h') {
            # Special case 0h for 'beginning of this hour'
            if ($amount == 0) {
                $date -= $sec + 60*$min;
            } else {
                $date -= 3600*$amount;
            }
            return time2str("%Y-%m-%d %H:%M:%S", $date);
        }
        return undef;                      # should not happen due to regexp at top
    }
    my $date = str2time($str);
    if (!defined($date)) {
        ThrowUserError("illegal_date", { date => $str });
    }
    return time2str("%Y-%m-%d %H:%M:%S", $date);
}


sub GetByWordList {
    my ($field, $strs) = (@_);
    my @list;
    my $dbh = Bugzilla->dbh;

    foreach my $w (split(/[\s,]+/, $strs)) {
        my $word = $w;
        if ($word ne "") {
            $word =~ tr/A-Z/a-z/;
            $word = $dbh->quote(quotemeta($word));
            trick_taint($word);
            $word =~ s/^'//;
            $word =~ s/'$//;
            $word = '(^|[^a-z0-9])' . $word . '($|[^a-z0-9])';
            push(@list, "$field " . $dbh->sql_regexp() . " '$word'");
        }
    }

    return \@list;
}

# Support for "any/all/nowordssubstr" comparison type ("words as substrings")
sub GetByWordListSubstr {
    my ($field, $strs) = (@_);
    my @list;
    my $dbh = Bugzilla->dbh;

    foreach my $word (split(/[\s,]+/, $strs)) {
        next if $word eq "";
        $word = $dbh->quote($word);
        trick_taint($word);
        push(@list, $dbh->sql_position(lc($word), "LOWER($field)") . " > 0");
    }

    return \@list;
}

=head1 SEE ALSO

Testopia::Table Bugzilla::Search

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>

=cut

1;
