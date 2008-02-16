#!/usr/bin/perl -w

use strict;
my $vars = Bugzilla->hook_args->{vars};
my $cgi = Bugzilla->cgi;

$vars->{'case_id'} = $cgi->param('case_id');
$vars->{'caserun_id'} = $cgi->param('caserun_id');