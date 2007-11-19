<body onload="reg.load()">
<script src="<?=$form->url('/js/main.js');?>" type="text/javascript"></script>
<h1><?=__('register') ?></h1>
<?=$form->create(array('action' => 'register'))."\n" ?>
  <p><?=__('register_email_desc') ?></p>
  <?=$form->input('email', array('error' => __('error_email', true), 'label' => __('email_address', true))) ?>
  <?=$form->input('confemail', array('error' => __('error_email_conf', true), 'label' => __('email_conf', true))) ?>
  <?=$form->input('showemail', array('label' => __('email_hide', true))) ?>
  <?=$form->input('password', array('error' => __('error_password', true), 'label' => __('password', true))) ?>
  <?=$form->input('confpass', array('type' => 'password', 'error' => __('error_password_conf', true), 'label' => __('password_conf', true))) ?>
  <p><?=sprintf(__('register_name_desc', true), APP_NAME) ?></p>
  <?=$form->input('name', array('error' => __('error_name_req', true), 'label' => __('name', true))) ?>
  <p><?=__('register_location_desc') ?></p>
  <?=$form->input('location', array('label' => __('location', true))) ?>
  <p><?=sprintf(__('register_website_desc', true), APP_NAME) ?></p>
  <?=$form->input('website', array('type' => 'text', 'label' => __('website', true), 'error' => __('error_invalid_url', true))) ?>
  <div>
    <label for="UserTz"><?=__('timezone', true) ?></label>
    <span id="time"></span>
    <?=$form->select('tz', $tzs, $utz, array('onchange' => 'reg.tzup()')); ?>
  </div>
  <? if(GMAP_API_KEY != null): ?>
  <script src="http://maps.google.com/maps?file=api&amp;v=2.x&amp;key=<?=GMAP_API_KEY?>" type="text/javascript"></script>
  <div>
    <div id="map" style="width:300px;height:300px"></div>
    <?=$form->hidden('lat') ?>
    <?=$form->hidden('lng') ?>
    <?=$form->hidden('zoom') ?>
  </div>
  <? endif; ?>
  <?=$form->submit(__('register', true)); ?>
</form>