#!/usr/bin/perl

use strict;
use warnings;
use CGI qw/:standard/;
use LWP::Simple qw/!head/;

# File: sendchange.cgi
# Author: Ben Hearsum
# Description:
#   This cgi script displays a simple form that allows a user to submit a diff
#   that will eventually be uploaded to a Buildbot master.
#   It can also be used to point a Buildbot master at a set of Mercurial
#   repositories to build from.
#   This script generates a .info file that contains the
#   name of the submitter, as read from $ENV['REMOTE_USER'], the date in unix
#   time, the description read from the form, and the relevant change
#   information (patch file/repository locations).
#   This information is used by the download script to generate the
#   'buildbot sendchange' command.


# where patches and info files will go after being submitted
my $PATCH_DIR = '/buildbot/patches';
# the size limit for the file, in bytes
# 10*1024*1024 is 10MB
my $SIZE_LIMIT = 10*1024*1024;
# the URL to the buildbot installation the patches will eventually go to
my $BUILDBOT_URL = 'http://localhost:8010';
# the URL to the uploadpatch.cgi script
my $UPLOADPATCH_URL = 'http://localhost/cgi-bin/sendchange.cgi';

$CGI::POST_MAX = $SIZE_LIMIT;

sub WriteSuccessPage
{
    print "Content-type: text/html\n\n";
    print <<__END_OF_HTML__;
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
          "http://www.w3.org/TR/html4/strict.dtd">
<html lang="en">

<head><title>Patch uploaded successfully</title></head>

<body>
<h3 style="text-align: center">Patch Uploaded Successfully</h3>
<div style="text-align: center">
  Look for your patch <a href="$BUILDBOT_URL">here</a>
</div>
</body>
</html>
__END_OF_HTML__

}

sub WritePage
{
    my %args = @_;
    my $description = "";
    my $type = "patch";
    my $branch = "HEAD";
    my $mozillaRepoPath = "http://hg.mozilla.org/mozilla-central";
    my $tamarinRepoPath = "http://hg.mozilla.org/tamarin-central";
    my $err = "";
    if ($args{'description'}) {
        $description = $args{'description'};
    }
    if ($args{'type'}) {
        $type = $args{'type'};
    }
    if ($args{'branch'}) {
        $branch = $args{'branch'};
    }
    if ($args{'mozillaRepoPath'}) {
        $mozillaRepoPath = $args{'mozillaRepoPath'};
    }
    if ($args{'tamarinRepoPath'}) {
        $tamarinRepoPath = $args{'tamarinRepoPath'};
    }
    if ($args{'err'}) {
        $err = $args{'err'};
    }
    my $limit = $SIZE_LIMIT / 1024;

    print "Content-type: text/html\n\n";
    print <<__END_OF_HTML__;
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
          "http://www.w3.org/TR/html4/strict.dtd">
<html lang="en">

<head>
<title>Test your code with Buildbot</title>
<style type="text/css">
  body {
    margin-left: auto;
    margin-right: auto;
  }

  div {
    text-align: center;
  }

  p {
    text-align: center;
    color: red;
    font-weight: bold;
  }

  table {
    width: 70%;
    margin-left: auto;
    margin-right: auto;
  }

  td {
    margin-top: 2px;
    margin-bottom: 2px;
    border: none;
    width: 50%;
  }

  tr#title {
    padding-bottom: 6px;
  }

  th {
    text-align: center;
  }

  td.lbl {
    text-align: right;
    vertical-align: middle;
  }

  td.field {
    text-align: left;
  }
</style>
<script type="text/javascript">
function disable(id) {
    var element = document.getElementById(id);
    element.disabled = "disabled";
    element.style.backgroundColor = "#D4D0C8";
}

function enable(id) {
    var element = document.getElementById(id);
    element.disabled = "";
    element.style.backgroundColor = "white";
}
</script>

</head>

<body
__END_OF_HTML__
    if ($type == "patch") {
        print "onload=\"enable('patchfile'); enable('branch'); "
            . "disable('mozilla-repo'); disable('tamarin-repo')\"";
    } else {
        print "onload=\"disable('patchfile'); disable('branch'); "
            . "enable('mozilla-repo'); enable('tamarin-repo')\"";
    }
    print ">";
    print <<__END_OF_HTML__;

<form action="$UPLOADPATCH_URL" method="post"
      enctype="multipart/form-data">
<div>
<table>
  <tr id="title">
    <th colspan="2">Test your code with Buildbot</th>
  </tr>
  <tr>
    <td>
      <table>
        <tr>
          <th colspan="2"><input type="radio" name="type" value="patch" 
__END_OF_HTML__
    if ($type eq "patch") {
        print 'checked="checked" ';
    }
    print <<__END_OF_HTML__;
            onclick="enable('patchfile'); enable('branch');
            disable('mozilla-repo'); disable('tamarin-repo')" />
            Upload a patch:
          </th>
        </tr>
        <tr>
          <td class="lbl">Patch:</td>
          <td class="field">
            <input id="patchfile" type="file" name="patchfile" />
          </td>
        </tr>
        <tr>
          <td class="lbl">Branch:</td>
          <td class="field">
            <input id="branch" type="text" name="branch" value="$branch"  />
          </td>
        </tr>
      </table>
    </td>
    <td>
      <table>
        <tr>
          <th colspan="2">
            <input type="radio" name="type" value="hg" 
