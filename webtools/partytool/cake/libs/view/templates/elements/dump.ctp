<?php
/* SVN FILE: $Id: dump.ctp,v 1.1 2007-05-25 05:54:20 rflint%ryanflint.com Exp $ */
/**
 *
 * PHP versions 4 and 5
 *
 * CakePHP(tm) :  Rapid Development Framework <http://www.cakephp.org/>
 * Copyright 2005-2007, Cake Software Foundation, Inc.
 *								1785 E. Sahara Avenue, Suite 490-204
 *								Las Vegas, Nevada 89104
 *
 * Licensed under The MIT License
 * Redistributions of files must retain the above copyright notice.
 *
 * @filesource
 * @copyright		Copyright 2005-2007, Cake Software Foundation, Inc.
 * @link				http://www.cakefoundation.org/projects/info/cakephp CakePHP(tm) Project
 * @package			cake
 * @subpackage		cake.cake.libs.view.templates.elements
 * @since			CakePHP(tm) v 0.10.5.1782
 * @version			$Revision: 1.1 $
 * @modifiedby		$LastChangedBy: phpnut $
 * @lastmodified	$Date: 2007-05-25 05:54:20 $
 * @license			http://www.opensource.org/licenses/mit-license.php The MIT License
 */
?>
<div id="cakeControllerDump">
	<h2><?php __('Controller dump:'); ?></h2>
		<pre>
			<?php print_r($this->controller); ?>
		</pre>
</div>