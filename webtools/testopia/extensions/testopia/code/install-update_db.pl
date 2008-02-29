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
# The Initial Developer of the Original Code is Maciej Maczynski.
# Portions created by Maciej Maczynski are Copyright (C) 2001
# Maciej Maczynski. All Rights Reserved.
#
# Contributor(s): Maciej Maczynski <macmac@xdsnet.pl>
#                 Ed Fuentetaja <efuentetaja@acm.org>
#                 Vance Baarda <vrb@novell.com>

use strict;
use lib '.';
use Bugzilla;
use Bugzilla::Group;

# Start of main().
print "\nChecking Testopia setup ...\n";
testopiaUpdateDB();
updateACLs();
migrateAttachments();
createGroup();
finalFixups();
print "Done checking Testopia setup.\n\n";
# End of main().

sub testopiaUpdateDB {
    my $dbh = Bugzilla->dbh;

    # If the database contains Testopia tables but bz_schema doesn't
    # know about them, then we need to update bz_schema.
    if (grep(/^test_cases$/, $dbh->bz_table_list_real) and
            !$dbh->_bz_real_schema->get_table_abstract('test_cases')) {
        my $msg = "Sorry, we cannot upgrade from Testopia 1.0 using this " .
            "database. Upgrades are supported only with MySQL.";
        die($msg) unless $dbh->isa('Bugzilla::DB::Mysql');
        my $built_schema = $dbh->_bz_build_schema_from_disk;
        foreach my $table (grep(/^test_/, $built_schema->get_table_list())) {
            $dbh->_bz_real_schema->add_table($table,
                $built_schema->get_table_abstract($table));
        }
        $dbh->_bz_store_real_schema;
    }

    $dbh->bz_setup_database();

    $dbh->bz_drop_table('test_case_group_map');
    $dbh->bz_drop_table('test_category_templates');
    $dbh->bz_drop_table('test_plan_testers');
    $dbh->bz_drop_table('test_plan_group_map');
    $dbh->bz_drop_column('test_plans', 'editor_id');

    $dbh->bz_add_column('test_case_bugs', 'case_id', {TYPE => 'INT4', UNSIGNED => 1});
    $dbh->bz_add_column('test_case_runs', 'environment_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1}, 0);
    $dbh->bz_add_column('test_case_tags', 'userid', {TYPE => 'INT3', NOTNULL => 1}, 0);
    $dbh->bz_add_column('test_case_texts', 'setup', {TYPE => 'MEDIUMTEXT'});
    $dbh->bz_add_column('test_case_texts', 'breakdown', {TYPE => 'MEDIUMTEXT'});
    $dbh->bz_add_column('test_environments', 'product_id', {TYPE => 'INT2', NOTNULL => 1}, 0);
    $dbh->bz_add_column('test_environments', 'isactive', {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => '1'}, 1);
    $dbh->bz_add_column('test_plan_tags', 'userid', {TYPE => 'INT3', NOTNULL => 1}, 0);
    $dbh->bz_add_column('test_runs', 'default_tester_id', {TYPE => 'INT3'});
    $dbh->bz_add_column('test_run_tags', 'userid', {TYPE => 'INT3', NOTNULL => 1}, 0);
    $dbh->bz_add_column('test_builds', 'isactive', {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => '1'}, 1);
    $dbh->bz_add_column('test_cases', 'estimated_time', {TYPE => 'TIME'}, 0);
    $dbh->bz_add_column('test_case_runs', 'running_date', {TYPE => 'DATETIME'}, 0);
    $dbh->bz_add_column('test_plan_types', 'description', {TYPE => 'MEDIUMTEXT'}, 0);
    $dbh->bz_add_column('test_case_status', 'description', {TYPE => 'MEDIUMTEXT'}, 0);
    $dbh->bz_add_column('test_case_run_status', 'description', {TYPE => 'MEDIUMTEXT'}, 0);
    $dbh->bz_add_column('test_case_runs', 'iscurrent', {TYPE => 'INT1', NOTNULL => 1, DEFAULT => 0}, 0);
    $dbh->bz_add_column('test_named_queries', 'type', {TYPE => 'INT3', NOTNULL => 1, DEFAULT => 0}, 0);
    fixTables();

    $dbh->bz_alter_column('test_attachment_data', 'attachment_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_attachments', 'attachment_id', {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_attachments', 'creation_ts', {TYPE => 'DATETIME', NOTNULL => 1});
    $dbh->bz_alter_column('test_builds', 'build_id', {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_activity', 'case_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_bugs', 'case_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_bugs', 'case_run_id', {TYPE => 'INT4', UNSIGNED => 1});
    $dbh->bz_alter_column('test_case_components', 'case_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_dependencies', 'blocked', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_dependencies', 'dependson', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_plans', 'case_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_plans', 'plan_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_runs', 'build_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_runs', 'case_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_runs', 'case_run_id', {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_runs', 'environment_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_runs', 'iscurrent', {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => '0'});
    $dbh->bz_alter_column('test_case_runs', 'run_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_run_status', 'case_run_status_id', {TYPE => 'SMALLSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_cases', 'case_id', {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_status', 'case_status_id', {TYPE => 'SMALLSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_tags', 'case_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_texts', 'case_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_case_texts', 'creation_ts', {TYPE => 'DATETIME', NOTNULL => 1});
    $dbh->bz_alter_column('test_environment_map', 'environment_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_environments', 'environment_id', {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_named_queries', 'isvisible', {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => 1});
    $dbh->bz_alter_column('test_plan_activity', 'plan_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_plans', 'plan_id', {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_plan_tags', 'plan_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_plan_texts', 'creation_ts', {TYPE => 'DATETIME', NOTNULL => 1});
    $dbh->bz_alter_column('test_plan_texts', 'plan_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_plan_texts', 'plan_text', {TYPE => 'MEDIUMTEXT'});
    $dbh->bz_alter_column('test_run_activity', 'run_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_run_cc', 'run_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_runs', 'build_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_runs', 'environment_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_runs', 'plan_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_runs', 'run_id', {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1});
    $dbh->bz_alter_column('test_runs', 'start_date', {TYPE => 'DATETIME', NOTNULL => 1});
    $dbh->bz_alter_column('test_run_tags', 'run_id', {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1});

    $dbh->bz_drop_index('test_attachments', 'AI_attachment_id');
    $dbh->bz_drop_index('test_attachments', 'attachment_id');
    $dbh->bz_drop_index('test_builds', 'build_id');
    $dbh->bz_drop_index('test_case_bugs', 'case_run_bug_id_idx');
    $dbh->bz_drop_index('test_case_bugs', 'case_run_id_idx');
    $dbh->bz_drop_index('test_case_categories', 'AI_category_id');
    $dbh->bz_drop_index('test_case_categories', 'category_name_idx');
    $dbh->bz_drop_index('test_case_categories', 'category_name_indx');
    $dbh->bz_drop_index('test_case_components', 'case_commponents_component_id_idx');
    $dbh->bz_drop_index('test_case_components', 'case_components_case_id_idx');
    $dbh->bz_drop_index('test_case_components', 'case_components_component_id_idx');
    $dbh->bz_drop_index('test_case_plans', 'case_plans_case_id_idx');
    $dbh->bz_drop_index('test_case_plans', 'case_plans_plan_id_idx');
    $dbh->bz_drop_index('test_case_runs', 'AI_case_run_id');
    $dbh->bz_drop_index('test_case_runs', 'case_run_build_idx');
    $dbh->bz_drop_index('test_case_runs', 'case_run_env_idx');
    $dbh->bz_drop_index('test_case_runs', 'case_run_id');
    $dbh->bz_drop_index('test_case_runs', 'case_run_id_2');
    $dbh->bz_drop_index('test_case_runs', 'case_run_run_id_idx');
    $dbh->bz_drop_index('test_case_runs', 'case_run_shortkey_idx');
    $dbh->bz_drop_index('test_case_runs', 'case_run_sortkey_idx');
    $dbh->bz_drop_index('test_case_run_status', 'AI_case_run_status_id');
    $dbh->bz_drop_index('test_case_run_status', 'case_run_status_name_idx');
    $dbh->bz_drop_index('test_case_run_status', 'case_run_status_sortkey_idx');
    $dbh->bz_drop_index('test_case_run_status', 'sortkey');
    $dbh->bz_drop_index('test_cases', 'AI_case_id');
    $dbh->bz_drop_index('test_cases', 'alias');
    $dbh->bz_drop_index('test_cases', 'case_id');
    $dbh->bz_drop_index('test_cases', 'case_id_2');
    $dbh->bz_drop_index('test_case_status', 'AI_case_status_id');
    $dbh->bz_drop_index('test_case_status', 'case_status_id');
    $dbh->bz_drop_index('test_case_status', 'test_case_status_name_idx');
    $dbh->bz_drop_index('test_cases', 'test_case_requirment_idx');
    $dbh->bz_drop_index('test_case_tags', 'case_tags_case_id_idx');
    $dbh->bz_drop_index('test_case_tags', 'case_tags_case_id_idx_v2');
    $dbh->bz_drop_index('test_case_tags', 'case_tags_tag_id_idx');
    $dbh->bz_drop_index('test_case_tags', 'case_tags_user_idx');
    $dbh->bz_drop_index('test_email_settings', 'test_event_user_event_dx');
    $dbh->bz_drop_index('test_email_settings', 'test_event_user_event_idx');
    $dbh->bz_drop_index('test_email_settings', 'test_event_user_relationship_idx');
    $dbh->bz_drop_index('test_environment_category', 'env_category_idx');
    $dbh->bz_drop_index('test_environment_element', 'env_element_category_idx');
    $dbh->bz_drop_index('test_environment_property', 'env_element_property_idx');
    $dbh->bz_drop_index('test_environments', 'environment_id');
    $dbh->bz_drop_index('test_environments', 'environment_name_idx');
    $dbh->bz_drop_index('test_fielddefs', 'AI_fieldid');
    $dbh->bz_drop_index('test_fielddefs', 'fielddefs_name_idx') if $dbh->isa('Bugzilla::DB::Mysql');
    $dbh->bz_drop_index('test_fielddefs', 'test_fielddefs_name_idx');
    $dbh->bz_drop_index('test_plans', 'AI_plan_id');
    $dbh->bz_drop_index('test_plans', 'plan_id');
    $dbh->bz_drop_index('test_plans', 'plan_id_2');
    $dbh->bz_drop_index('test_plan_tags', 'plan_tags_idx');
    $dbh->bz_drop_index('test_plan_tags', 'plan_tags_user_idx');
    $dbh->bz_drop_index('test_plan_types', 'AI_type_id');
    $dbh->bz_drop_index('test_plan_types', 'plan_type_name_idx');
    $dbh->bz_drop_index('test_run_cc', 'run_cc_run_id_who_idx');
    $dbh->bz_drop_index('test_runs', 'AI_run_id');
    $dbh->bz_drop_index('test_runs', 'run_id');
    $dbh->bz_drop_index('test_runs', 'run_id_2');
    $dbh->bz_drop_index('test_runs', 'test_run_plan_id_run_id__idx');
    $dbh->bz_drop_index('test_run_tags', 'run_tags_idx');
    $dbh->bz_drop_index('test_run_tags', 'run_tags_user_idx');
    $dbh->bz_drop_index('test_tags', 'AI_tag_id');
    $dbh->bz_drop_index('test_tags', 'tag_name');
    $dbh->bz_drop_index('test_tags', 'test_tag_name_idx');
    $dbh->bz_drop_index('test_tags', 'test_tag_name_indx');
    $dbh->bz_drop_index('test_runs', 'test_runs_summary_idx');

    $dbh->bz_add_index('test_attachment_data', 'test_attachment_data_primary_idx', ['attachment_id']);
    $dbh->bz_add_index('test_attachments', 'test_attachments_submitter_idx', ['submitter_id']);
    $dbh->bz_add_index('test_builds', 'build_milestone_idx', ['milestone']);
    $dbh->bz_add_index('test_builds', 'build_name_idx', ['name']);
    $dbh->bz_add_index('test_builds', 'build_prod_idx', {FIELDS => [qw(build_id product_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_builds', 'build_product_id_name_idx', {FIELDS => [qw(product_id name)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_attachments', 'test_case_attachments_primary_idx', ['attachment_id']);
    $dbh->bz_add_index('test_case_bugs', 'case_bugs_bug_id_idx', ['bug_id']);
    $dbh->bz_add_index('test_case_bugs', 'case_bugs_case_id_idx', ['case_id']);
    $dbh->bz_add_index('test_case_bugs', 'case_bugs_case_run_id_idx', ['case_run_id']);
    $dbh->bz_add_index('test_case_categories', 'category_name_idx_v2', ['name']);
    $dbh->bz_add_index('test_case_categories', 'category_product_id_name_idx', {FIELDS => [qw(product_id name)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_categories', 'category_product_idx', {FIELDS => [qw(category_id product_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_components', 'components_case_id_idx', {FIELDS => [qw(case_id component_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_components', 'components_component_id_idx', ['component_id']);
    $dbh->bz_add_index('test_case_dependencies', 'case_dependencies_blocked_idx', ['blocked']);
    $dbh->bz_add_index('test_case_dependencies', 'case_dependencies_primary_idx', {FIELDS => [qw(dependson blocked)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_plans', 'test_case_plans_case_idx', [qw(case_id)]);
    $dbh->bz_add_index('test_case_plans', 'test_case_plans_primary_idx', {FIELDS => [qw(plan_id case_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_runs', 'case_run_build_env_idx', {FIELDS => [qw(run_id case_id build_id environment_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_runs', 'case_run_build_idx_v2', ['build_id']);
    $dbh->bz_add_index('test_case_runs', 'case_run_env_idx_v2', ['environment_id']);
    $dbh->bz_add_index('test_case_runs', 'case_run_status_idx', ['case_run_status_id']);
    $dbh->bz_add_index('test_case_runs', 'case_run_text_ver_idx', ['case_text_version']);
    $dbh->bz_add_index('test_cases', 'test_case_requirement_idx', ['requirement']);
    $dbh->bz_add_index('test_cases', 'test_case_status_idx', ['case_status_id']);
    $dbh->bz_add_index('test_cases', 'test_case_tester_idx', ['default_tester_id']);
    $dbh->bz_add_index('test_case_tags', 'case_tags_case_id_idx_v3', [qw(case_id)]);
    $dbh->bz_add_index('test_case_tags', 'case_tags_primary_idx', {FIELDS => [qw(tag_id case_id userid)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_tags', 'case_tags_secondary_idx', {FIELDS => [qw(tag_id case_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_case_tags', 'case_tags_userid_idx', [qw(userid)]);
    $dbh->bz_add_index('test_email_settings', 'test_email_setting_user_id_idx', {FIELDS => [qw(userid relationship_id eventid)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_environment_category', 'test_environment_category_key1', {FIELDS => [qw(env_category_id product_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_environment_category', 'test_environment_category_key2', {FIELDS => [qw(product_id name)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_environment_element', 'test_environment_element_key1', {FIELDS => [qw(element_id env_category_id)], TYPE => 'UNIQUE'},);
    $dbh->bz_add_index('test_environment_element', 'test_environment_element_key2', {FIELDS => [qw(env_category_id name)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_environment_map', 'test_environment_map_key3', {FIELDS => [qw(environment_id element_id property_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_environment_property', 'test_environment_property_key1', {FIELDS => [qw(property_id element_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_environment_property', 'test_environment_property_key2', {FIELDS => [qw(element_id name)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_environments', 'environment_name_idx_v2', ['name']);
    $dbh->bz_add_index('test_environments', 'test_environments_key1', {FIELDS => [qw(environment_id product_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_environments', 'test_environments_key2', {FIELDS => [qw(product_id name)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_named_queries', 'test_namedquery_primary_idx', {FIELDS => [qw(userid name)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_plan_activity', 'plan_activity_changed_idx', ['changed']);
    $dbh->bz_add_index('test_plan_activity', 'plan_activity_field_idx', ['fieldid']);
    $dbh->bz_add_index('test_plan_activity', 'plan_activity_primary_idx', ['plan_id']);
    $dbh->bz_add_index('test_plan_attachments', 'test_plan_attachments_primary_idx', ['attachment_id']);
    $dbh->bz_add_index('test_plan_permissions', 'testers_plan_grant_idx', ['grant_type']);
    $dbh->bz_add_index('test_plan_tags', 'plan_tags_plan_id_idx', [qw(plan_id)]);
    $dbh->bz_add_index('test_plan_tags', 'plan_tags_primary_idx', {FIELDS => [qw(tag_id plan_id userid)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_plan_tags', 'plan_tags_secondary_idx', {FIELDS => [qw(tag_id plan_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_plan_tags', 'plan_tags_userid_idx', [qw(userid)]);
    $dbh->bz_add_index('test_run_activity', 'run_activity_field_idx', ['fieldid']);
    $dbh->bz_add_index('test_run_cc', 'test_run_cc_primary_idx', {FIELDS => [qw(run_id who)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_run_cc', 'test_run_cc_who_idx', [qw(who)]);
    $dbh->bz_add_index('test_runs', 'test_run_build_idx', ['build_id']);
    $dbh->bz_add_index('test_runs', 'test_run_env_idx', ['environment_id']);
    $dbh->bz_add_index('test_runs', 'test_run_plan_id_run_id_idx', [qw(plan_id run_id)]);
    $dbh->bz_add_index('test_runs', 'test_run_plan_ver_idx', ['plan_text_version']);
    $dbh->bz_add_index('test_runs', 'test_run_tester_idx', ['default_tester_id']);
    $dbh->bz_add_index('test_run_tags', 'run_tags_primary_idx', {FIELDS => [qw(tag_id run_id userid)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_run_tags', 'run_tags_run_id_idx', [qw(run_id)]);
    $dbh->bz_add_index('test_run_tags', 'run_tags_secondary_idx', {FIELDS => [qw(tag_id run_id)], TYPE => 'UNIQUE'});
    $dbh->bz_add_index('test_run_tags', 'run_tags_userid_idx', [qw(userid)]);
    $dbh->bz_add_index('test_tags', 'test_tag_name_idx_v2', [qw(tag_name)]);

    populateMiscTables();
    populateEnvTables();
    migrateEnvData();
}

sub updateACLs {
    my $dbh = Bugzilla->dbh;
    return unless $dbh->selectrow_array("SELECT COUNT(*) FROM test_plan_permissions") == 0;

    print "Populating test plan ACLs ...\n";
    my $ref = $dbh->selectall_arrayref("SELECT plan_id, author_id FROM test_plans", {'Slice' =>{}});
    foreach my $plan (@$ref){
        my ($finished) = $dbh->selectrow_array(
            "SELECT COUNT(*) FROM test_plan_permissions
              WHERE plan_id = ? AND userid = ?",
              undef, ($plan->{'plan_id'}, $plan->{'author_id'}));
        next if ($finished);
        $dbh->do("INSERT INTO test_plan_permissions(userid, plan_id, permissions)
                  VALUES(?,?,?)",
                  undef, ($plan->{'author_id'}, $plan->{'plan_id'}, 15));
    }
}

sub migrateAttachments {
    my $dbh = Bugzilla->dbh;
    return unless $dbh->bz_column_info('test_attachments', 'case_id');
    print "Migrating attachments...\n";

    my $rows = $dbh->selectall_arrayref(
        "SELECT attachment_id, case_id, plan_id
           FROM test_attachments", {'Slice' => {}});

    foreach my $row (@$rows){
        if ($row->{'case_id'}){
            $dbh->do("INSERT INTO test_case_attachments (attachment_id, case_id)
                      VALUES (?,?)", undef, ($row->{'attachment_id'}, $row->{'case_id'}));
        }
        elsif ($row->{'plan_id'}){
            $dbh->do("INSERT INTO test_plan_attachments (attachment_id, plan_id)
                      VALUES (?,?)", undef, ($row->{'attachment_id'}, $row->{'plan_id'}));
        }
    }
    $dbh->bz_drop_column('test_attachments', 'case_id');
    $dbh->bz_drop_column('test_attachments', 'plan_id');
}

sub populateMiscTables {
    my $dbh = Bugzilla->dbh;

    # Insert initial values in static tables. Going out on a limb and
    # assuming that if one table is empty, they all are.
    return if $dbh->selectrow_array("SELECT COUNT(*) FROM test_case_run_status");

    print "Populating test_case_run_status table ...\n";
    print "Populating test_case_status table ...\n";
    print "Populating test_plan_types table ...\n";
    print "Populating test_fielddefs table ...\n";

    $dbh->do("INSERT INTO test_case_run_status (name, sortkey) VALUES ('IDLE', 1)");
    $dbh->do("INSERT INTO test_case_run_status (name, sortkey) VALUES ('PASSED', 2)");
    $dbh->do("INSERT INTO test_case_run_status (name, sortkey) VALUES ('FAILED', 3)");
    $dbh->do("INSERT INTO test_case_run_status (name, sortkey) VALUES ('RUNNING', 4)");
    $dbh->do("INSERT INTO test_case_run_status (name, sortkey) VALUES ('PAUSED', 5)");
    $dbh->do("INSERT INTO test_case_run_status (name, sortkey) VALUES ('BLOCKED', 6)");
    $dbh->do("INSERT INTO test_case_status (name) VALUES ('PROPOSED')");
    $dbh->do("INSERT INTO test_case_status (name) VALUES ('CONFIRMED')");
    $dbh->do("INSERT INTO test_case_status (name) VALUES ('DISABLED')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('Unit')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('Integration')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('Function')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('System')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('Acceptance')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('Installation')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('Performance')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('Product')");
    $dbh->do("INSERT INTO test_plan_types (name) VALUES ('Interoperability')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('isactive', 'Archived', 'test_plans')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('name', 'Plan Name', 'test_plans')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('type_id', 'Plan Type', 'test_plans')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('case_status_id', 'Case Status', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('category_id', 'Category', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('priority_id', 'Priority', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('summary', 'Run Summary', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('isautomated', 'Automated', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('alias', 'Alias', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('requirement', 'Requirement', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('script', 'Script', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('arguments', 'Argument', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('product_id', 'Product', 'test_plans')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('default_product_version', 'Default Product Version', 'test_plans')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('environment_id', 'Environment', 'test_runs')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('product_version', 'Product Version', 'test_runs')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('build_id', 'Default Build', 'test_runs')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('plan_text_version', 'Plan Text Version', 'test_runs')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('manager_id', 'Manager', 'test_runs')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('default_tester_id', 'Default Tester', 'test_cases')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('stop_date', 'Stop Date', 'test_runs')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('summary', 'Run Summary', 'test_runs')");
    $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) VALUES ('notes', 'Notes', 'test_runs')");
}

sub populateEnvTables {
    my $dbh = Bugzilla->dbh;

    my $sth;
    my $ary_ref;
    my $value;

    return unless $dbh->selectrow_array("SELECT COUNT(*) FROM test_environment_category") == 0;
    if ($dbh->selectrow_array("SELECT COUNT(*) FROM test_environment_element") != 0) {
        print STDERR "\npopulateEnv: Fatal Error: test_environment_category " .
            "is empty but\ntest_environment_element is not. This ought " .
            "to be impossible.\n\n";
        return;
    }

    $dbh->bz_lock_tables(
        'test_environment_category WRITE',
        'test_environment_element WRITE',
        'op_sys READ',
        'rep_platform READ');

    print "Populating test_environment_category table ...\n";
    $dbh->do("INSERT INTO test_environment_category (product_id, name) " .
             "VALUES (0, 'Operating System')");
    $dbh->do("INSERT INTO test_environment_category (product_id, name) " .
             "VALUES (0, 'Hardware')");

    print "Populating test_environment_element table ...\n";
    $sth = $dbh->prepare("INSERT INTO test_environment_element " .
        "(env_category_id, name, parent_id, isprivate) " .
        "VALUES (?, ?, ?, ?)");
    $ary_ref = $dbh->selectcol_arrayref("SELECT value FROM op_sys");
    foreach $value (@$ary_ref) {
        $sth->execute(1, $value, 0, 0);
    }
    $ary_ref = $dbh->selectcol_arrayref("SELECT value FROM rep_platform");
    foreach $value (@$ary_ref) {
        $sth->execute(2, $value, 0, 0);
    }

    $dbh->bz_unlock_tables();
}

sub migrateEnvData {
    my $dbh = Bugzilla->dbh;
    my $sth;
    my $value;
    my $os_mapping;
    my $platform_mapping;
    my $ary_ref;
    my $i;

    return unless $dbh->bz_column_info('test_environments', 'op_sys_id');

    # Map between IDs in op_sys table and IDs in
    # test_environment_element table.
    $os_mapping = $dbh->selectall_hashref("SELECT " .
        "os.id AS op_sys_id, " .
        "env_elem.element_id AS element_id " .
        "FROM op_sys os, test_environment_element env_elem " .
        "WHERE os.value = env_elem.name " .
        "AND env_elem.env_category_id = 1",
        'op_sys_id');

    # Map between IDs in rep_platform table and IDs in
    # test_environment_element table.
    $platform_mapping = $dbh->selectall_hashref("SELECT " .
        "platform.id AS rep_platform_id, " .
        "env_elem.element_id AS element_id " .
        "FROM rep_platform platform, test_environment_element env_elem " .
        "WHERE platform.value = env_elem.name " .
        "AND env_elem.env_category_id = 2",
        'rep_platform_id');

    $dbh->bz_lock_tables(
        'test_environment_map WRITE',
        'test_environments READ');
    print "Migrating data from test_environments to test_environment_map ...\n";
    $sth = $dbh->prepare("INSERT INTO test_environment_map " .
        "(environment_id, property_id, element_id, value_selected) " .
        "VALUES (?, ?, ?, ?)");
    $ary_ref = $dbh->selectall_arrayref("SELECT environment_id, op_sys_id " .
        "FROM test_environments");
    foreach $i (@$ary_ref) {
        $sth->execute(@$i[0], 0, $os_mapping->{@$i[1]}->{'element_id'}, '');
    }
    $ary_ref = $dbh->selectall_arrayref("SELECT environment_id, rep_platform_id " .
        "FROM test_environments");
    foreach $i (@$ary_ref) {
        $sth->execute(@$i[0], 0, $platform_mapping->{@$i[1]}->{'element_id'}, '');
    }
    $dbh->bz_unlock_tables();

    print "Saving data from test_environments.xml column into text files ...\n";
    $ary_ref = $dbh->selectall_arrayref("SELECT environment_id, name, xml " .
        "FROM test_environments WHERE xml != ''");
    foreach $value (@$ary_ref) {
        open(FH, ">environment_" . @$value[0] . "_xml.txt");
        print FH "environment ID: @$value[0]\n";
        print FH "environment name: @$value[1]\n";
        print FH "environment xml:\n@$value[2]\n";
        close(FH);
    }

    $dbh->bz_drop_column('test_environments', 'op_sys_id');
    $dbh->bz_drop_column('test_environments', 'rep_platform_id');
    $dbh->bz_drop_column('test_environments', 'xml');
}

sub fixTables {
    my $dbh = Bugzilla->dbh;

    # Fix test_case_bugs table so that all case_id fields are not null.
    my ($count) = $dbh->selectrow_array("SELECT COUNT(*) FROM test_case_bugs WHERE case_id IS NULL");
    if ($count){
        require Bugzilla::Testopia::TestCaseRun;
        my $caseruns = $dbh->selectcol_arrayref("SELECT case_run_id FROM test_case_bugs WHERE case_id IS NULL");
        my $sth = $dbh->prepare_cached("UPDATE test_case_bugs SET case_id = ? WHERE case_run_id = ?");
        foreach my $cr (@$caseruns){
            my $caserun = Bugzilla::Testopia::TestCaseRun->new($cr);
            $sth->execute($caserun->case->id, $cr);
        }
    }

    # If we can't add a unique index to (case_id,component_id), then we
    # need to remove duplicate rows from test_case_components.
    eval{
        $dbh->bz_add_index('test_case_components', 'components_case_id_idx', {FIELDS => [qw(case_id component_id)], TYPE => 'UNIQUE'});
    };
    if ($@){
        print "Running component fix...\n";
        my $rows = $dbh->selectall_arrayref("SELECT * FROM test_case_components", {"Slice" => {}});
        my $seen;
        foreach my $row (@$rows){
          my $line = $row->{'case_id'} . "-" . $row->{'component_id'};
          if (!$seen->{$line}){
             $seen->{$line} = 'seen';
          }
          elsif ($seen->{$line} eq 'seen'){
              $dbh->do("DELETE FROM test_case_components
                        WHERE case_id = ? AND component_id = ?",
                        undef, ($row->{'case_id'}, $row->{'component_id'}));
              $dbh->do("INSERT INTO test_case_components
                        VALUES(?,?)",
                        undef, ($row->{'case_id'}, $row->{'component_id'}));
              $seen->{$line} = 'fixed';
          }
          elsif ($seen->{$line} eq 'fixed'){
              next;
          }
        }
    }
}

sub createGroup {
    Bugzilla::Group->create({
        name        => 'Testers',
        description => 'Can read and write all test plans, runs, and cases.',
        isbuggroup  => 0 }) unless new Bugzilla::Group({name => 'Testers'});
}

# A spot for fixing stuff at the very end.
sub finalFixups {
    my $dbh = Bugzilla->dbh;

    # We added the estimated_time field later, so we can't add it
    # inside populateMiscTables().
    unless ($dbh->selectrow_array("SELECT COUNT(*) FROM test_fielddefs " .
            "WHERE name = 'estimated_time'")) {
        $dbh->do("INSERT INTO test_fielddefs (name, description, table_name) " .
                "VALUES ('estimated_time', 'Estimated Time', 'test_cases')");
    }
}
