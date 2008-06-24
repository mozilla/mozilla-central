
package Testopia::Test::Util;

use base qw(Exporter);

@Testopia::Test::Util::EXPORT = qw(get_rep get_rep_by_field dump_all convert_undef);

sub get_rep {
    # Return a random representative record from the given table
    my ($table) = @_;
    my $dbh     = Bugzilla->dbh;
    
    my ($offset) = $dbh->selectrow_array("SELECT FLOOR(RAND() * COUNT(*)) AS offset FROM $table");
    my $ref      = $dbh->selectrow_hashref("SELECT * FROM $table LIMIT 1 OFFSET $offset");
    return $ref;
}

sub get_rep_by_field {
    my ($table, $field, $value) = @_;
    my $dbh     = Bugzilla->dbh;
    my $ref     = $dbh->selectrow_hashref("SELECT * FROM $table where $field = ? LIMIT 1", undef, $value);
    return $ref;
}

sub dump_all {
    my ($obj, $cmp) = @_;
    print "GOT: \n" . Data::Dumper::Dumper($obj);
    print "EXP: \n" . Data::Dumper::Dumper($cmp);
}

sub convert_undef {
    my ($obj) = @_;
    
    if (ref $obj eq 'ARRAY'){
        foreach my $o (@$obj){
            if (ref $o eq 'ARRAY'){
                convert_undef($o);
            }
            if (ref($o) =~ /Bugzilla/ || ref($o) eq 'HASH'){
                foreach my $key (keys %$o){
                    convert_undef($o->{$key}) if (ref $o->{$key});
                    $o->{$key} = '' unless defined $o->{$key};
                }
            }
        }
    }
    if (ref($obj) =~ /Bugzilla/ || ref($obj) eq 'HASH'){
        foreach my $key (keys %$obj){
            convert_undef($obj->{$key}) if (ref $obj->{$key});
            $obj->{$key} = '' unless defined $obj->{$key};
        }
    }
}

1;