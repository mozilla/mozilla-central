#!/usr/bin/perl -wT
# -*- Mode: perl; indent-tabs-mode: nil -*-

# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is the Hendrix Feedback System.
#
# The Initial Developer of the Original Code is
# Gervase Markham.
# Portions created by the Initial Developer are Copyright (C) 2004
# the Initial Developer. All Rights Reserved.
#
# Contributor(s): Reed Loden <reed@reedloden.com>
#
# The Initial Developer wrote this software to the Glory of God.
# ***** END LICENSE BLOCK *****

use strict;

# This application requires installation of the "Email::Send" (note: not 
# Mail::Send) module.
use Template;
use CGI;
use Email::Send;
use Net::RBLClient;

# use CGI::Carp qw(fatalsToBrowser);

# Configuration

# Map products to destination
my %product_destination_map = (
	"Firefox" => "mozilla.feedback",
	"Thunderbird" => "mozilla.feedback",
	"Mozilla Suite" => "mozilla.feedback",
	"SeaMonkey" => "mozilla.feedback",
	"Sunbird" => "mozilla.feedback",
	"Camino" => "caminofeedback\@mozilla.org",
	"Bon Echo" => "mozilla.feedback",
	"Gran Paradiso" => "mozilla.feedback",
	"Minefield" => "mozilla.feedback",
	"eBay Companion" => "mozilla.feedback.companion.ebay",
	"Other" => "mozilla.feedback"
);

# List of products to show on the main Hendrix page (in order)
my @products_list = (
	"Firefox", "Thunderbird", "Mozilla Suite", 
	"SeaMonkey", "Sunbird", "Camino", "Bon Echo",
	"Gran Paradiso", "Minefield", "Other"
);

# The default newsgroup if the product isn't in the above map (NNTP only)
my $default_newsgroup = $::ENV{'HENDRIX_NEWSGROUP'} || "mozilla.feedback";

# The news (NNTP) server to use for posting
my $nntp_server = $::ENV{'HENDRIX_NNTP_SERVER'} || "news.mozilla.org";

# The default sender to use if no e-mail address is provided
my $default_sender = $::ENV{'HENDRIX_SENDER'} || "hendrix-no-reply\@mozilla.org";

# The mail (SMTP) server to use for posting
my $smtp_server = $::ENV{'HENDRIX_SMTP_SERVER'} || "smtp.mozilla.org";

# The CSS file to include in the template
my $skin = $::ENV{'HENDRIX_SKIN'} || "skin/planet.css";

# The DNS blacklists by which to check sender IP addresses
my $rbl = Net::RBLClient->new(
    lists => [
        'dnsbl.ahbl.org',
        'http.dnsbl.sorbs.net',
        'socks.dnsbl.sorbs.net',
        'misc.dnsbl.sorbs.net',
    ],
    query_txt => 1
);

my $cgi = new CGI;
my $form = $cgi->Vars;
my $vars;
$vars->{'form'} = $form;
$vars->{'products'} = \@products_list;
$vars->{'stylesheet'} = $skin;

my $template = Template->new({
    INCLUDE_PATH => ["template"],
    PRE_CHOMP => 1,
    TRIM => 1,
    FILTERS => {
        email => \&emailFilter,
        remove_newlines => \&removeNewlinesFilter,
    },
}) || die("Template creation failed.\n");

my $action = $cgi->param("action");

if (!$action) {
    # If no action, show the submission form
    print "Content-Type: text/html\n\n";
    $template->process("index.html.tmpl", $vars)
      || die("Template process failed: " . $template->error() . "\n");
}
elsif ($action eq "submit") {
    # Simple Mozilla-specific hotfix against spam, 2006-10-13
    if (($form->{'subject'} eq 'LINKS') && 
        ($form->{'product'} eq 'Firefox 2 Beta 1')) {
      throwError("like_spam");
    }

    # Check the poster's IP against some blacklists
    $rbl->lookup($::ENV{REMOTE_ADDR});
    my %rbl_results = $rbl->txt_hash();
    if (scalar(keys %rbl_results) > 0) {
      $vars->{'rbl_results'} = \%rbl_results;
      throwError("rbl_hit");
    }

    # Format the parameters and send to the newsgroup.
    
    # Check for compulsory parameters
    if (!$form->{'name'} || !$form->{'subject'} || !$form->{'product'}) {
      throwError("bad_parameters");
    }

    $vars->{'destination'} = $product_destination_map{$form->{'product'}} || $default_newsgroup;
    $vars->{'method'} = $vars->{'destination'} =~ /@/ ? "SMTP" : "NNTP";
    $vars->{'email'} = $form->{'email'} =~ /d:^[\w\.\+\-=]+@[\w\.\-]+\.[\w\-]+$:/ ? $form->{'email'} : $default_sender;

    my $message;
    my $headers;
    
    $template->process("message-headers.txt.tmpl", $vars, \$headers)
      || die("Template process failed: " . $template->error() . "\n");
    $template->process("message.txt.tmpl", $vars, \$message)
      || die("Template process failed: " . $template->error() . "\n");

    # Post formatted message to newsgroup/email
    my $theMsg = Email::Simple->new($headers . "\n\n" . $message);
    my $sender = Email::Send->new({
        mailer      => $vars->{'method'},
        mailer_args => [ Host => $vars->{'method'} eq "SMTP" ? $smtp_server : $nntp_server ],
    });
    my $success = $sender->send($theMsg);

    # Give user feedback on success/failure
    $vars->{'headers'} = $headers;
    $vars->{'message'} = $message;

    throwError("cant_post") if (!$success);
    
    print "Content-Type: text/html\n\n";
    $template->process("submit-successful.html.tmpl", $vars)
      || die("Template process failed: " . $template->error() . "\n");
}
else {
    die("Unknown action $action\n");
}

exit;

# Simple email obfuscation
sub emailFilter {
    my ($var) = @_;
    $var =~ s/\@/at/;
    $var =~ s/\./dot/g;
    return $var;
}

# Remove newlines and replace them with spaces
sub removeNewlinesFilter {
    my ($var) = @_;
    $var =~ s/\r\n/ /g;
    $var =~ s/\n\r/ /g;
    $var =~ s/\r/ /g;
    $var =~ s/\n/ /g;
    return $var;
}

sub throwError {
    my ($error) = @_;
    $vars->{'error'} = $error;
    
    print "Content-Type: text/html\n\n";
    $template->process("error.html.tmpl", $vars)
      || die("Template process failed: " . $template->error() . "\n");
    
    exit;
}
