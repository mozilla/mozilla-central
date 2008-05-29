#!/usr/bin/perl --
# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Netscape Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/NPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is the Tinderbox build tool.
#
# The Initial Developer of the Original Code is Netscape Communications
# Corporation. Portions created by Netscape are
# Copyright (C) 1998 Netscape Communications Corporation. All
# Rights Reserved.
#
# Contributor(s): 

use strict;
use Tie::IxHash;

require 'tbglobals.pl';
require 'showbuilds.pl';

umask 002;
my $perm = "0660"; # Permission of created files
my $dir_perm = "0770"; # Permission of created dirs

# Process the form arguments
my %form = &split_cgi_args();
my %cookie_jar = &split_cookie_args();

$|=1;

&tb_check_password(\%form, \%cookie_jar);

print "Content-type: text/html\n\n<HTML>\n";

my $command = $form{'command'};
my $tree= $form{'tree'};

if ($command eq 'create_tree') {
    ($tree = $form{'treename'}) =~ s/^.*?([\w\-\.]+).*$/$1/;
} else {
    $tree = &require_only_one_tree($tree);
}

if( $command eq 'create_tree' ){
    &create_tree;
}
elsif( $command eq 'trim_logs' ){
    &trim_logs;
}
elsif( $command eq 'set_status_message' ){
    &set_status_message;
}
elsif( $command eq 'set_rules_message' ){
    &set_rules_message;
}
elsif( $command eq 'set_sheriff' ){
    &set_sheriff;
}
elsif ($command eq 'admin_builds') {
    &admin_builds;
} else {
    print "Unknown command: \"" . value_encode($command) . "\".";
    exit(1);
}

# Recreate static pages after administrative command
tb_build_static(\%form);
exit(0);

sub trim_logs {
    print "<h2>Trimming Log files for $form{'tree'}...</h2><p>\n";
    my $builds_removed = tb_trim_logs($form{'tree'},  $form{'days'}, 1, 1);
    print "<h2>$builds_removed builds removed from build.dat</h2>\n";
    print "<h2><a href=\"showbuilds.cgi?tree=$tree\">Back to tree</a></h2>\n";
}

sub create_tree {
    tie my %treedata => 'Tie::IxHash';
    # make a copy of default_treedata to preserve order
    %treedata = %::default_treedata;
    $treedata{who_days} = $form{'who_days'};
    $treedata{cvs_root} = $form{'repository'};
    $treedata{cvs_module} = $form{'modulename'};
    $treedata{cvs_branch}= $form{'branchname'};
    $treedata{query} = $form{'query'};
    $treedata{bonsai_tree} = $form{'bonsaitreename'};
    $treedata{viewvc_repository} = $form{'viewvc_repository'};

    &tb_load_queryconfig();
    my $query_type = $::QueryInfo{$treedata{query}}{type};
    my $errmsg = "";

    if ($query_type eq "bonsai") {
      for my $var ( 'cvs_module', 'cvs_branch', 'bonsai_tree') {
        next if (defined($treedata{$var}) && "$treedata{$var}" ne "");
        $errmsg = "Must have valid cvs_module, cvs_branch, and bonsai_tree for that query option to work.";
        print "<h1>$errmsg</h1>\n";
        die "$errmsg";
      }
    }
    if ($query_type eq "viewvc") {
      for my $var ('viewvc_repository') {
        next if (defined($treedata{$var}) && "$treedata{$var}" ne "");
        $errmsg = "Must have valid viewvc_repository for that query option to work.";
        print "<h1>$errmsg</h1>\n";
        die "$errmsg";
      }
    }
    if ($query_type eq "bonsai") {
        my $bonsai_dir = $::QueryInfo{$treedata{query}}{directory};
        unless (defined($bonsai_dir) && -d "$bonsai_dir") {
            my $safe_bonsai_dir = value_encode($bonsai_dir);
            $errmsg = "Bonsai directory $safe_bonsai_dir does not exist.";
            print "<h1>$errmsg</h1>\n";
            die "$errmsg";
        }
        unless (defined($treedata{bonsai_tree}) &&
                (-d "$bonsai_dir/data/$treedata{bonsai_tree}" ||
                 -l "$bonsai_dir/data/$treedata{bonsai_tree}")) {
            my $safe_bonsai_tree = value_encode($treedata{bonsai_tree});
            $errmsg = "Bonsai tree $safe_bonsai_tree does not exist.";
            print "<h1>$errmsg</h1>\n";
            die "$errmsg";
        }
    }

    my $treename = shell_escape($tree);
    my $safe_treename = value_encode($tree);

    if( -r $treename ){
        chmod(oct($dir_perm), $treename);
    }
    else {
        mkdir( $treename, oct($dir_perm)) || die "<h1> Cannot mkdir $safe_treename</h1>"; 
    }
    &write_treedata("$::tree_dir/$treename/treedata.pl", \%treedata);

    foreach my $file ( "build.dat", "who.dat", "notes.txt" ) {
        open( F, ">", "$::tree_dir/$treename/$file" );
        close( F );
        chmod (oct($perm), "$::tree_dir/$treename/$file");
    }

    open( F, ">", "$::tree_dir/$treename/index.html");
    print F "<HTML>\n";
    print F "<HEAD><META HTTP-EQUIV=\"refresh\" content=\"0,url=${main::static_rel_path}showbuilds.cgi?tree=$treename\"></HEAD>\n";
    print F "<BODY></BODY>\n";
    print F "</HTML>\n";
    close( F );
    
    chmod (oct($perm), "$::tree_dir/$treename/index.html");

    print "<h2><a href=\"showbuilds.cgi?tree=$treename\">Tree created or modified</a></h2>\n";
}


