#!/usr/bin/perl -w

use strict;
my $vars = Bugzilla->hook_args->{vars};
my $cgi = Bugzilla->cgi;

if ($cgi->param('case_id')) {
    my $case = Bugzilla::Testopia::TestCase->new($cgi->param('case_id'));
    
    $case->attach_bug($vars->{'id'});

    $vars->{'case'} = $case;
}
if ($cgi->param('caserun_id')) {
    my $caserun = Bugzilla::Testopia::TestCaseRun->new($cgi->param('caserun_id'));
    
    $caserun->attach_bug($vars->{'id'});

    $vars->{'caserun'} = $caserun;
}

