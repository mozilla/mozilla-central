#!/usr/bin/perl -wT

use strict;
my $schema = Bugzilla->hook_args->{schema};

$schema->{test_attachments} = {
    FIELDS => [
        attachment_id => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        submitter_id  => {TYPE => 'INT3', NOTNULL => 1},
        description   => {TYPE => 'MEDIUMTEXT'},
        filename      => {TYPE => 'MEDIUMTEXT'},
        creation_ts   => {TYPE => 'DATETIME', NOTNULL => 1},
        mime_type     => {TYPE => 'varchar(100)', NOTNULL => 1},
    ],
    INDEXES => [
        test_attachments_submitter_idx => ['submitter_id'],
    ],
},
$schema->{test_case_attachments} = {
    FIELDS => [
        attachment_id => {TYPE => 'INT4', NOTNULL => 1},
        case_id       => {TYPE => 'INT4', NOTNULL => 1, UNSIGNED => 1},
        case_run_id   => {TYPE => 'INT4', UNSIGNED => 1},
    ],
    INDEXES => [
        test_case_attachments_primary_idx => ['attachment_id'],
        attachment_case_id_idx            => ['case_id'],
        attachment_caserun_id_idx         => ['case_run_id'],
    ],
},
$schema->{test_plan_attachments} = {
    FIELDS => [
        attachment_id => {TYPE => 'INT4', NOTNULL => 1},
        plan_id       => {TYPE => 'INT4', NOTNULL => 1, UNSIGNED => 1},
    ],
    INDEXES => [
        test_plan_attachments_primary_idx => ['attachment_id'],
        attachment_plan_id_idx            => ['plan_id'],
    ],
},
$schema->{test_case_categories} = {
    FIELDS => [
        category_id => {TYPE => 'SMALLSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        product_id  => {TYPE => 'INT2', NOTNULL => 1},
        name        => {TYPE => 'varchar(240)', NOTNULL => 1},
        description => {TYPE => 'MEDIUMTEXT'},
    ],
    INDEXES => [
        category_product_id_name_idx => {FIELDS => [qw(product_id name)], TYPE => 'UNIQUE'},
        category_product_idx => {FIELDS => [qw(category_id product_id)], TYPE => 'UNIQUE'},
        category_name_idx_v2 => ['name'],
    ],
},
$schema->{test_cases} = {
    FIELDS => [
        case_id        => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        case_status_id => {TYPE => 'INT1', NOTNULL => 1},
        category_id    => {TYPE => 'INT2', NOTNULL => 1, UNSIGNED =>1},
        priority_id    => {TYPE => 'INT2'},
        author_id      => {TYPE => 'INT3', NOTNULL => 1},
        default_tester_id => {TYPE => 'INT3'},
        creation_date  => {TYPE => 'DATETIME', NOTNULL => 1},
        estimated_time => {TYPE => 'TIME'},
        isautomated    => {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => '0'},
        sortkey        => {TYPE => 'INT4'},
        script         => {TYPE => 'MEDIUMTEXT'},
        arguments      => {TYPE => 'MEDIUMTEXT'},
        summary        => {TYPE => 'varchar(255)'},
        requirement    => {TYPE => 'varchar(255)'},
        alias          => {TYPE => 'varchar(255)'},
    ],
    INDEXES => [
        test_case_category_idx      => ['category_id'],
        test_case_author_idx        => ['author_id'],
        test_case_creation_date_idx => ['creation_date'],
        test_case_sortkey_idx       => ['sortkey'],
        test_case_shortname_idx     => ['alias'],
        test_case_requirement_idx   => ['requirement'],
        test_case_status_idx        => ['case_status_id'],
        test_case_tester_idx        => ['default_tester_id'],
    ],
},
$schema->{test_case_bugs} = {
    FIELDS => [
        bug_id      => {TYPE => 'INT3', NOTNULL => 1},
        case_run_id => {TYPE => 'INT4', UNSIGNED => 1},
        case_id     => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
    ],
    INDEXES => [
        case_bugs_bug_id_idx => ['bug_id'],
        case_bugs_case_id_idx => ['case_id'],
        case_bugs_case_run_id_idx => ['case_run_id'],
    ],
},
$schema->{test_case_runs} = {
    FIELDS => [
        case_run_id         => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        run_id              => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        case_id             => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        assignee            => {TYPE => 'INT3'},
        testedby            => {TYPE => 'INT3'},
        case_run_status_id  => {TYPE => 'INT1', NOTNULL => 1, UNSIGNED => 1},
        case_text_version   => {TYPE => 'INT3', NOTNULL => 1},
        build_id            => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        running_date        => {TYPE => 'DATETIME'},
        close_date          => {TYPE => 'DATETIME'},
        notes               => {TYPE => 'TEXT'},
        iscurrent           => {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => '0'},
        sortkey             => {TYPE => 'INT4'},
        environment_id      => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
    ],
    INDEXES => [
        case_run_case_id_idx    => ['case_id'],
        case_run_assignee_idx   => ['assignee'],
        case_run_testedby_idx   => ['testedby'],
        case_run_close_date_idx => ['close_date'],
        case_run_build_env_idx  => {FIELDS => [qw(run_id case_id build_id environment_id)],
                                    TYPE => 'UNIQUE'},
        case_run_status_idx     => ['case_run_status_id'],
        case_run_text_ver_idx   => ['case_text_version'],
        case_run_build_idx_v2   => ['build_id'],
        case_run_env_idx_v2     => ['environment_id'],
    ],
},
$schema->{test_case_texts} = {
    FIELDS => [
        case_id           => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL =>1},
        case_text_version => {TYPE => 'INT3', NOTNULL => 1},
        who               => {TYPE => 'INT3', NOTNULL => 1},
        creation_ts       => {TYPE => 'DATETIME', NOTNULL => 1},
        action            => {TYPE => 'MEDIUMTEXT'},
        effect            => {TYPE => 'MEDIUMTEXT'},
        setup             => {TYPE => 'MEDIUMTEXT'},
        breakdown         => {TYPE => 'MEDIUMTEXT'},
    ],
    INDEXES => [
        case_versions_idx             => {FIELDS => [qw(case_id case_text_version)],
                                          TYPE => 'UNIQUE'},
        case_versions_who_idx         => ['who'],
        case_versions_creation_ts_idx => ['creation_ts'],
    ],
},
$schema->{test_tags} = {
    FIELDS => [
        tag_id   => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        tag_name => {TYPE => 'varchar(255)', NOTNULL => 1},
    ],
    INDEXES => [ test_tag_name_idx_v2 => [qw(tag_name)] ],
},
$schema->{test_case_tags} = {
    FIELDS => [
        tag_id  => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        case_id => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        userid  => {TYPE => 'INT3', NOTNULL => 1},
    ],
    INDEXES => [
        case_tags_primary_idx     => {FIELDS => [qw(tag_id case_id userid)], TYPE => 'UNIQUE'},
        case_tags_secondary_idx   => {FIELDS => [qw(tag_id case_id)], TYPE => 'UNIQUE'},
        case_tags_case_id_idx_v3  => [qw(case_id)],
        case_tags_userid_idx      => [qw(userid)],
    ],
},
$schema->{test_run_tags} = {
    FIELDS => [
        tag_id =>  {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        run_id =>  {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        userid  => {TYPE => 'INT3', NOTNULL => 1},
    ],
    INDEXES => [
        run_tags_primary_idx     => {FIELDS => [qw(tag_id run_id userid)], TYPE => 'UNIQUE'},
        run_tags_secondary_idx   => {FIELDS => [qw(tag_id run_id)], TYPE => 'UNIQUE'},
        run_tags_run_id_idx      => [qw(run_id)],
        run_tags_userid_idx      => [qw(userid)],
    ],
},
$schema->{test_plan_tags} = {
    FIELDS => [
        tag_id  => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        plan_id => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        userid  => {TYPE => 'INT3', NOTNULL => 1},
    ],
    INDEXES => [
        plan_tags_primary_idx     => {FIELDS => [qw(tag_id plan_id userid)], TYPE => 'UNIQUE'},
        plan_tags_secondary_idx   => {FIELDS => [qw(tag_id plan_id)], TYPE => 'UNIQUE'},
        plan_tags_plan_id_idx     => [qw(plan_id)],
        plan_tags_userid_idx      => [qw(userid)],
    ],
},
$schema->{test_plans} = {
    FIELDS => [
        plan_id                 => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        product_id              => {TYPE => 'INT2', NOTNULL => 1},
        author_id               => {TYPE => 'INT3', NOTNULL => 1},
        type_id                 => {TYPE => 'INT1', NOTNULL => 1, UNSIGNED => 1},
        default_product_version => {TYPE => 'MEDIUMTEXT', NOTNULL => 1},
        name                    => {TYPE => 'varchar(255)', NOTNULL => 1},
        creation_date           => {TYPE => 'DATETIME', NOTNULL => 1},
        isactive                => {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => '1'},
    ],
    INDEXES => [
        plan_product_plan_id_idx => [qw(product_id plan_id)],
        plan_author_idx          => ['author_id'],
        plan_type_idx            => ['type_id'],
        plan_isactive_idx        => ['isactive'],
        plan_name_idx            => ['name'],
    ],
},
$schema->{test_plan_permissions} = {
    FIELDS => [
        userid                  => {TYPE => 'INT3', NOTNULL => 1},
        plan_id                 => {TYPE => 'INT4', NOTNULL => 1, UNSIGNED => 1},
        permissions             => {TYPE => 'INT1', NOTNULL => 1},
        grant_type              => {TYPE => 'INT1', NOTNULL => 1},
    ],
    INDEXES => [
        testers_plan_user_idx         => {FIELDS => [qw(userid plan_id grant_type)], TYPE => 'UNIQUE'},
        testers_plan_user_plan_idx    => ['plan_id'],
        testers_plan_grant_idx        => ['grant_type'],
    ],
},
$schema->{test_plan_permissions_regexp} = {
    FIELDS => [
        plan_id                 => {TYPE => 'INT4', NOTNULL => 1, UNSIGNED => 1},
        user_regexp             => {TYPE => 'TEXT', NOTNULL => 1},
        permissions             => {TYPE => 'INT1', NOTNULL => 1},
    ],
    INDEXES => [
        testers_plan_regexp_idx    => {FIELDS => [qw(plan_id)], TYPE => 'UNIQUE'},
    ],
},
$schema->{test_plan_texts} = {
    FIELDS => [
        plan_id           => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        plan_text_version => {TYPE => 'INT4', NOTNULL => 1},
        who               => {TYPE => 'INT3', NOTNULL => 1},
        creation_ts       => {TYPE => 'DATETIME', NOTNULL => 1},
        plan_text         => {TYPE => 'MEDIUMTEXT'},
    ],
    INDEXES => [
        test_plan_text_version_idx => [qw(plan_id plan_text_version)],
        test_plan_text_who_idx     => ['who'],
    ],
},
# Tiny table -- don't add keys besides primary key.
$schema->{test_plan_types} = {
    FIELDS => [
        type_id     => {TYPE => 'TINYSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        name        => {TYPE => 'varchar(64)', NOTNULL => 1},
        description => {TYPE => 'MEDIUMTEXT'},
    ],
},
$schema->{test_runs} = {
    FIELDS => [
        run_id            => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        plan_id           => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        environment_id    => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        product_version   => {TYPE => 'MEDIUMTEXT'},
        build_id          => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        plan_text_version => {TYPE => 'INT4', NOTNULL => 1},
        manager_id        => {TYPE => 'INT3', NOTNULL => 1},
        default_tester_id => {TYPE => 'INT3'},
        start_date        => {TYPE => 'DATETIME', NOTNULL => 1},
        stop_date         => {TYPE => 'DATETIME'},
        summary           => {TYPE => 'TINYTEXT', NOTNULL => 1},
        notes             => {TYPE => 'MEDIUMTEXT'},
    ],
    INDEXES => [
        test_run_plan_id_run_id_idx => [qw(plan_id run_id)],
        test_run_manager_idx        => ['manager_id'],
        test_run_start_date_idx     => ['start_date'],
        test_run_stop_date_idx      => ['stop_date'],
        test_run_env_idx            => ['environment_id'],
        test_run_build_idx          => ['build_id'],
        test_run_plan_ver_idx       => ['plan_text_version'],
        test_run_tester_idx         => ['default_tester_id'],
    ],
},
$schema->{test_case_plans} = {
    FIELDS => [
        plan_id => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        case_id => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
    ],
    INDEXES => [
        test_case_plans_primary_idx => {FIELDS => [qw(plan_id case_id)], TYPE => 'UNIQUE'},
        test_case_plans_case_idx    => [qw(case_id)],
    ],
},
$schema->{test_case_activity} = {
    FIELDS => [
        case_id  => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        fieldid  => {TYPE => 'INT2', UNSIGNED => 1, NOTNULL => 1},
        who      => {TYPE => 'INT3', NOTNULL => 1},
        changed  => {TYPE => 'DATETIME', NOTNULL => 1},
        oldvalue => {TYPE => 'MEDIUMTEXT'},
        newvalue => {TYPE => 'MEDIUMTEXT'},
    ],
    INDEXES => [
        case_activity_case_id_idx => ['case_id'],
        case_activity_who_idx     => ['who'],
        case_activity_when_idx    => ['changed'],
        case_activity_field_idx   => ['fieldid'],
    ],
},
# Tiny table -- don't add keys besides primary key.
$schema->{test_fielddefs} = {
    FIELDS => [
        fieldid     => {TYPE => 'SMALLSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        name        => {TYPE => 'varchar(100)', NOTNULL => 1},
        description => {TYPE => 'MEDIUMTEXT'},
        table_name  => {TYPE => 'varchar(100)', NOTNULL => 1},
    ],
},
$schema->{test_plan_activity} = {
    FIELDS => [
        plan_id  => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        fieldid  => {TYPE => 'INT2', UNSIGNED => 1, NOTNULL => 1},
        who      => {TYPE => 'INT3', NOTNULL => 1},
        changed  => {TYPE => 'DATETIME', NOTNULL => 1},
        oldvalue => {TYPE => 'MEDIUMTEXT'},
        newvalue => {TYPE => 'MEDIUMTEXT'},
    ],
    INDEXES => [
        plan_activity_primary_idx => ['plan_id'],
        plan_activity_field_idx   => ['fieldid'],
        plan_activity_who_idx     => ['who'],
        plan_activity_changed_idx => ['changed'],
    ],
},
$schema->{test_case_components} = {
    FIELDS => [
        case_id      => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        component_id => {TYPE => 'INT2', NOTNULL => 1},
    ],
    INDEXES => [
        components_case_id_idx      => {FIELDS => [qw(case_id component_id)], TYPE => 'UNIQUE'},
        components_component_id_idx => ['component_id'],
    ],
},
$schema->{test_run_activity} = {
    FIELDS => [
        run_id   => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        fieldid  => {TYPE => 'INT2', UNSIGNED => 1, NOTNULL => 1},
        who      => {TYPE => 'INT3', NOTNULL => 1},
        changed  => {TYPE => 'DATETIME', NOTNULL => 1},
        oldvalue => {TYPE => 'MEDIUMTEXT'},
        newvalue => {TYPE => 'MEDIUMTEXT'},
    ],
    INDEXES => [
        run_activity_run_id_idx => ['run_id'],
        run_activity_field_idx  => ['fieldid'],
        run_activity_who_idx    => ['who'],
        run_activity_when_idx   => ['changed'],
    ],
},
$schema->{test_run_cc} = {
    FIELDS => [
        run_id => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        who    => {TYPE => 'INT3', NOTNULL => 1},
    ],
    INDEXES => [
        test_run_cc_primary_idx => {FIELDS => [qw(run_id who)], TYPE => 'UNIQUE'},
        test_run_cc_who_idx => [qw(who)],
    ],
},
$schema->{test_email_settings} = {
    FIELDS => [
        userid          => {TYPE => 'INT3', NOTNULL => 1},
        eventid         => {TYPE => 'INT1', UNSIGNED => 1, NOTNULL => 1},
        relationship_id => {TYPE => 'INT1', UNSIGNED => 1, NOTNULL => 1},
    ],
    INDEXES => [
        test_email_setting_user_id_idx  =>
                                {FIELDS => [qw(userid relationship_id eventid)],
                                 TYPE => 'UNIQUE'},
    ],
},
$schema->{test_events} = {
    FIELDS => [
        eventid => {TYPE => 'INT1', UNSIGNED => 1, PRIMARYKEY => 1, NOTNULL => 1},
        name    => {TYPE => 'varchar(50)'},
    ],
    INDEXES => [
        test_event_name_idx => ['name'],
    ],
},
$schema->{test_relationships} = {
    FIELDS => [
        relationship_id => {TYPE => 'INT1', UNSIGNED => 1, PRIMARYKEY => 1, NOTNULL => 1},
        name            => {TYPE => 'varchar(50)'},
    ],
},
# Tiny table -- don't add keys besides primary key.
$schema->{test_case_run_status} = {
    FIELDS => [
        case_run_status_id => {TYPE => 'TINYSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        name               => {TYPE => 'varchar(20)'},
        sortkey            => {TYPE => 'INT4'},
        description        => {TYPE => 'TEXT'},
    ],
},
# Tiny table -- don't add keys besides primary key.
$schema->{test_case_status} = {
    FIELDS => [
        case_status_id => {TYPE => 'TINYSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        name           => {TYPE => 'varchar(255)', NOTNULL => 1},
        description    => {TYPE => 'TEXT'},
    ],
},
$schema->{test_case_dependencies} = {
    FIELDS => [
        dependson => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        blocked   => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
    ],
    INDEXES => [
        case_dependencies_primary_idx => {FIELDS => [qw(dependson blocked)], TYPE => 'UNIQUE'},
        case_dependencies_blocked_idx => ['blocked'],
    ],
},
$schema->{test_environments} = {
    FIELDS => [
        environment_id  => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        product_id      => {TYPE => 'INT2', NOTNULL => 1},
        name            => {TYPE => 'varchar(255)'},
        isactive        => {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => '1'},
    ],
    INDEXES => [
        test_environments_key1 => {FIELDS => [qw(environment_id product_id)], TYPE => 'UNIQUE'},
        test_environments_key2 => {FIELDS => [qw(product_id name)], TYPE => 'UNIQUE'},
        environment_name_idx_v2     => ['name'],
    ],
},
$schema->{test_builds} = {
    FIELDS => [
        build_id    => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        product_id  => {TYPE => 'INT2', NOTNULL => 1},
        milestone   => {TYPE => 'varchar(20)'},
        name        => {TYPE => 'varchar(255)'},
        description => {TYPE => 'TEXT'},
        isactive    => {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => '1'},
    ],
    INDEXES => [
        build_name_idx            => ['name'],
        build_milestone_idx       => ['milestone'],
        build_product_id_name_idx => {FIELDS => [qw(product_id name)], TYPE => 'UNIQUE'},
        build_prod_idx            => {FIELDS => [qw(build_id product_id)], TYPE => 'UNIQUE'},
    ],
},
$schema->{test_attachment_data} = {
    FIELDS => [
        attachment_id => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        contents      => {TYPE => 'LONGBLOB'},
    ],
    INDEXES => [
        test_attachment_data_primary_idx => ['attachment_id'],
    ],
},
$schema->{test_named_queries} = {
    FIELDS => [
        userid    => {TYPE => 'INT3', NOTNULL => 1},
        name      => {TYPE => 'varchar(64)', NOTNULL => 1},
        isvisible => {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => 1},
        query     => {TYPE => 'MEDIUMTEXT', NOTNULL => 1},
        type      => {TYPE => 'INT3', NOTNULL => 1, DEFAULT => 0},
    ],
    INDEXES => [
        test_namedquery_primary_idx => {FIELDS => [qw(userid name)], TYPE => 'UNIQUE'},
        test_namedquery_name_idx => ['name'],
    ],
},
$schema->{test_environment_map} = {
    FIELDS => [
        environment_id   => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        property_id      => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        element_id       => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        value_selected   => {TYPE => 'TINYTEXT'},
    ],
    INDEXES => [
        env_map_env_element_idx   => [qw(environment_id element_id)],
        env_map_property_idx      => [qw(environment_id property_id)],
        test_environment_map_key3 => {FIELDS => [qw(environment_id element_id property_id)], TYPE => 'UNIQUE'},
    ],
},
$schema->{test_environment_element} = {
    FIELDS => [
        element_id       => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        env_category_id  => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        name             => {TYPE => 'varchar(255)'},
        parent_id        => {TYPE => 'INT4', UNSIGNED => 1},
        isprivate        => {TYPE => 'BOOLEAN', NOTNULL => 1, DEFAULT => 0},
    ],
    INDEXES => [
        test_environment_element_key1 => {FIELDS => [qw(element_id env_category_id)], TYPE => 'UNIQUE'},
        test_environment_element_key2 => {FIELDS => [qw(env_category_id name)], TYPE => 'UNIQUE'},
    ],
},
$schema->{test_environment_category} = {
    FIELDS => [
        env_category_id  => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        product_id       => {TYPE => 'INT2', NOTNULL => 1},
        name             => {TYPE => 'varchar(255)'},
    ],
    INDEXES => [
        test_environment_category_key1 => {FIELDS => [qw(env_category_id product_id)], TYPE => 'UNIQUE'},
        test_environment_category_key2 => {FIELDS => [qw(product_id name)], TYPE => 'UNIQUE'},
    ],
},
$schema->{test_environment_property} = {
    FIELDS => [
        property_id   => {TYPE => 'INTSERIAL', PRIMARYKEY => 1, NOTNULL => 1},
        element_id    => {TYPE => 'INT4', UNSIGNED => 1, NOTNULL => 1},
        name          => {TYPE => 'varchar(255)'},
        validexp      => {TYPE => 'TEXT'},
    ],
    INDEXES => [
        test_environment_property_key1 => {FIELDS => [qw(property_id element_id)], TYPE => 'UNIQUE'},
        test_environment_property_key2 => {FIELDS => [qw(element_id name)], TYPE => 'UNIQUE'},
    ],
},
