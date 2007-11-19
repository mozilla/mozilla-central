<?php
class AppController extends Controller {
  var $components = array('RequestHandler');

  function beforeFilter() {
    $this->RequestHandler->setContent('json', 'application/json');
  }
}
?>