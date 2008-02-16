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
    {
        package => 'GD-Graph3d',
        module  => 'GD::Graph3d',
        version => '0.63'
    },
    );
    return \@modules;
};
