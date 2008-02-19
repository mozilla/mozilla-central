#!/usr/bin/perl -wT
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

use strict;
use lib ".";

use Bugzilla;
use Bugzilla::Util;
use Bugzilla::Constants;
use Bugzilla::Error;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Attachment;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::Constants;

my $vars = {};
my $template = Bugzilla->template;
my $cgi = Bugzilla->cgi;
my $dbh = Bugzilla->dbh;

Bugzilla->login(LOGIN_REQUIRED);
Bugzilla->error_mode(ERROR_MODE_AJAX) if $cgi->param('ctype') eq 'json';

my $action     = $cgi->param('action') || '';
my $attach_id  = $cgi->param('attach_id');

detaint_natural($attach_id) if $attach_id;
if (!$attach_id and $cgi->param('ctype') ne 'json'){
    print $cgi->header();
    $template->process("testopia/attachment/choose.html.tmpl", $vars) 
        || ThrowTemplateError($template->error());
    exit;
}

##################
###    Edit    ###
##################
if ($action eq 'edit') {
	print $cgi->header;
	validate_test_id($attach_id,'attachment');
    my $attachment = Bugzilla::Testopia::Attachment->new($attach_id);
	
    ThrowUserError('testopia-permission-denied', {'object' => $attachment}) unless $attachment->canedit;

    $attachment->set_description($cgi->param('description')) if $cgi->param('description');
    $attachment->set_filename($cgi->param('filename')) if $cgi->param('filename');
    $attachment->set_mime_type($cgi->param('mime_type')) if $cgi->param('mime_type');
    $attachment->update();

    print "{success: true}";
}

####################
###    Unlink    ###
####################

elsif ($action eq 'remove') {
	print $cgi->header;
	my $item    = $cgi->param('object');
	my $item_id = $cgi->param('object_id');
    my $obj;
 
    if ($item eq 'case'){
      	$obj = Bugzilla::Testopia::TestCase->new($item_id);
    }
    elsif ($item eq 'plan'){
    	$obj = Bugzilla::Testopia::TestPlan->new($item_id);
    }
	elsif ($item eq 'caserun'){
		$obj = Bugzilla::Testopia::TestCaseRun->new($item_id);
		$obj = $obj->case;
	}

    ThrowUserError('testopia-missing-parameter', {'param' => 'case_id or plan_id'}) unless $obj;

	foreach my $attach_id (split(',', $cgi->param('attach_ids'))){
    	validate_test_id($attach_id,'attachment');
        my $attachment = Bugzilla::Testopia::Attachment->new($attach_id);
    	
    	ThrowUserError('testopia-no-delete', {'object' => $attachment}) unless $attachment->canedit;
    	        
        if ($obj->type eq 'plan'){
            $attachment->unlink_plan($obj->id);
        }
        elsif ($obj->type eq 'case'){
            $attachment->unlink_case($obj->id);
        }
	}

    print "{success: true}";
}

####################
###    Delete    ###
####################

elsif ($action eq 'delete') {
	print $cgi->header;

	validate_test_id($attach_id,'attachment');
    my $attachment = Bugzilla::Testopia::Attachment->new($attach_id);
    
    $vars->{'tr_message'} = "Attachment ". $attachment->description ." deleted";
    ThrowUserError('testopia-no-delete', {'object' => $attachment}) unless $attachment->candelete;
    
    $attachment->obliterate;
    $vars->{'tr_message'} = "Attachment deleted";
    $vars->{'deleted'} = 1;
    $template->process("testopia/attachment/delete.html.tmpl", $vars)
        || ThrowTemplateError($template->error());

}
elsif ($action eq 'add'){
    print $cgi->header;
	
	my $item    = $cgi->param('object');
	my $item_id = $cgi->param('object_id');
    my $obj;
    my $att;      
    if ($item eq 'case'){
      	$obj = Bugzilla::Testopia::TestCase->new($item_id);
      	$att->{'case_id'} = $obj->id;
    }
    elsif ($item eq 'plan'){
    	$obj = Bugzilla::Testopia::TestPlan->new($item_id);
    	$att->{'plan_id'} = $obj->id;
    }
	elsif ($item eq 'caserun'){
		$obj = Bugzilla::Testopia::TestCaseRun->new($item_id);
	    $att->{'caserun_id'} = $obj->id;
	    $att->{'case_id'} = $obj->case_id;
	}
    
    ThrowUserError("testopia-read-only", {'object' => $obj}) unless $obj->canedit;

    defined $cgi->upload('data')
        || ThrowUserError("file_not_specified");
        
    my $fh = $cgi->upload('data');
    my $data;
    # enable 'slurp' mode
    local $/;

    $data = <$fh>;       
    $data || ThrowUserError("zero_length_file");
    
    $att->{'submitter_id'} = Bugzilla->user->id;
    $att->{'description'}  = $cgi->param("description") || 'Attachment';
    $att->{'filename'}     = $cgi->upload("data");
    $att->{'mime_type'}    = $cgi->uploadInfo($cgi->param("data"))->{'Content-Type'};
    $att->{'contents'}     = $data;

    my $attachment = Bugzilla::Testopia::Attachment->create($att);

    print "{success: true}";
}

################
###   List   ###
################
elsif ($action eq 'list') {
	my $format = $template->get_format("testopia/attachment/list", scalar $cgi->param('format'), scalar $cgi->param('ctype'));
	print $cgi->header;

	my $item    = $cgi->param('object');
	my $item_id = $cgi->param('object_id');
    my $obj;
 
    if ($item eq 'case'){
      	$obj = Bugzilla::Testopia::TestCase->new($item_id);
    }
    elsif ($item eq 'plan'){
    	$obj = Bugzilla::Testopia::TestPlan->new($item_id);
    }
	elsif ($item eq 'caserun'){
		$obj = Bugzilla::Testopia::TestCaseRun->new($item_id);
	}
	
	my @attachments = @{$obj->attachments};
	
	my $out = '';
    $out .= '{';
    $out .= '"totalResultsAvailable":' . scalar @attachments .',';
    $out .= '"attachment":[';
    foreach my $i (@attachments){
        $out .= $i->to_json($cgi) . ',' if $i->canview;
    }
    chop($out) if scalar @attachments;
    $out .= ']}';

    $vars->{'json'} = $out;
    $template->process($format->{'template'}, $vars)
        || ThrowTemplateError($template->error());
    exit;
}

################
###   View   ###
################
else {
    validate_test_id($attach_id,'attachment');
    my $attachment = Bugzilla::Testopia::Attachment->new($attach_id);
    
    ThrowUserError("attachment_removed") if $attachment->datasize == 0;
    
    my $filename = $attachment->filename;
    $filename =~ s/\\/\\\\/g; # escape backslashes
    $filename =~ s/"/\\"/g; # escape quotes
    
    print $cgi->header(-type => $attachment->mime_type . "; name=\"$filename\"",
                       -content_disposition => "inline; filename=\"$filename\"",
                       -content_length      => $attachment->datasize);

    print $attachment->contents;
}
