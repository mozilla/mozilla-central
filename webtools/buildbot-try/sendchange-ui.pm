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
# The Original Code is Try server submission form.
#
# The Initial Developer of the Original Code is
# Mozilla Corporation.
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Ben Hearsum <bhearsum@mozilla.com>
#   Johnathan Nightingale <johnath@mozilla.com>
# ***** END LICENSE BLOCK *****

# Description:
#   This file is require'd by sendchange.cgi. It provides the UI for the cgi
#   form.

use strict;
use warnings;

# essentially, the size limit for the file. (in reality, the size limit for
# the POST as a whole)
# 10*1024*1024 is 10MB
my $SIZE_LIMIT = 10*1024*1024;
# the URL to the buildbot insntallation the patches will eventually go to
my $BUILDBOT_URL = 'http://tinderbox.mozilla.org/MozillaTry/';
# the URL to the sendchange.cgi script
my $SENDCHANGE_URL = 'http://localhost/cgi-bin/sendchange.cgi';
# the default path to the mozilla-central hg repository
my $MOZILLA_REPO_PATH = 'http://hg.mozilla.org/mozilla-central';
# the default path to the tamarin-central hg repository
my $TAMARIN_REPO_PATH = 'http://hg.mozilla.org/tamarin-central';
# the URL to the try server documentation
my $DOCUMENTATION_URL = 'http://wiki.mozilla.org/Build:TryServer';

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
    my $patchLevel = "0";
    my $branch = "";
    my $identifier = "";
    my $description = "";
    my $type = "patch";
    my $mozillaRepoPath = $MOZILLA_REPO_PATH;
    my $tamarinRepoPath = $TAMARIN_REPO_PATH;
    my @err;
    if (exists $args{'patchLevel'} && $args{'patchLevel'} !~ /^\s*$/) {
        $patchLevel = $args{'patchLevel'};
    }
    if (exists $args{'branch'} && $args{'branch'} !~ /^\s*$/) {
        $branch = $args{'branch'};
    }
    if (exists $args{'identifier'} && $args{'identifier'} !~ /^\s*$/) {
        $identifier = $args{'identifier'};
    }
    if (exists $args{'description'} && $args{'description'} !~ /^\s*$/) {
        $description = $args{'description'};
    }
    if (exists $args{'type'} && $args{'type'} !~ /^\s*$/) {
        $type = $args{'type'};
    }
    if (exists $args{'mozillaRepoPath'} &&
      $args{'mozillaRepoPath'} !~ /^\s*$/) {
        $mozillaRepoPath = $args{'mozillaRepoPath'};
    }
    if (exists $args{'tamarinRepoPath'} &&
      $args{'tamarinRepoPath'} ne "") {
        $tamarinRepoPath = $args{'tamarinRepoPath'};
    }
    if (exists $args{'err'}) {
        @err = @{$args{'err'}};
    }
    my $limit = $SIZE_LIMIT / 1024;

    print "Content-type: text/html\n\n";
    print <<__END_OF_HTML__;
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
          "http://www.w3.org/TR/html4/strict.dtd">
<html lang="en">

<head>
<title>MozillaTry Buildbot Test Page</title>
<!-- Favicon courtesy of FAMFAMFAM silk - http://famfamfam.com/ -->
<link rel="shortcut icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAHMSURBVDjLlZLBSyJhGMa/UxTUIWJ0ZVmlwxLLEiEhurCoKeqCOtZN7J4ZRZdd9rSG6NFbSOegDp5aqWWI3UGm6KBUxsq2LLj+CzV9jDOH8NlvJtqLjuXhBy/z8Xvel4chAMhTKGfOMeVsbqXf2wBp3s5Yf5hno8rp24YxS9PTVHq18mTAgzj3k4mCIs0cqZeLUCTHJ1q13VKRSz0v4PRNVr1KQfu9Aa31BZ2LKKg42aHfJ8ZNA9i5L9hWUZFeQ73kof3N42SPR6OyjFZ1FZ36AuQfo5CPyc7gDiRHttNYwsl+Apqmodvt4uJrCur1GmSB/GI4TAOo9JKjVasQi8VQr9ehqiqazSaqu1Fofz5C/kYow9M3gJVkp+JUJZFIIJ1Oo1gsolwu42hngcmfdfmecS4fki3TC3ieN2SPx4NAIIB4PA7lPIo70YY7YQJyhdhNS3yU3W43/H4/LBaLvnWbbbxnvGNyQz4gmb4ByWQShULBkH0+HziOg/6die+ZKOjzzQEZYXzoCYhEIsjn8z3yI0wKmf7KwWAQuVwOLpcLXq+3Rx4EyWQyaLfbcDqdCIVCQ8n/A2q1GkqlklHYMLIREA6HN/WzrVbr0LLOP1AMs7UPAa92AAAAAElFTkSuQmCC"/>
<style type="text/css">
  body {
    /* Background image courtesy of flickr user Compound Eye, http://flickr.com/photos/paopix/199190129 */
    background: #FFF url('background.jpg') no-repeat fixed top left;
    margin-left: auto;
    margin-right: auto;
    font-family: sans-serif;
  }

  #main {
    text-align: left;
  }

  #types {
    width: 75%;
    margin: 20px auto;
    border: 3px solid #AAA;
    background-color: #EFF;
    padding: 10px;
    -moz-border-radius: 10px;
  }

  h3 {
    margin-bottom: 1em;
  }

  .alert {
    text-align: center;
    color: red;
  }

  table {
    margin-left: auto;
    margin-right: auto;
    width: 80%;
  }

  td {
    padding-top: 2px;
    padding-bottom: 2px;
    border: none;
  }

  td.lbl {
    text-align: right;
    vertical-align: middle;
  }

  td.field {
    text-align: left;
    width: 65%;
  }

  table th {
    font-weight: normal;
  }

  ul {
    margin: 0;
    padding: 0;
    margin-bottom: 1em;
    list-style-type: none;
  }

  #identifierTooltip {
    color: blue;
    cursor: default;
  }

  fieldset {
    margin-left: auto;
    margin-right: auto;
  }
  
  #patchfield {
    font-weight: bold;
    font-size: 140%;
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

