# Example configuration file for Tinderbox

# The query system configuration information

# @::QueryList is a list of all configured query systems
# Note that only Bonsai and ViewVC are supported at this time
# To add a query system, add its name to @::QueryList
# then duplicate the "bonsai" or "viewvc" entry in @::QueryInfo
# and change the values appropriately

@::QueryList = ('bonsai', 'viewvc');

%::QueryInfo = (
 'bonsai' => {
     type          => 'bonsai',
     directory     => '/var/www/html/bonsai',
     url           => 'http://bonsai.mozilla.org/',
     registry_url  => 'http://webtools.mozilla.org/registry',
     dbdriver      => 'mysql',
     dbhost        => 'localhost',
     dbport        => '',
     dbname        => 'bonsai',
     dbuser        => 'bonsai',
     dbpasswd      => 'bonsai',
 },

 'viewvc' => {
     type          => 'viewvc',
     url           => 'http://www.viewvc.com/cgi-bin/viewvc.cgi/svn',
     dbdriver      => 'mysql',
     dbhost        => 'localhost',
     dbport        => '',
     dbname        => 'viewvc',
     dbuser        => 'viewvc',
     dbpasswd      => 'viewvc',
 },
);

1;
