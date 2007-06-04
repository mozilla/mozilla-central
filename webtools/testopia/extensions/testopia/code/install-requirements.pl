#!/usr/bin/perl -w

sub REQUIRED_MODULES {
    my @modules = (
    {
        package => 'JSON',
        module  => 'JSON',
        version => '1.07'
    },
    {
        package => 'Text-Diff',
        module  => 'Text::Diff',
        version => '0.35'
    },
    );
    return \@modules;
};
