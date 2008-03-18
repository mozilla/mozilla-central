#!/usr/bin/perl -w

use strict;
use Pod::Html;

#relative path to Testopia Webservice modules;
my $dir = '../../Bugzilla/WebService/Testopia';

opendir DIR, $dir or die "Failed to open $dir: $!";
while (defined(my $file = readdir(DIR))){
    next if ($file =~ /^\./);

#    print $file . "\n";
    pod2html("$dir/$file",
        "--outfile=../doc/pod/webservice/$file.html",
        "--title=$file");
}

$dir = '../../Bugzilla/Testopia';
opendir DIR, $dir or die "Failed to open $dir: $!";
while (defined(my $file = readdir(DIR))){
    next if ($file =~ /^\./);

    pod2html("$dir/$file",
        "--outfile=../doc/pod/$file.html",
        "--title=$file");
}