__END_OF_HTML__
    if ($type eq "hg") {
        print 'checked="checked" ';
    }
    print <<__END_OF_HTML__;
            onclick="disable('patchfile'); disable('branch');
            enable('mozilla-repo'); enable('tamarin-repo')" />
            Test a Mercurial repository:
          </th>
        </tr>
        <tr>
          <td class="lbl">Mozilla repository:</td>
          <td class="field">
            <input id="mozilla-repo" type="text" name="mozilla-repo" 
              value="$mozillaRepoPath" />
          </td>
        </tr>
        <tr>
          <td class="lbl">Tamarin repository:</td>
          <td class="field">
            <input id="tamarin-repo" type="text" name="tamarin-repo" 
              value="$tamarinRepoPath" />
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td colspan="2">Description:</td>
  </tr>
  <tr>
    <td colspan="2">
      <textarea name="description" cols="35" rows="6">$description</textarea>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <input type="submit" value="Submit" />
    </td>
  </tr>
</table>
</div>

</form>
<p>Note: Uploaded files must be less than ${limit}kB</p>
__END_OF_HTML__

    if ($err) {
        print "<p>$err</p>";
    }
    print "</body>\n</html>";
}

sub Process
{
    my $time = time();
    # get the parameters
    my $name = $ENV{'REMOTE_USER'};
    my $description = param('description');
    my $type = param('type');
    my $patchFile = param('patchfile');
    my $branch = param('branch');
    my $mozillaRepoPath = param('mozilla-repo');
    my $tamarinRepoPath = param('tamarin-repo');
    my ($filename, $infoFile);

    my %args = (
        description     => $description,
        type            => $type,
        branch          => $branch,
        mozillaRepoPath => $mozillaRepoPath,
        tamarinRepoPath => $tamarinRepoPath
    );

    if (! $name) {
        $args{'err'} = 'You must be logged in to use this service';
        WritePage(%args);
        return;
    }

    if ($description eq '') {
        $description = 'No description given.';
    }

    # only allow alphanumeric, '_', and whitespace
    if ($description =~ m/[^\w\s]/) {
        $args{'err'} = 'Description must only contain alphanumeric characters,'
          . " '_' and whitespace";
        WritePage(%args);
        return;
    }
    $description =~ s/\n//g;

    # Using a patchfile
    if ($type eq "patch") {
        if ($branch eq '') {
            $branch = 'HEAD';
        } elsif ($branch eq 'trunk' || $branch eq '') {
            $branch = 'HEAD';
        } else {
            # only allow alphanumeric plus '_'
            if ($branch =~ /[^\w]/) {
                $args{'err'} = 'Branch must only contain alphanumeric '
                  . "characters or '_'";
                WritePage(%args);
                return;
            }
            $branch =~ s/\n//g;
        }

        # only allow alphanumeric, hyphens, and single dots
        if ($patchFile !~ /^([\w-]|\.[\w-])+$/) {
            $args{'err'} = 'Invalid filename. Please use only alphanumeric, '
              . '-, _, and single dots';
            WritePage(%args);
            return;
        }

        # if we get here the file is small enough and passes the filename test

        # pull all of the contents of the file
        my $patchHandle = upload('patchfile');

        # strip off everything except the filename itself
        $patchFile =~ s/.*[\/\\](.*)/$1/;

        # generate the filenames
        $patchFile = "$time-$patchFile";
        $infoFile = "$patchFile.info";

        # make sure the file has a non-zero length
        # this also handles a case where the file specified doesn't exist
        if (-z $patchHandle) {
            $args{'err'} = 'Specified file has a length of zero';
            WritePage(%args);
            return;
        }

        # write the patch
        $filename = "$PATCH_DIR/$patchFile";
        if (! open(PATCH, ">$filename")) {
            $args{'err'} = 'Server error - Could not open file for writing';
            WritePage(%args);
            return;
        }
        binmode PATCH;
    
        while (<$patchHandle>) {
            print PATCH;
        }
        close PATCH;
    } elsif ($type eq "hg") {
        # TODO: is this a valid way to test if there's a repo there?
        if (get($mozillaRepoPath) eq '') {
            $args{'err'} = 'Mozilla repository path is not valid';
            WritePage(%args);
            return;
        }

        if (get($tamarinRepoPath) eq '') {
            $args{'err'} = 'Tamarin repository path is not valid';
            WritePage(%args);
            return;
        }

        # generate the infofile name
        $infoFile = "$time-hg.info";
    }

    # now write the infofile
    $filename = "$PATCH_DIR/$infoFile";

    if (! open(INFO, ">$filename")) {
        $args{'err'} = 'Server error - Could not open file for writing';
        WritePage(%args);
        return;
    }

    print INFO "submitter: $name\n";
    print INFO "date: $time\n";
    print INFO "type: $type\n";
    if ($type eq "patch") {
        print INFO "patchfile: $patchFile\n";
        print INFO "branch: $branch\n";
    } elsif ($type eq "hg") {
        print INFO "mozilla-repo: $mozillaRepoPath\n";
        print INFO "tamarin-repo: $tamarinRepoPath\n";
    }
    print INFO "description: $description\n";

    close(INFO);

    WriteSuccessPage();
}

if (param()) {
    Process();
} else {
    WritePage();
}