function show(id, displayType) {
    var element = document.getElementById(id);
    element.style.display = displayType;
}

function hide(id) {
    var element = document.getElementById(id);
    element.style.display = "none";
}

function use_patchFile() {
    hide("hgTable");
    show("patchTable", "table");
    document.getElementById("patch").checked = "checked";
}

function use_hg() {
    hide("patchTable");
    show("hgTable", "table");
    document.getElementById("hg").checked = "checked";
}
</script>
</head>

<body onload="
__END_OF_HTML__
    if ($type eq "patch") {
        print 'use_patchFile(); ';
    } elsif ($type eq "hg") {
        print 'use_hg();'
    }
    # close the onload quotes and body tag
    print '">';
    print <<__END_OF_HTML__;
<form action="$SENDCHANGE_URL"
      method="post" enctype="multipart/form-data">
<div id="main">

<div id="types">
  <h3>Welcome to the Mozilla Buildbot Try Server</h3>
  <p>The try server is an easy way to test a patch on all 3 platforms without
  committing to a repository.  For more information, check the <a
  href="$DOCUMENTATION_URL">wiki page</a>.  For build status, check the <a
  href="$BUILDBOT_URL">tinderbox</a>.  Test builds are deleted after 30 days.</p>
  <p>Note: Uploaded patches must be less than 10240kB in size.</p>
  <ul id="testType">
    <li>
    <input id="patch" name="type" value="patch" onclick="use_patchFile();"
      type="radio" />
      <label for="patch">Upload a Patch</label>
    </li>
    <li>
      <input id="hg" name="type" value="hg" onclick="use_hg();" type="radio" />
      <label for="hg">Test a Mercurial Repository</label>
    </li>
  </ul>
</div>

<table id="patchTable">
  <tr>
    <td class="lbl" id="patchfield"><label for="patchFile">Patch:</label></td>
    <td class="field">
      <input id="patchFile" name="patchFile" type="file"/>
    </td>
  </tr>
  <tr>
    <td class="lbl"><label for="patchLevel">Patch level:</label></td>
    <td class="field">
      <select id="patchLevel" name="patchLevel">
__END_OF_HTML__
    for my $i (0 .. 9) {
        if ($patchLevel == $i) {
            print '<option selected="selected">' . $i . "</option>\n";
        } else {
            print '<option>' . $i . '</option>';
        }
    }
    print "</select>\n";
    print <<__END_OF_HTML__;

    </td>
  </tr>
  <tr>
    <td class="lbl"><label for="branch">Branch/Tag:</label></td>
    <td class="field">
      <input id="branch" name="branch" type="text" value="$branch" />
    </td>
  </tr>
</table>

<table id="hgTable">
  <tr>
    <td class="lbl">
      <label for="mozilla-repo">Mozilla repository:</label>
    </td>
    <td class="field">
      <input id="mozilla-repo" name="mozilla-repo" value="$mozillaRepoPath"
        type="text" />(required)
    </td>
  </tr>
  <tr>
    <td class="lbl">
      <label for="tamarin-repo">Tamarin repository:</label>
    </td>
    <td class="field">
      <input id="tamarin-repo" name="tamarin-repo" value="$tamarinRepoPath"
        type="text" />(required)
    </td>
  </tr>
</table>

<table id="allTable">
  <tr>
    <td class="lbl">
      <label for="identifier">Custom Identifier String</label><span id="identifierTooltip"
        title="A string that will be appended to all package names"><sup>?</sup></span>:
    </td>
    <td class="field">
      <input id="identifier" type="text" name="identifier" value="$identifier"/>
    </td>
  </tr>
  <tr>
    <td class="lbl"><label for="mozconfig">Alternate mozconfig:</label></td>
    <td class="field">
      <input id="mozconfig" type="file" name="mozconfig" />
    </td>
  </tr>
  <tr>
    <td class="lbl"><label for="description">Description:</label></td>
    <td class="field">
      <textarea id="description"
        name="description" cols="35" rows="6">$description</textarea>
    </td>
  </tr>
  <tr>
    <td/>
    <td>
      <input value="Submit" type="submit">
    </td>
  </tr>
</table>

<p id="errors" class="alert">
__END_OF_HTML__
    foreach my $e (@err) {
        print "$e<br />\n";
    }
    print <<__END_OF_HTML__;
</p>
</div>
</form>
</body></html>
__END_OF_HTML__

}

1;
