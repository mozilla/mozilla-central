#!/usr/bin/perl

while (my $line = <STDIN>) {
    if ($line =~ /^(\S+)\s(\S+)$/) {
        system("/opt/cvsmgmt/copy-cvs-file.pl -n $1,v $2,v");
    }
} 
