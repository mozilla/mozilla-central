#!/usr/bin/perl

while (my $line = <STDIN>) {
    if ($line =~ /^(\S+)\s(\S+)$/) {
        print "Copying $1 -> $2 ...\n";
        system("/opt/cvsmgmt/copy-cvs-file.pl -d $1,v $2,v");
    }
} 