sub admin_builds {
    my ($i,%active_buildnames, %scrape_buildnames, %warning_buildnames);

    # Read build.dat
    open(BD, "<", "$::tree_dir/$tree/build.dat");
    while(<BD>){
        my ($endtime,$buildtime,$bname) = split( /\|/ );
        $active_buildnames{$bname} = 0;
        $scrape_buildnames{$bname} = 0;
        $warning_buildnames{$bname} = 0;
    }
    close(BD);

    for $i (keys %form) {
        if ($i =~ m/^active_/ ) {
            $i =~ s/^active_//;
            $active_buildnames{$i} = 1;
        } elsif ($i =~ m/^scrape_/ ) {
            $i =~ s/^scrape_//;
            $scrape_buildnames{$i} = 1;
        } elsif ($i =~ m/^warning_/ ) {
            $i =~ s/^warning_//;
            $warning_buildnames{$i} = 1;
        }
    }

    open(IGNORE, ">", "$::tree_dir/$tree/ignorebuilds.pl");
    print IGNORE '$ignore_builds = {' . "\n";
    for $i (sort keys %active_buildnames){
        if ($active_buildnames{$i} == 0){
            print IGNORE "\t\t'$i' => 1,\n";
        }
    }
    print IGNORE "\t};\n";
    close IGNORE;

    open(SCRAPE, ">", "$::tree_dir/$tree/scrapebuilds.pl");
    print SCRAPE '$scrape_builds = {' . "\n";
    for $i (sort keys %scrape_buildnames){
        if ($scrape_buildnames{$i} == 1){
            print SCRAPE "\t\t'$i' => 1,\n";
        }
    }
    print SCRAPE "\t};\n";
    close SCRAPE;

    open(WARNING, ">", "$::tree_dir/$tree/warningbuilds.pl");
    print WARNING '$warning_builds = {' . "\n";
    for $i (sort keys %warning_buildnames){
        if ($warning_buildnames{$i} == 1){
            print WARNING "\t\t'$i' => 1,\n";
        }
    }
    print WARNING "\t};\n";
    close WARNING;

    chmod( oct($perm), "$::tree_dir/$tree/ignorebuilds.pl", 
           "$::tree_dir/$tree/scrapebuilds.pl",
           "$::tree_dir/$tree/warningbuilds.pl");
    print "<h2><a href=showbuilds.cgi?tree=$tree>Build state Changed</a></h2>\n";
}
sub set_sheriff {
    my $m = $form{'sheriff'};
    $m =~ s/\'/\\\'/g;
    open(SHERIFF, ">", "$::tree_dir/$tree/sheriff.pl");
    print SHERIFF "\$current_sheriff = '$m';\n1;";
    close(SHERIFF);
    chmod( oct($perm), "$::tree_dir/$tree/sheriff.pl");
    print "<h2><a href=showbuilds.cgi?tree=$tree>
            Sheriff Changed.</a><br></h2>\n";
}

sub set_status_message {
    my $m = $form{'status'};
    $m =~ s/\'/\\\'/g;
    open(TREESTATUS, ">", "$::tree_dir/$tree/status.pl");
    print TREESTATUS "\$status_message = \'$m\'\;\n1;";
    close(TREESTATUS);
    chmod( oct($perm), "$::tree_dir/$tree/status.pl");
    print "<h2><a href=showbuilds.cgi?tree=$tree>
            Status message changed.</a><br></h2>\n";
}

sub set_rules_message {
    my $m = $form{'rules'};
    $m =~ s/\'/\\\'/g;
    open(RULES, ">", "$::tree_dir/$tree/rules.pl");
    print RULES "\$rules_message = \'$m\';\n1;";
    close(RULES);
    chmod( oct($perm), "$::tree_dir/$tree/rules.pl");
    print "<h2><a href=showbuilds.cgi?tree=$tree>
            Rule message changed.</a><br></h2>\n";
}

