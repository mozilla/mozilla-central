#!/usr/bin/perl -w

sub REQUIRED_MODULES {
    my @modules = (
    {
        package => 'JSON',
        module  => 'JSON',
        version => '2.10'
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

sub OPTIONAL_MODULES {
    my @modules = (
    {
        package => 'Text-CSV',
        module  => 'Text::CSV',
        version => '1.06',
        feature => 'CSV Importing of test cases'
    }
    );
    
    return \@modules;
};
    