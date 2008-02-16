#!/usr/bin/perl -wT

use strict;

use lib ".";

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Error;
use Bugzilla::Util;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::TestCase;
use JSON;

local our $vars = {};
local our $template = Bugzilla->template;
Bugzilla->error_mode(ERROR_MODE_AJAX);
Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;

my $action = $cgi->param("action");

print "Location: tr_show_product.cgi\n\n" unless $action;

print $cgi->header;

my $obj;
if ($cgi->param('object') eq 'plan'){
    $obj = Bugzilla::Testopia::TestPlan->new($cgi->param('object_id'));
}
elsif ($cgi->param('object') eq 'case'){
    $obj = Bugzilla::Testopia::TestCase->new($cgi->param('object_id'));
}
else{
    ThrowUserError("testopia-unknown-type", {'object' => $obj});
}
ThrowUserError("testopia-permission-denied", {'object' => $obj}) unless $obj->canview;

my $type   = $cgi->param("type");
my $id     = trim($cgi->param("id"));

if ($action eq 'diff')
{
	if ($type eq 'plan')
	{
		print $cgi->header;
		
	    my $plan = Bugzilla::Testopia::TestPlan->new($id);
	    
	    ThrowUserError("testopia-permission-denied", {'object' => $plan}) unless $plan->canview;
	    
	    $vars->{'plan'} = $plan; 
	    $vars->{'diff'} = $plan->diff_plan_doc($cgi->param('new'),$cgi->param('old'));
	    $vars->{'new'}  = $cgi->param('new');
	    $vars->{'old'}  = $cgi->param('old');
	    
	    $template->process("testopia/plan/history.html.tmpl", $vars)
	      || ThrowTemplateError($template->error());
	}
	elsif ($type eq 'case')
	{
		
	}
}

elsif ($action eq 'showdoc'){
    if ($obj->type eq 'plan'){
        $vars->{'text'} = $obj->text($cgi->param('version')); 
        $template->process("testopia/plan/history.html.tmpl", $vars)
            || ThrowTemplateError($template->error());
    }
    elsif ($obj->type eq 'case'){
        $vars->{'text'} = $obj->text($cgi->param('version')); 
        $template->process("testopia/case/history.html.tmpl", $vars)
            || ThrowTemplateError($template->error());
    }
}

elsif ($action eq 'show'){
    my $json = new JSON;
    print "{list:";
    print $json->objToJson($obj->history);
    print "}";
    
}

elsif ($action eq 'getdocversions'){
    my $json = new JSON;
    print "{list:";
    print $json->objToJson($obj->get_text_versions);
    print "}";
}

