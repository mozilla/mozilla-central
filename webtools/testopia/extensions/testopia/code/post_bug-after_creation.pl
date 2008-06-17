#!/usr/bin/perl -w

use strict;
use Bugzilla::Testopia::TestCase;

my $vars = Bugzilla->hook_args->{vars};
my $cgi = Bugzilla->cgi;

my $caserun_id = $cgi->param('caserun_id');
my $case_id = $cgi->param('case_id'); 
if (detaint_natural($case_id)) {
    my $case = Bugzilla::Testopia::TestCase->new($cgi->param('case_id'));
    ThrowUserError("invalid-test-id-non-existent", {'id' => $case_id, 'type' => 'Case'}) unless $case;
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;
    
    $case->attach_bug($vars->{'id'});

    $vars->{'case'} = $case;
}
if (detaint_natural($caserun_id)) {
    my $caserun = Bugzilla::Testopia::TestCaseRun->new($cgi->param('caserun_id'));
    ThrowUserError("invalid-test-id-non-existent", {'id' => $caserun_id, 'type' => 'Case-Run'}) unless $caserun;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    
    $caserun->attach_bug($vars->{'id'});

    $vars->{'caserun'} = $caserun;
}

